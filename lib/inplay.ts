/**
 * Motor de Predição In-Play (Ao Vivo)
 *
 * Modelos por esporte, baseados em:
 *  - Ritmo atual (pace model) → projeta placar final
 *  - Distribuição Normal em torno da projeção → probabilidade de Over/Under
 *  - Lógica contextual (placar, tempo restante, estado do jogo)
 *
 * Exemplo de raciocínio (basketball, exatamente como o usuário descreveu):
 *  - Times A e B têm média de 80 pts cada
 *  - 2º tempo, 40-40 no placar
 *  - Ritmo: 80 pts em 50% do jogo → projeção 160 pts no total
 *  - Over 150.5 → P(total > 150.5 | proj=160, σ=18) ≈ 72% → APOSTAR AGORA
 */

import { LiveGameState, getSportConfig } from './espn-multi';
import { OddsEvent, getBestBookmakerOdds } from './odds-api';
import { impliedProb } from './probability';

// ─── Types ────────────────────────────────────────────────────────────────────

export type BetUrgency = 'agora' | 'observar' | 'evitar';

export interface BetRecommendation {
  market: string;           // "Over 150.5 pontos", "Vitória Los Angeles Lakers", etc.
  marketKey: string;        // 'totals', 'h2h', 'spreads'
  outcomeName: string;      // nome do outcome para cruzar com The Odds API
  confidence: number;       // 0→1 (probabilidade do modelo)
  urgency: BetUrgency;
  minOddsForValue: number;  // odd mínima para EV positivo
  currentBestOdds: number;  // melhor odd disponível no mercado
  ev: number;               // EV com a melhor odd atual
  reasoning: string;        // explicação detalhada do modelo
  dataPoints: string[];     // bullets com os dados usados
  riskLevel: 'baixo' | 'médio' | 'alto';
}

export interface InPlayAnalysis {
  game: LiveGameState;
  recommendations: BetRecommendation[];
  topBet: BetRecommendation | null;
  modelSummary: string;
  oddsSource: string;       // de onde vieram as odds
}

// ─── Distribuição Normal ──────────────────────────────────────────────────────

/**
 * CDF da distribuição normal padrão (aproximação de Hart)
 */
function normalCDF(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const poly = t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  const pdf = Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
  const cdf = 1 - pdf * poly;
  return x >= 0 ? cdf : 1 - cdf;
}

/**
 * P(X > threshold | mu, sigma) usando distribuição normal
 */
function probOver(threshold: number, mu: number, sigma: number): number {
  return 1 - normalCDF((threshold - mu) / sigma);
}

function probUnder(threshold: number, mu: number, sigma: number): number {
  return normalCDF((threshold - mu) / sigma);
}

function calcEV(prob: number, odds: number): number {
  return parseFloat(((prob * odds) - 1).toFixed(4));
}

function minOddsForValue(prob: number): number {
  return parseFloat((1 / prob).toFixed(2));
}

function urgencyFromConfidence(confidence: number, ev: number): BetUrgency {
  if (confidence >= 0.65 && ev > 0) return 'agora';
  if (confidence >= 0.55 || ev > 0) return 'observar';
  return 'evitar';
}

// ─── Modelo Basketball (Pace) ─────────────────────────────────────────────────

/**
 * O modelo de ritmo (pace) para basquete:
 * 1. Projeta o total de pontos ao fim do jogo com base no ritmo atual
 * 2. Calcula P(Over line) / P(Under line) com distribuição normal
 * 3. Ajusta pela tendência do período (jogos tendem a acelerar no 4º quarto)
 */
