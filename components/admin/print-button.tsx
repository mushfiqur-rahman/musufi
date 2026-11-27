"use client";

/** Opens the browser's print dialog (save as PDF works from there too). */
export function PrintButton() {
  return (
    <button type="button" className="btn btn-primary no-print" onClick={() => window.print()}>
      প্রিন্ট / PDF
    </button>
  );
}
