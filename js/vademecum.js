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
      if (window.EMBEDDED_BUNDLE && window.EMBEDDED_BUNDLE.vademecum) {
        this.data = window.EMBEDDED_BUNDLE.vademecum;
        const savedFavs = localStorage.getItem('pain_app_fav_drugs');
        if (savedFavs) {
          try {
            this.favorites = new Set(JSON.parse(savedFavs));
          } catch(e) {}
        }
        this.mode = 'express';
        this.attachGlobalEvents();
        this.render();
        return;
      }

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
        if (window.EMBEDDED_BUNDLE && window.EMBEDDED_BUNDLE.vademecum) {
          this.data = window.EMBEDDED_BUNDLE.vademecum;
          this.mode = 'express';
          this.attachGlobalEvents();
          this.render();
          return;
        }
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
      this.searchQuery = '';
      const searchInput = document.getElementById('vademecum-search-input');
      if (searchInput) searchInput.value = '';

      const btnExpress = document.getElementById('vade-tab-btn-express');
      const btnInterventions = document.getElementById('vade-tab-btn-interventions');
      const btnRF = document.getElementById('vade-tab-btn-radiofrequency');
      const btnFull = document.getElementById('vade-tab-btn-full');
      const btnFavs = document.getElementById('vade-tab-btn-favs');
      
      if (btnExpress) btnExpress.classList.toggle('active', newMode === 'express');
      if (btnInterventions) btnInterventions.classList.toggle('active', newMode === 'interventions');
      if (btnRF) btnRF.classList.toggle('active', newMode === 'radiofrequency');
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

    setInterventionRegion(reg) {
      this.activeInterventionRegion = reg;
      document.querySelectorAll('.vade-inter-chip').forEach(chip => {
        chip.classList.toggle('active', chip.getAttribute('data-reg') === reg);
      });
      this.render();
    },

    setRfCategory(cat) {
      this.activeRfCategory = cat;
      document.querySelectorAll('.vade-rf-chip').forEach(chip => {
        chip.classList.toggle('active', chip.getAttribute('data-rf') === cat);
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

    copyIntervention(interId, event) {
      if (event) event.stopPropagation();
      if (!this.data || !this.data.interventions) return;
      const inter = this.data.interventions.find(i => i.id === interId);
      if (!inter) return;

      let text = `${inter.name}\n`;
      text += `• Diana: ${(inter.target || '').replace(/\n/g, ' ')}\n`;
      text += `• Indicación: ${inter.indication || ''}\n`;
      
      if (inter.parameters) {
        text += `• Parámetros RF: ${inter.parameters.temperature || ''} / ${inter.parameters.time || ''}\n`;
        if (inter.parameters.cannula) text += `• Cánula: ${inter.parameters.cannula}\n`;
        if (inter.parameters.sensoryStimulation) text += `• Sensitiva (50 Hz): ${inter.parameters.sensoryStimulation}\n`;
        if (inter.parameters.motorStimulation) text += `• Motora (2 Hz): ${inter.parameters.motorStimulation}\n`;
      }
      
      if (inter.localAnesthetic) {
        text += `• Anestésico Local: ${inter.localAnesthetic.drug || ''} ${inter.localAnesthetic.volume || ''} ${inter.localAnesthetic.dose ? '(' + inter.localAnesthetic.dose + ')' : ''}\n`;
      }
      if (inter.corticosteroid) {
        text += `• Corticoide: ${inter.corticosteroid.drug || ''} ${inter.corticosteroid.dose ? '· ' + inter.corticosteroid.dose : ''} ${inter.corticosteroid.volume ? '(' + inter.corticosteroid.volume + ')' : ''}\n`;
      }
      if (inter.totalVolume) {
        text += `• Volumen Total: ${inter.totalVolume}\n`;
      }
      
      this.copyCustomText(text.trim(), event, `Pauta: ${inter.name}`);
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
      document.body.style.overflow = 'hidden';
    },

    closeDrugModal() {
      const modal = document.getElementById('vade-drug-modal');
      if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('open');
      }
      document.body.style.overflow = '';
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
      } else if (this.mode === 'interventions') {
        this.renderInterventionsView(container);
      } else if (this.mode === 'radiofrequency') {
        this.renderRadiofrequencyView(container);
      } else if (this.mode === 'full') {
        this.renderFullView(container);
      } else if (this.mode === 'favs') {
        this.renderFavoritesView(container);
      }
    },

    renderRadiofrequencyView(container) {
      let rfItems = (this.data.interventions || []).filter(i => 
        i.id?.startsWith('rf-') || i.id?.startsWith('prf-') || (i.type && (i.type.includes('Radiofrecuencia') || i.type.includes('Térmica') || i.type.includes('Pulsada') || i.type.includes('Cooled')))
      );

      if (this.activeRfCategory && this.activeRfCategory !== 'all') {
        rfItems = rfItems.filter(i => {
          if (this.activeRfCategory === 'lumbar_sacro') return i.region === 'lumbar' || i.region === 'sacroiliaca';
          if (this.activeRfCategory === 'cervical_ton') return i.region === 'cervical';
          if (this.activeRfCategory === 'drg') return i.id?.includes('drg');
          if (this.activeRfCategory === 'rodilla') return i.region === 'rodilla';
          if (this.activeRfCategory === 'cadera') return i.region === 'cadera';
          if (this.activeRfCategory === 'hombro_periferico') return i.region === 'hombro' || i.category === 'hombro';
          return true;
        });
      }

      const facetLumbar = (this.data.interventions || []).find(i => i.id === 'rf-facet-lumbar')?.facetLevelMapping?.levels || [];
      const facetCervical = (this.data.interventions || []).find(i => i.id === 'rf-facet-cervical')?.facetLevelMapping?.levels || [];
      const drgLumbar = (this.data.interventions || []).find(i => i.id === 'prf-drg-lumbar')?.rootLevelMapping?.levels || [];
      const drgCervical = (this.data.interventions || []).find(i => i.id === 'prf-drg-cervical')?.rootLevelMapping?.levels || [];

      container.innerHTML = `
        <!-- HEADER RADIOFRECUENCIA -->
        <section class="vade-five-doses-section" style="border-color: rgba(99, 102, 241, 0.4); background: linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(16, 185, 129, 0.04) 100%);">
          <div class="vade-section-header">
            <span style="font-size: 1.6rem;">⚡</span>
            <div>
              <h3 style="font-size: 1.05rem; font-weight: 900; color: var(--accent-blue); margin: 0;">RADIOFRECUENCIA TÉRMICA CONVENCIONAL, COOLED Y PULSADA (PRF)</h3>
              <p style="font-size: 0.8rem; color: var(--text-secondary); margin: 0.2rem 0 0;">Tablas de Dosis y Parámetros Físicos · Estimulación (50 Hz / 2 Hz) · Mapeo Nivel por Nivel de Facetas y DRG · AL Pre-Lesión</p>
            </div>
          </div>

          <!-- Quick Reference Accordions: Physical Modes & Stimulation -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 0.75rem; margin-top: 0.75rem;">
            <!-- Modalidades Físicas -->
            <div class="structure-box" style="background: var(--bg-surface); border-color: rgba(99, 102, 241, 0.3);">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
                <strong style="font-size: 0.86rem; color: var(--accent-blue);">🔥 Modalidades: Térmica vs Pulsada vs Cooled</strong>
                <span style="font-size: 0.7rem; color: #a5b4fc; font-weight: 700;">Biofísica</span>
              </div>
              <div style="display: flex; flex-direction: column; gap: 0.35rem; font-size: 0.75rem;">
                <div style="padding: 0.35rem 0.45rem; background: rgba(255, 255, 255, 0.02); border-radius: var(--radius-sm); border-left: 3px solid #ef4444;">
                  <strong style="color: #f87171;">Térmica Continua (80°C / 90 s):</strong>
                  <div style="color: var(--text-secondary); font-size: 0.72rem;">Termolesión ablativa de ramos mediales facetarios (lumbar/cervical) y geniculados. AL pre-lesión: Lidocaína 2% 0.5-1 mL. Alivio 9-18 meses.</div>
                </div>
                <div style="padding: 0.35rem 0.45rem; background: rgba(255, 255, 255, 0.02); border-radius: var(--radius-sm); border-left: 3px solid #3b82f6;">
                  <strong style="color: #60a5fa;">Pulsada PRF (42°C / 240 s):</strong>
                  <div style="color: var(--text-secondary); font-size: 0.72rem;">Campo electromagnético no térmico (2 Hz / 20 ms). Ganglio Raíz Dorsal (DRG), Supraescapular, Arnold. <strong>Preserva función motora sin desaferentación.</strong></div>
                </div>
                <div style="padding: 0.35rem 0.45rem; background: rgba(255, 255, 255, 0.02); border-radius: var(--radius-sm); border-left: 3px solid #10b981;">
                  <strong style="color: #34d399;">Cooled RF Enfriada (60°C / 150 s):</strong>
                  <div style="color: var(--text-secondary); font-size: 0.72rem;">Lesión esférica grande de 8-10 mm refrigerada por agua para ramos laterales sacros (S1-S3 + L5) y ramas articulares de cadera.</div>
                </div>
              </div>
            </div>

            <!-- Estimulación y Seguridad -->
            <div class="structure-box" style="background: var(--bg-surface); border-color: rgba(245, 158, 11, 0.3);">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
                <strong style="font-size: 0.86rem; color: #f59e0b;">⚡ Parámetros de Estimulación & Seguridad</strong>
                <span style="font-size: 0.7rem; color: #f59e0b; font-weight: 700;">Guía SIS 2024</span>
              </div>
              <div style="display: flex; flex-direction: column; gap: 0.35rem; font-size: 0.75rem;">
                <div style="padding: 0.35rem 0.45rem; background: rgba(255, 255, 255, 0.02); border-radius: var(--radius-sm); border-left: 3px solid #60a5fa;">
                  <strong style="color: #60a5fa;">Estimulación Sensitiva (50 Hz):</strong>
                  <div style="color: var(--text-secondary); font-size: 0.72rem;">Reproducción de concordancia dolorosa/parestesia en la zona diana con umbral <strong>&lt; 0.5 V</strong>.</div>
                </div>
                <div style="padding: 0.35rem 0.45rem; background: rgba(255, 255, 255, 0.02); border-radius: var(--radius-sm); border-left: 3px solid #f87171;">
                  <strong style="color: #f87171;">Estimulación Motora (2 Hz):</strong>
                  <div style="color: var(--text-secondary); font-size: 0.72rem;">Ausencia de contracción motora radicular en extremidades con estímulo <strong>&gt; 1.5 - 2.0 V</strong> (descarta proximidad a raíz motora ventral).</div>
                </div>
                <div style="padding: 0.35rem 0.45rem; background: rgba(255, 255, 255, 0.02); border-radius: var(--radius-sm); border-left: 3px solid #eab308;">
                  <strong style="color: #facc15;">Bloqueo Diagnóstico Previo:</strong>
                  <div style="color: var(--text-secondary); font-size: 0.72rem;">Obligatorio alivio <strong>≥70-80%</strong> con anestésico local puro antes de indicar rizolisis térmica.</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- 📊 TABLA 1: TABLA MAESTRA DE RADIOFRECUENCIA -->
        <section class="glass-panel table-card" style="margin-top: 0.75rem; border-color: rgba(99, 102, 241, 0.3);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; flex-wrap: wrap; gap: 0.5rem;">
            <div>
              <h4 style="margin: 0; font-size: 0.95rem; font-weight: 800; color: var(--accent-blue); display: flex; align-items: center; gap: 0.4rem;">
                <span>📊</span> TABLA MAESTRA DE RADIOFRECUENCIA (TÉRMICA, COOLED Y PULSADA)
              </h4>
              <p style="margin: 0.2rem 0 0; font-size: 0.75rem; color: var(--text-muted);">Parámetros físicos, estimulación (50 Hz / 2 Hz), anestésicos locales pre-lesión y dianas anatómicas</p>
            </div>
            <span class="treatment-badge-pill blue" style="font-size: 0.72rem;">10 Técnicas Estandarizadas</span>
          </div>

          <div class="table-responsive" style="max-height: 420px; overflow-y: auto;">
            <table class="clinical-table" style="font-size: 0.78rem;">
              <thead>
                <tr style="position: sticky; top: 0; background: var(--bg-surface); z-index: 2;">
                  <th style="min-width: 170px;">Procedimiento / Región</th>
                  <th style="min-width: 130px;">⚡ Parámetros & Tipo</th>
                  <th style="min-width: 180px;">🎯 Diana Anatómica Exacta</th>
                  <th style="min-width: 140px;">💉 AL Pre-Lesión</th>
                  <th style="min-width: 150px;">⚡ Estimulación (50 Hz / 2 Hz)</th>
                  <th style="min-width: 190px;">🔍 Requisito / Alerta de Seguridad</th>
                  <th style="min-width: 80px; text-align: center;">Acción</th>
                </tr>
              </thead>
              <tbody>
                ${rfItems.map(i => `
                  <tr>
                    <td>
                      <strong style="color: var(--text-primary); display: block;">${i.name}</strong>
                      <span style="font-size: 0.7rem; color: #a5b4fc;">${i.type || i.categoryLabel || i.region}</span>
                    </td>
                    <td>
                      <span style="color: ${i.type?.includes('Pulsada') ? '#60a5fa' : i.type?.includes('Cooled') ? '#34d399' : '#f87171'}; font-weight: 800; font-family: var(--font-mono);">
                        ${i.parameters?.temperature || ''} / ${i.parameters?.time || ''}
                      </span>
                      <div style="font-size: 0.7rem; color: var(--text-secondary);">${i.parameters?.cannula || ''}</div>
                    </td>
                    <td>
                      <span style="font-size: 0.72rem; color: var(--text-secondary);">${(i.target || '').replace(/\n/g, '<br>')}</span>
                    </td>
                    <td>
                      <span style="color: #60a5fa; font-weight: 700;">${i.localAnesthetic?.drug || '—'}</span>
                      <div style="font-size: 0.7rem; color: var(--text-secondary);">${i.localAnesthetic?.volume || ''} ${i.localAnesthetic?.dose ? '(' + i.localAnesthetic.dose + ')' : ''}</div>
                    </td>
                    <td>
                      <div style="font-size: 0.7rem; color: #60a5fa;"><strong>50 Hz:</strong> ${i.parameters?.sensoryStimulation || '—'}</div>
                      <div style="font-size: 0.7rem; color: #f87171;"><strong>2 Hz:</strong> ${i.parameters?.motorStimulation || '—'}</div>
                    </td>
                    <td>
                      ${i.requiredDiagnosticTest ? `<div style="font-size: 0.7rem; color: #f59e0b; font-weight: 700;">🔍 ${i.requiredDiagnosticTest}</div>` : ''}
                      <span style="font-size: 0.7rem; color: ${(i.safetyWarnings && i.safetyWarnings[0]?.includes('¡') || i.safetyWarnings && i.safetyWarnings[0]?.includes('PROHIBIDO')) ? '#ef4444' : 'var(--text-secondary)'};">
                        ${(i.safetyWarnings && i.safetyWarnings.length > 0) ? i.safetyWarnings[0] : (i.indication || '—')}
                      </span>
                    </td>
                    <td style="text-align: center;">
                      <button class="vade-copy-pill-btn" style="padding: 0.25rem 0.5rem; font-size: 0.7rem;" onclick="window.Vademecum.copyIntervention('${i.id}', event)" title="Copiar pauta RF">
                        📋 Copiar
                      </button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </section>

        <!-- 📍 TABLA 2: MAPEO NIVEL POR NIVEL DE FACETAS (LUMBAR & CERVICAL) -->
        <section class="glass-panel table-card" style="margin-top: 0.75rem; border-color: rgba(99, 102, 241, 0.3);">
          <h4 style="margin: 0 0 0.5rem; font-size: 0.95rem; font-weight: 800; color: #a5b4fc; display: flex; align-items: center; gap: 0.4rem;">
            <span>📍</span> MAPEO CLÍNICO DE FACETAS: NÚMERO DE FACETA Y RAMOS MEDIALES A LESIONAR
          </h4>
          <p style="font-size: 0.75rem; color: var(--text-muted); margin: 0 0 0.75rem;">Cada articulación facetaria recibe doble inervación: ramo medial del mismo nivel y del nivel suprayacente (Dwyer / Aprill / Bogduk / Fukui).</p>
          
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 0.75rem;">
            <!-- Facetas Lumbares -->
            <div class="structure-box" style="background: var(--bg-surface); padding: 0.75rem;">
              <strong style="color: #60a5fa; font-size: 0.84rem; display: block; margin-bottom: 0.4rem;">🦴 Columna Lumbar (L1-L2 a L5-S1)</strong>
              <div class="table-responsive">
                <table class="clinical-table" style="font-size: 0.75rem;">
                  <thead>
                    <tr><th>Faceta</th><th>Ramos Mediales a Lesionar</th><th>Patrón de Dolor Clínico</th></tr>
                  </thead>
                  <tbody>
                    ${facetLumbar.map(l => `
                      <tr>
                        <td><strong style="color: var(--accent-blue);">${l.facet}</strong></td>
                        <td><span style="font-weight: 700; color: var(--text-primary);">${l.nerves}</span></td>
                        <td><span style="color: var(--text-secondary); font-size: 0.72rem;">${l.painPattern}</span></td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Facetas Cervicales -->
            <div class="structure-box" style="background: var(--bg-surface); padding: 0.75rem;">
              <strong style="color: #a5b4fc; font-size: 0.84rem; display: block; margin-bottom: 0.4rem;">🦴 Columna Cervical (C2-C3 a C7-T1)</strong>
              <div class="table-responsive">
                <table class="clinical-table" style="font-size: 0.75rem;">
                  <thead>
                    <tr><th>Faceta</th><th>Ramos Mediales a Lesionar</th><th>Patrón de Dolor Clínico</th></tr>
                  </thead>
                  <tbody>
                    ${facetCervical.map(l => `
                      <tr>
                        <td><strong style="color: var(--accent-blue);">${l.facet}</strong></td>
                        <td><span style="font-weight: 700; color: var(--text-primary);">${l.nerves}</span></td>
                        <td><span style="color: var(--text-secondary); font-size: 0.72rem;">${l.painPattern}</span></td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        <!-- 📍 TABLA 3: MAPEO DE GANGLIO DE LA RAÍZ DORSAL (DRG PRF) -->
        <section class="glass-panel table-card" style="margin-top: 0.75rem; border-color: rgba(245, 158, 11, 0.3);">
          <h4 style="margin: 0 0 0.5rem; font-size: 0.95rem; font-weight: 800; color: #f59e0b; display: flex; align-items: center; gap: 0.4rem;">
            <span>📍</span> GANGLIO DE LA RAÍZ DORSAL (DRG PRF 42°C / 240 s): NIVELES Y DERMATOMAS
          </h4>
          <p style="font-size: 0.75rem; color: var(--text-muted); margin: 0 0 0.75rem;">Radiofrecuencia Pulsada (PRF) estrictamente no ablativa en radiculopatía crónica refractaria (preserva motricidad).</p>
          
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 0.75rem;">
            <!-- DRG Lumbar -->
            <div class="structure-box" style="background: var(--bg-surface); padding: 0.75rem;">
              <strong style="color: #f59e0b; font-size: 0.84rem; display: block; margin-bottom: 0.4rem;">⚡ DRG Lumbosacro (L4, L5, S1)</strong>
              <div class="table-responsive">
                <table class="clinical-table" style="font-size: 0.75rem;">
                  <thead>
                    <tr><th>Raíz / Foramen</th><th>Dermatoma / Territorio</th><th>Dosis Fármaco Post-Pulso</th></tr>
                  </thead>
                  <tbody>
                    ${drgLumbar.map(l => `
                      <tr>
                        <td><strong style="color: #f59e0b;">${l.root}</strong><br><span style="font-size: 0.7rem; color: var(--text-muted);">${l.foramen}</span></td>
                        <td><span style="color: var(--text-secondary); font-size: 0.72rem;">${l.painPattern}</span></td>
                        <td><span style="color: #60a5fa; font-weight: 700; font-size: 0.72rem;">${l.dose || '—'}</span></td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </div>

            <!-- DRG Cervical -->
            <div class="structure-box" style="background: var(--bg-surface); padding: 0.75rem;">
              <strong style="color: #f59e0b; font-size: 0.84rem; display: block; margin-bottom: 0.4rem;">⚡ DRG Cervical (C5, C6, C7, C8)</strong>
              <div class="table-responsive">
                <table class="clinical-table" style="font-size: 0.75rem;">
                  <thead>
                    <tr><th>Raíz / Foramen</th><th>Dermatoma / Territorio</th><th>Dosis Fármaco Post-Pulso</th></tr>
                  </thead>
                  <tbody>
                    ${drgCervical.map(l => `
                      <tr>
                        <td><strong style="color: #f59e0b;">${l.root}</strong><br><span style="font-size: 0.7rem; color: var(--text-muted);">${l.foramen}</span></td>
                        <td><span style="color: var(--text-secondary); font-size: 0.72rem;">${l.painPattern}</span></td>
                        <td><span style="color: #60a5fa; font-weight: 700; font-size: 0.72rem;">${l.dose || '—'}</span></td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        <!-- Filtros por Categoría de Radiofrecuencia -->
        <div class="vade-category-toolbar" style="margin-top: 1rem;">
          <button class="vade-rf-chip ${(!this.activeRfCategory || this.activeRfCategory === 'all') ? 'active' : ''}" data-rf="all" onclick="window.Vademecum.setRfCategory('all')">🌐 Todos los Protocolos RF (${rfItems.length})</button>
          <button class="vade-rf-chip ${this.activeRfCategory === 'lumbar_sacro' ? 'active' : ''}" data-rf="lumbar_sacro" onclick="window.Vademecum.setRfCategory('lumbar_sacro')">⚡ Facetas Lumbares & Sacro</button>
          <button class="vade-rf-chip ${this.activeRfCategory === 'cervical_ton' ? 'active' : ''}" data-rf="cervical_ton" onclick="window.Vademecum.setRfCategory('cervical_ton')">⚡ Facetas Cervicales & TON</button>
          <button class="vade-rf-chip ${this.activeRfCategory === 'drg' ? 'active' : ''}" data-rf="drg" onclick="window.Vademecum.setRfCategory('drg')">⚡ Ganglio Raíz Dorsal (DRG PRF)</button>
          <button class="vade-rf-chip ${this.activeRfCategory === 'rodilla' ? 'active' : ''}" data-rf="rodilla" onclick="window.Vademecum.setRfCategory('rodilla')">🦵 Rodilla (Geniculados)</button>
          <button class="vade-rf-chip ${this.activeRfCategory === 'cadera' ? 'active' : ''}" data-rf="cadera" onclick="window.Vademecum.setRfCategory('cadera')">🦿 Cadera (Ramas Articulares)</button>
          <button class="vade-rf-chip ${this.activeRfCategory === 'hombro_periferico' ? 'active' : ''}" data-rf="hombro_periferico" onclick="window.Vademecum.setRfCategory('hombro_periferico')">🦴 Hombro & Arnold (PRF)</button>
        </div>

        <!-- Grid de Tarjetas Individuales -->
        <div class="vade-express-grid" style="margin-top: 0.75rem;">
          ${rfItems.map(inter => this.renderInterventionCard(inter)).join('')}
        </div>
      `;
    },
    
    renderInterventionsView(container) {
      let inters = (this.data.interventions || []).filter(i => 
        !i.id?.startsWith('rf-') && !i.id?.startsWith('prf-') && !(i.type && (i.type.includes('Radiofrecuencia') || i.type.includes('Térmica') || i.type.includes('Pulsada') || i.type.includes('Cooled')))
      );

      if (this.activeInterventionRegion && this.activeInterventionRegion !== 'all') {
        inters = inters.filter(i => {
          if (this.activeInterventionRegion === 'raquis') return i.category === 'raquis' || i.region === 'lumbar' || i.region === 'cervical';
          return i.region === this.activeInterventionRegion || i.category === this.activeInterventionRegion;
        });
      }

      const laRef = this.data.local_anesthetics_reference?.agents || [];
      const csRef = this.data.corticosteroids_injectable_reference?.agents || [];

      container.innerHTML = `
        <!-- HEADER INTERVENCIONISMO -->
        <section class="vade-five-doses-section" style="border-color: rgba(16, 185, 129, 0.4); background: linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(99, 102, 241, 0.04) 100%);">
          <div class="vade-section-header">
            <span style="font-size: 1.5rem;">💉</span>
            <div>
              <h3 style="font-size: 1.05rem; font-weight: 900; color: #10b981; margin: 0;">FÁRMACOS, DOSIS Y VOLÚMENES EN INFILTRACIONES Y RAQUIS</h3>
              <p style="font-size: 0.8rem; color: var(--text-secondary); margin: 0.2rem 0 0;">Tablas de Dosis Articulares y Espinales · Anestésicos Locales (Dosis Máximas LAST) · Corticoides (Particulados vs No Particulados)</p>
            </div>
          </div>

          <!-- Quick Reference Accordions: AL & Corticosteroids -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 0.75rem; margin-top: 0.75rem;">
            <!-- Local Anesthetics Reference -->
            <div class="structure-box" style="background: var(--bg-surface); border-color: rgba(59, 130, 246, 0.3);">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
                <strong style="font-size: 0.86rem; color: #60a5fa;">🧪 Anestésicos Locales (Dosis Máximas)</strong>
                <span style="font-size: 0.7rem; color: var(--text-muted);">Seguridad LAST</span>
              </div>
              <div style="display: flex; flex-direction: column; gap: 0.35rem; font-size: 0.75rem;">
                ${laRef.map(la => `
                  <div style="padding: 0.3rem 0.45rem; background: rgba(255, 255, 255, 0.02); border-radius: var(--radius-sm); border-left: 3px solid #60a5fa;">
                    <div style="display: flex; justify-content: space-between;">
                      <strong style="color: var(--text-primary);">${la.name} (${la.concentrations})</strong>
                      <span style="color: #f59e0b; font-weight: 700;">Máx: ${la.maxDosePlain}</span>
                    </div>
                    <div style="color: var(--text-secondary); font-size: 0.72rem;">Latencia: ${la.latency} · Duración: ${la.clinicalDuration}</div>
                  </div>
                `).join('')}
              </div>
            </div>

            <!-- Corticosteroids Injectable Reference -->
            <div class="structure-box" style="background: var(--bg-surface); border-color: rgba(239, 68, 68, 0.3);">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
                <strong style="font-size: 0.86rem; color: #f87171;">💊 Corticoides: Particulados vs No Particulados</strong>
                <span style="font-size: 0.7rem; color: #ef4444; font-weight: 700;">Regla Espinal</span>
              </div>
              <div style="display: flex; flex-direction: column; gap: 0.35rem; font-size: 0.75rem;">
                ${csRef.map(cs => `
                  <div style="padding: 0.3rem 0.45rem; background: rgba(255, 255, 255, 0.02); border-radius: var(--radius-sm); border-left: 3px solid ${cs.type.includes('NO PARTICULADO') ? '#10b981' : '#ef4444'};">
                    <div style="display: flex; justify-content: space-between; flex-wrap: wrap;">
                      <strong style="color: var(--text-primary);">${cs.name}</strong>
                      <span style="font-size: 0.7rem; font-weight: 700; color: ${cs.type.includes('NO PARTICULADO') ? '#10b981' : '#f87171'};">${cs.type}</span>
                    </div>
                    <div style="font-size: 0.72rem; color: var(--text-secondary); margin: 0.1rem 0;">Dosis habitual: <strong>${cs.usualDose}</strong></div>
                    <div style="font-size: 0.7rem; color: ${cs.spinalSafety.includes('PROHIBIDO') ? '#ef4444' : '#10b981'}; font-weight: 600;">${cs.spinalSafety}</div>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
        </section>

        <!-- 📊 TABLA RESUMEN DE DOSIS DE INFILTRACIONES -->
        <section class="glass-panel table-card" style="margin-top: 0.75rem; border-color: rgba(16, 185, 129, 0.3);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; flex-wrap: wrap; gap: 0.5rem;">
            <div>
              <h4 style="margin: 0; font-size: 0.95rem; font-weight: 800; color: #10b981; display: flex; align-items: center; gap: 0.4rem;">
                <span>📊</span> TABLA RESUMEN DE DOSIS Y VOLÚMENES (INFILTRACIONES & RAQUIS)
              </h4>
              <p style="margin: 0.2rem 0 0; font-size: 0.75rem; color: var(--text-muted);">Dosis recomendadas, volúmenes máximos y alertas de seguridad</p>
            </div>
            <span class="treatment-badge-pill green" style="font-size: 0.72rem;">28 Procedimientos Protocolizados</span>
          </div>

          <div class="table-responsive" style="max-height: 420px; overflow-y: auto;">
            <table class="clinical-table" style="font-size: 0.78rem;">
              <thead>
                <tr style="position: sticky; top: 0; background: var(--bg-surface); z-index: 2;">
                  <th style="min-width: 170px;">Procedimiento / Diana</th>
                  <th style="min-width: 150px;">💉 Anestésico Local (AL)</th>
                  <th style="min-width: 170px;">💊 Corticoide / Inyectable</th>
                  <th style="min-width: 85px;">Vol. Total</th>
                  <th style="min-width: 220px;">🛡️ Regla de Oro / Alerta Clave</th>
                  <th style="min-width: 80px; text-align: center;">Acción</th>
                </tr>
              </thead>
              <tbody>
                ${inters.map(i => `
                  <tr>
                    <td>
                      <strong style="color: var(--text-primary); display: block;">${i.name}</strong>
                      <span style="font-size: 0.7rem; color: var(--text-muted);">${(i.target || '').replace(/\n/g, ' ')}</span>
                    </td>
                    <td>
                      <span style="color: #60a5fa; font-weight: 700;">${i.localAnesthetic?.drug || '—'}</span>
                      <div style="font-size: 0.7rem; color: var(--text-secondary);">${i.localAnesthetic?.volume || ''} ${i.localAnesthetic?.dose ? '(' + i.localAnesthetic.dose + ')' : ''}</div>
                    </td>
                    <td>
                      <span style="color: ${(i.corticosteroid?.drug && (i.corticosteroid.drug.includes('PROHIBIDO') || i.corticosteroid.drug.includes('SIN CORTICOIDE'))) ? '#ef4444' : '#10b981'}; font-weight: 700;">${i.corticosteroid?.drug || '—'}</span>
                      <div style="font-size: 0.7rem; color: var(--text-secondary);">${i.corticosteroid?.dose || ''} ${i.corticosteroid?.volume ? '(' + i.corticosteroid.volume + ')' : ''}</div>
                    </td>
                    <td>
                      <span style="font-family: var(--font-mono); font-weight: 800; color: #f59e0b;">${i.totalVolume || '—'}</span>
                    </td>
                    <td>
                      <span style="font-size: 0.72rem; color: ${(i.safetyWarnings && i.safetyWarnings[0]?.includes('¡') || i.safetyWarnings && i.safetyWarnings[0]?.includes('PROHIBIDO')) ? '#f87171' : 'var(--text-secondary)'}; font-weight: ${(i.safetyWarnings && i.safetyWarnings[0]?.includes('¡')) ? '700' : 'normal'};">
                        ${(i.safetyWarnings && i.safetyWarnings.length > 0) ? i.safetyWarnings[0] : (i.indication || '—')}
                      </span>
                    </td>
                    <td style="text-align: center;">
                      <button class="vade-copy-pill-btn" style="padding: 0.25rem 0.5rem; font-size: 0.7rem;" onclick="window.Vademecum.copyIntervention('${i.id}', event)" title="Copiar pauta clínica">
                        📋 Copiar
                      </button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </section>

        <!-- Filtros por Región Anatómica -->
        <div class="vade-category-toolbar" style="margin-top: 1rem;">
          <button class="vade-inter-chip ${(!this.activeInterventionRegion || this.activeInterventionRegion === 'all') ? 'active' : ''}" data-reg="all" onclick="window.Vademecum.setInterventionRegion('all')">🌐 Todas las Infiltraciones (${inters.length})</button>
          <button class="vade-inter-chip ${this.activeInterventionRegion === 'raquis' ? 'active' : ''}" data-reg="raquis" onclick="window.Vademecum.setInterventionRegion('raquis')">⚡ Raquis & Epidurales</button>
          <button class="vade-inter-chip ${this.activeInterventionRegion === 'hombro' ? 'active' : ''}" data-reg="hombro" onclick="window.Vademecum.setInterventionRegion('hombro')">🦴 Hombro</button>
          <button class="vade-inter-chip ${this.activeInterventionRegion === 'rodilla' ? 'active' : ''}" data-reg="rodilla" onclick="window.Vademecum.setInterventionRegion('rodilla')">🦵 Rodilla</button>
          <button class="vade-inter-chip ${this.activeInterventionRegion === 'cadera' ? 'active' : ''}" data-reg="cadera" onclick="window.Vademecum.setInterventionRegion('cadera')">🦿 Cadera</button>
          <button class="vade-inter-chip ${this.activeInterventionRegion === 'codo' ? 'active' : ''}" data-reg="codo" onclick="window.Vademecum.setInterventionRegion('codo')">🦾 Codo</button>
          <button class="vade-inter-chip ${this.activeInterventionRegion === 'muneca_mano' ? 'active' : ''}" data-reg="muneca_mano" onclick="window.Vademecum.setInterventionRegion('muneca_mano')">🤲 Mano & Muñeca</button>
          <button class="vade-inter-chip ${this.activeInterventionRegion === 'tobillo_pie' ? 'active' : ''}" data-reg="tobillo_pie" onclick="window.Vademecum.setInterventionRegion('tobillo_pie')">🦶 Tobillo & Pie</button>
          <button class="vade-inter-chip ${this.activeInterventionRegion === 'sacroiliaca' ? 'active' : ''}" data-reg="sacroiliaca" onclick="window.Vademecum.setInterventionRegion('sacroiliaca')">🎯 Sacroilíaca</button>
        </div>

        <!-- Grid de Técnicas Intervencionistas -->
        <div class="vade-express-grid" style="margin-top: 0.75rem;">
          ${inters.map(inter => this.renderInterventionCard(inter)).join('')}
        </div>
      `;
    },

    renderInterventionCard(inter) {
      const isRF = inter.id?.startsWith('rf-') || inter.id?.startsWith('prf-') || (inter.type && (inter.type.includes('Radiofrecuencia') || inter.type.includes('Térmica') || inter.type.includes('Pulsada') || inter.type.includes('Cooled')));
      
      return `
        <article class="vade-express-card" id="inter-${inter.id}" style="border-left: 4px solid ${isRF ? '#6366f1' : '#10b981'};">
          <div class="vade-express-card-header">
            <div style="display: flex; align-items: center; gap: 0.6rem;">
              <span class="vade-card-icon">${isRF ? '⚡' : inter.category === 'raquis' || inter.region === 'lumbar' || inter.region === 'cervical' ? '💉' : '🩹'}</span>
              <div>
                <h3 class="vade-card-title">${inter.name}</h3>
                <span class="vade-card-category" style="color: ${isRF ? '#a5b4fc' : 'var(--text-muted)'};">${inter.type || inter.categoryLabel || inter.region}</span>
              </div>
            </div>
            ${inter.evidence?.badge ? `<span class="treatment-badge-pill ${inter.evidence.badge.includes('ALTA') ? 'green' : 'blue'}" style="font-size: 0.68rem;">${inter.evidence.badge}</span>` : ''}
          </div>

          <div class="vade-express-card-body">
            <!-- Indicación y Diana -->
            <div style="margin-bottom: 0.5rem;">
              <p style="font-size: 0.8rem; color: var(--text-secondary); margin: 0 0 0.25rem;"><strong>🎯 Diana:</strong> ${(inter.target || '').replace(/\n/g, '<br>')}</p>
              <p style="font-size: 0.78rem; color: var(--text-muted); margin: 0;"><strong>Indicación:</strong> ${inter.indication || ''}</p>
              ${inter.requiredDiagnosticTest ? `<p style="font-size: 0.76rem; color: #f59e0b; font-weight: 700; margin: 0.2rem 0 0;">🔍 Test previo: ${inter.requiredDiagnosticTest}</p>` : ''}
            </div>

            <!-- Facet Level Breakdown by Clinical Pattern (if available) -->
            ${inter.facetLevelMapping ? `
              <div style="background: rgba(99, 102, 241, 0.06); border: 1px solid rgba(99, 102, 241, 0.3); border-radius: var(--radius-sm); padding: 0.5rem 0.65rem; margin-bottom: 0.5rem;">
                <strong style="font-size: 0.8rem; color: #a5b4fc; display: block; margin-bottom: 0.2rem;">📍 Mapeo de Facetas y Dianas por Clínica:</strong>
                <p style="font-size: 0.72rem; color: var(--text-muted); margin: 0 0 0.35rem;">${inter.facetLevelMapping.rule}</p>
                <div style="display: flex; flex-direction: column; gap: 0.3rem; font-size: 0.74rem;">
                  ${inter.facetLevelMapping.levels.map(lvl => `
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
            ${inter.rootLevelMapping ? `
              <div style="background: rgba(245, 158, 11, 0.06); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: var(--radius-sm); padding: 0.5rem 0.65rem; margin-bottom: 0.5rem;">
                <strong style="font-size: 0.8rem; color: #f59e0b; display: block; margin-bottom: 0.2rem;">📍 Mapeo de Ganglio Raíz Dorsal (DRG) por Nivel / Clínica:</strong>
                <p style="font-size: 0.72rem; color: var(--text-muted); margin: 0 0 0.35rem;">${inter.rootLevelMapping.rule}</p>
                <div style="display: flex; flex-direction: column; gap: 0.3rem; font-size: 0.74rem;">
                  ${inter.rootLevelMapping.levels.map(lvl => `
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

            <!-- RF Parameters Box (if available) -->
            ${inter.parameters ? `
              <div style="background: rgba(99, 102, 241, 0.07); border: 1px solid rgba(99, 102, 241, 0.3); border-radius: var(--radius-sm); padding: 0.5rem 0.65rem; margin-bottom: 0.5rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.3rem;">
                  <strong style="font-size: 0.82rem; color: var(--accent-blue);">⚡ Parámetros de Radiofrecuencia:</strong>
                  <span style="font-size: 0.74rem; color: #a5b4fc; font-weight: 800;">${inter.parameters.temperature || ''} · ${inter.parameters.time || ''}</span>
                </div>
                <div class="pharma-spec-grid" style="font-size: 0.74rem;">
                  ${inter.parameters.cannula ? `<div class="pharma-spec-item"><strong>Cánula / Punta</strong><span>${inter.parameters.cannula}</span></div>` : ''}
                  ${inter.parameters.sensoryStimulation ? `<div class="pharma-spec-item"><strong style="color: #60a5fa;">Sensitiva (50 Hz)</strong><span>${inter.parameters.sensoryStimulation}</span></div>` : ''}
                  ${inter.parameters.motorStimulation ? `<div class="pharma-spec-item"><strong style="color: #f87171;">Motora (2 Hz)</strong><span>${inter.parameters.motorStimulation}</span></div>` : ''}
                </div>
              </div>
            ` : ''}

            <!-- Fármacos y Dosis Grid -->
            <div class="pharma-spec-grid" style="margin-bottom: 0.5rem;">
              ${inter.localAnesthetic ? `
                <div class="pharma-spec-item">
                  <strong style="color: #60a5fa;">💉 Anestésico Local (AL)</strong>
                  <span>${inter.localAnesthetic.drug || ''} · ${inter.localAnesthetic.volume || ''} ${inter.localAnesthetic.dose ? '(' + inter.localAnesthetic.dose + ')' : ''}</span>
                </div>
              ` : ''}
              ${inter.corticosteroid ? `
                <div class="pharma-spec-item">
                  <strong style="color: ${(inter.corticosteroid.drug && (inter.corticosteroid.drug.includes('PROHIBIDO') || inter.corticosteroid.drug.includes('SIN CORTICOIDE'))) ? '#ef4444' : '#10b981'};">💊 Corticoide / Inyectable</strong>
                  <span>${inter.corticosteroid.drug || ''} ${inter.corticosteroid.dose ? '· ' + inter.corticosteroid.dose : ''} ${inter.corticosteroid.volume ? '(' + inter.corticosteroid.volume + ')' : ''}</span>
                </div>
              ` : ''}
              ${inter.totalVolume ? `
                <div class="pharma-spec-item">
                  <strong style="color: #f59e0b;">📏 Volumen Total</strong>
                  <span>${inter.totalVolume}</span>
                </div>
              ` : ''}
            </div>

            <!-- Alertas de Seguridad -->
            ${(inter.safetyWarnings && inter.safetyWarnings.length > 0) ? `
              <div style="background: rgba(239, 68, 68, 0.06); border: 1px solid rgba(239, 68, 68, 0.25); border-radius: var(--radius-sm); padding: 0.4rem 0.6rem; margin-bottom: 0.5rem;">
                ${inter.safetyWarnings.map(w => `
                  <div style="font-size: 0.74rem; color: #ef4444; font-weight: 600; margin: 0.15rem 0;">⚠️ ${w}</div>
                `).join('')}
              </div>
            ` : ''}

            <!-- Botones de Acción -->
            <div class="vade-step-actions-bar" style="margin-top: 0.4rem;">
              <button class="vade-copy-pill-btn" onclick="window.Vademecum.copyIntervention('${inter.id}', event)">
                📋 Copiar Pauta Intervencionista
              </button>
            </div>
          </div>
        </article>
      `;
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

                ${matchingInterventions.length ? `
          <div style="margin-bottom: 2rem;">
            <h4 style="font-size: 0.95rem; font-weight: 800; color: #10b981; margin-bottom: 0.75rem;">💉 Procedimientos Intervencionistas Coincidentes</h4>
            <div class="vade-express-grid">
              ${matchingInterventions.map(inter => this.renderInterventionCard(inter)).join('')}
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

        ${matchingConditions.length === 0 && matchingDrugs.length === 0 && matchingInterventions.length === 0 ? `
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
      document.body.style.overflow = 'hidden';
    },

    closeInteractionsModal() {
      const modal = document.getElementById('vade-interactions-modal');
      if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('open');
      }
      document.body.style.overflow = '';
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
