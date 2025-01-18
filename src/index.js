const express = require('express');
const cors = require('cors');
const { serveHTTP } = require('stremio-addon-sdk');
const { addonInterface } = require('./addon');
const { validateGeminiKey, initializeGemini } = require('./translateProvider');
const fs = require('fs').promises;
const path = require('path');
const debug = require('debug');

const app = express();
const PORT = process.env.PORT || 11470;
const STATIC_PATH = path.join(process.cwd(), 'static');

// Enable debugging
debug.enabled = true;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(STATIC_PATH));

// Request logging middleware
app.use((req, res, next) => {
    const start = Date.now();
    debug(`${req.method} ${req.url} started`);

    res.on('finish', () => {
        const duration = Date.now() - start;
        debug(`${req.method} ${req.url} ${res.statusCode} - ${duration}ms`);
    });

    next();
});

// Error handling middleware
app.use((err, req, res, next) => {
    debug('Error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

// Debug endpoints
if (process.env.NODE_ENV === 'development') {
    app.get('/debug/vars', (req, res) => {
        res.json({
            env: process.env.NODE_ENV,
            nodeVersion: process.version,
            memoryUsage: process.memoryUsage(),
            uptime: process.uptime(),
            debugEnabled: debug.enabled
        });
    });

    app.get('/debug/config', (req, res) => {
        res.json({
            port: PORT,
            cors: true,
            addonName: addonInterface.manifest.name,
            addonVersion: addonInterface.manifest.version
        });
    });
}

// Configuration endpoint
app.post('/save-credentials', async (req, res) => {
    const { geminiApiKey } = req.body;
    
    if (!geminiApiKey) {
        return res.status(400).send('API key is required');
    }

    try {
        // Validate Gemini API key
        const isValid = await validateGeminiKey(geminiApiKey);
        if (!isValid) {
            return res.status(400).send('Invalid Gemini API key');
        }

        // Save credentials
        await fs.writeFile('credentials.json', JSON.stringify({ geminiApiKey }, null, 2));
        
        // Initialize Gemini client
        initializeGemini(geminiApiKey);

        res.status(200).send('Credentials saved successfully');
    } catch (error) {
        console.error('Error saving credentials:', error);
        res.status(500).send('Error saving credentials');
    }
});

// Configuration page
app.get('/config', (req, res) => {
    res.sendFile(path.join(STATIC_PATH, 'config.html'));
});

// Load existing credentials if available
async function loadCredentials() {
    try {
        const data = await fs.readFile('credentials.json', 'utf8');
        const { geminiApiKey } = JSON.parse(data);
        if (geminiApiKey) {
            const isValid = await validateGeminiKey(geminiApiKey);
            if (isValid) {
                initializeGemini(geminiApiKey);
                return true;
            }
        }
    } catch (error) {
        console.log('No valid credentials found');
    }
    return false;
}

// Start the server
async function startServer() {
    const hasCredentials = await loadCredentials();

    // Start the Stremio addon
    serveHTTP(addonInterface, { port: PORT });

    console.log('=========================================================');
    console.log(`Addon running at: http://127.0.0.1:${PORT}`);
    if (!hasCredentials) {
        console.log('No valid credentials found!');
        console.log('Please visit the configuration page:');
        console.log(`http://127.0.0.1:${PORT}/config`);
    }
    console.log('=========================================================');
}

startServer(); 