import fs from 'fs';
import path from 'path';

const coursesDir = path.join(process.cwd(), 'data', 'courses');

async function fixCourseFiles() {
  try {
    console.log('📊 Checking course files in:', coursesDir);
    
    if (!fs.existsSync(coursesDir)) {
      console.log('❌ Courses directory not found');
      return;
    }

    const courseFiles = fs.readdirSync(coursesDir).filter(file => 
      file.endsWith('.json') && file !== 'undefined.json'
    );
    
    console.log(`📁 Found ${courseFiles.length} course files`);
    
    let fixedFiles = 0;
    
    for (const file of courseFiles) {
      const filePath = path.join(coursesDir, file);
      console.log(`\n🔍 Processing: ${file}`);
      
      try {
        const courseData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        let courseModified = false;
        
        if (courseData.modules && Array.isArray(courseData.modules)) {
          courseData.modules.forEach((module, mIdx) => {
            // Check if module has isLocked property
            if (module.isLocked === undefined) {
              console.log(`  ❌ Module ${mIdx} (${module.title}) missing isLocked - setting to ${mIdx > 0}`);
              module.isLocked = mIdx > 0; // First module unlocked, others locked
              courseModified = true;
            } else {
              console.log(`  ✅ Module ${mIdx} (${module.title}) has isLocked: ${module.isLocked}`);
            }
          });
        }
        
        if (courseModified) {
          // Write the updated course data back to file
          fs.writeFileSync(filePath, JSON.stringify(courseData, null, 2));
          fixedFiles++;
          console.log(`  🔧 Fixed course: ${courseData.title}`);
        } else {
          console.log(`  ✅ Course already has proper isLocked properties: ${courseData.title}`);
        }
        
      } catch (error) {
        console.error(`  ❌ Error processing ${file}:`, error.message);
      }
    }
    
    console.log(`\n🎉 Summary:`);
    console.log(`  - Processed: ${courseFiles.length} files`);
    console.log(`  - Fixed: ${fixedFiles} files`);
    console.log(`  - Already correct: ${courseFiles.length - fixedFiles} files`);
    
  } catch (error) {
    console.error('❌ Error fixing course files:', error);
  }
}

fixCourseFiles();
