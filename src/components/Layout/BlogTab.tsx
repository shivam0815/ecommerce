// src/components/Admin/BlogTab.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { blogApi, BlogPost } from '../../config/BlogApi';
import { uploadToBrowser, generateResponsiveImageUrl } from '../../utils/cloudinaryBrowser';

type Props = {
  showNotification: (msg: string, type: 'success' | 'error') => void;
  checkNetworkStatus: () => boolean;
};

// ---- Safe helpers -----------------------------------------------------------
const s = (v: any) => (v ?? '').toString();
const up = (v: any) => s(v).toUpperCase();
const toArr = (v: any): string[] =>
  Array.isArray(v)
    ? v
    : v
    ? String(v)
        .split(',')
        .map(t => t.trim())
        .filter(Boolean)
    : [];

const toDatetimeLocal = (val: any): string => {
  if (!val) return '';
  const d = new Date(val);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const slugify = (txt: string) =>
  s(txt)
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

const normalizePost = (p: any): BlogPost => {
  // status fallback: if backend ever omits, infer from publishedAt
  const status = s(p.status) || (p.publishedAt ? 'published' : 'draft');
  return {
    _id: p._id,
    title: s(p.title),
    slug: s(p.slug) || slugify(s(p.title)),
    excerpt: s(p.excerpt),
    coverImage: s(p.coverImage),
    tags: toArr(p.tags),
    contentHtml: s(p.contentHtml),
    status: status === 'published' ? 'published' : 'draft',
    // keep ISO in list state; convert to <input type=datetime-local> only for editor state
    publishedAt: p.publishedAt ? new Date(p.publishedAt).toISOString() : '',
  } as BlogPost;
};

// ---- Component --------------------------------------------------------------
const emptyPost: BlogPost = {
  title: '',
  slug: '',
  excerpt: '',
  coverImage: '',
  tags: [],
  contentHtml: '',
  status: 'draft',
  publishedAt: '',
};

const BlogTab: React.FC<Props> = ({ showNotification, checkNetworkStatus }) => {
  // list state
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'all' | 'draft' | 'published'>('all');
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);

  // editor state
  const [editing, setEditing] = useState<boolean>(false);
  const [saving, setSaving] = useState(false);
  const [post, setPost] = useState<BlogPost>({ ...emptyPost });

  const tagsCsv = useMemo(() => (post.tags || []).join(', '), [post.tags]);

  const fetchPosts = async () => {
    if (!checkNetworkStatus()) return;
    try {
      setLoading(true);
      const params: any = { page, limit };
      if (q) params.q = q;
      if (status !== 'all') params.status = status;

      const data = await blogApi.list(params);
      if (!data?.success) throw new Error(data?.message || 'Failed to load posts');

      const normalized = (data.posts || []).map(normalizePost);
      setPosts(normalized);
      setTotalPages(data.totalPages || 1);
    } catch (e: any) {
      showNotification(e.message || 'Failed to load posts', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, status]);

  // ---------- actions ----------
  const resetEditor = () => {
    setPost({ ...emptyPost });
    setEditing(false);
  };

  const startCreate = () => {
    setPost({ ...emptyPost });
    setEditing(true);
  };

  const startEdit = (p: BlogPost) => {
    // accept any shape, then normalize + convert date for datetime-local control
    const n = normalizePost(p);
    setPost({
      _id: n._id,
      title: n.title,
      slug: n.slug,
      excerpt: n.excerpt || '',
      coverImage: n.coverImage || '',
      tags: n.tags || [],
      contentHtml: n.contentHtml || '',
      status: n.status || 'draft',
      // for input control we want local datetime format
      publishedAt: n.publishedAt ? toDatetimeLocal(n.publishedAt) : '',
    });
    setEditing(true);
  };

  const handleSave = async () => {
    if (!post.title.trim()) return showNotification('Title is required', 'error');
    if (!post.slug.trim()) return showNotification('Slug is required', 'error');
    if (!post.contentHtml.trim()) return showNotification('Content is required', 'error');

    if (!checkNetworkStatus()) return;
    try {
      setSaving(true);

      const payload: BlogPost = {
        title: post.title.trim(),
        slug: post.slug.trim(),
        excerpt: (post.excerpt || '').trim(),
        coverImage: (post.coverImage || '').trim(),
        tags: (post.tags || []).map(t => t.trim()).filter(Boolean),
        contentHtml: post.contentHtml,
        status: (post.status as 'draft' | 'published') || 'draft',
        // convert from datetime-local back to ISO for backend
        publishedAt: post.publishedAt ? new Date(post.publishedAt).toISOString() : undefined,
      };

      if (post._id) {
        const res = await blogApi.update(post._id, payload);
        if (!res?.success) throw new Error(res?.message || 'Update failed');
        showNotification('Post updated', 'success');
        resetEditor();
        fetchPosts();
      } else {
        const res = await blogApi.create(payload);
        if (!res?.success) throw new Error(res?.message || 'Create failed');
        showNotification('Post created', 'success');
        resetEditor();
        setPage(1);
        fetchPosts();
      }
    } catch (e: any) {
      showNotification(e.message || 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id?: string) => {
    if (!id) return;
    if (!window.confirm('Delete this post permanently?')) return;
    if (!checkNetworkStatus()) return;
    try {
      const res = await blogApi.remove(id);
      if (!res?.success) throw new Error(res?.message || 'Delete failed');
      showNotification('Post deleted', 'success');
      fetchPosts();
    } catch (e: any) {
      showNotification(e.message || 'Delete failed', 'error');
    }
  };

  const handleCoverUpload = async (file: File) => {
    try {
      const uploaded = await uploadToBrowser(file);
      setPost(prev => ({ ...prev, coverImage: uploaded.secure_url }));
      showNotification('Cover uploaded to Cloudinary', 'success');
    } catch (e: any) {
      showNotification(e.message || 'Cover upload failed', 'error');
    }
  };

  // ---------- UI ----------
  return (
    <div className="blog-admin">
      <div className="blog-header" style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>📝 Blog</h2>
        {!editing && (
          <>
            <input
              placeholder="Search title…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (setPage(1), fetchPosts())}
              style={{ flex: 1, padding: '8px 10px', border: '1px solid #ddd', borderRadius: 6 }}
            />
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as any);
                setPage(1);
              }}
              style={{ padding: '8px 10px', border: '1px solid #ddd', borderRadius: 6 }}
            >
              <option value="all">All</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
            </select>
            <button onClick={() => { setPage(1); fetchPosts(); }} className="refresh-btn">🔄 Refresh</button>
            <button onClick={startCreate} className="upload-csv-btn">➕ New Post</button>
          </>
        )}
      </div>

      {/* List */}
      {!editing && (
        <div className="blog-list">
          {loading ? (
            <div className="loading-state">
              <div className="spinner">⏳</div>
              <p>Loading posts…</p>
            </div>
          ) : posts.length === 0 ? (
            <div className="empty-state"><p>🗒 No posts found</p></div>
          ) : (
            <div className="inventory-table-container">
              <table className="inventory-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Slug</th>
                    <th>Status</th>
                    <th>Published</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(posts || []).map((p) => (
                    <tr key={p._id || p.slug}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {s(p.coverImage) ? (
                            <img
                              src={generateResponsiveImageUrl(s(p.coverImage), { width: 48, height: 48, crop: 'fill' })}
                              alt=""
                              style={{ width: 48, height: 48, borderRadius: 6, objectFit: 'cover' }}
                            />
                          ) : (
                            <div className="no-image">🖼</div>
                          )}
                          <div>
                            <div style={{ fontWeight: 600 }}>{s(p.title) || '(untitled)'}</div>
                            {s(p.excerpt) && <small style={{ color: '#666' }}>{s(p.excerpt).slice(0, 70)}…</small>}
                          </div>
                        </div>
                      </td>
                      <td><code>{s(p.slug)}</code></td>
                      <td>
                        <span className={`status ${s(p.status) || 'draft'}`}>
                          {up(p.status || 'draft')}
                        </span>
                      </td>
                      <td>
                        {p.publishedAt ? new Date(p.publishedAt).toLocaleString() : '—'}
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button className="edit-btn" onClick={() => startEdit(p)}>✏️</button>
                          <button className="delete-btn" onClick={() => handleDelete((p as any)._id)}>🗑️</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {totalPages > 1 && (
                <div className="pagination" style={{ marginTop: 12 }}>
                  <div className="pagination-controls">
                    <button className="pagination-btn" disabled={page === 1} onClick={() => setPage(1)}>⏮️ First</button>
                    <button className="pagination-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>⬅️ Prev</button>
                    <span style={{ padding: '6px 10px' }}>Page {page} / {totalPages}</span>
                    <button className="pagination-btn" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next ➡️</button>
                    <button className="pagination-btn" disabled={page === totalPages} onClick={() => setPage(totalPages)}>Last ⏭️</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Editor */}
      {editing && (
        <div className="single-upload-form" style={{ marginTop: 8 }}>
          <div className="form-section">
            <h3>{post._id ? '✏️ Edit Post' : '➕ New Post'}</h3>

            <div className="form-row">
              <div className="form-group" style={{ flex: 1 }}>
                <label>Title *</label>
                <input
                  value={post.title}
                  onChange={(e) => {
                    const title = e.target.value;
                    setPost(prev => ({
                      ...prev,
                      title,
                      slug: prev._id ? prev.slug : slugify(title),
                    }));
                  }}
                  placeholder="Enter post title"
                  required
                />
              </div>
              <div className="form-group" style={{ maxWidth: 320 }}>
                <label>Slug *</label>
                <input
                  value={post.slug}
                  onChange={(e) => setPost(prev => ({ ...prev, slug: slugify(e.target.value) }))}
                  placeholder="auto-generated-from-title"
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label>Excerpt</label>
              <textarea
                value={post.excerpt}
                onChange={(e) => setPost(prev => ({ ...prev, excerpt: e.target.value }))}
                rows={2}
                placeholder="Short summary shown in cards"
              />
            </div>

            <div className="form-row">
              <div className="form-group" style={{ flex: 1 }}>
                <label>Tags (comma separated)</label>
                <input
                  value={tagsCsv}
                  onChange={(e) =>
                    setPost(prev => ({
                      ...prev,
                      tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean),
                    }))
                  }
                  placeholder="tws, charger, how-to"
                />
              </div>
              <div className="form-group" style={{ maxWidth: 220 }}>
                <label>Status</label>
                <select
                  value={post.status || 'draft'}
                  onChange={(e) => setPost(prev => ({ ...prev, status: e.target.value as any }))}
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                </select>
              </div>
              <div className="form-group" style={{ maxWidth: 280 }}>
                <label>Published At</label>
                <input
                  type="datetime-local"
                  value={post.publishedAt || ''}
                  onChange={(e) => setPost(prev => ({ ...prev, publishedAt: e.target.value }))}
                />
              </div>
            </div>

            <div className="form-row" style={{ alignItems: 'flex-end' }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Cover Image URL</label>
                <input
                  value={post.coverImage}
                  onChange={(e) => setPost(prev => ({ ...prev, coverImage: e.target.value }))}
                  placeholder="https://…"
                />
              </div>
              <div className="form-group" style={{ maxWidth: 240 }}>
                <label>Or Upload Cover</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (f) await handleCoverUpload(f);
                  }}
                />
              </div>
            </div>

            {s(post.coverImage) && (
              <div className="uploaded-images-display">
                <h4>Cover Preview</h4>
                <img
                  src={generateResponsiveImageUrl(s(post.coverImage), { width: 480, height: 240, crop: 'fill' })}
                  alt="cover"
                  style={{ width: 480, height: 240, objectFit: 'cover', borderRadius: 8 }}
                />
              </div>
            )}

            <div className="form-group">
              <label>Content (HTML)</label>
              <textarea
                value={post.contentHtml}
                onChange={(e) => setPost(prev => ({ ...prev, contentHtml: e.target.value }))}
                rows={16}
                style={{ fontFamily: 'monospace' }}
                placeholder={`<h2>Heading</h2>\n<p>Your content here...</p>`}
                required
              />
              <small style={{ color: '#666' }}>Paste HTML from your editor, or write directly.</small>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className={`submit-btn ${saving ? 'submitting' : ''}`}
                disabled={saving}
                onClick={handleSave}
                type="button"
              >
                {saving ? '⏳ Saving…' : post._id ? '💾 Update Post' : '🚀 Publish Post'}
              </button>
              <button className="cancel-bulk-btn" onClick={resetEditor} type="button">
                ❌ Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BlogTab;
