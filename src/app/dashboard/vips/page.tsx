'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import VIPList from './vip-list';
import RedemptionLog from './redemption-log';

export default function VIPsPage() {
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === 'unauthenticated') {
      redirect('/auth/signin');
    }
  }, [status]);

  if (status === 'loading') {
    return <div className="container mx-auto py-8">Loading...</div>;
  }

  if (!session) {
    return null;
  }

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">VIP Management</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <VIPList initialChannelId={session.user.id} />
        </div>
        
        <div className="md:col-span-1">
          <RedemptionLog />
        </div>
      </div>
    </div>
  );
} 