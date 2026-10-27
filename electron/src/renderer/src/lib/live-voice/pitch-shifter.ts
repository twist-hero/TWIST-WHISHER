/**
 * Real-time granular pitch shifter for live voice.
 *
 * Two read heads walk the same history buffer at the pitch ratio, half a grain
 * apart, and are cross-faded with a raised cosine. The cross-fade is what makes
 * the head wrap inaudible: at the moment a head wraps, its window is at zero.
 *
 * Latency is one grain (about 60 ms at 48 kHz), which is why this lives in a
 * small class rather than a chain of nodes: the whole cost is one buffer walk
 * per sample and it stays predictable on a laptop while a game runs.
 */
const DEFAULT_GRAIN_MS = 60;
const MIN_SEMITONES = -12;
const MAX_SEMITONES = 12;

export class PitchShifter {
  private readonly sampleRate: number;
  private readonly grain: number;
  private readonly buffer: Float32Array;
  private readonly mask: number;
  private writeIndex = 0;
  private head = 0;
  private speed: number;

  constructor(sampleRate: number, semitones = 0, grainMs = DEFAULT_GRAIN_MS) {
    this.sampleRate = sampleRate;
    this.grain = Math.max(256, Math.round((sampleRate * grainMs) / 1000));
    // Power-of-two ring keeps the wrap arithmetic to a mask.
    let capacity = 1;
    while (capacity < this.grain * 2) capacity <<= 1;
    this.buffer = new Float32Array(capacity);
    this.mask = capacity - 1;
    this.speed = PitchShifter.speedFor(semitones);
  }

  /** Pitch factor for a semitone offset (2^(n/12)). */
  static ratioFor(semitones: number): number {
    const clamped = Math.max(MIN_SEMITONES, Math.min(MAX_SEMITONES, semitones));
    return 2 ** (clamped / 12);
  }

  /**
   * Head speed for a target pitch factor. The delay shrinks at this rate, so the
   * reproduced signal plays at `1 + speed`; the speed is therefore `factor - 1`,
   * not the factor itself. Reading at the factor shifts an octave to 3x.
   */
  static speedFor(semitones: number): number {
    return PitchShifter.ratioFor(semitones) - 1;
  }

  /** Semitones, clamped to the range the shifter stays intelligible in. */
  setSemitones(semitones: number): void {
    this.speed = PitchShifter.speedFor(semitones);
  }

  get latencySeconds(): number {
    return this.grain / this.sampleRate;
  }

  private read(position: number): number {
    const base = Math.floor(position);
    const frac = position - base;
    const a = this.buffer[(base + this.writeIndex - this.grain) & this.mask];
    const b = this.buffer[(base + 1 + this.writeIndex - this.grain) & this.mask];
    return a + (b - a) * frac;
  }

  /** Returns a new block; the input buffer is never modified. */
  process(input: Float32Array): Float32Array {
    const out = new Float32Array(input.length);
    const half = this.grain / 2;
    const step = (Math.PI * 2) / this.grain;
    for (let i = 0; i < input.length; i++) {
      this.buffer[this.writeIndex & this.mask] = input[i];
      this.writeIndex++;
      const gain1 = 0.5 - 0.5 * Math.cos(step * this.head);
      const head2 = (this.head + half) % this.grain;
      out[i] = this.read(this.head) * gain1 + this.read(head2) * (1 - gain1);
      this.head += this.speed;
      // Either direction can cross; both wraps land where their window is zero.
      if (this.head >= this.grain) this.head -= this.grain;
      else if (this.head < 0) this.head += this.grain;
    }
    return out;
  }
}
