const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const readline = require('readline');
const axios = require('axios');
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');

// Configuration constants
const CONFIG_PORT = 3000;
const ADDON_PORT = 7000;

// Add logging utility at the top of the file
function log(message, data = null) {
    const timestamp = new Date().toISOString();
    if (data) {
        console.log(`[${timestamp}] ${message}:`, data);
    } else {
        console.log(`[${timestamp}] ${message}`);
    }
}

// Validate Gemini API key
async function validateGeminiKey(apiKey) {
    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        // Try a simple translation to validate the API key
        const result = await model.generateContent('Translate "hello" to Dutch');
        await result.response;
        return true;
    } catch (error) {
        console.error('Gemini API key validation failed:', error.message);
        return false;
    }
}

const builder = new addonBuilder({
    id: "stremio-aitranslator",
    version: "1.0.2",
    name: "Auto Subtitle Translate from English to Dutch",
    logo: "./subtitles/logo.png",
    configurable: true,
    behaviorHints: {
      configurable: true,
      configurationRequired: true,
    },
    config: [
      {
          key: "provider",
          title: "Provider",
          type: "select",
          required: true,
          options: ["gemini-flash-1.5"],
      },
      {
          key: "apikey",
          title: "API Key",
          type: "text",
          required: true,
          dependencies: [
              {
                key: "provider",
                value: ["gemini-flash-1.5"]
              }
          ]
      },
      {
        key: "translateto",
        title: "Translate to",
        type: "select",
        required: true,
        options: baseLanguages
      }
    ],
    description:
      "This addon takes subtitles from OpenSubtitlesV3 then translates into desired language using Gemini Flash 1.5 Free Tier.",
    types: ["series", "movie"],
    catalogs: [],
    resources: ["subtitles"],
  });

// Initialize the generative AI client (will be set after validation)
let genAI;
let model;

// Function to clean up translated text
function cleanTranslatedText(text) {
    return text
        .replace(/[™®©]/g, '') // Remove trademark and copyright symbols
        .replace(/^[âÂ]™[aA][°º]|\s*[âÂ]™[aA][°º]\s*$/g, '') // Remove â™a° or similar at start/end
        .replace(/^\s+|\s+$/g, '') // Trim whitespace
        .replace(/\s+/g, ' '); // Normalize spaces
}

// Rate limiting configuration
const rateLimiter = {
    requestsInLastMinute: 0,
    lastMinuteTimestamp: Date.now(),
    requestsToday: 0,
    lastDayTimestamp: Date.now(),
    tokensToday: 0, // Track token usage
    
    async checkRateLimit(phase, textLength = 0) {
        const now = Date.now();
        
        // Reset counters if needed
        if (now - this.lastMinuteTimestamp >= 60000) {
            this.requestsInLastMinute = 0;
            this.lastMinuteTimestamp = now;
        }
        
        if (now - this.lastDayTimestamp >= 86400000) {
            this.requestsToday = 0;
            this.tokensToday = 0;
            this.lastDayTimestamp = now;
        }
        
        // Estimate tokens (rough estimate: 1.5 tokens per character)
        const estimatedTokens = textLength * 1.5;
        
        // Check if we've hit limits
        if (this.requestsInLastMinute >= 14) {
            const waitTime = 60000 - (now - this.lastMinuteTimestamp);
            log('Rate limit reached, waiting', { waitTime });
            await new Promise(resolve => setTimeout(resolve, waitTime));
            this.requestsInLastMinute = 0;
            this.lastMinuteTimestamp = Date.now();
        }
        
        if (this.tokensToday >= 900000) { // Keep buffer below 1M TPM limit
            const waitTime = 60000; // Wait a minute if near token limit
            log('Token limit approaching, waiting', { waitTime });
            await new Promise(resolve => setTimeout(resolve, waitTime));
            this.tokensToday = Math.max(0, this.tokensToday - 100000); // Rough estimate of token recovery
        }
        
        // Add delay based on phase
        if (phase === 'later') {
            // Calculate delay based on remaining token allowance
            const tokenUsageRatio = this.tokensToday / 900000;
            const baseDelay = 5000; // 5 seconds base delay
            const adaptiveDelay = Math.floor(baseDelay * (1 + tokenUsageRatio * 2));
            await new Promise(resolve => setTimeout(resolve, adaptiveDelay));
        }
        
        // Increment counters
        this.requestsInLastMinute++;
        this.requestsToday++;
        this.tokensToday += estimatedTokens;
        
        log('Rate limit status', {
            requestsInLastMinute: this.requestsInLastMinute,
            requestsToday: this.requestsToday,
            tokensToday: this.tokensToday,
            phase
        });
    }
};

