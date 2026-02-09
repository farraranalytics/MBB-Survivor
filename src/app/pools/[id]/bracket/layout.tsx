import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Bracket' };

export default function BracketLayout({ children }: { children: React.ReactNode }) {
  return children;
}
