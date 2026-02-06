import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  FileText, 
  User, 
  Calendar, 
  Download, 
  ExternalLink, 
  Eye, 
  Tag, 
  Users, 
  GraduationCap,
  Clock,
  Building,
  Award,
  Bookmark,
  Share2,
  Copy,
  Printer,
  ChevronRight,
  BookOpen,
  TrendingUp,
  Lightbulb,
  Heart,
  ShieldCheck,
  Maximize2
} from 'lucide-react';
import { researchAPI } from '../../utils/api';
import ResearchChat from '../../components/ai/ResearchChat'; // Add this import

const ResearchDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [paper, setPaper] = useState(null);
  const [loading, setLoading] = useState(true);
  const [relatedPapers, setRelatedPapers] = useState([]);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [downloadCount, setDownloadCount] = useState(0);
  const [viewCount, setViewCount] = useState(0);

  useEffect(() => {
    fetchPaperDetail();
    fetchRelatedPapers();
    trackView();
  }, [id]);

  const fetchPaperDetail = async () => {
    try {
      const response = await researchAPI.getResearchById(id);
      setPaper(response.data.paper);
      setDownloadCount(response.data.paper.download_count || 0);
      setViewCount(response.data.paper.view_count || 0);
    } catch (error) {
      console.error('Failed to fetch paper:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRelatedPapers = async () => {
    try {
      const response = await researchAPI.getPublishedResearch();
      const allPapers = response.data.papers.filter(p => p.id !== id);
      setRelatedPapers(allPapers.slice(0, 3));
    } catch (error) {
      console.error('Failed to fetch related papers:', error);
    }
  };

  const trackView = async () => {
    try {
      await researchAPI.trackView(id);
      setViewCount(prev => prev + 1);
    } catch (error) {
      console.error('Failed to track view:', error);
    }
  };

  const handleDownload = async () => {
    try {
      await researchAPI.trackDownload(id);
      window.open(paper.file_url, '_blank');
      setDownloadCount(prev => prev + 1);
    } catch (error) {
      console.error('Download error:', error);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Date not available';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getTimeAgo = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-50 to-white">
        <div className="text-center">
          <div className="relative">
            <div className="w-20 h-20 border-4 border-indigo-100 rounded-full"></div>
            <div className="absolute top-0 left-0 w-20 h-20 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
          <p className="mt-6 text-lg font-medium text-slate-600 animate-pulse">Loading research paper...</p>
        </div>
      </div>
    );
  }

  if (!paper) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <button
            onClick={() => navigate('/student/browse')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-slate-100 to-white border border-slate-300 text-slate-700 hover:border-indigo-300 transition-colors mb-8"
          >
            <ArrowLeft size={18} />
            Back to Repository
          </button>
          <div className="text-center py-16">
            <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-slate-100 to-white flex items-center justify-center mx-auto mb-6">
              <FileText size={40} className="text-slate-400" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-3">Research paper not found</h2>
            <p className="text-slate-600 mb-8">The requested research paper could not be loaded.</p>
            <button
              onClick={() => navigate('/student/browse')}
              className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-xl font-bold hover:from-indigo-700 hover:to-blue-700 transition-all duration-300"
            >
              Return to Repository
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/student/browse')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-slate-100 to-white border border-slate-300 text-slate-700 hover:border-indigo-300 transition-colors mb-6 group"
          >
            <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
            Back to Repository
          </button>

          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6 mb-8">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-500 flex items-center justify-center shadow-lg">
                  <BookOpen size={28} className="text-white" />
                </div>
                <div>
                  <h1 className="text-3xl md:text-4xl font-black text-slate-900 mb-2">
                    Research <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-blue-600">Details</span>
                  </h1>
                  <div className="flex items-center gap-4">
                    <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-bold bg-gradient-to-r from-emerald-100 to-green-100 text-emerald-800 border border-emerald-200">
                      <ShieldCheck size={14} />
                      Published
                    </span>
                    <span className="text-sm text-slate-600 font-medium">
                      Published {formatDate(paper.published_date || paper.created_at)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-bold hover:from-indigo-700 hover:to-blue-700 transition-all duration-300"
              >
                <Download size={18} />
                Download PDF
              </button>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Paper Details */}
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
              <div className="px-8 py-6 bg-gradient-to-r from-slate-50 to-white border-b border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-100 to-blue-100 flex items-center justify-center">
                    <FileText size={20} className="text-indigo-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">Research Information</h2>
                    <p className="text-slate-600 text-sm">Complete details and preview</p>
                  </div>
                </div>
              </div>

              <div className="p-8">
                <h3 className="text-2xl font-bold text-slate-900 mb-6">{paper.title}</h3>

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                  <div className="text-center p-4 rounded-xl bg-gradient-to-r from-slate-50 to-white border border-slate-200">
                    <div className="text-2xl font-black text-slate-900">{viewCount}</div>
                    <div className="text-sm text-slate-600 font-medium">Views</div>
                  </div>
                  <div className="text-center p-4 rounded-xl bg-gradient-to-r from-slate-50 to-white border border-slate-200">
                    <div className="text-2xl font-black text-indigo-600">{downloadCount}</div>
                    <div className="text-sm text-slate-600 font-medium">Downloads</div>
                  </div>
                  <div className="text-center p-4 rounded-xl bg-gradient-to-r from-slate-50 to-white border border-slate-200">
                    <div className="text-2xl font-black text-emerald-600">
                      {paper.published_date ? getTimeAgo(paper.published_date) : 'N/A'}
                    </div>
                    <div className="text-sm text-slate-600 font-medium">Published</div>
                  </div>
                  <div className="text-center p-4 rounded-xl bg-gradient-to-r from-slate-50 to-white border border-slate-200">
                    <div className="text-2xl font-black text-amber-600">
                      {paper.keywords?.length || 0}
                    </div>
                    <div className="text-sm text-slate-600 font-medium">Keywords</div>
                  </div>
                </div>

                {/* Abstract */}
                <div className="mb-8">
                  <div className="flex items-center gap-2 mb-4">
                    <Lightbulb size={18} className="text-indigo-600" />
                    <h4 className="text-lg font-bold text-slate-900">Abstract</h4>
                  </div>
                  <div className="p-4 rounded-xl bg-gradient-to-r from-slate-50 to-white border border-slate-200">
                    <p className="text-slate-700 whitespace-pre-line leading-relaxed">{paper.abstract}</p>
                  </div>
                </div>

                {/* PDF PREVIEW SECTION */}
                <div className="mb-8">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Maximize2 size={18} className="text-indigo-600" />
                      <h4 className="text-lg font-bold text-slate-900">Document Preview</h4>
                    </div>
                    <button 
                      onClick={() => window.open(paper.file_url, '_blank')}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                    >
                      <ExternalLink size={14} />
                      Full Screen
                    </button>
                  </div>
                  <div className="rounded-2xl border-2 border-slate-200 overflow-hidden bg-slate-100 shadow-inner">
                    {paper.file_url ? (
                      <iframe
                        src={`${paper.file_url}#toolbar=0&navpanes=0`}
                        width="100%"
                        height="600px"
                        title="Research PDF Preview"
                        className="w-full"
                      />
                    ) : (
                      <div className="h-[300px] flex items-center justify-center text-slate-400">
                        Preview not available
                      </div>
                    )}
                  </div>
                </div>

                {/* Author Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  <div className="flex items-start gap-4 p-4 rounded-xl bg-gradient-to-r from-slate-50 to-white border border-slate-200">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-100 to-cyan-100 flex items-center justify-center flex-shrink-0">
                      <User size={20} className="text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900 mb-1">Primary Author</p>
                      <p className="text-lg font-bold text-slate-900">{paper.users?.full_name || 'Researcher'}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <GraduationCap size={14} className="text-slate-500" />
                        <span className="text-sm text-slate-600">National University Dasmariñas</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 p-4 rounded-xl bg-gradient-to-r from-slate-50 to-white border border-slate-200">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-100 to-violet-100 flex items-center justify-center flex-shrink-0">
                      <Calendar size={20} className="text-purple-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900 mb-1">Publication Date</p>
                      <p className="text-lg font-bold text-slate-900">{formatDate(paper.published_date || paper.created_at)}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Clock size={14} className="text-slate-500" />
                        <span className="text-sm text-slate-600">Verified Submission</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Co-Authors */}
                {paper.co_authors && (
                  <div className="mb-8">
                    <div className="flex items-center gap-2 mb-3">
                      <Users size={18} className="text-indigo-600" />
                      <h4 className="text-lg font-bold text-slate-900">Co-Authors</h4>
                    </div>
                    <div className="p-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200">
                      <p className="text-slate-700">{paper.co_authors}</p>
                    </div>
                  </div>
                )}

                {/* Keywords */}
                {paper.keywords && paper.keywords.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Tag size={18} className="text-indigo-600" />
                      <h4 className="text-lg font-bold text-slate-900">Keywords</h4>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {paper.keywords.map((keyword, index) => (
                        <span
                          key={index}
                          className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-100 to-blue-100 text-indigo-700 text-sm font-medium border border-indigo-200"
                        >
                          {keyword}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Sidebar */}
          <div className="space-y-8">
            <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-white border-b border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-100 to-cyan-100 flex items-center justify-center">
                    <Building size={20} className="text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">Institution</h3>
                    <p className="text-slate-600 text-sm">NU Dasmariñas</p>
                  </div>
                </div>
              </div>
              
              <div className="p-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-100 to-blue-100 flex items-center justify-center">
                      <Award size={20} className="text-indigo-600" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">Verified Research</p>
                      <p className="text-sm text-slate-600">Faculty Approved</p>
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200">
                    <p className="text-xs text-emerald-700 font-medium">
                      This research has been peer-reviewed and approved for publication in the repository.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {relatedPapers.length > 0 && (
              <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-white border-b border-slate-200">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-100 to-violet-100 flex items-center justify-center">
                      <TrendingUp size={20} className="text-purple-600" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-900">Related Studies</h3>
                      <p className="text-slate-600 text-sm">Similar topics</p>
                    </div>
                  </div>
                </div>
                
                <div className="p-6">
                  <div className="space-y-4">
                    {relatedPapers.map((relatedPaper) => (
                      <div
                        key={relatedPaper.id}
                        onClick={() => navigate(`/research/${relatedPaper.id}`)}
                        className="group p-4 rounded-xl bg-gradient-to-r from-slate-50 to-white border border-slate-200 hover:border-indigo-300 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center flex-shrink-0">
                            <BookOpen size={16} className="text-amber-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-slate-900 group-hover:text-indigo-700 transition-colors truncate">
                              {relatedPaper.title}
                            </h4>
                            <div className="flex items-center gap-2 mt-1">
                              <Eye size={12} className="text-slate-500" />
                              <span className="text-xs text-slate-500">{relatedPaper.view_count || 0} views</span>
                            </div>
                          </div>
                          <ChevronRight size={16} className="text-slate-400 group-hover:text-indigo-600 transition-colors" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-white border-b border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center">
                    <Share2 size={20} className="text-amber-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">Share & Save</h3>
                    <p className="text-slate-600 text-sm">Spread the knowledge</p>
                  </div>
                </div>
              </div>
              
              <div className="p-6">
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setIsBookmarked(!isBookmarked)}
                    className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border transition-colors ${
                      isBookmarked
                        ? 'bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200 text-amber-700'
                        : 'bg-gradient-to-r from-slate-100 to-white border-slate-300 text-slate-700 hover:border-amber-300'
                    }`}
                  >
                    <Bookmark size={16} fill={isBookmarked ? "currentColor" : "none"} />
                    <span className="text-sm font-medium">{isBookmarked ? 'Saved' : 'Save'}</span>
                  </button>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(window.location.href);
                      toast.success('Link copied to clipboard! 🔗', {
                        duration: 2000,
                      });
                    }}
                    className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-slate-100 to-white border border-slate-300 text-slate-700 hover:border-indigo-300 transition-colors"
                  >
                    <Copy size={16} />
                    <span className="text-sm font-medium">Link</span>
                  </button>
                  <button className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-slate-100 to-white border border-slate-300 text-slate-700 hover:border-indigo-300 transition-colors">
                    <Printer size={16} />
                    <span className="text-sm font-medium">Print</span>
                  </button>
                  <button className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-slate-100 to-white border border-slate-300 text-slate-700 hover:border-indigo-300 transition-colors">
                    <Heart size={16} />
                    <span className="text-sm font-medium">Like</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* AI Chat Component - Floats over the page */}
      {paper && paper.file_url && (
        <ResearchChat 
          paperId={paper.id} 
          fileUrl={paper.file_url} 
        />
      )}
    </div>
  );
};

export default ResearchDetail;