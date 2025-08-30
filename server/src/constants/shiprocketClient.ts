// src/integrations/shiprocketClient.ts
import axios, { AxiosInstance, AxiosRequestConfig, Method } from "axios";

/* ================================
   Types
================================ */
type ServiceabilityParams = {
  pickup_postcode: string;
  delivery_postcode: string;
  weight: number; // kg
  cod?: 0 | 1;
  declared_value?: number;
  mode?: "Air" | "Surface";
};

type CreateOrderPayload = Record<string, any>;

/* ================================
   Env + helpers (masked logging)
================================ */
const BASE_URL = (process.env.SHIPROCKET_BASE_URL || "https://apiv2.shiprocket.in").trim();
const EMAIL = (process.env.SHIPROCKET_EMAIL || "").trim();
const PASSWORD = (process.env.SHIPROCKET_PASSWORD || "").trim();
const DEBUG = String(process.env.DEBUG_SHIPROCKET || "0") === "1";

function maskRight(s?: string, keep = 4) {
  if (!s) return "(empty)";
  return "*".repeat(Math.max(0, s.length - keep)) + s.slice(-keep);
}
function maskToken(tok?: string) {
  if (!tok) return "(empty)";
  if (tok.length <= 8) return "********";
  return tok.slice(0, 4) + "…" + tok.slice(-4);
}
function trimJSON(v: any, max = 1200) {
  try {
    const s = JSON.stringify(v);
    return s.length > max ? s.slice(0, max) + "…(trimmed)" : s;
  } catch {
    return String(v);
  }
}
function nowIso() {
  return new Date().toISOString();
}
function log(...args: any[]) {
  if (DEBUG) console.log("[Shiprocket]", ...args);
}
function logWarn(...args: any[]) {
  if (DEBUG) console.warn("[Shiprocket]", ...args);
}
function logError(...args: any[]) {
  // Always log errors in DEV; in prod you can keep DEBUG=0 to silence
  console.error("[Shiprocket]", ...args);
}

/* One-time env visibility (masked) */
if (DEBUG) {
  log("ENV", {
    BASE_URL,
    EMAIL: maskRight(EMAIL),
    PASSWORD: PASSWORD ? `len:${PASSWORD.length}` : "(empty)",
  });
}
if (!EMAIL || !PASSWORD) {
  logWarn("⚠️ SHIPROCKET_EMAIL/PASSWORD not set. Shiprocket routes will fail until configured.");
}

/* Correlation ID generator for request logs */
let ridSeq = 0;
const nextRid = () => {
  ridSeq = (ridSeq + 1) % 999999;
  return `sr-${Date.now().toString(36)}-${ridSeq.toString(36)}`;
};

/* ================================
   Client
================================ */
class SRClient {
  private http: AxiosInstance;
  private token: string | null = null;
  private tokenExpiry = 0; // epoch ms
  private inflightLogin: Promise<string> | null = null;
  private lastLoginAttempt = 0;

  private static readonly LOGIN_COOLDOWN_MS = 30_000; // back off 30s after failed attempt
  private static readonly TOKEN_MARGIN_MS = 60_000;   // refresh 1m before expiry

  constructor() {
    this.http = axios.create({
      baseURL: BASE_URL,
      timeout: 30000,
      headers: { "Content-Type": "application/json" },
    });

    // ---- Interceptors for safe logging ----
    this.http.interceptors.request.use((cfg) => {
      const rid = (cfg.headers["x-rid"] as string) || nextRid();
      cfg.headers["x-rid"] = rid; // carry forward

      const start = Date.now();
      (cfg as any).__start = start;

      if (DEBUG) {
        // Clone headers w/o Authorization
        const headers = { ...(cfg.headers || {}) };
        if (headers.Authorization) headers.Authorization = `Bearer ${maskToken(String(headers.Authorization).replace(/^Bearer\s+/i, ""))}`;

        log("REQ", {
          rid,
          t: nowIso(),
          method: cfg.method?.toUpperCase(),
          url: `${cfg.baseURL ?? ""}${cfg.url}`,
          params: cfg.params,
          data: cfg.data && JSON.parse(trimJSON(cfg.data)),
          headers,
        });
      }
      return cfg;
    });

    this.http.interceptors.response.use(
      (res) => {
        const rid = (res.config.headers as any)?.["x-rid"] || "no-rid";
        const start = (res.config as any).__start as number | undefined;
        const ms = start ? Date.now() - start : undefined;

        if (DEBUG) {
          log("RES", {
            rid,
            t: nowIso(),
            status: res.status,
            ms,
            url: `${res.config.baseURL ?? ""}${res.config.url}`,
          });
        }
        return res;
      },
      (err) => {
        const cfg = err?.config || {};
        const rid = (cfg.headers && cfg.headers["x-rid"]) || "no-rid";
        const start = (cfg as any).__start as number | undefined;
        const ms = start ? Date.now() - start : undefined;

        const status = err?.response?.status;
        const body = err?.response?.data;

        logError("ERR", {
          rid,
          t: nowIso(),
          status,
          ms,
          url: `${cfg.baseURL ?? ""}${cfg.url ?? ""}`,
          message: err?.message,
          body: typeof body === "object" ? JSON.parse(trimJSON(body)) : body,
        });

        return Promise.reject(err);
      }
    );
  }

