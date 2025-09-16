import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, MessageCircle, Send, Sparkles, Loader2, RefreshCw, Minus, Maximize2, Settings, Square, Filter, SortAsc } from "lucide-react";
import type { Product } from "../../types"; // adjust as needed
import ProductCard from "../UI/ProductCard"; // optional; has graceful fallback below

/**
 * Clara – Nakoda Mobile AI Assistant (client-side widget)
 *
 * Upgrades in this version:
 * 1) CATEGORY-ONLY catalog (as requested) with chips and intent routing
 * 2) Local intent parser: "Show <Category>", price filters (under/between), sort options, keyword search
 * 3) Direct product fetching: GET /api/products?category=&minPrice=&maxPrice=&sort=&q=&limit=
 * 4) Order tracking intent: "Track order NM-2025-000123" → GET /api/orders/status?orderNumber=
 * 5) Dynamic follow‑ups based on response + category-aware suggestions
 * 6) Typing indicator, Stop button, retry/offline guards, focus trap, a11y
 */

type Role = "user" | "assistant" | "system";

type Message = {
  role: Role;
  text: string;
  ts?: number; // client timestamp
};

type ApiResponse = {
  text: string;
  products?: Product[];
  error?: string;
};

// ======== Catalog Categories (authoritative) ========
const CATEGORIES = [
  'Car Chargers',
  'Bluetooth Neckbands',
  'TWS',
  'Data Cables',
  'Mobile Chargers',
  'Bluetooth Speakers',
  'Power Banks',
  'Integrated Circuits & Chips',
  'Mobile Repairing Tools',
  'Electronics',
  'Accessories',
  'Others',
] as const;

// Soft limits so localStorage doesn't bloat
const MAX_HISTORY = 60; // total messages capped
const STORAGE_KEY = "clara_chat_history_v3";
const STORAGE_OPEN = "clara_open";
const STORAGE_MIN = "clara_min";

// API roots (chat + products + orders)
const API_ROOT = ((window as any).VITE_API_BASE?.toString() || "/api").replace(/\/$/, "");
const CHAT_ENDPOINT = `${API_ROOT}/chat`;
const PRODUCTS_ENDPOINT = `${API_ROOT}/products`;
const ORDER_STATUS_ENDPOINT = `${API_ROOT}/orders/status`;

// Simple feature flags (extendable later)
const flags = {
  showHeaderGradient: true,
  showMinimize: true,
  persistOpenState: true,
};

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 5) return "Good night";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
};

const safeParse = <T,>(raw: string | null): T | null => {
  if (!raw) return null;
  try { return JSON.parse(raw) as T; } catch { return null; }
};

const clampHistory = (msgs: Message[]): Message[] => msgs.slice(Math.max(0, msgs.length - MAX_HISTORY));
const clsx = (...v: Array<string | false | null | undefined>) => v.filter(Boolean).join(" ");

// ======== Intent Parsing ========
interface ParsedIntent {
  kind: "products" | "track" | "fallback";
  category?: string;
  q?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: "new" | "popular" | "price_asc" | "price_desc" | "trending";
  orderNumber?: string;
}

const normalize = (s: string) => s.toLowerCase().trim();

const categorySynonyms: Record<string, string> = {
  // common user terms mapped to canonical categories
  "car charger": "Car Chargers",
  "car chargers": "Car Chargers",
  "neckband": "Bluetooth Neckbands",
  "neckbands": "Bluetooth Neckbands",
  "tws": "TWS",
  "earbuds": "TWS",
  "data cable": "Data Cables",
  "data cables": "Data Cables",
  "type-c": "Data Cables",
  "type c": "Data Cables",
  "mobile charger": "Mobile Chargers",
  "mobile chargers": "Mobile Chargers",
  "speaker": "Bluetooth Speakers",
  "speakers": "Bluetooth Speakers",
  "power bank": "Power Banks",
  "power banks": "Power Banks",
  "ic": "Integrated Circuits & Chips",
  "ics": "Integrated Circuits & Chips",
  "chip": "Integrated Circuits & Chips",
  "chips": "Integrated Circuits & Chips",
  "repair tools": "Mobile Repairing Tools",
};

