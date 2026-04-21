import React, { useState } from 'react';
import { X, Loader2, Sparkles, Star } from 'lucide-react';
import { Project } from '../types';
import { GoogleGenAI, Type } from '@google/genai';
import { calculateArea, getComputedRoomArea, isPointInPolygon } from '../lib/utils';

interface EvaluateDesignModalProps {
  project: Project;
  isOpen: boolean;
  onClose: () => void;
}

export function EvaluateDesignModal({ project, isOpen, onClose }: EvaluateDesignModalProps) {
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluation, setEvaluation] = useState<{ score: number; feedback: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const evaluateDesign = async () => {
    setIsEvaluating(true);
    setError(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      let totalIndoorArea = 0;
      const projectSummary = project.floors.map(f => {
        return `Planta: ${f.name}
Habitaciones:
${f.rooms.map(r => {
  const area = calculateArea(r.points, project.gridSize * 2);
  const computedArea = getComputedRoomArea(r, project.gridSize * 2);
  const isOutdoor = r.roomType === 'patio' || r.roomType === 'terraza' || r.name.toLowerCase().includes('patio') || r.name.toLowerCase().includes('terraza');
  const isPorch = r.roomType === 'porche' || r.name.toLowerCase().includes('porche');
  
  totalIndoorArea += computedArea;
  
  let note = '';
  if (isOutdoor) note = ' [Exterior - No suma a superficie habitable]';
  else if (isPorch) note = ` [Porche - Suma al 50%: ${computedArea.toFixed(2)} m2]`;
  
  return `- ${r.name || r.roomType} (Real: ${area.toFixed(2)} m2)${note}`;
}).join('\n')}
Muebles:
${f.furniture.map(furn => `- ${furn.name} (${furn.type}) en ${f.rooms.find(r => isPointInPolygon({x: furn.x, y: furn.y}, r.points))?.name || 'fuera'}`).join('\n')}
`;
      }).join('\n\n');

      const prompt = `Actúa como un arquitecto y diseñador de interiores experto. Evalúa el siguiente diseño de vivienda.
      
Superficie computable total: ${totalIndoorArea.toFixed(2)} m2
(Nota: Los patios y terrazas son espacios exteriores y NO computan. Los porches computan al 50%. En la lista de habitaciones se reflejan ambos valores).

Diseño del usuario:
${projectSummary}

Por favor, puntúa el diseño del 1 al 10 basándote en la distribución, el uso del espacio, la elección del mobiliario, la funcionalidad y la coherencia general.
Devuelve un JSON con el siguiente formato exacto:
{
  "score": 8,
  "feedback": "Comentario detallado sobre lo que está bien y lo que se podría mejorar. Sé constructivo y da consejos útiles."
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
        setEvaluation(result);
      } else {
        throw new Error("No se pudo generar la evaluación.");
      }
    } catch (err: any) {
      console.error("Error evaluating design:", err);
      setError(err.message || "Error al conectar con la IA.");
    } finally {
      setIsEvaluating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-500" />
            <h2 className="font-semibold text-slate-800">Evaluación de IA</h2>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto">
          {!evaluation && !isEvaluating && !error && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-8 h-8 text-indigo-500" />
              </div>
              <h3 className="text-lg font-medium text-slate-800 mb-2">Evalúa tu diseño</h3>
              <p className="text-slate-500 text-sm mb-6">
                Nuestra IA analizará la distribución, el uso del espacio y el mobiliario de tu proyecto para darte una puntuación y consejos de mejora.
              </p>
              <button
                onClick={evaluateDesign}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-medium transition-colors shadow-sm"
              >
                Comenzar evaluación
              </button>
            </div>
          )}

          {isEvaluating && (
            <div className="text-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mx-auto mb-4" />
              <p className="text-slate-600 font-medium">Analizando el diseño...</p>
              <p className="text-slate-400 text-sm mt-1">Evaluando distribución y mobiliario</p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm mb-4">
              {error}
              <button 
                onClick={evaluateDesign}
                className="block mt-2 font-medium underline"
              >
                Reintentar
              </button>
            </div>
          )}

          {evaluation && !isEvaluating && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex flex-col items-center mb-6">
                <div className="relative">
                  <svg className="w-24 h-24 transform -rotate-90">
                    <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-100" />
                    <circle 
                      cx="48" 
                      cy="48" 
                      r="40" 
                      stroke="currentColor" 
                      strokeWidth="8" 
                      fill="transparent" 
                      strokeDasharray={251.2} 
                      strokeDashoffset={251.2 - (251.2 * evaluation.score) / 10} 
                      className={evaluation.score >= 8 ? "text-green-500" : evaluation.score >= 5 ? "text-amber-500" : "text-red-500"} 
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center flex-col">
                    <span className="text-3xl font-bold text-slate-800">{evaluation.score}</span>
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">/ 10</span>
                  </div>
                </div>
                
                <div className="flex gap-1 mt-3">
                  {[...Array(10)].map((_, i) => (
                    <Star 
                      key={i} 
                      size={14} 
                      className={i < evaluation.score ? "fill-amber-400 text-amber-400" : "fill-slate-100 text-slate-200"} 
                    />
                  ))}
                </div>
              </div>

              <div className="bg-slate-50 rounded-xl p-5 border border-slate-100">
                <h4 className="font-medium text-slate-800 mb-2 flex items-center gap-2">
                  <Sparkles size={16} className="text-indigo-500" />
                  Feedback de la IA
                </h4>
                <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">
                  {evaluation.feedback}
                </p>
              </div>

              <button
                onClick={evaluateDesign}
                className="w-full mt-6 py-2.5 text-sm text-indigo-600 hover:text-indigo-800 font-medium transition-colors flex justify-center items-center gap-2 bg-indigo-50 hover:bg-indigo-100 rounded-xl"
              >
                <Sparkles className="w-4 h-4" />
                Evaluar de nuevo
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
