const express = require('express');
const cors = require('cors');
const path = require('path');
const { serveHTTP } = require('stremio-addon-sdk');
const addonInterface = require('./addon');
const { validateGeminiKey } = require('./translateProvider');
const LanguageService = require('./services/languages');
const DatabaseService = require('./services/database');

// Default configuration
const DEFAULT_CONFIG = {
  cacheTime: 24, // hours
  maxConcurrent: 3,
  debugMode: false,
  translateTo: 'Dutch'
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
app.use(express.static('src/assets'));

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

  res.render('config.html', {
    manifest,
    version: packageJson.version,
    config,
    languages
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

  try {
    // Save all config values
    await db.setConfig('geminiApiKey', geminiApiKey);
    await db.setConfig('translateTo', translateTo);
    await db.setConfig('cacheTime', cacheTime);
    await db.setConfig('maxConcurrent', maxConcurrent);
    await db.setConfig('debugMode', debugMode);

    res.sendStatus(200);
  } catch (error) {
    console.error('Error saving credentials:', error);
    res.status(500).send(error.message);
  }
});

// Validate key endpoint
app.post('/validate-key', async (req, res) => {
  const { geminiApiKey } = req.body;
  
  try {
    await validateGeminiKey(geminiApiKey);
    res.sendStatus(200);
  } catch (error) {
    res.status(400).send(error.message);
  }
});

// Serve the addon
// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

app.get('/:path(*)', (req, res) => {
  serveHTTP(addonInterface, req, res);
});

app.listen(PORT, () => {
  console.log(`Addon active on port ${PORT}`);
});
