import { Metadata } from "next";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import VIPList from "./vip-list";

export const metadata: Metadata = {
  title: "VIP Management",
  description: "Manage your channel VIPs and view active VIP sessions",
};

export default async function VIPManagementPage() {
  const session = await getServerSession();

  if (!session) {
    redirect("/auth/signin");
  }

  return (
    <div className="container mx-auto py-10">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">VIP Management</h1>
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <VIPList channelId={session.user?.id} />
        </div>
      </div>
    </div>
  );
} 