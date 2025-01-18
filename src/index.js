const express = require('express');
const cors = require('cors');
const path = require('path');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const { serveHTTP } = require('stremio-addon-sdk');
const addonInterface = require('./addon');
const { validateGeminiKey } = require('./translateProvider');
const LanguageService = require('./services/languages');

// Default configuration
const DEFAULT_CONFIG = {
  cacheTime: 24, // hours
  maxConcurrent: 3,
  debugMode: false,
  translateTo: 'Dutch'
};

// Initialize database
async function initDb() {
  const db = await open({
    filename: 'data/config.db',
    driver: sqlite3.Database
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  return db;
}

const app = express();
const PORT = process.env.PORT || 7000;

app.use(cors());
app.use(express.json());
app.use(express.static('static'));
app.use(express.static('src/assets'));

// Set view engine
app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');
app.set('views', path.join(__dirname, 'templates'));

let db;
(async () => {
  db = await initDb();
})();

// Landing page
app.get('/', (req, res) => {
  res.render('landing.html', {
    manifest: require('../manifest.json')
  });
});

// Configuration page
app.get('/configure', async (req, res) => {
  const config = await getConfig();
  const languageService = await LanguageService.getInstance();
  const languages = await languageService.getLanguages();

  res.render('config.html', {
    version: require('../package.json').version,
    config,
    languages
  });
});

// Get current configuration
async function getConfig() {
  const config = {...DEFAULT_CONFIG};
  const rows = await db.all('SELECT key, value FROM config');
  
  rows.forEach(row => {
    if (row.key === 'geminiApiKey') return; // Don't expose API key
    try {
      config[row.key] = JSON.parse(row.value);
    } catch {
      config[row.key] = row.value;
    }
  });
  
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
    await db.run('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)', 
      'geminiApiKey', geminiApiKey);
    await db.run('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)',
      'translateTo', translateTo);
    await db.run('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)',
      'cacheTime', JSON.stringify(cacheTime));
    await db.run('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)',
      'maxConcurrent', JSON.stringify(maxConcurrent));
    await db.run('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)',
      'debugMode', JSON.stringify(debugMode));

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
app.get('/:path(*)', (req, res) => {
  serveHTTP(addonInterface, req, res);
});

app.listen(PORT, () => {
  console.log(`Addon active on port ${PORT}`);
}); 