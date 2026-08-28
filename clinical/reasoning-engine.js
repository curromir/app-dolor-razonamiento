/**
 * CLINICAL REASONING ENGINE
 * Motor determinista y auditable de razonamiento clínico
 * 
 * Responsabilidades:
 * - Evaluar banderas rojas
 * - Gestionar hipótesis dinámicas con scores de concordancia
 * - Procesar respuestas de anamnesis y hallazgos de exploración
 * - Evaluar concordancia clínico-ecográfica/imagen
 * - Generar diagnóstico de trabajo, plan terapéutico y resumen clínico
 * 
 * Principios:
 * - Determinista: toda decisión trazable a una regla del pathway JSON
 * - Auditable: cada recomendación tiene justificación visible
 * - Sin probabilidades epidemiológicas falsas: solo concordancia interna
 * - Separa diagnóstico estructural / generador probable / mecanismo
 * 
 * @author Dr. Curro Mir / Antigravity
 */

class ClinicalReasoningEngine {

  /**
   * @param {Object} pathway - Clinical pathway JSON data
   * @param {Object} testsCatalog - Full tests_catalog.json data (state.catalog)
   * @param {Object} treatmentsCatalog - Full treatments_catalog.json data
   * @param {Object} coachCatalog - Full coach_catalog.json data
   */
  constructor(pathway, testsCatalog, treatmentsCatalog, coachCatalog) {
    this.pathway = pathway;
    this.catalog = testsCatalog;
    this.treatmentsCatalog = treatmentsCatalog || (typeof window !== 'undefined' ? window.TREATMENTS_CATALOG : null);
    this.coachCatalog = coachCatalog || (typeof window !== 'undefined' ? window.COACH_CATALOG : null);

    // Session state
    this.session = {
      pathwayId: pathway.id,
      startedAt: new Date().toISOString(),

      // Red flags
      redFlagsChecked: false,
      redFlagResults: {},       // { flagId: true/false }
      hasActiveRedFlag: false,

      // Anamnesis
      answers: {},              // { questionId: answerIndex }
      functionalGoal: '',       // Free text from patient

      // Hypotheses — cloned from pathway with live scores
      hypotheses: pathway.hypotheses.map(h => ({
        ...h,
        score: h.score || 0,
        level: h.initialLevel || 'possible',
        history: []             // Array of { source, effect, weight, reason }
      })),

      // Examination
      examinationFindings: {},  // { stepId: resultValue }

      // Clusters
      clusterResults: {},       // { clusterId: { met: bool, positiveCount: n } }

      // Imaging / Ultrasound
      imagingFindings: {},      // { structureId: findingId } or { findingId: true }
      concordanceLevel: null,   // 'high', 'partial', 'discordant', null

      // Generator
      selectedGenerator: null,
      confidenceLevel: null,    // 'high', 'moderate', 'low'

      // Treatment selections
      treatmentSelections: {},

      // Follow-up
      followUpScheduled: false,

      // Meta
      expressMode: false,
      mentorMode: true,
      currentStep: 'red_flags', // 'red_flags','anamnesis','anamnesis_summary','examination','exam_summary','imaging','concordance','generator','treatment','follow_up','summary'
      completedSteps: []
    };
  }

  // ─────────────────────────────────────────────
  // STEP 0 — RED FLAGS
  // ─────────────────────────────────────────────

  getRedFlags() {
    return this.pathway.redFlags || [];
  }

  evaluateRedFlags(checkedFlags) {
    this.session.redFlagResults = { ...checkedFlags };
    this.session.redFlagsChecked = true;

    const activeFlags = this.getRedFlags().filter(rf => checkedFlags[rf.id] === true);
    this.session.hasActiveRedFlag = activeFlags.length > 0;

    const hasCritical = activeFlags.some(rf => rf.severity === 'critical');

    if (!this.session.hasActiveRedFlag) {
      this.session.currentStep = 'anamnesis';
      this._addCompletedStep('red_flags');
    }

    return {
      safe: !this.session.hasActiveRedFlag,
      hasCritical,
      flaggedItems: activeFlags,
      message: this.session.hasActiveRedFlag
        ? (hasCritical
          ? 'Bandera roja CRÍTICA detectada. Interrumpir algoritmo musculoesquelético y valorar derivación/estudio urgente.'
          : 'Posible bandera roja. Valorar estudio dirigido/derivación según contexto clínico antes de continuar.')
        : 'Sin señales de alarma evidentes. Continuar algoritmo musculoesquelético.'
    };
  }

  // ─────────────────────────────────────────────
  // STEP 1 — ANAMNESIS
  // ─────────────────────────────────────────────

  getQuestions() {
    return this.pathway.questions || [];
  }

  getEssentialQuestions() {
    return this.getQuestions().filter(q => q.essential === true);
  }

  getCurrentQuestion() {
    const questions = this.session.expressMode
      ? this.getEssentialQuestions()
      : this.getQuestions();

    // Find first unanswered question
    for (const q of questions) {
      if (this.session.answers[q.id] === undefined) {
        return q;
      }
    }
    return null; // All answered
  }

  selectNextBestQuestion() {
    return this.getCurrentQuestion();
  }

  recalculateAllHypotheses() {
    // Reset hypotheses to baseline definitions
    this.session.hypotheses = (this.pathway.hypotheses || []).map(h => ({
      id: h.id,
      name: h.name,
      shortName: h.shortName || h.name,
      description: h.description,
      initialLevel: h.initialLevel || 'possible',
      level: h.initialLevel || 'possible',
      score: h.score || 0,
      history: []
    }));

    // Replay Anamnesis Answers
    for (const [qId, ansIdx] of Object.entries(this.session.answers || {})) {
      const q = this.getQuestions().find(item => item.id === qId);
      if (q) {
        const answers = q.answers || q.options || [];
        const ans = answers[ansIdx];
        if (ans && ans.hypothesisEffects) {
          ans.hypothesisEffects.forEach(effect => {
            this._applyHypothesisEffect(effect, `anamnesis:${qId}`, ans.label);
          });
        }
      }
    }

    // Replay Examination Findings
    for (const [stepId, val] of Object.entries(this.session.examinationFindings || {})) {
      const step = this.getExaminationStep(stepId);
      if (step) {
        const resultObj = (step.results || []).find(r => r.value === val);
        if (resultObj && resultObj.hypothesisEffects) {
          resultObj.hypothesisEffects.forEach(effect => {
            this._applyHypothesisEffect(effect, `examination:${stepId}`, resultObj.label);
          });
        }
      }
    }

    this._recalculateHypothesisLevels();
  }

  processAnswer(questionId, answerIndex) {
    const question = this.getQuestions().find(q => q.id === questionId);
    if (!question) return;

    const answers = question.answers || question.options || [];
    const answer = answers[answerIndex];
    if (!answer) return;

    // Store answer
    this.session.answers[questionId] = answerIndex;

    // Handle functional goal (special question)
    if (question.isFunctionalGoal && answer.label) {
      this.session.functionalGoal = answer.label;
    }

    // Recalculate cleanly from scratch
    this.recalculateAllHypotheses();

    // Mark completed step if all questions answered
    if (!this.getCurrentQuestion()) {
      this._addCompletedStep('anamnesis');
    }

    return {
      hypotheses: this.getHypothesesRanked(),
      nextQuestion: this.getCurrentQuestion(),
      isComplete: !this.getCurrentQuestion()
    };
  }

  // ─────────────────────────────────────────────
  // HYPOTHESIS MANAGEMENT
  // ─────────────────────────────────────────────

  _applyHypothesisEffect(effect, source, reason) {
    const hyp = this.session.hypotheses.find(h => h.id === effect.hypothesisId);
    if (!hyp) return;

    const weight = effect.weight || 1;
    const delta = effect.effect === 'increase' ? weight
      : effect.effect === 'decrease' ? -weight
      : 0;

    hyp.score += delta;
    hyp.history.push({
      source,
      effect: effect.effect,
      weight,
      reason: reason || '',
      timestamp: new Date().toISOString()
    });
  }

  _recalculateHypothesisLevels() {
    const scores = this.session.hypotheses.map(h => h.score);
    const maxScore = Math.max(...scores);
    const minScore = Math.min(...scores);

    this.session.hypotheses.forEach(h => {
      if (h.score >= maxScore - 1 && h.score > 2) {
        h.level = 'very_compatible';
      } else if (h.score > 1) {
        h.level = 'compatible';
      } else if (h.score >= 0) {
        h.level = 'possible';
      } else if (h.score >= -2) {
        h.level = 'unlikely';
      } else {
        h.level = 'discordant';
      }
    });
  }

  getHypothesesRanked() {
    const levelOrder = {
      'very_compatible': 0,
      'compatible': 1,
      'possible': 2,
      'unlikely': 3,
      'discordant': 4
    };

    return [...this.session.hypotheses].sort((a, b) => {
      const levelDiff = levelOrder[a.level] - levelOrder[b.level];
      if (levelDiff !== 0) return levelDiff;
      return b.score - a.score;
    });
  }

  getHypothesisLevelLabel(level) {
    const labels = {
      'very_compatible': 'Muy compatible',
      'compatible': 'Compatible',
      'possible': 'Posible',
      'unlikely': 'Poco compatible',
      'discordant': 'Discordante'
    };
    return labels[level] || level;
  }

  getHypothesisLevelIcon(level) {
    const icons = {
      'very_compatible': '↑↑',
      'compatible': '↑',
      'possible': '↔',
      'unlikely': '↓',
      'discordant': '↓↓'
    };
    return icons[level] || '↔';
  }

  getHypothesisLevelColor(level) {
    const colors = {
      'very_compatible': 'var(--color-safe, #10b981)',
      'compatible': 'var(--color-safe, #10b981)',
      'possible': 'var(--color-uncertain, #f59e0b)',
      'unlikely': 'var(--color-alarm, #ef4444)',
      'discordant': 'var(--color-alarm, #ef4444)'
    };
    return colors[level] || 'var(--text-secondary)';
  }

  // ─────────────────────────────────────────────
  // ANAMNESIS SUMMARY
  // ─────────────────────────────────────────────

  getAnamnesisSummary() {
    const ranked = this.getHypothesesRanked();
    const mainHypotheses = ranked.filter(h => h.level === 'very_compatible' || h.level === 'compatible');
    const alternatives = ranked.filter(h => h.level === 'possible');
    const excluded = ranked.filter(h => h.level === 'unlikely' || h.level === 'discordant');

    // Build supporting data from answered questions
    const supportingData = [];
    Object.entries(this.session.answers).forEach(([qId, aIdx]) => {
      const q = this.getQuestions().find(qu => qu.id === qId);
      const answersList = q ? (q.answers || q.options || []) : [];
      if (answersList[aIdx]) {
        supportingData.push(answersList[aIdx].label || answersList[aIdx].text || String(answersList[aIdx]));
      }
    });

    return {
      pattern: this.pathway.presentation,
      region: this.pathway.regionLabel,
      supportingData,
      mainHypotheses,
      alternatives,
      excluded,
      functionalGoal: this.session.functionalGoal
    };
  }

  proceedToExamination() {
    this.session.currentStep = 'examination';
    this._addCompletedStep('anamnesis_summary');
  }

  // ─────────────────────────────────────────────
  // STEP 2 — EXAMINATION
  // ─────────────────────────────────────────────

  getExaminationSteps() {
    if (!this.pathway.examination) return [];
    const steps = this.pathway.examination.steps || [];
    if (this.session.expressMode) {
      return steps.filter(s => s.essential === true);
    }
    return steps;
  }

  getExaminationStep(stepId) {
    return (this.pathway.examination?.steps || []).find(s => s.id === stepId);
  }

  /**
   * Get the full test object from the catalog for a given examination step
   * @param {string} catalogTestId - ID from the tests catalog (e.g., "hombro-jobe")
   * @returns {Object|null} Full test object with videos, procedure, etc.
   */
  getCatalogTest(catalogTestId) {
    if (!catalogTestId || !this.catalog) return null;
    const tests = this.catalog.tests || [];
    return tests.find(t => t.id === catalogTestId) || null;
  }

  getCurrentExaminationStep() {
    const steps = this.getExaminationSteps();
    for (const step of steps) {
      if (this.session.examinationFindings[step.id] === undefined) {
        return step;
      }
    }
    return null;
  }

  processExaminationFinding(stepId, resultValue) {
    const step = this.getExaminationStep(stepId);
    if (!step) return;

    this.session.examinationFindings[stepId] = resultValue;

    // Find the result object to get hypothesis effects
    const resultObj = (step.results || []).find(r => r.value === resultValue);
    if (resultObj && resultObj.hypothesisEffects) {
      resultObj.hypothesisEffects.forEach(effect => {
        this._applyHypothesisEffect(effect, `examination:${stepId}`, resultObj.label);
      });
    }

    this._recalculateHypothesisLevels();

    // Check if examination is complete
    if (!this.getCurrentExaminationStep()) {
      this.session.currentStep = 'exam_summary';
      this._addCompletedStep('examination');
    }

    return {
      hypotheses: this.getHypothesesRanked(),
      nextStep: this.getCurrentExaminationStep(),
      isComplete: !this.getCurrentExaminationStep()
    };
  }

  // ─────────────────────────────────────────────
  // CLUSTER EVALUATION
  // ─────────────────────────────────────────────

