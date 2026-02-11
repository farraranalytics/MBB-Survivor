'use client';

import { ReactNode } from 'react';

export interface EntryTabItem {
  id: string;
  entry_number: number;
  entry_label: string | null;
  is_eliminated: boolean;
  has_picked?: boolean;
}

interface EntryTabsProps {
  entries: EntryTabItem[];
  activeEntryId: string | undefined;
  onEntrySwitch: (entryId: string) => void;
  addEntrySlot?: ReactNode;
}

export default function EntryTabs({ entries, activeEntryId, onEntrySwitch, addEntrySlot }: EntryTabsProps) {
  const totalSlots = entries.length + (addEntrySlot ? 1 : 0);
  if (entries.length <= 1 && !addEntrySlot) return null;

  return (
    <div
      className="grid gap-1 sm:gap-1.5"
      style={{
        gridTemplateColumns: `repeat(${Math.min(totalSlots, 4)}, 1fr)`,
        overflowX: totalSlots > 4 ? 'auto' : undefined,
      }}
    >
      {entries.map(entry => {
        const isActive = entry.id === activeEntryId;
        const dotColor = entry.is_eliminated
          ? 'bg-[#EF5350]'
          : entry.has_picked
            ? 'bg-[#4CAF50]'
            : entry.has_picked === false
              ? 'bg-[#FFB300]'
              : 'bg-[#5F6B7A]';
        const dotShadow = entry.is_eliminated
          ? '0 0 4px rgba(239,83,80,0.27)'
          : entry.has_picked
            ? '0 0 4px rgba(76,175,80,0.27)'
            : entry.has_picked === false
              ? '0 0 4px rgba(255,179,0,0.27)'
              : 'none';

        return (
          <button
            key={entry.id}
            onClick={() => onEntrySwitch(entry.id)}
            className={`min-w-0 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-[6px] truncate transition-all ${
              isActive
                ? 'bg-[#1B2A3D] border-[1.5px] border-[#FF5722]'
                : 'border border-[rgba(255,255,255,0.08)]'
            }`}
          >
            <div
              className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColor}`}
              style={{ boxShadow: dotShadow }}
            />
            <span className={`text-[0.7rem] uppercase truncate ${
              isActive ? 'text-[#E8E6E1] font-bold' : 'text-[#9BA3AE] font-medium'
            }`} style={{ fontFamily: "'Oswald', sans-serif" }}>
              {entry.entry_label || `Entry ${entry.entry_number}`}
              {entry.is_eliminated && ' ☠️'}
            </span>
          </button>
        );
      })}
      {addEntrySlot}
    </div>
  );
}
