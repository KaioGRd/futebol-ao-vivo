import { getTodayGames, LEAGUES } from '@/lib/espn';
import GamesGrid from '@/components/GamesGrid';

export const revalidate = 30;

export default async function AoVivoPage() {
  const games = await getTodayGames();
  const liveGames = games.filter(g => g.status.state === 'in');

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <span className="live-dot w-3 h-3 rounded-full inline-block" style={{ background: 'var(--live)' }} />
        <h1 className="text-2xl font-bold">Jogos Ao Vivo</h1>
        <span
          className="px-2 py-0.5 rounded-full text-sm font-bold"
          style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--live)' }}
        >
          {liveGames.length}
        </span>
      </div>

      {liveGames.length === 0 ? (
        <div className="text-center py-24">
          <p className="text-5xl mb-4">😴</p>
          <p className="text-lg font-medium mb-2">Nenhum jogo ao vivo no momento</p>
          <p style={{ color: 'var(--text-muted)' }}>Volte mais tarde ou veja os próximos jogos na página Hoje</p>
        </div>
      ) : (
        <GamesGrid
          initialGames={games}
          leagues={LEAGUES}
          autoRefresh={true}
          filterState="in"
        />
      )}
    </div>
  );
}
