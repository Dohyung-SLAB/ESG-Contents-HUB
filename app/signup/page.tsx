"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { actionSignUp } from "@/lib/actions";
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

const signupSchema = z
  .object({
    full_name: z.string().min(2, "이름을 입력하세요."),
    email: z.string().email("유효한 이메일을 입력하세요."),
    department: z.string().optional(),
    password: z.string().min(8, "비밀번호는 8자 이상이어야 합니다."),
    confirm: z.string().min(1, "비밀번호 확인을 입력하세요."),
  })
  .refine((v) => v.password === v.confirm, {
    message: "비밀번호가 일치하지 않습니다.",
    path: ["confirm"],
  });

type SignupFormValues = z.infer<typeof signupSchema>;

export default function SignupPage() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      full_name: "",
      email: "",
      department: "",
      password: "",
      confirm: "",
    },
  });

  function onSubmit(values: SignupFormValues) {
    setError(null);
    startTransition(async () => {
      const result = await actionSignUp({
        full_name: values.full_name,
        email: values.email,
        password: values.password,
        department: values.department || null,
      });
      if (!result.ok) {
        setError(result.error ?? "가입에 실패했습니다.");
        return;
      }
      router.replace(result.redirectTo ?? "/waiting");
      router.refresh();
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(160deg,#32466b_0%,#2f4858_45%,#e8ebf1_45%,#f4f5f8_100%)] px-4 py-10">
      <Card className="w-full max-w-md border-slate-200/80 shadow-lg">
        <CardHeader className="space-y-2">
          <p className="text-sm font-semibold text-[var(--brand-navy)]">
            ESG Content Hub
          </p>
          <CardTitle className="text-2xl">회원가입</CardTitle>
          <CardDescription>
            고객사는 컨설턴트가 초대한 이메일만 가입할 수 있습니다. 컨설턴트는
            @sustainlab.co.kr 계정으로 가입하세요.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
            <div className="space-y-2">
              <Label htmlFor="full_name">이름</Label>
              <Input id="full_name" {...register("full_name")} />
              {errors.full_name ? (
                <p className="text-sm text-destructive">
                  {errors.full_name.message}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">회사 이메일</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                {...register("email")}
              />
              {errors.email ? (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="department">부서 (선택)</Label>
              <Input
                id="department"
                placeholder="예: 품질보증, ESG"
                {...register("department")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">비밀번호</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                {...register("password")}
              />
              {errors.password ? (
                <p className="text-sm text-destructive">
                  {errors.password.message}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">비밀번호 확인</Label>
              <Input
                id="confirm"
                type="password"
                autoComplete="new-password"
                {...register("confirm")}
              />
              {errors.confirm ? (
                <p className="text-sm text-destructive">
                  {errors.confirm.message}
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
              {pending ? "가입 중…" : "가입하기"}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            이미 계정이 있나요?{" "}
            <Link
              href="/login"
              className="font-medium text-[var(--brand-navy)] underline-offset-4 hover:underline"
            >
              로그인
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
