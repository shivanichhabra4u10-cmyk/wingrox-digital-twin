import Link from "next/link";
import { markNotificationReadAction } from "../actions";
import { signOutAction } from "@/app/login/actions";
import type { AppDashboardData } from "../_lib/dashboard-data";
import type { StageViewModel } from "./dashboard-metrics";
import styles from "../page.module.css";

type AppShellProps = {
  data: AppDashboardData;
  stages: StageViewModel[];
  overall: number;
  children: React.ReactNode;
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "WG";
}

export function AppShell({ data, stages, overall, children }: AppShellProps) {
  const unread = data.notifications.filter((notification) => !notification.read_at).length;
  const completedStages = stages.filter((stage) => stage.complete).length;
  const unlockedStages = stages.filter((stage) => stage.unlocked).length;
  const documentCount = data.documents.length;

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <Link className={styles.brand} href="/app" aria-label="WinGroX dashboard">
          <span className={styles.brandMark}>W</span>
          <span>
            <strong>WinGroX</strong>
            <small>Growth Intelligence</small>
          </span>
        </Link>
        <div className={styles.headerMeta}>
          <span>{data.profile.role.replace("_", " ")}</span>
          <span className={styles.avatar}>{initials(data.profile.full_name)}</span>
          <form action={signOutAction}>
            <button className={styles.signOutButton} type="submit">Sign out</button>
          </form>
        </div>
      </header>

      <aside className={styles.sidebar} aria-label="Growth roadmap">
        <section className={styles.progressCard}>
          <span className={styles.eyebrow}>Workspace</span>
          <strong>{data.selectedParticipant?.full_name ?? "No participant selected"}</strong>
          <div className={styles.progressBar} aria-label={`${overall}% overall progress`}>
            <span style={{ width: `${overall}%` }} />
          </div>
          <small>{overall}% journey readiness</small>
        </section>

        <nav className={styles.stageNav}>
          {stages.map((stage) => (
            <a key={stage.key} href={`#${stage.key}`} className={stage.complete ? styles.stageDone : undefined} aria-disabled={!stage.unlocked}>
              <span>{stage.number}</span>
              <strong>{stage.label}</strong>
              <small>{stage.unlocked ? `${stage.percent}%` : "Locked"}</small>
            </a>
          ))}
        </nav>
      </aside>

      <main className={styles.main}>
        {data.flash ? <div className={`${styles.flash} ${styles[data.flash.kind]}`}>{data.flash.text}</div> : null}

        <section className={styles.hero}>
          <div>
            <span className={styles.eyebrow}>Growth workspace</span>
            <h1>{data.selectedParticipant?.full_name ?? "Participant"}</h1>
            <div className={styles.stageMap} aria-label="Seven-step progress map">
              {stages.map((stage) => (
                <a key={stage.key} href={`#${stage.key}`} className={stage.complete ? styles.mapDone : stage.unlocked ? styles.mapOpen : styles.mapLocked} aria-label={`${stage.label}: ${stage.percent}%`}>
                  <span>{stage.number}</span>
                </a>
              ))}
            </div>
          </div>
          <div className={styles.metricDeck}>
            <div className={styles.metricTile}><strong>{overall}%</strong><span>Overall</span></div>
            <div className={styles.metricTile}><strong>{completedStages}/7</strong><span>Closed</span></div>
            <div className={styles.metricTile}><strong>{unlockedStages}</strong><span>Open</span></div>
            <div className={styles.metricTile}><strong>{documentCount}</strong><span>Docs</span></div>
            <div className={styles.metricTile}><strong>{unread}</strong><span>Unread</span></div>
          </div>
        </section>

        {data.notifications.length > 0 ? (
          <section className={styles.notificationStrip} aria-label="Recent notifications">
            {data.notifications.slice(0, 3).map((notification) => (
              <form key={notification.id} action={markNotificationReadAction}>
                <input type="hidden" name="id" value={notification.id} />
                <button type="submit" className={notification.read_at ? styles.notificationRead : undefined}>
                  <span className={styles.notificationDot} aria-hidden="true" />
                  <span>{notification.message}</span>
                </button>
              </form>
            ))}
          </section>
        ) : null}

        {children}
      </main>
    </div>
  );
}
