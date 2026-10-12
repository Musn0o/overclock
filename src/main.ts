import Phaser from 'phaser';
import { YouTubePlayables } from './playables/YouTubePlayables';
import { GAME } from './config';
import { Boot } from './scenes/Boot';
import { Preloader } from './scenes/Preloader';
import { MainMenu } from './scenes/MainMenu';
import { Game } from './scenes/Game';
import { GameOver } from './scenes/GameOver';

// The SDK script tag is blocking (it must load before game code), but keep a
// bounded wait as a safety net for odd embeds.
const SDK_WAIT_MS = 2500;

const waitForSdk = (): Promise<void> =>
    new Promise((resolve) => {
        if (window.ytgame) {
            resolve();
            return;
        }
        const start = performance.now();
        const poll = (): void => {
            if (window.ytgame || performance.now() - start >= SDK_WAIT_MS) {
                resolve();
                return;
            }
            window.setTimeout(poll, 30);
        };
        poll();
    });

void waitForSdk().then(() => {
    YouTubePlayables.boot(() => {
        const game = new Phaser.Game({
            // Canvas renderer: WebGL framebuffers fail inside some sandboxed
            // iframes (e.g. the Playables Test Suite on Firefox). Canvas is a
            // supported Playables rendering API.
            type: Phaser.CANVAS,
            parent: 'gameParent',
            backgroundColor: GAME.background,
            physics: {
                default: 'arcade',
                arcade: {
                    gravity: { x: 0, y: GAME.gravity },
                    debug: false
                }
            },
            scale: {
                mode: Phaser.Scale.RESIZE,
                autoCenter: Phaser.Scale.CENTER_BOTH,
                width: Math.max(320, window.innerWidth || 320),
                height: Math.max(320, window.innerHeight || 320)
            },
            render: {
                antialias: true,
                roundPixels: false
            },
            scene: [Boot, Preloader, MainMenu, Game, GameOver]
        });

        // Some embeds keep the game hidden at 0x0 until it reports ready, and
        // don't fire a usable resize event when they reveal it. Never block
        // boot on size; adopt the real size as soon as it appears.
        const parent = document.getElementById('gameParent');
        const syncSize = (): void => {
            if (!parent) {
                return;
            }
            const w = parent.clientWidth;
            const h = parent.clientHeight;
            if (w > 0 && h > 0 && (game.scale.width !== w || game.scale.height !== h)) {
                game.scale.resize(w, h);
            }
        };

        if (parent) {
            if (typeof ResizeObserver !== 'undefined') {
                new ResizeObserver(syncSize).observe(parent);
            }
            window.setInterval(syncSize, 300);
        }
    });
});
