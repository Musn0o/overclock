import Phaser from 'phaser';
import { YouTubePlayables } from '../playables/YouTubePlayables';
import { GAME } from '../config';
import { Profile } from '../systems/Profile';
import { sfx } from '../systems/Sfx';
import { UIButton } from '../ui/Button';
import { makeCoin, makeRobotPreview } from '../ui/icons';

export class MainMenu extends Phaser.Scene {
    private deco!: Phaser.GameObjects.Graphics;
    private robot!: Phaser.GameObjects.Container;
    private titleText!: Phaser.GameObjects.Text;
    private tagline!: Phaser.GameObjects.Text;
    private levelText!: Phaser.GameObjects.Text;
    private xpGfx!: Phaser.GameObjects.Graphics;
    private coinIcon!: Phaser.GameObjects.Container;
    private coinText!: Phaser.GameObjects.Text;
    private bestText!: Phaser.GameObjects.Text;
    private playButton!: UIButton;
    private hint!: Phaser.GameObjects.Text;

    constructor() {
        super('MainMenu');
    }

    create(): void {
        this.cameras.main.setBackgroundColor(GAME.background);
        this.deco = this.add.graphics().setDepth(0);

        this.robot = makeRobotPreview(this, 0, 0, 1, GAME.colors[0], GAME.colors[1]).setDepth(2);
        this.tweens.add({ targets: this.robot, y: '-=6', duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

        this.titleText = this.add
            .text(0, 0, GAME.title, {
                fontFamily: 'Arial Black, Arial, sans-serif',
                fontSize: '60px',
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 8
            })
            .setOrigin(0.5)
            .setDepth(5);

        this.tagline = this.add
            .text(0, 0, GAME.tagline, {
                fontFamily: 'Arial, sans-serif',
                fontSize: '20px',
                color: '#7a86c7'
            })
            .setOrigin(0.5)
            .setDepth(5);

        this.levelText = this.add
            .text(0, 0, '', {
                fontFamily: 'Arial Black, Arial, sans-serif',
                fontSize: '20px',
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 5
            })
            .setOrigin(0.5)
            .setDepth(5);
        this.xpGfx = this.add.graphics().setDepth(5);

        this.coinIcon = makeCoin(this, 0, 0, 12).setDepth(5);
        this.coinText = this.add
            .text(0, 0, '', {
                fontFamily: 'Arial Black, Arial, sans-serif',
                fontSize: '22px',
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 5
            })
            .setOrigin(0, 0.5)
            .setDepth(5);

        this.bestText = this.add
            .text(0, 0, '', {
                fontFamily: 'Arial Black, Arial, sans-serif',
                fontSize: '20px',
                color: '#ffd23d'
            })
            .setOrigin(0.5)
            .setDepth(5);

        const w = this.scale.width;
        this.playButton = new UIButton(this, 0, 0, 'CLIMB', GAME.colors[1], () => this.startGame(), {
            width: Phaser.Math.Clamp(w * 0.6, 220, 340),
            height: 74,
            fontSize: 30
        });

        this.hint = this.add
            .text(0, 0, 'Run to build speed · faster run = higher jump · wall-jump', {
                fontFamily: 'Arial, sans-serif',
                fontSize: '16px',
                color: '#59618f'
            })
            .setOrigin(0.5)
            .setDepth(5);

        this.input.keyboard?.once('keydown-SPACE', () => this.startGame());
        this.input.keyboard?.once('keydown-ENTER', () => this.startGame());

        this.refresh();
        this.layout();
        this.scale.on('resize', this.layout, this);
        this.events.once('shutdown', () => this.scale.off('resize', this.layout, this));

        YouTubePlayables.gameReady();
    }

    private refresh(): void {
        const p = Profile.profile;
        this.coinText.setText(`${p.coins}`);
        this.bestText.setText(`BEST ${p.bestHeight} m`);
        this.levelText.setText(`LEVEL ${Profile.level}`);
    }

    private startGame(): void {
        sfx.resume();
        sfx.click();
        this.scene.start('Game', { revive: false });
    }

    private layout(): void {
        const w = this.scale.width;
        const h = this.scale.height;
        const cx = w / 2;
        const size = Math.min(w, h);

        this.deco.clear();
        this.deco.lineStyle(2, GAME.colors[0], 0.18);
        for (let i = 0; i < 14; i++) {
            const y = ((i * 64) % h) + 8;
            this.deco.lineBetween(0, y, w, y);
        }

        this.titleText.setPosition(cx, h * 0.14).setFontSize(Math.round(Phaser.Math.Clamp(size * 0.11, 38, 66)));
        this.tagline.setPosition(cx, h * 0.14 + Phaser.Math.Clamp(size * 0.07, 32, 50));

        const levelY = h * 0.14 + Phaser.Math.Clamp(size * 0.13, 70, 110);
        this.levelText.setPosition(cx, levelY);
        this.drawXpBar(cx, levelY + 22, Phaser.Math.Clamp(w * 0.55, 170, 300));

        const robotY = levelY + Phaser.Math.Clamp(size * 0.16, 70, 120);
        this.robot.setPosition(cx, robotY);
        this.robot.setScale(Phaser.Math.Clamp(size / 620, 0.8, 1.15));

        this.bestText.setPosition(cx, h * 0.5);
        this.coinIcon.setPosition(w - 92, 30);
        this.coinText.setPosition(w - 72, 30);

        this.playButton.setPosition(cx, h * 0.66);
        this.hint.setPosition(cx, h - 22);
        this.hint.setVisible(h > 520);
    }

    private drawXpBar(cx: number, y: number, width: number): void {
        const barH = 12;
        const x = cx - width / 2;
        this.xpGfx.clear();
        this.xpGfx.fillStyle(0x000000, 0.4);
        this.xpGfx.fillRoundedRect(x - 3, y - 3, width + 6, barH + 6, 8);
        this.xpGfx.fillStyle(GAME.colors[0], 1);
        this.xpGfx.fillRoundedRect(x, y, Math.max(3, width * Phaser.Math.Clamp(Profile.levelProgress, 0, 1)), barH, 7);
    }
}
