'use client';

import { useState } from 'react';
import { InPlayAnalysis, BetRecommendation, BetUrgency } from '@/lib/inplay';
import { calcKtoEV, formatEV, formatOdds, ratingColor } from '@/lib/probability';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function urgencyStyle(urgency: BetUrgency): { bg: string; color: string; border: string; label: string } {
  switch (urgency) {
    case 'agora': return { bg: 'rgba(249,115,22,0.15)', color: '#f97316', border: 'rgba(249,115,22,0.5)', label: '🔥 APOSTAR AGORA' };
    case 'observar': return { bg: 'rgba(234,179,8,0.15)', color: '#eab308', border: 'rgba(234,179,8,0.4)', label: '👁 OBSERVAR' };
    case 'evitar': return { bg: 'rgba(100,116,139,0.1)', color: '#94a3b8', border: 'rgba(100,116,139,0.3)', label: 'SEM APOSTA' };
  }
}

function ConfidenceRing({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 70 ? '#f97316' : pct >= 60 ? '#22c55e' : pct >= 50 ? '#eab308' : '#94a3b8';
  const r = 22;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;

  return (
    <div className="relative flex items-center justify-center" style={{ width: 60, height: 60 }}>
      <svg width="60" height="60" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="30" cy="30" r={r} fill="none" stroke="var(--border)" strokeWidth="4" />
        <circle
          cx="30" cy="30" r={r} fill="none" stroke={color} strokeWidth="4"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        />
      </svg>
      <div className="absolute text-center">
        <div className="font-black text-sm" style={{ color }}>{pct}%</div>
      </div>
    </div>
  );
}

function RecommendationRow({
  rec,
  isTop,
}: {
  rec: BetRecommendation;
  isTop: boolean;
}) {
  const [expanded, setExpanded] = useState(isTop);
  const [ktoInput, setKtoInput] = useState('');
  const urg = urgencyStyle(rec.urgency);
  const ktoOdds = parseFloat(ktoInput);
  const ktoResult = !isNaN(ktoOdds) && ktoOdds > 1
    ? calcKtoEV(ktoOdds, rec.confidence)
    : null;

  return (
    <div
      className="rounded-xl overflow-hidden mb-3 last:mb-0"
      style={{ border: `1.5px solid ${isTop ? urg.border : 'var(--border)'}` }}
    >
      {/* Header da recomendação */}
      <button
        className="w-full text-left p-3"
        style={{ background: isTop ? urg.bg : 'var(--bg-primary)' }}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <ConfidenceRing value={rec.confidence} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span
                className="text-xs font-black px-2 py-0.5 rounded-full"
                style={{ background: urg.bg, color: urg.color, border: `1px solid ${urg.border}` }}
              >
                {urg.label}
              </span>
              <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                {rec.marketKey === 'totals' ? '📊' : rec.marketKey === 'h2h' ? '🏆' : '⚖️'} {rec.marketKey.toUpperCase()}
              </span>
            </div>
            <div className="font-bold text-sm text-white">{rec.market}</div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Odd mín. KTO: <strong className="text-white">{rec.minOddsForValue.toFixed(2)}</strong>
              {rec.currentBestOdds > 0 && (
                <span className="ml-2">
                  Mercado: <strong style={{ color: rec.ev > 0 ? '#22c55e' : 'var(--text-secondary)' }}>
                    {formatOdds(rec.currentBestOdds)}
                  </strong>
                  {rec.ev !== 0 && (
                    <span className="ml-1" style={{ color: rec.ev > 0 ? '#22c55e' : '#ef4444' }}>
                      ({formatEV(rec.ev)} EV)
                    </span>
                  )}
                </span>
              )}
            </div>
          </div>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {expanded ? '▲' : '▼'}
          </span>
        </div>
      </button>

      {expanded && (
        <div style={{ background: 'var(--bg-card)' }}>
          {/* Risk badge */}
          <div className="flex gap-2 px-3 pt-2 flex-wrap">
            <span
              className="text-xs px-2 py-0.5 rounded-full"
              style={{
                background: rec.riskLevel === 'baixo' ? 'rgba(34,197,94,0.15)' : rec.riskLevel === 'médio' ? 'rgba(234,179,8,0.15)' : 'rgba(239,68,68,0.15)',
                color: rec.riskLevel === 'baixo' ? '#22c55e' : rec.riskLevel === 'médio' ? '#eab308' : '#ef4444',
              }}
            >
              Risco {rec.riskLevel}
            </span>
          </div>

          {/* Raciocínio */}
          <div className="px-3 py-2">
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {rec.reasoning}
            </p>
          </div>

          {/* Data points */}
          {rec.dataPoints.length > 0 && (
            <div className="px-3 pb-2">
              <div className="rounded-lg p-2" style={{ background: 'var(--bg-primary)' }}>
                <p className="text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  📊 Dados do modelo
                </p>
                <div className="space-y-1">
                  {rec.dataPoints.map((dp, i) => (
                    <div key={i} className="text-xs flex items-start gap-1.5" style={{ color: 'var(--text-secondary)' }}>
                      <span style={{ color: 'var(--accent)', flexShrink: 0 }}>·</span>
                      {dp}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* KTO Calculator */}
          <div className="px-3 pb-3">
            <div className="rounded-lg p-2.5" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}>
              <p className="text-xs font-semibold mb-2" style={{ color: '#22c55e' }}>
                🎯 Verificar na KTO
              </p>
              <div className="flex gap-2 items-center">
                <input
                  type="number"
                  placeholder={`Odd KTO (mín ${rec.minOddsForValue.toFixed(2)})`}
                  value={ktoInput}
                  onChange={e => setKtoInput(e.target.value)}
                  step="0.01" min="1.01"
                  className="flex-1 rounded-lg px-2.5 py-1.5 text-sm text-white outline-none"
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
                />
                {ktoResult && (
                  <div
                    className="text-sm font-bold px-2.5 py-1.5 rounded-lg whitespace-nowrap"
                    style={{
                      background: ktoResult.isValue ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)',
                      color: ktoResult.isValue ? '#22c55e' : '#ef4444',
                    }}
                  >
                    EV {formatEV(ktoResult.ev)}
                  </div>
                )}
              </div>
              {ktoResult ? (
                <p className="text-xs mt-1.5" style={{ color: ktoResult.isValue ? '#22c55e' : 'var(--text-muted)' }}>
                  {ktoResult.tip}
                </p>
              ) : (
                <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
                  Odds ao vivo na KTO: <a href="https://www.kto.bet.br/ao-vivo" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: '#22c55e' }}>kto.bet.br/ao-vivo</a>
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Card Principal ───────────────────────────────────────────────────────────

interface Props {
  analysis: InPlayAnalysis;
  mode: 'agora' | 'geral';
}

export default function LiveBetCard({ analysis, mode }: Props) {
  const { game, recommendations, topBet, modelSummary } = analysis;

  // Em modo "agora", só mostra recomendações urgentes
  const visibleRecs = mode === 'agora'
    ? recommendations.filter(r => r.urgency === 'agora' || (r.urgency === 'observar' && r.confidence >= 0.60))
    : recommendations;

  if (mode === 'agora' && visibleRecs.length === 0) return null;

  const hasBet = topBet && topBet.urgency === 'agora';
  const borderColor = hasBet
    ? 'rgba(249,115,22,0.5)'
    : topBet?.urgency === 'observar'
    ? 'rgba(234,179,8,0.3)'
    : 'var(--border)';

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: `1.5px solid ${borderColor}`, background: 'var(--bg-card)' }}
    >
      {/* ── Header do jogo ── */}
      <div className="p-4 pb-3" style={{ background: hasBet ? 'rgba(249,115,22,0.05)' : undefined }}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
              {game.leagueName}
            </span>
            {game.isLive && (
              <span
                className="text-xs font-black px-2 py-0.5 rounded-full animate-pulse"
                style={{ background: 'rgba(239,68,68,0.2)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.4)' }}
              >
                🔴 AO VIVO
              </span>
            )}
          </div>
          <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
            {game.periodLabel}
          </span>
        </div>

        {/* Placar */}
        <div className="flex items-center gap-3 mb-2">
          <span className="font-bold text-sm text-white flex-1 truncate">{game.homeTeam}</span>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-2xl font-black text-white">{game.homeScore}</span>
            <span style={{ color: 'var(--text-muted)' }}>×</span>
            <span className="text-2xl font-black text-white">{game.awayScore}</span>
          </div>
          <span className="font-bold text-sm text-white flex-1 truncate text-right">{game.awayTeam}</span>
        </div>

        {/* Barra de progresso do jogo */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${(game.timeElapsed * 100).toFixed(0)}%`,
                background: game.isLive ? '#ef4444' : 'var(--accent)',
              }}
            />
          </div>
          <span className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>
            {(game.timeElapsed * 100).toFixed(0)}%
          </span>
        </div>

        {/* Resumo do modelo */}
        <p className="text-xs mt-2 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          💡 {modelSummary}
        </p>
      </div>

      {/* ── Recomendações ── */}
      {visibleRecs.length > 0 ? (
        <div className="px-3 pb-3">
          {visibleRecs.map((rec, i) => (
            <RecommendationRow key={`${rec.market}-${i}`} rec={rec} isTop={i === 0} />
          ))}
        </div>
      ) : (
        <div className="px-4 pb-4 text-center">
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Sem apostas com confiança suficiente neste momento. Jogo em estágio inicial.
          </p>
        </div>
      )}

      {/* Rodapé */}
      {analysis.oddsSource !== 'N/A' && (
        <div className="px-4 py-2 text-xs" style={{ background: 'var(--bg-primary)', borderTop: '1px solid var(--border)', color: 'var(--text-muted)' }}>
          Odds ref: {analysis.oddsSource} · {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </div>
      )}
    </div>
  );
}
