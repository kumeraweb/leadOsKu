'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { RefreshCw, LogOut, MessageSquare, Eye, Building2 } from 'lucide-react';

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

export default function PanelLeadsPage() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
    <div className="admin-page">
      <div className="admin-header">
        <div className="admin-row">
          <MessageSquare size={18} style={{ color: 'var(--admin-text-secondary)' }} />
          <h1>Leads</h1>
        </div>
        <div className="admin-row">
          <button className="btn btn-secondary btn-sm" onClick={loadLeads}>
            <RefreshCw size={14} />
            Refrescar
          </button>
          <button className="btn btn-secondary btn-sm" onClick={signOut}>
            <LogOut size={14} />
            Salir
          </button>
        </div>
      </div>

      <div className="admin-body">
        {tenant ? (
          <div className="admin-card" style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Building2 size={18} style={{ color: 'var(--admin-text-secondary)' }} />
            <div>
              <strong style={{ fontSize: 14 }}>{tenant.client_name ?? 'Cliente sin nombre'}</strong>
              {tenant.user_email ? <span style={{ fontSize: 13, color: 'var(--admin-text-secondary)', marginLeft: 8 }}>{tenant.user_email}</span> : null}
            </div>
          </div>
        ) : null}

        <div className="admin-card">
          {loading ? <p style={{ fontSize: 14, color: 'var(--admin-text-secondary)' }}>Cargando...</p> : null}
          {error ? <div className="toast toast-error">{error}</div> : null}
          {!loading && !error ? (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Número</th>
                    <th>Estado</th>
                    <th>Score</th>
                    <th>Último mensaje</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead) => (
                    <tr key={lead.id}>
                      <td style={{ fontWeight: 600 }}>{lead.wa_profile_name ?? 'Sin nombre'}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{lead.wa_user_id}</td>
                      <td>
                        <span className={`badge ${lead.conversation_status}`}>{lead.conversation_status}</span>
                      </td>
                      <td>
                        <div className="score-badge">
                          {lead.score}
                          <span className="score-bar">
                            <span className="score-fill" style={{ width: `${Math.min(lead.score, 100)}%` }} />
                          </span>
                        </div>
                      </td>
                      <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--admin-text-secondary)' }}>
                        {lead.last_message || '-'}
                      </td>
                      <td>
                        <Link href={`/panel/leads/${lead.id}`}>
                          <button className="btn btn-secondary btn-sm">
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
          ) : null}
          {!loading && !error && leads.length === 0 ? (
            <p style={{ marginTop: 12, fontSize: 13, color: 'var(--admin-text-secondary)' }}>
              Sin leads visibles para este tenant. Revisa mapping en <code>user_clients</code> y políticas RLS.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