// Function to translate text using Gemini
async function translateText(text, phase = 'initial') {
    try {
        await rateLimiter.checkRateLimit(phase, text.length);
        log('Attempting to translate text', { length: text.length, phase });
        
        const prompt = `Translate the following English text to Dutch. Provide ONLY the direct translation without any additional marks, symbols, or formatting:

${text}`;
        
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const translatedText = cleanTranslatedText(response.text());
        
        log('Translation successful', {
            originalLength: text.length,
            translatedLength: translatedText.length,
            phase
        });
        
        return translatedText;
    } catch (error) {
        log('Translation error', {
            message: error.message,
            stack: error.stack
        });
        throw error;
    }
}

// Function to parse SRT content
function parseSRT(srtContent) {
    try {
        log('Starting SRT parsing');
        // Split by double newline to separate subtitle blocks
        const subtitleBlocks = srtContent.split('\r\n\r\n').filter(Boolean);
        if (subtitleBlocks.length === 1) {
            // Try alternative line ending
            subtitleBlocks = srtContent.split('\n\n').filter(Boolean);
        }
        log('Found subtitle blocks', { count: subtitleBlocks.length });

        return subtitleBlocks.map((block, index) => {
            try {
                // Split block into lines
                const lines = block.split(/\r?\n/).filter(Boolean);
                
                // First line is the index
                const subtitleIndex = lines[0];
                
                // Second line is the timestamp
                const timing = lines[1];
                
                // Remaining lines are the text
                const textLines = lines.slice(2);
                
                log(`Parsed subtitle block ${index + 1}`, {
                    index: subtitleIndex,
                    timing,
                    textLength: textLines.join(' ').length
                });

                return {
                    index: subtitleIndex,
                    timing: timing,
                    text: textLines.join('\n')
                };
            } catch (error) {
                log('Error parsing subtitle block', { 
                    blockIndex: index, 
                    error: error.message,
                    block 
                });
                return null;
            }
        }).filter(Boolean); // Remove any failed parses
    } catch (error) {
        log('Error in SRT parsing', { error: error.message });
        throw error;
    }
}

// Function to format SRT content
function formatSRT(subtitles) {
    try {
        log('Starting SRT formatting', { subtitleCount: subtitles.length });
        const formatted = subtitles.map(subtitle => {
            return `${subtitle.index}\n${subtitle.timing}\n${subtitle.text}\n`;
        }).join('\n');
        log('SRT formatting complete', { length: formatted.length });
        return formatted;
    } catch (error) {
        log('Error in SRT formatting', { error: error.message });
        throw error;
    }
}

// Function to fetch subtitles from OpenSubtitles
async function fetchSubtitlesFromOpenSubtitles(type, imdbid, season = null, episode = null) {
    const url = `https://opensubtitles-v3.strem.io/subtitles/${type}/${imdbid}${season ? `:${season}:${episode}` : ''}.json`;
    log('Fetching subtitles from URL', url);
    
    try {
        const response = await axios.get(url);
        log('OpenSubtitles API response received', { status: response.status });
        
        if (response.data.subtitles.length > 0) {
            log('Total subtitles found', response.data.subtitles.length);
            
            const englishSubtitles = response.data.subtitles
                .filter(subtitle => subtitle.lang === 'eng')
                .map(subtitle => subtitle.url);
            
            log('English subtitles found', englishSubtitles.length);
            
            if (englishSubtitles.length > 0) {
                log('Selected subtitle URL', englishSubtitles[0]);
                return englishSubtitles.slice(0, 1);
            }
        }
        log('No suitable subtitles found');
        return null;
    } catch (error) {
        log('Error fetching subtitles', {
            message: error.message,
            status: error.response?.status,
            data: error.response?.data
        });
        throw error;
    }
}