function detectCategory(text: string): string | undefined {
  const t = normalize(text);
  for (const c of CATEGORIES) {
    if (t.includes(c.toLowerCase())) return c;
  }
  for (const key of Object.keys(categorySynonyms)) {
    if (t.includes(key)) return categorySynonyms[key];
  }
  return undefined;
}

function extractPrices(text: string): { minPrice?: number; maxPrice?: number } {
  const t = text.toLowerCase();
  // under/below ₹xxx
  const under = t.match(/(?:under|below|upto|up to)\s*(?:rs\.?|₹)?\s*(\d{2,6})/i);
  if (under) return { maxPrice: Number(under[1]) };
  // between a and b
  const between = t.match(/(?:between|from)\s*(?:rs\.?|₹)?\s*(\d{2,6})\s*(?:to|and|-)\s*(?:rs\.?|₹)?\s*(\d{2,6})/i);
  if (between) {
    const a = Number(between[1]);
    const b = Number(between[2]);
    return { minPrice: Math.min(a, b), maxPrice: Math.max(a, b) };
  }
  return {};
}

function extractSort(text: string): ParsedIntent["sort"] | undefined {
  const t = text.toLowerCase();
  if (/low\s*to\s*high|price\s*asc|cheapest|budget/.test(t)) return "price_asc";
  if (/high\s*to\s*low|price\s*desc|premium/.test(t)) return "price_desc";
  if (/new|latest|newest/.test(t)) return "new";
  if (/popular|bestseller|best\s*sellers/.test(t)) return "popular";
  if (/trend|trending|hot/.test(t)) return "trending";
  return undefined;
}

function extractOrderNumber(text: string): string | undefined {
  // NM-YYYY-XXXXX or plain numeric 6+ digits
  const m = text.match(/\bNM-\d{4}-\d{3,}\b/i) || text.match(/\b\d{6,}\b/);
  return m ? m[0] : undefined;
}

function parseIntent(input: string): ParsedIntent {
  const text = input.trim();
  const t = normalize(text);

  // Track order intent
  if (/\btrack\b|status\b|where\s*is\s*my\s*order/.test(t)) {
    const num = extractOrderNumber(text);
    return { kind: "track", orderNumber: num };
  }

  // Product browsing intent
  const category = detectCategory(text);
  const { minPrice, maxPrice } = extractPrices(text);
  const sort = extractSort(text);

  if (/\bshow\b|\bfind\b|\brecommend\b|\bsuggest\b|\bproducts?\b|\bcharger\b|\bcable\b|\bearbuds?\b|\bneckbands?\b/.test(t) || category || minPrice || maxPrice) {
    // build a light search query from remaining words
    let q = text;
    // strip money and keywords
    q = q.replace(/(under|below|upto|between|from|to|and|rs\.?|₹|price|cost|show|find|recommend|suggest)/gi, " ").replace(/\s+/g, " ").trim();
    return { kind: "products", category, minPrice, maxPrice, sort, q: q || undefined };
  }

  return { kind: "fallback" };
}

// ======== Follow-ups ========
function buildFollowups(respText: string, hasProducts: boolean, ctx?: ParsedIntent): string[] {
  const f: string[] = [];

  if (ctx?.kind === "track") {
    f.push("Show my recent orders");
    f.push("Talk to support about an order");
  }

  if (ctx?.kind === "products") {
    const cat = ctx.category || "Accessories";
    f.push(`Filter ${cat} under ₹500`);
    f.push(`Sort ${cat} low to high`);
    f.push(`Show latest ${cat}`);
  }

  if (hasProducts) {
    f.push("See more like these");
  }

  if (f.length < 3) {
    f.push("Show Bluetooth Neckbands", "Show TWS", "Show Data Cables");
  }

  return Array.from(new Set(f)).slice(0, 5);
}

