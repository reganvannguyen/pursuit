import { useCallback, useEffect, useRef, useState } from 'react';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';

import { shouldPausePlayback } from './audio-interruption';

const TEST_NARRATION = require('../../../assets/audio/audio_check.mp3');

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown audio error.';
}

export function useTestNarration() {
  const player = useAudioPlayer(TEST_NARRATION);
  const status = useAudioPlayerStatus(player);
  const [audioModeReady, setAudioModeReady] = useState(false);
  const [audioModeError, setAudioModeError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [requiresManualResume, setRequiresManualResume] = useState(false);
  const requiresManualResumeRef = useRef(false);
  const observedPlayingRef = useRef(player.playing);

  const markManualResumeRequired = useCallback(() => {
    requiresManualResumeRef.current = true;
    setRequiresManualResume(true);
  }, []);

  useEffect(() => {
    let isMounted = true;

    void setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'duckOthers',
    })
      .then(() => {
        if (isMounted) setAudioModeReady(true);
      })
      .catch((error: unknown) => {
        if (isMounted) setAudioModeError(errorMessage(error));
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const subscription = player.addListener('playbackStatusUpdate', (nextStatus) => {
      const wasPlaying = observedPlayingRef.current;
      const interruptionDetected =
        (wasPlaying && !nextStatus.playing && !nextStatus.didJustFinish) ||
        nextStatus.mediaServicesDidReset === true;

      if (interruptionDetected) markManualResumeRequired();

      const shouldPause =
        nextStatus.mediaServicesDidReset ||
        shouldPausePlayback({
          wasPlaying,
          isPlaying: nextStatus.playing,
          didJustFinish: nextStatus.didJustFinish,
          requiresManualResume: requiresManualResumeRef.current,
        });

      observedPlayingRef.current = nextStatus.playing;
      if (shouldPause) player.pause();
    });

    return () => subscription.remove();
  }, [markManualResumeRequired, player]);

  const play = useCallback(async () => {
    if (!audioModeReady || audioModeError || !status.isLoaded) return;

    setActionError(null);
    try {
      if (status.didJustFinish || (status.duration > 0 && status.currentTime >= status.duration)) {
        await player.seekTo(0);
      }

      requiresManualResumeRef.current = false;
      setRequiresManualResume(false);
      observedPlayingRef.current = player.playing;
      player.play();
    } catch (error) {
      setActionError(errorMessage(error));
    }
  }, [audioModeError, audioModeReady, player, status]);

  const pause = useCallback(() => {
    markManualResumeRequired();
    observedPlayingRef.current = false;
    player.pause();
  }, [markManualResumeRequired, player]);

  const stop = useCallback(() => {
    requiresManualResumeRef.current = false;
    setRequiresManualResume(false);
    setActionError(null);
    observedPlayingRef.current = false;
    player.pause();
    void player.seekTo(0).catch((error: unknown) => setActionError(errorMessage(error)));
  }, [player]);

  const error = audioModeError ?? actionError ?? status.error;
  const message = error
    ? `Audio unavailable: ${error}`
    : !audioModeReady
      ? 'Preparing audio…'
      : !status.isLoaded
        ? 'Loading bundled sample…'
        : status.playing
          ? 'Playing sample'
          : requiresManualResume
            ? 'Paused. Tap Play to resume.'
            : status.didJustFinish
              ? 'Sample finished. Tap Play to hear it again.'
              : 'Ready to play offline.';

  return {
    isReady: audioModeReady && status.isLoaded && error === null,
    isPlaying: status.playing,
    message,
    play,
    pause,
    stop,
  };
}
