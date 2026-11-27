"use client";

// Login: email + password for people who have set one; an email code for the
// first login and for a forgotten password. Right after a code login, the
// person is asked to set a password so they don't depend on email next time.

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

const BN = "০১২৩৪৫৬৭৮৯";
const toLatinDigits = (s: string) => s.replace(/[০-৯]/g, (d) => String(BN.indexOf(d)));
const NET_ERR = "ইন্টারনেট সংযোগ পাওয়া যায়নি। আবার চেষ্টা করুন।";

type Msg = { kind: "ok" | "bad"; text: string } | null;

async function post(url: string, data: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(data) });
  return { ok: res.ok, body: (await res.json().catch(() => ({}))) as Record<string, unknown> };
}

type Step = "password" | "email" | "code" | "setpw";

export function LoginForm() {
  const router = useRouter();
  const id = useId();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<Step>("password");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const [dest, setDest] = useState("/account");
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (step === "code") codeRef.current?.focus(); }, [step]);

  function done(isAdmin: boolean) {
    router.replace(isAdmin ? "/admin" : "/account");
    router.refresh();
  }

  async function run(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    try { await fn(); } catch { setMsg({ kind: "bad", text: NET_ERR }); } finally { setBusy(false); }
  }

  const sendCode = () => run(async () => {
    const r = await post("/api/auth/request-code", { email: email.trim() });
    setMsg({ kind: r.ok ? "ok" : "bad", text: String(r.body.message) });
    if (r.ok) { setCode(""); setStep("code"); }
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (step === "email") return sendCode();
    if (step === "password") return run(async () => {
      const r = await post("/api/auth/password", { email: email.trim(), password });
      if (!r.ok) { setMsg({ kind: "bad", text: String(r.body.message) }); return; }
      done(Boolean((r.body.customer as { isAdmin?: boolean } | undefined)?.isAdmin));
    });
    if (step === "code") return run(async () => {
      const r = await post("/api/auth/verify", { email: email.trim(), code });
      if (!r.ok) { setMsg({ kind: "bad", text: String(r.body.message) }); return; }
      const c = r.body.customer as { isAdmin?: boolean; hasPassword?: boolean } | undefined;
      setDest(c?.isAdmin ? "/admin" : "/account");
      // Code login done; offer a password (also the "forgot password" path).
      setMsg(null);
      setStep("setpw");
    });
  }

  if (step === "setpw") {
    return (
      <div className="order login-card">
        <p className="notice ok" role="status">লগইন হয়েছে। এখন একটি পাসওয়ার্ড সেট করুন, পরের বার ইমেইলের কোড ছাড়াই লগইন করতে পারবেন।</p>
        <SetPasswordForm onDone={() => { router.replace(dest); router.refresh(); }} />
        <button type="button" className="linkish" onClick={() => { router.replace(dest); router.refresh(); }}>এখন না, পরে করব</button>
      </div>
    );
  }

  const usingCode = step === "email" || step === "code";
  return (
    <form className="order login-card" onSubmit={onSubmit} noValidate>
      <div className="field">
        <label htmlFor={`${id}-email`}>ইমেইল</label>
        <input id={`${id}-email`} type="email" inputMode="email" autoComplete="email" placeholder="name@gmail.com"
          value={email} onChange={(e) => setEmail(e.target.value)} disabled={step === "code"} required />
      </div>

      {step === "password" && (
        <div className="field">
          <label htmlFor={`${id}-pw`}>পাসওয়ার্ড</label>
          <PasswordInput id={`${id}-pw`} value={password} onChange={setPassword} autoComplete="current-password" />
        </div>
      )}

      {step === "code" && (
        <div className="field">
          <label htmlFor={`${id}-code`}>ইমেইলে পাওয়া ৬ সংখ্যার কোড</label>
          <input ref={codeRef} id={`${id}-code`} className="code-input num" inputMode="numeric" autoComplete="one-time-code" placeholder="______"
            value={code} onChange={(e) => setCode(toLatinDigits(e.target.value).replace(/\D/g, "").slice(0, 6))} />
          <p className="code-links">
            <button type="button" className="linkish" onClick={sendCode} disabled={busy}>নতুন কোড পাঠান</button>
            {" · "}
            <button type="button" className="linkish" onClick={() => { setStep("email"); setMsg(null); }}>ইমেইল বদলান</button>
          </p>
        </div>
      )}

      <button className="btn btn-primary btn-lg" type="submit"
        disabled={busy || !email.trim() || (step === "code" && code.length !== 6) || (step === "password" && !password)}>
        {busy ? "অপেক্ষা করুন..." : step === "password" ? "লগইন করুন" : step === "email" ? "কোড পাঠান" : "কোড মিলিয়ে লগইন"}
      </button>
      {msg && <p className={`notice ${msg.kind}`} role="status">{msg.text}</p>}

      <p className="login-switch">
        {usingCode ? (
          <button type="button" className="linkish" onClick={() => { setStep("password"); setMsg(null); }}>পাসওয়ার্ড দিয়ে লগইন করুন</button>
        ) : (
          <>নতুন ক্রেতা বা পাসওয়ার্ড ভুলে গেছেন?{" "}
            <button type="button" className="linkish" onClick={() => { setStep("email"); setMsg(null); }}>ইমেইলে কোড নিন</button></>
        )}
      </p>
    </form>
  );
}

