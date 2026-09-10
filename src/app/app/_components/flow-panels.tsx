import {
  saveCoachSelectionAction,
  saveDiagnosticAnswerAction,
  saveJourneyWeekAction,
  saveMirrorAction,
  saveValidationInsightAction,
  submitDiagnosticAction,
} from "../actions";
import type { AppDashboardData } from "../_lib/dashboard-data";
import { COACH_OPTIONS, DIAGNOSTIC_OPTIONS, VALIDATION_INSIGHTS, diagnosticQuestionTitle } from "./workflow-content";
import styles from "../page.module.css";

function payload(data: AppDashboardData, stage: string) {
  return data.stagePayloads.find((item) => item.stage === stage)?.payload ?? {};
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function textValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

export function ValidationPanel({ data }: { data: AppDashboardData }) {
  const participant = data.selectedParticipant;
  if (!participant) return null;
  const validate = payload(data, "validate");
  const insights = asRecord(validate.insights);

  return (
    <section id="validate" className={styles.card}>
      <span className={styles.eyebrow}>Step 3</span>
      <h2>Validation questions</h2>
      <div className={styles.validationGrid}>
        {VALIDATION_INSIGHTS.map((label, index) => {
          const insightId = `I${String(index + 1).padStart(2, "0")}`;
          const existing = asRecord(insights[insightId]);
          return (
            <form key={insightId} action={saveValidationInsightAction} className={styles.miniCard}>
              <input type="hidden" name="participantId" value={participant.id} />
              <input type="hidden" name="insightId" value={insightId} />
              <strong>{label}</strong>
              <select name="status" defaultValue={textValue(existing.status) || "confirm"}>
                <option value="confirm">Confirm</option><option value="partial">Partly confirm</option><option value="reject">Reject</option><option value="unsure">Unsure</option><option value="private">Keep private</option>
              </select>
              <select name="priority" defaultValue={textValue(existing.priority) || "high"}>
                <option value="critical">Critical</option><option value="high">High</option><option value="low">Low</option>
              </select>
              <textarea name="note" defaultValue={textValue(existing.note)} placeholder="Correction, evidence or privacy note" />
              <button type="submit" className={styles.secondaryButton}>Save</button>
            </form>
          );
        })}
      </div>
    </section>
  );
}

export function DiagnosticPanel({ data }: { data: AppDashboardData }) {
  const participant = data.selectedParticipant;
  if (!participant) return null;
  const diagnostic = payload(data, "diagnostic");
  const answeredCount = typeof diagnostic.answeredCount === "number" ? diagnostic.answeredCount : 0;

  return (
    <section id="diagnostic" className={styles.card}>
      <div className={styles.cardHeader}><div><span className={styles.eyebrow}>Step 4</span><h2>Growth Diagnostic</h2></div><strong>{answeredCount}/50</strong></div>
      <div className={styles.diagnosticGrid}>
        {Array.from({ length: 50 }, (_, index) => index + 1).map((questionNumber) => (
          <form key={questionNumber} action={saveDiagnosticAnswerAction} className={styles.miniCard}>
            <input type="hidden" name="participantId" value={participant.id} />
            <input type="hidden" name="questionId" value={questionNumber} />
            <strong>{diagnosticQuestionTitle(questionNumber)}</strong>
            <select name="choices" defaultValue="1">
              {DIAGNOSTIC_OPTIONS.map((option, optionIndex) => <option key={option} value={String(optionIndex + 1)}>{option}</option>)}
            </select>
            <select name="confidence" defaultValue="clear"><option value="clear">Clear</option><option value="exploring">Exploring</option><option value="unsure">Unsure</option><option value="sensitive">Sensitive</option></select>
            <textarea name="comment" placeholder="Optional context" />
            <button type="submit" className={styles.secondaryButton}>Save answer</button>
          </form>
        ))}
      </div>
      <form action={submitDiagnosticAction} className={styles.inlineAction}>
        <input type="hidden" name="participantId" value={participant.id} />
        <button type="submit" className={styles.primaryButton}>Submit diagnostic</button>
      </form>
    </section>
  );
}

export function MirrorCoachJourneyPanels({ data }: { data: AppDashboardData }) {
  const participant = data.selectedParticipant;
  if (!participant) return null;
  const mirror = payload(data, "mirror");
  const coach = payload(data, "coach");

  return (
    <section className={styles.stageGrid}>
      <form id="mirror" action={saveMirrorAction} className={styles.stageCard}>
        <input type="hidden" name="participantId" value={participant.id} />
        <span className={styles.eyebrow}>Step 5</span><h2>Growth Mirror</h2>
        <label>Identity statement<textarea name="identity" defaultValue={textValue(mirror.identity)} required minLength={10} /></label>
        <label>90-day priority<textarea name="priority" defaultValue={textValue(mirror.priority)} required minLength={5} /></label>
        <label><input type="checkbox" name="accepted" value="true" defaultChecked={mirror.accepted === true} /> Accepted as working document</label><input type="hidden" name="accepted" value="false" />
        <label><input type="checkbox" name="privacyConfirmed" value="true" defaultChecked={mirror.privacyConfirmed === true} /> Privacy confirmed</label><input type="hidden" name="privacyConfirmed" value="false" />
        <button type="submit" className={styles.primaryButton}>Save Growth Mirror</button>
      </form>

      <form id="coach" action={saveCoachSelectionAction} className={styles.stageCard}>
        <input type="hidden" name="participantId" value={participant.id} />
        <span className={styles.eyebrow}>Step 6</span><h2>Coach matching</h2>
        <select name="coachId" defaultValue={textValue(coach.coachId) || COACH_OPTIONS[0].id}>{COACH_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select>
        <p className={styles.emptyState}>{COACH_OPTIONS.map((option) => `${option.name}: ${option.fit}`).join(" ")}</p>
        <label>Coaching objective<textarea name="objective" defaultValue={textValue(coach.objective)} required minLength={10} /></label>
        <label><input type="checkbox" name="consent" value="true" defaultChecked={coach.consent === true} /> I consent to share approved information with the selected coach</label><input type="hidden" name="consent" value="false" />
        <button type="submit" className={styles.primaryButton}>Save coach choice</button>
      </form>

      <form id="journey" action={saveJourneyWeekAction} className={styles.stageCard}>
        <input type="hidden" name="participantId" value={participant.id} />
        <span className={styles.eyebrow}>Step 7</span><h2>Weekly execution</h2>
        <label>Week<select name="week">{Array.from({ length: 13 }, (_, index) => <option key={index} value={index}>Week {index}</option>)}</select></label>
        <label>Commitments<textarea name="commitments" required minLength={3} /></label>
        <label>Evidence<textarea name="evidence" /></label>
        <label>Reflection<textarea name="reflection" /></label>
        <label><input type="checkbox" name="participantConfirmed" value="true" /> Participant confirmed</label><input type="hidden" name="participantConfirmed" value="false" />
        <label><input type="checkbox" name="coachClosed" value="true" /> Coach closed</label><input type="hidden" name="coachClosed" value="false" />
        <button type="submit" className={styles.primaryButton}>Save week</button>
      </form>
    </section>
  );
}