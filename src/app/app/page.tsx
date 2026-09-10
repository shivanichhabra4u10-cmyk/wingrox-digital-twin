import { getPublicSupabaseEnv } from "@/lib/supabase/env";
import { redirect } from "next/navigation";
import { AppShell } from "./_components/app-shell";
import { ArchitectPanel } from "./_components/architect-panel";
import { buildStageModels, overallProgress } from "./_components/dashboard-metrics";
import { DiagnosticPanel, MirrorCoachJourneyPanels, ValidationPanel } from "./_components/flow-panels";
import { ProfilePanel } from "./_components/profile-panel";
import { StageWorkspace } from "./_components/stage-workspace";
import { getDashboardData } from "./_lib/dashboard-data";

type AppHomePageProps = {
  searchParams: Promise<{ pid?: string }>;
};

export default async function AppHomePage({ searchParams }: AppHomePageProps) {
  const env = getPublicSupabaseEnv();

  if (!env.isConfigured) {
    redirect("/setup");
  }

  const params = await searchParams;
  const data = await getDashboardData(params.pid);
  const stages = buildStageModels(data);

  return (
    <AppShell data={data} stages={stages} overall={overallProgress(stages)}>
      <ArchitectPanel data={data} />
      <ProfilePanel data={data} />
      <StageWorkspace data={data} stages={stages} />
      <ValidationPanel data={data} />
      <DiagnosticPanel data={data} />
      <MirrorCoachJourneyPanels data={data} />
    </AppShell>
  );
}
