'use client';

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

  const [flowForm, setFlowForm] = useState({
    client_id: '',
    name: 'Flujo comercial base',
    welcome_message: 'Hola. Soy el asistente de ventas. Te haré unas preguntas rápidas para derivarte con el equipo correcto.',
    is_active: true,
    max_steps: 4,
    max_irrelevant_streak: 2,
    max_reminders: 2,
    reminder_delay_minutes: 30,
    steps_json: JSON.stringify(
      [
        {
          step_order: 1,
          prompt_text: '¿Qué tipo de negocio tienes?',
          allow_free_text: false,
          options: [
            { option_order: 1, option_code: 'SERVICIOS', label_text: 'Servicios', score_delta: 25, is_contact_human: false, is_terminal: false },
            { option_order: 2, option_code: 'ECOMMERCE', label_text: 'E-commerce', score_delta: 30, is_contact_human: false, is_terminal: false },
            { option_order: 3, option_code: 'LOCAL', label_text: 'Negocio local', score_delta: 20, is_contact_human: false, is_terminal: false },
            { option_order: 4, option_code: 'EJECUTIVO', label_text: 'Hablar con ejecutiva ahora', score_delta: 100, is_contact_human: true, is_terminal: false }
          ]
        },
        {
          step_order: 2,
          prompt_text: '¿Cuál es tu objetivo principal en 30 días?',
          allow_free_text: false,
          options: [
            { option_order: 1, option_code: 'MAS_CONTACTOS', label_text: 'Más contactos', score_delta: 30, is_contact_human: false, is_terminal: false },
            { option_order: 2, option_code: 'MAS_VENTAS', label_text: 'Más ventas', score_delta: 35, is_contact_human: false, is_terminal: false },
            { option_order: 3, option_code: 'INFO', label_text: 'Solo información por ahora', score_delta: 5, is_contact_human: false, is_terminal: false }
          ]
        },
        {
          step_order: 3,
          prompt_text: '¿Buscas contratar ayuda para implementarlo ahora?',
          allow_free_text: false,
          options: [
            { option_order: 1, option_code: 'SI_AHORA', label_text: 'Sí, quiero contratar ahora', score_delta: 40, is_contact_human: true, is_terminal: false },
            { option_order: 2, option_code: 'LUEGO', label_text: 'No, más adelante', score_delta: 0, is_contact_human: false, is_terminal: true }
          ]
        }
      ],
      null,
      2
    )
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

    await loadClients();
  }

  async function onCreateChannel(event: FormEvent) {
    event.preventDefault();
    setError(null);

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
  }

  async function onAssign(event: FormEvent) {
    event.preventDefault();
    setError(null);

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
  }

  async function onCreateFlow(event: FormEvent) {
    event.preventDefault();
    setError(null);

    let steps;
    try {
      const parsed = JSON.parse(flowForm.steps_json);
      if (!Array.isArray(parsed)) {
        setError('steps_json debe ser un array JSON');
        return;
      }
      steps = parsed;
    } catch {
      setError('steps_json inválido');
      return;
    }

    const response = await fetch('/api/backoffice/client-flows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: flowForm.client_id,
        name: flowForm.name,
        welcome_message: flowForm.welcome_message,
        is_active: flowForm.is_active,
        max_steps: flowForm.max_steps,
        max_irrelevant_streak: flowForm.max_irrelevant_streak,
        max_reminders: flowForm.max_reminders,
        reminder_delay_minutes: flowForm.reminder_delay_minutes,
        steps
      })
    });

    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error ?? 'No se pudo crear flujo');
      return;
    }
  }

  return (
    <main className="col" style={{ gap: 16 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1>Backoffice</h1>
        <button className="secondary" onClick={signOut}>Cerrar sesión</button>
      </div>

      {error ? <p style={{ color: '#b91c1c' }}>{error}</p> : null}

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
        <h2>Crear flujo determinístico</h2>
        <form className="col" onSubmit={onCreateFlow}>
          <input
            placeholder="client_id"
            value={flowForm.client_id}
            onChange={(e) => setFlowForm((v) => ({ ...v, client_id: e.target.value }))}
            required
          />
          <input
            placeholder="name"
            value={flowForm.name}
            onChange={(e) => setFlowForm((v) => ({ ...v, name: e.target.value }))}
            required
          />
          <textarea
            placeholder="welcome_message"
            rows={3}
            value={flowForm.welcome_message}
            onChange={(e) => setFlowForm((v) => ({ ...v, welcome_message: e.target.value }))}
            required
          />
          <div className="row">
            <input
              placeholder="max_steps"
              type="number"
              value={flowForm.max_steps}
              onChange={(e) => setFlowForm((v) => ({ ...v, max_steps: Number(e.target.value) }))}
              required
            />
            <input
              placeholder="max_irrelevant_streak"
              type="number"
              value={flowForm.max_irrelevant_streak}
              onChange={(e) => setFlowForm((v) => ({ ...v, max_irrelevant_streak: Number(e.target.value) }))}
              required
            />
            <input
              placeholder="max_reminders"
              type="number"
              value={flowForm.max_reminders}
              onChange={(e) => setFlowForm((v) => ({ ...v, max_reminders: Number(e.target.value) }))}
              required
            />
            <input
              placeholder="reminder_delay_minutes"
              type="number"
              value={flowForm.reminder_delay_minutes}
              onChange={(e) => setFlowForm((v) => ({ ...v, reminder_delay_minutes: Number(e.target.value) }))}
              required
            />
          </div>
          <textarea
            placeholder="steps_json"
            rows={16}
            value={flowForm.steps_json}
            onChange={(e) => setFlowForm((v) => ({ ...v, steps_json: e.target.value }))}
            required
          />
          <button>Crear flujo</button>
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
