import Phaser from "phaser";
import { COLORS, GAME, HEROES, TEMPLES } from "../config.js";
import { arenaDepthScale, depthOrder, depthScale } from "../pseudo3d.js";

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
    this.input.keyboard.once("keydown-R", () => {
      if (this.ended) this.scene.restart();
    });
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
    this.drawDefaultArena();
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

    const cx = w / 2;
    const cy = h / 2;
    bg.lineStyle(2, t.ringPrimary, 0.28);
    bg.strokeEllipse(cx, cy + 18, 200, 72);
    bg.lineStyle(2, t.ringSecondary, 0.2);
    bg.strokeEllipse(cx, cy + 18, 280, 96);

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
    seal.strokeCircle(px, py + 6, 54);
    seal.lineStyle(1.5, t.ringPrimary ?? 0xd8d0b8, 0.35);
    seal.strokeCircle(px, py + 6, 42);
    // Tiny ram horns on the floor seal
    seal.lineStyle(3, t.accent ?? 0xe8c890, 0.5);
    seal.beginPath();
    seal.arc(px - 10, py - 4, 14, Math.PI * 0.85, -0.15, false);
    seal.strokePath();
    seal.beginPath();
    seal.arc(px + 10, py - 4, 14, Math.PI * 1.15, Math.PI + 0.15, true);
    seal.strokePath();

    // Sacred rings around broccoli
    const rings = this.add.graphics().setDepth(-10);
    rings.lineStyle(2, t.ringPrimary ?? 0xd8d0b8, 0.34);
    rings.strokeEllipse(px, py + 18, 200, 72);
    rings.lineStyle(2, t.ringSecondary ?? 0xa8c0d8, 0.2);
    rings.strokeEllipse(px, py + 18, 280, 96);

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
    seal.strokeCircle(px, py + 6, 56);
    seal.lineStyle(1.6, t.ringPrimary ?? 0xe0c080, 0.4);
    seal.strokeCircle(px, py + 6, 44);
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

    const rings = this.add.graphics().setDepth(-10);
    rings.lineStyle(2, t.ringPrimary ?? 0xe0c080, 0.36);
    rings.strokeEllipse(px, py + 18, 200, 72);
    rings.lineStyle(2, t.ringSecondary ?? 0xc07040, 0.22);
    rings.strokeEllipse(px, py + 18, 280, 96);

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
    seal.strokeCircle(px, py + 6, 56);
    seal.lineStyle(1.6, t.ringSecondary ?? 0xd4b45a, 0.4);
    seal.strokeCircle(px, py + 6, 44);
    // Twin dots (Castor & Pollux)
    seal.fillStyle(t.accent ?? 0x6ec8e0, 0.7);
    seal.fillCircle(px - 12, py + 2, 5);
    seal.fillCircle(px + 12, py + 2, 5);
    seal.lineStyle(2, t.ringSecondary ?? 0xd4b45a, 0.65);
    seal.lineBetween(px - 12, py + 2, px + 12, py + 2);

    const rings = this.add.graphics().setDepth(-10);
    rings.lineStyle(2, t.ringPrimary ?? 0xa8e0f0, 0.36);
    rings.strokeEllipse(px, py + 18, 200, 72);
    rings.lineStyle(2, t.ringSecondary ?? 0xd4b45a, 0.22);
    rings.strokeEllipse(px, py + 18, 280, 96);

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
    seal.strokeCircle(px, py + 6, 56);
    seal.lineStyle(1.6, t.ringSecondary ?? 0x6a40a0, 0.4);
    seal.strokeCircle(px, py + 6, 44);
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

    const rings = this.add.graphics().setDepth(-10);
    rings.lineStyle(2, t.ringPrimary ?? 0xd8b8f0, 0.36);
    rings.strokeEllipse(px, py + 18, 200, 72);
    rings.lineStyle(2, t.ringSecondary ?? 0x6a40a0, 0.22);
    rings.strokeEllipse(px, py + 18, 280, 96);

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

  createGroundShadow(width, height) {
    return this.add
      .ellipse(0, 0, width, height, 0x000000, GAME.pseudo3d.shadowAlpha)
      .setDepth(0);
  }

  presentHero() {
    const actor = this.gemini;
    if (!actor?.active) return;

    const d = arenaDepthScale(
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
    const d = arenaDepthScale(enemy.x, enemy.y);
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
      const d = depthScale(this.moveMarker.y);
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
        `${this.hero.name}${houseBit}  ·  Click move  ·  Double-click attack  ·  Right-click special`,
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
    const d = depthScale(this.patch.y);
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
    const d = depthScale(actor.y);
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

    const heroD = arenaDepthScale(
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
                : 0x04060c,
        0,
      )
      .setDepth(6);
    this.tweens.add({
      targets: veil,
      fillAlpha: isStardust ? 0.35 : isHorn ? 0.5 : isGalaxian ? 0.6 : isUnderworld ? 0.55 : 0.55,
      duration: isStardust ? 160 : isHorn ? 90 : isGalaxian ? 140 : isUnderworld ? 180 : 120,
      yoyo: true,
      hold: isStardust ? 320 : isHorn ? 180 : isGalaxian ? 280 : isUnderworld ? 360 : 220,
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
      duration: isStardust ? 320 : isHorn ? 140 : isGalaxian ? 280 : isUnderworld ? 260 : 180,
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
              : 0xfff4c8,
    );
    this.time.delayedCall(
      isStardust ? 420 : isHorn ? 300 : isGalaxian ? 480 : isUnderworld ? 500 : 260,
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
      delay: isStardust ? 900 : isHorn ? 750 : isGalaxian ? 950 : isUnderworld ? 1000 : 700,
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

  playAtomicThunderbolt(ox, oy, range) {
    // Sagittarius bow flash
    const bowGlow = this.add.circle(ox, oy - 10, 22, 0xffe082, 0.5).setDepth(7);
    this.tweens.add({
      targets: bowGlow,
      scale: 2.4,
      alpha: 0,
      duration: 420,
      onComplete: () => bowGlow.destroy(),
    });

    // Hero golden arrow — main shot
    const mainArrow = this.add
      .image(ox, oy, "golden-arrow")
      .setDepth(10)
      .setOrigin(0.15, 0.5)
      .setScale(1.35);
    this.tweens.add({
      targets: mainArrow,
      x: ox + range * 0.98,
      alpha: 0.15,
      scaleX: 1.6,
      duration: 320,
      ease: "Cubic.Out",
      onComplete: () => mainArrow.destroy(),
    });

    // Rain of golden arrows
    const arrowCount = 22;
    for (let i = 0; i < arrowCount; i += 1) {
      const angle = -0.5 + (1.0 * i) / (arrowCount - 1) + (Math.random() - 0.5) * 0.12;
      const dist = range * (0.45 + Math.random() * 0.55);
      const arrow = this.add
        .image(ox, oy, "golden-arrow")
        .setDepth(9)
        .setOrigin(0.15, 0.5)
        .setRotation(angle)
        .setScale(0.75 + Math.random() * 0.35)
        .setAlpha(0.95);

      // Motion streak behind the arrow
      const streak = this.add
        .rectangle(ox, oy, 10, 3, 0xfff6c8, 0.55)
        .setDepth(8)
        .setOrigin(0, 0.5)
        .setRotation(angle);

      this.tweens.add({
        targets: [arrow, streak],
        x: ox + Math.cos(angle) * dist,
        y: oy + Math.sin(angle) * dist * 0.75,
        alpha: 0,
        duration: 380 + (i % 7) * 30,
        delay: Math.floor(i / 2) * 35,
        ease: "Cubic.Out",
        onComplete: () => {
          arrow.destroy();
          streak.destroy();
        },
      });
      this.tweens.add({
        targets: streak,
        displayWidth: 40 + Math.random() * 50,
        duration: 200,
        delay: Math.floor(i / 2) * 35,
      });
    }

    // Atomic Thunderbolt — volley of electrified Cosmo orbs between arrows
    const bolts = 28;
    for (let i = 0; i < bolts; i += 1) {
      const angle = -0.55 + (1.1 * i) / (bolts - 1) + (Math.random() - 0.5) * 0.15;
      const dist = range * (0.35 + Math.random() * 0.65);
      const orb = this.add
        .circle(ox, oy, Phaser.Math.Between(4, 8), i % 2 === 0 ? 0xfff6c8 : 0x7fd7ef, 1)
        .setDepth(8);
      const spark = this.add.circle(ox, oy, 2, 0xffffff, 1).setDepth(9);

      this.tweens.add({
        targets: [orb, spark],
        x: ox + Math.cos(angle) * dist,
        y: oy + Math.sin(angle) * dist * 0.75,
        alpha: 0,
        duration: 420 + (i % 8) * 35,
        delay: Math.floor(i / 3) * 28,
        ease: "Cubic.Out",
        onComplete: () => {
          orb.destroy();
          spark.destroy();
        },
      });
    }

    // Lightning forks
    for (let i = 0; i < 10; i += 1) {
      const g = this.add.graphics().setDepth(8);
      const ang = -0.5 + Math.random();
      g.lineStyle(2, 0xa8e8ff, 0.9);
      g.beginPath();
      let x = ox;
      let y = oy;
      g.moveTo(x, y);
      const steps = 6;
      for (let s = 1; s <= steps; s += 1) {
        const t = s / steps;
        x = ox + Math.cos(ang) * range * t + Phaser.Math.Between(-18, 18);
        y = oy + Math.sin(ang) * range * t * 0.75 + Phaser.Math.Between(-12, 12);
        g.lineTo(x, y);
      }
      g.strokePath();
      this.tweens.add({
        targets: g,
        alpha: 0,
        duration: 380,
        delay: i * 40,
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

  playTenbuHorin(ox, oy, range) {
    // Dharma-wheel rings (Tenbu Hōrin seal)
    for (let i = 0; i < 4; i += 1) {
      const wheel = this.add.circle(ox, oy, 28 + i * 10, 0x000000, 0).setDepth(7);
      wheel.setStrokeStyle(3, i % 2 === 0 ? 0xffe082 : 0xc49a5a, 0.95);
      this.tweens.add({
        targets: wheel,
        scale: range / (28 + i * 10),
        alpha: 0,
        angle: i % 2 === 0 ? 120 : -120,
        duration: 950,
        delay: i * 70,
        ease: "Cubic.Out",
        onComplete: () => wheel.destroy(),
      });
    }

    // Soft lotus glow
    const lotus = this.add.circle(ox, oy, 18, 0xffe082, 0.4).setDepth(6);
    this.tweens.add({
      targets: lotus,
      scale: 3.4,
      alpha: 0,
      duration: 750,
      ease: "Sine.Out",
      onComplete: () => lotus.destroy(),
    });

    // 108-beaded rosary (japamala) — linked strands whip outward
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
          y: oy + Math.sin(angle) * dist * 0.82,
          t,
          i,
        });
      }

      // Cord between beads
      const cord = this.add.graphics().setDepth(7).setAlpha(0.75);
      cord.lineStyle(2, 0x6b4420, 0.85);
      cord.beginPath();
      cord.moveTo(ox, oy);
      for (const p of points) cord.lineTo(p.x, p.y);
      cord.strokePath();
      this.tweens.add({
        targets: cord,
        alpha: 0,
        duration: 900,
        delay: 200 + s * 40,
        onComplete: () => cord.destroy(),
      });

      // Beads along the strand (amber/wood, then seal-black on impact)
      for (const p of points) {
        const bead = this.add
          .image(ox, oy, "bead")
          .setDepth(8)
          .setScale(p.i % 6 === 0 ? 0.85 : 0.55);
        this.tweens.add({
          targets: bead,
          x: p.x,
          y: p.y,
          duration: 380 + p.i * 14,
          delay: s * 30,
          ease: "Cubic.Out",
          onComplete: () => {
            // Specter-seal flash: bead darkens
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
        wrap.lineStyle(2, 0xc49a5a, alpha);
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

  playLightningPlasma(ox, oy, range) {
    for (let i = 0; i < 28; i += 1) {
      const angle = (Math.PI * 2 * i) / 28 + Math.random() * 0.1;
      const bolt = this.add
        .rectangle(ox, oy, 4, 18, i % 2 === 0 ? 0xfff1a8 : 0xffc04a, 0.95)
        .setDepth(8)
        .setRotation(angle);
      this.tweens.add({
        targets: bolt,
        displayHeight: range * (0.7 + Math.random() * 0.3),
        alpha: 0,
        duration: 380,
        delay: (i % 7) * 25,
        ease: "Cubic.Out",
        onComplete: () => bolt.destroy(),
      });
    }
    for (let i = 0; i < 12; i += 1) {
      const g = this.add.graphics().setDepth(7);
      const a0 = Math.random() * Math.PI * 2;
      g.lineStyle(2, 0xffe082, 0.9);
      g.beginPath();
      let x = ox;
      let y = oy;
      g.moveTo(x, y);
      for (let s = 0; s < 6; s += 1) {
        x += Math.cos(a0) * (range / 6) + Phaser.Math.Between(-12, 12);
        y += Math.sin(a0) * (range / 7) + Phaser.Math.Between(-12, 12);
        g.lineTo(x, y);
      }
      g.strokePath();
      this.tweens.add({
        targets: g,
        alpha: 0,
        duration: 420,
        delay: i * 30,
        onComplete: () => g.destroy(),
      });
    }
  }

  playLibraWeapons(ox, oy, range) {
    for (let i = 0; i < 18; i += 1) {
      const angle = (Math.PI * 2 * i) / 18;
      const blade = this.add
        .image(ox, oy, "libra-blade")
        .setDepth(8)
        .setOrigin(0.1, 0.5)
        .setRotation(angle)
        .setScale(0.9);
      this.tweens.add({
        targets: blade,
        x: ox + Math.cos(angle) * range * 0.95,
        y: oy + Math.sin(angle) * range * 0.8,
        alpha: 0.2,
        duration: 480,
        delay: i * 18,
        ease: "Cubic.Out",
        onComplete: () => blade.destroy(),
      });
    }
    const balance = this.add.circle(ox, oy - 8, 20, 0xc8b070, 0.45).setDepth(7);
    this.tweens.add({
      targets: balance,
      scale: 3.2,
      alpha: 0,
      duration: 700,
      onComplete: () => balance.destroy(),
    });
  }

  playScarletNeedle(ox, oy, range) {
    for (let i = 0; i < 24; i += 1) {
      const angle = -0.9 + (1.8 * i) / 23 + (Math.random() - 0.5) * 0.08;
      const needle = this.add
        .image(ox, oy, "scarlet-needle")
        .setDepth(9)
        .setOrigin(0.05, 0.5)
        .setRotation(angle)
        .setScale(0.9 + Math.random() * 0.4);
      this.tweens.add({
        targets: needle,
        x: ox + Math.cos(angle) * range,
        y: oy + Math.sin(angle) * range * 0.85,
        alpha: 0.15,
        duration: 360 + Math.random() * 120,
        delay: i * 16,
        ease: "Cubic.Out",
        onComplete: () => needle.destroy(),
      });
    }
    for (let i = 0; i < 3; i += 1) {
      const ring = this.add.circle(ox, oy, 16, 0x000000, 0).setDepth(7);
      ring.setStrokeStyle(2, 0xe05a6a, 0.85);
      this.tweens.add({
        targets: ring,
        scale: range / 16,
        alpha: 0,
        duration: 560,
        delay: i * 80,
        onComplete: () => ring.destroy(),
      });
    }
  }

  playExcalibur(ox, oy, range) {
    const slash = this.add.graphics().setDepth(8);
    slash.lineStyle(6, 0xf0e0a0, 0.95);
    slash.beginPath();
    slash.arc(ox, oy, range * 0.55, -2.2, 0.6, false);
    slash.strokePath();
    this.tweens.add({
      targets: slash,
      alpha: 0,
      duration: 480,
      onComplete: () => slash.destroy(),
    });
    for (let i = 0; i < 10; i += 1) {
      const angle = -1.8 + (2.4 * i) / 9;
      const cut = this.add
        .rectangle(ox, oy, 8, 28, 0xffffff, 0.9)
        .setDepth(8)
        .setRotation(angle)
        .setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: cut,
        displayHeight: range * 0.95,
        alpha: 0,
        duration: 360,
        delay: i * 28,
        ease: "Cubic.Out",
        onComplete: () => cut.destroy(),
      });
    }
    const core = this.add.circle(ox, oy, 14, 0xd8d0b0, 0.6).setDepth(7);
    this.tweens.add({
      targets: core,
      scale: 4,
      alpha: 0,
      duration: 500,
      onComplete: () => core.destroy(),
    });
  }

  playAuroraExecution(ox, oy, range) {
    for (let i = 0; i < 5; i += 1) {
      const aurora = this.add
        .ellipse(ox, oy, 50 + i * 12, 90 + i * 18, i % 2 === 0 ? 0x7ec8e8 : 0xa8e8ff, 0.22)
        .setDepth(6);
      this.tweens.add({
        targets: aurora,
        scaleX: 1.8 + i * 0.15,
        scaleY: 2.1 + i * 0.1,
        alpha: 0,
        duration: 780,
        delay: i * 50,
        onComplete: () => aurora.destroy(),
      });
    }
    for (let i = 0; i < 30; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const shard = this.add
        .image(ox, oy, "ice-shard")
        .setDepth(8)
        .setScale(0.6 + Math.random() * 0.5)
        .setRotation(angle);
      this.tweens.add({
        targets: shard,
        x: ox + Math.cos(angle) * range * (0.5 + Math.random() * 0.5),
        y: oy + Math.sin(angle) * range * (0.45 + Math.random() * 0.45),
        alpha: 0,
        duration: Phaser.Math.Between(450, 750),
        delay: Phaser.Math.Between(0, 120),
        ease: "Cubic.Out",
        onComplete: () => shard.destroy(),
      });
    }
  }

  playBloodyRose(ox, oy, range) {
    for (let i = 0; i < 4; i += 1) {
      const ring = this.add.circle(ox, oy, 20, 0x000000, 0).setDepth(7);
      ring.setStrokeStyle(2, 0xe07098, 0.9);
      this.tweens.add({
        targets: ring,
        scale: range / 20,
        alpha: 0,
        duration: 700,
        delay: i * 70,
        onComplete: () => ring.destroy(),
      });
    }
    for (let i = 0; i < 26; i += 1) {
      const angle = (Math.PI * 2 * i) / 26;
      const rose = this.add
        .image(ox, oy, "bloody-rose")
        .setDepth(8)
        .setScale(0.7 + Math.random() * 0.4);
      this.tweens.add({
        targets: rose,
        x: ox + Math.cos(angle) * range * (0.55 + Math.random() * 0.45),
        y: oy + Math.sin(angle) * range * (0.5 + Math.random() * 0.4),
        angle: Phaser.Math.Between(-180, 180),
        alpha: 0.15,
        duration: 620,
        delay: i * 18,
        ease: "Cubic.Out",
        onComplete: () => rose.destroy(),
      });
    }
    for (let i = 0; i < 18; i += 1) {
      const petal = this.add.circle(ox, oy, 3, 0xc03050, 0.9).setDepth(8);
      const angle = Math.random() * Math.PI * 2;
      this.tweens.add({
        targets: petal,
        x: ox + Math.cos(angle) * range * 0.85,
        y: oy + Math.sin(angle) * range * 0.7,
        alpha: 0,
        duration: 560,
        delay: i * 20,
        onComplete: () => petal.destroy(),
      });
    }
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

  pickEnemyType(progress) {
    // Early: mostly aphids + squirrels. Mid: mix. Late: more cabbage worms.
    let weights;
    if (progress < 0.35) {
      weights = { aphid: 0.55, squirrel: 0.35, worm: 0.1 };
    } else if (progress < 0.7) {
      weights = { aphid: 0.35, squirrel: 0.4, worm: 0.25 };
    } else {
      weights = { aphid: 0.25, squirrel: 0.3, worm: 0.45 };
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
    if (this.spawnTimer < this.spawnInterval) return;
    this.spawnTimer = 0;

    const t = this.elapsed / GAME.durationMs;
    this.spawnInterval = Phaser.Math.Linear(
      GAME.spawnIntervalStartMs,
      GAME.spawnIntervalMinMs,
      t,
    );

    const typeId = this.pickEnemyType(t);
    const type = GAME.enemyTypes[typeId];
    const point = this.randomEdgePoint();
    this.spawnEnemyAt(typeId, point.x, point.y);

    // Aphids sometimes arrive as a tiny swarm
    if (type.packChance && Math.random() < type.packChance) {
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
    const d = arenaDepthScale(x, y);
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
