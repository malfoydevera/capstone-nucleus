import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { 
  Users, 
  Search, 
  Trash2, 
  Edit, 
  AlertCircle, 
  Filter,
  UserPlus,
  Shield,
  Mail,
  Calendar,
  ChevronRight,
  CheckCircle,
  XCircle,
  Eye,
  MoreVertical,
  RefreshCw,
  Download,
  Upload
} from 'lucide-react';
import { authAPI, departmentsAPI, unwrapApiData } from '../../utils/api';
import { formatFullName, getInitials } from '../../utils/names';
import GuidancePanel from '../../components/ui/GuidancePanel';

const emptyCreateForm = {
  email: '',
  password: '',
  firstName: '',
  middleName: '',
  lastName: '',
  role: 'faculty',
  department: '',
  departmentId: '',
  program: '',
  programId: '',
};

const emptyEditForm = {
  firstName: '',
  middleName: '',
  lastName: '',
  role: '',
  department: '',
  departmentId: '',
  program: '',
  programId: '',
};

const ROLE_SEARCH_TOKENS = {
  admin: 'admin administrator system admin',
  faculty: 'faculty adviser adviser reviewer',
  dean: 'dean dean reviewer',
  program_chair: 'program chair program_chair chair reviewer',
  staff: 'staff research editor editor',
  student: 'student researcher',
};

