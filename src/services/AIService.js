// src/services/AIService.js
import Course from '../models/Course.js';

class AIService {
  constructor() {
    this.maxTokens = {
      course: 8192, // For structure only
      module: 2048,
      lesson: 4096, // For individual lesson content
      quiz: 800,
      flashcard: 800,
      search: 300
    };

    this.apiBaseUrl = typeof process !== 'undefined' && process.env
      ? process.env.API_BASE_URL || 'http://localhost:4002'
      : import.meta.env?.VITE_API_BASE_URL || 'http://localhost:4002';
  }

  async _makeApiRequest(prompt, intent, expectJsonResponse = true) {
    let attempt = 0;
    const maxRetries = 5;

    while (attempt < maxRetries) {
      try {
        const cleanPrompt = prompt.trim();
        const actualMaxTokens = this.maxTokens[intent] || this.maxTokens.course;

        const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env?.VITE_MISTRAL_API_KEY || ''}`
          },
          body: JSON.stringify({
            model: "mistral-large-latest",
            messages: [{ role: 'user', content: cleanPrompt }],
            temperature: 0.7,
            max_tokens: actualMaxTokens,
            stream: true
          }),
        });

        if (!response.ok) {
          if (response.status === 429) {
            const delay = 2000 * Math.pow(2, attempt);
            console.warn(`[AIService] Rate limited on attempt ${attempt + 1}. Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            attempt++;
            continue;
          }
          const errorText = await response.text();
          throw new Error(`API request failed with status ${response.status}: ${errorText}`);
        }

