# AI Subtitle Translator for Stremio

A Stremio addon that automatically translates English subtitles using Google's Gemini AI.

## Features

- Automatic subtitle translation from English
- Supports both movies and series
- Uses Google Gemini AI for translation
- Built-in caching system
- Configurable settings

## Prerequisites

1. Google Gemini API Key (Get it from [Google AI Studio](https://makersuite.google.com/app/apikey))
2. Docker and Docker Compose

## Installation

1. Clone the repository:
```bash
git clone https://github.com/johnneerdael/stremio-aitranslator.git
cd stremio-aitranslator
```

2. Configure Redis System Parameters:

For optimal Redis performance, set the following system parameters on your host machine:

```bash
# Set vm.overcommit_memory to 1
sudo sysctl vm.overcommit_memory=1

# Make it permanent
echo "vm.overcommit_memory = 1" | sudo tee -a /etc/sysctl.conf

# Set maximum number of connections
echo "net.core.somaxconn = 511" | sudo tee -a /etc/sysctl.conf

# Apply changes
sudo sysctl -p
```

3. Start the services:
```bash
docker-compose up -d
```

4. Access the addon at:
```
http://localhost:7000
```

## Configuration

1. Visit the configuration page at `http://localhost:7000/configure`
2. Enter your Google Gemini API key
3. Configure translation settings:
   - Target Language
   - Cache Duration
   - Max Concurrent Translations
   - Debug Mode

## Development

1. Install dependencies:
```bash
npm install
```

2. Run in development mode:
```bash
npm run dev
```

## Building

```bash
npm run build
```

## Environment Variables

- `PORT`: Server port (default: 7000)
- `DEBUG`: Debug logging (e.g., stremio:*)
- `NODE_ENV`: Environment (development/production)
- `REDIS_URL`: Redis connection URL

## Docker Volumes

- `./data`: Persistent data storage
- `./langs`: Language configuration files
- `./subtitles`: Subtitle cache
- `redis_data`: Redis database

## License

MIT
