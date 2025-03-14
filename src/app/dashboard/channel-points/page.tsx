import { Metadata } from "next";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import ChannelPointsForm from "./channel-points-form";

export const metadata: Metadata = {
  title: "Channel Points Configuration",
  description: "Configure channel point rewards for VIP status",
};

export default async function ChannelPointsPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    console.log("No session found, redirecting to signin");
    redirect("/auth/signin");
  }

  // Type assertion to access session properties
  const userSession = session as any;

  if (!userSession.user?.id) {
    console.log("No user ID found in session");
    return (
      <div className="container mx-auto py-10 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <p className="text-red-600">Error: Unable to load user data. Please try signing out and signing in again.</p>
          </div>
        </div>
      </div>
    );
  }

  if (!userSession.accessToken) {
    console.log("No access token found in session");
    return (
      <div className="container mx-auto py-10 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <p className="text-red-600">Error: Missing Twitch access token. Please try signing out and signing in again.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">Channel Points Configuration</h1>
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <ChannelPointsForm 
            initialChannelId={userSession.user.id} 
            initialAccessToken={userSession.accessToken} 
          />
        </div>
      </div>
    </div>
  );
} 