import { create } from "zustand";
import type {
  IncidentActivity,
  IncidentCorrelation,
  IncidentDetail,
  IncidentEvent,
  IncidentEvidence,
  IncidentEventStreamPayload,
  IncidentKPI,
  IncidentNote,
  IncidentSeverity,
  IncidentStatus,
  IncidentSummaryResult,
  IncidentInvestigationResult,
} from "../types/api";
import { api } from "../api/client";
import { sanitizeBrand } from "../utils/sanitize";
import { useLanguageStore } from "./languageStore";

/**
 * Incident Pipeline store.
 *
 * Holds an id-keyed map of incidents plus per-column ordered lists so the
 * board can render without re-sorting on every render. Background SSE
 * updates flow in through ``_receiveCreated`` / ``_receiveUpdate`` and
 * are merged optimistically with whatever the operator did locally.
 *
 * Optimistic move semantics: when the operator drags a card, we mutate
 * ``columnOrder`` + ``incidents[id].status`` *before* the PATCH lands,
 * then revert on failure. The SSE echo from the server is a no-op
 * because the incident is already in the target state.
 */

const STATUSES: IncidentStatus[] = [
  "new",
  "handling",
  "investigation",
  "closed",
];

type ColumnOrder = Record<IncidentStatus, string[]>;

function emptyColumnOrder(): ColumnOrder {
  return {
    new: [],
    handling: [],
    investigation: [],
    closed: [],
  };
}

