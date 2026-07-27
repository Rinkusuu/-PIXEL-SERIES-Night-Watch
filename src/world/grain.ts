/**
 * Addendum §C.3. Paper grain replaces the CRT scanline in the WORLD layer only;
 * the scanline still sits above the chrome. Above 0.07 this stops reading as
 * paper and starts reading as bad video compression.
 */
export function makeGrainUri(size = 128): string {
  const cv = document.createElement('canvas');
  cv.width = size;
  cv.height = size;
  const g = cv.getContext('2d');
  if (!g) return 'none';

  const img = g.createImageData(size, size);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = 110 + Math.random() * 70;
    d[i] = n; d[i + 1] = n; d[i + 2] = n; d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return `url(${cv.toDataURL('image/png')})`;
}