/** Password field with a show/hide toggle. */
export function PasswordInput({ id, value, onChange, autoComplete }: { id: string; value: string; onChange: (v: string) => void; autoComplete: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="pw-wrap">
      <input id={id} type={show ? "text" : "password"} autoComplete={autoComplete} value={value} onChange={(e) => onChange(e.target.value)} maxLength={128} />
      <button type="button" className="linkish pw-toggle" onClick={() => setShow((s) => !s)} aria-pressed={show}>{show ? "লুকান" : "দেখুন"}</button>
    </div>
  );
}

/**
 * Set or change the logged-in person's password. `needCurrent` asks for the
 * old one (the server also enforces this unless the session just came from an email code).
 */
export function SetPasswordForm({ needCurrent = false, onDone }: { needCurrent?: boolean; onDone?: () => void }) {
  const id = useId();
  const [current, setCurrent] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (pw !== pw2) { setMsg({ kind: "bad", text: "দুই ঘরের পাসওয়ার্ড মেলেনি।" }); return; }
    setBusy(true);
    try {
      const r = await post("/api/auth/set-password", { password: pw, current });
      setMsg({ kind: r.ok ? "ok" : "bad", text: String(r.body.message) });
      if (r.ok) { setCurrent(""); setPw(""); setPw2(""); onDone?.(); }
    } catch {
      setMsg({ kind: "bad", text: NET_ERR });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="stack" onSubmit={onSubmit} noValidate>
      {needCurrent && (
        <div className="field">
          <label htmlFor={`${id}-cur`}>বর্তমান পাসওয়ার্ড</label>
          <PasswordInput id={`${id}-cur`} value={current} onChange={setCurrent} autoComplete="current-password" />
        </div>
      )}
      <div className="field">
        <label htmlFor={`${id}-new`}>নতুন পাসওয়ার্ড</label>
        <PasswordInput id={`${id}-new`} value={pw} onChange={setPw} autoComplete="new-password" />
        <span className="hint">কমপক্ষে ৮ অক্ষর। অক্ষর আর সংখ্যা মিলিয়ে দিন।</span>
      </div>
      <div className="field">
        <label htmlFor={`${id}-new2`}>আবার লিখুন</label>
        <PasswordInput id={`${id}-new2`} value={pw2} onChange={setPw2} autoComplete="new-password" />
      </div>
      <button className="btn btn-primary" type="submit" disabled={busy || !pw || !pw2}>{busy ? "অপেক্ষা করুন..." : "পাসওয়ার্ড সেট করুন"}</button>
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
