import fetch from 'node-fetch';

const imageProxyHandler = async (req, res) => {
  try {
    const url = req.query.url;
    if (!url) {
      return res.status(400).send({ error: 'Missing URL parameter' });
    }

    // Basic validation to prevent abuse
    const allowedDomains = ['upload.wikimedia.org', 'pixabay.com'];
    const hostname = new URL(url).hostname;
    if (!allowedDomains.some(d => hostname.endsWith(d))) {
      console.warn(`[ImageProxy] Forbidden domain attempted: ${hostname}`);
      return res.status(403).send({ error: 'Forbidden domain' });
    }

    const response = await fetch(url, {
      headers: { 'User-Agent': 'Discourse-Image-Proxy/1.0' }
    });

    if (!response.ok) {
      console.error(`[ImageProxy] Upstream error for ${url}: ${response.status} ${response.statusText}`);
      return res.status(response.status).send({ error: `Failed to fetch image: ${response.statusText}` });
    }

    const imageBuffer = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    
    res.set('Content-Type', contentType);
    res.set('Cache-Control', 'public, max-age=31536000, immutable'); // Cache aggressively
    res.send(imageBuffer);

  } catch (error) {
    console.error(`[ImageProxy] Error fetching proxied image for url "${req.query.url}":`, error.message);
    res.status(500).send({ error: 'Error fetching image' });
  }
};

export default imageProxyHandler; 