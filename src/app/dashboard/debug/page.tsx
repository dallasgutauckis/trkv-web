'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Loader2, RefreshCw } from 'lucide-react';

interface EventSubListener {
  channelId: string;
  rewardId: string;
  isListenerActive: boolean;
  hasSubscription: boolean;
}

export default function DebugPage() {
  const { data: session } = useSession();
  const [isLoading, setIsLoading] = useState(true);
  const [listeners, setListeners] = useState<EventSubListener[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  const fetchListeners = async () => {
    if (!session?.user) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch('/api/debug/eventsub');
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch EventSub listeners');
      }
      
      const data = await response.json();
      setListeners(data.activeListeners || []);
    } catch (error) {
      console.error('Error fetching EventSub listeners:', error);
      setError(error instanceof Error ? error.message : 'An error occurred');
      toast.error('Failed to fetch EventSub listeners');
    } finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    fetchListeners();
  }, [session]);
  
  const handleRefresh = () => {
    fetchListeners();
  };
  
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">EventSub Debug</h1>
        <Button onClick={handleRefresh} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>
      
      {isLoading ? (
        <div className="flex justify-center items-center h-40">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-md">
          <p className="font-medium">Error loading EventSub listeners</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      ) : listeners.length === 0 ? (
        <div className="bg-muted p-4 rounded-md text-center">
          <p>No active EventSub listeners found.</p>
          <p className="text-sm text-muted-foreground mt-2">
            Try enabling monitoring on the Channel Points page.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Found {listeners.length} active EventSub listener{listeners.length !== 1 ? 's' : ''}
          </p>
          
          {listeners.map((listener, index) => (
            <Card key={index} className="p-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="font-medium">Channel ID:</span>
                  <span>{listener.channelId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Reward ID:</span>
                  <span>{listener.rewardId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Listener Active:</span>
                  <span className={listener.isListenerActive ? 'text-green-500' : 'text-red-500'}>
                    {listener.isListenerActive ? 'Yes' : 'No'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Has Subscription:</span>
                  <span className={listener.hasSubscription ? 'text-green-500' : 'text-red-500'}>
                    {listener.hasSubscription ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>
            </Card>
          ))}
          
          <div className="mt-8">
            <h2 className="text-xl font-semibold mb-4">Troubleshooting</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>Make sure you have the required scopes: <code>channel:read:redemptions</code> and <code>channel:manage:redemptions</code></li>
              <li>Check that you have selected a channel point reward on the Channel Points page</li>
              <li>Ensure that monitoring is enabled for the selected reward</li>
              <li>Try disabling and re-enabling monitoring</li>
              <li>Check the browser console for any errors</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
} 