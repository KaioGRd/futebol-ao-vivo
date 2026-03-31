import { getMatchDetail } from '@/lib/espn';
import { Player } from '@/lib/types';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export const revalidate = 30;

function StatBar({ name, home, away }: { name: string; home: string; away: string }) {
  const h = parseFloat(home) || 0;
  const a = parseFloat(away) || 0;
  const total = h + a || 1;
  const homePct = (h / total) * 100;

  return (
    <div className="mb-3">
      <div className="flex justify-between text-xs mb-1">
        <span className="font-semibold text-white">{home}</span>
        <span style={{ color: 'var(--text-muted)' }}>{name}</span>
        <span className="font-semibold text-white">{away}</span>
      </div>
      <div className="flex h-1.5 rounded-full overflow-hidden gap-0.5" style={{ background: 'var(--border)' }}>
        <div
          className="stat-bar-fill rounded-full transition-all"
          style={{ width: `${homePct}%`, background: 'var(--accent)' }}
        />
        <div
          className="stat-bar-fill rounded-full transition-all"
          style={{ width: `${100 - homePct}%`, background: 'var(--live)' }}
        />
      </div>
    </div>
  );
}

const EVENT_ICONS: Record<string, string> = {
  '57': '⚽',  // Goal
  '58': '⚽',  // Goal (penalty)
  '93': '🟥',  // Red card
  '72': '🟨',  // Yellow card
  '70': '🔄',  // Substitution
  '71': '🔄',  // Substitution
};

