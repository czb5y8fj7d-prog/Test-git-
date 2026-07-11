import { useEffect, useRef, useState } from 'react';
import { Previewer } from 'pagedjs';
import { useBookStore } from '../../store/book';
import { useUiStore } from '../../store/ui';
import { buildBookBodyHtml, buildPrintCss } from '../../lib/printDocument';

export function PreviewPane() {
  const book = useBookStore((s) => s.book);
  const pendingPrint = useUiStore((s) => s.pendingPrint);
  const clearPendingPrint = useUiStore((s) => s.clearPendingPrint);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [rendering, setRendering] = useState(false);
  const [pageCount, setPageCount] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const renderTokenRef = useRef(0);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      renderPreview();
    }, 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book]);

  useEffect(() => {
    return () => {
      // invalidate any in-flight render on unmount (tab switched away)
      renderTokenRef.current += 1;
    };
  }, []);

  // Scale the paginated content down so a full page fits the available width
  // (e.g. an A4/A5 page is wider than a phone screen) without horizontal scrolling.
  function applyFitScale() {
    const container = containerRef.current;
    const scrollEl = scrollRef.current;
    if (!container || !scrollEl) return;
    const pages = container.querySelector<HTMLElement>('.pagedjs_pages');
    if (!pages) return;

    pages.style.transform = 'none';
    container.style.width = '';
    container.style.height = '';

    const naturalWidth = pages.scrollWidth;
    const naturalHeight = pages.scrollHeight;
    if (!naturalWidth || !naturalHeight) return;

    const availableWidth = scrollEl.clientWidth;
    const scale = Math.min(1, availableWidth / naturalWidth);

    pages.style.transformOrigin = 'top left';
    pages.style.transform = `scale(${scale})`;
    container.style.width = `${naturalWidth * scale}px`;
    container.style.height = `${naturalHeight * scale}px`;
    container.style.overflow = 'hidden';
    container.style.margin = '0 auto';
  }

  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;
    const observer = new ResizeObserver(() => applyFitScale());
    observer.observe(scrollEl);
    return () => observer.disconnect();
  }, []);

  async function renderPreview() {
    const container = containerRef.current;
    if (!container) return;
    const token = ++renderTokenRef.current;
    setRendering(true);
    container.innerHTML = '';
    container.style.width = '';
    container.style.height = '';

    const bodyHtml = buildBookBodyHtml(book);
    const css = buildPrintCss(book);
    const cssBlob = new Blob([css], { type: 'text/css' });
    const cssUrl = URL.createObjectURL(cssBlob);

    try {
      const previewer = new Previewer();
      const flow = await previewer.preview(bodyHtml, [cssUrl], container);
      if (token !== renderTokenRef.current) return; // a newer render superseded this one
      setPageCount(flow?.total ?? container.querySelectorAll('.pagedjs_page').length);
      applyFitScale();
    } catch (err) {
      console.error('Erreur de pagination Paged.js', err);
    } finally {
      URL.revokeObjectURL(cssUrl);
      if (token === renderTokenRef.current) setRendering(false);
    }
  }

  useEffect(() => {
    if (!pendingPrint || rendering) return;
    const timer = setTimeout(() => {
      window.print();
      clearPendingPrint();
    }, 150);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingPrint, rendering]);

  return (
    <div className="preview-pane">
      <div className="preview-toolbar">
        <span>
          Format {book.pageSettings.format} · {pageCount} page{pageCount > 1 ? 's' : ''}
        </span>
        {rendering && <span className="preview-status">Mise en page…</span>}
      </div>
      <div className="preview-scroll" ref={scrollRef}>
        <div id="pagedjs-preview-root" ref={containerRef} className="pagedjs-preview-root" />
      </div>
    </div>
  );
}
