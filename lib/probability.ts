/**
 * Motor de Probabilidade, Análise de Value Bets e Explicações de IA
 *
 * LÓGICA CORRIGIDA:
 * - Usa a "melhor linha" entre todos os bookmakers como odd de referência
 * - Compara contra a probabilidade justa da Pinnacle (a mais precisa do mundo)
 * - EV > 0 = algum bookmaker está oferecendo mais do que o mercado justo
 * - "Evitar" só aparece quando a odd está significativamente abaixo do mercado
 */

import { OddsOutcome, OddsEvent, OddsBookmaker } from './odds-api';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface ProbabilityOutcome {
  name: string;
  rawOdds: number;
  impliedProb: number;
  fairProb: number;
}

export interface BetAnalysis {
  outcome: string;
  bestOdds: number;           // melhor odd disponível no mercado
  bestBookmaker: string;      // bookmaker que oferece a melhor odd
  referenceOdds: number;      // odd do bookmaker de referência (Pinnacle)
  modelProb: number;          // probabilidade estimada (justa, sem vig)
  impliedProb: number;        // probabilidade implícita da melhor odd
  fairProb: number;           // probabilidade justa (vig removida da referência)
  ev: number;                 // EV da melhor odd disponível
  evPercent: number;
  kellyFraction: number;
  edge: number;               // edge sobre o mercado (bestOdds vs referenceOdds)
  rating: BetRating;
  label: string;
  breakEvenOdds: number;      // odd mínima para EV positivo
  insight: BetInsight;
}

export type BetRating = 'excellent' | 'good' | 'marginal' | 'fair' | 'below' | 'avoid';

export interface BetInsight {
  summary: string;            // 1 frase resumindo a aposta
  reasoning: string;          // por que a odd está nesse valor
  whyRating: string;          // por que tem esse rating (crucial para "evitar")
  ktoMinOdds: string;         // odd mínima na KTO para EV positivo
  signal: string;             // o que observar / quando apostar
  confidence: 'alta' | 'média' | 'baixa';
}

export interface EventAnalysis {
  outcomes: BetAnalysis[];
  bookmakerMargin: number;
  referenceBookmaker: string;
  bestValueBet: BetAnalysis | null;
  hasValueBet: boolean;
  marketInsight: string;      // análise geral do evento
}

export interface MatchProbabilities {
  homeWin: number;
  draw: number;
  awayWin: number;
  expectedHomeGoals: number;
  expectedAwayGoals: number;
  over25: number;
  under25: number;
  btts: number;
  source: 'poisson' | 'market';
}

// ─── Constantes ────────────────────────────────────────────────────────────────

const SHARP_BOOKMAKERS = ['pinnacle', 'betfair_ex_eu', 'betfair', 'matchbook'];

// ─── Core Math ────────────────────────────────────────────────────────────────

export function impliedProb(decimalOdds: number): number {
  if (decimalOdds <= 1) return 0;
  return 1 / decimalOdds;
}

export function calculateMargin(outcomes: OddsOutcome[]): number {
  const sum = outcomes.reduce((acc, o) => acc + impliedProb(o.price), 0);
  return parseFloat(((sum - 1) * 100).toFixed(2));
}

export function removedVig(outcomes: OddsOutcome[]): ProbabilityOutcome[] {
  const rawProbs = outcomes.map(o => impliedProb(o.price));
  const total = rawProbs.reduce((a, b) => a + b, 0);
  return outcomes.map((o, i) => ({
    name: o.name,
    rawOdds: o.price,
    impliedProb: parseFloat(rawProbs[i].toFixed(4)),
    fairProb: parseFloat((rawProbs[i] / total).toFixed(4)),
  }));
}

// ─── Melhor linha por outcome ──────────────────────────────────────────────────

interface BestLine {
  odds: number;
  bookmaker: string;
}

/**
 * Para cada outcome, encontra o bookmaker com a melhor (maior) odd disponível.
 * Isso é o que o apostador deveria usar na prática.
 */
