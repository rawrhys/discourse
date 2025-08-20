// Script to clear image cache and test the duplicate fix
import fetch from 'node-fetch';

async function clearImageCache() {
  const baseUrl = 'https://thediscourse.ai'; // Use the production domain
  
  console.log('🧹 Clearing Image Cache...\n');
  
  try {
    // Clear the image search cache
    const response = await fetch(`${baseUrl}/api/image/clear-search-cache`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    if (!response.ok) {
      console.error(`HTTP error! status: ${response.status}`);
      return;
    }
    
    const result = await response.json();
    console.log('✅ Cache cleared:', result.message);
    
    // Also clear the regular image cache
    const response2 = await fetch(`${baseUrl}/api/image/clear-cache`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    if (!response2.ok) {
      console.error(`HTTP error! status: ${response2.status}`);
      return;
    }
    
    const result2 = await response2.json();
    console.log('✅ Image cache cleared:', result2.message);
    
    console.log('\n🎯 Cache clearing completed! The image duplicate fix should now work properly.');
    console.log('📝 Next time you search for images, you should see:');
    console.log('   - Fresh searches instead of cached results');
    console.log('   - Different images for different lessons');
    console.log('   - Proper duplicate prevention working');
    
  } catch (error) {
    console.error('❌ Error clearing cache:', error.message);
  }
}

// Run the cache clearing
clearImageCache().catch(console.error);
