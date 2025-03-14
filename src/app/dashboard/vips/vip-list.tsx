"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { calculateTimeRemaining } from "@/lib/utils";
import type { VIPSession } from "@/types/database";
import { EnhancedVIP } from "@/app/api/vip/route";
import Image from "next/image";

interface VIPListProps {
  initialChannelId: string;
}

export default function VIPList({ initialChannelId }: VIPListProps) {
  const { data: session } = useSession();
  const [vips, setVips] = useState<EnhancedVIP[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sseStatus, setSseStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const MAX_RECONNECT_ATTEMPTS = 5;
  const RECONNECT_INTERVAL = 3000; // 3 seconds

  const fetchVIPs = useCallback(async () => {
    if (!initialChannelId || !session?.accessToken) return;
    
    try {
      setIsLoading(true);
      const response = await fetch(`/api/vip?channelId=${initialChannelId}&includeAllVips=true`, {
        headers: {
          "Authorization": `Bearer ${session.accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch VIPs");
      }

      const data = await response.json();
      setVips(data);
      setError(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to load VIPs");
      console.error("Error fetching VIPs:", error);
    } finally {
      setIsLoading(false);
    }
  }, [initialChannelId, session?.accessToken]);

  const connectSSE = useCallback(() => {
    if (!initialChannelId || !session?.accessToken || typeof window === 'undefined') {
      return;
    }

    // Close existing connection if any
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    try {
      setSseStatus('connecting');
      const url = `/api/ws?channelId=${initialChannelId}&token=${encodeURIComponent(session.accessToken)}`;
      const eventSource = new EventSource(url);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        console.log('SSE connection opened');
        setSseStatus('connected');
        reconnectAttemptsRef.current = 0; // Reset reconnect attempts on successful connection
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('SSE message received:', data);
          
          if (data.type === 'connection_established') {
            console.log('SSE connection confirmed by server');
            toast.success('Connected to real-time updates');
          } else if (data.type === 'ping') {
            // Server ping to keep connection alive, no action needed
            console.log('Received server ping');
          } else if (data.type === 'vip_update') {
            // When we get an update, refresh the full list to include all VIPs
            fetchVIPs();
          }
        } catch (error) {
          console.error('Error processing SSE message:', error);
        }
      };

      eventSource.onerror = (error) => {
        console.error('SSE error:', error);
        setSseStatus('error');
        
        // Close the connection on error
        eventSource.close();
        eventSourceRef.current = null;
        
        // Attempt to reconnect unless we've reached max attempts
        if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttemptsRef.current += 1;
          console.log(`Attempting to reconnect (${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})...`);
          
          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
          }
          
          reconnectTimeoutRef.current = setTimeout(() => {
            toast.error('Lost connection to server. Reconnecting...');
            connectSSE();
          }, RECONNECT_INTERVAL);
        } else if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
          toast.error('Could not connect to server after multiple attempts');
          setError('Connection to server failed. Please refresh the page to try again.');
        }
      };
    } catch (error) {
      console.error('Error setting up SSE:', error);
      setSseStatus('error');
      setError('Failed to connect to real-time updates');
    }
  }, [initialChannelId, session?.accessToken, fetchVIPs]);

  useEffect(() => {
    fetchVIPs();
    connectSSE();

    return () => {
      // Clean up SSE connection and any pending reconnect attempts
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, [fetchVIPs, connectSSE]);

  const handleRemoveVIP = async (vip: EnhancedVIP) => {
    if (!initialChannelId || !vip.sessionId) return;

    try {
      const response = await fetch(
        `/api/vip?sessionId=${vip.sessionId}&channelId=${initialChannelId}&userId=${vip.id}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) throw new Error("Failed to remove VIP");

      toast.success(`Removed VIP status from ${vip.displayName}`);
      
      // Refresh the VIP list immediately instead of waiting for SSE
      fetchVIPs();
    } catch (error) {
      toast.error("Failed to remove VIP status");
      console.error("Error removing VIP:", error);
    }
  };

  if (isLoading) {
    return <div className="text-center py-8 text-[var(--muted-foreground)]">Loading VIP list...</div>;
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-[var(--destructive)]">Error: {error}</p>
        <Button 
          onClick={() => {
            fetchVIPs();
            connectSSE();
          }}
          className="mt-4 bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-opacity-90"
        >
          Retry
        </Button>
      </div>
    );
  }

  // Count channel points VIPs
  const channelPointsVIPCount = vips.filter(vip => vip.isChannelPointsVIP).length;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-[var(--card-foreground)]">Active VIPs</h2>
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${
            sseStatus === 'connected' ? 'bg-[var(--success)]' : 
            sseStatus === 'connecting' ? 'bg-[var(--warning)]' : 
            'bg-[var(--destructive)]'
          }`} />
          <span className="text-sm text-[var(--muted-foreground)]">
            {sseStatus === 'connected' ? 'Live Updates' : 
             sseStatus === 'connecting' ? 'Connecting...' : 
             'Updates Paused'}
          </span>
        </div>
      </div>

      {vips.length === 0 ? (
        <div className="text-center py-8 text-[var(--muted-foreground)]">
          No active VIPs at the moment
        </div>
      ) : (
        <>
          <div className="flex justify-between items-center">
            <div className="text-sm text-[var(--muted-foreground)]">
              {vips.length} total VIPs • {channelPointsVIPCount} via Channel Points
            </div>
          </div>
          
          <div className="divide-y divide-[var(--border)]">
            {vips.map((vip) => (
              <div
                key={vip.id}
                className={`py-4 flex items-center justify-between ${
                  vip.isChannelPointsVIP ? 'bg-[var(--primary)] bg-opacity-5 -mx-2 px-2 rounded' : ''
                }`}
              >
                <div className="flex items-center">
                  {vip.profileImageUrl && (
                    <div className="mr-3 relative w-10 h-10 rounded-full overflow-hidden">
                      <Image 
                        src={vip.profileImageUrl} 
                        alt={vip.displayName} 
                        fill
                        className="object-cover"
                      />
                    </div>
                  )}
                  <div>
                    <h3 className="font-medium text-[var(--card-foreground)]">
                      {vip.displayName}
                      {vip.isChannelPointsVIP && (
                        <span className="ml-2 text-xs px-2 py-0.5 bg-[var(--primary)] text-white rounded-full">
                          Channel Points
                        </span>
                      )}
                    </h3>
                    {vip.isChannelPointsVIP && vip.expiresAt && (
                      <p className="text-sm text-[var(--muted-foreground)]">
                        {calculateTimeRemaining(new Date(vip.expiresAt))}
                      </p>
                    )}
                    <p className="text-xs text-[var(--muted-foreground)]">
                      @{vip.username}
                    </p>
                  </div>
                </div>
                {vip.isChannelPointsVIP && vip.sessionId && (
                  <Button
                    onClick={() => handleRemoveVIP(vip)}
                    className="bg-[var(--destructive)] text-[var(--destructive-foreground)] hover:bg-opacity-90"
                    size="sm"
                  >
                    Remove VIP
                  </Button>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
} 