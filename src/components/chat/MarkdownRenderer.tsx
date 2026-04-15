import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

interface Props {
  content: string;
}

const components: Components = {
  pre({ children }) {
    return (
      <pre className="my-2 overflow-x-auto rounded-lg bg-zinc-900 p-3 text-xs">
        {children}
      </pre>
    );
  },
  code({ children, className }) {
    const isInline = !className;
    if (isInline) {
      return (
        <code className="rounded bg-zinc-700 px-1 py-0.5 text-xs">
          {children}
        </code>
      );
    }
    return <code className={className}>{children}</code>;
  },
  a({ href, children }) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-400 underline hover:text-blue-300"
      >
        {children}
      </a>
    );
  },
  table({ children }) {
    return (
      <div className="my-2 overflow-x-auto">
        <table className="min-w-full border-collapse text-xs">
          {children}
        </table>
      </div>
    );
  },
  th({ children }) {
    return (
      <th className="border border-zinc-700 bg-zinc-800 px-2 py-1 text-left font-medium">
        {children}
      </th>
    );
  },
  td({ children }) {
    return (
      <td className="border border-zinc-700 px-2 py-1">{children}</td>
    );
  },
};

export function MarkdownRenderer({ content }: Props) {
  if (!content) return null;
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={components}
      className="prose prose-invert prose-sm max-w-none"
    >
      {content}
    </ReactMarkdown>
  );
}
