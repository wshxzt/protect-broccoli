import Phaser from "phaser";
import { GAME } from "./config.js";
import { BootScene } from "./scenes/BootScene.js";
import { SelectScene } from "./scenes/SelectScene.js";
import { GameScene } from "./scenes/GameScene.js";
import { ResultScene } from "./scenes/ResultScene.js";

const config = {
  type: Phaser.AUTO,
  parent: "app",
  width: GAME.width,
  height: GAME.height,
  backgroundColor: "#0b1410",
  physics: {
    default: "arcade",
    arcade: {
      debug: false,
    },
  },
  scene: [BootScene, SelectScene, GameScene, ResultScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};

new Phaser.Game(config);
