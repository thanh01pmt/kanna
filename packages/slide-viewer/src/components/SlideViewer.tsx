import React, { useState, useEffect, useRef } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { parseMarpMarkdown } from "../utils/marpParser"
import { SlidePage } from "./SlidePage"
import { ImageModal } from "./ImageModal"
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Settings,
  FileText,
  Presentation,
  Sliders,
  Code,
  Save,
  Loader2,
} from "lucide-react"

interface SlideViewerProps {
  markdown: string;
  kannaTheme?: "light" | "dark"; // Default is dark
  preferredViewMode?: "slides" | "document" | "raw";
  contentIdentity?: string;
  rawFileName?: string | null;
  hasUnsavedChanges?: boolean;
  isSavingMarkdown?: boolean;
  onMarkdownChange?: (markdown: string) => void;
  onSaveMarkdown?: () => void | Promise<void>;
}

const documentMarkdownComponents = {
  h1: ({ children }: any) => (
    <h1 className="mb-3 text-2xl font-semibold tracking-tight text-foreground">{children}</h1>
  ),
  h2: ({ children }: any) => (
    <h2 className="mb-2.5 mt-5 text-xl font-semibold tracking-tight text-foreground first:mt-0">{children}</h2>
  ),
  h3: ({ children }: any) => (
    <h3 className="mb-2 mt-4 text-base font-semibold text-foreground first:mt-0">{children}</h3>
  ),
  h4: ({ children }: any) => (
    <h4 className="mb-1.5 mt-3 text-sm font-semibold text-foreground first:mt-0">{children}</h4>
  ),
  p: ({ children }: any) => (
    <p className="mb-3 leading-7 text-foreground/86 last:mb-0">{children}</p>
  ),
  ul: ({ children }: any) => (
    <ul className="mb-4 list-disc space-y-1.5 pl-6 text-foreground/86">{children}</ul>
  ),
  ol: ({ children }: any) => (
    <ol className="mb-4 list-decimal space-y-1.5 pl-6 text-foreground/86">{children}</ol>
  ),
  li: ({ children }: any) => (
    <li className="leading-7">{children}</li>
  ),
  blockquote: ({ children }: any) => (
    <blockquote className="my-4 rounded-r-lg border-l-4 border-logo/60 bg-muted/30 py-2 pl-4 pr-3 text-muted-foreground">
      {children}
    </blockquote>
  ),
  code: ({ children, className }: any) => {
    const isInline = !className
    if (isInline) {
      return (
        <code className="rounded-md border border-border/60 bg-muted/60 px-1.5 py-0.5 font-mono text-[0.86em] text-foreground">
          {children}
        </code>
      )
    }
    return <code className={className}>{children}</code>
  },
  pre: ({ children }: any) => (
    <pre className="my-4 overflow-x-auto rounded-xl border border-border/70 bg-muted/35 p-4 text-xs leading-relaxed">
      {children}
    </pre>
  ),
  table: ({ children }: any) => (
    <div className="my-4 overflow-x-auto rounded-xl border border-border/70">
      <table className="min-w-full border-collapse text-left text-sm">
        {children}
      </table>
    </div>
  ),
  th: ({ children }: any) => (
    <th className="border-b border-border/70 bg-muted/45 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </th>
  ),
  td: ({ children }: any) => (
    <td className="border-b border-border/50 px-3 py-2 align-top text-foreground/86 last:border-b-0">
      {children}
    </td>
  ),
  img: ({ src, alt }: any) => (
    <img
      src={src}
      alt={alt}
      className="my-4 max-h-[420px] max-w-full cursor-zoom-in rounded-xl border border-border/70 object-contain shadow-sm transition-opacity hover:opacity-90"
    />
  ),
  hr: () => <hr className="my-6 border-border/70" />,
}

