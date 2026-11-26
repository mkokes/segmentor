import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { findSpecies } from '../data/species';
import { degToRad } from '../geometry/units';
import type { EvaluatedVessel } from '../geometry/vesselMetrics';
import type { VesselProject } from '../types/vessel';

interface Vessel3DViewProps {
  project: VesselProject;
  evaluated: EvaluatedVessel;
}

type ViewStyle = 'glue-up' | 'turned';

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
  // Bottom quad: b0 (in-L), b1 (out-L), b2 (out-R), b3 (in-R)
  // Top quad:    t0 (in-L), t1 (out-L), t2 (out-R), t3 (in-R)
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

  // Bottom, Top, Outer, Inner, Left miter, Right miter
  pushQuad(b0, b3, b2, b1);
  pushQuad(t0, t1, t2, t3);
  pushQuad(b1, b2, t2, t1);
  pushQuad(b3, b0, t0, t3);
  pushQuad(b0, b1, t1, t0);
  pushQuad(b2, b3, t3, t2);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.computeVertexNormals();
  return geo;
}

function polarPoint3D(r: number, a: number, y: number): [number, number, number] {
  return [r * Math.cos(a), y, r * Math.sin(a)];
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
      opacity: 0.35,
    });

    if (viewStyle === 'turned') {
      const samples = evaluated.sampler.samples;
      const lathePts: THREE.Vector2[] = [new THREE.Vector2(0, 0)];
      for (const s of samples) {
        lathePts.push(new THREE.Vector2(Math.max(0.01, s.rOuter), s.y));
      }
      for (let i = samples.length - 1; i >= 0; i--) {
        const s = samples[i]!;
        if (s.y >= project.settings.baseThickness - 1e-4) {
          lathePts.push(new THREE.Vector2(Math.max(0, s.rInner), s.y));
        }
      }
      lathePts.push(new THREE.Vector2(0, project.settings.baseThickness));

      const phiLen = cutaway ? Math.PI : Math.PI * 2;
      const geo = new THREE.LatheGeometry(lathePts, 64, 0, phiLen);

      // Color vertices by height & angle using active rings/staves
      const posAttr = geo.attributes.position;
      const colors = new Float32Array(posAttr.count * 3);
      const tmpColor = new THREE.Color();

      for (let i = 0; i < posAttr.count; i++) {
        const vx = posAttr.getX(i);
        const vy = posAttr.getY(i);
        const vz = posAttr.getZ(i);
        const angleDeg = ((Math.atan2(vz, vx) * 180) / Math.PI + 360) % 360;

        let hex = '#c8843e';
        if (project.mode === 'stave') {
          const tier =
            evaluated.staveMetrics.find((t) => vy >= t.yBottom && vy <= t.yTop) ??
            evaluated.staveMetrics[0];
          const cfg = project.staveTiers.find((t) => t.id === tier?.tierId);
          if (cfg && tier) {
            const idx = Math.floor(angleDeg / (360 / tier.staveCount)) % cfg.speciesPattern.length;
            const spId = cfg.speciesPattern[idx] ?? 'white-oak';
            hex = findSpecies(project.speciesLibrary, spId).colorHex;
          }
        } else {
          const ring =
            evaluated.ringMetrics.find((r) => vy >= r.yBottom && vy <= r.yTop) ??
            evaluated.ringMetrics[evaluated.ringMetrics.length - 1];
          const cfg = project.rings.find((r) => r.id === ring?.ringId);
          if (cfg && ring) {
            if (ring.isBaseDisk) {
              hex = findSpecies(project.speciesLibrary, cfg.speciesPattern[0] ?? 'walnut').colorHex;
            } else {
              const adj = (angleDeg - cfg.rotationOffsetDeg + 360) % 360;
              const segIdx = Math.floor(adj / (360 / ring.segments));
              const spId = cfg.speciesPattern[segIdx % cfg.speciesPattern.length] ?? 'maple';
              hex = findSpecies(project.speciesLibrary, spId).colorHex;
            }
          }
        }

        tmpColor.set(hex);
        colors[i * 3] = tmpColor.r;
        colors[i * 3 + 1] = tmpColor.g;
        colors[i * 3 + 2] = tmpColor.b;
      }

      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      const mat = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.45,
        metalness: 0.04,
        side: THREE.DoubleSide,
      });
      vesselGroup.add(new THREE.Mesh(geo, mat));
    } else if (project.mode === 'stave') {
      for (const tier of evaluated.staveMetrics) {
        const cfg = project.staveTiers.find((t) => t.id === tier.tierId);
        const pattern = cfg?.speciesPattern.length ? cfg.speciesPattern : ['white-oak'];
        const halfSector = Math.PI / tier.staveCount;
        const cosHalf = Math.cos(halfSector);

        const rOutBotV = tier.rOuterBottom / cosHalf;
        const rOutTopV = tier.rOuterTop / cosHalf;
        const rInBotV = Math.max(0.05, tier.rInnerBottom / cosHalf);
        const rInTopV = Math.max(0.05, tier.rInnerTop / cosHalf);

        for (let s = 0; s < tier.staveCount; s++) {
          const aCenter = (s + 0.5) * (2 * halfSector);
          if (cutaway && Math.sin(aCenter) < -0.001) continue;

          const a0 = aCenter - halfSector;
          const a1 = aCenter + halfSector;
          const spId = pattern[s % pattern.length] ?? 'white-oak';
          const species = findSpecies(project.speciesLibrary, spId);

          const geo = createHexPrismGeometry(
            polarPoint3D(rInBotV, a0, tier.yBottom),
            polarPoint3D(rOutBotV, a0, tier.yBottom),
            polarPoint3D(rOutBotV, a1, tier.yBottom),
            polarPoint3D(rInBotV, a1, tier.yBottom),
            polarPoint3D(rInTopV, a0, tier.yTop),
            polarPoint3D(rOutTopV, a0, tier.yTop),
            polarPoint3D(rOutTopV, a1, tier.yTop),
            polarPoint3D(rInTopV, a1, tier.yTop),
          );
          const mat = new THREE.MeshStandardMaterial({
            color: species.colorHex,
            roughness: 0.58,
            metalness: 0.03,
          });
          const mesh = new THREE.Mesh(geo, mat);
          vesselGroup.add(mesh);
          if (showSeams) {
            vesselGroup.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), seamMat));
          }
        }
      }
    } else {
      // Closed or Open segmented rings
      for (const ring of evaluated.ringMetrics) {
        const cfg = project.rings.find((r) => r.id === ring.ringId);
        const pattern = cfg?.speciesPattern.length ? cfg.speciesPattern : ['maple'];

        if (ring.isBaseDisk) {
          const species = findSpecies(project.speciesLibrary, pattern[0] ?? 'walnut');
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
          const mat = new THREE.MeshStandardMaterial({
            color: species.colorHex,
            roughness: 0.58,
            side: cutaway ? THREE.DoubleSide : THREE.FrontSide,
          });
          const mesh = new THREE.Mesh(geo, mat);
          mesh.position.y = ring.yBottom + ring.height / 2;
          vesselGroup.add(mesh);
          continue;
        }

        const pitchRad = (2 * Math.PI) / ring.segments;
        const halfSweepRad = degToRad(ring.miterAngleDeg);
        const cosHalf = Math.max(0.2, Math.cos(halfSweepRad));
        const rOutV = ring.rOuterGlue / cosHalf;
        const rInV = Math.max(0.05, ring.rInnerGlue / cosHalf);
        const offsetRad = degToRad(cfg?.rotationOffsetDeg ?? 0);

        for (let s = 0; s < ring.segments; s++) {
          const aCenter = offsetRad + (s + 0.5) * pitchRad;
          if (cutaway && Math.sin(aCenter) < -0.001) continue;

          const a0 = aCenter - halfSweepRad;
          const a1 = aCenter + halfSweepRad;
          const spId = pattern[s % pattern.length] ?? 'maple';
          const species = findSpecies(project.speciesLibrary, spId);

          const geo = createHexPrismGeometry(
            polarPoint3D(rInV, a0, ring.yBottom),
            polarPoint3D(rOutV, a0, ring.yBottom),
            polarPoint3D(rOutV, a1, ring.yBottom),
            polarPoint3D(rInV, a1, ring.yBottom),
            polarPoint3D(rInV, a0, ring.yTop),
            polarPoint3D(rOutV, a0, ring.yTop),
            polarPoint3D(rOutV, a1, ring.yTop),
            polarPoint3D(rInV, a1, ring.yTop),
          );
          const mat = new THREE.MeshStandardMaterial({
            color: species.colorHex,
            roughness: 0.58,
            metalness: 0.03,
          });
          const mesh = new THREE.Mesh(geo, mat);
          vesselGroup.add(mesh);
          if (showSeams) {
            vesselGroup.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), seamMat));
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
      renderer.setSize(nextW, height);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      controls.dispose();
      disposeGroup(vesselGroup);
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
          {viewStyle === 'glue-up' && (
            <button
              type="button"
              className={`chip ${showSeams ? 'chip--active' : ''}`}
              onClick={() => setShowSeams((v) => !v)}
            >
              Seams
            </button>
          )}
        </div>
      </div>

      <div ref={containerRef} className="viewport-3d" />
    </section>
  );
}
