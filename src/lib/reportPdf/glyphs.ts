// Character ranges verified against both shipped static Inter Tight TTF files.
// Preserve missing characters visibly instead of silently rendering empty glyphs.
const ranges = [
  [32, 126],
  [160, 255],
  [258, 258],
  [305, 305],
  [338, 339],
  [699, 700],
  [710, 710],
  [730, 730],
  [732, 732],
  [768, 769],
  [771, 772],
  [776, 776],
  [803, 803],
  [809, 809],
  [8194, 8194],
  [8201, 8201],
  [8203, 8203],
  [8211, 8212],
  [8216, 8218],
  [8220, 8222],
  [8226, 8226],
  [8230, 8230],
  [8242, 8243],
  [8249, 8250],
  [8260, 8260],
  [8364, 8364],
  [8482, 8482],
  [8593, 8593],
  [8595, 8595],
  [8722, 8722],
  [65279, 65279],
  [65535, 65535],
];
export function pdfText(text: string): string {
  return Array.from(text)
    .map((char) => {
      const point = char.codePointAt(0)!;
      if (char === '\n' || ranges.some(([start, end]) => point >= start && point <= end))
        return char;
      return `[U+${point.toString(16).toUpperCase()}]`;
    })
    .join('');
}
