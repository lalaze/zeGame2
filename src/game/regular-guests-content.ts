import type { MessageKey } from '../i18n';
import type { StaticItemId } from './data';

/** Permanent identities built on the existing customer pixel cast. */
export interface RegularGuestDefinition {
  id: string;
  appearanceId: number;
  debutDay: number;
  preferredDrink: StaticItemId;
  nameKey: MessageKey;
  roleKey: MessageKey;
  personalityKey: MessageKey;
  chapters: readonly { titleKey: MessageKey; textKey: MessageKey }[];
}

/** Chapter thresholds and saved progress live in regular-guests.ts, not in the prose. */
export const REGULAR_GUESTS: readonly RegularGuestDefinition[] = [
  {
    id: 'mina', appearanceId: 0, debutDay: 1, preferredDrink: 'espresso',
    nameKey: 'regular.guest.mina.name',
    roleKey: 'regular.guest.mina.role',
    personalityKey: 'regular.guest.mina.personality',
    chapters: [
      { titleKey: 'regular.guest.mina.chapter1.title', textKey: 'regular.guest.mina.chapter1.text' },
      { titleKey: 'regular.guest.mina.chapter2.title', textKey: 'regular.guest.mina.chapter2.text' },
      { titleKey: 'regular.guest.mina.chapter3.title', textKey: 'regular.guest.mina.chapter3.text' },
      { titleKey: 'regular.guest.mina.chapter4.title', textKey: 'regular.guest.mina.chapter4.text' },
      { titleKey: 'regular.guest.mina.chapter5.title', textKey: 'regular.guest.mina.chapter5.text' },
    ],
  },
  {
    id: 'theo', appearanceId: 17, debutDay: 1, preferredDrink: 'americano',
    nameKey: 'regular.guest.theo.name',
    roleKey: 'regular.guest.theo.role',
    personalityKey: 'regular.guest.theo.personality',
    chapters: [
      { titleKey: 'regular.guest.theo.chapter1.title', textKey: 'regular.guest.theo.chapter1.text' },
      { titleKey: 'regular.guest.theo.chapter2.title', textKey: 'regular.guest.theo.chapter2.text' },
      { titleKey: 'regular.guest.theo.chapter3.title', textKey: 'regular.guest.theo.chapter3.text' },
      { titleKey: 'regular.guest.theo.chapter4.title', textKey: 'regular.guest.theo.chapter4.text' },
      { titleKey: 'regular.guest.theo.chapter5.title', textKey: 'regular.guest.theo.chapter5.text' },
    ],
  },
  {
    id: 'iris', appearanceId: 10, debutDay: 3, preferredDrink: 'blacktea',
    nameKey: 'regular.guest.iris.name',
    roleKey: 'regular.guest.iris.role',
    personalityKey: 'regular.guest.iris.personality',
    chapters: [
      { titleKey: 'regular.guest.iris.chapter1.title', textKey: 'regular.guest.iris.chapter1.text' },
      { titleKey: 'regular.guest.iris.chapter2.title', textKey: 'regular.guest.iris.chapter2.text' },
      { titleKey: 'regular.guest.iris.chapter3.title', textKey: 'regular.guest.iris.chapter3.text' },
      { titleKey: 'regular.guest.iris.chapter4.title', textKey: 'regular.guest.iris.chapter4.text' },
      { titleKey: 'regular.guest.iris.chapter5.title', textKey: 'regular.guest.iris.chapter5.text' },
    ],
  },
  {
    id: 'nico', appearanceId: 4, debutDay: 3, preferredDrink: 'latte',
    nameKey: 'regular.guest.nico.name',
    roleKey: 'regular.guest.nico.role',
    personalityKey: 'regular.guest.nico.personality',
    chapters: [
      { titleKey: 'regular.guest.nico.chapter1.title', textKey: 'regular.guest.nico.chapter1.text' },
      { titleKey: 'regular.guest.nico.chapter2.title', textKey: 'regular.guest.nico.chapter2.text' },
      { titleKey: 'regular.guest.nico.chapter3.title', textKey: 'regular.guest.nico.chapter3.text' },
      { titleKey: 'regular.guest.nico.chapter4.title', textKey: 'regular.guest.nico.chapter4.text' },
      { titleKey: 'regular.guest.nico.chapter5.title', textKey: 'regular.guest.nico.chapter5.text' },
    ],
  },
  {
    id: 'june', appearanceId: 7, debutDay: 5, preferredDrink: 'cappuccino',
    nameKey: 'regular.guest.june.name',
    roleKey: 'regular.guest.june.role',
    personalityKey: 'regular.guest.june.personality',
    chapters: [
      { titleKey: 'regular.guest.june.chapter1.title', textKey: 'regular.guest.june.chapter1.text' },
      { titleKey: 'regular.guest.june.chapter2.title', textKey: 'regular.guest.june.chapter2.text' },
      { titleKey: 'regular.guest.june.chapter3.title', textKey: 'regular.guest.june.chapter3.text' },
      { titleKey: 'regular.guest.june.chapter4.title', textKey: 'regular.guest.june.chapter4.text' },
      { titleKey: 'regular.guest.june.chapter5.title', textKey: 'regular.guest.june.chapter5.text' },
    ],
  },
  {
    id: 'alba', appearanceId: 13, debutDay: 5, preferredDrink: 'hotchoc',
    nameKey: 'regular.guest.alba.name',
    roleKey: 'regular.guest.alba.role',
    personalityKey: 'regular.guest.alba.personality',
    chapters: [
      { titleKey: 'regular.guest.alba.chapter1.title', textKey: 'regular.guest.alba.chapter1.text' },
      { titleKey: 'regular.guest.alba.chapter2.title', textKey: 'regular.guest.alba.chapter2.text' },
      { titleKey: 'regular.guest.alba.chapter3.title', textKey: 'regular.guest.alba.chapter3.text' },
      { titleKey: 'regular.guest.alba.chapter4.title', textKey: 'regular.guest.alba.chapter4.text' },
      { titleKey: 'regular.guest.alba.chapter5.title', textKey: 'regular.guest.alba.chapter5.text' },
    ],
  },
  {
    id: 'ren', appearanceId: 6, debutDay: 7, preferredDrink: 'coldbrew',
    nameKey: 'regular.guest.ren.name',
    roleKey: 'regular.guest.ren.role',
    personalityKey: 'regular.guest.ren.personality',
    chapters: [
      { titleKey: 'regular.guest.ren.chapter1.title', textKey: 'regular.guest.ren.chapter1.text' },
      { titleKey: 'regular.guest.ren.chapter2.title', textKey: 'regular.guest.ren.chapter2.text' },
      { titleKey: 'regular.guest.ren.chapter3.title', textKey: 'regular.guest.ren.chapter3.text' },
      { titleKey: 'regular.guest.ren.chapter4.title', textKey: 'regular.guest.ren.chapter4.text' },
      { titleKey: 'regular.guest.ren.chapter5.title', textKey: 'regular.guest.ren.chapter5.text' },
    ],
  },
  {
    id: 'tess', appearanceId: 2, debutDay: 7, preferredDrink: 'fruittea',
    nameKey: 'regular.guest.tess.name',
    roleKey: 'regular.guest.tess.role',
    personalityKey: 'regular.guest.tess.personality',
    chapters: [
      { titleKey: 'regular.guest.tess.chapter1.title', textKey: 'regular.guest.tess.chapter1.text' },
      { titleKey: 'regular.guest.tess.chapter2.title', textKey: 'regular.guest.tess.chapter2.text' },
      { titleKey: 'regular.guest.tess.chapter3.title', textKey: 'regular.guest.tess.chapter3.text' },
      { titleKey: 'regular.guest.tess.chapter4.title', textKey: 'regular.guest.tess.chapter4.text' },
      { titleKey: 'regular.guest.tess.chapter5.title', textKey: 'regular.guest.tess.chapter5.text' },
    ],
  },
  {
    id: 'sam', appearanceId: 24, debutDay: 9, preferredDrink: 'flatwhite',
    nameKey: 'regular.guest.sam.name',
    roleKey: 'regular.guest.sam.role',
    personalityKey: 'regular.guest.sam.personality',
    chapters: [
      { titleKey: 'regular.guest.sam.chapter1.title', textKey: 'regular.guest.sam.chapter1.text' },
      { titleKey: 'regular.guest.sam.chapter2.title', textKey: 'regular.guest.sam.chapter2.text' },
      { titleKey: 'regular.guest.sam.chapter3.title', textKey: 'regular.guest.sam.chapter3.text' },
      { titleKey: 'regular.guest.sam.chapter4.title', textKey: 'regular.guest.sam.chapter4.text' },
      { titleKey: 'regular.guest.sam.chapter5.title', textKey: 'regular.guest.sam.chapter5.text' },
    ],
  },
  {
    id: 'vivi', appearanceId: 21, debutDay: 9, preferredDrink: 'lemontea',
    nameKey: 'regular.guest.vivi.name',
    roleKey: 'regular.guest.vivi.role',
    personalityKey: 'regular.guest.vivi.personality',
    chapters: [
      { titleKey: 'regular.guest.vivi.chapter1.title', textKey: 'regular.guest.vivi.chapter1.text' },
      { titleKey: 'regular.guest.vivi.chapter2.title', textKey: 'regular.guest.vivi.chapter2.text' },
      { titleKey: 'regular.guest.vivi.chapter3.title', textKey: 'regular.guest.vivi.chapter3.text' },
      { titleKey: 'regular.guest.vivi.chapter4.title', textKey: 'regular.guest.vivi.chapter4.text' },
      { titleKey: 'regular.guest.vivi.chapter5.title', textKey: 'regular.guest.vivi.chapter5.text' },
    ],
  },
  {
    id: 'otto', appearanceId: 8, debutDay: 11, preferredDrink: 'cortado',
    nameKey: 'regular.guest.otto.name',
    roleKey: 'regular.guest.otto.role',
    personalityKey: 'regular.guest.otto.personality',
    chapters: [
      { titleKey: 'regular.guest.otto.chapter1.title', textKey: 'regular.guest.otto.chapter1.text' },
      { titleKey: 'regular.guest.otto.chapter2.title', textKey: 'regular.guest.otto.chapter2.text' },
      { titleKey: 'regular.guest.otto.chapter3.title', textKey: 'regular.guest.otto.chapter3.text' },
      { titleKey: 'regular.guest.otto.chapter4.title', textKey: 'regular.guest.otto.chapter4.text' },
      { titleKey: 'regular.guest.otto.chapter5.title', textKey: 'regular.guest.otto.chapter5.text' },
    ],
  },
  {
    id: 'luz', appearanceId: 29, debutDay: 11, preferredDrink: 'hojicha',
    nameKey: 'regular.guest.luz.name',
    roleKey: 'regular.guest.luz.role',
    personalityKey: 'regular.guest.luz.personality',
    chapters: [
      { titleKey: 'regular.guest.luz.chapter1.title', textKey: 'regular.guest.luz.chapter1.text' },
      { titleKey: 'regular.guest.luz.chapter2.title', textKey: 'regular.guest.luz.chapter2.text' },
      { titleKey: 'regular.guest.luz.chapter3.title', textKey: 'regular.guest.luz.chapter3.text' },
      { titleKey: 'regular.guest.luz.chapter4.title', textKey: 'regular.guest.luz.chapter4.text' },
      { titleKey: 'regular.guest.luz.chapter5.title', textKey: 'regular.guest.luz.chapter5.text' },
    ],
  },
];
