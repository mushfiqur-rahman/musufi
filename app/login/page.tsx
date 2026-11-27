import type { Metadata } from "next";
import { LoginForm } from "@/components/login-form";

export const metadata: Metadata = {
  title: "লগইন",
  description: "ইমেইলে পাঠানো কোড দিয়ে মুসুফি অ্যাকাউন্টে লগইন করুন। কোনো পাসওয়ার্ড লাগে না।",
  robots: { index: false },
};

export default function LoginPage() {
  return (
    <div className="wrap auth-page">
      <div className="auth-intro">
        <h1>লগইন</h1>
        <p className="lead">পাসওয়ার্ড লাগবে না। আপনার ইমেইলে একটি ৬ সংখ্যার কোড যাবে, সেটি লিখলেই লগইন। নতুন হলে অ্যাকাউন্ট নিজে থেকেই খুলে যাবে।</p>
      </div>
      <LoginForm />
    </div>
  );
}
