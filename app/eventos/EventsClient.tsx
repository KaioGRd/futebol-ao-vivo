'use client';

import { useState, useEffect, useCallback } from 'react';
import { OddsEvent, SPORT_CATEGORIES, getBestBookmakerOdds, getConsensusOdds } from '@/lib/odds-api';
import { analyzeEvent } from '@/lib/probability';
import EventOddsCard from '@/components/EventOddsCard';

type FilterType = 'all' | 'value' | 'excellent' | 'upcoming' | 'live';
type SortType = 'time' | 'ev' | 'odds' | 'prob';

function SportTab({
  cat,
  active,
  onClick,
}: {
  cat: { id: string; label: string; emoji: string };
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all"
      style={{
        background: active ? 'var(--accent-dark)' : 'var(--bg-card)',
        color: active ? '#fff' : 'var(--text-secondary)',
        border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
      }}
    >
      <span>{cat.emoji}</span>
      <span className="hidden sm:block">{cat.label}</span>
    </button>
  );
}

function FilterChip({
  label,
  active,
  count,
  color,
  onClick,
}: {
  label: string;
  active: boolean;
  count?: number;
  color?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap"
      style={{
        background: active
          ? color ?? 'var(--accent-dark)'
          : 'var(--bg-card)',
        color: active ? '#fff' : 'var(--text-muted)',
        border: `1px solid ${active ? color ?? 'var(--accent)' : 'var(--border)'}`,
      }}
    >
      {label}
      {count !== undefined && (
        <span
          className="text-xs px-1.5 py-0.5 rounded-full font-bold"
          style={{
            background: active ? 'rgba(0,0,0,0.2)' : 'var(--border)',
            color: active ? '#fff' : 'var(--text-secondary)',
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function EmptyState({ apiConfigured }: { apiConfigured: boolean }) {
  if (!apiConfigured) {
    return (
      <div className="rounded-xl p-8 text-center" style={{ background: 'var(--bg-card)', border: '1px dashed var(--border)' }}>
        <div className="text-4xl mb-4">🔑</div>
        <h3 className="font-bold text-lg mb-2 text-white">API Key Necessária</h3>
        <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
          Para ver odds e análises, você precisa de uma API Key gratuita.
        </p>
        <div className="rounded-lg p-4 text-left text-sm mb-4" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}>
          <p className="font-semibold text-white mb-2">Como configurar:</p>
          <ol className="space-y-1.5" style={{ color: 'var(--text-secondary)' }}>
            <li>1. Acesse <strong className="text-white">the-odds-api.com</strong> e crie uma conta gratuita</li>
            <li>2. Copie sua API Key do painel</li>
            <li>3. Crie o arquivo <code className="text-green-400">.env.local</code> na raiz do projeto</li>
            <li>4. Adicione: <code className="text-green-400">ODDS_API_KEY=sua_chave_aqui</code></li>
            <li>5. Reinicie o servidor: <code className="text-green-400">npm run dev</code></li>
          </ol>
        </div>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Plano gratuito: 500 requisições/mês • Sem cartão de crédito
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl p-8 text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      <div className="text-4xl mb-3">📭</div>
      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
        Nenhum evento encontrado para este filtro.
      </p>
    </div>
  );
}

// Score each event for sorting/filtering
function scoreEvent(event: OddsEvent): { ev: number; hasValue: boolean; maxOdds: number } {
  const best = getBestBookmakerOdds(event, 'h2h');
  const consensus = getConsensusOdds(event, 'h2h');
  const prices = consensus ?? best?.outcomes ?? [];

  if (prices.length === 0) return { ev: -1, hasValue: false, maxOdds: 0 };

  const analysis = analyzeEvent(prices);
  const maxEV = Math.max(...analysis.outcomes.map(o => o.ev));
  const maxOdds = Math.max(...prices.map(p => p.price));

  return {
    ev: maxEV,
    hasValue: analysis.hasValueBet,
    maxOdds,
  };
}

interface Props {
  initialEvents: OddsEvent[];
  apiConfigured: boolean;
}

export default function EventsClient({ initialEvents, apiConfigured }: Props) {
  const [activeCategory, setActiveCategory] = useState('futebol');
  const [filter, setFilter] = useState<FilterType>('all');
  const [sort, setSort] = useState<SortType>('time');
  const [search, setSearch] = useState('');
  const [events, setEvents] = useState<OddsEvent[]>(initialEvents);
  const [loading, setLoading] = useState(false);

  const fetchEvents = useCallback(async (category: string) => {
    if (!apiConfigured) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/odds/events?category=${category}`);
      if (res.ok) {
        const data = await res.json();
        setEvents(data);
      }
    } catch {
      // keep existing events
    } finally {
      setLoading(false);
    }
  }, [apiConfigured]);

  useEffect(() => {
    fetchEvents(activeCategory);
  }, [activeCategory, fetchEvents]);

  // Score and filter events
  const scored = events.map(e => ({ event: e, ...scoreEvent(e) }));

  const now = new Date();
  const filtered = scored.filter(({ event, hasValue, ev }) => {
    const start = new Date(event.commence_time);
    const diffMin = (start.getTime() - now.getTime()) / 60000;
    const matchesSearch = !search ||
      event.home_team.toLowerCase().includes(search.toLowerCase()) ||
      event.away_team.toLowerCase().includes(search.toLowerCase()) ||
      event.sport_title.toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;

    switch (filter) {
      case 'value': return hasValue;
      case 'excellent': return ev >= 0.04;
      case 'upcoming': return diffMin > 0 && diffMin < 180; // next 3h
      case 'live': return diffMin < 0;
      default: return true;
    }
  });

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    switch (sort) {
      case 'ev': return b.ev - a.ev;
      case 'odds': return b.maxOdds - a.maxOdds;
      case 'prob':
        return b.ev - a.ev; // same as EV for now
      case 'time':
      default:
        return new Date(a.event.commence_time).getTime() - new Date(b.event.commence_time).getTime();
    }
  });

  // Counts for filter badges
  const counts = {
    all: scored.length,
    value: scored.filter(e => e.hasValue).length,
    excellent: scored.filter(e => e.ev >= 0.04).length,
    upcoming: scored.filter(e => {
      const diff = (new Date(e.event.commence_time).getTime() - now.getTime()) / 60000;
      return diff > 0 && diff < 180;
    }).length,
    live: scored.filter(e => (new Date(e.event.commence_time).getTime() - now.getTime()) / 60000 < 0).length,
  };

  return (
    <div>
      {/* Sport Category Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-hide">
        {SPORT_CATEGORIES.map(cat => (
          <SportTab
            key={cat.id}
            cat={cat}
            active={activeCategory === cat.id}
            onClick={() => setActiveCategory(cat.id)}
          />
        ))}
      </div>

      {/* Filter + Sort Bar */}
      <div className="flex flex-wrap gap-2 mb-4 items-center">
        {/* Filters */}
        <div className="flex gap-1.5 flex-wrap">
          <FilterChip
            label="Todos"
            active={filter === 'all'}
            count={counts.all}
            onClick={() => setFilter('all')}
          />
          <FilterChip
            label="🔥 Value Bets"
            active={filter === 'value'}
            count={counts.value}
            color="#22c55e"
            onClick={() => setFilter('value')}
          />
          <FilterChip
            label="⭐ Excelentes"
            active={filter === 'excellent'}
            count={counts.excellent}
            color="#f97316"
            onClick={() => setFilter('excellent')}
          />
          <FilterChip
            label="⚡ Próximos 3h"
            active={filter === 'upcoming'}
            count={counts.upcoming}
            color="#eab308"
            onClick={() => setFilter('upcoming')}
          />
          {counts.live > 0 && (
            <FilterChip
              label="🔴 Ao Vivo"
              active={filter === 'live'}
              count={counts.live}
              color="#ef4444"
              onClick={() => setFilter('live')}
            />
          )}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Sort */}
        <select
          value={sort}
          onChange={e => setSort(e.target.value as SortType)}
          className="rounded-lg px-3 py-1.5 text-xs font-medium outline-none"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            color: 'var(--text-secondary)',
          }}
        >
          <option value="time">Por Horário</option>
          <option value="ev">Maior EV</option>
          <option value="odds">Maior Odd</option>
        </select>
      </div>

      {/* Search */}
      <div className="mb-5">
        <input
          type="text"
          placeholder="Buscar time, competição..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full rounded-lg px-4 py-2.5 text-sm outline-none"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
          }}
        />
      </div>

      {/* Stats Bar */}
      {events.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div
            className="rounded-xl p-3 text-center"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
          >
            <div className="text-xl font-bold text-white">{counts.all}</div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Eventos</div>
          </div>
          <div
            className="rounded-xl p-3 text-center"
            style={{ background: 'var(--bg-card)', border: '1px solid rgba(34,197,94,0.3)' }}
          >
            <div className="text-xl font-bold" style={{ color: '#22c55e' }}>{counts.value}</div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Value Bets</div>
          </div>
          <div
            className="rounded-xl p-3 text-center"
            style={{ background: 'var(--bg-card)', border: '1px solid rgba(249,115,22,0.3)' }}
          >
            <div className="text-xl font-bold" style={{ color: '#f97316' }}>{counts.excellent}</div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Excelentes</div>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
          <div className="text-2xl mb-2">⏳</div>
          <p className="text-sm">Carregando eventos e odds...</p>
        </div>
      )}

      {/* Events Grid */}
      {!loading && sorted.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sorted.map(({ event }) => (
            <EventOddsCard key={event.id} event={event} />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && sorted.length === 0 && (
        <EmptyState apiConfigured={apiConfigured} />
      )}
    </div>
  );
}
