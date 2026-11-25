// Every real rules module, found by listing `src/game`, so a new module cannot be forgotten.
type Mod = Record<string, unknown>;
const found = import.meta.glob(['../../src/game/*.ts', '!../../src/game/*.test.ts'], { eager: true }) as Record<string, Mod>;
export const MODS: Record<string, Mod> = Object.fromEntries(
  Object.entries(found).map(([path, mod]) => [path.replace(/^.*\/|\.ts$/g, ''), mod]).sort(([a], [b]) => (a < b ? -1 : 1)));
type Progress = { id: string; progress: (s: unknown) => [number, number]; ready?: (s: unknown) => boolean };
const goals = () => MODS.goals.GOALS as Progress[];
const milestones = () => (MODS.milestones.CHAPTERS as { milestones: Progress[] }[]).flatMap((c) => c.milestones);
const byId = (list: Progress[], id: string) => list.find((x) => x.id === id)!;
/** Functions TypeScript keeps inside its data tables; Godot has them as functions of their own. */
export const INSIDE: Record<string, Record<string, (...a: never[]) => unknown>> = {
  goals: { goalProgress: (id: string, s: unknown) => byId(goals(), id).progress(s) },
  // Not a TypeScript function: what loading a save and saving it again writes, character for character.
  state: { roundTrip: (raw: string | null, now: number) => call('state', 'serialize', [call('state', 'deserialize', [raw, now])]) },
  milestones: { milestoneProgress: (id: string, s: unknown) => byId(milestones(), id).progress(s), milestoneReady: (id: string, s: unknown) => byId(milestones(), id).ready?.(s) ?? true },
};
export const call = (mod: string, fn: string, args: unknown[]): unknown => {
  const f = MODS[mod]?.[fn] ?? INSIDE[mod]?.[fn];
  if (typeof f !== 'function') throw new Error(`No function ${mod}.${fn}`);
  return (f as (...a: unknown[]) => unknown)(...args);
};
