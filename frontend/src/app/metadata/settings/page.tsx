

export default function SettingsPage() {
  return (
    <>
      <header className="flex h-16 items-center border-b border-zinc-200 px-8 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <span className="text-sm text-zinc-500 dark:text-zinc-400">System Preferences</span>
      </header>

      <main className="flex-1 p-8 space-y-6">
        <h1 className="text-3xl font-bold tracking-tight text-black dark:text-zinc-50">Settings</h1>

        <div className="max-w-md rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-lg font-semibold text-black dark:text-zinc-50">API Configuration</h2>
          <p className="mt-1 text-sm text-zinc-500">Parameters currently configured via backend `.env` file.</p>

          <div className="mt-6 space-y-4">
            <div>
              <label className="text-xs font-medium text-zinc-500 uppercase">Gemini Model</label>
              <div className="mt-1 text-sm text-black dark:text-zinc-300 font-mono bg-zinc-50 dark:bg-zinc-900 p-2 rounded">gemini-3.1-pro</div>
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-500 uppercase">Embedding Space</label>
              <div className="mt-1 text-sm text-black dark:text-zinc-300 font-mono bg-zinc-50 dark:bg-zinc-900 p-2 rounded">gemini-embedding-2</div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
