import { useEffect, useRef } from "react";
import { hexToRgb, hsvToRgb, rgbToHex, rgbToHsv } from "@/lib/color";

interface Props {
  color: string;
  onChange: (hex: string) => void;
}

/**
 * Color wheel: matiz na roda, S/V num quadrado central.
 * Implementação leve em canvas — sem libs.
 */
export function ColorWheel({ color, onChange }: Props) {
  const wheelRef = useRef<HTMLCanvasElement | null>(null);
  const sqRef = useRef<HTMLCanvasElement | null>(null);
  const sizeRef = useRef(220);

  const rgb = hexToRgb(color);
  const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);

  useEffect(() => {
    const c = wheelRef.current!;
    const size = sizeRef.current;
    c.width = size;
    c.height = size;
    const ctx = c.getContext("2d")!;
    const r = size / 2;
    const inner = r - 22;
    const image = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x - r;
        const dy = y - r;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const i = (y * size + x) * 4;
        if (dist <= r && dist >= inner) {
          const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
          const h = (ang + 360) % 360;
          const { r: R, g: G, b: B } = hsvToRgb(h, 1, 1);
          image.data[i] = R;
          image.data[i + 1] = G;
          image.data[i + 2] = B;
          image.data[i + 3] = 255;
        } else {
          image.data[i + 3] = 0;
        }
      }
    }
    ctx.putImageData(image, 0, 0);
  }, []);

  useEffect(() => {
    const c = sqRef.current!;
    const size = 120;
    c.width = size;
    c.height = size;
    const ctx = c.getContext("2d")!;
    // Gradient: hue → branco horizontal, preto vertical
    const baseHue = hsvToRgb(hsv.h, 1, 1);
    ctx.fillStyle = `rgb(${baseHue.r},${baseHue.g},${baseHue.b})`;
    ctx.fillRect(0, 0, size, size);
    const gWhite = ctx.createLinearGradient(0, 0, size, 0);
    gWhite.addColorStop(0, "rgba(255,255,255,1)");
    gWhite.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gWhite;
    ctx.fillRect(0, 0, size, size);
    const gBlack = ctx.createLinearGradient(0, 0, 0, size);
    gBlack.addColorStop(0, "rgba(0,0,0,0)");
    gBlack.addColorStop(1, "rgba(0,0,0,1)");
    ctx.fillStyle = gBlack;
    ctx.fillRect(0, 0, size, size);
  }, [hsv.h]);

  function wheelDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = wheelRef.current!;
    c.setPointerCapture(e.pointerId);
    handleWheel(e);
  }
  function handleWheel(e: React.PointerEvent<HTMLCanvasElement>) {
    if (e.buttons === 0 && e.type === "pointermove") return;
    const c = wheelRef.current!;
    const rect = c.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    let ang = (Math.atan2(y, x) * 180) / Math.PI;
    ang = (ang + 360) % 360;
    const { r, g, b } = hsvToRgb(ang, hsv.s || 1, hsv.v || 1);
    onChange(rgbToHex(r, g, b));
  }

  function sqDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = sqRef.current!;
    c.setPointerCapture(e.pointerId);
    handleSq(e);
  }
  function handleSq(e: React.PointerEvent<HTMLCanvasElement>) {
    if (e.buttons === 0 && e.type === "pointermove") return;
    const c = sqRef.current!;
    const rect = c.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    const { r, g, b } = hsvToRgb(hsv.h, x, 1 - y);
    onChange(rgbToHex(r, g, b));
  }

  const size = sizeRef.current;
  const r = size / 2;
  const ang = (hsv.h * Math.PI) / 180;
  const ringR = r - 11;
  const hx = r + Math.cos(ang) * ringR;
  const hy = r + Math.sin(ang) * ringR;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <canvas
        ref={wheelRef}
        onPointerDown={wheelDown}
        onPointerMove={handleWheel}
        className="absolute inset-0 touch-none"
        style={{ width: size, height: size }}
      />
      <div
        className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
        style={{ left: hx, top: hy }}
      />
      <div
        className="absolute"
        style={{
          left: r - 60,
          top: r - 60,
          width: 120,
          height: 120,
        }}
      >
        <canvas
          ref={sqRef}
          onPointerDown={sqDown}
          onPointerMove={handleSq}
          className="rounded-md touch-none"
          style={{ width: 120, height: 120 }}
        />
        <div
          className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
          style={{
            left: hsv.s * 120,
            top: (1 - hsv.v) * 120,
          }}
        />
      </div>
    </div>
  );
}
