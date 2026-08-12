import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { Database } from './types';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || '(default)');

const APP_STATE_DOC = doc(db, 'appState', 'current');

export async function saveToFirestore(dbData: Database): Promise<boolean> {
  try {
    // Sanitize undefined fields for Firestore compatibility
    const sanitized = JSON.parse(JSON.stringify(dbData));
    await setDoc(APP_STATE_DOC, sanitized);
    return true;
  } catch (error) {
    console.warn('Failed to save to Firestore:', error);
    return false;
  }
}

export async function fetchFromFirestore(): Promise<Database | null> {
  try {
    const snap = await getDoc(APP_STATE_DOC);
    if (snap.exists()) {
      return snap.data() as Database;
    }
    return null;
  } catch (error) {
    console.warn('Failed to fetch from Firestore:', error);
    return null;
  }
}

export function subscribeToFirestore(onUpdate: (data: Database) => void): () => void {
  try {
    return onSnapshot(
      APP_STATE_DOC,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as Database;
          if (data && data.teams) {
            onUpdate(data);
          }
        }
      },
      (error) => {
        console.warn('Firestore snapshot error:', error);
      }
    );
  } catch (error) {
    console.warn('Failed to set up Firestore listener:', error);
    return () => {};
  }
}

