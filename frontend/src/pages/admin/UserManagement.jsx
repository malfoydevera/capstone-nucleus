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
} from 'lucide-react';
import { authAPI, departmentsAPI, unwrapApiData } from '../../utils/api';
import { formatFullName, getInitials } from '../../utils/names';
import UserGuideLink from '../../components/ui/UserGuideLink';

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
        color: 'from-[#3674B5] to-[#578FCA]',
        bgColor: 'bg-gradient-to-r from-[#3674B5]/10 to-[#578FCA]/10',
        textColor: 'text-[#3674B5]',
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

  const orgGapCount = users.filter((user) => hasOrganizationGap(user)).length;
  const nameGapCount = users.filter((user) => hasNameReviewGap(user)).length;

  const applyRoleFilter = (role) => {
    setSelectedRole(role);
    const next = new URLSearchParams(searchParams);
    if (role === 'all') next.delete('role');
    else next.set('role', role);
    setSearchParams(next);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="relative">
          <div className="w-20 h-20 border-4 border-[#3674B5]/20 rounded-full"></div>
          <div className="absolute top-0 left-0 w-20 h-20 border-4 border-[#3674B5] border-t-transparent rounded-full animate-spin"></div>
        </div>
        <p className="mt-6 text-lg font-medium text-slate-600 animate-pulse">Loading users...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 animate-fadeIn">
        <div className="mb-6 sm:mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">User management</h1>
            <p className="text-sm text-slate-500 mt-1">Accounts, roles, and organization assignments</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={fetchUsers} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
              <RefreshCw size={15} aria-hidden="true" /> Refresh
            </button>
            <button
              type="button"
              onClick={() => { setCreateForm(emptyCreateForm); setPrograms([]); setShowCreateModal(true); }}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-gradient-to-r from-[#3674B5] to-[#578FCA] px-3 text-sm font-semibold text-white shadow-sm"
            >
              <UserPlus size={15} aria-hidden="true" /> Add user
            </button>
          </div>
        </div>

        <UserGuideLink />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5 mb-5 sm:mb-6">
          {[
            { key: 'all', label: 'Total users', count: users.length, desc: 'All registered accounts', icon: Users, bg: 'bg-sky-50', color: 'text-sky-600', action: () => applyRoleFilter('all') },
            { key: 'org', label: 'Needs org setup', count: orgGapCount, desc: 'Missing department or program', icon: AlertCircle, bg: 'bg-amber-50', color: 'text-amber-600', action: () => { setShowOnlyOrganizationGaps(true); setShowOnlyNameReviewGaps(false); } },
            { key: 'name', label: 'Needs name review', count: nameGapCount, desc: 'Missing first or last name', icon: Edit, bg: 'bg-violet-50', color: 'text-violet-600', action: () => { setShowOnlyNameReviewGaps(true); setShowOnlyOrganizationGaps(false); } },
          ].map((card) => {
            const Icon = card.icon;
            return (
              <button key={card.key} type="button" onClick={card.action} className="text-left bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-100 hover:shadow-md hover:border-[#3674B5]/20 transition-shadow">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-slate-500 mb-1">{card.label}</p>
                    <p className="text-2xl sm:text-3xl font-bold text-slate-900">{card.count}</p>
                    <p className="mt-2 text-xs text-slate-400 truncate">{card.desc}</p>
                  </div>
                  <div className={`w-10 h-10 rounded-xl shrink-0 ${card.bg} flex items-center justify-center`}>
                    <Icon size={20} className={card.color} aria-hidden="true" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {error && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 flex items-center gap-3">
            <AlertCircle size={18} className="text-red-500 shrink-0" aria-hidden="true" />
            <p className="text-sm text-red-700 flex-1">{error}</p>
            <button type="button" onClick={fetchUsers} className="text-sm font-semibold text-red-700">Retry</button>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 sm:p-5 mb-5 sm:mb-6 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} aria-hidden="true" />
            <input
              type="search"
              placeholder="Search by name, email, department, or role…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#3674B5]/30 focus:border-[#3674B5]/40"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowOnlyOrganizationGaps((prev) => !prev)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold border transition-colors ${showOnlyOrganizationGaps ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-white border-slate-200 text-slate-600 hover:border-[#3674B5]/30'}`}
            >
              Org gaps
            </button>
            <button
              type="button"
              onClick={() => setShowOnlyNameReviewGaps((prev) => !prev)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold border transition-colors ${showOnlyNameReviewGaps ? 'bg-violet-50 border-violet-200 text-violet-800' : 'bg-white border-slate-200 text-slate-600 hover:border-[#3674B5]/30'}`}
            >
              Name review
            </button>
            {(searchParams.get('email') || searchParams.get('orgGaps') === '1' || searchParams.get('nameReview') === '1' || (searchParams.get('role') && searchParams.get('role') !== 'all')) && (
              <button type="button" onClick={clearFocusedFilters} className="rounded-lg px-3 py-1.5 text-xs font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50">
                Clear focus
              </button>
            )}
          </div>
          <div className="-mx-1 overflow-x-auto">
            <div className="flex gap-2 px-1 pb-1 min-w-max">
              {['all', 'admin', 'faculty', 'dean', 'program_chair', 'staff', 'student'].map((role) => {
                const config = getRoleConfig(role);
                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() => applyRoleFilter(role)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                      selectedRole === role ? 'bg-[#3674B5] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {role === 'all' ? 'All' : config.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-4 sm:px-5 py-3.5 border-b border-slate-100 flex items-center justify-between gap-2">
            <h2 className="font-semibold text-slate-900 text-sm">
              {filteredUsers.length} {filteredUsers.length === 1 ? 'user' : 'users'}
            </h2>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <button type="button" onClick={() => handleSort('name')} className={`hover:text-[#3674B5] ${sortConfig.key === 'name' ? 'text-[#3674B5] font-semibold' : ''}`}>Name</button>
              <span>·</span>
              <button type="button" onClick={() => handleSort('role')} className={`hover:text-[#3674B5] ${sortConfig.key === 'role' ? 'text-[#3674B5] font-semibold' : ''}`}>Role</button>
              <span>·</span>
              <button type="button" onClick={() => handleSort('createdAt')} className={`hover:text-[#3674B5] ${sortConfig.key === 'createdAt' ? 'text-[#3674B5] font-semibold' : ''}`}>Joined</button>
            </div>
          </div>

          {filteredUsers.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <Users size={32} className="mx-auto text-slate-300 mb-3" aria-hidden="true" />
              <p className="text-sm font-medium text-slate-700 mb-1">No users found</p>
              <p className="text-xs text-slate-500 mb-4">Try adjusting search or filters</p>
              <button
                type="button"
                onClick={() => { setSearchTerm(''); setSelectedRole('all'); setShowOnlyOrganizationGaps(false); setShowOnlyNameReviewGaps(false); clearFocusedFilters(); }}
                className="text-sm font-semibold text-[#3674B5] hover:text-[#2d6299]"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {filteredUsers.map((user) => {
                const roleConfig = getRoleConfig(user.role);
                const RoleIcon = roleConfig.icon;
                return (
                  <li key={user.id} className="px-4 sm:px-5 py-4 hover:bg-slate-50/80 transition-colors">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-xl bg-[#3674B5]/10 flex items-center justify-center text-[#3674B5] font-bold text-sm shrink-0">
                          {getInitials(user)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 truncate">{formatFullName(user) || 'Unknown name'}</p>
                          <p className="text-xs text-slate-500 truncate flex items-center gap-1 mt-0.5">
                            <Mail size={11} aria-hidden="true" /> {user.email}
                          </p>
                          {(user.department || user.program) && (
                            <p className="text-xs text-slate-400 mt-1 truncate">{[user.department, user.program].filter(Boolean).join(' · ')}</p>
                          )}
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${roleConfig.bgColor} ${roleConfig.textColor}`}>
                              <RoleIcon size={10} aria-hidden="true" /> {roleConfig.label}
                            </span>
                            {(user.is_active === false || user.suspended_at) && (
                              <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-700 border border-red-100">Suspended</span>
                            )}
                            {hasOrganizationGap(user) && (
                              <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-100">Org setup</span>
                            )}
                            {hasNameReviewGap(user) && (
                              <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-violet-50 text-violet-800 border border-violet-100">Name review</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 lg:ml-4">
                        <span className="hidden sm:inline text-xs text-slate-400 mr-1">{formatDate(user.createdAt || user.created_at)}</span>
                        <button
                          type="button"
                          onClick={() => handleToggleSuspension(user)}
                          className={`h-9 px-3 rounded-lg border text-xs font-semibold transition-colors ${user.is_active === false || user.suspended_at ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'}`}
                        >
                          {user.is_active === false || user.suspended_at ? 'Reactivate' : 'Suspend'}
                        </button>
                        <button type="button" onClick={() => openEditModal(user)} className="h-9 w-9 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-600 hover:border-[#3674B5]/30 hover:text-[#3674B5]" aria-label={`Edit ${formatFullName(user)}`}>
                          <Edit size={15} aria-hidden="true" />
                        </button>
                        <button type="button" onClick={() => handleDeleteClick(user)} className="h-9 w-9 rounded-lg border border-red-200 bg-red-50 flex items-center justify-center text-red-600 hover:bg-red-100" aria-label={`Delete ${formatFullName(user)}`}>
                          <Trash2 size={15} aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
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
            <div className="px-6 py-4 bg-gradient-to-r from-[#3674B5]/10 to-[#578FCA]/10 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#3674B5] to-[#578FCA] flex items-center justify-center">
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
                    className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-[#3674B5] focus:border-transparent outline-none transition-all"
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
                    className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-[#3674B5] focus:border-transparent outline-none transition-all"
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
                  className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-[#3674B5] focus:border-transparent outline-none transition-all"
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
                  className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-[#3674B5] focus:border-transparent outline-none transition-all"
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
                  className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-[#3674B5] focus:border-transparent outline-none transition-all"
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
                  className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-[#3674B5] focus:border-transparent outline-none transition-all bg-white"
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
                  className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-[#3674B5] focus:border-transparent outline-none transition-all bg-white"
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
                    className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-[#3674B5] focus:border-transparent outline-none transition-all bg-white disabled:bg-slate-50 disabled:text-slate-400"
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
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-[#3674B5] to-[#578FCA] text-white rounded-xl font-bold hover:from-[#1a4480] hover:to-[#1d55d0] transition-all duration-300 disabled:opacity-50"
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
