import React, { useState, useRef } from 'react';
import { 
  Upload, X, ArrowUp, ArrowDown, Star, Play, AlertCircle, RefreshCw, 
  Image as ImageIcon, Video as VideoIcon, CheckCircle2, Globe 
} from 'lucide-react';
import { VIDEO_PUBLISHING_ENABLED } from '../../lib/supabaseClient';
import { ImageInputTabs } from './ImageInputTabs';
import { getImageVariant } from '../../lib/imagekit';

export function MediaUpload({
  media = [],
  coverMediaId,
  mediaType = 'image',
  onAddMedia,
  onUpdateMedia,
  onDeleteMedia,
  onSetCover,
  onReorderMedia,
  readOnly = false,
  folder = '/prompts',
}) {
  // Video playback preview state
  const [playingVideoId, setPlayingVideoId] = useState(null);
  const [videoUploading, setVideoUploading] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoError, setVideoError] = useState(null);
  const videoInputRef = useRef(null);

  // Callback when ImageInputTabs finishes uploading to ImageKit or validating external URL
  const handleImageSelected = async (asset) => {
    const derivedThumb = getImageVariant(asset.url, asset.sourceType, 'thumbnail');
    const derivedPreview = getImageVariant(asset.url, asset.sourceType, 'preview');

    const mediaItem = {
      source_type: asset.sourceType || 'imagekit',
      image_url: asset.url,
      imagekit_file_id: asset.fileId || null,
      storage_path: asset.url,
      thumbnail_path: derivedThumb,
      preview_path: derivedPreview,
      alt_text: asset.altText || '',
      width: asset.width || 1200,
      height: asset.height || 800,
      byte_size: asset.byteSize || 0,
      duration_ms: null,
      sort_order: media.length + 1,
    };

    if (onAddMedia) {
      await onAddMedia(mediaItem);
    }
  };

  // Video file selection handler (only when mediaType === 'video')
  const handleVideoSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('video/')) {
      setVideoError('Please select a valid MP4 or WebM video file.');
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      setVideoError('Video file exceeds maximum size limit of 50MB.');
      return;
    }

    setVideoError(null);
    setVideoUploading(true);
    setVideoProgress(20);

    try {
      const previewUrl = URL.createObjectURL(file);
      const videoElement = document.createElement('video');
      videoElement.preload = 'metadata';
      videoElement.src = previewUrl;

      let durationMs = null;
      let width = null;
      let height = null;

      await new Promise((resolve, reject) => {
        videoElement.onloadedmetadata = () => {
          durationMs = Math.round(videoElement.duration * 1000);
          width = videoElement.videoWidth;
          height = videoElement.videoHeight;
          resolve();
        };
        videoElement.onerror = () => reject(new Error('Corrupted or unreadable video stream.'));
      });

      setVideoProgress(80);

      const mediaItem = {
        file,
        source_type: 'video',
        image_url: previewUrl,
        imagekit_file_id: null,
        storage_path: previewUrl,
        thumbnail_path: previewUrl,
        preview_path: previewUrl,
        alt_text: file.name.replace(/\.[^/.]+$/, ''),
        byte_size: file.size,
        duration_ms: durationMs,
        width: width || 1280,
        height: height || 720,
        sort_order: media.length + 1,
      };

      await onAddMedia(mediaItem);
      setVideoProgress(100);
    } catch (err) {
      setVideoError(err.message || 'Failed to process video file.');
    } finally {
      setVideoUploading(false);
      if (videoInputRef.current) videoInputRef.current.value = '';
    }
  };

  const moveItem = (index, direction) => {
    const newMedia = [...media];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= newMedia.length) return;

    const temp = newMedia[index];
    newMedia[index] = newMedia[targetIndex];
    newMedia[targetIndex] = temp;

    newMedia.forEach((m, idx) => {
      m.sort_order = idx + 1;
    });

    onReorderMedia(newMedia);
  };

  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Media Samples & Assets</h3>
          <p className="text-xs text-slate-500">
            {mediaType === 'video'
              ? 'Upload video clip and poster. Video previews load on Play.'
              : 'Direct ImageKit upload with transformations, or external image URL.'}
          </p>
        </div>
        <span className="text-xs font-medium text-slate-500">
          {media.length} sample{media.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Input Section */}
      {!readOnly && (
        <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200">
          {mediaType === 'video' ? (
            /* Video Upload UI */
            <div>
              <input
                type="file"
                ref={videoInputRef}
                onChange={handleVideoSelect}
                accept="video/mp4,video/webm"
                className="hidden"
              />
              <button
                type="button"
                onClick={() => videoInputRef.current?.click()}
                disabled={videoUploading || !VIDEO_PUBLISHING_ENABLED}
                className="w-full border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-xl p-6 flex flex-col items-center justify-center gap-2 bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <VideoIcon className="w-8 h-8 text-indigo-600" />
                <span className="text-sm font-medium text-indigo-600">
                  {videoUploading ? 'Processing video clip...' : 'Click to upload video (MP4/WebM)'}
                </span>
                <p className="text-xs text-slate-500">Max size 50MB</p>
              </button>

              {!VIDEO_PUBLISHING_ENABLED && (
                <p className="text-xs text-amber-700 mt-2 bg-amber-50 p-2 rounded border border-amber-200">
                  Note: Video publishing is disabled by configuration flag (<code>VITE_ENABLE_VIDEO_PUBLISHING=false</code>).
                </p>
              )}

              {videoError && (
                <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center justify-between">
                  <span>{videoError}</span>
                  <button type="button" onClick={() => setVideoError(null)}>
                    <X className="w-4 h-4 text-slate-400" />
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Image Input Tabs Component (Upload Image vs Paste Image URL) */
            <ImageInputTabs
              onImageSelected={handleImageSelected}
              folder={folder}
              readOnly={readOnly}
            />
          )}
        </div>
      )}

      {/* Media Items List */}
      {media.length > 0 && (
        <div className="space-y-3">
          {media.map((item, index) => {
            const isCover = item.id === coverMediaId;
            const isVideo = mediaType === 'video' || item.source_type === 'video';
            const isExternal = item.source_type === 'external';
            const displayUrl = item.thumbnail_path || item.preview_path || item.image_url || item.storage_path;

            return (
              <div
                key={item.id}
                className={`flex flex-col sm:flex-row items-start sm:items-center gap-4 p-3.5 rounded-xl border bg-white shadow-xs transition-all ${
                  isCover ? 'border-indigo-500 ring-1 ring-indigo-500/30' : 'border-slate-200'
                }`}
              >
                {/* Media preview box */}
                <div className="relative w-24 h-24 sm:w-20 sm:h-20 rounded-lg overflow-hidden bg-slate-900 shrink-0 border border-slate-200 flex items-center justify-center">
                  {isVideo ? (
                    playingVideoId === item.id ? (
                      <video
                        src={item.storage_path || item.image_url}
                        controls
                        autoPlay
                        className="w-full h-full object-cover"
                        onEnded={() => setPlayingVideoId(null)}
                      />
                    ) : (
                      <div className="relative w-full h-full">
                        <img
                          src={item.preview_path || item.thumbnail_path}
                          alt={item.alt_text || 'Video poster'}
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => setPlayingVideoId(item.id)}
                          className="absolute inset-0 m-auto w-8 h-8 rounded-full bg-slate-900/70 hover:bg-slate-900 text-white flex items-center justify-center cursor-pointer transition-transform hover:scale-110"
                          title="Play video preview"
                        >
                          <Play className="w-4 h-4 ml-0.5 fill-current" />
                        </button>
                      </div>
                    )
                  ) : (
                    <img
                      src={displayUrl}
                      alt={item.alt_text || 'Prompt sample'}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      onError={(e) => {
                        // Fallback placeholder if external or broken
                        e.target.onerror = null;
                        e.target.src = 'https://placehold.co/400x300/f1f5f9/64748b?text=Image+Unavailable';
                      }}
                    />
                  )}

                  {isCover && (
                    <span className="absolute top-1 left-1 bg-indigo-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-xs">
                      COVER
                    </span>
                  )}
                </div>

                {/* Details & Source Badge */}
                <div className="flex-1 w-full space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-slate-700">
                      Sample #{index + 1}
                      {item.width ? ` • ${item.width}×${item.height}px` : ''}
                      {item.byte_size ? ` • ${formatBytes(item.byte_size)}` : ''}
                      {item.duration_ms ? ` • ${(item.duration_ms / 1000).toFixed(1)}s` : ''}
                    </span>

                    {/* Source Type Badge */}
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                        isExternal
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                      }`}
                    >
                      {isExternal ? (
                        <>
                          <Globe className="w-3 h-3 text-amber-600" /> External URL
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3 h-3 text-indigo-600" /> ImageKit Managed
                        </>
                      )}
                    </span>
                  </div>

                  <input
                    type="text"
                    disabled={readOnly}
                    placeholder="Descriptive Alt Text (for accessibility)..."
                    value={item.alt_text || ''}
                    onChange={(e) => onUpdateMedia(item.id, { alt_text: e.target.value })}
                    className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50"
                  />
                </div>

                {/* Actions: Set Cover, Reorder Up/Down, Remove */}
                {!readOnly && (
                  <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                    <button
                      type="button"
                      onClick={() => onSetCover(item.id)}
                      className={`p-1.5 rounded-lg border text-xs font-medium inline-flex items-center gap-1 ${
                        isCover
                          ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                      title={isCover ? 'Current Cover' : 'Set as primary Cover'}
                    >
                      <Star className={`w-3.5 h-3.5 ${isCover ? 'fill-indigo-600 text-indigo-600' : ''}`} />
                      <span className="hidden sm:inline">{isCover ? 'Cover' : 'Make Cover'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => moveItem(index, -1)}
                      disabled={index === 0}
                      className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Move Up"
                      aria-label="Move sample up"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => moveItem(index, 1)}
                      disabled={index === media.length - 1}
                      className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Move Down"
                      aria-label="Move sample down"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => onDeleteMedia(item.id)}
                      className="p-1.5 rounded-lg border border-slate-200 text-rose-600 hover:bg-rose-50"
                      title="Remove sample"
                      aria-label="Remove sample"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
