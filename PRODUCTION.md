# Production Deployment Guide

This guide covers deploying the Stremio AI Translator addon in a production environment.

## Prerequisites

- Linux server with Docker and Docker Compose installed
- Domain name pointing to your server
- (Optional) Cloudflare account for DNS management
- Google Gemini API key

## Deployment Options

### Option 1: All-in-One Docker Setup

This option runs both the addon and Caddy reverse proxy in Docker containers on the same server.

1. **Prepare the Server**:
```bash
# Create deployment directory
mkdir -p /opt/stremio-aitranslator
cd /opt/stremio-aitranslator

# Clone the repository
git clone https://github.com/yourusername/stremio-aitranslator.git .

# Create necessary directories
mkdir -p {subtitles,logs/caddy}
touch credentials.json
```

2. **Configure Environment**:
```bash
# Configure domain and email if needed
nano .env

# Required variables:
# - DOMAIN=your-domain.com
# - EMAIL=your-email@domain.com
```

3. **Start Services**:
```bash
# Build and start containers
docker compose -f compose-full.yml up -d

# Check logs
docker-compose -f docker-compose.full.yml logs -f
```

### Option 2: Separate Caddy Server

This option runs the addon on one server and uses an existing Caddy installation on another server.

1. **On Addon Server**:
```bash
# Setup directory
mkdir -p /opt/stremio-aitranslator
cd /opt/stremio-aitranslator
git clone https://github.com/yourusername/stremio-aitranslator.git .

# Create directories and files
mkdir -p {subtitles,logs}
touch credentials.json

# Configure environment
cp .env.example .env
nano .env  # Add GEMINI_API_KEY

# Start addon
docker-compose up -d aitranslator
```

2. **On Caddy Server**:
```bash
# Add site configuration
sudo nano /etc/caddy/Caddyfile

# Add the following configuration:
your-domain.com {
    log {
        output file /var/log/caddy/aitranslator.log {
            roll_size 10mb
            roll_keep 5
            roll_keep_for 720h
        }
        format json
    }

    reverse_proxy addon-server-ip:11470 {
        health_uri /health
        health_interval 30s
        health_timeout 10s
        health_status 200
    }

    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        X-Frame-Options "SAMEORIGIN"
        X-XSS-Protection "1; mode=block"
        X-Content-Type-Options "nosniff"
        Referrer-Policy "strict-origin-when-cross-origin"
        -Server
    }

    encode gzip
}

# Test and reload Caddy
sudo caddy validate
sudo systemctl reload caddy
```

## Monitoring and Maintenance

### Health Checks

Monitor the addon's health:
```bash
# Check health endpoint
curl -f https://your-domain.com/health

# View service status
docker ps -a
docker stats stremio-aitranslator
```

### Logs

Access various log files:
```bash
# Addon logs
docker-compose logs -f aitranslator

# Caddy logs
tail -f /var/log/caddy/aitranslator.log

# Application logs
tail -f logs/app.log
```

### Updating

Update to the latest version:
```bash
# Pull latest changes
git pull

# Rebuild and restart
docker-compose pull
docker-compose up -d --build aitranslator
```

### Backup

Important files to backup:
```bash
# Create backup directory
mkdir -p /backup/stremio-aitranslator

# Backup files
tar -czf /backup/stremio-aitranslator/backup-$(date +%Y%m%d).tar.gz \
    subtitles/ \
    logs/ \
    credentials.json \
    .env
```

## Security Considerations

1. **File Permissions**:
```bash
# Set proper ownership
chown -R 1000:1000 subtitles/
chmod -R 755 subtitles/
chmod 600 credentials.json
chmod 600 .env
```

2. **Firewall Rules**:
```bash
# Allow only necessary ports
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow from your-caddy-server-ip to any port 11470
```

3. **SSL/TLS**:
- Ensure Caddy is configured for HTTPS
- Enable HSTS
- Use modern TLS configurations

4. **Rate Limiting**:
- Monitor API usage
- Set up alerts for quota limits
- Implement caching strategies

## Troubleshooting

1. **Service Won't Start**:
```bash
# Check logs
docker-compose logs aitranslator

# Verify permissions
ls -la subtitles/ credentials.json

# Check port availability
netstat -tulpn | grep 11470
```

2. **SSL Issues**:
```bash
# Check Caddy logs
tail -f /var/log/caddy/aitranslator.log

# Verify DNS settings
dig your-domain.com

# Test SSL
curl -vI https://your-domain.com
```

3. **Performance Issues**:
```bash
# Monitor resources
htop
docker stats

# Check network
tcpdump -i any port 11470

# View memory usage
docker exec stremio-aitranslator free -m
```

## Support

For issues and support:
- GitHub Issues: [Report a bug](https://github.com/yourusername/stremio-aitranslator/issues)
- Email: your.email@domain.com 