import { nanoid } from "nanoid";
import { db, type LayerRow } from "../db";
import { renderStrokeSegment, type BrushKind, type BrushSettings } from "./brushes";
import { floodFill } from "./fill";

export type SymmetryMode = "none" | "horizontal" | "vertical" | "both";

export interface Selection {
  x: number;
  y: number;
  w: number;
  h: number;
}


/**
 * In-memory state for an opened project. Layers live as OffscreenCanvas; we
 * compose them on the visible canvas with the user's view transform.
 *
 * Undo/redo guarda snapshots ImageData da camada ativa antes de cada traço.
 * Limite 40 estados para não rebentar memória em telas grandes.
 */

export interface LayerState {
  id: string;
  name: string;
  order: number;
  opacity: number;
  visible: boolean;
  canvas: OffscreenCanvas;
}

interface HistoryEntry {
  layerId: string;
  before: ImageData;
  after: ImageData;
}

export interface ViewTransform {
  scale: number;
  rotation: number; // radianos
  tx: number; // px no espaço do ecrã
  ty: number;
}

const HISTORY_LIMIT = 40;

export class TintEngine {
  width: number;
  height: number;
  projectId: string;
  layers: LayerState[] = [];
  activeLayerId: string = "";

  view: ViewTransform = { scale: 1, rotation: 0, tx: 0, ty: 0 };
  flipH = false;
  symmetry: SymmetryMode = "none";
  showGuides = false;
  gridSize = 64;
  selection: Selection | null = null;

  private history: HistoryEntry[] = [];
  private future: HistoryEntry[] = [];

  // Render callbacks
  private listeners = new Set<() => void>();
  private dirty = true;

  // Stroke-in-progress state
  private strokeLayerId: string | null = null;
  private strokeSnapshot: ImageData | null = null;
  private lastPoint: { x: number; y: number; p: number } | null = null;
  private smoothedPoints: { x: number; y: number; p: number }[] = [];

  constructor(projectId: string, width: number, height: number) {
    this.projectId = projectId;
    this.width = width;
    this.height = height;
  }

  static async load(projectId: string): Promise<TintEngine> {
    const proj = await db().projects.get(projectId);
    if (!proj) throw new Error("Project not found");
    const eng = new TintEngine(projectId, proj.width, proj.height);
    const rows = await db()
      .layers.where("projectId")
      .equals(projectId)
      .sortBy("order");
    for (const row of rows) {
      const canvas = new OffscreenCanvas(proj.width, proj.height);
      const ctx = canvas.getContext("2d")!;
      if (row.blob.size > 0) {
        const bmp = await createImageBitmap(row.blob);
        ctx.drawImage(bmp, 0, 0);
        bmp.close();
      }
      eng.layers.push({
        id: row.id,
        name: row.name,
        order: row.order,
        opacity: row.opacity,
        visible: row.visible,
        canvas,
      });
    }
    if (eng.layers.length === 0) {
      eng.layers.push(eng.makeBlankLayer("Layer 1", 0));
    }
    eng.activeLayerId = eng.layers[eng.layers.length - 1].id;
    return eng;
  }

  private makeBlankLayer(name: string, order: number): LayerState {
    return {
      id: nanoid(12),
      name,
      order,
      opacity: 1,
      visible: true,
      canvas: new OffscreenCanvas(this.width, this.height),
    };
  }

  // ---- Subscriptions ----
  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  notify() {
    this.dirty = true;
    for (const fn of this.listeners) fn();
  }
  isDirty() {
    return this.dirty;
  }
  clearDirty() {
    this.dirty = false;
  }