        let accumulatedContent = '';
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              if (line.includes('[DONE]')) break;
              try {
                const jsonData = JSON.parse(line.slice(6));
                if (jsonData.choices?.[0]?.delta?.content) {
                  accumulatedContent += jsonData.choices[0].delta.content;
                }
              } catch (e) {
                // Malformed JSON line in stream, continue processing
              }
            }
          }
        }

        if (expectJsonResponse) {
          console.log('[AIService DEBUG] Raw content from API:', accumulatedContent);
          const jsonString = this._extractJson(accumulatedContent);
          if (!jsonString) {
            throw new Error("No valid JSON object or array found in the response.");
          }
          return JSON.parse(jsonString);
        }
        return accumulatedContent.trim();
      } catch (error) {
        console.error(`[AIService] Attempt ${attempt + 1} failed for intent ${intent}:`, error.message);
        attempt++;
        if (attempt >= maxRetries) {
          console.error(`[AIService] All attempts failed for intent ${intent}.`);
          throw error;
        }
        const delay = 2000 * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  _extractJson(text) {
    // First, try to find a JSON block enclosed in markdown
    const markdownMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
    let content = text;
    if (markdownMatch && markdownMatch[1]) {
        content = markdownMatch[1];
    }
    
    content = content.trim();

    // Heuristic fix for a common error: a list of objects missing the opening bracket.
    if (content.startsWith('{') && content.endsWith(']')) {
        content = `[${content}`;
    }

    // Now, find the first complete JSON object or array.
    let firstBracket = content.indexOf('{');
    let firstSquare = content.indexOf('[');
    
    if (firstBracket === -1 && firstSquare === -1) return null;

    let start = -1;
    if (firstBracket === -1) start = firstSquare;
    else if (firstSquare === -1) start = firstBracket;
    else start = Math.min(firstBracket, firstSquare);

    const openChar = content[start];
    const closeChar = openChar === '{' ? '}' : ']';
    
    let openCount = 1;
    for (let i = start + 1; i < content.length; i++) {
        const char = content[i];
        if (char === openChar) {
            openCount++;
        } else if (char === closeChar) {
            openCount--;
        }
        if (openCount === 0) {
            const jsonString = content.substring(start, i + 1);
            try {
                // Final validation that the extracted string is valid JSON
                JSON.parse(jsonString);
                return jsonString;
            } catch (e) {
                console.error("[AIService] Extracted string is not valid JSON:", e.message);
                return null;
            }
        }
    }
    return null; // Unmatched bracket
  }

  buildCourseStructurePrompt(topic, difficulty, numModules, numLessonsPerModule) {
    return `Generate a course structure for a ${difficulty} level course on "${topic}". Create exactly ${numModules} modules, each with exactly ${numLessonsPerModule} lessons.
The entire response MUST be a single, minified, valid JSON object on a single line.
Do NOT use markdown, comments, or any text outside the JSON object.
The root object must have keys "title", "description", "subject", "difficultyLevel", and "modules".
Each object in the "modules" array must have "title", "description", and a "lessons" array.
Each object in the "lessons" array must have a "title" key.
Example of a lesson object: {"title": "My Lesson Title"}
Correct "lessons" array format: "lessons": [{"title":"Lesson 1"},{"title":"Lesson 2"}]
Incorrect format: "lessons": ["Lesson 1", "Lesson 2"]
Final JSON structure must follow this model: {"title":"...","description":"...","subject":"${topic}","difficultyLevel":"${difficulty}","modules":[{"title":"...","description":"...","lessons":[{"title":"..."}]}]}`;
  }

  buildLessonContentPrompt(courseTitle, moduleTitle, lessonTitle) {
      return `Generate content for a lesson titled "${lessonTitle}" for the course "${courseTitle}".
Your response should contain three distinct parts: an "introduction", a "main_content", and a "conclusion".
Separate these three parts ONLY with the delimiter "|||---|||".
For example: Introduction text here.|||---|||Main content text here.|||---|||Conclusion text here.
In the main_content, use \\n for paragraph breaks.
Identify and wrap all important key terms in the introduction, main_content, and conclusion with double asterisks to make them bold (e.g., **key term**).
Do NOT use JSON or any other formatting.`;
  }

  async generateCourse(topic, difficulty, numModules, numLessonsPerModule = 3) {
    let courseWithIds;
    try {
      // 1. Generate the course structure
      let courseStructure;
      try {
        const structurePrompt = this.buildCourseStructurePrompt(topic, difficulty, numModules, numLessonsPerModule);
        courseStructure = await this._makeApiRequest(structurePrompt, 'course', true);
        if (!courseStructure || !this.validateCourseStructure(courseStructure)) {
          throw new Error('Failed to generate or validate course structure.');
        }
      } catch (e) {
        e.step = 'structure';
        throw e;
      }
      
      courseWithIds = this.assignIdsToModulesAndLessons(courseStructure);

      // 2. Generate content for each lesson
      try {
        for (const module of courseWithIds.modules) {
          if (!module.lessons) continue;
          for (const lesson of module.lessons) {
            console.log(`[COURSE] Generating content for lesson: ${lesson.title}`);
            const contentPrompt = this.buildLessonContentPrompt(courseWithIds.title, module.title, lesson.title);
            const lessonContentString = await this._makeApiRequest(contentPrompt, 'lesson', false);
            
            const parts = lessonContentString.split('|||---|||');
            if (parts.length === 3) {
              lesson.content = {
                introduction: parts[0].trim(),
                main_content: parts[1].trim(),
                conclusion: parts[2].trim(),
              };
            } else {
              console.error(`[AIService] Failed to parse lesson content for "${lesson.title}". Content: ${lessonContentString}`);
              lesson.content = { introduction: "Content generation failed.", main_content: "Please try again.", conclusion: "" };
            }
            
            // Add delay before next API call
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Generate quiz questions for the lesson
            console.log(`[COURSE] Generating quiz for lesson: ${lesson.title}`);
            const quizQuestions = await this.generateQuizQuestions(lesson.content, lesson.title);
            lesson.quiz = quizQuestions || [];

            // Add delay before next API call
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Generate flashcards for the lesson
            console.log(`[COURSE] Generating flashcards for lesson: ${lesson.title}`);
            try {
              const flashcards = await this.generateFlashcards(lesson.content, lesson.title);
              if (Array.isArray(flashcards) && flashcards.length > 0) {
                lesson.flashcards = flashcards;
                console.log(`[COURSE] Generated ${flashcards.length} flashcards for lesson: ${lesson.title}`);
              } else {
                lesson.flashcards = [];
                console.warn(`[COURSE] No flashcards generated for lesson: ${lesson.title}`);
              }
            } catch (error) {
              console.error(`[COURSE] Error generating flashcards for lesson: ${lesson.title}`, error);
              lesson.flashcards = [];
            }

            // Add delay before next lesson
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
      } catch (e) {
        e.step = 'content';
        throw e;
      }

      // 3. Process images
      try {
        const modulesWithImages = await this.processImagesInParallel(courseWithIds.modules);
        courseWithIds.modules = modulesWithImages;
      } catch (e) {
        e.step = 'images';
        throw e;
      }
      
      console.log(`[AIService] Course generation successful for: ${courseWithIds.title}`);
      return courseWithIds;
    } catch (error) {
      let errorMessage = `[AIService] Error in course generation process for "${topic}"`;
      if (error.step) {
        errorMessage += ` during step: ${error.step}`;
      }
      console.error(errorMessage, error);
      throw new Error(`Failed to generate course. Stage: ${error.step || 'unknown'}. Details: ${error.message}`);
    }
  }

  validateCourseStructure(data) {
    if (!data || typeof data !== 'object' || !data.title || !Array.isArray(data.modules)) return false;
    for (const module of data.modules) {
      if (!module.title || !Array.isArray(module.lessons)) return false;
      for (const lesson of module.lessons) {
        if (!lesson.title) return false;
      }
    }
    return true;
  }

  assignIdsToModulesAndLessons(courseData) {
    if (!courseData || !courseData.modules) return courseData;
    courseData.modules.forEach((module, mIdx) => {
      module.id = module.id || `module_${mIdx}_${Date.now()}`;
      if (module.lessons && Array.isArray(module.lessons)) {
        module.lessons.forEach((lesson, lIdx) => {
          lesson.id = lesson.id || `lesson_${mIdx}_${lIdx}_${Date.now()}`;
        });
      }
    });
    return courseData;
  }
    
  async searchImage(query) {
    const encodedQuery = encodeURIComponent(query);
    const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodedQuery}&gsrlimit=1&prop=imageinfo&iiprop=url|user|extmetadata&format=json&origin=*`;
    
    try {
        const response = await fetch(url, { headers: { 'Accept': 'application/json' } });
        if (!response.ok) return null;
      
        const data = await response.json();
        const page = data.query?.pages ? Object.values(data.query.pages)[0] : null;

        if (page?.imageinfo?.[0]?.url) {
            const info = page.imageinfo[0];
            const metadata = info.extmetadata;

            const getBestValue = (...keys) => {
                for (const key of keys) {
                    if (metadata && metadata[key] && metadata[key].value) {
                        return metadata[key].value.toString().replace(/<[^>]*>/g, '').trim();
                    }
                }
                return 'N/A';
            };

            return {
                url: info.url,
                description: getBestValue('ImageDescription', 'ObjectName'),
                author: getBestValue('Artist', 'Credit', 'Author'),
                license: getBestValue('LicenseShortName')
            };
        }
        return null;
    } catch (error) {
        console.error("Error searching image:", error);
        return null;
    }
  }

  async processImagesInParallel(modules) {
    const imagePromises = modules.map(module => 
      this.generateSearchTerms(module.title, module.description)
        .then(searchTerms => this.searchImage(searchTerms[0] || module.title))
        .then(imageData => ({ ...module, image: imageData }))
    );
    return Promise.all(imagePromises);
  }

  async generateQuizQuestions(content, lessonTitle) {
      const prompt = `Based on the following lesson content, generate a 5-question multiple-choice quiz about "${lessonTitle}".
The entire response MUST be a single, valid JSON array of objects.
Each object in the array represents a question and must have "question" (string), "options" (array of 4 strings), and "answer" (string, one of the options).
Example of one question object: {"question":"What is 1+1?","options":["1","2","3","4"],"answer":"2"}
Ensure the "answer" value is an exact match to one of the "options" values.
Do NOT use markdown or any text outside the JSON array.

Lesson content:
Introduction: ${content.introduction}
Main Content: ${content.main_content}
Conclusion: ${content.conclusion}`;
      try {
          const result = await this._makeApiRequest(prompt, 'quiz', true);
          if (Array.isArray(result)) {
            return result;
          }
          console.warn('[AIService] Quiz questions result was not an array. Returning empty array.', { result });
          return [];
      } catch (error) {
          console.error("Error generating quiz questions:", error);
          return []; // Return empty array on failure
      }
  }

  async generateFlashcards(content, lessonTitle) {
      const prompt = `Based on the following lesson content for "${lessonTitle}", generate a list of 5-10 key terms and their definitions as flashcards.
- Each key term must be a phrase of no more than 5 words.
- Each definition must be a single short sentence (no more than 20 words) that clearly explains the term in the context of the lesson.
The entire response MUST be a single, valid JSON array of objects.
Each object must have a "term" and a "definition" key.
Example: [{"term": "Democracy", "definition": "A system of government where people vote."}, {"term": "Roman Republic", "definition": "A period when Rome was governed by elected officials."}]
Do NOT use markdown or any text outside the JSON array.

Lesson content:
Introduction: ${content.introduction}
Main Content: ${content.main_content}
Conclusion: ${content.conclusion}`;
      try {
          const result = await this._makeApiRequest(prompt, 'flashcard', true);
          if (Array.isArray(result)) {
            return result;
          }
          console.warn('[AIService] Flashcards result was not an array. Returning empty array.', { result });
          return [];
      } catch (error) {
          console.error("Error generating flashcards:", error);
          return []; // Return empty array on failure
      }
  }

  async generateSearchTerms(prompt, context) {
    const searchPrompt = this._buildPrompt('generateSearchTerms', { prompt, context });
    try {
      const result = await this._makeApiRequest(searchPrompt, 'search', true);
      // Assuming the result is a JSON object with a "search_terms" key
      return result.search_terms || [];
    } catch (error) {
      console.error("Error generating search terms:", error);
      return [prompt]; // Fallback to the original prompt
    }
  }

  _buildPrompt(template, params) {
    const templates = {
        generateSearchTerms: `Based on the following prompt and context, generate 3 diverse and effective search terms for finding a relevant, high-quality image on Wikimedia Commons. The terms should be distinct from each other. Return the results as a JSON object with a single key "search_terms" which is an array of strings.

Context: The user wants an image for a module in an online course.
Module Title: "${params.prompt}"
Module Description: "${params.context}"

Your response must be only the JSON object, like this:
{"search_terms": ["search term 1", "search term 2", "search term 3"]}`
    };
    return templates[template] || '';
  }

  async regenerateLesson(lesson) {
    try {
      // Generate new content for the lesson
      const content = await this._makeApiRequest(
        `Generate a comprehensive lesson about "${lesson.title}". Include an introduction, main content with key terms in bold using markdown (**term**), and a conclusion.`,
        'lesson'
      );

      // Add delay before next API call
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Generate new quiz questions
      const quiz = await this._makeApiRequest(
        `Generate 5 multiple choice quiz questions about "${lesson.title}". Each question should test understanding of key concepts.`,
        'quiz',
        true
      );

      // Add delay before next API call
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Generate new flashcards
      const flashcards = await this._makeApiRequest(
        `Generate 8-10 flashcards about "${lesson.title}". Each flashcard should focus on a key term or concept.`,
        'flashcard',
        true
      );

      // Update the lesson with new content
      lesson.content = content;
      lesson.quiz = quiz;
      lesson.flashcards = flashcards;

      return lesson;
    } catch (error) {
      console.error('Error regenerating lesson:', error);
      throw error;
    }
  }

  /**
   * Generate a definition for a single term using lesson content as context
   * @param {object|string} content - The lesson content (object with introduction, main_content, conclusion, or string)
   * @param {string} lessonTitle - The lesson title
   * @param {string} term - The key term to define
   * @returns {Promise<string>} - The AI-generated definition
   */
  async generateDefinitionForTerm(content, lessonTitle, term) {
    let intro = '', main = '', concl = '';
    if (typeof content === 'string') {
      // Try to split by section delimiters if present
      const parts = content.split('|||---|||');
      if (parts.length === 3) {
        intro = parts[0].trim();
        main = parts[1].trim();
        concl = parts[2].trim();
      } else {
        main = content;
      }
    } else if (content && typeof content === 'object') {
      intro = content.introduction || '';
      main = content.main_content || '';
      concl = content.conclusion || '';
    }
    const prompt = `Using the following lesson content for the lesson titled "${lessonTitle}", provide a concise definition (1-2 sentences) for the key term: "${term}".\n\nLesson content:\nIntroduction: ${intro}\nMain Content: ${main}\nConclusion: ${concl}\n\nDefinition:`;
    try {
      const result = await this._makeApiRequest(prompt, 'flashcard', false);
      if (!result || typeof result !== 'string') {
        // Handle the error gracefully
        return 'Definition not available due to API error or rate limiting.';
      }
      // Return the first non-empty line as the definition
      const lines = result.split('\n').map(l => l.trim()).filter(Boolean);
      return lines[0] || result.trim();
    } catch (error) {
      console.error(`[AIService] Error generating definition for term '${term}':`, error);
      return 'Definition not available.';
    }
  }
}

export default new AIService(); 