const express = require('express');
const cors = require('cors');
const path = require('path');
const { serveHTTP } = require('stremio-addon-sdk');
const addonInterface = require('./addon');
const { validateGeminiKey } = require('./translateProvider');
const LanguageService = require('./services/languages');
const DatabaseService = require('./services/database');
const debug = require('debug')('stremio:*');

// Default configuration
const DEFAULT_CONFIG = {
  cacheTime: 24, // hours
  maxConcurrent: 3,
  debugMode: false,
  translateTo: 'nl'
};

const app = express();
let db;

// Initialize database
async function initDb() {
  db = await DatabaseService.getInstance();
  
  // Set default config values if not exists
  const config = await db.getAllConfig();
  for (const [key, value] of Object.entries(DEFAULT_CONFIG)) {
    if (!(key in config)) {
      await db.setConfig(key, value);
    }
  }
  
  return db;
}
const PORT = process.env.PORT || 7000;

app.use(cors());
app.use(express.json());
app.use(express.static('static'));
app.use('/', express.static('static/assets'));

// Set view engine
app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');
app.set('views', path.join(__dirname, 'templates'));

// Initialize database on startup
(async () => {
  await initDb();
})();

// Load manifest and package.json once at startup
const manifest = require('../manifest.json');
const packageJson = require('../package.json');

// Landing page
app.get('/', (req, res) => {
  res.render('landing.html', {
    manifest,
    version: packageJson.version
  });
});

// Configuration page
app.get('/configure', async (req, res) => {
  const config = await getConfig();
  const languageService = await LanguageService.getInstance();
  const languages = await languageService.getLanguages();

  debug('Configuration page accessed');
  debug('Current config:', config);
  debug('Available languages:', languages);

  res.render('config.html', {
    manifest,
    version: packageJson.version,
    config,
    languages,
    req
  });
});

// Get current configuration
async function getConfig() {
  const config = {...DEFAULT_CONFIG};
  const dbConfig = await db.getAllConfig();
  
  for (const [key, value] of Object.entries(dbConfig)) {
    if (key === 'geminiApiKey') continue; // Don't expose API key
    config[key] = value;
  }
  
  return config;
}

// Save credentials endpoint
app.post('/save-credentials', async (req, res) => {
  const { 
    geminiApiKey,
    translateTo,
    cacheTime,
    maxConcurrent,
    debugMode
  } = req.body;

  debug('Saving configuration:', {
    translateTo,
    cacheTime,
    maxConcurrent,
    debugMode,
    hasApiKey: !!geminiApiKey
  });

  try {
    // Save all config values
    await db.setConfig('geminiApiKey', geminiApiKey);
    await db.setConfig('translateTo', translateTo);
    await db.setConfig('cacheTime', cacheTime);
    await db.setConfig('maxConcurrent', maxConcurrent);
    await db.setConfig('debugMode', debugMode);

    debug('Configuration saved successfully');
    res.sendStatus(200);
  } catch (error) {
    console.error('Error saving credentials:', error);
    res.status(500).send(error.message);
  }
});

// Validate key endpoint
app.post('/validate-key', async (req, res) => {
  const { geminiApiKey } = req.body;
  
  debug('Validating API key');
  try {
    await validateGeminiKey(geminiApiKey);
    debug('API key validation successful');
    res.sendStatus(200);
  } catch (error) {
    debug('API key validation failed:', error.message);
    res.status(400).send(error.message);
  }
});

// Serve the addon
// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

app.get('/:path(*)', async (req, res) => {
  try {
    // Get configuration from query parameters
    const {
      key: apiKey,
      lang: translateTo,
      cache: cacheTime,
      concurrent: maxConcurrent,
      debug: debugMode
    } = req.query;
    
    debug('Addon request:', {
      path: req.path,
      hasApiKey: !!apiKey,
      translateTo,
      cacheTime,
      maxConcurrent,
      debugMode
    });

    if (!apiKey) {
      // If no key provided, redirect to configuration page
      if (req.path === '/manifest.json') {
        debug('No API key provided, redirecting to configure page');
        return res.redirect('/configure');
      }
    }

    // Save configuration to Redis
    if (apiKey) {
      debug('Saving configuration from URL parameters');
      await db.setConfig('geminiApiKey', apiKey);
      if (translateTo) await db.setConfig('translateTo', translateTo);
      if (cacheTime) await db.setConfig('cacheTime', parseInt(cacheTime));
      if (maxConcurrent) await db.setConfig('maxConcurrent', parseInt(maxConcurrent));
      if (debugMode) await db.setConfig('debugMode', debugMode === 'true');
    }

    // Create interface with the provided configuration
    const interface = await addonInterface.getInterface(apiKey);
    debug('Created addon interface, serving request');
    serveHTTP(interface, req, res);
  } catch (error) {
    console.error('Error serving addon:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Addon active on port ${PORT}`);
});
