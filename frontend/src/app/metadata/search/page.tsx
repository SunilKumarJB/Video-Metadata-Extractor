
import SearchPortal from "@/components/SearchPortal";

export default function SearchPage() {
  return (
    <>

      <main className="flex-1 p-8 space-y-6">
        <section className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-black dark:text-zinc-50">Search Directory</h1>
          <p className="text-zinc-500 dark:text-zinc-400">Query assets directly using Multimodal Embeddings index.</p>
        </section>

        <div className="w-full">
          <SearchPortal />
        </div>
      </main>
    </>
  );
}
