/**
 * CLINICAL REASONING UI CONTROLLER
 * Reactive Controller for the Clinical Decision Support Mode
 * Author: Dr. Curro Mir / Antigravity
 */

(function () {
  'use strict';

  // UI State
  const uiState = {
    engine: null,
    currentPathwayId: null,
    pathwayDataCache: {},
    selectedRegion: null,
    mentorMode: localStorage.getItem('dolor_mentor_mode') !== 'false', // default true
    expressMode: localStorage.getItem('dolor_express_mode') === 'true', // default false
    currentStepView: null
  };

  // DOM Container references
  let containers = {
    home: null,
    clinical: null,
    library: null,
    topBar: null,
    viewHost: null,
    auxModal: null
  };

  function getHomeContainer() {
    if (!containers.home) containers.home = document.getElementById('home-screen');
    return containers.home;
  }

  function getClinicalContainer() {
    if (!containers.clinical) containers.clinical = document.getElementById('clinical-reasoning-container');
    return containers.clinical;
  }

  function getLibraryContainer() {
    if (!containers.library) containers.library = document.getElementById('library-container');
    return containers.library;
  }

  // Initialize UI Controller
  async function initClinicalUI() {
    containers.home = document.getElementById('home-screen');
    containers.clinical = document.getElementById('clinical-reasoning-container');
    containers.library = document.getElementById('library-container');

    // Preload treatments catalog if not already in window
    if (!window.TREATMENTS_CATALOG) {
      try {
        const tRes = await fetch('clinical/treatments_catalog.json?v=' + Date.now());
        if (tRes.ok) {
          window.TREATMENTS_CATALOG = await tRes.json();
        }
      } catch (e) {
        console.warn('Error loading treatments catalog:', e);
      }
    }

    // Preload coach closing catalog if not already in window
    if (!window.COACH_CATALOG) {
      try {
        const cRes = await fetch('clinical/coach_catalog.json?v=' + Date.now());
        if (cRes.ok) {
          window.COACH_CATALOG = await cRes.json();
        }
      } catch (e) {
        console.warn('Error loading coach catalog:', e);
      }
    }

    if (!containers.clinical) return;

    // Check for saved session in localStorage
    const savedSession = localStorage.getItem('dolor_last_session');
    if (savedSession) {
      try {
        const parsed = JSON.parse(savedSession);
        if (parsed && parsed.pathwayId) {
          renderRecentPathwaysList();
        }
      } catch (e) {
        console.warn('Error reading saved session:', e);
      }
    }
  }

  // ─────────────────────────────────────────────
  // 1. HOME SCREEN & SELECTORS
  // ─────────────────────────────────────────────

  function renderHomeScreen() {
    const homeEl = getHomeContainer();
    if (!homeEl) return;

    const saved = getSavedClinicalSession();
    let resumeBannerHTML = '';
    if (saved && saved.pathwayId) {
      const stepNames = {
        'red_flags': 'Banderas Rojas (Seguridad)',
        'anamnesis': 'Anamnesis Dirigida',
        'anamnesis_summary': 'Puente Diagnóstico',
        'examination': 'Exploración Física',
        'exam_summary': 'Mapa de Concordancia',
        'imaging': 'Ecografía / Imagen',
        'generator': 'Generador Diagnóstico',
        'treatment': 'Plan Terapéutico',
        'follow_up': 'Seguimiento',
        'coach': 'Cierre Coach',
        'summary': 'Resumen de Consulta'
      };
      const currentStepName = stepNames[saved.sessionState?.currentStep] || saved.sessionState?.currentStep || 'En curso';
      const timeAgoStr = new Date(saved.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      resumeBannerHTML = `
        <div class="resume-session-banner glass-panel" style="margin-bottom: 1.5rem; border-left: 4px solid var(--accent-primary, #6366f1); padding: 0.9rem 1.25rem; display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap; background: rgba(99, 102, 241, 0.08); border-radius: var(--radius-md);">
          <div>
            <div style="font-weight: 800; font-size: 0.92rem; color: var(--text-primary); display: flex; align-items: center; gap: 0.4rem;">
              <span>🔄</span> Consulta en Curso Guardada
            </div>
            <div style="font-size: 0.82rem; color: var(--text-secondary); margin-top: 0.2rem;">
              ${saved.pathwayPresentation || saved.pathwayId} — Paso actual: <strong style="color: var(--accent-primary, #818cf8);">${currentStepName}</strong> (guardado a las ${timeAgoStr})
            </div>
          </div>
          <div style="display: flex; gap: 0.5rem;">
            <button class="vade-primary-btn" style="padding: 0.45rem 0.95rem; font-size: 0.82rem; cursor: pointer;" onclick="window.ClinicalUI.resumeLastSession()">Continuar Consulta →</button>
            <button class="clinical-action-btn" style="padding: 0.45rem 0.75rem; font-size: 0.82rem; cursor: pointer;" onclick="window.ClinicalUI.discardLastSession()">Descartar</button>
          </div>
        </div>
      `;
    }

    homeEl.innerHTML = `
      <div class="home-hero-clean glass-panel">
        <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; margin-bottom: 0.75rem; flex-wrap: wrap; gap: 0.5rem;">
          <div class="home-hero-badge">🩺 SISTEMA DE APOYO AL RAZONAMIENTO CLÍNICO</div>
          <button class="home-theme-toggle-btn" onclick="window.toggleAppTheme()" style="background: var(--bg-surface); border: 1.5px solid var(--border-color); border-radius: var(--radius-full); padding: 0.35rem 0.85rem; font-size: 0.8rem; font-weight: 700; color: var(--text-primary); cursor: pointer; display: inline-flex; align-items: center; gap: 0.4rem; box-shadow: 0 1px 3px rgba(0,0,0,0.05);" title="Alternar entre modo Claro y Oscuro">
            <span id="homeThemeIcon">${(localStorage.getItem('dolor_theme') === 'dark') ? '☀️' : '🌙'}</span>
            <span id="homeThemeLabel">${(localStorage.getItem('dolor_theme') === 'dark') ? 'Modo Claro' : 'Modo Oscuro'}</span>
          </button>
        </div>
        <h1 class="home-clean-title">DOLOR</h1>
        <p class="home-clean-subtitle">Sistema de apoyo al razonamiento clínico · Dr. Curro Mir</p>
      </div>

      ${resumeBannerHTML}

      <!-- 4 GRANDES PUERTAS CLÍNICAS -->
      <div class="home-4doors-grid">
        
        <!-- PUERTA 1: CONSULTA (Alta Precisión Express 30-120s) -->
        <article class="home-door-card door-consultation" onclick="window.ClinicalUI.startConsultaExpress()">
          <div class="door-header">
            <span class="door-icon">🩺</span>
            <span class="door-pill-badge badge-express">⚡ 30–120 seg</span>
          </div>
          <h2 class="door-title">CONSULTA</h2>
          <p class="door-desc"><strong>Resolver un paciente:</strong> Modo de alta velocidad para consulta presencial. Red flags, patrón dominante, exploración discriminativa, POCUS y conducta.</p>
          <div class="door-features-pills">
            <span>⚠️ Safety First</span>
            <span>🎯 2-4 Tests Clave</span>
            <span>📋 Salida a HC</span>
          </div>
          <div class="door-cta">
            <span>Iniciar Consulta Rápida</span> <span>→</span>
          </div>
        </article>

        <!-- PUERTA 2: RAZONAMIENTO (Comprender y Profundizar) -->
        <article class="home-door-card door-reasoning" onclick="window.ClinicalUI.startRazonamientoDeep()">
          <div class="door-header">
            <span class="door-icon">🧠</span>
            <span class="door-pill-badge badge-deep">Pathways & Casos</span>
          </div>
          <h2 class="door-title">RAZONAMIENTO</h2>
          <p class="door-desc"><strong>Entender el caso:</strong> 35 vías clínicas jerarquizadas (Primary, Secondary, Safety), 9 casos clínicos simulados a ciegas, cálculo bayesiano y sesgos.</p>
          <div class="door-features-pills">
            <span>🗂️ 35 Pathways</span>
            <span>🎓 9 Casos Ciegos</span>
            <span>📊 Bayes Pre/Post</span>
          </div>
          <div class="door-cta">
            <span>Entrar a Razonamiento</span> <span>→</span>
          </div>
        </article>

        <!-- PUERTA 3: TÉCNICAS (POCUS e Intervencionismo) -->
        <article class="home-door-card door-techniques" onclick="window.ClinicalUI.switchAppMode('techniques')">
          <div class="door-header">
            <span class="door-icon">🩻</span>
            <span class="door-pill-badge badge-pocus">POCUS & Raquis</span>
          </div>
          <h2 class="door-title">TÉCNICAS</h2>
          <p class="door-desc"><strong>POCUS e intervencionismo:</strong> Ecografía dirigida en dolor, 28 técnicas de infiltraciones, protocolo epidural Notion (Dr. Curro Mir) y radiofrecuencia.</p>
          <div class="door-features-pills">
            <span>🔊 Sonoanatomía</span>
            <span>💉 Dosis & Dilución</span>
            <span>⚡ Radiofrecuencia</span>
          </div>
          <div class="door-cta">
            <span>Abrir Técnicas y Dosis</span> <span>→</span>
          </div>
        </article>

        <!-- PUERTA 4: BIBLIOTECA (Tests · Fármacos · Fichas · Vídeos) -->
        <article class="home-door-card door-library" onclick="window.ClinicalUI.switchAppMode('library')">
          <div class="door-header">
            <span class="door-icon">📚</span>
            <span class="door-pill-badge badge-library">43 Tests & Fármacos</span>
          </div>
          <h2 class="door-title">BIBLIOTECA</h2>
          <p class="door-desc"><strong>Atlas y recursos clínicos:</strong> 43 tests físicos auditados con atlas interactivo SVG, vademécum de dolor con 5 dosis clave, interacciones y videoteca HD.</p>
          <div class="door-features-pills">
            <span>🧍 Atlas SVG</span>
            <span>💊 Vademécum</span>
            <span>🎬 Vídeos HD</span>
          </div>
          <div class="door-cta">
            <span>Ver Biblioteca Completa</span> <span>→</span>
          </div>
        </article>
      </div>

      <!-- BUSCADOR UNIVERSAL DIRECTO -->
      <div class="home-universal-search-box glass-panel">
        <div class="universal-search-input-wrapper">
          <span class="search-icon">🔎</span>
          <input type="text" id="homeUniversalSearchInput" placeholder="Buscar cualquier síntoma, test, fármaco, diana o técnica..." autocomplete="off" oninput="window.ClinicalUI.handleUniversalSearch(this.value)">
          <button id="homeClearSearchBtn" class="home-search-clear-btn" style="display:none;" onclick="window.ClinicalUI.clearUniversalSearch()">&times;</button>
          <kbd class="search-kbd">/</kbd>
        </div>
        <div id="homeUniversalSearchResults" class="universal-search-results-panel" style="display:none;"></div>
      </div>

      <!-- ACCESO DIRECTO RÁPIDO A CASOS Y VÍAS MÁS FRECUENTES -->
      <div class="home-quick-pathways-panel glass-panel">
        <div class="home-quick-pathways-title">
          <span>⚡</span> <span>Vías Clínicas de Alta Frecuencia (Acceso Directo Express):</span>
        </div>
        <div class="recents-chips-list">
          <button class="recent-pathway-chip primary" onclick="window.ClinicalUI.startPathwayDirect('shoulder-lateral-pain')">
            <span>🦴</span> <span>Hombro: Manguito / Lateral</span>
          </button>
          <button class="recent-pathway-chip primary" onclick="window.ClinicalUI.startPathwayDirect('lumbar-radicular-pain')">
            <span>⚡</span> <span>Lumbar: Radiculopatía L4-S1</span>
          </button>
          <button class="recent-pathway-chip primary" onclick="window.ClinicalUI.startPathwayDirect('cervical-radicular')">
            <span>🧠</span> <span>Cervical: Radiculopatía C6/C7</span>
          </button>
          <button class="recent-pathway-chip primary" onclick="window.ClinicalUI.startPathwayDirect('knee-oa-anterior')">
            <span>🦵</span> <span>Rodilla: Gonartrosis / Menisco</span>
          </button>
          <button class="recent-pathway-chip primary" onclick="window.ClinicalUI.startPathwayDirect('hip-lateral')">
            <span>🦿</span> <span>Cadera: GTPS / Trocantérea</span>
          </button>
          <button class="recent-pathway-chip primary" onclick="window.ClinicalUI.startPathwayDirect('wrist-cts')">
            <span>🤲</span> <span>Mano: Túnel Carpiano</span>
          </button>
          <button class="recent-pathway-chip primary" onclick="window.ClinicalUI.startPathwayDirect('si-posterior-pelvic')">
            <span>🎯</span> <span>Sacroilíaca: Laslett</span>
          </button>
          <button class="recent-pathway-chip safety" onclick="window.ClinicalUI.startPathwayDirect('lumbar-nocturnal')">
            <span>🚨</span> <span>Lumbar: Alarma Nocturna</span>
          </button>
        </div>
      </div>

      <div class="safety-disclaimer-footer">
        <p><strong>AVISO MÉDICO:</strong> DOLOR es un sistema de apoyo al razonamiento clínico para facultativos. Diseñado por el Dr. Curro Mir. No sustituye el juicio clínico individual.</p>
      </div>
    `;
  }

  function renderRegionSelector() {
    const clinicalEl = getClinicalContainer();
    if (!clinicalEl) return;

    const registry = window.CLINICAL_PATHWAYS_REGISTRY || {};
    const regions = Object.keys(registry).map(k => ({ id: k, ...registry[k] }));

    clinicalEl.innerHTML = `
      <div class="reasoning-select-screen">
        <div class="reasoning-screen-header">
          <div class="home-hero-badge">Paso 1 · Identificación</div>
          <h2>¿Qué región le duele al paciente?</h2>
          <p>Selecciona la articulación o zona anatómica principal de la consulta.</p>
        </div>

        <div class="regions-cards-grid">
          ${regions.map(r => {
            const hasActive = r.presentations.some(p => p.available);
            return `
              <button class="region-choice-card ${hasActive ? 'highlighted' : ''}" onclick="window.ClinicalUI.selectRegion('${r.id}')">
                <span class="region-choice-icon">${r.icon}</span>
                <div class="region-choice-info">
                  <span class="region-choice-name">${r.label}</span>
                  <span class="region-choice-sub">${r.presentations.length} presentaciones ${hasActive ? '• ✅ Activo' : ''}</span>
                </div>
              </button>
            `;
          }).join('')}
        </div>

        <div style="text-align: center; margin-top: 2rem;">
          <button class="clinical-action-btn" onclick="window.ClinicalUI.switchAppMode('home')">
            <span>← Volver al Inicio</span>
          </button>
        </div>
      </div>
    `;
  }

  function renderPresentationSelector(regionId) {
    const clinicalEl = getClinicalContainer();
    if (!clinicalEl) return;
    uiState.selectedRegion = regionId;

    const registry = window.CLINICAL_PATHWAYS_REGISTRY || {};
    const regionObj = registry[regionId];
    if (!regionObj) return renderRegionSelector();

    // Sort presentations by clinicalPriority (Primary -> Secondary -> Safety -> Uncertain)
    const sortedPresentations = [...(regionObj.presentations || [])].sort((a, b) => {
      const pA = a.clinicalPriority !== undefined ? a.clinicalPriority : 99;
      const pB = b.clinicalPriority !== undefined ? b.clinicalPriority : 99;
      return pA - pB;
    });

    clinicalEl.innerHTML = `
      <div class="reasoning-select-screen">
        <div class="reasoning-screen-header">
          <div class="home-hero-badge">${regionObj.icon} ${regionObj.label}</div>
          <h2>¿Cuál es el patrón principal del dolor?</h2>
          <p>Selecciona la presentación clínica del paciente organizada por prioridad y seguridad médica.</p>
        </div>

        <div class="presentations-list">
          ${sortedPresentations.map(p => {
            const tier = p.visualTier || 'primary';
            const badgeLabel = p.visualLabel || (tier === 'safety' ? 'Seguridad' : (tier === 'uncertain' ? 'Cuando no encaja' : (tier === 'secondary' ? 'Menos habitual' : 'Frecuente')));
            return `
              <div class="presentation-card tier-${tier} ${p.available ? 'active-pathway' : 'disabled'}" 
                   onclick="${p.available ? `window.ClinicalUI.startPathwayDirect('${p.id}')` : `alert('Este Clinical Pathway estará disponible próximamente.')`}">
                <div class="pres-info-group">
                  <div class="pres-title-row">
                    <h4>${p.label}</h4>
                    <span class="pres-tier-badge ${tier}">${badgeLabel}</span>
                  </div>
                  <p>${p.available ? 'Clinical Pathway completo disponible (Anamnesis → Exploración → Eco → Plan)' : 'En desarrollo (Próximamente)'}</p>
                </div>
                <span class="pres-badge-status ${p.available ? 'available' : 'upcoming'}">
                  ${p.available ? '▶ Iniciar Pathway' : 'Próximamente'}
                </span>
              </div>
            `;
          }).join('')}
        </div>

        <div style="text-align: center; margin-top: 2rem;">
          <button class="clinical-action-btn" onclick="window.ClinicalUI.renderRegionSelector()">
            <span>← Cambiar de región</span>
          </button>
        </div>
      </div>
    `;
  }

  // ─────────────────────────────────────────────
  // 2. PATHWAY LAUNCHER & ORCHESTRATION
  // ─────────────────────────────────────────────

  async function startPathway(pathwayId, options = {}) {
    uiState.currentPathwayId = pathwayId;

    // 1. Immediately switch view mode to clinical (showing #clinical-reasoning-container and hiding #home-screen)
    switchAppMode('clinical');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // 2. Ensure container references are fresh
    if (!containers.clinical) {
      containers.clinical = document.getElementById('clinical-reasoning-container');
    }

    // 3. Show temporary loading indicator in clinical container if needed
    if (containers.clinical && !uiState.pathwayDataCache[pathwayId]) {
      containers.clinical.innerHTML = `
        <div class="glass-panel" style="padding: 3rem 1.5rem; text-align: center;">
          <div style="font-size: 2.2rem; display: inline-block;">⚙️</div>
          <h3 style="margin-top: 1rem; color: var(--text-primary); font-weight: 800;">Cargando Clinical Pathway...</h3>
          <p style="color: var(--text-secondary); font-size: 0.86rem; margin-top: 0.35rem;">Preparando razonamiento clínico estructurado</p>
        </div>
      `;
    }

    // 4. Load pathway JSON
    let pathwayData = uiState.pathwayDataCache[pathwayId];
    if (!pathwayData) {
      let filePath = null;
      const registry = window.CLINICAL_PATHWAYS_REGISTRY || {};
      for (const regionKey in registry) {
        const pres = (registry[regionKey].presentations || []).find(p => p.id === pathwayId);
        if (pres && pres.file) {
          filePath = pres.file;
          break;
        }
      }
      if (!filePath) {
        const pathMap = {
          'shoulder-lateral-pain': 'clinical/pathways/shoulder-lateral.json',
          'shoulder-stiffness': 'clinical/pathways/shoulder-stiffness.json',
          'shoulder-anterior-pain': 'clinical/pathways/shoulder-anterior.json',
          'shoulder-superior-pain': 'clinical/pathways/shoulder-superior.json',
          'shoulder-posterior-pain': 'clinical/pathways/shoulder-posterior.json',
          'shoulder-weakness': 'clinical/pathways/shoulder-weakness.json',
          'shoulder-trauma': 'clinical/pathways/shoulder-trauma.json',
          'shoulder-unclear': 'clinical/pathways/shoulder-unclear.json',
          'lumbar-radicular-pain': 'clinical/pathways/lumbar-radicular.json',
          'lumbar-axial-pain': 'clinical/pathways/lumbar-axial.json',
          'lumbar-axial': 'clinical/pathways/lumbar-axial.json',
          'lumbar-claudication': 'clinical/pathways/lumbar-claudication.json',
          'lumbar-gluteal': 'clinical/pathways/lumbar-gluteal.json',
          'lumbar-nocturnal': 'clinical/pathways/lumbar-nocturnal.json',
          'lumbar-trauma': 'clinical/pathways/lumbar-trauma.json',
          'lumbar-unclear': 'clinical/pathways/lumbar-unclear.json',
          'cervical-radicular': 'clinical/pathways/cervical-radicular.json',
          'cervical-axial': 'clinical/pathways/cervical-axial.json',
          'knee-oa-anterior': 'clinical/pathways/knee-oa-anterior.json',
          'knee-medial': 'clinical/pathways/knee-medial.json',
          'knee-lateral': 'clinical/pathways/knee-lateral.json',
          'knee-posterior': 'clinical/pathways/knee-posterior.json',
          'hip-lateral': 'clinical/pathways/hip-lateral.json',
          'hip-inguinal': 'clinical/pathways/hip-inguinal.json',
          'hip-gluteal': 'clinical/pathways/hip-gluteal.json',
          'si-posterior-pelvic': 'clinical/pathways/si-posterior-pelvic.json',
          'elbow-lateral': 'clinical/pathways/elbow-lateral.json',
          'elbow-medial': 'clinical/pathways/elbow-medial.json',
          'wrist-cts': 'clinical/pathways/wrist-cts.json',
          'wrist-radial': 'clinical/pathways/wrist-radial.json',
          'wrist-ulnar': 'clinical/pathways/wrist-ulnar.json',
          'ankle-plantar': 'clinical/pathways/ankle-plantar.json',
          'ankle-medial': 'clinical/pathways/ankle-medial.json',
          'ankle-achilles': 'clinical/pathways/ankle-achilles.json',
          'ankle-lateral': 'clinical/pathways/ankle-lateral.json',
          'nociplastic-pain': 'clinical/pathways/nociplastic-pain.json'
        };
        filePath = pathMap[pathwayId] || `clinical/pathways/${pathwayId}.json`;
      }

      // Check embedded bundle first for offline / local file:// execution
      if (window.EMBEDDED_BUNDLE && window.EMBEDDED_BUNDLE.pathways) {
        const fileName = filePath ? filePath.split('/').pop() : null;
        const embedded = window.EMBEDDED_BUNDLE.pathways[pathwayId] ||
                         window.EMBEDDED_BUNDLE.pathways[`${pathwayId}.json`] ||
                         (fileName ? window.EMBEDDED_BUNDLE.pathways[fileName] : null);
        if (embedded) {
          pathwayData = embedded;
          uiState.pathwayDataCache[pathwayId] = pathwayData;
        }
      }

      if (!pathwayData) {
        try {
          const res = await fetch(filePath + '?v=' + Date.now());
          if (!res.ok) throw new Error('Error al cargar pathway: ' + filePath);
          pathwayData = await res.json();
          uiState.pathwayDataCache[pathwayId] = pathwayData;
        } catch (err) {
          if (window.EMBEDDED_BUNDLE && window.EMBEDDED_BUNDLE.pathways) {
            const fileName = filePath ? filePath.split('/').pop() : null;
            pathwayData = window.EMBEDDED_BUNDLE.pathways[pathwayId] ||
                          window.EMBEDDED_BUNDLE.pathways[`${pathwayId}.json`] ||
                          (fileName ? window.EMBEDDED_BUNDLE.pathways[fileName] : null);
            if (pathwayData) {
              uiState.pathwayDataCache[pathwayId] = pathwayData;
            }
          }
          if (!pathwayData) {
            console.error('Error loading pathway:', err);
            if (containers.clinical) {
              containers.clinical.innerHTML = `
                <div class="glass-panel" style="padding: 2.5rem 1.5rem; text-align: center;">
                  <h3 style="color: #ef4444; font-weight: 800;">⚠️ No se pudo cargar el Clinical Pathway</h3>
                  <p style="color: var(--text-secondary); margin-top: 0.5rem; font-size: 0.86rem;">${err.message}</p>
                  <button class="vade-primary-btn" onclick="window.ClinicalUI.switchAppMode('home')" style="margin-top: 1.25rem;">Volver al Inicio</button>
                </div>
              `;
            }
            return;
          }
        }
      }
    }

    // 5. Instantiate Engine
    const catalog = window.state ? window.state.catalog : null;
    uiState.engine = new window.ClinicalReasoningEngine(pathwayData, catalog, window.TREATMENTS_CATALOG, window.COACH_CATALOG);
    uiState.engine.setMentorMode(uiState.mentorMode);
    uiState.engine.setExpressMode(uiState.expressMode);

    if (options && options.savedState) {
      uiState.engine.restoreSession(options.savedState);
    }
    if (options && options.radicularPhase) {
      uiState.radicularPhase = options.radicularPhase;
    }
    if (options && options.trainingMode !== undefined) {
      uiState.trainingMode = options.trainingMode;
    }

    // 6. Save as current & recent
    saveCurrentClinicalSession();

    // 7. Render Master Layout
    renderPathwayWorkspace();
  }

  function renderPathwayWorkspace() {
    const clinicalEl = getClinicalContainer();
    if (!clinicalEl || !uiState.engine) return;

    clinicalEl.innerHTML = `
      <!-- Sticky Clinical Header Bar -->
      <header class="clinical-top-bar" id="clinicalTopBar">
        <div class="clinical-bar-main">
          <div class="clinical-breadcrumb" id="clinicalBreadcrumb">
            <!-- Rendered dynamically -->
          </div>
          <div class="clinical-bar-actions">
            <!-- Quick Step Forward / Back Buttons -->
            <button class="clinical-nav-pill" onclick="window.ClinicalUI.goToPrevStep()" title="Paso anterior">
              <span>◀</span> <span>Anterior</span>
            </button>
            <button class="clinical-nav-pill next-highlight" onclick="window.ClinicalUI.goToNextStep()" title="Siguiente paso">
              <span>Siguiente</span> <span>▶</span>
            </button>

            <button class="clinical-action-btn ${uiState.expressMode ? 'active' : ''}" id="btnToggleExpress" title="Modo Express (3-5 min)">
              <span>⚡</span> <span>Express</span>
            </button>
            <button class="clinical-action-btn ${uiState.mentorMode ? 'active' : ''}" id="btnToggleMentor" title="Modo Mentor explicativo">
              <span>🧠</span> <span>Mentor</span>
            </button>
            <button class="clinical-action-btn danger" id="btnExitClinical" title="Salir de la consulta">
              <span>✕</span> <span>Salir</span>
            </button>
          </div>
        </div>

        <!-- Progress Steps Track (100% Clickable) -->
        <div class="clinical-progress-track" id="clinicalProgressTrack">
          <!-- Rendered dynamically -->
        </div>
      </header>

      ${uiState.simulation ? `
        <!-- Sticky Active Patient Case Simulation Banner -->
        <div class="simulation-active-banner">
          <div class="sim-banner-top">
            <div class="sim-banner-title">
              <span class="sim-badge ${uiState.simulation.caseData.difficulty || 'canonico'}">
                ${uiState.simulation.caseData.difficultyIcon || '🎓'} CASO SIMULADO: ${uiState.simulation.caseData.title}
              </span>
              <span class="sim-patient-info">
                👤 <strong>${uiState.simulation.caseData.patient.gender}</strong>, ${uiState.simulation.caseData.patient.age} años ${uiState.simulation.caseData.patient.profession ? `· ${uiState.simulation.caseData.patient.profession}` : ''}
              </span>
            </div>
            <button class="sim-history-btn" onclick="window.ClinicalUI.openPatientHistoryModal()">
              📋 Ver Historia Clínica
            </button>
          </div>
          <div class="sim-banner-complaint">
            <span class="sim-quote-icon">💬</span>
            <div class="sim-quote-content">
              <strong>Motivo de Consulta:</strong> «${uiState.simulation.caseData.patient.chiefComplaint}»
            </div>
          </div>
        </div>
      ` : ''}

      <!-- Auxiliary Decision Support Action Floating Bar -->
      <div style="display: flex; gap: 0.5rem; justify-content: flex-end; margin-bottom: 1rem; flex-wrap: wrap;">
        <button class="clinical-action-btn" onclick="window.ClinicalUI.openDifferentialModal()" title="Ver principales imitadores">
          <span>🔀</span> <span>¿Y si no es esto?</span>
        </button>
        <button class="clinical-action-btn" onclick="window.ClinicalUI.openReconsiderModal()" title="Revisar datos discordantes">
          <span>🤔</span> <span>No me cuadra</span>
        </button>
        <button class="clinical-action-btn" onclick="window.ClinicalUI.openMissingInfoModal()" title="Checklist de datos pendientes">
          <span>❓</span> <span>¿Qué me falta?</span>
        </button>
      </div>

      <!-- Main Step View Host -->
      <div id="clinicalStepHost">
        <!-- Rendered dynamically according to current step -->
      </div>
    `;

    // Attach Top Bar events
    document.getElementById('btnToggleExpress')?.addEventListener('click', () => {
      uiState.expressMode = !uiState.expressMode;
      localStorage.setItem('dolor_express_mode', uiState.expressMode);
      uiState.engine.setExpressMode(uiState.expressMode);
      document.getElementById('btnToggleExpress').classList.toggle('active', uiState.expressMode);
      renderCurrentStep();
    });

    document.getElementById('btnToggleMentor')?.addEventListener('click', () => {
      uiState.mentorMode = !uiState.mentorMode;
      localStorage.setItem('dolor_mentor_mode', uiState.mentorMode);
      uiState.engine.setMentorMode(uiState.mentorMode);
      document.getElementById('btnToggleMentor').classList.toggle('active', uiState.mentorMode);
      renderCurrentStep();
    });

    document.getElementById('btnExitClinical')?.addEventListener('click', () => {
      if (confirm('¿Deseas salir de la consulta actual? Los datos se conservarán en tu sesión local.')) {
        window.ClinicalUI.renderRegionSelector();
      }
    });

    // Render Current Step View
    renderCurrentStep();
  }

  function updateTopBar() {
    const breadcrumbEl = document.getElementById('clinicalBreadcrumb');
    const trackEl = document.getElementById('clinicalProgressTrack');
    if (!breadcrumbEl || !trackEl || !uiState.engine) return;

    const pw = uiState.engine.pathway;
    const currentStepId = uiState.engine.getCurrentStep();
    const progressSteps = uiState.engine.getProgressSteps();
    const activeStepObj = progressSteps.find(s => s.id === currentStepId);

    // Breadcrumb
    breadcrumbEl.innerHTML = `
      <span class="breadcrumb-item">${pw.regionIcon} ${pw.regionLabel}</span>
      <span class="breadcrumb-sep">›</span>
      <span class="breadcrumb-item">${pw.presentation}</span>
      <span class="breadcrumb-sep">›</span>
      <span class="breadcrumb-item active">${activeStepObj ? activeStepObj.label : ''}</span>
    `;

    // Progress Steps (100% Clickable with tooltip)
    trackEl.innerHTML = progressSteps.map(step => `
      <button class="progress-step-pill ${step.status}" onclick="window.ClinicalUI.goToStep('${step.id}')" title="Ir directamente a ${step.label}">
        <span>${step.icon}</span> <span>${step.label}</span>
      </button>
    `).join('');
  }

  const CLINICAL_STEP_SEQUENCE = [
    'red_flags',
    'anamnesis',
    'anamnesis_summary',
    'examination',
    'exam_summary',
    'imaging',
    'generator',
    'treatment',
    'follow_up',
    'coach',
    'summary'
  ];

  function goToNextStep() {
    if (!uiState.engine) return;
    const current = uiState.engine.getCurrentStep();
    
    if (current === 'red_flags') {
      confirmRedFlags();
      return;
    }
    if (current === 'anamnesis') {
      const q = uiState.engine.getCurrentQuestion();
      if (q) {
        const allQuestions = uiState.expressMode ? uiState.engine.getEssentialQuestions() : uiState.engine.getQuestions();
        const nextQ = allQuestions.find(item => uiState.engine.session.answers[item.id] === undefined && item.id !== q.id);
        if (!nextQ) {
          uiState.engine.session.currentStep = 'anamnesis_summary';
          uiState.engine._addCompletedStep('anamnesis');
          renderCurrentStep();
          return;
        }
      }
      uiState.engine.session.currentStep = 'anamnesis_summary';
      uiState.engine._addCompletedStep('anamnesis');
      renderCurrentStep();
      return;
    }
    if (current === 'anamnesis_summary') {
      proceedToExamination();
      return;
    }
    if (current === 'examination') {
      proceedToExamSummary();
      return;
    }
    if (current === 'exam_summary') {
      proceedToImaging();
      return;
    }
    if (current === 'imaging') {
      proceedToGenerator();
      return;
    }
    if (current === 'generator') {
      proceedToTreatment();
      return;
    }
    if (current === 'treatment') {
      proceedToFollowUp();
      return;
    }
    if (current === 'follow_up') {
      proceedToCoach();
      return;
    }
    if (current === 'coach') {
      proceedToSummary();
      return;
    }

    const idx = CLINICAL_STEP_SEQUENCE.indexOf(current);
    if (idx >= 0 && idx < CLINICAL_STEP_SEQUENCE.length - 1) {
      uiState.engine._addCompletedStep(current);
      uiState.engine.session.currentStep = CLINICAL_STEP_SEQUENCE[idx + 1];
      renderCurrentStep();
    }
  }

  function goToPrevStep() {
    if (!uiState.engine) return;
    const current = uiState.engine.getCurrentStep();
    const idx = CLINICAL_STEP_SEQUENCE.indexOf(current);
    if (idx > 0) {
      const prevStep = CLINICAL_STEP_SEQUENCE[idx - 1];
      if (prevStep === 'anamnesis') {
        uiState.activeQuestionIndex = 0;
      }
      uiState.engine.session.currentStep = prevStep;
      renderCurrentStep();
    } else if (idx === 0) {
      renderPresentationSelector(uiState.engine.pathway.region);
    }
  }

  function renderCurrentStep() {
    updateTopBar();
    const host = document.getElementById('clinicalStepHost');
    if (!host || !uiState.engine) return;

    const step = uiState.engine.getCurrentStep();
    uiState.currentStepView = step;
    saveCurrentClinicalSession();

    switch (step) {
      case 'red_flags':
        renderRedFlagsView(host);
        break;
      case 'anamnesis':
        renderAnamnesisView(host);
        break;
      case 'anamnesis_summary':
        renderAnamnesisSummaryView(host);
        break;
      case 'examination':
        renderExaminationView(host);
        break;
      case 'exam_summary':
        renderExamSummaryView(host);
        break;
      case 'imaging':
        renderImagingView(host);
        break;
      case 'generator':
        renderGeneratorView(host);
        break;
      case 'treatment':
        renderTreatmentView(host);
        break;
      case 'follow_up':
        renderFollowUpView(host);
        break;
      case 'coach':
        renderCoachView(host);
        break;
      case 'summary':
        renderClinicalSummaryView(host);
        break;
      default:
        renderRedFlagsView(host);
    }

    // Scroll to top of clinical container
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ─────────────────────────────────────────────
  // 3. STEP 0 — RED FLAGS SAFETY SCREEN
  // ─────────────────────────────────────────────

  function renderRedFlagsView(container) {
    const flags = uiState.engine.getRedFlags();
    const currentResults = uiState.engine.session.redFlagResults || {};

    container.innerHTML = `
      <div class="safety-screen-card glass-panel">
        <div class="safety-header-banner ${uiState.engine.session.hasActiveRedFlag ? 'critical' : ''}">
          <span class="safety-banner-icon">🛡️</span>
          <div class="safety-banner-text">
            <h3>Paso 0 — Seguridad y Descarte de Banderas Rojas</h3>
            <p>Antes de aplicar algoritmos musculoesqueléticos, verifica la ausencia de señales de alarma.</p>
          </div>
        </div>

        <!-- Quick Top Action Bar (No need to scroll all 12 items) -->
        <div class="safety-quick-banner">
          <div class="safety-quick-info">
            <span>💡</span>
            <span><strong>Descarte Rápido:</strong> Si el paciente no presenta banderas rojas, puedes avanzar directamente:</span>
          </div>
          <button class="btn-primary" style="padding: 0.45rem 1.15rem; font-size: 0.84rem; white-space: nowrap;" onclick="window.ClinicalUI.confirmRedFlags()">
            <span>Continuar a Anamnesis →</span>
          </button>
        </div>

        <p style="font-size: 0.88rem; color: var(--text-secondary); margin-bottom: 1rem;">
          Marca si el paciente presenta alguna de las siguientes condiciones:
        </p>

        <div class="red-flags-checklist">
          ${flags.map(f => {
            const isChecked = !!currentResults[f.id];
            const flagTitle = f.text || f.label || f.name || 'Signo de alarma clínica';
            const flagAction = f.action || 'Derivación / estudio urgente';
            return `
              <label class="flag-checkbox-item ${isChecked ? 'checked' : ''}" id="flag_label_${f.id}">
                <input type="checkbox" class="flag-checkbox-input" data-flag-id="${f.id}" ${isChecked ? 'checked' : ''} onchange="window.ClinicalUI.toggleRedFlag('${f.id}', this.checked)">
                <div class="flag-item-content">
                  <span class="flag-item-title">${flagTitle}</span>
                  ${(f.severity === 'critical' || f.severity === 'major') ? `<span class="flag-item-action">⚠️ Severidad ${f.severity === 'critical' ? 'Crítica' : 'Mayor'}: ${flagAction}</span>` : ''}
                </div>
              </label>
            `;
          }).join('')}
        </div>

        <div id="redFlagStatusNotice">
          ${uiState.engine.session.hasActiveRedFlag ? `
            <div class="safety-header-banner critical" style="margin-top: 1rem;">
              <span class="safety-banner-icon">🚨</span>
              <div class="safety-banner-text">
                <h4 style="margin: 0 0 0.2rem; color: var(--color-alarm);">BANDERA ROJA DETECTADA</h4>
                <p style="color: var(--text-primary); font-size: 0.82rem;">Interrumpir el algoritmo musculoesquelético de dolor y valorar estudio dirigido / derivación urgente.</p>
              </div>
            </div>
          ` : `
            <div class="safety-header-banner safe" style="margin-top: 1rem;">
              <span class="safety-banner-icon">🟢</span>
              <div class="safety-banner-text">
                <h4 style="margin: 0 0 0.2rem; color: var(--color-safe);">Sin banderas rojas activas</h4>
                <p style="color: var(--text-primary); font-size: 0.82rem;">Seguro para continuar con el algoritmo musculoesquelético y anamnesis dirigida.</p>
              </div>
            </div>
          `}
        </div>

        <div class="safety-actions-bar">
          <button class="clinical-action-btn" onclick="window.ClinicalUI.renderPresentationSelector('${uiState.engine.pathway.region}')">
            <span>← Cambiar presentación</span>
          </button>
          
          <button class="btn-primary" id="btnConfirmRedFlags" style="padding: 0.65rem 1.4rem;" onclick="window.ClinicalUI.confirmRedFlags()">
            <span>Continuar a Anamnesis Dirigida →</span>
          </button>
        </div>
      </div>
    `;
  }

  function toggleRedFlag(flagId, isChecked) {
    if (!uiState.engine) return;
    if (!uiState.engine.session.redFlagResults) {
      uiState.engine.session.redFlagResults = {};
    }
    uiState.engine.session.redFlagResults[flagId] = isChecked;
    const lbl = document.getElementById('flag_label_' + flagId);
    if (lbl) lbl.classList.toggle('checked', isChecked);

    const checkedMap = uiState.engine.session.redFlagResults;
    const res = uiState.engine.evaluateRedFlags(checkedMap);
    const noticeEl = document.getElementById('redFlagStatusNotice');
    if (noticeEl) {
      noticeEl.innerHTML = !res.safe ? `
        <div class="safety-header-banner critical" style="margin-top: 1rem;">
          <span class="safety-banner-icon">🚨</span>
          <div class="safety-banner-text">
            <h4 style="margin: 0 0 0.2rem; color: var(--color-alarm);">BANDERA ROJA DETECTADA</h4>
            <p style="color: var(--text-primary); font-size: 0.82rem;">Interrumpir el algoritmo musculoesquelético de dolor y valorar estudio dirigido / derivación urgente.</p>
          </div>
        </div>
      ` : `
        <div class="safety-header-banner safe" style="margin-top: 1rem;">
          <span class="safety-banner-icon">🟢</span>
          <div class="safety-banner-text">
            <h4 style="margin: 0 0 0.2rem; color: var(--color-safe);">Sin banderas rojas activas</h4>
            <p style="color: var(--text-primary); font-size: 0.82rem;">Seguro para continuar con el algoritmo musculoesquelético y anamnesis dirigida.</p>
          </div>
        </div>
      `;
    }
  }

  function confirmRedFlags() {
    if (!uiState.engine) return;
    const container = document.getElementById('clinicalStepHost');
    const checkedMap = {};
    if (container) {
      container.querySelectorAll('.flag-checkbox-input').forEach(inp => {
        checkedMap[inp.getAttribute('data-flag-id')] = inp.checked;
      });
    }
    const res = uiState.engine.evaluateRedFlags(checkedMap);
    
    // In simulation mode, evaluate safety decision
    if (uiState.simulation) {
      const isExpectedSafe = uiState.simulation.caseData.expectedFlow?.redFlagsSafe !== false;
      const userFoundSafe = res.safe;
      const isCorrect = (isExpectedSafe === userFoundSafe);
      uiState.simulation.evaluateDecision(
        'seguridad',
        'red_flags_evaluation',
        isCorrect,
        25,
        isCorrect 
          ? (isExpectedSafe ? 'Correcto: Paciente sin banderas rojas agudas.' : 'Correcto: Has identificado las banderas rojas críticas.')
          : (isExpectedSafe ? 'Precaución: Marcaste señales de alarma cuando el cuadro es musculoesquelético estándar.' : 'Riesgo Clínico: El paciente presentaba banderas rojas críticas que no fueron identificadas.')
      );
      if (!isExpectedSafe && userFoundSafe) {
        uiState.simulation.recordBias('cierre_prematuro', 'Omisión de Banderas Rojas', 'Se omitió descartar signos de alarma neurológica o sistémica grave.');
      }
    }

    uiState.engine._addCompletedStep('red_flags');
    uiState.engine.session.currentStep = 'anamnesis';
    renderCurrentStep();
  }

  // ─────────────────────────────────────────────
  // 4. STEP 1 — ANAMNESIS & LIVE HYPOTHESES
  // ─────────────────────────────────────────────

  function renderAnamnesisView(container) {
    const allQuestions = uiState.expressMode
      ? uiState.engine.getEssentialQuestions()
      : uiState.engine.getQuestions();

    if (!allQuestions || allQuestions.length === 0) {
      uiState.engine.session.currentStep = 'anamnesis_summary';
      return renderCurrentStep();
    }

    // Determine active question index
    if (typeof uiState.activeQuestionIndex !== 'number' || uiState.activeQuestionIndex < 0 || uiState.activeQuestionIndex >= allQuestions.length) {
      const firstUnanswered = allQuestions.findIndex(item => uiState.engine.session.answers[item.id] === undefined);
      uiState.activeQuestionIndex = firstUnanswered >= 0 ? firstUnanswered : 0;
    }

    const qIndex = uiState.activeQuestionIndex;
    const q = allQuestions[qIndex];
    const totalQ = allQuestions.length;
    const selectedAnswerIdx = uiState.engine.session.answers[q.id];
    const allAnswered = allQuestions.every(item => uiState.engine.session.answers[item.id] !== undefined);

    container.innerHTML = `
      <div class="anamnesis-layout">
        <!-- Main Question Card -->
        <div class="question-card">
          <div class="question-header">
            <span class="question-num-pill">Pregunta ${qIndex + 1} de ${totalQ} ${q.essential ? '• ⚡ Clave' : ''}</span>
            
            <!-- Quick Question Pagination Pills -->
            <div style="display: flex; gap: 0.35rem; align-items: center; flex-wrap: wrap;">
              ${allQuestions.map((item, idx) => {
                const isAns = uiState.engine.session.answers[item.id] !== undefined;
                const isCur = idx === qIndex;
                return `
                  <button style="width: 24px; height: 24px; border-radius: 50%; font-size: 0.72rem; font-weight: 800; border: 1px solid ${isCur ? 'var(--accent-blue)' : isAns ? 'var(--accent-emerald)' : 'var(--border-color)'}; background: ${isCur ? 'var(--accent-blue)' : isAns ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-surface)'}; color: ${isCur ? '#fff' : isAns ? 'var(--accent-emerald)' : 'var(--text-muted)'}; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0;"
                          onclick="window.ClinicalUI.setQuestionIndex(${idx})" title="Ir a pregunta ${idx + 1}">
                    ${idx + 1}
                  </button>
                `;
              }).join('')}
            </div>
          </div>

          <h2 class="question-title">${q.text}</h2>

          ${uiState.mentorMode && q.explanation ? `
            <div class="question-mentor-tip">
              <span style="font-size: 1.1rem;">💡</span>
              <div>
                <strong>¿Por qué importa esta pregunta?</strong><br>
                ${q.explanation}
              </div>
            </div>
          ` : ''}

          <!-- Options List -->
          <div class="question-options-list">
            ${q.answers.map((ans, aIdx) => `
              <button class="question-option-btn ${selectedAnswerIdx === aIdx ? 'selected' : ''}" 
                      onclick="window.ClinicalUI.answerQuestion('${q.id}', ${aIdx})">
                <span>${ans.label}</span>
                <span>${selectedAnswerIdx === aIdx ? '✓' : '→'}</span>
              </button>
            `).join('')}
          </div>

          <!-- Free text for Functional Goal if applicable -->
          ${q.isFunctionalGoal ? `
            <div class="goal-input-box">
              <label style="font-size: 0.82rem; font-weight: 700; color: var(--text-secondary);">O escribe su objetivo funcional personalizado:</label>
              <textarea class="goal-textarea" id="customGoalInput" placeholder="Ej: Volver a jugar con sus nietos, levantar el brazo para peinarse, conducir sin dolor...">${uiState.engine.session.functionalGoal || ''}</textarea>
              <button class="btn-primary" style="align-self: flex-end; padding: 0.45rem 1rem; font-size: 0.82rem;" onclick="window.ClinicalUI.saveCustomGoal()">
                Guardar Objetivo
              </button>
            </div>
          ` : ''}

          <!-- Bottom Navigation Bar inside Question Card -->
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 1.25rem; padding-top: 0.85rem; border-top: 1px solid var(--border-color); flex-wrap: wrap; gap: 0.5rem;">
            <div>
              ${qIndex > 0 ? `
                <button class="clinical-action-btn" style="padding: 0.4rem 0.85rem; font-size: 0.8rem;" onclick="window.ClinicalUI.setQuestionIndex(${qIndex - 1})">
                  ← Pregunta Anterior
                </button>
              ` : `
                <button class="clinical-action-btn" style="padding: 0.4rem 0.85rem; font-size: 0.8rem;" onclick="window.ClinicalUI.goToStep('red_flags')">
                  ← Banderas Rojas
                </button>
              `}
            </div>

            <div style="display: flex; gap: 0.5rem;">
              ${qIndex < totalQ - 1 ? `
                <button class="clinical-action-btn" style="padding: 0.4rem 0.85rem; font-size: 0.8rem;" onclick="window.ClinicalUI.setQuestionIndex(${qIndex + 1})">
                  Pregunta Siguiente →
                </button>
              ` : ''}
              
              ${allAnswered ? `
                <button class="btn-primary" style="padding: 0.4rem 1rem; font-size: 0.82rem;" onclick="window.ClinicalUI.proceedToAnamnesisSummary()">
                  Ver Resumen Anamnesis →
                </button>
              ` : ''}
            </div>
          </div>
        </div>

        <!-- Dynamic Hypothesis Panel (Sidebar) -->
        <aside class="hypothesis-panel">
          <div class="hypothesis-panel-header">
            <h3><span>📊</span> <span>Hipótesis Actuales</span></h3>
            <span style="font-size: 0.72rem; color: var(--text-muted); font-weight: 700;">Dinámico</span>
          </div>

          <div class="hypothesis-items-list" id="hypothesesLiveList">
            ${renderHypothesesListHTML()}
          </div>
        </aside>
      </div>
    `;
  }

  function renderHypothesesListHTML() {
    if (!uiState.engine) return '';
    const ranked = uiState.engine.getHypothesesRanked();
    const discriminator = uiState.engine.getDifferentialDiscriminator ? uiState.engine.getDifferentialDiscriminator() : null;

    const listHtml = ranked.map(h => {
      const levelLabel = uiState.engine.getHypothesisLevelLabel(h.level);
      const icon = uiState.engine.getHypothesisLevelIcon(h.level);
      const color = uiState.engine.getHypothesisLevelColor(h.level);

      return `
        <div class="hypothesis-row ${h.level}">
          <div class="hypo-info">
            <span class="hypo-name">${h.shortName || h.name}</span>
            <span class="hypo-level-text" style="color: ${color};">${levelLabel}</span>
          </div>
          <span class="hypo-meter-icon" style="color: ${color};">${icon}</span>
        </div>
      `;
    }).join('');

    const discriminatorHtml = discriminator ? `
      <div class="hypothesis-discriminator-card" style="margin-top: 0.85rem; padding: 0.75rem 0.85rem; background: rgba(245, 158, 11, 0.12); border: 1px solid rgba(245, 158, 11, 0.35); border-radius: var(--radius-md);">
        <div style="display: flex; align-items: center; gap: 0.4rem; margin-bottom: 0.35rem; color: #f59e0b; font-size: 0.78rem; font-weight: 800; text-transform: uppercase;">
          <span>💡</span> <span>¿Qué dato separaría las 2 primeras?</span>
        </div>
        <p style="margin: 0; font-size: 0.8rem; line-height: 1.35; color: var(--text-primary);">
          ${discriminator.recommendation}
        </p>
      </div>
    ` : '';

    const whatIBelieveBtnHtml = `
      <div style="margin-top: 0.75rem;">
        <button class="exam-tool-btn" style="width: 100%; justify-content: center; background: rgba(99, 102, 241, 0.15); border-color: rgba(99, 102, 241, 0.35); color: #818cf8; font-weight: 700;" onclick="window.ClinicalUI.openWhatIDoBelieveModal()">
          <span>🧠</span> <span>¿Qué creo ahora? (Síntesis)</span>
        </button>
      </div>
    `;

    return listHtml + discriminatorHtml + whatIBelieveBtnHtml;
  }

  function answerQuestion(questionId, answerIndex) {
    if (!uiState.engine) return;
    uiState.engine.processAnswer(questionId, answerIndex);
    
    const allQuestions = uiState.expressMode
      ? uiState.engine.getEssentialQuestions()
      : uiState.engine.getQuestions();

    if (uiState.activeQuestionIndex < allQuestions.length - 1) {
      uiState.activeQuestionIndex++;
      renderCurrentStep();
    } else {
      uiState.engine.session.currentStep = 'anamnesis_summary';
      renderCurrentStep();
    }
  }

  function saveCustomGoal() {
    const input = document.getElementById('customGoalInput');
    if (input && uiState.engine) {
      uiState.engine.session.functionalGoal = input.value.trim();
      const allQuestions = uiState.expressMode
        ? uiState.engine.getEssentialQuestions()
        : uiState.engine.getQuestions();
      const currentQ = allQuestions[uiState.activeQuestionIndex];
      if (currentQ) {
        uiState.engine.processAnswer(currentQ.id, 0);
      }
      if (uiState.activeQuestionIndex < allQuestions.length - 1) {
        uiState.activeQuestionIndex++;
      } else {
        uiState.engine.session.currentStep = 'anamnesis_summary';
      }
      renderCurrentStep();
    }
  }

  function proceedToAnamnesisSummary() {
    if (!uiState.engine) return;
    uiState.engine.session.currentStep = 'anamnesis_summary';
    renderCurrentStep();
  }

  // ─────────────────────────────────────────────
  // 5. ANAMNESIS SUMMARY (BRIDGE)
  // ─────────────────────────────────────────────

  function renderAnamnesisSummaryView(container) {
    const summary = uiState.engine.getAnamnesisSummary();

    if (uiState.simulation) {
      const topHypo = uiState.engine.getHypothesesRanked()[0];
      const expectedHypo = uiState.simulation.caseData.expectedFlow?.topHypothesis;
      const isCorrect = topHypo && (!expectedHypo || topHypo.id === expectedHypo);
      uiState.simulation.evaluateDecision(
        'anamnesis',
        'anamnesis_completeness',
        true,
        0,
        'Anamnesis dirigida completada con éxito.'
      );
      uiState.simulation.evaluateDecision(
        'diferencial',
        'hypothesis_orientation',
        isCorrect,
        20,
        isCorrect
          ? 'Correcto: Las respuestas orientan la hipótesis diana al primer lugar.'
          : 'Diferencial desviado: La hipótesis principal resultante no coincide con la esperada en este caso clínico.'
      );
    }

    container.innerHTML = `
      <div class="summary-bridge-card glass-panel">
        <div class="summary-bridge-header">
          <div class="home-hero-badge">Resumen · Lo que tenemos hasta ahora</div>
          <h3>Patrón Clínico: ${summary.pattern} (${summary.region})</h3>
        </div>

        <div class="summary-grid-2">
          <!-- Main Supporting Criteria -->
          <div class="summary-subcard">
            <h4 style="color: var(--accent-blue);"><span>📋</span> <span>Datos que apoyan el cuadro</span></h4>
            <ul>
              ${summary.supportingData.map(d => `<li><span>✓</span> <span>${d}</span></li>`).join('')}
            </ul>
          </div>

          <!-- Main Hypotheses -->
          <div class="summary-subcard">
            <h4 style="color: var(--color-safe);"><span>🎯</span> <span>Hipótesis Principales</span></h4>
            <ul>
              ${summary.mainHypotheses.map(h => `<li><span>↑</span> <strong>${h.name}</strong></li>`).join('')}
            </ul>
          </div>
        </div>

        <div class="summary-grid-2">
          <!-- Alternatives to exclude -->
          <div class="summary-subcard">
            <h4 style="color: var(--color-uncertain);"><span>🔍</span> <span>Alternativas a excluir en exploración</span></h4>
            <ul>
              ${summary.alternatives.map(h => `<li><span>↔</span> <span>${h.name}</span></li>`).join('')}
            </ul>
          </div>

          <!-- Functional Goal -->
          <div class="summary-subcard">
            <h4 style="color: var(--accent-purple);"><span>🎯</span> <span>Objetivo Funcional del Paciente</span></h4>
            <p style="font-size: 0.88rem; font-weight: 700; color: var(--text-primary); margin: 0;">
              ${summary.functionalGoal || 'Recuperar actividad y alivio del dolor'}
            </p>
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 1.5rem; flex-wrap: wrap; gap: 0.75rem;">
          <button class="clinical-action-btn" onclick="window.ClinicalUI.goToStep('anamnesis')">
            <span>← Revisar anamnesis</span>
          </button>
          
          <button class="btn-primary" style="padding: 0.75rem 1.6rem;" onclick="window.ClinicalUI.proceedToExamination()">
            <span>Continuar a Exploración Física Dirigida →</span>
          </button>
        </div>
      </div>
    `;
  }

  function proceedToExamination() {
    if (!uiState.engine) return;
    uiState.engine.proceedToExamination();
    renderCurrentStep();
  }

  // ─────────────────────────────────────────────
  // 6. STEP 2 — GUIDED EXAMINATION FLOW
  // ─────────────────────────────────────────────

  function renderExaminationView(container) {
    const steps = uiState.engine.getExaminationSteps();
    const findings = uiState.engine.session.examinationFindings || {};
    const cluster = uiState.engine.pathway.clusters && uiState.engine.pathway.clusters[0];
    const clusterResult = cluster ? uiState.engine.evaluateCluster(cluster.id) : null;

    container.innerHTML = `
      <div class="exam-flow-container">
        <div class="home-hero-badge" style="align-self: flex-start;">
          ⚡ Secuencia de Exploración Mínima de Alta Rentabilidad (90s)
        </div>

        ${steps.map(s => {
          const selectedVal = findings[s.id];
          const isDone = selectedVal !== undefined;
          const catalogTest = s.catalogTestId ? uiState.engine.getCatalogTest(s.catalogTestId) : null;

          return `
            <article class="exam-step-card ${isDone ? 'completed' : ''}" id="exam_card_${s.id}">
              <div class="exam-step-top">
                <div class="exam-step-title-group">
                  <span class="exam-step-order-badge">${s.order || '•'}</span>
                  <div>
                    <h3 class="exam-step-title">${s.name}</h3>
                    ${catalogTest ? `<span style="font-size: 0.76rem; color: var(--text-muted);">${catalogTest.eponym || ''}</span>` : ''}
                  </div>
                </div>

                ${isDone ? `<span class="progress-icon" style="color: var(--color-safe); font-size: 1.2rem;">✅</span>` : ''}
              </div>

              <!-- Action Tool Buttons (Links to catalog/modals) -->
              <div class="exam-tools-row">
                ${catalogTest ? `
                  <button class="exam-tool-btn" onclick="window.openTestById('${catalogTest.id}')">
                    <span>❔</span> <span>Cómo hacerlo</span>
                  </button>
                ` : ''}

                ${catalogTest && catalogTest.videos && catalogTest.videos.length > 0 ? `
                  <button class="exam-tool-btn" onclick="window.openVideoModalFromDetail('${catalogTest.id}', 0)">
                    <span>🎬</span> <span>Vídeo HD</span>
                  </button>
                ` : ''}

                ${catalogTest ? `
                  <button class="exam-tool-btn" onclick="alert('Sensibilidad: ${catalogTest.sensitivity} | Especificidad: ${catalogTest.specificity} | LR+: ${catalogTest.lr_plus}')">
                    <span>📊</span> <span>Sn ${catalogTest.sensitivity} / Sp ${catalogTest.specificity}</span>
                  </button>
                ` : ''}
              </div>

              <!-- Instruction & Mentor tip -->
              ${s.instruction ? `<div class="exam-instruction-box">${s.instruction}</div>` : ''}

              ${uiState.mentorMode && s.mentorTip ? `
                <div class="question-mentor-tip" style="margin-bottom: 0.75rem;">
                  <span>🧠</span> <span><strong>Clave del Experto:</strong> ${s.mentorTip}</span>
                </div>
              ` : ''}

              <!-- Results Choice Grid (Differentiates Pain vs Weakness) -->
              <div class="exam-results-grid">
                ${s.results.map(r => `
                  <button class="exam-result-choice-btn ${r.value} ${selectedVal === r.value ? 'active' : ''}"
                          onclick="window.ClinicalUI.recordExamFinding('${s.id}', '${r.value}')">
                    ${r.label}
                  </button>
                `).join('')}
              </div>
            </article>
          `;
        }).join('')}

        <!-- Live Cluster Concordance Status -->
        ${clusterResult ? `
          <div class="cluster-live-box">
            <span style="font-size: 1.6rem;">${clusterResult.met ? '🎯' : '📊'}</span>
            <div>
              <h4 style="margin: 0 0 0.2rem; font-size: 0.92rem; color: var(--text-primary); font-weight: 800;">
                ${clusterResult.cluster.name}: ${clusterResult.met ? 'CONCORDANTE (≥' + clusterResult.threshold + ' positivos)' : 'No cumple criterio aún (' + clusterResult.positiveCount + '/' + clusterResult.totalEvaluated + ')'}
              </h4>
              <p style="margin: 0; font-size: 0.78rem; color: var(--text-secondary);">
                ${clusterResult.evidenceNote || ''}
              </p>
            </div>
          </div>
        ` : ''}

        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 1.5rem; flex-wrap: wrap; gap: 0.75rem;">
          <button class="clinical-action-btn" onclick="window.ClinicalUI.goToStep('anamnesis_summary')">
            <span>← Volver a Resumen</span>
          </button>
          
          <button class="btn-primary" style="padding: 0.75rem 1.6rem;" onclick="window.ClinicalUI.proceedToExamSummary()">
            <span>Evaluar Concordancia de Exploración →</span>
          </button>
        </div>
      </div>
    `;
  }

  function recordExamFinding(stepId, resultValue) {
    if (!uiState.engine) return;
    uiState.engine.processExaminationFinding(stepId, resultValue);
    renderCurrentStep();
  }

  function proceedToExamSummary() {
    if (!uiState.engine) return;

    if (uiState.simulation) {
      const keyTests = uiState.simulation.caseData.expectedFlow?.keyTests || [];
      const evaluated = uiState.engine.session.examinationFindings || {};
      const missingKeyTests = keyTests.filter(tId => evaluated[tId] === undefined);
      const isExamComplete = missingKeyTests.length === 0;
      uiState.simulation.evaluateDecision(
        'exploracion',
        'key_maneuvers_performed',
        isExamComplete,
        missingKeyTests.length * 15,
        isExamComplete
          ? 'Correcto: Se evaluaron las maniobras exploratorias clave del caso.'
          : `Exploración parcial: Faltaron maniobras discriminadoras clave (${missingKeyTests.join(', ')}).`
      );
      if (!isExamComplete) {
        uiState.simulation.recordBias('cierre_prematuro', 'Exploración Incompleta', 'Se avanzó sin completar las pruebas ortopédicas/neurológicas discriminadoras.');
      }
    }

    uiState.engine.session.currentStep = 'exam_summary';
    renderCurrentStep();
  }

  // ─────────────────────────────────────────────
  // 7. CONCORDANCE MAP (POST-EXPLORACIÓN)
  // ─────────────────────────────────────────────

  function renderExamSummaryView(container) {
    const summary = uiState.engine.getExaminationSummary();

    container.innerHTML = `
      <div class="summary-bridge-card glass-panel">
        <div class="summary-bridge-header">
          <div class="home-hero-badge">Paso 3 · Mapa de Concordancia Clínica</div>
          <h3>Concordancia de Hallazgos Físicos</h3>
          <p style="color: var(--text-secondary); font-size: 0.85rem; margin-top: 0.25rem;">
            Resultado de integrar anamnesis y pruebas de provocación física.
          </p>
        </div>

        <div style="display: flex; flex-direction: column; gap: 0.65rem; margin-bottom: 1.5rem;">
          ${summary.concordanceMap.map(item => `
            <div class="hypothesis-row ${item.hypothesis.level}" style="padding: 0.85rem 1.15rem;">
              <div style="display: flex; align-items: center; gap: 0.65rem;">
                <span style="font-size: 1.3rem;">${item.icon}</span>
                <div>
                  <h4 style="margin: 0; font-size: 0.95rem; font-weight: 800; color: var(--text-primary);">${item.hypothesis.name}</h4>
                  <span style="font-size: 0.76rem; color: var(--text-secondary);">${item.hypothesis.description || ''}</span>
                </div>
              </div>
              <span class="pres-badge-status ${item.concordanceLevel === 'very_concordant' ? 'available' : 'upcoming'}">
                ${uiState.engine.getHypothesisLevelLabel(item.hypothesis.level)}
              </span>
            </div>
          `).join('')}
        </div>

        <!-- Imaging Recommendation Box -->
        <div class="safety-header-banner safe" style="margin-bottom: 1.5rem;">
          <span class="safety-banner-icon">🎯</span>
          <div class="safety-banner-text">
            <h4>Siguiente Paso Recomendado: ${summary.recommendedImaging.label}</h4>
            <p>Interrogar selectivamente las estructuras diana para confirmar el generador y descartar roturas o conflictos.</p>
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
          <button class="clinical-action-btn" onclick="window.ClinicalUI.goToStep('examination')">
            <span>← Modificar Exploración</span>
          </button>
          
          <div style="display: flex; gap: 0.5rem;">
            <button class="clinical-action-btn" onclick="window.ClinicalUI.skipImaging()">
              <span>Omitir Imagen (Tratamiento Clínico)</span>
            </button>
            <button class="btn-primary" style="padding: 0.75rem 1.5rem;" onclick="window.ClinicalUI.proceedToImaging()">
              <span>Realizar ${summary.recommendedImaging.label} →</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  function proceedToImaging() {
    if (!uiState.engine) return;
    uiState.engine.proceedToImaging();
    renderCurrentStep();
  }

  function skipImaging() {
    if (!uiState.engine) return;
    uiState.engine.skipImaging();
    renderCurrentStep();
  }

  // ─────────────────────────────────────────────
  // 8. STEP 4 — ULTRASOUND / IMAGING PROTOCOL
  // ─────────────────────────────────────────────

  function renderImagingView(container) {
    const protocol = uiState.engine.getImagingProtocol();
    if (!protocol) {
      uiState.engine.proceedToGenerator();
      return renderCurrentStep();
    }

    const structures = uiState.engine.getImagingStructures();
    const findings = uiState.engine.session.imagingFindings || {};
    const concordanceAssessment = uiState.engine.getConcordanceAssessment();

    container.innerHTML = `
      <div class="imaging-protocol-card glass-panel">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.5rem;">
          <div class="home-hero-badge">
            ${uiState.engine.pathway.ultrasound ? '🔊 Ecografía Musculoesquelética Dirigida' : '🏥 Correlación de Imagen por RM'}
          </div>
          ${uiState.engine.pathway.ultrasound ? `
            <button class="vade-primary-btn" onclick="window.Ultrasound.openFromClinicalPathway({ pathwayId: '${uiState.engine.pathway.id}', region: '${uiState.engine.pathway.region || 'hombro'}', laterality: 'derecho' })" style="font-size: 0.8rem; padding: 0.35rem 0.85rem;">
              🩻 Abrir Generador Ecográfico POCUS
            </button>
          ` : ''}
        </div>

        <div class="imaging-question-banner">
          <h4>Pregunta Clínica a Responder</h4>
          <p>${protocol.clinicalQuestion || '¿Los hallazgos de imagen explican el cuadro clínico del paciente?'}</p>
        </div>

        <div class="structures-findings-list">
          ${structures.map(st => `
            <div class="structure-box">
              <div class="structure-box-title">
                <span>🎯 ${st.name} ${st.priority === 1 ? '<span class="pres-badge-status available" style="font-size: 0.74rem;">Prioridad 1</span>' : ''}</span>
                <span style="font-size: 0.72rem; color: var(--text-muted);">${st.condition || ''}</span>
              </div>

              <div class="structure-findings-options">
                ${st.findings.map(f => {
                  const isSelected = findings[st.id] === f.id;
                  return `
                    <button class="finding-chip-btn ${isSelected ? 'selected' : ''}" 
                            onclick="window.ClinicalUI.recordImagingFinding('${st.id}', '${f.id}')">
                      ${f.label}
                    </button>
                  `;
                }).join('')}
              </div>
            </div>
          `).join('')}
        </div>

        <!-- Real-time Clinical-Imaging Concordance Meter -->
        ${concordanceAssessment ? `
          <div class="concordance-meter-card ${uiState.engine.session.concordanceLevel}">
            <span style="font-size: 2rem;">${concordanceAssessment.icon}</span>
            <div>
              <h4 style="margin: 0 0 0.2rem; font-size: 1rem; color: var(--text-primary); font-weight: 800;">
                ${concordanceAssessment.label}
              </h4>
              <p style="margin: 0; font-size: 0.84rem; color: var(--text-secondary);">
                ${concordanceAssessment.description}
              </p>
            </div>
          </div>
        ` : ''}

        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 1.5rem; flex-wrap: wrap; gap: 0.75rem;">
          <button class="clinical-action-btn" onclick="window.ClinicalUI.goToStep('exam_summary')">
            <span>← Volver a Concordancia</span>
          </button>
          
          <button class="btn-primary" style="padding: 0.75rem 1.6rem;" onclick="window.ClinicalUI.proceedToGenerator()">
            <span>Establecer Generador Probable →</span>
          </button>
        </div>
      </div>
    `;
  }

  function recordImagingFinding(structureId, findingId) {
    if (!uiState.engine) return;
    uiState.engine.processImagingFinding(structureId, findingId);
    renderCurrentStep();
  }

  function proceedToGenerator() {
    if (!uiState.engine) return;

    if (uiState.simulation) {
      const expectedConc = uiState.simulation.caseData.expectedFlow?.imagingConcordance;
      const actualConc = uiState.engine.session.concordanceLevel || 'high';
      const isConcCorrect = !expectedConc || (expectedConc === actualConc);
      uiState.simulation.evaluateDecision(
        'imagen',
        'imaging_performance',
        true,
        0,
        'Protocolo de imagen completado.'
      );
      uiState.simulation.evaluateDecision(
        'concordancia',
        'clinical_imaging_concordance',
        isConcCorrect,
        25,
        isConcCorrect
          ? 'Correcto: Evaluación de concordancia clínico-radiológica adecuada.'
          : `Discrepancia de concordancia: Se esperaba '${expectedConc}' y se consideró '${actualConc}'. Cuidado con tratar imágenes incidentales.`
      );
      if (expectedConc === 'discordant' && actualConc === 'high') {
        uiState.simulation.recordBias('sesgo_imagen', 'Anclaje en Imagen Incidental', 'Se asumió como generador un hallazgo radiológico no concordante con la clínica.');
      }
    }

    uiState.engine.proceedToGenerator();
    renderCurrentStep();
  }

  // ─────────────────────────────────────────────
  // 9. STEP 5 — PAIN GENERATOR & WORKING DIAGNOSIS
  // ─────────────────────────────────────────────

  function renderGeneratorView(container) {
    const diagnosis = uiState.engine.generateWorkingDiagnosis();
    const gen = diagnosis.generator;

    container.innerHTML = `
      <div class="generator-master-card glass-panel">
        <div class="generator-hero-title">Paso 5 · Generador Probable del Dolor</div>
        
        <h2 class="generator-name-display">
          ${gen ? gen.painGenerator : diagnosis.topHypothesis.name}
        </h2>

        <!-- Distinction Triad: Structural Dx vs Pain Generator vs Mechanism -->
        <div class="generator-triad-grid">
          <div class="generator-triad-box">
            <div class="triad-label">Diagnóstico Estructural</div>
            <div class="triad-val">${gen ? gen.structuralDiagnosis : diagnosis.topHypothesis.name}</div>
          </div>
          <div class="generator-triad-box">
            <div class="triad-label">Mecanismo Fisiopatológico</div>
            <div class="triad-val" style="color: var(--accent-blue);">${gen ? gen.mechanismLabel : 'Predominio Nociceptivo'}</div>
          </div>
          <div class="generator-triad-box">
            <div class="triad-label">Confianza Clínica</div>
            <div class="triad-val" style="color: ${diagnosis.confidenceLevel === 'high' ? 'var(--color-safe)' : 'var(--color-uncertain)'};">
              ${diagnosis.confidenceLabel}
            </div>
          </div>
        </div>

        <!-- Supporting findings vs Alternatives -->
        <div class="summary-grid-2" style="margin-top: 1rem;">
          <div class="summary-subcard">
            <h4 style="color: var(--color-safe);"><span>✅</span> <span>Hallazgos que lo apoyan</span></h4>
            <ul>
              ${diagnosis.supportingFindings.map(f => `<li><span>✓</span> <span>${f}</span></li>`).join('')}
            </ul>
          </div>

          <div class="summary-subcard">
            <h4 style="color: var(--color-uncertain);"><span>🔍</span> <span>Alternativas / Diagnóstico Diferencial</span></h4>
            <ul>
              ${diagnosis.alternatives.map(a => `<li><span>•</span> <span>${a.name}</span></li>`).join('')}
            </ul>
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 1.5rem; flex-wrap: wrap; gap: 0.75rem;">
          <button class="clinical-action-btn" onclick="window.ClinicalUI.goToStep('imaging')">
            <span>← Revisar Imagen</span>
          </button>
          
          <button class="btn-primary" style="padding: 0.75rem 1.6rem;" onclick="window.ClinicalUI.proceedToTreatment()">
            <span>Continuar a Plan Terapéutico Escalonado →</span>
          </button>
        </div>
      </div>
    `;
  }

  function proceedToTreatment() {
    if (!uiState.engine) return;

    if (uiState.simulation) {
      const topHypo = uiState.engine.getHypothesesRanked()[0];
      const expectedHypo = uiState.simulation.caseData.expectedFlow?.topHypothesis;
      const isGenCorrect = !expectedHypo || (topHypo && topHypo.id === expectedHypo);
      uiState.simulation.evaluateDecision(
        'generador',
        'generator_identification',
        isGenCorrect,
        25,
        isGenCorrect
          ? 'Correcto: Generador de dolor identificado con precisión clínica.'
          : `Generador discrepante: La clave diagnóstica era '${uiState.simulation.caseData.expectedFlow?.expectedGenerator || 'específica del caso'}' y el generador seleccionado fue '${topHypo ? topHypo.name : 'no especificado'}'.`
      );
      if (!isGenCorrect) {
        uiState.simulation.recordBias('cierre_prematuro', 'Error de Generador', 'El generador seleccionado no explica la concordancia de los datos clínicos.');
      }
    }

    uiState.engine.proceedToTreatment();
    renderCurrentStep();
  }

  // ─────────────────────────────────────────────
  // ─────────────────────────────────────────────
  // 10. STEP 6 — ADVANCED THERAPEUTIC MODULE 2.0 (8 ESCALONES)
  // ─────────────────────────────────────────────

  function renderTreatmentView(container) {
    if (!uiState.patientProfile) {
      uiState.patientProfile = {
        renal: false,
        hepatic: false,
        cv: false,
        hta: false,
        gi_ulcer: false,
        diabetes: false,
        anticoagulated: false,
        age_over_65: false,
        pregnant: false
      };
    }

    const plan = uiState.engine.getTreatmentPlan(uiState.patientProfile);
    if (!plan) return;

    const prescriptionText = uiState.engine.generateStructuredPrescriptionText(uiState.patientProfile);

    container.innerHTML = `
      <div class="treatment-tiers-stack">
        <!-- Header Badge -->
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
          <div class="home-hero-badge" style="background: rgba(34, 197, 94, 0.15); color: #22c55e; border-color: rgba(34, 197, 94, 0.35);">
            💊 Plan Terapéutico Clínico Estructurado (8 Escalones)
          </div>
          <button class="exam-tool-btn" onclick="window.ClinicalUI.openInjectablesComparisonModal()">
            <span>⚖️</span> <span>Comparar: Corticoide vs PRP vs Ácido Hialurónico</span>
          </button>
        </div>

        <!-- COMORBIDITY SCREENING TOOLBAR -->
        <div class="comorbidity-toolbar-card">
          <div class="comorbidity-toolbar-header">
            <div>
              <strong style="font-size: 0.88rem; color: var(--text-primary);">🛡️ Comorbilidades y Factores del Paciente</strong>
              <p style="margin: 0.15rem 0 0; font-size: 0.74rem; color: var(--text-muted);">Haz clic para activar comorbilidades y ajustar en tiempo real dosis, precauciones y contraindicaciones farmacológicas e intervencionistas.</p>
            </div>
            <span style="font-size: 0.72rem; color: #f59e0b; font-weight: 700;">Ajuste en Tiempo Real ⚡</span>
          </div>

          <div class="comorbidity-chips-grid">
            <div class="comorbidity-chip ${uiState.patientProfile.renal ? 'active' : ''}" onclick="window.ClinicalUI.toggleComorbidity('renal')">
              <span class="chip-status-dot"></span>
              <span>🩺 Insuficiencia Renal (FG <60)</span>
            </div>
            <div class="comorbidity-chip ${uiState.patientProfile.gi_ulcer ? 'active' : ''}" onclick="window.ClinicalUI.toggleComorbidity('gi_ulcer')">
              <span class="chip-status-dot"></span>
              <span>🩸 Úlcera / Sangrado GI</span>
            </div>
            <div class="comorbidity-chip ${uiState.patientProfile.anticoagulated ? 'active' : ''}" onclick="window.ClinicalUI.toggleComorbidity('anticoagulated')">
              <span class="chip-status-dot"></span>
              <span>💊 Anticoagulación / DOAC</span>
            </div>
            <div class="comorbidity-chip ${uiState.patientProfile.cv ? 'active' : ''}" onclick="window.ClinicalUI.toggleComorbidity('cv')">
              <span class="chip-status-dot"></span>
              <span>🫀 Cardiopatía / HTA severa</span>
            </div>
            <div class="comorbidity-chip ${uiState.patientProfile.diabetes ? 'active' : ''}" onclick="window.ClinicalUI.toggleComorbidity('diabetes')">
              <span class="chip-status-dot"></span>
              <span>🍬 Diabetes Mellitus</span>
            </div>
            <div class="comorbidity-chip ${uiState.patientProfile.hepatic ? 'active' : ''}" onclick="window.ClinicalUI.toggleComorbidity('hepatic')">
              <span class="chip-status-dot"></span>
              <span>🧪 Hepatopatía / Cirrosis</span>
            </div>
            <div class="comorbidity-chip ${uiState.patientProfile.age_over_65 ? 'active' : ''}" onclick="window.ClinicalUI.toggleComorbidity('age_over_65')">
              <span class="chip-status-dot"></span>
              <span>👴 Edad > 65 años</span>
            </div>
            <div class="comorbidity-chip ${uiState.patientProfile.pregnant ? 'active' : ''}" onclick="window.ClinicalUI.toggleComorbidity('pregnant')">
              <span class="chip-status-dot"></span>
              <span>🤰 Embarazo</span>
            </div>
          </div>
        </div>

        <!-- RADICULAR CLINICAL PHASE STRATIFICATION (IF APPLICABLE) -->
        ${uiState.engine.pathway.clinicalPhases ? `
          <div class="comorbidity-toolbar-card" style="border-color: rgba(99, 102, 241, 0.4); background: rgba(99, 102, 241, 0.06);">
            <div class="comorbidity-toolbar-header">
              <div>
                <strong style="font-size: 0.92rem; color: var(--accent-blue);">⚡ Estratificación Clínica de la Radiculopatía (¿En qué fase estamos?)</strong>
                <p style="margin: 0.15rem 0 0; font-size: 0.74rem; color: var(--text-muted);">
                  La decisión terapéutica y la indicación de RM/Infiltración dependen de la gravedad, el déficit neurológico y la fase evolutiva, NO de calendarios rígidos.
                </p>
              </div>
            </div>

            <!-- Phase Selector Tabs -->
            <div class="coach-version-selector-bar" style="margin-top: 0.6rem;">
              <button class="coach-version-pill ${(uiState.radicularPhase || 'acute') === 'acute' ? 'active' : ''}" onclick="window.ClinicalUI.setRadicularPhase('acute')">
                <span>⚡</span> <span>Fase Aguda (&lt;6 semanas)</span>
              </button>
              <button class="coach-version-pill ${(uiState.radicularPhase || 'acute') === 'subacute' ? 'active' : ''}" onclick="window.ClinicalUI.setRadicularPhase('subacute')">
                <span>⏱️</span> <span>Fase Subaguda (6-12 semanas)</span>
              </button>
              <button class="coach-version-pill ${(uiState.radicularPhase || 'acute') === 'chronic' ? 'active' : ''}" onclick="window.ClinicalUI.setRadicularPhase('chronic')">
                <span>⏳</span> <span>Fase Crónica (&gt;12 semanas)</span>
              </button>
            </div>

            <!-- Phase Principles Box -->
            <div class="structure-box" style="margin-top: 0.75rem; border-left: 4px solid #f59e0b;">
              <div style="font-size: 0.86rem; font-weight: 800; color: #b45309; margin-bottom: 0.4rem;">
                📌 Hoja de Ruta para ${(uiState.engine.pathway.clinicalPhases[uiState.radicularPhase || 'acute'] || {}).label}:
              </div>
              <ul style="margin: 0 0 0 1.2rem; padding: 0; font-size: 0.8rem; color: var(--text-primary); line-height: 1.5;">
                ${((uiState.engine.pathway.clinicalPhases[uiState.radicularPhase || 'acute'] || {}).principles || []).map(pr => `
                  <li style="margin-bottom: 0.25rem;">${pr}</li>
                `).join('')}
              </ul>
            </div>
          </div>
        ` : ''}

        <!-- ESCALÓN 1: EDUCACIÓN -->
        <div class="treatment-tier-card glass-panel">
          <div class="tier-header">
            <div class="tier-title-group">
              <span class="tier-num-badge">1</span>
              <h3 class="tier-title">${plan.tiers[0].title}</h3>
            </div>
            <span class="treatment-badge-pill green">${plan.tiers[0].badge}</span>
          </div>
          <div class="tier-body">
            <p style="font-size: 0.88rem; color: var(--text-primary); line-height: 1.5; margin-bottom: 0.5rem;">
              «${plan.tiers[0].patientText}»
            </p>
            ${uiState.mentorMode && plan.tiers[0].mentorNote ? `
              <div class="question-mentor-tip" style="margin-bottom: 0.5rem;">
                <span>🧠</span> <span><strong>Clave del Experto:</strong> ${plan.tiers[0].mentorNote}</span>
              </div>
            ` : ''}
            <div class="treatment-why-card">
              <strong>¿Por qué este tratamiento?</strong> ${plan.tiers[0].whyThisTreatment}
            </div>
            <div class="treatment-when-not-card">
              <strong>🚫 Cuándo NO lo utilizaría:</strong> ${plan.tiers[0].whenToAvoid}
            </div>
          </div>
        </div>

        <!-- ESCALÓN 2: ACTIVIDAD Y MANEJO DE CARGA -->
        <div class="treatment-tier-card glass-panel">
          <div class="tier-header">
            <div class="tier-title-group">
              <span class="tier-num-badge">2</span>
              <h3 class="tier-title">${plan.tiers[1].title}</h3>
            </div>
            <span class="treatment-badge-pill green">${plan.tiers[1].badge}</span>
          </div>
          <div class="tier-body">
            <ul style="margin: 0 0 0.5rem 1.25rem; padding: 0; font-size: 0.84rem; color: var(--text-primary); line-height: 1.5;">
              ${plan.tiers[1].principles.map(p => `<li>${p}</li>`).join('')}
            </ul>
            <div class="treatment-why-card">
              <strong>¿Por qué este tratamiento?</strong> ${plan.tiers[1].whyThisTreatment}
            </div>
            <div class="treatment-when-not-card">
              <strong>🚫 Cuándo NO lo utilizaría:</strong> ${plan.tiers[1].whenToAvoid}
            </div>
          </div>
        </div>

        <!-- ESCALÓN 3: EJERCICIO TERAPÉUTICO (DOSIS DE CARGA) -->
        <div class="treatment-tier-card glass-panel">
          <div class="tier-header">
            <div class="tier-title-group">
              <span class="tier-num-badge">3</span>
              <h3 class="tier-title">${plan.tiers[2].title}</h3>
            </div>
            <span class="treatment-badge-pill green">${plan.tiers[2].badge}</span>
          </div>
          <div class="tier-body">
            <p style="font-size: 0.86rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.75rem;">
              Objetivo Biomecánico: ${plan.tiers[2].objective}
            </p>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 0.6rem; margin-bottom: 0.75rem;">
              ${(plan.tiers[2].phases || []).map(ph => `
                <div class="generator-triad-box">
                  <div class="triad-label">${ph.name} (${ph.duration || ''})</div>
                  <div class="triad-val" style="font-size: 0.78rem; font-weight: 600; line-height: 1.35;">${ph.description}</div>
                </div>
              `).join('')}
            </div>
            <p style="font-size: 0.8rem; color: var(--text-secondary); margin: 0;">
              💡 <strong>Regla de Dosis de Carga:</strong> ${plan.tiers[2].loadGuidance}
            </p>
            <div class="treatment-why-card">
              <strong>¿Por qué este tratamiento?</strong> ${plan.tiers[2].whyThisTreatment}
            </div>
            <div class="treatment-when-not-card">
              <strong>🚫 Cuándo NO lo utilizaría:</strong> ${plan.tiers[2].whenToAvoid}
            </div>
          </div>
        </div>

        <!-- ESCALÓN 4: PLAN DE FISIOTERAPIA SUPERVISADA Y DOMICILIARIA -->
        <div class="treatment-tier-card glass-panel">
          <div class="tier-header">
            <div class="tier-title-group">
              <span class="tier-num-badge">4</span>
              <h3 class="tier-title">${plan.tiers[3].title}</h3>
            </div>
            <span class="treatment-badge-pill green">${plan.tiers[3].badge}</span>
          </div>
          <div class="tier-body">
            <h4 style="margin: 0 0 0.5rem; font-size: 0.92rem; color: var(--text-primary);">${plan.tiers[3].protocolName}</h4>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 0.6rem; margin-bottom: 0.75rem;">
              <div class="structure-box">
                <div style="font-size: 0.72rem; color: var(--text-muted); font-weight: 800; text-transform: uppercase;">Sesiones Supervisadas</div>
                <p style="margin: 0.25rem 0 0; font-size: 0.8rem; color: var(--text-primary);">${plan.tiers[3].supervisedSessions?.number || 'Individualizado'} (${plan.tiers[3].supervisedSessions?.frequency || '1 ses/sem'})</p>
              </div>
              <div class="structure-box">
                <div style="font-size: 0.72rem; color: var(--text-muted); font-weight: 800; text-transform: uppercase;">Pauta Domiciliaria Activa</div>
                <p style="margin: 0.25rem 0 0; font-size: 0.8rem; color: var(--text-primary);">${plan.tiers[3].homeExercise?.frequency || '3-5 días/semana'}</p>
              </div>
              <div class="structure-box">
                <div style="font-size: 0.72rem; color: var(--text-muted); font-weight: 800; text-transform: uppercase;">Reevaluación de Función</div>
                <p style="margin: 0.25rem 0 0; font-size: 0.8rem; color: var(--text-primary);">${plan.tiers[3].reassessment || 'A las 6 semanas'}</p>
              </div>
            </div>
            <div class="treatment-why-card">
              <strong>¿Por qué este tratamiento?</strong> ${plan.tiers[3].whyThisTreatment}
            </div>
            <div class="treatment-when-not-card">
              <strong>🚫 Cuándo NO lo utilizaría:</strong> ${plan.tiers[3].whenToAvoid}
            </div>
          </div>
        </div>

        <!-- ESCALÓN 5: FARMACOLOGÍA CON DOSIFICACIÓN CONTEXTUALIZADA -->
        <div class="treatment-tier-card glass-panel">
          <div class="tier-header">
            <div class="tier-title-group">
              <span class="tier-num-badge">5</span>
              <h3 class="tier-title">${plan.tiers[4].title}</h3>
            </div>
            <span class="treatment-badge-pill blue">${plan.tiers[4].badge}</span>
          </div>
          <div class="tier-body">
            <p style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 0.75rem;">${plan.tiers[4].generalAdvice}</p>
            
            <!-- Analgesics & Anti-inflammatories Grid -->
            <div style="display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1.25rem;">
              ${(plan.tiers[4].options || []).map(opt => `
                <div class="structure-box" style="${opt.isContraindicated ? 'border-color: rgba(239, 68, 68, 0.4); background: rgba(239, 68, 68, 0.06);' : ''}">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem; flex-wrap: wrap; gap: 0.3rem;">
                    <div>
                      <strong style="font-size: 0.92rem; color: ${opt.isContraindicated ? '#ef4444' : 'var(--text-primary)'};">${opt.genericName}</strong>
                      <span style="font-size: 0.74rem; color: var(--text-muted); margin-left: 0.4rem;">(${opt.category})</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.35rem;">
                      <button class="vade-link-btn-mini" onclick="window.Vademecum.openDrug('${opt.id?.startsWith('med-') ? opt.id : 'med-' + opt.id.replace(/_/g, '-')}', true)" title="Ver ficha en Vademécum">
                        💊 Vademécum
                      </button>
                      <span class="pres-badge-status ${opt.isContraindicated ? 'upcoming' : 'available'}" style="font-size: 0.68rem;">
                        ${opt.isContraindicated ? '🚫 Desaconsejado' : 'Opción Activa'}
                      </span>
                    </div>
                  </div>

                  <div class="pharma-spec-grid">
                    <div class="pharma-spec-item">
                      <strong>Dosis Habitual</strong>
                      <span>${opt.usualDose} (${opt.frequency})</span>
                    </div>
                    <div class="pharma-spec-item">
                      <strong>Dosis Máxima</strong>
                      <span>${opt.maximumDose || 'Ver ficha'}</span>
                    </div>
                    <div class="pharma-spec-item">
                      <strong>Duración Recomendada</strong>
                      <span>${opt.duration || 'Ciclo corto'}</span>
                    </div>
                    <div class="pharma-spec-item">
                      <strong>Ajuste Renal / Hepático</strong>
                      <span>${opt.renalAdjustment ? opt.renalAdjustment.substring(0, 45) + '...' : 'Estándar'}</span>
                    </div>
                  </div>

                  ${opt.taperingSchedule ? `
                    <div style="background: rgba(16, 185, 129, 0.06); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: var(--radius-sm); padding: 0.5rem 0.75rem; margin-top: 0.45rem;">
                      <strong style="font-size: 0.82rem; color: #10b981; display: block; margin-bottom: 0.3rem;">📋 Pauta Descendente Escalonada Dr. Curro Mir (16 días):</strong>
                      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 0.35rem; font-size: 0.74rem;">
                        ${opt.taperingSchedule.map(s => `
                          <div style="background: var(--bg-surface); padding: 0.3rem 0.45rem; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
                            <strong style="color: var(--text-primary); display: block;">${s.days}</strong>
                            <span style="color: #60a5fa; font-weight: 700;">${s.dose} (${s.tabletFraction})</span>
                          </div>
                        `).join('')}
                      </div>
                    </div>
                  ` : ''}

                  ${(opt.activeWarnings || []).map(w => `
                    <div class="pharma-warning-pill">${w}</div>
                  `).join('')}

                  ${opt.evidenceNote ? `
                    <div style="font-size: 0.76rem; color: #fbbf24; background: rgba(245, 158, 11, 0.1); padding: 0.4rem 0.6rem; border-radius: var(--radius-sm); margin-top: 0.35rem;">
                      <strong>Evidencia Ensayo Clínico:</strong> ${opt.evidenceNote}
                    </div>
                  ` : ''}

                  <div class="treatment-why-card" style="margin-top: 0.4rem;">
                    <strong>¿Por qué?:</strong> ${opt.whyThisTreatment || opt.indication}
                  </div>
                  <div class="treatment-when-not-card" style="margin-top: 0.3rem;">
                    <strong>🚫 Cuándo evitarlo:</strong> ${opt.whenToAvoid || 'Ver contraindicaciones'}
                  </div>
                </div>
              `).join('')}
            </div>

            <!-- 🧠 NEUROMODULACIÓN FARMACOLÓGICA ESTRUCTURADA -->
            ${plan.tiers[4].neuromodulation ? `
              <div class="structure-box" style="margin-top: 1rem; border-color: rgba(99, 102, 241, 0.35); padding: 1.15rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; flex-wrap: wrap; gap: 0.4rem;">
                  <h4 style="margin: 0; font-size: 1.05rem; font-weight: 800; color: var(--accent-blue);">🧠 ${plan.tiers[4].neuromodulation.title}</h4>
                  <span class="treatment-badge-pill blue" style="font-size: 0.7rem;">NeuPSIG 2025 / NICE</span>
                </div>

                <!-- Golden Principle Banner -->
                <div class="safety-header-banner safe" style="margin-bottom: 0.85rem; padding: 0.75rem 1rem;">
                  <span class="safety-banner-icon" style="font-size: 1.75rem;">💡</span>
                  <div class="safety-banner-text">
                    <strong>Mensaje Clínico Fundamental:</strong>
                    <p>«${plan.tiers[4].neuromodulation.principle}»</p>
                  </div>
                </div>

                <!-- Safety Pre-Checklist -->
                <div style="margin-bottom: 1rem;">
                  <div style="font-size: 0.76rem; font-weight: 800; color: var(--text-primary); text-transform: uppercase; margin-bottom: 0.4rem; letter-spacing: 0.03em;">
                    Comprobaciones Previas Obligatorias:
                  </div>
                  <div style="display: flex; flex-wrap: wrap; gap: 0.4rem;">
                    ${plan.tiers[4].neuromodulation.safetyChecklist.map(chk => `
                      <span class="checklist-safety-pill">
                        ✓ ${chk}
                      </span>
                    `).join('')}
                  </div>
                </div>

                <!-- Neuromodulators List -->
                <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                  ${(plan.tiers[4].neuromodulation.drugs || []).map(drug => `
                    <div class="neuromod-drug-card ${!drug.isRoutinelyRecommended ? 'not-recommended' : ''}">
                      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.45rem; flex-wrap: wrap; gap: 0.4rem;">
                        <strong style="font-size: 0.95rem; font-weight: 800; color: ${!drug.isRoutinelyRecommended ? '#dc2626' : 'var(--text-primary)'};">${drug.genericName}</strong>
                        <div style="display: flex; align-items: center; gap: 0.35rem;">
                          <button class="vade-link-btn-mini" onclick="window.Vademecum.openDrug('${drug.id?.startsWith('med-') ? drug.id : 'med-' + drug.id.replace(/_/g, '-')}', true)" title="Ver ficha en Vademécum">
                            💊 Vademécum
                          </button>
                          <span class="treatment-badge-pill ${drug.overrideBadge?.includes('🔴') ? 'red' : drug.overrideBadge?.includes('🟢') ? 'green' : 'yellow'}" style="font-size: 0.68rem;">
                            ${drug.overrideBadge || 'Indicado'}
                          </span>
                        </div>
                      </div>
                      <div class="pharma-spec-grid" style="grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));">
                        <div class="pharma-spec-item">
                          <strong>Inicio Práctico</strong>
                          <span>${drug.initialDose}</span>
                        </div>
                        <div class="pharma-spec-item">
                          <strong>Rango Analgésico Habitual</strong>
                          <span>${drug.usualDose}</span>
                        </div>
                        <div class="pharma-spec-item">
                          <strong>Dosis Máxima</strong>
                          <span>${drug.maximumDose}</span>
                        </div>
                      </div>
                      ${drug.overrideReason ? `
                        <div style="font-size: 0.78rem; font-weight: 600; color: #b91c1c; background: #fef2f2; border: 1px solid #fca5a5; padding: 0.45rem 0.65rem; border-radius: var(--radius-sm); margin-top: 0.45rem;">
                          ${drug.overrideReason}
                        </div>
                      ` : ''}
                      ${(drug.activeWarnings || []).map(w => `
                        <div class="pharma-warning-pill">${w}</div>
                      `).join('')}
                    </div>
                  `).join('')}
                </div>
              </div>
            ` : ''}
          </div>
        </div>

        <!-- ESCALÓN 6: TERAPIAS FÍSICAS ESPECÍFICAS (ESWT & EMTT) -->
        <div class="treatment-tier-card glass-panel">
          <div class="tier-header">
            <div class="tier-title-group">
              <span class="tier-num-badge">6</span>
              <h3 class="tier-title">${plan.tiers[5].title}</h3>
            </div>
            <span class="treatment-badge-pill orange">${plan.tiers[5].badge}</span>
          </div>
          <div class="tier-body">
            <div class="tech-distinction-banner">
              <span style="font-size: 1.3rem;">💡</span>
              <div>
                <strong>Diferenciación Tecnológica Estricta:</strong> ${plan.tiers[5].technologyDistinction}
              </div>
            </div>

            <!-- ESWT SECTION -->
            ${plan.tiers[5].eswt ? `
              <div class="structure-box" style="margin-bottom: 0.75rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem; flex-wrap: wrap;">
                  <h4 style="margin: 0; font-size: 0.92rem; color: var(--text-primary);">⚡ Ondas de Choque Extracorpóreas: ${plan.tiers[5].eswt.name}</h4>
                  <span class="treatment-badge-pill ${plan.tiers[5].eswt.badge?.includes('ALTA') ? 'green' : plan.tiers[5].eswt.badge?.includes('EMERGENTE') ? 'orange' : 'red'}" style="font-size: 0.68rem;">
                    ${plan.tiers[5].eswt.badge || 'Evaluada'}
                  </span>
                </div>
                ${plan.tiers[5].eswt.statusNote ? `<p style="font-size: 0.8rem; color: #ef4444; font-weight: 700; margin: 0.25rem 0;">${plan.tiers[5].eswt.statusNote}</p>` : ''}
                ${plan.tiers[5].eswt.parameters ? `
                  <div class="pharma-spec-grid">
                    <div class="pharma-spec-item">
                      <strong>Tipo y Sesiones</strong>
                      <span>${plan.tiers[5].eswt.type} · ${plan.tiers[5].eswt.sessions} (${plan.tiers[5].eswt.interval})</span>
                    </div>
                    <div class="pharma-spec-item">
                      <strong>Densidad de Energía</strong>
                      <span>${plan.tiers[5].eswt.parameters.energyDensity}</span>
                    </div>
                    <div class="pharma-spec-item">
                      <strong>Impulsos y Frecuencia</strong>
                      <span>${plan.tiers[5].eswt.parameters.impulses} · ${plan.tiers[5].eswt.parameters.frequency}</span>
                    </div>
                    <div class="pharma-spec-item">
                      <strong>Anestesia Local</strong>
                      <span>${plan.tiers[5].eswt.parameters.localAnesthesia || 'No recomendada'}</span>
                    </div>
                  </div>
                  ${plan.tiers[5].eswt.alternativeOption ? `<p style="font-size: 0.78rem; color: var(--accent-blue); margin: 0.25rem 0;"><strong>Alternativa:</strong> ${plan.tiers[5].eswt.alternativeOption}</p>` : ''}
                ` : ''}
                <div class="treatment-why-card">
                  <strong>¿Por qué?:</strong> ${plan.tiers[5].eswt.whyThisTreatment}
                </div>
                <div class="treatment-when-not-card">
                  <strong>🚫 Cuándo NO:</strong> ${plan.tiers[5].eswt.whenToAvoid}
                </div>
              </div>
            ` : ''}

            <!-- EMTT MAGNETOLITH SECTION -->
            ${plan.tiers[5].emtt ? `
              <div class="structure-box">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem; flex-wrap: wrap;">
                  <h4 style="margin: 0; font-size: 0.92rem; color: #a78bfa;">🧲 EMTT — Magnetolith®: ${plan.tiers[5].emtt.name}</h4>
                  <span class="treatment-badge-pill orange" style="font-size: 0.68rem;">${plan.tiers[5].emtt.evidenceBadge}</span>
                </div>
                <p style="font-size: 0.8rem; color: var(--text-secondary); margin: 0.25rem 0;">${plan.tiers[5].emtt.technologyNote}</p>
                <div class="pharma-spec-grid">
                  <div class="pharma-spec-item">
                    <strong>Protocolo de Ensayo</strong>
                    <span>${plan.tiers[5].emtt.trialProtocol.sessions} (${plan.tiers[5].emtt.trialProtocol.frequency})</span>
                  </div>
                  <div class="pharma-spec-item">
                    <strong>Intensidad y Pulsos</strong>
                    <span>${plan.tiers[5].emtt.trialProtocol.parameters}</span>
                  </div>
                  <div class="pharma-spec-item">
                    <strong>Duración Sesión</strong>
                    <span>${plan.tiers[5].emtt.trialProtocol.duration}</span>
                  </div>
                  <div class="pharma-spec-item">
                    <strong>Estatus de Evidencia</strong>
                    <span>Emergente / Terapia complementaria</span>
                  </div>
                </div>
                <div class="treatment-why-card">
                  <strong>¿Por qué?:</strong> ${plan.tiers[5].emtt.whyThisTreatment}
                </div>
                <div class="treatment-when-not-card">
                  <strong>🚫 Cuándo NO:</strong> ${plan.tiers[5].emtt.whenToAvoid}
                </div>
              </div>
            ` : ''}
          </div>
        </div>

        <!-- ESCALÓN 7: INFILTRACIÓN / INTERVENCIONISMO -->
        <div class="treatment-tier-card glass-panel" style="${plan.tiers[6].isBlocked ? 'opacity: 0.7;' : ''}">
          <div class="tier-header">
            <div class="tier-title-group">
              <span class="tier-num-badge">7</span>
              <h3 class="tier-title">${plan.tiers[6].title}</h3>
            </div>
            <span class="treatment-badge-pill ${plan.tiers[6].isBlocked ? 'red' : 'green'}">${plan.tiers[6].badge}</span>
          </div>
          <div class="tier-body">
            ${plan.tiers[6].isBlocked ? `
              <p style="font-size: 0.84rem; color: var(--color-alarm); font-weight: 700; margin-bottom: 0.5rem;">
                ${plan.tiers[6].blockReason || '⚠️ Requiere confirmar concordancia clínico-imagen (alta o parcial) antes de proceder con técnica invasiva.'}
              </p>
            ` : `
              <div class="intervention-window-banner" style="margin-bottom: 0.75rem;">
                <span>🪟</span> <span><strong>${plan.tiers[6].philosophy}</strong></span>
              </div>
            `}

            <!-- PATHWAY SPECIFIC INTERVENTIONAL TARGETS WITH EXACT DOSAGES -->
            ${(plan.tiers[6].pathwayTargets && plan.tiers[6].pathwayTargets.length > 0) ? `
              <div class="structure-box" style="margin-bottom: 0.75rem; border-color: rgba(16, 185, 129, 0.4); background: rgba(16, 185, 129, 0.04);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem; flex-wrap: wrap;">
                  <h4 style="margin: 0; font-size: 0.95rem; font-weight: 800; color: #10b981; display: flex; align-items: center; gap: 0.4rem;">
                    <span>💉</span> <span>Técnica Intervencionista y Dosificación Específica:</span>
                  </h4>
                  <span class="treatment-badge-pill green" style="font-size: 0.72rem;">Protocolo Clínico & Evidencia</span>
                </div>
                ${plan.tiers[6].pathwayCondition ? `<p style="font-size: 0.78rem; color: var(--text-secondary); margin: 0 0 0.5rem;"><strong>Condición:</strong> ${plan.tiers[6].pathwayCondition}</p>` : ''}
                
                <div style="display: flex; flex-direction: column; gap: 0.65rem;">
                  ${plan.tiers[6].pathwayTargets.map(tgt => `
                    <div class="structure-box" style="background: rgba(255, 255, 255, 0.03); border-color: var(--border-color);">
                      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.35rem; flex-wrap: wrap; gap: 0.4rem;">
                        <strong style="font-size: 0.88rem; color: var(--text-primary);">${tgt.name}</strong>
                      </div>
                      ${tgt.indication ? `<p style="font-size: 0.78rem; color: var(--text-secondary); margin: 0 0 0.4rem;"><strong>Indicación:</strong> ${tgt.indication}</p>` : ''}
                      
                      <div class="pharma-spec-grid" style="margin-bottom: 0.4rem;">
                        ${tgt.localAnesthetic ? `
                          <div class="pharma-spec-item">
                            <strong style="color: #60a5fa;">💉 Anestésico Local (AL)</strong>
                            <span>${tgt.localAnesthetic.drug} · ${tgt.localAnesthetic.volume} ${tgt.localAnesthetic.dose ? '(' + tgt.localAnesthetic.dose + ')' : ''}</span>
                          </div>
                        ` : ''}
                        ${tgt.corticosteroid ? `
                          <div class="pharma-spec-item">
                            <strong style="color: ${(tgt.corticosteroid.drug && (tgt.corticosteroid.drug.includes('PROHIBIDO') || tgt.corticosteroid.drug.includes('SIN CORTICOIDE'))) ? '#ef4444' : '#10b981'};">💊 Corticoide / Inyectable</strong>
                            <span>${tgt.corticosteroid.drug} ${tgt.corticosteroid.dose ? '· ' + tgt.corticosteroid.dose : ''} ${tgt.corticosteroid.volume ? '(' + tgt.corticosteroid.volume + ')' : ''}</span>
                          </div>
                        ` : ''}
                        ${tgt.totalVolume ? `
                          <div class="pharma-spec-item">
                            <strong style="color: #f59e0b;">📏 Volumen Total</strong>
                            <span>${tgt.totalVolume}</span>
                          </div>
                        ` : ''}
                      </div>

                      ${(tgt.safetyWarnings && tgt.safetyWarnings.length > 0) ? `
                        <div style="border-top: 1px solid var(--border-color); padding-top: 0.35rem; margin-top: 0.35rem;">
                          ${tgt.safetyWarnings.map(sw => `
                            <p style="font-size: 0.74rem; color: #ef4444; font-weight: 600; margin: 0.15rem 0;">⚠️ ${sw}</p>
                          `).join('')}
                        </div>
                      ` : ''}
                    </div>
                  `).join('')}
                </div>
              </div>
            ` : ''}

            <!-- CORTICOSTEROID INJECTION -->
            ${plan.tiers[6].corticosteroid ? `
              <div class="structure-box" style="margin-bottom: 0.65rem;">
                <h4 style="margin: 0 0 0.25rem; font-size: 0.9rem; color: var(--text-primary);">💉 Infiltración con Corticoides: ${plan.tiers[6].corticosteroid.name}</h4>
                <div class="pharma-spec-grid">
                  <div class="pharma-spec-item">
                    <strong>Fármaco y Dosis</strong>
                    <span>${plan.tiers[6].corticosteroid.drugOptions ? plan.tiers[6].corticosteroid.drugOptions[0].drug : 'Triamcinolona 20-40mg / Betametasona 6mg'}</span>
                  </div>
                  <div class="pharma-spec-item">
                    <strong>Volumen y Anestésico</strong>
                    <span>${plan.tiers[6].corticosteroid.drugOptions ? plan.tiers[6].corticosteroid.drugOptions[0].totalVolume : '3-5 ml'} con AL</span>
                  </div>
                  <div class="pharma-spec-item">
                    <strong>Frecuencia Máxima</strong>
                    <span>${plan.tiers[6].corticosteroid.maxFrequency || 'Máx 2-3 al año'}</span>
                  </div>
                </div>
                ${plan.tiers[6].corticosteroid.tendonWarning ? `<p style="font-size: 0.76rem; color: #ef4444; font-weight: 700; margin: 0.25rem 0;">⚠️ ${plan.tiers[6].corticosteroid.tendonWarning}</p>` : ''}
              </div>
            ` : ''}

            <!-- HYALURONIC ACID (HA) -->
            ${plan.tiers[6].hyaluronicAcid ? `
              <div class="structure-box" style="margin-bottom: 0.65rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem; flex-wrap: wrap;">
                  <h4 style="margin: 0; font-size: 0.9rem; color: #60a5fa;">💧 Ácido Hialurónico: ${plan.tiers[6].hyaluronicAcid.name}</h4>
                  <span class="treatment-badge-pill yellow" style="font-size: 0.68rem;">${plan.tiers[6].hyaluronicAcid.evidence?.badge || 'Pacientes seleccionados'}</span>
                </div>
                <p style="font-size: 0.78rem; color: var(--text-secondary); margin: 0.25rem 0;">${plan.tiers[6].hyaluronicAcid.clinicalRole}</p>
                <div class="pharma-spec-grid">
                  ${(plan.tiers[6].hyaluronicAcid.productCategories || []).map(pc => `
                    <div class="pharma-spec-item">
                      <strong>${pc.type}</strong>
                      <span>${pc.injections} (${pc.interval}) · Duración: ${pc.expectedDuration}</span>
                    </div>
                  `).join('')}
                </div>
              </div>
            ` : ''}

            <!-- PRP -->
            ${plan.tiers[6].prp ? `
              <div class="structure-box" style="margin-bottom: 0.65rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem; flex-wrap: wrap;">
                  <h4 style="margin: 0; font-size: 0.9rem; color: #f87171;">🩸 Plasma Rico en Plaquetas (PRP): ${plan.tiers[6].prp.name}</h4>
                  <span class="treatment-badge-pill blue" style="font-size: 0.68rem;">${plan.tiers[6].prp.evidence?.badge || 'Evidencia Moderada'}</span>
                </div>
                <div class="pharma-spec-grid">
                  <div class="pharma-spec-item">
                    <strong>Tipo de Preparación</strong>
                    <span>${plan.tiers[6].prp.preparationClassification}</span>
                  </div>
                  <div class="pharma-spec-item">
                    <strong>Volumen y Sesiones</strong>
                    <span>${plan.tiers[6].prp.volume} · ${plan.tiers[6].prp.sessions} (${plan.tiers[6].prp.interval})</span>
                  </div>
                  <div class="pharma-spec-item">
                    <strong>Pauta Post-Infiltración</strong>
                    <span>${plan.tiers[6].prp.postProcedureLoad ? plan.tiers[6].prp.postProcedureLoad.substring(0, 50) + '...' : 'Carga progresiva'}</span>
                  </div>
                </div>
              </div>
            ` : ''}

            <!-- SPINAL INTERVENTIONS: EPIDURAL SELECTOR & RADIOFREQUENCY -->
            ${plan.tiers[6].spinal?.approaches ? `
              <div class="structure-box" style="margin-bottom: 0.65rem; border-color: rgba(99, 102, 241, 0.4); background: rgba(99, 102, 241, 0.05);">
                <h4 style="margin: 0 0 0.35rem; font-size: 0.98rem; font-weight: 800; color: var(--accent-blue);">🎯 Selección de Técnica Epidural Lumbar (Por Anatomía y Objetivo):</h4>
                <p style="font-size: 0.8rem; color: var(--text-secondary); margin: 0 0 0.65rem;">${plan.tiers[6].spinal.expectedBenefit}</p>
                
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 0.75rem; margin-bottom: 0.75rem;">
                  ${plan.tiers[6].spinal.approaches.map(ap => `
                    <div class="structure-box" style="background: var(--bg-surface); border-color: var(--border-color);">
                      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.35rem; flex-wrap: wrap; gap: 0.4rem;">
                        <strong style="font-size: 0.9rem; color: var(--text-primary);">${ap.name}</strong>
                        <span class="treatment-badge-pill ${ap.evidence?.badge?.includes('ALTA') ? 'green' : 'blue'}" style="font-size: 0.68rem;">${ap.evidence?.badge || 'Reconocida'}</span>
                      </div>
                      <p style="font-size: 0.78rem; color: var(--text-secondary); margin: 0 0 0.25rem;"><strong>Indicación:</strong> ${ap.indication}</p>
                      <p style="font-size: 0.76rem; color: var(--accent-blue); font-weight: 600; margin: 0 0 0.4rem;"><strong>Ventaja:</strong> ${ap.advantage || ap.concept}</p>
                      
                      <div class="pharma-spec-grid" style="margin-bottom: 0.4rem;">
                        ${ap.localAnesthetic ? `
                          <div class="pharma-spec-item">
                            <strong style="color: #60a5fa;">💉 Anestésico Local (AL)</strong>
                            <span>${ap.localAnesthetic.drug || ''} · ${ap.localAnesthetic.volume || ''} ${ap.localAnesthetic.dose ? '(' + ap.localAnesthetic.dose + ')' : ''}</span>
                          </div>
                        ` : (ap.drugs ? `<div class="pharma-spec-item"><strong style="color: #60a5fa;">💉 Fármacos</strong><span>${ap.drugs}</span></div>` : '')}
                        ${ap.corticosteroid ? `
                          <div class="pharma-spec-item">
                            <strong style="color: ${ap.corticosteroid.drug?.includes('NO PARTICULADA') ? '#10b981' : '#ef4444'};">💊 Corticoide / Inyectable</strong>
                            <span>${ap.corticosteroid.drug || ''} ${ap.corticosteroid.dose ? '· ' + ap.corticosteroid.dose : ''} ${ap.corticosteroid.volume ? '(' + ap.corticosteroid.volume + ')' : ''}</span>
                          </div>
                        ` : ''}
                        ${ap.totalVolume || ap.volume ? `
                          <div class="pharma-spec-item">
                            <strong style="color: #f59e0b;">📏 Volumen Total</strong>
                            <span>${ap.totalVolume || ap.volume}</span>
                          </div>
                        ` : ''}
                      </div>

                      ${(ap.safetyWarnings && ap.safetyWarnings.length > 0) ? `
                        <div style="background: rgba(239, 68, 68, 0.06); border: 1px solid rgba(239, 68, 68, 0.25); border-radius: var(--radius-sm); padding: 0.35rem 0.5rem; margin-top: 0.35rem;">
                          ${ap.safetyWarnings.map(w => `
                            <div style="font-size: 0.72rem; color: #ef4444; font-weight: 600; margin: 0.1rem 0;">⚠️ ${w}</div>
                          `).join('')}
                        </div>
                      ` : ''}
                    </div>
                  `).join('')}
                </div>

                <!-- Radiofrequency Distinction -->
                <div style="border-top: 1px solid var(--border-color); padding-top: 0.65rem; margin-top: 0.5rem;">
                  <div style="font-size: 0.78rem; color: #ef4444; font-weight: 700; margin-bottom: 0.4rem;">
                    ${plan.tiers[6].spinal.facetRfWarning}
                  </div>
                  ${plan.tiers[6].spinal.drgPrf ? `
                    <div class="structure-box" style="background: rgba(245, 158, 11, 0.08); border-color: rgba(245, 158, 11, 0.3);">
                      <div style="display: flex; justify-content: space-between; align-items: center;">
                        <strong style="font-size: 0.82rem; color: #f59e0b;">⚡ ${plan.tiers[6].spinal.drgPrf.name}</strong>
                        <span class="treatment-badge-pill orange" style="font-size: 0.74rem;">Opción Avanzada / Evidencia Limitada</span>
                      </div>
                      <p style="font-size: 0.76rem; color: var(--text-secondary); margin: 0.25rem 0 0;">${plan.tiers[6].spinal.drgPrf.indication} (Revisiones 2024-2025: posible alivio analgésico a 3 meses con baja certeza global).</p>
                    </div>
                  ` : ''}
                </div>
              </div>
            ` : ''}

            <!-- PROTOCOLIZED RADIOFREQUENCY (THERMAL / PRF / COOLED) -->
            ${plan.tiers[6].radiofrequency ? `
              <div class="structure-box" style="margin-bottom: 0.75rem; border-color: rgba(99, 102, 241, 0.45); background: rgba(99, 102, 241, 0.05);">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.4rem; flex-wrap: wrap; gap: 0.4rem;">
                  <div>
                    <h4 style="margin: 0; font-size: 0.98rem; font-weight: 800; color: var(--accent-blue); display: flex; align-items: center; gap: 0.4rem;">
                      <span>⚡</span> <span>${plan.tiers[6].radiofrequency.name}</span>
                    </h4>
                    <span style="font-size: 0.76rem; color: #a5b4fc; font-weight: 700;">${plan.tiers[6].radiofrequency.type}</span>
                  </div>
                  ${plan.tiers[6].radiofrequency.evidence?.badge ? `<span class="treatment-badge-pill green" style="font-size: 0.7rem;">${plan.tiers[6].radiofrequency.evidence.badge}</span>` : ''}
                </div>

                <div style="margin-bottom: 0.45rem;">
                  <p style="font-size: 0.8rem; color: var(--text-secondary); margin: 0 0 0.25rem;"><strong>🎯 Diana:</strong> ${plan.tiers[6].radiofrequency.target}</p>
                  <p style="font-size: 0.78rem; color: var(--text-muted); margin: 0 0 0.25rem;"><strong>Indicación:</strong> ${plan.tiers[6].radiofrequency.indication}</p>
                  ${plan.tiers[6].radiofrequency.requiredDiagnosticTest ? `<p style="font-size: 0.76rem; color: #f59e0b; font-weight: 700; margin: 0 0 0.4rem;">🔍 Test Requerido: ${plan.tiers[6].radiofrequency.requiredDiagnosticTest}</p>` : ''}
                </div>

                <!-- Facet Level Breakdown by Clinical Pattern (if available) -->
                ${plan.tiers[6].radiofrequency.facetLevelMapping ? `
                  <div style="background: rgba(99, 102, 241, 0.06); border: 1px solid rgba(99, 102, 241, 0.3); border-radius: var(--radius-sm); padding: 0.5rem 0.65rem; margin-bottom: 0.45rem;">
                    <strong style="font-size: 0.8rem; color: #a5b4fc; display: block; margin-bottom: 0.2rem;">📍 Mapeo de Facetas y Dianas por Clínica:</strong>
                    <p style="font-size: 0.72rem; color: var(--text-muted); margin: 0 0 0.35rem;">${plan.tiers[6].radiofrequency.facetLevelMapping.rule}</p>
                    <div style="display: flex; flex-direction: column; gap: 0.3rem; font-size: 0.74rem;">
                      ${plan.tiers[6].radiofrequency.facetLevelMapping.levels.map(lvl => `
                        <div style="background: var(--bg-surface); padding: 0.35rem 0.5rem; border-radius: var(--radius-sm); border-left: 3px solid var(--accent-blue);">
                          <div style="display: flex; justify-content: space-between; flex-wrap: wrap;">
                            <strong style="color: var(--text-primary);">${lvl.facet}: ${lvl.nerves}</strong>
                          </div>
                          <span style="color: var(--text-secondary); font-size: 0.72rem;">Patrón dolor: ${lvl.painPattern}</span>
                        </div>
                      `).join('')}
                    </div>
                  </div>
                ` : ''}

                <!-- DRG Root Level Breakdown by Dermatome (if available) -->
                ${plan.tiers[6].radiofrequency.rootLevelMapping ? `
                  <div style="background: rgba(245, 158, 11, 0.06); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: var(--radius-sm); padding: 0.5rem 0.65rem; margin-bottom: 0.45rem;">
                    <strong style="font-size: 0.8rem; color: #f59e0b; display: block; margin-bottom: 0.2rem;">📍 Mapeo de Ganglio Raíz Dorsal (DRG) por Nivel / Clínica:</strong>
                    <p style="font-size: 0.72rem; color: var(--text-muted); margin: 0 0 0.35rem;">${plan.tiers[6].radiofrequency.rootLevelMapping.rule}</p>
                    <div style="display: flex; flex-direction: column; gap: 0.3rem; font-size: 0.74rem;">
                      ${plan.tiers[6].radiofrequency.rootLevelMapping.levels.map(lvl => `
                        <div style="background: var(--bg-surface); padding: 0.35rem 0.5rem; border-radius: var(--radius-sm); border-left: 3px solid #f59e0b;">
                          <div style="display: flex; justify-content: space-between; flex-wrap: wrap;">
                            <strong style="color: var(--text-primary);">${lvl.root} (${lvl.foramen})</strong>
                            <span style="color: #60a5fa; font-weight: 600; font-size: 0.7rem;">${lvl.dose || ''}</span>
                          </div>
                          <span style="color: var(--text-secondary); font-size: 0.72rem;">Dermatoma: ${lvl.painPattern}</span>
                        </div>
                      `).join('')}
                    </div>
                  </div>
                ` : ''}

                <!-- Parameters Grid -->
                ${plan.tiers[6].radiofrequency.parameters ? `
                  <div style="background: rgba(0, 0, 0, 0.15); border: 1px solid rgba(99, 102, 241, 0.3); border-radius: var(--radius-sm); padding: 0.5rem 0.65rem; margin-bottom: 0.45rem;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
                      <strong style="font-size: 0.8rem; color: var(--accent-blue);">⚡ Parámetros Físicos:</strong>
                      <span style="font-size: 0.76rem; color: #a5b4fc; font-weight: 800;">${plan.tiers[6].radiofrequency.parameters.temperature || ''} · ${plan.tiers[6].radiofrequency.parameters.time || ''}</span>
                    </div>
                    <div class="pharma-spec-grid" style="font-size: 0.74rem;">
                      ${plan.tiers[6].radiofrequency.parameters.cannula ? `<div class="pharma-spec-item"><strong>Cánula / Punta</strong><span>${plan.tiers[6].radiofrequency.parameters.cannula}</span></div>` : ''}
                      ${plan.tiers[6].radiofrequency.parameters.sensoryStimulation ? `<div class="pharma-spec-item"><strong style="color: #60a5fa;">Sensitiva (50 Hz)</strong><span>${plan.tiers[6].radiofrequency.parameters.sensoryStimulation}</span></div>` : ''}
                      ${plan.tiers[6].radiofrequency.parameters.motorStimulation ? `<div class="pharma-spec-item"><strong style="color: #f87171;">Motora (2 Hz)</strong><span>${plan.tiers[6].radiofrequency.parameters.motorStimulation}</span></div>` : ''}
                    </div>
                  </div>
                ` : ''}

                <!-- Local Anesthetic Doses -->
                ${plan.tiers[6].radiofrequency.pharmacology ? `
                  <div class="pharma-spec-grid" style="margin-bottom: 0.45rem;">
                    <div class="pharma-spec-item">
                      <strong style="color: #60a5fa;">💉 AL Pre-Lesión</strong>
                      <span>${plan.tiers[6].radiofrequency.pharmacology.preLesionAnesthetic || 'Lidocaína 2% 0.5-1 mL'}</span>
                    </div>
                    <div class="pharma-spec-item">
                      <strong style="color: #f59e0b;">📏 Volumen / Diana</strong>
                      <span>${plan.tiers[6].radiofrequency.pharmacology.totalVolumePerTarget || '0.5 - 1.0 mL'}</span>
                    </div>
                    ${plan.tiers[6].radiofrequency.pharmacology.postLesionOption ? `
                      <div class="pharma-spec-item">
                        <strong style="color: #10b981;">💊 Post-Lesión</strong>
                        <span>${plan.tiers[6].radiofrequency.pharmacology.postLesionOption}</span>
                      </div>
                    ` : ''}
                  </div>
                ` : ''}

                <!-- Warnings -->
                ${(plan.tiers[6].radiofrequency.safetyWarnings && plan.tiers[6].radiofrequency.safetyWarnings.length > 0) ? `
                  <div style="background: rgba(239, 68, 68, 0.06); border: 1px solid rgba(239, 68, 68, 0.25); border-radius: var(--radius-sm); padding: 0.35rem 0.5rem; margin-top: 0.35rem;">
                    ${plan.tiers[6].radiofrequency.safetyWarnings.map(w => `
                      <div style="font-size: 0.72rem; color: #ef4444; font-weight: 600; margin: 0.1rem 0;">⚠️ ${w}</div>
                    `).join('')}
                  </div>
                ` : ''}
              </div>
            ` : ''}

            <div class="treatment-why-card">
              <strong>¿Por qué?:</strong> ${plan.tiers[6].whyThisTreatment}
            </div>
            <div class="treatment-when-not-card">
              <strong>🚫 Cuándo NO:</strong> ${plan.tiers[6].whenToAvoid}
            </div>
          </div>
        </div>

        <!-- ESCALÓN 8: CIRUGÍA Y CRITERIOS DE ALARMA -->
        <div class="treatment-tier-card glass-panel">
          <div class="tier-header">
            <div class="tier-title-group">
              <span class="tier-num-badge">8</span>
              <h3 class="tier-title">${plan.tiers[7].title}</h3>
            </div>
            <span class="treatment-badge-pill red">${plan.tiers[7].badge}</span>
          </div>
          <div class="tier-body">
            <ul style="margin: 0 0 0.5rem 1.25rem; padding: 0; font-size: 0.84rem; color: var(--text-primary); line-height: 1.5;">
              ${plan.tiers[7].indications.map(ind => `<li>${ind}</li>`).join('')}
            </ul>
            <div class="treatment-why-card">
              <strong>¿Por qué?:</strong> ${plan.tiers[7].whyThisTreatment}
            </div>
            <div class="treatment-when-not-card">
              <strong>🚫 Cuándo NO:</strong> ${plan.tiers[7].whenToAvoid}
            </div>
          </div>
        </div>

        <!-- PRESCRIPTION PROPOSAL & COPY TO EMR -->
        <div class="prescription-card glass-panel">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
            <div>
              <h3 style="margin: 0 0 0.15rem; font-size: 1rem; color: var(--text-primary);">📋 Propuesta de Prescripción para Historia Clínica</h3>
              <p style="margin: 0; font-size: 0.76rem; color: var(--text-muted);">Texto editable estructurado según los escalones y comorbilidades seleccionadas.</p>
            </div>
            <button class="btn-primary" id="btnCopyPrescriptionText" style="padding: 0.5rem 1.2rem; font-size: 0.82rem;" onclick="window.ClinicalUI.copyPrescriptionText()">
              <span id="copyPrescriptionLabel">Copiar Plan a HC 📋</span>
            </button>
          </div>
          <textarea class="prescription-textarea" id="prescriptionProposalText">${prescriptionText}</textarea>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 1.5rem; flex-wrap: wrap; gap: 0.75rem;">
          <button class="clinical-action-btn" onclick="window.ClinicalUI.goToStep('generator')">
            <span>← Volver a Generador</span>
          </button>
          
          <button class="btn-primary" style="padding: 0.75rem 1.6rem;" onclick="window.ClinicalUI.proceedToFollowUp()">
            <span>Establecer Plan de Seguimiento →</span>
          </button>
        </div>
      </div>
    `;
  }

  function toggleComorbidity(comorbidityKey) {
    if (!uiState.patientProfile) uiState.patientProfile = {};
    uiState.patientProfile[comorbidityKey] = !uiState.patientProfile[comorbidityKey];
    renderCurrentStep();
  }

  function copyPrescriptionText() {
    const textarea = document.getElementById('prescriptionProposalText');
    if (!textarea) return;
    navigator.clipboard.writeText(textarea.value).then(() => {
      const lbl = document.getElementById('copyPrescriptionLabel');
      if (lbl) {
        lbl.textContent = '¡Plan Copiado al Portapapeles! ✅';
        setTimeout(() => { lbl.textContent = 'Copiar Plan a HC 📋'; }, 2500);
      }
    }).catch(err => {
      textarea.select();
      document.execCommand('copy');
      alert('Plan copiado.');
    });
  }

  function openInjectablesComparisonModal() {
    showAuxModal(`
      <div class="aux-modal-header" style="border-bottom: 2px solid #6366f1;">
        <h3><span>⚖️</span> <span>Comparativa: Corticoide vs Ácido Hialurónico vs PRP</span></h3>
      </div>
      <div class="aux-items-list">
        <div style="overflow-x: auto;">
          <table class="injectables-table">
            <thead>
              <tr>
                <th>Tratamiento</th>
                <th>Objetivo Biomecánico</th>
                <th>Inicio</th>
                <th>Duración</th>
                <th>Evidencia</th>
                <th>Perfil Óptimo</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong style="color: #ef4444;">💉 Corticoide</strong></td>
                <td>Rápido control de la sinovitis exudativa y dolor agudo</td>
                <td>24 - 72 h</td>
                <td>2 - 6 semanas</td>
                <td><span class="treatment-badge-pill blue" style="font-size: 0.74rem;">Moderada / Brote</span></td>
                <td>Brote agudo con derrame a tensión que bloquea la fisioterapia.</td>
              </tr>
              <tr>
                <td><strong style="color: #60a5fa;">💧 Ácido Hialurónico</strong></td>
                <td>Viscosuplementación y alivio mecánico articular</td>
                <td>2 - 4 sem</td>
                <td>4 - 9 meses</td>
                <td><span class="treatment-badge-pill yellow" style="font-size: 0.74rem;">Pacientes selecc.</span></td>
                <td>Artrosis leve-moderada (KL II-III) sin derrame activo ni respuesta a AINEs.</td>
              </tr>
              <tr>
                <td><strong style="color: #f87171;">🩸 Plasma Rico en Plaquetas (LP-PRP)</strong></td>
                <td>Modulación del microambiente inflamatorio articular</td>
                <td>3 - 6 sem</td>
                <td>6 - 12 meses</td>
                <td><span class="treatment-badge-pill blue" style="font-size: 0.74rem;">Moderada KL I-III</span></td>
                <td>Artrosis leve-moderada en pacientes activos que buscan alivio más duradero.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `);
  }

  function proceedToFollowUp() {
    if (!uiState.engine) return;
    if (uiState.simulation) {
      uiState.simulation.evaluateDecision(
        'tratamiento',
        'multimodal_plan_design',
        true,
        0,
        'Plan terapéutico multimodal escalonado completado.'
      );
    }
    uiState.engine.proceedToFollowUp();
    renderCurrentStep();
  }

  // ─────────────────────────────────────────────
  // 11. STEP 7 — FOLLOW-UP PLAN
  // ─────────────────────────────────────────────

  function renderFollowUpView(container) {
    const fu = uiState.engine.getFollowUpPlan();
    if (!fu) return;

    container.innerHTML = `
      <div class="summary-bridge-card glass-panel">
        <div class="summary-bridge-header">
          <div class="home-hero-badge">Paso 7 · Plan de Seguimiento y Reevaluación</div>
          <h3>${fu.timing || 'Revisión en 4-6 semanas'}</h3>
          <p style="color: var(--text-secondary); font-size: 0.85rem; margin-top: 0.25rem;">
            Protocolo de control de respuesta terapéutica y parámetros diana.
          </p>
        </div>

        <!-- Parameters Grid -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.65rem; margin-bottom: 1.5rem;">
          ${(fu.parameters || []).map(p => `
            <div class="generator-triad-box">
              <div class="triad-label">Parámetro</div>
              <div class="triad-val">${p.icon || '•'} ${p.name}</div>
            </div>
          `).join('')}
        </div>

        <!-- Outcome Decision Matrix -->
        <h4 style="font-size: 0.9rem; font-weight: 800; color: var(--text-primary); margin-bottom: 0.65rem;">
          Algoritmo de Decisión según Evolución
        </h4>
        <div style="display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1.5rem;">
          ${(fu.outcomes || []).map(o => `
            <div class="structure-box" style="display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1rem;">
              <span style="font-size: 1.3rem;">${o.icon}</span>
              <div>
                <strong style="font-size: 0.86rem; color: var(--text-primary);">${o.label}:</strong>
                <span style="font-size: 0.82rem; color: var(--text-secondary);"> ${o.action}</span>
              </div>
            </div>
          `).join('')}
        </div>

        <!-- Golden Rule Box -->
        <div class="safety-header-banner safe" style="margin-bottom: 1.5rem;">
          <span class="safety-banner-icon">💡</span>
          <div class="safety-banner-text">
            <h4>Principio Clínico Innegociable</h4>
            <p><strong>${fu.keyPrinciple || 'Si el tratamiento dirigido falla, revisar el diagnóstico.'}</strong></p>
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
          <button class="clinical-action-btn" onclick="window.ClinicalUI.goToStep('treatment')">
            <span>← Modificar Tratamiento</span>
          </button>
          
          <button class="btn-primary" style="padding: 0.75rem 1.6rem;" onclick="window.ClinicalUI.proceedToCoach()">
            <span>🗣️ Cierre Coach de la Consulta →</span>
          </button>
        </div>
      </div>
    `;
  }

  function proceedToCoach() {
    if (!uiState.engine) return;
    uiState.engine.proceedToCoach();
    renderCurrentStep();
  }

  // ─────────────────────────────────────────────
  // 12. STEP 9 — COACH CLOSING VIEW
  // ─────────────────────────────────────────────

  function renderCoachView(container) {
    if (!uiState.coachVersion) uiState.coachVersion = 'standard';
    if (uiState.coachAltIndex === undefined) uiState.coachAltIndex = 0;

    const coach = uiState.engine.getCoachClosing(uiState.coachVersion, uiState.coachAltIndex);
    if (!coach) return;

    // Load favorites from localStorage or initial
    let favorites = [];
    try {
      const stored = localStorage.getItem('dolor_coach_favorites');
      favorites = stored ? JSON.parse(stored) : (coach.initialFavorites || []);
    } catch (e) {
      favorites = coach.initialFavorites || [];
    }

    container.innerHTML = `
      <div class="coach-view-stack">
        <!-- Header Badge -->
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
          <div class="home-hero-badge" style="background: rgba(99, 102, 241, 0.15); color: #818cf8; border-color: rgba(99, 102, 241, 0.35);">
            🗣️ Paso 9 · Cierre Coach de la Consulta
          </div>
          <button class="exam-tool-btn" onclick="window.ClinicalUI.openCoachLibraryModal()">
            <span>📚</span> <span>Explorar Biblioteca Completa de Frases Coach</span>
          </button>
        </div>

        <!-- VERSION SELECTOR TABS -->
        <div class="coach-version-selector-bar">
          <button class="coach-version-pill ${uiState.coachVersion === 'express' ? 'active' : ''}" onclick="window.ClinicalUI.setCoachVersion('express')">
            <span>⚡</span> <span>Cierre Express (10s)</span>
          </button>
          <button class="coach-version-pill ${uiState.coachVersion === 'standard' ? 'active' : ''}" onclick="window.ClinicalUI.setCoachVersion('standard')">
            <span>🗣️</span> <span>Cierre Habitual (30s)</span>
          </button>
          <button class="coach-version-pill ${uiState.coachVersion === 'extended' ? 'active' : ''}" onclick="window.ClinicalUI.setCoachVersion('extended')">
            <span>🧠</span> <span>Cierre Explicativo (60s)</span>
          </button>
        </div>

        <!-- MAIN COACH SCRIPT CARD -->
        <div class="coach-script-card glass-panel">
          <div class="coach-script-header">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span style="font-size: 1.25rem;">🗣️</span>
              <h3 style="margin: 0; font-size: 1.1rem; font-weight: 800; color: var(--text-primary);">
                ¿Cómo se lo explicaría al paciente?
              </h3>
            </div>
            <div style="display: flex; gap: 0.4rem; align-items: center;">
              <span class="treatment-badge-pill blue" style="font-size: 0.7rem;">
                ${uiState.coachVersion === 'express' ? '1-2 frases' : uiState.coachVersion === 'extended' ? 'Explicación Completa' : '4-6 frases'}
              </span>
            </div>
          </div>

          <div class="coach-script-body">
            <p class="coach-speech-bubble" id="coachScriptText">
              ${coach.text}
            </p>
          </div>

          <div class="coach-script-actions">
            <button class="clinical-action-btn" onclick="window.ClinicalUI.nextCoachAlternative()">
              <span>🔄</span> <span>Otra forma de explicarlo</span>
            </button>
            <button class="btn-primary" id="btnCopyCoachScript" style="padding: 0.55rem 1.25rem;" onclick="window.ClinicalUI.copyCoachScript()">
              <span id="copyCoachLabel">Copiar Cierre Coach 📋</span>
            </button>
          </div>
        </div>

        <!-- VISUAL FLOW DIAGRAM BANNER -->
        ${coach.visualFlow ? `
          <div class="coach-visual-flow-banner">
            <span style="font-size: 1.2rem;">🧭</span>
            <div style="display: flex; flex-direction: column; gap: 0.2rem;">
              <strong style="font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.05em; color: #818cf8;">Ruta de Recuperación Activa:</strong>
              <div class="coach-flow-steps-text">${coach.visualFlow}</div>
            </div>
          </div>
        ` : ''}

        <!-- TAKE-HOME MANTRA CARD -->
        <div class="coach-take-home-card glass-panel">
          <div class="take-home-badge">💡 PARA RECORDAR — FRASE PARA LLEVARSE A CASA</div>
          <blockquote class="take-home-mantra-text">
            «${coach.takeHomeMantra.text}»
          </blockquote>
        </div>

        <!-- FAVORITES / MY COACH PHRASES -->
        <div class="coach-favorites-section glass-panel">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.85rem; flex-wrap: wrap; gap: 0.5rem;">
            <div>
              <h4 style="margin: 0 0 0.15rem; font-size: 0.95rem; font-weight: 800; color: var(--text-primary);">
                ⭐ Mis Frases Coach Favoritas
              </h4>
              <p style="margin: 0; font-size: 0.75rem; color: var(--text-muted);">
                Frases de impacto listas para usar durante la consulta.
              </p>
            </div>
            <button class="exam-tool-btn" onclick="window.ClinicalUI.openCoachLibraryModal()">
              <span>+</span> <span>Añadir Frase</span>
            </button>
          </div>

          <div class="coach-favorites-grid">
            ${favorites.map((fav, fIdx) => `
              <div class="coach-fav-chip">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
                  <span class="coach-cat-tag">${fav.categoryLabel || fav.category || 'Coach'}</span>
                  <button class="coach-star-btn active" title="Quitar de favoritos" onclick="window.ClinicalUI.toggleCoachFavorite('${fav.text.replace(/'/g, "\\'")}', '${fav.categoryLabel || ''}')">★</button>
                </div>
                <p style="margin: 0; font-size: 0.8rem; color: var(--text-primary); line-height: 1.4;">
                  «${fav.text}»
                </p>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- NAVIGATION -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 1.5rem; flex-wrap: wrap; gap: 0.75rem;">
          <button class="clinical-action-btn" onclick="window.ClinicalUI.goToStep('follow_up')">
            <span>← Volver a Seguimiento</span>
          </button>
          
          <button class="btn-primary" style="padding: 0.75rem 1.6rem;" onclick="window.ClinicalUI.proceedToSummary()">
            <span>Finalizar y Ver Resumen de Historia Clínica 📋 →</span>
          </button>
        </div>
      </div>
    `;
  }

  function setCoachVersion(version) {
    uiState.coachVersion = version;
    uiState.coachAltIndex = 0;
    renderCurrentStep();
  }

  function nextCoachAlternative() {
    uiState.coachAltIndex = (uiState.coachAltIndex || 0) + 1;
    renderCurrentStep();
  }

  function copyCoachScript() {
    const speechEl = document.getElementById('coachScriptText');
    if (!speechEl) return;
    navigator.clipboard.writeText(speechEl.innerText.trim()).then(() => {
      const lbl = document.getElementById('copyCoachLabel');
      if (lbl) {
        lbl.textContent = '¡Cierre Copiado! ✅';
        setTimeout(() => { lbl.textContent = 'Copiar Cierre Coach 📋'; }, 2500);
      }
    }).catch(() => {
      alert('Cierre copiado.');
    });
  }

  function toggleCoachFavorite(phraseText, categoryLabel) {
    let favorites = [];
    try {
      const stored = localStorage.getItem('dolor_coach_favorites');
      favorites = stored ? JSON.parse(stored) : (window.COACH_CATALOG?.initialFavorites || []);
    } catch (e) {
      favorites = window.COACH_CATALOG?.initialFavorites || [];
    }

    const idx = favorites.findIndex(f => f.text === phraseText);
    if (idx >= 0) {
      favorites.splice(idx, 1);
    } else {
      favorites.push({
        id: 'fav-' + Date.now(),
        category: 'custom',
        categoryLabel: categoryLabel || 'Personalizada',
        text: phraseText
      });
    }

    localStorage.setItem('dolor_coach_favorites', JSON.stringify(favorites));
    renderCurrentStep();
  }

  function openCoachLibraryModal() {
    const catalog = window.COACH_CATALOG || {};
    const categories = catalog.coachPhrases || {};

    let favorites = [];
    try {
      const stored = localStorage.getItem('dolor_coach_favorites');
      favorites = stored ? JSON.parse(stored) : (catalog.initialFavorites || []);
    } catch (e) {
      favorites = catalog.initialFavorites || [];
    }

    const catKeys = Object.keys(categories);

    showAuxModal(`
      <div class="aux-modal-header" style="border-bottom: 2px solid #6366f1;">
        <h3><span>📚</span> <span>Biblioteca de Frases y Metáforas Coach</span></h3>
      </div>
      <div class="aux-items-list" style="max-height: 70vh; overflow-y: auto;">
        <!-- Add custom phrase box -->
        <div class="structure-box" style="margin-bottom: 1rem; background: rgba(99, 102, 241, 0.08); border-color: rgba(99, 102, 241, 0.3);">
          <strong style="font-size: 0.86rem; color: #818cf8;">➕ Crear Nueva Frase Personalizada</strong>
          <div style="display: flex; gap: 0.5rem; margin-top: 0.4rem;">
            <input type="text" id="newCoachPhraseInput" placeholder="Escribe aquí tu frase o metáfora clínica..." style="flex: 1; padding: 0.5rem 0.75rem; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-surface); color: var(--text-primary); font-size: 0.82rem;" />
            <button class="btn-primary" style="padding: 0.5rem 1rem; font-size: 0.8rem;" onclick="
              const inp = document.getElementById('newCoachPhraseInput');
              if (inp && inp.value.trim().length > 5) {
                window.ClinicalUI.toggleCoachFavorite(inp.value.trim(), 'Mi Frase');
                const m = document.getElementById('clinicalAuxModal');
                if (m) { m.style.display = 'none'; document.body.style.overflow = ''; }
              }
            ">Guardar</button>
          </div>
        </div>

        ${catKeys.map(k => {
          const cat = categories[k];
          return `
            <div class="structure-box" style="margin-bottom: 0.85rem;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.45rem;">
                <h4 style="margin: 0; font-size: 0.92rem; color: var(--text-primary);">${cat.icon || '💬'} ${cat.label}</h4>
              </div>
              ${cat.visualFlow ? `<div style="font-size: 0.74rem; color: #818cf8; font-weight: 700; margin-bottom: 0.45rem;">${cat.visualFlow}</div>` : ''}
              <div style="display: flex; flex-direction: column; gap: 0.45rem;">
                ${(cat.phrases || []).map(p => {
                  const isFav = favorites.some(f => f.text === p);
                  return `
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem; padding: 0.4rem 0.6rem; border-radius: var(--radius-sm); background: var(--bg-surface); border: 1px solid var(--border-color);">
                      <p style="margin: 0; font-size: 0.8rem; color: var(--text-primary); line-height: 1.4; flex: 1;">«${p}»</p>
                      <button class="coach-star-btn ${isFav ? 'active' : ''}" style="cursor: pointer; background: transparent; border: none; font-size: 1rem; color: ${isFav ? '#f59e0b' : 'var(--text-muted)'};" onclick="
                        window.ClinicalUI.toggleCoachFavorite('${p.replace(/'/g, "\\'")}', '${cat.label.replace(/'/g, "\\'")}');
                        const m = document.getElementById('clinicalAuxModal');
                        if (m) { m.style.display = 'none'; document.body.style.overflow = ''; }
                      ">${isFav ? '★' : '☆'}</button>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `);
  }

  function proceedToSummary() {
    if (!uiState.engine) return;
    if (uiState.simulation) {
      uiState.simulation.evaluateDecision(
        'seguimiento',
        'follow_up_protocol',
        true,
        0,
        'Protocolo de seguimiento y reevaluación definido.'
      );
    }
    uiState.engine.proceedToSummary();
    renderCurrentStep();
  }

  // ─────────────────────────────────────────────
  // 13. STEP 10 — CLINICAL REPORT SUMMARY (EMR COPY)
  // ─────────────────────────────────────────────

  function renderClinicalSummaryView(container) {
    const summary = uiState.engine.generateClinicalSummary();
    const certainty = uiState.engine.getClinicalCertainty ? uiState.engine.getClinicalCertainty() : { label: 'Moderada', color: '#f59e0b', icon: '🟡', supporting: [], contradicting: [], decisiveToIncrease: '' };
    const decisionChange = uiState.engine.getDecisionChangeSynthesis ? uiState.engine.getDecisionChangeSynthesis() : { mostSupporting: '', mostWeakening: '', mainAlternative: '', mustNotMiss: '', pendingFactToChangeConduct: '' };
    const standardOutput = uiState.engine.generateStandardClinicalOutput ? uiState.engine.generateStandardClinicalOutput() : summary.text;
    const diagnosis = uiState.engine.generateWorkingDiagnosis();
    const topHyp = diagnosis.topHypothesis || {};
    const generator = diagnosis.generator || {};

    container.innerHTML = `
      ${uiState.simulation ? `
        <!-- Simulation Debriefing & Bias Audit Card -->
        <div class="simulation-debriefing-card glass-panel" style="margin-bottom: 1.5rem; border: 2px solid #8b5cf6; background: linear-gradient(135deg, rgba(139, 92, 246, 0.08) 0%, rgba(99, 102, 241, 0.05) 100%);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; flex-wrap: wrap; gap: 0.5rem;">
            <span class="pres-tier-badge safety" style="background: rgba(139, 92, 246, 0.2); color: #8b5cf6; font-size: 0.76rem; border-color: rgba(139, 92, 246, 0.4);">
              🎓 AUDITORÍA CLÍNICA: ${uiState.simulation.caseData.title}
            </span>
            <span style="font-weight: 800; font-size: 0.85rem; color: #10b981; background: rgba(16, 185, 129, 0.15); padding: 0.25rem 0.65rem; border-radius: var(--radius-full);">
              Puntuación Global: ${uiState.simulation.getOverallScore()}/100 · ${uiState.simulation.getDebriefingReport().grade}
            </span>
          </div>
          
          <div style="background: var(--bg-surface); padding: 0.85rem; border-radius: var(--radius-md); border-left: 4px solid #8b5cf6; margin-bottom: 1rem;">
            <h4 style="margin: 0 0 0.35rem; color: var(--text-primary); font-size: 0.95rem;">💡 Perla Docente y Clave Diagnóstica:</h4>
            <p style="margin: 0; font-size: 0.86rem; color: var(--text-secondary); line-height: 1.45;">
              ${uiState.simulation.caseData.expectedFlow?.discriminatorNote || 'La clave del caso radica en correlacionar siempre la anamnesis y la exploración física con la imagen.'}
            </p>
          </div>

          <div style="margin-bottom: 1rem;">
            <h5 style="margin: 0 0 0.45rem; font-size: 0.8rem; text-transform: uppercase; color: var(--text-muted); font-weight: 800;">📊 Desglose por Dimensiones de Competencia:</h5>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(105px, 1fr)); gap: 0.4rem;">
              ${Object.entries(uiState.simulation.scores).map(([dim, score]) => {
                const dimLabels = {
                  seguridad: 'Seguridad',
                  anamnesis: 'Anamnesis',
                  diferencial: 'Diferencial',
                  exploracion: 'Exploración',
                  imagen: 'Imagen',
                  concordancia: 'Concordancia',
                  generador: 'Generador',
                  tratamiento: 'Tratamiento',
                  seguimiento: 'Seguimiento'
                };
                const color = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444';
                return `
                  <div style="background: var(--bg-surface); padding: 0.4rem 0.5rem; border-radius: var(--radius-sm); border: 1px solid var(--border-color); text-align: center;">
                    <div style="font-size: 0.7rem; color: var(--text-muted); text-transform: capitalize; font-weight: 700;">${dimLabels[dim] || dim}</div>
                    <div style="font-size: 0.95rem; font-weight: 800; color: ${color};">${score}%</div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          ${(uiState.simulation.caseData.trapsToAvoid || []).length > 0 ? `
            <div style="margin-bottom: 1rem;">
              <h5 style="margin: 0 0 0.35rem; font-size: 0.82rem; text-transform: uppercase; color: #f59e0b; font-weight: 800;">⚠️ Sesgos Cognitivos a Vigilar:</h5>
              ${uiState.simulation.caseData.trapsToAvoid.map(t => `
                <div style="font-size: 0.82rem; color: var(--text-primary); background: rgba(245, 158, 11, 0.08); padding: 0.5rem 0.75rem; border-radius: var(--radius-sm); margin-bottom: 0.35rem; border: 1px solid rgba(245, 158, 11, 0.2);">
                  <strong>Sesgo de ${t.bias}:</strong> ${t.description}
                </div>
              `).join('')}
            </div>
          ` : ''}

          <div style="display: flex; gap: 0.75rem; justify-content: flex-end; margin-top: 1rem;">
            <button class="vade-primary-btn" onclick="window.ClinicalUI.switchAppMode('reasoning'); window.ClinicalUI.renderCaseSelector();" style="font-size: 0.84rem; padding: 0.5rem 1.1rem; background: #8b5cf6; cursor: pointer;">
              🎓 Evaluar Otro Caso Simulado
            </button>
          </div>
        </div>
      ` : ''}

      <!-- SPRINT 14: TARJETA DE SÍNTESIS Y CERTEZA CLÍNICA -->
      <div class="standard-output-card glass-panel" style="margin-bottom: 1.5rem; border-left: 5px solid ${certainty.color};">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1rem;">
          <div style="font-size: 0.8rem; font-weight: 800; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.05em;">
            IMPRESIÓN DIAGNÓSTICA & FENOTIPO
          </div>
          <div class="certainty-badge-pill" style="background: ${certainty.color}22; color: ${certainty.color}; border: 1.5px solid ${certainty.color}; padding: 0.3rem 0.85rem; border-radius: var(--radius-full); font-weight: 800; font-size: 0.82rem; display: inline-flex; align-items: center; gap: 0.4rem;">
            <span>${certainty.icon}</span> <span>Nivel de Certeza: ${certainty.label}</span>
          </div>
        </div>

        <div class="output-grid-two-cols" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem; margin-bottom: 1.25rem;">
          <div style="background: var(--bg-surface); padding: 0.9rem 1rem; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
            <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; font-weight: 700;">Diagnóstico Clínico Principal</div>
            <div style="font-size: 1.15rem; font-weight: 800; color: var(--text-primary); margin-top: 0.2rem;">${topHyp.name || 'Diagnóstico en estudio'}</div>
            <div style="font-size: 0.82rem; color: var(--text-secondary); margin-top: 0.25rem;">${topHyp.description || ''}</div>
          </div>

          <div style="background: var(--bg-surface); padding: 0.9rem 1rem; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
            <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; font-weight: 700;">Generador Probable & Mecanismo</div>
            <div style="font-size: 1.15rem; font-weight: 800; color: var(--accent-primary, #818cf8); margin-top: 0.2rem;">${generator.painGenerator || topHyp.name || 'Generador nociceptivo'}</div>
            <div style="font-size: 0.82rem; color: var(--text-secondary); margin-top: 0.25rem;">
              Mecanismo: <strong>${generator.mechanismLabel || 'Predominio nociceptivo/mecánico'}</strong>
            </div>
          </div>
        </div>

        <!-- SPRINT 14: TARJETA DOCENTE ¿QUÉ CAMBIÓ MI DECISIÓN? -->
        <div class="decision-reflection-box" style="background: rgba(99, 102, 241, 0.05); border: 1px solid rgba(99, 102, 241, 0.2); border-radius: var(--radius-md); padding: 1rem 1.15rem; margin-bottom: 1.25rem;">
          <div style="font-weight: 800; font-size: 0.88rem; color: var(--accent-primary, #818cf8); display: flex; align-items: center; gap: 0.4rem; margin-bottom: 0.75rem;">
            <span>💡</span> <span>¿QUÉ CAMBIÓ MI DECISIÓN? (Reflexión Clínica Docente)</span>
          </div>

          <div style="display: flex; flex-direction: column; gap: 0.5rem; font-size: 0.84rem;">
            <div><strong style="color: #10b981;">🟢 Dato clave que más apoya:</strong> ${decisionChange.mostSupporting}</div>
            <div><strong style="color: #f59e0b;">⚠️ Dato que matiza o contradice:</strong> ${decisionChange.mostWeakening}</div>
            <div><strong style="color: var(--text-secondary);">⚖️ Principal alternativa a vigilar:</strong> ${decisionChange.mainAlternative}</div>
            <div><strong style="color: #ef4444;">🚨 Must-Not-Miss (Seguridad):</strong> ${decisionChange.mustNotMiss}</div>
            <div><strong style="color: #3b82f6;">🔍 Dato pendiente que cambiaría conducta:</strong> ${decisionChange.pendingFactToChangeConduct}</div>
          </div>
        </div>

        <!-- 3 BOTONES DE ACCIÓN ESTÁNDAR SPRINT 14 -->
        <div class="standard-action-buttons-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0.75rem; margin-top: 1.25rem;">
          <button class="vade-primary-btn" id="btnCopyStandardHC" onclick="window.ClinicalUI.copyStandardClinicalOutput()" style="padding: 0.75rem 1rem; font-size: 0.9rem; font-weight: 800; display: flex; align-items: center; justify-content: center; gap: 0.5rem; cursor: pointer;">
            <span>📋</span> <span id="copyStandardHCLabel">COPIAR HISTORIA</span>
          </button>

          <button class="clinical-action-btn" onclick="window.ClinicalUI.openContextualCoachModal()" style="padding: 0.75rem 1rem; font-size: 0.9rem; font-weight: 700; background: rgba(16, 185, 129, 0.12); border-color: rgba(16, 185, 129, 0.4); color: #10b981; display: flex; align-items: center; justify-content: center; gap: 0.5rem; cursor: pointer;">
            <span>🗣️</span> <span>COACH PACIENTE</span>
          </button>

          <button class="clinical-action-btn" onclick="window.ClinicalUI.startRazonamientoDeep(window.ClinicalUI.uiState?.currentPathwayId || uiState.currentPathwayId)" style="padding: 0.75rem 1rem; font-size: 0.9rem; font-weight: 700; background: rgba(139, 92, 246, 0.12); border-color: rgba(139, 92, 246, 0.4); color: #a78bfa; display: flex; align-items: center; justify-content: center; gap: 0.5rem; cursor: pointer;">
            <span>🧠</span> <span>PROFUNDIZAR / ¿POR QUÉ?</span>
          </button>
        </div>
      </div>

      <!-- TEXTAREA DE SALIDA COMPLETA -->
      <div class="clinical-summary-box glass-panel">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
          <h4 style="margin: 0; font-size: 0.9rem; color: var(--text-primary);">Nota Estructurada Completa para Volcado</h4>
          <span style="font-size: 0.75rem; color: var(--text-muted);">Editable</span>
        </div>
        <textarea class="clinical-summary-textarea" id="clinicalSummaryText" style="min-height: 240px; font-family: monospace; font-size: 0.82rem; line-height: 1.45;">${standardOutput}</textarea>
        
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 1rem; flex-wrap: wrap; gap: 0.5rem;">
          <button class="clinical-action-btn" onclick="window.ClinicalUI.goToStep('coach')">
            <span>← Paso Anterior</span>
          </button>
          <button class="vade-primary-btn" onclick="window.ClinicalUI.switchAppMode('home')" style="background: var(--bg-surface); color: var(--text-primary); border: 1.5px solid var(--border-color);">
            <span>🏠 Finalizar y Volver al Inicio</span>
          </button>
        </div>
      </div>
    `;
  }

  // ─────────────────────────────────────────────
  // 13. AUXILIARY DECISION SUPPORT MODALS
  // ─────────────────────────────────────────────

  function openDifferentialModal() {
    if (!uiState.engine) return;
    const diffs = uiState.engine.getDifferentialDiagnosis();

    showAuxModal(`
      <div class="aux-modal-header">
        <h3><span>🔀</span> <span>¿Y si no es esto? (Imitadores Principales)</span></h3>
      </div>
      <div class="aux-items-list">
        ${diffs.map(d => `
          <div class="aux-item-card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem;">
              <h4>${d.name}</h4>
              ${d.currentlyExcluded ? '<span class="pres-badge-status available" style="font-size: 0.74rem;">Poco apoyado por clínica</span>' : ''}
            </div>
            <p style="margin-bottom: 0.35rem;"><strong>¿Qué me haría reconsiderarlo?</strong> ${d.whatWouldReconsider || ''}</p>
            <p style="font-size: 0.78rem; color: var(--accent-blue);"><strong>Test discriminativo clave:</strong> ${d.keyDiscriminatingTest || ''}</p>
          </div>
        `).join('')}
      </div>
    `);
  }

  function openWhatIDoBelieveModal() {
    if (!uiState.engine) return;
    const what = uiState.engine.getWhatIDoBelieveNow();

    showAuxModal(`
      <div class="aux-modal-header" style="border-bottom: 2px solid #6366f1;">
        <h3><span>🧠</span> <span>¿Qué creo ahora? (Síntesis de Trabajo)</span></h3>
      </div>
      <div class="aux-items-list">
        <div class="structure-box" style="background: rgba(99, 102, 241, 0.08); border-color: rgba(99, 102, 241, 0.3);">
          <div style="font-size: 0.72rem; color: #818cf8; font-weight: 800; text-transform: uppercase; margin-bottom: 0.25rem;">Generador Principal Candidato</div>
          <h4 style="font-size: 1.1rem; color: var(--text-primary); margin: 0 0 0.25rem;">${what.topCandidate}</h4>
          <span class="pres-badge-status available" style="font-size: 0.72rem;">Nivel de Confianza: ${what.confidence}</span>
        </div>

        <div class="structure-box">
          <div style="font-size: 0.72rem; color: var(--text-muted); font-weight: 800; text-transform: uppercase; margin-bottom: 0.25rem;">Segundo Candidato en Diferencial</div>
          <h4 style="font-size: 0.95rem; color: var(--text-secondary); margin: 0;">${what.runnerUp}</h4>
        </div>

        <div class="aux-item-card">
          <h4 style="color: var(--color-safe);">🟢 Hallazgo que más apoya esta hipótesis</h4>
          <p style="font-size: 0.84rem; color: var(--text-primary); margin: 0;">${what.topSupporting}</p>
        </div>

        <div class="aux-item-card">
          <h4 style="color: #f59e0b;">⚠️ Hallazgo que más la contradice / Datos discordantes</h4>
          <p style="font-size: 0.84rem; color: var(--text-primary); margin: 0;">${what.topConflicting}</p>
        </div>

        <div class="aux-item-card" style="border-left: 3px solid var(--color-warning);">
          <h4>Seguridad y Banderas Rojas</h4>
          <p style="font-size: 0.84rem; font-weight: 700; color: var(--text-primary); margin: 0;">${what.safetyStatus}</p>
        </div>
      </div>
    `);
  }

  function openReconsiderModal() {
    if (!uiState.engine) return;
    const data = uiState.engine.reconsiderDiagnosis();
    const audit = uiState.engine.runDiscordanceAudit ? uiState.engine.runDiscordanceAudit() : { hasWarnings: false, warnings: [] };

    showAuxModal(`
      <div class="aux-modal-header">
        <h3><span>🤔</span> <span>No me cuadra — Auditoría de Discordancias Clínicas</span></h3>
      </div>
      <div class="aux-items-list">
        ${audit.hasWarnings ? `
          <div style="margin-bottom: 0.75rem;">
            ${audit.warnings.map(w => `
              <div class="safety-header-banner" style="margin-bottom: 0.5rem; background: ${w.severity === 'high' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)'}; border-color: ${w.severity === 'high' ? 'rgba(239, 68, 68, 0.4)' : 'rgba(245, 158, 11, 0.4)'};">
                <span class="safety-banner-icon">${w.severity === 'high' ? '🚨' : '⚠️'}</span>
                <div class="safety-banner-text">
                  <h4 style="margin: 0 0 0.15rem; color: var(--text-primary);">${w.title}</h4>
                  <p style="font-size: 0.8rem; margin: 0;">${w.description}</p>
                </div>
              </div>
            `).join('')}
          </div>
        ` : ''}

        <div class="safety-header-banner" style="margin-bottom: 0.5rem;">
          <span class="safety-banner-icon">💡</span>
          <div class="safety-banner-text">
            <h4 style="margin: 0 0 0.15rem;">Revisión de Incongruencias</h4>
            <p style="font-size: 0.78rem;">${data.recommendation}</p>
          </div>
        </div>

        <div class="aux-item-card">
          <h4>Mecanismos de Dolor a Considerar</h4>
          <ul>
            ${data.painMechanisms.map(m => `<li style="font-size: 0.8rem; color: var(--text-primary); margin-bottom: 0.2rem;">${m}</li>`).join('')}
          </ul>
        </div>

        <div class="aux-item-card">
          <h4>Datos aún pendientes de confirmar</h4>
          <p style="font-size: 0.8rem; color: var(--text-secondary);">
            ${data.pendingData.length > 0 ? data.pendingData.map(p => `• ${p.item}`).join('<br>') : 'Has completado todos los pasos de la secuencia.'}
          </p>
        </div>
      </div>
    `);
  }

  // ─────────────────────────────────────────────
  // TRAINING MODE 2.0 (CASOS CLÍNICOS SIMULADOS)
  // ─────────────────────────────────────────────

  async function renderCaseSelector() {
    const container = containers.clinical;
    if (!container) return;

    let casesCatalog = uiState.casesCatalog;
    if (!casesCatalog && window.EMBEDDED_BUNDLE && window.EMBEDDED_BUNDLE.cases_catalog) {
      casesCatalog = window.EMBEDDED_BUNDLE.cases_catalog;
      uiState.casesCatalog = casesCatalog;
    }
    if (!casesCatalog) {
      try {
        const res = await fetch('clinical/cases/cases_catalog.json?v=' + Date.now());
        if (res.ok) {
          casesCatalog = await res.json();
          uiState.casesCatalog = casesCatalog;
        }
      } catch (err) {
        if (window.EMBEDDED_BUNDLE && window.EMBEDDED_BUNDLE.cases_catalog) {
          casesCatalog = window.EMBEDDED_BUNDLE.cases_catalog;
          uiState.casesCatalog = casesCatalog;
        }
      }
    }

    if (!casesCatalog || casesCatalog.length === 0) {
      container.innerHTML = `
        <div class="clinical-flow-container">
          <h2>Modo Entrenamiento con Casos</h2>
          <p>No se han podido cargar los casos clínicos.</p>
          <button class="clinical-action-btn" onclick="window.ClinicalUI.switchAppMode('home')">← Volver al Inicio</button>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="clinical-flow-container">
        <div class="region-selector-header">
          <div class="home-hero-badge" style="background: rgba(139, 92, 246, 0.15); color: #a78bfa; border-color: rgba(139, 92, 246, 0.3);">
            🎓 Modo Entrenamiento Clínico 2.0
          </div>
          <h1>Simulador de Casos Clínicos a Ciegas</h1>
          <p>Elige un caso clínico simulado. Toma decisiones diagnósticas paso a paso y recibe una auditoría completa de razonamiento y detección de sesgos cognitivos.</p>
        </div>

        <div class="presentations-list" style="grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));">
          ${casesCatalog.map(c => `
            <div class="presentation-card active-pathway" style="border-left: 4px solid ${c.difficulty === 'seguridad' ? 'var(--color-danger)' : c.difficulty === 'trampa' ? '#a855f7' : c.difficulty === 'realista' ? '#f59e0b' : 'var(--color-safe)'};"
                 onclick="window.ClinicalUI.startTrainingCase('${c.id}')">
              <div class="pres-info-group">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
                  <span class="pres-badge-status available" style="background: ${c.difficulty === 'seguridad' ? 'rgba(239, 68, 68, 0.15)' : c.difficulty === 'trampa' ? 'rgba(168, 85, 247, 0.15)' : c.difficulty === 'realista' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(34, 197, 94, 0.15)'}; color: ${c.difficulty === 'seguridad' ? '#ef4444' : c.difficulty === 'trampa' ? '#a855f7' : c.difficulty === 'realista' ? '#f59e0b' : '#22c55e'}; font-weight: 800;">
                    ${c.difficultyIcon} ${c.difficultyLabel}
                  </span>
                  <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 700;">${c.patient.age} años · ${c.patient.gender}</span>
                </div>
                <h4 style="font-size: 1rem; color: var(--text-primary); margin-bottom: 0.35rem;">${c.title}</h4>
                <p style="font-size: 0.8rem; color: var(--text-secondary); line-height: 1.35;">«${c.patient.chiefComplaint}»</p>
              </div>
              <span class="pres-badge-status available" style="margin-top: 0.5rem; align-self: flex-start;">
                ▶ Iniciar Caso Clínico
              </span>
            </div>
          `).join('')}
        </div>

        <div style="text-align: center; margin-top: 2rem;">
          <button class="clinical-action-btn" onclick="window.ClinicalUI.switchAppMode('home')">
            <span>← Volver al Inicio</span>
          </button>
        </div>
      </div>
    `;
  }

  async function startTrainingCase(caseId) {
    const casesCatalog = uiState.casesCatalog || [];
    const c = casesCatalog.find(item => item.id === caseId);
    if (!c) {
      console.warn('Caso no encontrado:', caseId);
      return;
    }

    // Instantiate simulation engine first
    if (window.SimulationEngine) {
      uiState.simulation = new window.SimulationEngine(c, window.state ? window.state.catalog : null);
    }

    // Launch pathway associated with case
    await startPathway(c.pathwayId);

    // Open introductory patient history modal
    openPatientHistoryModal(true);
  }

  function openPatientHistoryModal(isIntro = false) {
    if (!uiState.simulation) return;
    const c = uiState.simulation.caseData;
    
    showAuxModal(`
      <div class="aux-modal-header" style="border-bottom: 2px solid rgba(139, 92, 246, 0.3); padding-bottom: 0.75rem;">
        <div style="display: flex; align-items: center; gap: 0.65rem;">
          <span style="font-size: 1.6rem;">🎓</span>
          <div>
            <h3 style="margin: 0; font-size: 1.05rem; color: var(--text-primary);">${c.title}</h3>
            <span style="font-size: 0.76rem; font-weight: 700; color: #8b5cf6;">${c.difficultyIcon || '🟢'} ${c.difficultyLabel || 'Caso Clínico'} · Modo Evaluación a Ciegas</span>
          </div>
        </div>
      </div>
      
      <div class="patient-modal-card" style="padding: 1.15rem 0.25rem 0.25rem;">
        <div style="background: rgba(99, 102, 241, 0.08); border-radius: var(--radius-md); padding: 1rem; margin-bottom: 1rem; border: 1px solid rgba(99, 102, 241, 0.2);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem; flex-wrap: wrap; gap: 0.5rem;">
            <strong style="color: var(--accent-blue); font-size: 0.92rem;">👤 Perfil del Paciente</strong>
            <span style="font-size: 0.8rem; font-weight: 700; color: var(--text-secondary);">${c.patient.gender}, ${c.patient.age} años</span>
          </div>
          ${c.patient.profession ? `<div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.5rem;">💼 Profesión / Actividad: <strong>${c.patient.profession}</strong></div>` : ''}
          <div style="font-size: 0.88rem; color: var(--text-primary); line-height: 1.45; margin-top: 0.5rem; background: var(--bg-surface); padding: 0.75rem; border-radius: var(--radius-sm); border-left: 3.5px solid var(--accent-blue);">
            <strong>Motivo de Consulta:</strong><br>
            «${c.patient.chiefComplaint}»
          </div>
        </div>

        ${c.patient.history ? `
          <div style="margin-bottom: 1rem;">
            <h4 style="font-size: 0.85rem; font-weight: 800; text-transform: uppercase; color: var(--text-secondary); margin-bottom: 0.4rem;">📖 Historia de la Enfermedad Actual</h4>
            <p style="font-size: 0.85rem; color: var(--text-primary); line-height: 1.45; background: var(--bg-card); padding: 0.85rem; border-radius: var(--radius-md); border: 1px solid var(--border-color); margin: 0;">
              ${c.patient.history}
            </p>
          </div>
        ` : ''}

        <div style="background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.25); border-radius: var(--radius-md); padding: 0.75rem 0.95rem; font-size: 0.82rem; color: var(--text-primary); margin-bottom: 1.25rem; line-height: 1.4;">
          <strong>🎯 Objetivo Clínico:</strong> Procede a ciegas a través del algoritmo. Toma decisiones en banderas rojas, anamnesis, exploración e imagen. Al finalizar recibirás el informe de auditoría con la detección de sesgos y la perla diagnóstica.
        </div>

        <div style="text-align: center;">
          <button class="vade-primary-btn" onclick="document.getElementById('clinicalAuxModal')?.remove()" style="padding: 0.7rem 1.8rem; font-size: 0.92rem; font-weight: 800; background: #8b5cf6;">
            ${isIntro ? '▶ Comenzar Evaluación a Ciegas' : '← Continuar con el Caso'}
          </button>
        </div>
      </div>
    `);
  }

  function openMissingInfoModal() {
    if (!uiState.engine) return;
    const missing = uiState.engine.getMissingInfo();

    showAuxModal(`
      <div class="aux-modal-header">
        <h3><span>❓</span> <span>¿Qué me falta? (Checklist de Consulta)</span></h3>
      </div>
      <div class="aux-items-list">
        ${missing.map(m => `
          <div class="structure-box" style="display: flex; justify-content: space-between; align-items: center; padding: 0.65rem 0.85rem;">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span style="font-size: 1.1rem;">${m.completed ? '✅' : '⚪'}</span>
              <span style="font-size: 0.84rem; font-weight: ${m.completed ? '600' : '700'}; color: ${m.completed ? 'var(--text-muted)' : 'var(--text-primary)'};">
                ${m.item}
              </span>
            </div>
            <span class="pres-badge-status ${m.completed ? 'available' : 'upcoming'}" style="font-size: 0.74rem;">
              ${m.completed ? 'Completado' : (m.essential ? '⚡ Esencial' : 'Opcional')}
            </span>
          </div>
        `).join('')}
      </div>
    `);
  }

  function showAuxModal(contentHTML) {
    let modal = document.getElementById('clinicalAuxModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'clinicalAuxModal';
      modal.className = 'modal-overlay';
      modal.innerHTML = `
        <div class="modal-card glass-modal aux-modal-content">
          <button id="closeAuxModalBtn" class="modal-close-btn">&times;</button>
          <div id="auxModalBody"></div>
        </div>
      `;
      document.body.appendChild(modal);

      modal.querySelector('#closeAuxModalBtn').addEventListener('click', () => {
        modal.style.display = 'none';
        document.body.style.overflow = '';
      });

      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.style.display = 'none';
          document.body.style.overflow = '';
        }
      });
    }

    modal.querySelector('#auxModalBody').innerHTML = contentHTML;
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }

  function closeAuxModal() {
    const modal = document.getElementById('clinicalAuxModal');
    if (modal) {
      modal.style.display = 'none';
      document.body.style.overflow = '';
    }
  }

  // ─────────────────────────────────────────────
  // 14. SESSION PERSISTENCE & MODE SWITCHER
  // ─────────────────────────────────────────────

  function saveCurrentClinicalSession() {
    if (!uiState.engine || !uiState.engine.pathway) return;
    try {
      const stateObj = {
        pathwayId: uiState.engine.pathway.id,
        pathwayRegion: uiState.engine.pathway.region,
        pathwayPresentation: uiState.engine.pathway.presentation,
        sessionState: uiState.engine.getSessionState(),
        radicularPhase: uiState.radicularPhase,
        trainingMode: uiState.trainingMode,
        timestamp: new Date().toISOString()
      };
      localStorage.setItem('dolor_clinical_session_v4', JSON.stringify(stateObj));
      localStorage.setItem('dolor_last_session', JSON.stringify({
        pathwayId: uiState.engine.pathway.id,
        timestamp: new Date().toISOString()
      }));
    } catch (e) {
      console.warn('Error saving clinical session:', e);
    }
  }

  function getSavedClinicalSession() {
    try {
      const raw = localStorage.getItem('dolor_clinical_session_v4');
      if (!raw) return null;
      const data = JSON.parse(raw);
      const sessionDate = new Date(data.timestamp);
      const now = new Date();
      // Keep valid for 48 hours
      if ((now - sessionDate) > 48 * 3600 * 1000) {
        return null;
      }
      return data;
    } catch (e) {
      return null;
    }
  }

  function clearClinicalSession() {
    try {
      localStorage.removeItem('dolor_clinical_session_v4');
    } catch (e) {}
  }

  async function resumeLastSession() {
    const saved = getSavedClinicalSession();
    if (!saved || !saved.pathwayId) return;
    await startPathway(saved.pathwayId, {
      savedState: saved.sessionState,
      radicularPhase: saved.radicularPhase,
      trainingMode: saved.trainingMode
    });
  }

  function discardLastSession() {
    clearClinicalSession();
    renderHomeScreen();
  }

  function saveRecentSession(pathwayId) {
    saveCurrentClinicalSession();
  }

  function renderRecentPathwaysList() {
    const listEl = document.getElementById('recentsChipsList');
    if (!listEl) return;
    // Keep quick chips updated
  }

  function setRadicularPhase(phase) {
    uiState.radicularPhase = phase;
    saveCurrentClinicalSession();
    renderCurrentStep();
  }


  // ─────────────────────────────────────────────
  // SPRINT 14 — FOUR MASTER AREAS & REASONING HUB
  // ─────────────────────────────────────────────

  function startConsultaExpress(regionId) {
    uiState.expressMode = true;
    uiState.mentorMode = false;
    localStorage.setItem('dolor_express_mode', 'true');
    localStorage.setItem('dolor_mentor_mode', 'false');

    switchAppMode('consultation');
    if (regionId) {
      renderPresentationSelector(regionId);
    } else {
      renderRegionSelector();
    }
  }

  function startRazonamientoDeep(pathwayId) {
    uiState.expressMode = false;
    uiState.mentorMode = true;
    localStorage.setItem('dolor_express_mode', 'false');
    localStorage.setItem('dolor_mentor_mode', 'true');

    switchAppMode('reasoning');
    if (pathwayId) {
      startPathway(pathwayId);
    } else {
      renderReasoningHub();
    }
  }

  function renderReasoningHub(activeTab = 'pathways') {
    const clinicalEl = getClinicalContainer();
    if (!clinicalEl) return;

    const registry = window.CLINICAL_PATHWAYS_REGISTRY || {};
    const allPathways = [];
    for (const regKey in registry) {
      const reg = registry[regKey];
      (reg.presentations || []).forEach(p => {
        allPathways.push({
          ...p,
          regionId: regKey,
          regionLabel: reg.label,
          regionIcon: reg.icon
        });
      });
    }

    // Classify pathways by visualTier
    const primaryPathways = allPathways.filter(p => p.visualTier === 'primary' || !p.visualTier);
    const secondaryPathways = allPathways.filter(p => p.visualTier === 'secondary');
    const safetyPathways = allPathways.filter(p => p.visualTier === 'safety');
    const uncertainPathways = allPathways.filter(p => p.visualTier === 'uncertain');

    clinicalEl.innerHTML = `
      <div class="reasoning-hub-screen">
        <div class="reasoning-hub-header glass-panel">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.5rem;">
            <div class="home-hero-badge" style="background: rgba(139, 92, 246, 0.15); color: #a78bfa;">
              🧠 MODO RAZONAMIENTO CLÍNICO
            </div>
            <button class="clinical-action-btn" onclick="window.ClinicalUI.switchAppMode('home')" style="font-size: 0.8rem; padding: 0.35rem 0.8rem;">
              <span>🏠 Volver al Inicio</span>
            </button>
          </div>
          <h2>Comprender, Simular y Profundizar</h2>
          <p>Explora 35 vías clínicas jerarquizadas, entrena con 9 casos clínicos a ciegas con auditoría de sesgos, o utiliza la calculadora bayesiana.</p>

          <!-- SUBTABS DE RAZONAMIENTO -->
          <div class="reasoning-subtabs-bar" style="display: flex; gap: 0.5rem; margin-top: 1.25rem; flex-wrap: wrap;">
            <button class="reasoning-subtab-btn ${activeTab === 'pathways' ? 'active' : ''}" onclick="window.ClinicalUI.renderReasoningHub('pathways')">
              <span>🗂️</span> <span>35 Clinical Pathways</span>
            </button>
            <button class="reasoning-subtab-btn ${activeTab === 'cases' ? 'active' : ''}" onclick="window.ClinicalUI.renderCaseSelector()">
              <span>🎓</span> <span>9 Casos Simulados (A Ciegas)</span>
            </button>
            <button class="reasoning-subtab-btn ${activeTab === 'bayes' ? 'active' : ''}" onclick="window.ClinicalUI.openBayesianCalculatorModal()">
              <span>📊</span> <span>Calculadora Bayesiana (Pre/Post)</span>
            </button>
          </div>
        </div>

        ${activeTab === 'pathways' ? `
          <!-- SECCIÓN 1: PATHWAYS JERARQUIZADOS POR TIERS -->
          <div class="pathways-tier-group" style="margin-top: 1.5rem;">
            
            <!-- TIER 1: PRIMARY / FRECUENTES -->
            <div class="tier-container" style="margin-bottom: 2rem;">
              <div class="tier-heading-row" style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.85rem;">
                <span style="font-size: 1.1rem;">🟢</span>
                <h3 style="margin: 0; font-size: 1.1rem; color: var(--text-primary);">Vías Principales de Consulta Diaria (${primaryPathways.length})</h3>
                <span class="pres-tier-badge primary" style="margin-left: auto;">Alta Frecuencia</span>
              </div>
              <div class="tier-cards-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 0.75rem;">
                ${primaryPathways.map(p => `
                  <div class="presentation-card tier-primary active-pathway" onclick="window.ClinicalUI.startPathwayDirect('${p.id}')">
                    <div class="pres-info-group">
                      <div class="pres-title-row">
                        <span style="font-size: 1.2rem;">${p.regionIcon}</span>
                        <h4>${p.label}</h4>
                      </div>
                      <p style="font-size: 0.78rem; color: var(--text-secondary); margin-top: 0.25rem;">Región: ${p.regionLabel}</p>
                    </div>
                    <span class="pres-badge-status available">▶ Explorar</span>
                  </div>
                `).join('')}
              </div>
            </div>

            <!-- TIER 2: SECONDARY / MENOS HABITUALES -->
            <div class="tier-container" style="margin-bottom: 2rem;">
              <div class="tier-heading-row" style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.85rem;">
                <span style="font-size: 1.1rem;">🟣</span>
                <h3 style="margin: 0; font-size: 1.1rem; color: var(--text-primary);">Vías Secundarias y Diagnóstico de Descarte (${secondaryPathways.length})</h3>
                <span class="pres-tier-badge secondary" style="margin-left: auto;">Menos habitual</span>
              </div>
              <div class="tier-cards-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 0.75rem;">
                ${secondaryPathways.map(p => `
                  <div class="presentation-card tier-secondary active-pathway" onclick="window.ClinicalUI.startPathwayDirect('${p.id}')">
                    <div class="pres-info-group">
                      <div class="pres-title-row">
                        <span style="font-size: 1.2rem;">${p.regionIcon}</span>
                        <h4>${p.label}</h4>
                      </div>
                      <p style="font-size: 0.78rem; color: var(--text-secondary); margin-top: 0.25rem;">Región: ${p.regionLabel}</p>
                    </div>
                    <span class="pres-badge-status available">▶ Explorar</span>
                  </div>
                `).join('')}
              </div>
            </div>

            <!-- TIER 3: SAFETY & BANDERAS ROJAS -->
            <div class="tier-container" style="margin-bottom: 2rem;">
              <div class="tier-heading-row" style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.85rem;">
                <span style="font-size: 1.1rem;">🔴</span>
                <h3 style="margin: 0; font-size: 1.1rem; color: #ef4444;">Emergencias de Seguridad y Alarma (${safetyPathways.length})</h3>
                <span class="pres-tier-badge safety" style="margin-left: auto;">Crítico</span>
              </div>
              <div class="tier-cards-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 0.75rem;">
                ${safetyPathways.map(p => `
                  <div class="presentation-card tier-safety active-pathway" onclick="window.ClinicalUI.startPathwayDirect('${p.id}')">
                    <div class="pres-info-group">
                      <div class="pres-title-row">
                        <span style="font-size: 1.2rem;">${p.regionIcon}</span>
                        <h4>${p.label}</h4>
                      </div>
                      <p style="font-size: 0.78rem; color: #ef4444; margin-top: 0.25rem;">Región: ${p.regionLabel} · Descarte urgente</p>
                    </div>
                    <span class="pres-badge-status available" style="background: rgba(239, 68, 68, 0.15); color: #ef4444;">▶ Safety</span>
                  </div>
                `).join('')}
              </div>
            </div>

            <!-- TIER 4: UNCERTAINTY -->
            ${uncertainPathways.length > 0 ? `
              <div class="tier-container" style="margin-bottom: 2rem;">
                <div class="tier-heading-row" style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.85rem;">
                  <span style="font-size: 1.1rem;">🟡</span>
                  <h3 style="margin: 0; font-size: 1.1rem; color: var(--text-primary);">Manejo de la Incertidumbre Clínica (${uncertainPathways.length})</h3>
                  <span class="pres-tier-badge uncertain" style="margin-left: auto;">Incertidumbre</span>
                </div>
                <div class="tier-cards-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 0.75rem;">
                  ${uncertainPathways.map(p => `
                    <div class="presentation-card tier-uncertain active-pathway" onclick="window.ClinicalUI.startPathwayDirect('${p.id}')">
                      <div class="pres-info-group">
                        <div class="pres-title-row">
                          <span style="font-size: 1.2rem;">${p.regionIcon}</span>
                          <h4>${p.label}</h4>
                        </div>
                        <p style="font-size: 0.78rem; color: var(--text-secondary); margin-top: 0.25rem;">Región: ${p.regionLabel}</p>
                      </div>
                      <span class="pres-badge-status available">▶ Explorar</span>
                    </div>
                  `).join('')}
                </div>
              </div>
            ` : ''}

          </div>
        ` : ''}
      </div>
    `;
  }

  function openBayesianCalculatorModal(testName = 'Test de Spurling', sn = 0.50, sp = 0.94, lrPlus = 8.3, lrMinus = 0.53) {
    const modalHtml = `
      <div class="aux-modal-header" style="border-bottom: 2px solid var(--accent-primary, #6366f1);">
        <h3><span>📊</span> <span>Calculadora Bayesiana de Probabilidad Pre/Post-Test</span></h3>
      </div>
      <div class="aux-items-list">
        <p style="font-size: 0.84rem; color: var(--text-secondary); margin-bottom: 1rem;">
          Los tests ortopédicos no emiten diagnósticos absolutos; modifican la probabilidad clínica previa mediante su <strong>Likelihood Ratio (LR)</strong>.
        </p>

        <!-- PRESETS RÁPIDOS -->
        <div style="margin-bottom: 1.25rem;">
          <div style="font-size: 0.78rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 0.4rem;">Presets Clínicos Auditados:</div>
          <div style="display: flex; gap: 0.4rem; flex-wrap: wrap;">
            <button class="vade-quick-tag" onclick="window.ClinicalUI.setBayesPreset('Spurling (Cervical)', 0.50, 0.94, 8.3, 0.53)">Spurling (Radic. Cervical)</button>
            <button class="vade-quick-tag" onclick="window.ClinicalUI.setBayesPreset('Lasègue <60° (Hernia L5/S1)', 0.91, 0.26, 1.23, 0.35)">Lasègue SLR (Sensible)</button>
            <button class="vade-quick-tag" onclick="window.ClinicalUI.setBayesPreset('Lasègue Cruzado', 0.25, 0.90, 4.4, 0.83)">Lasègue Cruzado (Específico)</button>
            <button class="vade-quick-tag" onclick="window.ClinicalUI.setBayesPreset('Clúster Laslett ≥3+', 0.91, 0.87, 7.0, 0.10)">Laslett Sacroilíaca ≥3+</button>
            <button class="vade-quick-tag" onclick="window.ClinicalUI.setBayesPreset('Lever Sign / Lelli (LCA)', 0.94, 0.98, 47.0, 0.06)">Lever Sign Lelli (LCA)</button>
          </div>
        </div>

        <!-- CONTROLES INTERACTIVOS -->
        <div style="background: var(--bg-surface); padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--border-color); margin-bottom: 1.25rem;">
          <div style="font-weight: 800; font-size: 0.92rem; color: var(--text-primary); margin-bottom: 0.75rem;" id="bayesTestTitle">
            ${testName}
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
            <div>
              <label style="font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); display: block; margin-bottom: 0.3rem;">
                Probabilidad Pretest (%): <strong id="bayesPretestVal">30%</strong>
              </label>
              <input type="range" id="bayesPretestSlider" min="1" max="99" value="30" style="width: 100%; cursor: pointer;" oninput="window.ClinicalUI.recalcBayesLive()">
            </div>

            <div>
              <label style="font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); display: block; margin-bottom: 0.3rem;">
                Resultado del Test:
              </label>
              <select id="bayesResultSelect" style="width: 100%; padding: 0.4rem; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary); font-weight: 700;" onchange="window.ClinicalUI.recalcBayesLive()">
                <option value="pos" selected>Positivo (+) — Aplica LR+ (<span id="bayesLrPosText">${lrPlus}</span>)</option>
                <option value="neg">Negativo (-) — Aplica LR- (<span id="bayesLrNegText">${lrMinus}</span>)</option>
              </select>
            </div>
          </div>

          <!-- RESULTADO VISUAL BAYES -->
          <div id="bayesOutputCard" style="background: rgba(16, 185, 129, 0.08); border: 1.5px solid #10b981; border-radius: var(--radius-md); padding: 1rem; text-align: center;">
            <div style="font-size: 0.78rem; text-transform: uppercase; font-weight: 800; color: #10b981; margin-bottom: 0.25rem;">
              Probabilidad Post-Test Calculada:
            </div>
            <div style="font-size: 2.2rem; font-weight: 900; color: #10b981;" id="bayesPosttestVal">
              78%
            </div>
            <div style="font-size: 0.84rem; color: var(--text-secondary); margin-top: 0.35rem;" id="bayesShiftText">
              El test positivo elevó la probabilidad diagnóstica del <strong>30%</strong> al <strong>78%</strong> (+48%).
            </div>
          </div>
        </div>

        <div style="text-align: right;">
          <button class="vade-primary-btn" onclick="window.ClinicalUI.closeAuxModal()" style="padding: 0.5rem 1.25rem;">Entendido</button>
        </div>
      </div>
    `;

    showAuxModal(modalHtml);
    window._currentBayesParams = { testName, sn, sp, lrPlus, lrMinus };
    recalcBayesLive();
  }

  function setBayesPreset(name, sn, sp, lrPlus, lrMinus) {
    window._currentBayesParams = { testName: name, sn, sp, lrPlus, lrMinus };
    const titleEl = document.getElementById('bayesTestTitle');
    const lrPosEl = document.getElementById('bayesLrPosText');
    const lrNegEl = document.getElementById('bayesLrNegText');
    if (titleEl) titleEl.textContent = name;
    if (lrPosEl) lrPosEl.textContent = lrPlus;
    if (lrNegEl) lrNegEl.textContent = lrMinus;
    recalcBayesLive();
  }

  function recalcBayesLive() {
    const slider = document.getElementById('bayesPretestSlider');
    const select = document.getElementById('bayesResultSelect');
    const pretestValEl = document.getElementById('bayesPretestVal');
    const posttestValEl = document.getElementById('bayesPosttestVal');
    const shiftTextEl = document.getElementById('bayesShiftText');
    const outCard = document.getElementById('bayesOutputCard');

    if (!slider || !select || !window._currentBayesParams) return;

    const pretestPct = Number(slider.value) || 30;
    if (pretestValEl) pretestValEl.textContent = `${pretestPct}%`;

    const isPos = select.value === 'pos';
    const lr = isPos ? (window._currentBayesParams.lrPlus || 1.0) : (window._currentBayesParams.lrMinus || 1.0);

    const pretestProb = pretestPct / 100;
    const pretestOdds = pretestProb / (1 - pretestProb);
    const posttestOdds = pretestOdds * lr;
    const posttestProb = posttestOdds / (1 + posttestOdds);
    const posttestPct = Math.round(posttestProb * 100);
    const diff = posttestPct - pretestPct;

    if (posttestValEl) posttestValEl.textContent = `${posttestPct}%`;
    if (shiftTextEl) {
      if (diff >= 0) {
        shiftTextEl.innerHTML = `El test ${isPos ? 'positivo (+)' : 'negativo (-)'} eleva la sospecha clínica de <strong>${pretestPct}%</strong> a <strong>${posttestPct}%</strong> (+${diff}%).`;
      } else {
        shiftTextEl.innerHTML = `El test ${isPos ? 'positivo (+)' : 'negativo (-)'} reduce la probabilidad diagnóstica de <strong>${pretestPct}%</strong> a <strong>${posttestPct}%</strong> (${diff}%).`;
      }
    }

    if (outCard) {
      const color = posttestPct >= 70 ? '#10b981' : posttestPct >= 40 ? '#f59e0b' : '#3b82f6';
      outCard.style.borderColor = color;
      outCard.style.background = `${color}11`;
      if (posttestValEl) posttestValEl.style.color = color;
    }
  }

  function openContextualCoachModal() {
    if (!uiState.engine) return;
    const diagnosis = uiState.engine.generateWorkingDiagnosis();
    const certainty = uiState.engine.getClinicalCertainty();
    const pathway = uiState.engine.pathway;
    const topHyp = diagnosis.topHypothesis || {};
    const generator = diagnosis.generator || {};

    showAuxModal(`
      <div class="aux-modal-header" style="border-bottom: 2px solid #10b981;">
        <h3><span>🗣️</span> <span>Guion y Pedagogía para el Paciente (Coach Clínico)</span></h3>
      </div>
      <div class="aux-items-list">
        <p style="font-size: 0.84rem; color: var(--text-secondary); margin-bottom: 1rem;">
          Explicación adaptada al diagnóstico de <strong>${topHyp.name || pathway.presentation}</strong> sin términos amenazantes ni efecto nocebo.
        </p>

        <div class="coach-speech-card" style="background: rgba(16, 185, 129, 0.08); border-left: 4px solid #10b981; padding: 1rem; border-radius: var(--radius-md); margin-bottom: 1rem;">
          <h4 style="color: #10b981; margin: 0 0 0.5rem; font-size: 0.95rem;">1. Metáfora Explicativa del Origen del Dolor:</h4>
          <p style="font-size: 0.86rem; color: var(--text-primary); line-height: 1.5; margin: 0;">
            "Lo que sientes en tu ${pathway.regionLabel || 'zona afectada'} no se debe a que la estructura esté rota irreparablemente, sino a que el sistema de alarma de los tejidos está excesivamente sensibilizado. Nuestro objetivo es calmar esa alarma y reeducar la tolerancia al movimiento."
          </p>
        </div>

        <div class="coach-speech-card" style="background: rgba(99, 102, 241, 0.08); border-left: 4px solid #6366f1; padding: 1rem; border-radius: var(--radius-md); margin-bottom: 1rem;">
          <h4 style="color: #818cf8; margin: 0 0 0.5rem; font-size: 0.95rem;">2. Mensaje sobre el Ejercicio y la Carga:</h4>
          <p style="font-size: 0.86rem; color: var(--text-primary); line-height: 1.5; margin: 0;">
            "El dolor durante el ejercicio no significa daño. Una molestia leve (hasta 3-4 sobre 10) que desaparece en las horas siguientes es el estímulo seguro y necesario para que el tejido se fortalezca y recupere su función."
          </p>
        </div>

        <div class="coach-speech-card" style="background: rgba(245, 158, 11, 0.08); border-left: 4px solid #f59e0b; padding: 1rem; border-radius: var(--radius-md); margin-bottom: 1.25rem;">
          <h4 style="color: #f59e0b; margin: 0 0 0.5rem; font-size: 0.95rem;">3. Expectativas sobre Infiltraciones o Fármacos:</h4>
          <p style="font-size: 0.86rem; color: var(--text-primary); line-height: 1.5; margin: 0;">
            "La medicación o la técnica ecoguiada no son una solución mágica que reemplace la rehabilitación; son una 'ventana de oportunidad' para bajar la intensidad del dolor y permitirte recuperar tu actividad diaria y tu ejercicio sin sufrimiento."
          </p>
        </div>

        <div style="text-align: right;">
          <button class="vade-primary-btn" onclick="window.ClinicalUI.closeAuxModal()" style="padding: 0.5rem 1.25rem;">Cerrar</button>
        </div>
      </div>
    `);
  }

  function copyStandardClinicalOutput() {
    if (!uiState.engine) return;
    const text = uiState.engine.generateStandardClinicalOutput ? uiState.engine.generateStandardClinicalOutput() : '';
    const textarea = document.getElementById('clinicalSummaryText');
    const content = (textarea && textarea.value) ? textarea.value : text;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(content).then(() => {
        const lbl = document.getElementById('copyStandardHCLabel');
        if (lbl) {
          lbl.textContent = '¡COPIADO A HC! ✅';
          setTimeout(() => { lbl.textContent = 'COPIAR HISTORIA'; }, 2500);
        }
      }).catch(() => {
        if (textarea) textarea.select();
        document.execCommand('copy');
      });
    } else {
      if (textarea) textarea.select();
      document.execCommand('copy');
    }
  }

  function handleUniversalSearch(query) {
    const q = (query || '').trim().toLowerCase();
    const resultsContainer = document.getElementById('homeUniversalSearchResults');
    const clearBtn = document.getElementById('homeClearSearchBtn');
    if (clearBtn) clearBtn.style.display = q ? 'block' : 'none';

    if (!resultsContainer) return;

    if (!q || q.length < 2) {
      resultsContainer.style.display = 'none';
      resultsContainer.innerHTML = '';
      return;
    }

    const matches = [];

    // 1. Search Pathways
    const registry = window.CLINICAL_PATHWAYS_REGISTRY || {};
    for (const regKey in registry) {
      const reg = registry[regKey];
      (reg.presentations || []).forEach(p => {
        if (p.label.toLowerCase().includes(q) || reg.label.toLowerCase().includes(q)) {
          matches.push({
            type: 'pathway',
            icon: reg.icon || '🩺',
            badge: 'Clinical Pathway',
            title: p.label,
            subtitle: `Región: ${reg.label}`,
            action: `window.ClinicalUI.startPathwayDirect('${p.id}')`
          });
        }
      });
    }

    // 2. Search Tests
    const tests = (window.state && window.state.tests) || (window.EMBEDDED_BUNDLE && window.EMBEDDED_BUNDLE.tests_catalog && window.EMBEDDED_BUNDLE.tests_catalog.tests) || [];
    tests.forEach(t => {
      if (t.name.toLowerCase().includes(q) || (t.clinical_interpretation && t.clinical_interpretation.toLowerCase().includes(q)) || (t.area && t.area.toLowerCase().includes(q))) {
        matches.push({
          type: 'test',
          icon: '📋',
          badge: 'Test Físico',
          title: t.name,
          subtitle: `${t.area_label || t.area} · Sn: ${Math.round((t.sensitivity || 0.8) * 100)}% | Sp: ${Math.round((t.specificity || 0.8) * 100)}%`,
          action: `window.ClinicalUI.switchAppMode('library'); if (window.openTestModal) window.openTestModal('${t.id}')`
        });
      }
    });

    // 3. Search Drugs / Infiltrations / RF in Vademecum
    const vade = (window.EMBEDDED_BUNDLE && window.EMBEDDED_BUNDLE.vademecum && window.EMBEDDED_BUNDLE.vademecum.drugs) || [];
    vade.forEach(d => {
      if (d.name.toLowerCase().includes(q) || (d.category && d.category.toLowerCase().includes(q)) || (d.indication && d.indication.toLowerCase().includes(q))) {
        matches.push({
          type: 'drug',
          icon: d.category === 'intervencionismo_ecoguiado' ? '💉' : d.category === 'radiofrecuencia' ? '⚡' : '💊',
          badge: d.category === 'intervencionismo_ecoguiado' ? 'Infiltración' : d.category === 'radiofrecuencia' ? 'Radiofrecuencia' : 'Fármaco',
          title: d.name,
          subtitle: `${d.indication || d.mechanism || 'Vademécum de Dolor'}`,
          action: `window.ClinicalUI.switchAppMode('techniques'); if (window.Vademecum) { window.Vademecum.setMode('drugs'); window.Vademecum.openDrugModal('${d.id}'); }`
        });
      }
    });

    if (matches.length === 0) {
      resultsContainer.style.display = 'block';
      resultsContainer.innerHTML = `
        <div style="padding: 1rem; text-align: center; color: var(--text-muted); font-size: 0.85rem;">
          No se encontraron resultados para "<strong>${escapeHtml(query)}</strong>". Prueba con <em>ciática, hombro, pregabalina, epidural, Lasègue, facetario</em>...
        </div>
      `;
      return;
    }

    resultsContainer.style.display = 'block';
    resultsContainer.innerHTML = `
      <div class="universal-search-results-list" style="display: flex; flex-direction: column; gap: 0.35rem;">
        ${matches.slice(0, 8).map(m => `
          <div class="universal-search-item" onclick="${m.action}" style="display: flex; justify-content: space-between; align-items: center; padding: 0.6rem 0.85rem; border-radius: var(--radius-sm); background: var(--bg-surface); border: 1px solid var(--border-color); cursor: pointer; transition: all 0.15s ease;">
            <div style="display: flex; align-items: center; gap: 0.6rem;">
              <span style="font-size: 1.2rem;">${m.icon}</span>
              <div>
                <div style="font-weight: 700; font-size: 0.88rem; color: var(--text-primary);">${m.title}</div>
                <div style="font-size: 0.75rem; color: var(--text-muted);">${m.subtitle}</div>
              </div>
            </div>
            <span class="treatment-badge-pill blue" style="font-size: 0.7rem;">${m.badge}</span>
          </div>
        `).join('')}
      </div>
    `;
  }

  function clearUniversalSearch() {
    const input = document.getElementById('homeUniversalSearchInput');
    if (input) input.value = '';
    handleUniversalSearch('');
  }


  function switchAppMode(mode) {
    const homeEl = document.getElementById('home-screen');
    const clinicalEl = document.getElementById('clinical-reasoning-container');
    const libraryEl = document.getElementById('library-container');
    const mainHeader = document.getElementById('appMainHeader') || document.querySelector('.main-header');
    const navTabs = document.querySelector('.nav-tabs-wrapper');
    const filtersSection = document.querySelector('.filters-section');
    const mainContent = document.querySelector('.main-content');

    // Reset all workspaces
    if (homeEl) {
      homeEl.style.display = 'none';
      homeEl.classList.remove('active');
    }
    if (clinicalEl) {
      clinicalEl.style.display = 'none';
      clinicalEl.classList.remove('active');
    }
    if (libraryEl) {
      libraryEl.style.display = 'none';
      libraryEl.classList.remove('active');
    }
    if (mainHeader) mainHeader.style.display = 'none';
    if (navTabs) navTabs.style.display = 'none';
    if (filtersSection) filtersSection.style.display = 'none';
    if (mainContent) mainContent.style.display = 'none';

    if (mode === 'home') {
      if (homeEl) {
        homeEl.style.display = 'block';
        homeEl.classList.add('active');
        renderHomeScreen();
      }
    } else if (mode === 'consultation' || mode === 'clinical') {
      if (clinicalEl) {
        clinicalEl.style.display = 'block';
        clinicalEl.classList.add('active');
        if (!uiState.engine) {
          renderRegionSelector();
        } else {
          renderCurrentStep();
        }
      }
    } else if (mode === 'reasoning') {
      if (clinicalEl) {
        clinicalEl.style.display = 'block';
        clinicalEl.classList.add('active');
        if (!uiState.engine) {
          renderReasoningHub();
        } else {
          renderCurrentStep();
        }
      }
    } else if (mode === 'techniques') {
      if (libraryEl) libraryEl.style.display = 'block';
      if (mainHeader) mainHeader.style.display = 'block';
      if (navTabs) navTabs.style.display = 'block';
      if (mainContent) mainContent.style.display = 'block';
      if (window.switchTab) window.switchTab('tab-ultrasound');
    } else if (mode === 'library') {
      if (libraryEl) libraryEl.style.display = 'block';
      if (mainHeader) mainHeader.style.display = 'block';
      if (navTabs) navTabs.style.display = 'block';
      if (filtersSection) filtersSection.style.display = 'block';
      if (mainContent) mainContent.style.display = 'block';
      if (window.switchTab) window.switchTab('tab-tests');
    }

    // Sync header navigation buttons
    document.querySelectorAll('.header-nav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-mode') === mode);
    });

    // Sync mobile bottom bar items
    document.querySelectorAll('.mobile-nav-item').forEach(btn => {
      const btnMode = btn.getAttribute('data-mode') || btn.getAttribute('data-tab');
      if (mode === 'home' && (btnMode === 'home' || btnMode === 'tab-home')) btn.classList.add('active');
      else if ((mode === 'consultation' || mode === 'clinical') && (btnMode === 'consultation' || btnMode === 'tab-clinical')) btn.classList.add('active');
      else if (mode === 'reasoning' && (btnMode === 'reasoning' || btnMode === 'tab-quiz')) btn.classList.add('active');
      else if (mode === 'techniques' && (btnMode === 'techniques' || btnMode === 'tab-vademecum')) btn.classList.add('active');
      else if (mode === 'library' && (btnMode === 'library' || btnMode === 'tab-tests')) btn.classList.add('active');
      else btn.classList.remove('active');
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ─────────────────────────────────────────────
  // PUBLIC API EXPORT
  // ─────────────────────────────────────────────

  window.ClinicalUI = {
    init: initClinicalUI,
    switchAppMode: switchAppMode,
    startConsultaExpress: startConsultaExpress,
    startRazonamientoDeep: startRazonamientoDeep,
    renderReasoningHub: renderReasoningHub,
    openBayesianCalculatorModal: openBayesianCalculatorModal,
    setBayesPreset: setBayesPreset,
    recalcBayesLive: recalcBayesLive,
    openContextualCoachModal: openContextualCoachModal,
    copyStandardClinicalOutput: copyStandardClinicalOutput,
    handleUniversalSearch: handleUniversalSearch,
    clearUniversalSearch: clearUniversalSearch,
    closeAuxModal: closeAuxModal,
    renderHomeScreen: renderHomeScreen,
    renderRegionSelector: renderRegionSelector,
    selectRegion: renderPresentationSelector,
    startPathwayDirect: function(pathwayId) {
      uiState.simulation = null;
      return startPathway(pathwayId);
    },
    openPatientHistoryModal: openPatientHistoryModal,
    toggleRedFlag: toggleRedFlag,
    confirmRedFlags: confirmRedFlags,
    goToNextStep: goToNextStep,
    goToPrevStep: goToPrevStep,
    goToStep: function (stepId) {
      if (uiState.engine) {
        if (stepId === 'anamnesis') {
          uiState.activeQuestionIndex = 0;
        }
        uiState.engine.goToStep(stepId);
        renderCurrentStep();
      }
    },
    setQuestionIndex: function (idx) {
      uiState.activeQuestionIndex = idx;
      if (uiState.engine) {
        uiState.engine.session.currentStep = 'anamnesis';
      }
      renderCurrentStep();
    },
    proceedToAnamnesisSummary: proceedToAnamnesisSummary,
    answerQuestion: answerQuestion,
    saveCustomGoal: saveCustomGoal,
    proceedToExamination: proceedToExamination,
    recordExamFinding: recordExamFinding,
    proceedToExamSummary: proceedToExamSummary,
    proceedToImaging: proceedToImaging,
    skipImaging: skipImaging,
    recordImagingFinding: recordImagingFinding,
    proceedToGenerator: proceedToGenerator,
    proceedToTreatment: proceedToTreatment,
    proceedToFollowUp: proceedToFollowUp,
    proceedToSummary: proceedToSummary,
    openDifferentialModal: openDifferentialModal,
    openReconsiderModal: openReconsiderModal,
    openMissingInfoModal: openMissingInfoModal,
    openWhatIDoBelieveModal: openWhatIDoBelieveModal,
    renderCaseSelector: renderCaseSelector,
    startTrainingCase: startTrainingCase,
    toggleComorbidity: toggleComorbidity,
    setRadicularPhase: setRadicularPhase,
    copyPrescriptionText: copyPrescriptionText,
    openInjectablesComparisonModal: openInjectablesComparisonModal,
    proceedToCoach: proceedToCoach,
    setCoachVersion: setCoachVersion,
    nextCoachAlternative: nextCoachAlternative,
    copyCoachScript: copyCoachScript,
    toggleCoachFavorite: toggleCoachFavorite,
    openCoachLibraryModal: openCoachLibraryModal,
    resumeLastSession: resumeLastSession,
    discardLastSession: discardLastSession,
    saveCurrentClinicalSession: saveCurrentClinicalSession,
    getSavedClinicalSession: getSavedClinicalSession,
    clearClinicalSession: clearClinicalSession,
    injectUltrasoundReport: function(echoData) {
      if (!uiState.engine) return;
      if (echoData.concordance) {
        uiState.engine.session.concordanceLevel = echoData.concordance === 'concordant' ? 'high' : echoData.concordance === 'possibly_related' ? 'partial' : 'discordant';
      }
      if (echoData.report) {
        uiState.engine.session.customUltrasoundReport = echoData.report;
      }
      renderCurrentStep();
    }
  };

})();
