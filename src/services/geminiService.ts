import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { Floor, Furniture, Project } from "../types";

// The platform injects GEMINI_API_KEY into process.env, but we add a fallback for local dev
const apiKey = process.env.GEMINI_API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY || "";
const ai = new GoogleGenAI({ apiKey });

export interface FurnitureOptimization {
  id: string;
  x: number;
  y: number;
  rotation: number;
}

export async function optimizeSpace(floor: Floor, pixelsPerMeter: number): Promise<FurnitureOptimization[]> {
  const model = "gemini-3-flash-preview";

  if (!apiKey) {
    throw new Error("La clave de API de Gemini no está configurada. Por favor, añádela en la configuración.");
  }

  // Prepare a simplified representation of the floor for the AI
  const floorData = {
    walls: floor.walls.map(w => ({
      id: w.id,
      start: { x: Number((w.start.x / pixelsPerMeter).toFixed(2)), y: Number((w.start.y / pixelsPerMeter).toFixed(2)) },
      end: { x: Number((w.end.x / pixelsPerMeter).toFixed(2)), y: Number((w.end.y / pixelsPerMeter).toFixed(2)) },
      thickness: w.thickness / 100 // cm to m
    })),
    rooms: floor.rooms.map(r => ({
      id: r.id,
      name: r.name,
      points: r.points.map(p => ({ x: Number((p.x / pixelsPerMeter).toFixed(2)), y: Number((p.y / pixelsPerMeter).toFixed(2)) }))
    })),
    openings: floor.openings.map(o => ({
      id: o.id,
      type: o.type,
      width: o.width / 100, // cm to m
      position: Number(o.position.toFixed(2)),
      wallId: o.wallId
    })),
    furniture: floor.furniture.map(f => ({
      id: f.id,
      type: f.type,
      width: f.width / 100, // cm to m
      height: f.height / 100, // cm to m
      x: Number((f.x / pixelsPerMeter).toFixed(2)),
      y: Number((f.y / pixelsPerMeter).toFixed(2)),
      rotation: f.rotation
    }))
  };

  const prompt = `
    Eres un experto en diseño de interiores y arquitectura. 
    Tu tarea es optimizar la distribución del mobiliario en la habitación proporcionada.
    
    Datos de la planta (en metros):
    ${JSON.stringify(floorData, null, 2)}
    
    Instrucciones:
    1. Analiza las dimensiones de las habitaciones (rooms) y la ubicación de las paredes (walls) y aberturas (openings como puertas y ventanas).
    2. Sugiere una nueva ubicación (x, y) y rotación para cada mueble (furniture) de modo que el espacio sea funcional, estético y respete las zonas de paso.
    3. El sistema de coordenadas tiene el origen (0,0) en la esquina superior izquierda.
    4. No muevas los muebles fuera de los límites de las habitaciones.
    5. Evita bloquear puertas y ventanas.
    6. Mantén las dimensiones originales de los muebles.
    7. Devuelve la respuesta ÚNICAMENTE como un array de objetos JSON con el formato: { "id": string, "x": number, "y": number, "rotation": number }.
    8. Las coordenadas (x, y) deben estar en metros.
    9. Sé creativo pero práctico. Por ejemplo, coloca el sofá frente a la TV, la cama con la cabecera contra una pared, etc.
  `;

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model,
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              x: { type: Type.NUMBER },
              y: { type: Type.NUMBER },
              rotation: { type: Type.NUMBER }
            },
            required: ["id", "x", "y", "rotation"]
          }
        }
      }
    });

    let text = response.text || "[]";
    
    // Defensive parsing: remove potential markdown wrappers if the model ignored responseMimeType
    if (text.includes("```")) {
      const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (match) {
        text = match[1];
      }
    }
    
    // Sometimes the model might return a JSON object with a key instead of a direct array
    let result: any;
    try {
      result = JSON.parse(text.trim());
    } catch (e) {
      console.error("JSON parse error:", e, "Raw text:", text);
      throw new Error("Error al procesar la respuesta de la IA.");
    }
    
    if (!Array.isArray(result) && typeof result === 'object' && result !== null) {
      // Look for an array property if it's not a direct array
      const arrayKey = Object.keys(result).find(key => Array.isArray(result[key]));
      if (arrayKey) {
        result = result[arrayKey];
      }
    }

    if (!Array.isArray(result)) {
      throw new Error("La respuesta de la IA no tiene el formato esperado.");
    }

    // Convert back to pixels
    return result.map(item => ({
      id: item.id,
      x: item.x * pixelsPerMeter,
      y: item.y * pixelsPerMeter,
      rotation: item.rotation
    }));
  } catch (error) {
    console.error("Error optimizing space with Gemini:", error);
    throw error;
  }
}
