import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Building2, GraduationCap, Users, AlertCircle, X, RefreshCw } from 'lucide-react';
import { authAPI, departmentsAPI, unwrapApiData } from '../../utils/api';
import { formatFullName } from '../../utils/names';
import UserProfileCard from '../../components/admin/UserProfileCard';

const ALL_VALUE = 'all';

const SkeletonCard = () => (
  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 animate-pulse" aria-hidden="true">
    <div className="flex items-center gap-3 mb-4">
      <div className="w-12 h-12 rounded-full bg-slate-200" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 w-2/3 rounded bg-slate-200" />
        <div className="h-3 w-1/2 rounded bg-slate-100" />
      </div>
    </div>
    <div className="h-5 w-24 rounded-full bg-slate-100 mb-4" />
    <div className="space-y-2 pt-3 border-t border-slate-100">
      <div className="h-3 w-3/4 rounded bg-slate-100" />
      <div className="h-3 w-2/3 rounded bg-slate-100" />
      <div className="h-3 w-1/2 rounded bg-slate-100" />
    </div>
  </div>
);

/**
 * Admin-only "User Data" page — F-xxx.
 * Standalone directory of user profile cards with department / live search /
 * course (program) filters (AND logic), separate from User Management (which
 * handles account CRUD). Clicking a card opens the full profile + records
 * detail view at /admin/user-data/:id.
 */
const UserData = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [searchTerm, setSearchTerm] = useState(searchParams.get('q') || '');
  const [selectedDepartment, setSelectedDepartment] = useState(searchParams.get('dept') || ALL_VALUE);
  const [selectedProgram, setSelectedProgram] = useState(searchParams.get('program') || ALL_VALUE);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [usersRes, departmentsRes] = await Promise.all([
        authAPI.getAllUsers(),
        departmentsAPI.getAll(),
      ]);
      setUsers(unwrapApiData(usersRes).users || []);
      setDepartments(unwrapApiData(departmentsRes).departments || []);
    } catch (err) {
      console.error('Failed to load user data:', err);
      setError('Failed to load users. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Keep filters in the URL so the Back button on the detail view can restore them.
  useEffect(() => {
    const next = new URLSearchParams();
    if (searchTerm) next.set('q', searchTerm);
    if (selectedDepartment !== ALL_VALUE) next.set('dept', selectedDepartment);
    if (selectedProgram !== ALL_VALUE) next.set('program', selectedProgram);
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, selectedDepartment, selectedProgram]);

  const departmentOptions = useMemo(
    () => departments.map((dept) => dept.name).filter(Boolean).sort((a, b) => a.localeCompare(b)),
    [departments]
  );

  const programOptions = useMemo(() => {
    const names = new Set();
    departments.forEach((dept) => {
      (dept.programs || []).forEach((program) => {
        if (program?.name) names.add(program.name);
      });
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [departments]);

  const filteredUsers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return users.filter((user) => {
      if (selectedDepartment !== ALL_VALUE && (user.department || '') !== selectedDepartment) return false;
      if (selectedProgram !== ALL_VALUE && (user.program || '') !== selectedProgram) return false;
      if (term) {
        const haystack = `${formatFullName(user)} ${user.email || ''}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [users, searchTerm, selectedDepartment, selectedProgram]);

  const hasActiveFilters = Boolean(searchTerm) || selectedDepartment !== ALL_VALUE || selectedProgram !== ALL_VALUE;

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedDepartment(ALL_VALUE);
    setSelectedProgram(ALL_VALUE);
  };

  const openUser = (user) => {
    navigate(`/admin/user-data/${user.id}`, {
      state: { from: `/admin/user-data${searchParams.toString() ? `?${searchParams.toString()}` : ''}` },
    });
  };

  return (
    <div className="min-h-screen bg-slate-50/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="mb-6 sm:mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">User Data</h1>
            <p className="text-sm text-slate-500 mt-1">Browse full user profiles, search records, and export activity</p>
          </div>
          <button
            type="button"
            onClick={fetchData}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 self-start"
          >
            <RefreshCw size={15} aria-hidden="true" /> Refresh
          </button>
        </div>

        {error && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 flex items-center gap-3">
            <AlertCircle size={18} className="text-red-500 shrink-0" aria-hidden="true" />
            <p className="text-sm text-red-700 flex-1">{error}</p>
            <button type="button" onClick={fetchData} className="text-sm font-semibold text-red-700">Retry</button>
          </div>
        )}

        {/* Search + filter section */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 sm:p-5 mb-5 sm:mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="relative md:col-span-1">
              <label htmlFor="user-data-search" className="sr-only">Search by name or email</label>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} aria-hidden="true" />
              <input
                id="user-data-search"
                type="search"
                placeholder="Search by name or email…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-11 pl-10 pr-4 rounded-lg border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#3674B5]/30 focus:border-[#3674B5]/40"
              />
            </div>

            <div className="relative">
              <label htmlFor="user-data-department" className="sr-only">Filter by department</label>
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} aria-hidden="true" />
              <select
                id="user-data-department"
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="w-full h-11 pl-9 pr-8 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#3674B5]/30 focus:border-[#3674B5]/40 cursor-pointer appearance-none"
              >
                <option value={ALL_VALUE}>All departments</option>
                {departmentOptions.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>

            <div className="relative">
              <label htmlFor="user-data-program" className="sr-only">Filter by course/program</label>
              <GraduationCap className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} aria-hidden="true" />
              <select
                id="user-data-program"
                value={selectedProgram}
                onChange={(e) => setSelectedProgram(e.target.value)}
                className="w-full h-11 pl-9 pr-8 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#3674B5]/30 focus:border-[#3674B5]/40 cursor-pointer appearance-none"
              >
                <option value={ALL_VALUE}>All courses / programs</option>
                {programOptions.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-slate-500">
              Showing <span className="font-semibold text-slate-900">{loading ? '…' : filteredUsers.length}</span> of{' '}
              <span className="font-semibold text-slate-900">{loading ? '…' : users.length}</span> users
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#3674B5] hover:text-[#2d6299]"
              >
                <X size={14} aria-hidden="true" /> Clear filters
              </button>
            )}
          </div>
        </div>

        {/* Results */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {Array.from({ length: 8 }).map((_, index) => (
              <SkeletonCard key={index} />
            ))}
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center mx-auto mb-5">
              <Users size={28} className="text-slate-400" aria-hidden="true" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">No users found</h3>
            <p className="text-slate-600 mb-6 max-w-md mx-auto text-sm">
              No users match your current search and filter criteria. Try adjusting or clearing the filters above.
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="px-5 py-2.5 bg-gradient-to-r from-[#3674B5] to-[#578FCA] text-white rounded-xl font-medium text-sm hover:opacity-90 transition-opacity"
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filteredUsers.map((user) => (
              <UserProfileCard key={user.id} user={user} onOpen={openUser} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default UserData;
