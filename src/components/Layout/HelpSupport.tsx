import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  getSupportConfig,
  getSupportFaqs,
  createSupportTicket,
  type SupportConfig,
  type SupportFaq,
  type TicketPriority,
} from '../../config/adminApi';

const inputBase =
  'mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm placeholder-gray-400 shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40 disabled:opacity-60 dark:bg-zinc-900 dark:border-zinc-700 dark:placeholder-zinc-500';
const sectionCard =
  'bg-white dark:bg-zinc-900/70 border border-gray-100 dark:border-zinc-800 rounded-2xl shadow-sm p-4 sm:p-6';

const HelpSupport: React.FC = () => {
  const [cfg, setCfg] = useState<SupportConfig | null>(null);
  const [faqs, setFaqs] = useState<SupportFaq[]>([]);
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [loadingCfg, setLoadingCfg] = useState(true);
  const [loadingFaqs, setLoadingFaqs] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // form state
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [orderId, setOrderId] = useState('');
  const [ticketCategory, setTicketCategory] = useState('');
  const [priority, setPriority] = useState<TicketPriority>('normal');
  const [files, setFiles] = useState<File[]>([]);

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

  const categories = useMemo(() => {
    const set = new Set<string>();
    faqs.forEach((f) => f.category && set.add(f.category));
    return Array.from(set).sort();
  }, [faqs]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const selected = Array.from(e.target.files).slice(0, 3);
    setFiles(selected);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim() || !/\S+@\S+\.\S+/.test(email)) {
      return toast.error('Please fill subject, message and a valid email');
    }
    try {
      setSubmitting(true);
      const res = await createSupportTicket({
        subject: subject.trim(),
        message: message.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        orderId: orderId.trim() || undefined,
        category: ticketCategory || undefined,
        priority,
        attachments: files,
      });
      if (res?.success) {
        toast.success('Ticket created successfully');
        // reset form
        setSubject('');
        setMessage('');
        setEmail('');
        setPhone('');
        setOrderId('');
        setTicketCategory('');
        setPriority('normal');
        setFiles([]);
      } else {
        toast.error('Could not create ticket');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create ticket');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-gray-900 dark:text-zinc-100">
          Help & Support
        </h2>
      </div>

      {/* Contact channels */}
      <section className={sectionCard}>
        <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-zinc-100">Contact Options</h3>
        {loadingCfg ? (
          <div className="mt-4 text-sm text-gray-500 dark:text-zinc-400" aria-busy>
            Loading…
          </div>
        ) : cfg ? (
          <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {cfg.channels.email && (
              <li className="rounded-xl border border-gray-100 dark:border-zinc-800 p-3 sm:p-4">
                <div className="text-sm sm:text-base text-gray-800 dark:text-zinc-200">
                  <span className="mr-1">📧</span>
                  <strong>Email</strong>:{' '}
                  <a className="text-indigo-600 hover:underline" href={`mailto:${cfg.email.address}`}>
                    {cfg.email.address}
                  </a>
                </div>
                <div className="text-xs text-gray-500 dark:text-zinc-400 mt-1">
                  Avg. response ≈ {cfg.email.responseTimeHours}h
                </div>
              </li>
            )}
            {cfg.channels.phone && (
              <li className="rounded-xl border border-gray-100 dark:border-zinc-800 p-3 sm:p-4">
                <div className="text-sm sm:text-base text-gray-800 dark:text-zinc-200">
                  <span className="mr-1">📞</span>
                  <strong>Phone</strong>: {cfg.phone.number}
                </div>
                <div className="text-xs text-gray-500 dark:text-zinc-400 mt-1">{cfg.phone.hours}</div>
              </li>
            )}
            {cfg.channels.whatsapp && (
              <li className="rounded-xl border border-gray-100 dark:border-zinc-800 p-3 sm:p-4">
                <div className="text-sm sm:text-base text-gray-800 dark:text-zinc-200">
                  <span className="mr-1">💬</span>
                  <strong>WhatsApp</strong>:{' '}
                  <a className="text-indigo-600 hover:underline" href={cfg.whatsapp.link} target="_blank" rel="noreferrer">
                    {cfg.whatsapp.number}
                  </a>
                </div>
              </li>
            )}
            {cfg.channels.chat && (
              <li className="rounded-xl border border-gray-100 dark:border-zinc-800 p-3 sm:p-4">
                <div className="text-sm sm:text-base text-gray-800 dark:text-zinc-200">🟢 <strong>Live Chat</strong>: Available</div>
              </li>
            )}
            {cfg.faq.enabled && cfg.faq.url && (
              <li className="rounded-xl border border-gray-100 dark:border-zinc-800 p-3 sm:p-4 sm:col-span-2">
                <div className="text-sm sm:text-base text-gray-800 dark:text-zinc-200">
                  <span className="mr-1">📚</span>
                  <strong>FAQ</strong>:{' '}
                  <a className="text-indigo-600 hover:underline break-all" href={cfg.faq.url} target="_blank" rel="noreferrer">
                    {cfg.faq.url}
                  </a>
                </div>
              </li>
            )}
          </ul>
        ) : (
          <div className="mt-4 text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-3">
            Could not load support config.
          </div>
        )}
      </section>

      {/* FAQs */}
      <section className={sectionCard}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-zinc-100">FAQs</h3>
          <div className="flex w-full sm:w-auto flex-col sm:flex-row gap-2">
            <input
              className={inputBase}
              placeholder="Search FAQs…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <select
              className={inputBase}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loadingFaqs ? (
          <div className="mt-4 text-sm text-gray-500 dark:text-zinc-400" aria-busy>
            Loading FAQs…
          </div>
        ) : faqs.length === 0 ? (
          <div className="mt-4 text-sm text-gray-500 dark:text-zinc-400">No FAQs found</div>
        ) : (
          <div className="mt-4 divide-y divide-gray-100 dark:divide-zinc-800 rounded-xl border border-gray-100 dark:border-zinc-800 overflow-hidden">
            {faqs.map((f) => (
              <details key={f._id} className="group">
                <summary className="list-none cursor-pointer select-none px-4 sm:px-5 py-3 sm:py-4 flex items-center justify-between gap-3 hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                  <span className="text-sm sm:text-base font-medium text-gray-900 dark:text-zinc-100">{f.question}</span>
                  <svg
                    className="h-4 w-4 text-gray-500 transition-transform group-open:rotate-180"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 011.08 1.04l-4.25 4.25a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z"
                      clipRule="evenodd"
                    />
                  </svg>
                </summary>
                <div className="px-4 sm:px-5 pb-4 text-sm text-gray-700 dark:text-zinc-300">
                  <div>{f.answer}</div>
                  {f.category && (
                    <div className="mt-2 inline-flex items-center rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 px-2.5 py-0.5 text-xs font-medium">
                      {f.category}
                    </div>
                  )}
                </div>
              </details>
            ))}
          </div>
        )}
      </section>

      {/* Ticket form */}
      <section className={sectionCard}>
        <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-zinc-100">Submit a Ticket</h3>
        <form className="mt-4 space-y-4" onSubmit={onSubmit}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-gray-700 dark:text-zinc-300">Subject*</span>
              <input className={inputBase} value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={120} />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700 dark:text-zinc-300">Email*</span>
              <input className={inputBase} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700 dark:text-zinc-300">Phone</span>
              <input className={inputBase} value={phone} onChange={(e) => setPhone(e.target.value)} />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700 dark:text-zinc-300">Order ID</span>
              <input className={inputBase} value={orderId} onChange={(e) => setOrderId(e.target.value)} />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700 dark:text-zinc-300">Category</span>
              <input
                className={inputBase}
                value={ticketCategory}
                onChange={(e) => setTicketCategory(e.target.value)}
                placeholder="e.g. Orders, Payments, Returns"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700 dark:text-zinc-300">Priority</span>
              <select className={inputBase} value={priority} onChange={(e) => setPriority(e.target.value as TicketPriority)}>
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
              </select>
            </label>
          </div>

          <label className="block">
            <span className="text-sm font-medium text-gray-700 dark:text-zinc-300">Message*</span>
            <textarea className={inputBase} rows={5} value={message} onChange={(e) => setMessage(e.target.value)} />
          </label>

          <div className="grid gap-2">
            <label className="block">
              <span className="text-sm font-medium text-gray-700 dark:text-zinc-300">Attachments (up to 3)</span>
              <input className="mt-1 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-indigo-700 hover:file:bg-indigo-100 dark:file:bg-indigo-950/40 dark:file:text-indigo-300" type="file" multiple onChange={onFileChange} />
            </label>
            {files.length > 0 && (
              <ul className="flex flex-wrap gap-2">
                {files.map((f, i) => (
                  <li key={i} className="inline-flex items-center gap-2 rounded-full bg-gray-100 dark:bg-zinc-800 px-3 py-1 text-xs text-gray-700 dark:text-zinc-300">
                    <span className="truncate max-w-[12rem]" title={f.name}>{f.name}</span>
                    <button
                      type="button"
                      className="rounded-full p-1 hover:bg-gray-200 dark:hover:bg-zinc-700"
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
              className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:cursor-not-allowed disabled:opacity-60"
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
