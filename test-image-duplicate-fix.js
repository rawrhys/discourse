// Test script to verify image duplicate fix
const fetch = require('node-fetch');

async function testImageDuplicateFix() {
  const baseUrl = 'http://localhost:3000'; // Adjust if your server runs on a different port
  
  console.log('🧪 Testing Image Duplicate Fix...\n');
  
  // Test 1: Search for the same lesson title with no used images
  console.log('Test 1: Searching for "The Ptolemaic Dynasty and Hellenistic Egypt" with no used images');
  const result1 = await searchImage('The Ptolemaic Dynasty and Hellenistic Egypt', [], []);
  console.log(`Result 1: ${result1?.imageTitle || 'No image found'}\n`);
  
  // Test 2: Search for the same lesson title with the first image as used
  console.log('Test 2: Searching for "The Ptolemaic Dynasty and Hellenistic Egypt" with first image as used');
  const usedUrls1 = result1?.imageUrl ? [result1.imageUrl] : [];
  const result2 = await searchImage('The Ptolemaic Dynasty and Hellenistic Egypt', [], usedUrls1);
  console.log(`Result 2: ${result2?.imageTitle || 'No image found'}`);
  console.log(`Different from Result 1: ${result1?.imageTitle !== result2?.imageTitle}\n`);
  
  // Test 3: Search for a different lesson title
  console.log('Test 3: Searching for "The Legacy of Ancient Egypt" with no used images');
  const result3 = await searchImage('The Legacy of Ancient Egypt', [], []);
  console.log(`Result 3: ${result3?.imageTitle || 'No image found'}\n`);
  
  // Test 4: Search for the same lesson title with both previous images as used
  console.log('Test 4: Searching for "The Ptolemaic Dynasty and Hellenistic Egypt" with both previous images as used');
  const usedUrls2 = [];
  if (result1?.imageUrl) usedUrls2.push(result1.imageUrl);
  if (result2?.imageUrl) usedUrls2.push(result2.imageUrl);
  const result4 = await searchImage('The Ptolemaic Dynasty and Hellenistic Egypt', [], usedUrls2);
  console.log(`Result 4: ${result4?.imageTitle || 'No image found'}`);
  console.log(`Different from all previous: ${![result1?.imageTitle, result2?.imageTitle].includes(result4?.imageTitle)}\n`);
  
  console.log('✅ Test completed!');
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
        courseId: 'test_course',
        lessonId: 'test_lesson',
        disableModeration: true
      })
    });
    
    if (!response.ok) {
      console.error(`HTTP error! status: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error searching for image:', error.message);
    return null;
  }
}

// Run the test
testImageDuplicateFix().catch(console.error);

