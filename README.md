# 🎬 Video Metadata Extractor

An advanced AI-powered insights engine to **analyze**, **extract rich metadata**, and **semantically search** video scenes sequentially leveraging Gemini and Google Cloud architectures.

---

## 🚀 Overview

This repository enables modular workflow routing dividing schedules between visual NextJS aggregates and scalable FastAPI compute wrappers evaluates:
- **Precision Scene Breakdowns**: Automatic timestamp thresholds identifying descriptive action plans sequentially.
- **Multimodal Video & Prompt Embeddings**: Upload videos with prompts directly into `prompt_video_table` in BigQuery and search them using Gemini 2 Multimodal Vector Embeddings (Text & Visual).
- **Support for Youtube & Local Buckets**: Stream triggers caching endpoints safely maps.
- **Semantic Vector Indexes**: Fully utilizes Gemini embedding endpoints targeting deterministic seeks on dashboards directly.

---

## 🛠 Tech Stack

### Backend (`/backend`)
- **Framework**: FastAPI (Uvicorn concurrent hooks).
- **Core AI Wrappers**: `google-genai` leveraging Vertex AI endpoints wrapping `gemini-1.5-pro`.
- **Datalayers**: Google Cloud Storage & Standard BigQuery (manual SQLite fallbacks preserved).

### Frontend (`/frontend`)
- **Framework**: Next.js 14+ layouts (TypeScript, Client actions).
- **Styling tokens**: Standard Tailwind framework mapping seamless Dark/Light Support triggers.

---

## ⚙️ Local Setup

### 1. Config Environment
Create a `.env` file in the root mirroring `.env.example`:

```env
GCP_PROJECT_ID=your-project-id
GCP_LOCATION=us-central1
GCS_BUCKET_NAME=your-bucket-name

GEMINI_MODEL_TEXT=gemini-2.5-pro
GEMINI_MODEL_TEXT_LOCATION=us-central1
GEMINI_MODEL_EMBEDDING=gemini-embedding-2-preview
GEMINI_MODEL_EMBEDDING_LOCATION=us-central1
```

### 2. Configure & Run
You can easily setup and run all required services concurrently:
```bash
make start-all
```
This will automatically initialize BigQuery schemas, install requirements natively, and spin up both the FastAPI backend and NextJS frontend!
Open [http://localhost:3000](http://localhost:3000) accessing central stats dynamically maps.

---

## ☁️ Cloud Run Deployment

You can facilitate sequential infrastructure creations safely passing secure Buildpacks configurations leveraging the provided orchestrator hooks:

```bash
chmod +x deploy_cloudrun.sh
./deploy_cloudrun.sh
```
Executes sequential deployments pushing remote frame bundles caching securely.

### 🔑 IAM Permission Prerequisites

To ensure the **Backend** running on Cloud Run can operate smoothly without `403 Access Denied` errors, ensure your Cloud Run service account has the following roles:
- **BigQuery Data Editor** (`roles/bigquery.dataEditor`) on the target Dataset or Project for inserting insights.
- **Vertex AI User** (`roles/aiplatform.user`) for executing Gemini 1.5 Pro multimodal models.
- **Storage Object Admin** (`roles/storage.objectAdmin`) or **Storage Object User** (`roles/storage.objectUser`) on the GCS Bucket to upload and process staged videos.

By default, Cloud Run uses the **Compute Engine default service account** (`[PROJECT_NUMBER]-compute@developer.gserviceaccount.com`). You can assign these roles in the GCP IAM console under **IAM & Admin**.