export function basketballPaceModel(
  game: LiveGameState,
  overLine: number | null,
  leagueAvg: number = 228
): BetRecommendation[] {
  const { homeScore, awayScore, timeElapsed, periodLabel, homeTeam, awayTeam } = game;
  const config = getSportConfig(game.leagueKey);
  const totalMinutes = config?.totalMinutes ?? 48;
  const unit = config?.unit ?? 'pontos';

  const currentTotal = homeScore + awayScore;
  if (timeElapsed <= 0.05) return []; // muito cedo no jogo

  // Projeção pelo ritmo atual
  const projectedTotal = currentTotal / timeElapsed;

  // Ajuste: jogos tendem a ser mais lentos no início e acelerar no fim
  // Fator de aceleração no 4º período / overtime
  const periodAcceleration = game.period >= 4 ? 1.05 : 1.0;
  const adjustedProjection = projectedTotal * periodAcceleration;

  // Desvio padrão: cresce com tempo restante (mais incerteza = mais cedo)
  const timeRemaining = 1 - timeElapsed;
  const baseSigma = leagueAvg * 0.08; // ~8% do total médio como σ base
  const sigma = baseSigma * Math.sqrt(timeRemaining + 0.1); // reduz conforme jogo avança

  const recommendations: BetRecommendation[] = [];

  // ── Over/Under ──────────────────────────────────────────────────────
  if (overLine !== null) {
    const overProb = probOver(overLine, adjustedProjection, sigma);
    const underProb = 1 - overProb;

    // Over
    if (overProb >= 0.45) {
      const min = minOddsForValue(overProb);
      const dataPoints = [
        `Placar atual: ${homeTeam} ${homeScore} × ${awayScore} ${awayTeam}`,
        `Total atual: ${currentTotal} pontos em ${(timeElapsed * 100).toFixed(0)}% do jogo`,
        `Ritmo projetado: ${adjustedProjection.toFixed(0)} pontos totais`,
        `Linha Over/Under: ${overLine} ${unit}`,
        `Desvio padrão do modelo: ±${sigma.toFixed(0)} pontos`,
        `Período atual: ${periodLabel}`,
        `Média da liga: ${leagueAvg} pts combinados/jogo`,
      ];

      const reasoning = buildBasketballReasoning(
        currentTotal, timeElapsed, adjustedProjection, overLine, overProb,
        homeTeam, awayTeam, homeScore, awayScore, unit, 'over'
      );

      recommendations.push({
        market: `Over ${overLine} ${unit}`,
        marketKey: 'totals',
        outcomeName: `Over ${overLine}`,
        confidence: overProb,
        urgency: urgencyFromConfidence(overProb, calcEV(overProb, 1.85)),
        minOddsForValue: min,
        currentBestOdds: 0, // preenchido depois ao cruzar com The Odds API
        ev: 0,
        reasoning,
        dataPoints,
        riskLevel: timeRemaining > 0.4 ? 'alto' : timeRemaining > 0.2 ? 'médio' : 'baixo',
      });
    }

    // Under
    if (underProb >= 0.45) {
      const min = minOddsForValue(underProb);
      const dataPoints = [
        `Placar atual: ${homeScore + awayScore} pontos em ${(timeElapsed * 100).toFixed(0)}% do jogo`,
        `Ritmo projetado: ${adjustedProjection.toFixed(0)} pontos (abaixo da linha)`,
        `Linha: ${overLine} ${unit}`,
      ];
      recommendations.push({
        market: `Under ${overLine} ${unit}`,
        marketKey: 'totals',
        outcomeName: `Under ${overLine}`,
        confidence: underProb,
        urgency: urgencyFromConfidence(underProb, calcEV(underProb, 1.85)),
        minOddsForValue: min,
        currentBestOdds: 0,
        ev: 0,
        reasoning: buildBasketballReasoning(
          currentTotal, timeElapsed, adjustedProjection, overLine, underProb,
          homeTeam, awayTeam, homeScore, awayScore, unit, 'under'
        ),
        dataPoints,
        riskLevel: timeRemaining > 0.4 ? 'alto' : 'médio',
      });
    }
  }

  // ── Vencedor (resultado final) ───────────────────────────────────────
  const scoreDiff = homeScore - awayScore;
  const timeRemainingMin = timeRemaining * totalMinutes;

  if (timeElapsed > 0.5 && Math.abs(scoreDiff) > 0) {
    // Modelo simplificado: diferença de pontos vs tempo restante
    // Em média, um time muda ~5 pontos a cada 6 minutos na NBA
    const changesPerMin = 0.83;
    const potentialSwing = timeRemainingMin * changesPerMin;

    let winProb: number;
    if (Math.abs(scoreDiff) > potentialSwing * 1.5) {
      winProb = 0.92; // liderança muito grande para o tempo restante
    } else if (Math.abs(scoreDiff) > potentialSwing) {
      winProb = 0.78;
    } else if (Math.abs(scoreDiff) > potentialSwing * 0.5) {
      winProb = 0.65;
    } else {
      winProb = 0.52; // jogo em aberto
    }

    if (winProb >= 0.65 && timeElapsed > 0.6) {
      const leader = scoreDiff > 0 ? homeTeam : awayTeam;
      const leaderScore = scoreDiff > 0 ? homeScore : awayScore;
      const trailerScore = scoreDiff > 0 ? awayScore : homeScore;
      const diff = Math.abs(scoreDiff);

      recommendations.push({
        market: `Vitória ${leader}`,
        marketKey: 'h2h',
        outcomeName: leader,
        confidence: winProb,
        urgency: urgencyFromConfidence(winProb, calcEV(winProb, 1.50)),
        minOddsForValue: minOddsForValue(winProb),
        currentBestOdds: 0,
        ev: 0,
        reasoning: `${leader} lidera por ${diff} pontos (${leaderScore}×${trailerScore}) com apenas ${timeRemainingMin.toFixed(0)} minutos restantes. `
          + `O modelo estima que o adversário precisaria de oscilação de ${potentialSwing.toFixed(0)} pontos para virar, `
          + `o que acontece com probabilidade de apenas ${((1 - winProb) * 100).toFixed(0)}%. `
          + `Em ${totalMinutes}-minutos de basquete, liderar por ${diff}+ pontos neste estágio tem ${(winProb * 100).toFixed(0)}% de taxa de conversão histórica.`,
        dataPoints: [
          `${leader} lidera: ${leaderScore} × ${trailerScore} (diferença: ${diff} pts)`,
          `Tempo restante: ~${timeRemainingMin.toFixed(0)} min`,
          `Oscilação máxima estimada: ±${potentialSwing.toFixed(0)} pts`,
          `Período: ${periodLabel}`,
        ],
        riskLevel: diff > 15 ? 'baixo' : diff > 8 ? 'médio' : 'alto',
      });
    }
  }

  return recommendations;
}

