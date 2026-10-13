type PlaybackTransition = {
  wasPlaying: boolean;
  isPlaying: boolean;
  didJustFinish: boolean;
  requiresManualResume: boolean;
};

export function shouldPausePlayback({
  wasPlaying,
  isPlaying,
  didJustFinish,
  requiresManualResume,
}: PlaybackTransition): boolean {
  return (requiresManualResume && isPlaying) || (wasPlaying && !isPlaying && !didJustFinish);
}
