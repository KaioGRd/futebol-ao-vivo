import { getTodayGames, LEAGUES } from '@/lib/espn';
import GamesGrid from '@/components/GamesGrid';

export const revalidate = 30;

export default async function HomePage() {
  const games = await getTodayGames();
  const today = new Date();
  const dateLabel = today.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const liveCount = games.filter(g => g.status.state === 'in').length;
  const upcomingCount = games.filter(g => g.status.state === 'pre').length;
  const finishedCount = games.filter(g => g.status.state === 'post').length;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1">Jogos de Hoje</h1>
        <p className="capitalize" style={{ color: 'var(--text-secondary)' }}>{dateLabel}</p>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-8">
        <div className="rounded-xl p-4 text-center" style={{ background: 'var(--bg-card)', border: '1px solid rgba(239,68,68,0.3)' }}>
          <p className="text-2xl font-bold" style={{ color: 'var(--live)' }}>{liveCount}</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Ao Vivo</p>
        </div>
        <div className="rounded-xl p-4 text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <p className="text-2xl font-bold" style={{ color: 'var(--accent)' }}>{upcomingCount}</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Em Breve</p>
        </div>
        <div className="rounded-xl p-4 text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <p className="text-2xl font-bold text-white">{finishedCount}</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Encerrados</p>
        </div>
      </div>

      <GamesGrid
        initialGames={games}
        leagues={LEAGUES}
        autoRefresh={true}
        dateParam={today.toISOString().slice(0, 10).replace(/-/g, '')}
      />
    </div>
  );
}
