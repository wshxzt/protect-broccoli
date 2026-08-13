import Phaser from "phaser";
import { GAME } from "./config.js";

/** Farther up the screen = smaller (fake camera tilt). */
export function depthScale(y) {
  const t = Phaser.Math.Clamp(y / GAME.height, 0, 1);
  return Phaser.Math.Linear(GAME.pseudo3d.farScale, GAME.pseudo3d.nearScale, t);
}

/**
 * Actors grow as they near the broccoli (the 3D zoom origin).
 * Blends rim distance with a light Y perspective cue (doorway = farther).
 */
export function arenaDepthScale(
  x,
  y,
  far = GAME.pseudo3d.enemyFarScale,
  near = GAME.pseudo3d.enemyNearScale,
  originX = GAME.width * 0.5,
  originY = GAME.height * 0.5,
) {
  const maxDist = Math.hypot(
    Math.max(originX, GAME.width - originX),
    Math.max(originY, GAME.height - originY),
  );
  const dist = Math.hypot(x - originX, y - originY);
  const towardOrigin = Phaser.Math.Clamp(1 - dist / Math.max(1, maxDist), 0, 1);
  // smoothstep — readable growth through the mid-ring
  const eased = towardOrigin * towardOrigin * (3 - 2 * towardOrigin);
  const radial = Phaser.Math.Linear(far, near, eased);
  const tilt = depthScale(y);
  return radial * 0.88 + tilt * 0.12;
}

/** Depth sort key — higher Y draws in front. */
export function depthOrder(y, bias = 0) {
  return y + bias;
}
