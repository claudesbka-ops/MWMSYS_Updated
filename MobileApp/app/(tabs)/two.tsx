import { StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';

export default function LegacyTabScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>This tab has been replaced.</Text>
      <Text style={styles.subtitle}>Use Attendance / Leave tabs.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 8,
    opacity: 0.7,
  },
});
