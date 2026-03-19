import { useState, useEffect, useRef, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/TextLayer.css';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import {
  ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Loader2,
  Maximize2, Minimize2, X, Highlighter, StickyNote,
  MousePointer2, Trash2, ChevronDown
} from 'lucide-react';

// Set worker source for react-pdf
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

const HIGHLIGHT_COLORS = {
  yellow: { bg: '#fef08a', label: 'Yellow', css: 'bg-yellow-300', ring: 'ring-yellow-500' },
  red: { bg: '#fca5a5', label: 'Red', css: 'bg-red-300', ring: 'ring-red-500' },
  blue: { bg: '#93c5fd', label: 'Blue', css: 'bg-blue-300', ring: 'ring-blue-500' },
  green: { bg: '#86efac', label: 'Green', css: 'bg-green-300', ring: 'ring-green-500' },
};

const TOOL_MODES = {
  select: 'select',
  highlight: 'highlight',
  sticky: 'sticky',
};

const SecurePDFViewer = ({
  fileUrl,
  watermarkText = "NU",
  enableAnnotationSelection = false,
  onSelectionCapture,
  annotations = [],
  onAddAnnotation,
  onDeleteAnnotation,
}) => {
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef(null);
  const pdfContainerRef = useRef(null);

  // Editor tool state
  const [activeTool, setActiveTool] = useState(TOOL_MODES.select);
  const [highlightColor, setHighlightColor] = useState('yellow');
  const [showColorPicker, setShowColorPicker] = useState(false);

  // Sticky note popover
  const [stickyPopover, setStickyPopover] = useState(null); // { x, y, pageNumber }
  const [stickyNoteText, setStickyNoteText] = useState('');

  // Mini panel for viewing an annotation
  const [viewingAnnotation, setViewingAnnotation] = useState(null);

  // Prevent right-click context menu
  useEffect(() => {
    const handleContextMenu = (e) => {
      e.preventDefault();
      return false;
    };
    const container = containerRef.current;
    if (container) container.addEventListener('contextmenu', handleContextMenu);
    return () => { if (container) container.removeEventListener('contextmenu', handleContextMenu); };
  }, []);

  // Prevent keyboard shortcuts for copying
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!enableAnnotationSelection && (e.ctrlKey || e.metaKey) && ['c', 'a', 's', 'p'].includes(e.key.toLowerCase())) {
        e.preventDefault();
        return false;
      }
    };
    const container = containerRef.current;
    if (container) container.addEventListener('keydown', handleKeyDown);
    return () => { if (container) container.removeEventListener('keydown', handleKeyDown); };
  }, [enableAnnotationSelection]);

  // Handle text selection in Highlight mode
  const handleMouseUp = useCallback(() => {
    if (!enableAnnotationSelection) return;

    const selection = window.getSelection();
    const text = selection?.toString()?.trim();
    if (!text || !containerRef.current || !selection?.anchorNode) return;

    const anchorElement = selection.anchorNode.nodeType === Node.TEXT_NODE
      ? selection.anchorNode.parentElement
      : selection.anchorNode;

    if (!anchorElement || !containerRef.current.contains(anchorElement)) return;

    if (activeTool === TOOL_MODES.highlight && onAddAnnotation) {
      // Auto-save highlight immediately
      onAddAnnotation({
        annotationType: 'highlight',
        selectedText: text,
        pageNumber,
        highlightColor,
        note: '',
      });
      window.getSelection()?.removeAllRanges();
    } else if (activeTool === TOOL_MODES.select) {
      // Legacy selection capture
      if (onSelectionCapture) {
        onSelectionCapture({ selectedText: text, pageNumber });
      }
    }
  }, [enableAnnotationSelection, activeTool, onAddAnnotation, onSelectionCapture, pageNumber, highlightColor]);

  useEffect(() => {
    const container = containerRef.current;
    container?.addEventListener('mouseup', handleMouseUp);
    return () => { container?.removeEventListener('mouseup', handleMouseUp); };
  }, [handleMouseUp]);

  // Handle click in Sticky Note mode
  const handlePdfClick = useCallback((e) => {
    if (activeTool !== TOOL_MODES.sticky || !enableAnnotationSelection) return;

    const pdfContainer = pdfContainerRef.current;
    if (!pdfContainer) return;

    const rect = pdfContainer.getBoundingClientRect();
    const x = e.clientX - rect.left + pdfContainer.scrollLeft;
    const y = e.clientY - rect.top + pdfContainer.scrollTop;

    setStickyPopover({ x, y, pageNumber });
    setStickyNoteText('');
  }, [activeTool, enableAnnotationSelection, pageNumber]);

  const handleSaveStickyNote = () => {
    if (!stickyNoteText.trim() || !stickyPopover || !onAddAnnotation) return;

    onAddAnnotation({
      annotationType: 'note',
      note: stickyNoteText.trim(),
      pageNumber: stickyPopover.pageNumber,
      selectedText: '',
      highlightColor: null,
    });
    setStickyPopover(null);
    setStickyNoteText('');
  };

  // Close popovers on Escape
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        if (stickyPopover) { setStickyPopover(null); setStickyNoteText(''); return; }
        if (viewingAnnotation) { setViewingAnnotation(null); return; }
        if (isFullscreen) { setIsFullscreen(false); setScale(1.0); }
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isFullscreen, stickyPopover, viewingAnnotation]);

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
    setLoading(false);
    setError(null);
  };

  const onDocumentLoadError = (error) => {
    console.error('Error loading PDF:', error);
    setError('Failed to load PDF document');
    setLoading(false);
  };

  const goToPrevPage = () => setPageNumber((prev) => Math.max(prev - 1, 1));
  const goToNextPage = () => setPageNumber((prev) => Math.min(prev + 1, numPages || 1));
  const zoomIn = () => setScale((prev) => Math.min(prev + 0.2, 2.5));
  const zoomOut = () => setScale((prev) => Math.max(prev - 0.2, 0.5));

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
    if (!isFullscreen) setScale(1.2); else setScale(1.0);
  };

  useEffect(() => {
    if (isFullscreen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [isFullscreen]);

  // Per-page annotations
  const currentPageAnnotations = annotations.filter(a => a.pageNumber === pageNumber);
  const highlightAnnotations = currentPageAnnotations.filter(a => a.annotationType === 'highlight');
  const noteAnnotations = currentPageAnnotations.filter(a => a.annotationType === 'note');

  // Annotation page indicators
  const annotationsByPage = {};
  annotations.forEach(a => {
    const pg = a.pageNumber || 0;
    annotationsByPage[pg] = (annotationsByPage[pg] || 0) + 1;
  });

  if (error) {
    return (
      <div className="flex items-center justify-center h-[600px] bg-slate-100 rounded-2xl border-2 border-slate-200">
        <div className="text-center">
          <p className="text-red-500 font-medium">{error}</p>
          <p className="text-slate-500 text-sm mt-2">Please try again later</p>
        </div>
      </div>
    );
  }

  const viewerContent = (
    <div
      ref={containerRef}
      className={`relative overflow-hidden bg-slate-800 ${
        isFullscreen ? 'fixed inset-0 z-50' : 'rounded-2xl border-2 border-slate-200'
      }`}
      style={{
        userSelect: enableAnnotationSelection ? 'text' : 'none',
        WebkitUserSelect: enableAnnotationSelection ? 'text' : 'none',
        MozUserSelect: enableAnnotationSelection ? 'text' : 'none',
        msUserSelect: enableAnnotationSelection ? 'text' : 'none',
        cursor: activeTool === TOOL_MODES.sticky ? 'crosshair'
              : activeTool === TOOL_MODES.highlight ? 'text'
              : 'default',
      }}
      tabIndex={0}
    >
      {/* ===== EDITOR TOOLBAR ===== */}
      {enableAnnotationSelection && (
        <div className="sticky top-0 z-30 flex items-center gap-1 px-3 py-2 bg-gradient-to-r from-slate-50 to-white border-b-2 border-slate-200">
          {/* Selection Tool */}
          <button
            onClick={() => { setActiveTool(TOOL_MODES.select); setShowColorPicker(false); }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTool === TOOL_MODES.select
                ? 'bg-[#1C4D8D] text-white shadow-md'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
            title="Selection Tool"
          >
            <MousePointer2 size={16} />
            <span className="hidden sm:inline">Selection</span>
          </button>

          <div className="w-px h-7 bg-slate-300 mx-1" />

          {/* Highlight Tool */}
          <div className="relative">
            <button
              onClick={() => {
                setActiveTool(TOOL_MODES.highlight);
                setShowColorPicker(false);
              }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTool === TOOL_MODES.highlight
                  ? 'bg-yellow-100 text-yellow-800 shadow-md ring-2 ring-yellow-300'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
              title="Highlight Tool — Select text to highlight"
            >
              <Highlighter size={16} />
              <span className="hidden sm:inline">Highlight</span>
              <span className={`w-3 h-3 rounded-full ${HIGHLIGHT_COLORS[highlightColor].css} border border-white shadow-sm`} />
            </button>

            {/* Color picker button */}
            {activeTool === TOOL_MODES.highlight && (
              <button
                onClick={() => setShowColorPicker(!showColorPicker)}
                className="absolute -right-5 top-1/2 -translate-y-1/2 p-0.5 rounded text-slate-400 hover:text-slate-600"
              >
                <ChevronDown size={12} />
              </button>
            )}

            {/* Color picker dropdown */}
            {showColorPicker && activeTool === TOOL_MODES.highlight && (
              <div className="absolute top-full left-0 mt-1 flex gap-1.5 bg-white rounded-lg shadow-xl border border-slate-200 p-2 z-40">
                {Object.entries(HIGHLIGHT_COLORS).map(([color, config]) => (
                  <button
                    key={color}
                    onClick={() => { setHighlightColor(color); setShowColorPicker(false); }}
                    className={`w-7 h-7 rounded-full ${config.css} transition-all ${
                      highlightColor === color ? `ring-2 ring-offset-1 ${config.ring} scale-110` : 'hover:scale-110'
                    }`}
                    title={config.label}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="w-px h-7 bg-slate-300 mx-1" />

          {/* Sticky Note Tool */}
          <button
            onClick={() => { setActiveTool(TOOL_MODES.sticky); setShowColorPicker(false); }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTool === TOOL_MODES.sticky
                ? 'bg-amber-100 text-amber-800 shadow-md ring-2 ring-amber-300'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
            title="Sticky Note — Click on the document to place a note"
          >
            <StickyNote size={16} />
            <span className="hidden sm:inline">Sticky</span>
          </button>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Active tool hint */}
          <div className="hidden md:flex items-center gap-2">
            {activeTool === TOOL_MODES.highlight && (
              <span className="text-xs text-yellow-700 bg-yellow-50 px-2 py-1 rounded-lg font-medium">
                Select text to highlight
              </span>
            )}
            {activeTool === TOOL_MODES.sticky && (
              <span className="text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded-lg font-medium">
                Click on document to add note
              </span>
            )}
          </div>

          {/* Annotation count */}
          {annotations.length > 0 && (
            <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 text-slate-600 text-xs font-bold">
              {annotations.filter(a => a.annotationType === 'highlight').length} highlights
              <span className="text-slate-300">·</span>
              {annotations.filter(a => a.annotationType === 'note').length} notes
            </div>
          )}
        </div>
      )}

      {/* ===== NAVIGATION BAR ===== */}
      <div className="sticky top-0 z-20 flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-slate-900 to-slate-800 border-b border-slate-700"
           style={{ top: enableAnnotationSelection ? undefined : 0 }}
      >
        <div className="flex items-center gap-2">
          <button onClick={goToPrevPage} disabled={pageNumber <= 1}
            className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            <ChevronLeft size={16} className="text-white" />
          </button>
          <span className="text-white text-sm font-medium px-2">
            {pageNumber} / {numPages || '...'}
          </span>
          <button onClick={goToNextPage} disabled={pageNumber >= (numPages || 1)}
            className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            <ChevronRight size={16} className="text-white" />
          </button>

          {/* Page annotation indicator */}
          {currentPageAnnotations.length > 0 && (
            <div className="ml-2 px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-200 text-xs font-bold">
              {currentPageAnnotations.length} on this page
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button onClick={zoomOut} disabled={scale <= 0.5}
            className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-50 transition-colors">
            <ZoomOut size={16} className="text-white" />
          </button>
          <span className="text-white text-xs font-medium px-1 min-w-[44px] text-center">
            {Math.round(scale * 100)}%
          </span>
          <button onClick={zoomIn} disabled={scale >= 2.5}
            className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-50 transition-colors">
            <ZoomIn size={16} className="text-white" />
          </button>
          <div className="w-px h-5 bg-slate-600 mx-1" />
          <button onClick={toggleFullscreen}
            className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}>
            {isFullscreen ? <Minimize2 size={16} className="text-white" /> : <Maximize2 size={16} className="text-white" />}
          </button>
          {isFullscreen && (
            <button onClick={() => { setIsFullscreen(false); setScale(1.0); }}
              className="p-1.5 rounded-lg bg-red-600 hover:bg-red-500 transition-colors ml-1" title="Close">
              <X size={16} className="text-white" />
            </button>
          )}
        </div>
      </div>

      {/* ===== PDF CONTENT ===== */}
      <div
        ref={pdfContainerRef}
        className="relative overflow-auto bg-slate-700"
        style={{ height: isFullscreen ? 'calc(100vh - 140px)' : '520px' }}
        onClick={handlePdfClick}
        onCopy={(e) => { if (!enableAnnotationSelection) e.preventDefault(); }}
        onCut={(e) => { if (!enableAnnotationSelection) e.preventDefault(); }}
        onDragStart={(e) => e.preventDefault()}
      >
        {/* Watermark Overlay */}
        <div className="absolute inset-0 z-10 pointer-events-none overflow-hidden">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Ctext x='50%25' y='50%25' font-size='40' font-weight='bold' fill='%23000000' fill-opacity='0.08' text-anchor='middle' dominant-baseline='middle' transform='rotate(-45 100 100)'%3E${watermarkText}%3C/text%3E%3C/svg%3E")`,
            backgroundRepeat: 'repeat', backgroundSize: '200px 200px'
          }} />
        </div>

        {/* Sticky Note Placement Popover */}
        {stickyPopover && (
          <div
            className="absolute z-30"
            style={{ left: `${stickyPopover.x}px`, top: `${stickyPopover.y}px` }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-amber-50 border-2 border-amber-300 rounded-xl shadow-2xl w-64 overflow-hidden">
              <div className="px-3 py-2 bg-amber-100 border-b border-amber-200 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <StickyNote size={14} className="text-amber-700" />
                  <span className="text-xs font-bold text-amber-800">Add Note — Page {stickyPopover.pageNumber}</span>
                </div>
                <button onClick={() => { setStickyPopover(null); setStickyNoteText(''); }}
                  className="text-amber-500 hover:text-amber-700">
                  <X size={14} />
                </button>
              </div>
              <div className="p-3">
                <textarea
                  autoFocus
                  rows={3}
                  placeholder="Write your note here..."
                  value={stickyNoteText}
                  onChange={(e) => setStickyNoteText(e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border border-amber-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
                  onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSaveStickyNote(); }}
                />
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-amber-500">⌘+Enter to save</span>
                  <button
                    onClick={handleSaveStickyNote}
                    disabled={!stickyNoteText.trim()}
                    className="px-3 py-1.5 bg-amber-500 text-white text-xs font-bold rounded-lg hover:bg-amber-600 disabled:opacity-50 transition-colors"
                  >
                    Save Note
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Annotation Viewing Popover */}
        {viewingAnnotation && (
          <div
            className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
            onClick={() => setViewingAnnotation(null)}
          >
            <div
              className={`w-72 rounded-xl shadow-2xl border-2 overflow-hidden ${
                viewingAnnotation.annotationType === 'highlight'
                  ? 'bg-yellow-50 border-yellow-300'
                  : 'bg-amber-50 border-amber-300'
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={`px-3 py-2 ${
                viewingAnnotation.annotationType === 'highlight' ? 'bg-yellow-100 border-b border-yellow-200' : 'bg-amber-100 border-b border-amber-200'
              } flex items-center justify-between`}>
                <div className="flex items-center gap-1.5">
                  {viewingAnnotation.annotationType === 'highlight'
                    ? <Highlighter size={14} className="text-yellow-700" />
                    : <StickyNote size={14} className="text-amber-700" />}
                  <span className="text-xs font-bold">
                    {viewingAnnotation.annotationType === 'highlight' ? 'Highlight' : 'Note'}
                    {viewingAnnotation.pageNumber ? ` — Page ${viewingAnnotation.pageNumber}` : ''}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {onDeleteAnnotation && (
                    <button
                      onClick={() => { onDeleteAnnotation(viewingAnnotation.id); setViewingAnnotation(null); }}
                      className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                  <button onClick={() => setViewingAnnotation(null)} className="text-slate-400 hover:text-slate-600">
                    <X size={14} />
                  </button>
                </div>
              </div>
              <div className="p-3">
                <p className="text-xs text-slate-500 mb-1">{viewingAnnotation.reviewerName}</p>
                {viewingAnnotation.selectedText && (
                  <p className="text-xs text-slate-500 italic mb-2">"{viewingAnnotation.selectedText}"</p>
                )}
                {viewingAnnotation.note && (
                  <p className="text-sm text-slate-800 whitespace-pre-wrap">{viewingAnnotation.note}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-700 z-20">
            <div className="text-center">
              <Loader2 size={40} className="text-indigo-400 animate-spin mx-auto" />
              <p className="text-white mt-3 font-medium">Loading document...</p>
            </div>
          </div>
        )}

        {/* PDF Document */}
        <div className="flex justify-center py-4">
          <div className="relative">
            <Document
              file={fileUrl}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={onDocumentLoadError}
              loading={null}
              className="flex justify-center"
            >
              <Page
                pageNumber={pageNumber}
                scale={scale}
                renderTextLayer={enableAnnotationSelection}
                renderAnnotationLayer={enableAnnotationSelection}
                className="shadow-2xl"
                loading={null}
              />
            </Document>
          </div>
        </div>
      </div>

      {/* ===== ANNOTATION SIDEBAR STRIP ===== */}
      {currentPageAnnotations.length > 0 && (
        <div className="px-3 py-2 bg-slate-800/90 border-t border-slate-700">
          <div className="flex items-center gap-2 overflow-x-auto">
            {currentPageAnnotations.map((a, idx) => {
              const isHighlight = a.annotationType === 'highlight';
              const colorConfig = isHighlight && a.highlightColor ? HIGHLIGHT_COLORS[a.highlightColor] : null;

              return (
                <button
                  key={a.id}
                  onClick={() => setViewingAnnotation(a)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all hover:scale-105 ${
                    isHighlight
                      ? 'bg-yellow-500/20 text-yellow-200 border border-yellow-400/30'
                      : 'bg-amber-500/20 text-amber-200 border border-amber-400/30'
                  }`}
                >
                  {isHighlight ? <Highlighter size={11} /> : <StickyNote size={11} />}
                  {colorConfig && <span className={`w-2 h-2 rounded-full ${colorConfig.css}`} />}
                  <span className="max-w-[120px] truncate">
                    {isHighlight
                      ? (a.selectedText ? `"${a.selectedText}"` : 'Highlight')
                      : (a.note ? a.note.slice(0, 30) : 'Note')}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Annotated pages nav */}
      {annotations.length > 0 && numPages && Object.keys(annotationsByPage).filter(p => Number(p) > 0).length > 0 && (
        <div className="px-3 py-1.5 bg-slate-900/80 border-t border-slate-700 flex items-center gap-2 overflow-x-auto">
          <span className="text-slate-500 text-xs font-medium whitespace-nowrap">Go to:</span>
          {Object.entries(annotationsByPage)
            .filter(([pg]) => Number(pg) > 0)
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([pg, count]) => (
              <button
                key={pg}
                onClick={() => setPageNumber(Number(pg))}
                className={`px-2 py-0.5 rounded text-xs font-bold transition-colors ${
                  Number(pg) === pageNumber
                    ? 'bg-amber-500 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                p.{pg} <span className="text-[10px] opacity-70">({count})</span>
              </button>
            ))}
        </div>
      )}

      {/* Security Notice */}
      <div className="px-4 py-1.5 bg-gradient-to-r from-amber-900/50 to-orange-900/50 border-t border-amber-700/50">
        <p className="text-amber-200 text-xs text-center font-medium">
          🔒 Protected document.
          {enableAnnotationSelection
            ? activeTool === TOOL_MODES.highlight
              ? ' Highlight mode: select text to mark.'
              : activeTool === TOOL_MODES.sticky
              ? ' Sticky mode: click on document to place a note.'
              : ' Use the toolbar above to annotate.'
            : ' Downloading and copying disabled.'}
          {isFullscreen && ' Press ESC to exit fullscreen.'}
        </p>
      </div>
    </div>
  );

  return viewerContent;
};

export default SecurePDFViewer;
