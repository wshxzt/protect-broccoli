import Phaser from "phaser";
import { COLORS, GAME, HEROES } from "../config.js";

export class SelectScene extends Phaser.Scene {
  constructor() {
    super("Select");
  }

  create() {
    this.picked = false;

    this.add.rectangle(GAME.width / 2, GAME.height / 2, GAME.width, GAME.height, 0x0b1410, 1);

    this.add
      .text(GAME.width / 2, 56, "PROTECT BROCCOLI", {
        fontFamily: "Georgia, 'Times New Roman', serif",
        fontSize: "34px",
        color: COLORS.hud,
      })
      .setOrigin(0.5);

    this.add
      .text(GAME.width / 2, 98, "Choose your Gold Saint", {
        fontFamily: "Georgia, 'Times New Roman', serif",
        fontSize: "18px",
        color: COLORS.hudMuted,
      })
      .setOrigin(0.5);

    const ids = Object.keys(HEROES);
    const gap = ids.length >= 3 ? 250 : 280;
    const startX = GAME.width / 2 - ((ids.length - 1) * gap) / 2;

    ids.forEach((id, index) => {
      this.createHeroCard(HEROES[id], startX + index * gap, GAME.height / 2 + 10);
    });

    this.add
      .text(GAME.width / 2, GAME.height - 48, "One click to begin", {
        fontFamily: "Georgia, 'Times New Roman', serif",
        fontSize: "16px",
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

  createHeroCard(hero, x, y) {
    const cardW = Object.keys(HEROES).length >= 3 ? 200 : 220;
    const bg = this.add
      .rectangle(x, y, cardW, 300, 0x15241c, 0.95)
      .setStrokeStyle(2, hero.accent, 0.85)
      .setInteractive({ useHandCursor: true });

    const portrait = this.add.image(x, y - 46, hero.key).setScale(1.25);
    const name = this.add
      .text(x, y + 68, hero.name, {
        fontFamily: "Georgia, 'Times New Roman', serif",
        fontSize: "26px",
        color: COLORS.hud,
      })
      .setOrigin(0.5);
    const blurb = this.add
      .text(x, y + 102, hero.blurb, {
        fontFamily: "Georgia, 'Times New Roman', serif",
        fontSize: "13px",
        color: COLORS.hudMuted,
        align: "center",
        wordWrap: { width: 190 },
      })
      .setOrigin(0.5);

    const playBtn = this.add
      .rectangle(x, y + 138, 150, 36, hero.accent, 0.95)
      .setInteractive({ useHandCursor: true });
    const playLabel = this.add
      .text(x, y + 138, `Play as ${hero.name}`, {
        fontFamily: "Georgia, 'Times New Roman', serif",
        fontSize: "15px",
        color: "#1a1412",
      })
      .setOrigin(0.5);

    const basePortraitScale = 1.25;
    const highlight = () => {
      bg.setFillStyle(0x1e3328, 1);
      portrait.setScale(basePortraitScale * 1.06);
    };
    const unhighlight = () => {
      bg.setFillStyle(0x15241c, 0.95);
      portrait.setScale(basePortraitScale);
    };

    const choose = () => this.pickHero(hero.id);

    bg.on("pointerover", highlight);
    bg.on("pointerout", unhighlight);
    bg.on("pointerup", choose);

    playBtn.on("pointerover", highlight);
    playBtn.on("pointerout", unhighlight);
    playBtn.on("pointerup", choose);

    // Keep labels from looking dead; clicks on them also count
    name.setInteractive({ useHandCursor: true });
    blurb.setInteractive({ useHandCursor: true });
    portrait.setInteractive({ useHandCursor: true });
    playLabel.setInteractive({ useHandCursor: true });
    name.on("pointerup", choose);
    blurb.on("pointerup", choose);
    portrait.on("pointerup", choose);
    playLabel.on("pointerup", choose);
  }
}
