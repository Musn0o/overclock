import Phaser from 'phaser';

export interface UIButtonOptions {
    width?: number;
    height?: number;
    fontSize?: number;
    textColor?: string;
    stroke?: number;
    radius?: number;
}

/** A tappable rounded button that works for both mouse and touch. */
export class UIButton extends Phaser.GameObjects.Container {
    private bg: Phaser.GameObjects.Graphics;
    private label: Phaser.GameObjects.Text;
    private hit: Phaser.GameObjects.Rectangle;
    private baseColor: number;
    private strokeColor: number;
    private buttonWidth: number;
    private buttonHeight: number;
    private radius: number;
    private enabled = true;

    constructor(
        scene: Phaser.Scene,
        x: number,
        y: number,
        text: string,
        color: number,
        onClick: () => void,
        options: UIButtonOptions = {}
    ) {
        super(scene, x, y);

        this.baseColor = color;
        this.strokeColor = options.stroke ?? 0xffffff;
        this.buttonHeight = options.height ?? 66;

        this.label = scene.add
            .text(0, 0, text, {
                fontFamily: 'Arial Black, Arial, sans-serif',
                fontSize: `${options.fontSize ?? 26}px`,
                color: options.textColor ?? '#ffffff',
                align: 'center',
                lineSpacing: 2
            })
            .setOrigin(0.5);

        this.buttonWidth = options.width ?? this.label.width + 56;
        this.radius = options.radius ?? Math.min(18, this.buttonHeight / 2);

        this.bg = scene.add.graphics();
        this.hit = scene.add.rectangle(0, 0, this.buttonWidth, this.buttonHeight, 0xffffff, 0);

        this.add([this.bg, this.label, this.hit]);
        this.draw();

        this.hit.setInteractive({ useHandCursor: true });
        this.hit.on('pointerover', () => this.enabled && this.setScale(1.04));
        this.hit.on('pointerout', () => this.setScale(1));
        this.hit.on('pointerdown', () => {
            if (this.enabled) {
                this.setScale(0.96);
                onClick();
            }
        });
        this.hit.on('pointerup', () => this.setScale(1));

        scene.add.existing(this);
    }

    private draw(): void {
        const w = this.buttonWidth;
        const h = this.buttonHeight;
        const fill = this.enabled ? this.baseColor : 0x39406b;
        const fillAlpha = this.enabled ? 0.95 : 0.6;

        this.bg.clear();
        this.bg.fillStyle(0x000000, this.enabled ? 0.2 : 0.12);
        this.bg.fillRoundedRect(-w / 2, -h / 2 + 4, w, h, this.radius);
        this.bg.fillStyle(fill, fillAlpha);
        this.bg.fillRoundedRect(-w / 2, -h / 2, w, h, this.radius);
        this.bg.lineStyle(3, this.strokeColor, this.enabled ? 0.5 : 0.25);
        this.bg.strokeRoundedRect(-w / 2, -h / 2, w, h, this.radius);
    }

    setEnabled(enabled: boolean): this {
        this.enabled = enabled;
        this.setAlpha(enabled ? 1 : 0.7);
        this.draw();
        return this;
    }

    setLabel(text: string): this {
        this.label.setText(text);
        return this;
    }

    setButtonColor(color: number): this {
        this.baseColor = color;
        if (this.enabled) {
            this.draw();
        }
        return this;
    }

    get buttonW(): number {
        return this.buttonWidth;
    }
}
