import { describe, it, expect, vi, beforeEach } from "vitest";

const webPush = vi.hoisted(() => ({ sendPushToUser: vi.fn(), sendPushToUsers: vi.fn(), sendPushToAdmin: vi.fn() }));
const fcmPush = vi.hoisted(() => ({ sendFcmToUser: vi.fn(), sendFcmToUsers: vi.fn(), sendFcmToAdmin: vi.fn() }));
vi.mock("./webPush", () => webPush);
vi.mock("./fcmPush", () => fcmPush);

import { notifyUser, notifyUsers, notifyAdmin } from "./pushDispatch";

beforeEach(() => vi.clearAllMocks());

describe("pushDispatch fan-out", () => {
  it("notifyUser hits both web and fcm with same args", async () => {
    const payload = { title: "t", body: "b" };
    await notifyUser(5, payload);
    expect(webPush.sendPushToUser).toHaveBeenCalledWith(5, payload);
    expect(fcmPush.sendFcmToUser).toHaveBeenCalledWith(5, payload);
  });

  it("notifyAdmin hits both web and fcm", async () => {
    const payload = { title: "t", body: "b" };
    await notifyAdmin(payload);
    expect(webPush.sendPushToAdmin).toHaveBeenCalledWith(payload);
    expect(fcmPush.sendFcmToAdmin).toHaveBeenCalledWith(payload);
  });

  it("notifyUsers hits both web and fcm", async () => {
    const payload = { title: "t", body: "b" };
    await notifyUsers([1, 2], payload);
    expect(webPush.sendPushToUsers).toHaveBeenCalledWith([1, 2], payload);
    expect(fcmPush.sendFcmToUsers).toHaveBeenCalledWith([1, 2], payload);
  });
});
