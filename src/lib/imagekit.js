import { supabase, isLiveSupabaseConfigured } from './supabaseClient.js';

const env = (typeof import.meta !== 'undefined' && import.meta.env) || (typeof process !== 'undefined' && process.env) || {};

export const IMAGE_LIMITS = {
  maxBytes: 10 * 1024 * 1024, // 10MB
  maxBytesLabel: '10 MB',
  supportedMimeTypes: [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/avif',
  ],
  supportedExtensions: ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'],
};

export const IMAGEKIT_CONFIG = {
  urlEndpoint: env.VITE_IMAGEKIT_URL_ENDPOINT || 'https://ik.imagekit.io/demo',
  publicKey: env.VITE_IMAGEKIT_PUBLIC_KEY || '',
};

/**
 * Validate image file type and byte size against centralized policy
 */
export function validateImageFile(file) {
  if (!file) {
    throw new Error('No file selected.');
  }

  if (!IMAGE_LIMITS.supportedMimeTypes.includes(file.type)) {
    throw new Error(
      `Unsupported file format (${file.type || 'unknown'}). Please select a JPG, PNG, WebP, GIF, or AVIF image.`
    );
  }

  if (file.size > IMAGE_LIMITS.maxBytes) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    throw new Error(
      `File size (${sizeMb} MB) exceeds maximum allowed limit of ${IMAGE_LIMITS.maxBytesLabel}.`
    );
  }

  return true;
}

/**
 * Validates a direct HTTPS image URL
 */
export function validateImageUrl(url) {
  if (!url || typeof url !== 'string') {
    throw new Error('Please enter a valid image URL.');
  }

  const trimmed = url.trim();
  if (!trimmed.startsWith('https://')) {
    throw new Error('Image URL must use secure HTTPS protocol (https://...).');
  }

  try {
    new URL(trimmed);
  } catch {
    throw new Error('Invalid URL format. Please provide a complete, well-formed HTTPS URL.');
  }

  return trimmed;
}

/**
 * Centrally derive responsive ImageKit display variants
 * Does NOT transform external third-party URLs.
 */
