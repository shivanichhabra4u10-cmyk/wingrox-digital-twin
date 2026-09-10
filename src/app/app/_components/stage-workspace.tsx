import {
  architectUpdateStageAction,
  markParticipantStageCompleteAction,
  saveArchitectStageNoteAction,
  savePersonaScheduleAction,
  saveStageNoteAction,
} from "../actions";
import type { AppDashboardData } from "../_lib/dashboard-data";
import type { StageViewModel } from "./dashboard-metrics";
import { Icon } from "./icons";
import styles from "../page.module.css";

function isManager(role: string) {
  return role === "architect" || role === "admin";
}

export function StageWorkspace({ data, stages }: { data: AppDashboardData; stages: StageViewModel[] }) {
  const participant = data.selectedParticipant;
  if (!participant) return null;

  const participantCanEdit = data.profile.role === "participant";
  const manager = isManager(data.profile.role);

  return (
    <section className={styles.stageGrid} aria-label="Journey stages">
      {stages.slice(1).map((stage) => (
        <article key={stage.key} id={stage.key} className={stage.unlocked ? styles.stageCard : `${styles.stageCard} ${styles.locked}`}>
          <div className={styles.stageHeader}>
            <span>{stage.number}</span>
            <div>
              <h2>{stage.label}</h2>
            </div>
            {stage.complete ? <Icon name="check" /> : stage.unlocked ? <strong>{stage.percent}%</strong> : <Icon name="lock" />}
          </div>

          <div className={styles.stageMeter} aria-label={`${stage.percent}% complete`}>
            <span style={{ width: `${stage.percent}%` }} />
          </div>

          <div className={styles.checkPills}>{stage.checkpoints.map((checkpoint) => <span key={checkpoint}>{checkpoint}</span>)}</div>

          {stage.architectNote ? <p className={styles.architectNote}><strong>Architect note:</strong> {stage.architectNote}</p> : null}

          {stage.key === "persona" ? (
            <form action={savePersonaScheduleAction} className={styles.inlineForm}>
              <input type="hidden" name="participantId" value={participant.id} />
              <input type="hidden" name="scheduled" value="true" />
              <input type="hidden" name="completed" value={stage.complete ? "true" : "false"} />
              <input type="hidden" name="released" value={stage.released ? "true" : "false"} />
              <label>Date<input name="date" type="date" disabled={!stage.unlocked || (!participantCanEdit && !manager)} /></label>
              <label>Time<input name="time" placeholder="10:30" disabled={!stage.unlocked || (!participantCanEdit && !manager)} /></label>
              <label>Mode<input name="mode" defaultValue="Video" disabled={!stage.unlocked || (!participantCanEdit && !manager)} /></label>
              <button type="submit" className={styles.secondaryButton} disabled={!stage.unlocked || (!participantCanEdit && !manager)}>Save schedule</button>
            </form>
          ) : null}

          {participantCanEdit ? (
            <div className={styles.twoForms}>
              <form action={saveStageNoteAction} className={styles.noteForm}>
                <input type="hidden" name="stage" value={stage.key} />
                <label>My note<textarea name="note" defaultValue={stage.note} maxLength={4000} /></label>
                <button type="submit" className={styles.secondaryButton}>Save note</button>
              </form>
              <form action={markParticipantStageCompleteAction}>
                <input type="hidden" name="stage" value={stage.key} />
                <input type="hidden" name="isComplete" value={stage.complete ? "false" : "true"} />
                <button type="submit" className={styles.primaryButton}>{stage.complete ? "Reopen stage" : "Mark complete"}</button>
              </form>
            </div>
          ) : null}

          {manager ? (
            <div className={styles.managerPanel}>
              <form action={saveArchitectStageNoteAction} className={styles.noteForm}>
                <input type="hidden" name="participantId" value={participant.id} />
                <input type="hidden" name="stage" value={stage.key} />
                <label>Architect guidance<textarea name="note" defaultValue={stage.architectNote} maxLength={4000} /></label>
                <button type="submit" className={styles.secondaryButton}>Save guidance</button>
              </form>
              <form action={architectUpdateStageAction} className={styles.releaseForm}>
                <input type="hidden" name="participantId" value={participant.id} />
                <input type="hidden" name="stage" value={stage.key} />
                <label><input type="checkbox" name="unlocked" value="true" defaultChecked={stage.unlocked} /> Unlocked</label>
                <input type="hidden" name="unlocked" value="false" />
                <label><input type="checkbox" name="released" value="true" defaultChecked={stage.released} /> Released</label>
                <input type="hidden" name="released" value="false" />
                <label><input type="checkbox" name="isComplete" value="true" defaultChecked={stage.complete} /> Complete</label>
                <input type="hidden" name="isComplete" value="false" />
                <button type="submit" className={styles.primaryButton}>Update stage</button>
              </form>
            </div>
          ) : null}
        </article>
      ))}
    </section>
  );
}