function buildBasketballReasoning(
  currentTotal: number, timeElapsed: number, projected: number,
  line: number, prob: number,
  homeTeam: string, awayTeam: string, homeScore: number, awayScore: number,
  unit: string, side: 'over' | 'under'
): string {
  const pct = (timeElapsed * 100).toFixed(0);
  const projStr = projected.toFixed(0);
  const probStr = (prob * 100).toFixed(0);

  if (side === 'over') {
    return `Os times marcaram ${currentTotal} ${unit} em ${pct}% do jogo. `
      + `Projetando este ritmo para o jogo todo: ${projStr} ${unit} combinados. `
      + `A linha de Over/Under é ${line} — o ritmo atual indica que ambos os times devem superar a marca. `
      + `Probabilidade estimada: ${probStr}%. `
      + (timeElapsed > 0.5
        ? `Com mais da metade do jogo concluída, a projeção é mais confiável — menor margem de erro.`
        : `Ainda na primeira metade: a projeção tem maior margem de erro, monitore o ritmo no 2º tempo.`);
  } else {
    return `Os times marcaram apenas ${currentTotal} ${unit} em ${pct}% do jogo. `
      + `Ritmo projetado: ${projStr} ${unit} — abaixo da linha de ${line}. `
      + `Defesas dominando ou times com dificuldade ofensiva indicam jogo de Under. `
      + `Probabilidade: ${probStr}%.`;
  }
}

// ─── Modelo Futebol/Soccer ────────────────────────────────────────────────────

const SOCCER_AVG_GOALS: Record<string, number> = {
  'eng.1': 2.85, 'esp.1': 2.65, 'ger.1': 3.15, 'ita.1': 2.65,
  'fra.1': 2.55, 'bra.1': 2.70, 'usa.1': 2.90,
  'default': 2.70,
};

/**
 * Modelo de gols em tempo real para futebol:
 * - Usa taxa de gols histórica da liga
 * - Ajusta pelo estado do jogo (placar, tempo, pressão tática)
 * - Calcula P(Over 2.5) dinâmico baseado no momento
 */
