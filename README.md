# Gemini Flash Subtitle Translator for Stremio

A Stremio addon that automatically translates English subtitles to Dutch using Google's Gemini AI. This addon provides real-time subtitle translation with optimized performance and rate limiting.

## Features

- 🚀 Real-time subtitle translation
- 🎯 Optimized for Gemini's free tier limits
- 🔄 Smart caching of translated subtitles
- 🎨 Beautiful configuration interface
- 🔒 Secure API key management
- 📱 Responsive design
- 🌐 Automatic SSL with Caddy

## Self-Hosting Guide

### Prerequisites

- Docker and Docker Compose
- A domain name pointing to your server
- Basic knowledge of terminal/command line
- Gemini API key from [Google AI Studio](https://makersuite.google.com/app/apikey)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/johnneerdael/stremio-aitranslator.git
   cd stremio-aitranslator
   ```

2. Create necessary directories and files:
   ```bash
   mkdir -p subtitles/dut
   touch credentials.json
   ```

3. Edit the Caddyfile:
   ```bash
   nano Caddyfile
   ```
   Replace with your domain and email:
   ```
   {
       email your-email@domain.com
   }

   your-domain.com {
       root * /app
       file_server

       handle /manifest.json {
           reverse_proxy addon:7000
       }

       handle /subtitles/* {
           reverse_proxy addon:3000
       }

       handle /config {
           reverse_proxy addon:3000
       }

       handle /save-credentials {
           reverse_proxy addon:3000
       }
   }
   ```

4. Start the services:
   ```bash
   docker-compose up -d
   ```

5. Visit your configuration page:
   ```
   https://your-domain.com/config
   ```

### Configuration

1. Get your Gemini API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Visit your addon's configuration page
3. Enter your API key
4. Click the "Install in Stremio" button that appears after successful configuration

### Usage

The addon will be available in Stremio at:
```
https://your-domain.com/manifest.json
```

### Directory Structure

```
addon-gemini-flash/
├── index.js              # Main addon code
├── config.html           # Configuration page
├── Dockerfile           # Docker configuration
├── docker-compose.yml   # Docker Compose configuration
├── Caddyfile           # Caddy reverse proxy configuration
├── subtitles/          # Directory for cached subtitles
│   └── dut/           # Dutch translations
└── credentials.json    # Stored API credentials
```

### Rate Limits

The addon is optimized for Gemini's free tier limits:
- 15 RPM (requests per minute)
- 1M TPM (tokens per minute)
- 1,500 RPD (requests per day)

Translation strategy:
1. First 25 subtitles translated immediately (5 chunks of 5)
2. Next 100 subtitles translated quickly (5 chunks of 20)
3. Remaining subtitles translated with optimized delays

### Maintenance

- View logs:
  ```bash
  docker-compose logs -f
  ```

- Update the addon:
  ```bash
  docker-compose pull
  docker-compose up -d
  ```

- Restart services:
  ```bash
  docker-compose restart
  ```

- Stop services:
  ```bash
  docker-compose down
  ```

### Troubleshooting

1. Check the logs for errors:
   ```bash
   docker-compose logs -f
   ```

2. Verify permissions:
   ```bash
   sudo chown -R 1000:1000 subtitles/
   sudo chmod -R 755 subtitles/
   ```

3. Reset configuration:
   ```bash
   echo '{}' > credentials.json
   ```

4. Verify Caddy configuration:
   ```bash
   docker-compose exec caddy caddy validate
   ```

### Security Considerations

- Always use HTTPS (automatically handled by Caddy)
- Keep your API key secure
- Regularly update Docker images
- Monitor logs for unusual activity
- Use strong file permissions

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Google's Gemini AI for translation
- Stremio team for the addon SDK
- Caddy for reverse proxy
- The open-source community

## Support

If you encounter any issues or need help, please open an issue on GitHub. 
