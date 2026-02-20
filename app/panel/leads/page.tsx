'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { RefreshCw, LogOut, Eye, Building2, ChevronLeft, ChevronRight } from 'lucide-react';

type LeadRow = {
  id: string;
  wa_profile_name: string | null;
  wa_user_id: string;
  conversation_status: 'ACTIVE' | 'HUMAN_REQUIRED' | 'HUMAN_TAKEN' | 'CLOSED';
  score: number;
  updated_at: string;
  last_message: string;
};

type TenantInfo = {
  user_email: string | null;
  client_name: string | null;
};

const PAGE_SIZE = 20;

export default function PanelLeadsPage() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);

  const totalPages = Math.max(1, Math.ceil(leads.length / PAGE_SIZE));
  const pagedLeads = leads.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  async function loadLeads() {
    setLoading(true);
    setError(null);

    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      router.push('/panel/login');
      return;
    }

    const response = await fetch('/api/panel/leads', { cache: 'no-store' });
    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error ?? 'No se pudo cargar leads');
    } else {
      setLeads(payload.leads ?? []);
      setTenant(payload.tenant ?? null);
      setPage(0);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadLeads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, supabase]);

  async function signOut() {
    await supabase.auth.signOut();
    router.push('/panel/login');
  }

  return (
    <div style={{
      minHeight: '100dvh', background: '#111827', color: '#e5e7eb',
      display: 'flex', flexDirection: 'column'
    }}>
      {/* ─── Compact Header ─── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 12px', background: '#0f172a',
        borderBottom: '1px solid #1e293b', flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: '#f3f4f6', letterSpacing: '-0.02em' }}>Leads</span>
          {tenant ? (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '3px 10px', borderRadius: 6,
              background: '#1e293b', fontSize: 11, color: '#94a3b8'
            }}>
              <Building2 size={12} />
              <span style={{ fontWeight: 600, color: '#cbd5e1' }}>{tenant.client_name ?? 'Cliente'}</span>
              {tenant.user_email ? <span>· {tenant.user_email}</span> : null}
            </div>
          ) : null}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={loadLeads} style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '6px 10px', borderRadius: 6,
            background: 'transparent', border: '1px solid #334155',
            color: '#94a3b8', fontSize: 12, fontWeight: 600, cursor: 'pointer'
          }}>
            <RefreshCw size={13} />
          </button>
          <button onClick={signOut} style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '6px 10px', borderRadius: 6,
            background: 'transparent', border: '1px solid #334155',
            color: '#94a3b8', fontSize: 12, fontWeight: 600, cursor: 'pointer'
          }}>
            <LogOut size={13} />
          </button>
        </div>
      </div>

      {/* ─── Body ─── */}
      <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
            <span style={{ fontSize: 14, color: '#6b7280' }}>Cargando...</span>
          </div>
        ) : null}

        {error ? (
          <div style={{ padding: '8px 12px', borderRadius: 6, background: 'rgba(220,38,38,0.15)', border: '1px solid rgba(220,38,38,0.3)', color: '#fca5a5', fontSize: 13 }}>
            {error}
          </div>
        ) : null}

        {!loading && !error ? (
          <div style={{
            background: '#0f172a', border: '1px solid #1e293b',
            borderRadius: 10, overflow: 'hidden'
          }}>
            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #1e293b' }}>
                    {['Nombre', 'Número', 'Estado', 'Score', 'Último mensaje', ''].map((h) => (
                      <th key={h} style={{
                        textAlign: 'left', padding: '8px 10px',
                        fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                        letterSpacing: '0.06em', color: '#64748b', whiteSpace: 'nowrap'
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pagedLeads.map((lead) => (
                    <tr key={lead.id} style={{ borderBottom: '1px solid #1e293b' }}>
                      <td style={{ padding: '10px', fontWeight: 600, color: '#f1f5f9', whiteSpace: 'nowrap' }}>
                        {lead.wa_profile_name ?? 'Sin nombre'}
                      </td>
                      <td style={{ padding: '10px', fontFamily: 'monospace', fontSize: 11, color: '#94a3b8' }}>
                        {lead.wa_user_id}
                      </td>
                      <td style={{ padding: '10px' }}>
                        <span className={`badge ${lead.conversation_status}`} style={{ fontSize: 10 }}>
                          {lead.conversation_status}
                        </span>
                      </td>
                      <td style={{ padding: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontWeight: 700, color: '#f1f5f9', minWidth: 24 }}>{lead.score}</span>
                          <div style={{ width: 40, height: 4, borderRadius: 2, background: '#1e293b', overflow: 'hidden' }}>
                            <div style={{ height: '100%', borderRadius: 2, background: '#3b82f6', width: `${Math.min(lead.score, 100)}%` }} />
                          </div>
                        </div>
                      </td>
                      <td style={{
                        padding: '10px', maxWidth: 160, overflow: 'hidden',
                        textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#64748b', fontSize: 12
                      }}>
                        {lead.last_message || '-'}
                      </td>
                      <td style={{ padding: '10px' }}>
                        <Link href={`/panel/leads/${lead.id}`}>
                          <button style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            padding: '5px 10px', borderRadius: 6,
                            background: '#1e293b', border: '1px solid #334155',
                            color: '#94a3b8', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                            whiteSpace: 'nowrap'
                          }}>
                            <Eye size={12} />
                            Ver
                          </button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ─── Pagination ─── */}
            {leads.length > PAGE_SIZE ? (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 12px', borderTop: '1px solid #1e293b',
                fontSize: 12, color: '#64748b'
              }}>
                <span>{leads.length} leads · página {page + 1} de {totalPages}</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                    style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      width: 30, height: 30, borderRadius: 6,
                      background: page === 0 ? 'transparent' : '#1e293b',
                      border: '1px solid #334155',
                      color: page === 0 ? '#334155' : '#94a3b8',
                      cursor: page === 0 ? 'not-allowed' : 'pointer'
                    }}
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                    style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      width: 30, height: 30, borderRadius: 6,
                      background: page >= totalPages - 1 ? 'transparent' : '#1e293b',
                      border: '1px solid #334155',
                      color: page >= totalPages - 1 ? '#334155' : '#94a3b8',
                      cursor: page >= totalPages - 1 ? 'not-allowed' : 'pointer'
                    }}
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {!loading && !error && leads.length === 0 ? (
          <div style={{
            padding: '24px', textAlign: 'center', color: '#64748b', fontSize: 13
          }}>
            Sin leads visibles para este tenant. Revisa mapping en <code style={{ background: '#1e293b', padding: '2px 6px', borderRadius: 4, fontSize: 11 }}>user_clients</code> y políticas RLS.
          </div>
        ) : null}
      </div>
    </div>
  );
}
