import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import fs from 'fs';
import path from 'path';

const dbFilePath = path.join(process.cwd(), 'db.json');
const adapter = new JSONFile(dbFilePath);
const defaultData = { users: [], courses: [], images: [], imageCache: [] };
const db = new Low(adapter, defaultData);

async function fixExistingCourses() {
  try {
    await db.read();
    console.log('📊 Checking existing courses...');
    
    let fixedCourses = 0;
    
    for (const course of db.data.courses) {
      let courseModified = false;
      
      console.log(`\n🔍 Checking course: ${course.title} (${course.id})`);
      
      if (course.modules && Array.isArray(course.modules)) {
        course.modules.forEach((module, mIdx) => {
          // Check if module has an ID
          if (!module.id) {
            console.log(`  ❌ Module ${mIdx} missing ID - fixing...`);
            module.id = `module_${mIdx}_${Date.now()}`;
            courseModified = true;
          }
          
          // Check if module has isLocked property
          if (module.isLocked === undefined) {
            console.log(`  ❌ Module ${mIdx} missing isLocked - setting to ${mIdx > 0}`);
            module.isLocked = mIdx > 0;
            courseModified = true;
          }
          
          // Check lessons
          if (module.lessons && Array.isArray(module.lessons)) {
            module.lessons.forEach((lesson, lIdx) => {
              if (!lesson.id) {
                console.log(`    ❌ Lesson ${lIdx} missing ID - fixing...`);
                lesson.id = `lesson_${mIdx}_${lIdx}_${Date.now()}`;
                courseModified = true;
              }
            });
          }
          
          console.log(`  ✅ Module ${mIdx}: id=${module.id}, isLocked=${module.isLocked}, lessons=${module.lessons?.length || 0}`);
        });
      }
      
      if (courseModified) {
        fixedCourses++;
        console.log(`  🔧 Course ${course.title} has been fixed`);
      }
    }
    
    if (fixedCourses > 0) {
      await db.write();
      console.log(`\n✅ Fixed ${fixedCourses} courses!`);
    } else {
      console.log('\n✅ All courses already have proper IDs and isLocked properties!');
    }
    
    // Show summary of all courses
    console.log('\n📋 Course Summary:');
    db.data.courses.forEach((course, idx) => {
      console.log(`${idx + 1}. ${course.title} (${course.id})`);
      if (course.modules) {
        course.modules.forEach((module, mIdx) => {
          console.log(`   Module ${mIdx}: ${module.title} (${module.id}) - Locked: ${module.isLocked}`);
        });
      }
    });
    
  } catch (error) {
    console.error('❌ Error fixing courses:', error);
  }
}

fixExistingCourses();
