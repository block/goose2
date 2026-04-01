import { useState, useEffect, useRef, memo, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Check, Copy } from "lucide-react";
import { cn } from "@/shared/lib/cn";

const customOneDarkTheme = {
  ...oneDark,
  'code[class*="language-"]': {
    ...oneDark['code[class*="language-"]'],
    color: "#e6e6e6",
    fontSize: "14px",
  },
  'pre[class*="language-"]': {
    ...oneDark['pre[class*="language-"]'],
    color: "#e6e6e6",
    fontSize: "14px",
  },
  comment: { ...oneDark.comment, color: "#a0a0a0", fontStyle: "italic" },
  prolog: { ...oneDark.prolog, color: "#a0a0a0" },
  doctype: { ...oneDark.doctype, color: "#a0a0a0" },
  cdata: { ...oneDark.cdata, color: "#a0a0a0" },
};

interface MarkdownContentProps {
  content: string;
  className?: string;
}

const CodeBlock = memo(function CodeBlock({
  language,
  children,
}: {
  language: string;
  children: string;
}) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(children);
      setCopied(true);
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = window.setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const memoizedHighlighter = useMemo(
    () => (
      <SyntaxHighlighter
        style={customOneDarkTheme}
        language={language}
        PreTag="div"
        customStyle={{ margin: 0, width: "100%", maxWidth: "100%" }}
        codeTagProps={{
          style: {
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
            overflowWrap: "break-word",
            fontFamily: "monospace",
            fontSize: "14px",
          },
        }}
        showLineNumbers={false}
        wrapLines={false}
      >
        {children}
      </SyntaxHighlighter>
    ),
    [language, children],
  );

  return (
    <div className="group/code relative w-full">
      <button
        type="button"
        onClick={handleCopy}
        className="absolute bottom-2 right-2 z-10 rounded-lg bg-gray-700/50 p-1.5 text-gray-300 text-sm opacity-0 transition-opacity duration-200 hover:bg-gray-600/50 hover:text-gray-100 group-hover/code:opacity-100"
        title="Copy code"
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </button>
      <div className="w-full overflow-x-auto">{memoizedHighlighter}</div>
    </div>
  );
});

interface CodeProps
  extends React.ClassAttributes<HTMLElement>,
    React.HTMLAttributes<HTMLElement> {}

const MarkdownCode = memo(function MarkdownCode({
  className,
  children,
  node,
  ...props
}: CodeProps & { node?: { tagName?: string; children?: unknown[] } }) {
  const match = /language-(\w+)/.exec(className || "");
  // In react-markdown v9+, block code is wrapped in <pre><code>
  // Detect block vs inline by checking if there's a language class or if content has newlines
  const isBlock = Boolean(match) || String(children).includes("\n");
  return isBlock ? (
    <CodeBlock language={match?.[1] ?? "text"}>
      {String(children).replace(/\n$/, "")}
    </CodeBlock>
  ) : (
    <code
      {...props}
      className="break-all whitespace-pre-wrap font-mono bg-accent rounded px-1 py-0.5 text-[13px]"
    >
      {children}
    </code>
  );
});

export const MarkdownContent = memo(function MarkdownContent({
  content,
  className = "",
}: MarkdownContentProps) {
  return (
    <div
      className={cn(
        `w-full overflow-x-hidden prose prose-sm dark:prose-invert max-w-full
        prose-pre:p-0 prose-pre:m-0 !p-0
        prose-code:before:content-none prose-code:after:content-none
        prose-code:break-all prose-code:whitespace-pre-wrap prose-code:font-mono
        prose-a:break-all prose-a:text-brand prose-a:underline
        prose-table:table prose-table:w-full
        prose-blockquote:text-inherit prose-blockquote:border-border
        prose-td:border prose-td:border-border prose-td:p-2
        prose-th:border prose-th:border-border prose-th:p-2
        prose-h1:text-2xl prose-h1:font-normal prose-h1:mb-5 prose-h1:mt-0
        prose-h2:text-xl prose-h2:font-normal prose-h2:mb-4 prose-h2:mt-4
        prose-h3:text-lg prose-h3:font-normal prose-h3:mb-3 prose-h3:mt-3
        prose-p:mt-0 prose-p:mb-2
        prose-ol:my-2
        prose-ul:mt-0 prose-ul:mb-3
        prose-li:m-0
        text-foreground`,
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={{
          a: (props) => (
            <a {...props} target="_blank" rel="noopener noreferrer" />
          ),
          code: MarkdownCode,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});
