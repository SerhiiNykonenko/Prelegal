import { buildMutualNdaPreview, MutualNdaEditor } from "@/components/MutualNdaForm";
import type { MutualNdaFieldErrors, MutualNdaFormData } from "@/lib/mutualNdaSchema";

type MutualNdaReviewPanelProps = {
  values: MutualNdaFormData;
  errors: MutualNdaFieldErrors;
  status: "idle" | "generating" | "error" | "success";
  message: string | null;
  onChange: (values: MutualNdaFormData) => void;
  onDownload: () => Promise<void>;
  onBackToDraft: () => void;
};

export function MutualNdaReviewPanel({
  values,
  errors,
  status,
  message,
  onChange,
  onDownload,
  onBackToDraft,
}: MutualNdaReviewPanelProps) {
  const preview = buildMutualNdaPreview(values);

  return (
    <section className="review-workspace">
      <section className="card review-summary">
        <div>
          <p className="eyebrow">Review</p>
          <h2>Review and edit before download</h2>
          <p>Confirm the structured fields below. The PDF uses exactly these values.</p>
        </div>
        <dl className="preview-list">
          <div>
            <dt>Purpose</dt>
            <dd>{values.purpose}</dd>
          </div>
          <div>
            <dt>Effective date</dt>
            <dd>{values.effectiveDate}</dd>
          </div>
          <div>
            <dt>MNDA term</dt>
            <dd>{preview.mndaTerm}</dd>
          </div>
          <div>
            <dt>Confidentiality</dt>
            <dd>{preview.confidentialityTerm}</dd>
          </div>
          <div>
            <dt>Parties</dt>
            <dd>{values.partyOne.company || "Party 1"} and {values.partyTwo.company || "Party 2"}</dd>
          </div>
        </dl>
        <div className="actions">
          <button className="secondary-button" type="button" onClick={onBackToDraft}>Back to draft</button>
          <button className="primary-button" type="button" disabled={status === "generating"} onClick={onDownload}>
            {status === "generating" ? "Generating PDF..." : "Download Mutual NDA PDF"}
          </button>
          {message ? <span className={status === "error" ? "error-text" : undefined}>{message}</span> : null}
        </div>
      </section>

      <MutualNdaEditor values={values} errors={errors} onChange={onChange} />
    </section>
  );
}
