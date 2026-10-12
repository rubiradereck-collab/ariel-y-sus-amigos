'use client';

import React, { ReactNode, useState } from 'react';
import { ArcadeSidebar } from './ArcadeSidebar';
import { TopBar } from '@/components/libres/TopBar';

interface ArcadeLayoutProps {
  children: ReactNode;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
  hideTopBarSearch?: boolean;
}

export function ArcadeLayout({
  children,
  searchQuery: externalQuery,
  onSearchChange: externalOnSearch,
}: ArcadeLayoutProps) {
  const [internalQuery, setInternalQuery] = useState('');

  const query = externalQuery !== undefined ? externalQuery : internalQuery;
  const setQuery = externalOnSearch !== undefined ? externalOnSearch : setInternalQuery;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#14070f] via-[#1b0816] to-[#0a030b] text-[#f5eef2] p-3 sm:p-6 lg:p-8">
      <div className="max-w-[1700px] mx-auto flex flex-col lg:flex-row gap-6">
        {/* Sidebar Arcade Gamer */}
        <ArcadeSidebar />

        {/* Contenido Principal de la Zona */}
        <main className="flex-1 flex flex-col gap-6 min-w-0">
          <TopBar searchQuery={query} onSearchChange={setQuery} />
          {children}
        </main>
      </div>
    </div>
  );
}
