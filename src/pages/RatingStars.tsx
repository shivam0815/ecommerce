import React from 'react';
import { Star } from 'lucide-react';

interface RatingStarsProps {
  value: number;     // rating value 0–5 (can be decimal)
  size?: number;     // icon size in px (default 16)
}

const RatingStars: React.FC<RatingStarsProps> = ({ value, size = 16 }) => {
  // clamp between 0 and 5
  const rating = Math.max(0, Math.min(5, value));
  // convert to percent for overlay trick
  const pct = (rating / 5) * 100;

  return (
    <div className="relative inline-block" aria-label={`Rating ${rating} out of 5`}>
      {/* base layer: empty stars */}
      <div className="flex gap-0.5 text-gray-300">
        {[...Array(5)].map((_, i) => (
          <Star key={i} width={size} height={size} />
        ))}
      </div>
      {/* overlay: filled stars clipped to width */}
      <div
        className="absolute top-0 left-0 overflow-hidden text-yellow-400"
        style={{ width: `${pct}%` }}
      >
        <div className="flex gap-0.5">
          {[...Array(5)].map((_, i) => (
            <Star key={i} width={size} height={size} className="fill-current" />
          ))}
        </div>
      </div>
    </div>
  );
};

export default RatingStars;
