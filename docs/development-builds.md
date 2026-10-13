# Development builds on a phone

Pursuit uses Expo SDK 57, `expo-dev-client`, and Continuous Native Generation (CNG). The local Expo CLI workflow builds and installs the app with Xcode or Android Studio. It does not require EAS Build.

## Prerequisites

- Node.js and npm. The repository includes `package-lock.json`, so use `npm ci` to install its pinned dependencies.
- **iPhone:** a Mac with Xcode installed, an Apple Account signed in to Xcode, and the iPhone connected by USB. Expo SDK 57's reference lists Xcode 26.4 as its minimum supported Xcode version.
- **Android phone:** Android Studio with the Android SDK, a USB connection, and USB debugging enabled in Developer options.

On iPhone, unlock the device and accept the **Trust This Computer** prompt if it appears. Enable **Settings → Privacy & Security → Developer Mode** and restart the phone if iOS asks. In Xcode, open **Xcode → Settings → Accounts** and sign in with your Apple Account. For a free account, Xcode uses its **Personal Team** for local signing.

## Build and run the development build

From the project root:

```bash
npm ci
npx expo run:ios --device
```

Choose the connected iPhone if Expo prompts for a device. Expo compiles and installs the development build, then starts Metro. Keep the terminal and Metro running while using this build so it can load the JavaScript app. To build on a connected Android phone instead:

```bash
npx expo run:android --device
```

The project already includes `expo-dev-client`, the `development` profile in `eas.json`, and a unique iOS bundle identifier. The local `expo run` commands use Xcode or Android Studio; the EAS profile is not needed for this workflow.

After changing a native dependency, `app.json`, or a config plugin, regenerate the ignored native projects and rebuild:

```bash
npx expo prebuild --clean
npx expo run:ios --device
```

Use `npx expo run:android --device` for an Android rebuild. Do not edit generated `ios/` or `android/` files directly; configure native changes in `app.json`, `app.config.js`, or a config plugin.

## Google Maps on Android

Android uses Google Maps and needs a Google Maps API key before the basemap can load in a development or standalone build. Expo Go supplies its own key. iOS uses Apple Maps and does not need an app key.

1. In Google Cloud, create or select a project, enable billing, and enable **Maps SDK for Android**.
2. Create an API key. Restrict it to **Maps SDK for Android** and to Android apps with package ID `com.regannguyen.pursuit` plus the SHA-1 signing certificate fingerprint used by your build. For a local Android development build, `cd android && ./gradlew signingReport` prints the debug signing fingerprint. EAS builds use the fingerprint shown in the Expo project credentials.
3. Put the key in a local `.env` file at the project root (this file is ignored by Git):

   ```dotenv
   ANDROID_GOOGLE_MAPS_API_KEY=your_restricted_key
   ```

   For an EAS build, configure the same variable in the EAS build environment. Do not use an `EXPO_PUBLIC_` prefix. The key is included in the Android app binary, so API and app restrictions are important.

4. Rebuild after adding or changing the key:

   ```bash
   npx expo run:android --device
   ```

Without a configured key, the Android tracker still records GPS and distance and shows a setup message in place of the map. Map tiles may also be unavailable without an internet connection; GPS tracking remains active.

## Device checks

### Navigation

Tap **Home**, **Play**, and **Profile** in the app's tab bar. Confirm each screen opens.

### SQLite persistence

On an iOS or Android development build:

1. Open **Profile** and tap **Save sample**. The status should say the sample was saved.
2. Force-close Pursuit without uninstalling it, then reopen the app.
3. Open **Profile** and tap **Read saved**. It should show `Pursuit SQLite restart check`.
4. Force-close and reopen once more, then read again to confirm database initialization is safe to repeat.

The database is stored on the device. Uninstalling Pursuit removes its local app data, including this sample. The SQLite check is hidden on web.

### Launch iOS without Metro

For the Issue #6 standalone-launch check, create a local Release build on the connected iPhone:

```bash
npx expo run:ios --configuration Release --device
```

After Expo reports that installation is complete, stop the CLI with **Ctrl-C**. Force-close and reopen Pursuit from the iPhone Home Screen. The app should launch from its embedded JavaScript bundle without Metro running. This is a locally signed device build for testing, not an App Store or TestFlight distribution build.

### Issue #8 background GPS tracking

Background location is supported by the native development or Release build. Expo Go cannot run
Pursuit's background location task. After changing the `expo-location` plugin settings, regenerate
the native project and rebuild:

```bash
npx expo prebuild --clean
npx expo run:ios --configuration Release --device
```

