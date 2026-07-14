import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import type { AudioEngine } from '../lib/audio';
import { THEMES } from '../lib/themes';
import type { InstrumentSettings } from '../types';

const TAU = Math.PI * 2;
const SPEED_RATIOS = [1, 1.125, 1.25, 1.333, 1.5, 1.667, 1.875, 2.125, 2.4, 2.667, 2.875, 3.125];
const CHORD_PROGRESSIONS = {
  orbit: [0, 5, 3, 4],
  nocturne: [0, 4, 2, 5],
  sunrise: [0, 3, 4, 0],
} as const;
const ARPEGGIO = [0, 2, 4, 2, 0, 4, 2, 1];
const SCALE_LENGTHS = { pentatonic: 5, minor: 7, major: 7 } as const;
const RHYTHMS = {
  sparse: { subdivisions: 1, bassEvery: 4, melodyEvery: 2 },
  flowing: { subdivisions: 2, bassEvery: 2, melodyEvery: 1 },
  pulse: { subdivisions: 4, bassEvery: 1, melodyEvery: 2 },
} as const;

interface InstrumentStageProps {
  settings: InstrumentSettings;
  audio: AudioEngine;
  audioReady: boolean;
  paused: boolean;
  seed: number;
  onWakeAudio: () => void;
}

export interface InstrumentStageHandle {
  canvas: HTMLCanvasElement | null;
}

