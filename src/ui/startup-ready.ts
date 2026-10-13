/** Fonts may fall back after two seconds; the renderer must actually be ready. */
export async function waitForStartupReady(
  rendererReady: Promise<unknown>,
  fontsReady: Promise<unknown>,
): Promise<void> {
  let fontTimer: ReturnType<typeof setTimeout> | undefined;
  const fontDeadline = new Promise<void>((resolve) => {
    fontTimer = setTimeout(resolve, 2000);
  });
  try {
    await Promise.all([rendererReady, Promise.race([fontsReady, fontDeadline])]);
  } finally {
    clearTimeout(fontTimer);
  }
}
