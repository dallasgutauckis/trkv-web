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

  if (!session.user?.id || !session.accessToken) {
    throw new Error("Missing required session data");
  }

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-4xl font-bold mb-8">Dashboard</h1>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <div className="p-6 bg-white rounded-lg shadow-sm border">
          <h2 className="text-xl font-semibold mb-4">Active VIPs</h2>
          <VIPList initialChannelId={session.user.id} />
        </div>
        <div className="p-6 bg-white rounded-lg shadow-sm border">
          <h2 className="text-xl font-semibold mb-4">Channel Point Settings</h2>
          <ChannelPointsForm initialChannelId={session.user.id} initialAccessToken={session.accessToken} />
        </div>
        <div className="p-6 bg-white rounded-lg shadow-sm border">
          <h2 className="text-xl font-semibold mb-4">Statistics</h2>
          <p className="text-gray-600">Coming soon...</p>
        </div>
      </div>
    </div>
  );
} 