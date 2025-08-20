// Script to fix existing duplicate images in the course
import fetch from 'node-fetch';

const baseUrl = 'https://thediscourse.ai';

async function fixExistingDuplicates() {
  console.log('🔧 Fixing existing duplicate images in course...\n');
  
  try {
    // First, let's get the course data to see what duplicates exist
    const courseResponse = await fetch(`${baseUrl}/api/courses`);
    if (!courseResponse.ok) {
      console.error('Failed to fetch courses');
      return;
    }
    
    const courses = await courseResponse.json();
    const ancientEgyptCourse = courses.find(c => c.title?.includes('Ancient Egypt'));
    
    if (!ancientEgyptCourse) {
      console.error('Ancient Egypt course not found');
      return;
    }
    
    console.log(`Found course: ${ancientEgyptCourse.title}`);
    console.log(`Course ID: ${ancientEgyptCourse.id}`);
    
    // Analyze existing images to find duplicates
    const imageMap = new Map(); // url -> [lessonInfo]
    const duplicates = [];
    
    for (const module of ancientEgyptCourse.modules || []) {
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
    
    // Fix duplicates by replacing them with new images
    for (const duplicate of duplicates) {
      console.log(`\n🔄 Fixing duplicate: ${duplicate.lessons[0].imageTitle}`);
      
      // Keep the first lesson's image, replace the rest
      for (let i = 1; i < duplicate.lessons.length; i++) {
        const lesson = duplicate.lessons[i];
        console.log(`   Replacing image for: ${lesson.lessonTitle}`);
        
        // Get used images excluding the current duplicate
        const usedUrls = [];
        for (const [url, lessons] of imageMap.entries()) {
          if (url !== duplicate.url) {
            usedUrls.push(url);
          }
        }
        
        // Search for a new image
        const newImage = await searchImage(lesson.lessonTitle, [], usedUrls);
        
        if (newImage) {
          console.log(`   ✅ Found new image: ${newImage.title}`);
          
          // Update the lesson with the new image
          const updateResponse = await fetch(`${baseUrl}/api/courses/${ancientEgyptCourse.id}/lessons/${lesson.lessonId}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              image: {
                imageTitle: newImage.title,
                imageUrl: newImage.url,
                pageURL: newImage.pageURL,
                attribution: newImage.attribution,
                uploader: newImage.uploader,
                sourceUrlForCaching: newImage.sourceUrlForCaching
              }
            })
          });
          
          if (updateResponse.ok) {
            console.log(`   ✅ Updated lesson with new image`);
          } else {
            console.log(`   ❌ Failed to update lesson`);
          }
        } else {
          console.log(`   ❌ No new image found for ${lesson.lessonTitle}`);
        }
      }
    }
    
    console.log('\n✅ Duplicate image fix completed!');
    
  } catch (error) {
    console.error('Error fixing duplicates:', error.message);
  }
}

async function searchImage(lessonTitle, usedTitles, usedUrls) {
  try {
    const response = await fetch(`${baseUrl}/api/image-search/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        lessonTitle,
        content: '',
        usedImageTitles: usedTitles,
        usedImageUrls: usedUrls,
        courseId: 'course_1755370287932_7nqb8v9fn', // Use the actual course ID
        lessonId: 'test_lesson',
        disableModeration: true
      })
    });
    
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error searching for image:', error.message);
    return null;
  }
}

// Run the fix
fixExistingDuplicates().catch(console.error);
