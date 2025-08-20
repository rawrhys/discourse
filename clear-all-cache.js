#!/usr/bin/env node

/**
 * Comprehensive cache clearing script
 * Clears all caches including database, files, and browser storage
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log(`🧹 Starting comprehensive cache clearing...`);

// Clear database cache
try {
  const dbPath = path.join(__dirname, 'data', 'db.json');
  if (fs.existsSync(dbPath)) {
    console.log(`📊 Database file found, checking for stale entries...`);
    const dbData = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    
    // Remove any courses with the problematic ID pattern
    const originalLength = dbData.courses.length;
    dbData.courses = dbData.courses.filter(course => 
      !course.id.includes('1755714847591') && 
      !course.id.includes('kfc67lwe4')
    );
    const newLength = dbData.courses.length;
    
    if (originalLength !== newLength) {
      fs.writeFileSync(dbPath, JSON.stringify(dbData, null, 2));
      console.log(`✅ Removed ${originalLength - newLength} problematic courses from database`);
    } else {
      console.log(`ℹ️  No problematic courses found in database`);
    }
  } else {
    console.log(`ℹ️  Database file not found`);
  }
} catch (error) {
  console.error(`❌ Error clearing database cache:`, error.message);
}

// Clear course files
try {
  const coursesDir = path.join(__dirname, 'data', 'courses');
  if (fs.existsSync(coursesDir)) {
    const courseFiles = fs.readdirSync(coursesDir);
    const problematicFiles = courseFiles.filter(file => 
      file.includes('1755714847591') || 
      file.includes('kfc67lwe4')
    );
    
    problematicFiles.forEach(file => {
      try {
        fs.unlinkSync(path.join(coursesDir, file));
        console.log(`✅ Deleted problematic course file: ${file}`);
      } catch (error) {
        console.warn(`⚠️  Failed to delete course file ${file}:`, error.message);
      }
    });
    
    if (problematicFiles.length === 0) {
      console.log(`ℹ️  No problematic course files found`);
    }
  } else {
    console.log(`ℹ️  Courses directory not found`);
  }
} catch (error) {
  console.error(`❌ Error clearing course files:`, error.message);
}

// Clear image cache
try {
  const imageCacheDir = path.join(__dirname, 'data', 'image_cache');
  if (fs.existsSync(imageCacheDir)) {
    const cacheFiles = fs.readdirSync(imageCacheDir);
    const problematicCacheFiles = cacheFiles.filter(file => 
      file.includes('1755714847591') || 
      file.includes('kfc67lwe4') ||
      file.includes('art history') ||
      file.includes('introduction to art history')
    );
    
    problematicCacheFiles.forEach(file => {
      try {
        fs.unlinkSync(path.join(imageCacheDir, file));
        console.log(`✅ Deleted problematic image cache: ${file}`);
      } catch (error) {
        console.warn(`⚠️  Failed to delete image cache ${file}:`, error.message);
      }
    });
    
    if (problematicCacheFiles.length === 0) {
      console.log(`ℹ️  No problematic image cache files found`);
    }
  } else {
    console.log(`ℹ️  Image cache directory not found`);
  }
} catch (error) {
  console.error(`❌ Error clearing image cache:`, error.message);
}

// Clear AI service cache (if exists)
try {
  const aiCacheDir = path.join(__dirname, 'data', 'ai_cache');
  if (fs.existsSync(aiCacheDir)) {
    const aiCacheFiles = fs.readdirSync(aiCacheDir);
    const problematicAiCacheFiles = aiCacheFiles.filter(file => 
      file.includes('1755714847591') || 
      file.includes('kfc67lwe4') ||
      file.includes('art history') ||
      file.includes('introduction to art history')
    );
    
    problematicAiCacheFiles.forEach(file => {
      try {
        fs.unlinkSync(path.join(aiCacheDir, file));
        console.log(`✅ Deleted problematic AI cache: ${file}`);
      } catch (error) {
        console.warn(`⚠️  Failed to delete AI cache ${file}:`, error.message);
      }
    });
    
    if (problematicAiCacheFiles.length === 0) {
      console.log(`ℹ️  No problematic AI cache files found`);
    }
  } else {
    console.log(`ℹ️  AI cache directory not found`);
  }
} catch (error) {
  console.error(`❌ Error clearing AI cache:`, error.message);
}

console.log(`🎉 Comprehensive cache clearing completed!`);
console.log(`💡 Next steps:`);
console.log(`   1. Restart the server: pm2 restart all`);
console.log(`   2. Clear browser cache: Ctrl+Shift+R (hard refresh)`);
console.log(`   3. Clear browser localStorage: F12 → Application → Storage → Clear storage`);
console.log(`   4. Try accessing the dashboard again`);
