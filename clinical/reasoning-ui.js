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
  function initClinicalUI() {
    containers.home = document.getElementById('home-screen');
    containers.clinical = document.getElementById('clinical-reasoning-container');
    containers.library = document.getElementById('library-container');

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
        <div class="home-hero-badge">🩺 Sistema de Apoyo al Razonamiento Clínico</div>
        <h1>Medicina del Dolor de Alta Precisión</h1>
        <p>Acompañamiento diagnóstico estructurado desde el motivo de consulta del paciente hasta el generador probable, ecografía dirigida y plan terapéutico.</p>
      </div>

      <div class="home-modes-grid">
        <!-- MODE 1: CLINICAL REASONING -->
        <article class="mode-card primary-mode" id="btnLaunchClinicalMode">
          <div>
            <span class="mode-card-icon">🩺</span>
            <h2>Razonamiento Clínico</h2>
            <p><strong>Modo Consulta interactivo:</strong> Diseñado para utilizar con el paciente delante. Anamnesis dirigida, exploración express, ecografía concordante y plan.</p>
            <div class="mode-card-features">
              <span class="mode-feature-pill">⚠️ Red Flags</span>
              <span class="mode-feature-pill">⚡ Express 90s</span>
              <span class="mode-feature-pill">🔊 Eco Dirigida</span>
              <span class="mode-feature-pill">📋 Copiar a HC</span>
            </div>
          </div>
          <div class="mode-card-cta">
            <span>Iniciar Consulta Clínica</span> <span>→</span>
          </div>
        </article>

        <!-- MODE 2: CLINICAL LIBRARY -->
        <article class="mode-card" id="btnLaunchLibraryMode">
          <div>
            <span class="mode-card-icon">📚</span>
            <h2>Biblioteca Clínica</h2>
            <p><strong>Atlas y Material de Consulta:</strong> Catálogo de 43 tests psicométricos, 86 vídeos HD (Physiotutors & Educom™), 14 fichas v2.3, clústeres y simulador.</p>
            <div class="mode-card-features">
              <span class="mode-feature-pill">🧍 Atlas SVG</span>
              <span class="mode-feature-pill">🎬 Videoteca HD</span>
              <span class="mode-feature-pill">📊 Clústeres</span>
              <span class="mode-feature-pill">📝 Simulador</span>
            </div>
          </div>
          <div class="mode-card-cta">
            <span>Explorar Biblioteca</span> <span>→</span>
          </div>
        </article>
      </div>

      <!-- Recent Consultations Bar -->
      <div class="home-recents-section glass-panel" id="homeRecentsBox">
        <div class="home-recents-title">
          <span>⚡</span> <span>Acceso Rápido a Clinical Pathways</span>
        </div>
        <div class="recents-chips-list" id="recentsChipsList">
          <button class="recent-pathway-chip" onclick="window.ClinicalUI.startPathwayDirect('shoulder-lateral-pain')">
            <span>🦴</span> <span>Hombro: Dolor Lateral</span>
          </button>
          <button class="recent-pathway-chip" onclick="window.ClinicalUI.startPathwayDirect('shoulder-stiffness')">
            <span>🧊</span> <span>Hombro: Rigidez</span>
          </button>
          <button class="recent-pathway-chip" onclick="window.ClinicalUI.startPathwayDirect('lumbar-radicular-pain')">
            <span>⚡</span> <span>Lumbar: Radiculopatía L4-S1</span>
          </button>
          <button class="recent-pathway-chip" onclick="window.ClinicalUI.startPathwayDirect('lumbar-axial-pain')">
            <span>🦴</span> <span>Lumbar: Axial (Facetas)</span>
          </button>
          <button class="recent-pathway-chip" onclick="window.ClinicalUI.startPathwayDirect('cervical-radicular')">
            <span>🧠</span> <span>Cervical: Radiculopatía C6/C7</span>
          </button>
          <button class="recent-pathway-chip" onclick="window.ClinicalUI.startPathwayDirect('hip-lateral')">
            <span>🦿</span> <span>Cadera: Lateral (GTPS)</span>
          </button>
          <button class="recent-pathway-chip" onclick="window.ClinicalUI.startPathwayDirect('knee-oa-anterior')">
            <span>🦵</span> <span>Rodilla: Anterior / Artrosis</span>
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

    document.getElementById('btnLaunchLibraryMode')?.addEventListener('click', () => {
      window.ClinicalUI.switchAppMode('library');
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
    uiState.engine = new window.ClinicalReasoningEngine(pathwayData, catalog);
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

    return ranked.map(h => {
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
  // 10. STEP 6 — TREATMENT ESCALATION FLOW (4 TIERS)
  // ─────────────────────────────────────────────

  function renderTreatmentView(container) {
    const plan = uiState.engine.getTreatmentPlan();
    if (!plan) return;

    container.innerHTML = `
      <div class="treatment-tiers-stack">
        <div class="home-hero-badge" style="align-self: flex-start;">
          💊 Escalones Terapéuticos Basados en el Problema
        </div>

        <!-- TIER 1: EDUCATION -->
        <div class="treatment-tier-card glass-panel">
          <div class="tier-header">
            <div class="tier-title-group">
              <span class="tier-num-badge">1</span>
              <h3 class="tier-title">Educación Terapéutica al Paciente</h3>
            </div>
            <span class="pres-badge-status available">Pilar Fundamental</span>
          </div>
          <div class="tier-body">
            <p style="font-size: 0.88rem; color: var(--text-primary); line-height: 1.5; margin-bottom: 0.5rem;">
              «${plan.education.patientText}»
            </p>
            ${uiState.mentorMode && plan.education.mentorNote ? `
              <div class="question-mentor-tip" style="margin: 0;">
                <span>🧠</span> <span>${plan.education.mentorNote}</span>
              </div>
            ` : ''}
          </div>
        </div>

        <!-- TIER 2: EXERCISE / MOVEMENT -->
        <div class="treatment-tier-card glass-panel">
          <div class="tier-header">
            <div class="tier-title-group">
              <span class="tier-num-badge">2</span>
              <h3 class="tier-title">Movimiento y Ejercicio Progresivo</h3>
            </div>
            <span class="pres-badge-status available">Recuperación Funcional</span>
          </div>
          <div class="tier-body">
            <p style="font-size: 0.86rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.75rem;">
              Objetivo: ${plan.exercise.objective}
            </p>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.6rem; margin-bottom: 0.75rem;">
              ${(plan.exercise.phases || []).map(ph => `
                <div class="generator-triad-box">
                  <div class="triad-label">${ph.name} (${ph.duration || ''})</div>
                  <div class="triad-val" style="font-size: 0.8rem; font-weight: 600;">${ph.description}</div>
                </div>
              `).join('')}
            </div>
            <p style="font-size: 0.78rem; color: var(--text-secondary); margin: 0;">
              💡 <strong>Regla de carga:</strong> ${plan.exercise.loadGuidance || 'Dolor tolerable ≤4/10 durante el ejercicio sin empeoramiento a las 24h.'}
            </p>
          </div>
        </div>

        <!-- TIER 3: PHARMACOLOGY -->
        <div class="treatment-tier-card glass-panel">
          <div class="tier-header">
            <div class="tier-title-group">
              <span class="tier-num-badge">3</span>
              <h3 class="tier-title">Farmacología & Analgesia</h3>
            </div>
            <button class="exam-tool-btn" onclick="window.switchTab('tab-fichas')">
              <span>🗂️</span> <span>Ver Ficha 11 Farmacología</span>
            </button>
          </div>
          <div class="tier-body">
            <div style="display: flex; flex-direction: column; gap: 0.65rem;">
              ${(plan.pharmacology.options || []).map(opt => `
                <div class="structure-box">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem;">
                    <strong style="font-size: 0.88rem; color: var(--text-primary);">${opt.name}</strong>
                    <span style="font-size: 0.72rem; color: var(--accent-blue); font-weight: 700;">${opt.duration || ''}</span>
                  </div>
                  <p style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 0.35rem;">${opt.example || opt.indication}</p>
                  <div class="treatment-guardrails-box">
                    <strong>🛡️ Guardarraíles de seguridad:</strong> ${(opt.guardrails || []).join(' • ')}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>

        <!-- TIER 4: INTERVENTIONISM (OPPORTUNITY WINDOW) -->
        <div class="treatment-tier-card glass-panel" style="${plan.interventionismBlocked ? 'opacity: 0.65;' : ''}">
          <div class="tier-header">
            <div class="tier-title-group">
              <span class="tier-num-badge">4</span>
              <h3 class="tier-title">Tratamiento Intervencionista</h3>
            </div>
            <span class="pres-badge-status ${plan.interventionismBlocked ? 'upcoming' : 'available'}">
              ${plan.interventionismBlocked ? '🔒 Requiere Concordancia' : '🎯 Indicado'}
            </span>
          </div>
          <div class="tier-body">
            ${plan.interventionismBlocked ? `
              <p style="font-size: 0.84rem; color: var(--color-alarm); font-weight: 700;">
                ⚠️ ${plan.blockReason || 'Intervencionismo bloqueado temporalmente hasta confirmar concordancia clínico-imagen.'}
              </p>
            ` : `
              <p style="font-size: 0.86rem; color: var(--text-primary); margin-bottom: 0.75rem;">
                <strong>Objetivo:</strong> ${plan.interventionism.objective}
              </p>
              ${(plan.interventionism.targets || []).map(tgt => `
                <div class="structure-box" style="margin-bottom: 0.65rem;">
                  <h4 style="margin: 0 0 0.25rem; font-size: 0.9rem; color: var(--text-primary);">Diana: ${tgt.name}</h4>
                  <p style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 0.4rem;">${tgt.indication}</p>
                  <div style="display: flex; flex-wrap: wrap; gap: 0.35rem; margin-bottom: 0.4rem;">
                    ${(tgt.options || []).map(o => `<span class="mode-feature-pill">${o.name} (Evidencia: ${o.evidence || 'Moderada'})</span>`).join('')}
                  </div>
                  <div class="treatment-guardrails-box" style="margin: 0.35rem 0;">
                    <strong>Contraindicaciones:</strong> ${(tgt.contraindications || []).join(' • ')}
                  </div>
                </div>
              `).join('')}
              <div class="intervention-window-banner">
                <span>🪟</span> <span><strong>Filosofía de Ventana de Oportunidad:</strong> Bajar Dolor → Iniciar Inmediatamente Rehabilitación (Movilidad → Fuerza → Carga → Función). La infiltración nunca es el punto final.</span>
              </div>
            `}
          </div>
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
          
          <button class="btn-primary" style="padding: 0.75rem 1.6rem;" onclick="window.ClinicalUI.proceedToSummary()">
            <span>Generar Resumen de Historia Clínica 📋 →</span>
          </button>
        </div>
      </div>
    `;
  }

  function proceedToSummary() {
    if (!uiState.engine) return;
    uiState.engine.proceedToSummary();
    renderCurrentStep();
  }

  // ─────────────────────────────────────────────
  // 12. STEP 8 — CLINICAL REPORT SUMMARY (EMR COPY)
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

  function openReconsiderModal() {
    if (!uiState.engine) return;
    const data = uiState.engine.reconsiderDiagnosis();

    showAuxModal(`
      <div class="aux-modal-header">
        <h3><span>🤔</span> <span>No me cuadra — Reevaluación Rápida</span></h3>
      </div>
      <div class="aux-items-list">
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
    openMissingInfoModal: openMissingInfoModal
  };

})();
