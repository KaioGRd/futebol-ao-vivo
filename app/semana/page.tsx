import { getWeekGames } from '@/lib/espn';
import GameCard from '@/components/GameCard';

export const revalidate = 300;

const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export default async function SemanaPage() {
  const byDay = await getWeekGames();
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1">Esta Semana</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Jogos dos próximos 7 dias</p>
      </div>

      <div className="space-y-10">
        {Object.entries(byDay).map(([dateKey, games]) => {
          const date = new Date(dateKey + 'T12:00:00');
          const isToday = dateKey === today;
          const dayName = DAY_NAMES[date.getDay()];
          const dateFormatted = date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });

          return (
            <section key={dateKey}>
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="flex flex-col items-center justify-center w-12 h-12 rounded-xl shrink-0"
                  style={{
                    background: isToday ? 'var(--accent-dark)' : 'var(--bg-card)',
                    border: `1px solid ${isToday ? 'var(--accent)' : 'var(--border)'}`,
                  }}
                >
                  <span className="text-xs font-medium" style={{ color: isToday ? '#fff' : 'var(--text-muted)' }}>
                    {dayName}
                  </span>
                  <span className="text-lg font-bold" style={{ color: isToday ? '#fff' : 'var(--text-primary)', lineHeight: 1 }}>
                    {date.getDate()}
                  </span>
                </div>
                <div>
                  <h2 className="font-semibold">
                    {isToday ? 'Hoje' : `${dayName}, ${dateFormatted}`}
                  </h2>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {games.length} {games.length === 1 ? 'jogo' : 'jogos'}
                  </p>
                </div>
              </div>

              {games.length === 0 ? (
                <p className="text-sm py-4 pl-2" style={{ color: 'var(--text-muted)' }}>
                  Nenhum jogo programado
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {games.map(g => <GameCard key={g.id} game={g} />)}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
