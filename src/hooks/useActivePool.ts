'use client';

import { useContext } from 'react';
import { ActivePoolContext } from '@/contexts/ActivePoolContext';

export function useActivePool() {
  const context = useContext(ActivePoolContext);
  if (context === undefined) {
    throw new Error('useActivePool must be used within an ActivePoolProvider');
  }
  return context;
}
