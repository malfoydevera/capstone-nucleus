import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  AlertCircle,
  Award,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Edit3,
  FileText,
  GraduationCap,
  KeyRound,
  Mail,
  RefreshCw,
  Shield,
  Sparkles,
  UserPlus,
  X,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  authAPI,
  departmentAPI,
  researchAPI,
  unwrapApiData,
} from '../../utils/api';
import { getStudentStatusLabel, getStudentStatusTone } from '../../utils/studentStatus';
import { reviewStatusLabel } from '../../components/review/reviewStatus';
import LoadMoreFooter from '../../components/ui/LoadMoreFooter';
import ChangePasswordModal from '../../components/profile/ChangePasswordModal';
import ChangeEmailModal from '../../components/profile/ChangeEmailModal';
import ChangeRecoveryEmailModal from '../../components/profile/ChangeRecoveryEmailModal';
import nuBuildingImg from '../../assets/dasma.webp';

const PAGE_SIZE = 6;

const ROLE_LABELS = {
  student: 'Student Researcher',
  faculty: 'Faculty Adviser',
  dean: 'Dean',
  program_chair: 'Program Chair',
  staff: 'Research Editor',
  admin: 'Administrator',
};

const ROLE_TAGLINES = {
  student: 'Building and sharing academic research through NUCLEUS',
  faculty: 'Guiding student research through the review pipeline',
  dean: 'Overseeing research quality and academic standards',
  program_chair: 'Leading program-level research review',
  staff: 'Supporting editorial review and publication readiness',
  admin: 'Managing system operations and final approvals',
};

const REVIEW_ACTION_LABELS = {
  approved: 'Approved',
  rejected: 'Rejected',
  revision_required: 'Revision requested',
  pending: 'Pending',
};

const REVIEW_ACTION_TONES = {
  approved: 'bg-emerald-500',
  rejected: 'bg-rose-500',
  revision_required: 'bg-orange-500',
  pending: 'bg-amber-500',
};

const formatDate = (value) => {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const getPipelineStage = (status) => {
  if (['approved', 'published'].includes(status)) return 5;
  if (status === 'pending_admin') return 4;
  if (status === 'pending_editor' || status === 'under_review') return 3;
  if (['pending_dean', 'pending_program_chair'].includes(status)) return 2;
  if (status === 'pending_faculty') return 1;
  return 0;
};

const getPipelinePercent = (status) => {
  const stage = getPipelineStage(status);
  if (stage === 0) return 0;
  return Math.round((stage / 5) * 100);
};

const emptyEditForm = {
  firstName: '',
  middleName: '',
  lastName: '',
  bio: '',
  departmentId: '',
  programId: '',
};

const HighlightStat = ({ label, value, icon: Icon, accent = 'text-[#3674B5]' }) => (
  <div className="text-center px-3 py-2">
    <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm border border-slate-100 mb-2 ${accent}`}>
      <Icon size={18} />
    </div>
    <p className="text-2xl font-bold text-slate-900 leading-none">{value}</p>
    <p className="text-xs text-slate-500 mt-1.5">{label}</p>
  </div>
);

const PortfolioCard = ({ paper, onClick }) => {
  const isPublished = ['approved', 'published'].includes(paper.status);
  const progress = getPipelinePercent(paper.status);

  return (
    <button
      type="button"
      onClick={onClick}
      className="group text-left w-full rounded-2xl border border-slate-200/80 bg-white overflow-hidden shadow-sm hover:shadow-lg hover:border-[#3674B5]/30 transition-all duration-200 hover:-translate-y-0.5"
    >
      <div className={`h-2 ${isPublished ? 'bg-gradient-to-r from-emerald-400 to-emerald-600' : 'bg-gradient-to-r from-[#3674B5] to-[#578FCA]'}`} />
      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 ${
            isPublished ? 'bg-emerald-50 text-emerald-600' : 'bg-[#3674B5]/10 text-[#3674B5]'
          }`}>
            {isPublished ? <Award size={20} /> : <FileText size={20} />}
          </div>
          <div className="flex flex-wrap gap-1.5 justify-end">
            {paper.is_coauthored && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-violet-50 text-violet-700 border border-violet-200">
                Co-author
              </span>
            )}
            <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase ${getStudentStatusTone(paper.status)}`}>
              {getStudentStatusLabel(paper.status)}
            </span>
          </div>
        </div>

        <h3 className="text-sm font-semibold text-slate-900 line-clamp-2 group-hover:text-[#3674B5] transition-colors min-h-[2.5rem]">
          {paper.title}
        </h3>

        <p className="text-xs text-slate-500 mt-2">
          {formatDate(paper.submission_date || paper.created_at)}
        </p>

        {progress > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
              <span>Review progress</span>
              <span className="font-semibold text-[#3674B5]">{progress}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${isPublished ? 'bg-emerald-500' : 'bg-gradient-to-r from-[#3674B5] to-[#578FCA]'}`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-[#3674B5] opacity-0 group-hover:opacity-100 transition-opacity">
          View submission
          <ChevronRight size={14} />
        </div>
      </div>
    </button>
  );
};

