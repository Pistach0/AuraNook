import { Project, Floor } from '../types';
import { Plus, ChevronDown, Edit2, Trash2, Check, X, ChevronUp } from 'lucide-react';
import { cn } from '../lib/utils';
import { useState } from 'react';
import { useSettings } from '../context/SettingsContext';

interface FloorManagerProps {
  project: Project;
  setProject: React.Dispatch<React.SetStateAction<Project>>;
}

export function FloorManager({ project, setProject }: FloorManagerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [editingFloorId, setEditingFloorId] = useState<string | null>(null);
  const [tempFloorName, setTempFloorName] = useState('');
  const { t } = useSettings();

  const currentFloorIndex = project.floors.findIndex(f => f.id === project.currentFloorId);
  const currentFloor = project.floors[currentFloorIndex];

  const goToFloor = (index: number) => {
    if (index >= 0 && index < project.floors.length) {
      setProject(prev => ({ ...prev, currentFloorId: project.floors[index].id }));
    }
  };

  const addFloor = (position: 'above' | 'below') => {
    const currentIndex = project.floors.findIndex(f => f.id === project.currentFloorId);
    const newId = `floor-${Date.now()}`;
    const newFloor: Floor = {
      id: newId,
      name: position === 'above' ? `Nueva Planta Superior` : `Nueva Planta Inferior`,
      walls: [],
      rooms: [],
      furniture: [],
      openings: [],
      stairs: [],
    };

    const newFloors = [...project.floors];
    if (position === 'above') {
      newFloors.splice(currentIndex + 1, 0, newFloor);
    } else {
      newFloors.splice(currentIndex, 0, newFloor);
    }

    setProject(prev => ({
      ...prev,
      floors: newFloors,
      currentFloorId: newId
    }));
  };

  const deleteFloor = (id: string) => {
    if (project.floors.length <= 1) return;
    const newFloors = project.floors.filter(f => f.id !== id);
    const newCurrentId = project.currentFloorId === id ? newFloors[newFloors.length - 1].id : project.currentFloorId;
    setProject(prev => ({
      ...prev,
      floors: newFloors,
      currentFloorId: newCurrentId
    }));
  };

  const renameFloor = (id: string, newName: string) => {
    setProject(prev => ({
      ...prev,
      floors: prev.floors.map(f => f.id === id ? { ...f, name: newName } : f)
    }));
    setEditingFloorId(null);
  };

  return (
    <div className="flex items-center gap-1">
      <div className="flex flex-col gap-0.5">
        <button 
          onClick={() => goToFloor(currentFloorIndex + 1)}
          disabled={currentFloorIndex >= project.floors.length - 1}
          className="p-0.5 rounded hover:bg-[#141414]/5 disabled:opacity-20 transition-colors"
          title={t('floorManager.moveUp')}
        >
          <ChevronUp size={14} />
        </button>
        <button 
          onClick={() => goToFloor(currentFloorIndex - 1)}
          disabled={currentFloorIndex <= 0}
          className="p-0.5 rounded hover:bg-[#141414]/5 disabled:opacity-20 transition-colors"
          title={t('floorManager.moveDown')}
        >
          <ChevronDown size={14} />
        </button>
      </div>

      <div className="relative">
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-[#141414]/5 transition-colors border border-[#141414]/10"
        >
          <span className="text-sm font-medium">{currentFloor?.name}</span>
          <ChevronDown size={14} className={cn("transition-transform", isOpen && "rotate-180")} />
        </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-0 mt-2 w-64 bg-white border border-[#141414] shadow-xl rounded-xl overflow-hidden z-40 flex flex-col">
            <div className="max-h-64 overflow-y-auto">
              {project.floors.map((floor) => (
                <div 
                  key={floor.id}
                  className={cn(
                    "group flex items-center justify-between px-4 py-2 transition-colors",
                    project.currentFloorId === floor.id 
                      ? "bg-[#141414] text-white" 
                      : "hover:bg-[#141414]/5"
                  )}
                >
                  {editingFloorId === floor.id ? (
                    <div className="flex items-center gap-1 flex-1 mr-2">
                      <input 
                        autoFocus
                        type="text"
                        value={tempFloorName}
                        onChange={(e) => setTempFloorName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') renameFloor(floor.id, tempFloorName);
                          if (e.key === 'Escape') setEditingFloorId(null);
                        }}
                        className="bg-white text-[#141414] border border-[#141414]/20 rounded px-1.5 py-0.5 text-xs w-full focus:outline-none"
                      />
                      <button onClick={() => renameFloor(floor.id, tempFloorName)} className="p-1 hover:bg-[#141414]/10 rounded">
                        <Check size={12} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setProject(p => ({ ...p, currentFloorId: floor.id }));
                        setIsOpen(false);
                      }}
                      className="flex-1 text-left text-sm py-1"
                    >
                      {floor.name}
                    </button>
                  )}
                  
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {editingFloorId !== floor.id && (
                      <>
                        <button 
                          onClick={() => {
                            setEditingFloorId(floor.id);
                            setTempFloorName(floor.name);
                          }}
                          className={cn(
                            "p-1 rounded transition-colors",
                            project.currentFloorId === floor.id ? "hover:bg-white/20" : "hover:bg-[#141414]/10"
                          )}
                          title={t('floorManager.renameFloor')}
                        >
                          <Edit2 size={12} />
                        </button>
                        {project.floors.length > 1 && (
                          <button 
                            onClick={() => deleteFloor(floor.id)}
                            className={cn(
                              "p-1 rounded transition-colors text-red-500 hover:bg-red-500/10",
                              project.currentFloorId === floor.id && "text-red-300 hover:bg-white/20"
                            )}
                            title={t('floorManager.deleteFloor')}
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-[#141414]/10 p-1 grid grid-cols-1 gap-1 bg-[#141414]/5">
              <button
                onClick={() => {
                  addFloor('above');
                  setIsOpen(false);
                }}
                className="flex items-center justify-center gap-1.5 py-2 text-[10px] font-bold uppercase tracking-wider hover:bg-white rounded-lg transition-colors"
              >
                <Plus size={12} />
                {t('floorManager.addFloor')} (Superior)
              </button>
              <button
                onClick={() => {
                  addFloor('below');
                  setIsOpen(false);
                }}
                className="flex items-center justify-center gap-1.5 py-2 text-[10px] font-bold uppercase tracking-wider hover:bg-white rounded-lg transition-colors"
              >
                <Plus size={12} />
                {t('floorManager.addFloor')} (Inferior)
              </button>
            </div>
          </div>
        </>
      )}
      </div>
    </div>
  );
}
