import Link from 'next/link';
import Image from 'next/image';
import { Game } from '@/lib/types';

function TeamLogo({ src, name }: { src: string; name: string }) {
  if (!src) {
    return (
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
        style={{ background: 'var(--border)', color: 'var(--text-secondary)' }}
      >
        {name.slice(0, 2).toUpperCase()}
      </div>
    );
  }
  return (
    <Image
      src={src}
      alt={name}
      width={40}
      height={40}
      className="object-contain shrink-0"
    />
  );
}

function LiveBadge({ detail }: { detail: string }) {
  return (
    <span
      className="live-badge flex items-center gap-1.5 text-xs font-bold px-2 py-0.5 rounded-full"
      style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--live)', border: '1px solid rgba(239,68,68,0.3)' }}
    >
      <span className="live-dot w-1.5 h-1.5 rounded-full inline-block" style={{ background: 'var(--live)' }} />
      {detail || 'AO VIVO'}
    </span>
  );
}

function StatusBadge({ state, detail }: { state: string; detail: string }) {
  if (state === 'in') return <LiveBadge detail={detail} />;
  if (state === 'post') {
    return (
      <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: 'var(--border)', color: 'var(--text-muted)' }}>
        Encerrado
      </span>
    );
  }
  return (
    <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
      {new Date(detail).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
    </span>
  );
}

export default function GameCard({ game }: { game: Game }) {
  const { home, away, status, league, date } = game;
  const isLive = status.state === 'in';
  const isPre = status.state === 'pre';

  return (
    <Link
      href={`/partida/${league.slug}/${game.id}`}
      className="block rounded-xl p-4 transition-all duration-200 hover:scale-[1.01]"
      style={{
        background: 'var(--bg-card)',
        border: `1px solid ${isLive ? 'rgba(239,68,68,0.3)' : 'var(--border)'}`,
      }}
    >
      {/* League + Status Row */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
          {league.flag} {league.name}
        </span>
        {isLive ? (
          <LiveBadge detail={status.detail} />
        ) : isPre ? (
          <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
            {new Date(date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </span>
        ) : (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: 'var(--border)', color: 'var(--text-muted)' }}>
            Encerrado
          </span>
        )}
      </div>

      {/* Teams + Score Row */}
      <div className="flex items-center gap-3">
        {/* Home Team */}
        <div className="flex-1 flex flex-col items-end gap-1.5">
          <TeamLogo src={home.team.logo} name={home.team.name} />
          <span className="text-sm font-medium text-right leading-tight" style={{ color: home.winner ? '#fff' : 'var(--text-secondary)' }}>
            {home.team.shortName || home.team.name}
          </span>
        </div>

        {/* Score */}
        <div className="flex flex-col items-center shrink-0">
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
            style={{ background: 'var(--bg-primary)', minWidth: 72, justifyContent: 'center' }}
          >
            {isPre ? (
              <span className="text-base font-bold" style={{ color: 'var(--text-muted)' }}>vs</span>
            ) : (
              <>
                <span className={`text-xl font-bold ${home.winner ? 'text-white' : ''}`} style={{ color: home.winner ? '#fff' : 'var(--text-secondary)' }}>
                  {home.score}
                </span>
                <span style={{ color: 'var(--text-muted)' }}>-</span>
                <span className="text-xl font-bold" style={{ color: away.winner ? '#fff' : 'var(--text-secondary)' }}>
                  {away.score}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Away Team */}
        <div className="flex-1 flex flex-col items-start gap-1.5">
          <TeamLogo src={away.team.logo} name={away.team.name} />
          <span className="text-sm font-medium leading-tight" style={{ color: away.winner ? '#fff' : 'var(--text-secondary)' }}>
            {away.team.shortName || away.team.name}
          </span>
        </div>
      </div>

      {/* Venue */}
      {game.venue && (
        <p className="text-xs text-center mt-2" style={{ color: 'var(--text-muted)' }}>
          📍 {game.venue}
        </p>
      )}
    </Link>
  );
}
