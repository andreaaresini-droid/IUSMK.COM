import { describe, it, expect, vi } from "vitest";

// firebase-admin is imported at module load; stub it so importing fcmPush never
// touches real credentials.
vi.mock("firebase-admin", () => ({
  default: {
    apps: [],
    initializeApp: vi.fn(),
    credential: { cert: vi.fn() },
    messaging: () => ({ sendEachForMulticast: vi.fn() }),
  },
}));
vi.mock("@workspace/db", () => ({ db: {} }));
vi.mock("@workspace/db/schema", () => ({ nativePushTokensTable: {} }));

import { deadTokensFromResponses } from "./fcmPush";

describe("deadTokensFromResponses", () => {
  it("returns tokens whose response failed with registration-token-not-registered", () => {
    const tokens = ["good", "dead", "other-error"];
    const responses = [
      { success: true },
      { success: false, error: { code: "messaging/registration-token-not-registered" } },
      { success: false, error: { code: "messaging/internal-error" } },
    ];
    expect(deadTokensFromResponses(tokens, responses)).toEqual(["dead"]);
  });

  it("returns empty array when all succeed", () => {
    expect(deadTokensFromResponses(["a", "b"], [{ success: true }, { success: true }])).toEqual([]);
  });
});
