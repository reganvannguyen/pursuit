import Constants from 'expo-constants';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import MapView, { Circle, Marker, Polyline, PROVIDER_GOOGLE, type Region } from 'react-native-maps';

import { ThemedText } from '@/components/themed-text';
import type { RoutePoint } from '@/services/location/distance-processor';

type RouteMapProps = {
  points: RoutePoint[];
  accuracyMeters: number | null;
};

const DEFAULT_REGION_DELTA = 0.006;
const GOOGLE_MAPS_KEY_CONFIGURED =
  Constants.expoConfig?.extra?.mapConfig?.androidGoogleMapsKeyConfigured === true;
const RUNNING_IN_EXPO_GO = Constants.expoGoConfig !== null;

export function RouteMap({ points, accuracyMeters }: RouteMapProps) {
  if (Platform.OS === 'android' && !GOOGLE_MAPS_KEY_CONFIGURED && !RUNNING_IN_EXPO_GO) {
    return (
      <MapPlaceholder>
        Google Maps for Android needs a restricted API key. See the development build setup. GPS
        tracking continues without the map.
      </MapPlaceholder>
    );
  }

  if (points.length === 0) {
    return <MapPlaceholder>Start tracking to show the route on the map.</MapPlaceholder>;
  }

  return <ActiveRouteMap points={points} accuracyMeters={accuracyMeters} />;
}

function ActiveRouteMap({ points, accuracyMeters }: RouteMapProps) {
  const mapRef = useRef<MapView>(null);
  const lastRegionRef = useRef<Region | null>(null);
  const isFollowingRef = useRef(true);
  const [isFollowing, setIsFollowing] = useState(true);
  const currentPoint = points.at(-1)!;
  const startPoint = points[0]!;
  const currentLatitude = currentPoint.latitude;
  const currentLongitude = currentPoint.longitude;

  useEffect(() => {
    if (isFollowingRef.current) {
      mapRef.current?.animateToRegion(
        {
          latitude: currentLatitude,
          longitude: currentLongitude,
          latitudeDelta: lastRegionRef.current?.latitudeDelta ?? DEFAULT_REGION_DELTA,
          longitudeDelta: lastRegionRef.current?.longitudeDelta ?? DEFAULT_REGION_DELTA,
        },
        350,
      );
    }
  }, [currentLatitude, currentLongitude]);

  function suspendFollowing() {
    isFollowingRef.current = false;
    setIsFollowing(false);
  }

  function recenter() {
    if (!currentPoint || !mapRef.current) return;

    isFollowingRef.current = true;
    setIsFollowing(true);
    if (points.length > 1) {
      mapRef.current.fitToCoordinates(points, {
        edgePadding: { top: 36, right: 36, bottom: 72, left: 36 },
        animated: true,
      });
    } else {
      mapRef.current.animateToRegion(regionAround(currentPoint), 350);
    }
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        accessibilityLabel={`GPS route map with ${points.length} accepted locations`}
        initialRegion={regionAround(startPoint)}
        onRegionChangeComplete={(region) => {
          lastRegionRef.current = region;
        }}
        onPanDrag={Platform.OS === 'android' ? suspendFollowing : undefined}
        onRegionChangeStart={(_region, details) => {
          if (Platform.OS === 'android' && details.isGesture) suspendFollowing();
        }}
        onTouchMove={Platform.OS === 'ios' ? suspendFollowing : undefined}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        scrollEnabled
        style={styles.map}
        toolbarEnabled={false}
      >
        {points.length > 1 ? (
          <Polyline coordinates={points} strokeColor="#208AEF" strokeWidth={4} />
        ) : null}
        {points.length === 1 ? (
          <Marker coordinate={startPoint} pinColor="#31A46C" title="Start and current point" />
        ) : (
          <>
            <Marker coordinate={startPoint} pinColor="#31A46C" title="Start" />
            <Marker coordinate={currentPoint} pinColor="#208AEF" title="Current point" />
          </>
        )}
        {accuracyMeters !== null && Number.isFinite(accuracyMeters) && accuracyMeters > 0 ? (
          <Circle
            center={currentPoint}
            fillColor="rgba(32, 138, 239, 0.16)"
            radius={accuracyMeters}
            strokeColor="rgba(32, 138, 239, 0.75)"
            strokeWidth={1}
          />
        ) : null}
      </MapView>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: points.length === 0 }}
        disabled={points.length === 0}
        onPress={recenter}
        style={({ pressed }) => [styles.recenterButton, pressed && styles.pressedButton]}
      >
        <ThemedText style={styles.buttonText} type="smallBold">
          Recenter
        </ThemedText>
      </Pressable>
      {!isFollowing ? (
        <View style={styles.followingStatus}>
          <ThemedText style={styles.buttonText} type="small">
            Map moved · tap Recenter to follow
          </ThemedText>
        </View>
      ) : null}
    </View>
  );
}

function MapPlaceholder({ children }: { children: string }) {
  return (
    <View style={[styles.container, styles.placeholder]}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.placeholderText}>
        {children}
      </ThemedText>
    </View>
  );
}

function regionAround(point: RoutePoint): Region {
  return {
    latitude: point.latitude,
    longitude: point.longitude,
    latitudeDelta: DEFAULT_REGION_DELTA,
    longitudeDelta: DEFAULT_REGION_DELTA,
  };
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 220,
    backgroundColor: '#101216',
  },
  map: {
    ...StyleSheet.absoluteFill,
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  placeholderText: {
    textAlign: 'center',
  },
  recenterButton: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    minHeight: 42,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#ffffff',
  },
  pressedButton: {
    opacity: 0.75,
  },
  buttonText: {
    color: '#101216',
  },
  followingStatus: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    maxWidth: '65%',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#ffffff',
  },
});
