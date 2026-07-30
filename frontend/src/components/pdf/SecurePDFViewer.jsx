import { useState, useEffect, useRef, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/TextLayer.css';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import {
  ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Loader2,
  Maximize2, Minimize2, X,
} from 'lucide-react';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

/** Same storage object even when presigned query params rotate. */
function pathsMatch(a, b) {
  if (!a || !b) return a === b;
  try {
    return new URL(a).pathname === new URL(b).pathname;
  } catch {
    return a.split('?')[0] === b.split('?')[0];
  }
}

/**
 * Secure PDF viewer (read-only). Optional draw overlays show saved reviewer markup.
 * @param {string} fileUrl
 * @param {string} [watermarkText]
 * @param {{ id: string, pageNumber: number, imageUrl: string }[]} [drawOverlays]
 * @param {number} [pageNumber] — controlled page (1-based); use with onPageNumberChange
 * @param {(page: number) => void} [onPageNumberChange]
 * @param {({ numPages: number }) => void} [onPdfReady]
 */
const SecurePDFViewer = ({
  fileUrl,
  watermarkText = 'NU DASMARIÑAS',
  drawOverlays = [],
  pageNumber: controlledPage,
  onPageNumberChange,
  onPdfReady,
}) => {
  const isControlled = controlledPage !== undefined && typeof onPageNumberChange === 'function';
  const [internalPage, setInternalPage] = useState(1);
  const pageNumber = isControlled ? controlledPage : internalPage;

  const setPageNumber = useCallback(
    (n) => {
      if (isControlled) {
        const next = typeof n === 'function' ? n(pageNumber) : n;
        onPageNumberChange(next);
      } else if (typeof n === 'function') {
        setInternalPage(n);
      } else {
        setInternalPage(n);
      }
    },
    [isControlled, onPageNumberChange, pageNumber]
  );

  const [numPages, setNumPages] = useState(null);
  const [scale, setScale] = useState(1.0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [documentFile, setDocumentFile] = useState(fileUrl);
  const resolvedFileRef = useRef(fileUrl);

  const containerRef = useRef(null);
  const pdfContainerRef = useRef(null);

  useEffect(() => {
    if (pathsMatch(fileUrl, resolvedFileRef.current)) return;
    resolvedFileRef.current = fileUrl;
    setDocumentFile(fileUrl);
    setLoading(true);
    setError(null);
    setNumPages(null);
  }, [fileUrl]);

  useEffect(() => {
    const el = containerRef.current;
    const fn = (e) => e.preventDefault();
    el?.addEventListener('contextmenu', fn);
    return () => el?.removeEventListener('contextmenu', fn);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    const fn = (e) => {
      if ((e.ctrlKey || e.metaKey) && ['c', 'a', 's', 'p'].includes(e.key.toLowerCase())) {
        e.preventDefault();
      }
    };
    el?.addEventListener('keydown', fn);
    return () => el?.removeEventListener('keydown', fn);
  }, []);

  useEffect(() => {
    const fn = (e) => {
      if (e.key !== 'Escape') return;
      if (isFullscreen && !document.fullscreenElement && !document.webkitFullscreenElement) {
        setIsFullscreen(false);
        setScale(1.0);
      }
    };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [isFullscreen]);

  useEffect(() => {
    const isNative = !!(document.fullscreenElement || document.webkitFullscreenElement);
    document.body.style.overflow = isFullscreen && !isNative ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isFullscreen]);

  useEffect(() => {
    const handleChange = () => {
      const active = !!(document.fullscreenElement || document.webkitFullscreenElement);
      setIsFullscreen(active);
      setScale(active ? 1.4 : 1.0);
    };
    document.addEventListener('fullscreenchange', handleChange);
    document.addEventListener('webkitfullscreenchange', handleChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleChange);
      document.removeEventListener('webkitfullscreenchange', handleChange);
    };
  }, []);

  const onDocumentLoadSuccess = ({ numPages: n }) => {
    setNumPages(n);
    setLoading(false);
    onPdfReady?.({ numPages: n });
  };
  const onDocumentLoadError = () => { setError('Failed to load PDF document'); setLoading(false); };

  const goToPrevPage = () => setPageNumber((p) => Math.max(p - 1, 1));
  const goToNextPage = () => setPageNumber((p) => Math.min(p + 1, numPages || 1));
  const zoomIn = () => setScale((s) => Math.min(s + 0.2, 2.5));
  const zoomOut = () => setScale((s) => Math.max(s - 0.2, 0.5));

  const toggleFullscreen = async () => {
    const el = containerRef.current;
    const isNative = !!(document.fullscreenElement || document.webkitFullscreenElement);

    if (!isNative && !isFullscreen) {
      const request = el?.requestFullscreen || el?.webkitRequestFullscreen;
      if (request) {
        try {
          await request.call(el);
          return;
        } catch (err) {
          console.warn('Native fullscreen request failed; falling back to overlay.', err);
          setIsFullscreen(true);
          setScale(1.2);
          return;
        }
      }
      setIsFullscreen(true);
      setScale(1.2);
      return;
    }

    if (isNative) {
      const exit = document.exitFullscreen || document.webkitExitFullscreen;
      if (exit) {
        try {
          await exit.call(document);
          return;
        } catch (err) {
          console.warn('Native fullscreen exit failed; clearing overlay state.', err);
        }
      }
    }

    setIsFullscreen(false);
    setScale(1.0);
  };

  if (error) {
    return (
      <div className="flex items-center justify-center h-[600px] bg-slate-100 rounded-2xl border-2 border-slate-200">
        <p className="text-red-500 font-medium">{error}</p>
      </div>
    );
  }

  const pageOverlays = drawOverlays.filter((o) => o.pageNumber === pageNumber);
  const watermarkPattern = `url("data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320"><text x="50%" y="50%" font-size="22" font-weight="bold" font-family="Arial,sans-serif" fill="#000000" fill-opacity="0.11" text-anchor="middle" dominant-baseline="middle" transform="rotate(-45 160 160)">${watermarkText}</text></svg>`
  )}")`;

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden bg-slate-800 ${isFullscreen ? 'fixed inset-0 z-50' : 'rounded-2xl border-2 border-slate-200'}`}
      style={{ userSelect: 'none', WebkitUserSelect: 'none', cursor: 'default' }}
      tabIndex={0}
    >
      <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-gradient-to-r from-slate-900 to-slate-800 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <button type="button" onClick={goToPrevPage} disabled={pageNumber <= 1} className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-50 transition-colors">
            <ChevronLeft size={16} className="text-white" />
          </button>
          <span className="text-white text-sm font-medium px-2 min-w-[100px] text-center">
            Page {pageNumber} of {numPages || '…'}
          </span>
          <button type="button" onClick={goToNextPage} disabled={pageNumber >= (numPages || 1)} className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-50 transition-colors">
            <ChevronRight size={16} className="text-white" />
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button type="button" onClick={zoomOut} disabled={scale <= 0.5} className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-50 transition-colors">
            <ZoomOut size={16} className="text-white" />
          </button>
          <span className="text-white text-xs font-medium min-w-[44px] text-center">{Math.round(scale * 100)}%</span>
          <button type="button" onClick={zoomIn} disabled={scale >= 2.5} className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-50 transition-colors">
            <ZoomIn size={16} className="text-white" />
          </button>
          <div className="w-px h-5 bg-slate-600 mx-1" />
          <button type="button" onClick={toggleFullscreen} className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors" title={isFullscreen ? 'Exit Fullscreen (ESC)' : 'Fullscreen'}>
            {isFullscreen ? <Minimize2 size={16} className="text-white" /> : <Maximize2 size={16} className="text-white" />}
          </button>
          {isFullscreen && (
            <button type="button" onClick={toggleFullscreen} className="p-1.5 rounded-lg bg-red-600 hover:bg-red-500 transition-colors ml-1" title="Exit Fullscreen (ESC)">
              <X size={16} className="text-white" />
            </button>
          )}
        </div>
      </div>

      <div
        ref={pdfContainerRef}
        className="relative overflow-y-auto overflow-x-hidden bg-slate-700"
        style={{
          height: isFullscreen ? 'calc(100vh - 120px)' : '520px',
          scrollbarGutter: 'stable',
        }}
        onCopy={(e) => e.preventDefault()}
        onDragStart={(e) => e.preventDefault()}
      >
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-700/95 z-30">
            <div className="text-center">
              <Loader2 size={40} className="text-indigo-400 animate-spin mx-auto" />
              <p className="text-white mt-3 font-medium">Loading document...</p>
            </div>
          </div>
        )}

        <div className="relative z-10 isolate flex justify-center py-4">
          <Document file={documentFile} onLoadSuccess={onDocumentLoadSuccess} onLoadError={onDocumentLoadError} loading={null} className="flex justify-center">
            <div className="relative inline-block shadow-2xl">
              <Page pageNumber={pageNumber} scale={scale} renderTextLayer={false} renderAnnotationLayer={false} loading={null} />
              <div
                className="pointer-events-none absolute inset-0 z-[5]"
                aria-hidden="true"
                style={{
                  backgroundImage: watermarkPattern,
                  backgroundRepeat: 'repeat',
                  backgroundSize: '320px 320px',
                }}
              />
              {pageOverlays.map((o) => (
                <img
                  key={o.id}
                  src={o.imageUrl}
                  alt=""
                  className="pointer-events-none absolute inset-0 z-[6] h-full w-full object-contain"
                />
              ))}
            </div>
          </Document>
        </div>
      </div>

      <div className="px-4 py-1.5 bg-gradient-to-r from-amber-900/50 to-orange-900/50 border-t border-amber-700/50">
        <p className="text-amber-200 text-xs text-center font-medium">
          🔒 Protected document. Copying is disabled.
          {isFullscreen && ' Press ESC to exit fullscreen.'}
        </p>
      </div>
    </div>
  );
};

export default SecurePDFViewer;
