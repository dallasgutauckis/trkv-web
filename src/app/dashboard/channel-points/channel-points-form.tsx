"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Switch } from '@/components/ui/switch';

interface ChannelPointReward {
  id: string;
  title: string;
  cost: number;
  isEnabled: boolean;
  prompt?: string;
  backgroundColor?: string;
}

interface ChannelPointsFormProps {
  initialChannelId: string;
  initialAccessToken: string;
}

export default function ChannelPointsForm({ initialChannelId, initialAccessToken }: ChannelPointsFormProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [rewards, setRewards] = useState<ChannelPointReward[]>([]);
  const [selectedRewardId, setSelectedRewardId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isMonitoringEnabled, setIsMonitoringEnabled] = useState(false);
  const [isMonitoringSaving, setIsMonitoringSaving] = useState(false);
  const [monitorStatus, setMonitorStatus] = useState<{ isActive: boolean; rewardId: string } | null>(null);
  const [userScopes, setUserScopes] = useState<string[]>([]);
  const [isScopesLoading, setIsScopesLoading] = useState(true);

  // Check if user has required scopes
  useEffect(() => {
    async function checkScopes() {
      if (!session?.user) return;
      
      try {
        setIsScopesLoading(true);
        const response = await fetch(`/api/settings/scopes?userId=${session.user.id}`);
        
        if (response.ok) {
          const data = await response.json();
          setUserScopes(data.scopes || []);
        }
      } catch (error) {
        console.error('Error checking scopes:', error);
      } finally {
        setIsScopesLoading(false);
      }
    }
    
    checkScopes();
  }, [session]);

  // Check if user has required scopes for channel point redemptions
  const requiredScopes = ['channel:read:redemptions', 'channel:manage:redemptions'];
  const hasRequiredScopes = requiredScopes.every(scope => userScopes.includes(scope));

  // Fetch rewards and saved settings
  useEffect(() => {
    const fetchRewards = async () => {
      try {
        setError(null);
        setIsFetching(true);
        console.log("Starting fetchRewards in ChannelPointsForm:", {
          channelId: initialChannelId,
          hasAccessToken: !!initialAccessToken,
          accessTokenPrefix: initialAccessToken ? initialAccessToken.slice(0, 10) + '...' : 'none'
        });
        
        // Fetch rewards from Twitch
        const response = await fetch(`/api/channel-points?channelId=${initialChannelId}`, {
          headers: {
            "Authorization": `Bearer ${initialAccessToken}`,
          },
        });

        const data = await response.json();
        console.log("API Response:", {
          status: response.status,
          ok: response.ok,
          data: data
        });

        if (!response.ok) {
          const errorMessage = data.error || "Failed to fetch rewards";
          console.error("API error:", errorMessage);
          throw new Error(errorMessage);
        }

        if (!Array.isArray(data)) {
          console.error("Invalid response format:", data);
          throw new Error("Invalid response format from API");
        }

        // Validate each reward
        const validRewards = data.filter((reward): reward is ChannelPointReward => {
          if (!reward || typeof reward !== 'object') {
            console.warn("Invalid reward object:", reward);
            return false;
          }

          if (!reward.id || !reward.title || typeof reward.cost !== 'number') {
            console.warn("Reward missing required fields:", {
              hasId: !!reward.id,
              hasTitle: !!reward.title,
              costType: typeof reward.cost,
              reward: reward
            });
            return false;
          }

          return true;
        });

        console.log("Processed rewards:", {
          total: data.length,
          valid: validRewards.length,
          rewards: validRewards
        });
        
        setRewards(validRewards);
        
        // Fetch saved settings
        try {
          const settingsResponse = await fetch(`/api/settings?channelId=${initialChannelId}`, {
            headers: {
              "Authorization": `Bearer ${initialAccessToken}`,
            },
          });
          
          if (settingsResponse.ok) {
            const settingsData = await settingsResponse.json();
            if (settingsData && settingsData.channelPointRewardId) {
              console.log("Found saved reward ID:", settingsData.channelPointRewardId);
              setSelectedRewardId(settingsData.channelPointRewardId);
            }
          }
        } catch (settingsError) {
          console.error("Error fetching settings:", settingsError);
          // Don't throw here, just continue with empty selection
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load channel point rewards";
        console.error("Error in fetchRewards:", {
          error: error instanceof Error ? error.message : error,
          channelId: initialChannelId,
          hasAccessToken: !!initialAccessToken,
          stack: error instanceof Error ? error.stack : undefined
        });
        setError(message);
        toast.error(message);
      } finally {
        setIsFetching(false);
      }
    };

    fetchRewards();
  }, [initialChannelId, initialAccessToken]);

  // Add a new useEffect to fetch the monitoring status
  useEffect(() => {
    async function fetchMonitorStatus() {
      if (!session?.user) return;
      
      try {
        const response = await fetch(`/api/redemption-monitor?channelId=${session.user.id}`);
        
        if (response.ok) {
          const data = await response.json();
          if (data.monitor) {
            setMonitorStatus(data.monitor);
            setIsMonitoringEnabled(data.monitor.isActive);
          }
        }
      } catch (error) {
        console.error('Error fetching monitor status:', error);
      }
    }
    
    fetchMonitorStatus();
  }, [session]);

  const selectedReward = rewards.find(r => r.id === selectedRewardId);
  console.log("Current rewards:", rewards);
  console.log("Selected reward:", selectedReward);
  
  // Save the selected reward
  const handleSaveReward = async () => {
    if (!selectedRewardId) {
      toast.error("Please select a reward first");
      return;
    }
    
    try {
      setIsSaving(true);
      setError(null);
      
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          "Authorization": `Bearer ${initialAccessToken}`,
        },
        body: JSON.stringify({
          channelId: initialChannelId,
          channelPointRewardId: selectedRewardId,
        }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save settings");
      }
      
      toast.success("Channel point reward saved successfully");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save settings";
      console.error("Error saving settings:", error);
      setError(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  // Add a function to save the monitoring settings
  const saveMonitoringSettings = async () => {
    if (!session?.user || !selectedReward) return;
    
    try {
      setIsMonitoringSaving(true);
      
      // If enabling monitoring, force initialize the service
      if (isMonitoringEnabled) {
        console.log('Enabling monitoring for reward:', selectedReward.id);
      } else {
        console.log('Disabling monitoring');
      }
      
      const response = await fetch('/api/redemption-monitor', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channelId: session.user.id,
          rewardId: selectedReward.id,
          isActive: isMonitoringEnabled,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update monitoring settings');
      }
      
      const data = await response.json();
      setMonitorStatus(data.monitor);
      
      toast.success(isMonitoringEnabled 
        ? 'Automatic VIP granting enabled!' 
        : 'Automatic VIP granting disabled');
    } catch (error) {
      console.error('Error saving monitoring settings:', error);
      toast.error('Failed to update monitoring settings');
    } finally {
      setIsMonitoringSaving(false);
    }
  };

  if (!hasRequiredScopes && !isScopesLoading) {
    return (
      <div className="space-y-4">
        <div className="p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg">
          <h3 className="font-semibold text-lg mb-2">Missing Required Permissions</h3>
          <p className="mb-2">
            Your Twitch account is missing the following permissions required for channel point redemptions:
          </p>
          <ul className="list-disc list-inside mb-4">
            {requiredScopes.filter(scope => !userScopes.includes(scope)).map(scope => (
              <li key={scope}>{scope}</li>
            ))}
          </ul>
          <p className="mb-4">
            Please go to the Settings page and re-authenticate with Twitch to grant these permissions.
          </p>
          <Button 
            onClick={() => router.push('/dashboard/settings')}
            variant="destructive"
          >
            Go to Settings
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="p-6 bg-background border-border rounded-lg border shadow-sm">
        <h2 className="text-xl font-semibold mb-4">Select a Channel Point Reward</h2>
        {isFetching ? (
          <div className="text-center py-4">Loading rewards...</div>
        ) : error ? (
          <div className="text-red-500">{error}</div>
        ) : rewards.length === 0 ? (
          <div className="text-muted-foreground">No channel point rewards found.</div>
        ) : (
          <div className="space-y-4">
            <div className="relative">
              <select
                value={selectedRewardId}
                onChange={(e) => setSelectedRewardId(e.target.value)}
                className="w-full p-2 pr-8 bg-background border-border rounded border"
              >
                <option value="">Select a reward...</option>
                {rewards.map((reward) => (
                  <option key={reward.id} value={reward.id}>
                    {reward.title} ({reward.cost} points)
                  </option>
                ))}
              </select>
            </div>

            {selectedReward && (
              <div className="p-4 rounded-md border border-border bg-background/50">
                <h3 className="font-medium mb-2">Selected Reward Details</h3>
                <p><strong>Title:</strong> {selectedReward.title}</p>
                <p><strong>Cost:</strong> {selectedReward.cost.toLocaleString()} points</p>
                <p><strong>Status:</strong> {selectedReward.isEnabled ? 'Enabled' : 'Disabled'}</p>
                {selectedReward.prompt && (
                  <p><strong>Description:</strong> {selectedReward.prompt}</p>
                )}
                {selectedReward.backgroundColor && (
                  <div className="mt-2 flex items-center">
                    <span className="mr-2"><strong>Color:</strong></span>
                    <div 
                      className="w-6 h-6 rounded-full border border-border" 
                      style={{ backgroundColor: selectedReward.backgroundColor }}
                    ></div>
                  </div>
                )}
                
                <div className="mt-4">
                  <Button
                    onClick={handleSaveReward}
                    disabled={isSaving}
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    {isSaving ? "Saving..." : "Save Selection"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Add monitoring settings section */}
      {selectedReward && (
        <div className="mt-8 p-6 bg-background border-border rounded-lg border shadow-sm">
          <h3 className="text-xl font-semibold mb-4">Automatic VIP Granting</h3>
          <p className="text-muted-foreground mb-6">
            When enabled, viewers who redeem this reward will automatically be granted VIP status
            for the duration set in your VIP settings.
          </p>
          
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium">Enable automatic VIP granting</h4>
              <p className="text-sm text-muted-foreground">
                Viewers will receive VIP status immediately upon redemption
              </p>
            </div>
            <Switch
              checked={isMonitoringEnabled}
              onCheckedChange={setIsMonitoringEnabled}
              disabled={isMonitoringSaving || !selectedReward}
            />
          </div>
          
          <div className="mt-6">
            <Button
              onClick={saveMonitoringSettings}
              disabled={isMonitoringSaving || !selectedReward}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {isMonitoringSaving ? 'Saving...' : 'Save Monitoring Settings'}
            </Button>
          </div>
          
          {monitorStatus && (
            <div className="mt-4 text-sm">
              <p className="text-muted-foreground">
                Status: <span className={monitorStatus.isActive ? 'text-green-500' : 'text-yellow-500'}>
                  {monitorStatus.isActive ? 'Active' : 'Inactive'}
                </span>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
} 