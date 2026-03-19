import os
import time
from typing import List, Optional
from google import genai
from google.genai import types
from pydantic import BaseModel, Field
from google.cloud import bigquery
import sqlite3
import json
import numpy as np

# Pydantic Schemas for Structured JSON Output
class SceneDetail(BaseModel):
    title: str = Field(description="Short, punchy, descriptive title")
    start_timestamp: str = Field(description="MM:SS format e.g., 01:23")
    end_timestamp: str = Field(description="MM:SS format e.g., 01:45")
    category: str = Field(description="e.g., Curiosity Gap / Comedic Beat")
    description: str = Field(description="1-2 sentences explaining what is happening/being said")
    editing_justification: str = Field(description="Why this scene is a strong hook or key moment")
    visuals_camera: str = Field(description="Notes on camera movement and framing")
    audio_cues: str = Field(description="Key dialogue or sound notes")
    pacing: str = Field(description="Energy level or pacing notes")
    repurposing_idea: str = Field(description="Where this clip belongs (e.g., Shorts, TikTok)")
    edit_cut_notes: str = Field(description="Instructions on what to remove, music/SFX to add")

class VideoAnalysis(BaseModel):
    summary: str = Field(description="Complete overall summary of the full video file")
    tags: List[str] = Field(description="List of 5-10 key topics, products, or tags identified")
    scenes: List[SceneDetail] = Field(description="Chronological breakdown of scenes across the video file")

