/**
 * Saved live-voice settings.
 *
 * A preset is the whole live rig: pitch, tone and the device to route into, so
 * switching between "stream" and "game chat" is one click instead of three
 * sliders. Stored locally; a corrupt or partial entry never breaks the page.
 */
export const PRESETS_STORAGE_KEY = 'voicestudio.live.presets.v1';

export interface LivePreset {
  id: string;
  name: string;
  semitones: number;
  tone: number;
  outputId: string;
}

export interface LivePresetSeed {
  semitones: number;
  tone: number;
  outputId: string;
}

const MIN = -12;
const MAX = 12;

function clamp(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(MIN, Math.min(MAX, Math.round(value)))
    : fallback;
}

export function defaultPresets(): LivePreset[] {
  return [
    { id: 'stream', name: 'Stream', semitones: -2, tone: 2, outputId: '' },
    { id: 'game', name: 'Game chat', semitones: 3, tone: -1, outputId: '' },
  ];
}

export function parsePresets(raw: string | null): LivePreset[] {
  if (!raw) return defaultPresets();
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return defaultPresets();
    const seen = new Set<string>();
    const presets: LivePreset[] = [];
    for (const entry of parsed) {
      if (!entry || typeof entry !== 'object') continue;
      const record = entry as Record<string, unknown>;
      const id = typeof record.id === 'string' && record.id ? record.id.slice(0, 48) : '';
      if (!id || seen.has(id)) continue;
      seen.add(id);
      presets.push({
        id,
        name:
          typeof record.name === 'string' && record.name.trim()
            ? record.name.trim().slice(0, 32)
            : id,
        semitones: clamp(record.semitones, 0),
        tone: clamp(record.tone, 0),
        outputId: typeof record.outputId === 'string' ? record.outputId : '',
      });
    }
    return presets.length ? presets : defaultPresets();
  } catch {
    return defaultPresets();
  }
}

export function loadPresets(): LivePreset[] {
  try {
    return parsePresets(localStorage.getItem(PRESETS_STORAGE_KEY));
  } catch {
    return defaultPresets();
  }
}

export function savePresets(presets: LivePreset[]): void {
  try {
    localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(presets.slice(0, 12)));
  } catch {
    /* Presets stay usable for the session when storage is unavailable. */
  }
}

/** Adds or replaces a preset by id. */
export function upsertPreset(presets: LivePreset[], preset: LivePreset): LivePreset[] {
  const next = presets.filter((entry) => entry.id !== preset.id);
  next.unshift(preset);
  return next.slice(0, 12);
}

export function presetFrom(seed: LivePresetSeed, id: string, name: string): LivePreset {
  return {
    id,
    name: name.trim().slice(0, 32) || id,
    semitones: clamp(seed.semitones, 0),
    tone: clamp(seed.tone, 0),
    outputId: seed.outputId,
  };
}
