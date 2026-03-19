"use client";

import { useEffect, useState } from "react";
import { BarChart2, Film, Tag, Video } from "lucide-react";
import { API_URL } from "@/config";

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch(`${API_URL}/api/stats`);
        if (res.ok) {
          const data = await res.json();
          setStats(data.stats);
        }
      } catch (error) {
        console.error("Failed to load stats:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const getMaxCount = (obj: any) => {
    if (!obj) return 1;
    const values = Object.values(obj) as number[];
    return Math.max(...values, 1);
  };

  const formatDuration = (seconds: number) => {
    if (!seconds) return "0s";
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) return `${hrs}h ${mins}m ${secs}s`;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  };

  return (
    <>

      <main className="flex-1 p-8 space-y-8">
        <section className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-black dark:text-zinc-50">Dashboard</h1>
          <p className="text-zinc-500 dark:text-zinc-400">Insights and metrics from your processed video data.</p>
        </section>

        {loading ? (
          <div>Loading stats...</div>
        ) : !stats ? (
          <div className="text-center text-zinc-500">Failed to load stats.</div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
            {/* Stat Card 1 */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
              <div className="flex items-center gap-4">
                <div className="rounded-xl bg-blue-50 p-3 dark:bg-blue-900/20">
                  <Video className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Total Assets</p>
                  <p className="text-2xl font-bold text-black dark:text-zinc-50">{stats.total_assets}</p>
                </div>
              </div>
            </div>

            {/* Stat Card 2 */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
              <div className="flex items-center gap-4">
                <div className="rounded-xl bg-green-50 p-3 dark:bg-green-900/20">
                  <Film className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Total Scenes</p>
                  <p className="text-2xl font-bold text-black dark:text-zinc-50">{stats.total_scenes}</p>
                </div>
              </div>
            </div>

            {/* Stat Card 3 */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
              <div className="flex items-center gap-4">
                <div className="rounded-xl bg-orange-50 p-3 dark:bg-orange-900/20">
                  <BarChart2 className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Avg Scenes/Asset</p>
                  <p className="text-2xl font-bold text-black dark:text-zinc-50">{stats.average_scenes_per_asset}</p>
                </div>
              </div>
            </div>

            {/* Stat Card 4 */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
              <div className="flex items-center gap-4">
                <div className="rounded-xl bg-purple-50 p-3 dark:bg-purple-900/20">
                  <Video className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Total Duration</p>
                  <p className="text-xl font-bold text-black dark:text-zinc-50 leading-8">{formatDuration(stats.total_duration_seconds)}</p>
                </div>
              </div>
            </div>

            {/* Stat Card 5 */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
              <div className="flex items-center gap-4">
                <div className="rounded-xl bg-indigo-50 p-3 dark:bg-indigo-900/20">
                  <Film className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Prompt Videos</p>
                  <p className="text-2xl font-bold text-black dark:text-zinc-50">{stats.total_prompt_videos}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {stats && (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {/* Category Breakdown */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
              <h2 className="text-lg font-bold text-black dark:text-zinc-50 mb-4 flex items-center gap-2">
                <BarChart2 className="h-5 w-5 text-zinc-500" />
                Category Breakdown
              </h2>
              <div className="space-y-4">
                {Object.entries(stats.category_breakdown || {}).map(([cat, count]: any) => {
                  const max = getMaxCount(stats.category_breakdown);
                  const percent = (count / max) * 100;
                  return (
                    <div key={cat} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium text-zinc-700 dark:text-zinc-300">{cat}</span>
                        <span className="text-zinc-500">{count}</span>
                      </div>
                      <div className="h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
                {Object.keys(stats.category_breakdown || {}).length === 0 && (
                  <p className="text-sm text-zinc-500">No category data available.</p>
                )}
              </div>
            </div>

            {/* Source Breakdown */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
              <h2 className="text-lg font-bold text-black dark:text-zinc-50 mb-4 flex items-center gap-2">
                <BarChart2 className="h-5 w-5 text-zinc-500" />
                Source Breakdown
              </h2>
              <div className="space-y-4">
                {Object.entries(stats.source_breakdown || {}).map(([src, count]: any) => {
                  const max = getMaxCount(stats.source_breakdown);
                  const percent = (count / max) * 100;
                  return (
                    <div key={src} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium text-zinc-700 dark:text-zinc-300">{src}</span>
                        <span className="text-zinc-500">{count}</span>
                      </div>
                      <div className="h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                        <div
                          className="h-full bg-green-500 rounded-full"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
                {Object.keys(stats.source_breakdown || {}).length === 0 && (
                  <p className="text-sm text-zinc-500">No source data available.</p>
                )}
              </div>
            </div>

            {/* Top Tags */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
              <h2 className="text-lg font-bold text-black dark:text-zinc-50 mb-4 flex items-center gap-2">
                <Tag className="h-5 w-5 text-zinc-500" />
                Top Tags
              </h2>
              <div className="flex flex-wrap gap-2">
                {Object.entries(stats.top_tags || {}).map(([tag, count]: any) => (
                  <div key={tag} className="flex items-center gap-2 rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-1.5 dark:border-zinc-800 dark:bg-zinc-900">
                    <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{tag}</span>
                    <span className="rounded-full bg-zinc-200 px-1.5 py-0.5 text-xs font-bold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                      {count}
                    </span>
                  </div>
                ))}
                {Object.keys(stats.top_tags || {}).length === 0 && (
                  <p className="text-sm text-zinc-500">No tag data available.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
