import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Search,
  Filter,
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
  BookOpen,
} from 'lucide-react';
import { researchAPI, unwrapApiData } from '../../utils/api';
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
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedThemes, setSelectedThemes] = useState([]);
  const [selectedYear, setSelectedYear] = useState('');
  const [authorSearch, setAuthorSearch] = useState('');
  const [debouncedAuthor, setDebouncedAuthor] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [viewMode, setViewMode] = useState('grid');
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [expandedPaper, setExpandedPaper] = useState(null);
  const [availableYears, setAvailableYears] = useState([]);

  const [stats, setStats] = useState({
    totalPapers: 0,
    totalAuthors: 0,
    totalDownloads: 0,
    totalViews: 0,
  });

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedAuthor(authorSearch.trim()), 300);
    return () => clearTimeout(timer);
  }, [authorSearch]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, selectedCategory, selectedThemes, selectedYear, debouncedAuthor, sortBy]);

  const fetchPapers = useCallback(async ({ pageNum = 1, append = false } = {}) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
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
        ...(debouncedAuthor && { author: debouncedAuthor }),
      };

      const [papersRes, categoriesRes] = await Promise.all([
        researchAPI.getPublishedResearch(params),
        categories.length ? Promise.resolve(null) : researchAPI.getCategories(),
      ]);

      const payload = unwrapApiData(papersRes);
      const nextPapers = payload.papers || [];
      setPapers((prev) => (append ? [...prev, ...nextPapers] : nextPapers));
      setTotal(payload.total ?? nextPapers.length);
      setPage(pageNum);
      setFacets(payload.facets || { categories: [] });

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
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [
    debouncedSearch,
    selectedCategory,
    selectedThemes,
    selectedYear,
    debouncedAuthor,
    sortBy,
    categories.length,
  ]);

  useEffect(() => {
    fetchPapers({ pageNum: 1, append: false });
  }, [fetchPapers]);

  const canLoadMore = papers.length < total;
  const handleLoadMore = () => {
    if (!canLoadMore || loadingMore) return;
    fetchPapers({ pageNum: page + 1, append: true });
  };

  const filteredPapers = [...papers].sort((a, b) => {
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
    setAuthorSearch('');
    setSortBy('newest');
  };

  const activeFilterCount = () => {
    let count = 0;
    if (searchTerm) count++;
    if (selectedCategory) count++;
    if (selectedThemes.length) count++;
    if (selectedYear) count++;
    if (authorSearch) count++;
    return count;
  };

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

  const handleCategorySelect = (categoryId) => {
    setSelectedCategory(categoryId);
  };

  const handleSortSelect = (sortValue) => {
    setSortBy(sortValue);
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
        <div className="mb-8 text-center md:text-left">
          <p className="text-sm font-semibold text-[#3674B5] mb-2">National University Dasmariñas</p>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">Research Repository</h1>
          <p className="text-base text-slate-600 max-w-2xl mx-auto md:mx-0">
            Browse and view approved research from the NU community. PDFs are view-only in the app; downloads are restricted to administrators.
          </p>
          <p className="mt-3 text-sm text-slate-500">{total} paper{total === 1 ? '' : 's'} found</p>
        </div>

        {/* Main Search and Filter Bar */}
        <div className="mb-10">
          {/* Search Bar */}
          <div className="relative mb-6 max-w-3xl mx-auto">
            <div className="relative">
              <Search className="absolute left-5 top-1/2 transform -translate-y-1/2 text-slate-400" size={24} />
              <input
                type="text"
                placeholder="Search research papers, authors, or keywords..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-14 pr-32 py-4 bg-white border-2 border-slate-300 rounded-2xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#3674B5] focus:ring-4 focus:ring-[#3674B5]/10 text-lg shadow-lg"
              />
              <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
                {(searchTerm || selectedCategory) && (
                  <button
                    onClick={clearFilters}
                    className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {thematicCategories.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                {thematicCategories.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => toggleTheme(category.id)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                      selectedThemes.includes(category.id)
                        ? 'bg-[#3674B5] text-white border-[#3674B5]'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-[#578FCA]'
                    }`}
                  >
                    {category.name}
                    {category.count != null ? ` (${category.count})` : ''}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex md:hidden justify-center mb-4">
            <button
              type="button"
              onClick={() => setShowMobileFilters(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-medium"
            >
              <Filter size={18} />
              Filters ({activeFilterCount()})
            </button>
          </div>

          <div className="hidden md:block bg-white rounded-2xl shadow-lg border border-slate-200 p-6 mb-6">
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Author Search */}
              <div className="flex-1">
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  <User size={16} className="inline mr-1" />
                  Search by Author
                </label>
                <input
                  type="text"
                  placeholder="Enter author name..."
                  value={authorSearch}
                  onChange={(e) => setAuthorSearch(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border-2 border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#3674B5] focus:ring-2 focus:ring-[#3674B5]/10 text-sm"
                />
              </div>

              {/* Category Filter */}
              <div className="flex-1">
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  <BookOpen size={16} className="inline mr-1" />
                  Category
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border-2 border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-[#3674B5] focus:ring-2 focus:ring-[#3674B5]/10 text-sm cursor-pointer"
                >
                  <option value="">All Categories</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Year Filter */}
              <div className="flex-1">
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  <Calendar size={16} className="inline mr-1" />
                  Publication Year
                </label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border-2 border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-[#3674B5] focus:ring-2 focus:ring-[#3674B5]/10 text-sm cursor-pointer"
                >
                  <option value="">All Years</option>
                  {availableYears.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sort By */}
              <div className="flex-1">
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  <SortAsc size={16} className="inline mr-1" />
                  Sort By
                </label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border-2 border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-[#3674B5] focus:ring-2 focus:ring-[#3674B5]/10 text-sm cursor-pointer"
                >
                  {sortOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Active Filters Summary & Clear Button */}
            <div className="mt-4 flex items-center justify-between">
              <div className="flex flex-wrap items-center gap-2">
                {activeFilterCount() > 0 && (
                  <>
                    <span className="text-sm font-medium text-slate-600">Active filters:</span>
                    {searchTerm && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-[#3674B5]/10 text-[#3674B5] text-xs font-semibold rounded-full">
                        Search: "{searchTerm}"
                        <button onClick={() => setSearchTerm('')} className="hover:bg-[#3674B5]/20 rounded-full p-0.5">
                          <X size={12} />
                        </button>
                      </span>
                    )}
                    {authorSearch && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-700 text-xs font-semibold rounded-full">
                        Author: "{authorSearch}"
                        <button onClick={() => setAuthorSearch('')} className="hover:bg-blue-100 rounded-full p-0.5">
                          <X size={12} />
                        </button>
                      </span>
                    )}
                    {selectedCategory && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-50 text-green-700 text-xs font-semibold rounded-full">
                        Category: {getCategoryName(selectedCategory)}
                        <button onClick={() => setSelectedCategory('')} className="hover:bg-green-100 rounded-full p-0.5">
                          <X size={12} />
                        </button>
                      </span>
                    )}
                    {selectedYear && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-[#578FCA]/10 text-[#578FCA] text-xs font-semibold rounded-full">
                        Year: {selectedYear}
                        <button onClick={() => setSelectedYear('')} className="hover:bg-[#578FCA]/20 rounded-full p-0.5">
                          <X size={12} />
                        </button>
                      </span>
                    )}
                  </>
                )}
              </div>

              <div className="flex items-center gap-3">
                {/* View Mode Toggle */}
                <div className="flex bg-slate-100 rounded-lg p-1">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-2 rounded-md transition-all ${viewMode === 'grid'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                      }`}
                    title="Grid view"
                  >
                    <Grid size={18} />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-2 rounded-md transition-all ${viewMode === 'list'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                      }`}
                    title="List view"
                  >
                    <List size={18} />
                  </button>
                </div>

                {/* Clear All Filters Button */}
                {activeFilterCount() > 0 && (
                  <button
                    onClick={clearFilters}
                    className="px-4 py-2 bg-gradient-to-r from-slate-100 to-slate-50 text-slate-700 text-sm font-semibold rounded-lg hover:from-slate-200 hover:to-slate-100 transition-all flex items-center gap-2 border border-slate-300"
                  >
                    <RefreshCw size={16} />
                    Clear All
                  </button>
                )}
              </div>
            </div>

            {/* Results Count */}
            <div className="mt-4 pt-4 border-t border-slate-200">
              <p className="text-sm text-slate-600">
                Showing <span className="font-bold text-slate-900">{filteredPapers.length}</span> of{' '}
                <span className="font-bold text-slate-900">{total}</span> research papers
              </p>
            </div>
          </div>
        </div>

        {/* Mobile Filters Modal */}
        {showMobileFilters && (
          <div className="md:hidden mb-8">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-slate-900">Filters</h3>
                <button onClick={() => setShowMobileFilters(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-6">
                {/* Categories */}
                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                    <BookOpen size={16} />
                    Categories
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => handleCategorySelect('')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${selectedCategory === ''
                          ? 'bg-[#3674B5] text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                    >
                      All
                    </button>
                    {categories.slice(0, 6).map((category) => (
                      <button
                        key={category.id}
                        onClick={() => handleCategorySelect(category.id)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${selectedCategory === category.id
                            ? 'bg-[#3674B5] text-white'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                      >
                        {category.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sort */}
                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                    <SortAsc size={16} />
                    Sort By
                  </label>
                  <div className="space-y-2">
                    {sortOptions.map((option) => {
                      const Icon = option.icon;
                      return (
                        <button
                          key={option.value}
                          onClick={() => handleSortSelect(option.value)}
                          className={`w-full flex items-center justify-between p-3 rounded-xl border transition-colors ${sortBy === option.value
                              ? 'border-[#3674B5] bg-[#3674B5]/10 text-[#3674B5]'
                              : 'border-slate-200 hover:border-slate-300'
                            }`}
                        >
                          <div className="flex items-center gap-3">
                            <Icon size={18} />
                            <span>{option.label}</span>
                          </div>
                          {sortBy === option.value && (
                            <div className="w-2 h-2 bg-[#3674B5] rounded-full"></div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* View Mode */}
                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-3">View Mode</label>
                  <div className="flex bg-slate-100 rounded-xl p-1">
                    <button
                      onClick={() => setViewMode('grid')}
                      className={`flex-1 p-3 rounded-lg text-center transition-all ${viewMode === 'grid'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                      <Grid size={20} className="mx-auto mb-1" />
                      <span className="text-xs">Grid</span>
                    </button>
                    <button
                      onClick={() => setViewMode('list')}
                      className={`flex-1 p-3 rounded-lg text-center transition-all ${viewMode === 'list'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                      <List size={20} className="mx-auto mb-1" />
                      <span className="text-xs">List</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

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
