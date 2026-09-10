import { createHash } from "node:crypto";
import { DomainError } from "./errors.ts";

export const SUBMISSION_FORMATS = ["structured_design", "class_diagram"] as const;
export type SubmissionFormat = (typeof SUBMISSION_FORMATS)[number];

export type StructuredDesignFields = {
  assumptions: string;
  classDesign: string;
  relationships: string;
  tradeoffs: string;
  codeSketch: string;
  diagramSource: string;
};

/**
 * Value object for whatever the learner handed in.
 * Today's only first-class format is structured_design.
 * class_diagram is reserved so Attempt/Evaluation do not have to change
 * when we later accept a mermaid/UML-only payload (change test A).
 */
export class SubmissionContent {
  readonly format: SubmissionFormat;
  readonly fields: StructuredDesignFields;

  constructor(format: SubmissionFormat, fields: StructuredDesignFields) {
    this.format = format;
    this.fields = {
      assumptions: fields.assumptions.trim(),
      classDesign: fields.classDesign.trim(),
      relationships: fields.relationships.trim(),
      tradeoffs: fields.tradeoffs.trim(),
      codeSketch: fields.codeSketch.trim(),
      diagramSource: fields.diagramSource.trim(),
    };
    this.assertMinimumEvidence();
  }

  private assertMinimumEvidence() {
    if (this.format === "class_diagram") {
      if (this.fields.diagramSource.length < 20) {
        throw new DomainError(
          "A class diagram submission needs the actual diagram source.",
          "THIN_SUBMISSION",
        );
      }
      return;
    }

    const missing: string[] = [];
    if (this.fields.assumptions.length < 40) missing.push("assumptions");
    if (this.fields.classDesign.length < 80) missing.push("classes & responsibilities");
    if (this.fields.relationships.length < 40) missing.push("relationships");
    if (this.fields.tradeoffs.length < 40) missing.push("trade-offs");
    if (missing.length) {
      throw new DomainError(
        `Too thin to evaluate. Expand: ${missing.join(", ")}.`,
        "THIN_SUBMISSION",
      );
    }
  }

  combinedText(): string {
    return [
      this.fields.assumptions,
      this.fields.classDesign,
      this.fields.relationships,
      this.fields.tradeoffs,
      this.fields.codeSketch,
      this.fields.diagramSource,
    ].join("\n");
  }

  contentHash(): string {
    return createHash("sha256").update(this.format + "\n" + this.combinedText()).digest("hex");
  }
}
