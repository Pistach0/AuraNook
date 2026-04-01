import React, { useState } from 'react';
import { X, Search, HelpCircle, BookOpen, MousePointer2, PenTool, Square, DoorOpen, Layout, ChevronUp, Layers, Grid3X3, Ruler, Maximize2, Undo2, Redo2, Save, FileCode, Printer, Trash2, Settings2 } from 'lucide-react';
import { cn } from '../lib/utils';

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

const GUIDE_SECTIONS: GuideSection[] = [
  {
    id: 'basics',
    title: 'Conceptos Básicos',
    icon: <HelpCircle size={16} />,
    content: [
      {
        title: 'Navegación',
        text: 'Usa la rueda del ratón para hacer zoom. Haz clic con el botón central (rueda) y arrastra para moverte por el plano. Haz doble clic con el botón central para ajustar el zoom a todo el plano.',
      },
      {
        title: 'Selección',
        text: 'Usa el botón izquierdo del ratón para seleccionar elementos. Puedes seleccionar varios elementos arrastrando un cuadro de selección (estilo AutoCAD). Mantén Ctrl presionado para añadir elementos a la selección actual.',
      },
      {
        title: 'Eliminar',
        text: 'Selecciona uno o varios elementos y pulsa la tecla Suprimir (Delete) para borrarlos.',
      },
    ],
  },
  {
    id: 'tools',
    title: 'Herramientas de Diseño',
    icon: <PenTool size={16} />,
    content: [
      {
        title: 'Muros',
        icon: <PenTool size={14} />,
        text: 'Haz clic para empezar un muro y vuelve a hacer clic para terminarlo. Los muros se dividen automáticamente al cruzarse. Puedes elegir entre muros interiores (10cm) y exteriores (30cm).',
      },
      {
        title: 'Habitaciones',
        icon: <Square size={14} />,
        text: 'Haz clic para definir los vértices de una habitación. Pulsa ENTER o haz doble clic para cerrar el polígono. Puedes mover el nombre y los metros cuadrados arrastrándolos.',
      },
      {
        title: 'Puertas y Ventanas',
        icon: <DoorOpen size={14} />,
        text: 'Selecciona un modelo y haz clic sobre un muro para colocarlo. Se centrarán automáticamente en el muro. Puedes moverlas arrastrándolas a lo largo del muro.',
      },
    ],
  },
  {
    id: 'furniture',
    title: 'Mobiliario y Decoración',
    icon: <Layout size={16} />,
    content: [
      {
        title: 'Colocación',
        text: 'Selecciona un mueble de la biblioteca y haz clic en el plano para colocarlo. El mobiliario se ajustará a las caras de los muros si lo acercas lo suficiente.',
      },
      {
        title: 'Ajustes',
        text: 'Una vez seleccionado, puedes rotar el mueble, cambiar sus dimensiones o su color desde el panel de propiedades a la derecha.',
      },
      {
        title: 'Capas (Z-Index)',
        text: 'Si dos muebles se superponen, puedes usar los controles de "Capa" en el panel de propiedades para decidir cuál queda por encima.',
      },
    ],
  },
  {
    id: 'advanced',
    title: 'Funciones Avanzadas',
    icon: <Settings2 size={16} />,
    content: [
      {
        title: 'Gestión de Plantas',
        icon: <Layers size={14} />,
        text: 'Crea nuevas plantas desde el gestor de niveles. Puedes activar la vista "fantasma" para ver la planta inferior mientras diseñas la superior.',
      },
      {
        title: 'Exportación',
        icon: <FileCode size={14} />,
        text: 'Exporta tu diseño a formato DXF para abrirlo en AutoCAD, o a PDF para imprimirlo a escala.',
      },
    ],
  },
];

export const HelpGuide: React.FC<HelpGuideProps> = ({ isOpen, onClose }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSection, setActiveSection] = useState('basics');

  if (!isOpen) return null;

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
              <h2 className="font-serif italic text-xl">Guía de Uso</h2>
              <p className="text-[10px] uppercase tracking-widest opacity-40 font-bold">Ayuda y Documentación</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-[#141414]/5 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-4 border-b border-[#141414]/10">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 opacity-20" size={16} />
            <input 
              type="text" 
              placeholder="Buscar por palabra clave (ej: 'zoom', 'muro', 'pdf')..."
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
                  <p className="text-sm font-bold">No se encontraron resultados para "{searchQuery}"</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#141414]/10 bg-[#F9F9F7] text-center">
          <p className="text-[10px] uppercase tracking-widest opacity-40 font-bold">Planify v1.2 - Actualizado Abril 2026</p>
        </div>
      </div>
    </div>
  );
};
