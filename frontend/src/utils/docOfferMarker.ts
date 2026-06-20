/**
 * In-chat document offer marker.
 *
 * When Ghost answers a "what can you do / how do I use you / how does X work"
 * question that one of its official source documents covers, the backend
 * appends `[[GHOST_DOC_OFFER:id1,id2]]` to the reply. The frontend strips the
 * marker from the displayed text and renders a small download card listing the
 * matching documents.
 *
 * Doc ids are kept in sync with ``SELF_KNOWLEDGE_DOCS`` in
 * ``backend/app/services/product_knowledge.py``.
 */

export const DOC_OFFER_RE = /\[\[GHOST_DOC_OFFER:([a-z0-9_,]+)\]\]/i;

export interface OfferableDoc {
  id: string;
  /** Title per locale. */
  title: { he: string; en: string };
  /** Path served by Firebase Hosting (frontend/public/docs). */
  path: string;
}

export const OFFERABLE_DOCS: Record<string, OfferableDoc> = {
  operator_training_program: {
    id: "operator_training_program",
    title: {
      he: "תוכנית הדרכת מפעיל Ghost",
      en: "Ghost Operator Training Program",
    },
    path: "/docs/Ghost_Operator_Training_Program_HE.pdf",
  },
  operator_training_visual_appendix: {
    id: "operator_training_visual_appendix",
    title: {
      he: "נספח תרגול ויזואלי למפעיל",
      en: "Operator Training — Visual Appendix",
    },
    path: "/docs/Ghost_Operator_Training_Visual_Appendix_HE.pdf",
  },
  shared_language_partners: {
    id: "shared_language_partners",
    title: { he: "שפה משותפת — שותפים", en: "Ghost Shared Language — Partners" },
    path: "/docs/Ghost_Shared_Language_Partners.pdf",
  },
  enterprise_architecture: {
    id: "enterprise_architecture",
    title: { he: "ארכיטקטורת Ghost לארגון", en: "Ghost Enterprise Architecture" },
    path: "/docs/Ghost_Enterprise_Architecture_wecL.pdf",
  },
};

/** Returns the offered doc ids (resolved + de-duped), or null when absent. */
export function parseDocOffer(content: string): string[] | null {
  const m = DOC_OFFER_RE.exec(content);
  if (!m) return null;
  const ids = m[1]
    .split(",")
    .map((s) => s.trim())
    .filter((id) => OFFERABLE_DOCS[id]);
  return ids.length > 0 ? Array.from(new Set(ids)) : null;
}

/** Strips the doc-offer marker (and surrounding blank lines) from the text. */
export function stripDocOffer(content: string): string {
  return content.replace(DOC_OFFER_RE, "").replace(/\n{3,}$/, "\n").trimEnd();
}
