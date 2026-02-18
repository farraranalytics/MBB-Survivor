'use client';

import { useEffect, useState } from 'react';
import {
  isPushSupported,
  isStandalone,
  isIOS,
  getPermissionState,
  subscribeToPush,
  unsubscribeFromPush,
  hasActivePushSubscription,
} from '@/lib/push';

export default function NotificationToggle() {
  const [supported, setSupported] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [iosDevice, setIosDevice] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('unsupported');
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      const pushSupported = isPushSupported();
      const isStandaloneMode = isStandalone();
      const ios = isIOS();
      setSupported(pushSupported);
      setStandalone(isStandaloneMode);
      setIosDevice(ios);

      if (pushSupported) {
        setPermission(getPermissionState());
        const hasSub = await hasActivePushSubscription();
        setSubscribed(hasSub);
      }
      setLoading(false);
    }
    init();
  }, []);

  const handleToggle = async () => {
    setLoading(true);
    try {
      if (subscribed) {
        await unsubscribeFromPush();
        setSubscribed(false);
      } else {
        const success = await subscribeToPush();
        setSubscribed(success);
        setPermission(getPermissionState());
      }
    } catch (err) {
      console.error('Notification toggle error:', err);
    } finally {
      setLoading(false);
    }
  };

  // iOS in browser (not installed as PWA) — push requires home screen install
  if (iosDevice && !standalone && !supported) {
    return (
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-[#E8E6E1]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            Push Notifications
          </p>
          <p className="text-xs text-[#9BA3AE] mt-0.5" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            Install the app to your home screen to enable push notifications.
          </p>
        </div>
      </div>
    );
  }

  // Browser doesn't support push at all
  if (!supported) {
    return (
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-[#E8E6E1]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            Push Notifications
          </p>
          <p className="text-xs text-[#9BA3AE] mt-0.5" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            Not supported in this browser.
          </p>
        </div>
      </div>
    );
  }

  // Permission was denied by the browser
  if (permission === 'denied') {
    return (
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-[#E8E6E1]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            Push Notifications
          </p>
          <p className="text-xs text-[#9BA3AE] mt-0.5" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            Blocked by browser. Enable in site settings.
          </p>
        </div>
        <span className="text-xs text-[#EF5350] px-2 py-1 bg-[rgba(239,83,80,0.1)] rounded-[6px]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
          Blocked
        </span>
      </div>
    );
  }

  // Normal toggle — works on Android, Desktop, and iOS PWA (16.4+)
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-[#E8E6E1]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
          Push Notifications
        </p>
        <p className="text-xs text-[#9BA3AE] mt-0.5" style={{ fontFamily: "'DM Sans', sans-serif" }}>
          {subscribed ? 'Receiving deadline and result alerts' : 'Get alerts for picks and results'}
        </p>
      </div>
      <button
        onClick={handleToggle}
        disabled={loading}
        className={`relative w-12 h-6 rounded-full transition-colors disabled:opacity-50 ${
          subscribed ? 'bg-[#FF5722]' : 'bg-[#1B2A3D] border border-[rgba(255,255,255,0.1)]'
        }`}
        aria-label={subscribed ? 'Disable push notifications' : 'Enable push notifications'}
      >
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
          subscribed ? 'left-[26px]' : 'left-0.5'
        }`} />
      </button>
    </div>
  );
}