  evaluateCluster(clusterId) {
    const cluster = (this.pathway.clusters || []).find(c => c.id === clusterId);
    if (!cluster) return null;

    const requiredTests = cluster.requiredTests || [];
    let positiveCount = 0;
    let totalEvaluated = 0;

    requiredTests.forEach(testId => {
      const finding = this.session.examinationFindings[testId];
      if (finding !== undefined) {
        totalEvaluated++;
        // Consider 'positive', 'pain', 'pain_and_weakness' as positive for cluster
        if (finding === 'positive' || finding === 'pain' || finding === 'pain_and_weakness' ||
            (typeof finding === 'string' && finding.startsWith('positive'))) {
          positiveCount++;
        }
      }
    });

    const threshold = cluster.threshold || Math.ceil(requiredTests.length / 2);
    const met = positiveCount >= threshold;

    const previouslyApplied = this.session.clusterResults[clusterId]?.bonusApplied === true;
    this.session.clusterResults[clusterId] = { met, positiveCount, totalEvaluated, threshold, bonusApplied: previouslyApplied };

    // Apply cluster effect to hypotheses if met — only once (idempotency guard)
    if (met && !previouslyApplied) {
      this.session.clusterResults[clusterId].bonusApplied = true;
      this.session.hypotheses.forEach(h => {
        if (h.level === 'very_compatible' || h.level === 'compatible') {
          h.score += 2;
          h.history.push({
            source: `cluster:${clusterId}`,
            effect: 'increase',
            weight: 2,
            reason: `Clúster ${cluster.name || cluster.label} concordante (${positiveCount}/${requiredTests.length})`,
            timestamp: new Date().toISOString()
          });
        }
      });
      this._recalculateHypothesisLevels();
    }

    return {
      cluster,
      met,
      positiveCount,
      totalEvaluated,
      totalRequired: requiredTests.length,
      threshold,
      concordanceText: met ? cluster.concordanceText : null,
      evidenceNote: cluster.evidenceNote
    };
  }

  // ─────────────────────────────────────────────
  // EXAMINATION SUMMARY (CONCORDANCE MAP)
  // ─────────────────────────────────────────────

  getExaminationSummary() {
    const ranked = this.getHypothesesRanked();

    // Evaluate all clusters
    const clusterResults = (this.pathway.clusters || []).map(c => this.evaluateCluster(c.id));

    // Build concordance map
    const concordanceMap = ranked.map(h => {
      let concordanceLevel;
      if (h.level === 'very_compatible') concordanceLevel = 'very_concordant';
      else if (h.level === 'compatible') concordanceLevel = 'possible';
      else if (h.level === 'possible') concordanceLevel = 'possible';
      else if (h.level === 'unlikely') concordanceLevel = 'unsupported';
      else concordanceLevel = 'requires_exclusion';

      return {
        hypothesis: h,
        concordanceLevel,
        icon: concordanceLevel === 'very_concordant' ? '🟢'
          : concordanceLevel === 'possible' ? '🟡'
          : concordanceLevel === 'unsupported' ? '⚪'
          : '🔵'
      };
    });

    return {
      concordanceMap,
      clusterResults,
      recommendedImaging: this._recommendImaging()
    };
  }

  _recommendImaging() {
    const topHypotheses = this.getHypothesesRanked().filter(h =>
      h.level === 'very_compatible' || h.level === 'compatible'
    );

    if (this.pathway.ultrasound) {
      return { type: 'ultrasound', label: 'Ecografía dirigida' };
    }
    if (this.pathway.imaging) {
      return { type: 'imaging', label: this.pathway.imaging.type || 'Imagen radiológica' };
    }
    return { type: 'none', label: 'No necesita imagen inicialmente' };
  }

  proceedToImaging() {
    this.session.currentStep = 'imaging';
    this._addCompletedStep('exam_summary');
  }

  // ─────────────────────────────────────────────
  // STEP 4 — IMAGING / ULTRASOUND
  // ─────────────────────────────────────────────

  getImagingProtocol() {
    return this.pathway.ultrasound || this.pathway.imaging || null;
  }

  getImagingStructures() {
    const protocol = this.getImagingProtocol();
    if (!protocol) return [];

    // For ultrasound-type protocols
    if (protocol.structures) return protocol.structures;

    // For MRI/imaging-type protocols with flat findings
    if (protocol.findings) {
      return [{
        id: 'imaging-main',
        name: protocol.type || 'Imagen',
        priority: 1,
        findings: protocol.findings
      }];
    }

    return [];
  }

  processImagingFinding(structureId, findingId) {
    this.session.imagingFindings[structureId] = findingId;

    // Evaluate concordance based on findings
    this._evaluateImagingConcordance();

    return {
      concordanceLevel: this.session.concordanceLevel,
      allFindings: this.session.imagingFindings
    };
  }

  _evaluateImagingConcordance() {
    const protocol = this.getImagingProtocol();
    if (!protocol) return;

    const structures = this.getImagingStructures();
    let concordantCount = 0;
    let discordantCount = 0;
    let totalFindings = 0;

    structures.forEach(structure => {
      const selectedFindingId = this.session.imagingFindings[structure.id];
      if (!selectedFindingId) return;

      totalFindings++;
      const finding = (structure.findings || []).find(f => f.id === selectedFindingId);
      if (!finding) return;

      if (finding.concordanceEffect === 'concordant') concordantCount++;
      else if (finding.concordanceEffect === 'discordant') discordantCount++;
    });

    if (totalFindings === 0) {
      this.session.concordanceLevel = null;
    } else if (concordantCount > 0 && discordantCount === 0) {
      this.session.concordanceLevel = 'high';
    } else if (concordantCount > 0 && discordantCount > 0) {
      this.session.concordanceLevel = 'partial';
    } else if (discordantCount > 0 && concordantCount === 0) {
      this.session.concordanceLevel = 'discordant';
    } else {
      this.session.concordanceLevel = 'partial';
    }
  }

  getConcordanceAssessment() {
    const protocol = this.getImagingProtocol();
    if (!protocol || !protocol.concordanceAssessment) return null;

    const level = this.session.concordanceLevel || 'partial';
    return protocol.concordanceAssessment[level] || null;
  }

  generateImagingReport() {
    const structures = this.getImagingStructures();
    const lines = [];

    structures.forEach(structure => {
      const selectedFindingId = this.session.imagingFindings[structure.id];
      if (!selectedFindingId) return;

      const finding = (structure.findings || []).find(f => f.id === selectedFindingId);
      if (!finding) return;

      if (structure.reportTemplate) {
        lines.push(structure.reportTemplate.replace('{finding}', finding.label));
      } else {
        lines.push(`${structure.name}: ${finding.label}.`);
      }
    });

    return lines.join('\n');
  }

  proceedToGenerator() {
    this.session.currentStep = 'generator';
    this._addCompletedStep('imaging');
  }

  skipImaging() {
    this.session.currentStep = 'generator';
    this._addCompletedStep('imaging');
  }

  // ─────────────────────────────────────────────
  // STEP 5 — PAIN GENERATOR
  // ─────────────────────────────────────────────

  generateWorkingDiagnosis() {
    const ranked = this.getHypothesesRanked();
    const topHypothesis = ranked[0];

    // Find matching generator from pathway
    const generators = this.pathway.generators || [];
    let selectedGenerator = generators.find(g =>
      g.requiredHypothesisLevel &&
      (topHypothesis.level === 'very_compatible' || topHypothesis.level === 'compatible')
    ) || generators[0] || null;

    // Calculate confidence based on concordance scoring
    const confidenceScore = this._calculateConfidenceScore();

    this.session.selectedGenerator = selectedGenerator;
    this.session.confidenceLevel = confidenceScore >= 6 ? 'high'
      : confidenceScore >= 3 ? 'moderate'
      : 'low';

    // Collect supporting and discordant findings
    const supportingFindings = [];
    const discordantFindings = [];

    this.session.hypotheses.forEach(h => {
      h.history.forEach(entry => {
        if (entry.effect === 'increase' && h.id === topHypothesis.id) {
          supportingFindings.push(entry.reason);
        }
      });
    });

    // Check for discordant findings
    ranked.filter(h => h.level === 'possible' || h.level === 'compatible').forEach(h => {
      if (h.id !== topHypothesis.id) {
        discordantFindings.push(`Alternativa no excluida: ${h.name}`);
      }
    });

    return {
      generator: selectedGenerator,
      topHypothesis,
      confidenceLevel: this.session.confidenceLevel,
      confidenceLabel: this.session.confidenceLevel === 'high' ? 'Alta'
        : this.session.confidenceLevel === 'moderate' ? 'Moderada' : 'Baja',
      concordanceLevel: this.session.concordanceLevel,
      supportingFindings: [...new Set(supportingFindings)],
      discordantFindings,
      alternatives: ranked.filter(h => h.id !== topHypothesis.id && h.level !== 'discordant')
    };
  }

  _calculateConfidenceScore() {
    let score = 0;

    // Anamnesis compatible: +1
    const answeredCount = Object.keys(this.session.answers).length;
    if (answeredCount > 0) score += 1;

    // Localization compatible: +1
    const q1Answer = this.session.answers['q1'];
    if (q1Answer !== undefined) score += 1;

    // Examination compatible: +2
    const examFindings = Object.keys(this.session.examinationFindings).length;
    if (examFindings >= 3) score += 2;
    else if (examFindings >= 1) score += 1;

    // Cluster compatible: +2
    const clusterMet = Object.values(this.session.clusterResults).some(c => c.met);
    if (clusterMet) score += 2;

    // Imaging compatible: +1
    if (this.session.concordanceLevel === 'high') score += 1;
    else if (this.session.concordanceLevel === 'discordant') score -= 2;

    // Neurological compatible (for radicular pathways): +2
    const neuroSteps = (this.pathway.examination?.steps || []).filter(s =>
      s.category === 'neurologia' || s.category === 'neurodinamica' || s.category === 'reflejos'
    );
    const positiveNeuro = neuroSteps.filter(s => {
      const f = this.session.examinationFindings[s.id];
      return f && f !== 'negative' && f !== 'normal';
    });
    if (positiveNeuro.length >= 2) score += 2;
    else if (positiveNeuro.length >= 1) score += 1;

    return score;
  }

  proceedToTreatment() {
    this.session.currentStep = 'treatment';
    this._addCompletedStep('generator');
  }

  // ─────────────────────────────────────────────
  // STEP 6 — ADVANCED THERAPEUTIC MODULE 2.0
  // ─────────────────────────────────────────────

