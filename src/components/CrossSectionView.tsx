import { AlertTriangle, CheckCircle2, Plus, Trash2, XOctagon } from 'lucide-react';
import { useState } from 'react';
import { findSpecies } from '../data/species';
import { gapDegreesFromOpenPercent, openPercentFromGapDegrees } from '../geometry/openRing';
import { formatAngle, formatDimension, fromInches, toInches } from '../geometry/units';
import type { EvaluatedVessel } from '../geometry/vesselMetrics';
import type { RingConfig, StaveTierConfig, VesselProject } from '../types/vessel';

interface CrossSectionViewProps {
  project: VesselProject;
  evaluated: EvaluatedVessel;
  onUpdateRing: (ringId: string, patch: Partial<RingConfig>) => void;
  onAddRing: () => void;
  onRemoveRing: (ringId: string) => void;
  onDistributeHeights: (totalHeight: number) => void;
  onApplyBrickStagger: () => void;
  onUpdateStaveTier: (tierId: string, patch: Partial<StaveTierConfig>) => void;
  onAddStaveTier: (profileHeight: number) => void;
  onRemoveStaveTier: (tierId: string) => void;
}

const SEGMENT_PRESETS = [8, 12, 16, 18, 24, 32, 36];
const STAVE_THICKNESS_PRESETS = [
  { label: '4/4 (0.75")', val: 0.75 },
  { label: '5/4 (1.0")', val: 1.0 },
  { label: '6/4 (1.25")', val: 1.25 },
  { label: '8/4 (1.75")', val: 1.75 },
];

function statusRank(s: 'safe' | 'warn' | 'error'): number {
  return s === 'error' ? 2 : s === 'warn' ? 1 : 0;
}

function toggleSpeciesInPattern(currentPattern: string[], speciesId: string): string[] {
  if (currentPattern.includes(speciesId)) {
    const next = currentPattern.filter((id) => id !== speciesId);
    return next.length > 0 ? next : [speciesId];
  }
  return [...currentPattern, speciesId];
}

