'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createClient } from '../lib/supabase';

const LINKS = [
  { href: '/dashboard', label: 'Leads' },
  { href: '/proposals', label: 'Proposals' },
  { href: '/projects', label: 'Projects' },
  { href: '/invoices', label: 'Invoices' },
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
    <header className="border-b border-[var(--border-strong)] px-5 py-3 flex items-center justify-between gap-4">
      <div className="flex items-center gap-6 min-w-0">
        <Link href="/dashboard" className="font-serif text-lg leading-none whitespace-nowrap">
          Brand Boosting Network
        </Link>
        <nav className="flex items-center gap-1 overflow-x-auto">
          {LINKS.map((l) => {
            const active = pathname === l.href || pathname.startsWith(l.href + '/');
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`text-xs px-3 h-8 rounded-md flex items-center whitespace-nowrap ${
                  active
                    ? 'bg-[var(--text-primary)] text-[var(--surface-2)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--surface-1)]'
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
          className="text-xs h-8 px-3 rounded-md border border-[var(--border-strong)] hover:bg-[var(--surface-1)]"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
