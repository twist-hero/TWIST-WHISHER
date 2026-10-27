import { describe, expect, it } from 'vitest';
import { THEME_COLOR_ROLES } from './t3-palettes';
import {
  DEFAULT_CUSTOM_THEME,
  customColors,
  luminance,
  mix,
  parseCustomTheme,
  readableOn,
} from './custom-theme';

describe('custom theme', () => {
  it('falls back to the defaults for absent or corrupt storage', () => {
    expect(parseCustomTheme(null)).toEqual(DEFAULT_CUSTOM_THEME);
    expect(parseCustomTheme('{not json')).toEqual(DEFAULT_CUSTOM_THEME);
    expect(parseCustomTheme('{"light":{"canvas":"nope"}}').light).toEqual(
      DEFAULT_CUSTOM_THEME.light,
    );
  });

  it('keeps valid seeds and rejects out-of-range radius', () => {
    const parsed = parseCustomTheme(
      JSON.stringify({
        name: '  Mine  ',
        radius: 9,
        light: { canvas: '#112233', surface: '#ffffff', text: '#000000', accent: '#ff0000' },
      }),
    );
    expect(parsed.name).toBe('Mine');
    expect(parsed.radius).toBe(DEFAULT_CUSTOM_THEME.radius);
    expect(parsed.light.canvas).toBe('#112233');
    expect(parsed.light.accent).toBe('#ff0000');
    expect(parsed.dark).toEqual(DEFAULT_CUSTOM_THEME.dark);
  });

  it('fills every role the app reads', () => {
    const colors = customColors(DEFAULT_CUSTOM_THEME, 'dark');
    for (const role of THEME_COLOR_ROLES) expect(colors[role]).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('derives surfaces from the seeds instead of repeating them', () => {
    const colors = customColors(DEFAULT_CUSTOM_THEME, 'light');
    expect(colors.surfaceRaised).not.toBe(colors.surface);
    expect(colors.border).not.toBe(colors.canvas);
    expect(colors.sidebar).not.toBe(colors.canvas);
  });

  it('picks a readable label colour for the action', () => {
    const dark = customColors(DEFAULT_CUSTOM_THEME, 'dark');
    // Mid-tone amber: black labels win 9.7:1 against 2.2:1 for white.
    expect(luminance('#e8a33d')).toBeGreaterThan(0.4);
    expect(luminance('#e8a33d')).toBeLessThan(0.5);
    expect(dark.messageActionForeground).toBe('#111311');
    expect(readableOn('#101010')).toBe('#ffffff');
  });

  it('mixes towards the target and clamps', () => {
    expect(mix('#000000', '#ffffff', 0)).toBe('#000000');
    expect(mix('#000000', '#ffffff', 1)).toBe('#ffffff');
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(mix('#000000', '#ffffff', 5)).toBe('#ffffff');
  });
});
