import { z } from 'zod';

const Env = z.object({
  SUPPORT_EMAIL: z.string().email().default('support@nakodamobile.in'),
  SUPPORT_PHONE: z.string().min(6).default('+91 98765 43210'),
  SUPPORT_WHATSAPP: z.string().regex(/^\d+$/).default('919876543210'),
}).parse(process.env);

export const supportResponse = () => ({
  email: Env.SUPPORT_EMAIL,
  phone: Env.SUPPORT_PHONE,
  whatsappNumber: Env.SUPPORT_WHATSAPP,
});
