/**
 * Firebase Services - Replaced with REST API + Socket.io
 * This file maintains the same interface for backward compatibility
 */

import { addData, getData, getMessages as apiGetMessages, sendMessage as apiSendMessage } from './api';
import { onVisitorNewMessage, onVisitorStatusUpdated } from './socket';
import type { InsuranceApplication, ChatMessage } from './firestore-types';

export const createApplication = async (
  data: Omit<InsuranceApplication, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> => {
  const id = `visitor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  await addData({ id, ...data });
  return id;
};

export const updateApplication = async (id: string, data: Partial<InsuranceApplication>): Promise<void> => {
  await addData({ id, ...data });
};

export const getApplication = async (id: string): Promise<InsuranceApplication | null> => {
  const data = await getData(id);
  if (!data) return null;
  return { id, ...data } as InsuranceApplication;
};

export const sendMessage = async (
  data: Omit<ChatMessage, 'id' | 'timestamp'>
): Promise<string> => {
  const msgId = `msg_${Date.now()}`;
  // Messages are sent via Socket.io in components
  return msgId;
};

export const getMessages = async (applicationId: string): Promise<ChatMessage[]> => {
  const msgs = await apiGetMessages(applicationId);
  return msgs.map((m: any) => ({
    id: m.id,
    applicationId: m.visitor_id,
    senderId: m.sender_id,
    senderName: m.sender_name,
    senderRole: m.sender_role,
    message: m.message,
    timestamp: new Date(m.created_at),
    read: m.is_read,
  }));
};

export const subscribeToMessages = (
  applicationId: string,
  callback: (messages: ChatMessage[]) => void
): (() => void) => {
  // Initial load
  getMessages(applicationId).then(callback);

  // Listen for new messages via Socket.io
  const unsubscribe = onVisitorNewMessage((msgData: any) => {
    if (msgData.visitorId === applicationId) {
      getMessages(applicationId).then(callback);
    }
  });

  return unsubscribe;
};

export const markMessageAsRead = async (messageId: string): Promise<void> => {
  // Handled by admin API
};

export const subscribeToApplications = (
  callback: (applications: InsuranceApplication[]) => void
): (() => void) => {
  // Not used in visitor frontend
  return () => {};
};
