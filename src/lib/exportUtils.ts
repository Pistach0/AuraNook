import { Floor, Wall, Opening, Furniture, Stairs, StairsType, Project } from "../types";
import jsPDF from "jspdf";
import { calculateArea } from "./utils";

/**
 * Generates a basic DXF string for the given floor.
 * DXF is a text-based format for CAD data.
 */
export function generateDXF(floor: Floor, pixelsPerMeter: number): string {
  let dxf = "0\nSECTION\n2\nENTITIES\n";

  const scale = 1 / pixelsPerMeter; // Scale pixels to meters

  // Helper to add a line to DXF
  const addLine = (x1: number, y1: number, x2: number, y2: number, layer: string = "0") => {
    dxf += `0\nLINE\n8\n${layer}\n10\n${x1 * scale}\n20\n${-y1 * scale}\n11\n${x2 * scale}\n21\n${-y2 * scale}\n`;
  };

  // Helper to add a circle to DXF
  const addCircle = (cx: number, cy: number, r: number, layer: string = "0") => {
    dxf += `0\nCIRCLE\n8\n${layer}\n10\n${cx * scale}\n20\n${-cy * scale}\n40\n${r * scale}\n`;
  };

  // Export Walls
  floor.walls.forEach((wall) => {
    const layer = wall.isExterior ? "Walls_Exterior" : "Walls_Interior";
    // Draw the main line
    addLine(wall.start.x, wall.start.y, wall.end.x, wall.end.y, layer);
    
    // Draw thickness lines if possible (simplified)
    const angle = Math.atan2(wall.end.y - wall.start.y, wall.end.x - wall.start.x);
    const dx = Math.sin(angle) * (wall.thickness / 2);
    const dy = Math.cos(angle) * (wall.thickness / 2);
    
    addLine(wall.start.x + dx, wall.start.y - dy, wall.end.x + dx, wall.end.y - dy, layer);
    addLine(wall.start.x - dx, wall.start.y + dy, wall.end.x - dx, wall.end.y + dy, layer);
  });

  // Export Openings (Doors/Windows)
  floor.openings.forEach((opening) => {
    const wall = floor.walls.find(w => w.id === opening.wallId);
    if (!wall) return;
    
    const x = wall.start.x + (wall.end.x - wall.start.x) * opening.position;
    const y = wall.start.y + (wall.end.y - wall.start.y) * opening.position;
    const layer = opening.type === 'door' ? "Doors" : "Windows";
    
    // Simple representation: a circle or a box
    addCircle(x, y, opening.width / 2, layer);
  });

  // Export Furniture
  floor.furniture.forEach((f) => {
    const layer = `Furniture_${f.category}`;
    // Draw a box for furniture
    const hw = f.width / 2;
    const hh = f.height / 2;
    addLine(f.x - hw, f.y - hh, f.x + hw, f.y - hh, layer);
    addLine(f.x + hw, f.y - hh, f.x + hw, f.y + hh, layer);
    addLine(f.x + hw, f.y + hh, f.x - hw, f.y + hh, layer);
    addLine(f.x - hw, f.y + hh, f.x - hw, f.y - hh, layer);
  });

  // Export Stairs
  (floor.stairs || []).forEach((s) => {
    const layer = "Stairs";
    const hw = s.width / 2;
    const hl = s.length / 2;
    addLine(s.x - hw, s.y - hl, s.x + hw, s.y - hl, layer);
    addLine(s.x + hw, s.y - hl, s.x + hw, s.y + hl, layer);
    addLine(s.x + hw, s.y + hl, s.x - hw, s.y + hl, layer);
    addLine(s.x - hw, s.y + hl, s.x - hw, s.y - hl, layer);
  });

  dxf += "0\nENDSEC\n0\nEOF";
  return dxf;
}

/**
 * Triggers a download of the DXF file.
 */
