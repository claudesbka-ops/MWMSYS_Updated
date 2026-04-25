import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { GradientBackground } from '@/components/ui';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Not found' }} />
      <GradientBackground>
        <View style={styles.container}>
          <LinearGradient
            colors={["#6366f1", "#8b5cf6", "#ec4899"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.badge}
          >
            <FontAwesome name="compass" size={44} color="#ffffff" />
          </LinearGradient>
          <Text style={styles.title}>Page not found</Text>
          <Text style={styles.sub}>The screen you are looking for does not exist or has been moved.</Text>
          <Link href="/" style={styles.link}>
            <Text style={styles.linkText}>Go back home</Text>
          </Link>
        </View>
      </GradientBackground>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  badge: {
    width: 104, height: 104, borderRadius: 52, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#6366f1', shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.3, shadowRadius: 22, elevation: 8,
  },
  title: { marginTop: 22, fontSize: 22, fontWeight: '900', color: '#0f172a' },
  sub: { marginTop: 8, fontSize: 13, color: 'rgba(15,23,42,0.65)', textAlign: 'center', paddingHorizontal: 30, lineHeight: 18 },
  link: { marginTop: 18, paddingVertical: 12, paddingHorizontal: 22, borderRadius: 999, backgroundColor: '#4f46e5' },
  linkText: { fontSize: 13, color: '#ffffff', fontWeight: '800', letterSpacing: 0.3 },
});
