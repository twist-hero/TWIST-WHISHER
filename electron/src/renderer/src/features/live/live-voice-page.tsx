import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AudioLinesIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PitchShifter } from '@/lib/live-voice/pitch-shifter';
import {
  loadPresets,
  presetFrom,
  savePresets,
  upsertPreset,
  type LivePreset,
} from '@/lib/live-voice/presets';

interface AudioDevice {
  id: string;
  label: string;
}

const SEMITONE_RANGE = 12;
const TONE_RANGE = 12;
/** A virtual cable is what makes the processed voice visible as a microphone. */
const CABLE_PATTERN = /cable|vb-audio|voicemeeter|virtual audio|blackhole|soundflower/i;

/**
 * Live voice: mic in, shifted voice out, routed to a chosen output device.
 *
 * Graph: mic → AudioWorklet (128-frame blocks, one grain) → tone shelf →
 * destination stream, played through an <audio> element so a virtual cable can
 * be the sink. Presets cover the whole rig (pitch, tone, device), and a meter
 * shows the input before any processing so a dead microphone is obvious.
 */
export function LiveVoicePage() {
  const { t } = useTranslation();
  const [inputs, setInputs] = useState<AudioDevice[]>([]);
  const [outputs, setOutputs] = useState<AudioDevice[]>([]);
  const [inputId, setInputId] = useState('');
  const [outputId, setOutputId] = useState('');
  const [semitones, setSemitones] = useState(0);
  const [tone, setTone] = useState(0);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [block, setBlock] = useState(128);
  const [level, setLevel] = useState(0);
  const [presets, setPresets] = useState<LivePreset[]>(loadPresets);

  const contextRef = useRef<AudioContext | null>(null);
  const shifterRef = useRef<PitchShifter | null>(null);
  const workletRef = useRef<AudioWorkletNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const toneRef = useRef<BiquadFilterNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const meterFrame = useRef<number | null>(null);

  const refreshDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const asDevice = (device: MediaDeviceInfo, index: number): AudioDevice => ({
        id: device.deviceId,
        label: device.label || `${t('liveVoice.output')} ${index + 1}`,
      });
      const nextInputs = devices.filter((device) => device.kind === 'audioinput').map(asDevice);
      const nextOutputs = devices.filter((device) => device.kind === 'audiooutput').map(asDevice);
      setInputs(nextInputs);
      setOutputs(nextOutputs);
      // Pick the cable automatically: without it the "mic" never reaches OBS.
      setOutputId((current) => {
        if (current && nextOutputs.some((device) => device.id === current)) return current;
        return nextOutputs.find((device) => CABLE_PATTERN.test(device.label))?.id ?? current;
      });
    } catch {
      /* Labels stay empty until microphone permission is granted. */
    }
  }, [t]);

  useEffect(() => {
    void refreshDevices();
    const media = navigator.mediaDevices;
    media?.addEventListener?.('devicechange', refreshDevices);
    return () => media?.removeEventListener?.('devicechange', refreshDevices);
  }, [refreshDevices]);

  const stopMeter = () => {
    if (meterFrame.current !== null) cancelAnimationFrame(meterFrame.current);
    meterFrame.current = null;
    setLevel(0);
  };

  const stop = useCallback(() => {
    stopMeter();
    workletRef.current?.disconnect();
    workletRef.current = null;
    processorRef.current?.disconnect();
    processorRef.current = null;
    toneRef.current?.disconnect();
    toneRef.current = null;
    analyserRef.current?.disconnect();
    analyserRef.current = null;
    shifterRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    audioRef.current?.pause();
    audioRef.current = null;
    void contextRef.current?.close();
    contextRef.current = null;
    setRunning(false);
  }, []);

  useEffect(() => stop, [stop]);

  useEffect(() => {
    shifterRef.current?.setSemitones(semitones);
    const param = workletRef.current?.parameters.get('semitones');
    if (param) param.value = semitones;
  }, [semitones]);

  useEffect(() => {
    if (toneRef.current) toneRef.current.gain.value = tone;
  }, [tone]);

  useEffect(() => {
    void audioRef.current?.setSinkId?.(outputId).catch(() => {});
  }, [outputId]);

  const start = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          ...(inputId ? { deviceId: { exact: inputId } } : {}),
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      streamRef.current = stream;
      const context = new AudioContext({ latencyHint: 'interactive' });
      contextRef.current = context;

      const source = context.createMediaStreamSource(stream);
      const shelf = context.createBiquadFilter();
      shelf.type = 'highshelf';
      shelf.frequency.value = 2400;
      shelf.gain.value = tone;
      toneRef.current = shelf;

      // Meter taps the raw microphone, so silence here means the wrong device.
      const analyser = context.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);
      analyserRef.current = analyser;
      const samples = new Float32Array(analyser.fftSize);
      const tick = () => {
        analyser.getFloatTimeDomainData(samples);
        let sum = 0;
        for (const sample of samples) sum += sample * sample;
        setLevel(Math.min(1, Math.sqrt(sum / samples.length) * 3));
        meterFrame.current = requestAnimationFrame(tick);
      };
      meterFrame.current = requestAnimationFrame(tick);

      const destination = context.createMediaStreamDestination();
      try {
        await context.audioWorklet.addModule(
          new URL('../../lib/live-voice/pitch-worklet.js', import.meta.url),
        );
        const node = new AudioWorkletNode(context, 'voice-pitch', {
          numberOfInputs: 1,
          numberOfOutputs: 1,
          outputChannelCount: [1],
        });
        const param = node.parameters.get('semitones');
        if (param) param.value = semitones;
        source.connect(node);
        node.connect(shelf);
        workletRef.current = node;
        setBlock(128);
      } catch {
        // Blocked worklet URL or older Chromium: keep working, at higher latency.
        const processor = context.createScriptProcessor(2048, 1, 1);
        const shifter = new PitchShifter(context.sampleRate, semitones);
        shifterRef.current = shifter;
        processor.onaudioprocess = (event) => {
          event.outputBuffer
            .getChannelData(0)
            .set(shifter.process(event.inputBuffer.getChannelData(0)));
        };
        source.connect(processor);
        processor.connect(shelf);
        processorRef.current = processor;
        setBlock(2048);
      }

      shelf.connect(destination);
      const monitor = new Audio();
      monitor.srcObject = destination.stream;
      audioRef.current = monitor;
      await monitor.play();
      if (outputId) await monitor.setSinkId?.(outputId).catch(() => {});
      setRunning(true);
      void refreshDevices();
    } catch (cause) {
      stop();
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [inputId, outputId, refreshDevices, semitones, stop, tone]);

  const applyPreset = (preset: LivePreset) => {
    setSemitones(preset.semitones);
    setTone(preset.tone);
    if (preset.outputId && outputs.some((device) => device.id === preset.outputId)) {
      setOutputId(preset.outputId);
    }
  };

  const savePreset = () => {
    const next = upsertPreset(
      presets,
      presetFrom(
        { semitones, tone, outputId },
        `preset-${Date.now()}`,
        `${t('liveVoice.presets')} ${presets.length + 1}`,
      ),
    );
    setPresets(next);
    savePresets(next);
  };

  const sampleRate = contextRef.current?.sampleRate ?? 48000;
  const latencyMs = (block / sampleRate) * 1000 + 60;
  const cable = outputs.find((device) => device.id === outputId);
  const cableReady = Boolean(cable && CABLE_PATTERN.test(cable.label));

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <header className="workspace-titlebar flex shrink-0 items-center gap-2 px-5">
        <AudioLinesIcon className="size-4 text-muted-foreground" aria-hidden="true" />
        <h1 className="truncate text-sm font-medium">{t('liveVoice.title')}</h1>
      </header>

      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 overflow-y-auto px-6 py-6">
        <section className="flex flex-col rounded-md border border-border bg-card/25">
          <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/25 px-4 py-2">
            <span className="font-mono text-[length:var(--text-caption)] text-muted-foreground">
              {t('liveVoice.presets')}
            </span>
            <Button size="xs" variant="ghost" onClick={savePreset}>
              {t('liveVoice.save')}
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5 px-4 py-3">
            {presets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyPreset(preset)}
                className="rounded-full border border-border px-2.5 py-1 font-mono text-[length:var(--text-caption)] text-muted-foreground outline-none hover:border-ring hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              >
                {preset.name}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between gap-3 border-y border-border px-4 py-2">
            <span className="font-mono text-[length:var(--text-caption)] text-muted-foreground">
              {t('liveVoice.pitch')}
            </span>
            <span className="font-mono text-[length:var(--text-caption)] tabular-nums">
              {semitones > 0 ? `+${semitones}` : semitones} st
            </span>
          </div>
          <div className="px-4 py-3">
            <input
              type="range"
              min={-SEMITONE_RANGE}
              max={SEMITONE_RANGE}
              step={1}
              value={semitones}
              aria-label={t('liveVoice.pitch')}
              onChange={(event) => setSemitones(Number(event.target.value))}
              className="w-full accent-[var(--primary)]"
            />
          </div>

          <div className="flex items-center justify-between gap-3 border-y border-border px-4 py-2">
            <span className="font-mono text-[length:var(--text-caption)] text-muted-foreground">
              {t('liveVoice.tone')}
            </span>
            <span className="font-mono text-[length:var(--text-caption)] tabular-nums">
              {tone > 0 ? `+${tone}` : tone} dB
            </span>
          </div>
          <div className="px-4 py-3">
            <input
              type="range"
              min={-TONE_RANGE}
              max={TONE_RANGE}
              step={1}
              value={tone}
              aria-label={t('liveVoice.tone')}
              onChange={(event) => setTone(Number(event.target.value))}
              className="w-full accent-[var(--primary)]"
            />
          </div>

          <div className="flex items-center gap-3 border-t border-border px-4 py-2">
            <span className="font-mono text-[length:var(--text-caption)] text-muted-foreground">
              {t('liveVoice.meter')}
            </span>
            <div
              className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
              role="meter"
              aria-label={t('liveVoice.meter')}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(level * 100)}
            >
              <div
                className="h-full bg-primary transition-[width] duration-75"
                style={{ width: `${Math.round(level * 100)}%` }}
              />
            </div>
          </div>
        </section>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
            <span>{t('recording.input_device')}</span>
            <Select
              items={inputs.map((device) => ({ value: device.id, label: device.label }))}
              value={inputId}
              onValueChange={(value) => setInputId(value as string)}
            >
              <SelectTrigger aria-label={t('recording.input_device')} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {inputs.map((device) => (
                  <SelectItem key={device.id} value={device.id}>
                    {device.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
            <span>{t('liveVoice.output')}</span>
            <Select
              items={outputs.map((device) => ({ value: device.id, label: device.label }))}
              value={outputId}
              onValueChange={(value) => setOutputId(value as string)}
            >
              <SelectTrigger aria-label={t('liveVoice.output')} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {outputs.map((device) => (
                  <SelectItem key={device.id} value={device.id}>
                    {device.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
          <span className="font-mono text-[length:var(--text-caption)] tabular-nums text-muted-foreground">
            {Math.round(latencyMs)} ms · {block} · {running ? 'live' : 'off'}
          </span>
          <Button
            onClick={() => (running ? stop() : void start())}
            variant={running ? 'outline' : 'default'}
          >
            {running ? t('liveVoice.stop') : t('liveVoice.start')}
          </Button>
        </div>

        <div className="rounded-md border border-border bg-card/25 px-4 py-3">
          <div className="flex items-center gap-2">
            <span
              className={cableReady ? 'size-2 rounded-full bg-primary' : 'size-2 rounded-full bg-warning'}
              aria-hidden="true"
            />
            <span className="text-xs font-medium">
              {cableReady ? t('liveVoice.cableReady') : t('liveVoice.cableMissing')}
            </span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{t('liveVoice.hint')}</p>
        </div>

        {error ? (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
