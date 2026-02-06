import { useState, useEffect, useCallback } from 'react';
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
  Download
} from 'lucide-react';
import { authAPI } from '../../utils/api';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [selectedRole, setSelectedRole] = useState('all');
  const [sortConfig, setSortConfig] = useState({ key: 'createdAt', direction: 'desc' });
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    filterAndSortUsers();
  }, [users, searchTerm, selectedRole, sortConfig]);

  const fetchUsers = async () => {
    try {
      const response = await authAPI.getAllUsers();
      setUsers(response.data.users);
      setError('');
    } catch (err) {
      console.error('Failed to fetch users:', err);
      setError('Failed to load users. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const filterAndSortUsers = useCallback(() => {
    let filtered = [...users];

    // Filter by search term
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      filtered = filtered.filter(user => 
        user.full_name?.toLowerCase().includes(lowerSearch) ||
        user.email?.toLowerCase().includes(lowerSearch) ||
        user.role?.toLowerCase().includes(lowerSearch)
      );
    }

    // Filter by role
    if (selectedRole !== 'all') {
      filtered = filtered.filter(user => user.role === selectedRole);
    }

    // Sort
    filtered.sort((a, b) => {
      let aValue = a[sortConfig.key];
      let bValue = b[sortConfig.key];

      if (sortConfig.key === 'createdAt') {
        aValue = new Date(a.createdAt || a.created_at);
        bValue = new Date(b.createdAt || b.created_at);
      }

      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    setFilteredUsers(filtered);
  }, [users, searchTerm, selectedRole, sortConfig]);

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleDeleteClick = (user) => {
    setUserToDelete(user);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!userToDelete) return;

    setActionLoading(true);
    const loadingToast = toast.loading('Deleting user...');
    try {
      await authAPI.deleteUser(userToDelete.id);
      // Remove user from local state immediately
      setUsers(users.filter(u => u.id !== userToDelete.id));
      toast.success(`User ${userToDelete.full_name} deleted successfully`, {
        id: loadingToast,
        icon: '🗑️',
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

  const getRoleConfig = (role) => {
    const configs = {
      admin: {
        color: 'from-red-500 to-pink-500',
        bgColor: 'bg-gradient-to-r from-red-100 to-pink-100',
        textColor: 'text-red-700',
        icon: Shield,
        label: 'Administrator'
      },
      staff: {
        color: 'from-purple-500 to-violet-500',
        bgColor: 'bg-gradient-to-r from-purple-100 to-violet-100',
        textColor: 'text-purple-700',
        icon: Eye,
        label: 'Staff'
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
          <div className="w-20 h-20 border-4 border-indigo-100 rounded-full"></div>
          <div className="absolute top-0 left-0 w-20 h-20 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
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
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-500 flex items-center justify-center shadow-lg">
                <Users size={28} className="text-white" />
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-black text-slate-900 mb-2">
                  User <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-blue-600">Management</span>
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
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-slate-100 to-white border border-slate-300 text-slate-700 hover:border-indigo-300 transition-colors"
            >
              <RefreshCw size={16} />
              Refresh
            </button>
            {/* Placeholder for Add User modal */}
            {/* <button
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-xl font-bold hover:from-indigo-700 hover:to-blue-700 transition-all duration-300"
            >
              <UserPlus size={16} />
              Add User
            </button> */}
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-500 flex items-center justify-center shadow-lg">
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
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-violet-500 flex items-center justify-center shadow-lg">
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
                className="w-full pl-12 pr-4 py-3 bg-white border-2 border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-300 font-medium"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter size={18} className="text-slate-600" />
              <span className="text-sm font-medium text-slate-700">Filter:</span>
            </div>
            <div className="flex gap-2">
              {['all', 'admin', 'staff', 'student', 'user'].map((role) => {
                const config = getRoleConfig(role);
                const Icon = config.icon;
                return (
                  <button
                    key={role}
                    onClick={() => setSelectedRole(role)}
                    className={`px-4 py-2 rounded-xl font-medium text-sm transition-all duration-300 ${
                      selectedRole === role
                        ? `${config.bgColor} border ${config.textColor.replace('text', 'border')} font-bold`
                        : 'bg-gradient-to-r from-slate-100 to-white border border-slate-300 text-slate-700 hover:border-indigo-300'
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
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-white border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-100 to-blue-100 flex items-center justify-center">
                <Users size={20} className="text-indigo-600" />
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
              {searchTerm || selectedRole !== 'all' 
                ? 'Try adjusting your search or filters' 
                : 'No users registered in the system'}
            </p>
            {(searchTerm || selectedRole !== 'all') && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setSelectedRole('all');
                }}
                className="px-6 py-3 bg-gradient-to-r from-slate-100 to-white border border-slate-300 text-slate-700 rounded-xl font-medium hover:border-indigo-300 transition-colors"
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
                      onClick={() => handleSort('full_name')}
                      className="flex items-center gap-2 text-sm font-semibold text-slate-900 hover:text-indigo-600 transition-colors"
                    >
                      User
                      <ChevronRight size={14} className={`transition-transform ${
                        sortConfig.key === 'full_name' && sortConfig.direction === 'asc' ? 'rotate-90' : 
                        sortConfig.key === 'full_name' && sortConfig.direction === 'desc' ? '-rotate-90' : ''
                      }`} />
                    </button>
                  </th>
                  <th className="px-6 py-4 text-left">
                    <button
                      onClick={() => handleSort('role')}
                      className="flex items-center gap-2 text-sm font-semibold text-slate-900 hover:text-indigo-600 transition-colors"
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
                      className="flex items-center gap-2 text-sm font-semibold text-slate-900 hover:text-indigo-600 transition-colors"
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
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-100 to-blue-100 flex items-center justify-center text-indigo-700 font-bold text-lg shadow-lg">
                            {user.full_name?.charAt(0).toUpperCase() || '?'}
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-900">{user.full_name || 'Unknown Name'}</h4>
                            <div className="flex items-center gap-2 mt-1">
                              <Mail size={12} className="text-slate-500" />
                              <span className="text-sm text-slate-600">{user.email}</span>
                            </div>
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
                          {/* Placeholder for Edit functionality */}
                          {/* <button
                            className="w-10 h-10 rounded-xl bg-gradient-to-r from-slate-100 to-white border border-slate-300 flex items-center justify-center text-slate-700 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
                            title="Edit User"
                          >
                            <Edit size={16} />
                          </button> */}
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
                Are you sure you want to delete <span className="font-bold text-slate-900">{userToDelete.full_name}</span>?
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
    </div>
  );
};

export default UserManagement;