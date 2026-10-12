import Phaser from 'phaser';

/** A rounded card/panel background drawn at the local origin. */
export function makePanel(
    scene: Phaser.Scene,
    width: number,
    height: number,
    fill: number,
    stroke: number,
    strokeAlpha = 0.95,
    radius = 16,
    fillAlpha = 1
): Phaser.GameObjects.Graphics {
    const g = scene.add.graphics();
    g.fillStyle(fill, fillAlpha);
    g.fillRoundedRect(-width / 2, -height / 2, width, height, radius);
    g.lineStyle(3, stroke, strokeAlpha);
    g.strokeRoundedRect(-width / 2, -height / 2, width, height, radius);
    return g;
}
