import Phaser from 'phaser';
import { GAME } from '../config';
import { Profile } from '../systems/Profile';
import { sfx } from '../systems/Sfx';

const PLAYER_W = 30;
const PLAYER_H = 38;
const START_Y = 40;

type PlatformKind = 'normal' | 'crumble' | 'bounce';

interface GameInitData {
    revive?: boolean;
    score?: number;
    height?: number;
}

/**
 * OVERCLOCK core loop.
 *
 * Icy-Tower-style momentum: running fast makes you jump higher, and the tower
 * is narrow with solid side walls you can wall-slide and wall-jump off. Plasma
 * rises from below. One-way, crumbling, bounce and moving platforms; combo on
 * chained landings; "close call" slow-mo when the plasma nearly catches you.
 */
export class Game extends Phaser.Scene {
    private width = 0;
    private height = 0;

    private towerLeft = 0;
    private towerRight = 0;
    private towerWidth = 0;
    private innerLeft = 0;
    private innerRight = 0;
    private curInnerLeft = 0;
    private curInnerRight = 0;
    private squeeze = 0;
    private squeezeWarned = false;

    private canWallJump = true;
    private prevWallLeft = false;
    private prevWallRight = false;

    private bg!: Phaser.GameObjects.Graphics;
    private dangerGfx!: Phaser.GameObjects.Graphics;

    private player!: Phaser.GameObjects.Rectangle;
    private visor!: Phaser.GameObjects.Rectangle;
    private body!: Phaser.Physics.Arcade.Body;

    private platforms!: Phaser.Physics.Arcade.StaticGroup;
    private movers!: Phaser.Physics.Arcade.Group;
    private enemies: Phaser.GameObjects.Rectangle[] = [];

    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    private keyA!: Phaser.Input.Keyboard.Key;
    private keyD!: Phaser.Input.Keyboard.Key;

    private leftHeld = false;
    private rightHeld = false;
    private btnLeft!: Phaser.GameObjects.Rectangle;
    private btnRight!: Phaser.GameObjects.Rectangle;
    private btnJump!: Phaser.GameObjects.Rectangle;
    private btnLeftLabel!: Phaser.GameObjects.Text;
    private btnRightLabel!: Phaser.GameObjects.Text;
    private btnJumpLabel!: Phaser.GameObjects.Text;

    private heightText!: Phaser.GameObjects.Text;
    private comboText!: Phaser.GameObjects.Text;
    private bestText!: Phaser.GameObjects.Text;
    private popText!: Phaser.GameObjects.Text;

    private groundPlatform: Phaser.GameObjects.GameObject | null = null;
    private facing = 1;