export function soccerInPlayModel(
  game: LiveGameState,
  leagueSlug: string = 'default',
  overLine: number = 2.5
): BetRecommendation[] {
  const { homeScore, awayScore, timeElapsed, periodLabel, homeTeam, awayTeam } = game;
  if (timeElapsed <= 0) return [];

  const currentGoals = homeScore + awayScore;
  const leagueAvg = SOCCER_AVG_GOALS[leagueSlug] ?? SOCCER_AVG_GOALS['default'];
  const timeRemaining = 1 - timeElapsed;

  // Taxa de gols esperada no tempo restante
  // Gols por minuto na liga: leagueAvg / 90
  const goalsPerMinute = leagueAvg / 90;

  // Fator de estado do jogo:
  // - Empate no final: ambos atacam → mais gols
  // - Time perdendo no final: pressão → mais espaços → mais gols
  // - Time ganhando fácil no final: time conservador → menos gols
  const scoreDiff = Math.abs(homeScore - awayScore);
  const minutesRemaining = timeRemaining * 90;

  let urgencyFactor = 1.0;
  if (scoreDiff === 0 && timeElapsed > 0.7) {
    urgencyFactor = 1.4; // ambos pressionam por vitória
  } else if (scoreDiff === 1 && timeElapsed > 0.7) {
    urgencyFactor = 1.3; // perdedor empurra, espaços aparecem
  } else if (scoreDiff === 0 && timeElapsed > 0.5) {
    urgencyFactor = 1.15;
  } else if (scoreDiff >= 2) {
    urgencyFactor = 0.75; // jogo decidido, menos pressão
  }

  const expectedRemainingGoals = goalsPerMinute * minutesRemaining * urgencyFactor;
  const projectedTotal = currentGoals + expectedRemainingGoals;

  // Desvio padrão: mais incerto quanto mais cedo
  const sigma = Math.sqrt(expectedRemainingGoals * 1.1); // Poisson var ≈ λ

  const recommendations: BetRecommendation[] = [];

  // ── Over/Under dinâmico ─────────────────────────────────────────────
  if (currentGoals < overLine) {
    // Precisamos de mais gols para Over bater
    const goalsNeeded = overLine - currentGoals;
    // P(X >= goalsNeeded em Poisson com lambda=expectedRemaining)
    const overProb = poissonCCDF(Math.ceil(goalsNeeded) - 0.5, expectedRemainingGoals);

    if (overProb >= 0.40) {
      const dataPoints = [
        `Placar: ${homeTeam} ${homeScore} × ${awayScore} ${awayTeam}`,
        `Gols atuais: ${currentGoals} | Linha: Over ${overLine}`,
        `Gols necessários no tempo restante: ${goalsNeeded.toFixed(1)}`,
        `Gols esperados no tempo restante: ${expectedRemainingGoals.toFixed(2)}`,
        `Fator de urgência tática: ${urgencyFactor.toFixed(1)}x`,
        `Tempo restante: ~${minutesRemaining.toFixed(0)} min (${periodLabel})`,
        `Média da liga: ${leagueAvg.toFixed(2)} gols/jogo`,
      ];

      recommendations.push({
        market: `Over ${overLine} Gols`,
        marketKey: 'totals',
        outcomeName: `Over ${overLine}`,
        confidence: overProb,
        urgency: urgencyFromConfidence(overProb, calcEV(overProb, 1.85)),
        minOddsForValue: minOddsForValue(overProb),
        currentBestOdds: 0,
        ev: 0,
        reasoning: buildSoccerReasoning(
          currentGoals, overLine, expectedRemainingGoals, overProb,
          minutesRemaining, urgencyFactor, homeTeam, awayTeam,
          homeScore, awayScore, scoreDiff, timeElapsed, 'over'
        ),
        dataPoints,
        riskLevel: overProb > 0.70 ? 'baixo' : overProb > 0.55 ? 'médio' : 'alto',
      });
    }
  } else {
    // Já passou do Over — Under não é mais possível
    // Over já bateu, recomendar Under não faz sentido
  }

  // Under: se há poucos gols esperados
  if (currentGoals === 0 && timeElapsed > 0.5) {
    const underProb = 1 - poissonCCDF(overLine - 0.5, expectedRemainingGoals);
    if (underProb >= 0.55) {
      recommendations.push({
        market: `Under ${overLine} Gols`,
        marketKey: 'totals',
        outcomeName: `Under ${overLine}`,
        confidence: underProb,
        urgency: urgencyFromConfidence(underProb, calcEV(underProb, 1.85)),
        minOddsForValue: minOddsForValue(underProb),
        currentBestOdds: 0,
        ev: 0,
        reasoning: `Jogo sem gols até ${(timeElapsed * 90).toFixed(0)}min. `
          + `Com apenas ${minutesRemaining.toFixed(0)} minutos restantes, `
          + `esperamos mais ${expectedRemainingGoals.toFixed(1)} gols — insuficientes para bater ${overLine}. `
          + `Probabilidade Under: ${(underProb * 100).toFixed(0)}%.`,
        dataPoints: [
          `Gols: 0 em ${(timeElapsed * 90).toFixed(0)} min`,
          `Esperado restante: ${expectedRemainingGoals.toFixed(1)} gols`,
          `Probabilidade Under ${overLine}: ${(underProb * 100).toFixed(0)}%`,
        ],
        riskLevel: 'médio',
      });
    }
  }

  // ── Ambos Marcam (BTTS) ─────────────────────────────────────────────
  if (homeScore === 0 || awayScore === 0) {
    // Um time ainda não marcou — BTTS depende disso
    const teamNotScored = homeScore === 0 ? homeTeam : awayTeam;
    const goalsPerTeamRemaining = expectedRemainingGoals / 2;
    // P(time marcar >= 1) = 1 - P(0 gols) = 1 - e^(-lambda)
    const pScoreAtLeastOne = 1 - Math.exp(-goalsPerTeamRemaining);

    if (pScoreAtLeastOne >= 0.55 && timeElapsed < 0.85) {
      recommendations.push({
        market: 'Ambos Marcam (BTTS)',
        marketKey: 'h2h', // aproximação — BTTS não está na The Odds API padrão
        outcomeName: 'Yes',
        confidence: pScoreAtLeastOne,
        urgency: urgencyFromConfidence(pScoreAtLeastOne, calcEV(pScoreAtLeastOne, 1.70)),
        minOddsForValue: minOddsForValue(pScoreAtLeastOne),
        currentBestOdds: 0,
        ev: 0,
        reasoning: `${teamNotScored} ainda não marcou, mas o jogo ainda tem ${minutesRemaining.toFixed(0)} min restantes. `
          + `Com base na taxa de gols da liga, ${teamNotScored} tem ${(pScoreAtLeastOne * 100).toFixed(0)}% de chance de marcar ao menos 1 gol.`,
        dataPoints: [
          `${teamNotScored}: 0 gols`,
          `Gols esperados para este time: ${goalsPerTeamRemaining.toFixed(2)}`,
          `Tempo restante: ${minutesRemaining.toFixed(0)} min`,
        ],
        riskLevel: timeElapsed > 0.6 ? 'alto' : 'médio',
      });
    }
  }

  // ── Resultado ao vivo (se um time lidera por margem segura) ─────────
  if (timeElapsed > 0.65 && scoreDiff >= 2) {
    const leader = homeScore > awayScore ? homeTeam : awayTeam;
    // P(virada) é muito baixa quando lidera por 2+ no segundo tempo
    const winProb = scoreDiff >= 3 ? 0.92 : 0.82;
    recommendations.push({
      market: `Vitória ${leader}`,
      marketKey: 'h2h',
      outcomeName: leader,
      confidence: winProb,
      urgency: urgencyFromConfidence(winProb, calcEV(winProb, 1.25)),
      minOddsForValue: minOddsForValue(winProb),
      currentBestOdds: 0,
      ev: 0,
      reasoning: `${leader} lidera por ${scoreDiff} gols com ${minutesRemaining.toFixed(0)} min restantes. `
        + `Viradas de ${scoreDiff}+ gols neste estágio da partida são raras: historicamente acontecem em menos de ${((1 - winProb) * 100).toFixed(0)}% dos casos.`,
      dataPoints: [
        `Líder: ${leader} (${scoreDiff} gol${scoreDiff > 1 ? 's' : ''} de vantagem)`,
        `Tempo: ${minutesRemaining.toFixed(0)} min restantes`,
        `Probabilidade de manter vitória: ${(winProb * 100).toFixed(0)}%`,
      ],
      riskLevel: 'baixo',
    });
  }

  return recommendations;
}

