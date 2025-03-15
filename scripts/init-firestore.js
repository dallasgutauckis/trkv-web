const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
require('dotenv').config();

async function main() {
  try {
    // Initialize Firebase Admin
    const serviceAccount = process.env.GOOGLE_APPLICATION_CREDENTIALS 
      ? require(process.env.GOOGLE_APPLICATION_CREDENTIALS)
      : null;
    
    if (serviceAccount) {
      initializeApp({
        credential: cert(serviceAccount),
        databaseURL: process.env.DATABASE_URL,
      });
    } else {
      // Initialize with default credentials (works in Google Cloud environment)
      initializeApp({
        projectId: process.env.PROJECT_ID || 'terkvs-thing',
      });
    }

    const db = getFirestore();
    console.log('Connected to Firestore');

    // Create collections if they don't exist
    const collections = ['users', 'vipSessions', 'auditLogs', 'channelPointRewards'];
    
    for (const collectionName of collections) {
      const collectionRef = db.collection(collectionName);
      const snapshot = await collectionRef.limit(1).get();
      
      if (snapshot.empty) {
        // Create a dummy document to ensure collection exists
        const dummyDoc = collectionRef.doc('__init__');
        await dummyDoc.set({ 
          initialized: true, 
          timestamp: new Date(),
          description: `Initialization document for ${collectionName} collection`
        });
        console.log(`Created ${collectionName} collection`);
        
        // Delete the dummy document
        await dummyDoc.delete();
        console.log(`Removed initialization document from ${collectionName}`);
      } else {
        console.log(`Collection ${collectionName} already exists`);
      }
    }

    // Create indexes
    console.log('Creating indexes...');
    
    // VIP Sessions indexes
    await db.collection('vipSessions')
      .where('isActive', '==', true)
      .where('channelId', '==', 'test')
      .limit(1)
      .get()
      .catch(error => {
        if (error.code === 'failed-precondition') {
          console.log('Need to create index for vipSessions (isActive + channelId)');
          console.log('Run: firebase firestore:indexes --project=terkvs-thing');
        }
      });

    // Channel Point Rewards indexes
    await db.collection('channelPointRewards')
      .where('channelId', '==', 'test')
      .limit(1)
      .get()
      .catch(error => {
        if (error.code === 'failed-precondition') {
          console.log('Need to create index for channelPointRewards (channelId)');
          console.log('Run: firebase firestore:indexes --project=terkvs-thing');
        }
      });

    console.log('Firestore initialization completed successfully');
  } catch (error) {
    console.error('Error initializing Firestore:', error);
    process.exit(1);
  }
}

main(); 