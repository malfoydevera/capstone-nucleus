import { useState, useEffect, useRef, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/TextLayer.css';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import {
  ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Loader2,
  Maximize2, Minimize2, X, Highlighter, StickyNote,
  MousePointer2, Trash2, ChevronDown
} from 'lucide-react';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

const HIGHLIGHT_COLORS = {
  yellow: { bg: '#fef08a', label: 'Yellow', cls: 'bg-yellow-300', ring: 'ring-yellow-500' },
  red:    { bg: '#fca5a5', label: 'Red',    cls: 'bg-red-300',    ring: 'ring-red-500'    },
  blue:   { bg: '#93c5fd', label: 'Blue',   cls: 'bg-blue-300',   ring: 'ring-blue-500'   },
  green:  { bg: '#86efac', label: 'Green',  cls: 'bg-green-300',  ring: 'ring-green-500'  },
};

const TOOLS = { select: 'select', highlight: 'highlight', sticky: 'sticky' };

const SecurePDFViewer = ({
  fileUrl,
  watermarkText = 'NU',
  enableAnnotationSelection = false,
  annotations = [],
  onAddAnnotation,
  onDeleteAnnotation,
}) => {
  const [numPages, setNumPages]     = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale]           = useState(1.0);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [activeTool, setActiveTool]       = useState(TOOLS.select);
  const [highlightColor, setHighlightColor] = useState('yellow');
  const [showColorPicker, setShowColorPicker] = useState(false);

  const [stickyPopover, setStickyPopover]   = useState(null);
  const [stickyText, setStickyText]         = useState('');
  const [viewingAnnotation, setViewingAnnotation] = useState(null);

  const containerRef   = useRef(null);
  const pdfContainerRef = useRef(null);

  // Prevent right-click
  useEffect(() => {
    const el = containerRef.current;
    const fn = (e) => e.preventDefault();
    el?.addEventListener('contextmenu', fn);
    return () => el?.removeEventListener('contextmenu', fn);
  }, []);

  // Prevent copy shortcuts when not in annotation mode
  useEffect(() => {
    const el = containerRef.current;
    const fn = (e) => {
      if (!enableAnnotationSelection && (e.ctrlKey || e.metaKey) && ['c','a','s','p'].includes(e.key.toLowerCase())) {
        e.preventDefault();
      }
    };
    el?.addEventListener('keydown', fn);
    return () => el?.removeEventListener('keydown', fn);
  }, [enableAnnotationSelection]);

  // Text selection → highlight
  const handleMouseUp = useCallback(() => {
    if (!enableAnnotationSelection || activeTool !== TOOLS.highlight) return;
    const selection = window.getSelection();
    const text = selection?.toString()?.trim();
    if (!text || !containerRef.current) return;

    const anchor = selection.anchorNode?.nodeType === Node.TEXT_NODE
      ? selection.anchorNode.parentElement
      : selection.anchorNode;
    if (!anchor || !containerRef.current.contains(anchor)) return;

    if (onAddAnnotation) {
      onAddAnnotation({ annotationType: 'highlight', selectedText: text, pageNumber, highlightColor, note: '' });
    }
    window.getSelection()?.removeAllRanges();
  }, [enableAnnotationSelection, activeTool, onAddAnnotation, pageNumber, highlightColor]);

  useEffect(() => {
    const el = containerRef.current;
    el?.addEventListener('mouseup', handleMouseUp);
    return () => el?.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseUp]);

  // Click → sticky note placement
  const handlePdfClick = useCallback((e) => {
    if (activeTool !== TOOLS.sticky || !enableAnnotationSelection) return;
    const rect = pdfContainerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left + (pdfContainerRef.current?.scrollLeft || 0);
    const y = e.clientY - rect.top  + (pdfContainerRef.current?.scrollTop  || 0);
    setStickyPopover({ x, y, pageNumber });
    setStickyText('');
  }, [activeTool, enableAnnotationSelection, pageNumber]);

  const saveStickyNote = () => {
    if (!stickyText.trim() || !stickyPopover || !onAddAnnotation) return;
    onAddAnnotation({ annotationType: 'note', note: stickyText.trim(), pageNumber: stickyPopover.pageNumber, selectedText: '', highlightColor: null });
    setStickyPopover(null);
    setStickyText('');
  };

  // Escape key
  useEffect(() => {
    const fn = (e) => {
      if (e.key !== 'Escape') return;
      if (stickyPopover) { setStickyPopover(null); setStickyText(''); return; }
      if (viewingAnnotation) { setViewingAnnotation(null); return; }
      if (isFullscreen) { setIsFullscreen(false); setScale(1.0); }
    };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [isFullscreen, stickyPopover, viewingAnnotation]);

  // Body scroll lock in fullscreen
  useEffect(() => {
    document.body.style.overflow = isFullscreen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isFullscreen]);

  const onDocumentLoadSuccess = ({ numPages }) => { setNumPages(numPages); setLoading(false); };
  const onDocumentLoadError   = () => { setError('Failed to load PDF document'); setLoading(false); };

  const goToPrevPage  = () => setPageNumber(p => Math.max(p - 1, 1));
  const goToNextPage  = () => setPageNumber(p => Math.min(p + 1, numPages || 1));
  const zoomIn        = () => setScale(s => Math.min(s + 0.2, 2.5));
  const zoomOut       = () => setScale(s => Math.max(s - 0.2, 0.5));
  const toggleFullscreen = () => { setIsFullscreen(f => !f); setScale(isFullscreen ? 1.0 : 1.2); };

  const currentPageAnnotations = annotations.filter(a => a.pageNumber === pageNumber);

  // Pages that have annotations
  const annotationsByPage = {};
  annotations.forEach(a => {
    if (a.pageNumber) annotationsByPage[a.pageNumber] = (annotationsByPage[a.pageNumber] || 0) + 1;
  });

  if (error) return (
    <div className="flex items-center justify-center h-[600px] bg-slate-100 rounded-2xl border-2 border-slate-200">
      <p className="text-red-500 font-medium">{error}</p>
    </div>
  );

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden bg-slate-800 ${isFullscreen ? 'fixed inset-0 z-50' : 'rounded-2xl border-2 border-slate-200'}`}
      style={{
        userSelect: enableAnnotationSelection ? 'text' : 'none',
        WebkitUserSelect: enableAnnotationSelection ? 'text' : 'none',
        cursor: activeTool === TOOLS.sticky ? 'crosshair' : activeTool === TOOLS.highlight ? 'text' : 'default',
      }}
      tabIndex={0}
    >

      {/* ── EDITOR TOOLBAR ── */}
      {enableAnnotationSelection && (
        <div className="sticky top-0 z-30 flex items-center gap-1 px-3 py-2 bg-white border-b-2 border-slate-200 flex-wrap">

          {/* Selection */}
          <button
            onClick={() => { setActiveTool(TOOLS.select); setShowColorPicker(false); }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-all ${activeTool === TOOLS.select ? 'bg-[#1C4D8D] text-white shadow' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            <MousePointer2 size={15} /><span>Selection</span>
          </button>

          <div className="w-px h-7 bg-slate-200 mx-1" />

          {/* Highlight */}
          <div className="relative">
            <button
              onClick={() => { setActiveTool(TOOLS.highlight); setShowColorPicker(false); }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-all ${activeTool === TOOLS.highlight ? 'bg-yellow-100 text-yellow-800 ring-2 ring-yellow-300 shadow' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              <Highlighter size={15} />
              <span>Highlight</span>
              <span className={`w-3 h-3 rounded-full ${HIGHLIGHT_COLORS[highlightColor].cls}`} />
            </button>
            {activeTool === TOOLS.highlight && (
              <button
                onClick={() => setShowColorPicker(v => !v)}
                className="absolute -right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              ><ChevronDown size={11} /></button>
            )}
            {showColorPicker && activeTool === TOOLS.highlight && (
              <div className="absolute top-full left-0 mt-1 flex gap-1.5 bg-white rounded-lg shadow-xl border border-slate-200 p-2 z-50">
                {Object.entries(HIGHLIGHT_COLORS).map(([color, cfg]) => (
                  <button
                    key={color}
                    onClick={() => { setHighlightColor(color); setShowColorPicker(false); }}
                    className={`w-7 h-7 rounded-full ${cfg.cls} transition-all ${highlightColor === color ? `ring-2 ring-offset-1 ${cfg.ring} scale-110` : 'hover:scale-110'}`}
                    title={cfg.label}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="w-px h-7 bg-slate-200 mx-1" />

          {/* Sticky */}
          <button
            onClick={() => { setActiveTool(TOOLS.sticky); setShowColorPicker(false); }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-all ${activeTool === TOOLS.sticky ? 'bg-amber-100 text-amber-800 ring-2 ring-amber-300 shadow' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            <StickyNote size={15} /><span>Sticky Note</span>
          </button>

          <div className="flex-1" />

          {/* Hint */}
          <span className="text-xs font-medium px-2 py-1 rounded-lg bg-slate-100 text-slate-600">
            {activeTool === TOOLS.highlight ? '✏️ Select text to highlight' : activeTool === TOOLS.sticky ? '📌 Click on document to add note' : '🖱️ Browse mode'}
          </span>

          {/* Count badge */}
          {annotations.length > 0 && (
            <span className="text-xs font-bold px-2 py-1 rounded-lg bg-amber-100 text-amber-700">
              {annotations.filter(a => a.annotationType === 'highlight').length}H · {annotations.filter(a => a.annotationType !== 'highlight').length}N
            </span>
          )}
        </div>
      )}

      {/* ── NAV BAR ── */}
      <div className="sticky top-0 z-20 flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-slate-900 to-slate-800 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <button onClick={goToPrevPage} disabled={pageNumber <= 1} className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-50 transition-colors">
            <ChevronLeft size={16} className="text-white" />
          </button>
          <span className="text-white text-sm font-medium px-2 min-w-[100px] text-center">
            Page {pageNumber} of {numPages || '…'}
          </span>
          <button onClick={goToNextPage} disabled={pageNumber >= (numPages || 1)} className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-50 transition-colors">
            <ChevronRight size={16} className="text-white" />
          </button>
          {currentPageAnnotations.length > 0 && (
            <span className="ml-2 px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-200 text-xs font-bold">
              {currentPageAnnotations.length} on page
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={zoomOut} disabled={scale <= 0.5} className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-50 transition-colors">
            <ZoomOut size={16} className="text-white" />
          </button>
          <span className="text-white text-xs font-medium min-w-[44px] text-center">{Math.round(scale * 100)}%</span>
          <button onClick={zoomIn} disabled={scale >= 2.5} className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-50 transition-colors">
            <ZoomIn size={16} className="text-white" />
          </button>
          <div className="w-px h-5 bg-slate-600 mx-1" />
          <button onClick={toggleFullscreen} className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors" title={isFullscreen ? 'Exit Fullscreen (ESC)' : 'Fullscreen'}>
            {isFullscreen ? <Minimize2 size={16} className="text-white" /> : <Maximize2 size={16} className="text-white" />}
          </button>
          {isFullscreen && (
            <button onClick={() => { setIsFullscreen(false); setScale(1.0); }} className="p-1.5 rounded-lg bg-red-600 hover:bg-red-500 transition-colors ml-1">
              <X size={16} className="text-white" />
            </button>
          )}
        </div>
      </div>

      {/* ── PDF CONTENT ── */}
      <div
        ref={pdfContainerRef}
        className="relative overflow-auto bg-slate-700"
        style={{ height: isFullscreen ? 'calc(100vh - 150px)' : '520px' }}
        onClick={handlePdfClick}
        onCopy={(e) => { if (!enableAnnotationSelection) e.preventDefault(); }}
        onDragStart={(e) => e.preventDefault()}
      >
        {/* Watermark */}
        <div className="absolute inset-0 z-10 pointer-events-none">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Ctext x='50%25' y='50%25' font-size='40' font-weight='bold' fill='%23000000' fill-opacity='0.08' text-anchor='middle' dominant-baseline='middle' transform='rotate(-45 100 100)'%3E${watermarkText}%3C/text%3E%3C/svg%3E")`,
            backgroundRepeat: 'repeat', backgroundSize: '200px 200px',
          }} />
        </div>

        {/* Sticky note popover */}
        {stickyPopover && (
          <div className="absolute z-30" style={{ left: `${stickyPopover.x}px`, top: `${stickyPopover.y}px` }} onClick={e => e.stopPropagation()}>
            <div className="w-64 bg-amber-50 border-2 border-amber-300 rounded-xl shadow-2xl overflow-hidden">
              <div className="px-3 py-2 bg-amber-100 border-b border-amber-200 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <StickyNote size={13} className="text-amber-700" />
                  <span className="text-xs font-bold text-amber-800">Add Note — Page {stickyPopover.pageNumber}</span>
                </div>
                <button onClick={() => { setStickyPopover(null); setStickyText(''); }} className="text-amber-500 hover:text-amber-700"><X size={13} /></button>
              </div>
              <div className="p-3">
                <textarea
                  autoFocus
                  rows={3}
                  placeholder="Write your note here..."
                  value={stickyText}
                  onChange={e => setStickyText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) saveStickyNote(); }}
                  className="w-full px-2 py-1.5 text-sm border border-amber-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
                />
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-amber-500">⌘+Enter to save</span>
                  <button onClick={saveStickyNote} disabled={!stickyText.trim()} className="px-3 py-1.5 bg-amber-500 text-white text-xs font-bold rounded-lg hover:bg-amber-600 disabled:opacity-50 transition-colors">
                    Save Note
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Viewing annotation popover */}
        {viewingAnnotation && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20" onClick={() => setViewingAnnotation(null)}>
            <div
              className={`w-72 rounded-xl shadow-2xl border-2 overflow-hidden ${viewingAnnotation.annotationType === 'highlight' ? 'bg-yellow-50 border-yellow-300' : 'bg-amber-50 border-amber-300'}`}
              onClick={e => e.stopPropagation()}
            >
              <div className={`px-3 py-2 ${viewingAnnotation.annotationType === 'highlight' ? 'bg-yellow-100 border-b border-yellow-200' : 'bg-amber-100 border-b border-amber-200'} flex items-center justify-between`}>
                <div className="flex items-center gap-1.5">
                  {viewingAnnotation.annotationType === 'highlight' ? <Highlighter size={13} className="text-yellow-700" /> : <StickyNote size={13} className="text-amber-700" />}
                  <span className="text-xs font-bold">{viewingAnnotation.annotationType === 'highlight' ? 'Highlight' : 'Note'} — Page {viewingAnnotation.pageNumber}</span>
                </div>
                <div className="flex items-center gap-1">
                  {onDeleteAnnotation && (
                    <button onClick={() => { onDeleteAnnotation(viewingAnnotation.id); setViewingAnnotation(null); }} className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50">
                      <Trash2 size={12} />
                    </button>
                  )}
                  <button onClick={() => setViewingAnnotation(null)} className="text-slate-400 hover:text-slate-600"><X size={13} /></button>
                </div>
              </div>
              <div className="p-3">
                <p className="text-xs text-slate-500 mb-1">{viewingAnnotation.reviewerName}</p>
                {viewingAnnotation.selectedText && <p className="text-xs italic text-slate-500 mb-2">"{viewingAnnotation.selectedText}"</p>}
                {viewingAnnotation.note && <p className="text-sm text-slate-800 whitespace-pre-wrap">{viewingAnnotation.note}</p>}
              </div>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-700 z-20">
            <div className="text-center">
              <Loader2 size={40} className="text-indigo-400 animate-spin mx-auto" />
              <p className="text-white mt-3 font-medium">Loading document...</p>
            </div>
          </div>
        )}

        {/* PDF */}
        <div className="flex justify-center py-4">
          <Document file={fileUrl} onLoadSuccess={onDocumentLoadSuccess} onLoadError={onDocumentLoadError} loading={null} className="flex justify-center">
            <Page pageNumber={pageNumber} scale={scale} renderTextLayer={true} renderAnnotationLayer={false} className="shadow-2xl" loading={null} />
          </Document>
        </div>
      </div>

      {/* ── ANNOTATION STRIP (current page) ── */}
      {currentPageAnnotations.length > 0 && (
        <div className="px-3 py-2 bg-slate-800/90 border-t border-slate-700">
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {currentPageAnnotations.map(a => {
              const isHL = a.annotationType === 'highlight';
              const colorCls = isHL && HIGHLIGHT_COLORS[a.highlightColor] ? HIGHLIGHT_COLORS[a.highlightColor].cls : '';
              return (
                <button
                  key={a.id}
                  onClick={() => setViewingAnnotation(a)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap hover:scale-105 transition-all ${isHL ? 'bg-yellow-500/20 text-yellow-200 border border-yellow-400/30' : 'bg-amber-500/20 text-amber-200 border border-amber-400/30'}`}
                >
                  {isHL ? <Highlighter size={11} /> : <StickyNote size={11} />}
                  {colorCls && <span className={`w-2 h-2 rounded-full ${colorCls}`} />}
                  <span className="max-w-[120px] truncate">
                    {isHL ? (a.selectedText ? `"${a.selectedText}"` : 'Highlight') : (a.note?.slice(0, 30) || 'Note')}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── PAGE NAV ── */}
      {Object.keys(annotationsByPage).length > 0 && (
        <div className="px-3 py-1.5 bg-slate-900/80 border-t border-slate-700 flex items-center gap-2 overflow-x-auto">
          <span className="text-slate-500 text-xs font-medium whitespace-nowrap">Annotated pages:</span>
          {Object.entries(annotationsByPage).sort(([a],[b]) => Number(a)-Number(b)).map(([pg, count]) => (
            <button key={pg} onClick={() => setPageNumber(Number(pg))}
              className={`px-2 py-0.5 rounded text-xs font-bold transition-colors ${Number(pg) === pageNumber ? 'bg-amber-500 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
            >
              p.{pg} <span className="opacity-70">({count})</span>
            </button>
          ))}
        </div>
      )}

      {/* ── SECURITY NOTICE ── */}
      <div className="px-4 py-1.5 bg-gradient-to-r from-amber-900/50 to-orange-900/50 border-t border-amber-700/50">
        <p className="text-amber-200 text-xs text-center font-medium">
          🔒 Protected document.
          {enableAnnotationSelection ? (activeTool === TOOLS.highlight ? ' Select text to highlight.' : activeTool === TOOLS.sticky ? ' Click document to add sticky note.' : ' Use toolbar to annotate.') : ' Copying is disabled.'}
          {isFullscreen && ' Press ESC to exit fullscreen.'}
        </p>
      </div>
    </div>
  );
};

export default SecurePDFViewer;
