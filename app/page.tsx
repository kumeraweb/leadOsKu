import Link from 'next/link';
import { Bot, GitBranch, BarChart3, Users, Zap, Shield, ArrowRight, MessageSquare, CheckCircle2 } from 'lucide-react';

export default function HomePage() {
  return (
    <div style={{ background: 'var(--gradient-dark)', minHeight: '100vh', color: 'var(--landing-text)' }}>
      {/* ─── Floating Orbs ─── */}
      <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
        <div style={{
          position: 'absolute', top: '10%', left: '15%', width: 400, height: 400,
          borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)',
          animation: 'float 7s ease-in-out infinite', filter: 'blur(40px)'
        }} />
        <div style={{
          position: 'absolute', top: '50%', right: '10%', width: 350, height: 350,
          borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.10) 0%, transparent 70%)',
          animation: 'float 9s ease-in-out infinite 1s', filter: 'blur(50px)'
        }} />
        <div style={{
          position: 'absolute', bottom: '10%', left: '40%', width: 300, height: 300,
          borderRadius: '50%', background: 'radial-gradient(circle, rgba(6,182,212,0.08) 0%, transparent 70%)',
          animation: 'float 8s ease-in-out infinite 0.5s', filter: 'blur(45px)'
        }} />
      </div>

      {/* ─── Header ─── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 20,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(10,10,26,0.80)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)'
      }}>
        <div style={{
          maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', padding: '14px 24px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'var(--gradient-main)', display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: 16, fontWeight: 900, color: 'white'
            }}>L</div>
            <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.03em' }}>leadOsKu</span>
          </div>
          <nav style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              type="button"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', borderRadius: 8,
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)',
                color: '#d1d5db', fontSize: 13, fontWeight: 600, cursor: 'pointer'
              }}
            >
              <MessageSquare size={14} />
              WhatsApp
            </button>
            <Link
              href="/panel/login"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', borderRadius: 8,
                background: 'var(--gradient-main)', backgroundSize: '200% 200%',
                color: 'white', fontSize: 13, fontWeight: 700, textDecoration: 'none'
              }}
            >
              Panel cliente
              <ArrowRight size={14} />
            </Link>
          </nav>
        </div>
      </header>

      {/* ─── Hero ─── */}
      <main style={{ position: 'relative', zIndex: 1 }}>
        <section style={{ maxWidth: 1200, margin: '0 auto', padding: '80px 24px 60px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 48, alignItems: 'start' }}>
            <div className="animate-fade-in-up" style={{ maxWidth: 720 }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '6px 14px', borderRadius: 999,
                background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.20)',
                fontSize: 12, fontWeight: 700, color: '#93c5fd',
                textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 20
              }}>
                <Zap size={12} />
                Sistema de pre-calificación con IA
              </div>

              <h1 style={{
                fontSize: 'clamp(36px, 5vw, 64px)', fontWeight: 900, lineHeight: 1.08,
                letterSpacing: '-0.04em', margin: '0 0 20px 0'
              }}>
                Convierte conversaciones en{' '}
                <span style={{
                  background: 'var(--gradient-main)', WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent', backgroundClip: 'text'
                }}>oportunidades comerciales</span>{' '}
                reales.
              </h1>

              <p style={{
                fontSize: 18, lineHeight: 1.7, color: 'var(--landing-muted)',
                maxWidth: 560, margin: '0 0 32px 0'
              }}>
                LeadOS estructura la conversación por árbol, puntúa intención de forma determinística y
                escala al equipo humano cuando corresponde.
              </p>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                <Link
                  href="/panel/login"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    padding: '14px 28px', borderRadius: 12,
                    background: 'var(--gradient-main)', backgroundSize: '200% 200%',
                    color: 'white', fontSize: 15, fontWeight: 700, textDecoration: 'none',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    boxShadow: '0 4px 24px rgba(59,130,246,0.3)'
                  }}
                >
                  Entrar al panel cliente
                  <ArrowRight size={16} />
                </Link>
                <button
                  type="button"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    padding: '14px 28px', borderRadius: 12,
                    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                    color: '#d1d5db', fontSize: 15, fontWeight: 600, cursor: 'pointer'
                  }}
                >
                  Solicitar demo
                </button>
              </div>
            </div>
          </div>

          {/* ─── Stat Cards ─── */}
          <div className="animate-fade-in-up animate-delay-3" style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 12, marginTop: 56
          }}>
            {[
              { icon: <Bot size={20} />, label: 'Modelo', value: 'Determinístico' },
              { icon: <MessageSquare size={20} />, label: 'Canal', value: 'WhatsApp' },
              { icon: <GitBranch size={20} />, label: 'Arquitectura', value: 'Multi-tenant' }
            ].map((stat) => (
              <div key={stat.label} style={{
                padding: '20px', borderRadius: 14,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)'
              }}>
                <div style={{ color: '#60a5fa', marginBottom: 8 }}>{stat.icon}</div>
                <p style={{ fontSize: 11, color: 'var(--landing-muted)', margin: '0 0 2px', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.06em' }}>
                  {stat.label}
                </p>
                <p style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{stat.value}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ─── Features ─── */}
        <section style={{
          maxWidth: 1200, margin: '0 auto', padding: '40px 24px 80px'
        }}>
          <div className="animate-fade-in-up animate-delay-4" style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16
          }}>
            <div style={{
              padding: 28, borderRadius: 16,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)'
            }}>
              <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 16px', letterSpacing: '-0.02em' }}>
                Qué resuelve hoy
              </h2>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 14 }}>
                {[
                  'Árbol de preguntas y respuestas por cliente.',
                  'Escalamiento automático a humano por reglas y score.',
                  'Trazabilidad completa de decisiones por lead.',
                  'Backoffice para onboarding y operación de canales.'
                ].map((item) => (
                  <li key={item} style={{ display: 'flex', gap: 10, fontSize: 14, lineHeight: 1.6, color: '#d1d5db' }}>
                    <CheckCircle2 size={16} style={{ color: '#34d399', flexShrink: 0, marginTop: 3 }} />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div style={{
              padding: 28, borderRadius: 16,
              background: 'linear-gradient(135deg, rgba(59,130,246,0.10) 0%, rgba(139,92,246,0.08) 100%)',
              border: '1px solid rgba(59,130,246,0.15)'
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
                Estado
              </div>
              <p style={{ fontSize: 32, fontWeight: 900, margin: '0 0 12px', letterSpacing: '-0.03em' }}>
                MVP operativo
              </p>
              <p style={{ fontSize: 14, lineHeight: 1.6, color: '#a5b4fc', margin: 0 }}>
                Flujo determinístico activo, panel cliente y backoffice funcionales.
              </p>
            </div>
          </div>

          {/* ─── How it Works ─── */}
          <div className="animate-fade-in-up animate-delay-5" style={{ marginTop: 64 }}>
            <h2 style={{
              fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em',
              margin: '0 0 32px', textAlign: 'center'
            }}>
              Cómo funciona
            </h2>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16
            }}>
              {[
                { icon: <GitBranch size={24} />, step: '01', title: 'Configura el flujo', desc: 'Define tu árbol de preguntas y scores por opción desde el backoffice.' },
                { icon: <Bot size={24} />, step: '02', title: 'El bot conversa', desc: 'LeadOS guía al lead por WhatsApp, puntuando intención en cada paso.' },
                { icon: <BarChart3 size={24} />, step: '03', title: 'Score y escalamiento', desc: 'Cuando el lead califica, se escala automáticamente a tu equipo.' },
                { icon: <Users size={24} />, step: '04', title: 'Tu equipo cierra', desc: 'El humano recibe el contexto completo y continúa en el panel.' }
              ].map((item) => (
                <div key={item.step} style={{
                  padding: 24, borderRadius: 14,
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  position: 'relative'
                }}>
                  <div style={{
                    fontSize: 48, fontWeight: 900, color: 'rgba(255,255,255,0.04)',
                    position: 'absolute', top: 12, right: 16, lineHeight: 1
                  }}>{item.step}</div>
                  <div style={{ color: '#60a5fa', marginBottom: 12 }}>{item.icon}</div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 8px' }}>{item.title}</h3>
                  <p style={{ fontSize: 13, color: 'var(--landing-muted)', margin: 0, lineHeight: 1.6 }}>{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ─── Trust Bar ─── */}
          <div style={{
            marginTop: 64, padding: '24px 28px', borderRadius: 14,
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'center', justifyContent: 'center'
          }}>
            {[
              { icon: <Shield size={18} />, text: 'Datos seguros en Supabase' },
              { icon: <Zap size={18} />, text: 'Respuestas en < 2 segundos' },
              { icon: <BarChart3 size={18} />, text: 'Score 100% determinístico' },
              { icon: <Users size={18} />, text: 'Multi-tenant desde día 1' }
            ].map((item) => (
              <div key={item.text} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                fontSize: 13, color: 'var(--landing-muted)', fontWeight: 500
              }}>
                <span style={{ color: '#60a5fa' }}>{item.icon}</span>
                {item.text}
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* ─── Footer ─── */}
      <footer style={{
        borderTop: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(10,10,26,0.6)'
      }}>
        <div style={{
          maxWidth: 1200, margin: '0 auto',
          display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between',
          gap: 12, padding: '20px 24px',
          fontSize: 13, color: 'var(--landing-muted)'
        }}>
          <span>© {new Date().getFullYear()} leadOsKu</span>
          <span>Lead qualification engine for WhatsApp sales teams</span>
        </div>
      </footer>
    </div>
  );
}
