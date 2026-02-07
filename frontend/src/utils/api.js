import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use(
  (config) => {
    // We switched to sessionStorage in the previous steps for multi-tab support
    const token = sessionStorage.getItem('token') || localStorage.getItem('token');
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
  approveResearch: (id, comments) => api.post(`/research/${id}/approve`, { comments }),
  rejectResearch: (id, reason) => api.post(`/research/${id}/reject`, { reason }),
  requestRevision: (id, notes) => api.post(`/research/${id}/revision`, { notes }),
  getPublishedResearch: (params) => api.get('/research/published', { params }),
  getCategories: () => api.get('/research/categories'),
  
  // NEW: Tracking endpoints for view and download
  trackView: (id) => api.post(`/research/${id}/view`),
  trackDownload: (id) => api.post(`/research/${id}/download`),
  
  // NEW: Faculty endpoints
  getFacultyMembers: (department) => api.get('/research/faculty/members', { params: { department } }),
  getFacultyAssignedPapers: (status) => api.get('/research/faculty/assigned', { params: { status } }),
  
  // NEW: Admin research management endpoints
  adminGetAllResearch: () => api.get('/research/admin/all'),
  adminUpdateResearch: (id, data) => api.put(`/research/admin/${id}`, data),
  adminDeleteResearch: (id) => api.delete(`/research/admin/${id}`),
  adminPublishResearch: (id) => api.post(`/research/admin/${id}/publish`),
  adminUnpublishResearch: (id) => api.post(`/research/admin/${id}/unpublish`),
};

// Analytics endpoints
export const analyticsAPI = {
  getSystemStats: () => api.get('/analytics/stats'),
  getDownloadStats: (period) => api.get('/analytics/downloads', { params: { period } }),
  getUserActivity: (period) => api.get('/analytics/activity', { params: { period } }),
  getCategoryStats: () => api.get('/analytics/categories'),
};

export const aiAPI = {
  chatWithPaper: async (paperId, fileUrl, message) => {
    const response = await fetch(`${API_BASE_URL}/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        paperId,
        fileUrl,
        message
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to chat with paper');
    }

    return response.json();
  },
  
  // Extract title and abstract from PDF
  extractPdfMetadata: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await fetch(`${API_BASE_URL}/ai/extract-pdf`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to extract PDF metadata');
    }

    return response.json();
  }
};

export default api;