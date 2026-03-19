import yt_dlp
import os
import uuid
from typing import Optional

def download_youtube_video(url: str, output_dir: str = "/tmp") -> Optional[str]:
    """
    Downloads a YouTube video to output_dir and returns the file path.
    """
    try:
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)
            
        unique_id = str(uuid.uuid4())
        # Use a template that includes the unique ID to avoid collisions
        output_template = os.path.join(output_dir, f"{unique_id}_%(title)s.%(ext)s")
        
        ydl_opts = {
            'format': 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
            'outtmpl': output_template,
            # Limit downloads for speed/testing if needed, or keep complete
            'quiet': True,
        }
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info_dict = ydl.extract_info(url, download=True)
            filename = ydl.prepare_filename(info_dict)
            
            # Check if downloading merged multiple files into one
            if os.path.exists(filename):
                return filename
            else:
                # Search for any file with that unique ID in the output_dir
                for f in os.listdir(output_dir):
                    if unique_id in f:
                        return os.path.join(output_dir, f)
        return None
    except Exception as e:
        print(f"Error downloading YouTube video: {e}")
        return None

if __name__ == "__main__":
    # Quick test if run directly
    test_url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
    path = download_youtube_video(test_url)
    print(f"Downloaded to: {path}")
