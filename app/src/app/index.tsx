import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Index() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.body}>
        <Text style={styles.title}>Red Phone</Text>
        <Text style={styles.subtitle}>Phase 1 spike</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 32, fontWeight: '700' },
  subtitle: { fontSize: 16, marginTop: 8 },
});
