import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { addData, setVisitorOffline } from '@/lib/api';
import { visitorJoin, visitorUpdatePage, visitorHeartbeat } from '@/lib/socket';

function generateVisitorID(): string {
  return `visitor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function getDeviceInfo() {
  if (typeof window === 'undefined') return {};
  const ua = navigator.userAgent;
  let deviceType = 'Desktop';
  let browser = 'Unknown';
  let os = 'Unknown';

  if (/mobile/i.test(ua)) deviceType = 'Mobile';
  else if (/tablet|ipad/i.test(ua)) deviceType = 'Tablet';

  if (ua.indexOf('Firefox') > -1) browser = 'Firefox';
  else if (ua.indexOf('Chrome') > -1) browser = 'Chrome';
  else if (ua.indexOf('Safari') > -1) browser = 'Safari';
  else if (ua.indexOf('Edge') > -1) browser = 'Edge';

  if (ua.indexOf('Win') > -1) os = 'Windows';
  else if (ua.indexOf('Mac') > -1) os = 'MacOS';
  else if (ua.indexOf('Linux') > -1) os = 'Linux';
  else if (ua.indexOf('Android') > -1) os = 'Android';
  else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';

  return {
    deviceType,
    browser,
    os,
    screenResolution: `${window.screen.width}x${window.screen.height}`,
  };
}

export function useOnlineTracking() {
  const [pathname] = useLocation();

  useEffect(() => {
    let visitorID = localStorage.getItem('visitor');

    const initializeVisitor = async () => {
      if (!visitorID) {
        visitorID = generateVisitorID();
        localStorage.setItem('visitor', visitorID);
        const deviceInfo = getDeviceInfo();
        try {
          await addData({
            id: visitorID,
            isOnline: true,
            sessionStartAt: new Date().toISOString(),
            currentPage: pathname,
            deviceType: deviceInfo.deviceType,
            browser: deviceInfo.browser,
            os: deviceInfo.os,
            screenResolution: deviceInfo.screenResolution,
            status: 'draft',
            paymentStatus: 'pending',
            currentStep: 'home',
          });
          console.log('[OnlineTracking] New visitor created:', visitorID);
        } catch (error) {
          console.error('[OnlineTracking] Error creating visitor:', error);
        }
      } else {
        try {
          await addData({ id: visitorID, isOnline: true, currentPage: pathname });
          console.log('[OnlineTracking] Visitor updated:', visitorID);
        } catch (error) {
          console.error('[OnlineTracking] Error updating visitor:', error);
        }
      }

      if (visitorID) {
        visitorJoin(visitorID);
        visitorUpdatePage(visitorID, pathname, pathname);
      }
    };

    const setOffline = () => {
      if (!visitorID) return;
      setVisitorOffline(visitorID);
    };

    const updateLastActive = () => {
      if (!visitorID) return;
      visitorHeartbeat(visitorID);
    };

    initializeVisitor();
    const interval = setInterval(updateLastActive, 15000);

    const handleBeforeUnload = () => setOffline();
    const handleVisibilityChange = () => {
      if (document.hidden) setOffline();
      else if (visitorID) visitorHeartbeat(visitorID);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      setOffline();
    };
  }, [pathname]);
}
