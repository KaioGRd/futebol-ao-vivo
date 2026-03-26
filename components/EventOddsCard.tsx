'use client';

import { useState } from 'react';
import {
  OddsEvent,
  getAvailableMarkets,
  MARKET_CONFIGS,
  formatOutcomeName,
} from '@/lib/odds-api';
import {
  analyzeEvent,
  calcKtoEV,
  formatProb,
  formatEV,
  formatOdds,
  ratingColor,
  BetAnalysis,
  BetRating,
} from '@/lib/probability';

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function TimeBadge({ commenceTime }: { commenceTime: string }) {
  const d = new Date(commenceTime);
  const now = new Date();
  const diffMin = (d.getTime() - now.getTime()) / 60000;

  if (diffMin < -5) return (
    <span className="text-xs px-2 py-0.5 rounded-full font-bold"
      style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}>
      🔴 Em andamento
    </span>
  );
  if (diffMin <= 60) return (
    <span className="text-xs px-2 py-0.5 rounded-full font-bold"
      style={{ background: 'rgba(234,179,8,0.15)', color: '#eab308', border: '1px solid rgba(234,179,8,0.3)' }}>
      ⚡ {Math.max(0, Math.round(diffMin))}min
    </span>
  );
  return (
    <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
      {d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} {d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
    </span>
  );
}

function RatingBadge({ rating, label }: { rating: BetRating; label: string }) {
  const color = ratingColor(rating);
  return (
    <span
      className="text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ background: `${color}22`, color, border: `1px solid ${color}44` }}
    >
      {label}
    </span>
  );
}

function ProbBar({ homeProb, drawProb, awayProb, homeLabel, awayLabel }:
  { homeProb: number; drawProb?: number; awayProb: number; homeLabel: string; awayLabel: string }) {
  const draw = drawProb ?? 0;
  const homePct = homeProb * 100;
  const drawPct = draw * 100;
  const awayPct = awayProb * 100;

  return (
    <div className="mb-3">
      <div className="flex justify-between text-xs mb-1">
        <span className="font-semibold text-white truncate" style={{ maxWidth: 120 }}>{homeLabel}</span>
        {drawProb ? <span style={{ color: 'var(--text-muted)' }}>Empate</span> : null}
        <span className="font-semibold text-white truncate text-right" style={{ maxWidth: 120 }}>{awayLabel}</span>
      </div>
      <div className="flex h-2 rounded-full overflow-hidden gap-0.5">
        <div style={{ width: `${homePct}%`, background: '#3b82f6', borderRadius: '4px 0 0 4px' }} />
        {drawPct > 0 && <div style={{ width: `${drawPct}%`, background: '#94a3b8' }} />}
        <div style={{ width: `${awayPct}%`, background: '#f97316', borderRadius: '0 4px 4px 0' }} />
      </div>
      <div className="flex justify-between text-xs mt-1">
        <span style={{ color: '#3b82f6' }}>{homePct.toFixed(0)}%</span>
        {drawPct > 0 && <span style={{ color: '#94a3b8' }}>{drawPct.toFixed(0)}%</span>}
        <span style={{ color: '#f97316' }}>{awayPct.toFixed(0)}%</span>
      </div>
    </div>
  );
}

function OddsButton({
  bet,
  selected,
  onClick,
}: {
  bet: BetAnalysis;
  selected: boolean;
  onClick: () => void;
}) {
  const color = ratingColor(bet.rating);
  const isValueOrBetter = bet.ev > 0;

  return (
    <button
      onClick={onClick}
      className="flex-1 rounded-lg p-2.5 text-center transition-all duration-150 relative"
      style={{
        background: selected ? `${color}28` : isValueOrBetter ? `${color}10` : 'var(--bg-primary)',
        border: `1.5px solid ${selected ? color : isValueOrBetter ? `${color}55` : 'var(--border)'}`,
        cursor: 'pointer',
        minWidth: 0,
      }}
    >
      {/* Best bookmaker indicator */}
      {bet.bestBookmaker !== 'Consensus' && (
        <div className="text-xs mb-0.5 truncate" style={{ color: 'var(--text-muted)', fontSize: 9 }}>
          {bet.bestBookmaker}
        </div>
      )}
      <div className="font-black text-xl text-white leading-none">{formatOdds(bet.bestOdds)}</div>
      <div className="text-xs mt-1 truncate" style={{ color: 'var(--text-muted)' }}>
        {bet.outcome.length > 12 ? bet.outcome.slice(0, 12) + '…' : bet.outcome}
      </div>
      {/* EV indicator */}
      <div className="mt-1.5">
        <span
          className="text-xs font-bold px-1.5 py-0.5 rounded-full"
          style={{ background: `${color}22`, color, fontSize: 10 }}
        >
          {formatEV(bet.ev)} EV
        </span>
      </div>
      <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)', fontSize: 10 }}>
        {formatProb(bet.modelProb)}
      </div>
    </button>
  );
}

