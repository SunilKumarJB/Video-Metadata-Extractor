import Link from "next/link";

export default function Footer() {
  return (
    <footer className="py-4 text-center text-xs text-zinc-500 dark:text-zinc-500 border-t border-zinc-100 dark:border-zinc-900 mt-auto bg-transparent">
      <span className="opacity-75">By </span>
      <Link
        href="https://www.linkedin.com/in/sunilkumar88/" // Placeholder: User should update with actual link
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 font-medium transition-colors"
      >
        Sunil Kumar
      </Link>
    </footer>
  );
}
