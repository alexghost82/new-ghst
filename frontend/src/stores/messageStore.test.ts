// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ChatStreamEvent } from "../types/api";

/** Build a ReadableStream that emits the given events then closes. */
function streamOf(
  events: ChatStreamEvent[],
): ReadableStream<ChatStreamEvent> {
  return new ReadableStream<ChatStreamEvent>({
    start(controller) {
      for (const e of events) controller.enqueue(e);
      controller.close();
    },
  });
}

/**
 * A stream that emits some initial tokens, then parks until the test calls
 * ``release()``. If the abort ``signal`` fires while parked, the next pull
 * rejects with AbortError (mirroring how fetch tears down an aborted body).
 */
function makeGatedStream(
  signal: AbortSignal,
  initialTokens: string[],
  tail: ChatStreamEvent[],
): { stream: ReadableStream<ChatStreamEvent>; release: () => void } {
  let i = 0;
  let released = false;
  let resolveGate!: () => void;
  const gate = new Promise<void>((r) => {
    resolveGate = r;
  });
  const abortError = () => new DOMException("Aborted", "AbortError");
  const stream = new ReadableStream<ChatStreamEvent>({
    async pull(controller) {
      if (signal.aborted) return controller.error(abortError());
      if (i < initialTokens.length) {
        controller.enqueue({ type: "token", token: initialTokens[i++] });
        return;
      }
      if (!released) await gate;
      if (signal.aborted) return controller.error(abortError());
      for (const e of tail) controller.enqueue(e);
      controller.close();
    },
  });
  return {
    stream,
    release: () => {
      released = true;
      resolveGate();
    },
  };
}

// Hoisted so the (hoisted) vi.mock factory can safely reference them — ESM
// imports run before module-body const initializers.
const { sendMessageMock, getMessagesMock, autoTitleMock } = vi.hoisted(() => ({
  sendMessageMock: vi.fn(),
  getMessagesMock: vi.fn(),
  autoTitleMock: vi.fn(),
}));

// Partial mock: keep every real export (userStore imports setApiActiveUser at
// module load) and override only the network methods this flow exercises.
vi.mock("../api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/client")>();
  return {
    ...actual,
    api: {
      ...actual.api,
      sendMessage: sendMessageMock,
      getMessages: getMessagesMock,
      generateAutoTitle: autoTitleMock,
    },
  };
});

import { useMessageStore } from "./messageStore";

function resetStore() {
  useMessageStore.setState({
    messages: [],
    isLoading: false,
    isStreaming: false,
    streamingContent: "",
    streamingSourceImage: null,
    streamingCameraLabel: null,
    error: null,
    abortController: null,
    pendingRefetch: null,
  });
}

beforeEach(() => {
  sendMessageMock.mockReset();
  getMessagesMock.mockReset();
  getMessagesMock.mockResolvedValue({ ok: true, data: [] });
  autoTitleMock.mockReset();
  autoTitleMock.mockResolvedValue({ ok: false });
  resetStore();
});

