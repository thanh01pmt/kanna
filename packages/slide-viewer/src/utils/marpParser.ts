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

export interface ParsedPresentation {
  globalDirectives: SlideDirectives;
  slides: ParsedSlide[];
}

export function parseMarpMarkdown(markdown: string): ParsedPresentation {
  if (!markdown) {
    return { globalDirectives: {}, slides: [] };
  }

  // Standardize line endings
  const normalized = markdown.replace(/\r\n/g, "\n");

  // Handle optional leading frontmatter
  let cleanMarkdown = normalized;
  const globalDirectives: SlideDirectives = {};
  
  if (normalized.startsWith("---\n")) {
    const endFrontmatterIdx = normalized.indexOf("\n---\n", 4);
    if (endFrontmatterIdx > 0) {
      const frontmatter = normalized.substring(4, endFrontmatterIdx);
      const lines = frontmatter.split("\n");
      lines.forEach(line => {
        const colonIdx = line.indexOf(":");
        if (colonIdx > 0) {
          const k = line.substring(0, colonIdx).trim();
          const v = line.substring(colonIdx + 1).trim();
          globalDirectives[k] = v;
        }
      });
      cleanMarkdown = normalized.substring(endFrontmatterIdx + 5);
    }
  }

  // Split slides by horizontal rule on a single line
  const rawSlides = cleanMarkdown.split(/\n+---\n+/);

  const slides: ParsedSlide[] = [];
  const activeDirectives: SlideDirectives = { ...globalDirectives };

  rawSlides.forEach((rawContent) => {
    const content = rawContent.trim();
    if (!content && rawSlides.length > 1) return;

    const localDirectives: SlideDirectives = {};

    // Parse directives in HTML comments e.g., <!-- bg: #ff0000 --> or <!-- _bg: blue -->
    const commentRegex = /<!--\s*([\w_\-]+)\s*:\s*([^>]*?)\s*-->/g;
    let match;
    while ((match = commentRegex.exec(content)) !== null) {
      const key = match[1];
      const val = match[2].trim();
      
      if (key.startsWith("_")) {
        // Local override (applies only to current slide)
        localDirectives[key.slice(1)] = val;
      } else {
        // Persistent directive (applies to current and subsequent slides)
        activeDirectives[key] = val;
      }
    }

    const directives = {
      ...activeDirectives,
      ...localDirectives
    };

    // Clean comments from the rendering content
    const cleanContent = content.replace(/<!--[\s\S]*?-->/g, "").trim();

    slides.push({
      content: cleanContent,
      directives
    });
  });

  return {
    globalDirectives,
    slides
  };
}
