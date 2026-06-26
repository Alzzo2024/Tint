/** Flood fill (4-conn) com tolerância simples em delta de cor. */
import { hexToRgb } from "@/lib/color";

export function floodFill(
  canvas: OffscreenCanvas,
  startX: number,
  startY: number,
  hex: string,
  tolerance = 24,
) {
  const ctx = canvas.getContext("2d")!;
  const w = canvas.width;
  const h = canvas.height;
  const x0 = Math.floor(startX);
  const y0 = Math.floor(startY);
  if (x0 < 0 || y0 < 0 || x0 >= w || y0 >= h) return;

  const img = ctx.getImageData(0, 0, w, h);
  const data = img.data;
  const idx0 = (y0 * w + x0) * 4;
  const sr = data[idx0],
    sg = data[idx0 + 1],
    sb = data[idx0 + 2],
    sa = data[idx0 + 3];

  const { r: tr, g: tg, b: tb } = hexToRgb(hex);
  if (sr === tr && sg === tg && sb === tb && sa === 255) return;

  const tol2 = tolerance * tolerance * 4;
  function match(i: number) {
    const dr = data[i] - sr;
    const dg = data[i + 1] - sg;
    const db = data[i + 2] - sb;
    const da = data[i + 3] - sa;
    return dr * dr + dg * dg + db * db + da * da <= tol2;
  }

  // Span-based scanline flood fill
  const stack: [number, number][] = [[x0, y0]];
  while (stack.length) {
    const [x, y] = stack.pop()!;
    let lx = x;
    while (lx >= 0 && match((y * w + lx) * 4)) lx--;
    lx++;
    let spanAbove = false;
    let spanBelow = false;
    let cx = lx;
    while (cx < w && match((y * w + cx) * 4)) {
      const i = (y * w + cx) * 4;
      data[i] = tr;
      data[i + 1] = tg;
      data[i + 2] = tb;
      data[i + 3] = 255;
      if (y > 0) {
        const above = match(((y - 1) * w + cx) * 4);
        if (!spanAbove && above) {
          stack.push([cx, y - 1]);
          spanAbove = true;
        } else if (spanAbove && !above) spanAbove = false;
      }
      if (y < h - 1) {
        const below = match(((y + 1) * w + cx) * 4);
        if (!spanBelow && below) {
          stack.push([cx, y + 1]);
          spanBelow = true;
        } else if (spanBelow && !below) spanBelow = false;
      }
      cx++;
    }
  }
  ctx.putImageData(img, 0, 0);
}
