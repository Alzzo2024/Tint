import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Undo2,
  Redo2,
  Layers as LayersIcon,
  Pipette,
  Maximize2,
  Minimize2,
  FlipHorizontal,
  Crosshair,
  Download,
  Pencil,
  PenLine,
  SprayCan,
  Highlighter,
  Eraser,
  Plus,
  Copy,
  Trash2,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  Combine,
  Brush,
  X,
  Check,
  PaintBucket,
  SquareDashed,
  Grid3x3,
  Wand2,
} from "lucide-react";
import { TintEngine, type SymmetryMode } from "@/lib/drawing/engine";
import type { BrushKind, BrushSettings } from "@/lib/drawing/brushes";
import { DrawingCanvas, type ToolMode } from "@/components/editor/DrawingCanvas";
import { ColorWheel } from "@/components/editor/ColorWheel";
import { kvGet, kvSet } from "@/lib/db";


export const Route = createFileRoute("/p/$id")({
  head: () => ({
    meta: [{ title: "Tint — Editor" }],
  }),
  component: EditorPage,
});

function EditorPage() {
  return (
    <ClientOnly fallback={<div className="min-h-screen" />}>
      <Editor />
    </ClientOnly>
  );
}

const BRUSH_KINDS: { kind: BrushKind; icon: React.ComponentType<{ className?: string; strokeWidth?: number }>; nameKey: string }[] = [
  { kind: "pencil", icon: Pencil, nameKey: "tools.pencil" },
  { kind: "pen", icon: PenLine, nameKey: "tools.pen" },
  { kind: "airbrush", icon: SprayCan, nameKey: "tools.airbrush" },
  { kind: "marker", icon: Highlighter, nameKey: "tools.marker" },
  { kind: "eraser", icon: Eraser, nameKey: "tools.eraser" },
];

