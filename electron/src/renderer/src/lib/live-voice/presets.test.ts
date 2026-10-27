import { describe, expect, it } from 'vitest';
import { defaultPresets, parsePresets, presetFrom, upsertPreset } from './presets';

describe('live voice presets', () => {
  it('ships usable defaults when nothing is stored', () => {
    expect(parsePresets(null).map((preset) => preset.name)).toEqual(['Stream', 'Game chat']);
  });

  it('survives corrupt or non-array storage', () => {
    expect(parsePresets('{oops')).toEqual(defaultPresets());
    expect(parsePresets('{"a":1}')).toEqual(defaultPresets());
    expect(parsePresets('[]')).toEqual(defaultPresets());
  });

  it('drops malformed entries and duplicate ids', () => {
    const parsed = parsePresets(
      JSON.stringify([
        { id: 'a', name: 'A', semitones: 2, tone: 1, outputId: 'x' },
        { id: 'a', name: 'dup', semitones: 0, tone: 0, outputId: '' },
        { name: 'no id' },
        null,
      ]),
    );
    expect(parsed).toHaveLength(1);
    expect(parsed[0].name).toBe('A');
  });

  it('clamps ranges and trims names', () => {
    const preset = presetFrom({ semitones: 99, tone: -99, outputId: 'dev' }, 'id', '  Loud  ');
    expect(preset.semitones).toBe(12);
    expect(preset.tone).toBe(-12);
    expect(preset.name).toBe('Loud');
  });

  it('replaces by id and keeps newest first', () => {
    const initial = defaultPresets();
    const next = upsertPreset(initial, { ...initial[0], tone: 9 });
    expect(next[0].tone).toBe(9);
    expect(next.filter((preset) => preset.id === initial[0].id)).toHaveLength(1);
    expect(next).toHaveLength(initial.length);
  });
});