export function downloadDXF(floor: Floor, pixelsPerMeter: number, filename: string = "plano.dxf") {
  const dxfContent = generateDXF(floor, pixelsPerMeter);
  const blob = new Blob([dxfContent], { type: "application/dxf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Triggers a PDF download using the Konva stage.
 * Now supports printing all floors.
 */
export async function downloadPDF(
  stage: any, 
  filename: string = "plano.pdf", 
  options: { showGrid: boolean; showDimensions: boolean; format: string },
  pixelsPerMeter: number,
  project: Project,
  updateProject: (updates: Partial<Project>) => void
) {
  if (!stage) return;

  const originalFloorId = project.currentFloorId;
  const originalShowGhostFloors = project.showGhostFloors;
  
  // 1. Calculate global bounding box across all floors
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let hasContent = false;

  for (const floor of project.floors) {
    // Check walls
    floor.walls.forEach(w => {
      minX = Math.min(minX, w.start.x, w.end.x);
      minY = Math.min(minY, w.start.y, w.end.y);
      maxX = Math.max(maxX, w.start.x, w.end.x);
      maxY = Math.max(maxY, w.start.y, w.end.y);
      hasContent = true;
    });
    // Check rooms
    floor.rooms.forEach(r => {
      r.points.forEach(p => {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
        hasContent = true;
      });
    });
    // Check furniture
    floor.furniture.forEach(f => {
      const hw = f.width / 2;
      const hh = f.height / 2;
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

  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "px",
  });

  // Paper formats in points (72 DPI)
  const paperSizes: Record<string, [number, number]> = {
    'a4': [595.28, 841.89],
    'a3': [841.89, 1190.55],
    'a2': [1190.55, 1683.78],
  };

  for (let i = 0; i < project.floors.length; i++) {
    const floor = project.floors[i];
    
    // Switch to the floor and disable ghost floors in the state
    updateProject({ currentFloorId: floor.id, showGhostFloors: false });
    // Wait for re-render
    await new Promise(resolve => setTimeout(resolve, 300));

    const layer = stage.getLayers()[0];
    const gridLayer = stage.findOne('.grid-layer');
    const dimensionsLayers = stage.find('.dimensions-layer');

    // Store original state
    const originalPos = stage.position();
    const originalScale = stage.scale();
    const originalGridVisible = gridLayer?.visible();
    const originalDimensionsVisibilities = dimensionsLayers.map((l: any) => l.visible());

    // Reset stage transform for consistent measurement and capture
    stage.position({ x: 0, y: 0 });
    stage.scale({ x: 1, y: 1 });

    // Apply final visibility for export
    if (gridLayer) gridLayer.visible(options.showGrid);
    dimensionsLayers.forEach((l: any) => l.visible(options.showDimensions));

    // Add a temporary graphic scale
    const scaleGroup = new (window as any).Konva.Group({
      x: exportX + 50,
      y: exportY + exportHeight - 50,
      name: 'temp-scale'
    });

    const scaleWidth = pixelsPerMeter;
    const scaleLine = new (window as any).Konva.Line({
      points: [0, 0, scaleWidth, 0],
      stroke: '#141414',
      strokeWidth: 2
    });

    const tick1 = new (window as any).Konva.Line({ points: [0, -5, 0, 5], stroke: '#141414', strokeWidth: 2 });
    const tick2 = new (window as any).Konva.Line({ points: [scaleWidth, -5, scaleWidth, 5], stroke: '#141414', strokeWidth: 2 });
    
    const text = new (window as any).Konva.Text({
      text: '1m',
      fontSize: 12,
      x: scaleWidth / 2 - 10,
      y: 10,
      fill: '#141414'
    });

    scaleGroup.add(scaleLine, tick1, tick2, text);
    layer.add(scaleGroup);
    stage.draw();

    const dataUrl = stage.toDataURL({ 
      pixelRatio: 2,
      x: exportX,
      y: exportY,
      width: exportWidth,
      height: exportHeight
    });

    let pdfWidth = exportWidth;
    let pdfHeight = exportHeight;
    let orientation: "landscape" | "portrait" = exportWidth > exportHeight ? "landscape" : "portrait";

    if (options.format !== 'original' && paperSizes[options.format]) {
      const [short, long] = paperSizes[options.format];
      if (orientation === "landscape") {
        pdfWidth = long;
        pdfHeight = short;
      } else {
        pdfWidth = short;
        pdfHeight = long;
      }
    }

    if (i > 0) {
      pdf.addPage([pdfWidth, pdfHeight], orientation);
    } else {
      // Set the first page size
      (pdf as any).setPage(1);
      (pdf as any).internal.pageSize.width = pdfWidth;
      (pdf as any).internal.pageSize.height = pdfHeight;
    }

    // Calculate image dimensions to fit the page while maintaining aspect ratio
    const imgAspectRatio = exportWidth / exportHeight;
    const pdfAspectRatio = pdfWidth / pdfHeight;
    
    let finalImgWidth, finalImgHeight;
    if (imgAspectRatio > pdfAspectRatio) {
      finalImgWidth = pdfWidth;
      finalImgHeight = pdfWidth / imgAspectRatio;
    } else {
      finalImgHeight = pdfHeight;
      finalImgWidth = pdfHeight * imgAspectRatio;
    }

    // Center image on page
    const xOffset = (pdfWidth - finalImgWidth) / 2;
    const yOffset = (pdfHeight - finalImgHeight) / 2;

    pdf.addImage(dataUrl, "PNG", xOffset, yOffset, finalImgWidth, finalImgHeight);

    // Add floor name and area
    const floorArea = floor.rooms.reduce((acc, room) => acc + calculateArea(room.points, pixelsPerMeter), 0);
    pdf.setFontSize(14);
    pdf.setTextColor(20, 20, 20);
    pdf.text(`${floor.name}`, xOffset + 20, yOffset + 30);
    pdf.setFontSize(10);
    pdf.text(`Superficie: ${floorArea.toFixed(2)} m²`, xOffset + 20, yOffset + 45);

    // Watermark
    pdf.setFontSize(8);
    pdf.setTextColor(150, 150, 150);
    pdf.text("Diseñado con AuraNook", pdfWidth - 100, pdfHeight - 15);

    // Restore original state
    stage.position(originalPos);
    stage.scale(originalScale);
    if (gridLayer) gridLayer.visible(originalGridVisible);
    dimensionsLayers.forEach((l: any, i: number) => l.visible(originalDimensionsVisibilities[i]));
    scaleGroup.destroy();
    stage.draw();
  }

  pdf.save(filename);
  
  // Restore original floor and ghost floors state
  updateProject({ currentFloorId: originalFloorId, showGhostFloors: originalShowGhostFloors });
}

