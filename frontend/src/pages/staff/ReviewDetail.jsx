import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import { 
  ArrowLeft, 
  FileText, 
  User, 
  Calendar, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Shield,
  BookOpen,
  Tag,
  Clock,
  FileCheck,
  ShieldCheck,
  BarChart3,
  Eye,
  Maximize2,
  MessageSquarePlus,
  Highlighter,
  StickyNote,
  Trash2,
  MessageSquare,
  CornerDownRight
} from 'lucide-react';
import { researchAPI } from '../../utils/api';
import supabase from '../../config/supabase';
import SecurePDFViewer from '../../components/pdf/SecurePDFViewer';
import { formatFullName } from '../../utils/names';

const ReviewDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [paper, setPaper] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showRevisionModal, setShowRevisionModal] = useState(false);
  const [showReturnToAuthorModal, setShowReturnToAuthorModal] = useState(false);
  const [showMetadataModal, setShowMetadataModal] = useState(false);
  const [comments, setComments] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectionCategory, setRejectionCategory] = useState('methodology');
  const [revisionNotes, setRevisionNotes] = useState('');
  const [returnToAuthorNotes, setReturnToAuthorNotes] = useState('');
  const [metadataForm, setMetadataForm] = useState({
    title: '',
    abstract: '',
    keywords: '',
    category: '',
    coAuthors: '',
  });
  const [deanChairList, setDeanChairList] = useState([]);
  const [selectedTargetId, setSelectedTargetId] = useState('');
  const [selectedTargetRole, setSelectedTargetRole] = useState('');
  const [showBypassModal, setShowBypassModal] = useState(false);
  const [bypassReason, setBypassReason] = useState('');
  const [bypassTarget, setBypassTarget] = useState('approved');
  const [showDeadlineModal, setShowDeadlineModal] = useState(false);
  const [deadlineValue, setDeadlineValue] = useState('');
  const [showAssignFacultyModal, setShowAssignFacultyModal] = useState(false);
  const [facultyMembers, setFacultyMembers] = useState([]);
  const [selectedFacultyId, setSelectedFacultyId] = useState('');
  const [assignNotes, setAssignNotes] = useState('');
  const [plagiarism, setPlagiarism] = useState({
    status: 'not_checked',
    score: null,
    checkedAt: null,
    provider: null,
    summary: null,
    report: null,
  });
  const [plagiarismLoading, setPlagiarismLoading] = useState(false);
  const [annotations, setAnnotations] = useState([]);
  const [replyingToId, setReplyingToId] = useState(null);
  const [replyText, setReplyText] = useState('');

  const getApiErrorMessage = (error, fallback) => {
    const payload = error?.response?.data;
    if (typeof payload?.error === 'string' && payload.error.trim()) return payload.error;
    if (typeof payload?.error?.message === 'string' && payload.error.message.trim()) return payload.error.message;
    if (typeof payload?.message === 'string' && payload.message.trim()) return payload.message;
    if (typeof error?.message === 'string' && error.message.trim()) return error.message;
    return fallback;
  };

  // Fetch Dean/Program Chair members when adviser is reviewing
  useEffect(() => {
    if (user?.role === 'faculty') {
      researchAPI.getDeanChairMembers()
        .then(res => setDeanChairList(res.data.members || []))
        .catch(err => console.error('Failed to fetch dean/chair members:', err));
    }
  }, [user]);

  useEffect(() => {
    fetchPaperDetail();
    
    // Auto-refresh every 10 seconds for real-time updates
    const interval = setInterval(() => {
      fetchPaperDetail();
    }, 10000);
    
    return () => clearInterval(interval);
  }, [id]);

  useEffect(() => {
    if (!id || !supabase) return;

    const channel = supabase
      .channel(`research_comments:${id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'research_comments',
          filter: `research_id=eq.${id}`,
        },
        async () => {
          try {
            const response = await researchAPI.getAnnotations(id);
            setAnnotations(response.data.annotations || []);
          } catch (error) {
            console.error('Realtime annotation refresh failed:', error);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  useEffect(() => {
    const canAssignBackToFaculty = ['dean', 'program_chair'].includes(user?.role);
    if (!canAssignBackToFaculty) return;

    const loadFaculty = async () => {
      try {
        const scoped = await researchAPI.getFacultyMembers(paper?.department || undefined);
        let members = scoped?.data?.facultyMembers || [];

        if ((!members || members.length === 0) && paper?.department) {
          const fallback = await researchAPI.getFacultyMembers();
          members = fallback?.data?.facultyMembers || [];
        }

        setFacultyMembers(members);
      } catch (err) {
        console.error('Failed to load faculty members:', err);
      }
    };

    loadFaculty();
  }, [paper?.department, user?.role]);

  const fetchPaperDetail = async () => {
    try {
      const response = await researchAPI.getResearchById(id);
      setPaper(response.data.paper);
      setMetadataForm({
        title: response.data.paper?.title || '',
        abstract: response.data.paper?.abstract || '',
        keywords: (response.data.paper?.keywords || []).join(', '),
        category: response.data.paper?.category || '',
        coAuthors: response.data.paper?.co_authors || '',
      });

      const annotationResponse = await researchAPI.getAnnotations(id);
      setAnnotations(annotationResponse.data.annotations || []);

      if (['staff', 'admin'].includes(user?.role)) {
        try {
          const plagResponse = await researchAPI.getPlagiarismReport(id);
          setPlagiarism(plagResponse?.data?.plagiarism || {
            status: 'not_checked',
            score: null,
            checkedAt: null,
            provider: null,
            summary: null,
            report: null,
          });
        } catch (plagError) {
          console.error('Failed to fetch plagiarism report:', plagError);
        }
      }
    } catch (error) {
      console.error('Failed to fetch paper:', error);
    } finally {
      setLoading(false);
    }
  };

  const canAnnotate = ['faculty', 'dean', 'program_chair', 'staff', 'admin'].includes(user?.role);

  // Called from SecurePDFViewer toolbar (highlight or sticky note)
  const handleAddAnnotationFromViewer = useCallback(async ({ annotationType, selectedText, pageNumber: pg, highlightColor: color, note }) => {
    try {
      await researchAPI.addAnnotation(id, {
        note: note || (annotationType === 'highlight' ? 'Highlighted text' : ''),
        pageNumber: pg || null,
        selectedText: selectedText || '',
        annotationType,
        highlightColor: annotationType === 'highlight' ? (color || 'yellow') : null,
      });
      const res = await researchAPI.getAnnotations(id);
      setAnnotations(res.data.annotations || []);
      toast.success(annotationType === 'highlight' ? 'Highlight added ✨' : 'Note added 📝');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to save annotation'));
    }
  }, [id]);

  const handleDeleteAnnotation = useCallback(async (annotationId) => {
    try {
      await researchAPI.deleteAnnotation(id, annotationId);
      setAnnotations(prev => prev.filter(a => a.id !== annotationId));
      toast.success('Annotation removed');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to delete annotation'));
    }
  }, [id]);

  const handleSubmitReply = useCallback(async (annotation) => {
    const trimmed = replyText.trim();
    if (!trimmed) return;

    try {
      await researchAPI.addAnnotation(id, {
        note: trimmed,
        pageNumber: annotation.pageNumber || null,
        selectedText: '',
        annotationType: 'comment',
        highlightColor: null,
        parentId: annotation.id,
      });
      const res = await researchAPI.getAnnotations(id);
      setAnnotations(res.data.annotations || []);
      setReplyingToId(null);
      setReplyText('');
      toast.success('Reply posted');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to post reply'));
    }
  }, [id, replyText]);

  const handleApprove = async () => {
    if (!comments.trim()) {
      toast.error('Please provide approval comments', { icon: '📝' });
      return;
    }

    // Adviser must pick a Dean or Program Chair
    if (user?.role === 'faculty' && (!selectedTargetId || !selectedTargetRole)) {
      toast.error('Please select a Dean or Program Chair to forward the paper to', { icon: '👤' });
      return;
    }
    setActionLoading(true);
    const loadingToast = toast.loading('Processing approval...');
    try {
      const annotationSummary = annotations.length > 0
        ? `\n\n[Annotation Summary]\n${annotations.map((item, index) => `${index + 1}. ${item.pageNumber ? `Page ${item.pageNumber}: ` : ''}${item.note}`).join('\n')}`
        : '';

      const extra = user?.role === 'faculty' && selectedTargetId
        ? { targetUserId: selectedTargetId, targetRole: selectedTargetRole }
        : {};
      const response = await researchAPI.approveResearch(id, `${comments}${annotationSummary}`, extra);
      toast.success('Research approved successfully! 🎉', { id: loadingToast, duration: 3000 });
      const reviewPath = user?.role === 'faculty' ? '/faculty/review'
        : ['dean', 'program_chair'].includes(user?.role) ? '/dean/review'
        : user?.role === 'admin' ? '/admin/papers' : '/staff/review';
      navigate(reviewPath);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to approve research'), { id: loadingToast });
    } finally {
      setActionLoading(false);
      setShowApproveModal(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toast.error('Please provide a rejection reason', {
        icon: '⚠️',
      });
      return;
    }
    setActionLoading(true);
    const loadingToast = toast.loading('Processing rejection...');
    try {
      const annotationSummary = annotations.length > 0
        ? `\n\n[Annotation Summary]\n${annotations.map((item, index) => `${index + 1}. ${item.pageNumber ? `Page ${item.pageNumber}: ` : ''}${item.note}`).join('\n')}`
        : '';
      await researchAPI.rejectResearch(id, `${rejectionReason}${annotationSummary}`, rejectionCategory);
      toast.success('Research rejected', { id: loadingToast, icon: '❌' });
      const reviewPath = user?.role === 'faculty' ? '/faculty/review'
        : ['dean', 'program_chair'].includes(user?.role) ? '/dean/review'
        : user?.role === 'admin' ? '/admin/papers' : '/staff/review';
      navigate(reviewPath);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to reject research'), { id: loadingToast });
    } finally {
      setActionLoading(false);
      setShowRejectModal(false);
      setRejectionReason('');
      setRejectionCategory('methodology');
    }
  };

  const handleRequestRevision = async () => {
    if (!revisionNotes.trim()) {
      toast.error('Please provide revision notes', {
        icon: '📋',
      });
      return;
    }
    setActionLoading(true);
    const loadingToast = toast.loading('Requesting revision...');
    try {
      const annotationSummary = annotations.length > 0
        ? `\n\n[Annotation Summary]\n${annotations.map((item, index) => `${index + 1}. ${item.pageNumber ? `Page ${item.pageNumber}: ` : ''}${item.note}`).join('\n')}`
        : '';

      console.log('=== Requesting Revision ===');
      console.log('Paper ID:', id);
      console.log('User role:', user?.role);
      console.log('Current paper status:', paper?.status);
      console.log('Revision notes:', revisionNotes);
      
      const response = await researchAPI.requestRevision(id, `${revisionNotes}${annotationSummary}`);
      toast.success('Revision requested successfully! 📝', { id: loadingToast, duration: 3000 });
      const reviewPath = user?.role === 'faculty' ? '/faculty/review'
        : ['dean', 'program_chair'].includes(user?.role) ? '/dean/review'
        : user?.role === 'admin' ? '/admin/papers' : '/staff/review';
      navigate(reviewPath);
    } catch (error) {
      console.error('Failed to request revision:', error);
      toast.error(getApiErrorMessage(error, 'Failed to request revision'), { id: loadingToast });
    } finally {
      setActionLoading(false);
      setShowRevisionModal(false);
    }
  };

  const handleAssignFacultyReviewer = async () => {
    if (!selectedFacultyId) {
      toast.error('Please select a faculty reviewer', { icon: '👤' });
      return;
    }

    setActionLoading(true);
    const loadingToast = toast.loading('Assigning faculty reviewer...');
    try {
      await researchAPI.assignFacultyReviewer(id, selectedFacultyId, assignNotes.trim());
      toast.success('Faculty reviewer assigned successfully', { id: loadingToast });
      setShowAssignFacultyModal(false);
      setAssignNotes('');
      setSelectedFacultyId('');
      navigate('/dean/review');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to assign faculty reviewer'), { id: loadingToast });
    } finally {
      setActionLoading(false);
    }
  };

  const handleSetReviewDeadline = async () => {
    if (!deadlineValue) {
      toast.error('Please select a deadline date and time', { icon: '⏰' });
      return;
    }

    setActionLoading(true);
    const loadingToast = toast.loading('Setting review deadline...');
    try {
      await researchAPI.setProgramChairReviewDeadline(id, new Date(deadlineValue).toISOString());
      toast.success('Review deadline set successfully', { id: loadingToast });
      setShowDeadlineModal(false);
      fetchPaperDetail();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to set review deadline'), { id: loadingToast });
    } finally {
      setActionLoading(false);
    }
  };

  const handleReturnToAuthor = async () => {
    if (!returnToAuthorNotes.trim()) {
      toast.error('Please provide return notes for the author', { icon: '📝' });
      return;
    }

    setActionLoading(true);
    const loadingToast = toast.loading('Returning paper to author...');
    try {
      await researchAPI.returnToAuthor(id, returnToAuthorNotes.trim());
      toast.success('Paper returned to author successfully', { id: loadingToast, duration: 3000 });
      setShowReturnToAuthorModal(false);
      setReturnToAuthorNotes('');
      navigate('/staff/review');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to return paper to author'), { id: loadingToast });
    } finally {
      setActionLoading(false);
    }
  };

  const handleCorrectMetadata = async () => {
    if (!metadataForm.title.trim() || !metadataForm.abstract.trim()) {
      toast.error('Title and abstract are required', { icon: '📝' });
      return;
    }

    setActionLoading(true);
    const loadingToast = toast.loading('Saving metadata corrections...');
    try {
      const payload = {
        title: metadataForm.title.trim(),
        abstract: metadataForm.abstract.trim(),
        keywords: metadataForm.keywords,
        category: metadataForm.category,
        co_authors: metadataForm.coAuthors,
      };

      const response = await researchAPI.correctMetadata(id, payload);
      setPaper(response.data.paper);
      setShowMetadataModal(false);
      toast.success('Metadata corrected successfully', { id: loadingToast, duration: 3000 });
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to correct metadata'), { id: loadingToast });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRunPlagiarismScan = async () => {
    setPlagiarismLoading(true);
    const loadingToast = toast.loading('Running plagiarism scan...');
    try {
      const response = await researchAPI.runPlagiarismScan(id);
      setPlagiarism(response?.data?.plagiarism || plagiarism);
      toast.success('Plagiarism scan completed', { id: loadingToast });
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to run plagiarism scan'), { id: loadingToast });
    } finally {
      setPlagiarismLoading(false);
    }
  };

  const ANNOTATION_TYPES = {
    highlight: { icon: Highlighter, label: 'Highlight', color: 'text-yellow-700', bg: 'bg-yellow-50', border: 'border-yellow-200' },
    note:      { icon: StickyNote,  label: 'Note',      color: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-200'  },
    comment:   { icon: MessageSquare, label: 'Comment', color: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-200'   },
  };
  const HL_COLORS = { yellow: 'bg-yellow-300', red: 'bg-red-300', blue: 'bg-blue-300', green: 'bg-green-300' };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    });
  };

  const getStatusConfig = (status) => {
    const configs = {
      pending: {
        badgeColor: 'bg-gradient-to-r from-yellow-100 to-amber-100 text-yellow-800 border-yellow-200',
        icon: Clock, label: 'Pending Review'
      },
      pending_faculty: {
        badgeColor: 'bg-gradient-to-r from-[#1C4D8D]/10 to-[#2563eb]/10 text-[#1C4D8D] border-[#1C4D8D]/20',
        icon: Clock, label: 'With Adviser'
      },
      pending_dean: {
        badgeColor: 'bg-gradient-to-r from-violet-100 to-purple-50 text-violet-800 border-violet-200',
        icon: Clock, label: 'With Dean'
      },
      pending_program_chair: {
        badgeColor: 'bg-gradient-to-r from-teal-100 to-cyan-50 text-teal-800 border-teal-200',
        icon: Clock, label: 'With Program Chair'
      },
      pending_editor: {
        badgeColor: 'bg-gradient-to-r from-blue-100 to-cyan-100 text-blue-800 border-blue-200',
        icon: Eye, label: 'Awaiting Editor Review'
      },
      pending_admin: {
        badgeColor: 'bg-gradient-to-r from-[#1C4D8D]/10 to-[#2563eb]/10 text-[#1C4D8D] border-[#1C4D8D]/20',
        icon: Shield, label: 'Awaiting Admin Review'
      },
      under_review: {
        badgeColor: 'bg-gradient-to-r from-blue-100 to-cyan-100 text-blue-800 border-blue-200',
        icon: Eye, label: 'Under Review'
      },
      approved: {
        badgeColor: 'bg-gradient-to-r from-green-100 to-emerald-100 text-green-800 border-green-200',
        icon: CheckCircle, label: 'Approved'
      },
      rejected: {
        badgeColor: 'bg-gradient-to-r from-red-100 to-pink-100 text-red-800 border-red-200',
        icon: XCircle, label: 'Rejected'
      },
      revision_required: {
        badgeColor: 'bg-gradient-to-r from-orange-100 to-amber-100 text-orange-800 border-orange-200',
        icon: AlertCircle, label: 'Revision Required'
      }
    };
    return configs[status] || configs.pending;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="relative">
          <div className="w-20 h-20 border-4 border-[#1C4D8D]/20 rounded-full"></div>
          <div className="absolute top-0 left-0 w-20 h-20 border-4 border-[#1C4D8D] border-t-transparent rounded-full animate-spin"></div>
        </div>
        <p className="mt-6 text-lg font-medium text-slate-600 animate-pulse">Loading research details...</p>
      </div>
    );
  }

  if (!paper) {
    const backPath = user?.role === 'faculty' ? '/faculty/review'
                   : ['dean', 'program_chair'].includes(user?.role) ? '/dean/review'
                   : user?.role === 'admin' ? '/admin/papers' : '/staff/review';
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <button onClick={() => navigate(backPath)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-slate-100 to-white border border-slate-300 text-slate-700 hover:border-[#1C4D8D]/30 transition-colors mb-8">
          <ArrowLeft size={18} /> Back to Review Queue
        </button>
        <div className="text-center py-16">
          <FileText size={40} className="text-slate-400 mx-auto mb-6" />
          <h2 className="text-2xl font-bold text-slate-900 mb-3">Research paper not found</h2>
          <button onClick={() => navigate(backPath)} className="px-6 py-3 bg-gradient-to-r from-[#1C4D8D] to-[#2563eb] text-white rounded-xl font-bold">Return to Review Queue</button>
        </div>
      </div>
    );
  }

  const statusConfig = getStatusConfig(paper.status);
  const StatusIcon = statusConfig.icon;
  const backPath = user?.role === 'faculty' ? '/faculty/review'
                 : ['dean', 'program_chair'].includes(user?.role) ? '/dean/review'
                 : user?.role === 'admin' ? '/admin/papers' : '/staff/review';

  // Workflow progress tracker
  const getWorkflowStage = () => {
    const stages = [
      { key: 'adviser', label: 'Adviser Review', statuses: ['pending_faculty'] },
      { key: 'dean_chair', label: 'Dean / Prog. Chair', statuses: ['pending_dean', 'pending_program_chair'] },
      { key: 'editor', label: 'Research Editor', statuses: ['pending_editor'] },
      { key: 'admin', label: 'Admin Review', statuses: ['pending_admin'] },
      { key: 'published', label: 'Published', statuses: ['approved'] }
    ].map(s => ({ ...s, completed: false }));

    const paperStatus = paper.status;
    const stageOrder = ['pending_faculty', 'pending_dean', 'pending_program_chair', 'pending_editor', 'pending_admin', 'approved'];
    const currentIndex = stageOrder.indexOf(paperStatus);

    // Mark advisers stage completed when past pending_faculty
    if (currentIndex > stageOrder.indexOf('pending_faculty')) stages[0].completed = true;
    // Mark dean/chair stage completed when past pending_dean / pending_program_chair
    if (currentIndex > stageOrder.indexOf('pending_editor') - 1 && currentIndex >= stageOrder.indexOf('pending_editor')) stages[1].completed = true;
    if (currentIndex >= stageOrder.indexOf('pending_admin')) stages[2].completed = true;
    if (paperStatus === 'approved') { stages[3].completed = true; stages[4].completed = true; }

    let currentStageIndex = -1;
    if (paperStatus === 'pending_faculty') currentStageIndex = 0;
    else if (paperStatus === 'pending_dean' || paperStatus === 'pending_program_chair') currentStageIndex = 1;
    else if (paperStatus === 'pending_editor') currentStageIndex = 2;
    else if (paperStatus === 'pending_admin') currentStageIndex = 3;
    else if (paperStatus === 'approved') currentStageIndex = 4;

    return { stages, currentStageIndex };
  };

  const { stages, currentStageIndex } = getWorkflowStage();

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <button onClick={() => navigate(backPath)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-slate-100 to-white border border-slate-300 text-slate-700 hover:border-[#1C4D8D]/30 transition-colors mb-6 group">
          <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
          Back to Review Queue
        </button>

        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#1C4D8D] to-[#2563eb] flex items-center justify-center shadow-lg">
              <FileCheck size={28} className="text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-slate-900 mb-2">Review <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#1C4D8D] to-[#2563eb]">Submission</span></h1>
              <div className="flex items-center gap-4">
                <span className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-bold ${statusConfig.badgeColor} border`}>
                  <StatusIcon size={14} /> {statusConfig.label}
                </span>
                <span className="text-sm text-slate-600 font-medium">Submitted {formatDate(paper.submission_date || paper.created_at)}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-slate-50 to-white border border-slate-200">
            <Shield size={16} className="text-[#1C4D8D]" />
            <span className="text-sm font-semibold text-slate-700">Academic Review</span>
          </div>
        </div>
      </div>

      {/* Workflow Progress Indicator - Show for papers in sequential workflow */}
      {(paper.faculty_id || 
        paper.status.includes('pending_faculty') || 
        paper.status.includes('pending_editor') || 
        paper.status.includes('pending_admin') || 
        paper.status === 'approved') && paper.status !== 'rejected' && (
        <div className="mb-8 bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <BarChart3 size={20} className="text-[#1C4D8D]" />
              Review Workflow Progress
            </h3>
          </div>
          <div className="p-6">
            <div className="relative">
              {/* Progress Bar Background */}
              <div className="absolute top-5 left-0 right-0 h-1 bg-slate-200 rounded-full" style={{ left: '24px', right: '24px' }}></div>
              {/* Progress Bar Fill */}
              <div 
                className="absolute top-5 left-0 h-1 bg-gradient-to-r from-[#1C4D8D] to-[#2563eb] rounded-full transition-all duration-500" 
                style={{ 
                  left: '24px', 
                  width: currentStageIndex >= 0 ? `calc(${(currentStageIndex / (stages.length - 1)) * 100}% - 24px)` : '0%'
                }}
              ></div>
              
              {/* Stages */}
              <div className="relative flex justify-between">
                {stages.map((stage, index) => {
                  const isCompleted = stage.completed;
                  const isCurrent = index === currentStageIndex;
                  const isPending = index > currentStageIndex;
                  
                  return (
                    <div key={stage.key} className="flex flex-col items-center">
                      {/* Circle */}
                      <div className={`
                        w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm
                        transition-all duration-300 shadow-lg z-10
                        ${isCompleted ? 'bg-gradient-to-br from-green-500 to-emerald-600 text-white' : ''}
                        ${isCurrent ? 'bg-gradient-to-br from-[#1C4D8D] to-[#2563eb] text-white ring-4 ring-[#1C4D8D]/20 animate-pulse' : ''}
                        ${isPending ? 'bg-white text-slate-400 border-2 border-slate-200' : ''}
                      `}>
                        {isCompleted ? <CheckCircle size={24} /> : 
                         isCurrent ? <Clock size={24} className="animate-spin" style={{ animationDuration: '3s' }} /> : 
                         index + 1}
                      </div>
                      
                      {/* Label */}
                      <div className="mt-3 text-center">
                        <p className={`
                          text-sm font-bold
                          ${isCompleted ? 'text-green-700' : ''}
                          ${isCurrent ? 'text-[#1C4D8D]' : ''}
                          ${isPending ? 'text-slate-400' : ''}
                        `}>
                          {stage.label}
                        </p>
                        {isCurrent && (
                          <p className="text-xs text-[#1C4D8D] mt-1 font-medium animate-pulse">
                            In Progress
                          </p>
                        )}
                        {isCompleted && (
                          <p className="text-xs text-green-600 mt-1 font-medium">
                            Completed ✓
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
            <div className="px-8 py-6 bg-gradient-to-r from-slate-50 to-white border-b border-slate-200 flex items-center gap-3">
              <BookOpen size={20} className="text-[#1C4D8D]" />
              <div>
                <h2 className="text-xl font-bold text-slate-900">Research Details</h2>
                <p className="text-slate-600 text-sm">Full submission and document preview</p>
              </div>
            </div>

            <div className="p-8">
              <h3 className="text-2xl font-bold text-slate-900 mb-6">{paper.title}</h3>

              {/* Author and Timeline info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="flex items-start gap-4 p-4 rounded-xl bg-white border border-slate-200">
                  <User size={20} className="text-blue-600 mt-1" />
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Primary Author</p>
                    <p className="text-lg font-bold text-slate-900">{formatFullName(paper.users) || 'Researcher'}</p>
                    <p className="text-sm text-slate-600">{paper.users?.email}</p>
                  </div>
                </div>
                <div className="flex items-start gap-4 p-4 rounded-xl bg-white border border-slate-200">
                  <Calendar size={20} className="text-[#1C4D8D] mt-1" />
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Submission Date</p>
                    <p className="text-lg font-bold text-slate-900">{formatDate(paper.submission_date || paper.created_at)}</p>
                    <p className="text-sm text-slate-600">Initial Submission</p>
                  </div>
                </div>
              </div>

              {/* Abstract */}
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-4">
                  <FileText size={18} className="text-[#1C4D8D]" />
                  <h4 className="text-lg font-bold text-slate-900">Abstract</h4>
                </div>
                <div className="p-4 rounded-xl bg-white border border-slate-200">
                  <p className="text-slate-700 whitespace-pre-line leading-relaxed">{paper.abstract}</p>
                </div>
              </div>

              {/* PDF PREVIEW SECTION - Editor Style */}
              <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Maximize2 size={18} className="text-[#1C4D8D]" />
                    <h4 className="text-lg font-bold text-slate-900">Document Preview</h4>
                    {canAnnotate && <span className="text-xs text-slate-500 font-medium">🔒 Use toolbar to annotate · Fullscreen button in viewer</span>}
                  </div>
                </div>
                {paper.file_url ? (
                  <SecurePDFViewer
                    fileUrl={paper.file_url}
                    watermarkText="NU"
                    enableAnnotationSelection={canAnnotate}
                    annotations={annotations}
                    onAddAnnotation={canAnnotate ? handleAddAnnotationFromViewer : undefined}
                    onDeleteAnnotation={canAnnotate ? handleDeleteAnnotation : undefined}
                  />
                ) : (
                  <div className="h-[300px] flex flex-col items-center justify-center text-slate-400 gap-2 rounded-2xl border-2 border-slate-200">
                    <XCircle size={40} />
                    <p>Preview not available</p>
                  </div>
                )}
              </div>

              {/* Keywords */}
              {paper.keywords?.length > 0 && (
                <div className="mb-8">
                  <div className="flex items-center gap-2 mb-3">
                    <Tag size={18} className="text-[#1C4D8D]" />
                    <h4 className="text-lg font-bold text-slate-900">Keywords</h4>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {paper.keywords.map((kw, i) => (
                      <span key={i} className="px-4 py-2 rounded-xl bg-[#1C4D8D]/10 text-[#1C4D8D] text-sm font-medium border border-[#1C4D8D]/20">{kw}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Annotation List */}
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-3">
                  <MessageSquarePlus size={18} className="text-[#1C4D8D]" />
                  <h4 className="text-lg font-bold text-slate-900">Review Annotations</h4>
                  {annotations.length > 0 && (
                    <span className="px-2.5 py-0.5 rounded-full bg-[#1C4D8D]/10 text-[#1C4D8D] text-xs font-bold">{annotations.length}</span>
                  )}
                </div>

                {canAnnotate && annotations.length === 0 && (
                  <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 mb-4">
                    <p className="text-sm text-blue-800 font-medium">💡 Use the toolbar above the document to annotate directly:</p>
                    <ul className="mt-1 text-xs text-blue-700 space-y-1">
                      <li className="flex items-center gap-1.5"><Highlighter size={11} /> <strong>Highlight</strong> — select text in the document</li>
                      <li className="flex items-center gap-1.5"><StickyNote size={11} /> <strong>Sticky Note</strong> — click anywhere on the document</li>
                    </ul>
                  </div>
                )}

                <div className="space-y-3">
                  {annotations.length === 0 ? (
                    <div className="text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-4 py-6 text-center">
                      <MessageSquarePlus size={22} className="text-slate-300 mx-auto mb-2" />
                      No annotations yet. Use the toolbar above the document.
                    </div>
                  ) : (() => {
                    const grouped = {};
                    annotations.forEach(a => {
                      const key = a.pageNumber ? `Page ${a.pageNumber}` : 'General';
                      if (!grouped[key]) grouped[key] = [];
                      grouped[key].push(a);
                    });
                    return Object.entries(grouped).map(([pageLabel, pageAnnotations]) => (
                      <div key={pageLabel}>
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">{pageLabel}</div>
                        <div className="space-y-2">
                          {pageAnnotations.filter((annotation) => !annotation.parentId).map(annotation => {
                            const replies = pageAnnotations
                              .filter((item) => item.parentId === annotation.id)
                              .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
                            const tc = ANNOTATION_TYPES[annotation.annotationType] || ANNOTATION_TYPES.comment;
                            const TypeIcon = tc.icon;
                            return (
                              <div key={annotation.id} className={`${tc.bg} border ${tc.border} rounded-lg p-3 group`}>
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-start gap-2 flex-1">
                                    <TypeIcon size={13} className={`${tc.color} mt-0.5 flex-shrink-0`} />
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 mb-1">
                                        <span className={`text-xs font-bold ${tc.color}`}>{tc.label}</span>
                                        {annotation.highlightColor && HL_COLORS[annotation.highlightColor] && (
                                          <span className={`w-3 h-3 rounded-full ${HL_COLORS[annotation.highlightColor]} inline-block`} />
                                        )}
                                        <span className="text-xs text-slate-400">• {annotation.reviewerName}</span>
                                      </div>
                                      {annotation.selectedText && <p className="text-xs text-slate-500 mb-1 italic">"{annotation.selectedText}"</p>}
                                      {annotation.note && <p className="text-sm text-slate-800 whitespace-pre-wrap">{annotation.note}</p>}
                                    </div>
                                  </div>
                                  {(annotation.userId === user?.id || user?.role === 'admin') && (
                                    <button
                                      onClick={() => handleDeleteAnnotation(annotation.id)}
                                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                                      title="Delete"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  )}
                                </div>

                                <div className="mt-2 flex items-center gap-2">
                                  <button
                                    onClick={() => {
                                      if (replyingToId === annotation.id) {
                                        setReplyingToId(null);
                                        setReplyText('');
                                      } else {
                                        setReplyingToId(annotation.id);
                                        setReplyText('');
                                      }
                                    }}
                                    className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-[#1C4D8D]"
                                  >
                                    <CornerDownRight size={12} /> Reply
                                  </button>
                                </div>

                                {replyingToId === annotation.id && (
                                  <div className="mt-2 flex items-center gap-2">
                                    <input
                                      type="text"
                                      value={replyText}
                                      onChange={(e) => setReplyText(e.target.value)}
                                      placeholder="Write a reply..."
                                      className="flex-1 px-3 py-2 border rounded-lg text-sm"
                                    />
                                    <button
                                      onClick={() => handleSubmitReply(annotation)}
                                      className="px-3 py-2 bg-[#1C4D8D] text-white rounded-lg text-xs font-bold"
                                    >
                                      Send
                                    </button>
                                  </div>
                                )}

                                {replies.length > 0 && (
                                  <div className="mt-3 space-y-2 border-l-2 border-slate-200 pl-3">
                                    {replies.map((reply) => (
                                      <div key={reply.id} className="rounded-lg border border-slate-200 bg-white p-2.5">
                                        <div className="flex items-center justify-between gap-2 mb-1">
                                          <span className="text-xs font-bold text-slate-600">{reply.reviewerName}</span>
                                          <span className="text-xs text-slate-400">{new Date(reply.createdAt).toLocaleString()}</span>
                                        </div>
                                        <p className="text-sm text-slate-700 whitespace-pre-wrap">{reply.note}</p>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-8">
          {/* Action Buttons - Role-based visibility */}
          {(() => {
            const userRole = user?.role;
            const paperStatus = paper.status;
            
            // Faculty can act on pending_faculty
            if (userRole === 'faculty' && paperStatus === 'pending_faculty') return true;
            
            // Dean / Program Chair can act on their respective pending status
            if (userRole === 'dean' && paperStatus === 'pending_dean') return true;
            if (userRole === 'program_chair' && paperStatus === 'pending_program_chair') return true;
            
            // Staff can act on pending_editor, pending (legacy), under_review, revision_required
            if (userRole === 'staff' && (paperStatus === 'pending_editor' || paperStatus === 'pending' || paperStatus === 'under_review' || paperStatus === 'revision_required')) return true;
            
            // Admin can act on pending_admin, under_review, revision_required
            if (userRole === 'admin' && (paperStatus === 'pending_admin' || paperStatus === 'under_review' || paperStatus === 'revision_required')) return true;
            
            return false;
          })() && (
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center gap-3">
                <FileCheck size={20} className="text-[#1C4D8D]" />
                <h3 className="font-bold text-slate-900">Review Actions</h3>
              </div>
              <div className="p-6 space-y-4">
                <button onClick={() => setShowApproveModal(true)} className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all font-bold shadow-lg">
                  <CheckCircle size={20} /> Approve Research
                </button>
                <button onClick={() => setShowRevisionModal(true)} className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-amber-600 text-white rounded-xl hover:bg-amber-700 transition-all font-bold shadow-lg">
                  <AlertCircle size={20} /> Request Revision
                </button>

                {user?.role === 'staff' && ['pending_editor', 'under_review', 'pending_admin'].includes(paper.status) && (
                  <button
                    onClick={handleRunPlagiarismScan}
                    disabled={plagiarismLoading}
                    className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-slate-700 text-white rounded-xl hover:bg-slate-800 transition-all font-bold shadow-lg disabled:opacity-60"
                  >
                    <ShieldCheck size={20} /> {plagiarismLoading ? 'Scanning...' : 'Run Plagiarism Scan'}
                  </button>
                )}

                {user?.role === 'staff' && ['pending_editor', 'under_review'].includes(paper.status) && (
                  <button
                    onClick={() => setShowMetadataModal(true)}
                    className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all font-bold shadow-lg"
                  >
                    <FileText size={20} /> Correct Metadata
                  </button>
                )}

                {user?.role === 'staff' && ['pending_editor', 'under_review'].includes(paper.status) && (
                  <button
                    onClick={() => setShowReturnToAuthorModal(true)}
                    className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-fuchsia-600 text-white rounded-xl hover:bg-fuchsia-700 transition-all font-bold shadow-lg"
                  >
                    <CornerDownRight size={20} /> Return to Author
                  </button>
                )}

                {user?.role !== 'program_chair' && (
                  <button onClick={() => setShowRejectModal(true)} className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-all font-bold shadow-lg">
                    <XCircle size={20} /> Reject Paper
                  </button>
                )}

                {['dean', 'program_chair'].includes(user?.role) && ['pending_dean', 'pending_program_chair', 'revision_required'].includes(paper.status) && (
                  <button
                    onClick={() => setShowAssignFacultyModal(true)}
                    className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all font-bold shadow-lg"
                  >
                    <User size={20} /> Assign to Faculty Reviewer
                  </button>
                )}

                {user?.role === 'program_chair' && !['approved', 'published', 'rejected'].includes(paper.status) && (
                  <button
                    onClick={() => {
                      const existing = paper?.review_deadline_at ? new Date(paper.review_deadline_at) : null;
                      const initial = existing && !Number.isNaN(existing.getTime())
                        ? new Date(existing.getTime() - existing.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
                        : '';
                      setDeadlineValue(initial);
                      setShowDeadlineModal(true);
                    }}
                    className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-orange-600 text-white rounded-xl hover:bg-orange-700 transition-all font-bold shadow-lg"
                  >
                    <Clock size={20} /> Set Review Deadline
                  </button>
                )}

                {/* Dean Bypass Button — only shown for Dean role and when paper is NOT at pending_dean */}
                {user?.role === 'dean' && paper.status !== 'pending_dean' && !['approved', 'published'].includes(paper.status) && (
                  <button onClick={() => setShowBypassModal(true)} className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl hover:from-violet-700 hover:to-purple-700 transition-all font-bold shadow-lg mt-2">
                    <Shield size={20} /> Bypass Approve
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Timeline & Stats */}
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6 space-y-6">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <Clock size={20} className="text-[#1C4D8D]" />
              <h3 className="font-bold text-slate-900">Submission Info</h3>
            </div>
            <div className="space-y-4">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500">View Count</span>
                <span className="font-bold text-slate-900">{paper.view_count || 0}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500">Downloads</span>
                <span className="font-bold text-slate-900">{paper.download_count || 0}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500">File Size</span>
                <span className="font-bold text-slate-900">{(paper.file_size / 1024 / 1024).toFixed(2)} MB</span>
              </div>
              {paper.review_deadline_at && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">Review Deadline</span>
                  <span className="font-bold text-orange-700">{new Date(paper.review_deadline_at).toLocaleString()}</span>
                </div>
              )}
            </div>
          </div>

          {['staff', 'admin'].includes(user?.role) && (
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6 space-y-4">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                <ShieldCheck size={20} className="text-slate-700" />
                <h3 className="font-bold text-slate-900">Plagiarism Check</h3>
              </div>
              <div className="text-sm space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Status</span>
                  <span className="font-bold text-slate-900">{plagiarism.status || 'not_checked'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Similarity Score</span>
                  <span className="font-bold text-slate-900">{plagiarism.score === null ? 'N/A' : `${plagiarism.score}%`}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Provider</span>
                  <span className="font-bold text-slate-900">{plagiarism.provider || 'N/A'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Checked At</span>
                  <span className="font-bold text-slate-900">{plagiarism.checkedAt ? new Date(plagiarism.checkedAt).toLocaleString() : 'N/A'}</span>
                </div>
              </div>
              {plagiarism.summary && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-semibold text-slate-500 mb-1">Summary</p>
                  <p className="text-sm text-slate-700">{plagiarism.summary}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modals remain the same as previous logic */}
      {/* Approve Modal */}
      {showApproveModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border">
            <div className="px-6 py-4 bg-emerald-50 border-b border-emerald-100 flex items-center gap-3">
              <CheckCircle size={20} className="text-emerald-600" />
              <h3 className="text-xl font-bold text-slate-900">Approve Research</h3>
            </div>
            <div className="p-6 space-y-4">
              <textarea value={comments} onChange={(e) => setComments(e.target.value)} placeholder="Enter approval comments..." rows={3} className="w-full px-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" />

              {/* Dean / Program Chair picker — only shown for Adviser (faculty) role */}
              {user?.role === 'faculty' && (
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Forward to Dean or Program Chair <span className="text-red-500">*</span>
                  </label>
                  {deanChairList.length === 0 ? (
                    <p className="text-sm text-amber-600">No Dean or Program Chair accounts found. Ask your admin to create one.</p>
                  ) : (
                    <select
                      value={selectedTargetId}
                      onChange={(e) => {
                        const selected = deanChairList.find(m => m.id === e.target.value);
                        setSelectedTargetId(e.target.value);
                        setSelectedTargetRole(selected?.role || '');
                      }}
                      className="w-full px-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900"
                    >
                      <option value="">-- Select reviewer --</option>
                      {deanChairList.map(m => (
                        <option key={m.id} value={m.id}>
                          {formatFullName(m)} ({m.role === 'dean' ? 'Dean' : 'Program Chair'})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={() => setShowApproveModal(false)} className="flex-1 py-3 border rounded-xl font-medium">Cancel</button>
                <button onClick={handleApprove} disabled={actionLoading} className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold">
                  {actionLoading ? 'Processing...' : 'Approve'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border">
            <div className="px-6 py-4 bg-red-50 border-b border-red-100 flex items-center gap-3">
              <XCircle size={20} className="text-red-600" />
              <h3 className="text-xl font-bold text-slate-900">Reject Research</h3>
            </div>
            <div className="p-6">
              <label className="block text-sm font-semibold text-slate-700 mb-2">Rejection Category</label>
              <select
                value={rejectionCategory}
                onChange={(e) => setRejectionCategory(e.target.value)}
                className="w-full px-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-red-500 outline-none mb-3"
              >
                <option value="methodology">Methodology Issue</option>
                <option value="insufficient_evidence">Insufficient Evidence</option>
                <option value="scope_mismatch">Scope Mismatch</option>
                <option value="ethical_concern">Ethical Concern</option>
                <option value="formatting_quality">Formatting/Quality</option>
                <option value="other">Other</option>
              </select>
              <textarea value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} placeholder="Enter rejection reason..." rows={4} className="w-full px-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-red-500 outline-none mb-4" />
              <div className="flex gap-3">
                <button onClick={() => setShowRejectModal(false)} className="flex-1 py-3 border rounded-xl font-medium">Cancel</button>
                <button onClick={handleReject} disabled={actionLoading} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold">
                  {actionLoading ? 'Processing...' : 'Reject'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Revision Modal */}
      {showRevisionModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border">
            <div className="px-6 py-4 bg-amber-50 border-b border-amber-100 flex items-center gap-3">
              <AlertCircle size={20} className="text-amber-600" />
              <h3 className="text-xl font-bold text-slate-900">Request Revision</h3>
            </div>
            <div className="p-6">
              <textarea value={revisionNotes} onChange={(e) => setRevisionNotes(e.target.value)} placeholder="Enter revision notes..." rows={4} className="w-full px-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none mb-4" />
              <div className="flex gap-3">
                <button onClick={() => setShowRevisionModal(false)} className="flex-1 py-3 border rounded-xl font-medium">Cancel</button>
                <button onClick={handleRequestRevision} disabled={actionLoading} className="flex-1 py-3 bg-amber-600 text-white rounded-xl font-bold">
                  {actionLoading ? 'Processing...' : 'Request'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Return to Author Modal */}
      {showReturnToAuthorModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border">
            <div className="px-6 py-4 bg-fuchsia-50 border-b border-fuchsia-100 flex items-center gap-3">
              <CornerDownRight size={20} className="text-fuchsia-600" />
              <h3 className="text-xl font-bold text-slate-900">Return to Author</h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-fuchsia-50 p-3 rounded-xl border border-fuchsia-100">
                <p className="text-sm text-fuchsia-800 font-medium">
                  This will send the paper directly back to the student for revision without rejecting it.
                </p>
              </div>
              <textarea
                value={returnToAuthorNotes}
                onChange={(e) => setReturnToAuthorNotes(e.target.value)}
                placeholder="Enter revision instructions for the author..."
                rows={4}
                className="w-full px-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-fuchsia-500 outline-none"
              />
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowReturnToAuthorModal(false);
                    setReturnToAuthorNotes('');
                  }}
                  className="flex-1 py-3 border rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReturnToAuthor}
                  disabled={actionLoading || !returnToAuthorNotes.trim()}
                  className="flex-1 py-3 bg-fuchsia-600 text-white rounded-xl font-bold disabled:opacity-50"
                >
                  {actionLoading ? 'Returning...' : 'Return to Author'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Correct Metadata Modal */}
      {showMetadataModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border">
            <div className="px-6 py-4 bg-indigo-50 border-b border-indigo-100 flex items-center gap-3">
              <FileText size={20} className="text-indigo-600" />
              <h3 className="text-xl font-bold text-slate-900">Correct Paper Metadata</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Title</label>
                <input
                  value={metadataForm.title}
                  onChange={(e) => setMetadataForm((prev) => ({ ...prev, title: e.target.value }))}
                  className="w-full px-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Abstract</label>
                <textarea
                  value={metadataForm.abstract}
                  onChange={(e) => setMetadataForm((prev) => ({ ...prev, abstract: e.target.value }))}
                  rows={5}
                  className="w-full px-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Keywords</label>
                  <input
                    value={metadataForm.keywords}
                    onChange={(e) => setMetadataForm((prev) => ({ ...prev, keywords: e.target.value }))}
                    placeholder="Comma-separated keywords"
                    className="w-full px-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Category</label>
                  <input
                    value={metadataForm.category}
                    onChange={(e) => setMetadataForm((prev) => ({ ...prev, category: e.target.value }))}
                    className="w-full px-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Co-authors</label>
                <input
                  value={metadataForm.coAuthors}
                  onChange={(e) => setMetadataForm((prev) => ({ ...prev, coAuthors: e.target.value }))}
                  className="w-full px-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowMetadataModal(false)}
                  className="flex-1 py-3 border rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCorrectMetadata}
                  disabled={actionLoading}
                  className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold disabled:opacity-50"
                >
                  {actionLoading ? 'Saving...' : 'Save Corrections'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dean Bypass Modal */}
      {showBypassModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border">
            <div className="px-6 py-4 bg-gradient-to-r from-violet-50 to-purple-50 border-b border-violet-100 flex items-center gap-3">
              <Shield size={20} className="text-violet-600" />
              <h3 className="text-xl font-bold text-slate-900">Bypass Approve (Dean)</h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-amber-50 p-3 rounded-xl border border-amber-200">
                <p className="text-sm text-amber-800 font-medium">⚠️ This action will bypass the normal approval workflow. A mandatory reason is required and will be permanently logged.</p>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Bypass Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={bypassReason}
                  onChange={(e) => setBypassReason(e.target.value)}
                  placeholder="Enter the reason for bypass approval (e.g., Program Chair is on leave)..."
                  rows={3}
                  className="w-full px-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-violet-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Advance To</label>
                <select
                  value={bypassTarget}
                  onChange={(e) => setBypassTarget(e.target.value)}
                  className="w-full px-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-violet-500 outline-none text-slate-900"
                >
                  <option value="approved">Approved (Final)</option>
                  <option value="pending_editor">Research Editor</option>
                  <option value="pending_admin">Admin</option>
                </select>
              </div>
              <div className="flex gap-3">
                <button onClick={() => { setShowBypassModal(false); setBypassReason(''); }} className="flex-1 py-3 border rounded-xl font-medium">Cancel</button>
                <button
                  onClick={async () => {
                    if (!bypassReason.trim()) {
                      const toast = (await import('react-hot-toast')).default;
                      toast.error('Bypass reason is required');
                      return;
                    }
                    setActionLoading(true);
                    const toast = (await import('react-hot-toast')).default;
                    const loadingToast = toast.loading('Processing bypass approval...');
                    try {
                      await researchAPI.deanBypassApprove(id, bypassReason, bypassTarget);
                      toast.success('Paper bypass-approved successfully! ✅', { id: loadingToast, duration: 3000 });
                      navigate('/dean/review');
                    } catch (error) {
                      toast.error(getApiErrorMessage(error, 'Failed to bypass approve'), { id: loadingToast });
                    } finally {
                      setActionLoading(false);
                      setShowBypassModal(false);
                    }
                  }}
                  disabled={actionLoading || !bypassReason.trim()}
                  className="flex-1 py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl font-bold disabled:opacity-50"
                >
                  {actionLoading ? 'Processing...' : 'Bypass Approve'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assign Faculty Modal */}
      {showAssignFacultyModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border">
            <div className="px-6 py-4 bg-blue-50 border-b border-blue-100 flex items-center gap-3">
              <User size={20} className="text-blue-600" />
              <h3 className="text-xl font-bold text-slate-900">Assign Faculty Reviewer</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Select Faculty <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedFacultyId}
                  onChange={(e) => setSelectedFacultyId(e.target.value)}
                  className="w-full px-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900"
                >
                  <option value="">-- Select faculty reviewer --</option>
                  {facultyMembers.map((member) => (
                    <option key={member.id} value={member.id}>
                      {formatFullName(member)}{member.department ? ` (${member.department})` : ''}
                    </option>
                  ))}
                </select>
                {facultyMembers.length === 0 && (
                  <p className="mt-2 text-sm text-amber-700">No faculty accounts found for assignment.</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Notes (Optional)</label>
                <textarea
                  value={assignNotes}
                  onChange={(e) => setAssignNotes(e.target.value)}
                  placeholder="Add context for the assigned faculty reviewer..."
                  rows={3}
                  className="w-full px-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowAssignFacultyModal(false);
                    setSelectedFacultyId('');
                    setAssignNotes('');
                  }}
                  className="flex-1 py-3 border rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAssignFacultyReviewer}
                  disabled={actionLoading || !selectedFacultyId}
                  className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold disabled:opacity-50"
                >
                  {actionLoading ? 'Assigning...' : 'Assign'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Set Review Deadline Modal */}
      {showDeadlineModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border">
            <div className="px-6 py-4 bg-orange-50 border-b border-orange-100 flex items-center gap-3">
              <Clock size={20} className="text-orange-600" />
              <h3 className="text-xl font-bold text-slate-900">Set Program Review Deadline</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Deadline Date and Time <span className="text-red-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  value={deadlineValue}
                  onChange={(e) => setDeadlineValue(e.target.value)}
                  className="w-full px-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none"
                />
              </div>

              <div className="bg-orange-50 border border-orange-200 rounded-xl p-3">
                <p className="text-xs text-orange-800">Automatic reminder notifications will be sent as this deadline approaches.</p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeadlineModal(false)}
                  className="flex-1 py-3 border rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSetReviewDeadline}
                  disabled={actionLoading || !deadlineValue}
                  className="flex-1 py-3 bg-orange-600 text-white rounded-xl font-bold disabled:opacity-50"
                >
                  {actionLoading ? 'Saving...' : 'Save Deadline'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReviewDetail;