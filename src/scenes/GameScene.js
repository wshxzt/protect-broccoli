import Phaser from "phaser";
import { COLORS, GAME, HEROES, TEMPLES } from "../config.js";
import { arenaDepthScale, depthOrder } from "../pseudo3d.js";

const TEMPLE_ATMOSPHERE = {
  default: { flame: 0xffb060, ambience: "leaves", fires: [], flameKey: "gold", fireScale: 0.5, door: { x: 400, y: 200, w: 160, h: 220 } },
  aries: { flame: 0x7ec8ff, ambience: "stars", fires: [[265, 415], [694, 415]], flameKey: "cyan", fireScale: 0.42, door: { x: 412, y: 216, w: 136, h: 268, skyH: 158 } },
  taurus: { flame: 0xffa040, ambience: "dust", fires: [[334, 372], [621, 375]], flameKey: "gold", fireScale: 0.48, door: { x: 398, y: 206, w: 150, h: 248 } },
  gemini: {
    flame: 0x88e0ff,
    ambience: "meteors",
    fires: [
      [62, 418, 0.7],
      [338, 410, 0.42],
      [620, 410, 0.42],
      [893, 432, 0.7],
    ],
    flameKey: "cyan",
    fireScale: 0.5,
    door: { x: 434, y: 218, w: 92, h: 256, skyH: 228 },
  },
  cancer: { flame: 0xc9a0e0, ambience: "wisps", fires: [[326, 352], [636, 358]], flameKey: "violet", fireScale: 0.52, door: { x: 428, y: 198, w: 104, h: 228 } },
  leo: { flame: 0xffc04a, ambience: "embers", fires: [[271, 372], [685, 372]], flameKey: "gold", fireScale: 0.52, door: { x: 368, y: 206, w: 224, h: 244 } },
  virgo: { flame: 0xffe8b0, ambience: "sal", fires: [[305, 373], [648, 374]], flameKey: "gold", fireScale: 0.5, door: { x: 352, y: 214, w: 256, h: 222 } },
  libra: { flame: 0xe8d090, ambience: "golddust", fires: [[272, 367], [684, 367]], flameKey: "gold", fireScale: 0.48, door: { x: 372, y: 184, w: 216, h: 292 } },
  scorpio: { flame: 0xff6a70, ambience: "sparks", fires: [[281, 388], [678, 388]], flameKey: "crimson", fireScale: 0.46, door: { x: 392, y: 220, w: 176, h: 268 } },
  sagittarius: { flame: 0xffe082, ambience: "meteors", fires: [[323, 395], [637, 394]], flameKey: "gold", fireScale: 0.5, door: { x: 376, y: 172, w: 208, h: 238, skyH: 196 } },
  capricorn: { flame: 0xf0e8c8, ambience: "snow", fires: [[316, 360], [641, 360]], flameKey: "gold", fireScale: 0.46, door: { x: 374, y: 208, w: 212, h: 216 } },
  aquarius: { flame: 0xa8e8ff, ambience: "snow", fires: [[314, 349], [645, 350]], flameKey: "cyan", fireScale: 0.5, door: { x: 380, y: 224, w: 200, h: 244 } },
  pisces: { flame: 0xff80a0, ambience: "roses", fires: [[269, 340], [686, 342]], flameKey: "rose", fireScale: 0.5, door: { x: 392, y: 184, w: 176, h: 264 } },
};

export class GameScene extends Phaser.Scene {
  constructor() {
    super("Game");
  }

  create() {
    const heroId = this.registry.get("heroId") || "gemini";
    this.hero = HEROES[heroId] || HEROES.gemini;

    this.elapsed = 0;
    this.spawnTimer = 0;
    this.spawnInterval = GAME.spawnIntervalStartMs;
    this.athenaTimer = 0;
    this.attackCooldown = 0;
    this.specialCharge = 0;
    this.lastLeftClickAt = 0;
    this.ended = false;
    this.moveTarget = null;
    this.athenaBusy = false;
    this.athenaHome = { x: GAME.width - 78, y: GAME.height - 96 };

    this.heroHopState = { hop: 0, specialPulse: 0 };
    this.temple = TEMPLES[this.hero.id] || TEMPLES.default;
    this.patchAnchor = {
      x: this.temple.patchX ?? GAME.width / 2,
      y: this.temple.patchY ?? GAME.height / 2,
    };
    this.drawArena();
    this.addBrazierFires();
    this.createTempleAmbience();

    this.createBroccoli();
    this.createAthena();

    this.gemini = this.physics.add.sprite(
      this.patchAnchor.x,
      this.patchAnchor.y + (this.temple.heroSpawnOffsetY ?? 110),
      this.hero.key,
    );
    this.gemini.setCollideWorldBounds(true);
    this.gemini.setOrigin(0.5, 0.88);
    this.gemini.body.setSize(48, 72);
    this.gemini.body.setOffset(32, 20);
    this.gemini.baseScale = this.hero.scale;
    this.gemini.walkPhase = 0;
    this.geminiShadow = this.createGroundShadow(42, 14);

    this.moveMarker = this.add
      .ellipse(0, 0, 28, 12, 0xd4b45a, 0.4)
      .setVisible(false);
    this.moveMarkerStroke = this.add
      .ellipse(0, 0, 34, 14)
      .setStrokeStyle(2, 0x6ec8e0, 0.75)
      .setVisible(false);

    this.enemies = this.physics.add.group();

    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys({
      w: Phaser.Input.Keyboard.KeyCodes.W,
      a: Phaser.Input.Keyboard.KeyCodes.A,
      s: Phaser.Input.Keyboard.KeyCodes.S,
      d: Phaser.Input.Keyboard.KeyCodes.D,
      space: Phaser.Input.Keyboard.KeyCodes.SPACE,
    });

    // Left-click move, double left-click attack, right-click special
    this.input.mouse.disableContextMenu();
    this.input.on("pointerdown", (pointer) => {
      if (this.ended) return;
      if (pointer.leftButtonDown()) {
        const now = this.time.now;
        if (now - this.lastLeftClickAt <= GAME.doubleClickMs) {
          this.lastLeftClickAt = 0;
          this.tryAttack();
        } else {
          this.lastLeftClickAt = now;
          this.setMoveTarget(pointer.worldX, pointer.worldY);
        }
      } else if (pointer.rightButtonDown()) {
        this.trySpecialAttack();
      }
    });
    this.input.on("pointermove", (pointer) => {
      if (this.ended) return;
      if (pointer.isDown && pointer.leftButtonDown()) {
        this.setMoveTarget(pointer.worldX, pointer.worldY);
      }
    });

    this.physics.add.overlap(this.enemies, this.patch, (_, enemy) => {
      this.damagePatch(enemy);
    });

    this.createHud();
    this.input.keyboard.on("keydown-R", () => {
      this.quitToSelect();
    });
  }

  quitToSelect() {
    if (this.ended) return;
    this.ended = true;
    this.scene.stop("Result");
    this.scene.start("Select");
  }

  setMoveTarget(x, y) {
    this.moveTarget = {
      x: Phaser.Math.Clamp(x, 16, GAME.width - 16),
      y: Phaser.Math.Clamp(y, 16, GAME.height - 16),
    };
    this.moveMarker.setPosition(this.moveTarget.x, this.moveTarget.y).setVisible(true);
    this.moveMarkerStroke.setPosition(this.moveTarget.x, this.moveTarget.y).setVisible(true);
    this.tweens.killTweensOf(this.moveMarker);
    this.moveMarker.setAlpha(0.55);
    this.tweens.add({
      targets: this.moveMarker,
      alpha: 0.2,
      duration: 350,
      yoyo: true,
      repeat: 1,
    });
  }

  drawArena() {
    if (this.temple.id === "aries") {
      this.drawAriesTemple();
      return;
    }
    if (this.temple.id === "taurus") {
      this.drawTaurusTemple();
      return;
    }
    if (this.temple.id === "gemini") {
      this.drawGeminiTemple();
      return;
    }
    if (this.temple.id === "cancer") {
      this.drawCancerTemple();
      return;
    }
    if (this.temple.id === "leo") {
      this.drawLeoTemple();
      return;
    }
    if (this.temple.id === "virgo") {
      this.drawVirgoTemple();
      return;
    }
    if (this.temple.id === "libra") {
      this.drawLibraTemple();
      return;
    }
    if (this.temple.id === "scorpio") {
      this.drawScorpioTemple();
      return;
    }
    if (this.temple.id === "sagittarius") {
      this.drawSagittariusTemple();
      return;
    }
    if (this.temple.id === "capricorn") {
      this.drawCapricornTemple();
      return;
    }
    if (this.temple.id === "aquarius") {
      this.drawAquariusTemple();
      return;
    }
    if (this.temple.id === "pisces") {
      this.drawPiscesTemple();
      return;
    }
    this.drawDefaultArena();
  }

  atmosphere() {
    return TEMPLE_ATMOSPHERE[this.temple.id] || TEMPLE_ATMOSPHERE.default;
  }

