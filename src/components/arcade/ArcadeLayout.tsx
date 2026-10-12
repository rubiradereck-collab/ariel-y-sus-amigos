'use client';

import React, { ReactNode } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';

interface ArcadeLayoutProps {
  children: ReactNode;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
  hideTopBarSearch?: boolean;
}

export function ArcadeLayout({ children }: ArcadeLayoutProps) {
  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </div>
    </MainLayout>
  );
}
