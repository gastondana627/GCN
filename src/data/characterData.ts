import { CharacterType } from '../types';

export interface CharacterConfig {
  name: string;
  tagline: string;
  description: string;
  imageSrc: string;
  stances?: string[];
  expressions?: string[];
}

export type CharacterConfigMap = Record<CharacterType, CharacterConfig>;

export const characterData: CharacterConfigMap = {
  classic_og: {
    name: 'THE OG',
    tagline: 'The Balanced Prototype',
    description: 'Orange nugget body with stick-arms, stick-legs, and a bold eye design. Equipped with the Honey Mustard Blaster (standard rate of fire, balanced output). Supported stances: Standing (Neutral), Jumping, and Aggressive Battle Stance.',
    imageSrc: '/assets/characters/og.png',
    stances: ['Standing (Neutral)', 'Jumping', 'Aggressive Battle Stance'],
    expressions: ['Default', 'Happy / Excited', 'Angry / Serious', 'Sad / Disappointed', 'Nervous / Concerned']
  },
  crispy_p: {
    name: 'CRISPY P.',
    tagline: 'The Battle-Hardened Veteran',
    description: 'The Nugget Warrior. Armed with the heavy Crumb Shotgun (fires 3 spreading crumbs in a cone, slow reload speed but massive close-quarters output). Supported stances: Neutral Standing Pose, Determined Jumping Pose, and Aggressive Battle Stance.',
    imageSrc: '/assets/characters/crispy.png',
    stances: ['Neutral Standing Pose', 'Determined Jumping Pose (Airborne - Focused)', 'Aggressive Battle Stance (Crazy Crumb Barrage Ready)'],
    expressions: ['Worried', 'Happy', 'Focused']
  },
  chicken_fries: {
    name: 'CHICKEN FRIES',
    tagline: 'The Elongated Retro Athlete',
    description: 'Aerodynamic profile with Fry Gold body and sporty headband. Armed with the rapid Salt SMG (extremely high fire rate, high-velocity salt bullets for suppressive output). Supported stances: Front View, Side View, Jumping, and Combat Stance.',
    imageSrc: '/assets/characters/fries.png',
    stances: ['Front View', 'Side View (fry profile)', 'Jumping', 'Combat Stance', 'Defensive/Cover Stance'],
    expressions: ['Neutral', 'Happy', 'Determined', 'Surprised', 'Supressiod', 'Winking', 'Angry']
  },
  spicy_nuggs: {
    name: 'SPICY NUGGS',
    tagline: 'The Volcanic Wildcard',
    description: 'Volcanic wildcard with max heat output. Armed with the heavy Hot Sauce Launcher (fires slow, heavy projectiles that deal massive explosive splash damage). Color palette: Red, Green, Yellow, Gray.',
    imageSrc: '/assets/characters/spicy.png',
    stances: ['Spicy Nuggs', 'Max Heat Pose', 'Jumping Attack'],
    expressions: ['Rage', 'Spicy Sweat']
  }
};
