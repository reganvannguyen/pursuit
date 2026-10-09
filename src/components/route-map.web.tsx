import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import type { TrackedRoutePoint } from '@/services/location/tracking-session';

type RouteMapProps = {
  points: TrackedRoutePoint[];
  accuracyMeters: number | null;
};

export function RouteMap({ points }: RouteMapProps) {
  return (
    <View style={styles.container}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.text}>
        {points.length > 0
          ? 'The route map is available in the iOS and Android app.'
          : 'Start tracking in the iOS or Android app to view a route map.'}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    borderRadius: 12,
    backgroundColor: '#101216',
  },
  text: {
    textAlign: 'center',
  },
});
