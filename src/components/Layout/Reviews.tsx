// // src/components/Product/Reviews.tsx
// import React, { useEffect, useState } from 'react';
// import toast from 'react-hot-toast';

// type Review = {
//   _id: string;
//   userName: string;
//   rating: number;
//   comment: string;
//   reviewDate: string;
//   verified?: boolean;
//   helpful?: number;
// };

// interface Props {
//   productId: string;
//   productName: string;
// }

// function getAuthToken(): string | null {
//   // adjust if your app stores the token elsewhere
//   return (
//     localStorage.getItem('userToken') ||
//     sessionStorage.getItem('userToken') ||
//     localStorage.getItem('token') ||
//     null
//   );
// }

// export default function Reviews({ productId, productName }: Props) {
//   const [reviews, setReviews] = useState<Review[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [rating, setRating] = useState(5);
//   const [comment, setComment] = useState('');
//   const [submitting, setSubmitting] = useState(false);

//   async function load() {
//     setLoading(true);
//     try {
//       const res = await fetch(`/api/products/${productId}/reviews`); // GET is public
//       const json = await res.json();
//       setReviews(Array.isArray(json?.data) ? json.data : []);
//     } catch (e) {
//       // show nothing rather than breaking UI
//       setReviews([]);
//     } finally {
//       setLoading(false);
//     }
//   }

//   useEffect(() => {
//     load();
//   }, [productId]);

// // In Reviews.tsx, update the submit function:
// async function submit() {
//   const token = getAuthToken();
//   if (!token) {
//     toast.error('Please sign in to write a review.');
//     return;
//   }

//   setSubmitting(true);
//   try {
//     const res = await fetch(`/api/products/${productId}/reviews`, {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/json',
//         'Authorization': `Bearer ${token}`, // Ensure Bearer prefix
//       },
//       body: JSON.stringify({ 
//         rating, 
//         comment, 
//         productName 
//       }),
//     });

//     if (res.status === 401) {
//       toast.error('Authentication required. Please login again.');
//       localStorage.removeItem('userToken'); // Clear invalid token
//       return;
//     }

//     const json = await res.json();
//     if (!res.ok || !json?.success) {
//       throw new Error(json?.message || `Failed (${res.status})`);
//     }

//     toast.success('Review submitted successfully! It will appear after admin approval.');
//     setComment('');
//     setRating(5);
    
//   } catch (err: any) {
//     console.error('Review submission error:', err);
//     toast.error(err?.message || 'Could not submit review.');
//   } finally {
//     setSubmitting(false);
//   }
// }


//   if (loading) return <div>Loading reviews…</div>;

//   return (
//     <div>
//       {/* Existing approved reviews */}
//       {reviews.length === 0 ? (
//         <div className="text-center text-gray-600 mb-6">No reviews yet.</div>
//       ) : (
//         <div className="space-y-4 mb-8">
//           {reviews.map((r) => (
//             <div key={r._id} className="border-b pb-3">
//               <div className="flex items-center gap-2 text-sm text-gray-600">
//                 <span>{'⭐'.repeat(r.rating)}</span>
//                 <span>•</span>
//                 <span>{new Date(r.reviewDate).toLocaleDateString()}</span>
//                 {r.verified && <span className="ml-2 text-green-600">✔ Verified purchase</span>}
//               </div>
//               <div className="text-xs text-gray-500">{r.userName}</div>
//               <p className="mt-1 text-gray-800">{r.comment}</p>
//             </div>
//           ))}
//         </div>
//       )}

//       {/* Write a review */}
//       <div className="p-4 border rounded">
//         <h4 className="font-medium mb-3">Write a review</h4>
//         <label className="block mb-3">
//           <span className="text-sm text-gray-700 mr-2">Rating:</span>
//           <select
//             value={rating}
//             onChange={(e) => setRating(parseInt(e.target.value, 10))}
//             className="border p-2 rounded"
//           >
//             {[5, 4, 3, 2, 1].map((n) => (
//               <option key={n} value={n}>
//                 {n}
//               </option>
//             ))}
//           </select>
//         </label>
//         <textarea
//           id="review-textarea"
//           value={comment}
//           onChange={(e) => setComment(e.target.value)}
//           placeholder="Share your experience…"
//           className="w-full border p-3 rounded mb-3"
//           rows={4}
//         />
//         <button
//           onClick={submit}
//           disabled={submitting}
//           className={`px-4 py-2 rounded text-white ${submitting ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}`}
//         >
//           {submitting ? 'Submitting…' : 'Submit Review'}
//         </button>
//         <p className="text-xs text-gray-500 mt-2">
//           Reviews are moderated. Approved reviews are visible to all customers of this product.
//         </p>
//       </div>
//     </div>
//   );
// }
