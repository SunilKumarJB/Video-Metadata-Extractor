#!/bin/bash

# Exit on any failure
set -e

# Load environment variables
if [ -f .env ]; then
  echo "Loading variables from .env..."
  export $(grep -v '^#' .env | xargs)
fi

PROJECT_ID=${GCP_PROJECT_ID}
LOCATION=${GCP_LOCATION:-"us-central1"}
BACKEND_IMAGE="gcr.io/$PROJECT_ID/metadata-extractor-backend"
FRONTEND_IMAGE="gcr.io/$PROJECT_ID/metadata-extractor-frontend"

if [ -z "$PROJECT_ID" ]; then
  echo "Error: GCP_PROJECT_ID is not set in .env or environment."
  exit 1
fi

echo "=========================================="
echo "🚀 Setting up BigQuery Database..."
echo "=========================================="
if ! command -v bq &> /dev/null; then
  echo "'bq' CLI not found. Attempting install via gcloud..."
  gcloud components install bq --quiet || true
fi

if command -v bq &> /dev/null; then
  # Fallbacks for variables
  DATASET=${BQ_DATASET_ID:-"metadata_dataset"}
  TABLE=${BQ_TABLE_ID:-"metadata_table"}

  # Verify Dataset
  echo "Verifying BigQuery Dataset: $DATASET..."
  if ! bq show "$PROJECT_ID:$DATASET" > /dev/null 2>&1; then
    echo "Creating dataset $DATASET..."
    bq mk --location="$LOCATION" --dataset "$PROJECT_ID:$DATASET"
  else
    echo "Dataset $DATASET already exists."
  fi

  # Verify Table
  echo "Verifying BigQuery Table: $TABLE..."
  if ! bq show "$PROJECT_ID:$DATASET.$TABLE" > /dev/null 2>&1; then
    echo "Creating table $TABLE..."
    bq mk --table "$PROJECT_ID:$DATASET.$TABLE" backend/schema.json
  else
    echo "Table $TABLE already exists."
  fi

  echo "Verifying Vector Index..."
  bq query --use_legacy_sql=false "CREATE VECTOR INDEX IF NOT EXISTS \`${TABLE}_embedding_index\` ON \`${PROJECT_ID}.${DATASET}.${TABLE}\`(embedding) OPTIONS(distance_type='COSINE', index_type='IVF')" > /dev/null 2>&1 || echo "Warning: Vector index step skipped (might require index row quotas)."
else
  echo "Warning: 'bq' CLI tool not found. Skipping local BigQuery setup verification."
fi

echo "=========================================="
echo "🚀 Building Backend Container..."
echo "=========================================="
gcloud builds submit backend/ --tag $BACKEND_IMAGE --project $PROJECT_ID

echo "=========================================="
echo "🚀 Deploying Backend to Cloud Run..."
echo "=========================================="
BACKEND_URL=$(gcloud run deploy metadata-extractor-backend \
  --image $BACKEND_IMAGE \
  --platform managed \
  --region $LOCATION \
  --allow-unauthenticated \
  --set-env-vars "GCP_PROJECT_ID=$PROJECT_ID,GCP_LOCATION=$LOCATION,BQ_DATASET_ID=$BQ_DATASET_ID,BQ_TABLE_ID=$BQ_TABLE_ID,BQ_PROMPT_TABLE_ID=$BQ_PROMPT_TABLE_ID,GCS_BUCKET_NAME=$GCS_BUCKET_NAME,GEMINI_API_KEY=$GEMINI_API_KEY" \
  --project $PROJECT_ID \
  --format 'value(status.url)')

echo "✅ Backend deployed at: $BACKEND_URL"

echo "=========================================="
echo "🚀 Building Frontend Container..."
echo "=========================================="
# Pass the Backend URL to Next.js build args
gcloud builds submit frontend/ \
  --config frontend/cloudbuild.yaml \
  --substitutions _NEXT_PUBLIC_API_URL=$BACKEND_URL,_IMAGE_NAME=$FRONTEND_IMAGE \
  --project $PROJECT_ID

echo "=========================================="
echo "🚀 Deploying Frontend to Cloud Run..."
echo "=========================================="
gcloud run deploy metadata-extractor-frontend \
  --image $FRONTEND_IMAGE \
  --platform managed \
  --region $LOCATION \
  --allow-unauthenticated \
  --project $PROJECT_ID

echo "=========================================="
echo "🎉 Deployment Finished Successfully!"
echo "=========================================="
