import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import fetch from 'node-fetch';

const imageCacheDir = path.resolve(process.cwd(), 'data', 'image_cache');
if (!fs.existsSync(imageCacheDir)) fs.mkdirSync(imageCacheDir, { recursive: true });

const imageMetaCache = new Map(); // url → { filepath, lastAccess, size }

function urlToCacheKey(url) {
  return crypto.createHash('sha1').update(url).digest('hex');
}

function getFileExtension(url, defaultExt = 'jpg') {
  const m = url.match(/\.(jpg|jpeg|png|webp)$/i);
  return m ? m[1].toLowerCase() : defaultExt;
}

function getCachedImagePath(url) {
  const key = urlToCacheKey(url);
  const ext = getFileExtension(url);
  return path.join(imageCacheDir, `${key}.${ext}`);
}

export async function getOrFetchImage(url) {
  const cachePath = getCachedImagePath(url);
  const cacheKey = urlToCacheKey(url);

  // Memory cache check
  if (imageMetaCache.has(url) && fs.existsSync(cachePath)) {
    imageMetaCache.get(url).lastAccess = Date.now();
    return { localPath: cachePath, wasCached: true };
  }

  // Disk cache check
  if (fs.existsSync(cachePath)) {
    imageMetaCache.set(url, { filepath: cachePath, lastAccess: Date.now() });
    return { localPath: cachePath, wasCached: true };
  }

  // Fetch from upstream
  const res = await fetch(url, { headers: { 'User-Agent': 'Fast-Image-Proxy/2.0' }, timeout: 4000 });
  if (!res.ok) throw new Error('Failed to fetch image');
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(cachePath, buf);
  imageMetaCache.set(url, { filepath: cachePath, lastAccess: Date.now(), size: buf.length });
  return { localPath: cachePath, wasCached: false };
}

// Helper for returning the local URL
export function getCachedImageUrl(url) {
  const key = urlToCacheKey(url);
  const ext = getFileExtension(url);
  return `/cached-images/${key}.${ext}`;
}

// Additional utility functions for cache management
export function getCacheStats() {
  const now = Date.now();
  let totalSize = 0;
  let fileCount = 0;
  let memoryEntries = 0;

  // Count disk files
  try {
    const files = fs.readdirSync(imageCacheDir);
    fileCount = files.length;
    
    for (const file of files) {
      const filePath = path.join(imageCacheDir, file);
      const stats = fs.statSync(filePath);
      totalSize += stats.size;
    }
  } catch (error) {
    console.warn('[DiskImageCache] Error reading cache directory:', error);
  }

  // Count memory entries
  memoryEntries = imageMetaCache.size;

  return {
    diskFiles: fileCount,
    memoryEntries,
    totalSizeBytes: totalSize,
    totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
    cacheDir: imageCacheDir
  };
}

export function clearCache() {
  try {
    // Clear memory cache
    imageMetaCache.clear();
    
    // Clear disk cache
    const files = fs.readdirSync(imageCacheDir);
    for (const file of files) {
      const filePath = path.join(imageCacheDir, file);
      fs.unlinkSync(filePath);
    }
    
    console.log('[DiskImageCache] Cache cleared successfully');
    return { success: true, message: 'Cache cleared' };
  } catch (error) {
    console.error('[DiskImageCache] Error clearing cache:', error);
    return { success: false, error: error.message };
  }
}

export function cleanupOldCache(maxAge = 24 * 60 * 60 * 1000) { // 24 hours default
  const now = Date.now();
  let cleanedFiles = 0;
  let cleanedSize = 0;

  try {
    const files = fs.readdirSync(imageCacheDir);
    
    for (const file of files) {
      const filePath = path.join(imageCacheDir, file);
      const stats = fs.statSync(filePath);
      
      if (now - stats.mtime.getTime() > maxAge) {
        cleanedSize += stats.size;
        fs.unlinkSync(filePath);
        cleanedFiles++;
      }
    }
    
    console.log(`[DiskImageCache] Cleaned ${cleanedFiles} old files (${(cleanedSize / (1024 * 1024)).toFixed(2)}MB)`);
    return { cleanedFiles, cleanedSizeMB: (cleanedSize / (1024 * 1024)).toFixed(2) };
  } catch (error) {
    console.error('[DiskImageCache] Error cleaning cache:', error);
    return { error: error.message };
  }
}

// Export the cache directory for static serving
export { imageCacheDir };
