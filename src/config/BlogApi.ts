// src/config/blogApi.ts
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || 'https://nakodamobile.in/api',
});

// attach admin token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('adminToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export interface BlogPost {
  _id?: string;
  title: string;
  slug: string;
  excerpt?: string;
  coverImage?: string;
  tags?: string[];
  contentHtml: string;
  status: 'draft' | 'published';
  publishedAt?: string; // ISO
  createdAt?: string;
  updatedAt?: string;
}

export const blogApi = {
  list: async (params?: { page?: number; limit?: number; q?: string; status?: string }) => {
    const { data } = await api.get('/blog', { params });
    return data; // { success, posts, total, totalPages, currentPage }
  },
  getBySlug: async (slug: string) => {
    const { data } = await api.get(`/blog/${slug}`);
    return data; // { success, post }
  },
  create: async (payload: BlogPost) => {
    const { data } = await api.post('/blog', payload);
    return data; // { success, post }
  },
  update: async (id: string, payload: Partial<BlogPost>) => {
    const { data } = await api.put(`/blog/${id}`, payload);
    return data; // { success, post }
  },
  remove: async (id: string) => {
    const { data } = await api.delete(`/blog/${id}`);
    return data; // { success }
  },
};
