"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Renders assistant answer text as GitHub-flavored Markdown (tables, task
 * lists, code fences, inline code, headings, lists, blockquotes).
 */
export function MarkdownMessage({ text }: { text: string }) {
  return (
    <div className="md-message">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  );
}
