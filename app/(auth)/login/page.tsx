import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthForm } from "@/components/layout/AuthForm";

export const metadata: Metadata = { title: "Вход" };

export default function LoginPage() {
  return (
    <Suspense>
      <AuthForm mode="login" />
    </Suspense>
  );
}
