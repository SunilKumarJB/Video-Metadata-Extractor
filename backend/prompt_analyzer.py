import os
import uuid
from typing import List, Optional
from google import genai
from google.genai import types
from google.cloud import bigquery
import datetime

class PromptAnalyzer:
    def __init__(self, bq_dataset: str, bq_table: str, gcs_bucket: Optional[str] = None):
        self.api_key = os.environ.get("GEMINI_API_KEY")
        self.gcp_project = os.environ.get("GCP_PROJECT_ID")
        self.gcs_bucket = gcs_bucket
        
        # Load Model Configurations
        self.model_embed = os.environ.get("GEMINI_MODEL_EMBEDDING", "gemini-embedding-2-preview").strip('"').strip("'")
        self.location_embed = os.environ.get("GEMINI_MODEL_EMBEDDING_LOCATION", os.environ.get("GCP_LOCATION", "us-central1")).strip('"').strip("'")
        
        self.is_vertex_ai = False
        
        self.bq_dataset = bq_dataset
        self.bq_table = bq_table
        
        try:
             self.bq_client = bigquery.Client()
        except Exception as e:
             print(f"Failed to init BQ client: {e}.")
             self.bq_client = None

        self.client_cache = None

    def _get_client(self):
         if not self.client_cache:
              if self.api_key:
                   self.client_cache = genai.Client(api_key=self.api_key)
              elif self.gcp_project and self.gcp_project not in ["your-gcp-project-id", ""]:
                   self.client_cache = genai.Client(
                       vertexai=True,
                       project=self.gcp_project,
                       location=self.location_embed
                   )
                   self.is_vertex_ai = True
              else:
                   self.client_cache = genai.Client()
         return self.client_cache

    def upload_and_process(self, prompt_text: str, gcs_video_path: str):
         print(f"Processing Prompt and Video upload: {gcs_video_path}")
         
         client = self._get_client()
         
         # Embed the prompt text
         print(f"Generating embedding for prompt text...")
         prompt_embed_response = client.models.embed_content(
              model=self.model_embed,
              contents=prompt_text
         )
         prompt_embedding = prompt_embed_response.embeddings[0].values
         
         # Embed the video file directly
         # Depending on if we use Vertex AI or generic API, handle video appropriately
         print(f"Generating embedding for video file at {gcs_video_path}")
         video_part = None
         if self.is_vertex_ai:
              video_part = types.Part.from_uri(file_uri=gcs_video_path, mime_type="video/mp4")
         else:
              # For ambient or API key, file API is required unless it allows GCS URI
              # Here we assume the bucket is accessible natively via URI for Vertex AI,
              # For normal Gemini API we might have to use local file, but the file is already uploaded to GCS.
              # Assuming Vertex AI layout for most robust enterprise behavior:
              video_part = types.Part.from_uri(file_uri=gcs_video_path, mime_type="video/mp4")
              
         try:
              video_embed_response = client.models.embed_content(
                   model=self.model_embed,
                   contents=video_part
              )
              video_embedding = video_embed_response.embeddings[0].values
         except Exception as e:
              print(f"Failed to generate video embedding: {e}")
              raise e

         record_id = str(uuid.uuid4())
         self._save_to_bq(
              record_id=record_id,
              gcs_video_path=gcs_video_path,
              prompt_text=prompt_text,
              video_embedding=video_embedding,
              prompt_embedding=prompt_embedding
         )
         return {"id": record_id, "status": "success"}

    def _save_to_bq(self, record_id: str, gcs_video_path: str, prompt_text: str, video_embedding: list, prompt_embedding: list):
         if not self.bq_client:
              print("No BQ client available to save Prompt and Video.")
              return
              
         table_ref = f"{self.bq_client.project}.{self.bq_dataset}.{self.bq_table}"
         timestamp = datetime.datetime.utcnow().isoformat()
         
         row_to_insert = [
              {
                   "id": record_id,
                   "gcs_video_path": gcs_video_path,
                   "prompt_text": prompt_text,
                   "video_embedding": video_embedding,
                   "prompt_embedding": prompt_embedding,
                   "created_at": timestamp
              }
         ]
         
         try:
              errors = self.bq_client.insert_rows_json(table_ref, row_to_insert)
              if errors:
                   print(f"BigQuery Insert Errors: {errors}")
              else:
                   print(f"Successfully inserted prompt & video record {record_id} into BigQuery.")
         except Exception as e:
              print(f"BigQuery Insert Exception: {e}")

    def search(self, query: str) -> list:
         """
         Vector search the prompt_video_table using text or image query.
         """
         print(f"Embedding search query...")
         client = self._get_client()
         
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

         embed_response = client.models.embed_content(
              model=self.model_embed,
              contents=contents_input
         )
         query_embedding = embed_response.embeddings[0].values
         
         if not self.bq_client:
              return []
              
         table_ref = f"{self.bq_client.project}.{self.bq_dataset}.{self.bq_table}"
         
         # We search against both video and prompt embeddings and score the best match
         # using UNION ALL with two VECTOR_SEARCH calls, getting the minimum distance for duplicates.
         query_str = f"""
         WITH matches AS (
             SELECT base.id, base.gcs_video_path, base.prompt_text, base.created_at, distance
             FROM VECTOR_SEARCH(
                 TABLE `{table_ref}`,
                 'video_embedding',
                 (SELECT @query_embedding AS video_embedding),
                 top_k => 3,
                 distance_type => 'COSINE'
             )
             UNION ALL
             SELECT base.id, base.gcs_video_path, base.prompt_text, base.created_at, distance
             FROM VECTOR_SEARCH(
                 TABLE `{table_ref}`,
                 'prompt_embedding',
                 (SELECT @query_embedding AS prompt_embedding),
                 top_k => 3,
                 distance_type => 'COSINE'
             )
         )
         SELECT id, ANY_VALUE(gcs_video_path) as gcs_video_path, ANY_VALUE(prompt_text) as prompt_text, ANY_VALUE(created_at) as created_at, MIN(distance) as best_distance
         FROM matches
         GROUP BY id
         ORDER BY best_distance ASC
         LIMIT 3
         """
         
         query_job = self.bq_client.query(
              query_str,
              job_config=bigquery.QueryJobConfig(
                   query_parameters=[
                        bigquery.ArrayQueryParameter("query_embedding", "FLOAT64", query_embedding)
                   ]
              )
         )
         
         results = []
         try:
              for row in query_job:
                   r = dict(row)
                   r["video_url"] = self._generate_signed_url(r.get("gcs_video_path", ""))
                   results.append(r)
         except Exception as e:
              print(f"Error searching BigQuery prompt table: {e}")
         return results

    def _generate_signed_url(self, gcs_uri: str) -> str:
         if not gcs_uri.startswith("gs://"):
              return ""
         try:
              path = gcs_uri.replace("gs://", "")
              return f"https://storage.mtls.cloud.google.com/{path}"
         except Exception as e:
              print(f"URL Generation Error: {e}")
              path = gcs_uri.replace("gs://", "")
              return f"https://storage.mtls.cloud.google.com/{path}"

if __name__ == "__main__":
    print("PromptAnalyzer loaded.")
