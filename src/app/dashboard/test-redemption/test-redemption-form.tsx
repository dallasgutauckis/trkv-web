'use client';

import { useState, useEffect, ChangeEvent } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

interface TestRedemptionFormProps {
  channelId: string;
}

export default function TestRedemptionForm({ channelId }: TestRedemptionFormProps) {
  const { data: session } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [userId, setUserId] = useState('');
  const [username, setUsername] = useState('');
  const [rewardId, setRewardId] = useState('');
  const [rewardTitle, setRewardTitle] = useState('Test Reward');
  const [rewardCost, setRewardCost] = useState('1000');
  const [savedRewardId, setSavedRewardId] = useState<string | null>(null);
  const [isFetchingReward, setIsFetchingReward] = useState(true);
  
  // Fetch the saved reward ID
  useEffect(() => {
    async function fetchSavedReward() {
      if (!session?.user) return;
      
      try {
        setIsFetchingReward(true);
        const response = await fetch(`/api/redemption-monitor?channelId=${channelId}`);
        
        if (response.ok) {
          const data = await response.json();
          if (data.monitor && data.monitor.rewardId) {
            setSavedRewardId(data.monitor.rewardId);
            setRewardId(data.monitor.rewardId);
          }
        }
      } catch (error) {
        console.error('Error fetching saved reward:', error);
      } finally {
        setIsFetchingReward(false);
      }
    }
    
    fetchSavedReward();
  }, [session, channelId]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!userId || !username || !rewardId) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    try {
      setIsLoading(true);
      
      const response = await fetch('/api/test-redemption', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channelId,
          userId,
          username,
          rewardId,
          rewardTitle,
          rewardCost: parseInt(rewardCost, 10),
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to process test redemption');
      }
      
      const data = await response.json();
      
      if (data.success) {
        toast.success(`Successfully ${data.result.action} VIP status for ${username}`);
      } else {
        toast.error('Failed to process test redemption');
      }
    } catch (error) {
      console.error('Error processing test redemption:', error);
      toast.error(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <Card className="p-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4">
          <div>
            <Label htmlFor="userId">User ID (required)</Label>
            <Input
              id="userId"
              value={userId}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setUserId(e.target.value)}
              placeholder="Enter Twitch user ID"
              required
            />
            <p className="text-sm text-muted-foreground mt-1">
              The Twitch ID of the user to grant/extend VIP status
            </p>
          </div>
          
          <div>
            <Label htmlFor="username">Username (required)</Label>
            <Input
              id="username"
              value={username}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setUsername(e.target.value)}
              placeholder="Enter Twitch username"
              required
            />
            <p className="text-sm text-muted-foreground mt-1">
              The Twitch username of the user
            </p>
          </div>
          
          <div>
            <Label htmlFor="rewardId">Reward ID (required)</Label>
            <Input
              id="rewardId"
              value={rewardId}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setRewardId(e.target.value)}
              placeholder="Enter reward ID"
              required
            />
            {savedRewardId && (
              <p className="text-sm text-green-500 mt-1">
                Using your saved reward ID
              </p>
            )}
          </div>
          
          <div>
            <Label htmlFor="rewardTitle">Reward Title</Label>
            <Input
              id="rewardTitle"
              value={rewardTitle}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setRewardTitle(e.target.value)}
              placeholder="Enter reward title"
            />
          </div>
          
          <div>
            <Label htmlFor="rewardCost">Reward Cost</Label>
            <Input
              id="rewardCost"
              type="number"
              value={rewardCost}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setRewardCost(e.target.value)}
              placeholder="Enter reward cost"
            />
          </div>
        </div>
        
        <Button type="submit" disabled={isLoading || isFetchingReward} className="w-full">
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            'Test Redemption'
          )}
        </Button>
      </form>
    </Card>
  );
} 