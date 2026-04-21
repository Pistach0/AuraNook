import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function calculateArea(points: { x: number; y: number }[], pixelsPerMeter: number): number {
  if (points.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  area = Math.abs(area) / 2;
  // Convert pixels^2 to meters^2
  return area / (pixelsPerMeter * pixelsPerMeter);
}

export function getComputedRoomArea(room: { points: { x: number; y: number }[]; roomType?: string; name?: string }, pixelsPerMeter: number): number {
  const rawArea = calculateArea(room.points, pixelsPerMeter);
  const typeStr = (room.roomType || '').toLowerCase();
  const nameStr = (room.name || '').toLowerCase();
  
  if (typeStr === 'patio' || typeStr === 'terraza' || nameStr.includes('patio') || nameStr.includes('terraza')) {
    return 0;
  }
  
  if (typeStr === 'porche' || nameStr.includes('porche')) {
    return rawArea * 0.5;
  }
  
  return rawArea;
}

export function getMidpoint(p1: { x: number; y: number }, p2: { x: number; y: number }) {
  return {
    x: (p1.x + p2.x) / 2,
    y: (p1.y + p2.y) / 2,
  };
}

export function getDistance(p1: { x: number; y: number }, p2: { x: number; y: number }) {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
}

export function getAngle(p1: { x: number; y: number }, p2: { x: number; y: number }) {
  return Math.atan2(p2.y - p1.y, p2.x - p1.x) * (180 / Math.PI);
}

export function isPointOnSegment(p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }, epsilon: number = 0.1): boolean {
  const distAB = getDistance(a, b);
  const distAP = getDistance(a, p);
  const distPB = getDistance(p, b);
  
  // If the point is one of the endpoints, we don't consider it "intermediate"
  if (distAP < epsilon || distPB < epsilon) return false;
  
  return Math.abs(distAB - (distAP + distPB)) < epsilon;
}

export function getLineIntersection(p1: { x: number; y: number }, p2: { x: number; y: number }, p3: { x: number; y: number }, p4: { x: number; y: number }): { x: number; y: number } | null {
  const x1 = p1.x, y1 = p1.y, x2 = p2.x, y2 = p2.y;
  const x3 = p3.x, y3 = p3.y, x4 = p4.x, y4 = p4.y;
  const denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
  if (Math.abs(denom) < 0.0001) return null;
  const ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denom;
  return { x: x1 + ua * (x2 - x1), y: y1 + ua * (y2 - y1) };
}

export function isPointInPolygon(point: { x: number; y: number }, polygon: { x: number; y: number }[]): boolean {
  let isInside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    
    const intersect = ((yi > point.y) !== (yj > point.y))
        && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
    if (intersect) isInside = !isInside;
  }
  return isInside;
}
