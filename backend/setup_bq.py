import os
from google.cloud import bigquery
from google.api_core.exceptions import NotFound

def setup_bigquery():
    client = bigquery.Client()
    
    project_id = client.project
    dataset_id = os.environ.get("BQ_DATASET_ID", "metadata_dataset")
    table_id = os.environ.get("BQ_TABLE_ID", "metadata_table")
    
    dataset_ref = f"{project_id}.{dataset_id}"
    table_ref = f"{dataset_ref}.{table_id}"

    # 1. Create Dataset if not exists
    try:
        client.get_dataset(dataset_ref)
        print(f"Dataset {dataset_id} already exists.")
    except NotFound:
        print(f"Creating dataset {dataset_id}...")
        dataset = bigquery.Dataset(dataset_ref)
        dataset.location = "US"  # Modify as needed
        client.create_dataset(dataset, timeout=30)
        print(f"Dataset {dataset_id} created.")
    except Exception as e:
        print(f"Warning: Failed to verify or create dataset {dataset_id}: {e}")

    # 2. Create Metadata Table if not exists
    schema = [
        bigquery.SchemaField("video_id", "STRING", mode="REQUIRED"),
        bigquery.SchemaField("source", "STRING", mode="REQUIRED"),
        bigquery.SchemaField("timestamp_start", "STRING", mode="REQUIRED"),
        bigquery.SchemaField("timestamp_end", "STRING", mode="REQUIRED"),
        bigquery.SchemaField("title", "STRING", mode="NULLABLE"),
        bigquery.SchemaField("category", "STRING", mode="NULLABLE"),
        bigquery.SchemaField("description", "STRING", mode="NULLABLE"),
        bigquery.SchemaField("editing_justification", "STRING", mode="NULLABLE"),
        bigquery.SchemaField("visuals_camera", "STRING", mode="NULLABLE"),
        bigquery.SchemaField("audio_cues", "STRING", mode="NULLABLE"),
        bigquery.SchemaField("pacing", "STRING", mode="NULLABLE"),
        bigquery.SchemaField("repurposing_idea", "STRING", mode="NULLABLE"),
        bigquery.SchemaField("edit_cut_notes", "STRING", mode="NULLABLE"),
        bigquery.SchemaField("summary", "STRING", mode="NULLABLE"),
        bigquery.SchemaField("tags", "STRING", mode="NULLABLE"),  # Comma separated
        bigquery.SchemaField("embedding", "FLOAT64", mode="REPEATED") # ARRAY<FLOAT64>
    ]

    try:
        client.get_table(table_ref)
        print(f"Table {table_id} already exists.")
    except NotFound:
        print(f"Creating table {table_id}...")
        table = bigquery.Table(table_ref, schema=schema)
        client.create_table(table)
        print(f"Table {table_id} created.")
    except Exception as e:
        print(f"Warning: Failed to verify or create table {table_id}: {e}")

    # 3. Create Vector Index for Metadata Table
    print(f"Ensuring Vector Index exists for 'embedding' column in {table_id}...")
    index_query = f"""
    CREATE VECTOR INDEX IF NOT EXISTS `{table_id}_embedding_index`
    ON `{table_ref}`(embedding)
    OPTIONS(
      distance_type='COSINE',
      index_type='IVF'
    )
    """
    try:
        query_job = client.query(index_query)
        query_job.result() # Wait for completion
        print(f"Vector Index `{table_id}_embedding_index` is ready.")
    except Exception as e:
        print(f"Warning: Failed to create Vector Index for {table_id}: {e}")

    # 4. Create Prompt Video Table Table if not exists
    prompt_table_id = os.environ.get("BQ_PROMPT_TABLE_ID", "prompt_video_table")
    prompt_table_ref = f"{dataset_ref}.{prompt_table_id}"
    prompt_schema = [
        bigquery.SchemaField("id", "STRING", mode="REQUIRED"),
        bigquery.SchemaField("gcs_video_path", "STRING", mode="REQUIRED"),
        bigquery.SchemaField("prompt_text", "STRING", mode="REQUIRED"),
        bigquery.SchemaField("video_embedding", "FLOAT64", mode="REPEATED"), # ARRAY<FLOAT64>
        bigquery.SchemaField("prompt_embedding", "FLOAT64", mode="REPEATED"), # ARRAY<FLOAT64>
        bigquery.SchemaField("created_at", "TIMESTAMP", mode="NULLABLE")
    ]

    try:
        client.get_table(prompt_table_ref)
        print(f"Table {prompt_table_id} already exists.")
    except NotFound:
        print(f"Creating table {prompt_table_id}...")
        prompt_table = bigquery.Table(prompt_table_ref, schema=prompt_schema)
        client.create_table(prompt_table)
        print(f"Table {prompt_table_id} created.")
    except Exception as e:
        print(f"Warning: Failed to verify or create table {prompt_table_id}: {e}")

    # 5. Create Vector Indexes for prompt_video_table
    for col in ["video_embedding", "prompt_embedding"]:
         print(f"Ensuring Vector Index exists for '{col}' column in {prompt_table_id}...")
         index_query = f"""
         CREATE VECTOR INDEX IF NOT EXISTS `{prompt_table_id}_{col}_index`
         ON `{prompt_table_ref}`({col})
         OPTIONS(
           distance_type='COSINE',
           index_type='IVF'
         )
         """
         try:
             query_job = client.query(index_query)
             query_job.result() # Wait for completion
             print(f"Vector Index `{prompt_table_id}_{col}_index` is ready.")
         except Exception as e:
             print(f"Warning: Failed to create Vector Index for {col}: {e}")

if __name__ == "__main__":
    if not os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
        print("Warning: GOOGLE_APPLICATION_CREDENTIALS not set. Assuming ambient auth.")
    setup_bigquery()
