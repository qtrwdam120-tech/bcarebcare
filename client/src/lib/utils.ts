import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { addData, setVisitorOffline } from './api';
import { visitorHeartbeat } from './socket';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const onlyNumbers = (value: string) => {
  return value.replace(/[^\d٠-٩]/g, '');
};

/** Setup online status tracking (replaces Firebase Realtime Database) */
export const setupOnlineStatus = (userId: string) => {
  if (!userId) return;

  // Update online status via API
  addData({ id: userId, isOnline: true }).catch(console.error);

  // Heartbeat
  const interval = setInterval(() => {
    visitorHeartbeat(userId);
  }, 15000);

  // Set offline on page unload
  window.addEventListener('beforeunload', () => {
    clearInterval(interval);
    setVisitorOffline(userId);
  });
};

/** Set user offline */
export const setUserOffline = async (userId: string) => {
  if (!userId) return;
  try {
    await setVisitorOffline(userId);
  } catch (error) {
    console.error('Error setting user offline:', error);
  }
};
