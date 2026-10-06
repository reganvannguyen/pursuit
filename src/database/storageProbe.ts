export type ProbeRecord = {
  id: string;
  value: string;
};

function unsupportedError() {
  return new Error('The SQLite storage check is available on iOS and Android only.');
}

// Web uses this fallback so it does not bundle expo-sqlite's optional web runtime.
export async function initializeDatabase(): Promise<void> {
  throw unsupportedError();
}

export async function saveProbeRecord(_value: string): Promise<void> {
  throw unsupportedError();
}

export async function readProbeRecord(): Promise<ProbeRecord | null> {
  throw unsupportedError();
}
