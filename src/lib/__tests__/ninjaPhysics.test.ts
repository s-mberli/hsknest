import { describe, it, expect } from "vitest";
import { GRAVITY, APEX_RATIO, makeRng, launchTile, stepTile, tileIsOffStage } from "@/lib/ninja/physics";

describe("ninjaPhysics", () => {
  describe("makeRng", () => {
    it("produces seeded, deterministic sequences", () => {
      const rng1 = makeRng(12345);
      const seq1 = [rng1(), rng1(), rng1()];
      const rng2 = makeRng(12345);
      const seq2 = [rng2(), rng2(), rng2()];
      expect(seq1).toEqual(seq2);
    });

    it("produces different sequences with different seeds", () => {
      const rng1 = makeRng(12345);
      const seq1 = [rng1(), rng1(), rng1()];
      const rng2 = makeRng(54321);
      const seq2 = [rng2(), rng2(), rng2()];
      expect(seq1).not.toEqual(seq2);
    });

    it("produces values in [0, 1)", () => {
      const rng = makeRng();
      for (let i = 0; i < 100; i++) {
        const val = rng();
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThan(1);
      }
    });
  });

  describe("launchTile", () => {
    it("launches tile from correct lane centre", () => {
      const bounds = { width: 400, height: 600, bottom: 600 };
      const rng = makeRng(1);
      const tile = launchTile(rng, bounds, 1, 4, "测", true, 1000);

      // Lane 1 of 4: width/4 = 100, centre = 100*1 + 50 = 150
      expect(tile.position.x).toBeCloseTo(150, 0);
    });

    it("launches from stage bottom + 40px", () => {
      const bounds = { width: 400, height: 600, bottom: 600 };
      const rng = makeRng(2);
      const tile = launchTile(rng, bounds, 0, 4, "测", true, 1000);

      expect(tile.position.y).toBeCloseTo(640, 0);
    });

    it("computes upward velocity to reach apex", () => {
      const bounds = { width: 400, height: 600, bottom: 600 };
      const rng = makeRng(3);
      const tile = launchTile(rng, bounds, 0, 4, "测", true, 1000);

      // vy0 = -sqrt(2 * GRAVITY * risePx)
      // risePx = 640 - (600 - 600*0.58) = 640 - 252 = 388
      // vy0 = -sqrt(2 * 420 * 388) ≈ -403.4
      // But rng may vary risePx slightly; just check it's substantially upward
      expect(tile.velocity.y).toBeLessThan(-350);
    });

    it("assigns horizontal drift in ±50 px/s band", () => {
      const bounds = { width: 400, height: 600, bottom: 600 };
      const rng = makeRng(4);
      const tile = launchTile(rng, bounds, 0, 4, "测", true, 1000);

      expect(tile.velocity.x).toBeGreaterThanOrEqual(-50);
      expect(tile.velocity.x).toBeLessThanOrEqual(50);
    });

    it("stores tile as target or distractor", () => {
      const bounds = { width: 400, height: 600, bottom: 600 };
      const rng = makeRng(5);
      const target = launchTile(rng, bounds, 0, 4, "测", true, 1000);
      const distractor = launchTile(rng, bounds, 1, 4, "试", false, 1000);

      expect(target.isTarget).toBe(true);
      expect(distractor.isTarget).toBe(false);
    });
  });

  describe("stepTile", () => {
    it("applies gravity to vertical velocity", () => {
      const bounds = { width: 400, height: 600, bottom: 600 };
      const tile = launchTile(() => 0.5, bounds, 0, 4, "测", true, 1000);
      const vy0 = tile.velocity.y;

      stepTile(tile, bounds, 0.1);

      expect(tile.velocity.y).toBe(vy0 + GRAVITY * 0.1);
    });

    it("updates position based on velocity", () => {
      const bounds = { width: 400, height: 600, bottom: 600 };
      const tile = {
        id: "test",
        char: "测",
        isTarget: true,
        position: { x: 100, y: 100 },
        velocity: { x: 50, y: 100 },
        spinRate: 0,
        sliced: false,
        spawnTime: 1000,
      };

      stepTile(tile, bounds, 0.1);

      // stepTile applies gravity first: vy = 100 + GRAVITY*0.1
      // Then updates position: y = 100 + vy*0.1
      const expectedVy = 100 + GRAVITY * 0.1;
      const expectedY = 100 + expectedVy * 0.1;
      expect(tile.position.x).toBe(105); // 100 + 50*0.1
      expect(tile.position.y).toBeCloseTo(expectedY, 5);
    });

    it("clamps tile to horizontal stage bounds", () => {
      const bounds = { width: 400, height: 600, bottom: 600 };
      const tile = {
        id: "test",
        char: "测",
        isTarget: true,
        position: { x: 380, y: 300 },
        velocity: { x: 100, y: 0 },
        spinRate: 0,
        sliced: false,
        spawnTime: 1000,
      };

      stepTile(tile, bounds, 1);

      // After step: x = 380 + 100 = 480, but clamped to [70, 330] → 330
      expect(tile.position.x).toBeLessThanOrEqual(330);
      expect(tile.position.x).toBeGreaterThanOrEqual(70);
    });
  });

  describe("tileIsOffStage", () => {
    it("detects tile below stage floor", () => {
      const bounds = { width: 400, height: 600, bottom: 600 };
      const tile = {
        id: "test",
        char: "测",
        isTarget: true,
        position: { x: 200, y: 750 },
        velocity: { x: 0, y: 0 },
        spinRate: 0,
        sliced: false,
        spawnTime: 1000,
      };

      expect(tileIsOffStage(tile, bounds)).toBe(true);
    });

    it("returns false for tile still in bounds", () => {
      const bounds = { width: 400, height: 600, bottom: 600 };
      const tile = {
        id: "test",
        char: "测",
        isTarget: true,
        position: { x: 200, y: 500 },
        velocity: { x: 0, y: 0 },
        spinRate: 0,
        sliced: false,
        spawnTime: 1000,
      };

      expect(tileIsOffStage(tile, bounds)).toBe(false);
    });

    it("uses 100px grace zone below floor", () => {
      const bounds = { width: 400, height: 600, bottom: 600 };
      const tile = {
        id: "test",
        char: "测",
        isTarget: true,
        position: { x: 200, y: 690 },
        velocity: { x: 0, y: 0 },
        spinRate: 0,
        sliced: false,
        spawnTime: 1000,
      };

      expect(tileIsOffStage(tile, bounds)).toBe(false);
    });
  });
});
