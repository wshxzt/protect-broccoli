import Phaser from "phaser";
import { GAME } from "./config.js";

/** Farther up the screen = smaller (fake camera tilt). */
export function depthScale(y) {
  const t = Phaser.Math.Clamp(y / GAME.height, 0, 1);
  return Phaser.Math.Linear(GAME.pseudo3d.farScale, GAME.pseudo3d.nearScale, t);
}

/**
 * Actors grow as they near the broccoli (screen center).
 * Blends rim distance with a light Y perspective cue.
 */
export function arenaDepthScale(x, y, far = GAME.pseudo3d.enemyFarScale, near = GAME.pseudo3d.enemyNearScale) {
  const cx = GAME.width * 0.5;
  const cy = GAME.height * 0.5;
  const maxDist = Math.hypot(cx, cy) * 0.98;
  const dist = Math.hypot(x - cx, y - cy);
  const towardCenter = Phaser.Math.Clamp(1 - dist / maxDist, 0, 1);
  // smoothstep — readable growth through the mid-ring
  const eased = towardCenter * towardCenter * (3 - 2 * towardCenter);
  const radial = Phaser.Math.Linear(far, near, eased);
  const tilt = depthScale(y);
  return radial * 0.82 + tilt * 0.18;
}

/** Depth sort key — higher Y draws in front. */
export function depthOrder(y, bias = 0) {
  return y + bias;
}
