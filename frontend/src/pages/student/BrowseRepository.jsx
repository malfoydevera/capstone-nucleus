import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Search,
  Download,
  Eye,
  Calendar,
  User,
  Tag,
  FileText,
  Grid,
  List,
  X,
  SortAsc,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { researchAPI, unwrapApiData } from '../../utils/api';
import { formatFullName } from '../../utils/names';
import RepositoryFilterBar from '../../components/repository/RepositoryFilterBar';

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

// Visual treatment for the AI semantic similarity score (0..1 -> percentage).
const SimilarityBadge = ({ score }) => {
  if (score == null) return null;
  const pct = Math.round((Number(score) || 0) * 100);
  const tone =
    pct >= 75
      ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
      : pct >= 50
        ? 'bg-[#3674B5]/10 text-[#3674B5] border-[#3674B5]/20'
        : 'bg-slate-100 text-slate-600 border-slate-200';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${tone}`}
      title="AI semantic similarity to your search"
    >
      <Sparkles size={12} />
      {pct}% match
    </span>
  );
};

/** Repository listing includes approved (internal) and published papers */
const getRepositoryListingBadge = (paper) => {
  if (paper?.status === 'published') {
    return { label: 'Published', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
  }
  if (paper?.status === 'approved') {
    return { label: 'Internal (approved)', className: 'bg-amber-50 text-amber-900 border-amber-200' };
  }
  return { label: 'Repository', className: 'bg-slate-100 text-slate-700 border-slate-200' };
};

const SORT_API_MAP = {
  newest: 'newest',
  oldest: 'oldest',
  title: 'title',
  most_viewed: 'newest',
  most_downloaded: 'newest',
};

const BrowseRepository = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [papers, setPapers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [facets, setFacets] = useState({ categories: [] });
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [aiMode, setAiMode] = useState(true);
  const [searchError, setSearchError] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedThemes, setSelectedThemes] = useState([]);
  const [selectedYear, setSelectedYear] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [viewMode, setViewMode] = useState('grid');
  const [expandedPaper, setExpandedPaper] = useState(null);
  const [availableYears, setAvailableYears] = useState([]);

  const [stats, setStats] = useState({
    totalPapers: 0,
    totalAuthors: 0,
    totalDownloads: 0,
    totalViews: 0,
  });

  useEffect(() => {
    // Slightly longer debounce: AI mode issues an embedding call per distinct query.
    const timer = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 450);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, selectedCategory, selectedThemes, selectedYear, sortBy, aiMode]);

  // AI hybrid search is used when the toggle is on AND there is a usable query.
  const isAiSearch = aiMode && debouncedSearch.length >= 2;

  const fetchPapers = useCallback(async ({ pageNum = 1, append = false } = {}) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    setSearchError('');
    const useAi = aiMode && debouncedSearch.length >= 2;
    try {
      const sortParam = SORT_API_MAP[sortBy] || 'newest';
      const params = {
        page: pageNum,
        limit: 20,
        sort: sortParam,
        ...(debouncedSearch && { q: debouncedSearch }),
        ...(selectedCategory && { category: selectedCategory }),
        ...(selectedThemes.length > 0 && { themes: selectedThemes.join(',') }),
        ...(selectedYear && { year: selectedYear }),
      };

      // In AI mode the search bar runs the semantic + keyword hybrid endpoint.
      // Falls back to keyword search if AI is unavailable (503/500).
      let papersRes;
      let usedAi = useAi;
      if (useAi) {
        try {
          papersRes = await researchAPI.semanticSearch({
            page: pageNum,
            limit: 20,
            q: debouncedSearch,
            ...(selectedYear && { year: selectedYear }),
          });
        } catch (aiError) {
          const status = aiError?.response?.status;
          if (status === 429) throw aiError;
          // Graceful degradation: show keyword results while AI is unavailable.
          console.warn('AI search unavailable, falling back to keyword search:', aiError?.message);
          setSearchError('AI search is temporarily unavailable — showing keyword results.');
          papersRes = await researchAPI.getPublishedResearch(params);
          usedAi = false;
        }
      } else {
        papersRes = await researchAPI.getPublishedResearch(params);
      }

      const categoriesRes = categories.length
        ? null
        : await researchAPI.getCategories().catch(() => null);

      const payload = unwrapApiData(papersRes);
      const nextPapers = payload.papers || [];
      setPapers((prev) => (append ? [...prev, ...nextPapers] : nextPapers));
      setTotal(payload.total ?? nextPapers.length);
      setPage(pageNum);
      setFacets(usedAi ? { categories: [] } : (payload.facets || { categories: [] }));

      if (categoriesRes) {
        const categoryPayload = unwrapApiData(categoriesRes);
        setCategories(categoryPayload.categories || []);
      }

      const years = [...new Set(
        nextPapers
          .map((p) => new Date(p.published_date || p.created_at).getFullYear())
          .filter((year) => !Number.isNaN(year))
      )].sort((a, b) => b - a);
      if (years.length > 0) setAvailableYears(years);

      const uniqueAuthors = new Set(
        nextPapers.flatMap((paper) =>
          getPaperAuthors(paper)
            .map((entry) => entry?.author?.id || formatFullName(entry?.author))
            .filter(Boolean)
        )
      );

      setStats({
        totalPapers: payload.total ?? nextPapers.length,
        totalAuthors: uniqueAuthors.size,
        totalDownloads: nextPapers.reduce((sum, p) => sum + (p.download_count || 0), 0),
        totalViews: nextPapers.reduce((sum, p) => sum + (p.view_count || 0), 0),
      });
    } catch (error) {
      console.error('Failed to fetch repository data:', error);
      const status = error?.response?.status;
      if (useAi && status === 429) {
        setSearchError('Too many AI searches right now. Please wait a moment and try again.');
      } else if (useAi) {
        setSearchError('AI search failed. Try again or switch off AI search for keyword results.');
      }
      if (!append) {
        setPapers([]);
        setTotal(0);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [
    debouncedSearch,
    selectedCategory,
    selectedThemes,
    selectedYear,
    sortBy,
    categories.length,
    aiMode,
  ]);

  useEffect(() => {
    fetchPapers({ pageNum: 1, append: false });
  }, [fetchPapers]);

  const canLoadMore = papers.length < total;
  const handleLoadMore = () => {
    if (!canLoadMore || loadingMore) return;
    fetchPapers({ pageNum: page + 1, append: true });
  };

  const filteredPapers = isAiSearch
    ? papers // preserve AI relevance ranking
    : [...papers].sort((a, b) => {
        if (sortBy === 'most_viewed') return (b.view_count || 0) - (a.view_count || 0);
        if (sortBy === 'most_downloaded') return (b.download_count || 0) - (a.download_count || 0);
        return 0;
      });

  const toggleTheme = (categoryId) => {
    setSelectedThemes((prev) =>
      prev.includes(categoryId) ? prev.filter((id) => id !== categoryId) : [...prev, categoryId]
    );
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Date not available';
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getCategoryName = (categoryId) => {
    if (!categoryId) return 'General';
    const category = categories.find(cat => cat.id === categoryId);
    if (category) return category.name;
    if (typeof categoryId === 'string' && !UUID_PATTERN.test(categoryId)) return categoryId;
    return 'General';
  };

  const getCategoryColor = (categoryId) => {
    const colors = [
      'from-[#3674B5] to-[#578FCA]',
      'from-[#578FCA] to-[#3674B5]',
      'from-[#3674B5] to-teal-500',
      'from-green-500 to-emerald-500',
      'from-amber-500 to-orange-500',
      'from-red-500 to-pink-500',
      'from-teal-500 to-green-500',
      'from-[#3674B5] to-cyan-500'
    ];
    if (!categoryId) return 'from-gray-500 to-slate-500';
    const index = categories.findIndex(cat => cat.id === categoryId);
    return colors[index % colors.length] || 'from-gray-500 to-slate-500';
  };

  const handleViewDetails = (paper) => {
    navigate(`/research/${paper.id}`, { state: { from: location.pathname } });
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedCategory('');
    setSelectedThemes([]);
    setSelectedYear('');
    setSortBy('newest');
  };

  const activeFilterCount = () => {
    let count = 0;
    if (searchTerm) count++;
    if (selectedCategory) count++;
    if (selectedThemes.length) count += selectedThemes.length;
    if (selectedYear) count++;
    return count;
  };

  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear();
    const generated = Array.from({ length: 15 }, (_, i) => current - i);
    return [...new Set([...availableYears, ...generated])].sort((a, b) => b - a);
  }, [availableYears]);

  const togglePaperExpand = (paperId, e) => {
    e.stopPropagation();
    setExpandedPaper(expandedPaper === paperId ? null : paperId);
  };

  const sortOptions = [
    { value: 'newest', label: 'Newest First', icon: Calendar },
    { value: 'oldest', label: 'Oldest First', icon: Calendar },
    { value: 'most_viewed', label: 'Most Viewed', icon: Eye },
    { value: 'most_downloaded', label: 'Most Downloaded', icon: Download },
    { value: 'title', label: 'Title (A-Z)', icon: SortAsc },
  ];

  const thematicCategories = facets.categories?.length
    ? facets.categories
    : categories.map((category) => ({ id: category.id, name: category.name, count: null }));

  const filterBarProps = {
    selectedCategory,
    onCategoryChange: setSelectedCategory,
    categories,
    selectedYear,
    onYearChange: setSelectedYear,
    yearOptions,
    sortBy,
    onSortChange: setSortBy,
    sortOptions,
    sortDisabled: isAiSearch,
    onClear: clearFilters,
    hasActiveFilters: activeFilterCount() > 0,
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-50 to-white">
        <div className="text-center">
          <div className="relative">
            <div className="w-20 h-20 border-4 border-[#3674B5]/20 rounded-full"></div>
            <div className="absolute top-0 left-0 w-20 h-20 border-4 border-[#3674B5] border-t-transparent rounded-full animate-spin"></div>
          </div>
          <p className="mt-6 text-lg font-medium text-slate-600 animate-pulse">Loading research repository...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Centered search + filters */}
        <div className="max-w-3xl mx-auto mb-10 text-center">
          <div className="mb-8">
            <p className="text-sm font-semibold text-[#3674B5] mb-2">National University Dasmariñas</p>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">Research Repository</h1>
            <p className="text-base text-slate-600">
              Browse approved research from the NU community.
            </p>
          </div>

          {/* Search */}
          <div className="relative mb-4">
            <label htmlFor="repository-search" className="sr-only">Search research papers</label>
            {aiMode ? (
              <Sparkles className="absolute left-4 top-1/2 -translate-y-1/2 text-[#3674B5]" size={20} aria-hidden="true" />
            ) : (
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} aria-hidden="true" />
            )}
            <input
              id="repository-search"
              type="search"
              placeholder={aiMode ? 'Search by topic or meaning...' : 'Search papers, authors, keywords...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full min-h-[3rem] pl-11 pr-28 py-3 bg-white border border-slate-200 rounded-2xl text-slate-900 placeholder-slate-400 shadow-sm focus:outline-none focus:border-[#3674B5] focus:ring-4 focus:ring-[#3674B5]/10 text-base"
            />
            <button
              type="button"
              onClick={() => setAiMode((prev) => !prev)}
              aria-pressed={aiMode}
              aria-label={aiMode ? 'Disable AI search' : 'Enable AI search'}
              className={`absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center gap-1.5 min-h-[2.5rem] px-3 rounded-xl text-sm font-semibold border transition-colors ${
                aiMode
                  ? 'bg-[#3674B5] text-white border-[#3674B5] hover:bg-[#2d6299]'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-[#578FCA]'
              }`}
            >
              <Sparkles size={15} aria-hidden="true" />
              AI
            </button>
          </div>

          {searchError && (
            <div className="mb-4 flex items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
              <span>{searchError}</span>
              <button type="button" onClick={() => setSearchError('')} className="p-1 hover:bg-amber-100 rounded-md" aria-label="Dismiss">
                <X size={14} />
              </button>
            </div>
          )}

          {/* Compact filter row */}
          <RepositoryFilterBar {...filterBarProps} idPrefix="repo-filter" />

          {/* Theme chips */}
          {thematicCategories.length > 0 && (
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {thematicCategories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => toggleTheme(category.id)}
                  aria-pressed={selectedThemes.includes(category.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    selectedThemes.includes(category.id)
                      ? 'bg-[#3674B5] text-white border-[#3674B5]'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-[#578FCA]'
                  }`}
                >
                  {category.name}
                  {category.count != null ? ` (${category.count})` : ''}
                </button>
              ))}
            </div>
          )}

          {/* Results summary + view toggle */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-sm text-slate-600">
            <span>
              <span className="font-semibold text-slate-900">{total}</span> paper{total === 1 ? '' : 's'}
              {isAiSearch ? ' · ranked by relevance' : ''}
            </span>
            <div className="flex rounded-lg border border-slate-200 bg-white p-0.5" role="group" aria-label="View mode">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                aria-pressed={viewMode === 'grid'}
                className={`inline-flex h-8 w-8 items-center justify-center rounded-md transition-all ${
                  viewMode === 'grid' ? 'bg-[#3674B5]/10 text-[#3674B5]' : 'text-slate-400 hover:text-slate-600'
                }`}
                title="Grid view"
              >
                <Grid size={16} />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                aria-pressed={viewMode === 'list'}
                className={`inline-flex h-8 w-8 items-center justify-center rounded-md transition-all ${
                  viewMode === 'list' ? 'bg-[#3674B5]/10 text-[#3674B5]' : 'text-slate-400 hover:text-slate-600'
                }`}
                title="List view"
              >
                <List size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Papers Grid/List */}
        {filteredPapers.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center mx-auto mb-6">
              <FileText size={32} className="text-slate-400" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-3">No research papers found</h3>
            <p className="text-slate-600 mb-6 max-w-md mx-auto">
              {searchTerm || selectedCategory
                ? 'No papers match your search criteria. Try different keywords or clear filters.'
                : 'The repository is currently empty. Check back later for new research.'}
            </p>
            {(searchTerm || selectedCategory) && (
              <button
                onClick={clearFilters}
                className="px-6 py-3 bg-gradient-to-r from-slate-100 to-white border border-slate-300 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-colors"
              >
                Clear All Filters
              </button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPapers.map((paper) => (
              <div
                key={paper.id}
                onClick={() => handleViewDetails(paper)}
                className="group bg-white rounded-2xl shadow-sm border border-slate-200 hover:shadow-lg hover:border-[#3674B5]/30 transition-all duration-300 overflow-hidden cursor-pointer"
              >
                {(() => {
                  const primaryAuthor = getPrimaryAuthor(paper);
                  const additionalAuthors = getAdditionalAuthors(paper);

                  return (
                    <>
                {/* Category Badge */}
                <div className={`h-2 bg-gradient-to-r ${getCategoryColor(paper.category)}`}></div>

                {/* Content */}
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4 gap-2 flex-wrap">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-3 py-1 rounded-full bg-gradient-to-r from-slate-100 to-slate-50 text-slate-700 text-xs font-medium">
                        {getCategoryName(paper.category)}
                      </span>
                      {(() => {
                        const b = getRepositoryListingBadge(paper);
                        return (
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${b.className}`}>
                            {b.label}
                          </span>
                        );
                      })()}
                      <SimilarityBadge score={paper.similarityScore} />
                    </div>
                    <div className="flex gap-3 text-slate-500 text-xs">
                      <span className="flex items-center gap-1">
                        <Eye size={12} />
                        {paper.view_count?.toLocaleString() || 0}
                      </span>
                      <span className="flex items-center gap-1">
                        <Download size={12} />
                        {paper.download_count?.toLocaleString() || 0}
                      </span>
                    </div>
                  </div>

                  <h3 className="text-lg font-bold text-slate-900 mb-3 line-clamp-2 group-hover:text-[#3674B5] transition-colors">
                    {paper.title}
                  </h3>

                  <p className="text-sm text-slate-600 mb-4 line-clamp-3">
                    {paper.abstract}
                  </p>

                  {/* Author & Date */}
                  <div className="flex items-center justify-between text-sm text-slate-500 mb-4">
                    <div className="flex items-center gap-2">
                      <User size={14} />
                      <span>{formatFullName(primaryAuthor) || 'Researcher'}</span>
                      {additionalAuthors.length > 0 && (
                        <span className="text-slate-400">+{additionalAuthors.length} co-author{additionalAuthors.length === 1 ? '' : 's'}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar size={14} />
                      {formatDate(paper.published_date || paper.created_at)}
                    </div>
                  </div>

                  {/* Keywords (Collapsible) */}
                  {paper.keywords && paper.keywords.length > 0 && (
                    <div className="mb-4">
                      <div className="flex flex-wrap gap-2 mb-2">
                        {paper.keywords.slice(0, 3).map((keyword, index) => (
                          <span
                            key={index}
                            className="px-2.5 py-1 bg-slate-100 text-slate-700 text-xs rounded-full"
                          >
                            {keyword}
                          </span>
                        ))}
                        {paper.keywords.length > 3 && (
                          <button
                            onClick={(e) => togglePaperExpand(paper.id, e)}
                            className="px-2.5 py-1 text-xs text-[#3674B5] hover:text-[#2d6299]"
                          >
                            +{paper.keywords.length - 3} more
                          </button>
                        )}
                      </div>
                      {expandedPaper === paper.id && (
                        <div className="flex flex-wrap gap-2">
                          {paper.keywords.slice(3).map((keyword, index) => (
                            <span
                              key={index}
                              className="px-2.5 py-1 bg-slate-50 text-slate-600 text-xs rounded-full"
                            >
                              {keyword}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="pt-4 border-t border-slate-100">
                    <p className="text-xs text-slate-500 text-center">
                      PDFs open in the paper detail page (view only). Only an administrator can download the file.
                    </p>
                  </div>
                </div>
                    </>
                  );
                })()}
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredPapers.map((paper) => (
              <div
                key={paper.id}
                onClick={() => handleViewDetails(paper)}
                className="group bg-white rounded-2xl shadow-sm border border-slate-200 hover:shadow-lg hover:border-[#3674B5]/30 transition-all duration-300 cursor-pointer"
              >
                {(() => {
                  const primaryAuthor = getPrimaryAuthor(paper);
                  const additionalAuthors = getAdditionalAuthors(paper);

                  return (
                    <>
                <div className="p-6">
                  <div className="flex flex-col lg:flex-row lg:items-start gap-6">
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-3 mb-2 flex-wrap">
                            <span className={`px-3 py-1 rounded-full bg-gradient-to-r ${getCategoryColor(paper.category)} text-white text-xs font-bold`}>
                              {getCategoryName(paper.category)}
                            </span>
                            {(() => {
                              const b = getRepositoryListingBadge(paper);
                              return (
                                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${b.className}`}>
                                  {b.label}
                                </span>
                              );
                            })()}
                            <SimilarityBadge score={paper.similarityScore} />
                            <div className="flex gap-4 text-sm text-slate-500">
                              <span className="flex items-center gap-1">
                                <Eye size={14} />
                                {paper.view_count?.toLocaleString() || 0} views
                              </span>
                              <span className="flex items-center gap-1">
                                <Download size={14} />
                                {paper.download_count?.toLocaleString() || 0} downloads
                              </span>
                            </div>
                          </div>

                          <h3 className="text-xl font-bold text-slate-900 mb-2 group-hover:text-[#3674B5] transition-colors">
                            {paper.title}
                          </h3>
                        </div>
                      </div>

                      <p className="text-slate-600 mb-4 line-clamp-2">
                        {paper.abstract}
                      </p>

                      <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
                        <div className="flex items-center gap-2">
                          <User size={14} />
                          <span className="font-medium">{formatFullName(primaryAuthor) || 'Researcher'}</span>
                          {additionalAuthors.length > 0 && (
                            <span className="text-slate-400">+{additionalAuthors.length} co-author{additionalAuthors.length === 1 ? '' : 's'}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar size={14} />
                          <span>
                            {paper.status === 'published' ? 'Published' : 'Listed'}{' '}
                            {formatDate(paper.published_date || paper.submission_date || paper.created_at)}
                          </span>
                        </div>
                        {paper.keywords && paper.keywords.length > 0 && (
                          <div className="flex items-center gap-2">
                            <Tag size={14} />
                            <span>{paper.keywords.slice(0, 2).join(', ')}</span>
                            {paper.keywords.length > 2 && (
                              <span className="text-slate-400">+{paper.keywords.length - 2} more</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 lg:w-48">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewDetails(paper);
                        }}
                        className="px-4 py-3 bg-gradient-to-r from-[#3674B5] to-[#578FCA] text-white rounded-xl hover:from-[#2d6299] hover:to-[#3674B5] transition-colors font-medium text-sm flex items-center justify-center gap-2"
                      >
                        <Eye size={16} />
                        View details
                      </button>
                      <p className="text-xs text-slate-500 text-center px-1">
                        Download is restricted to administrators.
                      </p>
                    </div>
                  </div>
                </div>
                    </>
                  );
                })()}
              </div>
            ))}
          </div>
        )}

        {filteredPapers.length > 0 && (
          <div className="mt-10 text-center space-y-4">
            <p className="text-sm text-slate-600">
              Showing {papers.length} of {total} research papers
            </p>
            {canLoadMore && (
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#3674B5] text-white font-semibold hover:bg-[#2d6299] disabled:opacity-60 transition-colors"
              >
                {loadingMore ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    Loading…
                  </>
                ) : (
                  'Load more'
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default BrowseRepository;