function getSectionTitle(content: string, fallback: string): string {
  const heading = content
    .split(/\r?\n/)
    .map(line => line.trim())
    .find(line => /^#{1,3}\s+/.test(line))

  return heading ? heading.replace(/^#{1,3}\s+/, "").trim() : fallback
}

export const SlideViewer: React.FC<SlideViewerProps> = ({
  markdown,
  kannaTheme = "dark",
  preferredViewMode = "document",
  contentIdentity,
  rawFileName,
  hasUnsavedChanges = false,
  isSavingMarkdown = false,
  onMarkdownChange,
  onSaveMarkdown,
}) => {
  // Parse presentation
  const { slides, globalDirectives } = parseMarpMarkdown(markdown)
  const [marpPresentation, setMarpPresentation] = useState<{
    css: string
    slides: string[]
    error: string | null
    isLoading: boolean
  }>({ css: "", slides: [], error: null, isLoading: true })

  // Viewer state
  const [viewMode, setViewMode] = useState<"slides" | "document" | "raw">(preferredViewMode)
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [modalImage, setModalImage] = useState<{ src: string; alt?: string } | null>(null)

  // Slide settings
  const [slideTheme, setSlideTheme] = useState<string>("default")
  const [aspectRatio, setAspectRatio] = useState<"16:9" | "4:3">("16:9")
  const [textScale, setTextScale] = useState<number>(100)
  const [appearance, setAppearance] = useState<"auto" | "light" | "dark">("auto")

  const settingsRef = useRef<HTMLDivElement>(null)
  const lastRawFileNameRef = useRef<string | null | undefined>(rawFileName)
  const lastContentIdentityRef = useRef<string | undefined>(contentIdentity)
  const canShowSlides = preferredViewMode === "slides"
  const canShowDocument = preferredViewMode !== "raw"

  useEffect(() => {
    let cancelled = false
    const content = markdown.trim()

    if (!canShowSlides || !content) {
      setMarpPresentation({ css: "", slides: [], error: null, isLoading: false })
      return
    }

    setMarpPresentation(prev => ({ ...prev, error: null, isLoading: true }))

    import("@marp-team/marp-core")
      .then(({ Marp }) => {
        if (cancelled) return

        if (typeof window !== "undefined" && !(window as any).process) {
          ;(window as any).process = { env: {} }
        }

        const marp = new Marp({ html: true, container: false })
        const rendered = marp.render(content)
        const renderedSlides = rendered.html.match(/<svg[\s\S]*?<\/svg>/g) ?? []

        setMarpPresentation({
          css: rendered.css,
          slides: renderedSlides,
          error: null,
          isLoading: false,
        })
      })
      .catch((err: any) => {
        if (cancelled) return

        setMarpPresentation({
          css: "",
          slides: [],
          error: err?.message || "Failed to render Marp slides",
          isLoading: false,
        })
      })

    return () => {
      cancelled = true
    }
  }, [canShowSlides, markdown])

  // Initialize theme from global directives if present
  useEffect(() => {
    if (globalDirectives.theme) {
      setSlideTheme(globalDirectives.theme)
    } else {
      setSlideTheme("default")
    }

    if (globalDirectives.size) {
      if (globalDirectives.size === "4:3") {
        setAspectRatio("4:3")
      } else {
        setAspectRatio("16:9")
      }
    }
  }, [markdown])

  useEffect(() => {
    setCurrentSlideIndex(0)
  }, [markdown])

  useEffect(() => {
    const fileChanged = rawFileName !== lastRawFileNameRef.current
    const contentChanged = contentIdentity !== lastContentIdentityRef.current

    if (!fileChanged && !contentChanged) {
      return
    }

    lastRawFileNameRef.current = rawFileName
    lastContentIdentityRef.current = contentIdentity
    setCurrentSlideIndex(0)

    // New files should open in their natural view. Saving the same file from Raw
    // should not yank the user out of the editor.
    if (fileChanged || viewMode !== "raw") {
      setViewMode(preferredViewMode)
    }
  }, [contentIdentity, preferredViewMode, rawFileName, viewMode])

  useEffect(() => {
    const slideCount = viewMode === "slides" && marpPresentation.slides.length > 0
      ? marpPresentation.slides.length
      : slides.length

    setCurrentSlideIndex(prev => Math.min(prev, Math.max(slideCount - 1, 0)))
  }, [marpPresentation.slides.length, slides.length, viewMode])

  // Close settings panel when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setIsSettingsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleOutsideClick)
    return () => document.removeEventListener("mousedown", handleOutsideClick)
  }, [])

  // Keyboard navigation for slide view
  useEffect(() => {
    if (viewMode !== "slides") return

    const currentSlideCount = marpPresentation.slides.length > 0
      ? marpPresentation.slides.length
      : slides.length

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in inputs/textareas
      const activeEl = document.activeElement?.tagName
      if (activeEl === "INPUT" || activeEl === "TEXTAREA") return

      switch (e.key) {
        case "ArrowRight":
        case " ":
        case "PageDown":
          e.preventDefault()
          setCurrentSlideIndex(prev => Math.min(prev + 1, currentSlideCount - 1))
          break
        case "ArrowLeft":
        case "PageUp":
          e.preventDefault()
          setCurrentSlideIndex(prev => Math.max(prev - 1, 0))
          break
        case "Home":
          e.preventDefault()
          setCurrentSlideIndex(0)
          break
        case "End":
          e.preventDefault()
          setCurrentSlideIndex(currentSlideCount - 1)
          break
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [marpPresentation.slides.length, slides.length, viewMode])

  useEffect(() => {
    if (viewMode !== "raw" || !onSaveMarkdown) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault()
        if (hasUnsavedChanges && !isSavingMarkdown) {
          void onSaveMarkdown()
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [hasUnsavedChanges, isSavingMarkdown, onSaveMarkdown, viewMode])

  // Handles image click zoom
  const handleImageClick = (src: string, alt?: string) => {
    setModalImage({ src, alt })
  }

  if ((!slides || slides.length === 0) && !onMarkdownChange) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-6 text-center">
        <FileText className="h-10 w-10 mb-2 opacity-55 animate-pulse" />
        <p className="text-sm font-medium">No slides to display</p>
        <p className="text-xs opacity-70 mt-1">Please select or write a markdown file.</p>
      </div>
    )
  }

  const slideCount = viewMode === "slides" && marpPresentation.slides.length > 0
    ? marpPresentation.slides.length
    : slides.length

  return (
    <div className="flex flex-col h-full bg-background text-foreground overflow-hidden">
      {/* Top Action Header */}
      <div className="flex items-center justify-between border-b border-border/80 px-4 py-2.5 bg-card">
        {/* Segmented Control for View Mode */}
        <div className="inline-flex items-center rounded-lg border border-border p-[3px] bg-muted/20">
          {canShowSlides ? (
            <button
              onClick={() => setViewMode("slides")}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-all ${
                viewMode === "slides"
                  ? "bg-white dark:bg-muted border border-border shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Presentation className="h-3.5 w-3.5" />
              Slides
            </button>
          ) : null}
          {canShowDocument ? (
            <button
              onClick={() => setViewMode("document")}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-all ${
                viewMode === "document"
                  ? "bg-white dark:bg-muted border border-border shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              Document
            </button>
          ) : null}
          <button
            onClick={() => setViewMode("raw")}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-all ${
              viewMode === "raw"
                ? "bg-white dark:bg-muted border border-border shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Code className="h-3.5 w-3.5" />
            Raw
          </button>
        </div>

        {/* Settings / Customize Menu */}
        <div className="flex items-center gap-2">
          {viewMode === "raw" && onSaveMarkdown ? (
            <button
              onClick={() => void onSaveMarkdown()}
              disabled={!hasUnsavedChanges || isSavingMarkdown}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-default disabled:opacity-50"
              title="Save Markdown"
            >
              {isSavingMarkdown ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              {hasUnsavedChanges ? "Save" : "Saved"}
            </button>
          ) : null}

          <div className="relative" ref={settingsRef}>
            <button
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              className={`p-1.5 rounded-full hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-all duration-200 ${
                isSettingsOpen ? "bg-muted text-foreground rotate-45" : ""
              }`}
              title="Adjust Slide Settings"
            >
              <Settings className="h-4.5 w-4.5" />
            </button>

          {isSettingsOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-card border border-border rounded-xl shadow-lg p-4 z-20 animate-in fade-in zoom-in-95 duration-150">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1">
                <Sliders className="h-3.5 w-3.5" /> Viewer Config
              </h4>

              <div className="space-y-4 text-sm">
                {/* Theme Selector */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-foreground/80">Slide Theme</label>
                  <select
                    value={slideTheme}
                    onChange={(e) => setSlideTheme(e.target.value)}
                    className="w-full text-xs rounded-md border border-border bg-background px-2.5 py-1.5 outline-none focus:border-logo transition-colors"
                  >
                    <option value="default">Default (Slate)</option>
                    <option value="gaia">Gaia (Warm Cream)</option>
                    <option value="uncover">Uncover (Centered Title)</option>
                  </select>
                </div>

                {/* Aspect Ratio Selector */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-foreground/80">Aspect Ratio</label>
                  <div className="grid grid-cols-2 gap-1 rounded-md border border-border p-[3px] bg-muted/20">
                    <button
                      onClick={() => setAspectRatio("16:9")}
                      className={`text-xs py-1 rounded transition-all ${
                        aspectRatio === "16:9"
                          ? "bg-white dark:bg-muted shadow-sm font-medium"
                          : "text-muted-foreground"
                      }`}
                    >
                      16:9
                    </button>
                    <button
                      onClick={() => setAspectRatio("4:3")}
                      className={`text-xs py-1 rounded transition-all ${
                        aspectRatio === "4:3"
                          ? "bg-white dark:bg-muted shadow-sm font-medium"
                          : "text-muted-foreground"
                      }`}
                    >
                      4:3
                    </button>
                  </div>
                </div>

                {/* Text Scale Selector */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-foreground/80">Text Scaling</label>
                  <div className="grid grid-cols-3 gap-1 rounded-md border border-border p-[3px] bg-muted/20">
                    {[80, 100, 120].map((scale) => (
                      <button
                        key={scale}
                        onClick={() => setTextScale(scale)}
                        className={`text-xs py-1 rounded transition-all ${
                          textScale === scale
                            ? "bg-white dark:bg-muted shadow-sm font-medium"
                            : "text-muted-foreground"
                        }`}
                      >
                        {scale}%
                      </button>
                    ))}
                  </div>
                </div>

                {/* Appearance Override */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-foreground/80">Slide Style</label>
                  <div className="grid grid-cols-3 gap-1 rounded-md border border-border p-[3px] bg-muted/20">
                    {(["auto", "light", "dark"] as const).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setAppearance(mode)}
                        className={`text-xs py-1 rounded capitalize transition-all ${
                          appearance === mode
                            ? "bg-white dark:bg-muted shadow-sm font-medium"
                            : "text-muted-foreground"
                        }`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className={`flex-1 p-4 flex flex-col items-center ${viewMode === "raw" ? "min-h-0 overflow-hidden" : "overflow-y-auto"}`}>
        {viewMode === "slides" ? (
          /* Slide Mode */
          <div className="w-full max-w-4xl flex-1 flex flex-col justify-center gap-4 py-4">
            {marpPresentation.slides.length > 0 ? (
              <div className="kanna-marp-slide w-full overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
                <style>{marpPresentation.css}</style>
                <div
                  className="w-full"
                  dangerouslySetInnerHTML={{ __html: marpPresentation.slides[currentSlideIndex] ?? "" }}
                />
              </div>
            ) : marpPresentation.isLoading ? (
              <div className="flex aspect-[16/9] w-full items-center justify-center rounded-xl border border-border/80 bg-card text-xs text-muted-foreground">
                Rendering slides...
              </div>
            ) : marpPresentation.error ? (
              <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-6 text-sm text-destructive">
                {marpPresentation.error}
              </div>
            ) : slides.length === 0 ? (
              <div className="flex aspect-[16/9] w-full items-center justify-center rounded-xl border border-border/80 bg-card text-xs text-muted-foreground">
                No slides to display
              </div>
            ) : (
              <SlidePage
                slide={slides[currentSlideIndex]}
                index={currentSlideIndex}
                total={slides.length}
                theme={slideTheme}
                aspectRatio={aspectRatio}
                textScale={textScale}
                appearance={appearance}
                kannaTheme={kannaTheme}
                onImageClick={handleImageClick}
              />
            )}

            {slideCount > 0 ? (
              /* Slide Navigation Controls */
              <div className="flex items-center justify-between mt-2 px-1">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentSlideIndex(0)}
                  disabled={currentSlideIndex === 0}
                  className="p-1.5 rounded-full hover:bg-muted disabled:opacity-40 transition-colors"
                  title="First Slide"
                >
                  <ChevronsLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setCurrentSlideIndex(prev => Math.max(prev - 1, 0))}
                  disabled={currentSlideIndex === 0}
                  className="p-1.5 rounded-full hover:bg-muted disabled:opacity-40 transition-colors"
                  title="Previous Slide"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              </div>

              <span className="text-xs font-mono text-muted-foreground select-none">
                Slide {currentSlideIndex + 1} of {slideCount}
              </span>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentSlideIndex(prev => Math.min(prev + 1, slideCount - 1))}
                  disabled={currentSlideIndex === slideCount - 1}
                  className="p-1.5 rounded-full hover:bg-muted disabled:opacity-40 transition-colors"
                  title="Next Slide"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setCurrentSlideIndex(slideCount - 1)}
                  disabled={currentSlideIndex === slideCount - 1}
                  className="p-1.5 rounded-full hover:bg-muted disabled:opacity-40 transition-colors"
                  title="Last Slide"
                >
                  <ChevronsRight className="h-4 w-4" />
                </button>
              </div>
              </div>
            ) : null}
          </div>
        ) : viewMode === "document" ? (
          /* Document continuous Mode */
          canShowSlides ? (
            <div className="w-full max-w-4xl py-4">
              <div className="mb-5 rounded-2xl border border-border/80 bg-card/70 p-5 shadow-sm">
                <div className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-logo/90">Marp Document</div>
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                  {String(globalDirectives.title || rawFileName?.split("/").pop() || "Slide deck")}
                </h1>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span>{slides.length} sections</span>
                  {globalDirectives.type ? <span>Type: {String(globalDirectives.type)}</span> : null}
                  {globalDirectives.version ? <span>Version: {String(globalDirectives.version)}</span> : null}
                </div>
              </div>

              <div className="flex flex-col gap-4">
                {slides.length > 0 ? slides.map((slide, idx) => (
                  <section key={idx} className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm">
                    <div className="flex items-center justify-between gap-3 border-b border-border/70 bg-muted/20 px-4 py-2.5">
                      <div className="min-w-0">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                          Slide {idx + 1} of {slides.length}
                        </div>
                        <div className="truncate text-sm font-medium text-foreground/90">
                          {getSectionTitle(slide.content, `Section ${idx + 1}`)}
                        </div>
                      </div>
                    </div>
                    <div className="px-5 py-5 text-[15px]">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          ...documentMarkdownComponents,
                          img: ({ src, alt }: any) => (
                            <img
                              src={src}
                              alt={alt}
                              className="my-4 max-h-[420px] max-w-full cursor-zoom-in rounded-xl border border-border/70 object-contain shadow-sm transition-opacity hover:opacity-90"
                              onClick={() => src && handleImageClick(src, alt)}
                            />
                          ),
                        }}
                      >
                        {slide.content}
                      </ReactMarkdown>
                    </div>
                  </section>
                )) : (
                  <div className="rounded-xl border border-border/80 bg-card p-6 text-center text-xs text-muted-foreground">
                    No document content to display.
                  </div>
                )}
              </div>
            </div>
          ) : (
          <div className="w-full max-w-3xl flex flex-col gap-6 py-4">
            {slides.length > 0 ? slides.map((slide, idx) => (
              <div key={idx} className="relative group/slide-card">
                <SlidePage
                  slide={slide}
                  index={idx}
                  total={slides.length}
                  theme={slideTheme}
                  aspectRatio={aspectRatio}
                  textScale={textScale}
                  appearance={appearance}
                  kannaTheme={kannaTheme}
                  onImageClick={handleImageClick}
                />
                <div className="absolute top-2 left-2 text-[10px] bg-muted/65 text-muted-foreground/80 font-mono px-2 py-0.5 rounded border border-border opacity-0 group-hover/slide-card:opacity-100 transition-opacity select-none pointer-events-none">
                  Page {idx + 1}
                </div>
              </div>
            )) : (
              <div className="rounded-xl border border-border/80 bg-card p-6 text-center text-xs text-muted-foreground">
                No document content to display.
              </div>
            )}
          </div>
          )
        ) : (
          <div className="flex h-full min-h-0 w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
            <div className="flex items-center justify-between border-b border-border/70 px-3 py-2">
              <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                <Code className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate font-mono">{rawFileName || "Raw Markdown"}</span>
                {hasUnsavedChanges ? <span className="text-logo">Unsaved</span> : null}
              </div>
            </div>
            <textarea
              value={markdown}
              onChange={(e) => onMarkdownChange?.(e.target.value)}
              readOnly={!onMarkdownChange}
              spellCheck={false}
              className="min-h-0 flex-1 resize-none bg-background/70 p-4 font-mono text-xs leading-relaxed text-foreground outline-none placeholder:text-muted-foreground"
              placeholder="Markdown content..."
            />
          </div>
        )}
      </div>

      {/* Image zoom modal overlay */}
      {modalImage && (
        <ImageModal
          src={modalImage.src}
          alt={modalImage.alt}
          onClose={() => setModalImage(null)}
        />
      )}
    </div>
  )
}
