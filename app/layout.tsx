import type { Metadata } from 'next';
import './globals.css';
import Navbar from '@/components/Navbar';

export const metadata: Metadata = {
  title: 'FutebolAoVivo — Jogos & Análise de Apostas',
  description: 'Jogos ao vivo, resultados, estatísticas e análise preditiva de apostas esportivas.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6">
          {children}
        </main>
        <footer className="text-center py-4 text-sm" style={{ color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}>
          Dados: ESPN API + The Odds API • Uso pessoal • Análise estatística de probabilidade
        </footer>
      </body>
    </html>
  );
}
