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

  // iOS — show instructions guide
  if (isIOS) {
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
              <p className="text-xs text-[#E8E6E1]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                Tap the <span className="text-[#FF5722] font-semibold">Share</span> button in Safari (square with arrow)
              </p>
            </div>
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#243447] text-[#FF5722] text-xs font-bold flex items-center justify-center" style={{ fontFamily: "'Space Mono', monospace" }}>2</span>
              <p className="text-xs text-[#E8E6E1]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                Scroll down and tap <span className="text-[#FF5722] font-semibold">Add to Home Screen</span>
              </p>
            </div>
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#243447] text-[#FF5722] text-xs font-bold flex items-center justify-center" style={{ fontFamily: "'Space Mono', monospace" }}>3</span>
              <p className="text-xs text-[#E8E6E1]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                Tap <span className="text-[#FF5722] font-semibold">Add</span> — the app will appear on your home screen
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Android/Desktop — show install button (only if prompt is available)
  if (!deferredPrompt) {
    return null; // Browser doesn't support install or criteria not met
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