  /**
   * Generates a comprehensive, personalized 8-step therapeutic plan
   * based on the identified generator, concordance level, and patient comorbidities.
   * 
   * @param {Object} patientProfile - Optional comorbidity flags:
   *   { renal: bool, hepatic: bool, cv: bool, hta: bool, gi_ulcer: bool, diabetes: bool, anticoagulated: bool, age_over_65: bool, pregnant: bool, prior_injections: int }
   */
  getTreatmentPlan(patientProfile = {}) {
    const treatment = this.pathway.treatment || {};
    const pathwayId = this.pathway.id;
    const ranked = this.getHypothesesRanked();
    const topHyp = ranked[0] || {};
    const concordance = this.session.concordanceLevel || 'neutral';
    const isInterventionSafe = (concordance === 'high' || concordance === 'partial') && !this.session.hasActiveRedFlag;

    // Load master treatments catalog if available
    const catalog = this.treatmentsCatalog || (typeof window !== 'undefined' ? window.TREATMENTS_CATALOG : null) || {};

    // ─────────────────────────────────────────
    // 1. EDUCACIÓN TERAPÉUTICA
    // ─────────────────────────────────────────
    const education = {
      id: 'step-1-education',
      title: '1. Educación Terapéutica al Paciente',
      badge: '🟢 EVIDENCIA ALTA / PILAR ESENCIAL',
      patientText: treatment.education?.patientText || 'Explicar el origen mecano-biológico del dolor, desmitificar falsas creencias de "desgaste irreversible", asegurar que el movimiento adaptado es seguro y promover la autoeficacia.',
      mentorNote: treatment.education?.mentorNote || 'La educación reduce el catastrofismo y la kinesiofobia, optimizando la respuesta a la rehabilitación activa.',
      whyThisTreatment: 'Aumenta la comprensión del proceso, reduce la hipervigilancia nociceptiva y mejora la adherencia al tratamiento activo.',
      whenToAvoid: 'Nunca omitir. Es el pilar inicial innegociable en todo paciente con dolor.'
    };

    // ─────────────────────────────────────────
    // 2. ACTIVIDAD Y MODIFICACIÓN DE CARGA
    // ─────────────────────────────────────────
    const loadManagement = {
      id: 'step-2-load-management',
      title: '2. Actividad y Modificación de Carga',
      badge: '🟢 PRIMERA LÍNEA',
      principles: [
        'Evitar el reposo absoluto en cama (>24-48h desaconsejado: acelera atrofia muscular y cronifica el dolor)',
        'Principio de carga relativa: Reducir temporalmente picos de sobrecarga deportiva o laboral manteniendo actividad submáxima tolerable',
        'Regla del dolor tolerable: El dolor durante la actividad debe ser ≤3-4/10 y regresar al estado basal en menos de 24 horas'
      ],
      whyThisTreatment: 'La sobrecarga lesiona el tejido, pero el desuso lo debilita. La modulación de carga mantiene la homeostasis tisular.',
      whenToAvoid: 'Evitar inmovilizaciones rígidas prolongadas salvo fracturas agudas o roturas tendinosas quirúrgicas recientes.'
    };

    // ─────────────────────────────────────────
    // 3. EJERCICIO TERAPÉUTICO (DOSIS DE CARGA)
    // ─────────────────────────────────────────
    const exercise = {
      id: 'step-3-exercise',
      title: '3. Ejercicio Terapéutico Activo (Dosis de Carga)',
      badge: '🟢 EVIDENCIA ALTA / RECUPERACIÓN FUNCIONAL',
      objective: treatment.exercise?.objective || 'Aumentar la capacidad de carga del tejido, restaurar fuerza, control motor y movilidad funcional.',
      phases: treatment.exercise?.phases || [
        { name: 'Fase 1: Isometría / Analgesia', description: 'Contracciones isométricas submáximas en posiciones sin dolor (5 reps de 30-45s) para inhibición cortical del dolor.', duration: '1-2 semanas' },
        { name: 'Fase 2: Isotónicos Conc-Excéntricos', description: 'Carga progresiva con rangos completos de movimiento y control excéntrico lento.', duration: '2-6 semanas' },
        { name: 'Fase 3: Carga Funcional y Retorno', description: 'Reintegración a demandas laborales y deportivas específicas con ejercicios de cadena cinética.', duration: '6-12 semanas' }
      ],
      loadGuidance: treatment.exercise?.loadGuidance || 'La dosis importante es la dosis de carga. Monitorizar respuesta a las 24 horas.',
      whyThisTreatment: 'El ejercicio activo es el único estímulo mecano-transductor capaz de regenerar y remodelar la matriz extracelular a largo plazo.',
      whenToAvoid: 'No realizar ejercicios resistidos de alta intensidad ante sospecha de rotura aguda completa o fractura por estrés.'
    };

    // ─────────────────────────────────────────
    // 4. PLAN DE FISIOTERAPIA SUPERVISADA
    // ─────────────────────────────────────────
    let physioProtocol = null;
    if (pathwayId.includes('shoulder')) physioProtocol = catalog.physiotherapy_protocols?.shoulder_rotator_cuff;
    else if (pathwayId.includes('lumbar') || pathwayId.includes('cervical')) physioProtocol = catalog.physiotherapy_protocols?.lumbar_motor_control;
    else if (pathwayId.includes('plantar')) physioProtocol = catalog.physiotherapy_protocols?.plantar_fascia_load;

    const physiotherapy = {
      id: 'step-4-physiotherapy',
      title: '4. Plan de Fisioterapia Supervisada y Domiciliaria',
      badge: '🟢 EVIDENCIA ALTA / PROGRAMA ESTRUCTURADO',
      protocolName: physioProtocol ? physioProtocol.name : 'Programa de Fisioterapia Activa y Ejercicio Guiado',
      supervisedSessions: physioProtocol ? physioProtocol.supervisedSessions : {
        number: 'Programa individualizado de 6 a 12 semanas (habitualmente 1 sesión semanal o quincenal de supervisión/progresión)',
        frequency: '1 sesión/semana inicialmente, espaciando a quincenal según autonomía',
        durationWeeks: '6 - 12 semanas'
      },
      homeExercise: physioProtocol ? physioProtocol.homeExercise : {
        frequency: '3 a 5 días por semana (20-30 min/sesión)',
        exercises: ['Movilidad activa', 'Fortalecimiento específico', 'Control postural']
      },
      progressionCriteria: physioProtocol ? physioProtocol.progressionCriteria : [
        'Dolor durante la sesión ≤3-4/10 que cede en <24 horas',
        'Mejora demostrable en fuerza o rango articular sin compensaciones'
      ],
      loadManagement: physioProtocol ? physioProtocol.loadManagement : ['Evitar sobrecargas lesivas; mantener actividad general'],
      reassessment: physioProtocol ? physioProtocol.reassessment : 'Reevaluar a las 6 semanas con escala funcional.',
      whyThisTreatment: 'El fisioterapeuta educa, prescribe, corrige, progresa y monitoriza la dosis de carga. El paciente debe realizar actividad activa entre sesiones.',
      whenToAvoid: 'El número de sesiones pasivas NO es el tratamiento. Evitar terapias puramente pasivas (electroterapia, masaje aislado) como única intervención.'
    };

    // ─────────────────────────────────────────
    // 5. FARMACOLOGÍA CON DOSIFICACIÓN CONTEXTUALIZADA
    // ─────────────────────────────────────────
    const pharmaOptions = [];
    const meds = catalog.medications || {};

    // Check Paracetamol
    if (meds.paracetamol) {
      const pMed = { ...meds.paracetamol };
      const warnings = [];
      if (patientProfile.hepatic) {
        warnings.push('⚠️ Hepatopatía: Dosis máxima reducida a 2 g/día (contraindicado en insuficiencia grave).');
        pMed.maximumDose = '2 g / 24 h';
      }
      if (patientProfile.age_over_65) {
        warnings.push('👴 Paciente >65 años: Limitar a 2-3 g/día para prevenir acumulación.');
      }
      pMed.activeWarnings = warnings;
      pharmaOptions.push(pMed);
    }

    // Check Topical NSAID
    if (meds.nsaid_topical && (pathwayId.includes('knee') || pathwayId.includes('wrist') || pathwayId.includes('ankle') || pathwayId.includes('elbow'))) {
      const topMed = { ...meds.nsaid_topical };
      pharmaOptions.push(topMed);
    }

    // Check Oral NSAIDs (Ibuprofen / Naproxen)
    const nsaidOral = meds.ibuprofen ? { ...meds.ibuprofen } : null;
    if (nsaidOral) {
      const nsaidWarnings = [];
      let isNsaidContraindicated = false;

      if (patientProfile.renal) {
        nsaidWarnings.push('🚫 INSUFICIENCIA RENAL: Los AINEs orales están contraindicados o desaconsejados (riesgo de fallo renal agudo e hiperpotasemia).');
        isNsaidContraindicated = true;
      }
      if (patientProfile.gi_ulcer) {
        nsaidWarnings.push('🚫 ANTECEDENTE DE ÚLCERA / SANGRADO DIGESTIVO: Evitar AINEs orales; si imprescindibles asociar siempre IBP a dosis plenas.');
        isNsaidContraindicated = true;
      }
      if (patientProfile.anticoagulated) {
        nsaidWarnings.push('🚫 ANTICOAGULACIÓN (Sintrom / DOACs): Riesgo hemorrágico severo. Evitar AINEs orales y preferir Paracetamol o AINE tópico.');
        isNsaidContraindicated = true;
      }
      if (patientProfile.cv || patientProfile.hta) {
        nsaidWarnings.push('⚠️ RIESGO CARDIOVASCULAR / HTA: Precaución con AINEs orales por retención hidrosalina y elevación de PA (preferir Naproxeno si imprescindible).');
      }
      if (patientProfile.age_over_65) {
        nsaidWarnings.push('👴 >65 años: Asociar obligatoriamente IBP y limitar duración a ≤5-7 días.');
      }

      nsaidOral.isContraindicated = isNsaidContraindicated;
      nsaidOral.activeWarnings = nsaidWarnings;
      pharmaOptions.push(nsaidOral);
    }

    // Check Oral Corticosteroid for Radicular Sciatica (Goldberg Trial Evidence)
    const isRadicular = pathwayId.includes('radicular');
    const isNociplastic = pathwayId.includes('nociplastic');

    if (isRadicular && meds.prednisone_oral) {
      const pred = { ...meds.prednisone_oral };
      const predWarnings = [];
      if (patientProfile.diabetes) predWarnings.push('⚠️ Diabetes: Riesgo de picos hiperglucémicos agudos severos; monitorizar glucemia capilar.');
      if (patientProfile.hta) predWarnings.push('⚠️ HTA: Riesgo de descompensación tensional por retención hidrosalina.');
      if (patientProfile.gi_ulcer) predWarnings.push('🚫 Antecedente de úlcera digestiva: Asociar obligatoriamente IBP a dosis plenas.');
      pred.activeWarnings = predWarnings;
      pharmaOptions.push(pred);
    }

    // ─────────────────────────────────────────
    // 🧠 NEUROMODULACIÓN FARMACOLÓGICA ESTRUCTURADA
    // ─────────────────────────────────────────
    const neuromodulationDrugs = [];
    const neuroKeys = ['duloxetine', 'venlafaxine_xr', 'amitriptyline', 'pregabalin', 'gabapentin'];

    neuroKeys.forEach(k => {
      if (meds[k]) {
        const drug = { ...meds[k] };
        const drugWarnings = [];

        // Apply Comorbidity Rules
        if (drug.id === 'med-duloxetine') {
          if (patientProfile.hepatic) drugWarnings.push('🚫 Contraindicada en hepatopatía activa o insuficiencia hepática.');
          if (patientProfile.renal) drugWarnings.push('🚫 Contraindicada en insuficiencia renal severa (ClCr <30 ml/min).');
          if (patientProfile.hta || patientProfile.cv) drugWarnings.push('⚠️ Monitorizar TA por efecto noradrenérgico.');
        } else if (drug.id === 'med-venlafaxine-xr') {
          if (patientProfile.hta || patientProfile.cv) drugWarnings.push('⚠️ Control estricto de TA (elevación tensional dosis-dependiente).');
          if (patientProfile.renal) drugWarnings.push('⚠️ Ajustar dosis (reducir 25-50% si FG <60).');
        } else if (drug.id === 'med-amitriptyline') {
          if (patientProfile.age_over_65) drugWarnings.push('👴 >65 años: Iniciar a 10 mg/noche; alto riesgo anticolinérgico (sedación, caídas, estreñimiento, retención urinaria).');
          if (patientProfile.cv) drugWarnings.push('⚠️ Precaución en cardiopatía (riesgo de hipotensión ortostática y arritmias/QT).');
        } else if (drug.id === 'med-pregabalin' || drug.id === 'med-gabapentin') {
          if (patientProfile.renal) drugWarnings.push('⚠️ AJUSTE RENAL OBLIGATORIO: Eliminación 100% renal inalterada; reducir dosis según FG.');
          if (patientProfile.age_over_65) drugWarnings.push('👴 >65 años: Alto riesgo de sedación matutina, ataxia y caídas; iniciar a dosis mínimas.');
        }

        // Apply CONDITION-SPECIFIC OVERRIDE ENGINE
        if (isRadicular) {
          if (drug.id === 'med-pregabalin' || drug.id === 'med-gabapentin') {
            drug.isRoutinelyRecommended = false;
            drug.overrideBadge = '🔴 NO USO RUTINARIO EN CIÁTICA (NICE NG59 / ACP)';
            drug.overrideReason = 'NICE y guías internacionales desaconsejan gabapentinoides de rutina en ciática común por balance beneficio/riesgo desfavorable. Reservar como opción excepcional para dolor urente continuo refractario.';
          } else {
            drug.isRoutinelyRecommended = true;
            drug.overrideBadge = '🔵 MODULACIÓN EN DOLOR REFRACTARIO';
          }
        } else if (isNociplastic) {
          if (drug.id === 'med-duloxetine') {
            drug.isRoutinelyRecommended = true;
            drug.overrideBadge = '🟢 OPCIÓN PREFERENTE / RESPALDADA (NICE: 30mg → 60mg/d)';
          } else if (drug.id === 'med-amitriptyline') {
            drug.isRoutinelyRecommended = true;
            drug.overrideBadge = '🟢/🟡 ALTERNATIVA DE ELECCIÓN SI INSOMNIO (10-25mg noche)';
          } else if (drug.id === 'med-venlafaxine-xr') {
            drug.isRoutinelyRecommended = true;
            drug.overrideBadge = '🟡 ALTERNATIVA INDIVIDUALIZADA (No equivalente de rutina a duloxetina en fibromialgia)';
          } else {
            drug.isRoutinelyRecommended = true;
            drug.overrideBadge = '🟡 SEGUNDA LÍNEA';
          }
        } else {
          // General Neuropathic Pain
          drug.isRoutinelyRecommended = true;
          drug.overrideBadge = '🟢 PRIMERA LÍNEA EN DOLOR NEUROPÁTICO (NeuPSIG 2025)';
        }

        drug.activeWarnings = drugWarnings;
        neuromodulationDrugs.push(drug);
      }
    });

    const neuromodulationCard = {
      id: 'pharma-neuromodulation-card',
      title: '🧠 Neuromodulación Farmacológica (NeuPSIG 2025 / NICE)',
      principle: catalog.neuromodulation_principle || 'La dosis objetivo no es la dosis máxima. Es la menor dosis que proporciona una mejoría clínicamente útil con tolerabilidad aceptable.',
      safetyChecklist: catalog.neuromodulation_safety_checklist || [
        'Función renal', 'Función hepática', 'Edad/Fragilidad', 'Riesgo de caídas', 'Somnolencia', 'Conducción', 'HTA', 'Interacciones serotoninérgicas', 'Antecedentes psiquiátricos', 'Retirada progresiva'
      ],
      drugs: neuromodulationDrugs
    };

    const pharmacology = {
      id: 'step-5-pharmacology',
      title: '5. Farmacología Contextualizada y Dosificación',
      badge: '💊 DOSIFICACIÓN ADULTA ORIENTATIVA',
      generalAdvice: 'La selección farmacológica depende de las comorbilidades del paciente. Usar la menor dosis eficaz durante el menor tiempo posible. No existen recetas universales.',
      options: pharmaOptions,
      neuromodulation: neuromodulationCard,
      whyThisTreatment: 'Control sintomático del dolor para posibilitar el descanso y la adherencia al programa de rehabilitación activa.',
      whenToAvoid: 'No prescribir AINEs orales de forma continuada en ancianos o en insuficiencia renal. No pautar gabapentinoides por automatismo en ciática o dolor puramente axial.'
    };

    // ─────────────────────────────────────────
    // 6. TERAPIAS FÍSICAS ESPECÍFICAS (ESWT / EMTT)
    // ─────────────────────────────────────────
    let eswtOption = null;
    let emttOption = null;

    // Check ESWT indication
    if (pathwayId.includes('shoulder')) {
      const isCalcific = topHyp.id?.includes('calcific') || JSON.stringify(this.session.imagingFindings).includes('calcification');
      if (isCalcific && catalog.eswt_protocols?.calcific_shoulder) {
        eswtOption = {
          ...catalog.eswt_protocols.calcific_shoulder,
          badge: '🟢 EVIDENCIA ALTA / NIVEL I EN CALCIFICACIONES'
        };
      } else {
        eswtOption = {
          name: 'Ondas de Choque en Manguito No Calcificante',
          type: 'No recomendada de rutina',
          statusNote: '🔴 NO RECOMENDADA DE RUTINA: En tendinopatía no calcificante del supraespinoso la evidencia actual no respalda el uso rutinario de ondas de choque.',
          whyThisTreatment: 'Solo indicada cuando existe depósito cálcico visible en fase formativa/reabsortiva sintomática.',
          whenToAvoid: 'Evitar en tendinopatías puramente mecánicas no calcificantes donde la carga progresiva es el tratamiento de elección.'
        };
      }
    } else if (pathwayId.includes('plantar') && catalog.eswt_protocols?.plantar_fasciopathy) {
      eswtOption = {
        ...catalog.eswt_protocols.plantar_fasciopathy,
        badge: '🟢 EVIDENCIA ALTA / RECOMENDADO EN CASOS CRÓNICOS (>3 MESES)'
      };
    }

    // Check EMTT (Magnetolith®) indication
    if (pathwayId.includes('knee') && catalog.emtt_protocols?.knee_oa_emtt) {
      emttOption = {
        ...catalog.emtt_protocols.knee_oa_emtt,
        badge: '🟠 OPCIÓN COMPLEMENTARIA / EVIDENCIA EMERGENTE'
      };
    } else if (pathwayId.includes('shoulder') && catalog.emtt_protocols?.cuff_emtt) {
      emttOption = {
        ...catalog.emtt_protocols.cuff_emtt,
        badge: '🟠 OPCIÓN COMPLEMENTARIA / EVIDENCIA EMERGENTE'
      };
    }

    const physicalTherapies = {
      id: 'step-6-physical-therapies',
      title: '6. Terapias Físicas Específicas (ESWT & EMTT)',
      badge: '⚡ TECNOLOGÍAS FÍSICAS DIFERENCIADAS',
      technologyDistinction: 'ESWT (Ondas de Choque mecánicas/acústicas focales o radiales) ≠ EMTT Magnetolith® (Terapia electromagnética transducida no invasiva). Son tecnologías diferentes con indicaciones y niveles de evidencia independientes.',
      eswt: eswtOption,
      emtt: emttOption
    };

    // ─────────────────────────────────────────
    // 7. INFILTRACIÓN / INTERVENCIONISMO
    // ─────────────────────────────────────────
    let corticoidInj = null;
    let haInj = null;
    let prpInj = null;
    let spinalInt = null;

    if (pathwayId.includes('shoulder') && catalog.corticosteroid_injections?.subacromial_bursa) {
      corticoidInj = { ...catalog.corticosteroid_injections.subacromial_bursa };
    } else if (pathwayId.includes('knee') && catalog.corticosteroid_injections?.knee_intraarticular) {
      corticoidInj = { ...catalog.corticosteroid_injections.knee_intraarticular };
    }

    if (pathwayId.includes('knee')) {
      if (catalog.hyaluronic_acid_protocols?.knee_oa_ha) {
        haInj = { ...catalog.hyaluronic_acid_protocols.knee_oa_ha };
      }
      if (catalog.prp_protocols?.knee_oa_prp) {
        prpInj = { ...catalog.prp_protocols.knee_oa_prp };
      }
    } else if (pathwayId.includes('plantar') || pathwayId.includes('elbow')) {
      if (catalog.prp_protocols?.chronic_tendinopathy_prp) {
        prpInj = { ...catalog.prp_protocols.chronic_tendinopathy_prp };
      }
    }

    if (isRadicular) {
      const isCervical = pathwayId.includes('cervical');
      spinalInt = {
        approaches: isCervical ? [
          catalog.spinal_interventions?.transforaminal_epidural_cervical || catalog.spinal_interventions?.transforaminal_epidural,
          catalog.spinal_interventions?.interlaminar_epidural_cervical || catalog.spinal_interventions?.interlaminar_epidural
        ].filter(Boolean) : [
          catalog.spinal_interventions?.transforaminal_epidural_lumbar || catalog.spinal_interventions?.transforaminal_epidural,
          catalog.spinal_interventions?.interlaminar_epidural_lumbar || catalog.spinal_interventions?.interlaminar_epidural,
          catalog.spinal_interventions?.caudal_epidural
        ].filter(Boolean),
        drgPrf: catalog.spinal_interventions?.drg_pulsed_radiofrequency,
        facetRfWarning: '❌ PROHIBIDO OFRECER Radiofrecuencia de ramos mediales para radiculopatía / ciática (inerva articulaciones facetarias posteriores, no raíces nerviosas).',
        expectedBenefit: 'La epidural no elimina mecánicamente la hernia. Busca reducir temporalmente el dolor y la inflamación radicular (beneficio concentrado en los primeros 3 meses según AAN 2025) para recuperar sueño, movimiento y función mientras el cuerpo reabsorbe el tejido.'
      };
    } else if (pathwayId.includes('lumbar-axial') || pathwayId.includes('cervical-axial')) {
      if (catalog.spinal_interventions?.facet_radiofrequency) {
        spinalInt = {
          facetRf: catalog.spinal_interventions.facet_radiofrequency,
          indication: 'Dolor axial facetario crónico tras bloqueo diagnóstico previo positivo (>50-80% alivio).'
        };
      }
    }

    let rfProtocol = null;
    if (pathwayId.includes('lumbar-axial')) {
      rfProtocol = catalog.radiofrequency_protocols?.facet_rf_lumbar;
    } else if (pathwayId.includes('cervical-axial')) {
      rfProtocol = catalog.radiofrequency_protocols?.facet_rf_cervical;
    } else if (pathwayId.includes('si-posterior') || pathwayId.includes('sacroiliaca')) {
      rfProtocol = catalog.radiofrequency_protocols?.si_lateral_branches_rf;
    } else if (pathwayId.includes('knee')) {
      rfProtocol = catalog.radiofrequency_protocols?.genicular_rf_knee;
    } else if (pathwayId.includes('hip')) {
      rfProtocol = catalog.radiofrequency_protocols?.hip_articular_branches_rf;
    } else if (pathwayId.includes('shoulder')) {
      rfProtocol = catalog.radiofrequency_protocols?.suprascapular_prf_shoulder;
    } else if (pathwayId.includes('lumbar-radicular')) {
      rfProtocol = catalog.radiofrequency_protocols?.drg_prf_lumbar;
    } else if (pathwayId.includes('cervical-radicular')) {
      rfProtocol = catalog.radiofrequency_protocols?.drg_prf_cervical;
    }

    const pathwayIntervention = treatment.interventionism || {};
    const pathwayTargets = pathwayIntervention.targets || [];

    const comparisonTable = catalog.comparison_tables?.joint_injectables || null;

    const interventionism = {
      id: 'step-7-interventionism',
      title: '7. Infiltración / Intervencionismo Ecoguiado / Fluoroguiado',
      badge: isInterventionSafe ? '🎯 VENTANA DE OPORTUNIDAD' : '🔒 REQUIERE CONCORDANCIA',
      isBlocked: !isInterventionSafe,
      blockReason: this.session.hasActiveRedFlag
        ? '🚨 Intervencionismo bloqueado por presencia de Banderas Rojas activas que requieren derivación urgente.'
        : (concordance === 'discordant')
          ? '⚠️ La concordancia clínico-imagen no apoya una intervención invasiva dirigida sobre este hallazgo.'
          : (!isInterventionSafe)
            ? '⚠️ Requiere confirmar concordancia clínico-imagen (alta o parcial) antes de proceder con técnica invasiva.'
            : '',
      philosophy: 'La técnica intervencionista es una herramienta diagnóstica y terapéutica para abrir una "ventana de oportunidad" analgésica. El objetivo angular posterior es recuperar movimiento, fuerza, sueño y tolerancia a la carga.',
      pathwayTargets: pathwayTargets,
      pathwayCondition: pathwayIntervention.condition || '',
      pathwayObjective: pathwayIntervention.objective || '',
      pathwaySafetyNote: pathwayIntervention.safetyNote || '',
      corticosteroid: corticoidInj,
      hyaluronicAcid: haInj,
      prp: prpInj,
      spinal: spinalInt,
      radiofrequency: rfProtocol,
      comparisonTable: comparisonTable,
      whyThisTreatment: 'Alivio rápido de la inflamación nociceptiva o modulación biológica para romper barreras dolorosas al movimiento.',
      whenToAvoid: 'Prohibido infiltrar corticoides intratendinosos por riesgo de rotura. No realizar infiltraciones repetidas a intervalos fijos sin objetivo funcional.'
    };

    // ─────────────────────────────────────────
    // 8. CIRUGÍA / CRITERIOS DE DERIVACIÓN Y ALARMA
    // ─────────────────────────────────────────
    const surgery = {
      id: 'step-8-surgery',
      title: '8. Cirugía y Criterios de Derivación',
      badge: '⚠️ CRITERIOS DE ALARMA / SELECCIÓN',
      indications: [
        'Fracaso estructurado del tratamiento conservador activo bien ejecutado durante un mínimo de 3 a 6 meses con dolor o discapacidad severa persistente',
        'Roturas agudas traumáticas completas del manguito en pacientes jóvenes y activos con seudoparálisis',
        'Déficit motor neurológico progresivo rápido (fuerza <3/5, pie caído, síndrome de cauda equina)',
        'Artrosis avanzada terminal con colapso articular que imposibilita la marcha autónoma'
      ],
      whyThisTreatment: 'La cirugía se reserva para anomalías mecánicas estructurales graves o refractarias donde el manejo conservador ha alcanzado su techo terapéutico.',
      whenToAvoid: 'Evitar cirugía precoz en dolor inespecífico sin generador estructural concordante claro.'
    };

    return {
      pathwayId,
      pathwayTitle: `${this.pathway.regionLabel} — ${this.pathway.presentation}`,
      patientProfile,
      tiers: [
        education,
        loadManagement,
        exercise,
        physiotherapy,
        pharmacology,
        physicalTherapies,
        interventionism,
        surgery
      ],
      education,
      exercise,
      pharmacology,
      interventionism,
      interventionismBlocked: !isInterventionSafe,
      blockReason: interventionism.blockReason
    };
  }

