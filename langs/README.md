# AI Subtitle Translation Service

An automated subtitle translation service that uses AI to provide high-quality translations across multiple languages.

## Features

- AI-powered subtitle translation
- Support for multiple subtitle formats
- OpenSubtitles.org integration
- Rate limiting and queue management
- Docker deployment support
- REST API endpoints

## Local Development Setup

### Prerequisites

- Node.js 18+
- npm or yarn
- MongoDB 6.0+

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/ai-subtitle-translator
cd ai-subtitle-translator

# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Update .env with your configuration
nano .env
```

### Environment Variables

```env
MONGO_URI=mongodb://localhost:27017/subtitles
OPENSUBTITLES_API_KEY=your_api_key
AI_API_KEY=your_ai_api_key
PORT=3000
```

### Running Locally

```bash
# Start development server
npm run dev

# Run tests
npm test
```

## Docker Deployment

### Basic Docker Compose Setup

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - MONGO_URI=mongodb://mongo:27017/subtitles
      - OPENSUBTITLES_API_KEY=${OPENSUBTITLES_API_KEY}
      - AI_API_KEY=${AI_API_KEY}
    depends_on:
      - mongo

  mongo:
    image: mongo:6
    volumes:
      - mongo_data:/data/db

volumes:
  mongo_data:
```

### Docker Compose with Caddy Reverse Proxy

```yaml
version: '3.8'

services:
  app:
    build: .
    expose:
      - "3000"
    environment:
      - MONGO_URI=mongodb://mongo:27017/subtitles
      - OPENSUBTITLES_API_KEY=${OPENSUBTITLES_API_KEY}
      - AI_API_KEY=${AI_API_KEY}
    depends_on:
      - mongo
    networks:
      - internal
      - web

  mongo:
    image: mongo:6
    volumes:
      - mongo_data:/data/db
    networks:
      - internal

  caddy:
    image: caddy:2
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
      - caddy_config:/config
    networks:
      - web

networks:
  internal:
  web:

volumes:
  mongo_data:
  caddy_data:
  caddy_config:
```

### Caddyfile Configuration

```caddyfile
api.yourdomain.com {
    reverse_proxy app:3000
    tls your@email.com
}
```

## API Documentation

### Authentication

All API requests require an API key passed in the header:

```bash
Authorization: Bearer your_api_key
```

### Endpoints

#### Submit Translation Job

```bash
POST /api/v1/translate
Content-Type: application/json

{
  "subtitleFile": "base64_encoded_file",
  "sourceLanguage": "en",
  "targetLanguage": "es"
}
```

#### Check Translation Status

```bash
GET /api/v1/status/:jobId
```

## Error Handling

The API uses standard HTTP status codes:

- 200: Success
- 400: Bad Request
- 401: Unauthorized
- 429: Too Many Requests
- 500: Internal Server Error

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details. 