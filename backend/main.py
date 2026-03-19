import os
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks, Request, Response
import re
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from dotenv import load_dotenv

# Load environment variables from .env if present
load_dotenv()
from google.cloud import storage, bigquery
from analyzer import GeminiAnalyzer
from prompt_analyzer import PromptAnalyzer
from youtube import download_youtube_video
import urllib.parse


# Initialize clients (assumes GOOGLE_APPLICATION_CREDENTIALS is set)
try:
    gcs_client = storage.Client()
    bq_client = bigquery.Client()
except Exception as e:
    print(f"Warning: Cloud Clients failed to initialize: {e}")
    gcs_client = None
    bq_client = None

app = FastAPI(title="Video Metadata Extractor API")

# CORS middleware for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Constants from environment
GCS_BUCKET_NAME = os.environ.get("GCS_BUCKET_NAME", "your-gcs-bucket-name")
BQ_DATASET_ID = os.environ.get("BQ_DATASET_ID", "your_dataset_id")
BQ_TABLE_ID = os.environ.get("BQ_TABLE_ID", "metadata_table")
BQ_PROMPT_TABLE_ID = os.environ.get("BQ_PROMPT_TABLE_ID", "prompt_video_table")

class AnalyzeRequest(BaseModel):
    gcs_uri: Optional[str] = None
    youtube_url: Optional[str] = None

class SearchRequest(BaseModel):
    query: str  # Can be text or image (handled in actual implementation)

@app.get("/")
def read_root():
    return {"status": "ok", "message": "Video Metadata Extractor API is running"}

@app.post("/api/upload")
async def upload_video(file: UploadFile = File(...)):
    """
    Uploads a video to GCS staging bucket.
    """
    if not gcs_client:
        raise HTTPException(status_code=500, detail="GCS Client not initialized")
    
    try:
        bucket = gcs_client.bucket(GCS_BUCKET_NAME)
        blob = bucket.blob(file.filename)
        
        # Upload using upload_from_file for streaming
        blob.upload_from_file(file.file, content_type=file.content_type)
        
        gcs_uri = f"gs://{GCS_BUCKET_NAME}/{file.filename}"
        return {"status": "success", "gcs_uri": gcs_uri, "filename": file.filename}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

def process_video_analysis(request: AnalyzeRequest):
    analyzer = GeminiAnalyzer(BQ_DATASET_ID, BQ_TABLE_ID, gcs_bucket=GCS_BUCKET_NAME)
    file_path = None
    source_type = "local"
    
    try:
        if request.youtube_url:
            source_type = "youtube"
            print(f"Background Job: Processing YouTube video {request.youtube_url}")
        elif request.gcs_uri:
            source_type = "gcs"
            print(f"Background Job: Processing from GCS {request.gcs_uri}")
            
        print(f"Background Job: Running Gemini Analysis for source type: {source_type}")
        analyzer.analyze_video(
            source_type=source_type, 
            gcs_uri=request.gcs_uri, 
            youtube_url=request.youtube_url
        )
        print("Background Job Complete. Metadata stored.")
        
        # Cleanup local downloaded file from temp disk
        if os.path.exists(file_path):
            os.remove(file_path)
            print(f"Cleaned up local temp video: {file_path}")
            
    except Exception as e:
        print(f"Background Job Exception: {e}")

@app.post("/api/analyze")
async def analyze_video(request: AnalyzeRequest, background_tasks: BackgroundTasks):
    """
    Triggers Gemini 3.1 Pro analysis of video or YouTube link.
    Stores breakdown & embeddings in BigQuery.
    """
    if not gcs_client:
        raise HTTPException(status_code=500, detail="GCS client not initialized")
        
    if not request.gcs_uri and not request.youtube_url:
         raise HTTPException(status_code=400, detail="Must provide either gcs_uri or youtube_url")

    background_tasks.add_task(process_video_analysis, request)
    return {"status": "processing", "message": "Analysis started in background"}

@app.post("/api/search")
async def search_assets(request: SearchRequest):
    """
    Search assets using Gemini Embedding 2 via BigQuery Vector Search.
    """
    try:
        analyzer = GeminiAnalyzer(BQ_DATASET_ID, BQ_TABLE_ID, gcs_bucket=GCS_BUCKET_NAME)
        results = analyzer.search(query=request.query)
        
        # Need to cast rows to something JSON serializable if needed
        serializable_results = []
        for res in results:
             serializable_results.append(res)
             
        return {"status": "success", "results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")

@app.post("/api/prompt-upload")
async def prompt_upload(prompt_text: str = Form(...), file: UploadFile = File(...)):
    """
    Uploads a video to GCS under 'genAI_videos' and saves prompt+video embeddings to BQ.
    """
    if not gcs_client:
        raise HTTPException(status_code=500, detail="GCS Client not initialized")
    
    try:
        bucket = gcs_client.bucket(GCS_BUCKET_NAME)
        # Force the genAI_videos prefix
        blob_name = f"genAI_videos/{file.filename}"
        blob = bucket.blob(blob_name)
        
        # Upload using upload_from_file for streaming
        blob.upload_from_file(file.file, content_type=file.content_type)
        gcs_uri = f"gs://{GCS_BUCKET_NAME}/{blob_name}"
        
        # Extract embeddings and save to BigQuery
        analyzer = PromptAnalyzer(BQ_DATASET_ID, BQ_PROMPT_TABLE_ID, gcs_bucket=GCS_BUCKET_NAME)
        result = analyzer.upload_and_process(prompt_text=prompt_text, gcs_video_path=gcs_uri)
        
        return {"status": "success", "gcs_uri": gcs_uri, "record_id": result["id"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PromptUpload failed: {str(e)}")

@app.post("/api/prompt-search")
async def prompt_search(request: SearchRequest):
    """
    Search assets using Gemini Embedding 2 natively mapping video and text.
    """
    try:
        analyzer = PromptAnalyzer(BQ_DATASET_ID, BQ_PROMPT_TABLE_ID, gcs_bucket=GCS_BUCKET_NAME)
        results = analyzer.search(query=request.query)
        return {"status": "success", "results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PromptSearch failed: {str(e)}")


@app.get("/api/stats")
async def get_stats():
    """
    Get stats and metrics for analyzed videos and insights.
    """
    try:
         analyzer = GeminiAnalyzer(BQ_DATASET_ID, BQ_TABLE_ID, gcs_bucket=GCS_BUCKET_NAME)
         stats = analyzer.get_stats()
         return {"status": "success", "stats": stats}
    except Exception as e:
         raise HTTPException(status_code=500, detail=f"Failed to get stats: {str(e)}")

@app.get("/api/assets")
async def list_assets():
    """
    List all uniquely analyzed video assets.
    """
    try:
         analyzer = GeminiAnalyzer(BQ_DATASET_ID, BQ_TABLE_ID, gcs_bucket=GCS_BUCKET_NAME)
         results = analyzer.list_assets()
         return {"status": "success", "assets": results}
    except Exception as e:
         raise HTTPException(status_code=500, detail=f"Failed to list assets: {str(e)}")

@app.get("/api/assets/{video_id:path}")
async def get_asset_detail(video_id: str):
    """
    Get detailed scene breakdown for a specific video asset.
    """
    try:
         analyzer = GeminiAnalyzer(BQ_DATASET_ID, BQ_TABLE_ID, gcs_bucket=GCS_BUCKET_NAME)
         results = analyzer.get_asset_detail(video_id)
         return {"status": "success", "scenes": results}
    except Exception as e:
         raise HTTPException(status_code=500, detail=f"Failed to get asset details: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
