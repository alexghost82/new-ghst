import { describe, it, expect } from "vitest";
import { bumpToFront } from "./conversationOrder";

describe("bumpToFront", () => {
  it("moves an existing id to the front, preserving the rest", () => {
    expect(bumpToFront(["a", "b", "c"], "c")).toEqual(["c", "a", "b"]);
    expect(bumpToFront(["a", "b", "c"], "b")).toEqual(["b", "a", "c"]);
  });

  it("is a no-op when already first", () => {
    const ids = ["a", "b", "c"];
    expect(bumpToFront(ids, "a")).toBe(ids);
  });

  it("adds the id to the front when missing", () => {
    expect(bumpToFront(["a", "b"], "z")).toEqual(["z", "a", "b"]);
  });

  it("handles an empty list", () => {
    expect(bumpToFront([], "a")).toEqual(["a"]);
  });
});
