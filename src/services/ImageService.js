// src/services/ImageService.js

class ImageService {
  constructor() {
    this.baseUrl = 'https://pixabay.com/api/';
    this.apiKey = '50334893-d400c4c9c21f87c28cb7d46c2';
  }

  async searchImage(query) {
    try {
      // Handle non-string queries
      if (!query) {
        console.warn('No query provided');
        return null;
      }

      // Convert query to string if it's not already
      const queryString = typeof query === 'string' ? query : String(query);
      
      // Clean and prepare the query
      const cleanQuery = queryString.trim().toLowerCase();
      if (!cleanQuery) {
        console.warn('Empty search query after cleaning');
        return null;
      }

      // Construct the URL with proper parameters
      const params = new URLSearchParams({
        key: this.apiKey,
        q: cleanQuery,
        image_type: 'photo',
        per_page: '3',
        safesearch: 'true',
        lang: 'en'
      });

      const url = `${this.baseUrl}?${params.toString()}`;
      console.log('Fetching image from:', url);

      const response = await fetch(url);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error Response:', errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.hits && data.hits.length > 0) {
        const image = data.hits[0];
        return {
          imageUrl: image.webformatURL,
          previewUrl: image.previewURL,
          largeImageUrl: image.largeImageURL
        };
      }
      
      console.log('No images found for query:', cleanQuery);
      return null;
    } catch (error) {
      console.error('Error searching for image:', error);
      return null;
    }
  }
}

export default new ImageService(); 