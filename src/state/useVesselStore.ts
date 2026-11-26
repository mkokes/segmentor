import { useCallback, useEffect, useState } from 'react';
import { createPresetProject } from '../data/presets';
import type {
  ProfilePoint,
  RingConfig,
  RingProgress,
  ShopSettings,
  StaveTierConfig,
  VesselMode,
  VesselProject,
} from '../types/vessel';

const PROJECTS_KEY = 'segmentor.projects.v1';
const ACTIVE_ID_KEY = 'segmentor.activeProjectId.v1';

function makeId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function isValidProject(candidate: unknown): candidate is VesselProject {
  if (!candidate || typeof candidate !== 'object') return false;
  const obj = candidate as Partial<VesselProject>;
  return (
    obj.schemaVersion === 1 &&
    typeof obj.id === 'string' &&
    typeof obj.name === 'string' &&
    Array.isArray(obj.profilePoints) &&
    Array.isArray(obj.rings) &&
    Array.isArray(obj.staveTiers) &&
    Boolean(obj.settings)
  );
}

function loadInitialState(): { projects: VesselProject[]; activeId: string } {
  try {
    const raw = localStorage.getItem(PROJECTS_KEY);
    const activeStored = localStorage.getItem(ACTIVE_ID_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const valid = parsed.filter(isValidProject);
        if (valid.length > 0) {
          const match = valid.find((p) => p.id === activeStored);
          return { projects: valid, activeId: match ? match.id : valid[0]!.id };
        }
      }
    }
  } catch {
    // Fall back to default preset when storage is empty or malformed.
  }

  const starter = createPresetProject('classic-bowl');
  return { projects: [starter], activeId: starter.id };
}

