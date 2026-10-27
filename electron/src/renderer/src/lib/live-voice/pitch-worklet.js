/**
 * AudioWorklet voice shifter: one grain of latency (128-frame blocks).
 *
 * This mirrors `pitch-shifter.ts`, which is the unit-tested implementation.
 * An AudioWorkletGlobalScope cannot import a module, so the algorithm is
 * duplicated here as a classic script — keep the two in step. The renderer
 * falls back to the ScriptProcessor path when addModule is unavailable.
 */
const GRAIN_MS = 60;
const MIN_SEMITONES = -12;
const MAX_SEMITONES = 12;

class VoicePitchProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      {
        name: 'semitones',
        defaultValue: 0,
        minValue: MIN_SEMITONES,
        maxValue: MAX_SEMITONES,
        automationRate: 'k-rate',
      },
    ];
  }

  constructor() {
    super();
    this.grain = Math.max(256, Math.round((sampleRate * GRAIN_MS) / 1000));
    let capacity = 1;
    while (capacity < this.grain * 2) capacity <<= 1;
    this.capacity = capacity;
    this.mask = capacity - 1;
    this.buffer = new Float32Array(capacity);
    this.writeIndex = 0;
    this.head = 0;
    this.speed = 0;
    this.step = (Math.PI * 2) / this.grain;
    this.half = this.grain / 2;
  }

  read(position) {
    const base = Math.floor(position);
    const frac = position - base;
    const a = this.buffer[(base + this.writeIndex - this.grain) & this.mask];
    const b = this.buffer[(base + 1 + this.writeIndex - this.grain) & this.mask];
    return a + (b - a) * frac;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0] && inputs[0][0];
    const output = outputs[0] && outputs[0][0];
    if (!output) return true;
    if (!input) {
      output.fill(0);
      return true;
    }
    const semitones = Math.max(
      MIN_SEMITONES,
      Math.min(MAX_SEMITONES, parameters.semitones[0] ?? 0),
    );
    const target = 2 ** (semitones / 12) - 1;
    // The delay shrinks at `speed`, so playback runs at 1 + speed; the target
    // pitch factor is therefore speed + 1, not the factor itself.
    this.speed = target;

    for (let i = 0; i < output.length; i++) {
      this.buffer[this.writeIndex & this.mask] = input[i] ?? 0;
      this.writeIndex++;
      const gain1 = 0.5 - 0.5 * Math.cos(this.step * this.head);
      const head2 = (this.head + this.half) % this.grain;
      output[i] = this.read(this.head) * gain1 + this.read(head2) * (1 - gain1);
      this.head += this.speed;
      if (this.head >= this.grain) this.head -= this.grain;
      else if (this.head < 0) this.head += this.grain;
    }
    return true;
  }
}

registerProcessor('voice-pitch', VoicePitchProcessor);
