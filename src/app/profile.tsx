import { useState } from 'react';
import { Platform, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { readProbeRecord, saveProbeRecord } from '@/database/storageProbe';

const SAMPLE_PROBE_VALUE = 'Pursuit SQLite restart check';

export default function ProfileScreen() {
  const [probeStatus, setProbeStatus] = useState(
    'Save a sample, restart the app, then read it here.',
  );
  const [isProbeBusy, setIsProbeBusy] = useState(false);

  async function runProbeAction(action: () => Promise<void>) {
    setIsProbeBusy(true);
    setProbeStatus('Checking local storage…');

    try {
      await action();
    } catch (error) {
      setProbeStatus(
        error instanceof Error ? `Storage check failed: ${error.message}` : 'Storage check failed.',
      );
    } finally {
      setIsProbeBusy(false);
    }
  }

  function handleSaveSample() {
    return runProbeAction(async () => {
      await saveProbeRecord(SAMPLE_PROBE_VALUE);
      setProbeStatus(`Saved “${SAMPLE_PROBE_VALUE}”. Restart the app, then choose Read saved.`);
    });
  }

  function handleReadSaved() {
    return runProbeAction(async () => {
      const record = await readProbeRecord();
      setProbeStatus(
        record
          ? `Stored value: ${record.value}`
          : 'No saved record found. Choose Save sample first.',
      );
    });
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.content}>
        <ThemedText type="subtitle" style={styles.heading}>
          Runner Profile
        </ThemedText>
        <ThemedText type="default" style={styles.description}>
          View your completed runs, cumulative distance, and achievements.
        </ThemedText>
        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="smallBold">Career Stats</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.cardText}>
            0 total runs completed · 0.0 km recorded
          </ThemedText>
        </ThemedView>
        {__DEV__ && Platform.OS !== 'web' ? (
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="smallBold">SQLite storage check</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Save a sample, force-close and reopen Pursuit, then read the saved value.
            </ThemedText>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: isProbeBusy }}
              disabled={isProbeBusy}
              onPress={handleSaveSample}
              style={({ pressed }) => [styles.probeButton, pressed && styles.probeButtonPressed]}
            >
              <ThemedText type="smallBold">Save sample</ThemedText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: isProbeBusy }}
              disabled={isProbeBusy}
              onPress={handleReadSaved}
              style={({ pressed }) => [styles.probeButton, pressed && styles.probeButtonPressed]}
            >
              <ThemedText type="smallBold">Read saved</ThemedText>
            </Pressable>
            <ThemedText accessibilityLiveRegion="polite" type="small" themeColor="textSecondary">
              {probeStatus}
            </ThemedText>
          </ThemedView>
        ) : null}
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
  probeButton: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#888888',
  },
  probeButtonPressed: {
    opacity: 0.65,
  },
});
