'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { LogIn } from 'lucide-react';

export default function PanelLoginPage() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    setLoading(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    router.push('/panel/leads');
  }

  return (
    <div className="login-page">
      <div className="login-card animate-fade-in-up">
        <div className="login-logo">
          <div className="logo-icon">L</div>
          <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.03em' }}>leadOsKu</span>
        </div>
        <h1>Panel Cliente</h1>
        <p className="login-subtitle">Accede a tus leads y conversaciones en tiempo real</p>
        <form onSubmit={onSubmit}>
          <div className="login-field">
            <label>Email</label>
            <input
              className="login-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@empresa.com"
              required
            />
          </div>
          <div className="login-field">
            <label>Contraseña</label>
            <input
              className="login-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          {error ? <div className="login-error">{error}</div> : null}
          <button className="login-btn" disabled={loading} style={{ marginTop: 8 }}>
            {loading ? (
              'Ingresando...'
            ) : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <LogIn size={16} />
                Ingresar
              </span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