export function getBestLines(
  event: OddsEvent,
  marketKey: string
): Map<string, BestLine> {
  const bestLines = new Map<string, BestLine>();

  for (const bk of event.bookmakers) {
    const market = bk.markets.find(m => m.key === marketKey);
    if (!market) continue;

    for (const outcome of market.outcomes) {
      const current = bestLines.get(outcome.name);
      if (!current || outcome.price > current.odds) {
        bestLines.set(outcome.name, { odds: outcome.price, bookmaker: bk.title });
      }
    }
  }

  return bestLines;
}

/**
 * Obtém a probabilidade justa a partir do bookmaker de referência (sharp money).
 * Pinnacle → Betfair Exchange → Mercado Consensus.
 */
export function getReferenceProbs(
  event: OddsEvent,
  marketKey: string
): { probs: Map<string, number>; bookmakerName: string; margin: number } {
  // Tenta sharp bookmakers em ordem de confiabilidade
  for (const sharpKey of SHARP_BOOKMAKERS) {
    const bk = event.bookmakers.find(b => b.key === sharpKey);
    if (!bk) continue;
    const market = bk.markets.find(m => m.key === marketKey);
    if (!market || market.outcomes.length === 0) continue;

    const vigRemoved = removedVig(market.outcomes);
    const margin = calculateMargin(market.outcomes);
    const probs = new Map(vigRemoved.map(o => [o.name, o.fairProb]));
    return { probs, bookmakerName: bk.title, margin };
  }

  // Fallback: consensus de todos os bookmakers disponíveis
  const allOdds = new Map<string, number[]>();
  let marginSum = 0;
  let marketCount = 0;

  for (const bk of event.bookmakers) {
    const market = bk.markets.find(m => m.key === marketKey);
    if (!market) continue;
    marginSum += calculateMargin(market.outcomes);
    marketCount++;

    for (const outcome of market.outcomes) {
      const existing = allOdds.get(outcome.name) ?? [];
      existing.push(outcome.price);
      allOdds.set(outcome.name, existing);
    }
  }

  if (allOdds.size === 0) return { probs: new Map(), bookmakerName: 'N/A', margin: 0 };

  // Média de odds → probabilidade consensus → remover vig
  const avgOutcomes: OddsOutcome[] = Array.from(allOdds.entries()).map(([name, prices]) => ({
    name,
    price: prices.reduce((a, b) => a + b, 0) / prices.length,
  }));

  const vigRemoved = removedVig(avgOutcomes);
  const probs = new Map(vigRemoved.map(o => [o.name, o.fairProb]));
  return {
    probs,
    bookmakerName: 'Consensus',
    margin: marketCount > 0 ? marginSum / marketCount : 0,
  };
}

// ─── EV e Kelly ───────────────────────────────────────────────────────────────

export function calculateEV(modelProb: number, decimalOdds: number): number {
  return parseFloat(((modelProb * decimalOdds) - 1).toFixed(4));
}

export function kellyCriterion(modelProb: number, decimalOdds: number, fraction = 0.25): number {
  const b = decimalOdds - 1;
  const q = 1 - modelProb;
  const k = (modelProb * b - q) / b;
  if (k <= 0) return 0;
  return parseFloat((k * fraction).toFixed(4));
}

/**
 * Odd mínima que o bookmaker precisa oferecer para EV > 0
 */
export function breakEvenOdds(modelProb: number): number {
  if (modelProb <= 0) return 999;
  return parseFloat((1 / modelProb).toFixed(3));
}

// ─── Rating Corrigido ─────────────────────────────────────────────────────────

/**
 * LÓGICA CORRIGIDA:
 * - Compara a MELHOR LINHA disponível contra a probabilidade justa da referência
 * - "Evitar" só para odds significativamente piores que o mercado
 * - "Justo" para quando o mercado está precificando adequadamente
 */
