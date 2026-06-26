/**
 * Pincéis. Cada pincel é apenas uma função que recebe (canvas, prevPoint,
 * point, settings) e desenha o segmento. O motor lida com pressure smoothing
 * e estabilização; aqui é só estética.
 */

export type BrushKind = "pencil" | "pen" | "airbrush" | "marker" | "eraser";

export interface BrushSettings {
  kind: BrushKind;
  color: string;
  size: number; // px no espaço da tela
  opacity: number; // 0..1
  stabilizer?: number; // 0..0.95
}

interface Point {
  x: number;
  y: number;
  p: number;
}

/** Distância utilitária. */
function dist(a: Point, b: Point) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function renderStrokeSegment(
  target: OffscreenCanvas,
  prev: Point,
  curr: Point,
  s: BrushSettings,
) {
  const ctx = target.getContext("2d")!;
  ctx.save();
  switch (s.kind) {
    case "pencil":
      drawPencil(ctx, prev, curr, s);
      break;
    case "pen":
      drawPen(ctx, prev, curr, s);
      break;
    case "marker":
      drawMarker(ctx, prev, curr, s);
      break;
    case "airbrush":
      drawAirbrush(ctx, prev, curr, s);
      break;
    case "eraser":
      drawEraser(ctx, prev, curr, s);
      break;
  }
  ctx.restore();
}

function drawPen(
  ctx: OffscreenCanvasRenderingContext2D,
  a: Point,
  b: Point,
  s: BrushSettings,
) {
  const size = s.size * (0.3 + 0.7 * b.p);
  ctx.globalAlpha = s.opacity;
  ctx.strokeStyle = s.color;
  ctx.lineWidth = size;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
}

function drawMarker(
  ctx: OffscreenCanvasRenderingContext2D,
  a: Point,
  b: Point,
  s: BrushSettings,
) {
  ctx.globalAlpha = s.opacity * 0.55;
  ctx.strokeStyle = s.color;
  ctx.lineWidth = s.size;
  ctx.lineCap = "square";
  ctx.lineJoin = "miter";
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
}

function drawPencil(
  ctx: OffscreenCanvasRenderingContext2D,
  a: Point,
  b: Point,
  s: BrushSettings,
) {
  // Espalhar pontinhos ao longo do segmento → textura granular.
  const d = Math.max(1, dist(a, b));
  const steps = Math.ceil(d / Math.max(1, s.size * 0.4));
  ctx.fillStyle = s.color;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = a.x + (b.x - a.x) * t;
    const y = a.y + (b.y - a.y) * t;
    const p = a.p + (b.p - a.p) * t;
    const radius = (s.size / 2) * (0.4 + 0.6 * p);
    const grains = 5;
    for (let g = 0; g < grains; g++) {
      const ang = Math.random() * Math.PI * 2;
      const r = Math.random() * radius;
      const px = x + Math.cos(ang) * r;
      const py = y + Math.sin(ang) * r;
      ctx.globalAlpha = s.opacity * (0.15 + Math.random() * 0.35);
      ctx.beginPath();
      ctx.arc(px, py, 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawAirbrush(
  ctx: OffscreenCanvasRenderingContext2D,
  a: Point,
  b: Point,
  s: BrushSettings,
) {
  const d = Math.max(1, dist(a, b));
  const steps = Math.ceil(d / Math.max(1, s.size * 0.25));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = a.x + (b.x - a.x) * t;
    const y = a.y + (b.y - a.y) * t;
    const radius = s.size;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
    const op = s.opacity * 0.12 * (0.4 + 0.6 * (a.p + b.p) / 2);
    grad.addColorStop(0, withAlpha(s.color, op));
    grad.addColorStop(1, withAlpha(s.color, 0));
    ctx.globalAlpha = 1;
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawEraser(
  ctx: OffscreenCanvasRenderingContext2D,
  a: Point,
  b: Point,
  s: BrushSettings,
) {
  ctx.globalCompositeOperation = "destination-out";
  ctx.globalAlpha = s.opacity;
  ctx.strokeStyle = "#000";
  ctx.lineWidth = s.size * (0.3 + 0.7 * b.p);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
}

function withAlpha(hex: string, alpha: number): string {
  // hex #rrggbb → rgba
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
