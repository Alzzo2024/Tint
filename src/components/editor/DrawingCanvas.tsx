import { useEffect, useRef, useState } from "react";
import type { TintEngine } from "@/lib/drawing/engine";
import type { BrushSettings } from "@/lib/drawing/brushes";

interface Props {
  engine: TintEngine;
  brush: BrushSettings;
  /** Quando true, próximo toque ativa conta-gotas em vez de pintar. */
  eyedropper: boolean;
  onPickColor: (hex: string) => void;
  onUndoGesture: () => void;
  onRedoGesture: () => void;
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
  kind: "none" | "transform";
  startDist: number;
  startAngle: number;
  startMidX: number;
  startMidY: number;
  startScale: number;
  startRotation: number;
  startTx: number;
  startTy: number;
}

/** Componente da tela: render + gestos + traços + pinça. */
export function DrawingCanvas({
  engine,
  brush,
  eyedropper,
  onPickColor,
  onUndoGesture,
  onRedoGesture,
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
  });
  const drawingIdRef = useRef<number | null>(null);
  const eyedropperHoldRef = useRef<number | null>(null);
  const [, force] = useState(0);

  // Render loop quando engine fica suja
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

  // Subscrever para forçar render em mudanças (e.g. add layer)
  useEffect(() => {
    return engine.subscribe(() => force((n) => n + 1));
  }, [engine]);

  // Resize do canvas físico
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
      // Reposicionar vista inicial
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

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const cont = containerRef.current!;
    cont.setPointerCapture(e.pointerId);
    const { x, y } = getLocal(e);
    // Palm rejection: se já há um stylus a desenhar, ignorar touches extra.
    if (drawingIdRef.current !== null) {
      // Aceitar como segundo dedo apenas para gesto se for "touch" e o ativo for também touch
      const active = pointersRef.current.get(drawingIdRef.current);
      if (active && active.type === "pen" && e.pointerType !== "pen") {
        return;
      }
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

    const count = pointersRef.current.size;
    if (count >= 2) {
      // entrar em modo transform; cancelar traço atual
      if (drawingIdRef.current !== null) {
        engine.endStroke();
        drawingIdRef.current = null;
      }
      startTransform();
      return;
    }

    // 1 ponteiro → começar a desenhar (ou eyedropper, ou hold)
    if (eyedropper) {
      const { x: cx, y: cy } = engine.screenToCanvas(x, y);
      const c = engine.pickColor(cx, cy);
      if (c) onPickColor(c);
      return;
    }
    drawingIdRef.current = e.pointerId;
    engine.beginStroke();
    const { x: cx, y: cy } = engine.screenToCanvas(x, y);
    const pressure = e.pressure > 0 ? e.pressure : e.pointerType === "pen" ? 0.5 : 1;
    engine.addStrokePoint(cx, cy, pressure, brush);

    // Press-and-hold para conta-gotas (1.2s)
    if (eyedropperHoldRef.current) window.clearTimeout(eyedropperHoldRef.current);
    eyedropperHoldRef.current = window.setTimeout(() => {
      const p = pointersRef.current.get(e.pointerId);
      if (!p || p.moved) return;
      // cancelar traço, fazer pick
      if (drawingIdRef.current !== null) {
        engine.endStroke();
        engine.undo(); // anular o pequeno ponto desenhado
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
    if (drawingIdRef.current === e.pointerId) {
      // Usar eventos coalescidos para suavidade
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

  function getLocalFromEvent(ev: PointerEvent) {
    const rect = containerRef.current!.getBoundingClientRect();
    return { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
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
    if (pointersRef.current.size < 2 && gestureRef.current.kind === "transform") {
      gestureRef.current.kind = "none";
    }

    // Detetar gestos de N-finger tap (todos os dedos para cima ao mesmo tempo)
    if (p && !p.moved && pointersRef.current.size === 0) {
      detectMultiFingerTap();
    }
  }

  // ---- Multi-finger tap detection (2 = undo, 3 = redo) ----
  const tapBufferRef = useRef<{ time: number; count: number }>({
    time: 0,
    count: 0,
  });
  function detectMultiFingerTap() {
    // Quando o último dedo sobe, olha para quantos dedos havia simultaneamente.
    // Mantemos um pequeno contador através de pointerdown.
    const buf = tapBufferRef.current;
    const now = performance.now();
    if (buf.count >= 3 && now - buf.time < 600) {
      onRedoGesture();
    } else if (buf.count === 2 && now - buf.time < 600) {
      onUndoGesture();
    }
    tapBufferRef.current = { time: 0, count: 0 };
  }

  // Atualizar buffer no pointerdown: registar o pico de dedos
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

    // Aplicar transform mantendo o ponto médio como pivô.
    const dxMid = midX - g.startMidX;
    const dyMid = midY - g.startMidY;
    // Reposicionamento: trasladar o origem para o midpoint inicial, rodar+escalar, voltar
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

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 touch-none overflow-hidden"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{
        background:
          "radial-gradient(circle at 50% 50%, #232323 0%, #141414 100%)",
        cursor: eyedropper ? "crosshair" : "default",
      }}
    >
      <canvas ref={canvasRef} className="block" />
    </div>
  );
}
