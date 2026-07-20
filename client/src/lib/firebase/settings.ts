/**
 * Settings - Replaces Firebase-based settings
 * Uses the local same-origin /api proxy so no external host is contacted.
 */

const API_BASE = (typeof window !== 'undefined' ? window.location.origin : '').replace(/\/+$/, '');

let cachedPublicSettings: Record<string, any> | null = null;

/** Fetch public settings (no auth required) */
async function fetchPublicSettings(): Promise<Record<string, any>> {
  if (cachedPublicSettings) return cachedPublicSettings;
  try {
    const endpoint = `${API_BASE}/api/visitors/public-settings`;
    const res = await fetch(endpoint, { headers: { Accept: 'application/json' } });
    if (res.ok) {
      cachedPublicSettings = await res.json();
      return cachedPublicSettings!;
    }
  } catch {
    // silent
  }
  return {};
}

/** Check if country is allowed (isCountryBlocked setting) */
export async function isCountryAllowed(country: string): Promise<boolean> {
  try {
    const settings = await fetchPublicSettings();
    const blockedCountries: string[] = Array.isArray(settings.blockedCountries)
      ? settings.blockedCountries
      : (settings.blockedCountries ? JSON.parse(settings.blockedCountries) : []);
    return !blockedCountries.includes(country);
  } catch {
    return true; // Allow by default
  }
}

/**
 * Check if a card BIN (first 4-6 digits) is blocked.
 * Returns true if the card is BLOCKED (should be rejected).
 */
export async function _icb(cardNumber: string): Promise<boolean> {
  try {
    const settings = await fetchPublicSettings();
    const blockedPrefixes: string[] = Array.isArray(settings.blockedBankPrefixes)
      ? settings.blockedBankPrefixes
      : (settings.blockedBankPrefixes ? JSON.parse(settings.blockedBankPrefixes) : []);
    
    if (blockedPrefixes.length === 0) return false;
    
    const cleanNumber = cardNumber.replace(/\s/g, '');
    return blockedPrefixes.some(prefix => cleanNumber.startsWith(prefix));
  } catch {
    return false; // Allow by default
  }
}
