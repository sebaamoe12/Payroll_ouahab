"use client";

import { useTranslations } from "next-intl";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const t = useTranslations();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const result = await signIn("credentials", { email, password, redirect: false });
    if (result?.error) {
      setError(t("auth.invalidCredentials"));
    } else {
      router.push("/dashboard");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-blue-50">
      <div className="card p-8 w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center text-white text-xl font-bold mx-auto mb-4">P</div>
          <h1 className="text-xl font-bold text-gray-900">{t("auth.signInTitle")}</h1>
          <p className="text-sm text-gray-500 mt-1">{t("app.description")}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}</p>}
          <input
            type="email"
            placeholder={t("auth.email")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
            required
          />
          <input
            type="password"
            placeholder={t("auth.password")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
            required
          />
          <button type="submit" className="btn btn-primary w-full justify-center">{t("auth.signIn")}</button>
        </form>

        <p className="text-sm text-gray-500 text-center mt-6">
          {t("auth.noAccount")}{" "}
          <Link href="/register" className="text-primary font-medium hover:underline">{t("auth.register")}</Link>
        </p>
      </div>
    </div>
  );
}
