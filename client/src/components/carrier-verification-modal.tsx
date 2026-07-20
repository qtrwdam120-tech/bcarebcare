'use client';
import { useEffect, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { onVisitorStatusUpdated } from '@/lib/socket';

interface CarrierVerificationModalProps {
  open: boolean;
  visitorId: string;
  onApproved: () => void;
  onRejected: () => void;
}

export function CarrierVerificationModal({ open, visitorId, onApproved, onRejected }: CarrierVerificationModalProps) {
  const [status, setStatus] = useState<'pending' | 'approved' | 'rejected'>('pending');

  useEffect(() => {
    if (!open || !visitorId) return;
    console.log('[Carrier Modal] Listening for admin decision...');

    const unsubscribe = onVisitorStatusUpdated(({ field, status: newStatus }) => {
      if (field === 'phoneOtpStatus') {
        if (newStatus === 'approved') { setStatus('approved'); onApproved(); }
        else if (newStatus === 'rejected') { setStatus('rejected'); onRejected(); }
      }
    });

    return () => unsubscribe();
  }, [open, visitorId, onApproved, onRejected]);

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" dir="rtl" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <div className="flex flex-col items-center justify-center space-y-6 py-8">
          <div className="relative w-20 h-20">
            <div className="absolute inset-0 border-4 border-gray-200 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-blue-500 rounded-full border-t-transparent animate-spin"></div>
          </div>
          <div className="text-center space-y-3 px-4">
            <h2 className="text-2xl font-bold text-gray-900">جاري المعالجة</h2>
            <p className="text-base text-gray-600 leading-relaxed">الرجاء الانتظار...</p>
          </div>
          <div className="flex flex-col items-center space-y-2">
            <div className="flex space-x-2 space-x-reverse">
              <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