const ImpactTimeline = ({ items, onItemClick, role }) => (
  <div className="relative pl-6">
    <div className="absolute left-[9px] top-2 bottom-2 w-px bg-slate-200" aria-hidden="true" />
    <div className="space-y-5">
      {items.map((item) => {
        if (item.type === 'audit') {
          return (
            <div key={`audit-${item.id}`} className="relative">
              <span className="absolute -left-6 top-1.5 h-[18px] w-[18px] rounded-full bg-slate-200 border-2 border-white shadow-sm flex items-center justify-center">
                <Shield size={9} className="text-slate-600" />
              </span>
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <p className="text-sm font-medium text-slate-900 capitalize">
                  {item.action.replace(/_/g, ' ')}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">{formatDate(item.occurredAt)}</p>
              </div>
            </div>
          );
        }

        const dotColor = REVIEW_ACTION_TONES[item.action] || REVIEW_ACTION_TONES.pending;
        const clickable = !!item.paperId;

        return (
          <button
            key={`${item.type}-${item.id}`}
            type="button"
            disabled={!clickable}
            onClick={() => clickable && onItemClick(item.paperId)}
            className={`relative w-full text-left ${clickable ? 'cursor-pointer' : 'cursor-default'}`}
          >
            <span className={`absolute -left-6 top-1.5 h-[18px] w-[18px] rounded-full ${dotColor} border-2 border-white shadow-sm`} />
            <div className={`rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm ${clickable ? 'hover:border-[#3674B5]/30 hover:shadow-md transition-all' : ''}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900 line-clamp-2">
                    {item.paperTitle || 'Research paper'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {formatDate(item.occurredAt)}
                    {item.reviewerRole ? ` · ${ROLE_LABELS[item.reviewerRole] || item.reviewerRole}` : ''}
                  </p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase text-white shrink-0 ${dotColor}`}>
                  {REVIEW_ACTION_LABELS[item.action] || item.action}
                </span>
              </div>
              {item.comments && (
                <p className="text-xs text-slate-600 mt-2 line-clamp-2 italic">&ldquo;{item.comments}&rdquo;</p>
              )}
            </div>
          </button>
        );
      })}
    </div>
  </div>
);

