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

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h1>Backoffice</h1>
        <div className="admin-row">
          <Link href="/backoffice/flows/new">
            <button className="btn btn-primary btn-sm">
              <GitBranch size={14} />
              Crear flujo
            </button>
          </Link>
          <button className="btn btn-secondary btn-sm" onClick={signOut}>
            <LogOut size={14} />
            Salir
          </button>
        </div>
      </div>

      <div className="admin-body">
        {error ? <div className="toast toast-error">{error}</div> : null}
        {success ? <div className="toast toast-success">{success}</div> : null}

        {/* ─── Crear cliente ─── */}
        <div className="admin-card">
          <h2><Plus size={18} /> Crear cliente</h2>
          <form className="admin-form" onSubmit={onCreateClient}>
            <div className="admin-row">
              <div className="admin-field" style={{ flex: 1 }}>
                <label>Nombre</label>
                <input
                  className="admin-input"
                  placeholder="Nombre del cliente"
                  value={clientForm.name}
                  onChange={(e) => setClientForm((v) => ({ ...v, name: e.target.value }))}
                  required
                />
              </div>
              <div className="admin-field" style={{ flex: 1 }}>
                <label>Email notificación</label>
                <input
                  className="admin-input"
                  placeholder="email@empresa.com"
                  type="email"
                  value={clientForm.notification_email}
                  onChange={(e) => setClientForm((v) => ({ ...v, notification_email: e.target.value }))}
                  required
                />
              </div>
            </div>
            <div className="admin-row">
              <div className="admin-field" style={{ flex: 1 }}>
                <label>Nº forward humano</label>
                <input
                  className="admin-input"
                  placeholder="+56912345678"
                  value={clientForm.human_forward_number}
                  onChange={(e) => setClientForm((v) => ({ ...v, human_forward_number: e.target.value }))}
                  required
                />
              </div>
              <div className="admin-field" style={{ flex: 1 }}>
                <label>Score threshold</label>
                <input
                  className="admin-input"
                  placeholder="85"
                  type="number"
                  min={0}
                  max={100}
                  value={clientForm.score_threshold}
                  onChange={(e) => setClientForm((v) => ({ ...v, score_threshold: Number(e.target.value) }))}
                  required
                />
              </div>
            </div>
            <button className="btn btn-primary">
              <Plus size={14} />
              Crear cliente
            </button>
          </form>
        </div>

        {/* ─── Crear canal ─── */}
        <div className="admin-card">
          <h2><Radio size={18} /> Crear canal</h2>
          <form className="admin-form" onSubmit={onCreateChannel}>
            <div className="admin-row">
              <div className="admin-field" style={{ flex: 1 }}>
                <label>Client ID</label>
                <input
                  className="admin-input"
                  placeholder="client_id"
                  value={channelForm.client_id}
                  onChange={(e) => setChannelForm((v) => ({ ...v, client_id: e.target.value }))}
                  required
                />
              </div>
              <div className="admin-field" style={{ flex: 1 }}>
                <label>Phone Number ID</label>
                <input
                  className="admin-input"
                  placeholder="phone_number_id"
                  value={channelForm.phone_number_id}
                  onChange={(e) => setChannelForm((v) => ({ ...v, phone_number_id: e.target.value }))}
                  required
                />
              </div>
            </div>
            <div className="admin-field">
              <label>WABA ID (opcional)</label>
              <input
                className="admin-input"
                placeholder="waba_id"
                value={channelForm.waba_id}
                onChange={(e) => setChannelForm((v) => ({ ...v, waba_id: e.target.value }))}
              />
            </div>
            <div className="admin-row">
              <div className="admin-field" style={{ flex: 1 }}>
                <label>Meta Access Token</label>
                <input
                  className="admin-input"
                  placeholder="meta_access_token"
                  value={channelForm.meta_access_token}
                  onChange={(e) => setChannelForm((v) => ({ ...v, meta_access_token: e.target.value }))}
                  required
                />
              </div>
              <div className="admin-field" style={{ flex: 1 }}>
                <label>Meta App Secret</label>
                <input
                  className="admin-input"
                  placeholder="meta_app_secret"
                  value={channelForm.meta_app_secret}
                  onChange={(e) => setChannelForm((v) => ({ ...v, meta_app_secret: e.target.value }))}
                  required
                />
              </div>
            </div>
            <button className="btn btn-primary">
              <Plus size={14} />
              Crear canal
            </button>
          </form>
        </div>

        {/* ─── Asignar usuario ─── */}
        <div className="admin-card">
          <h2><UserPlus size={18} /> Asignar usuario a tenant</h2>
          <form className="admin-form" onSubmit={onAssign}>
            <div className="admin-row">
              <div className="admin-field" style={{ flex: 1 }}>
                <label>User ID (auth.users.id)</label>
                <input
                  className="admin-input"
                  placeholder="user_id"
                  value={assignForm.user_id}
                  onChange={(e) => setAssignForm((v) => ({ ...v, user_id: e.target.value }))}
                  required
                />
              </div>
              <div className="admin-field" style={{ flex: 1 }}>
                <label>Client ID</label>
                <input
                  className="admin-input"
                  placeholder="client_id"
                  value={assignForm.client_id}
                  onChange={(e) => setAssignForm((v) => ({ ...v, client_id: e.target.value }))}
                  required
                />
              </div>
            </div>
            <button className="btn btn-primary">
              <UserPlus size={14} />
              Asignar
            </button>
          </form>
        </div>

        {/* ─── Tabla de clientes ─── */}
        <div className="admin-card">
          <h2><Users size={18} /> Clientes</h2>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nombre</th>
                  <th><Mail size={12} style={{ verticalAlign: 'middle' }} /> Email</th>
                  <th><Gauge size={12} style={{ verticalAlign: 'middle' }} /> Threshold</th>
                  <th><Phone size={12} style={{ verticalAlign: 'middle' }} /> Forward</th>
                  <th>Flujo</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => (
                  <tr key={client.id}>
                    <td><code>{client.id}</code></td>
                    <td style={{ fontWeight: 600 }}>{client.name}</td>
                    <td>{client.notification_email}</td>
                    <td>{client.score_threshold}</td>
                    <td>{client.human_forward_number}</td>
                    <td>
                      <Link href={`/backoffice/flows/new?clientId=${client.id}`}>
                        <button className="btn btn-secondary btn-sm">
                          <GitBranch size={12} />
                          Crear flujo
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
