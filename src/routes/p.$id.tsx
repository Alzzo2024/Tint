import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
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
  FlipVertical,
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
  Hand,
  Type,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { TintEngine, type SymmetryMode } from "@/lib/drawing/engine";
import type { BrushKind, BrushSettings } from "@/lib/drawing/brushes";
import { DrawingCanvas, type ToolMode } from "@/components/editor/DrawingCanvas";
import { ColorWheel } from "@/components/editor/ColorWheel";
import { kvGet, kvSet } from "@/lib/db";
import { useTranslation } from "@/lib/i18n";


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
  const [panel, setPanel] = useState<
    "none" | "brush" | "color" | "layers" | "export" | "more" | "tools" | "text"
  >("none");
  const [slidersOpen, setSlidersOpen] = useState(true);

  const [textPending, setTextPending] = useState<{ x: number; y: number } | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);

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
        onTextAt={(x, y) => {
          setTextPending({ x, y });
          setPanel("text");
        }}
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
          <div className="pointer-events-auto glass flex items-center gap-0.5 rounded-full p-1">
            <ToolBtn
              label={t("editor.undo")}
              onClick={() => engine.undo()}
            >
              <Undo2 className="h-5 w-5" strokeWidth={2.5} />
            </ToolBtn>
            <ToolBtn
              label={t("editor.redo")}
              onClick={() => engine.redo()}
            >
              <Redo2 className="h-5 w-5" strokeWidth={2.5} />
            </ToolBtn>
            <ToolBtn
              label={t("editor.fullscreen")}
              onClick={() => setFullscreen(true)}
            >
              <Maximize2 className="h-5 w-5" strokeWidth={2.5} />
            </ToolBtn>
            <ToolBtn
              active={tool === "pan"}
              label={t("tools.pan")}
              onClick={() => setTool(tool === "pan" ? "brush" : "pan")}
            >
              <Hand className="h-5 w-5" strokeWidth={2.5} />
            </ToolBtn>
            <ToolBtn
              active={panel === "export"}
              label={t("editor.export")}
              onClick={() => setPanel(panel === "export" ? "none" : "export")}
            >
              <Download className="h-5 w-5" strokeWidth={2.5} />
            </ToolBtn>
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

      {/* Left collapsible sliders */}
      {!fullscreen && (
        <div className="pointer-events-none absolute left-0 top-1/2 z-10 flex -translate-y-1/2 items-center">
          <div
            className={`glass pointer-events-auto flex flex-col items-center gap-3 overflow-hidden rounded-r-3xl py-3 transition-all duration-200 ${
              slidersOpen ? "max-w-[64px] px-2 opacity-100" : "max-w-0 px-0 opacity-0"
            }`}
          >
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
          <button
            onClick={() => setSlidersOpen((o) => !o)}
            aria-label={slidersOpen ? t("common.close") : t("editor.size")}
            className="glass pointer-events-auto flex h-12 w-6 items-center justify-center rounded-r-full"
          >
            {slidersOpen ? (
              <ChevronLeft className="h-4 w-4" strokeWidth={2.75} />
            ) : (
              <ChevronRight className="h-4 w-4" strokeWidth={2.75} />
            )}
          </button>
        </div>
      )}

      {/* Right collapsible Layers */}
      {!fullscreen && (
        <div className="pointer-events-none absolute right-0 top-1/2 z-10 flex -translate-y-1/2 items-center">
          <button
            onClick={() => setPanel(panel === "layers" ? "none" : "layers")}
            aria-label={t("editor.layers")}
            className="glass pointer-events-auto flex h-12 w-6 items-center justify-center rounded-l-full"
          >
            {panel === "layers" ? (
              <ChevronRight className="h-4 w-4" strokeWidth={2.75} />
            ) : (
              <ChevronLeft className="h-4 w-4" strokeWidth={2.75} />
            )}
          </button>
          <div
            className={`glass-strong pointer-events-auto overflow-hidden rounded-l-3xl transition-all duration-200 ${
              panel === "layers" ? "max-w-[280px] p-4 opacity-100" : "max-w-0 p-0 opacity-0"
            }`}
            style={{ width: panel === "layers" ? 280 : 0 }}
          >
            <div className="w-[248px]">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-base font-semibold">{t("editor.layers")}</h2>
                <button
                  onClick={() => setPanel("none")}
                  className="rounded-full p-1.5 hover:bg-white/10"
                  aria-label={t("common.close")}
                >
                  <X className="h-4 w-4" strokeWidth={2.5} />
                </button>
              </div>
              <LayersPanel engine={engine} />
            </div>
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
              active={panel === "layers"}
              onClick={() => setPanel(panel === "layers" ? "none" : "layers")}
              label={t("editor.layers")}
            >
              <LayersIcon className="h-5 w-5" strokeWidth={2.5} />
            </ToolBtn>
            <ToolBtn
              active={panel === "tools"}
              onClick={() => setPanel(panel === "tools" ? "none" : "tools")}
              label={t("editor.more")}
            >
              <Plus className="h-5 w-5" strokeWidth={2.75} />
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

      {/* Layers rendered as right-side drawer above */}


      {panel === "more" && (
        <Panel onClose={() => setPanel("none")} title={t("editor.more")}>
          <MorePanel
            engine={engine}
            onClose={() => setPanel("none")}
            brushColor={brush.color}
          />
        </Panel>
      )}


      {panel === "export" && (
        <Panel onClose={() => setPanel("none")} title={t("editor.export")}>
          <ExportPanel engine={engine} />
        </Panel>
      )}

      {panel === "tools" && (
        <Panel onClose={() => setPanel("none")} title={t("editor.more")}>
          <div className="grid grid-cols-3 gap-2">
            <ActionTile
              label={t("editor.resetView")}
              icon={<Crosshair className="h-5 w-5" strokeWidth={2.5} />}
              onClick={() => {
                const r = document.querySelector("canvas")!.getBoundingClientRect();
                engine.resetView(r.width, r.height);
              }}
            />
            <ActionTile
              label={t("editor.flipH")}
              icon={<FlipHorizontal className="h-5 w-5" strokeWidth={2.5} />}
              active={engine.flipH}
              onClick={() => engine.flipHorizontal()}
            />
            <ActionTile
              label={t("editor.flipV")}
              icon={<FlipVertical className="h-5 w-5" strokeWidth={2.5} />}
              active={engine.flipV}
              onClick={() => engine.flipVertical()}
            />
            <ActionTile
              label={t("more.symmetry")}
              icon={<Wand2 className="h-5 w-5" strokeWidth={2.5} />}
              active={engine.symmetry !== "none"}
              onClick={() => setPanel("more")}
            />
            <ActionTile
              label={t("tools.select")}
              icon={<SquareDashed className="h-5 w-5" strokeWidth={2.5} />}
              active={tool === "select"}
              onClick={() => {
                if (tool === "select") {
                  setTool("brush");
                  engine.setSelection(null);
                } else {
                  setTool("select");
                }
                setPanel("none");
              }}
            />
            <ActionTile
              label={t("tools.text")}
              icon={<Type className="h-5 w-5" strokeWidth={2.5} />}
              active={tool === "text"}
              onClick={() => {
                setTool(tool === "text" ? "brush" : "text");
                setPanel("none");
              }}
            />
            <ActionTile
              label={t("more.guides")}
              icon={<Grid3x3 className="h-5 w-5" strokeWidth={2.5} />}
              active={engine.showGuides}
              onClick={() => engine.toggleGuides()}
            />
          </div>
        </Panel>
      )}


      {panel === "text" && (textPending || editingTextId) && (
        <Panel
          onClose={() => { setPanel("none"); setTextPending(null); setEditingTextId(null); }}
          title={t("text.title")}
        >
          <TextPanel
            color={brush.color}
            initial={
              editingTextId
                ? engine.texts.find((x) => x.id === editingTextId) ?? undefined
                : undefined
            }
            onCancel={() => { setPanel("none"); setTextPending(null); setEditingTextId(null); }}
            onConfirm={(opts) => {
              if (editingTextId) {
                engine.updateText(editingTextId, opts);
              } else if (textPending) {
                engine.addFloatingText({ x: textPending.x, y: textPending.y, color: brush.color, ...opts });
              }
              setPanel("none");
              setTextPending(null);
              setEditingTextId(null);
            }}
          />
        </Panel>
      )}

      {/* Toolbar para texto flutuante seleccionado */}
      {engine.activeTextId && !fullscreen && (
        <div className="pointer-events-auto absolute left-1/2 top-16 z-10 flex -translate-x-1/2 items-center gap-1 rounded-full bg-black/70 p-1 backdrop-blur">
          <button
            onClick={() => { setEditingTextId(engine.activeTextId); setPanel("text"); }}
            className="rounded-full px-3 py-1.5 text-xs font-medium hover:bg-white/10"
          >
            ✎ {t("common.edit") ?? "Edit"}
          </button>
          <button
            onClick={() => { engine.commitTexts(); }}
            className="rounded-full bg-gradient-brand px-3 py-1.5 text-xs font-semibold text-primary-foreground"
          >
            ✓ {t("common.confirm")}
          </button>
          <button
            onClick={() => { if (engine.activeTextId) engine.deleteText(engine.activeTextId); }}
            className="rounded-full px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/20"
          >
            <Trash2 className="inline h-3.5 w-3.5" strokeWidth={2.75} />
          </button>
        </div>
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
  const [busy, setBusy] = useState<"png" | "jpg" | "psd" | null>(null);
  const [fallback, setFallback] = useState<{ url: string; name: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function download(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob);
    try {
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Mostrar também um link manual durante 12s — se o download não disparar
      // no Safari iOS, o utilizador pode tocar no fallback.
      setFallback({ url, name });
      window.setTimeout(() => {
        setFallback((cur) => (cur && cur.url === url ? null : cur));
        URL.revokeObjectURL(url);
      }, 12000);
    } catch (e) {
      URL.revokeObjectURL(url);
      throw e;
    }
  }

  async function exportAs(type: "image/png" | "image/jpeg") {
    setErr(null);
    setBusy(type === "image/png" ? "png" : "jpg");
    try {
      const useTransparent = type === "image/png" && transparent;
      const blob = await engine.exportImage({ type, transparent: useTransparent });
      await download(blob, `tint-${Date.now()}.${type === "image/png" ? "png" : "jpg"}`);
    } catch (e) {
      console.error(e);
      setErr((e as Error).message || "Export failed");
    } finally {
      setBusy(null);
    }
  }

  async function exportPSD() {
    setErr(null);
    setBusy("psd");
    try {
      const blob = await engine.exportPSD();
      await download(blob, `tint-${Date.now()}.psd`);
    } catch (e) {
      console.error(e);
      setErr((e as Error).message || "PSD export failed");
    } finally {
      setBusy(null);
    }
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
          disabled={busy !== null}
          onClick={() => exportAs("image/png")}
          className="rounded-xl bg-gradient-brand px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {busy === "png" ? "…" : t("editor.exportPng")}
        </button>
        <button
          disabled={busy !== null}
          onClick={() => exportAs("image/jpeg")}
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold disabled:opacity-50"
        >
          {busy === "jpg" ? "…" : t("editor.exportJpeg")}
        </button>
      </div>
      <button
        disabled={busy !== null}
        onClick={exportPSD}
        className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold disabled:opacity-50"
      >
        {busy === "psd" ? "…" : "PSD (Photoshop)"}
      </button>
      {fallback && (
        <a
          href={fallback.url}
          download={fallback.name}
          target="_blank"
          rel="noopener"
          className="mt-3 block rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-center text-xs"
        >
          ⬇︎ {fallback.name}
        </a>
      )}
      {err && (
        <p className="mt-2 text-xs text-destructive">{err}</p>
      )}
    </div>
  );
}

function MorePanel({
  engine,
  onClose,
  brushColor,
}: {
  engine: TintEngine;
  onClose: () => void;
  brushColor: string;
}) {
  const { t } = useTranslation();
  const [, force] = useState(0);
  useEffect(() => engine.subscribe(() => force((n) => n + 1)), [engine]);

  const sym = engine.symmetry;
  const symOptions: { mode: SymmetryMode; label: string }[] = [
    { mode: "none", label: t("more.symNone") },
    { mode: "horizontal", label: t("more.symH") },
    { mode: "vertical", label: t("more.symV") },
    { mode: "both", label: t("more.symBoth") },
  ];

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-xs font-medium text-muted-foreground">
          {t("more.symmetry")}
        </p>
        <div className="grid grid-cols-4 gap-1.5">
          {symOptions.map(({ mode, label }) => (
            <button
              key={mode}
              onClick={() => engine.setSymmetry(mode)}
              className={`rounded-xl border px-2 py-2 text-xs transition ${
                sym === mode
                  ? "border-transparent bg-gradient-brand text-primary-foreground"
                  : "border-white/10 bg-white/5 hover:bg-white/10"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between rounded-xl bg-white/5 p-3">
        <div>
          <p className="text-sm font-medium">{t("more.guides")}</p>
          <p className="text-xs text-muted-foreground">{t("more.guidesHint")}</p>
        </div>
        <button
          onClick={() => engine.toggleGuides()}
          className={`flex h-7 w-12 items-center rounded-full p-0.5 transition ${
            engine.showGuides ? "bg-gradient-brand" : "bg-white/10"
          }`}
        >
          <span
            className={`h-6 w-6 rounded-full bg-white transition ${
              engine.showGuides ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium text-muted-foreground">
          {t("more.selection")}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button
            disabled={!engine.selection}
            onClick={() => {
              engine.deleteSelection();
            }}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm font-medium transition hover:bg-white/10 disabled:opacity-40"
          >
            {t("more.clearSelection")}
          </button>
          <button
            onClick={() => {
              engine.fillSelection(brushColor);
            }}
            className="rounded-xl bg-gradient-brand px-3 py-2.5 text-sm font-semibold text-primary-foreground"
          >
            {t("more.fillSelection")}
          </button>
        </div>
        {engine.selection && (
          <button
            onClick={() => engine.setSelection(null)}
            className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs"
          >
            {t("more.deselect")}
          </button>
        )}
      </div>

      <button
        onClick={onClose}
        className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
      >
        {t("common.close")}
      </button>
    </div>
  );
}

function ActionTile({
  label,
  icon,
  onClick,
  active,
  disabled,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-center justify-center gap-1.5 rounded-2xl border px-3 py-3 text-xs transition disabled:opacity-40 ${
        active
          ? "border-transparent bg-gradient-brand text-primary-foreground"
          : "border-white/10 bg-white/5 hover:bg-white/10"
      }`}
    >
      {icon}
      <span className="text-center leading-tight">{label}</span>
    </button>
  );
}

const TEXT_FONTS = [
  { id: "ui-sans-serif, system-ui, sans-serif", label: "Sans" },
  { id: "ui-serif, Georgia, serif", label: "Serif" },
  { id: "ui-monospace, SFMono-Regular, Menlo, monospace", label: "Mono" },
  { id: '"Comic Sans MS", "Comic Sans", cursive', label: "Comic" },
  { id: '"Times New Roman", Times, serif', label: "Times" },
];

function TextPanel({
  color,
  onConfirm,
  onCancel,
}: {
  color: string;
  onConfirm: (opts: {
    text: string;
    fontFamily: string;
    fontSize: number;
    bold: boolean;
    italic: boolean;
    underline: boolean;
  }) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [text, setText] = useState("");
  const [fontFamily, setFontFamily] = useState(TEXT_FONTS[0].id);
  const [fontSize, setFontSize] = useState(48);
  const [bold, setBold] = useState(false);
  const [italic, setItalic] = useState(false);
  const [underline, setUnderline] = useState(false);

  return (
    <div className="space-y-3">
      <textarea
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t("text.placeholder")}
        className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm outline-none focus:border-white/30"
        rows={3}
        style={{
          fontFamily,
          fontWeight: bold ? 700 : 400,
          fontStyle: italic ? "italic" : "normal",
          textDecoration: underline ? "underline" : "none",
          color,
        }}
      />
      <div>
        <p className="mb-1.5 text-xs text-muted-foreground">{t("text.font")}</p>
        <div className="grid grid-cols-3 gap-1.5">
          {TEXT_FONTS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFontFamily(f.id)}
              style={{ fontFamily: f.id }}
              className={`rounded-xl border px-2 py-2 text-xs ${
                fontFamily === f.id
                  ? "border-transparent bg-gradient-brand text-primary-foreground"
                  : "border-white/10 bg-white/5 hover:bg-white/10"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">{t("text.size")}</span>
          <span className="tabular-nums">{fontSize}px</span>
        </div>
        <input
          type="range"
          min={8}
          max={200}
          value={fontSize}
          onChange={(e) => setFontSize(Number(e.target.value))}
          className="w-full accent-[#ca8fff]"
        />
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        <button
          onClick={() => setBold((v) => !v)}
          className={`rounded-xl border px-2 py-2 text-sm font-bold ${
            bold
              ? "border-transparent bg-gradient-brand text-primary-foreground"
              : "border-white/10 bg-white/5"
          }`}
        >
          B
        </button>
        <button
          onClick={() => setItalic((v) => !v)}
          className={`rounded-xl border px-2 py-2 text-sm italic ${
            italic
              ? "border-transparent bg-gradient-brand text-primary-foreground"
              : "border-white/10 bg-white/5"
          }`}
        >
          I
        </button>
        <button
          onClick={() => setUnderline((v) => !v)}
          className={`rounded-xl border px-2 py-2 text-sm underline ${
            underline
              ? "border-transparent bg-gradient-brand text-primary-foreground"
              : "border-white/10 bg-white/5"
          }`}
        >
          U
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2 pt-1">
        <button
          onClick={onCancel}
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm"
        >
          {t("common.cancel")}
        </button>
        <button
          disabled={!text.trim()}
          onClick={() =>
            onConfirm({ text, fontFamily, fontSize, bold, italic, underline })
          }
          className="rounded-xl bg-gradient-brand px-3 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {t("common.add")}
        </button>
      </div>
    </div>
  );
}


