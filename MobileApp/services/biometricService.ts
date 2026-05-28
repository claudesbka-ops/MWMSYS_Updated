import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";

const BIOMETRIC_KEY = "mwmsys_biometric_creds";

export type BiometricCredentials = {
  email: string;
  password: string;
  passportNo?: string;
  role?: string;
};

/**
 * Check if this device supports biometric authentication.
 */
export async function isBiometricAvailable(): Promise<boolean> {
  const compatible = await LocalAuthentication.hasHardwareAsync();
  if (!compatible) return false;
  const enrolled = await LocalAuthentication.isEnrolledAsync();
  return enrolled;
}

/**
 * Store encrypted credentials for biometric login.
 */
export async function enableBiometric(creds: BiometricCredentials): Promise<void> {
  await SecureStore.setItemAsync(BIOMETRIC_KEY, JSON.stringify(creds));
}

/**
 * Authenticate with biometrics and return stored credentials.
 * Returns null if auth fails or no credentials stored.
 */
export async function authenticateWithBiometric(): Promise<BiometricCredentials | null> {
  const stored = await SecureStore.getItemAsync(BIOMETRIC_KEY).catch(() => null);
  if (!stored) return null;

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: "Sign in to MWMSYS",
    fallbackLabel: "Use password instead",
    cancelLabel: "Cancel",
    disableDeviceFallback: false,
  });

  if (!result.success) return null;

  try {
    return JSON.parse(stored) as BiometricCredentials;
  } catch {
    return null;
  }
}

/**
 * Check if biometric credentials are enrolled (stored).
 */
export async function isBiometricEnrolled(): Promise<boolean> {
  const stored = await SecureStore.getItemAsync(BIOMETRIC_KEY).catch(() => null);
  return !!stored;
}

/**
 * Remove stored biometric credentials.
 */
export async function disableBiometric(): Promise<void> {
  await SecureStore.deleteItemAsync(BIOMETRIC_KEY).catch(() => undefined);
}
