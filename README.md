# Stremio AI Translator

A Stremio addon that provides real-time subtitle translation using Google's Gemini AI. This service automatically translates subtitles across multiple languages while maintaining high quality and context awareness.

## Features

- Real-time subtitle translation using Google's Gemini AI
- Support for multiple languages
- Redis-based caching for improved performance
- Queue management for translation requests
- Web-based configuration interface
- Docker deployment support
- Caddy reverse proxy integration

## Prerequisites

- Node.js 18+
- Redis
- Docker and Docker Compose (for containerized deployment)
- Google Gemini AI API key

## Local Development Setup

```bash
# Clone the repository
git clone https://github.com/johnneerdael/stremio-aitranslator
cd stremio-aitranslator

# Install dependencies
npm install

# Start development server
npm run dev
```

## Environment Variables

```env
GEMINI_API_KEY=your_gemini_api_key
REDIS_URL=redis://localhost:6379
PORT=7000
```

## Docker Deployment

### Basic Setup

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "7000:7000"
    environment:
      - GEMINI_API_KEY=${GEMINI_API_KEY}
      - REDIS_URL=redis://redis:6379
    depends_on:
      - redis

  redis:
    image: redis:alpine
    volumes:
      - redis_data:/data

volumes:
  redis_data:
```

### Production Setup with Caddy

Use the provided `docker-compose.yml` and `Caddyfile.external` for production deployment with Caddy reverse proxy.

#### External Caddyfile Configuration

```caddyfile
{
    email admin@yourdomain.com
    tls {
        dns cloudflare {$CLOUDFLARE_API_TOKEN}
        resolvers 1.1.1.1
    }
}

aitranslator.thepi.es {
    redir / /configure 301

    handle_path /configure {
        reverse_proxy localhost:7000
    }

    reverse_proxy localhost:7000 {
    }
}
```

## Configuration Interface

Access the configuration interface at:
- Local development: http://localhost:7000/configure
- Production: https://aitranslator.thepi.es/configure

## Version History

### v1.5.0
- Added Caddy reverse proxy support with Cloudflare DNS
- Improved production deployment configuration
- Enhanced documentation

### v1.4.1
- Initial public release
- Google Gemini AI integration
- Basic translation functionality
- Redis caching implementation

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
