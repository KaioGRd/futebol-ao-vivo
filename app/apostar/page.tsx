import ApostarClient from './ApostarClient';

// Revalida a cada 30s — dados ao vivo mudam rápido
export const revalidate = 30;

export default function ApostarPage() {
  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-bold">🎯 Apostas ao Vivo</h1>
          <span
            className="text-xs font-bold px-2 py-1 rounded-full animate-pulse"
            style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}
          >
            AO VIVO
          </span>
        </div>
        <p style={{ color: 'var(--text-secondary)' }}>
          Análise em tempo real • Pace model por esporte • Odds de referência via mercado internacional
        </p>
      </div>

      {/* Legenda */}
      <div
        className="rounded-xl p-4 mb-6 text-xs"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
      >
        <p className="font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>
          Como funciona o modelo:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="flex items-start gap-2">
            <span className="text-base shrink-0">🔥</span>
            <span style={{ color: 'var(--text-secondary)' }}>
              <strong className="text-white">Apostar Agora</strong> — confiança ≥65% + EV positivo no mercado
            </span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-base shrink-0">👁</span>
            <span style={{ color: 'var(--text-secondary)' }}>
              <strong className="text-white">Observar</strong> — modelo favorável mas edge menor ou odds insuficientes
            </span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-base shrink-0">📊</span>
            <span style={{ color: 'var(--text-secondary)' }}>
              <strong className="text-white">Pace model</strong> — projeção baseada no ritmo atual do jogo, não apenas placar
            </span>
          </div>
        </div>
        <p className="mt-2" style={{ color: 'var(--text-muted)' }}>
          Use as odds ao vivo da KTO em{' '}
          <a
            href="https://www.kto.bet.br/ao-vivo"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
            style={{ color: '#22c55e' }}
          >
            kto.bet.br/ao-vivo
          </a>{' '}
          e insira abaixo para calcular o EV exato de cada aposta.
        </p>
      </div>

      <ApostarClient />
    </div>
  );
}
