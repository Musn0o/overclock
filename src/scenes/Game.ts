import Phaser from 'phaser';
import { GAME } from '../config';
import { Profile } from '../systems/Profile';
import { sfx } from '../systems/Sfx';

const PLAYER_W = 30;
const PLAYER_H = 38;

type PlatformKind = 'normal' | 'crumble' | 'bounce';

interface GameInitData {
    revive?: boolean;
    score?: number;
    height?: number;
}

/**
 * OVERCLOCK core loop (Milestone 1).
 *
 * Climb an endless neon tower: move and jump platform to platform while plasma
 * rises from below. Platform variety (one-way, crumbling, bounce pads, moving),
 * wall-jumping off neon pillars, landing juice, combo milestones and near-miss
 * "close call" feedback.
 */
export class Game extends Phaser.Scene {
    private width = 0;
    private height = 0;

    private bg!: Phaser.GameObjects.Graphics;
    private dangerGfx!: Phaser.GameObjects.Graphics;

    private player!: Phaser.GameObjects.Rectangle;
    private visor!: Phaser.GameObjects.Rectangle;
    private body!: Phaser.Physics.Arcade.Body;

    private platforms!: Phaser.Physics.Arcade.StaticGroup;
    private walls!: Phaser.Physics.Arcade.StaticGroup;
    private movers!: Phaser.Physics.Arcade.Group;

    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    private keyA!: Phaser.Input.Keyboard.Key;
    private keyD!: Phaser.Input.Keyboard.Key;

    private heightText!: Phaser.GameObjects.Text;
    private comboText!: Phaser.GameObjects.Text;
    private bestText!: Phaser.GameObjects.Text;
    private popText!: Phaser.GameObjects.Text;
    private jumpLabel!: Phaser.GameObjects.Text;
    private jumpPad!: Phaser.GameObjects.Rectangle;

    private groundPlatform: Phaser.GameObjects.GameObject | null = null;

    private pointerTargetX: number | null = null;
    private facing = 1;

    private baseScore = 0;
    private score = 0;
    private combo = 0;
    private maxCombo = 0;
    private highestY = 0;
    private lastLandingY: number | null = null;
    private wasGrounded = false;
    private lastGroundedAt = -9999;
    private lastWallJumpAt = -9999;
    private jumpBufferedAt = -9999;

    private spawnY = 0;
    private dangerY = 0;
    private dangerSpeed: number = GAME.dangerRiseStart;
    private elapsed = 0;
    private slowmo = 0;
    private closeCallArmed = false;
    private roundActive = true;

    constructor() {
        super('Game');
    }

    init(data: GameInitData = {}): void {
        const revive = data.revive === true;
        this.baseScore = revive ? data.score ?? 0 : 0;
        this.score = this.baseScore;
        this.combo = 0;
        this.maxCombo = 0;
        this.facing = 1;
        this.pointerTargetX = null;
        this.wasGrounded = false;
        this.lastLandingY = null;
        this.roundActive = true;
    }

