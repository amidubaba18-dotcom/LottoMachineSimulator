/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  useCallback,
} from 'react';
import Matter, { Body, Engine, Bodies, World, Events } from 'matter-js';
import { Zap, RotateCcw } from 'lucide-react';
import { LotteryMachineHandle, LotteryMachineProps, Phase } from '../types';
import { soundEffects } from '../utils/audio';

const W = 360;
const H = 530;

const GLOBE_CX = W * 0.5;
const GLOBE_CY = 175;
const GLOBE_R = 126;
const BALL_R = 9.5;

const NUM_PADDLES = 4;
const PADDLE_LEN = 38;
const PADDLE_THICK = 6;
const PADDLE_DIST = GLOBE_R - PADDLE_LEN / 2 - 2;

const FUNNEL_TOP = { x: GLOBE_CX, y: GLOBE_CY + GLOBE_R - 8 };
const PIPE_TOP = { x: GLOBE_CX, y: GLOBE_CY + GLOBE_R + 14 };
const TRAY_Y = H - 56;
const TUBE_END = { x: GLOBE_CX, y: TRAY_Y - 44 };
const TUBE_HW = 14;

const TRAY_R = 12;
const TRAY_GAP = 6;
const TRAY_ROW_GAP = 5;

const RESTITUTION = 0.72;
const BALL_FRICTION = 0.02;
const BALL_AIR = 0.003;
const BALL_DENSITY = 0.002;
const GRAVITY_Y = 0.45;

export const BALL_PALETTE = [
  { bg: '#E53E3E', text: '#FFFFFF', highlight: '#FEB2B2', border: '#9B2C2C' },
  { bg: '#DD6B20', text: '#FFFFFF', highlight: '#FBD38D', border: '#9C4221' },
  { bg: '#D69E2E', text: '#FFFFFF', highlight: '#FAF089', border: '#975A16' },
  { bg: '#38A169', text: '#FFFFFF', highlight: '#9AE6B4', border: '#22543D' },
  { bg: '#3182CE', text: '#FFFFFF', highlight: '#90CDF4', border: '#2A4365' },
  { bg: '#805AD5', text: '#FFFFFF', highlight: '#D6BCFA', border: '#44337A' },
  { bg: '#D53F8C', text: '#FFFFFF', highlight: '#FBB6CE', border: '#702459' },
];

interface LottoBody extends Body {
  lottoNumber: number;
}

interface ExitAnimState {
  value: number;
  sx: number;
  sy: number;
  started: number;
  duration: number;
  angle: number;
  currentX: number;
  currentY: number;
}

interface LandingAnimState {
  value: number;
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  started: number;
  duration: number;
  angle: number;
}

