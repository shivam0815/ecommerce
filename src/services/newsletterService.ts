import api from '../config/api';

export interface SubscribeResult {
  success: boolean;
  message: string;
}

export const newsletterService = {
  async subscribe(email: string, tag?: string, source = 'home-newsletter') {
    return api.post('/newsletter/subscribe', { email, tag, source, website: '' }); // honeypot empty
  },
  async confirm(token: string) {
    return api.get(`/newsletter/confirm`, { params: { token } });
  },
  async unsubscribeByToken(token: string) {
    return api.get(`/newsletter/unsubscribe`, { params: { token } });
  },
  async unsubscribeByEmail(email: string) {
    return api.post(`/newsletter/unsubscribe`, { email });
  },
};