  /**
   * Generates a clean structured text proposal of the treatment plan
   * formatted for direct inclusion into the Electronic Medical Record (EMR / HC).
   */
  generateStructuredPrescriptionText(patientProfile = {}) {
    const plan = this.getTreatmentPlan(patientProfile);
    if (!plan) return '';

    const lines = [];
    lines.push(`PLAN TERAPÉUTICO CLÍNICO ESTRUCTURADO`);
    lines.push(`Diagnóstico / Presentación: ${plan.pathwayTitle}`);
    lines.push(`────────────────────────────────────────────────────`);
    lines.push(`1. OBJETIVO TERAPÉUTICO:`);
    lines.push(`   - Reducir dolor, restaurar tolerancia a la carga y recuperar función activa.`);
    if (this.session.functionalGoal) {
      lines.push(`   - Meta funcional prioritaria del paciente: «${this.session.functionalGoal}»`);
    }
    lines.push(``);
    lines.push(`2. EDUCACIÓN Y MANEJO DE CARGA:`);
    lines.push(`   - Modificación temporal de sobrecargas. Evitar reposo prolongado.`);
    lines.push(`   - Criterio de dolor tolerable (≤3-4/10) durante las actividades.`);
    lines.push(``);
    lines.push(`3. FISIOTERAPIA Y EJERCICIO ACTIVO:`);
    lines.push(`   - Programa activo supervisado: ${plan.tiers[3].supervisedSessions?.number || '6-12 semanas'}.`);
    lines.push(`   - Pauta domiciliaria: ${plan.tiers[3].homeExercise?.frequency || '3-5 días/semana'}.`);
    lines.push(`   - Criterio de progresión por tolerancia a la carga.`);
    lines.push(``);
    lines.push(`4. PAUTA FARMACOLÓGICA Y NEUROMODULACIÓN:`);
    const pharma = plan.tiers[4].options || [];
    if (pharma.length > 0) {
      pharma.forEach(m => {
        if (!m.isContraindicated) {
          if (m.taperingSchedule) {
            lines.push(`   • ${m.genericName}:`);
            lines.push(`     - Pauta Descendente: 1 comp (30 mg) × 4d → ¾ comp (22,5 mg) × 4d → ½ comp (15 mg) × 4d → ¼ comp (7,5 mg) × 4d → Suspender.`);
            m.taperingSchedule.forEach(s => {
              lines.push(`       · ${s.days}: ${s.dose} (${s.tabletFraction}) — ${s.timing}`);
            });
          } else {
            lines.push(`   • ${m.genericName}: ${m.usualDose} (${m.frequency}). Duración: ${m.duration || 'Ciclo corto'}.`);
          }
          if (m.activeWarnings && m.activeWarnings.length > 0) {
            lines.push(`     ${m.activeWarnings.join(' ')}`);
          }
        }
      });
    }

    const neuro = plan.tiers[4].neuromodulation?.drugs || [];
    if (neuro.length > 0) {
      const activeNeuro = neuro.filter(d => d.isRoutinelyRecommended && !d.isContraindicated);
      if (activeNeuro.length > 0) {
        lines.push(`   [Neuromodulación / Modulación Central]:`);
        activeNeuro.forEach(d => {
          lines.push(`   • ${d.genericName}: Inicio ${d.initialDose} → Titular a ${d.usualDose}. (${d.overrideBadge || 'Indicada'})`);
        });
      }
    }
    lines.push(``);
    if (plan.tiers[5].eswt && plan.tiers[5].eswt.type && !plan.tiers[5].eswt.statusNote?.includes('NO RECOMENDADA')) {
      lines.push(`5. TERAPIAS FÍSICAS (ESWT / EMTT):`);
      lines.push(`   • ${plan.tiers[5].eswt.name}: ${plan.tiers[5].eswt.sessions} (${plan.tiers[5].eswt.interval}).`);
      lines.push(``);
    }
    if (!plan.tiers[6].isBlocked && plan.tiers[6].pathwayTargets && plan.tiers[6].pathwayTargets.length > 0) {
      lines.push(`6. PROCEDIMIENTO INTERVENCIONISTA (Ventana de oportunidad):`);
      plan.tiers[6].pathwayTargets.forEach(tgt => {
        lines.push(`   • ${tgt.name}`);
        if (tgt.localAnesthetic) lines.push(`     - Anestésico Local: ${tgt.localAnesthetic.drug} (${tgt.localAnesthetic.volume})`);
        if (tgt.corticosteroid) lines.push(`     - Corticoide: ${tgt.corticosteroid.drug} ${tgt.corticosteroid.dose ? '· ' + tgt.corticosteroid.dose : ''} (${tgt.corticosteroid.volume || ''})`);
        if (tgt.totalVolume) lines.push(`     - Volumen Total: ${tgt.totalVolume}`);
      });
      if (plan.tiers[6].radiofrequency) {
        const rf = plan.tiers[6].radiofrequency;
        lines.push(`   [Técnica de Radiofrecuencia]:`);
        lines.push(`   • ${rf.name} (${rf.type})`);
        lines.push(`     - Diana: ${rf.target}`);
        if (rf.parameters) lines.push(`     - Parámetros: ${rf.parameters.temperature} / ${rf.parameters.time}`);
        if (rf.pharmacology) lines.push(`     - Anestésico Pre-Lesión: ${rf.pharmacology.preLesionAnesthetic}`);
      }
      lines.push(`   - Reevaluar en 2-4 semanas para inicio/intensificación de rehabilitación activa.`);
      lines.push(``);
    } else if (!plan.tiers[6].isBlocked && plan.tiers[6].radiofrequency) {
      const rf = plan.tiers[6].radiofrequency;
      lines.push(`6. PROCEDIMIENTO INTERVENCIONISTA (Radiofrecuencia):`);
      lines.push(`   • ${rf.name} (${rf.type})`);
      lines.push(`     - Diana: ${rf.target}`);
      if (rf.parameters) lines.push(`     - Parámetros: ${rf.parameters.temperature} / ${rf.parameters.time} | Estimulación: ${rf.parameters.sensoryStimulation || '50 Hz'} / ${rf.parameters.motorStimulation || '2 Hz'}`);
      if (rf.pharmacology) lines.push(`     - Anestésico Pre-Lesión: ${rf.pharmacology.preLesionAnesthetic} (Vol: ${rf.pharmacology.totalVolumePerTarget})`);
      if (rf.requiredDiagnosticTest) lines.push(`     - Test previo: ${rf.requiredDiagnosticTest}`);
      lines.push(`   - Reevaluar en 4-6 semanas.`);
      lines.push(``);
    } else if (!plan.tiers[6].isBlocked && plan.tiers[6].corticosteroid) {
      lines.push(`6. PROCEDIMIENTO INTERVENCIONISTA (Ventana de oportunidad):`);
      lines.push(`   • ${plan.tiers[6].corticosteroid.name} ecoguiada.`);
      lines.push(`   - Reevaluar en 2-3 semanas para inicio de rehabilitación activa.`);
      lines.push(``);
    } else if (!plan.tiers[6].isBlocked && plan.tiers[6].spinal?.approaches) {
      lines.push(`6. INTERVENCIONISMO ESPINAL (Según anatomía y objetivo):`);
      lines.push(`   • Opción preferente: Inyección Epidural Transforaminal / Interlaminar / Caudal.`);
      lines.push(`   - Beneficio esperado: Reducción sintomática de la inflamación radicular para facilitar la rehabilitación.`);
      lines.push(``);
    }
    lines.push(`7. REEVALUACIÓN CLÍNICA:`);
    lines.push(`   - Cita de seguimiento en 4-6 semanas para medir dolor (EVA), función y tolerancia.`);
    lines.push(`────────────────────────────────────────────────────`);

    return lines.join('\n');
  }

