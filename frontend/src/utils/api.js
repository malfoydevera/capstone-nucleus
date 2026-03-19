import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = sessionStorage.getItem('token') || localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  getCurrentUser: () => api.get('/auth/me'),
  getAllUsers: (role) => api.get('/auth/users', { params: { role } }),
  createUser: (data) => api.post('/auth/users/create', data),
  deleteUser: (id) => api.delete(`/auth/users/${id}`),
  searchStudents: (query) => api.get('/auth/students/search', { params: { query } }),
  // S-005: token rotation
  refresh: (refreshToken) => api.post('/auth/refresh', { refreshToken }),
  logout: (refreshToken) => api.post('/auth/logout', { refreshToken }),
};

export const researchAPI = {
  submitResearch: (formData) =>
    api.post('/research/submit', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  getMyResearch: () => api.get('/research/my/papers'),
  getAllResearch: (status) => api.get('/research/all/papers', { params: { status } }),
  getResearchById: (id) => api.get(`/research/${id}`),
  approveResearch: (id, comments, extra = {}) => api.post(`/research/${id}/approve`, { comments, ...extra }),
  rejectResearch: (id, reason) => api.post(`/research/${id}/reject`, { reason }),
  requestRevision: (id, notes) => api.post(`/research/${id}/revision`, { notes }),
  deanInterveneResearch: (id, payload) => api.post(`/research/${id}/dean-intervene`, payload),
  getPublishedResearch: (params) => api.get('/research/published', { params }),
  getCategories: () => api.get('/research/categories'),
  trackView: (id) => api.post(`/research/${id}/view`),
  trackDownload: (id) => api.post(`/research/${id}/download`),
  getFacultyMembers: (department) => api.get('/research/faculty/members', { params: { department } }),
  getFacultyAssignedPapers: (status) => api.get('/research/faculty/assigned', { params: { status } }),
  getDeanChairMembers: (department, includeDean = false) =>
    api.get('/research/dean-chair/members', { params: { department, includeDean } }),
  getDeanChairAssignedPapers: (status) => api.get('/research/dean-chair/assigned', { params: { status } }),
  adminGetAllResearch: () => api.get('/research/admin/all'),
  adminUpdateResearch: (id, data) => api.put(`/research/admin/${id}`, data),
  adminDeleteResearch: (id) => api.delete(`/research/admin/${id}`),
  adminPublishResearch: (id) => api.post(`/research/admin/${id}/publish`),
  adminUnpublishResearch: (id) => api.post(`/research/admin/${id}/unpublish`),

  // Kept for frontend compatibility with pages implemented in the current branch.
  getProfileData: (params) => api.get('/research/profile/data', { params }),
  getAnnotations: (id) => api.get(`/research/${id}/annotations`),
  addAnnotation: (id, data) => api.post(`/research/${id}/annotations`, data),
  deleteAnnotation: (paperId, annotationId) => api.delete(`/research/${paperId}/annotations/${annotationId}`),
  getDeanActivityMonitor: (params) => api.get('/research/dean/activity-monitor', { params }),
  getAuditLogs: (params) => api.get('/research/dean/audit-logs', { params }),
};

export const analyticsAPI = {
  getSystemStats: () => api.get('/analytics/stats'),
  getDownloadStats: (period) => api.get('/analytics/downloads', { params: { period } }),
  getUserActivity: (period) => api.get('/analytics/activity', { params: { period } }),
  getCategoryStats: () => api.get('/analytics/categories'),
};

export const departmentsAPI = {
  getAll: () => api.get('/departments'),
  getPrograms: (deptId) => api.get(`/departments/${deptId}/programs`),
  createDepartment: (data) => api.post('/departments', data),
  updateDepartment: (id, data) => api.put(`/departments/${id}`, data),
  deleteDepartment: (id) => api.delete(`/departments/${id}`),
  createProgram: (deptId, data) => api.post(`/departments/${deptId}/programs`, data),
  updateProgram: (id, data) => api.put(`/departments/programs/${id}`, data),
  deleteProgram: (id) => api.delete(`/departments/programs/${id}`),
};

// Backward-compatible alias for pages that still import departmentAPI.
export const departmentAPI = {
  getAllDepartments: () => departmentsAPI.getAll(),
  getProgramsByDepartment: (deptId) => departmentsAPI.getPrograms(deptId),
  createDepartment: (data) => departmentsAPI.createDepartment(data),
  updateDepartment: (id, data) => departmentsAPI.updateDepartment(id, data),
  deleteDepartment: (id) => departmentsAPI.deleteDepartment(id),
  createProgram: (deptId, data) => departmentsAPI.createProgram(deptId, data),
  updateProgram: (id, data) => departmentsAPI.updateProgram(id, data),
  deleteProgram: (id) => departmentsAPI.deleteProgram(id),
};

export const aiAPI = {
  chatWithPaper: async (paperId, message) => {
    const token = sessionStorage.getItem('token') || localStorage.getItem('token');
    const response = await fetch(`${API_BASE_URL}/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: JSON.stringify({ paperId, message }),
    });

    if (!response.ok) {
      const error = await response.json();
      const messageText =
        (typeof error?.error === 'string' && error.error) ||
        error?.error?.message ||
        error?.message ||
        'Failed to chat with paper';
      throw new Error(messageText);
    }

    return response.json();
  },

  extractPdfMetadata: async (file) => {
    const token = sessionStorage.getItem('token') || localStorage.getItem('token');
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE_URL}/ai/extract-pdf`, {
      method: 'POST',
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      const messageText =
        (typeof error?.error === 'string' && error.error) ||
        error?.error?.message ||
        error?.message ||
        'Failed to extract PDF metadata';
      throw new Error(messageText);
    }

    return response.json();
  },
};

// ─── S-005: 401 response interceptor — silent token refresh ──────────────────
let _isRefreshing = false;
let _refreshQueue = []; // callbacks waiting for a new token

function processQueue(error, token = null) {
  _refreshQueue.forEach(({ resolve, reject }) => (error ? reject(error) : resolve(token)));
  _refreshQueue = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Only intercept 401s that haven't already been retried
    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    // Don't intercept the refresh call itself (avoid infinite loop)
    if (originalRequest.url?.includes('/auth/refresh')) {
      return Promise.reject(error);
    }

    const storedRefresh = sessionStorage.getItem('refreshToken');
    if (!storedRefresh) return Promise.reject(error);

    if (_isRefreshing) {
      // Queue concurrent requests while a refresh is in-flight
      return new Promise((resolve, reject) => {
        _refreshQueue.push({ resolve, reject });
      }).then((token) => {
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return api(originalRequest);
      });
    }

    originalRequest._retry = true;
    _isRefreshing = true;

    try {
      const { data } = await api.post('/auth/refresh', { refreshToken: storedRefresh });
      const { token: newToken, refreshToken: newRefresh } = data.data;

      sessionStorage.setItem('token', newToken);
      if (newRefresh) sessionStorage.setItem('refreshToken', newRefresh);

      api.defaults.headers.common.Authorization = `Bearer ${newToken}`;
      originalRequest.headers.Authorization = `Bearer ${newToken}`;
      processQueue(null, newToken);

      return api(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);
      // Refresh also failed — clear session and force re-login
      sessionStorage.clear();
      localStorage.removeItem('token');
      window.location.href = '/login';
      return Promise.reject(refreshError);
    } finally {
      _isRefreshing = false;
    }
  }
);

export default api;
