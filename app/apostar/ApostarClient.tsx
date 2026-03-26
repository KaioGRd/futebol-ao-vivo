'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { InPlayAnalysis } from '@/lib/inplay';
import LiveBetCard from '@/components/LiveBetCard';

type Tab = 'agora' | 'geral';
type SportFilter = 'todos' | string;

const SPORT_FILTERS = [
  { id: 'todos', label: '🌐 Todos' },
  { id: 'basketball_nba', label: '🏀 NBA' },
  { id: 'basketball_ncaab', label: '🏀 NCAA' },
  { id: 'basketball_wnba', label: '🏀 WNBA' },
  { id: 'americanfootball_nfl', label: '🏈 NFL' },
  { id: 'baseball_mlb', label: '⚾ MLB' },
  { id: 'icehockey_nhl', label: '🏒 NHL' },
  { id: 'mma_mixed_martial_arts', label: '🥊 MMA' },
  { id: 'soccer', label: '⚽ Futebol' },
];

const POLL_INTERVAL_MS = 30_000; // 30s

export default function ApostarClient() {
  const [tab, setTab] = useState<Tab>('agora');
  const [sport, setSport] = useState<SportFilter>('todos');
  const [analyses, setAnalyses] = useState<InPlayAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ live: 'true' });
      if (sport !== 'todos') params.set('category', sport);

      const res = await fetch(`/api/live?${params.toString()}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`API error: ${res.status}`);

      const data: InPlayAnalysis[] = await res.json();
      setAnalyses(data);
      setLastUpdated(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao buscar dados');
    } finally {
      setLoading(false);
    }
  }, [sport]);

  // Busca inicial + ao trocar esporte
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Polling em background
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => fetchData(true), POLL_INTERVAL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fetchData]);

  // Filtragem por sport
  const filtered = sport === 'todos'
    ? analyses
    : analyses.filter(a => a.game.leagueKey.startsWith(sport.split('_')[0]));

  // Para aba "agora": só os jogos com pelo menos 1 recomendação urgente
  const agoraGames = filtered.filter(a =>
    a.recommendations.some(r => r.urgency === 'agora' || (r.urgency === 'observar' && r.confidence >= 0.60))
  );

  const visibleAnalyses = tab === 'agora' ? agoraGames : filtered;

  // Stats
  const totalLive = filtered.filter(a => a.game.isLive).length;
  const totalAgora = agoraGames.length;

  return (
    <div>
      {/* ── Tabs ── */}
      <div
        className="flex rounded-xl overflow-hidden mb-4"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', padding: '4px' }}
      >
        <TabButton
          active={tab === 'agora'}
          onClick={() => setTab('agora')}
          label="🔥 Apostar Agora"
          count={totalAgora}
          countColor="#f97316"
          description="Confiança ≥65% · EV positivo"
        />
        <TabButton
          active={tab === 'geral'}
          onClick={() => setTab('geral')}
          label="📊 Apostas Geral"
          count={totalLive}
          countColor="#22c55e"
          description="Todos os jogos ao vivo"
        />
      </div>

      {/* ── Sport Filters ── */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
        {SPORT_FILTERS.map(f => (
          <button
            key={f.id}
            onClick={() => setSport(f.id)}
            className="px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors shrink-0"
            style={{
              background: sport === f.id ? 'var(--accent)' : 'var(--bg-card)',
              color: sport === f.id ? '#fff' : 'var(--text-secondary)',
              border: `1px solid ${sport === f.id ? 'var(--accent)' : 'var(--border)'}`,
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* ── Status bar ── */}
      <div className="flex items-center justify-between mb-4 text-xs" style={{ color: 'var(--text-muted)' }}>
        <span>
          {loading ? (
            <span className="animate-pulse">Carregando dados ao vivo...</span>
          ) : (
            <>
              <span className="font-semibold text-white">{visibleAnalyses.length}</span> jogos
              {tab === 'agora' && (
                <> · <span style={{ color: '#f97316' }} className="font-semibold">{totalAgora}</span> com oportunidade</>
              )}
            </>
          )}
        </span>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span>
              Atualizado: {lastUpdated.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
          <button
            onClick={() => fetchData()}
            className="px-2 py-1 rounded-md text-xs font-semibold transition-colors"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
          >
            ↺ Atualizar
          </button>
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div
          className="rounded-xl p-4 mb-4 text-sm"
          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444' }}
        >
          ⚠️ {error}
        </div>
      )}

      {/* ── Loading skeleton ── */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div
              key={i}
              className="rounded-xl h-40 animate-pulse"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
            />
          ))}
        </div>
      )}

      {/* ── Content ── */}
      {!loading && visibleAnalyses.length === 0 && (
        <EmptyState tab={tab} />
      )}

      {!loading && visibleAnalyses.length > 0 && (
        <div className="space-y-4">
          {tab === 'agora' ? (
            // Aba "Apostar Agora" — só recomendações de alta confiança
            visibleAnalyses.map(a => (
              <LiveBetCard key={a.game.id} analysis={a} mode="agora" />
            ))
          ) : (
            // Aba "Apostas Geral" — todos os jogos com análise completa
            <>
              {/* Jogos ao vivo primeiro */}
              {visibleAnalyses.filter(a => a.game.isLive).length > 0 && (
                <SectionHeader label="🔴 Ao Vivo Agora" />
              )}
              {visibleAnalyses.filter(a => a.game.isLive).map(a => (
                <LiveBetCard key={a.game.id} analysis={a} mode="geral" />
              ))}

              {/* Jogos próximos */}
              {visibleAnalyses.filter(a => !a.game.isLive && !a.game.isCompleted).length > 0 && (
                <>
                  <SectionHeader label="🕐 Próximos Jogos" />
                  {visibleAnalyses.filter(a => !a.game.isLive && !a.game.isCompleted).map(a => (
                    <LiveBetCard key={a.game.id} analysis={a} mode="geral" />
                  ))}
                </>
              )}

              {/* Jogos encerrados (se existirem) */}
              {visibleAnalyses.filter(a => a.game.isCompleted).length > 0 && (
                <>
                  <SectionHeader label="✅ Encerrados" />
                  {visibleAnalyses.filter(a => a.game.isCompleted).map(a => (
                    <LiveBetCard key={a.game.id} analysis={a} mode="geral" />
                  ))}
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Rodapé KTO ── */}
      <div
        className="mt-8 rounded-xl p-4 text-center text-xs"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
      >
        <p className="font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
          Abra as odds ao vivo da KTO em paralelo
        </p>
        <a
          href="https://www.kto.bet.br/ao-vivo"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm mt-1"
          style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)' }}
        >
          🎰 Abrir KTO Ao Vivo
        </a>
        <p className="mt-2" style={{ color: 'var(--text-muted)' }}>
          Compare as odds da KTO com as odds mínimas indicadas pelo modelo e use o calculador de EV em cada aposta.
        </p>
      </div>
    </div>
  );
}

// ─── Sub-componentes ───────────────────────────────────────────────────────────

function TabButton({
  active,
  onClick,
  label,
  count,
  countColor,
  description,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  countColor: string;
  description: string;
}) {
  return (
    <button
      onClick={onClick}
      className="flex-1 rounded-lg px-4 py-3 text-left transition-all"
      style={{
        background: active ? 'var(--accent-dark)' : 'transparent',
        border: active ? '1px solid var(--accent)' : '1px solid transparent',
      }}
    >
      <div className="flex items-center gap-2">
        <span className="font-bold text-sm text-white">{label}</span>
        <span
          className="text-xs font-black px-1.5 py-0.5 rounded-full"
          style={{ background: active ? countColor : 'var(--bg-primary)', color: active ? '#fff' : countColor }}
        >
          {count}
        </span>
      </div>
      <p className="text-xs mt-0.5" style={{ color: active ? 'rgba(255,255,255,0.6)' : 'var(--text-muted)' }}>
        {description}
      </p>
    </button>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 mt-2 mb-1">
      <span className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
    </div>
  );
}

function EmptyState({ tab }: { tab: Tab }) {
  return (
    <div
      className="rounded-xl p-8 text-center"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
    >
      <p className="text-4xl mb-3">{tab === 'agora' ? '🔍' : '📭'}</p>
      <p className="font-semibold text-white mb-1">
        {tab === 'agora'
          ? 'Nenhuma aposta de alta confiança no momento'
          : 'Nenhum jogo encontrado'}
      </p>
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        {tab === 'agora'
          ? 'O modelo não encontrou apostas com confiança ≥65% e EV positivo agora. Tente a aba "Apostas Geral" para ver todos os jogos.'
          : 'Verifique a conexão ou tente outro filtro de esporte.'}
      </p>
    </div>
  );
}
