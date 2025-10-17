export const toIST = (d?: Date | string): string | null => {
  if (!d) return null;
  return new Date(d).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
};
