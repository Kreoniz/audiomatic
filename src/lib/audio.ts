import type { ScaleId, ThemeId } from '../types';

const SCALES: Record<ScaleId, number[]> = {
  pentatonic: [0, 2, 4, 7, 9, 12, 14],
  minor: [0, 2, 3, 5, 7, 8, 10],
  major: [0, 2, 4, 5, 7, 9, 11],
};

export class AudioEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private recorder: MediaStreamAudioDestinationNode | null = null;
  private lastNotes = new Map<number, number>();

  get ready() {
    return this.context !== null && this.context.state === 'running';
  }

  async start() {
    if (!this.context) {
      const context = new AudioContext({ latencyHint: 'interactive' });
      const master = context.createGain();
      const compressor = context.createDynamicsCompressor();
      const recorder = context.createMediaStreamDestination();

      master.gain.value = 0.58;
      compressor.threshold.value = -16;
      compressor.knee.value = 18;
      compressor.ratio.value = 5;
      compressor.attack.value = 0.006;
      compressor.release.value = 0.22;
      master.connect(compressor);
      compressor.connect(context.destination);
      compressor.connect(recorder);

      this.context = context;
      this.master = master;
      this.recorder = recorder;
    }

    if (this.context.state !== 'running') await this.context.resume();
  }

  getRecordingTracks() {
    return this.recorder?.stream.getAudioTracks() ?? [];
  }

  play(note: number, intensity: number, scale: ScaleId, theme: ThemeId, pan = 0) {
    if (!this.context || !this.master || this.context.state !== 'running') return;

    const now = this.context.currentTime;
    const lastPlayed = this.lastNotes.get(note) ?? 0;
    if (now - lastPlayed < 0.065) return;
    this.lastNotes.set(note, now);

    const semitone = SCALES[scale][note % SCALES[scale].length] + 48;
    const frequency = 440 * 2 ** ((semitone - 69) / 12);
    const oscillator = this.context.createOscillator();
    const overtone = this.context.createOscillator();
    const voice = this.context.createGain();
    const overtoneGain = this.context.createGain();
    const panner = this.context.createStereoPanner();
    const filter = this.context.createBiquadFilter();

    const timbre = {
      luminous: { wave: 'sine' as OscillatorType, overtone: 2.01, cutoff: 6200, decay: 1.35 },
      tactile: { wave: 'triangle' as OscillatorType, overtone: 1.5, cutoff: 2800, decay: 0.7 },
      editorial: { wave: 'sine' as OscillatorType, overtone: 3, cutoff: 4400, decay: 0.52 },
    }[theme];

    oscillator.type = timbre.wave;
    oscillator.frequency.setValueAtTime(frequency, now);
    overtone.type = 'sine';
    overtone.frequency.setValueAtTime(frequency * timbre.overtone, now);
    overtoneGain.gain.value = theme === 'luminous' ? 0.16 : 0.1;
    filter.type = 'lowpass';
    filter.frequency.value = timbre.cutoff;
    panner.pan.value = Math.max(-0.8, Math.min(0.8, pan));

    const peak = Math.min(0.2, 0.035 + intensity * 0.15);
    voice.gain.setValueAtTime(0.0001, now);
    voice.gain.exponentialRampToValueAtTime(peak, now + 0.008);
    voice.gain.exponentialRampToValueAtTime(0.0001, now + timbre.decay);

    oscillator.connect(voice);
    overtone.connect(overtoneGain).connect(voice);
    voice.connect(filter).connect(panner).connect(this.master);
    oscillator.start(now);
    overtone.start(now);
    oscillator.stop(now + timbre.decay + 0.05);
    overtone.stop(now + timbre.decay + 0.05);
  }
}
