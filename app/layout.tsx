import type { Metadata } from 'next';
import './globals.css';
import Navbar from '@/components/Navbar';

export const metadata: Metadata = {
  title: 'FutebolAoVivo — Jogos em Tempo Real',
  description: 'Acompanhe todos os jogos de futebol ao vivo, resultados, estatísticas e muito mais.',
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
          Dados fornecidos pela ESPN • Atualização automática a cada 30s
        </footer>
      </body>
    </html>
  );
}
