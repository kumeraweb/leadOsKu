'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

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
    <main className="col" style={{ gap: 16 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1>Backoffice</h1>
        <div className="row">
          <Link href="/backoffice/flows/new">
            <button>Crear flujo determinístico</button>
          </Link>
          <button className="secondary" onClick={signOut}>Cerrar sesión</button>
        </div>
      </div>

      {error ? <p style={{ color: '#b91c1c' }}>{error}</p> : null}
      {success ? <p style={{ color: '#065f46' }}>{success}</p> : null}

      <div className="card col">
        <h2>Crear cliente</h2>
        <form className="col" onSubmit={onCreateClient}>
          <input
            placeholder="name"
            value={clientForm.name}
            onChange={(e) => setClientForm((v) => ({ ...v, name: e.target.value }))}
            required
          />
          <input
            placeholder="notification_email"
            type="email"
            value={clientForm.notification_email}
            onChange={(e) => setClientForm((v) => ({ ...v, notification_email: e.target.value }))}
            required
          />
          <input
            placeholder="human_forward_number"
            value={clientForm.human_forward_number}
            onChange={(e) => setClientForm((v) => ({ ...v, human_forward_number: e.target.value }))}
            required
          />
          <input
            placeholder="score_threshold"
            type="number"
            min={0}
            max={100}
            value={clientForm.score_threshold}
            onChange={(e) => setClientForm((v) => ({ ...v, score_threshold: Number(e.target.value) }))}
            required
          />
          <button>Crear cliente</button>
        </form>
      </div>

      <div className="card col">
        <h2>Crear canal</h2>
        <form className="col" onSubmit={onCreateChannel}>
          <input
            placeholder="client_id"
            value={channelForm.client_id}
            onChange={(e) => setChannelForm((v) => ({ ...v, client_id: e.target.value }))}
            required
          />
          <input
            placeholder="phone_number_id"
            value={channelForm.phone_number_id}
            onChange={(e) => setChannelForm((v) => ({ ...v, phone_number_id: e.target.value }))}
            required
          />
          <input
            placeholder="waba_id (optional)"
            value={channelForm.waba_id}
            onChange={(e) => setChannelForm((v) => ({ ...v, waba_id: e.target.value }))}
          />
          <input
            placeholder="meta_access_token"
            value={channelForm.meta_access_token}
            onChange={(e) => setChannelForm((v) => ({ ...v, meta_access_token: e.target.value }))}
            required
          />
          <input
            placeholder="meta_app_secret"
            value={channelForm.meta_app_secret}
            onChange={(e) => setChannelForm((v) => ({ ...v, meta_app_secret: e.target.value }))}
            required
          />
          <button>Crear canal</button>
        </form>
      </div>

      <div className="card col">
        <h2>Asignar usuario a tenant</h2>
        <form className="col" onSubmit={onAssign}>
          <input
            placeholder="user_id (auth.users.id)"
            value={assignForm.user_id}
            onChange={(e) => setAssignForm((v) => ({ ...v, user_id: e.target.value }))}
            required
          />
          <input
            placeholder="client_id"
            value={assignForm.client_id}
            onChange={(e) => setAssignForm((v) => ({ ...v, client_id: e.target.value }))}
            required
          />
          <button>Asignar</button>
        </form>
      </div>

      <div className="card col">
        <h2>Clientes</h2>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Email</th>
              <th>Threshold</th>
              <th>Forward</th>
              <th>Flujo</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((client) => (
              <tr key={client.id}>
                <td><code>{client.id}</code></td>
                <td>{client.name}</td>
                <td>{client.notification_email}</td>
                <td>{client.score_threshold}</td>
                <td>{client.human_forward_number}</td>
                <td>
                  <Link href={`/backoffice/flows/new?clientId=${client.id}`}>
                    <button className="secondary">Crear flujo</button>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
