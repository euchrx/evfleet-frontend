import { api } from './api';

export async function sendFeedback(data: {
  token: string;
  rating: number;
  comment?: string;
  tagIds?: string[];
}) {
  return api.post('/kiosk/feedback', data);
}