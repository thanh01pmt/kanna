import React from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { cn } from "../utils/cn"

export interface SlideDirectives {
  theme?: string;
  bg?: string;
  color?: string;
  paginate?: boolean | string;
  class?: string;
  [key: string]: any;
}

export interface ParsedSlide {
  content: string;
  directives: SlideDirectives;
}

interface SlidePageProps {
  slide: ParsedSlide;
  index: number;
  total: number;
  theme: string; // 'default' | 'gaia' | 'uncover'
  aspectRatio: "16:9" | "4:3";
  textScale: number; // 80 | 100 | 120
  appearance: "auto" | "light" | "dark";
  kannaTheme: "light" | "dark";
  onImageClick: (src: string, alt?: string) => void;
}

export const SlidePage: React.FC<SlidePageProps> = ({
  slide,
  index,
  total,
  theme,
  aspectRatio,
  textScale,
  appearance,
  kannaTheme,
  onImageClick,
}) => {
  // Determine if this slide is dark or light
  const isDark =
    appearance === "dark" || (appearance === "auto" && kannaTheme === "dark");

  // Determine slide background and color from directives or defaults
  const customBg = slide.directives.bg;
  const customColor = slide.directives.color;

  // Build inline styles
  const inlineStyles: React.CSSProperties = {};
  if (customBg) {
    inlineStyles.background = customBg;
  }
  if (customColor) {
    inlineStyles.color = customColor;
  }

  // Calculate font size base on scale
  const baseFontSize = (textScale / 100) * 1.0; // rem multiplier

  // Custom markdown components for SlidePage
  const slideMarkdownComponents = {
    h1: ({ children }: any) => (
      <h1 className={cn(
        "font-semibold tracking-tight border-b-0 pb-0",
        theme === "uncover" ? "text-3xl mb-4" : "text-2xl mb-4"
      )}>
        {children}
      </h1>
    ),
    h2: ({ children }: any) => (
      <h2 className="text-xl font-semibold mb-3 tracking-tight">{children}</h2>
    ),
    h3: ({ children }: any) => (
      <h3 className="text-lg font-medium mb-2 tracking-tight">{children}</h3>
    ),
    p: ({ children }: any) => (
      <p className="mb-3 leading-relaxed last:mb-0">{children}</p>
    ),
    ul: ({ children }: any) => (
      <ul className="list-disc pl-5 mb-3 space-y-1.5">{children}</ul>
    ),
    ol: ({ children }: any) => (
      <ol className="list-decimal pl-5 mb-3 space-y-1.5">{children}</ol>
    ),
    li: ({ children }: any) => (
      <li className="text-sm leading-normal">{children}</li>
    ),
    pre: ({ children }: any) => (
      <pre className="p-3 bg-muted/60 dark:bg-black/30 border border-border/50 rounded-lg overflow-x-auto my-3 text-xs font-mono max-w-full">
        {children}
      </pre>
    ),
    code: ({ children, className }: any) => {
      const isInline = !className;
      if (isInline) {
        return (
          <code className="px-1.5 py-0.5 bg-muted/80 dark:bg-black/40 border border-border/40 rounded text-xs font-mono break-all">
            {children}
          </code>
        );
      }
      return <code className={cn("font-mono block text-xs", className)}>{children}</code>;
    },
    table: ({ children }: any) => (
      <div className="border border-border/60 rounded-lg overflow-x-auto my-3">
        <table className="table-auto min-w-full divide-y divide-border/60 text-xs text-left">
          {children}
        </table>
      </div>
    ),
    th: ({ children }: any) => (
      <th className="p-2 bg-muted/50 dark:bg-black/25 font-semibold border-b border-border/60">{children}</th>
    ),
    td: ({ children }: any) => (
      <td className="p-2 border-b border-border/60">{children}</td>
    ),
    img: ({ src, alt }: any) => (
      <img
        src={src}
        alt={alt}
        className="max-h-[50%] max-w-full object-contain rounded-md cursor-zoom-in my-2 hover:opacity-90 transition-opacity inline-block"
        onClick={() => src && onImageClick(src, alt)}
      />
    ),
    blockquote: ({ children }: any) => (
      <blockquote className="pl-4 border-l-4 border-border/60 text-muted-foreground italic my-3">
        {children}
      </blockquote>
    ),
  };

  // Determine slide page classes based on configuration
  const slideClasses = cn(
    // Base layout
    "relative flex flex-col justify-start w-full overflow-hidden p-8 select-none transition-all duration-300 border border-border/80 shadow-sm rounded-xl",
    aspectRatio === "16:9" ? "aspect-[16/9]" : "aspect-[4/3]",
    
    // Theme layouts
    theme === "uncover" && "items-center justify-center text-center",
    theme === "gaia" && "font-serif",
    
    // Theme colors
    isDark
      ? "bg-card text-foreground"
      : theme === "gaia"
      ? "bg-[#f5f2eb] text-[#333333]"
      : "bg-white text-foreground"
  );

  // Check if pagination is enabled (defaults to true unless explicitly 'false')
  const shouldPaginate = slide.directives.paginate !== false && slide.directives.paginate !== "false";

  return (
    <div
      className={slideClasses}
      style={{
        fontSize: `${baseFontSize}rem`,
        ...inlineStyles,
      }}
    >
      <div className={cn(
        "w-full h-full flex flex-col",
        theme === "uncover" ? "justify-center items-center" : "justify-start"
      )}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={slideMarkdownComponents}
        >
          {slide.content}
        </ReactMarkdown>
      </div>

      {shouldPaginate && (
        <div className="absolute bottom-4 right-6 text-xs text-muted-foreground/60 font-mono select-none">
          {index + 1} / {total}
        </div>
      )}
    </div>
  );
};
