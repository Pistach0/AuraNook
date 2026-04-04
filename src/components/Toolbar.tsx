import { AppMode, ToolType } from '../types';
import { CATEGORIES } from '../constants';
import { 
  MousePointer2, 
  PenTool, 
  DoorOpen, 
  Layout, 
  ArrowUpRight as StairsIcon, 
  Square
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useSettings } from '../context/SettingsContext';

interface ToolbarProps {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  activeTool: ToolType;
  setActiveTool: (tool: ToolType) => void;
  activeCategory: string | null;
  setActiveCategory: (cat: string | null) => void;
}

export function Toolbar({ mode, setMode, activeTool, setActiveTool, activeCategory, setActiveCategory }: ToolbarProps) {
  const { t } = useSettings();

  const designTools = [
    { id: ToolType.SELECT, icon: MousePointer2, label: t('toolbar.select') },
    { id: ToolType.WALL, icon: PenTool, label: t('toolbar.wall') },
    { id: ToolType.ROOM, icon: Square, label: t('toolbar.room') },
    { id: ToolType.DOOR, icon: DoorOpen, label: t('toolbar.door') },
    { id: ToolType.WINDOW, icon: Layout, label: t('toolbar.window') },
    { id: ToolType.STAIRS, icon: StairsIcon, label: t('toolbar.stairs') },
  ];

  const tools = mode === AppMode.DESIGN ? designTools : [
    { id: ToolType.SELECT, icon: MousePointer2, label: t('toolbar.select') }
  ];

  return (
    <div className="flex flex-col gap-8 items-center">
      {/* Mode Switcher */}
      <div className="flex flex-col gap-2 p-1 bg-[#141414]/5 rounded-xl border border-[#141414]/10">
        <button
          onClick={() => setMode(AppMode.DESIGN)}
          className={cn(
            "px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-tighter transition-all",
            mode === AppMode.DESIGN ? "bg-[#141414] text-white shadow-lg" : "hover:bg-[#141414]/10"
          )}
        >
          {t('toolbar.design')}
        </button>
        <button
          onClick={() => setMode(AppMode.DECORATION)}
          className={cn(
            "px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-tighter transition-all",
            mode === AppMode.DECORATION ? "bg-[#141414] text-white shadow-lg" : "hover:bg-[#141414]/10"
          )}
        >
          {t('toolbar.decoration')}
        </button>
      </div>

      <div className="h-px w-8 bg-[#141414]/10" />

      {/* Tools */}
      <div className="flex flex-col gap-3">
        {tools.map((tool) => (
          <button
            key={tool.id}
            onClick={() => {
              setActiveTool(tool.id);
              if (mode === AppMode.DECORATION) setActiveCategory(null);
            }}
            className={cn(
              "w-12 h-12 flex items-center justify-center rounded-xl transition-all border",
              activeTool === tool.id && (mode === AppMode.DESIGN || !activeCategory)
                ? "bg-[#141414] text-white border-[#141414] shadow-md scale-110" 
                : "bg-white border-[#141414]/10 hover:border-[#141414]/30 hover:bg-[#141414]/5"
            )}
            title={tool.label}
          >
            <tool.icon size={20} className="mr-0.5" />
          </button>
        ))}

        {mode === AppMode.DECORATION && (
          <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-[#141414]/10">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => {
                  if (activeCategory === cat.id) {
                    setActiveCategory(null);
                    setActiveTool(ToolType.SELECT);
                  } else {
                    setActiveCategory(cat.id);
                    setActiveTool(ToolType.FURNITURE);
                  }
                }}
                className={cn(
                  "w-12 h-12 flex items-center justify-center rounded-xl transition-all border text-xl",
                  activeCategory === cat.id 
                    ? "bg-[#141414] text-white border-[#141414] shadow-md scale-110" 
                    : "bg-white border-[#141414]/10 hover:border-[#141414]/30 hover:bg-[#141414]/5"
                )}
                title={t(`furniture.categories.${cat.id}`)}
              >
                <span className="mr-0.5">{cat.icon}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
