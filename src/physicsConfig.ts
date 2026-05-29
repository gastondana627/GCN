import { CharacterType } from './types';

export interface PhysicsProfile {
  moveSpeed: number; // 1 to 10
  jumpForce: number; // -5 to -20 (negative represents upward velocity in standard 2D canvas coordinates)
  attackType: string;
  specialAbility: string;
}

export const characterPhysics: Record<CharacterType, PhysicsProfile> = {
  classic_og: {
    moveSpeed: 5,
    jumpForce: -12,
    attackType: 'Balanced Strike',
    specialAbility: 'Aura Burst' // Relates to the glowing orange aura in "Aggressive Battle Stance"
  },
  crispy_p: {
    moveSpeed: 4,
    jumpForce: -10,
    attackType: 'Crumb Barrage', // Specifically referenced in the "Aggressive Battle Stance"
    specialAbility: 'Defensive Bulk'
  },
  chicken_fries: {
    moveSpeed: 9,
    jumpForce: -18,
    attackType: 'Rapid Jab',
    specialAbility: 'Aerodynamic Dash' // High maneuverability and verticality
  },
  spicy_nuggs: {
    moveSpeed: 3,
    jumpForce: -8,
    attackType: 'Jalapeño Smash', // Utilizing the jalapeño pepper from the "Jumping Attack"
    specialAbility: 'Max Heat Pose' // Generates an intense steam/heat wave AOE
  }
};

/**
 * Applies the defined physical constants to a player object during the game engine's initialization or update tick.
 */
export function applyPhysicsToPlayer(player: any, characterType: CharacterType) {
  const profile = characterPhysics[characterType];
  
  if (profile) {
    // Map abstract profile stats to actual engine parameters
    player.maxSpeed = profile.moveSpeed;
    player.jumpVelocity = profile.jumpForce;
    player.attackPattern = profile.attackType;
    player.activeStanceSkill = profile.specialAbility;
  }
  
  return player;
}
