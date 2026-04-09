import { AppMode, ToolType } from './types';
import { 
  Square, 
  MousePointer2, 
  PenTool, 
  DoorOpen, 
  Layout, 
  ChevronUp, 
  Armchair, 
  Layers, 
  Grid3X3, 
  RotateCcw, 
  FlipHorizontal,
  Plus,
  Trash2,
  Settings2
} from 'lucide-react';

export const DOOR_TEMPLATES = [
  { subType: 'simple', name: 'Puerta Simple', width: 80, height: 210, isDouble: false },
  { subType: 'double', name: 'Puerta Doble', width: 160, height: 210, isDouble: true },
  { subType: 'sliding_pocket', name: 'Corredera Oculta', width: 80, height: 210, isDouble: false },
  { subType: 'sliding_pocket_double', name: 'Corredera Oculta Doble', width: 160, height: 210, isDouble: true },
  { subType: 'sliding_exposed', name: 'Corredera Vista', width: 80, height: 210, isDouble: false },
  { subType: 'sliding_exposed_double', name: 'Corredera Vista Doble', width: 160, height: 210, isDouble: true },
  { subType: 'garage', name: 'Puerta Garaje', width: 250, height: 210, isDouble: false },
];

export const WINDOW_TEMPLATES = [
  { subType: 'standard', name: 'Ventana Estándar', width: 120, height: 100 },
  { subType: 'large', name: 'Ventana Grande', width: 200, height: 100 },
  { subType: 'small', name: 'Ventana Pequeña', width: 60, height: 60 },
];

export const STAIRS_TEMPLATES = [
  { type: 'straight', name: 'Un tramo', width: 100, length: 300, steps: 15 },
  { 
    type: 'l_shaped', 
    name: 'En L', 
    width: 100, 
    length: 300, 
    steps: 16,
    flights: [
      { id: 'f1', width: 100, length: 200, steps: 10, x: 0, y: 0, rotation: 0 },
      { id: 'f2', width: 100, length: 100, steps: 6, x: 100, y: -150, rotation: 90 },
    ]
  },
  { 
    type: 'u_shaped', 
    name: 'Ida y vuelta', 
    width: 200, 
    length: 200, 
    steps: 16,
    flights: [
      { id: 'f1', width: 100, length: 200, steps: 8, x: -50, y: 0, rotation: 0 },
      { id: 'f2', width: 100, length: 200, steps: 8, x: 50, y: 0, rotation: 180 },
    ]
  },
  { type: 'spiral', name: 'Caracol', width: 180, length: 180, steps: 14 },
];

export const CATEGORIES = [
  { id: 'living', name: 'Salón', icon: '🛋️' },
  { id: 'kitchen', name: 'Cocina', icon: '🍳' },
  { id: 'bedroom', name: 'Dormitorio', icon: '🛏️' },
  { id: 'bathroom', name: 'Baño', icon: '🚿' },
  { id: 'office', name: 'Oficina', icon: '🖥️' },
  { id: 'garage', name: 'Garaje', icon: '🚗' },
  { id: 'exterior', name: 'Exterior', icon: '🌳' },
  { id: 'games', name: 'Sala de juegos', icon: '🎮' },
];

export const FURNITURE_TEMPLATES = [
  { type: 'sofa', name: 'Sofá 3 Plazas', category: 'living', width: 220, height: 90 },
  { type: 'sofa_2', name: 'Sofá 2 Plazas', category: 'living', width: 160, height: 90 },
  { type: 'chaiselongue', name: 'Sofá Chaiselongue', category: 'living', width: 280, height: 160 },
  { type: 'armchair', name: 'Sillón', category: 'living', width: 90, height: 90 },
  { type: 'fireplace', name: 'Chimenea', category: 'living', width: 120, height: 40 },
  { type: 'tv_unit', name: 'Mueble TV', category: 'living', width: 180, height: 40 },
  { type: 'plant', name: 'Planta', category: 'living', width: 50, height: 50 },
  { type: 'dining_table', name: 'Mesa Comedor', category: 'living', width: 160, height: 90 },
  { type: 'dining_table_round', name: 'Mesa Comedor Redonda', category: 'living', width: 120, height: 120 },
  { type: 'coffee_table', name: 'Mesita de Centro', category: 'living', width: 100, height: 60 },
  { type: 'chair', name: 'Silla', category: 'living', width: 45, height: 45 },
  { type: 'bed_double', name: 'Cama Doble', category: 'bedroom', width: 150, height: 200 },
  { type: 'bed_single', name: 'Cama Individual', category: 'bedroom', width: 90, height: 200 },
  { type: 'wardrobe', name: 'Armario', category: 'bedroom', width: 150, height: 60 },
  { type: 'nightstand', name: 'Mesita de Noche', category: 'bedroom', width: 45, height: 40 },
  { type: 'desk', name: 'Escritorio', category: 'office', width: 140, height: 70 },
  { type: 'office_chair', name: 'Silla Oficina', category: 'office', width: 60, height: 60 },
  { type: 'kitchen_counter', name: 'Encimera', category: 'kitchen', width: 200, height: 60 },
  { type: 'fridge', name: 'Nevera', category: 'kitchen', width: 60, height: 60 },
  { type: 'stove', name: 'Cocina/Horno', category: 'kitchen', width: 60, height: 60 },
  { type: 'sink', name: 'Fregadero', category: 'kitchen', width: 80, height: 60 },
  { type: 'kitchen_stool', name: 'Taburete Cocina', category: 'kitchen', width: 40, height: 40 },
  { type: 'toilet', name: 'Inodoro', category: 'bathroom', width: 40, height: 70 },
  { type: 'bathroom_sink', name: 'Lavabo', category: 'bathroom', width: 80, height: 50 },
  { type: 'bathtub', name: 'Bañera', category: 'bathroom', width: 160, height: 70 },
  { type: 'shower', name: 'Plato de Ducha', category: 'bathroom', width: 90, height: 90 },
  { type: 'car', name: 'Coche Berlina', category: 'garage', width: 450, height: 180 },
  { type: 'workbench', name: 'Banco de Trabajo', category: 'garage', width: 150, height: 60 },
  { type: 'shelf', name: 'Estantería Metálica', category: 'garage', width: 100, height: 40 },
  { type: 'washing_machine', name: 'Lavadora', category: 'garage', width: 60, height: 60 },
  { type: 'dryer', name: 'Secadora', category: 'garage', width: 60, height: 60 },
  { type: 'bbq', name: 'Barbacoa', category: 'exterior', width: 100, height: 60 },
  { type: 'sunbed', name: 'Tumbona', category: 'exterior', width: 70, height: 190 },
  { type: 'pool', name: 'Piscina', category: 'exterior', width: 600, height: 300 },
  { type: 'swing', name: 'Columpio', category: 'exterior', width: 200, height: 150 },
  { type: 'billiards', name: 'Billar', category: 'games', width: 250, height: 140 },
  { type: 'foosball', name: 'Futbolín', category: 'games', width: 140, height: 80 },
  { type: 'ping_pong', name: 'Mesa Ping Pong', category: 'games', width: 274, height: 152 },
  { type: 'arcade', name: 'Máquina Arcade', category: 'games', width: 70, height: 70 },
];