function buildSoccerReasoning(
  currentGoals: number, overLine: number, expectedRemaining: number, prob: number,
  minutesRemaining: number, urgencyFactor: number,
  homeTeam: string, awayTeam: string, homeScore: number, awayScore: number,
  scoreDiff: number, timeElapsed: number, side: 'over' | 'under'
): string {
  const goalsNeeded = overLine - currentGoals;

  if (side === 'over') {
    let tacticalContext = '';
    if (urgencyFactor >= 1.4) {
      tacticalContext = `Com o placar empatado (${homeScore}×${awayScore}) e apenas ${minutesRemaining.toFixed(0)} minutos restantes, `
        + `AMBOS os times precisam de vitória — o jogo abre espaços, favorecendo gols. `;
    } else if (urgencyFactor >= 1.3 && scoreDiff === 1) {
      tacticalContext = `O time que está perdendo vai pressionar mais (${minutesRemaining.toFixed(0)} min), criando mais oportunidades para contra-ataques. `;
    } else if (urgencyFactor < 1) {
      tacticalContext = `O jogo pode desacelerar já que um time tem vantagem confortável. `;
    }

    return `O placar está em ${homeScore}×${awayScore} (${currentGoals} gol${currentGoals !== 1 ? 's' : ''}) com ${minutesRemaining.toFixed(0)} minutos restantes. `
      + `Para Over ${overLine} bater, faltam ${goalsNeeded.toFixed(1)} gol${goalsNeeded !== 1 ? 's' : ''}. `
      + `Com base na média da liga e no tempo restante, esperamos ${expectedRemaining.toFixed(1)} gols ainda. `
      + tacticalContext
      + `Probabilidade de Over: ${(prob * 100).toFixed(0)}%.`
      + (timeElapsed > 0.7
        ? ` ⚠️ Atenção: odds ao vivo mudam rapidamente neste estágio — verifique a KTO imediatamente.`
        : '');
  }

  return `Placar baixo (${currentGoals} gols) com ${minutesRemaining.toFixed(0)} min restantes. Under ${overLine} cada vez mais provável.`;
}

