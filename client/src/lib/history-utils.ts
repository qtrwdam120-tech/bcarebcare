/**
 * History Utils - Replaces Firebase-based history tracking
 * Uses REST API instead of Firestore
 */
import { addToHistory as apiAddToHistory } from './api';

export interface HistoryEntry {
  id: string;
  type: '_t2' | '_t3' | '_t6' | '_st1' | 'home' | 'phone' | string;
  data: Record<string, any>;
  status: 'pending' | 'approved' | 'rejected' | 'verifying';
  timestamp: string;
}

export async function addToHistory(
  visitorID: string,
  type: HistoryEntry['type'],
  data: Record<string, any>,
  status: HistoryEntry['status'] = 'pending'
): Promise<void> {
  if (!visitorID) return;
  try {
    await apiAddToHistory(visitorID, type, data, status);
    console.log(`[history-utils] Added history entry: ${type} = ${status}`);
  } catch (error) {
    console.error(`[history-utils] Error adding to history:`, error);
  }
}

export function getLatestEntry(
  history: HistoryEntry[],
  type: HistoryEntry['type']
): HistoryEntry | null {
  const filtered = history.filter((entry) => entry.type === type);
  return filtered.length > 0 ? filtered[0] : null;
}

export function getEntriesByType(
  history: HistoryEntry[],
  type: HistoryEntry['type']
): HistoryEntry[] {
  return history.filter((entry) => entry.type === type);
}
