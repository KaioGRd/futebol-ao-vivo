/**
 * Motor de Probabilidade e Análise de Value Bets
 *
 * Inclui:
 * - Conversão de odds para probabilidade
 * - Remoção de margem (vig)
 * - Modelo de Poisson para futebol
 * - Cálculo de EV (Valor Esperado)
 * - Kelly Criterion
 * - Classificação de apostas
 */

import { OddsOutcome } from './odds-api';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface ProbabilityOutcome {
  name: string;
  rawOdds: number;
  impliedProb: number;     // probability including bookmaker margin
  fairProb: number;        // probability after removing margin (vig)
}

export interface MatchProbabilities {
  homeWin: number;
  draw: number;
  awayWin: number;
  expectedHomeGoals: number;
  expectedAwayGoals: number;
  over25: number;          // P(total goals > 2.5)
  under25: number;
  btts: number;            // Both Teams to Score
  source: 'poisson' | 'market';
}

export interface BetAnalysis {
  outcome: string;
  odds: number;
  modelProb: number;       // model's estimated probability (0-1)
  impliedProb: number;     // bookmaker's implied probability (0-1)
  fairProb: number;        // fair probability without vig (0-1)
  ev: number;              // Expected Value (positive = value bet)
  evPercent: number;       // EV as percentage
  kellyFraction: number;   // Kelly stake fraction (0-1)
  edge: number;            // our edge over the market (model - fair)
  rating: BetRating;
  label: string;
}

export type BetRating = 'excellent' | 'good' | 'neutral' | 'bad' | 'avoid';

export interface EventAnalysis {
  outcomes: BetAnalysis[];
  bookmakerMargin: number;      // % margin of the bookmaker
  sharpestBookmaker: string;
  bestValueBet: BetAnalysis | null;
  hasValueBet: boolean;
}

// ─── Core Probability Math ─────────────────────────────────────────────────────

/**
 * Convert decimal odds to implied probability (includes bookmaker margin)
 */
export function impliedProb(decimalOdds: number): number {
  if (decimalOdds <= 1) return 0;
  return 1 / decimalOdds;
}

/**
 * Calculate the bookmaker's total margin (overround)
 * A fair book = 100%, bookmakers add margin → sum > 100%
 */
export function calculateMargin(outcomes: OddsOutcome[]): number {
  const sum = outcomes.reduce((acc, o) => acc + impliedProb(o.price), 0);
  return parseFloat(((sum - 1) * 100).toFixed(2));
}

/**
 * Remove the vig (bookmaker margin) to get fair probabilities
 * Method: proportional vig removal (most common approach)
 */
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

// ─── Poisson Model (Football) ──────────────────────────────────────────────────

/**
 * Poisson distribution: P(X = k) = (e^-λ × λ^k) / k!
 * Used to model discrete goal counts in football
 */
function poissonPMF(lambda: number, k: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  let logP = -lambda + k * Math.log(lambda);
  for (let i = 1; i <= k; i++) logP -= Math.log(i);
  return Math.exp(logP);
}

/**
 * Generate goal probability distribution for 0..maxGoals
 */
export function goalDistribution(lambda: number, maxGoals = 10): number[] {
  return Array.from({ length: maxGoals + 1 }, (_, k) => poissonPMF(lambda, k));
}

/**
 * Calculate full match probabilities using the Dixon-Coles Poisson model.
 *
 * @param homeAttack  - Home team attack rating (goals scored per game, relative to league avg)
 * @param awayAttack  - Away team attack rating
 * @param homeDefense - Home team defense rating (goals conceded per game)
 * @param awayDefense - Away team defense rating
 * @param leagueAvgHome - League average home goals per game (default 1.5)
 * @param leagueAvgAway - League average away goals per game (default 1.1)
 */
