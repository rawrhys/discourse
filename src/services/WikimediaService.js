import imageService from './ImageService.js';

function extractSubjectTerms(prompt) {
  // Remove markdown list markers and extra newlines
  let cleanedPrompt = prompt
    .replace(/^[\s\t]*[-*+]\s+/gm, '') // Remove - , * , + at line start
    .replace(/^[\s\t]*\d+\.\s+/gm, '') // Remove numbered lists
    .replace(/\n{2,}/g, '\n')
    .replace(/\s{2,}/g, ' ')
    .trim();

  // Extract bolded terms (e.g., **Roman Kingdom**)
  let boldMatches = Array.from(cleanedPrompt.matchAll(/\*\*([^*]+)\*\*/g)).map(m => m[1].trim()).filter(Boolean);
  // Filter out generic/boilerplate bolded terms and punctuation/stopwords
  const stopwordBold = /^(welcome|introduction|lesson|content|conclusion|today|main|our|this|that|these|those|a|an|the|and|for|with|by|in|on|at|from|is|are|was|were|be|been|will|should|could|would|can|may|might|must|shall|let|lets|we|you|your|they|their|it|its|but|if|or|so|do|does|did|not|no|yes|up|out|about|which|who|whom|what|when|where|why|how|,|\.|-|or|and the|, or|\.\n?the)$/i;
  boldMatches = boldMatches.filter(term => {
    const t = term.trim();
    return t.length > 2 &&
      t.split(' ').length <= 5 && // Not a long phrase
      !stopwordBold.test(t.toLowerCase()) &&
      !t.toLowerCase().startsWith('welcome to our lesson') &&
      /[a-zA-Z]/.test(t); // Must contain at least one letter
  });
  if (boldMatches.length > 0) {
    const uniqueBold = Array.from(new Set(boldMatches)).slice(0, 4);
    console.log('[WikimediaService] Filtered bolded terms:', uniqueBold);
    return uniqueBold;
  }
  // Fallback: extract subject keywords as before
  let cleaned = cleanedPrompt
    .replace(/[*_`~\[\](){}<>#+.!?-]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  const stopwords = /^(welcome|introduction|lesson|content|conclusion|today|begin|main|our|the|to|of|and|for|with|by|in|on|at|from|is|are|was|were|be|been|will|should|could|would|can|may|might|must|shall|let|lets|we|you|your|they|their|this|that|these|those|a|an|as|it|its|but|if|or|so|do|does|did|not|no|yes|up|out|about|which|who|whom|what|when|where|why|how|,|\.|-|or|and the|, or|\.\n?the)$/i;
  const words = cleaned.split(/\s+/).filter(Boolean);
  const subjectWords = Array.from(new Set(words.filter(word => {
    const w = word.trim();
    return w.length > 2 &&
      !stopwords.test(w.toLowerCase()) &&
      /^[A-Za-z][A-Za-z\-]*$/.test(w) &&
      (w[0] === w[0].toUpperCase() || w.length > 4) &&
      /[a-zA-Z]/.test(w); // Must contain at least one letter
  })));
  const cleanSubjects = subjectWords.map(w => w.replace(/[,.;:!?]+$/, ''));
  const uniqueSubjects = cleanSubjects.slice(0, 4);
  console.log('[WikimediaService] Filtered subject terms:', uniqueSubjects);
  return uniqueSubjects;
}

async function fetchWikimediaImageForTerm(term) {
  try {
    // Step 1: Search for the page
    const searchParams = new URLSearchParams({
      action: 'query',
      format: 'json',
      list: 'search',
      srsearch: term,
      origin: '*'
    });
    const searchResp = await fetch(`https://en.wikipedia.org/w/api.php?${searchParams}`);
    const searchData = await searchResp.json();
    if (!searchData.query || !searchData.query.search || searchData.query.search.length === 0) {
      return null;
    }
    const pageTitle = searchData.query.search[0].title;
    // Step 2: Get images for the page (list of files)
    const imageParams = new URLSearchParams({
      action: 'query',
      format: 'json',
      prop: 'images',
      titles: pageTitle,
      origin: '*'
    });
    const imageResp = await fetch(`https://en.wikipedia.org/w/api.php?${imageParams}`);
    const imageData = await imageResp.json();
    const pages = imageData.query && imageData.query.pages ? imageData.query.pages : {};
    const page = Object.values(pages)[0];
    if (!page || !page.images || !Array.isArray(page.images)) {
      return null;
    }
    // Step 3: For all files, fetch their info in one batch
    const fileTitles = page.images
      .map(img => img.title)
      .filter(title => /\.(jpg|jpeg|png)$/i.test(title));
    if (fileTitles.length === 0) return null;
    const fileParams = new URLSearchParams({
      action: 'query',
      format: 'json',
      titles: fileTitles.join('|'),
      prop: 'imageinfo',
      iiprop: 'url|user|extmetadata|size|mime',
      origin: '*'
    });
    const fileResp = await fetch(`https://commons.wikimedia.org/w/api.php?${fileParams}`);
    const fileData = await fileResp.json();
    const filePages = fileData.query && fileData.query.pages ? fileData.query.pages : {};
    // Find the first valid image with a URL
    for (const filePage of Object.values(filePages)) {
      if (filePage && filePage.imageinfo && filePage.imageinfo[0] && filePage.imageinfo[0].url) {
        const info = filePage.imageinfo[0];
        let imageUrl = info.url;
        // If Wikimedia Commons, use thumbnail URL (800px wide)
        if (imageUrl.includes('upload.wikimedia.org/wikipedia/commons/')) {
          const urlParts = imageUrl.split('/');
          const filename = urlParts[urlParts.length - 1];
          const thumbParts = [...urlParts];
          const commonsIdx = thumbParts.findIndex(p => p === 'commons');
          if (commonsIdx !== -1) {
            thumbParts.splice(commonsIdx + 1, 0, 'thumb');
            imageUrl = thumbParts.join('/') + '/800px-' + filename;
          }
        }
        return {
          imageUrl,
          description: (info.extmetadata && info.extmetadata.ImageDescription && info.extmetadata.ImageDescription.value) || filePage.title || '',
          author: (info.extmetadata && info.extmetadata.Artist && info.extmetadata.Artist.value) || info.user || '',
          license: (info.extmetadata && info.extmetadata.LicenseShortName && info.extmetadata.LicenseShortName.value) || '',
          pageTitle,
          width: info.width || 0,
          height: info.height || 0,
          size: info.size || 0,
          mime: info.mime || '',
          pageURL: (info.descriptionurl || ''),
        };
      }
    }
    return null;
  } catch (error) {
    console.error('[WikimediaService] Error fetching Wikimedia image:', error);
    return null;
  }
}

class WikimediaService {
  async searchImage(query, lessonContext = {}) {
    let prompt = query;
    let moduleTitle = '';
    if (lessonContext && typeof lessonContext === 'object') {
      const { title, content } = lessonContext;
      if (title && content) {
        prompt = `${title} ${typeof content === 'string' ? content : Object.values(content).join(' ')}`;
        moduleTitle = title;
      } else if (title) {
        prompt = title;
        moduleTitle = title;
      } else if (content) {
        prompt = typeof content === 'string' ? content : Object.values(content).join(' ');
      }
    }
    const subjectTerms = extractSubjectTerms(prompt);
    console.log('[WikimediaService] Subject terms for search:', subjectTerms);
    if (subjectTerms.length === 0) {
      console.warn('[WikimediaService] No valid subject terms found for image search.');
      return null;
    }
    // If moduleTitle is present and there are bolded terms, combine them for search
    let usedCombinations = false;
    if (moduleTitle && subjectTerms.length > 0) {
      for (let i = 0; i < subjectTerms.length; i++) {
        const combinedTerm = `${moduleTitle} ${subjectTerms[i]}`;
        try {
          console.log('[WikimediaService] Searching Wikimedia with combined term:', combinedTerm);
          const imageData = await fetchWikimediaImageForTerm(combinedTerm);
          console.log('[WikimediaService] Wikimedia image result:', imageData);
          if (imageData && imageData.imageUrl) {
            return imageData;
          }
        } catch (error) {
          console.error('[WikimediaService] Error searching Wikimedia for combined term', combinedTerm, error);
        }
      }
      usedCombinations = true;
    }
    // Fallback: try each term (single or pair) as a search query
    if (!usedCombinations) {
      for (let i = 0; i < subjectTerms.length; i++) {
        let searchTerm = subjectTerms[i];
        if (!searchTerm) continue;
        try {
          console.log('[WikimediaService] Searching Wikimedia with term:', searchTerm);
          const imageData = await fetchWikimediaImageForTerm(searchTerm);
          console.log('[WikimediaService] Wikimedia image result:', imageData);
          if (imageData && imageData.imageUrl) {
            return imageData;
          }
        } catch (error) {
          console.error('[WikimediaService] Error searching Wikimedia for term', searchTerm, error);
        }
        if (i + 1 < subjectTerms.length) {
          const pairTerm = `${subjectTerms[i]} ${subjectTerms[i + 1]}`;
          try {
            console.log('[WikimediaService] Searching Wikimedia with term:', pairTerm);
            const imageData = await fetchWikimediaImageForTerm(pairTerm);
            console.log('[WikimediaService] Wikimedia image result:', imageData);
            if (imageData && imageData.imageUrl) {
              return imageData;
            }
          } catch (error) {
            console.error('[WikimediaService] Error searching Wikimedia for term', pairTerm, error);
          }
        }
      }
    }
    // Fallback: try Pixabay with the same logic
    for (let i = 0; i < subjectTerms.length; i++) {
      let searchTerm = subjectTerms[i];
      if (!searchTerm) continue;
      const pixabayPrompt = searchTerm.slice(0, 100);
      try {
        console.warn('[WikimediaService] No Wikimedia image found, trying Pixabay with term:', pixabayPrompt);
        const pixabayImage = await imageService.searchImage(pixabayPrompt);
        console.log('[WikimediaService] Result from Pixabay:', pixabayImage);
        if (pixabayImage && pixabayImage.imageUrl) {
          return {
            imageUrl: pixabayImage.imageUrl,
            description: `Image from Pixabay for ${pixabayPrompt}`,
            author: 'Pixabay',
            license: 'Free to use'
          };
        }
      } catch (error) {
        console.error('[WikimediaService] Error searching Pixabay for term', pixabayPrompt, error);
      }
      if (i + 1 < subjectTerms.length) {
        const pairTerm = `${subjectTerms[i]} ${subjectTerms[i + 1]}`.slice(0, 100);
        try {
          console.warn('[WikimediaService] No Wikimedia image found, trying Pixabay with term:', pairTerm);
          const pixabayImage = await imageService.searchImage(pairTerm);
          console.log('[WikimediaService] Result from Pixabay:', pixabayImage);
          if (pixabayImage && pixabayImage.imageUrl) {
            return {
              imageUrl: pixabayImage.imageUrl,
              description: `Image from Pixabay for ${pairTerm}`,
              author: 'Pixabay',
              license: 'Free to use'
            };
          }
        } catch (error) {
          console.error('[WikimediaService] Error searching Pixabay for term', pairTerm, error);
        }
      }
    }
    return null;
  }

  formatAttribution(author, license) {
    if (!author && !license) return '';

    // Remove HTML tags and decode HTML entities
    const cleanAuthor = author
      ? author.replace(/<[^>]*>/g, '')  // Remove HTML tags
        .replace(/&nbsp;/g, ' ')        // Replace &nbsp; with space
        .replace(/&amp;/g, '&')         // Replace &amp; with &
        .replace(/&lt;/g, '<')          // Replace &lt; with <
        .replace(/&gt;/g, '>')          // Replace &gt; with >
        .replace(/&quot;/g, '"')        // Replace &quot; with "
        .replace(/&#39;/g, "'")         // Replace &#39; with '
        .trim()
      : '';

    // Format the license text
    const cleanLicense = license
      ? license.replace(/<[^>]*>/g, '').trim()
      : '';

    // Build the attribution string
    let attribution = '';
    if (cleanAuthor) {
      attribution += `By ${cleanAuthor}`;
    }
    if (cleanLicense) {
      if (attribution) attribution += ' / ';
      attribution += cleanLicense;
    }

    return attribution;
  }

  validateImageQuality(imageData) {
    if (!imageData) return false;

    const minWidth = 250;
    const minHeight = 200;
    const maxSize = 20 * 1024 * 1024;

    if (imageData.width < minWidth || imageData.height < minHeight) {
      return false;
    }
    if (imageData.size > maxSize) {
      return false;
    }

    const allowedMimes = ['image/jpeg', 'image/png'];
    if (!allowedMimes.includes(imageData.mime)) {
      return false;
    }

    const excludedPatterns = [
      'logo', 'icon', 'button', 'screenshot', 'instagram', 'facebook',
      'commons:', 'category:', '.svg', '.pdf', '.tiff'
    ];

    const title = (imageData.pageURL || '').toLowerCase().split('/').pop().replace(/_/g, ' ');
    const description = (imageData.description || '').toLowerCase();

    if (excludedPatterns.some(p => title.includes(p) || description.includes(p))) {
      return false;
    }

    return true;
  }
}

export default new WikimediaService();