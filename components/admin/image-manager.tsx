"use client";

// Product photos: resize in the browser, upload, then edit alt/caption,
// reorder or delete. Resizing here keeps uploads small and needs no
// image library on the server (Hostinger's build server can't run native ones).

import { useActionState, useRef, useState } from "react";
import { imageAction, uploadImageAction } from "@/app/admin/actions/products";
import type { AdminImage } from "@/lib/admin-catalog";
import { bn } from "@/lib/site";
import type { ActionResult } from "@/lib/validate";

const MAX_SIDE = 1600;
const MAX_BYTES = 1_500_000;

/** Shrinks to MAX_SIDE on the longest side and re-encodes as WebP (JPEG fallback). */
async function resize(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  for (const [type, q] of [["image/webp", 0.82], ["image/webp", 0.7], ["image/jpeg", 0.8], ["image/jpeg", 0.65]] as const) {
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, type, q));
    if (blob && blob.type === type && blob.size <= MAX_BYTES) return { blob, width, height };
  }
  throw new Error("ছবিটি ছোট করা গেল না। অন্য একটি ছবি দিন।");
}

const CAPTIONS = ["পুরো পণ্য", "কাছ থেকে", "আকার", "প্যাকিং", "উৎস", "রান্না"];

export function ImageManager({ productId, productName, images }: { productId: number; productName: string; images: AdminImage[] }) {
  const [state, upload, pending] = useActionState<ActionResult | null, FormData>(uploadImageAction, null);
  const [prepError, setPrepError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPrepError(null);
    const file = fileRef.current?.files?.[0];
    if (!file) return setPrepError("একটি ছবি বেছে নিন।");
    if (!file.type.startsWith("image/")) return setPrepError("শুধু ছবি দেওয়া যাবে।");
    setPreparing(true);
    try {
      const { blob, width, height } = await resize(file);
      const fd = new FormData(e.currentTarget);
      fd.set("file", new File([blob], "photo." + (blob.type === "image/webp" ? "webp" : "jpg"), { type: blob.type }));
      fd.set("width", String(width));
      fd.set("height", String(height));
      upload(fd);
      formRef.current?.reset();
    } catch (err) {
      setPrepError(err instanceof Error ? err.message : "ছবি প্রস্তুত করা যায়নি।");
    } finally {
      setPreparing(false);
    }
  }

  return (
    <section className="panel" aria-labelledby="im-h">
      <h2 id="im-h">ছবি ({bn(images.length)})</h2>
      <p className="hint">প্রথম ছবিটি কার্ডে আর পণ্য পেজের শুরুতে দেখাবে। ভালো ছবির তালিকা: পুরো পণ্য, কাছ থেকে, হাতে নিয়ে আকার বোঝানো, প্যাকিং। ছবি নিজে থেকেই ছোট হয়ে আপলোড হবে।</p>

      {images.length > 0 && (
        <ul className="img-list">
          {images.map((img, i) => (
            <li key={img.id}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/img/${img.id}?v=admin`} alt={img.alt || `${productName} ছবি ${i + 1}`} width={120} height={120} loading="lazy" />
              <form action={imageAction} className="img-meta">
                <input type="hidden" name="imageId" value={img.id} />
                <input type="hidden" name="productId" value={productId} />
                <label className="mini-field"><span>ক্যাপশন</span><input name="caption" defaultValue={img.caption} maxLength={60} list="img-captions" /></label>
                <label className="mini-field wide"><span>বিবরণ (alt, যারা ছবি দেখতে পান না তাদের জন্য)</span><input name="alt" defaultValue={img.alt} maxLength={160} /></label>
                <div className="img-tools">
                  <button className="btn btn-ghost" name="op" value="save" type="submit">সেভ</button>
                  <button className="linkish" name="op" value="up" type="submit" disabled={i === 0} aria-label="আগে নিন">↑</button>
                  <button className="linkish" name="op" value="down" type="submit" disabled={i === images.length - 1} aria-label="পরে নিন">↓</button>
                  <button className="linkish danger" name="op" value="delete" type="submit">মুছুন</button>
                </div>
                <small className="num">{bn(img.width)}×{bn(img.height)} · {bn(Math.round(img.bytes / 1024))} KB</small>
              </form>
            </li>
          ))}
        </ul>
      )}

      <form ref={formRef} onSubmit={onSubmit} className="admin-form upload-form">
        <input type="hidden" name="productId" value={productId} />
        <label className="mini-field wide"><span>নতুন ছবি</span><input ref={fileRef} name="picked" type="file" accept="image/jpeg,image/png,image/webp" /></label>
        <label className="mini-field"><span>ক্যাপশন</span><input name="caption" maxLength={60} list="img-captions" placeholder="যেমন: কাছ থেকে" /></label>
        <label className="mini-field wide"><span>বিবরণ (alt)</span><input name="alt" maxLength={160} placeholder={`যেমন: ${productName}, বরফে প্যাক করা`} /></label>
        <datalist id="img-captions">{CAPTIONS.map((c) => <option key={c} value={c} />)}</datalist>
        <button className="btn btn-primary" type="submit" disabled={pending || preparing}>{preparing ? "ছোট করা হচ্ছে..." : pending ? "আপলোড হচ্ছে..." : "ছবি যোগ করুন"}</button>
        {(prepError || state) && <p className={`notice ${prepError || !state?.ok ? "bad" : "ok"}`} role="status">{prepError ?? state?.message}</p>}
      </form>
    </section>
  );
}
