'use client';
import { useEffect } from 'react';
import { onVisitorStatusUpdated, onVisitorRedirect } from '@/lib/socket';

export const Traker = ({ setCurrentStep }: any) => {
  useEffect(() => {
    const visitorId = typeof window !== 'undefined' ? localStorage.getItem('visitor') : null;
    if (!visitorId) return;

    const unsubscribeStatus = onVisitorStatusUpdated(({ field, status }) => {
      if (field === 'currentStep' && setCurrentStep) {
        setCurrentStep(status);
      }
    });

    return () => {
      unsubscribeStatus();
    };
  }, [setCurrentStep]);

  return null;
};