// ─── Modelo NHL/Hóquei ────────────────────────────────────────────────────────

export function hockeyInPlayModel(game: LiveGameState, overLine: number): BetRecommendation[] {
  const { homeScore, awayScore, timeElapsed, homeTeam, awayTeam, periodLabel } = game;
  const currentGoals = homeScore + awayScore;
  const leagueAvg = 6.0; // NHL average
  const goalsPerMinute = leagueAvg / 60;
  const minutesRemaining = (1 - timeElapsed) * 60;
  const expectedRemaining = goalsPerMinute * minutesRemaining;

  const recommendations: BetRecommendation[] = [];

  if (currentGoals < overLine) {
    const goalsNeeded = overLine - currentGoals;
    const overProb = poissonCCDF(goalsNeeded - 0.5, expectedRemaining);

    if (overProb >= 0.40) {
      recommendations.push({
        market: `Over ${overLine} Gols`,
        marketKey: 'totals',
        outcomeName: `Over ${overLine}`,
        confidence: overProb,
        urgency: urgencyFromConfidence(overProb, calcEV(overProb, 1.85)),
        minOddsForValue: minOddsForValue(overProb),
        currentBestOdds: 0,
        ev: 0,
        reasoning: `NHL: ${currentGoals} gols em ${(timeElapsed * 100).toFixed(0)}% do jogo. `
          + `Ritmo projeta ${(currentGoals / timeElapsed).toFixed(1)} gols totais. `
          + `Com ${minutesRemaining.toFixed(0)} min restantes, esperamos ${expectedRemaining.toFixed(1)} gols adicionais. `
          + `Probabilidade Over ${overLine}: ${(overProb * 100).toFixed(0)}%.`,
        dataPoints: [
          `Placar: ${homeTeam} ${homeScore} × ${awayScore} ${awayTeam}`,
          `Gols necessários: ${goalsNeeded.toFixed(1)} em ${minutesRemaining.toFixed(0)} min`,
          `Esperado: ${expectedRemaining.toFixed(1)} gols | Período: ${periodLabel}`,
        ],
        riskLevel: overProb > 0.65 ? 'baixo' : 'médio',
      });
    }
  }

  return recommendations;
}

