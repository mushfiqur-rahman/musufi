import type { DayPoint } from "@/lib/dashboard";
import { bn, taka } from "@/lib/site";

/**
 * Daily sales bars with order counts, drawn as plain SVG on the server
 * (no chart library, nothing to download). Colours come from CSS tokens.
 */
export function SalesChart({ data }: { data: DayPoint[] }) {
  const W = 720;
  const H = 200;
  const pad = { l: 8, r: 8, t: 16, b: 28 };
  const max = Math.max(1, ...data.map((d) => d.sales));
  const bw = (W - pad.l - pad.r) / data.length;
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / max);
  const labelEvery = Math.ceil(data.length / 8);
  const total = data.reduce((a, d) => a + d.sales, 0);
  const orders = data.reduce((a, d) => a + d.orders, 0);

  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`গত ${bn(data.length)} দিনে ${bn(orders)}টি অর্ডার, মোট ${taka(total)}`}>
        <line x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} className="chart-axis" />
        <line x1={pad.l} x2={W - pad.r} y1={y(max)} y2={y(max)} className="chart-grid" />
        <text x={W - pad.r} y={y(max) - 4} textAnchor="end" className="chart-label">{taka(max)}</text>
        {data.map((d, i) => {
          const x = pad.l + i * bw;
          const h = H - pad.b - y(d.sales);
          return (
            <g key={d.date}>
              <rect x={x + bw * 0.15} y={y(d.sales)} width={bw * 0.7} height={Math.max(h, d.sales ? 2 : 0)} rx={Math.min(3, bw * 0.2)} className="chart-bar">
                <title>{`${bn(d.date)}: ${bn(d.orders)}টি অর্ডার, ${taka(d.sales)}`}</title>
              </rect>
              {i % labelEvery === 0 && (
                <text x={x + bw / 2} y={H - 10} textAnchor="middle" className="chart-label">{bn(d.date.slice(8))}/{bn(d.date.slice(5, 7))}</text>
              )}
            </g>
          );
        })}
      </svg>
      <figcaption className="num">মোট {taka(total)} · {bn(orders)}টি অর্ডার</figcaption>
    </figure>
  );
}
