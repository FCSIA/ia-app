import { describe, expect, it } from "vitest";
import { chatSafeAreaOffset } from "./chat-keyboard-layout";

describe("chatSafeAreaOffset", () => {
  it("keeps a compact margin above an iPhone home indicator", () => {
    expect(chatSafeAreaOffset(34, 8)).toBe(26);
  });

  it("does not create a negative offset without a bottom inset", () => {
    expect(chatSafeAreaOffset(0, 8)).toBe(0);
    expect(chatSafeAreaOffset(4, 8)).toBe(0);
  });
});
