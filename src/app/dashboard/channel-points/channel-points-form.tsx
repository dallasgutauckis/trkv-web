"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";

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

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 text-sm bg-[var(--destructive)] bg-opacity-10 text-[var(--destructive)] rounded-lg">
          {error}
        </div>
      )}
      
      <div className="space-y-4">
        <div>
          <label
            htmlFor="reward"
            className="block text-sm font-medium text-[var(--card-foreground)]"
          >
            Select Existing Reward
          </label>
          <select
            id="reward"
            value={selectedRewardId}
            onChange={(e) => setSelectedRewardId(e.target.value)}
            className="mt-1 block w-full rounded-md border border-[var(--border)] bg-[var(--input)] text-[var(--input-foreground)] px-3 py-2 text-sm focus:border-[var(--ring)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
            disabled={isFetching}
          >
            <option value="">
              {isFetching ? "Loading rewards..." : "Select a reward"}
            </option>
            {rewards.map((reward) => (
              <option 
                key={reward.id} 
                value={reward.id}
              >
                {reward.title} ({reward.cost.toLocaleString()} points)
                {reward.isEnabled === false ? ' (Disabled)' : ''}
              </option>
            ))}
          </select>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            {isFetching ? "Loading rewards..." :
              rewards.length > 0 
                ? `${rewards.length} existing reward${rewards.length === 1 ? '' : 's'} found` 
                : "No channel point rewards found"
            }
          </p>
        </div>

        {selectedReward && (
          <div className="p-4 rounded-md border border-[var(--border)] bg-[var(--accent)] bg-opacity-50">
            <h3 className="font-medium mb-2 text-[var(--card-foreground)]">Selected Reward Details</h3>
            <p className="text-[var(--card-foreground)]"><strong>Title:</strong> {selectedReward.title}</p>
            <p className="text-[var(--card-foreground)]"><strong>Cost:</strong> {selectedReward.cost.toLocaleString()} points</p>
            <p className="text-[var(--card-foreground)]"><strong>Status:</strong> {selectedReward.isEnabled ? 'Enabled' : 'Disabled'}</p>
            {selectedReward.prompt && (
              <p className="text-[var(--card-foreground)]"><strong>Description:</strong> {selectedReward.prompt}</p>
            )}
            {selectedReward.backgroundColor && (
              <div className="mt-2 flex items-center">
                <span className="text-[var(--card-foreground)] mr-2"><strong>Color:</strong></span>
                <div 
                  className="w-6 h-6 rounded-full border border-[var(--border)]" 
                  style={{ backgroundColor: selectedReward.backgroundColor }}
                ></div>
              </div>
            )}
            
            <div className="mt-4">
              <Button
                onClick={handleSaveReward}
                disabled={isSaving}
                className="bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-opacity-90"
              >
                {isSaving ? "Saving..." : "Save Selection"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 