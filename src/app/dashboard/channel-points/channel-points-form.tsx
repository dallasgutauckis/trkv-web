"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";

export default function ChannelPointsForm() {
  const { data: session } = useSession();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: "VIP Status (12 Hours)",
    cost: 5000,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch("/api/channel-points", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          channelId: session?.user?.id,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create reward");
      }

      toast.success("Channel point reward created successfully!");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div>
          <label
            htmlFor="title"
            className="block text-sm font-medium text-gray-700"
          >
            Reward Title
          </label>
          <input
            type="text"
            id="title"
            value={formData.title}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, title: e.target.value }))
            }
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
            maxLength={45}
            required
          />
          <p className="mt-1 text-sm text-gray-500">
            Maximum 45 characters
          </p>
        </div>

        <div>
          <label
            htmlFor="cost"
            className="block text-sm font-medium text-gray-700"
          >
            Cost (Channel Points)
          </label>
          <input
            type="number"
            id="cost"
            value={formData.cost}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                cost: parseInt(e.target.value, 10),
              }))
            }
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
            min={1}
            max={1000000}
            required
          />
          <p className="mt-1 text-sm text-gray-500">
            Between 1 and 1,000,000 points
          </p>
        </div>
      </div>

      <Button
        type="submit"
        disabled={isLoading}
        className="w-full bg-purple-600 hover:bg-purple-700"
      >
        {isLoading ? "Creating..." : "Create Channel Point Reward"}
      </Button>
    </form>
  );
} 