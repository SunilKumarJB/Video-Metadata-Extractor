
import UploadArea from "@/components/UploadArea";
import SearchPortal from "@/components/SearchPortal";

export default function Home() {
  return (
    <>

      <main className="flex-1 p-8 space-y-8">
        <section className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-black dark:text-zinc-50">Upload & Analyze</h1>
          <p className="text-zinc-500 dark:text-zinc-400">Extract Micro scenes and tags from any video or youtube link with Gemini 3.1 Pro.</p>
        </section>

        <UploadArea />

        <hr className="border-zinc-200 dark:border-zinc-800" />

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-black dark:text-zinc-50">Vector Search Assets</h2>
          <SearchPortal />
        </section>
      </main>
    </>
  );
}
