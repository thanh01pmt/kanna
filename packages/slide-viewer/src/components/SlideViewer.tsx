import React, { useState, useEffect, useRef } from "react"
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
} from "lucide-react"

interface SlideViewerProps {
  markdown: string;
  kannaTheme?: "light" | "dark"; // Default is dark
}

export const SlideViewer: React.FC<SlideViewerProps> = ({
  markdown,
  kannaTheme = "dark",
}) => {
  // Parse presentation
  const { slides, globalDirectives } = parseMarpMarkdown(markdown)

  // Viewer state
  const [viewMode, setViewMode] = useState<"slides" | "document">("slides")
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [modalImage, setModalImage] = useState<{ src: string; alt?: string } | null>(null)

  // Slide settings
  const [slideTheme, setSlideTheme] = useState<string>("default")
  const [aspectRatio, setAspectRatio] = useState<"16:9" | "4:3">("16:9")
  const [textScale, setTextScale] = useState<number>(100)
  const [appearance, setAppearance] = useState<"auto" | "light" | "dark">("auto")

  const settingsRef = useRef<HTMLDivElement>(null)

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

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in inputs/textareas
      const activeEl = document.activeElement?.tagName
      if (activeEl === "INPUT" || activeEl === "TEXTAREA") return

      switch (e.key) {
        case "ArrowRight":
        case " ":
        case "PageDown":
          e.preventDefault()
          setCurrentSlideIndex(prev => Math.min(prev + 1, slides.length - 1))
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
          setCurrentSlideIndex(slides.length - 1)
          break
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [viewMode, slides.length])

  // Handles image click zoom
  const handleImageClick = (src: string, alt?: string) => {
    setModalImage({ src, alt })
  }

  if (!slides || slides.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-6 text-center">
        <FileText className="h-10 w-10 mb-2 opacity-55 animate-pulse" />
        <p className="text-sm font-medium">No slides to display</p>
        <p className="text-xs opacity-70 mt-1">Please select or write a markdown file.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-background text-foreground overflow-hidden">
      {/* Top Action Header */}
      <div className="flex items-center justify-between border-b border-border/80 px-4 py-2.5 bg-card">
        {/* Segmented Control for View Mode */}
        <div className="inline-flex items-center rounded-lg border border-border p-[3px] bg-muted/20">
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
        </div>

        {/* Settings / Customize Menu */}
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

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col items-center">
        {viewMode === "slides" ? (
          /* Slide Mode */
          <div className="w-full max-w-4xl flex-1 flex flex-col justify-center gap-4 py-4">
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

            {/* Slide Navigation Controls */}
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
                Slide {currentSlideIndex + 1} of {slides.length}
              </span>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentSlideIndex(prev => Math.min(prev + 1, slides.length - 1))}
                  disabled={currentSlideIndex === slides.length - 1}
                  className="p-1.5 rounded-full hover:bg-muted disabled:opacity-40 transition-colors"
                  title="Next Slide"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setCurrentSlideIndex(slides.length - 1)}
                  disabled={currentSlideIndex === slides.length - 1}
                  className="p-1.5 rounded-full hover:bg-muted disabled:opacity-40 transition-colors"
                  title="Last Slide"
                >
                  <ChevronsRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Document continuous Mode */
          <div className="w-full max-w-3xl flex flex-col gap-6 py-4">
            {slides.map((slide, idx) => (
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
            ))}
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
