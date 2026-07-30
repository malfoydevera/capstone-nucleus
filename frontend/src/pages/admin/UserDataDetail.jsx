import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  ChevronRight,
  Mail,
  Building2,
  GraduationCap,
  CalendarDays,
  FileText,
  Filter,
  Download,
  FileDown,
  AlertCircle,
  X,
  Loader2,
} from 'lucide-react';
import { authAPI, unwrapApiData } from '../../utils/api';
import { formatFullName, getInitials } from '../../utils/names';
import { getRoleConfig } from '../../utils/roleConfig';

const ALL_VALUE = 'all';

const STATUS_PILL_STYLES = {
  approved: 'bg-emerald-50 text-emerald-700',
  published: 'bg-emerald-50 text-emerald-700',
  faculty_approved: 'bg-emerald-50 text-emerald-700',
  editor_approved: 'bg-emerald-50 text-emerald-700',
  rejected: 'bg-red-50 text-red-700',
  revision_required: 'bg-orange-50 text-orange-700',
};

const getStatusPillClass = (status) => STATUS_PILL_STYLES[status] || 'bg-amber-50 text-amber-700';

const formatDateLabel = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const safeFileSegment = (value) =>
  String(value || 'user').replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '').toLowerCase() || 'user';

const csvEscape = (value) => {
  const raw = value == null ? '' : String(value);
  if (raw.includes('"') || raw.includes(',') || raw.includes('\n') || raw.includes('\r')) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
};

const buildRecordsCsv = (records) => {
  const headers = ['Record Title', 'Type', 'Category', 'Submission Date', 'Status'];
  const lines = [headers.map(csvEscape).join(',')];
  records.forEach((record) => {
    lines.push([
      record.title || 'Untitled',
      'Research Submission',
      record.category || '',
      formatDateLabel(record.submissionDate),
      record.statusLabel || record.status || '',
    ].map(csvEscape).join(','));
  });
  return `${lines.join('\n')}\n`;
};

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const SkeletonRow = () => (
  <div className="flex items-center gap-4 px-4 sm:px-5 py-4 animate-pulse" aria-hidden="true">
    <div className="h-4 w-1/3 rounded bg-slate-200" />
    <div className="h-4 w-24 rounded bg-slate-100" />
    <div className="h-4 w-24 rounded bg-slate-100" />
    <div className="h-5 w-20 rounded-full bg-slate-100 ml-auto" />
  </div>
);

/**
 * Admin-only User Profile Detail View — full record page for one user.
 * Reached from the User Data grid; supports pre-export filtering of a user's
 * research submission records (date range, status) and CSV/PDF export of
 * exactly what's currently visible.
 */
const UserDataDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [user, setUser] = useState(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exportingPdf, setExportingPdf] = useState(false);

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState(ALL_VALUE);

  const backTarget = location.state?.from || '/admin/user-data';

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await authAPI.getUserRecords(id);
      const data = unwrapApiData(response);
      setUser(data.user || null);
      setRecords(data.records || []);
    } catch (err) {
      console.error('Failed to load user records:', err);
      setError(err.response?.status === 404 ? 'User not found.' : 'Failed to load user records. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const statusOptions = useMemo(() => {
    const unique = new Map();
    records.forEach((record) => {
      if (record.status && !unique.has(record.status)) {
        unique.set(record.status, record.statusLabel || record.status);
      }
    });
    return Array.from(unique.entries());
  }, [records]);

  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      if (statusFilter !== ALL_VALUE && record.status !== statusFilter) return false;
      if (dateFrom && record.submissionDate && new Date(record.submissionDate) < new Date(dateFrom)) return false;
      if (dateTo && record.submissionDate) {
        const endOfDay = new Date(`${dateTo}T23:59:59.999`);
        if (new Date(record.submissionDate) > endOfDay) return false;
      }
      return true;
    });
  }, [records, statusFilter, dateFrom, dateTo]);

  const hasActiveFilters = statusFilter !== ALL_VALUE || Boolean(dateFrom) || Boolean(dateTo);

  const clearFilters = () => {
    setStatusFilter(ALL_VALUE);
    setDateFrom('');
    setDateTo('');
  };

  const fullName = user ? (formatFullName(user) || user.email || 'User') : '';
  const roleConfig = user ? getRoleConfig(user.role) : null;
  const isActive = user ? user.is_active !== false : true;

  const handleExportCsv = () => {
    if (filteredRecords.length === 0) {
      toast.error('No records to export with the current filters.');
      return;
    }
    const csv = buildRecordsCsv(filteredRecords);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const stamp = new Date().toISOString().slice(0, 10);
    downloadBlob(blob, `user_records_${safeFileSegment(fullName)}_${stamp}.csv`);
    toast.success('CSV export downloaded.');
  };

  const handleExportPdf = async () => {
    setExportingPdf(true);
    try {
      const filters = {};
      if (dateFrom) filters.dateFrom = dateFrom;
      if (dateTo) filters.dateTo = dateTo;
      if (statusFilter !== ALL_VALUE) filters.status = statusFilter;

      const response = await authAPI.exportUserRecordsPdf(id, filters);
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const stamp = new Date().toISOString().slice(0, 10);
      downloadBlob(blob, `user_record_report_${safeFileSegment(fullName)}_${stamp}.pdf`);
      toast.success('PDF report downloaded.');
    } catch (err) {
      console.error('Failed to export PDF report:', err);
      toast.error('Failed to generate PDF report.');
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Breadcrumb / back navigation */}
        <div className="mb-5 flex items-center gap-2 text-sm text-slate-500">
          <button
            type="button"
            onClick={() => navigate(backTarget)}
            className="inline-flex items-center gap-1.5 font-semibold text-[#3674B5] hover:text-[#2d6299]"
          >
            <ArrowLeft size={15} aria-hidden="true" /> User Data
          </button>
          <ChevronRight size={14} className="text-slate-300" aria-hidden="true" />
          <span className="truncate text-slate-600">{loading ? 'Loading…' : (fullName || 'Profile')}</span>
        </div>

        {error && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 flex items-center gap-3">
            <AlertCircle size={18} className="text-red-500 shrink-0" aria-hidden="true" />
            <p className="text-sm text-red-700 flex-1">{error}</p>
            <button type="button" onClick={fetchRecords} className="text-sm font-semibold text-red-700">Retry</button>
          </div>
        )}

        {/* Profile header */}
        {loading ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6 animate-pulse">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-slate-200" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-1/3 rounded bg-slate-200" />
                <div className="h-3 w-1/2 rounded bg-slate-100" />
              </div>
            </div>
          </div>
        ) : user ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
            <div className="flex flex-wrap items-start gap-4 justify-between">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-16 h-16 shrink-0 rounded-full bg-[#3674B5]/10 flex items-center justify-center text-[#3674B5] font-bold text-xl">
                  {getInitials(user)}
                </div>
                <div className="min-w-0">
                  <h1 className="text-lg sm:text-xl font-bold text-slate-900 truncate">{fullName}</h1>
                  <p className="text-sm text-slate-500 flex items-center gap-1.5 mt-0.5">
                    <Mail size={13} aria-hidden="true" /> {user.email}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${roleConfig.badgeClass}`}>
                  {roleConfig.label}
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                    isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} aria-hidden="true" />
                  {isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-4 pt-5 border-t border-slate-100 text-sm">
              <div className="flex items-center gap-2 text-slate-600">
                <Building2 size={15} className="text-slate-400 shrink-0" aria-hidden="true" />
                <span className="truncate">{user.department || 'No department assigned'}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <GraduationCap size={15} className="text-slate-400 shrink-0" aria-hidden="true" />
                <span className="truncate">{user.program || 'No course/program assigned'}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <CalendarDays size={15} className="text-slate-400 shrink-0" aria-hidden="true" />
                <span>Joined {formatDateLabel(user.created_at || user.createdAt)}</span>
              </div>
            </div>
          </div>
        ) : null}

        {/* Pre-export filters */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 sm:p-5 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Filter size={15} className="text-slate-400" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-slate-900">Filter records before exporting</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor="records-date-from" className="block text-xs font-medium text-slate-500 mb-1">From date</label>
              <input
                id="records-date-from"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full h-11 px-3 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#3674B5]/30 focus:border-[#3674B5]/40"
              />
            </div>
            <div>
              <label htmlFor="records-date-to" className="block text-xs font-medium text-slate-500 mb-1">To date</label>
              <input
                id="records-date-to"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full h-11 px-3 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#3674B5]/30 focus:border-[#3674B5]/40"
              />
            </div>
            <div>
              <label htmlFor="records-status" className="block text-xs font-medium text-slate-500 mb-1">Status</label>
              <select
                id="records-status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full h-11 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#3674B5]/30 focus:border-[#3674B5]/40 cursor-pointer"
              >
                <option value={ALL_VALUE}>All statuses</option>
                {statusOptions.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <p className="text-sm text-slate-500">
                Showing <span className="font-semibold text-slate-900">{loading ? '…' : filteredRecords.length}</span> of{' '}
                <span className="font-semibold text-slate-900">{loading ? '…' : records.length}</span> records
              </p>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#3674B5] hover:text-[#2d6299]"
                >
                  <X size={12} aria-hidden="true" /> Clear
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleExportCsv}
                disabled={loading || filteredRecords.length === 0}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download size={15} aria-hidden="true" /> Export as CSV
              </button>
              <button
                type="button"
                onClick={handleExportPdf}
                disabled={loading || exportingPdf || filteredRecords.length === 0}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-gradient-to-r from-[#3674B5] to-[#578FCA] px-3.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {exportingPdf ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <FileDown size={15} aria-hidden="true" />}
                Download as PDF
              </button>
            </div>
          </div>
        </div>

        {/* Records list */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-4 sm:px-5 py-3.5 border-b border-slate-100 flex items-center gap-2">
            <FileText size={15} className="text-slate-400" aria-hidden="true" />
            <h2 className="font-semibold text-slate-900 text-sm">Research submission records</h2>
          </div>

          {loading ? (
            <div className="divide-y divide-slate-100">
              {Array.from({ length: 4 }).map((_, index) => <SkeletonRow key={index} />)}
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <FileText size={32} className="mx-auto text-slate-300 mb-3" aria-hidden="true" />
              <p className="text-sm font-medium text-slate-700 mb-1">
                {records.length === 0 ? 'No records found' : 'No records match your filters'}
              </p>
              <p className="text-xs text-slate-500 mb-4">
                {records.length === 0
                  ? 'This user has no research submissions on record yet.'
                  : 'Try adjusting the date range or status filter above.'}
              </p>
              {hasActiveFilters && (
                <button type="button" onClick={clearFilters} className="text-sm font-semibold text-[#3674B5] hover:text-[#2d6299]">
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[32rem] overflow-y-auto">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th scope="col" className="px-4 sm:px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Record Title</th>
                    <th scope="col" className="px-4 sm:px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">Type</th>
                    <th scope="col" className="px-4 sm:px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">Submission Date</th>
                    <th scope="col" className="px-4 sm:px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRecords.map((record) => (
                    <tr key={record.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 sm:px-5 py-3.5 align-top">
                        <p className="font-medium text-slate-900">{record.title || 'Untitled'}</p>
                        {record.category ? (
                          <p className="text-xs text-slate-500 mt-0.5">{record.category}</p>
                        ) : null}
                      </td>
                      <td className="px-4 sm:px-5 py-3.5 align-top text-slate-600 whitespace-nowrap">Research Submission</td>
                      <td className="px-4 sm:px-5 py-3.5 align-top text-slate-600 whitespace-nowrap">{formatDateLabel(record.submissionDate)}</td>
                      <td className="px-4 sm:px-5 py-3.5 align-top whitespace-nowrap">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusPillClass(record.status)}`}>
                          {record.statusLabel || record.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserDataDetail;
