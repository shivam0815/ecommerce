// src/pages/account/HelpSupport.tsx
import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  getSupportConfig,
  getSupportFaqs,
  createSupportTicket,
  getMySupportTickets,
  type SupportConfig,
  type SupportFaq,
  type TicketPriority,
} from '../../config/api';

type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
type SupportTicket = {
  _id: string;
  subject: string;
  message: string;
  email: string;
  phone?: string;
  orderId?: string;
  category?: string;
  priority: TicketPriority;
  status: TicketStatus;
  createdAt: string;
  updatedAt?: string;
};

const inputBase =
  'mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder-gray-400 shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40 disabled:opacity-60';
const sectionCard = 'bg-white border border-gray-200 rounded-xl p-5';

const HelpSupport: React.FC = () => {
  // Auth
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(!!localStorage.getItem('nakoda-token'));
  useEffect(() => {
    const onStorage = () => setIsLoggedIn(!!localStorage.getItem('nakoda-token'));
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Config + FAQs
  const [cfg, setCfg] = useState<SupportConfig | null>(null);
  const [faqs, setFaqs] = useState<SupportFaq[]>([]);
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [loadingCfg, setLoadingCfg] = useState(true);
  const [loadingFaqs, setLoadingFaqs] = useState(true);

  // My tickets
  const [myTickets, setMyTickets] = useState<SupportTicket[]>([]);
  const [loadingMy, setLoadingMy] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string>('');

  // Form state
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState(''); // Only required if not logged in
  const [phone, setPhone] = useState('');
  const [orderId, setOrderId] = useState('');
  const [ticketCategory, setTicketCategory] = useState('');
  const [priority, setPriority] = useState<TicketPriority>('normal');
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Load config
  useEffect(() => {
    (async () => {
      try {
        setLoadingCfg(true);
        const res = await getSupportConfig();
        if (res?.success) setCfg(res.config);
        else toast.error('Failed to load support configuration');
      } catch (e: any) {
        toast.error(e?.message || 'Failed to load support configuration');
      } finally {
        setLoadingCfg(false);
      }
    })();
  }, []);

  // Load FAQs
  useEffect(() => {
    (async () => {
      try {
        setLoadingFaqs(true);
        const res = await getSupportFaqs({ q: q || undefined, category: category || undefined });
        if (res?.success) setFaqs(res.faqs);
        else toast.error('Failed to load FAQs');
      } catch (e: any) {
        toast.error(e?.message || 'Failed to load FAQs');
      } finally {
        setLoadingFaqs(false);
      }
    })();
  }, [q, category]);

  // Load my tickets
  const loadMyTickets = async () => {
    if (!isLoggedIn) return;
    try {
      setLoadingMy(true);
      const res = await getMySupportTickets();
      if (res?.success) {
        // sort by updatedAt desc, fallback to createdAt
        const sorted = [...(res.tickets || [])].sort((a, b) => {
          const ad = new Date(a.updatedAt || a.createdAt).getTime();
          const bd = new Date(b.updatedAt || b.createdAt).getTime();
          return bd - ad;
        });
        setMyTickets(sorted);
        setLastRefreshedAt(new Date().toLocaleTimeString());
      }
    } catch {
      // ignore (unauth/network)
    } finally {
      setLoadingMy(false);
    }
  };

  useEffect(() => { loadMyTickets(); }, [isLoggedIn]);

  // Poll every 15s so admin status updates show up
  useEffect(() => {
    if (!isLoggedIn) return;
    const id = setInterval(loadMyTickets, 15000);
    return () => clearInterval(id);
  }, [isLoggedIn]);

  // Derived
  const categories = useMemo(() => {
    const s = new Set<string>();
    faqs.forEach((f) => f.category && s.add(f.category));
    return Array.from(s).sort();
  }, [faqs]);

  // Handlers
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    setFiles(Array.from(e.target.files).slice(0, 3));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Only require email if not logged in
    const emailOk = isLoggedIn || /\S+@\S+\.\S+/.test(email);
    if (!subject.trim() || !message.trim() || !emailOk) {
      return toast.error(isLoggedIn
        ? 'Please fill subject and message'
        : 'Please fill subject, message, and a valid email');
    }

    try {
      setSubmitting(true);
      const res = await createSupportTicket({
        subject: subject.trim(),
        message: message.trim(),
        email: email.trim(), // backend falls back to authed email if empty + logged in
        phone: phone.trim() || undefined,
        orderId: orderId.trim() || undefined,
        category: ticketCategory || undefined,
        priority,
        attachments: files,
      });
      if (res?.success) {
        toast.success('Ticket created successfully');
        // Reset form
        setSubject('');
        setMessage('');
        setEmail('');
        setPhone('');
        setOrderId('');
        setTicketCategory('');
        setPriority('normal');
        setFiles([]);
        // Refresh my tickets
        loadMyTickets();
      } else {
        toast.error('Could not create ticket');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err?.message || 'Failed to create ticket');
    } finally {
      setSubmitting(false);
    }
  };

  const statusBadge = (s: TicketStatus) => {
    const map: Record<TicketStatus, string> = {
      open: 'bg-amber-100 text-amber-700',
      in_progress: 'bg-indigo-100 text-indigo-700',
      resolved: 'bg-emerald-100 text-emerald-700',
      closed: 'bg-gray-200 text-gray-700',
    };
    return map[s] || 'bg-gray-100 text-gray-700';
  };
  const fmt = (d?: string) => (d ? new Date(d).toLocaleString() : '—');

  return (
    <div className="mx-auto max-w-6xl p-6 space-y-6 bg-white min-h-screen">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-gray-900">
          Help & Support
        </h2>
      </div>

      {/* Contact channels */}
      <section className={sectionCard}>
        <h3 className="text-lg sm:text-xl font-semibold text-gray-900">Contact Options</h3>
        {loadingCfg ? (
          <div className="mt-4 text-sm text-gray-500" aria-busy>Loading…</div>
        ) : cfg ? (
          <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {cfg.channels?.email && cfg.email && (
              <li className="rounded-lg border border-gray-200 p-4">
                <div className="text-sm sm:text-base text-gray-800">
                  <strong>Email</strong>:{' '}
                  <a className="text-indigo-600 hover:underline" href={`mailto:${cfg.email.address}`}>
                    {cfg.email.address}
                  </a>
                </div>
                {typeof cfg.email.responseTimeHours !== 'undefined' && (
                  <div className="text-xs text-gray-500 mt-1">
                    Avg. response ≈ {cfg.email.responseTimeHours}h
                  </div>
                )}
              </li>
            )}
            {cfg.channels?.phone && cfg.phone && (
              <li className="rounded-lg border border-gray-200 p-4">
                <div className="text-sm sm:text-base text-gray-800">
                  <strong>Phone</strong>: {cfg.phone.number}
                </div>
                {cfg.phone.hours && (
                  <div className="text-xs text-gray-500 mt-1">{cfg.phone.hours}</div>
                )}
              </li>
            )}
            {cfg.channels?.whatsapp && cfg.whatsapp && (
              <li className="rounded-lg border border-gray-200 p-4">
                <div className="text-sm sm:text-base text-gray-800">
                  <strong>WhatsApp</strong>:{' '}
                  <a className="text-indigo-600 hover:underline" href={cfg.whatsapp.link} target="_blank" rel="noreferrer">
                    {cfg.whatsapp.number}
                  </a>
                </div>
              </li>
            )}
            {cfg.channels?.chat && (
              <li className="rounded-lg border border-gray-200 p-4">
                <div className="text-sm sm:text-base text-gray-800"><strong>Live Chat</strong>: Available</div>
              </li>
            )}
            {cfg.faq?.enabled && cfg.faq?.url && (
              <li className="rounded-lg border border-gray-200 p-4 sm:col-span-2">
                <div className="text-sm sm:text-base text-gray-800">
                  <strong>FAQ</strong>:{' '}
                  <a className="text-indigo-600 hover:underline break-all" href={cfg.faq.url} target="_blank" rel="noreferrer">
                    {cfg.faq.url}
                  </a>
                </div>
              </li>
            )}
          </ul>
        ) : (
          <div className="mt-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
            Could not load support config.
          </div>
        )}
      </section>

      {/* FAQs */}
      <section className={sectionCard}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <h3 className="text-lg sm:text-xl font-semibold text-gray-900">FAQs</h3>
          <div className="flex w-full sm:w-auto flex-col sm:flex-row gap-2">
            <input
              className={inputBase}
              placeholder="Search FAQs…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <select className={inputBase} value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">All categories</option>
              {categories.map((c) => (<option key={c} value={c}>{c}</option>))}
            </select>
          </div>
        </div>

        {loadingFaqs ? (
          <div className="mt-4 text-sm text-gray-500" aria-busy>Loading FAQs…</div>
        ) : faqs.length === 0 ? (
          <div className="mt-4 text-sm text-gray-500">No FAQs found</div>
        ) : (
          <div className="mt-4 divide-y divide-gray-200 rounded-xl border border-gray-200 overflow-hidden bg-white">
            {faqs.map((f) => (
              <details key={f._id} className="group">
                <summary className="list-none cursor-pointer select-none px-4 sm:px-5 py-3 sm:py-4 flex items-center justify-between gap-3 hover:bg-gray-50">
                  <span className="text-sm sm:text-base font-medium text-gray-900">{f.question}</span>
                  <svg className="h-4 w-4 text-gray-500 transition-transform group-open:rotate-180" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 011.08 1.04l-4.25 4.25a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" clipRule="evenodd"/>
                  </svg>
                </summary>
                <div className="px-4 sm:px-5 pb-4 text-sm text-gray-700">
                  <div>{f.answer}</div>
                  {f.category && (
                    <div className="mt-2 inline-flex items-center rounded-full bg-indigo-50 text-indigo-700 px-2.5 py-0.5 text-xs font-medium">
                      {f.category}
                    </div>
                  )}
                </div>
              </details>
            ))}
          </div>
        )}
      </section>

      {/* My Tickets */}
      <section className={sectionCard}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg sm:text-xl font-semibold text-gray-900">My Tickets</h3>
          <div className="flex items-center gap-3">
            {lastRefreshedAt && (
              <span className="text-xs text-gray-500">Last updated {lastRefreshedAt}</span>
            )}
            {isLoggedIn && (
              <button
                type="button"
                onClick={loadMyTickets}
                className="rounded-md border px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
              >
                Refresh
              </button>
            )}
            {!isLoggedIn && (
              <span className="text-sm text-gray-500">Sign in to view your tickets</span>
            )}
          </div>
        </div>

        {isLoggedIn && (
          <>
            {loadingMy ? (
              <div className="mt-4 text-sm text-gray-500" aria-busy>Loading tickets…</div>
            ) : myTickets.length === 0 ? (
              <div className="mt-4 text-sm text-gray-500">No tickets yet.</div>
            ) : (
              <div className="mt-4 overflow-auto border rounded-xl">
                <table className="min-w-[860px] w-full text-sm">
                  <thead className="bg-gray-50 text-left">
                    <tr>
                      <th className="px-3 py-2">Ticket</th>
                      <th className="px-3 py-2">Subject</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Priority</th>
                      <th className="px-3 py-2">Order</th>
                      <th className="px-3 py-2">Created</th>
                      <th className="px-3 py-2">Last Update</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myTickets.map((t) => (
                      <tr key={t._id} className="border-t">
                        <td className="px-3 py-2 font-mono">{t._id.slice(-8)}</td>
                        <td className="px-3 py-2">{t.subject}</td>
                        <td className="px-3 py-2">
                          <span className={`px-2 py-1 rounded-full text-xs ${statusBadge(t.status)}`}>{t.status}</span>
                        </td>
                        <td className="px-3 py-2 capitalize">{t.priority}</td>
                        <td className="px-3 py-2">{t.orderId || '—'}</td>
                        <td className="px-3 py-2">{fmt(t.createdAt)}</td>
                        <td className="px-3 py-2">{fmt(t.updatedAt || t.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>

      {/* Submit Ticket */}
      <section className={sectionCard}>
        <h3 className="text-lg sm:text-xl font-semibold text-gray-900">Submit a Ticket</h3>
        <form className="mt-4 space-y-4" onSubmit={onSubmit}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Subject*</span>
              <input className={inputBase} value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={120} />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">
                Email{isLoggedIn}
              </span>
              <input className={inputBase} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Phone</span>
              <input className={inputBase} value={phone} onChange={(e) => setPhone(e.target.value)} />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Order ID</span>
              <input className={inputBase} value={orderId} onChange={(e) => setOrderId(e.target.value)} />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Category</span>
              <input
                className={inputBase}
                value={ticketCategory}
                onChange={(e) => setTicketCategory(e.target.value)}
                placeholder="e.g. Orders, Payments, Returns"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Priority</span>
              <select className={inputBase} value={priority} onChange={(e) => setPriority(e.target.value as TicketPriority)}>
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
              </select>
            </label>
          </div>

          <label className="block">
            <span className="text-sm font-medium text-gray-700">Message*</span>
            <textarea className={inputBase} rows={5} value={message} onChange={(e) => setMessage(e.target.value)} />
          </label>

          <div className="grid gap-2">
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Attachments (up to 3)</span>
              <input
                className="mt-1 block w-full text-sm file:mr-3 file:rounded-md file:border file:border-gray-300 file:bg-white file:px-3 file:py-2 file:text-gray-700 hover:file:bg-gray-50"
                type="file"
                multiple
                onChange={onFileChange}
              />
            </label>
            {files.length > 0 && (
              <ul className="flex flex-wrap gap-2">
                {files.map((f, i) => (
                  <li key={i} className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">
                    <span className="truncate max-w-[12rem]" title={f.name}>{f.name}</span>
                    <button
                      type="button"
                      className="rounded-full p-1 hover:bg-gray-200"
                      onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                      aria-label={`Remove ${f.name}`}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Submitting…' : 'Submit Ticket'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
};

export default HelpSupport;
