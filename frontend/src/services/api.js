/**
 * Centralized API service for Productive
 * Supports both independent Vercel deployments (via VITE_API_URL + Bearer Token)
 * and local unified development (via HttpOnly session cookies).
 */

export const API_BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

const TOKEN_STORAGE_KEY = 'productive_auth_token';

export function getStoredToken() {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch (e) {
    return null;
  }
}

export function setStoredToken(token) {
  try {
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch (e) {}
}

export function getMediaUrl(filePath) {
  if (!filePath) return '';
  if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
    return filePath;
  }
  return `${API_BASE_URL}${filePath.startsWith('/') ? '' : '/'}${filePath}`;
}

async function apiRequest(endpoint, options = {}) {
  const defaultHeaders = {
    'Accept': 'application/json',
  };

  if (!(options.body instanceof FormData)) {
    defaultHeaders['Content-Type'] = 'application/json';
  }

  const token = getStoredToken();
  if (token) {
    defaultHeaders['Authorization'] = `Bearer ${token}`;
  }

  const config = {
    ...options,
    credentials: 'include', // transmits HttpOnly cookies when supported
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  };

  const targetUrl = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
  const response = await fetch(targetUrl, config);

  if (response.status === 204) {
    return null;
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data.detail || (data.message) || `Request failed with status ${response.status}`;
    throw new Error(errorMsg);
  }

  return data;
}

export const api = {
  // Authentication
  register: async (email, password) => {
    const data = await apiRequest('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (data && data.access_token) {
      setStoredToken(data.access_token);
    }
    return data;
  },

  login: async (email, password) => {
    const data = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (data && data.access_token) {
      setStoredToken(data.access_token);
    }
    return data;
  },

  logout: async () => {
    try {
      await apiRequest('/api/auth/logout', {
        method: 'POST',
      });
    } finally {
      setStoredToken(null);
    }
  },

  getMe: () => apiRequest('/api/auth/me'),

  // Tasks
  getTasks: (statusFilter) => {
    const query = statusFilter ? `?status_filter=${statusFilter}` : '';
    return apiRequest(`/api/tasks/${query}`);
  },

  createTask: (title, planned_start_time, planned_end_time) =>
    apiRequest('/api/tasks/', {
      method: 'POST',
      body: JSON.stringify({ title, planned_start_time, planned_end_time }),
    }),

  updateTask: (id, updates) =>
    apiRequest(`/api/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    }),

  startTask: (id) =>
    apiRequest(`/api/tasks/${id}/start`, {
      method: 'POST',
    }),

  completeTask: (id) =>
    apiRequest(`/api/tasks/${id}/complete`, {
      method: 'POST',
    }),

  deleteTask: (id) =>
    apiRequest(`/api/tasks/${id}`, {
      method: 'DELETE',
    }),

  // Journal
  getJournal: (entryDate) => {
    const query = entryDate ? `?entry_date=${entryDate}` : '';
    return apiRequest(`/api/journal/${query}`);
  },

  saveJournal: (entry_date, content, mood) =>
    apiRequest('/api/journal/', {
      method: 'POST',
      body: JSON.stringify({ entry_date, content, mood }),
    }),

  getJournalDates: () => apiRequest('/api/journal/dates'),

  // Memories
  getMemories: (entryDate) => {
    const query = entryDate ? `?entry_date=${entryDate}` : '';
    return apiRequest(`/api/memories/${query}`);
  },

  uploadMemory: (file, entry_date, caption) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('entry_date', entry_date);
    if (caption) formData.append('caption', caption);

    return apiRequest('/api/memories/upload', {
      method: 'POST',
      body: formData,
    });
  },

  deleteMemory: (id) =>
    apiRequest(`/api/memories/${id}`, {
      method: 'DELETE',
    }),

  // Settings
  getSettings: () => apiRequest('/api/settings/'),

  updateSettings: (settingsData) =>
    apiRequest('/api/settings/', {
      method: 'PUT',
      body: JSON.stringify(settingsData),
    }),

  // Notifications
  getNotifications: () => apiRequest('/api/notifications/'),

  markNotificationRead: (id) =>
    apiRequest(`/api/notifications/${id}/read`, {
      method: 'POST',
    }),

  markAllNotificationsRead: () =>
    apiRequest('/api/notifications/read-all', {
      method: 'POST',
    }),

  triggerTestAlert: (alertType) =>
    apiRequest(`/api/notifications/test-alert?alert_type=${alertType}`, {
      method: 'POST',
    }),

  // Analytics
  getAnalytics: (period = 'weekly') =>
    apiRequest(`/api/analytics/?period=${period}`),

  // Artificial Intelligence (Stage 2 & 3)
  parseTasksWithAI: (query, timezone_str) =>
    apiRequest('/api/ai/parse-tasks', {
      method: 'POST',
      body: JSON.stringify({ query, timezone_str }),
    }),

  confirmTasksWithAI: (tasks) =>
    apiRequest('/api/ai/confirm-tasks', {
      method: 'POST',
      body: JSON.stringify({ tasks }),
    }),

  getJournalInsights: (entryDate) =>
    apiRequest(`/api/ai/journal-insights?entry_date=${entryDate}`),

  getAICoachReview: () =>
    apiRequest('/api/ai/coach-review'),

  askJournal: (query) =>
    apiRequest('/api/ai/ask-journal', {
      method: 'POST',
      body: JSON.stringify({ query }),
    }),
};
