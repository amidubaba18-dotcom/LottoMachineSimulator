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

/* ------------------------------------------------------------------ */
/*  Dimensions & Constants                                            */
/* ------------------------------------------------------------------ */

const W = 360;
const H = 530;

const GLOBE_CX = W * 0.5;
const GLOBE_CY = 175;
const GLOBE_R = 126;
const BALL_R = 9.5;

// Paddles that physically rotate with the drum and scoop up balls
const NUM_PADDLES = 4;
const PADDLE_LEN = 38;
const PADDLE_THICK = 6;
const PADDLE_DIST = GLOBE_R - PADDLE_LEN / 2 - 2;

// Funnel & Exit Tube geometry
const FUNNEL_TOP = { x: GLOBE_CX, y: GLOBE_CY + GLOBE_R - 8 };
const PIPE_TOP = { x: GLOBE_CX, y: GLOBE_CY + GLOBE_R + 14 };
const TRAY_Y = H - 56;
const TUBE_END = { x: GLOBE_CX, y: TRAY_Y - 44 };
const TUBE_HW = 14;

const TRAY_R = 12;
const TRAY_GAP = 6;
const TRAY_ROW_GAP = 5;

// Physics parameters
const RESTITUTION = 0.72;
const BALL_FRICTION = 0.02;
const BALL_AIR = 0.003;
const BALL_DENSITY = 0.002;
const GRAVITY_Y = 0.45; // Real natural downward gravity

