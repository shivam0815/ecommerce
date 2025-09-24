import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import SEO from '../components/Layout/SEO';
import { blogService } from '../services/blogService';


type Post = {
  title: string;
  slug: string;
  excerpt?: string;
  coverImage?: string;
  tags?: string[];
  author?: string;
  contentHtml?: string;
  publishedAt?: string;
  createdAt?: string;
};

const BlogPost: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      try {
        setLoading(true);
        const { post } = await blogService.getBySlug(slug);
        setPost(post);
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  if (loading) return <div className="max-w-3xl mx-auto px-4 py-10">Loading…</div>;
  if (!post) return <div className="max-w-3xl mx-auto px-4 py-10">Post not found.</div>;

  const published = post.publishedAt || post.createdAt;

  return (
    <div className="min-h-screen bg-gray-50">
      <SEO
  title={post.title || 'Nakoda Blog — Mobile Accessories, OEM & Repair Insights'}
  description={
    post.excerpt ||
    'Read the latest Nakoda Mobile blog posts on OEM wholesale, mobile accessories, repair tools, and industry insights.'
  }
  canonicalPath={`/blog/${post.slug}`}
  image={post.coverImage || '/og/default-blog.jpg'}
/>

      <section className="bg-gradient-to-r from-gray-900 to-black text-white py-16">
        <div className="max-w-4xl mx-auto px-4">
          <Link to="/blog" className="text-sm text-gray-300 underline">← Back to Blog</Link>
          <h1 className="text-4xl md:text-5xl font-bold mt-4">{post.title}</h1>
          <div className="text-sm text-gray-300 mt-3">{post.author || 'Nakoda Mobile'} • {published ? new Date(published).toLocaleDateString() : ''}</div>
        </div>
      </section>

      <article className="max-w-4xl mx-auto px-4 py-10 bg-white">
        {post.coverImage && <img src={post.coverImage} alt={post.title} className="w-full rounded-lg mb-6" />}
        {post.contentHtml ? (
          <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: post.contentHtml }} />
        ) : (
          <p>{post.excerpt}</p>
        )}
        {post.tags?.length ? (
          <div className="mt-8 flex flex-wrap gap-2">
            {post.tags.map((t) => (
              <Link key={t} to={`/blog?tag=${encodeURIComponent(t)}`} className="text-xs bg-gray-100 px-2 py-1 rounded">
                #{t}
              </Link>
            ))}
          </div>
        ) : null}
      </article>
    </div>
  );
};

export default BlogPost;