const ProfileDashboard = () => {
  const { user, updateProfile, reloadUser } = useAuth();
  const navigate = useNavigate();
  const role = user?.role || 'student';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profileStats, setProfileStats] = useState(null);
  const [activity, setActivity] = useState({ stats: {}, items: [] });
  const [studentPapers, setStudentPapers] = useState([]);
  const [assignedPapers, setAssignedPapers] = useState([]);
  const [paperFilter, setPaperFilter] = useState('all');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const [showEditModal, setShowEditModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState(emptyEditForm);
  const [departments, setDepartments] = useState([]);
  const [programs, setPrograms] = useState([]);

  const loadProfileData = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);

    try {
      const requests = [
        researchAPI.getProfileData(),
        authAPI.getProfileActivity({ limit: 50 }),
      ];

      if (role === 'student') requests.push(researchAPI.getMyResearch());
      if (role === 'faculty') requests.push(researchAPI.getFacultyAssignedPapers());

      const [profileRes, activityRes, extraRes] = await Promise.all(requests);
      const profilePayload = unwrapApiData(profileRes);
      const activityPayload = unwrapApiData(activityRes);

      setProfileStats(profilePayload.stats || null);
      setActivity({ stats: activityPayload.stats || {}, items: activityPayload.items || [] });

      if (role === 'student' && extraRes) {
        setStudentPapers(unwrapApiData(extraRes).papers || []);
      }
      if (role === 'faculty' && extraRes) {
        const assigned = unwrapApiData(extraRes);
        setAssignedPapers(assigned.papers || assigned || []);
      }
    } catch (error) {
      console.error('Failed to load profile data:', error);
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [role]);

  useEffect(() => {
    loadProfileData();
  }, [loadProfileData]);

  useEffect(() => {
    if (!showEditModal) return undefined;

    const loadDepartments = async () => {
      try {
        const response = await departmentAPI.getAllDepartments();
        setDepartments(unwrapApiData(response).departments || []);
      } catch (error) {
        console.error('Failed to load departments:', error);
      }
    };

    loadDepartments();
    return undefined;
  }, [showEditModal]);

  useEffect(() => {
    if (!showEditModal || !editForm.departmentId) {
      setPrograms([]);
      return undefined;
    }

    const loadPrograms = async () => {
      try {
        const response = await departmentAPI.getProgramsByDepartment(editForm.departmentId);
        setPrograms(unwrapApiData(response).programs || []);
      } catch (error) {
        console.error('Failed to load programs:', error);
        setPrograms([]);
      }
    };

    loadPrograms();
    return undefined;
  }, [editForm.departmentId, showEditModal]);

  const openEditModal = () => {
    setEditForm({
      firstName: user?.firstName || '',
      middleName: user?.middleName || '',
      lastName: user?.lastName || '',
      bio: user?.bio || '',
      departmentId: user?.departmentId || '',
      programId: user?.programId || '',
    });
    setShowEditModal(true);
  };

  const handleSaveProfile = async () => {
    if (!editForm.firstName.trim() || !editForm.lastName.trim()) {
      toast.error('First and last name are required');
      return;
    }
    if (editForm.bio.length > 200) {
      toast.error('Bio must be 200 characters or fewer');
      return;
    }

    setSaving(true);
    const result = await updateProfile({
      firstName: editForm.firstName.trim(),
      middleName: editForm.middleName.trim(),
      lastName: editForm.lastName.trim(),
      bio: editForm.bio.trim() || null,
      departmentId: editForm.departmentId || null,
      programId: ['student', 'program_chair'].includes(role) ? (editForm.programId || null) : null,
    });
    setSaving(false);

    if (result.success) {
      toast.success('Profile updated');
      setShowEditModal(false);
    } else {
      toast.error(result.error || 'Failed to update profile');
    }
  };

  const authoredPapers = useMemo(
    () => studentPapers.filter((paper) => !paper.is_coauthored),
    [studentPapers]
  );
  const coAuthoredPapers = useMemo(
    () => studentPapers.filter((paper) => paper.is_coauthored),
    [studentPapers]
  );
  const publishedPapers = useMemo(
    () => studentPapers.filter((paper) => ['approved', 'published'].includes(paper.status)),
    [studentPapers]
  );

  const filteredStudentPapers = useMemo(() => {
    if (paperFilter === 'authored') return authoredPapers;
    if (paperFilter === 'coauthored') return coAuthoredPapers;
    if (paperFilter === 'published') return publishedPapers;
    return studentPapers;
  }, [authoredPapers, coAuthoredPapers, publishedPapers, paperFilter, studentPapers]);

  const visibleStudentPapers = useMemo(
    () => filteredStudentPapers.slice(0, visibleCount),
    [filteredStudentPapers, visibleCount]
  );

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [paperFilter, studentPapers.length]);

  const highlights = useMemo(() => {
    const s = activity.stats || {};
    const legacy = profileStats || {};

    if (role === 'student') {
      return [
        { key: 'submitted', label: 'Submissions', value: s.submitted ?? legacy.uploadedCount ?? 0, icon: FileText },
        { key: 'published', label: 'Published', value: s.published ?? legacy.publishedCount ?? 0, icon: Award, accent: 'text-emerald-600' },
        { key: 'coauthored', label: 'Collaborations', value: s.coAuthored ?? 0, icon: UserPlus, accent: 'text-violet-600' },
        { key: 'invites', label: 'Open invites', value: s.pendingInvites ?? 0, icon: Mail, accent: 'text-amber-600' },
      ];
    }

    if (role === 'admin') {
      return [
        { key: 'actions', label: 'Actions logged', value: s.totalActions ?? 0, icon: Shield },
        { key: 'approved', label: 'Approved', value: s.papersApproved ?? 0, icon: CheckCircle2, accent: 'text-emerald-600' },
        { key: 'reviews', label: 'Reviews', value: s.reviewsCompleted ?? 0, icon: FileText },
        { key: 'records', label: 'Records', value: legacy.totalRecords ?? 0, icon: BookOpen, accent: 'text-indigo-600' },
      ];
    }

    return [
      { key: 'reviews', label: 'Reviews done', value: s.totalReviews ?? legacy.totalRecords ?? 0, icon: FileText },
      { key: 'approved', label: 'Approved', value: s.approved ?? 0, icon: CheckCircle2, accent: 'text-emerald-600' },
      { key: 'revisions', label: 'Revisions', value: s.revisionRequired ?? 0, icon: AlertCircle, accent: 'text-orange-600' },
      { key: 'pending', label: 'In queue', value: s.pendingAssigned ?? 0, icon: Clock3, accent: 'text-amber-600' },
    ];
  }, [activity.stats, profileStats, role]);

  const reviewDetailPath = (paperId) => {
    if (role === 'faculty') return `/faculty/review/${paperId}`;
    if (role === 'dean') return `/dean/review/${paperId}`;
    if (role === 'program_chair') return `/program-chair/review/${paperId}`;
    if (role === 'staff') return `/staff/review/${paperId}`;
    if (role === 'admin') return `/admin/review/${paperId}`;
    return `/student/my-research/${paperId}`;
  };

  const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.fullName || user?.email || 'User')}&background=3674B5&color=fff&size=256&bold=true`;

  if (loading) {
    return (
      <div className="profile-screen flex flex-col items-center justify-center min-h-[100svh] bg-slate-50/50">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-[#3674B5]/20 rounded-full" />
          <div className="absolute top-0 left-0 w-16 h-16 border-4 border-[#3674B5] border-t-transparent rounded-full animate-spin" />
        </div>
        <p className="mt-5 text-sm font-medium text-slate-500">Preparing your profile…</p>
      </div>
    );
  }

  return (
    <div className="profile-screen min-h-[100svh] w-full bg-slate-50/50 animate-fadeIn flex flex-col">
      {/* Hero — NU building background (building visible on the right) */}
      <div className="profile-hero">
        <img
          src={nuBuildingImg}
          alt=""
          aria-hidden="true"
          className="profile-hero__photo"
        />
        {/* Mobile: bottom scrim only — building visible in upper area */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/92 via-slate-900/50 to-transparent pointer-events-none sm:hidden" />
        {/* Tablet+: left scrim; right side shows the NU building */}
        <div
          className="absolute inset-0 pointer-events-none hidden sm:block"
          style={{
            background: 'linear-gradient(105deg, rgb(15 23 42 / 0.88) 0%, rgb(28 77 141 / 0.72) 38%, rgb(54 116 181 / 0.35) 58%, transparent 72%)',
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/75 via-slate-900/10 to-transparent pointer-events-none hidden sm:block" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-transparent pointer-events-none" />

        <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 pt-6 sm:pt-8 pb-24 sm:pb-28 lg:pb-32 min-h-[22rem] sm:min-h-[26rem] lg:min-h-[30rem] flex flex-col">
          <div className="flex justify-end gap-2 mb-auto sm:mb-6">
            <button
              type="button"
              onClick={() => loadProfileData(true)}
              disabled={refreshing}
              className="h-9 px-3 rounded-lg bg-black/35 backdrop-blur-md text-white text-xs font-medium hover:bg-black/45 inline-flex items-center gap-1.5 transition-colors disabled:opacity-50 border border-white/25 shadow-sm"
            >
              <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </button>
            <button
              type="button"
              onClick={() => setShowPasswordModal(true)}
              className="h-9 px-3 rounded-lg bg-black/35 backdrop-blur-md text-white text-xs font-medium hover:bg-black/45 inline-flex items-center gap-1.5 transition-colors border border-white/25 shadow-sm"
            >
              <KeyRound size={13} />
              Change password
            </button>
            <button
              type="button"
              onClick={() => setShowRecoveryModal(true)}
              className="h-9 px-3 rounded-lg bg-black/35 backdrop-blur-md text-white text-xs font-medium hover:bg-black/45 inline-flex items-center gap-1.5 transition-colors border border-white/25 shadow-sm"
            >
              <Shield size={13} />
              {user?.hasRecoveryEmail ? 'Recovery email' : 'Set recovery email'}
            </button>
            <button
              type="button"
              onClick={() => setShowEmailModal(true)}
              className="h-9 px-3 rounded-lg bg-black/35 backdrop-blur-md text-white text-xs font-medium hover:bg-black/45 inline-flex items-center gap-1.5 transition-colors border border-white/25 shadow-sm"
            >
              <Mail size={13} />
              Change email
            </button>
            <button
              type="button"
              onClick={openEditModal}
              className="h-9 px-3 rounded-lg bg-white text-[#3674B5] text-xs font-semibold hover:bg-blue-50 inline-flex items-center gap-1.5 transition-colors shadow-md"
            >
              <Edit3 size={13} />
              Edit profile
            </button>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 lg:gap-10 mt-auto w-full">
            <div className="flex flex-col sm:flex-row sm:items-end gap-5 sm:gap-6 min-w-0 lg:max-w-[58%]">
              <img
                src={avatarUrl}
                alt=""
                className="w-20 h-20 sm:w-24 sm:h-24 lg:w-28 lg:h-28 rounded-2xl border-4 border-white shadow-xl shrink-0 mx-auto sm:mx-0"
              />
              <div className="min-w-0 text-white pb-1 text-center sm:text-left drop-shadow-sm">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-2">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/15 backdrop-blur-md border border-white/25 shadow-sm">
                    <Sparkles size={11} />
                    {ROLE_LABELS[role] || role}
                  </span>
                  {user?.createdAt && (
                    <span className="inline-flex items-center gap-1 text-xs text-white/90">
                      <Calendar size={12} />
                      Since {formatDate(user.createdAt)}
                    </span>
                  )}
                </div>
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight break-words [text-shadow:0_2px_12px_rgba(0,0,0,0.45)]">
                  {user?.fullName || 'Researcher'}
                </h1>
                <p className="text-sm sm:text-base text-white/90 mt-1.5 max-w-xl mx-auto sm:mx-0 [text-shadow:0_1px_8px_rgba(0,0,0,0.35)]">
                  {user?.bio || ROLE_TAGLINES[role] || 'NUCLEUS research community member'}
                </p>
                <div className="flex flex-wrap justify-center sm:justify-start gap-x-4 gap-y-1.5 mt-3 text-xs sm:text-sm text-white/85">
                  {user?.email && (
                    <span className="inline-flex items-center gap-1 max-w-full">
                      <Mail size={12} className="shrink-0" />
                      <span className="truncate">Login: {user.email}</span>
                    </span>
                  )}
                  {user?.hasRecoveryEmail ? (
                    <span className="inline-flex items-center gap-1 max-w-full">
                      <Shield size={12} className="shrink-0" />
                      <span className="truncate">Recovery: {user.recoveryEmail}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-amber-100">
                      <AlertCircle size={12} className="shrink-0" />
                      No recovery email — password reset unavailable
                    </span>
                  )}
                  {user?.department && (
                    <span className="inline-flex items-center gap-1">
                      <GraduationCap size={12} className="shrink-0" />
                      {user.department}
                    </span>
                  )}
                  {user?.program && (
                    <span className="inline-flex items-center gap-1">
                      <BookOpen size={12} className="shrink-0" />
                      {user.program}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Spacer keeps building visible on wide screens */}
            <div className="hidden lg:block flex-1 min-w-[12rem]" aria-hidden="true" />
          </div>
        </div>
      </div>

      {/* Highlights card overlapping hero */}
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 -mt-14 sm:-mt-16 lg:-mt-20 relative z-10">
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-lg overflow-hidden">
          <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-slate-100">
            {highlights.map((item) => (
              <HighlightStat key={item.key} {...item} />
            ))}
          </div>
        </div>
      </div>

      {/* Main showcase sections */}
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-8 sm:py-10 lg:py-12 space-y-10 flex-1">

        {!user?.hasRecoveryEmail && (
          <div className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="h-11 w-11 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                <Shield size={20} className="text-amber-700" />
              </span>
              <div>
                <p className="text-sm font-semibold text-amber-900">Add a recovery email to enable password reset</p>
                <p className="text-xs text-amber-800/80 mt-0.5">
                  Your institutional email may not receive mail. Add a personal inbox in Profile so reset codes reach you.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowRecoveryModal(true)}
              className="h-10 px-4 rounded-xl bg-amber-700 text-white text-sm font-semibold hover:bg-amber-800 shrink-0"
            >
              Set recovery email
            </button>
          </div>
        )}

        {/* Student portfolio */}
        {role === 'student' && (
          <>
            {(activity.stats?.pendingInvites || 0) > 0 && (
              <button
                type="button"
                onClick={() => navigate('/student/co-author-invitations')}
                className="w-full rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-left hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-3">
                  <span className="h-11 w-11 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                    <UserPlus size={20} className="text-amber-700" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-amber-900">
                      {activity.stats.pendingInvites} co-author invitation{activity.stats.pendingInvites > 1 ? 's' : ''} awaiting you
                    </p>
                    <p className="text-xs text-amber-800/70 mt-0.5">Join a collaboration and expand your research portfolio</p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-800 shrink-0">
                  Respond now
                  <ChevronRight size={14} />
                </span>
              </button>
            )}

            <section>
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-5">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Research portfolio</h2>
                  <p className="text-sm text-slate-500 mt-0.5">Your submissions and collaborations on NUCLEUS</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { key: 'all', label: 'All work' },
                    { key: 'authored', label: 'My papers' },
                    { key: 'coauthored', label: 'Collaborations' },
                    { key: 'published', label: 'Published' },
                  ].map((filter) => (
                    <button
                      key={filter.key}
                      type="button"
                      onClick={() => setPaperFilter(filter.key)}
                      className={`h-8 px-3 rounded-full text-xs font-semibold transition-colors ${
                        paperFilter === filter.key
                          ? 'bg-[#3674B5] text-white shadow-sm'
                          : 'bg-white border border-slate-200 text-slate-600 hover:border-[#3674B5]/30'
                      }`}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>

              {filteredStudentPapers.length === 0 ? (
                <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white px-6 py-16 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-[#3674B5]/10 flex items-center justify-center mx-auto mb-4">
                    <FileText size={28} className="text-[#3674B5]" />
                  </div>
                  <h3 className="text-base font-semibold text-slate-900">Your portfolio is ready for its first paper</h3>
                  <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
                    Submit your research to start building your academic showcase on NUCLEUS.
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate('/student/submit')}
                    className="mt-5 h-10 px-5 rounded-xl bg-[#3674B5] text-white text-sm font-semibold hover:bg-[#2d6299] inline-flex items-center gap-2 transition-colors"
                  >
                    Submit your first paper
                    <ChevronRight size={16} />
                  </button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {visibleStudentPapers.map((paper) => (
                      <PortfolioCard
                        key={paper.id}
                        paper={paper}
                        onClick={() => navigate(`/student/my-research/${paper.id}`)}
                      />
                    ))}
                  </div>
                  <LoadMoreFooter
                    visibleCount={visibleStudentPapers.length}
                    totalCount={filteredStudentPapers.length}
                    canLoadMore={visibleCount < filteredStudentPapers.length}
                    onLoadMore={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
                    step={PAGE_SIZE}
                    label="papers"
                  />
                </>
              )}
            </section>
          </>
        )}

        {/* Faculty active reviews */}
        {role === 'faculty' && assignedPapers.length > 0 && (
          <section>
            <div className="mb-5">
              <h2 className="text-lg font-bold text-slate-900">Active advisement</h2>
              <p className="text-sm text-slate-500 mt-0.5">Papers currently in your review queue</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {assignedPapers.slice(0, 6).map((paper) => (
                <button
                  key={paper.id}
                  type="button"
                  onClick={() => navigate(reviewDetailPath(paper.id))}
                  className="group rounded-xl border border-slate-200 bg-white p-4 text-left hover:border-[#3674B5]/30 hover:shadow-md transition-all"
                >
                  <div className="flex items-start gap-3">
                    <span className="h-10 w-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                      <Clock3 size={18} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900 line-clamp-2 group-hover:text-[#3674B5] transition-colors">
                        {paper.title}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">{reviewStatusLabel(paper.status)}</p>
                    </div>
                    <ChevronRight size={16} className="text-slate-300 group-hover:text-[#3674B5] shrink-0 mt-1 transition-colors" />
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Reviewer / admin impact timeline */}
        {role !== 'student' && (
          <section>
            <div className="mb-6">
              <h2 className="text-lg font-bold text-slate-900">
                {role === 'admin' ? 'Impact & activity' : 'Review impact'}
              </h2>
              <p className="text-sm text-slate-500 mt-0.5">
                {role === 'admin'
                  ? 'Your contributions to system governance and approvals'
                  : 'A timeline of decisions and actions you have made'}
              </p>
            </div>

            {activity.items.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white px-6 py-14 text-center">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
                  <Sparkles size={22} className="text-slate-400" />
                </div>
                <p className="text-sm font-medium text-slate-700">Your impact story starts here</p>
                <p className="text-xs text-slate-500 mt-1">Actions you take will appear in this timeline</p>
              </div>
            ) : (
              <ImpactTimeline
                items={activity.items.slice(0, 12)}
                role={role}
                onItemClick={(paperId) => navigate(reviewDetailPath(paperId))}
              />
            )}
          </section>
        )}
      </div>

      {/* Change password modal */}
      {showPasswordModal && (
        <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />
      )}

      {/* Change email modal */}
      {showEmailModal && (
        <ChangeEmailModal
          user={user}
          onClose={() => setShowEmailModal(false)}
          onUpdated={reloadUser}
        />
      )}

      {/* Recovery email modal */}
      {showRecoveryModal && (
        <ChangeRecoveryEmailModal
          user={user}
          onClose={() => setShowRecoveryModal(false)}
          onUpdated={reloadUser}
        />
      )}

      {/* Edit profile modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close edit profile"
            onClick={() => setShowEditModal(false)}
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
          />
          <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden animate-fadeIn">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-[#3674B5]/5 to-transparent">
              <div>
                <h3 className="font-semibold text-slate-900">Edit your profile</h3>
                <p className="text-xs text-slate-500 mt-0.5">Update how you appear on NUCLEUS</p>
              </div>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="h-9 w-9 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 inline-flex items-center justify-center"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-3 max-h-[70vh] overflow-y-auto">
              <div>
                <label htmlFor="profile-first-name" className="block text-xs font-semibold text-slate-600 mb-1">First name</label>
                <input
                  id="profile-first-name"
                  type="text"
                  value={editForm.firstName}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, firstName: e.target.value }))}
                  className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#3674B5]/30"
                />
              </div>
              <div>
                <label htmlFor="profile-middle-name" className="block text-xs font-semibold text-slate-600 mb-1">Middle name</label>
                <input
                  id="profile-middle-name"
                  type="text"
                  value={editForm.middleName}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, middleName: e.target.value }))}
                  className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#3674B5]/30"
                />
              </div>
              <div>
                <label htmlFor="profile-last-name" className="block text-xs font-semibold text-slate-600 mb-1">Last name</label>
                <input
                  id="profile-last-name"
                  type="text"
                  value={editForm.lastName}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, lastName: e.target.value }))}
                  className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#3674B5]/30"
                />
              </div>
              <div>
                <label htmlFor="profile-bio" className="block text-xs font-semibold text-slate-600 mb-1">Bio</label>
                <textarea
                  id="profile-bio"
                  value={editForm.bio}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, bio: e.target.value }))}
                  rows={3}
                  maxLength={200}
                  placeholder="Tell others about your research interests…"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#3674B5]/30"
                />
                <p className="text-[10px] text-slate-400 mt-1 text-right">{editForm.bio.length}/200</p>
              </div>
              <div>
                <label htmlFor="profile-department" className="block text-xs font-semibold text-slate-600 mb-1">Department</label>
                <select
                  id="profile-department"
                  value={editForm.departmentId}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, departmentId: e.target.value, programId: '' }))}
                  className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#3674B5]/30"
                >
                  <option value="">Select department</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
                </select>
              </div>
              {['student', 'program_chair'].includes(role) && (
                <div>
                  <label htmlFor="profile-program" className="block text-xs font-semibold text-slate-600 mb-1">Program</label>
                  <select
                    id="profile-program"
                    value={editForm.programId}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, programId: e.target.value }))}
                    disabled={!editForm.departmentId}
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#3674B5]/30 disabled:opacity-50"
                  >
                    <option value="">Select program</option>
                    {programs.map((prog) => (
                      <option key={prog.id} value={prog.id}>{prog.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="px-5 py-4 border-t border-slate-100 flex gap-2">
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="flex-1 h-10 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveProfile}
                disabled={saving}
                className="flex-1 h-10 rounded-xl bg-[#3674B5] text-white text-sm font-semibold hover:bg-[#2d6299] disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save profile'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileDashboard;