  proceedToFollowUp() {
    this.session.currentStep = 'follow_up';
    this._addCompletedStep('treatment');
  }

  // ─────────────────────────────────────────────
  // STEP 7 — FOLLOW-UP
  // ─────────────────────────────────────────────

  getFollowUpPlan() {
    return this.pathway.followUp || null;
  }

  proceedToCoach() {
    this.session.currentStep = 'coach';
    this._addCompletedStep('follow_up');
  }

  // ─────────────────────────────────────────────
  // STEP 9 — CIERRE COACH DE LA CONSULTA
  // ─────────────────────────────────────────────

  /**
   * Generates a patient-centered communication closing script
   * tailored to the identified generator, selected treatment, and patient's functional goal.
   * 
   * @param {string} version - 'express' (10s) | 'standard' (30s) | 'extended' (60s)
   * @param {number} altIndex - Alternative wording index (for "Otra forma de explicarlo")
   */
  getCoachClosing(version = 'standard', altIndex = 0) {
    const pathwayId = this.pathway.id || '';
    const region = this.pathway.region || '';
    const catalog = this.coachCatalog || (typeof window !== 'undefined' ? window.COACH_CATALOG : null) || {};
    const templates = catalog.closingTemplates || {};
    const mantras = catalog.takeHomeMantras || {};

    // 1. Resolve Patient Functional Goal
    const functionalGoal = (this.session.functionalGoal && this.session.functionalGoal.trim().length > 0)
      ? this.session.functionalGoal.trim()
      : this._getDefaultFunctionalGoal();

    // 2. Determine Best Matching Template
    let template = null;
    const isInterventionSafe = (this.session.concordanceLevel === 'high' || this.session.concordanceLevel === 'partial') && !this.session.hasActiveRedFlag;

    if (region === 'hombro') {
      template = isInterventionSafe ? templates.shoulder_infiltrated : templates.shoulder_conservative;
    } else if (region === 'rodilla' || region === 'cadera') {
      template = templates.knee_oa || templates.generic_default;
    } else if (pathwayId.includes('radicular')) {
      template = templates.lumbar_radicular || templates.generic_default;
    } else if (pathwayId.includes('plantar') || pathwayId.includes('pie') || region === 'tobillo_pie') {
      template = templates.plantar_fascia || templates.generic_default;
    } else if (pathwayId.includes('nociplastic') || region === 'nociplastico') {
      template = templates.nociplastic || templates.generic_default;
    } else {
      template = templates.generic_default || {};
    }

    if (!template) {
      template = templates.generic_default || {
        express: 'Hemos identificado el generador principal de su dolor. Adaptaremos la carga y pautaremos ejercicio activo para que pueda volver a {FUNCTIONAL_GOAL}.',
        standard: 'Por los hallazgos de la anamnesis, la exploración física y las pruebas de imagen, hemos identificado el generador que con mayor probabilidad explica su dolor. Nuestro objetivo no es solo bajar los síntomas, sino que pueda volver a {FUNCTIONAL_GOAL}.',
        extended: 'Hemos realizado una correlación clínica rigurosa entre sus síntomas, las maniobras exploratorias y las pruebas complementarias para localizar el origen del problema. Trabajaremos juntos con ejercicio progresivo para que recupere su meta de {FUNCTIONAL_GOAL}.',
        alternatives: ['Creemos que este es el principal generador. Reduciremos el dolor para recuperar progresivamente la función y que vuelva a {FUNCTIONAL_GOAL}.'],
        takeHomeKey: 'general'
      };
    }

    // 3. Resolve Raw Script Text by Version or Alternative
    let rawText = '';
    const alternatives = template.alternatives || [];
    
    if (altIndex > 0 && alternatives.length > 0) {
      const idx = (altIndex - 1) % alternatives.length;
      rawText = alternatives[idx];
    } else {
      if (version === 'express') rawText = template.express || template.standard || '';
      else if (version === 'extended') rawText = template.extended || template.standard || '';
      else rawText = template.standard || '';
    }

    // 4. Interpolate {FUNCTIONAL_GOAL}
    const text = rawText.replace(/{FUNCTIONAL_GOAL}/g, `«${functionalGoal}»`);

    // 5. Resolve Take-Home Mantra
    const takeHomeKey = template.takeHomeKey || 'general';
    const takeHomeMantra = mantras[takeHomeKey] || mantras.general || {
      text: 'MENOS DOLOR PARA MOVERSE MÁS. MOVERSE MÁS PARA HACERSE MÁS FUERTE. HACERSE MÁS FUERTE PARA RECUPERAR SU VIDA.',
      flow: 'COMPRENDER EL DOLOR → MODULAR CARGA → ENTRENAR FUERZA → RECUPERAR VIDA'
    };

    // 6. Gather Contextual Coach Phrases
    const allPhrases = catalog.coachPhrases || {};
    const relevantCategories = [];

    if (isInterventionSafe && allPhrases.infiltracion) relevantCategories.push(allPhrases.infiltracion);
    if (allPhrases.ejercicio) relevantCategories.push(allPhrases.ejercicio);
    if (allPhrases.filosofia) relevantCategories.push(allPhrases.filosofia);
    if (!this.session.hasActiveRedFlag && allPhrases.dolor_y_dano) relevantCategories.push(allPhrases.dolor_y_dano);
    if (allPhrases.responsabilidad) relevantCategories.push(allPhrases.responsabilidad);
    if (allPhrases.expectativas) relevantCategories.push(allPhrases.expectativas);

    return {
      version,
      altIndex,
      text,
      functionalGoal,
      takeHomeMantra,
      visualFlow: takeHomeMantra.flow,
      templateId: template.id,
      alternativesCount: alternatives.length,
      relevantCategories,
      initialFavorites: catalog.initialFavorites || []
    };
  }

  /**
   * Helper to provide an intuitive default functional goal if none entered
   */
  _getDefaultFunctionalGoal() {
    const region = this.pathway.region || '';
    const pathwayId = this.pathway.id || '';
    if (region === 'hombro') return 'levantar el brazo sin dolor para vestirse y dormir de ese lado';
    if (region === 'rodilla') return 'caminar 30 minutos seguidos y subir escaleras';
    if (region === 'cadera') return 'caminar con agilidad y calzarse sin limitación';
    if (pathwayId.includes('radicular')) return 'dormir sin dolor en la pierna y caminar con normalidad';
    if (pathwayId.includes('plantar')) return 'apoyar el pie por la mañana sin dolor punzante y pasear';
    if (region === 'cervical') return 'mover el cuello con libertad al conducir y trabajar frente a la pantalla';
    return 'realizar sus actividades diarias habituales con autonomía y sin dolor';
  }

  proceedToSummary() {
    this.session.currentStep = 'summary';
    this._addCompletedStep('coach');
  }

  // ─────────────────────────────────────────────
  // CLINICAL SUMMARY GENERATOR
  // ─────────────────────────────────────────────

  generateClinicalSummary() {
    const diagnosis = this.generateWorkingDiagnosis();
    const treatment = this.getTreatmentPlan();
    const followUp = this.getFollowUpPlan();
    const imagingReport = this.generateImagingReport();
    const coach = this.getCoachClosing('standard');

    // Build structured summary text
    const sections = [];

    // Motivo de consulta
    sections.push(`MOTIVO DE CONSULTA\n${this.pathway.regionLabel} — ${this.pathway.presentation}`);

    // Banderas rojas
    if (this.session.redFlagsChecked) {
      sections.push(`BANDERAS ROJAS\n${this.session.hasActiveRedFlag ? 'POSITIVAS — ver detalle' : 'Sin señales de alarma identificadas.'}`);
    }

    // Anamnesis relevante
    const anamnesisData = [];
    Object.entries(this.session.answers).forEach(([qId, aIdx]) => {
      const q = this.getQuestions().find(qu => qu.id === qId);
      const answersList = q ? (q.answers || q.options || []) : [];
      if (q && answersList[aIdx] && !q.isFunctionalGoal) {
        const label = answersList[aIdx].label || answersList[aIdx].text || String(answersList[aIdx]);
        anamnesisData.push(`- ${q.text} → ${label}`);
      }
    });
    if (anamnesisData.length > 0) {
      sections.push(`ANAMNESIS RELEVANTE\n${anamnesisData.join('\n')}`);
    }

    // Objetivo funcional
    if (this.session.functionalGoal) {
      sections.push(`OBJETIVO FUNCIONAL DEL PACIENTE\n${this.session.functionalGoal}`);
    }

    // Exploración
    const examData = [];
    Object.entries(this.session.examinationFindings).forEach(([stepId, result]) => {
      const step = this.getExaminationStep(stepId);
      if (step) {
        const resultObj = (step.results || []).find(r => r.value === result);
        examData.push(`- ${step.name}: ${resultObj ? resultObj.label : result}`);
      }
    });
    if (examData.length > 0) {
      sections.push(`EXPLORACIÓN FÍSICA\n${examData.join('\n')}`);
    }

    // Clusters
    const clusterData = [];
    Object.entries(this.session.clusterResults).forEach(([cId, cResult]) => {
      const cluster = (this.pathway.clusters || []).find(c => c.id === cId);
      if (cluster) {
        clusterData.push(`- ${cluster.name}: ${cResult.met ? 'Concordante' : 'No concordante'} (${cResult.positiveCount}/${cResult.totalEvaluated})`);
      }
    });
    if (clusterData.length > 0) {
      sections.push(`CLÚSTERES CLÍNICOS\n${clusterData.join('\n')}`);
    }

    // Imaging
    if (imagingReport) {
      const imagingType = this.pathway.ultrasound ? 'ECOGRAFÍA' : 'IMAGEN';
      sections.push(`${imagingType}\n${imagingReport}`);
    }

    // Concordance
    if (this.session.concordanceLevel) {
      const concordance = this.getConcordanceAssessment();
      sections.push(`CONCORDANCIA CLÍNICO-IMAGEN\n${concordance ? concordance.label + ': ' + concordance.description : this.session.concordanceLevel}`);
    }

    // Impresión clínica
    if (diagnosis.generator) {
      sections.push(`IMPRESIÓN CLÍNICA\nGenerador probable: ${diagnosis.generator.painGenerator}\nMecanismo: ${diagnosis.generator.mechanismLabel}\nConfianza clínica: ${diagnosis.confidenceLabel}`);
    }

    // Diagnóstico diferencial
    if (diagnosis.alternatives && diagnosis.alternatives.length > 0) {
      sections.push(`DIAGNÓSTICO DIFERENCIAL\n${diagnosis.alternatives.map(a => `- ${a.name}`).join('\n')}`);
    }

    // Plan
    const planLines = [];
    if (treatment) {
      if (treatment.education) planLines.push('1. Educación terapéutica');
      if (treatment.exercise) planLines.push('2. Ejercicio terapéutico progresivo');
      if (treatment.pharmacology) planLines.push('3. Tratamiento farmacológico según indicación');
      if (treatment.interventionism) planLines.push('4. Valorar tratamiento intervencionista según evolución');
    }
    if (planLines.length > 0) {
      sections.push(`PLAN TERAPÉUTICO\n${planLines.join('\n')}`);
    }

    // Seguimiento
    if (followUp) {
      sections.push(`SEGUIMIENTO\n${followUp.timing}\nParámetros: ${followUp.parameters.map(p => p.name).join(', ')}`);
    }

    // Cierre Coach al Paciente
    if (coach && coach.text) {
      sections.push(`CIERRE COACH AL PACIENTE (30s)\n«${coach.text}»\n\nMANTRA PARA RECORDAR:\n${coach.takeHomeMantra?.text || ''}`);
    }

    const fullText = sections.join('\n\n');

    this._addCompletedStep('summary');

    return {
      text: fullText,
      sections,
      date: new Date().toLocaleDateString('es-ES'),
      pathway: this.pathway.presentation,
      region: this.pathway.regionLabel
    };
  }

