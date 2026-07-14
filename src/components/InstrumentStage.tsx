import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import type { AudioEngine } from '../lib/audio';
import { THEMES } from '../lib/themes';
import type { InstrumentSettings } from '../types';

const TAU = Math.PI * 2;
const GATE_OFFSET = -Math.PI / 2;
const BEATS_PER_ORBIT = [8, 10, 12, 14, 16, 18, 20, 24, 9, 15, 21, 28];
const CHORD_PROGRESSIONS = {
  orbit: [0, 5, 3, 4],
  nocturne: [0, 4, 2, 5],
  sunrise: [0, 3, 4, 0],
} as const;
const SCALE_LENGTHS = { pentatonic: 5, minor: 7, major: 7 } as const;
const RHYTHM_PERIOD_SCALE = {
  sparse: 1.28,
  flowing: 1,
  pulse: 0.76,
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
interface GateFlash { angle: number; radius: number; alpha: number; color: string }
interface Dust { x: number; y: number; size: number; alpha: number; phase: number }
interface Orbiter {
  angle: number;
  beatsPerOrbit: number;
  direction: number;
  gateCount: number;
  hit: number;
  note: number;
  phase: number;
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
      const orbiters: Orbiter[] = BEATS_PER_ORBIT.map((beatsPerOrbit, index) => ({
        angle: index === 0 ? GATE_OFFSET - 0.18 : random() * TAU,
        beatsPerOrbit,
        direction: index % 4 === 3 ? -1 : 1,
        gateCount: index % 3 === 0 ? 2 : 1,
        hit: 0,
        note: index,
        phase: random() * TAU,
        size: 10 + random() * 7,
        trail: [],
      }));
      const dust: Dust[] = Array.from({ length: 96 }, () => ({
        x: random(),
        y: random(),
        size: 0.35 + random() * 1.25,
        alpha: 0.08 + random() * 0.35,
        phase: random() * TAU,
      }));
      const pulses: Pulse[] = [];
      const gateFlashes: GateFlash[] = [];
      let raf = 0;
      let previous = performance.now();
      let musicTime = 0;
      let harmonicPhase = 0;
      let harmonicEvents = 0;
      let corePulse = 0;
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
        const bpm = 62 + current.energy * 0.78;
        const beatMs = 60000 / bpm;

        context.setTransform(dpr, 0, 0, dpr, 0, 0);
        const background = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, Math.max(displayWidth, displayHeight) * 0.72);
        background.addColorStop(0, colors.backgroundGlow);
        background.addColorStop(0.62, colors.background);
        background.addColorStop(1, colors.background);
        context.fillStyle = background;
        context.fillRect(0, 0, displayWidth, displayHeight);

        dust.forEach((particle) => {
          const twinkle = 0.6 + Math.sin(musicTime * 0.00045 + particle.phase) * 0.4;
          context.globalAlpha = particle.alpha * twinkle;
          context.fillStyle = colors.text;
          context.beginPath();
          context.arc(particle.x * displayWidth, particle.y * displayHeight, particle.size, 0, TAU);
          context.fill();
        });
        context.globalAlpha = 1;

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

        const measurePhase = (musicTime % (beatMs * 4)) / (beatMs * 4);
        context.globalAlpha = current.theme === 'editorial' ? 0.72 : 0.58;
        context.strokeStyle = colors.accent;
        context.lineWidth = 2.4;
        context.lineCap = 'round';
        context.shadowColor = colors.accent;
        context.shadowBlur = current.theme === 'luminous' ? 12 : 0;
        context.beginPath();
        context.arc(0, 0, outerRadius + 34, GATE_OFFSET, GATE_OFFSET + measurePhase * TAU);
        context.stroke();
        context.shadowBlur = 0;
        context.restore();

        const thresholdTop = centerY - outerRadius - 6;
        const thresholdBottom = centerY + outerRadius + 6;
        const beam = context.createLinearGradient(centerX, thresholdTop, centerX, thresholdBottom);
        beam.addColorStop(0, colors.accent);
        beam.addColorStop(0.48, colors.primary);
        beam.addColorStop(0.52, colors.primary);
        beam.addColorStop(1, colors.secondary);
        context.save();
        context.globalAlpha = current.theme === 'editorial' ? 0.25 : 0.18;
        context.strokeStyle = beam;
        context.lineWidth = 1;
        context.setLineDash([2, 7]);
        context.beginPath();
        context.moveTo(centerX, thresholdTop);
        context.lineTo(centerX, thresholdBottom);
        context.stroke();
        context.setLineDash([]);
        context.globalAlpha = 0.58;
        context.fillStyle = colors.accent;
        context.textAlign = 'left';
        context.font = '600 7px ui-monospace, monospace';
        context.fillText('SONIC THRESHOLD', centerX + 10, thresholdTop + 10);
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

          const gateAngles = orbiter.gateCount === 2 ? [GATE_OFFSET, GATE_OFFSET + Math.PI] : [GATE_OFFSET];
          gateAngles.forEach((gateAngle) => {
            const gateX = centerX + Math.cos(gateAngle) * radius;
            const gateY = centerY + Math.sin(gateAngle) * radius;
            context.save();
            context.globalAlpha = current.theme === 'editorial' ? 0.72 : 0.9;
            context.strokeStyle = alternating;
            context.lineWidth = 3.2;
            context.lineCap = 'round';
            context.shadowColor = alternating;
            context.shadowBlur = current.theme === 'luminous' ? 12 : 3;
            context.beginPath();
            context.arc(centerX, centerY, radius, gateAngle - 0.035, gateAngle + 0.035);
            context.stroke();
            context.shadowBlur = 0;
            context.fillStyle = colors.background;
            context.strokeStyle = alternating;
            context.lineWidth = 1.2;
            context.translate(gateX, gateY);
            context.rotate(Math.PI / 4);
            context.fillRect(-3.3, -3.3, 6.6, 6.6);
            context.strokeRect(-3.3, -3.3, 6.6, 6.6);
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

          const renderedSize = orbiter.size * (1 + orbiter.hit * 0.28);
          const marble = context.createRadialGradient(x - renderedSize * 0.32, y - renderedSize * 0.38, 1, x, y, renderedSize);
          marble.addColorStop(0, colors.text);
          marble.addColorStop(0.23, alternating);
          marble.addColorStop(1, colors.surface);
          context.shadowColor = alternating;
          context.shadowBlur = (current.theme === 'luminous' ? 25 : 7) + orbiter.hit * 20;
          context.fillStyle = marble;
          context.beginPath(); context.arc(x, y, renderedSize, 0, TAU); context.fill();
          context.shadowBlur = 0;
          context.strokeStyle = colors.surfaceEdge;
          context.lineWidth = 1;
          context.stroke();
          if (!pausedRef.current) orbiter.hit *= 0.9;
        });

        for (let index = gateFlashes.length - 1; index >= 0; index -= 1) {
          const flash = gateFlashes[index];
          const gateX = centerX + Math.cos(flash.angle) * flash.radius;
          const gateY = centerY + Math.sin(flash.angle) * flash.radius;
          context.save();
          context.globalAlpha = flash.alpha;
          context.strokeStyle = flash.color;
          context.fillStyle = flash.color;
          context.lineCap = 'round';
          context.lineWidth = 2 + flash.alpha * 4;
          context.shadowColor = flash.color;
          context.shadowBlur = current.theme === 'luminous' ? 24 : 8;
          context.beginPath();
          context.arc(centerX, centerY, flash.radius, flash.angle - 0.09, flash.angle + 0.09);
          context.stroke();
          context.beginPath();
          context.arc(gateX, gateY, 2 + flash.alpha * 3.5, 0, TAU);
          context.fill();
          context.restore();
          flash.alpha *= 0.89;
          if (flash.alpha < 0.025) gateFlashes.splice(index, 1);
        }

        const coreRadius = Math.max(42, innerRadius * 0.52) * (1 + corePulse * 0.1);
        const centerGlow = context.createRadialGradient(centerX - 12, centerY - 14, 2, centerX, centerY, coreRadius * 1.15);
        centerGlow.addColorStop(0, colors.text);
        centerGlow.addColorStop(0.18, colors.accent);
        centerGlow.addColorStop(0.55, colors.surface);
        centerGlow.addColorStop(1, colors.background);
        context.shadowColor = colors.accent;
        context.shadowBlur = (current.theme === 'luminous' ? 38 : 8) + corePulse * 24;
        context.fillStyle = centerGlow;
        context.beginPath(); context.arc(centerX, centerY, coreRadius, 0, TAU); context.fill();
        context.shadowBlur = 0;
        context.fillStyle = colors.background;
        context.textAlign = 'center';
        context.font = '600 9px ui-monospace, monospace';
        context.fillText(`${current.key} · PHASE 0${harmonicPhase + 1}`, centerX, centerY - 2);
        context.globalAlpha = 0.65;
        context.font = '8px ui-monospace, monospace';
        context.fillText(`${Math.round(bpm)} BPM · ${active.length} VOICES`, centerX, centerY + 13);
        context.globalAlpha = 1;
        if (!pausedRef.current) corePulse *= 0.92;

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
        const { centerX, centerY, innerRadius, step } = getLayout(count);

        if (!pausedRef.current) {
          musicTime += frameTime;
          const bpm = 62 + current.energy * 0.78;
          const beatMs = 60000 / bpm;
          const progression = CHORD_PROGRESSIONS[current.progression];
          const periodScale = RHYTHM_PERIOD_SCALE[current.rhythm];

          if (current.soundEnabled && audio.ready) {
            audio.setSpace(current.space);
          }

          orbiters.slice(0, count).forEach((orbiter, index) => {
            const gateSpan = TAU / orbiter.gateCount;
            const previousGate = Math.floor((orbiter.angle - GATE_OFFSET) / gateSpan);
            const driftDepth = current.drift * 0.0005;
            const drift = 1 + Math.sin(musicTime * (0.000021 + index * 0.0000027) + orbiter.phase) * driftDepth;
            const periodMs = beatMs * orbiter.beatsPerOrbit * periodScale;
            orbiter.angle += orbiter.direction * TAU / periodMs * drift * frameTime;
            const nextGate = Math.floor((orbiter.angle - GATE_OFFSET) / gateSpan);

            if (nextGate !== previousGate) {
              const crossingIndex = orbiter.direction > 0 ? nextGate : previousGate;
              const crossingAngle = GATE_OFFSET + crossingIndex * gateSpan;
              const radius = innerRadius + step * index;
              const x = centerX + Math.cos(crossingAngle) * radius;
              const y = centerY + Math.sin(crossingAngle) * radius;
              const palette = THEMES[current.theme].colors;
              const eventColor = index % 3 === 0 ? palette.accent : index % 2 ? palette.secondary : palette.primary;

              orbiter.hit = 1;
              gateFlashes.push({ angle: crossingAngle, radius, alpha: 1, color: eventColor });
              pulses.push({ x, y, radius: orbiter.size + 5, alpha: 0.92, color: eventColor });

              if (index === 0) {
                harmonicPhase = harmonicEvents % progression.length;
                harmonicEvents += 1;
                corePulse = 1;
              }

              if (current.soundEnabled && audio.ready) {
                const chordRoot = progression[harmonicPhase];
                if (index === 0) {
                  if (current.bassEnabled) {
                    audio.playBass(chordRoot, current.scale, current.key, current.theme, current.warmth);
                  }
                  if (current.padEnabled) {
                    audio.playChord(
                      chordRoot,
                      current.scale,
                      current.key,
                      current.theme,
                      periodMs / orbiter.gateCount / 1000 + 1.1,
                      current.warmth,
                    );
                  }
                } else {
                  const scaleLength = SCALE_LENGTHS[current.scale];
                  const octaveLift = index >= scaleLength ? scaleLength : 0;
                  audio.playMelody(
                    chordRoot + orbiter.note % scaleLength + octaveLift,
                    0.52 + index / count * 0.3,
                    current.scale,
                    current.key,
                    current.theme,
                    x / displayWidth * 1.5 - 0.75,
                    current.noteLength,
                    current.warmth,
                  );
                }
              }
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
          <span>THRESHOLD SCORE</span>
          <span>EVERY SOUND / ONE CROSSING</span>
        </div>
      </div>
    );
  },
);
