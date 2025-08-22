import React, { useEffect, useMemo, useState } from 'react';
import { reviewsService } from '../../services/reviewsService';
import { Star } from 'lucide-react';
import toast from 'react-hot-toast';

type Props = { productId: string; productName: string };

const Reviews: React.FC<Props> = ({ productId, productName }) => {
  const [items, setItems] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [dist, setDist] = useState<Record<string, number>>({ '1':0,'2':0,'3':0,'4':0,'5':0 });

  // form
  const [rating, setRating] = useState<number>(5);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const totalReviews = useMemo(
    () => Object.values(dist).reduce((a, b) => a + b, 0),
    [dist]
  );

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        const res = await reviewsService.list(productId, page, 10);
        setItems(res.reviews || []);
        setPages(res?.pagination?.pages || 1);
        setDist(res?.distribution || { '1':0,'2':0,'3':0,'4':0,'5':0 });
      } catch (e: any) {
        toast.error(e.message || 'Failed to load reviews');
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [productId, page]);

  const avg =
    totalReviews > 0
      ? (items.reduce((sum, r) => sum + (Number(r.rating) || 0), 0) / items.length)
      : 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim() || comment.trim().length < 5) {
      toast.error('Please write a longer comment (min 5 chars)');
      return;
    }
    setSubmitting(true);
    try {
      await reviewsService.create({
        productId,
        rating,
        title: title.trim() || undefined,
        comment: comment.trim(),
        userName: name.trim() || undefined,
        userEmail: email.trim() || undefined,
      });
      toast.success('Review submitted for approval!');
      setRating(5); setTitle(''); setComment(''); setName(''); setEmail('');
      setPage(1);
    } catch (e: any) {
      toast.error(e.message || 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Left: summary */}
      <div>
        <div className="p-4 rounded-lg border bg-white">
          <h4 className="text-lg font-semibold mb-2">Ratings & Reviews</h4>
          <div className="flex items-center gap-2">
            <span className="text-3xl font-bold">{avg ? avg.toFixed(1) : '—'}</span>
            <div className="flex">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className={`h-5 w-5 ${i < Math.round(avg) ? 'text-yellow-400 fill-current' : 'text-gray-300'}`} />
              ))}
            </div>
          </div>
          <div className="text-sm text-gray-600 mt-1">{totalReviews} verified reviews</div>

          <div className="mt-4 space-y-1">
            {[5,4,3,2,1].map((n) => {
              const cnt = dist[String(n)] || 0;
              const pct = totalReviews ? Math.round((cnt / totalReviews) * 100) : 0;
              return (
                <div key={n} className="flex items-center gap-3">
                  <span className="w-6 text-sm">{n}★</span>
                  <div className="flex-1 h-2 bg-gray-200 rounded">
                    <div className="h-2 bg-yellow-400 rounded" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-10 text-right text-xs text-gray-600">{cnt}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Middle: list */}
      <div className="lg:col-span-2 space-y-4">
        {loading ? (
          <div className="p-6 text-gray-500">Loading reviews...</div>
        ) : items.length === 0 ? (
          <div className="p-6 text-gray-600 bg-white rounded-lg border">
            No reviews yet. Be the first to review <strong>{productName}</strong>.
          </div>
        ) : (
          items.map((r, idx) => (
            <div key={idx} className="p-4 bg-white rounded-lg border">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">{r.rating}★</span>
                <span className="text-sm font-medium">{r.title || r.userName || 'Anonymous'}</span>
                <span className="text-xs text-gray-500">• {new Date(r.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="text-gray-700 whitespace-pre-line">{r.comment}</div>
            </div>
          ))
        )}

        {pages > 1 && (
          <div className="flex items-center gap-2">
            <button className="px-3 py-1 border rounded" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
              Prev
            </button>
            <div className="text-sm">Page {page} of {pages}</div>
            <button className="px-3 py-1 border rounded" onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page === pages}>
              Next
            </button>
          </div>
        )}
      </div>

      {/* Right: form */}
      <div className="lg:col-span-3">
        <form onSubmit={submit} className="p-4 bg-white rounded-lg border">
          <h4 className="text-lg font-semibold mb-3">Write a review</h4>

          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm text-gray-700">Your rating:</span>
            <div className="flex">
              {[1,2,3,4,5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n)}
                  className="p-0.5"
                  title={`${n} star${n > 1 ? 's' : ''}`}
                >
                  <Star className={`h-6 w-6 ${n <= rating ? 'text-yellow-400 fill-current' : 'text-gray-300'}`} />
                </button>
              ))}
            </div>
          </div>

          <input
            type="text"
            className="w-full border rounded px-3 py-2 mb-2"
            placeholder="Title (optional)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          <textarea
            id="review-textarea"
            className="w-full border rounded px-3 py-2 mb-2"
            rows={4}
            placeholder="Share your experience…"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            required
          />

          {/* If you don't have user auth, collect name/email */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <input
              type="text"
              className="border rounded px-3 py-2"
              placeholder="Your name (optional)"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              type="email"
              className="border rounded px-3 py-2"
              placeholder="Email (optional)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="bg-blue-600 text-white px-5 py-2 rounded hover:bg-blue-700 disabled:opacity-60"
          >
            {submitting ? 'Submitting…' : 'Submit Review'}
          </button>

          <p className="text-xs text-gray-500 mt-2">
            Reviews are published after moderation.
          </p>
        </form>
      </div>
    </div>
  );
};

export default Reviews;