export function rateBet(ev: number, bookmarginDiff: number): { rating: BetRating; label: string } {
  // EV da melhor linha vs probabilidade justa da Pinnacle
  if (ev >= 0.06) return { rating: 'excellent', label: '🔥 Valor Excelente' };
  if (ev >= 0.03) return { rating: 'good', label: '✅ Bom Valor' };
  if (ev >= 0.005) return { rating: 'marginal', label: '⚡ Valor Marginal' };
  if (ev >= -0.04) return { rating: 'fair', label: '⚖️ Mercado Justo' };
  if (ev >= -0.09) return { rating: 'below', label: '⬇️ Abaixo do Mercado' };
  return { rating: 'avoid', label: '❌ Evitar' };
}

export function ratingColor(rating: BetRating): string {
  switch (rating) {
    case 'excellent': return '#f97316';
    case 'good': return '#22c55e';
    case 'marginal': return '#eab308';
    case 'fair': return '#64748b';
    case 'below': return '#94a3b8';
    case 'avoid': return '#ef4444';
  }
}

// ─── Sistema de Explicação ────────────────────────────────────────────────────

function getFavoriteType(fairProb: number): string {
  if (fairProb >= 0.75) return 'favorito absoluto';
  if (fairProb >= 0.60) return 'favorito claro';
  if (fairProb >= 0.50) return 'leve favorito';
  if (fairProb >= 0.40) return 'ligeiro azarão';
  if (fairProb >= 0.25) return 'azarão';
  return 'grande azarão';
}

function getOddsContext(odds: number): string {
  if (odds < 1.30) return 'odds muito curtas (grande favorito, retorno muito baixo)';
  if (odds < 1.60) return 'odds curtas (favorito, retorno limitado)';
  if (odds < 2.20) return 'odds equilibradas (meio-campo)';
  if (odds < 3.50) return 'odds moderadas (azarão acessível)';
  if (odds < 6.00) return 'odds altas (azarão claro)';
  return 'odds muito altas (grande azarão, alto risco)';
}

function getMarketContext(marketKey: string, outcomeName: string): string {
  if (marketKey === 'totals') {
    if (outcomeName.startsWith('Over')) {
      return 'jogo aberto com muitos gols esperados';
    }
    return 'jogo fechado/defensivo esperado';
  }
  if (marketKey === 'spreads') {
    return 'apostando com handicap de vantagem/desvantagem';
  }
  return '';
}

/**
 * Gera uma explicação contextual e educativa para cada aposta.
 * Sistema baseado em regras — não precisa de API externa.
 */
