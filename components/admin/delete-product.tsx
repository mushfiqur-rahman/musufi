"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { deleteProductAction } from "@/app/admin/actions/products";
import type { ActionResult } from "@/lib/validate";

/** Two-step delete: first click asks, second click deletes. */
export function DeleteProduct({ id, name }: { id: number; name: string }) {
  const router = useRouter();
  const [armed, setArmed] = useState(false);
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(deleteProductAction, null);
  useEffect(() => {
    if (state?.ok) router.replace("/admin/products");
  }, [state, router]);

  return (
    <form action={action} className="danger-zone">
      <input type="hidden" name="id" value={id} />
      {!armed ? (
        <button type="button" className="btn btn-ghost danger" onClick={() => setArmed(true)}>পণ্য মুছুন</button>
      ) : (
        <>
          <p>“{name}” স্থায়ীভাবে মুছে যাবে, ছবিসহ। অর্ডার হয়ে থাকলে মোছা যাবে না, তখন লুকিয়ে রাখুন।</p>
          <button type="submit" className="btn btn-primary danger-fill" disabled={pending}>{pending ? "মুছছে..." : "হ্যাঁ, মুছে ফেলুন"}</button>
          <button type="button" className="btn btn-ghost" onClick={() => setArmed(false)}>না</button>
        </>
      )}
      {state && !state.ok && <p className="notice bad" role="status">{state.message}</p>}
    </form>
  );
}
