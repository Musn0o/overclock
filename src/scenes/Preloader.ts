import Phaser from 'phaser';
import { YouTubePlayables } from '../playables/YouTubePlayables';
import { GAME } from '../config';

export class Preloader extends Phaser.Scene {
    constructor() {
        super('Preloader');
    }

    create(): void {
        const { width, height } = this.scale;
        const cx = width / 2;
        const cy = height / 2;

        this.cameras.main.setBackgroundColor(GAME.background);

        this.add
            .text(cx, cy - 60, GAME.title, {
                fontFamily: 'Arial Black, Arial, sans-serif',
                fontSize: '54px',
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 6
            })
            .setOrigin(0.5);

        const ring = this.add.circle(cx, cy + 70, 34);
        ring.setStrokeStyle(6, GAME.colors[0], 0.9);

        const spinner = this.add.container(cx, cy + 70);
        spinner.add(this.add.rectangle(34, 0, 14, 14, GAME.colors[1]));
        this.tweens.add({ targets: spinner, angle: 360, duration: 900, repeat: -1 });

        this.add
            .text(cx, cy + 150, 'Loading...', {
                fontFamily: 'Arial, sans-serif',
                fontSize: '24px',
                color: '#7a86c7'
            })
            .setOrigin(0.5);

        // Loader/splash is visible: tell YouTube we are rendering.
        YouTubePlayables.firstFrameReady();

        this.time.delayedCall(400, () => this.scene.start('MainMenu'));
    }
}
