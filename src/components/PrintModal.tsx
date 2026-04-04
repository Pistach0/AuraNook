import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Printer, Grid3X3, Ruler } from 'lucide-react';
import { cn } from '../lib/utils';
import { useSettings } from '../context/SettingsContext';

export interface PreviewData {
  image: string;
  width: number;
  height: number;
  pixelsPerMeter: number;
}

interface PrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPrint: (options: { showGrid: boolean; showDimensions: boolean; format: string; type: 'pdf' | 'png'; scale: string }) => void;
  previewData?: PreviewData | null;
}

export function PrintModal({ isOpen, onClose, onPrint, previewData }: PrintModalProps) {
  const [showGrid, setShowGrid] = useState(true);
  const [showDimensions, setShowDimensions] = useState(true);
  const [format, setFormat] = useState('a4');
  const [exportType, setExportType] = useState<'pdf' | 'png'>('pdf');
  const [scale, setScale] = useState('auto');
  const { t } = useSettings();

  const formats = [
    { id: 'a4', name: 'A4 (210 x 297 mm)' },
    { id: 'a3', name: 'A3 (297 x 420 mm)' },
    { id: 'a2', name: 'A2 (420 x 594 mm)' },
  ];

  const scales = [
    { id: 'auto', name: t('print.autoFit') },
    { id: '50', name: '1:50' },
    { id: '100', name: '1:100' },
  ];

  // Paper formats in mm (Landscape)
  const paperDimensions: Record<string, { w: number, h: number }> = {
    'a4': { w: 297, h: 210 },
    'a3': { w: 420, h: 297 },
    'a2': { w: 594, h: 420 },
  };

  let paperStyle: React.CSSProperties = {};
  let imageStyle: React.CSSProperties = {};
  let isCutOff = false;

  if (previewData && exportType === 'pdf') {
    const paper = paperDimensions[format] || paperDimensions['a4'];
    
    paperStyle = {
      aspectRatio: `${paper.w} / ${paper.h}`,
      height: '100%',
      maxWidth: '100%',
      maxHeight: '100%',
      backgroundColor: 'white',
      boxShadow: '0 0 0 1px rgba(0,0,0,0.1), 0 4px 12px rgba(0,0,0,0.1)',
      position: 'relative',
      transition: 'all 0.3s ease',
    };

    if (scale === 'auto') {
      imageStyle = {
        width: '100%',
        height: '100%',
        objectFit: 'contain',
        opacity: 0.9,
        transition: 'all 0.3s ease',
      };
    } else {
      const scaleFactor = parseInt(scale, 10);
      const realWidthMeters = previewData.width / previewData.pixelsPerMeter;
      const realHeightMeters = previewData.height / previewData.pixelsPerMeter;
      
      const imgWidthMm = (realWidthMeters * 1000) / scaleFactor;
      const imgHeightMm = (realHeightMeters * 1000) / scaleFactor;
      
      const widthPct = (imgWidthMm / paper.w) * 100;
      const heightPct = (imgHeightMm / paper.h) * 100;

      isCutOff = widthPct > 100 || heightPct > 100;

      imageStyle = {
        width: `${widthPct}%`,
        height: `${heightPct}%`,
        objectFit: 'fill',
        position: 'absolute',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        opacity: 0.8,
        boxShadow: isCutOff ? '0 0 0 2px rgba(239, 68, 68, 0.5)' : 'none',
        backgroundColor: isCutOff ? 'rgba(239, 68, 68, 0.1)' : 'transparent',
        transition: 'all 0.3s ease',
      };
    }
  }

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
              <h2 className="font-serif italic text-xl">{t('print.title')}</h2>
              <button onClick={onClose} className="p-2 hover:bg-[#141414]/5 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="w-full h-48 bg-[#141414]/5 rounded-xl border border-[#141414]/10 flex flex-col items-center justify-center relative p-4 overflow-hidden">
                {exportType === 'pdf' && previewData ? (
                  <>
                    <div style={paperStyle}>
                      <img src={previewData.image} alt="Previsualización" style={imageStyle} />
                      <div className="absolute top-2 right-2 text-[8px] font-bold text-[#141414]/30 uppercase tracking-widest">
                        {format}
                      </div>
                    </div>
                    {isCutOff && (
                      <div className="absolute bottom-2 bg-red-100 text-red-600 px-3 py-1 rounded-full text-[10px] font-bold shadow-sm border border-red-200 z-10">
                        {t('print.cutOffWarning')}
                      </div>
                    )}
                  </>
                ) : previewData ? (
                  <img src={previewData.image} alt="Previsualización" className="max-w-full max-h-full object-contain opacity-80" />
                ) : null}
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="text-sm font-medium">{t('print.fileType')}</p>
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
                      {t('print.pdf')}
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
                      {t('print.png')}
                    </button>
                  </div>
                </div>

                {exportType === 'pdf' && (
                  <>
                    <div className="space-y-2">
                      <p className="text-sm font-medium">{t('print.paperFormat')}</p>
                      <div className="grid grid-cols-3 gap-2">
                        {formats.map((f) => (
                          <button
                            key={f.id}
                            onClick={() => setFormat(f.id)}
                            className={cn(
                              "px-3 py-2 text-xs rounded-xl border transition-all text-center",
                              format === f.id 
                                ? "bg-[#141414] text-white border-[#141414]" 
                                : "bg-white text-[#141414]/60 border-[#141414]/10 hover:border-[#141414]/30"
                            )}
                          >
                            {f.name.split(' ')[0]}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-medium">{t('print.scale')}</p>
                      <div className="grid grid-cols-3 gap-2">
                        {scales.map((s) => (
                          <button
                            key={s.id}
                            onClick={() => setScale(s.id)}
                            className={cn(
                              "px-3 py-2 text-xs rounded-xl border transition-all text-center",
                              scale === s.id 
                                ? "bg-[#141414] text-white border-[#141414]" 
                                : "bg-white text-[#141414]/60 border-[#141414]/10 hover:border-[#141414]/30"
                            )}
                          >
                            {s.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                <label className="flex items-center justify-between cursor-pointer group pt-2">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-[#141414]/5 rounded-xl group-hover:bg-[#141414]/10 transition-colors">
                      <Grid3X3 size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{t('print.showGrid')}</p>
                      <p className="text-[10px] opacity-50">{t('print.showGridDesc')}</p>
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
                      <p className="text-sm font-medium">{t('print.showDimensions')}</p>
                      <p className="text-[10px] opacity-50">{t('print.showDimensionsDesc')}</p>
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
                <p className="text-[10px] text-amber-800 leading-relaxed" dangerouslySetInnerHTML={{ __html: t('print.note') }} />
              </div>

              <button 
                onClick={() => {
                  onPrint({ showGrid, showDimensions, format, type: exportType, scale });
                  onClose();
                }}
                className="w-full py-4 bg-[#141414] text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
              >
                <Printer size={18} />
                {exportType === 'pdf' ? t('print.generatePdf') : t('print.exportPng')}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
