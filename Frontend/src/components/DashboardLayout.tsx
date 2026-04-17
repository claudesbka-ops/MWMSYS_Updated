import { ReactNode } from "react";
import AppSidebar from "./AppSidebar";
import TopHeader from "./TopHeader";
import CommandPalette from "./CommandPalette";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background transition-colors">
      <AppSidebar />
      <div className="lg:ml-64 flex flex-col min-h-screen">
        <TopHeader />
        <main className="flex-1 p-6">
          <div className="max-w-[1400px] mx-auto animate-in fade-in slide-in-from-bottom-2 duration-500">
            {children}
          </div>
        </main>
      </div>
      <CommandPalette />
    </div>
  );
}
