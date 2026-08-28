/**
 * ECOGRAFÍA EN DOLOR - GENERADOR ESTRUCTURADO DE INFORMES (POCUS)
 * Notion Oficial v2.6 & Clinical Pathways Integrados
 * 
 * Filosofía:
 * 1. ⚡ Consulta Ultrarrápida por defecto (Lateralidad → ¿Dónde duele? → Hallazgos combinables → Informe en tiempo real).
 * 2. 🩻 Informes combinados sin redundancias (ej: Gonartrosis + Derrame + Meniscopatía + Tendones conservados).
 * 3. ⚖️ Correlación Clínico-Ecográfica obligatoria: "No trates la eco, trata al paciente".
 * 4. 🩺 Integración de ida y vuelta con Clinical Pathways (Paso 4 Imagen).
 */

(function(window) {
  'use strict';

  const Ultrasound = {
    data: null,
    mode: 'quick', // 'quick' | 'region' | 'atlas'
    reportFormat: 'express', // 'express' | 'complete'
    searchQuery: '',
    favorites: [],
    recentReports: [],
    returnContext: null, // { fromClinical: true, pathwayId, presentation }

    state: {
      selectedRegion: 'hombro',
      laterality: 'derecho', // 'derecho' | 'izquierdo' | 'bilateral' | 'no_aplica'
      clinicalLocation: 'lateral',
      selectedFindings: {}, // { structureId: optionId }
      customModifiers: {}, // { structureId: { partialTearFace, partialTearMm, retractionMm, notes } }
      dopplerLevel: 'none',
      includeNormalPreserved: true,
      concordance: 'concordant',
      generatedReport: '',
      generatedConclusion: '',
      isCustomEdited: false
    },

    async init() {
      if (window.EMBEDDED_BUNDLE && window.EMBEDDED_BUNDLE.ultrasound) {
        this.data = window.EMBEDDED_BUNDLE.ultrasound;
        try {
          const favs = localStorage.getItem('pain_app_fav_echo_templates');
          if (favs) this.favorites = JSON.parse(favs);
          const recents = localStorage.getItem('pain_app_recent_echo_reports');
          if (recents) this.recentReports = JSON.parse(recents);
        } catch(e) {}
        this.attachGlobalEvents();
        this.setRegion('hombro', false);
        this.render();
        return;
      }

      try {
        const response = await fetch('data/ultrasound_catalog.json');
        if (!response.ok) throw new Error('No se pudo cargar ultrasound_catalog.json');
        this.data = await response.json();

        // Load favorites & recents from localStorage
        try {
          const favs = localStorage.getItem('pain_app_fav_echo_templates');
          if (favs) this.favorites = JSON.parse(favs);
          const recents = localStorage.getItem('pain_app_recent_echo_reports');
          if (recents) this.recentReports = JSON.parse(recents);
        } catch(e) {}

        this.attachGlobalEvents();
        this.setRegion('hombro', false);
        this.render();
      } catch(err) {
        if (window.EMBEDDED_BUNDLE && window.EMBEDDED_BUNDLE.ultrasound) {
          this.data = window.EMBEDDED_BUNDLE.ultrasound;
          this.attachGlobalEvents();
          this.setRegion('hombro', false);
          this.render();
          return;
        }
        console.error('Error inicializando generador de Ecografía:', err);
        const container = document.getElementById('ultrasound-content');
        if (container) {
          container.innerHTML = '<div class="glass-panel" style="padding: 2rem; text-align: center; color: var(--text-secondary);">⚠️ Error al cargar el catálogo de Ecografía. Por favor, recargue la página.</div>';
        }
      }
    },

    attachGlobalEvents() {
      const searchInput = document.getElementById('ultrasound-search-input');
      if (searchInput) {
        searchInput.addEventListener('input', (e) => {
          this.searchQuery = e.target.value.trim().toLowerCase();
          this.render();
        });
      }
    },

    getRegionById(regionId) {
      if (!this.data || !this.data.regions) return null;
      return this.data.regions.find(r => r.id === regionId) || null;
    },

    setMode(newMode) {
      this.mode = newMode;
      const btnQuick = document.getElementById('echo-tab-btn-quick');
      const btnRegion = document.getElementById('echo-tab-btn-region');
      const btnAtlas = document.getElementById('echo-tab-btn-atlas');

      if (btnQuick) btnQuick.classList.toggle('active', newMode === 'quick');
      if (btnRegion) btnRegion.classList.toggle('active', newMode === 'region');
      if (btnAtlas) btnAtlas.classList.toggle('active', newMode === 'atlas');

      this.render();
    },

    setReportFormat(fmt) {
      this.reportFormat = fmt;
      this.state.isCustomEdited = false;
      this.updateGeneratedReport();
      this.renderReportPreview();
    },

    setRegion(regionId, shouldRender = true) {
      this.state.selectedRegion = regionId;
      const region = this.getRegionById(regionId);
      if (region && region.locations && region.locations.length > 0) {
        this.state.clinicalLocation = region.locations[0].id;
      } else {
        this.state.clinicalLocation = '';
      }
      this.state.selectedFindings = {};
      this.state.customModifiers = {};
      this.state.dopplerLevel = 'none';
      this.state.isCustomEdited = false;
      this.state.concordance = 'concordant';

      this.updateGeneratedReport();
      if (shouldRender) this.render();
    },

    setLaterality(lat) {
      this.state.laterality = lat;
      this.state.isCustomEdited = false;
      this.updateGeneratedReport();
      this.render();
    },

    setLocation(locId) {
      this.state.clinicalLocation = locId;
      this.state.isCustomEdited = false;
      this.updateGeneratedReport();
      this.render();
    },

    setFinding(structureId, optionId) {
      if (optionId === 'none' || optionId === '') {
        delete this.state.selectedFindings[structureId];
      } else {
        this.state.selectedFindings[structureId] = optionId;
      }
      this.state.isCustomEdited = false;
      this.updateGeneratedReport();
      this.render();
    },

    setDoppler(level) {
      this.state.dopplerLevel = level;
      this.state.isCustomEdited = false;
      this.updateGeneratedReport();
      this.render();
    },

    setConcordance(concId) {
      this.state.concordance = concId;
      this.state.isCustomEdited = false;
      this.updateGeneratedReport();
      this.render();
    },

    toggleIncludeNormal() {
      this.state.includeNormalPreserved = !this.state.includeNormalPreserved;
      this.state.isCustomEdited = false;
      this.updateGeneratedReport();
      this.render();
    },

    setAllNormal() {
      const region = this.getRegionById(this.state.selectedRegion);
      if (!region) return;

      this.state.selectedFindings = {};
      (region.structures || []).forEach(st => {
        this.state.selectedFindings[st.id] = 'normal';
      });
      this.state.dopplerLevel = 'negative';
      this.state.concordance = 'concordant';
      this.state.isCustomEdited = false;
      this.updateGeneratedReport();
      this.render();
      this.showToast('🟢 Exploración marcada como normal');
    },

    clearFindings() {
      this.state.selectedFindings = {};
      this.state.customModifiers = {};
      this.state.dopplerLevel = 'none';
      this.state.concordance = 'concordant';
      this.state.isCustomEdited = false;
      this.updateGeneratedReport();
      this.render();
    },

    openFromClinicalPathway(params = {}) {
      if (typeof window.switchTab === 'function') {
        window.switchTab('tab-ultrasound');
      }

      this.returnContext = {
        fromClinical: true,
        pathwayId: params.pathwayId || null,
        region: params.region || 'hombro',
        laterality: params.laterality || 'derecho',
        clinicalLocation: params.location || 'lateral'
      };

      if (params.region) {
        this.setRegion(params.region, false);
      }
      if (params.laterality) {
        this.state.laterality = params.laterality;
      }
      if (params.location) {
        this.state.clinicalLocation = params.location;
      }

      this.mode = 'quick';
      this.render();
    },

    returnToClinicalPathway() {
      if (typeof window.ClinicalUI !== 'undefined' && typeof window.ClinicalUI.switchAppMode === 'function') {
        window.ClinicalUI.switchAppMode('clinical');
        if (typeof window.ClinicalUI.injectUltrasoundReport === 'function') {
          window.ClinicalUI.injectUltrasoundReport({
            region: this.state.selectedRegion,
            laterality: this.state.laterality,
            report: this.state.generatedReport,
            conclusion: this.state.generatedConclusion,
            concordance: this.state.concordance
          });
        }
      } else if (typeof window.switchTab === 'function') {
        window.switchTab('tab-clinical');
      }
    },

    getLateralityAbbr() {
      const l = this.state.laterality;
      if (l === 'derecho') return 'D';
      if (l === 'izquierdo') return 'I';
      if (l === 'bilateral') return 'Bilat.';
      return '';
    },

    getLateralityFull() {
      const l = this.state.laterality;
      if (l === 'derecho') return 'derecho';
      if (l === 'izquierdo') return 'izquierdo';
      if (l === 'bilateral') return 'bilateral';
      return 'no aplicable';
    },

    updateGeneratedReport() {
      const region = this.getRegionById(this.state.selectedRegion);
      if (!region) return;

      const latAbbr = this.getLateralityAbbr();
      const latFull = this.getLateralityFull();
      const regionName = region.name.toLowerCase();

      // Gather active findings
      const findingsList = [];
      const conclusionsList = [];
      const normalPreservedList = [];

      const selectedKeys = Object.keys(this.state.selectedFindings);
      const isAllNormal = selectedKeys.length > 0 && selectedKeys.every(k => this.state.selectedFindings[k] === 'normal');

      if (isAllNormal) {
        const text = region.normalBaseline || 'Sin hallazgos patológicos significativos en las estructuras exploradas.';
        findingsList.push(text);
        conclusionsList.push(`Exploración ecográfica de ${regionName} ${latFull} dentro de la normalidad`);
      } else {
        (region.structures || []).forEach(st => {
          const optId = this.state.selectedFindings[st.id];
          if (!optId) return;

          const opt = (st.options || []).find(o => o.id === optId);
          if (!opt) return;

          if (optId === 'normal') {
            normalPreservedList.push(st.name.replace('Tendón del ', 'tendón ').replace('Tendón ', 'tendón ').toLowerCase());
          } else {
            findingsList.push(opt.text);
            conclusionsList.push(opt.label.replace(/\(.*?\)/g, '').trim());
          }
        });

        // If Doppler is active
        if (this.state.dopplerLevel && this.state.dopplerLevel !== 'none') {
          const dopObj = (this.data.dopplerLevels || []).find(d => d.id === this.state.dopplerLevel);
          if (dopObj && dopObj.text) {
            findingsList.push(dopObj.text);
          }
        }

        // Add preserved normal structures sentence
        if (this.state.includeNormalPreserved && normalPreservedList.length > 0 && findingsList.length > 0) {
          const joinedNormals = normalPreservedList.join(', ');
          findingsList.push(`Estructuras conservadas sin roturas ni alteraciones ecográficas relevantes: ${joinedNormals}.`);
        }
      }

      const rawFindingsText = findingsList.join(' ');
      const rawConclusionText = conclusionsList.length > 0 ? conclusionsList.join(', ') + '.' : 'Sin alteraciones ecográficas concluyentes.';

      // Concordance Text
      const concObj = (this.data.concordanceOptions || []).find(c => c.id === this.state.concordance);
      const concText = concObj ? concObj.text : '';

      // Build Format
      if (this.reportFormat === 'express') {
        this.state.generatedReport = `ECO ${region.name.toUpperCase()} ${latAbbr}: ${rawFindingsText}

Conclusión: ${rawConclusionText}`;
      } else {
        const locObj = (region.locations || []).find(l => l.id === this.state.clinicalLocation);
        const locText = locObj ? locObj.name : 'Exploración regional';

        this.state.generatedReport = 
`INFORME DE ECOGRAFÍA MÚSCULO-ESQUELÉTICA (POCUS)

Indicación: Dolor en región de ${regionName} (${locText}).
Lateralidad: ${region.name} ${latFull}.
Técnica: Ecografía musculoesquelética dirigida de alta frecuencia con cortes sistemáticos longitudinales y transversales, complementados con maniobras dinámicas y estudio Doppler color cuando procede.

HALLAZGOS:
${rawFindingsText || 'Exploración en curso.'}

CONCLUSIÓN:
${rawConclusionText}

CORRELACIÓN CLÍNICO-ECOGRÁFICA:
${concText}`;
      }

      this.state.generatedConclusion = rawConclusionText;
    },

    render() {
      const container = document.getElementById('ultrasound-content');
      if (!container || !this.data) return;

      if (this.searchQuery) {
        this.renderSearchResults(container);
        return;
      }

      if (this.mode === 'quick') {
        this.renderQuickView(container);
      } else if (this.mode === 'region') {
        this.renderRegionView(container);
      } else if (this.mode === 'atlas') {
        this.renderAtlasView(container);
      }
    },

    renderQuickView(container) {
      const region = this.getRegionById(this.state.selectedRegion);
      if (!region) return;

      const activeLoc = (region.locations || []).find(l => l.id === this.state.clinicalLocation) || (region.locations ? region.locations[0] : null);
      const priorityKeys = activeLoc ? activeLoc.priorityStructures : [];

      container.innerHTML = `
        <!-- HEADER PRINCIPAL -->
        <div class="echo-header-hero">
          <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.75rem;">
            <div>
              <h2 style="font-size: 1.25rem; font-weight: 900; color: var(--accent-blue); margin: 0; display: flex; align-items: center; gap: 0.5rem;">
                <span>🩻</span> ECOGRAFÍA EN DOLOR (POCUS)
              </h2>
              <p style="font-size: 0.82rem; color: var(--text-secondary); margin: 0.2rem 0 0;">
                Exploración dirigida · Hallazgos combinados · Correlación clínica · Informe a Historia
              </p>
            </div>
            ${this.returnContext ? `
              <button class="vade-primary-btn" onclick="window.Ultrasound.returnToClinicalPathway()" style="font-size: 0.82rem; padding: 0.45rem 0.95rem;">
                🩺 Volver a la Consulta
              </button>
            ` : ''}
          </div>
        </div>

        <!-- SELECTOR DE REGIONES ANATÓMICAS -->
        <div class="echo-regions-scroll-grid">
          ${(this.data.regions || []).map(r => `
            <button class="echo-region-card-btn ${r.id === this.state.selectedRegion ? 'active' : ''}" onclick="window.Ultrasound.setRegion('${r.id}')">
              <span class="echo-reg-icon">${r.icon}</span>
              <span class="echo-reg-name">${r.name}</span>
            </button>
          `).join('')}
        </div>

        <!-- GENERADOR PRINCIPAL EN 2 COLUMNAS (MÓVIL STACK) -->
        <div class="echo-generator-layout">
          
          <!-- COLUMNA IZQUIERDA: CONFIGURACIÓN Y HALLAZGOS -->
          <div class="echo-inputs-column">

            <!-- PASO 1: LATERALIDAD -->
            <div class="echo-panel-card">
              <div class="echo-step-title">
                <span class="echo-step-badge">1</span>
                <span>Lateralidad</span>
              </div>
              <div class="echo-chips-group">
                <button class="echo-chip-btn ${this.state.laterality === 'derecho' ? 'active' : ''}" onclick="window.Ultrasound.setLaterality('derecho')">👉 Derecha (D)</button>
                <button class="echo-chip-btn ${this.state.laterality === 'izquierdo' ? 'active' : ''}" onclick="window.Ultrasound.setLaterality('izquierdo')">👈 Izquierda (I)</button>
                <button class="echo-chip-btn ${this.state.laterality === 'bilateral' ? 'active' : ''}" onclick="window.Ultrasound.setLaterality('bilateral')">👐 Bilateral</button>
                <button class="echo-chip-btn ${this.state.laterality === 'no_aplica' ? 'active' : ''}" onclick="window.Ultrasound.setLaterality('no_aplica')">⚖️ No aplica</button>
              </div>
            </div>

            <!-- PASO 2: ¿DÓNDE DUELE? (LOCALIZACIÓN CLÍNICA) -->
            ${region.locations && region.locations.length ? `
              <div class="echo-panel-card">
                <div class="echo-step-title">
                  <span class="echo-step-badge">2</span>
                  <span>¿Dónde duele? (Foco de Exploración)</span>
                </div>
                <div class="echo-chips-group">
                  ${region.locations.map(loc => `
                    <button class="echo-chip-btn ${this.state.clinicalLocation === loc.id ? 'active' : ''}" onclick="window.Ultrasound.setLocation('${loc.id}')">
                      ${loc.name}
                    </button>
                  `).join('')}
                </div>
              </div>
            ` : ''}

            <!-- PASO 3: PREGUNTA CLÍNICA CLAVE -->
            <div class="echo-clinical-question-box">
              <div style="display: flex; align-items: flex-start; gap: 0.65rem;">
                <span style="font-size: 1.4rem;">🔍</span>
                <div>
                  <strong style="font-size: 0.86rem; color: #1e40af;">¿Qué quiero responder con la Eco?</strong>
                  <p style="font-size: 0.82rem; color: #1e3a8a; margin: 0.2rem 0 0; line-height: 1.45; font-weight: 600;">
                    «${region.clinicalQuestion}»
                  </p>
                </div>
              </div>
            </div>

            <!-- PASO 4: SELECTOR DE HALLAZGOS ESTRUCTURADOS -->
            <div class="echo-panel-card">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.85rem; flex-wrap: wrap; gap: 0.4rem;">
                <div class="echo-step-title" style="margin: 0;">
                  <span class="echo-step-badge">4</span>
                  <span>Estructuras y Hallazgos</span>
                </div>
                <div style="display: flex; gap: 0.4rem;">
                  <button class="echo-action-pill-btn green" onclick="window.Ultrasound.setAllNormal()" title="Marcar todo normal">
                    🟢 Todo Normal
                  </button>
                  <button class="echo-action-pill-btn" onclick="window.Ultrasound.clearFindings()" title="Limpiar selección">
                    🔄 Limpiar
                  </button>
                </div>
              </div>

              <!-- Lista de Estructuras -->
              <div class="echo-structures-list">
                ${(region.structures || []).map(st => {
                  const isPriority = priorityKeys.includes(st.id);
                  const activeOpt = this.state.selectedFindings[st.id] || '';
                  const isAbnormal = activeOpt && activeOpt !== 'normal';

                  return `
                    <div class="echo-structure-row ${isAbnormal ? 'has-finding' : activeOpt === 'normal' ? 'is-normal' : ''}">
                      <div class="echo-structure-name-col">
                        <div style="display: flex; align-items: center; gap: 0.4rem;">
                          ${isPriority ? '<span class="echo-priority-dot" title="Estructura prioritaria por localización">⭐</span>' : ''}
                          <strong>${st.name}</strong>
                        </div>
                        <span class="echo-category-tag">${st.category}</span>
                      </div>
                      <div class="echo-structure-select-col">
                        <select class="echo-finding-select" onchange="window.Ultrasound.setFinding('${st.id}', this.value)">
                          <option value="">-- No explorado / Sin cambios --</option>
                          ${(st.options || []).map(opt => `
                            <option value="${opt.id}" ${activeOpt === opt.id ? 'selected' : ''}>
                              ${opt.id === 'normal' ? '🟢 ' : '🔴 '}${opt.label}
                            </option>
                          `).join('')}
                        </select>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>

              <!-- Doppler y Estructuras Conservadas -->
              <div style="margin-top: 1.15rem; padding-top: 1rem; border-top: 1px solid var(--border-color); display: flex; flex-direction: column; gap: 0.75rem;">
                <div>
                  <strong style="font-size: 0.82rem; color: var(--text-primary);">⚡ Actividad Power Doppler:</strong>
                  <div class="echo-chips-group" style="margin-top: 0.35rem;">
                    ${(this.data.dopplerLevels || []).map(d => `
                      <button class="echo-chip-btn ${this.state.dopplerLevel === d.id ? 'active' : ''}" onclick="window.Ultrasound.setDoppler('${d.id}')">
                        ${d.label}
                      </button>
                    `).join('')}
                  </div>
                </div>

                <div style="display: flex; align-items: center; gap: 0.5rem; margin-top: 0.25rem;">
                  <input type="checkbox" id="echo-include-normals" ${this.state.includeNormalPreserved ? 'checked' : ''} onchange="window.Ultrasound.toggleIncludeNormal()" style="width: 1.1rem; height: 1.1rem; cursor: pointer;">
                  <label for="echo-include-normals" style="font-size: 0.82rem; font-weight: 600; color: var(--text-primary); cursor: pointer;">
                    Añadir resumen de estructuras conservadas al informe
                  </label>
                </div>
              </div>
            </div>

            <!-- PASO 5: CORRELACIÓN CLÍNICO-ECOGRÁFICA -->
            <div class="echo-panel-card">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.65rem;">
                <div class="echo-step-title" style="margin: 0;">
                  <span class="echo-step-badge">5</span>
                  <span>Correlación Clínico-Ecográfica (Mandatorio)</span>
                </div>
                <button class="echo-not-fitting-btn" onclick="window.Ultrasound.openNotFittingModal()">
                  🤔 ¿No me cuadra?
                </button>
              </div>

              <div class="echo-concordance-grid">
                ${(this.data.concordanceOptions || []).map(c => `
                  <div class="echo-concordance-card ${this.state.concordance === c.id ? 'active' : ''}" onclick="window.Ultrasound.setConcordance('${c.id}')">
                    <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.2rem;">
                      <span style="font-size: 1.2rem;">${c.icon}</span>
                      <strong style="font-size: 0.86rem;">${c.label}</strong>
                    </div>
                    <p style="font-size: 0.76rem; color: var(--text-secondary); margin: 0; line-height: 1.35;">${c.implication}</p>
                  </div>
                `).join('')}
              </div>

              <!-- Golden Rule Banner -->
              <div class="echo-golden-rule-box" style="margin-top: 0.85rem;">
                💡 <strong>Regla de Oro:</strong> «No trates la ecografía; trata al paciente. Un hallazgo estructural no es automáticamente el generador del dolor.»
              </div>
            </div>

            <!-- LÍMITES DE LA ECOGRAFÍA EN ESTA REGIÓN -->
            ${region.limitations && region.limitations.length ? `
              <div class="echo-limitations-card">
                <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.4rem;">
                  <span style="font-size: 1.2rem;">⚠️</span>
                  <strong style="font-size: 0.84rem; color: #b45309;">Límites de la Ecografía en ${region.name}</strong>
                </div>
                <ul style="margin: 0 0 0 1.2rem; padding: 0; font-size: 0.78rem; color: #78350f; line-height: 1.45;">
                  ${region.limitations.map(lim => `<li style="margin-bottom: 0.2rem;">${lim}</li>`).join('')}
                </ul>
              </div>
            ` : ''}

          </div>

          <!-- COLUMNA DERECHA: GENERADOR Y PREVISUALIZACIÓN EN TIEMPO REAL -->
          <div class="echo-report-column">
            <div class="echo-report-sticky-card">
              
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; flex-wrap: wrap; gap: 0.4rem;">
                <h3 style="font-size: 1rem; font-weight: 800; color: var(--text-primary); margin: 0; display: flex; align-items: center; gap: 0.4rem;">
                  <span>📋</span> Informe Generado
                </h3>
                <div class="echo-format-toggle-bar">
                  <button class="echo-format-btn ${this.reportFormat === 'express' ? 'active' : ''}" onclick="window.Ultrasound.setReportFormat('express')">
                    ⚡ Express
                  </button>
                  <button class="echo-format-btn ${this.reportFormat === 'complete' ? 'active' : ''}" onclick="window.Ultrasound.setReportFormat('complete')">
                    📖 Completo
                  </button>
                </div>
              </div>

              <!-- Textarea editable en tiempo real -->
              <textarea id="echoReportTextarea" class="echo-report-textarea" oninput="window.Ultrasound.handleReportEdit(this.value)">${this.state.generatedReport}</textarea>

              <!-- Conclusión Highlight Box -->
              <div class="echo-conclusion-highlight-box">
                <div style="font-size: 0.74rem; font-weight: 800; text-transform: uppercase; color: var(--accent-blue); margin-bottom: 0.2rem;">
                  Conclusión Diagnóstica:
                </div>
                <div style="font-size: 0.86rem; font-weight: 700; color: var(--text-primary);">
                  ${this.state.generatedConclusion}
                </div>
              </div>

              <!-- Botones de Acción y Copiado -->
              <div class="echo-report-actions-grid">
                <button class="echo-copy-action-btn primary" onclick="window.Ultrasound.copyFullReport(event)">
                  📋 Copiar Informe
                </button>
                <button class="echo-copy-action-btn" onclick="window.Ultrasound.copyConclusionOnly(event)">
                  📋 Solo Conclusión
                </button>
                <button class="echo-copy-action-btn" onclick="window.Ultrasound.saveCurrentTemplate(event)">
                  ⭐ Guardar Plantilla
                </button>
                ${this.returnContext ? `
                  <button class="echo-copy-action-btn green" onclick="window.Ultrasound.returnToClinicalPathway()">
                    🩺 Volver a Consulta
                  </button>
                ` : ''}
              </div>

            </div>
          </div>

        </div>
      `;
    },

    renderReportPreview() {
      const textarea = document.getElementById('echoReportTextarea');
      if (textarea) {
        textarea.value = this.state.generatedReport;
      }
    },

    handleReportEdit(newText) {
      this.state.generatedReport = newText;
      this.state.isCustomEdited = true;
    },

    copyFullReport(event) {
      if (event) event.stopPropagation();
      const text = this.state.generatedReport;
      this.copyTextToClipboard(text, 'Informe Ecográfico');
      this.saveRecentReport();
    },

    copyConclusionOnly(event) {
      if (event) event.stopPropagation();
      const text = this.state.generatedConclusion;
      this.copyTextToClipboard(text, 'Conclusión Ecográfica');
    },

    copyTextToClipboard(text, label = 'Informe') {
      navigator.clipboard.writeText(text).then(() => {
        this.showToast(`📋 ${label} copiado`);
      }).catch(() => {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        this.showToast(`📋 ${label} copiado`);
      });
    },

    saveCurrentTemplate(event) {
      if (event) event.stopPropagation();
      const region = this.getRegionById(this.state.selectedRegion);
      const name = prompt('Nombre de la plantilla favorita:', `${region.name} - ${this.state.generatedConclusion}`);
      if (!name) return;

      const tpl = {
        id: 'fav-echo-' + Date.now(),
        name: name.trim(),
        region: this.state.selectedRegion,
        laterality: this.state.laterality,
        location: this.state.clinicalLocation,
        findings: { ...this.state.selectedFindings },
        doppler: this.state.dopplerLevel,
        concordance: this.state.concordance
      };

      this.favorites.push(tpl);
      try {
        localStorage.setItem('pain_app_fav_echo_templates', JSON.stringify(this.favorites));
      } catch(e) {}
      this.showToast(`⭐ Plantilla "${tpl.name}" guardada`);
    },

    saveRecentReport() {
      const region = this.getRegionById(this.state.selectedRegion);
      const item = {
        id: 'rec-' + Date.now(),
        region: region.name,
        date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        conclusion: this.state.generatedConclusion,
        report: this.state.generatedReport
      };

      this.recentReports.unshift(item);
      if (this.recentReports.length > 8) this.recentReports.pop();
      try {
        localStorage.setItem('pain_app_recent_echo_reports', JSON.stringify(this.recentReports));
      } catch(e) {}
    },

    openNotFittingModal() {
      let modal = document.getElementById('echo-not-fitting-modal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'echo-not-fitting-modal';
        modal.className = 'modal-overlay';
        modal.innerHTML = `
          <div class="glass-modal echo-not-fitting-card" style="max-width: 600px; padding: 1.5rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
              <h3 style="margin: 0; font-size: 1.1rem; color: #f59e0b; display: flex; align-items: center; gap: 0.5rem;">
                <span>🤔</span> ¿QUÉ HACER SI LA ECO NO CUADRA CON LA CLÍNICA?
              </h3>
              <button class="modal-close" onclick="document.getElementById('echo-not-fitting-modal').style.display='none'; document.body.style.overflow='';">✖</button>
            </div>
            
            <div style="display: flex; flex-direction: column; gap: 0.85rem; font-size: 0.84rem; line-height: 1.5; color: var(--text-primary);">
              <div class="echo-modal-scenario-box">
                <strong style="color: #ef4444;">1. Exploración positiva + Ecografía estrictamente NORMAL:</strong>
                <p style="margin: 0.2rem 0 0; color: var(--text-secondary);">
                  • ¿Estructura profunda no accesible? (Labrum, TFCC central, edema óseo/fractura de estrés, disco vertebral, raíz lumbar).<br>
                  • ¿Dolor referido o neural? (Radiculopatía S1 simulando fascitis; cervical simulando hombro; coxartrosis simulando trocanteritis).<br>
                  • ¿Dolor nociplástico / sensibilización central?
                </p>
              </div>

              <div class="echo-modal-scenario-box">
                <strong style="color: #f59e0b;">2. Ecografía muy alterada + Exploración física NEGATIVA:</strong>
                <p style="margin: 0.2rem 0 0; color: var(--text-secondary);">
                  • Hallazgo incidental degenerativo normal para la edad (roturas parciales asintomáticas de manguito en >60 años, espolones, meniscopatías degenerativas).<br>
                  • <strong>Principio de prudencia:</strong> Evitar infiltraciones o cirugía dirigidas exclusivamente por la imagen.
                </p>
              </div>
            </div>

            <button class="vade-primary-btn" style="width: 100%; margin-top: 1.25rem;" onclick="document.getElementById('echo-not-fitting-modal').style.display='none'; document.body.style.overflow='';">
              Entendido
            </button>
          </div>
        `;
        document.body.appendChild(modal);
      }
      modal.style.display = 'flex';
      document.body.style.overflow = 'hidden';
    },

    renderRegionView(container) {
      container.innerHTML = `
        <div class="echo-header-hero" style="margin-bottom: 1.5rem;">
          <h2 style="font-size: 1.2rem; font-weight: 900; color: var(--accent-blue); margin: 0;">
            🩻 INFORME ESTRUCTURADO POR REGIÓN
          </h2>
          <p style="font-size: 0.82rem; color: var(--text-secondary); margin: 0.2rem 0 0;">
            Selecciona la región para acceder al generador ampliado.
          </p>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem;">
          ${(this.data.regions || []).map(r => `
            <div class="echo-region-overview-card" onclick="window.Ultrasound.setRegion('${r.id}'); window.Ultrasound.setMode('quick');">
              <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem;">
                <span style="font-size: 2rem;">${r.icon}</span>
                <div>
                  <h3 style="font-size: 1rem; font-weight: 800; color: var(--text-primary); margin: 0;">${r.name}</h3>
                  <span style="font-size: 0.74rem; color: var(--accent-blue); font-weight: 700;">${r.structures ? r.structures.length : 0} estructuras clave</span>
                </div>
              </div>
              <p style="font-size: 0.8rem; color: var(--text-secondary); margin: 0.4rem 0 0; line-height: 1.4;">
                ${r.clinicalQuestion}
              </p>
            </div>
          `).join('')}
        </div>
      `;
    },

    renderAtlasView(container) {
      container.innerHTML = `
        <div class="echo-header-hero" style="margin-bottom: 1.5rem;">
          <h2 style="font-size: 1.2rem; font-weight: 900; color: var(--accent-blue); margin: 0;">
            📚 ATLAS ECOGRÁFICO EN DOLOR & SONOANATOMÍA
          </h2>
          <p style="font-size: 0.82rem; color: var(--text-secondary); margin: 0.2rem 0 0;">
            Criterios de imagen, semiología diagnóstica y límites anatómicos por ultrasonidos.
          </p>
        </div>

        <div style="display: flex; flex-direction: column; gap: 1rem;">
          ${(this.data.regions || []).map(r => `
            <div class="echo-atlas-region-card">
              <div class="echo-atlas-header">
                <div style="display: flex; align-items: center; gap: 0.6rem;">
                  <span style="font-size: 1.5rem;">${r.icon}</span>
                  <h3 style="margin: 0; font-size: 1rem; font-weight: 800; color: var(--text-primary);">${r.name}</h3>
                </div>
                <button class="echo-action-pill-btn blue" onclick="window.Ultrasound.setRegion('${r.id}'); window.Ultrasound.setMode('quick');">
                  🩻 Abrir en Generador
                </button>
              </div>

              <div style="margin-top: 0.75rem; font-size: 0.82rem;">
                <strong style="color: var(--accent-blue);">🟢 Patrón Normal de Referencia:</strong>
                <p style="margin: 0.25rem 0 0.75rem; color: var(--text-secondary); line-height: 1.45;">
                  ${r.normalBaseline}
                </p>

                <strong style="color: #b45309;">⚠️ Límites Diagnósticos en ${r.name}:</strong>
                <ul style="margin: 0.25rem 0 0 1.2rem; padding: 0; color: var(--text-secondary); line-height: 1.45;">
                  ${(r.limitations || []).map(l => `<li>${l}</li>`).join('')}
                </ul>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    },

    renderSearchResults(container) {
      const q = this.searchQuery;
      const matchingRegions = (this.data.regions || []).filter(r => 
        r.name.toLowerCase().includes(q) ||
        r.clinicalQuestion.toLowerCase().includes(q) ||
        (r.structures || []).some(s => s.name.toLowerCase().includes(q) || (s.options || []).some(o => o.label.toLowerCase().includes(q)))
      );

      container.innerHTML = `
        <div style="margin-bottom: 1.5rem;">
          <span style="font-size: 0.86rem; color: var(--text-secondary);">
            Resultados de ecografía para "<strong>${q}</strong>": ${matchingRegions.length} regiones encontradas.
          </span>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem;">
          ${matchingRegions.map(r => `
            <div class="echo-region-overview-card" onclick="window.Ultrasound.setRegion('${r.id}'); window.Ultrasound.setMode('quick');">
              <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem;">
                <span style="font-size: 2rem;">${r.icon}</span>
                <div>
                  <h3 style="font-size: 1rem; font-weight: 800; color: var(--text-primary); margin: 0;">${r.name}</h3>
                  <span style="font-size: 0.74rem; color: var(--accent-blue); font-weight: 700;">Coincidencia de búsqueda</span>
                </div>
              </div>
              <p style="font-size: 0.8rem; color: var(--text-secondary); margin: 0.4rem 0 0; line-height: 1.4;">
                ${r.clinicalQuestion}
              </p>
            </div>
          `).join('')}
        </div>

        ${matchingRegions.length === 0 ? `
          <div class="glass-panel" style="padding: 2.5rem; text-align: center;">
            <span style="font-size: 2.5rem;">🔍</span>
            <p style="color: var(--text-secondary); margin-top: 0.5rem;">No se encontraron estructuras para "${q}".</p>
          </div>
        ` : ''}
      `;
    },

    showToast(msg) {
      let toast = document.getElementById('echo-toast');
      if (!toast) {
        toast = document.createElement('div');
        toast.id = 'echo-toast';
        toast.className = 'vade-toast-notification';
        document.body.appendChild(toast);
      }
      toast.textContent = msg;
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 2500);
    }
  };

  window.Ultrasound = Ultrasound;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => Ultrasound.init());
  } else {
    Ultrasound.init();
  }

})(window);
