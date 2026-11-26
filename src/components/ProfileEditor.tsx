import { Plus, Trash2 } from 'lucide-react';
import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { VESSEL_PRESETS } from '../data/presets';
import type { EvaluatedVessel } from '../geometry/vesselMetrics';
import { formatDimension, fromInches, toInches } from '../geometry/units';
import type { ProfilePoint, ShopSettings, VesselMode, VesselProject } from '../types/vessel';

interface ProfileEditorProps {
  project: VesselProject;
  evaluated: EvaluatedVessel;
  onSetMode: (mode: VesselMode) => void;
  onUpdateProfilePoints: (points: ProfilePoint[]) => void;
  onUpdateSettings: (patch: Partial<ShopSettings>) => void;
  onLoadPreset: (presetId: string) => void;
}

type DragTarget =
  | { kind: 'anchor'; pointId: string }
  | { kind: 'handleIn'; pointId: string }
  | { kind: 'handleOut'; pointId: string };

const SVG_W = 520;
const SVG_H = 440;
const PAD_LEFT = 56;
const PAD_RIGHT = 24;
const PAD_TOP = 24;
const PAD_BOTTOM = 38;

export function ProfileEditor({
  project,
  evaluated,
  onSetMode,
  onUpdateProfilePoints,
  onUpdateSettings,
  onLoadPreset,
}: ProfileEditorProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [selectedId, setSelectedId] = useState<string>(
    project.profilePoints[project.profilePoints.length - 1]?.id ?? 'p0',
  );
  const [dragTarget, setDragTarget] = useState<DragTarget | null>(null);
  const [snapGrid, setSnapGrid] = useState<boolean>(true);

  const maxR = Math.max(
    7,
    ...project.profilePoints.map((p) => Math.max(p.r, p.r + p.handleOut.dr, p.r + p.handleIn.dr)),
  );
  const maxY = Math.max(8, ...project.profilePoints.map((p) => p.y)) + 1;
  const viewSpan = Math.max(maxR + 1.5, maxY);

  const scale = Math.min(
    (SVG_W - PAD_LEFT - PAD_RIGHT) / (viewSpan * 1.1),
    (SVG_H - PAD_TOP - PAD_BOTTOM) / viewSpan,
  );
  const originX = PAD_LEFT;
  const originY = SVG_H - PAD_BOTTOM;

  const toSvgX = (r: number) => originX + r * scale;
  const toSvgY = (y: number) => originY - y * scale;

  const fromClient = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { r: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const px = ((clientX - rect.left) / rect.width) * SVG_W;
    const py = ((clientY - rect.top) / rect.height) * SVG_H;
    let r = (px - originX) / scale;
    let y = (originY - py) / scale;
    if (snapGrid) {
      const step = project.settings.unit === 'mm' ? toInches(5, 'mm') : 0.125;
      r = Math.round(r / step) * step;
      y = Math.round(y / step) * step;
    }
    return { r, y };
  };

  const sortedPoints = project.profilePoints.toSorted((a, b) => a.y - b.y);
  const selectedPoint =
    sortedPoints.find((p) => p.id === selectedId) ?? sortedPoints[sortedPoints.length - 1];

  const handlePointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!dragTarget) return;
    const { r, y } = fromClient(e.clientX, e.clientY);

    const next = sortedPoints.map((pt, idx) => {
      if (pt.id !== dragTarget.pointId) return pt;

      if (dragTarget.kind === 'anchor') {
        const clampedR = Math.max(0.5, Math.min(18, r));
        if (idx === 0) {
          return { ...pt, r: clampedR, y: 0 };
        }
        const prevY = sortedPoints[idx - 1]?.y ?? 0;
        const nextY = sortedPoints[idx + 1]?.y ?? 24;
        const clampedY = Math.max(prevY + 0.4, Math.min(nextY - 0.4, y));
        return {
          ...pt,
          r: clampedR,
          y: idx === sortedPoints.length - 1 ? Math.max(prevY + 0.5, y) : clampedY,
        };
      }

      if (dragTarget.kind === 'handleOut') {
        return {
          ...pt,
          handleOut: {
            dr: r - pt.r,
            dy: Math.max(0.05, y - pt.y),
          },
        };
      }

      return {
        ...pt,
        handleIn: {
          dr: r - pt.r,
          dy: Math.min(-0.05, y - pt.y),
        },
      };
    });

    onUpdateProfilePoints(next);
  };

  const addPoint = () => {
    if (sortedPoints.length < 2) return;
    const last = sortedPoints[sortedPoints.length - 1]!;
    const prev = sortedPoints[sortedPoints.length - 2]!;
    const midR = Number(((prev.r + last.r) / 2).toFixed(3));
    const midY = Number(((prev.y + last.y) / 2).toFixed(3));
    const id = `p-${Date.now().toString(36)}`;
    const nextPt: ProfilePoint = {
      id,
      r: midR,
      y: midY,
      handleIn: { dr: 0, dy: -0.6 },
      handleOut: { dr: 0, dy: 0.6 },
    };
    const updated = [...sortedPoints.slice(0, -1), nextPt, last];
    onUpdateProfilePoints(updated);
    setSelectedId(id);
  };

  const removeSelectedPoint = () => {
    if (!selectedPoint || sortedPoints.length <= 2) return;
    if (selectedPoint.id === sortedPoints[0]?.id) return;
    const filtered = sortedPoints.filter((p) => p.id !== selectedPoint.id);
    onUpdateProfilePoints(filtered);
    setSelectedId(filtered[filtered.length - 1]?.id ?? 'p0');
  };

  const updateSelectedCoord = (field: 'r' | 'y', displayValue: number) => {
    if (!selectedPoint || !Number.isFinite(displayValue)) return;
    const inchesVal = toInches(displayValue, project.settings.unit);
    const idx = sortedPoints.findIndex((p) => p.id === selectedPoint.id);
    const updated = sortedPoints.map((pt, i) => {
      if (i !== idx) return pt;
      if (field === 'r') return { ...pt, r: Math.max(0.4, inchesVal) };
      if (i === 0) return { ...pt, y: 0 };
      const minY = (sortedPoints[i - 1]?.y ?? 0) + 0.4;
      const maxAllow = i === sortedPoints.length - 1 ? 36 : (sortedPoints[i + 1]?.y ?? 36) - 0.4;
      return { ...pt, y: Math.max(minY, Math.min(maxAllow, inchesVal)) };
    });
    onUpdateProfilePoints(updated);
  };

  // Build SVG paths for outer curve, inner wall, and outer turning allowance envelope
  const outerPathD = evaluated.sampler.samples
    .map(
      (s, idx) =>
        `${idx === 0 ? 'M' : 'L'} ${toSvgX(s.rOuter).toFixed(2)} ${toSvgY(s.y).toFixed(2)}`,
    )
    .join(' ');

  const innerPathD = evaluated.sampler.samples
    .map(
      (s, idx) =>
        `${idx === 0 ? 'M' : 'L'} ${toSvgX(s.rInner).toFixed(2)} ${toSvgY(s.y).toFixed(2)}`,
    )
    .join(' ');

  const allowOutPathD = evaluated.sampler.samples
    .map(
      (s, idx) =>
        `${idx === 0 ? 'M' : 'L'} ${toSvgX(s.rOuter + project.settings.turningAllowanceOut).toFixed(2)} ${toSvgY(s.y).toFixed(2)}`,
    )
    .join(' ');

  const { unit, displayMode, fractionPrecision } = project.settings;

  const gridLines: number[] = [];
  for (let g = 1; g <= Math.ceil(viewSpan); g++) {
    gridLines.push(g);
  }

  return (
    <div className="workspace-grid">
      <section className="panel">
        <div className="panel__header-row">
          <div>
            <h2 className="panel__heading">Vessel Profile</h2>
            <p className="panel__sub">
              Drag anchors &amp; Bezier handles to sculpt the half-profile. Right side shows
              finished outer radius, inner wall, and turning allowance.
            </p>
          </div>
          <div className="chip-row">
            <button
              type="button"
              className={`chip ${snapGrid ? 'chip--active' : ''}`}
              onClick={() => setSnapGrid((v) => !v)}
            >
              Snap {snapGrid ? 'On' : 'Off'}
            </button>
            <button type="button" className="btn btn--ghost" onClick={addPoint}>
              <Plus size={15} /> Point
            </button>
          </div>
        </div>

        <div className="svg-stage">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${SVG_W} ${SVG_H}`}
            className="profile-svg"
            onPointerMove={handlePointerMove}
            onPointerUp={() => setDragTarget(null)}
            onPointerCancel={() => setDragTarget(null)}
          >
            {/* Grid */}
            {gridLines.map((g) => (
              <g key={`g-${g}`}>
                <line
                  x1={toSvgX(g)}
                  y1={PAD_TOP}
                  x2={toSvgX(g)}
                  y2={originY}
                  className="svg-grid"
                />
                <line
                  x1={originX}
                  y1={toSvgY(g)}
                  x2={SVG_W - PAD_RIGHT}
                  y2={toSvgY(g)}
                  className="svg-grid"
                />
                <text x={toSvgX(g)} y={originY + 16} textAnchor="middle" className="svg-axis-label">
                  {g}&Prime;
                </text>
                <text x={originX - 8} y={toSvgY(g) + 4} textAnchor="end" className="svg-axis-label">
                  {g}&Prime;
                </text>
              </g>
            ))}

            {/* Centerline */}
            <line x1={originX} y1={PAD_TOP} x2={originX} y2={originY} className="svg-centerline" />
            <line
              x1={originX}
              y1={originY}
              x2={SVG_W - PAD_RIGHT}
              y2={originY}
              className="svg-axis"
            />

            {/* Ring or Stave elevation markers */}
            {project.mode === 'stave'
              ? evaluated.staveMetrics.map((t) => (
                  <line
                    key={t.tierId}
                    x1={originX}
                    y1={toSvgY(t.yTop)}
                    x2={SVG_W - PAD_RIGHT}
                    y2={toSvgY(t.yTop)}
                    className="svg-slice-line"
                  />
                ))
              : evaluated.ringMetrics.map((r) => (
                  <line
                    key={r.ringId}
                    x1={originX}
                    y1={toSvgY(r.yTop)}
                    x2={SVG_W - PAD_RIGHT}
                    y2={toSvgY(r.yTop)}
                    className="svg-slice-line"
                  />
                ))}

            {/* Curves */}
            <path d={allowOutPathD} fill="none" className="svg-allowance" />
            <path d={innerPathD} fill="none" className="svg-inner-wall" />
            <path d={outerPathD} fill="none" className="svg-outer-wall" />

            {/* Bezier handles & anchor points */}
            {sortedPoints.map((pt, idx) => {
              const ax = toSvgX(pt.r);
              const ay = toSvgY(pt.y);
              const inX = toSvgX(pt.r + pt.handleIn.dr);
              const inY = toSvgY(pt.y + pt.handleIn.dy);
              const outX = toSvgX(pt.r + pt.handleOut.dr);
              const outY = toSvgY(pt.y + pt.handleOut.dy);
              const isSelected = pt.id === selectedPoint?.id;

              return (
                <g key={pt.id}>
                  {idx > 0 && (
                    <>
                      <line x1={ax} y1={ay} x2={inX} y2={inY} className="svg-handle-stem" />
                      <circle
                        cx={inX}
                        cy={inY}
                        r={16}
                        fill="transparent"
                        className="svg-hit"
                        onPointerDown={(e) => {
                          e.currentTarget.setPointerCapture(e.pointerId);
                          setSelectedId(pt.id);
                          setDragTarget({ kind: 'handleIn', pointId: pt.id });
                        }}
                      />
                      <circle cx={inX} cy={inY} r={5} className="svg-handle" />
                    </>
                  )}
                  {idx < sortedPoints.length - 1 && (
                    <>
                      <line x1={ax} y1={ay} x2={outX} y2={outY} className="svg-handle-stem" />
                      <circle
                        cx={outX}
                        cy={outY}
                        r={16}
                        fill="transparent"
                        className="svg-hit"
                        onPointerDown={(e) => {
                          e.currentTarget.setPointerCapture(e.pointerId);
                          setSelectedId(pt.id);
                          setDragTarget({ kind: 'handleOut', pointId: pt.id });
                        }}
                      />
                      <circle cx={outX} cy={outY} r={5} className="svg-handle" />
                    </>
                  )}

                  <circle
                    cx={ax}
                    cy={ay}
                    r={18}
                    fill="transparent"
                    className="svg-hit"
                    onPointerDown={(e) => {
                      e.currentTarget.setPointerCapture(e.pointerId);
                      setSelectedId(pt.id);
                      setDragTarget({ kind: 'anchor', pointId: pt.id });
                    }}
                  />
                  <circle
                    cx={ax}
                    cy={ay}
                    r={isSelected ? 7.5 : 6}
                    className={`svg-anchor ${isSelected ? 'svg-anchor--active' : ''}`}
                  />
                </g>
              );
            })}
          </svg>
        </div>

        <div className="stat-grid stat-grid--compact">
          <div className="stat-card">
            <div className="stat-card__label">Max Diameter</div>
            <div className="stat-card__value">
              {formatDimension(evaluated.maxOuterDiameter, unit, displayMode, fractionPrecision)}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-card__label">Profile Height</div>
            <div className="stat-card__value">
              {formatDimension(evaluated.profileHeight, unit, displayMode, fractionPrecision)}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-card__label">Wall Thickness</div>
            <div className="stat-card__value">
              {formatDimension(
                project.settings.wallThickness,
                unit,
                displayMode,
                fractionPrecision,
              )}
            </div>
          </div>
        </div>
      </section>

      <aside className="side-stack">
        <section className="panel">
          <h3 className="panel__subheading">Construction Mode</h3>
          <div className="segmented-control">
            {(
              [
                { id: 'closed', label: 'Closed Ring' },
                { id: 'open', label: 'Open Ring' },
                { id: 'stave', label: 'Stave' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={`segmented-control__btn ${project.mode === opt.id ? 'is-active' : ''}`}
                onClick={() => onSetMode(opt.id)}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <h3 className="panel__subheading" style={{ marginTop: '1rem' }}>
            Load Preset
          </h3>
          <div className="preset-list">
            {VESSEL_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className="preset-card"
                onClick={() => onLoadPreset(preset.id)}
              >
                <span className="preset-card__title">{preset.label}</span>
                <span className="preset-card__sub">{preset.subtitle}</span>
              </button>
            ))}
          </div>
        </section>

        {selectedPoint && (
          <section className="panel">
            <div className="panel__header-row">
              <h3 className="panel__subheading">Selected Point</h3>
              {sortedPoints.length > 2 && selectedPoint.id !== sortedPoints[0]?.id && (
                <button
                  type="button"
                  className="btn btn--danger-ghost"
                  onClick={removeSelectedPoint}
                >
                  <Trash2 size={14} /> Remove
                </button>
              )}
            </div>
            <div className="form-grid">
              <label className="field">
                <span>Radius ({unit})</span>
                <input
                  type="number"
                  step={unit === 'mm' ? 1 : 0.125}
                  value={Number(fromInches(selectedPoint.r, unit).toFixed(3))}
                  onChange={(e) => updateSelectedCoord('r', Number(e.target.value))}
                />
              </label>
              <label className="field">
                <span>Height Y ({unit})</span>
                <input
                  type="number"
                  step={unit === 'mm' ? 1 : 0.125}
                  disabled={selectedPoint.id === sortedPoints[0]?.id}
                  value={Number(fromInches(selectedPoint.y, unit).toFixed(3))}
                  onChange={(e) => updateSelectedCoord('y', Number(e.target.value))}
                />
              </label>
            </div>
          </section>
        )}

        <section className="panel">
          <h3 className="panel__subheading">Shop Settings</h3>
          <div className="form-grid">
            <label className="field">
              <span>Wall ({unit})</span>
              <input
                type="number"
                step={unit === 'mm' ? 1 : 0.0625}
                min={0.1}
                value={Number(fromInches(project.settings.wallThickness, unit).toFixed(3))}
                onChange={(e) =>
                  onUpdateSettings({
                    wallThickness: Math.max(0.125, toInches(Number(e.target.value), unit)),
                  })
                }
              />
            </label>
            <label className="field">
              <span>Base Floor ({unit})</span>
              <input
                type="number"
                step={unit === 'mm' ? 1 : 0.0625}
                min={0.1}
                value={Number(fromInches(project.settings.baseThickness, unit).toFixed(3))}
                onChange={(e) =>
                  onUpdateSettings({
                    baseThickness: Math.max(0.125, toInches(Number(e.target.value), unit)),
                  })
                }
              />
            </label>
            <label className="field">
              <span>Outer Allowance ({unit})</span>
              <input
                type="number"
                step={unit === 'mm' ? 0.5 : 0.0625}
                min={0}
                value={Number(fromInches(project.settings.turningAllowanceOut, unit).toFixed(3))}
                onChange={(e) =>
                  onUpdateSettings({
                    turningAllowanceOut: Math.max(0, toInches(Number(e.target.value), unit)),
                  })
                }
              />
            </label>
            <label className="field">
              <span>Inner Allowance ({unit})</span>
              <input
                type="number"
                step={unit === 'mm' ? 0.5 : 0.0625}
                min={0}
                value={Number(fromInches(project.settings.turningAllowanceIn, unit).toFixed(3))}
                onChange={(e) =>
                  onUpdateSettings({
                    turningAllowanceIn: Math.max(0, toInches(Number(e.target.value), unit)),
                  })
                }
              />
            </label>
            <label className="field">
              <span>Saw Kerf ({unit})</span>
              <input
                type="number"
                step={unit === 'mm' ? 0.2 : 0.015625}
                min={0.02}
                value={Number(fromInches(project.settings.sawKerf, unit).toFixed(4))}
                onChange={(e) =>
                  onUpdateSettings({
                    sawKerf: Math.max(0.02, toInches(Number(e.target.value), unit)),
                  })
                }
              />
            </label>
            <label className="field">
              <span>End Trim ({unit})</span>
              <input
                type="number"
                step={unit === 'mm' ? 2 : 0.25}
                min={0}
                value={Number(fromInches(project.settings.endTrimAllowance, unit).toFixed(3))}
                onChange={(e) =>
                  onUpdateSettings({
                    endTrimAllowance: Math.max(0, toInches(Number(e.target.value), unit)),
                  })
                }
              />
            </label>
          </div>
        </section>
      </aside>
    </div>
  );
}
