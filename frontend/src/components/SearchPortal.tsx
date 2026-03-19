"use client";

import { useState } from "react";
import { Search, ImagePlus, Loader2, Clock, Sparkles, Film, Tag, ChevronDown, Camera, Volume2, Zap, Lightbulb, FileText } from "lucide-react";
import { API_URL } from "../config";

export default function SearchPortal() {
   const [query, setQuery] = useState("");
   const [imagePreview, setImagePreview] = useState<string | null>(null);
   const [results, setResults] = useState<any[]>([]);
   const [loading, setLoading] = useState(false);

   const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onloadend = () => {
         setImagePreview(reader.result as string);
         // We could trigger search automatically or let user click search button
      };
      reader.readAsDataURL(file);
   };
   const parseTimestampToSeconds = (ts: string) => {
      if (!ts) return 0;
      const parts = ts.split(':').map(Number);
      if (parts.length === 2) return parts[0] * 60 + parts[1];
      if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
      return parts[0] || 0;
   };

   const getYouTubeEmbedUrl = (url: string, startTimeTs: string) => {
      if (!url) return "";
      let videoId = "";
      try {
         const urlObj = new URL(url);
         if (urlObj.hostname.includes("youtube.com")) {
            videoId = urlObj.searchParams.get("v") || "";
         } else if (urlObj.hostname.includes("youtu.be")) {
            videoId = urlObj.pathname.split("/")[1] || "";
         }
      } catch {
         if (url && !url.includes("/")) videoId = url;
      }
      if (!videoId) return "";
      const start = parseTimestampToSeconds(startTimeTs);
      return `https://www.youtube.com/embed/${videoId}?start=${start}`;
   };

   const handleSearch = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!query && !imagePreview) return;

      setLoading(true);
      setResults([]);

      try {
         const payload = {
            query: imagePreview || query // Prefer image over text or combine?
         };

         const res = await fetch(`${API_URL}/api/search`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
         });

         if (res.ok) {
            const data = await res.json();
            setResults(data.results || []);
         }
      } catch (error) {
         console.error("Search failed:", error);
      } finally {
         setLoading(false);
      }
   };

   return (
      <div className="space-y-6">
         <form onSubmit={handleSearch} className="flex gap-4">
            <div className="relative flex-1">
               <input
                  type="text"
                  placeholder="Search scenes or upload an image..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  disabled={!!imagePreview}
                  className="w-full rounded-2xl border border-zinc-200 bg-white py-3 pl-12 pr-12 text-black shadow-sm focus:border-blue-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50"
               />
               <Search className="absolute left-4 top-3.5 h-5 w-5 text-zinc-400" />

               <label className="absolute right-4 top-2.5 cursor-pointer rounded-lg p-1 hover:bg-zinc-100 dark:hover:bg-zinc-900">
                  <ImagePlus className="h-5 w-5 text-zinc-400 hover:text-blue-500" />
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
               </label>
            </div>

            <button type="submit" disabled={loading} className="rounded-2xl bg-black px-6 py-3 font-medium text-white hover:bg-zinc-800 flex items-center gap-2 dark:bg-white dark:text-black dark:hover:bg-zinc-200">
               {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Search"}
            </button>
         </form>

         {/* Image Preview Container */}
         {imagePreview && (
            <div className="relative inline-block rounded-xl border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-900">
               {/* eslint-disable-next-line @next/next/no-img-element */}
               <img src={imagePreview} alt="Search query" className="h-20 w-20 rounded-lg object-cover" />
               <button
                  onClick={() => setImagePreview(null)}
                  className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1 text-white shadow-sm hover:bg-red-600"
               >
                  &times;
               </button>
            </div>
         )}

         {/* Search Results Display */}
         <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((res, index) => (
               <div key={index} className="group rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950 flex flex-col gap-3 hover:border-blue-300 dark:hover:border-blue-800 hover:shadow-lg hover:shadow-blue-500/5 transition-all duration-300 transform hover:-translate-y-1">
                  <div className="flex justify-between items-start gap-2">
                     <div className="flex items-center gap-1.5 font-mono text-xs font-semibold tracking-wider text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/40 px-2 py-0.5 rounded-md border border-blue-100 dark:border-blue-800">
                        <Clock className="h-3 w-3" />
                        {res.timestamp_start} - {res.timestamp_end}
                     </div>
                     {res.category && (
                        <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 max-w-[120px] truncate border border-zinc-200 dark:border-zinc-700">
                           {res.category}
                        </span>
                     )}
                  </div>

                  {(() => {
                     const streamUrl = res.video_url && res.video_url.startsWith("http") ? res.video_url : (res.video_id && res.video_id.startsWith("http") ? res.video_id : "");

                     if (!streamUrl) return null;

                     if (streamUrl.includes("youtube.com") || streamUrl.includes("youtu.be")) {
                        return (
                           <div className="aspect-video w-full rounded-xl overflow-hidden bg-black mt-1">
                              <iframe
                                 src={getYouTubeEmbedUrl(streamUrl, res.timestamp_start)}
                                 className="w-full h-full"
                                 allowFullScreen
                                 title={res.title || "Scene Video"}
                              />
                           </div>
                        );
                     } else if (streamUrl.startsWith("http")) {
                        return (
                           <div className="aspect-video w-full rounded-xl overflow-hidden bg-black mt-1">
                              <video
                                 src={`${streamUrl}#t=${parseTimestampToSeconds(res.timestamp_start)}`}
                                 controls
                                 className="w-full h-full"
                              />
                           </div>
                        );
                     }
                     return null;
                  })()}

                  <div>
                     <h4 className="font-bold text-black dark:text-zinc-50 mt-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors flex items-start gap-1.5">
                        <Film className="h-4 w-4 mt-0.5 flex-shrink-0 text-zinc-400 group-hover:text-blue-500" />
                        {res.title || "Untitled Scene"}
                     </h4>

                     <p className="text-sm text-zinc-600 dark:text-zinc-300 mt-2 line-clamp-4 leading-relaxed">
                        {res.description}
                     </p>
                  </div>

                  <details className="mt-1 group/details">
                     <summary className="text-xs font-medium text-zinc-500 hover:text-black dark:hover:text-white cursor-pointer list-none flex items-center gap-1 w-fit">
                        <ChevronDown className="h-4 w-4 transition-transform group-open/details:rotate-180" />
                        Details
                     </summary>
                     <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800 text-xs space-y-2 text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900/60 p-3 rounded-xl">
                        {res.editing_justification && (
                           <div className="leading-relaxed flex items-start gap-2">
                              <Sparkles className="h-3.5 w-3.5 mt-0.5 text-amber-500 flex-shrink-0" />
                              <div><strong className="text-zinc-900 dark:text-zinc-200">Justification:</strong> {res.editing_justification}</div>
                           </div>
                        )}
                        {res.visuals_camera && (
                           <div className="leading-relaxed flex items-start gap-2">
                              <Camera className="h-3.5 w-3.5 mt-0.5 text-blue-500 flex-shrink-0" />
                              <div><strong className="text-zinc-900 dark:text-zinc-200">Camera:</strong> {res.visuals_camera}</div>
                           </div>
                        )}
                        {res.audio_cues && (
                           <div className="leading-relaxed flex items-start gap-2">
                              <Volume2 className="h-3.5 w-3.5 mt-0.5 text-purple-500 flex-shrink-0" />
                              <div><strong className="text-zinc-900 dark:text-zinc-200">Audio:</strong> {res.audio_cues}</div>
                           </div>
                        )}
                        {res.pacing && (
                           <div className="leading-relaxed flex items-start gap-2">
                              <Zap className="h-3.5 w-3.5 mt-0.5 text-red-500 flex-shrink-0" />
                              <div><strong className="text-zinc-900 dark:text-zinc-200">Pacing:</strong> {res.pacing}</div>
                           </div>
                        )}
                        {res.repurposing_idea && (
                           <div className="leading-relaxed flex items-start gap-2">
                              <Lightbulb className="h-3.5 w-3.5 mt-0.5 text-yellow-500 flex-shrink-0" />
                              <div><strong className="text-zinc-900 dark:text-zinc-200">Idea:</strong> {res.repurposing_idea}</div>
                           </div>
                        )}
                        {res.edit_cut_notes && (
                           <div className="leading-relaxed flex items-start gap-2">
                              <FileText className="h-3.5 w-3.5 mt-0.5 text-green-500 flex-shrink-0" />
                              <div><strong className="text-zinc-900 dark:text-zinc-200">Notes:</strong> {res.edit_cut_notes}</div>
                           </div>
                        )}
                     </div>
                  </details>

                  <div className="mt-auto pt-3 border-t border-zinc-100 dark:border-zinc-900 text-[10px] text-zinc-400 dark:text-zinc-500 truncate flex items-center gap-1">
                     <Tag className="h-3 w-3 flex-shrink-0" />
                     ID: {res.video_id}
                  </div>
               </div>
            ))}
            {!loading && results.length === 0 && (query || imagePreview) && (
               <div className="col-span-full py-12 text-center text-zinc-500 dark:text-zinc-400">
                  No matching scenes found. Try adjusting query terms or image.
               </div>
            )}
         </div>
      </div>
   );
}