  // ─────────────────────────────────────────────
  // AUXILIARY BUTTONS
  // ─────────────────────────────────────────────

  /**
   * "¿Qué me falta?" — Missing information checklist
   */
  getMissingInfo() {
    const checklist = [];

    // Anamnesis
    const allQuestions = this.getQuestions();
    allQuestions.forEach(q => {
      const answered = this.session.answers[q.id] !== undefined;
      checklist.push({
        category: 'anamnesis',
        item: q.text.substring(0, 60) + (q.text.length > 60 ? '...' : ''),
        completed: answered,
        essential: q.essential
      });
    });

    // Examination
    const allSteps = this.pathway.examination?.steps || [];
    allSteps.forEach(s => {
      const done = this.session.examinationFindings[s.id] !== undefined;
      checklist.push({
        category: 'examination',
        item: s.name,
        completed: done,
        essential: s.essential
      });
    });

    // Imaging
    const structures = this.getImagingStructures();
    structures.forEach(s => {
      const done = this.session.imagingFindings[s.id] !== undefined;
      checklist.push({
        category: 'imaging',
        item: s.name,
        completed: done,
        essential: s.priority === 1
      });
    });

    // Functional goal
    checklist.push({
      category: 'anamnesis',
      item: 'Objetivo funcional del paciente',
      completed: !!this.session.functionalGoal,
      essential: true
    });

    return checklist;
  }

  /**
   * "No me cuadra" — Reconsider diagnosis
   */
  reconsiderDiagnosis() {
    const ranked = this.getHypothesesRanked();
    const topHyp = ranked[0];

    // Find discordant findings
    const discordantFindings = [];
    this.session.hypotheses.forEach(h => {
      h.history.forEach(entry => {
        if (entry.effect === 'decrease' && h.id === topHyp.id) {
          discordantFindings.push(entry.reason);
        }
      });
    });

    // Alternative diagnoses
    const alternatives = (this.pathway.differentialDiagnosis || []).map(dd => ({
      name: dd.name,
      whatWouldReconsider: dd.whatWouldReconsider,
      keyTest: dd.keyDiscriminatingTest
    }));

    // Pending data
    const missing = this.getMissingInfo().filter(m => !m.completed);

    // Possible referred/neuropathic/nociplastic component
    const painMechanisms = [];
    const neuropathicQ = this.session.answers['q2'] || this.session.answers['q5'];
    if (neuropathicQ !== undefined) {
      painMechanisms.push('Considerar componente neuropático si hay hormigueo/parestesias/irradiación.');
    }
    painMechanisms.push('Considerar dolor referido de otra estructura.');
    painMechanisms.push('Considerar componente nociplástico si dolor difuso, desproporcionado o sensibilización.');

    return {
      currentTop: topHyp,
      discordantFindings,
      alternatives,
      pendingData: missing,
      painMechanisms,
      recommendation: 'Revisar hallazgos discordantes. Si persisten dudas, ampliar exploración o solicitar pruebas complementarias.'
    };
  }

  /**
   * "¿Y si no es esto?" — Differential diagnosis
   */
  getDifferentialDiagnosis() {
    return (this.pathway.differentialDiagnosis || []).map(dd => ({
      ...dd,
      currentlyExcluded: this.session.hypotheses.some(h =>
        h.name.toLowerCase().includes(dd.name.toLowerCase().split(' ')[0]) &&
        (h.level === 'discordant' || h.level === 'unlikely')
      )
    }));
  }

  // ─────────────────────────────────────────────
  // MODE TOGGLES
  // ─────────────────────────────────────────────

  setExpressMode(enabled) {
    this.session.expressMode = enabled;
  }

  setMentorMode(enabled) {
    this.session.mentorMode = enabled;
  }

  // ─────────────────────────────────────────────
  // NAVIGATION & PROGRESS
  // ─────────────────────────────────────────────

  getCurrentStep() {
    return this.session.currentStep;
  }

  getProgressSteps() {
    const allSteps = [
      { id: 'red_flags', label: 'Red Flags', icon: '⚠️' },
      { id: 'anamnesis', label: 'Anamnesis', icon: '📋' },
      { id: 'anamnesis_summary', label: 'Resumen', icon: '📝' },
      { id: 'examination', label: 'Exploración', icon: '🔍' },
      { id: 'exam_summary', label: 'Concordancia', icon: '🗺️' },
      { id: 'imaging', label: this.pathway.ultrasound ? 'Ecografía' : 'Imagen', icon: this.pathway.ultrasound ? '🔊' : '🏥' },
      { id: 'generator', label: 'Generador', icon: '🎯' },
      { id: 'treatment', label: 'Tratamiento', icon: '💊' },
      { id: 'follow_up', label: 'Seguimiento', icon: '📅' },
      { id: 'coach', label: 'Cierre Coach', icon: '🗣️' },
      { id: 'summary', label: 'Resumen HC', icon: '📋' }
    ];

    return allSteps.map(step => ({
      ...step,
      status: this.session.completedSteps.includes(step.id) ? 'completed'
        : this.session.currentStep === step.id ? 'current'
        : 'pending'
    }));
  }

  goToStep(stepId) {
    // Allow going back to previously completed steps
    this.session.currentStep = stepId;
  }

  _addCompletedStep(stepId) {
    if (!this.session.completedSteps.includes(stepId)) {
      this.session.completedSteps.push(stepId);
    }
  }

  // ─────────────────────────────────────────────
  // SESSION PERSISTENCE
  // ─────────────────────────────────────────────

  getSessionState() {
    return JSON.parse(JSON.stringify(this.session));
  }

  restoreSession(savedState) {
    this.session = { ...this.session, ...savedState };
    // Re-link hypotheses from saved state
    if (savedState.hypotheses) {
      this.session.hypotheses = savedState.hypotheses;
    }
  }

  // ─────────────────────────────────────────────
  // CLINICAL REASONING 2.0 ENHANCEMENTS
  // ─────────────────────────────────────────────

  /**
   * Identifies the key discriminatory question, test or clinical clue
   * that separates the top 2 competing hypotheses in real time.
   */
  getDifferentialDiscriminator() {
    const ranked = this.getHypothesesRanked();
    if (!ranked || ranked.length < 2) return null;

    const top1 = ranked[0];
    const top2 = ranked[1];
    const scoreDiff = top1.score - top2.score;

    // Check if pathway has specific differential pairs defined
    const diffList = this.pathway.differentialDiagnosis || [];
    let customClue = null;
    for (const d of diffList) {
      const top2Label = (top2.shortName || top2.name || '').toLowerCase();
      if (d.id && (d.id.includes(top2.id) || top2.id.includes(d.id) || (d.name && d.name.toLowerCase().includes(top2Label)))) {
        customClue = {
          whatWouldReconsider: d.whatWouldReconsider,
          keyDiscriminatingTest: d.keyDiscriminatingTest
        };
        break;
      }
    }

    // Standard clinical discrimination rules for high-yield pairs
    let recommendation = '';
    const id1 = top1.id.toLowerCase();
    const id2 = top2.id.toLowerCase();

    if ((id1.includes('gtps') || id1.includes('trocant')) && (id2.includes('coxart') || id2.includes('hip') || id2.includes('cadera'))) {
      recommendation = 'Valora localización inguinal, rotación interna pasiva de cadera (<15°) y provocación lateral (FADIR vs Palpación trocantérea).';
    } else if ((id1.includes('coxart') || id1.includes('hip')) && (id2.includes('gtps') || id2.includes('trocant'))) {
      recommendation = 'Diferencia el dolor inguinal con pérdida de rotación interna (coxartrosis) frente al dolor lateral puro al dormir de lado (GTPS).';
    } else if ((id1.includes('subacromial') || id1.includes('supra')) && (id2.includes('stiff') || id2.includes('capsul') || id2.includes('rigidez'))) {
      recommendation = 'Compara movilidad activa vs movilidad pasiva: una limitación pasiva severa de la rotación externa (<30°) define capsulitis / artropatía GH frente a manguito.';
    } else if ((id1.includes('s1') || id1.includes('radic')) && (id2.includes('fascia') || id2.includes('plantar'))) {
      recommendation = 'Busca territorio neural, parestesias, reflejo aquíleo, fuerza de flexión plantar y test de Lasègue vs dolor selectivo matutino en tubérculo medial (Windlass).';
    } else if (id1.includes('facet') && id2.includes('disc')) {
      recommendation = 'Compara dolor a la extensión + rotación ipsilateral (Test de Kemp) vs dolor en flexión anterior sostenida / sedestación prolongada.';
    } else if (id1.includes('neurogenic') || id2.includes('vascular') || id1.includes('claudic') || id2.includes('claudic')) {
      recommendation = 'Realiza el Bicycle test de Van Gelderen (alivio en flexión anterior = neurógena) y palpa los pulsos arteriales distales (pedio y tibial posterior).';
    } else if (id1.includes('cts') && (id2.includes('c6') || id2.includes('cervic'))) {
      recommendation = 'Explora el test de Durkan y signo del sacudido (Flick) con respeto del meñique vs reflejo bicipital y test de Spurling cervical.';
    } else if (id1.includes('epicondyl') && id2.includes('radial')) {
      recommendation = 'Palpa la inserción ósea exacta del epicóndilo (Cozen) vs la masa muscular a 4 cm distal en la arcada de Frohse (túnel radial).';
    } else if (id1.includes('menisc') && (id2.includes('anser') || id2.includes('pata'))) {
      recommendation = 'Palpa la interlínea articular medial (Thessaly a 20°) vs dolor focal a 4-5 cm distal en la cara anteromedial de la tibia (bursa anserina).';
    } else if (id1.includes('lhbt') && id2.includes('slap')) {
      recommendation = 'Compara el Speed test / palpación en corredera vs dolor intraarticular profundo en el Test de O\'Brien.';
    } else if (id1.includes('pttd') && id2.includes('tarsal')) {
      recommendation = 'Realiza el Single Heel Rise test (elevación monopodal con inversión de calcáneo) vs signo de Tinel retromaleolar con parestesias plantares.';
    } else if (customClue) {
      recommendation = `${customClue.keyDiscriminatingTest}: ${customClue.whatWouldReconsider}`;
    } else {
      recommendation = `Evalúa pruebas de provocación biomecánicas dirigidas para aislar ${top1.shortName} frente a ${top2.shortName}.`;
    }

    return {
      top1,
      top2,
      scoreDiff,
      recommendation,
      isTied: Math.abs(scoreDiff) <= 1
    };
  }

  /**
   * Generates the "What do I believe now?" (¿Qué creo ahora?) summary card.
   */
  getWhatIDoBelieveNow() {
    const ranked = this.getHypothesesRanked();
    const top1 = ranked[0] || null;
    const top2 = ranked[1] || null;

    // Find top supporting finding
    let topSupporting = null;
    let topConflicting = null;
    let maxWeight = 0;

    if (top1 && top1.history) {
      for (const h of top1.history) {
        if (h.effect === 'increase' && h.weight > maxWeight) {
          maxWeight = h.weight;
          topSupporting = h.reason || h.source;
        }
        if (h.effect === 'decrease') {
          topConflicting = h.reason || h.source;
        }
      }
    }

    // Safety status
    const redFlagsChecked = this.session.redFlagsChecked;
    const hasActiveRedFlag = this.session.hasActiveRedFlag;

    // Working confidence
    let confidence = 'Baja';
    if (top1) {
      if (top1.score >= 10 && this.session.concordanceLevel === 'high') confidence = 'Alta';
      else if (top1.score >= 5) confidence = 'Moderada';
    }

    return {
      topCandidate: top1 ? top1.name : 'Sin definir',
      topShortName: top1 ? top1.shortName : 'N/A',
      runnerUp: top2 ? top2.name : 'Ninguno identificado',
      runnerUpShortName: top2 ? top2.shortName : 'N/A',
      safetyStatus: !redFlagsChecked ? 'Banderas rojas pendientes de verificar'
        : hasActiveRedFlag ? '🚨 BANDERAS ROJAS ACTIVAS'
        : '🟢 Banderas rojas descartadas / Ausentes',
      topSupporting: topSupporting || 'Patrón clínico inicial concordante',
      topConflicting: topConflicting || 'Sin hallazgos contradictorios relevantes',
      confidence
    };
  }

