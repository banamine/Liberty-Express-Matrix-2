import os
import json
import tempfile

def update_rumble_cache(data, cache_file="rumble_cache.json"):
    # Write to a temporary file first
    temp_fd, temp_path = tempfile.mkstemp(dir=os.path.dirname(os.path.abspath(cache_file)))
    try:
        with os.fdopen(temp_fd, 'w') as f:
            json.dump(data, f)
        # Atomic rename to avoid race conditions (Node reading half-written file)
        os.replace(temp_path, cache_file)
    except Exception as e:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        raise e

if __name__ == "__main__":
    # Stub for the Rumble crawler
    update_rumble_cache({"fallback": False, "url": "https://example.com/rumble.m3u8"})
