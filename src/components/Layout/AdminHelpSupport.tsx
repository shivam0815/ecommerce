import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  adminSupportGetConfig,
  adminSupportUpdateConfig,
  adminSupportListFaqs,
  adminSupportCreateFaq,
  adminSupportUpdateFaq,
  adminSupportDeleteFaq,
  adminSupportListTickets,
  adminSupportUpdateTicketStatus,
  type SupportConfig,
  type SupportFaq,
  type SupportTicket,
  type TicketStatus,
} from '../../config/adminApi';

type TabKey = 'tickets' | 'faqs' | 'config';

const statusOptions: Array<{ label: string; value: TicketStatus | 'all' }> = [
  { label: 'All', value: 'all' },
  { label: 'Open', value: 'open' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Resolved', value: 'resolved' },
  { label: 'Closed', value: 'closed' },
];

/** Attachment type we expect from API (flexible to support multiple backends) */
type Attachment = {
  url: string;
  name?: string;
  type?: string;
  size?: number;
  key?: string;
};

/** Support tickets might return attachments under different fields.
 * This helper collects all into a normalized array.
 */
const collectAttachments = (t: any): Attachment[] => {
  const a: Attachment[] = [];
  const pools = [
    t?.attachmentsUrls,
    t?.attachments,
    t?.files,
    t?.evidences,
  ].filter(Boolean);
  pools.forEach((arr: any[]) => {
    arr.forEach((x: any) => {
      if (!x) return;
      if (typeof x === 'string') a.push({ url: x });
      else if (x.url) a.push(x);
    });
  });
  // De-dup by url
  const seen = new Set<string>();
  return a.filter((x) => {
    if (!x.url || seen.has(x.url)) return false;
    seen.add(x.url);
    return true;
  });
};

const isImage = (att: Attachment) => {
  const t = (att.type || '').toLowerCase();
  if (t.startsWith('image/')) return true;
  const u = att.url.toLowerCase();
  return ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif', '.svg'].some((ext) => u.includes(ext));
};

const formatBytes = (n?: number) => {
  if (!n || n <= 0) return '';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(n) / Math.log(k)), sizes.length - 1);
  return `${(n / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${sizes[i]}`;
};

