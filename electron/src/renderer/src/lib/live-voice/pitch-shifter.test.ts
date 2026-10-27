import { describe, expect, it } from 'vitest';
import { PitchShifter } from './pitch-shifter';

const SR = 48_000;

function sine(hz: number, samples: number): Float32Array {
  const out = new Float32Array(samples);
  for (let i = 0; i < samples; i++) out[i] = Math.sin((2 * Math.PI * hz * i) / SR);
  return out;
}

/** Frequency estimate from zero crossings, ignoring the grain warm-up. */
function estimateHz(signal: Float32Array, skip: number): number {
  let crossings = 0;
  for (let i = skip + 1; i < signal.length; i++) {
    if (signal[i - 1] <= 0 && signal[i] > 0) crossings++;
  }
  const seconds = (signal.length - skip) / SR;
  return crossings / seconds;
}

describe('PitchShifter', () => {
  it('shifts a tone up an octave', () => {
    const shifter = new PitchShifter(SR, 12);
    const out = shifter.process(sine(220, SR));
    // A granular shifter carries a few percent of wrap modulation, so this
    // asserts the octave, not sample-exact tuning. 3x (the old ratio bug) is
    // still far outside this window.
    expect(estimateHz(out, 6000)).toBeGreaterThan(425);
    expect(estimateHz(out, 6000)).toBeLessThan(470);
  });

  it('leaves the pitch alone at zero semitones', () => {
    const shifter = new PitchShifter(SR, 0);
    const out = shifter.process(sine(220, SR));
    expect(estimateHz(out, 6000)).toBeGreaterThan(217);
    expect(estimateHz(out, 6000)).toBeLessThan(223);
  });

  it('drops an octave without degenerating to silence', () => {
    const shifter = new PitchShifter(SR, -12);
    const out = shifter.process(sine(440, SR));
    let peak = 0;
    for (const sample of out) peak = Math.max(peak, Math.abs(sample));
    expect(estimateHz(out, 6000)).toBeGreaterThan(215);
    expect(estimateHz(out, 6000)).toBeLessThan(225);
    expect(peak).toBeGreaterThan(0.2);
  });

  it('clamps extreme requests to the playable octave', () => {
    expect(PitchShifter.ratioFor(24)).toBe(2);
    expect(PitchShifter.ratioFor(-24)).toBe(0.5);
  });

  it('keeps a block the same length and does not mutate the input', () => {
    const input = sine(220, 512);
    const copy = Float32Array.from(input);
    const out = new PitchShifter(SR, 5).process(input);
    expect(out).toHaveLength(input.length);
    expect(Array.from(input)).toEqual(Array.from(copy));
  });

  it('reports one grain of latency', () => {
    expect(new PitchShifter(SR).latencySeconds).toBeCloseTo(0.06, 3);
  });
});
