"use client";

import { useState } from "react";
import { Upload, Youtube, ArrowRight, CheckCircle2, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import { API_URL } from "../config";

export default function UploadArea() {
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleYoutubeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!youtubeUrl) return;

    setUploadStatus("uploading");
    setMessage("Processing YouTube link...");

    try {
      const res = await fetch(`${API_URL}/api/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ youtube_url: youtubeUrl }),
      });

      if (res.ok) {
        setUploadStatus("success");
        setMessage("Analysis started in background. Check back soon.");
      } else {
        setUploadStatus("error");
        setMessage("Failed to analyze video. Ensure URL is correct or check backend logs.");
      }
    } catch (error) {
      setUploadStatus("error");
      setMessage("Network error connecting to backend API.");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadStatus("uploading");
    setMessage(`Uploading ${file.name}...`);

    const formData = new FormData();
    formData.append("file", file);

    try {
      // 1. Upload to GCS
      const uploadRes = await fetch(`${API_URL}/api/upload`, {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) throw new Error("Upload to server failed");
      const { gcs_uri } = await uploadRes.json();

      // 2. Trigger analysis
      setMessage("Uploading complete. Triggering Gemini analysis...");
      const analyzeRes = await fetch(`${API_URL}/api/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gcs_uri }),
      });

      if (analyzeRes.ok) {
        setUploadStatus("success");
        setMessage("Analysis started. View results in History tab or Dashboard shortly.");
      } else {
        throw new Error("Analysis trigger failed");
      }

    } catch (error: any) {
      setUploadStatus("error");
      setMessage(error.message || "File upload failed.");
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      {/* Local Video Upload */}
      <motion.div
        whileHover={{ scale: 1.01 }}
        className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-200 bg-white p-8 text-center transition-all hover:border-blue-500 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-blue-400"
      >
        <div className="rounded-full bg-blue-50 p-4 dark:bg-blue-950">
          <Upload className="h-8 w-8 text-blue-600 dark:text-blue-400" />
        </div>
        <h3 className="mt-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">Upload Local Video</h3>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Drag & drop or click to select MP4, MOV files.</p>

        <label className="mt-6 cursor-pointer rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-blue-700">
          Select File
          <input type="file" accept="video/*" className="hidden" onChange={handleFileUpload} />
        </label>
      </motion.div>

      {/* YouTube Link Input */}
      <motion.div
        whileHover={{ scale: 1.01 }}
        className="flex flex-col items-center justify-center rounded-2xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-950"
      >
        <div className="rounded-full bg-red-50 p-4 dark:bg-red-950">
          <Youtube className="h-8 w-8 text-red-600 dark:text-red-400" />
        </div>
        <h3 className="mt-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">YouTube Link</h3>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Paste a link to analyze scene by scene.</p>

        <form onSubmit={handleYoutubeSubmit} className="mt-6 flex w-full max-w-sm gap-2">
          <input
            type="url"
            placeholder="https://youtube.com/watch?v=..."
            value={youtubeUrl}
            onChange={(e) => setYoutubeUrl(e.target.value)}
            className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm text-black shadow-sm focus:border-red-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
          <button type="submit" className="rounded-lg bg-red-600 p-2 text-white hover:bg-red-700">
            <ArrowRight className="h-5 w-5" />
          </button>
        </form>
      </motion.div>

      {/* Status Messaging */}
      {uploadStatus !== "idle" && (
        <div className={`col-span-1 md:col-span-2 mt-4 flex items-center gap-3 rounded-lg border p-4 ${uploadStatus === "uploading" ? "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-100" :
            uploadStatus === "success" ? "border-green-200 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-100" :
              "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-100"
          }`}>
          {uploadStatus === "success" ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
          <span className="text-sm font-medium">{message}</span>
        </div>
      )}
    </div>
  );
}
