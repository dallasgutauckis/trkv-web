import { Metadata } from "next";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import ChannelPointsForm from "./channel-points-form";

export const metadata: Metadata = {
  title: "Channel Points Configuration",
  description: "Configure your VIP reward channel points settings",
};

export default async function ChannelPointsPage() {
  const session = await getServerSession();

  if (!session) {
    redirect("/auth/signin");
  }

  return (
    <div className="container mx-auto py-10">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">Channel Points Configuration</h1>
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <ChannelPointsForm />
        </div>
      </div>
    </div>
  );
} 