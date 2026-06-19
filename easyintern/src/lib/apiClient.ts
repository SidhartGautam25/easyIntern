import axios from 'axios';
import { supabase } from '@/integrations/supabase/client';

const rawBackendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
const VITE_BACKEND_URL = rawBackendUrl.endsWith('/api') ? rawBackendUrl : `${rawBackendUrl.replace(/\/$/, '')}/api`;

export class ApiError extends Error {
  constructor(
    public message: string,
    public status?: number,
    public errors?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const apiClient = axios.create({
  baseURL: VITE_BACKEND_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(
  async (config) => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.access_token) {
        config.headers.Authorization = `Bearer ${session.access_token}`;
      }
    } catch (err) {
      console.error('Error fetching Supabase session for API request:', err);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

apiClient.interceptors.response.use(
  (response) => {
    // If response.data itself has a success field or data envelope
    return response.data;
  },
  (error) => {
    let message = 'An unexpected error occurred.';
    let errors: any = undefined;
    const status = error.response?.status;

    if (error.response?.data) {
      const data = error.response.data;
      message = data.message || message;
      errors = data.errors || undefined;
    } else if (error.message) {
      message = error.message;
    }

    return Promise.reject(new ApiError(message, status, errors));
  }
);
