#!/usr/bin/env node

/**
 * Script to manually clear cache for a specific course
 * Usage: node clear-course-cache.js <courseId>
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const courseId = process.argv[2] || 'course_1755714847591_kfc67lwe4';

console.log(`🧹 Clearing cache for course: ${courseId}`);

// Clear database cache
try {
  const dbPath = path.join(__dirname, 'data', 'db.json');
  if (fs.existsSync(dbPath)) {
    const dbData = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    
    // Remove the course from database if it exists
    const originalLength = dbData.courses.length;
    dbData.courses = dbData.courses.filter(course => course.id !== courseId);
    const newLength = dbData.courses.length;
    
    if (originalLength !== newLength) {
      fs.writeFileSync(dbPath, JSON.stringify(dbData, null, 2));
      console.log(`✅ Removed course from database (${originalLength - newLength} courses removed)`);
    } else {
      console.log(`ℹ️  Course not found in database`);
    }
  } else {
    console.log(`ℹ️  Database file not found`);
  }
} catch (error) {
  console.error(`❌ Error clearing database cache:`, error.message);
}

// Clear course file
try {
  const courseFilePath = path.join(__dirname, 'data', 'courses', `${courseId}.json`);
  if (fs.existsSync(courseFilePath)) {
    fs.unlinkSync(courseFilePath);
    console.log(`✅ Deleted course file: ${courseId}.json`);
  } else {
    console.log(`ℹ️  Course file not found: ${courseId}.json`);
  }
} catch (error) {
  console.error(`❌ Error deleting course file:`, error.message);
}

// Clear image cache for this course
try {
  const imageCacheDir = path.join(__dirname, 'data', 'image_cache');
  if (fs.existsSync(imageCacheDir)) {
    const cacheFiles = fs.readdirSync(imageCacheDir);
    const courseCacheFiles = cacheFiles.filter(file => 
      file.includes(courseId) || 
      file.includes('1755714847591') ||
      file.includes('kfc67lwe4')
    );
    
    courseCacheFiles.forEach(file => {
      try {
        fs.unlinkSync(path.join(imageCacheDir, file));
        console.log(`✅ Deleted image cache file: ${file}`);
      } catch (error) {
        console.warn(`⚠️  Failed to delete image cache file ${file}:`, error.message);
      }
    });
    
    if (courseCacheFiles.length === 0) {
      console.log(`ℹ️  No image cache files found for this course`);
    }
  } else {
    console.log(`ℹ️  Image cache directory not found`);
  }
} catch (error) {
  console.error(`❌ Error clearing image cache:`, error.message);
}

console.log(`🎉 Cache clearing completed for course: ${courseId}`);
console.log(`💡 You may need to restart the server and refresh the browser to see changes`);
