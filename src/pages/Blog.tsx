import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import SEO from '../components/Layout/SEO';
import { blogService } from '../services/blogService';

type PostCard = {
  title: string;
  slug: string;
  excerpt?: string;
  coverImage?: string;
  tags?: string[];
  author?: string;
  publishedAt?: string;
};

const Blog: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const [posts, setPosts] = useState<PostCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageInfo, setPageInfo] = useState({ page: 1, pages: 1, hasMore: false });

  const page = Number(params.get('page') || 1);
  const q = params.get('q') || '';
  const tag = params.get('tag') || '';

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const { posts, pagination } = await blogService.list({ page, q, tag });
        setPosts(posts);
        setPageInfo({ page: pagination.page, pages: pagination.pages, hasMore: pagination.hasMore });
      } finally {
        setLoading(false);
      }
    })();
  }, [page, q, tag]);

  const go = (p: number) => setParams({ ...(q && { q }), ...(tag && { tag }), page: String(p) });

  return (
    <div className="min-h-screen bg-gray-50">
      <SEO
        title="Blog"
        description="Guides, tips and news from Nakoda Mobile: accessories, charging, audio, repair tools and more."
        canonicalPath="/blog"
      />

      <section className="bg-gradient-to-br from-blue-600 via-purple-600 to-blue-800 text-white py-16">
        <div className="max-w-7xl mx-auto px-4">
          <h1 className="text-4xl md:text-5xl font-bold">Nakoda Blog</h1>
          <p className="text-gray-200 mt-3">Insights on mobile accessories, charging tech, and repair.</p>
        </div>
      </section>

      <section className="py-12">
        <div className="max-w-7xl mx-auto px-4">
          {loading ? (
            <p>Loading…</p>
          ) : posts.length === 0 ? (
            <p>No posts found.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {posts.map((p) => (
                <article key={p.slug} className="bg-white rounded-xl shadow hover:shadow-lg transition p-4 overflow-hidden">
                  {p.coverImage && (
                    <Link to={`/blog/${p.slug}`}>
                      <img src={p.coverImage} alt={p.title} className="w-full h-48 object-cover rounded-lg" />
                    </Link>
                  )}
                  <div className="mt-4">
                    <Link to={`/blog/${p.slug}`} className="text-xl font-semibold text-gray-900 hover:text-blue-600">
                      {p.title}
                    </Link>
                    {p.excerpt && <p className="text-gray-600 mt-2 line-clamp-3">{p.excerpt}</p>}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {p.tags?.slice(0, 4).map((t) => (
                        <Link key={t} to={`/blog?tag=${encodeURIComponent(t)}`} className="text-xs bg-gray-100 px-2 py-1 rounded">
                          #{t}
                        </Link>
                      ))}
                    </div>
                    <div className="text-xs text-gray-500 mt-3">
                      {p.author || 'Nakoda Mobile'} • {p.publishedAt ? new Date(p.publishedAt).toLocaleDateString() : ''}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}

          {!loading && pageInfo.pages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-10">
              <button onClick={() => go(Math.max(1, page - 1))} disabled={page <= 1} className="px-3 py-2 border rounded disabled:opacity-50">
                Prev
              </button>
              <span className="text-sm">Page {pageInfo.page} / {pageInfo.pages}</span>
              <button onClick={() => go(Math.min(pageInfo.pages, page + 1))} disabled={!pageInfo.hasMore} className="px-3 py-2 border rounded disabled:opacity-50">
                Next
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default Blog;
