import React, { useEffect, useMemo, useState } from 'react';
import {
  listAffiliates, getAffiliate, listAttributions, listPayouts,
  approvePayout, rejectPayout, updateAffiliateRules, adjustAffiliate, exportAttributionsCsv
} from '../../config/adminAffiliateApi';

type Props = { showNotification: (m: string, t: 'success'|'error'|'info') => void; checkNetworkStatus: () => boolean };

const money = (n: any) => `₹${Number(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;


const AdminAffiliateDashboard: React.FC<Props> = ({ showNotification, checkNetworkStatus }) => {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [limit] = useState(20);
  const [loading, setLoading] = useState(false);

  const [selectedId, setSelectedId] = useState<string>('');
  const [detail, setDetail] = useState<any>(null);
  const [atts, setAtts] = useState<any[]>([]);
  const [attsMonth, setAttsMonth] = useState<string>('');
  const [attsStatus, setAttsStatus] = useState<string>('');
  const [payouts, setPayouts] = useState<any[]>([]);

  const pages = useMemo(() => Math.ceil(total/limit)||1, [total, limit]);

  const loadList = async () => {
    if (!checkNetworkStatus()) return;
    setLoading(true);
    try {
      const { data, pagination } = await listAffiliates({ page, limit, q });
      setRows(data || []);
      setTotal(pagination?.total || 0);
    } catch (e:any) {
      showNotification(e?.message || 'Failed to load affiliates', 'error');
    } finally { setLoading(false); }
  };

  const loadDetail = async (id: string) => {
  if (!id) return;
  try {
    const d = await getAffiliate(id);
    const raw = d?.affiliate ? { ...d.affiliate, user: d.user } : null;
    const normalized = raw
      ? {
          ...raw,
          rules: Array.isArray(raw.rules)
            ? { tiers: raw.rules.map((r: any) => ({
                min: Number(r.minMonthlySales) || 0,
                rate: Number(r.percent) || 0,
              })) }
            : (raw.rules || { tiers: [] }),
        }
      : null;
    setDetail(normalized);
  } catch (e: any) {
    showNotification('Failed to load affiliate', 'error');
  }
};


  const loadAttributions = async (affiliateId?: string) => {
    try {
      const { success, data } = await listAttributions({
        affiliateId: affiliateId || selectedId, monthKey: attsMonth || undefined, status: attsStatus || undefined, limit: 300
      });
      if (success) setAtts(data || []);
    } catch { /* noop */ }
  };

  const loadPayouts = async () => {
    try {
      const { success, data } = await listPayouts({}); if (success) setPayouts(data || []);
    } catch { /* noop */ }
  };

  useEffect(() => { loadList(); }, [page, q]);
  useEffect(() => { if (selectedId) { loadDetail(selectedId); loadAttributions(selectedId); } }, [selectedId, attsMonth, attsStatus]);
  useEffect(() => { loadPayouts(); }, []);

  const approve = async (p: any) => {
    const txnId = prompt('Enter txn/reference id'); if (!txnId) return;
    try {
      await approvePayout(p._id, { txnId, method: 'UPI', note: '' });
      showNotification('Payout marked paid', 'success');
      loadPayouts(); if (selectedId) loadAttributions(selectedId);
    } catch (e:any) { showNotification(e?.response?.data?.message || 'Approve failed', 'error'); }
  };

  const reject = async (p: any) => {
    const reason = prompt('Reason for rejection') || 'Rejected by admin';
    try {
      await rejectPayout(p._id, { reason });
      showNotification('Payout rejected', 'success');
      loadPayouts();
    } catch (e:any) { showNotification('Reject failed', 'error'); }
  };

  const saveTiers = async () => {
  if (!detail?._id) return;
  const tiers = (detail.rules?.tiers || []).map((t:any) => ({
    min: Number(t.min) || 0,
    rate: Number(t.rate) || 0, // rate is percent value, e.g. 2.5
  }));
  await updateAffiliateRules(detail._id, tiers);
  showNotification('Rules updated', 'success');
};


  const addTier = () => {
    const rules = detail?.rules || { tiers: [] };
    rules.tiers.push({ min: 0, rate: 0.01 });
    setDetail({ ...detail, rules });
  };

  const rmTier = (i: number) => {
    const rules = detail?.rules || { tiers: [] };
    rules.tiers.splice(i, 1);
    setDetail({ ...detail, rules });
  };

  const adjust = async () => {
    if (!detail?._id) return;
    const amt = Number(prompt('Adjustment amount (+/-) ₹') || '0');
    if (!Number.isFinite(amt) || amt === 0) return;
    const note = prompt('Note') || 'manual_adjustment';
    try {
      await adjustAffiliate(detail._id, { amount: amt, note });
      showNotification('Adjustment recorded', 'success');
      loadDetail(detail._id); loadAttributions(detail._id);
    } catch { showNotification('Adjustment failed', 'error'); }
  };

  const exportCsv = async () => {
    try {
      const blob = await exportAttributionsCsv({ affiliateId: selectedId || undefined, monthKey: attsMonth || undefined });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `attributions_${Date.now()}.csv`; a.click();
      URL.revokeObjectURL(url);
    } catch { showNotification('Export failed', 'error'); }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 16 }}>
      {/* LEFT: list */}
      <div style={{ background: '#fff', borderRadius: 12, padding: 12, border: '1px solid #eee' }}>
        <h3 style={{ margin: '6px 0 10px' }}>Affiliates</h3>
        <input
          value={q} onChange={e => { setPage(1); setQ(e.target.value); }}
          placeholder="Search name/email/code" style={{ width:'100%', padding:8, border:'1px solid #ddd', borderRadius:8 }}
        />
        <div style={{ marginTop:10, maxHeight: '72vh', overflow:'auto' }}>
          {loading ? <div>Loading…</div> : rows.map((r:any) => (
            <button
              key={r._id}
              onClick={() => setSelectedId(r._id)}
              style={{
                display:'block', width:'100%', textAlign:'left', padding:10, marginBottom:8,
                border:'1px solid #eee', borderRadius:10, background: selectedId===r._id?'#f2f6ff':'#fff'
              }}
            >
              <div style={{ fontWeight:700 }}>{r.user?.name || '—'}</div>
              <div style={{ fontSize:12, color:'#666' }}>{r.user?.email}</div>
              <div style={{ marginTop:6, fontSize:13 }}>
                Code: <b>{r.code}</b> · Month {r.monthKey} · Sales {money(r.monthSales)} · Comm {money(r.monthCommissionAccrued)}
              </div>
            </button>
          ))}
          {rows.length===0 && !loading && <div>No records</div>}
        </div>
        <div style={{ display:'flex', gap:8, marginTop:10 }}>
          <button disabled={page<=1} onClick={()=>setPage(1)}>⏮</button>
          <button disabled={page<=1} onClick={()=>setPage(p=>p-1)}>◀</button>
          <div style={{ padding:'4px 8px' }}>{page}/{pages}</div>
          <button disabled={page>=pages} onClick={()=>setPage(p=>p+1)}>▶</button>
          <button disabled={page>=pages} onClick={()=>setPage(pages)}>⏭</button>
        </div>
      </div>

      {/* RIGHT: detail */}
      <div style={{ display:'grid', gap:16 }}>
        {/* summary */}
        <div style={{ background:'#fff', border:'1px solid #eee', borderRadius:12, padding:12 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <h3 style={{ margin:0 }}>Summary</h3>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={saveTiers} disabled={!detail}>Save Rules</button>
              <button onClick={addTier} disabled={!detail}>Add Tier</button>
              <button onClick={adjust} disabled={!detail}>Manual Adjust</button>
            </div>
          </div>
          {!detail ? (
            <div>Select an affiliate</div>
          ) : (
            <>
              <div style={{ marginTop:8 }}>
                <div><b>{detail.user?.name}</b> · {detail.user?.email}</div>
                <div style={{ fontSize:13, color:'#666' }}>Code: {detail.code} · Current month: {detail.monthKey}</div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, marginTop:10 }}>
                <Stat label="Month Orders" value={detail.monthOrders} />
                <Stat label="Month Sales" value={money(detail.monthSales)} />
                <Stat label="Month Commission" value={money(detail.monthCommissionAccrued)} />
                <Stat label="Lifetime Commission" value={money(detail.lifetimeCommission)} />
              </div>

              <div style={{ marginTop:14 }}>
                <h4 style={{ margin:'6px 0' }}>Rules</h4>
                {(detail.rules?.tiers || []).map((t:any, i:number) => (
                  <div key={i} style={{ display:'flex', gap:8, marginBottom:6 }}>
                    <input type="number" step="1" value={t.min}
                      onChange={e => {
                        const v = Number(e.target.value)||0;
                        const rules = {...detail.rules}; rules.tiers[i] = { ...rules.tiers[i], min: v };
                        setDetail({ ...detail, rules });
                      }}
                      style={{ width:120, padding:6, border:'1px solid #ddd', borderRadius:8 }}
                      placeholder="min sales"
                    />
                    <input type="number" step="0.001" value={t.rate}
                      onChange={e => {
                        const v = Number(e.target.value)||0;
                        const rules = {...detail.rules}; rules.tiers[i] = { ...rules.tiers[i], rate: v };
                        setDetail({ ...detail, rules });
                      }}
                      style={{ width:120, padding:6, border:'1px solid #ddd', borderRadius:8 }}
                      placeholder="rate e.g. 0.01"
                    />
                    <button onClick={()=>rmTier(i)}>Remove</button>
                  </div>
                ))}
                {(!detail.rules?.tiers || detail.rules.tiers.length===0) && <div style={{ fontSize:13, color:'#666' }}>No tiers</div>}
              </div>
            </>
          )}
        </div>

        {/* attributions */}
        <div style={{ background:'#fff', border:'1px solid #eee', borderRadius:12, padding:12 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <h3 style={{ margin:0 }}>Attributions</h3>
            <div style={{ display:'flex', gap:8 }}>
              <input placeholder="YYYY-MM" value={attsMonth} onChange={e=>setAttsMonth(e.target.value)}
                style={{ padding:6, border:'1px solid #ddd', borderRadius:8, width:110 }} />
              <select value={attsStatus} onChange={e=>setAttsStatus(e.target.value)} style={{ padding:6, border:'1px solid #ddd', borderRadius:8 }}>
                <option value="">All</option>
                <option value="pending">pending</option>
                <option value="locked">locked</option>
                <option value="approved">approved</option>
                <option value="paid">paid</option>
                <option value="reversed">reversed</option>
              </select>
              <button onClick={exportCsv} disabled={!atts.length}>Export CSV</button>
            </div>
          </div>
          <div style={{ overflow:'auto', maxHeight: 320, marginTop:8 }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr>
                  <Th>Created</Th><Th>Month</Th><Th>Order</Th><Th>Sale</Th><Th>Commission</Th><Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {atts.map((r:any) => (
                  <tr key={r._id}>
                    <Td>{new Date(r.createdAt).toLocaleString()}</Td>
                    <Td>{r.monthKey}</Td>
                    <Td>{r.orderNumber || r.orderId || '—'}</Td>
                    <Td>{money(r.saleAmount ?? r.amount ?? 0)}</Td>
                    <Td>{money(r.commissionAmount ?? 0)}</Td>
                    <Td>{r.status}</Td>
                  </tr>
                ))}
                {atts.length===0 && (
                  <tr><Td colSpan={6} style={{ textAlign:'center', color:'#666' }}>No rows</Td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* payouts */}
        <div style={{ background:'#fff', border:'1px solid #eee', borderRadius:12, padding:12 }}>
          <h3 style={{ margin:'0 0 8px' }}>Payouts</h3>
          <div style={{ overflow:'auto', maxHeight: 260 }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr>
                  <Th>Affiliate</Th><Th>Month</Th><Th>Amount</Th><Th>Status</Th><Th>Action</Th>
                </tr>
              </thead>
              <tbody>
                {payouts.map((p:any) => (
                  <tr key={p._id}>
                    <Td>{String(p.affiliateId).slice(-6)}</Td>
                    <Td>{p.monthKey}</Td>
                    <Td>{money(p.amount)}</Td>
                    <Td>{p.status}</Td>
                    <Td>
                      {p.status==='requested' ? (
                        <>
                          <button onClick={()=>approve(p)} style={{ marginRight:6 }}>Approve</button>
                          <button onClick={()=>reject(p)}>Reject</button>
                        </>
                      ) : <span>—</span>}
                    </Td>
                  </tr>
                ))}
                {payouts.length===0 && <tr><Td colSpan={5} style={{ textAlign:'center', color:'#666' }}>No payouts</Td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

const Stat = ({ label, value }: { label: string; value: any }) => (
  <div style={{ background:'#f8f9ff', border:'1px solid #eee', borderRadius:10, padding:12 }}>
    <div style={{ fontSize:12, color:'#666' }}>{label}</div>
    <div style={{ fontSize:18, fontWeight:700 }}>{value}</div>
  </div>
);

const Th: React.FC<React.PropsWithChildren<{}>> = ({ children }) => (
  <th style={{ textAlign:'left', padding:'8px 6px', borderBottom:'1px solid #eee', fontSize:12, color:'#555' }}>{children}</th>
);
const Td: React.FC<React.PropsWithChildren<any>> = ({ children, ...rest }) => (
  <td {...rest} style={{ padding:'8px 6px', borderBottom:'1px solid #f2f2f2', fontSize:13 }}>{children}</td>
);

export default AdminAffiliateDashboard;