export function poissonMatchProbabilities(
  homeAttack: number,
  awayAttack: number,
  homeDefense: number,
  awayDefense: number,
  leagueAvgHome = 1.5,
  leagueAvgAway = 1.1
): MatchProbabilities {
  // Home advantage factor built into leagueAvgHome
  const lambdaHome = homeAttack * awayDefense * leagueAvgHome;
  const lambdaAway = awayAttack * homeDefense * leagueAvgAway;

  const maxGoals = 10;
  const homeDist = goalDistribution(lambdaHome, maxGoals);
  const awayDist = goalDistribution(lambdaAway, maxGoals);

  let homeWin = 0, draw = 0, awayWin = 0;
  let btts = 0;

  // Build score matrix
  for (let h = 0; h <= maxGoals; h++) {
    for (let a = 0; a <= maxGoals; a++) {
      const prob = homeDist[h] * awayDist[a];
      if (h > a) homeWin += prob;
      else if (h === a) draw += prob;
      else awayWin += prob;

      if (h >= 1 && a >= 1) btts += prob;
    }
  }

  // P(total goals > 2.5) = 1 - P(0,1,2 goals total)
  let under25 = 0;
  for (let total = 0; total <= 2; total++) {
    for (let h = 0; h <= total; h++) {
      const a = total - h;
      if (a >= 0 && a <= maxGoals && h <= maxGoals) {
        under25 += homeDist[h] * awayDist[a];
      }
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

/**
 * Simple Poisson model based only on standing stats (goals for/against per game).
 * Used when we don't have full historical data.
 */
export function simplePoisson(
  homeGoalsFor: number,
  homeGoalsAgainst: number,
  awayGoalsFor: number,
  awayGoalsAgainst: number,
  homeGamesPlayed: number,
  awayGamesPlayed: number,
  leagueAvgHome = 1.5,
  leagueAvgAway = 1.1
): MatchProbabilities {
  if (homeGamesPlayed === 0 || awayGamesPlayed === 0) {
    // Fallback: equal probability
    return {
      homeWin: 0.33,
      draw: 0.33,
      awayWin: 0.34,
      expectedHomeGoals: leagueAvgHome,
      expectedAwayGoals: leagueAvgAway,
      over25: 0.5,
      under25: 0.5,
      btts: 0.5,
      source: 'poisson',
    };
  }

  const homeAttack = (homeGoalsFor / homeGamesPlayed) / leagueAvgHome;
  const homeDefense = (homeGoalsAgainst / homeGamesPlayed) / leagueAvgAway;
  const awayAttack = (awayGoalsFor / awayGamesPlayed) / leagueAvgAway;
  const awayDefense = (awayGoalsAgainst / awayGamesPlayed) / leagueAvgHome;

  return poissonMatchProbabilities(
    homeAttack, awayAttack, homeDefense, awayDefense,
    leagueAvgHome, leagueAvgAway
  );
}

/**
 * When we don't have a model, use market consensus as proxy for "true" probability.
 * Pinnacle's vig-removed probability is an excellent baseline.
 */
export function marketBasedProbabilities(outcomes: OddsOutcome[]): MatchProbabilities {
  const fair = removedVig(outcomes);

  // For 2-way markets (no draw): MMA, Tennis, Basketball
  if (outcomes.length === 2) {
    return {
      homeWin: fair[0]?.fairProb ?? 0.5,
      draw: 0,
      awayWin: fair[1]?.fairProb ?? 0.5,
      expectedHomeGoals: 0,
      expectedAwayGoals: 0,
      over25: 0.5,
      under25: 0.5,
      btts: 0,
      source: 'market',
    };
  }

  // For 3-way markets (football)
  return {
    homeWin: fair[0]?.fairProb ?? 0.33,
    draw: fair[1]?.fairProb ?? 0.33,
    awayWin: fair[2]?.fairProb ?? 0.34,
    expectedHomeGoals: 0,
    expectedAwayGoals: 0,
    over25: 0.5,
    under25: 0.5,
    btts: 0.5,
    source: 'market',
  };
}

// ─── EV and Kelly ─────────────────────────────────────────────────────────────

/**
 * Expected Value = (probability of winning × potential profit) - (probability of losing × stake)
 * For a 1 unit stake: EV = (p × (odds - 1)) - (1 - p)
 * Simplified: EV = (p × odds) - 1
 */
export function calculateEV(modelProbability: number, decimalOdds: number): number {
  return parseFloat(((modelProbability * decimalOdds) - 1).toFixed(4));
}

/**
 * Kelly Criterion: optimal bet fraction of bankroll
 * K = (p × b - q) / b
 * where: p = win probability, q = 1-p, b = net odds (decimal - 1)
 *
 * We use fractional Kelly (25%) to reduce variance
 */
export function kellyCriterion(
  modelProbability: number,
  decimalOdds: number,
  fraction = 0.25
): number {
  const b = decimalOdds - 1;
  const q = 1 - modelProbability;
  const k = (modelProbability * b - q) / b;

  if (k <= 0) return 0;
  return parseFloat((k * fraction).toFixed(4));
}

/**
 * Rate a bet based on EV and edge
 */
export function rateBet(ev: number, edge: number): { rating: BetRating; label: string } {
  if (ev >= 0.08 && edge >= 0.05) return { rating: 'excellent', label: '🔥 Valor Excelente' };
  if (ev >= 0.04 && edge >= 0.02) return { rating: 'good', label: '✅ Bom Valor' };
  if (ev >= 0.01) return { rating: 'neutral', label: '⚡ Valor Marginal' };
  if (ev >= -0.03) return { rating: 'bad', label: '⚠️ Sem Valor' };
  return { rating: 'avoid', label: '❌ Evitar' };
}

// ─── Full Event Analysis ───────────────────────────────────────────────────────

/**
 * Full analysis of a betting event.
 *
 * @param outcomes      - Odds for each outcome from the reference bookmaker
 * @param modelProbs    - Optional model probabilities (0-1 for each outcome, same order)
 * @param bookmakerName - Name of the reference bookmaker
 */
export function analyzeEvent(
  outcomes: OddsOutcome[],
  modelProbs?: number[],
  bookmakerName = 'Mercado'
): EventAnalysis {
  const vigRemoved = removedVig(outcomes);
  const margin = calculateMargin(outcomes);

  // If no model probabilities provided, use vig-removed market as model
  // (this is still useful — we can find value when KTO odds are worse than reference)
  const effectiveModelProbs = modelProbs ?? vigRemoved.map(o => o.fairProb);

  const bets: BetAnalysis[] = outcomes.map((outcome, i) => {
    const modelProb = effectiveModelProbs[i] ?? vigRemoved[i].fairProb;
    const implied = vigRemoved[i].impliedProb;
    const fair = vigRemoved[i].fairProb;
    const ev = calculateEV(modelProb, outcome.price);
    const evPercent = parseFloat((ev * 100).toFixed(2));
    const kelly = kellyCriterion(modelProb, outcome.price);
    const edge = parseFloat((modelProb - fair).toFixed(4));
    const { rating, label } = rateBet(ev, edge);

    return {
      outcome: outcome.name,
      odds: outcome.price,
      modelProb,
      impliedProb: implied,
      fairProb: fair,
      ev,
      evPercent,
      kellyFraction: kelly,
      edge,
      rating,
      label,
    };
  });

  const valueBets = bets.filter(b => b.ev > 0.01);
  const bestValueBet = valueBets.length > 0
    ? valueBets.reduce((best, b) => b.ev > best.ev ? b : best, valueBets[0])
    : null;

  return {
    outcomes: bets,
    bookmakerMargin: margin,
    sharpestBookmaker: bookmakerName,
    bestValueBet,
    hasValueBet: valueBets.length > 0,
  };
}

/**
 * Calculate EV when user manually enters KTO odds for a specific outcome.
 * Model probability comes from our analysis of the reference bookmaker.
 */
export function calcKtoEV(
  ktoOdds: number,
  modelProbability: number
): {
  ev: number;
  evPercent: number;
  kellyFraction: number;
  isValue: boolean;
  label: string;
} {
  const ev = calculateEV(modelProbability, ktoOdds);
  const evPercent = parseFloat((ev * 100).toFixed(2));
  const kellyFraction = kellyCriterion(modelProbability, ktoOdds);
  const isValue = ev > 0;
  const { label } = rateBet(ev, modelProbability - impliedProb(ktoOdds));

  return { ev, evPercent, kellyFraction, isValue, label };
}

// ─── Formatting helpers ────────────────────────────────────────────────────────

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

export function ratingColor(rating: BetRating): string {
  switch (rating) {
    case 'excellent': return '#f97316'; // orange
    case 'good': return '#22c55e';      // green
    case 'neutral': return '#eab308';   // yellow
    case 'bad': return '#94a3b8';       // gray
    case 'avoid': return '#ef4444';     // red
  }
}
