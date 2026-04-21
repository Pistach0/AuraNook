import { Floor, Wall, Opening, Furniture, Stairs, StairsType, Project } from "../types";
import jsPDF from "jspdf";
import Konva from "konva";
import { calculateArea, getComputedRoomArea } from "./utils";

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
export function downloadDXF(floor: Floor, pixelsPerMeter: number, filename: string = "AuraNook_plano.dxf") {
  const dxfContent = generateDXF(floor, pixelsPerMeter);
  const blob = new Blob([dxfContent], { type: "application/dxf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.startsWith("AuraNook") ? filename : `AuraNook_${filename}`;
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
  filename: string = "AuraNook_plano.pdf", 
  options: { showGrid: boolean; showDimensions: boolean; format: string; scale: string },
  pixelsPerMeter: number,
  project: Project,
  updateProject: (updates: Partial<Project>) => void,
  t: (key: string) => string,
  formatMeasurement: (pixels: number, pixelsPerMeter: number) => string,
  unit: 'm' | 'in'
) {
  if (!stage) return;

  const finalFilename = filename.startsWith("AuraNook") ? filename : `AuraNook_${filename}`;

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
      const hw = (f.width / 100 * pixelsPerMeter) / 2;
      const hh = (f.height / 100 * pixelsPerMeter) / 2;
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
    unit: "mm",
  });

  // Paper formats in mm
  const paperSizes: Record<string, [number, number]> = {
    'a4': [210, 297],
    'a3': [297, 420],
    'a2': [420, 594],
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
    const originalWidth = stage.width();
    const originalHeight = stage.height();
    const originalGridVisible = gridLayer?.visible();
    const originalDimensionsVisibilities = dimensionsLayers.map((l: any) => l.visible());

    // Reset stage transform for consistent measurement and capture
    // By resizing the stage to the export area, we prevent Konva/Canvas from clipping off-screen shapes
    stage.width(exportWidth);
    stage.height(exportHeight);
    stage.position({ x: -exportX, y: -exportY });
    stage.scale({ x: 1, y: 1 });

    // Apply final visibility for export
    if (gridLayer) gridLayer.visible(options.showGrid);
    dimensionsLayers.forEach((l: any) => l.visible(options.showDimensions));

    // Add a white background for PDF export to avoid transparency issues
    const bg = new Konva.Rect({
      width: exportWidth,
      height: exportHeight,
      x: exportX,
      y: exportY,
      fill: 'white',
      name: 'temp-bg'
    });
    layer.add(bg);
    bg.moveToBottom();

    stage.draw();

    const dataUrl = stage.toDataURL({ 
      pixelRatio: 2,
      x: 0,
      y: 0,
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

    // Calculate image dimensions
    const tbHeight = 12; // Height of the horizontal title block
    const safeX = 10;
    const safeY = 10;
    const safeWidth = pdfWidth - 20;
    const safeHeight = pdfHeight - 20 - tbHeight; // Leave room for cajetín at the bottom

    const imgAspectRatio = exportWidth / exportHeight;
    const pdfAspectRatio = safeWidth / safeHeight;
    
    let finalImgWidth, finalImgHeight;

    if (options.scale !== 'auto') {
      const scaleFactor = parseInt(options.scale, 10);
      const realWidthMeters = exportWidth / pixelsPerMeter;
      // realWidthMeters * 1000 gives mm. Then divide by scaleFactor.
      finalImgWidth = (realWidthMeters * 1000) / scaleFactor;
      finalImgHeight = finalImgWidth / imgAspectRatio;
    } else {
      // Fit to safe area
      if (imgAspectRatio > pdfAspectRatio) {
        finalImgWidth = safeWidth;
        finalImgHeight = safeWidth / imgAspectRatio;
      } else {
        finalImgHeight = safeHeight;
        finalImgWidth = safeHeight * imgAspectRatio;
      }
    }

    // Center image on safe area
    const xOffset = safeX + (safeWidth - finalImgWidth) / 2;
    const yOffset = safeY + (safeHeight - finalImgHeight) / 2;

    pdf.addImage(dataUrl, "PNG", xOffset, yOffset, finalImgWidth, finalImgHeight);

    // Draw 1cm border around the whole page
    pdf.setDrawColor(20, 20, 20);
    pdf.setLineWidth(0.5);
    pdf.rect(10, 10, pdfWidth - 20, pdfHeight - 20);

    // Draw Title Block (Cajetín) - Horizontal strip
    const tbX = 10;
    const tbY = pdfHeight - 10 - tbHeight;
    const tbWidth = pdfWidth - 20;
    
    // Top line of the title block
    pdf.line(tbX, tbY, tbX + tbWidth, tbY);
    
    // Calculate section widths
    const wWatermark = 25;
    const wGraphScale = 25;
    const wScaleText = 45;
    const wArea = 50;
    const wFixed = wWatermark + wGraphScale + wScaleText + wArea;
    const wRemaining = tbWidth - wFixed;
    const wProject = wRemaining * 0.55;
    const wFloor = wRemaining * 0.45;

    const xProject = tbX;
    const xFloor = xProject + wProject;
    const xArea = xFloor + wFloor;
    const xScaleText = xArea + wArea;
    const xGraphScale = xScaleText + wScaleText;
    const xWatermark = xGraphScale + wGraphScale;

    // Draw vertical separators
    pdf.line(xFloor, tbY, xFloor, tbY + tbHeight);
    pdf.line(xArea, tbY, xArea, tbY + tbHeight);
    pdf.line(xScaleText, tbY, xScaleText, tbY + tbHeight);
    pdf.line(xGraphScale, tbY, xGraphScale, tbY + tbHeight);
    pdf.line(xWatermark, tbY, xWatermark, tbY + tbHeight);

    // Title Block Content
    const textY = tbY + 8; // Vertical center for text
    pdf.setTextColor(20, 20, 20);
    
    // 1. Project Name
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "bold");
    let projectName = project.name || t('app.untitledProject');
    if (projectName.length > 30) projectName = projectName.substring(0, 27) + "...";
    pdf.text(projectName, xProject + 2, textY);
    
    // 2. Floor Name
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "normal");
    let floorName = floor.name;
    if (floorName.length > 25) floorName = floorName.substring(0, 22) + "...";
    pdf.text(floorName, xFloor + 2, textY);

    // 3. Area
    const floorArea = floor.rooms.reduce((acc, room) => acc + getComputedRoomArea(room, pixelsPerMeter), 0);
    const displayArea = unit === 'in' ? (floorArea * 10.7639).toFixed(2) + ' sq ft' : floorArea.toFixed(2) + ' m²';
    pdf.text(`${t('app.totalArea')}: ${displayArea}`, xArea + 2, textY);
    
    // 4. Scale Text
    const scaleText = options.scale === 'auto' ? `${t('print.scale')}: ${t('print.autoFit')}` : `${t('print.scale')}: 1:${options.scale}`;
    pdf.text(scaleText, xScaleText + 2, textY);

    // 5. Graphical Scale
    const realWidthMeters = exportWidth / pixelsPerMeter;
    const mmPerMeter = finalImgWidth / realWidthMeters;
    
    // Adjust scale length to fit nicely in the box (max ~15mm, min ~5mm)
    let scaleLengthMeters = 1;
    let scaleLengthMm = mmPerMeter;
    
    if (scaleLengthMm > 15) {
      scaleLengthMeters = 0.5;
      scaleLengthMm = mmPerMeter / 2;
    }
    if (scaleLengthMm > 15) {
      scaleLengthMeters = 0.2;
      scaleLengthMm = mmPerMeter / 5;
    }
    if (scaleLengthMm > 15) {
      scaleLengthMeters = 0.1;
      scaleLengthMm = mmPerMeter / 10;
    }
    if (scaleLengthMm < 5) {
      scaleLengthMeters = 5;
      scaleLengthMm = mmPerMeter * 5;
    }
    if (scaleLengthMm < 5) {
      scaleLengthMeters = 10;
      scaleLengthMm = mmPerMeter * 10;
    }
    
    let scaleLabel = `${scaleLengthMeters}m`;
    
    const scaleLineX = xGraphScale + (wGraphScale - scaleLengthMm) / 2; // Center in section
    const scaleLineY = tbY + 8;
    
    pdf.setLineWidth(0.5);
    pdf.line(scaleLineX, scaleLineY, scaleLineX + scaleLengthMm, scaleLineY);
    pdf.line(scaleLineX, scaleLineY - 1.5, scaleLineX, scaleLineY + 1.5);
    pdf.line(scaleLineX + scaleLengthMm, scaleLineY - 1.5, scaleLineX + scaleLengthMm, scaleLineY + 1.5);
    
    pdf.setFontSize(7);
    pdf.text(scaleLabel, scaleLineX + scaleLengthMm / 2, scaleLineY - 2, { align: "center" });
    
    // 6. Watermark
    pdf.setFontSize(8);
    pdf.setTextColor(150, 150, 150);
    pdf.setFont("helvetica", "italic");
    pdf.text("AuraNook", xWatermark + wWatermark / 2, textY, { align: "center" });

    // Restore original state
    stage.width(originalWidth);
    stage.height(originalHeight);
    stage.position(originalPos);
    stage.scale(originalScale);
    if (gridLayer) gridLayer.visible(originalGridVisible);
    dimensionsLayers.forEach((l: any, i: number) => l.visible(originalDimensionsVisibilities[i]));
    bg.destroy();
    stage.draw();
  }

  pdf.save(finalFilename);
  
  // Restore original floor and ghost floors state
  updateProject({ currentFloorId: originalFloorId, showGhostFloors: originalShowGhostFloors });
}

