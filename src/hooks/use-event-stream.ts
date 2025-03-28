'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';

// Event types from the server
export type EventSubEventType = 
  | 'VIP_GRANTED' 
  | 'VIP_EXTENDED' 
  | 'VIP_GRANT_FAILED' 
  | 'SUBSCRIPTION_CREATED' 
  | 'SUBSCRIPTION_FAILED'
  | 'CONNECTED';

export interface EventSubEvent {
  type: EventSubEventType;
  channelId: string;
  timestamp: Date;
  data?: any;
}

/**
 * Hook to connect to the SSE endpoint and receive real-time events
 */
export function useEventStream(channelId?: string) {
  const { data: session } = useSession();
  const [events, setEvents] = useState<EventSubEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Function to add a new event to the events array
  const addEvent = useCallback((eventData: EventSubEvent) => {
    console.log('Received event:', eventData.type, eventData.data?.username);
    
    setEvents(prev => {
      // Check if we already have this event (by comparing type, timestamp, and user)
      const isDuplicate = prev.some(e => 
        e.type === eventData.type && 
        e.channelId === eventData.channelId &&
        e.data?.userId === eventData.data?.userId &&
        Math.abs(new Date(e.timestamp).getTime() - new Date(eventData.timestamp).getTime()) < 5000
      );
      
      if (isDuplicate) {
        console.log('Duplicate event detected, skipping');
        return prev;
      }
      
      // Add the new event at the beginning
      return [eventData, ...prev].slice(0, 100); // Keep last 100 events
    });
    
    // Show toast for important events
    if (eventData.type === 'VIP_GRANTED') {
      toast.success(`VIP granted to ${eventData.data?.username}`);
    } else if (eventData.type === 'VIP_EXTENDED') {
      toast.success(`VIP extended for ${eventData.data?.username}`);
    } else if (eventData.type === 'VIP_GRANT_FAILED') {
      toast.error(`Failed to grant VIP to ${eventData.data?.username}: ${eventData.data?.error}`);
    }
  }, []);

  useEffect(() => {
    if (!session?.user || !channelId) return;

    let eventSource: EventSource | null = null;
    let retryCount = 0;
    const maxRetries = 5;
    const retryDelay = 2000; // 2 seconds

    const connectEventSource = () => {
      try {
        // Close any existing connection
        if (eventSource) {
          eventSource.close();
        }

        // Create a new EventSource connection
        eventSource = new EventSource(`/api/events?channelId=${channelId}`);
        
        // Handle connection open
        eventSource.onopen = () => {
          console.log('EventSource connection opened');
          setIsConnected(true);
          setError(null);
          retryCount = 0;
        };
        
        // Handle messages
        eventSource.onmessage = (event) => {
          try {
            const eventData = JSON.parse(event.data) as EventSubEvent;
            console.log('Received SSE message:', eventData);
            
            // Convert timestamp string to Date object
            if (typeof eventData.timestamp === 'string') {
              eventData.timestamp = new Date(eventData.timestamp);
            }
            
            // Process the event
            addEvent(eventData);
          } catch (error) {
            console.error('Error parsing event data:', error);
          }
        };
        
        // Handle errors
        eventSource.onerror = (err) => {
          console.error('EventSource error:', err);
          setIsConnected(false);
          
          // Close the connection
          eventSource?.close();
          
          // Retry connection if not exceeding max retries
          if (retryCount < maxRetries) {
            retryCount++;
            setError(`Connection lost. Retrying (${retryCount}/${maxRetries})...`);
            setTimeout(connectEventSource, retryDelay);
          } else {
            setError('Failed to connect to event stream after multiple attempts');
          }
        };
      } catch (error) {
        console.error('Error setting up EventSource:', error);
        setIsConnected(false);
        setError('Failed to connect to event stream');
      }
    };

    // Initial connection
    connectEventSource();

    // Cleanup on unmount
    return () => {
      if (eventSource) {
        console.log('Closing EventSource connection');
        eventSource.close();
      }
    };
  }, [session, channelId, addEvent]);

  return {
    events,
    isConnected,
    error
  };
} 