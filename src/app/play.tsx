import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

export default function PlayScreen() {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.content}>
        <ThemedText type="subtitle" style={styles.heading}>
          Campaigns
        </ThemedText>
        <ThemedText type="default" style={styles.description}>
          Primary entry point for running missions and story episodes.
        </ThemedText>
        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="smallBold">The Forest: First Escape</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.cardText}>
            Episode 1 — Survive the initial pursuit. Real movement required.
          </ThemedText>
        </ThemedView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  heading: {
    marginTop: Spacing.two,
  },
  description: {
    marginTop: Spacing.one,
  },
  card: {
    marginTop: Spacing.four,
    padding: Spacing.four,
    borderRadius: Spacing.three,
    gap: Spacing.one,
  },
  cardText: {
    marginTop: Spacing.one,
  },
});
