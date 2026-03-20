import React, { useEffect, useRef, useState, useCallback } from "react";
import { cn } from "../lib/utils";
import { Loader2, Maximize2, X, AlertTriangle } from "lucide-react";

interface DiagramRendererProps {
  svgUrl?: string;
  mermaidSyntax?: string;
  altText?: string;
  className?: string;
}

/**
 * Sanitize SVG content by removing script tags and event handlers.
 * Keeps structural SVG elements safe for inline rendering.
 */
function sanitizeSvg(raw: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(raw, "image/svg+xml");

  // Remove script elements
  const scripts = doc.querySelectorAll("script");
  scripts.forEach((s) => s.remove());

  // Remove event handler attributes from all elements
  const all = doc.querySelectorAll("*");
  all.forEach((el) => {
    const attrs = Array.from(el.attributes);
    attrs.forEach((attr) => {
      if (attr.name.startsWith("on")) {
        el.removeAttribute(attr.name);
      }
    });
    // Remove javascript: URIs
    if (
      el.hasAttribute("href") &&
      el.getAttribute("href")?.trim().toLowerCase().startsWith("javascript:")
    ) {
      el.removeAttribute("href");
    }
    if (
      el.hasAttribute("xlink:href") &&
      el
        .getAttribute("xlink:href")
        ?.trim()
        .toLowerCase()
        .startsWith("javascript:")
    ) {
      el.removeAttribute("xlink:href");
    }
  });

  const svgEl = doc.querySelector("svg");
  return svgEl ? svgEl.outerHTML : "";
}

/**
 * Renders SVG content fetched from a URL.
 */
function SvgRenderer({
  svgUrl,
  altText,
  onExpand,
}: {
  svgUrl: string;
  altText?: string;
  onExpand: () => void;
}) {
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(svgUrl)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      })
      .then((text) => {
        if (!cancelled) {
          setSvgContent(sanitizeSvg(text));
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || "Failed to load diagram");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [svgUrl]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">
          Loading diagram...
        </span>
      </div>
    );
  }

  if (error || !svgContent) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2">
        <AlertTriangle className="h-4 w-4 text-destructive" />
        <span className="text-sm text-destructive">
          {error || "Failed to load diagram"}
        </span>
        {altText && (
          <span className="ml-2 text-xs text-muted-foreground">
            — {altText}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="group relative">
      <div
        role="img"
        aria-label={altText || "Diagram"}
        className="diagram-svg-container [&>svg]:max-w-full [&>svg]:h-auto"
        dangerouslySetInnerHTML={{ __html: svgContent }}
      />
      <button
        onClick={onExpand}
        className="absolute top-2 right-2 rounded-md bg-background/80 p-1.5 opacity-0 shadow-sm backdrop-blur transition-opacity group-hover:opacity-100"
        title="Expand diagram"
      >
        <Maximize2 className="h-4 w-4 text-foreground" />
      </button>
    </div>
  );
}

/**
 * Renders a Mermaid diagram from syntax string.
 */
function MermaidRenderer({
  syntax,
  altText,
  onExpand,
}: {
  syntax: string;
  altText?: string;
  onExpand: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const renderIdRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const currentId = ++renderIdRef.current;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: "default",
          securityLevel: "strict",
          fontFamily: "inherit",
        });

        if (cancelled || currentId !== renderIdRef.current) return;

        const elementId = `mermaid-diagram-${currentId}-${Date.now()}`;
        const { svg } = await mermaid.render(elementId, syntax);

        if (cancelled || currentId !== renderIdRef.current) return;

        if (containerRef.current) {
          containerRef.current.innerHTML = svg;
        }
        setLoading(false);
      } catch (err: any) {
        if (!cancelled && currentId === renderIdRef.current) {
          setError(err.message || "Failed to render Mermaid diagram");
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [syntax]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">
          Rendering diagram...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col gap-1 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <span className="text-sm text-destructive">
            Diagram render failed
          </span>
        </div>
        {altText && (
          <span className="text-xs text-muted-foreground">{altText}</span>
        )}
      </div>
    );
  }

  return (
    <div className="group relative">
      <div
        ref={containerRef}
        role="img"
        aria-label={altText || "Diagram"}
        className="[&>svg]:max-w-full [&>svg]:h-auto"
      />
      <button
        onClick={onExpand}
        className="absolute top-2 right-2 rounded-md bg-background/80 p-1.5 opacity-0 shadow-sm backdrop-blur transition-opacity group-hover:opacity-100"
        title="Expand diagram"
      >
        <Maximize2 className="h-4 w-4 text-foreground" />
      </button>
    </div>
  );
}

/**
 * Fullscreen overlay for expanded diagram view.
 */
function FullscreenOverlay({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative max-h-[90vh] max-w-[90vw] overflow-auto rounded-lg bg-background p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 rounded-md p-1.5 hover:bg-muted"
          title="Close"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="min-h-[200px] min-w-[300px]">{children}</div>
      </div>
    </div>
  );
}

/**
 * DiagramRenderer - Renders diagrams from SVG URL or Mermaid syntax.
 *
 * Props:
 *  - svgUrl: URL to a server-rendered SVG file
 *  - mermaidSyntax: Mermaid.js syntax string for client-side rendering
 *  - altText: Accessibility description
 *  - className: Additional CSS classes
 *
 * If svgUrl is provided, fetches and renders inline SVG (sanitized).
 * If mermaidSyntax is provided, renders via Mermaid.js (lazy-loaded).
 * Click-to-expand fullscreen is built in.
 */
export const DiagramRenderer: React.FC<DiagramRendererProps> = ({
  svgUrl,
  mermaidSyntax,
  altText,
  className,
}) => {
  const [expanded, setExpanded] = useState(false);

  const handleExpand = useCallback(() => setExpanded(true), []);
  const handleClose = useCallback(() => setExpanded(false), []);

  // Nothing to render
  if (!svgUrl && !mermaidSyntax) {
    if (altText) {
      return (
        <div
          className={cn(
            "rounded-md border border-dashed border-border px-3 py-2",
            className,
          )}
        >
          <p className="text-sm text-muted-foreground italic">{altText}</p>
        </div>
      );
    }
    return null;
  }

  const renderContent = (isFullscreen: boolean) => {
    // Noop expand handler for fullscreen mode (already expanded)
    const expandHandler = isFullscreen ? () => {} : handleExpand;

    if (svgUrl) {
      return (
        <SvgRenderer
          svgUrl={svgUrl}
          altText={altText}
          onExpand={expandHandler}
        />
      );
    }

    if (mermaidSyntax) {
      return (
        <MermaidRenderer
          syntax={mermaidSyntax}
          altText={altText}
          onExpand={expandHandler}
        />
      );
    }

    return null;
  };

  return (
    <>
      <div
        className={cn(
          "rounded-lg border border-border bg-card overflow-hidden",
          className,
        )}
      >
        {renderContent(false)}
      </div>

      {expanded && (
        <FullscreenOverlay onClose={handleClose}>
          {renderContent(true)}
        </FullscreenOverlay>
      )}
    </>
  );
};
