import { useEffect, useRef, useState } from "react";
import type { TintEngine } from "@/lib/drawing/engine";
import type { BrushSettings } from "@/lib/drawing/brushes";

export type ToolMode = "brush" | "eyedropper" | "fill" | "select" | "pan" | "text";

interface Props {
  engine: TintEngine;
  brush: BrushSettings;
  tool: ToolMode;
  onPickColor: (hex: string) => void;
  onUndoGesture: () => void;
  onRedoGesture: () => void;
  /** Após uso single-shot (eyedropper / fill / select concluído), voltar ao pincel. */
  onToolConsumed?: () => void;
  /** Texto novo: pediu inserir um texto em (canvasX, canvasY). */
  onTextAt?: (canvasX: number, canvasY: number) => void;
}

interface ActivePointer {
  id: number;
  type: string;
  x: number;
  y: number;
  startX: number;
  startY: number;
  startTime: number;
  moved: boolean;
}

interface GestureState {
  kind: "none" | "transform" | "select";
  startDist: number;
  startAngle: number;
  startMidX: number;
  startMidY: number;
  startScale: number;
  startRotation: number;
  startTx: number;
  startTy: number;
  selStartX: number;
  selStartY: number;
}

export function DrawingCanvas({
  engine,
  brush,
  tool,
  onPickColor,
  onUndoGesture,
  onRedoGesture,
  onToolConsumed,
  onTextAt,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pointersRef = useRef<Map<number, ActivePointer>>(new Map());
  const gestureRef = useRef<GestureState>({
    kind: "none",
    startDist: 0,
    startAngle: 0,
    startMidX: 0,
    startMidY: 0,
    startScale: 1,
    startRotation: 0,
    startTx: 0,
    startTy: 0,
    selStartX: 0,
    selStartY: 0,
  });
  const drawingIdRef = useRef<number | null>(null);
  const eyedropperHoldRef = useRef<number | null>(null);
  const textDragRef = useRef<{ id: string; offX: number; offY: number } | null>(null);
  const [, force] = useState(0);

  // Render loop
  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    let raf = 0;
    const tick = () => {
      if (engine.isDirty()) {
        engine.render(cvs);
        engine.clearDirty();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [engine]);

  useEffect(() => {
    return engine.subscribe(() => force((n) => n + 1));
  }, [engine]);

  useEffect(() => {
    const cont = containerRef.current;
    const cvs = canvasRef.current;
    if (!cont || !cvs) return;
    const ro = new ResizeObserver(() => {
      const dpr = window.devicePixelRatio || 1;
      const rect = cont.getBoundingClientRect();
      cvs.width = Math.round(rect.width * dpr);
      cvs.height = Math.round(rect.height * dpr);
      cvs.style.width = rect.width + "px";
      cvs.style.height = rect.height + "px";
      const ctx = cvs.getContext("2d")!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (engine.view.tx === 0 && engine.view.ty === 0) {
        engine.resetView(rect.width, rect.height);
      }
      engine.notify();
    });
    ro.observe(cont);
    return () => ro.disconnect();
  }, [engine]);

  function getLocal(e: PointerEvent | React.PointerEvent) {
    const rect = containerRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }
  function getLocalFromEvent(ev: PointerEvent) {
    const rect = containerRef.current!.getBoundingClientRect();
    return { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const cont = containerRef.current!;
    cont.setPointerCapture(e.pointerId);
    const { x, y } = getLocal(e);
    if (drawingIdRef.current !== null) {
      const active = pointersRef.current.get(drawingIdRef.current);
      if (active && active.type === "pen" && e.pointerType !== "pen") return;
    }
    pointersRef.current.set(e.pointerId, {
      id: e.pointerId,
      type: e.pointerType,
      x,
      y,
      startX: x,
      startY: y,
      startTime: performance.now(),
      moved: false,
    });

    if (pointersRef.current.size >= 2) {
      if (drawingIdRef.current !== null) {
        engine.endStroke();
        drawingIdRef.current = null;
      }
      if (gestureRef.current.kind === "select") {
        gestureRef.current.kind = "none";
      }
      startTransform();
      return;
    }

    const canvasPt = engine.screenToCanvas(x, y);

    if (tool === "eyedropper") {
      const c = engine.pickColor(canvasPt.x, canvasPt.y);
      if (c) onPickColor(c);
      onToolConsumed?.();
      return;
    }
    if (tool === "fill") {
      engine.fillAt(canvasPt.x, canvasPt.y, brush.color);
      onToolConsumed?.();
      return;
    }
    if (tool === "select") {
      gestureRef.current.kind = "select";
      gestureRef.current.selStartX = canvasPt.x;
      gestureRef.current.selStartY = canvasPt.y;
      engine.setSelection({ x: canvasPt.x, y: canvasPt.y, w: 0, h: 0 });
      return;
    }
    if (tool === "text") {
      const hit = engine.pickTextAt(canvasPt.x, canvasPt.y);
      if (hit) {
        const t = engine.texts.find((x) => x.id === hit)!;
        engine.activeTextId = hit;
        textDragRef.current = { id: hit, offX: canvasPt.x - t.x, offY: canvasPt.y - t.y };
        engine.notify();
        return;
      }
      engine.activeTextId = null;
      engine.notify();
      onTextAt?.(canvasPt.x, canvasPt.y);
      return;
    }
    if (tool === "pan") {
      // single-finger pan: register a transform start with imaginary 2nd anchor
      const g = gestureRef.current;
      g.kind = "transform";
      g.startDist = 1;
      g.startAngle = 0;
      g.startMidX = x;
      g.startMidY = y;
      g.startScale = engine.view.scale;
      g.startRotation = engine.view.rotation;
      g.startTx = engine.view.tx;
      g.startTy = engine.view.ty;
      return;
    }


    drawingIdRef.current = e.pointerId;
    engine.beginStroke();
    const pressure = e.pressure > 0 ? e.pressure : e.pointerType === "pen" ? 0.5 : 1;
    engine.addStrokePoint(canvasPt.x, canvasPt.y, pressure, brush);

    // press-and-hold eyedropper
    if (eyedropperHoldRef.current) window.clearTimeout(eyedropperHoldRef.current);
    eyedropperHoldRef.current = window.setTimeout(() => {
      const p = pointersRef.current.get(e.pointerId);
      if (!p || p.moved) return;
      if (drawingIdRef.current !== null) {
        engine.endStroke();
        engine.undo();
        drawingIdRef.current = null;
      }
      const { x: cx2, y: cy2 } = engine.screenToCanvas(p.x, p.y);
      const c = engine.pickColor(cx2, cy2);
      if (c) onPickColor(c);
    }, 700);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const p = pointersRef.current.get(e.pointerId);
    if (!p) return;
    const { x, y } = getLocal(e);
    if (Math.hypot(x - p.startX, y - p.startY) > 4) p.moved = true;
    p.x = x;
    p.y = y;

    if (pointersRef.current.size >= 2) {
      updateTransform();
      return;
    }
    if (tool === "pan" && gestureRef.current.kind === "transform") {
      const g = gestureRef.current;
      engine.view.tx = g.startTx + (x - g.startMidX);
      engine.view.ty = g.startTy + (y - g.startMidY);
      engine.notify();
      return;
    }
    if (textDragRef.current) {
      const cur = engine.screenToCanvas(x, y);
      const d = textDragRef.current;
      engine.moveText(d.id, cur.x - d.offX, cur.y - d.offY);
      return;
    }
    if (gestureRef.current.kind === "select") {
      const cur = engine.screenToCanvas(x, y);
      const g = gestureRef.current;
      const sx = Math.min(g.selStartX, cur.x);
      const sy = Math.min(g.selStartY, cur.y);
      const sw = Math.abs(cur.x - g.selStartX);
      const sh = Math.abs(cur.y - g.selStartY);
      engine.setSelection({ x: sx, y: sy, w: sw, h: sh });
      return;
    }
    if (drawingIdRef.current === e.pointerId) {
      const events = (e.nativeEvent as PointerEvent).getCoalescedEvents?.() ?? [
        e.nativeEvent,
      ];
      for (const ev of events) {
        const lp = getLocalFromEvent(ev);
        const { x: cx, y: cy } = engine.screenToCanvas(lp.x, lp.y);
        const pressure = ev.pressure > 0 ? ev.pressure : ev.pointerType === "pen" ? 0.5 : 1;
        engine.addStrokePoint(cx, cy, pressure, brush);
      }
    }
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    const p = pointersRef.current.get(e.pointerId);
    pointersRef.current.delete(e.pointerId);
    if (eyedropperHoldRef.current) {
      window.clearTimeout(eyedropperHoldRef.current);
      eyedropperHoldRef.current = null;
    }
    if (drawingIdRef.current === e.pointerId) {
      engine.endStroke();
      drawingIdRef.current = null;
    }
    if (textDragRef.current) textDragRef.current = null;
    if (gestureRef.current.kind === "select" && pointersRef.current.size === 0) {
      gestureRef.current.kind = "none";
    }
    if (pointersRef.current.size < 2 && gestureRef.current.kind === "transform") {
      gestureRef.current.kind = "none";
    }
    if (p && !p.moved && pointersRef.current.size === 0) {
      detectMultiFingerTap();
    }
  }

  const tapBufferRef = useRef<{ time: number; count: number }>({ time: 0, count: 0 });
  function detectMultiFingerTap() {
    const buf = tapBufferRef.current;
    const now = performance.now();
    if (buf.count >= 3 && now - buf.time < 600) onRedoGesture();
    else if (buf.count === 2 && now - buf.time < 600) onUndoGesture();
    tapBufferRef.current = { time: 0, count: 0 };
  }

  useEffect(() => {
    const cont = containerRef.current;
    if (!cont) return;
    const onDown = () => {
      const c = pointersRef.current.size;
      const buf = tapBufferRef.current;
      if (c === 1) buf.time = performance.now();
      if (c > buf.count) buf.count = c;
    };
    cont.addEventListener("pointerdown", onDown);
    return () => cont.removeEventListener("pointerdown", onDown);
  }, []);

  function startTransform() {
    const pts = [...pointersRef.current.values()].slice(0, 2);
    if (pts.length < 2) return;
    const [a, b] = pts;
    const g = gestureRef.current;
    g.kind = "transform";
    g.startDist = Math.hypot(b.x - a.x, b.y - a.y);
    g.startAngle = Math.atan2(b.y - a.y, b.x - a.x);
    g.startMidX = (a.x + b.x) / 2;
    g.startMidY = (a.y + b.y) / 2;
    g.startScale = engine.view.scale;
    g.startRotation = engine.view.rotation;
    g.startTx = engine.view.tx;
    g.startTy = engine.view.ty;
  }

  function updateTransform() {
    const pts = [...pointersRef.current.values()].slice(0, 2);
    if (pts.length < 2) return;
    const [a, b] = pts;
    const g = gestureRef.current;
    if (g.kind !== "transform") return;
    const dist = Math.hypot(b.x - a.x, b.y - a.y);
    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    const midX = (a.x + b.x) / 2;
    const midY = (a.y + b.y) / 2;
    const scaleFactor = dist / g.startDist;
    const rotDelta = angle - g.startAngle;
    const newScale = Math.max(0.05, Math.min(20, g.startScale * scaleFactor));
    const dxMid = midX - g.startMidX;
    const dyMid = midY - g.startMidY;
    const cos = Math.cos(rotDelta);
    const sin = Math.sin(rotDelta);
    const ox = g.startTx - g.startMidX;
    const oy = g.startTy - g.startMidY;
    const newOx = (ox * cos - oy * sin) * scaleFactor;
    const newOy = (ox * sin + oy * cos) * scaleFactor;
    engine.view.scale = newScale;
    engine.view.rotation = g.startRotation + rotDelta;
    engine.view.tx = newOx + g.startMidX + dxMid;
    engine.view.ty = newOy + g.startMidY + dyMid;
    engine.notify();
  }

  const cursor =
    tool === "eyedropper"
      ? "crosshair"
      : tool === "fill"
        ? "cell"
        : tool === "select"
          ? "crosshair"
          : tool === "pan"
            ? "grab"
            : tool === "text"
              ? "text"
              : "default";

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 touch-none overflow-hidden"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{
        background: "radial-gradient(circle at 50% 50%, #232323 0%, #141414 100%)",
        cursor,
      }}
    >
      <canvas ref={canvasRef} className="block" />
    </div>
  );
}