/**
 * Triggers a PNG download of the current floor with a watermark.
 */
export async function downloadPNG(
  stage: any,
  filename: string = "AuraNook_plano.png",
  options: { showGrid: boolean; showDimensions: boolean; scale?: string },
  pixelsPerMeter: number,
  project: Project,
  t: (key: string) => string
) {
  if (!stage) return;

  const finalFilename = filename.startsWith("AuraNook") ? filename : `AuraNook_${filename}`;

  // 1. Calculate bounding box of the current floor
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let hasContent = false;

  const currentFloor = project.floors.find(f => f.id === project.currentFloorId);
  if (!currentFloor) return;

  // Check walls
  currentFloor.walls.forEach(w => {
    minX = Math.min(minX, w.start.x, w.end.x);
    minY = Math.min(minY, w.start.y, w.end.y);
    maxX = Math.max(maxX, w.start.x, w.end.x);
    maxY = Math.max(maxY, w.start.y, w.end.y);
    hasContent = true;
  });
  // Check rooms
  currentFloor.rooms.forEach(r => {
    r.points.forEach(p => {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
      hasContent = true;
    });
  });
  // Check furniture
  currentFloor.furniture.forEach(f => {
    const hw = (f.width / 100 * pixelsPerMeter) / 2;
    const hh = (f.height / 100 * pixelsPerMeter) / 2;
    minX = Math.min(minX, f.x - hw);
    minY = Math.min(minY, f.y - hh);
    maxX = Math.max(maxX, f.x + hw);
    maxY = Math.max(maxY, f.y + hh);
    hasContent = true;
  });

  const padding = 100;
  const exportX = hasContent ? minX - padding : 0;
  const exportY = hasContent ? minY - padding : 0;
  const exportWidth = hasContent ? (maxX - minX) + padding * 2 : stage.width();
  const exportHeight = hasContent ? (maxY - minY) + padding * 2 : stage.height();

  const layer = stage.getLayers()[0];
  const gridLayer = stage.findOne('.grid-layer');
  const dimensionsLayers = stage.find('.dimensions-layer');

  // Store original state
  const originalPos = stage.position();
  const originalScale = stage.scale();
  const originalWidth = stage.width();
  const originalHeight = stage.height();
  const originalGridVisible = gridLayer?.visible();
  const originalDimensionsVisibilities = dimensionsLayers.map((l: any) => l.visible());

  // Reset stage transform for consistent capture
  stage.width(exportWidth);
  stage.height(exportHeight);
  stage.position({ x: -exportX, y: -exportY });
  stage.scale({ x: 1, y: 1 });

  // Apply final visibility for export
  if (gridLayer) gridLayer.visible(options.showGrid);
  dimensionsLayers.forEach((l: any) => l.visible(options.showDimensions));

  // Add a white background for PNG export to avoid transparency issues
  const bg = new Konva.Rect({
    width: exportWidth,
    height: exportHeight,
    x: exportX,
    y: exportY,
    fill: 'white',
    name: 'temp-bg'
  });
  layer.add(bg);
  bg.moveToBottom();

  // Add a temporary watermark
  const watermark = new Konva.Text({
    text: t('print.watermark'),
    fontSize: 24,
    fontFamily: 'Inter',
    fill: '#141414',
    opacity: 0.8,
    x: exportX + exportWidth - 300,
    y: exportY + exportHeight - 50,
    fontStyle: 'italic bold',
    name: 'temp-watermark'
  });
  
  layer.add(watermark);
  stage.draw();

  const dataUrl = stage.toDataURL({ 
    pixelRatio: 2,
    x: 0,
    y: 0,
    width: exportWidth,
    height: exportHeight,
    mimeType: 'image/png'
  });

  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = finalFilename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Restore original state
  stage.width(originalWidth);
  stage.height(originalHeight);
  stage.position(originalPos);
  stage.scale(originalScale);
  if (gridLayer) gridLayer.visible(originalGridVisible);
  dimensionsLayers.forEach((l: any, i: number) => l.visible(originalDimensionsVisibilities[i]));
  bg.destroy();
  watermark.destroy();
  stage.draw();
}

