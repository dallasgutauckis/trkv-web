import DashboardHeader from "@/components/dashboard-header";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <DashboardHeader />
      <main className="text-[var(--foreground)]">{children}</main>
    </div>
  );
} 