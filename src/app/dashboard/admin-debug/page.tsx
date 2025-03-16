"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, RefreshCw } from "lucide-react";

interface EventSubListener {
  channelId: string;
  rewardId: string;
  isListenerActive: boolean;
  hasSubscription: boolean;
}

interface TwitchTokenStatus {
  valid: boolean;
  scopes: string[];
  expiresIn: number;
}

export default function AdminDebugPage() {
  const { data: session } = useSession();
  const [listeners, setListeners] = useState<EventSubListener[]>([]);
  const [tokenStatus, setTokenStatus] = useState<TwitchTokenStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Fetch EventSub listeners
      const listenersResponse = await fetch("/api/debug/eventsub");
      if (!listenersResponse.ok) {
        throw new Error("Failed to fetch EventSub listeners");
      }
      const listenersData = await listenersResponse.json();
      setListeners(listenersData.listeners);

      // Fetch Twitch token status
      const tokenResponse = await fetch("/api/debug/token-status");
      if (!tokenResponse.ok) {
        throw new Error("Failed to fetch token status");
      }
      const tokenData = await tokenResponse.json();
      setTokenStatus(tokenData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      toast.error("Failed to fetch debug data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (session?.user?.name?.toLowerCase() === "defnotdallas") {
      fetchData();
    }
  }, [session]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchData();
    setIsRefreshing(false);
  };

  const handleForceStart = async () => {
    try {
      const response = await fetch("/api/debug/test-eventsub", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "start" }),
      });

      if (!response.ok) {
        throw new Error("Failed to force start EventSub");
      }

      toast.success("Successfully forced EventSub start");
      await handleRefresh();
    } catch (err) {
      toast.error("Failed to force start EventSub");
    }
  };

  const handleForceStop = async () => {
    try {
      const response = await fetch("/api/debug/test-eventsub", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "stop" }),
      });

      if (!response.ok) {
        throw new Error("Failed to force stop EventSub");
      }

      toast.success("Successfully forced EventSub stop");
      await handleRefresh();
    } catch (err) {
      toast.error("Failed to force stop EventSub");
    }
  };

  const handleTestRedemption = async () => {
    try {
      const response = await fetch("/api/debug/test-redemption", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to trigger test redemption");
      }

      toast.success("Test redemption triggered successfully");
    } catch (err) {
      toast.error("Failed to trigger test redemption");
    }
  };

  // Check if user is authorized
  if (session?.user?.name?.toLowerCase() !== "defnotdallas") {
    return (
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
        <p>You do not have permission to view this page.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto p-4">
        <div className="flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Admin Debug Panel</h1>
        <Button
          onClick={handleRefresh}
          disabled={isRefreshing}
          variant="outline"
          size="sm"
        >
          <RefreshCw
            className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Twitch Token Status */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Twitch Token Status</h2>
        {tokenStatus ? (
          <div className="space-y-2">
            <p>
              Status:{" "}
              <span
                className={
                  tokenStatus.valid ? "text-green-600" : "text-red-600"
                }
              >
                {tokenStatus.valid ? "Valid" : "Invalid"}
              </span>
            </p>
            <p>Expires in: {tokenStatus.expiresIn} seconds</p>
            <div>
              <p className="font-medium">Scopes:</p>
              <ul className="list-disc list-inside">
                {tokenStatus.scopes?.map((scope) => (
                  <li key={scope}>{scope}</li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <p>No token status available</p>
        )}
      </Card>

      {/* EventSub Status */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">EventSub Status</h2>
        {listeners.length > 0 ? (
          <div className="space-y-4">
            {listeners.map((listener, index) => (
              <div
                key={`${listener.channelId}-${listener.rewardId}`}
                className="border-b last:border-b-0 pb-4 last:pb-0"
              >
                <p>Channel ID: {listener.channelId}</p>
                <p>Reward ID: {listener.rewardId}</p>
                <p>
                  Listener Status:{" "}
                  <span
                    className={
                      listener.isListenerActive
                        ? "text-green-600"
                        : "text-red-600"
                    }
                  >
                    {listener.isListenerActive ? "Active" : "Inactive"}
                  </span>
                </p>
                <p>
                  Subscription Status:{" "}
                  <span
                    className={
                      listener.hasSubscription
                        ? "text-green-600"
                        : "text-red-600"
                    }
                  >
                    {listener.hasSubscription ? "Active" : "Inactive"}
                  </span>
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p>No active listeners found</p>
        )}
      </Card>

      {/* Manual Testing */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Manual Testing</h2>
        <div className="space-y-4">
          <div>
            <h3 className="font-medium mb-2">EventSub Control</h3>
            <div className="flex space-x-4">
              <Button onClick={handleForceStart}>Force Start</Button>
              <Button onClick={handleForceStop} variant="destructive">
                Force Stop
              </Button>
            </div>
          </div>
          <div>
            <h3 className="font-medium mb-2">Test Redemption</h3>
            <Button onClick={handleTestRedemption}>Trigger Test Redemption</Button>
          </div>
        </div>
      </Card>

      <div className="text-sm text-gray-500">
        <h3 className="font-medium mb-2">Troubleshooting Tips:</h3>
        <ul className="list-disc list-inside space-y-1">
          <li>Make sure your Twitch token is valid and has the required scopes</li>
          <li>
            Check if both the listener and subscription are active for your channel
          </li>
          <li>
            Use the manual testing controls to force restart the EventSub service
            if needed
          </li>
          <li>
            Test the redemption flow using the test button to verify end-to-end
            functionality
          </li>
        </ul>
      </div>
    </div>
  );
} 