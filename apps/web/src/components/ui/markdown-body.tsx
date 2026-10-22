import ReactMarkdown, { type Options } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';

/** User-authored text preserves the line breaks shown in its editor. */
export function MarkdownBody({ remarkPlugins = [], ...props }: Options) {
  return (
    <ReactMarkdown
      {...props}
      remarkPlugins={[remarkGfm, remarkBreaks, ...(remarkPlugins ?? [])]}
    />
  );
}
