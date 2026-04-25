import { StatusBar } from 'expo-status-bar';
import { Platform, StyleSheet, Text, View } from 'react-native';

export default function ModalScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>MWMSYS</Text>
      <Text style={styles.sub}>
        Migrant Worker Management System. Manage attendance, leave, payroll,
        contracts and incidents all from your device.
      </Text>
      <View style={styles.separator} />
      <Text style={styles.version}>v1.0.0</Text>
      <StatusBar style={Platform.OS === 'ios' ? 'light' : 'auto'} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30, backgroundColor: '#ffffff' },
  title: { fontSize: 26, fontWeight: '900', color: '#0f172a', letterSpacing: 1.2 },
  sub: { marginTop: 14, fontSize: 13, color: 'rgba(15,23,42,0.65)', textAlign: 'center', lineHeight: 19 },
  separator: { marginVertical: 26, height: 1, width: '60%', backgroundColor: 'rgba(15,23,42,0.08)' },
  version: { fontSize: 11, color: 'rgba(15,23,42,0.45)', fontWeight: '700', letterSpacing: 0.3 },
});
