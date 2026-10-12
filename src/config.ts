export const GAME = {
    title: 'OVERCLOCK',
    tagline: 'Climb. Do not look down.',

    // Original neon palette. No borrowed IP, no external assets.
    colors: [0x37f0ff, 0xff3d81, 0xffd23d, 0x9b5de5],

    background: 0x0a0a18,
    backgroundAccent: 0x161630,

    platform: 0x24244a,
    platformEdge: 0x37f0ff,
    danger: 0xff3d81,

    interstitialEvery: 3,
    reviveRewardId: 'overclock-revive-1',

    // Physics / feel (world y grows downward; up is negative).
    gravity: 1700,
    moveSpeed: 320,
    jumpVel: 700,
    maxFall: 1000,
    coyoteMs: 90,
    jumpBufferMs: 120,

    // Platform generation.
    rowStep: 120,
    platformWidthMin: 88,
    platformWidthMax: 168,
    platformMinGap: 30,

    // Rising danger.
    dangerStartOffset: 560,
    dangerRiseStart: 24,
    dangerRiseMax: 92,

    metersPerPx: 1 / 12
} as const;

export type GameConfig = typeof GAME;
