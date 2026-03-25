'use client';

import { useState } from 'react';
import { OddsEvent, getBestBookmakerOdds, getConsensusOdds } from '@/lib/odds-api';
import {
  analyzeEvent,
  calcKtoEV,
  formatProb,
  formatEV,
  formatOdds,
  ratingColor,
  BetAnalysis,
} from '@/lib/probability';

interface Props {
  event: OddsEvent;
}

function TimeBadge({ commenceTime }: { commenceTime: string }) {
  const d = new Date(commenceTime);
  const now = new Date();
  const diffMin = (d.getTime() - now.getTime()) / 60000;

  if (diffMin < 0) {
    return (
      <span className="text-xs px-2 py-0.5 rounded-full font-medium"
        style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>
        Em andamento
      </span>
    );
  }
  if (diffMin < 60) {
    return (
      <span className="text-xs px-2 py-0.5 rounded-full font-medium"
        style={{ background: 'rgba(234,179,8,0.15)', color: '#eab308' }}>
        {Math.round(diffMin)}min
      </span>
    );
  }

  return (
    <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
      {d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} {d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
    </span>
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
  const isValue = bet.ev > 0.01;

  return (
    <button
      onClick={onClick}
      className="flex-1 rounded-lg p-2.5 text-center transition-all duration-150 text-xs"
      style={{
        background: selected
          ? `${color}22`
          : isValue
          ? `${color}11`
          : 'var(--bg-primary)',
        border: `1px solid ${selected ? color : isValue ? `${color}44` : 'var(--border)'}`,
        cursor: 'pointer',
      }}
    >
      <div className="font-bold text-base text-white">{formatOdds(bet.odds)}</div>
      <div className="mt-0.5 truncate" style={{ color: 'var(--text-muted)', maxWidth: 80, margin: '2px auto 0' }}>
        {bet.outcome.length > 10 ? bet.outcome.slice(0, 10) + '…' : bet.outcome}
      </div>
      <div className="mt-1 font-semibold text-xs" style={{ color }}>
        {bet.label.split(' ').slice(1).join(' ')}
      </div>
      <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
        {formatProb(bet.modelProb)} prob
      </div>
    </button>
  );
}

function KtoCalculator({ modelProb, outcomeName }: { modelProb: number; outcomeName: string }) {
  const [ktoOdds, setKtoOdds] = useState('');
  const odds = parseFloat(ktoOdds);
  const valid = !isNaN(odds) && odds > 1;
  const result = valid ? calcKtoEV(odds, modelProb) : null;

  return (
    <div className="mt-3 rounded-lg p-3" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}>
      <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>
        🎯 Calcular KTO — {outcomeName}
      </p>
      <div className="flex gap-2 items-center">
        <input
          type="number"
          placeholder="Odd KTO (ex: 1.85)"
          value={ktoOdds}
          onChange={e => setKtoOdds(e.target.value)}
          step="0.01"
          min="1.01"
          className="flex-1 rounded px-3 py-1.5 text-sm text-white outline-none"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
          }}
        />
        {result && (
          <div
            className="text-sm font-bold px-3 py-1.5 rounded"
            style={{
              background: result.isValue ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
              color: result.isValue ? '#22c55e' : '#ef4444',
              border: `1px solid ${result.isValue ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
              whiteSpace: 'nowrap',
            }}
          >
            EV {formatEV(result.ev)}
          </div>
        )}
      </div>
      {result && (
        <div className="mt-2 flex gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
          <span>{result.label}</span>
          {result.kellyFraction > 0 && (
            <span>Kelly: {(result.kellyFraction * 100).toFixed(1)}% da banca</span>
          )}
        </div>
      )}
    </div>
  );
}

export default function EventOddsCard({ event }: Props) {
  const [selectedBet, setSelectedBet] = useState<BetAnalysis | null>(null);
  const [showKto, setShowKto] = useState(false);

  // Get best available odds (Pinnacle preferred)
  const best = getBestBookmakerOdds(event, 'h2h');
  const consensus = getConsensusOdds(event, 'h2h');

  // Use consensus for reference, but show individual bookmaker odds too
  const referencePrices = consensus ?? best?.outcomes ?? [];

  if (referencePrices.length === 0) return null;

  const analysis = analyzeEvent(referencePrices, undefined, best?.bookmaker ?? 'Mercado');
  const hasValue = analysis.hasValueBet;
  const borderColor = hasValue
    ? analysis.bestValueBet?.rating === 'excellent'
      ? 'rgba(249,115,22,0.4)'
      : 'rgba(34,197,94,0.3)'
    : 'var(--border)';

  return (
    <div
      className="rounded-xl p-4 transition-all duration-200"
      style={{
        background: 'var(--bg-card)',
        border: `1px solid ${borderColor}`,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-medium shrink-0" style={{ color: 'var(--text-muted)' }}>
            {event.sport_title}
          </span>
          {hasValue && (
            <span
              className="text-xs font-bold px-2 py-0.5 rounded-full shrink-0"
              style={{
                background: analysis.bestValueBet?.rating === 'excellent'
                  ? 'rgba(249,115,22,0.15)'
                  : 'rgba(34,197,94,0.15)',
                color: analysis.bestValueBet?.rating === 'excellent' ? '#f97316' : '#22c55e',
              }}
            >
              VALUE BET
            </span>
          )}
        </div>
        <TimeBadge commenceTime={event.commence_time} />
      </div>

      {/* Teams */}
      <div className="mb-3">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-sm text-white truncate flex-1">
            {event.home_team}
          </span>
          <span className="text-xs mx-2 shrink-0" style={{ color: 'var(--text-muted)' }}>vs</span>
          <span className="font-semibold text-sm text-white truncate flex-1 text-right">
            {event.away_team}
          </span>
        </div>
      </div>

      {/* Odds Buttons */}
      <div className="flex gap-2 mb-3">
        {analysis.outcomes.map((bet) => (
          <OddsButton
            key={bet.outcome}
            bet={bet}
            selected={selectedBet?.outcome === bet.outcome}
            onClick={() => {
              setSelectedBet(selectedBet?.outcome === bet.outcome ? null : bet);
              setShowKto(false);
            }}
          />
        ))}
      </div>

      {/* Selected Bet Detail */}
      {selectedBet && (
        <div
          className="rounded-lg p-3 mb-2"
          style={{
            background: 'var(--bg-primary)',
            border: `1px solid ${ratingColor(selectedBet.rating)}44`,
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-sm text-white">{selectedBet.outcome}</span>
            <span
              className="text-xs font-bold px-2 py-0.5 rounded-full"
              style={{
                background: `${ratingColor(selectedBet.rating)}22`,
                color: ratingColor(selectedBet.rating),
              }}
            >
              {selectedBet.label}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs text-center">
            <div>
              <div className="font-bold text-white text-base">{formatOdds(selectedBet.odds)}</div>
              <div style={{ color: 'var(--text-muted)' }}>Odd</div>
            </div>
            <div>
              <div
                className="font-bold text-base"
                style={{ color: selectedBet.ev >= 0 ? '#22c55e' : '#ef4444' }}
              >
                {formatEV(selectedBet.ev)}
              </div>
              <div style={{ color: 'var(--text-muted)' }}>EV</div>
            </div>
            <div>
              <div className="font-bold text-white text-base">
                {formatProb(selectedBet.modelProb)}
              </div>
              <div style={{ color: 'var(--text-muted)' }}>Prob. Modelo</div>
            </div>
          </div>

          <div className="mt-2 pt-2 flex justify-between text-xs" style={{ borderTop: '1px solid var(--border)', color: 'var(--text-muted)' }}>
            <span>Prob. Implícita: {formatProb(selectedBet.impliedProb)}</span>
            <span>Prob. Justa: {formatProb(selectedBet.fairProb)}</span>
            {selectedBet.kellyFraction > 0 && (
              <span>Kelly: {(selectedBet.kellyFraction * 100).toFixed(1)}%</span>
            )}
          </div>

          {/* KTO Calculator toggle */}
          <button
            onClick={() => setShowKto(!showKto)}
            className="mt-2 text-xs font-medium w-full text-center py-1 rounded transition-colors"
            style={{ color: 'var(--accent)', background: 'rgba(34,197,94,0.08)' }}
          >
            {showKto ? '▲ Fechar Calc. KTO' : '▼ Calcular com odds da KTO'}
          </button>

          {showKto && (
            <KtoCalculator
              modelProb={selectedBet.modelProb}
              outcomeName={selectedBet.outcome}
            />
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
        <span>Ref: {analysis.sharpestBookmaker}</span>
        <span>Margem: {analysis.bookmakerMargin.toFixed(1)}%</span>
        <span>{event.bookmakers.length} casas</span>
      </div>
    </div>
  );
}
