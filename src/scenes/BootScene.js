import Phaser from "phaser";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }

  preload() {
    this.load.image("gemini", "/assets/gemini.png");
    this.load.image("broccoli", "/assets/broccoli.png");
    this.load.image("broccoli-seed", "/assets/broccoli-seed.png");
    this.load.image("broccoli-mid", "/assets/broccoli-mid.png");
    this.load.image("enemy-squirrel", "/assets/enemy-squirrel.png");
    this.load.image("enemy-aphid", "/assets/enemy-aphid.png");
    this.load.image("enemy-worm", "/assets/enemy-worm.png");
    this.load.image("burst", "/assets/burst.png");
    this.load.image("athena", "/assets/athena.png");
    this.load.image("victory-hug", "/assets/victory-hug.png");

    const { width, height } = this.scale;
    const barW = 240;
    const barH = 10;
    const x = (width - barW) / 2;
    const y = height / 2;

    this.add
      .text(width / 2, y - 28, "Awakening Cosmo...", {
        fontFamily: "Georgia, 'Times New Roman', serif",
        fontSize: "18px",
        color: "#f3efe4",
      })
      .setOrigin(0.5);

    const frame = this.add.rectangle(width / 2, y, barW, barH, 0x1a1412, 0.9);
    const fill = this.add.rectangle(x, y, 1, barH, 0xd4b45a, 1).setOrigin(0, 0.5);

    this.load.on("progress", (value) => {
      fill.width = barW * value;
    });
    this.load.on("complete", () => {
      frame.destroy();
      fill.destroy();
    });
  }

  create() {
    this.scene.start("Game");
  }
}