export function getImageVariant(url, sourceType = 'imagekit', variant = 'thumbnail') {
  if (!url) return '';

  // External URLs must be served as-is without ImageKit transforms
  if (sourceType === 'external') {
    return url;
  }

  // If not an ImageKit URL, return as-is
  const isImageKit = url.includes('ik.imagekit.io') || sourceType === 'imagekit';
  if (!isImageKit) {
    return url;
  }

  const transformParams = {
    thumbnail: 'tr=w-400,h-300,fo-auto,q-80',
    preview: 'tr=w-1200,h-800,fo-auto,q-85',
    fullscreen: 'tr=w-1920,q-90',
    raw: '',
  };

  const transform = transformParams[variant] || '';
  if (!transform) return url;

  // Append query-based transform
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}${transform}`;
}

/**
 * Compute HMAC-SHA1 signature in browser or Node environment
 */
async function computeLocalHmacSha1(data, secret) {
  if (typeof globalThis.crypto?.subtle !== 'undefined') {
    const enc = new TextEncoder();
    const key = await globalThis.crypto.subtle.importKey(
      'raw',
      enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-1' },
      false,
      ['sign']
    );
    const signature = await globalThis.crypto.subtle.sign('HMAC', key, enc.encode(data));
    return Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  return '';
}

/**
 * Request short-lived upload authorization from Supabase Edge Function
 */
export async function getImageKitUploadAuth(folder = '/prompts') {
  if (!isLiveSupabaseConfigured || !supabase) {
    // Local demo fallback
    return {
      token: crypto.randomUUID(),
      expire: Math.floor(Date.now() / 1000) + 1800,
      signature: 'demo_mock_signature',
      publicKey: IMAGEKIT_CONFIG.publicKey || 'public_demo_key',
      urlEndpoint: IMAGEKIT_CONFIG.urlEndpoint,
    };
  }

  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session) {
    throw new Error('Authentication required: please sign in to upload assets.');
  }

  const functionUrl = `${env.VITE_SUPABASE_URL}/functions/v1/imagekit-auth`;

  try {
    const res = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ action: 'auth', folder }),
    });

    const data = await res.json();
    if (!res.ok) {
      if (data.needsConfig) {
        if (env.VITE_IMAGEKIT_PRIVATE_KEY) {
          const token = crypto.randomUUID();
          const expire = Math.floor(Date.now() / 1000) + 1800;
          const signature = await computeLocalHmacSha1(`${token}${expire}`, env.VITE_IMAGEKIT_PRIVATE_KEY);
          return {
            token,
            expire,
            signature,
            publicKey: env.VITE_IMAGEKIT_PUBLIC_KEY || IMAGEKIT_CONFIG.publicKey,
            urlEndpoint: env.VITE_IMAGEKIT_URL_ENDPOINT || IMAGEKIT_CONFIG.urlEndpoint,
          };
        }
        throw new Error(
          'ImageKit is not fully configured on server. Please add VITE_IMAGEKIT_PRIVATE_KEY to your .env file or set IMAGEKIT_PRIVATE_KEY in Supabase Edge Function secrets.'
        );
      }
      throw new Error(data.error || `Upload authorization failed with HTTP ${res.status}`);
    }

    return data;
  } catch (err) {
    if (env.VITE_IMAGEKIT_PRIVATE_KEY) {
      console.warn('ImageKit Edge Function unavailable, using local key from .env:', err.message);
      const token = crypto.randomUUID();
      const expire = Math.floor(Date.now() / 1000) + 1800;
      const signature = await computeLocalHmacSha1(`${token}${expire}`, env.VITE_IMAGEKIT_PRIVATE_KEY);
      return {
        token,
        expire,
        signature,
        publicKey: env.VITE_IMAGEKIT_PUBLIC_KEY || IMAGEKIT_CONFIG.publicKey,
        urlEndpoint: env.VITE_IMAGEKIT_URL_ENDPOINT || IMAGEKIT_CONFIG.urlEndpoint,
      };
    }
    throw err;
  }
}

/**
 * Upload an image file directly to ImageKit from browser with progress callback
 */
export function uploadImageToImageKit(file, options = {}, onProgress = null) {
  return new Promise((resolve, reject) => {
    try {
      validateImageFile(file);
    } catch (valErr) {
      return reject(valErr);
    }

    const folder = options.folder || '/prompts';

    getImageKitUploadAuth(folder)
      .then((authData) => {
        const formData = new FormData();
        const ext = file.name.split('.').pop() || 'jpg';
        const sanitizedName = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${ext}`;

        formData.append('file', file);
        formData.append('fileName', sanitizedName);
        formData.append('publicKey', authData.publicKey || IMAGEKIT_CONFIG.publicKey);
        formData.append('signature', authData.signature);
        formData.append('expire', String(authData.expire));
        formData.append('token', authData.token);
        formData.append('folder', folder);
        formData.append('useUniqueFileName', 'true');

        const xhr = new XMLHttpRequest();
        xhr.open('POST', 'https://upload.imagekit.io/api/v1/files/upload');

        if (onProgress && xhr.upload) {
          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              const percent = Math.round((event.loaded / event.total) * 100);
              onProgress(percent);
            }
          };
        }

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const response = JSON.parse(xhr.responseText);
              resolve({
                fileId: response.fileId,
                url: response.url,
                thumbnailUrl: response.thumbnailUrl || response.url,
                name: response.name,
                width: response.width || 1200,
                height: response.height || 800,
                size: response.size || file.size,
                filePath: response.filePath,
                source_type: 'imagekit',
              });
            } catch (jsonErr) {
              reject(new Error('Invalid JSON response from ImageKit upload API.'));
            }
          } else {
            let msg = 'Upload to ImageKit failed.';
            try {
              const errResp = JSON.parse(xhr.responseText);
              msg = errResp.message || errResp.error || msg;
            } catch {}
            reject(new Error(`${msg} (HTTP ${xhr.status})`));
          }
        };

        xhr.onerror = () => {
          reject(new Error('Network error during direct upload to ImageKit. Please check your connection.'));
        };

        xhr.send(formData);
      })
      .catch(reject);
  });
}

/**
 * Verify an uploaded ImageKit asset via server endpoint
 */
export async function verifyImageKitAsset(fileId) {
  if (!isLiveSupabaseConfigured || !supabase) {
    return { valid: true, fileId };
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated.');

  const functionUrl = `${env.VITE_SUPABASE_URL}/functions/v1/imagekit-auth`;
  const res = await fetch(functionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ action: 'verify', fileId }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to verify ImageKit asset.');
  }

  return data;
}

/**
 * Clean up an unreferenced or abandoned managed ImageKit file
 */
export async function deleteImageKitAsset(fileId) {
  if (!fileId) return true;
  if (!isLiveSupabaseConfigured || !supabase) return true;

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return true;

  const functionUrl = `${env.VITE_SUPABASE_URL}/functions/v1/imagekit-auth`;
  try {
    const res = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ action: 'delete', fileId }),
    });
    return res.ok;
  } catch (err) {
    console.warn('Failed to delete ImageKit asset via edge function:', err.message);
    return false;
  }
}
