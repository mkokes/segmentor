import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { findSpecies } from '../data/species';
import type { ProfileSampler } from '../geometry/spline';
import { degToRad } from '../geometry/units';
import type { EvaluatedVessel } from '../geometry/vesselMetrics';
import type { VesselProject } from '../types/vessel';

interface Vessel3DViewProps {
  project: VesselProject;
  evaluated: EvaluatedVessel;
}

type ViewStyle = 'glue-up' | 'turned';

interface ProfileSlice {
  y: number;
  rIn: number;
  rOut: number;
}

function polarPoint3D(r: number, a: number, y: number): [number, number, number] {
  return [r * Math.cos(a), y, r * Math.sin(a)];
}

/**
 * Rough glue-up trapezoidal prism (flat sides, outward-verified normals).
 */
function createHexPrismGeometry(
  b0: [number, number, number],
  b1: [number, number, number],
  b2: [number, number, number],
  b3: [number, number, number],
  t0: [number, number, number],
  t1: [number, number, number],
  t2: [number, number, number],
  t3: [number, number, number],
): THREE.BufferGeometry {
  // b0 (in-a0), b1 (out-a0), b2 (out-a1), b3 (in-a1)
  // t0 (in-a0), t1 (out-a0), t2 (out-a1), t3 (in-a1)
  const positions: number[] = [];
  const pushTri = (
    a: [number, number, number],
    b: [number, number, number],
    c: [number, number, number],
  ) => {
    positions.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
  };
  const pushQuad = (
    a: [number, number, number],
    b: [number, number, number],
    c: [number, number, number],
    d: [number, number, number],
  ) => {
    pushTri(a, b, c);
    pushTri(a, c, d);
  };

  // Outward normals verified via right-hand rule at a=0:
  // Bottom (-Y), Top (+Y), Outer (+R), Inner (-R), Left miter (-A), Right miter (+A)
  pushQuad(b0, b3, b2, b1);
  pushQuad(t0, t1, t2, t3);
  pushQuad(b1, t1, t2, b2);
  pushQuad(b0, b3, t3, t0);
  pushQuad(b0, t0, t1, b1);
  pushQuad(b3, b2, t2, t3);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.computeVertexNormals();
  return geo;
}

/**
 * Sample exact turned inner & outer profile radii across [yBottom, yTop],
 * splitting cleanly at baseThickness so the interior floor stays flat.
 */
function sampleTurnedSlices(
  sampler: ProfileSampler,
  yBottom: number,
  yTop: number,
  baseThickness: number,
  steps = 8,
): ProfileSlice[] {
  const y0 = Math.max(0, yBottom);
  const y1 = Math.min(sampler.height, yTop);
  if (y1 - y0 <= 1e-4) return [];

  const ys: number[] = [];
  for (let i = 0; i <= steps; i++) {
    ys.push(y0 + ((y1 - y0) * i) / steps);
  }
  if (baseThickness > y0 + 1e-3 && baseThickness < y1 - 1e-3) {
    ys.push(baseThickness - 1e-4, baseThickness);
    ys.sort((a, b) => a - b);
  }

  return ys.map((y) => {
    const rOut = Math.max(0.02, sampler.rOuterAtY(y));
    const rIn = Math.min(rOut - 0.01, Math.max(0, sampler.rInnerAtY(y)));
    return { y, rIn, rOut };
  });
}

/**
 * Curved turned wedge for a single segment or stave spanning [a0, a1]
 * along the sampled Bezier profile slices. Each face group uses separate
 * triangles/normals so curved lathe walls are smooth while miter/rim edges
 * remain razor-sharp with zero inter-segment color bleeding.
 */
