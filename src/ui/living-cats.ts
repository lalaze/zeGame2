import { petActive, petPreferences, type CatArea, type CatId, type Pet } from '../game/pets';
import { t } from '../i18n';
import { showModal } from './modal';

/** Small structural view keeps the pet UI independent of the scene engine. */
export interface LivingCatView {
  area: CatArea;
  behavior: 'patrol' | 'sleep' | 'groom' | 'stretch' | 'watch';
  affection?: number;
  targetKind?: string;
  interaction?: {
    guestId: number;
    phase: 'approach' | 'nuzzle' | 'response' | 'leave';
    elapsed: number;
  };
}

export interface LivingCatControls {
  getActor?: (id: CatId) => LivingCatView | undefined;
  locate?: (id: CatId) => void;
  interact?: (id: CatId) => void;
}

export function livingCatPersonality(pet: Pet): string {
  return t('pet.living.personality', { personality: t(`pet.living.personality.${petPreferences(pet).personality}`) });
}

export function livingCatPreference(pet: Pet): string {
  const preferences = petPreferences(pet);
  return t('pet.living.preference', {
    area: t(`pet.living.area.${preferences.preferredArea}`),
    spot: t(`pet.living.spot.${preferences.preferredSpot}`),
  });
}

export function livingCatActivity(actor?: LivingCatView): string {
  if (!actor) return t('pet.living.settling');
  return t('pet.living.activity', {
    area: t(`pet.living.area.${actor.area}`),
    action: actor.interaction
      ? t(`pet.living.interaction.${actor.interaction.phase}`)
      : t(`pet.living.action.${actor.behavior === 'watch' && actor.targetKind === 'window' ? 'window' : actor.behavior}`),
  }) + ((actor.affection ?? 0) > 0 ? ` · ${t('pet.living.happy')}` : '');
}

/** Scene clicks open a text-only, focus-trapped dialog. Petting is cosmetic. */
export function showLivingCat(pet: Pet, actor: LivingCatView | undefined, onPet: () => void, onLocate?: () => void): void {
  const body = document.createElement('div');
  body.className = 'living-cat-detail';
  for (const text of [livingCatPersonality(pet), livingCatActivity(actor), livingCatPreference(pet), t(petActive(pet) ? 'pet.living.caredFor' : 'pet.living.needsCare'), t('pet.living.petHint')]) {
    const line = document.createElement('p');
    line.textContent = text;
    body.append(line);
  }
  showModal({
    title: t(`pet.${pet.id}.name`),
    body,
    buttons: [
      { label: t('pet.living.pet'), primary: true, disabled: !petActive(pet), onClick: onPet },
      ...(onLocate ? [{ label: t('pet.living.locate'), onClick: onLocate }] : []),
      { label: t('pet.living.letRest') },
    ],
  });
}
