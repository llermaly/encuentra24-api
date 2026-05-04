'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserButton, useUser } from '@stackframe/stack';

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
};

const Icon = ({ d }: { d: string }) => (
  <svg className="w-[18px] h-[18px] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.6}>
    <path strokeLinecap="round" strokeLinejoin="round" d={d} />
  </svg>
);

const navItems: NavItem[] = [
  { href: '/', label: 'Dashboard',
    icon: <Icon d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h4v-7h4v7h4a1 1 0 001-1V10" /> },
  { href: '/listings', label: 'Browse',
    icon: <Icon d="M21 21l-5-5m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /> },
  { href: '/map', label: 'Map',
    icon: <Icon d="M9 20l-5-2.5V5l5 2.5m0 12.5l6-3m-6 3V7.5m6 9.5l5 2.5V8l-5-2.5m0 11.5V5.5" /> },
  { href: '/pipeline', label: 'Pipeline',
    icon: <Icon d="M4 6h16M4 12h10M4 18h6" /> },
  { href: '/saved-searches', label: 'Saved Searches',
    icon: <Icon d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-4-7 4V5z" /> },
  { href: '/agents', label: 'Agents',
    icon: <Icon d="M17 20h5v-2a3 3 0 00-5.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M16 7a4 4 0 11-8 0 4 4 0 018 0z" /> },
  { href: '/crawl-history', label: 'Crawl History',
    icon: <Icon d="M4 4v5h5M20 20v-5h-5M5 9a8 8 0 0114-3M19 15a8 8 0 01-14 3" /> },
];


export function Sidebar() {
  const pathname = usePathname();
  const user = useUser();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setOpen(true)}
        className="md:hidden fixed top-3 left-3 z-50 p-2.5 rounded-full aurora-surface-strong shadow-md text-stone-700"
        aria-label="Open menu"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Mobile overlay */}
      {open && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-stone-900/30 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-64 flex flex-col shrink-0
          aurora-surface-strong
          border-r border-stone-200/60
          transform transition-transform duration-200 ease-in-out
          ${open ? 'translate-x-0' : '-translate-x-full'}
          md:relative md:translate-x-0
        `}
        style={{
          background:
            'linear-gradient(180deg, rgba(247,249,243,0.94) 0%, rgba(241,245,235,0.92) 100%)',
        }}
      >
        {/* Decorative blur blobs */}
        <div className="pointer-events-none absolute -top-10 -left-12 h-44 w-44 rounded-full bg-emerald-200/40 blur-3xl" />
        <div className="pointer-events-none absolute bottom-20 -right-10 h-40 w-40 rounded-full bg-amber-100/50 blur-3xl" />

        {/* Brand */}
        <div className="relative px-5 pt-6 pb-5 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <span
              className="w-9 h-9 rounded-2xl flex items-center justify-center text-white shadow-md group-hover:scale-105 transition-transform"
              style={{ background: 'linear-gradient(135deg, #1a1a1a 0%, #4a6b4a 100%)' }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9-9 9 9M5 10v10h14V10" />
              </svg>
            </span>
            <div className="leading-tight">
              <p className="font-serif text-lg text-stone-900 tracking-tight">
                Encuentra<span className="italic text-stone-600">24</span>
              </p>
              <p className="text-[10px] uppercase tracking-[0.22em] text-stone-500">Property Desk</p>
            </div>
          </Link>
          <button
            onClick={() => setOpen(false)}
            className="md:hidden p-1 rounded text-stone-400 hover:text-stone-700"
            aria-label="Close menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Nav */}
        <nav className="relative flex-1 px-3 pb-3 overflow-y-auto">
          <p className="px-3 mb-1.5 text-[10px] uppercase tracking-[0.22em] text-stone-500/80 font-medium">
            Workspace
          </p>
          <div className="space-y-0.5">
            {navItems.map(item => {
              const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={`group relative flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all
                    ${active
                      ? 'text-stone-900 font-medium'
                      : 'text-stone-600 hover:text-stone-900'}`}
                >
                  {active && (
                    <span
                      className="absolute inset-0 rounded-xl"
                      style={{
                        background:
                          'linear-gradient(110deg, rgba(255,255,255,0.95) 0%, rgba(245,249,242,0.95) 100%)',
                        boxShadow:
                          '0 1px 0 rgba(255,255,255,0.9) inset, 0 6px 16px -10px rgba(28,28,28,0.18)',
                        border: '1px solid rgba(255,255,255,0.95)',
                      }}
                    />
                  )}
                  {!active && (
                    <span className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity bg-white/40" />
                  )}
                  {active && (
                    <span
                      className="absolute left-1 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-full"
                      style={{ background: 'linear-gradient(to bottom, #1a1a1a, #4a6b4a)' }}
                    />
                  )}
                  <span className="relative">{item.icon}</span>
                  <span className="relative">{item.label}</span>
                </Link>
              );
            })}
          </div>

        </nav>

        {/* User card */}
        {user && (
          <div className="relative m-3 rounded-2xl aurora-surface px-3 py-2.5 flex items-center gap-3">
            <UserButton />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-stone-900 font-medium truncate">
                {user.displayName || user.primaryEmail?.split('@')[0]}
              </p>
              <p className="text-[11px] text-stone-500 truncate">{user.primaryEmail}</p>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