export function CrossSectionView({
  project,
  evaluated,
  onUpdateRing,
  onAddRing,
  onRemoveRing,
  onDistributeHeights,
  onApplyBrickStagger,
  onUpdateStaveTier,
  onAddStaveTier,
  onRemoveStaveTier,
}: CrossSectionViewProps) {
  const [selectedRingId, setSelectedRingId] = useState<string>(
    project.rings[1]?.id ?? project.rings[0]?.id ?? '',
  );
  const [selectedTierId, setSelectedTierId] = useState<string>(project.staveTiers[0]?.id ?? '');

  const selectedRing = project.rings.find((r) => r.id === selectedRingId) ?? project.rings[0];
  const selectedRingMetrics = evaluated.ringMetrics.find((m) => m.ringId === selectedRing?.id);
  const selectedTier =
    project.staveTiers.find((t) => t.id === selectedTierId) ?? project.staveTiers[0];
  const selectedTierMetrics = evaluated.staveMetrics.find((m) => m.tierId === selectedTier?.id);

  const { unit, displayMode, fractionPrecision } = project.settings;

  // Full symmetric cross-section SVG bounds
  const svgW = 540;
  const svgH = 440;
  const maxR = Math.max(
    6,
    evaluated.maxOuterDiameter / 2 + project.settings.turningAllowanceOut + 0.5,
    ...evaluated.ringMetrics.map((r) => r.rOuterGlue + 0.3),
  );
  const maxY = Math.max(
    6,
    evaluated.profileHeight + 0.5,
    evaluated.ringMetrics.reduce((s, r) => s + r.height, 0) + 0.5,
  );

  const scale = Math.min((svgW - 60) / (maxR * 2), (svgH - 56) / maxY);
  const cx = svgW / 2;
  const baseY = svgH - 28;
  const sx = (rSigned: number) => cx + rSigned * scale;
  const sy = (y: number) => baseY - y * scale;

  const rightOuterPath = evaluated.sampler.samples
    .map((s, i) => `${i === 0 ? 'M' : 'L'} ${sx(s.rOuter).toFixed(2)} ${sy(s.y).toFixed(2)}`)
    .join(' ');
  const leftOuterPath = evaluated.sampler.samples
    .map((s, i) => `${i === 0 ? 'M' : 'L'} ${sx(-s.rOuter).toFixed(2)} ${sy(s.y).toFixed(2)}`)
    .join(' ');
  const rightInnerPath = evaluated.sampler.samples
    .map((s, i) => `${i === 0 ? 'M' : 'L'} ${sx(s.rInner).toFixed(2)} ${sy(s.y).toFixed(2)}`)
    .join(' ');
  const leftInnerPath = evaluated.sampler.samples
    .map((s, i) => `${i === 0 ? 'M' : 'L'} ${sx(-s.rInner).toFixed(2)} ${sy(s.y).toFixed(2)}`)
    .join(' ');

  const ringDiagnostics = evaluated.ringOverlaps;
  const worstOverlapByRing = new Map<string, 'safe' | 'warn' | 'error'>();
  for (const d of ringDiagnostics) {
    const curLower = worstOverlapByRing.get(d.lowerRingId) ?? 'safe';
    if (statusRank(d.status) > statusRank(curLower))
      worstOverlapByRing.set(d.lowerRingId, d.status);
    const curUpper = worstOverlapByRing.get(d.upperRingId) ?? 'safe';
    if (statusRank(d.status) > statusRank(curUpper))
      worstOverlapByRing.set(d.upperRingId, d.status);
  }

  return (
    <div className="workspace-grid">
      <section className="panel">
        <div className="panel__header-row">
          <div>
            <h2 className="panel__heading">
              {project.mode === 'stave' ? 'Stave Cross-Section' : 'Ring Cross-Section'}
            </h2>
            <p className="panel__sub">
              Tap any {project.mode === 'stave' ? 'stave tier' : 'ring'} to inspect &amp; edit. Red
              or amber outlines mark blow-through or low-bond risks.
            </p>
          </div>
          {project.mode !== 'stave' ? (
            <div className="chip-row">
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => onDistributeHeights(evaluated.profileHeight)}
              >
                Fit Height
              </button>
              <button type="button" className="btn btn--ghost" onClick={onApplyBrickStagger}>
                Stagger
              </button>
              <button type="button" className="btn btn--primary" onClick={onAddRing}>
                <Plus size={15} /> Ring
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => onAddStaveTier(evaluated.profileHeight)}
            >
              <Plus size={15} /> Stave Tier
            </button>
          )}
        </div>

        <div className="svg-stage">
          <svg viewBox={`0 0 ${svgW} ${svgH}`} className="profile-svg">
            <line x1={cx} y1={16} x2={cx} y2={baseY} className="svg-centerline" />
            <line x1={20} y1={baseY} x2={svgW - 20} y2={baseY} className="svg-axis" />

            {project.mode !== 'stave'
              ? evaluated.ringMetrics.map((m, idx) => {
                  const cfg = project.rings[idx];
                  const species = findSpecies(
                    project.speciesLibrary,
                    cfg?.speciesPattern[0] ?? 'maple',
                  );
                  const status = worstOverlapByRing.get(m.ringId) ?? 'safe';
                  const isSelected = m.ringId === selectedRing?.id;
                  const yTopPx = sy(m.yTop);
                  const hPx = Math.max(2, (m.yTop - m.yBottom) * scale);

                  const strokeClass =
                    status === 'error'
                      ? 'ring-stroke--error'
                      : status === 'warn'
                        ? 'ring-stroke--warn'
                        : isSelected
                          ? 'ring-stroke--selected'
                          : 'ring-stroke--normal';

                  if (m.isBaseDisk) {
                    const xL = sx(-m.rOuterGlue);
                    const w = m.rOuterGlue * 2 * scale;
                    return (
                      <g
                        key={m.ringId}
                        style={{ cursor: 'pointer' }}
                        onClick={() => setSelectedRingId(m.ringId)}
                      >
                        <rect
                          x={xL}
                          y={yTopPx}
                          width={w}
                          height={hPx}
                          fill={species.colorHex}
                          fillOpacity={0.55}
                          className={strokeClass}
                        />
                        <text
                          x={cx}
                          y={yTopPx + hPx / 2 + 4}
                          textAnchor="middle"
                          className="svg-ring-tag"
                        >
                          Base
                        </text>
                      </g>
                    );
                  }

                  const wOneSide = Math.max(2, (m.rOuterGlue - m.rInnerGlue) * scale);
                  return (
                    <g
                      key={m.ringId}
                      style={{ cursor: 'pointer' }}
                      onClick={() => setSelectedRingId(m.ringId)}
                    >
                      <rect
                        x={sx(-m.rOuterGlue)}
                        y={yTopPx}
                        width={wOneSide}
                        height={hPx}
                        fill={species.colorHex}
                        fillOpacity={0.6}
                        className={strokeClass}
                      />
                      <rect
                        x={sx(m.rInnerGlue)}
                        y={yTopPx}
                        width={wOneSide}
                        height={hPx}
                        fill={species.colorHex}
                        fillOpacity={0.6}
                        className={strokeClass}
                      />
                      <text
                        x={sx(m.rOuterGlue) + 8}
                        y={yTopPx + hPx / 2 + 4}
                        className="svg-ring-tag"
                      >
                        R{m.index}
                      </text>
                    </g>
                  );
                })
              : evaluated.staveMetrics.map((t, idx) => {
                  const cfg = project.staveTiers[idx];
                  const species = findSpecies(
                    project.speciesLibrary,
                    cfg?.speciesPattern[0] ?? 'white-oak',
                  );
                  const isSelected = t.tierId === selectedTier?.id;
                  const strokeClass =
                    t.status === 'error'
                      ? 'ring-stroke--error'
                      : t.status === 'warn'
                        ? 'ring-stroke--warn'
                        : isSelected
                          ? 'ring-stroke--selected'
                          : 'ring-stroke--normal';

                  const rightPoly = [
                    `${sx(t.rInnerBottom)},${sy(t.yBottom)}`,
                    `${sx(t.rOuterBottom)},${sy(t.yBottom)}`,
                    `${sx(t.rOuterTop)},${sy(t.yTop)}`,
                    `${sx(t.rInnerTop)},${sy(t.yTop)}`,
                  ].join(' ');
                  const leftPoly = [
                    `${sx(-t.rInnerBottom)},${sy(t.yBottom)}`,
                    `${sx(-t.rOuterBottom)},${sy(t.yBottom)}`,
                    `${sx(-t.rOuterTop)},${sy(t.yTop)}`,
                    `${sx(-t.rInnerTop)},${sy(t.yTop)}`,
                  ].join(' ');

                  return (
                    <g
                      key={t.tierId}
                      style={{ cursor: 'pointer' }}
                      onClick={() => setSelectedTierId(t.tierId)}
                    >
                      <polygon
                        points={rightPoly}
                        fill={species.colorHex}
                        fillOpacity={0.55}
                        className={strokeClass}
                      />
                      <polygon
                        points={leftPoly}
                        fill={species.colorHex}
                        fillOpacity={0.55}
                        className={strokeClass}
                      />
                    </g>
                  );
                })}

            {/* Finished turned vessel profile overlay */}
            <path d={rightOuterPath} fill="none" className="svg-outer-wall" />
            <path d={leftOuterPath} fill="none" className="svg-outer-wall" />
            <path d={rightInnerPath} fill="none" className="svg-inner-wall" />
            <path d={leftInnerPath} fill="none" className="svg-inner-wall" />
          </svg>
        </div>

        {/* Diagnostics List */}
        <div className="diag-list">
          {project.mode !== 'stave' ? (
            ringDiagnostics.filter((d) => d.status !== 'safe').length === 0 ? (
              <div className="diag-item diag-item--safe">
                <CheckCircle2 size={16} /> All {evaluated.ringMetrics.length} rings have safe glue
                overlap.
              </div>
            ) : (
              ringDiagnostics
                .filter((d) => d.status !== 'safe')
                .map((d) => (
                  <div
                    key={`${d.lowerRingId}-${d.upperRingId}`}
                    className={`diag-item diag-item--${d.status}`}
                  >
                    {d.status === 'error' ? <XOctagon size={16} /> : <AlertTriangle size={16} />}
                    <span>{d.message}</span>
                  </div>
                ))
            )
          ) : evaluated.staveMetrics.every((t) => t.status === 'safe') ? (
            <div className="diag-item diag-item--safe">
              <CheckCircle2 size={16} /> All stave tiers have safe stock thickness &amp; bow
              clearance.
            </div>
          ) : (
            evaluated.staveMetrics
              .filter((t) => t.status !== 'safe')
              .map((t) => (
                <div key={t.tierId} className={`diag-item diag-item--${t.status}`}>
                  {t.status === 'error' ? <XOctagon size={16} /> : <AlertTriangle size={16} />}
                  <span>{t.warningMessage}</span>
                </div>
              ))
          )}
        </div>
      </section>

      <aside className="side-stack">
        {project.mode !== 'stave' && selectedRing && selectedRingMetrics && (
          <section className="panel">
            <div className="panel__header-row">
              <h3 className="panel__subheading">
                {selectedRing.isBaseDisk ? 'Base Disk (Ring 0)' : `Ring ${selectedRing.index}`}
              </h3>
              {!selectedRing.isBaseDisk && project.rings.length > 2 && (
                <button
                  type="button"
                  className="btn btn--danger-ghost"
                  onClick={() => onRemoveRing(selectedRing.id)}
                >
                  <Trash2 size={14} /> Delete
                </button>
              )}
            </div>

            <div className="form-grid">
              <label className="field">
                <span>Height ({unit})</span>
                <input
                  type="number"
                  step={unit === 'mm' ? 1 : 0.0625}
                  min={0.125}
                  value={Number(fromInches(selectedRing.height, unit).toFixed(3))}
                  onChange={(e) =>
                    onUpdateRing(selectedRing.id, {
                      height: Math.max(0.125, toInches(Number(e.target.value), unit)),
                    })
                  }
                />
              </label>

              {!selectedRing.isBaseDisk && (
                <label className="field">
                  <span>Segments</span>
                  <input
                    type="number"
                    min={3}
                    max={72}
                    value={selectedRing.segments}
                    onChange={(e) =>
                      onUpdateRing(selectedRing.id, {
                        segments: Math.max(3, Math.round(Number(e.target.value))),
                      })
                    }
                  />
                </label>
              )}
            </div>

            {!selectedRing.isBaseDisk && (
              <>
                <div className="chip-row" style={{ marginTop: '0.65rem' }}>
                  {SEGMENT_PRESETS.map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={`chip ${selectedRing.segments === n ? 'chip--active' : ''}`}
                      onClick={() => onUpdateRing(selectedRing.id, { segments: n })}
                    >
                      {n}
                    </button>
                  ))}
                </div>

                <div className="segmented-control" style={{ marginTop: '0.85rem' }}>
                  <button
                    type="button"
                    className={`segmented-control__btn ${selectedRing.mode === 'closed' ? 'is-active' : ''}`}
                    onClick={() => onUpdateRing(selectedRing.id, { mode: 'closed', gapDegrees: 0 })}
                  >
                    Closed
                  </button>
                  <button
                    type="button"
                    className={`segmented-control__btn ${selectedRing.mode === 'open' ? 'is-active' : ''}`}
                    onClick={() =>
                      onUpdateRing(selectedRing.id, {
                        mode: 'open',
                        gapDegrees: selectedRing.gapDegrees > 0 ? selectedRing.gapDegrees : 5,
                      })
                    }
                  >
                    Open Segment
                  </button>
                </div>

                {selectedRing.mode === 'open' && (
                  <div className="form-grid" style={{ marginTop: '0.75rem' }}>
                    <label className="field">
                      <span>Gap Angle (°)</span>
                      <input
                        type="number"
                        step={0.5}
                        min={0.5}
                        max={Math.floor(360 / selectedRing.segments - 2)}
                        value={Number(selectedRing.gapDegrees.toFixed(2))}
                        onChange={(e) =>
                          onUpdateRing(selectedRing.id, {
                            gapDegrees: Math.max(0.5, Number(e.target.value)),
                          })
                        }
                      />
                    </label>
                    <label className="field">
                      <span>Open (%)</span>
                      <input
                        type="number"
                        step={1}
                        min={2}
                        max={75}
                        value={Math.round(
                          openPercentFromGapDegrees(selectedRing.segments, selectedRing.gapDegrees),
                        )}
                        onChange={(e) =>
                          onUpdateRing(selectedRing.id, {
                            gapDegrees: gapDegreesFromOpenPercent(
                              selectedRing.segments,
                              Number(e.target.value),
                            ),
                          })
                        }
                      />
                    </label>
                  </div>
                )}

                <div className="form-grid" style={{ marginTop: '0.75rem' }}>
                  <label className="field field--full">
                    <span>Rotation Offset (°)</span>
                    <input
                      type="number"
                      step={0.5}
                      value={Number(selectedRing.rotationOffsetDeg.toFixed(2))}
                      onChange={(e) =>
                        onUpdateRing(selectedRing.id, {
                          rotationOffsetDeg: Number(e.target.value),
                        })
                      }
                    />
                  </label>
                </div>
              </>
            )}

            <h4 className="panel__subheading" style={{ marginTop: '0.9rem' }}>
              Wood Species Pattern
            </h4>
            <p className="hint-text">Tap species in order to cycle around segments.</p>
            <div className="species-picker">
              {project.speciesLibrary.map((sp) => {
                const active = selectedRing.speciesPattern.includes(sp.id);
                return (
                  <button
                    key={sp.id}
                    type="button"
                    className={`species-pill ${active ? 'is-active' : ''}`}
                    onClick={() =>
                      onUpdateRing(selectedRing.id, {
                        speciesPattern: toggleSpeciesInPattern(selectedRing.speciesPattern, sp.id),
                      })
                    }
                  >
                    <span className="swatch" style={{ backgroundColor: sp.colorHex }} />
                    <span>{sp.name}</span>
                  </button>
                );
              })}
            </div>

            <div className="stat-grid stat-grid--compact" style={{ marginTop: '0.9rem' }}>
              <div className="stat-card">
                <div className="stat-card__label">Miter Angle</div>
                <div className="stat-card__value">
                  {formatAngle(selectedRingMetrics.miterAngleDeg)}
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-card__label">SEL / Length</div>
                <div className="stat-card__value">
                  {formatDimension(
                    selectedRingMetrics.segmentEdgeLength,
                    unit,
                    displayMode,
                    fractionPrecision,
                  )}
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-card__label">Strip Width</div>
                <div className="stat-card__value">
                  {formatDimension(
                    selectedRingMetrics.boardWidth,
                    unit,
                    displayMode,
                    fractionPrecision,
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {project.mode === 'stave' && selectedTier && selectedTierMetrics && (
          <section className="panel">
            <div className="panel__header-row">
              <h3 className="panel__subheading">Stave Tier {selectedTier.index}</h3>
              {project.staveTiers.length > 1 && (
                <button
                  type="button"
                  className="btn btn--danger-ghost"
                  onClick={() => onRemoveStaveTier(selectedTier.id)}
                >
                  <Trash2 size={14} /> Delete
                </button>
              )}
            </div>

            <div className="form-grid">
              <label className="field">
                <span>Y Bottom ({unit})</span>
                <input
                  type="number"
                  step={unit === 'mm' ? 1 : 0.125}
                  min={0}
                  value={Number(fromInches(selectedTier.yBottom, unit).toFixed(3))}
                  onChange={(e) =>
                    onUpdateStaveTier(selectedTier.id, {
                      yBottom: Math.max(0, toInches(Number(e.target.value), unit)),
                    })
                  }
                />
              </label>
              <label className="field">
                <span>Y Top ({unit})</span>
                <input
                  type="number"
                  step={unit === 'mm' ? 1 : 0.125}
                  min={0.5}
                  value={Number(fromInches(selectedTier.yTop, unit).toFixed(3))}
                  onChange={(e) =>
                    onUpdateStaveTier(selectedTier.id, {
                      yTop: Math.max(
                        selectedTier.yBottom + 0.25,
                        toInches(Number(e.target.value), unit),
                      ),
                    })
                  }
                />
              </label>
              <label className="field">
                <span>Staves (N)</span>
                <input
                  type="number"
                  min={4}
                  max={48}
                  value={selectedTier.staveCount}
                  onChange={(e) =>
                    onUpdateStaveTier(selectedTier.id, {
                      staveCount: Math.max(4, Math.round(Number(e.target.value))),
                    })
                  }
                />
              </label>
              <label className="field">
                <span>Stock Thickness ({unit})</span>
                <input
                  type="number"
                  step={unit === 'mm' ? 1 : 0.125}
                  min={0.25}
                  value={Number(fromInches(selectedTier.stockThickness, unit).toFixed(3))}
                  onChange={(e) =>
                    onUpdateStaveTier(selectedTier.id, {
                      stockThickness: Math.max(0.25, toInches(Number(e.target.value), unit)),
                    })
                  }
                />
              </label>
            </div>

            <div className="chip-row" style={{ marginTop: '0.65rem' }}>
              {STAVE_THICKNESS_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  className={`chip ${Math.abs(selectedTier.stockThickness - p.val) < 0.01 ? 'chip--active' : ''}`}
                  onClick={() => onUpdateStaveTier(selectedTier.id, { stockThickness: p.val })}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <h4 className="panel__subheading" style={{ marginTop: '0.9rem' }}>
              Wood Species Pattern
            </h4>
            <div className="species-picker">
              {project.speciesLibrary.map((sp) => {
                const active = selectedTier.speciesPattern.includes(sp.id);
                return (
                  <button
                    key={sp.id}
                    type="button"
                    className={`species-pill ${active ? 'is-active' : ''}`}
                    onClick={() =>
                      onUpdateStaveTier(selectedTier.id, {
                        speciesPattern: toggleSpeciesInPattern(selectedTier.speciesPattern, sp.id),
                      })
                    }
                  >
                    <span className="swatch" style={{ backgroundColor: sp.colorHex }} />
                    <span>{sp.name}</span>
                  </button>
                );
              })}
            </div>

            <div className="stat-grid stat-grid--compact" style={{ marginTop: '0.9rem' }}>
              <div className="stat-card">
                <div className="stat-card__label">Blade Bevel</div>
                <div className="stat-card__value">
                  {formatAngle(selectedTierMetrics.bevelAngleDeg)}
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-card__label">Miter Gauge</div>
                <div className="stat-card__value">
                  {formatAngle(selectedTierMetrics.miterAngleDeg)}
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-card__label">Min Stock Needed</div>
                <div className="stat-card__value">
                  {formatDimension(
                    selectedTierMetrics.minRequiredThickness,
                    unit,
                    displayMode,
                    fractionPrecision,
                  )}
                </div>
              </div>
            </div>
          </section>
        )}
      </aside>
    </div>
  );
}
