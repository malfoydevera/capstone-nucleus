import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, 
  Filter, 
  Eye, 
  Calendar, 
  User, 
  Tag, 
  FileText, 
  ExternalLink,
  Grid,
  List,
  TrendingUp,
  ChevronRight,
  Hash,
  Clock,
  BookOpen,
  GraduationCap,
  Building,
  Award,
  Star,
  Sparkles,
  X,
  ChevronDown,
  SortAsc,
  RefreshCw,
  Info,
  Bookmark,
  Share2,
  Copy,
  Heart
} from 'lucide-react';
import { researchAPI } from '../../utils/api';
import { formatFullName } from '../../utils/names';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const getPaperAuthors = (paper) => {
  if (Array.isArray(paper?.structured_authors) && paper.structured_authors.length > 0) {
    return paper.structured_authors;
  }

  const fallbackAuthors = [];

  if (paper?.users) {
    fallbackAuthors.push({ author: paper.users, is_primary: true, author_order: 0 });
  }

  const compatibilityAuthors = paper?.external_author_notes;
  if (Array.isArray(compatibilityAuthors)) {
    fallbackAuthors.push(...compatibilityAuthors);
  } else if (compatibilityAuthors) {
    String(compatibilityAuthors)
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .forEach((name, index) => {
        fallbackAuthors.push({
          author: { name },
          is_primary: false,
          author_order: index + 1,
        });
      });
  }

  return fallbackAuthors;
};

const getPrimaryAuthor = (paper) => {
  const authors = getPaperAuthors(paper);
  return authors.find((entry) => entry?.is_primary)?.author || authors[0]?.author || paper?.users || null;
};

const getAdditionalAuthors = (paper) =>
  getPaperAuthors(paper).filter((entry) => !entry?.is_primary);

const getRepositoryListingBadge = (paper) => {
  if (paper?.status === 'published') {
    return { label: 'Published', className: 'bg-emerald-100 text-emerald-800 border border-emerald-200' };
  }
  if (paper?.status === 'approved') {
    return { label: 'Internal (approved)', className: 'bg-amber-50 text-amber-900 border border-amber-200' };
  }
  return { label: 'Repository', className: 'bg-slate-100 text-slate-700 border border-slate-200' };
};