const ChatBot: React.FC<{ suggestions?: string[] }>= () => {
  // open/minimized state recovered from storage
  const [open, setOpen] = useState<boolean>(() => {
    if (!flags.persistOpenState) return false;
    const raw = localStorage.getItem(STORAGE_OPEN);
    return raw ? raw === "1" : false;
  });
  const [minimized, setMinimized] = useState<boolean>(() => localStorage.getItem(STORAGE_MIN) === "1");

  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = safeParse<Message[]>(localStorage.getItem(STORAGE_KEY));
    return saved && Array.isArray(saved) ? saved : [];
  });

  const [products, setProducts] = useState<Product[] | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [typing, setTyping] = useState(false);
  const [attempt, setAttempt] = useState(0); // for retries
  const [followups, setFollowups] = useState<string[]>([]);

  const [uiSort, setUiSort] = useState<"popular" | "new" | "price_asc" | "price_desc" | "trending">("popular");
  const [uiPriceMax, setUiPriceMax] = useState<number | undefined>(undefined);

  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const ctrlRef = useRef<AbortController | null>(null);

  // Persist chat
  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(clampHistory(messages))); }, [messages]);
  useEffect(() => { if (flags.persistOpenState) localStorage.setItem(STORAGE_OPEN, open ? "1" : "0"); }, [open]);
  useEffect(() => { localStorage.setItem(STORAGE_MIN, minimized ? "1" : "0"); }, [minimized]);

  // Auto-scroll on updates
  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }); }, [messages, products, loading, typing]);

  // Focus when opening
  useEffect(() => { if (!open || minimized) return; const t = setTimeout(() => inputRef.current?.focus(), 200); return () => clearTimeout(t); }, [open, minimized]);

  // First-time greeting
  useEffect(() => {
    if (!open || messages.length > 0) return;
    setMessages([
      { role: "assistant", ts: Date.now(), text: `${getGreeting()}! I\'m Clara. Browse by category or ask for price‑based recommendations.` },
    ]);
    setFollowups(["Show Mobile Chargers", "Show Data Cables", "Track order NM-2025-000123"]);
  }, [open]);

  const canSend = useMemo(() => input.trim().length > 0 && !loading, [input, loading]);

  const pushDL = (event: string, data?: Record<string, any>) => {
    try { (window as any).dataLayer?.push({ event, ...data }); } catch { /* noop */ }
  };

  const closeIfNeeded = () => { ctrlRef.current?.abort(); ctrlRef.current = null; setTyping(false); setLoading(false); };
  const handleOpen = () => { setOpen(true); setMinimized(false); };
  const handleClose = () => { closeIfNeeded(); setOpen(false); };
  const handleMinimize = () => { if (flags.showMinimize) setMinimized((m) => !m); };
  const stopCurrent = () => { ctrlRef.current?.abort(); setTyping(false); setLoading(false); };

  // ======== API helpers ========
  async function fetchProducts(params: { category?: string; q?: string; minPrice?: number; maxPrice?: number; sort?: ParsedIntent["sort"]; limit?: number }) {
    const sp = new URLSearchParams();
    sp.set("status", "active");
    sp.set("limit", String(params.limit ?? 8));
    if (params.category) sp.set("category", params.category);
    if (params.q) sp.set("q", params.q);
    if (params.minPrice != null) sp.set("minPrice", String(params.minPrice));
    if (params.maxPrice != null) sp.set("maxPrice", String(params.maxPrice));
    if (params.sort) sp.set("sort", params.sort);

    const res = await fetch(`${PRODUCTS_ENDPOINT}?${sp.toString()}`, { credentials: "include" });
    if (!res.ok) throw new Error(`Products request failed (${res.status})`);
    const data = await res.json();
    // supports either {products:[]} or direct array
    const items: Product[] = Array.isArray(data) ? data : (data.products || data.items || []);
    return items as Product[];
  }

  async function fetchOrderStatus(orderNumber: string) {
    const sp = new URLSearchParams();
    sp.set("orderNumber", orderNumber);
    const res = await fetch(`${ORDER_STATUS_ENDPOINT}?${sp.toString()}`, { credentials: "include" });
    if (!res.ok) throw new Error(`Order status failed (${res.status})`);
    return res.json();
  }

  // ======== Main sendMessage ========
  const sendMessage = useCallback(async (textOverride?: string) => {
    const payload = (textOverride ?? input).trim();
    if (!payload || loading) return;

    if (typeof navigator !== "undefined" && navigator.onLine === false) { setErrorText("You appear to be offline. Please check your internet connection."); return; }

    setMessages((m) => clampHistory([...m, { role: "user", text: payload, ts: Date.now() }]));
    setInput(""); setErrorText(null); setProducts(null); setLoading(true); setTyping(true); setFollowups([]); setAttempt(0);
    pushDL("clara_message", { role: "user", text: payload });

    ctrlRef.current?.abort(); const controller = new AbortController(); ctrlRef.current = controller;

    // Slash commands
    if (payload.startsWith("/help")) {
      setTyping(false); setLoading(false);
      const helpText = [
        "Commands:",
        "/help — show commands",
        "/contact — support options",
        "Examples:",
        "Show Data Cables under ₹300",
        "Recommend TWS between ₹800 and ₹1500",
        "Track order NM-2025-000123",
      ].join("\n");
      setMessages((m) => clampHistory([...m, { role: "assistant", ts: Date.now(), text: helpText }]));
      setFollowups(["Show Mobile Chargers", "Show Bluetooth Neckbands", "Contact"]);
      return;
    }
    if (payload.startsWith("/contact")) {
      setTyping(false); setLoading(false);
      setMessages((m) => clampHistory([...m, { role: "assistant", ts: Date.now(), text: "You can reach us at support@nakodamobile.in or +91‑XXXXXXXXXX. For returns, go to Profile → Orders → Request Return." }]));
      setFollowups(["Track order", "Return policy", "Talk to agent"]);
      return;
    }

    const intent = parseIntent(payload);

    // --- Intent: Order Tracking ---
    if (intent.kind === "track") {
      try {
        const ord = intent.orderNumber;
        if (!ord) {
          setMessages((m) => clampHistory([...m, { role: "assistant", ts: Date.now(), text: "Please share your order number (e.g., NM-2025-000123) to track the order." }]));
          setFollowups(["Show my recent orders", "Talk to support about an order", "Help"]);
        } else {
          const data = await fetchOrderStatus(ord);
          const statusLine = data?.status ? `Status: ${data.status}` : "Status: (unavailable)";
          const courierLine = data?.courier ? `\nCourier: ${data.courier}` : "";
          const awbLine = data?.awb ? `\nAWB: ${data.awb}` : "";
          setMessages((m) => clampHistory([...m, { role: "assistant", ts: Date.now(), text: `Order ${ord}\n${statusLine}${courierLine}${awbLine}` }]));
          setFollowups(["Notify me on delivery", "Talk to support about an order", "Show Mobile Chargers"]);
        }
      } catch (e: any) {
        setErrorText(e?.message || "Could not fetch order status");
        setMessages((m) => clampHistory([...m, { role: "assistant", ts: Date.now(), text: "Sorry, something went wrong while fetching order status." }]));
      } finally { setTyping(false); setLoading(false); }
      return;
    }

    // --- Intent: Product Discovery ---
    if (intent.kind === "products") {
      try {
        const items = await fetchProducts({
          category: intent.category,
          q: intent.q,
          minPrice: intent.minPrice ?? (uiPriceMax ? undefined : undefined),
          maxPrice: intent.maxPrice ?? uiPriceMax,
          sort: intent.sort ?? uiSort,
          limit: 8,
        });
        setProducts(items);
        const descParts = [
          intent.category ? `${intent.category}` : "Products",
          intent.minPrice || intent.maxPrice ? `priced ${intent.minPrice ? `from ₹${intent.minPrice}` : ""}${intent.minPrice && intent.maxPrice ? " to " : ""}${intent.maxPrice ? `up to ₹${intent.maxPrice}` : ""}` : "",
          intent.sort ? `sorted by ${intent.sort.replace("_", " ")}` : "",
        ].filter(Boolean);
        setMessages((m) => clampHistory([...m, { role: "assistant", ts: Date.now(), text: `${descParts.join(" · ") || "Here are some options"}.` }]));

        const f = buildFollowups("", items.length > 0, intent);
        setFollowups(f);
        setMessages((m) => clampHistory([...m, { role: "assistant", ts: Date.now()+1, text: f.length ? `👉 You can also try: ${f.slice(0,3).join(" · ")}` : "Need anything else?" }]));
      } catch (e: any) {
        setErrorText(e?.message || "Could not load products");
        setMessages((m) => clampHistory([...m, { role: "assistant", ts: Date.now(), text: "Sorry, something went wrong while fetching products." }]));
      } finally { setTyping(false); setLoading(false); }
      return;
    }

    // --- Fallback: call chat endpoint ---
    const attemptFetch = async (): Promise<Response> => fetch(CHAT_ENDPOINT, {
      method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", signal: controller.signal, body: JSON.stringify({ message: payload }),
    });

    const MAX_RETRIES = 1; let lastErr: unknown = null;
    for (let i = 0; i <= MAX_RETRIES; i++) {
      try {
        setAttempt(i);
        const res = await attemptFetch();
        const data: ApiResponse = await res.json().catch(() => ({ error: `Bad JSON (${res.status})` } as ApiResponse));
        if (!res.ok || data.error) throw new Error(data.error || `Request failed (${res.status})`);

        setMessages((m) => clampHistory([...m, { role: "assistant", ts: Date.now(), text: data.text || "…" }]));
        if (data.products?.length) setProducts(data.products);

        const f = buildFollowups(data.text || "", !!data.products?.length, undefined);
        setFollowups(f);
        setMessages((m) => clampHistory([...m, { role: "assistant", ts: Date.now()+1, text: f.length ? `👉 You can also try: ${f.slice(0,3).join(" · ")}` : "Need anything else?" }]));

        setErrorText(null); setTyping(false); setLoading(false);
        pushDL("clara_message", { role: "assistant", text: data.text });
        return;
      } catch (err: any) {
        if (controller.signal.aborted) { lastErr = new Error("Request aborted"); break; }
        lastErr = err; if (i < MAX_RETRIES) await new Promise(r => setTimeout(r, 500));
      }
    }

    const msg = (lastErr as any)?.message || "Failed to reach Clara.";
    setErrorText(msg);
    setMessages((m) => clampHistory([...m, { role: "assistant", ts: Date.now(), text: "Sorry, something went wrong." }]));
    setTyping(false); setLoading(false);
  }, [input, loading, uiSort, uiPriceMax]);

  const onSuggestion = (s: string) => sendMessage(s);

  const clearChat = () => { closeIfNeeded(); setMessages([]); setProducts(null); setErrorText(null); setFollowups([]); localStorage.removeItem(STORAGE_KEY); };

  // Basic focus trap when panel is open (keep Tab within)
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open || minimized) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { handleClose(); return; }
      if (e.key !== "Tab") return;
      const nodes = panelRef.current?.querySelectorAll<HTMLElement>('button, [href], input, textarea, [tabindex]:not([tabindex="-1"])');
      const list = nodes ? Array.from(nodes).filter(n => !n.hasAttribute("disabled")) : [];
      if (list.length === 0) return;
      const first = list[0]; const last = list[list.length - 1];
      if (e.shiftKey) { if (document.activeElement === first) { (last as HTMLElement).focus(); e.preventDefault(); } }
      else { if (document.activeElement === last) { (first as HTMLElement).focus(); e.preventDefault(); } }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, minimized]);

  // Graceful ProductCard fallback
  const ProductGrid: React.FC<{ items: Product[] }> = ({ items }) => (
    <div className="grid gap-3">
      {items.map((p, idx) => {
        const key = (p as any)._id || (p as any).id || idx;
        try {
          return <ProductCard key={key} product={p as any} viewMode="grid" />;
        } catch {
          return (
            <div key={key} className="border rounded-xl bg-white p-3 text-sm">
              <div className="font-medium">{(p as any).name || "Product"}</div>
              <div className="text-gray-600">₹{(p as any).price ?? "—"}</div>
            </div>
          );
        }
      })}
    </div>
  );

  // ======== UI ========
  return (
    <>
      {/* Launcher Button */}
      <motion.button
        whileTap={{ scale: 0.96 }}
        onClick={handleOpen}
        className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full px-4 py-3 bg-blue-600 text-white shadow-lg hover:bg-blue-700 focus:outline-none"
        style={{ display: open ? "none" : "flex" }}
        aria-label="Open Clara chat"
      >
        <MessageCircle className="h-5 w-5" />
        <span className="hidden sm:block">Meet Artha</span>
      </motion.button>

      {/* Chat Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 280, damping: 24 }}
            className={clsx(
              "fixed bottom-5 right-5 z-50 w-[92vw] max-w-[460px] rounded-2xl border border-gray-200 bg-white shadow-2xl flex flex-col overflow-hidden",
              minimized && "h-[64px]"
            )}
            role="dialog"
            aria-label="Clara assistant"
            aria-modal="true"
          >
            {/* Header */}
            <div className={clsx(
              "flex items-center justify-between p-3 border-b text-white",
              flags.showHeaderGradient ? "bg-gradient-to-r from-blue-600 to-indigo-600" : "bg-blue-600"
            )}>
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                <div className="font-semibold">Clara • Smart Shopping Assistant</div>
              </div>
              <div className="flex items-center gap-1">
                {loading ? (
                  <button onClick={stopCurrent} className="p-1 rounded-full hover:bg-white/10" aria-label="Stop response" title="Stop">
                    <Square className="h-5 w-5" />
                  </button>
                ) : null}
                <button onClick={handleMinimize} className="p-1 rounded-full hover:bg-white/10" aria-label={minimized ? "Expand" : "Minimize"}>
                  {minimized ? <Maximize2 className="h-5 w-5" /> : <Minus className="h-5 w-5" />}
                </button>
                <button onClick={() => { clearChat(); setTimeout(() => inputRef.current?.focus(), 50); }} className="p-1 rounded-full hover:bg-white/10" aria-label="Reset conversation" title="Reset">
                  <RefreshCw className="h-5 w-5" />
                </button>
                <button onClick={handleClose} className="p-1 rounded-full hover:bg-white/10" aria-label="Close chat">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Collapsed body */}
            {minimized ? (
              <div className="px-3 py-2 text-xs text-gray-700 bg-white">
                {messages.length ? (
                  <span>{messages[messages.length - 1]?.text?.slice(0, 80) || "Ask Clara anything."}…</span>
                ) : (
                  <span>{getGreeting()}! Ask Clara for the right accessories.</span>
                )}
              </div>
            ) : (
              <>
                {/* Messages */}
                <div ref={listRef} className="p-3 space-y-2 overflow-y-auto max-h-[64vh] bg-gray-50" role="log" aria-live="polite">
                  {/* Empty state: show categories */}
                  {messages.length === 0 && (
                    <div className="text-sm text-gray-700">
                      <div className="mb-3">{getGreeting()}! I’m <b>Clara</b>. Browse by category or ask by price/specs.</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {Array.from(CATEGORIES).map((c) => (
                          <button key={c} onClick={() => onSuggestion(`Show ${c}`)} className="text-left border border-gray-200 bg-white hover:bg-gray-100 rounded-xl px-3 py-2">
                            {c}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {messages.map((m, i) => (
                    <div key={i} className={clsx("flex", m.role === "user" ? "justify-end" : "justify-start")}> 
                      <div className={clsx("max-w-[85%] px-3 py-2 rounded-2xl shadow-sm",
                        m.role === "user" ? "bg-blue-600 text-white rounded-br-none" : m.role === "assistant" ? "bg-white text-gray-900 border border-gray-200 rounded-bl-none" : "bg-gray-100 text-gray-800")}
                      >
                        <pre className="whitespace-pre-wrap font-sans text-[13px] leading-5">{m.text}</pre>
                      </div>
                    </div>
                  ))}

                  {(typing || loading) && (
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Loader2 className="h-4 w-4 animate-spin" /> Clara is thinking…
                    </div>
                  )}

                  {errorText && (
                    <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-start gap-2">
                      <span className="mt-[2px]">⚠️</span>
                      <div>
                        <div className="font-medium">Issue:</div>
                        <div className="mt-0.5">{errorText}</div>
                        <div className="mt-2 flex gap-2">
                          <button className="text-xs px-2 py-1 rounded-md bg-red-600 text-white hover:bg-red-700" onClick={() => sendMessage(messages[messages.length - 1]?.role === "user" ? messages[messages.length - 1].text : undefined)}>Retry</button>
                          <button className="text-xs px-2 py-1 rounded-md border border-gray-300 hover:bg-gray-100" onClick={() => setErrorText(null)}>Dismiss</button>
                        </div>
                      </div>
                    </div>
                  )}

                  {products?.length ? (
                    <div className="mt-2">
                      <div className="text-xs text-gray-500 mb-2">Recommended products ({products.length})</div>
                      <ProductGrid items={products} />
                    </div>
                  ) : null}
                </div>

                {/* Controls + Input */}
                <div className="border-t bg-white p-2">
                  {/* quick controls */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <Filter className="h-4 w-4" />
                      <input
                        type="number"
                        min={0}
                        placeholder="Max ₹"
                        value={uiPriceMax ?? ""}
                        onChange={(e) => setUiPriceMax(e.target.value ? Number(e.target.value) : undefined)}
                        className="w-24 rounded-lg border border-gray-300 px-2 py-1 text-xs focus:ring-2 focus:ring-blue-500"
                        aria-label="Max price"
                      />
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <SortAsc className="h-4 w-4" />
                      <select
                        value={uiSort}
                        onChange={(e) => setUiSort(e.target.value as any)}
                        className="rounded-lg border border-gray-300 px-2 py-1 text-xs focus:ring-2 focus:ring-blue-500"
                        aria-label="Sort"
                      >
                        <option value="popular">Popular</option>
                        <option value="new">New</option>
                        <option value="trending">Trending</option>
                        <option value="price_asc">Price: Low → High</option>
                        <option value="price_desc">Price: High → Low</option>
                      </select>
                    </div>
                  </div>

                  {/* input row */}
                  <div className="flex items-center gap-2">
                    <input
                      ref={inputRef}
                      id="chatbot-input"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && canSend && sendMessage()}
                      placeholder="e.g. Show Data Cables under ₹300"
                      className="flex-1 rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                      aria-label="Type your question"
                    />
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      onClick={() => sendMessage()}
                      disabled={!canSend}
                      className={clsx("inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-semibold text-white", canSend ? "bg-blue-600 hover:bg-blue-700" : "bg-blue-300 cursor-not-allowed")}
                      aria-label="Send message"
                    >
                      <Send className="h-4 w-4" />
                      Send
                    </motion.button>
                  </div>

                  {/* Dynamic chips */}
                  <div className="flex flex-wrap gap-2 mt-2">
                    {(followups.length ? followups : Array.from(CATEGORIES).slice(0,6).map(c => `Show ${c}`)).map((s) => (
                      <button key={s} onClick={() => onSuggestion(s)} className="text-xs px-2 py-1 rounded-full border border-gray-200 hover:bg-gray-100" aria-label={`Use suggestion: ${s}`}>
                        {s}
                      </button>
                    ))}
                    <button onClick={() => onSuggestion("/help")} className="text-xs px-2 py-1 rounded-full border border-gray-200 hover:bg-gray-100 flex items-center gap-1" aria-label="Help commands">
                      <Settings className="h-3.5 w-3.5" /> Help
                    </button>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default ChatBot;