'use client';

import { useEffect, useState, useCallback } from 'react';
import GameCard from './GameCard';
import { Game, League } from '@/lib/types';

interface Props {
  initialGames: Game[];
  leagues: League[];
  autoRefresh?: boolean;
  dateParam?: string;
  filterState?: 'all' | 'in' | 'pre' | 'post';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseGames(events: any[], league: League): Game[] {
  return events
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((event: any) => {
      const competition = event.competitions?.[0];
      if (!competition) return null;
      const competitors = competition.competitors ?? [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const home = competitors.find((c: any) => c.homeAway === 'home');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const away = competitors.find((c: any) => c.homeAway === 'away');
      if (!home || !away) return null;
      const status = event.status?.type ?? {};
      return {
        id: event.id,
        league,
        name: event.name ?? '',
        date: event.date ?? competition.date ?? '',
        status: {
          state: status.state ?? 'pre',
          completed: status.completed ?? false,
          description: status.description ?? '',
          detail: status.detail ?? status.shortDetail ?? '',
          clock: event.status?.displayClock,
          period: event.status?.period,
        },
        home: {
          team: {
            id: home.team?.id ?? '',
            name: home.team?.displayName ?? '',
            shortName: home.team?.shortDisplayName ?? home.team?.abbreviation ?? '',
            logo: home.team?.logo ?? '',
          },
          score: home.score ?? '-',
          homeAway: 'home' as const,
          winner: home.winner,
        },
        away: {
          team: {
            id: away.team?.id ?? '',
            name: away.team?.displayName ?? '',
            shortName: away.team?.shortDisplayName ?? away.team?.abbreviation ?? '',
            logo: away.team?.logo ?? '',
          },
          score: away.score ?? '-',
          homeAway: 'away' as const,
          winner: away.winner,
        },
        venue: competition.venue?.fullName,
      } as Game;
    })
    .filter(Boolean) as Game[];
}

export default function GamesGrid({ initialGames, leagues, autoRefresh = false, dateParam, filterState = 'all' }: Props) {
  const [games, setGames] = useState<Game[]>(initialGames);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [selectedLeague, setSelectedLeague] = useState<string>('all');

  const refresh = useCallback(async () => {
    try {
      const today = dateParam ?? new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const results = await Promise.all(
        leagues.map(async (league) => {
          const res = await fetch(`/api/scoreboard/${league.slug}?dates=${today}`);
          if (!res.ok) return [];
          const data = await res.json();
          return parseGames(data.events ?? [], league);
        })
      );
      const all = results.flat().sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      setGames(all);
      setLastUpdated(new Date());
    } catch {
      // silently fail
    }
  }, [leagues, dateParam]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, refresh]);

  const leaguesWithGames = leagues.filter(l => games.some(g => g.league.slug === l.slug));

  let filtered = filterState === 'all' ? games : games.filter(g => g.status.state === filterState);
  if (selectedLeague !== 'all') filtered = filtered.filter(g => g.league.slug === selectedLeague);

  const live = filtered.filter(g => g.status.state === 'in');
  const upcoming = filtered.filter(g => g.status.state === 'pre');
  const finished = filtered.filter(g => g.status.state === 'post');

  return (
    <div>
      {/* League filter */}
      {leaguesWithGames.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2 mb-6">
          <button
            onClick={() => setSelectedLeague('all')}
            className="px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors shrink-0"
            style={{
              background: selectedLeague === 'all' ? 'var(--accent-dark)' : 'var(--bg-card)',
              color: selectedLeague === 'all' ? '#fff' : 'var(--text-secondary)',
              border: '1px solid var(--border)',
            }}
          >
            Todas
          </button>
          {leaguesWithGames.map(l => (
            <button
              key={l.slug}
              onClick={() => setSelectedLeague(l.slug)}
              className="px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors shrink-0"
              style={{
                background: selectedLeague === l.slug ? 'var(--accent-dark)' : 'var(--bg-card)',
                color: selectedLeague === l.slug ? '#fff' : 'var(--text-secondary)',
                border: '1px solid var(--border)',
              }}
            >
              {l.flag} {l.name}
            </button>
          ))}
        </div>
      )}

      {autoRefresh && (
        <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
          Atualizado às {lastUpdated.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} • auto-refresh a cada 30s
        </p>
      )}

      {filtered.length === 0 && (
        <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
          <p className="text-4xl mb-4">⚽</p>
          <p className="text-lg">Nenhum jogo encontrado</p>
        </div>
      )}

      {live.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-bold uppercase mb-3 flex items-center gap-2" style={{ color: 'var(--live)' }}>
            <span className="live-dot w-2 h-2 rounded-full inline-block" style={{ background: 'var(--live)' }} />
            Ao Vivo ({live.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {live.map(g => <GameCard key={g.id} game={g} />)}
          </div>
        </section>
      )}

      {upcoming.length > 0 && filterState !== 'in' && (
        <section className="mb-8">
          <h2 className="text-sm font-bold uppercase mb-3" style={{ color: 'var(--accent)' }}>
            Em Breve ({upcoming.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {upcoming.map(g => <GameCard key={g.id} game={g} />)}
          </div>
        </section>
      )}

      {finished.length > 0 && filterState !== 'in' && (
        <section className="mb-8">
          <h2 className="text-sm font-bold uppercase mb-3" style={{ color: 'var(--text-muted)' }}>
            Encerrados ({finished.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {finished.map(g => <GameCard key={g.id} game={g} />)}
          </div>
        </section>
      )}
    </div>
  );
}
