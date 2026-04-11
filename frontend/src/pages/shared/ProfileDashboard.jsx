import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { departmentAPI, researchAPI, unwrapApiData } from '../../utils/api';
import { Download, FileText, Filter, User } from 'lucide-react';

const roleLabel = {
  student: 'Student',
  faculty: 'Faculty Adviser',
  dean: 'Dean',
  program_chair: 'Program Chair',
  staff: 'Research Editor',
  admin: 'Administrator',
};

const toDateInput = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
};

const csvEscape = (value) => {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

const buildFlatRows = (records) => {
  return records.map((record) => ({
    id: record.id,
    title: record.title,
    status: record.status,
    category: record.category || '',
    department: record.department || '',
    program: record.program || '',
    authorName: record.authorName || '',
    authorEmail: record.authorEmail || '',
    submissionDate: toDateInput(record.submissionDate),
    publishedDate: toDateInput(record.publishedDate),
    abstract: record.details?.abstract || '',
    keywords: (record.details?.keywords || []).join('; '),
    coAuthors: Array.isArray(record.details?.coAuthors)
      ? record.details.coAuthors.join('; ')
      : record.details?.coAuthors || '',
  }));
};

const downloadBlob = (content, fileName, contentType) => {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

const ProfileDashboard = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState([]);
  const [stats, setStats] = useState({ totalRecords: 0, uploadedCount: 0, publishedCount: 0 });
  const [departments, setDepartments] = useState([]);
  const [programs, setPrograms] = useState([]);

  const [filters, setFilters] = useState({
    title: '',
    details: '',
    startDate: '',
    endDate: '',
    department: '',
    program: '',
    programId: '',
    status: '',
    departmentId: '',
  });

  useEffect(() => {
    const loadDepartments = async () => {
      try {
        const response = await departmentAPI.getAllDepartments();
        setDepartments(unwrapApiData(response).departments || []);
      } catch (error) {
        console.error('Failed to load departments:', error);
      }
    };

    loadDepartments();
  }, []);

  useEffect(() => {
    const loadPrograms = async () => {
      if (!filters.departmentId) {
        setPrograms([]);
        return;
      }

      try {
        const response = await departmentAPI.getProgramsByDepartment(filters.departmentId);
        setPrograms(unwrapApiData(response).programs || []);
      } catch (error) {
        console.error('Failed to load programs:', error);
        setPrograms([]);
      }
    };

    loadPrograms();
  }, [filters.departmentId]);

  const queryParams = useMemo(
    () => ({
      title: filters.title || undefined,
      details: filters.details || undefined,
      startDate: filters.startDate || undefined,
      endDate: filters.endDate || undefined,
      department: filters.departmentId ? undefined : (filters.department || undefined),
      departmentId: filters.departmentId || undefined,
      program: filters.programId ? undefined : (filters.program || undefined),
      programId: filters.programId || undefined,
      status: filters.status || undefined,
    }),
    [filters]
  );

  const fetchProfileData = async () => {
    setLoading(true);
    try {
      const response = await researchAPI.getProfileData(queryParams);
      const payload = unwrapApiData(response);
      setRecords(payload.records || []);
      setStats(payload.stats || { totalRecords: 0, uploadedCount: 0, publishedCount: 0 });
    } catch (error) {
      console.error('Failed to fetch profile data:', error);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfileData();
  }, [queryParams]);

  const onDepartmentChange = (departmentId) => {
    const selectedDepartment = departments.find((item) => item.id === departmentId);
    setFilters((prev) => ({
      ...prev,
      departmentId,
      department: selectedDepartment?.name || '',
      program: '',
      programId: '',
    }));
  };

  const onProgramChange = (programId) => {
    const selectedProgram = programs.find((item) => item.id === programId);
    setFilters((prev) => ({
      ...prev,
      programId,
      program: selectedProgram?.name || '',
    }));
  };

  const exportRows = buildFlatRows(records);

  const exportCsv = () => {
    const headers = Object.keys(exportRows[0] || {
      id: '',
      title: '',
      status: '',
      category: '',
      department: '',
      program: '',
      authorName: '',
      authorEmail: '',
      submissionDate: '',
      publishedDate: '',
      abstract: '',
      keywords: '',
      coAuthors: '',
    });

    const lines = [headers.join(',')];
    exportRows.forEach((row) => {
      lines.push(headers.map((header) => csvEscape(row[header])).join(','));
    });

    downloadBlob(lines.join('\n'), `profile-data-${Date.now()}.csv`, 'text/csv;charset=utf-8;');
  };

  const exportXls = () => {
    const headers = Object.keys(exportRows[0] || {
      id: '',
      title: '',
      status: '',
      category: '',
      department: '',
      program: '',
      authorName: '',
      authorEmail: '',
      submissionDate: '',
      publishedDate: '',
      abstract: '',
      keywords: '',
      coAuthors: '',
    });

    const lines = [headers.join('\t')];
    exportRows.forEach((row) => {
      lines.push(headers.map((header) => String(row[header] ?? '')).join('\t'));
    });

    downloadBlob(lines.join('\n'), `profile-data-${Date.now()}.xls`, 'application/vnd.ms-excel;charset=utf-8;');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-black text-slate-900">Account Profile</h1>
            <p className="text-slate-600 mt-1">Profile details, published/uploaded records, and raw data export.</p>
            <div className="mt-3 inline-flex items-center gap-2 text-sm text-slate-700 bg-slate-100 px-3 py-1.5 rounded-lg">
              <User size={16} />
              <span>{user?.fullName || user?.email} • {roleLabel[user?.role] || user?.role}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={exportCsv}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            >
              <Download size={16} /> Export CSV
            </button>
            <button
              type="button"
              onClick={exportXls}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1C4D8D] text-white hover:bg-[#173f74]"
            >
              <Download size={16} /> Export XLS
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <p className="text-slate-500 text-sm">Total Records</p>
          <p className="text-3xl font-black text-slate-900">{stats.totalRecords || 0}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <p className="text-slate-500 text-sm">Research Uploaded</p>
          <p className="text-3xl font-black text-[#1C4D8D]">{stats.uploadedCount || 0}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <p className="text-slate-500 text-sm">Research Published</p>
          <p className="text-3xl font-black text-emerald-600">{stats.publishedCount || 0}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4 text-slate-900 font-bold">
          <Filter size={16} /> Filters
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <input
            type="text"
            placeholder="Title"
            value={filters.title}
            onChange={(event) => setFilters((prev) => ({ ...prev, title: event.target.value }))}
            className="px-3 py-2.5 border border-slate-300 rounded-xl"
          />
          <input
            type="text"
            placeholder="Research paper details"
            value={filters.details}
            onChange={(event) => setFilters((prev) => ({ ...prev, details: event.target.value }))}
            className="px-3 py-2.5 border border-slate-300 rounded-xl"
          />
          <input
            type="date"
            value={filters.startDate}
            onChange={(event) => setFilters((prev) => ({ ...prev, startDate: event.target.value }))}
            className="px-3 py-2.5 border border-slate-300 rounded-xl"
          />
          <input
            type="date"
            value={filters.endDate}
            onChange={(event) => setFilters((prev) => ({ ...prev, endDate: event.target.value }))}
            className="px-3 py-2.5 border border-slate-300 rounded-xl"
          />
          <select
            value={filters.departmentId}
            onChange={(event) => onDepartmentChange(event.target.value)}
            className="px-3 py-2.5 border border-slate-300 rounded-xl"
          >
            <option value="">All Departments</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>
          <select
            value={filters.programId}
            onChange={(event) => onProgramChange(event.target.value)}
            className="px-3 py-2.5 border border-slate-300 rounded-xl"
            disabled={!filters.departmentId}
          >
            <option value="">All Programs</option>
            {programs.map((program) => (
              <option key={program.id} value={program.id}>
                {program.name}
              </option>
            ))}
          </select>
          <select
            value={filters.status}
            onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
            className="px-3 py-2.5 border border-slate-300 rounded-xl"
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="pending_faculty">Pending Faculty</option>
            <option value="pending_dean">Pending Dean</option>
            <option value="pending_program_chair">Pending Program Chair</option>
            <option value="pending_editor">Pending Editor</option>
            <option value="pending_admin">Pending Admin</option>
            <option value="revision_required">Revision Required</option>
            <option value="rejected">Rejected</option>
            <option value="approved">Approved</option>
            <option value="published">Published</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center gap-2 text-slate-900 font-bold">
          <FileText size={18} /> Raw Data
        </div>
        {loading ? (
          <div className="p-8 text-slate-500">Loading profile records...</div>
        ) : records.length === 0 ? (
          <div className="p-8 text-slate-500">No records found for the selected filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-slate-600">
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Program</th>
                  <th className="px-4 py-3">Submission Date</th>
                  <th className="px-4 py-3">Published Date</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 text-slate-900 font-medium">{record.title}</td>
                    <td className="px-4 py-3 text-slate-700">{record.status}</td>
                    <td className="px-4 py-3 text-slate-700">{record.department || '-'}</td>
                    <td className="px-4 py-3 text-slate-700">{record.program || '-'}</td>
                    <td className="px-4 py-3 text-slate-700">{toDateInput(record.submissionDate) || '-'}</td>
                    <td className="px-4 py-3 text-slate-700">{toDateInput(record.publishedDate) || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfileDashboard;
