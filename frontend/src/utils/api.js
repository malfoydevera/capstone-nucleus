import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use(
  (config) => {
    const token = sessionStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Auth endpoints
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  getCurrentUser: () => api.get('/auth/me'),
  
  // UPDATED: Now accepts an optional 'role' parameter for filtering
  getAllUsers: (role) => api.get('/auth/users', { params: { role } }),
  createUser: (data) => api.post('/auth/users/create', data),
  deleteUser: (id) => api.delete(`/auth/users/${id}`),
  
  // Search students for co-author selection
  searchStudents: (query) => api.get('/auth/students/search', { params: { query } }),
};

// Research endpoints
export const researchAPI = {
  submitResearch: (formData) => api.post('/research/submit', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  getMyResearch: () => api.get('/research/my/papers'),
  getAllResearch: (status) => api.get('/research/all/papers', { params: { status } }),
  getResearchById: (id) => api.get(`/research/${id}`),
  approveResearch: (id, comments, extra = {}) => api.post(`/research/${id}/approve`, { comments, ...extra }),
  rejectResearch: (id, reason) => api.post(`/research/${id}/reject`, { reason }),
  requestRevision: (id, notes) => api.post(`/research/${id}/revision`, { notes }),
  getPublishedResearch: (params) => api.get('/research/published', { params }),
  getCategories: () => api.get('/research/categories'),
  
  // NEW: Tracking endpoints for view and download
  trackView: (id) => api.post(`/research/${id}/view`),
  trackDownload: (id) => api.post(`/research/${id}/download`),
  getAnnotations: (id) => api.get(`/research/${id}/annotations`),
  addAnnotation: (id, payload) => api.post(`/research/${id}/annotations`, payload),
  
  // NEW: Faculty endpoints
  getFacultyMembers: (department) => api.get('/research/faculty/members', { params: { department } }),
  getFacultyAssignedPapers: (status) => api.get('/research/faculty/assigned', { params: { status } }),

  // NEW: Dean & Program Chair endpoints
  getDeanChairMembers: () => api.get('/research/dean-chair/members'),
  getDeanChairAssignedPapers: (status) => api.get('/research/dean-chair/assigned', { params: { status } }),
  
  // NEW: Admin research management endpoints
  adminGetAllResearch: () => api.get('/research/admin/all'),
  adminUpdateResearch: (id, data) => api.put(`/research/admin/${id}`, data),
  adminDeleteResearch: (id) => api.delete(`/research/admin/${id}`),
  adminPublishResearch: (id) => api.post(`/research/admin/${id}/publish`),
  adminUnpublishResearch: (id) => api.post(`/research/admin/${id}/unpublish`),

  // Dean-only endpoints
  deanBypassApprove: (id, reason, targetStatus) => api.post(`/research/${id}/dean-bypass`, { reason, targetStatus }),
  getDeanActivityMonitor: (inactivityDays) => api.get('/research/dean/activity-monitor', { params: { inactivityDays } }),
  getAuditLogs: (filters) => api.get('/research/dean/audit-logs', { params: filters }),

  // Profile analytics/export source data for all roles
  getProfileData: (filters = {}) => api.get('/research/profile/data', { params: filters }),
};

export const departmentAPI = {
  getAllDepartments: () => api.get('/departments'),
  getProgramsByDepartment: (departmentId) => api.get(`/departments/${departmentId}/programs`),
};

// Analytics endpoints
export const analyticsAPI = {
  getSystemStats: () => api.get('/analytics/stats'),
  getDownloadStats: (period) => api.get('/analytics/downloads', { params: { period } }),
  getUserActivity: (period) => api.get('/analytics/activity', { params: { period } }),
  getCategoryStats: () => api.get('/analytics/categories'),
};

export const aiAPI = {
  chatWithPaper: async (paperId, message) => {
    const token = sessionStorage.getItem('token');
    const response = await fetch(`${API_BASE_URL}/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
      },
      body: JSON.stringify({
        paperId,
        message
      })
    });

    if (!response.ok) {
      const error = await response.json();
      const message =
        (typeof error?.error === 'string' && error.error) ||
        error?.error?.message ||
        error?.message ||
        'Failed to chat with paper';
      throw new Error(message);
    }

    return response.json();
  },

  extractPdfMetadata: async (file) => {
    const token = sessionStorage.getItem('token');
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE_URL}/ai/extract-pdf`, {
      method: 'POST',
      headers: {
        ...(token && { 'Authorization': `Bearer ${token}` })
      },
      body: formData
    });

    if (!response.ok) {
      const error = await response.json();
      const message =
        (typeof error?.error === 'string' && error.error) ||
        error?.error?.message ||
        error?.message ||
        'Failed to extract PDF metadata';
      throw new Error(message);
    }

    return response.json();
  }
};

export default api;