/**
 * Centralized API service for Productive
 * Uses credentials: 'include' so that HttpOnly session cookies are transmitted automatically.
 */

async function apiRequest(endpoint, options = {}) {
  const defaultHeaders = {
    'Accept': 'application/json',
  };

  if (!(options.body instanceof FormData)) {
    defaultHeaders['Content-Type'] = 'application/json';
  }

  const config = {
    ...options,
    credentials: 'include', // transmits HttpOnly cookie
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  };

  const response = await fetch(endpoint, config);

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
  register: (email, password) =>
    apiRequest('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  login: (email, password) =>
    apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  logout: () =>
    apiRequest('/api/auth/logout', {
      method: 'POST',
    }),

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
};