  // ---- Layer ops ----
  get activeLayer(): LayerState | null {
    return this.layers.find((l) => l.id === this.activeLayerId) ?? null;
  }
  setActiveLayer(id: string) {
    if (this.layers.some((l) => l.id === id)) {
      this.activeLayerId = id;
      this.notify();
    }
  }
  addLayer() {
    const order = this.layers.length;
    const layer = this.makeBlankLayer(`Layer ${order + 1}`, order);
    this.layers.push(layer);
    this.activeLayerId = layer.id;
    this.notify();
  }
  duplicateLayer(id: string) {
    const idx = this.layers.findIndex((l) => l.id === id);
    if (idx < 0) return;
    const src = this.layers[idx];
    const c = new OffscreenCanvas(this.width, this.height);
    c.getContext("2d")!.drawImage(src.canvas, 0, 0);
    const copy: LayerState = {
      ...src,
      id: nanoid(12),
      name: `${src.name} copy`,
      canvas: c,
    };
    this.layers.splice(idx + 1, 0, copy);
    this.reorder();
    this.activeLayerId = copy.id;
    this.notify();
  }
  deleteLayer(id: string) {
    if (this.layers.length <= 1) return;
    const idx = this.layers.findIndex((l) => l.id === id);
    if (idx < 0) return;
    this.layers.splice(idx, 1);
    this.reorder();
    if (this.activeLayerId === id) {
      this.activeLayerId = this.layers[Math.max(0, idx - 1)].id;
    }
    this.notify();
  }
  clearLayer(id: string) {
    const l = this.layers.find((x) => x.id === id);
    if (!l) return;
    const ctx = l.canvas.getContext("2d")!;
    const before = ctx.getImageData(0, 0, this.width, this.height);
    ctx.clearRect(0, 0, this.width, this.height);
    const after = ctx.getImageData(0, 0, this.width, this.height);
    this.pushHistory({ layerId: id, before, after });
    this.notify();
  }
  setLayerOpacity(id: string, opacity: number) {
    const l = this.layers.find((x) => x.id === id);
    if (!l) return;
    l.opacity = Math.max(0, Math.min(1, opacity));
    this.notify();
  }
  setLayerVisible(id: string, visible: boolean) {
    const l = this.layers.find((x) => x.id === id);
    if (!l) return;
    l.visible = visible;
    this.notify();
  }
  moveLayer(id: string, dir: -1 | 1) {
    const idx = this.layers.findIndex((l) => l.id === id);
    if (idx < 0) return;
    const j = idx + dir;
    if (j < 0 || j >= this.layers.length) return;
    [this.layers[idx], this.layers[j]] = [this.layers[j], this.layers[idx]];
    this.reorder();
    this.notify();
  }
  mergeDown(id: string) {
    const idx = this.layers.findIndex((l) => l.id === id);
    if (idx <= 0) return;
    const top = this.layers[idx];
    const bottom = this.layers[idx - 1];
    const ctx = bottom.canvas.getContext("2d")!;
    ctx.save();
    ctx.globalAlpha = top.opacity;
    ctx.drawImage(top.canvas, 0, 0);
    ctx.restore();
    this.layers.splice(idx, 1);
    this.reorder();
    if (this.activeLayerId === id) this.activeLayerId = bottom.id;
    this.notify();
  }
  private reorder() {
    this.layers.forEach((l, i) => (l.order = i));
  }

  // ---- History ----
  private pushHistory(entry: HistoryEntry) {
    this.history.push(entry);
    if (this.history.length > HISTORY_LIMIT) this.history.shift();
    this.future.length = 0;
  }
  undo() {
    const e = this.history.pop();
    if (!e) return;
    const l = this.layers.find((x) => x.id === e.layerId);
    if (!l) return;
    l.canvas.getContext("2d")!.putImageData(e.before, 0, 0);
    this.future.push(e);
    this.notify();
  }
  redo() {
    const e = this.future.pop();
    if (!e) return;
    const l = this.layers.find((x) => x.id === e.layerId);
    if (!l) return;
    l.canvas.getContext("2d")!.putImageData(e.after, 0, 0);
    this.history.push(e);
    this.notify();
  }
  canUndo() {
    return this.history.length > 0;
  }
  canRedo() {
    return this.future.length > 0;
  }

  // ---- Strokes ----
  beginStroke() {
    const l = this.activeLayer;
    if (!l) return;
    this.strokeLayerId = l.id;
    this.strokeSnapshot = l.canvas
      .getContext("2d")!
      .getImageData(0, 0, this.width, this.height);
    this.lastPoint = null;
    this.smoothedPoints = [];
  }

  addStrokePoint(
    x: number,
    y: number,
    pressure: number,
    brush: BrushSettings,
  ) {
    const l = this.activeLayer;
    if (!l || this.strokeLayerId !== l.id) return;
    const stab = brush.stabilizer ?? 0;
    let px = x;
    let py = y;
    if (stab > 0 && this.lastPoint) {
      const t = Math.max(0.05, 1 - stab);
      px = this.lastPoint.x + (x - this.lastPoint.x) * t;
      py = this.lastPoint.y + (y - this.lastPoint.y) * t;
    }
    const point = { x: px, y: py, p: pressure };
    if (this.lastPoint) {
      renderStrokeSegment(l.canvas, this.lastPoint, point, brush);
    } else {
      renderStrokeSegment(l.canvas, point, point, brush);
    }
    this.lastPoint = point;
    this.smoothedPoints.push(point);
    this.notify();
  }

  endStroke() {
    const l = this.activeLayer;
    if (!l || !this.strokeSnapshot || this.strokeLayerId !== l.id) {
      this.strokeLayerId = null;
      this.strokeSnapshot = null;
      this.lastPoint = null;
      return;
    }
    const after = l.canvas
      .getContext("2d")!
      .getImageData(0, 0, this.width, this.height);
    this.pushHistory({
      layerId: l.id,
      before: this.strokeSnapshot,
      after,
    });
    this.strokeLayerId = null;
    this.strokeSnapshot = null;
    this.lastPoint = null;
    this.smoothedPoints = [];
  }

