import Phaser from 'phaser';
import { GAME } from '../config';
import { Profile } from '../systems/Profile';
import { sfx } from '../systems/Sfx';

const PLAYER_W = 30;
const PLAYER_H = 38;

interface GameInitData {
    revive?: boolean;
    score?: number;
    height?: number;
}

/**
 * OVERCLOCK core loop (MVP scaffold).
 *
 * Climb an endless neon tower: move left/right and jump platform to platform
 * while plasma rises from below. Chain landings for combo points. Walls wrap
 * around. Fall into the plasma and the run ends (continue via rewarded ad).
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

    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    private keyA!: Phaser.Input.Keyboard.Key;
    private keyD!: Phaser.Input.Keyboard.Key;

    private heightText!: Phaser.GameObjects.Text;
    private comboText!: Phaser.GameObjects.Text;
    private bestText!: Phaser.GameObjects.Text;
    private jumpLabel!: Phaser.GameObjects.Text;
    private jumpPad!: Phaser.GameObjects.Rectangle;

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
    private jumpBufferedAt = -9999;

    private spawnY = 0;
    private dangerY = 0;
    private dangerSpeed: number = GAME.dangerRiseStart;
    private elapsed = 0;
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
        this.lastGroundedAt = -9999;
        this.jumpBufferedAt = -9999;

        this.bg = this.add.graphics().setDepth(0);
        this.dangerGfx = this.add.graphics().setDepth(5);

        this.platforms = this.physics.add.staticGroup();

        this.player = this.add.rectangle(0, 0, PLAYER_W, PLAYER_H, GAME.colors[0]).setDepth(6);
        this.physics.add.existing(this.player);
        this.visor = this.add.rectangle(0, 0, PLAYER_W * 0.6, 8, GAME.colors[1]).setDepth(7);
        this.body = this.player.body as Phaser.Physics.Arcade.Body;
        this.body.setMaxVelocity(GAME.moveSpeed, GAME.maxFall);

        this.physics.add.collider(this.player, this.platforms);

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
                fontSize: '26px',
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

        this.jumpPad = this.add.rectangle(0, 0, 108, 108, GAME.colors[1], 0.16).setStrokeStyle(3, GAME.colors[1], 0.5).setDepth(9);
        this.jumpLabel = this.add
            .text(0, 0, 'JUMP', {
                fontFamily: 'Arial Black, Arial, sans-serif',
                fontSize: '20px',
                color: '#ffffff'
            })
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
        this.spawnY = 0;

        // Starting platform + player.
        const startX = this.width / 2;
        this.spawnPlatform(startX, 40, Math.min(220, this.width * 0.5));
        this.player.setPosition(startX, 40 - PLAYER_H / 2 - 9);
        this.body.setVelocity(0, 0);

        this.spawnY = 40 - GAME.rowStep;
        for (let i = 0; i < 6; i++) {
            this.spawnRow(this.spawnY);
            this.spawnY -= GAME.rowStep;
        }

        this.dangerY = 40 + GAME.dangerStartOffset;
        this.cameras.main.scrollY = this.player.y - this.height * 0.62;
    }

    private spawnPlatform(x: number, y: number, w: number): void {
        const rect = this.add.rectangle(x, y, w, 18, GAME.platform).setStrokeStyle(2, GAME.platformEdge, 0.85).setDepth(3);
        this.platforms.add(rect);
    }

    private spawnRow(y: number): void {
        const count = Math.random() < 0.55 ? 1 : 2;
        const used: number[] = [];
        for (let i = 0; i < count; i++) {
            const w = Phaser.Math.Between(GAME.platformWidthMin, GAME.platformWidthMax);
            let x = Phaser.Math.Between(Math.round(w / 2), Math.round(this.width - w / 2));
            if (used.length > 0 && Math.abs(x - used[0]) < GAME.platformMinGap) {
                x = Phaser.Math.Clamp(used[0] + (x > used[0] ? 1 : -1) * (w / 2 + GAME.platformMinGap + 10), w / 2, this.width - w / 2);
            }
            used.push(x);
            this.spawnPlatform(x, y, w);
        }
    }

    private cullWorld(): void {
        const below = this.cameras.main.scrollY + this.height + 120;
        for (const child of this.platforms.getChildren()) {
            if ((child as Phaser.GameObjects.Rectangle).y > below) {
                child.destroy();
            }
        }
    }

    private ensureGenerated(): void {
        const above = this.cameras.main.scrollY - 240;
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

    //  Update ---------------------------------------------------------------

    update(_time: number, deltaMs: number): void {
        if (!this.roundActive) {
            return;
        }
        const dt = Math.min(deltaMs, 50) / 1000;
        this.elapsed += dt;

        this.highestY = Math.min(this.highestY, this.player.y);
        this.updateMovement();
        this.updateJump();
        this.updateWrap();
        this.updateDanger(dt);
        this.ensureGenerated();
        this.cullWorld();
        this.updateCamera();
        this.render();
        this.updateHud();
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
            this.onLand();
        }
        this.wasGrounded = grounded;

        const canJump = this.time.now - this.lastGroundedAt <= GAME.coyoteMs;
        const wantsJump = this.time.now - this.jumpBufferedAt <= GAME.jumpBufferMs;
        if (canJump && wantsJump) {
            this.body.setVelocityY(-GAME.jumpVel);
            this.jumpBufferedAt = -9999;
            this.lastGroundedAt = -9999;
            sfx.click();
        }
    }

    private onLand(): void {
        const y = this.player.y;
        if (this.lastLandingY !== null && y < this.lastLandingY - 6) {
            this.combo += 1;
        } else {
            this.combo = 1;
        }
        this.lastLandingY = y;
        this.maxCombo = Math.max(this.maxCombo, this.combo);
        this.score += this.combo;
        if (this.combo >= 3) {
            sfx.bubble();
        }
    }

    private updateWrap(): void {
        if (this.player.x < -PLAYER_W / 2) {
            this.player.x = this.width + PLAYER_W / 2 - 1;
        } else if (this.player.x > this.width + PLAYER_W / 2) {
            this.player.x = -PLAYER_W / 2 + 1;
        }
    }

    private updateDanger(dt: number): void {
        const t = Phaser.Math.Clamp(this.elapsed / 90, 0, 1);
        this.dangerSpeed = Phaser.Math.Linear(GAME.dangerRiseStart, GAME.dangerRiseMax, t);
        this.dangerY -= this.dangerSpeed * dt;

        if (this.player.y + PLAYER_H / 2 >= this.dangerY) {
            this.die();
        }
    }

    private updateCamera(): void {
        const target = this.player.y - this.height * 0.62;
        this.cameras.main.scrollY = Phaser.Math.Linear(this.cameras.main.scrollY, target, 0.14);
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
            const alpha = 0.9 - i * 0.07;
            this.dangerGfx.fillStyle(GAME.danger, Math.max(0.12, alpha));
            this.dangerGfx.fillRect(0, dangerScreenY + i * bandH, this.width, bandH + 1);
        }
        this.dangerGfx.fillStyle(0xffffff, 0.8);
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

        this.jumpPad.setPosition(this.width - 84, this.height - 84);
        this.jumpLabel.setPosition(this.width - 84, this.height - 84);

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
