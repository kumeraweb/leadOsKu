'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

type Lead = {
  id: string;
  wa_profile_name: string | null;
  wa_user_id: string;
  conversation_status: 'ACTIVE' | 'HUMAN_REQUIRED' | 'HUMAN_TAKEN' | 'CLOSED';
  score: number;
};

type Message = {
  id: string;
  direction: 'INBOUND' | 'OUTBOUND';
  text_content: string;
  created_at: string;
};

export default function LeadConversationPage() {
  const params = useParams<{ leadId: string }>();
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [lead, setLead] = useState<Lead | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError(null);

    const response = await fetch(`/api/panel/leads/${params.leadId}/messages`, { cache: 'no-store' });
    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error ?? 'No se pudo cargar la conversación');
      setLoading(false);
      return;
    }

    setLead(payload.lead);
    setMessages(payload.messages ?? []);
    setLoading(false);
  }

  useEffect(() => {
    let active = true;

    async function run() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.push('/panel/login');
        return;
      }

      if (!active) return;
      await load();
    }

    run();
    return () => {
      active = false;
    };
  }, [params.leadId, router, supabase]);

  async function onTake() {
    const response = await fetch(`/api/panel/leads/${params.leadId}/take`, { method: 'POST' });
    if (!response.ok) {
      const payload = await response.json();
      setError(payload.error ?? 'No se pudo tomar conversación');
      return;
    }
    await load();
  }

  async function onCloseLead() {
    const response = await fetch(`/api/panel/leads/${params.leadId}/close`, { method: 'POST' });
    if (!response.ok) {
      const payload = await response.json();
      setError(payload.error ?? 'No se pudo cerrar');
      return;
    }
    await load();
  }

  async function onSend(event: FormEvent) {
    event.preventDefault();
    if (!messageText.trim()) return;

    const response = await fetch(`/api/panel/leads/${params.leadId}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: messageText.trim() })
    });

    if (!response.ok) {
      const payload = await response.json();
      setError(payload.error ?? 'No se pudo enviar');
      return;
    }

    setMessageText('');
    await load();
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.push('/panel/login');
  }

  return (
    <main className="col" style={{ gap: 16 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="row">
          <Link href="/panel/leads">
            <button className="secondary">Volver</button>
          </Link>
          <h1>Conversación</h1>
        </div>
        <button className="secondary" onClick={signOut}>Cerrar sesión</button>
      </div>

      {loading ? <p>Cargando...</p> : null}
      {error ? <p style={{ color: '#b91c1c' }}>{error}</p> : null}

      {lead ? (
        <>
          <div className="card col">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div>
                <strong>{lead.wa_profile_name ?? 'Sin nombre'}</strong>
                <p style={{ margin: 0 }}>{lead.wa_user_id}</p>
              </div>
              <div>
                <span className={`status ${lead.conversation_status}`}>{lead.conversation_status}</span>
                <p style={{ margin: '4px 0 0 0' }}>Score: {lead.score}</p>
              </div>
            </div>
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <button onClick={onTake} disabled={lead.conversation_status !== 'HUMAN_REQUIRED'}>
                Tomar conversación
              </button>
              <button className="secondary" onClick={onCloseLead} disabled={lead.conversation_status === 'CLOSED'}>
                Cerrar conversación
              </button>
            </div>
          </div>

          <div className="card col" style={{ gap: 12 }}>
            {messages.map((message) => (
              <div
                key={message.id}
                style={{
                  alignSelf: message.direction === 'INBOUND' ? 'flex-start' : 'flex-end',
                  maxWidth: '80%',
                  background: message.direction === 'INBOUND' ? '#eff6ff' : '#ecfdf5',
                  border: '1px solid #d1d5db',
                  borderRadius: 10,
                  padding: 10
                }}
              >
                <div style={{ fontSize: 12, color: '#4b5563' }}>{message.direction}</div>
                <div>{message.text_content}</div>
              </div>
            ))}
          </div>

          <form className="card col" onSubmit={onSend}>
            <label className="col">
              Mensaje manual
              <textarea rows={4} value={messageText} onChange={(e) => setMessageText(e.target.value)} />
            </label>
            <button>Enviar</button>
          </form>
        </>
      ) : null}
    </main>
  );
}
