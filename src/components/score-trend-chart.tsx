interface TrendPoint {
  id: string;
  date: string; // ISO
  score: number;
  label: string;
}

// Grafik tren skor tryout (section 4 brief) — satu series, jadi satu hue
// (primary), tanpa legend. Titik ke-1 & terakhir dilabel langsung; titik
// lain punya tooltip native (<title>) saat di-hover, bukan angka berjejer
// yang bikin ramai (lihat skill dataviz: "selective direct labels").
export function ScoreTrendChart({ points }: { points: TrendPoint[] }) {
  if (points.length === 0) {
    return <p className="text-sm text-muted-foreground">Belum ada riwayat tryout.</p>;
  }

  const width = 640;
  const height = 200;
  const paddingX = 28;
  const paddingY = 24;

  const scores = points.map((p) => p.score);
  const min = Math.min(0, ...scores);
  const max = Math.max(...scores, 1);
  const range = max - min || 1;

  const stepX = points.length > 1 ? (width - paddingX * 2) / (points.length - 1) : 0;
  const xFor = (i: number) => paddingX + i * stepX;
  const yFor = (score: number) => height - paddingY - ((score - min) / range) * (height - paddingY * 2);

  const pathD = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xFor(i).toFixed(1)} ${yFor(p.score).toFixed(1)}`)
    .join(" ");

  const zeroY = min < 0 && max > 0 ? yFor(0) : null;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="Grafik tren skor tryout">
      {zeroY !== null && (
        <line x1={paddingX} y1={zeroY} x2={width - paddingX} y2={zeroY} className="stroke-border" strokeWidth={1} />
      )}
      <line
        x1={paddingX}
        y1={height - paddingY}
        x2={width - paddingX}
        y2={height - paddingY}
        className="stroke-border"
        strokeWidth={1}
      />
      <path d={pathD} fill="none" className="stroke-primary" strokeWidth={2} strokeLinejoin="round" />
      {points.map((p, i) => (
        <g key={p.id}>
          <circle cx={xFor(i)} cy={yFor(p.score)} r={4} className="fill-primary">
            <title>
              {p.label}: {p.score} ({new Date(p.date).toLocaleDateString("id-ID")})
            </title>
          </circle>
          {(i === 0 || i === points.length - 1) && (
            <text
              x={xFor(i)}
              y={yFor(p.score) - 10}
              textAnchor={i === 0 ? "start" : "end"}
              className="fill-foreground text-[10px] tabular-nums"
            >
              {p.score}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}
