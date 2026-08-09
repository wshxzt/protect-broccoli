import Phaser from "phaser";
import { COLORS, GAME } from "../config.js";

export class ResultScene extends Phaser.Scene {
  constructor() {
    super("Result");
  }

  init(data) {
    this.won = Boolean(data?.won);
  }

  create() {
    this.add.rectangle(GAME.width / 2, GAME.height / 2, GAME.width, GAME.height, 0x050807, 0.72);

    if (this.won) {
      this.showVictory();
    } else {
      this.showDefeat();
    }

    this.input.keyboard.once("keydown-R", () => {
      this.scene.stop("Result");
      this.scene.stop("Game");
      this.scene.start("Select");
    });
  }

  showVictory() {
    const hug = this.add
      .image(GAME.width / 2, GAME.height / 2 - 18, "victory-hug")
      .setDepth(1)
      .setAlpha(0)
      .setScale(0.72);

    this.tweens.add({
      targets: hug,
      alpha: 1,
      scale: 0.95,
      duration: 700,
      ease: "Cubic.Out",
    });

    // Soft glow behind the portrait
    const glow = this.add
      .circle(GAME.width / 2, GAME.height / 2 - 18, 210, 0xd4b45a, 0.16)
      .setDepth(0);
    this.tweens.add({
      targets: glow,
      scale: 1.12,
      alpha: 0.28,
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: "Sine.InOut",
    });

    this.add
      .text(GAME.width / 2, 36, "Athena's broccoli is safe", {
        fontFamily: "Georgia, 'Times New Roman', serif",
        fontSize: "34px",
        color: COLORS.win,
        align: "center",
      })
      .setOrigin(0.5)
      .setDepth(2);

    this.add
      .text(GAME.width / 2, GAME.height - 42, "Press R to protect more broccoli", {
        fontFamily: "Georgia, 'Times New Roman', serif",
        fontSize: "18px",
        color: COLORS.hudMuted,
      })
      .setOrigin(0.5)
      .setDepth(2);
  }

  showDefeat() {
    this.add
      .text(GAME.width / 2, GAME.height / 2 - 36, "The broccoli was eaten", {
        fontFamily: "Georgia, 'Times New Roman', serif",
        fontSize: "36px",
        color: COLORS.danger,
        align: "center",
      })
      .setOrigin(0.5);

    this.add
      .text(GAME.width / 2, GAME.height / 2 + 16, "Press R to try again", {
        fontFamily: "Georgia, 'Times New Roman', serif",
        fontSize: "18px",
        color: COLORS.hudMuted,
      })
      .setOrigin(0.5);
  }
}
