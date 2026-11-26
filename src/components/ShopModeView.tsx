import { Check, Printer } from 'lucide-react';
import { formatAngle, formatDimension } from '../geometry/units';
import type { EvaluatedVessel } from '../geometry/vesselMetrics';
import type { RingProgress, VesselProject } from '../types/vessel';

interface ShopModeViewProps {
  project: VesselProject;
  evaluated: EvaluatedVessel;
  onToggleProgress: (itemId: string, step: keyof Omit<RingProgress, 'notes'>) => void;
}

const STEPS: { key: keyof Omit<RingProgress, 'notes'>; label: string }[] = [
  { key: 'cut', label: 'Cut' },
  { key: 'dryFit', label: 'Dry-Fit' },
  { key: 'glued', label: 'Glued' },
  { key: 'flattened', label: 'Flattened' },
];

export function ShopModeView({ project, evaluated, onToggleProgress }: ShopModeViewProps) {
  const { unit, displayMode, fractionPrecision } = project.settings;
  const fmt = (inches: number) => formatDimension(inches, unit, displayMode, fractionPrecision);

  const items =
    project.mode === 'stave'
      ? evaluated.staveMetrics.map((t) => ({
          id: t.tierId,
          title: `Stave Tier ${t.index}`,
          headline: `${t.staveCount} staves · Len ${fmt(t.staveLength)} · Bevel ${formatAngle(t.bevelAngleDeg)} · Miter ${formatAngle(t.miterAngleDeg)}`,
          sub: `Width ${fmt(t.widthBottom)} → ${fmt(t.widthTop)} · Stock ${fmt(t.stockThickness)}`,
        }))
      : evaluated.ringMetrics.map((r) => ({
          id: r.ringId,
          title: r.isBaseDisk ? 'Base Disk (Ring 0)' : `Ring ${r.index}`,
          headline: r.isBaseDisk
            ? `Solid disk · Dia ${fmt(r.boardWidth)} · H ${fmt(r.height)}`
            : `${r.segments} segs · Miter ${formatAngle(r.miterAngleDeg)} · SEL ${fmt(r.segmentEdgeLength)} · W ${fmt(r.boardWidth)}`,
          sub: r.isBaseDisk
            ? 'Flatten one face before gluing Ring 1'
            : `Height ${fmt(r.height)} · Total strip ${fmt(r.totalLinearLength)}${r.mode === 'open' ? ` · Gap ${formatAngle(r.gapDegrees, 1)}` : ''}`,
        }));

  const completedSteps = items.reduce((acc, item) => {
    const p = project.progress[item.id];
    if (!p) return acc;
    return acc + (p.cut ? 1 : 0) + (p.dryFit ? 1 : 0) + (p.glued ? 1 : 0) + (p.flattened ? 1 : 0);
  }, 0);
  const totalSteps = Math.max(1, items.length * 4);
  const pctDone = Math.round((completedSteps / totalSteps) * 100);

  // 1:1 Story Stick SVG geometry in physical inches (1 SVG user unit = 1 inch)
  const pageMaxHeightIn = 9.5;
  const vesselHeightIn = Math.max(2, evaluated.profileHeight);
  const maxRIn = Math.max(2, evaluated.maxOuterDiameter / 2);
  const tileCount = Math.max(1, Math.ceil(vesselHeightIn / pageMaxHeightIn));
  const svgWidthIn = Math.max(6.5, maxRIn + 2.2);

  return (
    <div className="cut-sheet-stack">
      <section className="panel no-print">
        <div className="panel__header-row">
          <div>
            <h2 className="panel__heading">Shop Mode Checklist</h2>
            <p className="panel__sub">
              Progress: <span className="mono">{pctDone}%</span> ({completedSteps}/{totalSteps}{' '}
              steps)
            </p>
          </div>
          <button type="button" className="btn btn--primary" onClick={() => window.print()}>
            <Printer size={15} /> Print 1:1 Story Stick
          </button>
        </div>

        <div className="progress-track" aria-hidden="true">
          <div className="progress-fill" style={{ width: `${pctDone}%` }} />
        </div>

        <div className="checklist-stack">
          {items.map((item) => {
            const prog = project.progress[item.id] ?? {
              cut: false,
              dryFit: false,
              glued: false,
              flattened: false,
            };
            return (
              <div key={item.id} className="shop-card">
                <div className="shop-card__title">{item.title}</div>
                <div className="shop-card__headline mono">{item.headline}</div>
                <div className="shop-card__sub">{item.sub}</div>
                <div className="shop-steps">
                  {STEPS.map((st) => {
                    const checked = prog[st.key];
                    return (
                      <button
                        key={st.key}
                        type="button"
                        className={`step-btn ${checked ? 'is-done' : ''}`}
                        aria-pressed={checked}
                        onClick={() => onToggleProgress(item.id, st.key)}
                      >
                        {checked && <Check size={14} />}
                        <span>{st.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 1:1 Tiled Story Stick Printable Template */}
      <section className="panel template-container">
        <div className="panel__header-row no-print">
          <div>
            <h3 className="panel__subheading">1:1 Printable Profile Story Stick</h3>
            <p className="panel__sub">
              Print at <strong>100% / Actual Size</strong> (disable &ldquo;Fit to Page&rdquo;) and
              verify the 1&Prime; × 1&Prime; (25.4 mm) calibration square with a ruler.
            </p>
          </div>
          <span className="mono hint-text">
            {tileCount} {tileCount === 1 ? 'page' : 'pages'}
          </span>
        </div>

        <div className="story-stick-pages">
          {Array.from({ length: tileCount }, (_, tileIdx) => {
            const yMin = tileIdx * pageMaxHeightIn;
            const yMax = Math.min(vesselHeightIn + 0.5, (tileIdx + 1) * pageMaxHeightIn);
            const tileHeightIn = Math.max(3, yMax - yMin + 1);
            const originX = 0.75;
            const baselineY = tileHeightIn - 0.5;

            const toX = (r: number) => originX + r;
            const toY = (y: number) => baselineY - (y - yMin);

            const outerD = evaluated.sampler.samples
              .filter((s) => s.y >= yMin - 0.2 && s.y <= yMax + 0.2)
              .map(
                (s, i) =>
                  `${i === 0 ? 'M' : 'L'} ${toX(s.rOuter).toFixed(4)} ${toY(s.y).toFixed(4)}`,
              )
              .join(' ');
            const innerD = evaluated.sampler.samples
              .filter((s) => s.y >= yMin - 0.2 && s.y <= yMax + 0.2)
              .map(
                (s, i) =>
                  `${i === 0 ? 'M' : 'L'} ${toX(s.rInner).toFixed(4)} ${toY(s.y).toFixed(4)}`,
              )
              .join(' ');

            return (
              <div key={tileIdx} className="story-tile">
                <svg
                  className="template-svg"
                  width={`${svgWidthIn}in`}
                  height={`${tileHeightIn}in`}
                  viewBox={`0 0 ${svgWidthIn} ${tileHeightIn}`}
                  style={{ background: '#ffffff' }}
                >
                  {/* Border & Page label */}
                  <text x={0.2} y={0.3} fontSize={0.14} fill="#111111" fontFamily="monospace">
                    {project.name} — Story Stick (Page {tileIdx + 1}/{tileCount})
                  </text>

                  {/* 1" x 1" Calibration Square on Page 1 */}
                  {tileIdx === 0 && (
                    <g>
                      <rect
                        x={svgWidthIn - 1.35}
                        y={0.25}
                        width={1}
                        height={1}
                        fill="none"
                        stroke="#111111"
                        strokeWidth={0.02}
                      />
                      <text
                        x={svgWidthIn - 0.85}
                        y={0.8}
                        textAnchor="middle"
                        fontSize={0.11}
                        fill="#111111"
                        fontFamily="monospace"
                      >
                        1&quot; × 1&quot;
                      </text>
                    </g>
                  )}

                  {/* Centerline */}
                  <line
                    x1={originX}
                    y1={0.45}
                    x2={originX}
                    y2={baselineY}
                    stroke="#111111"
                    strokeWidth={0.015}
                    strokeDasharray="0.12 0.08"
                  />

                  {/* Ring elevation ticks */}
                  {evaluated.ringMetrics
                    .filter((r) => r.yTop >= yMin && r.yTop <= yMax)
                    .map((r) => (
                      <g key={r.ringId}>
                        <line
                          x1={originX}
                          y1={toY(r.yTop)}
                          x2={toX(r.rOuterGlue)}
                          y2={toY(r.yTop)}
                          stroke="#666666"
                          strokeWidth={0.01}
                        />
                        <text
                          x={toX(r.rOuterGlue) + 0.12}
                          y={toY(r.yTop) + 0.04}
                          fontSize={0.11}
                          fill="#222222"
                          fontFamily="monospace"
                        >
                          {r.isBaseDisk ? 'Base' : `R${r.index}`} ({fmt(r.yTop)})
                        </text>
                      </g>
                    ))}

                  {/* Registration crosshair at tile split */}
                  {tileCount > 1 && (
                    <g stroke="#111111" strokeWidth={0.015}>
                      <line x1={originX - 0.15} y1={0.5} x2={originX + 0.15} y2={0.5} />
                      <line x1={originX} y1={0.35} x2={originX} y2={0.65} />
                    </g>
                  )}

                  {/* True 1:1 Outer & Inner Profile Curves */}
                  {outerD && <path d={outerD} fill="none" stroke="#111111" strokeWidth={0.025} />}
                  {innerD && (
                    <path
                      d={innerD}
                      fill="none"
                      stroke="#555555"
                      strokeWidth={0.018}
                      strokeDasharray="0.08 0.06"
                    />
                  )}
                </svg>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
