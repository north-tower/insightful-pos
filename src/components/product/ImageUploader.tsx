import { useState, useRef, useCallback } from 'react';
import {
  Camera,
  Upload,
  Link2,
  X,
  ImagePlus,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { uploadProductImage } from '@/lib/product-images';
import { generatePlaceholderUrl } from '@/lib/product-images';
import { toast } from 'sonner';

interface ImageUploaderProps {
  /** Current image URL (existing product image or newly uploaded) */
  value: string;
  /** Called whenever the image URL changes */
  onChange: (url: string) => void;
  /** Product name — used for placeholder generation */
  productName?: string;
  /** Whether the uploader is disabled */
  disabled?: boolean;
  /** Class name for the container */
  className?: string;
}

type InputMode = 'default' | 'url';

export default function ImageUploader({
  value,
  onChange,
  productName = '',
  disabled = false,
  className,
}: ImageUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [inputMode, setInputMode] = useState<InputMode>('default');
  const [urlInput, setUrlInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const placeholder = productName ? generatePlaceholderUrl(productName) : '';
  const displayUrl = value || placeholder;
  const hasImage = !!value;

  // ── Upload handler ─────────────────────────────────────────────────────

  const handleUpload = useCallback(async (file: File) => {
    // Validate
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      toast.error('Image must be under 5 MB');
      return;
    }
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    // Simulate progress (Supabase doesn't give upload progress)
    const progressInterval = setInterval(() => {
      setUploadProgress((p) => Math.min(p + 15, 85));
    }, 200);

    try {
      const publicUrl = await uploadProductImage(file);
      setUploadProgress(100);
      onChange(publicUrl);
      toast.success('Image uploaded');
    } catch (err: any) {
      console.error('Upload failed:', err);
      toast.error(err.message || 'Failed to upload image');
    } finally {
      clearInterval(progressInterval);
      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
      }, 500);
    }
  }, [onChange]);

  // ── File input change ──────────────────────────────────────────────────

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
    // Reset input so the same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── Drag & drop ───────────────────────────────────────────────────────

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragIn = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.items?.length) setIsDragging(true);
  }, []);

  const handleDragOut = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled || isUploading) return;

    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      handleUpload(file);
    } else {
      toast.error('Please drop an image file');
    }
  }, [disabled, isUploading, handleUpload]);

  // ── URL paste ──────────────────────────────────────────────────────────

  const handleUrlSubmit = () => {
    const url = urlInput.trim();
    if (!url) return;
    try {
      new URL(url); // Validate URL format
      onChange(url);
      setUrlInput('');
      setInputMode('default');
      toast.success('Image URL set');
    } catch {
      toast.error('Please enter a valid URL');
    }
  };

  // ── Remove image ──────────────────────────────────────────────────────

  const handleRemove = () => {
    onChange('');
  };

  // ── Hidden file input ─────────────────────────────────────────────────

  const fileInput = (
    <input
      ref={fileInputRef}
      type="file"
      accept="image/jpeg,image/png,image/webp,image/gif"
      capture="environment"
      className="hidden"
      onChange={handleFileChange}
      disabled={disabled || isUploading}
    />
  );

  // ── URL input mode ────────────────────────────────────────────────────

  if (inputMode === 'url') {
    return (
      <div className={cn('space-y-2', className)}>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Link2 className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="https://example.com/image.jpg"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleUrlSubmit()}
              className="pl-9 text-sm"
              autoFocus
              disabled={disabled}
            />
          </div>
          <Button size="sm" onClick={handleUrlSubmit} disabled={disabled || !urlInput.trim()}>
            Set
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => { setInputMode('default'); setUrlInput(''); }}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Paste any image URL and press Enter or click Set
        </p>
      </div>
    );
  }

  // ── Main uploader UI ──────────────────────────────────────────────────

  return (
    <div className={cn('space-y-2', className)}>
      {fileInput}

      {/* Image preview or upload zone */}
      <div
        className={cn(
          'relative group rounded-xl border-2 border-dashed transition-all overflow-hidden',
          isDragging
            ? 'border-primary bg-primary/5 scale-[1.02]'
            : hasImage
              ? 'border-border hover:border-primary/40'
              : 'border-muted-foreground/25 hover:border-primary/40',
          isUploading && 'pointer-events-none opacity-80',
          disabled && 'opacity-50 pointer-events-none',
        )}
        onDragEnter={handleDragIn}
        onDragLeave={handleDragOut}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        {/* Image or placeholder */}
        {displayUrl ? (
          <div className="relative aspect-[16/10] bg-muted">
            <img
              src={displayUrl}
              alt="Product"
              className="w-full h-full object-cover"
              onError={(e) => {
                // If image fails to load, show placeholder instead
                if (placeholder) (e.target as HTMLImageElement).src = placeholder;
              }}
            />

            {/* Upload overlay on hover */}
            {!isUploading && !disabled && (
              <div
                className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="text-center text-white">
                  <Camera className="w-8 h-8 mx-auto mb-1" />
                  <p className="text-sm font-medium">Change Image</p>
                  <p className="text-[10px] text-white/70">Click or drag a new image</p>
                </div>
              </div>
            )}

            {/* Remove button */}
            {hasImage && !isUploading && !disabled && (
              <button
                onClick={handleRemove}
                className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors opacity-0 group-hover:opacity-100"
                title="Remove image"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}

            {/* "Using placeholder" indicator */}
            {!hasImage && productName && (
              <div className="absolute bottom-2 left-2 right-2">
                <div className="bg-black/60 text-white text-[10px] px-2 py-1 rounded-full text-center backdrop-blur-sm">
                  Auto-generated • Upload or paste a URL for a custom image
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Empty state — no image and no name for placeholder */
          <div
            className="aspect-[16/10] flex flex-col items-center justify-center gap-2 cursor-pointer bg-muted/30"
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
              <ImagePlus className="w-7 h-7 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">Add product image</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Drag & drop, click to browse, or use camera
              </p>
            </div>
          </div>
        )}

        {/* Upload progress overlay */}
        {isUploading && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
            {uploadProgress < 100 ? (
              <>
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <div className="w-48">
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground text-center mt-1.5">
                    Uploading… {uploadProgress}%
                  </p>
                </div>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-8 h-8 text-success" />
                <p className="text-sm font-medium text-success">Uploaded!</p>
              </>
            )}
          </div>
        )}

        {/* Drag overlay */}
        {isDragging && (
          <div className="absolute inset-0 bg-primary/10 backdrop-blur-sm flex items-center justify-center border-2 border-primary rounded-xl">
            <div className="text-center">
              <Upload className="w-10 h-10 text-primary mx-auto mb-2 animate-bounce" />
              <p className="text-sm font-semibold text-primary">Drop image here</p>
            </div>
          </div>
        )}
      </div>

      {/* Action buttons */}
      {!disabled && !isUploading && (
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="flex-1 text-xs h-8"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-3.5 h-3.5 mr-1.5" />
            Upload
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="flex-1 text-xs h-8"
            onClick={() => {
              // Trigger camera specifically on mobile
              if (fileInputRef.current) {
                fileInputRef.current.setAttribute('capture', 'environment');
                fileInputRef.current.click();
              }
            }}
          >
            <Camera className="w-3.5 h-3.5 mr-1.5" />
            Camera
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="flex-1 text-xs h-8"
            onClick={() => setInputMode('url')}
          >
            <Link2 className="w-3.5 h-3.5 mr-1.5" />
            URL
          </Button>
        </div>
      )}

      <p className="text-[10px] text-muted-foreground">
        JPG, PNG, WebP or GIF • Max 5 MB
        {!hasImage && productName && ' • A placeholder is auto-generated from the product name'}
      </p>
    </div>
  );
}
