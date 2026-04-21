/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  AppMode, 
  ToolType, 
  Project, 
  Floor, 
  Wall, 
  Room, 
  Furniture, 
  Point,
  Stairs
} from './types';
import { Toolbar } from './components/Toolbar';
import { FurnitureLibrary } from './components/FurnitureLibrary';
import { FloorManager } from './components/FloorManager';
import { PropertiesPanel } from './components/PropertiesPanel';
import { Canvas } from './components/Canvas';
import { PrintModal } from './components/PrintModal';
import { Logo } from './components/Logo';
import { ChallengePanel } from './components/ChallengePanel';
import { EvaluateDesignModal } from './components/EvaluateDesignModal';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Grid3X3, 
  Ruler, 
  Download, 
  Upload, 
  ZoomIn,
  ZoomOut,
  Maximize2,
  Maximize,
  Minimize,
  Save,
  FolderOpen,
  X,
  Plus,
  Undo2,
  Redo2,
  FileCode,
  Printer,
  Edit2,
  Check,
  Layers,
  Trash2,
  HelpCircle,
  Settings2,
  Home,
  Globe,
  Lightbulb,
  Trophy,
  Sparkles,
} from 'lucide-react';
import { calculateArea, getComputedRoomArea, getMidpoint, getDistance, getAngle, cn, isPointOnSegment } from './lib/utils';
import { downloadDXF, downloadPDF, downloadPNG } from './lib/exportUtils';
import { useSettings } from './context/SettingsContext';

import { HelpGuide } from './components/HelpGuide';

const INITIAL_FLOOR: Floor = {
  id: 'floor-1',
  name: 'Planta Baja',
  walls: [],
  rooms: [],
  furniture: [],
  openings: [],
  stairs: [],
};

const INITIAL_PROJECT: Project = {
  id: 'project-1',
  name: 'Mi Proyecto',
  floors: [INITIAL_FLOOR],
  currentFloorId: 'floor-1',
  gridSize: 40, // 40px = 0.5m (80px = 1m)
  showGrid: true,
  showDimensions: true,
  showGhostFloors: false,
  zoom: 1,
};

