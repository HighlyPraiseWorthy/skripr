import { DashboardNav } from "./DashboardNav";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-gray-950">
      <DashboardNav />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}