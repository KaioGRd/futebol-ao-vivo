import Link from 'next/link';
import { LEAGUES } from '@/lib/espn';

export default function CompeticoesPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1">Competições</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Selecione uma liga para ver jogos e classificação</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {LEAGUES.map(league => (
          <Link
            key={league.slug}
            href={`/competicoes/${league.slug}`}
            className="flex items-center gap-4 p-4 rounded-xl transition-all duration-200 hover:scale-[1.02]"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
            }}
          >
            <span className="text-3xl">{league.flag}</span>
            <div>
              <p className="font-semibold">{league.name}</p>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{league.country}</p>
            </div>
            <span className="ml-auto" style={{ color: 'var(--text-muted)' }}>→</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
