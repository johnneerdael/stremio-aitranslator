# Stremio AI Translator Addon

![Version](https://img.shields.io/badge/version-1.1.0-blue.svg)

An advanced Stremio addon that uses Google's Gemini Pro to translate subtitles in real-time. Supports mid-show starts and provides instant feedback while translating.

## Features

- Real-time subtitle translation using Google Gemini Flash 1.5 Free Tier
- Smart translation prioritization for mid-show starts
- Progress tracking and instant feedback
- Efficient caching system
- Support for all Stremio-compatible subtitle formats
- Modern configuration interface
- Extensive debugging capabilities

## Prerequisites

- Docker and Docker Compose
- Google Gemini API key (get it from [Google AI Studio](https://makersuite.google.com/app/apikey))

For development:
- Node.js 20+
- pnpm (`npm install -g pnpm`)

## Quick Start

1. Clone the repository:
```bash
git clone https://github.com/yourusername/stremio-aitranslator.git
cd stremio-aitranslator
```

2. Choose your deployment method:

### Option 1: All-in-One Docker Setup (with Caddy)

This option runs both the addon and Caddy reverse proxy in Docker containers:

1. Edit `docker-compose.full.yml`:
```bash
# Replace yourdomain.com with your actual domain
# Update email address for SSL certificates
```

2. Start the services:
```bash
docker compose -f compose-full.yml up -d
```

### Option 2: Addon Only (External Caddy)

If you're running Caddy on another server:

1. Start the addon:
```bash
docker compose up -d
```

2. On your Caddy server, add this to your Caddyfile:
```caddy
yourdomain.com {
    reverse_proxy your-addon-server:11470 {
        health_uri /health
        health_interval 30s
    }
}
```

## Development Setup

1. Install dependencies:
```bash
pnpm install
```

2. Start development environment:
```bash
docker compose up dev
```

The development environment includes:
- Hot reloading
- Debug endpoints
- Chrome DevTools debugging (chrome://inspect)
- Extended logging

## Configuration

### Addon Configuration

Visit `http://yourdomain.com/config` to:
- Set your Gemini API key
- Configure translation settings
- Test the connection

### Environment Variables

- `NODE_ENV`: 'development' or 'production'
- `DEBUG`: Debug namespaces (e.g., 'stremio:*')
- `PORT`: Server port (default: 11470)
- `GEMINI_API_KEY`: Your Google Gemini API key

## Debugging

### Debug Endpoints (Development)

- `/debug/vars`: Runtime variables and memory usage
- `/debug/config`: Current configuration
- `/health`: Health check endpoint

### Logs

```bash
# Container logs
docker compose logs -f aitranslator

# Application logs
tail -f logs/app.log

# Caddy logs
tail -f /var/log/caddy/aitranslator.log
```

### Node.js Debugging

1. Connect to Chrome DevTools:
   - Open chrome://inspect
   - Add your server: `localhost:9229` or `your-server-ip:9229`

2. Use VS Code debugging:
   ```json
   {
     "type": "node",
     "request": "attach",
     "name": "Attach to Docker",
     "port": 9229,
     "restart": true
   }
   ```

## Monitoring

```bash
# Container stats
docker stats stremio-aitranslator

# Process monitoring
docker exec -it stremio-aitranslator htop

# Network debugging
docker exec -it stremio-aitranslator tcpdump -i any port 11470
```

## Production Deployment

### Security Considerations

1. SSL/TLS:
   - Automatic HTTPS with Caddy
   - Modern TLS configuration
   - HSTS enabled

2. Headers:
   - XSS protection
   - CSRF prevention
   - Content type sniffing protection
   - Frame protection

3. Rate Limiting:
   - Built-in Caddy rate limiting
   - Gemini API quota management

### Updating

```bash
# Pull latest changes
git pull

# Rebuild and restart
docker compose up -d --build aitranslator
```

### Backup

Important directories to backup:
- `./subtitles/`: Translated subtitle cache
- `./logs/`: Application logs
- `./credentials.json`: API key storage

## Troubleshooting

### Common Issues

1. "No valid credentials":
   - Visit the configuration page
   - Check Gemini API key validity

2. "Translation timeout":
   - Check network connectivity
   - Verify Gemini API quota

3. "Cannot connect to debug port":
   - Ensure port 9229 is accessible
   - Check firewall rules

### Health Checks

The addon includes automatic health checks:
- HTTP endpoint checks
- Process monitoring
- Resource usage alerts

## API Rate Limits

Google Gemini Pro limits:
- 15 requests per minute
- 1 million tokens per minute
- 1,500 requests per day

The addon automatically manages these limits by:
- Token-based batch sizing
- Request rate monitoring
- Efficient caching

## Contributing

1. Fork the repository
2. Create your feature branch
3. Run tests: `pnpm test`
4. Submit a pull request

## License

MIT License - see LICENSE file

## Support

- GitHub Issues: [Report a bug](https://github.com/yourusername/stremio-aitranslator/issues)
- Email: your.email@domain.com 