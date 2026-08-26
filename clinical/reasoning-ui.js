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
    if (!containers.home) return;

    containers.home.innerHTML = `
      <div class="home-hero glass-panel">
        <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; margin-bottom: 0.5rem; flex-wrap: wrap; gap: 0.5rem;">
          <div class="home-hero-badge">🩺 Sistema de Apoyo al Razonamiento Clínico</div>
          <button class="home-theme-toggle-btn" onclick="window.toggleAppTheme()" style="background: var(--bg-surface); border: 1.5px solid var(--border-color); border-radius: var(--radius-full); padding: 0.35rem 0.85rem; font-size: 0.8rem; font-weight: 700; color: var(--text-primary); cursor: pointer; display: inline-flex; align-items: center; gap: 0.4rem; box-shadow: 0 1px 3px rgba(0,0,0,0.05);" title="Alternar entre modo Claro y Oscuro">
            <span id="homeThemeIcon">${(localStorage.getItem('dolor_theme') === 'dark') ? '☀️' : '🌙'}</span>
            <span id="homeThemeLabel">${(localStorage.getItem('dolor_theme') === 'dark') ? 'Modo Claro' : 'Modo Oscuro'}</span>
          </button>
        </div>
        <h1>Medicina del Dolor de Alta Precisión</h1>
        <p>Acompañamiento diagnóstico estructurado desde el motivo de consulta del paciente hasta el generador probable, ecografía dirigida y plan terapéutico.</p>
      </div>

      <div class="home-modes-grid">
        <!-- MODE 1: CLINICAL REASONING -->
        <article class="mode-card primary-mode" id="btnLaunchClinicalMode">
          <div>
            <span class="mode-card-icon">🩺</span>
            <h2>Modo Consulta</h2>
            <p><strong>Copiloto en tiempo real:</strong> Diseñado para usar con el paciente delante. Anamnesis dirigida, discriminación de hipótesis, exploración express y plan.</p>
            <div class="mode-card-features">
              <span class="mode-feature-pill">⚠️ Red Flags</span>
              <span class="mode-feature-pill">⚡ Express 90s</span>
              <span class="mode-feature-pill">💡 Discriminador</span>
              <span class="mode-feature-pill">📋 Copiar a HC</span>
            </div>
          </div>
          <div class="mode-card-cta">
            <span>Iniciar Consulta Clínica</span> <span>→</span>
          </div>
        </article>

        <!-- MODE 2: TRAINING CASES -->
        <article class="mode-card" id="btnLaunchTrainingMode" style="border-color: rgba(139, 92, 246, 0.4); background: linear-gradient(145deg, rgba(139, 92, 246, 0.08) 0%, rgba(30, 41, 59, 0.6) 100%);">
          <div>
            <span class="mode-card-icon">🎓</span>
            <h2>Modo Entrenamiento</h2>
            <p><strong>Casos Clínicos Simulados a Ciegas:</strong> Entrena con casos Canónicos, Realistas, Trampas Diagnósticas y Emergencias de Seguridad con auditoría de sesgos.</p>
            <div class="mode-card-features">
              <span class="mode-feature-pill">🟢 Canónicos</span>
              <span class="mode-feature-pill">🟡 Realistas</span>
              <span class="mode-feature-pill">🟣 Trampas</span>
              <span class="mode-feature-pill">🔴 Seguridad</span>
            </div>
          </div>
          <div class="mode-card-cta" style="color: #a78bfa;">
            <span>Entrenar con Casos</span> <span>→</span>
          </div>
        </article>

        <!-- MODE 3: CLINICAL LIBRARY -->
        <article class="home-mode-card glass-panel" id="btnLaunchLibraryMode">
          <div class="mode-card-badge" style="background: rgba(37, 99, 235, 0.2); color: var(--accent-blue);">Biblioteca</div>
          <div>
            <span class="mode-card-icon">📚</span>
            <h2>Biblioteca Clínica</h2>
            <p><strong>Atlas y Material de Consulta:</strong> Catálogo de 43 tests psicométricos, 86 vídeos HD (Physiotutors & Educom™), 17 fichas Notion v2.6, clústeres y simulador.</p>
            <div class="mode-card-features">
              <span class="mode-feature-pill">🧍 Atlas SVG</span>
              <span class="mode-feature-pill">🎬 Videoteca HD</span>
              <span class="mode-feature-pill">🗂️ Fichas v2.6</span>
              <span class="mode-feature-pill">📝 Simulador</span>
            </div>
          </div>
          <div class="mode-card-cta">
            <span>Explorar Biblioteca</span> <span>→</span>
          </div>
        </article>

        <!-- CARD 4: VADEMÉCUM DE DOLOR -->
        <article class="home-mode-card glass-panel" id="btnLaunchVademecumMode" style="border-top: 4px solid #8b5cf6;">
          <div class="mode-card-badge" style="background: rgba(139, 92, 246, 0.2); color: #8b5cf6;">Farmacología</div>
          <div>
            <span class="mode-card-icon">💊</span>
            <h2>Vademécum de Dolor</h2>
            <p><strong>Chuleta Farmacológica de Consulta:</strong> Dosis iniciales, habituales, máximas, titulación, precauciones, interacciones, modo Express en 5–10s y fichas completas.</p>
            <div class="mode-card-features">
              <span class="mode-feature-pill">⚡ Modo Express</span>
              <span class="mode-feature-pill">🧠 5 Dosis Clave</span>
              <span class="mode-feature-pill">⚠️ Interacciones</span>
              <span class="mode-feature-pill">⭐ Mis Fármacos</span>
            </div>
          </div>
          <div class="mode-card-cta">
            <span>Abrir Vademécum</span> <span>→</span>
          </div>
        </article>
      </div>

      <!-- Recent Consultations Bar -->
      <div class="home-recents-section glass-panel" id="homeRecentsBox">
        <div class="home-recents-title">
          <span>⚡</span> <span>Acceso Directo a los 19 Clinical Pathways Activos</span>
        </div>
        <div class="recents-chips-list" id="recentsChipsList">
          <button class="recent-pathway-chip" onclick="window.ClinicalUI.startPathwayDirect('shoulder-lateral-pain')">
            <span>🦴</span> <span>Hombro: Lateral</span>
          </button>
          <button class="recent-pathway-chip" onclick="window.ClinicalUI.startPathwayDirect('shoulder-stiffness')">
            <span>🧊</span> <span>Hombro: Rigidez</span>
          </button>
          <button class="recent-pathway-chip" onclick="window.ClinicalUI.startPathwayDirect('shoulder-anterior-pain')">
            <span>🦴</span> <span>Hombro: Anterior / Bíceps</span>
          </button>
          <button class="recent-pathway-chip" onclick="window.ClinicalUI.startPathwayDirect('lumbar-radicular-pain')">
            <span>⚡</span> <span>Lumbar: Radiculopatía L4-S1</span>
          </button>
          <button class="recent-pathway-chip" onclick="window.ClinicalUI.startPathwayDirect('lumbar-axial-pain')">
            <span>🦴</span> <span>Lumbar: Axial (Facetas)</span>
          </button>
          <button class="recent-pathway-chip" onclick="window.ClinicalUI.startPathwayDirect('lumbar-claudication')">
            <span>⚡</span> <span>Lumbar: Claudicación / Estenosis</span>
          </button>
          <button class="recent-pathway-chip" onclick="window.ClinicalUI.startPathwayDirect('cervical-radicular')">
            <span>🧠</span> <span>Cervical: Radiculopatía C6/C7</span>
          </button>
          <button class="recent-pathway-chip" onclick="window.ClinicalUI.startPathwayDirect('cervical-axial')">
            <span>🧠</span> <span>Cervical: Axial / Cefalea</span>
          </button>
          <button class="recent-pathway-chip" onclick="window.ClinicalUI.startPathwayDirect('hip-lateral')">
            <span>🦿</span> <span>Cadera: Lateral (GTPS)</span>
          </button>
          <button class="recent-pathway-chip" onclick="window.ClinicalUI.startPathwayDirect('hip-inguinal')">
            <span>🦿</span> <span>Cadera: Inguinal (Coxartrosis)</span>
          </button>
          <button class="recent-pathway-chip" onclick="window.ClinicalUI.startPathwayDirect('knee-oa-anterior')">
            <span>🦵</span> <span>Rodilla: Anterior / Artrosis</span>
          </button>
          <button class="recent-pathway-chip" onclick="window.ClinicalUI.startPathwayDirect('knee-medial')">
            <span>🦵</span> <span>Rodilla: Medial / Menisco</span>
          </button>
          <button class="recent-pathway-chip" onclick="window.ClinicalUI.startPathwayDirect('si-posterior-pelvic')">
            <span>🎯</span> <span>Sacroilíaca: Laslett</span>
          </button>
          <button class="recent-pathway-chip" onclick="window.ClinicalUI.startPathwayDirect('elbow-lateral')">
            <span>🦾</span> <span>Codo: Epicondilalgia</span>
          </button>
          <button class="recent-pathway-chip" onclick="window.ClinicalUI.startPathwayDirect('wrist-cts')">
            <span>🤲</span> <span>Mano: Túnel Carpiano</span>
          </button>
          <button class="recent-pathway-chip" onclick="window.ClinicalUI.startPathwayDirect('wrist-radial')">
            <span>🖐️</span> <span>Muñeca: De Quervain</span>
          </button>
          <button class="recent-pathway-chip" onclick="window.ClinicalUI.startPathwayDirect('ankle-plantar')">
            <span>🦶</span> <span>Pie: Fascitis Plantar</span>
          </button>
          <button class="recent-pathway-chip" onclick="window.ClinicalUI.startPathwayDirect('ankle-medial')">
            <span>🦶</span> <span>Tobillo: Medial / Tibial Post</span>
          </button>
          <button class="recent-pathway-chip" onclick="window.ClinicalUI.startPathwayDirect('nociplastic-pain')">
            <span>🌪️</span> <span>Dolor Nociplástico / Fibromialgia</span>
          </button>
        </div>
      </div>

      <div class="safety-disclaimer-footer">
        <p><strong>AVISO CLÍNICO:</strong> Esta herramienta es un sistema de apoyo al razonamiento y toma de decisiones clínicas para profesionales médicos. No sustituye el juicio clínico independiente ni establece diagnósticos automatizados.</p>
      </div>
    `;

    // Event listeners for mode cards
    document.getElementById('btnLaunchClinicalMode')?.addEventListener('click', () => {
      window.ClinicalUI.switchAppMode('clinical');
      renderRegionSelector();
    });

    document.getElementById('btnLaunchTrainingMode')?.addEventListener('click', () => {
      window.ClinicalUI.switchAppMode('clinical');
      renderCaseSelector();
    });

    document.getElementById('btnLaunchLibraryMode')?.addEventListener('click', () => {
      window.ClinicalUI.switchAppMode('library');
    });

    document.getElementById('btnLaunchVademecumMode')?.addEventListener('click', () => {
      window.ClinicalUI.switchAppMode('library');
      if (typeof window.switchTab === 'function') {
        window.switchTab('tab-vademecum');
      }
    });
  }

  function renderRegionSelector() {
    if (!containers.clinical) return;

    const registry = window.CLINICAL_PATHWAYS_REGISTRY || {};
    const regions = Object.keys(registry).map(k => ({ id: k, ...registry[k] }));

    containers.clinical.innerHTML = `
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
    if (!containers.clinical) return;
    uiState.selectedRegion = regionId;

    const registry = window.CLINICAL_PATHWAYS_REGISTRY || {};
    const regionObj = registry[regionId];
    if (!regionObj) return renderRegionSelector();

    containers.clinical.innerHTML = `
      <div class="reasoning-select-screen">
        <div class="reasoning-screen-header">
          <div class="home-hero-badge">${regionObj.icon} ${regionObj.label}</div>
          <h2>¿Cuál es el patrón principal del dolor?</h2>
          <p>Selecciona cómo se presenta clínicamente el paciente.</p>
        </div>

        <div class="presentations-list">
          ${regionObj.presentations.map(p => `
            <div class="presentation-card ${p.available ? 'active-pathway' : 'disabled'}" 
                 onclick="${p.available ? `window.ClinicalUI.startPathwayDirect('${p.id}')` : `alert('Este Clinical Pathway está planificado para el próximo sprint y estará disponible próximamente.')`}">
              <div class="pres-info-group">
                <h4>${p.label}</h4>
                <p>${p.available ? 'Clinical Pathway completo disponible (Anamnesis → Exploración → Eco → Plan)' : 'En desarrollo (Próximamente)'}</p>
              </div>
              <span class="pres-badge-status ${p.available ? 'available' : 'upcoming'}">
                ${p.available ? '▶ Iniciar Pathway' : 'Próximamente'}
              </span>
            </div>
          `).join('')}
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

  async function startPathway(pathwayId) {
    uiState.currentPathwayId = pathwayId;

    // Load pathway JSON
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
        if (pathwayId === 'lumbar-axial-pain') filePath = 'clinical/pathways/lumbar-axial.json';
        else if (pathwayId === 'shoulder-stiffness') filePath = 'clinical/pathways/shoulder-stiffness.json';
        else if (pathwayId === 'cervical-radicular') filePath = 'clinical/pathways/cervical-radicular.json';
        else if (pathwayId === 'hip-lateral') filePath = 'clinical/pathways/hip-lateral.json';
        else if (pathwayId === 'knee-oa-anterior') filePath = 'clinical/pathways/knee-oa-anterior.json';
        else filePath = `clinical/pathways/${pathwayId}.json`;
      }

      try {
        const res = await fetch(filePath + '?v=' + Date.now());
        if (!res.ok) throw new Error('Error al cargar pathway: ' + filePath);
        pathwayData = await res.json();
        uiState.pathwayDataCache[pathwayId] = pathwayData;
      } catch (err) {
        alert('Error al cargar el Clinical Pathway: ' + err.message);
        return;
      }
    }

    // Instantiate Engine
    const catalog = window.state ? window.state.catalog : null;
    uiState.engine = new window.ClinicalReasoningEngine(pathwayData, catalog, window.TREATMENTS_CATALOG, window.COACH_CATALOG);
    uiState.engine.setMentorMode(uiState.mentorMode);
    uiState.engine.setExpressMode(uiState.expressMode);

    // Save as recent
    saveRecentSession(pathwayId);

    // Render Master Layout
    renderPathwayWorkspace();
  }

  function renderPathwayWorkspace() {
    if (!containers.clinical || !uiState.engine) return;

    containers.clinical.innerHTML = `
      <!-- Sticky Clinical Header Bar -->
      <header class="clinical-top-bar" id="clinicalTopBar">
        <div class="clinical-bar-main">
          <div class="clinical-breadcrumb" id="clinicalBreadcrumb">
            <!-- Rendered dynamically -->
          </div>
          <div class="clinical-bar-actions">
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

        <!-- Progress Steps Track -->
        <div class="clinical-progress-track" id="clinicalProgressTrack">
          <!-- Rendered dynamically -->
        </div>
      </header>

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

    // Progress Steps
    trackEl.innerHTML = progressSteps.map(step => `
      <button class="progress-step-pill ${step.status}" onclick="window.ClinicalUI.goToStep('${step.id}')">
        <span>${step.icon}</span> <span>${step.label}</span>
      </button>
    `).join('');
  }

  function renderCurrentStep() {
    updateTopBar();
    const host = document.getElementById('clinicalStepHost');
    if (!host || !uiState.engine) return;

    const step = uiState.engine.getCurrentStep();
    uiState.currentStepView = step;

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

        <p style="font-size: 0.88rem; color: var(--text-secondary); margin-bottom: 1rem;">
          Marca si el paciente presenta alguna de las siguientes condiciones:
        </p>

        <div class="red-flags-checklist">
          ${flags.map(f => {
            const isChecked = !!currentResults[f.id];
            return `
              <label class="flag-checkbox-item ${isChecked ? 'checked' : ''}" id="flag_label_${f.id}">
                <input type="checkbox" class="flag-checkbox-input" data-flag-id="${f.id}" ${isChecked ? 'checked' : ''}>
                <div class="flag-item-content">
                  <span class="flag-item-title">${f.text}</span>
                  ${f.severity === 'critical' ? `<span class="flag-item-action">⚠️ Severidad Crítica: ${f.action}</span>` : ''}
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
          
          <button class="btn-primary" id="btnConfirmRedFlags" style="padding: 0.65rem 1.4rem;">
            <span>Continuar a Anamnesis Dirigida →</span>
          </button>
        </div>
      </div>
    `;

    // Listen for checkbox changes
    container.querySelectorAll('.flag-checkbox-input').forEach(input => {
      input.addEventListener('change', () => {
        const checkedMap = {};
        container.querySelectorAll('.flag-checkbox-input').forEach(inp => {
          const fid = inp.getAttribute('data-flag-id');
          checkedMap[fid] = inp.checked;
          const lbl = document.getElementById('flag_label_' + fid);
          if (lbl) lbl.classList.toggle('checked', inp.checked);
        });

        const res = uiState.engine.evaluateRedFlags(checkedMap);
        renderRedFlagsView(container);
      });
    });

    document.getElementById('btnConfirmRedFlags')?.addEventListener('click', () => {
      const checkedMap = {};
      container.querySelectorAll('.flag-checkbox-input').forEach(inp => {
        checkedMap[inp.getAttribute('data-flag-id')] = inp.checked;
      });
      const res = uiState.engine.evaluateRedFlags(checkedMap);

      if (!res.safe) {
        if (!confirm('⚠️ Se han detectado posibles señales de alarma. ¿Deseas continuar bajo tu criterio clínico?')) {
          return;
        }
      }
      uiState.engine.session.currentStep = 'anamnesis';
      renderCurrentStep();
    });
  }

  // ─────────────────────────────────────────────
  // 4. STEP 1 — ANAMNESIS & LIVE HYPOTHESES
  // ─────────────────────────────────────────────

  function renderAnamnesisView(container) {
    const q = uiState.engine.getCurrentQuestion();
    if (!q) {
      uiState.engine.session.currentStep = 'anamnesis_summary';
      return renderCurrentStep();
    }

    const allQuestions = uiState.expressMode
      ? uiState.engine.getEssentialQuestions()
      : uiState.engine.getQuestions();

    const qIndex = allQuestions.findIndex(item => item.id === q.id);
    const totalQ = allQuestions.length;
    const selectedAnswerIdx = uiState.engine.session.answers[q.id];

    container.innerHTML = `
      <div class="anamnesis-layout">
        <!-- Main Question Card -->
        <div class="question-card">
          <div class="question-header">
            <span class="question-num-pill">Pregunta ${qIndex + 1} de ${totalQ} ${q.essential ? '• ⚡ Clave' : ''}</span>
            <span style="font-size: 0.8rem; color: var(--text-muted); font-weight: 700;">Anamnesis Dirigida</span>
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
    renderCurrentStep();
  }

  function saveCustomGoal() {
    const input = document.getElementById('customGoalInput');
    if (input && uiState.engine) {
      uiState.engine.session.functionalGoal = input.value.trim();
      const currentQ = uiState.engine.getCurrentQuestion();
      if (currentQ) {
        uiState.engine.processAnswer(currentQ.id, 0);
      }
      renderCurrentStep();
    }
  }

  // ─────────────────────────────────────────────
  // 5. ANAMNESIS SUMMARY (BRIDGE)
  // ─────────────────────────────────────────────

  function renderAnamnesisSummaryView(container) {
    const summary = uiState.engine.getAnamnesisSummary();

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
        <div class="home-hero-badge">
          ${uiState.engine.pathway.ultrasound ? '🔊 Ecografía Musculoesquelética Dirigida' : '🏥 Correlación de Imagen por RM'}
        </div>

        <div class="imaging-question-banner">
          <h4>Pregunta Clínica a Responder</h4>
          <p>${protocol.clinicalQuestion || '¿Los hallazgos de imagen explican el cuadro clínico del paciente?'}</p>
        </div>

        <div class="structures-findings-list">
          ${structures.map(st => `
            <div class="structure-box">
              <div class="structure-box-title">
                <span>🎯 ${st.name} ${st.priority === 1 ? '<span class="pres-badge-status available" style="font-size: 0.65rem;">Prioridad 1</span>' : ''}</span>
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
                <strong style="font-size: 0.88rem; color: #818cf8;">⚡ Estratificación Clínica de la Radiculopatía (¿En qué fase estamos?)</strong>
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
            <div class="structure-box" style="margin-top: 0.75rem; background: rgba(15, 23, 42, 0.7);">
              <div style="font-size: 0.82rem; font-weight: 800; color: #fbbf24; margin-bottom: 0.4rem;">
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
              <div class="structure-box" style="border: 1px solid rgba(99, 102, 241, 0.4); background: rgba(99, 102, 241, 0.05); padding: 1rem; border-radius: var(--radius-md);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; flex-wrap: wrap; gap: 0.4rem;">
                  <h4 style="margin: 0; font-size: 0.98rem; font-weight: 800; color: #818cf8;">${plan.tiers[4].neuromodulation.title}</h4>
                  <span class="treatment-badge-pill blue" style="font-size: 0.7rem;">NeuPSIG 2025 / NICE</span>
                </div>

                <!-- Golden Principle Banner -->
                <div class="safety-header-banner safe" style="margin-bottom: 0.75rem; padding: 0.6rem 0.85rem;">
                  <span class="safety-banner-icon">💡</span>
                  <div class="safety-banner-text">
                    <strong style="font-size: 0.82rem; color: #e0e7ff;">Mensaje Clínico Fundamental:</strong>
                    <p style="font-size: 0.8rem; margin: 0.1rem 0 0; color: #c7d2fe;">«${plan.tiers[4].neuromodulation.principle}»</p>
                  </div>
                </div>

                <!-- Safety Pre-Checklist -->
                <div style="margin-bottom: 0.85rem;">
                  <div style="font-size: 0.72rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase; margin-bottom: 0.35rem;">
                    Comprobaciones Previas Obligatorias:
                  </div>
                  <div style="display: flex; flex-wrap: wrap; gap: 0.35rem;">
                    ${plan.tiers[4].neuromodulation.safetyChecklist.map(chk => `
                      <span style="font-size: 0.72rem; background: rgba(15, 23, 42, 0.7); border: 1px solid var(--border-color); color: var(--text-secondary); padding: 0.15rem 0.45rem; border-radius: var(--radius-sm);">
                        ✓ ${chk}
                      </span>
                    `).join('')}
                  </div>
                </div>

                <!-- Neuromodulators List -->
                <div style="display: flex; flex-direction: column; gap: 0.65rem;">
                  ${(plan.tiers[4].neuromodulation.drugs || []).map(drug => `
                    <div class="structure-box" style="background: rgba(15, 23, 42, 0.6); ${!drug.isRoutinelyRecommended ? 'border-color: rgba(239, 68, 68, 0.4);' : ''}">
                      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.3rem; flex-wrap: wrap; gap: 0.3rem;">
                        <strong style="font-size: 0.88rem; color: ${!drug.isRoutinelyRecommended ? '#ef4444' : '#818cf8'};">${drug.genericName}</strong>
                        <div style="display: flex; align-items: center; gap: 0.35rem;">
                          <button class="vade-link-btn-mini" onclick="window.Vademecum.openDrug('${drug.id?.startsWith('med-') ? drug.id : 'med-' + drug.id.replace(/_/g, '-')}', true)" title="Ver ficha en Vademécum">
                            💊 Vademécum
                          </button>
                          <span class="treatment-badge-pill ${drug.overrideBadge?.includes('🔴') ? 'red' : drug.overrideBadge?.includes('🟢') ? 'green' : 'yellow'}" style="font-size: 0.68rem;">
                            ${drug.overrideBadge || 'Indicado'}
                          </span>
                        </div>
                      </div>
                      <div class="pharma-spec-grid" style="grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));">
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
                        <div style="font-size: 0.76rem; color: #ef4444; background: rgba(239, 68, 68, 0.08); padding: 0.35rem 0.5rem; border-radius: var(--radius-sm); margin-top: 0.3rem;">
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
                ${plan.tiers[6].blockReason}
              </p>
            ` : `
              <div class="intervention-window-banner" style="margin-bottom: 0.75rem;">
                <span>🪟</span> <span><strong>${plan.tiers[6].philosophy}</strong></span>
              </div>
            `}

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
                <h4 style="margin: 0 0 0.35rem; font-size: 0.94rem; color: #818cf8;">🎯 Selección de Técnica Epidural Lumbar (Por Anatomía y Objetivo):</h4>
                <p style="font-size: 0.8rem; color: var(--text-secondary); margin: 0 0 0.65rem;">${plan.tiers[6].spinal.expectedBenefit}</p>
                
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 0.65rem; margin-bottom: 0.75rem;">
                  ${plan.tiers[6].spinal.approaches.map(ap => `
                    <div class="structure-box" style="background: rgba(15, 23, 42, 0.7);">
                      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem;">
                        <strong style="font-size: 0.85rem; color: var(--text-primary);">${ap.name}</strong>
                      </div>
                      <p style="font-size: 0.78rem; color: var(--text-secondary); margin: 0 0 0.25rem;"><strong>Indicación:</strong> ${ap.indication}</p>
                      <p style="font-size: 0.76rem; color: #818cf8; margin: 0 0 0.25rem;"><strong>Ventaja:</strong> ${ap.advantage || ap.concept}</p>
                      <span class="treatment-badge-pill ${ap.evidence?.badge?.includes('ALTA') ? 'green' : 'blue'}" style="font-size: 0.65rem;">${ap.evidence?.badge || 'Reconocida'}</span>
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
                        <span class="treatment-badge-pill orange" style="font-size: 0.65rem;">Opción Avanzada / Evidencia Limitada</span>
                      </div>
                      <p style="font-size: 0.76rem; color: var(--text-secondary); margin: 0.25rem 0 0;">${plan.tiers[6].spinal.drgPrf.indication} (Revisiones 2024-2025: posible alivio analgésico a 3 meses con baja certeza global).</p>
                    </div>
                  ` : ''}
                </div>
              </div>
            ` : plan.tiers[6].spinal?.facetRf ? `
              <div class="structure-box" style="margin-bottom: 0.65rem;">
                <h4 style="margin: 0 0 0.25rem; font-size: 0.9rem; color: var(--text-primary);">🔥 ${plan.tiers[6].spinal.facetRf.name}</h4>
                <p style="font-size: 0.8rem; color: var(--text-secondary); margin: 0.25rem 0;">${plan.tiers[6].spinal.indication}</p>
                <span class="treatment-badge-pill green" style="font-size: 0.68rem;">🟢 Evidencia Alta tras Bloqueo Positivo</span>
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
                <td><span class="treatment-badge-pill blue" style="font-size: 0.65rem;">Moderada / Brote</span></td>
                <td>Brote agudo con derrame a tensión que bloquea la fisioterapia.</td>
              </tr>
              <tr>
                <td><strong style="color: #60a5fa;">💧 Ácido Hialurónico</strong></td>
                <td>Viscosuplementación y alivio mecánico articular</td>
                <td>2 - 4 sem</td>
                <td>4 - 9 meses</td>
                <td><span class="treatment-badge-pill yellow" style="font-size: 0.65rem;">Pacientes selecc.</span></td>
                <td>Artrosis leve-moderada (KL II-III) sin derrame activo ni respuesta a AINEs.</td>
              </tr>
              <tr>
                <td><strong style="color: #f87171;">🩸 Plasma Rico en Plaquetas (LP-PRP)</strong></td>
                <td>Modulación del microambiente inflamatorio articular</td>
                <td>3 - 6 sem</td>
                <td>6 - 12 meses</td>
                <td><span class="treatment-badge-pill blue" style="font-size: 0.65rem;">Moderada KL I-III</span></td>
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
                document.getElementById('auxDecisionModal')?.remove();
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
                        document.getElementById('auxDecisionModal')?.remove();
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
    uiState.engine.proceedToSummary();
    renderCurrentStep();
  }

  // ─────────────────────────────────────────────
  // 13. STEP 10 — CLINICAL REPORT SUMMARY (EMR COPY)
  // ─────────────────────────────────────────────

  function renderClinicalSummaryView(container) {
    const summary = uiState.engine.generateClinicalSummary();

    container.innerHTML = `
      <div class="clinical-summary-box glass-panel">
        <div class="home-hero-badge" style="margin-bottom: 0.75rem;">
          📋 Informe de Consulta — Listo para Copiar a Historia Clínica
        </div>

        <p style="font-size: 0.84rem; color: var(--text-secondary); margin-bottom: 1rem;">
          Texto formateado y estructurado listo para volcar directamente al programa de historia clínica (Diraya / Gestor Hospitalario). Puedes editarlo antes de copiar.
        </p>

        <textarea class="clinical-summary-textarea" id="clinicalSummaryText">${summary.text}</textarea>

        <div class="summary-actions-bar">
          <button class="clinical-action-btn" onclick="window.ClinicalUI.goToStep('treatment')">
            <span>← Revisar Pasos</span>
          </button>

          <button class="btn-copy-summary" id="btnCopyReport">
            <span>📋</span> <span id="copyReportLabel">Copiar a Historia Clínica</span>
          </button>
        </div>
      </div>
    `;

    document.getElementById('btnCopyReport')?.addEventListener('click', () => {
      const textarea = document.getElementById('clinicalSummaryText');
      if (textarea) {
        navigator.clipboard.writeText(textarea.value).then(() => {
          const lbl = document.getElementById('copyReportLabel');
          if (lbl) {
            lbl.textContent = '¡Copiado al Portapapeles! ✅';
            setTimeout(() => { lbl.textContent = 'Copiar a Historia Clínica'; }, 2500);
          }
        }).catch(err => {
          textarea.select();
          document.execCommand('copy');
          alert('Informe copiado.');
        });
      }
    });
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
              ${d.currentlyExcluded ? '<span class="pres-badge-status available" style="font-size: 0.65rem;">Poco apoyado por clínica</span>' : ''}
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
    if (!casesCatalog) {
      try {
        const res = await fetch('clinical/cases/cases_catalog.json?v=' + Date.now());
        if (res.ok) {
          casesCatalog = await res.json();
          uiState.casesCatalog = casesCatalog;
        }
      } catch (err) {
        console.warn('Error loading cases catalog:', err);
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
      alert('Caso no encontrado');
      return;
    }

    // Launch pathway associated with case
    await startPathway(c.pathwayId);

    // Instantiate simulation engine
    if (window.SimulationEngine) {
      uiState.simulation = new window.SimulationEngine(c, window.state ? window.state.catalog : null);
    }

    // Pre-populate patient chief complaint in clinical view banner
    alert(`🎓 INICIANDO CASO: ${c.title}\n\nMotivo de consulta:\n«${c.patient.chiefComplaint}»\n\nProcederás a ciegas a través del algoritmo clínico.`);
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
            <span class="pres-badge-status ${m.completed ? 'available' : 'upcoming'}" style="font-size: 0.65rem;">
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

  // ─────────────────────────────────────────────
  // 14. SESSION PERSISTENCE & MODE SWITCHER
  // ─────────────────────────────────────────────

  function saveRecentSession(pathwayId) {
    try {
      localStorage.setItem('dolor_last_session', JSON.stringify({
        pathwayId,
        timestamp: new Date().toISOString()
      }));
    } catch (e) {
      console.warn('Error saving session:', e);
    }
  }

  function renderRecentPathwaysList() {
    const listEl = document.getElementById('recentsChipsList');
    if (!listEl) return;
    // Keep quick chips updated
  }

  function setRadicularPhase(phase) {
    uiState.radicularPhase = phase;
    renderCurrentStep();
  }

  function switchAppMode(mode) {
    const homeEl = document.getElementById('home-screen');
    const clinicalEl = document.getElementById('clinical-reasoning-container');
    const mainHeader = document.querySelector('.main-header');
    const navTabs = document.querySelector('.nav-tabs-wrapper');
    const filtersSection = document.querySelector('.filters-section');
    const mainContent = document.querySelector('.main-content');
    const mobileBottomBar = document.querySelector('.mobile-bottom-bar');

    // Reset all modes
    if (homeEl) homeEl.style.display = 'none';
    if (clinicalEl) clinicalEl.style.display = 'none';
    if (mainHeader) mainHeader.style.display = 'none';
    if (navTabs) navTabs.style.display = 'none';
    if (filtersSection) filtersSection.style.display = 'none';
    if (mainContent) mainContent.style.display = 'none';

    if (mode === 'home') {
      if (homeEl) {
        homeEl.style.display = 'block';
        renderHomeScreen();
      }
    } else if (mode === 'clinical') {
      if (clinicalEl) {
        clinicalEl.style.display = 'block';
        if (!uiState.engine) {
          renderRegionSelector();
        } else {
          renderCurrentStep();
        }
      }
    } else if (mode === 'library') {
      if (mainHeader) mainHeader.style.display = 'block';
      if (navTabs) navTabs.style.display = 'block';
      if (filtersSection) filtersSection.style.display = 'block';
      if (mainContent) mainContent.style.display = 'block';
      if (window.switchTab) window.switchTab('tab-tests');
    }

    // Sync mobile bottom bar items if present
    document.querySelectorAll('.mobile-nav-item').forEach(btn => {
      const tab = btn.getAttribute('data-tab');
      if (mode === 'home' && tab === 'tab-home') btn.classList.add('active');
      else if (mode === 'clinical' && tab === 'tab-clinical') btn.classList.add('active');
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
    renderHomeScreen: renderHomeScreen,
    renderRegionSelector: renderRegionSelector,
    selectRegion: renderPresentationSelector,
    startPathwayDirect: startPathway,
    goToStep: function (stepId) {
      if (uiState.engine) {
        uiState.engine.goToStep(stepId);
        renderCurrentStep();
      }
    },
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
    openCoachLibraryModal: openCoachLibraryModal
  };

})();
