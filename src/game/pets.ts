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
export interface Pet { id: CatId; careSeconds: number; autoRefill: boolean }
export const CARE_SECONDS = 180;
export const MAX_CARE_SECONDS = CARE_SECONDS * 10;
const EPSILON = 1e-8;
export const catDef = (id: string) => CATS.find((cat) => cat.id === id);
export const petActive = (pet: Pet) => pet.careSeconds > EPSILON;
export const petTraffic = (state: GameState) => 1 + state.pets.reduce((sum, pet) => sum + (petActive(pet) ? catDef(pet.id)!.traffic : 0), 0);

/** Adoption includes the first care pack. Its supplies are expensed as consumed. */
export function adoptCat(state: GameState, id: string): boolean {
  const cat = catDef(id);
  if (!cat || state.pets.length >= MAX_PETS || state.phase !== 'prep' || state.pets.some((pet) => pet.id === id) || state.coins < cat.adoption) return false;
  state.coins -= cat.adoption;
  state.pets.push({ id: cat.id, careSeconds: CARE_SECONDS, autoRefill: true });
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
    result.push({ id: cat.id, careSeconds: Math.max(0, Math.min(MAX_CARE_SECONDS, care)), autoRefill: p.autoRefill === true });
  }
  return result;
}
