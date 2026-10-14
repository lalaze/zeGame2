/** A deadline rejects startup; it never makes an unfinished renderer ready. */
export const STARTUP_TIMEOUT_MS = 90_000;
export async function waitForStartupReady(
  rendererReady: Promise<unknown>,
  fontsReady: Promise<unknown>,
): Promise<void> {
  let rendererTimer: ReturnType<typeof setTimeout> | undefined;
  const rendererDeadline = new Promise<never>((_, reject) => {
    rendererTimer = setTimeout(() => reject(new Error('Café startup timed out')), STARTUP_TIMEOUT_MS);
  });
  let fontTimer: ReturnType<typeof setTimeout> | undefined;
  const fontDeadline = new Promise<void>((resolve) => {
    fontTimer = setTimeout(resolve, 2000);
  });
  try {
    await Promise.all([Promise.race([rendererReady, rendererDeadline]), Promise.race([fontsReady, fontDeadline])]);
  } finally {
    clearTimeout(fontTimer);
    clearTimeout(rendererTimer);
  }
}
