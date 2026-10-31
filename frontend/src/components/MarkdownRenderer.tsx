import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export function MarkdownRenderer({ content }: { content: string }) {
  // Fix common newline issues for clean rendering
  const formattedContent = String(content || '').replace(/\\n/g, '\n');
  
  return (
    <div className="prose prose-invert prose-zinc max-w-none">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {formattedContent}
      </ReactMarkdown>
    </div>
  );
}
