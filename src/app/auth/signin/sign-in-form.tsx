'use client';

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { TWITCH_CONFIG } from "@/config/twitch";

// Helper function to log to Cloud Run logs via API
const logToCloudRun = async (message: string, data?: any) => {
  try {
    console.log('Sending log:', message, data); // Browser console log for immediate feedback
    await fetch('/api/log', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        data,
        component: 'SignInForm',
        timestamp: new Date().toISOString()
      }),
    });
  } catch (error) {
    console.error('Failed to send log:', error);
  }
};

export default function SignInForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";
  const errorParam = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  useEffect(() => {
    logToCloudRun("SignInForm mounted", {
      callbackUrl,
      currentUrl: window.location.href,
      baseUrl: window.location.origin,
      hasError: !!errorParam,
      errorParam,
      errorDescription,
      clientId: TWITCH_CONFIG.clientId,
      scopes: TWITCH_CONFIG.scopes
    });

    if (errorParam) {
      logToCloudRun("Auth Error", {
        error: errorParam,
        description: errorDescription,
        callbackUrl,
        currentUrl: window.location.href,
        baseUrl: window.location.origin,
        clientId: TWITCH_CONFIG.clientId,
        scopes: TWITCH_CONFIG.scopes
      });
    }
  }, [errorParam, errorDescription, callbackUrl]);

  const handleSignIn = async () => {
    try {
      setIsLoading(true);
      setError(null);

      await signIn("twitch", {
        callbackUrl: "/dashboard"
      });
      
    } catch (err) {
      await logToCloudRun("Sign in error", { 
        error: err instanceof Error ? {
          message: err.message,
          name: err.name,
          stack: err.stack
        } : err,
        currentUrl: window.location.href,
        environment: process.env.NODE_ENV,
        nextAuthUrl: process.env.NEXTAUTH_URL,
        clientId: TWITCH_CONFIG.clientId,
        scopes: TWITCH_CONFIG.scopes
      });
      setError("An error occurred during sign in. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const getErrorMessage = () => {
    if (errorParam === "OAuthCallback") {
      return `There was a problem with the Twitch authentication. Please try signing in again. (Error: ${errorParam}, Description: ${errorDescription || 'No description provided'})`;
    }
    if (errorParam === "AccessDenied") {
      return "Access was denied. Please make sure to grant all required permissions.";
    }
    if (errorDescription) {
      return errorDescription;
    }
    return error || "An error occurred during sign in. Please try again.";
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-2">
      <div className="p-8 bg-white rounded-lg shadow-md dark:bg-gray-800">
        <h1 className="mb-8 text-3xl font-bold text-center text-gray-900 dark:text-white">
          Sign in to Terkv
        </h1>

        {(errorParam || error) && (
          <div className="p-4 mb-4 text-sm text-red-700 bg-red-100 rounded-lg dark:bg-red-200 dark:text-red-800">
            {getErrorMessage()}
          </div>
        )}

        <button
          onClick={handleSignIn}
          disabled={isLoading}
          className={`w-full px-4 py-2 text-white bg-purple-600 rounded hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 ${
            isLoading ? "opacity-50 cursor-not-allowed" : ""
          }`}
        >
          {isLoading ? "Signing in..." : "Sign in with Twitch"}
        </button>

        <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
          <p>Required Twitch scopes:</p>
          <ul className="list-disc list-inside mt-2">
            {TWITCH_CONFIG.scopes.map((scope) => (
              <li key={scope}>{scope}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}