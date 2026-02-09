import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Make Your Pick' };

export default function PickLayout({ children }: { children: React.ReactNode }) {
  return children;
}
