import React, { useState, useRef, useEffect, useCallback, useImperativeHandle } from 'react';
import { Stage, Layer, Line, Rect, Text, Circle, Group, Transformer, Path, Ellipse } from 'react-konva';
import { 
  Project, 
  AppMode, 
  ToolType, 
  Wall, 
  Room, 
  Furniture, 
  Point,
  Floor,
  Stairs,
  StairsType
} from '../types';
import { calculateArea, getMidpoint, getDistance, getAngle, getLineIntersection, isPointOnSegment } from '../lib/utils';
import { DOOR_TEMPLATES, WINDOW_TEMPLATES, FURNITURE_TEMPLATES, STAIRS_TEMPLATES, CATEGORIES } from '../constants';
import { cn } from '../lib/utils';
import { Search, Plus, X, DoorOpen, Layout, ArrowUpRight as StairsIcon } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';

interface CanvasProps {
  project: Project;
  mode: AppMode;
  activeTool: ToolType;
  selectedIds: string[];
  onSelect: (ids: string[]) => void;
  onAddWall: (wall: Wall) => void;
  onAddRoom: (room: Room) => void;
  onAddFurniture: (furniture: Furniture) => void;
  onAddStairs: (stairs: Stairs) => void;
  updateCurrentFloor: (updater: (floor: Floor) => Floor) => void;
  onUpdateProject: (updater: (project: Project) => Project) => void;
  onOpenProperties: () => void;
}

