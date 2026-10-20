// Tema colore dell'app, scelto per ogni festa.
// Tutte le classi "orange-*" di Tailwind puntano alle variabili CSS --brand-*
// (vedi tailwind.config.js), quindi basta cambiare le variabili per ricolorare
// l'intera app senza toccare i componenti.

export const DEFAULT_THEME_COLOR = '#ea580c';

export const THEME_PRESETS = [
  { name: 'Arancione', color: '#ea580c' },
  { name: 'Rosso', color: '#dc2626' },
  { name: 'Rosa', color: '#db2777' },
  { name: 'Viola', color: '#7c3aed' },
  { name: 'Blu', color: '#2563eb' },
  { name: 'Azzurro', color: '#0891b2' },
  { name: 'Verde', color: '#16a34a' },
  { name: 'Giallo', color: '#ca8a04' },
];

// Palette arancione originale di Tailwind: usata tal quale per il colore di
// default, così l'app resta identica a prima finché non si sceglie altro.
const DEFAULT_PALETTE = {
  50: [255, 247, 237], 100: [255, 237, 213], 200: [254, 215, 170], 300: [253, 186, 116],
  400: [251, 146, 60], 500: [249, 115, 22], 600: [234, 88, 12], 700: [194, 65, 12],
  800: [154, 52, 18], 900: [124, 45, 18],
};

const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];

export function isValidHex(value) {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix(from, to, amount) {
  return from.map((c, i) => Math.round(c + (to[i] - c) * amount));
}

// Il colore scelto è la tonalità 600 (quella dei pulsanti); le altre si
// ricavano schiarendo (verso il bianco) o scurendo (verso il nero).
export function buildPalette(hex) {
  if (!isValidHex(hex) || hex.toLowerCase() === DEFAULT_THEME_COLOR) return DEFAULT_PALETTE;
  const base = hexToRgb(hex);
  const white = [255, 255, 255];
  const black = [0, 0, 0];
  return {
    50: mix(base, white, 0.93),
    100: mix(base, white, 0.85),
    200: mix(base, white, 0.7),
    300: mix(base, white, 0.52),
    400: mix(base, white, 0.3),
    500: mix(base, white, 0.14),
    600: base,
    700: mix(base, black, 0.15),
    800: mix(base, black, 0.3),
    900: mix(base, black, 0.45),
  };
}

export function applyTheme(hex) {
  if (typeof document === 'undefined') return;
  const palette = buildPalette(hex);
  const root = document.documentElement;
  for (const shade of SHADES) {
    root.style.setProperty(`--brand-${shade}`, palette[shade].join(' '));
  }
}
