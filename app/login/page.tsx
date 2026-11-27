import type { Metadata } from "next";
import { LoginForm } from "@/components/login-form";

export const metadata: Metadata = {
  title: "লগইন",
  description: "ইমেইল আর পাসওয়ার্ড দিয়ে মুসুফি অ্যাকাউন্টে লগইন করুন।",
  robots: { index: false },
};

export default function LoginPage() {
  return (
    <div className="wrap auth-page">
      <div className="auth-intro">
        <h1>লগইন</h1>
        <p className="lead">ইমেইল আর পাসওয়ার্ড দিয়ে লগইন করুন। প্রথমবার বা পাসওয়ার্ড ভুলে গেলে ইমেইলে কোড নিন; কোড দিলেই অ্যাকাউন্ট খুলে যাবে, তারপর নিজের পাসওয়ার্ড সেট করে নিন।</p>
      </div>
      <LoginForm />
    </div>
  );
}
