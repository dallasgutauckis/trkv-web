"use client";

import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

export default function DashboardHeader() {
  const handleSignOut = () => {
    signOut({ callbackUrl: "/" });
  };

  return (
    <header className="border-b">
      <div className="container mx-auto py-4 px-4 flex justify-between items-center">
        <h1 className="text-xl font-semibold">Twitch VIP Manager</h1>
        <Button
          variant="outline"
          onClick={handleSignOut}
          className="text-sm"
        >
          Sign Out
        </Button>
      </div>
    </header>
  );
} 