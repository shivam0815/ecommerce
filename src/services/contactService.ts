import api from '../config/api';
import toast from 'react-hot-toast';

export interface ContactPayload {
  name: string;
  email: string;
  phone?: string;
  subject: 'general' | 'support' | 'oem' | 'wholesale' | 'technical' | 'partnership';
  message: string;
  website?: string; // honeypot (optional)
}

export const contactService = {
  async send(payload: ContactPayload) {
    try {
      const { data } = await api.post('/contact', payload);
      toast.success(data?.message || 'Message sent!');
      return data;
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to send message';
      toast.error(msg);
      throw err;
    }
  },
};
