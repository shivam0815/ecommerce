import React from 'react';
import { Copy, Share2, } from 'lucide-react'; // or any WA icon
import { useReferralLink } from '../../hooks/useReferralLink';

type Props = { productSlug?: string; text?: string };
const ShareReferral: React.FC<Props> = ({ productSlug, text }) => {
  const link = useReferralLink(productSlug);
  const caption = text ?? 'Check this on Nakoda Mobile';

  const copy = async () => {
    try { await navigator.clipboard.writeText(link); } catch {}
  };
  const wa = () => {
    const u = `https://wa.me/?text=${encodeURIComponent(`${caption} ${link}`)}`;
    window.open(u, '_blank');
  };
  if (!link.includes('?ref=')) return null; // only show when logged in with code

  return (
    <div className="flex items-center gap-2">
      <button onClick={copy} className="px-3 py-2 rounded-lg border hover:bg-gray-50 flex items-center gap-2">
        <Copy size={16}/> Copy link
      </button>
      <button onClick={wa} className="px-3 py-2 rounded-lg border hover:bg-gray-50 flex items-center gap-2">
        <Share2 size={16}/> WhatsApp
      </button>
    </div>
  );
};
export default ShareReferral;
