import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="col" style={{ gap: 16 }}>
      <h1>LeadOS</h1>
      <p>Implementación MVP con Supabase Auth + RLS.</p>
      <div className="row" style={{ flexWrap: 'wrap' }}>
        <Link href="/panel/login">
          <button>Ir a Panel Cliente</button>
        </Link>
        <Link href="/backoffice/login">
          <button className="secondary">Ir a Backoffice</button>
        </Link>
      </div>
    </main>
  );
}