export function useVesselStore() {
  const [initial] = useState(loadInitialState);
  const [projects, setProjects] = useState<VesselProject[]>(initial.projects);
  const [activeId, setActiveId] = useState<string>(initial.activeId);

  useEffect(() => {
    try {
      localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
      localStorage.setItem(ACTIVE_ID_KEY, activeId);
    } catch {
      // Ignore quota / private-mode storage errors.
    }
  }, [projects, activeId]);

  const activeProject = projects.find((p) => p.id === activeId) ?? projects[0]!;

  const updateActiveProject = useCallback(
    (updater: (prev: VesselProject) => VesselProject) => {
      setProjects((list) =>
        list.map((proj) => {
          if (proj.id !== activeProject.id) return proj;
          return {
            ...updater(proj),
            updatedAt: new Date().toISOString(),
          };
        }),
      );
    },
    [activeProject.id],
  );

  const selectProject = useCallback((projectId: string) => {
    setActiveId(projectId);
  }, []);

  const createProjectFromPreset = useCallback((presetId: string) => {
    const created = createPresetProject(presetId);
    setProjects((list) => [created, ...list]);
    setActiveId(created.id);
    return created;
  }, []);

  const duplicateActiveProject = useCallback(() => {
    const copy: VesselProject = {
      ...structuredClone(activeProject),
      id: makeId('proj'),
      name: `${activeProject.name} (Copy)`,
      updatedAt: new Date().toISOString(),
    };
    setProjects((list) => [copy, ...list]);
    setActiveId(copy.id);
  }, [activeProject]);

  const deleteProject = useCallback(
    (projectId: string) => {
      setProjects((list) => {
        if (list.length <= 1) {
          const replacement = createPresetProject('classic-bowl');
          setActiveId(replacement.id);
          return [replacement];
        }
        const remaining = list.filter((p) => p.id !== projectId);
        if (activeId === projectId && remaining[0]) {
          setActiveId(remaining[0].id);
        }
        return remaining;
      });
    },
    [activeId],
  );

  const renameProject = useCallback(
    (name: string) => {
      updateActiveProject((prev) => ({
        ...prev,
        name: name.trim() || 'Untitled Vessel',
      }));
    },
    [updateActiveProject],
  );

  const setMode = useCallback(
    (mode: VesselMode) => {
      updateActiveProject((prev) => ({
        ...prev,
        mode,
        rings:
          mode === 'closed' || mode === 'open'
            ? prev.rings.map((ring) =>
                ring.isBaseDisk
                  ? ring
                  : {
                      ...ring,
                      mode,
                      gapDegrees: mode === 'open' ? (ring.gapDegrees > 0 ? ring.gapDegrees : 5) : 0,
                    },
              )
            : prev.rings,
      }));
    },
    [updateActiveProject],
  );

  const updateSettings = useCallback(
    (patch: Partial<ShopSettings>) => {
      updateActiveProject((prev) => ({
        ...prev,
        settings: { ...prev.settings, ...patch },
      }));
    },
    [updateActiveProject],
  );

  const updateProfilePoints = useCallback(
    (points: ProfilePoint[]) => {
      updateActiveProject((prev) => ({
        ...prev,
        profilePoints: points,
      }));
    },
    [updateActiveProject],
  );

  const updateRing = useCallback(
    (ringId: string, patch: Partial<RingConfig>) => {
      updateActiveProject((prev) => ({
        ...prev,
        rings: prev.rings.map((r) => (r.id === ringId ? { ...r, ...patch } : r)),
      }));
    },
    [updateActiveProject],
  );

  const addRing = useCallback(() => {
    updateActiveProject((prev) => {
      const last = prev.rings[prev.rings.length - 1];
      const nextIndex = prev.rings.length;
      const defaultMode = prev.mode === 'open' ? 'open' : 'closed';
      const segs = last && !last.isBaseDisk ? last.segments : 16;
      const stagger = last && !last.isBaseDisk && last.rotationOffsetDeg === 0 ? 180 / segs : 0;
      const created: RingConfig = {
        id: makeId('r'),
        index: nextIndex,
        isBaseDisk: false,
        height: last ? last.height : 0.75,
        segments: segs,
        mode: defaultMode,
        gapDegrees: defaultMode === 'open' ? last?.gapDegrees || 5 : 0,
        rotationOffsetDeg: stagger,
        speciesPattern: last ? [...last.speciesPattern] : ['walnut'],
      };
      return {
        ...prev,
        rings: [...prev.rings, created],
      };
    });
  }, [updateActiveProject]);

  const removeRing = useCallback(
    (ringId: string) => {
      updateActiveProject((prev) => {
        if (prev.rings.length <= 2) return prev;
        const filtered = prev.rings
          .filter((r) => r.id !== ringId)
          .map((r, idx) => ({ ...r, index: idx }));
        return { ...prev, rings: filtered };
      });
    },
    [updateActiveProject],
  );

  const distributeRingHeights = useCallback(
    (totalHeight: number) => {
      updateActiveProject((prev) => {
        if (prev.rings.length === 0) return prev;
        const base = prev.rings[0]?.isBaseDisk ? prev.rings[0] : null;
        const nonBase = base ? prev.rings.slice(1) : prev.rings;
        if (nonBase.length === 0) return prev;
        const remaining = Math.max(0.5, totalHeight - (base?.height ?? 0));
        const eachHeight = Math.max(0.25, Number((remaining / nonBase.length).toFixed(3)));
        return {
          ...prev,
          rings: prev.rings.map((r) => (r.isBaseDisk ? r : { ...r, height: eachHeight })),
        };
      });
    },
    [updateActiveProject],
  );

  const applyBrickStagger = useCallback(() => {
    updateActiveProject((prev) => ({
      ...prev,
      rings: prev.rings.map((r, idx) =>
        r.isBaseDisk
          ? r
          : {
              ...r,
              rotationOffsetDeg: idx % 2 === 0 ? 180 / Math.max(3, r.segments) : 0,
            },
      ),
    }));
  }, [updateActiveProject]);

  const updateStaveTier = useCallback(
    (tierId: string, patch: Partial<StaveTierConfig>) => {
      updateActiveProject((prev) => ({
        ...prev,
        staveTiers: prev.staveTiers.map((t) => (t.id === tierId ? { ...t, ...patch } : t)),
      }));
    },
    [updateActiveProject],
  );

  const addStaveTier = useCallback(
    (profileHeight: number) => {
      updateActiveProject((prev) => {
        const last = prev.staveTiers[prev.staveTiers.length - 1];
        const yBottom = last ? last.yTop : 0.5;
        const yTop = Math.max(yBottom + 1, profileHeight);
        const created: StaveTierConfig = {
          id: makeId('t'),
          index: prev.staveTiers.length + 1,
          yBottom,
          yTop,
          staveCount: last?.staveCount ?? 12,
          stockThickness: last?.stockThickness ?? 1.375,
          speciesPattern: last ? [...last.speciesPattern] : ['walnut'],
        };
        return {
          ...prev,
          staveTiers: [...prev.staveTiers, created],
        };
      });
    },
    [updateActiveProject],
  );

  const removeStaveTier = useCallback(
    (tierId: string) => {
      updateActiveProject((prev) => {
        if (prev.staveTiers.length <= 1) return prev;
        const remaining = prev.staveTiers
          .filter((t) => t.id !== tierId)
          .map((t, idx) => ({ ...t, index: idx + 1 }));
        return { ...prev, staveTiers: remaining };
      });
    },
    [updateActiveProject],
  );

  const toggleProgress = useCallback(
    (itemId: string, step: keyof Omit<RingProgress, 'notes'>) => {
      updateActiveProject((prev) => {
        const current = prev.progress[itemId] ?? {
          cut: false,
          dryFit: false,
          glued: false,
          flattened: false,
        };
        return {
          ...prev,
          progress: {
            ...prev.progress,
            [itemId]: {
              ...current,
              [step]: !current[step],
            },
          },
        };
      });
    },
    [updateActiveProject],
  );

  const importProjectJson = useCallback((jsonText: string): boolean => {
    try {
      const parsed: unknown = JSON.parse(jsonText);
      if (!isValidProject(parsed)) return false;
      const imported: VesselProject = {
        ...parsed,
        id: makeId('proj'),
        updatedAt: new Date().toISOString(),
      };
      setProjects((list) => [imported, ...list]);
      setActiveId(imported.id);
      return true;
    } catch {
      return false;
    }
  }, []);

  return {
    projects,
    activeProject,
    selectProject,
    createProjectFromPreset,
    duplicateActiveProject,
    deleteProject,
    renameProject,
    setMode,
    updateSettings,
    updateProfilePoints,
    updateRing,
    addRing,
    removeRing,
    distributeRingHeights,
    applyBrickStagger,
    updateStaveTier,
    addStaveTier,
    removeStaveTier,
    toggleProgress,
    importProjectJson,
  };
}