class GeminiAnalyzer:
    def __init__(self, bq_dataset: str, bq_table: str, gcs_bucket: Optional[str] = None):
        # Client Initialization: API Key or Vertex AI Fallback
        self.api_key = os.environ.get("GEMINI_API_KEY")
        self.gcp_project = os.environ.get("GCP_PROJECT_ID")
        
        self.gcs_bucket = gcs_bucket
        self._clients = {}  # Cache clients by location
        
        # Load Model Configurations
        self.model_text = os.environ.get("GEMINI_MODEL_TEXT", "gemini-2.5-pro").strip('"').strip("'")
        self.location_text = os.environ.get("GEMINI_MODEL_TEXT_LOCATION", os.environ.get("GCP_LOCATION", "us-central1")).strip('"').strip("'")
        
        self.model_embed = os.environ.get("GEMINI_MODEL_EMBEDDING", "gemini-embedding-2-preview").strip('"').strip("'")
        self.location_embed = os.environ.get("GEMINI_MODEL_EMBEDDING_LOCATION", os.environ.get("GCP_LOCATION", "us-central1")).strip('"').strip("'")
        
        self.is_vertex_ai = False  # Tracked generally for reporting
        
        self.bq_dataset = bq_dataset
        self.bq_table = bq_table
        
        # Local Fallback Check
        self.use_local_db = False
        if not bq_dataset or bq_dataset in ["your_dataset_id", ""]:
             print("BigQuery Dataset ID not configured. Falling back to Local SQLite database.")
             self.use_local_db = True
             self._init_local_db()
        else:
             try:
                 self.bq_client = bigquery.Client()
             except Exception as e:
                 print(f"Failed to init BQ client: {e}. Falling back to Local SQLite.")
                 self.use_local_db = True
                 self._init_local_db()

    def _get_client(self, location: str):
        """
        Retrieves or initializes a genai.Client instance for the specified location.
        Caches client instances to avoid redundant initializations.
        """
        if location not in self._clients:
             if self.api_key:
                  # print(f"Initializing Gemini Client (API Key).")
                  self._clients[location] = genai.Client(api_key=self.api_key)
             elif self.gcp_project and self.gcp_project not in ["your-gcp-project-id", ""]:
                  # print(f"Initializing Vertex AI Client for project: {self.gcp_project}, location: {location}")
                  self._clients[location] = genai.Client(
                      vertexai=True,
                      project=self.gcp_project,
                      location=location
                  )
                  self.is_vertex_ai = True
             else:
                  # print(f"No explicit Key or Project set. Defaulting to Ambient Auth with location {location}.")
                  self._clients[location] = genai.Client()
        return self._clients[location]

    def _init_local_db(self):
        print("Initializing Local SQLite Database 'local_metadata.db'...")
        self.db_conn = sqlite3.connect("local_metadata.db", check_same_thread=False)
        cursor = self.db_conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS scenes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                video_id TEXT,
                source TEXT,
                timestamp_start TEXT,
                timestamp_end TEXT,
                title TEXT,
                category TEXT,
                description TEXT,
                editing_justification TEXT,
                visuals_camera TEXT,
                audio_cues TEXT,
                pacing TEXT,
                repurposing_idea TEXT,
                edit_cut_notes TEXT,
                summary TEXT,
                tags TEXT,
                embedding_json TEXT
            )
        """)
        self.db_conn.commit()

    def _wait_for_file_ready(self, file_ref):
        """
        Polls the File API until the uploaded video is fully processed and statement ready.
        """
        print(f"Waiting for file {file_ref.name} to complete processing...")
        while file_ref.state.name == "PROCESSING":
             time.sleep(5)
             file_ref = self.client.files.get(name=file_ref.name)
        if file_ref.state.name == "FAILED":
             raise ValueError(f"File processing failed: {file_ref.error.message}")
        print(f"File {file_ref.name} is ready.")
        return file_ref

    def analyze_video(self, file_path: Optional[str] = None, source_type: str = "local", gcs_uri: Optional[str] = None, youtube_url: Optional[str] = None, status_callback=None) -> VideoAnalysis:
        """
        Uploads video (or routes via GCS for Vertex AI), generates scene breakdown, and extracts metadata.
        """
        video_part = None
        file_ref = None # For Gemini File API cleanup
        video_id = os.path.basename(file_path) if file_path else (os.path.basename(gcs_uri) if gcs_uri else (youtube_url if youtube_url else "unknown"))
        
        mime_type = "video/mp4" # Default
        
        if youtube_url:
             print(f"Using YouTube URI directly: {youtube_url}")
             video_part = types.Part.from_uri(file_uri=youtube_url, mime_type=mime_type)
        elif self.is_vertex_ai:
             print("Vertex AI Mode: Resolving file path over GCS bucket requirements.")
             if gcs_uri:
                  video_part = types.Part.from_uri(file_uri=gcs_uri, mime_type=mime_type)
             elif self.gcs_bucket and file_path:
                  if status_callback:
                       status_callback("uploading_gcs", "Uploading video to Google Cloud Storage...")
                  from google.cloud import storage
                  print(f"Uploading file {file_path} to gs://{self.gcs_bucket}...")
                  gcs_client = storage.Client()
                  bucket = gcs_client.bucket(self.gcs_bucket)
                  blob_name = os.path.basename(file_path)
                  blob = bucket.blob(blob_name)
                  
                  blob.upload_from_filename(file_path, content_type=mime_type)
                  gcs_uri = f"gs://{self.gcs_bucket}/{blob_name}"
                  print(f"Uploaded file to {gcs_uri}")
                  
                  video_part = types.Part.from_uri(file_uri=gcs_uri, mime_type=mime_type)
             else:
                  raise ValueError("Must provide either file_path or gcs_uri for Vertex AI")
        elif file_path:
             print(f"Uploading file {file_path} to Gemini File API...")
             file_ref = self.client.files.upload(file=file_path)
             file_ref = self._wait_for_file_ready(file_ref)
             video_part = file_ref
        else:
             raise ValueError("Must provide either file_path, gcs_uri, or youtube_url")

        prompt = """
        Act as an elite Senior Video Editor, Content Strategist, and Post-Production AI Assistant. Your task is to analyze the provided video file in its ENTIRETY, from the very first second (00:00) to the very final frame. 

        Your objective is to extract EVERY scene, shot, or structural beat, chronologically and meticulously. Do not summarize, do not skip the middle portions, and do not stop early. 

        ### 1. WHAT TO LOOK FOR (Scene Categories)
        Identify scenes that fit into the following structural/emotional categories:
        - Curiosity Gap / Suspense (Moments that make the viewer ask, "What happens next?")
        - High-Impact Action (Sudden visual or physical movement)
        - Comedic Beat (Jokes, funny reactions, or awkward silences)
        - Emotional / Profound (Vulnerability, drama, or deep insights)
        - Controversial / Hot Take (Strong opinions or pattern-interrupting statements)
        - Core Information / Narrative Beat (The essential content, explanation, or story beat)
        - Transition / Setup (Setting the stage for the next beat)
        - Any other category you identify.

        ### 2. REQUIRED METADATA
        For every single scene identified, extract the rich metadata fields as defined in the response schema.

        ### 3. STRICT PROCESSING CONSTRAINTS (CRITICAL)
        1. Segment your mental processing and planning. Evaluate the video chronologically to ensure you do not miss ANY scene in the middle or end of the video.
        2. Ensure highly precise timestamps and revalidate it before sending response.
        3. Print the text `[END OF VIDEO REACHED: MM:SS]` at the very bottom of your response to confirm you have successfully analyzed the file to the final second.
        """

        # 2. Generate Content with Structured JSON Schema
        print(f"Running content generation...")
        response = self._get_client(self.location_text).models.generate_content(
            model=self.model_text,
            contents=[video_part, prompt],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=VideoAnalysis,
                temperature=0.2, # Low temperature for more deterministic/factual output
            ),
        )

        # Parse output into Pydantic model
        analysis_data = VideoAnalysis.model_validate_json(response.text)

        # 3. Generate Embeddings for each scene using Gemini Embedding 2
        print(f"Generating scene embeddings with Gemini Embedding 2...")
        for scene in analysis_data.scenes:
            # Generate embedding for the scene description
            embed_response = self._get_client(self.location_embed).models.embed_content(
                model=self.model_embed,
                contents=scene.description
            )
            scene_embedding = embed_response.embeddings[0].values
            
            # Save metadata
            source_val = youtube_url if youtube_url else (gcs_uri if gcs_uri else source_type)
            if self.use_local_db:
                self._save_scene_to_local_db(
                    video_id=video_id,
                    source=source_val,
                    scene=scene,
                    embedding=scene_embedding,
                    summary=analysis_data.summary,
                    tags=analysis_data.tags
                )
            else:
                self._save_scene_to_bq(
                    video_id=video_id,
                    source=source_val,
                    scene=scene,
                    embedding=scene_embedding,
                    summary=analysis_data.summary,
                    tags=analysis_data.tags
                )

        # 4. Clean up uploaded file from File API
        if file_ref:
             print(f"Cleaning up file {file_ref.name} from File API...")
             self.client.files.delete(name=file_ref.name)

        return analysis_data

    def search(self, query: str) -> List[dict]:
        """
        Embeds the query and searches BigQuery using VECTOR_SEARCH.
        """
        print(f"Embedding search query: {query[:50]}...")
        
        contents_input = query
        # Support Base64 image search natively
        if isinstance(query, str) and query.startswith("data:image/"):
             try:
                 import base64
                 header, encoded = query.split(",", 1)
                 mime_type = header.split(";")[0].split(":")[1]
                 image_data = base64.b64decode(encoded)
                 print(f"Detected Base64 image search with mime_type {mime_type}")
                 contents_input = types.Part.from_bytes(data=image_data, mime_type=mime_type)
             except Exception as e:
                 print(f"Error decoding base64 image query: {e}")
                 contents_input = query

        embed_response = self._get_client(self.location_embed).models.embed_content(
            model=self.model_embed,
            contents=contents_input
        )
        query_embedding = embed_response.embeddings[0].values
        
        # Local fallback search
        if self.use_local_db:
             return self._search_local_db(query_embedding)

        # BQ Vector Search Query
        table_ref = f"{self.bq_client.project}.{self.bq_dataset}.{self.bq_table}"
        
        query_job = self.bq_client.query(
            f"""
            SELECT base.video_id, base.source, base.timestamp_start, base.timestamp_end, base.title, base.category,
             base.description, base.editing_justification, base.visuals_camera, base.audio_cues, base.pacing,
             base.repurposing_idea, base.edit_cut_notes, base.summary, base.tags, distance FROM VECTOR_SEARCH(
               TABLE `{table_ref}`,
               'embedding',
               (SELECT @query_embedding AS embedding),
               top_k => 5
            )
            """,
            job_config=bigquery.QueryJobConfig(
                query_parameters=[
                    bigquery.ArrayQueryParameter("query_embedding", "FLOAT64", query_embedding)
                ]
            )
        )
        print(query_job)
        results = []
        try:
          for row in query_job:
               r = dict(row)
               proposed_url = ""
               source = r.get("source")
               if source and source.startswith("gs://"):
                    proposed_url = self._generate_signed_url(source)
               elif source == "gcs" and self.gcs_bucket:
                    constructed_source = f"gs://{self.gcs_bucket}/{r.get('video_id')}"
                    proposed_url = self._generate_signed_url(constructed_source)
               else:
                    proposed_url = source if source else ""
               r["video_url"] = proposed_url
               results.append(r)
        except Exception as e:
             print(f"Error searching BigQuery: {e}")
        return results

    def _save_scene_to_bq(self, video_id: str, source: str, scene: SceneDetail, embedding: List[float], summary: str, tags: List[str]):
        """
        Saves individual scene metadata and embedding list into BigQuery table.
        """
        table_ref = f"{self.bq_client.project}.{self.bq_dataset}.{self.bq_table}"
        
        row_to_insert = [
            {
                "video_id": video_id,
                "source": source,
                "timestamp_start": scene.start_timestamp,
                "timestamp_end": scene.end_timestamp,
                "title": scene.title,
                "category": scene.category,
                "description": scene.description,
                "editing_justification": scene.editing_justification,
                "visuals_camera": scene.visuals_camera,
                "audio_cues": scene.audio_cues,
                "pacing": scene.pacing,
                "repurposing_idea": scene.repurposing_idea,
                "edit_cut_notes": scene.edit_cut_notes,
                "summary": summary,
                "tags": ",".join(tags),
                "embedding": embedding
            }
         ]
        
        try:
             errors = self.bq_client.insert_rows_json(table_ref, row_to_insert)
             if errors:
                  print(f"BigQuery Insert Errors on row: {errors}")
             else:
                  print(f"Row inserted into BigQuery for scene {scene.start_timestamp}-{scene.end_timestamp}")
        except Exception as e:
             print(f"BigQuery Insert Exception: {e}")

    def _save_scene_to_local_db(self, video_id: str, source: str, scene: SceneDetail, embedding: List[float], summary: str, tags: List[str]):
        """
        Saves individual scene metadata and embedding list into Local SQLite table.
        """
        try:
             cursor = self.db_conn.cursor()
             cursor.execute("""
                 INSERT INTO scenes (video_id, source, timestamp_start, timestamp_end, title, category, description, editing_justification, visuals_camera, audio_cues, pacing, repurposing_idea, edit_cut_notes, summary, tags, embedding_json)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             """, (
                 video_id,
                 source,
                 scene.start_timestamp,
                 scene.end_timestamp,
                 scene.title,
                 scene.category,
                 scene.description,
                 scene.editing_justification,
                 scene.visuals_camera,
                 scene.audio_cues,
                 scene.pacing,
                 scene.repurposing_idea,
                  scene.edit_cut_notes,
                  summary,
                  ",".join(tags),
                  json.dumps(embedding)
             ))
             self.db_conn.commit()
             print(f"Row inserted into Local SQLite for scene {scene.start_timestamp}-{scene.end_timestamp}")
        except Exception as e:
             print(f"Local DB Insert Exception: {e}")

    def _search_local_db(self, query_embedding: List[float]) -> List[dict]:
        """
        Searches Local SQLite table using manual Cosine Similarity via Numpy.
        """
        try:
             cursor = self.db_conn.cursor()
             cursor.execute("SELECT video_id, source, timestamp_start, timestamp_end, title, category, description, editing_justification, visuals_camera, audio_cues, pacing, repurposing_idea, edit_cut_notes, summary, tags, embedding_json FROM scenes")
             rows = cursor.fetchall()
             
             results = []
             query_vec = np.array(query_embedding)
             
             for row in rows:
                  video_id, source, t_start, t_end, title, cat, desc, edit_just, vis_cam, aud_cue, pac, repur_idea, edit_notes, summ, tags, embed_str = row
                  if not embed_str:
                       continue
                  
                  try:
                       saved_vec = np.array(json.loads(embed_str))
                  except Exception:
                       continue
                  
                  # Calculate Cosine Similarity
                  dot_product = np.dot(query_vec, saved_vec)
                  norm_q = np.linalg.norm(query_vec)
                  norm_s = np.linalg.norm(saved_vec)
                  similarity = dot_product / (norm_q * norm_s) if norm_q * norm_s > 0 else 0
                  
                  proposed_url = ""
                  if source and source.startswith("gs://"):
                       proposed_url = self._generate_signed_url(source)
                  elif source == "gcs" and self.gcs_bucket:
                       proposed_url = self._generate_signed_url(f"gs://{self.gcs_bucket}/{video_id}")
                  else:
                       proposed_url = source if source else ""
                       
                  results.append({
                       "video_id": video_id,
                        "source": source,
                        "video_url": proposed_url,
                       "timestamp_start": t_start,
                       "timestamp_end": t_end,
                       "title": title,
                       "category": cat,
                       "description": desc,
                       "editing_justification": edit_just,
                       "visuals_camera": vis_cam,
                       "audio_cues": aud_cue,
                       "pacing": pac,
                       "repurposing_idea": repur_idea,
                       "edit_cut_notes": edit_notes,
                       "summary": summ,
                       "tags": tags.split(",") if tags else [],
                       "similarity": float(similarity)
                  })
                  
             # Sort by similarity descending
             results.sort(key=lambda x: x.get("similarity", 0), reverse=True)
             print(f"Local search found {len(results)} total scenes. Returning top 5.")
             return results[:5]
        except Exception as e:
             print(f"Local DB Search Exception: {e}")
             return []

    def list_assets(self) -> List[dict]:
        """
        Lists unique analyzed video assets and their summaries from Local DB or BigQuery.
        """
        if self.use_local_db:
             try:
                 cursor = self.db_conn.cursor()
                 cursor.execute("SELECT video_id, summary, GROUP_CONCAT(tags) as tags FROM scenes GROUP BY video_id, summary")
                 rows = cursor.fetchall()
                 return [{"video_id": r[0], "summary": r[1], "tags": list(set(r[2].split(","))) if r[2] else []} for r in rows]
             except Exception as e:
                 print(f"Local DB List Assets Exception: {e}")
                 return []
        else:
             try:
                 table_ref = f"{self.bq_client.project}.{self.bq_dataset}.{self.bq_table}"
                 query = f"SELECT video_id, summary, STRING_AGG(tags) as tags FROM `{table_ref}` GROUP BY video_id, summary"
                 query_job = self.bq_client.query(query)
                 results = []
                 for row in query_job:
                      r = dict(row)
                      r["tags"] = list(set(r["tags"].split(","))) if r["tags"] else []
                      results.append(r)
                 return results
             except Exception as e:
                 print(f"BigQuery List Assets Exception: {e}")
                 return []

    def get_asset_detail(self, video_id: str) -> List[dict]:
        """
        Retrieves all scenes and detailed metadata for a specific video_id.
        """
        if self.use_local_db:
             try:
                 cursor = self.db_conn.cursor()
                 cursor.execute("SELECT video_id, source, timestamp_start, timestamp_end, title, category, description, editing_justification, visuals_camera, audio_cues, pacing, repurposing_idea, edit_cut_notes, summary, tags, embedding_json FROM scenes WHERE video_id = ?", (video_id,))
                 rows = cursor.fetchall()
                 results = []
                 for row in rows:
                      video_id, source, t_start, t_end, title, cat, desc, edit_just, vis_cam, aud_cue, pac, repur_idea, edit_notes, summ, tags, embed_str = row
                      proposed_url = ""
                      if source and source.startswith("gs://"):
                           proposed_url = self._generate_signed_url(source)
                      elif source == "gcs" and self.gcs_bucket:
                           proposed_url = self._generate_signed_url(f"gs://{self.gcs_bucket}/{video_id}")
                      else:
                           proposed_url = source if source else ""
                      
                      results.append({
                           "video_id": video_id,
                            "source": source,
                            "video_url": proposed_url,
                           "timestamp_start": t_start,
                           "timestamp_end": t_end,
                           "title": title,
                           "category": cat,
                           "description": desc,
                           "editing_justification": edit_just,
                           "visuals_camera": vis_cam,
                           "audio_cues": aud_cue,
                           "pacing": pac,
                           "repurposing_idea": repur_idea,
                           "edit_cut_notes": edit_notes,
                           "summary": summ,
                           "tags": tags.split(",") if tags else []
                      })
                 return results
             except Exception as e:
                 print(f"Local DB Get Asset Detail Exception: {e}")
                 return []
        else:
             try:
                 table_ref = f"{self.bq_client.project}.{self.bq_dataset}.{self.bq_table}"
                 query = f"SELECT * FROM `{table_ref}` WHERE video_id = @video_id"
                 query_job = self.bq_client.query(
                     query,
                     job_config=bigquery.QueryJobConfig(
                         query_parameters=[
                             bigquery.ScalarQueryParameter("video_id", "STRING", video_id)
                         ]
                     )
                 )
                 results = []
                 for row in query_job:
                      r = dict(row)
                      r["tags"] = r["tags"].split(",") if r["tags"] else []
                      if "source" in r and r["source"] and r["source"].startswith("gs://"):
                           r["video_url"] = self._generate_signed_url(r["source"])
                      else:
                           r["video_url"] = r.get("source", "") if r.get("source") else ""
                      results.append(r)
                 return results
             except Exception as e:
                 print(f"BigQuery Get Asset Detail Exception: {e}")
                 return []
    def get_stats(self) -> dict:
        """
        Retrieves stats and metrics from the database (Local SQLite or BigQuery).
        """
        def parse_to_seconds(ts):
             if not ts: return 0
             try:
                  parts = ts.split(':')
                  if len(parts) == 2:
                       return int(parts[0]) * 60 + int(parts[1])
                  elif len(parts) == 3:
                       return int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
                  return int(parts[0])
             except:
                  return 0

        if self.use_local_db:
             try:
                 cursor = self.db_conn.cursor()
                 
                 # Total Assets
                 cursor.execute("SELECT COUNT(DISTINCT video_id) FROM scenes")
                 total_assets = cursor.fetchone()[0] or 0
                 
                 # Total Scenes
                 cursor.execute("SELECT COUNT(*) FROM scenes")
                 total_scenes = cursor.fetchone()[0] or 0
                 
                 # Average Scenes per Asset
                 average_scenes_per_asset = round(total_scenes / total_assets, 1) if total_assets > 0 else 0
                 
                 # Category Breakdown
                 cursor.execute("SELECT category, COUNT(*) FROM scenes WHERE category IS NOT NULL AND category != '' GROUP BY category")
                 category_rows = cursor.fetchall()
                 category_breakdown = {r[0]: r[1] for r in category_rows}
                 
                 # Source Breakdown
                 cursor.execute("SELECT source, COUNT(DISTINCT video_id) FROM scenes GROUP BY source")
                 source_rows = cursor.fetchall()
                 source_breakdown = {}
                 for r in source_rows:
                      src = r[0].lower() if r[0] else ""
                      if src.startswith("http") or "youtube" in src:
                           source_breakdown["YouTube"] = source_breakdown.get("YouTube", 0) + r[1]
                      elif src.startswith("gs://") or src == "gcs":
                           source_breakdown["GCS"] = source_breakdown.get("GCS", 0) + r[1]
                      else:
                           source_breakdown["Local"] = source_breakdown.get("Local", 0) + r[1]
                 
                 # Duration calculation
                 cursor.execute("SELECT timestamp_start, timestamp_end FROM scenes")
                 duration_rows = cursor.fetchall()
                 total_duration_seconds = 0
                 for r in duration_rows:
                      start = parse_to_seconds(r[0])
                      end = parse_to_seconds(r[1])
                      if start or end:
                           total_duration_seconds += max(0, end - start)
                           
                 avg_scene_duration_seconds = round(total_duration_seconds / total_scenes) if total_scenes > 0 else 0
                 
                 # Tags frequency
                 cursor.execute("SELECT tags FROM scenes WHERE tags IS NOT NULL AND tags != ''")
                 tags_rows = cursor.fetchall()
                 tags_list = []
                 for r in tags_rows:
                      if r[0]:
                           item_tags = [t.strip() for t in r[0].split(",") if t.strip()]
                           tags_list.extend(item_tags)
                 
                 from collections import Counter
                 tag_counts = Counter(tags_list)
                 top_tags = dict(tag_counts.most_common(10))
                 
                 return {
                      "total_assets": total_assets,
                      "total_scenes": total_scenes,
                      "average_scenes_per_asset": average_scenes_per_asset,
                      "category_breakdown": category_breakdown,
                      "source_breakdown": source_breakdown,
                      "total_duration_seconds": total_duration_seconds,
                      "avg_scene_duration_seconds": avg_scene_duration_seconds,
                      "top_tags": top_tags,
                      "total_prompt_videos": 0
                 }
                 
             except Exception as e:
                 print(f"Local DB Get Stats Exception: {e}")
                 return {}
        else:
             try:
                 table_ref = f"{self.bq_client.project}.{self.bq_dataset}.{self.bq_table}"
                 
                 # Total Assets
                 query_assets = f"SELECT COUNT(DISTINCT video_id) FROM `{table_ref}`"
                 assets_result = self.bq_client.query(query_assets).result()
                 total_assets = list(assets_result)[0][0] if assets_result else 0
                 
                 # Total Scenes
                 query_scenes = f"SELECT COUNT(*) FROM `{table_ref}`"
                 scenes_result = self.bq_client.query(query_scenes).result()
                 total_scenes = list(scenes_result)[0][0] if scenes_result else 0
                 
                 # Average Scenes per Asset
                 average_scenes_per_asset = round(total_scenes / total_assets, 1) if total_assets > 0 else 0
                 
                 # Category Breakdown
                 query_category = f"SELECT category, COUNT(*) as count FROM `{table_ref}` WHERE category IS NOT NULL AND category != '' GROUP BY category"
                 category_rows = self.bq_client.query(query_category)
                 category_breakdown = {row.category: row.count for row in category_rows}
                 
                 # Source Breakdown
                 query_sources = f"SELECT source, COUNT(DISTINCT video_id) as count FROM `{table_ref}` GROUP BY source"
                 source_rows = self.bq_client.query(query_sources)
                 source_breakdown = {}
                 for row in source_rows:
                      src = row.source.lower() if row.source else ""
                      if src.startswith("http") or "youtube" in src:
                           source_breakdown["YouTube"] = source_breakdown.get("YouTube", 0) + row.count
                      elif src.startswith("gs://") or src == "gcs":
                           source_breakdown["GCS"] = source_breakdown.get("GCS", 0) + row.count
                      else:
                           source_breakdown["Local"] = source_breakdown.get("Local", 0) + row.count
                           
                 # Duration calculation
                 query_durations = f"SELECT timestamp_start, timestamp_end FROM `{table_ref}`"
                 duration_rows = self.bq_client.query(query_durations)
                 total_duration_seconds = 0
                 for row in duration_rows:
                      start = parse_to_seconds(row.timestamp_start)
                      end = parse_to_seconds(row.timestamp_end)
                      if start or end:
                           total_duration_seconds += max(0, end - start)
                           
                 avg_scene_duration_seconds = round(total_duration_seconds / total_scenes) if total_scenes > 0 else 0
                 
                 # Tags
                 query_tags = f"SELECT tags FROM `{table_ref}` WHERE tags IS NOT NULL AND tags != ''"
                 tags_rows = self.bq_client.query(query_tags)
                 tags_list = []
                 for row in tags_rows:
                      if row.tags:
                           item_tags = [t.strip() for t in row.tags.split(",") if t.strip()]
                           tags_list.extend(item_tags)
                           
                 from collections import Counter
                 tag_counts = Counter(tags_list)
                 top_tags = dict(tag_counts.most_common(10))
                 
                 # Prompt Videos count
                 prompt_table_id = os.environ.get("BQ_PROMPT_TABLE_ID", "prompt_video_table")
                 prompt_table_ref = f"{self.bq_client.project}.{self.bq_dataset}.{prompt_table_id}"
                 try:
                     query_prompt = f"SELECT COUNT(*) FROM `{prompt_table_ref}`"
                     prompt_result = self.bq_client.query(query_prompt).result()
                     total_prompt_videos = list(prompt_result)[0][0] if prompt_result else 0
                 except Exception:
                     total_prompt_videos = 0

                 return {
                      "total_assets": total_assets,
                      "total_scenes": total_scenes,
                      "average_scenes_per_asset": average_scenes_per_asset,
                      "category_breakdown": category_breakdown,
                      "source_breakdown": source_breakdown,
                      "total_duration_seconds": total_duration_seconds,
                      "avg_scene_duration_seconds": avg_scene_duration_seconds,
                      "top_tags": top_tags,
                      "total_prompt_videos": total_prompt_videos
                 }
             except Exception as e:
                 print(f"BigQuery Get Stats Exception: {e}")
                 return {}

    def _generate_signed_url(self, gcs_uri: str) -> str:
        if not gcs_uri.startswith("gs://"):
             return ""
        try:
             from google.cloud import storage
             import datetime
             client = storage.Client()
             path = gcs_uri.replace("gs://", "")
             path = gcs_uri.replace("gs://", "")
             return f"https://storage.mtls.cloud.google.com/{path}"
        except Exception as e:
             print(f"Signed URL Generation Error: {e}")
             # Fallback to authenticates cookies url
             path = gcs_uri.replace("gs://", "")
             return f"https://storage.mtls.cloud.google.com/{path}"

if __name__ == "__main__":
    # Quick visual check mockup
    print("Analyzer loaded. Ready for integration.")