  /**
   * Automated smart Discordance Auditor ("No me cuadra")
   * Detects 7 clinical traps and pitfalls.
   */
  runDiscordanceAudit() {
    const warnings = [];
    const answers = this.session.answers;
    const examFindings = this.session.examinationFindings;
    const imagingFindings = this.session.imagingFindings;
    const pathwayId = this.pathway.id;
    const ranked = this.getHypothesesRanked();
    const top = ranked[0] || {};

    // 1. Severe imaging lesion but negative/normal physical exam (Sesgo de Imagen)
    const hasImagingAbnormality = Object.keys(imagingFindings).length > 0 &&
      Object.values(imagingFindings).some(v => v !== 'us-supra-normal' && v !== 'img-normal' && v !== 'us-median-normal' && v !== 'us-fascia-normal');
    const examHasNoPositives = Object.keys(examFindings).length > 0 &&
      Object.values(examFindings).every(v => v === 'negative' || v === 'normal');

    if (hasImagingAbnormality && examHasNoPositives) {
      warnings.push({
        id: 'trap-imaging-bias',
        type: 'sesgo_imagen',
        title: '⚠️ Sospecha de Hallazgo Incidental / Sesgo de Imagen',
        description: 'La prueba de imagen muestra anomalías anatómicas pero la exploración física es completamente negativa. Evita tratar la imagen: el hallazgo puede ser asintomático.',
        severity: 'high'
      });
    }

    // 2. Neuropathic symptoms without complete neurological exploration
    const answersText = JSON.stringify(answers);
    const mentionsNeuropathic = answersText.includes('hormigueo') || answersText.includes('adormecimiento') || answersText.includes('quemazón');
    const hasMotorOrReflexExam = Object.keys(examFindings).some(k => k.includes('motor') || k.includes('reflex') || k.includes('sensory') || k.includes('durkan') || k.includes('tinel'));

    if (mentionsNeuropathic && !hasMotorOrReflexExam && this.session.completedSteps.includes('examination')) {
      warnings.push({
        id: 'trap-under-explored-neuro',
        type: 'infraexploracion',
        title: '⚠️ Síntomas Neuropáticos sin Examen Neurológico',
        description: 'El paciente refiere parestesias o quemazón pero no se han registrado miotomas, sensibilidad ni reflejos osteotendinosos.',
        severity: 'medium'
      });
    }

    // 3. Shoulder pain radiating past elbow without cervical screening
    if (pathwayId.includes('shoulder')) {
      const hasCervicalScreening = Object.keys(examFindings).some(k => k.includes('cervical'));
      if (!hasCervicalScreening && this.session.completedSteps.includes('examination')) {
        warnings.push({
          id: 'trap-shoulder-no-cervical-screen',
          type: 'omision_exploracion',
          title: '⚠️ Hombro sin Screening Cervical',
          description: 'No se ha realizado screening de columna cervical (movilidad activa o Spurling) para descartar dolor referido C5-C6.',
          severity: 'medium'
        });
      }
    }

    // 4. Sacroiliac diagnosis with insufficient Laslett cluster (<2 positive tests)
    if (pathwayId.includes('si-posterior') || top.id?.includes('si-dysfunction')) {
      const clusterSI = this.session.clusterResults['cluster-laslett-si'];
      if (clusterSI && !clusterSI.met && this.session.completedSteps.includes('examination')) {
        warnings.push({
          id: 'trap-insufficient-si-cluster',
          type: 'cluster_insuficiente',
          title: '⚠️ Clúster de Laslett Insuficiente para Dolor Sacroilíaco',
          description: 'La sospecha de patología sacroilíaca no alcanza el umbral de ≥2 maniobras positivas del Clúster de Laslett. Reconsiderar columna lumbar L5-S1 o cadera.',
          severity: 'high'
        });
      }
    }

    // 5. Radicular diagnosis without nerve root tension or objective deficit
    if (pathwayId.includes('radicular') || top.id?.includes('radic')) {
      const lasegue = examFindings['exam-lasegue'];
      const slump = examFindings['exam-slump'];
      const spurling = examFindings['exam-spurling'];
      const allNeurodynamicNegative = (lasegue === 'negative' || lasegue === 'pain_back_only') && (!slump || slump === 'negative') && (!spurling || spurling === 'negative');

      if (allNeurodynamicNegative && this.session.completedSteps.includes('examination')) {
        warnings.push({
          id: 'trap-radicular-without-tension',
          type: 'discordancia_radicular',
          title: '⚠️ Sospecha Radicular sin Tensión Neural Objetiva',
          description: 'Las maniobras neurodinámicas (Lasègue / Slump / Spurling) son negativas. Considerar dolor somático referido facetario o patología de cadera/hombro.',
          severity: 'medium'
        });
      }
    }

    // 6. Tendinopathy with pain not reproducible by mechanical load
    if (top.id?.includes('tendin') || top.id?.includes('epicondyl') || top.id?.includes('fascia')) {
      const allLoadNegative = Object.values(examFindings).every(v => v === 'negative' || v === 'normal');
      if (allLoadNegative && this.session.completedSteps.includes('examination')) {
        warnings.push({
          id: 'trap-tendinopathy-unloaded',
          type: 'tendinopatia_sin_carga',
          title: '⚠️ Tendinopatía sin Dolor a la Carga Mecánica',
          description: 'La tendinopatía mecánica típicamente duele al tensar o cargar el tendón. Si la carga es indolora, reconsiderar dolor neuropático o nociplástico.',
          severity: 'medium'
        });
      }
    }

    // 7. Proposed interventional therapy with low/discordant correlation
    if (this.session.concordanceLevel === 'discordant' && this.session.selectedGenerator) {
      warnings.push({
        id: 'trap-discordant-intervention',
        type: 'intervencionismo_discordante',
        title: '⚠️ Discordancia Clínico-Imagen: Reconsiderar Procedimientos Invasivos',
        description: 'Existe discordancia entre los síntomas del paciente y la imagen. No se recomienda realizar infiltraciones invasivas dirigidas a hallazgos incidentales.',
        severity: 'high'
      });
    }

    return {
      hasWarnings: warnings.length > 0,
      count: warnings.length,
      warnings
    };
  }

  // ─────────────────────────────────────────────
  // SPRINT 14 — ADVANCED REASONING & DECISION MODULES
  // ─────────────────────────────────────────────

  /**
   * Calculates post-test probability using Bayesian Nomogram / Odds formula:
   * pretestOdds = p / (1 - p)
   * posttestOdds = pretestOdds * LR
   * posttestProb = posttestOdds / (1 + posttestOdds)
   */
  calculateBayesianPostTest(pretestProb = 0.30, lr = 1.0) {
    const p = Math.max(0.01, Math.min(0.99, Number(pretestProb) || 0.30));
    const likelihoodRatio = Math.max(0.01, Number(lr) || 1.0);
    const pretestOdds = p / (1 - p);
    const posttestOdds = pretestOdds * likelihoodRatio;
    const posttestProb = posttestOdds / (1 + posttestOdds);
    return {
      pretestProb: p,
      pretestPct: Math.round(p * 100),
      lr: likelihoodRatio,
      posttestProb,
      posttestPct: Math.round(posttestProb * 100),
      shift: Math.round((posttestProb - p) * 100)
    };
  }

  /**
   * Determines the 4-level Clinical Certainty state:
   * 'high' (Alta), 'moderate' (Moderada), 'low' (Baja), 'indeterminate' (Indeterminada)
   */
  getClinicalCertainty() {
    const ranked = this.getHypothesesRanked();
    const top1 = ranked[0] || {};
    const top2 = ranked[1] || {};
    const conf = this.session.confidenceLevel || 'low';
    const concordance = this.session.concordanceLevel || 'neutral';
    const scoreDiff = (top1.score || 0) - (top2.score || 0);

    let level = 'low';
    let label = 'Certeza Baja';
    let color = '#ef4444';
    let icon = '🟡';

    if (this.session.hasActiveRedFlag) {
      level = 'indeterminate';
      label = 'Interrumpida por Alerta de Seguridad';
      color = '#ef4444';
      icon = '🚨';
    } else if (top1.level === 'very_compatible' && scoreDiff >= 3 && (concordance === 'high' || concordance === 'neutral')) {
      level = 'high';
      label = 'Certeza Alta';
      color = '#10b981';
      icon = '🟢';
    } else if (top1.level === 'compatible' || (top1.level === 'very_compatible' && scoreDiff >= 1)) {
      level = 'moderate';
      label = 'Certeza Moderada';
      color = '#f59e0b';
      icon = '🟡';
    } else if (Math.abs(scoreDiff) <= 1 && top1.score <= 1) {
      level = 'indeterminate';
      label = 'Certeza Indeterminada (Dilema Clínico)';
      color = '#8b5cf6';
      icon = '🟣';
    }

    // Collect facts supporting and contradicting
    const supporting = [];
    const contradicting = [];

    if (top1.history) {
      top1.history.forEach(h => {
        if (h.effect === 'increase') supporting.push(h.reason || h.source);
        if (h.effect === 'decrease') contradicting.push(h.reason || h.source);
      });
    }

    let decisiveToIncrease = 'Explorar maniobras de provocación con alto LR+ o solicitar ecografía/RM concordante.';
    if (top2 && top2.name) {
      decisiveToIncrease = `Descartar explícitamente ${top2.name} mediante pruebas discriminativas.`;
    }

    return {
      level,
      label,
      color,
      icon,
      topHypothesis: top1,
      supporting: [...new Set(supporting)],
      contradicting: [...new Set(contradicting)],
      decisiveToIncrease
    };
  }

  /**
   * Teaching synthesis: "¿Qué cambió mi decisión?"
   */
  getDecisionChangeSynthesis() {
    const certainty = this.getClinicalCertainty();
    const ranked = this.getHypothesesRanked();
    const top1 = ranked[0] || {};
    const top2 = ranked[1] || {};

    let mostSupporting = certainty.supporting[0] || 'Concordancia anatómica de los síntomas del paciente.';
    let mostWeakening = certainty.contradicting[0] || 'Ausencia de hallazgos neurológicos deficitarios puros o simetría de reflejos.';
    let mainAlternative = top2.name ? `${top2.name} (${this.getHypothesisLevelLabel(top2.level)})` : 'Dolor miofascial / referido regional.';
    
    let mustNotMiss = 'Descartar banderas rojas: pérdida de fuerza progresiva, síndrome de cauda equina, neoplasia previa o dolor inflamatorio nocturno.';
    if (this.session.hasActiveRedFlag) {
      mustNotMiss = '¡Alerta de seguridad positiva activa! Priorizar descarte de patología grave.';
    }

    let pendingFactToChangeConduct = 'Si la ecografía/RM muestra rotura completa o estenosis severa con déficit motor objetivo -> Valorar cirugía/procedimiento invasivo.';
    if (top1.id?.includes('radic')) {
      pendingFactToChangeConduct = 'Aparición de pie caído o pérdida de control de esfínteres obligaría a RM urgente y descompresión neuroquirúrgica inmediata.';
    } else if (top1.id?.includes('manguito') || top1.id?.includes('supra')) {
      pendingFactToChangeConduct = 'Debilidad franca sin dolor (pseudoparálisis) obligaría a valorar rotura masiva del manguito para reparación temprana.';
    }

    return {
      mostSupporting,
      mostWeakening,
      mainAlternative,
      mustNotMiss,
      pendingFactToChangeConduct
    };
  }

  /**
   * Generates standard structured text ready to copy into hospital EHR / Medical History
   */
  generateStandardClinicalOutput() {
    const certainty = this.getClinicalCertainty();
    const diagnosis = this.generateWorkingDiagnosis();
    const synthesis = this.getDecisionChangeSynthesis();
    const pathway = this.pathway;
    const dateStr = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });

    const topHyp = diagnosis.topHypothesis || {};
    const generator = diagnosis.generator || {};

    const findingsText = Object.entries(this.session.examinationFindings)
      .map(([stepId, val]) => {
        const step = this.getExaminationStep(stepId);
        const name = step ? step.name : stepId;
        const resObj = step?.results?.find(r => r.value === val);
        const resLabel = resObj ? resObj.label : val;
        return `  • ${name}: ${resLabel}`;
      }).join('\n') || '  • Exploración sistemática completada sin hallazgos atípicos.';

    const echoText = this.generateImagingReport() || 'Sin hallazgos estructurales discordantes reportados.';

    return `================================================================================
📋 NOTA DE CONSULTA CLÍNICA DE ALTA PRECISIÓN — DOLOR
Fecha: ${dateStr} | Región: ${pathway.regionLabel || pathway.region}
================================================================================

1. SAFETY & BANDERAS ROJAS:
   ${this.session.hasActiveRedFlag ? '🚨 POSIBLE ALERTA DE SEGURIDAD DETECTADA' : '✅ Sin señales de alarma evidentes (Red Flags descartadas)'}

2. FENOTIPO Y ORIENTACIÓN DIAGNÓSTICA:
   • Patrón Clínico: ${pathway.presentation || pathway.id}
   • Diagnóstico Clínico Principal: ${topHyp.name || 'En estudio'}
   • Generador Tisular Probable: ${generator.painGenerator || topHyp.name || 'Generador nociceptivo/neuropático'}
   • Nivel de Certeza Clínica: ${certainty.label.toUpperCase()}
   • Concordancia Clínico-Imagen: ${this.session.concordanceLevel ? this.session.concordanceLevel.toUpperCase() : 'NO REQUERIDA INICIALMENTE'}

3. EXPLORACIÓN FÍSICA DIRIGIDA (TESTS DISCRIMINATIVOS):
${findingsText}

4. POCUS / CORRELACIÓN DE IMAGEN:
   ${echoText}

5. SÍNTESIS DOCENTE (¿QUÉ CAMBIÓ MI DECISIÓN?):
   • Dato clave que apoya: ${synthesis.mostSupporting}
   • Dato que debilita/matiza: ${synthesis.mostWeakening}
   • Principal alternativa a vigilar: ${synthesis.mainAlternative}
   • Must-Not-Miss: ${synthesis.mustNotMiss}

6. PLAN TERAPÉUTICO Y CONDUCTA:
   • Educación: Desmitificación, autoeficacia y manejo del dolor.
   • Modificación de carga: Actividad submáxima tolerable (dolor ≤3-4/10).
   • Farmacoterapia / Intervencionismo: Según concordancia y comorbilidades.
   • Objetivo Funcional del Paciente: ${this.session.functionalGoal || 'Recuperar actividad y alivio del dolor'}
   • Revisión programada: En 4 a 6 semanas (adelantar si signos de alarma).

================================================================================
Generado con Sistema de Razonamiento Clínico en Dolor · Dr. Curro Mir
================================================================================`;
  }
}