export default async function MatchPage({
  params,
}: {
  params: Promise<{ league: string; id: string }>;
}) {
  const { league, id } = await params;
  const detail = await getMatchDetail(league, id);

  if (!detail) return notFound();

  const { game, plays, homeStats, awayStats, homePlayers, awayPlayers } = detail;
  const { home, away, status } = game;
  const isLive = status.state === 'in';
  const isPre = status.state === 'pre';

  return (
    <div className="max-w-3xl mx-auto">
      {/* Back */}
      <div className="mb-6">
        <Link href="/" className="text-sm transition-colors hover:text-white" style={{ color: 'var(--text-muted)' }}>
          ← Voltar
        </Link>
      </div>

      {/* Match Header */}
      <div
        className="rounded-2xl p-6 mb-6"
        style={{
          background: 'var(--bg-card)',
          border: `1px solid ${isLive ? 'rgba(239,68,68,0.4)' : 'var(--border)'}`,
        }}
      >
        {/* League + Status */}
        <div className="flex items-center justify-between mb-6">
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {game.league.flag} {game.league.name}
          </span>
          {isLive ? (
            <span
              className="live-badge flex items-center gap-1.5 text-sm font-bold px-3 py-1 rounded-full"
              style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--live)', border: '1px solid rgba(239,68,68,0.3)' }}
            >
              <span className="live-dot w-2 h-2 rounded-full inline-block" style={{ background: 'var(--live)' }} />
              {status.detail}
            </span>
          ) : isPre ? (
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {new Date(game.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          ) : (
            <span className="text-sm px-3 py-1 rounded-full" style={{ background: 'var(--border)', color: 'var(--text-muted)' }}>
              Encerrado
            </span>
          )}
        </div>

        {/* Teams + Score */}
        <div className="flex items-center gap-4">
          {/* Home */}
          <div className="flex-1 flex flex-col items-center gap-3">
            {home.team.logo ? (
              <Image src={home.team.logo} alt={home.team.name} width={64} height={64} className="object-contain" />
            ) : (
              <div className="w-16 h-16 rounded-full flex items-center justify-center text-lg font-bold" style={{ background: 'var(--border)' }}>
                {home.team.name.slice(0, 2)}
              </div>
            )}
            <span className="font-semibold text-center text-sm">{home.team.name}</span>
            {home.winner && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--accent-dark)', color: '#fff' }}>Vencedor</span>}
          </div>

          {/* Score */}
          <div className="flex flex-col items-center shrink-0">
            {isPre ? (
              <div>
                <span className="text-3xl font-bold" style={{ color: 'var(--text-muted)' }}>vs</span>
                <p className="text-xs text-center mt-2" style={{ color: 'var(--text-muted)' }}>
                  {new Date(game.date).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <span className="text-5xl font-black">{home.score}</span>
                <span className="text-2xl" style={{ color: 'var(--text-muted)' }}>-</span>
                <span className="text-5xl font-black">{away.score}</span>
              </div>
            )}
          </div>

          {/* Away */}
          <div className="flex-1 flex flex-col items-center gap-3">
            {away.team.logo ? (
              <Image src={away.team.logo} alt={away.team.name} width={64} height={64} className="object-contain" />
            ) : (
              <div className="w-16 h-16 rounded-full flex items-center justify-center text-lg font-bold" style={{ background: 'var(--border)' }}>
                {away.team.name.slice(0, 2)}
              </div>
            )}
            <span className="font-semibold text-center text-sm">{away.team.name}</span>
            {away.winner && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--accent-dark)', color: '#fff' }}>Vencedor</span>}
          </div>
        </div>

        {game.venue && (
          <p className="text-center text-xs mt-4" style={{ color: 'var(--text-muted)' }}>
            📍 {game.venue}
          </p>
        )}
      </div>

      {/* Events Timeline */}
      {plays.length > 0 && (
        <section className="rounded-2xl p-5 mb-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <h2 className="font-semibold mb-4">Eventos da Partida</h2>
          <div className="space-y-2">
            {plays.map((play, i) => {
              const icon = EVENT_ICONS[play.type.id] ?? '📌';
              const player = play.athletesInvolved?.[0]?.displayName ?? '';
              const isHomeTeam = play.team?.id === home.team.id;

              return (
                <div
                  key={i}
                  className={`flex items-center gap-3 text-sm ${isHomeTeam ? 'flex-row' : 'flex-row-reverse'}`}
                >
                  <span className="shrink-0 w-10 text-xs text-center" style={{ color: 'var(--text-muted)' }}>
                    {play.clock}&apos;
                  </span>
                  <span>{icon}</span>
                  <span>{player}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Statistics */}
      {homeStats.length > 0 && (
        <section className="rounded-2xl p-5 mb-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <div className="flex justify-between items-center mb-5">
            <span className="text-sm font-medium" style={{ color: 'var(--accent)' }}>{home.team.shortName}</span>
            <h2 className="font-semibold">Estatísticas</h2>
            <span className="text-sm font-medium" style={{ color: 'var(--live)' }}>{away.team.shortName}</span>
          </div>
          {homeStats.map((stat, i) => {
            const awayStat = awayStats[i];
            return (
              <StatBar
                key={stat.name}
                name={stat.displayValue}
                home={homeStats[i]?.displayValue ?? '0'}
                away={awayStat?.displayValue ?? '0'}
              />
            );
          })}
        </section>
      )}

      {/* Lineups */}
      {(homePlayers.length > 0 || awayPlayers.length > 0) && (
        <section className="rounded-2xl p-5 mb-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <h2 className="font-semibold mb-4">Escalações</h2>
          <div className="grid grid-cols-2 gap-6">
            {/* Home */}
            <div>
              <h3 className="text-sm font-medium mb-3" style={{ color: 'var(--accent)' }}>
                {home.team.name}
              </h3>
              <div className="space-y-1.5">
                {homePlayers.slice(0, 18).map((p: Player, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span
                      className="w-6 h-6 rounded text-xs font-bold flex items-center justify-center shrink-0"
                      style={{ background: 'var(--border)', color: 'var(--text-muted)' }}
                    >
                      {p.athlete?.jersey ?? '-'}
                    </span>
                    <span className={p.starter ? 'text-white' : ''} style={{ color: p.starter ? '#fff' : 'var(--text-muted)' }}>
                      {p.athlete?.shortName ?? p.athlete?.displayName ?? 'Desconhecido'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Away */}
            <div>
              <h3 className="text-sm font-medium mb-3" style={{ color: 'var(--live)' }}>
                {away.team.name}
              </h3>
              <div className="space-y-1.5">
                {awayPlayers.slice(0, 18).map((p: Player, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span
                      className="w-6 h-6 rounded text-xs font-bold flex items-center justify-center shrink-0"
                      style={{ background: 'var(--border)', color: 'var(--text-muted)' }}
                    >
                      {p.athlete?.jersey ?? '-'}
                    </span>
                    <span style={{ color: p.starter ? '#fff' : 'var(--text-muted)' }}>
                      {p.athlete?.shortName ?? p.athlete?.displayName ?? 'Desconhecido'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
