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
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100dvh',
      background: '#1a1a2e', color: '#e5e7eb'
    }}>
      {/* ─── Compact Top Bar ─── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 12px', background: '#111827',
        borderBottom: '1px solid #1f2937', flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Link href="/panel/leads">
            <button style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '6px 10px', borderRadius: 6,
              background: 'transparent', border: '1px solid #374151',
              color: '#9ca3af', fontSize: 12, fontWeight: 600, cursor: 'pointer'
            }}>
              <ArrowLeft size={13} />
              Volver
            </button>
          </Link>
          {lead ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#f3f4f6' }}>
                {lead.wa_profile_name ?? 'Sin nombre'}
              </span>
              <span style={{ fontSize: 11, color: '#6b7280', fontFamily: 'monospace' }}>
                {lead.wa_user_id}
              </span>
            </div>
          ) : (
            <span style={{ fontSize: 14, fontWeight: 700, color: '#f3f4f6' }}>Conversación</span>
          )}
        </div>
        <button
          onClick={signOut}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '6px 10px', borderRadius: 6,
            background: 'transparent', border: '1px solid #374151',
            color: '#9ca3af', fontSize: 12, fontWeight: 600, cursor: 'pointer'
          }}
        >
          <LogOut size={13} />
        </button>
      </div>

      {/* ─── Lead Info Strip ─── */}
      {lead ? (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '6px 12px', background: '#111827',
          borderBottom: '1px solid #1f2937', flexShrink: 0,
          flexWrap: 'wrap', gap: 8
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span className={`badge ${lead.conversation_status}`} style={{ fontSize: 10 }}>
              {lead.conversation_status}
            </span>
            <span style={{ fontSize: 12, color: '#9ca3af' }}>
              Score: <strong style={{ color: '#f3f4f6' }}>{lead.score}</strong>
            </span>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={onTake}
              disabled={lead.conversation_status !== 'HUMAN_REQUIRED'}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                background: lead.conversation_status === 'HUMAN_REQUIRED' ? '#3b82f6' : '#1f2937',
                border: 'none',
                color: lead.conversation_status === 'HUMAN_REQUIRED' ? 'white' : '#4b5563',
                cursor: lead.conversation_status === 'HUMAN_REQUIRED' ? 'pointer' : 'not-allowed'
              }}
            >
              <UserCheck size={12} />
              Tomar
            </button>
            <button
              onClick={onCloseLead}
              disabled={lead.conversation_status === 'CLOSED'}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                background: 'transparent', border: '1px solid #374151',
                color: lead.conversation_status === 'CLOSED' ? '#4b5563' : '#9ca3af',
                cursor: lead.conversation_status === 'CLOSED' ? 'not-allowed' : 'pointer'
              }}
            >
              <XCircle size={12} />
              Cerrar
            </button>
          </div>
        </div>
      ) : null}

      {/* ─── Loading / Error ─── */}
      {loading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 14, color: '#6b7280' }}>Cargando...</span>
        </div>
      ) : null}
      {error ? (
        <div style={{ margin: '8px 12px', padding: '8px 12px', borderRadius: 6, background: 'rgba(220,38,38,0.15)', border: '1px solid rgba(220,38,38,0.3)', color: '#fca5a5', fontSize: 13 }}>
          {error}
        </div>
      ) : null}

      {/* ─── Chat Messages Area ─── */}
      {lead && !loading ? (
        <div style={{
          flex: 1, overflow: 'auto', padding: '12px',
          display: 'flex', flexDirection: 'column', gap: 6,
          background: '#0f0f23'
        }}>
          {messages.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 13, color: '#4b5563' }}>Sin mensajes aún</span>
            </div>
          ) : null}
          {messages.map((message) => (
            <div
              key={message.id}
              style={{
                alignSelf: message.direction === 'INBOUND' ? 'flex-start' : 'flex-end',
                maxWidth: '82%',
                padding: '10px 14px',
                borderRadius: message.direction === 'INBOUND' ? '4px 16px 16px 16px' : '16px 4px 16px 16px',
                background: message.direction === 'INBOUND' ? '#1f2937' : '#1d4ed8',
                color: message.direction === 'INBOUND' ? '#e5e7eb' : '#f0f4ff',
                fontSize: 14, lineHeight: 1.5
              }}
            >
              <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{message.text_content}</div>
              <div style={{
                fontSize: 10, marginTop: 4,
                color: message.direction === 'INBOUND' ? '#6b7280' : 'rgba(255,255,255,0.45)',
                textAlign: message.direction === 'INBOUND' ? 'left' : 'right'
              }}>
                {message.direction === 'INBOUND' ? 'Lead' : 'Bot/Agente'}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {/* ─── Message Input ─── */}
      {lead && !loading ? (
        <div style={{
          padding: '8px 12px', background: '#111827',
          borderTop: '1px solid #1f2937', flexShrink: 0
        }}>
          <form onSubmit={onSend} style={{
            display: 'flex', alignItems: 'center', gap: 8
          }}>
            <input
              type="text"
              placeholder="Escribe un mensaje..."
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              style={{
                flex: 1, padding: '10px 14px', borderRadius: 8,
                background: '#1f2937', border: '1px solid #374151',
                color: '#f3f4f6', fontSize: 14,
                outline: 'none', fontFamily: 'inherit'
              }}
            />
            <button
              type="submit"
              style={{
                width: 40, height: 40, borderRadius: 8,
                background: '#3b82f6', border: 'none',
                color: 'white', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
