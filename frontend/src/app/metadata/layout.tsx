import Sidebar from "@/components/Sidebar";
import Footer from "@/components/Footer";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex h-screen bg-zinc-50 dark:bg-black font-sans">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-y-auto w-full">
        {children}
        <Footer />
      </div>
    </div>
  );
}
