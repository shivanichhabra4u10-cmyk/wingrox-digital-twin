import Link from "next/link";
import { assignParticipantByEmailAction, claimParticipantAction } from "../actions";
import type { AppDashboardData } from "../_lib/dashboard-data";
import styles from "../page.module.css";

export function ArchitectPanel({ data }: { data: AppDashboardData }) {
  const participant = data.selectedParticipant;
  const canManage = data.profile.role === "architect" || data.profile.role === "admin";

  if (!canManage) return null;

  return (
    <section className={styles.cardGrid} aria-label="Architect controls">
      <div className={styles.card}>
        <span className={styles.eyebrow}>Portfolio</span>
        <h2>Assigned journeys</h2>
        <div className={styles.peopleList}>
          {data.participants.map((item) => (
            <Link key={item.id} href={`/app?pid=${item.id}`} className={participant?.id === item.id ? styles.activePerson : undefined}>
              <strong>{item.full_name}</strong>
              <small>{item.email ?? "No email"}</small>
            </Link>
          ))}
          {data.participants.length === 0 ? <p className={styles.emptyState}>No participant journeys are assigned yet.</p> : null}
        </div>
      </div>

      {participant ? (
        <div className={styles.card}>
          <span className={styles.eyebrow}>Access</span>
          <h2>Assign collaborators</h2>
          <form action={claimParticipantAction} className={styles.inlineAction}>
            <input type="hidden" name="participantId" value={participant.id} />
            <button type="submit" className={styles.secondaryButton}>Claim as architect</button>
          </form>
          <form action={assignParticipantByEmailAction} className={styles.formGridCompact}>
            <input type="hidden" name="participantId" value={participant.id} />
            <label>Email<input name="targetEmail" type="email" required placeholder="coach@example.com" /></label>
            <label>Role<select name="role" defaultValue="coach"><option value="coach">Coach</option><option value="sponsor">Sponsor</option><option value="architect">Architect</option></select></label>
            <button type="submit" className={styles.primaryButton}>Assign role</button>
          </form>
        </div>
      ) : null}
    </section>
  );
}
