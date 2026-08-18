import { describe, it, expect } from "vitest";
import {
  APEX_RATIO,
  TARGET_FLIGHT_S,
  gravityForBounds,
  makeRng,
  launchTile,
  stepTile,
  tileIsOffStage,
} from "@/lib/ninja/physics";

describe("ninjaPhysics", () => {
  describe("gravityForBounds", () => {
    it("keeps total flight time roughly constant across viewport heights", () => {
      // A short (phone) stage and a tall (desktop) stage should each produce
      // a launch that returns to the floor in ~TARGET_FLIGHT_S — the whole
      // point of deriving gravity from bounds instead of a fixed constant,
      // which made a phone's shorter rise fall in much less time.
      const phone = { width: 390, height: 380, bottom: 380 };
      const desktop = { width: 1280, height: 720, bottom: 720 };

      function flightTime(bounds: typeof phone): number {
        const gravity = gravityForBounds(bounds);
        const tile = launchTile(() => 0.5, bounds, 0, 4, "测", true, 0);
        let t = 0;
        const dt = 1 / 240;
        while (tile.position.y <= bounds.bottom + 40 + 1 && t < 10) {
          tile.velocity.y += gravity * dt;
          tile.position.y += tile.velocity.y * dt;
          t += dt;
          if (t > dt * 2 && tile.velocity.y > 0) break; // let it start falling first
        }
        // continue until it returns to launch height
        while (tile.position.y < bounds.bottom + 40 && t < 10) {
          tile.velocity.y += gravity * dt;
          tile.position.y += tile.velocity.y * dt;
          t += dt;
        }
        return t;
      }

      const phoneTime = flightTime(phone);
      const desktopTime = flightTime(desktop);

      expect(phoneTime).toBeCloseTo(TARGET_FLIGHT_S, 0);
      expect(desktopTime).toBeCloseTo(TARGET_FLIGHT_S, 0);
      // The old fixed-GRAVITY behavior made the phone flight much shorter
      // than desktop; the fix keeps them within a fraction of a second.
      expect(Math.abs(phoneTime - desktopTime)).toBeLessThan(0.5);
    });

    it("respects APEX_RATIO in the derived rise height", () => {
      const bounds = { width: 400, height: 600, bottom: 600 };
      const startY = bounds.bottom + 40;
      const apexY = bounds.bottom - bounds.height * APEX_RATIO;
      const risePx = startY - apexY;
      const expectedGravity = (8 * risePx) / (TARGET_FLIGHT_S * TARGET_FLIGHT_S);
      expect(gravityForBounds(bounds)).toBeCloseTo(expectedGravity, 5);
    });
  });

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

      // vy0 = -sqrt(2 * gravityForBounds(bounds) * risePx), always
      // substantially upward regardless of the derived gravity.
      expect(tile.velocity.y).toBeLessThan(-100);
    });

    it("caps horizontal drift at a quarter of the lane width over the flight", () => {
      const bounds = { width: 400, height: 600, bottom: 600 };
      const laneWidth = bounds.width / 4;
      const rng = makeRng(4);
      const tile = launchTile(rng, bounds, 0, 4, "测", true, 1000, laneWidth);

      const maxVx = (laneWidth * 0.25 * 2) / TARGET_FLIGHT_S;
      expect(tile.velocity.x).toBeGreaterThanOrEqual(-maxVx);
      expect(tile.velocity.x).toBeLessThanOrEqual(maxVx);

      // Total lateral travel over a full flight stays within a quarter lane —
      // this is what actually prevents phone-width overlap (previously a
      // fixed ±50px/s could drift ±150px over a ~3s flight on a ~97px lane).
      expect(Math.abs(tile.velocity.x) * TARGET_FLIGHT_S).toBeLessThanOrEqual(laneWidth * 0.25);
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
      const gravity = gravityForBounds(bounds);

      stepTile(tile, bounds, 0.1);

      expect(tile.velocity.y).toBe(vy0 + gravity * 0.1);
    });

    it("updates position based on velocity", () => {
      const bounds = { width: 400, height: 600, bottom: 600 };
      const gravity = gravityForBounds(bounds);
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

      // stepTile applies gravity first: vy = 100 + gravity*0.1
      // Then updates position: y = 100 + vy*0.1
      const expectedVy = 100 + gravity * 0.1;
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
