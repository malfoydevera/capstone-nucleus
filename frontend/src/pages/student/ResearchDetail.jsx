import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import {
  FileText,
  Calendar,
  Eye,
  Tag,
  Users,
  Clock,
  Award,
  Copy,
  Download,
  ChevronRight,
  BookOpen,
  ShieldCheck,
  Lock,
  MessageSquare,
  Share2,
  GraduationCap,
} from 'lucide-react';
import { researchAPI, unwrapApiData } from '../../utils/api';
import ResearchChat from '../../components/ai/ResearchChat';
import SecurePDFViewer from '../../components/pdf/SecurePDFViewer';
import ReviewDetailNav from '../../components/review/ReviewDetailNav';
import ReviewSection from '../../components/review/ReviewSection';
import { formatFullName } from '../../utils/names';

const formatDate = (dateString) => {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

const getTimeAgo = (dateString) => {
  if (!dateString) return '—';
  const date = new Date(dateString);
  const now = new Date();
  const diffDays = Math.ceil(Math.abs(now - date) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
};

const getDefaultRepositoryPath = (role) => {
  switch (role) {
    case 'faculty': return '/faculty/repository';
    case 'dean': return '/dean/repository';
    case 'program_chair': return '/program-chair/repository';
    case 'staff': return '/staff/repository';
    case 'admin': return '/admin/repository';
    default: return '/student/browse';
  }
};

const getBackLabel = (path) => {
  if (path.includes('my-research')) return 'My submissions';
  if (path.includes('analytics')) return 'Analytics';
  return 'Repository';
};

const getStatusConfig = (status) => {
  if (status === 'published') {
    return {
      badgeColor: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      icon: Award,
      label: 'Published',
    };
  }
  if (status === 'approved') {
    return {
      badgeColor: 'bg-amber-50 text-amber-900 border-amber-200',
      icon: ShieldCheck,
      label: 'Approved (internal)',
    };
  }
  return {
    badgeColor: 'bg-slate-100 text-slate-700 border-slate-200',
    icon: BookOpen,
    label: 'Repository',
  };
};

const ResearchDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [paper, setPaper] = useState(null);
  const [loading, setLoading] = useState(true);
  const [relatedPapers, setRelatedPapers] = useState([]);
  const [downloadCount, setDownloadCount] = useState(0);
  const [viewCount, setViewCount] = useState(0);
  const [annotations, setAnnotations] = useState([]);
  const [workflowHistory, setWorkflowHistory] = useState([]);
  const [stablePreviewPdfUrl, setStablePreviewPdfUrl] = useState(null);
  const [doiInput, setDoiInput] = useState('');
  const [publishRequestLoading, setPublishRequestLoading] = useState(false);

  const backTarget = location.state?.from || getDefaultRepositoryPath(user?.role);
  const backLabel = getBackLabel(backTarget);

  const isAuthorOrCoAuthor = useMemo(() => {
    if (!user || !paper) return false;
    if (paper.users?.id === user.id || paper.author_id === user.id) return true;
    const list = Array.isArray(paper.structured_authors) ? paper.structured_authors : [];
    return list.some((entry) => (
      entry?.user_id === user.id ||
      entry?.author_id === user.id ||
      entry?.author?.id === user.id
    ));
  }, [user, paper]);

  const drawOverlays = useMemo(
    () =>
      annotations
        .filter((a) => a.annotationType === 'draw' && a.drawImageUrl && a.pageNumber)
        .map((a) => ({ id: a.id, pageNumber: a.pageNumber, imageUrl: a.drawImageUrl })),
    [annotations],
  );

  const fetchPaperDetail = useCallback(async () => {
    try {
      const [paperResponse, fileResponse] = await Promise.allSettled([
        researchAPI.getResearchById(id),
        researchAPI.getResearchFile(id),
      ]);

      if (paperResponse.status === 'fulfilled') {
        const payload = unwrapApiData(paperResponse.value);
        setPaper(payload.paper || null);
        setWorkflowHistory(Array.isArray(payload.workflowHistory) ? payload.workflowHistory : []);
        setDownloadCount(payload.paper?.download_count || 0);
        setViewCount(payload.paper?.view_count || 0);
        setDoiInput((prev) => prev || payload.paper?.doi || '');
      }

      if (fileResponse.status === 'fulfilled') {
        const fileUrl = unwrapApiData(fileResponse.value).fileUrl;
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

      const annotationResponse = await researchAPI.getAnnotations(id);
      const annotationPayload = unwrapApiData(annotationResponse);
      setAnnotations(Array.isArray(annotationPayload.annotations) ? annotationPayload.annotations : []);
    } catch (error) {
      console.error('Failed to fetch paper:', error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    setLoading(true);
    setStablePreviewPdfUrl(null);
    fetchPaperDetail();
    fetchRelatedPapers();
    trackView();
  }, [id, fetchPaperDetail]);

  const fetchRelatedPapers = async () => {
    try {
      const response = await researchAPI.getPublishedResearch();
      const allPapers = (unwrapApiData(response).papers || []).filter((p) => p.id !== id);
      setRelatedPapers(allPapers.slice(0, 4));
    } catch (error) {
      console.error('Failed to fetch related papers:', error);
    }
  };

  const trackView = async () => {
    try {
      await researchAPI.trackView(id);
      setViewCount((prev) => prev + 1);
    } catch (error) {
      console.error('Failed to track view:', error);
    }
  };

  const handleAdminDownload = async () => {
    try {
      const response = await researchAPI.trackDownload(id);
      const downloadUrl = unwrapApiData(response).fileUrl || stablePreviewPdfUrl || paper?.file_url;
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

      setDownloadCount((prev) => prev + 1);
      toast.success('Download started');
    } catch (error) {
      console.error('Failed to download paper:', error);
      toast.error('Unable to download');
    }
  };

  const getExternalAuthorNames = () => {
    const notes = paper?.external_author_notes;
    if (!notes) return [];
    return Array.from(new Set(
      String(notes).split(',').map((entry) => entry.trim()).filter(Boolean),
    ));
  };

  const getDisplayedCoAuthors = () => {
    const structuredAuthors = Array.isArray(paper?.structured_authors)
      ? paper.structured_authors
          .filter((entry) => !entry?.is_primary)
          .map((entry) => formatFullName(entry.author))
          .filter(Boolean)
      : [];
    return Array.from(new Set([...structuredAuthors, ...getExternalAuthorNames()]));
  };

  const isFormalPublished = paper?.status === 'published' && paper?.doi;
  const hasPendingDoi = paper?.doi && paper?.status !== 'published';

  const formatWorkflowLabel = (entry) => {
    const actionType = (entry?.action_type || '').toLowerCase();
    const status = (entry?.status || '').toLowerCase();
    if (actionType === 'dean_bypass') return 'Dean bypass';
    if (actionType === 'assigned_to_faculty') return 'Assigned to faculty';
    if (actionType === 'conflict_declared') return 'Conflict declared';
    if (actionType === 'returned_to_author') return 'Returned to author';
    if (actionType === 'returned_for_review') return 'Returned for review';
    if (actionType === 'request_revision') return 'Revision requested';
    if (actionType === 'approve') return 'Approved';
    if (actionType === 'reject') return 'Rejected';
    if (status === 'approved') return 'Approved';
    if (status === 'rejected') return 'Rejected';
    if (status === 'revision_required') return 'Revision requested';
    if (status === 'bypassed') return 'Dean bypass';
    return entry?.status || 'Updated';
  };

  const copyPageLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success('Link copied to clipboard');
    } catch {
      toast.error('Unable to copy link');
    }
  };

  const handleRequestPublish = async () => {
    const trimmedDoi = doiInput.trim();
    if (!trimmedDoi) {
      toast.error('Enter a DOI before requesting publication');
      return;
    }
    setPublishRequestLoading(true);
    const t = toast.loading('Submitting request…');
    try {
      const response = await researchAPI.requestPublish(id, trimmedDoi);
      setPaper(unwrapApiData(response).paper || paper);
      toast.success('Publish request sent to admin', { id: t });
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to submit request', { id: t });
    } finally {
      setPublishRequestLoading(false);
    }
  };

  const handleCancelPublishRequest = async () => {
    setPublishRequestLoading(true);
    const t = toast.loading('Cancelling request…');
    try {
      const response = await researchAPI.cancelPublishRequest(id);
      setPaper(unwrapApiData(response).paper || paper);
      toast.success('Publish request cancelled', { id: t });
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to cancel request', { id: t });
    } finally {
      setPublishRequestLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="review-screen flex flex-1 min-h-0 flex-col items-center justify-center">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-[#3674B5]/20 rounded-full" />
          <div className="absolute top-0 left-0 w-16 h-16 border-4 border-[#3674B5] border-t-transparent rounded-full animate-spin" />
        </div>
        <p className="mt-6 text-sm font-medium text-slate-600">Loading research paper…</p>
      </div>
    );
  }

  if (!paper) {
    return (
      <div className="review-screen flex flex-1 min-h-0 flex-col">
        <div className="review-screen__inner flex-1 py-8">
          <button
            type="button"
            onClick={() => navigate(backTarget)}
            className="mb-8 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-[#3674B5]/30 transition-colors"
          >
            Back to {backLabel}
          </button>
          <div className="py-16 text-center">
            <FileText size={36} className="mx-auto mb-4 text-slate-300" aria-hidden="true" />
            <h2 className="text-xl font-bold text-slate-900 mb-2">Research paper not found</h2>
            <p className="text-sm text-slate-500 mb-6">The requested paper could not be loaded.</p>
            <button
              type="button"
              onClick={() => navigate(backTarget)}
              className="rounded-lg bg-gradient-to-r from-[#3674B5] to-[#578FCA] px-5 py-2.5 text-sm font-semibold text-white hover:from-[#2d6299] hover:to-[#3674B5] transition-colors"
            >
              Return to {backLabel}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const normalizedKeywords = Array.isArray(paper.keywords)
    ? paper.keywords.filter(Boolean)
    : typeof paper.keywords === 'string'
      ? paper.keywords.split(',').map((keyword) => keyword.trim()).filter(Boolean)
      : [];

  const displayedCoAuthors = getDisplayedCoAuthors();
  const statusConfig = getStatusConfig(paper.status);
  const StatusIcon = statusConfig.icon;
  const previewPdfUrl = stablePreviewPdfUrl;
  const publishedLabel = paper.status === 'published'
    ? `Published ${formatDate(paper.published_date || paper.created_at)}`
    : `In repository ${formatDate(paper.published_date || paper.submission_date || paper.created_at)}`;

  const headerTrailing = (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={copyPageLink}
        className="inline-flex h-8 sm:h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 sm:px-3 text-[11px] sm:text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
      >
        <Share2 size={14} aria-hidden="true" />
        Share
      </button>
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
    </div>
  );

  return (
    <div className="review-screen flex flex-1 min-h-0 flex-col">
      <ReviewDetailNav
        backPath={backTarget}
        breadcrumbs={[
          { label: 'Dashboard', path: '/dashboard' },
          { label: backLabel, path: backTarget },
        ]}
        title={paper.title || 'Untitled manuscript'}
        statusBadge={(
          <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] sm:text-[11px] font-semibold ${statusConfig.badgeColor}`}>
            <StatusIcon size={10} aria-hidden="true" />
            {statusConfig.label}
          </span>
        )}
        trailing={headerTrailing}
      />

      <div className="review-screen__inner flex-1 py-4 sm:py-5 pb-24 lg:pb-8">
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(280px,20rem)] 2xl:grid-cols-[minmax(0,1fr)_minmax(300px,22rem)] gap-4 sm:gap-5 xl:gap-6 items-start">
          <div className="space-y-4 sm:space-y-5 min-w-0">
            <ReviewSection
              id="publication-details"
              icon={FileText}
              title="Publication details"
              description={publishedLabel}
            >
              <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-5">
                <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3">
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Primary author</dt>
                  <dd className="mt-1 text-sm font-semibold text-slate-900">{formatFullName(paper.users) || 'Researcher'}</dd>
                  <dd className="text-xs text-slate-600 flex items-center gap-1 mt-1">
                    <GraduationCap size={12} aria-hidden="true" />
                    National University Dasmariñas
                  </dd>
                </div>
                <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3">
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Publication date</dt>
                  <dd className="mt-1 text-sm font-semibold text-slate-900">
                    {formatDate(paper.published_date || paper.submission_date || paper.created_at)}
                  </dd>
                  <dd className="text-xs text-slate-500 mt-1">{getTimeAgo(paper.published_date || paper.created_at)}</dd>
                </div>
                <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3">
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Engagement</dt>
                  <dd className="mt-1 text-sm font-semibold text-slate-900">{viewCount} views · {downloadCount} downloads</dd>
                  <dd className="text-xs text-slate-500 mt-1">{normalizedKeywords.length} keywords</dd>
                </div>
              </dl>

              {displayedCoAuthors.length > 0 && (
                <div className="mb-5 rounded-lg border border-slate-100 bg-slate-50/50 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Users size={14} className="text-[#3674B5]" aria-hidden="true" />
                    <h4 className="text-sm font-semibold text-slate-900">Co-authors</h4>
                  </div>
                  <p className="text-sm text-slate-700">{displayedCoAuthors.join(', ')}</p>
                </div>
              )}

              {isFormalPublished && paper.doi && (
                <div className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-900">
                  DOI:{' '}
                  <a
                    href={`https://doi.org/${paper.doi}`}
                    className="font-mono underline hover:no-underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {paper.doi}
                  </a>
                </div>
              )}

              {hasPendingDoi && (
                <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
                  DOI:{' '}
                  <a
                    href={`https://doi.org/${paper.doi}`}
                    className="font-mono underline hover:no-underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {paper.doi}
                  </a>
                  <span className="ml-2 text-xs text-amber-700">(pending verification)</span>
                </div>
              )}
            </ReviewSection>

            <ReviewSection
              id="abstract"
              icon={BookOpen}
              title="Abstract"
              description="Summary of the research"
            >
              <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-4">
                <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">{paper.abstract || 'No abstract provided.'}</p>
              </div>
            </ReviewSection>

            {normalizedKeywords.length > 0 && (
              <ReviewSection
                id="keywords"
                icon={Tag}
                title="Keywords"
                description="Topics covered in this paper"
              >
                <div className="flex flex-wrap gap-2">
                  {normalizedKeywords.map((keyword, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 rounded-full bg-[#3674B5]/10 text-[#3674B5] text-xs font-medium border border-[#3674B5]/20"
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
              </ReviewSection>
            )}

            <ReviewSection
              id="manuscript"
              icon={BookOpen}
              title="Manuscript PDF"
              description="Read-only preview with watermark"
              action={user?.role === 'admin' ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#3674B5]">
                  <Download size={12} aria-hidden="true" />
                  Admin download available
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500">
                  <Lock size={12} aria-hidden="true" />
                  View only
                </span>
              )}
            >
              <div className="min-w-0 overflow-hidden rounded-lg border border-slate-100">
                {previewPdfUrl ? (
                  <SecurePDFViewer
                    fileUrl={previewPdfUrl}
                    drawOverlays={drawOverlays}
                  />
                ) : (
                  <div className="h-[min(50vh,28rem)] flex flex-col items-center justify-center gap-2 text-slate-400 bg-slate-50">
                    <FileText size={32} aria-hidden="true" />
                    <p className="text-sm">Preview not available</p>
                  </div>
                )}
              </div>
            </ReviewSection>

            {isAuthorOrCoAuthor && (
              <ReviewSection
                id="reviewer-notes"
                icon={MessageSquare}
                title="Reviewer targeted notes"
                description="Feedback visible to authors and co-authors"
              >
                {annotations.length === 0 ? (
                  <p className="text-sm text-slate-500">No targeted review notes have been added yet.</p>
                ) : (
                  <div className="space-y-3">
                    {annotations
                      .filter((annotation) => !annotation.parentId)
                      .map((annotation) => {
                        const replies = annotations
                          .filter((item) => item.parentId === annotation.id)
                          .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

                        return (
                          <div key={annotation.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                            <p className="text-xs text-slate-500 mb-1">
                              {annotation.reviewerName}
                              {annotation.pageNumber ? ` · Page ${annotation.pageNumber}` : ''}
                              {annotation.sectionLabel ? ` · ${annotation.sectionLabel}` : ''}
                            </p>
                            {annotation.selectedText && (
                              <p className="text-xs text-slate-600 mb-1 italic">
                                &ldquo;{annotation.selectedText}&rdquo;
                              </p>
                            )}
                            {annotation.drawImageUrl && (
                              <img
                                src={annotation.drawImageUrl}
                                alt="Reviewer drawing"
                                className="mb-2 max-h-52 w-full rounded-lg border border-slate-200 object-contain bg-white"
                              />
                            )}
                            {annotation.note?.trim() ? (
                              <p className="text-sm text-slate-800 whitespace-pre-wrap">{annotation.note}</p>
                            ) : null}
                            {replies.length > 0 && (
                              <div className="mt-3 border-l-2 border-slate-200 pl-3 space-y-2">
                                {replies.map((reply) => (
                                  <div key={reply.id} className="rounded-md border border-slate-200 bg-white p-2.5">
                                    <p className="text-xs text-slate-500 mb-1">
                                      {reply.reviewerName}
                                      {reply.pageNumber ? ` · Page ${reply.pageNumber}` : ''}
                                    </p>
                                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{reply.note}</p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                )}
              </ReviewSection>
            )}

            {isAuthorOrCoAuthor && (
              <ReviewSection
                id="workflow-history"
                icon={Clock}
                title="Revision and workflow history"
                description="Status changes and reviewer actions"
              >
                {workflowHistory.length === 0 ? (
                  <p className="text-sm text-slate-500">No workflow actions recorded yet.</p>
                ) : (
                  <div className="space-y-3">
                    {workflowHistory.map((entry) => (
                      <div key={entry.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-800">
                            {formatWorkflowLabel(entry)}
                            <span className="ml-2 text-xs font-normal text-slate-500">
                              by {formatFullName(entry.reviewer) || entry.reviewer_role}
                            </span>
                          </p>
                          <span className="text-xs text-slate-500">{formatDate(entry.reviewed_at || entry.created_at)}</span>
                        </div>
                        {entry.comments ? (
                          <p className="text-sm text-slate-700 mt-1 whitespace-pre-wrap">{entry.comments}</p>
                        ) : null}
                        {(entry.previous_status || entry.new_status) ? (
                          <p className="text-xs text-slate-500 mt-1">
                            {entry.previous_status || 'n/a'} → {entry.new_status || entry.status || 'n/a'}
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </ReviewSection>
            )}
          </div>

          <aside className="space-y-4 sm:space-y-5 xl:sticky xl:top-[3.75rem] xl:self-start xl:max-h-[calc(100dvh-4.5rem)] xl:overflow-y-auto">
            <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
                <h2 className="text-sm font-semibold text-slate-900">At a glance</h2>
              </div>
              <dl className="divide-y divide-slate-100">
                <div className="flex items-center justify-between px-4 py-3">
                  <dt className="text-xs text-slate-500 flex items-center gap-1.5">
                    <Eye size={12} aria-hidden="true" />
                    Views
                  </dt>
                  <dd className="text-sm font-semibold text-slate-900 tabular-nums">{viewCount}</dd>
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <dt className="text-xs text-slate-500 flex items-center gap-1.5">
                    <Download size={12} aria-hidden="true" />
                    Downloads
                  </dt>
                  <dd className="text-sm font-semibold text-slate-900 tabular-nums">{downloadCount}</dd>
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <dt className="text-xs text-slate-500 flex items-center gap-1.5">
                    <Calendar size={12} aria-hidden="true" />
                    Added
                  </dt>
                  <dd className="text-sm font-semibold text-slate-900">{getTimeAgo(paper.published_date || paper.created_at)}</dd>
                </div>
              </dl>
            </section>

            {isAuthorOrCoAuthor && paper.status === 'approved' && (
              <section className="rounded-xl border border-[#3674B5]/20 bg-white shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-[#3674B5]/15 bg-gradient-to-r from-[#3674B5]/10 to-[#578FCA]/10 flex items-center gap-2">
                  <Award size={14} className="text-[#3674B5]" aria-hidden="true" />
                  <h2 className="text-sm font-semibold text-slate-900">Formal publication</h2>
                </div>
                <div className="px-4 py-3 space-y-3">
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Your paper is approved (internal). Enter your journal/repository DOI and request
                    admin review to mark it as formally published.
                  </p>
                  {paper.publish_requested_at ? (
                    <>
                      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
                        Requested {getTimeAgo(paper.publish_requested_at)} — pending admin review.
                        {paper.doi && (
                          <>
                            {' '}DOI:{' '}
                            <a
                              href={`https://doi.org/${paper.doi}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-mono underline hover:no-underline"
                            >
                              {paper.doi}
                            </a>
                          </>
                        )}
                      </div>
                      <button
                        type="button"
                        disabled={publishRequestLoading}
                        onClick={handleCancelPublishRequest}
                        className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                      >
                        Cancel request
                      </button>
                    </>
                  ) : (
                    <>
                      <label className="block text-xs font-semibold text-slate-700">
                        DOI
                        <input
                          type="text"
                          value={doiInput}
                          onChange={(e) => setDoiInput(e.target.value)}
                          placeholder="e.g. 10.1234/nucleus.2026.001"
                          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-mono focus:border-[#3674B5] focus:outline-none focus:ring-2 focus:ring-[#3674B5]/20"
                        />
                      </label>
                      <button
                        type="button"
                        disabled={publishRequestLoading || !doiInput.trim()}
                        onClick={handleRequestPublish}
                        className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-[#3674B5] to-[#578FCA] px-3 py-2 text-xs font-semibold text-white hover:from-[#2d6299] hover:to-[#3674B5] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <Award size={13} aria-hidden="true" />
                        Request to mark as published
                      </button>
                    </>
                  )}
                </div>
              </section>
            )}

            <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
                <ShieldCheck size={14} className="text-[#3674B5]" aria-hidden="true" />
                <h2 className="text-sm font-semibold text-slate-900">Verified research</h2>
              </div>
              <div className="px-4 py-3">
                <p className="text-xs text-slate-600 leading-relaxed">
                  This manuscript has completed peer review and is available in the NUCLEUS repository.
                </p>
              </div>
            </section>

            {relatedPapers.length > 0 && (
              <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
                  <h2 className="text-sm font-semibold text-slate-900">Related studies</h2>
                </div>
                <ul className="divide-y divide-slate-100">
                  {relatedPapers.map((relatedPaper) => (
                    <li key={relatedPaper.id}>
                      <button
                        type="button"
                        onClick={() => navigate(`/research/${relatedPaper.id}`, { state: { from: backTarget } })}
                        className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-lg bg-[#3674B5]/10 flex items-center justify-center shrink-0 mt-0.5">
                            <BookOpen size={14} className="text-[#3674B5]" aria-hidden="true" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-slate-900 line-clamp-2">{relatedPaper.title}</p>
                            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                              <Eye size={11} aria-hidden="true" />
                              {relatedPaper.view_count || 0} views
                            </p>
                          </div>
                          <ChevronRight size={14} className="text-slate-300 shrink-0 mt-1" aria-hidden="true" />
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
                <h2 className="text-sm font-semibold text-slate-900">Share</h2>
              </div>
              <div className="p-4">
                <button
                  type="button"
                  onClick={copyPageLink}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <Copy size={15} aria-hidden="true" />
                  Copy link
                </button>
              </div>
            </section>
          </aside>
        </div>
      </div>

      {paper && previewPdfUrl && (
        <ResearchChat paperId={paper.id} fileUrl={previewPdfUrl} />
      )}
    </div>
  );
};

export default ResearchDetail;
