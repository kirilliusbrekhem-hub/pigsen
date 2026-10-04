import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Safe markdown: raw HTML is not rendered; internal links use client routing, external open in a new tab. */
export function Markdown({ children, className = "" }: { children: string; className?: string }) {
  return (
    <div className={`md ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          a: ({ href = "", children: c }) =>
            href.startsWith("/") ? (
              <Link href={href}>{c}</Link>
            ) : /^https?:\/\//.test(href) ? (
              <a href={href} target="_blank" rel="noopener noreferrer nofollow">
                {c}
              </a>
            ) : (
              <span>{c}</span>
            ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
