import React from "react";
import katex from "katex";

interface MathTextProps {
  text: string;
  className?: string;
  as?: "span" | "p" | "div";
}

interface Segment {
  type: "text" | "math";
  content: string;
  displayMode: boolean;
}

/**
 * Parse text containing LaTeX delimiters into segments.
 *
 * Priority order:
 *   1. Display math: \[ ... \] and $$ ... $$
 *   2. Inline math: \( ... \) and $ ... $ (with currency guard)
 *
 * Currency guard: a lone $ followed by digits and optional decimals
 * (e.g. $10.99) is NOT treated as math.
 */
function parseSegments(text: string): Segment[] {
  const segments: Segment[] = [];

  // Combined regex matching all delimiter forms in priority order.
  // Groups:
  //   1 = \[...\] display content
  //   2 = $$...$$ display content
  //   3 = \(...\) inline content
  //   4 = $...$ inline content (only when NOT currency like $10.99)
  const pattern =
    /\\\[([\s\S]*?)\\\]|\$\$([\s\S]*?)\$\$|\\\(([\s\S]*?)\\\)|\$(?!\d+(?:\.\d+)?(?:\s|$|[,;.!?)]))((?:[^$\\]|\\.)+?)\$/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    // Push preceding plain text
    if (match.index > lastIndex) {
      segments.push({
        type: "text",
        content: text.slice(lastIndex, match.index),
        displayMode: false,
      });
    }

    const displayContent = match[1] ?? match[2];
    const inlineContent = match[3] ?? match[4];

    if (displayContent != null) {
      const trimmed = displayContent.trim();
      if (trimmed.length > 0) {
        segments.push({ type: "math", content: trimmed, displayMode: true });
      }
    } else if (inlineContent != null) {
      const trimmed = inlineContent.trim();
      if (trimmed.length > 0) {
        segments.push({ type: "math", content: trimmed, displayMode: false });
      }
    }

    lastIndex = match.index + match[0].length;
  }

  // Trailing plain text
  if (lastIndex < text.length) {
    segments.push({
      type: "text",
      content: text.slice(lastIndex),
      displayMode: false,
    });
  }

  return segments;
}

function renderSegments(segments: Segment[]): React.ReactNode[] {
  return segments.map((seg, i) => {
    if (seg.type === "text") {
      return <React.Fragment key={i}>{seg.content}</React.Fragment>;
    }

    try {
      const html = katex.renderToString(seg.content, {
        throwOnError: false,
        displayMode: seg.displayMode,
      });
      return (
        <span
          key={i}
          dangerouslySetInnerHTML={{ __html: html }}
          style={seg.displayMode ? { display: "block", textAlign: "center", margin: "0.5em 0" } : undefined}
        />
      );
    } catch {
      // Unrenderable LaTeX falls back to plain text
      return <React.Fragment key={i}>{seg.content}</React.Fragment>;
    }
  });
}

export const MathText = React.memo(function MathText({
  text,
  className,
  as: Tag = "span",
}: MathTextProps) {
  if (!text) return null;

  const segments = parseSegments(text);

  // Fast path: no math found — return plain text without extra wrapping
  if (segments.length === 1 && segments[0].type === "text") {
    return <Tag className={className}>{text}</Tag>;
  }

  return <Tag className={className}>{renderSegments(segments)}</Tag>;
});
