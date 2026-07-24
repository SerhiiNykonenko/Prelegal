import { GenericDocumentEditor } from "@/components/document-workspace/GenericDocumentEditor";
import type { GenericDocumentDraft } from "@/lib/api";
import type { GenericDocumentFieldErrors } from "@/lib/documentRegistry";

type GenericDocumentReviewPanelProps = {
  values: GenericDocumentDraft;
  errors: GenericDocumentFieldErrors;
  status: "idle" | "generating" | "error" | "success";
  message: string | null;
  onChange: (values: GenericDocumentDraft) => void;
  onDownload: () => Promise<void>;
  onBackToDraft: () => void;
};

export function GenericDocumentReviewPanel({
  values,
  errors,
  status,
  message,
  onChange,
  onDownload,
  onBackToDraft,
}: GenericDocumentReviewPanelProps) {
  return (
    <section className="review-workspace">
      <section className="card review-summary">
        <div>
          <p className="eyebrow">Review</p>
          <h2>Review and edit before download</h2>
          <p>Confirm the structured fields below. The PDF uses these details plus the selected template.</p>
        </div>
        <dl className="preview-list">
          <div>
            <dt>Document</dt>
            <dd>{values.documentTitle}</dd>
          </div>
          <div>
            <dt>Effective date</dt>
            <dd>{values.effectiveDate}</dd>
          </div>
          <div>
            <dt>Business purpose</dt>
            <dd>{values.businessPurpose}</dd>
          </div>
          <div>
            <dt>Governing law</dt>
            <dd>{values.governingLaw}</dd>
          </div>
          <div>
            <dt>Parties</dt>
            <dd>{values.parties.map((party) => party.company || party.name || party.role).join(" and ")}</dd>
          </div>
        </dl>
        <div className="actions">
          <button className="secondary-button" type="button" onClick={onBackToDraft}>Back to draft</button>
          <button className="primary-button" type="button" disabled={status === "generating"} onClick={onDownload}>
            {status === "generating" ? "Generating PDF..." : `Download ${values.documentTitle} PDF`}
          </button>
          {message ? <span className={status === "error" ? "error-text" : undefined}>{message}</span> : null}
        </div>
      </section>

      <GenericDocumentEditor values={values} errors={errors} onChange={onChange} />
    </section>
  );
}