// Create the Express app for configuration
const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(__dirname));

app.get('/config', (req, res) => {
    res.sendFile(__dirname + '/landing.html');
});

// Handle form submission with validation
app.post('/save-credentials', async (req, res) => {
    const { geminiApiKey } = req.body;
    
    if (!geminiApiKey) {
        return res.status(400).send('API key is required');
    }

    try {
        // Validate Gemini API key first
        const isGeminiValid = await validateGeminiKey(geminiApiKey);

        if (!isGeminiValid) {
            return res.status(400).send('Invalid Gemini API key. Please check your credentials.');
        }

        // If valid, save credentials and initialize client
        const credentials = { geminiApiKey };
        
        // Write to file with proper error handling
        try {
            await fs.promises.writeFile('credentials.json', JSON.stringify(credentials, null, 2), {
                mode: 0o666 // Set file permissions to be writable
            });
        } catch (writeError) {
            console.error('Error writing credentials file:', writeError);
            return res.status(500).send('Error saving credentials. Please check file permissions.');
        }
        
        // Initialize Gemini client with validated credentials
        genAI = new GoogleGenerativeAI(geminiApiKey);
        model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        res.status(200).send('Credentials validated and saved successfully!');
    } catch (error) {
        console.error('Error in save-credentials:', error);
        res.status(500).send('Error processing request. Please try again.');
    }
});

// Function to load and validate saved credentials
async function loadAndValidateCredentials() {
    try {
        if (fs.existsSync('credentials.json')) {
            const credentials = JSON.parse(fs.readFileSync('credentials.json', 'utf8'));
            const isGeminiValid = await validateGeminiKey(credentials.geminiApiKey);

            if (isGeminiValid) {
                genAI = new GoogleGenerativeAI(credentials.geminiApiKey);
                model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
                return true;
            }
        }
        return false;
    } catch (error) {
        console.error('Error loading credentials:', error);
        return false;
    }
}

// Start servers with credential validation
async function startServers() {
    // Start the configuration server
    app.listen(CONFIG_PORT, () => {
        console.log(`Configuration server is running on http://localhost:${CONFIG_PORT}/config`);
    });

    // Check for existing valid credentials
    const hasValidCredentials = await loadAndValidateCredentials();

    if (!hasValidCredentials) {
        console.log('=========================================================');
        console.log('No valid credentials found!');
        console.log('Please visit the configuration page to set up your credentials:');
        console.log(`http://localhost:${CONFIG_PORT}/config`);
        console.log('=========================================================');
    }

    // Start the Stremio addon server
    serveHTTP(builder.getInterface(), { port: ADDON_PORT })
        .then(({ url }) => {
            console.log('=========================================================');
            console.log('Stremio Addon running at:', url);
            console.log('=========================================================');
            if (!hasValidCredentials) {
                console.log('To install in Stremio:');
                console.log('1. Visit the configuration page at:', `http://localhost:${CONFIG_PORT}/config`);
                console.log('2. Enter your Gemini API key');
                console.log('3. Install the addon in Stremio using:', url);
            } else {
                console.log('Addon is ready to use in Stremio!');
            }
            console.log('=========================================================');
        });
}

// Start the servers
startServers();