  ensureStarTextures() {
    if (this.textures.exists("star-cross")) return;
    const drawStar = (key, points, size) => {
      const g = this.make.graphics({ add: false });
      const c = size / 2;
      g.fillStyle(0xffffff, 1);
      g.beginPath();
      for (let i = 0; i < points * 2; i += 1) {
        const r = i % 2 === 0 ? c - 2 : c * 0.28;
        const a = (Math.PI * i) / points - Math.PI / 2;
        const x = c + Math.cos(a) * r;
        const y = c + Math.sin(a) * r;
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.closePath();
      g.fillPath();
      g.fillStyle(0xffffff, 0.85);
      g.fillCircle(c, c, 3.2);
      g.generateTexture(key, size, size);
      g.destroy();
    };
    drawStar("star-cross", 4, 48);
    drawStar("star-point", 6, 48);
    drawStar("star-glow", 4, 36);
  }

  /** 3D scale relative to the broccoli (zoom origin). */
  depthAt(x, y, far, near) {
    return arenaDepthScale(
      x,
      y,
      far ?? GAME.pseudo3d.enemyFarScale,
      near ?? GAME.pseudo3d.enemyNearScale,
      this.patchAnchor.x,
      this.patchAnchor.y,
    );
  }

  /**
   * Ground-plane circle projected into a foreshortened oval
   * (camera looking down the hall toward the door).
   */
  strokeFloorRing(g, cx, cy, radius, squash = 0.3) {
    const steps = 48;
    g.beginPath();
    for (let i = 0; i <= steps; i += 1) {
      const a = (Math.PI * 2 * i) / steps;
      const lx = Math.cos(a) * radius;
      const lz = Math.sin(a) * radius;
      const persp = 1 + lz * 0.0022;
      const sx = cx + lx * persp;
      const sy = cy + lz * squash;
      if (i === 0) g.moveTo(sx, sy);
      else g.lineTo(sx, sy);
    }
    g.strokePath();
  }

  drawSacredRings(px, py) {
    const t = this.temple;
    const g = this.add.graphics().setDepth(-10);
    const cy = py + 10;
    g.lineStyle(2.4, t.ringPrimary ?? 0xd8d0b8, 0.48);
    this.strokeFloorRing(g, px, cy, 102, 0.3);
    g.lineStyle(2, t.ringSecondary ?? 0xa8c0d8, 0.32);
    this.strokeFloorRing(g, px, cy, 148, 0.3);
    g.lineStyle(1.5, t.accent ?? t.ringPrimary ?? 0xe8c890, 0.18);
    this.strokeFloorRing(g, px, cy, 192, 0.3);
  }

  addBrazierFires() {
    const fires = this.atmosphere().fires;
    const color = this.atmosphere().flameKey;
    if (!fires?.length || !color) return;
    const keys = [`flame-${color}-lo`, `flame-${color}-mid`, `flame-${color}-hi`];
    if (keys.some((key) => !this.textures.exists(key))) return;
    const defaultScale = this.atmosphere().fireScale ?? 0.5;
    const ADD = Phaser.BlendModes.ADD;

    for (const fire of fires) {
      const x = fire[0];
      const y = fire[1];
      const scale = fire[2] ?? defaultScale;
      const layers = keys.map((key) =>
        this.add
          .image(x, y, key)
          .setOrigin(0.5, 0.96)
          .setScale(scale)
          .setDepth(-21)
          .setBlendMode(ADD)
          .setAlpha(0),
      );
      this.cycleFlameFrames(layers);
    }
  }

  /** Crossfade painted flame frames: small → medium → large → medium. */
  cycleFlameFrames(layers) {
    const seq = [0, 1, 2, 1];
    let i = 0;
    layers[0].setAlpha(0.9);
    const fade = 200;
    const hold = 90;
    const step = () => {
      if (!this.sys.isActive()) return;
      const from = layers[seq[i]];
      i = (i + 1) % seq.length;
      const to = layers[seq[i]];
      this.tweens.add({
        targets: to,
        alpha: 0.9,
        duration: fade,
        ease: "Sine.InOut",
      });
      this.tweens.add({
        targets: from,
        alpha: 0,
        duration: fade,
        ease: "Sine.InOut",
        onComplete: () => {
          if (!this.sys.isActive()) return;
          this.time.delayedCall(hold, step);
        },
      });
    };
    this.time.delayedCall(hold, step);
  }

  createTempleAmbience() {
    const kind = this.atmosphere().ambience;
    const tint = this.atmosphere().flame;
    const d = this.atmosphere().door;
    if (!d) return;
    const ADD = Phaser.BlendModes.ADD;
    const pad = 4;
    const zone = new Phaser.Geom.Rectangle(d.x + pad, d.y + pad, d.w - pad * 2, d.h - pad * 2);
    const maskGfx = this.add.graphics().setVisible(false);
    maskGfx.fillStyle(0xffffff, 1);
    maskGfx.fillRect(zone.x, zone.y, zone.width, zone.height);
    const mask = maskGfx.createGeometryMask();
    const layer = this.add.container(0, 0).setDepth(-18);
    layer.setMask(mask);
    const deathZone = { type: "onLeave", source: zone };

    const cx = zone.centerX;
    const cy = zone.centerY;
    const hw = zone.width / 2;
    const hh = zone.height / 2;
    const clip = (obj) => layer.add(obj);

    const spawnInDoor = () => ({
      x: Phaser.Math.FloatBetween(zone.left + 10, zone.right - 10),
      y: Phaser.Math.FloatBetween(zone.top + 10, zone.bottom - 10),
    });

    if (kind === "snow") {
      const flakeKeys = ["snow-crystal", "snow-lace", "snow-hex"].filter((key) =>
        this.textures.exists(key),
      );
      const live = [];
      const maxFlakes = 16;
      const fall = () => {
        if (this.ended || flakeKeys.length === 0) return;
        for (let i = live.length - 1; i >= 0; i -= 1) {
          if (!live[i].active) live.splice(i, 1);
        }
        if (live.length >= maxFlakes) return;
        const start = {
          x: Phaser.Math.FloatBetween(zone.left + 14, zone.right - 14),
          y: zone.top + Phaser.Math.FloatBetween(6, 18),
        };
        const flake = this.add
          .image(start.x, start.y, Phaser.Utils.Array.GetRandom(flakeKeys))
          .setDepth(-16)
          .setAlpha(0.85)
          .setScale(Phaser.Math.FloatBetween(0.18, 0.3))
          .setAngle(Phaser.Math.Between(0, 360));
        flake.setBlendMode(ADD);
        flake.setMask(mask);
        live.push(flake);
        this.tweens.add({
          targets: flake,
          x: Phaser.Math.Clamp(start.x + Phaser.Math.FloatBetween(-8, 8), zone.left + 14, zone.right - 14),
          y: zone.bottom - 22,
          alpha: 0,
          angle: flake.angle + Phaser.Math.Between(40, 140),
          duration: Phaser.Math.Between(2000, 3200),
          onComplete: () => flake.destroy(),
        });
      };
      for (let i = 0; i < maxFlakes; i += 1) fall();
      this.time.addEvent({ delay: 160, loop: true, callback: fall });
      return;
    }

    if (kind === "sal") {
      const salKeys = ["sal-petal-a", "sal-petal-b", "sal-bloom"].filter((key) =>
        this.textures.exists(key),
      );
      const live = [];
      const maxSal = 14;
      const fall = () => {
        if (this.ended || salKeys.length === 0) return;
        for (let i = live.length - 1; i >= 0; i -= 1) {
          if (!live[i].active) live.splice(i, 1);
        }
        if (live.length >= maxSal) return;
        const start = {
          x: Phaser.Math.FloatBetween(zone.left + 10, zone.right - 10),
          y: zone.top + Phaser.Math.FloatBetween(6, 20),
        };
        const key = Math.random() < 0.22 ? "sal-bloom" : Phaser.Utils.Array.GetRandom(["sal-petal-a", "sal-petal-b"]);
        const useKey = salKeys.includes(key) ? key : salKeys[0];
        const petal = this.add
          .image(start.x, start.y, useKey)
          .setDepth(-16)
          .setAlpha(0.9)
          .setScale(Phaser.Math.FloatBetween(useKey === "sal-bloom" ? 0.14 : 0.16, useKey === "sal-bloom" ? 0.22 : 0.26))
          .setAngle(Phaser.Math.Between(0, 360));
        petal.setMask(mask);
        live.push(petal);
        this.tweens.add({
          targets: petal,
          x: Phaser.Math.Clamp(start.x + Phaser.Math.FloatBetween(-16, 16), zone.left + 10, zone.right - 10),
          y: zone.bottom - 18,
          alpha: 0,
          angle: petal.angle + Phaser.Math.Between(120, 260),
          duration: Phaser.Math.Between(2400, 3800),
          onComplete: () => petal.destroy(),
        });
      };
      for (let i = 0; i < maxSal; i += 1) fall();
      this.time.addEvent({ delay: 200, loop: true, callback: fall });
      return;
    }

    if (kind === "roses") {
      const roseKeys = ["rose-petal-a", "rose-petal-b", "rose-bloom"].filter((key) =>
        this.textures.exists(key),
      );
      const live = [];
      const maxRoses = 14;
      const fall = () => {
        if (this.ended || roseKeys.length === 0) return;
        for (let i = live.length - 1; i >= 0; i -= 1) {
          if (!live[i].active) live.splice(i, 1);
        }
        if (live.length >= maxRoses) return;
        const start = {
          x: Phaser.Math.FloatBetween(zone.left + 12, zone.right - 12),
          y: zone.top + Phaser.Math.FloatBetween(6, 18),
        };
        const key = Math.random() < 0.2 ? "rose-bloom" : Phaser.Utils.Array.GetRandom(["rose-petal-a", "rose-petal-b"]);
        const useKey = roseKeys.includes(key) ? key : roseKeys[0];
        const rose = this.add
          .image(start.x, start.y, useKey)
          .setDepth(-16)
          .setAlpha(0.9)
          .setScale(Phaser.Math.FloatBetween(useKey === "rose-bloom" ? 0.16 : 0.18, useKey === "rose-bloom" ? 0.26 : 0.3))
          .setAngle(Phaser.Math.Between(0, 360));
        rose.setMask(mask);
        live.push(rose);
        this.tweens.add({
          targets: rose,
          x: Phaser.Math.Clamp(start.x + Phaser.Math.FloatBetween(-12, 12), zone.left + 12, zone.right - 12),
          y: zone.bottom - 20,
          alpha: 0,
          angle: rose.angle + Phaser.Math.Between(100, 220),
          duration: Phaser.Math.Between(2200, 3600),
          onComplete: () => rose.destroy(),
        });
      };
      for (let i = 0; i < maxRoses; i += 1) fall();
      this.time.addEvent({ delay: 200, loop: true, callback: fall });
      return;
    }

    if (kind === "petals" || kind === "leaves") {
      const key = kind === "petals" ? "petal" : "leaf";
      clip(
        this.add.particles(cx, zone.top + 8, key, {
          x: { min: -hw + 10, max: hw - 10 },
          y: 0,
          lifespan: { min: 2000, max: 3400 },
          speedY: { min: 14, max: 28 },
          speedX: { min: -10, max: 10 },
          scale: { min: 0.45, max: 0.9 },
          alpha: { start: 0.85, end: 0.05 },
          rotate: { min: -180, max: 180 },
          frequency: 140,
          tint,
          blendMode: "NORMAL",
          deathZone,
        }),
      );
      return;
    }

    if (kind === "meteors" || kind === "stars") {
      this.ensureStarTextures();
      const starKeys = ["star-cross", "star-point"].filter((key) => this.textures.exists(key));
      const skyH = d.skyH ?? d.h;
      const sky = new Phaser.Geom.Rectangle(zone.x, zone.y, zone.width, Math.max(24, skyH - pad));
      const skyGfx = this.add.graphics().setVisible(false);
      skyGfx.fillStyle(0xffffff, 1);
      skyGfx.fillRect(sky.x, sky.y, sky.width, sky.height);
      const skyMask = skyGfx.createGeometryMask();
      const live = [];
      const maxStars = kind === "stars" ? 18 : 8;
      const twinkle = () => {
        if (this.ended || starKeys.length === 0) return;
        for (let i = live.length - 1; i >= 0; i -= 1) {
          if (!live[i].active) live.splice(i, 1);
        }
        if (live.length >= maxStars) return;
        const start = {
          x: Phaser.Math.FloatBetween(sky.left + 10, sky.right - 10),
          y: Phaser.Math.FloatBetween(sky.top + 8, sky.bottom - 10),
        };
        const star = this.add
          .image(start.x, start.y, Phaser.Utils.Array.GetRandom(starKeys))
          .setDepth(-16)
          .setAlpha(0.4)
          .setScale(Phaser.Math.FloatBetween(0.18, 0.32));
        star.setMask(skyMask);
        live.push(star);
        this.tweens.add({
          targets: star,
          alpha: 1,
          duration: Phaser.Math.Between(280, 480),
          yoyo: true,
          repeat: 4,
          onComplete: () => star.destroy(),
        });
      };
      for (let i = 0; i < maxStars; i += 1) twinkle();
      this.time.addEvent({
        delay: kind === "stars" ? 160 : 380,
        loop: true,
        callback: twinkle,
      });

      if (kind === "meteors") {
        this.time.addEvent({
          delay: 900,
          loop: true,
          callback: () => {
            if (this.ended) return;
            const start = {
              x: Phaser.Math.FloatBetween(sky.left + 10, sky.right - 10),
              y: Phaser.Math.FloatBetween(sky.top + 8, sky.bottom - 16),
            };
            const dx = Math.min(56, sky.right - 12 - start.x);
            const dy = Math.min(44, sky.bottom - 12 - start.y);
            if (dx < 12 || dy < 10) return;
            const meteorKey =
              this.textures.exists("meteor-gold") && this.atmosphere().flameKey === "gold"
                ? "meteor-gold"
                : this.textures.exists("meteor-cyan")
                  ? "meteor-cyan"
                  : null;
            const streak = meteorKey
              ? this.add
                  .image(start.x, start.y, meteorKey)
                  .setAngle(Phaser.Math.RadToDeg(Math.atan2(dy, dx)))
                  .setOrigin(0, 0.5)
                  .setScale(Phaser.Math.FloatBetween(0.42, 0.58))
              : this.add
                  .rectangle(start.x, start.y, Math.min(28, dx), 2.4, tint, 0.9)
                  .setAngle(Phaser.Math.RadToDeg(Math.atan2(dy, dx)))
                  .setOrigin(0, 0.5);
            streak.setBlendMode(ADD);
            streak.setDepth(-16).setMask(skyMask);
            this.tweens.add({
              targets: streak,
              x: start.x + dx,
              y: start.y + dy,
              alpha: 0,
              duration: 380 + Math.random() * 160,
              onComplete: () => streak.destroy(),
            });
          },
        });
      }
      return;
    }

    if (kind === "dust" || kind === "golddust") {
      const dustKeys = ["dust-mote", "dust-flake", "dust-wisp"].filter((key) =>
        this.textures.exists(key),
      );
      const live = [];
      const maxDust = 16;
      const drift = () => {
        if (this.ended || dustKeys.length === 0) return;
        for (let i = live.length - 1; i >= 0; i -= 1) {
          if (!live[i].active) live.splice(i, 1);
        }
        if (live.length >= maxDust) return;
        const start = spawnInDoor();
        const mote = this.add
          .image(start.x, start.y, Phaser.Utils.Array.GetRandom(dustKeys))
          .setDepth(-16)
          .setAlpha(0.75)
          .setScale(Phaser.Math.FloatBetween(0.22, 0.4))
          .setAngle(Phaser.Math.Between(0, 360));
        mote.setMask(mask);
        live.push(mote);
        this.tweens.add({
          targets: mote,
          x: start.x + Phaser.Math.FloatBetween(-10, 14),
          y: start.y + Phaser.Math.FloatBetween(36, 70),
          alpha: 0,
          angle: mote.angle + Phaser.Math.Between(-24, 24),
          duration: Phaser.Math.Between(1800, 3000),
          onComplete: () => mote.destroy(),
        });
      };
      for (let i = 0; i < maxDust; i += 1) drift();
      this.time.addEvent({ delay: 180, loop: true, callback: drift });
      return;
    }

    if (kind === "wisps") {
      const wispKeys = ["wisp-curl", "wisp-puff", "wisp-rise"].filter((key) =>
        this.textures.exists(key),
      );
      const live = [];
      const maxWisps = 12;
      const drift = () => {
        if (this.ended || wispKeys.length === 0) return;
        for (let i = live.length - 1; i >= 0; i -= 1) {
          if (!live[i].active) live.splice(i, 1);
        }
        if (live.length >= maxWisps) return;
        const start = spawnInDoor();
        const wisp = this.add
          .image(start.x, start.y, Phaser.Utils.Array.GetRandom(wispKeys))
          .setDepth(-16)
          .setAlpha(0.55)
          .setScale(Phaser.Math.FloatBetween(0.28, 0.48));
        wisp.setBlendMode(ADD);
        wisp.setMask(mask);
        live.push(wisp);
        this.tweens.add({
          targets: wisp,
          x: start.x + Phaser.Math.FloatBetween(-12, 12),
          y: start.y - Phaser.Math.FloatBetween(28, 56),
          alpha: 0,
          scale: wisp.scale * 1.15,
          duration: Phaser.Math.Between(1800, 3000),
          onComplete: () => wisp.destroy(),
        });
      };
      for (let i = 0; i < maxWisps; i += 1) drift();
      this.time.addEvent({ delay: 220, loop: true, callback: drift });
      return;
    }

    if (kind === "embers") {
      const emberKeys = ["ember-core", "ember-flake", "ember-glow"].filter((key) =>
        this.textures.exists(key),
      );
      const live = [];
      const maxEmbers = 14;
      const drift = () => {
        if (this.ended || emberKeys.length === 0) return;
        for (let i = live.length - 1; i >= 0; i -= 1) {
          if (!live[i].active) live.splice(i, 1);
        }
        if (live.length >= maxEmbers) return;
        const start = spawnInDoor();
        const ember = this.add
          .image(start.x, start.y, Phaser.Utils.Array.GetRandom(emberKeys))
          .setDepth(-16)
          .setAlpha(0.8)
          .setScale(Phaser.Math.FloatBetween(0.22, 0.4));
        ember.setBlendMode(ADD);
        ember.setMask(mask);
        live.push(ember);
        this.tweens.add({
          targets: ember,
          x: start.x + Phaser.Math.FloatBetween(-10, 10),
          y: start.y - Phaser.Math.FloatBetween(32, 62),
          alpha: 0,
          duration: Phaser.Math.Between(1400, 2400),
          onComplete: () => ember.destroy(),
        });
      };
      for (let i = 0; i < maxEmbers; i += 1) drift();
      this.time.addEvent({ delay: 160, loop: true, callback: drift });
      return;
    }

    // sparks
    clip(
      this.add.particles(cx, cy, "spark", {
        x: { min: -hw + 8, max: hw - 8 },
        y: { min: -hh + 8, max: hh - 8 },
        lifespan: { min: 900, max: 2000 },
        speedY: { min: 4, max: 16 },
        speedX: { min: -8, max: 8 },
        scale: { start: 0.65, end: 0 },
        alpha: { start: 0.8, end: 0 },
        frequency: 70,
        tint,
        blendMode: "ADD",
        deathZone,
      }),
    );
  }

  drawDefaultArena() {
    const w = GAME.width;
    const h = GAME.height;
    const horizon = 96;
    const vpX = w / 2;
    const vpY = horizon - 10;
    const t = this.temple;

    const sky = this.add.graphics().setDepth(-20);
    sky.fillGradientStyle(t.skyTop, t.skyTop, t.skyBottom, t.skyBottom, 1);
    sky.fillRect(0, 0, w, horizon + 40);

    sky.fillStyle(t.hillFar, 1);
    sky.fillEllipse(w * 0.25, horizon + 8, 280, 48);
    sky.fillEllipse(w * 0.7, horizon + 4, 340, 56);
    sky.fillStyle(t.hillNear, 1);
    sky.fillEllipse(w * 0.5, horizon + 18, 420, 40);

    const bg = this.add.graphics().setDepth(-10);
    bg.fillStyle(t.ground, 1);
    bg.fillRect(0, horizon, w, h - horizon);

    bg.lineStyle(1, t.groundAccent, 0.4);
    const cols = 14;
    for (let i = 0; i <= cols; i += 1) {
      const bottomX = Phaser.Math.Linear(-80, w + 80, i / cols);
      bg.lineBetween(bottomX, h, vpX, vpY);
    }
    for (let i = 0; i < 12; i += 1) {
      const y = Phaser.Math.Linear(horizon + 20, h - 8, (i / 11) * (i / 11));
      const widthAtY = Phaser.Math.Linear(120, w + 100, (y - horizon) / (h - horizon));
      bg.lineBetween(vpX - widthAtY / 2, y, vpX + widthAtY / 2, y);
    }

    this.drawSacredRings(this.patchAnchor.x, this.patchAnchor.y);

    const veil = this.add.graphics().setDepth(-5);
    veil.fillStyle(0x000000, 0.18);
    veil.fillRect(0, 0, 40, h);
    veil.fillRect(w - 40, 0, 40, h);
  }

  /** 白羊宫 — painted dark hall backdrop + light gameplay overlays. */
  drawAriesTemple() {
    const w = GAME.width;
    const h = GAME.height;
    const t = this.temple;
    const cx = w / 2;
    const px = this.patchAnchor.x;
    const py = this.patchAnchor.y;

    this.add
      .image(cx, h / 2, "aries-temple")
      .setDisplaySize(w, h)
      .setDepth(-22);

    // Aries house seal above the doorway
    this.drawAriesHouseIcon(t.iconX ?? cx, t.iconY ?? 132, 1);

    // Soft wash around the floor medallion / broccoli
    const wash = this.add.graphics().setDepth(-12);
    wash.fillStyle(0x000000, 0.16);
    wash.fillEllipse(px, py + 20, 640, 260);
    wash.fillStyle(t.accent ?? 0xe8c890, 0.06);
    wash.fillEllipse(px, py + 10, 340, 130);

    // Floor seal under the broccoli (Aries medallion)
    const seal = this.add.graphics().setDepth(-11);
    seal.lineStyle(3, t.accent ?? 0xe8c890, 0.45);
    this.strokeFloorRing(seal, px, py + 6, 54, 0.32);
    seal.lineStyle(1.5, t.ringPrimary ?? 0xd8d0b8, 0.35);
    this.strokeFloorRing(seal, px, py + 6, 42, 0.32);
    // Tiny ram horns on the floor seal
    seal.lineStyle(3, t.accent ?? 0xe8c890, 0.5);
    seal.beginPath();
    seal.arc(px - 10, py - 4, 14, Math.PI * 0.85, -0.15, false);
    seal.strokePath();
    seal.beginPath();
    seal.arc(px + 10, py - 4, 14, Math.PI * 1.15, Math.PI + 0.15, true);
    seal.strokePath();

    // Sacred rings around broccoli
    this.drawSacredRings(px, py);

    // Edge vignette
    const veil = this.add.graphics().setDepth(-5);
    veil.fillStyle(0x080a10, 0.28);
    veil.fillRect(0, 0, 36, h);
    veil.fillRect(w - 36, 0, 36, h);
    veil.fillStyle(0x080a10, 0.16);
    veil.fillRect(0, 0, w, 28);
  }

  /** Golden Aries (♈) house icon for the temple wall. */
  drawAriesHouseIcon(x, y, scale = 1) {
    const t = this.temple;
    const g = this.add.graphics().setDepth(-15);
    const s = scale;
    const gold = t.accent ?? 0xe8c890;
    const bright = 0xfff0c8;

    // Outer medallion
    g.fillStyle(0x1a1820, 0.75);
    g.fillCircle(x, y, 44 * s);
    g.lineStyle(3 * s, gold, 0.95);
    g.strokeCircle(x, y, 44 * s);
    g.lineStyle(1.5 * s, bright, 0.55);
    g.strokeCircle(x, y, 36 * s);

    // Stylized ram head
    g.fillStyle(gold, 0.92);
    g.fillEllipse(x, y + 4 * s, 28 * s, 18 * s);
    g.fillCircle(x, y - 2 * s, 11 * s);

    // Curl horns
    g.lineStyle(4.5 * s, bright, 0.95);
    g.beginPath();
    g.arc(x - 8 * s, y - 10 * s, 14 * s, Math.PI * 0.7, Math.PI * 1.85, false);
    g.strokePath();
    g.beginPath();
    g.arc(x + 8 * s, y - 10 * s, 14 * s, Math.PI * 1.3, Math.PI * 0.15, true);
    g.strokePath();

    // Zodiac glyph tucked under the ram head
    this.add
      .text(x, y + 16 * s, "♈", {
        fontFamily: "Georgia, 'Times New Roman', serif",
        fontSize: `${Math.round(18 * s)}px`,
        color: "#f0e0a8",
      })
      .setOrigin(0.5)
      .setDepth(-14)
      .setAlpha(0.95);
  }

  /** 金牛宫 — painted warm hall backdrop + bull seal overlays. */
  drawTaurusTemple() {
    const w = GAME.width;
    const h = GAME.height;
    const t = this.temple;
    const cx = w / 2;
    const px = this.patchAnchor.x;
    const py = this.patchAnchor.y;

    this.add
      .image(cx, h / 2, "taurus-temple")
      .setDisplaySize(w, h)
      .setDepth(-22);

    this.drawTaurusHouseIcon(t.iconX ?? cx, t.iconY ?? 132, 1);

    const wash = this.add.graphics().setDepth(-12);
    wash.fillStyle(0x000000, 0.14);
    wash.fillEllipse(px, py + 22, 640, 260);
    wash.fillStyle(t.accent ?? 0xd4a85a, 0.07);
    wash.fillEllipse(px, py + 12, 360, 140);

    // Floor bull medallion under the broccoli
    const seal = this.add.graphics().setDepth(-11);
    seal.lineStyle(3.5, t.accent ?? 0xd4a85a, 0.5);
    this.strokeFloorRing(seal, px, py + 6, 56, 0.32);
    seal.lineStyle(1.6, t.ringPrimary ?? 0xe0c080, 0.4);
    this.strokeFloorRing(seal, px, py + 6, 44, 0.32);
    // Twin bull horns on the floor seal
    seal.lineStyle(4, t.accent ?? 0xd4a85a, 0.65);
    seal.beginPath();
    seal.moveTo(px - 6, py + 2);
    seal.lineTo(px - 22, py - 18);
    seal.lineTo(px - 10, py - 8);
    seal.strokePath();
    seal.beginPath();
    seal.moveTo(px + 6, py + 2);
    seal.lineTo(px + 22, py - 18);
    seal.lineTo(px + 10, py - 8);
    seal.strokePath();

    this.drawSacredRings(px, py);

    const veil = this.add.graphics().setDepth(-5);
    veil.fillStyle(0x100808, 0.26);
    veil.fillRect(0, 0, 36, h);
    veil.fillRect(w - 36, 0, 36, h);
    veil.fillStyle(0x100808, 0.14);
    veil.fillRect(0, 0, w, 28);
  }

  /** Golden Taurus (♉) house icon for the temple wall. */
  drawTaurusHouseIcon(x, y, scale = 1) {
    const t = this.temple;
    const g = this.add.graphics().setDepth(-15);
    const s = scale;
    const gold = t.accent ?? 0xd4a85a;
    const bright = 0xffe8a8;

    g.fillStyle(0x1a1410, 0.78);
    g.fillCircle(x, y, 44 * s);
    g.lineStyle(3 * s, gold, 0.95);
    g.strokeCircle(x, y, 44 * s);
    g.lineStyle(1.5 * s, bright, 0.55);
    g.strokeCircle(x, y, 36 * s);

    // Heavy bull head
    g.fillStyle(gold, 0.94);
    g.fillEllipse(x, y + 6 * s, 30 * s, 20 * s);
    g.fillCircle(x, y + 2 * s, 12 * s);

    // Straight powerful horns
    g.lineStyle(5 * s, bright, 0.95);
    g.beginPath();
    g.moveTo(x - 10 * s, y - 2 * s);
    g.lineTo(x - 28 * s, y - 22 * s);
    g.strokePath();
    g.beginPath();
    g.moveTo(x + 10 * s, y - 2 * s);
    g.lineTo(x + 28 * s, y - 22 * s);
    g.strokePath();
    g.fillStyle(bright, 0.95);
    g.fillCircle(x - 28 * s, y - 22 * s, 3 * s);
    g.fillCircle(x + 28 * s, y - 22 * s, 3 * s);

    this.add
      .text(x, y + 18 * s, "♉", {
        fontFamily: "Georgia, 'Times New Roman', serif",
        fontSize: `${Math.round(18 * s)}px`,
        color: "#f0d090",
      })
      .setOrigin(0.5)
      .setDepth(-14)
      .setAlpha(0.95);
  }

  /** 双子宫 — painted cool twin hall + cyan Cosmo overlays. */
  drawGeminiTemple() {
    const w = GAME.width;
    const h = GAME.height;
    const t = this.temple;
    const cx = w / 2;
    const px = this.patchAnchor.x;
    const py = this.patchAnchor.y;

    this.add
      .image(cx, h / 2, "gemini-temple")
      .setDisplaySize(w, h)
      .setDepth(-22);

    this.drawGeminiHouseIcon(t.iconX ?? cx, t.iconY ?? 132, 1);

    const wash = this.add.graphics().setDepth(-12);
    wash.fillStyle(0x000000, 0.14);
    wash.fillEllipse(px, py + 22, 640, 260);
    wash.fillStyle(t.accent ?? 0x6ec8e0, 0.07);
    wash.fillEllipse(px, py + 12, 360, 140);

    // Floor twin medallion under the broccoli
    const seal = this.add.graphics().setDepth(-11);
    seal.lineStyle(3.2, t.accent ?? 0x6ec8e0, 0.5);
    this.strokeFloorRing(seal, px, py + 6, 56, 0.32);
    seal.lineStyle(1.6, t.ringSecondary ?? 0xd4b45a, 0.4);
    this.strokeFloorRing(seal, px, py + 6, 44, 0.32);
    // Twin dots (Castor & Pollux)
    seal.fillStyle(t.accent ?? 0x6ec8e0, 0.7);
    seal.fillCircle(px - 12, py + 2, 5);
    seal.fillCircle(px + 12, py + 2, 5);
    seal.lineStyle(2, t.ringSecondary ?? 0xd4b45a, 0.65);
    seal.lineBetween(px - 12, py + 2, px + 12, py + 2);

    this.drawSacredRings(px, py);

    const veil = this.add.graphics().setDepth(-5);
    veil.fillStyle(0x061018, 0.28);
    veil.fillRect(0, 0, 36, h);
    veil.fillRect(w - 36, 0, 36, h);
    veil.fillStyle(0x061018, 0.16);
    veil.fillRect(0, 0, w, 28);
  }

  /** Cyan-gold Gemini (♊) house icon for the temple wall. */
  drawGeminiHouseIcon(x, y, scale = 1) {
    const t = this.temple;
    const g = this.add.graphics().setDepth(-15);
    const s = scale;
    const cyan = t.accent ?? 0x6ec8e0;
    const gold = 0xd4b45a;
    const bright = 0xe8f8ff;

    g.fillStyle(0x101820, 0.78);
    g.fillCircle(x, y, 44 * s);
    g.lineStyle(3 * s, cyan, 0.95);
    g.strokeCircle(x, y, 44 * s);
    g.lineStyle(1.5 * s, gold, 0.55);
    g.strokeCircle(x, y, 36 * s);

    // Twin pillars / II motif
    g.lineStyle(5 * s, bright, 0.95);
    g.lineBetween(x - 12 * s, y - 16 * s, x - 12 * s, y + 10 * s);
    g.lineBetween(x + 12 * s, y - 16 * s, x + 12 * s, y + 10 * s);
    g.lineStyle(3 * s, gold, 0.9);
    g.lineBetween(x - 20 * s, y - 16 * s, x + 20 * s, y - 16 * s);
    g.lineBetween(x - 20 * s, y + 10 * s, x + 20 * s, y + 10 * s);

    this.add
      .text(x, y + 18 * s, "♊", {
        fontFamily: "Georgia, 'Times New Roman', serif",
        fontSize: `${Math.round(18 * s)}px`,
        color: "#b8e8f8",
      })
      .setOrigin(0.5)
      .setDepth(-14)
      .setAlpha(0.95);
  }

  /** 巨蟹宫 — painted violet underworld hall + crab seal overlays. */
  drawCancerTemple() {
    const w = GAME.width;
    const h = GAME.height;
    const t = this.temple;
    const cx = w / 2;
    const px = this.patchAnchor.x;
    const py = this.patchAnchor.y;

    this.add
      .image(cx, h / 2, "cancer-temple")
      .setDisplaySize(w, h)
      .setDepth(-22);

    this.drawCancerHouseIcon(t.iconX ?? cx, t.iconY ?? 132, 1);

    const wash = this.add.graphics().setDepth(-12);
    wash.fillStyle(0x000000, 0.16);
    wash.fillEllipse(px, py + 22, 640, 260);
    wash.fillStyle(t.accent ?? 0xc9a0e0, 0.07);
    wash.fillEllipse(px, py + 12, 360, 140);

    const seal = this.add.graphics().setDepth(-11);
    seal.lineStyle(3.2, t.accent ?? 0xc9a0e0, 0.5);
    this.strokeFloorRing(seal, px, py + 6, 56, 0.32);
    seal.lineStyle(1.6, t.ringSecondary ?? 0x6a40a0, 0.4);
    this.strokeFloorRing(seal, px, py + 6, 44, 0.32);
    // Stylized crab claws on the floor seal
    seal.lineStyle(3.5, t.accent ?? 0xc9a0e0, 0.65);
    seal.beginPath();
    seal.moveTo(px - 6, py + 4);
    seal.lineTo(px - 22, py - 10);
    seal.lineTo(px - 14, py + 2);
    seal.strokePath();
    seal.beginPath();
    seal.moveTo(px + 6, py + 4);
    seal.lineTo(px + 22, py - 10);
    seal.lineTo(px + 14, py + 2);
    seal.strokePath();

    this.drawSacredRings(px, py);

    const veil = this.add.graphics().setDepth(-5);
    veil.fillStyle(0x100818, 0.3);
    veil.fillRect(0, 0, 36, h);
    veil.fillRect(w - 36, 0, 36, h);
    veil.fillStyle(0x100818, 0.16);
    veil.fillRect(0, 0, w, 28);
  }

  /** Violet Cancer (♋) house icon for the temple wall. */
  drawCancerHouseIcon(x, y, scale = 1) {
    const t = this.temple;
    const g = this.add.graphics().setDepth(-15);
    const s = scale;
    const violet = t.accent ?? 0xc9a0e0;
    const deep = 0x6a40a0;
    const bright = 0xf0e0ff;

    g.fillStyle(0x141018, 0.78);
    g.fillCircle(x, y, 44 * s);
    g.lineStyle(3 * s, violet, 0.95);
    g.strokeCircle(x, y, 44 * s);
    g.lineStyle(1.5 * s, deep, 0.55);
    g.strokeCircle(x, y, 36 * s);

    // Crab body + claws
    g.fillStyle(violet, 0.92);
    g.fillEllipse(x, y + 4 * s, 22 * s, 14 * s);
    g.lineStyle(4 * s, bright, 0.95);
    g.beginPath();
    g.moveTo(x - 8 * s, y);
    g.lineTo(x - 24 * s, y - 14 * s);
    g.lineTo(x - 14 * s, y + 2 * s);
    g.strokePath();
    g.beginPath();
    g.moveTo(x + 8 * s, y);
    g.lineTo(x + 24 * s, y - 14 * s);
    g.lineTo(x + 14 * s, y + 2 * s);
    g.strokePath();

    this.add
      .text(x, y + 18 * s, "♋", {
        fontFamily: "Georgia, 'Times New Roman', serif",
        fontSize: `${Math.round(18 * s)}px`,
        color: "#e0c8f8",
      })
      .setOrigin(0.5)
      .setDepth(-14)
      .setAlpha(0.95);
  }

  /** 狮子宫 — painted sunlit lion hall + gold seal overlays. */
  drawLeoTemple() {
    const w = GAME.width;
    const h = GAME.height;
    const t = this.temple;
    const cx = w / 2;
    const px = this.patchAnchor.x;
    const py = this.patchAnchor.y;

    this.add
      .image(cx, h / 2, "leo-temple")
      .setDisplaySize(w, h)
      .setDepth(-22);

    this.drawLeoHouseIcon(t.iconX ?? cx, t.iconY ?? 132, 1);

    const wash = this.add.graphics().setDepth(-12);
    wash.fillStyle(0x000000, 0.14);
    wash.fillEllipse(px, py + 22, 640, 260);
    wash.fillStyle(t.accent ?? 0xffc04a, 0.08);
    wash.fillEllipse(px, py + 12, 360, 140);

    const seal = this.add.graphics().setDepth(-11);
    seal.lineStyle(3.2, t.accent ?? 0xffc04a, 0.5);
    this.strokeFloorRing(seal, px, py + 6, 56, 0.32);
    seal.lineStyle(1.6, t.ringPrimary ?? 0xffe082, 0.4);
    this.strokeFloorRing(seal, px, py + 6, 44, 0.32);
    // Lion mane rays on the floor seal
    seal.lineStyle(2.4, t.accent ?? 0xffc04a, 0.6);
    for (let i = 0; i < 8; i += 1) {
      const a = (Math.PI * 2 * i) / 8 - Math.PI / 2;
      seal.lineBetween(
        px + Math.cos(a) * 16,
        py + 4 + Math.sin(a) * 10,
        px + Math.cos(a) * 28,
        py + 4 + Math.sin(a) * 18,
      );
    }

    this.drawSacredRings(px, py);

    const veil = this.add.graphics().setDepth(-5);
    veil.fillStyle(0x140c08, 0.26);
    veil.fillRect(0, 0, 36, h);
    veil.fillRect(w - 36, 0, 36, h);
    veil.fillStyle(0x140c08, 0.14);
    veil.fillRect(0, 0, w, 28);
  }

  /** Golden Leo (♌) house icon for the temple wall. */
  drawLeoHouseIcon(x, y, scale = 1) {
    const t = this.temple;
    const g = this.add.graphics().setDepth(-15);
    const s = scale;
    const gold = t.accent ?? 0xffc04a;
    const bright = 0xfff1a8;

    g.fillStyle(0x1a1208, 0.78);
    g.fillCircle(x, y, 44 * s);
    g.lineStyle(3 * s, gold, 0.95);
    g.strokeCircle(x, y, 44 * s);
    g.lineStyle(1.5 * s, bright, 0.55);
    g.strokeCircle(x, y, 36 * s);

    // Lion head + mane
    g.fillStyle(gold, 0.94);
    g.fillCircle(x, y + 2 * s, 12 * s);
    g.lineStyle(3.2 * s, bright, 0.9);
    for (let i = 0; i < 10; i += 1) {
      const a = (Math.PI * 2 * i) / 10 - Math.PI / 2;
      g.beginPath();
      g.moveTo(x + Math.cos(a) * 12 * s, y + 2 * s + Math.sin(a) * 11 * s);
      g.lineTo(x + Math.cos(a) * 24 * s, y + 2 * s + Math.sin(a) * 22 * s);
      g.strokePath();
    }

    this.add
      .text(x, y + 18 * s, "♌", {
        fontFamily: "Georgia, 'Times New Roman', serif",
        fontSize: `${Math.round(18 * s)}px`,
        color: "#ffe090",
      })
      .setOrigin(0.5)
      .setDepth(-14)
      .setAlpha(0.95);
  }

  /** 处女宫 — painted lotus hall + dharma-wheel overlays. */
  drawVirgoTemple() {
    const w = GAME.width;
    const h = GAME.height;
    const t = this.temple;
    const cx = w / 2;
    const px = this.patchAnchor.x;
    const py = this.patchAnchor.y;

    this.add
      .image(cx, h / 2, "virgo-temple")
      .setDisplaySize(w, h)
      .setDepth(-22);

    this.drawVirgoHouseIcon(t.iconX ?? cx, t.iconY ?? 132, 1);

    const wash = this.add.graphics().setDepth(-12);
    wash.fillStyle(0x000000, 0.12);
    wash.fillEllipse(px, py + 22, 640, 260);
    wash.fillStyle(t.accent ?? 0xe8d48a, 0.08);
    wash.fillEllipse(px, py + 12, 360, 140);

    const seal = this.add.graphics().setDepth(-11);
    seal.lineStyle(3.2, t.accent ?? 0xe8d48a, 0.5);
    this.strokeFloorRing(seal, px, py + 6, 56, 0.32);
    seal.lineStyle(1.6, t.ringPrimary ?? 0xffe8b0, 0.4);
    this.strokeFloorRing(seal, px, py + 6, 44, 0.32);
    // Lotus petals on the floor seal
    seal.lineStyle(2, t.accent ?? 0xe8d48a, 0.55);
    for (let i = 0; i < 8; i += 1) {
      const a = (Math.PI * 2 * i) / 8 - Math.PI / 2;
      seal.strokeEllipse(
        px + Math.cos(a) * 18,
        py + 4 + Math.sin(a) * 12,
        14,
        8,
      );
    }

    this.drawSacredRings(px, py);

    const veil = this.add.graphics().setDepth(-5);
    veil.fillStyle(0x14100c, 0.22);
    veil.fillRect(0, 0, 36, h);
    veil.fillRect(w - 36, 0, 36, h);
    veil.fillStyle(0x14100c, 0.12);
    veil.fillRect(0, 0, w, 28);
  }

  /** Golden Virgo (♍) house icon for the temple wall. */
  drawVirgoHouseIcon(x, y, scale = 1) {
    const t = this.temple;
    const g = this.add.graphics().setDepth(-15);
    const s = scale;
    const gold = t.accent ?? 0xe8d48a;
    const bright = 0xfff4d0;

    g.fillStyle(0x16120c, 0.78);
    g.fillCircle(x, y, 44 * s);
    g.lineStyle(3 * s, gold, 0.95);
    g.strokeCircle(x, y, 44 * s);
    g.lineStyle(1.5 * s, bright, 0.55);
    g.strokeCircle(x, y, 36 * s);

    // Dharma wheel
    g.lineStyle(2.4 * s, bright, 0.95);
    g.strokeCircle(x, y - 2 * s, 16 * s);
    for (let i = 0; i < 8; i += 1) {
      const a = (Math.PI * 2 * i) / 8;
      g.lineBetween(
        x + Math.cos(a) * 5 * s,
        y - 2 * s + Math.sin(a) * 5 * s,
        x + Math.cos(a) * 16 * s,
        y - 2 * s + Math.sin(a) * 16 * s,
      );
    }
    g.fillStyle(gold, 0.95);
    g.fillCircle(x, y - 2 * s, 4 * s);

    this.add
      .text(x, y + 18 * s, "♍", {
        fontFamily: "Georgia, 'Times New Roman', serif",
        fontSize: `${Math.round(18 * s)}px`,
        color: "#f0e0a8",
      })
      .setOrigin(0.5)
      .setDepth(-14)
      .setAlpha(0.95);
  }

  /** 天秤宫 — painted balanced hall + scales overlays. */
  drawLibraTemple() {
    const w = GAME.width;
    const h = GAME.height;
    const t = this.temple;
    const cx = w / 2;
    const px = this.patchAnchor.x;
    const py = this.patchAnchor.y;

    this.add
      .image(cx, h / 2, "libra-temple")
      .setDisplaySize(w, h)
      .setDepth(-22);

    this.drawLibraHouseIcon(t.iconX ?? cx, t.iconY ?? 132, 1);

    const wash = this.add.graphics().setDepth(-12);
    wash.fillStyle(0x000000, 0.14);
    wash.fillEllipse(px, py + 22, 640, 260);
    wash.fillStyle(t.accent ?? 0xc8b070, 0.07);
    wash.fillEllipse(px, py + 12, 360, 140);

    const seal = this.add.graphics().setDepth(-11);
    seal.lineStyle(3.2, t.accent ?? 0xc8b070, 0.5);
    this.strokeFloorRing(seal, px, py + 6, 56, 0.32);
    seal.lineStyle(1.6, t.ringPrimary ?? 0xe8d090, 0.4);
    this.strokeFloorRing(seal, px, py + 6, 44, 0.32);
    // Tiny scales on the floor seal
    seal.lineStyle(2.4, t.accent ?? 0xc8b070, 0.65);
    seal.lineBetween(px - 22, py - 2, px + 22, py - 2);
    seal.lineBetween(px, py - 10, px, py + 10);
    seal.strokeCircle(px - 18, py + 8, 8);
    seal.strokeCircle(px + 18, py + 8, 8);

    this.drawSacredRings(px, py);

    const veil = this.add.graphics().setDepth(-5);
    veil.fillStyle(0x120e08, 0.24);
    veil.fillRect(0, 0, 36, h);
    veil.fillRect(w - 36, 0, 36, h);
    veil.fillStyle(0x120e08, 0.12);
    veil.fillRect(0, 0, w, 28);
  }

  /** Golden Libra (♎) house icon for the temple wall. */
  drawLibraHouseIcon(x, y, scale = 1) {
    const t = this.temple;
    const g = this.add.graphics().setDepth(-15);
    const s = scale;
    const gold = t.accent ?? 0xc8b070;
    const bright = 0xfff0c8;

    g.fillStyle(0x161208, 0.78);
    g.fillCircle(x, y, 44 * s);
    g.lineStyle(3 * s, gold, 0.95);
    g.strokeCircle(x, y, 44 * s);
    g.lineStyle(1.5 * s, bright, 0.55);
    g.strokeCircle(x, y, 36 * s);

    // Balance beam + pans
    g.lineStyle(3.2 * s, bright, 0.95);
    g.lineBetween(x - 22 * s, y - 4 * s, x + 22 * s, y - 4 * s);
    g.lineBetween(x, y - 14 * s, x, y + 10 * s);
    g.lineStyle(2.2 * s, gold, 0.95);
    g.strokeCircle(x - 18 * s, y + 8 * s, 8 * s);
    g.strokeCircle(x + 18 * s, y + 8 * s, 8 * s);

    this.add
      .text(x, y + 18 * s, "♎", {
        fontFamily: "Georgia, 'Times New Roman', serif",
        fontSize: `${Math.round(18 * s)}px`,
        color: "#f0e0a8",
      })
      .setOrigin(0.5)
      .setDepth(-14)
      .setAlpha(0.95);
  }

  /** 天蝎宫 — painted crimson hunter hall + scorpion overlays. */
  drawScorpioTemple() {
    const w = GAME.width;
    const h = GAME.height;
    const t = this.temple;
    const cx = w / 2;
    const px = this.patchAnchor.x;
    const py = this.patchAnchor.y;

    this.add
      .image(cx, h / 2, "scorpio-temple")
      .setDisplaySize(w, h)
      .setDepth(-22);

    this.drawScorpioHouseIcon(t.iconX ?? cx, t.iconY ?? 132, 1);

    const wash = this.add.graphics().setDepth(-12);
    wash.fillStyle(0x000000, 0.16);
    wash.fillEllipse(px, py + 22, 640, 260);
    wash.fillStyle(t.accent ?? 0xe05a6a, 0.07);
    wash.fillEllipse(px, py + 12, 360, 140);

    const seal = this.add.graphics().setDepth(-11);
    seal.lineStyle(3.2, t.accent ?? 0xe05a6a, 0.5);
    this.strokeFloorRing(seal, px, py + 6, 56, 0.32);
    seal.lineStyle(1.6, t.ringSecondary ?? 0xc8a060, 0.4);
    this.strokeFloorRing(seal, px, py + 6, 44, 0.32);
    // Stinger curl on the floor seal
    seal.lineStyle(3, t.accent ?? 0xe05a6a, 0.7);
    seal.beginPath();
    seal.moveTo(px - 10, py + 8);
    seal.lineTo(px + 8, py + 4);
    seal.lineTo(px + 16, py - 10);
    seal.strokePath();
    seal.fillStyle(t.accent ?? 0xe05a6a, 0.8);
    seal.fillCircle(px + 18, py - 14, 3.5);

    this.drawSacredRings(px, py);

    const veil = this.add.graphics().setDepth(-5);
    veil.fillStyle(0x14080c, 0.28);
    veil.fillRect(0, 0, 36, h);
    veil.fillRect(w - 36, 0, 36, h);
    veil.fillStyle(0x14080c, 0.14);
    veil.fillRect(0, 0, w, 28);
  }

  /** Crimson Scorpio (♏) house icon for the temple wall. */
  drawScorpioHouseIcon(x, y, scale = 1) {
    const t = this.temple;
    const g = this.add.graphics().setDepth(-15);
    const s = scale;
    const scarlet = t.accent ?? 0xe05a6a;
    const gold = 0xc8a060;
    const bright = 0xffc0c8;

    g.fillStyle(0x18080c, 0.78);
    g.fillCircle(x, y, 44 * s);
    g.lineStyle(3 * s, scarlet, 0.95);
    g.strokeCircle(x, y, 44 * s);
    g.lineStyle(1.5 * s, gold, 0.55);
    g.strokeCircle(x, y, 36 * s);

    // Scorpion body + raised tail
    g.fillStyle(scarlet, 0.94);
    g.fillEllipse(x - 4 * s, y + 4 * s, 22 * s, 12 * s);
    g.lineStyle(3.4 * s, bright, 0.95);
    g.beginPath();
    g.moveTo(x + 6 * s, y + 2 * s);
    g.lineTo(x + 16 * s, y - 8 * s);
    g.lineTo(x + 10 * s, y - 18 * s);
    g.strokePath();
    g.fillStyle(bright, 0.95);
    g.fillCircle(x + 10 * s, y - 20 * s, 3.2 * s);

    this.add
      .text(x, y + 18 * s, "♏", {
        fontFamily: "Georgia, 'Times New Roman', serif",
        fontSize: `${Math.round(18 * s)}px`,
        color: "#ffc0c8",
      })
      .setOrigin(0.5)
      .setDepth(-14)
      .setAlpha(0.95);
  }

  /** 人马宫 — painted heroic archer hall + gold overlays. */
  drawSagittariusTemple() {
    const w = GAME.width;
    const h = GAME.height;
    const t = this.temple;
    const cx = w / 2;
    const px = this.patchAnchor.x;
    const py = this.patchAnchor.y;

    this.add
      .image(cx, h / 2, "sagittarius-temple")
      .setDisplaySize(w, h)
      .setDepth(-22);

    this.drawSagittariusHouseIcon(t.iconX ?? cx, t.iconY ?? 132, 1);

    const wash = this.add.graphics().setDepth(-12);
    wash.fillStyle(0x000000, 0.14);
    wash.fillEllipse(px, py + 22, 640, 260);
    wash.fillStyle(t.accent ?? 0xf0c45a, 0.08);
    wash.fillEllipse(px, py + 12, 360, 140);

    const seal = this.add.graphics().setDepth(-11);
    seal.lineStyle(3.2, t.accent ?? 0xf0c45a, 0.5);
    this.strokeFloorRing(seal, px, py + 6, 56, 0.32);
    seal.lineStyle(1.6, t.ringPrimary ?? 0xffe082, 0.4);
    this.strokeFloorRing(seal, px, py + 6, 44, 0.32);
    // Bow + arrow on the floor seal
    seal.lineStyle(2.6, t.accent ?? 0xf0c45a, 0.7);
    seal.beginPath();
    seal.arc(px - 6, py + 4, 18, -1.1, 1.1, false);
    seal.strokePath();
    seal.lineBetween(px - 18, py + 4, px + 22, py + 4);
    seal.fillStyle(t.ringPrimary ?? 0xffe082, 0.85);
    seal.fillTriangle(px + 24, py + 4, px + 16, py, px + 16, py + 8);

    this.drawSacredRings(px, py);

    const veil = this.add.graphics().setDepth(-5);
    veil.fillStyle(0x140e08, 0.24);
    veil.fillRect(0, 0, 36, h);
    veil.fillRect(w - 36, 0, 36, h);
    veil.fillStyle(0x140e08, 0.12);
    veil.fillRect(0, 0, w, 28);
  }

  /** Golden Sagittarius (♐) house icon for the temple wall. */
  drawSagittariusHouseIcon(x, y, scale = 1) {
    const t = this.temple;
    const g = this.add.graphics().setDepth(-15);
    const s = scale;
    const gold = t.accent ?? 0xf0c45a;
    const bright = 0xfff1a8;

    g.fillStyle(0x181208, 0.78);
    g.fillCircle(x, y, 44 * s);
    g.lineStyle(3 * s, gold, 0.95);
    g.strokeCircle(x, y, 44 * s);
    g.lineStyle(1.5 * s, bright, 0.55);
    g.strokeCircle(x, y, 36 * s);

    // Bow + arrow
    g.lineStyle(3.2 * s, bright, 0.95);
    g.beginPath();
    g.arc(x - 4 * s, y, 18 * s, -1.15, 1.15, false);
    g.strokePath();
    g.lineStyle(2.4 * s, gold, 0.95);
    g.lineBetween(x - 20 * s, y, x + 22 * s, y);
    g.fillStyle(bright, 0.95);
    g.fillTriangle(x + 24 * s, y, x + 14 * s, y - 5 * s, x + 14 * s, y + 5 * s);

    this.add
      .text(x, y + 18 * s, "♐", {
        fontFamily: "Georgia, 'Times New Roman', serif",
        fontSize: `${Math.round(18 * s)}px`,
        color: "#ffe090",
      })
      .setOrigin(0.5)
      .setDepth(-14)
      .setAlpha(0.95);
  }

  /** 摩羯宫 — painted blade hall + goat-horn overlays. */
  drawCapricornTemple() {
    const w = GAME.width;
    const h = GAME.height;
    const t = this.temple;
    const cx = w / 2;
    const px = this.patchAnchor.x;
    const py = this.patchAnchor.y;

    this.add
      .image(cx, h / 2, "capricorn-temple")
      .setDisplaySize(w, h)
      .setDepth(-22);

    this.drawCapricornHouseIcon(t.iconX ?? cx, t.iconY ?? 132, 1);

    const wash = this.add.graphics().setDepth(-12);
    wash.fillStyle(0x000000, 0.14);
    wash.fillEllipse(px, py + 22, 640, 260);
    wash.fillStyle(t.accent ?? 0xd8d0b0, 0.08);
    wash.fillEllipse(px, py + 12, 360, 140);

    const seal = this.add.graphics().setDepth(-11);
    seal.lineStyle(3.2, t.accent ?? 0xd8d0b0, 0.5);
    this.strokeFloorRing(seal, px, py + 6, 56, 0.32);
    seal.lineStyle(1.6, t.ringPrimary ?? 0xf0e8c8, 0.4);
    this.strokeFloorRing(seal, px, py + 6, 44, 0.32);
    // Sacred sword on the floor seal
    seal.lineStyle(2.8, t.accent ?? 0xd8d0b0, 0.75);
    seal.lineBetween(px, py - 16, px, py + 18);
    seal.lineStyle(2.2, t.ringPrimary ?? 0xf0e8c8, 0.7);
    seal.lineBetween(px - 10, py - 8, px + 10, py - 8);
    seal.fillStyle(t.ringPrimary ?? 0xf0e8c8, 0.85);
    seal.fillTriangle(px, py - 20, px - 5, py - 12, px + 5, py - 12);

    this.drawSacredRings(px, py);

    const veil = this.add.graphics().setDepth(-5);
    veil.fillStyle(0x121008, 0.24);
    veil.fillRect(0, 0, 36, h);
    veil.fillRect(w - 36, 0, 36, h);
    veil.fillStyle(0x121008, 0.12);
    veil.fillRect(0, 0, w, 28);
  }

  /** Platinum Capricorn (♑) house icon for the temple wall. */
  drawCapricornHouseIcon(x, y, scale = 1) {
    const t = this.temple;
    const g = this.add.graphics().setDepth(-15);
    const s = scale;
    const steel = t.accent ?? 0xd8d0b0;
    const bright = 0xf8f0d0;

    g.fillStyle(0x141208, 0.78);
    g.fillCircle(x, y, 44 * s);
    g.lineStyle(3 * s, steel, 0.95);
    g.strokeCircle(x, y, 44 * s);
    g.lineStyle(1.5 * s, bright, 0.55);
    g.strokeCircle(x, y, 36 * s);

    // Goat horns + blade
    g.lineStyle(3.2 * s, bright, 0.95);
    g.beginPath();
    g.arc(x - 6 * s, y + 2 * s, 16 * s, 0.85, -2.15, true);
    g.strokePath();
    g.beginPath();
    g.arc(x + 6 * s, y + 2 * s, 16 * s, 2.29, -0.99, false);
    g.strokePath();
    g.lineStyle(2.6 * s, steel, 0.95);
    g.lineBetween(x, y - 8 * s, x, y + 16 * s);
    g.fillStyle(bright, 0.95);
    g.fillTriangle(x, y - 18 * s, x - 5 * s, y - 8 * s, x + 5 * s, y - 8 * s);

    this.add
      .text(x, y + 18 * s, "♑", {
        fontFamily: "Georgia, 'Times New Roman', serif",
        fontSize: `${Math.round(18 * s)}px`,
        color: "#f0e8c8",
      })
      .setOrigin(0.5)
      .setDepth(-14)
      .setAlpha(0.95);
  }

  /** 水瓶宫 — painted ice-marble hall + urn overlays. */
  drawAquariusTemple() {
    const w = GAME.width;
    const h = GAME.height;
    const t = this.temple;
    const cx = w / 2;
    const px = this.patchAnchor.x;
    const py = this.patchAnchor.y;

    this.add
      .image(cx, h / 2, "aquarius-temple")
      .setDisplaySize(w, h)
      .setDepth(-22);

    this.drawAquariusHouseIcon(t.iconX ?? cx, t.iconY ?? 132, 1);

    const wash = this.add.graphics().setDepth(-12);
    wash.fillStyle(0x000000, 0.14);
    wash.fillEllipse(px, py + 22, 640, 260);
    wash.fillStyle(t.accent ?? 0x7ec8e8, 0.08);
    wash.fillEllipse(px, py + 12, 360, 140);

    const seal = this.add.graphics().setDepth(-11);
    seal.lineStyle(3.2, t.accent ?? 0x7ec8e8, 0.5);
    this.strokeFloorRing(seal, px, py + 6, 56, 0.32);
    seal.lineStyle(1.6, t.ringPrimary ?? 0xa8e8ff, 0.4);
    this.strokeFloorRing(seal, px, py + 6, 44, 0.32);
    // Urn on the floor seal
    seal.fillStyle(t.accent ?? 0x7ec8e8, 0.55);
    seal.fillEllipse(px, py + 8, 16, 22);
    seal.fillEllipse(px, py - 6, 12, 8);
    seal.lineStyle(2, t.ringSecondary ?? 0xd4b45a, 0.7);
    seal.lineBetween(px - 4, py + 18, px - 8, py + 26);
    seal.lineBetween(px + 4, py + 18, px + 8, py + 26);

    this.drawSacredRings(px, py);

    const veil = this.add.graphics().setDepth(-5);
    veil.fillStyle(0x081418, 0.24);
    veil.fillRect(0, 0, 36, h);
    veil.fillRect(w - 36, 0, 36, h);
    veil.fillStyle(0x081418, 0.12);
    veil.fillRect(0, 0, w, 28);
  }

  /** Ice-gold Aquarius (♒) house icon for the temple wall. */
  drawAquariusHouseIcon(x, y, scale = 1) {
    const t = this.temple;
    const g = this.add.graphics().setDepth(-15);
    const s = scale;
    const ice = t.accent ?? 0x7ec8e8;
    const bright = 0xa8e8ff;
    const gold = 0xd4b45a;

    g.fillStyle(0x081418, 0.78);
    g.fillCircle(x, y, 44 * s);
    g.lineStyle(3 * s, ice, 0.95);
    g.strokeCircle(x, y, 44 * s);
    g.lineStyle(1.5 * s, gold, 0.55);
    g.strokeCircle(x, y, 36 * s);

    // Urn + pouring streams
    g.fillStyle(ice, 0.92);
    g.fillEllipse(x, y + 2 * s, 16 * s, 22 * s);
    g.fillEllipse(x, y - 12 * s, 14 * s, 8 * s);
    g.lineStyle(2.4 * s, gold, 0.95);
    g.strokeEllipse(x, y - 12 * s, 14 * s, 8 * s);
    g.lineStyle(2.2 * s, bright, 0.95);
    g.lineBetween(x - 5 * s, y + 14 * s, x - 10 * s, y + 22 * s);
    g.lineBetween(x + 5 * s, y + 14 * s, x + 10 * s, y + 22 * s);
    g.fillStyle(bright, 0.95);
    g.fillCircle(x - 10 * s, y + 24 * s, 2.2 * s);
    g.fillCircle(x + 10 * s, y + 24 * s, 2.2 * s);

    this.add
      .text(x, y + 18 * s, "♒", {
        fontFamily: "Georgia, 'Times New Roman', serif",
        fontSize: `${Math.round(18 * s)}px`,
        color: "#b8f0ff",
      })
      .setOrigin(0.5)
      .setDepth(-14)
      .setAlpha(0.95);
  }

  /** 双鱼宫 — painted rose-marble hall + fish overlays. */
  drawPiscesTemple() {
    const w = GAME.width;
    const h = GAME.height;
    const t = this.temple;
    const cx = w / 2;
    const px = this.patchAnchor.x;
    const py = this.patchAnchor.y;

    this.add
      .image(cx, h / 2, "pisces-temple")
      .setDisplaySize(w, h)
      .setDepth(-22);

    this.drawPiscesHouseIcon(t.iconX ?? cx, t.iconY ?? 132, 1);

    const wash = this.add.graphics().setDepth(-12);
    wash.fillStyle(0x000000, 0.14);
    wash.fillEllipse(px, py + 22, 640, 260);
    wash.fillStyle(t.accent ?? 0xe07098, 0.08);
    wash.fillEllipse(px, py + 12, 360, 140);

    const seal = this.add.graphics().setDepth(-11);
    seal.lineStyle(3.2, t.accent ?? 0xe07098, 0.5);
    this.strokeFloorRing(seal, px, py + 6, 56, 0.32);
    seal.lineStyle(1.6, t.ringSecondary ?? 0xd4b45a, 0.4);
    this.strokeFloorRing(seal, px, py + 6, 44, 0.32);
    // Twin fish on the floor seal
    seal.fillStyle(t.accent ?? 0xe07098, 0.7);
    seal.fillEllipse(px - 12, py + 4, 18, 8);
    seal.fillEllipse(px + 12, py + 8, 18, 8);
    seal.fillStyle(t.ringPrimary ?? 0xffb0c0, 0.85);
    seal.fillCircle(px, py + 2, 5);

    this.drawSacredRings(px, py);

    const veil = this.add.graphics().setDepth(-5);
    veil.fillStyle(0x180810, 0.24);
    veil.fillRect(0, 0, 36, h);
    veil.fillRect(w - 36, 0, 36, h);
    veil.fillStyle(0x180810, 0.12);
    veil.fillRect(0, 0, w, 28);
  }

  /** Rose-gold Pisces (♓) house icon for the temple wall. */
  drawPiscesHouseIcon(x, y, scale = 1) {
    const t = this.temple;
    const g = this.add.graphics().setDepth(-15);
    const s = scale;
    const rose = t.accent ?? 0xe07098;
    const bright = 0xffb0c0;
    const gold = 0xd4b45a;

    g.fillStyle(0x180810, 0.78);
    g.fillCircle(x, y, 44 * s);
    g.lineStyle(3 * s, rose, 0.95);
    g.strokeCircle(x, y, 44 * s);
    g.lineStyle(1.5 * s, gold, 0.55);
    g.strokeCircle(x, y, 36 * s);

    // Twin fish circling a rose
    g.fillStyle(rose, 0.94);
    g.fillEllipse(x - 10 * s, y - 4 * s, 18 * s, 8 * s);
    g.fillTriangle(x - 18 * s, y - 4 * s, x - 24 * s, y - 9 * s, x - 24 * s, y + 1 * s);
    g.fillEllipse(x + 10 * s, y + 6 * s, 18 * s, 8 * s);
    g.fillTriangle(x + 18 * s, y + 6 * s, x + 24 * s, y + 1 * s, x + 24 * s, y + 11 * s);
    g.fillStyle(bright, 0.95);
    g.fillCircle(x, y + 2 * s, 5 * s);
    g.fillStyle(gold, 0.9);
    g.fillCircle(x, y + 2 * s, 2.4 * s);

    this.add
      .text(x, y + 18 * s, "♓", {
        fontFamily: "Georgia, 'Times New Roman', serif",
        fontSize: `${Math.round(18 * s)}px`,
        color: "#ffc0d0",
      })
      .setOrigin(0.5)
      .setDepth(-14)
      .setAlpha(0.95);
  }

  createGroundShadow(width, height) {
    return this.add
      .ellipse(0, 0, width, height, 0x000000, GAME.pseudo3d.shadowAlpha)
      .setDepth(0);
  }

  presentHero() {
    const actor = this.gemini;
    if (!actor?.active) return;

    const d = this.depthAt(
      actor.x,
      actor.y,
      GAME.pseudo3d.heroFarScale,
      GAME.pseudo3d.heroNearScale,
    );
    const squash = GAME.pseudo3d.spriteSquash;
    const base = actor.baseScale ?? this.hero.scale;
    const hop = this.heroHopState.hop;
    const pulse = this.heroHopState.specialPulse;

    const vx = actor.body?.velocity?.x ?? 0;
    const vy = actor.body?.velocity?.y ?? 0;
    const speed = Math.hypot(vx, vy);
    const moving = speed > 16;

    if (moving) {
      actor.walkPhase =
        (actor.walkPhase ?? 0) +
        this.game.loop.delta * 0.018 * (speed / Math.max(40, this.hero.speed));
      if (Math.abs(vx) > 8) actor.setFlipX(vx > 0);
    }

    const stride = moving ? Math.sin(actor.walkPhase) : 0;
    const walkLift = Math.abs(stride) * 7;
    const hopLift = hop * 14;
    const lift = walkLift + hopLift;
    const sx = base * d * (1 + stride * 0.06 + hop * 0.06 + pulse * 0.12);
    const sy = base * d * squash * (1 - stride * 0.05 + hop * 0.08 + pulse * 0.12);
    actor.setScale(sx, sy);
    actor.setAngle(moving ? stride * 4 : 0);
    actor.setDisplayOrigin(actor.width * 0.5, actor.height * 0.88 + lift);
    actor.setDepth(depthOrder(actor.y, 3));

    if (this.geminiShadow?.active) {
      const land = moving ? 1 - Math.abs(stride) * 0.35 : 1;
      const hopShrink = 1 - hop * 0.45;
      this.geminiShadow.setPosition(actor.x, actor.y + 6);
      this.geminiShadow.setScale(
        d * (44 / 40) * land * hopShrink,
        d * 0.85 * (0.85 + land * 0.15) * (1 - hop * 0.25),
      );
      this.geminiShadow.setAlpha(
        GAME.pseudo3d.shadowAlpha * (0.75 + land * 0.25) * (1 - hop * 0.55),
      );
      this.geminiShadow.setDepth(depthOrder(actor.y, 0));
    }
  }

  presentEnemy(enemy) {
    if (!enemy?.active) return;
    const type = GAME.enemyTypes[enemy.enemyType];
    const d = this.depthAt(enemy.x, enemy.y);
    const squash = GAME.pseudo3d.spriteSquash;
    const base = enemy.baseScale ?? type?.scale ?? 0.85;
    const shadowW = type?.shadowW ?? 34;

    const vx = enemy.body?.velocity?.x ?? 0;
    const vy = enemy.body?.velocity?.y ?? 0;
    const speed = Math.hypot(vx, vy);
    const moving = speed > 12;

    if (moving) {
      enemy.walkPhase =
        (enemy.walkPhase ?? Math.random() * Math.PI * 2) +
        this.game.loop.delta * 0.016 * (speed / Math.max(30, enemy.speed ?? 55));
      // Sprites face left by default; flip when moving right
      if (Math.abs(vx) > 6) enemy.setFlipX(vx > 0);
    }

    const stride = moving ? Math.sin(enemy.walkPhase) : 0;
    const lift = Math.abs(stride) * 6;
    const sx = base * d * (1 + stride * 0.07);
    const sy = base * d * squash * (1 - stride * 0.06);
    enemy.setScale(sx, sy);
    enemy.setAngle(moving ? stride * 5 : 0);
    enemy.setDisplayOrigin(enemy.width * 0.5, enemy.height * 0.88 + lift);
    enemy.setDepth(depthOrder(enemy.y, 2));

    if (enemy.shadow?.active) {
      const land = moving ? 1 - Math.abs(stride) * 0.35 : 1;
      enemy.shadow.setPosition(enemy.x, enemy.y + 6);
      enemy.shadow.setScale(
        d * (shadowW / 40) * land,
        d * 0.85 * (0.85 + land * 0.15),
      );
      enemy.shadow.setAlpha(GAME.pseudo3d.shadowAlpha * (0.75 + land * 0.25));
      enemy.shadow.setDepth(depthOrder(enemy.y, 0));
    }
  }

  syncPseudo3d() {
    this.presentHero();

    for (const enemy of this.enemies.getChildren()) {
      if (!enemy.active) continue;
      this.presentEnemy(enemy);
    }

    // Broccoli + Athena presentation is refreshed in their update helpers
    this.presentBroccoli();
    this.presentAthena();

    if (this.moveMarker.visible) {
      const d = this.depthAt(this.moveMarker.x, this.moveMarker.y);
      this.moveMarker.setScale(d, d * 0.75).setDepth(depthOrder(this.moveMarker.y, 1));
      this.moveMarkerStroke.setScale(d, d * 0.75).setDepth(depthOrder(this.moveMarker.y, 1));
    }
  }

  createHud() {
    const hudDepth = 10000;
    this.add
      .text(24, 18, "PROTECT BROCCOLI", {
        fontFamily: "Georgia, 'Times New Roman', serif",
        fontSize: "22px",
        color: COLORS.hud,
      })
      .setDepth(hudDepth);

    const houseBit =
      this.temple?.id && this.temple.id !== "default" ? `  ·  ${this.temple.label}` : "";
    this.add
      .text(
        24,
        46,
        `${this.hero.name}${houseBit}  ·  Click move  ·  Double-click attack  ·  Right-click special  ·  R quit`,
        {
          fontFamily: "Georgia, 'Times New Roman', serif",
          fontSize: "14px",
          color: COLORS.hudMuted,
        },
      )
      .setDepth(hudDepth);

    this.timerText = this.add
      .text(GAME.width - 24, 22, "2:00", {
        fontFamily: "Georgia, 'Times New Roman', serif",
        fontSize: "28px",
        color: COLORS.hud,
      })
      .setOrigin(1, 0)
      .setDepth(hudDepth);

    this.patchText = this.add
      .text(GAME.width / 2, 22, "Broccoli 100%  ·  Sprout", {
        fontFamily: "Georgia, 'Times New Roman', serif",
        fontSize: "18px",
        color: COLORS.hud,
      })
      .setOrigin(0.5, 0)
      .setDepth(hudDepth);

    this.patchBarBg = this.add.rectangle(GAME.width / 2, 52, 180, 8, 0x1a1412, 0.7).setDepth(hudDepth);
    this.patchBar = this.add.rectangle(GAME.width / 2 - 90, 52, 180, 8, COLORS.broccoli, 1)
      .setOrigin(0, 0.5)
      .setDepth(hudDepth + 1);

    this.specialLabel = this.add
      .text(24, 72, `Special (${this.hero.specialName})`, {
        fontFamily: "Georgia, 'Times New Roman', serif",
        fontSize: "13px",
        color: COLORS.hudMuted,
      })
      .setDepth(hudDepth);
    this.specialBarBg = this.add.rectangle(24, 94, 180, 8, 0x1a1412, 0.7).setOrigin(0, 0.5).setDepth(hudDepth);
    this.specialBar = this.add.rectangle(24, 94, 1, 8, this.hero.accent, 1).setOrigin(0, 0.5).setDepth(hudDepth + 1);

    this.athenaHint = this.add
      .text(GAME.width - 24, 56, "Athena wakes in 15s", {
        fontFamily: "Georgia, 'Times New Roman', serif",
        fontSize: "13px",
        color: COLORS.hudMuted,
      })
      .setOrigin(1, 0)
      .setDepth(hudDepth);

    const quit = this.add
      .text(GAME.width - 24, GAME.height - 20, "R  ·  Quit", {
        fontFamily: "Georgia, 'Times New Roman', serif",
        fontSize: "14px",
        color: COLORS.hudMuted,
      })
      .setOrigin(1, 1)
      .setDepth(hudDepth)
      .setInteractive({ useHandCursor: true });
    quit.on("pointerover", () => quit.setColor(COLORS.hud));
    quit.on("pointerout", () => quit.setColor(COLORS.hudMuted));
    quit.on("pointerup", () => this.quitToSelect());
  }

  createBroccoli() {
    const cx = this.patchAnchor?.x ?? GAME.width / 2;
    const cy = this.patchAnchor?.y ?? GAME.height / 2;

    this.broccoliShadow = this.createGroundShadow(70, 22);
    this.broccoliSeed = this.add.image(cx, cy, "broccoli-seed").setOrigin(0.5, 0.9);
    this.broccoliMid = this.add.image(cx, cy, "broccoli-mid").setOrigin(0.5, 0.9).setAlpha(0);
    this.patch = this.physics.add.staticImage(cx, cy, "broccoli").setOrigin(0.5, 0.9).setAlpha(0);
    this.patchHp = GAME.patchMaxHp;
    this.broccoliBaseScale = 0.42;
    this.broccoliPulse = 1;
    this.broccoliStages = [this.broccoliSeed, this.broccoliMid, this.patch];
    this.updateBroccoliGrowth();
  }

  updateBroccoliGrowth() {
    const t = Phaser.Math.Clamp(this.elapsed / GAME.durationMs, 0, 1);
    // Ease out so it feels like it fills in toward the end
    const grow = 1 - (1 - t) * (1 - t);
    this.broccoliBaseScale = Phaser.Math.Linear(0.42, 0.95, grow);

    // Crossfade: seedling -> young plant -> full sacred broccoli
    this.broccoliSeedA = Phaser.Math.Clamp(1 - t / 0.38, 0, 1);
    this.broccoliMidA =
      t < 0.2
        ? Phaser.Math.Clamp(t / 0.2, 0, 1)
        : Phaser.Math.Clamp(1 - (t - 0.55) / 0.3, 0, 1);
    this.broccoliFullA = Phaser.Math.Clamp((t - 0.45) / 0.4, 0, 1);
    this.broccoliSway = Math.sin(this.elapsed * 0.0024) * (1.2 + t * 1.5);
    this.presentBroccoli();
  }

  presentBroccoli() {
    if (!this.patch) return;
    // Broccoli is the 3D zoom origin — reference scale is 1
    const d = 1;
    const squash = GAME.pseudo3d.spriteSquash;
    const scale = this.broccoliBaseScale * this.broccoliPulse * d;
    const sway = this.broccoliSway || 0;

    this.broccoliSeed
      .setAlpha(this.broccoliSeedA)
      .setScale(scale * 0.92, scale * 0.92 * squash)
      .setAngle(sway)
      .setDepth(depthOrder(this.patch.y, 2));
    this.broccoliMid
      .setAlpha(this.broccoliMidA)
      .setScale(scale, scale * squash)
      .setAngle(sway * 0.7)
      .setDepth(depthOrder(this.patch.y, 2.1));
    this.patch
      .setAlpha(this.broccoliFullA)
      .setScale(scale, scale * squash)
      .setAngle(sway * 0.45)
      .setDepth(depthOrder(this.patch.y, 2.2));
    this.patch.refreshBody();

    if (this.broccoliShadow?.active) {
      const shadowScale = Phaser.Math.Linear(0.55, 1.15, (this.broccoliBaseScale - 0.42) / (0.95 - 0.42));
      this.broccoliShadow
        .setPosition(this.patch.x, this.patch.y + 4)
        .setScale(d * shadowScale, d * 0.8)
        .setDepth(depthOrder(this.patch.y, 0));
    }
  }

  setBroccoliTint(color) {
    for (const stage of this.broccoliStages) {
      if (stage.active) stage.setTint(color);
    }
  }

  clearBroccoliTint() {
    for (const stage of this.broccoliStages) {
      if (stage.active) stage.clearTint();
    }
  }

  pulseBroccoli(tintColor) {
    this.setBroccoliTint(tintColor);
    this.tweens.add({
      targets: this,
      broccoliPulse: 1.12,
      duration: 220,
      yoyo: true,
      ease: "Sine.InOut",
      onUpdate: () => this.updateBroccoliGrowth(),
      onComplete: () => {
        this.broccoliPulse = 1;
        this.clearBroccoliTint();
        this.updateBroccoliGrowth();
      },
    });
  }

  createAthena() {
    const { x, y } = this.athenaHome;

    // Soft rest nest on the side (ground-projected)
    this.athenaBed = this.add.ellipse(x, y + 10, 96, 28, 0x2a3d32, 0.75);
    this.athenaBedGlow = this.add.ellipse(x, y + 10, 110, 36, 0xd4b45a, 0.12);
    this.athenaShadow = this.createGroundShadow(48, 16);

    // Separate sleep / awake sprites so the sleeping one can be removed on wake
    this.athenaAsleep = this.add
      .image(x, y, "athena")
      .setOrigin(0.5, 0.88)
      .setScale(0.82)
      .setAngle(-90)
      .setAlpha(0.92)
      .setTint(0xd8e4ff);

    this.athena = this.add
      .image(x, y, "athena")
      .setOrigin(0.5, 0.88)
      .setScale(0.95)
      .setVisible(false);
    this.athena.baseScale = 0.95;
    this.athenaAsleep.baseScale = 0.82;

    this.athenaLabel = this.add
      .text(x, y + 28, "Athena (sleeping)", {
        fontFamily: "Georgia, 'Times New Roman', serif",
        fontSize: "12px",
        color: COLORS.hudMuted,
      })
      .setOrigin(0.5);

    this.zzzGroup = this.add.group();
    this.showSleepingAthena();
  }

  showSleepingAthena() {
    const { x, y } = this.athenaHome;
    this.tweens.killTweensOf(this.athena);
    this.tweens.killTweensOf(this.athenaAsleep);

    this.athena.setVisible(false);
    this.athena.clearTint();
    this.athena.setPosition(x, y);
    this.athena.setAngle(0);
    this.athena.setAlpha(1);

    this.athenaAsleep.setVisible(true);
    this.athenaAsleep.setPosition(x, y);
    this.athenaAsleep.setAngle(-90);
    this.athenaAsleep.setAlpha(0.92);
    this.athenaAsleep.setTint(0xd8e4ff);
    this.athenaLabel.setText("Athena (sleeping)");
    this.startZzz();
    this.presentAthena();
  }

  presentAthena() {
    const actor = this.athena.visible ? this.athena : this.athenaAsleep;
    if (!actor?.active) return;
    const base = actor.baseScale ?? 0.9;
    const d = this.depthAt(actor.x, actor.y);
    const squash = GAME.pseudo3d.spriteSquash;
    // Sleeping pose keeps angle; scale still gets depth/squash
    if (actor === this.athenaAsleep) {
      actor.setScale(base * d, base * d * squash * 0.85);
    } else {
      actor.setScale(base * d, base * d * squash);
    }
    actor.setDepth(depthOrder(actor.y, 3));

    this.athenaBed.setPosition(this.athenaHome.x, this.athenaHome.y + 10).setDepth(depthOrder(this.athenaHome.y, 0));
    this.athenaBedGlow.setPosition(this.athenaHome.x, this.athenaHome.y + 10).setDepth(depthOrder(this.athenaHome.y, 0.1));
    this.athenaShadow
      .setPosition(actor.x, actor.y + 6)
      .setScale(d * (actor === this.athenaAsleep ? 1.15 : 1), d * 0.75)
      .setDepth(depthOrder(actor.y, 0.2));
    this.athenaLabel
      .setPosition(this.athenaHome.x, this.athenaHome.y + 28)
      .setDepth(depthOrder(this.athenaHome.y, 4));
  }

  startZzz() {
    this.stopZzz();
    this.zzzTimer = this.time.addEvent({
      delay: 700,
      loop: true,
      callback: () => {
        if (this.athenaBusy || this.ended || !this.athenaAsleep.visible) return;
        const z = this.add
          .text(
            this.athenaAsleep.x - Phaser.Math.Between(18, 28),
            this.athenaAsleep.y - 10,
            Phaser.Utils.Array.GetRandom(["z", "Z", "Zz"]),
            {
              fontFamily: "Georgia, 'Times New Roman', serif",
              fontSize: `${Phaser.Math.Between(12, 16)}px`,
              color: "#c9d7e8",
            },
          )
          .setDepth(5)
          .setAlpha(0.85);
        this.zzzGroup.add(z);
        this.tweens.add({
          targets: z,
          x: z.x - 18,
          y: z.y - 34,
          alpha: 0,
          scale: 1.4,
          duration: 1100,
          ease: "Sine.Out",
          onComplete: () => z.destroy(),
        });
      },
    });
  }

  stopZzz() {
    if (this.zzzTimer) {
      this.zzzTimer.remove(false);
      this.zzzTimer = null;
    }
    this.zzzGroup.clear(true, true);
  }

  update(_time, delta) {
    if (this.ended) return;

    this.elapsed += delta;
    this.attackCooldown = Math.max(0, this.attackCooldown - delta);
    this.specialCharge = Math.min(1, this.specialCharge + delta / this.hero.specialChargeMs);
    this.spawnTimer += delta;
    this.athenaTimer += delta;

    this.updateBroccoliGrowth();
    this.updateTimerHud();
    this.moveGemini();
    if (Phaser.Input.Keyboard.JustDown(this.keys.space)) this.tryAttack();
    this.spawnEnemies();
    this.steerEnemies();
    this.updateAthena();
    this.syncPseudo3d();

    if (this.elapsed >= GAME.durationMs) {
      this.finish(true);
    }
  }

  updateTimerHud() {
    const remaining = Math.max(0, GAME.durationMs - this.elapsed);
    const totalSec = Math.ceil(remaining / 1000);
    const m = Math.floor(totalSec / 60);
    const s = String(totalSec % 60).padStart(2, "0");
    this.timerText.setText(`${m}:${s}`);

    const pct = Math.max(0, this.patchHp / GAME.patchMaxHp);
    const grow = Phaser.Math.Clamp(this.elapsed / GAME.durationMs, 0, 1);
    const stageName = grow < 0.35 ? "Sprout" : grow < 0.7 ? "Growing" : "Blooming";
    this.patchText.setText(`Broccoli ${Math.ceil(pct * 100)}%  ·  ${stageName}`);
    this.patchBar.width = 180 * pct;
    this.patchBar.setFillStyle(pct < 0.35 ? Phaser.Display.Color.HexStringToColor(COLORS.danger).color : COLORS.broccoli);

    if (this.athenaBusy) {
      this.athenaHint.setText("Athena woke up to heal");
      this.athenaHint.setColor("#f0e6b0");
    } else {
      const remain = Math.max(0, GAME.athenaIntervalMs - this.athenaTimer);
      const sec = Math.ceil(remain / 1000);
      this.athenaHint.setText(`Athena wakes in ${sec}s`);
      this.athenaHint.setColor(COLORS.hudMuted);
    }

    this.specialBar.width = Math.max(1, 180 * this.specialCharge);
    if (this.specialCharge >= 1) {
      this.specialBar.setFillStyle(this.hero.accent);
      this.specialLabel.setText(`${this.hero.specialName} READY  ·  Right-click`);
      this.specialLabel.setColor("#f0e6b0");
    } else {
      this.specialBar.setFillStyle(this.hero.accent);
      const sec = Math.ceil((1 - this.specialCharge) * (this.hero.specialChargeMs / 1000));
      this.specialLabel.setText(`${this.hero.name} special  ·  ${sec}s`);
      this.specialLabel.setColor(COLORS.hudMuted);
    }
  }

  updateAthena() {
    if (this.athenaBusy || this.athenaTimer < GAME.athenaIntervalMs) return;
    this.athenaTimer = 0;
    this.wakeAndBless();
  }

  wakeAndBless() {
    this.athenaBusy = true;
    this.stopZzz();
    this.tweens.killTweensOf(this.athena);
    this.tweens.killTweensOf(this.athenaAsleep);

    const { x, y } = this.athenaHome;
    const cx = this.patch.x;
    const cy = this.patch.y;
    const blessX = cx - 78;
    const blessY = cy - 8;

    // Remove the sleeping Athena, swap in the awake one
    this.athenaAsleep.setVisible(false);
    this.athenaLabel.setText("Athena");
    this.athena.setVisible(true);
    this.athena.setPosition(x, y);
    this.athena.setAngle(0);
    this.athena.setAlpha(1);
    this.athena.setScale(0.85);
    this.athena.setTint(0xfff4c8);

    this.tweens.add({
      targets: this.athena,
      scale: 0.95,
      duration: 280,
      ease: "Back.Out",
      onComplete: () => {
        this.athena.clearTint();
        this.tweens.add({
          targets: this.athena,
          x: blessX,
          y: blessY,
          duration: 700,
          ease: "Sine.InOut",
          onComplete: () => this.performBlessing(cx, cy, blessX, blessY),
        });
      },
    });
  }

  performBlessing(cx, cy, blessX, blessY) {
    const veil = this.add
      .rectangle(GAME.width / 2, GAME.height / 2, GAME.width, GAME.height, 0xfff6c8, 0)
      .setDepth(8);
    this.tweens.add({
      targets: veil,
      fillAlpha: 0.18,
      duration: 280,
      yoyo: true,
      hold: 700,
      onComplete: () => veil.destroy(),
    });

    const pillar = this.add.rectangle(cx, cy - 20, 18, 1, 0xfff1a8, 0.0).setDepth(5);
    const ring = this.add.circle(cx, cy, 20, 0xffe082, 0.0).setDepth(5);
    ring.setStrokeStyle(3, 0xfff6c8, 0.9);

    this.athena.setTint(0xfff4c8);
    this.playHealLights(cx, cy, pillar, ring, blessX, blessY);
    this.applyAthenaHeal();

    this.time.delayedCall(1000, () => {
      this.athena.clearTint();
      pillar.destroy();
      ring.destroy();
      // Walk home, then swap back to sleeping Athena
      this.tweens.add({
        targets: this.athena,
        x: this.athenaHome.x,
        y: this.athenaHome.y,
        duration: 700,
        ease: "Sine.InOut",
        onComplete: () => {
          this.showSleepingAthena();
          this.athenaBusy = false;
        },
      });
    });
  }

  playHealLights(cx, cy, pillar, ring, fromX, fromY) {
    this.tweens.add({
      targets: pillar,
      displayHeight: 220,
      y: cy - 120,
      fillAlpha: 0.55,
      duration: 320,
      yoyo: true,
      hold: 400,
      ease: "Sine.Out",
    });

    this.tweens.add({
      targets: ring,
      scale: 4.2,
      fillAlpha: 0.2,
      alpha: 0,
      duration: 900,
      ease: "Cubic.Out",
    });

    for (let i = 0; i < 12; i += 1) {
      const angle = (Math.PI * 2 * i) / 12;
      const mote = this.add.circle(cx, cy, Phaser.Math.Between(2, 4), 0xfff4b0, 0.95).setDepth(6);
      this.tweens.add({
        targets: mote,
        x: cx + Math.cos(angle) * Phaser.Math.Between(50, 90),
        y: cy + Math.sin(angle) * Phaser.Math.Between(40, 70) - 20,
        alpha: 0,
        scale: 0.2,
        duration: Phaser.Math.Between(650, 1000),
        delay: i * 35,
        ease: "Cubic.Out",
        onComplete: () => mote.destroy(),
      });
    }

    for (let i = 0; i < 10; i += 1) {
      const spark = this.add
        .circle(
          fromX + Phaser.Math.Between(-16, 16),
          fromY - 30,
          Phaser.Math.Between(2, 3),
          i % 2 === 0 ? 0xfff6c8 : 0xb8e0ff,
          1,
        )
        .setDepth(8);
      this.tweens.add({
        targets: spark,
        x: cx + Phaser.Math.Between(-30, 30),
        y: cy + Phaser.Math.Between(-10, 24),
        alpha: 0,
        duration: Phaser.Math.Between(500, 900),
        delay: 120 + i * 40,
        ease: "Sine.In",
        onComplete: () => spark.destroy(),
      });
    }

    this.pulseBroccoli(0xfff4c8);

    const healText = this.add
      .text(cx, cy - 40, `+${GAME.athenaHealAmount}`, {
        fontFamily: "Georgia, 'Times New Roman', serif",
        fontSize: "26px",
        color: "#f0e6b0",
        stroke: "#2a2410",
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(12);
    this.tweens.add({
      targets: healText,
      y: cy - 90,
      alpha: 0,
      duration: 900,
      ease: "Cubic.Out",
      onComplete: () => healText.destroy(),
    });
  }

  applyAthenaHeal() {
    if (this.ended) return;
    this.patchHp = Math.min(GAME.patchMaxHp, this.patchHp + GAME.athenaHealAmount);
    this.updateTimerHud();
  }

  moveGemini() {
    let vx = 0;
    let vy = 0;

    if (this.cursors.left.isDown || this.keys.a.isDown) vx -= 1;
    if (this.cursors.right.isDown || this.keys.d.isDown) vx += 1;
    if (this.cursors.up.isDown || this.keys.w.isDown) vy -= 1;
    if (this.cursors.down.isDown || this.keys.s.isDown) vy += 1;

    // Keyboard overrides mouse pathing while held
    if (vx !== 0 || vy !== 0) {
      this.clearMoveTarget();
      const vec = new Phaser.Math.Vector2(vx, vy).normalize().scale(this.hero.speed);
      this.gemini.setVelocity(vec.x, vec.y);
      return;
    }

    if (!this.moveTarget) {
      this.gemini.setVelocity(0, 0);
      return;
    }

    const dist = Phaser.Math.Distance.Between(
      this.gemini.x,
      this.gemini.y,
      this.moveTarget.x,
      this.moveTarget.y,
    );

    if (dist <= this.hero.arriveDistance) {
      this.gemini.setVelocity(0, 0);
      this.clearMoveTarget();
      return;
    }

    this.physics.moveTo(this.gemini, this.moveTarget.x, this.moveTarget.y, this.hero.speed);
  }

  clearMoveTarget() {
    this.moveTarget = null;
    this.moveMarker.setVisible(false);
    this.moveMarkerStroke.setVisible(false);
  }

  tryAttack() {
    if (this.ended || this.attackCooldown > 0) return;

    this.attackCooldown = this.hero.attackCooldownMs;

    // Little hop for pseudo-3D punch (visual only — shrinks shadow / lifts sprite)
    this.tweens.killTweensOf(this.heroHopState);
    this.heroHopState.hop = 0;
    this.heroHopState.specialPulse = 0;
    this.tweens.add({
      targets: this.heroHopState,
      hop: 1,
      duration: 100,
      yoyo: true,
      ease: "Sine.Out",
      onComplete: () => {
        this.heroHopState.hop = 0;
      },
    });

    const heroD = this.depthAt(
      this.gemini.x,
      this.gemini.y,
      GAME.pseudo3d.heroFarScale,
      GAME.pseudo3d.heroNearScale,
    );
    const burst = this.add
      .image(this.gemini.x, this.gemini.y - 24, "burst")
      .setDepth(depthOrder(this.gemini.y, 8))
      .setScale(0.85 * heroD);
    this.tweens.add({
      targets: burst,
      alpha: 0,
      scale: 1.35 * heroD,
      duration: 220,
      onComplete: () => burst.destroy(),
    });

    this.damageEnemiesInRange(this.hero.attackRange, this.hero.attackDamage);
  }

  trySpecialAttack() {
    if (this.ended || this.specialCharge < 1) return;

    this.specialCharge = 0;
    const ox = this.gemini.x;
    const oy = this.gemini.y;
    const range = this.hero.specialRange;

    const style = this.hero.specialStyle;
    const isStardust = style === "stardust";
    const isHorn = style === "horn";
    const isGalaxian = style === "galaxian";
    const isUnderworld = style === "underworld";
    const isPlasma = style === "plasma";
    const isBeads = style === "beads";
    const isWeapons = style === "weapons";
    const isNeedle = style === "needle";
    const isThunderbolt = style === "thunderbolt";
    const isExcalibur = style === "excalibur";
    const isAurora = style === "aurora";
    const isRose = style === "rose";
    if (isStardust) {
      // Mu: precise Cosmo — soft pulse, not a riot shake
      this.cameras.main.shake(160, 0.006);
      this.cameras.main.flash(120, 220, 230, 255);
    } else if (isHorn) {
      // Aldebaran: titan impact — heavy amber quake
      this.cameras.main.shake(420, 0.022);
      this.cameras.main.flash(200, 255, 200, 120);
    } else if (isGalaxian) {
      // Saga: galaxy crush — deep cyan nova
      this.cameras.main.shake(360, 0.018);
      this.cameras.main.flash(220, 160, 220, 255);
    } else if (isUnderworld) {
      // Deathmask: underworld pull — violet hush
      this.cameras.main.shake(240, 0.01);
      this.cameras.main.flash(200, 180, 120, 220);
    } else if (isPlasma) {
      // Aiolia: light-speed fists — staccato gold flash
      this.cameras.main.shake(200, 0.012);
      this.cameras.main.flash(90, 255, 240, 140);
      this.time.delayedCall(120, () => this.cameras.main.flash(70, 255, 220, 80));
      this.time.delayedCall(240, () => this.cameras.main.flash(70, 255, 250, 180));
    } else if (isBeads) {
      // Shaka: serene Cosmo — gold hush
      this.cameras.main.shake(120, 0.004);
      this.cameras.main.flash(180, 255, 244, 200);
    } else if (isWeapons) {
      // Dohko: judged strike — measured gold quake
      this.cameras.main.shake(260, 0.014);
      this.cameras.main.flash(160, 255, 230, 150);
    } else if (isNeedle) {
      // Milo: precise sting — crimson flashes
      this.cameras.main.shake(160, 0.007);
      this.cameras.main.flash(70, 255, 70, 90);
      this.time.delayedCall(220, () => this.cameras.main.flash(60, 255, 40, 70));
      this.time.delayedCall(480, () => this.cameras.main.flash(90, 255, 50, 80));
    } else if (isThunderbolt) {
      // Aiolos: golden volley — gold then cyan flash
      this.cameras.main.shake(220, 0.012);
      this.cameras.main.flash(100, 255, 240, 150);
      this.time.delayedCall(160, () => this.cameras.main.flash(80, 160, 230, 255));
    } else if (isExcalibur) {
      // Shura: sacred blade — silver cut then gold
      this.cameras.main.shake(280, 0.016);
      this.cameras.main.flash(80, 240, 240, 230);
      this.time.delayedCall(140, () => this.cameras.main.flash(90, 255, 236, 180));
    } else if (isAurora) {
      // Camus: absolute zero — ice hush then gold pour
      this.cameras.main.shake(140, 0.006);
      this.cameras.main.flash(140, 180, 230, 255);
      this.time.delayedCall(220, () => this.cameras.main.flash(90, 255, 236, 180));
    } else if (isRose) {
      // Aphrodite: lethal beauty — rose then white flash
      this.cameras.main.shake(160, 0.007);
      this.cameras.main.flash(90, 255, 120, 160);
      this.time.delayedCall(280, () => this.cameras.main.flash(80, 255, 240, 245));
    } else {
      this.cameras.main.shake(280, 0.014);
      this.cameras.main.flash(180, 255, 236, 160);
    }

    const veil = this.add
      .rectangle(
        GAME.width / 2,
        GAME.height / 2,
        GAME.width,
        GAME.height,
        isStardust
          ? 0x101828
          : isHorn
            ? 0x1a1008
            : isGalaxian
              ? 0x081018
              : isUnderworld
                ? 0x120818
                : isPlasma
                  ? 0x181208
                  : isBeads
                    ? 0x18140c
                    : isWeapons
                      ? 0x161208
                      : isNeedle
                        ? 0x18080c
                        : isThunderbolt
                          ? 0x181408
                          : isExcalibur
                            ? 0x141410
                            : isAurora
                              ? 0x081418
                              : isRose
                                ? 0x180810
                                : 0x04060c,
        0,
      )
      .setDepth(6);
    this.tweens.add({
      targets: veil,
      fillAlpha: isStardust
        ? 0.35
        : isHorn
          ? 0.5
          : isGalaxian
            ? 0.6
            : isUnderworld
              ? 0.55
              : isPlasma
                ? 0.4
                : isBeads
                  ? 0.32
                  : isWeapons
                    ? 0.45
                    : isNeedle
                      ? 0.42
                      : isThunderbolt
                        ? 0.4
                        : isExcalibur
                          ? 0.42
                          : isAurora
                            ? 0.38
                            : isRose
                              ? 0.4
                              : 0.55,
      duration: isStardust
        ? 160
        : isHorn
          ? 90
          : isGalaxian
            ? 140
            : isUnderworld
              ? 180
              : isPlasma
                ? 70
                : isBeads
                  ? 200
                  : isWeapons
                    ? 110
                    : isNeedle
                      ? 90
                      : isThunderbolt
                        ? 90
                        : isExcalibur
                          ? 70
                          : isAurora
                            ? 180
                            : isRose
                              ? 140
                              : 120,
      yoyo: true,
      hold: isStardust
        ? 320
        : isHorn
          ? 180
          : isGalaxian
            ? 280
            : isUnderworld
              ? 360
              : isPlasma
                ? 200
                : isBeads
                  ? 420
                  : isWeapons
                    ? 240
                    : isNeedle
                      ? 280
                      : isThunderbolt
                        ? 240
                        : isExcalibur
                          ? 200
                          : isAurora
                            ? 360
                            : isRose
                              ? 280
                              : 220,
      onComplete: () => veil.destroy(),
    });

    const specials = {
      beads: () => this.playTenbuHorin(ox, oy, range),
      thunderbolt: () => this.playAtomicThunderbolt(ox, oy, range),
      galaxian: () => this.playGalaxianExplosion(ox, oy, range),
      stardust: () => this.playStardustRevolution(ox, oy, range),
      horn: () => this.playGreatHorn(ox, oy, range),
      underworld: () => this.playSekishiki(ox, oy, range),
      plasma: () => this.playLightningPlasma(ox, oy, range),
      weapons: () => this.playLibraWeapons(ox, oy, range),
      needle: () => this.playScarletNeedle(ox, oy, range),
      excalibur: () => this.playExcalibur(ox, oy, range),
      aurora: () => this.playAuroraExecution(ox, oy, range),
      rose: () => this.playBloodyRose(ox, oy, range),
    };
    (specials[this.hero.specialStyle] || specials.galaxian)();

    this.tweens.killTweensOf(this.heroHopState);
    this.heroHopState.hop = 0;
    this.heroHopState.specialPulse = 0;
    this.tweens.add({
      targets: this.heroHopState,
      specialPulse: 1,
      duration: isStardust
        ? 320
        : isHorn
          ? 140
          : isGalaxian
            ? 280
            : isUnderworld
              ? 260
              : isPlasma
                ? 120
                : isBeads
                  ? 360
                  : isWeapons
                    ? 200
                    : isNeedle
                      ? 160
                      : isThunderbolt
                        ? 160
                        : isExcalibur
                          ? 140
                          : isAurora
                            ? 280
                            : isRose
                              ? 200
                              : 180,
      yoyo: true,
      ease: "Sine.Out",
      onComplete: () => {
        this.heroHopState.specialPulse = 0;
      },
    });
    this.gemini.setTint(
      isStardust
        ? 0xd8f0ff
        : isHorn
          ? 0xffd080
          : isGalaxian
            ? 0xb8f0ff
            : isUnderworld
              ? 0xe0c8ff
              : isPlasma
                ? 0xfff0a8
                : isBeads
                  ? 0xfff4d0
                  : isWeapons
                    ? 0xffe8b0
                    : isNeedle
                      ? 0xff90a0
                      : isThunderbolt
                        ? 0xfff0a8
                        : isExcalibur
                          ? 0xf0e8c8
                          : isAurora
                            ? 0xb8f0ff
                            : isRose
                              ? 0xffb0c8
                              : 0xfff4c8,
    );
    this.time.delayedCall(
      isStardust
        ? 420
        : isHorn
          ? 300
          : isGalaxian
            ? 480
            : isUnderworld
              ? 500
              : isPlasma
                ? 280
                : isBeads
                  ? 520
                  : isWeapons
                    ? 360
                    : isNeedle
                      ? 400
                      : isThunderbolt
                        ? 340
                        : isExcalibur
                          ? 300
                          : isAurora
                            ? 480
                            : isRose
                              ? 420
                              : 260,
      () => {
        if (this.gemini.active) this.gemini.clearTint();
      },
    );

    const label = this.add
      .text(GAME.width / 2, 120, this.hero.specialName, {
        fontFamily: "Georgia, 'Times New Roman', serif",
        fontSize: "34px",
        color: isStardust
          ? "#e8f0ff"
          : isHorn
            ? "#ffe0a0"
            : isGalaxian
              ? "#c8f0ff"
              : isUnderworld
                ? "#e8d0ff"
                : isPlasma
                  ? "#fff4b0"
                  : isBeads
                    ? "#f8ecd0"
                    : isWeapons
                      ? "#f0e0b0"
                      : isNeedle
                        ? "#ffd0d8"
                        : isThunderbolt
                          ? "#fff4c0"
                          : isExcalibur
                            ? "#f4ecd0"
                            : isAurora
                              ? "#c8f4ff"
                              : isRose
                                ? "#ffd0dc"
                                : "#f0e6b0",
        stroke: "#1a1412",
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(10050)
      .setAlpha(0)
      .setScale(0.7);
    this.tweens.add({
      targets: label,
      alpha: 1,
      scale: 1,
      duration: 220,
      ease: "Back.Out",
    });
    this.tweens.add({
      targets: label,
      y: 90,
      alpha: 0,
      delay: isStardust
        ? 900
        : isHorn
          ? 750
          : isGalaxian
            ? 950
            : isUnderworld
              ? 1000
              : isPlasma
                ? 720
                : isBeads
                  ? 1000
                  : isWeapons
                    ? 800
                    : isNeedle
                      ? 850
                      : isThunderbolt
                        ? 780
                        : isExcalibur
                          ? 720
                          : isAurora
                            ? 900
                            : isRose
                              ? 850
                              : 700,
      duration: 500,
      onComplete: () => label.destroy(),
    });

    // Per-saint Cosmo beat for damage pulses
    const dmgAt = isStardust
      ? [320, 520, 720]
      : isHorn
        ? [90, 220, 380]
        : isGalaxian
          ? [220, 420, 620]
          : isUnderworld
            ? [200, 400, 600]
            : isPlasma
              ? [40, 140, 260]
              : isBeads
                ? [280, 500, 720]
                : isWeapons
                  ? [140, 300, 460]
                  : isNeedle
                    ? [100, 280, 500]
                    : isThunderbolt
                      ? [80, 220, 400]
                      : isExcalibur
                        ? [80, 200, 360]
                        : isAurora
                          ? [180, 360, 560]
                          : isRose
                            ? [120, 280, 480]
                            : [0, 180, 360];
    for (const delay of dmgAt) {
      if (delay === 0) {
        this.damageEnemiesFromPoint(ox, oy, range, this.hero.specialDamage, true);
      } else {
        this.time.delayedCall(delay, () => {
          if (!this.ended) {
            this.damageEnemiesFromPoint(ox, oy, range, this.hero.specialDamage, true);
          }
        });
      }
    }
  }

  /**
   * Sagittarius Aiolos Cosmo feel:
   * golden bow draw → Atomic Thunderbolt orbs → golden arrows.
   */
  playAtomicThunderbolt(ox, oy, range) {
    const cy = oy - 8;
    const gold = 0xffe082;
    const cyan = 0x7fd7ef;
    const white = 0xffffff;
    const ADD = Phaser.BlendModes.ADD;

    // --- 1. Bow draw ---
    const bow = this.add.graphics().setDepth(10).setAlpha(0);
    bow.setBlendMode(ADD);
    bow.lineStyle(4, gold, 0.95);
    bow.beginPath();
    bow.arc(0, 0, 28, -1.2, 1.2, false);
    bow.strokePath();
    bow.lineStyle(2.4, white, 0.85);
    bow.lineBetween(-22, 0, 26, 0);
    bow.setPosition(ox, cy);
    this.tweens.add({
      targets: bow,
      alpha: 1,
      scale: 1.4,
      duration: 140,
      ease: "Back.Out",
    });
    this.tweens.add({
      targets: bow,
      alpha: 0,
      delay: 180,
      duration: 200,
      onComplete: () => bow.destroy(),
    });

    const bowGlow = this.add.circle(ox, cy, 18, gold, 0.7).setDepth(9);
    bowGlow.setBlendMode(ADD);
    this.tweens.add({
      targets: bowGlow,
      scale: 3.2,
      alpha: 0,
      duration: 380,
      onComplete: () => bowGlow.destroy(),
    });

    // --- 2. Hero golden arrow ---
    const mainArrow = this.add
      .image(ox, cy, "golden-arrow")
      .setDepth(13)
      .setOrigin(0.15, 0.5)
      .setScale(1.5);
    mainArrow.setBlendMode(ADD);
    this.tweens.add({
      targets: mainArrow,
      x: ox + range * 0.98,
      alpha: 0,
      scaleX: 1.8,
      duration: 300,
      delay: 80,
      ease: "Cubic.Out",
      onComplete: () => mainArrow.destroy(),
    });

    // Rain of golden arrows
    for (let i = 0; i < 24; i += 1) {
      const angle = -0.55 + (1.1 * i) / 23 + (Math.random() - 0.5) * 0.1;
      const dist = range * (0.45 + Math.random() * 0.55);
      const arrow = this.add
        .image(ox, cy, "golden-arrow")
        .setDepth(11)
        .setOrigin(0.15, 0.5)
        .setRotation(angle)
        .setScale(0.8 + Math.random() * 0.35);
      arrow.setBlendMode(ADD);
      const streak = this.add
        .rectangle(ox, cy, 12, 3, 0xfff6c8, 0.7)
        .setDepth(10)
        .setOrigin(0, 0.5)
        .setRotation(angle);
      streak.setBlendMode(ADD);
      this.tweens.add({
        targets: [arrow, streak],
        x: ox + Math.cos(angle) * dist,
        y: cy + Math.sin(angle) * dist * 0.75,
        alpha: 0,
        duration: 360 + (i % 7) * 28,
        delay: 70 + Math.floor(i / 2) * 28,
        ease: "Cubic.Out",
        onComplete: () => {
          arrow.destroy();
          streak.destroy();
        },
      });
    }

    // --- 3. Atomic Thunderbolt — electrified Cosmo orbs ---
    for (let i = 0; i < 48; i += 1) {
      const angle = -0.7 + (1.4 * i) / 47 + (Math.random() - 0.5) * 0.18;
      const dist = range * (0.3 + Math.random() * 0.7);
      const orb = this.add
        .circle(
          ox,
          cy,
          i % 5 === 0 ? 9 : Phaser.Math.Between(4, 7),
          i % 3 === 0 ? gold : i % 3 === 1 ? cyan : white,
          1,
        )
        .setDepth(12);
      orb.setBlendMode(ADD);
      this.tweens.add({
        targets: orb,
        x: ox + Math.cos(angle) * dist,
        y: cy + Math.sin(angle) * dist * 0.75,
        alpha: 0,
        scale: 0.2,
        duration: 380 + (i % 8) * 30,
        delay: 40 + Math.floor(i / 4) * 22,
        ease: "Cubic.Out",
        onComplete: () => orb.destroy(),
      });
    }

    // Lightning forks between orbs
    for (let i = 0; i < 12; i += 1) {
      const g = this.add.graphics().setDepth(10);
      g.setBlendMode(ADD);
      const ang = -0.6 + (1.2 * i) / 11;
      g.lineStyle(2.2, i % 2 === 0 ? cyan : gold, 0.9);
      g.beginPath();
      let x = ox;
      let y = cy;
      g.moveTo(x, y);
      for (let s = 1; s <= 7; s += 1) {
        const t = s / 7;
        x = ox + Math.cos(ang) * range * t + Phaser.Math.Between(-16, 16);
        y = cy + Math.sin(ang) * range * t * 0.75 + Phaser.Math.Between(-12, 12);
        g.lineTo(x, y);
      }
      g.strokePath();
      this.tweens.add({
        targets: g,
        alpha: 0,
        duration: 320,
        delay: 50 + i * 32,
        onComplete: () => g.destroy(),
      });
    }
  }

  /**
   * Gemini Saga Cosmo feel:
   * twin Cosmo gather → stars/planets crush inward → galactic explosion.
   */
  playGalaxianExplosion(ox, oy, range) {
    const cy = oy - 8;
    const cyan = 0x6ec8e0;
    const ice = 0xa8e8ff;
    const gold = 0xfff1a8;
    const violet = 0x8a70d0;
    const white = 0xffffff;
    const ADD = Phaser.BlendModes.ADD;

    // Soft space veil behind the blast
    const space = this.add.circle(ox, cy, 40, 0x1a1040, 0.55).setDepth(6);
    space.setBlendMode(ADD);
    this.tweens.add({
      targets: space,
      scale: range / 32,
      alpha: 0,
      duration: 1000,
      ease: "Sine.Out",
      onComplete: () => space.destroy(),
    });

    // --- 1. Twin Cosmo orbs gather (Castor & Pollux) ---
    const twinL = this.add.circle(ox - 48, cy - 10, 10, cyan, 0.9).setDepth(12);
    const twinR = this.add.circle(ox + 48, cy - 10, 10, gold, 0.9).setDepth(12);
    twinL.setBlendMode(ADD);
    twinR.setBlendMode(ADD);
    this.tweens.add({
      targets: twinL,
      x: ox - 6,
      y: cy,
      scale: 1.8,
      duration: 220,
      ease: "Cubic.In",
    });
    this.tweens.add({
      targets: twinR,
      x: ox + 6,
      y: cy,
      scale: 1.8,
      duration: 220,
      ease: "Cubic.In",
      onComplete: () => {
        twinL.destroy();
        twinR.destroy();
      },
    });

    // Core nova between the hands
    const core = this.add.circle(ox, cy, 8, white, 0).setDepth(13);
    core.setBlendMode(ADD);
    this.tweens.add({
      targets: core,
      alpha: 1,
      scale: 3.2,
      delay: 180,
      duration: 160,
      yoyo: true,
      onComplete: () => core.destroy(),
    });

    // --- 2. Stars & planets crash inward, then explode ---
    this.time.delayedCall(200, () => {
      if (this.ended) return;

      // Planets slamming into the core, then blasting out
      for (let i = 0; i < 36; i += 1) {
        const angle = (Math.PI * 2 * i) / 36 + Math.random() * 0.1;
        const far = range * (0.7 + Math.random() * 0.35);
        const col = i % 3 === 0 ? white : i % 3 === 1 ? cyan : gold;
        const planet = this.add
          .circle(
            ox + Math.cos(angle) * far,
            cy + Math.sin(angle) * far * 0.85,
            i % 5 === 0 ? 7 : Phaser.Math.Between(3, 5),
            col,
            1,
          )
          .setDepth(10);
        planet.setBlendMode(ADD);
        this.tweens.add({
          targets: planet,
          x: ox + Math.cos(angle) * 12,
          y: cy + Math.sin(angle) * 10,
          scale: 0.6,
          duration: 220,
          delay: (i % 8) * 12,
          ease: "Cubic.In",
          onComplete: () => {
            // Rebound / explode outward
            this.tweens.add({
              targets: planet,
              x: ox + Math.cos(angle + 0.4) * far * 1.05,
              y: cy + Math.sin(angle + 0.4) * far * 0.9,
              alpha: 0,
              scale: 0.15,
              duration: 480,
              ease: "Cubic.Out",
              onComplete: () => planet.destroy(),
            });
          },
        });
      }

      // Spiral galaxy arms
      for (let arm = 0; arm < 6; arm += 1) {
        const g = this.add.graphics().setDepth(8).setAlpha(0);
        g.setBlendMode(ADD);
        const base = (Math.PI * 2 * arm) / 6;
        const col = arm % 2 === 0 ? ice : gold;
        g.lineStyle(2.6, col, 0.9);
        g.beginPath();
        for (let s = 0; s <= 32; s += 1) {
          const t = s / 32;
          const ang = base + t * Math.PI * 1.85;
          const dist = 14 + t * range * 0.95;
          const x = ox + Math.cos(ang) * dist;
          const y = cy + Math.sin(ang) * dist * 0.82;
          if (s === 0) g.moveTo(x, y);
          else g.lineTo(x, y);
        }
        g.strokePath();
        // Arm star nodes
        for (let s = 4; s <= 28; s += 4) {
          const t = s / 32;
          const ang = base + t * Math.PI * 1.85;
          const dist = 14 + t * range * 0.95;
          g.fillStyle(white, 0.85);
          g.fillCircle(ox + Math.cos(ang) * dist, cy + Math.sin(ang) * dist * 0.82, 2);
        }
        this.tweens.add({
          targets: g,
          alpha: 0.95,
          duration: 120,
          delay: arm * 30,
          yoyo: true,
          hold: 280,
          onComplete: () => g.destroy(),
        });
      }

      // Shockwave rings
      for (let i = 0; i < 5; i += 1) {
        const ring = this.add.circle(ox, cy, 20, 0x000000, 0).setDepth(9);
        ring.setStrokeStyle(3.5 - i * 0.4, i % 2 === 0 ? cyan : gold, 0.95);
        this.tweens.add({
          targets: ring,
          scale: range / 20,
          alpha: 0,
          duration: 620,
          delay: i * 55,
          ease: "Cubic.Out",
          onComplete: () => ring.destroy(),
        });
      }

      // Burst novas
      for (const sc of [1.6, 2.6, 3.8]) {
        const burst = this.add
          .image(ox, cy, "burst")
          .setDepth(11)
          .setScale(sc * 0.45)
          .setAlpha(0.9)
          .setBlendMode(ADD)
          .setTint(sc > 3 ? cyan : gold);
        this.tweens.add({
          targets: burst,
          alpha: 0,
          scale: sc * 1.4,
          angle: sc > 2.5 ? -50 : 50,
          duration: 580,
          delay: (sc - 1.6) * 40,
          ease: "Cubic.Out",
          onComplete: () => burst.destroy(),
        });
      }

      // Radial Cosmo beams
      for (let i = 0; i < 24; i += 1) {
        const angle = (Math.PI * 2 * i) / 24;
        const beam = this.add
          .rectangle(ox, cy, 4, 14, i % 2 === 0 ? gold : ice, 0.95)
          .setDepth(9)
          .setRotation(angle);
        beam.setBlendMode(ADD);
        this.tweens.add({
          targets: beam,
          displayHeight: range * 1.02,
          alpha: 0,
          duration: 500,
          delay: 30 + (i % 6) * 18,
          ease: "Cubic.Out",
          onComplete: () => beam.destroy(),
        });
      }

      // Twin afterimage flashes (illusion echo)
      for (const side of [-1, 1]) {
        const echo = this.add
          .circle(ox + side * 36, cy, 16, side < 0 ? cyan : violet, 0.55)
          .setDepth(10);
        echo.setBlendMode(ADD);
        this.tweens.add({
          targets: echo,
          x: ox + side * range * 0.35,
          scale: 2.4,
          alpha: 0,
          duration: 520,
          ease: "Cubic.Out",
          onComplete: () => echo.destroy(),
        });
      }

      // --- 3. Soul of Gold lava rain — molten debris falls from the sky ---
      const lavaDark = 0x3a1810;
      const lavaGlow = 0xff6a20;
      const lavaCore = 0xffc040;
      const magma = 0xff3020;
      const skyTop = -80;
      const groundY = Math.min(GAME.height + 40, cy + range * 0.85);

      // Big molten planetoids drop from above, then crack into shards
      for (let p = 0; p < 8; p += 1) {
        const px = ox + Phaser.Math.Between(-range * 0.7, range * 0.7);
        const py = skyTop - Phaser.Math.Between(20, 120);
        const body = this.add.graphics().setDepth(11).setAlpha(0);
        const r = 22 + (p % 3) * 10;
        body.fillStyle(lavaDark, 1);
        body.fillCircle(0, 0, r);
        body.fillStyle(lavaGlow, 0.85);
        body.fillCircle(-r * 0.25, r * 0.1, r * 0.55);
        body.fillStyle(lavaCore, 0.9);
        body.fillCircle(r * 0.2, -r * 0.15, r * 0.3);
        body.setPosition(px, py);
        body.setBlendMode(ADD);
        const midY = cy - 40 + Phaser.Math.Between(-60, 40);
        this.tweens.add({
          targets: body,
          alpha: 1,
          y: midY,
          x: px + Phaser.Math.Between(-30, 30),
          duration: Phaser.Math.Between(280, 420),
          delay: p * 40,
          ease: "Cubic.In",
          onComplete: () => {
            for (let s = 0; s < 8; s += 1) {
              const shardAng = (Math.PI * 2 * s) / 8 + Math.random() * 0.4;
              const shard = this.add
                .rectangle(
                  body.x,
                  body.y,
                  Phaser.Math.Between(14, 28),
                  Phaser.Math.Between(10, 20),
                  s % 2 === 0 ? lavaGlow : magma,
                  1,
                )
                .setDepth(12)
                .setRotation(shardAng);
              shard.setBlendMode(ADD);
              this.tweens.add({
                targets: shard,
                x: body.x + Math.cos(shardAng) * Phaser.Math.Between(40, 120),
                y: groundY + Phaser.Math.Between(-40, 60),
                alpha: 0,
                scale: 0.3,
                angle: Phaser.Math.Between(-180, 180),
                duration: Phaser.Math.Between(420, 680),
                ease: "Cubic.In",
                onComplete: () => shard.destroy(),
              });
            }
            body.destroy();
          },
        });
      }

      // Dense rock rain from the top of the sky
      for (let i = 0; i < 56; i += 1) {
        const sx = ox + Phaser.Math.Between(-range * 0.85, range * 0.85);
        const sy = skyTop - Phaser.Math.Between(0, 160) - Math.floor(i / 8) * 18;
        const w = Phaser.Math.Between(14, 32);
        const h = Phaser.Math.Between(12, 26);
        const col =
          i % 4 === 0 ? lavaCore : i % 4 === 1 ? lavaGlow : i % 4 === 2 ? magma : lavaDark;
        const chunk = this.add
          .rectangle(sx, sy, w, h, col, 1)
          .setDepth(12)
          .setRotation(Math.random() * Math.PI)
          .setAlpha(0);
        if (col !== lavaDark) chunk.setBlendMode(ADD);

        const ember =
          col === lavaDark
            ? this.add
                .circle(sx, sy, Math.max(w, h) * 0.7, lavaGlow, 0.75)
                .setDepth(11)
                .setBlendMode(ADD)
                .setAlpha(0)
            : null;

        const driftX = sx + Phaser.Math.Between(-50, 50);
        const fallY = groundY + Phaser.Math.Between(-30, 80);
        const delay = 20 + Math.floor(i / 5) * 28 + Phaser.Math.Between(0, 40);
        const dur = Phaser.Math.Between(620, 980);

        this.tweens.add({
          targets: chunk,
          alpha: 1,
          duration: 50,
          delay,
        });
        this.tweens.add({
          targets: chunk,
          x: driftX,
          y: fallY,
          alpha: 0,
          scaleX: 0.4,
          scaleY: 0.4,
          angle: Phaser.Math.Between(-220, 220),
          duration: dur,
          delay: delay + 30,
          ease: "Cubic.In",
          onComplete: () => chunk.destroy(),
        });
        if (ember) {
          this.tweens.add({
            targets: ember,
            alpha: 0.85,
            duration: 50,
            delay,
          });
          this.tweens.add({
            targets: ember,
            x: driftX,
            y: fallY,
            alpha: 0,
            scale: 0.25,
            duration: dur,
            delay: delay + 30,
            ease: "Cubic.In",
            onComplete: () => ember.destroy(),
          });
        }
      }

      // Molten streaks dropping from above
      for (let i = 0; i < 28; i += 1) {
        const sx = ox + Phaser.Math.Between(-range * 0.8, range * 0.8);
        const sy = skyTop - Phaser.Math.Between(10, 100);
        const streak = this.add
          .rectangle(sx, sy, Phaser.Math.Between(3, 6), Phaser.Math.Between(28, 52), lavaCore, 0.95)
          .setDepth(12)
          .setAlpha(0.95);
        streak.setBlendMode(ADD);
        this.tweens.add({
          targets: streak,
          y: groundY + Phaser.Math.Between(-20, 60),
          x: sx + Phaser.Math.Between(-30, 30),
          alpha: 0,
          scaleY: 1.8,
          duration: Phaser.Math.Between(520, 780),
          delay: 40 + i * 24,
          ease: "Cubic.In",
          onComplete: () => streak.destroy(),
        });
      }
    });
  }

  /**
   * Virgo Shaka Cosmo feel:
   * eyes-open gold hush → Tenbu Hōrin dharma wheels → 108 beads seal.
   */
  playTenbuHorin(ox, oy, range) {
    const cy = oy - 8;
    const gold = 0xffe082;
    const saffron = 0xe8d48a;
    const ivory = 0xfff6dc;
    const wood = 0xc49a5a;
    const ADD = Phaser.BlendModes.ADD;

    // --- 1. Eyes-open Cosmo bloom ---
    const bloom = this.add.circle(ox, cy, 22, gold, 0.45).setDepth(7);
    bloom.setBlendMode(ADD);
    this.tweens.add({
      targets: bloom,
      scale: range / 36,
      alpha: 0,
      duration: 900,
      ease: "Sine.Out",
      onComplete: () => bloom.destroy(),
    });

    // Lotus mandala behind the wheels
    const lotus = this.add.graphics().setDepth(7).setAlpha(0);
    lotus.setBlendMode(ADD);
    const drawLotus = (size, alpha) => {
      lotus.clear();
      lotus.lineStyle(2, gold, alpha * 0.85);
      for (let i = 0; i < 8; i += 1) {
        const a = (Math.PI * 2 * i) / 8 - Math.PI / 2;
        lotus.strokeEllipse(
          ox + Math.cos(a) * size * 0.35,
          cy + Math.sin(a) * size * 0.28,
          size * 0.55,
          size * 0.28,
        );
      }
      lotus.fillStyle(ivory, alpha * 0.35);
      lotus.fillCircle(ox, cy, size * 0.16);
    };
    const lotusState = { s: 40, a: 0 };
    this.tweens.add({
      targets: lotusState,
      s: range * 0.55,
      a: 0.9,
      duration: 480,
      ease: "Cubic.Out",
      onUpdate: () => {
        lotus.setAlpha(lotusState.a);
        drawLotus(lotusState.s, lotusState.a);
      },
    });
    this.tweens.add({
      targets: lotus,
      alpha: 0,
      delay: 700,
      duration: 360,
      onComplete: () => lotus.destroy(),
    });

    // --- 2. Dharma wheels (Tenbu Hōrin) ---
    for (let i = 0; i < 4; i += 1) {
      const wheel = this.add.graphics().setDepth(8).setAlpha(0);
      wheel.setBlendMode(ADD);
      const r = 36 + i * 22;
      const col = i % 2 === 0 ? gold : saffron;
      wheel.lineStyle(2.6 - i * 0.3, col, 0.95);
      wheel.strokeCircle(0, 0, r);
      wheel.lineStyle(1.6, ivory, 0.7);
      const spokes = 8 + i * 2;
      for (let s = 0; s < spokes; s += 1) {
        const a = (Math.PI * 2 * s) / spokes;
        wheel.lineBetween(Math.cos(a) * 8, Math.sin(a) * 7, Math.cos(a) * r, Math.sin(a) * r * 0.86);
      }
      wheel.setPosition(ox, cy);
      this.tweens.add({
        targets: wheel,
        alpha: 0.95,
        angle: i % 2 === 0 ? 140 : -140,
        duration: 220,
        delay: i * 70,
        yoyo: true,
        hold: 380,
        onComplete: () => wheel.destroy(),
      });
      this.tweens.add({
        targets: wheel,
        scale: range / (r * 1.6),
        duration: 820,
        delay: i * 70,
        ease: "Cubic.Out",
      });
    }

    // Six sense-strip rings (five senses + mind)
    for (let i = 0; i < 6; i += 1) {
      const ring = this.add.circle(ox, cy, 20, 0x000000, 0).setDepth(9);
      ring.setStrokeStyle(2.2, i === 5 ? ivory : gold, 0.9);
      this.tweens.add({
        targets: ring,
        scale: range / 20,
        alpha: 0,
        duration: 700,
        delay: 80 + i * 90,
        ease: "Sine.Out",
        onComplete: () => ring.destroy(),
      });
    }

    // --- 3. 108-beaded rosary strands ---
    const beadCount = 108;
    const strandCount = 6;
    const beadsPerStrand = beadCount / strandCount;

    for (let s = 0; s < strandCount; s += 1) {
      const baseAngle = (Math.PI * 2 * s) / strandCount;
      const points = [];

      for (let i = 0; i < beadsPerStrand; i += 1) {
        const t = i / (beadsPerStrand - 1);
        const angle = baseAngle + t * Math.PI * 1.75;
        const dist = 24 + t * range * 0.95;
        points.push({
          x: ox + Math.cos(angle) * dist,
          y: cy + Math.sin(angle) * dist * 0.82,
          t,
          i,
        });
      }

      const cord = this.add.graphics().setDepth(8).setAlpha(0.75);
      cord.lineStyle(2, wood, 0.85);
      cord.beginPath();
      cord.moveTo(ox, cy);
      for (const p of points) cord.lineTo(p.x, p.y);
      cord.strokePath();
      this.tweens.add({
        targets: cord,
        alpha: 0,
        duration: 900,
        delay: 200 + s * 40,
        onComplete: () => cord.destroy(),
      });

      for (const p of points) {
        const bead = this.add
          .image(ox, cy, "bead")
          .setDepth(10)
          .setScale(p.i % 6 === 0 ? 0.9 : 0.55);
        this.tweens.add({
          targets: bead,
          x: p.x,
          y: p.y,
          duration: 380 + p.i * 14,
          delay: s * 30,
          ease: "Cubic.Out",
          onComplete: () => {
            bead.setTint(0x1a1412);
            this.tweens.add({
              targets: bead,
              alpha: 0,
              scale: bead.scale * 1.4,
              duration: 320,
              delay: 120,
              onComplete: () => bead.destroy(),
            });
          },
        });
      }
    }

    // Rosary wraps each pest in range
    for (const enemy of this.enemies.getChildren()) {
      if (!enemy.active) continue;
      const dist = Phaser.Math.Distance.Between(ox, oy, enemy.x, enemy.y);
      if (dist > range) continue;

      const wrap = this.add.graphics().setDepth(9);
      const drawWrap = (radius, alpha) => {
        wrap.clear();
        wrap.lineStyle(2, wood, alpha);
        const beads = 14;
        for (let i = 0; i < beads; i += 1) {
          const a0 = (Math.PI * 2 * i) / beads;
          const a1 = (Math.PI * 2 * (i + 1)) / beads;
          wrap.beginPath();
          wrap.moveTo(enemy.x + Math.cos(a0) * radius, enemy.y + Math.sin(a0) * radius * 0.7);
          wrap.lineTo(enemy.x + Math.cos(a1) * radius, enemy.y + Math.sin(a1) * radius * 0.7);
          wrap.strokePath();
        }
      };
      drawWrap(10, 0.9);

      const wrapState = { r: 10, a: 0.9 };
      this.tweens.add({
        targets: wrapState,
        r: 34,
        a: 0,
        duration: 520,
        onUpdate: () => drawWrap(wrapState.r, wrapState.a),
        onComplete: () => wrap.destroy(),
      });

      for (let b = 0; b < 10; b += 1) {
        const ang = (Math.PI * 2 * b) / 10;
        const bead = this.add.image(ox, oy, "bead").setDepth(9).setScale(0.5);
        this.tweens.add({
          targets: bead,
          x: enemy.x + Math.cos(ang) * 22,
          y: enemy.y + Math.sin(ang) * 16,
          duration: 260 + b * 20,
          ease: "Back.Out",
          onComplete: () => {
            bead.setTint(0x221810);
            this.tweens.add({
              targets: bead,
              alpha: 0,
              duration: 280,
              onComplete: () => bead.destroy(),
            });
          },
        });
      }

      enemy.setTint(0xc49a5a);
      this.time.delayedCall(450, () => {
        if (enemy.active) enemy.clearTint();
      });
    }
  }

  /**
   * Aries Mu Cosmo feel (from classic Mu art):
   * lighted psychic grids + bright star core → stardust storm → extinction wink.
   */
  playStardustRevolution(ox, oy, range) {
    const cy = oy - 8;
    const gold = 0xffe082;
    const ice = 0xb8e4ff;
    const white = 0xffffff;
    const violet = 0x9b7cff;
    const ADD = Phaser.BlendModes.ADD;

    // Soft Cosmo wash so grids read as light, not lines on dark
    const wash = this.add.circle(ox, cy, 48, 0x4a3480, 0.45).setDepth(7);
    wash.setBlendMode(ADD);
    this.tweens.add({
      targets: wash,
      scale: range / 36,
      alpha: 0,
      duration: 1100,
      ease: "Sine.Out",
      onComplete: () => wash.destroy(),
    });

    // --- 1. Crystal Wall flash (brief) ---
    const wall = this.add
      .rectangle(ox, cy, 12, 100, ice, 0.14)
      .setDepth(8)
      .setStrokeStyle(2, white, 0.95);
    this.tweens.add({
      targets: wall,
      displayWidth: 160,
      displayHeight: 140,
      alpha: 0.55,
      duration: 110,
      yoyo: true,
      hold: 50,
      onComplete: () => wall.destroy(),
    });

    // --- 2. Bright center star (hero of the shot) ---
    const core = this.add.circle(ox, cy, 6, white, 1).setDepth(14);
    core.setBlendMode(ADD);
    const coreHalo = this.add.circle(ox, cy, 18, gold, 0.7).setDepth(13);
    coreHalo.setBlendMode(ADD);
    const coreBloom = this.add.circle(ox, cy, 34, violet, 0.45).setDepth(12);
    coreBloom.setBlendMode(ADD);
    this.tweens.add({
      targets: core,
      scale: 5.2,
      duration: 480,
      ease: "Sine.Out",
    });
    this.tweens.add({
      targets: coreHalo,
      scale: 4.4,
      alpha: 0.95,
      duration: 480,
      ease: "Sine.Out",
    });
    this.tweens.add({
      targets: coreBloom,
      scale: 3.8,
      alpha: 0.55,
      duration: 520,
      ease: "Sine.Out",
    });

    // Filled multi-point Cosmo star + cross rays
    const starGfx = this.add.graphics().setDepth(13).setAlpha(0);
    starGfx.setBlendMode(ADD);
    const drawCenterStar = (radius, alpha, pulse = 1) => {
      starGfx.clear();
      const r = radius * pulse;
      // Soft glow disc
      starGfx.fillStyle(gold, alpha * 0.22);
      starGfx.fillCircle(ox, cy, r * 0.95);
      starGfx.fillStyle(white, alpha * 0.35);
      starGfx.fillCircle(ox, cy, r * 0.42);

      // 8-point filled star
      starGfx.fillStyle(white, alpha * 0.9);
      starGfx.beginPath();
      for (let i = 0; i < 16; i += 1) {
        const a = (Math.PI * 2 * i) / 16 - Math.PI / 2;
        const rr = i % 2 === 0 ? r : r * 0.38;
        const x = ox + Math.cos(a) * rr;
        const y = cy + Math.sin(a) * rr * 0.88;
        if (i === 0) starGfx.moveTo(x, y);
        else starGfx.lineTo(x, y);
      }
      starGfx.closePath();
      starGfx.fillPath();

      // Outer star outline in gold
      starGfx.lineStyle(2.4, gold, alpha);
      starGfx.beginPath();
      for (let i = 0; i < 16; i += 1) {
        const a = (Math.PI * 2 * i) / 16 - Math.PI / 2;
        const rr = i % 2 === 0 ? r * 1.08 : r * 0.42;
        const x = ox + Math.cos(a) * rr;
        const y = cy + Math.sin(a) * rr * 0.88;
        if (i === 0) starGfx.moveTo(x, y);
        else starGfx.lineTo(x, y);
      }
      starGfx.closePath();
      starGfx.strokePath();

      // Long cross rays through the star
      starGfx.lineStyle(2, white, alpha * 0.85);
      for (let i = 0; i < 4; i += 1) {
        const a = (Math.PI * 2 * i) / 4 - Math.PI / 2;
        starGfx.beginPath();
        starGfx.moveTo(ox - Math.cos(a) * r * 1.35, cy - Math.sin(a) * r * 1.2);
        starGfx.lineTo(ox + Math.cos(a) * r * 1.35, cy + Math.sin(a) * r * 1.2);
        starGfx.strokePath();
      }
      // Diagonal gold rays
      starGfx.lineStyle(1.4, gold, alpha * 0.7);
      for (let i = 0; i < 4; i += 1) {
        const a = (Math.PI * 2 * i) / 4 - Math.PI / 4;
        starGfx.beginPath();
        starGfx.moveTo(ox - Math.cos(a) * r * 1.1, cy - Math.sin(a) * r * 0.95);
        starGfx.lineTo(ox + Math.cos(a) * r * 1.1, cy + Math.sin(a) * r * 0.95);
        starGfx.strokePath();
      }
    };
    const starState = { r: 14, a: 0, pulse: 1 };
    this.tweens.add({
      targets: starState,
      r: 88,
      a: 1,
      duration: 360,
      ease: "Cubic.Out",
      onUpdate: () => {
        starGfx.setAlpha(1);
        drawCenterStar(starState.r, starState.a, starState.pulse);
      },
    });
    this.tweens.add({
      targets: starState,
      pulse: 1.12,
      duration: 180,
      delay: 360,
      yoyo: true,
      repeat: 2,
      ease: "Sine.InOut",
      onUpdate: () => drawCenterStar(starState.r, starState.a, starState.pulse),
    });

    // --- 3. Lighted grids (main Cosmo look) ---
    // Polar grid: rings + spokes + bright nodes, slowly spins
    const polar = this.add.graphics().setDepth(9).setAlpha(0);
    polar.setBlendMode(ADD);
    const drawPolarGrid = (radius, alpha, spin = 0) => {
      polar.clear();
      const rings = 7;
      for (let r = 1; r <= rings; r += 1) {
        const rr = (radius * r) / rings;
        const col = r % 3 === 0 ? gold : r % 3 === 1 ? ice : white;
        polar.lineStyle(r === rings ? 2.4 : 1.35, col, alpha * (0.5 + r * 0.07));
        polar.strokeEllipse(ox, cy, rr * 2, rr * 1.7);
      }
      const spokes = 20;
      for (let i = 0; i < spokes; i += 1) {
        const a = spin + (Math.PI * 2 * i) / spokes;
        polar.lineStyle(1.25, i % 2 === 0 ? white : ice, alpha * 0.65);
        polar.beginPath();
        polar.moveTo(ox + Math.cos(a) * 16, cy + Math.sin(a) * 14);
        polar.lineTo(ox + Math.cos(a) * radius, cy + Math.sin(a) * radius * 0.85);
        polar.strokePath();
      }
      for (let r = 1; r <= rings; r += 1) {
        const rr = (radius * r) / rings;
        for (let i = 0; i < spokes; i += 1) {
          const a = spin + (Math.PI * 2 * i) / spokes;
          const nodeR = i % 2 === 0 ? 2.4 : 1.5;
          polar.fillStyle(i % 3 === 0 ? gold : white, alpha * 0.9);
          polar.fillCircle(ox + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.85, nodeR);
        }
      }
    };
    const polarState = { r: 36, a: 0, spin: 0 };
    this.tweens.add({
      targets: polarState,
      r: range * 1.02,
      a: 1,
      spin: 0.7,
      duration: 780,
      ease: "Cubic.Out",
      onUpdate: () => {
        polar.setAlpha(polarState.a);
        drawPolarGrid(polarState.r, polarState.a, polarState.spin);
      },
    });
    this.tweens.add({
      targets: polar,
      alpha: 0,
      delay: 820,
      duration: 380,
      onComplete: () => polar.destroy(),
    });

    // Nested square Cosmo boards (axis-aligned + diamond) expanding from the star
    const spawnLattice = (n, rotated, delay, maxScale) => {
      const lattice = this.add.graphics().setDepth(8).setAlpha(0);
      lattice.setBlendMode(ADD);
      const drawLattice = (size, alpha) => {
        lattice.clear();
        const half = size / 2;
        const cells = 7;
        const h = size * (rotated ? 0.78 : 0.88);
        const col = n % 2 === 0 ? ice : gold;
        const rot = rotated ? Math.PI / 4 : 0;

        const corner = (sx, sy) => {
          const lx = sx * half;
          const ly = sy * (h / 2);
          return {
            x: ox + lx * Math.cos(rot) - ly * Math.sin(rot),
            y: cy + lx * Math.sin(rot) + ly * Math.cos(rot),
          };
        };

        // Frame
        lattice.lineStyle(2, col, alpha * 0.95);
        const c00 = corner(-1, -1);
        const c10 = corner(1, -1);
        const c11 = corner(1, 1);
        const c01 = corner(-1, 1);
        lattice.beginPath();
        lattice.moveTo(c00.x, c00.y);
        lattice.lineTo(c10.x, c10.y);
        lattice.lineTo(c11.x, c11.y);
        lattice.lineTo(c01.x, c01.y);
        lattice.closePath();
        lattice.strokePath();

        // Grid lines
        for (let i = 1; i < cells; i += 1) {
          const t = (i / cells) * 2 - 1;
          const a = corner(t, -1);
          const b = corner(t, 1);
          const c = corner(-1, t);
          const d = corner(1, t);
          lattice.lineStyle(1.2, i % 2 === 0 ? white : col, alpha * 0.7);
          lattice.lineBetween(a.x, a.y, b.x, b.y);
          lattice.lineBetween(c.x, c.y, d.x, d.y);
        }

        // Lit nodes on the board
        for (let i = 0; i <= cells; i += 1) {
          for (let j = 0; j <= cells; j += 1) {
            if ((i + j) % 2 !== 0) continue;
            const t = (i / cells) * 2 - 1;
            const u = (j / cells) * 2 - 1;
            const p = corner(t, u);
            lattice.fillStyle(white, alpha * 0.85);
            lattice.fillCircle(p.x, p.y, 1.8);
          }
        }
      };
      const latState = { s: 40, a: 0 };
      this.tweens.add({
        targets: latState,
        s: range * maxScale,
        a: 0.92,
        duration: 560,
        delay,
        ease: "Cubic.Out",
        onUpdate: () => {
          lattice.setAlpha(latState.a);
          drawLattice(latState.s, latState.a);
        },
      });
      this.tweens.add({
        targets: lattice,
        alpha: 0,
        delay: 620 + delay,
        duration: 360,
        onComplete: () => lattice.destroy(),
      });
    };
    spawnLattice(0, false, 20, 0.62);
    spawnLattice(1, true, 70, 0.72);
    spawnLattice(2, false, 120, 0.88);
    spawnLattice(3, true, 170, 0.98);

    // Perspective floor grid rising toward the star (psychic Cosmo board)
    const floor = this.add.graphics().setDepth(8).setAlpha(0);
    floor.setBlendMode(ADD);
    const drawFloorGrid = (spread, alpha) => {
      floor.clear();
      const rows = 6;
      const cols = 10;
      const nearY = cy + 18;
      const farY = cy - spread * 0.55;
      for (let r = 0; r <= rows; r += 1) {
        const t = r / rows;
        const y = nearY + (farY - nearY) * t;
        const halfW = spread * (0.35 + (1 - t) * 0.65);
        floor.lineStyle(1.3, r % 2 === 0 ? ice : gold, alpha * (0.35 + t * 0.5));
        floor.lineBetween(ox - halfW, y, ox + halfW, y);
      }
      for (let c = 0; c <= cols; c += 1) {
        const u = c / cols;
        const xNear = ox - spread * 0.95 + spread * 1.9 * u;
        const xFar = ox - spread * 0.28 + spread * 0.56 * u;
        floor.lineStyle(1.15, c % 2 === 0 ? white : ice, alpha * 0.55);
        floor.lineBetween(xNear, nearY, xFar, farY);
      }
      // Star sits at vanishing point — small accent ring
      floor.lineStyle(1.6, gold, alpha * 0.8);
      floor.strokeEllipse(ox, farY, 22, 12);
    };
    const floorState = { s: 80, a: 0 };
    this.tweens.add({
      targets: floorState,
      s: range * 1.05,
      a: 0.9,
      duration: 640,
      delay: 40,
      ease: "Cubic.Out",
      onUpdate: () => {
        floor.setAlpha(floorState.a);
        drawFloorGrid(floorState.s, floorState.a);
      },
    });
    this.tweens.add({
      targets: floor,
      alpha: 0,
      delay: 700,
      duration: 360,
      onComplete: () => floor.destroy(),
    });

    // --- 4. Stardust rides the lighted grid ---
    this.time.delayedCall(260, () => {
      if (this.ended) return;
      for (let i = 0; i < 64; i += 1) {
        const spoke = (Math.PI * 2 * (i % 20)) / 20 + (Math.random() - 0.5) * 0.06;
        const dist = range * (0.35 + Math.random() * 0.65);
        const dust = this.add
          .circle(
            ox,
            cy,
            i % 5 === 0 ? 4.5 : 2.4,
            i % 3 === 0 ? gold : i % 3 === 1 ? white : ice,
            1,
          )
          .setDepth(14);
        dust.setBlendMode(ADD);
        this.tweens.add({
          targets: dust,
          x: ox + Math.cos(spoke) * dist,
          y: cy + Math.sin(spoke) * dist * 0.85,
          alpha: 0,
          scale: 0.2,
          duration: Phaser.Math.Between(440, 760),
          delay: Phaser.Math.Between(0, 200),
          ease: "Cubic.Out",
          onComplete: () => dust.destroy(),
        });
      }
    });

    // --- 5. Starlight Extinction — star flares then erase ---
    this.time.delayedCall(700, () => {
      if (this.ended) return;
      this.tweens.add({
        targets: core,
        alpha: 0,
        scale: 0.15,
        duration: 240,
        onComplete: () => core.destroy(),
      });
      this.tweens.add({
        targets: coreHalo,
        alpha: 0,
        scale: 0.15,
        duration: 240,
        onComplete: () => coreHalo.destroy(),
      });
      this.tweens.add({
        targets: coreBloom,
        alpha: 0,
        scale: 0.2,
        duration: 240,
        onComplete: () => coreBloom.destroy(),
      });
      this.tweens.add({
        targets: starGfx,
        alpha: 0,
        duration: 240,
        onComplete: () => starGfx.destroy(),
      });

      for (let i = 0; i < 5; i += 1) {
        const ring = this.add.circle(ox, cy, 18, 0x000000, 0).setDepth(14);
        ring.setStrokeStyle(2.6, i % 2 === 0 ? white : gold, 0.95);
        this.tweens.add({
          targets: ring,
          scale: range / 18,
          alpha: 0,
          duration: 500,
          delay: i * 40,
          ease: "Cubic.Out",
          onComplete: () => ring.destroy(),
        });
      }
      const erase = this.add.circle(ox, cy, 18, white, 0.7).setDepth(15);
      erase.setBlendMode(ADD);
      this.tweens.add({
        targets: erase,
        scale: range / 18,
        alpha: 0,
        duration: 420,
        ease: "Cubic.Out",
        onComplete: () => erase.destroy(),
      });
    });
  }

  /**
   * Taurus Aldebaran Cosmo feel:
   * crossed-arms charge → twin Great Horn Cosmo waves → ground-breaking titan quake.
   */
  playGreatHorn(ox, oy, range) {
    const cy = oy - 6;
    const gold = 0xffe082;
    const bronze = 0xd4a85a;
    const ember = 0xffa040;
    const white = 0xffffff;
    const ADD = Phaser.BlendModes.ADD;

    // --- 1. Crossed-arms Cosmo charge (brief) ---
    const charge = this.add.circle(ox, cy, 18, gold, 0.55).setDepth(10);
    charge.setBlendMode(ADD);
    this.tweens.add({
      targets: charge,
      scale: 2.6,
      alpha: 0.9,
      duration: 100,
      yoyo: true,
      hold: 40,
      onComplete: () => charge.destroy(),
    });

    // Twin horn silhouettes forming over the saint
    const horns = this.add.graphics().setDepth(11).setAlpha(0);
    horns.setBlendMode(ADD);
    const drawHorns = (len, alpha) => {
      horns.clear();
      horns.lineStyle(7, gold, alpha);
      horns.beginPath();
      horns.moveTo(ox - 8, cy - 4);
      horns.lineTo(ox - len * 0.55, cy - len * 0.75);
      horns.strokePath();
      horns.beginPath();
      horns.moveTo(ox + 8, cy - 4);
      horns.lineTo(ox + len * 0.55, cy - len * 0.75);
      horns.strokePath();
      horns.lineStyle(3, white, alpha * 0.85);
      horns.beginPath();
      horns.moveTo(ox - 8, cy - 4);
      horns.lineTo(ox - len * 0.5, cy - len * 0.68);
      horns.strokePath();
      horns.beginPath();
      horns.moveTo(ox + 8, cy - 4);
      horns.lineTo(ox + len * 0.5, cy - len * 0.68);
      horns.strokePath();
      horns.fillStyle(white, alpha);
      horns.fillCircle(ox - len * 0.55, cy - len * 0.75, 4);
      horns.fillCircle(ox + len * 0.55, cy - len * 0.75, 4);
    };
    const hornState = { len: 30, a: 0 };
    this.tweens.add({
      targets: hornState,
      len: 110,
      a: 1,
      duration: 140,
      ease: "Cubic.Out",
      onUpdate: () => {
        horns.setAlpha(hornState.a);
        drawHorns(hornState.len, hornState.a);
      },
    });
    this.tweens.add({
      targets: horns,
      alpha: 0,
      delay: 200,
      duration: 180,
      onComplete: () => horns.destroy(),
    });

    // --- 2. Twin Great Horn Cosmo waves (hero of the VFX) ---
    this.time.delayedCall(80, () => {
      if (this.ended) return;

      // Expanding ground shock (titan stomp)
      for (let i = 0; i < 4; i += 1) {
        const shock = this.add
          .ellipse(ox, oy + 10, 36, 18, bronze, 0.5 - i * 0.08)
          .setDepth(7);
        shock.setBlendMode(ADD);
        this.tweens.add({
          targets: shock,
          scaleX: range / 28,
          scaleY: range / 55,
          alpha: 0,
          duration: 480,
          delay: i * 45,
          ease: "Cubic.Out",
          onComplete: () => shock.destroy(),
        });
      }

      // Twin horn Cosmo cones blasting outward (left / right / center)
      const blastDirs = [
        { ang: -0.55, col: gold },
        { ang: 0.55, col: ember },
        { ang: 0, col: white },
      ];
      for (let pass = 0; pass < 3; pass += 1) {
        for (const dir of blastDirs) {
          const cone = this.add.graphics().setDepth(8).setAlpha(0);
          cone.setBlendMode(ADD);
          const tip = range * (0.85 + pass * 0.08);
          const baseLx = ox + Math.cos(dir.ang - 0.55) * tip;
          const baseLy = oy + Math.sin(dir.ang - 0.35) * tip * 0.72;
          const baseRx = ox + Math.cos(dir.ang + 0.55) * tip;
          const baseRy = oy + Math.sin(dir.ang + 0.35) * tip * 0.72;
          cone.fillStyle(dir.col, 0.42 - pass * 0.08);
          cone.fillTriangle(ox, cy, baseLx, baseLy, baseRx, baseRy);
          cone.lineStyle(2.2, white, 0.55 - pass * 0.1);
          cone.strokeTriangle(ox, cy, baseLx, baseLy, baseRx, baseRy);
          this.tweens.add({
            targets: cone,
            alpha: 0.85,
            duration: 70,
            delay: pass * 55,
            yoyo: true,
            hold: 40,
            onComplete: () => cone.destroy(),
          });
        }
      }

      // Radial Cosmo rings — light-speed impact
      for (let i = 0; i < 5; i += 1) {
        const ring = this.add.circle(ox, cy, 16, 0x000000, 0).setDepth(9);
        ring.setStrokeStyle(3.2 - i * 0.35, i % 2 === 0 ? gold : white, 0.95);
        this.tweens.add({
          targets: ring,
          scale: range / 16,
          alpha: 0,
          duration: 420,
          delay: i * 40,
          ease: "Cubic.Out",
          onComplete: () => ring.destroy(),
        });
      }

      // Bright core flash at the crossed-arms release
      const flash = this.add.circle(ox, cy, 22, white, 0.85).setDepth(12);
      flash.setBlendMode(ADD);
      this.tweens.add({
        targets: flash,
        scale: 4.5,
        alpha: 0,
        duration: 280,
        ease: "Cubic.Out",
        onComplete: () => flash.destroy(),
      });
    });

    // --- 3. Stone dust + Cosmo sparks ---
    this.time.delayedCall(100, () => {
      if (this.ended) return;
      for (let i = 0; i < 36; i += 1) {
        const angle = (Math.PI * 2 * i) / 36 + (Math.random() - 0.5) * 0.2;
        const dist = range * (0.35 + Math.random() * 0.65);
        const isSpark = i % 3 === 0;
        const dust = this.add
          .circle(
            ox,
            oy,
            isSpark ? 3.5 : Phaser.Math.Between(5, 10),
            isSpark ? gold : i % 2 === 0 ? bronze : ember,
            0.95,
          )
          .setDepth(10);
        if (isSpark) dust.setBlendMode(ADD);
        this.tweens.add({
          targets: dust,
          x: ox + Math.cos(angle) * dist,
          y: oy + Math.sin(angle) * dist * 0.72,
          alpha: 0,
          scale: 0.2,
          duration: Phaser.Math.Between(380, 620),
          delay: Phaser.Math.Between(0, 120),
          ease: "Cubic.Out",
          onComplete: () => dust.destroy(),
        });
      }

      // Ground crack lines radiating from impact
      const cracks = this.add.graphics().setDepth(7).setAlpha(0.9);
      cracks.lineStyle(2.2, bronze, 0.85);
      for (let i = 0; i < 10; i += 1) {
        const a = (Math.PI * 2 * i) / 10 + 0.12;
        const len = range * (0.45 + (i % 3) * 0.12);
        cracks.beginPath();
        cracks.moveTo(ox + Math.cos(a) * 18, oy + Math.sin(a) * 10);
        cracks.lineTo(ox + Math.cos(a) * len, oy + Math.sin(a) * len * 0.55);
        cracks.strokePath();
      }
      this.tweens.add({
        targets: cracks,
        alpha: 0,
        duration: 520,
        delay: 180,
        onComplete: () => cracks.destroy(),
      });
    });
  }

  /**
   * Cancer Deathmask Cosmo feel:
   * underworld gate opens → souls / Praesepe pulled in → Sekishiki waves.
   */
  playSekishiki(ox, oy, range) {
    const cy = oy - 12;
    const violet = 0xc9a0e0;
    const deep = 0x6a40a0;
    const lilac = 0xe8d0ff;
    const white = 0xffffff;
    const voidCol = 0x2a1048;
    const ADD = Phaser.BlendModes.ADD;

    // Mist wash toward Yomotsu
    const mist = this.add.circle(ox, cy, 36, voidCol, 0.5).setDepth(6);
    mist.setBlendMode(ADD);
    this.tweens.add({
      targets: mist,
      scale: range / 30,
      alpha: 0,
      duration: 1100,
      ease: "Sine.Out",
      onComplete: () => mist.destroy(),
    });

    // --- 1. Finger Cosmo tip (Sekishiki point) ---
    const tip = this.add.circle(ox + 18, cy - 28, 5, lilac, 0.95).setDepth(13);
    tip.setBlendMode(ADD);
    this.tweens.add({
      targets: tip,
      scale: 2.4,
      alpha: 1,
      duration: 160,
      yoyo: true,
      hold: 80,
      onComplete: () => tip.destroy(),
    });

    // --- 2. Underworld gate (Yomotsu Hirasaka oval) ---
    const gate = this.add.ellipse(ox, cy, 28, 48, deep, 0.55).setDepth(7);
    gate.setStrokeStyle(3, violet, 0.95);
    gate.setBlendMode(ADD);
    const gateCore = this.add.ellipse(ox, cy, 14, 26, 0x100818, 0.85).setDepth(8);
    this.tweens.add({
      targets: gate,
      scaleX: range / 50,
      scaleY: range / 70,
      alpha: 0.75,
      duration: 420,
      ease: "Cubic.Out",
    });
    this.tweens.add({
      targets: gateCore,
      scaleX: range / 55,
      scaleY: range / 80,
      alpha: 0.7,
      duration: 420,
      ease: "Cubic.Out",
    });
    this.tweens.add({
      targets: [gate, gateCore],
      alpha: 0,
      delay: 720,
      duration: 380,
      onComplete: () => {
        gate.destroy();
        gateCore.destroy();
      },
    });

    // Gate rim rings (odd white / violet Sekishiki rings)
    for (let i = 0; i < 5; i += 1) {
      const ring = this.add.ellipse(ox, cy, 36, 58, 0x000000, 0).setDepth(9);
      ring.setStrokeStyle(2.4, i % 2 === 0 ? lilac : white, 0.9);
      this.tweens.add({
        targets: ring,
        scaleX: 1.2 + i * 0.55,
        scaleY: 1.2 + i * 0.55,
        alpha: 0,
        duration: 700,
        delay: 80 + i * 70,
        ease: "Cubic.Out",
        onComplete: () => ring.destroy(),
      });
    }

    // --- 3. Skull souls / Praesepe pulled INTO the gate ---
    const spawnSkull = (x, y, size, color) => {
      const g = this.add.graphics().setDepth(11);
      // Cranium
      g.fillStyle(color, 0.95);
      g.fillEllipse(0, -size * 0.12, size * 1.15, size * 1.25);
      // Jaw
      g.fillRoundedRect(-size * 0.48, size * 0.12, size * 0.96, size * 0.5, size * 0.12);
      // Eye sockets
      g.fillStyle(0x100818, 0.95);
      g.fillCircle(-size * 0.28, -size * 0.08, size * 0.24);
      g.fillCircle(size * 0.28, -size * 0.08, size * 0.24);
      // Nose
      g.fillTriangle(0, size * 0.05, -size * 0.12, size * 0.28, size * 0.12, size * 0.28);
      // Teeth slits
      g.lineStyle(1.2, 0x100818, 0.7);
      g.lineBetween(-size * 0.28, size * 0.38, size * 0.28, size * 0.38);
      g.setPosition(x, y);
      g.setBlendMode(ADD);
      return g;
    };

    this.time.delayedCall(120, () => {
      if (this.ended) return;
      for (let i = 0; i < 40; i += 1) {
        const angle = (Math.PI * 2 * i) / 40 + Math.random() * 0.15;
        const far = range * (0.45 + Math.random() * 0.55);
        const size = i % 4 === 0 ? 11 : i % 2 === 0 ? 8 : 6;
        const color = i % 3 === 0 ? lilac : i % 3 === 1 ? violet : deep;
        const skull = spawnSkull(
          ox + Math.cos(angle) * far,
          cy + Math.sin(angle) * far * 0.78,
          size,
          color,
        );
        this.tweens.add({
          targets: skull,
          x: ox + Phaser.Math.Between(-8, 8),
          y: cy + Phaser.Math.Between(-10, 10),
          alpha: 0,
          scale: 0.2,
          angle: Phaser.Math.Between(-40, 40),
          duration: Phaser.Math.Between(420, 720),
          delay: (i % 10) * 28,
          ease: "Cubic.In",
          onComplete: () => skull.destroy(),
        });
      }

      // Wisp trails spiraling into the maw
      for (let i = 0; i < 16; i += 1) {
        const base = (Math.PI * 2 * i) / 16;
        const wisp = this.add.graphics().setDepth(10).setAlpha(0);
        wisp.setBlendMode(ADD);
        wisp.lineStyle(2, i % 2 === 0 ? violet : lilac, 0.85);
        wisp.beginPath();
        for (let s = 0; s <= 18; s += 1) {
          const t = s / 18;
          const ang = base + t * Math.PI * 1.4;
          const dist = range * (0.9 - t * 0.85);
          const x = ox + Math.cos(ang) * dist;
          const y = cy + Math.sin(ang) * dist * 0.75;
          if (s === 0) wisp.moveTo(x, y);
          else wisp.lineTo(x, y);
        }
        wisp.strokePath();
        this.tweens.add({
          targets: wisp,
          alpha: 0.9,
          duration: 100,
          delay: i * 25,
          yoyo: true,
          hold: 220,
          onComplete: () => wisp.destroy(),
        });
      }
    });

    // --- 4. Sekishiki wave pulses outward after the pull ---
    this.time.delayedCall(380, () => {
      if (this.ended) return;
      for (let i = 0; i < 4; i += 1) {
        const wave = this.add.ellipse(ox, cy, 40, 64, 0x000000, 0).setDepth(10);
        wave.setStrokeStyle(3, i % 2 === 0 ? violet : white, 0.95);
        this.tweens.add({
          targets: wave,
          scaleX: range / 40,
          scaleY: range / 55,
          alpha: 0,
          duration: 560,
          delay: i * 70,
          ease: "Cubic.Out",
          onComplete: () => wave.destroy(),
        });
      }
      // Void flash at the gate
      const flash = this.add.ellipse(ox, cy, 30, 48, lilac, 0.7).setDepth(12);
      flash.setBlendMode(ADD);
      this.tweens.add({
        targets: flash,
        scaleX: 3.2,
        scaleY: 3.6,
        alpha: 0,
        duration: 420,
        ease: "Cubic.Out",
        onComplete: () => flash.destroy(),
      });
    });
  }

  /**
   * Leo Aiolia Cosmo feel:
   * fist charge → net of light rays (Lightning Plasma) → million-punch sparks.
   */
  playLightningPlasma(ox, oy, range) {
    const cy = oy - 8;
    const gold = 0xffe082;
    const amber = 0xffc04a;
    const white = 0xffffff;
    const bolt = 0xa8e8ff;
    const ADD = Phaser.BlendModes.ADD;

    // --- 1. Fist Cosmo charge ---
    const fist = this.add.circle(ox, cy, 12, gold, 0.85).setDepth(12);
    fist.setBlendMode(ADD);
    this.tweens.add({
      targets: fist,
      scale: 2.8,
      alpha: 1,
      duration: 80,
      yoyo: true,
      hold: 30,
      onComplete: () => fist.destroy(),
    });

    // --- 2. Light-ray net (hero of the VFX — trapped in a net of light) ---
    const net = this.add.graphics().setDepth(8).setAlpha(0);
    net.setBlendMode(ADD);
    const drawNet = (spread, alpha, jitter = 0) => {
      net.clear();
      const rays = 14;
      for (let i = 0; i < rays; i += 1) {
        const a = (Math.PI * 2 * i) / rays + jitter * 0.04;
        net.lineStyle(i % 2 === 0 ? 2.4 : 1.4, i % 3 === 0 ? white : gold, alpha * 0.85);
        net.beginPath();
        net.moveTo(ox + Math.cos(a) * 10, cy + Math.sin(a) * 8);
        net.lineTo(ox + Math.cos(a) * spread, cy + Math.sin(a) * spread * 0.82);
        net.strokePath();
      }
      // Cross-weave so it reads as a net, not just spokes
      for (let r = 1; r <= 4; r += 1) {
        const rr = (spread * r) / 4.2;
        net.lineStyle(1.3, r % 2 === 0 ? amber : bolt, alpha * 0.55);
        net.strokeEllipse(ox, cy, rr * 2, rr * 1.64);
      }
      // Intersection sparks
      for (let i = 0; i < rays; i += 2) {
        const a = (Math.PI * 2 * i) / rays + jitter * 0.04;
        for (let r = 1; r <= 4; r += 1) {
          const rr = (spread * r) / 4.2;
          net.fillStyle(white, alpha * 0.9);
          net.fillCircle(ox + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.82, 2.2);
        }
      }
    };
    const netState = { s: 40, a: 0, j: 0 };
    this.tweens.add({
      targets: netState,
      s: range * 1.05,
      a: 1,
      j: 6,
      duration: 280,
      ease: "Cubic.Out",
      onUpdate: () => {
        net.setAlpha(netState.a);
        drawNet(netState.s, netState.a, netState.j);
      },
    });
    this.tweens.add({
      targets: net,
      alpha: 0,
      delay: 520,
      duration: 220,
      onComplete: () => net.destroy(),
    });

    // --- 3. Million-punch sparks racing along the net ---
    for (let i = 0; i < 64; i += 1) {
      const a = (Math.PI * 2 * (i % 14)) / 14 + (Math.random() - 0.5) * 0.08;
      const dist = range * (0.25 + Math.random() * 0.75);
      const spark = this.add
        .circle(ox, cy, i % 5 === 0 ? 4.5 : 2.4, i % 3 === 0 ? white : i % 3 === 1 ? gold : bolt, 1)
        .setDepth(12);
      spark.setBlendMode(ADD);
      this.tweens.add({
        targets: spark,
        x: ox + Math.cos(a) * dist,
        y: cy + Math.sin(a) * dist * 0.82,
        alpha: 0,
        scale: 0.2,
        duration: Phaser.Math.Between(180, 340),
        delay: Math.floor(i / 8) * 22 + Phaser.Math.Between(0, 40),
        ease: "Cubic.Out",
        onComplete: () => spark.destroy(),
      });
    }

    // Streak punches (short gold bars at light speed)
    for (let i = 0; i < 36; i += 1) {
      const a = (Math.PI * 2 * i) / 36 + (Math.random() - 0.5) * 0.12;
      const bar = this.add
        .rectangle(ox, cy, 5, 16, i % 2 === 0 ? gold : white, 0.95)
        .setDepth(11)
        .setRotation(a);
      bar.setBlendMode(ADD);
      this.tweens.add({
        targets: bar,
        displayHeight: range * (0.55 + Math.random() * 0.45),
        alpha: 0,
        duration: 220,
        delay: (i % 9) * 18,
        ease: "Cubic.Out",
        onComplete: () => bar.destroy(),
      });
    }

    // --- 4. Electric forks (Episode G plasma bite) ---
    for (let i = 0; i < 10; i += 1) {
      const g = this.add.graphics().setDepth(10);
      const a0 = (Math.PI * 2 * i) / 10;
      g.lineStyle(2, i % 2 === 0 ? bolt : gold, 0.95);
      g.beginPath();
      let x = ox;
      let y = cy;
      g.moveTo(x, y);
      for (let s = 0; s < 7; s += 1) {
        x += Math.cos(a0) * (range / 7) + Phaser.Math.Between(-14, 14);
        y += Math.sin(a0) * (range / 8.5) + Phaser.Math.Between(-12, 12);
        g.lineTo(x, y);
      }
      g.strokePath();
      g.setBlendMode(ADD);
      this.tweens.add({
        targets: g,
        alpha: 0,
        duration: 280,
        delay: 40 + i * 28,
        onComplete: () => g.destroy(),
      });
    }

    // Core flash at the fists
    const flash = this.add.circle(ox, cy, 18, white, 0.8).setDepth(13);
    flash.setBlendMode(ADD);
    this.tweens.add({
      targets: flash,
      scale: 3.6,
      alpha: 0,
      duration: 240,
      ease: "Cubic.Out",
      onComplete: () => flash.destroy(),
    });
  }

  /**
   * Libra Dohko Cosmo feel:
   * golden scales judge → twelve Cloth weapons fly out in pairs.
   */
  playLibraWeapons(ox, oy, range) {
    const cy = oy - 10;
    const gold = 0xe8d090;
    const bronze = 0xc8b070;
    const bright = 0xfff4d0;
    const ADD = Phaser.BlendModes.ADD;

    // --- 1. Scales of justice ---
    const scales = this.add.graphics().setDepth(10).setAlpha(0);
    scales.setBlendMode(ADD);
    scales.lineStyle(4, gold, 0.95);
    scales.lineBetween(-70, -8, 70, -8);
    scales.lineBetween(0, -28, 0, 22);
    scales.lineStyle(3, bright, 0.9);
    scales.strokeCircle(-52, 18, 18);
    scales.strokeCircle(52, 18, 18);
    scales.fillStyle(gold, 0.35);
    scales.fillCircle(-52, 18, 12);
    scales.fillCircle(52, 18, 12);
    scales.setPosition(ox, cy);
    this.tweens.add({
      targets: scales,
      alpha: 1,
      scale: 1.35,
      duration: 180,
      ease: "Back.Out",
    });
    this.tweens.add({
      targets: scales,
      alpha: 0,
      scale: 2.1,
      delay: 280,
      duration: 320,
      onComplete: () => scales.destroy(),
    });

    const core = this.add.circle(ox, cy, 14, gold, 0.7).setDepth(11);
    core.setBlendMode(ADD);
    this.tweens.add({
      targets: core,
      scale: 3.2,
      alpha: 0,
      duration: 420,
      ease: "Cubic.Out",
      onComplete: () => core.destroy(),
    });

    // --- 2. Twelve weapons (6 pairs) ---
    const kinds = ["sword", "shield", "spear", "tonfa", "nunchuk", "rod"];
    let idx = 0;
    for (const kind of kinds) {
      for (const side of [-1, 1]) {
        const angle = (Math.PI * 2 * idx) / 12 + (side < 0 ? 0 : 0.02);
        const delay = 80 + Math.floor(idx / 2) * 55;
        this.spawnLibraWeapon(kind, ox, cy, angle, range, delay);
        idx += 1;
      }
    }

    // Shock rings as weapons leave the Cloth
    for (let i = 0; i < 4; i += 1) {
      const ring = this.add.circle(ox, cy, 18, 0x000000, 0).setDepth(8);
      ring.setStrokeStyle(2.4, i % 2 === 0 ? gold : bright, 0.9);
      this.tweens.add({
        targets: ring,
        scale: range / 18,
        alpha: 0,
        duration: 520,
        delay: 60 + i * 70,
        ease: "Cubic.Out",
        onComplete: () => ring.destroy(),
      });
    }
  }

  spawnLibraWeapon(kind, ox, cy, angle, range, delay) {
    const gold = 0xe8d090;
    const bronze = 0xc8b070;
    const bright = 0xfff4d0;
    const ADD = Phaser.BlendModes.ADD;
    const dist = range * 0.92;
    const tx = ox + Math.cos(angle) * dist;
    const ty = cy + Math.sin(angle) * dist * 0.8;
    let obj;

    if (kind === "sword") {
      obj = this.add
        .image(ox, cy, "libra-blade")
        .setDepth(12)
        .setOrigin(0.1, 0.5)
        .setRotation(angle)
        .setScale(1.05);
    } else if (kind === "shield") {
      obj = this.add.circle(ox, cy, 14, bronze, 0.85).setDepth(12);
      obj.setStrokeStyle(3, gold, 0.95);
    } else if (kind === "spear") {
      obj = this.add
        .rectangle(ox, cy, 8, 46, gold, 0.95)
        .setDepth(12)
        .setOrigin(0.5, 1)
        .setRotation(angle);
    } else if (kind === "tonfa") {
      obj = this.add
        .rectangle(ox, cy, 10, 32, bronze, 0.95)
        .setDepth(12)
        .setOrigin(0.5, 0.8)
        .setRotation(angle);
    } else if (kind === "nunchuk") {
      const g = this.add.graphics().setDepth(12);
      g.fillStyle(bronze, 1);
      g.fillCircle(-10, 0, 6);
      g.fillCircle(10, 0, 6);
      g.lineStyle(2, gold, 0.95);
      g.lineBetween(-10, 0, 10, 0);
      g.setPosition(ox, cy);
      g.setRotation(angle);
      obj = g;
    } else {
      const g = this.add.graphics().setDepth(12);
      g.lineStyle(4, gold, 0.95);
      g.lineBetween(-16, 0, 16, 0);
      g.lineBetween(-16, 0, -22, -8);
      g.lineBetween(16, 0, 22, 8);
      g.setPosition(ox, cy);
      g.setRotation(angle);
      obj = g;
    }
    obj.setBlendMode(ADD);
    this.tweens.add({
      targets: obj,
      x: tx,
      y: ty,
      alpha: 0,
      duration: 460,
      delay,
      ease: "Cubic.Out",
      onComplete: () => obj.destroy(),
    });
  }

  /**
   * Scorpio Milo Cosmo feel:
   * Restriction waves → 14 Scarlet Needles (Scorpius stars) → Antares.
   */
  playScarletNeedle(ox, oy, range) {
    const cy = oy - 8;
    const scarlet = 0xe05a6a;
    const rose = 0xff8a90;
    const white = 0xffe0e4;
    const ADD = Phaser.BlendModes.ADD;

    // --- 1. Restriction — circular paralysis waves ---
    for (let i = 0; i < 4; i += 1) {
      const wave = this.add.circle(ox, cy, 18, 0x000000, 0).setDepth(8);
      wave.setStrokeStyle(2.6, i % 2 === 0 ? scarlet : rose, 0.9);
      this.tweens.add({
        targets: wave,
        scale: range / 22,
        alpha: 0,
        duration: 420,
        delay: i * 55,
        ease: "Sine.Out",
        onComplete: () => wave.destroy(),
      });
    }
    const lock = this.add.circle(ox, cy, 10, rose, 0.55).setDepth(9);
    lock.setBlendMode(ADD);
    this.tweens.add({
      targets: lock,
      scale: 2.2,
      alpha: 0,
      duration: 280,
      onComplete: () => lock.destroy(),
    });

    // --- 2. 14 Scarlet Needles tracing Scorpius ---
    // Rough Scorpius star directions (claws, body, curling tail)
    const starAngles = [
      -2.5, -2.15, -1.75, // left claw
      -0.55, -0.2, 0.15, 0.5, // right claw
      -1.15, -0.85, // body
      0.95, 1.25, 1.55, 1.9, 2.25, // tail curl
    ];
    this.time.delayedCall(90, () => {
      if (this.ended) return;
      starAngles.forEach((angle, i) => {
        const needle = this.add
          .image(ox, cy, "scarlet-needle")
          .setDepth(12)
          .setOrigin(0.05, 0.5)
          .setRotation(angle)
          .setScale(1.05 + (i % 3) * 0.15);
        needle.setBlendMode(ADD);
        needle.setTint(i % 2 === 0 ? 0xff8090 : 0xffffff);
        const dist = range * (0.7 + (i % 4) * 0.08);
        this.tweens.add({
          targets: needle,
          x: ox + Math.cos(angle) * dist,
          y: cy + Math.sin(angle) * dist * 0.82,
          alpha: 0,
          duration: 280,
          delay: i * 28,
          ease: "Cubic.Out",
          onComplete: () => needle.destroy(),
        });
        // Star-point spark at impact
        const spark = this.add.circle(ox, cy, 3, white, 0).setDepth(13);
        spark.setBlendMode(ADD);
        this.tweens.add({
          targets: spark,
          x: ox + Math.cos(angle) * dist,
          y: cy + Math.sin(angle) * dist * 0.82,
          alpha: 1,
          scale: 2.4,
          duration: 200,
          delay: i * 28 + 160,
          yoyo: true,
          onComplete: () => spark.destroy(),
        });
      });
    });

    // Constellation sketch (needles draw Scorpius)
    this.time.delayedCall(140, () => {
      if (this.ended) return;
      const map = this.add.graphics().setDepth(10).setAlpha(0);
      map.setBlendMode(ADD);
      map.lineStyle(1.6, rose, 0.75);
      const pts = starAngles.map((a, i) => ({
        x: ox + Math.cos(a) * range * (0.35 + (i % 5) * 0.08),
        y: cy + Math.sin(a) * range * (0.28 + (i % 5) * 0.06),
      }));
      map.beginPath();
      pts.forEach((p, i) => {
        if (i === 0) map.moveTo(p.x, p.y);
        else map.lineTo(p.x, p.y);
      });
      map.strokePath();
      pts.forEach((p) => {
        map.fillStyle(white, 0.9);
        map.fillCircle(p.x, p.y, 2.4);
      });
      this.tweens.add({
        targets: map,
        alpha: 0.9,
        duration: 160,
        yoyo: true,
        hold: 280,
        onComplete: () => map.destroy(),
      });
    });

    // --- 3. Antares — the 15th needle, heart of the sting ---
    this.time.delayedCall(460, () => {
      if (this.ended) return;
      const heart = this.add.circle(ox, cy, 16, scarlet, 0.85).setDepth(14);
      heart.setBlendMode(ADD);
      this.tweens.add({
        targets: heart,
        scale: 4.2,
        alpha: 0,
        duration: 360,
        ease: "Cubic.Out",
        onComplete: () => heart.destroy(),
      });
      for (let i = 0; i < 8; i += 1) {
        const a = (Math.PI * 2 * i) / 8;
        const sting = this.add
          .image(ox, cy, "scarlet-needle")
          .setDepth(13)
          .setOrigin(0.05, 0.5)
          .setRotation(a)
          .setScale(1.4);
        sting.setBlendMode(ADD);
        this.tweens.add({
          targets: sting,
          x: ox + Math.cos(a) * range,
          y: cy + Math.sin(a) * range * 0.82,
          alpha: 0,
          duration: 340,
          ease: "Cubic.Out",
          onComplete: () => sting.destroy(),
        });
      }
      const ring = this.add.circle(ox, cy, 20, 0x000000, 0).setDepth(12);
      ring.setStrokeStyle(3.2, white, 0.95);
      this.tweens.add({
        targets: ring,
        scale: range / 20,
        alpha: 0,
        duration: 480,
        ease: "Cubic.Out",
        onComplete: () => ring.destroy(),
      });
    });
  }

  /**
   * Capricorn Shura Cosmo feel:
   * sacred sword gathers in the limbs → four Excalibur cuts → space-cleave.
   */
  playExcalibur(ox, oy, range) {
    const cy = oy - 8;
    const steel = 0xd8d0b0;
    const platinum = 0xf0e8c8;
    const white = 0xffffff;
    const gold = 0xe8d090;
    const ADD = Phaser.BlendModes.ADD;

    // --- 1. Sacred sword materializes in the arm ---
    const blade = this.add.graphics().setDepth(12).setAlpha(0);
    blade.setBlendMode(ADD);
    blade.fillStyle(platinum, 0.95);
    blade.fillTriangle(0, -52, -7, 8, 7, 8);
    blade.fillStyle(steel, 0.9);
    blade.fillRect(-3, 6, 6, 22);
    blade.fillStyle(gold, 0.95);
    blade.fillRect(-8, 24, 16, 5);
    blade.setPosition(ox + 10, cy);
    this.tweens.add({
      targets: blade,
      alpha: 1,
      scale: 1.35,
      duration: 120,
      ease: "Back.Out",
    });
    this.tweens.add({
      targets: blade,
      alpha: 0,
      scaleX: 0.2,
      scaleY: 2.4,
      delay: 140,
      duration: 180,
      onComplete: () => blade.destroy(),
    });

    const charge = this.add.circle(ox, cy, 16, platinum, 0.7).setDepth(11);
    charge.setBlendMode(ADD);
    this.tweens.add({
      targets: charge,
      scale: 2.8,
      alpha: 0,
      duration: 280,
      onComplete: () => charge.destroy(),
    });

    // --- 2. Four limb slashes (R arm, L arm, R leg, L leg) ---
    const limbs = [
      { start: -2.4, end: -0.2, delay: 80, r: 0.62 },
      { start: -0.9, end: 1.3, delay: 160, r: 0.7 },
      { start: 0.4, end: 2.5, delay: 240, r: 0.58 },
      { start: 1.8, end: 3.7, delay: 320, r: 0.78 },
    ];
    limbs.forEach((limb, i) => {
      const g = this.add.graphics().setDepth(10).setAlpha(0);
      g.setBlendMode(ADD);
      g.lineStyle(10 - i, i % 2 === 0 ? white : platinum, 0.95);
      g.beginPath();
      g.arc(0, 0, range * limb.r, limb.start, limb.end, false);
      g.strokePath();
      g.lineStyle(3.2, gold, 0.8);
      g.beginPath();
      g.arc(0, 0, range * limb.r, limb.start, limb.end, false);
      g.strokePath();
      g.setPosition(ox, cy);
      this.tweens.add({
        targets: g,
        alpha: 1,
        scale: 1.08,
        duration: 80,
        delay: limb.delay,
        yoyo: true,
        hold: 40,
        onComplete: () => g.destroy(),
      });
    });

    // --- 3. Space-cut lines ---
    const cuts = [-1.15, -0.55, 0.15, 0.7, 1.25, -1.85, 2.0, -0.2];
    cuts.forEach((angle, i) => {
      const cut = this.add
        .rectangle(ox, cy, 5 + (i % 3), 18, i % 2 === 0 ? white : platinum, 0.95)
        .setDepth(11)
        .setRotation(angle);
      cut.setBlendMode(ADD);
      this.tweens.add({
        targets: cut,
        displayHeight: range * (0.85 + (i % 4) * 0.08),
        alpha: 0,
        duration: 280,
        delay: 70 + i * 32,
        ease: "Cubic.Out",
        onComplete: () => cut.destroy(),
      });
    });

    // Ground fissures along the cuts
    for (let i = 0; i < 6; i += 1) {
      const a = -1.2 + (2.4 * i) / 5;
      const crack = this.add.graphics().setDepth(7).setAlpha(0.85);
      crack.lineStyle(2, steel, 0.7);
      crack.beginPath();
      let x = ox;
      let y = cy + 18;
      crack.moveTo(x, y);
      for (let s = 1; s <= 5; s += 1) {
        const t = s / 5;
        x = ox + Math.cos(a) * range * t * 0.7 + Phaser.Math.Between(-8, 8);
        y = cy + 18 + Math.sin(a) * range * t * 0.35 + Phaser.Math.Between(-4, 4);
        crack.lineTo(x, y);
      }
      crack.strokePath();
      this.tweens.add({
        targets: crack,
        alpha: 0,
        duration: 420,
        delay: 120 + i * 40,
        onComplete: () => crack.destroy(),
      });
    }

    // --- 4. Final X-cross (the finishing cut) ---
    this.time.delayedCall(340, () => {
      if (this.ended) return;
      for (const ang of [-0.7, 0.7]) {
        const xcut = this.add
          .rectangle(ox, cy, 10, 24, white, 1)
          .setDepth(13)
          .setRotation(ang);
        xcut.setBlendMode(ADD);
        this.tweens.add({
          targets: xcut,
          displayHeight: range * 1.15,
          displayWidth: 3,
          alpha: 0,
          duration: 320,
          ease: "Cubic.Out",
          onComplete: () => xcut.destroy(),
        });
      }
      const ring = this.add.circle(ox, cy, 18, 0x000000, 0).setDepth(9);
      ring.setStrokeStyle(3, platinum, 0.95);
      this.tweens.add({
        targets: ring,
        scale: range / 18,
        alpha: 0,
        duration: 400,
        ease: "Cubic.Out",
        onComplete: () => ring.destroy(),
      });
    });
  }

  /**
   * Aquarius Camus Cosmo feel:
   * urn of life gathers → golden water pours → glacial aurora stream → absolute zero.
   */
  playAuroraExecution(ox, oy, range) {
    const cy = oy - 8;
    const ice = 0x7ec8e8;
    const bright = 0xa8e8ff;
    const gold = 0xd4b45a;
    const white = 0xffffff;
    const ADD = Phaser.BlendModes.ADD;

    // --- 1. Aquarius urn above the saint ---
    const urn = this.add.graphics().setDepth(12).setAlpha(0);
    urn.setBlendMode(ADD);
    urn.fillStyle(gold, 0.85);
    urn.fillEllipse(0, -38, 28, 14);
    urn.fillStyle(ice, 0.9);
    urn.fillEllipse(0, -18, 22, 32);
    urn.lineStyle(2.4, gold, 0.95);
    urn.strokeEllipse(0, -38, 28, 14);
    urn.lineStyle(2, bright, 0.8);
    urn.strokeEllipse(0, -18, 22, 32);
    urn.setPosition(ox, cy);
    this.tweens.add({
      targets: urn,
      alpha: 1,
      scale: 1.25,
      duration: 180,
      ease: "Back.Out",
    });
    this.tweens.add({
      targets: urn,
      alpha: 0,
      y: cy - 16,
      delay: 420,
      duration: 280,
      onComplete: () => urn.destroy(),
    });

    const halo = this.add.circle(ox, cy - 28, 16, gold, 0.55).setDepth(11);
    halo.setBlendMode(ADD);
    this.tweens.add({
      targets: halo,
      scale: 3.4,
      alpha: 0,
      duration: 480,
      onComplete: () => halo.destroy(),
    });

    // --- 2. Golden water of life pours ---
    for (let i = 0; i < 18; i += 1) {
      const drop = this.add
        .circle(ox + (i % 5 - 2) * 6, cy - 36, i % 3 === 0 ? 5 : 3.5, i % 2 === 0 ? gold : bright, 0.95)
        .setDepth(13);
      drop.setBlendMode(ADD);
      this.tweens.add({
        targets: drop,
        y: cy + 20 + (i % 4) * 18,
        x: ox + (i % 5 - 2) * 14,
        alpha: 0,
        scale: 0.3,
        duration: 320 + (i % 6) * 30,
        delay: 80 + i * 18,
        ease: "Sine.In",
        onComplete: () => drop.destroy(),
      });
    }

    // --- 3. Glacial aurora stream ---
    for (let i = 0; i < 7; i += 1) {
      const col = i % 3 === 0 ? ice : i % 3 === 1 ? bright : gold;
      const curtain = this.add
        .ellipse(ox + (i - 3) * 28, cy, 22, 70, col, 0.35)
        .setDepth(8);
      curtain.setBlendMode(ADD);
      this.tweens.add({
        targets: curtain,
        scaleY: range / 42,
        scaleX: 1.6,
        alpha: 0,
        duration: 720,
        delay: 140 + i * 40,
        ease: "Sine.Out",
        onComplete: () => curtain.destroy(),
      });
    }

    const beam = this.add
      .rectangle(ox, cy, 36, 24, white, 0.7)
      .setDepth(10)
      .setOrigin(0.5, 0);
    beam.setBlendMode(ADD);
    this.tweens.add({
      targets: beam,
      displayHeight: range * 0.95,
      displayWidth: 18,
      alpha: 0,
      duration: 560,
      delay: 160,
      ease: "Cubic.Out",
      onComplete: () => beam.destroy(),
    });

    // --- 4. Diamond dust + ice shards ---
    for (let i = 0; i < 36; i += 1) {
      const angle = (Math.PI * 2 * i) / 36 + (Math.random() - 0.5) * 0.15;
      const dist = range * (0.35 + Math.random() * 0.65);
      const shard = this.add
        .image(ox, cy, "ice-shard")
        .setDepth(12)
        .setScale(0.55 + Math.random() * 0.55)
        .setRotation(angle);
      shard.setBlendMode(ADD);
      this.tweens.add({
        targets: shard,
        x: ox + Math.cos(angle) * dist,
        y: cy + Math.sin(angle) * dist * 0.78,
        alpha: 0,
        duration: 480 + (i % 8) * 28,
        delay: 200 + Math.floor(i / 4) * 22,
        ease: "Cubic.Out",
        onComplete: () => shard.destroy(),
      });
    }

    // Koltso freeze rings
    for (let i = 0; i < 5; i += 1) {
      const ring = this.add.circle(ox, cy, 16, 0x000000, 0).setDepth(9);
      ring.setStrokeStyle(2.4, i % 2 === 0 ? bright : gold, 0.9);
      this.tweens.add({
        targets: ring,
        scale: range / 18,
        alpha: 0,
        duration: 560,
        delay: 160 + i * 70,
        ease: "Sine.Out",
        onComplete: () => ring.destroy(),
      });
    }

    // --- 5. Absolute-zero flash ---
    this.time.delayedCall(480, () => {
      if (this.ended) return;
      const zero = this.add.circle(ox, cy, 20, white, 0.8).setDepth(14);
      zero.setBlendMode(ADD);
      this.tweens.add({
        targets: zero,
        scale: range / 16,
        alpha: 0,
        duration: 380,
        ease: "Cubic.Out",
        onComplete: () => zero.destroy(),
      });
    });
  }

  /**
   * Pisces Aphrodite Cosmo feel:
   * Royal Demon Roses → Piranian Roses → white Bloody Rose drinks the heart.
   */
  playBloodyRose(ox, oy, range) {
    const cy = oy - 8;
    const rose = 0xe07098;
    const crimson = 0xc03050;
    const white = 0xfff0f4;
    const gold = 0xd4b45a;
    const ADD = Phaser.BlendModes.ADD;

    // --- 1. Poison fragrance ---
    for (let i = 0; i < 4; i += 1) {
      const wave = this.add.circle(ox, cy, 16, 0x000000, 0).setDepth(8);
      wave.setStrokeStyle(2.4, i % 2 === 0 ? rose : gold, 0.85);
      this.tweens.add({
        targets: wave,
        scale: range / 20,
        alpha: 0,
        duration: 520,
        delay: i * 60,
        ease: "Sine.Out",
        onComplete: () => wave.destroy(),
      });
    }
    const scent = this.add.circle(ox, cy, 18, rose, 0.4).setDepth(7);
    scent.setBlendMode(ADD);
    this.tweens.add({
      targets: scent,
      scale: 3.2,
      alpha: 0,
      duration: 420,
      onComplete: () => scent.destroy(),
    });

    // --- 2. Royal Demon Roses (red) ---
    for (let i = 0; i < 16; i += 1) {
      const angle = (Math.PI * 2 * i) / 16;
      const bloom = this.add
        .image(ox, cy, "bloody-rose")
        .setDepth(11)
        .setScale(0.85 + (i % 3) * 0.15);
      bloom.setBlendMode(ADD);
      bloom.setTint(0xff8098);
      const dist = range * (0.55 + (i % 4) * 0.1);
      this.tweens.add({
        targets: bloom,
        x: ox + Math.cos(angle) * dist,
        y: cy + Math.sin(angle) * dist * 0.8,
        angle: 140 + i * 18,
        alpha: 0,
        duration: 420,
        delay: 40 + i * 18,
        ease: "Cubic.Out",
        onComplete: () => bloom.destroy(),
      });
    }

    // --- 3. Piranian Roses (black, slicing) ---
    this.time.delayedCall(180, () => {
      if (this.ended) return;
      for (let i = 0; i < 12; i += 1) {
        const angle = (Math.PI * 2 * i) / 12 + 0.2;
        const piranha = this.add
          .image(ox, cy, "bloody-rose")
          .setDepth(12)
          .setScale(0.95)
          .setRotation(angle);
        piranha.setBlendMode(ADD);
        piranha.setTint(0x2a1820);
        this.tweens.add({
          targets: piranha,
          x: ox + Math.cos(angle) * range * 0.92,
          y: cy + Math.sin(angle) * range * 0.8,
          alpha: 0,
          duration: 320,
          delay: i * 22,
          ease: "Cubic.Out",
          onComplete: () => piranha.destroy(),
        });
      }
    });

    // Petal shards
    for (let i = 0; i < 28; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const petal = this.add
        .ellipse(ox, cy, 8, 4, i % 3 === 0 ? crimson : rose, 0.95)
        .setDepth(10)
        .setRotation(angle);
      petal.setBlendMode(ADD);
      this.tweens.add({
        targets: petal,
        x: ox + Math.cos(angle) * range * (0.4 + Math.random() * 0.55),
        y: cy + Math.sin(angle) * range * (0.35 + Math.random() * 0.5),
        alpha: 0,
        duration: 480 + (i % 6) * 30,
        delay: 80 + i * 14,
        onComplete: () => petal.destroy(),
      });
    }

    // Twin fish Cosmo
    for (const side of [-1, 1]) {
      const fish = this.add.graphics().setDepth(9).setAlpha(0);
      fish.setBlendMode(ADD);
      fish.fillStyle(rose, 0.85);
      fish.fillEllipse(side * 28, 0, 36, 14);
      fish.fillTriangle(side * 46, 0, side * 58, -8, side * 58, 8);
      fish.setPosition(ox, cy);
      this.tweens.add({
        targets: fish,
        alpha: 0.95,
        angle: side * 70,
        duration: 220,
        yoyo: true,
        hold: 180,
        onComplete: () => fish.destroy(),
      });
      this.tweens.add({
        targets: fish,
        x: ox + side * range * 0.35,
        duration: 620,
        ease: "Sine.Out",
      });
    }

    // --- 4. Bloody Rose — white heart-seekers flush crimson ---
    this.time.delayedCall(360, () => {
      if (this.ended) return;
      const heart = this.add.circle(ox, cy, 14, white, 0.85).setDepth(14);
      heart.setBlendMode(ADD);
      this.tweens.add({
        targets: heart,
        scale: 3.6,
        alpha: 0,
        duration: 360,
        ease: "Cubic.Out",
        onComplete: () => heart.destroy(),
      });

      for (let i = 0; i < 8; i += 1) {
        const angle = (Math.PI * 2 * i) / 8;
        const bloody = this.add
          .image(ox, cy, "bloody-rose")
          .setDepth(13)
          .setScale(1.25);
        bloody.setBlendMode(ADD);
        bloody.setTint(white);
        const dist = range * 0.88;
        this.tweens.add({
          targets: bloody,
          x: ox + Math.cos(angle) * dist,
          y: cy + Math.sin(angle) * dist * 0.8,
          angle: 90,
          duration: 380,
          delay: i * 28,
          ease: "Cubic.Out",
        });
        this.time.delayedCall(180 + i * 28, () => {
          if (bloody.active) bloody.setTint(crimson);
        });
        this.tweens.add({
          targets: bloody,
          alpha: 0,
          scale: 1.6,
          delay: 280 + i * 28,
          duration: 220,
          onComplete: () => bloody.destroy(),
        });
      }
    });
  }

  damageEnemiesInRange(range, damage) {
    this.damageEnemiesFromPoint(this.gemini.x, this.gemini.y, range, damage, false);
  }

  damageEnemiesFromPoint(x, y, range, damage, ensureKill) {
    for (const enemy of this.enemies.getChildren()) {
      if (!enemy?.active) continue;
      const dist = Phaser.Math.Distance.Between(x, y, enemy.x, enemy.y);
      if (dist > range) continue;

      if (typeof enemy.hp !== "number") enemy.hp = GAME.enemyHp;
      enemy.hp -= damage;
      if (ensureKill) enemy.hp = 0;

      enemy.setTintFill(0xffffff);
      this.time.delayedCall(80, () => {
        if (enemy.active) enemy.clearTint();
      });
      if (enemy.hp <= 0) enemy.destroy();
    }
  }

  spawnPressure(progress) {
    const u = Phaser.Math.Clamp(progress / GAME.spawnRampEnd, 0, 1);
    return u * u * (3 - 2 * u);
  }

  pickEnemyType(progress) {
    // Early: aphids + squirrels. Mid: mixed pressure. Late: hold the mix, not a worm wall.
    let weights;
    if (progress < 0.35) {
      weights = { aphid: 0.55, squirrel: 0.35, worm: 0.1 };
    } else if (progress < 0.7) {
      weights = { aphid: 0.32, squirrel: 0.4, worm: 0.28 };
    } else {
      weights = { aphid: 0.3, squirrel: 0.38, worm: 0.32 };
    }

    const roll = Math.random();
    let acc = 0;
    for (const [id, weight] of Object.entries(weights)) {
      acc += weight;
      if (roll <= acc) return id;
    }
    return "squirrel";
  }

  randomEdgePoint() {
    const edge = Phaser.Math.Between(0, 3);
    if (edge === 0) {
      return { x: Phaser.Math.Between(20, GAME.width - 20), y: -20 };
    }
    if (edge === 1) {
      return { x: GAME.width + 20, y: Phaser.Math.Between(20, GAME.height - 20) };
    }
    if (edge === 2) {
      return { x: Phaser.Math.Between(20, GAME.width - 20), y: GAME.height + 20 };
    }
    return { x: -20, y: Phaser.Math.Between(20, GAME.height - 20) };
  }

  spawnEnemies() {
    const t = this.elapsed / GAME.durationMs;
    const pressure = this.spawnPressure(t);
    this.spawnInterval = Phaser.Math.Linear(
      GAME.spawnIntervalStartMs,
      GAME.spawnIntervalMinMs,
      pressure,
    );

    if (this.spawnTimer < this.spawnInterval) return;

    const maxAlive = Math.round(
      Phaser.Math.Linear(GAME.spawnMaxAliveStart, GAME.spawnMaxAlivePeak, pressure),
    );
    if (this.enemies.countActive(true) >= maxAlive) {
      this.spawnTimer = this.spawnInterval * 0.4;
      return;
    }

    this.spawnTimer = 0;

    const typeId = this.pickEnemyType(t);
    const type = GAME.enemyTypes[typeId];
    const point = this.randomEdgePoint();
    this.spawnEnemyAt(typeId, point.x, point.y);

    // Aphids sometimes arrive as a tiny swarm
    if (type.packChance && Math.random() < type.packChance) {
      if (this.enemies.countActive(true) >= maxAlive) return;
      const buddy = this.randomEdgePoint();
      this.spawnEnemyAt(typeId, buddy.x + Phaser.Math.Between(-18, 18), buddy.y + Phaser.Math.Between(-18, 18));
    }
  }

  spawnEnemyAt(typeId, x, y) {
    const type = GAME.enemyTypes[typeId];
    const enemy = this.enemies.create(x, y, type.key);
    enemy.setOrigin(0.5, 0.88);
    enemy.enemyType = typeId;
    enemy.baseScale = type.scale;
    enemy.hp = type.hp;
    enemy.speed = type.speed;
    enemy.damage = type.damage;
    enemy.attackCooldownMs = type.attackCooldownMs;
    enemy.nextBite = 0;
    enemy.walkPhase = Math.random() * Math.PI * 2;
    enemy.body.setSize(type.body.w, type.body.h);
    enemy.body.setOffset(type.body.ox, type.body.oy);
    enemy.shadow = this.createGroundShadow(type.shadowW, type.shadowH);
    // Start small at the rim — presentation refreshes every frame
    const d = this.depthAt(x, y);
    enemy.setScale(type.scale * d, type.scale * d * GAME.pseudo3d.spriteSquash);
    enemy.on("destroy", () => {
      if (enemy.shadow?.active) enemy.shadow.destroy();
    });
    return enemy;
  }

  steerEnemies() {
    for (const enemy of this.enemies.getChildren()) {
      if (!enemy.active) continue;
      this.physics.moveToObject(enemy, this.patch, enemy.speed ?? GAME.enemySpeed);
    }
  }

  damagePatch(enemy) {
    if (!enemy.active || this.ended) return;
    if (this.time.now < enemy.nextBite) return;

    const cooldown = enemy.attackCooldownMs ?? GAME.enemyAttackCooldownMs;
    const damage = enemy.damage ?? GAME.enemyDamage;
    enemy.nextBite = this.time.now + cooldown;
    this.patchHp -= damage;

    this.cameras.main.shake(80, 0.004);
    this.setBroccoliTint(0xffaaaa);
    this.time.delayedCall(90, () => this.clearBroccoliTint());

    if (this.patchHp <= 0) {
      this.patchHp = 0;
      this.finish(false);
    }
  }

  finish(won) {
    if (this.ended) return;
    this.ended = true;
    this.stopZzz();
    this.tweens.killTweensOf(this.athena);
    this.tweens.killTweensOf(this.athenaAsleep);
    this.gemini.setVelocity(0, 0);
    this.enemies.getChildren().forEach((e) => e.body?.stop());
    this.scene.launch("Result", { won });
  }
}