// 6 distinct lottery ball color groups
export const BALL_PALETTE = [
  { bg: '#E53E3E', text: '#FFFFFF', highlight: '#FEB2B2', border: '#9B2C2C' }, // Red
  { bg: '#DD6B20', text: '#FFFFFF', highlight: '#FBD38D', border: '#9C4221' }, // Orange
  { bg: '#D69E2E', text: '#FFFFFF', highlight: '#FAF089', border: '#975A16' }, // Gold
  { bg: '#38A169', text: '#FFFFFF', highlight: '#9AE6B4', border: '#22543D' }, // Green
  { bg: '#3182CE', text: '#FFFFFF', highlight: '#90CDF4', border: '#2A4365' }, // Blue
  { bg: '#805AD5', text: '#FFFFFF', highlight: '#D6BCFA', border: '#44337A' }, // Purple
  { bg: '#D53F8C', text: '#FFFFFF', highlight: '#FBB6CE', border: '#702459' }, // Magenta
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
    } = props;

    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const [phase, setPhase] = useState<Phase>('idle');
    const [flash, setFlash] = useState(false);

    const debugModeRef = useRef(debugMode);
    useEffect(() => {
      debugModeRef.current = debugMode;
    }, [debugMode]);

    const fpsRef = useRef(60);

    // References for loop and physics state
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

    useEffect(() => {
      onDrawnRef.current = onBallDrawn;
    }, [onBallDrawn]);

    useEffect(() => {
      soundEffects.setEnabled(soundEnabled);
    }, [soundEnabled]);

    const rangeSize = Math.max(0, max - min + 1);
    const target = Math.max(0, Math.min(numbersToPick, rangeSize));

    // Tray layout
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

    // Build Matter.js environment with smooth polygon circle walls and rotating lifter vanes
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

      // 1. Create 40 segmented boundary wall segments (NO overlapping inner corner snags)
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

      // 2. Create 4 rotating internal lifter paddles (Kinematic bodies)
      const paddles: Body[] = [];
      for (let i = 0; i < NUM_PADDLES; i++) {
        const paddle = Bodies.rectangle(GLOBE_CX, GLOBE_CY, PADDLE_LEN, PADDLE_THICK, {
          isStatic: true, // We will drive position & angle kinematically
          restitution: 0.6,
          friction: 0.2,
          chamfer: { radius: 2 },
        });
        paddles.push(paddle);
      }
      World.add(engine.world, paddles);
      paddlesRef.current = paddles;

      // 3. Create balls inside the globe
      const pool: number[] =
        customNumbers && customNumbers.length > 0
          ? [...customNumbers]
          : [];
      if (pool.length === 0) {
        for (let v = min; v <= max; v++) {
          pool.push(v);
        }
      }

      const balls: LottoBody[] = [];
      const maxSpawnR = GLOBE_R - BALL_R * 2 - 12;

      pool.forEach((val) => {
        // Distribute within sphere safely
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
        // Give slight initial random jitter
        Body.setVelocity(b, {
          x: (Math.random() - 0.5) * 1.5,
          y: (Math.random() - 0.5) * 1.5,
        });

        balls.push(b);
      });

      World.add(engine.world, balls);
      bodiesRef.current = balls;
      engineRef.current = engine;

      // Sound trigger on high-impact collisions
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
    }, [min, max, customNumbers, clearTimers, setPhaseState]);

    // Handle extraction trigger
    const triggerSingleDraw = useCallback(() => {
      const eng = engineRef.current;
      if (!eng || bodiesRef.current.length === 0) return;
      if (exitRef.current || landingRef.current) return;
      if (reportedRef.current.size >= target) return;

      // Find ball closest to bottom suction funnel or random pick if none close
      const candidates = [...bodiesRef.current];
      // Pick one with authentic selection bias towards bottom/suction area if in drawing phase
      candidates.sort((a, b) => {
        const distA = Math.hypot(a.position.x - FUNNEL_TOP.x, a.position.y - FUNNEL_TOP.y);
        const distB = Math.hypot(b.position.x - FUNNEL_TOP.x, b.position.y - FUNNEL_TOP.y);
        return distA - distB;
      });

      // Select from top 4 closest balls or random for natural variance
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

      // Stage 1: Agitate & start tumbling (500ms)
      timersRef.current.push(
        setTimeout(() => {
          setPhaseState('spinning');
        }, 600)
      );

      // Stage 2: Full spin (2000ms), then begin drawing sequence
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

    // Expose imperative handle
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

    // Initial setup and reset on range changes
    useEffect(() => {
      setupPhysics();
      return () => {
        clearTimers();
        if (engineRef.current) {
          Engine.clear(engineRef.current);
        }
      };
    }, [min, max, numbersToPick, setupPhysics, clearTimers]);

    // Continuous Animation & Physics Render Loop
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Handle Retina High-DPI
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

        // 1. Update drum speed and angle
        drumSpeedRef.current += (targetDrumSpeedRef.current - drumSpeedRef.current) * 0.04;
        drumAngleRef.current += drumSpeedRef.current * (dt * 60);

        // 2. Update physical rotating paddles (Kinematic bodies)
        const currentDrumAngle = drumAngleRef.current;
        paddlesRef.current.forEach((paddle, i) => {
          const paddleAngle = currentDrumAngle + (i * Math.PI * 2) / NUM_PADDLES;
          const px = GLOBE_CX + Math.cos(paddleAngle) * PADDLE_DIST;
          const py = GLOBE_CY + Math.sin(paddleAngle) * PADDLE_DIST;
          const tangentialAngle = paddleAngle + Math.PI / 2;

          Body.setPosition(paddle, { x: px, y: py });
          Body.setAngle(paddle, tangentialAngle);
        });

        // 3. Air blower / tangential swirl force in spinning/drawing modes
        if (eng && bodiesRef.current.length > 0) {
          const isSpinning = phaseRef.current === 'spinning' || phaseRef.current === 'drawing' || phaseRef.current === 'falling';

          bodiesRef.current.forEach((ball) => {
            const dx = ball.position.x - GLOBE_CX;
            const dy = ball.position.y - GLOBE_CY;
            const dist = Math.hypot(dx, dy) || 1;

            if (isSpinning) {
              if (machineType === 'mechanical') {
                // Outer perimeter friction: drum surface drags balls along in rotation direction
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
                // Blower mode: bottom air jet blasting upwards with turbulent eddy currents
                if (ball.position.y > GLOBE_CY + 30) {
                  const upwardLift = (ball.position.y - (GLOBE_CY + 30)) * 0.000045;
                  const turbX = (Math.random() - 0.5) * 0.0008;
                  Body.applyForce(ball, ball.position, {
                    x: turbX,
                    y: -upwardLift * speedMultiplier,
                  });
                }
                // Cyclonic circulation
                const tanX = -dy / dist;
                const tanY = dx / dist;
                Body.applyForce(ball, ball.position, {
                  x: tanX * 0.00035 * speedMultiplier,
                  y: tanY * 0.00035 * speedMultiplier,
                });
              }
            }

            // Clamping max velocity to avoid tunneling
            const spd = Math.hypot(ball.velocity.x, ball.velocity.y);
            const MAX_V = 16;
            if (spd > MAX_V) {
              const scale = MAX_V / spd;
              Body.setVelocity(ball, { x: ball.velocity.x * scale, y: ball.velocity.y * scale });
            }

            // Exact spherical containment safeguard
            const maxAllowedDist = GLOBE_R - BALL_R - 1.5;
            if (dist > maxAllowedDist) {
              const nx = dx / dist;
              const ny = dy / dist;
              Body.setPosition(ball, {
                x: GLOBE_CX + nx * maxAllowedDist,
                y: GLOBE_CY + ny * maxAllowedDist,
              });
              // Normal bounce velocity reflection
              const vDotN = ball.velocity.x * nx + ball.velocity.y * ny;
              if (vDotN > 0) {
                Body.setVelocity(ball, {
                  x: (ball.velocity.x - 1.6 * vDotN * nx) * 0.85,
                  y: (ball.velocity.y - 1.6 * vDotN * ny) * 0.85,
                });
              }
            }
          });

          // Run Matter.js physics step with substeps for rock-solid stability
          const subSteps = 3;
          const stepDelta = 1000 / 60 / subSteps;
          for (let s = 0; s < subSteps; s++) {
            Engine.update(eng, stepDelta);
          }
        }

        // 4. Update Exit / Suction tube animation
        const ex = exitRef.current;
        if (ex) {
          const elapsed = now - ex.started;
          const t = Math.min(1, elapsed / ex.duration);
          ex.angle += 0.22;

          // Three-stage curve: globe extraction -> funnel choke -> tube drop
          const p0 = { x: ex.sx, y: ex.sy };
          const p1 = FUNNEL_TOP;
          const p2 = PIPE_TOP;
          const p3 = TUBE_END;

          let cx: number;
          let cy: number;

          if (t < 0.3) {
            const easeT = t / 0.3;
            // Arc into funnel
            cx = p0.x + (p1.x - p0.x) * easeT;
            cy = p0.y + (p1.y - p0.y) * easeT;
          } else if (t < 0.6) {
            const easeT = (t - 0.3) / 0.3;
            cx = p1.x + (p2.x - p1.x) * easeT;
            cy = p1.y + (p2.y - p1.y) * easeT;
          } else {
            const easeT = (t - 0.6) / 0.4;
            // Accelerating drop down tube
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

        // 5. Update Landing tray roll animation
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

        // 6. Complete draw phase check
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

        /* ---------------------------------------------------------- */
        /*  CANVAS RENDERING                                          */
        /* ---------------------------------------------------------- */
        ctx.clearRect(0, 0, W, H);

        // A. Background Machine Stand & Housing
        drawHousing(ctx);

        // B. Acrylic Sphere Interior & Rotating Tumbler Drum
        drawDrum(ctx, currentDrumAngle);

        // C. Tumbling Physics Balls
        bodiesRef.current.forEach((b) => {
          drawBall(ctx, b.lottoNumber, b.position.x, b.position.y, b.angle, BALL_R);
        });

        // D. Suction / Exit Tube Chute
        drawExitTube(ctx);

        // E. Animated Exit Ball in Tube
        if (exitRef.current) {
          const eb = exitRef.current;
          drawBall(ctx, eb.value, eb.currentX, eb.currentY, eb.angle, BALL_R);
        }

        // F. Landing Tray & Sockets
        drawTray(ctx, target, TRAY_COLS, TRAY_CELL_W, trayLeft, trayTop);

        // G. Settled Balls in Tray
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

        // H. Active Landing Ball rolling into tray
        if (landingRef.current) {
          const l = landingRef.current;
          const t = Math.min(1, (now - l.started) / l.duration);
          // Cubic ease out
          const k = 1 - Math.pow(1 - t, 3);
          const hop = Math.sin(t * Math.PI) * 7;
          const curX = l.sx + (l.tx - l.sx) * k;
          const curY = l.sy + (l.ty - l.sy) * k - hop;
          drawBall(ctx, l.value, curX, curY, t * Math.PI * 2, TRAY_R);
        }

        // I. Glass Sphere Highlights & Rim Bezel
        drawGlassOverlay(ctx);

        // J. Status Badge
        drawStatusBadge(ctx, phaseRef.current);

        // K. Physics Debug Wireframe & Force Vectors
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

    /* -------------------------------------------------------------- */
    /*  Canvas Helper Functions                                       */
    /* -------------------------------------------------------------- */

    function drawHousing(ctx: CanvasRenderingContext2D) {
      // Pedestal stand (flat matte)
      ctx.save();

      // Top chrome canopy / crown
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

      // Outer bezel ring
      ctx.beginPath();
      ctx.arc(GLOBE_CX, GLOBE_CY, GLOBE_R + 10, 0, Math.PI * 2);
      ctx.strokeStyle = '#94A3B8';
      ctx.lineWidth = 4;
      ctx.stroke();

      // Inner chamber backdrop (flat studio fill)
      ctx.fillStyle = '#F8FAFC';
      ctx.beginPath();
      ctx.arc(GLOBE_CX, GLOBE_CY, GLOBE_R, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    function drawDrum(ctx: CanvasRenderingContext2D, drumAngle: number) {
      ctx.save();
      // Rotating outer rim marker & wire ribs
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

      // Rotating paddles with metallic highlight
      paddlesRef.current.forEach((paddle) => {
        ctx.save();
        ctx.translate(paddle.position.x, paddle.position.y);
        ctx.rotate(paddle.angle);

        // Paddle blade (flat matte)
        ctx.fillStyle = '#64748B';
        ctx.beginPath();
        ctx.roundRect(
          -PADDLE_LEN / 2,
          -PADDLE_THICK / 2,
          PADDLE_LEN,
          PADDLE_THICK,
          3
        );
        ctx.fill();

        // Paddle tip rubber guard
        ctx.fillStyle = '#334155';
        ctx.beginPath();
        ctx.arc(-PADDLE_LEN / 2, 0, PADDLE_THICK / 2, 0, Math.PI * 2);
        ctx.arc(PADDLE_LEN / 2, 0, PADDLE_THICK / 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      });

      // Center chrome axle hub
      ctx.fillStyle = '#CBD5E1';
      ctx.beginPath();
      ctx.arc(GLOBE_CX, GLOBE_CY, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Spinning axle logo / star mark
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

      // Flat spherical ball base
      ctx.fillStyle = theme.bg;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();

      // Perimeter rim definition
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 0.8;
      ctx.stroke();

      // Central white number circle / decal
      ctx.rotate(angle);
      const decalR = r * 0.64;
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(0, 0, decalR, 0, Math.PI * 2);
      ctx.fill();

      // Crisp numbered text
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
      // Lower funnel guide
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

      // Funnel mouth suction glow
      if (phaseRef.current === 'drawing') {
        ctx.strokeStyle = '#38BDF8';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.ellipse(GLOBE_CX, FUNNEL_TOP.y, fTopW * 0.9, 6, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Acrylic transparent chute tube
      const tubeLeft = GLOBE_CX - TUBE_HW;
      const tubeRight = GLOBE_CX + TUBE_HW;
      const tubeHeight = TUBE_END.y - PIPE_TOP.y;

      // Tube outer glass casing (flat frosted)
      ctx.fillStyle = 'rgba(148, 163, 184, 0.45)';
      ctx.fillRect(tubeLeft, PIPE_TOP.y, TUBE_HW * 2, tubeHeight);

      // Tube glass edges
      ctx.strokeStyle = '#94A3B8';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(tubeLeft, PIPE_TOP.y);
      ctx.lineTo(tubeLeft, TUBE_END.y);
      ctx.moveTo(tubeRight, PIPE_TOP.y);
      ctx.lineTo(tubeRight, TUBE_END.y);
      ctx.stroke();

      // Chrome collars at joints
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

      // Outer tray frame
      const paddingX = 14;
      const paddingY = 10;
      const frameX = left - paddingX;
      const frameY = top - paddingY;
      const frameW = trayW + paddingX * 2;
      const frameH = trayH + paddingY * 2;

      // Tray metallic chassis
      ctx.fillStyle = '#E2E8F0';
      ctx.strokeStyle = flash ? '#F59E0B' : '#94A3B8';
      ctx.lineWidth = flash ? 3 : 1.5;

      ctx.beginPath();
      ctx.roundRect(frameX, frameY, frameW, frameH, 14);
      ctx.fill();
      ctx.stroke();

      // Inner dark recessed ball track
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.roundRect(left - 6, top - 3, trayW + 12, trayH + 6, 8);
      ctx.fill();

      // Individual socket recesses
      for (let i = 0; i < totalSlots; i++) {
        const row = Math.floor(i / cols);
        const col = i % cols;
        const rowCount = Math.min(cols, totalSlots - row * cols);
        const rowWidth = rowCount * cellW - TRAY_GAP;
        const rowLeft = (W - rowWidth) / 2;
        const sx = rowLeft + TRAY_R + col * cellW;
        const sy = top + TRAY_R + row * (TRAY_R * 2 + TRAY_ROW_GAP);

        // Dark bevel
        ctx.fillStyle = '#1E293B';
        ctx.beginPath();
        ctx.arc(sx, sy, TRAY_R + 1, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(sx, sy, TRAY_R, 0, Math.PI * 2);
        ctx.stroke();

        // Socket number indicator
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
      // Glass sphere reflections & glares
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(GLOBE_CX, GLOBE_CY, GLOBE_R - 1, 0, Math.PI * 2);
      ctx.stroke();

      // Primary curved glass highlight glare (top-left)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
      ctx.beginPath();
      ctx.ellipse(
        GLOBE_CX - 32,
        GLOBE_CY - 44,
        GLOBE_R * 0.52,
        15,
        -Math.PI / 10,
        0,
        Math.PI * 2
      );
      ctx.fill();

      // Secondary subtle glass bottom rim reflection
      ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.beginPath();
      ctx.ellipse(
        GLOBE_CX + 28,
        GLOBE_CY + 52,
        GLOBE_R * 0.4,
        8,
        Math.PI / 8,
        0,
        Math.PI * 2
      );
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

      // 1. Drum Walls Collision Wireframe (40 segmented polygon bodies)
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

        // Vertex anchor points
        ctx.fillStyle = '#38BDF8';
        verts.forEach((pt) => {
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 1.2, 0, Math.PI * 2);
          ctx.fill();
        });
      });

      // 2. Theoretical Containment Boundary (Red Dashed Limit Ring)
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.85)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(GLOBE_CX, GLOBE_CY, GLOBE_R - BALL_R - 1.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // 3. Rotating Kinematic Paddles Wireframe Bounds & Orientation Vectors
      paddlesRef.current.forEach((paddle, i) => {
        const verts = paddle.vertices;
        if (verts.length === 0) return;

        // Paddle bounding box
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

        // Paddle Center Dot
        ctx.fillStyle = '#FBBF24';
        ctx.beginPath();
        ctx.arc(paddle.position.x, paddle.position.y, 2.5, 0, Math.PI * 2);
        ctx.fill();

        // Normal Force / Thrust Vector from Paddle Face
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

        // Normal arrow head
        const arrAng = Math.atan2(ny - paddle.position.y, nx - paddle.position.x);
        ctx.fillStyle = '#EF4444';
        ctx.beginPath();
        ctx.moveTo(nx, ny);
        ctx.lineTo(
          nx - 5 * Math.cos(arrAng - Math.PI / 6),
          ny - 5 * Math.sin(arrAng - Math.PI / 6)
        );
        ctx.lineTo(
          nx - 5 * Math.cos(arrAng + Math.PI / 6),
          ny - 5 * Math.sin(arrAng + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fill();
      });

      // 4. Ball Collision Wireframes & Force / Velocity Vectors
      let totalSpeed = 0;
      bodiesRef.current.forEach((ball) => {
        const vx = ball.velocity.x;
        const vy = ball.velocity.y;
        const spd = Math.hypot(vx, vy);
        totalSpeed += spd;

        // Collision perimeter circle in vivid green
        ctx.strokeStyle = '#10B981';
        ctx.lineWidth = 1.6;
        ctx.fillStyle = 'rgba(16, 185, 129, 0.18)';
        ctx.beginPath();
        ctx.arc(ball.position.x, ball.position.y, BALL_R, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Center pivot dot
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(ball.position.x, ball.position.y, 1.8, 0, Math.PI * 2);
        ctx.fill();

        // Force / Velocity Vector Arrow
        if (spd > 0.12) {
          const vectorScale = 4.2;
          const endX = ball.position.x + vx * vectorScale;
          const endY = ball.position.y + vy * vectorScale;

          // Color scale: cyan -> lime -> amber -> red
          let vecColor = '#06B6D4'; // cyan: low (< 2.5)
          if (spd > 8) vecColor = '#EF4444'; // red: extreme (> 8)
          else if (spd > 5) vecColor = '#F59E0B'; // amber: high (5-8)
          else if (spd > 2.5) vecColor = '#84CC16'; // lime: moderate (2.5-5)

          ctx.strokeStyle = vecColor;
          ctx.fillStyle = vecColor;
          ctx.lineWidth = 1.8;

          // Arrow shaft
          ctx.beginPath();
          ctx.moveTo(ball.position.x, ball.position.y);
          ctx.lineTo(endX, endY);
          ctx.stroke();

          // Arrow head
          const angle = Math.atan2(vy, vx);
          const headLen = Math.min(6, Math.max(3.5, spd * 0.75));
          ctx.beginPath();
          ctx.moveTo(endX, endY);
          ctx.lineTo(
            endX - headLen * Math.cos(angle - Math.PI / 6),
            endY - headLen * Math.sin(angle - Math.PI / 6)
          );
          ctx.lineTo(
            endX - headLen * Math.cos(angle + Math.PI / 6),
            endY - headLen * Math.sin(angle + Math.PI / 6)
          );
          ctx.closePath();
          ctx.fill();
        }
      });

      // 5. Suction Funnel & Chute Collision Outlines
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

      // 6. Physics Telemetry HUD Overlay
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

      // Force vector legend
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