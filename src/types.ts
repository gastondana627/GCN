export type CharacterType = 'classic_og' | 'crispy_p' | 'chicken_fries' | 'spicy_nuggs';

export interface UserProfile {
  selectedCharacter: CharacterType;
  unlockedLevels: boolean[];
}

export interface Entity {
  x: number;
  y: number;
  width: number;
  height: number;
  vx: number;
  vy: number;
}

export interface Debris {
  x: number;
  y: number;
  type: 'fry' | 'grease' | 'mustard';
  rotation: number;
  size: number;
}

export interface Player extends Entity {
  characterType?: CharacterType;
  maxSpeed?: number;
  jumpVelocity?: number;
  attackPattern?: string;
  activeStanceSkill?: string;
  isJumping: boolean;
  jumpCount: number;
  jumpKeyReleased: boolean;
  isStealth: boolean;
  isAttacking: boolean;
  attackCooldown: number;
  projectileCooldown: number;
  health: number;
  nuggetsRescued: number;
  kills: number;
  facing: 1 | -1;
  isDead?: boolean;
  deathTimer?: number;
  deathCause?: string;
  debris: Debris[];
  saltCount: number;
  saltCooldown: number;
  slowTimer?: number;
  activeBuffs?: {
    speed?: number;
    attack?: number;
    greaseImmunity?: number;
  };
  superMustardShots?: number;
  lettuceStars?: number;
}

export interface Enemy extends Entity {
  type: 'fry-monster' | 'sauce-sentry' | 'flying-fry' | 'dill-slicer' | 'tomato-thrower' | 'mayo-monster' | 'chili-boss' | 'evil-bun';
  patrolRange: number;
  startPoint: number;
  direction: 1 | -1;
  health: number;
  maxHealth?: number;
  isDead: boolean;
  flashTimer?: number;
  hitColorTimer?: number;
  knockbackX?: number;
  deathTimer?: number;
  // For flying fry
  startY?: number;
  // For dill slicer
  rotation?: number;
  state?: 'patrol' | 'charge' | 'distracted';
  chargeCooldown?: number;
  // For tomato thrower
  throwCooldown?: number;
  frozenTimer?: number;
  superMustardHits?: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  type?: 'fry' | 'smoke' | 'sparkle' | 'oil' | 'waffle-fry' | 'curly-fry' | 'pickle-juice' | 'tomato-juice' | 'mayo' | 'hot-sauce' | 'ice';
  rotation?: number;
  rotationSpeed?: number;
}

export interface Level {
  platforms: Platform[];
  hazards: Hazard[];
  spotlights: Spotlight[];
  nuggets: Collectible[];
  powerUps?: PowerUp[];
  goal: { x: number; y: number; width: number; height: number };
}

export interface Platform {
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'normal' | 'mustard' | 'lettuce-star';
}

export interface Hazard {
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'mustard-water' | 'mayo-puddle' | 'hot-sauce';
}

export interface Spotlight {
  x: number;
  y: number;
  radius: number;
  speed: number;
  range: number;
  currentOffset: number;
}

export interface Collectible {
  x: number;
  y: number;
  width: number;
  height: number;
  name: string;
  collected: boolean;
}

export interface PowerUp {
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'speed' | 'attack' | 'grease-immunity' | 'sea-salt' | 'super-mustard' | 'health';
  collected: boolean;
  bobOffset?: number;
}

export interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  active: boolean;
  type?: 'mustard' | 'salt' | 'tomato-slice' | 'mayo-glob' | 'super-mustard' | 'chili-fire' | 'lettuce-star' | 'crumb' | 'salt-bullet' | 'hot-sauce';
}

export interface Distraction {
  x: number;
  y: number;
  life: number;
  maxLife: number;
  active: boolean;
}

export interface CollectionAnimation {
  x: number;
  y: number;
  timer: number;
  maxTimer: number;
  type: 'nugget' | 'powerup';
  powerUpType?: 'speed' | 'attack' | 'grease-immunity' | 'sea-salt' | 'super-mustard' | 'health';
}

export interface FloatingText {
  x: number;
  y: number;
  text: string;
  life: number;
  maxLife: number;
  color: string;
  fontSize?: number;
}

export interface GameState {
  player: Player;
  enemies: Enemy[];
  projectiles: Projectile[];
  distractions: Distraction[];
  particles: Particle[];
  collectionAnimations: CollectionAnimation[];
  floatingTexts: FloatingText[];
  powerUps: PowerUp[];
  level: Level;
  camera: { x: number; y: number };
  status: 'start' | 'playing' | 'gameover' | 'win' | 'level1-intro' | 'level2-intro' | 'level3-intro' | 'level4-intro' | 'level5-intro' | 'level6-intro';
  score: number;
  timeElapsed: number;
  timeLeft: number;
  shakeIntensity: number;
  frameCounter: number;
  currentLevelIndex: number;
  bossIntroTimer?: number;
  levelTransitionTimer?: number;
  isPaused?: boolean;
}
