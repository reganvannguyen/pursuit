import { shouldPausePlayback } from '@/services/audio/audio-interruption';

describe('shouldPausePlayback', () => {
  it('holds playback paused after an interruption until manual resume', () => {
    expect(
      shouldPausePlayback({
        wasPlaying: true,
        isPlaying: false,
        didJustFinish: false,
        requiresManualResume: false,
      }),
    ).toBe(true);

    expect(
      shouldPausePlayback({
        wasPlaying: false,
        isPlaying: true,
        didJustFinish: false,
        requiresManualResume: true,
      }),
    ).toBe(true);

    expect(
      shouldPausePlayback({
        wasPlaying: false,
        isPlaying: false,
        didJustFinish: false,
        requiresManualResume: true,
      }),
    ).toBe(false);
  });

  it('does not treat a finished clip as an interruption', () => {
    expect(
      shouldPausePlayback({
        wasPlaying: true,
        isPlaying: false,
        didJustFinish: true,
        requiresManualResume: false,
      }),
    ).toBe(false);
  });
});
