import { Wall, Room, Furniture } from '../types';
import { RotateCcw, FlipHorizontal, Type, Palette, Maximize, Move, Plus, Trash2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { useSettings } from '../context/SettingsContext';

interface PropertiesPanelProps {
  item: any;
  onUpdate: (item: any) => void;
}

export function PropertiesPanel({ item, onUpdate }: PropertiesPanelProps) {
  const { t, unit } = useSettings();

  const displayValue = (cm: number) => {
    if (unit === 'in') return Number((cm / 2.54).toFixed(2));
    return Math.round(cm);
  };

  const parseValue = (val: number) => {
    if (unit === 'in') return val * 2.54;
    return val;
  };

  if (!item) return null;

  const isWall = 'start' in item;
  const isRoom = 'points' in item;
  const isOpening = 'wallId' in item;
  const isStairs = 'steps' in item;
  const isFurniture = 'type' in item && !isWall && !isRoom && !isOpening && !isStairs;

  return (
    <div className="space-y-8">
      {/* Basic Info */}
      <section>
        <label className="block text-[10px] uppercase tracking-widest opacity-50 mb-2">{t('properties.name')}</label>
        <input 
          type="text"
          value={item.name || (isWall ? t('properties.wall') : isFurniture ? t(`furniture.items.${item.type}`) : isOpening ? t(`properties.${item.type}`) : isStairs ? t('properties.stairs') : t('properties.room'))}
          onChange={(e) => onUpdate({ ...item, name: e.target.value })}
          className="w-full bg-transparent border-b border-[#141414] py-1 focus:outline-none focus:border-blue-500 font-serif italic mb-4"
        />

        {isRoom && (
          <div className="mt-4">
            <label className="block text-[10px] uppercase tracking-widest opacity-50 mb-2">Tipo de Habitación</label>
            <select
              value={item.roomType || ''}
              onChange={(e) => {
                const selectedOption = e.target.options[e.target.selectedIndex];
                onUpdate({ 
                  ...item, 
                  roomType: e.target.value,
                  name: selectedOption.text !== 'Seleccionar...' ? selectedOption.text : item.name
                });
              }}
              className="w-full bg-[#141414]/5 rounded p-2 text-sm focus:outline-none"
            >
              <option value="">Seleccionar...</option>
              <option value="dormitorio">Dormitorio</option>
              <option value="baño">Baño</option>
              <option value="cocina">Cocina</option>
              <option value="salon">Salón</option>
              <option value="comedor">Comedor</option>
              <option value="salon_comedor_cocina">Salón-Comedor-Cocina</option>
              <option value="despacho">Despacho</option>
              <option value="porche">Porche</option>
              <option value="patio">Patio</option>
              <option value="terraza">Terraza</option>
              <option value="despensa">Despensa</option>
              <option value="bodega">Bodega</option>
              <option value="entrada">Entrada</option>
              <option value="pasillo">Pasillo</option>
              <option value="ascensor">Ascensor</option>
              <option value="garaje">Garaje</option>
              <option value="lavadero">Lavadero</option>
              <option value="vestidor">Vestidor</option>
              <option value="gimnasio">Gimnasio</option>
              <option value="sala_juegos">Sala de juegos</option>
            </select>
          </div>
        )}
      </section>

      {/* Dimensions */}
      {(isFurniture || isOpening) && (
        <section className="space-y-4">
          <label className="block text-[10px] uppercase tracking-widest opacity-50">{t('properties.dimensions')} ({unit === 'in' ? 'in' : 'cm'})</label>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-[10px] opacity-40 block mb-1">{t('properties.width')}</span>
              <input 
                type="number"
                value={displayValue(item.width)}
                onChange={(e) => onUpdate({ ...item, width: parseValue(Number(e.target.value)) })}
                className="w-full bg-[#141414]/5 rounded p-2 text-sm focus:outline-none"
              />
            </div>
            {isFurniture && (
              <div>
                <span className="text-[10px] opacity-40 block mb-1">{t('properties.length')}</span>
                <input 
                  type="number"
                  value={displayValue(item.height)}
                  onChange={(e) => onUpdate({ ...item, height: parseValue(Number(e.target.value)) })}
                  className="w-full bg-[#141414]/5 rounded p-2 text-sm focus:outline-none"
                />
              </div>
            )}
          </div>
        </section>
      )}

      {/* Door Specific */}
      {isOpening && item.type === 'door' && (
        <section className="space-y-4">
          <label className="block text-[10px] uppercase tracking-widest opacity-50">{t('properties.doorConfig')}</label>
          <div className="space-y-2">
            <div className="flex gap-2">
              <button 
                onClick={() => onUpdate({ ...item, subType: 'simple', isDouble: false })}
                className={cn("flex-1 py-2 text-[10px] border rounded", item.subType === 'simple' ? "bg-[#141414] text-white" : "border-[#141414]/10")}
              >
                {t('properties.simple')}
              </button>
              <button 
                onClick={() => onUpdate({ ...item, subType: 'double', isDouble: true })}
                className={cn("flex-1 py-2 text-[10px] border rounded", item.subType === 'double' ? "bg-[#141414] text-white" : "border-[#141414]/10")}
              >
                {t('properties.double')}
              </button>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => onUpdate({ ...item, openingDirection: 'left' })}
                className={cn("flex-1 py-2 text-[10px] border rounded", item.openingDirection === 'left' ? "bg-[#141414] text-white" : "border-[#141414]/10")}
              >
                {t('properties.left')}
              </button>
              <button 
                onClick={() => onUpdate({ ...item, openingDirection: 'right' })}
                className={cn("flex-1 py-2 text-[10px] border rounded", item.openingDirection === 'right' ? "bg-[#141414] text-white" : "border-[#141414]/10")}
              >
                {t('properties.right')}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Stairs Specific */}
      {isStairs && (
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <label className="block text-[10px] uppercase tracking-widest opacity-50">{t('properties.stairsConfig')}</label>
            <span className="text-[10px] font-bold bg-[#141414] text-white px-2 py-0.5 rounded uppercase tracking-tighter">
              {item.type}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-[10px] opacity-40 block mb-1">{t('properties.stairsDirection')}</span>
              <select 
                value={item.direction}
                onChange={(e) => onUpdate({ ...item, direction: e.target.value as 'up' | 'down' })}
                className="w-full bg-[#141414]/5 rounded p-2 text-sm focus:outline-none"
              >
                <option value="up">{t('properties.up')}</option>
                <option value="down">{t('properties.down')}</option>
              </select>
            </div>
            {!item.flights && (
              <div>
                <span className="text-[10px] opacity-40 block mb-1">{t('properties.steps')}</span>
                <input 
                  type="number"
                  value={item.steps}
                  onChange={(e) => onUpdate({ ...item, steps: Number(e.target.value) })}
                  className="w-full bg-[#141414]/5 rounded p-2 text-sm focus:outline-none"
                />
              </div>
            )}
          </div>

          {!item.flights && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-[10px] opacity-40 block mb-1">{t('properties.width')} ({unit === 'in' ? 'in' : 'cm'})</span>
                <input 
                  type="number"
                  value={displayValue(item.width)}
                  onChange={(e) => onUpdate({ ...item, width: parseValue(Number(e.target.value)) })}
                  className="w-full bg-[#141414]/5 rounded p-2 text-sm focus:outline-none"
                />
              </div>
              <div>
                <span className="text-[10px] opacity-40 block mb-1">{t('properties.length')} ({unit === 'in' ? 'in' : 'cm'})</span>
                <input 
                  type="number"
                  value={displayValue(item.length)}
                  onChange={(e) => onUpdate({ ...item, length: parseValue(Number(e.target.value)) })}
                  className="w-full bg-[#141414]/5 rounded p-2 text-sm focus:outline-none"
                />
              </div>
            </div>
          )}

          {item.flights && (
            <div className="space-y-4 pt-4 border-t border-[#141414]/10">
              {item.type === 'u_shaped' && (
                <div className="grid grid-cols-2 gap-4 pb-4">
                  <div>
                    <span className="text-[10px] opacity-40 block mb-1">{t('properties.landingWidth')} ({unit === 'in' ? 'in' : 'cm'})</span>
                    <input 
                      type="number"
                      value={displayValue(item.landingWidth || (item.flights?.[0]?.width || 100) * 2)}
                      onChange={(e) => onUpdate({ ...item, landingWidth: parseValue(Number(e.target.value)) })}
                      className="w-full bg-[#141414]/5 rounded p-2 text-sm focus:outline-none"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] opacity-40 block mb-1">{t('properties.landingLength')} ({unit === 'in' ? 'in' : 'cm'})</span>
                    <input 
                      type="number"
                      value={displayValue(item.landingLength || (item.flights?.[0]?.width || 100))}
                      onChange={(e) => onUpdate({ ...item, landingLength: parseValue(Number(e.target.value)) })}
                      className="w-full bg-[#141414]/5 rounded p-2 text-sm focus:outline-none"
                    />
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">{t('properties.flights')}</span>
              </div>
              
              <div className="space-y-6">
                {item.flights.map((flight: any, idx: number) => (
                  <div key={flight.id} className="p-3 bg-[#141414]/5 rounded-xl space-y-3 relative">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold opacity-40">{t('properties.flight')} {idx + 1}</span>
                      {item.type === 'multi_flight' && item.flights.length > 1 && (
                        <button 
                          onClick={() => onUpdate({ ...item, flights: item.flights.filter((f: any) => f.id !== flight.id) })}
                          className="text-red-500 hover:bg-red-500/10 p-1 rounded transition-colors"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <span className="text-[9px] opacity-40 block mb-1">{t('properties.width')}</span>
                        <input 
                          type="number"
                          value={displayValue(flight.width)}
                          onChange={(e) => {
                            const newFlights = [...item.flights];
                            newFlights[idx] = { ...flight, width: parseValue(Number(e.target.value)) };
                            onUpdate({ ...item, flights: newFlights });
                          }}
                          className="w-full bg-white rounded px-1.5 py-1 text-xs focus:outline-none"
                        />
                      </div>
                      <div>
                        <span className="text-[9px] opacity-40 block mb-1">{t('properties.length')}</span>
                        <input 
                          type="number"
                          value={displayValue(flight.length)}
                          onChange={(e) => {
                            const newFlights = [...item.flights];
                            newFlights[idx] = { ...flight, length: parseValue(Number(e.target.value)) };
                            onUpdate({ ...item, flights: newFlights });
                          }}
                          className="w-full bg-white rounded px-1.5 py-1 text-xs focus:outline-none"
                        />
                      </div>
                      <div>
                        <span className="text-[9px] opacity-40 block mb-1">{t('properties.steps')}</span>
                        <input 
                          type="number"
                          value={flight.steps}
                          onChange={(e) => {
                            const newFlights = [...item.flights];
                            newFlights[idx] = { ...flight, steps: Number(e.target.value) };
                            onUpdate({ ...item, flights: newFlights });
                          }}
                          className="w-full bg-white rounded px-1.5 py-1 text-xs focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <span className="text-[9px] opacity-40 block mb-1">X Off</span>
                        <input 
                          type="number"
                          value={displayValue(flight.x)}
                          onChange={(e) => {
                            const newFlights = [...item.flights];
                            newFlights[idx] = { ...flight, x: parseValue(Number(e.target.value)) };
                            onUpdate({ ...item, flights: newFlights });
                          }}
                          className="w-full bg-white rounded px-1.5 py-1 text-xs focus:outline-none"
                        />
                      </div>
                      <div>
                        <span className="text-[9px] opacity-40 block mb-1">Y Off</span>
                        <input 
                          type="number"
                          value={displayValue(flight.y)}
                          onChange={(e) => {
                            const newFlights = [...item.flights];
                            newFlights[idx] = { ...flight, y: parseValue(Number(e.target.value)) };
                            onUpdate({ ...item, flights: newFlights });
                          }}
                          className="w-full bg-white rounded px-1.5 py-1 text-xs focus:outline-none"
                        />
                      </div>
                      <div>
                        <span className="text-[9px] opacity-40 block mb-1">Rot</span>
                        <input 
                          type="number"
                          value={flight.rotation}
                          onChange={(e) => {
                            const newFlights = [...item.flights];
                            newFlights[idx] = { ...flight, rotation: Number(e.target.value) };
                            onUpdate({ ...item, flights: newFlights });
                          }}
                          className="w-full bg-white rounded px-1.5 py-1 text-xs focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Transformations */}
      {(isFurniture || isOpening || isStairs) && (
        <section className="space-y-4">
          <label className="block text-[10px] uppercase tracking-widest opacity-50">{t('properties.transformation')}</label>
          <div className="flex gap-2">
            <button 
              onClick={() => onUpdate({ ...item, rotation: (item.rotation || 0) + 45 })}
              className="flex-1 flex items-center justify-center gap-2 py-2 border border-[#141414]/10 rounded hover:bg-[#141414]/5 transition-colors"
            >
              <RotateCcw size={14} />
              <span className="text-xs">{t('properties.rotate')}</span>
            </button>
            <button 
              onClick={() => onUpdate({ ...item, scaleX: (item.scaleX || 1) * -1 })}
              className="flex-1 flex items-center justify-center gap-2 py-2 border border-[#141414]/10 rounded hover:bg-[#141414]/5 transition-colors"
              title={t('properties.hFlipTooltip')}
            >
              <FlipHorizontal size={14} />
              <span className="text-xs">{t('properties.hFlip')}</span>
            </button>
            <button 
              onClick={() => onUpdate({ ...item, scaleY: (item.scaleY || 1) * -1 })}
              className="flex-1 flex items-center justify-center gap-2 py-2 border border-[#141414]/10 rounded hover:bg-[#141414]/5 transition-colors"
              title={t('properties.vFlipTooltip')}
            >
              <RotateCcw size={14} className="rotate-90" />
              <span className="text-xs">{t('properties.vFlip')}</span>
            </button>
          </div>
        </section>
      )}

      {/* Color / Style / Texture */}
      {(isRoom || isFurniture) && (
        <section className="space-y-6">
          <div className="space-y-4">
            <label className="block text-[10px] uppercase tracking-widest opacity-50">{t('properties.color')}</label>
            <div className="flex gap-2 flex-wrap">
              {['#9CA3AF', '#EC4899', '#22C55E', '#3B82F6', '#F59E0B', '#8B5CF6', '#FFFFFF', '#141414'].map(color => (
                <button
                  key={color}
                  onClick={() => onUpdate({ ...item, color })}
                  className="w-8 h-8 rounded-full border border-[#141414]/10 transition-transform hover:scale-110"
                  style={{ backgroundColor: color, outline: item.color === color ? '2px solid #141414' : 'none' }}
                />
              ))}
              <input 
                type="color" 
                value={item.color || '#9CA3AF'} 
                onChange={(e) => onUpdate({ ...item, color: e.target.value })}
                className="w-8 h-8 rounded-full border border-[#141414]/10 cursor-pointer overflow-hidden p-0"
              />
            </div>
          </div>
        </section>
      )}

      {/* Furniture Specific */}
      {isFurniture && (
        <section className="space-y-4">
          <label className="block text-[10px] uppercase tracking-widest opacity-50">{t('properties.layer')}</label>
          <div className="flex items-center gap-4">
            <input 
              type="range"
              min="-5"
              max="10"
              step="1"
              value={item.zIndex !== undefined ? item.zIndex : (
                item.type.includes('chair') || item.type.includes('stool') ? -1 :
                item.type.includes('table') || item.type === 'desk' || item.type === 'kitchen_counter' ? 1 :
                item.type === 'rug' ? -2 : 0
              )}
              onChange={(e) => onUpdate({ ...item, zIndex: Number(e.target.value) })}
              className="flex-1 accent-[#141414]"
            />
            <span className="text-xs font-bold w-4">{item.zIndex !== undefined ? item.zIndex : (
              item.type.includes('chair') || item.type.includes('stool') ? -1 :
              item.type.includes('table') || item.type === 'desk' || item.type === 'kitchen_counter' ? 1 :
              item.type === 'rug' ? -2 : 0
            )}</span>
          </div>
          <p className="text-[10px] opacity-40 italic">{t('properties.layerHelp')}</p>
          
          {item.attachedWallId && (
            <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
              <div className="flex items-center gap-2 text-blue-600 mb-1">
                <Move size={12} />
                <span className="text-[10px] font-bold uppercase tracking-wider">{t('properties.attachedToWall')}</span>
              </div>
              <p className="text-[10px] text-blue-500/70 italic">{t('properties.attachedToWallHelp')}</p>
              <button 
                onClick={() => onUpdate({ ...item, attachedWallId: undefined, attachedWallSide: undefined, attachedWallOffset: undefined })}
                className="mt-2 text-[9px] font-bold uppercase tracking-widest text-blue-600 hover:underline"
              >
                {t('properties.detachFromWall')}
              </button>
            </div>
          )}
        </section>
      )}

      {/* Wall Specific */}
      {isWall && (
        <section className="space-y-4">
          <label className="block text-[10px] uppercase tracking-widest opacity-50">{t('properties.wallType')}</label>
          <div className="flex gap-2">
            <button 
              onClick={() => onUpdate({ ...item, isExterior: false, thickness: 10 })}
              className={cn("flex-1 py-2 text-[10px] border rounded", !item.isExterior ? "bg-[#141414] text-white" : "border-[#141414]/10")}
            >
              {t('properties.interiorWall')} ({displayValue(10)}{unit === 'in' ? '"' : 'cm'})
            </button>
            <button 
              onClick={() => onUpdate({ ...item, isExterior: true, thickness: 30 })}
              className={cn("flex-1 py-2 text-[10px] border rounded", item.isExterior ? "bg-[#141414] text-white" : "border-[#141414]/10")}
            >
              {t('properties.exteriorWall')} ({displayValue(30)}{unit === 'in' ? '"' : 'cm'})
            </button>
          </div>
          <label className="block text-[10px] uppercase tracking-widest opacity-50">{t('properties.thickness')} ({unit === 'in' ? 'in' : 'cm'})</label>
          <input 
            type="range"
            min="5"
            max="40"
            step="5"
            value={item.thickness}
            onChange={(e) => onUpdate({ ...item, thickness: Number(e.target.value) })}
            className="w-full accent-[#141414]"
          />
          <div className="flex justify-between text-[10px] opacity-40">
            <span>{displayValue(5)}{unit === 'in' ? '"' : 'cm'}</span>
            <span>{displayValue(item.thickness)}{unit === 'in' ? '"' : 'cm'}</span>
            <span>{displayValue(40)}{unit === 'in' ? '"' : 'cm'}</span>
          </div>
        </section>
      )}
    </div>
  );
}
