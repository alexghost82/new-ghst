import { describe, it, expect } from "vitest";
import {
  consumerReducer,
  initialConsumerState,
  runConsumer,
  type ConsumerEvent,
} from "./chatStreamConsumer";
import { GHOST_REFUSAL_MSG_EN } from "../utils/sanitize";

const EN = { locale: "en" as const };

function tokens(text: string): ConsumerEvent[] {
  // One event per character — the harshest streaming granularity.
  return [...text].map((ch) => ({ type: "token", token: ch }) as ConsumerEvent);
}

describe("chatStreamConsumer — single-camera turn", () => {
  it("commits one bubble with the full reply on a clean stream", () => {
    const events: ConsumerEvent[] = [
      { type: "user_message", user_message_id: "u1", camera_count: 0 },
      ...tokens("Two people at the gate."),
      { type: "done", message_id: "a1", user_message_id: "u1" },
      { type: "end", isMulti: false },
    ];
    const state = runConsumer(events, EN);
    expect(state.committed).toHaveLength(1);
    expect(state.committed[0].content).toBe("Two people at the gate.");
    expect(state.committed[0].messageId).toBe("a1");
    expect(state.serverUserMessageId).toBe("u1");
    expect(state.finished).toBe(true);
    expect(state.accumulated).toBe("");
  });

  it("replaces a refusal reply with the Ghost message at commit", () => {
    const events: ConsumerEvent[] = [
      ...tokens("I'm sorry, but I can't assist with that."),
      { type: "done", message_id: "a1" },
      { type: "end", isMulti: false },
    ];
    const state = runConsumer(events, EN);
    expect(state.committed).toHaveLength(1);
    expect(state.committed[0].content).toBe(GHOST_REFUSAL_MSG_EN);
  });

  it("never exposes a refusal in the live display while streaming", () => {
    let state = initialConsumerState();
    const refusal = "I'm sorry, but I can't assist with that.";
    for (const ch of refusal) {
      state = consumerReducer(state, { type: "token", token: ch }, EN);
      // The display must never contain a raw apology fragment.
      expect(state.display.toLowerCase()).not.toContain("i'm sorry, but i can");
    }
  });
});

describe("chatStreamConsumer — Stop / abort", () => {
  it("commits the partial reply on abort (never discarded)", () => {
    let state = initialConsumerState();
    for (const ch of "Partial repl") {
      state = consumerReducer(state, { type: "token", token: ch }, EN);
    }
    state = consumerReducer(state, { type: "abort" }, EN);
    expect(state.finished).toBe(true);
    expect(state.committed).toHaveLength(1);
    expect(state.committed[0].content).toBe("Partial repl");
  });

  it("aborting with no content commits nothing", () => {
    const state = consumerReducer(
      initialConsumerState(),
      { type: "abort" },
      EN,
    );
    expect(state.committed).toHaveLength(0);
    expect(state.finished).toBe(true);
  });
});

describe("chatStreamConsumer — multi-camera turn", () => {
  it("commits one bubble per camera_done with correct labels", () => {
    const events: ConsumerEvent[] = [
      { type: "camera_start", label: "Gate A", index: 0 },
      ...tokens("Clear at A."),
      {
        type: "camera_done",
        label: "Gate A",
        message_id: "a1",
        image_path: "/img/a.jpg",
      },
      { type: "camera_start", label: "Gate B", index: 1 },
      ...tokens("Two people at B."),
      {
        type: "camera_done",
        label: "Gate B",
        message_id: "a2",
        image_path: "/img/b.jpg",
      },
      { type: "end", isMulti: true },
    ];
    const state = runConsumer(events, EN);
    expect(state.committed).toHaveLength(2);
    expect(state.committed[0]).toMatchObject({
      content: "Clear at A.",
      cameraLabel: "Gate A",
      messageId: "a1",
      imagePath: "/img/a.jpg",
    });
    expect(state.committed[1]).toMatchObject({
      content: "Two people at B.",
      cameraLabel: "Gate B",
      messageId: "a2",
      imagePath: "/img/b.jpg",
    });
  });
});
