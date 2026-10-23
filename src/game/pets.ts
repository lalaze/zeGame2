import type { GameState } from './state';

export const MAX_PETS = 3;
export const CAT_GROUPS = ['local', 'shorthair', 'longhair'] as const;
export type CatGroup = typeof CAT_GROUPS[number];
export const CATS = [
  { id: 'ginger', group: 'local', adoption: 300, careCost: 8, traffic: 0.08 },
  { id: 'tuxedo', group: 'local', adoption: 800, careCost: 12, traffic: 0.12 },
  { id: 'calico', group: 'local', adoption: 1800, careCost: 18, traffic: 0.16 },
  { id: 'tabby', group: 'local', adoption: 400, careCost: 8, traffic: 0.08 },
  { id: 'black', group: 'local', adoption: 500, careCost: 9, traffic: 0.09 },
  { id: 'white', group: 'local', adoption: 650, careCost: 10, traffic: 0.10 },
  { id: 'british', group: 'shorthair', adoption: 1000, careCost: 12, traffic: 0.12 },
  { id: 'american', group: 'shorthair', adoption: 900, careCost: 11, traffic: 0.11 },
  { id: 'siamese', group: 'shorthair', adoption: 1200, careCost: 13, traffic: 0.13 },
  { id: 'ragdoll', group: 'longhair', adoption: 2000, careCost: 19, traffic: 0.16 },
  { id: 'persian', group: 'longhair', adoption: 1600, careCost: 16, traffic: 0.14 },
  { id: 'mainecoon', group: 'longhair', adoption: 2400, careCost: 20, traffic: 0.16 },
] as const;
export type CatId = typeof CATS[number]['id'];
export const CAT_PERSONALITIES = ['playful', 'quiet', 'affectionate'] as const;
export const CAT_AREAS = ['main', 'reading', 'greenhouse', 'terrace'] as const;
export const CAT_SPOTS = ['cozy', 'window', 'explore'] as const;
export type CatPersonality = typeof CAT_PERSONALITIES[number];
export type CatArea = typeof CAT_AREAS[number];
export type CatSpot = typeof CAT_SPOTS[number];
export interface PetPreferences {
  personality: CatPersonality;
  preferredArea: CatArea;
  preferredSpot: CatSpot;
}
export interface Pet extends Partial<PetPreferences> { id: CatId; careSeconds: number; autoRefill: boolean; fosterUntilDay?: number }

// Explicit ID-based defaults remain stable when the catalog order changes. Every
// resident has its own combination, including cats adopted from legacy saves.
const DEFAULT_PREFERENCES: Record<CatId, readonly [CatPersonality, CatArea, CatSpot]> = {
  ginger: ['playful', 'main', 'explore'],
  tuxedo: ['quiet', 'reading', 'cozy'],
  calico: ['affectionate', 'greenhouse', 'window'],
  tabby: ['playful', 'terrace', 'explore'],
  black: ['quiet', 'greenhouse', 'cozy'],
  white: ['affectionate', 'reading', 'window'],
  british: ['quiet', 'main', 'cozy'],
  american: ['playful', 'greenhouse', 'explore'],
  siamese: ['affectionate', 'main', 'window'],
  ragdoll: ['affectionate', 'terrace', 'cozy'],
  persian: ['quiet', 'terrace', 'window'],
  mainecoon: ['playful', 'reading', 'explore'],
};

/** Resolve each field independently, retaining valid preferences in older saves. */
export function petPreferences(pet: Pick<Pet, 'id'> & Partial<PetPreferences>): PetPreferences {
  const [personality, preferredArea, preferredSpot] = DEFAULT_PREFERENCES[pet.id];
  return {
    personality: CAT_PERSONALITIES.includes(pet.personality as CatPersonality) ? pet.personality! : personality,
    preferredArea: CAT_AREAS.includes(pet.preferredArea as CatArea) ? pet.preferredArea! : preferredArea,
    preferredSpot: CAT_SPOTS.includes(pet.preferredSpot as CatSpot) ? pet.preferredSpot! : preferredSpot,
  };
}
export const CARE_SECONDS = 180;
export const MAX_CARE_SECONDS = CARE_SECONDS * 10;
const EPSILON = 1e-8;
export const catDef = (id: string) => CATS.find((cat) => cat.id === id);
export const petActive = (pet: Pet) => pet.careSeconds > EPSILON;
export const petTraffic = (state: GameState) => 1 + state.pets.reduce((sum, pet) => sum + (petActive(pet) ? catDef(pet.id)!.traffic : 0), 0);

