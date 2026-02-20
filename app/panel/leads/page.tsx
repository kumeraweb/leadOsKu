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

export default function PanelLeadsPage() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function run() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.push('/panel/login');
        return;
      }

      const response = await fetch('/api/panel/leads', { cache: 'no-store' });
      const payload = await response.json();

      if (!active) return;

      if (!response.ok) {
        setError(payload.error ?? 'No se pudo cargar leads');
      } else {
        setLeads(payload.leads ?? []);
      }
      setLoading(false);
    }

    run();
    return () => {
      active = false;
    };
  }, [router, supabase]);

  async function signOut() {
    await supabase.auth.signOut();
    router.push('/panel/login');
  }

  return (
    <main className="col" style={{ gap: 16 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1>Leads</h1>
        <button className="secondary" onClick={signOut}>Cerrar sesión</button>
      </div>
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
      </div>
    </main>
  );
}
