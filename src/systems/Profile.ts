import { YouTubePlayables } from '../playables/YouTubePlayables';

const STORAGE_KEY = 'overclock.profile.v1';

export interface ProfileData {
    coins: number;
    xp: number;
    bestHeight: number;
    bestScore: number;
    totalGames: number;
    totalHeight: number;
}

export interface RunStats {
    height: number;
    score: number;
}

export interface RunReward {
    coins: number;
    xp: number;
    leveledUp: boolean;
    level: number;
}

const DEFAULT_PROFILE = (): ProfileData => ({
    coins: 0,
    xp: 0,
    bestHeight: 0,
    bestScore: 0,
    totalGames: 0,
    totalHeight: 0
});

const num = (value: unknown, fallback: number): number =>
    typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const XP_PER_LEVEL = 600;

/**
 * Persistent player profile. Inside Playables it uses ONLY the SDK cloud save;
 * outside Playables it falls back to localStorage (local dev / web demo).
 */
class ProfileStore {
    private data: ProfileData = DEFAULT_PROFILE();
    private listeners = new Set<() => void>();

    get profile(): Readonly<ProfileData> {
        return this.data;
    }

    onChange(listener: () => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private emit(): void {
        this.listeners.forEach((listener) => listener());
    }

    async load(): Promise<void> {
        let raw: unknown = null;
        if (YouTubePlayables.isLoaded()) {
            try {
                raw = await YouTubePlayables.withTimeout(YouTubePlayables.loadData<unknown>(), 1500);
            } catch {
                raw = null;
            }
        } else {
            try {
                const stored = window.localStorage.getItem(STORAGE_KEY);
                raw = stored ? JSON.parse(stored) : null;
            } catch {
                raw = null;
            }
        }
        this.data = this.migrate(raw);
        this.emit();
    }

    private migrate(raw: unknown): ProfileData {
        const base = DEFAULT_PROFILE();
        if (!raw || typeof raw !== 'object') {
            return base;
        }
        const src = raw as Record<string, unknown>;
        return {
            coins: Math.max(0, num(src.coins, 0)),
            xp: Math.max(0, num(src.xp, 0)),
            bestHeight: Math.max(0, num(src.bestHeight, 0)),
            bestScore: Math.max(0, num(src.bestScore, 0)),
            totalGames: Math.max(0, num(src.totalGames, 0)),
            totalHeight: Math.max(0, num(src.totalHeight, 0))
        };
    }

    save(): void {
        if (YouTubePlayables.isLoaded()) {
            void YouTubePlayables.saveData(this.data);
            return;
        }
        try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
        } catch {
            // ignore storage failures
        }
    }

    get level(): number {
        return 1 + Math.floor(this.data.xp / XP_PER_LEVEL);
    }

    get levelProgress(): number {
        return (this.data.xp % XP_PER_LEVEL) / XP_PER_LEVEL;
    }

    addRun(stats: RunStats): RunReward {
        const levelBefore = this.level;
        const height = Math.max(0, Math.round(stats.height));
        const score = Math.max(0, Math.round(stats.score));
        const coins = Math.round(score * 0.5 + height * 0.25);
        const xp = Math.round(height + score * 0.5);

        this.data.coins += coins;
        this.data.xp += xp;
        this.data.totalGames += 1;
        this.data.totalHeight += height;
        this.data.bestHeight = Math.max(this.data.bestHeight, height);
        this.data.bestScore = Math.max(this.data.bestScore, score);

        const levelAfter = this.level;
        this.save();
        this.emit();
        return { coins, xp, leveledUp: levelAfter > levelBefore, level: levelAfter };
    }

    addCoins(amount: number): void {
        this.data.coins = Math.max(0, this.data.coins + Math.round(amount));
        this.save();
        this.emit();
    }
}

export const Profile = new ProfileStore();
