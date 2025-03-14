import { Metadata } from "next";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import VIPList from "./vip-list";

export const metadata: Metadata = {
  title: "VIP Management",
  description: "Manage your Twitch VIPs",
};

export default async function VIPPage() {
  const session = await getServerSession();

  if (!session) {
    redirect("/auth/signin");
  }

  if (!session.user?.id) {
    throw new Error("Missing required session data");
  }

  return (
    <div className="container mx-auto py-10">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">VIP Management</h1>
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <VIPList initialChannelId={session.user.id} />
        </div>
      </div>
    </div>
  );
} 