import axios from 'axios';

const API = '/api/blog';

export const blogService = {
  list: async (params?: { page?: number; limit?: number; q?: string; tag?: string }) => {
    const { data } = await axios.get(API, { params });
    return data; // { success, posts, pagination }
  },
  getBySlug: async (slug: string) => {
    const { data } = await axios.get(`${API}/${slug}`);
    return data; // { success, post }
  },

  // Admin endpoints (require token via your axios interceptor)
  admin: {
    create: async (payload: any) => {
      const { data } = await axios.post(API, payload);
      return data;
    },
    update: async (id: string, payload: any) => {
      const { data } = await axios.put(`${API}/${id}`, payload);
      return data;
    },
    delete: async (id: string) => {
      const { data } = await axios.delete(`${API}/${id}`);
      return data;
    },
    listAll: async (params?: { page?: number; limit?: number; q?: string; status?: string }) => {
      // reuse public list if you want; or make an admin-only endpoint later
      const { data } = await axios.get(API, { params });
      return data;
    },
  }
};
