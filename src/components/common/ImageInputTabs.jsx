import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, Link as LinkIcon, X, AlertCircle, RefreshCw, CheckCircle2, 
  Image as ImageIcon, Loader2, ExternalLink 
} from 'lucide-react';
import { 
  validateImageFile, 
  validateImageUrl, 
  uploadImageToImageKit, 
  verifyImageKitAsset, 
  deleteImageKitAsset,
  IMAGE_LIMITS 
} from '../../lib/imagekit';

export function ImageInputTabs({
  onImageSelected, // ({ url, fileId, sourceType, width, height, byteSize, altText }) => void
  onRemove = null,
  initialUrl = '',
  initialSourceType = 'imagekit',
  initialFileId = null,
  folder = '/prompts',
  readOnly = false,
  compact = false,
}) {
  const [activeTab, setActiveTab] = useState('upload'); // 'upload' | 'url'

  // Upload state
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [stagedAsset, setStagedAsset] = useState(
    initialUrl ? { url: initialUrl, fileId: initialFileId, sourceType: initialSourceType } : null
  );

  // URL state
  const [inputUrl, setInputUrl] = useState(initialSourceType === 'external' ? initialUrl : '');
  const [urlPreview, setUrlPreview] = useState(initialSourceType === 'external' ? initialUrl : '');
  const [urlTesting, setUrlTesting] = useState(false);
  const [urlError, setUrlError] = useState(null);
  const [urlValid, setUrlValid] = useState(Boolean(initialSourceType === 'external' && initialUrl));

  const fileInputRef = useRef(null);

  // Handle Drag events
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (readOnly || uploading) return;
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (readOnly || uploading) return;
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (selected) {
      processSelectedFile(selected);
    }
  };

  // Perform upload to ImageKit directly with progress and verification
  const processSelectedFile = async (selectedFile) => {
    try {
      validateImageFile(selectedFile);
    } catch (valErr) {
      setUploadError(valErr.message);
      return;
    }

    setFile(selectedFile);
    setUploadError(null);
    setUploading(true);
    setUploadProgress(5);

    try {
      // 1. Upload directly to ImageKit with progress
      const result = await uploadImageToImageKit(
        selectedFile,
        { folder },
        (percent) => {
          setUploadProgress(Math.max(10, Math.min(90, percent)));
        }
      );

      setUploadProgress(95);

      // 2. Verify returned asset metadata through trusted server verification
      let verifiedData = result;
      try {
        if (result.fileId) {
          const verified = await verifyImageKitAsset(result.fileId);
          if (verified && verified.url) {
            verifiedData = { ...result, ...verified };
          }
        }
      } catch (verifyErr) {
        console.warn('Server asset verification notice:', verifyErr.message);
      }

      setUploadProgress(100);

      const assetPayload = {
        url: verifiedData.url,
        fileId: verifiedData.fileId,
        sourceType: 'imagekit',
        width: verifiedData.width || 1200,
        height: verifiedData.height || 800,
        byteSize: verifiedData.size || selectedFile.size,
        altText: selectedFile.name.replace(/\.[^/.]+$/, ''),
        name: selectedFile.name,
      };

      setStagedAsset(assetPayload);

      if (onImageSelected) {
        onImageSelected(assetPayload);
      }
    } catch (err) {
      setUploadError(err.message || 'Direct ImageKit upload failed. Please verify credentials and retry.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Retry upload for the currently selected file
  const handleRetryUpload = () => {
    if (file) {
      processSelectedFile(file);
    } else {
      fileInputRef.current?.click();
    }
  };

  // Remove staged image
  const handleRemoveStaged = async () => {
    if (stagedAsset?.fileId && stagedAsset?.sourceType === 'imagekit') {
      // Clean up abandoned asset on ImageKit if not saved
      try {
        await deleteImageKitAsset(stagedAsset.fileId);
      } catch (e) {
        console.warn('Cleanup error:', e);
      }
    }
    setStagedAsset(null);
    setFile(null);
    setUploadError(null);
    setUploadProgress(0);
    if (onRemove) onRemove();
  };

  // URL input handler
  const handleUrlInputChange = (e) => {
    const val = e.target.value;
    setInputUrl(val);
    setUrlError(null);
    setUrlValid(false);
  };

  // Test and validate URL in the browser
  const handleApplyUrl = () => {
    let cleanUrl = '';
    try {
      cleanUrl = validateImageUrl(inputUrl);
    } catch (err) {
      setUrlError(err.message);
      return;
    }

    setUrlTesting(true);
    setUrlError(null);

    // Test load in browser
    const testImg = new Image();
    testImg.onload = () => {
      setUrlTesting(false);
      setUrlValid(true);
      setUrlPreview(cleanUrl);

      const payload = {
        url: cleanUrl,
        fileId: null, // null for external URLs as specified
        sourceType: 'external',
        width: testImg.naturalWidth || 1200,
        height: testImg.naturalHeight || 800,
        byteSize: 0,
        altText: '',
      };

      if (onImageSelected) {
        onImageSelected(payload);
      }
    };

    testImg.onerror = () => {
      setUrlTesting(false);
      setUrlValid(false);
      setUrlError('Unable to load image from this URL. Please verify the URL points to a publicly accessible image.');
    };

    testImg.src = cleanUrl;
  };

  const handleClearUrl = () => {
    setInputUrl('');
    setUrlPreview('');
    setUrlValid(false);
    setUrlError(null);
    if (onRemove) onRemove();
  };

  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-3">
      {/* Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab('upload')}
          disabled={readOnly || uploading}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
            activeTab === 'upload'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Upload className="w-3.5 h-3.5" />
          <span>Upload image</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('url')}
          disabled={readOnly || uploading}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
            activeTab === 'url'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <LinkIcon className="w-3.5 h-3.5" />
          <span>Paste image URL</span>
        </button>
      </div>

      {/* TAB 1: UPLOAD IMAGE */}
      {activeTab === 'upload' && (
        <div className="space-y-3">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept={IMAGE_LIMITS.supportedMimeTypes.join(',')}
            className="hidden"
          />

          {/* Staged uploaded preview */}
          {stagedAsset?.url ? (
            <div className="p-3 border border-slate-200 rounded-xl bg-slate-50 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <img
                  src={stagedAsset.url}
                  alt={stagedAsset.name || 'Uploaded image'}
                  className="w-14 h-14 rounded-lg object-cover border border-slate-200 bg-white shrink-0"
                />
                <div className="min-w-0 text-xs">
                  <p className="font-semibold text-slate-900 truncate">
                    {stagedAsset.name || 'ImageKit asset'}
                  </p>
                  <p className="text-slate-500 text-[11px]">
                    {stagedAsset.byteSize ? formatBytes(stagedAsset.byteSize) : 'Managed asset'}
                    {stagedAsset.width ? ` • ${stagedAsset.width}×${stagedAsset.height}px` : ''}
                  </p>
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-600 uppercase tracking-wide mt-0.5">
                    <CheckCircle2 className="w-3 h-3 text-indigo-600" /> ImageKit Managed
                  </span>
                </div>
              </div>

              {!readOnly && (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-1.5 text-xs text-slate-600 hover:text-indigo-600 hover:bg-white rounded-lg border border-transparent hover:border-slate-200"
                    title="Replace image"
                  >
                    Replace
                  </button>
                  <button
                    type="button"
                    onClick={handleRemoveStaged}
                    className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg"
                    title="Remove image"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Drag and Drop Zone */
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => !readOnly && !uploading && fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer ${
                dragActive
                  ? 'border-indigo-500 bg-indigo-50/50 ring-2 ring-indigo-500/20'
                  : 'border-slate-300 hover:border-indigo-400 bg-slate-50/60 hover:bg-slate-50'
              } ${readOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <div className="flex flex-col items-center justify-center gap-2">
                <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-2xs">
                  {uploading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Upload className="w-5 h-5" />
                  )}
                </div>

                <div>
                  <p className="text-xs sm:text-sm font-semibold text-slate-800">
                    {uploading ? 'Uploading to ImageKit...' : 'Click to upload or drag & drop image'}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    JPG, PNG, WebP, GIF, AVIF up to {IMAGE_LIMITS.maxBytesLabel}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Progress bar */}
          {uploading && (
            <div className="p-3 bg-indigo-50/70 rounded-lg border border-indigo-100 space-y-1.5">
              <div className="flex items-center justify-between text-xs text-indigo-700 font-medium">
                <span className="flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Direct browser upload to ImageKit...
                </span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-indigo-200 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-indigo-600 h-1.5 rounded-full transition-all duration-200"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Upload error with Retry and Remove */}
          {uploadError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Upload error</p>
                  <p className="text-[11px]">{uploadError}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleRetryUpload}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700 hover:underline cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" /> Retry
                </button>
                <button
                  type="button"
                  onClick={() => setUploadError(null)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: PASTE IMAGE URL */}
      {activeTab === 'url' && (
        <div className="space-y-3">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="url"
                  disabled={readOnly}
                  value={inputUrl}
                  onChange={handleUrlInputChange}
                  placeholder="https://example-cdn.com/images/hero-art"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 pr-8 disabled:bg-slate-50"
                />
                {inputUrl && !readOnly && (
                  <button
                    type="button"
                    onClick={handleClearUrl}
                    className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
                    title="Clear input"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {!readOnly && (
                <button
                  type="button"
                  onClick={handleApplyUrl}
                  disabled={!inputUrl || urlTesting}
                  className="px-3.5 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg disabled:opacity-50 transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  {urlTesting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Checking...</span>
                    </>
                  ) : (
                    <span>Preview & Apply</span>
                  )}
                </button>
              )}
            </div>

            {/* Helper Note mandated by SRS */}
            <p className="text-[11px] text-amber-700 bg-amber-50/70 p-2 rounded border border-amber-200">
              💡 <strong>Note:</strong> This image is hosted externally. It may stop loading if the source changes.
            </p>
          </div>

          {/* URL Error Alert */}
          {urlError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Invalid image link</p>
                  <p className="text-[11px]">{urlError}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setUrlError(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* URL Preview Card */}
          {urlValid && urlPreview && (
            <div className="p-3 border border-slate-200 rounded-xl bg-slate-50 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <img
                  src={urlPreview}
                  alt="External image preview"
                  className="w-14 h-14 rounded-lg object-cover border border-slate-200 bg-white shrink-0"
                  onError={() => {
                    setUrlValid(false);
                    setUrlError('Image failed to load in browser. The source link may be restricted or blocked by CORS.');
                  }}
                />
                <div className="min-w-0 text-xs">
                  <p className="font-semibold text-slate-900 truncate max-w-xs">{urlPreview}</p>
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 uppercase tracking-wide">
                    External CDN (Not re-uploaded)
                  </span>
                </div>
              </div>

              {!readOnly && (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setInputUrl('');
                      setUrlValid(false);
                      setUrlPreview('');
                      if (onRemove) onRemove();
                    }}
                    className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg"
                    title="Remove external URL"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