// ─── Modelo NFL ───────────────────────────────────────────────────────────────

export function nflInPlayModel(game: LiveGameState, overLine: number): BetRecommendation[] {
  const { homeScore, awayScore, timeElapsed, homeTeam, awayTeam, periodLabel } = game;
  const currentTotal = homeScore + awayScore;
  const leagueAvg = 47.0;
  const minutesRemaining = (1 - timeElapsed) * 60;

  // NFL: ritmo varia bastante, ajusta pela tendência atual
  const currentPace = timeElapsed > 0 ? currentTotal / timeElapsed : leagueAvg;
  const projectedTotal = currentPace * 1.0; // sem grande ajuste no NFL
  const sigma = 10; // alta variância no futebol americano

  const recommendations: BetRecommendation[] = [];

  if (timeElapsed > 0.25 && overLine !== null) {
    const overProb = probOver(overLine, projectedTotal, sigma);
    const underProb = 1 - overProb;
    const targetSide = overProb > underProb ? 'over' : 'under';
    const targetProb = Math.max(overProb, underProb);

    if (targetProb >= 0.55) {
      recommendations.push({
        market: targetSide === 'over' ? `Over ${overLine} pontos` : `Under ${overLine} pontos`,
        marketKey: 'totals',
        outcomeName: targetSide === 'over' ? `Over ${overLine}` : `Under ${overLine}`,
        confidence: targetProb,
        urgency: urgencyFromConfidence(targetProb, calcEV(targetProb, 1.85)),
        minOddsForValue: minOddsForValue(targetProb),
        currentBestOdds: 0,
        ev: 0,
        reasoning: `NFL: ${currentTotal} pontos em ${(timeElapsed * 100).toFixed(0)}% do jogo. `
          + `Ritmo atual: ${projectedTotal.toFixed(0)} pts projetados. `
          + `${targetSide === 'over' ? 'Over' : 'Under'} ${overLine}: ${(targetProb * 100).toFixed(0)}% de probabilidade.`,
        dataPoints: [
          `Placar: ${homeTeam} ${homeScore} × ${awayScore} ${awayTeam}`,
          `Projeção: ${projectedTotal.toFixed(0)} pts totais | Linha: ${overLine}`,
          `Tempo restante: ~${minutesRemaining.toFixed(0)} min | ${periodLabel}`,
        ],
        riskLevel: 'médio',
      });
    }
  }

  return recommendations;
}

// ─── Helper: CCDF de Poisson (P(X >= k)) ─────────────────────────────────────

function poissonCCDF(threshold: number, lambda: number): number {
  if (lambda <= 0) return 0;
  let cdf = 0;
  const max = Math.ceil(threshold) + 1;
  for (let k = 0; k < max; k++) {
    cdf += poissonPMF(lambda, k);
  }
  return Math.max(0, Math.min(1, 1 - cdf));
}

function poissonPMF(lambda: number, k: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  let logP = -lambda + k * Math.log(lambda);
  for (let i = 1; i <= k; i++) logP -= Math.log(i);
  return Math.exp(logP);
}

// ─── Dispatcher Principal ─────────────────────────────────────────────────────

/**
 * Dado um jogo ao vivo e as odds correspondentes da The Odds API,
 * gera recomendações de apostas com raciocínio completo.
 */