interface TrailPoint { x: number; y: number; alpha: number }
interface Pulse { x: number; y: number; radius: number; alpha: number; color: string }
interface QueuedNote { degree: number; intensity: number; pan: number }
interface Orbiter {
  angle: number;
  direction: number;
  gateCount: number;
  note: number;
  phase: number;
  ratio: number;
  size: number;
  trail: TrailPoint[];
}

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export const InstrumentStage = forwardRef<InstrumentStageHandle, InstrumentStageProps>(
  function InstrumentStage({ settings, audio, audioReady, paused, seed, onWakeAudio }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const settingsRef = useRef(settings);
    const pausedRef = useRef(paused);
    settingsRef.current = settings;
    pausedRef.current = paused;

    useImperativeHandle(ref, () => ({ canvas: canvasRef.current }), []);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const context = canvas.getContext('2d');
      if (!context) return;

      const random = seededRandom(seed);
      const orbiters: Orbiter[] = SPEED_RATIOS.map((ratio, index) => ({
        angle: random() * TAU,
        direction: index % 4 === 3 ? -1 : 1,
        gateCount: index % 3 === 0 ? 2 : 1,
        note: index,
        phase: random() * TAU,
        ratio: ratio * (0.995 + random() * 0.01),
        size: 10 + random() * 7,
        trail: [],
      }));
      const pulses: Pulse[] = [];
      const noteQueue: QueuedNote[] = [];
      let raf = 0;
      let previous = performance.now();
      let musicTime = 0;
      let lastHarmony = '';
      let lastStep = -1;
      let dpr = 1;
      let displayWidth = 1;
      let displayHeight = 1;

      const resize = () => {
        const rect = canvas.getBoundingClientRect();
        dpr = Math.min(window.devicePixelRatio || 1, rect.width < 640 ? 1.5 : 2);
        displayWidth = Math.max(1, rect.width);
        displayHeight = Math.max(1, rect.height);
        canvas.width = Math.round(displayWidth * dpr);
        canvas.height = Math.round(displayHeight * dpr);
      };
      const observer = new ResizeObserver(resize);
      observer.observe(canvas);
      resize();

      const getLayout = (count: number) => {
        const centerX = displayWidth / 2;
        const centerY = displayHeight / 2;
        const outerRadius = Math.min(displayWidth, displayHeight) * 0.405;
        const innerRadius = Math.max(58, outerRadius * 0.28);
        const step = count > 1 ? (outerRadius - innerRadius) / (count - 1) : 0;
        return { centerX, centerY, outerRadius, innerRadius, step };
      };

      const draw = () => {
        const current = settingsRef.current;
        const theme = THEMES[current.theme];
        const colors = theme.colors;
        const count = Math.min(orbiters.length, 5 + Math.round(current.density / 14));
        const active = orbiters.slice(0, count);
        const { centerX, centerY, outerRadius, innerRadius, step } = getLayout(count);

        context.setTransform(dpr, 0, 0, dpr, 0, 0);
        const background = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, Math.max(displayWidth, displayHeight) * 0.72);
        background.addColorStop(0, colors.backgroundGlow);
        background.addColorStop(0.62, colors.background);
        background.addColorStop(1, colors.background);
        context.fillStyle = background;
        context.fillRect(0, 0, displayWidth, displayHeight);

        context.save();
        context.translate(centerX, centerY);
        context.strokeStyle = colors.muted;
        context.globalAlpha = current.theme === 'editorial' ? 0.36 : 0.2;
        for (let tick = 0; tick < 60; tick += 1) {
          const angle = tick / 60 * TAU - Math.PI / 2;
          const major = tick % 5 === 0;
          const inner = outerRadius + (major ? 17 : 22);
          const outer = outerRadius + 28;
          context.lineWidth = major ? 1.8 : 0.8;
          context.beginPath();
          context.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
          context.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
          context.stroke();
        }
        context.globalAlpha = 1;
        context.strokeStyle = colors.surfaceEdge;
        context.lineWidth = current.theme === 'editorial' ? 2 : 1.2;
        context.beginPath(); context.arc(0, 0, outerRadius + 34, 0, TAU); context.stroke();
        context.restore();

        active.forEach((orbiter, index) => {
          const radius = innerRadius + step * index;
          const x = centerX + Math.cos(orbiter.angle) * radius;
          const y = centerY + Math.sin(orbiter.angle) * radius;
          const alternating = index % 3 === 0 ? colors.accent : index % 2 ? colors.secondary : colors.primary;

          context.globalAlpha = 0.22 + index / count * 0.15;
          context.strokeStyle = colors.surfaceEdge;
          context.lineWidth = current.theme === 'editorial' ? 1.25 : 0.8;
          context.beginPath(); context.arc(centerX, centerY, radius, 0, TAU); context.stroke();

          const gateAngles = orbiter.gateCount === 2 ? [0, Math.PI] : [0];
          gateAngles.forEach((gateAngle) => {
            const gateX = centerX + Math.cos(gateAngle) * radius;
            const gateY = centerY + Math.sin(gateAngle) * radius;
            context.save();
            context.translate(gateX, gateY);
            context.rotate(Math.PI / 4);
            context.globalAlpha = 0.72;
            context.fillStyle = colors.background;
            context.strokeStyle = alternating;
            context.lineWidth = 1.2;
            context.fillRect(-3.5, -3.5, 7, 7);
            context.strokeRect(-3.5, -3.5, 7, 7);
            context.restore();
          });

          context.globalAlpha = current.theme === 'editorial' ? 0.1 : 0.075;
          context.strokeStyle = alternating;
          context.beginPath(); context.moveTo(centerX, centerY); context.lineTo(x, y); context.stroke();
          context.globalAlpha = 1;

          if (!pausedRef.current) orbiter.trail.unshift({ x, y, alpha: 1 });
          const maxTrail = 3 + Math.round(current.trails / 2.6);
          orbiter.trail.splice(maxTrail);
          orbiter.trail.forEach((point, trailIndex) => {
            point.alpha *= 0.964;
            const progress = 1 - trailIndex / Math.max(1, orbiter.trail.length);
            context.globalAlpha = point.alpha * progress * 0.38;
            context.fillStyle = alternating;
            context.beginPath();
            context.arc(point.x, point.y, Math.max(0.8, orbiter.size * progress * 0.7), 0, TAU);
            context.fill();
          });
          context.globalAlpha = 1;

          const marble = context.createRadialGradient(x - orbiter.size * 0.32, y - orbiter.size * 0.38, 1, x, y, orbiter.size);
          marble.addColorStop(0, colors.text);
          marble.addColorStop(0.23, alternating);
          marble.addColorStop(1, colors.surface);
          context.shadowColor = alternating;
          context.shadowBlur = current.theme === 'luminous' ? 25 : 7;
          context.fillStyle = marble;
          context.beginPath(); context.arc(x, y, orbiter.size, 0, TAU); context.fill();
          context.shadowBlur = 0;
          context.strokeStyle = colors.surfaceEdge;
          context.lineWidth = 1;
          context.stroke();
        });

        const bpm = 62 + current.energy * 0.78;
        const beatMs = 60000 / bpm;
        const chordIndex = Math.floor(musicTime / (beatMs * 8)) % 4;
        const centerGlow = context.createRadialGradient(centerX - 12, centerY - 14, 2, centerX, centerY, Math.max(48, innerRadius * 0.58));
        centerGlow.addColorStop(0, colors.text);
        centerGlow.addColorStop(0.18, colors.accent);
        centerGlow.addColorStop(0.55, colors.surface);
        centerGlow.addColorStop(1, colors.background);
        context.shadowColor = colors.accent;
        context.shadowBlur = current.theme === 'luminous' ? 38 : 8;
        context.fillStyle = centerGlow;
        context.beginPath(); context.arc(centerX, centerY, Math.max(42, innerRadius * 0.52), 0, TAU); context.fill();
        context.shadowBlur = 0;
        context.fillStyle = colors.background;
        context.textAlign = 'center';
        context.font = '600 9px ui-monospace, monospace';
        context.fillText(`PHASE 0${chordIndex + 1}`, centerX, centerY - 2);
        context.globalAlpha = 0.65;
        context.font = '8px ui-monospace, monospace';
        context.fillText(`${Math.round(bpm)} BPM · ${active.length} VOICES`, centerX, centerY + 13);
        context.globalAlpha = 1;

        for (let index = pulses.length - 1; index >= 0; index -= 1) {
          const pulse = pulses[index];
          context.globalAlpha = pulse.alpha;
          context.strokeStyle = pulse.color;
          context.lineWidth = 2.2;
          context.beginPath(); context.arc(pulse.x, pulse.y, pulse.radius, 0, TAU); context.stroke();
          pulse.radius += 1.9;
          pulse.alpha *= 0.934;
          if (pulse.alpha < 0.025) pulses.splice(index, 1);
        }
        context.globalAlpha = 1;
      };

      const loop = (now: number) => {
        const frameTime = Math.min(50, now - previous);
        previous = now;
        const current = settingsRef.current;
        const count = Math.min(orbiters.length, 5 + Math.round(current.density / 14));
        const { centerX, centerY, outerRadius, innerRadius, step } = getLayout(count);

        if (!pausedRef.current) {
          musicTime += frameTime;
          const bpm = 62 + current.energy * 0.78;
          const beatMs = 60000 / bpm;
          const rhythm = RHYTHMS[current.rhythm];
          const stepMs = beatMs / rhythm.subdivisions;
          const stepIndex = Math.floor(musicTime / stepMs);
          const beatIndex = Math.floor(stepIndex / rhythm.subdivisions);
          const chordIndex = Math.floor(beatIndex / 8);
          const progression = CHORD_PROGRESSIONS[current.progression];
          const chordRoot = progression[chordIndex % progression.length];

          if (current.soundEnabled && audio.ready) {
            audio.setSpace(current.space);
            const harmonySignature = `${chordIndex}:${current.progression}:${current.scale}:${current.key}:${current.theme}`;
            if (current.padEnabled && harmonySignature !== lastHarmony) {
              lastHarmony = harmonySignature;
              audio.playChord(
                chordRoot,
                current.scale,
                current.key,
                current.theme,
                beatMs * 8 / 1000 + 1.4,
                current.warmth,
              );
            } else if (!current.padEnabled) {
              lastHarmony = '';
            }

            if (stepIndex !== lastStep) {
              lastStep = stepIndex;
              if (current.bassEnabled && stepIndex % (rhythm.subdivisions * rhythm.bassEvery) === 0) {
                audio.playBass(chordRoot, current.scale, current.key, current.theme, current.warmth);
              }

              const queued = noteQueue.shift();
              const shouldFill = stepIndex % rhythm.melodyEvery === 0;
              if (queued || shouldFill) {
                const phrasePosition = stepIndex % ARPEGGIO.length;
                const scaleLength = SCALE_LENGTHS[current.scale];
                const degree = queued ? queued.degree % scaleLength : ARPEGGIO[phrasePosition];
                const octaveLift = phrasePosition === 4 || phrasePosition === 5 ? scaleLength : 0;
                audio.playMelody(
                  chordRoot + degree + octaveLift,
                  queued?.intensity ?? 0.34,
                  current.scale,
                  current.key,
                  current.theme,
                  queued?.pan ?? Math.sin(stepIndex * 1.7) * 0.42,
                  current.noteLength,
                  current.warmth,
                );
              }
            }
          }

          const baseSpeed = 0.000105 + current.energy * 0.0000019;
          orbiters.slice(0, count).forEach((orbiter, index) => {
            const previousGate = Math.floor(orbiter.angle / (TAU / orbiter.gateCount));
            const driftDepth = current.drift * 0.0005;
            const drift = 1 + Math.sin(musicTime * (0.000021 + index * 0.0000027) + orbiter.phase) * driftDepth;
            orbiter.angle += orbiter.direction * baseSpeed * orbiter.ratio * drift * frameTime;
            const nextGate = Math.floor(orbiter.angle / (TAU / orbiter.gateCount));

            if (nextGate !== previousGate) {
              const radius = innerRadius + step * index;
              const x = centerX + Math.cos(orbiter.angle) * radius;
              const y = centerY + Math.sin(orbiter.angle) * radius;
              const palette = THEMES[current.theme].colors;
              if (noteQueue.length < 12) {
                noteQueue.push({
                  degree: orbiter.note,
                  intensity: 0.48 + index / count * 0.3,
                  pan: x / displayWidth * 1.5 - 0.75,
                });
              }
              pulses.push({ x, y, radius: orbiter.size + 5, alpha: 0.84, color: index % 2 ? palette.secondary : palette.primary });
            }
          });
        }

        draw();
        raf = requestAnimationFrame(loop);
      };

      raf = requestAnimationFrame(loop);
      return () => {
        cancelAnimationFrame(raf);
        observer.disconnect();
      };
    }, [audio, seed]);

    return (
      <div className="stage-shell" onPointerDown={onWakeAudio}>
        <canvas ref={canvasRef} className="instrument-stage" aria-label="Perpetual orbital marble clock" />
        {!audioReady && settings.soundEnabled && (
          <button className="sound-gate" onClick={onWakeAudio}>
            <span className="sound-gate__icon">◉</span>
            <span><strong>Start the clock</strong><small>Tap to enable the score</small></span>
          </button>
        )}
        <div className="stage-caption" aria-hidden="true">
          <span>ORBITAL SCORE</span>
          <span>PERPETUAL / POLYRHYTHMIC</span>
        </div>
      </div>
    );
  },
);
