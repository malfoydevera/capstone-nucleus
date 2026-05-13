import axios from 'axios';
import {
  clearAuthTokens,
  getAccessToken,
  getRefreshToken,
  updateAuthTokens,
} from './authStorage';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const unwrapApiData = (response) => response?.data?.data ?? response?.data ?? {};

let refreshPromise = null;

api.interceptors.request.use(
  (config) => {
    const token = getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const refreshToken = getRefreshToken();
    const requestUrl = String(originalRequest?.url || '');

    if (
      error.response?.status !== 401
      || originalRequest?._retry
      || !refreshToken
      || requestUrl.includes('/auth/login')
      || requestUrl.includes('/auth/register')
      || requestUrl.includes('/auth/refresh')
    ) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      if (!refreshPromise) {
        refreshPromise = axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken })
          .then((response) => {
            const accessToken = response.data?.token || response.data?.data?.token;
            const nextRefreshToken = response.data?.refreshToken || response.data?.data?.refreshToken || refreshToken;

            if (!accessToken) {
              throw new Error('Refresh response did not include an access token');
            }

            updateAuthTokens(accessToken, nextRefreshToken);
            return accessToken;
          })
          .finally(() => {
            refreshPromise = null;
          });
      }

      const nextAccessToken = await refreshPromise;
      originalRequest.headers = {
        ...(originalRequest.headers || {}),
        Authorization: `Bearer ${nextAccessToken}`,
      };

      return api(originalRequest);
    } catch (refreshError) {
      clearAuthTokens();
      return Promise.reject(refreshError);
    }
  }
);

export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  refreshSession: (refreshToken) => api.post('/auth/refresh', { refreshToken }),
  forgotPassword: (data) => api.post('/auth/forgot-password', data),
  resetPassword: (data) => api.post('/auth/reset-password', data),
  getCurrentUser: () => api.get('/auth/me'),
  getAllUsers: (role) => api.get('/auth/users', { params: { role } }),
  createUser: (data) => api.post('/auth/users/create', data),
  updateUser: (id, data) => api.patch(`/auth/users/${id}`, data),
  importUsersCsv: (formData) => api.post('/auth/users/import-csv', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  getSubmissionPolicy: () => api.get('/auth/submission-policy'),
  getSystemPolicy: () => api.get('/auth/system-policy'),
  updateSystemPolicy: (data) => api.patch('/auth/system-policy', data),
  getSystemHealth: () => api.get('/auth/system-health'),
  getCoAuthorInvitations: (status) => api.get('/auth/co-author-invitations', { params: { status } }),
  acceptCoAuthorInvitation: (token) => api.post(`/auth/co-author-invitations/${token}/accept`),
  declineCoAuthorInvitation: (token) => api.post(`/auth/co-author-invitations/${token}/decline`),
  deleteUser: (id) => api.delete(`/auth/users/${id}`),
  suspendUser: (id, reason) => api.patch(`/auth/users/${id}/suspend`, { reason }),
  reactivateUser: (id) => api.patch(`/auth/users/${id}/reactivate`),
  searchStudents: (query) => api.get('/auth/students/search', { params: { query } }),
};

export const notificationsAPI = {
  getMine: (params) => api.get('/auth/notifications', { params }),
  getUnreadCount: () => api.get('/auth/notifications/unread-count'),
  markRead: (id) => api.patch(`/auth/notifications/${id}/read`),
  markAllRead: () => api.patch('/auth/notifications/read-all'),
  deleteOne: (id) => api.delete(`/auth/notifications/${id}`),
};