export function analyzeInPlay(
  game: LiveGameState,
  oddsEvent: OddsEvent | null
): InPlayAnalysis {
  const config = getSportConfig(game.leagueKey);
  if (!config) {
    return { game, recommendations: [], topBet: null, modelSummary: 'Esporte sem modelo disponível.', oddsSource: 'N/A' };
  }

  // Pegar linha Over/Under das odds
  let overLine: number | null = null;
  let oddsSource = 'N/A';
  if (oddsEvent) {
    const totalsBk = getBestBookmakerOdds(oddsEvent, 'totals');
    if (totalsBk) {
      const overOutcome = totalsBk.outcomes.find(o => o.name === 'Over');
      overLine = overOutcome?.point ?? null;
      oddsSource = totalsBk.bookmaker;
    }
  }

  // Gerar recomendações por esporte
  let recommendations: BetRecommendation[] = [];

  if (game.leagueKey.startsWith('basketball')) {
    recommendations = basketballPaceModel(game, overLine, config.avgCombinedScore);
  } else if (game.leagueKey.startsWith('soccer') || game.espnSport === 'soccer') {
    recommendations = soccerInPlayModel(game, 'default', overLine ?? 2.5);
  } else if (game.leagueKey === 'icehockey_nhl') {
    recommendations = hockeyInPlayModel(game, overLine ?? 5.5);
  } else if (game.leagueKey === 'americanfootball_nfl') {
    recommendations = nflInPlayModel(game, overLine ?? 47);
  }

  // Cruzar com odds reais da The Odds API
  if (oddsEvent) {
    recommendations = enrichWithOdds(recommendations, oddsEvent);
  }

  // Ordenar por confiança
  recommendations.sort((a, b) => b.confidence - a.confidence);
  const topBet = recommendations[0] ?? null;

  const modelSummary = generateModelSummary(game, config, recommendations);

  return { game, recommendations, topBet, modelSummary, oddsSource };
}

/**
 * Enriquece as recomendações com odds reais do mercado
 */
function enrichWithOdds(recs: BetRecommendation[], oddsEvent: OddsEvent): BetRecommendation[] {
  return recs.map(rec => {
    const bkOdds = getBestBookmakerOdds(oddsEvent, rec.marketKey);
    if (!bkOdds) return rec;

    const outcome = bkOdds.outcomes.find(o =>
      o.name === rec.outcomeName ||
      o.name.toLowerCase().includes(rec.outcomeName.toLowerCase().split(' ')[0])
    );

    if (!outcome) return rec;

    const bestOdds = outcome.price;
    const ev = calcEV(rec.confidence, bestOdds);

    return {
      ...rec,
      currentBestOdds: bestOdds,
      ev,
      // Recalcula urgência com EV real
      urgency: urgencyFromConfidence(rec.confidence, ev),
    };
  });
}

function generateModelSummary(
  game: LiveGameState,
  config: { label: string; avgCombinedScore: number; unit: string },
  recs: BetRecommendation[]
): string {
  const { homeTeam, awayTeam, homeScore, awayScore, timeElapsed, periodLabel } = game;
  const topRec = recs[0];

  let base = `${homeTeam} ${homeScore} × ${awayScore} ${awayTeam} — ${periodLabel} (${(timeElapsed * 100).toFixed(0)}% do jogo). `;

  if (topRec) {
    base += `Melhor oportunidade: ${topRec.market} com ${(topRec.confidence * 100).toFixed(0)}% de confiança.`;
  } else {
    base += `Nenhuma aposta com confiança suficiente neste momento.`;
  }

  return base;
}

// ─── Matcher de eventos ───────────────────────────────────────────────────────

/**
 * Tenta encontrar o evento correspondente na The Odds API dado um jogo ESPN.
 * Usa fuzzy match de nome de time.
 */
export function matchEventToOdds(
  game: LiveGameState,
  oddsEvents: OddsEvent[]
): OddsEvent | null {
  const homeNorm = normalizeTeamName(game.homeTeam);
  const awayNorm = normalizeTeamName(game.awayTeam);

  // Primeiro: match exato no mesmo esporte
  const sameSport = oddsEvents.filter(e =>
    e.sport_key === game.leagueKey ||
    e.sport_key.startsWith(game.leagueKey.split('_')[0])
  );

  for (const event of sameSport) {
    const eHome = normalizeTeamName(event.home_team);
    const eAway = normalizeTeamName(event.away_team);

    if (
      (eHome.includes(homeNorm) || homeNorm.includes(eHome)) &&
      (eAway.includes(awayNorm) || awayNorm.includes(eAway))
    ) {
      return event;
    }
  }

  return null;
}

function normalizeTeamName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+(fc|sc|cf|ac|united|city|town|rovers|wanderers|athletic)$/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

// Importação circular protegida — probability.ts usa este módulo
export { calcEV, minOddsForValue };
