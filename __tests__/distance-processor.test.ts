import {
  DistanceProcessor,
  distanceBetweenPoints,
  type LocationSample,
} from '@/services/location/distance-processor';

function sample(
  latitude: number,
  longitude: number,
  timestamp: number,
  accuracy: number | null = 5,
): LocationSample {
  return { latitude, longitude, timestamp, accuracy };
}

describe('distance processor', () => {
  it('calculates distance between known coordinates', () => {
    expect(
      distanceBetweenPoints({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 0.001 }),
    ).toBeCloseTo(111.2, 0);
  });

  it('adds every accepted segment when a route returns near its start', () => {
    const processor = new DistanceProcessor();
    const samples = [
      sample(0, 0, 0),
      sample(0, 0.001, 15_000),
      sample(0.001, 0.001, 30_000),
      sample(0.001, 0, 45_000),
      sample(0.00001, 0, 60_000),
    ];

    const results = samples.map((point) => processor.process(point));

    expect(results.every((result) => result.accepted)).toBe(true);
    expect(processor.process(sample(0.00001, 0, 60_000))).toMatchObject({
      accepted: false,
      rejectionReason: 'out_of_order_timestamp',
    });
    expect(results.at(-1)?.totalDistanceMeters).toBeGreaterThan(440);
    expect(results.at(-1)?.totalDistanceMeters).toBeLessThan(450);
  });

  it('rejects invalid coordinates and timestamps that arrive out of order', () => {
    const processor = new DistanceProcessor();
    processor.process(sample(0, 0, 1_000));

    expect(processor.process(sample(91, 0, 2_000))).toMatchObject({
      accepted: false,
      rejectionReason: 'invalid_sample',
    });
    expect(processor.process(sample(0, 0.0001, 900))).toMatchObject({
      accepted: false,
      rejectionReason: 'out_of_order_timestamp',
    });
    expect(processor.process(sample(0, 0.0001, 2_000)).accepted).toBe(true);
  });

  it('rejects impossible jumps without using them as the next route point', () => {
    const processor = new DistanceProcessor();
    processor.process(sample(0, 0, 1_000));

    expect(processor.process(sample(0, 1, 2_000))).toMatchObject({
      accepted: false,
      rejectionReason: 'impossible_speed',
    });
    const recovery = processor.process(sample(0, 0.0001, 11_000));
    expect(recovery).toMatchObject({ accepted: true });
    expect(recovery.totalDistanceMeters).toBeCloseTo(11.1, 0);
  });

  it('continues accepting samples with degraded accuracy', () => {
    const processor = new DistanceProcessor();
    processor.process(sample(0, 0, 1_000));

    expect(processor.process(sample(0, 0.0001, 11_000, 250))).toMatchObject({
      accepted: true,
      totalDistanceMeters: expect.any(Number),
    });
  });

  it('starts a new route segment after a long update gap without adding distance across it', () => {
    const processor = new DistanceProcessor();
    processor.process(sample(0, 0, 1_000));
    processor.process(sample(0, 0.001, 11_000));

    const resumed = processor.process(sample(0, 1, 42_000));

    expect(resumed).toMatchObject({
      accepted: true,
      addedDistanceMeters: 0,
      totalDistanceMeters: expect.any(Number),
      segmentIndex: 1,
      gapMilliseconds: 31_000,
    });
    expect(resumed.accepted && resumed.totalDistanceMeters).toBeCloseTo(111.2, 0);

    const next = processor.process(sample(0, 1.0001, 52_000));
    expect(next.accepted && next.segmentIndex).toBe(1);
    expect(next.accepted && next.totalDistanceMeters).toBeGreaterThan(122);
  });
});
