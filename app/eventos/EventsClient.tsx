'use client';

import { useState, useEffect, useCallback } from 'react';
import { OddsEvent, SPORT_CATEGORIES } from '@/lib/odds-api';
import { analyzeEvent } from '@/lib/probability';
import EventOddsCard from '@/components/EventOddsCard';

type FilterType = 'all' | 'value' | 'excellent' | 'upcoming' | 'live';
type SortType = 'time' | 'ev' | 'odds';

// Calcula o melhor EV disponível em qualquer mercado do evento
function scoreEvent(event: OddsEvent) {
  let bestEV = -Infinity;
  let hasValue = false;
  let maxOdds = 0;

  // Analisa todos os mercados disponíveis
  const marketKeys = new Set<string>();
  for (const bk of event.bookmakers) {
    for (const mk of bk.markets) marketKeys.add(mk.key);
  }

  for (const mk of marketKeys) {
    const analysis = analyzeEvent(event, mk);
    for (const o of analysis.outcomes) {
      if (o.ev > bestEV) bestEV = o.ev;
      if (o.ev > 0) hasValue = true;
      if (o.bestOdds > maxOdds) maxOdds = o.bestOdds;
    }
  }

  return { ev: bestEV === -Infinity ? -1 : bestEV, hasValue, maxOdds };
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
      if (res.ok) setEvents(await res.json());
    } catch { /* keep existing */ }
    finally { setLoading(false); }
  }, [apiConfigured]);

  useEffect(() => { fetchEvents(activeCategory); }, [activeCategory, fetchEvents]);

  const now = new Date();
  const scored = events.map(e => ({ event: e, ...scoreEvent(e) }));

  const filtered = scored.filter(({ event, hasValue, ev }) => {
    const start = new Date(event.commence_time);
    const diffMin = (start.getTime() - now.getTime()) / 60000;
    const q = search.toLowerCase();
    const matchesSearch = !q
      || event.home_team.toLowerCase().includes(q)
      || event.away_team.toLowerCase().includes(q)
      || event.sport_title.toLowerCase().includes(q);

    if (!matchesSearch) return false;
    switch (filter) {
      case 'value':     return hasValue;
      case 'excellent': return ev >= 0.04;
      case 'upcoming':  return diffMin > 0 && diffMin < 180;
      case 'live':      return diffMin < 0;
      default:          return true;
    }
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sort === 'ev')   return b.ev - a.ev;
    if (sort === 'odds') return b.maxOdds - a.maxOdds;
    return new Date(a.event.commence_time).getTime() - new Date(b.event.commence_time).getTime();
  });

  const counts = {
    all:       scored.length,
    value:     scored.filter(e => e.hasValue).length,
    excellent: scored.filter(e => e.ev >= 0.04).length,
    upcoming:  scored.filter(e => { const d = (new Date(e.event.commence_time).getTime() - now.getTime()) / 60000; return d > 0 && d < 180; }).length,
    live:      scored.filter(e => (new Date(e.event.commence_time).getTime() - now.getTime()) / 60000 < 0).length,
  };

  return (
    <div>
      {/* ── Sport Tabs ── */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-5">
        {SPORT_CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all shrink-0"
            style={{
              background: activeCategory === cat.id ? 'var(--accent-dark)' : 'var(--bg-card)',
              color: activeCategory === cat.id ? '#fff' : 'var(--text-secondary)',
              border: `1px solid ${activeCategory === cat.id ? 'var(--accent)' : 'var(--border)'}`,
            }}
          >
            {cat.emoji} <span className="hidden sm:inline">{cat.label}</span>
          </button>
        ))}
      </div>

      {/* ── Filtros + Sort ── */}
      <div className="flex flex-wrap gap-2 items-center mb-4">
        {([
          { id: 'all', label: 'Todos', color: undefined },
          { id: 'value', label: '🔥 Value Bets', color: '#22c55e' },
          { id: 'excellent', label: '⭐ Excelentes', color: '#f97316' },
          { id: 'upcoming', label: '⚡ Próx. 3h', color: '#eab308' },
          ...(counts.live > 0 ? [{ id: 'live', label: '🔴 Ao Vivo', color: '#ef4444' }] : []),
        ] as { id: FilterType; label: string; color?: string }[]).map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap"
            style={{
              background: filter === f.id ? (f.color ?? 'var(--accent-dark)') : 'var(--bg-card)',
              color: filter === f.id ? '#fff' : 'var(--text-muted)',
              border: `1px solid ${filter === f.id ? (f.color ?? 'var(--accent)') : 'var(--border)'}`,
            }}
          >
            {f.label}
            <span className="ml-1 px-1 rounded-full text-xs"
              style={{ background: 'rgba(0,0,0,0.2)', color: 'inherit' }}>
              {counts[f.id]}
            </span>
          </button>
        ))}

        <div className="flex-1" />

        <select
          value={sort}
          onChange={e => setSort(e.target.value as SortType)}
          className="rounded-lg px-3 py-1.5 text-xs font-medium outline-none"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
        >
          <option value="time">Por Horário</option>
          <option value="ev">Maior EV</option>
          <option value="odds">Maior Odd</option>
        </select>
      </div>

      {/* ── Search ── */}
      <div className="relative mb-5">
        <input
          type="text"
          placeholder="🔍 Buscar time, competição..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full rounded-xl px-4 py-2.5 text-sm outline-none"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
        />
      </div>

      {/* ── Stats ── */}
      {!loading && events.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="rounded-xl p-3 text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div className="text-2xl font-black text-white">{counts.all}</div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Eventos</div>
          </div>
          <div className="rounded-xl p-3 text-center" style={{ background: 'var(--bg-card)', border: '1px solid rgba(34,197,94,0.3)' }}>
            <div className="text-2xl font-black" style={{ color: '#22c55e' }}>{counts.value}</div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Value Bets</div>
          </div>
          <div className="rounded-xl p-3 text-center" style={{ background: 'var(--bg-card)', border: '1px solid rgba(249,115,22,0.3)' }}>
            <div className="text-2xl font-black" style={{ color: '#f97316' }}>{counts.excellent}</div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Excelentes</div>
          </div>
        </div>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
          <div className="text-3xl mb-3 animate-pulse">📡</div>
          <p className="text-sm">Buscando eventos e odds em tempo real...</p>
        </div>
      )}

      {/* ── Grid ── */}
      {!loading && sorted.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {sorted.map(({ event }) => (
            <EventOddsCard key={event.id} event={event} />
          ))}
        </div>
      )}

      {/* ── Empty ── */}
      {!loading && sorted.length === 0 && (
        <div className="rounded-xl p-10 text-center" style={{ background: 'var(--bg-card)', border: '1px dashed var(--border)' }}>
          {!apiConfigured ? (
            <>
              <div className="text-4xl mb-4">🔑</div>
              <h3 className="font-bold text-lg mb-3 text-white">API Key Necessária</h3>
              <div className="rounded-lg p-4 text-left text-sm mb-4 max-w-md mx-auto" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}>
                <ol className="space-y-1.5" style={{ color: 'var(--text-secondary)' }}>
                  <li>1. Acesse <strong className="text-white">the-odds-api.com</strong> e crie conta gratuita</li>
                  <li>2. Copie sua API Key</li>
                  <li>3. Crie <code className="text-green-400">.env.local</code> na raiz do projeto</li>
                  <li>4. Adicione: <code className="text-green-400">ODDS_API_KEY=sua_chave</code></li>
                  <li>5. Reinicie: <code className="text-green-400">npm run dev</code></li>
                </ol>
              </div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Plano gratuito: 500 req/mês</p>
            </>
          ) : (
            <>
              <div className="text-3xl mb-2">📭</div>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Nenhum evento encontrado para este filtro ou esporte.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
