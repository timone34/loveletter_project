// Axis helpers shared by the SVG charts.

// 1, 2 or 5 times a power of ten, so there are about `count` steps in `span`
export function niceStep(span: number, count: number): number {
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  return ([1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag);
}

export function niceTicks(a: number, b: number, count: number): number[] {
  const step = niceStep(b - a || 1, count);
  const ticks: number[] = [];
  for (let v = Math.ceil(a / step) * step; v <= b; v += step) ticks.push(v);
  return ticks;
}

export function compact(n: number): string {
  if (n >= 1000) return `${+(n / 1000).toFixed(1)}k`;
  return String(n);
}
