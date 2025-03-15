import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getUser } from '@/lib/db';
import { TWITCH_CONFIG } from '@/config/twitch';
import { Button } from '@/components/ui/button';
import { signOut } from 'next-auth/react';

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    redirect('/auth/signin');
  }
  
  const user = await getUser(session.user.id);
  const userScopes = user?.tokens?.scope || [];
  
  // Check if user has all required scopes
  const requiredScopes = [
    'channel:read:redemptions',
    'channel:manage:redemptions',
    'channel:read:vips',
    'channel:manage:vips'
  ];
  
  const missingScopes = requiredScopes.filter(scope => !userScopes.includes(scope));
  const hasAllScopes = missingScopes.length === 0;
  
  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>
      
      <div className="space-y-8">
        <div className="bg-card rounded-lg border p-6">
          <h2 className="text-xl font-semibold mb-4">Twitch Authentication</h2>
          
          <div className="space-y-4">
            <div>
              <h3 className="font-medium mb-2">Current Scopes</h3>
              <div className="bg-muted p-4 rounded-md overflow-x-auto">
                <code className="text-sm whitespace-pre-wrap">
                  {userScopes.length > 0 ? userScopes.join(', ') : 'No scopes found'}
                </code>
              </div>
            </div>
            
            {!hasAllScopes && (
              <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-md">
                <p className="font-medium">Missing Required Permissions</p>
                <p className="text-sm mt-1">
                  Your account is missing some permissions required for full functionality:
                </p>
                <ul className="list-disc list-inside text-sm mt-2">
                  {missingScopes.map(scope => (
                    <li key={scope}>{scope}</li>
                  ))}
                </ul>
                <p className="text-sm mt-2">
                  Please sign out and sign in again to grant these permissions.
                </p>
                <form action={async () => {
                  'use server';
                  await signOut({ redirect: true, callbackUrl: '/auth/signin' });
                }}>
                  <Button className="mt-2" type="submit">
                    Sign Out and Re-authenticate
                  </Button>
                </form>
              </div>
            )}
            
            {hasAllScopes && (
              <div className="bg-green-500/10 border border-green-500/20 text-green-500 p-4 rounded-md">
                <p className="font-medium">All Required Permissions Granted</p>
                <p className="text-sm mt-1">
                  Your account has all the permissions needed for full functionality.
                </p>
              </div>
            )}
          </div>
        </div>
        
        <div className="bg-card rounded-lg border p-6">
          <h2 className="text-xl font-semibold mb-4">Account Information</h2>
          
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Username</p>
              <p className="font-medium">{user?.username || session.user.name}</p>
            </div>
            
            <div>
              <p className="text-sm text-muted-foreground">Twitch ID</p>
              <p className="font-medium">{user?.twitchId || session.user.id}</p>
            </div>
            
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="font-medium">{user?.email || 'Not available'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 