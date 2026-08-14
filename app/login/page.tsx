"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { actionSignIn } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const loginSchema = z.object({
  email: z.string().email("유효한 이메일을 입력하세요."),
  password: z.string().min(1, "비밀번호를 입력하세요."),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  function onSubmit(values: LoginFormValues) {
    setError(null);
    startTransition(async () => {
      const result = await actionSignIn(values);
      if (!result.ok) {
        setError(result.error ?? "로그인에 실패했습니다.");
        return;
      }
      router.replace(result.redirectTo ?? "/dashboard");
      router.refresh();
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(160deg,#0b1f3a_0%,#132f54_45%,#e8eef6_45%,#f4f7fb_100%)] px-4">
      <Card className="w-full max-w-md border-slate-200/80 shadow-lg">
        <CardHeader className="space-y-2">
          <p className="text-sm font-semibold text-[var(--brand-navy)]">
            ESG Content Hub
          </p>
          <CardTitle className="text-2xl">로그인</CardTitle>
          <CardDescription>
            컨설턴트·고객사 담당자 계정으로 로그인합니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@company.com"
                autoComplete="email"
                {...register("email")}
              />
              {errors.email ? (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                {...register("password")}
              />
              {errors.password ? (
                <p className="text-sm text-destructive">
                  {errors.password.message}
                </p>
              ) : null}
            </div>

            {error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : null}

            <Button
              type="submit"
              disabled={pending}
              className="w-full bg-[var(--brand-navy)] hover:bg-[var(--brand-navy-hover)]"
            >
              {pending ? "로그인 중…" : "로그인"}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            컨설턴트이신가요?{" "}
            <span className="font-mono text-xs">@sustainlab.co.kr</span>으로{" "}
            <Link
              href="/signup"
              className="font-medium text-[var(--brand-navy)] underline-offset-4 hover:underline"
            >
              회원가입
            </Link>
            {" · "}
            고객사는 초대받은 이메일로만 가입할 수 있습니다.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
