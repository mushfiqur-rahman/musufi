/** Six-digit authenticator code input, shared by the 2FA forms. */
export function TotpCodeField({ id = "code", label = "অ্যাপের ৬ অঙ্কের কোড" }: { id?: string; label?: string }) {
  return (
    <div className="field totp-field">
      <label htmlFor={id}>{label}</label>
      <input id={id} name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9০-৯ ]{6,7}" maxLength={7} required placeholder="১২৩৪৫৬" />
    </div>
  );
}

/** Shared error messages for ?err= on the 2FA pages. */
export const TOTP_ERRORS: Record<string, string> = {
  code: "কোড মেলেনি। অ্যাপে এখন যে কোড দেখাচ্ছে সেটি দিন (প্রতিটি কোড একবারই চলে)।",
  many: "অনেকবার ভুল হয়েছে। ১০ মিনিট পরে আবার চেষ্টা করুন।",
};
