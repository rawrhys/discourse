// server.js - CORRECTED
import express from 'express';
import cors from 'cors';
import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import https from 'https';
import compression from 'compression';
import net from 'net';
import { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import AIService from './src/services/AIService.js';
import Stripe from 'stripe';

// --- SETUP AND CONFIGURATION ---

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = process.env.PORT || 4002;

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '.env') });

// Verify API key
if (!process.env.MISTRAL_API_KEY) {
    console.error('[SERVER_ERROR] MISTRAL_API_KEY is not set. Please check your .env file.');
}
if (!process.env.JWT_SECRET) {
    console.warn('[SERVER_WARNING] JWT_SECRET is not set. Using a default, insecure key. Please set it in your .env file for production.');
}

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// --- DATABASE INITIALIZATION ---
// This is an async block that will be awaited at the top level
let db;
try {
    db = new Low(new JSONFile(path.join(__dirname, 'db.json')), { users: [], courses: [] });
    await db.read();
    // db.data is automatically initialized with default data if the file doesn't exist
    // The following lines are good for ensuring structure if file *does* exist but is malformed
    db.data = db.data || { users: [], courses: [] };
    db.data.users = db.data.users || [];
    db.data.courses = db.data.courses || [];
    await db.write();
    console.log('[DB] Database initialized successfully.');
} catch (error) {
    console.error('[DB_ERROR] Could not initialize database.', error);
    process.exit(1);
}

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;

// Helper to get user by id
function getUserById(userId) {
  return db.data.users.find(u => u.id === userId);
}

// --- MIDDLEWARE ---

app.use(cors());
app.use(express.json());

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Authentication required' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = user;
    next();
  });
};

// --- API ROUTES ---

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password || !name) return res.status(400).json({ error: 'All fields are required' });

    const existingUser = db.data.users.find((u) => u.email === email);
    if (existingUser) return res.status(400).json({ error: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = {
      id: Date.now().toString(),
      email,
      password: hashedPassword,
      name,
      createdAt: new Date().toISOString(),
      courseCredits: 1 // New users get 1 free course generation
    };
    db.data.users.push(user);
    await db.write();

    const token = jwt.sign({ id: user.id, email }, JWT_SECRET, { expiresIn: '24h' });
    res.status(201).json({ id: user.id, email, name, token });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

    const user = db.data.users.find((u) => u.email === email);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ id: user.id, email: user.email, name: user.name, token });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
  const user = getUserById(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  // Only return safe fields
  const { id, email, name, courseCredits } = user;
  res.json({ id, email, name, courseCredits });
});

app.get('/api/courses/id/:courseId', authenticateToken, (req, res) => {
  try {
    const { courseId } = req.params;
    const course = db.data.courses.find(c => c.id === courseId);
    if (course) {
      if (course.userId !== req.user.id) {
          return res.status(403).json({ error: 'Unauthorized' });
      }
      res.json(course);
    } else {
      res.status(404).json({ error: 'Course not found' });
    }
  } catch (error) {
    console.error(`[API] Error fetching course by id ${req.params.courseId}:`, error);
    res.status(500).json({ error: 'Failed to fetch course' });
  }
});

app.get('/api/courses/saved', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    const userCourses = db.data.courses.filter(c => c.userId === userId);
    res.json(userCourses);
  } catch (error) {
    console.error(`[API] Error fetching saved courses for user ${req.user.id}:`, error);
    res.status(500).json({ error: 'Failed to fetch saved courses' });
  }
});

