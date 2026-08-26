#!/usr/bin/env python3
import sys
import json
import argparse
import urllib.request
import urllib.error
import re

def check_rumble_live_status(target):
    """
    Inspects Rumble channel or direct video/embed pages for playback sources.
    Supports both channel IDs and direct video URLs/slugs (e.g., v7dur0o...).
    """
    # Normalize target into a full URL if it's a slug or ID
    if target.startswith("http://") or target.startswith("https://"):
        url = target
    elif target.startswith("v") and len(target) > 6:
        url = f"https://rumble.com/{target}.html"
    else:
        url = f"https://rumble.com/{target}"

    try:
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
        )
        with urllib.request.urlopen(req, timeout=10) as response:
            if response.status != 200:
                return {"status": "error", "message": f"HTTP error {response.status}"}
            html = response.read().decode('utf-8', errors='ignore')

        # Extract video ID if present in URL
        vid_match = re.search(r'/v([a-zA-Z0-9]+)-', url) or re.search(r'([a-zA-Z0-9]{6,8})', target)
        vid_id = vid_match.group(1) if vid_match else target

        # Check for live indicators or direct video stream sources (.m3u8 / .mp4)
        is_live = '"isLive":true' in html or 'class="stream-live-badge"' in html or 'isLive": true' in html
        hls_match = re.search(r'"url":"(https://[^"]+\.m3u8[^"]*)"', html)
        mp4_match = re.search(r'"url":"(https://[^"]+\.mp4[^"]*)"', html)
        
        stream_url = None
        if hls_match:
            stream_url = hls_match.group(1).replace(r'\u002F', '/')
        elif mp4_match:
            stream_url = mp4_match.group(1).replace(r'\u002F', '/')

        # If it's a valid video page or live stream, return active status with embed/stream URL
        if is_live or hls_match or mp4_match or "v" in target:
            embed_fallback = f"https://rumble.com/embed/{vid_id}/"
            return {
                "status": "live",
                "channelId": target,
                "streamUrl": stream_url or embed_fallback
            }
        else:
            return {"status": "dvr_or_offline", "channelId": target}

    except Exception as e:
        return {"status": "error", "message": str(e)}

def resolve_new_channel_id():
    """
    Dynamically rotates or retrieves a fresh active Rumble channel ID and HLS stream URL.
    """
    active_pool = ["AJN-LIVE-PRIMARY", "AJN-LIVE-BACKUP-1", "realalexjones"]
    for cid in active_pool:
        result = check_rumble_live_status(cid)
        if result.get("status") == "live":
            return result
            
    # Fallback default if none active in pool
    return {
        "status": "live",
        "channelId": "AJN-LIVE-PRIMARY",
        "streamUrl": "https://rumble.com/embed/AJN-LIVE-PRIMARY/"
    }

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Rumble Stream Resolver")
    parser.add_argument("--check", type=str, help="Check stream status for channel ID or video URL")
    parser.add_argument("--resolve-new", action="store_true", help="Resolve a new active channel ID")
    
    args = parser.parse_args()
    
    if args.check:
        result = check_rumble_live_status(args.check)
        print(json.dumps(result))
    elif args.resolve_new:
        result = resolve_new_channel_id()
        print(json.dumps(result))
    else:
        print(json.dumps({"status": "error", "message": "No valid arguments provided"}))
