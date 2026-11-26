import { Copy, Download, Printer } from 'lucide-react';
import { useState } from 'react';
import { findSpecies } from '../data/species';
import { formatAngle, formatDimension } from '../geometry/units';
import type { EvaluatedVessel } from '../geometry/vesselMetrics';
import type { VesselProject } from '../types/vessel';

interface CutSheetViewProps {
  project: VesselProject;
  evaluated: EvaluatedVessel;
}

export function CutSheetView({ project, evaluated }: CutSheetViewProps) {
  const [copied, setCopied] = useState(false);
  const { unit, displayMode, fractionPrecision } = project.settings;

  const fmt = (inches: number) => formatDimension(inches, unit, displayMode, fractionPrecision);

  const exportCsv = () => {
    const lines: string[] = [];
    if (project.mode === 'stave') {
      lines.push(
        'Tier,YBottom,YTop,Staves,Length,TiltDeg,BladeBevelDeg,MiterGaugeDeg,WidthBottom,WidthTop,MinStock,StockThickness,TotalLinear',
      );
      for (const t of evaluated.staveMetrics) {
        lines.push(
          [
            t.index,
            fmt(t.yBottom),
            fmt(t.yTop),
            t.staveCount,
            fmt(t.staveLength),
            t.tiltAngleDeg.toFixed(2),
            t.bevelAngleDeg.toFixed(2),
            t.miterAngleDeg.toFixed(2),
            fmt(t.widthBottom),
            fmt(t.widthTop),
            fmt(t.minRequiredThickness),
            fmt(t.stockThickness),
            fmt(t.totalLinearLength),
          ]
            .map((v) => `"${String(v).replaceAll('"', '""')}"`)
            .join(','),
        );
      }
    } else {
      lines.push(
        'Ring,Type,Height,Segments,MiterDeg,GapDeg,OuterRadius,InnerRadius,SEL,BoardWidth,StripLength,Species',
      );
      for (const r of evaluated.ringMetrics) {
        const spNames = r.stripCuts
          .map(
            (c) => `${findSpecies(project.speciesLibrary, c.speciesId).name} (${c.segmentCount})`,
          )
          .join(' + ');
        lines.push(
          [
            r.index,
            r.isBaseDisk ? 'Base Disk' : r.mode,
            fmt(r.height),
            r.segments,
            r.miterAngleDeg.toFixed(2),
            r.gapDegrees.toFixed(2),
            fmt(r.rOuterGlue),
            fmt(r.rInnerGlue),
            fmt(r.segmentEdgeLength),
            fmt(r.boardWidth),
            fmt(r.totalLinearLength),
            spNames,
          ]
            .map((v) => `"${String(v).replaceAll('"', '""')}"`)
            .join(','),
        );
      }
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${project.name.toLowerCase().replaceAll(/\s+/g, '-')}-cut-sheet.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const copySummary = async () => {
    const lines = [
      `${project.name} (${project.mode.toUpperCase()})`,
      `Max OD: ${fmt(evaluated.maxOuterDiameter)} | Height: ${fmt(evaluated.profileHeight)}`,
      '',
    ];
    if (project.mode === 'stave') {
      for (const t of evaluated.staveMetrics) {
        lines.push(
          `Tier ${t.index}: ${t.staveCount} staves | Len ${fmt(t.staveLength)} | Bevel ${formatAngle(t.bevelAngleDeg)} | Miter ${formatAngle(t.miterAngleDeg)} | W ${fmt(t.widthBottom)}->${fmt(t.widthTop)}`,
        );
      }
    } else {
      for (const r of evaluated.ringMetrics) {
        lines.push(
          r.isBaseDisk
            ? `Base Disk: Dia ${fmt(r.boardWidth)} x H ${fmt(r.height)}`
            : `Ring ${r.index}: ${r.segments} segs | Miter ${formatAngle(r.miterAngleDeg)} | SEL ${fmt(r.segmentEdgeLength)} | Strip W ${fmt(r.boardWidth)} | Len ${fmt(r.totalLinearLength)}`,
        );
      }
    }
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard blocked in restricted context.
    }
  };

  const speciesList = Object.values(evaluated.speciesSummary.bySpecies);

  return (
    <div className="cut-sheet-stack">
      <section className="panel">
        <div className="panel__header-row">
          <div>
            <h2 className="panel__heading">Cut Sheet</h2>
            <p className="panel__sub">
              Saw kerf: <span className="mono">{fmt(project.settings.sawKerf)}</span> · Turning
              allowance: <span className="mono">{fmt(project.settings.turningAllowanceOut)}</span>{' '}
              out / <span className="mono">{fmt(project.settings.turningAllowanceIn)}</span> in
            </p>
          </div>
          <div className="chip-row no-print">
            <button type="button" className="btn btn--ghost" onClick={copySummary}>
              <Copy size={15} /> {copied ? 'Copied!' : 'Copy'}
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => window.print()}>
              <Printer size={15} /> Print
            </button>
            <button type="button" className="btn btn--primary" onClick={exportCsv}>
              <Download size={15} /> CSV
            </button>
          </div>
        </div>

        <div className="table-scroll">
          {project.mode === 'stave' ? (
            <table className="cut-table">
              <thead>
                <tr>
                  <th>Tier</th>
                  <th>Staves</th>
                  <th>Length</th>
                  <th>Tilt</th>
                  <th>Blade Bevel</th>
                  <th>Miter Gauge</th>
                  <th>Bottom → Top W</th>
                  <th>Min Stock</th>
                  <th>Your Stock</th>
                </tr>
              </thead>
              <tbody>
                {evaluated.staveMetrics.map((t) => (
                  <tr key={t.tierId} className={`row-status--${t.status}`}>
                    <td className="mono">T{t.index}</td>
                    <td className="mono">{t.staveCount}</td>
                    <td className="mono">{fmt(t.staveLength)}</td>
                    <td className="mono">{formatAngle(t.tiltAngleDeg)}</td>
                    <td className="mono">{formatAngle(t.bevelAngleDeg)}</td>
                    <td className="mono">{formatAngle(t.miterAngleDeg)}</td>
                    <td className="mono">
                      {fmt(t.widthBottom)} → {fmt(t.widthTop)}
                    </td>
                    <td className="mono">{fmt(t.minRequiredThickness)}</td>
                    <td className="mono">{fmt(t.stockThickness)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="cut-table">
              <thead>
                <tr>
                  <th>Ring</th>
                  <th>H</th>
                  <th>Segs</th>
                  <th>Miter</th>
                  {project.mode === 'open' && <th>Gap / Index</th>}
                  <th>SEL (Outer)</th>
                  <th>Strip Width</th>
                  <th>Outer Dia</th>
                  <th>Strip Length</th>
                  <th>Species</th>
                </tr>
              </thead>
              <tbody>
                {evaluated.ringMetrics.map((r) => (
                  <tr key={r.ringId}>
                    <td className="mono">{r.isBaseDisk ? 'Base' : `R${r.index}`}</td>
                    <td className="mono">{fmt(r.height)}</td>
                    <td className="mono">{r.segments}</td>
                    <td className="mono">{r.isBaseDisk ? '—' : formatAngle(r.miterAngleDeg)}</td>
                    {project.mode === 'open' && (
                      <td className="mono">
                        {r.mode === 'open'
                          ? `${formatAngle(r.gapDegrees, 1)} / ${formatAngle(r.indexingAngleDeg, 1)}`
                          : 'Closed'}
                      </td>
                    )}
                    <td className="mono">{fmt(r.segmentEdgeLength)}</td>
                    <td className="mono">{fmt(r.boardWidth)}</td>
                    <td className="mono">{fmt(r.rOuterGlue * 2)}</td>
                    <td className="mono">{fmt(r.totalLinearLength)}</td>
                    <td>
                      <div className="species-tags">
                        {r.stripCuts.map((c) => {
                          const sp = findSpecies(project.speciesLibrary, c.speciesId);
                          return (
                            <span key={c.speciesId} className="species-mini">
                              <span className="swatch" style={{ backgroundColor: sp.colorHex }} />
                              <span>
                                {sp.name} ×{c.segmentCount}
                              </span>
                            </span>
                          );
                        })}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="panel">
        <h3 className="panel__subheading">
          Lumber &amp; Board-Foot Summary ({evaluated.speciesSummary.grandTotalBoardFeet.toFixed(2)}{' '}
          BF total)
        </h3>
        <div className="stat-grid">
          {speciesList.map((sp) => (
            <div key={sp.speciesId} className="stat-card">
              <div className="species-mini" style={{ marginBottom: '0.35rem' }}>
                <span className="swatch" style={{ backgroundColor: sp.colorHex }} />
                <span className="stat-card__label">{sp.speciesName}</span>
              </div>
              <div className="stat-card__value">{sp.totalBoardFeet.toFixed(2)} BF</div>
              <div className="hint-text mono">
                {fmt(sp.totalLinearInches)} linear
                {sp.estimatedCost !== null ? ` · ~$${sp.estimatedCost.toFixed(2)}` : ''}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
