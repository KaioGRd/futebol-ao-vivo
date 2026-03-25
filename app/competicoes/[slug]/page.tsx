import { getLeagueGames, getStandings, getLeague } from '@/lib/espn';
import GameCard from '@/components/GameCard';
import Image from 'next/image';
import Link from 'next/link';

export const revalidate = 60;

export default async function CompetitionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const league = getLeague(slug);
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');

  const [games, standings] = await Promise.all([
    getLeagueGames(slug, today),
    getStandings(slug),
  ]);

  const liveGames = games.filter(g => g.status.state === 'in');
  const upcomingGames = games.filter(g => g.status.state === 'pre');
  const finishedGames = games.filter(g => g.status.state === 'post');

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link href="/competicoes" className="text-sm transition-colors hover:text-white" style={{ color: 'var(--text-muted)' }}>
          ← Competições
        </Link>
        <span style={{ color: 'var(--border)' }}>|</span>
        <span className="text-2xl">{league.flag}</span>
        <div>
          <h1 className="text-2xl font-bold">{league.name}</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{league.country}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Games Column */}
        <div className="lg:col-span-3 space-y-6">
          <h2 className="font-semibold text-lg">Jogos de Hoje</h2>

          {games.length === 0 && (
            <p style={{ color: 'var(--text-muted)' }}>Nenhum jogo hoje nesta competição.</p>
          )}

          {liveGames.length > 0 && (
            <div>
              <h3 className="text-sm font-bold uppercase mb-3 flex items-center gap-2" style={{ color: 'var(--live)' }}>
                <span className="live-dot w-2 h-2 rounded-full inline-block" style={{ background: 'var(--live)' }} />
                Ao Vivo
              </h3>
              <div className="space-y-3">
                {liveGames.map(g => <GameCard key={g.id} game={g} />)}
              </div>
            </div>
          )}

          {upcomingGames.length > 0 && (
            <div>
              <h3 className="text-sm font-bold uppercase mb-3" style={{ color: 'var(--accent)' }}>Em Breve</h3>
              <div className="space-y-3">
                {upcomingGames.map(g => <GameCard key={g.id} game={g} />)}
              </div>
            </div>
          )}

          {finishedGames.length > 0 && (
            <div>
              <h3 className="text-sm font-bold uppercase mb-3" style={{ color: 'var(--text-muted)' }}>Encerrados</h3>
              <div className="space-y-3">
                {finishedGames.map(g => <GameCard key={g.id} game={g} />)}
              </div>
            </div>
          )}
        </div>

        {/* Standings Column */}
        <div className="lg:col-span-2">
          <h2 className="font-semibold text-lg mb-4">Classificação</h2>
          {standings.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Classificação não disponível</p>
          ) : (
            <div
              className="rounded-xl overflow-hidden"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
            >
              {/* Table Header */}
              <div
                className="grid grid-cols-[1.5rem_1fr_2rem_2rem_2rem_2rem_2.5rem] gap-2 px-3 py-2 text-xs font-bold uppercase"
                style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}
              >
                <span>#</span>
                <span>Time</span>
                <span className="text-center">J</span>
                <span className="text-center">V</span>
                <span className="text-center">E</span>
                <span className="text-center">D</span>
                <span className="text-center font-bold">Pts</span>
              </div>

              {standings.map((s, i) => (
                <div
                  key={s.team.id}
                  className="grid grid-cols-[1.5rem_1fr_2rem_2rem_2rem_2rem_2.5rem] gap-2 px-3 py-2.5 text-sm items-center"
                  style={{
                    borderBottom: i < standings.length - 1 ? '1px solid var(--border)' : 'none',
                    background: i % 2 === 1 ? 'rgba(255,255,255,0.02)' : 'transparent',
                  }}
                >
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{i + 1}</span>
                  <div className="flex items-center gap-2 min-w-0">
                    {s.team.logo && (
                      <Image
                        src={s.team.logo}
                        alt={s.team.name}
                        width={18}
                        height={18}
                        className="object-contain shrink-0"
                      />
                    )}
                    <span className="truncate text-xs font-medium">{s.team.shortName || s.team.name}</span>
                  </div>
                  <span className="text-center text-xs" style={{ color: 'var(--text-muted)' }}>{s.gamesPlayed}</span>
                  <span className="text-center text-xs" style={{ color: 'var(--accent)' }}>{s.wins}</span>
                  <span className="text-center text-xs" style={{ color: 'var(--text-secondary)' }}>{s.draws}</span>
                  <span className="text-center text-xs" style={{ color: 'var(--live)' }}>{s.losses}</span>
                  <span className="text-center text-xs font-bold text-white">{s.points}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
