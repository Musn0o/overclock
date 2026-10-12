import type { YTGameSDK } from './ytgame';

export const SDKErrorType = {
    UNKNOWN: 'UNKNOWN',
    API_UNAVAILABLE: 'API_UNAVAILABLE',
    INVALID_PARAMS: 'INVALID_PARAMS',
    SIZE_LIMIT_EXCEEDED: 'SIZE_LIMIT_EXCEEDED'
} as const;

export type SDKErrorTypeValue = (typeof SDKErrorType)[keyof typeof SDKErrorType];

const LONE_HIGH_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g;

/**
 * Typed wrapper around the YouTube Playables SDK (`window.ytgame`).
 *
 * Runs as a safe no-op when the game is served locally: readiness calls are
 * skipped, loadData resolves to null and ads resolve to false, so the game can
 * be developed and tested in a normal browser without special flags.
 */
class YouTubePlayablesWrapper {
    version = 'unloaded';
    inPlayablesEnv = false;

    private ref: YTGameSDK | null = null;
    private firstFrame = false;
    private gameIsReady = false;
    private unsetAudio: (() => void) | undefined;
    private language = 'unavailable';
    private data: unknown = null;

    /**
     * Waits for the document and the Playables SDK to be ready, then invokes
     * the callback. The game instance MUST be created inside this callback.
     */
    boot(loaded: () => void): void {
        let called = false;
        const callback = (): void => {
            if (called) {
                return;
            }
            called = true;
            const yt = window.ytgame;
            if (yt) {
                this.ref = yt;
                this.version = yt.SDK_VERSION;
                this.inPlayablesEnv = yt.IN_PLAYABLES_ENV;
            } else {
                console.warn('[Playables] SDK not found. Running in local/dev mode.');
            }
            loaded();
        };

        // Watchdog: never let a blocked/slow DOM event prevent the game booting.
        window.setTimeout(callback, 3000);

        if (document.readyState === 'complete' || document.readyState === 'interactive') {
            window.setTimeout(callback, 0);
            return;
        }

        const check = (): void => {
            document.removeEventListener('DOMContentLoaded', check, true);
            window.removeEventListener('load', check, true);
            callback();
        };

        if (!document.body) {
            window.setTimeout(check, 20);
        } else {
            document.addEventListener('DOMContentLoaded', check, true);
            window.addEventListener('load', check, true);
        }
    }

    isLoaded(): boolean {
        return this.ref !== null && this.inPlayablesEnv;
    }

    isFirstFrameReady(): boolean {
        return this.firstFrame;
    }

    isGameReady(): boolean {
        return this.gameIsReady;
    }

    isReady(): boolean {
        return this.isLoaded() && this.firstFrame && this.gameIsReady;
    }

    firstFrameReady(): void {
        if (!this.isLoaded() || this.firstFrame) {
            return;
        }
        this.ref?.game.firstFrameReady();
        this.firstFrame = true;
    }

    gameReady(): void {
        if (!this.isLoaded() || this.gameIsReady) {
            return;
        }
        if (!this.firstFrame) {
            console.error('[Playables] gameReady called before firstFrameReady.');
            return;
        }
        this.ref?.game.gameReady();
        this.gameIsReady = true;
    }

    sendScore(value: number): void {
        if (!this.isReady()) {
            return;
        }
        const score = Math.floor(value);
        if (!Number.isFinite(score) || score < 0) {
            return;
        }
        try {
            void this.ref?.engagement.sendScore({ value: score }).catch(() => undefined);
        } catch (error) {
            console.error('[Playables] sendScore failed', error);
        }
    }

    setOnPause(callback: () => void): void {
        if (this.isLoaded()) {
            this.ref?.system.onPause(callback);
        }
    }

    setOnResume(callback: () => void): void {
        if (this.isLoaded()) {
            this.ref?.system.onResume(callback);
        }
    }

    isAudioEnabled(): boolean {
        if (this.isLoaded()) {
            return this.ref?.system.isAudioEnabled() ?? true;
        }
        return true;
    }

    setAudioChangeCallback(callback: (enabled: boolean) => void): void {
        if (!this.isLoaded()) {
            return;
        }
        if (this.unsetAudio) {
            this.unsetAudio();
        }
        this.unsetAudio = this.ref?.system.onAudioEnabledChange(callback);
    }

    unsetAudioChangeCallback(): void {
        if (this.unsetAudio) {
            this.unsetAudio();
            this.unsetAudio = undefined;
        }
    }

    async loadData<T = unknown>(): Promise<T | null> {
        if (!this.isLoaded()) {
            return null;
        }
        try {
            const raw = await this.ref!.game.loadData();
            if (!raw) {
                return null;
            }
            const parsed = JSON.parse(raw) as T;
            this.data = parsed;
            return parsed;
        } catch (error) {
            console.error('[Playables] loadData failed', error);
            this.ref?.health.logError();
            return null;
        }
    }

    async saveData(data: unknown): Promise<boolean> {
        if (!this.isLoaded()) {
            return false;
        }
        try {
            const json = JSON.stringify(data) ?? 'null';
            const safe = json.replace(LONE_HIGH_SURROGATE, '');
            await this.ref!.game.saveData(safe);
            this.data = data;
            return true;
        } catch (error) {
            console.error('[Playables] saveData failed', error);
            this.ref?.health.logError();
            return false;
        }
    }

    getData(): unknown {
        return this.data;
    }

    async loadLanguage(): Promise<string> {
        if (!this.isLoaded()) {
            return this.language;
        }
        try {
            this.language = await this.ref!.system.getLanguage();
        } catch (error) {
            console.error('[Playables] getLanguage failed', error);
        }
        return this.language;
    }

    getLanguage(): string {
        return this.language;
    }

    logError(): void {
        this.ref?.health.logError();
    }

    logWarning(): void {
        this.ref?.health.logWarning();
    }

    /**
     * Requests an interstitial ad. Returns false when ads are unavailable
     * (for example, in unsupported regions or during local development).
     */
    async requestInterstitialAd(): Promise<boolean> {
        if (!this.isLoaded() || !this.ref?.ads) {
            return false;
        }
        try {
            await this.ref.ads.requestInterstitialAd();
            return true;
        } catch (error) {
            console.warn('[Playables] interstitial ad unavailable', error);
            return false;
        }
    }

    /**
     * Requests a rewarded ad. Resolves true only when the user earned the
     * reward. The rewardId MUST be stable and unique per reward type.
     */
    async requestRewardedAd(rewardId: string): Promise<boolean> {
        if (!this.isLoaded() || !this.ref?.ads) {
            return false;
        }
        try {
            return await this.ref.ads.requestRewardedAd(rewardId);
        } catch (error) {
            console.warn('[Playables] rewarded ad unavailable', error);
            return false;
        }
    }

    withTimeout<T>(promise: Promise<T>, timeout = 1500): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            const timer = window.setTimeout(() => reject(new Error('Operation timed out')), timeout);
            promise.then(
                (value) => {
                    window.clearTimeout(timer);
                    resolve(value);
                },
                (error) => {
                    window.clearTimeout(timer);
                    reject(error);
                }
            );
        });
    }
}

export const YouTubePlayables = new YouTubePlayablesWrapper();