const AdminHelpSupport: React.FC = () => {
  const [tab, setTab] = useState<TabKey>('tickets');

  // ---- Tickets ----
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [tStatus, setTStatus] = useState<TicketStatus | 'all'>('all');
  const [q, setQ] = useState('');
  const [tPage, setTPage] = useState(1);
  const [tTotalPages, setTTotalPages] = useState(1);
  const [tLoading, setTLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  // ---- FAQs ----
  const [faqs, setFaqs] = useState<SupportFaq[]>([]);
  const [faqLoading, setFaqLoading] = useState(false);
  const [editingFaq, setEditingFaq] = useState<SupportFaq | null>(null);
  const [faqForm, setFaqForm] = useState<Partial<SupportFaq>>({
    question: '',
    answer: '',
    category: '',
    order: 0,
    isActive: true,
  });
  const [savingFaq, setSavingFaq] = useState(false);

  // ---- Config ----
  const [cfg, setCfg] = useState<SupportConfig | null>(null);
  const [cfgDraft, setCfgDraft] = useState<SupportConfig | null>(null);
  const [cfgLoading, setCfgLoading] = useState(false);
  const [cfgSaving, setCfgSaving] = useState(false);

  // ---------------- Loaders ----------------
  const loadTickets = async (page = 1) => {
    try {
      setTLoading(true);
      const res = await adminSupportListTickets({
        status: tStatus,
        q: q || undefined,
        page,
        limit: 10,
      });

      if (res?.success) {
        setTickets(Array.isArray(res.tickets) ? res.tickets : []);
        setTPage(Number(res.page) || 1);
        setTTotalPages(Number(res.totalPages) || 1);
      } else {
        setTickets([]);
        toast.error('Failed to load tickets');
      }
    } catch (err: any) {
      setTickets([]);
      toast.error(err?.message || 'Failed to load tickets');
    } finally {
      setTLoading(false);
    }
  };

  const loadFaqs = async () => {
    try {
      setFaqLoading(true);
      const res = await adminSupportListFaqs();
      if (res.success) setFaqs(res.faqs);
      else toast.error('Failed to load FAQs');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load FAQs');
    } finally {
      setFaqLoading(false);
    }
  };

  const loadConfig = async () => {
    try {
      setCfgLoading(true);
      const res = await adminSupportGetConfig();
      if (res.success) {
        setCfg(res.config);
        setCfgDraft(res.config);
      } else {
        toast.error('Failed to load support config');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load support config');
    } finally {
      setCfgLoading(false);
    }
  };

  // Initial + on tab change
  useEffect(() => {
    if (tab === 'tickets') loadTickets(1);
    if (tab === 'faqs') loadFaqs();
    if (tab === 'config') loadConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // Re-query tickets when filters change
  useEffect(() => {
    if (tab === 'tickets') loadTickets(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tStatus, q]);

  // ---------------- Actions ----------------
  const updateTicketStatus = async (id: string, status: TicketStatus) => {
    try {
      const res = await adminSupportUpdateTicketStatus(id, status);
      if (res.success) {
        setTickets(prev => prev.map(t => (t._id === id ? res.ticket : t)));
        toast.success(`Ticket ${status.replace('_', ' ')} ✔`);
      } else {
        toast.error('Failed to update status');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update status');
    }
  };

  const resetFaqForm = () => {
    setEditingFaq(null);
    setFaqForm({ question: '', answer: '', category: '', order: 0, isActive: true });
  };

  const saveFaq = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!faqForm.question?.trim() || !faqForm.answer?.trim()) {
      toast.error('Question and Answer are required');
      return;
    }
    setSavingFaq(true);
    try {
      if (editingFaq) {
        const res = await adminSupportUpdateFaq(editingFaq._id, {
          question: faqForm.question,
          answer: faqForm.answer,
          category: faqForm.category,
          order: Number(faqForm.order) || 0,
          isActive: Boolean(faqForm.isActive),
        });
        if (res.success) {
          toast.success('FAQ updated');
          resetFaqForm();
          loadFaqs();
        } else toast.error('Failed to update FAQ');
      } else {
        const res = await adminSupportCreateFaq({
          question: faqForm.question!.trim(),
          answer: faqForm.answer!.trim(),
          category: faqForm.category || '',
          order: Number(faqForm.order) || 0,
          isActive: Boolean(faqForm.isActive),
          _id: '' as any, // ignored by backend
        } as any);
        if (res.success) {
          toast.success('FAQ created');
          resetFaqForm();
          loadFaqs();
        } else toast.error('Failed to create FAQ');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save FAQ');
    } finally {
      setSavingFaq(false);
    }
  };

  const deleteFaq = async (id: string) => {
    if (!confirm('Delete this FAQ?')) return;
    try {
      await adminSupportDeleteFaq(id);
      toast.success('FAQ deleted');
      loadFaqs();
    } catch (e: any) {
      toast.error(e?.message || 'Delete failed');
    }
  };

  const saveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cfgDraft) return;
    setCfgSaving(true);
    try {
      const res = await adminSupportUpdateConfig(cfgDraft);
      if (res.success) {
        setCfg(res.config);
        setCfgDraft(res.config);
        toast.success('Support config updated');
      } else {
        toast.error('Failed to update config');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update config');
    } finally {
      setCfgSaving(false);
    }
  };

  // ---------------- UI helpers ----------------
  const pagers = useMemo(() => {
    const pgs = [];
    const start = Math.max(1, tPage - 2);
    for (let i = start; i < start + 5 && i <= tTotalPages; i++) pgs.push(i);
    return pgs;
  }, [tPage, tTotalPages]);

  const copyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied');
    } catch {
      toast.error('Could not copy');
    }
  };

  // ---------------- Renders ----------------
  const renderTickets = () => (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h3 className="text-lg font-semibold">Tickets</h3>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            className="w-full sm:w-64 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring focus:ring-indigo-200"
            placeholder="Search subject, email, order ID…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none"
            value={tStatus}
            onChange={(e) => setTStatus(e.target.value as any)}
          >
            {statusOptions.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="min-w-full overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Subject</th>
                <th className="px-4 py-3 text-left font-medium">Email</th>
                <th className="px-4 py-3 text-left font-medium">Category</th>
                <th className="px-4 py-3 text-left font-medium">Priority</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Created</th>
                <th className="px-4 py-3 text-left font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {tLoading ? (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-500">Loading…</td></tr>
              ) : tickets.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-500">No tickets found</td></tr>
              ) : tickets.map((t) => {
                  const atts = collectAttachments(t);
                  return (
                    <React.Fragment key={t._id}>
                      <tr className="border-t">
                        <td className="px-4 py-3 font-medium">{t.subject}</td>
                        <td className="px-4 py-3">{t.email}</td>
                        <td className="px-4 py-3">{(t as any).category || '—'}</td>
                        <td className="px-4 py-3 capitalize">{(t as any).priority}</td>
                        <td className="px-4 py-3">
                          <select
                            value={(t as any).status}
                            onChange={(e) => updateTicketStatus(t._id, e.target.value as TicketStatus)}
                            className="rounded-md border border-gray-300 px-2 py-1 text-xs"
                          >
                            {statusOptions.filter(s => s.value !== 'all').map(s => (
                              <option key={s.value} value={s.value as string}>{s.label}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3">{new Date((t as any).createdAt).toLocaleString()}</td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => setExpanded(expanded === t._id ? null : t._id)}
                            className="rounded-md px-2 py-1 text-xs text-indigo-600 hover:bg-indigo-50"
                          >
                            {expanded === t._id ? 'Hide' : 'View'}
                          </button>
                        </td>
                      </tr>
                      {expanded === t._id && (
                        <tr className="bg-gray-50">
                          <td colSpan={7} className="px-4 py-4">
                            <div className="grid gap-4 lg:grid-cols-3">
                              {/* Message & Meta */}
                              <div className="lg:col-span-2 space-y-3">
                                <div>
                                  <div className="text-xs uppercase text-gray-500">Message</div>
                                  <div className="whitespace-pre-wrap rounded-md bg-white p-3">{(t as any).message}</div>
                                </div>
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                  <div>
                                    <div className="text-xs uppercase text-gray-500">Phone</div>
                                    <div>{(t as any).phone || '—'}</div>
                                  </div>
                                  <div>
                                    <div className="text-xs uppercase text-gray-500">Order</div>
                                    <div>{(t as any).orderId || '—'}</div>
                                  </div>
                                  <div>
                                    <div className="text-xs uppercase text-gray-500">Created</div>
                                    <div>{new Date((t as any).createdAt).toLocaleString()}</div>
                                  </div>
                                  <div>
                                    <div className="text-xs uppercase text-gray-500">Updated</div>
                                    <div>{new Date(((t as any).updatedAt || (t as any).createdAt)).toLocaleString()}</div>
                                  </div>
                                </div>
                              </div>

                              {/* Attachments */}
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <div className="text-xs uppercase text-gray-500">Attachments</div>
                                  {atts.length > 0 && (
                                    <span className="text-xs text-gray-600">{atts.length}</span>
                                  )}
                                </div>

                                {atts.length === 0 ? (
                                  <div className="rounded-md border border-dashed border-gray-300 bg-white p-3 text-xs text-gray-500">
                                    No attachments
                                  </div>
                                ) : (
                                  <div className="grid grid-cols-2 gap-2">
                                    {atts.map((att, i) => {
                                      const img = isImage(att);
                                      const label = att.name || att.url.split('/').pop() || `file-${i+1}`;
                                      return (
                                        <div key={att.url + i} className="group rounded-md border border-gray-200 bg-white overflow-hidden">
                                          {img ? (
                                            <a
                                              href={att.url}
                                              target="_blank"
                                              rel="noreferrer"
                                              className="block aspect-[4/3] bg-gray-50 overflow-hidden"
                                              title={label}
                                            >
                                              <img
                                                src={att.url}
                                                alt={label}
                                                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                                                loading="lazy"
                                              />
                                            </a>
                                          ) : (
                                            <div className="aspect-[4/3] flex items-center justify-center bg-gray-50 text-gray-500 text-xs">
                                              <span className="px-3 text-center break-all">{label}</span>
                                            </div>
                                          )}
                                          <div className="border-t px-2 py-1.5 text-[11px] flex items-center justify-between gap-1">
                                            <a
                                              className="truncate text-indigo-600 hover:underline"
                                              href={att.url}
                                              target="_blank"
                                              rel="noreferrer"
                                              title={label}
                                            >
                                              {label}
                                            </a>
                                            <div className="flex items-center gap-1 shrink-0">
                                              {att.size ? <span className="text-gray-500">{formatBytes(att.size)}</span> : null}
                                              <a
                                                className="rounded px-1.5 py-0.5 hover:bg-gray-100"
                                                href={att.url}
                                                download
                                                title="Download"
                                              >
                                                ⬇
                                              </a>
                                              <button
                                                type="button"
                                                className="rounded px-1.5 py-0.5 hover:bg-gray-100"
                                                onClick={() => copyLink(att.url)}
                                                title="Copy link"
                                              >
                                                ⧉
                                              </button>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {tTotalPages > 1 && (
          <div className="flex items-center justify-between border-t bg-gray-50 px-4 py-3">
            <div className="text-xs text-gray-600">Page {tPage} of {tTotalPages}</div>
            <div className="flex gap-1">
              <button
                className="rounded-md px-2 py-1 text-xs disabled:opacity-50 hover:bg-white"
                disabled={tPage === 1}
                onClick={() => loadTickets(1)}
              >First</button>
              {pagers.map(p => (
                <button
                  key={p}
                  className={`rounded-md px-2 py-1 text-xs hover:bg-white ${p === tPage ? 'bg-white font-semibold' : ''}`}
                  onClick={() => loadTickets(p)}
                >{p}</button>
              ))}
              <button
                className="rounded-md px-2 py-1 text-xs disabled:opacity-50 hover:bg-white"
                disabled={tPage === tTotalPages}
                onClick={() => loadTickets(tPage + 1)}
              >Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderFaqs = () => (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* List */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold">FAQs</h3>
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <div className="min-w-full overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Question</th>
                  <th className="px-4 py-3 text-left font-medium">Category</th>
                  <th className="px-4 py-3 text-left font-medium">Order</th>
                  <th className="px-4 py-3 text-left font-medium">Active</th>
                  <th className="px-4 py-3 text-left font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {faqLoading ? (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-500">Loading…</td></tr>
                ) : faqs.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-500">No FAQs</td></tr>
                ) : faqs.map(f => (
                  <tr key={f._id} className="border-t">
                    <td className="px-4 py-3">{f.question}</td>
                    <td className="px-4 py-3">{f.category || '—'}</td>
                    <td className="px-4 py-3">{f.order ?? 0}</td>
                    <td className="px-4 py-3">{f.isActive ? 'Yes' : 'No'}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          className="rounded-md px-2 py-1 text-xs text-indigo-600 hover:bg-indigo-50"
                          onClick={() => {
                            setEditingFaq(f);
                            setFaqForm({
                              question: f.question,
                              answer: f.answer,
                              category: f.category ?? '',
                              order: f.order ?? 0,
                              isActive: Boolean(f.isActive),
                            });
                          }}
                        >Edit</button>
                        <button
                          className="rounded-md px-2 py-1 text-xs text-rose-600 hover:bg-rose-50"
                          onClick={() => deleteFaq(f._id)}
                        >Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Editor */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold">{editingFaq ? 'Edit FAQ' : 'Create FAQ'}</h3>
        <form
          onSubmit={saveFaq}
          className="rounded-lg border border-gray-200 bg-white p-4 space-y-3"
        >
          <div>
            <label className="block text-sm font-medium">Question *</label>
            <input
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring focus:ring-indigo-200"
              value={faqForm.question || ''}
              onChange={(e) => setFaqForm(f => ({ ...f, question: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Answer *</label>
            <textarea
              rows={4}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring focus:ring-indigo-200"
              value={faqForm.answer || ''}
              onChange={(e) => setFaqForm(f => ({ ...f, answer: e.target.value }))}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-sm font-medium">Category</label>
              <input
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                value={faqForm.category || ''}
                onChange={(e) => setFaqForm(f => ({ ...f, category: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Order</label>
              <input
                type="number"
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                value={faqForm.order ?? 0}
                onChange={(e) => setFaqForm(f => ({ ...f, order: Number(e.target.value) }))}
              />
            </div>
            <div className="flex items-end">
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={Boolean(faqForm.isActive)}
                  onChange={(e) => setFaqForm(f => ({ ...f, isActive: e.target.checked }))}
                />
                Active
              </label>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={savingFaq}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {savingFaq ? 'Saving…' : editingFaq ? 'Update FAQ' : 'Create FAQ'}
            </button>
            {editingFaq && (
              <button
                type="button"
                onClick={resetFaqForm}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );

  const renderConfig = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Support Configuration</h3>
      <form
        onSubmit={saveConfig}
        className="rounded-lg border border-gray-200 bg-white p-4 space-y-4"
      >
        {cfgLoading || !cfgDraft ? (
          <div className="text-gray-500">Loading…</div>
        ) : (
          <>
            {/* Channels */}
            <div>
              <div className="text-sm font-medium mb-2">Channels</div>
              <div className="grid gap-3 sm:grid-cols-4">
                {(['email','phone','whatsapp','chat'] as const).map(ch => (
                  <label key={ch} className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={Boolean(cfgDraft.channels?.[ch as keyof typeof cfgDraft.channels])}
                      onChange={(e) =>
                        setCfgDraft(d => ({
                          ...(d as SupportConfig),
                          channels: { ...(d!.channels), [ch]: e.target.checked }
                        }))
                      }
                    />
                    {ch[0].toUpperCase() + ch.slice(1)}
                  </label>
                ))}
              </div>
            </div>

            {/* Email */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium">Support Email</label>
                <input
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  value={cfgDraft.email?.address || ''}
                  onChange={(e) => setCfgDraft(d => ({ ...(d as SupportConfig), email: { ...(d!.email), address: e.target.value } }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Avg. Response (hours)</label>
                <input
                  type="number"
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  value={cfgDraft.email?.responseTimeHours ?? 24}
                  onChange={(e) => setCfgDraft(d => ({ ...(d as SupportConfig), email: { ...(d!.email), responseTimeHours: Number(e.target.value) } }))}
                />
              </div>
            </div>

            {/* Phone / WhatsApp */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium">Phone Number</label>
                <input
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  value={cfgDraft.phone?.number || ''}
                  onChange={(e) => setCfgDraft(d => ({ ...(d as SupportConfig), phone: { ...(d!.phone), number: e.target.value } }))}
                />
                <label className="mt-2 block text-sm font-medium">Hours</label>
                <input
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  value={cfgDraft.phone?.hours || ''}
                  onChange={(e) => setCfgDraft(d => ({ ...(d as SupportConfig), phone: { ...(d!.phone), hours: e.target.value } }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium">WhatsApp Number</label>
                <input
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  value={cfgDraft.whatsapp?.number || ''}
                  onChange={(e) => setCfgDraft(d => ({ ...(d as SupportConfig), whatsapp: { ...(d!.whatsapp), number: e.target.value } }))}
                />
                <label className="mt-2 block text-sm font-medium">WhatsApp Link</label>
                <input
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  value={cfgDraft.whatsapp?.link || ''}
                  onChange={(e) => setCfgDraft(d => ({ ...(d as SupportConfig), whatsapp: { ...(d!.whatsapp), link: e.target.value } }))}
                />
              </div>
            </div>

            {/* FAQ section */}
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={Boolean(cfgDraft.faq?.enabled)}
                  onChange={(e) => setCfgDraft(d => ({ ...(d as SupportConfig), faq: { ...(d!.faq), enabled: e.target.checked } }))}
                />
                Enable FAQ link
              </label>
              <div>
                <label className="block text-sm font-medium">FAQ URL</label>
                <input
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  value={cfgDraft.faq?.url || ''}
                  onChange={(e) => setCfgDraft(d => ({ ...(d as SupportConfig), faq: { ...(d!.faq), url: e.target.value } }))}
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={cfgSaving}
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {cfgSaving ? 'Saving…' : 'Save Configuration'}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">🆘 Help & Support (Admin)</h2>
        <div className="flex overflow-hidden rounded-lg border border-gray-200">
          {(['tickets','faqs','config'] as TabKey[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium ${tab === t ? 'bg-indigo-600 text-white' : 'bg-white hover:bg-gray-50'}`}
            >
              {t === 'tickets' && 'Tickets'}
              {t === 'faqs' && 'FAQs'}
              {t === 'config' && 'Config'}
            </button>
          ))}
        </div>
      </div>

      {tab === 'tickets' && renderTickets()}
      {tab === 'faqs' && renderFaqs()}
      {tab === 'config' && renderConfig()}
    </div>
  );
};

export default AdminHelpSupport;
