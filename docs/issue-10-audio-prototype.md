# Issue 10 — Bundled audio playback prototype

This prototype uses the bundled sample “This is a Pursuit audio check. GPS tracking is still active.” (`assets/audio/audio_check.mp3`, 4 seconds, 49 KB).

## Playback behavior

- Play is available only during active GPS tracking. Pausing GPS pauses the sample; resuming GPS does not resume it. Stopping the run resets the sample.
- Playback is configured for silent mode and background playback. `duckOthers` lowers other audio while the sample plays.
- Output routing is left to iOS and Android, so the OS selects the speaker or connected headphones. Expo Audio stops playback if headphones or a Bluetooth audio device disconnects.
- An unexpected pause or media-services reset leaves playback paused until the user taps Play. A completed sample can be replayed from the beginning.
- The Expo config embeds the audio directory in both native apps, enables background playback and its Android media playback service, and disables recording and microphone permission.

## Validation record — 2026-10-13

- Passed: `npx expo lint`, `npx tsc --noEmit`, the audio-interruption unit test (2 cases), and an iOS Expo export that included the MP3.
- Passed: regenerated the iOS native project, built and installed the development app on the paired iPhone 15 Pro, and confirmed the app process launched.
- User-tested on iPhone: bundled narration plays offline and through headphones, and lowers music while playing. Pausing the run pauses narration; after resuming the run, narration stays paused until Play is tapped, then continues from where it paused.
- User-tested on iPhone: narration and GPS tracking continue when the app is backgrounded or the screen is locked during a run.
- Still unconfirmed on iPhone: speaker playback and recovery from an OS audio interruption.
- Pending on Android: physical-device validation; no Android device is connected.

The sample is only four seconds long. Android background playback beyond approximately three minutes requires lock-screen controls, which are outside this prototype.
