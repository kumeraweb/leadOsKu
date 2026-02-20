'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { ArrowLeft, Plus, Trash2, GitBranch, Settings, Link2, Code2 } from 'lucide-react';

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

function nextUniqueNodeKey(existingKeys: string[], base: string): string {
  const normalizedBase = slugify(base || 'nodo');
  if (!existingKeys.includes(normalizedBase)) return normalizedBase;

  let idx = 2;
  while (existingKeys.includes(`${normalizedBase}_${idx}`)) {
    idx += 1;
  }
  return `${normalizedBase}_${idx}`;
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

  function createLinkedSubnode(nodeId: string, optionId: string) {
    setNodes((prev) => {
      const parentIndex = prev.findIndex((node) => node.id === nodeId);
      if (parentIndex === -1) return prev;
      if (prev.length >= MAX_NODES) return prev;

      const parentNode = prev[parentIndex];
      const targetOption = parentNode.options.find((option) => option.id === optionId);
      if (!targetOption) return prev;

      const key = nextUniqueNodeKey(
        prev.map((node) => node.node_key),
        targetOption.label_text || 'nuevo_nodo'
      );

      const subnode: BuilderNode = {
        id: makeId(),
        node_key: key,
        prompt_text: '',
        allow_free_text: false,
        options: [{ id: makeId(), label_text: '', score_delta: 0, next_type: 'terminal', next_node_key: '' }]
      };

      const next = [...prev];
      next[parentIndex] = {
        ...parentNode,
        options: parentNode.options.map((option) =>
          option.id === optionId ? { ...option, next_type: 'node', next_node_key: key } : option
        )
      };
      next.splice(parentIndex + 1, 0, subnode);
      return next;
    });
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
      if (!node.node_key.trim()) { setError('Todos los nodos deben tener node_key'); setSubmitting(false); return; }
      if (!node.prompt_text.trim()) { setError(`El nodo "${node.node_key}" no tiene pregunta/mensaje.`); setSubmitting(false); return; }
      if (node.options.length === 0) { setError(`El nodo "${node.node_key}" no tiene opciones.`); setSubmitting(false); return; }
      if (nodeKeys.has(node.node_key)) { setError(`node_key duplicado: ${node.node_key}`); setSubmitting(false); return; }
      nodeKeys.add(node.node_key);
    }

    for (const node of nodes) {
      for (const option of node.options) {
        if (!option.label_text.trim()) { setError(`Hay una opción vacía en el nodo "${node.node_key}".`); setSubmitting(false); return; }
        if (option.next_type === 'node' && !option.next_node_key.trim()) { setError(`La opción "${option.label_text}" debe apuntar a un nodo destino.`); setSubmitting(false); return; }
      }
    }

    const response = await fetch('/api/backoffice/client-flows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId, name, welcome_message: welcomeMessage, is_active: true,
        max_steps: maxSteps, max_irrelevant_streak: maxIrrelevantStreak,
        max_reminders: maxReminders, reminder_delay_minutes: reminderDelayMinutes,
        steps: toPayload(nodes)
      })
    });

    const payload = await response.json();
    if (!response.ok) { setError(payload.error ?? 'No se pudo crear flujo'); setSubmitting(false); return; }
    setSuccess('Flujo creado y activado correctamente.');
    setSubmitting(false);
  }

  const nodeKeyOptions = nodes.map((n) => n.node_key).filter(Boolean);
  const referencedNodeKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const node of nodes) {
      for (const option of node.options) {
        if (option.next_type === 'node' && option.next_node_key) {
          keys.add(option.next_node_key);
        }
      }
    }
    return keys;
  }, [nodes]);

  const startNode = useMemo(() => {
    return nodes.find((n) => n.node_key === 'inicio') ?? nodes[0] ?? null;
  }, [nodes]);

  const orphanNodes = useMemo(() => {
    const rootKey = startNode?.node_key ?? '';
    return nodes.filter((node) => node.node_key !== rootKey && !referencedNodeKeys.has(node.node_key));
  }, [nodes, referencedNodeKeys, startNode]);

  /* ─── Shared styles ─── */
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', borderRadius: 8,
    background: '#1e293b', border: '1px solid #334155',
    color: '#f1f5f9', fontSize: 13, fontFamily: 'inherit', outline: 'none'
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, color: '#64748b',
    textTransform: 'uppercase', letterSpacing: '0.05em'
  };

  const cardStyle: React.CSSProperties = {
    background: '#0f172a', border: '1px solid #1e293b', borderRadius: 10, padding: 16
  };

  const btnPrimary: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '8px 14px', borderRadius: 7, fontSize: 12, fontWeight: 700,
    background: '#3b82f6', border: 'none', color: 'white', cursor: 'pointer'
  };

  const btnSecondary: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '6px 10px', borderRadius: 7, fontSize: 11, fontWeight: 700,
    background: 'transparent', border: '1px solid #334155',
    color: '#94a3b8', cursor: 'pointer'
  };

  const btnDanger: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700,
    background: 'rgba(220,38,38,0.12)', border: '1px solid rgba(220,38,38,0.25)',
    color: '#f87171', cursor: 'pointer'
  };

  const typeBadge: Record<string, React.CSSProperties> = {
    node: { background: 'rgba(59,130,246,0.15)', color: '#60a5fa', padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' },
    human: { background: 'rgba(245,158,11,0.15)', color: '#fbbf24', padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' },
    terminal: { background: 'rgba(107,114,128,0.15)', color: '#9ca3af', padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }
  };

  const typeLabel: Record<string, string> = { node: 'Ir a nodo', human: 'Escalar', terminal: 'Cierre' };

  function renderNodeTree(node: BuilderNode, depth = 0, ancestry = new Set<string>()): React.ReactNode {
    const isCycle = ancestry.has(node.node_key);
    if (isCycle) {
      return (
        <div style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(220,38,38,0.12)', color: '#fecaca', fontSize: 12 }}>
          Ciclo detectado en nodo: {node.node_key}
        </div>
      );
    }

    const nextAncestry = new Set(ancestry);
    nextAncestry.add(node.node_key);

    return (
      <div
        key={`${node.id}-${depth}`}
        style={{
          marginLeft: depth > 0 ? 18 : 0,
          borderLeft: depth > 0 ? '2px solid #334155' : 'none',
          paddingLeft: depth > 0 ? 12 : 0
        }}
      >
        <div
          style={{
            background: '#1e293b',
            border: '1px solid #334155',
            borderRadius: 8,
            padding: 14,
            display: 'flex',
            flexDirection: 'column',
            gap: 10
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <strong style={{ fontSize: 13, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: 5 }}>
              <GitBranch size={12} /> {node.node_key || 'nodo_sin_key'}
            </strong>
            <button type="button" onClick={() => removeNode(node.id)} disabled={nodes.length <= 1} style={btnDanger}>
              <Trash2 size={11} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={labelStyle}>Node key</label>
            <input style={inputStyle} placeholder="ej: inicio" value={node.node_key} onChange={(e) => updateNode(node.id, { node_key: e.target.value })} required />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={labelStyle}>Pregunta / mensaje</label>
            <textarea style={{ ...inputStyle, resize: 'vertical' }} placeholder="¿Qué necesitas?" rows={2} value={node.prompt_text} onChange={(e) => updateNode(node.id, { prompt_text: e.target.value })} required />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={labelStyle}>Opciones</span>
            <button type="button" onClick={() => addOption(node.id)} disabled={node.options.length >= MAX_OPTIONS} style={btnSecondary}>
              <Plus size={11} /> Opción
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {node.options.map((option) => {
              const childNode =
                option.next_type === 'node'
                  ? nodes.find((n) => n.node_key === option.next_node_key) ?? null
                  : null;

              return (
                <div
                  key={option.id}
                  style={{
                    background: '#0f172a',
                    border: '1px solid #1e293b',
                    borderRadius: 6,
                    padding: 10,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={typeBadge[option.next_type]}>{typeLabel[option.next_type]}</span>
                    <button type="button" onClick={() => removeOption(node.id, option.id)} disabled={node.options.length <= 1} style={btnDanger}>
                      <Trash2 size={10} />
                    </button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <label style={labelStyle}>Texto opción</label>
                      <input style={inputStyle} placeholder="Texto de la opción" value={option.label_text} onChange={(e) => updateOption(node.id, option.id, { label_text: e.target.value })} required />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <label style={labelStyle}>Score delta</label>
                      <input style={inputStyle} type="number" placeholder="0" value={option.score_delta} onChange={(e) => updateOption(node.id, option.id, { score_delta: Number(e.target.value) })} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={labelStyle}>Destino</label>
                    <select style={inputStyle} value={option.next_type} onChange={(e) => updateOption(node.id, option.id, { next_type: e.target.value as BuilderOption['next_type'], next_node_key: e.target.value === 'node' ? option.next_node_key : '' })}>
                      <option value="node">Ir a otro nodo</option>
                      <option value="human">Escalar a humano</option>
                      <option value="terminal">Cierre amable</option>
                    </select>
                  </div>

                  {option.next_type === 'node' ? (
                    <>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <label style={labelStyle}>Nodo destino</label>
                          <select style={inputStyle} value={option.next_node_key} onChange={(e) => updateOption(node.id, option.id, { next_node_key: e.target.value })}>
                            <option value="">Seleccionar...</option>
                            {nodeKeyOptions.map((key) => (
                              <option key={key} value={key}>
                                {key}
                              </option>
                            ))}
                          </select>
                        </div>
                        <button type="button" onClick={() => createLinkedSubnode(node.id, option.id)} disabled={nodes.length >= MAX_NODES} style={btnSecondary}>
                          <Link2 size={11} /> Subnodo
                        </button>
                      </div>

                      {option.next_node_key && !childNode ? (
                        <div style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(245,158,11,0.12)', color: '#fde68a', fontSize: 12 }}>
                          El nodo destino "{option.next_node_key}" no existe.
                        </div>
                      ) : null}

                      {childNode ? (
                        <div style={{ marginTop: 6 }}>{renderNodeTree(childNode, depth + 1, nextAncestry)}</div>
                      ) : null}
                    </>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100dvh', background: '#111827', color: '#e5e7eb' }}>
      {/* ─── Header ─── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 30,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 14px', background: '#0f172a', borderBottom: '1px solid #1e293b'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Link href="/backoffice">
            <button style={btnSecondary}><ArrowLeft size={13} /> Volver</button>
          </Link>
          <span style={{ fontSize: 15, fontWeight: 800, color: '#f3f4f6', display: 'flex', alignItems: 'center', gap: 6 }}>
            <GitBranch size={15} /> Crear flujo
          </span>
        </div>
      </div>

      {/* ─── Body ─── */}
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: 16 }}>
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

        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Config */}
          <div style={cardStyle}>
            <h2 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 6, color: '#e2e8f0' }}>
              <Settings size={15} /> Configuración general
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={labelStyle}>Client ID</label>
                  <input style={inputStyle} placeholder="client_id" value={clientId} onChange={(e) => setClientId(e.target.value)} required />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={labelStyle}>Nombre del flujo</label>
                  <input style={inputStyle} placeholder="Flujo comercial" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={labelStyle}>Mensaje de bienvenida</label>
                <textarea style={{ ...inputStyle, resize: 'vertical' }} rows={2} value={welcomeMessage} onChange={(e) => setWelcomeMessage(e.target.value)} required />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={labelStyle}>Max pasos</label>
                  <input style={inputStyle} type="number" min={1} max={20} value={maxSteps} onChange={(e) => setMaxSteps(Number(e.target.value))} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={labelStyle}>Max irrelev.</label>
                  <input style={inputStyle} type="number" min={1} max={10} value={maxIrrelevantStreak} onChange={(e) => setMaxIrrelevantStreak(Number(e.target.value))} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={labelStyle}>Max record.</label>
                  <input style={inputStyle} type="number" min={0} max={10} value={maxReminders} onChange={(e) => setMaxReminders(Number(e.target.value))} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={labelStyle}>Delay (min)</label>
                  <input style={inputStyle} type="number" min={1} max={10080} value={reminderDelayMinutes} onChange={(e) => setReminderDelayMinutes(Number(e.target.value))} />
                </div>
              </div>
            </div>
          </div>

          {/* Nodes */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 6, color: '#e2e8f0' }}>
                <GitBranch size={15} /> Nodos del árbol
              </h2>
              <button type="button" onClick={addNode} disabled={nodes.length >= MAX_NODES} style={btnSecondary}>
                <Plus size={12} /> Nodo
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {startNode ? (
                <div>
                  <div style={{ marginBottom: 8, fontSize: 11, color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
                    Árbol principal
                  </div>
                  {renderNodeTree(startNode)}
                </div>
              ) : null}

              {orphanNodes.length > 0 ? (
                <div style={{ marginTop: 8 }}>
                  <div style={{ marginBottom: 8, fontSize: 11, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
                    Nodos no conectados
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {orphanNodes.map((node) => (
                      <div key={node.id}>{renderNodeTree(node)}</div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {/* Preview */}
          <div style={cardStyle}>
            <h2 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 6, color: '#e2e8f0' }}>
              <Code2 size={15} /> Preview JSON
            </h2>
            <textarea
              style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 11, resize: 'vertical' }}
              rows={14}
              value={payloadPreview}
              readOnly
            />
            <button disabled={submitting} style={{ ...btnPrimary, marginTop: 10 }}>
              {submitting ? 'Creando...' : 'Aprobar y crear flujo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