  // ---- View ----
  resetView(viewportW: number, viewportH: number) {
    const sx = viewportW / this.width;
    const sy = viewportH / this.height;
    this.view.scale = Math.min(sx, sy) * 0.92;
    this.view.rotation = 0;
    this.view.tx = viewportW / 2;
    this.view.ty = viewportH / 2;
    this.notify();
  }
  flipHorizontal() {
    this.flipH = !this.flipH;
    this.notify();
  }

  /** Converte coords do ecrã → coords da tela. */
  screenToCanvas(sx: number, sy: number): { x: number; y: number } {
    const { scale, rotation, tx, ty } = this.view;
    const dx = sx - tx;
    const dy = sy - ty;
    const cos = Math.cos(-rotation);
    const sin = Math.sin(-rotation);
    let ux = (dx * cos - dy * sin) / scale;
    let uy = (dx * sin + dy * cos) / scale;
    if (this.flipH) ux = -ux;
    return { x: ux + this.width / 2, y: uy + this.height / 2 };
  }

  // ---- Render to a visible canvas ----
  render(target: HTMLCanvasElement) {
    const ctx = target.getContext("2d")!;
    ctx.save();
    ctx.clearRect(0, 0, target.width, target.height);
    ctx.translate(this.view.tx, this.view.ty);
    ctx.rotate(this.view.rotation);
    ctx.scale(this.view.scale * (this.flipH ? -1 : 1), this.view.scale);
    ctx.translate(-this.width / 2, -this.height / 2);

    // Fundo "papel" branco da tela
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, this.width, this.height);

    // Sombra suave da tela
    for (const l of this.layers) {
      if (!l.visible) continue;
      ctx.globalAlpha = l.opacity;
      ctx.drawImage(l.canvas, 0, 0);
    }
    ctx.globalAlpha = 1;

    // Borda da tela
    ctx.lineWidth = 1 / this.view.scale;
    ctx.strokeStyle = "rgba(0,0,0,0.25)";
    ctx.strokeRect(0, 0, this.width, this.height);

    ctx.restore();
  }

  // ---- Color picker ----
  pickColor(canvasX: number, canvasY: number): string | null {
    const x = Math.floor(canvasX);
    const y = Math.floor(canvasY);
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return null;
    // Compor a partir das camadas visíveis
    for (let i = this.layers.length - 1; i >= 0; i--) {
      const l = this.layers[i];
      if (!l.visible) continue;
      const d = l.canvas.getContext("2d")!.getImageData(x, y, 1, 1).data;
      if (d[3] > 8) {
        return `#${[d[0], d[1], d[2]]
          .map((v) => v.toString(16).padStart(2, "0"))
          .join("")}`;
      }
    }
    return "#ffffff";
  }

  // ---- Persistence ----
  async saveAll(): Promise<Blob> {
    const rows: LayerRow[] = [];
    for (const l of this.layers) {
      const blob = await l.canvas.convertToBlob({ type: "image/png" });
      rows.push({
        id: l.id,
        projectId: this.projectId,
        name: l.name,
        order: l.order,
        opacity: l.opacity,
        visible: l.visible,
        blob,
      });
    }
    await db().transaction("rw", db().layers, db().projects, async () => {
      await db().layers.where("projectId").equals(this.projectId).delete();
      await db().layers.bulkPut(rows);
    });
    // Thumbnail
    const tw = 256;
    const th = Math.round((this.height / this.width) * tw);
    const tc = new OffscreenCanvas(tw, th);
    const tctx = tc.getContext("2d")!;
    tctx.fillStyle = "#ffffff";
    tctx.fillRect(0, 0, tw, th);
    for (const l of this.layers) {
      if (!l.visible) continue;
      tctx.globalAlpha = l.opacity;
      tctx.drawImage(l.canvas, 0, 0, tw, th);
    }
    const thumbnail = await tc.convertToBlob({
      type: "image/jpeg",
      quality: 0.7,
    });
    await db().projects.update(this.projectId, {
      updatedAt: Date.now(),
      thumbnail,
    });
    return thumbnail;
  }

  // ---- Export ----
  async exportImage(opts: {
    type: "image/png" | "image/jpeg";
    transparent: boolean;
  }): Promise<Blob> {
    const c = new OffscreenCanvas(this.width, this.height);
    const ctx = c.getContext("2d")!;
    if (!opts.transparent || opts.type === "image/jpeg") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, this.width, this.height);
    }
    for (const l of this.layers) {
      if (!l.visible) continue;
      ctx.globalAlpha = l.opacity;
      ctx.drawImage(l.canvas, 0, 0);
    }
    return await c.convertToBlob({
      type: opts.type,
      quality: opts.type === "image/jpeg" ? 0.92 : undefined,
    });
  }
}

export type { BrushKind, BrushSettings };