app.post('/api/courses/generate', authenticateToken, async (req, res) => {
  const MAX_RETRIES = 2;
  let attempt = 0;

  // NSFW/banned words filter
  const bannedWords = [
    'nude', 'nudity', 'porn', 'pornography', 'sex', 'sexual', 'erotic', 'xxx', 'nsfw', 'fuck', 'shit', 'bitch', 'asshole', 'dick', 'pussy', 'cock', 'cum', 'boob', 'boobs', 'breast', 'vagina', 'penis', 'masturbate', 'masturbation', 'orgasm', 'anal', 'blowjob', 'handjob', 'fisting', 'suck', 'sucking', 'slut', 'whore', 'cunt', 'fag', 'faggot', 'rape', 'molest', 'incest', 'bestiality', 'beastiality', 'beastial', 'beastiality', 'zoophilia', 'pedophile', 'pedophilia', 'child porn', 'child pornography', 'child abuse', 'molestation', 'explicit', 'obscene', 'prostitute', 'prostitution', 'stripper', 'strip club', 'escort', 'fetish', 'bdsm', 'bondage', 'dominatrix', 'orgy', 'gangbang', 'cumshot', 'creampie', 'milf', 'hentai', 'yaoi', 'yuri', 'loli', 'shota', 'gore', 'snuff', 'torture', 'rape', 'abuse', 'violence', 'kill', 'murder', 'suicide', 'self-harm', 'cutting', 'drugs', 'drug', 'overdose', 'addict', 'addiction', 'alcohol', 'alcoholic', 'weed', 'marijuana', 'cocaine', 'heroin', 'meth', 'lsd', 'ecstasy', 'shrooms', 'psychedelic', 'crack', 'opium', 'opiate', 'opioid', 'taboo', 'curse', 'swear', 'profanity', 'offensive', 'racist', 'sexist', 'homophobic', 'transphobic', 'bigot', 'bigotry', 'hate', 'hateful', 'discriminate', 'discrimination', 'terrorist', 'terrorism', 'bomb', 'explosive', 'gun', 'shoot', 'shooting', 'massacre', 'mass shooting', 'school shooting', 'assassinate', 'assassination', 'genocide', 'holocaust', 'nazi', 'hitler', 'kkk', 'klan', 'lynch', 'lynching', 'slavery', 'slave', 'torture', 'execution', 'beheading', 'decapitate', 'decapitation', 'castrate', 'castration', 'mutilate', 'mutilation', 'dismember', 'dismemberment', 'necrophilia', 'cannibal', 'cannibalism', 'zoosadism', 'animal abuse', 'animal cruelty', 'animal torture', 'animal killing', 'animal death', 'animal violence', 'animal porn', 'animal sex', 'animal rape', 'animal molestation', 'animal bestiality', 'animal beastiality', 'animal beastial', 'animal beastiality', 'animal zoophilia', 'animal pedophile', 'animal pedophilia', 'animal child porn', 'animal child pornography', 'animal child abuse', 'animal molestation', 'animal explicit', 'animal obscene', 'animal prostitute', 'animal prostitution', 'animal stripper', 'animal strip club', 'animal escort', 'animal fetish', 'animal bdsm', 'animal bondage', 'animal dominatrix', 'animal orgy', 'animal gangbang', 'animal cumshot', 'animal creampie', 'animal milf', 'animal hentai', 'animal yaoi', 'animal yuri', 'animal loli', 'animal shota', 'animal gore', 'animal snuff', 'animal torture', 'animal rape', 'animal abuse', 'animal violence', 'animal kill', 'animal murder', 'animal suicide', 'animal self-harm', 'animal cutting', 'animal drugs', 'animal drug', 'animal overdose', 'animal addict', 'animal addiction', 'animal alcohol', 'animal alcoholic', 'animal weed', 'animal marijuana', 'animal cocaine', 'animal heroin', 'animal meth', 'animal lsd', 'animal ecstasy', 'animal shrooms', 'animal psychedelic', 'animal crack', 'animal opium', 'animal opiate', 'animal opioid', 'animal taboo', 'animal curse', 'animal swear', 'animal profanity', 'animal offensive', 'animal racist', 'animal sexist', 'animal homophobic', 'animal transphobic', 'animal bigot', 'animal bigotry', 'animal hate', 'animal hateful', 'animal discriminate', 'animal discrimination', 'animal terrorist', 'animal terrorism', 'animal bomb', 'animal explosive', 'animal gun', 'animal shoot', 'animal shooting', 'animal massacre', 'animal mass shooting', 'animal school shooting', 'animal assassinate', 'animal assassination', 'animal genocide', 'animal holocaust', 'animal nazi', 'animal hitler', 'animal kkk', 'animal klan', 'animal lynch', 'animal lynching', 'animal slavery', 'animal slave', 'animal torture', 'animal execution', 'animal beheading', 'animal decapitate', 'animal decapitation', 'animal castrate', 'animal castration', 'animal mutilate', 'animal mutilation', 'animal dismember', 'animal dismemberment', 'animal necrophilia', 'animal cannibal', 'animal cannibalism', 'animal zoosadism'];

  // Check user credits before allowing course generation
  const userId = req.user.id;
  const user = getUserById(userId);
  if (!user) return res.status(401).json({ error: 'User not found' });
  if (!user.courseCredits || user.courseCredits < 1) {
    return res.status(402).json({ error: 'No course credits left. Please purchase more to generate new courses.' });
  }

  // Check for NSFW or banned words in topic
  const { topic } = req.body;
  if (typeof topic === 'string') {
    const lowerTopic = topic.toLowerCase();
    for (const word of bannedWords) {
      if (lowerTopic.includes(word)) {
        return res.status(400).json({ error: 'Course topic contains inappropriate or NSFW content and cannot be generated.' });
      }
    }
  }

  while (attempt <= MAX_RETRIES) {
    try {
      const { topic, difficulty, difficultyLevel, numModules, numLessonsPerModule } = req.body;
      const finalDifficulty = difficulty || difficultyLevel;
      if (!topic || !finalDifficulty || !numModules) return res.status(400).json({ error: 'Missing required parameters' });
      
      const course = await AIService.generateCourse(topic, finalDifficulty, numModules, numLessonsPerModule);
      course.id = `course_${userId}_${Date.now()}`;
      course.userId = userId;
      
      db.data.courses.push(course);
      // Decrement user credits
      user.courseCredits = (user.courseCredits || 1) - 1;
      await db.write();
      await db.write();
      
      return res.status(201).json(course);
    } catch (error) {
      console.error(`[API] Attempt ${attempt + 1} failed to generate course:`, error.message);
      attempt++;
      if (attempt > MAX_RETRIES) {
        console.error('[API] All attempts to generate course failed.');
        return res.status(500).json({ error: 'Failed to generate course after multiple attempts', details: error.message });
      }
      // Optional: wait a moment before retrying with exponential backoff
      const delay = 1000 * Math.pow(2, attempt);
      console.log(`[API] Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
});

app.delete('/api/courses/:courseId', authenticateToken, async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user.id;

    const courseIndex = db.data.courses.findIndex(c => c.id === courseId);

    if (courseIndex === -1) {
      return res.status(404).json({ error: 'Course not found' });
    }

    if (db.data.courses[courseIndex].userId !== userId) {
      return res.status(403).json({ error: 'Unauthorized to delete this course' });
    }

    db.data.courses.splice(courseIndex, 1);
    await db.write();

    res.status(200).json({ message: 'Course deleted successfully' });
  } catch (error) {
    console.error(`[API] Error deleting course ${req.params.courseId}:`, error);
    res.status(500).json({ error: 'Failed to delete course' });
  }
});

app.get('/api/modules/:moduleId/quiz-scores', authenticateToken, (req, res) => {
  // In a real application, you would fetch this from a database.
  // For now, we'll just return an empty object to prevent errors.
  res.json({});
});

// Wikimedia image search endpoint
app.get('/api/wikimedia/search', async (req, res) => {
  const query = req.query.query;
  if (!query) {
    return res.status(400).json({ error: 'Missing query parameter' });
  }
  try {
    // Wikimedia Commons API endpoint
    const apiUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrlimit=1&prop=imageinfo&iiprop=url|user|extmetadata|size|mime&format=json&origin=*`;
    const response = await axios.get(apiUrl);
    const data = response.data;
    if (!data.query || !data.query.pages) {
      return res.status(404).json({ error: 'No image found' });
    }
    const page = Object.values(data.query.pages)[0];
    if (!page.imageinfo || !page.imageinfo[0]) {
      return res.status(404).json({ error: 'No image info found' });
    }
    const info = page.imageinfo[0];
    // Extract metadata
    const result = {
      imageURL: info.url,
      thumbnailURL: info.thumburl || info.url,
      description: (info.extmetadata && info.extmetadata.ImageDescription && info.extmetadata.ImageDescription.value) || '',
      author: (info.extmetadata && info.extmetadata.Artist && info.extmetadata.Artist.value) || '',
      license: (info.extmetadata && info.extmetadata.LicenseShortName && info.extmetadata.LicenseShortName.value) || '',
      pageURL: info.descriptionurl || '',
      width: info.width || 0,
      height: info.height || 0,
      size: info.size || 0,
      mime: info.mime || '',
      categories: page.categories ? page.categories.map(c => c.title) : []
    };
    res.json(result);
  } catch (error) {
    console.error('[Wikimedia API] Error:', error.message);
    res.status(500).json({ error: 'Failed to fetch image from Wikimedia', details: error.message });
  }
});

// Add this route to allow saving/updating a course
app.post('/api/courses', authenticateToken, async (req, res) => {
  try {
    const course = req.body;
    if (!course || !course.id) {
      return res.status(400).json({ error: 'Invalid course data' });
    }
    course.userId = req.user.id;
    // Check if course exists for this user
    const existingIndex = db.data.courses.findIndex(c => c.id === course.id && c.userId === req.user.id);
    if (existingIndex !== -1) {
      db.data.courses[existingIndex] = course;
    } else {
      db.data.courses.push(course);
    }
    await db.write();
    res.json(course);
  } catch (error) {
    console.error('[API] Failed to save course:', error);
    res.status(500).json({ error: 'Failed to save course' });
  }
});

// Publish a course (make it public)
app.post('/api/courses/:courseId/publish', authenticateToken, async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user.id;
    const course = db.data.courses.find(c => c.id === courseId);
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }
    if (course.userId !== userId) {
      return res.status(403).json({ error: 'Unauthorized to publish this course' });
    }
    course.published = true;
    await db.write();
    res.json(course);
  } catch (error) {
    console.error('[API] Failed to publish course:', error);
    res.status(500).json({ error: 'Failed to publish course' });
  }
});

