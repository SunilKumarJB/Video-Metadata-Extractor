"use client";

import { useEffect, useState, useRef } from "react";
import { Sparkles, Camera, Volume2, Zap, Lightbulb, FileText } from "lucide-react";
import { API_URL } from "@/config";

export default function AssetsPage() {
   const [assets, setAssets] = useState<any[]>([]);
   const [loading, setLoading] = useState(true);
   const [selectedAsset, setSelectedAsset] = useState<any | null>(null);
   const [scenes, setScenes] = useState<any[]>([]);
   const [loadingScenes, setLoadingScenes] = useState(false);
   const [selectedScene, setSelectedScene] = useState<any | null>(null);
   const videoRef = useRef<HTMLVideoElement>(null);

   const getShortId = (str: string) => {
      if (!str) return "Unknown";
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
         hash = (hash << 5) - hash + str.charCodeAt(i);
         hash |= 0;
      }
      return `ASSET-${Math.abs(hash).toString(16).toUpperCase().slice(0, 6)}`;
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

   const jumpToTimestamp = (timestamp: string) => {
      const start = parseTimestampToSeconds(timestamp);
      if (videoRef.current) {
         videoRef.current.currentTime = start;
         videoRef.current.play().catch(error => {
            if (error.name !== 'AbortError') {
               console.error("Playback Error:", error);
            }
         });
      }
   };

   const handleAssetClick = async (asset: any) => {
      setSelectedAsset(asset);
      setLoadingScenes(true);
      setScenes([]);
      try {
         const res = await fetch(`${API_URL}/api/assets/${encodeURIComponent(asset.video_id)}`);
         if (res.ok) {
            const data = await res.json();
            setScenes(data.scenes || []);
         }
      } catch (error) {
         console.error("Failed to load scenes:", error);
      } finally {
         setLoadingScenes(false);
      }
   };

   useEffect(() => {
      // Placeholder fetching, will fetch from /api/assets later
      const fetchAssets = async () => {
         try {
            const res = await fetch(`${API_URL}/api/assets`);
            if (res.ok) {
               const data = await res.json();
               setAssets(data.assets || []);
            }
         } catch (error) {
            console.error("Failed to load assets:", error);
         } finally {
            setLoading(false);
         }
      };
      fetchAssets();
   }, []);

   return (
      <>

         <main className="flex-1 p-8 space-y-6">
            <h1 className="text-3xl font-bold tracking-tight text-black dark:text-zinc-50">Assets</h1>
            <p className="text-zinc-500 dark:text-zinc-400">List of analyzed videos and extracted insights.</p>

            {loading ? (
               <div>Loading assets...</div>
            ) : assets.length === 0 ? (
               <div className="rounded-2xl border border-zinc-200 bg-white p-12 text-center text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
                  No assets found. Try uploading a video on the Dashboard.
               </div>
            ) : (
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {assets.map((asset, index) => (
                     <div key={index} onClick={() => handleAssetClick(asset)} className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 cursor-pointer hover:border-zinc-300 dark:hover:border-zinc-700 transition flex flex-col justify-between">
                        <div>
                           <h3 className="text-lg font-bold text-black dark:text-zinc-50 truncate" title={asset.video_id}>{getShortId(asset.video_id)}</h3>
                           <p className="mt-2 text-sm text-zinc-500 line-clamp-3">{asset.summary || "No summary available"}</p>
                        </div>
                     </div>
                  ))}
               </div>
            )}
         </main>


         {/* Sidepanel for Details */}
         {selectedAsset && (
            <div className="fixed inset-y-0 right-0 w-1/3 bg-white dark:bg-zinc-950 border-l border-zinc-200 dark:border-zinc-800 shadow-xl p-6 flex flex-col gap-4 overflow-y-auto z-50">
               <div className="flex justify-between items-center border-b border-zinc-100 dark:border-zinc-800 pb-4">
                  <h2 className="text-lg font-bold text-black dark:text-zinc-50 truncate max-w-[80%]" title={selectedAsset.video_id}>
                     {getShortId(selectedAsset.video_id)}
                  </h2>
                  <button onClick={() => { setSelectedAsset(null); setSelectedScene(null); }} className="rounded-full p-2 hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-500 font-bold text-lg">
                     &times;
                  </button>
               </div>

               {/* Video Player */}
               {(() => {
                  const firstScene = scenes[0];
                  if (!firstScene) return null;

                  const streamUrl = firstScene.video_url && firstScene.video_url.startsWith("http") ? firstScene.video_url : (firstScene.video_id && firstScene.video_id.startsWith("http") ? firstScene.video_id : "");

                  if (!streamUrl) return null;

                  return (
                     <div className="border-b border-zinc-100 dark:border-zinc-800 pb-4">
                        {(streamUrl.includes("youtube.com") || streamUrl.includes("youtu.be")) ? (
                           <div className="aspect-video w-full rounded-xl overflow-hidden bg-black">
                              <iframe
                                 src={getYouTubeEmbedUrl(streamUrl, selectedScene?.timestamp_start || firstScene.timestamp_start)}
                                 className="w-full h-full"
                                 allowFullScreen
                                 title="Scene Video"
                              />
                           </div>
                        ) : streamUrl.startsWith("http") ? (
                           <div className="aspect-video w-full rounded-xl overflow-hidden bg-black">
                              <video
                                 ref={videoRef}
                                 src={`${streamUrl}#t=${parseTimestampToSeconds(selectedScene?.timestamp_start || firstScene.timestamp_start)}`}
                                 controls
                                 className="w-full h-full"
                              />
                           </div>
                        ) : null}
                     </div>
                  );
               })()}

               <div className="space-y-4">
                  <div>
                     <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Summary</h3>
                     <p className="mt-1 text-sm text-zinc-800 dark:text-zinc-300">{selectedAsset.summary}</p>
                  </div>

                  {selectedAsset.tags && selectedAsset.tags.length > 0 && (
                     <div>
                        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Tags</h3>
                        <div className="flex flex-wrap gap-1 mt-2">
                           {Array.from(new Set(selectedAsset.tags)).map((tag: any, tIdx: number) => (
                              <span key={tIdx} className="rounded-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 px-2.5 py-1 text-xs font-medium text-zinc-600 dark:text-zinc-300">
                                 {tag}
                              </span>
                           ))}
                        </div>
                     </div>
                  )}
               </div>

               <div className="flex-1 mt-6">
                  <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-6">Scenes Breakdown</h3>
                  {loadingScenes ? (
                     <div className="text-sm text-zinc-500 flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-zinc-300 dark:border-zinc-700 border-t-blue-500 rounded-full animate-spin"></span>
                        Loading scenes...
                     </div>
                  ) : scenes.length === 0 ? (
                     <div className="text-sm text-zinc-500">No scenes found for this video.</div>
                  ) : (
                     <div className="space-y-0 pl-2">
                        {scenes.map((scene, sIndex) => (
                           <div key={sIndex} onClick={() => { setSelectedScene(scene); jumpToTimestamp(scene.timestamp_start); }} className="relative pl-6 pb-8 border-l border-zinc-200 dark:border-zinc-800 last:border-0 last:pb-0 group/scene cursor-pointer hover:bg-zinc-50/50 dark:hover:bg-zinc-900/20 px-2 rounded-r-lg py-1 hover:border-l-blue-500 transition-all">
                              {/* Timeline dot */}
                              <div className="absolute top-0 left-[-5px] w-2.5 h-2.5 rounded-full bg-blue-500 dark:bg-blue-600 shadow-[0_0_0_4px_white] dark:shadow-[0_0_0_4px_#09090b] transition-transform group-hover/scene:scale-125"></div>

                              <div className="-mt-1 flex flex-col gap-2 relative top-[-2px]">
                                 <div className="flex justify-between items-start gap-2 flex-wrap">
                                    <span className="font-mono text-[11px] font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/40 px-2 py-0.5 rounded-md border border-blue-100 dark:border-blue-800">
                                       {scene.timestamp_start} - {scene.timestamp_end}
                                    </span>
                                    {scene.category && (
                                       <span className="bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 px-2 py-0.5 rounded-full text-[10px] border border-zinc-200 dark:border-zinc-700 uppercase tracking-widest font-bold">
                                          {scene.category}
                                       </span>
                                    )}
                                 </div>

                                 <div>
                                    <h4 className="text-[15px] font-bold text-black dark:text-white leading-tight">
                                       {scene.title || "Untitled Scene"}
                                    </h4>
                                    <p className="text-sm text-zinc-600 dark:text-zinc-300 mt-1.5 leading-relaxed">
                                       {scene.description}
                                    </p>
                                 </div>

                                 <details className="mt-2 group">
                                    <summary className="text-xs font-medium text-zinc-500 hover:text-black dark:hover:text-white cursor-pointer list-none flex items-center gap-1.5 w-fit">
                                       <span className="transition-transform group-open:rotate-90 text-[10px]">▶</span> Details
                                    </summary>
                                    <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800/60 text-xs space-y-2 text-zinc-600 dark:text-zinc-400 bg-zinc-50/50 dark:bg-zinc-900/20 p-3 rounded-lg">
                                       {scene.editing_justification && (
                                          <div className="leading-relaxed flex items-start gap-1.5">
                                             <Sparkles className="h-3.5 w-3.5 mt-0.5 text-amber-500 flex-shrink-0" />
                                             <div><strong className="text-zinc-900 dark:text-zinc-200">Justification:</strong> {scene.editing_justification}</div>
                                          </div>
                                       )}
                                       {scene.visuals_camera && (
                                          <div className="leading-relaxed flex items-start gap-1.5">
                                             <Camera className="h-3.5 w-3.5 mt-0.5 text-blue-500 flex-shrink-0" />
                                             <div><strong className="text-zinc-900 dark:text-zinc-200">Camera:</strong> {scene.visuals_camera}</div>
                                          </div>
                                       )}
                                       {scene.audio_cues && (
                                          <div className="leading-relaxed flex items-start gap-1.5">
                                             <Volume2 className="h-3.5 w-3.5 mt-0.5 text-purple-500 flex-shrink-0" />
                                             <div><strong className="text-zinc-900 dark:text-zinc-200">Audio:</strong> {scene.audio_cues}</div>
                                          </div>
                                       )}
                                       {scene.pacing && (
                                          <div className="leading-relaxed flex items-start gap-1.5">
                                             <Zap className="h-3.5 w-3.5 mt-0.5 text-red-500 flex-shrink-0" />
                                             <div><strong className="text-zinc-900 dark:text-zinc-200">Pacing:</strong> {scene.pacing}</div>
                                          </div>
                                       )}
                                       {scene.repurposing_idea && (
                                          <div className="leading-relaxed flex items-start gap-1.5">
                                             <Lightbulb className="h-3.5 w-3.5 mt-0.5 text-yellow-500 flex-shrink-0" />
                                             <div><strong className="text-zinc-900 dark:text-zinc-200">Idea:</strong> {scene.repurposing_idea}</div>
                                          </div>
                                       )}
                                       {scene.edit_cut_notes && (
                                          <div className="leading-relaxed flex items-start gap-1.5">
                                             <FileText className="h-3.5 w-3.5 mt-0.5 text-green-500 flex-shrink-0" />
                                             <div><strong className="text-zinc-900 dark:text-zinc-200">Notes:</strong> {scene.edit_cut_notes}</div>
                                          </div>
                                       )}
                                    </div>
                                 </details>
                              </div>
                           </div>
                        ))}
                     </div>
                  )}
               </div>
            </div>
         )}
      </>
   );
}
