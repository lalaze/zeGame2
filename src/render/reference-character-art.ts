import { clearCozyTeam, cozyTeamReady, makeCozyTeam, preloadCozyTeam } from './cozy-team-art';
import { CHARACTER_PROPORTIONS } from './character-proportions';
import type { Look } from '../game/state';
import type { CharacterFrames, Role } from './sprites';
import { clearSeatingEnsemble, preloadSeatingEnsemble } from './cozy-seating-art';
import { batchCharactersReady, clearBatchCharacters, makeBatchCharacter, preloadBatchCharacters } from './cozy-cast-art';

type Point = Readonly<{ x: number; y: number }>;
type Contacts = Readonly<{ foot: Point; head?: Point; headHeight?: number; headScale?: number; bodyScale?: number; legStart?: number; legEnd?: number; legExtension?: number; carryContact?: Point; seatContact?: Point; petContact?: Point }>;
export const STANDING_CHARACTER_SCALE = CHARACTER_PROPORTIONS.standingScale;
export const STANDING_LEG_EXTENSION = CHARACTER_PROPORTIONS.straightLegExtension;
const ZERO = Object.freeze({ x: 0, y: 0 });
const cache = new Map<string, CharacterFrames>();
let contacts = new WeakMap<HTMLCanvasElement, Contacts>();
let pending: Promise<void> | null = null, generation = 0, ready = false;
export function preloadReferenceCharacters(): Promise<void> {
  if (ready && batchCharactersReady() && cozyTeamReady()) return Promise.resolve();
  if (pending) return pending;
  const epoch = generation;
  pending = Promise.all([preloadSeatingEnsemble(), preloadBatchCharacters(), preloadCozyTeam()]).then(() => { if (epoch === generation) ready = true; }).catch(error => { if (epoch === generation) pending = null; throw error; });
  return pending;
}
export function clearReferenceCharacters(): void {
  generation++; ready = false; pending = null; clearSeatingEnsemble(); clearBatchCharacters(); clearCozyTeam(); cache.clear(); contacts = new WeakMap();
}
export function referenceCharacterOffset(_frame: HTMLCanvasElement): Point { return ZERO; }
export function referenceCharacterContacts(frame: HTMLCanvasElement): Contacts | null { return contacts.get(frame) ?? null; }
export function resolveReferenceCharacter(look: Look, role: Role = 'customer', appearanceId?: number): CharacterFrames | null {
  if (!ready || !batchCharactersReady()) return null;
  const key = ['v10', role, look.skin, look.hair, look.hairStyle, look.shirt, look.pants, appearanceId ?? -1].join('.');
  const old = cache.get(key); if (old) return old;
  const result = role === 'customer' ? makeBatchCharacter(look, role, appearanceId, (frame, points) => contacts.set(frame, points)) : makeCozyTeam(look, role, (frame, points) => contacts.set(frame, points));
  if (!result) return null;
  cache.set(key, result); if (cache.size > 160) cache.delete(cache.keys().next().value!);
  return result;
}
