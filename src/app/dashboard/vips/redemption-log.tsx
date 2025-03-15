'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate } from '@/lib/utils';

interface AuditLogEntry {
  id: string;
  channelId: string;
  action: 'grant_vip' | 'remove_vip' | 'extend_vip';
  performedBy: string;
  performedByUsername?: string;
  targetUserId?: string;
  targetUsername?: string;
  details?: Record<string, any>;
  timestamp: Date;
}

export default function RedemptionLog() {
  const { data: session } = useSession();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchLogs() {
      if (!session?.user) return;
      
      try {
        setIsLoading(true);
        setError(null);
        
        const response = await fetch(`/api/audit-log?channelId=${session.user.id}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch audit logs');
        }
        
        const data = await response.json();
        setLogs(data);
      } catch (err) {
        console.error('Error fetching audit logs:', err);
        setError('Failed to load audit logs. Please try again.');
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchLogs();
  }, [session]);

  // Filter logs to only show VIP grants and extensions
  const vipLogs = logs.filter(log => 
    log.action === 'grant_vip' || log.action === 'extend_vip'
  );

  function getActionText(log: AuditLogEntry): string {
    switch (log.action) {
      case 'grant_vip':
        return `granted VIP to ${log.targetUsername}`;
      case 'extend_vip':
        const hours = log.details?.hours || 12;
        return `extended VIP for ${log.targetUsername} by ${hours} hours`;
      default:
        return `performed action ${log.action}`;
    }
  }

  function getSourceText(log: AuditLogEntry): string {
    if (log.action === 'grant_vip' && log.details?.grantMethod) {
      switch (log.details.grantMethod) {
        case 'channelPoints':
          return 'via Channel Points';
        case 'subscription':
          return 'via Subscription';
        case 'bits':
          return 'via Bits';
        case 'manual':
          return 'manually';
        default:
          return '';
      }
    }
    return '';
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>VIP Activity Log</CardTitle>
        <CardDescription>
          Recent VIP grants and extensions
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-4">Loading...</div>
        ) : error ? (
          <div className="text-center py-4 text-red-500">{error}</div>
        ) : vipLogs.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground">No VIP activity found</div>
        ) : (
          <div className="space-y-4">
            {vipLogs.map(log => (
              <div key={log.id} className="border-b pb-3 last:border-0">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-medium">
                      {log.performedByUsername || log.performedBy}
                    </span>{' '}
                    {getActionText(log)}{' '}
                    <span className="text-muted-foreground">
                      {getSourceText(log)}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {formatDate(new Date(log.timestamp))}
                  </div>
                </div>
                {log.details?.rewardTitle && (
                  <div className="mt-1 text-sm text-muted-foreground">
                    Reward: {log.details.rewardTitle} ({log.details.rewardCost} points)
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
} 