'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import AuditLog from '@/components/audit-log';
import { useEventStream } from '@/hooks/use-event-stream';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Wifi, WifiOff } from 'lucide-react';

export default function VIPActivityPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  // Set up real-time event stream
  const { isConnected, error } = useEventStream(session?.user?.id);
  
  // Redirect if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);
  
  if (status === 'loading') {
    return <div>Loading...</div>;
  }
  
  if (!session?.user) {
    return null; // Will redirect in useEffect
  }
  
  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-6">VIP Activity</h1>
      
      {/* Connection status */}
      {isConnected ? (
        <Alert className="mb-6 bg-green-900/20 border-green-800">
          <Wifi className="h-4 w-4 text-green-500" />
          <AlertTitle className="text-green-500">Connected</AlertTitle>
          <AlertDescription>
            You will receive real-time updates when VIP status changes occur.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert className="mb-6 bg-yellow-900/20 border-yellow-800">
          <WifiOff className="h-4 w-4 text-yellow-500" />
          <AlertTitle className="text-yellow-500">Not Connected</AlertTitle>
          <AlertDescription>
            {error || "You won't receive real-time updates. Refresh the page to reconnect."}
          </AlertDescription>
        </Alert>
      )}
      
      <p className="text-muted-foreground mb-8">
        View a log of all VIP-related actions in your channel. Updates appear in real-time when connected.
      </p>
      
      <AuditLog 
        channelId={session.user.id} 
        limit={100}
      />
    </div>
  );
} 