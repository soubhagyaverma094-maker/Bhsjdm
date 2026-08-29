'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createClient } from '../lib/supabase';

const LINKS = [
  { href: '/dashboard', label: 'Leads' },
  { href: '/meetings', label: 'Meetings' },
  { href: '/proposals', label: 'Proposals' },
  { href: '/projects', label: 'Projects' },
  { href: '/invoices', label: 'Invoices' },
  { href: '/reports', label: 'Reports' },
];

export default function AppNav() {
  const supabase = createClient();
  const router = useRouter();
  const pathname = usePathname();
  const [email, setEmail] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ''));
  }, [supabase]);

  async function signOut() {
    await supabase.auth.signOut();
    router.replace('/login');
  }

  return (
    <header className="glass sticky top-3 mx-3 mt-3 px-4 py-2.5 flex items-center justify-between gap-4 rounded-2xl">
      <div className="flex items-center gap-5 min-w-0">
        <Link href="/dashboard" className="flex items-center gap-2 whitespace-nowrap">
          <span className="text-lg">🚀</span>
          <span className="font-serif text-base leading-none bg-gradient-to-r from-[var(--accent-2)] via-[var(--accent)] to-[var(--accent-3)] bg-clip-text text-transparent">
            Brand Boosting Network
          </span>
        </Link>
        <nav className="flex items-center gap-1 overflow-x-auto">
          {LINKS.map((l) => {
            const active = pathname === l.href || pathname.startsWith(l.href + '/');
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`text-xs px-3 h-8 rounded-full flex items-center whitespace-nowrap transition ${
                  active
                    ? 'btn-cosmic'
                    : 'text-[var(--text-secondary)] hover:bg-white/5'
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-xs text-[var(--text-secondary)] hidden sm:block">{email}</span>
        <button
          onClick={signOut}
          className="text-xs h-8 px-3 rounded-full border border-[var(--border-strong)] hover:bg-white/5"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
