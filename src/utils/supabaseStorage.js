import { supabase } from '../config/supabase';

// Storage bucket names
const STORAGE_BUCKETS = {
  LOGOS: 'logos',
  EMAIL_TEMPLATES: 'email-templates',
  USER_AVATARS: 'user-avatars'
};

class SupabaseStorage {
  constructor() {
    this.supabase = supabase;
  }

  /**
   * Upload logo to Supabase Storage
   * @param {File} file - Logo file to upload
   * @param {string} filename - Name for the file
   * @returns {Promise<{data: any, error: any}>}
   */
  async uploadLogo(file, filename = 'discourse-logo') {
    try {
      // Ensure logos bucket exists
      await this.ensureBucketExists(STORAGE_BUCKETS.LOGOS);
      
      const fileExt = file.name.split('.').pop();
      const finalFilename = `${filename}.${fileExt}`;
      
      const { data, error } = await this.supabase.storage
        .from(STORAGE_BUCKETS.LOGOS)
        .upload(finalFilename, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (error) throw error;

      // Get public URL
      const { data: { publicUrl } } = this.supabase.storage
        .from(STORAGE_BUCKETS.LOGOS)
        .getPublicUrl(finalFilename);

      return { data: { ...data, publicUrl }, error: null };
    } catch (error) {
      console.error('Error uploading logo:', error);
      return { data: null, error };
    }
  }

  /**
   * Get logo URL for email templates
   * @param {string} filename - Logo filename (without extension)
   * @returns {string} Public URL of the logo
   */
  getLogoUrl(filename = 'discourse-logo') {
    try {
      // Try SVG first, then PNG as fallback
      const svgUrl = this.supabase.storage
        .from(STORAGE_BUCKETS.LOGOS)
        .getPublicUrl(`${filename}.svg`);

      const pngUrl = this.supabase.storage
        .from(STORAGE_BUCKETS.LOGOS)
        .getPublicUrl(`${filename}.png`);

      // Return SVG if available, otherwise PNG
      return svgUrl.data.publicUrl || pngUrl.data.publicUrl;
    } catch (error) {
      console.error('Error getting logo URL:', error);
      // Fallback to local assets
      return '/assets/images/discourse-logo.svg';
    }
  }

  /**
   * List all logos in storage
   * @returns {Promise<{data: any, error: any}>}
   */
  async listLogos() {
    try {
      const { data, error } = await this.supabase.storage
        .from(STORAGE_BUCKETS.LOGOS)
        .list('', {
          limit: 100,
          offset: 0
        });

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error listing logos:', error);
      return { data: null, error };
    }
  }

  /**
   * Delete logo from storage
   * @param {string} filename - Logo filename to delete
   * @returns {Promise<{data: any, error: any}>}
   */
  async deleteLogo(filename) {
    try {
      const { data, error } = await this.supabase.storage
        .from(STORAGE_BUCKETS.LOGOS)
        .remove([filename]);

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error deleting logo:', error);
      return { data: null, error };
    }
  }

  /**
   * Ensure storage bucket exists
   * @param {string} bucketName - Name of the bucket
   * @returns {Promise<void>}
   */
  async ensureBucketExists(bucketName) {
    try {
      // Check if bucket exists
      const { data: buckets } = await this.supabase.storage.listBuckets();
      const bucketExists = buckets.some(bucket => bucket.name === bucketName);
      
      if (!bucketExists) {
        console.log(`Creating storage bucket: ${bucketName}`);
        // Note: Bucket creation requires admin privileges
        // This will fail for regular users, but that's expected
        await this.supabase.storage.createBucket(bucketName, {
          public: true,
          allowedMimeTypes: ['image/svg+xml', 'image/png', 'image/jpeg', 'image/webp'],
          fileSizeLimit: 5242880 // 5MB
        });
      }
    } catch (error) {
      // Bucket creation might fail for regular users - that's normal
      console.log(`Bucket ${bucketName} already exists or creation failed (normal for non-admin users)`);
    }
  }

  /**
   * Get storage bucket info
   * @param {string} bucketName - Name of the bucket
   * @returns {Promise<{data: any, error: any}>}
   */
  async getBucketInfo(bucketName) {
    try {
      const { data, error } = await this.supabase.storage.getBucket(bucketName);
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error(`Error getting bucket info for ${bucketName}:`, error);
      return { data: null, error };
    }
  }
}

// Create singleton instance
const supabaseStorage = new SupabaseStorage();

export default supabaseStorage;
export { STORAGE_BUCKETS };
