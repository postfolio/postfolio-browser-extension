import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  User,
  browserLocalPersistence,
  setPersistence
} from 'firebase/auth';

// Import the Firebase configuration
// First, copy firebase-config.example.ts to firebase-config.ts and fill in your values
import { firebaseConfig } from '../../firebase-config';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Set persistence to local so auth state persists
setPersistence(auth, browserLocalPersistence);

// Initialize Google Auth Provider
const googleProvider = new GoogleAuthProvider();

// Auth state management
export const getCurrentUser = (): User | null => {
  return auth.currentUser;
};

export const signIn = async (email: string, password: string) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    const token = await user.getIdToken();
    
    // Store auth data in chrome storage
    await chrome.storage.local.set({
      authToken: token,
      userId: user.uid,
      userEmail: user.email,
      tokenExpiry: Date.now() + (60 * 60 * 1000) // 1 hour
    });
    
    return { user, token };
  } catch (error) {
    console.error('Sign in error:', error);
    throw error;
  }
};

export const signInWithGoogle = async () => {
  try {
    // Chrome extensions can't use signInWithPopup directly
    // Instead, we need to open the auth page in a new tab
    const provider = new GoogleAuthProvider();
    
    // Get the redirect URL
    const redirectUrl = chrome.identity.getRedirectURL();
    
    // For now, let's open the web app's login page for Google sign-in
    // This is a workaround until we implement chrome.identity properly
    const webAppUrl = 'https://www.mypostfolio.com/login?google=true';
    
    // Open in a new tab
    chrome.tabs.create({ url: webAppUrl });
    
    // Return a message to the user
    throw new Error('Please complete Google sign-in on the Postfolio website, then return to the extension.');
    
  } catch (error) {
    console.error('Google sign in error:', error);
    throw error;
  }
};

export const getStoredAuthToken = async (): Promise<{
  token: string | null;
  userId: string | null;
  userEmail: string | null;
  needsRefresh: boolean;
} | null> => {
  const stored = await chrome.storage.local.get(['authToken', 'userId', 'userEmail', 'tokenExpiry']);
  
  if (!stored.authToken || !stored.userId) {
    return null;
  }
  
  // Check if token is expired or will expire soon (within 5 minutes)
  const needsRefresh = !stored.tokenExpiry || Date.now() > (stored.tokenExpiry - 5 * 60 * 1000);
  
  return {
    token: stored.authToken,
    userId: stored.userId,
    userEmail: stored.userEmail || null,
    needsRefresh
  };
};

export const refreshAuthToken = async (): Promise<string | null> => {
  const user = auth.currentUser;
  if (!user) return null;
  
  try {
    const token = await user.getIdToken(true); // Force refresh
    
    // Update stored token
    await chrome.storage.local.set({
      authToken: token,
      tokenExpiry: Date.now() + (60 * 60 * 1000) // 1 hour
    });
    
    return token;
  } catch (error) {
    console.error('Token refresh error:', error);
    return null;
  }
};

export const signOut = async () => {
  try {
    await auth.signOut();
    await chrome.storage.local.remove(['authToken', 'userId', 'userEmail', 'tokenExpiry']);
  } catch (error) {
    console.error('Sign out error:', error);
  }
};

// Listen for auth state changes
onAuthStateChanged(auth, async (user) => {
  if (user) {
    // User is signed in, update token
    const token = await user.getIdToken();
    await chrome.storage.local.set({
      authToken: token,
      userId: user.uid,
      userEmail: user.email,
      tokenExpiry: Date.now() + (60 * 60 * 1000)
    });
  } else {
    // User is signed out
    await chrome.storage.local.remove(['authToken', 'userId', 'userEmail', 'tokenExpiry']);
  }
});

export { auth }; 