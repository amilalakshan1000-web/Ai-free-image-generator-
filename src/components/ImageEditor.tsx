import { useState, useRef } from 'react';
import ReactCrop, { type Crop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { X, Check, Crop as CropIcon, Maximize, SlidersHorizontal, RotateCcw } from 'lucide-react';

interface ImageEditorProps {
  imageUrl: string;
  onSave: (editedImageUrl: string) => void;
  onCancel: () => void;
}

// Helper to center crop
function centerAspectCrop(mediaWidth: number, mediaHeight: number, aspect: number) {
  return centerCrop(
    makeAspectCrop(
      {
        unit: '%',
        width: 90,
      },
      aspect,
      mediaWidth,
      mediaHeight,
    ),
    mediaWidth,
    mediaHeight,
  )
}

export default function ImageEditor({ imageUrl, onSave, onCancel }: ImageEditorProps) {
  const [activeTab, setActiveTab] = useState<'crop' | 'resize' | 'filters'>('crop');
  
  // Crop state
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<Crop>();
  const imgRef = useRef<HTMLImageElement>(null);

  // Resize state
  const [width, setWidth] = useState<number>(0);
  const [height, setHeight] = useState<number>(0);
  const [maintainAspectRatio, setMaintainAspectRatio] = useState(true);
  const [originalSize, setOriginalSize] = useState({ w: 0, h: 0 });

  // Filters state
  const [filters, setFilters] = useState({
    brightness: 100,
    contrast: 100,
    saturation: 100,
    grayscale: 0,
    sepia: 0,
    blur: 0,
  });

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = e.currentTarget;
    setWidth(naturalWidth);
    setHeight(naturalHeight);
    setOriginalSize({ w: naturalWidth, h: naturalHeight });
    
    // Default crop
    setCrop(centerAspectCrop(naturalWidth, naturalHeight, 1));
  };

  const handleWidthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newWidth = parseInt(e.target.value) || 0;
    setWidth(newWidth);
    if (maintainAspectRatio && originalSize.w > 0) {
      setHeight(Math.round(newWidth * (originalSize.h / originalSize.w)));
    }
  };

  const handleHeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newHeight = parseInt(e.target.value) || 0;
    setHeight(newHeight);
    if (maintainAspectRatio && originalSize.h > 0) {
      setWidth(Math.round(newHeight * (originalSize.w / originalSize.h)));
    }
  };

  const applyEdits = async () => {
    if (!imgRef.current) return;
    const image = imgRef.current;
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 1. Crop dimensions
    let sx = 0, sy = 0, sw = image.naturalWidth, sh = image.naturalHeight;
    if (completedCrop && completedCrop.width > 0 && completedCrop.height > 0) {
      const scaleX = image.naturalWidth / image.width;
      const scaleY = image.naturalHeight / image.height;
      sx = completedCrop.x * scaleX;
      sy = completedCrop.y * scaleY;
      sw = completedCrop.width * scaleX;
      sh = completedCrop.height * scaleY;
    }

    // 2. Resize dimensions
    const finalWidth = (width !== originalSize.w) ? width : sw;
    const finalHeight = (height !== originalSize.h) ? height : sh;

    canvas.width = finalWidth;
    canvas.height = finalHeight;

    // 3. Apply Filters
    ctx.filter = `brightness(${filters.brightness}%) contrast(${filters.contrast}%) saturate(${filters.saturation}%) grayscale(${filters.grayscale}%) sepia(${filters.sepia}%) blur(${filters.blur}px)`;

    // Draw
    ctx.drawImage(image, sx, sy, sw, sh, 0, 0, finalWidth, finalHeight);

    const base64Image = canvas.toDataURL('image/png');
    onSave(base64Image);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <h2 className="text-xl font-semibold text-zinc-100">Edit Image</h2>
          <button onClick={onCancel} className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden min-h-[500px]">
          {/* Main Editor Area */}
          <div className="flex-1 p-6 flex items-center justify-center bg-zinc-950 overflow-auto relative">
            {activeTab === 'crop' ? (
              <ReactCrop
                crop={crop}
                onChange={(_, percentCrop) => setCrop(percentCrop)}
                onComplete={(c) => setCompletedCrop(c)}
              >
                <img
                  ref={imgRef}
                  src={imageUrl}
                  alt="Edit"
                  onLoad={handleImageLoad}
                  className="max-w-full max-h-[60vh] object-contain"
                  style={{
                    filter: `brightness(${filters.brightness}%) contrast(${filters.contrast}%) saturate(${filters.saturation}%) grayscale(${filters.grayscale}%) sepia(${filters.sepia}%) blur(${filters.blur}px)`
                  }}
                  crossOrigin="anonymous"
                />
              </ReactCrop>
            ) : (
              <img
                ref={imgRef}
                src={imageUrl}
                alt="Edit"
                onLoad={handleImageLoad}
                className="max-w-full max-h-[60vh] object-contain"
                style={{
                  filter: `brightness(${filters.brightness}%) contrast(${filters.contrast}%) saturate(${filters.saturation}%) grayscale(${filters.grayscale}%) sepia(${filters.sepia}%) blur(${filters.blur}px)`
                }}
                crossOrigin="anonymous"
              />
            )}
          </div>

          {/* Sidebar Controls */}
          <div className="w-80 border-l border-zinc-800 bg-zinc-900/50 flex flex-col">
            <div className="flex border-b border-zinc-800">
              <button
                onClick={() => setActiveTab('crop')}
                className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 ${activeTab === 'crop' ? 'text-emerald-400 border-b-2 border-emerald-400 bg-emerald-400/5' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'}`}
              >
                <CropIcon className="w-4 h-4" /> Crop
              </button>
              <button
                onClick={() => setActiveTab('resize')}
                className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 ${activeTab === 'resize' ? 'text-emerald-400 border-b-2 border-emerald-400 bg-emerald-400/5' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'}`}
              >
                <Maximize className="w-4 h-4" /> Resize
              </button>
              <button
                onClick={() => setActiveTab('filters')}
                className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 ${activeTab === 'filters' ? 'text-emerald-400 border-b-2 border-emerald-400 bg-emerald-400/5' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'}`}
              >
                <SlidersHorizontal className="w-4 h-4" /> Filters
              </button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto space-y-6">
              {activeTab === 'crop' && (
                <div className="space-y-4 text-zinc-300 text-sm">
                  <p>Drag on the image to select the area you want to crop.</p>
                  <button
                    onClick={() => setCrop(undefined)}
                    className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    <RotateCcw className="w-4 h-4" /> Reset Crop
                  </button>
                </div>
              )}

              {activeTab === 'resize' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm text-zinc-400">Width (px)</label>
                    <input
                      type="number"
                      value={width}
                      onChange={handleWidthChange}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-100 focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm text-zinc-400">Height (px)</label>
                    <input
                      type="number"
                      value={height}
                      onChange={handleHeightChange}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-100 focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={maintainAspectRatio}
                      onChange={(e) => setMaintainAspectRatio(e.target.checked)}
                      className="rounded border-zinc-700 text-emerald-500 focus:ring-emerald-500 bg-zinc-900"
                    />
                    Maintain aspect ratio
                  </label>
                </div>
              )}

              {activeTab === 'filters' && (
                <div className="space-y-5">
                  {[
                    { label: 'Brightness', key: 'brightness', min: 0, max: 200, unit: '%' },
                    { label: 'Contrast', key: 'contrast', min: 0, max: 200, unit: '%' },
                    { label: 'Saturation', key: 'saturation', min: 0, max: 200, unit: '%' },
                    { label: 'Grayscale', key: 'grayscale', min: 0, max: 100, unit: '%' },
                    { label: 'Sepia', key: 'sepia', min: 0, max: 100, unit: '%' },
                    { label: 'Blur', key: 'blur', min: 0, max: 20, unit: 'px' },
                  ].map((filter) => (
                    <div key={filter.key} className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <label className="text-zinc-400">{filter.label}</label>
                        <span className="text-zinc-500">{filters[filter.key as keyof typeof filters]}{filter.unit}</span>
                      </div>
                      <input
                        type="range"
                        min={filter.min}
                        max={filter.max}
                        value={filters[filter.key as keyof typeof filters]}
                        onChange={(e) => setFilters({ ...filters, [filter.key]: parseInt(e.target.value) })}
                        className="w-full accent-emerald-500"
                      />
                    </div>
                  ))}
                  <button
                    onClick={() => setFilters({ brightness: 100, contrast: 100, saturation: 100, grayscale: 0, sepia: 0, blur: 0 })}
                    className="w-full py-2 mt-4 bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm text-zinc-300"
                  >
                    <RotateCcw className="w-4 h-4" /> Reset Filters
                  </button>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="p-4 border-t border-zinc-800 flex gap-3">
              <button
                onClick={onCancel}
                className="flex-1 py-2.5 rounded-xl font-medium text-zinc-300 bg-zinc-800 hover:bg-zinc-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={applyEdits}
                className="flex-1 py-2.5 rounded-xl font-medium text-zinc-950 bg-emerald-500 hover:bg-emerald-400 transition-colors flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" /> Apply
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
