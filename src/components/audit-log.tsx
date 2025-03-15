'use client';
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow } from 'date-fns';

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
  const { data: session } = useSession();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [indexUrl, setIndexUrl] = useState<string | null>(null);

  useEffect(() => {
    async function fetchLogs() {
      if (!session?.user) return;
      
      try {
        setIsLoading(true);
        setError(null);
        setIndexUrl(null);
        
        let url = `/api/audit-log?channelId=${channelId}&limit=${limit}`;
        if (action) {
          url += `&action=${action}`;
        }
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (!response.ok) {
          // Check if the error contains a Firestore index URL
          if (data.details && data.details.includes('https://console.firebase.google.com')) {
            const match = data.details.match(/https:\/\/console\.firebase\.google\.com[^\s]*/);
            if (match && match[0]) {
              setIndexUrl(match[0]);
            }
          }
          throw new Error(data.message || 'Failed to fetch audit logs');
        }
        
        setLogs(data);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'An error occurred';
        setError(message);
        toast.error(`Error fetching audit logs: ${message}`);
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchLogs();
  }, [channelId, limit, action, session]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold mb-4">Activity Log</h2>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="border border-border rounded-md p-4 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold mb-4">Activity Log</h2>
        <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-md">
          <p className="font-medium">Error loading activity log</p>
          <p className="text-sm mt-1">{error}</p>
          
          {indexUrl && (
            <div className="mt-4 p-4 bg-muted rounded-md">
              <p className="font-medium">Missing Firestore Index</p>
              <p className="text-sm mt-1">
                This error occurs because Firestore requires a composite index for this query.
              </p>
              <p className="text-sm mt-2">
                To fix this issue:
              </p>
              <ol className="list-decimal list-inside text-sm mt-1 space-y-1">
                <li>Click the button below to open the Firebase console</li>
                <li>Sign in with your Google account if prompted</li>
                <li>Click the "Create index" button on the Firebase page</li>
                <li>Wait for the index to be created (this may take a few minutes)</li>
                <li>Return to this page and refresh</li>
              </ol>
              <Button 
                className="mt-4"
                onClick={() => window.open(indexUrl, '_blank')}
              >
                Create Firestore Index
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold mb-4">Activity Log</h2>
        <div className="bg-muted p-4 rounded-md text-center">
          <p>No activity recorded yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold mb-4">Activity Log</h2>
      <div className="space-y-3">
        {logs.map((log) => (
          <div key={log.id} className="border border-border rounded-md p-4">
            <div className="flex justify-between items-start">
              <div>
                <span className="font-medium">{log.action}</span>
                <span className="text-muted-foreground"> by </span>
                <span className="font-medium">{log.username}</span>
              </div>
              <span className="text-sm text-muted-foreground">
                {formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}
              </span>
            </div>
            {log.details && (
              <div className="mt-2 text-sm text-muted-foreground">
                {Object.entries(log.details).map(([key, value]) => (
                  <div key={key}>
                    <span className="font-medium">{key}: </span>
                    <span>{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
} 