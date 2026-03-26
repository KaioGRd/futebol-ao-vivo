import { getMultipleSportsEvents, SPORT_CATEGORIES, isApiConfigured, OddsEvent } from '@/lib/odds-api';
// getCategoryEvents usada pelo EventsClient via API route
import EventsClient from './EventsClient';

export const revalidate = 300; // 5 minutes

export default async function EventosPage() {
  const apiOk = isApiConfigured();

  // Pre-load football events on the server
  let initialEvents: OddsEvent[] = [];
  if (apiOk) {
    const footballCategory = SPORT_CATEGORIES.find(c => c.id === 'futebol');
    if (footballCategory) {
      // Busca com múltiplos mercados para mostrar H2H + Over/Under + Handicap
      initialEvents = await getMultipleSportsEvents(
        footballCategory.sport_keys.slice(0, 4),
        { regions: 'eu,uk,au', markets: ['h2h', 'totals', 'spreads'] }
      );
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-bold">Análise de Apostas</h1>
          <span
            className="text-xs font-bold px-2 py-1 rounded-full"
            style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e' }}
          >
            BETA
          </span>
        </div>
        <p style={{ color: 'var(--text-secondary)' }}>
          Value Bets identificados por probabilidade estatística • Odds vs Mercado Sharp
        </p>
      </div>

      {/* Legend */}
      <div
        className="rounded-xl p-4 mb-6"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
      >
        <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>
          Como interpretar os resultados:
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full shrink-0" style={{ background: '#f97316' }} />
            <span style={{ color: 'var(--text-secondary)' }}>Excelente EV (≥8%)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full shrink-0" style={{ background: '#22c55e' }} />
            <span style={{ color: 'var(--text-secondary)' }}>Bom Valor (4–8%)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full shrink-0" style={{ background: '#eab308' }} />
            <span style={{ color: 'var(--text-secondary)' }}>Marginal (1–4%)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full shrink-0" style={{ background: '#94a3b8' }} />
            <span style={{ color: 'var(--text-secondary)' }}>Sem Valor (&lt;1%)</span>
          </div>
        </div>
        <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
          EV = Valor Esperado. Positivo significa que a odd oferece mais do que a probabilidade real sugere.
          Clique em qualquer odd para calcular com as odds da KTO.
        </p>
      </div>

      <EventsClient
        initialEvents={initialEvents}
        apiConfigured={apiOk}
      />
    </div>
  );
}
