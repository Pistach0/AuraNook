/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Point = { x: number; y: number };

export enum ToolType {
  SELECT = 'select',
  WALL = 'wall',
  ROOM = 'room',
  DOOR = 'door',
  WINDOW = 'window',
  STAIRS = 'stairs',
  FURNITURE = 'furniture',
}

export enum AppMode {
  DESIGN = 'design',
  DECORATION = 'decoration',
}

export type Language = 'es' | 'en';
export type Unit = 'm' | 'in';

export enum DoorType {
  SIMPLE = 'simple',
  DOUBLE = 'double',
  SLIDING = 'sliding',
}

export enum OpeningDirection {
  LEFT = 'left',
  RIGHT = 'right',
  BOTH = 'both',
}

export interface Wall {
  id: string;
  start: Point;
  end: Point;
  thickness: number;
  isExterior?: boolean;
  color?: string;
}

export interface Opening {
  id: string;
  type: 'door' | 'window';
  subType: string; // e.g., 'sliding', 'hinged'
  wallId: string;
  position: number; // 0 to 1 along the wall
  width: number;
  height: number;
  rotation: number;
  openingDirection?: OpeningDirection;
  isDouble?: boolean;
  scaleX?: number;
  scaleY?: number;
}

export interface Room {
  id: string;
  points: Point[];
  name: string;
  color: string;
  texture?: string;
  showDimensions?: boolean;
  labelPosition?: Point;
}

export interface Furniture {
  id: string;
  type: string;
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  category: string;
  width: number;
  height: number;
  name?: string;
  zIndex?: number;
  color?: string;
  attachedWallId?: string;
  attachedWallSide?: number; // 1 or -1
  attachedWallOffset?: number; // Distance from wall start (0 to 1)
}

export enum StairsType {
  STRAIGHT = 'straight',
  L_SHAPED = 'l_shaped',
  U_SHAPED = 'u_shaped',
  MULTI_FLIGHT = 'multi_flight',
  SPIRAL = 'spiral',
}

export interface StairsFlight {
  id: string;
  width: number;
  length: number;
  steps: number;
  x: number;
  y: number;
  rotation: number;
}

export interface Stairs {
  id: string;
  type: StairsType;
  x: number;
  y: number;
  rotation: number;
  width: number; // For backward compatibility / default
  length: number; // For backward compatibility / default
  steps: number; // For backward compatibility / default
  direction: 'up' | 'down';
  scaleX?: number;
  scaleY?: number;
  flights?: StairsFlight[];
  landingWidth?: number;
  landingLength?: number;
  attachedWallId?: string;
  attachedWallSide?: number; // 1 or -1
  attachedWallOffset?: number; // Distance from wall start (0 to 1)
}

export interface Floor {
  id: string;
  name: string;
  walls: Wall[];
  rooms: Room[];
  furniture: Furniture[];
  openings: Opening[];
  stairs: Stairs[];
}

export interface Project {
  id: string;
  name: string;
  floors: Floor[];
  currentFloorId: string;
  gridSize: number;
  showGrid: boolean;
  showDimensions: boolean;
  showGhostFloors: boolean;
  ghostFloorId?: string;
  zoom: number;
}
