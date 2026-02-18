'use client';

import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallAppButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    // Check if already installed (standalone mode)
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    // Detect iOS
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(ios);

    // Capture the install prompt (Android/Desktop Chrome)
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Detect if app was just installed
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    });

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  // Already installed
  if (isInstalled) {
    return (
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-[#E8E6E1]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            App Installed
          </p>
          <p className="text-xs text-[#9BA3AE] mt-0.5" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            Survive the Dance is on your home screen
          </p>
        </div>
        <span className="text-xs text-[#4CAF50] px-2 py-1 bg-[rgba(76,175,80,0.1)] rounded-[6px]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
          Installed
        </span>
      </div>
    );
  }

  // iOS or no install prompt available — show instructions guide
  if (isIOS || !deferredPrompt) {
    return (
      <div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-[#E8E6E1]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              Install App
            </p>
            <p className="text-xs text-[#9BA3AE] mt-0.5" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              Add to your home screen for the full experience
            </p>
          </div>
          <button
            onClick={() => setShowIOSGuide(!showIOSGuide)}
            className="text-xs font-semibold text-[#FF5722] hover:text-[#E64A19] transition-colors px-2 py-1"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            {showIOSGuide ? 'Hide' : 'How'}
          </button>
        </div>
        {showIOSGuide && (
          <div className="mt-3 bg-[#1B2A3D] rounded-[10px] p-4 space-y-3">
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#243447] text-[#FF5722] text-xs font-bold flex items-center justify-center" style={{ fontFamily: "'Space Mono', monospace" }}>1</span>
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="text-xs text-[#E8E6E1]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                  Tap the <span className="text-[#FF5722] font-semibold">Share</span> button in Safari or Chrome
                </p>
                {/* iOS Share icon (square with up arrow) */}
                <svg className="inline-block flex-shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FF5722" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                  <polyline points="16 6 12 2 8 6" />
                  <line x1="12" y1="2" x2="12" y2="15" />
                </svg>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#243447] text-[#FF5722] text-xs font-bold flex items-center justify-center" style={{ fontFamily: "'Space Mono', monospace" }}>2</span>
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="text-xs text-[#E8E6E1]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                  Scroll down and tap <span className="text-[#FF5722] font-semibold">Add to Home Screen</span>
                </p>
                {/* Plus in square icon */}
                <svg className="inline-block flex-shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FF5722" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <line x1="12" y1="8" x2="12" y2="16" />
                  <line x1="8" y1="12" x2="16" y2="12" />
                </svg>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#243447] text-[#FF5722] text-xs font-bold flex items-center justify-center" style={{ fontFamily: "'Space Mono', monospace" }}>3</span>
              <p className="text-xs text-[#E8E6E1]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                Tap <span className="text-[#FF5722] font-semibold">Add</span> to confirm — the app will appear on your home screen
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-[#E8E6E1]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
          Install App
        </p>
        <p className="text-xs text-[#9BA3AE] mt-0.5" style={{ fontFamily: "'DM Sans', sans-serif" }}>
          Add to your home screen for quick access
        </p>
      </div>
      <button
        onClick={handleInstall}
        className="px-3 py-1.5 rounded-[6px] text-xs font-semibold btn-orange"
        style={{ fontFamily: "'DM Sans', sans-serif" }}
      >
        Install
      </button>
    </div>
  );
}