export function generateInsight(
  outcomeName: string,
  bestOdds: number,
  fairProb: number,
  ev: number,
  rating: BetRating,
  bookmarkerMargin: number,
  referenceBook: string,
  homeTeam: string,
  awayTeam: string,
  marketKey: string,
  allFairProbs: number[]
): BetInsight {
  const probPct = (fairProb * 100).toFixed(1);
  const impliedPct = (impliedProb(bestOdds) * 100).toFixed(1);
  const beOdds = breakEvenOdds(fairProb);
  const favoriteType = getFavoriteType(fairProb);
  const oddsContext = getOddsContext(bestOdds);
  const marketCtx = getMarketContext(marketKey, outcomeName);

  // ── Summary ──────────────────────────────────────────────
  let summary = '';
  if (marketKey === 'h2h') {
    if (outcomeName === 'Draw') {
      summary = `Empate com ${probPct}% de probabilidade segundo o mercado sharp.`;
    } else {
      summary = `${outcomeName} (${favoriteType}) com ${probPct}% de chance real estimada.`;
    }
  } else if (marketKey === 'totals') {
    summary = `${outcomeName}: mercado precifica ${probPct}% de chance${marketCtx ? ' — ' + marketCtx : ''}.`;
  } else {
    summary = `${outcomeName}: probabilidade justa de ${probPct}% após remoção da margem.`;
  }

  // ── Por que a odd está nesse valor ───────────────────────
  let reasoning = '';
  if (fairProb >= 0.70) {
    reasoning = `O ${referenceBook} (bookmaker mais preciso do mundo) precifica ${outcomeName} em ${probPct}% de chance. `
      + `Odds tão curtas quanto ${bestOdds.toFixed(2)} são comuns para grandes favoritos — o mercado tem alta confiança neste resultado. `
      + `A margem da casa (${bookmarkerMargin.toFixed(1)}%) corrói o retorno em apostas curtas muito mais do que em odds altas.`;
  } else if (fairProb >= 0.50) {
    reasoning = `O mercado sharp precifica ${outcomeName} como leve favorito (${probPct}%). `
      + `Odds de ${bestOdds.toFixed(2)} refletem ${oddsContext}. `
      + `Com ${allFairProbs.length > 2 ? 'três resultados possíveis' : 'dois resultados possíveis'}, `
      + `o mercado distribui probabilidade com base em poder ofensivo, forma recente e histórico H2H.`;
  } else if (fairProb >= 0.30) {
    reasoning = `${outcomeName} tem apenas ${probPct}% de probabilidade segundo o mercado — categoria de azarão. `
      + `Odds de ${bestOdds.toFixed(2)} (${oddsContext}) podem parecer atraentes, mas refletem a baixa probabilidade real. `
      + `Apostas em azarão têm variância alta — é preciso mais ganhos para compensar as perdas.`;
  } else {
    reasoning = `Grande azarão: apenas ${probPct}% de chance estimada. `
      + `Odds de ${bestOdds.toFixed(2)} são altas porque o evento é improvável. `
      + `Mesmo com bom retorno nominal, o valor esperado raramente é positivo em outsiders extremos.`;
  }

  if (marketKey === 'totals') {
    const isOver = outcomeName.startsWith('Over');
    reasoning = `Mercado de Total de Gols: ${outcomeName} com ${probPct}% de probabilidade. `
      + (isOver
        ? `Jogos entre esses times tendem a ser ${fairProb > 0.55 ? 'abertos e com muitos gols' : 'equilibrados'}. `
        : `Times defensivos ou com baixa conversão de chances tendem a produzir menos gols. `)
      + `A odd ${bestOdds.toFixed(2)} implica ${impliedPct}% de probabilidade implícita, `
      + `${parseFloat(impliedPct) > fairProb * 100 ? 'ligeiramente pior' : 'próxima'} à probabilidade justa.`;
  }

  if (marketKey === 'spreads') {
    reasoning = `Mercado de Handicap: ${outcomeName}. `
      + `O spread equilibra o jogo artificialmente, distribuindo probabilidade próximo de 50/50. `
      + `Probabilidade justa: ${probPct}%. Odd: ${bestOdds.toFixed(2)} (implica ${impliedPct}%). `
      + `Handicaps são eficientes quando há favorito claro — verifique se a linha está alinhada com o H2H.`;
  }

  // ── Por que tem esse rating ──────────────────────────────
  let whyRating = '';
  switch (rating) {
    case 'excellent':
      whyRating = `🔥 EV de ${(ev * 100).toFixed(1)}%: a melhor odd disponível (${bestOdds.toFixed(2)}) está ACIMA do valor justo calculado. `
        + `Isso significa que existe bookmaker oferecendo mais do que a probabilidade real justifica. `
        + `Aproveite enquanto a linha não for ajustada — mercados eficientes corrigem essas distorções rapidamente.`;
      break;
    case 'good':
      whyRating = `✅ EV positivo de ${(ev * 100).toFixed(1)}%: a melhor odd disponível oferece retorno acima do valor justo. `
        + `Não é distorção enorme, mas é edge real. Consistência nesse tipo de aposta gera lucro no longo prazo.`;
      break;
    case 'marginal':
      whyRating = `⚡ EV marginal de ${(ev * 100).toFixed(1)}%: a odd está muito próxima do valor justo. `
        + `O edge é pequeno e pode não cobrir custos de transação ou variância. `
        + `Aposte só se a KTO oferecer odds iguais ou melhores do que ${beOdds.toFixed(2)}.`;
      break;
    case 'fair':
      whyRating = `⚖️ O mercado está precificando este resultado com margem razoável. `
        + `EV de ${(ev * 100).toFixed(1)}%: a odd está dentro da variação normal de um bookmaker justo. `
        + `Não há edge aqui contra a referência, mas na KTO (com margens maiores) pode ter valor se oferecerem odd ≥ ${beOdds.toFixed(2)}.`;
      break;
    case 'below':
      whyRating = `⬇️ A melhor odd disponível (${bestOdds.toFixed(2)}) está ${Math.abs(ev * 100).toFixed(1)}% abaixo do valor justo calculado. `
        + `Isso pode indicar: (a) mercado com baixa liquidez, (b) informação assimétrica (lesão, clima), ou (c) apenas pricing conservador. `
        + `Para EV positivo na KTO, precisaria de odd ≥ ${beOdds.toFixed(2)}.`;
      break;
    case 'avoid':
      whyRating = `❌ A odd está significativamente abaixo do valor justo (EV de ${(ev * 100).toFixed(1)}%). `
        + `Por que isso acontece? Três razões comuns: (1) O bookmaker tem margem muito alta neste mercado específico, `
        + `(2) Há informação privilegiada circulando que faz a casa reduzir as odds, `
        + `(3) Baixa liquidez — o mercado tem poucos apostadores e o bookmaker cobre o risco com margens enormes. `
        + `A odd precisaria ser ${beOdds.toFixed(2)} ou mais para ter qualquer valor.`;
      break;
  }

  // ── Odd mínima KTO ──────────────────────────────────────
  const ktoMinOdds = `Para EV positivo na KTO: odd ≥ ${beOdds.toFixed(2)}. `
    + (bestOdds >= beOdds
      ? `A melhor odd atual (${bestOdds.toFixed(2)}) já atinge esse critério.`
      : `A melhor odd atual (${bestOdds.toFixed(2)}) está ${(beOdds - bestOdds).toFixed(2)} abaixo do necessário.`);

  // ── Sinal ────────────────────────────────────────────────
  let signal = '';
  if (rating === 'excellent' || rating === 'good') {
    signal = `✓ Aposte agora se a KTO oferecer ≥ ${beOdds.toFixed(2)}. Verifique a odd antes de confirmar.`;
  } else if (rating === 'marginal') {
    signal = `Monitore: se a KTO subir a odd para ≥ ${beOdds.toFixed(2)}, torna-se value bet. Steams de odds indicam dinheiro entrando.`;
  } else if (rating === 'fair') {
    signal = `Apostar só faz sentido se a KTO oferecer odds melhores que ${beOdds.toFixed(2)}. Use o Calculador KTO abaixo para verificar.`;
  } else {
    signal = `Evite este mercado nesta odd. Espere por odds maiores ou foque em outros mercados do evento.`;
  }

  // ── Confiança ────────────────────────────────────────────
  const confidence: 'alta' | 'média' | 'baixa' =
    referenceBook === 'Pinnacle' || referenceBook.includes('Betfair') ? 'alta'
      : referenceBook === 'Consensus' ? 'média'
      : 'baixa';

  return { summary, reasoning, whyRating, ktoMinOdds, signal, confidence };
}

