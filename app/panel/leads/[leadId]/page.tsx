'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { ArrowLeft, LogOut, UserCheck, XCircle, Send } from 'lucide-react';

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
    <div className="admin-page" style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Header */}
      <div className="admin-header">
        <div className="admin-row">
          <Link href="/panel/leads">
            <button className="btn btn-secondary btn-sm">
              <ArrowLeft size={14} />
              Volver
            </button>
          </Link>
          <h1>Conversación</h1>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={signOut}>
          <LogOut size={14} />
          Salir
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflow: 'auto', maxWidth: 800, width: '100%', margin: '0 auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {loading ? <p style={{ fontSize: 14, color: 'var(--admin-text-secondary)' }}>Cargando...</p> : null}
        {error ? <div className="toast toast-error">{error}</div> : null}

        {lead ? (
          <>
            {/* Lead Info Card */}
            <div className="admin-card" style={{ padding: '14px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <strong style={{ fontSize: 15 }}>{lead.wa_profile_name ?? 'Sin nombre'}</strong>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--admin-text-secondary)', fontFamily: 'monospace' }}>{lead.wa_user_id}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className={`badge ${lead.conversation_status}`}>{lead.conversation_status}</span>
                  <div className="score-badge">
                    <span style={{ fontSize: 12, color: 'var(--admin-text-secondary)', fontWeight: 500 }}>Score:</span>
                    {lead.score}
                    <span className="score-bar">
                      <span className="score-fill" style={{ width: `${Math.min(lead.score, 100)}%` }} />
                    </span>
                  </div>
                </div>
              </div>
              <div className="admin-row" style={{ marginTop: 12 }}>
                <button className="btn btn-primary btn-sm" onClick={onTake} disabled={lead.conversation_status !== 'HUMAN_REQUIRED'}>
                  <UserCheck size={14} />
                  Tomar conversación
                </button>
                <button className="btn btn-secondary btn-sm" onClick={onCloseLead} disabled={lead.conversation_status === 'CLOSED'}>
                  <XCircle size={14} />
                  Cerrar
                </button>
              </div>
            </div>

            {/* Chat Messages */}
            <div className="admin-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
              <div className="chat-container" style={{ flex: 1 }}>
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`chat-bubble ${message.direction === 'INBOUND' ? 'chat-bubble-in' : 'chat-bubble-out'}`}
                  >
                    <div>{message.text_content}</div>
                    <div className="chat-meta">
                      {message.direction === 'INBOUND' ? 'Lead' : 'Bot/Agente'}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Send Message */}
            <div className="admin-card" style={{ padding: '12px 16px' }}>
              <form onSubmit={onSend}>
                <div className="chat-input-wrap">
                  <textarea
                    className="admin-input"
                    rows={2}
                    placeholder="Escribe un mensaje..."
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    style={{ resize: 'none' }}
                  />
                  <button className="btn btn-primary" style={{ padding: '10px 16px', alignSelf: 'stretch' }}>
                    <Send size={16} />
                  </button>
                </div>
              </form>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
