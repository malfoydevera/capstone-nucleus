import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Clock,
  CheckCircle,
  AlertCircle,
  Upload,
  Search,
  BookOpen,
  ChevronRight,
  Calendar,
  RefreshCw,
} from 'lucide-react';
import { researchAPI, unwrapApiData } from '../../utils/api';
import UserGuideLink from '../../components/ui/UserGuideLink';
import {
  getStudentStatusLabel,
  getStudentStatusTone,
  isNeedsAction,
  isInReview,
  isDone,
} from '../../utils/studentStatus';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const getStructuredCoAuthorCount = (paper) =>
  Array.isArray(paper?.structured_authors)
    ? paper.structured_authors.filter((entry) => !entry?.is_primary).length
    : 0;

const StudentDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [papers, setPapers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [response, categoriesResponse] = await Promise.all([
        researchAPI.getMyResearch(),
        researchAPI.getCategories(),
      ]);
      setPapers(unwrapApiData(response).papers || []);
      setCategories(unwrapApiData(categoriesResponse).categories || []);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      setPapers([]);
    } finally {
      setLoading(false);
    }
  };

  const taskCounts = useMemo(() => ({
    needsAction: papers.filter((p) => isNeedsAction(p.status)).length,
    inReview: papers.filter((p) => isInReview(p.status)).length,
    done: papers.filter((p) => isDone(p.status)).length,
  }), [papers]);

  const recentPapers = useMemo(() => {
    return [...papers]
      .sort((a, b) => new Date(b.submission_date || b.created_at) - new Date(a.submission_date || a.created_at))
      .slice(0, 5);
  }, [papers]);

  const getCategoryName = (categoryValue) => {
    if (!categoryValue) return 'Research';
    const category = categories.find((entry) => entry.id === categoryValue);
    if (category) return category.name;
    if (typeof categoryValue === 'string' && !UUID_PATTERN.test(categoryValue)) return categoryValue;
    return 'Research';
  };

  const formatDate = (dateString) =>
    new Date(dateString).toLocaleDateString('en-US', { day: '2-digit', month: '2-digit', year: 'numeric' });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] animate-fadeIn">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-slate-200 rounded-full" />
          <div className="absolute top-0 left-0 w-16 h-16 border-4 border-[#3674B5] border-t-transparent rounded-full animate-spin" />
        </div>
        <p className="mt-4 text-sm text-slate-500">Loading dashboard...</p>
      </div>
    );
  }

  const taskCards = [
    {
      key: 'needsAction',
      label: 'Needs Action',
      count: taskCounts.needsAction,
      icon: AlertCircle,
      iconBg: 'bg-orange-50',
      iconColor: 'text-orange-600',
      description: 'Revisions or follow-ups required',
      onClick: () => navigate('/student/my-research'),
    },
    {
      key: 'inReview',
      label: 'In Review',
      count: taskCounts.inReview,
      icon: Clock,
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-600',
      description: 'Awaiting adviser or staff review',
      onClick: () => navigate('/student/my-research'),
    },
    {
      key: 'done',
      label: 'Done',
      count: taskCounts.done,
      icon: CheckCircle,
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
      description: 'Approved or published',
      onClick: () => navigate('/student/my-research'),
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50/50">
      <div className="max-w-7xl mx-auto px-6 py-8 animate-fadeIn">
        <div className="mb-8 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-4">
            <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border border-slate-200 text-sm text-slate-600">
              <Calendar size={14} />
              <span>{new Date().toLocaleDateString('en-US', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <img
              src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user?.fullName || 'User')}&background=3674B5&color=fff`}
              alt="Profile"
              className="w-9 h-9 rounded-full"
            />
            <span className="text-sm font-medium text-slate-700 hidden sm:inline">{user?.fullName}</span>
          </div>
        </div>

        <UserGuideLink />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
          {taskCards.map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.key}
                type="button"
                onClick={card.onClick}
                className="text-left bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:shadow-md hover:border-[#3674B5]/20 transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-slate-500 mb-1">{card.label}</p>
                    <p className="text-3xl font-bold text-slate-900">{card.count}</p>
                    <p className="mt-2 text-xs text-slate-400">{card.description}</p>
                  </div>
                  <div className={`w-10 h-10 rounded-xl ${card.iconBg} flex items-center justify-center`}>
                    <Icon size={20} className={card.iconColor} />
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
          <button
            type="button"
            onClick={() => navigate('/student/submit')}
            className="group bg-gradient-to-br from-[#3674B5] to-[#578FCA] rounded-2xl p-5 shadow-sm hover:shadow-lg transition-all hover:-translate-y-0.5"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                <Upload size={24} className="text-white" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-white">Submit Research</p>
                <p className="text-sm text-blue-100">Upload new paper</p>
              </div>
              <ChevronRight size={20} className="text-white/70 ml-auto group-hover:translate-x-1 transition-transform" />
            </div>
          </button>

          <button
            type="button"
            onClick={() => navigate('/student/my-research')}
            className="group bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:shadow-md transition-all hover:-translate-y-0.5"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#3674B5]/10 flex items-center justify-center">
                <BookOpen size={24} className="text-[#3674B5]" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-slate-900">My Submissions</p>
                <p className="text-sm text-slate-500">{papers.length} total</p>
              </div>
              <ChevronRight size={20} className="text-slate-300 ml-auto group-hover:translate-x-1 transition-transform" />
            </div>
          </button>

          <button
            type="button"
            onClick={() => navigate('/student/browse')}
            className="group bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:shadow-md transition-all hover:-translate-y-0.5"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center">
                <Search size={24} className="text-emerald-600" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-slate-900">Browse Repository</p>
                <p className="text-sm text-slate-500">Explore papers</p>
              </div>
              <ChevronRight size={20} className="text-slate-300 ml-auto group-hover:translate-x-1 transition-transform" />
            </div>
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">Recent Submissions</h3>
            <button type="button" onClick={fetchDashboardData} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
              <RefreshCw size={16} className="text-slate-400" />
            </button>
          </div>

          {recentPapers.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <FileText size={24} className="text-slate-400" />
              </div>
              <p className="text-slate-600 font-medium mb-1">No submissions yet</p>
              <p className="text-sm text-slate-400 mb-4">Start by submitting your first research paper</p>
              <button
                type="button"
                onClick={() => navigate('/student/submit')}
                className="px-4 py-2 bg-[#3674B5] text-white text-sm font-medium rounded-lg hover:bg-[#2d6299] transition-colors"
              >
                Submit Research
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 text-left">
                    <th className="px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Title</th>
                    <th className="px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Category</th>
                    <th className="px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Date</th>
                    <th className="px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentPapers.map((paper) => {
                    const coAuthorCount = getStructuredCoAuthorCount(paper);
                    return (
                      <tr
                        key={paper.id}
                        className="hover:bg-slate-50 cursor-pointer transition-colors"
                        onClick={() => navigate(`/student/my-research/${paper.id}`)}
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                              <FileText size={16} className="text-slate-500" />
                            </div>
                            <div className="min-w-0">
                              <span className="block font-medium text-slate-900 truncate max-w-[200px]">{paper.title}</span>
                              {coAuthorCount > 0 ? (
                                <span className="block text-xs text-slate-500">
                                  {coAuthorCount} canonical co-author{coAuthorCount > 1 ? 's' : ''}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-sm text-slate-600">{getCategoryName(paper.category)}</td>
                        <td className="px-5 py-4 text-sm text-slate-500">{formatDate(paper.submission_date || paper.created_at)}</td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium border ${getStudentStatusTone(paper.status)}`}>
                            {getStudentStatusLabel(paper.status)}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <ChevronRight size={16} className="text-slate-300" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentDashboard;
