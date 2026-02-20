'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

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
    <main className="col" style={{ gap: 16 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1>Leads</h1>
        <div className="row">
          <button className="secondary" onClick={loadLeads}>Refrescar</button>
          <button className="secondary" onClick={signOut}>Cerrar sesión</button>
        </div>
      </div>
      {tenant ? (
        <div className="card col" style={{ gap: 4 }}>
          <strong>{tenant.client_name ?? 'Cliente sin nombre'}</strong>
          {tenant.user_email ? <span>{tenant.user_email}</span> : null}
        </div>
      ) : null}
      <div className="card">
        {loading ? <p>Cargando...</p> : null}
        {error ? <p style={{ color: '#b91c1c' }}>{error}</p> : null}
        {!loading && !error ? (
          <table>
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
                  <td>{lead.wa_profile_name ?? 'Sin nombre'}</td>
                  <td>{lead.wa_user_id}</td>
                  <td>
                    <span className={`status ${lead.conversation_status}`}>{lead.conversation_status}</span>
                  </td>
                  <td>{lead.score}</td>
                  <td>{lead.last_message || '-'}</td>
                  <td>
                    <Link href={`/panel/leads/${lead.id}`}>
                      <button className="secondary">Ver conversación</button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
        {!loading && !error && leads.length === 0 ? (
          <p style={{ marginTop: 12 }}>Sin leads visibles para este tenant. Revisa mapping en <code>user_clients</code> y políticas RLS.</p>
        ) : null}
      </div>
    </main>
  );
}