On the first **Start**, Pursuit requests **While Using the App** location access. It then explains
why it needs background access before showing the system prompt for **Always** access. If Always is
declined or skipped, the session continues in **Foreground only** mode and the app warns that
locking the phone or switching away may pause GPS updates. To change that later, use the iPhone's
location settings for Pursuit.

On Android, grant foreground and background location access. Pursuit shows an ongoing foreground
service notification while tracking. Android may require the user to finish background access from
system settings. Battery restrictions and behavior after force-stop vary by device maker.

For an iPhone field check:

1. Build and install the Release app with the command above; confirm the app opens without Metro.
2. Start a route on a measured course. Record distance, reported GPS accuracy, and the update time.
3. Keep the session running with the screen on, then lock the phone for part of the course, then
   leave Pursuit in the background for another part.
4. Return to Pursuit. Check the route, total distance, last update, warning, and tracking mode. The
   app keeps persisted points for the current session; **Stop** or the next **Start** clears them.
5. Force-quit Pursuit as a separate stop-condition check. Do not expect the app to recover or claim
   that GPS continued after force-quit. If a background task is no longer registered when the app
   returns, Pursuit marks the session **Interrupted** and does not resume it automatically.

Location gaps over 30 seconds start a new route segment and are excluded from distance totals, so
the app does not draw or count a straight-line bridge over a reported gap. A long delay also shows a
warning. OS termination, force-quit, permission changes, and battery restrictions can still stop
updates; this prototype does not recover an interrupted session.

**iPhone field results:** The developer reported that GPS accuracy looked good and confirmed a
short test continued successfully with the phone locked. Exact course length, distance error,
typical accuracy, and longest sample gap were not recorded, so this is a functional smoke test rather
than a measured accuracy result.

**Android physical test:** Unverified until an Android phone is available. Build configuration is
enabled for background permission and the location foreground service.

### Issue #9 session time, pace, and pause/resume

The Play tracker shows elapsed time, GPS-derived moving time, a live pace estimate from the last
60 seconds, and average moving pace. Moving time sums intervals between accepted GPS samples when
the processor adds distance and the interval is at most 30 seconds. GPS drift can affect these
estimates; no additional movement threshold is applied.

**Pause** stops location updates and freezes route distance and moving time. Elapsed time continues.
The route already recorded stays visible. **Resume** restarts location updates and treats the first
new fix as a fresh route segment, so the paused interval does not add distance. **Stop** freezes the
displayed totals and clears the active SQLite session; totals remain visible on the current Play
screen until it is left, but this issue does not add saved run history.

For a device check, start tracking, confirm elapsed time advances, and walk long enough to receive
several accepted fixes. Pause for at least 30 seconds and confirm elapsed time continues while
distance and moving time stay fixed. Resume and confirm the route does not bridge across the pause,
then verify both pace values update after new movement. Stop and confirm the final totals remain on
screen. Android behavior remains unverified until an Android phone is available.

## Free Apple Personal Team limit

A paid Apple Developer Program membership is not required to build and test Pursuit on your own iPhone through Xcode's Personal Team. Apple's free Personal Team provisioning profiles expire seven days after issuance. After expiry, rebuild and reinstall the app from the connected Mac:

```bash
# Development build
npx expo run:ios --device

# Or the Release build that launches without Metro
npx expo run:ios --configuration Release --device
```

Keep the iPhone connected and unlocked so Xcode can sign and install the refreshed build. Personal Team provisioning is for on-device development testing; it does not provide App Store or TestFlight distribution.

## References

- [Expo SDK 57 reference](https://docs.expo.dev/versions/v57.0.0/)
- [Expo development builds](https://docs.expo.dev/develop/development-builds/introduction/)
- [Expo local app development](https://docs.expo.dev/guides/local-app-development/)
- [Expo SDK 57 `react-native-maps` setup](https://docs.expo.dev/versions/v57.0.0/sdk/map-view/)
- [Expo SDK 57 `expo-location` background updates](https://docs.expo.dev/versions/v57.0.0/sdk/location/)
- [Expo SDK 57 `expo-task-manager`](https://docs.expo.dev/versions/v57.0.0/sdk/task-manager/)
- [Google Maps Platform: Set up the Maps SDK for Android](https://developers.google.com/maps/documentation/android-sdk/get-api-key)
- [Enable iOS Developer Mode](https://docs.expo.dev/guides/ios-developer-mode/)
- [Apple: Developer account and Personal Team](https://developer.apple.com/help/account/basics/about-your-developer-account)
