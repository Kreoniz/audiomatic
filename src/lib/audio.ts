import type { KeyId, ScaleId, ThemeId } from '../types';

const SCALES: Record<ScaleId, number[]> = {
  pentatonic: [0, 2, 4, 7, 9],
  minor: [0, 2, 3, 5, 7, 8, 10],
  major: [0, 2, 4, 5, 7, 9, 11],
};

const KEY_OFFSETS: Record<KeyId, number> = {
  C: 0,
  D: 2,
  Eb: 3,
  F: 5,
  G: 7,
  A: 9,
};

export class AudioEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private recorder: MediaStreamAudioDestinationNode | null = null;
  private delayWet: GainNode | null = null;
  private delayFeedback: GainNode | null = null;
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
      const delay = context.createDelay(1);
      const feedback = context.createGain();
      const wet = context.createGain();

      master.gain.value = 0.52;
      delay.delayTime.value = 0.31;
      feedback.gain.value = 0.2;
      wet.gain.value = 0.16;
      compressor.threshold.value = -18;
      compressor.knee.value = 18;
      compressor.ratio.value = 4;
      compressor.attack.value = 0.008;
      compressor.release.value = 0.28;

      master.connect(compressor);
      master.connect(delay);
      delay.connect(feedback).connect(delay);
      delay.connect(wet).connect(compressor);
      compressor.connect(context.destination);
      compressor.connect(recorder);

      this.context = context;
      this.master = master;
      this.recorder = recorder;
      this.delayWet = wet;
      this.delayFeedback = feedback;
    }

    if (this.context.state !== 'running') await this.context.resume();
  }

  getRecordingTracks() {
    return this.recorder?.stream.getAudioTracks() ?? [];
  }

  setSpace(amount: number) {
    if (!this.context || !this.delayWet || !this.delayFeedback) return;
    const normalized = Math.max(0, Math.min(1, amount / 100));
    const now = this.context.currentTime;
    this.delayWet.gain.setTargetAtTime(0.035 + normalized * 0.27, now, 0.08);
    this.delayFeedback.gain.setTargetAtTime(0.08 + normalized * 0.3, now, 0.08);
  }

  private frequencyForDegree(degree: number, scale: ScaleId, key: KeyId, baseMidi = 48) {
    const notes = SCALES[scale];
    const octave = Math.floor(degree / notes.length);
    const normalizedDegree = ((degree % notes.length) + notes.length) % notes.length;
    const midi = baseMidi + KEY_OFFSETS[key] + notes[normalizedDegree] + octave * 12;
    return 440 * 2 ** ((midi - 69) / 12);
  }

  playMelody(
    note: number,
    intensity: number,
    scale: ScaleId,
    key: KeyId,
    theme: ThemeId,
    pan: number,
    length: number,
    warmth: number,
  ) {
    if (!this.context || !this.master || this.context.state !== 'running') return;

    const now = this.context.currentTime;
    const lastPlayed = this.lastNotes.get(note) ?? 0;
    if (now - lastPlayed < 0.045) return;
    this.lastNotes.set(note, now);

    const frequency = this.frequencyForDegree(note, scale, key);
    const oscillator = this.context.createOscillator();
    const overtone = this.context.createOscillator();
    const voice = this.context.createGain();
    const overtoneGain = this.context.createGain();
    const panner = this.context.createStereoPanner();
    const filter = this.context.createBiquadFilter();

    const timbre = {
      luminous: { wave: 'sine' as OscillatorType, overtone: 2.01, decay: 1.15 },
      tactile: { wave: 'triangle' as OscillatorType, overtone: 1.5, decay: 0.72 },
      editorial: { wave: 'sine' as OscillatorType, overtone: 3, decay: 0.55 },
    }[theme];
    const decay = timbre.decay * (0.55 + length / 55);

    oscillator.type = timbre.wave;
    oscillator.frequency.setValueAtTime(frequency, now);
    overtone.type = 'sine';
    overtone.frequency.setValueAtTime(frequency * timbre.overtone, now);
    overtoneGain.gain.value = theme === 'luminous' ? 0.14 : 0.085;
    filter.type = 'lowpass';
    filter.frequency.value = 1500 + (100 - warmth) * 48;
    filter.Q.value = 0.6 + warmth / 90;
    panner.pan.value = Math.max(-0.75, Math.min(0.75, pan));

    const peak = Math.min(0.14, 0.025 + intensity * 0.1);
    voice.gain.setValueAtTime(0.0001, now);
    voice.gain.exponentialRampToValueAtTime(peak, now + 0.012);
    voice.gain.exponentialRampToValueAtTime(0.0001, now + decay);

    oscillator.connect(voice);
    overtone.connect(overtoneGain).connect(voice);
    voice.connect(filter).connect(panner).connect(this.master);
    oscillator.start(now);
    overtone.start(now);
    oscillator.stop(now + decay + 0.08);
    overtone.stop(now + decay + 0.08);
  }

  playBass(root: number, scale: ScaleId, key: KeyId, theme: ThemeId, warmth: number) {
    if (!this.context || !this.master || this.context.state !== 'running') return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const body = this.context.createOscillator();
    const gain = this.context.createGain();
    const bodyGain = this.context.createGain();
    const filter = this.context.createBiquadFilter();
    const frequency = this.frequencyForDegree(root, scale, key, 36);

    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    body.type = theme === 'tactile' ? 'triangle' : 'sine';
    body.frequency.value = frequency * 2;
    bodyGain.gain.value = 0.16;
    filter.type = 'lowpass';
    filter.frequency.value = 420 + (100 - warmth) * 8;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.115, now + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.72);

    oscillator.connect(gain);
    body.connect(bodyGain).connect(gain);
    gain.connect(filter).connect(this.master);
    oscillator.start(now);
    body.start(now);
    oscillator.stop(now + 0.8);
    body.stop(now + 0.8);
  }

  playChord(
    root: number,
    scale: ScaleId,
    key: KeyId,
    theme: ThemeId,
    duration: number,
    warmth: number,
  ) {
    if (!this.context || !this.master || this.context.state !== 'running') return;

    const now = this.context.currentTime;
    const filter = this.context.createBiquadFilter();
    const chordGain = this.context.createGain();
    filter.type = 'lowpass';
    filter.frequency.value = 720 + (100 - warmth) * 22;
    filter.Q.value = 0.55;
    chordGain.gain.setValueAtTime(0.0001, now);
    chordGain.gain.exponentialRampToValueAtTime(0.034, now + 0.24);
    chordGain.gain.setValueAtTime(0.034, now + Math.max(1, duration - 1.4));
    chordGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    chordGain.connect(filter).connect(this.master);

    [0, 2, 4].forEach((offset, index) => {
      const oscillator = this.context!.createOscillator();
      const voiceGain = this.context!.createGain();
      oscillator.type = theme === 'tactile' ? 'triangle' : 'sine';
      oscillator.frequency.value = this.frequencyForDegree(root + offset, scale, key, 43);
      oscillator.detune.value = index === 1 ? 3 : index === 2 ? -4 : 0;
      voiceGain.gain.value = index === 0 ? 0.54 : 0.38;
      oscillator.connect(voiceGain).connect(chordGain);
      oscillator.start(now);
      oscillator.stop(now + duration + 0.12);
    });
  }
}
