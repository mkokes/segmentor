import {
  Box,
  CheckSquare,
  Download,
  FolderOpen,
  Layers,
  PenTool,
  Plus,
  Table2,
  Trash2,
  Upload,
} from 'lucide-react';
import { lazy, Suspense, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { ThemeToggle } from './components/common/ThemeToggle';
import { CrossSectionView } from './components/CrossSectionView';
import { CutSheetView } from './components/CutSheetView';
import { ProfileEditor } from './components/ProfileEditor';
import { ShopModeView } from './components/ShopModeView';
import { evaluateVessel } from './geometry/vesselMetrics';
import { useVesselStore } from './state/useVesselStore';

const Vessel3DView = lazy(() =>
  import('./components/Vessel3DView').then((m) => ({ default: m.Vessel3DView })),
);

type ActiveTab = 'profile' | 'rings' | '3d' | 'cutsheet' | 'shop';

export function App() {
  const store = useVesselStore();
  const [activeTab, setActiveTab] = useState<ActiveTab>('profile');
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const project = store.activeProject;
  const evaluated = useMemo(() => evaluateVessel(project), [project]);

  const issueCount = evaluated.errorCount + evaluated.warningCount;

  const cycleUnitDisplay = () => {
    const { unit, displayMode } = project.settings;
    if (unit === 'in' && displayMode === 'fraction') {
      store.updateSettings({ unit: 'in', displayMode: 'decimal' });
    } else if (unit === 'in' && displayMode === 'decimal') {
      store.updateSettings({ unit: 'mm', displayMode: 'decimal' });
    } else {
      store.updateSettings({ unit: 'in', displayMode: 'fraction' });
    }
  };

  const unitButtonLabel =
    project.settings.unit === 'mm'
      ? 'mm'
      : project.settings.displayMode === 'fraction'
        ? 'in (frac)'
        : 'in (dec)';

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(project, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name.toLowerCase().replaceAll(/\s+/g, '-')}.segmentor.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    store.importProjectJson(text);
    e.target.value = '';
    setProjectMenuOpen(false);
  };

  return (
    <>
      <header className="app-header no-print">
        <div className="brand">
          <span className="brand__title">Segmentor</span>
          <span className="brand__tag">Would? By Marty</span>
        </div>

        <div className="header-actions">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => setProjectMenuOpen((v) => !v)}
            aria-expanded={projectMenuOpen}
          >
            <FolderOpen size={15} />
            <span className="project-name-pill">{project.name}</span>
          </button>

          <button
            type="button"
            className="chip mono"
            title="Switch display units"
            onClick={cycleUnitDisplay}
          >
            {unitButtonLabel}
          </button>

          <ThemeToggle />
        </div>
      </header>

      {projectMenuOpen && (
        <div className="project-drawer no-print">
          <div className="project-drawer__inner panel">
            <div className="panel__header-row">
              <div className="field" style={{ flex: 1, maxWidth: '340px' }}>
                <span>Active Vessel Name</span>
                <input
                  type="text"
                  value={project.name}
                  onChange={(e) => store.renameProject(e.target.value)}
                />
              </div>
              <div className="chip-row">
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => store.duplicateActiveProject()}
                >
                  <Plus size={14} /> Duplicate
                </button>
                <button type="button" className="btn btn--ghost" onClick={handleExportJson}>
                  <Download size={14} /> Export JSON
                </button>
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload size={14} /> Import JSON
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  className="visually-hidden"
                  onChange={handleImportFile}
                />
              </div>
            </div>

            <div className="saved-projects">
              {store.projects.map((p) => (
                <div
                  key={p.id}
                  className={`saved-project-row ${p.id === project.id ? 'is-active' : ''}`}
                >
                  <button
                    type="button"
                    className="saved-project-row__btn"
                    onClick={() => {
                      store.selectProject(p.id);
                      setProjectMenuOpen(false);
                    }}
                  >
                    <strong>{p.name}</strong>
                    <span className="hint-text">{p.mode.toUpperCase()}</span>
                  </button>
                  {store.projects.length > 1 && (
                    <button
                      type="button"
                      className="btn btn--danger-ghost"
                      aria-label={`Delete ${p.name}`}
                      onClick={() => store.deleteProject(p.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <nav className="app-nav no-print" aria-label="Workspace Views">
        <div className="app-nav__inner">
          <button
            type="button"
            className={`nav-tab ${activeTab === 'profile' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            <PenTool size={16} />
            <span>Profile</span>
          </button>
          <button
            type="button"
            className={`nav-tab ${activeTab === 'rings' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('rings')}
          >
            <Layers size={16} />
            <span>{project.mode === 'stave' ? 'Staves' : 'Rings'}</span>
            {issueCount > 0 && (
              <span
                className={`badge ${evaluated.errorCount > 0 ? 'badge--error' : 'badge--warn'}`}
              >
                {issueCount}
              </span>
            )}
          </button>
          <button
            type="button"
            className={`nav-tab ${activeTab === '3d' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('3d')}
          >
            <Box size={16} />
            <span>3D</span>
          </button>
          <button
            type="button"
            className={`nav-tab ${activeTab === 'cutsheet' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('cutsheet')}
          >
            <Table2 size={16} />
            <span>Cut Sheet</span>
          </button>
          <button
            type="button"
            className={`nav-tab ${activeTab === 'shop' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('shop')}
          >
            <CheckSquare size={16} />
            <span>Shop</span>
          </button>
        </div>
      </nav>

      <main className="app-main">
        {activeTab === 'profile' && (
          <ProfileEditor
            project={project}
            evaluated={evaluated}
            onSetMode={store.setMode}
            onUpdateProfilePoints={store.updateProfilePoints}
            onUpdateSettings={store.updateSettings}
            onLoadPreset={(presetId) => store.createProjectFromPreset(presetId)}
          />
        )}

        {activeTab === 'rings' && (
          <CrossSectionView
            project={project}
            evaluated={evaluated}
            onUpdateRing={store.updateRing}
            onAddRing={store.addRing}
            onRemoveRing={store.removeRing}
            onDistributeHeights={store.distributeRingHeights}
            onApplyBrickStagger={store.applyBrickStagger}
            onUpdateStaveTier={store.updateStaveTier}
            onAddStaveTier={store.addStaveTier}
            onRemoveStaveTier={store.removeStaveTier}
          />
        )}

        {activeTab === '3d' && (
          <Suspense fallback={<div className="panel">Loading 3D preview…</div>}>
            <Vessel3DView project={project} evaluated={evaluated} />
          </Suspense>
        )}

        {activeTab === 'cutsheet' && <CutSheetView project={project} evaluated={evaluated} />}

        {activeTab === 'shop' && (
          <ShopModeView
            project={project}
            evaluated={evaluated}
            onToggleProgress={store.toggleProgress}
          />
        )}
      </main>
    </>
  );
}

export default App;
