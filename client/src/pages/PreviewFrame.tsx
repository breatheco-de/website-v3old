import { useState, useEffect, useRef, useCallback } from "react";
import { SectionRenderer } from "@/components/SectionRenderer";
import type { Section } from "@shared/schema";

export default function PreviewFrame() {
  const [sections, setSections] = useState<Section[]>([]);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [isStandalone, setIsStandalone] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const reportHeight = useCallback(() => {
    if (containerRef.current && window.parent !== window) {
      const height = containerRef.current.scrollHeight;
      window.parent.postMessage({ type: 'preview-height', height }, '*');
    }
  }, []);

  useEffect(() => {
    const isInIframe = window.parent !== window;
    setIsStandalone(!isInIframe);

    if (!isInIframe) {
      const storedSections = sessionStorage.getItem('preview-sections');
      const storedTheme = sessionStorage.getItem('preview-theme');
      
      if (storedSections) {
        try {
          const parsed = JSON.parse(storedSections);
          setSections(Array.isArray(parsed) ? parsed : [parsed]);
        } catch {
          // Ignore parse errors
        }
      }
      
      if (storedTheme === 'dark' || storedTheme === 'light') {
        setTheme(storedTheme);
      } else if (document.documentElement.classList.contains('dark')) {
        setTheme('dark');
      }
    }

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'preview-update') {
        setSections(event.data.sections || []);
      }
      if (event.data?.type === 'theme-update') {
        setTheme(event.data.theme || 'light');
      }
    };

    window.addEventListener('message', handleMessage);

    if (isInIframe) {
      window.parent.postMessage({ type: 'preview-ready' }, '*');
    }

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Report height after sections render
  useEffect(() => {
    if (sections.length > 0) {
      // Use multiple timeouts to catch height after images load
      const timeouts = [50, 200, 500, 1000].map(delay => 
        setTimeout(reportHeight, delay)
      );
      return () => timeouts.forEach(clearTimeout);
    }
  }, [sections, reportHeight]);

  // Also use ResizeObserver for dynamic content changes
  useEffect(() => {
    if (!containerRef.current) return;
    
    const observer = new ResizeObserver(() => {
      reportHeight();
    });
    
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [reportHeight]);

  const handleGoBack = () => {
    sessionStorage.removeItem('preview-sections');
    sessionStorage.removeItem('preview-theme');
    window.history.back();
  };

  return (
    <div ref={containerRef} className="bg-background min-h-screen">
      {isStandalone && (
        <div className="fixed top-4 left-4 z-50">
          <button
            onClick={handleGoBack}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-background/80 backdrop-blur border rounded-md shadow-lg hover:bg-muted transition-colors"
            data-testid="button-back-from-preview"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            Back to Showcase
          </button>
        </div>
      )}
      {sections.length > 0 ? (
        <SectionRenderer sections={sections} />
      ) : (
        <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
          Loading preview...
        </div>
      )}
    </div>
  );
}
