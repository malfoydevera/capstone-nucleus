import { useState, useEffect, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Loader2, Maximize2, Minimize2, X } from 'lucide-react';

// Set worker source for react-pdf
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

const SecurePDFViewer = ({ fileUrl, watermarkText = "NU" }) => {
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef(null);

  // Prevent right-click context menu
  useEffect(() => {
    const handleContextMenu = (e) => {
      e.preventDefault();
      return false;
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('contextmenu', handleContextMenu);
    }

    return () => {
      if (container) {
        container.removeEventListener('contextmenu', handleContextMenu);
      }
    };
  }, []);

  // Prevent keyboard shortcuts for copying
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Prevent Ctrl+C, Ctrl+A, Ctrl+S, Ctrl+P
      if (e.ctrlKey && ['c', 'a', 's', 'p'].includes(e.key.toLowerCase())) {
        e.preventDefault();
        return false;
      }
      // Prevent Cmd+C, Cmd+A, Cmd+S, Cmd+P on Mac
      if (e.metaKey && ['c', 'a', 's', 'p'].includes(e.key.toLowerCase())) {
        e.preventDefault();
        return false;
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      if (container) {
        container.removeEventListener('keydown', handleKeyDown);
      }
    };
  }, []);

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

  const goToPrevPage = () => {
    setPageNumber((prev) => Math.max(prev - 1, 1));
  };

  const goToNextPage = () => {
    setPageNumber((prev) => Math.min(prev + 1, numPages || 1));
  };

  const zoomIn = () => {
    setScale((prev) => Math.min(prev + 0.2, 2.5));
  };

  const zoomOut = () => {
    setScale((prev) => Math.max(prev - 0.2, 0.5));
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
    // Reset scale when entering fullscreen for better fit
    if (!isFullscreen) {
      setScale(1.2);
    } else {
      setScale(1.0);
    }
  };

  // Close fullscreen on Escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
        setScale(1.0);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isFullscreen]);

  // Prevent body scroll when fullscreen
  useEffect(() => {
    if (isFullscreen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isFullscreen]);

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
        isFullscreen 
          ? 'fixed inset-0 z-50' 
          : 'rounded-2xl border-2 border-slate-200'
      }`}
      style={{ 
        userSelect: 'none',
        WebkitUserSelect: 'none',
        MozUserSelect: 'none',
        msUserSelect: 'none'
      }}
      tabIndex={0}
    >
      {/* Controls Bar */}
      <div className="sticky top-0 z-20 flex items-center justify-between px-4 py-3 bg-gradient-to-r from-slate-900 to-slate-800 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <button
            onClick={goToPrevPage}
            disabled={pageNumber <= 1}
            className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={18} className="text-white" />
          </button>
          <span className="text-white text-sm font-medium px-3">
            Page {pageNumber} of {numPages || '...'}
          </span>
          <button
            onClick={goToNextPage}
            disabled={pageNumber >= (numPages || 1)}
            className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight size={18} className="text-white" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={zoomOut}
            disabled={scale <= 0.5}
            className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ZoomOut size={18} className="text-white" />
          </button>
          <span className="text-white text-sm font-medium px-2 min-w-[60px] text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={zoomIn}
            disabled={scale >= 2.5}
            className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ZoomIn size={18} className="text-white" />
          </button>
          
          {/* Fullscreen Toggle */}
          <div className="w-px h-6 bg-slate-600 mx-2" />
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? (
              <Minimize2 size={18} className="text-white" />
            ) : (
              <Maximize2 size={18} className="text-white" />
            )}
          </button>
          
          {/* Close button in fullscreen */}
          {isFullscreen && (
            <button
              onClick={() => {
                setIsFullscreen(false);
                setScale(1.0);
              }}
              className="p-2 rounded-lg bg-red-600 hover:bg-red-500 transition-colors ml-2"
              title="Close"
            >
              <X size={18} className="text-white" />
            </button>
          )}
        </div>
      </div>

      {/* PDF Container */}
      <div 
        className="relative overflow-auto bg-slate-700"
        style={{ height: isFullscreen ? 'calc(100vh - 100px)' : '550px' }}
        onCopy={(e) => e.preventDefault()}
        onCut={(e) => e.preventDefault()}
        onDragStart={(e) => e.preventDefault()}
      >
        {/* Watermark Overlay */}
        <div 
          className="absolute inset-0 z-10 pointer-events-none overflow-hidden"
          style={{ 
            background: 'transparent'
          }}
        >
          {/* Repeating watermark pattern */}
          <div 
            className="absolute inset-0"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Ctext x='50%25' y='50%25' font-size='40' font-weight='bold' fill='%23000000' fill-opacity='0.08' text-anchor='middle' dominant-baseline='middle' transform='rotate(-45 100 100)'%3E${watermarkText}%3C/text%3E%3C/svg%3E")`,
              backgroundRepeat: 'repeat',
              backgroundSize: '200px 200px'
            }}
          />
        </div>

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
              renderTextLayer={false}
              renderAnnotationLayer={false}
              className="shadow-2xl"
              loading={null}
            />
          </Document>
        </div>
      </div>

      {/* Security Notice */}
      <div className="px-4 py-2 bg-gradient-to-r from-amber-900/50 to-orange-900/50 border-t border-amber-700/50">
        <p className="text-amber-200 text-xs text-center font-medium">
          🔒 This document is protected. Downloading and copying are disabled.
          {isFullscreen && ' Press ESC to exit fullscreen.'}
        </p>
      </div>
    </div>
  );

  return viewerContent;
};

export default SecurePDFViewer;
