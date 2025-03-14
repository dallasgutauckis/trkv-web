"use client";

import { useEffect, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { calculateTimeRemaining } from "@/lib/utils";
import type { VIPSession } from "@/types/database";

interface VIPListProps {
  initialChannelId: string;
}

export default function VIPList({ initialChannelId }: VIPListProps) {
  const { data: session } = useSession();
  const [vips, setVips] = useState<VIPSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const fetchVIPs = async () => {
      try {
        const response = await fetch(`/api/vip?channelId=${initialChannelId}`, {
          headers: {
            "Authorization": `Bearer ${session?.accessToken}`,
          },
        });

        if (!response.ok) {
          throw new Error("Failed to fetch VIPs");
        }

        const data = await response.json();
        setVips(data);
      } catch (error) {
        setError(error instanceof Error ? error.message : "Failed to load VIPs");
      } finally {
        setIsLoading(false);
      }
    };

    fetchVIPs();

    // Set up WebSocket connection
    if (initialChannelId && typeof window !== 'undefined') {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}/api/ws?channelId=${initialChannelId}&token=${encodeURIComponent(session?.accessToken || '')}`);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'vip_update') {
            setVips(data.vips);
          }
        } catch (error) {
          console.error('Error processing WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        toast.error('Lost connection to server');
      };

      return () => {
        ws.close();
        wsRef.current = null;
      };
    }
  }, [initialChannelId, session?.accessToken]);

  const handleRemoveVIP = async (session: VIPSession) => {
    if (!initialChannelId) return;

    try {
      const response = await fetch(
        `/api/vip?sessionId=${session.id}&channelId=${initialChannelId}&userId=${session.userId}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) throw new Error("Failed to remove VIP");

      toast.success(`Removed VIP status from ${session.username}`);
      
      // The WebSocket will handle updating the list
    } catch (error) {
      toast.error("Failed to remove VIP status");
    }
  };

  if (isLoading) {
    return <div className="text-center py-8">Loading VIP list...</div>;
  }

  if (error) {
    return <div className="text-center py-8 text-red-500">Error: {error}</div>;
  }

  if (vips.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No active VIPs at the moment
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Active VIPs</h2>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-green-500" />
          <span className="text-sm text-gray-500">Live Updates</span>
        </div>
      </div>

      <div className="divide-y">
        {vips.map((vip) => (
          <div
            key={vip.id}
            className="py-4 flex items-center justify-between"
          >
            <div>
              <h3 className="font-medium">{vip.username}</h3>
              <p className="text-sm text-gray-500">
                {calculateTimeRemaining(new Date(vip.expiresAt))}
              </p>
              <p className="text-xs text-gray-400">
                Via: {vip.redeemedWith === "channel_points" ? "Channel Points" : "Manual"}
              </p>
            </div>
            <Button
              onClick={() => handleRemoveVIP(vip)}
              variant="destructive"
              size="sm"
            >
              Remove VIP
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
} 