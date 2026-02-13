import { useState, useEffect, useRef, useCallback } from "react";
import { useSearch, useParams } from "wouter";
import jsYaml from "js-yaml";
import { SectionRenderer } from "@/components/SectionRenderer";
import type { Section } from "@shared/schema";
import { IconRefresh, IconArrowLeft } from "@tabler/icons-react";

export default function ComponentPreview() {
  const { componentType } = useParams<{ componentType: string }>();
  const searchString = useSearch();
  const searchParams = new URLSearchParams(searchString);
  
  const version = searchParams.get("version") || "1.0";
  const exampleName = searchParams.get("example");
  const debug = searchParams.get("debug") !== "false";
  
  const [sections, setSections] = useState<Section[]>([]);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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

    if (document.documentElement.classList.contains('dark')) {
      setTheme('dark');
    }

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'preview-update') {
        setSections(event.data.sections || []);
        setIsLoading(false);
        setError(null);
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

  useEffect(() => {
    if (!componentType) {
      setError("Missing component type in URL");
      setIsLoading(false);
      return;
    }

    if (!exampleName) {
      const storedSections = sessionStorage.getItem('preview-sections');
      const storedTheme = sessionStorage.getItem('preview-theme');
      
      if (storedSections) {
        try {
          const parsed = JSON.parse(storedSections);
          setSections(Array.isArray(parsed) ? parsed : [parsed]);
          if (storedTheme === 'dark' || storedTheme === 'light') {
            setTheme(storedTheme);
          }
        } catch {
          // Ignore parse errors
        }
      }
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    
    fetch(`/api/component-registry/${componentType}/${version}/examples`)
      .then(res => res.json())
      .then(data => {
        const examples = data.examples || [];
        const example = examples.find((ex: { name: string }) => ex.name === exampleName);
        
        if (!example) {
          setError(`Example "${exampleName}" not found`);
          return;
        }

        try {
          const parsed = jsYaml.load(example.yaml);
          if (Array.isArray(parsed)) {
            setSections(parsed as Section[]);
          } else if (parsed && typeof parsed === 'object') {
            setSections([parsed as Section]);
          }
        } catch {
          setError("Failed to parse example YAML");
        }
      })
      .catch(() => setError("Failed to load examples"))
      .finally(() => setIsLoading(false));
  }, [componentType, version, exampleName]);

  useEffect(() => {
    if (sections.length > 0) {
      const timeouts = [50, 200, 500, 1000].map(delay => 
        setTimeout(reportHeight, delay)
      );
      return () => timeouts.forEach(clearTimeout);
    }
  }, [sections, reportHeight]);

  useEffect(() => {
    if (!containerRef.current) return;
    
    const observer = new ResizeObserver(() => {
      reportHeight();
    });
    
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [reportHeight]);

  const handleGoBack = () => {
    window.history.back();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px] bg-background">
        <IconRefresh className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[200px] bg-background text-muted-foreground text-sm">
        {error}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="bg-background min-h-screen">
      {isStandalone && !debug && (
        <div className="fixed top-4 left-4 z-50">
          <button
            onClick={handleGoBack}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-background/80 backdrop-blur border rounded-md shadow-lg hover:bg-muted transition-colors"
            data-testid="button-back-from-preview"
          >
            <IconArrowLeft className="w-4 h-4" />
            Back to Showcase
          </button>
        </div>
      )}
      {sections.length > 0 ? (
        <SectionRenderer sections={sections} />
      ) : (
        <div className="flex items-center justify-center min-h-[200px] text-muted-foreground text-sm">
          {exampleName ? "No content to display" : "Waiting for content..."}
        </div>
      )}
    </div>
  );
}
