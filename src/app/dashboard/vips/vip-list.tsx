"use client";

import { useEffect, useState, useRef } from "react";
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
  const { data: session, status: sessionStatus, update: updateSession } = useSession();
  const [vips, setVips] = useState<EnhancedVIP[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sseStatus, setSseStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const [timeUpdateCounter, setTimeUpdateCounter] = useState(0);
  const eventSourceRef = useRef<EventSource | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(false);
  const sessionRetryCountRef = useRef(0);
  const sessionRetryTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Function to refresh the session
  async function refreshSession() {
    try {
      await updateSession();
    } catch (error) {
      console.error("Error refreshing session:", error);
    }
  }

  // Function to fetch VIPs
  async function fetchVIPs(showLoading = true) {
    if (!initialChannelId) return;
    
    if (!session?.accessToken) {
      // If session is authenticated but no access token, try to refresh the session
      if (sessionStatus === 'authenticated' && sessionRetryCountRef.current < 5) {
        sessionRetryCountRef.current++;
        
        if (sessionRetryTimerRef.current) {
          clearTimeout(sessionRetryTimerRef.current);
        }
        
        sessionRetryTimerRef.current = setTimeout(() => {
          refreshSession();
          sessionRetryTimerRef.current = null;
        }, 1000);
      }
      
      return;
    }
    
    if (!mountedRef.current) return;
    
    if (showLoading) {
      setIsLoading(true);
    }
    
    try {
      // Use absolute URL to ensure it works in all environments
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
      const url = `${baseUrl}/api/vip?channelId=${initialChannelId}&includeAllVips=true&_=${Date.now()}`;
      
      const response = await fetch(url, {
        headers: {
          "Authorization": `Bearer ${session.accessToken}`,
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Pragma": "no-cache",
          "Expires": "0"
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch VIPs: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (mountedRef.current) {
        setVips(data);
        setError(null);
      }
    } catch (error) {
      console.error("Error fetching VIPs:", error);
      
      if (mountedRef.current) {
        setError(error instanceof Error ? error.message : "Failed to load VIPs");
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }

  // Function to connect to SSE
  function connectToSSE() {
    if (!initialChannelId || !session?.accessToken || typeof window === 'undefined' || !mountedRef.current) {
      return;
    }

    // Close existing connection if any
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    try {
      setSseStatus('connecting');
      
      // Use the full URL to avoid issues with relative URLs
      const baseUrl = window.location.origin;
      const url = `${baseUrl}/api/ws?channelId=${initialChannelId}&token=${encodeURIComponent(session.accessToken)}&_=${Date.now()}`;
      
      const eventSource = new EventSource(url);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        if (mountedRef.current) {
          setSseStatus('connected');
          // Fetch VIPs when connection is established
          fetchVIPs(false);
        }
      };

      eventSource.onmessage = (event) => {
        if (!mountedRef.current) return;
        
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'connection_established') {
            setSseStatus('connected');
            fetchVIPs(false);
          } else if (data.type === 'vip_update') {
            fetchVIPs(false);
          }
        } catch (error) {
          console.error('Error processing SSE message:', error);
        }
      };

      eventSource.onerror = (error) => {
        console.error('SSE error:', error);
        if (mountedRef.current) {
          setSseStatus('error');
          
          // Close the connection on error
          eventSource.close();
          eventSourceRef.current = null;
          
          // Set up polling as fallback
          if (!pollingIntervalRef.current) {
            pollingIntervalRef.current = setInterval(() => {
              if (mountedRef.current) {
                fetchVIPs(false);
              }
            }, 30000);
          }
        }
      };
    } catch (error) {
      console.error('Error setting up SSE:', error);
      if (mountedRef.current) {
        setSseStatus('error');
      }
    }
  }

  // Set mounted ref and clean up on unmount
  useEffect(() => {
    mountedRef.current = true;
    
    // Immediate fetch attempt on mount
    const immediateLoad = async () => {
      // Wait a bit to ensure session is loaded
      await new Promise(resolve => setTimeout(resolve, 500));
      if (mountedRef.current) {
        fetchVIPs(true);
      }
    };
    
    immediateLoad();
    
    // Set up polling as a fallback
    pollingIntervalRef.current = setInterval(() => {
      if (mountedRef.current) {
        fetchVIPs(false);
      }
    }, 60000);
    
    return () => {
      mountedRef.current = false;
      
      // Clean up SSE connection
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      
      // Clean up polling interval
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      
      // Clean up session retry timer
      if (sessionRetryTimerRef.current) {
        clearTimeout(sessionRetryTimerRef.current);
        sessionRetryTimerRef.current = null;
      }
      
      if (timeUpdateIntervalRef.current) {
        clearInterval(timeUpdateIntervalRef.current);
        timeUpdateIntervalRef.current = null;
      }
    };
  }, []);

  // Fetch data when session becomes available
  useEffect(() => {
    if (sessionStatus === 'authenticated' && mountedRef.current) {
      if (session?.accessToken) {
        fetchVIPs(true);
        connectToSSE();
      } else {
        // Try to refresh the session to get the access token
        refreshSession();
      }
    }
  }, [sessionStatus, session?.accessToken, initialChannelId]);

  // Handle visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && mountedRef.current) {
        // If we don't have an access token, try to refresh the session
        if (!session?.accessToken && sessionStatus === 'authenticated') {
          refreshSession();
        } else {
          fetchVIPs(true);
          
          if (!eventSourceRef.current || sseStatus !== 'connected') {
            connectToSSE();
          }
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [sseStatus, session?.accessToken, sessionStatus]);

  // Handle removing a VIP
  async function handleRemoveVIP(vip: EnhancedVIP) {
    if (!initialChannelId || !vip.sessionId || !mountedRef.current) return;

    try {
      const response = await fetch(
        `/api/vip?sessionId=${vip.sessionId}&channelId=${initialChannelId}&userId=${vip.id}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) throw new Error("Failed to remove VIP");

      toast.success(`Removed VIP status from ${vip.displayName}`);
      fetchVIPs(true);
    } catch (error) {
      toast.error("Failed to remove VIP status");
      console.error("Error removing VIP:", error);
    }
  }

  // Handle extending a VIP's duration
  async function handleExtendVIP(vip: EnhancedVIP) {
    if (!initialChannelId || !vip.sessionId || !mountedRef.current) return;

    try {
      const response = await fetch(`/api/vip/extend`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId: vip.sessionId,
          channelId: initialChannelId,
          userId: vip.id,
          username: vip.username,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to extend VIP duration");
      }

      toast.success(`Extended VIP status for ${vip.displayName} by 12 hours`);
      fetchVIPs(true);
    } catch (error) {
      toast.error("Failed to extend VIP duration");
      console.error("Error extending VIP:", error);
    }
  }

  // Function to format the remaining time
  function formatRemainingTime(expiresAt: string | undefined): string {
    if (!expiresAt) return '';
    
    const now = new Date();
    const expiration = new Date(expiresAt);
    const diffMs = expiration.getTime() - now.getTime() + (timeUpdateCounter * 0);
    
    if (diffMs <= 0) return 'Expired';
    
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (diffHours > 0) {
      return `${diffHours}h ${diffMinutes}m remaining`;
    } else {
      return `${diffMinutes}m remaining`;
    }
  }

  // Update the remaining time display every minute
  useEffect(() => {
    timeUpdateIntervalRef.current = setInterval(() => {
      if (mountedRef.current && vips.some(vip => vip.isChannelPointsVIP && vip.expiresAt)) {
        setTimeUpdateCounter(prev => prev + 1);
      }
    }, 60000); // Update every minute

    return () => {
      if (timeUpdateIntervalRef.current) {
        clearInterval(timeUpdateIntervalRef.current);
      }
    };
  }, [vips]);

  // Loading state
  if (isLoading && vips.length === 0) {
    return (
      <div className="text-center py-8 space-y-2">
        <div className="text-[var(--muted-foreground)]">Loading VIP list...</div>
        <div className="text-xs text-[var(--muted-foreground)]">
          {sessionStatus === 'loading' ? 'Waiting for session...' : 
           sessionStatus === 'authenticated' && !session?.accessToken ? 'Session authenticated but missing token...' :
           sessionStatus === 'authenticated' ? 'Session ready, fetching data...' : 
           'Session not authenticated'}
        </div>
        <div className="flex justify-center gap-2">
          <Button 
            onClick={() => fetchVIPs(true)}
            className="mt-4 bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-opacity-90"
            size="sm"
          >
            Refresh Now
          </Button>
          {sessionStatus === 'authenticated' && !session?.accessToken && (
            <Button 
              onClick={refreshSession}
              className="mt-4 bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-opacity-90"
              size="sm"
            >
              Refresh Session
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Error state
  if (error && vips.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-[var(--destructive)]">Error: {error}</p>
        <div className="flex justify-center gap-2">
          <Button 
            onClick={() => {
              fetchVIPs(true);
              connectToSSE();
            }}
            className="mt-4 bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-opacity-90"
          >
            Retry
          </Button>
          {sessionStatus === 'authenticated' && !session?.accessToken && (
            <Button 
              onClick={refreshSession}
              className="mt-4 bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-opacity-90"
            >
              Refresh Session
            </Button>
          )}
        </div>
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
          <div className="flex justify-center gap-2 mt-2">
            <Button 
              onClick={() => fetchVIPs(true)}
              className="bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-opacity-90"
              size="sm"
            >
              Refresh
            </Button>
            {sessionStatus === 'authenticated' && !session?.accessToken && (
              <Button 
                onClick={refreshSession}
                className="bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-opacity-90"
                size="sm"
              >
                Refresh Session
              </Button>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="flex justify-between items-center">
            <div className="text-sm text-[var(--muted-foreground)]">
              {vips.length} total VIPs • {channelPointsVIPCount} via Channel Points
            </div>
            <Button 
              onClick={() => fetchVIPs(true)}
              className="bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-opacity-90"
              size="sm"
            >
              Refresh
            </Button>
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
                  <div className="flex flex-col">
                    <div className="flex items-center">
                      <span className="font-semibold">{vip.displayName}</span>
                      {vip.isChannelPointsVIP && (
                        <span className="ml-2 text-xs px-2 py-0.5 bg-[var(--primary)] text-white rounded-full">
                          Channel Points
                        </span>
                      )}
                    </div>
                    <span className="text-sm text-[var(--muted-foreground)]">@{vip.username}</span>
                    {vip.isChannelPointsVIP && vip.expiresAt && (
                      <span className="text-xs text-[var(--muted-foreground)] mt-1">
                        {formatRemainingTime(vip.expiresAt)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  {vip.isChannelPointsVIP && vip.sessionId && (
                    <Button
                      onClick={() => handleExtendVIP(vip)}
                      className="bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-opacity-90"
                      size="sm"
                      title="Extend VIP status by 12 hours"
                    >
                      Extend
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
} 