export const researchAPI = {
  submitResearch: (formData) =>
    api.post('/research/submit', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  getMyResearch: () => api.get('/research/my/papers'),
  getAllResearch: (status) => api.get('/research/all/papers', { params: { status } }),
  getResearchById: (id) => api.get(`/research/${id}`),
  approveResearch: (id, comments, extra = {}) => api.post(`/research/${id}/approve`, { comments, ...extra }),
  rejectResearch: (id, reason, rejectionCategory) => api.post(`/research/${id}/reject`, { reason, rejectionCategory }),
  requestRevision: (id, notes) => api.post(`/research/${id}/revision`, { notes }),
  declareConflictOfInterest: (id, reason) => api.post(`/research/${id}/declare-conflict`, { reason }),
  returnToAuthor: (id, notes) => api.post(`/research/${id}/return-to-author`, { notes }),
  correctMetadata: (id, payload) => api.patch(`/research/${id}/metadata`, payload),
  getPlagiarismReport: (id) => api.get(`/research/${id}/plagiarism`),
  runPlagiarismScan: (id) => api.post(`/research/${id}/plagiarism/run`),
  deanInterveneResearch: (id, payload) => api.post(`/research/${id}/dean-intervene`, payload),
  getPublishedResearch: (params) => api.get('/research/published', { params }),
  getCategories: () => api.get('/research/categories'),
  trackView: (id) => api.post(`/research/${id}/view`),
  trackDownload: (id) => api.post(`/research/${id}/download`),
  getFacultyMembers: (params) => api.get('/research/faculty/members', {
    params: typeof params === 'string' || params == null
      ? { department: params || undefined }
      : params,
  }),
  getFacultyAssignedPapers: (status) => api.get('/research/faculty/assigned', { params: { status } }),
  getFacultyWorkloadSummary: (overdueDays) => api.get('/research/faculty/workload', { params: { overdueDays } }),
  getDeanChairMembers: (department, includeDean = false) =>
    api.get('/research/dean-chair/members', { params: { department, includeDean } }),
  getDeanChairAssignedPapers: (status) => api.get('/research/dean-chair/assigned', { params: { status } }),
  getProgramChairAnalytics: () => api.get('/research/program-chair/analytics'),
  getProgramChairDeadlines: () => api.get('/research/program-chair/deadlines'),
  setProgramChairReviewDeadline: (id, deadlineAt) => api.patch(`/research/${id}/review-deadline`, { deadlineAt }),
  assignFacultyReviewer: (id, facultyId, notes) => api.post(`/research/${id}/assign-faculty`, { facultyId, notes }),
  createCoAuthorInvitations: (id, inviteeIds) => api.post(`/research/${id}/co-author-invitations`, { inviteeIds }),
  adminGetAllResearch: (includeDeleted) => api.get('/research/admin/all', { params: { includeDeleted } }),
  adminUpdateResearch: (id, data) => api.put(`/research/admin/${id}`, data),
  adminDeleteResearch: (id) => api.delete(`/research/admin/${id}`),
  adminRestoreResearch: (id) => api.post(`/research/admin/${id}/restore`),
  adminPublishResearch: (id, data) => api.post(`/research/admin/${id}/publish`, data || {}),
  adminUnpublishResearch: (id) => api.post(`/research/admin/${id}/unpublish`),
  getWorkflowStages: () => api.get('/research/admin/workflow-stages'),
  validateWorkflowStages: () => api.get('/research/admin/workflow-stages/validate'),
  createWorkflowStage: (payload) => api.post('/research/admin/workflow-stages', payload),
  updateWorkflowStage: (stageId, payload) => api.patch(`/research/admin/workflow-stages/${stageId}`, payload),
  deleteWorkflowStage: (stageId) => api.delete(`/research/admin/workflow-stages/${stageId}`),
  getMyDraft: (paperId) => api.get('/research/drafts/me', { params: { paperId } }),
  saveMyDraft: (paperId, draftData) => api.put('/research/drafts/me', { paperId, draftData }),
  deleteMyDraft: (paperId) => api.delete('/research/drafts/me', { params: { paperId } }),

  // Kept for frontend compatibility with pages implemented in the current branch.
  getProfileData: (params) => api.get('/research/profile/data', { params }),
  getAnnotations: (id) => api.get(`/research/${id}/annotations`),
  addAnnotation: (id, data) => api.post(`/research/${id}/annotations`, data),
  deleteAnnotation: (id, annotationId) => api.delete(`/research/${id}/annotations/${annotationId}`),
  uploadAnnotatedPDF: (id, formData) => api.post(`/research/${id}/annotated-file`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  uploadAnnotationDrawing: (id, formData) => api.post(`/research/${id}/annotation-drawing`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  // Backend expects { reason, targetStatus } for dean bypass actions.
  deanBypassApprove: (id, bypassReason, target) => api.post(`/research/${id}/dean-bypass`, { reason: bypassReason, targetStatus: target }),
  getDeanActivityMonitor: (params) => api.get('/research/dean/activity-monitor', { params }),
  getAuditLogs: (params) => api.get('/research/dean/audit-logs', { params }),
  getAuditLogsPdf: (params) => api.get('/research/dean/audit-logs/pdf', { params, responseType: 'blob' }),
  getDepartmentComparison: (params) => api.get('/research/dean/department-comparison', { params }),
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
    const token = getAccessToken();
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
    const token = getAccessToken();
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

  getReviewSummary: async (paperId) => {
    const token = getAccessToken();
    const response = await fetch(`${API_BASE_URL}/ai/review-summary`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: JSON.stringify({ paperId }),
    });

    if (!response.ok) {
      const error = await response.json();
      const messageText =
        (typeof error?.error === 'string' && error.error) ||
        error?.error?.message ||
        error?.message ||
        'Failed to generate AI review summary';
      throw new Error(messageText);
    }

    return response.json();
  },
};

export default api;
