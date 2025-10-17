// /hooks/useFirstVisitCelebration.ts
import { useEffect, MutableRefObject } from 'react';

type Opts = {
  enabled: boolean;
  userId?: string;
  cooldownHours?: number;
  containerRef?: MutableRefObject<HTMLElement | null>;
  message?: string;
};

const keyFor = (uid?: string) => `celebrated_v3_firecracker_plus_${uid ?? 'anon'}`;

export function useFirstVisitCelebration({
  enabled,
  userId,
  cooldownHours = 24,
  containerRef,
  message = '🎉 Welcome to Nakoda Mobile!',
}: Opts) {
  useEffect(() => {
    if (!enabled) return;
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const k = keyFor(userId);
    const last = Number(localStorage.getItem(k) || 0);
    const now = Date.now();
    if (now - last < cooldownHours * 3600_000) return;

    // Set cooldown early to avoid duplicate firing in dev StrictMode
    localStorage.setItem(k, String(now));

    let disposed = false;
    let cleanup = () => {};

    (async () => {
      // dynamic import keeps Vite happy
      const confetti = (await import('canvas-confetti')).default;

      const host = containerRef?.current ?? document.body;

      const canvas = document.createElement('canvas');
      Object.assign(canvas.style, {
        position: 'fixed',
        inset: '0',
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: '9999',
      } as Partial<CSSStyleDeclaration>);
      host.appendChild(canvas);

      const fire = confetti.create(canvas, { resize: true, useWorker: true });

      const COLORS = ['#ff0040', '#ff7a00', '#ffd400', '#27d17f', '#00c6ff', '#8a2be2'];
      const playPop = () => {
        try {
          // Place this file at: public/firecracker.mp3
          new Audio('/firecracker.mp3').play().catch(() => {});
        } catch {}
      };

      const msg = document.createElement('div');
      msg.textContent = message;
      Object.assign(msg.style, {
        position: 'fixed',
        top: '38%',
        left: '50%',
        transform: 'translateX(-50%)',
        fontSize: '2rem',
        fontWeight: '700',
        color: '#fff',
        textShadow: '0 2px 12px rgba(0,0,0,0.6)',
        zIndex: '10000',
        opacity: '0',
        animation: 'celeFade 3.6s ease 0.3s forwards',
      } as Partial<CSSStyleDeclaration>);
      host.appendChild(msg);

      const styleId = 'celebration-keyframes';
      if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
          @keyframes celeFade {
            0% { opacity: 0; transform: translateX(-50%) translateY(6px); }
            10% { opacity: 1; transform: translateX(-50%) translateY(0); }
            70% { opacity: 1; }
            100% { opacity: 0; transform: translateX(-50%) translateY(-8px); }
          }`;
        document.head.appendChild(style);
      }

      const timeouts: number[] = [];
      const intervals: number[] = [];
      const launch = (fromLeft: boolean, delay = 0) => {
        const tid = window.setTimeout(() => {
          if (disposed) return;
          const xStart = fromLeft ? 0.04 : 0.96;
          const xTarget = fromLeft ? Math.random() * 0.42 + 0.22 : Math.random() * 0.42 + 0.36;
          const yTarget = Math.random() * 0.21 + 0.07;
          const yStart = 0.96;
          const steps = 20;
          let step = 0;

          const trailId = window.setInterval(() => {
            if (disposed) return clearInterval(trailId);
            step++;
            const t = step / steps;
            const ease = (u: number) => 1 - Math.pow(1 - u, 2);
            const x = xStart + (xTarget - xStart) * ease(t);
            const y = yStart + (yTarget - yStart) * ease(t);

            fire({
              particleCount: 10,
              startVelocity: 60,
              spread: 12,
              gravity: 1.3,
              ticks: 50,
              origin: { x, y },
              scalar: 0.5,
              drift: fromLeft ? 0.25 : -0.25,
              colors: COLORS,
              shapes: ['circle'],
            });

            if (step % 5 === 0) {
              fire({
                particleCount: 6,
                startVelocity: 70,
                spread: 18,
                gravity: 1.2,
                ticks: 60,
                origin: { x, y },
                scalar: 0.6,
                colors: COLORS,
              });
            }

            if (step >= steps) {
              clearInterval(trailId);
              playPop();
              fire({
                particleCount: 140,
                startVelocity: 62,
                spread: 360,
                gravity: 0.95,
                ticks: 190,
                origin: { x: xTarget, y: yTarget },
                scalar: 1.1,
                colors: COLORS,
                shapes: ['circle', 'square'],
              });

              const ringDelay = window.setTimeout(() => {
                playPop();
                fire({
                  particleCount: 90,
                  startVelocity: 42,
                  spread: 70,
                  gravity: 1.0,
                  ticks: 150,
                  origin: { x: xTarget, y: yTarget + 0.02 },
                  scalar: 0.9,
                  colors: COLORS,
                });
              }, 120);
              timeouts.push(ringDelay);

              const crackleDelay = window.setTimeout(() => {
                fire({
                  particleCount: 70,
                  startVelocity: 48,
                  spread: 85,
                  gravity: 1.05,
                  ticks: 160,
                  origin: { x: xTarget, y: yTarget - 0.015 },
                  scalar: 0.85,
                  colors: COLORS,
                });
              }, 230);
              timeouts.push(crackleDelay);
            }
          }, 26);

          intervals.push(trailId);
        }, delay);
        timeouts.push(tid);
      };

      launch(true, 0);
      launch(false, 220);
      launch(true, 440);
      launch(false, 660);
      launch(Math.random() > 0.5, 880);
      launch(Math.random() > 0.5, 1100);

      const finaleDelay = window.setTimeout(() => {
        playPop();
        fire({
          particleCount: 320,
          startVelocity: 80,
          spread: 360,
          gravity: 0.9,
          ticks: 200,
          origin: { x: 0.5, y: 0.28 },
          scalar: 1.35,
          colors: COLORS,
          shapes: ['circle', 'square'],
        });
        const shimmerId = window.setInterval(() => {
          fire({
            particleCount: 24,
            startVelocity: 35,
            spread: 45,
            gravity: 1.0,
            ticks: 120,
            origin: { x: 0.5 + (Math.random() - 0.5) * 0.12, y: 0.28 + (Math.random() - 0.5) * 0.06 },
            scalar: 0.75,
            colors: COLORS,
          });
        }, 90);
        intervals.push(shimmerId);
        const stopShimmer = window.setTimeout(() => clearInterval(shimmerId), 1200);
        timeouts.push(stopShimmer);
      }, 1500);
      timeouts.push(finaleDelay);

      cleanup = () => {
        try { fire.reset(); } catch {}
        timeouts.forEach(clearTimeout);
        intervals.forEach(clearInterval);
        canvas.remove();
        msg.remove();
      };
    })();

    return () => {
      disposed = true;
      cleanup();
    };
  }, [enabled, userId, cooldownHours, containerRef, message]);
}