    private baseScore = 0;
    private score = 0;
    private combo = 0;
    private maxCombo = 0;
    private highestY = 0;
    private lastLandingY: number | null = null;
    private wasGrounded = false;
    private lastGroundedAt = -9999;
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
        this.leftHeld = false;
        this.rightHeld = false;
        this.wasGrounded = false;
        this.lastLandingY = null;
        this.canWallJump = true;
        this.prevWallLeft = false;
        this.prevWallRight = false;
        this.roundActive = true;
    }

    create(): void {
        this.elapsed = 0;
        this.dangerSpeed = GAME.dangerRiseStart;
        this.highestY = 0;
        this.slowmo = 0;
        this.closeCallArmed = false;
        this.squeeze = 0;
        this.squeezeWarned = false;
        this.lastGroundedAt = -9999;
        this.jumpBufferedAt = -9999;
        this.groundPlatform = null;

        this.bg = this.add.graphics().setDepth(0);
        this.dangerGfx = this.add.graphics().setDepth(5);

        this.platforms = this.physics.add.staticGroup();
        this.movers = this.physics.add.group({ allowGravity: false, immovable: true });

        this.player = this.add.rectangle(0, 0, PLAYER_W, PLAYER_H, GAME.colors[0]).setDepth(6);
        this.physics.add.existing(this.player);
        this.visor = this.add.rectangle(0, 0, PLAYER_W * 0.6, 8, GAME.colors[1]).setDepth(7);
        this.body = this.player.body as Phaser.Physics.Arcade.Body;
        this.body.setMaxVelocity(1400, GAME.maxFall);
        this.body.setCollideWorldBounds(true);

        const oneWay = (a: unknown, b: unknown): boolean => {
            const pb = (a as Phaser.GameObjects.Rectangle).body as Phaser.Physics.Arcade.Body;
            const pl = (b as Phaser.GameObjects.Rectangle).body as Phaser.Physics.Arcade.Body;
            return pb.velocity.y >= 0 && pb.bottom <= pl.top + 12;
        };
        this.physics.add.collider(this.player, this.platforms, this.onCollideGround, oneWay, this);
        this.physics.add.collider(this.player, this.movers, this.onCollideGround, oneWay, this);

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

        // Touch controls (visible, always on). Extra pointers for multi-touch.
        this.input.addPointer(2);
        this.btnLeft = this.makeControl('◀', GAME.colors[0], () => (this.leftHeld = true), () => (this.leftHeld = false));
        this.btnRight = this.makeControl('▶', GAME.colors[0], () => (this.rightHeld = true), () => (this.rightHeld = false));
        this.btnJump = this.makeControl('JUMP', GAME.colors[1], () => this.bufferJump(), () => {});
        this.btnLeftLabel = this.btnLeft.getData('label') as Phaser.GameObjects.Text;
        this.btnRightLabel = this.btnRight.getData('label') as Phaser.GameObjects.Text;
        this.btnJumpLabel = this.btnJump.getData('label') as Phaser.GameObjects.Text;

        this.cursors = this.input.keyboard!.createCursorKeys();
        this.keyA = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A);
        this.keyD = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D);
        this.input.keyboard!.on('keydown-SPACE', () => this.bufferJump());
        this.input.keyboard!.on('keydown-UP', () => this.bufferJump());
        this.input.keyboard!.on('keydown-W', () => this.bufferJump());

        this.scale.on('resize', this.handleResize, this);
        this.events.once('shutdown', () => this.scale.off('resize', this.handleResize, this));

        this.layout();
        this.resetWorld();
    }

    private makeControl(
        label: string,
        color: number,
        onDown: () => void,
        onUp: () => void
    ): Phaser.GameObjects.Rectangle {
        const rect = this.add.rectangle(0, 0, 72, 72, color, 0.16).setStrokeStyle(3, color, 0.6).setDepth(9);
        rect.setInteractive({ useHandCursor: true });
        const text = this.add
            .text(0, 0, label, {
                fontFamily: 'Arial Black, Arial, sans-serif',
                fontSize: label.length > 1 ? '18px' : '26px',
                color: '#ffffff'
            })
            .setOrigin(0.5)
            .setDepth(10);
        rect.setData('label', text);
        rect.on('pointerdown', () => {
            sfx.resume();
            onDown();
        });
        rect.on('pointerup', onUp);
        rect.on('pointerout', onUp);
        rect.on('pointerupoutside', onUp);
        return rect;
    }

    //  World / generation ---------------------------------------------------

    private resetWorld(): void {
        this.platforms.clear(true, true);
        this.movers.clear(true, true);
        for (const enemy of this.enemies) {
            enemy.destroy();
        }
        this.enemies = [];

        const startX = (this.innerLeft + this.innerRight) / 2;
        this.spawnPlatform(startX, START_Y, Math.min(200, this.towerWidth * 0.6), 'normal');
        this.player.setPosition(startX, START_Y - PLAYER_H / 2 - 10);
        this.body.setVelocity(0, 0);

        this.spawnY = START_Y - GAME.rowStep;
        for (let i = 0; i < 8; i++) {
            this.spawnRow(this.spawnY);
            this.spawnY -= GAME.rowStep;
        }

        this.cameras.main.scrollY = this.player.y - this.height * 0.62;
        // The plasma is the rising floor: visible just under the start view.
        this.dangerY = this.cameras.main.scrollY + this.height - 96;
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
        rect.setData('minX', this.innerLeft + w / 2 + 8);
        rect.setData('maxX', this.innerRight - w / 2 - 8);
    }

    private spawnRow(y: number): void {
        const count = Math.random() < 0.5 ? 1 : 2;
        const lo = this.innerLeft + GAME.platformWidthMax / 2 + 6;
        const hi = this.innerRight - GAME.platformWidthMax / 2 - 6;
        const used: number[] = [];

        for (let i = 0; i < count; i++) {
            const w = Phaser.Math.Between(GAME.platformWidthMin, GAME.platformWidthMax);
            let x = Phaser.Math.Between(Math.round(lo), Math.round(hi));
            if (used.length > 0 && Math.abs(x - used[0]) < GAME.platformMinGap) {
                x = Phaser.Math.Clamp(used[0] + (x > used[0] ? 1 : -1) * (w / 2 + GAME.platformMinGap + 8), lo, hi);
            }
            used.push(x);

            const roll = Math.random();
            const kind: PlatformKind = roll < 0.16 ? 'bounce' : roll < 0.32 ? 'crumble' : 'normal';
            this.spawnPlatform(x, y, w, kind);
        }

        if (Math.random() < 0.12) {
            this.spawnMover(Phaser.Math.Between(Math.round(lo), Math.round(hi)), y - GAME.rowStep / 2, GAME.moverWidth);
        }
        if (Math.random() < GAME.enemyChance) {
            this.spawnEnemy(Phaser.Math.Between(Math.round(lo), Math.round(hi)), y - GAME.rowStep / 2);
        }
    }

    private cullWorld(): void {
        const below = this.cameras.main.scrollY + this.height + 120;
        const cull = (group: Phaser.Physics.Arcade.Group | Phaser.Physics.Arcade.StaticGroup): void => {
            // Iterate a copy and remove through the group so its body list stays
            // consistent (destroying directly can corrupt the collider).
            for (const child of group.getChildren().slice()) {
                if ((child as Phaser.GameObjects.Rectangle).y > below) {
                    group.remove(child, true, true);
                }
            }
        };
        cull(this.platforms);
        cull(this.movers);
    }

    private ensureGenerated(): void {
        const above = this.cameras.main.scrollY - 260;
        while (this.spawnY > above) {
            this.spawnRow(this.spawnY);
            this.spawnY -= GAME.rowStep;
        }
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
        this.updateSqueeze();
        this.updateMovers();
        this.updateEnemies(dt);
        this.updateMovement(dt);
        this.updateJump();
        this.updateWallSlide();
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

    /** Periodic event where the tower walls close in, then reopen. */
    private updateSqueeze(): void {
        const t = this.elapsed % GAME.squeezeCycle;
        let target = 0;
        if (t >= GAME.squeezeStart && t <= GAME.squeezeStart + GAME.squeezeDuration) {
            target = Math.sin(((t - GAME.squeezeStart) / GAME.squeezeDuration) * Math.PI);
        }

        if (target > 0.05 && !this.squeezeWarned) {
            this.squeezeWarned = true;
            this.showPop('SQUEEZE!', GAME.danger);
            sfx.whoosh();
        } else if (target <= 0.05) {
            this.squeezeWarned = false;
        }

        this.squeeze = Phaser.Math.Linear(this.squeeze, target, 0.1);
        this.curInnerLeft = this.innerLeft + this.squeeze * GAME.squeezeInset;
        this.curInnerRight = this.innerRight - this.squeeze * GAME.squeezeInset;

        this.physics.world.setBounds(this.curInnerLeft, -100000, this.curInnerRight - this.curInnerLeft, 200000);
        this.physics.world.setBoundsCollision(true, true, false, false);
    }

    private updateEnemies(dt: number): void {
        if (this.enemies.length === 0) {
            return;
        }
        const half = GAME.enemyWidth / 2;
        const px = this.player.x;
        const py = this.player.y;
        const below = this.cameras.main.scrollY + this.height + 120;

        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const rect = this.enemies[i];
            let vx = rect.getData('vx') as number;
            rect.x += vx * dt;

            if (rect.x <= this.curInnerLeft + half && vx < 0) {
                vx = Math.abs(vx);
                rect.setData('vx', vx);
            } else if (rect.x >= this.curInnerRight - half && vx > 0) {
                vx = -Math.abs(vx);
                rect.setData('vx', vx);
            }

            if (
                Math.abs(rect.x - px) < half + PLAYER_W / 2 - 2 &&
                Math.abs(rect.y - py) < half + PLAYER_H / 2 - 2
            ) {
                this.die();
                return;
            }

            if (rect.y > below) {
                rect.destroy();
                this.enemies.splice(i, 1);
            }
        }
    }

    private spawnEnemy(x: number, y: number): void {
        const rect = this.add.rectangle(x, y, GAME.enemyWidth, GAME.enemyWidth, GAME.danger).setDepth(4);
        rect.setStrokeStyle(3, 0xffffff, 0.85);
        rect.setData('vx', Phaser.Math.RND.pick([-1, 1]) * GAME.enemySpeed);
        this.tweens.add({ targets: rect, angle: 405, duration: 2200, repeat: -1 });
        this.enemies.push(rect);
    }

    private inputDir(): number {
        const left = this.leftHeld || !!this.cursors.left?.isDown || this.keyA.isDown;
        const right = this.rightHeld || !!this.cursors.right?.isDown || this.keyD.isDown;
        return (right ? 1 : 0) - (left ? 1 : 0);
    }

    private updateMovement(dt: number): void {
        const dir = this.inputDir();
        const target = dir * GAME.maxSpeed;
        const rate = dir !== 0 ? GAME.accel : GAME.decel;
        const step = rate * dt;
        const diff = target - this.body.velocity.x;
        this.body.velocity.x += Phaser.Math.Clamp(diff, -step, step);
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

        const wallLeft = this.body.blocked.left;
        const wallRight = this.body.blocked.right;
        const onWall = wallLeft || wallRight;

        // One wall-jump per wall contact: locked until you leave the wall.
        if (grounded || !onWall) {
            this.canWallJump = true;
        }

        // Bounce off a wall you ran/flew into (but not if you're clinging to it).
        if (!grounded && ((wallLeft && !this.prevWallLeft) || (wallRight && !this.prevWallRight))) {
            const dir = this.inputDir();
            if (wallLeft && dir >= 0 && this.body.velocity.x < -160) {
                this.body.velocity.x = -this.body.velocity.x * 0.55;
            } else if (wallRight && dir <= 0 && this.body.velocity.x > 160) {
                this.body.velocity.x = -this.body.velocity.x * 0.55;
            }
        }
        this.prevWallLeft = wallLeft;
        this.prevWallRight = wallRight;

        const wantsJump = this.time.now - this.jumpBufferedAt <= GAME.jumpBufferMs;
        const canGroundJump = this.time.now - this.lastGroundedAt <= GAME.coyoteMs;

        if (canGroundJump && wantsJump) {
            // Momentum jump: the faster you run, the higher you go.
            const speedFrac = Math.min(1, Math.abs(this.body.velocity.x) / GAME.maxSpeed);
            const jumpVel = GAME.jumpBase + speedFrac * GAME.jumpSpeedBonus;
            this.body.setVelocityY(-jumpVel);
            this.jumpBufferedAt = -9999;
            this.lastGroundedAt = -9999;
            this.puff(this.player.x, this.player.y + PLAYER_H / 2, GAME.colors[0]);
            sfx.click();
        } else if (onWall && !grounded && wantsJump && this.canWallJump) {
            const away = wallLeft ? 1 : -1;
            this.body.setVelocityY(-GAME.wallJumpVel);
            this.body.setVelocityX(away * GAME.wallJumpPush);
            this.facing = away;
            this.canWallJump = false;
            this.jumpBufferedAt = -9999;
            this.puff(this.player.x, this.player.y, GAME.platformEdge);
            sfx.bubble();
        }
    }

    private updateWallSlide(): void {
        if (this.body.blocked.down) {
            return;
        }
        const pushingLeft = this.body.blocked.left && this.inputDir() < 0;
        const pushingRight = this.body.blocked.right && this.inputDir() > 0;
        if ((pushingLeft || pushingRight) && this.body.velocity.y > GAME.wallSlideSpeed) {
            this.body.setVelocityY(GAME.wallSlideSpeed);
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

        // Falling below the tower is immediate death (there is nothing below
        // the start), so a fall ends the run right away.
        if (this.player.y - PLAYER_H / 2 > START_Y + 150) {
            this.die();
            return;
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

        const left = this.curInnerLeft;
        const right = this.curInnerRight;

        this.bg.clear();
        this.bg.fillStyle(GAME.outside, 1);
        this.bg.fillRect(0, 0, this.width, this.height);
        this.bg.fillStyle(GAME.background, 1);
        this.bg.fillRect(left, 0, right - left, this.height);

        // World-anchored horizontal grid lines (these scroll with the tower).
        this.bg.lineStyle(1, GAME.colors[0], 0.22);
        const first = Math.floor(scrollY / 80) - 1;
        const last = Math.ceil((scrollY + this.height) / 80) + 1;
        for (let k = first; k <= last; k++) {
            const y = k * 80 - scrollY;
            this.bg.lineBetween(left, y, right, y);
        }

        // High-contrast segmented side walls with a bright neon inner edge.
        const wt = GAME.wallThickness;
        this.bg.fillStyle(GAME.wallDark, 1);
        this.bg.fillRect(left - wt, 0, wt, this.height);
        this.bg.fillRect(right, 0, wt, this.height);
        const segStart = Math.floor(scrollY / 40) - 1;
        const segEnd = Math.ceil((scrollY + this.height) / 40) + 1;
        for (let k = segStart; k <= segEnd; k++) {
            const y = k * 40 - scrollY;
            this.bg.fillStyle(GAME.wall, 1);
            this.bg.fillRect(left - wt, y, wt, 26);
            this.bg.fillRect(right, y, wt, 26);
        }
        this.bg.fillStyle(GAME.colors[0], 0.16);
        this.bg.fillRect(left - wt - 6, 0, 6, this.height);
        this.bg.fillRect(right + wt, 0, 6, this.height);
        this.bg.fillStyle(GAME.colors[0], 0.95);
        this.bg.fillRect(left - 5, 0, 5, this.height);
        this.bg.fillRect(right, 0, 5, this.height);

        // Plasma inside the tower.
        const dangerScreenY = this.dangerY - scrollY;
        this.dangerGfx.clear();
        const bands = 10;
        const bandH = Math.max(6, (this.height - dangerScreenY) / bands);
        for (let i = 0; i < bands; i++) {
            this.dangerGfx.fillStyle(GAME.danger, Math.max(0.12, 0.9 - i * 0.07));
            this.dangerGfx.fillRect(left, dangerScreenY + i * bandH, right - left, bandH + 1);
        }
        this.dangerGfx.fillStyle(GAME.plasmaEdge, 0.95);
        this.dangerGfx.fillRect(left, dangerScreenY - 3, right - left, 4);

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

        // Always leave a little side margin so the walls are never clipped.
        this.towerWidth = Phaser.Math.Clamp(this.width - GAME.towerSideMargin, 240, GAME.towerMaxWidth);
        this.towerLeft = (this.width - this.towerWidth) / 2;
        this.towerRight = this.towerLeft + this.towerWidth;
        this.innerLeft = this.towerLeft + GAME.wallThickness;
        this.innerRight = this.towerRight - GAME.wallThickness;
        this.curInnerLeft = this.innerLeft;
        this.curInnerRight = this.innerRight;

        // Invisible world bounds = the inner faces of the side walls.
        this.physics.world.setBounds(this.innerLeft, -100000, this.innerRight - this.innerLeft, 200000);
        this.physics.world.setBoundsCollision(true, true, false, false);

        this.heightText.setPosition(20, 16);
        this.bestText.setPosition(this.width - 20, 20);
        this.comboText.setPosition(this.width / 2, 16);

        const by = this.height - 78;
        this.btnLeft.setPosition(58, by);
        this.btnLeftLabel.setPosition(58, by);
        this.btnRight.setPosition(146, by);
        this.btnRightLabel.setPosition(146, by);
        this.btnJump.setPosition(this.width - 68, by);
        this.btnJumpLabel.setPosition(this.width - 68, by);

        if (this.player) {
            this.player.x = Phaser.Math.Clamp(this.player.x, this.towerLeft + PLAYER_W / 2, this.towerRight - PLAYER_W / 2);
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
