import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Printer, Grid3X3, Ruler } from 'lucide-react';
import { cn } from '../lib/utils';

interface PrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPrint: (options: { showGrid: boolean; showDimensions: boolean; format: string; type: 'pdf' | 'png' }) => void;
}

export function PrintModal({ isOpen, onClose, onPrint }: PrintModalProps) {
  const [showGrid, setShowGrid] = useState(true);
  const [showDimensions, setShowDimensions] = useState(true);
  const [format, setFormat] = useState('a4');
  const [exportType, setExportType] = useState<'pdf' | 'png'>('pdf');

  const formats = [
    { id: 'a4', name: 'A4 (210 x 297 mm)' },
    { id: 'a3', name: 'A3 (297 x 420 mm)' },
    { id: 'a2', name: 'A2 (420 x 594 mm)' },
    { id: 'original', name: 'Ajuste Automático' },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/20 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-sm bg-white border border-[#141414] rounded-3xl shadow-2xl overflow-hidden"
          >
            <div className="p-6 border-b border-[#141414]/10 flex items-center justify-between">
              <h2 className="font-serif italic text-xl">Opciones de Impresión</h2>
              <button onClick={onClose} className="p-2 hover:bg-[#141414]/5 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="text-sm font-medium">Tipo de Archivo</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setExportType('pdf')}
                      className={cn(
                        "px-3 py-2 text-xs rounded-xl border transition-all text-center",
                        exportType === 'pdf' 
                          ? "bg-[#141414] text-white border-[#141414]" 
                          : "bg-white text-[#141414]/60 border-[#141414]/10 hover:border-[#141414]/30"
                      )}
                    >
                      PDF (Documento)
                    </button>
                    <button
                      onClick={() => setExportType('png')}
                      className={cn(
                        "px-3 py-2 text-xs rounded-xl border transition-all text-center",
                        exportType === 'png' 
                          ? "bg-[#141414] text-white border-[#141414]" 
                          : "bg-white text-[#141414]/60 border-[#141414]/10 hover:border-[#141414]/30"
                      )}
                    >
                      PNG (Imagen)
                    </button>
                  </div>
                </div>

                {exportType === 'pdf' && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Formato de Papel</p>
                    <div className="grid grid-cols-2 gap-2">
                      {formats.map((f) => (
                        <button
                          key={f.id}
                          onClick={() => setFormat(f.id)}
                          className={cn(
                            "px-3 py-2 text-xs rounded-xl border transition-all text-left",
                            format === f.id 
                              ? "bg-[#141414] text-white border-[#141414]" 
                              : "bg-white text-[#141414]/60 border-[#141414]/10 hover:border-[#141414]/30"
                          )}
                        >
                          {f.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <label className="flex items-center justify-between cursor-pointer group pt-2">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-[#141414]/5 rounded-xl group-hover:bg-[#141414]/10 transition-colors">
                      <Grid3X3 size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Mostrar Cuadrícula</p>
                      <p className="text-[10px] opacity-50">Incluye la rejilla de referencia</p>
                    </div>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={showGrid} 
                    onChange={(e) => setShowGrid(e.target.checked)}
                    className="w-4 h-4 accent-[#141414]"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer group">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-[#141414]/5 rounded-xl group-hover:bg-[#141414]/10 transition-colors">
                      <Ruler size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Mostrar Cotas</p>
                      <p className="text-[10px] opacity-50">Incluye las medidas de las paredes</p>
                    </div>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={showDimensions} 
                    onChange={(e) => setShowDimensions(e.target.checked)}
                    className="w-4 h-4 accent-[#141414]"
                  />
                </label>
              </div>

              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl">
                <p className="text-[10px] text-amber-800 leading-relaxed">
                  * El dibujo se ajustará automáticamente al tamaño de papel seleccionado manteniendo una <strong>escala gráfica</strong> de referencia.
                </p>
              </div>

              <button 
                onClick={() => {
                  onPrint({ showGrid, showDimensions, format, type: exportType });
                  onClose();
                }}
                className="w-full py-4 bg-[#141414] text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
              >
                <Printer size={18} />
                {exportType === 'pdf' ? 'Generar PDF' : 'Exportar PNG'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
