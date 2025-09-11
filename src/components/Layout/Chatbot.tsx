import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, MessageCircle, Send, Sparkles, Loader2, RefreshCw, Minus, Maximize2, Settings } from "lucide-react";
import type { Product } from "../../types"; // adjust as needed
import ProductCard from "../UI/ProductCard"; // optional; has graceful fallback below

/**
 * Clara – Nakoda Mobile AI Assistant (client-side widget)
 *
 * What's new vs your original:
 * 1) Brand personality (Clara) + time-aware greeting
 * 2) Minimize mode + sticky open state across reloads
 * 3) Robust networking: AbortController, retries, offline guard
 * 4) Better accessibility: aria-live log, keyboard focus trap, labels
 * 5) Tiny UX niceties: typing indicator, quick commands, error retry, reset
 * 6) Message persistence with size cap and safe JSON parse
 * 7) Optional analytics hooks (dataLayer) without breaking if absent
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

// Quick prompts tailor-made for your catalog
const DEFAULT_SUGGESTIONS = [
  "3A fast charger under ₹200",
  "Best TWS earbuds under ₹1500",
  "Type‑C braided cable 1.5m",
  "20W iPhone charger",
  "Noise‑cancelling neckband",
];

// Soft limits so localStorage doesn't bloat
const MAX_HISTORY = 60; // total messages capped
const STORAGE_KEY = "clara_chat_history_v2";
const STORAGE_OPEN = "clara_open";
const STORAGE_MIN = "clara_min";

// Prefer explicit API_BASE if you set it on window; fallback to relative
const API_BASE = (window as any).VITE_API_BASE?.toString() || ""; // e.g. "https://nakodamobile.in/api"
const CHAT_ENDPOINT = API_BASE ? `${API_BASE.replace(/\/$/, "")}/chat` : "/api/chat";

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

const clampHistory = (msgs: Message[]): Message[] =>
  msgs.slice(Math.max(0, msgs.length - MAX_HISTORY));

const clsx = (...v: Array<string | false | null | undefined>) => v.filter(Boolean).join(" ");

const ChatBot: React.FC<{ suggestions?: string[] }>= ({ suggestions }) => {
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

  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const ctrlRef = useRef<AbortController | null>(null);

  const SUGGESTIONS = suggestions && suggestions.length ? suggestions : DEFAULT_SUGGESTIONS;

  // Persist chat
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clampHistory(messages)));
  }, [messages]);

  // Persist open/minimized
  useEffect(() => { if (flags.persistOpenState) localStorage.setItem(STORAGE_OPEN, open ? "1" : "0"); }, [open]);
  useEffect(() => { localStorage.setItem(STORAGE_MIN, minimized ? "1" : "0"); }, [minimized]);

  // Auto-scroll on updates
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, products, loading, typing]);

  // Focus management when opening
  useEffect(() => {
    if (!open || minimized) return;
    const t = setTimeout(() => inputRef.current?.focus(), 200);
    return () => clearTimeout(t);
  }, [open, minimized]);

  // Add first-time greeting (idempotent)
  useEffect(() => {
    if (!open || messages.length > 0) return;
    setMessages([
      { role: "assistant", ts: Date.now(), text: `${getGreeting()}! I\'m Clara. Ask me for the right mobile accessories—by brand, price or specs.` },
      { role: "assistant", ts: Date.now()+1, text: "Try: ‘3A fast charger under ₹200’ or ‘Type‑C super soft cable 1.5m’." },
    ]);
  }, [open]);

  const canSend = useMemo(() => input.trim().length > 0 && !loading, [input, loading]);

  const pushDL = (event: string, data?: Record<string, any>) => {
    try { (window as any).dataLayer?.push({ event, ...data }); } catch { /* noop */ }
  };

  const closeIfNeeded = () => {
    // Cancel any in-flight request when closing or minimizing
    ctrlRef.current?.abort();
    ctrlRef.current = null;
    setTyping(false);
    setLoading(false);
  };

  const handleOpen = () => { setOpen(true); setMinimized(false); };
  const handleClose = () => { closeIfNeeded(); setOpen(false); };

  const handleMinimize = () => {
    if (!flags.showMinimize) return;
    setMinimized((m) => !m);
  };

  const sendMessage = useCallback(async (textOverride?: string) => {
    const payload = (textOverride ?? input).trim();
    if (!payload || loading) return;

    // Offline guard
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setErrorText("You appear to be offline. Please check your internet connection.");
      return;
    }

    // Append user message immediately
    setMessages((m) => clampHistory([...m, { role: "user", text: payload, ts: Date.now() }]));
    setInput("");
    setErrorText(null);
    setProducts(null);
    setLoading(true);
    setTyping(true);
    setAttempt(0);

    pushDL("clara_message", { role: "user", text: payload });

    // Prepare controller for cancellation
    ctrlRef.current?.abort();
    const controller = new AbortController();
    ctrlRef.current = controller;

    // simple slash-commands (client-only helpers)
    if (payload.startsWith("/help")) {
      setTyping(false);
      setLoading(false);
      setMessages((m) => clampHistory([...m, {
        role: "assistant",
        ts: Date.now(),
        text: "Commands available:\n/help — show commands\n/track <orderNo> — order status\n/contact — support options\nTry asking for products by budget, brand or feature.",
      }]));
      return;
    }
    if (payload.startsWith("/contact")) {
      setTyping(false);
      setLoading(false);
      setMessages((m) => clampHistory([...m, {
        role: "assistant",
        ts: Date.now(),
        text: "You can reach us at support@nakodamobile.in or +91‑XXXXXXXXXX. For returns, go to Profile → Orders → Request Return.",
      }]));
      return;
    }

    // Retry wrapper
    const attemptFetch = async (): Promise<Response> => {
      return fetch(CHAT_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // ok if you set cookies; harmless otherwise
        signal: controller.signal,
        body: JSON.stringify({ message: payload }),
      });
    };

    const MAX_RETRIES = 1; // one quick retry on transient failures
    let lastErr: unknown = null;

    for (let i = 0; i <= MAX_RETRIES; i++) {
      try {
        setAttempt(i);
        const res = await attemptFetch();
        const data: ApiResponse = await res.json().catch(() => ({ error: `Bad JSON (${res.status})` } as ApiResponse));

        if (!res.ok || data.error) throw new Error(data.error || `Request failed (${res.status})`);

        setMessages((m) => clampHistory([...m, { role: "assistant", ts: Date.now(), text: data.text || "…" }]));
        if (data.products?.length) setProducts(data.products);
        setErrorText(null);
        pushDL("clara_message", { role: "assistant", text: data.text });
        return; // success
      } catch (err: any) {
        if (controller.signal.aborted) {
          lastErr = new Error("Request aborted");
          break;
        }
        lastErr = err;
        // quick backoff before retry
        if (i < MAX_RETRIES) await new Promise(r => setTimeout(r, 500));
      }
    }

    // If here, failed after retries
    const msg = (lastErr as any)?.message || "Failed to reach Clara.";
    setErrorText(msg);
    setMessages((m) => clampHistory([...m, { role: "assistant", ts: Date.now(), text: "Sorry, something went wrong." }]));
    setTyping(false);
    setLoading(false);
  }, [input, loading]);

  const onSuggestion = (s: string) => sendMessage(s);

  const clearChat = () => {
    closeIfNeeded();
    setMessages([]);
    setProducts(null);
    setErrorText(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  // Basic focus trap when panel is open (keep Tab within)
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open || minimized) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const nodes = panelRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const list = nodes ? Array.from(nodes).filter(n => !n.hasAttribute("disabled")) : [];
      if (list.length === 0) return;
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { (last as HTMLElement).focus(); e.preventDefault(); }
      } else {
        if (document.activeElement === last) { (first as HTMLElement).focus(); e.preventDefault(); }
      }
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
          // fallback minimal card
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
        <span className="hidden sm:block">Meet Clara</span>
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
              "fixed bottom-5 right-5 z-50 w-[92vw] max-w-[440px] rounded-2xl border border-gray-200 bg-white shadow-2xl flex flex-col overflow-hidden",
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
                <button
                  onClick={handleMinimize}
                  className="p-1 rounded-full hover:bg-white/10"
                  aria-label={minimized ? "Expand" : "Minimize"}
                >
                  {minimized ? <Maximize2 className="h-5 w-5" /> : <Minus className="h-5 w-5" />}
                </button>
                <button
                  onClick={() => { clearChat(); setTimeout(() => inputRef.current?.focus(), 50); }}
                  className="p-1 rounded-full hover:bg-white/10"
                  aria-label="Reset conversation"
                  title="Reset"
                >
                  <RefreshCw className="h-5 w-5" />
                </button>
                <button
                  onClick={handleClose}
                  className="p-1 rounded-full hover:bg-white/10"
                  aria-label="Close chat"
                >
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
                <div
                  ref={listRef}
                  className="p-3 space-y-2 overflow-y-auto max-h-[68vh] bg-gray-50"
                  role="log"
                  aria-live="polite"
                >
                  {/* Empty state */}
                  {messages.length === 0 && (
                    <div className="text-sm text-gray-700">
                      <div className="mb-3">{getGreeting()}! I’m <b>Clara</b>. I can help you compare chargers, cables, TWS, neckbands and more.</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {SUGGESTIONS.map((s) => (
                          <button
                            key={s}
                            onClick={() => onSuggestion(s)}
                            className="text-left border border-gray-200 bg-white hover:bg-gray-100 rounded-xl px-3 py-2"
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {messages.map((m, i) => (
                    <div key={i} className={clsx("flex", m.role === "user" ? "justify-end" : "justify-start")}> 
                      <div
                        className={clsx(
                          "max-w-[85%] px-3 py-2 rounded-2xl shadow-sm",
                          m.role === "user"
                            ? "bg-blue-600 text-white rounded-br-none"
                            : m.role === "assistant"
                              ? "bg-white text-gray-900 border border-gray-200 rounded-bl-none"
                              : "bg-gray-100 text-gray-800"
                        )}
                      >
                        <pre className="whitespace-pre-wrap font-sans text-[13px] leading-5">{m.text}</pre>
                      </div>
                    </div>
                  ))}

                  {/* Typing indicator */}
                  {(typing || loading) && (
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Loader2 className="h-4 w-4 animate-spin" /> Clara is thinking…
                    </div>
                  )}

                  {/* Error */}
                  {errorText && (
                    <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-start gap-2">
                      <span className="mt-[2px]">⚠️</span>
                      <div>
                        <div className="font-medium">Issue:</div>
                        <div className="mt-0.5">{errorText}</div>
                        <div className="mt-2 flex gap-2">
                          <button
                            className="text-xs px-2 py-1 rounded-md bg-red-600 text-white hover:bg-red-700"
                            onClick={() => sendMessage(messages[messages.length - 1]?.role === "user" ? messages[messages.length - 1].text : undefined)}
                          >Retry</button>
                          <button
                            className="text-xs px-2 py-1 rounded-md border border-gray-300 hover:bg-gray-100"
                            onClick={() => setErrorText(null)}
                          >Dismiss</button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Product results */}
                  {products?.length ? (
                    <div className="mt-2">
                      <div className="text-xs text-gray-500 mb-2">Recommended products ({products.length})</div>
                      <ProductGrid items={products} />
                    </div>
                  ) : null}
                </div>

                {/* Input */}
                <div className="border-t bg-white p-2">
                  <div className="flex items-center gap-2">
                    <input
                      ref={inputRef}
                      id="chatbot-input"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && canSend && sendMessage()}
                      placeholder="e.g. 3A charger under ₹200"
                      className="flex-1 rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                      aria-label="Type your question"
                    />
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      onClick={() => sendMessage()}
                      disabled={!canSend}
                      className={clsx(
                        "inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-semibold text-white",
                        canSend ? "bg-blue-600 hover:bg-blue-700" : "bg-blue-300 cursor-not-allowed"
                      )}
                      aria-label="Send message"
                    >
                      <Send className="h-4 w-4" />
                      Send
                    </motion.button>
                  </div>

                  {/* Quick chips */}
                  <div className="flex flex-wrap gap-2 mt-2">
                    {SUGGESTIONS.slice(0, 3).map((s) => (
                      <button
                        key={s}
                        onClick={() => onSuggestion(s)}
                        className="text-xs px-2 py-1 rounded-full border border-gray-200 hover:bg-gray-100"
                        aria-label={`Use suggestion: ${s}`}
                      >
                        {s}
                      </button>
                    ))}
                    <button
                      onClick={() => onSuggestion("/help")}
                      className="text-xs px-2 py-1 rounded-full border border-gray-200 hover:bg-gray-100 flex items-center gap-1"
                      aria-label="Help commands"
                    >
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
