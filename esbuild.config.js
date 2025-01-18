const esbuild = require('esbuild');
const debug = require('debug')('stremio:build');
const fs = require('fs');
const path = require('path');

debug('Starting build...');

// Ensure directories exist
['dist', 'static', 'langs', 'subtitles', 'subtitles/dut'].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

esbuild.build({
  entryPoints: ['src/index.js'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  outfile: 'dist/index.js',
  allowOverwrite: true,
  metafile: true,
  external: [
    'express',
    'cors',
    'stremio-addon-sdk',
    '@google/generative-ai',
    'better-queue',
    'debug',
    'axios'
  ],
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production')
  },
  sourcemap: true,
  minify: process.env.NODE_ENV === 'production',
})
.then(() => {
  debug('Build completed successfully');

  // Copy static files
  if (fs.existsSync('src/config.html')) {
    fs.copyFileSync('src/config.html', 'static/config.html');
  }
})
.catch((error) => {
  debug('Build failed:', error);
  process.exit(1);
}); 