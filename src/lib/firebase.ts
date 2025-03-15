import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin if it hasn't been initialized yet
if (!getApps().length) {
  // Check if we're using service account credentials or environment variables
  try {
    // Try to initialize with service account if available
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
  } catch (error) {
    console.error('Error initializing Firebase Admin:', error);
    // Initialize with default credentials as fallback
    initializeApp();
  }
}

// Get Firestore instance
const db = getFirestore();

export { db }; 