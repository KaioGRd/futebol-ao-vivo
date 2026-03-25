# ⚽ FutebolAoVivo

Site para acompanhar jogos de futebol em tempo real, com placares, estatísticas, escalações e classificações de ligas do mundo inteiro.

## Funcionalidades

- **Jogos de Hoje** — todos os jogos do dia agrupados por status (ao vivo, em breve, encerrados)
- **Ao Vivo** — somente partidas em andamento, com atualização automática a cada 30 segundos
- **Esta Semana** — calendário com jogos dos próximos 7 dias
- **Competições** — lista de ligas com classificação e jogos do dia
- **Detalhe da Partida** — placar, timeline de eventos (gols, cartões, substituições), estatísticas e escalações
- **Filtro por liga** — filtre os jogos por competição na página principal
- **Auto-refresh** — placares atualizados automaticamente nas páginas ao vivo

## Ligas Suportadas

| Liga | País |
|---|---|
| Premier League | Inglaterra |
| La Liga | Espanha |
| Bundesliga | Alemanha |
| Serie A | Itália |
| Ligue 1 | França |
| Brasileirão | Brasil |
| MLS | EUA |
| Champions League | Europa |
| Europa League | Europa |
| Copa Libertadores | América do Sul |
| Liga Argentina | Argentina |
| Primeira Liga | Portugal |
| Eurocopa | Europa |

## Tecnologias

- [Next.js 16](https://nextjs.org/) — framework React com App Router
- [TypeScript](https://www.typescriptlang.org/) — tipagem estática
- [Tailwind CSS](https://tailwindcss.com/) — estilização
- [ESPN API](https://gist.github.com/bhaidar/b2fdd34004250932a4a354a2cc15ddd4) — dados de futebol (API pública não oficial)

## Estrutura do Projeto

```
futebol-ao-vivo/
├── app/
│   ├── layout.tsx                  # Layout raiz com navbar
│   ├── page.tsx                    # Página principal (jogos de hoje)
│   ├── ao-vivo/
│   │   └── page.tsx                # Jogos ao vivo
│   ├── semana/
│   │   └── page.tsx                # Jogos da semana
│   ├── competicoes/
│   │   ├── page.tsx                # Lista de competições
│   │   └── [slug]/page.tsx         # Jogos + classificação de uma liga
│   ├── partida/
│   │   └── [league]/[id]/page.tsx  # Detalhe da partida
│   └── api/
│       ├── scoreboard/[league]/    # Proxy ESPN scoreboard
│       └── summary/[league]/[id]/  # Proxy ESPN match summary
├── components/
│   ├── Navbar.tsx                  # Barra de navegação
│   ├── GameCard.tsx                # Card de jogo
│   └── GamesGrid.tsx               # Grid com filtros e auto-refresh
└── lib/
    ├── espn.ts                     # Funções de acesso à ESPN API
    └── types.ts                    # Tipos TypeScript
```

## Como Rodar

### Pré-requisitos

- [Node.js](https://nodejs.org/) 18 ou superior
- [Git](https://git-scm.com/)

### Instalação

```bash
# Clone o repositório
git clone <url-do-repositorio>
cd futebol-ao-vivo

# Instale as dependências
npm install

# Rode em modo de desenvolvimento
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000) no navegador.

### Outros Comandos

```bash
npm run build    # Build de produção
npm run start    # Inicia servidor de produção (após build)
npm run lint     # Verifica problemas no código
```

## Como Funciona

Os dados vêm da **ESPN API pública** (sem necessidade de chave). O Next.js faz as requisições no servidor (Server Components), evitando problemas de CORS. Para as páginas com auto-refresh, as atualizações passam pelas API Routes `/api/scoreboard/[league]` que funcionam como proxy.

O cache é configurado por página:
- Jogos ao vivo: revalidação a cada **30 segundos**
- Jogos da semana: revalidação a cada **5 minutos**
- Classificações: revalidação a cada **1 hora**

> **Atenção:** A ESPN API é não oficial e pode mudar sem aviso. Não há garantias de disponibilidade ou formato dos dados.
