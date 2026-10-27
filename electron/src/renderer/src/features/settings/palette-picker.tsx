import { useState } from 'react';
import { CheckIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/hooks/use-theme';
import { type ThemeAppearance } from '@/lib/themes/t3-palettes';
import { AVAILABLE_PALETTES, paletteColors } from '@/lib/themes/theme-preferences';
import {
  CUSTOM_THEME_ID,
  DEFAULT_CUSTOM_THEME,
  loadCustomTheme,
  saveCustomTheme,
  type CustomSeeds,
} from '@/lib/themes/custom-theme';
import { cn } from '@/lib/utils';

const SEED_FIELDS: Array<{ key: keyof CustomSeeds; label: string }> = [
  { key: 'canvas', label: 'themeAppearance.canvas' },
  { key: 'surface', label: 'themeAppearance.surface' },
  { key: 'text', label: 'themeAppearance.text' },
  { key: 'accent', label: 'themeAppearance.accent' },
];

export function PalettePicker({ appearance }: { appearance: ThemeAppearance }) {
  const { t } = useTranslation();
  const settings = useTheme();
  const [custom, setCustom] = useState(loadCustomTheme);
  const options = [
    { id: 'default', label: t('themeAppearance.default') },
    { id: CUSTOM_THEME_ID, label: t('themeAppearance.custom') },
    ...AVAILABLE_PALETTES,
  ];

  const editSeed = (key: keyof CustomSeeds, value: string) => {
    const next = { ...custom, [appearance]: { ...custom[appearance], [key]: value } };
    setCustom(next);
    saveCustomTheme(next);
    // Editing a seed means this is the palette you want to see.
    settings.updateTheme({ [appearance]: CUSTOM_THEME_ID, mode: appearance });
  };

  const editRadius = (radius: number) => {
    const next = { ...custom, radius };
    setCustom(next);
    saveCustomTheme(next);
    settings.updateTheme({ [appearance]: CUSTOM_THEME_ID, mode: appearance });
  };

  return (
    <section className="p-4">
      <h3 id={`palette-${appearance}`} className="mb-3 text-sm font-medium">
        {t(`themeAppearance.${appearance}`)}
      </h3>
      <div
        role="group"
        aria-labelledby={`palette-${appearance}`}
        className="grid grid-cols-2 gap-2 lg:grid-cols-3"
      >
        {options.map((option) => {
          const colors = paletteColors(option.id, appearance);
          const dark = appearance === 'dark';
          const background = colors?.canvas ?? (dark ? '#0a0a0a' : '#fdfdfd');
          const sidebar = colors?.sidebar ?? (dark ? '#111111' : '#fafafa');
          const text = colors?.text ?? (dark ? '#f5f5f5' : '#27272a');
          const accent = colors?.messageAction ?? (dark ? '#3268ef' : '#2449df');
          const selected = settings[appearance] === option.id;
          return (
            <button
              type="button"
              key={option.id}
              aria-pressed={selected}
              onClick={() => settings.updateTheme({ [appearance]: option.id, mode: appearance })}
              className={cn(
                'overflow-hidden rounded-lg border border-border/70 text-left outline-none transition-colors hover:border-ring/60 focus-visible:ring-2 focus-visible:ring-ring',
                selected && 'border-ring ring-1 ring-ring',
              )}
            >
              <div aria-hidden="true" className="flex h-16" style={{ background, color: text }}>
                <div
                  className="flex w-1/4 flex-col gap-1.5 border-r border-black/5 p-2"
                  style={{ background: sidebar }}
                >
                  <span className="h-1 w-full rounded bg-current opacity-40" />
                  <span className="h-1 w-2/3 rounded bg-current opacity-20" />
                </div>
                <div className="flex flex-1 flex-col gap-1.5 p-3">
                  <span className="h-1 w-3/4 rounded bg-current opacity-60" />
                  <span className="h-1 w-1/2 rounded bg-current opacity-20" />
                  <span
                    className="mt-auto h-2 w-8 self-end rounded-sm"
                    style={{ background: accent }}
                  />
                </div>
              </div>
              <span className="flex items-center justify-between gap-2 bg-card/60 px-3 py-2 text-xs font-medium">
                {option.label}
                {selected && <CheckIcon aria-hidden="true" className="size-3.5 text-primary" />}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-4 rounded-md border border-border bg-card/25">
        <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/25 px-4 py-2">
          <span className="text-xs font-medium">{t('themeAppearance.custom')}</span>
          <button
            type="button"
            className="font-mono text-[length:var(--text-caption)] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            onClick={() => {
              const next = DEFAULT_CUSTOM_THEME;
              setCustom(next);
              saveCustomTheme(next);
              settings.updateTheme({ [appearance]: CUSTOM_THEME_ID, mode: appearance });
            }}
          >
            {t('themeAppearance.reset')}
          </button>
        </div>
        <div className="grid gap-3 px-4 py-3 sm:grid-cols-2">
          {SEED_FIELDS.map((field) => (
            <label key={field.key} className="flex items-center justify-between gap-3 text-xs">
              <span className="text-muted-foreground">{t(field.label)}</span>
              <input
                type="color"
                value={custom[appearance][field.key]}
                aria-label={t(field.label)}
                onChange={(event) => editSeed(field.key, event.target.value)}
                className="h-7 w-12 cursor-pointer rounded border border-border bg-transparent p-0.5"
              />
            </label>
          ))}
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-2">
          <span className="text-xs text-muted-foreground">{t('themeAppearance.radius')}</span>
          <span className="font-mono text-[length:var(--text-caption)] tabular-nums">
            {custom.radius.toFixed(2)} rem
          </span>
        </div>
        <div className="px-4 pb-3">
          <input
            type="range"
            min={0}
            max={1.2}
            step={0.05}
            value={custom.radius}
            aria-label={t('themeAppearance.radius')}
            onChange={(event) => editRadius(Number(event.target.value))}
            className="w-full accent-[var(--primary)]"
          />
        </div>
      </div>
    </section>
  );
}
