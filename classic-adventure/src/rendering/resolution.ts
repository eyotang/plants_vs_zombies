// Keep the classic 800×600 pixel budget, regardless of screen size or mobile DPR.
export function renderResolution(width: number, height: number, pixelRatio: number) {
  return Math.min(1, pixelRatio, Math.sqrt(800 * 600 / Math.max(1, width * height)));
}
