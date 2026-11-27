"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ProductImage } from "@/lib/products";
import { bn } from "@/lib/site";
import { CloseIcon, SearchIcon } from "./icons";
import { ProductPhoto } from "./product-photo";

function Slide({ img, sizes, priority }: { img: ProductImage; sizes: string; priority?: boolean }) {
  if (img.src) {
    // Plain img: photos are resized at upload, and server-side optimisation would need a native binary.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={img.src} alt={img.alt} sizes={sizes} loading={priority ? "eager" : "lazy"} decoding="async" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />;
  }
  return <ProductPhoto label={img.alt} art={img.art} closeUp={img.closeUp} note={`${img.caption}-এর ছবি আসছে`} />;
}

const ZOOM = 2.5;

export function ProductGallery({ images, name, badge }: { images: ProductImage[]; name: string; badge?: string }) {
  const [i, setI] = useState(0);
  const [open, setOpen] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const [origin, setOrigin] = useState("50% 50%");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const n = images.length;
  const img = images[i];

  const go = useCallback((d: number) => {
    setI((x) => (x + d + n) % n);
    setZoomed(false);
  }, [n]);

  // Native <dialog>: focus trap, Esc to close and backdrop come for free.
  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  function trackPointer(e: React.PointerEvent<HTMLElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    setOrigin(`${x.toFixed(1)}% ${y.toFixed(1)}%`);
  }

  // Swipe between pictures on touch screens.
  const touchX = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => { touchX.current = e.touches[0].clientX; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchX.current === null || zoomed) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
    touchX.current = null;
  };

  return (
    <div className="gallery">
      <div className="main" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {badge && <span className="tag">{badge}</span>}
        <button
          type="button"
          className="main-zoom"
          onClick={() => { setOpen(true); setZoomed(false); }}
          onPointerMove={trackPointer}
          style={{ ["--origin" as string]: origin }}
          aria-label={`${name}: ${img.caption} ছবিটি বড় করে দেখুন`}
        >
          <span className="main-img"><Slide img={img} sizes="(min-width: 920px) 560px, 100vw" priority={i === 0} /></span>
        </button>
        <span className="zoom-hint" aria-hidden="true"><SearchIcon width={14} height={14} /> বড় করে দেখতে চাপুন</span>
        {n > 1 && (
          <>
            <button type="button" className="nav prev" onClick={() => go(-1)} aria-label="আগের ছবি">‹</button>
            <button type="button" className="nav next" onClick={() => go(1)} aria-label="পরের ছবি">›</button>
            <span className="count num" aria-live="polite">{bn(i + 1)} / {bn(n)} · {img.caption}</span>
          </>
        )}
      </div>

      {n > 1 && (
        <div className="thumbs" role="group" aria-label={`${name}-এর ছবি`}>
          {images.map((im, k) => (
            <button key={k} type="button" aria-pressed={k === i} aria-label={`ছবি ${bn(k + 1)}: ${im.caption}`} onClick={() => { setI(k); setZoomed(false); }}>
              <span className="thumb-img"><Slide img={{ ...im, caption: "" }} sizes="96px" /></span>
              <span className="thumb-cap">{im.caption}</span>
            </button>
          ))}
        </div>
      )}

      <dialog
        ref={dialogRef}
        className="viewer"
        aria-label={`${name}: ছবি`}
        onClose={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") go(1);
          if (e.key === "ArrowLeft") go(-1);
        }}
        onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
      >
        <div className="viewer-bar">
          <span className="num">{bn(i + 1)} / {bn(n)} · {img.caption}</span>
          <span className="viewer-tools">
            <button type="button" onClick={() => setZoomed((z) => !z)} aria-pressed={zoomed}>{zoomed ? "− ছোট করুন" : "+ বড় করুন"}</button>
            <button type="button" onClick={() => setOpen(false)} aria-label="বন্ধ করুন"><CloseIcon width={20} height={20} /></button>
          </span>
        </div>
        <div
          className={`viewer-stage${zoomed ? " zoomed" : ""}`}
          onClick={(e) => { trackPointer(e as unknown as React.PointerEvent<HTMLElement>); setZoomed((z) => !z); }}
          onPointerMove={(e) => zoomed && trackPointer(e)}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          style={{ ["--origin" as string]: origin, ["--zoom" as string]: ZOOM }}
        >
          <span className="viewer-img"><Slide img={img} sizes="100vw" /></span>
        </div>
        {n > 1 && (
          <div className="viewer-nav">
            <button type="button" onClick={() => go(-1)} aria-label="আগের ছবি">‹ আগের</button>
            <button type="button" onClick={() => go(1)} aria-label="পরের ছবি">পরের ›</button>
          </div>
        )}
      </dialog>
    </div>
  );
}
