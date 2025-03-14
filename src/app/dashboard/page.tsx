import { Metadata } from "next";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import VIPList from "./vips/vip-list";
import ChannelPointsForm from "./channel-points/channel-points-form";
import { authOptions } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Manage your Twitch VIP settings and view active VIPs",
};

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/auth/signin");
  }

  // Log session data for debugging
  console.log("Dashboard session data:", JSON.stringify({
    ...session,
    accessToken: session.accessToken ? `${session.accessToken.toString().substring(0, 10)}...` : undefined
  }));

  // Handle missing session data more gracefully
  if (!session.user?.id) {
    console.error("Missing user ID in session");
    redirect("/auth/signin?error=missing_user_id");
  }

  if (!session.accessToken) {
    console.error("Missing access token in session");
    redirect("/auth/signin?error=missing_access_token");
  }

  return (
    <div className="container mx-auto py-10 px-4">
      <h1 className="text-4xl font-bold mb-8 text-[var(--foreground)]">Dashboard</h1>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <div className="p-6 bg-[var(--card)] rounded-lg shadow-sm border border-[var(--border)] card-hover">
          <VIPList initialChannelId={session.user.id} />
        </div>
        <div className="p-6 bg-[var(--card)] rounded-lg shadow-sm border border-[var(--border)] card-hover">
          <h2 className="text-xl font-semibold mb-4 text-[var(--card-foreground)]">Channel Point Settings</h2>
          <ChannelPointsForm initialChannelId={session.user.id} initialAccessToken={session.accessToken} />
        </div>
        <div className="p-6 bg-[var(--card)] rounded-lg shadow-sm border border-[var(--border)] card-hover">
          <h2 className="text-xl font-semibold mb-4 text-[var(--card-foreground)]">Statistics</h2>
          <p className="text-[var(--muted-foreground)]">Coming soon...</p>
        </div>
      </div>
    </div>
  );
} 