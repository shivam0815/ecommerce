import { useMemo } from 'react';
import { useAuth } from '../hooks/useAuth';

export function useReferralLink(slug?: string) {
  const { user } = useAuth(); // must have: user.referralCode
  const base = typeof window !== 'undefined' ? window.location.origin : '';
  return useMemo(() => {
    const path = slug ? `/p/${slug}` : '/';
    const ref = user?.referralCode ? `?ref=${user.referralCode}` : '';
    return `${base}${path}${ref}`;
  }, [base, slug, user?.referralCode]);
}
