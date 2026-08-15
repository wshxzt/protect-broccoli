import Phaser from "phaser";

const HERO_KEYS = [
  "aries",
  "taurus",
  "gemini",
  "cancer",
  "leo",
  "virgo",
  "libra",
  "scorpio",
  "sagittarius",
  "capricorn",
  "aquarius",
  "pisces",
];

export class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }

  preload() {
    for (const key of HERO_KEYS) {
      this.load.image(key, `/assets/${key}.png`);
    }
    this.load.image("broccoli", "/assets/broccoli.png");
    this.load.image("broccoli-seed", "/assets/broccoli-seed.png");
    this.load.image("broccoli-mid", "/assets/broccoli-mid.png");
    this.load.image("enemy-squirrel", "/assets/enemy-squirrel.png");
    this.load.image("enemy-aphid", "/assets/enemy-aphid.png");
    this.load.image("enemy-worm", "/assets/enemy-worm.png");
    this.load.image("burst", "/assets/burst.png");
    this.load.image("athena", "/assets/athena.png");
    this.load.image("victory-hug", "/assets/victory-hug.png");
    for (const key of HERO_KEYS) {
      this.load.image(`${key}-temple`, `/assets/${key}-temple.png`);
    }
    for (const color of ["cyan", "gold", "crimson", "rose", "violet"]) {
      for (const size of ["lo", "mid", "hi"]) {
        this.load.image(`flame-${color}-${size}`, `/assets/flame-${color}-${size}.png`);
      }
    }
    for (const key of [
      "star-cross",
      "star-point",
      "star-glow",
      "meteor-cyan",
      "meteor-gold",
      "dust-mote",
      "dust-flake",
      "dust-wisp",
      "wisp-curl",
      "wisp-puff",
      "wisp-rise",
      "ember-core",
      "ember-flake",
      "ember-glow",
      "sal-petal-a",
      "sal-petal-b",
      "sal-bloom",
      "snow-crystal",
      "snow-lace",
      "snow-hex",
      "rose-petal-a",
      "rose-petal-b",
      "rose-bloom",
    ]) {
      this.load.image(key, `/assets/${key}.png`);
    }

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
    this.createNeedleTexture();
    this.createRoseTexture();
    this.createIceShardTexture();
    this.createLibraBladeTexture();
    this.createFlameTexture();
    this.createAmbienceTextures();
    this.scene.start("Select");
  }

  createBeadTexture() {
    const g = this.make.graphics({ x: 0, y: 0, add: false });
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
    g.fillStyle(0xfff1a8, 1);
    g.fillTriangle(46, 8, 32, 2, 32, 14);
    g.fillStyle(0xd4b45a, 1);
    g.fillRect(4, 6, 30, 4);
    g.fillStyle(0xe8c888, 1);
    g.fillTriangle(4, 8, 0, 3, 0, 13);
    g.fillStyle(0xfff6c8, 0.9);
    g.fillRect(10, 7, 18, 2);
    g.generateTexture("golden-arrow", 48, 16);
    g.destroy();
  }

  createNeedleTexture() {
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0xff6b7a, 1);
    g.fillTriangle(36, 4, 0, 3, 0, 5);
    g.fillStyle(0xffd0d6, 1);
    g.fillRect(0, 3.2, 22, 1.6);
    g.generateTexture("scarlet-needle", 36, 8);
    g.destroy();
  }

  createRoseTexture() {
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0xc03050, 1);
    g.fillCircle(10, 10, 8);
    g.fillStyle(0xe07090, 1);
    g.fillCircle(8, 8, 4);
    g.fillStyle(0xffb0c0, 1);
    g.fillCircle(7, 7, 2);
    g.fillStyle(0x3a8a48, 1);
    g.fillTriangle(10, 18, 6, 12, 14, 12);
    g.generateTexture("bloody-rose", 20, 20);
    g.destroy();
  }

  createIceShardTexture() {
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0xa8e8ff, 1);
    g.fillTriangle(8, 0, 0, 22, 16, 22);
    g.fillStyle(0xffffff, 0.85);
    g.fillTriangle(8, 2, 4, 16, 10, 16);
    g.generateTexture("ice-shard", 16, 24);
    g.destroy();
  }

  createLibraBladeTexture() {
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0xf0e0a0, 1);
    g.fillTriangle(40, 6, 18, 1, 18, 11);
    g.fillStyle(0xd4b45a, 1);
    g.fillRect(2, 4, 18, 4);
    g.fillStyle(0xc8a060, 1);
    g.fillRect(0, 2, 4, 8);
    g.generateTexture("libra-blade", 42, 12);
    g.destroy();
  }

  createFlameTexture() {
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0xffffff, 1);
    g.fillEllipse(8, 12, 12, 16);
    g.fillStyle(0xffffff, 0.75);
    g.fillEllipse(8, 7, 7, 12);
    g.fillStyle(0xffffff, 0.95);
    g.fillEllipse(8, 4, 3.5, 6);
    g.generateTexture("flame", 16, 20);
    g.clear();
    g.fillStyle(0xffffff, 1);
    g.fillCircle(4, 4, 3.5);
    g.generateTexture("ember", 8, 8);
    g.destroy();
  }

  createAmbienceTextures() {
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0xffffff, 1);
    g.fillEllipse(7, 10, 12, 7);
    g.fillTriangle(7, 2, 3, 8, 11, 8);
    g.generateTexture("petal", 14, 16);
    g.clear();
    g.fillStyle(0xffffff, 1);
    g.fillTriangle(8, 1, 1, 14, 8, 11);
    g.fillTriangle(8, 1, 15, 14, 8, 11);
    g.fillStyle(0xcccccc, 1);
    g.fillRect(7, 11, 2, 5);
    g.generateTexture("leaf", 16, 18);
    g.clear();
    g.fillStyle(0xffffff, 1);
    g.fillCircle(5, 5, 4);
    g.fillCircle(8, 3, 2.2);
    g.fillCircle(3, 7, 2);
    g.generateTexture("snowflake", 12, 12);
    g.clear();
    g.fillStyle(0xffffff, 1);
    g.fillCircle(3, 3, 2.4);
    g.generateTexture("spark", 6, 6);
    g.destroy();
  }
}
