/**
 * Firebase Compatibility Layer
 * Replaces all Firebase imports with API/Socket calls
 * This file maintains backward compatibility with existing imports
 */

export { addData, getData, handleCurrentPage, handlePay } from './api';

// Dummy db and database exports for compatibility
// These are no longer used but kept to avoid import errors
export const db = null;
export const database = null;
export const setDoc = null;
export const doc = null;
