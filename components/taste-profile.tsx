import { tasteLabels, type Taste, type TasteKey } from "@/lib/products";

const words = ["", "খুব হালকা", "হালকা", "মাঝারি", "বেশি", "খুব বেশি"];

export function TasteProfile({ taste, name }: { taste: Taste; name: string }) {
  const entries = Object.entries(taste.levels) as [TasteKey, number][];
  return (
    <section className="taste" aria-labelledby="h-taste">
      <div>
        <h2 id="h-taste">খেতে কেমন?</h2>
        <p style={{ color: "var(--muted)", marginTop: 4 }}>{name}: {taste.oneLine}</p>
      </div>
      <dl className="taste-bars">
        {entries.map(([k, v]) => (
          <div key={k}>
            <dt>{tasteLabels[k]}</dt>
            <dd>
              <span className="meter" role="img" aria-label={`${tasteLabels[k]}: ৫-এর মধ্যে ${"০১২৩৪৫"[v]}, ${words[v]}`}>
                {[1, 2, 3, 4, 5].map((n) => <i key={n} className={n <= v ? "on" : undefined} />)}
              </span>
              <span className="meter-word" aria-hidden="true">{words[v]}</span>
            </dd>
          </div>
        ))}
      </dl>
      <div className="feel">
        <div><b>মুখে কেমন লাগে</b>{taste.texture}</div>
        <div><b>ঘ্রাণ</b>{taste.aroma}</div>
      </div>
      <div>
        <p style={{ fontWeight: 600, marginBottom: 8 }}>যা দিয়ে খেতে ভালো লাগে</p>
        <ul className="pairs">
          {taste.bestWith.map((b) => <li key={b}>{b}</li>)}
        </ul>
      </div>
    </section>
  );
}
