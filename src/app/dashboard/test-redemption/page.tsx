import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import TestRedemptionForm from './test-redemption-form';

export default async function TestRedemptionPage() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    redirect('/auth/signin');
  }
  
  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-6">Test Redemption</h1>
      <p className="text-muted-foreground mb-8">
        Use this page to test the channel point redemption functionality without having to redeem actual channel points.
      </p>
      
      <TestRedemptionForm channelId={session.user.id} />
    </div>
  );
} 