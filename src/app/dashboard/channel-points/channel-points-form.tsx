"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, CheckCircle2, XCircle } from 'lucide-react';

interface ChannelPointReward {
  id: string;
  title: string;
  cost: number;
  isEnabled: boolean;
  backgroundColor?: string;
}

interface ServiceStatus {
  isOnline: boolean;
  lastSeen: Date | null;
  sessionId?: string;
}

interface ChannelPointsFormProps {
  initialChannelId: string;
  initialAccessToken: string;
}

export default function ChannelPointsForm({ initialChannelId, initialAccessToken }: ChannelPointsFormProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingRewards, setIsLoadingRewards] = useState(false);
  const [rewards, setRewards] = useState<ChannelPointReward[]>([]);
  const [selectedRewardId, setSelectedRewardId] = useState<string | null>(null);
  const [rewardTitle, setRewardTitle] = useState('VIP Access');
  const [rewardCost, setRewardCost] = useState(50000);
  const [error, setError] = useState<string | null>(null);
  const [isMonitoringEnabled, setIsMonitoringEnabled] = useState(false);
  const [isUpdatingMonitoring, setIsUpdatingMonitoring] = useState(false);
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
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
        setIsLoadingRewards(true);
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

        setRewards(data);
        fetchMonitorStatus();
      } catch (error) {
        setError(error instanceof Error ? error.message : "Failed to fetch rewards");
        console.error("Error fetching rewards:", error);
      } finally {
        setIsLoadingRewards(false);
      }
    };

    async function fetchMonitorStatus() {
      try {
        const response = await fetch(`/api/redemption-monitor?channelId=${initialChannelId}`);
        
        if (response.ok) {
          const data = await response.json();
          console.log("Monitor status:", data);
          
          // Set monitor status state
          setIsMonitoringEnabled(data.isEnabled || false);
          
          // Set service status
          setServiceStatus({
            isOnline: data.serviceStatus?.isOnline || false,
            lastSeen: data.serviceStatus?.lastSeen ? new Date(data.serviceStatus.lastSeen) : null,
            sessionId: data.serviceStatus?.sessionId
          });
        }
      } catch (error) {
        console.error("Error fetching monitor status:", error);
      }
    }

    if (initialChannelId && initialAccessToken) {
      fetchRewards();
    }
  }, [initialChannelId, initialAccessToken]);

  // Fetch monitoring status
  useEffect(() => {
    async function fetchMonitoringStatus() {
      if (!initialChannelId) return;
      
      setIsLoadingStatus(true);
      try {
        const response = await fetch(`/api/redemption-monitor?channelId=${initialChannelId}`);
        if (response.ok) {
          const data = await response.json();
          setIsMonitoringEnabled(data.isEnabled || false);
          
          // Set service status
          setServiceStatus({
            isOnline: data.serviceStatus?.isOnline || false,
            lastSeen: data.serviceStatus?.lastSeen ? new Date(data.serviceStatus.lastSeen) : null,
            sessionId: data.serviceStatus?.sessionId
          });
        }
      } catch (err) {
        console.error('Error fetching monitoring status:', err);
      } finally {
        setIsLoadingStatus(false);
      }
    }
    
    fetchMonitoringStatus();
    
    // Poll for status updates every 30 seconds
    const intervalId = setInterval(fetchMonitoringStatus, 30000);
    return () => clearInterval(intervalId);
  }, [initialChannelId]);

  const handleSaveReward = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch("/api/channel-points", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          channelId: initialChannelId,
          title: rewardTitle,
          cost: rewardCost,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create channel point reward");
      }

      toast.success("Channel point reward created!");
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to create reward");
      toast.error(error instanceof Error ? error.message : "Failed to create reward");
    } finally {
      setIsLoading(false);
    }
  };

  const handleMonitoringToggle = async () => {
    if (!initialChannelId || !selectedRewardId) return;
    
    setIsUpdatingMonitoring(true);
    try {
      const response = await fetch("/api/redemption-monitor", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          channelId: initialChannelId,
          isEnabled: !isMonitoringEnabled,
          rewardId: selectedRewardId,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update monitoring status");
      }
      
      setIsMonitoringEnabled(!isMonitoringEnabled);
      toast.success(
        !isMonitoringEnabled 
          ? "Monitoring enabled. The service will now grant VIP status for redemptions." 
          : "Monitoring disabled. VIP status will no longer be granted for redemptions."
      );
    } catch (err: any) {
      console.error("Error updating monitoring:", err);
      toast.error(err.message || "Failed to update monitoring status");
    } finally {
      setIsUpdatingMonitoring(false);
    }
  };

  // Format timestamp for display
  function formatTimestamp(date: Date | null): string {
    if (!date) return 'Never';
    
    // Format: "5 minutes ago" or actual date if older than a day
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) {
      return 'Just now';
    } else if (diffMins < 60) {
      return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
    } else if (diffMins < 1440) {
      const hours = Math.floor(diffMins / 60);
      return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    } else {
      return date.toLocaleString();
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {!hasRequiredScopes && !isScopesLoading && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded">
          <p className="font-medium">Missing Required Permissions</p>
          <p className="text-sm">
            To use channel points integration, you need to re-authenticate with the required permissions.
          </p>
          <div className="mt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/auth/signin?callbackUrl=/dashboard/channel-points')}
            >
              Re-authenticate
            </Button>
          </div>
        </div>
      )}

      {/* Service Status Card */}
      <Card>
        <CardHeader>
          <CardTitle>EventSub Service Status</CardTitle>
          <CardDescription>
            Status of the standalone service that monitors channel point redemptions
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingStatus ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <AlertCircle className="h-5 w-5" />
              <span>Checking service status...</span>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                {serviceStatus?.isOnline ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500" />
                )}
                <span className="font-medium">
                  Service is {serviceStatus?.isOnline ? 'online' : 'offline'}
                </span>
              </div>
              
              <div className="text-sm text-muted-foreground">
                <p>Last activity: {formatTimestamp(serviceStatus?.lastSeen || null)}</p>
                {serviceStatus?.sessionId && (
                  <p className="mt-1">Session ID: {serviceStatus.sessionId}</p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Existing Reward Card */}
      <Card>
        <CardHeader>
          <CardTitle>Channel Point Reward</CardTitle>
          <CardDescription>
            Create a channel point reward that viewers can redeem for VIP status
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 p-3 rounded-md border border-red-200 bg-red-50 text-red-800">
              {error}
            </div>
          )}
          
          {isLoadingRewards ? (
            <div className="text-center py-4 text-muted-foreground">Loading rewards...</div>
          ) : rewards.length > 0 ? (
            <div className="space-y-6">
              <div>
                <Label>Existing Rewards</Label>
                <div className="grid gap-2 mt-2">
                  {rewards.map((reward) => (
                    <div 
                      key={reward.id}
                      className={`p-3 rounded-md border ${selectedRewardId === reward.id 
                        ? 'border-primary bg-primary/5' 
                        : 'border-border'}`}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <h4 className="font-medium">{reward.title}</h4>
                          <p className="text-sm text-muted-foreground">
                            {reward.cost.toLocaleString()} points
                          </p>
                        </div>
                        <Button
                          variant={selectedRewardId === reward.id ? "default" : "outline"}
                          size="sm"
                          onClick={() => setSelectedRewardId(reward.id)}
                          disabled={isLoading}
                        >
                          {selectedRewardId === reward.id ? "Selected" : "Select"}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              {!selectedRewardId && (
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Reward Title</Label>
                    <Input
                      id="title"
                      placeholder="VIP Access"
                      value={rewardTitle}
                      onChange={(e) => setRewardTitle(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cost">Cost (Channel Points)</Label>
                    <Input
                      id="cost"
                      type="number"
                      min="1"
                      max="1000000"
                      placeholder="50000"
                      value={rewardCost}
                      onChange={(e) => setRewardCost(parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <Button
                    disabled={isLoading || !rewardTitle || rewardCost < 1}
                    onClick={handleSaveReward}
                  >
                    {isLoading ? "Creating..." : "Create Reward"}
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="title">Reward Title</Label>
                <Input
                  id="title"
                  placeholder="VIP Access"
                  value={rewardTitle}
                  onChange={(e) => setRewardTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cost">Cost (Channel Points)</Label>
                <Input
                  id="cost"
                  type="number"
                  min="1"
                  max="1000000"
                  placeholder="50000"
                  value={rewardCost}
                  onChange={(e) => setRewardCost(parseInt(e.target.value) || 0)}
                />
              </div>
              <Button
                disabled={isLoading || !rewardTitle || rewardCost < 1}
                onClick={handleSaveReward}
              >
                {isLoading ? "Creating..." : "Create Reward"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Monitoring Settings Card */}
      {selectedRewardId && (
        <Card>
          <CardHeader>
            <CardTitle>Monitoring Settings</CardTitle>
            <CardDescription>
              Control whether VIP status is automatically granted for redemptions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">Enable VIP Granting</h4>
                <p className="text-sm text-muted-foreground">
                  When enabled, viewers who redeem the selected reward will automatically receive VIP status
                </p>
              </div>
              <Switch
                checked={isMonitoringEnabled}
                onCheckedChange={handleMonitoringToggle}
                disabled={isUpdatingMonitoring || !serviceStatus?.isOnline}
              />
            </div>
            
            {!serviceStatus?.isOnline && (
              <div className="p-3 rounded-md border border-yellow-200 bg-yellow-50 text-yellow-800">
                <p className="text-sm">
                  The EventSub service is currently offline. Monitoring cannot be enabled until the service is back online.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
} 