function Editor() {
  const { id } = Route.useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [engine, setEngine] = useState<TintEngine | null>(null);
  const [, force] = useState(0);
  const [brush, setBrush] = useState<BrushSettings>({
    kind: "pen",
    color: "#1a1a1a",
    size: 8,
    opacity: 1,
    stabilizer: 0.3,
  });
  const [tool, setTool] = useState<ToolMode>("brush");
  const [panel, setPanel] = useState<"none" | "brush" | "color" | "layers" | "export" | "more">(
    "none",
  );

  const [fullscreen, setFullscreen] = useState(false);
  const [recentColors, setRecentColors] = useState<string[]>([
    "#1a1a1a",
    "#ffffff",
    "#ca8fff",
    "#00f0ff",
    "#fec9ff",
  ]);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const saveTimer = useRef<number | null>(null);

  // Carregar engine
  useEffect(() => {
    let alive = true;
    TintEngine.load(id).then((eng) => {
      if (!alive) return;
      setEngine(eng);
    }).catch((err) => {
      console.error(err);
      navigate({ to: "/" });
    });
    return () => {
      alive = false;
    };
  }, [id, navigate]);

  // Carregar cores recentes
  useEffect(() => {
    kvGet<string[]>("recent_colors").then((c) => {
      if (c && c.length) setRecentColors(c);
    });
  }, []);

  // Subscrever engine
  useEffect(() => {
    if (!engine) return;
    return engine.subscribe(() => {
      force((n) => n + 1);
      scheduleSave();
    });
  }, [engine]);

  // Save debounced
  function scheduleSave() {
    if (!engine) return;
    setSaveState("saving");
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      try {
        await engine.saveAll();
        setSaveState("saved");
        window.setTimeout(() => setSaveState("idle"), 1500);
      } catch (e) {
        console.error(e);
        setSaveState("idle");
      }
    }, 1500);
  }

  // Save on unmount
  useEffect(() => {
    return () => {
      if (engine) {
        engine.saveAll().catch(() => {});
      }
    };
  }, [engine]);

  function pushRecentColor(hex: string) {
    setRecentColors((prev) => {
      const filtered = prev.filter((c) => c.toLowerCase() !== hex.toLowerCase());
      const next = [hex, ...filtered].slice(0, 12);
      kvSet("recent_colors", next);
      return next;
    });
  }

  function setColor(hex: string) {
    setBrush((b) => ({ ...b, color: hex }));
    pushRecentColor(hex);
  }

  if (!engine) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-sm text-muted-foreground">A carregar tela…</div>
      </div>
    );
  }

  const activeBrushDef = BRUSH_KINDS.find((b) => b.kind === brush.kind)!;
  const ActiveIcon = activeBrushDef.icon;

  return (
    <div className="fixed inset-0 flex flex-col bg-background">
      <DrawingCanvas
        engine={engine}
        brush={brush}
        tool={tool}
        onPickColor={(c) => {
          setColor(c);
          setTool("brush");
        }}
        onToolConsumed={() => setTool("brush")}
        onUndoGesture={() => engine.undo()}
        onRedoGesture={() => engine.redo()}
      />


      {/* Top bar */}
      {!fullscreen && (
        <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between p-3">
          <div className="pointer-events-auto flex items-center gap-2">
            <Link
              to="/"
              aria-label={t("editor.back")}
              className="glass flex h-11 w-11 items-center justify-center rounded-full"
            >
              <ArrowLeft className="h-5 w-5" strokeWidth={2.5} />
            </Link>
            <div className="glass hidden h-11 items-center gap-2 rounded-full px-4 text-xs text-muted-foreground sm:flex">
              {saveState === "saving" && <span>{t("editor.saving")}</span>}
              {saveState === "saved" && (
                <span className="flex items-center gap-1 text-foreground">
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                  {t("editor.saved")}
                </span>
              )}
            </div>
          </div>
          <div className="pointer-events-auto flex items-center gap-2">
            <IconBtn
              label={t("editor.undo")}
              onClick={() => engine.undo()}
              disabled={!engine.canUndo()}
            >
              <Undo2 className="h-5 w-5" strokeWidth={2.5} />
            </IconBtn>
            <IconBtn
              label={t("editor.redo")}
              onClick={() => engine.redo()}
              disabled={!engine.canRedo()}
            >
              <Redo2 className="h-5 w-5" strokeWidth={2.5} />
            </IconBtn>
            <IconBtn
              label={t("editor.resetView")}
              onClick={() => {
                const r = document
                  .querySelector("canvas")!
                  .getBoundingClientRect();
                engine.resetView(r.width, r.height);
              }}
            >
              <Crosshair className="h-5 w-5" strokeWidth={2.5} />
            </IconBtn>
            <IconBtn
              label={t("editor.flipH")}
              onClick={() => engine.flipHorizontal()}
              active={engine.flipH}
            >
              <FlipHorizontal className="h-5 w-5" strokeWidth={2.5} />
            </IconBtn>
            <IconBtn
              label={t("editor.more")}
              onClick={() => setPanel(panel === "more" ? "none" : "more")}
              active={panel === "more" || engine.symmetry !== "none" || engine.showGuides}
            >
              <Wand2 className="h-5 w-5" strokeWidth={2.5} />
            </IconBtn>
            <IconBtn
              label={t("editor.fullscreen")}
              onClick={() => setFullscreen(true)}
            >
              <Maximize2 className="h-5 w-5" strokeWidth={2.5} />
            </IconBtn>
          </div>
        </header>
      )}


      {/* Fullscreen exit */}
      {fullscreen && (
        <button
          onClick={() => setFullscreen(false)}
          aria-label={t("editor.exitFullscreen")}
          className="glass absolute right-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-full"
        >
          <Minimize2 className="h-5 w-5" strokeWidth={2.5} />
        </button>
      )}

      {/* Left sliders */}
      {!fullscreen && (
        <div className="pointer-events-none absolute left-0 top-0 z-10 flex h-full items-center pl-3">
          <div className="glass pointer-events-auto flex flex-col items-center gap-4 rounded-full px-2 py-4">
            <VerticalSlider
              value={brush.size}
              min={1}
              max={120}
              onChange={(v) => setBrush((b) => ({ ...b, size: v }))}
              label={t("editor.size")}
            />
            <div className="h-px w-6 bg-white/10" />
            <VerticalSlider
              value={brush.opacity * 100}
              min={5}
              max={100}
              onChange={(v) => setBrush((b) => ({ ...b, opacity: v / 100 }))}
              label={t("editor.opacity")}
            />
          </div>
        </div>
      )}

      {/* Bottom bar */}
      {!fullscreen && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-center p-3">
          <div className="glass pointer-events-auto flex items-center gap-1 rounded-full p-1.5">
            <ToolBtn
              active={panel === "brush"}
              onClick={() => setPanel(panel === "brush" ? "none" : "brush")}
              label={t("editor.brush")}
            >
              <ActiveIcon className="h-5 w-5" />
            </ToolBtn>
            <button
              onClick={() => setPanel(panel === "color" ? "none" : "color")}
              aria-label={t("editor.color")}
              className="flex h-11 w-11 items-center justify-center rounded-full"
              style={{ background: brush.color, border: "2px solid rgba(255,255,255,0.15)" }}
            />
            <ToolBtn
              active={tool === "eyedropper"}
              onClick={() => setTool(tool === "eyedropper" ? "brush" : "eyedropper")}
              label={t("tools.eyedropper")}
            >
              <Pipette className="h-5 w-5" strokeWidth={2.5} />
            </ToolBtn>
            <ToolBtn
              active={tool === "fill"}
              onClick={() => setTool(tool === "fill" ? "brush" : "fill")}
              label={t("tools.fill")}
            >
              <PaintBucket className="h-5 w-5" strokeWidth={2.5} />
            </ToolBtn>
            <ToolBtn
              active={tool === "select"}
              onClick={() => {
                if (tool === "select") {
                  setTool("brush");
                  engine.setSelection(null);
                } else {
                  setTool("select");
                }
              }}
              label={t("tools.select")}
            >
              <SquareDashed className="h-5 w-5" strokeWidth={2.5} />
            </ToolBtn>
            <ToolBtn
              active={panel === "layers"}
              onClick={() => setPanel(panel === "layers" ? "none" : "layers")}
              label={t("editor.layers")}
            >
              <LayersIcon className="h-5 w-5" strokeWidth={2.5} />
            </ToolBtn>
            <ToolBtn
              active={panel === "export"}
              onClick={() => setPanel(panel === "export" ? "none" : "export")}
              label={t("editor.export")}
            >
              <Download className="h-5 w-5" strokeWidth={2.5} />
            </ToolBtn>
          </div>
        </div>
      )}


      {/* Panels */}
      {panel === "brush" && (
        <Panel onClose={() => setPanel("none")} title={t("editor.brush")}>
          <div className="grid grid-cols-5 gap-2">
            {BRUSH_KINDS.map(({ kind, icon: Ic, nameKey }) => (
              <button
                key={kind}
                onClick={() => setBrush((b) => ({ ...b, kind }))}
                className={`flex flex-col items-center gap-1 rounded-2xl border px-2 py-3 text-xs transition ${
                  brush.kind === kind
                    ? "border-transparent bg-gradient-brand text-primary-foreground"
                    : "border-white/10 bg-white/5 hover:bg-white/10"
                }`}
              >
                <Ic className="h-5 w-5" strokeWidth={2.5} />
                <span>{t(nameKey)}</span>
              </button>
            ))}
          </div>
          <div className="mt-4">
            <SliderRow
              label={t("editor.stabilizer")}
              value={(brush.stabilizer ?? 0) * 100}
              min={0}
              max={95}
              onChange={(v) => setBrush((b) => ({ ...b, stabilizer: v / 100 }))}
            />
          </div>
        </Panel>
      )}

      {panel === "color" && (
        <Panel onClose={() => setPanel("none")} title={t("editor.color")}>
          <div className="flex flex-col items-center">
            <ColorWheel color={brush.color} onChange={setColor} />
          </div>
          <div className="mt-4">
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              {t("color.recent")}
            </p>
            <div className="grid grid-cols-6 gap-2">
              {recentColors.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className="h-9 w-full rounded-lg border border-white/10"
                  style={{ background: c }}
                  aria-label={c}
                />
              ))}
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground">
              {t("color.pickFromCanvas")}
            </p>
          </div>
        </Panel>
      )}

      {panel === "layers" && (
        <Panel onClose={() => setPanel("none")} title={t("editor.layers")}>
          <LayersPanel engine={engine} />
        </Panel>
      )}

      {panel === "export" && (
        <Panel onClose={() => setPanel("none")} title={t("editor.export")}>
          <ExportPanel engine={engine} />
        </Panel>
      )}
    </div>
  );
}