export const LotteryMachine = forwardRef<LotteryMachineHandle, LotteryMachineProps>(
  (props, ref) => {
    const {
      min = 1,
      max = 49,
      customNumbers,
      numbersToPick = 6,
      drawnNumbers = [],
      onBallDrawn,
      speedMultiplier = 1,
      soundEnabled = true,
      machineType = 'mechanical',
      debugMode = false,
      onDrawAll,
      onReset,
      isDrawing,
      isComplete,
      drawMin,
      drawMax,
    } = props;

    // The window of numbers ELIGIBLE to be pulled as a winner. Falls back to
    // the full pool bounds when the caller doesn't restrict drawing.
    const effectiveDrawMin = drawMin ?? min;
    const effectiveDrawMax = drawMax ?? max;

    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const [phase, setPhase] = useState<Phase>('idle');
    const [flash, setFlash] = useState(false);

    const debugModeRef = useRef(debugMode);
    useEffect(() => {
      debugModeRef.current = debugMode;
    }, [debugMode]);

    const fpsRef = useRef(60);

    const engineRef = useRef<Engine | null>(null);
    const bodiesRef = useRef<LottoBody[]>([]);
    const paddlesRef = useRef<Body[]>([]);
    const wallBodiesRef = useRef<Body[]>([]);
    const drumAngleRef = useRef(0);
    const drumSpeedRef = useRef(0.015);
    const targetDrumSpeedRef = useRef(0.015);

    const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
    const exitRef = useRef<ExitAnimState | null>(null);
    const landingRef = useRef<LandingAnimState | null>(null);
    const reportedRef = useRef<Set<number>>(new Set());
    const onDrawnRef = useRef(onBallDrawn);
    const phaseRef = useRef<Phase>('idle');
    const phaseStartedRef = useRef(Date.now());
    const animFrameRef = useRef<number>(0);

    // Live drawable window, readable inside the render-loop closure without
    // forcing setupPhysics (which respawns every ball) to rerun on range change.
    const drawMinRef = useRef(effectiveDrawMin);
    const drawMaxRef = useRef(effectiveDrawMax);
    useEffect(() => {
      drawMinRef.current = effectiveDrawMin;
      drawMaxRef.current = effectiveDrawMax;
    }, [effectiveDrawMin, effectiveDrawMax]);

    useEffect(() => {
      onDrawnRef.current = onBallDrawn;
    }, [onBallDrawn]);

    useEffect(() => {
      soundEffects.setEnabled(soundEnabled);
    }, [soundEnabled]);

    // Full pool that spawns in the globe (never filtered by range).
    const fullPool = customNumbers && customNumbers.length > 0
      ? customNumbers
      : Array.from({ length: Math.max(0, max - min + 1) }, (_, i) => min + i);

    // How many balls are currently ELIGIBLE to be drawn (within the range window).
    const drawableCount = fullPool.filter(
      (n) => n >= effectiveDrawMin && n <= effectiveDrawMax
    ).length;

    const target = Math.max(0, Math.min(numbersToPick, drawableCount));

    const TRAY_COLS = target <= 8 ? Math.max(1, target) : 8;
    const TRAY_ROWS = target > 0 ? Math.ceil(target / TRAY_COLS) : 0;
    const TRAY_CELL_W = TRAY_R * 2 + TRAY_GAP;
    const trayW = TRAY_COLS * TRAY_CELL_W - TRAY_GAP;
    const trayH = TRAY_ROWS * (TRAY_R * 2) + Math.max(0, TRAY_ROWS - 1) * TRAY_ROW_GAP;
    const trayLeft = (W - trayW) / 2;
    const trayTop = TRAY_Y - trayH / 2;

    const clearTimers = useCallback(() => {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    }, []);

    const setPhaseState = useCallback((newPhase: Phase) => {
      phaseRef.current = newPhase;
      phaseStartedRef.current = Date.now();
      setPhase(newPhase);

      if (newPhase === 'idle') {
        targetDrumSpeedRef.current = 0.008;
      } else if (newPhase === 'falling') {
        targetDrumSpeedRef.current = 0.035 * speedMultiplier;
      } else if (newPhase === 'spinning') {
        targetDrumSpeedRef.current = 0.055 * speedMultiplier;
      } else if (newPhase === 'drawing') {
        targetDrumSpeedRef.current = 0.042 * speedMultiplier;
      }
    }, [speedMultiplier]);

    // Build Matter.js environment — ALWAYS spawns the FULL pool. Range never
    // affects what's physically in the globe; it only restricts what
    // triggerSingleDraw is allowed to pick (see below).
    const setupPhysics = useCallback(() => {
      clearTimers();
      if (engineRef.current) {
        Events.off(engineRef.current, 'collisionStart', () => { });
        Engine.clear(engineRef.current);
      }

      reportedRef.current.clear();
      exitRef.current = null;
      landingRef.current = null;
      setFlash(false);

      const engine = Engine.create({
        enableSleeping: false,
        gravity: { x: 0, y: GRAVITY_Y, scale: 0.001 },
      });

      const SEGMENTS = 40;
      const wallBodies: Body[] = [];
      const r = GLOBE_R;
      const segmentLen = (2 * Math.PI * r) / SEGMENTS + 2;

      for (let i = 0; i < SEGMENTS; i++) {
        const angle = (i / SEGMENTS) * Math.PI * 2;
        const x = GLOBE_CX + Math.cos(angle) * r;
        const y = GLOBE_CY + Math.sin(angle) * r;
        const wall = Bodies.rectangle(x, y, segmentLen, 16, {
          isStatic: true,
          angle: angle + Math.PI / 2,
          restitution: 0.8,
          friction: 0.05,
          render: { visible: false },
        });
        wallBodies.push(wall);
      }
      World.add(engine.world, wallBodies);
      wallBodiesRef.current = wallBodies;

      const paddles: Body[] = [];
      for (let i = 0; i < NUM_PADDLES; i++) {
        const paddle = Bodies.rectangle(GLOBE_CX, GLOBE_CY, PADDLE_LEN, PADDLE_THICK, {
          isStatic: true,
          restitution: 0.6,
          friction: 0.2,
          chamfer: { radius: 2 },
        });
        paddles.push(paddle);
      }
      World.add(engine.world, paddles);
      paddlesRef.current = paddles;

      // Spawn EVERY number in the full pool — range is not applied here.
      const pool: number[] = fullPool.length > 0 ? [...fullPool] : [];

      const balls: LottoBody[] = [];
      const maxSpawnR = GLOBE_R - BALL_R * 2 - 12;

      pool.forEach((val) => {
        const a = Math.random() * Math.PI * 2;
        const sr = Math.sqrt(Math.random()) * maxSpawnR;
        const bx = GLOBE_CX + Math.cos(a) * sr;
        const by = GLOBE_CY + Math.sin(a) * sr;

        const b = Bodies.circle(bx, by, BALL_R, {
          restitution: RESTITUTION,
          friction: BALL_FRICTION,
          frictionAir: BALL_AIR,
          density: BALL_DENSITY,
        }) as LottoBody;

        b.lottoNumber = val;
        Body.setVelocity(b, {
          x: (Math.random() - 0.5) * 1.5,
          y: (Math.random() - 0.5) * 1.5,
        });

        balls.push(b);
      });

      World.add(engine.world, balls);
      bodiesRef.current = balls;
      engineRef.current = engine;

      Events.on(engine, 'collisionStart', (event) => {
        if (!soundEffects.isEnabled()) return;
        event.pairs.forEach((pair) => {
          const speedA = Math.hypot(pair.bodyA.velocity.x, pair.bodyA.velocity.y);
          const speedB = Math.hypot(pair.bodyB.velocity.x, pair.bodyB.velocity.y);
          const relativeSpeed = Math.max(speedA, speedB);
          if (relativeSpeed > 1.2) {
            soundEffects.playClack(Math.min(1, relativeSpeed / 6));
          }
        });
      });

      setPhaseState('idle');
      // fullPool intentionally NOT stringified into deps — customNumbers ref
      // changes are already covered by the customNumbers dependency below.
    }, [min, max, customNumbers, clearTimers, setPhaseState]);

    // Handle extraction trigger — ONLY balls within the current draw window
    // (drawMinRef/drawMaxRef) are eligible to be picked. Balls outside the
    // window keep tumbling but are never candidates.
    const triggerSingleDraw = useCallback(() => {
      const eng = engineRef.current;
      if (!eng || bodiesRef.current.length === 0) return;
      if (exitRef.current || landingRef.current) return;
      if (reportedRef.current.size >= target) return;

      const dMin = drawMinRef.current;
      const dMax = drawMaxRef.current;

      const eligible = bodiesRef.current.filter(
        (b) => b.lottoNumber >= dMin && b.lottoNumber <= dMax
      );
      if (eligible.length === 0) return; // nothing eligible right now — skip this tick

      const candidates = [...eligible];
      candidates.sort((a, b) => {
        const distA = Math.hypot(a.position.x - FUNNEL_TOP.x, a.position.y - FUNNEL_TOP.y);
        const distB = Math.hypot(b.position.x - FUNNEL_TOP.x, b.position.y - FUNNEL_TOP.y);
        return distA - distB;
      });

      const pickPool = candidates.slice(0, Math.min(5, candidates.length));
      const chosen = pickPool[Math.floor(Math.random() * pickPool.length)];

      soundEffects.playWhoosh();
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate(35);
        } catch (_) { }
      }

      exitRef.current = {
        value: chosen.lottoNumber,
        sx: chosen.position.x,
        sy: chosen.position.y,
        started: Date.now(),
        duration: 850,
        angle: chosen.angle,
        currentX: chosen.position.x,
        currentY: chosen.position.y,
      };

      World.remove(eng.world, chosen);
      bodiesRef.current = bodiesRef.current.filter((b) => b !== chosen);
    }, [target]);

    const startDrawSequence = useCallback(() => {
      if (phaseRef.current !== 'idle' || bodiesRef.current.length === 0) return;
      clearTimers();
      setPhaseState('falling');

      timersRef.current.push(
        setTimeout(() => {
          setPhaseState('spinning');
        }, 600)
      );

      timersRef.current.push(
        setTimeout(() => {
          if (bodiesRef.current.length === 0) return;
          setPhaseState('drawing');

          const interval = setInterval(() => {
            if (phaseRef.current !== 'drawing' || bodiesRef.current.length === 0) {
              clearInterval(interval);
              return;
            }
            if (exitRef.current || landingRef.current) return;
            if (reportedRef.current.size >= target) {
              clearInterval(interval);
              return;
            }

            triggerSingleDraw();
          }, 1150 / speedMultiplier);

          timersRef.current.push(interval as unknown as ReturnType<typeof setTimeout>);
        }, 2200)
      );
    }, [clearTimers, setPhaseState, target, triggerSingleDraw, speedMultiplier]);

    useImperativeHandle(
      ref,
      () => ({
        draw() {
          if (phaseRef.current === 'idle') {
            startDrawSequence();
          } else if (phaseRef.current === 'spinning') {
            setPhaseState('drawing');
            triggerSingleDraw();
          } else {
            triggerSingleDraw();
          }
        },
        reset() {
          setupPhysics();
        },
        startSpin() {
          setPhaseState('spinning');
        },
        stopSpin() {
          setPhaseState('idle');
        },
      }),
      [startDrawSequence, setPhaseState, triggerSingleDraw, setupPhysics]
    );

    // Full-pool spawn only depends on the pool itself, NOT the range window —
    // changing the range must never respawn/reset the globe.
    useEffect(() => {
      setupPhysics();
      return () => {
        clearTimers();
        if (engineRef.current) {
          Engine.clear(engineRef.current);
        }
      };
    }, [min, max, customNumbers, setupPhysics, clearTimers]);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.scale(dpr, dpr);

      let lastTime = performance.now();

      const render = (time: number) => {
        const dt = Math.min(0.033, (time - lastTime) / 1000);
        lastTime = time;
        if (dt > 0) {
          fpsRef.current = fpsRef.current * 0.9 + (1 / dt) * 0.1;
        }

        const eng = engineRef.current;
        const now = Date.now();

        drumSpeedRef.current += (targetDrumSpeedRef.current - drumSpeedRef.current) * 0.04;
        drumAngleRef.current += drumSpeedRef.current * (dt * 60);

        const currentDrumAngle = drumAngleRef.current;
        paddlesRef.current.forEach((paddle, i) => {
          const paddleAngle = currentDrumAngle + (i * Math.PI * 2) / NUM_PADDLES;
          const px = GLOBE_CX + Math.cos(paddleAngle) * PADDLE_DIST;
          const py = GLOBE_CY + Math.sin(paddleAngle) * PADDLE_DIST;
          const tangentialAngle = paddleAngle + Math.PI / 2;

          Body.setPosition(paddle, { x: px, y: py });
          Body.setAngle(paddle, tangentialAngle);
        });

        if (eng && bodiesRef.current.length > 0) {
          const isSpinning = phaseRef.current === 'spinning' || phaseRef.current === 'drawing' || phaseRef.current === 'falling';

          bodiesRef.current.forEach((ball) => {
            const dx = ball.position.x - GLOBE_CX;
            const dy = ball.position.y - GLOBE_CY;
            const dist = Math.hypot(dx, dy) || 1;

            if (isSpinning) {
              if (machineType === 'mechanical') {
                if (dist > GLOBE_R - BALL_R * 2.2) {
                  const tanX = -dy / dist;
                  const tanY = dx / dist;
                  const rimSpeed = drumSpeedRef.current * 18;
                  Body.applyForce(ball, ball.position, {
                    x: tanX * 0.00065 * rimSpeed,
                    y: tanY * 0.00065 * rimSpeed,
                  });
                }
              } else {
                if (ball.position.y > GLOBE_CY + 30) {
                  const upwardLift = (ball.position.y - (GLOBE_CY + 30)) * 0.000045;
                  const turbX = (Math.random() - 0.5) * 0.0008;
                  Body.applyForce(ball, ball.position, {
                    x: turbX,
                    y: -upwardLift * speedMultiplier,
                  });
                }
                const tanX = -dy / dist;
                const tanY = dx / dist;
                Body.applyForce(ball, ball.position, {
                  x: tanX * 0.00035 * speedMultiplier,
                  y: tanY * 0.00035 * speedMultiplier,
                });
              }
            }

            const spd = Math.hypot(ball.velocity.x, ball.velocity.y);
            const MAX_V = 16;
            if (spd > MAX_V) {
              const scale = MAX_V / spd;
              Body.setVelocity(ball, { x: ball.velocity.x * scale, y: ball.velocity.y * scale });
            }

            const maxAllowedDist = GLOBE_R - BALL_R - 1.5;
            if (dist > maxAllowedDist) {
              const nx = dx / dist;
              const ny = dy / dist;
              Body.setPosition(ball, {
                x: GLOBE_CX + nx * maxAllowedDist,
                y: GLOBE_CY + ny * maxAllowedDist,
              });
              const vDotN = ball.velocity.x * nx + ball.velocity.y * ny;
              if (vDotN > 0) {
                Body.setVelocity(ball, {
                  x: (ball.velocity.x - 1.6 * vDotN * nx) * 0.85,
                  y: (ball.velocity.y - 1.6 * vDotN * ny) * 0.85,
                });
              }
            }
          });

          const subSteps = 3;
          const stepDelta = 1000 / 60 / subSteps;
          for (let s = 0; s < subSteps; s++) {
            Engine.update(eng, stepDelta);
          }
        }

        const ex = exitRef.current;
        if (ex) {
          const elapsed = now - ex.started;
          const t = Math.min(1, elapsed / ex.duration);
          ex.angle += 0.22;

          const p0 = { x: ex.sx, y: ex.sy };
          const p1 = FUNNEL_TOP;
          const p2 = PIPE_TOP;
          const p3 = TUBE_END;

          let cx: number;
          let cy: number;

          if (t < 0.3) {
            const easeT = t / 0.3;
            cx = p0.x + (p1.x - p0.x) * easeT;
            cy = p0.y + (p1.y - p0.y) * easeT;
          } else if (t < 0.6) {
            const easeT = (t - 0.3) / 0.3;
            cx = p1.x + (p2.x - p1.x) * easeT;
            cy = p1.y + (p2.y - p1.y) * easeT;
          } else {
            const easeT = (t - 0.6) / 0.4;
            const accelT = easeT * easeT;
            cx = p2.x + (p3.x - p2.x) * easeT;
            cy = p2.y + (p3.y - p2.y) * accelT;
          }

          ex.currentX = cx;
          ex.currentY = cy;

          if (t >= 1) {
            exitRef.current = null;
            if (!reportedRef.current.has(ex.value)) {
              const slot = reportedRef.current.size;
              const row = Math.floor(slot / TRAY_COLS);
              const col = slot % TRAY_COLS;
              const rowCount = Math.min(TRAY_COLS, target - row * TRAY_COLS);
              const rowWidth = rowCount * TRAY_CELL_W - TRAY_GAP;
              const rowLeft = (W - rowWidth) / 2;

              landingRef.current = {
                value: ex.value,
                sx: TUBE_END.x,
                sy: TUBE_END.y,
                tx: rowLeft + TRAY_R + col * TRAY_CELL_W,
                ty: trayTop + TRAY_R + row * (TRAY_R * 2 + TRAY_ROW_GAP),
                started: Date.now(),
                duration: 380,
                angle: 0,
              };
            }
          }
        }

        const ln = landingRef.current;
        if (ln) {
          const elapsed = now - ln.started;
          const t = Math.min(1, elapsed / ln.duration);
          if (t >= 1) {
            landingRef.current = null;
            if (!reportedRef.current.has(ln.value)) {
              reportedRef.current.add(ln.value);
              const slotIdx = reportedRef.current.size - 1;
              soundEffects.playTrayDing(slotIdx);
              if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
                try {
                  navigator.vibrate([15, 30, 20]);
                } catch (_) { }
              }
              onDrawnRef.current(ln.value);
            }
          }
        }

        if (
          phaseRef.current === 'drawing' &&
          (reportedRef.current.size >= target || bodiesRef.current.length === 0) &&
          !exitRef.current &&
          !landingRef.current
        ) {
          setPhaseState('idle');
          if (reportedRef.current.size >= target) {
            setFlash(true);
            setTimeout(() => setFlash(false), 1200);
          }
        }

        ctx.clearRect(0, 0, W, H);

        drawHousing(ctx);
        drawDrum(ctx, currentDrumAngle);

        bodiesRef.current.forEach((b) => {
          drawBall(ctx, b.lottoNumber, b.position.x, b.position.y, b.angle, BALL_R);
        });

        drawExitTube(ctx);

        if (exitRef.current) {
          const eb = exitRef.current;
          drawBall(ctx, eb.value, eb.currentX, eb.currentY, eb.angle, BALL_R);
        }

        drawTray(ctx, target, TRAY_COLS, TRAY_CELL_W, trayLeft, trayTop);

        drawnNumbers.forEach((val, i) => {
          if (val == null) return;
          const row = Math.floor(i / TRAY_COLS);
          const col = i % TRAY_COLS;
          const rowCount = Math.min(TRAY_COLS, target - row * TRAY_COLS);
          const rowWidth = rowCount * TRAY_CELL_W - TRAY_GAP;
          const rowLeft = (W - rowWidth) / 2;
          const sx = rowLeft + TRAY_R + col * TRAY_CELL_W;
          const sy = trayTop + TRAY_R + row * (TRAY_R * 2 + TRAY_ROW_GAP);
          drawBall(ctx, val, sx, sy, 0, TRAY_R);
        });

        if (landingRef.current) {
          const l = landingRef.current;
          const t = Math.min(1, (now - l.started) / l.duration);
          const k = 1 - Math.pow(1 - t, 3);
          const hop = Math.sin(t * Math.PI) * 7;
          const curX = l.sx + (l.tx - l.sx) * k;
          const curY = l.sy + (l.ty - l.sy) * k - hop;
          drawBall(ctx, l.value, curX, curY, t * Math.PI * 2, TRAY_R);
        }

        drawGlassOverlay(ctx);
        drawStatusBadge(ctx, phaseRef.current);

        if (debugModeRef.current) {
          drawPhysicsDebug(ctx, fpsRef.current);
        }

        animFrameRef.current = requestAnimationFrame(render);
      };

      animFrameRef.current = requestAnimationFrame(render);

      return () => {
        cancelAnimationFrame(animFrameRef.current);
      };
    }, [
      target,
      TRAY_COLS,
      TRAY_CELL_W,
      trayLeft,
      trayTop,
      drawnNumbers,
      machineType,
      speedMultiplier,
      setPhaseState,
    ]);

    function drawHousing(ctx: CanvasRenderingContext2D) {
      ctx.save();

      const grad = ctx.createLinearGradient(
        GLOBE_CX,
        GLOBE_CY - GLOBE_R - 22,
        GLOBE_CX,
        GLOBE_CY - GLOBE_R + 12
      );
      grad.addColorStop(0, '#94A3B8');
      grad.addColorStop(1, '#CBD5E1');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(GLOBE_CX, GLOBE_CY, GLOBE_R + 12, Math.PI * 1.15, Math.PI * 1.85);
      ctx.lineTo(GLOBE_CX + 60, GLOBE_CY - GLOBE_R - 22);
      ctx.lineTo(GLOBE_CX - 60, GLOBE_CY - GLOBE_R - 22);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.arc(GLOBE_CX, GLOBE_CY, GLOBE_R + 10, 0, Math.PI * 2);
      ctx.strokeStyle = '#94A3B8';
      ctx.lineWidth = 4;
      ctx.stroke();

      ctx.fillStyle = '#F8FAFC';
      ctx.beginPath();
      ctx.arc(GLOBE_CX, GLOBE_CY, GLOBE_R, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    function drawDrum(ctx: CanvasRenderingContext2D, drumAngle: number) {
      ctx.save();
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
      ctx.lineWidth = 1.5;

      const numSlats = 16;
      for (let i = 0; i < numSlats; i++) {
        const a = drumAngle + (i * Math.PI * 2) / numSlats;
        const x1 = GLOBE_CX + Math.cos(a) * (GLOBE_R - 2);
        const y1 = GLOBE_CY + Math.sin(a) * (GLOBE_R - 2);
        const x2 = GLOBE_CX + Math.cos(a) * (GLOBE_R - 18);
        const y2 = GLOBE_CY + Math.sin(a) * (GLOBE_R - 18);

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }

      paddlesRef.current.forEach((paddle) => {
        ctx.save();
        ctx.translate(paddle.position.x, paddle.position.y);
        ctx.rotate(paddle.angle);

        ctx.fillStyle = '#64748B';
        ctx.beginPath();
        ctx.roundRect(-PADDLE_LEN / 2, -PADDLE_THICK / 2, PADDLE_LEN, PADDLE_THICK, 3);
        ctx.fill();

        ctx.fillStyle = '#334155';
        ctx.beginPath();
        ctx.arc(-PADDLE_LEN / 2, 0, PADDLE_THICK / 2, 0, Math.PI * 2);
        ctx.arc(PADDLE_LEN / 2, 0, PADDLE_THICK / 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      });

      ctx.fillStyle = '#CBD5E1';
      ctx.beginPath();
      ctx.arc(GLOBE_CX, GLOBE_CY, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.save();
      ctx.translate(GLOBE_CX, GLOBE_CY);
      ctx.rotate(drumAngle * 2);
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 2;
      for (let j = 0; j < 3; j++) {
        ctx.beginPath();
        ctx.moveTo(-7, 0);
        ctx.lineTo(7, 0);
        ctx.stroke();
        ctx.rotate(Math.PI / 3);
      }
      ctx.restore();

      ctx.restore();
    }

    function drawBall(
      ctx: CanvasRenderingContext2D,
      val: number,
      x: number,
      y: number,
      angle: number,
      r: number
    ) {
      const pIndex = (val - 1) % BALL_PALETTE.length;
      const theme = BALL_PALETTE[pIndex >= 0 ? pIndex : 0];

      ctx.save();
      ctx.translate(x, y);

      ctx.fillStyle = theme.bg;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 0.8;
      ctx.stroke();

      ctx.rotate(angle);
      const decalR = r * 0.64;
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(0, 0, decalR, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#0F172A';
      const valStr = String(val);
      const fontFactor = valStr.length >= 3 ? 0.60 : valStr.length === 2 ? 0.82 : 0.90;
      ctx.font = `bold ${Math.round(r * fontFactor)}px system-ui, -apple-system, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(valStr, 0, 1);

      ctx.restore();
    }

    function drawExitTube(ctx: CanvasRenderingContext2D) {
      ctx.save();
      const fTopW = 28;
      const fBotW = TUBE_HW + 2;

      ctx.fillStyle = '#64748B';
      ctx.beginPath();
      ctx.moveTo(GLOBE_CX - fTopW, FUNNEL_TOP.y);
      ctx.lineTo(GLOBE_CX - fBotW, PIPE_TOP.y);
      ctx.lineTo(GLOBE_CX + fBotW, PIPE_TOP.y);
      ctx.lineTo(GLOBE_CX + fTopW, FUNNEL_TOP.y);
      ctx.closePath();
      ctx.fill();

      if (phaseRef.current === 'drawing') {
        ctx.strokeStyle = '#38BDF8';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.ellipse(GLOBE_CX, FUNNEL_TOP.y, fTopW * 0.9, 6, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      const tubeLeft = GLOBE_CX - TUBE_HW;
      const tubeRight = GLOBE_CX + TUBE_HW;
      const tubeHeight = TUBE_END.y - PIPE_TOP.y;

      ctx.fillStyle = 'rgba(148, 163, 184, 0.45)';
      ctx.fillRect(tubeLeft, PIPE_TOP.y, TUBE_HW * 2, tubeHeight);

      ctx.strokeStyle = '#94A3B8';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(tubeLeft, PIPE_TOP.y);
      ctx.lineTo(tubeLeft, TUBE_END.y);
      ctx.moveTo(tubeRight, PIPE_TOP.y);
      ctx.lineTo(tubeRight, TUBE_END.y);
      ctx.stroke();

      ctx.fillStyle = '#475569';
      ctx.fillRect(tubeLeft - 3, PIPE_TOP.y - 2, TUBE_HW * 2 + 6, 5);
      ctx.fillRect(tubeLeft - 3, TUBE_END.y - 3, TUBE_HW * 2 + 6, 6);

      ctx.restore();
    }

    function drawTray(
      ctx: CanvasRenderingContext2D,
      totalSlots: number,
      cols: number,
      cellW: number,
      left: number,
      top: number
    ) {
      if (totalSlots <= 0) return;
      ctx.save();

      const paddingX = 14;
      const paddingY = 10;
      const frameX = left - paddingX;
      const frameY = top - paddingY;
      const frameW = trayW + paddingX * 2;
      const frameH = trayH + paddingY * 2;

      ctx.fillStyle = '#E2E8F0';
      ctx.strokeStyle = flash ? '#F59E0B' : '#94A3B8';
      ctx.lineWidth = flash ? 3 : 1.5;

      ctx.beginPath();
      ctx.roundRect(frameX, frameY, frameW, frameH, 14);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.roundRect(left - 6, top - 3, trayW + 12, trayH + 6, 8);
      ctx.fill();

      for (let i = 0; i < totalSlots; i++) {
        const row = Math.floor(i / cols);
        const col = i % cols;
        const rowCount = Math.min(cols, totalSlots - row * cols);
        const rowWidth = rowCount * cellW - TRAY_GAP;
        const rowLeft = (W - rowWidth) / 2;
        const sx = rowLeft + TRAY_R + col * cellW;
        const sy = top + TRAY_R + row * (TRAY_R * 2 + TRAY_ROW_GAP);

        ctx.fillStyle = '#1E293B';
        ctx.beginPath();
        ctx.arc(sx, sy, TRAY_R + 1, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(sx, sy, TRAY_R, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#475569';
        ctx.font = '600 9px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(i + 1), sx, sy);
      }

      ctx.restore();
    }

    function drawGlassOverlay(ctx: CanvasRenderingContext2D) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(GLOBE_CX, GLOBE_CY, GLOBE_R - 1, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
      ctx.beginPath();
      ctx.ellipse(GLOBE_CX - 32, GLOBE_CY - 44, GLOBE_R * 0.52, 15, -Math.PI / 10, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.beginPath();
      ctx.ellipse(GLOBE_CX + 28, GLOBE_CY + 52, GLOBE_R * 0.4, 8, Math.PI / 8, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    function drawStatusBadge(ctx: CanvasRenderingContext2D, currentPhase: Phase) {
      if (currentPhase === 'idle') return;

      const labels: Record<Phase, { text: string; color: string; bg: string }> = {
        idle: { text: '', color: '', bg: '' },
        falling: { text: 'AGITATING', color: '#B45309', bg: 'rgba(254, 243, 199, 0.95)' },
        spinning: { text: 'TUMBLING', color: '#1D4ED8', bg: 'rgba(219, 234, 254, 0.95)' },
        drawing: { text: 'SELECTING BALL', color: '#15803D', bg: 'rgba(220, 252, 231, 0.95)' },
      };

      const item = labels[currentPhase];
      if (!item.text) return;

      ctx.save();
      ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const textMetrics = ctx.measureText(item.text);
      const badgeW = textMetrics.width + 24;
      const badgeH = 22;
      const badgeX = GLOBE_CX - badgeW / 2;
      const badgeY = GLOBE_CY - GLOBE_R - 38;

      ctx.fillStyle = item.bg;
      ctx.strokeStyle = item.color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 11);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = item.color;
      ctx.fillText(item.text, GLOBE_CX, badgeY + badgeH / 2);
      ctx.restore();
    }

    function drawPhysicsDebug(ctx: CanvasRenderingContext2D, currentFps: number) {
      ctx.save();
      ctx.lineWidth = 1.2;
      wallBodiesRef.current.forEach((wall, idx) => {
        const verts = wall.vertices;
        if (verts.length === 0) return;

        ctx.strokeStyle = idx % 2 === 0 ? '#06B6D4' : '#0284C7';
        ctx.fillStyle = 'rgba(6, 182, 212, 0.12)';
        ctx.beginPath();
        ctx.moveTo(verts[0].x, verts[0].y);
        for (let v = 1; v < verts.length; v++) {
          ctx.lineTo(verts[v].x, verts[v].y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#38BDF8';
        verts.forEach((pt) => {
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 1.2, 0, Math.PI * 2);
          ctx.fill();
        });
      });

      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.85)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(GLOBE_CX, GLOBE_CY, GLOBE_R - BALL_R - 1.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      paddlesRef.current.forEach((paddle) => {
        const verts = paddle.vertices;
        if (verts.length === 0) return;

        ctx.strokeStyle = '#F59E0B';
        ctx.fillStyle = 'rgba(245, 158, 11, 0.25)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(verts[0].x, verts[0].y);
        for (let v = 1; v < verts.length; v++) {
          ctx.lineTo(verts[v].x, verts[v].y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#FBBF24';
        ctx.beginPath();
        ctx.arc(paddle.position.x, paddle.position.y, 2.5, 0, Math.PI * 2);
        ctx.fill();

        const normAngle = paddle.angle;
        const normLen = 18;
        const nx = paddle.position.x + Math.cos(normAngle) * normLen;
        const ny = paddle.position.y + Math.sin(normAngle) * normLen;

        ctx.strokeStyle = '#EF4444';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(paddle.position.x, paddle.position.y);
        ctx.lineTo(nx, ny);
        ctx.stroke();

        const arrAng = Math.atan2(ny - paddle.position.y, nx - paddle.position.x);
        ctx.fillStyle = '#EF4444';
        ctx.beginPath();
        ctx.moveTo(nx, ny);
        ctx.lineTo(nx - 5 * Math.cos(arrAng - Math.PI / 6), ny - 5 * Math.sin(arrAng - Math.PI / 6));
        ctx.lineTo(nx - 5 * Math.cos(arrAng + Math.PI / 6), ny - 5 * Math.sin(arrAng + Math.PI / 6));
        ctx.closePath();
        ctx.fill();
      });

      let totalSpeed = 0;
      bodiesRef.current.forEach((ball) => {
        const vx = ball.velocity.x;
        const vy = ball.velocity.y;
        const spd = Math.hypot(vx, vy);
        totalSpeed += spd;

        ctx.strokeStyle = '#10B981';
        ctx.lineWidth = 1.6;
        ctx.fillStyle = 'rgba(16, 185, 129, 0.18)';
        ctx.beginPath();
        ctx.arc(ball.position.x, ball.position.y, BALL_R, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(ball.position.x, ball.position.y, 1.8, 0, Math.PI * 2);
        ctx.fill();

        if (spd > 0.12) {
          const vectorScale = 4.2;
          const endX = ball.position.x + vx * vectorScale;
          const endY = ball.position.y + vy * vectorScale;

          let vecColor = '#06B6D4';
          if (spd > 8) vecColor = '#EF4444';
          else if (spd > 5) vecColor = '#F59E0B';
          else if (spd > 2.5) vecColor = '#84CC16';

          ctx.strokeStyle = vecColor;
          ctx.fillStyle = vecColor;
          ctx.lineWidth = 1.8;

          ctx.beginPath();
          ctx.moveTo(ball.position.x, ball.position.y);
          ctx.lineTo(endX, endY);
          ctx.stroke();

          const angle = Math.atan2(vy, vx);
          const headLen = Math.min(6, Math.max(3.5, spd * 0.75));
          ctx.beginPath();
          ctx.moveTo(endX, endY);
          ctx.lineTo(endX - headLen * Math.cos(angle - Math.PI / 6), endY - headLen * Math.sin(angle - Math.PI / 6));
          ctx.lineTo(endX - headLen * Math.cos(angle + Math.PI / 6), endY - headLen * Math.sin(angle + Math.PI / 6));
          ctx.closePath();
          ctx.fill();
        }
      });

      ctx.save();
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(GLOBE_CX - 28, FUNNEL_TOP.y);
      ctx.lineTo(GLOBE_CX - TUBE_HW - 2, PIPE_TOP.y);
      ctx.lineTo(GLOBE_CX + TUBE_HW + 2, PIPE_TOP.y);
      ctx.lineTo(GLOBE_CX + 28, FUNNEL_TOP.y);
      ctx.stroke();
      ctx.restore();

      const avgSpeed = bodiesRef.current.length > 0 ? totalSpeed / bodiesRef.current.length : 0;
      const hudX = 14;
      const hudY = 14;
      const hudW = 146;
      const hudH = 96;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.strokeStyle = '#06B6D4';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.roundRect(hudX, hudY, hudW, hudH, 8);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#38BDF8';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'left';
      ctx.fillText('PHYSICS TELEMETRY', hudX + 8, hudY + 14);

      ctx.fillStyle = '#CBD5E1';
      ctx.font = '9px monospace';
      ctx.fillText(`FPS: ${currentFps.toFixed(0)}`, hudX + 8, hudY + 28);
      ctx.fillText(`Active Balls: ${bodiesRef.current.length}`, hudX + 8, hudY + 41);
      ctx.fillText(`Mean Speed: ${avgSpeed.toFixed(1)} px/f`, hudX + 8, hudY + 54);
      ctx.fillText(`Drum Speed: ${(drumSpeedRef.current * 60).toFixed(1)} rad/s`, hudX + 8, hudY + 67);

      ctx.fillStyle = '#06B6D4';
      ctx.fillRect(hudX + 8, hudY + 79, 6, 6);
      ctx.fillStyle = '#84CC16';
      ctx.fillRect(hudX + 17, hudY + 79, 6, 6);
      ctx.fillStyle = '#F59E0B';
      ctx.fillRect(hudX + 26, hudY + 79, 6, 6);
      ctx.fillStyle = '#EF4444';
      ctx.fillRect(hudX + 35, hudY + 79, 6, 6);

      ctx.fillStyle = '#94A3B8';
      ctx.font = '8px monospace';
      ctx.fillText('Velocity Vectors', hudX + 46, hudY + 85);

      ctx.restore();
    }

    return (
      <div className="relative flex flex-col items-center justify-center select-none w-full max-w-[360px] mx-auto gap-3">
        <canvas
          ref={canvasRef}
          style={{ width: W, height: H }}
          className="rounded-2xl drop-shadow-xl max-w-full h-auto touch-none"
        />

        <div className="grid grid-cols-2 gap-2 w-full">
          <button
            onClick={onDrawAll}
            disabled={isDrawing || isComplete}
            className="flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-lg text-xs font-semibold bg-neutral-900 text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <Zap className="w-4 h-4" />
            Draw All
          </button>
          <button
            onClick={onReset}
            className="flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-lg text-xs font-semibold border border-neutral-300 text-neutral-700 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>
        </div>
      </div>
    );
  }
);

LotteryMachine.displayName = 'LotteryMachine';