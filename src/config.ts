export const GAME = {
    title: 'OVERCLOCK',
    tagline: 'Climb. Do not look down.',

    // Original neon palette. No borrowed IP, no external assets.
    colors: [0x37f0ff, 0xff3d81, 0xffd23d, 0x9b5de5],

    background: 0x0a0a18,
    backgroundAccent: 0x161630,
    outside: 0x05050f,

    platform: 0x24244a,
    platformEdge: 0x37f0ff,
    wall: 0x2b2b6b,
    danger: 0xff3d81,

    interstitialEvery: 3,
    reviveRewardId: 'overclock-revive-1',

    // Movement: Icy-Tower-style momentum. Faster run -> higher jump.
    gravity: 1700,
    maxSpeed: 430,
    accel: 2500,
    decel: 2200,
    jumpBase: 690,
    jumpSpeedBonus: 360,
    maxFall: 1050,
    wallSlideSpeed: 150,
    wallJumpVel: 770,
    wallJumpPush: 330,
    wallJumpCooldownMs: 200,
    coyoteMs: 90,
    jumpBufferMs: 120,

    // Narrow tower (side walls) so platforms are always reachable.
    towerMaxWidth: 560,
    wallThickness: 16,
    rowStep: 132,
    platformWidthMin: 80,
    platformWidthMax: 150,
    platformMinGap: 26,

    // Rising danger.
    dangerStartOffset: 560,
    dangerRiseStart: 24,
    dangerRiseMax: 92,

    // Platform variety (Milestone 1).
    bounceVel: 1010,
    crumbleDelayMs: 460,
    moverWidth: 100,
    moverSpeed: 80,

    // Dynamic tower "squeeze" event (walls close in, then reopen).
    squeezeCycle: 16,
    squeezeStart: 10,
    squeezeDuration: 6,
    squeezeInset: 92,

    // Drifting hazards to dodge.
    enemyWidth: 26,
    enemySpeed: 74,
    enemyChance: 0.06,

    // Feedback.
    closeCallPx: 46,
    closeCallSlowmo: 0.35,

    metersPerPx: 1 / 12
} as const;

export type GameConfig = typeof GAME;
