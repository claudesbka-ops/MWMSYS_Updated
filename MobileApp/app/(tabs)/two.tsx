import { Redirect } from 'expo-router';

// Legacy route kept only because Expo Router bundled it once; redirect away.
export default function LegacyTabScreen() {
  return <Redirect href="/(tabs)" />;
}