function sortByCreatedDesc(a: IncidentEvent, b: IncidentEvent): number {
  return (
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

function deriveColumnOrder(
  incidents: Record<string, IncidentEvent>,
): ColumnOrder {
  const cols = emptyColumnOrder();
  const list = Object.values(incidents).sort(sortByCreatedDesc);
  for (const inc of list) {
    const status = STATUSES.includes(inc.status) ? inc.status : "new";
    cols[status].push(inc.id);
  }
  return cols;
}

interface Filters {
  search: string;
  severity?: IncidentSeverity;
  assignedTo?: string;
}

interface IncidentState {
  incidents: Record<string, IncidentEvent>;
  columnOrder: ColumnOrder;
  activeIncidentId: string | null;
  filters: Filters;
  loading: boolean;
  loadingDetail: Record<string, boolean>;
  error: string | null;
  draggingId: string | null;
  /** Incident id awaiting the operator's closure summary. While set,
   *  the global IncidentCloseModal renders over the UI and blocks any
   *  status change until the operator confirms or cancels. */
  pendingCloseIncidentId: string | null;
  /** Whether the current close confirmation is mid-flight (POST in
   *  progress). Used to disable the modal's submit button. */
  closingInFlight: boolean;
  kpi: IncidentKPI | null;
  timeline: Record<string, IncidentActivity[]>;
  notes: Record<string, IncidentNote[]>;
  evidence: Record<string, IncidentEvidence[]>;
  correlated: Record<string, IncidentCorrelation>;
  summaryDrafts: Record<string, IncidentSummaryResult>;
  investigationConversations: Record<string, string>;

  fetchIncidents: (userId: string) => Promise<void>;
  fetchIncidentDetail: (incidentId: string, userId: string) => Promise<void>;
  fetchCorrelation: (incidentId: string, userId: string) => Promise<void>;
  fetchKPI: (userId: string, windowHours?: number) => Promise<void>;

  moveIncident: (
    incidentId: string,
    userId: string,
    targetStatus: IncidentStatus,
  ) => Promise<void>;
  assignIncident: (
    incidentId: string,
    userId: string,
    assigneeId: string | null,
  ) => Promise<void>;
  patchIncident: (
    incidentId: string,
    userId: string,
    patch: Partial<{
      status: IncidentStatus;
      severity: IncidentSeverity;
      tags: string[];
    }>,
  ) => Promise<void>;
  addNote: (
    incidentId: string,
    userId: string,
    content: string,
  ) => Promise<IncidentNote | null>;
  /** Open the global closure-summary modal for the given incident.
   *  Does NOT mutate the incident's status — that happens in
   *  ``confirmClose`` once the operator submits a non-empty summary. */
  requestClose: (incidentId: string) => void;
  cancelClose: () => void;
  /** Final close: persists ``resolution`` as ``summary`` on the
   *  incident, transitions to ``closed``, and removes the pending
   *  modal. Returns the closed incident or null on failure. */
  confirmClose: (
    userId: string,
    resolution: string,
  ) => Promise<IncidentEvent | null>;
  refreshSummary: (
    incidentId: string,
    userId: string,
  ) => Promise<IncidentSummaryResult | null>;
  startInvestigation: (
    incidentId: string,
    userId: string,
  ) => Promise<IncidentInvestigationResult | null>;

  openWorkspace: (incidentId: string) => void;
  closeWorkspace: () => void;
  setDragging: (incidentId: string | null) => void;
  setFilters: (patch: Partial<Filters>) => void;
  clearError: () => void;

  _receiveCreated: (incident: IncidentEvent) => void;
  _receiveUpdate: (
    incidentId: string,
    patch: Extract<
      IncidentEventStreamPayload,
      { type: "incident_update" }
    >["patch"],
  ) => void;
}

export const useIncidentStore = create<IncidentState>((set, get) => ({
  incidents: {},
  columnOrder: emptyColumnOrder(),
  activeIncidentId: null,
  filters: { search: "" },
  loading: false,
  loadingDetail: {},
  error: null,
  draggingId: null,
  pendingCloseIncidentId: null,
  closingInFlight: false,
  kpi: null,
  timeline: {},
  notes: {},
  evidence: {},
  correlated: {},
  summaryDrafts: {},
  investigationConversations: {},

  fetchIncidents: async (userId) => {
    set({ loading: true });
    const res = await api.listIncidents(userId, { limit: 500 });
    if (res.ok && res.data) {
      const incidents: Record<string, IncidentEvent> = {};
      for (const inc of res.data) incidents[inc.id] = inc;
      set({
        incidents,
        columnOrder: deriveColumnOrder(incidents),
        loading: false,
      });
    } else {
      set({
        loading: false,
        error: sanitizeBrand(
          res.error?.message ?? "Failed to load incidents",
        ),
      });
    }
  },

  fetchIncidentDetail: async (incidentId, userId) => {
    set((s) => ({
      loadingDetail: { ...s.loadingDetail, [incidentId]: true },
    }));
    const res = await api.getIncident(incidentId, userId);
    if (res.ok && res.data) {
      const detail: IncidentDetail = res.data;
      set((s) => {
        const incidents = { ...s.incidents, [detail.incident.id]: detail.incident };
        const investigationConversations = { ...s.investigationConversations };
        if (detail.incident.conversation_id) {
          investigationConversations[detail.incident.id] =
            detail.incident.conversation_id;
        }
        return {
          incidents,
          columnOrder: deriveColumnOrder(incidents),
          timeline: { ...s.timeline, [detail.incident.id]: detail.timeline },
          notes: { ...s.notes, [detail.incident.id]: detail.notes },
          evidence: { ...s.evidence, [detail.incident.id]: detail.evidence },
          investigationConversations,
          loadingDetail: { ...s.loadingDetail, [incidentId]: false },
        };
      });
    } else {
      set((s) => ({
        loadingDetail: { ...s.loadingDetail, [incidentId]: false },
        error: sanitizeBrand(
          res.error?.message ?? "Failed to load incident",
        ),
      }));
    }
  },

  fetchCorrelation: async (incidentId, userId) => {
    const res = await api.getIncidentCorrelation(incidentId, userId);
    if (res.ok && res.data) {
      set((s) => ({
        correlated: { ...s.correlated, [incidentId]: res.data! },
      }));
    }
  },

  fetchKPI: async (userId, windowHours = 24) => {
    const res = await api.getIncidentKPI(userId, windowHours);
    if (res.ok && res.data) {
      set({ kpi: res.data });
    }
  },

  moveIncident: async (incidentId, userId, targetStatus) => {
    const prev = get().incidents[incidentId];
    if (!prev || prev.status === targetStatus) return;

    // Hard gate: closing requires the operator to enter a written
    // closure summary. Defer the move to ``confirmClose`` and show the
    // global modal instead of optimistically dropping the card into
    // the "closed" column.
    if (targetStatus === "closed") {
      set({ pendingCloseIncidentId: incidentId });
      return;
    }

    set((s) => {
      const incidents = {
        ...s.incidents,
        [incidentId]: { ...prev, status: targetStatus },
      };
      return {
        incidents,
        columnOrder: deriveColumnOrder(incidents),
      };
    });

    const res = await api.updateIncident(incidentId, userId, {
      status: targetStatus,
    });
    if (!res.ok || !res.data) {
      set((s) => {
        const incidents = { ...s.incidents, [incidentId]: prev };
        return {
          incidents,
          columnOrder: deriveColumnOrder(incidents),
          error: sanitizeBrand(
            res.error?.message ?? "Failed to move incident",
          ),
        };
      });
    } else {
      const updated = res.data;
      set((s) => {
        const incidents = { ...s.incidents, [incidentId]: updated };
        return {
          incidents,
          columnOrder: deriveColumnOrder(incidents),
        };
      });
    }
  },

  assignIncident: async (incidentId, userId, assigneeId) => {
    const prev = get().incidents[incidentId];
    if (!prev) return;
    set((s) => ({
      incidents: {
        ...s.incidents,
        [incidentId]: { ...prev, assigned_to: assigneeId },
      },
    }));
    const res = await api.assignIncident(incidentId, userId, assigneeId);
    if (!res.ok || !res.data) {
      set((s) => ({
        incidents: { ...s.incidents, [incidentId]: prev },
        error: sanitizeBrand(
          res.error?.message ?? "Failed to assign incident",
        ),
      }));
    } else {
      set((s) => ({
        incidents: { ...s.incidents, [incidentId]: res.data! },
      }));
    }
  },

  patchIncident: async (incidentId, userId, patch) => {
    const prev = get().incidents[incidentId];
    if (!prev) return;
    const res = await api.updateIncident(incidentId, userId, patch);
    if (res.ok && res.data) {
      set((s) => {
        const incidents = { ...s.incidents, [incidentId]: res.data! };
        return {
          incidents,
          columnOrder: deriveColumnOrder(incidents),
        };
      });
    } else if (!res.ok) {
      set({
        error: sanitizeBrand(
          res.error?.message ?? "Failed to update incident",
        ),
      });
    }
  },

  addNote: async (incidentId, userId, content) => {
    const trimmed = content.trim();
    if (!trimmed) return null;
    const res = await api.addIncidentNote(incidentId, userId, trimmed);
    if (res.ok && res.data) {
      set((s) => ({
        notes: {
          ...s.notes,
          [incidentId]: [...(s.notes[incidentId] ?? []), res.data!],
        },
      }));
      return res.data;
    }
    set({
      error: sanitizeBrand(res.error?.message ?? "Failed to add note"),
    });
    return null;
  },

  requestClose: (incidentId) => {
    if (!get().incidents[incidentId]) return;
    set({ pendingCloseIncidentId: incidentId });
  },

  cancelClose: () => {
    set({ pendingCloseIncidentId: null, closingInFlight: false });
  },

  confirmClose: async (userId, resolution) => {
    const incidentId = get().pendingCloseIncidentId;
    if (!incidentId) return null;
    const trimmed = resolution.trim();
    if (!trimmed) return null;

    const prev = get().incidents[incidentId];
    if (!prev) {
      set({ pendingCloseIncidentId: null });
      return null;
    }

    set({ closingInFlight: true });
    // Optimistic: card slides into the closed column immediately, with
    // the resolution text already showing as ``summary``.
    set((s) => {
      const optimistic: IncidentEvent = {
        ...prev,
        status: "closed",
        summary: trimmed,
        closed_at: new Date().toISOString(),
      };
      const incidents = { ...s.incidents, [incidentId]: optimistic };
      return {
        incidents,
        columnOrder: deriveColumnOrder(incidents),
      };
    });

    const res = await api.closeIncident(incidentId, userId, trimmed);
    if (!res.ok || !res.data) {
      // Revert: card returns to its original column and status.
      set((s) => {
        const incidents = { ...s.incidents, [incidentId]: prev };
        return {
          incidents,
          columnOrder: deriveColumnOrder(incidents),
          closingInFlight: false,
          error: sanitizeBrand(
            res.error?.message ?? "Failed to close incident",
          ),
        };
      });
      return null;
    }

    const updated = res.data;
    set((s) => {
      const incidents = { ...s.incidents, [incidentId]: updated };
      return {
        incidents,
        columnOrder: deriveColumnOrder(incidents),
        closingInFlight: false,
        pendingCloseIncidentId: null,
      };
    });
    return updated;
  },

  refreshSummary: async (incidentId, userId) => {
    const locale = useLanguageStore.getState().locale;
    const res = await api.regenerateIncidentSummary(
      incidentId,
      userId,
      locale,
    );
    if (res.ok && res.data) {
      set((s) => ({
        summaryDrafts: { ...s.summaryDrafts, [incidentId]: res.data! },
      }));
      return res.data;
    }
    set({
      error: sanitizeBrand(
        res.error?.message ?? "Failed to refresh summary",
      ),
    });
    return null;
  },

  startInvestigation: async (incidentId, userId) => {
    const cached = get().investigationConversations[incidentId];
    if (cached) {
      return {
        incident_id: incidentId,
        conversation_id: cached,
        created: false,
      };
    }
    const locale = useLanguageStore.getState().locale;
    const res = await api.investigateIncident(incidentId, userId, locale);
    if (res.ok && res.data) {
      set((s) => ({
        investigationConversations: {
          ...s.investigationConversations,
          [incidentId]: res.data!.conversation_id,
        },
      }));
      return res.data;
    }
    set({
      error: sanitizeBrand(
        res.error?.message ?? "Failed to open investigation",
      ),
    });
    return null;
  },

  openWorkspace: (incidentId) => set({ activeIncidentId: incidentId }),
  closeWorkspace: () => set({ activeIncidentId: null }),
  setDragging: (incidentId) => set({ draggingId: incidentId }),
  setFilters: (patch) => set((s) => ({ filters: { ...s.filters, ...patch } })),
  clearError: () => set({ error: null }),

  _receiveCreated: (incident) => {
    set((s) => {
      const incidents = { ...s.incidents, [incident.id]: incident };
      return {
        incidents,
        columnOrder: deriveColumnOrder(incidents),
      };
    });
  },

  _receiveUpdate: (incidentId, patch) => {
    set((s) => {
      const prev = s.incidents[incidentId];
      if (!prev) return s;

      // Pull off non-IncidentEvent keys that the backend sends along
      // (note_added, evidence_added, merged_alert_event_id, evidence).
      const {
        note_added,
        evidence_added,
        merged_alert_event_id: _ignored,
        evidence: mergedEvidence,
        ...incidentPatch
      } = patch as Record<string, unknown> as typeof patch & {
        note_added?: IncidentNote;
        evidence_added?: IncidentEvidence;
        merged_alert_event_id?: string;
        evidence?: IncidentEvidence;
      };

      const merged: IncidentEvent = {
        ...prev,
        ...(incidentPatch as Partial<IncidentEvent>),
      };

      const nextState: Partial<IncidentState> = {
        incidents: { ...s.incidents, [incidentId]: merged },
        columnOrder: deriveColumnOrder({
          ...s.incidents,
          [incidentId]: merged,
        }),
      };

      if (note_added) {
        nextState.notes = {
          ...s.notes,
          [incidentId]: [...(s.notes[incidentId] ?? []), note_added],
        };
      }

      const newEvidence = evidence_added || mergedEvidence;
      if (newEvidence) {
        nextState.evidence = {
          ...s.evidence,
          [incidentId]: [...(s.evidence[incidentId] ?? []), newEvidence],
        };
      }

      if (merged.conversation_id) {
        nextState.investigationConversations = {
          ...s.investigationConversations,
          [incidentId]: merged.conversation_id,
        };
      }

      return nextState as IncidentState;
    });
  },
}));
