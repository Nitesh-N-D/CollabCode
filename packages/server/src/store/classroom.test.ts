import { beforeEach, describe, expect, it } from "vitest";
import { ClassroomStore } from "./classroom";

describe("ClassroomStore", () => {
  let store: ClassroomStore;

  beforeEach(() => {
    store = new ClassroomStore();
  });

  it("preserves session events across reconnects", () => {
    store.joinStudent("CS101", "s1", "Asha", "socket-1");
    store.updateSnapshot({
      roomCode: "CS101",
      studentId: "s1",
      displayName: "Asha",
      fileName: "main.py",
      languageId: "python",
      content: "print('hello')",
      cursorLine: 1,
      idleMs: 0,
      timestamp: 10
    });
    store.disconnect("socket-1");
    const rejoined = store.joinStudent("CS101", "s1", "Asha", "socket-2");
    expect(rejoined.sessionEvents.some((event) => event.type === "snapshot")).toBe(true);
    expect(rejoined.connected).toBe(true);
  });

  it("builds analytics from idle snapshots", () => {
    store.joinStudent("LAB", "s1", "Mina", "socket");
    store.updateSnapshot({
      roomCode: "LAB",
      studentId: "s1",
      displayName: "Mina",
      fileName: "solution.py",
      languageId: "python",
      content: "pass",
      cursorLine: 8,
      idleMs: 45_000,
      timestamp: 10
    });
    expect(store.getAnalytics("LAB")?.heatmap[0]).toMatchObject({
      fileName: "solution.py",
      struggleCount: 1
    });
  });
});