// ─── Análise Completa do Evento ───────────────────────────────────────────────

export function analyzeEvent(
  event: OddsEvent,
  marketKey: string = 'h2h'
): EventAnalysis {
  // 1. Probabilidade justa do bookmaker de referência
  const { probs: refProbs, bookmakerName: refBook, margin } = getReferenceProbs(event, marketKey);
  if (refProbs.size === 0) {
    return { outcomes: [], bookmakerMargin: 0, referenceBookmaker: 'N/A', bestValueBet: null, hasValueBet: false, marketInsight: '' };
  }

  // 2. Melhor linha para cada outcome
  const bestLines = getBestLines(event, marketKey);
  const allFairProbs = Array.from(refProbs.values());

  // 3. Referência de odds (para comparação com a melhor linha)
  const refBkData = event.bookmakers.find(b =>
    SHARP_BOOKMAKERS.includes(b.key)
  ) ?? event.bookmakers[0];
  const refMarket = refBkData?.markets.find(m => m.key === marketKey);

  // 4. Analisar cada outcome
  const outcomes: BetAnalysis[] = [];
  for (const [outcomeName, fairProb] of refProbs.entries()) {
    const bestLine = bestLines.get(outcomeName);
    if (!bestLine) continue;

    const refOutcome = refMarket?.outcomes.find(o => o.name === outcomeName);
    const referenceOdds = refOutcome?.price ?? bestLine.odds;
    const impliedP = impliedProb(bestLine.odds);
    const ev = calculateEV(fairProb, bestLine.odds);
    const evPercent = parseFloat((ev * 100).toFixed(2));
    const kelly = kellyCriterion(fairProb, bestLine.odds);
    const edge = parseFloat((bestLine.odds - referenceOdds).toFixed(3));
    const { rating, label } = rateBet(ev, edge);
    const homeTeam = event.home_team;
    const awayTeam = event.away_team;

    const insight = generateInsight(
      outcomeName,
      bestLine.odds,
      fairProb,
      ev,
      rating,
      margin,
      refBook,
      homeTeam,
      awayTeam,
      marketKey,
      allFairProbs
    );

    outcomes.push({
      outcome: outcomeName,
      bestOdds: bestLine.odds,
      bestBookmaker: bestLine.bookmaker,
      referenceOdds,
      modelProb: fairProb,
      impliedProb: impliedP,
      fairProb,
      ev,
      evPercent,
      kellyFraction: kelly,
      edge,
      rating,
      label,
      breakEvenOdds: breakEvenOdds(fairProb),
      insight,
    });
  }

  // Ordena: favorito primeiro (maior prob)
  outcomes.sort((a, b) => b.modelProb - a.modelProb);

  const valueBets = outcomes.filter(b => b.ev > 0);
  const bestValueBet = valueBets.length > 0
    ? valueBets.reduce((best, b) => b.ev > best.ev ? b : best, valueBets[0])
    : null;

  // Análise geral do mercado
  const marketInsight = generateMarketInsight(outcomes, event, marketKey, margin, refBook);

  return {
    outcomes,
    bookmakerMargin: margin,
    referenceBookmaker: refBook,
    bestValueBet,
    hasValueBet: valueBets.length > 0,
    marketInsight,
  };
}

