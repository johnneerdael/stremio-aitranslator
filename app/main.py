from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import RedirectResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
import base64
import json
import os
import asyncio
from pathlib import Path
from typing import Optional, Dict
from pydantic import BaseModel
from urllib.parse import unquote, quote
from .subtitles import SubtitleProcessor
from .translation import TranslationManager
from .languages import get_languages, is_language_supported, get_language_name

# Initialize FastAPI
app = FastAPI(debug=True)

# Mount static files and loading subtitle
app.mount("/assets", StaticFiles(directory=Path(__file__).parent / "assets"), name="assets")

# Initialize templates
templates = Jinja2Templates(directory="templates")

# Ensure cache directories exist
CACHE_DIR = Path("subtitles")
CACHE_DIR.mkdir(exist_ok=True)

def get_base_url():
    """Get base URL from environment or default"""
    domain = os.getenv("BASE_DOMAIN", "localhost:7000")
    protocol = "https" if "localhost" not in domain else "http"
    return f"{protocol}://{domain}"

async def get_config(config_b64: str):
    """Decode base64 config"""
    try:
        config_json = base64.b64decode(config_b64).decode('utf-8')
        return json.loads(config_json)
    except Exception as e:
        print(f"Config error: {str(e)}")
        return None

@app.get("/{config_b64}/subtitles/{type}/{id}/videoHash={video_hash}&videoSize={video_size}.json")
async def get_subtitles(config_b64: str, type: str, id: str, video_hash: str, video_size: str):
    """Handle subtitle requests"""
    try:
        print(f"Checking for English subtitles in stream...")
        
        # Get config from base64
        config = await get_config(config_b64)
        if not config or not config.opensubtitles_key:
            return JSONResponse({"subtitles": []})

        # Parse the ID to get imdb_id, season, episode
        imdb_id = id
        season = None 
        episode = None
        if ':' in id:
            parts = id.split(':')
            imdb_id = parts[0]
            if len(parts) > 2:
                season = int(parts[1])
                episode = int(parts[2])

        # Initialize subtitle processor
        subtitle_processor = SubtitleProcessor(
            api_key=config.opensubtitles_key,
            app_name=config.opensubtitles_app or "Stremio AI Translator"
        )

        # Fetch subtitles with all parameters
        subtitles = await subtitle_processor.fetch_subtitles(
            type=type,
            imdb_id=imdb_id,
            season=season,
            episode=episode,
            video_hash=video_hash,
            video_size=int(video_size) if video_size else None
        )

        if not subtitles:
            return JSONResponse({"subtitles": []})

        # Process and return subtitles
        return JSONResponse({
            "subtitles": [{
                "id": f"{id}-{sub.get('id')}",
                "url": sub.get('url'),
                "lang": sub.get('lang', 'eng')
            } for sub in subtitles]
        })

    except Exception as e:
        print(f"Subtitle error: {str(e)}")
        return JSONResponse(
            {"subtitles": [{"url": f"{get_base_url()}/loading.srt"}]},
            status_code=500
        )

# Keep your other existing endpoints... 