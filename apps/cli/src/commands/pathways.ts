import { PATHWAY_ABBREVIATIONS, PATHWAY_LABELS, PATHWAYS, type Pathway } from "../../../shared/labels";
import { normalizeCsvHeader } from "../../../shared/csv";
import { usageError } from "../core/errors";

/** Reads a pathway the way people write it: the enum, its label, or IT/HS/ENG. */
export function pathwayInput(value: string, column: string): Pathway {
  const normalized = normalizeCsvHeader(value);
  const found = PATHWAYS.find((candidate) =>
    [candidate, PATHWAY_LABELS[candidate], PATHWAY_ABBREVIATIONS[candidate]].some(
      (option) => normalizeCsvHeader(option) === normalized,
    ),
  );
  if (!found) {
    throw usageError(
      "invalid_pathway",
      `${column} must be one of ${PATHWAYS.map((candidate) => PATHWAY_LABELS[candidate]).join(", ")}.`,
    );
  }
  return found;
}
