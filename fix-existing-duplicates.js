// Script to fix existing duplicate images in the course
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the course file
const courseFilePath = path.join(__dirname, 'data', 'courses', 'ancient-egypt-early-dynastic.json');

async function fixExistingDuplicates() {
  console.log('🔧 Fixing existing duplicate images in course...\n');
  
  try {
    // Read the course file directly
    if (!fs.existsSync(courseFilePath)) {
      console.error('Course file not found at:', courseFilePath);
      console.error('Make sure you are running this script from the project root directory');
      return;
    }
    
    const course = JSON.parse(fs.readFileSync(courseFilePath, 'utf8'));
    
    if (!course) {
      console.error('No course data found in file');
      return;
    }
    
    console.log(`Found course: ${course.title}`);
    console.log(`Course ID: ${course.id}`);
    
    // Analyze existing images to find duplicates
    const imageMap = new Map(); // url -> [lessonInfo]
    const duplicates = [];
    
    for (const module of course.modules || []) {
      for (const lesson of module.lessons || []) {
        const imageUrl = lesson?.image?.imageUrl || lesson?.image?.url;
        const imageTitle = lesson?.image?.imageTitle || lesson?.image?.title;
        
        if (imageUrl) {
          if (imageMap.has(imageUrl)) {
            imageMap.get(imageUrl).push({
              moduleTitle: module.title,
              lessonTitle: lesson.title,
              lessonId: lesson.id,
              imageTitle: imageTitle
            });
          } else {
            imageMap.set(imageUrl, [{
              moduleTitle: module.title,
              lessonTitle: lesson.title,
              lessonId: lesson.id,
              imageTitle: imageTitle
            }]);
          }
        }
      }
    }
    
    // Find duplicates
    for (const [url, lessons] of imageMap.entries()) {
      if (lessons.length > 1) {
        duplicates.push({ url, lessons });
        console.log(`\n🔍 Found duplicate image: ${lessons[0].imageTitle}`);
        console.log(`   URL: ${url.substring(0, 100)}...`);
        console.log(`   Used in ${lessons.length} lessons:`);
        lessons.forEach(lesson => {
          console.log(`   - ${lesson.moduleTitle} > ${lesson.lessonTitle}`);
        });
      }
    }
    
    if (duplicates.length === 0) {
      console.log('✅ No duplicate images found!');
      return;
    }
    
    console.log(`\n📊 Found ${duplicates.length} duplicate images to fix`);
    
    // For now, just report the duplicates without fixing them
    // since we need the server running to search for new images
    console.log('\n📝 Duplicate images found. To fix them:');
    console.log('1. Make sure the server is running');
    console.log('2. Run this script with the server running to search for replacement images');
    console.log('3. Or manually replace the duplicate images in the course data');
    
    // Save a report of duplicates
    const reportPath = path.join(__dirname, 'duplicate-images-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(duplicates, null, 2));
    console.log(`\n📄 Duplicate report saved to: ${reportPath}`);
    
  } catch (error) {
    console.error('Error fixing duplicates:', error.message);
  }
}

// Run the fix
fixExistingDuplicates().catch(console.error);
