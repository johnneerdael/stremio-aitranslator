from typing import List, Dict, Optional
import aiohttp
import json
import time
from pathlib import Path

class SubtitleProcessor:
    def __init__(self, api_key: str, app_name: str = "Stremio AI Translator"):
        self.api_key = api_key
        self.app_name = app_name
        self.base_url = "https://api.opensubtitles.com/api/v1"
        self.batch_size = 15
        self.window_size = 60
        self.buffer_time = 2 * 60 * 1000
        self.cache_ttl = 7 * 24 * 60 * 60
        self.cleanup_interval = 60 * 60

    async def fetch_subtitles(self, type: str, imdb_id: str, 
                            season: Optional[int] = None,
                            episode: Optional[int] = None,
                            video_hash: Optional[str] = None,
                            video_size: Optional[int] = None) -> List[Dict]:
        """
        Fetch subtitles from OpenSubtitles
        """
        try:
            # Build the URL based on type and parameters
            if type == 'series' and season and episode:
                url = f"{self.base_url}/subtitles/{type}/{imdb_id}:{season}:{episode}"
            else:
                url = f"{self.base_url}/subtitles/{type}/{imdb_id}"

            headers = {
                "Api-Key": self.api_key,
                "User-Agent": self.app_name
            }

            # Add video hash and size to query params if provided
            params = {}
            if video_hash:
                params['hash'] = video_hash
            if video_size:
                params['size'] = video_size

            async with aiohttp.ClientSession() as session:
                async with session.get(url, headers=headers, params=params) as response:
                    if response.status == 200:
                        data = await response.json()
                        return data.get('subtitles', [])
                    else:
                        print(f"Error fetching subtitles: {response.status}")
                        return []

        except Exception as e:
            print(f"Error fetching subtitles: {str(e)}")
            return []

    async def load_cache(self, cache_path: Path):
        """Load cached subtitles if available"""
        try:
            if cache_path.exists():
                if (time.time() - cache_path.stat().st_mtime) < self.cache_ttl:
                    return json.loads(cache_path.read_text())
        except Exception as e:
            print(f"Cache error: {str(e)}")
        return None

    # Keep your other existing methods... 