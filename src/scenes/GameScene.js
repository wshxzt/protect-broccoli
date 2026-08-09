import Phaser from "phaser";
import { COLORS, GAME, HEROES } from "../config.js";
import { depthOrder, depthScale } from "../pseudo3d.js";

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

    this.heroHopState = { hop: 0 };
    this.drawArena();

    this.createBroccoli();
    this.createAthena();

    this.gemini = this.physics.add.sprite(GAME.width / 2, GAME.height / 2 + 120, this.hero.key);
    this.gemini.setCollideWorldBounds(true);
    this.gemini.setOrigin(0.5, 0.88);
    this.gemini.body.setSize(48, 72);
    this.gemini.body.setOffset(32, 20);
    this.gemini.baseScale = this.hero.scale;
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
    const w = GAME.width;
    const h = GAME.height;
    const horizon = 96;
    const vpX = w / 2;
    const vpY = horizon - 10;

    // Sky band (WC3-style distant backdrop)
    const sky = this.add.graphics().setDepth(-20);
    sky.fillGradientStyle(0x1b3344, 0x1b3344, 0x0d1c22, 0x0d1c22, 1);
    sky.fillRect(0, 0, w, horizon + 40);

    // Distant hills
    sky.fillStyle(0x152820, 1);
    sky.fillEllipse(w * 0.25, horizon + 8, 280, 48);
    sky.fillEllipse(w * 0.7, horizon + 4, 340, 56);
    sky.fillStyle(0x1a3428, 1);
    sky.fillEllipse(w * 0.5, horizon + 18, 420, 40);

    const bg = this.add.graphics().setDepth(-10);
    bg.fillStyle(COLORS.ground, 1);
    bg.fillRect(0, horizon, w, h - horizon);

    // Perspective ground grid converging to vanishing point
    bg.lineStyle(1, COLORS.groundAccent, 0.4);
    const cols = 14;
    for (let i = 0; i <= cols; i += 1) {
      const t = i / cols;
      const bottomX = Phaser.Math.Linear(-80, w + 80, t);
      bg.lineBetween(bottomX, h, vpX, vpY);
    }
    for (let i = 0; i < 12; i += 1) {
      const t = i / 11;
      const y = Phaser.Math.Linear(horizon + 20, h - 8, t * t);
      const widthAtY = Phaser.Math.Linear(120, w + 100, (y - horizon) / (h - horizon));
      bg.lineBetween(vpX - widthAtY / 2, y, vpX + widthAtY / 2, y);
    }

    // Sacred ellipses around the broccoli (ground-projected rings)
    const cx = w / 2;
    const cy = h / 2;
    bg.lineStyle(2, 0x6ec8e0, 0.28);
    bg.strokeEllipse(cx, cy + 18, 200, 72);
    bg.lineStyle(2, 0xd4b45a, 0.2);
    bg.strokeEllipse(cx, cy + 18, 280, 96);

    // Soft side vignette for depth
    const veil = this.add.graphics().setDepth(-5);
    veil.fillStyle(0x000000, 0.18);
    veil.fillRect(0, 0, 40, h);
    veil.fillRect(w - 40, 0, 40, h);
  }

  createGroundShadow(width, height) {
    return this.add
      .ellipse(0, 0, width, height, 0x000000, GAME.pseudo3d.shadowAlpha)
      .setDepth(0);
  }

  applyActorPresentation(actor, baseScale, shadow, shadowWidth = 40) {
    if (!actor?.active) return;
    const d = depthScale(actor.y);
    const squash = GAME.pseudo3d.spriteSquash;
    const hop = actor === this.gemini ? this.heroHopState.hop : 0;
    const lift = hop * 14;
    actor.setScale(baseScale * d * (1 + hop * 0.06), baseScale * d * squash * (1 + hop * 0.08));
    actor.setDepth(depthOrder(actor.y, 2));
    // Fake vertical lift without moving the physics body
    if (actor === this.gemini) {
      actor.setDisplayOrigin(actor.width * 0.5, actor.height * 0.88 + lift);
    }
    if (shadow?.active) {
      shadow.setPosition(actor.x, actor.y + 6);
      shadow.setScale(d * (shadowWidth / 40) * (1 - hop * 0.45), d * 0.85 * (1 - hop * 0.25));
      shadow.setAlpha(GAME.pseudo3d.shadowAlpha * (1 - hop * 0.55));
      shadow.setDepth(depthOrder(actor.y, 0));
    }
  }

  syncPseudo3d() {
    this.applyActorPresentation(this.gemini, this.gemini.baseScale, this.geminiShadow, 44);

    for (const enemy of this.enemies.getChildren()) {
      if (!enemy.active) continue;
      this.applyActorPresentation(enemy, enemy.baseScale ?? 0.85, enemy.shadow, 34);
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

    this.add
      .text(24, 46, `${this.hero.name}  ·  Click move  ·  Double-click attack  ·  Right-click special`, {
        fontFamily: "Georgia, 'Times New Roman', serif",
        fontSize: "14px",
        color: COLORS.hudMuted,
      })
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
    const cx = GAME.width / 2;
    const cy = GAME.height / 2;

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

    const burst = this.add
      .image(this.gemini.x, this.gemini.y - 24, "burst")
      .setDepth(depthOrder(this.gemini.y, 8))
      .setScale(0.85 * depthScale(this.gemini.y));
    this.tweens.add({
      targets: burst,
      alpha: 0,
      scale: 1.35 * depthScale(this.gemini.y),
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

    this.cameras.main.shake(280, 0.014);
    this.cameras.main.flash(180, 255, 236, 160);

    const veil = this.add
      .rectangle(GAME.width / 2, GAME.height / 2, GAME.width, GAME.height, 0x04060c, 0)
      .setDepth(6);
    this.tweens.add({
      targets: veil,
      fillAlpha: 0.55,
      duration: 120,
      yoyo: true,
      hold: 220,
      onComplete: () => veil.destroy(),
    });

    if (this.hero.specialStyle === "beads") {
      this.playTenbuHorin(ox, oy, range);
    } else if (this.hero.specialStyle === "thunderbolt") {
      this.playAtomicThunderbolt(ox, oy, range);
    } else {
      this.playGalaxianExplosion(ox, oy, range);
    }

    this.tweens.add({
      targets: this.gemini,
      scale: 1.15,
      duration: 180,
      yoyo: true,
      ease: "Sine.Out",
      onComplete: () => {
        if (this.gemini.active) this.gemini.setScale(this.hero.scale);
      },
    });
    this.gemini.setTint(0xfff4c8);
    this.time.delayedCall(260, () => {
      if (this.gemini.active) this.gemini.clearTint();
    });

    const label = this.add
      .text(GAME.width / 2, 120, this.hero.specialName, {
        fontFamily: "Georgia, 'Times New Roman', serif",
        fontSize: "34px",
        color: "#f0e6b0",
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
      delay: 700,
      duration: 500,
      onComplete: () => label.destroy(),
    });

    this.damageEnemiesFromPoint(ox, oy, range, this.hero.specialDamage, true);
    this.time.delayedCall(180, () => {
      if (!this.ended) this.damageEnemiesFromPoint(ox, oy, range, this.hero.specialDamage, true);
    });
    this.time.delayedCall(360, () => {
      if (!this.ended) this.damageEnemiesFromPoint(ox, oy, range, this.hero.specialDamage, true);
    });
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

  playGalaxianExplosion(ox, oy, range) {
    // Shockwave rings — concentrated Cosmo released as a galactic blast
    for (let i = 0; i < 4; i += 1) {
      const ring = this.add.circle(ox, oy, 24, 0x000000, 0).setDepth(7);
      ring.setStrokeStyle(4 - i * 0.5, i % 2 === 0 ? 0xfff1a8 : 0x6ec8e0, 0.95);
      this.tweens.add({
        targets: ring,
        scale: range / 24,
        alpha: 0,
        duration: 700 + i * 90,
        delay: i * 70,
        ease: "Cubic.Out",
        onComplete: () => ring.destroy(),
      });
    }

    // Core nova between the hands / at Gemini
    const novas = [1.4, 2.2, 3.2, 4.2];
    for (let i = 0; i < novas.length; i += 1) {
      const burst = this.add
        .image(ox, oy, "burst")
        .setDepth(7)
        .setScale(novas[i] * 0.55)
        .setAlpha(0.95)
        .setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: burst,
        alpha: 0,
        scale: novas[i] * 1.35,
        angle: i % 2 === 0 ? 40 : -40,
        duration: 650 + i * 70,
        delay: i * 40,
        ease: "Cubic.Out",
        onComplete: () => burst.destroy(),
      });
    }

    // Spiral galaxy arms crashing outward
    for (let arm = 0; arm < 4; arm += 1) {
      const g = this.add.graphics().setDepth(7);
      const base = (Math.PI * 2 * arm) / 4;
      g.lineStyle(3, arm % 2 === 0 ? 0x7fd7ef : 0xfff1a8, 0.85);
      g.beginPath();
      for (let s = 0; s <= 28; s += 1) {
        const t = s / 28;
        const ang = base + t * Math.PI * 1.6;
        const dist = 16 + t * range * 0.92;
        const x = ox + Math.cos(ang) * dist;
        const y = oy + Math.sin(ang) * dist * 0.85;
        if (s === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.strokePath();
      this.tweens.add({
        targets: g,
        alpha: 0,
        duration: 700,
        delay: 80 + arm * 40,
        onComplete: () => g.destroy(),
      });
    }

    // "Planets / stars" crashing into the field
    for (let i = 0; i < 28; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const startDist = range * (0.15 + Math.random() * 0.25);
      const endDist = range * (0.55 + Math.random() * 0.45);
      const planet = this.add
        .circle(
          ox + Math.cos(angle) * startDist,
          oy + Math.sin(angle) * startDist,
          Phaser.Math.Between(3, 7),
          i % 3 === 0 ? 0xffffff : i % 3 === 1 ? 0x6ec8e0 : 0xd4b45a,
          1,
        )
        .setDepth(8);
      this.tweens.add({
        targets: planet,
        x: ox + Math.cos(angle + 0.8) * endDist,
        y: oy + Math.sin(angle + 0.8) * endDist,
        alpha: 0,
        scale: 0.3,
        duration: Phaser.Math.Between(480, 780),
        delay: Phaser.Math.Between(0, 160),
        ease: "Cubic.Out",
        onComplete: () => planet.destroy(),
      });
    }

    // Radial star beams
    for (let i = 0; i < 20; i += 1) {
      const angle = (Math.PI * 2 * i) / 20;
      const beam = this.add
        .rectangle(ox, oy, 5, 16, i % 2 === 0 ? 0xfff1a8 : 0x7fd7ef, 0.95)
        .setDepth(7)
        .setRotation(angle);
      this.tweens.add({
        targets: beam,
        displayHeight: range * 0.95,
        alpha: 0,
        duration: 520,
        delay: 40 + (i % 5) * 20,
        ease: "Cubic.Out",
        onComplete: () => beam.destroy(),
      });
    }
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
    enemy.body.setSize(type.body.w, type.body.h);
    enemy.body.setOffset(type.body.ox, type.body.oy);
    enemy.shadow = this.createGroundShadow(type.shadowW, type.shadowH);
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
