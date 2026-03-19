"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Compass, Film, History, Search, Settings, Sparkles, Sun, Moon } from "lucide-react";

export default function Sidebar() {
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark") ||
      localStorage.getItem("theme") === "dark";
    setIsDarkMode(isDark);
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  const toggleTheme = () => {
    const newDark = !isDarkMode;
    setIsDarkMode(newDark);
    if (newDark) {
      document.documentElement.classList.add("dark");
      document.documentElement.classList.remove("light");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      document.documentElement.classList.add("light");
      localStorage.setItem("theme", "light");
    }
  };

  const links = [
    { name: "Dashboard", href: "/metadata", icon: Compass },
    { name: "Extractor", href: "/metadata/extractor", icon: Sparkles },
    { name: "Assets", href: "/metadata/assets", icon: Film },
    { name: "Search", href: "/metadata/search", icon: Search },
    { name: "Prompt & Video", href: "/metadata/prompt-search", icon: History },
  ];

  return (
    <div className="flex h-screen w-64 flex-col border-r border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex h-16 items-center border-b border-zinc-200 px-2 dark:border-zinc-800 gap-2">
        <div className="rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 p-1.5 shadow-md flex items-center justify-center">
          <Sparkles className="h-4 w-4 text-white" />
        </div>
        <span className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-600 to-purple-500 bg-clip-text text-transparent">MetaExtractor</span>
      </div>

      <nav className="flex-1 space-y-1 pt-4">
        {links.map((link) => {
          const Icon = link.icon;
          return (
            <Link
              key={link.name}
              href={link.href}
              className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-50"
            >
              <Icon className="h-5 w-5" />
              {link.name}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-zinc-200 pt-4 dark:border-zinc-800 flex items-center justify-between px-2">
        <Link
          href="/metadata/settings"
          className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-50 flex-1"
        >
          <Settings className="h-5 w-5" />
          Settings
        </Link>
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          title="Toggle Dark Mode"
        >
          <Sun className="hidden dark:block h-5 w-5 text-zinc-400" />
          <Moon className="block dark:hidden h-5 w-5 text-zinc-500" />
        </button>
      </div>
    </div>
  );
}
