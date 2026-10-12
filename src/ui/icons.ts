import Phaser from 'phaser';

/** A simple drawn coin, so we ship no image assets. Position is its centre. */
export function makeCoin(scene: Phaser.Scene, x: number, y: number, radius = 12): Phaser.GameObjects.Container {
    const coin = scene.add.container(x, y);
    coin.add(scene.add.circle(0, 0, radius, 0xffe3a3).setStrokeStyle(2, 0xb8860b, 1));
    coin.add(scene.add.circle(0, 0, radius * 0.55, 0xffd15c));
    coin.add(scene.add.circle(-radius * 0.28, -radius * 0.28, radius * 0.18, 0xffffff, 0.7));
    return coin;
}

/** Draws the climbing robot for previews (menu, shop). */
export function makeRobotPreview(
    scene: Phaser.Scene,
    x: number,
    y: number,
    scale: number,
    body: number,
    eye: number
): Phaser.GameObjects.Container {
    const container = scene.add.container(x, y);

    const legs = scene.add.rectangle(0, 16, 26, 12, body);
    const torso = scene.add.rectangle(0, 0, 40, 30, body);
    const head = scene.add.rectangle(0, -24, 30, 22, body);
    const visor = scene.add.rectangle(0, -24, 22, 10, eye);
    const antenna = scene.add.rectangle(0, -40, 4, 12, body);
    const bulb = scene.add.circle(0, -47, 4, eye);
    const armL = scene.add.rectangle(-26, 2, 8, 20, body);
    const armR = scene.add.rectangle(26, 2, 8, 20, body);

    container.add([legs, armL, armR, torso, head, visor, antenna, bulb]);
    container.setScale(scale);
    return container;
}
