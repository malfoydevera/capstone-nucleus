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
  Eye,
  Maximize2,
  Award,
  MessageSquare,
  ExternalLink,
  Download,
} from 'lucide-react';
import { researchAPI, unwrapApiData } from '../../utils/api';
import SecurePDFViewer from '../../components/pdf/SecurePDFViewer';
import AnnotationsSidePanel from '../../components/pdf/AnnotationsSidePanel';
import ReviewDetailNav from '../../components/review/ReviewDetailNav';
import ReviewSection from '../../components/review/ReviewSection';
import ReviewAssignmentBanner, { ActiveReviewerNotes } from '../../components/review/ReviewAssignmentBanner';
import ReviewProgressTracker, { shouldShowWorkflowProgress } from '../../components/review/ReviewProgressTracker';
import { formatFullName } from '../../utils/names';
import SearchableUserSelect from '../../components/ui/SearchableUserSelect';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ReviewDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [paper, setPaper] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showRevisionModal, setShowRevisionModal] = useState(false);
  const [showMetadataModal, setShowMetadataModal] = useState(false);
  const [comments, setComments] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectionCategory, setRejectionCategory] = useState('methodology');
  const [revisionNotes, setRevisionNotes] = useState('');
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
  const turnitinUrl = import.meta.env.VITE_TURNITIN_URL || 'https://www.turnitin.com/';
  const grammarlyUrl = import.meta.env.VITE_GRAMMARLY_URL || 'https://www.grammarly.com/';
  const [annotations, setAnnotations] = useState([]);
  const [feedbackDrawerOpen, setFeedbackDrawerOpen] = useState(false);
  const [reviewPdfPage, setReviewPdfPage] = useState(1);
  const [reviewPdfNumPages, setReviewPdfNumPages] = useState(null);
  /** Keeps the same string when polling only rotates signed-query params (stops react-pdf reload flicker). */
  const [stablePreviewPdfUrl, setStablePreviewPdfUrl] = useState(null);
  const [showPublishDoiModal, setShowPublishDoiModal] = useState(false);
  const [showPublishConfirmModal, setShowPublishConfirmModal] = useState(false);
  const [publishDoiValue, setPublishDoiValue] = useState('');
  const [showDeclinePublishModal, setShowDeclinePublishModal] = useState(false);
  const [declineReason, setDeclineReason] = useState('');

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
        .then(res => setDeanChairList(unwrapApiData(res).members || []))
        .catch(err => console.error('Failed to fetch dean/chair members:', err));
    }
  }, [user]);

  useEffect(() => {
    setReviewPdfPage(1);
    setReviewPdfNumPages(null);
    setStablePreviewPdfUrl(null);
  }, [id]);

  useEffect(() => {
    const raw = paper?.file_url;
    if (!raw) return;
    setStablePreviewPdfUrl((prev) => {
      if (!prev) return raw;
      try {
        if (new URL(prev).pathname === new URL(raw).pathname) return prev;
      } catch {
        if (prev.split('?')[0] === raw.split('?')[0]) return prev;
      }
      return raw;
    });
  }, [paper?.file_url]);

  useEffect(() => {
    fetchPaperDetail();
    
    // Auto-refresh every 10 seconds for real-time updates
    const interval = setInterval(() => {
      fetchPaperDetail();
    }, 10000);
    
    return () => clearInterval(interval);
  }, [id]);

  useEffect(() => {
    const canAssignBackToFaculty = ['dean', 'program_chair'].includes(user?.role);
    if (!canAssignBackToFaculty) return;

    const loadFaculty = async () => {
      try {
        const scoped = await researchAPI.getFacultyMembers({
          department: paper?.department_id ? undefined : (paper?.department || undefined),
          departmentId: paper?.department_id || undefined,
        });
        setFacultyMembers(unwrapApiData(scoped).facultyMembers || []);
      } catch (err) {
        console.error('Failed to load faculty members:', err);
      }
    };

    loadFaculty();
  }, [paper?.department, paper?.department_id, user?.role]);

  const fetchPaperDetail = async () => {
    try {
      const [paperResult, annotationResult, categoriesResult, fileResult] = await Promise.allSettled([
        researchAPI.getResearchById(id),
        researchAPI.getAnnotations(id),
        researchAPI.getCategories(),
        researchAPI.getResearchFile(id),
      ]);

      if (paperResult.status !== 'fulfilled') {
        throw paperResult.reason;
      }

      const response = paperResult.value;
      const payload = unwrapApiData(response);
      const nextPaper = payload.paper;
      setPaper(nextPaper);

      if (fileResult.status === 'fulfilled') {
        const fileUrl = unwrapApiData(fileResult.value).fileUrl;
        if (fileUrl) {
          setStablePreviewPdfUrl((prev) => {
            if (!prev) return fileUrl;
            try {
              if (new URL(prev).pathname === new URL(fileUrl).pathname) return prev;
            } catch {
              if (prev.split('?')[0] === fileUrl.split('?')[0]) return prev;
            }
            return fileUrl;
          });
        }
      }
      setMetadataForm({
        title: nextPaper?.title || '',
        abstract: nextPaper?.abstract || '',
        keywords: (nextPaper?.keywords || []).join(', '),
        category: nextPaper?.category || '',
        coAuthors: nextPaper?.external_author_notes || '',
      });

      if (annotationResult.status === 'fulfilled') {
        setAnnotations(unwrapApiData(annotationResult.value).annotations || []);
      } else {
        console.error('Failed to fetch annotations:', annotationResult.reason);
        setAnnotations([]);
      }

      if (categoriesResult.status === 'fulfilled') {
        setCategories(unwrapApiData(categoriesResult.value).categories || []);
      } else {
        console.error('Failed to fetch categories:', categoriesResult.reason);
        setCategories([]);
      }

    } catch (error) {
      console.error('Failed to fetch paper:', error);
    } finally {
      setLoading(false);
    }
  };

  const canAnnotate = ['faculty', 'dean', 'program_chair', 'staff', 'admin'].includes(user?.role);

  const handleAddAnnotationFromPanel = useCallback(async (payload) => {
    try {
      await researchAPI.addAnnotation(id, payload);
      const res = await researchAPI.getAnnotations(id);
      setAnnotations(unwrapApiData(res).annotations || []);
      toast.success('Saved for the author');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to save feedback'));
      throw error;
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

  const handleSubmitReply = useCallback(async (annotation, replyBody) => {
    const trimmed = String(replyBody || '').trim();
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
      setAnnotations(unwrapApiData(res).annotations || []);
      toast.success('Reply posted');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to post reply'));
    }
  }, [id]);

  const handleDrawingSaved = useCallback(async (pageNum, blob) => {
    const formData = new FormData();
    formData.append('drawing', blob, 'markup.png');
    const uploadRes = await researchAPI.uploadAnnotationDrawing(id, formData);
    const url = unwrapApiData(uploadRes)?.url;
    if (!url) throw new Error('Upload did not return an image URL');
    await researchAPI.addAnnotation(id, {
      annotationType: 'draw',
      pageNumber: pageNum,
      drawImageUrl: url,
      note: '',
    });
    const res = await researchAPI.getAnnotations(id);
    setAnnotations(unwrapApiData(res).annotations || []);
    toast.success('Drawing saved for the author');
  }, [id]);

  const handleApprove = async () => {
    if (!comments.trim()) {
      toast.error('Please provide approval comments');
      return;
    }

    // Adviser must pick a Dean or Program Chair
    if (user?.role === 'faculty' && (!selectedTargetId || !selectedTargetRole)) {
      toast.error('Please select a Dean or Program Chair to forward the paper to');
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
      toast.success('Research approved successfully.', { id: loadingToast, duration: 3000 });
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

  const handleConfirmPublish = async () => {
    if (!paper?.doi) return;
    setActionLoading(true);
    const t = toast.loading('Publishing…');
    try {
      await researchAPI.adminPublishResearch(id, {});
      toast.success('Paper published successfully', { id: t });
      setShowPublishConfirmModal(false);
      await fetchPaperDetail();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Publish failed'), { id: t });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeclinePublishRequest = async () => {
    setActionLoading(true);
    const t = toast.loading('Declining request…');
    try {
      await researchAPI.declinePublishRequest(id, declineReason.trim());
      toast.success('Publish request declined', { id: t });
      setShowDeclinePublishModal(false);
      setDeclineReason('');
      await fetchPaperDetail();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to decline request'), { id: t });
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }
    setActionLoading(true);
    const loadingToast = toast.loading('Processing rejection...');
    try {
      const annotationSummary = annotations.length > 0
        ? `\n\n[Annotation Summary]\n${annotations.map((item, index) => `${index + 1}. ${item.pageNumber ? `Page ${item.pageNumber}: ` : ''}${item.note}`).join('\n')}`
        : '';
      await researchAPI.rejectResearch(id, `${rejectionReason}${annotationSummary}`, rejectionCategory);
      toast.success('Research rejected', { id: loadingToast });
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
      toast.error('Please provide revision notes');
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
      toast.success('Revision requested successfully.', { id: loadingToast, duration: 3000 });
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
      toast.error('Please select a faculty reviewer');
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
      toast.error('Please select a deadline date and time');
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

  const handleCorrectMetadata = async () => {
    if (!metadataForm.title.trim() || !metadataForm.abstract.trim()) {
      toast.error('Title and abstract are required');
      return;
    }

    setActionLoading(true);
    const loadingToast = toast.loading('Saving metadata corrections...');
    try {
      const keywordsParsed = String(metadataForm.keywords || '')
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean);

      if (user?.role === 'admin' && ['approved', 'published'].includes(paper?.status)) {
        await researchAPI.adminUpdateResearch(id, {
          title: metadataForm.title.trim(),
          abstract: metadataForm.abstract.trim(),
          keywords: keywordsParsed,
          category: metadataForm.category,
          external_author_notes: metadataForm.coAuthors.trim() || null,
        });
      } else {
        await researchAPI.correctMetadata(id, {
          title: metadataForm.title.trim(),
          abstract: metadataForm.abstract.trim(),
          keywords: metadataForm.keywords,
          category: metadataForm.category,
          external_author_notes: metadataForm.coAuthors.trim() || null,
        });
      }
      await fetchPaperDetail();
      setShowMetadataModal(false);
      toast.success('Metadata corrected successfully', { id: loadingToast, duration: 3000 });
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to correct metadata'), { id: loadingToast });
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    });
  };

  const getCategoryName = (categoryValue) => {
    if (!categoryValue) return 'General';
    const category = categories.find((entry) => entry.id === categoryValue);
    if (category) return category.name;
    if (typeof categoryValue === 'string' && !UUID_PATTERN.test(categoryValue)) return categoryValue;
    return 'General';
  };

  const getStructuredCoAuthorNames = (paperRecord) => {
    if (!Array.isArray(paperRecord?.structured_authors)) {
      return [];
    }

    return Array.from(new Set(
      paperRecord.structured_authors
        .filter((entry) => !entry?.is_primary)
        .map((entry) => formatFullName(entry.author))
        .filter(Boolean)
    ));
  };

  const getStatusConfig = (status) => {
    const configs = {
      pending: {
        badgeColor: 'bg-gradient-to-r from-yellow-100 to-amber-100 text-yellow-800 border-yellow-200',
        icon: Clock, label: 'Pending Review'
      },
      pending_faculty: {
        badgeColor: 'bg-gradient-to-r from-[#3674B5]/10 to-[#578FCA]/10 text-[#3674B5] border-[#3674B5]/20',
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
        badgeColor: 'bg-gradient-to-r from-[#3674B5]/10 to-[#578FCA]/10 text-[#3674B5] border-[#3674B5]/20',
        icon: Shield, label: 'Awaiting Admin Review'
      },
      approved: {
        badgeColor: 'bg-gradient-to-r from-amber-50 to-amber-100 text-amber-900 border-amber-200',
        icon: CheckCircle, label: 'Approved (internal)'
      },
      published: {
        badgeColor: 'bg-gradient-to-r from-emerald-100 to-teal-100 text-emerald-900 border-emerald-200',
        icon: Award, label: 'Published'
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
          <div className="w-20 h-20 border-4 border-[#3674B5]/20 rounded-full"></div>
          <div className="absolute top-0 left-0 w-20 h-20 border-4 border-[#3674B5] border-t-transparent rounded-full animate-spin"></div>
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
        <button onClick={() => navigate(backPath)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-slate-100 to-white border border-slate-300 text-slate-700 hover:border-[#3674B5]/30 transition-colors mb-8">
          <ArrowLeft size={18} /> Back to Review Queue
        </button>
        <div className="text-center py-16">
          <FileText size={40} className="text-slate-400 mx-auto mb-6" />
          <h2 className="text-2xl font-bold text-slate-900 mb-3">Research paper not found</h2>
          <button onClick={() => navigate(backPath)} className="px-6 py-3 bg-gradient-to-r from-[#3674B5] to-[#578FCA] text-white rounded-xl font-bold">Return to Review Queue</button>
        </div>
      </div>
    );
  }

  const statusConfig = getStatusConfig(paper.status);
  const StatusIcon = statusConfig.icon;
  const backPath = user?.role === 'faculty' ? '/faculty/review'
                 : ['dean', 'program_chair'].includes(user?.role) ? '/dean/review'
                 : user?.role === 'admin' ? '/admin/papers' : '/staff/review';
  const metadataCategoryOptions = !metadataForm.category || categories.some((entry) => entry.id === metadataForm.category)
    ? categories
    : [
        ...categories,
        {
          id: metadataForm.category,
          name: typeof metadataForm.category === 'string' && !UUID_PATTERN.test(metadataForm.category)
            ? `${metadataForm.category} (legacy)`
            : 'Current unmapped category',
        },
      ];

  const structuredCoAuthorNames = getStructuredCoAuthorNames(paper);

  const drawOverlays = annotations
    .filter((a) => a.annotationType === 'draw' && a.drawImageUrl && a.pageNumber)
    .map((a) => ({ id: a.id, pageNumber: a.pageNumber, imageUrl: a.drawImageUrl }));

  const previewPdfUrl = stablePreviewPdfUrl ?? paper.file_url;

  const handleAdminDownload = async () => {
    try {
      const response = await researchAPI.trackDownload(id);
      const downloadUrl = unwrapApiData(response).fileUrl || previewPdfUrl;
      if (!downloadUrl) {
        toast.error('Download unavailable');
        return;
      }

      const fileResponse = await fetch(downloadUrl);
      if (!fileResponse.ok) throw new Error('Download failed');

      const blob = await fileResponse.blob();
      const safeTitle = (paper?.title || 'research-paper').replace(/[^\w\s.-]+/g, '_').trim() || 'research-paper';
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `${safeTitle}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(blobUrl);

      toast.success('Download started');
    } catch (error) {
      console.error('Failed to download paper:', error);
      toast.error('Unable to download');
    }
  };

  const queueLabel = user?.role === 'faculty'
    ? 'Adviser review queue'
    : user?.role === 'admin'
      ? 'Admin approval queue'
      : user?.role === 'dean'
        ? 'Dean review queue'
        : user?.role === 'program_chair'
          ? 'Program chair review queue'
          : 'Editorial review queue';

  const showWorkflow = shouldShowWorkflowProgress(paper);

  const feedbackButton = canAnnotate ? (
    <button
      type="button"
      onClick={() => setFeedbackDrawerOpen(true)}
      className="inline-flex h-8 sm:h-9 items-center gap-1.5 rounded-lg border border-[#3674B5]/30 bg-[#3674B5]/10 px-2.5 sm:px-3 text-[11px] sm:text-xs font-semibold text-[#3674B5] hover:bg-[#3674B5]/15 transition-colors w-full sm:w-auto justify-center"
    >
      <MessageSquare size={14} aria-hidden="true" />
      Author feedback
      {annotations.length > 0 && (
        <span className="rounded-full bg-[#3674B5] text-white px-1.5 py-0.5 text-[10px] font-bold leading-none">
          {annotations.length}
        </span>
      )}
    </button>
  ) : null;

  const headerTrailing = (
    <div className="flex flex-wrap items-center gap-2">
      {user?.role === 'admin' && (
        <button
          type="button"
          onClick={handleAdminDownload}
          className="inline-flex h-8 sm:h-9 items-center gap-1.5 rounded-lg bg-[#3674B5] px-2.5 sm:px-3 text-[11px] sm:text-xs font-semibold text-white hover:bg-[#2d6299] transition-colors"
        >
          <Download size={14} aria-hidden="true" />
          Download
        </button>
      )}
      {feedbackButton}
    </div>
  );

  return (
    <div className="review-screen flex flex-1 min-h-0 flex-col">
      <ReviewDetailNav
        backPath={backPath}
        breadcrumbs={[
          { label: 'Dashboard', path: '/dashboard' },
          { label: queueLabel, path: backPath },
        ]}
        title={paper.title || 'Untitled manuscript'}
        statusBadge={(
          <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] sm:text-[11px] font-semibold ${statusConfig.badgeColor}`}>
            <StatusIcon size={10} aria-hidden="true" /> {statusConfig.label}
          </span>
        )}
        trailing={headerTrailing}
      />

      <div className="review-screen__inner flex-1 py-4 sm:py-5 pb-24 lg:pb-8">
        <div className="space-y-4 sm:space-y-5">

      {showWorkflow && <ReviewProgressTracker status={paper.status} />}

      <div className="xl:hidden space-y-4">
        <ReviewAssignmentBanner role={user?.role} status={paper.status} />
        <ActiveReviewerNotes
          revisionNotes={paper.revision_notes}
          rejectionReason={paper.rejection_reason}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(280px,20rem)] 2xl:grid-cols-[minmax(0,1fr)_minmax(300px,22rem)] gap-4 sm:gap-5 xl:gap-6 items-start">
        <div className="space-y-4 sm:space-y-5 min-w-0">
          <ReviewSection
            id="submission-details"
            icon={FileText}
            title="Submission details"
            description="Author, abstract, and metadata"
          >
              <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-5">
                <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3">
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Primary author</dt>
                  <dd className="mt-1 text-sm font-semibold text-slate-900">{formatFullName(paper.users) || 'Researcher'}</dd>
                  <dd className="text-xs text-slate-600">{paper.users?.email}</dd>
                </div>
                <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3">
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Submitted</dt>
                  <dd className="mt-1 text-sm font-semibold text-slate-900">{formatDate(paper.submission_date || paper.created_at)}</dd>
                </div>
                {paper.category && (
                  <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3">
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Category</dt>
                    <dd className="mt-1 text-sm font-medium text-slate-800">{getCategoryName(paper.category)}</dd>
                  </div>
                )}
              </dl>

              {(structuredCoAuthorNames.length > 0 || paper.external_author_notes) && (
                <div className="mb-5 grid grid-cols-1 gap-3">
                  {structuredCoAuthorNames.length > 0 && (
                    <div className="flex items-start gap-4 p-4 rounded-xl bg-white border border-slate-200">
                      <User size={20} className="text-indigo-600 mt-1" />
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Canonical Co-authors</p>
                        <p className="text-slate-700">{structuredCoAuthorNames.join(', ')}</p>
                        <p className="text-xs text-slate-500 mt-1">
                          Managed through canonical authorship records, not metadata text.
                        </p>
                      </div>
                    </div>
                  )}

                  {paper.external_author_notes && (
                    <div className="flex items-start gap-4 p-4 rounded-xl bg-amber-50 border border-amber-200">
                      <FileText size={20} className="text-amber-700 mt-1" />
                      <div>
                        <p className="text-sm font-semibold text-slate-900">External Author Note</p>
                        <p className="text-slate-700 whitespace-pre-line">{paper.external_author_notes}</p>
                        <p className="text-xs text-amber-800 mt-1">
                          This field is informational and does not control canonical authorship.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Abstract */}
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-slate-900 mb-2">Abstract</h4>
                <div className="p-4 rounded-lg bg-slate-50 border border-slate-100">
                  <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">{paper.abstract}</p>
                </div>
              </div>

              {paper.keywords?.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-slate-900 mb-2">Keywords</h4>
                  <div className="flex flex-wrap gap-2">
                    {paper.keywords.map((kw, i) => (
                      <span key={i} className="px-3 py-1 rounded-full bg-[#3674B5]/10 text-[#3674B5] text-xs font-medium border border-[#3674B5]/20">{kw}</span>
                    ))}
                  </div>
                </div>
              )}
          </ReviewSection>

          <ReviewSection
            id="manuscript"
            icon={BookOpen}
            title="Manuscript PDF"
            description="Read-only preview — open the feedback drawer to add page notes"
            action={canAnnotate ? (
              <button
                type="button"
                onClick={() => setFeedbackDrawerOpen(true)}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#3674B5]/30 bg-[#3674B5]/10 px-2.5 text-[11px] sm:text-xs font-semibold text-[#3674B5] hover:bg-[#3674B5]/15 transition-colors"
              >
                <MessageSquare size={14} aria-hidden="true" />
                Feedback
              </button>
            ) : null}
          >
              <div className="min-w-0 overflow-hidden rounded-lg border border-slate-100">
                {previewPdfUrl ? (
                  <SecurePDFViewer
                    fileUrl={previewPdfUrl}
                    drawOverlays={drawOverlays}
                    pageNumber={reviewPdfPage}
                    onPageNumberChange={setReviewPdfPage}
                    onPdfReady={({ numPages: n }) => setReviewPdfNumPages(n)}
                  />
                ) : (
                  <div className="h-[300px] flex flex-col items-center justify-center text-slate-400 gap-2 rounded-2xl border-2 border-slate-200">
                    <XCircle size={40} />
                    <p>Preview not available</p>
                  </div>
                )}
              </div>
          </ReviewSection>
        </div>

        <aside className="space-y-4 sm:space-y-5 xl:sticky xl:top-[3.75rem] xl:self-start xl:max-h-[calc(100dvh-4.5rem)] xl:overflow-y-auto">
          <div className="hidden xl:block space-y-4">
            <ReviewAssignmentBanner role={user?.role} status={paper.status} />
            <ActiveReviewerNotes
              revisionNotes={paper.revision_notes}
              rejectionReason={paper.rejection_reason}
            />
          </div>

          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 px-0.5">
            Record decision
          </p>
          {/* Action Buttons - Role-based visibility */}
          {(() => {
            const userRole = user?.role;
            const paperStatus = paper.status;
            
            // Faculty can act on pending_faculty
            if (userRole === 'faculty' && paperStatus === 'pending_faculty') return true;
            
            // Dean / Program Chair can act on their respective pending status
            if (userRole === 'dean' && paperStatus === 'pending_dean') return true;
            if (userRole === 'program_chair' && paperStatus === 'pending_program_chair') return true;
            
            // Staff can act on pending_editor and revision_required
            if (userRole === 'staff' && (paperStatus === 'pending_editor' || paperStatus === 'revision_required')) return true;
            
            // Admin can act on pending_admin, revision_required
            if (userRole === 'admin' && (paperStatus === 'pending_admin' || paperStatus === 'revision_required')) return true;
            
            return false;
          })() && (
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
              <div className="px-4 sm:px-5 py-3 border-b border-slate-100 flex items-center gap-2">
                <FileCheck size={18} className="text-[#3674B5]" aria-hidden="true" />
                <h3 className="text-sm font-semibold text-slate-900">Review Actions</h3>
              </div>
              <div className="p-4 sm:p-5 space-y-2.5">
                <button onClick={() => setShowApproveModal(true)} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-semibold">
                  <CheckCircle size={18} aria-hidden="true" /> Approve Research
                </button>
                <button onClick={() => setShowRevisionModal(true)} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors text-sm font-semibold">
                  <AlertCircle size={18} aria-hidden="true" /> Request Revision
                </button>

                {user?.role === 'staff' && ['pending_editor'].includes(paper.status) && (
                  <button
                    onClick={() => setShowMetadataModal(true)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#3674B5] text-white rounded-lg hover:bg-[#2d6299] transition-colors text-sm font-semibold"
                  >
                    <FileText size={18} aria-hidden="true" /> Correct Metadata
                  </button>
                )}

                {user?.role !== 'program_chair' && (
                  <button onClick={() => setShowRejectModal(true)} className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-red-200 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors text-sm font-semibold">
                    <XCircle size={18} aria-hidden="true" /> Reject Paper
                  </button>
                )}

                {['dean', 'program_chair'].includes(user?.role) && ['pending_dean', 'pending_program_chair', 'revision_required'].includes(paper.status) && (
                  <button
                    onClick={() => setShowAssignFacultyModal(true)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#578FCA] text-white rounded-lg hover:bg-[#3674B5] transition-colors text-sm font-semibold"
                  >
                    <User size={18} aria-hidden="true" /> Assign to Faculty Reviewer
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

              </div>
            </div>
          )}

          {/* Dean Bypass Button - available for Dean except finalized statuses blocked by backend */}
          {user?.role === 'dean' && !['approved', 'published', 'rejected'].includes(paper.status) && (
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
              <div className="p-6">
                <button onClick={() => setShowBypassModal(true)} className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl hover:from-violet-700 hover:to-purple-700 transition-all font-bold shadow-lg">
                  <Shield size={20} /> Bypass Approve
                </button>
              </div>
            </div>
          )}

          {/* Timeline & Stats */}
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6 space-y-6">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <Clock size={20} className="text-[#3674B5]" />
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

          {paper.doi && paper.status !== 'published' && (
            <div className="surface-card overflow-hidden">
              <div className="px-6 py-4 border-b border-[#3674B5]/15 bg-gradient-to-r from-[#3674B5]/10 to-[#578FCA]/10 flex items-center gap-3">
                <ExternalLink size={20} className="text-[#3674B5]" />
                <h3 className="font-bold text-slate-900">Student-Provided DOI</h3>
              </div>
              <div className="p-6 space-y-3">
                <p className="text-sm text-slate-600">
                  The student submitted this DOI. Click the link to verify it leads to the correct paper before publishing.
                </p>
                <a
                  href={`https://doi.org/${paper.doi}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[#3674B5]/25 bg-[#3674B5]/5 text-[#3674B5] hover:bg-[#3674B5]/10 font-mono text-sm transition-colors"
                >
                  <ExternalLink size={15} />
                  {paper.doi}
                </a>
                <p className="text-xs text-slate-500">
                  Opens doi.org resolver in a new tab. Verify the destination matches this paper before approving.
                </p>
              </div>
            </div>
          )}

          {user?.role === 'admin' && ['approved', 'published'].includes(paper.status) && (
            <div className="surface-card overflow-hidden border-[#3674B5]/20">
              <div className="px-6 py-4 border-b border-[#3674B5]/15 bg-gradient-to-r from-[#3674B5]/10 to-[#578FCA]/10 flex items-center gap-3">
                <Award size={20} className="text-[#3674B5]" />
                <h3 className="font-bold text-slate-900">Admin: Publish</h3>
              </div>
              <div className="p-6 space-y-3">
                <p className="text-sm text-slate-600">
                  Approved papers are visible in the repository as <strong>internal (approved)</strong>.
                  Publishing marks the work as formally published using the student-provided DOI above.
                </p>
                {paper.status === 'published' && paper.doi && (
                  <p className="text-sm">
                    <span className="text-slate-500">Current DOI: </span>
                    <a
                      href={`https://doi.org/${paper.doi}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono font-semibold text-[#3674B5] underline hover:no-underline"
                    >
                      {paper.doi}
                    </a>
                  </p>
                )}
                {paper.status === 'approved' && paper.publish_requested_at && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
                    Student requested publication on {new Date(paper.publish_requested_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}.
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  {paper.status === 'approved' && (
                    <>
                      <button
                        type="button"
                        disabled={actionLoading || !paper.doi}
                        onClick={() => setShowPublishConfirmModal(true)}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-[#3674B5] to-[#578FCA] text-white rounded-xl font-bold hover:from-[#2d6299] hover:to-[#3674B5] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <Award size={18} /> Mark as published
                      </button>
                      {!paper.doi && (
                        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                          No student DOI on file. Ask the author to resubmit with their journal DOI before formal publication.
                        </p>
                      )}
                      {paper.publish_requested_at && (
                        <button
                          type="button"
                          disabled={actionLoading}
                          onClick={() => setShowDeclinePublishModal(true)}
                          className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-rose-200 text-rose-800 rounded-xl font-bold hover:bg-rose-50 disabled:opacity-50 transition-colors"
                        >
                          Decline request
                        </button>
                      )}
                    </>
                  )}
                  {paper.status === 'published' && (
                    <button
                      type="button"
                      onClick={() => {
                        setPublishDoiValue(paper.doi || '');
                        setShowPublishDoiModal(true);
                      }}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-[#3674B5] to-[#578FCA] text-white rounded-xl font-bold hover:from-[#2d6299] hover:to-[#3674B5] transition-colors"
                    >
                      Update DOI
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowMetadataModal(true)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-[#3674B5]/25 text-[#3674B5] rounded-xl font-bold hover:bg-[#3674B5]/5 transition-colors"
                  >
                    <FileText size={18} /> Edit metadata (title, abstract, …)
                  </button>
                  {paper.status === 'published' && (
                    <button
                      type="button"
                      onClick={async () => {
                        if (!window.confirm('Revert this paper to internal (approved) status? The DOI will be cleared.')) return;
                        setActionLoading(true);
                        const t = toast.loading('Reverting…');
                        try {
                          await researchAPI.adminUnpublishResearch(id);
                          toast.success('Paper set back to approved (internal)', { id: t });
                          await fetchPaperDetail();
                        } catch (error) {
                          toast.error(getApiErrorMessage(error, 'Unpublish failed'), { id: t });
                        } finally {
                          setActionLoading(false);
                        }
                      }}
                      disabled={actionLoading}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-amber-300 text-amber-900 rounded-xl font-bold hover:bg-amber-50 disabled:opacity-50"
                    >
                      Revert to internal (approved)
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {user?.role === 'staff' && (
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6 space-y-4">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                <ShieldCheck size={20} className="text-slate-700" />
                <h3 className="font-bold text-slate-900">Similarity check (third party)</h3>
              </div>
              <p className="text-sm text-slate-600">
                In-app plagiarism scanning is turned off. Open your institution&apos;s Turnitin or Grammarly account in a new tab, then upload the manuscript there.
              </p>
              <div className="flex flex-col gap-2">
                <a
                  href={turnitinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl bg-slate-800 text-white font-bold hover:bg-slate-900"
                >
                  Open Turnitin
                </a>
                <a
                  href={grammarlyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl border-2 border-emerald-600 text-emerald-800 font-bold hover:bg-emerald-50"
                >
                  Open Grammarly
                </a>
              </div>
              <p className="text-xs text-slate-500">
                Set <code className="bg-slate-100 px-1 rounded">VITE_TURNITIN_URL</code> and{' '}
                <code className="bg-slate-100 px-1 rounded">VITE_GRAMMARLY_URL</code> in the frontend env to point to your campus login pages.
              </p>
            </div>
          )}
        </aside>
      </div>

        </div>
      </div>

      {canAnnotate && (
        <AnnotationsSidePanel
          drawerOnly
          annotations={annotations}
          isOpen={feedbackDrawerOpen}
          onToggle={() => setFeedbackDrawerOpen((open) => !open)}
          canEdit={canAnnotate}
          onReply={handleSubmitReply}
          onDelete={handleDeleteAnnotation}
          onAddAnnotation={handleAddAnnotationFromPanel}
          currentUserId={user?.id}
          userRole={user?.role}
        />
      )}

      {/* Admin publish confirmation */}
      {showPublishConfirmModal && user?.role === 'admin' && paper?.status === 'approved' && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="publish-confirm-title"
          onClick={() => !actionLoading && setShowPublishConfirmModal(false)}
        >
          <div
            className="surface-card w-full max-w-md overflow-hidden"
            style={{ boxShadow: 'var(--shadow-strong)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-[#3674B5]/15 bg-gradient-to-r from-[#3674B5]/10 to-[#578FCA]/10 flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#3674B5] to-[#578FCA] text-white shadow-sm">
                <Award size={20} aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h3 id="publish-confirm-title" className="text-xl font-bold text-slate-900">
                  Confirm publication
                </h3>
                <p className="mt-0.5 text-sm text-slate-600">
                  Mark this paper as formally published
                </p>
              </div>
            </div>

            <div className="space-y-4 p-6">
              <div className="surface-card--muted rounded-xl border border-slate-200/80 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Paper</p>
                <p className="mt-1 text-sm font-semibold leading-snug text-slate-900">{paper.title}</p>
              </div>

              <div className="rounded-xl border border-[#3674B5]/20 bg-gradient-to-br from-[#3674B5]/5 to-[#578FCA]/5 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#3674B5]">Student-provided DOI</p>
                <a
                  href={`https://doi.org/${paper.doi}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-2 rounded-xl border border-[#3674B5]/25 bg-white px-3 py-2 font-mono text-sm font-medium text-[#3674B5] transition-colors hover:bg-[#3674B5]/5"
                >
                  <ExternalLink size={15} aria-hidden="true" />
                  {paper.doi}
                </a>
                <p className="mt-3 text-xs leading-relaxed text-slate-600">
                  Open the link and confirm it resolves to the correct paper before publishing.
                </p>
              </div>

              <div className="flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                <CheckCircle size={18} className="mt-0.5 shrink-0 text-emerald-600" aria-hidden="true" />
                <p className="leading-relaxed">
                  After publication, the work will appear with a <strong>Published</strong> badge and a permanent DOI link for citations.
                </p>
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => setShowPublishConfirmModal(false)}
                  className="flex-1 h-11 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={actionLoading || !paper.doi}
                  onClick={handleConfirmPublish}
                  className="flex-1 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#3674B5] to-[#578FCA] text-sm font-bold text-white transition-colors hover:from-[#2d6299] hover:to-[#3674B5] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {actionLoading ? 'Publishing…' : (
                    <>
                      <Award size={16} aria-hidden="true" />
                      Publish paper
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Admin update DOI (published papers only) */}
      {showPublishDoiModal && user?.role === 'admin' && paper?.status === 'published' && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="surface-card max-w-md w-full overflow-hidden" style={{ boxShadow: 'var(--shadow-strong)' }}>
            <div className="px-6 py-4 border-b border-[#3674B5]/15 bg-gradient-to-r from-[#3674B5]/10 to-[#578FCA]/10 flex items-center gap-3">
              <Award size={20} className="text-[#3674B5]" />
              <h3 className="text-xl font-bold text-slate-900">Update DOI</h3>
            </div>
            <div className="p-6 space-y-4">
              <label className="block text-sm font-bold text-slate-700">
                DOI <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={publishDoiValue}
                onChange={(e) => setPublishDoiValue(e.target.value)}
                placeholder="e.g. 10.1234/nucleus.2026.001"
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-[#3674B5]/30 focus:border-[#3674B5] outline-none font-mono text-sm"
              />
              <p className="text-xs text-slate-500">
                Use the DOI issued by your publisher or repository. You may paste a full https://doi.org/… link; it will be normalized.
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowPublishDoiModal(false);
                    setPublishDoiValue('');
                  }}
                  className="flex-1 py-3 border rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={actionLoading || !publishDoiValue.trim()}
                  onClick={async () => {
                    setActionLoading(true);
                    const t = toast.loading('Updating DOI…');
                    try {
                      await researchAPI.adminPublishResearch(id, { doi: publishDoiValue.trim() });
                      toast.success('DOI updated', { id: t });
                      setShowPublishDoiModal(false);
                      setPublishDoiValue('');
                      await fetchPaperDetail();
                    } catch (error) {
                      toast.error(getApiErrorMessage(error, 'Request failed'), { id: t });
                    } finally {
                      setActionLoading(false);
                    }
                  }}
                  className="flex-1 py-3 bg-gradient-to-r from-[#3674B5] to-[#578FCA] text-white rounded-xl font-bold hover:from-[#2d6299] hover:to-[#3674B5] disabled:opacity-50 transition-colors"
                >
                  Save DOI
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Admin decline publish request */}
      {showDeclinePublishModal && user?.role === 'admin' && paper?.status === 'approved' && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => !actionLoading && setShowDeclinePublishModal(false)}
        >
          <div
            className="surface-card w-full max-w-md overflow-hidden"
            style={{ boxShadow: 'var(--shadow-strong)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-rose-100 bg-rose-50 flex items-center gap-3">
              <AlertCircle size={20} className="text-rose-600" />
              <h3 className="text-xl font-bold text-slate-900">Decline publish request</h3>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-600">
                The paper stays approved (internal); it will not be demoted. The author is notified with your reason, if provided.
              </p>
              <textarea
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                placeholder="Optional reason for the author (e.g. DOI does not resolve, needs a valid publisher DOI)…"
                rows={3}
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-300 focus:border-rose-400 outline-none text-sm"
              />
              <div className="flex gap-3">
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => {
                    setShowDeclinePublishModal(false);
                    setDeclineReason('');
                  }}
                  className="flex-1 h-11 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={handleDeclinePublishRequest}
                  className="flex-1 h-11 rounded-xl bg-rose-600 text-sm font-bold text-white hover:bg-rose-700 disabled:opacity-50"
                >
                  {actionLoading ? 'Declining…' : 'Decline request'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Approve Modal */}
      {showApproveModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="approve-research-title"
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border"
          >
            <div className="px-6 py-4 bg-emerald-50 border-b border-emerald-100 flex items-center gap-3">
              <CheckCircle size={20} className="text-emerald-600" aria-hidden="true" />
              <h3 id="approve-research-title" className="text-xl font-bold text-slate-900">Approve Research</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label htmlFor="approve-comments" className="block text-sm font-bold text-slate-700 mb-2">
                  Approval comments <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="approve-comments"
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  placeholder="Summarize why this paper is ready to move forward..."
                  rows={3}
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-slate-900 placeholder:text-slate-400"
                />
              </div>

              {/* Dean / Program Chair picker — only shown for Adviser (faculty) role */}
              {user?.role === 'faculty' && (
                <div>
                  <label htmlFor="approve-forward-target" className="block text-sm font-bold text-slate-700 mb-2">
                    Forward to Dean or Program Chair <span className="text-red-500">*</span>
                  </label>
                  {deanChairList.length === 0 ? (
                    <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                      No Dean or Program Chair accounts found. Ask your admin to create one.
                    </p>
                  ) : (
                    <>
                      <SearchableUserSelect
                        id="approve-forward-target"
                        options={deanChairList}
                        value={selectedTargetId}
                        required
                        accentClass="emerald"
                        placeholder="Search by name, email, or role..."
                        emptyMessage="No matching Dean or Program Chair found."
                        aria-label="Search Dean or Program Chair to forward this paper"
                        getSecondaryText={(member) => {
                          const roleLabel = member.role === 'dean' ? 'Dean' : 'Program Chair';
                          return [roleLabel, member.department, member.email].filter(Boolean).join(' · ');
                        }}
                        onChange={(nextId, selected) => {
                          setSelectedTargetId(nextId);
                          setSelectedTargetRole(selected?.role || '');
                        }}
                      />
                      <p className="mt-2 text-xs text-slate-500">
                        Type to filter accounts, then select who should review next.
                      </p>
                    </>
                  )}
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowApproveModal(false);
                    setSelectedTargetId('');
                    setSelectedTargetRole('');
                  }}
                  className="flex-1 h-11 border border-slate-300 rounded-xl font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={
                    actionLoading ||
                    !comments.trim() ||
                    (user?.role === 'faculty' && (!selectedTargetId || !selectedTargetRole))
                  }
                  className="flex-1 h-11 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
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
                  <select
                    value={metadataForm.category}
                    onChange={(e) => setMetadataForm((prev) => ({ ...prev, category: e.target.value }))}
                    className="w-full px-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    <option value="">Select category</option>
                    {metadataCategoryOptions.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                  {metadataForm.category && !categories.some((entry) => entry.id === metadataForm.category) && (
                    <p className="mt-2 text-xs text-amber-700">
                      This paper still uses a legacy or unmapped category value. Save a canonical category when correcting metadata.
                    </p>
                  )}
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Canonical Co-authors</label>
                  <div className="w-full px-4 py-3 border-2 rounded-xl bg-slate-50 text-slate-700 min-h-[52px]">
                    {structuredCoAuthorNames.length > 0
                      ? structuredCoAuthorNames.join(', ')
                      : 'No canonical co-authors on this paper.'}
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    Canonical authorship is managed through the submission and invitation flow, not this editor form.
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Legacy / External Co-author Note</label>
                  <input
                    value={metadataForm.coAuthors}
                    onChange={(e) => setMetadataForm((prev) => ({ ...prev, coAuthors: e.target.value }))}
                    placeholder="Optional compatibility note for legacy or external co-author text"
                    className="w-full px-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                  <p className="mt-2 text-xs text-amber-700">
                    Editing this field does not change canonical author records. Use it only for legacy or external author text that has not been modeled yet.
                  </p>
                </div>
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
                <p className="text-sm text-amber-800 font-medium">This action bypasses the normal approval workflow. A mandatory reason is required and will be permanently logged.</p>
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
                      toast.error('Bypass reason is required');
                      return;
                    }
                    setActionLoading(true);
                    const loadingToast = toast.loading('Processing bypass approval...');
                    try {
                      await researchAPI.deanBypassApprove(id, bypassReason, bypassTarget);
                      toast.success('Paper bypass-approved successfully! ✅', { id: loadingToast, duration: 3000 });
                      setShowBypassModal(false);
                      setBypassReason('');
                      navigate('/dean/review');
                    } catch (error) {
                      toast.error(getApiErrorMessage(error, 'Failed to bypass approve'), { id: loadingToast });
                    } finally {
                      setActionLoading(false);
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
                <label htmlFor="assign-faculty-select" className="block text-sm font-bold text-slate-700 mb-2">
                  Select Faculty <span className="text-red-500">*</span>
                </label>
                {facultyMembers.length === 0 ? (
                  <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                    No faculty accounts found for assignment.
                  </p>
                ) : (
                  <>
                    <SearchableUserSelect
                      id="assign-faculty-select"
                      options={facultyMembers}
                      value={selectedFacultyId}
                      required
                      accentClass="blue"
                      placeholder="Search faculty by name, email, or department..."
                      emptyMessage="No matching faculty found."
                      aria-label="Search faculty reviewer"
                      getSecondaryText={(member) =>
                        [member.department, member.email].filter(Boolean).join(' · ')
                      }
                      onChange={(nextId) => setSelectedFacultyId(nextId)}
                    />
                    <p className="mt-2 text-xs text-slate-500">
                      Type to filter faculty accounts, then select a reviewer.
                    </p>
                  </>
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
