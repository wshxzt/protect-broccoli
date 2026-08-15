import Phaser from "phaser";
import { COLORS, GAME, HEROES } from "../config.js";

export class SelectScene extends Phaser.Scene {
  constructor() {
    super("Select");
  }

  create() {
    this.picked = false;

    const requested = new URLSearchParams(window.location.search).get("hero");
    if (requested && HEROES[requested]) {
      this.pickHero(requested);
      return;
    }

    this.add.rectangle(GAME.width / 2, GAME.height / 2, GAME.width, GAME.height, 0x0b1410, 1);

    this.add
      .text(GAME.width / 2, 28, "PROTECT BROCCOLI", {
        fontFamily: "Georgia, 'Times New Roman', serif",
        fontSize: "28px",
        color: COLORS.hud,
      })
      .setOrigin(0.5);

    this.add
      .text(GAME.width / 2, 54, "Choose your Gold Saint", {
        fontFamily: "Georgia, 'Times New Roman', serif",
        fontSize: "15px",
        color: COLORS.hudMuted,
      })
      .setOrigin(0.5);

    const ids = Object.keys(HEROES);
    const cols = 4;
    const rows = 3;
    const cardW = 210;
    const cardH = 168;
    const gapX = 18;
    const gapY = 14;
    const gridW = cols * cardW + (cols - 1) * gapX;
    const originX = (GAME.width - gridW) / 2 + cardW / 2;
    const originY = 78 + cardH / 2;

    ids.forEach((id, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const x = originX + col * (cardW + gapX);
      const y = originY + row * (cardH + gapY);
      this.createHeroCard(HEROES[id], x, y, cardW, cardH);
    });

    this.add
      .text(GAME.width / 2, GAME.height - 22, "One click to begin", {
        fontFamily: "Georgia, 'Times New Roman', serif",
        fontSize: "14px",
        color: COLORS.hudMuted,
      })
      .setOrigin(0.5);
  }

  pickHero(heroId) {
    if (this.picked) return;
    this.picked = true;
    this.registry.set("heroId", heroId);
    this.scene.start("Game");
  }

  createHeroCard(hero, x, y, cardW, cardH) {
    const bg = this.add
      .rectangle(x, y, cardW, cardH, 0x15241c, 0.95)
      .setStrokeStyle(2, hero.accent, 0.85)
      .setInteractive({ useHandCursor: true });

    const portrait = this.add.image(x - 52, y - 4, hero.key).setScale(0.72);
    const name = this.add
      .text(x + 28, y - 48, hero.name, {
        fontFamily: "Georgia, 'Times New Roman', serif",
        fontSize: "18px",
        color: COLORS.hud,
      })
      .setOrigin(0.5, 0);
    const blurb = this.add
      .text(x + 28, y - 20, hero.blurb, {
        fontFamily: "Georgia, 'Times New Roman', serif",
        fontSize: "11px",
        color: COLORS.hudMuted,
        align: "center",
        wordWrap: { width: 118 },
      })
      .setOrigin(0.5, 0);

    const playBtn = this.add
      .rectangle(x + 28, y + 52, 118, 28, hero.accent, 0.95)
      .setInteractive({ useHandCursor: true });
    const playLabel = this.add
      .text(x + 28, y + 52, "Play", {
        fontFamily: "Georgia, 'Times New Roman', serif",
        fontSize: "14px",
        color: "#1a1412",
      })
      .setOrigin(0.5);

    const basePortraitScale = 0.72;
    const highlight = () => {
      bg.setFillStyle(0x1e3328, 1);
      portrait.setScale(basePortraitScale * 1.06);
    };
    const unhighlight = () => {
      bg.setFillStyle(0x15241c, 0.95);
      portrait.setScale(basePortraitScale);
    };

    const choose = () => this.pickHero(hero.id);

    [bg, playBtn, name, blurb, portrait, playLabel].forEach((obj) => {
      if (!obj.input) obj.setInteractive({ useHandCursor: true });
      obj.on("pointerover", highlight);
      obj.on("pointerout", unhighlight);
      obj.on("pointerup", choose);
    });
  }
}
