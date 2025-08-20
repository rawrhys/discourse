#!/bin/bash

# Script to clear image cache using curl
BASE_URL="https://thediscourse.ai"

echo "🧹 Clearing Image Cache..."

# Clear the image search cache
echo "Clearing image search cache..."
RESPONSE=$(curl -s -X POST "${BASE_URL}/api/image/clear-search-cache" \
  -H "Content-Type: application/json")

if [ $? -eq 0 ]; then
    echo "✅ Image search cache cleared: $RESPONSE"
else
    echo "❌ Failed to clear image search cache"
fi

# Clear the regular image cache
echo "Clearing regular image cache..."
RESPONSE2=$(curl -s -X POST "${BASE_URL}/api/image/clear-cache" \
  -H "Content-Type: application/json")

if [ $? -eq 0 ]; then
    echo "✅ Regular image cache cleared: $RESPONSE2"
else
    echo "❌ Failed to clear regular image cache"
fi

echo ""
echo "🎯 Cache clearing completed! The image duplicate fix should now work properly."
echo "📝 Next time you search for images, you should see:"
echo "   - Fresh searches instead of cached results"
echo "   - Different images for different lessons"
echo "   - Proper duplicate prevention working"