const UserManagement = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [selectedRole, setSelectedRole] = useState('all');
  const [showOnlyOrganizationGaps, setShowOnlyOrganizationGaps] = useState(false);
  const [showOnlyNameReviewGaps, setShowOnlyNameReviewGaps] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: 'createdAt', direction: 'desc' });
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [userToEdit, setUserToEdit] = useState(null);
  const [editForm, setEditForm] = useState(emptyEditForm);
  const [departments, setDepartments] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [editPrograms, setEditPrograms] = useState([]);

  useEffect(() => {
    fetchUsers();
    fetchDepartments();
  }, []);

  useEffect(() => {
    const focusEmail = searchParams.get('email') || '';
    const focusOrgGaps = searchParams.get('orgGaps') === '1';
    const focusNameReview = searchParams.get('nameReview') === '1';
    const focusRole = searchParams.get('role') || 'all';
    const validRole = ['all', 'admin', 'faculty', 'dean', 'program_chair', 'staff', 'student'].includes(focusRole)
      ? focusRole
      : 'all';

    setSearchTerm(focusEmail);
    setShowOnlyOrganizationGaps(focusOrgGaps);
    setShowOnlyNameReviewGaps(focusNameReview);
    setSelectedRole(validRole);
  }, [searchParams]);

  useEffect(() => {
    const focusEmail = searchParams.get('email') || '';
    const openEdit = searchParams.get('edit') === '1';

    if (!openEdit || !focusEmail || showEditModal) {
      return;
    }

    const matchedUser = users.find((user) => String(user.email || '').toLowerCase() === focusEmail.toLowerCase());
    if (matchedUser) {
      openEditModal(matchedUser);
    }
  }, [searchParams, users, showEditModal]);

  useEffect(() => {
    const loadPrograms = async () => {
      if (!createForm.departmentId) {
        setPrograms([]);
        return;
      }

      try {
        const response = await departmentsAPI.getPrograms(createForm.departmentId);
        setPrograms(unwrapApiData(response).programs || []);
      } catch (err) {
        console.error('Failed to fetch programs:', err);
        setPrograms([]);
      }
    };

    loadPrograms();
  }, [createForm.departmentId]);

  useEffect(() => {
    const loadPrograms = async () => {
      if (!['student', 'program_chair'].includes(editForm.role) || !editForm.departmentId) {
        setEditPrograms([]);
        return;
      }

      try {
        const response = await departmentsAPI.getPrograms(editForm.departmentId);
        setEditPrograms(unwrapApiData(response).programs || []);
      } catch (err) {
        console.error('Failed to fetch edit programs:', err);
        setEditPrograms([]);
      }
    };

    loadPrograms();
  }, [editForm.departmentId, editForm.role]);

  useEffect(() => {
    filterAndSortUsers();
  }, [users, searchTerm, selectedRole, showOnlyOrganizationGaps, showOnlyNameReviewGaps, sortConfig]);

  const fetchUsers = async () => {
    try {
      const response = await authAPI.getAllUsers();
      setUsers(unwrapApiData(response).users || []);
      setError('');
    } catch (err) {
      console.error('Failed to fetch users:', err);
      setError('Failed to load users. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await departmentsAPI.getAll();
      setDepartments(unwrapApiData(response).departments || []);
    } catch (err) {
      console.error('Failed to fetch departments:', err);
      setDepartments([]);
    }
  };

  const filterAndSortUsers = useCallback(() => {
    let filtered = [...users];

    // Filter by search term
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      filtered = filtered.filter(user => 
        formatFullName(user).toLowerCase().includes(lowerSearch) ||
        user.email?.toLowerCase().includes(lowerSearch) ||
        user.role?.toLowerCase().includes(lowerSearch) ||
        (ROLE_SEARCH_TOKENS[user.role] || '').includes(lowerSearch) ||
        String(user.department || '').toLowerCase().includes(lowerSearch) ||
        String(user.program || '').toLowerCase().includes(lowerSearch)
      );
    }

    // Filter by role
    if (selectedRole !== 'all') {
      filtered = filtered.filter(user => user.role === selectedRole);
    }

    if (showOnlyOrganizationGaps) {
      filtered = filtered.filter((user) => hasOrganizationGap(user));
    }

    if (showOnlyNameReviewGaps) {
      filtered = filtered.filter((user) => hasNameReviewGap(user));
    }

    // Sort
    filtered.sort((a, b) => {
      let aValue = a[sortConfig.key];
      let bValue = b[sortConfig.key];

      if (sortConfig.key === 'name') {
        aValue = formatFullName(a).toLowerCase();
        bValue = formatFullName(b).toLowerCase();
      }

      if (sortConfig.key === 'createdAt') {
        aValue = new Date(a.createdAt || a.created_at);
        bValue = new Date(b.createdAt || b.created_at);
      }

      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    setFilteredUsers(filtered);
  }, [users, searchTerm, selectedRole, showOnlyOrganizationGaps, showOnlyNameReviewGaps, sortConfig]);

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const clearFocusedFilters = () => {
    setSearchParams({});
    setSearchTerm('');
    setSelectedRole('all');
    setShowOnlyOrganizationGaps(false);
    setShowOnlyNameReviewGaps(false);
  };

  const handleDeleteClick = (user) => {
    setUserToDelete(user);
    setShowDeleteModal(true);
  };

  const handleCreateRoleChange = (role) => {
    setCreateForm((prev) => ({
      ...prev,
      role,
      program: role === 'program_chair' ? prev.program : '',
      programId: role === 'program_chair' ? prev.programId : '',
    }));
  };

  const handleCreateDepartmentChange = (departmentId) => {
    const selectedDepartment = departments.find((item) => item.id === departmentId);
    setCreateForm((prev) => ({
      ...prev,
      departmentId,
      department: selectedDepartment?.name || '',
      program: '',
      programId: '',
    }));
  };

  const handleCreateProgramChange = (programId) => {
    const selectedProgram = programs.find((item) => item.id === programId);
    setCreateForm((prev) => ({
      ...prev,
      programId,
      program: selectedProgram?.name || '',
    }));
  };

  const closeCreateModal = () => {
    setCreateForm(emptyCreateForm);
    setPrograms([]);
    setShowCreateModal(false);
  };

  const requiresProgramAssignment = (role) => ['student', 'program_chair'].includes(role);
  const requiresDepartmentAssignment = (role) => ['student', 'faculty', 'dean', 'program_chair', 'staff'].includes(role);

  const hasOrganizationGap = (user) => {
    const departmentId = user.departmentId || user.department_id;
    const programId = user.programId || user.program_id;
    return (requiresDepartmentAssignment(user.role) && !departmentId)
      || (requiresProgramAssignment(user.role) && !programId);
  };

  const hasNameReviewGap = (user) => {
    const firstName = String(user.first_name || user.firstName || '').trim();
    const lastName = String(user.last_name || user.lastName || '').trim();
    return !firstName || !lastName;
  };

  const handleEditDepartmentChange = (departmentId) => {
    const selectedDepartment = departments.find((item) => item.id === departmentId);
    setEditForm((prev) => ({
      ...prev,
      departmentId,
      department: selectedDepartment?.name || '',
      program: '',
      programId: '',
    }));
  };

  const handleEditProgramChange = (programId) => {
    const selectedProgram = editPrograms.find((item) => item.id === programId);
    setEditForm((prev) => ({
      ...prev,
      programId,
      program: selectedProgram?.name || '',
    }));
  };

  const openEditModal = (user) => {
    setUserToEdit(user);
    setEditForm({
      firstName: user.first_name || '',
      middleName: user.middle_name || '',
      lastName: user.last_name || '',
      role: user.role || '',
      department: user.department || '',
      departmentId: user.departmentId || user.department_id || '',
      program: user.program || '',
      programId: user.programId || user.program_id || '',
    });
    setShowEditModal(true);
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setUserToEdit(null);
    setEditForm(emptyEditForm);
    setEditPrograms([]);

    if (searchParams.get('edit') === '1') {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('edit');
      setSearchParams(nextParams);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setCreateLoading(true);
    const loadingToast = toast.loading('Creating account...');
    try {
      const response = await authAPI.createUser(createForm);
      const createdUser = unwrapApiData(response).user;
      setUsers(prev => [createdUser, ...prev]);
      toast.success(`${createdUser.role.replace('_', ' ')} account created!`, {
        id: loadingToast, duration: 3000
      });
      closeCreateModal();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create user', { id: loadingToast });
    } finally {
      setCreateLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!userToDelete) return;

    setActionLoading(true);
    const loadingToast = toast.loading('Deleting user...');
    try {
      await authAPI.deleteUser(userToDelete.id);
      // Remove user from local state immediately
      setUsers(users.filter(u => u.id !== userToDelete.id));
      toast.success(`User ${formatFullName(userToDelete)} deleted successfully`, {
        id: loadingToast,
        duration: 3000,
      });
      setShowDeleteModal(false);
      setUserToDelete(null);
    } catch (err) {
      console.error('Failed to delete user:', err);
      toast.error(err.response?.data?.error || 'Failed to delete user', {
        id: loadingToast,
        duration: 4000,
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    if (!userToEdit) return;

    setEditLoading(true);
    const loadingToast = toast.loading('Updating user...');
    try {
      const response = await authAPI.updateUser(userToEdit.id, editForm);
      const updatedUser = unwrapApiData(response).user;
      setUsers((prev) => prev.map((user) => (
        user.id === userToEdit.id ? updatedUser : user
      )));
      toast.success('User updated successfully', { id: loadingToast });
      closeEditModal();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update user', { id: loadingToast });
    } finally {
      setEditLoading(false);
    }
  };

  const downloadCsvTemplate = () => {
    const template = [
      'email,password,role,firstName,middleName,lastName,department,program',
      'faculty1@university.edu,TempPass123,faculty,Juan,,Dela Cruz,College of Engineering,',
      'student1@university.edu,TempPass123,student,Ana,,Santos,College of Engineering,BS Computer Engineering',
      'chair1@university.edu,TempPass123,program_chair,Maria,,Reyes,College of Engineering,BS Computer Engineering',
    ].join('\n');

    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'user_import_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const handleImportCsv = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast.error('Please select a CSV file');
      event.target.value = '';
      return;
    }

    setImportLoading(true);
    const loadingToast = toast.loading('Importing users from CSV...');

    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await authAPI.importUsersCsv(formData);
      const result = unwrapApiData(response);

      toast.success(
        `Import complete: ${result.created} created, ${result.skipped} skipped, ${result.failed} failed`,
        { id: loadingToast, duration: 4500 }
      );

      await fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to import CSV', { id: loadingToast });
    } finally {
      setImportLoading(false);
      event.target.value = '';
    }
  };

  const handleToggleSuspension = async (targetUser) => {
    setActionLoading(true);
    try {
      if (targetUser.is_active === false || targetUser.suspended_at) {
        await authAPI.reactivateUser(targetUser.id);
        setUsers((prev) => prev.map((user) => (
          user.id === targetUser.id
            ? { ...user, is_active: true, suspended_at: null, suspended_reason: null }
            : user
        )));
        toast.success(`${formatFullName(targetUser)} reactivated`);
      } else {
        const reason = window.prompt('Suspension reason (optional):', 'Policy violation') || '';
        await authAPI.suspendUser(targetUser.id, reason);
        setUsers((prev) => prev.map((user) => (
          user.id === targetUser.id
            ? { ...user, is_active: false, suspended_at: new Date().toISOString(), suspended_reason: reason || null }
            : user
        )));
        toast.success(`${formatFullName(targetUser)} suspended`);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update suspension state');
    } finally {
      setActionLoading(false);
    }
  };

  const getRoleConfig = (role) => {
    const configs = {
      admin: {
        color: 'from-red-500 to-pink-500',
        bgColor: 'bg-gradient-to-r from-red-100 to-pink-100',
        textColor: 'text-red-700',
        icon: Shield,
        label: 'Administrator'
      },
      faculty: {
        color: 'from-amber-500 to-yellow-500',
        bgColor: 'bg-gradient-to-r from-amber-100 to-yellow-100',
        textColor: 'text-amber-700',
        icon: Users,
        label: 'Adviser'
      },
      dean: {
        color: 'from-violet-500 to-purple-500',
        bgColor: 'bg-gradient-to-r from-violet-100 to-purple-100',
        textColor: 'text-violet-700',
        icon: Shield,
        label: 'Dean'
      },
      program_chair: {
        color: 'from-teal-500 to-cyan-500',
        bgColor: 'bg-gradient-to-r from-teal-100 to-cyan-100',
        textColor: 'text-teal-700',
        icon: Users,
        label: 'Program Chair'
      },
      staff: {
        color: 'from-[#1C4D8D] to-[#2563eb]',
        bgColor: 'bg-gradient-to-r from-[#1C4D8D]/10 to-[#2563eb]/10',
        textColor: 'text-[#1C4D8D]',
        icon: Eye,
        label: 'Research Editor'
      },
      student: {
        color: 'from-blue-500 to-cyan-500',
        bgColor: 'bg-gradient-to-r from-blue-100 to-cyan-100',
        textColor: 'text-blue-700',
        icon: Users,
        label: 'Student'
      },
      user: {
        color: 'from-slate-500 to-gray-500',
        bgColor: 'bg-gradient-to-r from-slate-100 to-gray-100',
        textColor: 'text-slate-700',
        icon: Users,
        label: 'User'
      }
    };
    return configs[role] || configs.user;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="relative">
          <div className="w-20 h-20 border-4 border-[#1C4D8D]/20 rounded-full"></div>
          <div className="absolute top-0 left-0 w-20 h-20 border-4 border-[#1C4D8D] border-t-transparent rounded-full animate-spin"></div>
        </div>
        <p className="mt-6 text-lg font-medium text-slate-600 animate-pulse">Loading users...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#1C4D8D] to-[#2563eb] flex items-center justify-center shadow-lg">
                <Users size={28} className="text-white" />
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-black text-slate-900 mb-2">
                  User <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#1C4D8D] to-[#2563eb]">Management</span>
                </h1>
                <p className="text-slate-600 font-medium">
                  Manage system users, roles, and permissions
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={fetchUsers}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-slate-100 to-white border border-slate-300 text-slate-700 hover:border-[#1C4D8D]/30 transition-colors"
            >
              <RefreshCw size={16} />
              Refresh
            </button>
            <button
              onClick={downloadCsvTemplate}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-slate-100 to-white border border-slate-300 text-slate-700 hover:border-[#1C4D8D]/30 transition-colors"
            >
              <Download size={16} />
              CSV Template
            </button>
            <label className={`flex items-center gap-2 px-4 py-2 rounded-xl border font-semibold transition-colors ${importLoading ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed' : 'bg-gradient-to-r from-emerald-50 to-green-50 border-emerald-200 text-emerald-700 cursor-pointer hover:border-emerald-300'}`}>
              <Upload size={16} />
              {importLoading ? 'Importing...' : 'Import CSV'}
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleImportCsv}
                className="hidden"
                disabled={importLoading}
              />
            </label>
            <button
              onClick={() => {
                setCreateForm(emptyCreateForm);
                setPrograms([]);
                setShowCreateModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#1C4D8D] to-[#2563eb] text-white rounded-xl font-bold hover:from-[#1a4480] hover:to-[#1d55d0] transition-all duration-300 shadow-md"
            >
              <UserPlus size={16} />
              Add User
            </button>
          </div>
        </div>

        <div className="mb-6">
          <GuidancePanel
            title="User Management Guidance"
            description="Use this page to fix account scope, resolve name-quality gaps, and keep every role mapped to the right department or program."
            items={[
              'Start with Org Gaps and Name Review filters so the highest-risk data issues are corrected first.',
              'Open Edit before suspending or deleting an account when the issue is incomplete profile data rather than misuse.',
              'Use the shared User Guide when roles need workflow expectations in addition to account changes.',
            ]}
            tone="violet"
          />
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-6 mb-8">
        <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#1C4D8D] to-[#2563eb] flex items-center justify-center shadow-lg">
              <Users size={22} className="text-white" />
            </div>
            <span className="text-3xl font-black text-slate-900">{users.length}</span>
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-1">Total Users</h3>
          <p className="text-slate-600 text-sm">All registered users</p>
        </div>

        <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-pink-500 flex items-center justify-center shadow-lg">
              <Shield size={22} className="text-white" />
            </div>
            <span className="text-3xl font-black text-slate-900">
              {users.filter(u => u.role === 'admin').length}
            </span>
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-1">Administrators</h3>
          <p className="text-slate-600 text-sm">System administrators</p>
        </div>

        <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#1C4D8D] to-[#2563eb] flex items-center justify-center shadow-lg">
              <Eye size={22} className="text-white" />
            </div>
            <span className="text-3xl font-black text-slate-900">
              {users.filter(u => u.role === 'staff').length}
            </span>
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-1">Staff Members</h3>
          <p className="text-slate-600 text-sm">Faculty and staff</p>
        </div>

        <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg">
              <Users size={22} className="text-white" />
            </div>
            <span className="text-3xl font-black text-slate-900">
              {users.filter(u => u.role === 'student').length}
            </span>
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-1">Students</h3>
          <p className="text-slate-600 text-sm">Student researchers</p>
        </div>

        <div className="bg-gradient-to-br from-white to-amber-50 rounded-2xl shadow-lg border border-amber-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg">
              <AlertCircle size={22} className="text-white" />
            </div>
            <span className="text-3xl font-black text-slate-900">
              {users.filter((user) => hasOrganizationGap(user)).length}
            </span>
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-1">Org Gaps</h3>
          <p className="text-slate-600 text-sm">Users needing department or program assignment</p>
        </div>

        <div className="bg-gradient-to-br from-white to-violet-50 rounded-2xl shadow-lg border border-violet-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center shadow-lg">
              <Edit size={22} className="text-white" />
            </div>
            <span className="text-3xl font-black text-slate-900">
              {users.filter((user) => hasNameReviewGap(user)).length}
            </span>
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-1">Name Review</h3>
          <p className="text-slate-600 text-sm">Users still missing first or last name</p>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-6">
          <div className="p-4 rounded-2xl bg-gradient-to-r from-red-50 to-pink-50 border border-red-200">
            <div className="flex items-center gap-3">
              <AlertCircle size={20} className="text-red-600 flex-shrink-0" />
              <div>
                <p className="font-medium text-red-900">{error}</p>
                <button
                  onClick={fetchUsers}
                  className="mt-2 text-sm font-medium text-red-700 hover:text-red-900 transition-colors"
                >
                  Try again
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters and Search */}
      <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg border border-slate-200 mb-6 p-6">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
              <input
                type="text"
                placeholder="Search users by name, email, or role..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-white border-2 border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1C4D8D] focus:border-transparent transition-all duration-300 font-medium"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter size={18} className="text-slate-600" />
              <span className="text-sm font-medium text-slate-700">Filter:</span>
            </div>
            <button
              onClick={() => setShowOnlyOrganizationGaps((prev) => !prev)}
              className={`px-4 py-2 rounded-xl font-medium text-sm transition-all duration-300 ${
                showOnlyOrganizationGaps
                  ? 'bg-amber-100 border border-amber-200 text-amber-700 font-bold'
                  : 'bg-gradient-to-r from-slate-100 to-white border border-slate-300 text-slate-700 hover:border-[#1C4D8D]/30'
              }`}
            >
              Needs Org Setup
            </button>
            <button
              onClick={() => setShowOnlyNameReviewGaps((prev) => !prev)}
              className={`px-4 py-2 rounded-xl font-medium text-sm transition-all duration-300 ${
                showOnlyNameReviewGaps
                  ? 'bg-violet-100 border border-violet-200 text-violet-700 font-bold'
                  : 'bg-gradient-to-r from-slate-100 to-white border border-slate-300 text-slate-700 hover:border-[#1C4D8D]/30'
              }`}
            >
              Needs Name Review
            </button>
            <div className="flex gap-2">
              {['all', 'admin', 'faculty', 'dean', 'program_chair', 'staff', 'student'].map((role) => {
                const config = getRoleConfig(role);
                const Icon = config.icon;
                return (
                  <button
                    key={role}
                    onClick={() => setSelectedRole(role)}
                    className={`px-4 py-2 rounded-xl font-medium text-sm transition-all duration-300 ${
                      selectedRole === role
                        ? `${config.bgColor} border ${config.textColor.replace('text', 'border')} font-bold`
                        : 'bg-gradient-to-r from-slate-100 to-white border border-slate-300 text-slate-700 hover:border-[#1C4D8D]/30'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Icon size={14} />
                      {role === 'all' ? 'All Users' : config.label}
                    </div>
                  </button>
                );
              })}
            </div>
            {(searchParams.get('email') || searchParams.get('orgGaps') === '1' || searchParams.get('nameReview') === '1' || (searchParams.get('role') && searchParams.get('role') !== 'all')) && (
              <button
                onClick={clearFocusedFilters}
                className="px-4 py-2 rounded-xl font-medium text-sm bg-white border border-slate-300 text-slate-700 hover:border-[#1C4D8D]/30 transition-all duration-300"
              >
                Clear Focus
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-white border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#1C4D8D]/10 to-[#2563eb]/10 flex items-center justify-center">
                <Users size={20} className="text-[#1C4D8D]" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">User List</h3>
                <p className="text-slate-600 text-sm">
                  {filteredUsers.length} {filteredUsers.length === 1 ? 'user' : 'users'} found
                </p>
              </div>
            </div>
            {/* <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-slate-100 to-white border border-slate-300 text-slate-700 hover:border-indigo-300 transition-colors">
              <Download size={16} />
              Export
            </button> */}
          </div>
        </div>

        {filteredUsers.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-slate-100 to-white flex items-center justify-center mx-auto mb-6">
              <Users size={40} className="text-slate-400" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">No users found</h3>
            <p className="text-slate-600 mb-8">
              {searchTerm || selectedRole !== 'all' || showOnlyOrganizationGaps || showOnlyNameReviewGaps
                ? 'Try adjusting your search or filters' 
                : 'No users registered in the system'}
            </p>
            {(searchTerm || selectedRole !== 'all' || showOnlyOrganizationGaps || showOnlyNameReviewGaps) && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setSelectedRole('all');
                  setShowOnlyOrganizationGaps(false);
                  setShowOnlyNameReviewGaps(false);
                }}
                className="px-6 py-3 bg-gradient-to-r from-slate-100 to-white border border-slate-300 text-slate-700 rounded-xl font-medium hover:border-[#1C4D8D]/30 transition-colors"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left">
                    <button
                      onClick={() => handleSort('name')}
                      className="flex items-center gap-2 text-sm font-semibold text-slate-900 hover:text-[#1C4D8D] transition-colors"
                    >
                      User
                      <ChevronRight size={14} className={`transition-transform ${
                        sortConfig.key === 'name' && sortConfig.direction === 'asc' ? 'rotate-90' : 
                        sortConfig.key === 'name' && sortConfig.direction === 'desc' ? '-rotate-90' : ''
                      }`} />
                    </button>
                  </th>
                  <th className="px-6 py-4 text-left">
                    <button
                      onClick={() => handleSort('role')}
                      className="flex items-center gap-2 text-sm font-semibold text-slate-900 hover:text-[#1C4D8D] transition-colors"
                    >
                      Role
                      <ChevronRight size={14} className={`transition-transform ${
                        sortConfig.key === 'role' && sortConfig.direction === 'asc' ? 'rotate-90' : 
                        sortConfig.key === 'role' && sortConfig.direction === 'desc' ? '-rotate-90' : ''
                      }`} />
                    </button>
                  </th>
                  <th className="px-6 py-4 text-left">
                    <button
                      onClick={() => handleSort('createdAt')}
                      className="flex items-center gap-2 text-sm font-semibold text-slate-900 hover:text-[#1C4D8D] transition-colors"
                    >
                      Joined
                      <ChevronRight size={14} className={`transition-transform ${
                        sortConfig.key === 'createdAt' && sortConfig.direction === 'asc' ? 'rotate-90' : 
                        sortConfig.key === 'createdAt' && sortConfig.direction === 'desc' ? '-rotate-90' : ''
                      }`} />
                    </button>
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredUsers.map((user) => {
                  const roleConfig = getRoleConfig(user.role);
                  const RoleIcon = roleConfig.icon;
                  return (
                    <tr key={user.id} className="hover:bg-gradient-to-r from-slate-50/50 to-white transition-all duration-300">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#1C4D8D]/10 to-[#2563eb]/10 flex items-center justify-center text-[#1C4D8D] font-bold text-lg shadow-lg">
                            {getInitials(user)}
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-900">{formatFullName(user) || 'Unknown Name'}</h4>
                            <div className="flex items-center gap-2 mt-1">
                              <Mail size={12} className="text-slate-500" />
                              <span className="text-sm text-slate-600">{user.email}</span>
                            </div>
                            {(user.is_active === false || user.suspended_at) && (
                              <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-red-100 text-red-700 text-xs font-bold">
                                Suspended
                              </div>
                            )}
                            {hasOrganizationGap(user) && (
                              <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-100 text-amber-700 text-xs font-bold">
                                Organization setup needed
                              </div>
                            )}
                            {hasNameReviewGap(user) && (
                              <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-violet-100 text-violet-700 text-xs font-bold">
                                Name review needed
                              </div>
                            )}
                            {(user.department || user.program) && (
                              <div className="mt-1 text-xs text-slate-500">
                                {[user.department, user.program].filter(Boolean).join(' / ')}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl ${roleConfig.bgColor} ${roleConfig.textColor} font-medium border ${roleConfig.textColor.replace('text', 'border')}`}>
                          <RoleIcon size={14} />
                          {roleConfig.label}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-slate-700">
                          <Calendar size={14} className="text-slate-500" />
                          <span className="font-medium">{formatDate(user.createdAt || user.created_at)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleToggleSuspension(user)}
                            className={`h-10 px-3 rounded-xl border flex items-center justify-center text-xs font-bold transition-colors ${user.is_active === false || user.suspended_at ? 'bg-emerald-100 border-emerald-200 text-emerald-700 hover:bg-emerald-200' : 'bg-amber-100 border-amber-200 text-amber-700 hover:bg-amber-200'}`}
                            title={user.is_active === false || user.suspended_at ? 'Reactivate User' : 'Suspend User'}
                          >
                            {user.is_active === false || user.suspended_at ? 'Reactivate' : 'Suspend'}
                          </button>
                          <button
                            onClick={() => openEditModal(user)}
                            className="w-10 h-10 rounded-xl bg-gradient-to-r from-slate-100 to-white border border-slate-300 flex items-center justify-center text-slate-700 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
                            title="Edit User"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(user)}
                            className="w-10 h-10 rounded-xl bg-gradient-to-r from-red-100 to-pink-100 border border-red-200 flex items-center justify-center text-red-600 hover:border-red-300 hover:text-red-700 transition-colors"
                            title="Delete User"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && userToDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="px-6 py-4 bg-gradient-to-r from-red-50 to-pink-50 border-b border-red-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-red-500 to-pink-500 flex items-center justify-center">
                  <AlertCircle size={20} className="text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Delete User</h3>
                  <p className="text-slate-600 text-sm">This action cannot be undone</p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <p className="text-slate-700 mb-4">
                Are you sure you want to delete <span className="font-bold text-slate-900">{formatFullName(userToDelete)}</span>?
                This will permanently remove their account and all associated data.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setUserToDelete(null);
                  }}
                  className="flex-1 px-6 py-3 border-2 border-slate-300 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-colors"
                  disabled={actionLoading}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-red-600 to-pink-600 text-white rounded-xl font-bold hover:from-red-700 hover:to-pink-700 transition-all duration-300 disabled:opacity-50"
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Deleting...
                    </div>
                  ) : 'Delete User'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showEditModal && userToEdit && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
            <div className="px-6 py-4 bg-gradient-to-r from-indigo-50 to-blue-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-600 to-blue-600 flex items-center justify-center">
                  <Edit size={18} className="text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Edit User</h3>
                  <p className="text-slate-500 text-sm">Update account details and organization scope</p>
                </div>
              </div>
              <button
                onClick={closeEditModal}
                className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors text-lg font-bold"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleUpdateUser} className="p-6 space-y-4">
              <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-600">
                <div className="font-semibold text-slate-900">{userToEdit.email}</div>
                <div className="mt-1">Role: <span className="font-medium">{getRoleConfig(userToEdit.role).label}</span></div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">First Name</label>
                  <input
                    type="text"
                    value={editForm.firstName}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, firstName: e.target.value }))}
                    className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Middle Name</label>
                  <input
                    type="text"
                    value={editForm.middleName}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, middleName: e.target.value }))}
                    className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Last Name</label>
                <input
                  type="text"
                  value={editForm.lastName}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, lastName: e.target.value }))}
                  className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">
                  Department {requiresDepartmentAssignment(editForm.role) ? <span className="text-red-500">*</span> : <span className="text-slate-400 font-normal">(optional)</span>}
                </label>
                <select
                  value={editForm.departmentId}
                  onChange={(e) => handleEditDepartmentChange(e.target.value)}
                  className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all bg-white"
                  required={requiresDepartmentAssignment(editForm.role)}
                >
                  <option value="">Select department</option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </select>
              </div>

              {requiresProgramAssignment(editForm.role) && (
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Program <span className="text-red-500">*</span></label>
                  <select
                    value={editForm.programId}
                    onChange={(e) => handleEditProgramChange(e.target.value)}
                    className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all bg-white disabled:bg-slate-50 disabled:text-slate-400"
                    required
                    disabled={!editForm.departmentId}
                  >
                    <option value="">
                      {editForm.departmentId ? 'Select program' : 'Select department first'}
                    </option>
                    {editPrograms.map((program) => (
                      <option key={program.id} value={program.id}>
                        {program.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {(editForm.department || editForm.program) && (
                <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-600">
                  Updated organization: <span className="font-semibold text-slate-900">{editForm.department || 'No department selected'}</span>
                  {editForm.program ? ` / ${editForm.program}` : ''}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="flex-1 px-6 py-3 border-2 border-slate-300 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-colors"
                  disabled={editLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-xl font-bold hover:from-indigo-700 hover:to-blue-700 transition-all duration-300 disabled:opacity-50"
                  disabled={editLoading}
                >
                  {editLoading ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Saving...
                    </div>
                  ) : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-[#1C4D8D]/10 to-[#2563eb]/10 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#1C4D8D] to-[#2563eb] flex items-center justify-center">
                  <UserPlus size={18} className="text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Create Account</h3>
                  <p className="text-slate-500 text-sm">Add a privileged user to the system</p>
                </div>
              </div>
              <button
                onClick={closeCreateModal}
                className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors text-lg font-bold"
              >
                ×
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreateUser} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">First Name <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    placeholder="e.g. Maria"
                    value={createForm.firstName}
                    onChange={e => setCreateForm({ ...createForm, firstName: e.target.value })}
                    className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-[#1C4D8D] focus:border-transparent outline-none transition-all"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Middle Name <span className="text-slate-400 font-normal">(optional)</span></label>
                  <input
                    type="text"
                    placeholder="e.g. Reyes"
                    value={createForm.middleName}
                    onChange={e => setCreateForm({ ...createForm, middleName: e.target.value })}
                    className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-[#1C4D8D] focus:border-transparent outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Last Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  placeholder="e.g. Santos"
                  value={createForm.lastName}
                  onChange={e => setCreateForm({ ...createForm, lastName: e.target.value })}
                  className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-[#1C4D8D] focus:border-transparent outline-none transition-all"
                  required
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Email Address <span className="text-red-500">*</span></label>
                <input
                  type="email"
                  placeholder="user@university.edu"
                  value={createForm.email}
                  onChange={e => setCreateForm({ ...createForm, email: e.target.value })}
                  className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-[#1C4D8D] focus:border-transparent outline-none transition-all"
                  required
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Temporary Password <span className="text-red-500">*</span></label>
                <input
                  type="password"
                  placeholder="Minimum 6 characters"
                  value={createForm.password}
                  onChange={e => setCreateForm({ ...createForm, password: e.target.value })}
                  className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-[#1C4D8D] focus:border-transparent outline-none transition-all"
                  required
                  minLength={6}
                />
              </div>

              {/* Role */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Role <span className="text-red-500">*</span></label>
                <select
                  value={createForm.role}
                  onChange={e => handleCreateRoleChange(e.target.value)}
                  className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-[#1C4D8D] focus:border-transparent outline-none transition-all bg-white"
                >
                  <option value="faculty">Adviser (Faculty)</option>
                  <option value="dean">Dean</option>
                  <option value="program_chair">Program Chair</option>
                  <option value="staff">Research Editor (Staff)</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>

              {/* Department */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">
                  Department {createForm.role === 'program_chair' ? <span className="text-red-500">*</span> : <span className="text-slate-400 font-normal">(optional)</span>}
                </label>
                <select
                  value={createForm.departmentId}
                  onChange={(e) => handleCreateDepartmentChange(e.target.value)}
                  className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-[#1C4D8D] focus:border-transparent outline-none transition-all bg-white"
                  required={createForm.role === 'program_chair'}
                >
                  <option value="">Select department</option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </select>
              </div>

              {createForm.role === 'program_chair' && (
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Program <span className="text-red-500">*</span></label>
                  <select
                    value={createForm.programId}
                    onChange={(e) => handleCreateProgramChange(e.target.value)}
                    className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-[#1C4D8D] focus:border-transparent outline-none transition-all bg-white disabled:bg-slate-50 disabled:text-slate-400"
                    required
                    disabled={!createForm.departmentId}
                  >
                    <option value="">
                      {createForm.departmentId ? 'Select program' : 'Select department first'}
                    </option>
                    {programs.map((program) => (
                      <option key={program.id} value={program.id}>
                        {program.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {createForm.department && (
                <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-600">
                  Selected organization: <span className="font-semibold text-slate-900">{createForm.department}</span>
                  {createForm.program ? ` / ${createForm.program}` : ''}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeCreateModal}
                  className="flex-1 px-6 py-3 border-2 border-slate-300 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-colors"
                  disabled={createLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-[#1C4D8D] to-[#2563eb] text-white rounded-xl font-bold hover:from-[#1a4480] hover:to-[#1d55d0] transition-all duration-300 disabled:opacity-50"
                  disabled={createLoading}
                >
                  {createLoading ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Creating...
                    </div>
                  ) : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
