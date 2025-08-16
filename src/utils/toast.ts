// src/utils/toast.ts
let toastRoot: HTMLDivElement | null = null;

export function showToast(message: string) {
  if (!toastRoot) {
    toastRoot = document.createElement('div');
    toastRoot.style.cssText = `
      position: fixed; top: 16px; right: 16px; z-index: 9999;
      display: flex; flex-direction: column; gap: 10px; pointer-events: none;
    `;
    document.body.appendChild(toastRoot);
  }

  const el = document.createElement('div');
  el.innerHTML = message;
  el.style.cssText = `
    pointer-events: auto;
    background: #111827; color: #fff; padding: 12px 14px; border-radius: 10px;
    box-shadow: 0 8px 30px rgba(0,0,0,.25); font-size: 14px; max-width: 360px;
    display:flex; align-items:center; gap:10px; transform: translateY(-8px); opacity:0;
    transition: all .2s ease;
  `;
  toastRoot.appendChild(el);

  requestAnimationFrame(() => {
    el.style.transform = 'translateY(0)';
    el.style.opacity = '1';
  });

  setTimeout(() => {
    el.style.transform = 'translateY(-8px)';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 180);
  }, 4500);
}

export async function requestBrowserNotifyPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission !== 'denied') {
    const p = await Notification.requestPermission();
    return p === 'granted';
  }
  return false;
}

export function browserNotify(title: string, body?: string) {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    new Notification(title, { body });
  }
}

export function playDing() {
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.value = 880;
    o.connect(g); g.connect(ctx.destination);
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
    o.start(); o.stop(ctx.currentTime + 0.26);
  } catch {/* ignore autoplay blocks */}
}
