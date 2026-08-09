import Phaser from "phaser";
import { GAME } from "./config.js";

/** Farther up the screen = smaller (fake camera tilt). */
export function depthScale(y) {
  const t = Phaser.Math.Clamp(y / GAME.height, 0, 1);
  return Phaser.Math.Linear(GAME.pseudo3d.farScale, GAME.pseudo3d.nearScale, t);
}

/** Depth sort key — higher Y draws in front. */
export function depthOrder(y, bias = 0) {
  return y + bias;
}
