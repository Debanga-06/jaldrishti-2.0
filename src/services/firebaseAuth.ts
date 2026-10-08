import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { firebaseAuth } from '../lib/firebase';

export async function registerWithEmail(email: string, password: string, fullName?: string): Promise<void> {
  const credential = await createUserWithEmailAndPassword(firebaseAuth, email, password);
  if (fullName) {
    try {
      await updateProfile(credential.user, { displayName: fullName });
    } catch (e) {
      // Non-fatal — the account still exists and the verification email still goes out.
    }
  }
  await sendEmailVerification(credential.user);
  await signOut(firebaseAuth);
}

/**
 * Signs in with email/password. If the account's email isn't verified yet, sends a fresh
 * verification link (in case the first one expired or was never received), signs the user
 * back out, and throws a distinguishable error so the UI can show the right message instead
 * of a generic "wrong password" error.
 */
export async function loginWithEmail(email: string, password: string): Promise<User> {
  const credential = await signInWithEmailAndPassword(firebaseAuth, email, password);
  if (!credential.user.emailVerified) {
    try {
      await sendEmailVerification(credential.user);
    } catch (e) {
      // Firebase rate-limits repeated verification sends — safe to ignore here.
    }
    await signOut(firebaseAuth);
    const err = new Error('Email not verified') as Error & { code: string };
    err.code = 'EMAIL_NOT_VERIFIED';
    throw err;
  }
  return credential.user;
}

/** Re-sends the verification link without fully re-authenticating the UI state. */
export async function resendVerificationEmail(email: string, password: string): Promise<void> {
  const credential = await signInWithEmailAndPassword(firebaseAuth, email, password);
  await sendEmailVerification(credential.user);
  await signOut(firebaseAuth);
}

export function logoutFirebase(): Promise<void> {
  return signOut(firebaseAuth);
}

/** Turns a Firebase Auth error code into a message safe to show directly in the UI. */
export function mapFirebaseAuthError(code: string | undefined): string {
  switch (code) {
    case 'auth/email-already-in-use':
      return 'An account with this email already exists — try signing in instead.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Incorrect email or password.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.';
    case 'auth/network-request-failed':
      return 'Network error — please check your connection and try again.';
    case 'EMAIL_NOT_VERIFIED':
      return "We've sent a new verification link to your email. Please verify your address, then sign in.";
    default:
      return 'Something went wrong. Please try again.';
  }
}
