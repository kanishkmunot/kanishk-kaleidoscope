export const palettes = {
  plum: 'Plum',
  ocean: 'Ocean',
  forest: 'Forest',
  clay: 'Clay',
} as const;

export type Palette = keyof typeof palettes;

export function isPalette(value: unknown): value is Palette {
  return typeof value === 'string' && Object.hasOwn(palettes, value);
}
