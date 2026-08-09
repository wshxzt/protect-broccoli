import Phaser from "phaser";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }

  preload() {
    this.load.image("gemini", "/assets/gemini.png");
    this.load.image("virgo", "/assets/virgo.png");
    this.load.image("sagittarius", "/assets/sagittarius.png");
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
    this.createBeadTexture();
    this.createArrowTexture();
    this.scene.start("Select");
  }

  createBeadTexture() {
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    // Wood/amber prayer bead (japamala style)
    g.fillStyle(0x8a5a28, 1);
    g.fillCircle(10, 10, 9);
    g.fillStyle(0xc49a5a, 1);
    g.fillCircle(10, 10, 7);
    g.fillStyle(0xe8c888, 1);
    g.fillCircle(7, 7, 2.5);
    g.fillStyle(0x3a2410, 1);
    g.fillCircle(10, 10, 1.2);
    g.generateTexture("bead", 20, 20);
    g.destroy();
  }

  createArrowTexture() {
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    // Golden arrow pointing right (origin at shaft center-left)
    g.fillStyle(0xfff1a8, 1);
    g.fillTriangle(46, 8, 32, 2, 32, 14); // arrowhead
    g.fillStyle(0xd4b45a, 1);
    g.fillRect(4, 6, 30, 4); // shaft
    g.fillStyle(0xe8c888, 1);
    g.fillTriangle(4, 8, 0, 3, 0, 13); // fletching
    g.fillStyle(0xfff6c8, 0.9);
    g.fillRect(10, 7, 18, 2); // highlight
    g.generateTexture("golden-arrow", 48, 16);
    g.destroy();
  }
}