// ─────────────────────────────────────────────
// SIMULATION & TRAINING ENGINE 2.0
// ─────────────────────────────────────────────

class SimulationEngine {
  constructor(caseData, testsCatalog) {
    this.caseData = caseData;
    this.catalog = testsCatalog;
    this.history = [];
    this.scores = {
      seguridad: 100,
      anamnesis: 100,
      diferencial: 100,
      exploracion: 100,
      imagen: 100,
      concordancia: 100,
      generador: 100,
      tratamiento: 100,
      seguimiento: 100
    };
    this.biasesDetected = [];
    this.completed = false;
  }

  evaluateDecision(dimension, actionKey, isCorrect, penalty = 20, feedback = '') {
    if (!this.scores[dimension]) this.scores[dimension] = 100;

    if (!isCorrect) {
      this.scores[dimension] = Math.max(0, this.scores[dimension] - penalty);
      this.history.push({
        dimension,
        actionKey,
        success: false,
        penalty,
        feedback
      });
    } else {
      this.history.push({
        dimension,
        actionKey,
        success: true,
        feedback
      });
    }
  }

  recordBias(biasType, title, explanation) {
    if (!this.biasesDetected.some(b => b.biasType === biasType)) {
      this.biasesDetected.push({
        biasType,
        title,
        explanation
      });
    }
  }

  getOverallScore() {
    const keys = Object.keys(this.scores);
    const sum = keys.reduce((acc, k) => acc + this.scores[k], 0);
    return Math.round(sum / keys.length);
  }

  getDebriefingReport() {
    const overall = this.getOverallScore();
    return {
      caseTitle: this.caseData.title,
      difficulty: this.caseData.difficultyLabel,
      overallScore: overall,
      grade: overall >= 85 ? 'Excelente (Maestría Clínica)'
        : overall >= 70 ? 'Competente (Buen Razonamiento)'
        : overall >= 50 ? 'En Desarrollo (Requiere Ajuste)'
        : 'Riesgo Clínico (Revisar Seguridad y Sesgos)',
      radarScores: { ...this.scores },
      biasesDetected: this.biasesDetected,
      history: this.history,
      takeHomePearl: this.caseData.expectedFlow?.discriminatorNote || 'La clave del caso radica en correlacionar siempre la clínica con la imagen.'
    };
  }
}

// ─────────────────────────────────────────────
// AVAILABLE PATHWAYS REGISTRY (19 MASTER PATHWAYS)
// ─────────────────────────────────────────────

const CLINICAL_PATHWAYS_REGISTRY = {
  hombro: {
    label: 'Hombro y Cintura Escapular',
    icon: '🦴',
    presentations: [
      { id: 'shoulder-lateral-pain', label: 'Dolor lateral (Subacromial / Manguito)', file: 'clinical/pathways/shoulder-lateral.json', available: true, visualTier: 'primary', visualLabel: 'Frecuente', clinicalPriority: 10 },
      { id: 'shoulder-stiffness', label: 'Rigidez (Capsulitis Adhesiva vs Artrosis)', file: 'clinical/pathways/shoulder-stiffness.json', available: true, visualTier: 'primary', visualLabel: 'Frecuente', clinicalPriority: 11 },
      { id: 'shoulder-anterior-pain', label: 'Dolor anterior (Bíceps / Corredera / SLAP)', file: 'clinical/pathways/shoulder-anterior.json', available: true, visualTier: 'primary', visualLabel: 'Frecuente', clinicalPriority: 12 },
      { id: 'shoulder-superior-pain', label: 'Dolor superior (Acromioclavicular)', file: 'clinical/pathways/shoulder-superior.json', available: true, visualTier: 'secondary', visualLabel: 'Menos habitual', clinicalPriority: 20 },
      { id: 'shoulder-posterior-pain', label: 'Dolor posterior (Infraespinoso / Manguito Post.)', file: 'clinical/pathways/shoulder-posterior.json', available: true, visualTier: 'secondary', visualLabel: 'Menos habitual', clinicalPriority: 21 },
      { id: 'shoulder-weakness', label: 'Debilidad / Pseudoparálisis', file: 'clinical/pathways/shoulder-weakness.json', available: true, visualTier: 'safety', visualLabel: 'Seguridad', clinicalPriority: 30 },
      { id: 'shoulder-trauma', label: 'Traumatismo de Hombro', file: 'clinical/pathways/shoulder-trauma.json', available: true, visualTier: 'safety', visualLabel: 'Situación especial', clinicalPriority: 31 },
      { id: 'shoulder-unclear', label: 'No está claro (Incertidumbre)', file: 'clinical/pathways/shoulder-unclear.json', available: true, visualTier: 'uncertain', visualLabel: 'Cuando no encaja', clinicalPriority: 40 }
    ]
  },
  lumbar: {
    label: 'Columna Lumbar / Torácica',
    icon: '⚡',
    presentations: [
      { id: 'lumbar-radicular-pain', label: 'Lumbar + irradiación a pierna (Radiculopatía L4/L5/S1)', file: 'clinical/pathways/lumbar-radicular.json', available: true, visualTier: 'primary', visualLabel: 'Frecuente', clinicalPriority: 10 },
      { id: 'lumbar-axial-pain', label: 'Dolor lumbar axial (Síndrome Facetario vs Discogénico)', file: 'clinical/pathways/lumbar-axial.json', available: true, visualTier: 'primary', visualLabel: 'Frecuente', clinicalPriority: 11 },
      { id: 'lumbar-claudication', label: 'Claudicación al caminar (Estenosis de Canal vs Vascular)', file: 'clinical/pathways/lumbar-claudication.json', available: true, visualTier: 'primary', visualLabel: 'Frecuente', clinicalPriority: 12 },
      { id: 'lumbar-gluteal', label: 'Lumbar + glúteo (Facetario vs Sacroilíaca vs Piriforme)', file: 'clinical/pathways/lumbar-gluteal.json', available: true, visualTier: 'secondary', visualLabel: 'Menos habitual', clinicalPriority: 20 },
      { id: 'lumbar-nocturnal', label: 'Dolor nocturno / en reposo (Banderas Rojas / Inflamatorio)', file: 'clinical/pathways/lumbar-nocturnal.json', available: true, visualTier: 'safety', visualLabel: 'Seguridad', clinicalPriority: 30 },
      { id: 'lumbar-trauma', label: 'Traumatismo Lumbar (Fractura Osteoporótica)', file: 'clinical/pathways/lumbar-trauma.json', available: true, visualTier: 'safety', visualLabel: 'Situación especial', clinicalPriority: 31 },
      { id: 'lumbar-unclear', label: 'No está claro (Incertidumbre)', file: 'clinical/pathways/lumbar-unclear.json', available: true, visualTier: 'uncertain', visualLabel: 'Cuando no encaja', clinicalPriority: 40 }
    ]
  },
  cervical: {
    label: 'Columna Cervical',
    icon: '🧠',
    presentations: [
      { id: 'cervical-radicular', label: 'Dolor cervical irradiado (Radiculopatía C6/C7)', file: 'clinical/pathways/cervical-radicular.json', available: true, visualTier: 'primary', visualLabel: 'Frecuente', clinicalPriority: 10 },
      { id: 'cervical-axial', label: 'Cervicalgia axial (Facetario vs Miofascial vs Cefalea)', file: 'clinical/pathways/cervical-axial.json', available: true, visualTier: 'primary', visualLabel: 'Frecuente', clinicalPriority: 11 }
    ]
  },
  rodilla: {
    label: 'Rodilla',
    icon: '🦵',
    presentations: [
      { id: 'knee-oa-anterior', label: 'Dolor anterior / Artrosis (SDFP vs Gonartrosis vs Menisco)', file: 'clinical/pathways/knee-oa-anterior.json', available: true, visualTier: 'primary', visualLabel: 'Frecuente', clinicalPriority: 10 },
      { id: 'knee-medial', label: 'Dolor medial (Gonartrosis Medial vs Menisco Interno vs Pata de Ganso)', file: 'clinical/pathways/knee-medial.json', available: true, visualTier: 'primary', visualLabel: 'Frecuente', clinicalPriority: 11 },
      { id: 'knee-lateral', label: 'Dolor lateral (Banda Iliotibial vs Menisco Lateral)', file: 'clinical/pathways/knee-lateral.json', available: true, visualTier: 'secondary', visualLabel: 'Menos habitual', clinicalPriority: 20 },
      { id: 'knee-posterior', label: 'Dolor posterior (Quiste de Baker vs Isquiotibiales)', file: 'clinical/pathways/knee-posterior.json', available: true, visualTier: 'secondary', visualLabel: 'Menos habitual', clinicalPriority: 21 }
    ]
  },
  cadera: {
    label: 'Cadera',
    icon: '🦿',
    presentations: [
      { id: 'hip-lateral', label: 'Dolor lateral (Síndrome Trocantérico / GTPS / Glúteo medio)', file: 'clinical/pathways/hip-lateral.json', available: true, visualTier: 'primary', visualLabel: 'Frecuente', clinicalPriority: 10 },
      { id: 'hip-inguinal', label: 'Dolor inguinal (Coxartrosis vs Choque FAI vs Psoas)', file: 'clinical/pathways/hip-inguinal.json', available: true, visualTier: 'primary', visualLabel: 'Frecuente', clinicalPriority: 11 },
      { id: 'hip-gluteal', label: 'Dolor glúteo profundo (Espacio Glúteo Profundo / Piriforme)', file: 'clinical/pathways/hip-gluteal.json', available: true, visualTier: 'secondary', visualLabel: 'Menos habitual', clinicalPriority: 20 }
    ]
  },
  sacroiliaca: {
    label: 'Pelvis / Sacroilíaca',
    icon: '🎯',
    presentations: [
      { id: 'si-posterior-pelvic', label: 'Dolor posterior pélvico (Articulación Sacroilíaca / Clúster de Laslett)', file: 'clinical/pathways/si-posterior-pelvic.json', available: true, visualTier: 'primary', visualLabel: 'Frecuente', clinicalPriority: 10 }
    ]
  },
  codo: {
    label: 'Codo',
    icon: '🦾',
    presentations: [
      { id: 'elbow-lateral', label: 'Dolor lateral (Epicondilalgia / Codo de Tenista vs Túnel Radial)', file: 'clinical/pathways/elbow-lateral.json', available: true, visualTier: 'primary', visualLabel: 'Frecuente', clinicalPriority: 10 },
      { id: 'elbow-medial', label: 'Dolor medial (Epitroclealgia vs Nervio Cubital)', file: 'clinical/pathways/elbow-medial.json', available: true, visualTier: 'secondary', visualLabel: 'Menos habitual', clinicalPriority: 20 }
    ]
  },
  muneca_mano: {
    label: 'Muñeca y Mano',
    icon: '🤲',
    presentations: [
      { id: 'wrist-cts', label: 'Túnel carpiano (Nervio Mediano / Durkan / Phalen)', file: 'clinical/pathways/wrist-cts.json', available: true, visualTier: 'primary', visualLabel: 'Frecuente', clinicalPriority: 10 },
      { id: 'wrist-radial', label: 'Dolor radial (Tenosinovitis de De Quervain / WHAT test)', file: 'clinical/pathways/wrist-radial.json', available: true, visualTier: 'primary', visualLabel: 'Frecuente', clinicalPriority: 11 },
      { id: 'wrist-ulnar', label: 'Dolor cubital (Fibrocartílago triangular / TFCC vs ECU)', file: 'clinical/pathways/wrist-ulnar.json', available: true, visualTier: 'secondary', visualLabel: 'Menos habitual', clinicalPriority: 20 }
    ]
  },
  tobillo_pie: {
    label: 'Tobillo y Pie',
    icon: '🦶',
    presentations: [
      { id: 'ankle-plantar', label: 'Dolor plantar (Fascitis Plantar / Test de Windlass)', file: 'clinical/pathways/ankle-plantar.json', available: true, visualTier: 'primary', visualLabel: 'Frecuente', clinicalPriority: 10 },
      { id: 'ankle-medial', label: 'Dolor medial (Tendón Tibial Posterior / TTP vs Túnel del Tarso)', file: 'clinical/pathways/ankle-medial.json', available: true, visualTier: 'primary', visualLabel: 'Frecuente', clinicalPriority: 11 },
      { id: 'ankle-achilles', label: 'Tendón de Aquiles (Porción Media vs Insercional vs Rotura)', file: 'clinical/pathways/ankle-achilles.json', available: true, visualTier: 'secondary', visualLabel: 'Menos habitual', clinicalPriority: 20 },
      { id: 'ankle-lateral', label: 'Dolor lateral (Ligamentos LPAA/LPC vs Peroneos)', file: 'clinical/pathways/ankle-lateral.json', available: true, visualTier: 'secondary', visualLabel: 'Menos habitual', clinicalPriority: 21 }
    ]
  },
  nociplastico: {
    label: 'Dolor Nociplástico / Generalizado',
    icon: '🌪️',
    presentations: [
      { id: 'nociplastic-pain', label: 'Dolor Nociplástico / Sensibilización Central (Fibromialgia)', file: 'clinical/pathways/nociplastic-pain.json', available: true, visualTier: 'primary', visualLabel: 'Frecuente', clinicalPriority: 10 }
    ]
  }
};

// Export for use by reasoning-ui.js, app.js and Node.js
if (typeof window !== 'undefined') {
  window.ClinicalReasoningEngine = ClinicalReasoningEngine;
  window.SimulationEngine = SimulationEngine;
  window.CLINICAL_PATHWAYS_REGISTRY = CLINICAL_PATHWAYS_REGISTRY;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ClinicalReasoningEngine, SimulationEngine, CLINICAL_PATHWAYS_REGISTRY };
}

