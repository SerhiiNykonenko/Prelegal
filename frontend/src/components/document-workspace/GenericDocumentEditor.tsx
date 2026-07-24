"use client";

import type { GenericDocumentDraft, GenericDocumentParty } from "@/lib/api";
import type { GenericDocumentFieldErrors } from "@/lib/documentRegistry";

type GenericDocumentEditorProps = {
  values: GenericDocumentDraft;
  errors: GenericDocumentFieldErrors;
  onChange: (values: GenericDocumentDraft) => void;
  actionSlot?: React.ReactNode;
};

function Field({
  label,
  name,
  value,
  error,
  type = "text",
  rows,
  onChange,
}: {
  label: string;
  name: string;
  value: string;
  error?: string;
  type?: string;
  rows?: number;
  onChange: (value: string) => void;
}) {
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

function updateParty(parties: GenericDocumentParty[], index: number, patch: Partial<GenericDocumentParty>): GenericDocumentParty[] {
  return parties.map((party, partyIndex) => (partyIndex === index ? { ...party, ...patch } : party));
}

export function GenericDocumentEditor({ values, errors, onChange, actionSlot }: GenericDocumentEditorProps) {
  function setField<K extends keyof GenericDocumentDraft>(field: K, value: GenericDocumentDraft[K]) {
    onChange({ ...values, [field]: value });
  }

  function setPartyField(partyIndex: number, field: keyof GenericDocumentParty, value: string) {
    onChange({ ...values, parties: updateParty(values.parties, partyIndex, { [field]: value }) });
  }

  return (
    <section className="card editor-card">
      <div className="editor-grid">
        <Field
          label="Document title"
          name="documentTitle"
          value={values.documentTitle}
          error={errors.documentTitle}
          onChange={(value) => setField("documentTitle", value)}
        />
        <Field
          label="Effective date"
          name="effectiveDate"
          type="date"
          value={values.effectiveDate}
          error={errors.effectiveDate}
          onChange={(value) => setField("effectiveDate", value)}
        />
        <Field
          label="Business purpose"
          name="businessPurpose"
          value={values.businessPurpose}
          error={errors.businessPurpose}
          rows={3}
          onChange={(value) => setField("businessPurpose", value)}
        />
        <Field
          label="Governing law"
          name="governingLaw"
          value={values.governingLaw}
          error={errors.governingLaw}
          onChange={(value) => setField("governingLaw", value)}
        />
        <Field
          label="Key terms"
          name="keyTerms"
          value={values.keyTerms}
          error={errors.keyTerms}
          rows={4}
          onChange={(value) => setField("keyTerms", value)}
        />
        <Field
          label="Special terms"
          name="specialTerms"
          value={values.specialTerms}
          error={errors.specialTerms}
          rows={3}
          onChange={(value) => setField("specialTerms", value)}
        />
      </div>

      <h3 className="section-title">Parties</h3>
      {errors.parties ? <p className="error-text">{errors.parties}</p> : null}
      {values.parties.map((party, index) => (
        <div key={`${party.role}-${index}`} className="card party-card">
          <h4>{party.role || `Party ${index + 1}`}</h4>
          <div className="editor-grid">
            <Field
              label="Name"
              name={`parties.${index}.name`}
              value={party.name}
              error={errors[`parties.${index}.name`]}
              onChange={(value) => setPartyField(index, "name", value)}
            />
            <Field
              label="Title"
              name={`parties.${index}.title`}
              value={party.title}
              error={errors[`parties.${index}.title`]}
              onChange={(value) => setPartyField(index, "title", value)}
            />
            <Field
              label="Company"
              name={`parties.${index}.company`}
              value={party.company}
              error={errors[`parties.${index}.company`]}
              onChange={(value) => setPartyField(index, "company", value)}
            />
            <Field
              label="Email"
              name={`parties.${index}.email`}
              type="email"
              value={party.email}
              error={errors[`parties.${index}.email`]}
              onChange={(value) => setPartyField(index, "email", value)}
            />
            <Field
              label="Address"
              name={`parties.${index}.address`}
              value={party.address}
              error={errors[`parties.${index}.address`]}
              rows={2}
              onChange={(value) => setPartyField(index, "address", value)}
            />
          </div>
        </div>
      ))}

      {actionSlot ? <div className="actions">{actionSlot}</div> : null}
    </section>
  );
}