/** Stocking can anticipate the first affordable automatic refill on opening.
 * This is a forecast only: never spends money or activates actual cat traffic.
 * Share the current cash reserve in the same pet order as updatePetCare. */
export function forecastPetTraffic(state: GameState): number {
  let reserve = state.coins;
  return 1 + state.pets.reduce((sum, pet) => {
    if (petActive(pet)) return sum + catDef(pet.id)!.traffic;
    const cat = catDef(pet.id)!;
    if (!pet.autoRefill || reserve < cat.careCost) return sum;
    reserve -= cat.careCost;
    return sum + cat.traffic;
  }, 0);
}


/** Adoption includes the first care pack. Its supplies are expensed as consumed. */
export function adoptCat(state: GameState, id: string): boolean {
  const cat = catDef(id);
  const foster = state.pets.find(p => p.id === id && p.fosterUntilDay);
  if (cat && foster && state.phase === 'prep' && state.coins >= cat.adoption) {
    state.coins -= cat.adoption;
    delete foster.fosterUntilDay;
    foster.autoRefill = true;
    return true;
  }
  if (!cat || state.pets.length >= MAX_PETS || state.phase !== 'prep' || state.pets.some((pet) => pet.id === id) || state.coins < cat.adoption) return false;
  state.coins -= cat.adoption;
  state.pets.push({ id: cat.id, careSeconds: CARE_SECONDS, autoRefill: true, ...petPreferences({ id: cat.id }) });
  return true;
}

export function refillPet(state: GameState, id: string): boolean {
  const pet = state.pets.find((pet) => pet.id === id);
  const cat = catDef(id);
  if (!pet || !cat || pet.careSeconds + CARE_SECONDS > MAX_CARE_SECONDS + EPSILON || state.coins < cat.careCost) return false;
  state.coins -= cat.careCost;
  pet.careSeconds = Math.min(MAX_CARE_SECONDS, pet.careSeconds + CARE_SECONDS);
  return true;
}

/** No offline, preparation or closing charges. Empty supplies suspend the bonus. */
export function updatePetCare(state: GameState, dt: number): void {
  if (state.phase !== 'open' || !Number.isFinite(dt) || dt <= 0) return;
  for (const pet of state.pets) {
    if (pet.fosterUntilDay) continue;
    const cat = catDef(pet.id)!;
    let remaining = dt;
    while (remaining > EPSILON) {
      if (!petActive(pet)) {
        pet.careSeconds = 0;
        if (!pet.autoRefill || !refillPet(state, pet.id)) break;
      }
      const used = Math.min(remaining, pet.careSeconds);
      pet.careSeconds = Math.max(0, pet.careSeconds - used);
      remaining -= used;
      state.today.petCost += used / CARE_SECONDS * cat.careCost;
    }
  }
}

export function parsePets(value: unknown): Pet[] {
  if (!Array.isArray(value)) return [];
  const result: Pet[] = [];
  for (const entry of value) {
    if (result.length >= MAX_PETS) break;
    if (!entry || typeof entry !== 'object') continue;
    const p = entry as Record<string, unknown>;
    const cat = typeof p.id === 'string' ? catDef(p.id) : undefined;
    if (!cat || result.some((pet) => pet.id === cat.id)) continue;
    const care = typeof p.careSeconds === 'number' && Number.isFinite(p.careSeconds) ? p.careSeconds : 0;
    result.push({ id: cat.id, careSeconds: Math.max(0, Math.min(MAX_CARE_SECONDS, care)), autoRefill: p.autoRefill === true,
      ...(typeof p.fosterUntilDay === 'number' && Number.isSafeInteger(p.fosterUntilDay) && p.fosterUntilDay > 0 ? { fosterUntilDay: p.fosterUntilDay } : {}),
      ...petPreferences({ id: cat.id, personality: p.personality as CatPersonality, preferredArea: p.preferredArea as CatArea, preferredSpot: p.preferredSpot as CatSpot }),
    });
  }
  return result;
}
