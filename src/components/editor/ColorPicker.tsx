import { useState } from "react";
import { ColorWheel } from "./ColorWheel";
import {
  cmykToRgb,
  hexToRgb,
  hsvToRgb,
  labToRgb,
  rgbToCmyk,
  rgbToHex,
  rgbToHsv,
  rgbToLab,
} from "@/lib/color";

interface Props {
  color: string;
  onChange: (hex: string) => void;
}

type Tab = "wheel" | "hsb" | "rgb" | "hex" | "cmyk" | "lab";

const TABS: { id: Tab; label: string }[] = [
  { id: "wheel", label: "🎯" },
  { id: "hsb", label: "HSB" },
  { id: "rgb", label: "RGB" },
  { id: "hex", label: "HEX" },
  { id: "cmyk", label: "CMYK" },
  { id: "lab", label: "LAB" },
];

export function ColorPicker({ color, onChange }: Props) {
  const [tab, setTab] = useState<Tab>("wheel");
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1 rounded-full bg-white/5 p-1">
        {TABS.map((tt) => (
          <button
            key={tt.id}
            onClick={() => setTab(tt.id)}
            className={`flex-1 rounded-full px-2 py-1.5 text-[11px] font-semibold transition ${
              tab === tt.id ? "bg-gradient-brand text-primary-foreground" : "text-muted-foreground"
            }`}
          >
            {tt.label}
          </button>
        ))}
      </div>
      {tab === "wheel" && (
        <div className="flex justify-center">
          <ColorWheel color={color} onChange={onChange} />
        </div>
      )}
      {tab === "hsb" && <HSBPanel color={color} onChange={onChange} />}
      {tab === "rgb" && <RGBPanel color={color} onChange={onChange} />}
      {tab === "hex" && <HEXPanel color={color} onChange={onChange} />}
      {tab === "cmyk" && <CMYKPanel color={color} onChange={onChange} />}
      {tab === "lab" && <LABPanel color={color} onChange={onChange} />}
      <div className="mt-3 flex items-center gap-2">
        <div
          className="h-8 w-8 rounded-full border border-white/20"
          style={{ background: color }}
        />
        <code className="text-xs text-muted-foreground">{color.toUpperCase()}</code>
      </div>
    </div>
  );
}

function NumRow({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  suffix,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-6 text-xs font-semibold text-muted-foreground">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="tint-slider flex-1"
      />
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={Math.round(value * 10) / 10}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="w-16 rounded-md border border-white/10 bg-white/5 px-1.5 py-1 text-right text-xs"
      />
      {suffix && <span className="text-[10px] text-muted-foreground">{suffix}</span>}
    </div>
  );
}

function HSBPanel({ color, onChange }: Props) {
  const rgb = hexToRgb(color);
  const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
  const set = (h: number, s: number, v: number) => {
    const c = hsvToRgb(h, s, v);
    onChange(rgbToHex(c.r, c.g, c.b));
  };
  return (
    <div className="space-y-2">
      <NumRow label="H" value={hsv.h} min={0} max={360} onChange={(v) => set(v, hsv.s, hsv.v)} suffix="°" />
      <NumRow label="S" value={hsv.s * 100} min={0} max={100} onChange={(v) => set(hsv.h, v / 100, hsv.v)} suffix="%" />
      <NumRow label="B" value={hsv.v * 100} min={0} max={100} onChange={(v) => set(hsv.h, hsv.s, v / 100)} suffix="%" />
    </div>
  );
}

function RGBPanel({ color, onChange }: Props) {
  const { r, g, b } = hexToRgb(color);
  const set = (R: number, G: number, B: number) => onChange(rgbToHex(R, G, B));
  return (
    <div className="space-y-2">
      <NumRow label="R" value={r} min={0} max={255} onChange={(v) => set(v, g, b)} />
      <NumRow label="G" value={g} min={0} max={255} onChange={(v) => set(r, v, b)} />
      <NumRow label="B" value={b} min={0} max={255} onChange={(v) => set(r, g, v)} />
    </div>
  );
}

function HEXPanel({ color, onChange }: Props) {
  const [val, setVal] = useState(color.replace("#", ""));
  function commit(v: string) {
    const clean = v.replace(/[^0-9a-fA-F]/g, "").slice(0, 6);
    setVal(clean);
    if (clean.length === 6) onChange("#" + clean.toLowerCase());
    else if (clean.length === 3) {
      onChange("#" + clean.split("").map((c) => c + c).join("").toLowerCase());
    }
  }
  return (
    <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-3">
      <span className="font-mono text-sm text-muted-foreground">#</span>
      <input
        value={val}
        onChange={(e) => commit(e.target.value)}
        maxLength={6}
        className="flex-1 rounded-md border border-white/10 bg-black/30 px-2 py-1.5 font-mono text-sm uppercase outline-none"
      />
    </div>
  );
}

function CMYKPanel({ color, onChange }: Props) {
  const rgb = hexToRgb(color);
  const { c, m, y, k } = rgbToCmyk(rgb.r, rgb.g, rgb.b);
  const set = (C: number, M: number, Y: number, K: number) => {
    const v = cmykToRgb(C, M, Y, K);
    onChange(rgbToHex(v.r, v.g, v.b));
  };
  return (
    <div className="space-y-2">
      <NumRow label="C" value={c} min={0} max={100} onChange={(v) => set(v, m, y, k)} suffix="%" />
      <NumRow label="M" value={m} min={0} max={100} onChange={(v) => set(c, v, y, k)} suffix="%" />
      <NumRow label="Y" value={y} min={0} max={100} onChange={(v) => set(c, m, v, k)} suffix="%" />
      <NumRow label="K" value={k} min={0} max={100} onChange={(v) => set(c, m, y, v)} suffix="%" />
    </div>
  );
}

function LABPanel({ color, onChange }: Props) {
  const rgb = hexToRgb(color);
  const lab = rgbToLab(rgb.r, rgb.g, rgb.b);
  const set = (L: number, A: number, B: number) => {
    const v = labToRgb(L, A, B);
    onChange(rgbToHex(v.r, v.g, v.b));
  };
  return (
    <div className="space-y-2">
      <NumRow label="L" value={lab.l} min={0} max={100} step={0.5} onChange={(v) => set(v, lab.a, lab.b)} />
      <NumRow label="a" value={lab.a} min={-128} max={128} step={0.5} onChange={(v) => set(lab.l, v, lab.b)} />
      <NumRow label="b" value={lab.b} min={-128} max={128} step={0.5} onChange={(v) => set(lab.l, lab.a, v)} />
    </div>
  );
}