export default function App() {
  const { t, language, setLanguage, unit, setUnit, formatMeasurement } = useSettings();
  
  const [project, setProject] = useState<Project>(() => {
    const saved = localStorage.getItem('planify_current_project');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error loading current project from localStorage', e);
      }
    }
    return INITIAL_PROJECT;
  });
  const [history, setHistory] = useState<Project[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isUndoRedoAction, setIsUndoRedoAction] = useState(false);

  const [mode, setMode] = useState<AppMode>(AppMode.DESIGN);
  const [activeTool, setActiveTool] = useState<ToolType>(ToolType.SELECT);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [savedProjects, setSavedProjects] = useState<Project[]>([]);
  const [isProjectsListOpen, setIsProjectsListOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [previewData, setPreviewData] = useState<{ image: string; width: number; height: number; pixelsPerMeter: number } | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(false);
  const [rightPanelTab, setRightPanelTab] = useState<'properties' | 'challenge'>('properties');
  const [isChallengeOpen, setIsChallengeOpen] = useState(false);
  const [isEvaluateModalOpen, setIsEvaluateModalOpen] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [tempName, setTempName] = useState(project.name);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const stageRef = useRef<any>(null);

  // Auto-save current project and handle history
  useEffect(() => {
    localStorage.setItem('planify_current_project', JSON.stringify(project));
    
    if (!isUndoRedoAction) {
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(JSON.parse(JSON.stringify(project)));
      // Limit history size
      if (newHistory.length > 50) newHistory.shift();
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
    }
    setIsUndoRedoAction(false);
  }, [project]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  const handleZoomTotal = () => {
    if (stageRef.current && stageRef.current.zoomToFit) {
      stageRef.current.zoomToFit();
    }
  };

  const undo = () => {
    if (historyIndex > 0) {
      setIsUndoRedoAction(true);
      const prevProject = history[historyIndex - 1];
      setProject(JSON.parse(JSON.stringify(prevProject)));
      setHistoryIndex(historyIndex - 1);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      setIsUndoRedoAction(true);
      const nextProject = history[historyIndex + 1];
      setProject(JSON.parse(JSON.stringify(nextProject)));
      setHistoryIndex(historyIndex + 1);
    }
  };

  const lastEscPress = useRef<number>(0);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === 'Escape') {
        const now = Date.now();
        if (now - lastEscPress.current < 500) {
          setActiveTool(ToolType.SELECT);
          setSelectedIds([]);
          lastEscPress.current = 0; // Reset
        } else {
          lastEscPress.current = now;
        }
      }

      if (e.key === 'Delete') {
        handleDeleteSelected();
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        redo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  // Load saved projects on mount
  useEffect(() => {
    const saved = localStorage.getItem('planify_projects');
    if (saved) {
      try {
        setSavedProjects(JSON.parse(saved));
      } catch (e) {
        console.error('Error loading projects from localStorage', e);
      }
    }
    
    // Auto-zoom to fit on initial load
    const timer = setTimeout(() => {
      handleZoomTotal();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const saveProject = () => {
    const updatedProjects = [...savedProjects];
    const index = updatedProjects.findIndex(p => p.id === project.id);
    
    const projectToSave = { ...project, updatedAt: new Date().toISOString() };
    
    if (index >= 0) {
      updatedProjects[index] = projectToSave;
    } else {
      updatedProjects.push(projectToSave);
    }
    
    setSavedProjects(updatedProjects);
    localStorage.setItem('planify_projects', JSON.stringify(updatedProjects));
    alert(t('app.saveSuccess'));
  };

  const loadProject = (id: string) => {
    const p = savedProjects.find(proj => proj.id === id);
    if (p) {
      setProject(p);
      setIsProjectsListOpen(false);
    }
  };

  const deleteProject = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = savedProjects.filter(p => p.id !== id);
    setSavedProjects(updated);
    localStorage.setItem('planify_projects', JSON.stringify(updated));
  };

  const currentFloor = project.floors.find(f => f.id === project.currentFloorId) || project.floors[0];

  const totalProjectArea = project.floors.reduce((total, floor) => {
    return total + floor.rooms.reduce((acc, room) => {
      return acc + getComputedRoomArea(room, project.gridSize * 2);
    }, 0);
  }, 0);

  const getExportFilename = (ext: string) => {
    const date = new Date().toISOString().split('T')[0];
    const numFloors = project.floors.length;
    const area = totalProjectArea.toFixed(0);
    return `AuraNook_${date}_${project.name}_${numFloors}plantas_${area}m2.${ext}`;
  };

  const handleExportDXF = () => {
    downloadDXF(currentFloor, project.gridSize * 2, getExportFilename('dxf'));
  };

  const handleExportPDF = async (options: { showGrid: boolean; showDimensions: boolean; format: string; type: 'pdf' | 'png'; scale: string }) => {
    if (stageRef.current) {
      const stage = stageRef.current.getStage();
      if (stage) {
        if (options.type === 'pdf') {
          await downloadPDF(
            stage, 
            getExportFilename('pdf'), 
            options, 
            project.gridSize * 2,
            project,
            (updates) => setProject(prev => ({ ...prev, ...updates })),
            t,
            formatMeasurement,
            unit
          );
        } else {
          await downloadPNG(
            stage,
            getExportFilename('png'),
            options,
            project.gridSize * 2,
            project,
            t
          );
        }
      }
    }
  };

  const updateCurrentFloor = useCallback((updater: (floor: Floor) => Floor) => {
    setProject(prev => ({
      ...prev,
      floors: prev.floors.map(f => f.id === prev.currentFloorId ? updater(f) : f)
    }));
  }, [project.currentFloorId]);

  const handleAddWall = (newWall: Wall) => {
    updateCurrentFloor(floor => {
      let updatedWalls = [...floor.walls];
      let updatedOpenings = [...floor.openings];
      const pointsToSplitWith = [newWall.start, newWall.end];
      
      // Check each existing wall to see if it should be split by the new wall's endpoints
      const wallsToProcess = [...updatedWalls];
      updatedWalls = [];

      for (const wall of wallsToProcess) {
        let splitPoint: Point | null = null;
        for (const p of pointsToSplitWith) {
          if (isPointOnSegment(p, wall.start, wall.end)) {
            splitPoint = p;
            break;
          }
        }

        if (splitPoint) {
          // Split the wall into two
          const wall1Id = `wall-${Date.now()}-${Math.random()}`;
          const wall2Id = `wall-${Date.now()}-${Math.random()}`;
          const wall1: Wall = {
            ...wall,
            id: wall1Id,
            end: splitPoint
          };
          const wall2: Wall = {
            ...wall,
            id: wall2Id,
            start: splitPoint
          };
          updatedWalls.push(wall1, wall2);

          // Update openings that were on the original wall
          const wallLen = getDistance(wall.start, wall.end);
          const splitDist = getDistance(wall.start, splitPoint);
          const splitT = splitDist / wallLen;

          updatedOpenings = updatedOpenings.map(o => {
            if (o.wallId === wall.id) {
              if (o.position <= splitT) {
                // It's on wall1
                return { ...o, wallId: wall1Id, position: o.position / splitT };
              } else {
                // It's on wall2
                return { ...o, wallId: wall2Id, position: (o.position - splitT) / (1 - splitT) };
              }
            }
            return o;
          });
        } else {
          updatedWalls.push(wall);
        }
      }

      // Also check if existing endpoints split the NEW wall
      let newWallsToAdd = [newWall];
      for (const existingWall of floor.walls) {
        const existingPoints = [existingWall.start, existingWall.end];
        let nextNewWalls: Wall[] = [];
        
        for (const nw of newWallsToAdd) {
          let splitPoint: Point | null = null;
          for (const p of existingPoints) {
            if (isPointOnSegment(p, nw.start, nw.end)) {
              splitPoint = p;
              break;
            }
          }

          if (splitPoint) {
            const nw1: Wall = { ...nw, id: `wall-${Date.now()}-${Math.random()}`, end: splitPoint };
            const nw2: Wall = { ...nw, id: `wall-${Date.now()}-${Math.random()}`, start: splitPoint };
            nextNewWalls.push(nw1, nw2);
          } else {
            nextNewWalls.push(nw);
          }
        }
        newWallsToAdd = nextNewWalls;
      }

      // Room splitting logic
      let updatedRooms = [...floor.rooms];
      const roomsToProcess = [...updatedRooms];
      updatedRooms = [];

      const isPointOnEdge = (p: Point, p1: Point, p2: Point) => {
        if (getDistance(p, p1) < 2 || getDistance(p, p2) < 2) return true;
        return isPointOnSegment(p, p1, p2);
      };

      for (const room of roomsToProcess) {
        let startIndex = -1;
        let endIndex = -1;

        for (let i = 0; i < room.points.length; i++) {
          const p1 = room.points[i];
          const p2 = room.points[(i + 1) % room.points.length];
          if (isPointOnEdge(newWall.start, p1, p2)) startIndex = i;
          if (isPointOnEdge(newWall.end, p1, p2)) endIndex = i;
        }

        // Only split if points are on different edges or at least one is not an endpoint shared by the same edge
        if (startIndex !== -1 && endIndex !== -1 && startIndex !== endIndex) {
          // Ensure startIndex < endIndex for consistent slicing
          let s = startIndex;
          let e = endIndex;
          let pStart = newWall.start;
          let pEnd = newWall.end;
          
          if (s > e) {
            [s, e] = [e, s];
            [pStart, pEnd] = [pEnd, pStart];
          }

          const part1 = [
            pStart,
            ...room.points.slice(s + 1, e + 1),
            pEnd
          ];
          
          const part2 = [
            pEnd,
            ...room.points.slice(e + 1),
            ...room.points.slice(0, s + 1),
            pStart
          ];

          // Filter out duplicate points that might occur if newWall endpoints are room vertices
          const cleanPart1 = part1.filter((p, i, self) => 
            i === self.findIndex(tp => getDistance(tp, p) < 1)
          );
          const cleanPart2 = part2.filter((p, i, self) => 
            i === self.findIndex(tp => getDistance(tp, p) < 1)
          );

          if (cleanPart1.length >= 3 && cleanPart2.length >= 3) {
            updatedRooms.push(
              { ...room, id: `room-${Date.now()}-1`, points: cleanPart1 },
              { ...room, id: `room-${Date.now()}-2`, points: cleanPart2 }
            );
          } else {
            updatedRooms.push(room);
          }
        } else {
          updatedRooms.push(room);
        }
      }

      return {
        ...floor,
        walls: [...updatedWalls, ...newWallsToAdd],
        rooms: updatedRooms,
        openings: updatedOpenings
      };
    });
  };

  const handleClearFloor = () => {
    updateCurrentFloor(floor => ({
      ...floor,
      walls: [],
      rooms: [],
      furniture: [],
      openings: [],
      stairs: []
    }));
    setSelectedIds([]);
    setShowClearConfirm(false);
  };

  const handleAddRoom = (room: Room) => {
    updateCurrentFloor(floor => ({
      ...floor,
      rooms: [...floor.rooms, room]
    }));
  };

  const handleAddFurniture = (furniture: Furniture) => {
    let newFurniture = { ...furniture };
    if (stageRef.current && stageRef.current.getCenter) {
      const center = stageRef.current.getCenter();
      newFurniture.x = center.x;
      newFurniture.y = center.y;
    }

    updateCurrentFloor(floor => ({
      ...floor,
      furniture: [...floor.furniture, newFurniture]
    }));
    
    // Select the new furniture and switch to select tool so it can be moved immediately
    setSelectedIds([newFurniture.id]);
    setActiveTool(ToolType.SELECT);
  };

  const handleAddStairs = (stairs: Stairs) => {
    updateCurrentFloor(floor => ({
      ...floor,
      stairs: [...(floor.stairs || []), stairs]
    }));
    setSelectedIds([stairs.id]);
    setActiveTool(ToolType.SELECT);
  };

  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) return;
    updateCurrentFloor(floor => ({
      ...floor,
      walls: floor.walls.filter(w => !selectedIds.includes(w.id)),
      rooms: floor.rooms.filter(r => !selectedIds.includes(r.id)),
      furniture: floor.furniture.filter(f => !selectedIds.includes(f.id)),
      openings: floor.openings.filter(o => !selectedIds.includes(o.id)),
      stairs: (floor.stairs || []).filter(s => !selectedIds.includes(s.id)),
    }));
    setSelectedIds([]);
  };

  const handleSelect = (ids: string[]) => {
    setSelectedIds(ids);
    // Hide properties panel when selecting a different element or deselecting
    if (ids.length === 0 && rightPanelTab === 'properties') {
      setIsRightPanelOpen(false);
    }
    if (ids.length > 0 && activeTool !== ToolType.SELECT) {
      setActiveTool(ToolType.SELECT);
    }
  };

  const handleExportProject = () => {
    const data = JSON.stringify(project, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `AuraNook_${project.name || 'Proyecto'}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportProject = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importedProject = JSON.parse(event.target?.result as string);
        // Basic validation could be added here
        setProject(importedProject);
        setSelectedIds([]);
        setIsRightPanelOpen(false);
      } catch (error) {
        console.error("Error al importar el proyecto:", error);
        alert(t('app.importError'));
      }
    };
    reader.readAsText(file);
  };

  const selectedItem = selectedIds.length === 1 ? (
    currentFloor.walls.find(w => w.id === selectedIds[0]) ||
    currentFloor.rooms.find(r => r.id === selectedIds[0]) ||
    currentFloor.furniture.find(f => f.id === selectedIds[0]) ||
    currentFloor.openings.find(o => o.id === selectedIds[0]) ||
    (currentFloor.stairs || []).find(s => s.id === selectedIds[0])
  ) : null;

  return (
    <div className={cn(
      "flex h-screen w-full bg-[#E4E3E0] text-[#141414] font-sans overflow-hidden",
      isFullscreen && "fixed inset-0 z-50"
    )}>
      {/* Left Sidebar: Toolbar */}
      <div className={cn(
        "border-r border-[#141414] flex flex-col items-center py-6 bg-white/50 backdrop-blur-sm z-20 transition-all duration-300",
        mode === AppMode.DECORATION && activeCategory ? "w-80" : "w-20"
      )}>
        <div className="mb-8 flex flex-col items-center">
          <div className="w-16 h-16 flex items-center justify-center">
            <Logo size={56} />
          </div>
        </div>
        <div className="flex flex-1 w-full overflow-hidden">
          <div className="w-20 flex flex-col items-center flex-shrink-0">
            <Toolbar 
              mode={mode} 
              setMode={setMode} 
              activeTool={activeTool} 
              setActiveTool={setActiveTool} 
              activeCategory={activeCategory}
              setActiveCategory={setActiveCategory}
            />
          </div>
          {mode === AppMode.DECORATION && activeCategory && (
            <div className="flex-1 border-l border-[#141414]/10 overflow-hidden">
              <FurnitureLibrary 
                onAddFurniture={handleAddFurniture} 
                activeCategory={activeCategory}
              />
            </div>
          )}
        </div>
      </div>

      {/* Main Area */}
      <div className="flex-1 flex flex-col relative min-w-0">
        {/* Header */}
        <header className="min-h-[4rem] border-b border-[#141414] flex flex-wrap items-center justify-between px-4 py-2 gap-y-3 bg-white/30 backdrop-blur-md z-10">
          <div className="flex flex-wrap items-center gap-4 min-w-0">
            <div className="flex items-center gap-3 min-w-0">
              {isEditingName ? (
              <div className="flex items-center gap-1">
                <input 
                  autoFocus
                  type="text"
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setProject(p => ({ ...p, name: tempName }));
                      setIsEditingName(false);
                    }
                    if (e.key === 'Escape') {
                      setTempName(project.name);
                      setIsEditingName(false);
                    }
                  }}
                  className="bg-white border border-[#141414] rounded px-2 py-1 text-sm font-serif italic focus:outline-none"
                />
                <button 
                  onClick={() => {
                    setProject(p => ({ ...p, name: tempName }));
                    setIsEditingName(false);
                  }}
                  className="p-1 hover:bg-[#141414]/5 rounded transition-colors"
                >
                  <Check size={14} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 group">
                <h1 className="font-serif italic text-base truncate">{project.name || t('app.untitledProject')}</h1>
                <button 
                  onClick={() => {
                    setTempName(project.name);
                    setIsEditingName(true);
                  }}
                  className="p-1 opacity-0 group-hover:opacity-100 hover:bg-[#141414]/5 rounded transition-all"
                  title={t('app.renameFloor')}
                >
                  <Edit2 size={12} />
                </button>
              </div>
            )}
            <div className="h-4 w-px bg-[#141414]/20 shrink-0" />
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-widest opacity-40 leading-none mb-0.5">{t('app.totalArea')}</span>
              <span className="text-xs font-bold leading-none">
                {unit === 'm' ? `${totalProjectArea.toFixed(2)} m²` : `${(totalProjectArea * 10.7639).toFixed(2)} sq ft`}
              </span>
            </div>
            <div className="h-4 w-px bg-[#141414]/20 shrink-0" />
            <FloorManager 
              project={project} 
              setProject={setProject} 
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3 shrink-0 justify-end">
            <div className="flex items-center gap-1 sm:gap-2 bg-[#141414]/5 rounded-full p-1 sm:p-1.5 mr-1">
              <button 
                onClick={() => setShowClearConfirm(true)}
                className="p-1.5 hover:bg-red-100 rounded-full transition-colors text-red-600"
                title={t('app.clearFloor')}
              >
                <Trash2 size={16} />
              </button>
            </div>

            <div className="flex items-center gap-1 sm:gap-2 bg-[#141414]/5 rounded-full p-1 sm:p-1.5 mr-1">
              <button 
                onClick={handleExportDXF}
                className="p-1.5 hover:bg-[#141414]/10 rounded-full transition-colors text-[#141414]/60 hover:text-[#141414]"
                title={t('app.exportDXF')}
              >
                <FileCode size={16} />
              </button>
              <button 
                onClick={() => {
                  if (stageRef.current) {
                    const stage = stageRef.current.getStage();
                    if (stage) {
                      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                      let hasContent = false;
                      for (const floor of project.floors) {
                        floor.walls.forEach(w => {
                          minX = Math.min(minX, w.start.x, w.end.x);
                          minY = Math.min(minY, w.start.y, w.end.y);
                          maxX = Math.max(maxX, w.start.x, w.end.x);
                          maxY = Math.max(maxY, w.start.y, w.end.y);
                          hasContent = true;
                        });
                        floor.rooms.forEach(r => {
                          r.points.forEach(p => {
                            minX = Math.min(minX, p.x);
                            minY = Math.min(minY, p.y);
                            maxX = Math.max(maxX, p.x);
                            maxY = Math.max(maxY, p.y);
                            hasContent = true;
                          });
                        });
                        floor.furniture.forEach(f => {
                          const hw = (f.width / 100 * project.gridSize * 2) / 2;
                          const hh = (f.height / 100 * project.gridSize * 2) / 2;
                          minX = Math.min(minX, f.x - hw);
                          minY = Math.min(minY, f.y - hh);
                          maxX = Math.max(maxX, f.x + hw);
                          maxY = Math.max(maxY, f.y + hh);
                          hasContent = true;
                        });
                      }
                      
                      const padding = 100;
                      const exportX = hasContent ? minX - padding : 0;
                      const exportY = hasContent ? minY - padding : 0;
                      const exportWidth = hasContent ? (maxX - minX) + padding * 2 : stage.width();
                      const exportHeight = hasContent ? (maxY - minY) + padding * 2 : stage.height();

                      // Generate a low-res preview of the exact export area
                      const dataUrl = stage.toDataURL({ 
                        pixelRatio: 0.5,
                        x: exportX,
                        y: exportY,
                        width: exportWidth,
                        height: exportHeight
                      });
                      
                      setPreviewData({
                        image: dataUrl,
                        width: exportWidth,
                        height: exportHeight,
                        pixelsPerMeter: project.gridSize * 2
                      });
                    }
                  }
                  setIsPrintModalOpen(true);
                }}
                className="p-1.5 hover:bg-[#141414]/10 rounded-full transition-colors text-[#141414]/60 hover:text-[#141414]"
                title={t('app.printOptions')}
              >
                <Printer size={14} />
              </button>
            </div>

            <div className="flex items-center gap-1 sm:gap-2 bg-[#141414]/5 rounded-full p-1 sm:p-1.5 mr-1">
              <button 
                onClick={() => setProject(p => ({ ...p, showGhostFloors: !p.showGhostFloors }))}
                className={cn(
                  "p-1.5 rounded-full transition-all",
                  project.showGhostFloors 
                    ? "bg-[#141414] text-white shadow-sm" 
                    : "hover:bg-[#141414]/10 text-[#141414]/60 hover:text-[#141414]"
                )}
                title={project.showGhostFloors ? t('app.hideGhost') : t('app.showGhost')}
              >
                <Layers size={16} />
              </button>
              
              {project.showGhostFloors && project.floors.length > 1 && (
                <select 
                  value={project.ghostFloorId || ''}
                  onChange={(e) => setProject(p => ({ ...p, ghostFloorId: e.target.value || undefined }))}
                  className="bg-transparent text-[10px] font-bold uppercase tracking-wider px-2 py-1 focus:outline-none border-l border-[#141414]/10"
                >
                  <option value="">{t('app.allFloors')}</option>
                  {project.floors
                    .filter(f => f.id !== project.currentFloorId)
                    .map(f => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))
                  }
                </select>
              )}
            </div>

            <div className="flex items-center gap-1 sm:gap-2 bg-[#141414]/5 rounded-full p-1 sm:p-1.5 mr-1">
              <button 
                onClick={undo}
                disabled={historyIndex <= 0}
                className="p-1.5 hover:bg-[#141414]/10 rounded-full transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                title={t('app.undo')}
              >
                <Undo2 size={16} />
              </button>
              <button 
                onClick={redo}
                disabled={historyIndex >= history.length - 1}
                className="p-1.5 hover:bg-[#141414]/10 rounded-full transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                title={t('app.redo')}
              >
                <Redo2 size={16} />
              </button>
            </div>

            <div className="flex items-center gap-1 sm:gap-2 bg-[#141414]/5 rounded-full p-1 sm:p-1.5 mr-1">
              <button 
                onClick={() => setLanguage(language === 'es' ? 'en' : 'es')}
                className="p-1.5 hover:bg-[#141414]/10 rounded-full transition-colors flex items-center gap-1 px-3"
                title="Cambiar Idioma / Change Language"
              >
                <Globe size={16} />
                <span className="text-[10px] font-bold uppercase">{language}</span>
              </button>
              <div className="w-px h-4 bg-[#141414]/10 mx-1" />
              <button 
                onClick={() => setUnit(unit === 'm' ? 'in' : 'm')}
                className="p-1.5 hover:bg-[#141414]/10 rounded-full transition-colors flex items-center gap-1 px-3"
                title="Cambiar Unidad / Change Unit"
              >
                <Ruler size={16} />
                <span className="text-[10px] font-bold uppercase">{unit === 'm' ? 'm' : 'in'}</span>
              </button>
            </div>

            <button 
              onClick={() => setProject(p => ({ ...p, showGrid: !p.showGrid }))}
              className={cn(
                "p-1 sm:p-2 rounded-full transition-colors border border-transparent",
                project.showGrid ? "bg-[#141414] text-white" : "hover:bg-[#141414]/10"
              )}
              title={t('app.showGrid')}
            >
              <Grid3X3 size={18} />
            </button>
            <button 
              onClick={() => setProject(p => ({ ...p, showDimensions: !p.showDimensions }))}
              className={cn(
                "p-1 sm:p-2 rounded-full transition-colors border border-transparent",
                project.showDimensions ? "bg-[#141414] text-white" : "hover:bg-[#141414]/10"
              )}
              title={t('app.showDimensions')}
            >
              <Ruler size={18} />
            </button>
            <div className="hidden sm:block h-4 w-px bg-[#141414]/20 mx-1" />
            
            <div className="flex items-center gap-1">
              <button 
                onClick={handleExportProject}
                className="p-1 sm:p-2 rounded-full hover:bg-[#141414]/10 transition-colors"
                title={t('app.exportJson')}
              >
                <Download size={18} />
              </button>
              <label className="p-1 sm:p-2 rounded-full hover:bg-[#141414]/10 transition-colors cursor-pointer" title={t('app.importJson')}>
                <Upload size={18} />
                <input 
                  type="file" 
                  accept=".json" 
                  onChange={handleImportProject} 
                  className="hidden" 
                />
              </label>
            </div>

            <div className="hidden sm:block h-4 w-px bg-[#141414]/20 mx-1" />
            
            <button 
              onClick={() => {
                setIsRightPanelOpen(true);
                setRightPanelTab('challenge');
              }}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-xl transition-colors text-xs font-bold shadow-sm",
                rightPanelTab === 'challenge' && isRightPanelOpen
                  ? "bg-amber-500 text-white hover:bg-amber-600" 
                  : "bg-[#141414] text-white hover:bg-[#141414]/80"
              )}
              title="AuraChallenge"
            >
              <Trophy size={14} />
              <span className="hidden sm:inline">AuraChallenge</span>
            </button>

            <button 
              onClick={() => setIsEvaluateModalOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl transition-colors text-xs font-bold shadow-sm bg-indigo-500 text-white hover:bg-indigo-600"
              title="Evaluar Diseño con IA"
            >
              <Sparkles size={14} />
              <span className="hidden sm:inline">Evaluar con IA</span>
            </button>

            <div className="hidden sm:block h-4 w-px bg-[#141414]/20 mx-1" />

            <button 
              onClick={saveProject}
              className="p-1 sm:p-2 rounded-full hover:bg-[#141414]/10 transition-colors"
              title={t('app.save')}
            >
              <Save size={18} />
            </button>
            <button 
              onClick={() => setIsProjectsListOpen(true)}
              className="p-1 sm:p-2 rounded-full hover:bg-[#141414]/10 transition-colors"
              title={t('app.savedProjects')}
            >
              <FolderOpen size={18} />
            </button>
            <button 
              onClick={() => setIsHelpOpen(true)}
              className="p-1 sm:p-2 rounded-full hover:bg-[#141414]/10 transition-colors"
              title={t('app.help')}
            >
              <HelpCircle size={18} />
            </button>
            <div className="hidden sm:block h-4 w-px bg-[#141414]/20 mx-1" />
          </div>
        </header>

        {/* Confirmation Modal */}
        {showClearConfirm && (
          <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/20 backdrop-blur-sm">
            <div className="bg-white p-6 rounded-2xl border border-[#141414] shadow-2xl max-w-sm w-full mx-4">
              <h3 className="text-lg font-bold mb-2">{t('app.clearFloor')}</h3>
              <p className="text-sm text-gray-500 mb-6">{t('app.confirmClear')}</p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowClearConfirm(false)}
                  className="flex-1 py-2 px-4 rounded-xl border border-[#141414] text-sm font-medium hover:bg-gray-50"
                >
                  {t('app.cancel')}
                </button>
                <button 
                  onClick={handleClearFloor}
                  className="flex-1 py-2 px-4 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700"
                >
                  {t('app.clear')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Canvas Area */}
        <main className="flex-1 relative overflow-hidden bg-[#F0F0EE]">
          <Canvas 
            ref={stageRef}
            project={project}
            mode={mode}
            activeTool={activeTool}
            selectedIds={selectedIds}
            onSelect={handleSelect}
            onAddWall={handleAddWall}
            onAddRoom={handleAddRoom}
            onAddFurniture={handleAddFurniture}
            onAddStairs={handleAddStairs}
            updateCurrentFloor={updateCurrentFloor}
            onUpdateProject={setProject}
            onOpenProperties={() => {
              setIsRightPanelOpen(true);
              setRightPanelTab('properties');
            }}
          />
        </main>

        <AnimatePresence>
          {isHelpOpen && (
            <HelpGuide isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
          )}
        </AnimatePresence>

        <PrintModal 
          isOpen={isPrintModalOpen}
          onClose={() => setIsPrintModalOpen(false)}
          onPrint={handleExportPDF}
          previewData={previewData}
        />

        <EvaluateDesignModal
          project={project}
          isOpen={isEvaluateModalOpen}
          onClose={() => setIsEvaluateModalOpen(false)}
        />

        {/* Bottom Status Bar */}
        <footer className="h-8 border-t border-[#141414] bg-white/50 backdrop-blur-sm flex items-center justify-between px-4 text-[10px] uppercase tracking-widest opacity-60">
          <div className="flex gap-6">
            <span>{t('export.scale')}: 1 {t('properties.room')} = {unit === 'm' ? '0.5m' : '1.64ft'}</span>
            <span>Planta: {currentFloor.name}</span>
            <span>Modo: {t(`toolbar.${mode}`)}</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <Home size={10} />
              <span>AURA TEAM</span>
            </div>
            <span>© 2026 AURA TEAM</span>
          </div>
        </footer>
      </div>

      {/* Right Sidebar: Properties & Challenge */}
      <AnimatePresence>
        <motion.div 
          initial={{ x: 320 }}
          animate={{ x: isRightPanelOpen ? 0 : 320 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="w-80 border-l border-[#141414] bg-white/90 backdrop-blur-md z-20 flex flex-col fixed right-0 top-0 bottom-0 shadow-2xl"
        >
          {/* Toggle Handle */}
          <button 
            onClick={() => setIsRightPanelOpen(!isRightPanelOpen)}
            className="absolute left-[-48px] top-1/2 -translate-y-1/2 w-12 h-16 bg-white border border-[#141414] border-r-0 rounded-l-2xl flex items-center justify-center shadow-[-6px_0_12px_rgba(0,0,0,0.1)] hover:bg-slate-50 transition-colors z-30 cursor-pointer"
            title={isRightPanelOpen ? "Contraer panel" : "Expandir panel"}
          >
            <Settings2 size={24} className={cn("transition-transform duration-300 text-slate-700", !isRightPanelOpen && "rotate-180")} />
          </button>

          {/* Tabs */}
          <div className="flex border-b border-[#141414]/10">
            <button
              onClick={() => setRightPanelTab('properties')}
              className={cn(
                "flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors",
                rightPanelTab === 'properties' ? "bg-[#141414] text-white" : "hover:bg-[#141414]/5 text-[#141414]/60"
              )}
            >
              Propiedades
            </button>
            <button
              onClick={() => setRightPanelTab('challenge')}
              className={cn(
                "flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2",
                rightPanelTab === 'challenge' ? "bg-amber-500 text-white" : "hover:bg-amber-50 text-amber-600/60"
              )}
            >
              <Trophy size={14} />
              Desafío
            </button>
          </div>

          <div className="flex-1 overflow-y-auto relative">
            {/* Properties Tab Content */}
            <div className={cn("absolute inset-0 p-6", rightPanelTab === 'properties' ? "block" : "hidden")}>
              {selectedIds.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
                  <Settings2 size={48} className="mb-4 opacity-20" />
                  <p className="text-sm italic">Selecciona un elemento para ver sus propiedades</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="font-serif italic text-lg">
                      {selectedIds.length > 1 ? `${selectedIds.length} Seleccionados` : t('properties.title')}
                    </h2>
                    <button 
                      onClick={handleDeleteSelected}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-full transition-colors"
                      title={t('properties.delete')}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                  
                  {selectedIds.length === 1 && (
                    <PropertiesPanel 
                      item={selectedItem} 
                      gridSize={project.gridSize}
                      onUpdate={(updated) => {
                        updateCurrentFloor(floor => ({
                          ...floor,
                          walls: floor.walls.map(w => w.id === updated.id ? updated as Wall : w),
                          rooms: floor.rooms.map(r => r.id === updated.id ? updated as Room : r),
                          furniture: floor.furniture.map(f => f.id === updated.id ? updated as Furniture : f),
                          openings: floor.openings.map(o => o.id === updated.id ? updated as any : o),
                          stairs: (floor.stairs || []).map(s => s.id === updated.id ? updated as any : s),
                        }));
                      }}
                    />
                  )}
                  {selectedIds.length > 1 && (
                    <div className="text-xs text-[#141414]/40 italic">
                      Selección múltiple. Puedes mover o borrar los elementos seleccionados.
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Challenge Tab Content */}
            <div className={cn("absolute inset-0", rightPanelTab === 'challenge' ? "block" : "hidden")}>
              <ChallengePanel
                project={project}
                currentFloor={currentFloor}
                isOpen={true}
                onClose={() => setIsRightPanelOpen(false)}
              />
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Projects List Modal */}
      <AnimatePresence>
        {isProjectsListOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsProjectsListOpen(false)}
              className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white border border-[#141414] rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-[#141414]/10 flex items-center justify-between">
                <h2 className="font-serif italic text-xl">{t('app.savedProjects')}</h2>
                <button onClick={() => setIsProjectsListOpen(false)} className="p-2 hover:bg-[#141414]/5 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>
              <div className="p-4 max-h-[60vh] overflow-y-auto">
                {savedProjects.length === 0 ? (
                  <div className="py-12 text-center opacity-40">
                    <FolderOpen size={48} className="mx-auto mb-4 opacity-20" />
                    <p className="text-sm italic">{t('app.noSavedProjects')}</p>
                  </div>
                ) : (
                  <div className="grid gap-2">
                    {savedProjects.map(p => (
                      <div 
                        key={p.id}
                        onClick={() => loadProject(p.id)}
                        className="group flex items-center justify-between p-4 rounded-2xl border border-[#141414]/5 hover:border-[#141414]/20 hover:bg-[#141414]/5 transition-all cursor-pointer"
                      >
                        <div className="min-w-0">
                          <h3 className="font-bold text-sm truncate">{p.name}</h3>
                          <p className="text-[10px] opacity-40 uppercase tracking-widest">
                            {p.floors.length} {p.floors.length === 1 ? 'Planta' : 'Plantas'}
                          </p>
                        </div>
                        <button 
                          onClick={(e) => deleteProject(p.id, e)}
                          className="p-2 text-red-500 opacity-0 group-hover:opacity-100 hover:bg-red-50 rounded-full transition-all"
                          title={t('app.deleteProject')}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="p-4 bg-[#141414]/5 border-t border-[#141414]/10">
                <button 
                  onClick={() => {
                    const newId = `project-${Date.now()}`;
                    setProject({ ...INITIAL_PROJECT, id: newId, name: 'Nuevo Proyecto' });
                    setIsProjectsListOpen(false);
                  }}
                  className="w-full py-3 bg-[#141414] text-white rounded-2xl text-sm font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                >
                  <Plus size={16} />
                  Nuevo Proyecto
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