// Function to sanitize filename
function sanitizeFilename(filename) {
    // Replace colons and other invalid characters with underscores
    return filename.replace(/[<>:"\/\\|?*]+/g, '_');
}

// Function to format a single subtitle
function formatSubtitle(subtitle) {
    return `${subtitle.index}\n${subtitle.timing}\n${subtitle.text}\n\n`;
}

// Add static file serving to express app
app.use('/subtitles', express.static('subtitles'));

// Function to generate subtitle URL
function generateSubtitleUrl(imdbId, season = null, episode = null) {
    const baseUrl = `http://127.0.0.1:${CONFIG_PORT}/subtitles`;
    if (season && episode) {
        return `${baseUrl}/dut/${imdbId}/season${season}/${imdbId}-translated-${episode}-1.srt`;
    }
    return `${baseUrl}/dut/${imdbId}/${imdbId}-translated-1.srt`;
}

// Function to ensure subtitle directory exists
async function ensureSubtitleDirectory(imdbId, season = null) {
    const basePath = 'subtitles/dut';
    let dirPath;
    
    if (season) {
        dirPath = `${basePath}/${imdbId}/season${season}`;
    } else {
        dirPath = `${basePath}/${imdbId}`;
    }
    
    await fs.promises.mkdir(dirPath, { recursive: true });
    return dirPath;
}

// Update the subtitle handler to return the correct format
builder.defineSubtitlesHandler(async (args) => {
    log('Subtitle request received', args);
    
    try {
        const { type, id } = args;
        
        // Parse ID to get imdbId, season, and episode
        let imdbId, season, episode;
        if (type === 'series') {
            const match = id.match(/^(tt\d+):(\d+):(\d+)$/);
            if (!match) {
                log('Invalid series ID format');
                return { subtitles: [] };
            }
            [, imdbId, season, episode] = match;
        } else {
            imdbId = id;
        }

        // Check if we already have translated subtitles
        const subtitleUrl = generateSubtitleUrl(imdbId, season, episode);
        try {
            await fs.promises.access(subtitleUrl.replace(`http://127.0.0.1:${CONFIG_PORT}`, ''));
            log('Found existing translation', { url: subtitleUrl });
            return {
                subtitles: [{
                    id: `${imdbId}-subtitle`,
                    url: subtitleUrl,
                    lang: 'dut'
                }]
            };
        } catch (err) {
            // File doesn't exist, continue with translation
        }

        // Fetch English subtitles using OpenSubtitles
        log('Fetching subtitles for', { type, id: imdbId });
        const subtitleUrls = await fetchSubtitlesFromOpenSubtitles(type, imdbId, season, episode);
        
        if (!subtitleUrls || subtitleUrls.length === 0) {
            log('No English subtitles found');
            return { subtitles: [] };
        }

        // Fetch the subtitle content
        log('Fetching subtitle content from', subtitleUrls[0]);
        const response = await axios.get(subtitleUrls[0]);
        const srtContent = response.data;
        log('Subtitle content received', { length: srtContent.length });

        // Parse SRT content
        log('Parsing SRT content');
        const parsedSubtitles = parseSRT(srtContent);
        log('Parsed subtitles', { count: parsedSubtitles.length });

        // Ensure directory exists and get file path
        const dirPath = await ensureSubtitleDirectory(imdbId, season);
        const fileName = season && episode ? 
            `${imdbId}-translated-${episode}-1.srt` : 
            `${imdbId}-translated-1.srt`;
        const filePath = `${dirPath}/${fileName}`;

        // Create write stream for the subtitle file
        const writeStream = fs.createWriteStream(filePath);

        // Return the result early with the file URL
        const result = {
            subtitles: [{
                id: `${imdbId}-subtitle`,
                url: subtitleUrl,
                lang: 'dut'
            }]
        };

        // Process subtitles in chunks with optimized timing
        const initialChunks = 5; // First 5 chunks of 5
        const fastChunks = 5; // Next 5 chunks of 20
        const initialChunkSize = 5;
        const fastChunkSize = 20;
        const laterChunkSize = 20;
        let lastIndex = 0;

        // Start processing chunks
        (async () => {
            try {
                // Process initial small chunks quickly (first 25 subtitles)
                for (let i = 0; i < Math.min(initialChunks * initialChunkSize, parsedSubtitles.length); i += initialChunkSize) {
                    const chunk = parsedSubtitles.slice(i, i + initialChunkSize);
                    log(`Translating initial chunk ${Math.floor(i/initialChunkSize) + 1}/${Math.min(initialChunks, Math.ceil(parsedSubtitles.length/initialChunkSize))}`);
                    
                    const translatedChunk = [];
                    for (const subtitle of chunk) {
                        try {
                            const translatedText = await translateText(subtitle.text, 'initial');
                            translatedChunk.push({
                                ...subtitle,
                                text: translatedText
                            });
                        } catch (error) {
                            log('Error translating subtitle', { 
                                index: subtitle.index, 
                                error: error.message 
                            });
                            translatedChunk.push(subtitle);
                        }
                    }

                    // Write translated subtitles to file immediately
                    for (const subtitle of translatedChunk) {
                        writeStream.write(formatSubtitle(subtitle));
                    }

                    lastIndex = i + chunk.length;
                }

                // Process next chunks quickly (next 100 subtitles)
                const fastStart = lastIndex;
                for (let i = 0; i < fastChunks && lastIndex < parsedSubtitles.length; i++) {
                    const chunk = parsedSubtitles.slice(lastIndex, lastIndex + fastChunkSize);
                    log(`Translating fast chunk ${i + 1}/${fastChunks}`);
                    
                    const translatedChunk = [];
                    for (const subtitle of chunk) {
                        try {
                            const translatedText = await translateText(subtitle.text, 'fast');
                            translatedChunk.push({
                                ...subtitle,
                                text: translatedText
                            });
                        } catch (error) {
                            log('Error translating subtitle', { 
                                index: subtitle.index, 
                                error: error.message 
                            });
                            translatedChunk.push(subtitle);
                        }
                    }

                    // Write translated subtitles to file immediately
                    for (const subtitle of translatedChunk) {
                        writeStream.write(formatSubtitle(subtitle));
                    }

                    lastIndex += chunk.length;
                }

                // Process remaining subtitles with token-optimized delays
                for (let i = lastIndex; i < parsedSubtitles.length; i += laterChunkSize) {
                    const chunk = parsedSubtitles.slice(i, i + laterChunkSize);
                    log(`Translating later chunk ${Math.floor((i-lastIndex)/laterChunkSize) + 1}/${Math.ceil((parsedSubtitles.length-lastIndex)/laterChunkSize)}`);
                    
                    const translatedChunk = [];
                    for (const subtitle of chunk) {
                        try {
                            const translatedText = await translateText(subtitle.text, 'later');
                            translatedChunk.push({
                                ...subtitle,
                                text: translatedText
                            });
                        } catch (error) {
                            log('Error translating subtitle', { 
                                index: subtitle.index, 
                                error: error.message 
                            });
                            translatedChunk.push(subtitle);
                        }
                    }

                    // Write translated subtitles to file immediately
                    for (const subtitle of translatedChunk) {
                        writeStream.write(formatSubtitle(subtitle));
                    }
                }

                // Close the write stream when done
                writeStream.end();
                log('All subtitles translated and written to file');
            } catch (error) {
                log('Error in translation process', {
                    message: error.message,
                    stack: error.stack,
                    lastProcessedIndex: lastIndex
                });
                writeStream.end();
            }
        })();

        // Return the result immediately while translations continue in background
        log('Returning subtitle URL early', result);
        return result;
    } catch (error) {
        log('Error in subtitle handler', {
            message: error.message,
            stack: error.stack,
            args: args
        });
        return { subtitles: [] };
    }
});

// Add route to serve subtitle files
app.get('/:filename', (req, res) => {
    const filename = req.params.filename;
    if (filename.endsWith('.srt')) {
        res.sendFile(filename, { root: __dirname });
    } else {
        res.status(404).send('Not found');
    }
});

module.exports = builder.getInterface(); 