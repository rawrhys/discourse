// Test script to verify image duplicate fix
import fetch from 'node-fetch';

const baseUrl = 'https://thediscourse.ai'; // Use the production domain

async function testImageDuplicateFix() {
  console.log('🧪 Testing Image Duplicate Fix...\n');
  
  // Test 0: Check if API is accessible
  console.log('Test 0: Checking API accessibility...');
  try {
    const healthCheck = await fetch(`${baseUrl}/api/health`);
    console.log(`Health check status: ${healthCheck.status}`);
    if (healthCheck.ok) {
      const healthData = await healthCheck.json();
      console.log('Health check response:', healthData);
    }
  } catch (error) {
    console.log('Health check failed:', error.message);
  }
  console.log('');
  
  // Test 1: Search for the same lesson title with no used images
  console.log('Test 1: Searching for "The Ptolemaic Dynasty and Hellenistic Egypt" with no used images');
  const result1 = await searchImage('The Ptolemaic Dynasty and Hellenistic Egypt', [], []);
  console.log(`Result 1: ${result1?.title || 'No image found'}\n`);
  
  // Test 2: Search for the same lesson title with the first image as used
  console.log('Test 2: Searching for "The Ptolemaic Dynasty and Hellenistic Egypt" with first image as used');
  const usedUrls1 = result1?.url ? [result1.url] : [];
  const result2 = await searchImage('The Ptolemaic Dynasty and Hellenistic Egypt', [], usedUrls1);
  console.log(`Result 2: ${result2?.title || 'No image found'}`);
  console.log(`Different from Result 1: ${result1?.title !== result2?.title}\n`);
  
  // Test 3: Search for a different lesson title
  console.log('Test 3: Searching for "The Legacy of Ancient Egypt" with no used images');
  const result3 = await searchImage('The Legacy of Ancient Egypt', [], []);
  console.log(`Result 3: ${result3?.title || 'No image found'}\n`);
  
  // Test 4: Search for the same lesson title with both previous images as used
  console.log('Test 4: Searching for "The Ptolemaic Dynasty and Hellenistic Egypt" with both previous images as used');
  const usedUrls2 = [];
  if (result1?.url) usedUrls2.push(result1.url);
  if (result2?.url) usedUrls2.push(result2.url);
  const result4 = await searchImage('The Ptolemaic Dynasty and Hellenistic Egypt', [], usedUrls2);
  console.log(`Result 4: ${result4?.title || 'No image found'}`);
  console.log(`Different from all previous: ${![result1?.title, result2?.title].includes(result4?.title)}\n`);
  
  console.log('✅ Test completed!');
}

async function searchImage(lessonTitle, usedTitles, usedUrls) {
  try {
    console.log(`🔍 Searching for: "${lessonTitle}" with ${usedUrls.length} used URLs`);
    
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
    
    console.log(`📡 Response status: ${response.status}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`HTTP error! status: ${response.status}, body: ${errorText}`);
      return null;
    }
    
    const data = await response.json();
    console.log(`📦 Response data:`, JSON.stringify(data, null, 2));
    return data;
  } catch (error) {
    console.error('Error searching for image:', error.message);
    return null;
  }
}

// Run the test
testImageDuplicateFix().catch(console.error);

