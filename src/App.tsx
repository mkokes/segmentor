import { useMemo } from 'react';
import { ThemeToggle } from './components/common/ThemeToggle';
import { calculateClosedRing } from './geometry/closedRing';
import { calculateOpenRing } from './geometry/openRing';
import { buildProfileSampler } from './geometry/spline';
import { calculateStaveTier } from './geometry/stave';
import { formatAngle, formatDimension } from './geometry/units';
import type { ProfilePoint, ShopSettings } from './types/vessel';

const SAMPLE_BOWL: ProfilePoint[] = [
  { id: 'p0', r: 2.25, y: 0, handleIn: { dr: 0, dy: 0 }, handleOut: { dr: 1.2, dy: 0.8 } },
  { id: 'p1', r: 4.75, y: 4.0, handleIn: { dr: -0.4, dy: -1.4 }, handleOut: { dr: 0, dy: 0 } },
];

const SAMPLE_SETTINGS: ShopSettings = {
  unit: 'in',
  displayMode: 'fraction',
  fractionPrecision: 32,
  sawKerf: 0.125,
  endTrimAllowance: 1,
  turningAllowanceOut: 0.125,
  turningAllowanceIn: 0.125,
  wallThickness: 0.45,
  baseThickness: 0.5,
};

export function App() {
  const summary = useMemo(() => {
    const sampler = buildProfileSampler(SAMPLE_BOWL, SAMPLE_SETTINGS);
    const closed = calculateClosedRing(
      {
        id: 'r1',
        index: 1,
        isBaseDisk: false,
        height: 0.75,
        segments: 16,
        mode: 'closed',
        gapDegrees: 0,
        rotationOffsetDeg: 11.25,
        speciesPattern: ['walnut', 'maple'],
      },
      1.0,
      sampler,
      SAMPLE_SETTINGS,
    );
    const open = calculateOpenRing(
      {
        id: 'r2',
        index: 2,
        isBaseDisk: false,
        height: 0.75,
        segments: 18,
        mode: 'open',
        gapDegrees: 5,
        rotationOffsetDeg: 10,
        speciesPattern: ['cherry'],
      },
      1.75,
      sampler,
      SAMPLE_SETTINGS,
    );
    const stave = calculateStaveTier(
      {
        id: 's1',
        index: 1,
        yBottom: 0.5,
        yTop: 4.0,
        staveCount: 12,
        stockThickness: 1.25,
        speciesPattern: ['walnut'],
      },
      sampler,
      SAMPLE_SETTINGS,
    );
    return { closed, open, stave };
  }, []);

  return (
    <>
      <header className="app-header">
        <div className="brand">
          <span className="brand__title">Segmentor</span>
          <span className="brand__tag">Woodturning Studio</span>
        </div>
        <ThemeToggle />
      </header>

      <main className="app-main">
        <section className="panel">
          <h1 className="panel__heading">Geometry Kernel Ready (M1)</h1>
          <p className="panel__sub">
            Closed-ring, open-ring, and compound stave math verified. Interactive Profile,
            Cross-Section, 3D Preview, Cut Sheet, and Shop Mode views build next.
          </p>

          <div className="stat-grid">
            <div className="stat-card">
              <div className="stat-card__label">16-Seg Closed Miter</div>
              <div className="stat-card__value">{formatAngle(summary.closed.miterAngleDeg)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-card__label">Closed SEL</div>
              <div className="stat-card__value">
                {formatDimension(summary.closed.segmentEdgeLength, 'in', 'fraction', 32)}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-card__label">18-Seg Open Miter (5° gap)</div>
              <div className="stat-card__value">{formatAngle(summary.open.miterAngleDeg)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-card__label">12-Stave Compound Bevel</div>
              <div className="stat-card__value">{formatAngle(summary.stave.bevelAngleDeg)}</div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}

export default App;
