'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { Users, Plus, Radio, UserPlus, LogOut, GitBranch, Mail, Phone, Gauge } from 'lucide-react';

type Client = {
  id: string;
  name: string;
  notification_email: string;
  score_threshold: number;
  human_forward_number: string;
};

export default function BackofficePage() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [clients, setClients] = useState<Client[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [clientForm, setClientForm] = useState({
    name: '',
    notification_email: '',
    human_forward_number: '',
    score_threshold: 85
  });

  const [channelForm, setChannelForm] = useState({
    client_id: '',
    phone_number_id: '',
    waba_id: '',
    meta_access_token: '',
    meta_app_secret: '',
    is_active: true
  });

  const [assignForm, setAssignForm] = useState({
    user_id: '',
    client_id: ''
  });

  async function loadClients() {
    const response = await fetch('/api/backoffice/clients', { cache: 'no-store' });
    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error ?? 'No se pudieron cargar clientes');
      return;
    }

    setClients(payload.clients ?? []);
  }

  useEffect(() => {
    async function run() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.push('/backoffice/login');
        return;
      }
      await loadClients();
    }

    run();
  }, [router, supabase]);

  async function signOut() {
    await supabase.auth.signOut();
    router.push('/backoffice/login');
  }

  async function onCreateClient(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const response = await fetch('/api/backoffice/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...clientForm, strategic_questions: [] })
    });

    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error ?? 'No se pudo crear cliente');
      return;
    }

    setClientForm({
      name: '',
      notification_email: '',
      human_forward_number: '',
      score_threshold: 85
    });
    setSuccess('Cliente creado correctamente.');
    await loadClients();
  }

  async function onCreateChannel(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const response = await fetch('/api/backoffice/client-channels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(channelForm)
    });

    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error ?? 'No se pudo crear canal');
      return;
    }

    setChannelForm({
      client_id: '',
      phone_number_id: '',
      waba_id: '',
      meta_access_token: '',
      meta_app_secret: '',
      is_active: true
    });
    setSuccess('Canal creado correctamente.');
  }

  async function onAssign(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const response = await fetch('/api/backoffice/user-clients/assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(assignForm)
    });

    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error ?? 'No se pudo asignar usuario');
      return;
    }

    setAssignForm({ user_id: '', client_id: '' });
    setSuccess('Usuario asignado al tenant correctamente.');
  }

  /* ─── Shared styles ─── */
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', borderRadius: 8,
    background: '#1e293b', border: '1px solid #334155',
    color: '#f1f5f9', fontSize: 13, fontFamily: 'inherit',
    outline: 'none'
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, color: '#64748b',
    textTransform: 'uppercase', letterSpacing: '0.05em'
  };

  const cardStyle: React.CSSProperties = {
    background: '#0f172a', border: '1px solid #1e293b',
    borderRadius: 10, padding: 16
  };

  const btnPrimary: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '8px 14px', borderRadius: 7, fontSize: 12, fontWeight: 700,
    background: '#3b82f6', border: 'none', color: 'white', cursor: 'pointer'
  };

  const btnSecondary: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '8px 14px', borderRadius: 7, fontSize: 12, fontWeight: 700,
    background: 'transparent', border: '1px solid #334155',
    color: '#94a3b8', cursor: 'pointer'
  };

  return (
    <div style={{ minHeight: '100dvh', background: '#111827', color: '#e5e7eb' }}>
      {/* ─── Header ─── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 30,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 14px', background: '#0f172a',
        borderBottom: '1px solid #1e293b'
      }}>
        <span style={{ fontSize: 16, fontWeight: 800, color: '#f3f4f6' }}>Backoffice</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <Link href="/backoffice/flows/new">
            <button style={btnPrimary}>
              <GitBranch size={13} /> Crear flujo
            </button>
          </Link>
          <button onClick={signOut} style={btnSecondary}>
            <LogOut size={13} />
          </button>
        </div>
      </div>

      {/* ─── Body ─── */}
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {error ? (
          <div style={{ padding: '8px 12px', borderRadius: 6, background: 'rgba(220,38,38,0.15)', border: '1px solid rgba(220,38,38,0.3)', color: '#fca5a5', fontSize: 13 }}>
            {error}
          </div>
        ) : null}
        {success ? (
          <div style={{ padding: '8px 12px', borderRadius: 6, background: 'rgba(5,150,105,0.15)', border: '1px solid rgba(5,150,105,0.3)', color: '#6ee7b7', fontSize: 13 }}>
            {success}
          </div>
        ) : null}

        {/* ─── Crear cliente ─── */}
        <div style={cardStyle}>
          <h2 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 6, color: '#e2e8f0' }}>
            <Plus size={15} /> Crear cliente
          </h2>
          <form onSubmit={onCreateClient} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={labelStyle}>Nombre</label>
                <input style={inputStyle} placeholder="Nombre del cliente" value={clientForm.name} onChange={(e) => setClientForm((v) => ({ ...v, name: e.target.value }))} required />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={labelStyle}>Email notificación</label>
                <input style={inputStyle} placeholder="email@empresa.com" type="email" value={clientForm.notification_email} onChange={(e) => setClientForm((v) => ({ ...v, notification_email: e.target.value }))} required />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={labelStyle}>Nº forward humano</label>
                <input style={inputStyle} placeholder="+56912345678" value={clientForm.human_forward_number} onChange={(e) => setClientForm((v) => ({ ...v, human_forward_number: e.target.value }))} required />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={labelStyle}>Score threshold</label>
                <input style={inputStyle} placeholder="85" type="number" min={0} max={100} value={clientForm.score_threshold} onChange={(e) => setClientForm((v) => ({ ...v, score_threshold: Number(e.target.value) }))} required />
              </div>
            </div>
            <button style={btnPrimary}><Plus size={13} /> Crear cliente</button>
          </form>
        </div>

        {/* ─── Crear canal ─── */}
        <div style={cardStyle}>
          <h2 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 6, color: '#e2e8f0' }}>
            <Radio size={15} /> Crear canal
          </h2>
          <form onSubmit={onCreateChannel} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={labelStyle}>Client ID</label>
                <input style={inputStyle} placeholder="client_id" value={channelForm.client_id} onChange={(e) => setChannelForm((v) => ({ ...v, client_id: e.target.value }))} required />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={labelStyle}>Phone Number ID</label>
                <input style={inputStyle} placeholder="phone_number_id" value={channelForm.phone_number_id} onChange={(e) => setChannelForm((v) => ({ ...v, phone_number_id: e.target.value }))} required />
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>WABA ID (opcional)</label>
              <input style={inputStyle} placeholder="waba_id" value={channelForm.waba_id} onChange={(e) => setChannelForm((v) => ({ ...v, waba_id: e.target.value }))} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={labelStyle}>Meta Access Token</label>
                <input style={inputStyle} placeholder="meta_access_token" value={channelForm.meta_access_token} onChange={(e) => setChannelForm((v) => ({ ...v, meta_access_token: e.target.value }))} required />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={labelStyle}>Meta App Secret</label>
                <input style={inputStyle} placeholder="meta_app_secret" value={channelForm.meta_app_secret} onChange={(e) => setChannelForm((v) => ({ ...v, meta_app_secret: e.target.value }))} required />
              </div>
            </div>
            <button style={btnPrimary}><Plus size={13} /> Crear canal</button>
          </form>
        </div>

        {/* ─── Asignar usuario ─── */}
        <div style={cardStyle}>
          <h2 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 6, color: '#e2e8f0' }}>
            <UserPlus size={15} /> Asignar usuario a tenant
          </h2>
          <form onSubmit={onAssign} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={labelStyle}>User ID (auth.users.id)</label>
                <input style={inputStyle} placeholder="user_id" value={assignForm.user_id} onChange={(e) => setAssignForm((v) => ({ ...v, user_id: e.target.value }))} required />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={labelStyle}>Client ID</label>
                <input style={inputStyle} placeholder="client_id" value={assignForm.client_id} onChange={(e) => setAssignForm((v) => ({ ...v, client_id: e.target.value }))} required />
              </div>
            </div>
            <button style={btnPrimary}><UserPlus size={13} /> Asignar</button>
          </form>
        </div>

        {/* ─── Tabla de clientes ─── */}
        <div style={cardStyle}>
          <h2 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 6, color: '#e2e8f0' }}>
            <Users size={15} /> Clientes
          </h2>
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #1e293b' }}>
                  <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748b', whiteSpace: 'nowrap' }}>ID</th>
                  <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748b', whiteSpace: 'nowrap' }}>Nombre</th>
                  <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748b', whiteSpace: 'nowrap' }}>
                    <Mail size={10} style={{ verticalAlign: 'middle', marginRight: 3 }} />Email
                  </th>
                  <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748b', whiteSpace: 'nowrap' }}>
                    <Gauge size={10} style={{ verticalAlign: 'middle', marginRight: 3 }} />Thr.
                  </th>
                  <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748b', whiteSpace: 'nowrap' }}>
                    <Phone size={10} style={{ verticalAlign: 'middle', marginRight: 3 }} />Forward
                  </th>
                  <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748b', whiteSpace: 'nowrap' }}>Flujo</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => (
                  <tr key={client.id} style={{ borderBottom: '1px solid #1e293b' }}>
                    <td style={{ padding: '10px', whiteSpace: 'nowrap' }}>
                      <code style={{
                        background: '#1e293b', padding: '2px 6px', borderRadius: 4,
                        fontSize: 10, color: '#64748b', maxWidth: 100,
                        display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis'
                      }}>{client.id}</code>
                    </td>
                    <td style={{ padding: '10px', fontWeight: 600, color: '#f1f5f9', whiteSpace: 'nowrap' }}>{client.name}</td>
                    <td style={{ padding: '10px', color: '#94a3b8', whiteSpace: 'nowrap' }}>{client.notification_email}</td>
                    <td style={{ padding: '10px', color: '#f1f5f9' }}>{client.score_threshold}</td>
                    <td style={{ padding: '10px', color: '#94a3b8', whiteSpace: 'nowrap' }}>{client.human_forward_number}</td>
                    <td style={{ padding: '10px' }}>
                      <Link href={`/backoffice/flows/new?clientId=${client.id}`}>
                        <button style={{ ...btnSecondary, fontSize: 11, padding: '5px 10px' }}>
                          <GitBranch size={11} /> Flujo
                        </button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
