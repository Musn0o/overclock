import Phaser from 'phaser';
import { YouTubePlayables } from '../playables/YouTubePlayables';
import { GAME } from '../config';
import { Profile } from '../systems/Profile';
import { sfx } from '../systems/Sfx';
import { UIButton } from '../ui/Button';
import { makeCoin } from '../ui/icons';

interface GameOverData {
    height?: number;
    score?: number;
}

export class GameOver extends Phaser.Scene {
    private height = 0;
    private score = 0;
    private coins = 0;
    private isBest = false;
    private busy = false;

    private titleText!: Phaser.GameObjects.Text;
    private heightText!: Phaser.GameObjects.Text;
    private bestText!: Phaser.GameObjects.Text;
    private coinIcon!: Phaser.GameObjects.Container;
    private coinText!: Phaser.GameObjects.Text;
    private xpText!: Phaser.GameObjects.Text;
    private levelText!: Phaser.GameObjects.Text;

    private againButton!: UIButton;
    private reviveButton!: UIButton;
    private menuButton!: UIButton;

    constructor() {
        super('GameOver');
    }

    init(data: GameOverData = {}): void {
        this.height = data.height ?? 0;
        this.score = data.score ?? 0;
        this.busy = false;
    }

    create(): void {
        this.cameras.main.setBackgroundColor(GAME.background);

        const bestBefore = Profile.profile.bestHeight;
        const reward = Profile.addRun({ height: this.height, score: this.score });
        this.coins = reward.coins;
        this.isBest = this.height > bestBefore;

        YouTubePlayables.sendScore(this.score);
        Profile.save();

        if (Profile.profile.totalGames % GAME.interstitialEvery === 0) {
            void YouTubePlayables.requestInterstitialAd();
        }

        this.titleText = this.add
            .text(0, 0, 'PLASMA CAUGHT YOU', {
                fontFamily: 'Arial Black, Arial, sans-serif',
                fontSize: '34px',
                color: '#ff3d81',
                stroke: '#000000',
                strokeThickness: 6
            })
            .setOrigin(0.5);

        this.heightText = this.add
            .text(0, 0, `${this.height} m`, {
                fontFamily: 'Arial Black, Arial, sans-serif',
                fontSize: '76px',
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 7
            })
            .setOrigin(0.5);

        this.bestText = this.add
            .text(0, 0, this.isBest ? `NEW BEST · ${this.height} m` : `BEST ${Profile.profile.bestHeight} m`, {
                fontFamily: 'Arial Black, Arial, sans-serif',
                fontSize: '22px',
                color: this.isBest ? '#ffd23d' : '#7a86c7'
            })
            .setOrigin(0.5);

        this.coinIcon = makeCoin(this, 0, 0, 13);
        this.coinText = this.add
            .text(0, 0, `+${this.coins}`, {
                fontFamily: 'Arial Black, Arial, sans-serif',
                fontSize: '24px',
                color: '#ffe3a3',
                stroke: '#000000',
                strokeThickness: 4
            })
            .setOrigin(0, 0.5);

        this.xpText = this.add
            .text(0, 0, `+${reward.xp} XP`, {
                fontFamily: 'Arial Black, Arial, sans-serif',
                fontSize: '17px',
                color: '#7a86c7'
            })
            .setOrigin(0, 0.5);

        this.levelText = this.add
            .text(0, 0, reward.leveledUp ? `LEVEL ${reward.level}!` : '', {
                fontFamily: 'Arial Black, Arial, sans-serif',
                fontSize: '22px',
                color: '#37f0ff'
            })
            .setOrigin(0.5);

        this.againButton = new UIButton(this, 0, 0, 'CLIMB AGAIN', GAME.colors[0], () => this.playAgain(), {
            width: 300,
            height: 66,
            fontSize: 26
        });

        this.reviveButton = new UIButton(this, 0, 0, 'WATCH AD · CONTINUE', GAME.colors[1], () => void this.revive(), {
            width: 300,
            height: 58,
            fontSize: 22
        });

        this.menuButton = new UIButton(this, 0, 0, 'MENU', GAME.backgroundAccent, () => this.menu(), {
            width: 300,
            height: 54,
            fontSize: 22
        });

        this.input.keyboard?.once('keydown-SPACE', () => this.playAgain());

        this.layout();
        this.scale.on('resize', this.layout, this);
        this.events.once('shutdown', () => this.scale.off('resize', this.layout, this));
    }

    private layout(): void {
        const w = this.scale.width;
        const h = this.scale.height;
        const cx = w / 2;

        this.titleText.setPosition(cx, h * 0.16);
        this.heightText.setPosition(cx, h * 0.28);
        this.bestText.setPosition(cx, h * 0.38);

        this.coinIcon.setPosition(cx - 46, h * 0.46);
        this.coinText.setPosition(cx - 26, h * 0.46);
        this.xpText.setPosition(cx - 26, h * 0.46 + 26);
        this.levelText.setPosition(cx, h * 0.54);

        this.againButton.setPosition(cx, h - 236);
        this.reviveButton.setPosition(cx, h - 166);
        this.menuButton.setPosition(cx, h - 98);
    }

    private playAgain(): void {
        if (this.busy) {
            return;
        }
        this.busy = true;
        sfx.resume();
        sfx.click();
        this.scene.start('Game', { revive: false });
    }

    private menu(): void {
        sfx.resume();
        sfx.click();
        this.scene.start('MainMenu');
    }

    private async revive(): Promise<void> {
        if (this.busy) {
            return;
        }
        this.busy = true;
        sfx.resume();
        sfx.click();

        const granted = YouTubePlayables.isLoaded()
            ? await YouTubePlayables.requestRewardedAd(GAME.reviveRewardId)
            : true;

        if (granted) {
            this.scene.start('Game', { revive: true, score: this.score, height: this.height });
        } else {
            this.busy = false;
        }
    }
}
