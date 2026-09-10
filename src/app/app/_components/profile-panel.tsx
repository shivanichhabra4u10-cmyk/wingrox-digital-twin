import { DOC_CATEGORIES, PRIVACY_LEVELS } from "@/lib/auth/types";
import { PRIVACY_LABELS, REQUIRED_CONSENTS } from "@/lib/workflow/constants";
import {
  saveProfileAction,
  setConsentAction,
  updateDocumentPrivacyAction,
  uploadDocumentAction,
} from "../actions";
import type { AppDashboardData } from "../_lib/dashboard-data";
import { profileCompleteness } from "./dashboard-metrics";
import { Icon } from "./icons";
import styles from "../page.module.css";

function prettyKey(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function bytes(value: number | null) {
  if (!value) return "Unknown size";
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

export function ProfilePanel({ data }: { data: AppDashboardData }) {
  const participant = data.selectedParticipant;
  const completeness = profileCompleteness(participant);

  if (!participant) {
    return <section className={styles.card}>No participant workspace is assigned to this account yet.</section>;
  }

  const consentByKey = new Map(data.consents.map((consent) => [consent.consent_key, consent]));
  const canEdit = data.profile.role === "participant";

  return (
    <section id="profile" className={styles.cardGrid}>
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div>
            <span className={styles.eyebrow}>Step 1</span>
            <h2>Profile dossier</h2>
          </div>
          <strong>{completeness.percent}% complete</strong>
        </div>

        <form action={saveProfileAction} className={styles.formGrid}>
          <label>Full name<input name="fullName" defaultValue={participant.full_name} required minLength={2} disabled={!canEdit} /></label>
          <label>Email<input name="email" type="email" defaultValue={participant.email ?? ""} required disabled={!canEdit} /></label>
          <label>Country code<input name="countryCode" defaultValue={participant.country_code ?? "+91"} required disabled={!canEdit} /></label>
          <label>Mobile<input name="mobile" defaultValue={participant.mobile ?? ""} required disabled={!canEdit} /></label>
          <label>City<input name="city" defaultValue={participant.city ?? ""} required disabled={!canEdit} /></label>
          <label>Country<input name="country" defaultValue={participant.country ?? ""} required disabled={!canEdit} /></label>
          <label>LinkedIn URL<input name="linkedinUrl" type="url" defaultValue={participant.linkedin_url ?? ""} disabled={!canEdit} /></label>
          <label>Current role<input name="currentRole" defaultValue={participant.current_title ?? ""} required disabled={!canEdit} /></label>
          <label>Organisation<input name="organization" defaultValue={participant.organization ?? ""} required disabled={!canEdit} /></label>
          <label>Language<input name="preferredLanguage" defaultValue={participant.preferred_language ?? "English"} required disabled={!canEdit} /></label>
          <label>Timezone<input name="timezone" defaultValue={participant.timezone ?? "IST (UTC+5:30)"} required disabled={!canEdit} /></label>
          <label className={styles.fullSpan}>About<textarea name="about" defaultValue={participant.about ?? ""} required minLength={20} disabled={!canEdit} /></label>
          <label className={styles.fullSpan}>What do you want help with?<textarea name="helpWith" defaultValue={participant.help_with ?? ""} required minLength={20} disabled={!canEdit} /></label>
          {canEdit ? <button type="submit" className={styles.primaryButton}>Save profile <Icon name="arrow" /></button> : null}
        </form>
      </div>

      <div className={styles.stack}>
        <div className={styles.card}>
          <span className={styles.eyebrow}>Consent</span>
          <h2>Privacy controls</h2>
          <div className={styles.checkList}>
            {REQUIRED_CONSENTS.map((item) => {
              const accepted = consentByKey.get(item.key)?.accepted ?? false;
              return (
                <form key={item.key} action={setConsentAction}>
                  <input type="hidden" name="key" value={item.key} />
                  <input type="hidden" name="accepted" value={accepted ? "false" : "true"} />
                  <button type="submit" className={accepted ? styles.checkedRow : styles.checkRow} disabled={!canEdit}>
                    <Icon name={accepted ? "check" : "shield"} />
                    <span>{item.label}</span>
                  </button>
                </form>
              );
            })}
          </div>
        </div>

        <div className={styles.card}>
          <span className={styles.eyebrow}>Documents</span>
          <h2>Evidence vault</h2>
          {canEdit ? (
            <form action={uploadDocumentAction} className={styles.uploadForm}>
              <input name="file" type="file" required />
              <select name="category" defaultValue="resume">{DOC_CATEGORIES.map((category) => <option key={category} value={category}>{prettyKey(category)}</option>)}</select>
              <select name="privacy" defaultValue="architect">{PRIVACY_LEVELS.map((level) => <option key={level} value={level}>{PRIVACY_LABELS[level]}</option>)}</select>
              <button type="submit" className={styles.secondaryButton}>Upload</button>
            </form>
          ) : null}
          <div className={styles.documentList}>
            {data.documents.map((document) => (
              <article key={document.id}>
                <Icon name="doc" />
                <div>
                  <strong>{document.file_name}</strong>
                  <small>{prettyKey(document.category)} · {bytes(document.file_size_bytes)} · {document.scan_status}</small>
                </div>
                {canEdit ? (
                  <form action={updateDocumentPrivacyAction}>
                    <input type="hidden" name="id" value={document.id} />
                    <select name="privacy" defaultValue={document.privacy} aria-label={`Privacy for ${document.file_name}`}>{PRIVACY_LEVELS.map((level) => <option key={level} value={level}>{PRIVACY_LABELS[level]}</option>)}</select>
                    <button type="submit" className={styles.textButton}>Update</button>
                  </form>
                ) : <span>{PRIVACY_LABELS[document.privacy as keyof typeof PRIVACY_LABELS] ?? document.privacy}</span>}
              </article>
            ))}
            {data.documents.length === 0 ? <p className={styles.emptyState}>No documents uploaded yet.</p> : null}
          </div>
        </div>
      </div>
    </section>
  );
}
