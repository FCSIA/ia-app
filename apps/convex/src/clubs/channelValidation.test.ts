import { describe, expect, test } from "vitest";
import {
  MAX_CHANNEL_MESSAGE_BODY_CHARACTERS,
  MAX_CHANNEL_MESSAGE_MARKDOWN_CHARACTERS,
  assertChannelMessageBodyBounds,
  normalizeChannelPoll,
} from "./channelValidation";

describe("club channel message validation", () => {
  test("bounds portable and legacy body representations", () => {
    expect(() =>
      assertChannelMessageBodyBounds(
        "x".repeat(MAX_CHANNEL_MESSAGE_BODY_CHARACTERS + 1),
      ),
    ).toThrow("Message is too long");
    expect(() =>
      assertChannelMessageBodyBounds(
        "plain",
        "x".repeat(MAX_CHANNEL_MESSAGE_MARKDOWN_CHARACTERS + 1),
      ),
    ).toThrow("Message formatting is too long");
    expect(() =>
      assertChannelMessageBodyBounds("plain", "**plain**", [{ text: "plain" }]),
    ).not.toThrow();
  });

  test("normalizes a bounded poll", () => {
    expect(
      normalizeChannelPoll("  Lunch? ", [
        { id: "option-1", label: "  First lunch " },
        { id: "option-2", label: "Second lunch" },
      ]),
    ).toEqual({
      question: "Lunch?",
      options: [
        { id: "option-1", label: "First lunch" },
        { id: "option-2", label: "Second lunch" },
      ],
    });
  });

  test("rejects malformed or duplicate poll choices", () => {
    expect(() =>
      normalizeChannelPoll("Question", [{ id: "one", label: "Only" }]),
    ).toThrow("Polls must have between 2 and 6 choices");
    expect(() =>
      normalizeChannelPoll("Question", [
        { id: "one", label: "Same" },
        { id: "two", label: " same " },
      ]),
    ).toThrow("Poll choices must be unique");
    expect(() =>
      normalizeChannelPoll("Question", [
        { id: "not allowed", label: "One" },
        { id: "two", label: "Two" },
      ]),
    ).toThrow("Poll choice identifiers are invalid");
  });
});