export const Canvas = React.forwardRef<any, CanvasProps>(({ 
  project, 
  mode, 
  activeTool, 
  selectedIds, 
  onSelect, 
  onAddWall, 
  onAddRoom, 
  onAddFurniture,
  onAddStairs,
  updateCurrentFloor,
  onUpdateProject,
  onOpenProperties
}, ref) => {
  const { unit, formatMeasurement } = useSettings();
  const [stageSize, setStageSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [newWallPoints, setNewWallPoints] = useState<Point[]>([]);
  const [mousePos, setMousePos] = useState<Point>({ x: 0, y: 0 });
  const [newRoomPoints, setNewRoomPoints] = useState<Point[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isExteriorWall, setIsExteriorWall] = useState(false);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [pendingOpening, setPendingOpening] = useState<any>(null);
  const [pendingStairs, setPendingStairs] = useState<any>(null);
  const [selectionRect, setSelectionRect] = useState<{ x1: number, y1: number, x2: number, y2: number } | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<any>(null);

  const pxPerCm = (project.gridSize * 2) / 100;
  const cmToPx = (cm: number) => cm * pxPerCm;

  const currentFloor = project.floors.find(f => f.id === project.currentFloorId) || project.floors[0];
  const currentFloorIndex = project.floors.findIndex(f => f.id === project.currentFloorId);
  const floorBelow = currentFloorIndex > 0 ? project.floors[currentFloorIndex - 1] : null;
  const floorAbove = currentFloorIndex < project.floors.length - 1 ? project.floors[currentFloorIndex + 1] : null;

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setStageSize({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Clear pending states when tool changes
  useEffect(() => {
    setPendingOpening(null);
    setPendingStairs(null);
  }, [activeTool]);

  const zoomToFit = useCallback(() => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    const addPoint = (p: Point) => {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    };

    currentFloor.walls.forEach(w => {
      addPoint(w.start);
      addPoint(w.end);
    });

    currentFloor.rooms.forEach(r => {
      r.points.forEach(addPoint);
    });

    currentFloor.furniture.forEach(f => {
      const w = cmToPx(f.width);
      const h = cmToPx(f.height);
      addPoint({ x: f.x - w/2, y: f.y - h/2 });
      addPoint({ x: f.x + w/2, y: f.y + h/2 });
    });

    if (currentFloor.stairs) {
      currentFloor.stairs.forEach(s => {
        const w = cmToPx(s.width);
        const l = cmToPx(s.length);
        addPoint({ x: s.x - w/2, y: s.y - l/2 });
        addPoint({ x: s.x + w/2, y: s.y + l/2 });
      });
    }

    if (minX === Infinity) return;

    const padding = 100;
    const boxWidth = (maxX - minX) + padding * 2;
    const boxHeight = (maxY - minY) + padding * 2;

    const scaleX = stageSize.width / boxWidth;
    const scaleY = stageSize.height / boxHeight;
    const newScale = Math.min(scaleX, scaleY, 2); // Cap at 2x zoom

    const newPos = {
      x: (stageSize.width / 2) - ((minX + maxX) / 2) * newScale,
      y: (stageSize.height / 2) - ((minY + maxY) / 2) * newScale,
    };

    onUpdateProject(prev => ({ ...prev, zoom: newScale }));
    setStagePos(newPos);
  }, [currentFloor, stageSize, onUpdateProject]);

  useImperativeHandle(ref, () => ({
    zoomToFit,
    getCenter: () => {
      if (!stageRef.current) return { x: 0, y: 0 };
      const stage = stageRef.current;
      const scale = stage.scaleX();
      return {
        x: (stageSize.width / 2 - stage.x()) / scale,
        y: (stageSize.height / 2 - stage.y()) / scale
      };
    },
    getStage: () => stageRef.current
  }));

  const [draggingRoomVertex, setDraggingRoomVertex] = useState<{roomId: string, pointIndex: number, pos: Point} | null>(null);

  const [draggingWallVertex, setDraggingWallVertex] = useState<{wallId: string, isStart: boolean, pos: Point} | null>(null);

  const snapToGrid = (point: Point): Point => {
    const size = project.gridSize / 2;
    return {
      x: Math.round(point.x / size) * size,
      y: Math.round(point.y / size) * size,
    };
  };

  const snapToExistingPoint = (point: Point): Point => {
    const snapDistance = 15;
    let bestPoint = snapToGrid(point);
    let minDistance = snapDistance;

    currentFloor.walls.forEach(wall => {
      const dStart = getDistance(point, wall.start);
      if (dStart < minDistance) {
        minDistance = dStart;
        bestPoint = wall.start;
      }
      const dEnd = getDistance(point, wall.end);
      if (dEnd < minDistance) {
        minDistance = dEnd;
        bestPoint = wall.end;
      }
    });

    return bestPoint;
  };

  const getRelativePointerPosition = (stage: any) => {
    const transform = stage.getAbsoluteTransform().copy();
    transform.invert();
    const pos = stage.getPointerPosition();
    return transform.point(pos);
  };

  const handleMouseDown = (e: any) => {
    const stage = e.target.getStage();
    const worldPos = getRelativePointerPosition(stage);

    // Middle button for panning
    if (e.evt.button === 1) {
      setIsPanning(true);
      return;
    }

    if (activeTool === ToolType.SELECT) {
      if (e.target === stage) {
        setSelectionRect({ x1: worldPos.x, y1: worldPos.y, x2: worldPos.x, y2: worldPos.y });
        if (!e.evt.ctrlKey) onSelect([]);
      }
      return;
    }

    const snappedPos = snapToExistingPoint(worldPos);
    const pos = snappedPos;

    if (mode === AppMode.DESIGN) {
      if (activeTool === ToolType.WALL) {
        if (newWallPoints.length === 0) {
          setNewWallPoints([pos]);
          setIsDrawing(true);
        } else {
          const start = newWallPoints[newWallPoints.length - 1];
          
          const wallExists = (p1: Point, p2: Point) => {
            return currentFloor.walls.some(w => 
              (getDistance(w.start, p1) < 2 && getDistance(w.end, p2) < 2) ||
              (getDistance(w.start, p2) < 2 && getDistance(w.end, p1) < 2)
            );
          };

          // Check if we are closing the loop
          const firstPoint = newWallPoints[0];
          const isClosingManually = getDistance(pos, firstPoint) < 5 && newWallPoints.length >= 3;
          
          // Check if pos is connected to firstPoint via an existing wall (for adjacent rooms)
          const isConnectedToFirst = currentFloor.walls.some(w => 
            (getDistance(w.start, pos) < 2 && getDistance(w.end, firstPoint) < 2) ||
            (getDistance(w.start, firstPoint) < 2 && getDistance(w.end, pos) < 2)
          );

          if (isClosingManually || (isConnectedToFirst && newWallPoints.length >= 2)) {
            // If closing manually, we might need to add the final wall
            if (isClosingManually && !wallExists(start, firstPoint)) {
              const finalWall: Wall = {
                id: `wall-${Date.now()}-final`,
                start: start,
                end: firstPoint,
                thickness: isExteriorWall ? 30 : 10,
                isExterior: isExteriorWall,
                color: '#141414',
              };
              onAddWall(finalWall);
            } else if (isConnectedToFirst) {
              // If closing via existing wall, we need to add the wall from start to pos first
              if (!wallExists(start, pos)) {
                const finalWall: Wall = {
                  id: `wall-${Date.now()}-final`,
                  start: start,
                  end: pos,
                  thickness: isExteriorWall ? 30 : 10,
                  isExterior: isExteriorWall,
                  color: '#141414',
                };
                onAddWall(finalWall);
              }
            }
            
            // Create the room
            const roomPoints = isConnectedToFirst ? [...newWallPoints, pos] : [...newWallPoints];
            const newRoom: Room = {
              id: `room-${Date.now()}`,
              points: roomPoints,
              name: 'Nueva Habitación',
              color: '#E5E7EB',
              showDimensions: true,
            };
            
            updateCurrentFloor(floor => ({
              ...floor,
              rooms: [...floor.rooms, newRoom]
            }));
            
            setNewWallPoints([]);
            setIsDrawing(false);
          } else {
            if (!wallExists(start, pos)) {
              const newWall: Wall = {
                id: `wall-${Date.now()}`,
                start: start,
                end: pos,
                thickness: isExteriorWall ? 30 : 10,
                isExterior: isExteriorWall,
                color: '#141414',
              };
              onAddWall(newWall);
            }
            setNewWallPoints([...newWallPoints, pos]);
          }
        }
      } else if (activeTool === ToolType.ROOM) {
        setNewRoomPoints([...newRoomPoints, pos]);
        setIsDrawing(true);
      } else if (activeTool === ToolType.DOOR || activeTool === ToolType.WINDOW) {
        if (pendingOpening) {
          // Find nearest wall
          let nearestWall: Wall | null = null;
          let minDistance = Infinity;
          let bestPos = 0;

          currentFloor.walls.forEach(wall => {
            const d = getDistanceToSegment(pos, wall.start, wall.end);
            if (d < minDistance && d < 50) {
              minDistance = d;
              nearestWall = wall;
              const wallLen = getDistance(wall.start, wall.end);
              const dStart = getDistance(pos, wall.start);
              bestPos = dStart / wallLen;
            }
          });

          if (nearestWall) {
            const newOpening: any = {
              ...pendingOpening,
              id: `${activeTool}-${Date.now()}`,
              wallId: (nearestWall as Wall).id,
              position: Math.max(0, Math.min(1, bestPos)),
            };
            updateCurrentFloor(floor => ({
              ...floor,
              openings: [...(floor.openings || []), newOpening]
            }));
            // Continuous placement: don't clear pendingOpening
          }
        }
      } else if (activeTool === ToolType.STAIRS) {
        if (pendingStairs) {
          const newStairs: Stairs = {
            ...pendingStairs,
            id: `stairs-${Date.now()}`,
            x: pos.x,
            y: pos.y,
            rotation: 0,
            direction: 'up',
          };
          onAddStairs(newStairs);
          // Continuous placement: don't clear pendingStairs
        }
      }
    }
  };

  const getDistanceToSegment = (p: Point, a: Point, b: Point) => {
    const l2 = Math.pow(getDistance(a, b), 2);
    if (l2 === 0) return getDistance(p, a);
    let t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return getDistance(p, { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) });
  };

  const handleMouseMove = (e: any) => {
    const stage = e.target.getStage();
    const worldPos = getRelativePointerPosition(stage);
    setMousePos(worldPos);

    if (isPanning) {
      const dx = e.evt.movementX;
      const dy = e.evt.movementY;
      setStagePos(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      return;
    }

    if (draggingWallVertex) {
      const snapped = snapToGrid(worldPos);
      setDraggingWallVertex(prev => prev ? { ...prev, pos: snapped } : null);
      
      updateCurrentFloor(floor => {
        const wall = floor.walls.find(w => w.id === draggingWallVertex.wallId);
        if (!wall) return floor;

        const oldPoint = draggingWallVertex.isStart ? wall.start : wall.end;
        const newPoint = snapped;

        const updatedWalls = floor.walls.map(w => {
          let updatedW = { ...w };
          if (getDistance(w.start, oldPoint) < 2) updatedW.start = newPoint;
          if (getDistance(w.end, oldPoint) < 2) updatedW.end = newPoint;
          return updatedW;
        });

        return {
          ...floor,
          walls: updatedWalls,
          rooms: floor.rooms.map(r => ({
            ...r,
            points: r.points.map(p => getDistance(p, oldPoint) < 2 ? newPoint : p)
          }))
        };
      });
      return;
    }

    if (selectionRect) {
      setSelectionRect(prev => prev ? { ...prev, x2: worldPos.x, y2: worldPos.y } : null);
      return;
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && activeTool === ToolType.ROOM && newRoomPoints.length >= 3) {
      const newRoom: Room = {
        id: `room-${Date.now()}`,
        points: newRoomPoints,
        name: 'Nueva Habitación',
        color: '#E5E7EB',
        showDimensions: true,
      };
      onAddRoom(newRoom);
      setNewRoomPoints([]);
      setIsDrawing(false);
    } else if (e.key === 'Escape') {
      setNewWallPoints([]);
      setNewRoomPoints([]);
      setPendingOpening(null);
      setPendingStairs(null);
      setIsDrawing(false);
    }
  };

  const handleMouseUp = (e: any) => {
    if (draggingWallVertex) {
      setDraggingWallVertex(null);
      return;
    }

    if (isPanning) {
      setIsPanning(false);
      return;
    }

    if (selectionRect) {
      const x1 = Math.min(selectionRect.x1, selectionRect.x2);
      const y1 = Math.min(selectionRect.y1, selectionRect.y2);
      const x2 = Math.max(selectionRect.x1, selectionRect.x2);
      const y2 = Math.max(selectionRect.y1, selectionRect.y2);

      const newSelectedIds = [...selectedIds];

      // Select items within rectangle
      currentFloor.walls.forEach(w => {
        if (w.start.x >= x1 && w.start.x <= x2 && w.start.y >= y1 && w.start.y <= y2 &&
            w.end.x >= x1 && w.end.x <= x2 && w.end.y >= y1 && w.end.y <= y2) {
          if (!newSelectedIds.includes(w.id)) newSelectedIds.push(w.id);
        }
      });

      currentFloor.rooms.forEach(r => {
        if (r.points.every(p => p.x >= x1 && p.x <= x2 && p.y >= y1 && p.y <= y2)) {
          if (!newSelectedIds.includes(r.id)) newSelectedIds.push(r.id);
        }
      });

      currentFloor.furniture.forEach(f => {
        if (f.x >= x1 && f.x <= x2 && f.y >= y1 && f.y <= y2) {
          if (!newSelectedIds.includes(f.id)) newSelectedIds.push(f.id);
        }
      });

      currentFloor.openings.forEach(o => {
        const wall = currentFloor.walls.find(w => w.id === o.wallId);
        if (wall) {
          const p = {
            x: wall.start.x + (wall.end.x - wall.start.x) * o.position,
            y: wall.start.y + (wall.end.y - wall.start.y) * o.position
          };
          if (p.x >= x1 && p.x <= x2 && p.y >= y1 && p.y <= y2) {
            if (!newSelectedIds.includes(o.id)) newSelectedIds.push(o.id);
          }
        }
      });

      onSelect(newSelectedIds);
      setSelectionRect(null);
    }
  };

  const handleStageClick = (e: any) => {
    if (e.evt.button === 1) return; // Middle button handled by double click or drag

    if (activeTool === ToolType.SELECT) {
      if (e.target === e.target.getStage()) {
        if (!e.evt.ctrlKey) onSelect([]);
      } else {
        const id = e.target.id() || e.target.parent?.id();
        if (id) {
          if (e.evt.ctrlKey) {
            if (selectedIds.includes(id)) {
              onSelect(selectedIds.filter(sid => sid !== id));
            } else {
              onSelect([...selectedIds, id]);
            }
          } else {
            onSelect([id]);
          }
        }
      }
    }
  };

  const handleStageDoubleClick = (e: any) => {
    if (e.evt.button === 1) {
      zoomToFit();
      return;
    }
    
    // If we double clicked an element (not the stage background), open properties
    if (e.target !== e.target.getStage() && selectedIds.length > 0) {
      onOpenProperties();
    }
  };

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [newRoomPoints, newWallPoints, activeTool]);

  const handleFurnitureDragMove = (id: string, e: any) => {
    const floor = currentFloor;
    const f = floor.furniture.find(item => item.id === id);
    if (!f) return null;

    const stage = e.target.getStage();
    const transform = stage.getAbsoluteTransform().copy();
    transform.invert();
    const pos = transform.point(e.target.absolutePosition());
    
    let newX = pos.x;
    let newY = pos.y;
    let rotation = f.rotation;
    let nearestWallId = f.attachedWallId;
    let nearestWallSide = f.attachedWallSide;
    let nearestWallOffset = f.attachedWallOffset;
    let snappedToCounter = false;

    // Counter snapping logic
    if (f.type === 'kitchen_counter') {
      const fWidth = cmToPx(f.width);
      const fHeight = cmToPx(f.height);
      const snapDist = 20;

      for (const other of floor.furniture) {
        if (other.id === f.id || other.type !== 'kitchen_counter') continue;
        
        const otherWidth = cmToPx(other.width);
        const otherHeight = cmToPx(other.height);
        
        // Possible snap points for 'other' (corners and edges)
        const otherCorners = [
          { x: -otherWidth/2, y: -otherHeight/2 },
          { x: otherWidth/2, y: -otherHeight/2 },
          { x: otherWidth/2, y: otherHeight/2 },
          { x: -otherWidth/2, y: otherHeight/2 }
        ].map(p => {
          const rad = (other.rotation * Math.PI) / 180;
          return {
            x: other.x + p.x * Math.cos(rad) - p.y * Math.sin(rad),
            y: other.y + p.x * Math.sin(rad) + p.y * Math.cos(rad)
          };
        });

        // My corners
        const myCorners = [
          { x: -fWidth/2, y: -fHeight/2 },
          { x: fWidth/2, y: -fHeight/2 },
          { x: fWidth/2, y: fHeight/2 },
          { x: -fWidth/2, y: fHeight/2 }
        ];

        for (let i = 0; i < 4; i++) {
          for (let j = 0; j < 4; j++) {
            const myCornerRel = myCorners[i];
            const rad = (f.rotation * Math.PI) / 180;
            const myCornerWorld = {
              x: newX + myCornerRel.x * Math.cos(rad) - myCornerRel.y * Math.sin(rad),
              y: newY + myCornerRel.x * Math.sin(rad) + myCornerRel.y * Math.cos(rad)
            };

            if (getDistance(myCornerWorld, otherCorners[j]) < snapDist) {
              const dxSnap = otherCorners[j].x - myCornerWorld.x;
              const dySnap = otherCorners[j].y - myCornerWorld.y;
              newX += dxSnap;
              newY += dySnap;
              snappedToCounter = true;
              
              // Align rotation to be parallel or perpendicular to the other counter
              const angleDiff = (f.rotation - other.rotation) % 90;
              if (Math.abs(angleDiff) < 45) {
                rotation = f.rotation - angleDiff;
              } else {
                rotation = f.rotation + (90 - Math.abs(angleDiff)) * Math.sign(angleDiff);
              }
              
              break;
            }
          }
          if (snappedToCounter) break;
        }
        if (snappedToCounter) break;
      }
    }

    if (!snappedToCounter) {
      const fHeight = cmToPx(f.height);
      const fWidth = cmToPx(f.width);
      
      let minDistance = Infinity; 
      let foundWallId = '';
      let foundSide = 1;
      let foundOffset = 0;
      let finalSnapDepth = fHeight;
      let finalSnapWidth = fWidth;
      let finalRotation = f.rotation;

      // Pass 1: Find closest wall to snap to
      floor.walls.forEach(wall => {
        const dist = getDistanceToSegment({ x: newX, y: newY }, wall.start, wall.end);
        const wallLen = getDistance(wall.start, wall.end);
        if (wallLen === 0) return;
        
        const wdx = wall.end.x - wall.start.x;
        const wdy = wall.end.y - wall.start.y;
        const t = ((newX - wall.start.x) * wdx + (newY - wall.start.y) * wdy) / (wallLen * wallLen);
        
        const projX = wall.start.x + t * wdx;
        const projY = wall.start.y + t * wdy;
        const nx = -wdy / wallLen;
        const ny = wdx / wallLen;
        const dot = (newX - projX) * nx + (newY - projY) * ny;
        const side = dot >= 0 ? 1 : -1;
        
        let wallAngle = getAngle(wall.start, wall.end);
        let baseAngle = side === -1 ? wallAngle + 180 : wallAngle;
        
        let angleDiff = (f.rotation - baseAngle) % 360;
        if (angleDiff < 0) angleDiff += 360;
        
        let snapAngleOffset = 0;
        if (angleDiff >= 45 && angleDiff < 135) snapAngleOffset = 90;
        else if (angleDiff >= 135 && angleDiff < 225) snapAngleOffset = 180;
        else if (angleDiff >= 225 && angleDiff < 315) snapAngleOffset = 270;
        
        let currentSnapDepth = (snapAngleOffset === 90 || snapAngleOffset === 270) ? fWidth : fHeight;
        let currentSnapWidth = (snapAngleOffset === 90 || snapAngleOffset === 270) ? fHeight : fWidth;
        
        const thickness = cmToPx(wall.thickness);
        const overlapDist = currentSnapDepth / 2 + thickness / 2;
        
        const bias = (wall.id === f.attachedWallId) ? 20 : 0;
        const threshold = Math.max(currentSnapDepth / 2 + 40, overlapDist + 5);
        
        let effectiveDist = dist - bias;
        if (dist < overlapDist) {
           effectiveDist = dist - 1000;
        }
        
        if (effectiveDist < minDistance && dist < threshold) {
          minDistance = effectiveDist;
          foundWallId = wall.id;
          foundSide = side;
          foundOffset = t;
          finalSnapDepth = currentSnapDepth;
          finalSnapWidth = currentSnapWidth;
          finalRotation = baseAngle + snapAngleOffset;
        }
      });

      if (foundWallId) {
        const wall = floor.walls.find(w => w.id === foundWallId)!;
        const wallLen = getDistance(wall.start, wall.end);
        const wdx = wall.end.x - wall.start.x;
        const wdy = wall.end.y - wall.start.y;
        const nx = -wdy / wallLen;
        const ny = wdx / wallLen;
        const thickness = cmToPx(wall.thickness);
        
        const halfWidthOffset = (finalSnapWidth / 2) / wallLen;
        
        if (f.type === 'kitchen_counter') {
          const minOffset = (finalSnapWidth / 2 + thickness / 2) / wallLen;
          foundOffset = Math.max(minOffset, Math.min(1 - minOffset, foundOffset));
        } else {
          if (halfWidthOffset >= 0.5) {
            foundOffset = 0.5;
          } else {
            foundOffset = Math.max(halfWidthOffset, Math.min(1 - halfWidthOffset, foundOffset));
          }
        }

        newX = wall.start.x + wdx * foundOffset + nx * foundSide * (thickness / 2 + finalSnapDepth / 2);
        newY = wall.start.y + wdy * foundOffset + ny * foundSide * (thickness / 2 + finalSnapDepth / 2);
        
        nearestWallId = foundWallId;
        nearestWallSide = foundSide;
        nearestWallOffset = foundOffset;
        rotation = finalRotation;
      } else {
        nearestWallId = undefined;
        nearestWallSide = undefined;
        nearestWallOffset = undefined;
      }

      // Pass 2: Push out of ANY overlapping walls (e.g. in corners)
      floor.walls.forEach(wall => {
        const dist = getDistanceToSegment({ x: newX, y: newY }, wall.start, wall.end);
        const wallLen = getDistance(wall.start, wall.end);
        if (wallLen === 0) return;
        
        const wdx = wall.end.x - wall.start.x;
        const wdy = wall.end.y - wall.start.y;
        const t = ((newX - wall.start.x) * wdx + (newY - wall.start.y) * wdy) / (wallLen * wallLen);
        
        const projX = wall.start.x + t * wdx;
        const projY = wall.start.y + t * wdy;
        const nx = -wdy / wallLen;
        const ny = wdx / wallLen;
        const dot = (newX - projX) * nx + (newY - projY) * ny;
        const side = dot >= 0 ? 1 : -1;
        
        let wallAngle = getAngle(wall.start, wall.end);
        let baseAngle = side === -1 ? wallAngle + 180 : wallAngle;
        let angleDiff = (rotation - baseAngle) % 360;
        if (angleDiff < 0) angleDiff += 360;
        
        let snapAngleOffset = 0;
        if (angleDiff >= 45 && angleDiff < 135) snapAngleOffset = 90;
        else if (angleDiff >= 135 && angleDiff < 225) snapAngleOffset = 180;
        else if (angleDiff >= 225 && angleDiff < 315) snapAngleOffset = 270;
        
        let currentSnapDepth = (snapAngleOffset === 90 || snapAngleOffset === 270) ? fWidth : fHeight;
        
        const thickness = cmToPx(wall.thickness);
        const overlapDist = currentSnapDepth / 2 + thickness / 2;
        
        if (dist < overlapDist - 0.1) { // 0.1 margin for floating point
          const pushDist = overlapDist - dist;
          newX += nx * side * pushDist;
          newY += ny * side * pushDist;
        }
      });
    }

    return { x: newX, y: newY, rotation, attachedWallId: nearestWallId, attachedWallSide: nearestWallSide, attachedWallOffset: nearestWallOffset };
  };

  const handleFurnitureDragEnd = (id: string, e: any) => {
    const furniture = currentFloor.furniture.find(f => f.id === id);
    if (!furniture) return;

    const result = handleFurnitureDragMove(id, e);
    if (!result) return;

    const dx = result.x - furniture.x;
    const dy = result.y - furniture.y;

    const idsToMove = selectedIds.includes(id) ? selectedIds : [id];

    updateCurrentFloor(floor => {
      const newFurniture = floor.furniture.map(f => {
        if (idsToMove.includes(f.id)) {
          if (f.id === id) {
            return {
              ...f,
              x: result.x,
              y: result.y,
              rotation: result.rotation,
              attachedWallId: result.attachedWallId,
              attachedWallSide: result.attachedWallSide,
              attachedWallOffset: result.attachedWallOffset
            };
          } else {
            return {
              ...f,
              x: f.x + dx,
              y: f.y + dy
            };
          }
        }
        return f;
      });

      return { ...floor, furniture: newFurniture };
    });
  };

  const handleWallDragEnd = (id: string, e: any) => {
    const dx = e.currentTarget.x();
    const dy = e.currentTarget.y();
    
    updateCurrentFloor(floor => {
      const movedWall = floor.walls.find(w => w.id === id);
      if (!movedWall) return floor;

      const oldStart = movedWall.start;
      const oldEnd = movedWall.end;
      const newStart = snapToGrid({ x: oldStart.x + dx, y: oldStart.y + dy });
      const newEnd = snapToGrid({ x: oldEnd.x + dx, y: oldEnd.y + dy });

      const updatedWalls = floor.walls.map(w => {
        let updatedW = { ...w };
        if (w.id === id) {
          updatedW.start = newStart;
          updatedW.end = newEnd;
        } else {
          // Check if this wall shares a point with the moved wall (stretching)
          const wallAngle = getAngle(oldStart, oldEnd);
          const otherAngle = getAngle(w.start, w.end);
          const angleDiff = Math.abs(wallAngle - otherAngle) % 180;
          const isColinear = angleDiff < 1 || angleDiff > 179;

          if (!isColinear) {
            if (getDistance(w.start, oldStart) < 2) updatedW.start = newStart;
            else if (getDistance(w.start, oldEnd) < 2) updatedW.start = newEnd;
            
            if (getDistance(w.end, oldStart) < 2) updatedW.end = newStart;
            else if (getDistance(w.end, oldEnd) < 2) updatedW.end = newEnd;
          }
        }
        return updatedW;
      });

      return {
        ...floor,
        walls: updatedWalls,
        rooms: floor.rooms.map(r => {
          let containsWall = false;
          for (let i = 0; i < r.points.length; i++) {
            const a = r.points[i];
            const b = r.points[(i + 1) % r.points.length];
            if ((getDistance(a, oldStart) < 2 && getDistance(b, oldEnd) < 2) ||
                (getDistance(a, oldEnd) < 2 && getDistance(b, oldStart) < 2)) {
              containsWall = true;
              break;
            }
          }

          if (containsWall) {
            return {
              ...r,
              points: r.points.map(p => {
                if (getDistance(p, oldStart) < 2) return newStart;
                if (getDistance(p, oldEnd) < 2) return newEnd;
                return p;
              })
            };
          }
          return r;
        }),
        furniture: floor.furniture.map(f => {
          const wall = updatedWalls.find(w => w.id === f.attachedWallId);
          if (wall) {
            const wallLen = getDistance(wall.start, wall.end);
            const wallDx = wall.end.x - wall.start.x;
            const wallDy = wall.end.y - wall.start.y;
            const nx = -wallDy / wallLen;
            const ny = wallDx / wallLen;
            const offset = f.attachedWallOffset || 0;
            const side = f.attachedWallSide || 1;
            const thickness = cmToPx(wall.thickness);
            const fHeight = cmToPx(f.height);
            
            const newX = wall.start.x + wallDx * offset + nx * side * (thickness / 2 + fHeight / 2);
            const newY = wall.start.y + wallDy * offset + ny * side * (thickness / 2 + fHeight / 2);
            
            let rotation = getAngle(wall.start, wall.end);
            if (side === -1) rotation += 180;

            return { ...f, x: newX, y: newY, rotation };
          }
          return f;
        }),
        stairs: (floor.stairs || []).map(s => {
          const wall = updatedWalls.find(w => w.id === s.attachedWallId);
          if (wall) {
            const wallLen = getDistance(wall.start, wall.end);
            const wallDx = wall.end.x - wall.start.x;
            const wallDy = wall.end.y - wall.start.y;
            const nx = -wallDy / wallLen;
            const ny = wallDx / wallLen;
            const offset = s.attachedWallOffset || 0;
            const side = s.attachedWallSide || 1;
            const thickness = cmToPx(wall.thickness);
            const sHeight = cmToPx(s.length || 200);
            
            const newX = wall.start.x + wallDx * offset + nx * side * (thickness / 2 + sHeight / 2);
            const newY = wall.start.y + wallDy * offset + ny * side * (thickness / 2 + sHeight / 2);
            
            let rotation = getAngle(wall.start, wall.end);
            if (side === -1) rotation += 180;

            return { ...s, x: newX, y: newY, rotation };
          }
          return s;
        })
      };
    });
    e.currentTarget.position({ x: 0, y: 0 });
  };

  const handleRoomVertexDragMove = (roomId: string, pointIndex: number, e: any) => {
    setDraggingRoomVertex({
      roomId,
      pointIndex,
      pos: { x: e.target.x(), y: e.target.y() }
    });
  };

  const handleRoomVertexDragEnd = (roomId: string, pointIndex: number, e: any) => {
    setDraggingRoomVertex(null);
    const newPos = snapToGrid({ x: e.target.x(), y: e.target.y() });
    
    updateCurrentFloor(floor => {
      const room = floor.rooms.find(r => r.id === roomId);
      if (!room) return floor;

      const oldPoint = room.points[pointIndex];

      const updatedWalls = floor.walls.map(w => {
        let updatedW = { ...w };
        if (getDistance(w.start, oldPoint) < 2) updatedW.start = newPos;
        if (getDistance(w.end, oldPoint) < 2) updatedW.end = newPos;
        return updatedW;
      });

      return {
        ...floor,
        rooms: floor.rooms.map(r => ({
          ...r,
          points: r.points.map(p => getDistance(p, oldPoint) < 2 ? newPos : p)
        })),
        walls: updatedWalls,
        furniture: floor.furniture.map(f => {
          const wall = updatedWalls.find(w => w.id === f.attachedWallId);
          if (wall && (getDistance(wall.start, oldPoint) < 2 || getDistance(wall.end, oldPoint) < 2)) {
            const wallLen = getDistance(wall.start, wall.end);
            const wallDx = wall.end.x - wall.start.x;
            const wallDy = wall.end.y - wall.start.y;
            const nx = -wallDy / wallLen;
            const ny = wallDx / wallLen;
            const offset = f.attachedWallOffset || 0;
            const side = f.attachedWallSide || 1;
            const thickness = cmToPx(wall.thickness);
            const fHeight = cmToPx(f.height);
            
            const newX = wall.start.x + wallDx * offset + nx * side * (thickness / 2 + fHeight / 2);
            const newY = wall.start.y + wallDy * offset + ny * side * (thickness / 2 + fHeight / 2);
            
            let rotation = getAngle(wall.start, wall.end);
            if (side === -1) rotation += 180;

            return { ...f, x: newX, y: newY, rotation };
          }
          return f;
        }),
        stairs: (floor.stairs || []).map(s => {
          const wall = updatedWalls.find(w => w.id === s.attachedWallId);
          if (wall && (getDistance(wall.start, oldPoint) < 2 || getDistance(wall.end, oldPoint) < 2)) {
            const wallLen = getDistance(wall.start, wall.end);
            const wallDx = wall.end.x - wall.start.x;
            const wallDy = wall.end.y - wall.start.y;
            const nx = -wallDy / wallLen;
            const ny = wallDx / wallLen;
            const offset = s.attachedWallOffset || 0;
            const side = s.attachedWallSide || 1;
            const thickness = cmToPx(wall.thickness);
            const sHeight = cmToPx(s.length || 200);
            
            const newX = wall.start.x + wallDx * offset + nx * side * (thickness / 2 + sHeight / 2);
            const newY = wall.start.y + wallDy * offset + ny * side * (thickness / 2 + sHeight / 2);
            
            let rotation = getAngle(wall.start, wall.end);
            if (side === -1) rotation += 180;

            return { ...s, x: newX, y: newY, rotation };
          }
          return s;
        })
      };
    });
    e.target.position({ x: 0, y: 0 });
  };

  const handleRoomLabelDragEnd = (roomId: string, e: any) => {
    const newPos = { x: e.target.x(), y: e.target.y() };
    updateCurrentFloor(floor => ({
      ...floor,
      rooms: floor.rooms.map(r => r.id === roomId ? { ...r, labelPosition: newPos } : r)
    }));
  };

  const handleStairsDragMove = (id: string, e: any) => {
    const floor = currentFloor;
    const s = floor.stairs.find(item => item.id === id);
    if (!s) return null;

    const stage = e.target.getStage();
    const transform = stage.getAbsoluteTransform().copy();
    transform.invert();
    const pos = transform.point(e.target.absolutePosition());
    
    let newX = pos.x;
    let newY = pos.y;
    let rotation = s.rotation;
    let nearestWallId = s.attachedWallId;
    let nearestWallSide = s.attachedWallSide;
    let nearestWallOffset = s.attachedWallOffset;

    const sHeight = cmToPx(s.length || 200);
    const sWidth = cmToPx(s.width || 100);
    let minDistance = 40;
    let foundWallId = '';
    let foundSide = 1;
    let foundOffset = 0;

    floor.walls.forEach(wall => {
      const dist = getDistanceToSegment({ x: newX, y: newY }, wall.start, wall.end);
      const dimensionDiff = Math.abs(sHeight - sWidth) / 2;
      const bias = (wall.id === s.attachedWallId) ? dimensionDiff + 20 : 0;
      
      if (dist - bias < minDistance) {
        minDistance = dist - bias;
        foundWallId = wall.id;
        
        const wallLen = getDistance(wall.start, wall.end);
        const wdx = wall.end.x - wall.start.x;
        const wdy = wall.end.y - wall.start.y;
        const t = ((newX - wall.start.x) * wdx + (newY - wall.start.y) * wdy) / (wallLen * wallLen);
        
        const halfLengthOffset = (sHeight / 2) / wallLen;
        if (halfLengthOffset >= 0.5) {
          foundOffset = 0.5;
        } else {
          foundOffset = Math.max(halfLengthOffset, Math.min(1 - halfLengthOffset, t));
        }
        
        const projX = wall.start.x + foundOffset * wdx;
        const projY = wall.start.y + foundOffset * wdy;

        const nx = -wdy / wallLen;
        const ny = wdx / wallLen;
        const dot = (newX - projX) * nx + (newY - projY) * ny;
        foundSide = dot >= 0 ? 1 : -1;
      }
    });

    if (foundWallId) {
      const wall = floor.walls.find(w => w.id === foundWallId)!;
      const wallLen = getDistance(wall.start, wall.end);
      const wdx = wall.end.x - wall.start.x;
      const wdy = wall.end.y - wall.start.y;
      const nx = -wdy / wallLen;
      const ny = wdx / wallLen;
      const thickness = cmToPx(wall.thickness);
      
      // Allow moving along the wall if not explicitly locked (though user said they are too locked)
      // The issue might be that handleStairsDragMove is called on every move and it snaps too aggressively.
      // We should allow some "freedom" to move along the offset.
      
      newX = wall.start.x + wdx * foundOffset + nx * foundSide * (thickness / 2 + sWidth / 2);
      newY = wall.start.y + wdy * foundOffset + ny * foundSide * (thickness / 2 + sWidth / 2);
      
      nearestWallId = foundWallId;
      nearestWallSide = foundSide;
      nearestWallOffset = foundOffset;
      
      const angle1 = getAngle(wall.start, wall.end) + 90 + (foundSide === -1 ? 180 : 0);
      const angle2 = angle1 + 180;
      
      const normalize = (a: number) => ((a % 360) + 360) % 360;
      const currentRot = normalize(s.rotation || 0);
      const diff1 = Math.abs(normalize(angle1) - currentRot);
      const diff2 = Math.abs(normalize(angle2) - currentRot);
      
      const minDiff1 = Math.min(diff1, 360 - diff1);
      const minDiff2 = Math.min(diff2, 360 - diff2);
      
      rotation = minDiff1 < minDiff2 ? angle1 : angle2;
    } else {
      nearestWallId = undefined;
      nearestWallSide = undefined;
      nearestWallOffset = undefined;
      rotation = s.rotation;
    }

    return { x: newX, y: newY, rotation, attachedWallId: nearestWallId, attachedWallSide: nearestWallSide, attachedWallOffset: nearestWallOffset };
  };

  const handleStairsDragEnd = (id: string, e: any) => {
    const stairs = currentFloor.stairs.find(s => s.id === id);
    if (!stairs) return;

    const result = handleStairsDragMove(id, e);
    if (!result) return;

    const dx = result.x - stairs.x;
    const dy = result.y - stairs.y;

    const idsToMove = selectedIds.includes(id) ? selectedIds : [id];

    updateCurrentFloor(floor => {
      const newStairs = floor.stairs.map(s => {
        if (idsToMove.includes(s.id)) {
          if (s.id === id) {
            return {
              ...s,
              x: result.x,
              y: result.y,
              rotation: result.rotation,
              attachedWallId: result.attachedWallId,
              attachedWallSide: result.attachedWallSide,
              attachedWallOffset: result.attachedWallOffset
            };
          } else {
            return {
              ...s,
              x: s.x + dx,
              y: s.y + dy
            };
          }
        }
        return s;
      });

      return {
        ...floor,
        stairs: newStairs
      };
    });
  };

  const handleOpeningDragEnd = (id: string, e: any) => {
    const opening = currentFloor.openings.find(o => o.id === id);
    if (!opening) return;

    const stage = e.target.getStage();
    const transform = stage.getAbsoluteTransform().copy();
    transform.invert();
    const pos = transform.point(e.target.absolutePosition());
    
    // Find nearest wall
    let nearestWallId = opening.wallId;
    let minDistance = Infinity;
    let bestT = 0.5;

    currentFloor.walls.forEach(wall => {
      const wallLen = getDistance(wall.start, wall.end);
      if (wallLen === 0) return;
      
      const dx = wall.end.x - wall.start.x;
      const dy = wall.end.y - wall.start.y;
      
      let t = ((pos.x - wall.start.x) * dx + (pos.y - wall.start.y) * dy) / (wallLen * wallLen);
      t = Math.max(0, Math.min(1, t));
      
      const projectedPoint = {
        x: wall.start.x + dx * t,
        y: wall.start.y + dy * t
      };
      
      const dist = getDistance(pos, projectedPoint);
      if (dist < minDistance) {
        minDistance = dist;
        nearestWallId = wall.id;
        bestT = t;
      }
    });

    updateCurrentFloor(floor => ({
      ...floor,
      openings: floor.openings.map(o => o.id === id ? { ...o, wallId: nearestWallId, position: bestT } : o)
    }));
  };

  const renderGrid = () => {
    if (!project.showGrid) return null;
    const lines = [];
    const size = project.gridSize;
    const subSize = size / 2;
    const countX = 200; // Large enough for zoom/pan
    const countY = 200;

    for (let i = -countX; i < countX; i++) {
      lines.push(
        <Line
          key={`v-${i}`}
          points={[i * subSize, -countY * subSize, i * subSize, countY * subSize]}
          stroke="#141414"
          strokeWidth={i % 2 === 0 ? 0.1 : 0.05}
          listening={false}
        />
      );
    }
    for (let i = -countY; i < countY; i++) {
      lines.push(
        <Line
          key={`h-${i}`}
          points={[-countX * subSize, i * subSize, countX * subSize, i * subSize]}
          stroke="#141414"
          strokeWidth={i % 2 === 0 ? 0.1 : 0.05}
          listening={false}
        />
      );
    }
    return (
      <Group name="grid-layer" visible={project.showGrid}>
        {lines}
      </Group>
    );
  };

  const renderFurnitureItem = (f: Furniture) => {
    const isSelected = selectedIds.includes(f.id);
    const width = cmToPx(f.width);
    const height = cmToPx(f.height);
    const strokeColor = isSelected ? '#3B82F6' : '#141414';
    const strokeW = isSelected ? 2 : 1;

    const getTextureFill = (texture?: string, color?: string) => {
      return color || "#F3F4F6";
    };

    return (
      <Group>
        {/* Shadow/Depth effect */}
        <Rect
          x={-width/2 + 2}
          y={-height/2 + 2}
          width={width}
          height={height}
          fill="rgba(0,0,0,0.1)"
          cornerRadius={4}
        />
        
        {/* Furniture specific details */}
        {f.type === 'swing' && (
          <Group>
            {/* A-frame legs (Left) */}
            <Line points={[-width/2, -height/2, -width/2 + 10, 0]} stroke="#4B2C20" strokeWidth={3} />
            <Line points={[-width/2, height/2, -width/2 + 10, 0]} stroke="#4B2C20" strokeWidth={3} />
            {/* A-frame legs (Right) */}
            <Line points={[width/2, -height/2, width/2 - 10, 0]} stroke="#4B2C20" strokeWidth={3} />
            <Line points={[width/2, height/2, width/2 - 10, 0]} stroke="#4B2C20" strokeWidth={3} />
            {/* Top Bar */}
            <Line points={[-width/2 + 10, 0, width/2 - 10, 0]} stroke="#3E2723" strokeWidth={6} />
            {/* Seats */}
            <Rect x={-width/4 - 15} y={-10} width={30} height={20} fill="#D2B48C" stroke={strokeColor} strokeWidth={1} cornerRadius={2} />
            <Rect x={width/4 - 15} y={-10} width={30} height={20} fill="#D2B48C" stroke={strokeColor} strokeWidth={1} cornerRadius={2} />
            {/* Chains/Ropes */}
            <Line points={[-width/4 - 10, 0, -width/4 - 10, -5]} stroke="#8B4513" strokeWidth={1} />
            <Line points={[-width/4 + 10, 0, -width/4 + 10, -5]} stroke="#8B4513" strokeWidth={1} />
            <Line points={[width/4 - 10, 0, width/4 - 10, -5]} stroke="#8B4513" strokeWidth={1} />
            <Line points={[width/4 + 10, 0, width/4 + 10, -5]} stroke="#8B4513" strokeWidth={1} />
          </Group>
        )}

        {f.type.startsWith('bed') && (
          <Group>
            {/* Bed Frame */}
            <Rect x={-width/2} y={-height/2} width={width} height={height} fill="#F5F5DC" stroke={strokeColor} strokeWidth={strokeW} cornerRadius={4} />
            {/* Mattress */}
            <Rect x={-width/2 + 4} y={-height/2 + 4} width={width - 8} height={height - 8} fill="#FFFFFF" stroke="#E0E0E0" strokeWidth={1} cornerRadius={2} />
            {/* Pillows */}
            {f.type === 'bed_double' ? (
              <>
                <Rect x={-width/2 + 10} y={-height/2 + 10} width={(width-30)/2} height={height/6} fill="#F0F8FF" stroke={strokeColor} strokeWidth={1} cornerRadius={4} />
                <Rect x={5} y={-height/2 + 10} width={(width-30)/2} height={height/6} fill="#F0F8FF" stroke={strokeColor} strokeWidth={1} cornerRadius={4} />
              </>
            ) : (
              <Rect x={-width/2 + 10} y={-height/2 + 10} width={width - 20} height={height/6} fill="#F0F8FF" stroke={strokeColor} strokeWidth={1} cornerRadius={4} />
            )}
            {/* Blanket */}
            <Rect x={-width/2 + 2} y={-height/2 + height/3} width={width - 4} height={height - height/3 - 2} fill="#E6E6FA" stroke={strokeColor} strokeWidth={1} cornerRadius={2} />
            <Line points={[-width/2 + 2, -height/2 + height/3 + 10, width/2 - 2, -height/2 + height/3 + 10]} stroke={strokeColor} strokeWidth={0.5} opacity={0.3} />
          </Group>
        )}

        {f.type === 'wardrobe' && (
          <Group>
            <Rect x={-width/2} y={-height/2} width={width} height={height} fill="#DEB887" stroke={strokeColor} strokeWidth={strokeW} cornerRadius={2} />
            <Rect x={-width/2 + 2} y={-height/2 + 2} width={width/2 - 2} height={height - 4} fill="#F5DEB3" stroke={strokeColor} strokeWidth={1} />
            <Rect x={0} y={-height/2 + 2} width={width/2 - 2} height={height - 4} fill="#F5DEB3" stroke={strokeColor} strokeWidth={1} />
            {/* Handles */}
            <Line points={[-5, -10, -5, 10]} stroke={strokeColor} strokeWidth={2} />
            <Line points={[5, -10, 5, 10]} stroke={strokeColor} strokeWidth={2} />
          </Group>
        )}

        {f.type.startsWith('sofa') && (
          <Group>
            {/* Base */}
            <Rect x={-width/2} y={-height/2} width={width} height={height} fill="#D3D3D3" stroke={strokeColor} strokeWidth={strokeW} cornerRadius={8} />
            {/* Armrests - Thinner */}
            <Rect x={-width/2} y={-height/2} width={width/10} height={height} fill="#C0C0C0" stroke={strokeColor} strokeWidth={1} cornerRadius={4} />
            <Rect x={width/2 - width/10} y={-height/2} width={width/10} height={height} fill="#C0C0C0" stroke={strokeColor} strokeWidth={1} cornerRadius={4} />
            {/* Backrest - Shallower */}
            <Rect x={-width/2 + width/10} y={-height/2} width={width - width/5} height={height/5} fill="#C0C0C0" stroke={strokeColor} strokeWidth={1} cornerRadius={4} />
            {/* Seat Cushions - Larger */}
            {f.type === 'sofa' ? (
              <>
                <Rect x={-width/2 + width/10 + 2} y={-height/2 + height/5 + 2} width={(width - width/5)/3 - 2} height={height - height/5 - 4} fill="#E8E8E8" stroke={strokeColor} strokeWidth={1} cornerRadius={4} />
                <Rect x={-width/2 + width/10 + (width - width/5)/3 + 2} y={-height/2 + height/5 + 2} width={(width - width/5)/3 - 2} height={height - height/5 - 4} fill="#E8E8E8" stroke={strokeColor} strokeWidth={1} cornerRadius={4} />
                <Rect x={-width/2 + width/10 + 2*(width - width/5)/3 + 2} y={-height/2 + height/5 + 2} width={(width - width/5)/3 - 4} height={height - height/5 - 4} fill="#E8E8E8" stroke={strokeColor} strokeWidth={1} cornerRadius={4} />
              </>
            ) : (
              <>
                <Rect x={-width/2 + width/10 + 2} y={-height/2 + height/5 + 2} width={(width - width/5)/2 - 2} height={height - height/5 - 4} fill="#E8E8E8" stroke={strokeColor} strokeWidth={1} cornerRadius={4} />
                <Rect x={0 + 1} y={-height/2 + height/5 + 2} width={(width - width/5)/2 - 4} height={height - height/5 - 4} fill="#E8E8E8" stroke={strokeColor} strokeWidth={1} cornerRadius={4} />
              </>
            )}
          </Group>
        )}

        {f.type === 'chaiselongue' && (
          <Group>
            {/* Main body */}
            <Rect x={-width/2} y={-height/2} width={width} height={height*0.55} fill="#D3D3D3" stroke={strokeColor} strokeWidth={strokeW} cornerRadius={8} />
            {/* Extension */}
            <Rect x={width/2 - width*0.35} y={-height/2} width={width*0.35} height={height} fill="#D3D3D3" stroke={strokeColor} strokeWidth={strokeW} cornerRadius={8} />
            {/* Backrest - Shallower */}
            <Rect x={-width/2} y={-height/2} width={width} height={height*0.15} fill="#C0C0C0" stroke={strokeColor} strokeWidth={1} cornerRadius={4} />
            {/* Armrests - Thinner */}
            <Rect x={-width/2} y={-height/2} width={width*0.08} height={height*0.55} fill="#C0C0C0" stroke={strokeColor} strokeWidth={1} cornerRadius={4} />
            <Rect x={width/2 - width*0.08} y={-height/2} width={width*0.08} height={height} fill="#C0C0C0" stroke={strokeColor} strokeWidth={1} cornerRadius={4} />
            {/* Cushions - Adjusted */}
            <Rect x={-width/2 + width*0.08 + 2} y={-height/2 + height*0.15 + 2} width={width*0.57 - 4} height={height*0.4 - 4} fill="#E8E8E8" stroke={strokeColor} strokeWidth={1} cornerRadius={4} />
            <Rect x={width/2 - width*0.35 + 2} y={-height/2 + height*0.15 + 2} width={width*0.27 - 4} height={height*0.85 - 4} fill="#E8E8E8" stroke={strokeColor} strokeWidth={1} cornerRadius={4} />
          </Group>
        )}

        {f.type === 'armchair' && (
          <Group>
            <Rect x={-width/2} y={-height/2} width={width} height={height} fill="#D3D3D3" stroke={strokeColor} strokeWidth={strokeW} cornerRadius={8} />
            <Rect x={-width/2} y={-height/2} width={width/5} height={height} fill="#C0C0C0" stroke={strokeColor} strokeWidth={1} cornerRadius={4} />
            <Rect x={width/2 - width/5} y={-height/2} width={width/5} height={height} fill="#C0C0C0" stroke={strokeColor} strokeWidth={1} cornerRadius={4} />
            <Rect x={-width/2 + width/5} y={-height/2} width={width - 2*width/5} height={height/3} fill="#C0C0C0" stroke={strokeColor} strokeWidth={1} cornerRadius={4} />
            <Rect x={-width/2 + width/5 + 2} y={-height/2 + height/3 + 2} width={width - 2*width/5 - 4} height={height - height/3 - 4} fill="#E8E8E8" stroke={strokeColor} strokeWidth={1} cornerRadius={4} />
          </Group>
        )}

        {f.type === 'dining_table' && (() => {
          const chairSpace = cmToPx(60);
          const numChairsX = Math.floor(width / chairSpace);
          const numChairsY = Math.floor(height / chairSpace);
          
          const chairs = [];
          
          // Top and Bottom chairs
          if (numChairsX > 0) {
            const spacingX = width / (numChairsX + 1);
            for (let i = 1; i <= numChairsX; i++) {
              const cx = -width/2 + i * spacingX;
              chairs.push(
                <Group key={`top-${i}`} x={cx} y={-height/2 - 10} rotation={0}>
                  <Rect x={-12} y={-10} width={24} height={20} fill="#D2B48C" stroke={strokeColor} strokeWidth={1} cornerRadius={4} />
                  <Rect x={-10} y={-10} width={20} height={5} fill="#A0522D" stroke={strokeColor} strokeWidth={1} cornerRadius={2} />
                </Group>
              );
              chairs.push(
                <Group key={`bottom-${i}`} x={cx} y={height/2 + 10} rotation={180}>
                  <Rect x={-12} y={-10} width={24} height={20} fill="#D2B48C" stroke={strokeColor} strokeWidth={1} cornerRadius={4} />
                  <Rect x={-10} y={-10} width={20} height={5} fill="#A0522D" stroke={strokeColor} strokeWidth={1} cornerRadius={2} />
                </Group>
              );
            }
          }
          
          // Left and Right chairs
          if (numChairsY > 0) {
            const spacingY = height / (numChairsY + 1);
            for (let i = 1; i <= numChairsY; i++) {
              const cy = -height/2 + i * spacingY;
              chairs.push(
                <Group key={`left-${i}`} x={-width/2 - 10} y={cy} rotation={-90}>
                  <Rect x={-12} y={-10} width={24} height={20} fill="#D2B48C" stroke={strokeColor} strokeWidth={1} cornerRadius={4} />
                  <Rect x={-10} y={-10} width={20} height={5} fill="#A0522D" stroke={strokeColor} strokeWidth={1} cornerRadius={2} />
                </Group>
              );
              chairs.push(
                <Group key={`right-${i}`} x={width/2 + 10} y={cy} rotation={90}>
                  <Rect x={-12} y={-10} width={24} height={20} fill="#D2B48C" stroke={strokeColor} strokeWidth={1} cornerRadius={4} />
                  <Rect x={-10} y={-10} width={20} height={5} fill="#A0522D" stroke={strokeColor} strokeWidth={1} cornerRadius={2} />
                </Group>
              );
            }
          }

          return (
            <Group>
              {chairs}
              {/* Table */}
              <Rect x={-width/2} y={-height/2} width={width} height={height} fill="#DEB887" stroke={strokeColor} strokeWidth={strokeW} cornerRadius={8} />
              {/* Centerpiece */}
              <Circle x={0} y={0} radius={10} fill="#90EE90" stroke={strokeColor} strokeWidth={1} />
            </Group>
          );
        })()}

        {f.type === 'dining_table_round' && (() => {
          const diameter = Math.min(width, height);
          const radius = diameter / 2;
          const chairSpace = cmToPx(60);
          const perimeter = Math.PI * diameter;
          const numChairs = Math.max(1, Math.floor(perimeter / chairSpace));
          
          const chairs = [];
          for (let i = 0; i < numChairs; i++) {
            const angle = (i * 360) / numChairs;
            const rad = (angle * Math.PI) / 180;
            const cx = Math.sin(rad) * (radius + 10);
            const cy = -Math.cos(rad) * (radius + 10);
            
            chairs.push(
              <Group key={`chair-${i}`} x={cx} y={cy} rotation={angle}>
                <Rect x={-12} y={-10} width={24} height={20} fill="#D2B48C" stroke={strokeColor} strokeWidth={1} cornerRadius={4} />
                <Rect x={-10} y={-10} width={20} height={5} fill="#A0522D" stroke={strokeColor} strokeWidth={1} cornerRadius={2} />
              </Group>
            );
          }

          return (
            <Group>
              {chairs}
              {/* Round Table */}
              <Circle x={0} y={0} radius={radius} fill="#DEB887" stroke={strokeColor} strokeWidth={strokeW} />
              {/* Centerpiece */}
              <Circle x={0} y={0} radius={10} fill="#90EE90" stroke={strokeColor} strokeWidth={1} />
            </Group>
          );
        })()}

        {f.type === 'coffee_table' && (
          <Group>
            {/* Coffee Table */}
            <Rect x={-width/2} y={-height/2} width={width} height={height} fill="#E8DCC4" stroke={strokeColor} strokeWidth={strokeW} cornerRadius={12} />
            {/* Glass reflection line */}
            <Line points={[-width/2 + 10, -height/2 + 10, width/2 - 10, -height/2 + 10]} stroke="#FFFFFF" strokeWidth={2} opacity={0.5} />
          </Group>
        )}

        {f.type === 'chair' && (
          <Group>
            <Rect x={-width/2} y={-height/2} width={width} height={height} fill="#F5F5DC" stroke={strokeColor} strokeWidth={strokeW} cornerRadius={4} />
            <Rect x={-width/2} y={-height/2} width={width} height={height/4} fill="#DEB887" stroke={strokeColor} strokeWidth={1} cornerRadius={2} />
          </Group>
        )}

        {f.type === 'toilet' && (
          <Group>
            {/* Modern Monoblock Toilet - More Geometric */}
            {/* Tank / Back part - Narrower */}
            <Rect 
              x={-width/2} 
              y={-height/2} 
              width={width} 
              height={height/4} 
              fill="#FFFFFF" 
              stroke={strokeColor} 
              strokeWidth={strokeW} 
              cornerRadius={2} 
            />
            {/* Bowl - Less Curvy */}
            <Rect 
              x={-width/2.5} 
              y={-height/4} 
              width={width/1.25} 
              height={height/1.2} 
              fill="#FFFFFF" 
              stroke={strokeColor} 
              strokeWidth={strokeW} 
              cornerRadius={4} 
            />
            {/* Seat Detail - Simplified */}
            <Rect 
              x={-width/3.5} 
              y={-height/10} 
              width={width/1.75} 
              height={height/1.8} 
              fill="#F0F8FF" 
              stroke={strokeColor} 
              strokeWidth={0.5} 
              opacity={0.5}
              cornerRadius={2}
            />
            {/* Modern Flush Button */}
            <Rect x={-width/6} y={-height/2 + 5} width={width/3} height={4} fill="#E5E7EB" stroke={strokeColor} strokeWidth={0.5} cornerRadius={2} />
          </Group>
        )}

        {f.type === 'desk' && (
          <Group>
            {/* Table Top */}
            <Rect x={-width/2} y={-height/2} width={width} height={height} fill="#DEB887" stroke={strokeColor} strokeWidth={strokeW} cornerRadius={2} />
            {/* Monitor */}
            <Rect x={-width/4} y={-height/2 + 5} width={width/2} height={5} fill="#333" stroke={strokeColor} strokeWidth={1} />
            <Rect x={-width/8} y={-height/2 + 10} width={width/4} height={2} fill="#333" />
            {/* Keyboard */}
            <Rect x={-width/4} y={height/4} width={width/2} height={height/4} fill="#555" stroke={strokeColor} strokeWidth={0.5} cornerRadius={1} />
            {/* Mouse */}
            <Rect x={width/4 + 5} y={height/4 + 5} width={10} height={15} fill="#555" stroke={strokeColor} strokeWidth={0.5} cornerRadius={5} />
          </Group>
        )}

        {f.type === 'office_chair' && (
          <Group>
            {/* Base/Wheels */}
            <Circle x={0} y={0} radius={width/2} fill="transparent" stroke={strokeColor} strokeWidth={0.5} dash={[2, 2]} />
            <Line points={[-width/2, 0, width/2, 0]} stroke={strokeColor} strokeWidth={1} />
            <Line points={[0, -height/2, 0, height/2]} stroke={strokeColor} strokeWidth={1} />
            {/* Seat */}
            <Rect x={-width/2.5} y={-height/2.5} width={width/1.25} height={height/1.25} fill="#333" stroke={strokeColor} strokeWidth={strokeW} cornerRadius={8} />
            {/* Backrest */}
            <Rect x={-width/2.5} y={-height/2.5} width={width/1.25} height={height/4} fill="#222" stroke={strokeColor} strokeWidth={1} cornerRadius={4} />
            {/* Armrests */}
            <Rect x={-width/2} y={-height/4} width={width/10} height={height/2} fill="#222" stroke={strokeColor} strokeWidth={1} cornerRadius={2} />
            <Rect x={width/2 - width/10} y={-height/4} width={width/10} height={height/2} fill="#222" stroke={strokeColor} strokeWidth={1} cornerRadius={2} />
          </Group>
        )}

        {f.type === 'fridge' && (
          <Group>
            {/* Main Body */}
            <Rect x={-width/2} y={-height/2} width={width} height={height} fill="#F3F4F6" stroke={strokeColor} strokeWidth={strokeW} cornerRadius={4} />
            {/* Back cooling grill indicator */}
            <Rect x={-width/2 + 2} y={-height/2 + 2} width={width - 4} height={6} fill="#D1D5DB" stroke={strokeColor} strokeWidth={0.5} cornerRadius={1} />
            {/* Front Door handle (top view) */}
            <Rect x={-width/2 + 5} y={height/2 - 6} width={width/2.5} height={4} fill="#9CA3AF" stroke={strokeColor} strokeWidth={0.5} cornerRadius={2} />
          </Group>
        )}

        {f.type === 'washing_machine' && (
          <Group>
            <Rect x={-width/2} y={-height/2} width={width} height={height} fill="#FFFFFF" stroke={strokeColor} strokeWidth={strokeW} cornerRadius={4} />
            {/* Drum */}
            <Circle x={0} y={height/6} radius={width/3} stroke={strokeColor} strokeWidth={1} fill="#F3F4F6" />
            <Circle x={0} y={height/6} radius={width/4} stroke={strokeColor} strokeWidth={0.5} opacity={0.3} />
            {/* Controls */}
            <Rect x={-width/2 + 5} y={-height/2 + 5} width={width - 10} height={height/5} fill="#E5E7EB" stroke={strokeColor} strokeWidth={0.5} cornerRadius={2} />
            <Circle x={-width/4} y={-height/2 + 10} radius={3} fill="#3B82F6" />
          </Group>
        )}

        {f.type === 'dryer' && (
          <Group>
            <Rect x={-width/2} y={-height/2} width={width} height={height} fill="#FFFFFF" stroke={strokeColor} strokeWidth={strokeW} cornerRadius={4} />
            {/* Drum (Square-ish for dryer) */}
            <Rect x={-width/3} y={-height/10} width={width/1.5} height={height/1.5} stroke={strokeColor} strokeWidth={1} fill="#F3F4F6" cornerRadius={width/3} />
            {/* Controls */}
            <Rect x={-width/2 + 5} y={-height/2 + 5} width={width - 10} height={height/5} fill="#E5E7EB" stroke={strokeColor} strokeWidth={0.5} cornerRadius={2} />
            <Circle x={width/4} y={-height/2 + 10} radius={3} fill="#F97316" />
          </Group>
        )}

        {f.type === 'workbench' && (
          <Group>
            <Rect x={-width/2} y={-height/2} width={width} height={height} fill="#8B4513" stroke={strokeColor} strokeWidth={strokeW} cornerRadius={2} />
            {/* Vise */}
            <Rect x={-width/2} y={-height/4} width={15} height={height/2} fill="#4B5563" stroke={strokeColor} strokeWidth={1} />
            {/* Tool area */}
            <Rect x={-width/2 + 20} y={-height/2 + 5} width={width - 40} height={height - 10} fill="#A0522D" stroke={strokeColor} strokeWidth={0.5} opacity={0.5} />
          </Group>
        )}

        {f.type === 'shelf' && (
          <Group>
            <Rect x={-width/2} y={-height/2} width={width} height={height} fill="#4B5563" stroke={strokeColor} strokeWidth={strokeW} cornerRadius={1} />
            {/* Shelf lines */}
            <Line points={[-width/2, -height/4, width/2, -height/4]} stroke="#9CA3AF" strokeWidth={1} />
            <Line points={[-width/2, 0, width/2, 0]} stroke="#9CA3AF" strokeWidth={1} />
            <Line points={[-width/2, height/4, width/2, height/4]} stroke="#9CA3AF" strokeWidth={1} />
            {/* Items on shelf */}
            <Rect x={-width/3} y={-height/2 + 5} width={20} height={height/3} fill="#374151" />
            <Rect x={0} y={-height/2 + 5} width={30} height={height/3} fill="#374151" />
          </Group>
        )}

        {f.type === 'bathroom_sink' && (
          <Group>
            {/* Modern Minimalist Vanity/Sink - Fewer Borders */}
            <Rect x={-width/2} y={-height/2} width={width} height={height} fill="#FFFFFF" stroke={strokeColor} strokeWidth={strokeW} cornerRadius={1} />
            {/* Basin - Integrated look */}
            <Rect 
              x={-width/2 + 4} 
              y={-height/2 + 6} 
              width={width - 8} 
              height={height - 12} 
              fill="#F0F8FF" 
              stroke={strokeColor} 
              strokeWidth={0.5} 
              cornerRadius={2} 
            />
            {/* Modern Faucet */}
            <Rect x={-width/10} y={-height/2 + 1} width={width/5} height={4} fill="#9CA3AF" cornerRadius={1} />
            <Rect x={-1} y={-height/2 + 1} width={2} height={8} fill="#9CA3AF" />
          </Group>
        )}

        {f.type === 'shower' && (
          <Group>
            <Rect x={-width/2} y={-height/2} width={width} height={height} fill="#F0F8FF" stroke={strokeColor} strokeWidth={strokeW} cornerRadius={2} />
            <Line points={[-width/2, -height/2, width/2, height/2]} stroke={strokeColor} strokeWidth={0.5} opacity={0.5} />
            <Line points={[width/2, -height/2, -width/2, height/2]} stroke={strokeColor} strokeWidth={0.5} opacity={0.5} />
            <Circle x={0} y={0} radius={8} fill="#C0C0C0" stroke={strokeColor} strokeWidth={1} />
          </Group>
        )}

        {f.type === 'bathtub' && (
          <Group>
            <Rect x={-width/2} y={-height/2} width={width} height={height} fill="#FFFFFF" stroke={strokeColor} strokeWidth={strokeW} cornerRadius={4} />
            <Rect x={-width/2 + 8} y={-height/2 + 8} width={width - 16} height={height - 16} fill="#F0F8FF" stroke={strokeColor} strokeWidth={1} cornerRadius={20} />
            <Circle x={-width/2 + 20} y={0} radius={5} fill="#C0C0C0" stroke={strokeColor} strokeWidth={1} />
          </Group>
        )}

        {f.type === 'stove' && (
          <Group>
            <Rect x={-width/2} y={-height/2} width={width} height={height} fill="#C0C0C0" stroke={strokeColor} strokeWidth={strokeW} />
            {[...Array(4)].map((_, i) => (
              <Circle 
                key={i}
                x={i % 2 === 0 ? -width/4 : width/4}
                y={i < 2 ? -height/4 : height/4}
                radius={width/6}
                fill="#141414"
                stroke={strokeColor}
                strokeWidth={1}
                opacity={0.8}
              />
            ))}
          </Group>
        )}

        {f.type === 'sink' && (
          <Group>
            {/* Modern Undermount Kitchen Sink - Fewer Borders */}
            <Rect x={-width/2} y={-height/2} width={width} height={height} fill="#C0C0C0" stroke={strokeColor} strokeWidth={strokeW} />
            {/* Main Bowl */}
            <Rect 
              x={-width/2 + 2} 
              y={-height/2 + 6} 
              width={width - 4} 
              height={height - 8} 
              fill="#FFFFFF" 
              stroke={strokeColor} 
              strokeWidth={0.5} 
              cornerRadius={2} 
            />
            {/* Drain */}
            <Circle x={0} y={2} radius={width/15} fill="#9CA3AF" stroke={strokeColor} strokeWidth={0.5} />
            {/* Modern High-Arc Faucet */}
            <Group y={-height/2 + 5}>
              <Circle x={0} y={0} radius={4} fill="#9CA3AF" stroke={strokeColor} strokeWidth={0.5} />
              {/* Faucet body pointing towards the bowl */}
              <Rect x={-2} y={0} width={4} height={10} fill="#9CA3AF" stroke={strokeColor} strokeWidth={0.5} cornerRadius={2} />
              {/* Spout tip */}
              <Rect x={-2} y={9} width={8} height={3} fill="#9CA3AF" stroke={strokeColor} strokeWidth={0.5} cornerRadius={1} />
              {/* Faucet Handle */}
              <Rect x={-5} y={0} width={4} height={2} fill="#9CA3AF" stroke={strokeColor} strokeWidth={0.5} cornerRadius={1} />
            </Group>
          </Group>
        )}

        {f.type === 'fireplace' && (
          <Group>
            {/* Outer structure - Back is at -height/2 */}
            <Rect x={-width/2} y={-height/2} width={width} height={height} fill="#A0522D" stroke={strokeColor} strokeWidth={strokeW} cornerRadius={2} />
            {/* Firebox - Moved towards the front (bottom) */}
            <Rect x={-width/2 + 15} y={height/2 - 15} width={width - 30} height={10} fill="#333" stroke={strokeColor} strokeWidth={1} />
            {/* Fire/Glow */}
            <Rect x={-width/2 + 25} y={height/2 - 12} width={width - 50} height={8} fill="#F97316" opacity={0.6} />
            {/* Logs */}
            <Line points={[-width/4, height/2 - 5, width/4, height/2 - 10]} stroke="#78350F" strokeWidth={3} />
            <Line points={[width/4, height/2 - 5, -width/4, height/2 - 10]} stroke="#78350F" strokeWidth={3} />
            {/* Hearth - At the front (bottom) */}
            <Rect x={-width/2 - 5} y={height/2} width={width + 10} height={10} fill="#6B7280" stroke={strokeColor} strokeWidth={0.5} />
            {/* Mantelpiece - At the front (bottom) */}
            <Rect x={-width/2 - 5} y={height/2 - 5} width={width + 10} height={5} fill="#8B4513" stroke={strokeColor} strokeWidth={1} cornerRadius={2} />
          </Group>
        )}

        {f.type === 'nightstand' && (
          <Group>
            <Rect x={-width/2} y={-height/2} width={width} height={height} fill="#DEB887" stroke={strokeColor} strokeWidth={strokeW} cornerRadius={2} />
            {/* Drawer line */}
            <Line points={[-width/2 + 5, -height/6, width/2 - 5, -height/6]} stroke={strokeColor} strokeWidth={1} />
            {/* Handle */}
            <Circle x={0} y={-height/12} radius={3} fill="#C0C0C0" stroke={strokeColor} strokeWidth={0.5} />
            {/* Top detail */}
            <Rect x={-width/2 + 2} y={-height/2 + 2} width={width - 4} height={height - 4} fill="transparent" stroke={strokeColor} strokeWidth={0.5} opacity={0.3} />
            {/* Lamp */}
            <Circle x={width/4} y={-height/4} radius={6} fill="#FDE047" stroke={strokeColor} strokeWidth={0.5} />
            <Rect x={width/4 - 2} y={-height/4 + 6} width={4} height={4} fill="#141414" />
          </Group>
        )}

        {f.type === 'kitchen_counter' && (
          <Group>
            {/* Countertop - NO rounded corners */}
            <Rect x={-width/2} y={-height/2} width={width} height={height} fill={getTextureFill(f.texture, f.color)} stroke={strokeColor} strokeWidth={strokeW} />
            {/* Front edge detail */}
            <Line points={[-width/2, height/2 - 2, width/2, height/2 - 2]} stroke={strokeColor} strokeWidth={0.5} opacity={0.3} />
          </Group>
        )}

        {f.type === 'tv_unit' && (
          <Group>
            {/* Base unit */}
            <Rect x={-width/2} y={-height/2} width={width} height={height} fill="#8B4513" stroke={strokeColor} strokeWidth={strokeW} cornerRadius={2} />
            {/* TV Stand */}
            <Rect x={-15} y={-4} width={30} height={8} fill="#333333" stroke={strokeColor} strokeWidth={0.5} />
            {/* TV Screen (Thin) */}
            <Rect x={-width/2 + 20} y={-2} width={width - 40} height={4} fill="#1A1A1A" stroke={strokeColor} strokeWidth={1} cornerRadius={1} />
          </Group>
        )}

        {f.type === 'plant' && (
          <Group>
            {/* Shadow */}
            <Ellipse x={2} y={2} radiusX={width/4} radiusY={width/5} fill="#000" opacity={0.1} />
            {/* Pot */}
            <Circle x={0} y={0} radius={width/4} fill="#8B4513" stroke={strokeColor} strokeWidth={1} />
            <Circle x={0} y={0} radius={width/5} fill="#A0522D" stroke={strokeColor} strokeWidth={0.5} />
            {/* Leaves */}
            {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => {
              const rad = (angle * Math.PI) / 180;
              const leafSize = i % 2 === 0 ? width/3.5 : width/4.5;
              return (
                <Ellipse
                  key={i}
                  x={Math.cos(rad) * width/5}
                  y={Math.sin(rad) * width/5}
                  radiusX={leafSize}
                  radiusY={width/10}
                  rotation={angle}
                  fill="#22C55E"
                  stroke="#166534"
                  strokeWidth={0.5}
                />
              );
            })}
            {/* Center leaf */}
            <Circle x={0} y={0} radius={width/8} fill="#15803D" />
          </Group>
        )}

        {f.type === 'kitchen_stool' && (
          <Group>
            {/* Base ring */}
            <Circle x={0} y={0} radius={Math.min(width, height)/2} fill="transparent" stroke={strokeColor} strokeWidth={1} />
            {/* Seat */}
            <Circle x={0} y={0} radius={Math.min(width, height)/2 - 4} fill="#DEB887" stroke={strokeColor} strokeWidth={strokeW} />
            {/* Center detail */}
            <Circle x={0} y={0} radius={Math.min(width, height)/4} fill="#D2B48C" stroke={strokeColor} strokeWidth={0.5} />
          </Group>
        )}

        {f.type === 'car' && (
          <Group>
            <Rect x={-width/2} y={-height/2} width={width} height={height} fill="#A9A9A9" stroke={strokeColor} strokeWidth={strokeW} cornerRadius={20} />
            {/* Windshield */}
            <Rect x={-width/2 + width*0.2} y={-height/2 + 10} width={width*0.15} height={height - 20} fill="#87CEEB" stroke={strokeColor} strokeWidth={1} cornerRadius={4} />
            {/* Rear window */}
            <Rect x={width/2 - width*0.25} y={-height/2 + 10} width={width*0.1} height={height - 20} fill="#87CEEB" stroke={strokeColor} strokeWidth={1} cornerRadius={4} />
            {/* Roof */}
            <Rect x={-width/2 + width*0.35} y={-height/2 + 15} width={width*0.4} height={height - 30} fill="#808080" stroke={strokeColor} strokeWidth={1} cornerRadius={4} />
            {/* Wheels */}
            {[...Array(4)].map((_, i) => (
              <Rect 
                key={i}
                x={i < 2 ? -width/2 + 60 : width/2 - 100}
                y={i % 2 === 0 ? -height/2 - 5 : height/2 - 15}
                width={40}
                height={20}
                fill="#141414"
                cornerRadius={2}
              />
            ))}
          </Group>
        )}

        {f.type === 'bbq' && (
          <Group>
            <Rect x={-width/2} y={-height/2} width={width} height={height} fill="#374151" stroke={strokeColor} strokeWidth={strokeW} cornerRadius={4} />
            <Rect x={-width/2 + 5} y={-height/2 + 5} width={width - 10} height={height/2} fill="#1F2937" stroke={strokeColor} strokeWidth={0.5} cornerRadius={2} />
            <Line points={[-width/2 + 10, -height/2 + 10, width/2 - 10, -height/2 + 10]} stroke="#4B5563" strokeWidth={1} />
            <Line points={[-width/2 + 10, -height/2 + 15, width/2 - 10, -height/2 + 15]} stroke="#4B5563" strokeWidth={1} />
            <Circle x={-width/4} y={height/4} radius={5} fill="#9CA3AF" />
            <Circle x={width/4} y={height/4} radius={5} fill="#9CA3AF" />
          </Group>
        )}

        {f.type === 'sunbed' && (
          <Group>
            <Rect x={-width/2} y={-height/2} width={width} height={height} fill="#FFFFFF" stroke={strokeColor} strokeWidth={strokeW} cornerRadius={2} />
            <Rect x={-width/2 + 5} y={-height/2 + 5} width={width - 10} height={height/3} fill="#E5E7EB" stroke={strokeColor} strokeWidth={0.5} cornerRadius={1} />
            <Line points={[-width/2, -height/6, width/2, -height/6]} stroke={strokeColor} strokeWidth={0.5} />
            <Line points={[-width/2, height/6, width/2, height/6]} stroke={strokeColor} strokeWidth={0.5} />
          </Group>
        )}

        {f.type === 'pool' && (
          <Group>
            <Rect x={-width/2} y={-height/2} width={width} height={height} fill="#BAE6FD" stroke={strokeColor} strokeWidth={strokeW} cornerRadius={10} />
            <Rect x={-width/2 + 15} y={-height/2 + 15} width={width - 30} height={height - 30} fill="#7DD3FC" stroke="#0EA5E9" strokeWidth={0.5} cornerRadius={5} />
            {/* Steps */}
            <Rect x={-width/2 + 20} y={-height/2 + 20} width={40} height={10} fill="#F0F9FF" opacity={0.6} />
            <Rect x={-width/2 + 20} y={-height/2 + 30} width={40} height={10} fill="#F0F9FF" opacity={0.4} />
          </Group>
        )}

        {f.type === 'billiards' && (
          <Group>
            <Rect x={-width/2} y={-height/2} width={width} height={height} fill="#166534" stroke="#064E3B" strokeWidth={strokeW + 2} cornerRadius={4} />
            {/* Pockets */}
            <Circle x={-width/2 + 5} y={-height/2 + 5} radius={8} fill="#111" />
            <Circle x={width/2 - 5} y={-height/2 + 5} radius={8} fill="#111" />
            <Circle x={-width/2 + 5} y={height/2 - 5} radius={8} fill="#111" />
            <Circle x={width/2 - 5} y={height/2 - 5} radius={8} fill="#111" />
            <Circle x={0} y={-height/2 + 2} radius={6} fill="#111" />
            <Circle x={0} y={height/2 - 2} radius={6} fill="#111" />
            {/* Balls */}
            <Circle x={width/4} y={0} radius={3} fill="white" />
            <Circle x={-width/4} y={-10} radius={3} fill="red" />
            <Circle x={-width/4} y={10} radius={3} fill="yellow" />
          </Group>
        )}

        {f.type === 'foosball' && (
          <Group>
            <Rect x={-width/2} y={-height/2} width={width} height={height} fill="#15803D" stroke={strokeColor} strokeWidth={strokeW} cornerRadius={2} />
            {/* Bars - Vertical across the table */}
            {[-0.35, -0.15, 0.15, 0.35].map((pos, i) => {
              const isEven = i % 2 === 0;
              const barX = width * pos;
              return (
                <Group key={i}>
                  {/* Bar */}
                  <Line points={[barX, -height/2 - 15, barX, height/2 + 15]} stroke="#9CA3AF" strokeWidth={2} />
                  {/* Handles - Alternating sides */}
                  <Rect 
                    x={barX - 4} 
                    y={isEven ? -height/2 - 25 : height/2 + 15} 
                    width={8} 
                    height={10} 
                    fill="#451a03" 
                    cornerRadius={2} 
                  />
                  {/* Players (dots) */}
                  {[-0.3, 0, 0.3].map((pPos, j) => (
                    <Circle key={j} x={barX} y={height * pPos} radius={4} fill={isEven ? "red" : "blue"} />
                  ))}
                </Group>
              );
            })}
          </Group>
        )}

        {f.type === 'ping_pong' && (
          <Group>
            {/* Table Surface */}
            <Rect x={-width/2} y={-height/2} width={width} height={height} fill="#1E40AF" stroke={strokeColor} strokeWidth={strokeW} />
            {/* Perimeter Lines */}
            <Rect x={-width/2 + 2} y={-height/2 + 2} width={width - 4} height={height - 4} fill="transparent" stroke="white" strokeWidth={1} />
            {/* Center Line (Longitudinal) */}
            <Line points={[-width/2, 0, width/2, 0]} stroke="white" strokeWidth={1} />
            {/* Net */}
            <Rect x={-2} y={-height/2 - 10} width={4} height={height + 20} fill="#111" opacity={0.8} />
            <Line points={[0, -height/2 - 10, 0, height/2 + 10]} stroke="#FFFFFF" strokeWidth={0.5} dash={[2, 2]} />
          </Group>
        )}

        {f.type === 'arcade' && (
          <Group>
            <Rect x={-width/2} y={-height/2} width={width} height={height} fill="#1F2937" stroke={strokeColor} strokeWidth={strokeW} cornerRadius={2} />
            {/* Screen */}
            <Rect x={-width/2 + 5} y={-height/2 + 5} width={width - 10} height={height/2} fill="#000" stroke="#3B82F6" strokeWidth={1} />
            {/* Controls */}
            <Circle x={-width/4} y={height/4} radius={4} fill="red" />
            <Circle x={0} y={height/4} radius={3} fill="yellow" />
            <Circle x={width/4} y={height/4} radius={3} fill="green" />
          </Group>
        )}

        {/* Fallback for any other furniture type */}
        {!['bed_double', 'bed_single', 'wardrobe', 'sofa', 'sofa_2', 'chaiselongue', 'armchair', 'dining_table', 'dining_table_round', 'coffee_table', 'chair', 'toilet', 'bathroom_sink', 'shower', 'bathtub', 'stove', 'sink', 'fireplace', 'car', 'desk', 'office_chair', 'fridge', 'washing_machine', 'dryer', 'workbench', 'shelf', 'nightstand', 'kitchen_counter', 'plant', 'tv_unit', 'kitchen_stool', 'bbq', 'sunbed', 'pool', 'billiards', 'foosball', 'ping_pong', 'arcade', 'rug', 'swing'].includes(f.type) && (
          <Group>
            <Rect x={-width/2} y={-height/2} width={width} height={height} fill="#F5F5F5" stroke={strokeColor} strokeWidth={strokeW} cornerRadius={4} />
            <Line points={[-width/2, -height/2, width/2, height/2]} stroke={strokeColor} strokeWidth={0.5} opacity={0.3} />
            <Line points={[width/2, -height/2, -width/2, height/2]} stroke={strokeColor} strokeWidth={0.5} opacity={0.3} />
          </Group>
        )}
      </Group>
    );
  };

  const renderStairsItem = (s: Stairs, isArrival: boolean = false) => {
    const isSelected = selectedIds.includes(s.id);
    const strokeColor = isSelected ? '#3B82F6' : '#141414';
    const strokeW = isSelected ? 2 : 1;

    // Spiral stairs rendering
    if (s.type === StairsType.SPIRAL) {
      const radius = cmToPx(s.width / 2);
      const numSteps = s.steps || 14;
      return (
        <Group opacity={isArrival ? 0.3 : 1}>
          <Circle
            radius={radius}
            fill="white"
            stroke={strokeColor}
            strokeWidth={strokeW}
          />
          {[...Array(numSteps)].map((_, i) => {
            const angle = (i / numSteps) * 360;
            const rad = (angle * Math.PI) / 180;
            return (
              <Line
                key={i}
                points={[0, 0, radius * Math.cos(rad), radius * Math.sin(rad)]}
                stroke="#141414"
                strokeWidth={0.5}
              />
            );
          })}
          <Circle radius={radius * 0.2} fill="white" stroke="#141414" strokeWidth={0.5} />
          <Text
            text={s.direction === 'up' ? 'SUBE' : 'BAJA'}
            x={-15}
            y={radius + 5}
            fontSize={8}
            fontStyle="bold"
            fill="#141414"
            opacity={0.5}
          />
        </Group>
      );
    }

    // Multi-flight or standard rendering
    let flights = s.flights || [
      { id: 'default', width: s.width, length: s.length, steps: s.steps, x: 0, y: 0, rotation: 0 }
    ];

    if (s.type === StairsType.L_SHAPED && flights.length >= 2) {
      flights = [
        { ...flights[0], x: 0, y: 0, rotation: 0 },
        { 
          ...flights[1], 
          x: flights[0].width/2 + flights[1].length/2, 
          y: -flights[0].length/2 - flights[1].width/2, 
          rotation: 90 
        }
      ];
    } else if (s.type === StairsType.U_SHAPED && flights.length >= 2) {
      const landingWidth = s.landingWidth || s.width;
      flights = [
        { 
          ...flights[0], 
          x: -landingWidth/2 + flights[0].width/2, 
          y: 0, 
          rotation: 0 
        },
        { 
          ...flights[1], 
          x: landingWidth/2 - flights[1].width/2, 
          y: -flights[0].length/2 + flights[1].length/2, 
          rotation: 180 
        }
      ];
    }

    return (
      <Group opacity={isArrival ? 0.3 : 1}>
        {/* Landings */}
        {flights.length > 1 && (
          <Group>
            {s.type === StairsType.L_SHAPED && (
              <Group x={cmToPx(flights[0].x)} y={cmToPx(flights[0].y)} rotation={flights[0].rotation}>
                <Rect
                  x={-cmToPx(flights[0].width)/2}
                  y={-cmToPx(flights[0].length/2) - cmToPx(flights[1].width)}
                  width={cmToPx(flights[0].width)}
                  height={cmToPx(flights[1].width)}
                  fill="white"
                  stroke={strokeColor}
                  strokeWidth={strokeW}
                />
                <Text
                  text="DESC."
                  x={-cmToPx(flights[0].width)/2 + 5}
                  y={-cmToPx(flights[0].length/2) - cmToPx(flights[1].width) + 5}
                  fontSize={8}
                  fontStyle="bold"
                  fill="#141414"
                  opacity={0.3}
                />
                <Line
                  points={[
                    -cmToPx(flights[0].width)/2, -cmToPx(flights[0].length/2) - cmToPx(flights[1].width),
                    cmToPx(flights[0].width)/2, -cmToPx(flights[0].length/2)
                  ]}
                  stroke={strokeColor}
                  strokeWidth={strokeW}
                  opacity={0.3}
                />
                <Line
                  points={[
                    -cmToPx(flights[0].width)/2, -cmToPx(flights[0].length/2),
                    cmToPx(flights[0].width)/2, -cmToPx(flights[0].length/2) - cmToPx(flights[1].width)
                  ]}
                  stroke={strokeColor}
                  strokeWidth={strokeW}
                  opacity={0.3}
                />
              </Group>
            )}
            {s.type === StairsType.U_SHAPED && (
              <Group>
                <Rect
                  x={-cmToPx(s.landingWidth || s.width)/2}
                  y={-cmToPx(flights[0].length/2) - cmToPx(s.landingLength || s.width/4)}
                  width={cmToPx(s.landingWidth || s.width)}
                  height={cmToPx(s.landingLength || s.width/4)}
                  fill="white"
                  stroke={strokeColor}
                  strokeWidth={strokeW}
                />
                <Line
                  points={[
                    -cmToPx(s.landingWidth || s.width)/2, -cmToPx(flights[0].length/2) - cmToPx(s.landingLength || s.width/4),
                    cmToPx(s.landingWidth || s.width)/2, -cmToPx(flights[0].length/2)
                  ]}
                  stroke={strokeColor}
                  strokeWidth={strokeW}
                  opacity={0.3}
                />
                <Line
                  points={[
                    -cmToPx(s.landingWidth || s.width)/2, -cmToPx(flights[0].length/2),
                    cmToPx(s.landingWidth || s.width)/2, -cmToPx(flights[0].length/2) - cmToPx(s.landingLength || s.width/4)
                  ]}
                  stroke={strokeColor}
                  strokeWidth={strokeW}
                  opacity={0.3}
                />
              </Group>
            )}
          </Group>
        )}

        {flights.map((flight, idx) => {
          const w = cmToPx(flight.width);
          const l = cmToPx(flight.length);
          const n = flight.steps;
          const stepSize = l / n;

          return (
            <Group 
              key={flight.id} 
              x={cmToPx(flight.x)} 
              y={cmToPx(flight.y)} 
              rotation={flight.rotation}
            >
              <Rect
                x={-w/2}
                y={-l/2}
                width={w}
                height={l}
                fill="white"
                stroke={strokeColor}
                strokeWidth={strokeW}
              />
              {[...Array(n)].map((_, i) => (
                <Line
                  key={i}
                  points={[-w/2, -l/2 + i * stepSize, w/2, -l/2 + i * stepSize]}
                  stroke="#141414"
                  strokeWidth={0.5}
                />
              ))}
              
              {/* Direction Arrow on the first flight */}
              {idx === 0 && !isArrival && (
                <Group y={s.direction === 'up' ? l/2 - 10 : -l/2 + 10} rotation={s.direction === 'up' ? 0 : 180}>
                  <Line
                    points={[0, 0, 0, -l + 20]}
                    stroke="#141414"
                    strokeWidth={1}
                    dash={[5, 2]}
                  />
                  <Path
                    data="M -5 -5 L 0 -15 L 5 -5"
                    stroke="#141414"
                    strokeWidth={1}
                    y={-l + 20}
                  />
                  <Circle radius={3} fill="#141414" />
                </Group>
              )}
            </Group>
          );
        })}
        
        {/* Overall label */}
        <Text
          text={s.direction === 'up' ? 'SUBE' : 'BAJA'}
          x={-20}
          y={cmToPx(s.length/2) + 5}
          fontSize={8}
          fontStyle="bold"
          fill="#141414"
          opacity={0.5}
        />
      </Group>
    );
  };

  const renderOpening = (opening: any) => {
    const wall = currentFloor.walls.find(w => w.id === opening.wallId);
    if (!wall) return null;

    const isSelected = selectedIds.includes(opening.id);
    const angle = getAngle(wall.start, wall.end);
    const pos = {
      x: wall.start.x + (wall.end.x - wall.start.x) * opening.position,
      y: wall.start.y + (wall.end.y - wall.start.y) * opening.position
    };

    const width = cmToPx(opening.width);
    const thickness = cmToPx(wall.thickness);

    // Garage door rendering
    if (opening.subType === 'garage') {
      return (
        <Group 
          key={opening.id} 
          id={opening.id}
          x={pos.x} 
          y={pos.y} 
          rotation={angle}
          draggable={activeTool === ToolType.SELECT}
          onDragEnd={(e) => handleOpeningDragEnd(opening.id, e)}
          onClick={(e) => { 
            if (activeTool === ToolType.SELECT) {
              e.cancelBubble = true; 
              onSelect([opening.id]); 
            }
          }}
          onDblClick={(e) => { 
            if (activeTool === ToolType.SELECT) {
              e.cancelBubble = true; 
              onSelect([opening.id]); 
              onOpenProperties(); 
            }
          }}
        >
          <Rect
            x={-width/2}
            y={-thickness/2}
            width={width}
            height={thickness}
            fill="#F9F9F7"
            stroke={isSelected ? "#3b82f6" : "#141414"}
            strokeWidth={isSelected ? 2 : 1}
          />
          {/* Sectional door lines */}
          {[1, 2, 3, 4].map(i => (
            <Line
              key={i}
              points={[-width/2 + (width/5)*i, -thickness/2, -width/2 + (width/5)*i, thickness/2]}
              stroke="#141414"
              strokeWidth={0.5}
              opacity={0.3}
            />
          ))}
          <Line
            points={[-width/2, 0, width/2, 0]}
            stroke="#141414"
            strokeWidth={1}
            dash={[4, 2]}
          />
        </Group>
      );
    }

    const dragBoundFunc = (pos: any) => {
      if (!stageRef.current) return pos;
      const stage = stageRef.current;
      const transform = stage.getAbsoluteTransform().copy();
      transform.invert();
      const relativePos = transform.point(pos);

      let minDistance = Infinity;
      let bestPoint = relativePos;

      currentFloor.walls.forEach(w => {
        const wallLen = getDistance(w.start, w.end);
        if (wallLen === 0) return;
        
        const dx = w.end.x - w.start.x;
        const dy = w.end.y - w.start.y;
        
        let t = ((relativePos.x - w.start.x) * dx + (relativePos.y - w.start.y) * dy) / (wallLen * wallLen);
        t = Math.max(0, Math.min(1, t));
        
        const projectedPoint = {
          x: w.start.x + dx * t,
          y: w.start.y + dy * t
        };
        
        const dist = getDistance(relativePos, projectedPoint);
        if (dist < minDistance) {
          minDistance = dist;
          bestPoint = projectedPoint;
        }
      });

      return stage.getAbsoluteTransform().point(bestPoint);
    };

    return (
      <Group 
        key={opening.id} 
        x={pos.x} 
        y={pos.y} 
        rotation={angle} 
        scaleX={opening.scaleX || 1}
        scaleY={opening.scaleY || 1}
        onClick={(e) => { 
          if (activeTool === ToolType.SELECT) {
            e.cancelBubble = true; 
            onSelect([opening.id]); 
          }
        }}
        onDblClick={(e) => { 
          if (activeTool === ToolType.SELECT) {
            e.cancelBubble = true; 
            onSelect([opening.id]); 
            onOpenProperties(); 
          }
        }}
        draggable={activeTool === ToolType.SELECT}
        dragBoundFunc={dragBoundFunc}
        onDragEnd={(e) => handleOpeningDragEnd(opening.id, e)}
      >
        {opening.type === 'door' ? (
          <Group>
            {/* Door Frame/Opening in wall */}
            <Rect 
              width={cmToPx(opening.width)} 
              height={cmToPx(wall.thickness) + 2} 
              fill="white" 
              offsetX={cmToPx(opening.width) / 2} 
              offsetY={cmToPx(wall.thickness) / 2 + 1} 
            />
            {opening.subType.startsWith('sliding') ? (
              <Group>
                {opening.subType.includes('pocket') ? (
                  <Group>
                    {opening.isDouble ? (
                      <>
                        <Line points={[-cmToPx(opening.width) / 2, 0, -cmToPx(opening.width) / 10, 0]} stroke="#141414" strokeWidth={2} />
                        <Line points={[cmToPx(opening.width) / 2, 0, cmToPx(opening.width) / 10, 0]} stroke="#141414" strokeWidth={2} />
                      </>
                    ) : (
                      <Line points={[-cmToPx(opening.width) / 2, 0, cmToPx(opening.width) / 4, 0]} stroke="#141414" strokeWidth={2} />
                    )}
                  </Group>
                ) : (
                  <Group>
                    {opening.isDouble ? (
                      <>
                        <Line points={[-cmToPx(opening.width) / 2, -cmToPx(wall.thickness) / 2 - 4, -2, -cmToPx(wall.thickness) / 2 - 4]} stroke="#141414" strokeWidth={2} />
                        <Line points={[cmToPx(opening.width) / 2, -cmToPx(wall.thickness) / 2 - 4, 2, -cmToPx(wall.thickness) / 2 - 4]} stroke="#141414" strokeWidth={2} />
                        <Line points={[-cmToPx(opening.width) / 2, -cmToPx(wall.thickness) / 2 - 6, cmToPx(opening.width) / 2, -cmToPx(wall.thickness) / 2 - 6]} stroke="#141414" strokeWidth={0.5} opacity={0.3} />
                      </>
                    ) : (
                      <>
                        <Line points={[-cmToPx(opening.width) / 2, -cmToPx(wall.thickness) / 2 - 4, cmToPx(opening.width) / 2, -cmToPx(wall.thickness) / 2 - 4]} stroke="#141414" strokeWidth={2} />
                        <Line points={[-cmToPx(opening.width) / 2, -cmToPx(wall.thickness) / 2 - 6, cmToPx(opening.width) * 1.5, -cmToPx(wall.thickness) / 2 - 6]} stroke="#141414" strokeWidth={0.5} opacity={0.3} />
                      </>
                    )}
                  </Group>
                )}
              </Group>
            ) : opening.subType === 'sliding' ? (
              <Group>
                <Line 
                  points={[-cmToPx(opening.width) / 2, -2, 0, -2]} 
                  stroke="#141414" 
                  strokeWidth={2} 
                />
                <Line 
                  points={[0, 2, cmToPx(opening.width) / 2, 2]} 
                  stroke="#141414" 
                  strokeWidth={2} 
                />
              </Group>
            ) : opening.isDouble ? (
              <Group rotation={opening.openingDirection === 'right' ? 0 : -180}>
                {/* Left Door Leaf */}
                <Line 
                  points={[-cmToPx(opening.width) / 2, 0, -cmToPx(opening.width) / 2, -cmToPx(opening.width) / 2]} 
                  stroke="#141414" 
                  strokeWidth={2} 
                />
                {/* Right Door Leaf */}
                <Line 
                  points={[cmToPx(opening.width) / 2, 0, cmToPx(opening.width) / 2, -cmToPx(opening.width) / 2]} 
                  stroke="#141414" 
                  strokeWidth={2} 
                />
                {/* Left Arc */}
                <Path
                  data={`M ${-cmToPx(opening.width) / 2} ${-cmToPx(opening.width) / 2} A ${cmToPx(opening.width) / 2} ${cmToPx(opening.width) / 2} 0 0 1 0 0`}
                  stroke="#141414"
                  strokeWidth={0.5}
                  dash={[2, 2]}
                  listening={false}
                />
                {/* Right Arc */}
                <Path
                  data={`M ${cmToPx(opening.width) / 2} ${-cmToPx(opening.width) / 2} A ${cmToPx(opening.width) / 2} ${cmToPx(opening.width) / 2} 0 0 0 0 0`}
                  stroke="#141414"
                  strokeWidth={0.5}
                  dash={[2, 2]}
                  listening={false}
                />
              </Group>
            ) : (
              <Group rotation={opening.openingDirection === 'right' ? 0 : -180}>
                {/* Door Leaf */}
                <Line 
                  points={[cmToPx(opening.width) / 2, 0, cmToPx(opening.width) / 2, -cmToPx(opening.width)]} 
                  stroke="#141414" 
                  strokeWidth={2} 
                />
                {/* Opening Arc */}
                <Path 
                  data={`M ${cmToPx(opening.width) / 2} ${-cmToPx(opening.width)} A ${cmToPx(opening.width)} ${cmToPx(opening.width)} 0 0 0 ${-cmToPx(opening.width) / 2} 0`}
                  stroke="#141414" 
                  strokeWidth={0.5} 
                  dash={[2, 2]} 
                  listening={false}
                />
              </Group>
            )}
          </Group>
        ) : (
          <Group>
            {/* Exterior Sill (Alfeizar) */}
            <Rect 
              width={cmToPx(opening.width) + 10} 
              height={8} 
              fill="#F3F4F6" 
              stroke="#9CA3AF"
              strokeWidth={0.5}
              offsetX={(cmToPx(opening.width) + 10) / 2} 
              offsetY={cmToPx(wall.thickness) / 2 + 8} 
              cornerRadius={1}
            />
            {/* Window Frame */}
            <Rect 
              width={cmToPx(opening.width)} 
              height={cmToPx(wall.thickness)} 
              fill="white" 
              stroke="#141414"
              strokeWidth={1}
              offsetX={cmToPx(opening.width) / 2} 
              offsetY={cmToPx(wall.thickness) / 2} 
            />
            {/* Sliding Panes */}
            {/* Pane 1 (Inner/Top) */}
            <Rect 
              x={-cmToPx(opening.width) / 2 + 2}
              y={-cmToPx(wall.thickness) / 2 + 2}
              width={cmToPx(opening.width) / 2 + 4}
              height={cmToPx(wall.thickness) / 2 - 2}
              stroke="#141414"
              strokeWidth={0.8}
              fill="#F9FAFB"
            />
            {/* Pane 2 (Outer/Bottom) */}
            <Rect 
              x={-4}
              y={2}
              width={cmToPx(opening.width) / 2 + 2}
              height={cmToPx(wall.thickness) / 2 - 4}
              stroke="#141414"
              strokeWidth={0.8}
              fill="#F3F4F6"
            />
          </Group>
        )}
        {selectedIds.includes(opening.id) && (
          <Rect 
            width={cmToPx(opening.width) + 10} 
            height={cmToPx(wall.thickness) + 10} 
            stroke="#3b82f6" 
            strokeWidth={1} 
            dash={[5, 5]} 
            offsetX={(cmToPx(opening.width) + 10) / 2} 
            offsetY={(cmToPx(wall.thickness) + 10) / 2} 
          />
        )}
      </Group>
    );
  };

  const handleWheel = (e: any) => {
    e.evt.preventDefault();
    const stage = e.target.getStage();
    const oldScale = project.zoom;
    const pointer = stage.getPointerPosition();

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    const speed = 0.001;
    const newScale = Math.min(3, Math.max(0.1, oldScale - e.evt.deltaY * speed));

    onUpdateProject(prev => ({ ...prev, zoom: newScale }));

    const newPos = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    };
    setStagePos(newPos);
  };

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden">
      <Stage
        width={stageSize.width}
        height={stageSize.height}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onClick={handleStageClick}
        onDblClick={handleStageDoubleClick}
        onWheel={handleWheel}
        ref={stageRef}
        scaleX={project.zoom}
        scaleY={project.zoom}
        x={stagePos.x}
        y={stagePos.y}
        className="cursor-crosshair"
      >
        <Layer>
          {/* Grid */}
          {renderGrid()}

          {/* Ghost Floors (Walls only) */}
          {project.showGhostFloors && project.floors.map(floor => {
            if (floor.id === project.currentFloorId) return null;
            // If a specific ghost floor is selected, only show that one
            if (project.ghostFloorId && floor.id !== project.ghostFloorId) return null;
            
            return (
              <Group key={`ghost-${floor.id}`} opacity={0.15} listening={false}>
                {floor.walls.map(wall => (
                  <Line
                    key={`ghost-wall-${wall.id}`}
                    points={[wall.start.x, wall.start.y, wall.end.x, wall.end.y]}
                    stroke="#141414"
                    strokeWidth={wall.thickness}
                    lineCap="round"
                  />
                ))}
              </Group>
            );
          })}

          {/* Rooms */}
          {currentFloor.rooms.map((room) => {
            const isSelected = selectedIds.includes(room.id);
            const area = calculateArea(room.points, project.gridSize * 2);
            
            // Better floor colors
            const getFillColor = (color: string, texture?: string) => {
              if (color === '#9CA3AF') return 'rgba(156, 163, 175, 0.3)'; // Gray 400
              if (color === '#EC4899') return 'rgba(236, 72, 153, 0.3)';  // Pink 500
              if (color === '#22C55E') return 'rgba(34, 197, 94, 0.3)';   // Green 500
              if (color === '#3B82F6') return 'rgba(59, 130, 246, 0.3)';  // Blue 500
              if (color === '#F59E0B') return 'rgba(245, 158, 11, 0.3)';  // Amber 500
              if (color === '#8B5CF6') return 'rgba(139, 92, 246, 0.3)';  // Violet 500
              return color;
            };

            const center = room.points.reduce((acc, p) => ({ x: acc.x + p.x / room.points.length, y: acc.y + p.y / room.points.length }), { x: 0, y: 0 });
            const labelPos = room.labelPosition || center;
            
            return (
              <Group 
                key={room.id} 
                onClick={(e) => { 
                  if (activeTool === ToolType.SELECT) {
                    e.cancelBubble = true; 
                    onSelect([room.id]); 
                  }
                }}
                onDblClick={(e) => { 
                  if (activeTool === ToolType.SELECT) {
                    e.cancelBubble = true; 
                    onSelect([room.id]); 
                    onOpenProperties(); 
                  }
                }}
              >
                <Line
                  points={room.points.flatMap((p, i) => {
                    if (draggingRoomVertex && draggingRoomVertex.roomId === room.id && draggingRoomVertex.pointIndex === i) {
                      return [draggingRoomVertex.pos.x, draggingRoomVertex.pos.y];
                    }
                    return [p.x, p.y];
                  })}
                  fill={getFillColor(room.color, room.texture)}
                  opacity={0.8}
                  closed
                  stroke={isSelected ? "#3b82f6" : "#141414"}
                  strokeWidth={isSelected ? 2 : 0.5}
                  lineJoin="round"
                />
                <Group name="dimensions-layer" visible={project.showDimensions}>
                  <Group
                    x={labelPos.x}
                    y={labelPos.y}
                    draggable={activeTool === ToolType.SELECT && isSelected}
                    onDragEnd={(e) => handleRoomLabelDragEnd(room.id, e)}
                  >
                    <Text
                      x={-50}
                      y={-10}
                      text={`${room.name}\n${unit === 'm' ? `${area.toFixed(2)} m²` : `${(area * 10.7639).toFixed(2)} sq ft`}`}
                      fontSize={12}
                      fontFamily="serif"
                      fontStyle="italic"
                      align="center"
                      width={100}
                      fill={isSelected ? "#3b82f6" : "#141414"}
                    />
                  </Group>
                  {/* Dimension lines for room sides - Only show when selected to avoid duplication with walls */}
                  {isSelected && room.points.map((p, i) => {
                    const nextP = room.points[(i + 1) % room.points.length];
                    const currentP = (draggingRoomVertex && draggingRoomVertex.roomId === room.id && draggingRoomVertex.pointIndex === i) ? draggingRoomVertex.pos : p;
                    const nextCurrentP = (draggingRoomVertex && draggingRoomVertex.roomId === room.id && draggingRoomVertex.pointIndex === ((i + 1) % room.points.length)) ? draggingRoomVertex.pos : nextP;
                    
                    const dist = getDistance(currentP, nextCurrentP);
                    const mid = getMidpoint(currentP, nextCurrentP);
                    const angle = getAngle(currentP, nextCurrentP);
                    return (
                      <Text
                        key={`${room.id}-dim-${i}`}
                        x={mid.x}
                        y={mid.y}
                        text={formatMeasurement(dist, project.gridSize * 2)}
                        fontSize={8}
                        rotation={angle}
                        fill={isSelected ? "#3b82f6" : "#141414"}
                        opacity={0.8}
                        offsetY={15}
                        align="center"
                      />
                    );
                  })}
                  {/* Vertex handles for room */}
                  {isSelected && room.points.map((p, i) => (
                    <Circle
                      key={`${room.id}-vertex-${i}`}
                      x={p.x}
                      y={p.y}
                      radius={6}
                      fill="white"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      draggable
                      onDragMove={(e) => handleRoomVertexDragMove(room.id, i, e)}
                      onDragEnd={(e) => {
                        handleRoomVertexDragEnd(room.id, i, e);
                        // Reset the internal position of the circle to match the prop
                        // in case the snapToGrid doesn't change the actual React state
                        e.target.x(p.x);
                        e.target.y(p.y);
                      }}
                    />
                  ))}
                </Group>
              </Group>
            );
          })}
          {/* Walls */}
          {currentFloor.walls.map((wall) => {
            const isSelected = selectedIds.includes(wall.id);
            const thickness = cmToPx(wall.thickness);
            const dx = wall.end.x - wall.start.x;
            const dy = wall.end.y - wall.start.y;
            const length = Math.sqrt(dx * dx + dy * dy);
            
            if (length === 0) return null;

            const nx = -dy / length;
            const ny = dx / length;
            const offset = thickness / 2;

            // Calculate adjusted points for realistic joins
            let l1s = { x: wall.start.x + nx * offset, y: wall.start.y + ny * offset };
            let l1e = { x: wall.end.x + nx * offset, y: wall.end.y + ny * offset };
            let l2s = { x: wall.start.x - nx * offset, y: wall.start.y - ny * offset };
            let l2e = { x: wall.end.x - nx * offset, y: wall.end.y - ny * offset };

            const adjustEnd = (point: Point, isStart: boolean) => {
              const connections = currentFloor.walls.filter(w => w.id !== wall.id && (
                getDistance(w.start, point) < 1 || 
                getDistance(w.end, point) < 1 ||
                isPointOnSegment(point, w.start, w.end)
              ));

              let adjustedL1 = isStart ? l1s : l1e;
              let adjustedL2 = isStart ? l2s : l2e;
              
              const cornerConnections = connections.filter(w => getDistance(w.start, point) < 1 || getDistance(w.end, point) < 1);

              if (cornerConnections.length > 0) {
                // Angular sorting algorithm for N-way junctions
                const getFaces = (w: Wall, p: Point) => {
                  const isS = getDistance(w.start, p) < 1;
                  const op = isS ? w.end : w.start;
                  const dx = op.x - p.x;
                  const dy = op.y - p.y;
                  const len = Math.sqrt(dx*dx + dy*dy) || 1;
                  const nx = -dy/len;
                  const ny = dx/len;
                  const off = cmToPx(w.thickness) / 2;
                  return {
                    leftLine: {
                      s: { x: p.x + nx*off, y: p.y + ny*off },
                      e: { x: op.x + nx*off, y: op.y + ny*off }
                    },
                    rightLine: {
                      s: { x: p.x - nx*off, y: p.y - ny*off },
                      e: { x: op.x - nx*off, y: op.y - ny*off }
                    },
                    angle: Math.atan2(dy, dx)
                  };
                };

                const allWalls = [wall, ...cornerConnections];
                const faces = allWalls.map(w => ({ w, ...getFaces(w, point) }));
                faces.sort((a, b) => a.angle - b.angle);

                const myIndex = faces.findIndex(f => f.w.id === wall.id);
                const myFaces = faces[myIndex];
                const nextFaces = faces[(myIndex + 1) % faces.length];
                const prevFaces = faces[(myIndex - 1 + faces.length) % faces.length];

                let leftInt = getLineIntersection(myFaces.leftLine.s, myFaces.leftLine.e, nextFaces.rightLine.s, nextFaces.rightLine.e);
                let rightInt = getLineIntersection(myFaces.rightLine.s, myFaces.rightLine.e, prevFaces.leftLine.s, prevFaces.leftLine.e);

                const maxDist = cmToPx(wall.thickness) * 5;

                if (!leftInt || getDistance(leftInt, point) > maxDist) leftInt = myFaces.leftLine.s;
                if (!rightInt || getDistance(rightInt, point) > maxDist) rightInt = myFaces.rightLine.s;

                if (isStart) {
                  adjustedL1 = leftInt;
                  adjustedL2 = rightInt;
                } else {
                  // For end point, the direction is reversed, so left/right are swapped relative to l1/l2
                  adjustedL1 = rightInt;
                  adjustedL2 = leftInt;
                }
              } else if (connections.length > 0) {
                // T-junction where this wall ends on the middle of another wall
                let minDist1 = Infinity;
                let minDist2 = Infinity;
                const otherPoint = isStart ? wall.end : wall.start;

                for (const other of connections) {
                  const oThickness = cmToPx(other.thickness);
                  const oOffset = oThickness / 2;
                  const odx = other.end.x - other.start.x;
                  const ody = other.end.y - other.start.y;
                  const oLen = Math.sqrt(odx * odx + ody * ody);
                  if (oLen === 0) continue;
                  
                  const onx = -ody / oLen;
                  const ony = odx / oLen;

                  const ol1s = { x: other.start.x + onx * oOffset, y: other.start.y + ony * oOffset };
                  const ol1e = { x: other.end.x + onx * oOffset, y: other.end.y + ony * oOffset };
                  const ol2s = { x: other.start.x - onx * oOffset, y: other.start.y - ony * oOffset };
                  const ol2e = { x: other.end.x - onx * oOffset, y: other.end.y - ony * oOffset };

                  const curL1s = isStart ? l1s : l1e;
                  const curL1e = isStart ? l1e : l1s;
                  const curL2s = isStart ? l2s : l2e;
                  const curL2e = isStart ? l2e : l2s;

                  const intersections1 = [
                    getLineIntersection(curL1s, curL1e, ol1s, ol1e),
                    getLineIntersection(curL1s, curL1e, ol2s, ol2e)
                  ].filter(i => i !== null) as Point[];

                  const intersections2 = [
                    getLineIntersection(curL2s, curL2e, ol1s, ol1e),
                    getLineIntersection(curL2s, curL2e, ol2s, ol2e)
                  ].filter(i => i !== null) as Point[];

                  const maxDist = thickness * 3;

                  for (const i of intersections1) {
                    const dToPoint = getDistance(i, point);
                    if (dToPoint < maxDist) {
                      const dToOther = getDistance(i, otherPoint);
                      if (dToOther < minDist1) {
                        minDist1 = dToOther;
                        adjustedL1 = i;
                      }
                    }
                  }

                  for (const i of intersections2) {
                    const dToPoint = getDistance(i, point);
                    if (dToPoint < maxDist) {
                      const dToOther = getDistance(i, otherPoint);
                      if (dToOther < minDist2) {
                        minDist2 = dToOther;
                        adjustedL2 = i;
                      }
                    }
                  }
                }
              }

              if (isStart) {
                l1s = adjustedL1;
                l2s = adjustedL2;
              } else {
                l1e = adjustedL1;
                l2e = adjustedL2;
              }
            };

            adjustEnd(wall.start, true);
            adjustEnd(wall.end, false);
            
            return (
              <Group 
                key={wall.id} 
                onClick={(e) => { 
                  if (activeTool === ToolType.SELECT) {
                    e.cancelBubble = true; 
                    onSelect([wall.id]); 
                  }
                }}
                onDblClick={(e) => { 
                  if (activeTool === ToolType.SELECT) {
                    e.cancelBubble = true; 
                    onSelect([wall.id]); 
                    onOpenProperties(); 
                  }
                }}
                draggable={activeTool === ToolType.SELECT && isSelected}
                onDragEnd={(e) => handleWallDragEnd(wall.id, e)}
              >
                {/* Main wall fill */}
                <Line
                  points={[l1s.x, l1s.y, l1e.x, l1e.y, wall.end.x, wall.end.y, l2e.x, l2e.y, l2s.x, l2s.y, wall.start.x, wall.start.y]}
                  fill={isSelected ? "#3b82f6" : (wall.color || "#141414")}
                  closed={true}
                  opacity={0.1}
                  stroke={isSelected ? "#3b82f6" : (wall.color || "#141414")}
                  strokeWidth={0.5}
                />
                {/* Face lines */}
                <Line
                  points={[l1s.x, l1s.y, l1e.x, l1e.y]}
                  stroke={isSelected ? "#3b82f6" : (wall.color || "#141414")}
                  strokeWidth={1}
                />
                <Line
                  points={[l2s.x, l2s.y, l2e.x, l2e.y]}
                  stroke={isSelected ? "#3b82f6" : (wall.color || "#141414")}
                  strokeWidth={1}
                />
                <Group name="dimensions-layer" visible={project.showDimensions}>
                  <Text
                    x={(wall.start.x + wall.end.x) / 2}
                    y={(wall.start.y + wall.end.y) / 2 - 15}
                    text={formatMeasurement(getDistance(wall.start, wall.end), project.gridSize * 2)}
                    fontSize={10}
                    fill={isSelected ? "#3b82f6" : "#141414"}
                    align="center"
                    rotation={getAngle(wall.start, wall.end)}
                  />
                </Group>
                {isSelected && (
                  <>
                    <Circle 
                      x={wall.start.x} 
                      y={wall.start.y} 
                      radius={8} 
                      fill="white" 
                      stroke="#3b82f6" 
                      draggable 
                      onDragMove={(e) => {
                        const stage = e.target.getStage();
                        const worldPos = getRelativePointerPosition(stage);
                        const snapped = snapToGrid(worldPos);
                        
                        updateCurrentFloor(floor => {
                          const wallToUpdate = floor.walls.find(w => w.id === wall.id);
                          if (!wallToUpdate) return floor;

                          const oldPoint = wallToUpdate.start;
                          const newPoint = snapped;

                          return {
                            ...floor,
                            walls: floor.walls.map(w => {
                              let updatedW = { ...w };
                              if (getDistance(w.start, oldPoint) < 2) updatedW.start = newPoint;
                              if (getDistance(w.end, oldPoint) < 2) updatedW.end = newPoint;
                              return updatedW;
                            }),
                            rooms: floor.rooms.map(r => ({
                              ...r,
                              points: r.points.map(p => getDistance(p, oldPoint) < 2 ? newPoint : p)
                            }))
                          };
                        });
                        e.target.x(wall.start.x);
                        e.target.y(wall.start.y);
                      }}
                    />
                    <Circle 
                      x={wall.end.x} 
                      y={wall.end.y} 
                      radius={8} 
                      fill="white" 
                      stroke="#3b82f6" 
                      draggable
                      onDragMove={(e) => {
                        const stage = e.target.getStage();
                        const worldPos = getRelativePointerPosition(stage);
                        const snapped = snapToGrid(worldPos);
                        
                        updateCurrentFloor(floor => {
                          const wallToUpdate = floor.walls.find(w => w.id === wall.id);
                          if (!wallToUpdate) return floor;

                          const oldPoint = wallToUpdate.end;
                          const newPoint = snapped;

                          return {
                            ...floor,
                            walls: floor.walls.map(w => {
                              let updatedW = { ...w };
                              if (getDistance(w.start, oldPoint) < 2) updatedW.start = newPoint;
                              if (getDistance(w.end, oldPoint) < 2) updatedW.end = newPoint;
                              return updatedW;
                            }),
                            rooms: floor.rooms.map(r => ({
                              ...r,
                              points: r.points.map(p => getDistance(p, oldPoint) < 2 ? newPoint : p)
                            }))
                          };
                        });
                        e.target.x(wall.end.x);
                        e.target.y(wall.end.y);
                      }}
                    />
                  </>
                )}
              </Group>
            );
          })}

          {/* Openings */}
          {(currentFloor.openings || []).map(renderOpening)}

          {/* Stairs from floor below (Arrival steps) */}
          {floorBelow && (floorBelow.stairs || []).map((item) => (
            <Group
              key={`arrival-${item.id}`}
              x={item.x}
              y={item.y}
              rotation={item.rotation}
              scaleX={item.scaleX || 1}
              scaleY={item.scaleY || 1}
              listening={false}
            >
              {renderStairsItem(item, true)}
            </Group>
          ))}

          {/* Stairs */}
          {(currentFloor.stairs || []).map((item) => (
            <Group
              key={item.id}
              x={item.x}
              y={item.y}
              rotation={item.rotation}
              scaleX={item.scaleX || 1}
              scaleY={item.scaleY || 1}
              draggable={activeTool === ToolType.SELECT}
              onDragMove={(e) => {
                const newStairs = handleStairsDragMove(item.id, e);
                if (newStairs) {
                  e.target.x(newStairs.x);
                  e.target.y(newStairs.y);
                  e.target.rotation(newStairs.rotation);
                }
              }}
              onDragEnd={(e) => handleStairsDragEnd(item.id, e)}
              onClick={(e) => { 
                if (activeTool === ToolType.SELECT) {
                  e.cancelBubble = true; 
                  onSelect([item.id]); 
                }
              }}
              onDblClick={(e) => { 
                if (activeTool === ToolType.SELECT) {
                  e.cancelBubble = true; 
                  onSelect([item.id]); 
                  onOpenProperties(); 
                }
              }}
            >
              {renderStairsItem(item)}
              {selectedIds.includes(item.id) && (
                <Rect
                  width={cmToPx(item.width) + 10}
                  height={cmToPx(item.length || 200) + 10}
                  stroke="#3b82f6"
                  strokeWidth={1}
                  dash={[5, 5]}
                  offsetX={(cmToPx(item.width) + 10) / 2}
                  offsetY={(cmToPx(item.length || 200) + 10) / 2}
                />
              )}
            </Group>
          ))}

          {/* Furniture */}
          {currentFloor.furniture
            .slice()
            .sort((a, b) => {
              const getDefaultZIndex = (type: string) => {
                if (type.includes('chair') || type.includes('stool')) return -1;
                if (type.includes('table') || type === 'desk' || type === 'kitchen_counter') return 1;
                if (type === 'rug') return -2;
                return 0;
              };
              const zA = a.zIndex !== undefined ? a.zIndex : getDefaultZIndex(a.type);
              const zB = b.zIndex !== undefined ? b.zIndex : getDefaultZIndex(b.type);
              return zA - zB;
            })
            .map((item) => (
            <Group
              key={item.id}
              id={item.id}
              x={item.x}
              y={item.y}
              rotation={item.rotation}
              scaleX={item.scaleX}
              scaleY={item.scaleY}
              draggable={activeTool === ToolType.SELECT}
              onDragStart={(e) => { 
                if (activeTool === ToolType.SELECT) {
                  e.cancelBubble = true; 
                  onSelect([item.id]); 
                }
              }}
              onDragMove={(e) => {
                const newPos = handleFurnitureDragMove(item.id, e);
                if (newPos) {
                  e.target.x(newPos.x);
                  e.target.y(newPos.y);
                  e.target.rotation(newPos.rotation);
                }
              }}
              onDragEnd={(e) => handleFurnitureDragEnd(item.id, e)}
              onClick={(e) => { 
                if (activeTool === ToolType.SELECT) {
                  e.cancelBubble = true; 
                  onSelect([item.id]); 
                }
              }}
              onDblClick={(e) => { 
                if (activeTool === ToolType.SELECT) {
                  e.cancelBubble = true; 
                  onSelect([item.id]); 
                  onOpenProperties(); 
                }
              }}
            >
              {renderFurnitureItem(item)}
              {selectedIds.includes(item.id) && (
                <Rect
                  width={cmToPx(item.width) + 10}
                  height={cmToPx(item.height) + 10}
                  stroke="#3b82f6"
                  strokeWidth={1}
                  dash={[5, 5]}
                  offsetX={(cmToPx(item.width) + 10) / 2}
                  offsetY={(cmToPx(item.height) + 10) / 2}
                />
              )}
            </Group>
          ))}

          {/* Drawing Previews */}
          {isDrawing && activeTool === ToolType.WALL && newWallPoints.length > 0 && (
            <Group>
              <Line
                points={[...newWallPoints.flatMap(p => [p.x, p.y]), mousePos.x, mousePos.y]}
                stroke="#141414"
                strokeWidth={8}
                opacity={0.5}
              />
              <Text
                x={(newWallPoints[newWallPoints.length - 1].x + mousePos.x) / 2}
                y={(newWallPoints[newWallPoints.length - 1].y + mousePos.y) / 2 - 20}
                text={formatMeasurement(getDistance(newWallPoints[newWallPoints.length - 1], mousePos), project.gridSize * 2)}
                fontSize={12}
                fill="#141414"
                align="center"
              />
            </Group>
          )}
          {isDrawing && activeTool === ToolType.ROOM && newRoomPoints.length > 0 && (
            <Line
              points={[...newRoomPoints.flatMap(p => [p.x, p.y]), mousePos.x, mousePos.y]}
              stroke="#141414"
              strokeWidth={1}
              dash={[5, 5]}
              closed={false}
            />
          )}
          {activeTool === ToolType.STAIRS && pendingStairs && (
            <Group x={mousePos.x} y={mousePos.y} opacity={0.5}>
              {renderStairsItem({ ...pendingStairs, id: 'preview', x: 0, y: 0, rotation: 0, direction: 'up' })}
            </Group>
          )}
        </Layer>
      </Stage>

      {/* Door Library Overlay */}
      {activeTool === ToolType.DOOR && !pendingOpening && (
        <div className="absolute top-4 left-4 w-64 bg-white/90 backdrop-blur-md border border-[#141414] rounded-2xl shadow-2xl p-4 z-50">
          <h3 className="text-[10px] uppercase tracking-widest opacity-40 mb-3 px-2">Puertas</h3>
          <div className="grid grid-cols-1 gap-2">
            {DOOR_TEMPLATES.map(template => (
              <button
                key={template.subType}
                onClick={() => setPendingOpening({
                  type: 'door',
                  subType: template.subType,
                  width: template.width,
                  height: template.height,
                  isDouble: template.isDouble,
                  openingDirection: 'left'
                })}
                className="flex items-center gap-3 p-3 rounded-xl border border-[#141414]/5 hover:border-[#141414]/20 hover:bg-[#141414]/5 transition-all text-left"
              >
                <div className="w-10 h-10 bg-[#141414]/5 rounded-lg flex items-center justify-center">
                  <DoorOpen size={18} />
                </div>
                <div>
                  <div className="text-xs font-bold">{template.name}</div>
                  <div className="text-[10px] opacity-40">{template.width}cm</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Window Library Overlay */}
      {activeTool === ToolType.WINDOW && !pendingOpening && (
        <div className="absolute top-4 left-4 w-64 bg-white/90 backdrop-blur-md border border-[#141414] rounded-2xl shadow-2xl p-4 z-50">
          <h3 className="text-[10px] uppercase tracking-widest opacity-40 mb-3 px-2">Ventanas</h3>
          <div className="grid grid-cols-1 gap-2">
            {WINDOW_TEMPLATES.map(template => (
              <button
                key={template.subType}
                onClick={() => setPendingOpening({
                  type: 'window',
                  subType: template.subType,
                  width: template.width,
                  height: template.height
                })}
                className="flex items-center gap-3 p-3 rounded-xl border border-[#141414]/5 hover:border-[#141414]/20 hover:bg-[#141414]/5 transition-all text-left"
              >
                <div className="w-10 h-10 bg-[#141414]/5 rounded-lg flex items-center justify-center">
                  <Layout size={18} />
                </div>
                <div>
                  <div className="text-xs font-bold">{template.name}</div>
                  <div className="text-[10px] opacity-40">{template.width}cm</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Stairs Library Overlay */}
      {activeTool === ToolType.STAIRS && !pendingStairs && (
        <div className="absolute top-4 left-4 w-64 bg-white/90 backdrop-blur-md border border-[#141414] rounded-2xl shadow-2xl p-4 z-50">
          <h3 className="text-[10px] uppercase tracking-widest opacity-40 mb-3 px-2">Escaleras</h3>
          <div className="grid grid-cols-1 gap-2">
            {STAIRS_TEMPLATES.map(template => (
              <button
                key={template.type}
                onClick={() => setPendingStairs({
                  type: template.type,
                  width: template.width,
                  length: template.length,
                  steps: template.steps,
                  flights: template.flights,
                })}
                className="flex items-center gap-3 p-3 rounded-xl border border-[#141414]/5 hover:border-[#141414]/20 hover:bg-[#141414]/5 transition-all text-left"
              >
                <div className="w-10 h-10 bg-[#141414]/5 rounded-lg flex items-center justify-center">
                  <StairsIcon size={18} />
                </div>
                <div>
                  <div className="text-xs font-bold">{template.name}</div>
                  <div className="text-[10px] opacity-40">{template.width}x{template.length}cm</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Pending Opening Instruction */}
      {pendingOpening && (
        <div className="absolute top-4 left-4 bg-[#141414] text-white px-4 py-2 rounded-xl shadow-2xl flex items-center gap-3 z-50">
          <span className="text-xs">Haz clic en una pared para colocar: {pendingOpening.subType}</span>
          <button onClick={() => setPendingOpening(null)} className="p-1 hover:bg-white/10 rounded-full">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Pending Stairs Instruction */}
      {pendingStairs && (
        <div className="absolute top-4 left-4 bg-[#141414] text-white px-4 py-2 rounded-xl shadow-2xl flex items-center gap-3 z-50">
          <span className="text-xs">Haz clic en el plano para colocar: {pendingStairs.type}</span>
          <button onClick={() => setPendingStairs(null)} className="p-1 hover:bg-white/10 rounded-full">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Instructions Overlay */}
      {isDrawing && (
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 bg-[#141414] text-white px-6 py-3 rounded-full text-xs font-medium shadow-2xl flex items-center gap-4 z-50">
          {activeTool === ToolType.WALL && (
            <div className="flex items-center gap-2 mr-4 bg-white/10 rounded-full p-1">
              <button 
                onClick={() => setIsExteriorWall(false)}
                className={cn("px-3 py-1 rounded-full transition-colors", !isExteriorWall ? "bg-white text-[#141414]" : "hover:bg-white/10")}
              >
                Interior (10cm)
              </button>
              <button 
                onClick={() => setIsExteriorWall(true)}
                className={cn("px-3 py-1 rounded-full transition-colors", isExteriorWall ? "bg-white text-[#141414]" : "hover:bg-white/10")}
              >
                Exterior (30cm)
              </button>
            </div>
          )}
          {activeTool === ToolType.ROOM ? (
            <>
              <span>Haz clic para añadir puntos. Pulsa ENTER para cerrar el polígono.</span>
              <div className="h-4 w-px bg-white/20" />
              <span className="opacity-60">ESC para cancelar</span>
            </>
          ) : (
            <>
              <span>Haz clic para finalizar la pared.</span>
              <div className="h-4 w-px bg-white/20" />
              <span className="opacity-60">ESC para cancelar</span>
            </>
          )}
        </div>
      )}
    </div>
  );
});
