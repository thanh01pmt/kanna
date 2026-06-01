import React, { useState, useEffect } from "react"
import { X, ZoomIn, ZoomOut, RotateCw, RefreshCw } from "lucide-react"

interface ImageModalProps {
  src: string;
  alt?: string;
  onClose: () => void;
}

export const ImageModal: React.FC<ImageModalProps> = ({ src, alt, onClose }) => {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);

  // Close modal on escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleZoomIn = () => setScale(s => Math.min(s + 0.25, 3));
  const handleZoomOut = () => setScale(s => Math.max(s - 0.25, 0.5));
  const handleRotate = () => setRotation(r => (r + 90) % 360);
  const handleReset = () => {
    setScale(1);
    setRotation(0);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 flex flex-col items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
      {/* Top toolbar */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10">
        <div className="text-white/80 text-xs font-mono select-none truncate max-w-[60%]">
          {alt || "Image Preview"}
        </div>
        
        <div className="flex items-center gap-2 bg-neutral-900/80 border border-neutral-800 rounded-full px-3 py-1.5 shadow-lg backdrop-blur-md">
          <button
            onClick={handleZoomIn}
            className="text-white/70 hover:text-white transition-colors p-1"
            title="Zoom In"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          
          <button
            onClick={handleZoomOut}
            className="text-white/70 hover:text-white transition-colors p-1"
            title="Zoom Out"
          >
            <ZoomOut className="h-4 w-4" />
          </button>

          <button
            onClick={handleRotate}
            className="text-white/70 hover:text-white transition-colors p-1"
            title="Rotate"
          >
            <RotateCw className="h-4 w-4" />
          </button>

          <button
            onClick={handleReset}
            className="text-white/70 hover:text-white transition-colors p-1"
            title="Reset"
          >
            <RefreshCw className="h-4 w-4" />
          </button>

          <div className="h-3 w-[1px] bg-neutral-800 mx-1" />

          <button
            onClick={onClose}
            className="text-white/70 hover:text-white transition-colors p-1 rounded-full hover:bg-neutral-800"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Main Image Viewport */}
      <div 
        className="w-full h-full flex items-center justify-center overflow-auto cursor-zoom-out"
        onClick={onClose}
      >
        <img
          src={src}
          alt={alt}
          style={{
            transform: `scale(${scale}) rotate(${rotation}deg)`,
            transition: "transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)",
          }}
          className="max-h-[85vh] max-w-[85vw] object-contain rounded shadow-2xl select-none"
          onClick={(e) => e.stopPropagation()} // Prevent closing when clicking the image
        />
      </div>
    </div>
  );
};
