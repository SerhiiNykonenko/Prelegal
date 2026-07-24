"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createDefaultMutualNdaValues,
  flattenZodErrors,
  mutualNdaSchema,
  type MutualNdaFieldErrors,
  type MutualNdaFormData,
} from "@/lib/mutualNdaSchema";

type PartyKey = "partyOne" | "partyTwo";
type PartyField = Extract<keyof MutualNdaFormData[PartyKey], string>;

type InputProps = {
  label: string;
  name: string;
  value: string | number;
  error?: string;
  type?: string;
  rows?: number;
  onChange: (value: string) => void;
};

type MutualNdaEditorProps = {
  values: MutualNdaFormData;
  errors: MutualNdaFieldErrors;
  onChange: (values: MutualNdaFormData) => void;
  actionSlot?: React.ReactNode;
};

export function buildMutualNdaPreview(values: MutualNdaFormData) {
  const mndaTerm =
    values.mndaTermType === "fixed"
      ? `Expires ${values.mndaTermYears} year${values.mndaTermYears === 1 ? "" : "s"} from the effective date.`
      : "Continues until terminated under the MNDA.";
  const confidentialityTerm =
    values.confidentialityTermType === "fixed"
      ? `${values.confidentialityTermYears} year${values.confidentialityTermYears === 1 ? "" : "s"} from the effective date, with trade secret protection while applicable.`
      : "In perpetuity.";

  return { mndaTerm, confidentialityTerm };
}

function TextField({ label, name, value, error, type = "text", rows, onChange }: InputProps) {
  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      {rows ? (
        <textarea id={name} name={name} rows={rows} value={value} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <input id={name} name={name} type={type} value={value} onChange={(event) => onChange(event.target.value)} />
      )}
      {error ? <span className="error-text">{error}</span> : null}
    </div>
  );
}

function PartyFields({
  title,
  partyKey,
  values,
  errors,
  onChange,
}: {
  title: string;
  partyKey: PartyKey;
  values: MutualNdaFormData[PartyKey];
  errors: MutualNdaFieldErrors;
  onChange: (field: PartyField, value: string) => void;
}) {
  const fieldError = (field: PartyField) => errors[`${partyKey}.${field}`];

  return (
    <fieldset className="form-section">
      <legend className="section-title">{title}</legend>
      <div className="form-row">
        <TextField label="Print name" name={`${partyKey}-printName`} value={values.printName} error={fieldError("printName")} onChange={(value) => onChange("printName", value)} />
        <TextField label="Title" name={`${partyKey}-title`} value={values.title} error={fieldError("title")} onChange={(value) => onChange("title", value)} />
      </div>
      <TextField label="Company" name={`${partyKey}-company`} value={values.company} error={fieldError("company")} onChange={(value) => onChange("company", value)} />
      <TextField label="Notice address" name={`${partyKey}-noticeAddress`} value={values.noticeAddress} error={fieldError("noticeAddress")} rows={2} onChange={(value) => onChange("noticeAddress", value)} />
      <TextField label="Signature date" name={`${partyKey}-signatureDate`} type="date" value={values.signatureDate} error={fieldError("signatureDate")} onChange={(value) => onChange("signatureDate", value)} />
    </fieldset>
  );
}

