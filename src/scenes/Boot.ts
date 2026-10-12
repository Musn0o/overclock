import Phaser from 'phaser';
import { YouTubePlayables } from '../playables/YouTubePlayables';
import { Profile } from '../systems/Profile';
import { sfx } from '../systems/Sfx';

export class Boot extends Phaser.Scene {
    constructor() {
        super('Boot');
    }

    async create(): Promise<void> {
        try {
            await Profile.load();
        } catch (error) {
            console.warn('[Boot] Profile load failed.', error);
        }

        const audioEnabled = YouTubePlayables.isAudioEnabled();
        sfx.setEnabled(audioEnabled);

        YouTubePlayables.setOnPause(() => {
            Profile.save();
            this.game.pause();
        });
        YouTubePlayables.setOnResume(() => {
            this.game.resume();
        });
        YouTubePlayables.setAudioChangeCallback((enabled: boolean) => {
            sfx.setEnabled(enabled);
        });

        // Dev-only deep links (ignored by YouTube, no hash there).
        const routes: Record<string, string> = { '#play': 'Game', '#menu': 'MainMenu' };
        const target = routes[window.location.hash];
        if (target) {
            this.scene.start(target);
            return;
        }

        this.scene.start('Preloader');
    }
}
