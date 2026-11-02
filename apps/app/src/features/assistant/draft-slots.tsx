import type {
  AssistantDraft,
  AssistantDraftKind,
  AssistantField,
  AssistantInputSource,
  AssistantSpan,
} from "@pisto/contracts";
import { createContext, type ReactNode, useContext } from "react";

export type DraftFormProps<K extends AssistantDraftKind> = {
  draft: Extract<AssistantDraft, { kind: K }>;
  /** How the sentence was entered; the record's command stores it as its entry source. */
  entrySource: AssistantInputSource;
  /** Called after the record's own command committed. */
  onSaved: () => void;
  onCancel: () => void;
};

/**
 * One form per record kind, each seeded from its draft and saving through the record's own
 * reviewed command. The application composes this map; the assistant never saves a record.
 */
export type DraftFormSlots = {
  [K in AssistantDraftKind]: (props: DraftFormProps<K>) => ReactNode;
};

export function renderDraftForm(
  slots: DraftFormSlots,
  draft: AssistantDraft,
  props: Omit<DraftFormProps<AssistantDraftKind>, "draft">,
): ReactNode {
  switch (draft.kind) {
    case "sale":
      return slots.sale({ ...props, draft });
    case "expense":
      return slots.expense({ ...props, draft });
    case "purchase":
      return slots.purchase({ ...props, draft });
    case "receivable_payment":
      return slots.receivable_payment({ ...props, draft });
    case "supplier_payment":
      return slots.supplier_payment({ ...props, draft });
  }
}

const MarkersContext = createContext<readonly AssistantSpan[]>([]);

/** Gives forms the number each transcript fragment carries, so a field can show the same one. */
export function ReviewMarkersProvider({
  children,
  spans,
}: {
  children: ReactNode;
  spans: readonly AssistantSpan[];
}) {
  return <MarkersContext.Provider value={spans}>{children}</MarkersContext.Provider>;
}

export function useFieldMarker(field: AssistantField): number | null {
  const spans = useContext(MarkersContext);
  return spans.find((span) => span.field === field)?.marker ?? null;
}
