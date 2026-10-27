/**
 * User-defined palette: four seed colours per appearance, expanded into every
 * theme role the app reads.
 *
 * The seeds are canvas, surface, text and accent. Everything else — borders,
 * muted text, sidebar, code surfaces, hover states — is mixed from them, so a
 * theme stays internally consistent instead of needing 40 hand-picked colours.
 * Nothing here touches the DOM; `use-theme` applies the result.
 */
import { THEME_COLOR_ROLES, type ThemeAppearance } from './t3-palettes';

export const CUSTOM_THEME_ID = 'custom';
export const CUSTOM_THEME_STORAGE_KEY = 'voicestudio.theme.custom.v1';

export interface CustomSeeds {
  canvas: string;
  surface: string;
  text: string;
  accent: string;
}

export interface CustomTheme {
  name: string;
  radius: number;
  light: CustomSeeds;
  dark: CustomSeeds;
}

export const DEFAULT_CUSTOM_THEME: CustomTheme = {
  name: 'Custom',
  radius: 0.5,
  light: { canvas: '#ede9e1', surface: '#ffffff', text: '#17191c', accent: '#9a5400' },
  dark: { canvas: '#0f1114', surface: '#16181c', text: '#edeae3', accent: '#e8a33d' },
};

const HEX = /^#[0-9a-f]{6}$/i;

function rgb(hex: string): [number, number, number] {
  const value = HEX.test(hex) ? hex.slice(1) : '000000';
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ];
}

function hex(parts: [number, number, number]): string {
  return `#${parts.map((p) => Math.round(Math.max(0, Math.min(255, p))).toString(16).padStart(2, '0')).join('')}`;
}

/** Mixes `amount` of `to` into `from` (0..1). */
export function mix(from: string, to: string, amount: number): string {
  const a = rgb(from);
  const b = rgb(to);
  const t = Math.max(0, Math.min(1, amount));
  return hex([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
}

/** Relative luminance, used only to pick a readable label colour. */
export function luminance(color: string): number {
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = rgb(color);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/**
 * Black or white, whichever actually contrasts better.
 *
 * The crossover is luminance 0.179, not the 0.5 the eye expects: a mid-tone
 * amber (0.436) reads at 9.7:1 with black and only 2.2:1 with white.
 */
export function readableOn(color: string): string {
  return luminance(color) > 0.179 ? '#111311' : '#ffffff';
}

export function customColors(
  theme: CustomTheme,
  appearance: ThemeAppearance,
): Record<string, string> {
  const { canvas, surface, text, accent } = theme[appearance];
  const raised = mix(surface, text, 0.07);
  const mutedText = mix(text, canvas, 0.42);
  const border = mix(canvas, text, 0.16);
  const input = mix(canvas, text, 0.24);
  const sidebar = mix(canvas, text, 0.04);
  const actionLabel = readableOn(accent);

  const roles: Record<string, string> = {
    canvas,
    chrome: sidebar,
    toolbar: sidebar,
    toolbarForeground: text,
    toolbarBorder: border,
    toolbarControl: surface,
    toolbarControlForeground: text,
    toolbarControlHover: mix(surface, text, 0.08),
    surface,
    surfaceRaised: raised,
    surfaceOverlay: mix(surface, canvas, 0.12),
    text,
    textMuted: mutedText,
    border,
    input,
    focus: accent,
    accent: mix(canvas, accent, 0.16),
    accentForeground: text,
    accentSurface: mix(canvas, accent, 0.16),
    accentSurfaceForeground: text,
    secondary: mix(canvas, text, 0.08),
    secondaryForeground: text,
    muted: mix(canvas, text, 0.06),
    mutedForeground: mutedText,
    placeholder: mutedText,
    secondaryLabel: mutedText,
    iconMuted: mutedText,
    error: '#e5484d',
    errorForeground: '#ff8f8f',
    errorSurface: mix(canvas, '#e5484d', 0.12),
    warning: '#f5a524',
    warningForeground: '#f7c66b',
    warningSurface: mix(canvas, '#f5a524', 0.12),
    update: accent,
    updateForeground: accent,
    updateSurface: mix(canvas, accent, 0.14),
    messageSurface: mix(canvas, text, 0.06),
    messageForeground: text,
    messageAction: accent,
    messageActionForeground: actionLabel,
    messageActionHover: mix(accent, canvas, 0.16),
    codeBackground: mix(surface, text, 0.05),
    codeForeground: text,
    sidebar,
    sidebarForeground: text,
    sidebarMutedForeground: mutedText,
    sidebarControlSurface: mix(sidebar, text, 0.07),
    sidebarRowHover: mix(sidebar, text, 0.09),
    sidebarRowActive: mix(sidebar, text, 0.12),
    sidebarRowSelected: mix(sidebar, accent, 0.16),
    sidebarBorder: border,
    sidebarStageFade: sidebar,
    terminalBackground: canvas,
    terminalForeground: text,
    terminalCursor: accent,
    terminalSelection: mix(canvas, accent, 0.28),
  };

  for (const role of THEME_COLOR_ROLES) {
    if (!roles[role]) roles[role] = text;
  }
  return roles;
}

function seeds(value: unknown, fallback: CustomSeeds): CustomSeeds {
  if (!value || typeof value !== 'object') return fallback;
  const record = value as Record<string, unknown>;
  const pick = (key: keyof CustomSeeds) =>
    typeof record[key] === 'string' && HEX.test(record[key] as string)
      ? (record[key] as string)
      : fallback[key];
  return {
    canvas: pick('canvas'),
    surface: pick('surface'),
    text: pick('text'),
    accent: pick('accent'),
  };
}

/** Stored themes survive partial or corrupt values: every field falls back. */
export function parseCustomTheme(raw: string | null): CustomTheme {
  try {
    const parsed = JSON.parse(raw ?? '{}') as Partial<CustomTheme>;
    const radius =
      typeof parsed.radius === 'number' && parsed.radius >= 0 && parsed.radius <= 1.5
        ? parsed.radius
        : DEFAULT_CUSTOM_THEME.radius;
    return {
      name:
        typeof parsed.name === 'string' && parsed.name.trim()
          ? parsed.name.trim().slice(0, 40)
          : DEFAULT_CUSTOM_THEME.name,
      radius,
      light: seeds(parsed.light, DEFAULT_CUSTOM_THEME.light),
      dark: seeds(parsed.dark, DEFAULT_CUSTOM_THEME.dark),
    };
  } catch {
    return DEFAULT_CUSTOM_THEME;
  }
}

export function loadCustomTheme(): CustomTheme {
  try {
    return parseCustomTheme(localStorage.getItem(CUSTOM_THEME_STORAGE_KEY));
  } catch {
    return DEFAULT_CUSTOM_THEME;
  }
}

export function saveCustomTheme(theme: CustomTheme): void {
  try {
    localStorage.setItem(CUSTOM_THEME_STORAGE_KEY, JSON.stringify(theme));
  } catch {
    /* A theme that cannot persist still applies for the session. */
  }
}