function createTurnedWedgeGeometry(
  slices: ProfileSlice[],
  a0: number,
  a1: number,
  arcSteps = 5,
): THREE.BufferGeometry {
  const positions: number[] = [];
  const pushTri = (
    a: [number, number, number],
    b: [number, number, number],
    c: [number, number, number],
  ) => {
    positions.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
  };
  const pushQuad = (
    a: [number, number, number],
    b: [number, number, number],
    c: [number, number, number],
    d: [number, number, number],
  ) => {
    pushTri(a, b, c);
    pushTri(a, c, d);
  };

  const angles: number[] = [];
  for (let j = 0; j <= arcSteps; j++) {
    angles.push(a0 + ((a1 - a0) * j) / arcSteps);
  }

  for (let i = 0; i < slices.length - 1; i++) {
    const s0 = slices[i]!;
    const s1 = slices[i + 1]!;

    for (let j = 0; j < angles.length - 1; j++) {
      const th0 = angles[j]!;
      const th1 = angles[j + 1]!;

      // Outer curved wall (+R)
      pushQuad(
        polarPoint3D(s0.rOut, th0, s0.y),
        polarPoint3D(s1.rOut, th0, s1.y),
        polarPoint3D(s1.rOut, th1, s1.y),
        polarPoint3D(s0.rOut, th1, s0.y),
      );

      // Inner curved wall (-R) when hollow
      if (s0.rIn > 1e-4 || s1.rIn > 1e-4) {
        pushQuad(
          polarPoint3D(s0.rIn, th0, s0.y),
          polarPoint3D(s0.rIn, th1, s0.y),
          polarPoint3D(s1.rIn, th1, s1.y),
          polarPoint3D(s1.rIn, th0, s1.y),
        );
      }
    }

    // Left end cap (-A at a0) & Right end cap (+A at a1)
    pushQuad(
      polarPoint3D(s0.rIn, a0, s0.y),
      polarPoint3D(s1.rIn, a0, s1.y),
      polarPoint3D(s1.rOut, a0, s1.y),
      polarPoint3D(s0.rOut, a0, s0.y),
    );
    pushQuad(
      polarPoint3D(s0.rIn, a1, s0.y),
      polarPoint3D(s0.rOut, a1, s0.y),
      polarPoint3D(s1.rOut, a1, s1.y),
      polarPoint3D(s1.rIn, a1, s1.y),
    );
  }

  // Bottom cap (-Y) & Top cap (+Y)
  const first = slices[0]!;
  const last = slices[slices.length - 1]!;
  for (let j = 0; j < angles.length - 1; j++) {
    const th0 = angles[j]!;
    const th1 = angles[j + 1]!;
    pushQuad(
      polarPoint3D(first.rIn, th0, first.y),
      polarPoint3D(first.rIn, th1, first.y),
      polarPoint3D(first.rOut, th1, first.y),
      polarPoint3D(first.rOut, th0, first.y),
    );
    pushQuad(
      polarPoint3D(last.rIn, th0, last.y),
      polarPoint3D(last.rOut, th0, last.y),
      polarPoint3D(last.rOut, th1, last.y),
      polarPoint3D(last.rIn, th1, last.y),
    );
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.computeVertexNormals();
  return geo;
}

function disposeGroup(group: THREE.Group) {
  group.traverse((obj) => {
    if (obj instanceof THREE.Mesh || obj instanceof THREE.LineSegments) {
      obj.geometry.dispose();
      if (Array.isArray(obj.material)) {
        for (const m of obj.material) m.dispose();
      } else {
        obj.material.dispose();
      }
    }
  });
  group.clear();
}

export function Vessel3DView({ project, evaluated }: Vessel3DViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [viewStyle, setViewStyle] = useState<ViewStyle>('glue-up');
  const [cutaway, setCutaway] = useState<boolean>(false);
  const [showSeams, setShowSeams] = useState<boolean>(true);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = Math.max(300, container.clientWidth);
    const height = 420;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 200);

    const vesselHeight = Math.max(3, evaluated.profileHeight);
    const maxRadius = Math.max(3, evaluated.maxOuterDiameter / 2);
    const dist = Math.max(vesselHeight, maxRadius * 2) * 1.95;
    camera.position.set(dist * 0.72, vesselHeight * 0.85, dist * 0.78);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, vesselHeight * 0.45, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.update();

    // Warm workshop 3-point lighting
    const hemi = new THREE.HemisphereLight(0xfff4e4, 0x3b2a1e, 1.05);
    scene.add(hemi);
    const keyLight = new THREE.DirectionalLight(0xfff1dc, 1.35);
    keyLight.position.set(12, 18, 14);
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0xd9a066, 0.55);
    rimLight.position.set(-14, 10, -10);
    scene.add(rimLight);

    // Subtle lathe turntable disc
    const plinthGeo = new THREE.CylinderGeometry(maxRadius * 1.3, maxRadius * 1.3, 0.08, 48);
    const plinthMat = new THREE.MeshStandardMaterial({
      color: 0x3d2d22,
      roughness: 0.9,
      metalness: 0.05,
      transparent: true,
      opacity: 0.25,
    });
    const plinth = new THREE.Mesh(plinthGeo, plinthMat);
    plinth.position.y = -0.05;
    scene.add(plinth);

    const vesselGroup = new THREE.Group();
    scene.add(vesselGroup);

    const seamMat = new THREE.LineBasicMaterial({
      color: 0x1c1410,
      transparent: true,
      opacity: viewStyle === 'turned' ? 0.28 : 0.38,
    });

    const materialCache = new Map<string, THREE.MeshStandardMaterial>();
    const getSpeciesMaterial = (speciesId: string, doubleSided = false) => {
      const key = `${speciesId}:${doubleSided ? '2' : '1'}:${viewStyle}`;
      const existing = materialCache.get(key);
      if (existing) return existing;
      const species = findSpecies(project.speciesLibrary, speciesId);
      const mat = new THREE.MeshStandardMaterial({
        color: species.colorHex,
        roughness: viewStyle === 'turned' ? 0.42 : 0.58,
        metalness: 0.03,
        side: doubleSided ? THREE.DoubleSide : THREE.FrontSide,
      });
      materialCache.set(key, mat);
      return mat;
    };

    const edgeThresholdDeg = viewStyle === 'turned' ? 22 : 1;

    if (project.mode === 'stave') {
      if (viewStyle === 'turned' && project.settings.baseThickness > 0.05) {
        const baseSlices = sampleTurnedSlices(
          evaluated.sampler,
          0,
          project.settings.baseThickness,
          project.settings.baseThickness,
          6,
        );
        if (baseSlices.length >= 2) {
          const basePts: THREE.Vector2[] = [new THREE.Vector2(0, baseSlices[0]!.y)];
          for (const s of baseSlices) basePts.push(new THREE.Vector2(s.rOut, s.y));
          basePts.push(new THREE.Vector2(0, baseSlices[baseSlices.length - 1]!.y));
          const baseGeo = new THREE.LatheGeometry(basePts, 64, 0, cutaway ? Math.PI : Math.PI * 2);
          const firstSpecies = project.staveTiers[0]?.speciesPattern[0] ?? 'white-oak';
          vesselGroup.add(new THREE.Mesh(baseGeo, getSpeciesMaterial(firstSpecies, cutaway)));
        }
      }

      for (const tier of evaluated.staveMetrics) {
        const cfg = project.staveTiers.find((t) => t.id === tier.tierId);
        const pattern = cfg?.speciesPattern.length ? cfg.speciesPattern : ['white-oak'];
        const halfSector = Math.PI / tier.staveCount;
        const cosHalf = Math.cos(halfSector);

        const rOutBotV = tier.rOuterBottom / cosHalf;
        const rOutTopV = tier.rOuterTop / cosHalf;
        const rInBotV = Math.max(0.05, tier.rInnerBottom / cosHalf);
        const rInTopV = Math.max(0.05, tier.rInnerTop / cosHalf);

        const turnedSlices =
          viewStyle === 'turned'
            ? sampleTurnedSlices(
                evaluated.sampler,
                tier.yBottom,
                tier.yTop,
                project.settings.baseThickness,
                10,
              )
            : [];

        for (let s = 0; s < tier.staveCount; s++) {
          const aCenter = (s + 0.5) * (2 * halfSector);
          if (cutaway && Math.sin(aCenter) < -0.001) continue;

          const a0 = aCenter - halfSector;
          const a1 = aCenter + halfSector;
          const spId = pattern[s % pattern.length] ?? 'white-oak';

          const geo =
            viewStyle === 'turned'
              ? turnedSlices.length >= 2
                ? createTurnedWedgeGeometry(turnedSlices, a0, a1, 5)
                : null
              : createHexPrismGeometry(
                  polarPoint3D(rInBotV, a0, tier.yBottom),
                  polarPoint3D(rOutBotV, a0, tier.yBottom),
                  polarPoint3D(rOutBotV, a1, tier.yBottom),
                  polarPoint3D(rInBotV, a1, tier.yBottom),
                  polarPoint3D(rInTopV, a0, tier.yTop),
                  polarPoint3D(rOutTopV, a0, tier.yTop),
                  polarPoint3D(rOutTopV, a1, tier.yTop),
                  polarPoint3D(rInTopV, a1, tier.yTop),
                );
          if (!geo) continue;

          vesselGroup.add(new THREE.Mesh(geo, getSpeciesMaterial(spId)));
          if (showSeams) {
            vesselGroup.add(
              new THREE.LineSegments(new THREE.EdgesGeometry(geo, edgeThresholdDeg), seamMat),
            );
          }
        }
      }
    } else {
      // Closed or Open segmented rings (both Glue-Up and Turned views preserve exact ring geometry & open gaps)
      for (const ring of evaluated.ringMetrics) {
        const cfg = project.rings.find((r) => r.id === ring.ringId);
        const pattern = cfg?.speciesPattern.length ? cfg.speciesPattern : ['maple'];

        if (ring.isBaseDisk) {
          const spId = pattern[0] ?? 'walnut';
          if (viewStyle === 'turned') {
            const baseSlices = sampleTurnedSlices(
              evaluated.sampler,
              ring.yBottom,
              ring.yTop,
              project.settings.baseThickness,
              6,
            );
            if (baseSlices.length >= 2) {
              const basePts: THREE.Vector2[] = [new THREE.Vector2(0, baseSlices[0]!.y)];
              for (const s of baseSlices) basePts.push(new THREE.Vector2(s.rOut, s.y));
              const topSlice = baseSlices[baseSlices.length - 1]!;
              basePts.push(new THREE.Vector2(topSlice.rIn, topSlice.y));
              if (topSlice.rIn > 0)
                basePts.push(new THREE.Vector2(0, project.settings.baseThickness));
              const geo = new THREE.LatheGeometry(basePts, 64, 0, cutaway ? Math.PI : Math.PI * 2);
              vesselGroup.add(new THREE.Mesh(geo, getSpeciesMaterial(spId, cutaway)));
            }
          } else {
            const geo = new THREE.CylinderGeometry(
              ring.rOuterGlue,
              ring.rOuterGlue,
              ring.height,
              48,
              1,
              false,
              0,
              cutaway ? Math.PI : Math.PI * 2,
            );
            const mesh = new THREE.Mesh(geo, getSpeciesMaterial(spId, cutaway));
            mesh.position.y = ring.yBottom + ring.height / 2;
            vesselGroup.add(mesh);
          }
          continue;
        }

        const pitchRad = (2 * Math.PI) / ring.segments;
        const halfSweepRad = degToRad(ring.miterAngleDeg);
        const cosHalf = Math.max(0.2, Math.cos(halfSweepRad));
        const rOutV = ring.rOuterGlue / cosHalf;
        const rInV = Math.max(0.05, ring.rInnerGlue / cosHalf);
        const offsetRad = degToRad(cfg?.rotationOffsetDeg ?? 0);

        const turnedSlices =
          viewStyle === 'turned'
            ? sampleTurnedSlices(
                evaluated.sampler,
                ring.yBottom,
                ring.yTop,
                project.settings.baseThickness,
                6,
              )
            : [];

        for (let s = 0; s < ring.segments; s++) {
          const aCenter = offsetRad + (s + 0.5) * pitchRad;
          if (cutaway && Math.sin(aCenter) < -0.001) continue;

          const a0 = aCenter - halfSweepRad;
          const a1 = aCenter + halfSweepRad;
          const spId = pattern[s % pattern.length] ?? 'maple';

          const geo =
            viewStyle === 'turned'
              ? turnedSlices.length >= 2
                ? createTurnedWedgeGeometry(turnedSlices, a0, a1, 5)
                : null
              : createHexPrismGeometry(
                  polarPoint3D(rInV, a0, ring.yBottom),
                  polarPoint3D(rOutV, a0, ring.yBottom),
                  polarPoint3D(rOutV, a1, ring.yBottom),
                  polarPoint3D(rInV, a1, ring.yBottom),
                  polarPoint3D(rInV, a0, ring.yTop),
                  polarPoint3D(rOutV, a0, ring.yTop),
                  polarPoint3D(rOutV, a1, ring.yTop),
                  polarPoint3D(rInV, a1, ring.yTop),
                );
          if (!geo) continue;

          vesselGroup.add(new THREE.Mesh(geo, getSpeciesMaterial(spId)));
          if (showSeams) {
            vesselGroup.add(
              new THREE.LineSegments(new THREE.EdgesGeometry(geo, edgeThresholdDeg), seamMat),
            );
          }
        }
      }
    }

    let animId = 0;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!container) return;
      const nextW = Math.max(300, container.clientWidth);
      camera.aspect = nextW / height;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(nextW, height);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      controls.dispose();
      disposeGroup(vesselGroup);
      for (const mat of materialCache.values()) mat.dispose();
      plinthGeo.dispose();
      plinthMat.dispose();
      seamMat.dispose();
      renderer.dispose();
    };
  }, [project, evaluated, viewStyle, cutaway, showSeams]);

  return (
    <section className="panel">
      <div className="panel__header-row">
        <div>
          <h2 className="panel__heading">3D Vessel Preview</h2>
          <p className="panel__sub">
            Drag to orbit, pinch or scroll to zoom. Switch between rough glue-up segments and the
            turned silhouette.
          </p>
        </div>
        <div className="chip-row">
          <div className="segmented-control">
            <button
              type="button"
              className={`segmented-control__btn ${viewStyle === 'glue-up' ? 'is-active' : ''}`}
              onClick={() => setViewStyle('glue-up')}
            >
              Glue-Up
            </button>
            <button
              type="button"
              className={`segmented-control__btn ${viewStyle === 'turned' ? 'is-active' : ''}`}
              onClick={() => setViewStyle('turned')}
            >
              Turned
            </button>
          </div>
          <button
            type="button"
            className={`chip ${cutaway ? 'chip--active' : ''}`}
            onClick={() => setCutaway((v) => !v)}
          >
            180° Cutaway
          </button>
          <button
            type="button"
            className={`chip ${showSeams ? 'chip--active' : ''}`}
            onClick={() => setShowSeams((v) => !v)}
          >
            Seams
          </button>
        </div>
      </div>

      <div ref={containerRef} className="viewport-3d" />
    </section>
  );
}