export function MutualNdaEditor({ values, errors, onChange, actionSlot }: MutualNdaEditorProps) {
  const preview = useMemo(() => buildMutualNdaPreview(values), [values]);

  function setField<Field extends keyof MutualNdaFormData>(field: Field, value: MutualNdaFormData[Field]) {
    onChange({ ...values, [field]: value });
  }

  function setPartyField(partyKey: PartyKey, field: PartyField, value: string) {
    onChange({
      ...values,
      [partyKey]: {
        ...values[partyKey],
        [field]: value,
      },
    });
  }

  return (
    <form className="card form-card" onSubmit={(event) => event.preventDefault()}>
      <section className="form-section">
        <h2 className="section-title">Agreement details</h2>
        <TextField label="Purpose" name="purpose" value={values.purpose} error={errors.purpose} rows={3} onChange={(value) => setField("purpose", value)} />
        <div className="form-row">
          <TextField label="Effective date" name="effectiveDate" type="date" value={values.effectiveDate} error={errors.effectiveDate} onChange={(value) => setField("effectiveDate", value)} />
          <TextField label="Governing law" name="governingLaw" value={values.governingLaw} error={errors.governingLaw} onChange={(value) => setField("governingLaw", value)} />
        </div>
        <TextField label="Jurisdiction" name="jurisdiction" value={values.jurisdiction} error={errors.jurisdiction} onChange={(value) => setField("jurisdiction", value)} />
        <TextField label="MNDA modifications" name="modifications" value={values.modifications} error={errors.modifications} rows={3} onChange={(value) => setField("modifications", value)} />
      </section>

      <section className="form-section">
        <h2 className="section-title">Terms</h2>
        <div className="radio-group">
          <span className="legend">MNDA term</span>
          <label className="radio-option">
            <input type="radio" checked={values.mndaTermType === "fixed"} onChange={() => setField("mndaTermType", "fixed")} />
            Expires after
            <input aria-label="MNDA term years" type="number" min="1" max="25" value={values.mndaTermYears} onChange={(event) => setField("mndaTermYears", Number(event.target.value))} />
            year(s)
          </label>
          <label className="radio-option">
            <input type="radio" checked={values.mndaTermType === "until-terminated"} onChange={() => setField("mndaTermType", "until-terminated")} />
            Continues until terminated
          </label>
          {errors.mndaTermYears ? <span className="error-text">{errors.mndaTermYears}</span> : null}
        </div>

        <div className="radio-group">
          <span className="legend">Term of confidentiality</span>
          <label className="radio-option">
            <input type="radio" checked={values.confidentialityTermType === "fixed"} onChange={() => setField("confidentialityTermType", "fixed")} />
            Protects information for
            <input aria-label="Confidentiality term years" type="number" min="1" max="25" value={values.confidentialityTermYears} onChange={(event) => setField("confidentialityTermYears", Number(event.target.value))} />
            year(s)
          </label>
          <label className="radio-option">
            <input type="radio" checked={values.confidentialityTermType === "perpetual"} onChange={() => setField("confidentialityTermType", "perpetual")} />
            In perpetuity
          </label>
          {errors.confidentialityTermYears ? <span className="error-text">{errors.confidentialityTermYears}</span> : null}
        </div>
      </section>

      <PartyFields title="Party 1" partyKey="partyOne" values={values.partyOne} errors={errors} onChange={(field, value) => setPartyField("partyOne", field, value)} />
      <PartyFields title="Party 2" partyKey="partyTwo" values={values.partyTwo} errors={errors} onChange={(field, value) => setPartyField("partyTwo", field, value)} />
      {actionSlot}
    </form>
  );
}

export function MutualNdaForm({ initialDate }: { initialDate: string }) {
  const [values, setValues] = useState<MutualNdaFormData>(() => createDefaultMutualNdaValues(initialDate));
  const [errors, setErrors] = useState<MutualNdaFieldErrors>({});
  const [status, setStatus] = useState<"idle" | "generating" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (initialDate) {
      return;
    }

    const today = new Date().toISOString().slice(0, 10);

    setValues((current) => {
      if (current.effectiveDate || current.partyOne.signatureDate || current.partyTwo.signatureDate) {
        return current;
      }

      return {
        ...current,
        effectiveDate: today,
        partyOne: {
          ...current.partyOne,
          signatureDate: today,
        },
        partyTwo: {
          ...current.partyTwo,
          signatureDate: today,
        },
      };
    });
  }, [initialDate]);

  async function downloadPdf() {
    setMessage(null);
    const result = mutualNdaSchema.safeParse(values);

    if (!result.success) {
      setErrors(flattenZodErrors(result.error));
      return;
    }

    setErrors({});
    setStatus("generating");

    try {
      const response = await fetch("/api/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result.data),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        if (payload?.fieldErrors) {
          setErrors(payload.fieldErrors);
        }
        throw new Error(payload?.error ?? "Unable to generate PDF");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "mutual-nda.pdf";
      link.click();
      URL.revokeObjectURL(url);
      setStatus("idle");
      setMessage("PDF generated successfully.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unable to generate PDF");
    }
  }

  return (
    <MutualNdaEditor
      values={values}
      errors={errors}
      onChange={setValues}
      actionSlot={(
        <div className="actions">
          <button className="primary-button" type="button" disabled={status === "generating"} onClick={downloadPdf}>
            {status === "generating" ? "Generating PDF..." : "Download Mutual NDA PDF"}
          </button>
          {message ? <span className={status === "error" ? "error-text" : undefined}>{message}</span> : null}
        </div>
      )}
    />
  );
}
