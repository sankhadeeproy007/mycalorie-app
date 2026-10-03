/**
 * The app mark: a 4×4 slice of the protein contribution graph on graphite,
 * stepping up to a fully lit day. Drawn with flexbox for next/og.
 */

const GROUND = "#0d1117";
export const BRAND_RAMP = ["#1b222c", "#2c3e52", "#3c5976", "#4f79a0", "#79c0ff"];
export const BRAND_LEVELS = [
  [1, 2, 0, 3],
  [2, 3, 4, 2],
  [3, 4, 4, 3],
  [4, 4, 3, 4],
];

export function BrandMark({ size }: { size: number }) {
  const cell = size * 0.15;
  const gap = size * 0.04;
  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap,
        background: GROUND,
      }}
    >
      {BRAND_LEVELS.map((row, rowIndex) => (
        <div key={rowIndex} style={{ display: "flex", gap }}>
          {row.map((level, columnIndex) => (
            <div
              key={columnIndex}
              style={{ width: cell, height: cell, borderRadius: cell * 0.18, background: BRAND_RAMP[level] }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
