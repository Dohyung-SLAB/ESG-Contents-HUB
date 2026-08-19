import { redirect } from "next/navigation";

import { actionSignOut } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { getSessionUser, hasAuthSession } from "@/lib/data/session";
import { isAwaitingAssignment } from "@/lib/services/members";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export default async function WaitingPage() {
  if (isSupabaseConfigured() && !(await hasAuthSession())) {
    if (process.env.ALLOW_DEMO_ROLE_COOKIE !== "true") {
      redirect("/login");
    }
  }

  const user = await getSessionUser();
  if (!(await isAwaitingAssignment(user))) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen flex-col bg-[linear-gradient(165deg,#32466b_0%,#2f4858_42%,#f4f5f8_42%)]">
      <header className="flex h-14 items-center justify-between px-6">
        <p className="text-sm font-semibold text-white">ESG Content Hub</p>
        <p className="text-sm text-slate-300">{user.email}</p>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 pb-20">
        <div className="w-full max-w-lg rounded-xl border bg-white p-8 shadow-sm text-center">
          <h1 className="text-2xl font-semibold text-[var(--brand-ink)]">
            프로젝트 배정 대기 중
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">{user.full_name}</span>{" "}
            님, 계정은 있으나 아직 활성 프로젝트 멤버십이 없습니다.
            <br />
            담당 컨설턴트에게 이메일 초대를 요청한 뒤 다시 로그인해 주세요.
          </p>
          <form action={actionSignOut} className="mt-8">
            <Button type="submit" variant="outline">
              로그아웃
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
}