// Stripe: Create Checkout Session for £20 (10 credits)
app.post('/api/create-checkout-session', authenticateToken, async (req, res) => {
  if (!stripe) return res.status(500).json({ error: 'Stripe not configured' });
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'gbp',
            product_data: {
              name: '10 Course Generations',
              description: 'Generate up to 10 courses on the platform',
            },
            unit_amount: 2000, // £20.00 in pence
          },
          quantity: 1,
        },
      ],
      metadata: {
        userId: req.user.id,
      },
      success_url: `${req.headers.origin || 'http://localhost:5173'}/dashboard?payment=success`,
      cancel_url: `${req.headers.origin || 'http://localhost:5173'}/dashboard?payment=cancel`,
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error('[Stripe] Error creating checkout session:', err);
    res.status(500).json({ error: 'Failed to create Stripe checkout session' });
  }
});

// Stripe: Webhook to handle successful payment and add credits
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  let event;
  try {
    const sig = req.headers['stripe-signature'];
    event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('[Stripe] Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const userId = session.metadata.userId;
    const user = getUserById(userId);
    if (user) {
      user.courseCredits = (user.courseCredits || 0) + 10;
      await db.write();
      console.log(`[Stripe] Added 10 credits to user ${userId}`);
    }
  }
  res.json({ received: true });
});

