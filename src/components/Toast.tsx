'use client';

import { useEffect, useState, useCallback } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastData {
  id: string;
  type: ToastType;
  message: string;
  duration: number;
}

const TOAST_STYLES: Record<ToastType, { bg: string; border: string; text: string; icon: string }> = {
  success: {
    bg: 'linear-gradient(135deg, #1B3D20, #162E1A)',
    border: '1px solid #4CAF50',
    text: '#4CAF50',
    icon: '✓',
  },
  error: {
    bg: 'linear-gradient(135deg, #3D1B1B, #2E1616)',
    border: '1px solid #EF5350',
    text: '#EF5350',
    icon: '✗',
  },
  warning: {
    bg: 'linear-gradient(135deg, #3D361B, #2E2A16)',
    border: '1px solid #FFB300',
    text: '#FFB300',
    icon: '⚠',
  },
  info: {
    bg: 'linear-gradient(135deg, #1B2E3D, #16232E)',
    border: '1px solid #42A5F5',
    text: '#42A5F5',
    icon: 'ℹ',
  },
};

function ToastItem({ toast, onDismiss }: { toast: ToastData; onDismiss: (id: string) => void }) {
  const [dismissing, setDismissing] = useState(false);
  const style = TOAST_STYLES[toast.type];

  const dismiss = useCallback(() => {
    if (dismissing) return;
    setDismissing(true);
    setTimeout(() => onDismiss(toast.id), 300);
  }, [dismissing, onDismiss, toast.id]);

  useEffect(() => {
    const timer = setTimeout(dismiss, toast.duration);
    return () => clearTimeout(timer);
  }, [toast.duration, dismiss]);

  return (
    <div
      onClick={dismiss}
      role="alert"
      style={{
        background: style.bg,
        border: style.border,
        color: style.text,
        fontFamily: "'DM Sans', sans-serif",
        fontSize: '0.9rem',
        fontWeight: 500,
        padding: '16px 20px',
        borderRadius: '10px',
        boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
        maxWidth: '400px',
        width: 'calc(100% - 40px)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        cursor: 'pointer',
        pointerEvents: 'auto' as const,
        animation: dismissing ? undefined : 'toast-in 0.3s ease-out',
        opacity: dismissing ? 0 : 1,
        transform: dismissing ? 'translateY(10px)' : 'translateY(0)',
        transition: 'opacity 300ms ease, transform 300ms ease',
      }}
    >
      <span style={{ flexShrink: 0, fontSize: '1rem' }}>{style.icon}</span>
      <span>{toast.message}</span>
    </div>
  );
}

export function ToastContainer({ toasts, onDismiss }: { toasts: ToastData[]; onDismiss: (id: string) => void }) {
  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '80px',
        left: 0,
        right: 0,
        zIndex: 60,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px',
        pointerEvents: 'none',
      }}
    >
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