  /** Actually perform login (internal). Throws with SR message when possible. */
  private async doLogin(): Promise<string> {
    if (!EMAIL || !PASSWORD) throw new Error("Shiprocket credentials missing");

    const rid = nextRid();
    this.http.defaults.headers.common["x-rid"] = rid;

    try {
      const url = "/v1/external/auth/login";
      const { data, status } = await this.http.post(url, { email: EMAIL, password: PASSWORD });
      const token: string | undefined = data?.token || data?.access_token;
      if (!token) throw new Error("Shiprocket login response missing token");

      // Shiprocket tokens are typically ~24h; use 22h to be safe
      this.token = token;
      this.tokenExpiry = Date.now() + 22 * 60 * 60 * 1000;
      this.http.defaults.headers.common.Authorization = `Bearer ${token}`;

      if (DEBUG) {
        log("AUTH OK", { rid, status, token: maskToken(token), expInMs: this.tokenExpiry - Date.now() });
      }
      return token;
    } catch (err: any) {
      const status = err?.response?.status;
      const msg = err?.response?.data?.message || err?.message || "Shiprocket login failed";
      const body = err?.response?.data;

      logError("AUTH FAIL", {
        rid,
        status,
        msg,
        body: typeof body === "object" ? JSON.parse(trimJSON(body)) : body,
        email: maskRight(EMAIL),
        pwdLen: PASSWORD.length,
      });

      // surface helpful SR messages
      if (typeof msg === "string" && /too many failed login attempts/i.test(msg)) {
        throw new Error("Shiprocket temporarily locked due to repeated login failures. Try again in ~30 minutes.");
      }
      throw new Error(String(msg));
    }
  }

  /** Public login wrapper: single-flight + cooldown to avoid lockouts. */
  private async login(): Promise<string> {
    const now = Date.now();

    // If we still have a valid token, reuse it
    if (this.token && now < this.tokenExpiry - SRClient.TOKEN_MARGIN_MS) {
      if (DEBUG) log("AUTH reuse token", { untilInMs: this.tokenExpiry - now, token: maskToken(this.token) });
      return this.token;
    }

    // Back off if we just tried and failed recently (only when we don't have a usable token)
    if (!this.inflightLogin && now - this.lastLoginAttempt < SRClient.LOGIN_COOLDOWN_MS && !this.token) {
      const waitMs = SRClient.LOGIN_COOLDOWN_MS - (now - this.lastLoginAttempt);
      throw new Error(`Recent Shiprocket auth attempt; backing off to avoid rate limit. Retry in ~${Math.ceil(waitMs / 1000)}s`);
    }

    // Single-flight
    if (!this.inflightLogin) {
      this.lastLoginAttempt = now;
      this.inflightLogin = this.doLogin().finally(() => (this.inflightLogin = null));
    }

    return this.inflightLogin;
  }

  /** Get a valid token (login if needed). */
  private async getAuthToken(): Promise<string> {
    if (this.token && Date.now() < this.tokenExpiry - SRClient.TOKEN_MARGIN_MS) {
      return this.token;
    }
    return this.login();
  }

  /** Centralized request with a one-time 401/403 retry after re-login, with logging */
  private async request<T = any>(
    method: Method,
    url: string,
    config: Omit<AxiosRequestConfig, "method" | "url"> = {}
  ): Promise<T> {
    await this.getAuthToken();

    const rid = nextRid();
    // attach correlation id
    config.headers = { ...(config.headers || {}), "x-rid": rid };

    try {
      const { data } = await this.http.request<T>({ method, url, ...config });
      if (DEBUG) {
        log("OK", { rid, method, url, status: 200, dataPreview: trimJSON(data, 600) });
      }
      return data;
    } catch (err: any) {
      const status = err?.response?.status;
      const msg = err?.response?.data?.message || err?.message;

      // If auth-related, try one re-login + retry
      if (status === 401 || status === 403) {
        logWarn("Auth stale; retrying after re-login", { rid, status, url });
        await this.login(); // single-flight ensures no stampede
        const { data } = await this.http.request<T>({ method, url, ...config });
        if (DEBUG) log("OK(after relogin)", { rid, method, url, status: 200 });
        return data;
      }

      // Surface SR's lockout message clearly
      if (status === 400 && typeof msg === "string" && /too many failed login attempts/i.test(msg)) {
        throw new Error("Shiprocket temporarily locked due to repeated login failures. Try again in ~30 minutes.");
      }

      // Otherwise bubble up SR message
      throw new Error(String(msg || "Shiprocket API error"));
    }
  }

  /* ================================
     Public API methods
  ================================= */
  serviceability(params: ServiceabilityParams) {
    return this.request("GET", "/v1/external/courier/serviceability/", { params });
  }

  createAdhocOrder(payload: CreateOrderPayload) {
    return this.request("POST", "/v1/external/orders/create/adhoc", { data: payload });
  }

  assignAwb(opts: { shipment_id: number; courier_id?: number }) {
    return this.request("POST", "/v1/external/courier/assign/awb", { data: opts });
  }

  generatePickup(opts: { shipment_id: number[] }) {
    return this.request("POST", "/v1/external/courier/generate/pickup", { data: opts });
  }

  generateManifest(opts: { shipment_id: number[] }) {
    return this.request("POST", "/v1/external/manifests/generate", { data: opts });
  }

  printManifest(opts: { shipment_id: number[] }) {
    return this.request("POST", "/v1/external/manifests/print", { data: opts });
  }

  generateLabel(opts: { shipment_id: number[] }) {
    return this.request("POST", "/v1/external/courier/generate/label", { data: opts });
  }

  printInvoice(opts: { ids: number[] }) {
    return this.request("POST", "/v1/external/orders/print/invoice", { data: opts });
  }

  trackByAwb(awb: string) {
    return this.request("GET", `/v1/external/courier/track/awb/${encodeURIComponent(awb)}`);
  }
}

export const ShiprocketAPI = new SRClient();
