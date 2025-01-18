const esbuild = require('esbuild');
const debug = require('debug')('stremio:build');

debug('Starting build...');

esbuild.build({
  entryPoints: ['src/index.js'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  outfile: 'dist/index.js',
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
})
.catch((error) => {
  debug('Build failed:', error);
  process.exit(1);
}); 