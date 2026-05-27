const STORAGE_KEY = "barber_device_fp";

export function getDeviceFingerprint(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return stored;
    const fp = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, fp);
    return fp;
  } catch {
    return "unknown-device";
  }
}
