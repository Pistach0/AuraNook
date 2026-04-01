import React from 'react';
import { Project } from '../types';
import { cn } from '../lib/utils';
import { Layers } from 'lucide-react';

interface LevelSchematicProps {
  project: Project;
  onSelectFloor: (id: string) => void;
}

export const LevelSchematic: React.FC<LevelSchematicProps> = ({ project, onSelectFloor }) => {
  return (
    <div className="absolute bottom-12 right-6 flex flex-col gap-2 z-40">
      <div className="bg-white/90 backdrop-blur-md border border-[#141414] rounded-2xl shadow-2xl p-4 w-48">
        <div className="flex items-center gap-2 mb-4 px-1">
          <Layers size={14} className="opacity-40" />
          <h3 className="text-[10px] uppercase tracking-widest opacity-40 font-bold">Niveles</h3>
        </div>
        <div className="flex flex-col-reverse gap-1">
          {project.floors.map((floor, index) => {
            const isActive = floor.id === project.currentFloorId;
            return (
              <button
                key={floor.id}
                onClick={() => onSelectFloor(floor.id)}
                className={cn(
                  "group relative flex items-center gap-3 p-2 rounded-xl transition-all text-left border",
                  isActive 
                    ? "bg-[#141414] border-[#141414] text-white shadow-lg translate-x-1" 
                    : "bg-white border-[#141414]/5 hover:border-[#141414]/20 hover:bg-[#141414]/5 text-[#141414]/60"
                )}
              >
                <div className={cn(
                  "w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold border",
                  isActive ? "bg-white/20 border-white/20" : "bg-[#141414]/5 border-[#141414]/10"
                )}>
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-bold truncate leading-tight">{floor.name}</div>
                  <div className={cn(
                    "text-[8px] opacity-40 leading-tight",
                    isActive ? "text-white/60" : "text-[#141414]/40"
                  )}>
                    {floor.rooms.length} habs.
                  </div>
                </div>
                {isActive && (
                  <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-1 h-4 bg-white rounded-full" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
