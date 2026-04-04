import { FURNITURE_TEMPLATES, CATEGORIES } from '../constants';
import { Furniture, ToolType } from '../types';
import { Search } from 'lucide-react';
import { useState } from 'react';
import { useSettings } from '../context/SettingsContext';

interface FurnitureLibraryProps {
  onAddFurniture: (furniture: Furniture) => void;
  activeCategory: string | null;
}

export function FurnitureLibrary({ onAddFurniture, activeCategory }: FurnitureLibraryProps) {
  const [search, setSearch] = useState('');
  const { t } = useSettings();

  const filteredTemplates = FURNITURE_TEMPLATES.filter(f => {
    const name = t(`furniture.items.${f.type}`);
    return name.toLowerCase().includes(search.toLowerCase()) &&
    (!activeCategory || f.category === activeCategory);
  });

  const categoriesToShow = activeCategory 
    ? CATEGORIES.filter(c => c.id === activeCategory)
    : CATEGORIES;

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-[#141414]/10">
        <div className="flex items-center gap-2 px-3 py-2 bg-[#141414]/5 rounded-xl border border-[#141414]/10">
          <Search size={14} className="opacity-40" />
          <input 
            type="text" 
            placeholder={t('furniture.search')} 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent text-xs focus:outline-none w-full" 
          />
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {categoriesToShow.map(cat => {
          const catTemplates = filteredTemplates.filter(f => f.category === cat.id);
          if (catTemplates.length === 0) return null;
          
          return (
            <div key={cat.id} className="mb-8">
              <h3 className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-40 mb-4 px-1">{t(`furniture.categories.${cat.id}`)}</h3>
              <div className="grid grid-cols-1 gap-2">
                {catTemplates.map(template => (
                  <button
                    key={template.type}
                    onClick={() => {
                      onAddFurniture({
                        id: `furniture-${Date.now()}`,
                        type: template.type,
                        name: t(`furniture.items.${template.type}`),
                        x: 400, // Default center-ish
                        y: 300,
                        rotation: 0,
                        scaleX: 1,
                        scaleY: 1,
                        category: template.category,
                        width: template.width,
                        height: template.height,
                      });
                    }}
                    className="flex items-center gap-3 p-2 rounded-xl border border-transparent hover:border-[#141414]/10 hover:bg-[#141414]/5 transition-all group text-left"
                  >
                    <div className="w-10 h-10 bg-[#141414]/5 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform text-xl">
                      {cat.icon}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[11px] font-bold leading-tight">{t(`furniture.items.${template.type}`)}</span>
                      <span className="text-[9px] opacity-40 uppercase tracking-wider">{template.width}x{template.height}cm</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
