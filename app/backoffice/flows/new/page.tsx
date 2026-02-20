'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

type BuilderOption = {
  id: string;
  label_text: string;
  score_delta: number;
  next_type: 'node' | 'human' | 'terminal';
  next_node_key: string;
};

type BuilderNode = {
  id: string;
  node_key: string;
  prompt_text: string;
  allow_free_text: boolean;
  options: BuilderOption[];
};

const MAX_NODES = 12;
const MAX_OPTIONS = 8;

function makeId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 32) || 'opcion';
}

function toPayload(nodes: BuilderNode[]) {
  return nodes.map((node, idx) => ({
    step_order: idx + 1,
    node_key: node.node_key,
    prompt_text: node.prompt_text,
    allow_free_text: node.allow_free_text,
    options: node.options.map((option, optionIdx) => ({
      option_order: optionIdx + 1,
      option_code: slugify(option.label_text || `opcion_${optionIdx + 1}`),
      label_text: option.label_text,
      score_delta: Number(option.score_delta) || 0,
      is_contact_human: option.next_type === 'human',
      is_terminal: option.next_type === 'terminal',
      next_node_key: option.next_type === 'node' ? option.next_node_key || null : null
    }))
  }));
}

export default function BackofficeFlowBuilderPage() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [clientId, setClientId] = useState('');
  const [name, setName] = useState('Flujo comercial');
  const [welcomeMessage, setWelcomeMessage] = useState(
    'Hola 👋 Soy el asistente comercial. Te haré unas preguntas breves para ayudarte mejor.'
  );
  const [maxSteps, setMaxSteps] = useState(8);
  const [maxIrrelevantStreak, setMaxIrrelevantStreak] = useState(2);
  const [maxReminders, setMaxReminders] = useState(2);
  const [reminderDelayMinutes, setReminderDelayMinutes] = useState(30);
  const [nodes, setNodes] = useState<BuilderNode[]>([
    {
      id: makeId(),
      node_key: 'inicio',
      prompt_text: '¿Qué necesitas hoy?',
      allow_free_text: false,
      options: [
        { id: makeId(), label_text: 'Soy empresa y quiero contratar', score_delta: 35, next_type: 'node', next_node_key: '' },
        { id: makeId(), label_text: 'Soy emprendedor y quiero contratar', score_delta: 35, next_type: 'node', next_node_key: '' },
        { id: makeId(), label_text: 'Contactar ejecutiva', score_delta: 100, next_type: 'human', next_node_key: '' }
      ]
    }
  ]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    setClientId(params.get('clientId') ?? '');
  }, []);

  useEffect(() => {
    async function run() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) router.push('/backoffice/login');
    }
    run();
  }, [router, supabase]);

  const payloadPreview = useMemo(() => JSON.stringify(toPayload(nodes), null, 2), [nodes]);

  function updateNode(nodeId: string, patch: Partial<BuilderNode>) {
    setNodes((prev) => prev.map((node) => (node.id === nodeId ? { ...node, ...patch } : node)));
  }

  function addNode() {
    if (nodes.length >= MAX_NODES) return;
    setNodes((prev) => [
      ...prev,
      {
        id: makeId(),
        node_key: `nodo_${prev.length + 1}`,
        prompt_text: '',
        allow_free_text: false,
        options: [{ id: makeId(), label_text: '', score_delta: 0, next_type: 'terminal', next_node_key: '' }]
      }
    ]);
  }

  function removeNode(nodeId: string) {
    setNodes((prev) => prev.filter((node) => node.id !== nodeId));
  }

  function addOption(nodeId: string) {
    setNodes((prev) =>
      prev.map((node) => {
        if (node.id !== nodeId || node.options.length >= MAX_OPTIONS) return node;
        return {
          ...node,
          options: [...node.options, { id: makeId(), label_text: '', score_delta: 0, next_type: 'terminal', next_node_key: '' }]
        };
      })
    );
  }

  function updateOption(nodeId: string, optionId: string, patch: Partial<BuilderOption>) {
    setNodes((prev) =>
      prev.map((node) => {
        if (node.id !== nodeId) return node;
        return {
          ...node,
          options: node.options.map((option) => (option.id === optionId ? { ...option, ...patch } : option))
        };
      })
    );
  }

  function removeOption(nodeId: string, optionId: string) {
    setNodes((prev) =>
      prev.map((node) => {
        if (node.id !== nodeId) return node;
        return { ...node, options: node.options.filter((option) => option.id !== optionId) };
      })
    );
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);

    if (!clientId.trim()) {
      setError('client_id es obligatorio');
      setSubmitting(false);
      return;
    }

    const nodeKeys = new Set<string>();
    for (const node of nodes) {
      if (!node.node_key.trim()) {
        setError('Todos los nodos deben tener node_key');
        setSubmitting(false);
        return;
      }
      if (!node.prompt_text.trim()) {
        setError(`El nodo "${node.node_key}" no tiene pregunta/mensaje.`);
        setSubmitting(false);
        return;
      }
      if (node.options.length === 0) {
        setError(`El nodo "${node.node_key}" no tiene opciones.`);
        setSubmitting(false);
        return;
      }
      if (nodeKeys.has(node.node_key)) {
        setError(`node_key duplicado: ${node.node_key}`);
        setSubmitting(false);
        return;
      }
      nodeKeys.add(node.node_key);
    }

    for (const node of nodes) {
      for (const option of node.options) {
        if (!option.label_text.trim()) {
          setError(`Hay una opción vacía en el nodo "${node.node_key}".`);
          setSubmitting(false);
          return;
        }
        if (option.next_type === 'node' && !option.next_node_key.trim()) {
          setError(`La opción "${option.label_text}" debe apuntar a un nodo destino.`);
          setSubmitting(false);
          return;
        }
      }
    }

    const response = await fetch('/api/backoffice/client-flows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        name,
        welcome_message: welcomeMessage,
        is_active: true,
        max_steps: maxSteps,
        max_irrelevant_streak: maxIrrelevantStreak,
        max_reminders: maxReminders,
        reminder_delay_minutes: reminderDelayMinutes,
        steps: toPayload(nodes)
      })
    });

    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error ?? 'No se pudo crear flujo');
      setSubmitting(false);
      return;
    }

    setSuccess('Flujo creado y activado correctamente.');
    setSubmitting(false);
  }

  const nodeKeyOptions = nodes.map((n) => n.node_key).filter(Boolean);

  return (
    <main className="col" style={{ gap: 16 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="row">
          <Link href="/backoffice">
            <button className="secondary">Volver</button>
          </Link>
          <h1>Crear flujo determinístico</h1>
        </div>
      </div>

      {error ? <p style={{ color: '#b91c1c' }}>{error}</p> : null}
      {success ? <p style={{ color: '#065f46' }}>{success}</p> : null}

      <form className="col" onSubmit={onSubmit}>
        <div className="card col">
          <h2>Configuración general</h2>
          <input placeholder="client_id" value={clientId} onChange={(e) => setClientId(e.target.value)} required />
          <input placeholder="nombre del flujo" value={name} onChange={(e) => setName(e.target.value)} required />
          <textarea
            placeholder="mensaje de bienvenida"
            rows={3}
            value={welcomeMessage}
            onChange={(e) => setWelcomeMessage(e.target.value)}
            required
          />
          <div className="row">
            <input type="number" min={1} max={20} value={maxSteps} onChange={(e) => setMaxSteps(Number(e.target.value))} />
            <input type="number" min={1} max={10} value={maxIrrelevantStreak} onChange={(e) => setMaxIrrelevantStreak(Number(e.target.value))} />
            <input type="number" min={0} max={10} value={maxReminders} onChange={(e) => setMaxReminders(Number(e.target.value))} />
            <input type="number" min={1} max={10080} value={reminderDelayMinutes} onChange={(e) => setReminderDelayMinutes(Number(e.target.value))} />
          </div>
        </div>

        <div className="card col">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h2>Nodos del árbol</h2>
            <button type="button" className="secondary" onClick={addNode} disabled={nodes.length >= MAX_NODES}>
              Agregar nodo
            </button>
          </div>

          {nodes.map((node) => (
            <div key={node.id} className="card col" style={{ background: '#f8fafc' }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <strong>Nodo</strong>
                <button type="button" className="secondary" onClick={() => removeNode(node.id)} disabled={nodes.length <= 1}>
                  Eliminar nodo
                </button>
              </div>

              <input
                placeholder="node_key (ej: inicio)"
                value={node.node_key}
                onChange={(e) => updateNode(node.id, { node_key: e.target.value })}
                required
              />
              <textarea
                placeholder="pregunta o mensaje del nodo"
                rows={3}
                value={node.prompt_text}
                onChange={(e) => updateNode(node.id, { prompt_text: e.target.value })}
                required
              />

              <div className="row" style={{ justifyContent: 'space-between' }}>
                <strong>Opciones</strong>
                <button type="button" className="secondary" onClick={() => addOption(node.id)} disabled={node.options.length >= MAX_OPTIONS}>
                  Agregar opción
                </button>
              </div>

              {node.options.map((option) => (
                <div key={option.id} className="card col" style={{ background: 'white' }}>
                  <input
                    placeholder="texto opción"
                    value={option.label_text}
                    onChange={(e) => updateOption(node.id, option.id, { label_text: e.target.value })}
                    required
                  />
                  <input
                    type="number"
                    placeholder="score_delta"
                    value={option.score_delta}
                    onChange={(e) => updateOption(node.id, option.id, { score_delta: Number(e.target.value) })}
                  />
                  <select
                    value={option.next_type}
                    onChange={(e) =>
                      updateOption(node.id, option.id, {
                        next_type: e.target.value as BuilderOption['next_type'],
                        next_node_key: e.target.value === 'node' ? option.next_node_key : ''
                      })
                    }
                  >
                    <option value="node">Ir a otro nodo</option>
                    <option value="human">Escalar a humano</option>
                    <option value="terminal">Cierre amable</option>
                  </select>
                  {option.next_type === 'node' ? (
                    <select
                      value={option.next_node_key}
                      onChange={(e) => updateOption(node.id, option.id, { next_node_key: e.target.value })}
                    >
                      <option value="">Selecciona nodo destino</option>
                      {nodeKeyOptions.map((key) => (
                        <option key={key} value={key}>
                          {key}
                        </option>
                      ))}
                    </select>
                  ) : null}
                  <button type="button" className="secondary" onClick={() => removeOption(node.id, option.id)} disabled={node.options.length <= 1}>
                    Eliminar opción
                  </button>
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="card col">
          <h2>Preview JSON</h2>
          <textarea rows={18} value={payloadPreview} readOnly />
          <button disabled={submitting}>{submitting ? 'Creando...' : 'Aprobar y crear flujo'}</button>
        </div>
      </form>
    </main>
  );
}
