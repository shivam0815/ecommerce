// src/pages/LoginSuccess.tsx
import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const TOKEN_KEYS = ['token', 'access_token', 'id_token', 'jwt', 't'] as const;

function getTokenFromUrl(u: URL): string | null {
  // 1) query string
  for (const k of TOKEN_KEYS) {
    const v = u.searchParams.get(k);
    if (v) return v;
  }

  // 2) hash forms: "#token=..." or "#/login-success?token=..." etc
  const hash = u.hash || '';
  if (!hash) return null;

  // exact "#token=..."
  if (hash.startsWith('#')) {
    const qp = new URLSearchParams(hash.slice(1));
    for (const k of TOKEN_KEYS) {
      const v = qp.get(k);
      if (v) return v;
    }
  }

  // hash with query inside: "#/path?token=..."
  if (hash.includes('?')) {
    const afterQ = hash.split('?')[1];
    const qp2 = new URLSearchParams(afterQ);
    for (const k of TOKEN_KEYS) {
      const v = qp2.get(k);
      if (v) return v;
    }
  }
  return null;
}

const LoginSuccess: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { setToken, setIsAuthenticated, loadUser } = useAuth();

  useEffect(() => {
    let cancelled = false;

    const commit = async (jwt: string) => {
      if (cancelled) return;
      // persist + inform context
      localStorage.setItem('nakoda-token', jwt);
      setToken(jwt);
      setIsAuthenticated(true);

      // scrub token from address bar
      const { origin, pathname } = new URL(window.location.href);
      window.history.replaceState({}, document.title, origin + pathname);

      try {
        await loadUser();
      } finally {
        if (!cancelled) navigate('/profile', { replace: true });
      }
    };

    // Try immediately
    const nowUrl = new URL(window.location.href);
    const immediate = getTokenFromUrl(nowUrl);
    if (immediate) {
      commit(immediate);
      return () => { cancelled = true; };
    }

    // If token already in storage (eg. popup/other tab set it), use it
    const stored = localStorage.getItem('nakoda-token');
    if (stored) {
      commit(stored);
      return () => { cancelled = true; };
    }

    // Poll briefly for late-arriving hash/query (some IdPs/hosts add it after load)
    let tries = 0;
    const iv = setInterval(() => {
      tries += 1;
      const u = new URL(window.location.href);
      const t = getTokenFromUrl(u);
      if (t) {
        clearInterval(iv);
        commit(t);
      } else if (tries >= 20) {
        // ~1s elapsed (20 * 50ms) — give up quietly
        clearInterval(iv);
        if (!cancelled) navigate('/login', { replace: true });
      }
    }, 50);

    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, [navigate, location, setToken, setIsAuthenticated, loadUser]);

  return <p>Logging you in…</p>;
};

export default LoginSuccess;
