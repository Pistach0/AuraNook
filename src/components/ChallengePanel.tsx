import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Trophy, Play, CheckCircle2, Circle, Loader2, Sparkles, Bookmark, BookmarkCheck, Star, Trash2 } from 'lucide-react';
import { Challenge, Project, Floor, Room, Furniture, ChallengeRequirement } from '../types';
import { cn, calculateArea, isPointInPolygon } from '../lib/utils';
import { GoogleGenAI, Type } from '@google/genai';

interface ChallengePanelProps {
  project: Project;
  currentFloor: Floor;
  isOpen: boolean;
  onClose: () => void;
}

export function ChallengePanel({ project, currentFloor, isOpen, onClose }: ChallengePanelProps) {
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState<'facil' | 'medio' | 'dificil'>('medio');
  const [savedChallenges, setSavedChallenges] = useState<Challenge[]>([]);
  const [activeTab, setActiveTab] = useState<'current' | 'saved'>('current');

  useEffect(() => {
    const saved = localStorage.getItem('planify_saved_challenges');
    if (saved) {
      setSavedChallenges(JSON.parse(saved));
    }
  }, []);

  const toggleSaveChallenge = () => {
    if (!challenge) return;
    
    let updated: Challenge[];
    if (challenge.isSaved) {
      updated = savedChallenges.filter(c => c.id !== challenge.id);
      setChallenge({ ...challenge, isSaved: false });
    } else {
      const challengeToSave = { ...challenge, isSaved: true };
      updated = [...savedChallenges, challengeToSave];
      setChallenge(challengeToSave);
    }
    
    setSavedChallenges(updated);
    localStorage.setItem('planify_saved_challenges', JSON.stringify(updated));
  };

  const loadSavedChallenge = (savedChallenge: Challenge) => {
    setChallenge(savedChallenge);
    setActiveTab('current');
  };

  const deleteSavedChallenge = (id: string) => {
    const updated = savedChallenges.filter(c => c.id !== id);
    setSavedChallenges(updated);
    localStorage.setItem('planify_saved_challenges', JSON.stringify(updated));
    if (challenge?.id === id) {
      setChallenge({ ...challenge, isSaved: false });
    }
  };

  const evaluateDesign = async () => {
    if (!challenge) return;
    setIsEvaluating(true);
    setError(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const projectSummary = project.floors.map(f => {
        return `Planta: ${f.name}
Habitaciones:
${f.rooms.map(r => `- ${r.name || r.roomType} (${calculateArea(r.points, project.gridSize * 2).toFixed(2)} m2)`).join('\n')}
Muebles:
${f.furniture.map(furn => `- ${furn.name} (${furn.type}) en ${f.rooms.find(r => isPointInPolygon({x: furn.x, y: furn.y}, r.points))?.name || 'fuera'}`).join('\n')}
`;
      }).join('\n\n');

      const prompt = `Evalúa el siguiente diseño de interiores/arquitectura para el desafío "${challenge.title}".
Descripción del desafío: ${challenge.description}

Diseño del usuario:
${projectSummary}

Por favor, puntúa el diseño del 1 al 10 basándote en la distribución, el uso del espacio, la elección del mobiliario y la coherencia general.
Devuelve un JSON con el siguiente formato exacto:
{
  "score": 8,
  "feedback": "Comentario detallado sobre lo que está bien y lo que se podría mejorar."
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              score: { type: Type.NUMBER },
              feedback: { type: Type.STRING }
            },
            required: ['score', 'feedback']
          }
        }
      });

      const jsonStr = response.text?.trim();
      if (jsonStr) {
        const result = JSON.parse(jsonStr);
        const updatedChallenge = { ...challenge, score: result.score, feedback: result.feedback };
        setChallenge(updatedChallenge);
        
        // Update saved version if it exists
        if (updatedChallenge.isSaved) {
          const updatedSaved = savedChallenges.map(c => c.id === updatedChallenge.id ? updatedChallenge : c);
          setSavedChallenges(updatedSaved);
          localStorage.setItem('planify_saved_challenges', JSON.stringify(updatedSaved));
        }
      }
    } catch (error: any) {
      console.error('Error evaluating design:', error);
      setError('Error al evaluar el diseño con IA.');
    } finally {
      setIsEvaluating(false);
    }
  };

  const generateChallenge = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      let difficultyPrompt = '';
      if (difficulty === 'facil') {
        difficultyPrompt = 'Nivel FÁCIL: Pocos requisitos (3 o 4), restricciones muy holgadas, espacios grandes permitidos. Ideal para principiantes. PROHIBIDO pedir patios interiores.';
      } else if (difficulty === 'medio') {
        difficultyPrompt = 'Nivel MEDIO: Requisitos estándar (4 o 5), restricciones normales. Un reto equilibrado. PROHIBIDO pedir patios interiores.';
      } else {
        difficultyPrompt = 'Nivel DIFÍCIL: Muchos requisitos (5 a 7), restricciones muy estrictas (ej. áreas máximas muy pequeñas, muchos muebles específicos requeridos). Un verdadero rompecabezas arquitectónico. Aquí SÍ puedes (y es recomendable) pedir un patio interior.';
      }
      
      const mandatoryRequirements = 'IMPORTANTE: Para TODOS los niveles de dificultad, debes incluir SIEMPRE estos requisitos obligatorios:\n1. Un área máxima (`max_area`).\n2. Dimensiones máximas de la parcela (ancho x largo) usando `max_dimensions` (ej. "8x15"). En la descripción del requisito debe quedar claro el ancho y el largo.\n3. Especificar claramente el número de dormitorios y su tipo (dobles o individuales) usando `double_bedroom_count` y/o `single_bedroom_count`. En la descripción del requisito debe quedar claro cuántos son dobles y cuántos individuales. PROHIBIDO usar `room_type` con valor "dormitorio" para contar habitaciones, usa siempre los contadores específicos.\n\nAdemás, añade VARIEDAD a los retos. No hagas siempre el mismo tipo de casa. Pide cosas como: "un garaje para 2 coches", "una casa de 2 plantas", "una vivienda entre medianeras", "un loft sin paredes interiores", etc.';

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Genera un desafío de diseño de interiores o arquitectura para una aplicación de diseño de planos. Debe ser creativo y divertido. \n\n${difficultyPrompt}\n\n${mandatoryRequirements}\n\nUsa los siguientes tipos de habitación permitidos si pides un tipo específico: dormitorio, baño, cocina, salon, comedor, salon_comedor_cocina, despacho, porche, patio, terraza, despensa, bodega, entrada, pasillo, ascensor, garaje, lavadero, vestidor, gimnasio, sala_juegos.\n\nAdemás de limitación por m2, puedes indicar la medida máxima de ancho x largo de la zona edificable (ej. 10x20), indicar si es una vivienda independiente, entre medianeras o pareada (para el tema de la luz natural), y jugar con varias plantas.\n\nDistingue entre dormitorio doble (mín. 10m2) y dormitorio individual (entre 6 y 10m2).\n\nTen en cuenta que el sistema validará automáticamente que:\n- Todas las habitaciones tengan puerta.\n- Haya una puerta de entrada a la vivienda.\n- Las habitaciones habitables tengan ventana.\n- Si hay varias plantas, haya escaleras.\n- Las habitaciones tengan su mobiliario básico (ej. cocina con encimera, nevera, fregadero y horno; baño con inodoro y lavabo; etc.).\nPor lo tanto, puedes mencionarlo en la descripción del reto para que el usuario lo sepa.`,
        config: {
          systemInstruction: 'Eres un experto en diseño de interiores y arquitectura. Crea desafíos para usuarios de una app de diseño de planos.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING, description: 'Título corto del desafío' },
              description: { type: Type.STRING, description: 'Descripción detallada del desafío' },
              requirements: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    type: { 
                      type: Type.STRING, 
                      description: 'Debe ser uno de: room_count, furniture_count, max_area, max_dimensions, dwelling_type, floors_count, double_bedroom_count, single_bedroom_count, specific_furniture, room_type' 
                    },
                    targetValue: { type: Type.STRING, description: 'El valor objetivo (ej. "3", "bed", "50", "10x20", "independiente", "2")' },
                    description: { type: Type.STRING, description: 'Descripción legible del requisito' }
                  },
                  required: ['id', 'type', 'targetValue', 'description']
                }
              }
            },
            required: ['title', 'description', 'requirements']
          }
        }
      });

      const jsonStr = response.text?.trim();
      if (jsonStr) {
        const newChallenge = JSON.parse(jsonStr) as Challenge;
        newChallenge.id = Math.random().toString(36).substring(7);
        setChallenge(newChallenge);
      } else {
        setError('No se pudo generar el desafío.');
      }
    } catch (error: any) {
      console.error('Error generating challenge:', error);
      let errorMessage = error.message || 'Error al conectar con la IA.';
      
      if (errorMessage.includes('API key not valid') || errorMessage.includes('API_KEY_INVALID')) {
        errorMessage = 'La clave de API de Gemini no es válida o no está configurada. Por favor, añade tu GEMINI_API_KEY en el menú de "Settings" (Secrets) arriba a la derecha.';
      }
      
      setError(errorMessage);
    } finally {
      setIsGenerating(false);
    }
  };

  const isOpeningInRoom = (opening: any, room: Room, floor: Floor): boolean => {
    const wall = floor.walls.find(w => w.id === opening.wallId);
    if (!wall) return false;
    
    const ox = wall.start.x + (wall.end.x - wall.start.x) * opening.distance;
    const oy = wall.start.y + (wall.end.y - wall.start.y) * opening.distance;

    for (let i = 0; i < room.points.length; i++) {
      const p1 = room.points[i];
      const p2 = room.points[(i + 1) % room.points.length];
      
      const A = ox - p1.x;
      const B = oy - p1.y;
      const C = p2.x - p1.x;
      const D = p2.y - p1.y;

      const dot = A * C + B * D;
      const len_sq = C * C + D * D;
      let param = -1;
      if (len_sq !== 0) param = dot / len_sq;

      let xx, yy;
      if (param < 0) {
        xx = p1.x;
        yy = p1.y;
      } else if (param > 1) {
        xx = p2.x;
        yy = p2.y;
      } else {
        xx = p1.x + param * C;
        yy = p1.y + param * D;
      }

      const dx = ox - xx;
      const dy = oy - yy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      // Wall thickness can be up to 30cm (15px).
      // Using 50px tolerance to be absolutely sure we catch openings even if the room polygon
      // is slightly offset from the wall centerline due to complex intersections.
      if (dist < 50) {
        return true;
      }
    }
    return false;
  };

  const hasWindow = (room: Room, floor: Floor): boolean => {
    return floor.openings.some(o => o.type === 'window' && isOpeningInRoom(o, room, floor));
  };

  const hasDoor = (room: Room, floor: Floor): boolean => {
    return floor.openings.some(o => o.type === 'door' && isOpeningInRoom(o, room, floor));
  };

  const hasEntranceDoor = (project: Project): boolean => {
    let hasExteriorDoor = false;
    
    project.floors.forEach(floor => {
      floor.openings.forEach(o => {
        if (o.type === 'door') {
          let roomCount = 0;
          floor.rooms.forEach(room => {
            if (isOpeningInRoom(o, room, floor)) {
              roomCount++;
            }
          });
          
          if (roomCount === 1) {
            hasExteriorDoor = true;
          }
        }
      });
    });
    
    return hasExteriorDoor;
  };

  const hasBasicFurniture = (room: Room, floor: Floor, roomType: string): boolean => {
    const furnitureInRoom = floor.furniture.filter(f => isPointInPolygon({ x: f.x, y: f.y }, room.points));
    
    switch (roomType) {
      case 'cocina':
        return furnitureInRoom.some(f => f.type === 'kitchen_counter') &&
               furnitureInRoom.some(f => f.type === 'fridge') &&
               furnitureInRoom.some(f => f.type === 'sink') &&
               furnitureInRoom.some(f => f.type === 'stove');
      case 'salon':
        return furnitureInRoom.some(f => f.type === 'sofa' || f.type === 'sofa_2' || f.type === 'chaiselongue');
      case 'dormitorio_doble':
        return furnitureInRoom.some(f => f.type === 'bed_double') || furnitureInRoom.filter(f => f.type === 'bed_single').length >= 2;
      case 'dormitorio_individual':
        return furnitureInRoom.some(f => f.type === 'bed_single' || f.type === 'bed_double');
      case 'baño':
        return furnitureInRoom.some(f => f.type === 'toilet') &&
               furnitureInRoom.some(f => f.type === 'bathroom_sink');
      case 'lavadero':
        return furnitureInRoom.some(f => f.type === 'washing_machine');
      case 'garaje':
        return furnitureInRoom.some(f => f.type === 'car');
      case 'despacho':
        return furnitureInRoom.some(f => f.type === 'desk') &&
               furnitureInRoom.some(f => f.type === 'office_chair');
      default:
        return true;
    }
  };

  const validateChallenge = () => {
    if (!challenge) return;
    setIsValidating(true);

    setTimeout(() => {
      const updatedRequirements = challenge.requirements.map(req => {
        let isMet = false;
        
        switch (req.type) {
          case 'room_count': {
            const target = parseInt(req.targetValue as string, 10);
            const totalRooms = project.floors.reduce((acc, floor) => acc + floor.rooms.length, 0);
            isMet = totalRooms >= target;
            break;
          }
          case 'furniture_count': {
            const target = parseInt(req.targetValue as string, 10);
            const totalFurniture = project.floors.reduce((acc, floor) => acc + floor.furniture.length, 0);
            isMet = totalFurniture >= target;
            break;
          }
          case 'max_area': {
            const target = parseFloat(req.targetValue as string);
            let totalArea = 0;
            project.floors.forEach(floor => {
              floor.rooms.forEach(room => {
                if (room.roomType !== 'patio' && !room.name.toLowerCase().includes('patio') && room.roomType !== 'terraza' && !room.name.toLowerCase().includes('terraza')) {
                  totalArea += calculateArea(room.points, project.gridSize * 2);
                }
              });
            });
            // Use a small epsilon (0.1) for floating point comparisons
            isMet = totalArea > 0 && totalArea <= (target + 0.1);
            break;
          }
          case 'specific_furniture': {
            const targetType = (req.targetValue as string).toLowerCase();
            let found = false;
            
            const esToEn: Record<string, string[]> = {
              'bañera': ['bathtub'],
              'cama': ['bed'],
              'sofa': ['sofa', 'couch', 'chaiselongue'],
              'sofá': ['sofa', 'couch', 'chaiselongue'],
              'mesa': ['table', 'desk'],
              'silla': ['chair', 'stool'],
              'inodoro': ['toilet', 'wc'],
              'lavabo': ['sink', 'washbasin'],
              'ducha': ['shower'],
              'armario': ['wardrobe', 'closet', 'cabinet'],
              'estanteria': ['shelf', 'bookshelf'],
              'estantería': ['shelf', 'bookshelf'],
              'nevera': ['fridge', 'refrigerator'],
              'horno': ['oven', 'stove'],
              'lavadora': ['washing_machine', 'washer'],
              'tv': ['tv'],
              'television': ['tv'],
              'televisión': ['tv'],
              'coche': ['car'],
              'planta': ['plant'],
              'chimenea': ['fireplace'],
              'sillón': ['armchair'],
              'sillon': ['armchair'],
              'encimera': ['kitchen_counter', 'counter'],
              'mesita': ['nightstand'],
              'barbacoa': ['bbq'],
              'tumbona': ['sunbed'],
              'piscina': ['pool'],
              'billar': ['billiards'],
              'futbolin': ['foosball'],
              'futbolín': ['foosball'],
              'ping pong': ['ping_pong'],
              'alfombra': ['rug'],
              'columpio': ['swing']
            };

            project.floors.forEach(floor => {
              if (floor.furniture.some(f => {
                const typeMatch = f.type.toLowerCase().includes(targetType) || targetType.includes(f.type.toLowerCase());
                const catMatch = f.category.toLowerCase().includes(targetType) || targetType.includes(f.category.toLowerCase());
                const nameMatch = f.name.toLowerCase().includes(targetType) || targetType.includes(f.name.toLowerCase());
                
                let mappedMatch = false;
                for (const [es, enTypes] of Object.entries(esToEn)) {
                  if (targetType.includes(es)) {
                    if (enTypes.some(en => f.type.toLowerCase().includes(en))) {
                      mappedMatch = true;
                      break;
                    }
                  }
                }

                return typeMatch || catMatch || nameMatch || mappedMatch;
              })) {
                found = true;
              }
            });
            isMet = found;
            break;
          }
          case 'room_type': {
            let targetType = (req.targetValue as string).toLowerCase();
            // Normalize spaces to underscores for consistent matching
            targetType = targetType.replace(' ', '_');
            
            let found = false;
            const habitableTypes = ['dormitorio', 'cocina', 'salon', 'comedor', 'salon_comedor_cocina', 'dormitorio_doble', 'dormitorio_individual'];
            
            project.floors.forEach(floor => {
              if (floor.rooms.some(r => {
                const area = calculateArea(r.points, project.gridSize * 2);
                let isMatch = r.roomType?.toLowerCase() === targetType || r.name.toLowerCase().replace(' ', '_').includes(targetType);
                
                if (targetType === 'dormitorio_doble' && (r.roomType === 'dormitorio' || r.name.toLowerCase().includes('dormitorio')) && area >= 10) {
                  isMatch = true;
                } else if (targetType === 'dormitorio_individual' && (r.roomType === 'dormitorio' || r.name.toLowerCase().includes('dormitorio')) && area < 10) {
                  isMatch = true;
                }
                
                if (!isMatch) return false;
                
                if ((targetType === 'dormitorio' || targetType === 'dormitorio_doble' || targetType === 'dormitorio_individual') && area < 6) {
                  return false;
                }

                if (!hasBasicFurniture(r, floor, targetType)) {
                  return false;
                }
                
                return true;
              })) {
                found = true;
              }
            });
            isMet = found;
            break;
          }
          case 'max_dimensions': {
            const dims = (req.targetValue as string).toLowerCase().split('x');
            if (dims.length === 2) {
              const max1 = parseFloat(dims[0]);
              const max2 = parseFloat(dims[1]);
              
              let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
              project.floors.forEach(floor => {
                floor.rooms.forEach(room => {
                  room.points.forEach(p => {
                    if (p.x < minX) minX = p.x;
                    if (p.y < minY) minY = p.y;
                    if (p.x > maxX) maxX = p.x;
                    if (p.y > maxY) maxY = p.y;
                  });
                });
              });
              
              if (minX !== Infinity) {
                const widthMeters = ((maxX - minX) / (project.gridSize * 2));
                const heightMeters = ((maxY - minY) / (project.gridSize * 2));
                
                const fitsNormal = widthMeters <= max1 && heightMeters <= max2;
                const fitsRotated = widthMeters <= max2 && heightMeters <= max1;
                
                isMet = fitsNormal || fitsRotated;
              }
            }
            break;
          }
          case 'dwelling_type': {
            // Difficult to validate automatically, assume true for now
            isMet = true;
            break;
          }
          case 'floors_count': {
            const target = parseInt(req.targetValue as string, 10);
            let hasStairs = true;
            if (target > 1) {
              hasStairs = project.floors.some(f => f.stairs.length > 0);
            }
            isMet = project.floors.length >= target && hasStairs;
            break;
          }
          case 'double_bedroom_count': {
            const target = parseInt(req.targetValue as string, 10);
            let count = 0;
            project.floors.forEach(floor => {
              floor.rooms.forEach(room => {
                if (room.roomType === 'dormitorio' || room.name.toLowerCase().includes('dormitorio')) {
                  if (calculateArea(room.points, project.gridSize * 2) >= 10 && hasBasicFurniture(room, floor, 'dormitorio_doble')) {
                    count++;
                  }
                }
              });
            });
            isMet = count >= target;
            break;
          }
          case 'single_bedroom_count': {
            const target = parseInt(req.targetValue as string, 10);
            let count = 0;
            project.floors.forEach(floor => {
              floor.rooms.forEach(room => {
                if (room.roomType === 'dormitorio' || room.name.toLowerCase().includes('dormitorio')) {
                  const area = calculateArea(room.points, project.gridSize * 2);
                  // Un dormitorio doble (>10m2) también cuenta como válido para el requisito de individual
                  if (area >= 6 && (hasBasicFurniture(room, floor, 'dormitorio_individual') || hasBasicFurniture(room, floor, 'dormitorio_doble'))) {
                    count++;
                  }
                }
              });
            });
            isMet = count >= target;
            break;
          }
          default:
            isMet = false;
        }

        return { ...req, isMet };
      });

      setChallenge({ ...challenge, requirements: updatedRequirements });
      setIsValidating(false);
    }, 500); // Fake delay for UX
  };

  if (!isOpen) return null;

  const allRequirementsMet = challenge?.requirements.every(req => req.isMet) ?? false;

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="p-4 border-b border-slate-100 bg-slate-50 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            <h2 className="font-semibold text-slate-800">AuraChallenge</h2>
          </div>
        </div>
        
        <div className="flex bg-slate-200/50 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('current')}
            className={cn(
              "flex-1 py-1.5 text-xs font-medium rounded-md transition-all",
              activeTab === 'current' 
                ? "bg-white text-indigo-700 shadow-sm" 
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            Actual
          </button>
          <button
            onClick={() => setActiveTab('saved')}
            className={cn(
              "flex-1 py-1.5 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-1",
              activeTab === 'saved' 
                ? "bg-white text-indigo-700 shadow-sm" 
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            Guardados
            {savedChallenges.length > 0 && (
              <span className="bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full text-[10px]">
                {savedChallenges.length}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'saved' ? (
          <div className="space-y-3">
            {savedChallenges.length === 0 ? (
              <div className="text-center text-slate-500 mt-8 text-sm">
                No tienes desafíos guardados.
              </div>
            ) : (
              savedChallenges.map(saved => (
                <div key={saved.id} className="p-3 border border-slate-200 rounded-lg bg-slate-50 hover:border-indigo-300 transition-colors cursor-pointer" onClick={() => loadSavedChallenge(saved)}>
                  <div className="flex items-start justify-between mb-1">
                    <h4 className="font-medium text-slate-800 text-sm">{saved.title}</h4>
                    <button 
                      onClick={(e) => { e.stopPropagation(); deleteSavedChallenge(saved.id); }}
                      className="text-slate-400 hover:text-red-500 p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 line-clamp-2 mb-2">{saved.description}</p>
                  {saved.score && (
                    <div className="flex items-center gap-1 text-xs font-medium text-amber-600">
                      <Star className="w-3 h-3 fill-amber-500" />
                      Puntuación: {saved.score}/10
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        ) : !challenge ? (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-amber-500" />
            </div>
            <div>
              <h3 className="font-medium text-slate-800 mb-1">¿Listo para un desafío?</h3>
              <p className="text-sm text-slate-500 mb-4">
                Genera un desafío de diseño aleatorio usando IA y pon a prueba tus habilidades.
              </p>
              
              <div className="flex bg-slate-100 p-1 rounded-lg mb-4">
                {(['facil', 'medio', 'dificil'] as const).map(level => (
                  <button
                    key={level}
                    onClick={() => setDifficulty(level)}
                    className={cn(
                      "flex-1 py-1.5 text-xs font-medium rounded-md capitalize transition-all",
                      difficulty === level 
                        ? "bg-white text-indigo-700 shadow-sm" 
                        : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
                    )}
                  >
                    {level === 'facil' ? 'Fácil' : level === 'medio' ? 'Medio' : 'Difícil'}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={generateChallenge}
              disabled={isGenerating}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              {isGenerating ? 'Generando...' : 'Generar Desafío'}
            </button>
            {error && (
              <div className="text-xs text-red-500 bg-red-50 p-2 rounded border border-red-100 max-w-full break-words">
                {error}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="font-bold text-lg text-slate-800">{challenge.title}</h3>
                <button
                  onClick={toggleSaveChallenge}
                  className={cn(
                    "p-1.5 rounded-lg transition-colors shrink-0",
                    challenge.isSaved 
                      ? "bg-indigo-100 text-indigo-600 hover:bg-indigo-200" 
                      : "bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                  )}
                  title={challenge.isSaved ? "Desafío guardado" : "Guardar desafío"}
                >
                  {challenge.isSaved ? <BookmarkCheck className="w-5 h-5" /> : <Bookmark className="w-5 h-5" />}
                </button>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">{challenge.description}</p>
            </div>

            <div className="space-y-3">
              <h4 className="font-medium text-slate-700 text-sm uppercase tracking-wider">Requisitos</h4>
              <ul className="space-y-2">
                {challenge.requirements.map(req => (
                  <li key={req.id} className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100">
                    <div className="mt-0.5">
                      {req.isMet === true ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      ) : (
                        <Circle className="w-5 h-5 text-slate-300" />
                      )}
                    </div>
                    <span className={cn(
                      "text-sm",
                      req.isMet === true ? "text-slate-500 line-through" : "text-slate-700"
                    )}>
                      {req.description}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      {challenge && activeTab === 'current' && (
        <div className="p-4 border-t border-slate-100 bg-white space-y-3">
          {challenge.score ? (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <Star className="w-5 h-5 fill-amber-500 text-amber-500" />
                <span className="font-bold text-amber-800">Puntuación IA: {challenge.score}/10</span>
              </div>
              <p className="text-sm text-amber-700 leading-relaxed">{challenge.feedback}</p>
            </div>
          ) : (
            <div className="flex gap-2 mb-4">
              <button
                onClick={validateChallenge}
                disabled={isValidating || isEvaluating}
                className="flex-1 py-2.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isValidating ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                {isValidating ? 'Validando...' : 'Validar'}
              </button>
              <button
                onClick={evaluateDesign}
                disabled={isValidating || isEvaluating || !allRequirementsMet}
                className="flex-1 py-2.5 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                title={!allRequirementsMet ? "Debes cumplir todos los requisitos primero" : "Evaluar diseño con IA"}
              >
                {isEvaluating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Star className="w-4 h-4" />}
                {isEvaluating ? 'Evaluando...' : 'Evaluar con IA'}
              </button>
            </div>
          )}
          
          <div className="pt-4 border-t border-slate-100">
            <p className="text-xs text-slate-500 mb-2 text-center">¿Quieres intentar otro?</p>
            <div className="flex bg-slate-100 p-1 rounded-lg mb-3">
              {(['facil', 'medio', 'dificil'] as const).map(level => (
                <button
                  key={level}
                  onClick={() => setDifficulty(level)}
                  className={cn(
                    "flex-1 py-1 text-xs font-medium rounded-md capitalize transition-all",
                    difficulty === level 
                      ? "bg-white text-indigo-700 shadow-sm" 
                      : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
                  )}
                >
                  {level === 'facil' ? 'Fácil' : level === 'medio' ? 'Medio' : 'Difícil'}
                </button>
              ))}
            </div>
            <button
              onClick={generateChallenge}
              disabled={isGenerating}
              className="w-full py-2 text-sm text-indigo-600 hover:text-indigo-800 font-medium transition-colors flex justify-center items-center gap-2"
            >
              {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {isGenerating ? 'Generando...' : 'Generar otro desafío'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
