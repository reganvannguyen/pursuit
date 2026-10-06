import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RouteMap } from '../components/route-map';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useGpsTracker } from '@/services/location/use-gps-tracker';

export default function PlayScreen() {
  const tracker = useGpsTracker();
  const [hasStarted, setHasStarted] = useState(false);

  function handleStart() {
    setHasStarted(true);
    void tracker.start();
  }

  function handleStop() {
    tracker.stop();
  }

  const status = tracker.error
    ? tracker.error
    : tracker.isTracking
      ? 'GPS updates are active while Pursuit is open.'
      : tracker.isStarting
        ? 'Waiting for the first GPS update…'
        : hasStarted
          ? 'Tracking stopped. Start again to clear this route and begin a new one.'
          : 'Tap Start to request location access and begin a foreground route.';

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <ThemedText type="subtitle">GPS tracker</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Foreground prototype. The route stays in memory and is not saved.
            </ThemedText>
          </View>

          <ThemedView type="backgroundElement" style={styles.distanceCard}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              TOTAL DISTANCE
            </ThemedText>
            <ThemedText style={styles.distanceValue}>
              {formatDistance(tracker.distanceMeters)}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Sum of accepted GPS segments
            </ThemedText>
          </ThemedView>

          <View style={styles.statsRow}>
            <MetricCard
              label="GPS ACCURACY"
              value={formatAccuracy(tracker.accuracyMeters)}
              hint="Reported radius"
            />
            <MetricCard
              label="SAMPLES"
              value={`${tracker.acceptedSamples} / ${tracker.rejectedSamples}`}
              hint="Accepted / rejected"
            />
          </View>

          <ThemedView type="backgroundElement" style={styles.mapCard}>
            <ThemedText type="smallBold">Route map</ThemedText>
            <View style={styles.mapSurface}>
              <RouteMap
                points={tracker.route}
                accuracyMeters={tracker.lastAcceptedAccuracyMeters}
              />
            </View>
            <View style={styles.mapLegend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, styles.startDot]} />
                <ThemedText type="small" themeColor="textSecondary">
                  Start
                </ThemedText>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, styles.currentDot]} />
                <ThemedText type="small" themeColor="textSecondary">
                  Current
                </ThemedText>
              </View>
              <ThemedText type="small" themeColor="textSecondary">
                Blue circle: GPS accuracy
              </ThemedText>
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              Map tiles may be unavailable offline. GPS tracking continues without them.
            </ThemedText>
          </ThemedView>

          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: tracker.isStarting || tracker.isTracking }}
              disabled={tracker.isStarting || tracker.isTracking}
              onPress={handleStart}
              style={({ pressed }) => [
                styles.button,
                styles.startButton,
                (tracker.isStarting || tracker.isTracking) && styles.disabledButton,
                pressed && styles.pressedButton,
              ]}
            >
              <ThemedText style={styles.buttonText} type="smallBold">
                {tracker.isStarting ? 'Starting…' : 'Start'}
              </ThemedText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !tracker.isTracking }}
              disabled={!tracker.isTracking}
              onPress={handleStop}
              style={({ pressed }) => [
                styles.button,
                styles.stopButton,
                !tracker.isTracking && styles.disabledButton,
                pressed && styles.pressedButton,
              ]}
            >
              <ThemedText type="smallBold">Stop</ThemedText>
            </Pressable>
          </View>

          <ThemedText
            accessibilityLiveRegion="polite"
            style={tracker.error ? styles.error : undefined}
            type="small"
            themeColor={tracker.error ? undefined : 'textSecondary'}
          >
            {status}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.accuracyNote}>
            Accuracy is shown for field testing. Weak GPS does not fail a run.
          </ThemedText>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

type MetricCardProps = {
  label: string;
  value: string;
  hint: string;
};

function MetricCard({ label, value, hint }: MetricCardProps) {
  return (
    <ThemedView type="backgroundElement" style={styles.metricCard}>
      <ThemedText type="smallBold" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText style={styles.metricValue}>{value}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {hint}
      </ThemedText>
    </ThemedView>
  );
}

function formatDistance(distanceMeters: number): string {
  if (distanceMeters < 1_000) return `${Math.round(distanceMeters)} m`;
  return `${(distanceMeters / 1_000).toFixed(2)} km`;
}

function formatAccuracy(accuracyMeters: number | null): string {
  return accuracyMeters === null ? '—' : `± ${Math.round(accuracyMeters)} m`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    padding: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  header: {
    gap: Spacing.one,
    marginTop: Spacing.two,
  },
  distanceCard: {
    padding: Spacing.four,
    borderRadius: Spacing.three,
    gap: Spacing.one,
  },
  distanceValue: {
    fontSize: 44,
    lineHeight: 52,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  metricCard: {
    flex: 1,
    minWidth: 0,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.one,
  },
  metricValue: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  mapCard: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.two,
  },
  mapSurface: {
    height: 220,
    borderRadius: Spacing.two,
    backgroundColor: '#101216',
    overflow: 'hidden',
  },
  mapLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: Spacing.three,
    rowGap: Spacing.one,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  startDot: {
    backgroundColor: '#31A46C',
  },
  currentDot: {
    backgroundColor: '#208AEF',
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  button: {
    flex: 1,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
  },
  startButton: {
    backgroundColor: '#208AEF',
  },
  stopButton: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#888888',
  },
  buttonText: {
    color: '#ffffff',
  },
  disabledButton: {
    opacity: 0.45,
  },
  pressedButton: {
    opacity: 0.7,
  },
  error: {
    color: '#D45C4A',
  },
  accuracyNote: {
    marginTop: -Spacing.two,
  },
});
