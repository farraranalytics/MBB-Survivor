import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'The Field' };

export default function StandingsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
