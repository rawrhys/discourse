// Image compression utility for reducing file sizes and improving load times
// Note: Use dynamic import for 'sharp' to avoid hard failures in environments
// where the native module is unavailable. This allows the module to load and
// the app to continue operating with a graceful fallback.

// Default compression settings - More aggressive for better performance
const DEFAULT_OPTIONS = {
  quality: 65, // Reduced from 80 to 65 for better compression
  maxWidth: 800, // Reduced from 1200 to 800 for smaller files
  maxHeight: 600, // Reduced from 800 to 600 for smaller files
  format: 'jpeg', // Output format: 'jpeg', 'webp', 'png'
  progressive: true, // Progressive JPEG for better perceived performance
  optimizeCoding: true, // Optimize Huffman coding
  mozjpeg: true, // Use mozjpeg for better compression
};

/**
 * Compress and optimize an image buffer
 * @param {Buffer} imageBuffer - The original image buffer
 * @param {Object} options - Compression options
 * @returns {Promise<Buffer>} - Compressed image buffer
 */
export async function compressImage(imageBuffer, options = {}) {
  try {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    
    // Dynamically import sharp to avoid ESM resolution failures when not installed
    let sharp;
    try {
      const sharpModule = await import('sharp');
      sharp = sharpModule.default || sharpModule;
    } catch (importError) {
      console.warn('[ImageCompression] "sharp" not available, returning original buffer. Error:', importError?.message || importError);
      return imageBuffer;
    }
    
    // Create sharp instance
    let sharpInstance = sharp(imageBuffer);
    
    // Get image metadata
    const metadata = await sharpInstance.metadata();
    
    // Calculate new dimensions while maintaining aspect ratio
    const { width, height } = calculateDimensions(
      metadata.width, 
      metadata.height, 
      opts.maxWidth, 
      opts.maxHeight
    );
    
    // Resize if needed
    if (width !== metadata.width || height !== metadata.height) {
      sharpInstance = sharpInstance.resize(width, height, {
        fit: 'inside',
        withoutEnlargement: true,
        kernel: sharp.kernel.lanczos3, // High quality resizing
      });
    }
    
    // Apply format-specific optimizations
    switch (opts.format.toLowerCase()) {
      case 'webp':
        return await sharpInstance
          .webp({ 
            quality: opts.quality,
            effort: 4, // Reduced from 6 to 4 for faster processing while maintaining good compression
            nearLossless: false,
          })
          .toBuffer();
        
      case 'png':
        return await sharpInstance
          .png({ 
            compressionLevel: 9, // Maximum compression
            progressive: false,
          })
          .toBuffer();
        
      case 'jpeg':
      default:
        return await sharpInstance
          .jpeg({ 
            quality: opts.quality,
            progressive: opts.progressive,
            optimizeCoding: opts.optimizeCoding,
            mozjpeg: opts.mozjpeg,
            chromaSubsampling: '4:2:0', // Changed from 4:4:4 to 4:2:0 for better compression
            force: true, // Force JPEG output even for PNG input
          })
          .toBuffer();
    }
  } catch (error) {
    console.error('[ImageCompression] Error compressing image:', error);
    // Return original buffer if compression fails
    return imageBuffer;
  }
}

/**
 * Calculate optimal dimensions while maintaining aspect ratio
 * @param {number} originalWidth - Original image width
 * @param {number} originalHeight - Original image height
 * @param {number} maxWidth - Maximum allowed width
 * @param {number} maxHeight - Maximum allowed height
 * @returns {Object} - New width and height
 */
function calculateDimensions(originalWidth, originalHeight, maxWidth, maxHeight) {
  if (!originalWidth || !originalHeight) {
    return { width: maxWidth, height: maxHeight };
  }
  
  const aspectRatio = originalWidth / originalHeight;
  
  let width = originalWidth;
  let height = originalHeight;
  
  // Scale down if image is too large
  if (width > maxWidth) {
    width = maxWidth;
    height = Math.round(width / aspectRatio);
  }
  
  if (height > maxHeight) {
    height = maxHeight;
    width = Math.round(height * aspectRatio);
  }
  
  return { width, height };
}

/**
 * Get optimal format based on image type and browser support
 * @param {string} originalFormat - Original image format
 * @param {boolean} preferWebP - Whether to prefer WebP format
 * @returns {string} - Optimal output format
 */
export function getOptimalFormat(originalFormat, preferWebP = true) {
  const format = originalFormat?.toLowerCase();
  
  // Always prefer WebP for better compression if supported (except for GIFs)
  if (preferWebP && format !== 'gif') {
    return 'webp';
  }
  
  // Convert PNG to JPEG if it's not transparent (better compression)
  if (format === 'png') {
    return 'jpeg';
  }
  
  // Convert GIF to JPEG for better compression (loses animation but much smaller)
  if (format === 'gif') {
    return 'jpeg';
  }
  
  // Keep original format for other cases, but default to JPEG
  return format || 'jpeg';
}

/**
 * Get file extension for a given format
 * @param {string} format - Image format
 * @returns {string} - File extension
 */
export function getFileExtension(format) {
  const formatMap = {
    'jpeg': 'jpg',
    'jpg': 'jpg',
    'webp': 'webp',
    'png': 'png',
    'gif': 'gif',
  };
  
  return formatMap[format?.toLowerCase()] || 'jpg';
}

/**
 * Estimate compression ratio based on original and compressed sizes
 * @param {number} originalSize - Original file size in bytes
 * @param {number} compressedSize - Compressed file size in bytes
 * @returns {number} - Compression ratio (0-1, where 1 = no compression)
 */
export function getCompressionRatio(originalSize, compressedSize) {
  if (!originalSize || !compressedSize) return 1;
  return compressedSize / originalSize;
}

/**
 * Format file size for human reading
 * @param {number} bytes - File size in bytes
 * @returns {string} - Formatted file size
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
} 