'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/', label: 'Hoje' },
  { href: '/ao-vivo', label: '🔴 Ao Vivo' },
  { href: '/semana', label: 'Esta Semana' },
  { href: '/competicoes', label: 'Competições' },
  { href: '/eventos', label: '🎯 Apostas' },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <nav
      className="sticky top-0 z-50 w-full"
      style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}
    >
      <div className="max-w-6xl mx-auto px-4 flex items-center gap-1 h-14">
        <Link href="/" className="flex items-center gap-2 mr-6 font-bold text-lg shrink-0">
          <span style={{ color: 'var(--accent)' }}>⚽</span>
          <span className="hidden sm:block">FutebolAoVivo</span>
        </Link>
        <div className="flex items-center gap-1 overflow-x-auto">
          {links.map(link => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className="px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors"
                style={{
                  background: active ? 'var(--accent-dark)' : 'transparent',
                  color: active ? '#fff' : 'var(--text-secondary)',
                }}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
