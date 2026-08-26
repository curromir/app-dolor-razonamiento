/**
 * VADEMÉCUM DE DOLOR - CONTROLADOR CLÍNICO DE ALTA PRECISIÓN
 * Notion Oficial v2.6 & Clinical Pathways Integrados
 * 
 * Principio rector:
 * 1. Pantalla inicial SIEMPRE EXPRESS (Cuadro clínico → 1ª Opción → 2ª Opción → Qué Evitar → Revisión).
 * 2. Segundo nivel detallado accesible con 1 clic en "Ampliar Ficha" (Indicaciones, dosis, titulación, ajustes, interacciones y matices clave como Ciática NICE NG59).
 * 3. Integración de ida y vuelta con el Modo Consulta / Clinical Pathways.
 */

(function(window) {
  'use strict';

  const Vademecum = {
    data: null,
    mode: 'express', // Default ALWAYS 'express'
    activeCategory: 'all',
    activeDrugGroup: 'all',
    searchQuery: '',
    expandedDrugIds: new Set(),
    favorites: new Set(),
    returnContext: null, // { fromClinical: true, pathwayId, presentation, step }

    async init() {
      try {
        const response = await fetch('data/vademecum_catalog.json');
        if (!response.ok) throw new Error('No se pudo cargar vademecum_catalog.json');
        this.data = await response.json();
        
        // Load favorites from localStorage
        const savedFavs = localStorage.getItem('pain_app_fav_drugs');
        if (savedFavs) {
          try {
            this.favorites = new Set(JSON.parse(savedFavs));
          } catch(e) {}
        }

        this.mode = 'express';
        this.attachGlobalEvents();
        this.render();
      } catch (err) {
        console.error('Error inicializando Vademécum:', err);
        const container = document.getElementById('vademecum-content');
        if (container) {
          container.innerHTML = '<div class="glass-panel" style="padding: 2rem; text-align: center; color: var(--text-secondary);">⚠️ Error al cargar el catálogo del Vademécum. Por favor, recargue la página.</div>';
        }
      }
    },

    attachGlobalEvents() {
      const searchInput = document.getElementById('vademecum-search-input');
      if (searchInput) {
        searchInput.addEventListener('input', (e) => {
          this.searchQuery = e.target.value.trim().toLowerCase();
          this.render();
        });
      }

      // Close modal on Escape key
      window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          this.closeDrugModal();
          this.closeInteractionsModal();
        }
      });
    },

    getDrugById(drugId) {
      if (!this.data || !this.data.drugs) return null;
      return this.data.drugs.find(d => d.id === drugId) || null;
    },

    setMode(newMode) {
      this.mode = newMode;
      const btnExpress = document.getElementById('vade-tab-btn-express');
      const btnFull = document.getElementById('vade-tab-btn-full');
      const btnFavs = document.getElementById('vade-tab-btn-favs');
      
      if (btnExpress) btnExpress.classList.toggle('active', newMode === 'express');
      if (btnFull) btnFull.classList.toggle('active', newMode === 'full');
      if (btnFavs) btnFavs.classList.toggle('active', newMode === 'favs');

      this.render();
    },

    setCategory(cat) {
      this.activeCategory = cat;
      document.querySelectorAll('.vade-cat-chip').forEach(chip => {
        chip.classList.toggle('active', chip.getAttribute('data-cat') === cat);
      });
      this.render();
    },

    setDrugGroup(group) {
      this.activeDrugGroup = group;
      document.querySelectorAll('.vade-group-chip').forEach(chip => {
        chip.classList.toggle('active', chip.getAttribute('data-group') === group);
      });
      this.render();
    },

    setReturnContext(ctx) {
      this.returnContext = ctx;
    },

    clearReturnContext() {
      this.returnContext = null;
    },

    returnToConsultation() {
      if (typeof window.ClinicalUI !== 'undefined' && typeof window.ClinicalUI.switchAppMode === 'function') {
        window.ClinicalUI.switchAppMode('clinical');
      } else if (typeof window.switchTab === 'function') {
        window.switchTab('tab-clinical');
      }
      this.closeDrugModal();
    },

    toggleDrugExpanded(drugId) {
      if (this.expandedDrugIds.has(drugId)) {
        this.expandedDrugIds.delete(drugId);
      } else {
        this.expandedDrugIds.add(drugId);
      }
      this.render();
    },

    toggleFavorite(drugId, event) {
      if (event) event.stopPropagation();
      if (this.favorites.has(drugId)) {
        this.favorites.delete(drugId);
      } else {
        this.favorites.add(drugId);
      }
      localStorage.setItem('pain_app_fav_drugs', JSON.stringify(Array.from(this.favorites)));
      this.render();
    },

    copyCustomText(text, event, label = 'Pauta') {
      if (event) event.stopPropagation();
      navigator.clipboard.writeText(text).then(() => {
        this.showToast(`📋 ${label} copiada`);
      }).catch(() => {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        this.showToast(`📋 ${label} copiada`);
      });
    },

    copyPrescription(drugId, event) {
      if (event) event.stopPropagation();
      const drug = this.getDrugById(drugId);
      if (!drug) return;

      const text = drug.prescriptionTemplate || `${drug.genericName}: ${drug.dosing.initial}. ${drug.dosing.timing}`;
      this.copyCustomText(text, event, `Pauta de ${drug.genericName}`);
    },

    openDrug(drugId, options = {}) {
      this.openDrugModal(drugId, options);
    },

    openDrugModal(drugId, options = {}) {
      if (typeof options === 'boolean') {
        options = { fromClinical: options };
      }
      if (options && options.fromClinical) {
        this.setReturnContext({ fromClinical: true });
      }

      const drug = this.getDrugById(drugId);
      if (!drug) {
        console.warn('Fármaco no encontrado:', drugId);
        return;
      }

      const modal = document.getElementById('vade-drug-modal');
      const body = document.getElementById('vade-drug-modal-body');
      const icon = document.getElementById('vadeModalDrugIcon');
      const title = document.getElementById('vadeModalDrugTitle');
      const subtitle = document.getElementById('vadeModalDrugSubtitle');

      if (!modal || !body) return;

      if (icon) icon.textContent = drug.classIcon || '💊';
      if (title) title.textContent = `${drug.genericName} (${drug.brandNames.join(' · ')})`;
      if (subtitle) subtitle.textContent = `${drug.drugClassLabel} · Ficha Farmacológica Nivel 2`;

      const isFav = this.favorites.has(drug.id);
      const isNSAID = drug.drugClass === 'nsaid_oral' || drug.drugClass === 'nsaid_topical';
      const isStrongOpioid = drug.drugClass === 'opioid_strong';
      const isSciaticaWarning = drug.id === 'med-pregabalin' || drug.id === 'med-gabapentin';
      const isFibroPreferred = drug.id === 'med-duloxetine';

      body.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 1.15rem; padding: 0.25rem 0;">
          
          ${this.returnContext ? `
            <div class="vade-return-consultation-banner">
              <div style="display: flex; align-items: center; gap: 0.6rem;">
                <span style="font-size: 1.3rem;">🩺</span>
                <div>
                  <strong style="font-size: 0.88rem; color: var(--accent-blue);">Consulta Clínica Activa</strong>
                  <div style="font-size: 0.76rem; color: var(--text-secondary);">Revisa la dosis y vuelve directamente al plan de tu paciente.</div>
                </div>
              </div>
              <button class="vade-primary-btn" onclick="window.Vademecum.returnToConsultation()" style="font-size: 0.78rem; padding: 0.35rem 0.85rem;">
                ← Volver al Plan de Tratamiento
              </button>
            </div>
          ` : ''}

          <!-- DOSIS EXPRESS (5 SEGUNDOS) -->
          <div class="vade-ultraexpress-box" style="margin: 0;">
            <div class="vade-ultra-dose-row">
              <div class="vade-ultra-dose-item">
                <span class="vade-ultra-lbl">Dosis Inicial:</span>
                <span class="vade-ultra-val">${drug.quickSummary.initialDose}</span>
              </div>
              <div class="vade-ultra-dose-item">
                <span class="vade-ultra-lbl">Objetivo Habitual:</span>
                <span class="vade-ultra-val highlight">${drug.quickSummary.targetDose}</span>
              </div>
              ${drug.quickSummary.maxDose ? `
                <div class="vade-ultra-dose-item">
                  <span class="vade-ultra-lbl">Dosis Máxima / Techo:</span>
                  <span class="vade-ultra-val">${drug.quickSummary.maxDose}</span>
                </div>
              ` : ''}
            </div>
            <div class="vade-ultra-tags-row">
              <div class="vade-ultra-indications">
                <strong>💡 Pensarlo en:</strong> ${drug.quickSummary.keyIndications.join(' · ')}
              </div>
              <div class="vade-ultra-warnings">
                <strong>⚠️ Alertas:</strong> ${drug.quickSummary.mainWarnings.join(' · ')}
              </div>
            </div>
          </div>

          <!-- MATICES CLÍNICOS CRÍTICOS (ALERTA DE SEGURIDAD / GUÍAS) -->
          ${isSciaticaWarning ? `
            <div class="vade-sciatica-override-box">
              <strong>🚫 ADVERTENCIA GUÍAS CLÍNICAS (NICE NG59 / ACP) — CIÁTICA:</strong><br>
              Aunque la ${drug.genericName} es 1ª línea en dolor neuropático periférico focal (neuralgia postherpética, neuropatía diabética), <strong>múltiples ensayos y las guías NICE desaconsejan su uso rutinario en Ciática / Radiculopatía Lumbar</strong> por falta de eficacia analgésica superior a placebo y alta tasa de mareos, sedación y caídas.
            </div>
          ` : ''}

          ${isFibroPreferred ? `
            <div class="vade-nociplastic-override-box">
              <strong>🟢 RECOMENDACIÓN DE PRIMERA LÍNEA (NICE) — DOLOR NOCIPLÁSTICO:</strong><br>
              La Duloxetina cuenta con el mayor respaldo de evidencia entre los neuromoduladores para el dolor nociplástico / fibromialgia. Iniciar con 30 mg matutinos y titular a 60 mg/día a las 1–2 semanas.
            </div>
          ` : ''}

          ${isNSAID ? `
            <div class="vade-nsaid-checklist-box">
              <div class="vade-box-title">🛡️ CHECKLIST DE SEGURIDAD AINE (5 SEGUNDOS ANTES DE PRESCRIBIR)</div>
              <div class="vade-checklist-grid">
                <div>🫘 <strong>Riñón:</strong> Evitar si FG <30. Precaución con deshidratación.</div>
                <div>🩸 <strong>GI / Úlcera:</strong> Gastroprotección (IBP) obligatoria si >65 años o antecedente ulceroso.</div>
                <div>❤️ <strong>CV / HTA:</strong> Descompensa tensión arterial (+5-10 mmHg) e insuficiencia cardiaca.</div>
                <div>💉 <strong>Anticoagulación:</strong> Multiplica el riesgo de sangrado digestivo.</div>
                <div>💊 <strong>Triple Whammy:</strong> IECA/ARA-II + Diurético + AINE = Fracaso Renal Agudo.</div>
              </div>
            </div>
          ` : ''}

          ${isStrongOpioid ? `
            <div class="vade-opioid-banner-box">
              <div class="vade-box-title">🔴 BANNER DE SEGURIDAD PARA OPIOIDES FUERTES</div>
              <p style="margin: 0.25rem 0 0.4rem; font-size: 0.8rem; line-height: 1.5;">
                ¿Dolor severo incapacitante? + ¿Otras opciones insuficientes/inapropiadas? + ¿Objetivo funcional claro y medible? + ¿Beneficio esperado > Riesgo? + ¿Plan de reevaluación y retirada acordado?
              </p>
              <div style="font-size: 0.76rem; color: #fca5a5; font-weight: 700;">
                🚫 No es tratamiento rutinario de dolor crónico no oncológico (lumbalgia mecánica o artrosis) sin objetivo funcional. Profilaxis obligatoria de estreñimiento desde el día 1.
              </div>
            </div>
          ` : ''}

          <!-- INDICACIONES Y RECOMENDACIONES -->
          <div class="vade-detail-section">
            <h4 class="vade-section-subtitle">🎯 Indicaciones & Recomendación por Tipo de Dolor</h4>
            <div class="vade-indications-table">
              ${drug.indications.map(ind => `
                <div class="vade-indication-row">
                  <div>
                    <span class="vade-ind-badge ${ind.recommendation}">${ind.badge}</span>
                    <strong>${ind.conditionName}</strong>
                  </div>
                  <div class="vade-ind-rationale">${ind.rationale}</div>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- PAUTA Y TITULACIÓN -->
          <div class="vade-detail-section">
            <h4 class="vade-section-subtitle">💊 Pauta de Dosificación & Titulación Progresiva</h4>
            <div class="vade-dosing-grid">
              <div><strong>Dosis Inicial:</strong> ${drug.dosing.initial}</div>
              <div><strong>Dosis Habitual:</strong> ${drug.dosing.usual}</div>
              <div><strong>Dosis Máxima:</strong> ${drug.dosing.maximum || 'Ver ficha técnica'}</div>
              <div><strong>Cómo tomarlo:</strong> ${drug.dosing.timing}</div>
              <div><strong>Inicio de efecto:</strong> ${drug.dosing.onset}</div>
              <div><strong>Reevaluar en:</strong> ${drug.dosing.reviewInterval}</div>
            </div>
            ${drug.dosing.titration && drug.dosing.titration.length ? `
              <div class="vade-titration-steps" style="margin-top: 0.75rem;">
                <strong>📈 Pauta de escalada recomendada:</strong>
                <ul style="margin: 0.25rem 0 0 1rem; padding: 0;">
                  ${drug.dosing.titration.map(step => `<li>${step}</li>`).join('')}
                </ul>
              </div>
            ` : ''}
          </div>

          <!-- SEGURIDAD Y AJUSTES RENAL / HEPÁTICO -->
          <div class="vade-detail-section">
            <h4 class="vade-section-subtitle">🛡️ Contraindicaciones, Ajuste Renal y Hepático</h4>
            <div class="vade-safety-grid">
              <div>
                <strong style="color: #ef4444;">Contraindicaciones:</strong>
                <ul style="margin: 0.25rem 0 0 1rem; padding: 0;">${drug.safety.contraindications.map(c => `<li>${c}</li>`).join('')}</ul>
              </div>
              <div>
                <strong style="color: #f59e0b;">Precauciones:</strong>
                <ul style="margin: 0.25rem 0 0 1rem; padding: 0;">${drug.safety.precautions.map(p => `<li>${p}</li>`).join('')}</ul>
              </div>
              <div>
                <strong style="color: #38bdf8;">🫘 Ajuste Renal:</strong>
                <p style="margin: 0.25rem 0; font-size: 0.82rem;">${drug.safety.renalAdjustment}</p>
              </div>
              <div>
                <strong style="color: #a855f7;">🧪 Ajuste Hepático:</strong>
                <p style="margin: 0.25rem 0; font-size: 0.82rem;">${drug.safety.hepaticAdjustment}</p>
              </div>
            </div>
          </div>

          <!-- INTERACCIONES CLAVE -->
          ${drug.interactions && drug.interactions.length ? `
            <div class="vade-detail-section">
              <h4 class="vade-section-subtitle">⚠️ Interacciones Destacadas de Consulta</h4>
              <div class="vade-interactions-list">
                ${drug.interactions.map(inter => `
                  <div class="vade-interaction-card ${inter.severity}">
                    <strong>${inter.drugGroup}:</strong> ${inter.risk} <br>
                    <span style="font-size: 0.78rem; color: var(--text-secondary);">👉 Conducta: ${inter.action}</span>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <!-- CÓMO RETIRAR Y PERLAS -->
          <div class="vade-detail-section">
            <h4 class="vade-section-subtitle">💡 Perlas Clínicas & Retirada Segura</h4>
            <div class="vade-pearls-box">
              <div style="margin-bottom: 0.5rem;">
                <strong>🔄 Cómo retirar:</strong> ${drug.safety.withdrawal}
              </div>
              ${drug.clinicalPearls && drug.clinicalPearls.length ? `
                <div style="border-top: 1px dashed var(--border-color); padding-top: 0.5rem; margin-top: 0.5rem;">
                  <strong>✨ Perlas clínicas de consulta:</strong>
                  <ul style="margin: 0.25rem 0 0 1rem; padding: 0;">${drug.clinicalPearls.map(pearl => `<li>${pearl}</li>`).join('')}</ul>
                </div>
              ` : ''}
            </div>
          </div>

          <!-- TEXTO DE PRESCRIPCIÓN COPIABLE -->
          <div class="vade-prescription-copy-box">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.4rem;">
              <span style="font-weight: 800; font-size: 0.86rem; color: var(--accent-blue);">📋 Pauta Lista para Historia Clínica</span>
              <button class="vade-action-btn" onclick="window.Vademecum.copyPrescription('${drug.id}', event)">
                📋 Copiar Pauta
              </button>
            </div>
            <div class="vade-prescription-text">${drug.prescriptionTemplate}</div>
          </div>

          <!-- ACCIONES INFERIORES -->
          <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.5rem; padding-top: 0.75rem; border-top: 1px solid var(--border-color);">
            <div style="display: flex; gap: 0.5rem;">
              <button class="vade-action-btn" onclick="window.Vademecum.toggleFavorite('${drug.id}', event)">
                ${isFav ? '⭐ Guardado en Mis Fármacos' : '☆ Guardar en Favoritos'}
              </button>
              <button class="vade-action-btn" onclick="window.Vademecum.copyPrescription('${drug.id}', event)">
                📋 Copiar Pauta
              </button>
            </div>
            <div style="display: flex; gap: 0.5rem;">
              ${this.returnContext ? `
                <button class="vade-primary-btn" onclick="window.Vademecum.returnToConsultation()">
                  🩺 Volver a la Consulta
                </button>
              ` : ''}
              <button class="ctrl-btn" onclick="window.Vademecum.closeDrugModal()">
                ✖️ Cerrar Ficha
              </button>
            </div>
          </div>

        </div>
      `;

      modal.style.display = 'flex';
      modal.classList.add('open');
    },

    closeDrugModal() {
      const modal = document.getElementById('vade-drug-modal');
      if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('open');
      }
    },

    openCondition(conditionId) {
      if (typeof window.switchTab === 'function') {
        window.switchTab('tab-vademecum');
      }
      this.mode = 'express';
      this.activeCategory = 'all';
      this.searchQuery = '';
      this.render();

      setTimeout(() => {
        const el = document.getElementById(`cond-${conditionId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.classList.add('highlight-pulse');
          setTimeout(() => el.classList.remove('highlight-pulse'), 2500);
        }
      }, 150);
    },

    showToast(message) {
      let toast = document.getElementById('vade-toast');
      if (!toast) {
        toast = document.createElement('div');
        toast.id = 'vade-toast';
        toast.className = 'vade-toast-notification';
        document.body.appendChild(toast);
      }
      toast.textContent = message;
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 2500);
    },

    render() {
      const container = document.getElementById('vademecum-content');
      if (!container || !this.data) return;

      if (this.searchQuery) {
        this.renderSearchResults(container);
        return;
      }

      if (this.mode === 'express') {
        this.renderExpressView(container);
      } else if (this.mode === 'full') {
        this.renderFullView(container);
      } else if (this.mode === 'favs') {
        this.renderFavoritesView(container);
      }
    },

    renderExpressView(container) {
      let conditions = this.data.express_conditions || [];
      if (this.activeCategory !== 'all') {
        conditions = conditions.filter(c => c.category === this.activeCategory);
      }

      const fiveDoses = this.data.five_key_doses || [];

      container.innerHTML = `
        <!-- 🧠 CINCO DOSIS QUE QUIERO RECORDAR -->
        <section class="vade-five-doses-section">
          <div class="vade-section-header">
            <span style="font-size: 1.3rem;">🧠</span>
            <div>
              <h3 style="font-size: 1rem; font-weight: 900; color: var(--accent-blue); margin: 0;">5 DOSIS QUE QUIERO RECORDAR (Neuromoduladores)</h3>
              <p style="font-size: 0.78rem; color: var(--text-secondary); margin: 0.15rem 0 0;">Toca cualquier fármaco para abrir su ficha completa o copiar la pauta</p>
            </div>
          </div>

          <div class="vade-five-doses-grid">
            ${fiveDoses.map(d => `
              <div class="vade-dose-pill-card" onclick="window.Vademecum.openDrugModal('${d.id}')" title="Abrir ficha detallada de ${d.drugName}">
                <div class="vade-dose-pill-header">
                  <span class="vade-dose-pill-name">${d.drugName}</span>
                  <span class="vade-dose-pill-badge">${d.badge}</span>
                </div>
                <div class="vade-dose-pill-body">
                  <div class="vade-dose-line"><strong>Inicio:</strong> ${d.initial}</div>
                  <div class="vade-dose-line"><strong>Objetivo:</strong> <span>${d.target}</span></div>
                  <div class="vade-dose-indication">${d.mainUse}</div>
                  ${d.sciaticaOverride ? `<div class="vade-dose-override">${d.sciaticaOverride}</div>` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        </section>

        <!-- Filtros por tipo de dolor -->
        <div class="vade-category-toolbar">
          <button class="vade-cat-chip ${this.activeCategory === 'all' ? 'active' : ''}" data-cat="all" onclick="window.Vademecum.setCategory('all')">🌐 Todos (17)</button>
          <button class="vade-cat-chip ${this.activeCategory === 'nociceptivo' ? 'active' : ''}" data-cat="nociceptivo" onclick="window.Vademecum.setCategory('nociceptivo')">🦴 Nociceptivo</button>
          <button class="vade-cat-chip ${this.activeCategory === 'neuropatico' ? 'active' : ''}" data-cat="neuropatico" onclick="window.Vademecum.setCategory('neuropatico')">🧠 Neuropático</button>
          <button class="vade-cat-chip ${this.activeCategory === 'nociplastico' ? 'active' : ''}" data-cat="nociplastico" onclick="window.Vademecum.setCategory('nociplastico')">🌀 Nociplástico</button>
          <button class="vade-cat-chip ${this.activeCategory === 'radicular' ? 'active' : ''}" data-cat="radicular" onclick="window.Vademecum.setCategory('radicular')">⚡ Radicular</button>
          <button class="vade-cat-chip ${this.activeCategory === 'artrosis' ? 'active' : ''}" data-cat="artrosis" onclick="window.Vademecum.setCategory('artrosis')">🦵 Artrosis</button>
          <button class="vade-cat-chip ${this.activeCategory === 'tendinopatia' ? 'active' : ''}" data-cat="tendinopatia" onclick="window.Vademecum.setCategory('tendinopatia')">🩹 Tendinopatía</button>
          <button class="vade-cat-chip ${this.activeCategory === 'oncologico' ? 'active' : ''}" data-cat="oncologico" onclick="window.Vademecum.setCategory('oncologico')">🎗️ Oncológico</button>
        </div>

        <!-- Cards Verticales Modo Express -->
        <div class="vade-express-grid">
          ${conditions.map(c => `
            <article class="vade-express-card" id="cond-${c.id}">
              <div class="vade-express-card-header">
                <div style="display: flex; align-items: center; gap: 0.6rem;">
                  <span class="vade-card-icon">${c.icon}</span>
                  <div>
                    <h3 class="vade-card-title">${c.title}</h3>
                    <span class="vade-card-category">${c.categoryLabel}</span>
                  </div>
                </div>
                ${c.relatedPathwayId ? `
                  <button class="vade-pathway-link-btn" onclick="window.startPathwayFromVademecum('${c.relatedPathwayId}')" title="Abrir Clinical Pathway de Razonamiento">
                    🩺 Razonar en Consulta
                  </button>
                ` : ''}
              </div>

              <div class="vade-express-card-body">
                <!-- 🟢 PRIMERA OPCIÓN -->
                <div class="vade-step-block vade-step-first">
                  <div class="vade-step-label">🟢 PRIMERA OPCIÓN</div>
                  <div class="vade-step-content">${c.firstOption}</div>
                  <div class="vade-step-dose">💊 <strong>Pauta:</strong> ${c.firstDose}</div>
                  <div class="vade-step-actions-bar">
                    <button class="vade-copy-pill-btn" onclick="window.Vademecum.copyCustomText('${c.firstOption}: ${c.firstDose}', event)" title="Copiar pauta a Historia Clínica">
                      📋 Copiar Pauta
                    </button>
                    ${(c.firstDrugIds || []).map(dId => {
                      const drugObj = window.Vademecum.getDrugById(dId);
                      const name = drugObj ? drugObj.genericName : dId;
                      return `<button class="vade-pill-link-btn" onclick="window.Vademecum.openDrugModal('${dId}')" title="Ver ficha detallada (Nivel 2)">
                        📖 Ficha ${name}
                      </button>`;
                    }).join('')}
                  </div>
                </div>

                <!-- 🟡 SEGUNDA OPCIÓN -->
                <div class="vade-step-block vade-step-second">
                  <div class="vade-step-label">🟡 SEGUNDA OPCIÓN</div>
                  <div class="vade-step-content">${c.secondOption}</div>
                  <div class="vade-step-dose">💊 <strong>Pauta:</strong> ${c.secondDose}</div>
                  <div class="vade-step-actions-bar">
                    <button class="vade-copy-pill-btn" onclick="window.Vademecum.copyCustomText('${c.secondOption}: ${c.secondDose}', event)" title="Copiar pauta a Historia Clínica">
                      📋 Copiar Pauta
                    </button>
                    ${(c.secondDrugIds || []).map(dId => {
                      const drugObj = window.Vademecum.getDrugById(dId);
                      const name = drugObj ? drugObj.genericName : dId;
                      return `<button class="vade-pill-link-btn" onclick="window.Vademecum.openDrugModal('${dId}')" title="Ver ficha detallada (Nivel 2)">
                        📖 Ficha ${name}
                      </button>`;
                    }).join('')}
                  </div>
                </div>

                <!-- 🚫 QUÉ EVITAR -->
                <div class="vade-step-block vade-step-avoid">
                  <div class="vade-step-label">🚫 QUÉ EVITAR</div>
                  <div class="vade-step-avoid-text">${c.avoid}</div>
                </div>

                <!-- 📅 REVISIÓN & PERLA -->
                <div class="vade-step-footer">
                  <div>📅 <strong>Revisar:</strong> ${c.review}</div>
                  <div class="vade-pearl-text">💡 ${c.whyThis}</div>
                </div>
              </div>
            </article>
          `).join('')}
        </div>
      `;
    },

    renderFullView(container) {
      let drugs = this.data.drugs || [];
      if (this.activeDrugGroup !== 'all') {
        drugs = drugs.filter(d => d.drugClass === this.activeDrugGroup);
      }

      container.innerHTML = `
        <!-- Filtros por Grupo Farmacológico -->
        <div class="vade-groups-toolbar">
          <button class="vade-group-chip ${this.activeDrugGroup === 'all' ? 'active' : ''}" data-group="all" onclick="window.Vademecum.setDrugGroup('all')">🌐 Todos (${this.data.drugs.length})</button>
          <button class="vade-group-chip ${this.activeDrugGroup === 'analgesic_non_opioid' ? 'active' : ''}" data-group="analgesic_non_opioid" onclick="window.Vademecum.setDrugGroup('analgesic_non_opioid')">🔵 Analgésicos</button>
          <button class="vade-group-chip ${this.activeDrugGroup === 'nsaid_oral' ? 'active' : ''}" data-group="nsaid_oral" onclick="window.Vademecum.setDrugGroup('nsaid_oral')">🟠 AINEs Orales</button>
          <button class="vade-group-chip ${this.activeDrugGroup === 'nsaid_topical' ? 'active' : ''}" data-group="nsaid_topical" onclick="window.Vademecum.setDrugGroup('nsaid_topical')">🩹 AINEs Tópicos</button>
          <button class="vade-group-chip ${this.activeDrugGroup === 'antidepressant_neuromodulator' ? 'active' : ''}" data-group="antidepressant_neuromodulator" onclick="window.Vademecum.setDrugGroup('antidepressant_neuromodulator')">🟣 Antidepresivos</button>
          <button class="vade-group-chip ${this.activeDrugGroup === 'gabapentinoid' ? 'active' : ''}" data-group="gabapentinoid" onclick="window.Vademecum.setDrugGroup('gabapentinoid')">🧠 Gabapentinoides</button>
          <button class="vade-group-chip ${this.activeDrugGroup === 'topical' ? 'active' : ''}" data-group="topical" onclick="window.Vademecum.setDrugGroup('topical')">🩹 Tópicos</button>
          <button class="vade-group-chip ${this.activeDrugGroup === 'muscle_relaxant' ? 'active' : ''}" data-group="muscle_relaxant" onclick="window.Vademecum.setDrugGroup('muscle_relaxant')">💪 Relajantes</button>
          <button class="vade-group-chip ${this.activeDrugGroup === 'corticosteroid' ? 'active' : ''}" data-group="corticosteroid" onclick="window.Vademecum.setDrugGroup('corticosteroid')">🔥 Corticoides</button>
          <button class="vade-group-chip ${this.activeDrugGroup === 'opioid_weak' ? 'active' : ''}" data-group="opioid_weak" onclick="window.Vademecum.setDrugGroup('opioid_weak')">🟡 Opioides Débiles</button>
          <button class="vade-group-chip ${this.activeDrugGroup === 'opioid_strong' ? 'active' : ''}" data-group="opioid_strong" onclick="window.Vademecum.setDrugGroup('opioid_strong')">🔴 Opioides Fuertes</button>
        </div>

        <div class="vade-drugs-list">
          ${drugs.map(drug => this.renderDrugCard(drug)).join('')}
        </div>
      `;
    },

    renderDrugCard(drug) {
      const isExpanded = this.expandedDrugIds.has(drug.id);
      const isFav = this.favorites.has(drug.id);
      const isNSAID = drug.drugClass === 'nsaid_oral' || drug.drugClass === 'nsaid_topical';
      const isStrongOpioid = drug.drugClass === 'opioid_strong';
      const isSciaticaWarning = drug.id === 'med-pregabalin' || drug.id === 'med-gabapentin';

      return `
        <article class="vade-drug-card" id="drug-${drug.id}">
          <!-- ULTRAEXPRESS HEADER (5 segundos) -->
          <div class="vade-drug-card-header">
            <div class="vade-drug-header-top">
              <div style="display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap;">
                <span style="font-size: 1.4rem;">${drug.classIcon}</span>
                <div>
                  <h3 class="vade-drug-name">${drug.genericName}</h3>
                  <div class="vade-drug-brands">${drug.brandNames.join(' · ')}</div>
                </div>
              </div>

              <div class="vade-drug-header-actions">
                <button class="vade-fav-btn ${isFav ? 'active' : ''}" onclick="window.Vademecum.toggleFavorite('${drug.id}', event)" title="Guardar en Mis Fármacos">
                  ${isFav ? '⭐' : '☆'}
                </button>
                <button class="vade-action-btn" onclick="window.Vademecum.copyPrescription('${drug.id}', event)" title="Copiar pauta clínica">
                  📋 Copiar Pauta
                </button>
                <button class="vade-pill-link-btn" onclick="window.Vademecum.openDrugModal('${drug.id}')" title="Ver en Modal">
                  🔍 Modal
                </button>
              </div>
            </div>

            <!-- VISTA ULTRAEXPRESS: Dosis + Indicaciones Clave -->
            <div class="vade-ultraexpress-box">
              <div class="vade-ultra-dose-row">
                <div class="vade-ultra-dose-item">
                  <span class="vade-ultra-lbl">Inicio:</span>
                  <span class="vade-ultra-val">${drug.quickSummary.initialDose}</span>
                </div>
                <div class="vade-ultra-dose-item">
                  <span class="vade-ultra-lbl">Objetivo habitual:</span>
                  <span class="vade-ultra-val highlight">${drug.quickSummary.targetDose}</span>
                </div>
                ${drug.quickSummary.maxDose ? `
                  <div class="vade-ultra-dose-item">
                    <span class="vade-ultra-lbl">Techo / Máx:</span>
                    <span class="vade-ultra-val">${drug.quickSummary.maxDose}</span>
                  </div>
                ` : ''}
              </div>

              <div class="vade-ultra-tags-row">
                <div class="vade-ultra-indications">
                  <strong>💡 Pensarlo en:</strong> ${drug.quickSummary.keyIndications.join(' · ')}
                </div>
                <div class="vade-ultra-warnings">
                  <strong>⚠️ Alertas:</strong> ${drug.quickSummary.mainWarnings.join(' · ')}
                </div>
              </div>
            </div>

            <!-- Botón Desplegar Ficha Completa -->
            <button class="vade-expand-toggle-btn" onclick="window.Vademecum.toggleDrugExpanded('${drug.id}')">
              <span>${isExpanded ? '▲ Ocultar Ficha Detallada' : '▼ AMPLIAR FICHA COMPLETA (Seguridad, Interacciones, Pautas)'}</span>
            </button>
          </div>

          <!-- CUERPO DETALLADO -->
          ${isExpanded ? `
            <div class="vade-drug-expanded-body">
              ${isNSAID ? `
                <div class="vade-nsaid-checklist-box">
                  <div class="vade-box-title">🛡️ CHECKLIST DE SEGURIDAD AINE (5 SEGUNDOS ANTES DE RECETAR)</div>
                  <div class="vade-checklist-grid">
                    <div>🫘 <strong>Riñón:</strong> Evitar si FG <30. Precaución con deshidratación.</div>
                    <div>🩸 <strong>GI / Úlcera:</strong> Gastroprotección (IBP) obligatoria si >65 años o antecedente ulceroso.</div>
                    <div>❤️ <strong>CV / HTA:</strong> Descompensa tensión arterial (+5-10 mmHg) e insuficiencia cardiaca.</div>
                    <div>💉 <strong>Anticoagulación:</strong> Multiplica riesgo de hemorragia digestiva.</div>
                    <div>💊 <strong>Triple Whammy:</strong> IECA/ARA-II + Diurético + AINE = Fracaso Renal Agudo.</div>
                  </div>
                </div>
              ` : ''}

              ${isStrongOpioid ? `
                <div class="vade-opioid-banner-box">
                  <div class="vade-box-title">🔴 BANNER DE SEGURIDAD PARA OPIOIDES FUERTES</div>
                  <p style="margin: 0.25rem 0 0.5rem; font-size: 0.8rem; line-height: 1.5;">
                    ¿Dolor severo incapacitante? + ¿Otras opciones insuficientes/inapropiadas? + ¿Objetivo funcional claro medible? + ¿Beneficio esperado > Riesgo? + ¿Plan de reevaluación y retirada acordado?
                  </p>
                  <div style="font-size: 0.76rem; color: #fca5a5; font-weight: 700;">
                    🚫 No es tratamiento rutinario de dolor crónico no oncológico (lumbalgia mecánica o artrosis) sin objetivo funcional. Profilaxis obligatoria de estreñimiento desde el día 1.
                  </div>
                </div>
              ` : ''}

              ${isSciaticaWarning ? `
                <div class="vade-sciatica-override-box">
                  <strong>🚫 ALERTA DE PRESCRIPCIÓN EN CIÁTICA (NICE NG59 / ACP):</strong><br>
                  No prescribir pregabalina ni gabapentina de rutina para ciática/radiculopatía lumbar aguda o subaguda. La evidencia demuestra falta de beneficio analgésico frente a placebo y alta tasa de efectos secundarios.
                </div>
              ` : ''}

              <!-- Indicaciones -->
              <div class="vade-detail-section">
                <h4 class="vade-section-subtitle">🎯 Indicaciones & Recomendación por Cuadro</h4>
                <div class="vade-indications-table">
                  ${drug.indications.map(ind => `
                    <div class="vade-indication-row">
                      <div>
                        <span class="vade-ind-badge ${ind.recommendation}">${ind.badge}</span>
                        <strong>${ind.conditionName}</strong>
                      </div>
                      <div class="vade-ind-rationale">${ind.rationale}</div>
                    </div>
                  `).join('')}
                </div>
              </div>

              <!-- Pauta & Titulación -->
              <div class="vade-detail-section">
                <h4 class="vade-section-subtitle">💊 Pauta de Dosificación & Titulación</h4>
                <div class="vade-dosing-grid">
                  <div><strong>Inicio:</strong> ${drug.dosing.initial}</div>
                  <div><strong>Habitual:</strong> ${drug.dosing.usual}</div>
                  <div><strong>Máxima:</strong> ${drug.dosing.maximum || 'Ver ficha técnica'}</div>
                  <div><strong>Cómo tomarlo:</strong> ${drug.dosing.timing}</div>
                  <div><strong>Inicio de efecto:</strong> ${drug.dosing.onset}</div>
                  <div><strong>Reevaluar en:</strong> ${drug.dosing.reviewInterval}</div>
                </div>
                ${drug.dosing.titration && drug.dosing.titration.length ? `
                  <div class="vade-titration-steps">
                    <strong>Pauta de escalada / titulación:</strong>
                    <ul>
                      ${drug.dosing.titration.map(step => `<li>${step}</li>`).join('')}
                    </ul>
                  </div>
                ` : ''}
              </div>

              <!-- Seguridad -->
              <div class="vade-detail-section">
                <h4 class="vade-section-subtitle">🛡️ Contraindicaciones, Ajuste Renal y Hepático</h4>
                <div class="vade-safety-grid">
                  <div>
                    <strong style="color: #ef4444;">Contraindicaciones:</strong>
                    <ul>${drug.safety.contraindications.map(c => `<li>${c}</li>`).join('')}</ul>
                  </div>
                  <div>
                    <strong style="color: #f59e0b;">Precauciones:</strong>
                    <ul>${drug.safety.precautions.map(p => `<li>${p}</li>`).join('')}</ul>
                  </div>
                  <div>
                    <strong style="color: #38bdf8;">🫘 Ajuste Renal:</strong>
                    <p style="margin: 0.25rem 0; font-size: 0.82rem;">${drug.safety.renalAdjustment}</p>
                  </div>
                  <div>
                    <strong style="color: #a855f7;">🧪 Ajuste Hepático:</strong>
                    <p style="margin: 0.25rem 0; font-size: 0.82rem;">${drug.safety.hepaticAdjustment}</p>
                  </div>
                </div>
              </div>

              <!-- Interacciones -->
              ${drug.interactions && drug.interactions.length ? `
                <div class="vade-detail-section">
                  <h4 class="vade-section-subtitle">⚠️ Interacciones Destacadas</h4>
                  <div class="vade-interactions-list">
                    ${drug.interactions.map(inter => `
                      <div class="vade-interaction-card ${inter.severity}">
                        <strong>${inter.drugGroup}:</strong> ${inter.risk} <br>
                        <span style="font-size: 0.78rem; color: var(--text-secondary);">👉 Conducta: ${inter.action}</span>
                      </div>
                    `).join('')}
                  </div>
                </div>
              ` : ''}

              <!-- Retirada y Perlas -->
              <div class="vade-detail-section">
                <h4 class="vade-section-subtitle">💡 Perlas Clínicas & Retirada</h4>
                <div class="vade-pearls-box">
                  <div style="margin-bottom: 0.5rem;">
                    <strong>🔄 Cómo retirar:</strong> ${drug.safety.withdrawal}
                  </div>
                  ${drug.clinicalPearls && drug.clinicalPearls.length ? `
                    <div style="border-top: 1px dashed rgba(255,255,255,0.1); padding-top: 0.5rem;">
                      <strong>✨ Perlas clínicas de consulta:</strong>
                      <ul>${drug.clinicalPearls.map(pearl => `<li>${pearl}</li>`).join('')}</ul>
                    </div>
                  ` : ''}
                </div>
              </div>

              <!-- Prescripción -->
              <div class="vade-prescription-copy-box">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.4rem;">
                  <span style="font-weight: 700; font-size: 0.84rem; color: #38bdf8;">📋 Texto de Prescripción para Historia Clínica</span>
                  <button class="vade-action-btn" onclick="window.Vademecum.copyPrescription('${drug.id}', event)">
                    Copiar
                  </button>
                </div>
                <div class="vade-prescription-text">${drug.prescriptionTemplate}</div>
              </div>
            </div>
          ` : ''}
        </article>
      `;
    },

    renderFavoritesView(container) {
      const favIds = Array.from(this.favorites);
      if (favIds.length === 0) {
        container.innerHTML = `
          <div class="glass-panel" style="padding: 3rem 1.5rem; text-align: center;">
            <span style="font-size: 3rem;">⭐</span>
            <h3 style="font-size: 1.1rem; color: var(--text-primary); margin: 0.75rem 0 0.25rem;">Aún no tienes fármacos favoritos</h3>
            <p style="font-size: 0.85rem; color: var(--text-secondary); max-width: 400px; margin: 0 auto 1.5rem;">
              Marca con la estrella ⭐ los fármacos que más utilizas en tu práctica clínica para tenerlos siempre accesibles aquí en 1 segundo.
            </p>
            <button class="vade-primary-btn" onclick="window.Vademecum.setMode('full')">
              Ver Todos los Fármacos
            </button>
          </div>
        `;
        return;
      }

      const favDrugs = (this.data.drugs || []).filter(d => this.favorites.has(d.id));
      container.innerHTML = `
        <div class="vade-favs-header" style="margin-bottom: 1rem; display: flex; align-items: center; justify-content: space-between;">
          <h3 style="font-size: 1rem; color: #818cf8; margin: 0;">⭐ MIS FÁRMACOS HABITUALES (${favDrugs.length})</h3>
          <span style="font-size: 0.78rem; color: var(--text-secondary);">Guardados en este dispositivo</span>
        </div>
        <div class="vade-drugs-list">
          ${favDrugs.map(drug => this.renderDrugCard(drug)).join('')}
        </div>
      `;
    },

    renderSearchResults(container) {
      const q = this.searchQuery;
      const matchingConditions = (this.data.express_conditions || []).filter(c => 
        c.title.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q) ||
        c.firstOption.toLowerCase().includes(q) ||
        c.secondOption.toLowerCase().includes(q) ||
        c.whyThis.toLowerCase().includes(q)
      );

      const matchingDrugs = (this.data.drugs || []).filter(d => 
        d.genericName.toLowerCase().includes(q) ||
        d.brandNames.some(b => b.toLowerCase().includes(q)) ||
        d.drugClassLabel.toLowerCase().includes(q) ||
        d.quickSummary.keyIndications.some(i => i.toLowerCase().includes(q)) ||
        d.indications.some(i => i.conditionName.toLowerCase().includes(q) || i.rationale.toLowerCase().includes(q)) ||
        d.safety.contraindications.some(c => c.toLowerCase().includes(q))
      );

      let overrideBanner = '';
      if (q.includes('ciat') || q.includes('radicul') || q.includes('lumbar')) {
        overrideBanner = `
          <div class="vade-sciatica-override-box" style="margin-bottom: 1.5rem;">
            <strong>⚡ OVERRIDE CLÍNICO EN CIÁTICA / RADICULOPATÍA LUMBAR:</strong><br>
            • Pregabalina y Gabapentina: 🔴 NO USO RUTINARIO (NICE NG59).<br>
            • Prednisona oral: 🟡 USO SELECCIONADO (Goldberg RCT: modesta mejoría funcional sin reducción del dolor).<br>
            • Primera línea: Mantener actividad tolerada ± AINE ciclo corto si precisa.
          </div>
        `;
      } else if (q.includes('fibro') || q.includes('nociplast')) {
        overrideBanner = `
          <div class="vade-nociplastic-override-box" style="margin-bottom: 1.5rem;">
            <strong>🌀 OVERRIDE CLÍNICO EN DOLOR NOCIPLÁSTICO / FIBROMIALGIA:</strong><br>
            • Duloxetina 30→60 mg/d: 🟢 Opción preferente respaldada (NICE).<br>
            • Amitriptilina 10–25 mg noche: 🟢 De elección si predomina alteración del sueño.<br>
            • Venlafaxina XR: 🟡 Alternativa individualizada.<br>
            • Opioides y AINEs crónicos: 🚫 CONTRAINDICADOS de rutina.
          </div>
        `;
      }

      container.innerHTML = `
        <div class="vade-search-summary" style="margin-bottom: 1.25rem;">
          <span style="font-size: 0.85rem; color: var(--text-secondary);">
            Resultados para "<strong>${q}</strong>": ${matchingConditions.length} cuadros clínicos y ${matchingDrugs.length} fármacos.
          </span>
        </div>

        ${overrideBanner}

        ${matchingConditions.length ? `
          <div style="margin-bottom: 2rem;">
            <h4 style="font-size: 0.95rem; font-weight: 800; color: var(--accent-blue); margin-bottom: 0.75rem;">📋 Cuadros Clínicos Relacionados</h4>
            <div class="vade-express-grid">
              ${matchingConditions.map(c => `
                <article class="vade-express-card" id="cond-${c.id}">
                  <div class="vade-express-card-header">
                    <div style="display: flex; align-items: center; gap: 0.6rem;">
                      <span class="vade-card-icon">${c.icon}</span>
                      <div>
                        <h3 class="vade-card-title">${c.title}</h3>
                        <span class="vade-card-category">${c.categoryLabel}</span>
                      </div>
                    </div>
                  </div>
                  <div class="vade-express-card-body">
                    <div class="vade-step-block vade-step-first">
                      <div class="vade-step-label">🟢 1ª OPCIÓN</div>
                      <div>${c.firstOption}</div>
                      <div class="vade-step-dose">💊 ${c.firstDose}</div>
                      <div class="vade-step-actions-bar">
                        <button class="vade-copy-pill-btn" onclick="window.Vademecum.copyCustomText('${c.firstOption}: ${c.firstDose}', event)">
                          📋 Copiar Pauta
                        </button>
                        ${(c.firstDrugIds || []).map(dId => {
                          const drugObj = window.Vademecum.getDrugById(dId);
                          const name = drugObj ? drugObj.genericName : dId;
                          return `<button class="vade-pill-link-btn" onclick="window.Vademecum.openDrugModal('${dId}')">
                            📖 Ficha ${name}
                          </button>`;
                        }).join('')}
                      </div>
                    </div>
                    <div class="vade-step-block vade-step-avoid">
                      <div class="vade-step-label">🚫 EVITAR</div>
                      <div>${c.avoid}</div>
                    </div>
                  </div>
                </article>
              `).join('')}
            </div>
          </div>
        ` : ''}

        ${matchingDrugs.length ? `
          <div>
            <h4 style="font-size: 0.95rem; font-weight: 800; color: var(--accent-blue); margin-bottom: 0.75rem;">💊 Fármacos Coincidentes</h4>
            <div class="vade-drugs-list">
              ${matchingDrugs.map(drug => this.renderDrugCard(drug)).join('')}
            </div>
          </div>
        ` : ''}

        ${matchingConditions.length === 0 && matchingDrugs.length === 0 ? `
          <div class="glass-panel" style="padding: 2.5rem; text-align: center;">
            <span style="font-size: 2.5rem;">🔍</span>
            <p style="color: var(--text-secondary); margin-top: 0.5rem;">No se encontraron resultados para "${q}".</p>
            <p style="font-size: 0.8rem; color: var(--text-muted);">Prueba a buscar por principio activo (ej. duloxetina), nombre comercial (ej. zaldiar) o cuadro clínico (ej. ciática, artrosis, fibromialgia).</p>
          </div>
        ` : ''}
      `;
    },

    openInteractionsModal() {
      const modal = document.getElementById('vade-interactions-modal');
      if (!modal) return;

      const list = this.data.high_yield_interactions || [];
      const body = document.getElementById('vade-interactions-modal-body');
      if (body) {
        body.innerHTML = `
          <div class="vade-interactions-modal-grid">
            ${list.map(inter => `
              <div class="vade-modal-interaction-card ${inter.severity}">
                <div class="vade-modal-inter-title">⚠️ ${inter.title}</div>
                <div class="vade-modal-inter-risk"><strong>Riesgo:</strong> ${inter.risk}</div>
                <div class="vade-modal-inter-action">👉 <strong>Conducta:</strong> ${inter.action}</div>
              </div>
            `).join('')}
          </div>
        `;
      }
      modal.style.display = 'flex';
      modal.classList.add('open');
    },

    closeInteractionsModal() {
      const modal = document.getElementById('vade-interactions-modal');
      if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('open');
      }
    }
  };

  window.Vademecum = Vademecum;

  window.startPathwayFromVademecum = function(pathwayId) {
    if (typeof window.startPathwayById === 'function') {
      window.startPathwayById(pathwayId);
    } else if (typeof window.switchTab === 'function') {
      window.switchTab('tab-clinical');
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => Vademecum.init());
  } else {
    Vademecum.init();
  }

})(window);