function generateMarketInsight(
  outcomes: BetAnalysis[],
  event: OddsEvent,
  marketKey: string,
  margin: number,
  refBook: string
): string {
  if (outcomes.length === 0) return '';

  const favorite = outcomes[0];
  const numBookmakers = event.bookmakers.length;
  const hasValue = outcomes.some(o => o.ev > 0);
  const bestEV = Math.max(...outcomes.map(o => o.ev));

  let base = '';
  if (marketKey === 'h2h' && outcomes.length >= 2) {
    if (favorite.modelProb >= 0.65) {
      base = `${favorite.outcome} é favorito dominante (${(favorite.modelProb * 100).toFixed(0)}%). `;
    } else if (favorite.modelProb >= 0.50) {
      base = `Jogo equilibrado com leve favoritismo para ${favorite.outcome}. `;
    } else {
      base = `Partida equilibrada — nenhum time com vantagem clara. `;
    }
  } else if (marketKey === 'totals') {
    const over = outcomes.find(o => o.outcome.startsWith('Over'));
    if (over) {
      base = over.modelProb >= 0.55
        ? `Jogo aberto esperado — ${(over.modelProb * 100).toFixed(0)}% de chance de Over. `
        : `Jogo fechado esperado — mercado favorece Under. `;
    }
  }

  const marginNote = margin > 6
    ? `Margem da casa alta (${margin.toFixed(1)}%) — prefira a KTO se oferecer odds maiores. `
    : `Mercado eficiente (margem ${margin.toFixed(1)}% via ${refBook}). `;

  const bookCount = `${numBookmakers} casa${numBookmakers !== 1 ? 's' : ''} cobrindo este evento.`;
  const valueNote = hasValue
    ? ` Melhor EV disponível: +${(bestEV * 100).toFixed(1)}%.`
    : ` Nenhum valor significativo no mercado atual.`;

  return base + marginNote + bookCount + valueNote;
}

