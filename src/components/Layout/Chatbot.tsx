// src/components/ChatBot.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, MessageCircle, Send, Sparkles, Loader2 } from "lucide-react";
import type { Product } from "../../types"; // or "../../types"
import ProductCard from "../UI/ProductCard";      // if your file is elsewhere, adjust path

type Message = { role: "user" | "assistant"; text: string };
type ApiResponse = { text: string; products?: Product[]; error?: string };

const SUGGESTIONS = [
  "3A fast charger under ₹200",
  "Best TWS earbuds under ₹1500",
  "Type-C cable 1.5m braided",
  "20W charger for iPhone",
];

const ChatBot: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>(() => {
    // persist history across reloads
    try {
      const raw = localStorage.getItem("chat_history");
      return raw ? (JSON.parse(raw) as Message[]) : [];
    } catch {
      return [];
    }
  });
  const [products, setProducts] = useState<Product[] | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem("chat_history", JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    if (open) {
      // subtle autofocus when opening
      const t = setTimeout(() => {
        const el = document.getElementById("chatbot-input") as HTMLInputElement | null;
        el?.focus();
      }, 200);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    // autoscroll
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, products, loading]);

  const canSend = useMemo(() => input.trim().length > 0 && !loading, [input, loading]);

  async function sendMessage(textOverride?: string) {
    const payload = (textOverride ?? input).trim();
    if (!payload) return;
    setInput("");
    setErrorText(null);
    setProducts(null);
    setMessages((m) => [...m, { role: "user", text: payload }]);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: payload }),
      });
      const data: ApiResponse = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || `Request failed (${res.status})`);
      }

      setMessages((m) => [...m, { role: "assistant", text: data.text || "…" }]);
      if (data.products?.length) setProducts(data.products);
    } catch (err: any) {
      setErrorText(err?.message || "Failed to reach the assistant.");
      setMessages((m) => [...m, { role: "assistant", text: "Sorry, something went wrong." }]);
    } finally {
      setLoading(false);
    }
  }

  function clearChat() {
    setMessages([]);
    setProducts(null);
    setErrorText(null);
    localStorage.removeItem("chat_history");
  }

  return (
    <>
      {/* Launcher Button */}
      <motion.button
        whileTap={{ scale: 0.96 }}
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full px-4 py-3 bg-blue-600 text-white shadow-lg hover:bg-blue-700 focus:outline-none"
        style={{ display: open ? "none" : "flex" }}
        aria-label="Open chat"
      >
        <MessageCircle className="h-5 w-5" />
        <span className="hidden sm:block">Chat</span>
      </motion.button>

      {/* Chat Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 280, damping: 24 }}
            className="fixed bottom-5 right-5 z-50 w-[92vw] max-w-[420px] rounded-2xl border border-gray-200 bg-white shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                <div className="font-semibold">Ask about products</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={clearChat}
                  className="text-white/80 hover:text-white text-xs underline"
                  title="Clear conversation"
                >
                  reset
                </button>
                <button
                  onClick={() => setOpen(false)}
                  className="p-1 rounded-full hover:bg-white/10"
                  aria-label="Close chat"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div ref={listRef} className="p-3 space-y-2 overflow-y-auto max-h-[68vh] bg-gray-50">
              {/* Empty state */}
              {messages.length === 0 && (
                <div className="text-sm text-gray-600">
                  <div className="mb-3">Hi! I can help you find the right products.</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        onClick={() => sendMessage(s)}
                        className="text-left border border-gray-200 bg-white hover:bg-gray-100 rounded-xl px-3 py-2"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] px-3 py-2 rounded-2xl shadow-sm ${
                      m.role === "user"
                        ? "bg-blue-600 text-white rounded-br-none"
                        : "bg-white text-gray-900 border border-gray-200 rounded-bl-none"
                    }`}
                  >
                    <pre className="whitespace-pre-wrap font-sans">{m.text}</pre>
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" /> Thinking…
                </div>
              )}

              {errorText && (
                <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {errorText}
                </div>
              )}

              {/* Product results */}
              {products?.length ? (
                <div className="mt-2">
                  <div className="text-xs text-gray-500 mb-2">
                    Recommended products ({products.length})
                  </div>
                  <div className="grid gap-3">
                    {products.map((p) => (
                      <ProductCard key={(p as any)._id || (p as any).id} product={p as any} viewMode="grid" />
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            {/* Input */}
            <div className="border-t bg-white p-2">
              <div className="flex items-center gap-2">
                <input
                  id="chatbot-input"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && canSend && sendMessage()}
                  placeholder="e.g. 3A charger under ₹200"
                  className="flex-1 rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => sendMessage()}
                  disabled={!canSend}
                  className={`inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-semibold text-white ${
                    canSend ? "bg-blue-600 hover:bg-blue-700" : "bg-blue-300 cursor-not-allowed"
                  }`}
                >
                  <Send className="h-4 w-4" />
                  Send
                </motion.button>
              </div>
              {/* Quick suggestion chips */}
              <div className="flex flex-wrap gap-2 mt-2">
                {SUGGESTIONS.slice(0, 3).map((s) => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    className="text-xs px-2 py-1 rounded-full border border-gray-200 hover:bg-gray-100"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default ChatBot;