const FacultyBrowseRepository = () => {
  const navigate = useNavigate();
  const [papers, setPapers] = useState([]);
  const [filteredPapers, setFilteredPapers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [authorSearch, setAuthorSearch] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [viewMode, setViewMode] = useState('grid');
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [expandedPaper, setExpandedPaper] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    filterAndSortPapers();
  }, [papers, searchTerm, selectedCategory, selectedYear, authorSearch, sortBy]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [papersResponse, categoriesResponse] = await Promise.all([
        researchAPI.getPublishedResearch(),
        researchAPI.getCategories(),
      ]);

      const approvedPapers = papersResponse.data.papers || [];
      setPapers(approvedPapers);
      setCategories(categoriesResponse.data.categories || []);
    } catch (error) {
      console.error('Failed to fetch research papers:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterAndSortPapers = () => {
    let filtered = [...papers];

    // Apply filters
    if (searchTerm) {
      filtered = filtered.filter(paper =>
        paper.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        paper.abstract?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        paper.keywords?.some(keyword => 
          keyword.toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }

    if (selectedCategory) {
      filtered = filtered.filter(paper => paper.category === selectedCategory);
    }

    if (selectedYear) {
      filtered = filtered.filter(paper => {
        const paperYear = new Date(paper.submission_date || paper.created_at).getFullYear();
        return paperYear.toString() === selectedYear;
      });
    }

    if (authorSearch) {
      const normalizedAuthorSearch = authorSearch.toLowerCase();
      filtered = filtered.filter((paper) =>
        getPaperAuthors(paper).some((entry) =>
          formatFullName(entry?.author).toLowerCase().includes(normalizedAuthorSearch)
        )
      );
    }

    // Apply sorting
    switch (sortBy) {
      case 'newest':
        filtered.sort((a, b) => new Date(b.submission_date || b.created_at) - new Date(a.submission_date || a.created_at));
        break;
      case 'oldest':
        filtered.sort((a, b) => new Date(a.submission_date || a.created_at) - new Date(b.submission_date || b.created_at));
        break;
      case 'title':
        filtered.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
        break;
      case 'author':
        filtered.sort((a, b) => formatFullName(getPrimaryAuthor(a)).localeCompare(formatFullName(getPrimaryAuthor(b))));
        break;
      default:
        break;
    }

    setFilteredPapers(filtered);
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

  const truncateText = (text, maxLength = 150) => {
    if (!text) return 'No description available';
    if (text.length <= maxLength) return text;
    return text.substr(0, maxLength) + '...';
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedCategory('');
    setSelectedYear('');
    setAuthorSearch('');
    setSortBy('newest');
  };

  const getAvailableYears = () => {
    const years = papers.map(paper => {
      const date = new Date(paper.submission_date || paper.created_at);
      return date.getFullYear();
    });
    return [...new Set(years)].sort((a, b) => b - a);
  };

  const handleViewPaper = (paperId) => {
    navigate(`/faculty/research/${paperId}`);
  };

  const getCategoryName = (categoryId) => {
    if (!categoryId) return 'General';
    const category = categories.find((entry) => entry.id === categoryId);
    if (category) return category.name;
    if (typeof categoryId === 'string' && !UUID_PATTERN.test(categoryId)) return categoryId;
    return 'General';
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    // You could show a toast notification here
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="relative">
          <div className="w-20 h-20 border-4 border-[#1C4D8D]/20 rounded-full"></div>
          <div className="absolute top-0 left-0 w-20 h-20 border-4 border-[#1C4D8D] border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#1C4D8D] to-[#2563eb] flex items-center justify-center shadow-lg">
              <BookOpen size={28} className="text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Research Repository</h1>
              <p className="text-gray-600 mt-1">Browse and explore approved research papers</p>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white/70 backdrop-blur-sm rounded-xl p-4 border border-white/20 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <FileText size={20} className="text-[#1C4D8D]" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{filteredPapers.length}</p>
                  <p className="text-sm text-gray-600">Research Papers</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white/70 backdrop-blur-sm rounded-xl p-4 border border-white/20 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                  <Tag size={20} className="text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{categories.length}</p>
                  <p className="text-sm text-gray-600">Categories</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white/70 backdrop-blur-sm rounded-xl p-4 border border-white/20 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                  <GraduationCap size={20} className="text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{getAvailableYears().length}</p>
                  <p className="text-sm text-gray-600">Years Available</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white/70 backdrop-blur-sm rounded-xl p-4 border border-white/20 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                  <TrendingUp size={20} className="text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">100%</p>
                  <p className="text-sm text-gray-600">Approved</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 mb-8 border border-white/20 shadow-lg">
          <div className="flex flex-col lg:flex-row gap-4 mb-4">
            {/* Main Search */}
            <div className="flex-1">
              <div className="relative">
                <Search size={20} className="absolute left-3 top-3 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search papers by title, abstract, or keywords..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1C4D8D] focus:border-transparent bg-white/90 backdrop-blur-sm"
                />
              </div>
            </div>

            {/* Author Search */}
            <div className="lg:w-64">
              <div className="relative">
                <User size={20} className="absolute left-3 top-3 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by author..."
                  value={authorSearch}
                  onChange={(e) => setAuthorSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1C4D8D] focus:border-transparent bg-white/90 backdrop-blur-sm"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex flex-wrap gap-3 items-center">
              {/* Category Filter */}
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#1C4D8D] focus:border-transparent bg-white/90 backdrop-blur-sm"
              >
                <option value="">All Categories</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>

              {/* Year Filter */}
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#1C4D8D] focus:border-transparent bg-white/90 backdrop-blur-sm"
              >
                <option value="">All Years</option>
                {getAvailableYears().map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>

              {/* Sort By */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#1C4D8D] focus:border-transparent bg-white/90 backdrop-blur-sm"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="title">Title A-Z</option>
                <option value="author">Author A-Z</option>
              </select>

              {/* Clear Filters */}
              {(searchTerm || selectedCategory || selectedYear || authorSearch || sortBy !== 'newest') && (
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  <X size={14} />
                  Clear All
                </button>
              )}
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-md transition-colors ${
                  viewMode === 'grid' 
                    ? 'bg-white text-[#1C4D8D] shadow-sm' 
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                <Grid size={16} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-md transition-colors ${
                  viewMode === 'list' 
                    ? 'bg-white text-[#1C4D8D] shadow-sm' 
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                <List size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Results */}
        {filteredPapers.length === 0 ? (
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-12 text-center border border-white/20 shadow-lg">
            <div className="w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Search size={32} className="text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Papers Found</h3>
            <p className="text-gray-600 mb-4">
              No research papers match your current search criteria.
            </p>
            <button
              onClick={clearFilters}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#1C4D8D] to-[#2563eb] text-white rounded-lg hover:from-[#1a4374] hover:to-[#1d4ed8] transition-all duration-300 mx-auto"
            >
              <RefreshCw size={16} />
              Clear Filters
            </button>
          </div>
        ) : (
          <div className={`grid gap-6 ${
            viewMode === 'grid' 
              ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' 
              : 'grid-cols-1'
          }`}>
            {filteredPapers.map((paper) => (
              <div
                key={paper.id}
                className={`bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden group ${
                  viewMode === 'list' ? 'flex' : ''
                }`}
              >
                {(() => {
                  const primaryAuthor = getPrimaryAuthor(paper);
                  const additionalAuthors = getAdditionalAuthors(paper);

                  return (
                    <>
                {/* Paper Content */}
                <div className={`p-6 ${viewMode === 'list' ? 'flex-1' : ''}`}>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-[#1C4D8D] transition-colors">
                        {paper.title || 'Untitled Research'}
                      </h3>
                      
                      <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                        <div className="flex items-center gap-1">
                          <User size={14} />
                          <span>{formatFullName(primaryAuthor) || 'Unknown Author'}</span>
                          {additionalAuthors.length > 0 && (
                            <span className="text-gray-400">+{additionalAuthors.length} co-author{additionalAuthors.length === 1 ? '' : 's'}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar size={14} />
                          <span>{formatDate(paper.submission_date || paper.created_at)}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mb-3 flex-wrap">
                        {paper.category ? (
                          <span className="px-3 py-1 bg-[#1C4D8D]/10 text-[#1C4D8D] text-xs font-medium rounded-full">
                            {getCategoryName(paper.category)}
                          </span>
                        ) : null}
                        {(() => {
                          const b = getRepositoryListingBadge(paper);
                          return (
                            <span className={`px-3 py-1 text-xs font-semibold rounded-full ${b.className}`}>
                              {b.label}
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                  </div>

                  <p className="text-gray-700 text-sm leading-relaxed mb-4">
                    {truncateText(paper.abstract)}
                  </p>

                  {/* Keywords */}
                  {paper.keywords && paper.keywords.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {paper.keywords.slice(0, 3).map((keyword, index) => (
                        <span
                          key={index}
                          className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-lg"
                        >
                          #{keyword}
                        </span>
                      ))}
                      {paper.keywords.length > 3 && (
                        <span className="px-2 py-1 bg-gray-100 text-gray-500 text-xs rounded-lg">
                          +{paper.keywords.length - 3} more
                        </span>
                      )}
                    </div>
                  )}

                  {/* Authors */}
                  {additionalAuthors.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs text-gray-500 mb-1">Co-authors:</p>
                      <div className="flex flex-wrap gap-1">
                        {additionalAuthors.slice(0, 2).map((authorEntry, index) => (
                          <span
                            key={index}
                            className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-lg"
                          >
                            {formatFullName(authorEntry.author)}
                          </span>
                        ))}
                        {additionalAuthors.length > 2 && (
                          <span className="px-2 py-1 bg-blue-50 text-blue-500 text-xs rounded-lg">
                            +{additionalAuthors.length - 2} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className={`p-6 pt-0 ${viewMode === 'list' ? 'flex items-end' : ''}`}>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleViewPaper(paper.id)}
                      className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#1C4D8D] to-[#2563eb] text-white rounded-lg hover:from-[#1a4374] hover:to-[#1d4ed8] transition-all duration-300 text-sm font-medium shadow-lg"
                    >
                      <Eye size={14} />
                      View Details
                    </button>
                    
                    <button
                      onClick={() => copyToClipboard(window.location.origin + `/research/${paper.id}`)}
                      className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                      title="Copy link"
                    >
                      <Copy size={14} />
                    </button>
                  </div>
                </div>
                    </>
                  );
                })()}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FacultyBrowseRepository;