// ─── Calculadora KTO ──────────────────────────────────────────────────────────

export function calcKtoEV(ktoOdds: number, modelProb: number) {
  const ev = calculateEV(modelProb, ktoOdds);
  const evPercent = parseFloat((ev * 100).toFixed(2));
  const kellyFraction = kellyCriterion(modelProb, ktoOdds);
  const isValue = ev > 0;
  const { rating, label } = rateBet(ev, 0);

  const tip = isValue
    ? `✓ Esta odd na KTO tem EV positivo. Kelly sugere ${(kellyFraction * 100).toFixed(1)}% da banca.`
    : `Odd insuficiente. Para EV positivo, precisaria de odd ≥ ${breakEvenOdds(modelProb).toFixed(2)}.`;

  return { ev, evPercent, kellyFraction, isValue, label, tip, rating };
}

// ─── Helpers de Formatação ────────────────────────────────────────────────────

export function formatProb(prob: number): string {
  return `${(prob * 100).toFixed(1)}%`;
}

export function formatEV(ev: number): string {
  const sign = ev >= 0 ? '+' : '';
  return `${sign}${(ev * 100).toFixed(1)}%`;
}

export function formatOdds(odds: number): string {
  return odds.toFixed(2);
}

// Poisson (mantido para uso futuro com dados históricos)
function poissonPMF(lambda: number, k: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  let logP = -lambda + k * Math.log(lambda);
  for (let i = 1; i <= k; i++) logP -= Math.log(i);
  return Math.exp(logP);
}

export function poissonMatchProbabilities(
  homeAttack: number, awayAttack: number,
  homeDefense: number, awayDefense: number,
  leagueAvgHome = 1.5, leagueAvgAway = 1.1
): MatchProbabilities {
  const lambdaHome = homeAttack * awayDefense * leagueAvgHome;
  const lambdaAway = awayAttack * homeDefense * leagueAvgAway;
  const maxGoals = 10;

  const homeDist = Array.from({ length: maxGoals + 1 }, (_, k) => poissonPMF(lambdaHome, k));
  const awayDist = Array.from({ length: maxGoals + 1 }, (_, k) => poissonPMF(lambdaAway, k));

  let homeWin = 0, draw = 0, awayWin = 0, btts = 0;
  let under25 = 0;

  for (let h = 0; h <= maxGoals; h++) {
    for (let a = 0; a <= maxGoals; a++) {
      const prob = homeDist[h] * awayDist[a];
      if (h > a) homeWin += prob;
      else if (h === a) draw += prob;
      else awayWin += prob;
      if (h >= 1 && a >= 1) btts += prob;
      if (h + a <= 2) under25 += prob;
    }
  }

  return {
    homeWin: parseFloat(homeWin.toFixed(4)),
    draw: parseFloat(draw.toFixed(4)),
    awayWin: parseFloat(awayWin.toFixed(4)),
    expectedHomeGoals: parseFloat(lambdaHome.toFixed(2)),
    expectedAwayGoals: parseFloat(lambdaAway.toFixed(2)),
    over25: parseFloat((1 - under25).toFixed(4)),
    under25: parseFloat(under25.toFixed(4)),
    btts: parseFloat(btts.toFixed(4)),
    source: 'poisson',
  };
}