function InsightPanel({ bet }: { bet: BetAnalysis }) {
  const [ktoOdds, setKtoOdds] = useState('');
  const [showKto, setShowKto] = useState(false);
  const color = ratingColor(bet.rating);
  const odds = parseFloat(ktoOdds);
  const ktoResult = !isNaN(odds) && odds > 1 ? calcKtoEV(odds, bet.modelProb) : null;

  return (
    <div className="mt-2 rounded-xl overflow-hidden" style={{ border: `1px solid ${color}44` }}>
      {/* Header resumo */}
      <div className="p-3" style={{ background: `${color}15` }}>
        <div className="flex items-center justify-between mb-1">
          <span className="font-bold text-sm text-white">{bet.outcome}</span>
          <RatingBadge rating={bet.rating} label={bet.label} />
        </div>
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{bet.insight.summary}</p>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-4 divide-x" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border)' }}>
        {[
          { label: 'Melhor Odd', value: formatOdds(bet.bestOdds), sub: bet.bestBookmaker },
          { label: 'EV', value: formatEV(bet.ev), sub: bet.ev >= 0 ? 'valor positivo' : 'sem valor', color: bet.ev >= 0 ? '#22c55e' : '#ef4444' },
          { label: 'Prob. Real', value: formatProb(bet.modelProb), sub: 'justa (sem vig)' },
          { label: 'Kelly 25%', value: bet.kellyFraction > 0 ? `${(bet.kellyFraction * 100).toFixed(1)}%` : '0%', sub: 'da banca' },
        ].map(({ label, value, sub, color: c }) => (
          <div key={label} className="p-2 text-center">
            <div className="font-bold text-sm" style={{ color: c ?? 'white' }}>{value}</div>
            <div className="text-xs" style={{ color: 'var(--text-muted)', fontSize: 10 }}>{label}</div>
            {sub && <div style={{ color: 'var(--text-muted)', fontSize: 9 }} className="truncate">{sub}</div>}
          </div>
        ))}
      </div>

      {/* Tabs de explicação */}
      <InsightTabs bet={bet} />

      {/* KTO Calculator */}
      <div className="p-3" style={{ background: 'var(--bg-card)', borderTop: '1px solid var(--border)' }}>
        <button
          onClick={() => setShowKto(!showKto)}
          className="w-full text-xs font-semibold py-1.5 rounded-lg transition-colors"
          style={{ background: showKto ? 'rgba(34,197,94,0.15)' : 'var(--bg-primary)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)' }}
        >
          🎯 {showKto ? '▲ Fechar' : '▼ Calcular com odds da KTO'}
        </button>

        {showKto && (
          <div className="mt-2">
            <div className="flex gap-2 items-center">
              <input
                type="number"
                placeholder={`Odd KTO (mín ${bet.breakEvenOdds.toFixed(2)} p/ valor)`}
                value={ktoOdds}
                onChange={e => setKtoOdds(e.target.value)}
                step="0.01"
                min="1.01"
                className="flex-1 rounded-lg px-3 py-2 text-sm text-white outline-none"
                style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}
              />
              {ktoResult && (
                <div
                  className="text-sm font-bold px-3 py-2 rounded-lg whitespace-nowrap"
                  style={{
                    background: ktoResult.isValue ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                    color: ktoResult.isValue ? '#22c55e' : '#ef4444',
                    border: `1px solid ${ktoResult.isValue ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                  }}
                >
                  EV {formatEV(ktoResult.ev)}
                </div>
              )}
            </div>
            {ktoResult && (
              <div className="mt-2 text-xs p-2 rounded-lg" style={{ background: 'var(--bg-primary)', color: 'var(--text-secondary)' }}>
                <span className="font-semibold" style={{ color: ratingColor(ktoResult.rating) }}>
                  {ktoResult.label}
                </span>
                {' — '}{ktoResult.tip}
              </div>
            )}
            {!ktoResult && (
              <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
                Odd mínima para EV positivo: <strong className="text-white">{bet.breakEvenOdds.toFixed(2)}</strong>
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

type InsightTab = 'porque' | 'rating' | 'sinal';

function InsightTabs({ bet }: { bet: BetAnalysis }) {
  const [tab, setTab] = useState<InsightTab>('porque');

  const tabs: { id: InsightTab; label: string }[] = [
    { id: 'porque', label: 'Por que este valor?' },
    { id: 'rating', label: bet.label },
    { id: 'sinal', label: 'O que fazer' },
  ];

  const content = {
    porque: bet.insight.reasoning,
    rating: bet.insight.whyRating,
    sinal: bet.insight.signal + '\n\n' + bet.insight.ktoMinOdds,
  };

  return (
    <div style={{ background: 'var(--bg-card)' }}>
      <div className="flex border-b" style={{ borderColor: 'var(--border)' }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="flex-1 text-xs py-2 font-medium transition-colors truncate"
            style={{
              color: tab === t.id ? 'white' : 'var(--text-muted)',
              borderBottom: tab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
              background: 'transparent',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="p-3 text-xs leading-relaxed whitespace-pre-line" style={{ color: 'var(--text-secondary)', minHeight: 70 }}>
        {content[tab]}
      </div>
    </div>
  );
}

// ─── Componente Principal ─────────────────────────────────────────────────────

interface Props {
  event: OddsEvent;
}

export default function EventOddsCard({ event }: Props) {
  const availableMarkets = getAvailableMarkets(event);
  const defaultMarket = availableMarkets[0] ?? 'h2h';
  const [activeMarket, setActiveMarket] = useState(defaultMarket);
  const [selectedBet, setSelectedBet] = useState<BetAnalysis | null>(null);

  const analysis = analyzeEvent(event, activeMarket);
  const hasValue = analysis.hasValueBet;

  const borderColor = hasValue
    ? analysis.bestValueBet?.rating === 'excellent'
      ? 'rgba(249,115,22,0.5)'
      : 'rgba(34,197,94,0.4)'
    : 'var(--border)';

  const marketConfigs = availableMarkets
    .map(k => MARKET_CONFIGS.find(m => m.key === k))
    .filter(Boolean) as typeof MARKET_CONFIGS;

  // Extrai probabilidades para a barra visual
  const homeProb = analysis.outcomes.find(o => o.outcome === event.home_team)?.modelProb
    ?? analysis.outcomes[0]?.modelProb ?? 0.5;
  const drawProb = analysis.outcomes.find(o => o.outcome === 'Draw')?.modelProb;
  const awayProb = analysis.outcomes.find(o => o.outcome === event.away_team)?.modelProb
    ?? analysis.outcomes[analysis.outcomes.length - 1]?.modelProb ?? 0.5;

  const handleMarketChange = (mk: string) => {
    setActiveMarket(mk);
    setSelectedBet(null);
  };

  if (analysis.outcomes.length === 0) return null;

  return (
    <div
      className="rounded-xl overflow-hidden transition-all duration-200"
      style={{ background: 'var(--bg-card)', border: `1px solid ${borderColor}` }}
    >
      {/* ── Cabeçalho ── */}
      <div className="p-4 pb-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-medium shrink-0" style={{ color: 'var(--text-muted)' }}>
              {event.sport_title}
            </span>
            {hasValue && (
              <span
                className="text-xs font-bold px-2 py-0.5 rounded-full shrink-0"
                style={{
                  background: analysis.bestValueBet?.rating === 'excellent'
                    ? 'rgba(249,115,22,0.2)' : 'rgba(34,197,94,0.2)',
                  color: analysis.bestValueBet?.rating === 'excellent' ? '#f97316' : '#22c55e',
                }}
              >
                ✦ VALUE BET
              </span>
            )}
          </div>
          <TimeBadge commenceTime={event.commence_time} />
        </div>

        {/* Times */}
        <div className="flex items-center gap-2 mb-3">
          <span className="font-bold text-sm text-white flex-1 truncate">{event.home_team}</span>
          <span className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>vs</span>
          <span className="font-bold text-sm text-white flex-1 truncate text-right">{event.away_team}</span>
        </div>

        {/* Barra de probabilidade */}
        {activeMarket === 'h2h' && analysis.outcomes.length >= 2 && (
          <ProbBar
            homeProb={homeProb}
            drawProb={drawProb}
            awayProb={awayProb}
            homeLabel={event.home_team}
            awayLabel={event.away_team}
          />
        )}

        {/* Tabs de mercado */}
        {marketConfigs.length > 1 && (
          <div className="flex gap-1.5 mb-3 overflow-x-auto">
            {marketConfigs.map(mc => (
              <button
                key={mc.key}
                onClick={() => handleMarketChange(mc.key)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all"
                style={{
                  background: activeMarket === mc.key ? 'var(--accent-dark)' : 'var(--bg-primary)',
                  color: activeMarket === mc.key ? '#fff' : 'var(--text-muted)',
                  border: `1px solid ${activeMarket === mc.key ? 'var(--accent)' : 'var(--border)'}`,
                }}
              >
                {mc.emoji} {mc.label}
              </button>
            ))}
          </div>
        )}

        {/* Botões de odds */}
        <div className="flex gap-2">
          {analysis.outcomes.map(bet => (
            <OddsButton
              key={bet.outcome}
              bet={bet}
              selected={selectedBet?.outcome === bet.outcome}
              onClick={() => setSelectedBet(selectedBet?.outcome === bet.outcome ? null : bet)}
            />
          ))}
        </div>
      </div>

      {/* ── Painel de Insight (ao clicar) ── */}
      {selectedBet && (
        <div className="px-4 pb-4">
          <InsightPanel bet={selectedBet} />
        </div>
      )}

      {/* ── Rodapé ── */}
      <div
        className="px-4 py-2 flex items-center justify-between text-xs"
        style={{ background: 'var(--bg-primary)', borderTop: '1px solid var(--border)', color: 'var(--text-muted)' }}
      >
        <span>📊 Ref: {analysis.referenceBookmaker}</span>
        <span>Margem: {analysis.bookmakerMargin.toFixed(1)}%</span>
        <span>{event.bookmakers.length} casas</span>
        <span>{availableMarkets.length} mercados</span>
      </div>

      {/* ── Insight geral do mercado ── */}
      {analysis.marketInsight && (
        <div className="px-4 py-2.5 text-xs leading-relaxed" style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}>
          💡 {analysis.marketInsight}
        </div>
      )}
    </div>
  );
}
