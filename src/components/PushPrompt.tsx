'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import {
  isPushSupported,
  isStandalone,
  getPermissionState,
  subscribeToPush,
} from '@/lib/push';

const STORAGE_KEY = 'push_prompt_dismissed';

/**
 * One-time push notification prompt that appears when:
 * 1. User is logged in
 * 2. App is running in standalone mode (installed PWA)
 * 3. Push is supported in this browser
 * 4. Permission hasn't been granted or denied yet
 * 5. User hasn't dismissed this prompt before
 */
export default function PushPrompt() {
  const { user } = useAuth();
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;

    // Only show in installed PWA mode
    if (!isStandalone()) return;

    // Check if push is supported
    if (!isPushSupported()) return;

    // Only show if permission is 'default' (not yet asked)
    if (getPermissionState() !== 'default') return;

    // Check if user already dismissed this prompt
    if (localStorage.getItem(STORAGE_KEY)) return;

    // Small delay so it doesn't flash immediately on app open
    const timer = setTimeout(() => setShow(true), 1500);
    return () => clearTimeout(timer);
  }, [user]);

  const handleEnable = async () => {
    setLoading(true);
    try {
      await subscribeToPush();
    } catch (err) {
      console.error('Push subscribe error:', err);
    } finally {
      localStorage.setItem(STORAGE_KEY, '1');
      setShow(false);
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, '1');
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={handleDismiss} />
      <div className="relative bg-[#111827] border border-[rgba(255,255,255,0.05)] rounded-t-[16px] sm:rounded-[16px] w-full max-w-sm mx-auto p-6 pb-8 sm:pb-6 shadow-2xl animate-slide-up">
        {/* Bell icon */}
        <div className="flex justify-center mb-4">
          <div className="w-14 h-14 rounded-full bg-[rgba(255,87,34,0.1)] border border-[rgba(255,87,34,0.2)] flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FF5722" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </div>
        </div>

        <h3
          className="text-lg font-bold text-[#E8E6E1] text-center mb-2"
          style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}
        >
          Stay in the Game
        </h3>
        <p
          className="text-sm text-[#9BA3AE] text-center mb-6"
          style={{ fontFamily: "'DM Sans', sans-serif" }}
        >
          Get notified when it&apos;s time to pick, when your team wins, and when you make the next round.
        </p>

        <div className="flex flex-col gap-3">
          <button
            onClick={handleEnable}
            disabled={loading}
            className="w-full py-3 rounded-[12px] text-sm font-semibold btn-orange disabled:opacity-50 flex items-center justify-center"
            style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}
          >
            {loading ? (
              <div className="h-4 w-4 border-2 border-[rgba(255,255,255,0.3)] border-t-white rounded-full animate-spin" />
            ) : (
              'Enable Notifications'
            )}
          </button>
          <button
            onClick={handleDismiss}
            className="w-full py-2 text-xs text-[#5F6B7A] hover:text-[#9BA3AE] transition-colors"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