function IconBtn({
  children,
  onClick,
  label,
  disabled,
  active,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      disabled={disabled}
      className={`glass flex h-11 w-11 items-center justify-center rounded-full transition disabled:opacity-40 ${
        active ? "ring-1 ring-white/30" : ""
      }`}
    >
      {children}
    </button>
  );
}

function ToolBtn({
  children,
  onClick,
  active,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={`flex h-11 w-11 items-center justify-center rounded-full transition ${
        active
          ? "bg-gradient-brand text-primary-foreground"
          : "text-foreground hover:bg-white/10"
      }`}
    >
      {children}
    </button>
  );
}

function VerticalSlider({
  value,
  min,
  max,
  onChange,
  label,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1" title={label}>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="tint-slider h-32"
        style={
          {
            writingMode: "vertical-lr",
            WebkitAppearance: "slider-vertical",
            width: 24,
          } as React.CSSProperties
        }
      />
      <span className="text-[10px] text-muted-foreground">
        {Math.round(value)}
      </span>
    </div>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{Math.round(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="tint-slider w-full"
      />
    </div>
  );
}

function Panel({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-end justify-center p-3 sm:items-center">
      <div className="pointer-events-auto absolute inset-0" onClick={onClose} />
      <div className="glass-strong pointer-events-auto relative z-10 w-full max-w-sm rounded-3xl p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 hover:bg-white/10"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" strokeWidth={2.5} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function LayersPanel({ engine }: { engine: TintEngine }) {
  const { t } = useTranslation();
  const [, force] = useState(0);
  useEffect(() => engine.subscribe(() => force((n) => n + 1)), [engine]);

  const layers = [...engine.layers].reverse(); // mostrar topo em cima

  return (
    <div>
      <div className="mb-3 flex gap-2">
        <button
          onClick={() => engine.addLayer()}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-brand px-3 py-2 text-sm font-semibold text-primary-foreground"
        >
          <Plus className="h-4 w-4" strokeWidth={3} />
          {t("layers.new")}
        </button>
      </div>
      <div className="max-h-72 space-y-1.5 overflow-y-auto">
        {layers.map((l) => {
          const isActive = l.id === engine.activeLayerId;
          return (
            <div
              key={l.id}
              className={`rounded-xl border p-2 transition ${
                isActive
                  ? "border-white/30 bg-white/10"
                  : "border-white/10 bg-white/5"
              }`}
            >
              <div className="flex items-center gap-2">
                <button
                  onClick={() => engine.setActiveLayer(l.id)}
                  className="flex-1 truncate text-left text-sm font-medium"
                >
                  {l.name}
                </button>
                <button
                  onClick={() => engine.setLayerVisible(l.id, !l.visible)}
                  className="rounded p-1 hover:bg-white/10"
                  aria-label={l.visible ? t("layers.visible") : t("layers.hidden")}
                >
                  {l.visible ? (
                    <Eye className="h-4 w-4" strokeWidth={2.5} />
                  ) : (
                    <EyeOff className="h-4 w-4 opacity-50" strokeWidth={2.5} />
                  )}
                </button>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={l.opacity * 100}
                onChange={(e) =>
                  engine.setLayerOpacity(l.id, parseFloat(e.target.value) / 100)
                }
                className="tint-slider mt-1 w-full"
              />
              <div className="mt-1 flex flex-wrap gap-1">
                <LayerAction
                  onClick={() => engine.moveLayer(l.id, 1)}
                  label={t("layers.moveUp")}
                >
                  <ArrowUp className="h-3.5 w-3.5" strokeWidth={2.75} />
                </LayerAction>
                <LayerAction
                  onClick={() => engine.moveLayer(l.id, -1)}
                  label={t("layers.moveDown")}
                >
                  <ArrowDown className="h-3.5 w-3.5" strokeWidth={2.75} />
                </LayerAction>
                <LayerAction
                  onClick={() => engine.duplicateLayer(l.id)}
                  label={t("layers.duplicate")}
                >
                  <Copy className="h-3.5 w-3.5" strokeWidth={2.75} />
                </LayerAction>
                <LayerAction
                  onClick={() => engine.mergeDown(l.id)}
                  label={t("layers.mergeDown")}
                >
                  <Combine className="h-3.5 w-3.5" strokeWidth={2.75} />
                </LayerAction>
                <LayerAction
                  onClick={() => engine.clearLayer(l.id)}
                  label={t("layers.clear")}
                >
                  <Brush className="h-3.5 w-3.5" strokeWidth={2.75} />
                </LayerAction>
                <LayerAction
                  onClick={() => engine.deleteLayer(l.id)}
                  label={t("layers.delete")}
                  danger
                >
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={2.75} />
                </LayerAction>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LayerAction({
  children,
  onClick,
  label,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`rounded-md p-1.5 transition ${
        danger
          ? "text-destructive hover:bg-destructive/20"
          : "text-foreground hover:bg-white/10"
      }`}
    >
      {children}
    </button>
  );
}

function ExportPanel({ engine }: { engine: TintEngine }) {
  const { t } = useTranslation();
  const [transparent, setTransparent] = useState(false);

  async function exportAs(type: "image/png" | "image/jpeg") {
    const blob = await engine.exportImage({ type, transparent });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tint-${Date.now()}.${type === "image/png" ? "png" : "jpg"}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div>
      <label className="flex items-center gap-2 rounded-xl bg-white/5 p-3 text-sm">
        <input
          type="checkbox"
          checked={transparent}
          onChange={(e) => setTransparent(e.target.checked)}
          className="h-4 w-4 accent-[#ca8fff]"
        />
        {t("editor.transparent")}
      </label>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          onClick={() => exportAs("image/png")}
          className="rounded-xl bg-gradient-brand px-4 py-3 text-sm font-semibold text-primary-foreground"
        >
          {t("editor.exportPng")}
        </button>
        <button
          onClick={() => exportAs("image/jpeg")}
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold"
        >
          {t("editor.exportJpeg")}
        </button>
      </div>
    </div>
  );
}
