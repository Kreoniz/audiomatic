import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import Matter from 'matter-js';
import type { AudioEngine } from '../lib/audio';
import { THEMES } from '../lib/themes';
import type { InstrumentSettings } from '../types';

const { Bodies, Body, Composite, Engine, Events } = Matter;
const WORLD = { width: 1200, height: 720 };
const BALL_LABEL = 'audiomatic-ball';

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

      const engine = Engine.create({ gravity: { x: 0, y: 0.72, scale: 0.001 } });
      const random = seededRandom(seed);
      const trails = new Map<number, TrailPoint[]>();
      const pulses: Pulse[] = [];
      let raf = 0;
      let previous = performance.now();
      let accumulator = 0;
      let spawnElapsed = 0;
      let dpr = 1;
      let displayWidth = 1;
      let displayHeight = 1;

      const boundaryOptions = { isStatic: true, restitution: 0.88, friction: 0.08, label: 'boundary' };
      const boundaries = [
        Bodies.rectangle(WORLD.width / 2, WORLD.height + 35, WORLD.width + 120, 70, boundaryOptions),
        Bodies.rectangle(-35, WORLD.height / 2, 70, WORLD.height * 2, boundaryOptions),
        Bodies.rectangle(WORLD.width + 35, WORLD.height / 2, 70, WORLD.height * 2, boundaryOptions),
      ];

      const railData = [
        [242, 186, 250, 15, 0.18],
        [925, 214, 250, 15, -0.2],
        [382, 390, 230, 15, -0.22],
        [820, 440, 250, 15, 0.2],
        [588, 588, 320, 15, 0.03],
      ] as const;
      const rails = railData.map(([x, y, width, height, angle]) =>
        Bodies.rectangle(x, y, width, height, { ...boundaryOptions, angle, label: 'rail', chamfer: { radius: 7 } }),
      );

      const bumperData = [
        [360, 245, 0], [515, 190, 1], [680, 230, 2], [836, 305, 3],
        [510, 356, 4], [668, 385, 5], [415, 505, 6], [728, 530, 2], [930, 520, 4],
      ] as const;
      const bumpers = bumperData.map(([x, y, note]) => {
        const body = Bodies.circle(x, y, 25, {
          isStatic: true,
          restitution: 1.12,
          friction: 0.01,
          label: `note-${note}`,
        });
        body.plugin = { note };
        return body;
      });
      Composite.add(engine.world, [...boundaries, ...rails, ...bumpers]);

      const spawnBall = () => {
        const density = settingsRef.current.density;
        const currentBalls = Composite.allBodies(engine.world).filter((body) => body.label === BALL_LABEL);
        const maxBalls = 5 + Math.round(density / 6);
        if (currentBalls.length >= maxBalls) return;

        const lanes = [285, 570, 890];
        const x = lanes[Math.floor(random() * lanes.length)] + (random() - 0.5) * 60;
        const radius = 12 + random() * 8;
        const ball = Bodies.circle(x, -30, radius, {
          label: BALL_LABEL,
          restitution: 0.82,
          friction: 0.012,
          frictionAir: 0.0018,
          density: 0.0018,
        });
        Body.setVelocity(ball, { x: (random() - 0.5) * 1.8, y: 1 + random() * 0.8 });
        Composite.add(engine.world, ball);
      };

      Events.on(engine, 'collisionStart', (event) => {
        event.pairs.forEach(({ bodyA, bodyB, collision }) => {
          const noteBody = bodyA.label.startsWith('note-') ? bodyA : bodyB.label.startsWith('note-') ? bodyB : null;
          const ball = bodyA.label === BALL_LABEL ? bodyA : bodyB.label === BALL_LABEL ? bodyB : null;
          if (!noteBody || !ball) return;
          const note = Number((noteBody.plugin as { note?: number }).note ?? 0);
          const speed = Math.min(1, ball.speed / 13);
          const current = settingsRef.current;
          if (current.soundEnabled) {
            audio.play(note, speed, current.scale, current.theme, noteBody.position.x / 600 - 1);
          }
          const palette = THEMES[current.theme].colors;
          pulses.push({
            x: collision.supports[0]?.x ?? noteBody.position.x,
            y: collision.supports[0]?.y ?? noteBody.position.y,
            radius: 24,
            alpha: 0.85,
            color: note % 2 ? palette.secondary : palette.primary,
          });
        });
      });

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

      const draw = () => {
        const current = settingsRef.current;
        const theme = THEMES[current.theme];
        const colors = theme.colors;
        const scale = Math.min(displayWidth / WORLD.width, displayHeight / WORLD.height);
        const offsetX = (displayWidth - WORLD.width * scale) / 2;
        const offsetY = (displayHeight - WORLD.height * scale) / 2;

        context.setTransform(dpr, 0, 0, dpr, 0, 0);
        const background = context.createRadialGradient(
          displayWidth * 0.52, displayHeight * 0.35, 0,
          displayWidth * 0.52, displayHeight * 0.35, displayWidth * 0.8,
        );
        background.addColorStop(0, colors.backgroundGlow);
        background.addColorStop(0.72, colors.background);
        context.fillStyle = background;
        context.fillRect(0, 0, displayWidth, displayHeight);

        context.save();
        context.translate(offsetX, offsetY);
        context.scale(scale, scale);

        context.globalAlpha = current.theme === 'editorial' ? 0.2 : 0.12;
        context.strokeStyle = colors.muted;
        context.lineWidth = 1;
        for (let x = 40; x < WORLD.width; x += 80) {
          context.beginPath(); context.moveTo(x, 0); context.lineTo(x, WORLD.height); context.stroke();
        }
        for (let y = 40; y < WORLD.height; y += 80) {
          context.beginPath(); context.moveTo(0, y); context.lineTo(WORLD.width, y); context.stroke();
        }
        context.globalAlpha = 1;

        rails.forEach((rail) => {
          context.save();
          context.translate(rail.position.x, rail.position.y);
          context.rotate(rail.angle);
          context.shadowColor = colors.surfaceEdge;
          context.shadowBlur = current.theme === 'luminous' ? 20 : 4;
          context.fillStyle = colors.surface;
          context.strokeStyle = colors.surfaceEdge;
          context.lineWidth = current.theme === 'editorial' ? 3 : 2;
          context.beginPath();
          context.roundRect(-railData[rails.indexOf(rail)][2] / 2, -8, railData[rails.indexOf(rail)][2], 16, 8);
          context.fill(); context.stroke();
          context.restore();
        });

        bumpers.forEach((bumper, index) => {
          const note = Number((bumper.plugin as { note?: number }).note ?? 0);
          const alternating = note % 2 ? colors.secondary : colors.primary;
          const halo = context.createRadialGradient(
            bumper.position.x - 7, bumper.position.y - 8, 2,
            bumper.position.x, bumper.position.y, 36,
          );
          halo.addColorStop(0, colors.text);
          halo.addColorStop(0.28, alternating);
          halo.addColorStop(1, colors.surface);
          context.shadowColor = alternating;
          context.shadowBlur = current.theme === 'luminous' ? 30 : 7;
          context.fillStyle = halo;
          context.beginPath(); context.arc(bumper.position.x, bumper.position.y, 25, 0, Math.PI * 2); context.fill();
          context.shadowBlur = 0;
          context.strokeStyle = colors.surfaceEdge;
          context.lineWidth = 2;
          context.stroke();
          context.fillStyle = current.theme === 'editorial' ? colors.background : colors.background;
          context.font = '600 10px ui-monospace, monospace';
          context.textAlign = 'center';
          context.fillText(String(index + 1).padStart(2, '0'), bumper.position.x, bumper.position.y + 4);
        });

        const balls = Composite.allBodies(engine.world).filter((body) => body.label === BALL_LABEL);
        balls.forEach((ball) => {
          const points = trails.get(ball.id) ?? [];
          if (!pausedRef.current) points.unshift({ x: ball.position.x, y: ball.position.y, alpha: 1 });
          const maxTrail = Math.round(current.trails / 3) + 2;
          points.splice(maxTrail);
          points.forEach((point, index) => {
            point.alpha *= 0.955;
            const progress = 1 - index / Math.max(1, points.length);
            context.globalAlpha = point.alpha * progress * 0.32;
            context.fillStyle = colors.accent;
            context.beginPath();
            context.arc(point.x, point.y, Math.max(1, ball.circleRadius! * progress * 0.72), 0, Math.PI * 2);
            context.fill();
          });
          context.globalAlpha = 1;
          trails.set(ball.id, points);

          const gradient = context.createRadialGradient(
            ball.position.x - 6, ball.position.y - 7, 1,
            ball.position.x, ball.position.y, ball.circleRadius!,
          );
          gradient.addColorStop(0, colors.text);
          gradient.addColorStop(0.25, colors.accent);
          gradient.addColorStop(1, colors.secondary);
          context.shadowColor = colors.accent;
          context.shadowBlur = current.theme === 'luminous' ? 24 : 7;
          context.fillStyle = gradient;
          context.beginPath(); context.arc(ball.position.x, ball.position.y, ball.circleRadius!, 0, Math.PI * 2); context.fill();
          context.shadowBlur = 0;
        });

        for (let i = pulses.length - 1; i >= 0; i -= 1) {
          const pulse = pulses[i];
          context.globalAlpha = pulse.alpha;
          context.strokeStyle = pulse.color;
          context.lineWidth = 3;
          context.beginPath(); context.arc(pulse.x, pulse.y, pulse.radius, 0, Math.PI * 2); context.stroke();
          pulse.radius += 2.4;
          pulse.alpha *= 0.925;
          if (pulse.alpha < 0.025) pulses.splice(i, 1);
        }
        context.globalAlpha = 1;
        context.restore();
      };

      const loop = (now: number) => {
        const frameTime = Math.min(50, now - previous);
        previous = now;
        const current = settingsRef.current;
        engine.gravity.y = 0.45 + current.energy / 75;

        if (!pausedRef.current) {
          accumulator += frameTime;
          spawnElapsed += frameTime;
          const interval = 1700 - current.density * 11 - current.energy * 4;
          if (spawnElapsed > Math.max(320, interval)) {
            spawnBall();
            spawnElapsed = 0;
          }
          while (accumulator >= 1000 / 60) {
            Engine.update(engine, 1000 / 60);
            accumulator -= 1000 / 60;
          }

          Composite.allBodies(engine.world)
            .filter((body) => body.label === BALL_LABEL && body.position.y > WORLD.height + 90)
            .forEach((body) => {
              trails.delete(body.id);
              Composite.remove(engine.world, body);
            });
        }
        draw();
        raf = requestAnimationFrame(loop);
      };

      for (let i = 0; i < 5; i += 1) spawnBall();
      raf = requestAnimationFrame(loop);

      return () => {
        cancelAnimationFrame(raf);
        observer.disconnect();
        Events.off(engine, 'collisionStart');
        Composite.clear(engine.world, false);
        Engine.clear(engine);
      };
    }, [audio, seed]);

    return (
      <div className="stage-shell" onPointerDown={onWakeAudio}>
        <canvas ref={canvasRef} className="instrument-stage" aria-label="Interactive marble orchestra" />
        {!audioReady && settings.soundEnabled && (
          <button className="sound-gate" onClick={onWakeAudio}>
            <span className="sound-gate__icon">◉</span>
            <span>
              <strong>Enter the orchestra</strong>
              <small>Tap to enable sound</small>
            </span>
          </button>
        )}
        <div className="stage-caption" aria-hidden="true">
          <span>COLLISION SCORE</span>
          <span>LIVE / GENERATIVE</span>
        </div>
      </div>
    );
  },
);
