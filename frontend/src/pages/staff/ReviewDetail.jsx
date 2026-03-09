import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import { 
  ArrowLeft, 
  FileText, 
  User, 
  Calendar, 
  Download, 
  ExternalLink, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Shield,
  BookOpen,
  Tag,
  Users,
  Mail,
  Clock,
  FileCheck,
  Lightbulb,
  ShieldCheck,
  BarChart3,
  ChevronRight,
  Eye,
  Maximize2 // Added for the preview header
} from 'lucide-react';
import { researchAPI } from '../../utils/api';

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
  const [comments, setComments] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [revisionNotes, setRevisionNotes] = useState('');
  const [deanChairList, setDeanChairList] = useState([]);
  const [selectedTargetId, setSelectedTargetId] = useState('');
  const [selectedTargetRole, setSelectedTargetRole] = useState('');

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

  const fetchPaperDetail = async () => {
    try {
      const response = await researchAPI.getResearchById(id);
      setPaper(response.data.paper);
    } catch (error) {
      console.error('Failed to fetch paper:', error);
    } finally {
      setLoading(false);
    }
  };

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
      const extra = user?.role === 'faculty' && selectedTargetId
        ? { targetUserId: selectedTargetId, targetRole: selectedTargetRole }
        : {};
      const response = await researchAPI.approveResearch(id, comments, extra);
      toast.success('Research approved successfully! 🎉', { id: loadingToast, duration: 3000 });
      const reviewPath = user?.role === 'faculty' ? '/faculty/review'
        : ['dean', 'program_chair'].includes(user?.role) ? '/dean/review'
        : user?.role === 'admin' ? '/admin/papers' : '/staff/review';
      navigate(reviewPath);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to approve research', { id: loadingToast });
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
      await researchAPI.rejectResearch(id, rejectionReason);
      toast.success('Research rejected', { id: loadingToast, icon: '❌' });
      const reviewPath = user?.role === 'faculty' ? '/faculty/review'
        : ['dean', 'program_chair'].includes(user?.role) ? '/dean/review'
        : user?.role === 'admin' ? '/admin/papers' : '/staff/review';
      navigate(reviewPath);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to reject research', { id: loadingToast });
    } finally {
      setActionLoading(false);
      setShowRejectModal(false);
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
      console.log('=== Requesting Revision ===');
      console.log('Paper ID:', id);
      console.log('User role:', user?.role);
      console.log('Current paper status:', paper?.status);
      console.log('Revision notes:', revisionNotes);
      
      const response = await researchAPI.requestRevision(id, revisionNotes);
      toast.success('Revision requested successfully! 📝', { id: loadingToast, duration: 3000 });
      const reviewPath = user?.role === 'faculty' ? '/faculty/review'
        : ['dean', 'program_chair'].includes(user?.role) ? '/dean/review'
        : user?.role === 'admin' ? '/admin/papers' : '/staff/review';
      navigate(reviewPath);
    } catch (error) {
      console.error('Failed to request revision:', error);
      toast.error(error.response?.data?.error || 'Failed to request revision', { id: loadingToast });
    } finally {
      setActionLoading(false);
      setShowRevisionModal(false);
    }
  };

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
                    <p className="text-lg font-bold text-slate-900">{paper.users?.full_name || 'Researcher'}</p>
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

              {/* PDF PREVIEW SECTION */}
              <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Maximize2 size={18} className="text-[#1C4D8D]" />
                    <h4 className="text-lg font-bold text-slate-900">Document Preview</h4>
                  </div>
                  <div className="flex gap-3">
                    <a href={paper.file_url} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-[#1C4D8D] hover:text-[#163a6b] flex items-center gap-1">
                      <ExternalLink size={14} /> Full Screen
                    </a>
                  </div>
                </div>
                <div className="rounded-2xl border-2 border-slate-200 overflow-hidden bg-slate-100 shadow-inner">
                  {paper.file_url ? (
                    <iframe
                      src={`${paper.file_url}#toolbar=0&navpanes=0`}
                      width="100%"
                      height="650px"
                      title="Research PDF Preview"
                      className="w-full border-none"
                    />
                  ) : (
                    <div className="h-[300px] flex flex-col items-center justify-center text-slate-400 gap-2">
                      <XCircle size={40} />
                      <p>Preview not available</p>
                    </div>
                  )}
                </div>
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
                <button onClick={() => setShowRejectModal(true)} className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-all font-bold shadow-lg">
                  <XCircle size={20} /> Reject Paper
                </button>
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
            </div>
          </div>
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
                          {m.full_name} ({m.role === 'dean' ? 'Dean' : 'Program Chair'})
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
    </div>
  );
};

export default ReviewDetail;