"use client";

import { useState, useRef } from "react";
import { Upload, Search, Film, Video, CheckCircle2, XCircle, ArrowRight, PlayCircle, Sparkles } from "lucide-react";
import { API_URL } from "@/config";

export default function PromptSearchPage() {
  const [activeTab, setActiveTab] = useState<"upload" | "search">("upload");

  // Upload State
  const [promptText, setPromptText] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "success" | "error">("idle");
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Search State
  const [searchQuery, setSearchQuery] = useState("");
  const [searchImage, setSearchImage] = useState<File | null>(null);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchFileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promptText || !uploadFile) {
      alert("Please provide both a prompt and a video file.");
      return;
    }

    setIsUploading(true);
    setUploadStatus("idle");
    setUploadError("");

    const formData = new FormData();
    formData.append("prompt_text", promptText);
    formData.append("file", uploadFile);

    try {
      const response = await fetch(`${API_URL}/api/prompt-upload`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to upload prompt and video. Make sure services are running.");
      }

      const data = await response.json();
      if (data.status === "success") {
        setUploadStatus("success");
        setPromptText("");
        setUploadFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      } else {
        throw new Error(data.detail || "Upload failed");
      }
    } catch (err: any) {
      console.error(err);
      setUploadStatus("error");
      setUploadError(err.message || "An unexpected error occurred.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery && !searchImage) return;

    setIsSearching(true);
    setSearchResults([]);

    try {
      let finalQuery = searchQuery;

      // If an image is provided, we send it as base64 to search against the video frames
      if (searchImage) {
        const base64Image = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(searchImage);
        });
        finalQuery = base64Image;
      }

      const response = await fetch(`${API_URL}/api/prompt-search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: finalQuery }),
      });

      if (!response.ok) {
        throw new Error("Failed to search prompt videos.");
      }

      const data = await response.json();
      if (data.status === "success") {
        setSearchResults(data.results || []);
      }
    } catch (err) {
      console.error("Search error:", err);
      alert("Search failed. See console for details.");
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-50 dark:bg-black p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">Prompt & Video Search</h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Upload a prompt and its corresponding video to BigQuery, then search via text or image using Gemini multimodal vector embeddings.
        </p>
      </div>

      <div className="w-full flex-1 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden flex flex-col">
        {/* Tabs */}
        <div className="flex border-b border-zinc-200 dark:border-zinc-800">
          <button
            onClick={() => setActiveTab("upload")}
            className={`flex-1 flex justify-center items-center gap-2 py-4 text-sm font-medium transition-colors ${activeTab === "upload"
              ? "text-indigo-600 border-b-2 border-indigo-600 dark:text-indigo-400 dark:border-indigo-400 bg-zinc-50 dark:bg-zinc-950/50"
              : "text-zinc-500 hover:text-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 dark:text-zinc-400"
              }`}
          >
            <Upload className="w-4 h-4" />
            Upload Prompt & Video
          </button>
          <button
            onClick={() => setActiveTab("search")}
            className={`flex-1 flex justify-center items-center gap-2 py-4 text-sm font-medium transition-colors ${activeTab === "search"
              ? "text-indigo-600 border-b-2 border-indigo-600 dark:text-indigo-400 dark:border-indigo-400 bg-zinc-50 dark:bg-zinc-950/50"
              : "text-zinc-500 hover:text-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 dark:text-zinc-400"
              }`}
          >
            <Search className="w-4 h-4" />
            Search Library
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6 md:p-8">

          {/* UPLOAD TAB */}
          {activeTab === "upload" && (
            <div className="max-w-2xl mx-auto space-y-8">
              <form onSubmit={handleUploadSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Prompt Text</label>
                  <textarea
                    rows={4}
                    value={promptText}
                    onChange={(e) => setPromptText(e.target.value)}
                    placeholder="Describe the prompt or content..."
                    className="w-full rounded-xl border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-black dark:text-white dark:placeholder-zinc-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Video File</label>
                  <div className="mt-2 flex justify-center rounded-xl border border-dashed border-zinc-300 px-6 py-8 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-950/50 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors">
                    <div className="text-center">
                      <Film className="mx-auto h-8 w-8 text-zinc-400" aria-hidden="true" />
                      <div className="mt-4 flex text-sm leading-6 text-zinc-600 dark:text-zinc-400 justify-center">
                        <label
                          htmlFor="file-upload"
                          className="relative cursor-pointer rounded-md font-semibold text-indigo-600 focus-within:outline-none focus-within:ring-2 focus-within:ring-indigo-600 focus-within:ring-offset-2 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
                        >
                          <span>{uploadFile ? uploadFile.name : "Select a video"}</span>
                          <input
                            id="file-upload"
                            name="file-upload"
                            type="file"
                            accept="video/*"
                            className="sr-only"
                            onChange={(e) => {
                              if (e.target.files && e.target.files.length > 0) {
                                setUploadFile(e.target.files[0]);
                              }
                            }}
                            ref={fileInputRef}
                          />
                        </label>
                      </div>
                      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">MP4, MOV up to ~1GB (GCS streaming)</p>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isUploading || !promptText || !uploadFile}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {isUploading ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                      Uploading to GCS & Extracting Embeddings...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Upload to BigQuery
                    </>
                  )}
                </button>
              </form>

              {uploadStatus === "success" && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20">
                  <div className="flex">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-500" aria-hidden="true" />
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-emerald-800 dark:text-emerald-300">Success</h3>
                      <div className="mt-2 text-sm text-emerald-700 dark:text-emerald-400">
                        <p>Video safely uploaded to genAI_videos and embeddings securely processed into BigQuery.</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {uploadStatus === "error" && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-950/20">
                  <div className="flex">
                    <XCircle className="h-5 w-5 text-red-600 dark:text-red-500" aria-hidden="true" />
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-red-800 dark:text-red-300">Upload Failed</h3>
                      <div className="mt-2 text-sm text-red-700 dark:text-red-400">
                        <p>{uploadError}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SEARCH TAB */}
          {activeTab === "search" && (
            <div className="space-y-8">
              <form onSubmit={handleSearchSubmit} className="max-w-3xl mx-auto space-y-6">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Search Query</label>
                  <div className="flex gap-4 items-start">
                    <div className="flex-1">
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search for a specific prompt or video behavior..."
                        disabled={!!searchImage}
                        className="w-full rounded-xl border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-black dark:text-white disabled:opacity-50"
                      />
                      <div className="mt-3 flex items-center gap-4">
                        <div className="flex-1 border-t border-zinc-200 dark:border-zinc-800"></div>
                        <span className="text-xs text-zinc-500">OR</span>
                        <div className="flex-1 border-t border-zinc-200 dark:border-zinc-800"></div>
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          if (e.target.files && e.target.files.length > 0) {
                            setSearchImage(e.target.files[0]);
                            setSearchQuery("");
                          } else {
                            setSearchImage(null);
                          }
                        }}
                        ref={searchFileInputRef}
                        className="mt-3 block w-full text-sm text-zinc-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 dark:file:bg-indigo-900/50 dark:file:text-indigo-400"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={isSearching || (!searchQuery && !searchImage)}
                      className="flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSearching ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                      ) : (
                        <Search className="w-4 h-4" />
                      )}
                      Search
                    </button>
                  </div>
                </div>
              </form>

              {/* Search Results */}
              {searchResults.length > 0 && (
                <div className="mt-8 space-y-6">
                  <h2 className="text-xl font-bold flex items-center gap-2 text-zinc-900 dark:text-white">
                    <Sparkles className="h-5 w-5 text-indigo-500" />
                    Top Matches
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {searchResults.map((result, idx) => (
                      <div key={idx} className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm flex flex-col group hover:shadow-md transition-shadow">
                        {/* Video player using signed url */}
                        <div className="aspect-video relative bg-black flexItems-center justify-center flex-shrink-0">
                          {result.video_url ? (
                            <video
                              src={result.video_url}
                              controls
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center text-zinc-600 flex-col gap-2">
                              <Video className="h-8 w-8" />
                              <span className="text-sm">Video Unavailable</span>
                            </div>
                          )}
                        </div>
                        <div className="p-5 flex flex-col flex-1 h-full">
                          <div className="mb-4">
                            <div className="text-xs font-semibold tracking-wider uppercase text-indigo-600 dark:text-indigo-400 mb-2">Original Prompt</div>
                            <p className="text-sm text-zinc-900 dark:text-zinc-300 font-medium line-clamp-3">
                              {result.prompt_text}
                            </p>
                          </div>

                          <div className="mt-auto pt-4 border-t border-zinc-100 dark:border-zinc-800/50 flex justify-between items-center">
                            <span className="text-xs font-mono text-zinc-500 dark:text-zinc-500">
                              Score: {(1 - (result.best_distance || 0)).toFixed(3)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {searchResults.length === 0 && !isSearching && searchQuery && (
                <div className="text-center py-12 text-zinc-500 dark:text-zinc-400">
                  No results found. Try a different query.
                </div>
              )}

            </div>
          )}

        </div>
      </div>
    </div>
  );
}