describe("messageStore.sendMessage — clean stream wiring", () => {
  it("appends the user message and the assistant reply, then resets stream state", async () => {
    sendMessageMock.mockResolvedValue(
      streamOf([
        { type: "user_message", user_message_id: "u1", camera_count: 0 },
        { type: "token", token: "Two " },
        { type: "token", token: "people at the gate." },
        { type: "done", message_id: "a1", user_message_id: "u1" },
      ]),
    );

    await useMessageStore.getState().sendMessage("c1", "user1", "hi");

    const s = useMessageStore.getState();
    expect(s.isStreaming).toBe(false);
    expect(s.streamingContent).toBe("");
    expect(s.abortController).toBeNull();
    expect(s.error).toBeNull();
    expect(s.messages).toHaveLength(2);
    expect(s.messages[0]).toMatchObject({
      role: "user",
      content: "hi",
      id: "u1",
    });
    expect(s.messages[1]).toMatchObject({
      role: "assistant",
      content: "Two people at the gate.",
    });
  });

  it("replaces a streamed refusal reply with the Ghost message", async () => {
    sendMessageMock.mockResolvedValue(
      streamOf([
        { type: "user_message", user_message_id: "u1", camera_count: 0 },
        { type: "token", token: "I'm sorry, but I can't assist with that." },
        { type: "done", message_id: "a1", user_message_id: "u1" },
      ]),
    );

    await useMessageStore.getState().sendMessage("c1", "user1", "hi");

    const assistant = useMessageStore
      .getState()
      .messages.find((m) => m.role === "assistant");
    expect(assistant?.content).not.toMatch(/i'?m sorry/i);
    expect(assistant?.content).toContain("Ghost");
  });
});

describe("messageStore.cancelStream — Stop saves the partial reply", () => {
  it("commits exactly one partial assistant bubble and clears stream state", async () => {
    let capturedSignal: AbortSignal | undefined;
    let release = () => {};
    sendMessageMock.mockImplementation((...args: unknown[]) => {
      capturedSignal = args[8] as AbortSignal;
      const gated = makeGatedStream(
        capturedSignal,
        ["Partial ", "reply"],
        [{ type: "done", message_id: "a1" }],
      );
      release = gated.release;
      return Promise.resolve(gated.stream);
    });

    const sendPromise = useMessageStore
      .getState()
      .sendMessage("c1", "user1", "hi");

    // Wait until the partial reply is visibly streaming.
    await vi.waitFor(() => {
      expect(useMessageStore.getState().streamingContent).toContain("Partial");
    });

    // Operator presses Stop, then the parked stream resumes and sees the abort.
    useMessageStore.getState().cancelStream();
    release();
    await sendPromise;

    const s = useMessageStore.getState();
    const assistants = s.messages.filter((m) => m.role === "assistant");
    expect(assistants).toHaveLength(1); // not duplicated
    expect(assistants[0].content).toBe("Partial reply");
    expect(s.isStreaming).toBe(false);
    expect(s.streamingContent).toBe("");
    expect(s.abortController).toBeNull();
    expect(s.error).toBeNull();
  });
});

describe("messageStore.fetchMessages — deferred while streaming", () => {
  it("does not clobber an in-flight reply and flushes after the stream ends", async () => {
    const { useConversationStore } = await import("./conversationStore");
    useConversationStore.setState({ activeConversationId: "c1" });

    let capturedSignal: AbortSignal | undefined;
    let release = () => {};
    sendMessageMock.mockImplementation((...args: unknown[]) => {
      capturedSignal = args[8] as AbortSignal;
      const gated = makeGatedStream(
        capturedSignal,
        ["Working on it"],
        [{ type: "done", message_id: "a1" }],
      );
      release = gated.release;
      return Promise.resolve(gated.stream);
    });

    const sendPromise = useMessageStore
      .getState()
      .sendMessage("c1", "user1", "hi");

    await vi.waitFor(() => {
      expect(useMessageStore.getState().streamingContent).toContain("Working");
    });

    // A task/alert refresh fires mid-stream on the open conversation.
    getMessagesMock.mockClear();
    await useMessageStore.getState().fetchMessages("c1", "user1");

    // It must be deferred: messages not wiped, no network call yet.
    const mid = useMessageStore.getState();
    expect(getMessagesMock).not.toHaveBeenCalled();
    expect(mid.pendingRefetch).toEqual({
      conversationId: "c1",
      userId: "user1",
    });
    expect(mid.messages.some((m) => m.role === "user")).toBe(true);

    // Finish the stream → the deferred refetch runs exactly once.
    release();
    await sendPromise;
    await vi.waitFor(() => {
      expect(getMessagesMock).toHaveBeenCalledTimes(1);
    });
    expect(useMessageStore.getState().pendingRefetch).toBeNull();
  });
});
