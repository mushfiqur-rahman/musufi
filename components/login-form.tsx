"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

const BN = "০১২৩৪৫৬৭৮৯";
const toLatinDigits = (s: string) => s.replace(/[০-৯]/g, (d) => String(BN.indexOf(d)));

export function LoginForm() {
  const router = useRouter();
  const id = useId();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "bad"; text: string } | null>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (step === "code") codeRef.current?.focus(); }, [step]);

  async function post(url: string, data: unknown) {
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(data) });
    return { ok: res.ok, body: (await res.json().catch(() => ({}))) as Record<string, unknown> };
  }

  async function sendCode() {
    setBusy(true);
    try {
      const r = await post("/api/auth/request-code", { email: email.trim() });
      setMsg({ kind: r.ok ? "ok" : "bad", text: String(r.body.message) });
      if (r.ok) { setCode(""); setStep("code"); }
    } catch {
      setMsg({ kind: "bad", text: "ইন্টারনেট সংযোগ পাওয়া যায়নি। আবার চেষ্টা করুন।" });
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (step === "email") return sendCode();
    setBusy(true);
    try {
      const r = await post("/api/auth/verify", { email: email.trim(), code });
      if (!r.ok) { setMsg({ kind: "bad", text: String(r.body.message) }); return; }
      const isAdmin = Boolean((r.body.customer as { isAdmin?: boolean } | undefined)?.isAdmin);
      router.replace(isAdmin ? "/admin" : "/account");
      router.refresh();
    } catch {
      setMsg({ kind: "bad", text: "ইন্টারনেট সংযোগ পাওয়া যায়নি। আবার চেষ্টা করুন।" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="order login-card" onSubmit={onSubmit} noValidate>
      <div className="field">
        <label htmlFor={`${id}-email`}>ইমেইল</label>
        <input
          id={`${id}-email`}
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="name@gmail.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={step === "code"}
          required
        />
      </div>
      {step === "code" && (
        <div className="field">
          <label htmlFor={`${id}-code`}>ইমেইলে পাওয়া ৬ সংখ্যার কোড</label>
          <input
            ref={codeRef}
            id={`${id}-code`}
            className="code-input num"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="______"
            value={code}
            onChange={(e) => setCode(toLatinDigits(e.target.value).replace(/\D/g, "").slice(0, 6))}
          />
          <p className="code-links">
            <button type="button" className="linkish" onClick={sendCode} disabled={busy}>নতুন কোড পাঠান</button>
            {" · "}
            <button type="button" className="linkish" onClick={() => { setStep("email"); setMsg(null); }}>ইমেইল বদলান</button>
          </p>
        </div>
      )}
      <button className="btn btn-primary btn-lg" type="submit" disabled={busy || (step === "code" && code.length !== 6) || (step === "email" && !email.trim())}>
        {busy ? "অপেক্ষা করুন..." : step === "email" ? "কোড পাঠান" : "লগইন করুন"}
      </button>
      {msg && <p className={`notice ${msg.kind}`} role="status">{msg.text}</p>}
    </form>
  );
}

export function LogoutButton({ className = "btn btn-ghost" }: { className?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
        router.replace("/");
        router.refresh();
      }}
    >
      লগআউট
    </button>
  );
}
