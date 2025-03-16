'use client';
import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow } from 'date-fns';
import { useEventStream, EventSubEvent } from '@/hooks/use-event-stream';

interface AuditLogEntry {
  id: string;
  channelId: string;
  action: string;
  username: string;
  userId: string;
  timestamp: string;
  details?: Record<string, any>;
}

interface AuditLogProps {
  channelId: string;
  limit?: number;
  action?: string;
}

export default function AuditLog({ channelId, limit = 50, action }: AuditLogProps) {
  const { data: session, status: sessionStatus } = useSession();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Connect to the event stream
  const { events, isConnected, error: streamError } = useEventStream(channelId);
  
  // Keep track of processed events to avoid duplicates
  const processedEventIds = useRef<Set<string>>(new Set());

  // Fetch initial logs
  useEffect(() => {
    async function fetchLogs() {
      if (!session?.user || sessionStatus !== 'authenticated') return;
      
      try {
        setIsLoading(true);
        setError(null);
        
        let url = `/api/audit-log?channelId=${channelId}&limit=${limit}`;
        if (action) {
          url += `&action=${action}`;
        }
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.message || 'Failed to fetch audit logs');
        }
        
        setLogs(data.logs || []);
      } catch (err) {
        console.error('Error fetching audit logs:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch audit logs');
        toast.error('Failed to fetch audit logs');
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchLogs();
  }, [session, sessionStatus, channelId, limit, action]);

  // Process new events
  useEffect(() => {
    if (!events?.length) return;

    for (const event of events) {
      // Skip CONNECTED events
      if (event.type === 'CONNECTED') continue;

      // Generate a unique ID for the event
      const eventId = `${event.type}-${event.channelId}-${event.data?.userId}-${event.timestamp}`;

      // Skip if we've already processed this event
      if (processedEventIds.current.has(eventId)) {
        continue;
      }

      // Mark event as processed
      processedEventIds.current.add(eventId);

      // Convert event to log entry
      const logEntry: AuditLogEntry = {
        id: eventId,
        channelId: event.channelId,
        action: event.type,
        username: event.data?.username || 'Unknown',
        userId: event.data?.userId || 'unknown',
        timestamp: new Date(event.timestamp).toISOString(),
        details: event.data
      };

      // Add to beginning of logs if it matches the action filter
      if (!action || action === event.type) {
        setLogs(prevLogs => {
          const newLogs = [logEntry, ...(prevLogs || [])];
          return newLogs.slice(0, limit);
        });
      }
    }
  }, [events, action, limit]);

  // Show loading state
  if (sessionStatus === 'loading' || isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  // Show error state
  if (error || streamError) {
    return (
      <div className="text-red-500">
        <p>{error || streamError}</p>
        <Button onClick={() => window.location.reload()} className="mt-4">
          Retry
        </Button>
      </div>
    );
  }

  // Show empty state
  if (!logs?.length) {
    return (
      <div className="text-center py-8 text-gray-400">
        <p>No activity recorded yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {logs.map((log) => (
        <div
          key={log.id}
          className="bg-[#1F1F23] border border-[#2D2D30] rounded-lg p-4"
        >
          <div className="flex justify-between items-start mb-2">
            <div>
              <span className="font-medium">{log.username}</span>
              <span className="text-gray-400 mx-2">•</span>
              <span className="text-gray-400">
                {formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}
              </span>
            </div>
            <div className="text-sm">
              {log.action === 'VIP_GRANTED' && (
                <span className="text-green-400">VIP Granted</span>
              )}
              {log.action === 'VIP_EXTENDED' && (
                <span className="text-blue-400">VIP Extended</span>
              )}
              {log.action === 'VIP_GRANT_FAILED' && (
                <span className="text-red-400">Grant Failed</span>
              )}
            </div>
          </div>
          {log.details && (
            <div className="text-sm text-gray-400 mt-2">
              {log.details.error && (
                <p className="text-red-400">{log.details.error}</p>
              )}
              {log.details.duration && (
                <p>Duration: {log.details.duration} days</p>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
} 