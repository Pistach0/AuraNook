import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Trophy, Play, CheckCircle2, Circle, Loader2, Sparkles } from 'lucide-react';
import { Challenge, Project, Floor, Room, Furniture, ChallengeRequirement } from '../types';
import { cn, calculateArea } from '../lib/utils';
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
  const [error, setError] = useState<string | null>(null);

  const generateChallenge = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: 'Genera un desafío de diseño de interiores o arquitectura para una aplicación de diseño de planos. Debe ser creativo y divertido. Usa los siguientes tipos de habitación permitidos si pides un tipo específico: dormitorio, baño, cocina, salon, comedor, salon_comedor_cocina, despacho, porche, patio, terraza, despensa, bodega, entrada, pasillo, ascensor, garaje, lavadero, vestidor, gimnasio, sala_juegos.',
        config: {
          systemInstruction: 'Eres un experto en diseño de interiores y arquitectura. Crea desafíos para usuarios de una app de diseño de planos. Para el área, usa siempre "max_area" (área máxima permitida en m2).',
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
                      description: 'Debe ser uno de: room_count, furniture_count, max_area, specific_furniture, room_type' 
                    },
                    targetValue: { type: Type.STRING, description: 'El valor objetivo (ej. "3", "bed", "50", "cocina")' },
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
                totalArea += calculateArea(room.points, project.gridSize * 2);
              });
            });
            isMet = totalArea > 0 && totalArea <= target;
            break;
          }
          case 'specific_furniture': {
            const targetType = (req.targetValue as string).toLowerCase();
            let found = false;
            project.floors.forEach(floor => {
              if (floor.furniture.some(f => f.type.toLowerCase().includes(targetType) || f.category.toLowerCase().includes(targetType))) {
                found = true;
              }
            });
            isMet = found;
            break;
          }
          case 'room_type': {
            const targetType = (req.targetValue as string).toLowerCase();
            let found = false;
            project.floors.forEach(floor => {
              if (floor.rooms.some(r => r.roomType?.toLowerCase() === targetType || r.name.toLowerCase().includes(targetType))) {
                found = true;
              }
            });
            isMet = found;
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

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-500" />
          <h2 className="font-semibold text-slate-800">AuraChallenge</h2>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {!challenge ? (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-amber-500" />
            </div>
            <div>
              <h3 className="font-medium text-slate-800 mb-1">¿Listo para un desafío?</h3>
              <p className="text-sm text-slate-500">
                Genera un desafío de diseño aleatorio usando IA y pon a prueba tus habilidades.
              </p>
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
              <h3 className="font-bold text-lg text-slate-800 mb-2">{challenge.title}</h3>
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

      {challenge && (
        <div className="p-4 border-t border-slate-100 bg-white space-y-3">
          <button
            onClick={validateChallenge}
            disabled={isValidating}
            className="w-full py-2.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isValidating ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {isValidating ? 'Validando...' : 'Validar Diseño'}
          </button>
          <button
            onClick={generateChallenge}
            disabled={isGenerating}
            className="w-full py-2 text-sm text-slate-500 hover:text-slate-800 transition-colors"
          >
            Generar otro desafío
          </button>
        </div>
      )}
    </div>
  );
}