    create(): void {
        this.elapsed = 0;
        this.dangerSpeed = GAME.dangerRiseStart;
        this.highestY = 0;
        this.slowmo = 0;
        this.closeCallArmed = false;
        this.lastGroundedAt = -9999;
        this.lastWallJumpAt = -9999;
        this.jumpBufferedAt = -9999;
        this.groundPlatform = null;

        this.bg = this.add.graphics().setDepth(0);
        this.dangerGfx = this.add.graphics().setDepth(5);

        this.platforms = this.physics.add.staticGroup();
        this.walls = this.physics.add.staticGroup();
        this.movers = this.physics.add.group({ allowGravity: false, immovable: true });

        this.player = this.add.rectangle(0, 0, PLAYER_W, PLAYER_H, GAME.colors[0]).setDepth(6);
        this.physics.add.existing(this.player);
        this.visor = this.add.rectangle(0, 0, PLAYER_W * 0.6, 8, GAME.colors[1]).setDepth(7);
        this.body = this.player.body as Phaser.Physics.Arcade.Body;
        this.body.setMaxVelocity(GAME.moveSpeed, GAME.maxFall);

        const oneWay = (a: unknown, b: unknown): boolean => {
            const pb = (a as Phaser.GameObjects.Rectangle).body as Phaser.Physics.Arcade.Body;
            const pl = (b as Phaser.GameObjects.Rectangle).body as Phaser.Physics.Arcade.Body;
            return pb.velocity.y >= 0 && pb.bottom <= pl.top + 12;
        };

        this.physics.add.collider(this.player, this.platforms, this.onCollideGround, oneWay, this);
        this.physics.add.collider(this.player, this.movers, this.onCollideGround, oneWay, this);
        this.physics.add.collider(this.player, this.walls);

        this.heightText = this.add
            .text(0, 0, '0 m', {
                fontFamily: 'Arial Black, Arial, sans-serif',
                fontSize: '34px',
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 5
            })
            .setDepth(11);
        this.comboText = this.add
            .text(0, 0, '', {
                fontFamily: 'Arial Black, Arial, sans-serif',
                fontSize: '24px',
                color: '#ffd23d',
                stroke: '#000000',
                strokeThickness: 5
            })
            .setOrigin(0.5, 0)
            .setDepth(11);
        this.bestText = this.add
            .text(0, 0, '', {
                fontFamily: 'Arial Black, Arial, sans-serif',
                fontSize: '20px',
                color: '#7a86c7'
            })
            .setOrigin(1, 0)
            .setDepth(11);
        this.popText = this.add
            .text(0, 0, '', {
                fontFamily: 'Arial Black, Arial, sans-serif',
                fontSize: '40px',
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 6
            })
            .setOrigin(0.5)
            .setDepth(12)
            .setAlpha(0);

        this.jumpPad = this.add
            .rectangle(0, 0, 104, 104, GAME.colors[1], 0.16)
            .setStrokeStyle(3, GAME.colors[1], 0.5)
            .setDepth(9);
        this.jumpLabel = this.add
            .text(0, 0, 'JUMP', { fontFamily: 'Arial Black, Arial, sans-serif', fontSize: '20px', color: '#ffffff' })
            .setOrigin(0.5)
            .setDepth(10);

        this.cursors = this.input.keyboard!.createCursorKeys();
        this.keyA = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A);
        this.keyD = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D);
        this.input.keyboard!.on('keydown-SPACE', () => this.bufferJump());
        this.input.keyboard!.on('keydown-UP', () => this.bufferJump());
        this.input.keyboard!.on('keydown-W', () => this.bufferJump());

        this.input.on('pointerdown', this.onPointerDown, this);
        this.input.on('pointermove', this.onPointerMove, this);
        this.input.on('pointerup', this.onPointerUp, this);

        this.scale.on('resize', this.handleResize, this);
        this.events.once('shutdown', () => this.scale.off('resize', this.handleResize, this));

        this.layout();
        this.resetWorld();
    }

    //  World / generation ---------------------------------------------------

    private resetWorld(): void {
        this.platforms.clear(true, true);
        this.walls.clear(true, true);
        this.movers.clear(true, true);

        const startX = this.width / 2;
        this.spawnPlatform(startX, 40, Math.min(220, this.width * 0.5), 'normal');
        this.player.setPosition(startX, 40 - PLAYER_H / 2 - 10);
        this.body.setVelocity(0, 0);

        this.spawnY = 40 - GAME.rowStep;
        for (let i = 0; i < 8; i++) {
            this.spawnRow(this.spawnY);
            this.spawnY -= GAME.rowStep;
        }

        this.dangerY = 40 + GAME.dangerStartOffset;
        this.cameras.main.scrollY = this.player.y - this.height * 0.62;
    }

    private spawnPlatform(x: number, y: number, w: number, kind: PlatformKind): void {
        const color = kind === 'bounce' ? GAME.colors[2] : kind === 'crumble' ? GAME.colors[3] : GAME.platform;
        const rect = this.add.rectangle(x, y, w, 18, color).setStrokeStyle(2, GAME.platformEdge, 0.85).setDepth(3);
        rect.setData('kind', kind);
        this.platforms.add(rect);
    }

    private spawnMover(x: number, y: number, w: number): void {
        const rect = this.add.rectangle(x, y, w, 18, GAME.colors[0]).setStrokeStyle(2, 0xffffff, 0.5).setDepth(3);
        this.physics.add.existing(rect);
        this.movers.add(rect);
        const body = rect.body as Phaser.Physics.Arcade.Body;
        body.setAllowGravity(false);
        body.setImmovable(true);
        body.setVelocityX(Phaser.Math.RND.pick([-1, 1]) * GAME.moverSpeed);
        rect.setData('minX', w / 2 + 8);
        rect.setData('maxX', this.width - w / 2 - 8);
    }

    private spawnWall(x: number, y: number): void {
        const rect = this.add
            .rectangle(x, y, GAME.wallWidth, GAME.wallHeight, GAME.colors[3])
            .setStrokeStyle(2, 0xffffff, 0.35)
            .setDepth(3);
        this.walls.add(rect);
    }

    private spawnRow(y: number): void {
        const count = Math.random() < 0.55 ? 1 : 2;
        const used: number[] = [];
        for (let i = 0; i < count; i++) {
            const w = Phaser.Math.Between(GAME.platformWidthMin, GAME.platformWidthMax);
            let x = Phaser.Math.Between(Math.round(w / 2), Math.round(this.width - w / 2));
            if (used.length > 0 && Math.abs(x - used[0]) < GAME.platformMinGap) {
                x = Phaser.Math.Clamp(
                    used[0] + (x > used[0] ? 1 : -1) * (w / 2 + GAME.platformMinGap + 10),
                    w / 2,
                    this.width - w / 2
                );
            }
            used.push(x);

            const roll = Math.random();
            const kind: PlatformKind = roll < 0.16 ? 'bounce' : roll < 0.32 ? 'crumble' : 'normal';
            this.spawnPlatform(x, y, w, kind);
        }

        if (Math.random() < 0.1) {
            this.spawnWall(Phaser.Math.Between(40, this.width - 40), y - GAME.rowStep / 2);
        }
        if (Math.random() < 0.12) {
            this.spawnMover(Phaser.Math.Between(90, this.width - 90), y - GAME.rowStep / 2, GAME.moverWidth);
        }
    }

    private cullWorld(): void {
        const below = this.cameras.main.scrollY + this.height + 120;
        const cull = (group: Phaser.Physics.Arcade.Group | Phaser.Physics.Arcade.StaticGroup): void => {
            for (const child of group.getChildren()) {
                if ((child as Phaser.GameObjects.Rectangle).y > below) {
                    child.destroy();
                }
            }
        };
        cull(this.platforms);
        cull(this.walls);
        cull(this.movers);
    }

    private ensureGenerated(): void {
        const above = this.cameras.main.scrollY - 260;
        while (this.spawnY > above) {
            this.spawnRow(this.spawnY);
            this.spawnY -= GAME.rowStep;
        }
    }

    //  Input ----------------------------------------------------------------

    private onPointerDown(pointer: Phaser.Input.Pointer): void {
        if (this.isInJumpZone(pointer)) {
            this.bufferJump();
            return;
        }
        this.pointerTargetX = pointer.x;
    }

    private onPointerMove(pointer: Phaser.Input.Pointer): void {
        if (!pointer.isDown || this.isInJumpZone(pointer)) {
            return;
        }
        this.pointerTargetX = pointer.x;
    }

    private onPointerUp(): void {
        this.pointerTargetX = null;
    }

    private isInJumpZone(pointer: Phaser.Input.Pointer): boolean {
        return pointer.x > this.width * 0.6 && pointer.y > this.height - 150;
    }

    private bufferJump(): void {
        sfx.resume();
        this.jumpBufferedAt = this.time.now;
    }

    private onCollideGround = (_playerObj: unknown, platformObj: unknown): void => {
        this.groundPlatform = platformObj as Phaser.GameObjects.GameObject;
    };

    //  Update ---------------------------------------------------------------

    update(_time: number, deltaMs: number): void {
        if (!this.roundActive) {
            return;
        }
        const raw = Math.min(deltaMs, 50) / 1000;
        this.elapsed += raw;
        if (this.slowmo > 0) {
            this.slowmo = Math.max(0, this.slowmo - raw);
        }
        const dt = raw * (this.slowmo > 0 ? GAME.closeCallSlowmo : 1);

        this.highestY = Math.min(this.highestY, this.player.y);
        this.updateMovers();
        this.updateMovement();
        this.updateJump();
        this.updateCarry();
        this.updateDanger(dt);
        this.ensureGenerated();
        this.cullWorld();
        this.updateCamera();
        this.render();
        this.updateHud();

        this.groundPlatform = null;
    }

    private updateMovers(): void {
        for (const child of this.movers.getChildren()) {
            const rect = child as Phaser.GameObjects.Rectangle;
            const body = rect.body as Phaser.Physics.Arcade.Body;
            if (rect.x <= (rect.getData('minX') as number) && body.velocity.x < 0) {
                body.setVelocityX(Math.abs(body.velocity.x));
            } else if (rect.x >= (rect.getData('maxX') as number) && body.velocity.x > 0) {
                body.setVelocityX(-Math.abs(body.velocity.x));
            }
        }
    }

    private updateMovement(): void {
        let dir = 0;
        if (this.cursors.left?.isDown || this.keyA.isDown) {
            dir = -1;
        } else if (this.cursors.right?.isDown || this.keyD.isDown) {
            dir = 1;
        } else if (this.pointerTargetX !== null) {
            const delta = this.pointerTargetX - this.player.x;
            if (Math.abs(delta) > 10) {
                dir = delta < 0 ? -1 : 1;
            }
        }
        this.body.setVelocityX(dir * GAME.moveSpeed);
        if (dir !== 0) {
            this.facing = dir;
        }
    }

    private updateJump(): void {
        const grounded = this.body.blocked.down;
        if (grounded) {
            this.lastGroundedAt = this.time.now;
        }
        if (grounded && !this.wasGrounded) {
            this.onLand(this.groundPlatform);
        }
        this.wasGrounded = grounded;

        const wantsJump = this.time.now - this.jumpBufferedAt <= GAME.jumpBufferMs;
        const canGroundJump = this.time.now - this.lastGroundedAt <= GAME.coyoteMs;
        const onWall = this.body.blocked.left || this.body.blocked.right;

        if (canGroundJump && wantsJump) {
            this.body.setVelocityY(-GAME.jumpVel);
            this.jumpBufferedAt = -9999;
            this.lastGroundedAt = -9999;
            this.puff(this.player.x, this.player.y + PLAYER_H / 2, GAME.colors[0]);
            sfx.click();
        } else if (onWall && !grounded && wantsJump && this.time.now - this.lastWallJumpAt > GAME.wallJumpCooldownMs) {
            const away = this.body.blocked.left ? 1 : -1;
            this.body.setVelocityY(-GAME.wallJumpVel);
            this.body.setVelocityX(away * GAME.wallJumpPush);
            this.facing = away;
            this.lastWallJumpAt = this.time.now;
            this.jumpBufferedAt = -9999;
            this.puff(this.player.x, this.player.y, GAME.platformEdge);
            sfx.bubble();
        }
    }

    private updateCarry(): void {
        if (!this.body.blocked.down || !this.groundPlatform) {
            return;
        }
        const body = (this.groundPlatform as Phaser.GameObjects.Rectangle).body;
        if (body instanceof Phaser.Physics.Arcade.Body && body.velocity.x !== 0) {
            this.player.x += body.deltaX();
        }
    }

    private onLand(platform: Phaser.GameObjects.GameObject | null): void {
        const y = this.player.y;
        if (this.lastLandingY !== null && y < this.lastLandingY - 6) {
            this.combo += 1;
        } else {
            this.combo = 1;
        }
        this.lastLandingY = y;
        this.maxCombo = Math.max(this.maxCombo, this.combo);
        this.score += this.combo;

        this.squash();
        this.puff(this.player.x, this.player.y + PLAYER_H / 2, GAME.colors[0]);

        if (this.combo >= 3 && this.combo % 5 === 0) {
            this.onComboMilestone();
        } else if (this.combo >= 3) {
            sfx.bubble();
        }

        if (!platform) {
            return;
        }
        const rect = platform as Phaser.GameObjects.Rectangle;
        const kind = rect.getData('kind') as PlatformKind | undefined;
        if (kind === 'bounce') {
            this.body.setVelocityY(-GAME.bounceVel);
            this.puff(rect.x, rect.y, GAME.colors[2]);
            sfx.whoosh();
        } else if (kind === 'crumble' && !rect.getData('crumbling')) {
            rect.setData('crumbling', true);
            this.tweens.add({ targets: rect, x: rect.x + 2, duration: 55, yoyo: true, repeat: 4 });
            this.time.delayedCall(GAME.crumbleDelayMs, () => {
                if (rect.active) {
                    this.puff(rect.x, rect.y, GAME.colors[3]);
                    rect.destroy();
                }
            });
        }
    }

    private onComboMilestone(): void {
        this.showPop(`COMBO x${this.combo}!`, GAME.colors[2]);
        this.cameras.main.flash(120, 80, 60, 20);
        sfx.claim();
    }

    private updateDanger(dt: number): void {
        const t = Phaser.Math.Clamp(this.elapsed / 90, 0, 1);
        this.dangerSpeed = Phaser.Math.Linear(GAME.dangerRiseStart, GAME.dangerRiseMax, t);
        this.dangerY -= this.dangerSpeed * dt;

        const gap = this.dangerY - (this.player.y + PLAYER_H / 2);
        if (gap < GAME.closeCallPx) {
            this.closeCallArmed = true;
        } else if (this.closeCallArmed && gap > GAME.closeCallPx + 70) {
            this.closeCallArmed = false;
            this.score += 25;
            this.slowmo = GAME.closeCallSlowmo;
            this.showPop('CLOSE!', 0xffffff);
            sfx.whoosh();
        }

        if (this.player.y + PLAYER_H / 2 >= this.dangerY) {
            this.die();
        }
    }

    private updateCamera(): void {
        const target = this.player.y - this.height * 0.62;
        this.cameras.main.scrollY = Phaser.Math.Linear(this.cameras.main.scrollY, target, 0.14);
    }

    //  FX -------------------------------------------------------------------

    private squash(): void {
        this.player.setScale(1.25, 0.72);
        this.tweens.add({ targets: this.player, scaleX: 1, scaleY: 1, duration: 140, ease: 'Back.out' });
    }

    private puff(x: number, y: number, color: number): void {
        for (let i = 0; i < 6; i++) {
            const p = this.add.circle(x, y, 4, color, 0.8).setDepth(8);
            const a = Phaser.Math.FloatBetween(Math.PI, Math.PI * 2);
            const d = Phaser.Math.Between(16, 46);
            this.tweens.add({
                targets: p,
                x: x + Math.cos(a) * d,
                y: y + Math.sin(a) * d * 0.6,
                alpha: 0,
                scale: 0.4,
                duration: 320,
                onComplete: () => p.destroy()
            });
        }
    }

    private showPop(text: string, color: number): void {
        this.popText.setText(text).setColor(`#${color.toString(16).padStart(6, '0')}`).setAlpha(1).setScale(0.6);
        this.popText.setPosition(this.width / 2, this.height * 0.32);
        this.tweens.add({ targets: this.popText, scale: 1, duration: 150, ease: 'Back.out' });
        this.tweens.add({ targets: this.popText, alpha: 0, y: this.popText.y - 40, duration: 700, delay: 200 });
    }

    //  Render ---------------------------------------------------------------

    private render(): void {
        const scrollY = this.cameras.main.scrollY;

        this.bg.clear();
        this.bg.fillStyle(GAME.background, 1);
        this.bg.fillRect(0, 0, this.width, this.height);
        this.bg.lineStyle(1, GAME.colors[0], 0.12);
        const start = Math.floor(scrollY / 80) * 80;
        for (let i = -1; i < this.height / 80 + 2; i++) {
            const y = start + i * 80 - scrollY;
            this.bg.lineBetween(0, y, this.width, y);
        }

        const dangerScreenY = this.dangerY - scrollY;
        this.dangerGfx.clear();
        const bands = 10;
        const bandH = Math.max(6, (this.height - dangerScreenY) / bands);
        for (let i = 0; i < bands; i++) {
            this.dangerGfx.fillStyle(GAME.danger, Math.max(0.12, 0.9 - i * 0.07));
            this.dangerGfx.fillRect(0, dangerScreenY + i * bandH, this.width, bandH + 1);
        }
        this.dangerGfx.fillStyle(0xffffff, 0.85);
        this.dangerGfx.fillRect(0, dangerScreenY - 2, this.width, 3);

        this.visor.setPosition(this.player.x + this.facing * 4, this.player.y - 6);
    }

    private updateHud(): void {
        const meters = Math.max(0, Math.floor((0 - this.highestY) * GAME.metersPerPx));
        this.heightText.setText(`${meters} m`);
        this.bestText.setText(`BEST ${Math.max(Profile.profile.bestHeight, meters)} m`);
        this.comboText.setText(this.combo >= 2 ? `COMBO x${this.combo}` : '');
        this.comboText.setAlpha(0.6 + Math.min(0.4, this.combo * 0.05));
    }

    private layout(): void {
        this.width = this.scale.width;
        this.height = this.scale.height;

        this.heightText.setPosition(20, 16);
        this.bestText.setPosition(this.width - 20, 20);
        this.comboText.setPosition(this.width / 2, 16);

        this.jumpPad.setPosition(this.width - 82, this.height - 82);
        this.jumpLabel.setPosition(this.width - 82, this.height - 82);

        if (this.player) {
            this.player.x = Phaser.Math.Clamp(this.player.x, 0, this.width);
        }
    }

    private handleResize(): void {
        this.layout();
        this.render();
    }

    //  End ------------------------------------------------------------------

    private die(): void {
        if (!this.roundActive) {
            return;
        }
        this.roundActive = false;
        sfx.gameOver();
        this.cameras.main.shake(220, 0.015);
        this.body.setVelocity(0, 0);
        this.body.enable = false;

        this.time.delayedCall(700, () => {
            this.scene.start('GameOver', {
                height: Math.max(0, Math.floor((0 - this.highestY) * GAME.metersPerPx)),
                score: this.score
            });
        });
    }
}
