/**
 * Route-level test for the Stripe webhook's cancellation-survey addition
 * (Exit Interviews, Gym Launch Secrets ch.16 — see
 * src/lib/email.ts:sendCancellationSurveyEmail and the
 * customer.subscription.deleted case in ../webhook/route.ts).
 *
 * Uses its own DB file so this file's `prisma db push` doesn't race the
 * other route-test files when Vitest runs files in parallel (same reasoning
 * as authz.test.ts / staleSession.test.ts).
 */
import { execSync } from "node:child_process";
import { existsSync, unlinkSync } from "node:fs";
import path from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";

const TEST_DB_PATH = path.join(
  __dirname,
  "..",
  "..",
  "..",
  "..",
  "..",
  "prisma",
  "test-integration-webhook.db"
);
const TEST_DB_URL = `file:${TEST_DB_PATH}`;

let testPrisma: PrismaClient;
let mockEvent: { type: string; data: { object: Record<string, unknown> } } | null = null;
let constructEventShouldThrow = false;

const sendCancellationSurveyEmail = vi.fn(async () => ({ success: true, data: null }));

vi.mock("@/lib/prisma", () => ({
  get prisma() {
    return testPrisma;
  },
}));
vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({
    webhooks: {
      constructEvent: () => {
        if (constructEventShouldThrow) throw new Error("bad signature");
        return mockEvent;
      },
    },
  }),
}));
vi.mock("@/lib/email", () => ({
  sendCancellationSurveyEmail,
}));

const originalSelfHosted = process.env.SELF_HOSTED;
const originalWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
process.env.SELF_HOSTED = "false";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";

// Imported after the mocks/env above so the route picks up the mocked modules.
const { POST: webhookPOST } = await import("@/app/api/billing/webhook/route");

function webhookRequest() {
  return new Request("http://localhost/api/billing/webhook", {
    method: "POST",
    headers: { "stripe-signature": "t=1,v1=fake" },
    body: "{}", // constructEvent is mocked, so the raw body content doesn't matter
  });
}

function deleteTestDbFiles() {
  for (const suffix of ["", "-journal", "-wal", "-shm"]) {
    const p = TEST_DB_PATH + suffix;
    if (existsSync(p)) unlinkSync(p);
  }
}

describe(
  "POST /api/billing/webhook — customer.subscription.deleted",
  () => {
    beforeAll(() => {
      deleteTestDbFiles();
      execSync("npx prisma db push --skip-generate --accept-data-loss", {
        env: { ...process.env, DATABASE_URL: TEST_DB_URL },
        cwd: process.cwd(),
        stdio: "pipe",
      });
      testPrisma = new PrismaClient({ datasources: { db: { url: TEST_DB_URL } } });
    }, 60000);

    afterAll(async () => {
      await testPrisma?.$disconnect();
      deleteTestDbFiles();
      process.env.SELF_HOSTED = originalSelfHosted;
      process.env.STRIPE_WEBHOOK_SECRET = originalWebhookSecret;
    });

    beforeEach(async () => {
      mockEvent = null;
      constructEventShouldThrow = false;
      sendCancellationSurveyEmail.mockClear();
      await testPrisma.user.deleteMany();
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it("rejects an invalid signature with 400, before touching the DB", async () => {
      constructEventShouldThrow = true;
      const res = await webhookPOST(webhookRequest());
      expect(res.status).toBe(400);
      expect(sendCancellationSurveyEmail).not.toHaveBeenCalled();
    });

    it("updates status to canceled and sends the survey email for a real user", async () => {
      const user = await testPrisma.user.create({
        data: {
          email: `real-${Date.now()}@test.local`,
          passwordHash: "x",
          subscriptionStatus: "active",
        },
      });
      mockEvent = {
        type: "customer.subscription.deleted",
        data: { object: { metadata: { userId: user.id }, customer: "cus_x" } },
      };

      const res = await webhookPOST(webhookRequest());
      expect(res.status).toBe(200);

      const updated = await testPrisma.user.findUnique({ where: { id: user.id } });
      expect(updated?.subscriptionStatus).toBe("canceled");

      expect(sendCancellationSurveyEmail).toHaveBeenCalledTimes(1);
      expect(sendCancellationSurveyEmail).toHaveBeenCalledWith(user.email);
    });

    it("falls back to stripeCustomerId when no userId is in metadata", async () => {
      const user = await testPrisma.user.create({
        data: {
          email: `bycustomer-${Date.now()}@test.local`,
          passwordHash: "x",
          subscriptionStatus: "active",
          stripeCustomerId: "cus_lookup_me",
        },
      });
      mockEvent = {
        type: "customer.subscription.deleted",
        data: { object: { metadata: {}, customer: "cus_lookup_me" } },
      };

      await webhookPOST(webhookRequest());

      const updated = await testPrisma.user.findUnique({ where: { id: user.id } });
      expect(updated?.subscriptionStatus).toBe("canceled");
      expect(sendCancellationSurveyEmail).toHaveBeenCalledWith(user.email);
    });

    it("does NOT send an email for a guest account", async () => {
      const user = await testPrisma.user.create({
        data: {
          email: `guest-${Date.now()}@guest.local`,
          passwordHash: "x",
          subscriptionStatus: "active",
        },
      });
      mockEvent = {
        type: "customer.subscription.deleted",
        data: { object: { metadata: { userId: user.id }, customer: "cus_x" } },
      };

      const res = await webhookPOST(webhookRequest());
      expect(res.status).toBe(200);
      expect(sendCancellationSurveyEmail).not.toHaveBeenCalled();
    });

    it("does NOT attempt an email when no user matched the event (nothing to update)", async () => {
      mockEvent = {
        type: "customer.subscription.deleted",
        data: {
          object: { metadata: { userId: "no-such-user" }, customer: "cus_nope" },
        },
      };

      const res = await webhookPOST(webhookRequest());
      expect(res.status).toBe(200); // still acknowledged — Stripe must not retry forever
      expect(sendCancellationSurveyEmail).not.toHaveBeenCalled();
    });

    it("a cancellation-email failure does not turn the webhook response into a 500", async () => {
      const user = await testPrisma.user.create({
        data: {
          email: `flaky-${Date.now()}@test.local`,
          passwordHash: "x",
          subscriptionStatus: "active",
        },
      });
      sendCancellationSurveyEmail.mockRejectedValueOnce(new Error("resend down"));
      mockEvent = {
        type: "customer.subscription.deleted",
        data: { object: { metadata: { userId: user.id }, customer: "cus_x" } },
      };

      const res = await webhookPOST(webhookRequest());
      // The subscription-status update is what matters and already
      // succeeded — a flaky email provider must not make Stripe retry the
      // whole event (which would re-run the DB update too, harmlessly, but
      // needlessly).
      expect(res.status).toBe(200);
      const updated = await testPrisma.user.findUnique({ where: { id: user.id } });
      expect(updated?.subscriptionStatus).toBe("canceled");
    });
  },
  60000
);
