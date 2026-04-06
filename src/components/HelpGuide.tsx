import React, { useState } from 'react';
import { X, Search, HelpCircle, BookOpen, MousePointer2, PenTool, Square, DoorOpen, Layout, ChevronUp, Layers, Grid3X3, Ruler, Maximize2, Undo2, Redo2, Save, FileCode, Printer, Trash2, Settings2, Youtube } from 'lucide-react';
import { cn } from '../lib/utils';
import { useSettings } from '../context/SettingsContext';

interface HelpGuideProps {
  isOpen: boolean;
  onClose: () => void;
}

interface GuideSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  content: {
    title: string;
    text: string;
    icon?: React.ReactNode;
  }[];
}

export const HelpGuide: React.FC<HelpGuideProps> = ({ isOpen, onClose }) => {
  const { t } = useSettings();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSection, setActiveSection] = useState('basics');

  if (!isOpen) return null;

  const GUIDE_SECTIONS: GuideSection[] = [
    {
      id: 'basics',
      title: t('helpGuide.sections.basics.title'),
      icon: <HelpCircle size={16} />,
      content: [
        {
          title: t('helpGuide.sections.basics.nav.title'),
          text: t('helpGuide.sections.basics.nav.text'),
        },
        {
          title: t('helpGuide.sections.basics.select.title'),
          text: t('helpGuide.sections.basics.select.text'),
        },
        {
          title: t('helpGuide.sections.basics.delete.title'),
          text: t('helpGuide.sections.basics.delete.text'),
        },
      ],
    },
    {
      id: 'tools',
      title: t('helpGuide.sections.tools.title'),
      icon: <PenTool size={16} />,
      content: [
        {
          title: t('helpGuide.sections.tools.walls.title'),
          icon: <PenTool size={14} />,
          text: t('helpGuide.sections.tools.walls.text'),
        },
        {
          title: t('helpGuide.sections.tools.moveWalls.title'),
          icon: <MousePointer2 size={14} />,
          text: t('helpGuide.sections.tools.moveWalls.text'),
        },
        {
          title: t('helpGuide.sections.tools.rooms.title'),
          icon: <Square size={14} />,
          text: t('helpGuide.sections.tools.rooms.text'),
        },
        {
          title: t('helpGuide.sections.tools.doors.title'),
          icon: <DoorOpen size={14} />,
          text: t('helpGuide.sections.tools.doors.text'),
        },
      ],
    },
    {
      id: 'properties',
      title: t('helpGuide.sections.properties.title'),
      icon: <Settings2 size={16} />,
      content: [
        {
          title: t('helpGuide.sections.properties.furniture.title'),
          icon: <Layout size={14} />,
          text: t('helpGuide.sections.properties.furniture.text'),
        },
        {
          title: t('helpGuide.sections.properties.modify.title'),
          icon: <Settings2 size={14} />,
          text: t('helpGuide.sections.properties.modify.text'),
        },
        {
          title: t('helpGuide.sections.properties.layers.title'),
          icon: <Layers size={14} />,
          text: t('helpGuide.sections.properties.layers.text'),
        },
      ],
    },
    {
      id: 'advanced',
      title: t('helpGuide.sections.advanced.title'),
      icon: <Layers size={16} />,
      content: [
        {
          title: t('helpGuide.sections.advanced.floors.title'),
          icon: <Layers size={14} />,
          text: t('helpGuide.sections.advanced.floors.text'),
        },
        {
          title: t('helpGuide.sections.advanced.ghost.title'),
          icon: <Layers size={14} />,
          text: t('helpGuide.sections.advanced.ghost.text'),
        },
        {
          title: t('helpGuide.sections.advanced.export.title'),
          icon: <Printer size={14} />,
          text: t('helpGuide.sections.advanced.export.text'),
        },
      ],
    },
  ];

  const filteredSections = GUIDE_SECTIONS.map(section => ({
    ...section,
    content: section.content.filter(item => 
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      item.text.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).filter(section => section.content.length > 0);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="bg-white w-full max-w-4xl h-[80vh] rounded-3xl border border-[#141414] shadow-2xl flex flex-col overflow-hidden relative">
        {/* Header */}
        <div className="p-6 border-b border-[#141414]/10 flex items-center justify-between bg-[#F9F9F7]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#141414] text-white rounded-2xl flex items-center justify-center">
              <HelpCircle size={20} />
            </div>
            <div>
              <h2 className="font-serif italic text-xl">{t('helpGuide.title')}</h2>
              <p className="text-[10px] uppercase tracking-widest opacity-40 font-bold">{t('helpGuide.subtitle')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a 
              href="https://youtu.be/Yjjz1iV-IFQ" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors text-sm font-bold shadow-sm"
            >
              <Youtube size={16} />
              {t('helpGuide.videoTutorial')}
            </a>
            <button onClick={onClose} className="p-2 hover:bg-[#141414]/5 rounded-full transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="p-4 border-b border-[#141414]/10">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 opacity-20" size={16} />
            <input 
              type="text" 
              placeholder={t('helpGuide.searchPlaceholder')}
              className="w-full bg-[#141414]/5 border-none rounded-2xl py-3 pl-12 pr-4 text-sm focus:ring-2 focus:ring-[#141414]/10 transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar */}
          <div className="w-64 border-r border-[#141414]/10 bg-[#F9F9F7] p-4 overflow-y-auto">
            <div className="flex flex-col gap-1">
              {filteredSections.map(section => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-xl transition-all text-left",
                    activeSection === section.id 
                      ? "bg-[#141414] text-white shadow-lg" 
                      : "hover:bg-[#141414]/5 text-[#141414]/60"
                  )}
                >
                  {section.icon}
                  <span className="text-xs font-bold">{section.title}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 p-8 overflow-y-auto bg-white">
            <div className="max-w-2xl mx-auto">
              {filteredSections.find(s => s.id === activeSection)?.content.map((item, i) => (
                <div key={i} className="mb-10 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="flex items-center gap-3 mb-3">
                    {item.icon && <div className="p-2 bg-[#141414]/5 rounded-lg">{item.icon}</div>}
                    <h3 className="font-serif italic text-lg">{item.title}</h3>
                  </div>
                  <p className="text-sm text-[#141414]/70 leading-relaxed bg-[#F9F9F7] p-4 rounded-2xl border border-[#141414]/5">
                    {item.text}
                  </p>
                </div>
              ))}
              {filteredSections.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center opacity-40 py-20">
                  <Search size={48} className="mb-4" />
                  <p className="text-sm font-bold">{t('helpGuide.noResults')} "{searchQuery}"</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#141414]/10 bg-[#F9F9F7] flex items-center justify-between px-6">
          <div className="flex gap-4">
            <a 
              href="mailto:aurora.n.team@gmail.com?subject=AuraNook - Informe de Error"
              className="text-[10px] uppercase tracking-widest font-bold text-red-600 hover:underline"
            >
              {t('helpGuide.reportBugs')}
            </a>
            <a 
              href="mailto:aurora.n.team@gmail.com?subject=AuraNook - Sugerencia"
              className="text-[10px] uppercase tracking-widest font-bold text-blue-600 hover:underline"
            >
              {t('helpGuide.sendSuggestions')}
            </a>
          </div>
          <p className="text-[10px] uppercase tracking-widest opacity-40 font-bold">{t('helpGuide.version')}</p>
        </div>
      </div>
    </div>
  );
};
