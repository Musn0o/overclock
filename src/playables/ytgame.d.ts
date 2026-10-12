export interface YTGameAds {
    requestInterstitialAd(): Promise<void>;
    requestRewardedAd(rewardId: string): Promise<boolean>;
}

export interface YTGameEngagement {
    sendScore(score: { value: number }): Promise<void>;
    openYTContent(options: { id: string; type?: number }): Promise<void>;
}

export interface YTGameGame {
    firstFrameReady(): void;
    gameReady(): void;
    loadData(): Promise<string>;
    saveData(data: string): Promise<void>;
}

export interface YTGameHealth {
    logError(): void;
    logWarning(): void;
}

export interface YTGameSystem {
    getLanguage(): Promise<string>;
    isAudioEnabled(): boolean;
    onAudioEnabledChange(callback: (enabled: boolean) => void): () => void;
    onPause(callback: () => void): () => void;
    onResume(callback: () => void): () => void;
}

export interface YTGameSDK {
    SDK_VERSION: string;
    IN_PLAYABLES_ENV: boolean;
    ads: YTGameAds;
    engagement: YTGameEngagement;
    game: YTGameGame;
    health: YTGameHealth;
    system: YTGameSystem;
}

declare global {
    interface Window {
        ytgame?: YTGameSDK;
    }
}