// --- STATIC FILE SERVING & SPA FALLBACK ---

const buildPath = path.join(__dirname, 'dist');
app.use(express.static(buildPath));
app.get('*', (req, res) => {
  res.sendFile(path.join(buildPath, 'index.html'), (err) => {
      if (err) {
          res.status(500).send(err);
      }
  });
});

// --- ERROR HANDLING ---

app.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message
  });
});

// --- SERVER STARTUP ---

async function findAvailablePort(startPort) {
  let port = startPort;
  while (true) {
    try {
      await new Promise((resolve, reject) => {
        const tester = net.createServer()
          .once('error', (err) => (err.code === 'EADDRINUSE' ? reject(err) : resolve()))
          .once('listening', () => {
            tester.close();
            resolve();
          })
          .listen(port, '127.0.0.1');
      });
      return port;
    } catch (e) {
      if (e.code === 'EADDRINUSE') {
        console.warn(`[SERVER_DEBUG] Port ${port} is in use, trying next port...`);
        port++;
      } else {
        throw e;
      }
    }
  }
}

async function startServer() {
  try {
    const port = await findAvailablePort(process.env.PORT || 4002);
    const server = app.listen(port, () => {
      console.log(`Server is running on http://localhost:${port}`);
    });

    server.on('error', (error) => {
      console.error('Server error:', error);
    });

  } catch (error) {
    console.error('[SERVER_ERROR] Failed to start server:', error);
    process.exit(1);
  }
}

startServer();