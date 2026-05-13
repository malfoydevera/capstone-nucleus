import {
  useState, useRef, useLayoutEffect, useCallback, useEffect, useMemo, memo,
} from 'react';
import toast from 'react-hot-toast';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/TextLayer.css';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import { ChevronLeft, ChevronRight, Eraser, Save, Loader2, Maximize2, Minimize2, X } from 'lucide-react';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

/** Fixed render width — fullscreen uses CSS scale so PDF + canvas are never re-sized (avoids blank/wipe bugs). */
const PAGE_WIDTH = 280;
const FULLSCREEN_SCALE = 800 / PAGE_WIDTH;

function pathsMatch(a, b) {
  if (!a || !b) return false;
  try {
    return new URL(a).pathname === new URL(b).pathname;
  } catch {
    return a.split('?')[0] === b.split('?')[0];
  }
}

/**
 * Read-only duplicate of one PDF page for reviewers to sketch markup without touching the main viewer.
 */
const SidebarPdfDrawPreview = ({
  fileUrl,
  pageNumber,
  numPages: numPagesProp,
  onPageChange,
  onSaveDrawing,
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [localNumPages, setLocalNumPages] = useState(null);
  const [pageBox, setPageBox] = useState({ width: 0, height: 0 });
  const [savingDraw, setSavingDraw] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const containerRef = useRef(null);
  const resizeCleanupRef = useRef(null);
  const lastObservedBoxRef = useRef({ w: 0, h: 0 });
  const appliedCanvasCssRef = useRef({ w: 0, h: 0 });
  const drawCanvasRef = useRef(null);
  const pdfDocumentRef = useRef(null);
  const isStroke = useRef(false);
  const lastPoint = useRef(null);

  const numPages = numPagesProp ?? localNumPages;
  const visualScale = isFullscreen ? FULLSCREEN_SCALE : 1;

  const filePathKey = useMemo(() => {
    if (!fileUrl) return '';
    try {
      return new URL(fileUrl).pathname;
    } catch {
      return fileUrl.split('?')[0] || fileUrl;
    }
  }, [fileUrl]);

  useEffect(() => {
    if (!filePathKey) return;
    setLoading(true);
    setError(null);
    pdfDocumentRef.current = null;
  }, [filePathKey]);

  const onDocumentLoadSuccess = useCallback((pdf) => {
    pdfDocumentRef.current = pdf;
    setLocalNumPages(pdf.numPages);
    setLoading(false);
    setError(null);
  }, []);

  const onDocumentLoadError = useCallback(() => {
    setError('Could not load PDF for markup');
    setLoading(false);
  }, []);

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && isFullscreen) setIsFullscreen(false);
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isFullscreen]);

  useEffect(() => {
    if (isFullscreen) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [isFullscreen]);

  const attachPageWrap = useCallback((el) => {
    resizeCleanupRef.current?.();
    resizeCleanupRef.current = null;
    lastObservedBoxRef.current = { w: 0, h: 0 };

    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (!cr) return;
      const w = Math.round(cr.width);
      const h = Math.round(cr.height);
      if (w < 16 || h < 16) return;
      const { w: lw, h: lh } = lastObservedBoxRef.current;
      if (lw === w && lh === h) return;
      lastObservedBoxRef.current = { w, h };
      setPageBox((prev) => (prev.width === w && prev.height === h ? prev : { width: w, height: h }));
    });
    ro.observe(el);
    resizeCleanupRef.current = () => {
      ro.disconnect();
      resizeCleanupRef.current = null;
    };
  }, []);

  useEffect(() => () => resizeCleanupRef.current?.(), []);

  const initializeCanvas = useCallback((ctx) => {
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.95)';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  const clearDrawingPixels = useCallback(() => {
    const canvas = drawCanvasRef.current;
    if (!canvas || canvas.width < 2) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    initializeCanvas(ctx);
  }, [initializeCanvas]);

  // Only reset ink when the PDF page index changes (not when entering fullscreen — same bitmap size).
  useLayoutEffect(() => {
    appliedCanvasCssRef.current = { w: 0, h: 0 };
    clearDrawingPixels();
  }, [pageNumber, clearDrawingPixels]);

  useLayoutEffect(() => {
    const canvas = drawCanvasRef.current;
    if (!canvas || !pageBox.width || !pageBox.height) return;

    const { width: cw, height: ch } = pageBox;
    const { w: aw, h: ah } = appliedCanvasCssRef.current;
    if (aw === cw && ah === ch) return;

    appliedCanvasCssRef.current = { w: cw, h: ch };
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(cw * dpr);
    canvas.height = Math.floor(ch * dpr);
    canvas.style.width = `${cw}px`;
    canvas.style.height = `${ch}px`;
    const ctx = canvas.getContext('2d', { alpha: true });
    initializeCanvas(ctx);
  }, [pageBox, initializeCanvas]);

  /**
   * Map pointer to canvas coords. Uses clientWidth/Height vs getBoundingClientRect so CSS transform (fullscreen scale) stays correct.
   */
  const getCanvasPoint = (clientX, clientY) => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return null;
    const cw = canvas.clientWidth;
    const ch = canvas.clientHeight;
    const x = ((clientX - rect.left) / rect.width) * cw;
    const y = ((clientY - rect.top) / rect.height) * ch;
    return { x, y };
  };

  const drawSegment = (pt) => {
    const prev = lastPoint.current;
    const canvas = drawCanvasRef.current;
    if (!pt || !prev || !canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;
    ctx.beginPath();
    ctx.moveTo(prev.x, prev.y);
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
    lastPoint.current = pt;
  };

  const onPointerDown = (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    isStroke.current = true;
    lastPoint.current = getCanvasPoint(e.clientX, e.clientY);
  };

  const onPointerMove = (e) => {
    if (!isStroke.current) return;
    e.preventDefault();
    const pt = getCanvasPoint(e.clientX, e.clientY);
    drawSegment(pt);
  };

  const onPointerUp = (e) => {
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }
    isStroke.current = false;
    lastPoint.current = null;
  };

  const inkCanvasHasStrokes = useCallback(() => {
    const ink = drawCanvasRef.current;
    if (!ink || ink.width < 2) return false;
    const ctx = ink.getContext('2d', { alpha: true });
    if (!ctx) return false;
    const { data } = ctx.getImageData(0, 0, ink.width, ink.height);
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] > 8) return true;
    }
    return false;
  }, []);

  /** Renders the same PDF page as the preview, then draws ink on top — saved PNG matches what you see. */
  const buildCompositedPngBlob = useCallback(async () => {
    const ink = drawCanvasRef.current;
    if (!ink || ink.width < 2 || !inkCanvasHasStrokes()) {
      throw new Error('Nothing drawn yet');
    }
    const cw = pageBox.width;
    const ch = pageBox.height;
    if (cw < 8 || ch < 8) {
      throw new Error('Page not ready — wait for the preview to finish loading');
    }

    const W = ink.width;
    const H = ink.height;
    const pdf = pdfDocumentRef.current;

    const composite = document.createElement('canvas');
    composite.width = W;
    composite.height = H;
    const ctx = composite.getContext('2d');
    if (!ctx) throw new Error('Could not export markup');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);

    if (pdf) {
      const pdfPage = await pdf.getPage(pageNumber);
      const baseViewport = pdfPage.getViewport({ scale: 1 });
      const scale = W / baseViewport.width;
      const viewport = pdfPage.getViewport({ scale });

      const pdfLayer = document.createElement('canvas');
      pdfLayer.width = viewport.width;
      pdfLayer.height = viewport.height;
      const pctx = pdfLayer.getContext('2d');
      if (!pctx) throw new Error('Could not render PDF layer');

      const renderTask = pdfPage.render({
        canvasContext: pctx,
        viewport,
      });
      await renderTask.promise;

      ctx.drawImage(pdfLayer, 0, 0, W, H);
    }

    ctx.drawImage(ink, 0, 0, W, H);

    return new Promise((resolve, reject) => {
      composite.toBlob(
        (blob) => (blob && blob.size > 64 ? resolve(blob) : reject(new Error('Export failed'))),
        'image/png'
      );
    });
  }, [pageBox.height, pageBox.width, pageNumber, inkCanvasHasStrokes]);

  const handleSave = async () => {
    if (!onSaveDrawing) return;
    setSavingDraw(true);
    try {
      const blob = await buildCompositedPngBlob();
      await onSaveDrawing(pageNumber, blob);
    } catch (err) {
      toast.error(err?.message || 'Could not save drawing');
    } finally {
      setSavingDraw(false);
    }
  };

  const goPrev = () => {
    if (pageNumber <= 1) return;
    onPageChange?.(pageNumber - 1);
  };

  const goNext = () => {
    if (!numPages || pageNumber >= numPages) return;
    onPageChange?.(pageNumber + 1);
  };

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
        {error}
      </div>
    );
  }

  const toolbar = (
    <div className={`flex flex-wrap items-center justify-between gap-2 ${isFullscreen ? 'bg-slate-900 px-2 py-3 sm:px-4' : 'mb-2'}`}>
      <span className={`font-semibold uppercase tracking-wide text-slate-400 ${isFullscreen ? 'text-xs sm:text-sm' : 'text-[10px]'}`}>
        {isFullscreen ? 'Full screen drawing' : 'Markup copy'}
      </span>
      <div className="flex flex-wrap items-center justify-end gap-1">
        <button
          type="button"
          onClick={goPrev}
          disabled={pageNumber <= 1}
          className="rounded-md bg-slate-700 p-1.5 text-white hover:bg-slate-600 disabled:opacity-40"
          title="Previous page"
        >
          <ChevronLeft size={isFullscreen ? 18 : 14} />
        </button>
        <span className={`min-w-[4rem] text-center font-medium text-white ${isFullscreen ? 'text-sm' : 'text-[11px]'}`}>
          {pageNumber}
          {numPages ? ` / ${numPages}` : ''}
        </span>
        <button
          type="button"
          onClick={goNext}
          disabled={!numPages || pageNumber >= numPages}
          className="rounded-md bg-slate-700 p-1.5 text-white hover:bg-slate-600 disabled:opacity-40"
          title="Next page"
        >
          <ChevronRight size={isFullscreen ? 18 : 14} />
        </button>
        <div className="mx-0.5 hidden h-5 w-px bg-slate-600 sm:block" />
        <button
          type="button"
          onClick={() => setIsFullscreen(!isFullscreen)}
          className="flex items-center gap-1 rounded-md bg-indigo-600 px-2 py-1.5 text-[10px] font-bold text-white hover:bg-indigo-500 sm:text-xs"
          title={isFullscreen ? 'Exit full screen' : 'Open full screen drawing'}
        >
          {isFullscreen ? <Minimize2 size={14} className="shrink-0" /> : <Maximize2 size={14} className="shrink-0" />}
          <span>{isFullscreen ? 'Exit' : 'Full screen'}</span>
        </button>
        {isFullscreen && (
          <button
            type="button"
            onClick={() => setIsFullscreen(false)}
            className="rounded-md bg-red-600 p-1.5 text-white hover:bg-red-500"
            title="Close"
          >
            <X size={18} />
          </button>
        )}
      </div>
    </div>
  );

  const pdfBlock = (
    <div
      className={`relative flex justify-center overflow-auto rounded-lg bg-slate-800 ${isFullscreen ? 'min-h-0 flex-1' : 'min-h-[120px]'}`}
    >
      {loading && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-800/85">
          <Loader2 size={isFullscreen ? 40 : 28} className="animate-spin text-indigo-400" />
        </div>
      )}
      <Document
        file={fileUrl}
        onLoadSuccess={onDocumentLoadSuccess}
        onLoadError={onDocumentLoadError}
        loading={null}
        className="flex items-center justify-center py-3"
      >
        <div
          ref={attachPageWrap}
          className="relative isolate inline-block shadow-lg"
          style={{
            transform: visualScale !== 1 ? `scale(${visualScale})` : undefined,
            transformOrigin: 'top center',
          }}
        >
          <Page
            pageNumber={pageNumber}
            width={PAGE_WIDTH}
            renderTextLayer={false}
            renderAnnotationLayer={false}
            loading={null}
            className="relative z-0 bg-white"
          />
          <canvas
            ref={drawCanvasRef}
            className="pointer-events-auto absolute inset-0 z-10 h-full w-full touch-none cursor-crosshair"
            style={{
              touchAction: 'none',
              backgroundColor: 'transparent',
            }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          />
        </div>
      </Document>
    </div>
  );

  const actions = (
    <div className={`flex flex-wrap gap-1.5 ${isFullscreen ? 'mt-3' : 'mt-2'}`}>
      <button
        type="button"
        onClick={() => clearDrawingPixels()}
        className={`flex flex-1 items-center justify-center gap-1 rounded-lg bg-slate-700 px-2 py-1.5 font-semibold text-white hover:bg-slate-600 ${isFullscreen ? 'py-2.5 text-sm' : 'text-[11px]'}`}
      >
        <Eraser size={isFullscreen ? 16 : 12} />
        Clear drawing
      </button>
      <button
        type="button"
        onClick={handleSave}
        disabled={savingDraw}
        className={`flex flex-[1.2] items-center justify-center gap-1 rounded-lg bg-emerald-600 px-2 py-1.5 font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 ${isFullscreen ? 'py-2.5 text-sm' : 'text-[11px]'}`}
      >
        {savingDraw ? <Loader2 size={isFullscreen ? 16 : 12} className="animate-spin" /> : <Save size={isFullscreen ? 16 : 12} />}
        {savingDraw ? 'Saving…' : 'Save markup'}
      </button>
    </div>
  );

  const hint = !isFullscreen ? (
    <p className="mt-1.5 text-[10px] leading-snug text-slate-500">
      Page stays in sync with Document Preview. Use <strong>Full screen</strong> for a larger drawing area. Your marks stay on the page until you clear or change page.
    </p>
  ) : (
    <p className="mt-2 text-center text-xs text-slate-400">
      Press <kbd className="rounded bg-slate-700 px-1.5 py-0.5 font-mono text-white">ESC</kbd> to exit
    </p>
  );

  const inner = (
    <>
      {toolbar}
      {pdfBlock}
      {hint}
      {actions}
    </>
  );

  if (isFullscreen) {
    return (
      <div ref={containerRef} className="fixed inset-0 z-[60] flex flex-col bg-slate-950 p-3 sm:p-5">
        {inner}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="rounded-xl border border-indigo-200 bg-slate-900/95 p-2 shadow-inner">
      {inner}
    </div>
  );
};

export default memo(SidebarPdfDrawPreview, (prev, next) => (
  pathsMatch(prev.fileUrl, next.fileUrl)
  && prev.pageNumber === next.pageNumber
  && prev.numPages === next.numPages
  && prev.onPageChange === next.onPageChange
  && prev.onSaveDrawing === next.onSaveDrawing
));
