# 🎯 Roadmap — FutebolAoVivo → Plataforma de Apostas por IA

> **Objetivo:** Plataforma pessoal de análise preditiva multi-esporte baseada em probabilidade e Machine Learning, com foco em identificar apostas de valor (Value Bets) na KTO.

---

## 🏗️ Arquitetura do Sistema

```
ESPN API (ao vivo)          → Dados de futebol em tempo real
The Odds API (gratuita)     → Odds de múltiplas casas (Pinnacle, Bet365, etc.)
Modelo Poisson (matemático) → Predição de futebol (sem ML externo)
Modelos Estatísticos        → Outros esportes (baseados em odds de mercado)
                                         ↓
                            Motor de Análise (probability.ts)
                            ├─ Probabilidade implícita das odds
                            ├─ Remoção de margem da casa (vig)
                            ├─ Comparação modelo vs mercado
                            ├─ Cálculo de EV (valor esperado)
                            └─ Kelly Criterion (tamanho do stake)
                                         ↓
                            Página /eventos (NextJS)
                            ├─ Todos os esportes disponíveis
                            ├─ Filtros: Value Bets, Maior EV, Maior Odd
                            ├─ Badges: ✅ Valor Alto / ⚠️ Risco / ❌ Desvantagem
                            └─ Input manual de odds KTO para qualquer evento
```

---

## 📍 Estado Atual (Março 2026)

| Item | Status |
|---|---|
| Placares ao vivo (ESPN) | ✅ Funcionando |
| 13 ligas de futebol | ✅ Funcionando |
| Detalhe de partida (stats + lineup) | ✅ Funcionando |
| Multi-esporte | ❌ Em construção |
| Odds de mercado | ❌ Em construção |
| Motor de probabilidade | ❌ Em construção |
| Análise de valor (EV) | ❌ Em construção |
| Banco de dados / histórico | ❌ Planejado (Fase 2) |
| Modelos ML avançados | ❌ Planejado (Fase 3) |

---

## ⚙️ APIs Utilizadas

### 1. ESPN API (atual — dados ao vivo)
- **Custo:** Gratuita (não oficial)
- **Cobertura:** 13 ligas de futebol, placares ao vivo, stats, escalações
- **Uso:** Base de dados em tempo real para futebol

### 2. The Odds API (nova — odds multi-esporte)
- **Custo:** Gratuita até 500 req/mês → ~$5/mês para 10.000 req
- **Signup:** https://the-odds-api.com
- **Cobertura:** 30+ esportes, 40+ bookmakers (Pinnacle, Bet365, Betfair, etc.)
- **Esportes:** Futebol (40+ ligas), Basquete (NBA, WNBA), Tênis, MMA/UFC,
  Futebol Americano (NFL), Beisebol (MLB), Hóquei (NHL), Rugby, Críquete, eSports

### 3. KTO (estratégia de integração)
- **KTO não tem API pública** — mas isso não é um problema
- **Estratégia:**
  - Odds de REFERÊNCIA vêm da The Odds API (Pinnacle = odds mais precisas do mundo)
  - O sistema calcula: `Probabilidade do Modelo vs. Probabilidade Implícita (Pinnacle)`
  - Quando EV > 0% com Pinnacle, quase certamente é EV > 0% com KTO também
    (KTO tem margens maiores = odds piores = ainda mais valor para quem tem o modelo)
  - Aba dedicada: usuário digita odds da KTO para qualquer evento e vê o EV instantaneamente

---

## 🗺️ Fases

---

### ✅ FASE 0 — Base (Concluída)
- Next.js 16 + TypeScript + Tailwind configurados
- ESPN API integrada para futebol ao vivo
- Páginas: hoje, ao vivo, semana, competições, detalhe de partida

---

### 🔄 FASE 1 — Multi-esporte + Odds (Em andamento)

**1.1 — Integração The Odds API**
- `lib/odds-api.ts` — cliente tipado para todos os esportes
- `app/api/odds/[sport]/route.ts` — proxy seguro (esconde API key)
- Suporte a 30+ esportes com odds em tempo real

**1.2 — Motor de Probabilidade**
- `lib/probability.ts` — cálculos estatísticos
- Conversão odds → probabilidade implícita
- Remoção de vig (margem da casa)
- Cálculo de EV: `EV = (prob_modelo × odd) - 1`
- Kelly Criterion: `K = (p × b - q) / b`
- Modelo Poisson para futebol (matemático, sem ML externo)

**1.3 — Página /eventos**
- Grid de todos os esportes com odds
- Filtros: Sport, League, Value Bets (EV > X%), Maior Odd, Hoje/Semana
- Cards com análise: probabilidade implícita, EV, badge de valor
- Aba "KTO Manual" — digitar odds e calcular EV em tempo real

**Entregável:** Sistema funcional de análise de value bets.

---

### 📦 FASE 2 — Banco de Dados + Histórico

**2.1 — PostgreSQL via Supabase**
- Tabelas: `events`, `odds_snapshots`, `predictions`, `results`
- Salvar cada evento e odds ao longo do tempo (ver movimento de linha)

**2.2 — Registro de Predições**
- Salvar cada sugestão gerada pelo sistema
- Após resultado: calcular acurácia e ROI real
- Dashboard de performance histórica

**2.3 — Dados históricos de futebol**
- Integrar football-data.org (gratuita)
- 2+ temporadas por liga para treinar modelos
- Scripts de ingestão automatizados

**Entregável:** Histórico completo para análise de performance dos modelos.

---

### 🤖 FASE 3 — Machine Learning

**3.1 — Microserviço Python (FastAPI)**
- Deploy no Railway (gratuito)
- Next.js chama via API interna

**3.2 — Modelos por esporte**
- **Futebol:** Poisson avançado + Random Forest (histórico ESPN + football-data.org)
- **Basquete:** Regressão linear em pontos marcados/sofridos por jogo
- **Tênis:** Elo rating + superfície + histórico H2H
- **MMA/UFC:** Modelo de probabilidade baseado em método de vitória + ranking
- **Outros:** Ensemble de odds de mercado (Pinnacle como proxy)

**3.3 — Backtesting**
- Simular os últimos 2 anos com cada modelo
- Métricas: Acurácia, ROI, Brier Score, Calibração
- Comparar com modelo ingênuo (só odds de mercado)

**Entregável:** Modelos calibrados com ROI positivo histórico.

---

### 🔔 FASE 4 — Alertas e Automação

- Bot Telegram: value bets do dia às 9h e às 14h
- Alerta de Steam Move (quando odds mudam rápido = dinheiro pesado de um lado)
- Notificação de pré-jogo (1h antes de eventos com EV alto)
- Resumo diário de resultados (apostas sugeridas vs resultado real)

---

## 📅 Cronograma

```
Semana 1  →  FASE 1 completa (multi-esporte + odds + /eventos)
Semana 2  →  FASE 1 refinamentos + Supabase setup
Semana 3-4 → FASE 2 (banco + histórico)
Semana 5-7 → FASE 3 (modelos ML)
Semana 8+  →  FASE 4 (alertas)
```

---

## ⚠️ Aviso Legal

Este sistema é exclusivamente para **uso pessoal e estudo de probabilidade estatística**. Não constitui serviço de consultoria de apostas. Apostas envolvem risco financeiro real — o sistema indica probabilidade matemática, não garante resultado.

---

*Roadmap atualizado em 25/03/2026 — versão 2.0*
