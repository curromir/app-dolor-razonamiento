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
   */
  constructor(pathway, testsCatalog) {
    this.pathway = pathway;
    this.catalog = testsCatalog;

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

    // Apply hypothesis effects
    if (answer.hypothesisEffects) {
      answer.hypothesisEffects.forEach(effect => {
        this._applyHypothesisEffect(effect, `anamnesis:${questionId}`, answer.label);
      });
    }

    this._recalculateHypothesisLevels();

    // Check if anamnesis is complete
    if (!this.getCurrentQuestion()) {
      this.session.currentStep = 'anamnesis_summary';
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
      if (q && q.answers[aIdx]) {
        supportingData.push(q.answers[aIdx].label);
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

    this.session.clusterResults[clusterId] = { met, positiveCount, totalEvaluated, threshold };

    // Apply cluster effect to hypotheses if met
    if (met) {
      this.session.hypotheses.forEach(h => {
        if (h.level === 'very_compatible' || h.level === 'compatible') {
          h.score += 2;
          h.history.push({
            source: `cluster:${clusterId}`,
            effect: 'increase',
            weight: 2,
            reason: `Clúster ${cluster.name} concordante (${positiveCount}/${requiredTests.length})`,
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
  // STEP 6 — TREATMENT
  // ─────────────────────────────────────────────

  getTreatmentPlan() {
    const treatment = this.pathway.treatment;
    if (!treatment) return null;

    // Check if interventionism should be shown
    const showInterventionism = treatment.interventionism &&
      (this.session.concordanceLevel === 'high' || this.session.concordanceLevel === 'partial') &&
      !this.session.hasActiveRedFlag;

    return {
      education: treatment.education,
      exercise: treatment.exercise,
      pharmacology: treatment.pharmacology,
      interventionism: showInterventionism ? treatment.interventionism : null,
      interventionismBlocked: !showInterventionism,
      blockReason: this.session.hasActiveRedFlag
        ? 'No se recomienda intervención con banderas rojas activas.'
        : (this.session.concordanceLevel === 'discordant' || !this.session.concordanceLevel)
          ? 'La concordancia clínico-imagen no apoya una intervención dirigida.'
          : null
    };
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

  proceedToSummary() {
    this.session.currentStep = 'summary';
    this._addCompletedStep('follow_up');
  }

  // ─────────────────────────────────────────────
  // CLINICAL SUMMARY GENERATOR
  // ─────────────────────────────────────────────

  generateClinicalSummary() {
    const diagnosis = this.generateWorkingDiagnosis();
    const treatment = this.getTreatmentPlan();
    const followUp = this.getFollowUpPlan();
    const imagingReport = this.generateImagingReport();

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
      if (q && q.answers[aIdx] && !q.isFunctionalGoal) {
        anamnesisData.push(`- ${q.text} → ${q.answers[aIdx].label}`);
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
      { id: 'shoulder-lateral-pain', label: 'Dolor lateral (Subacromial / Manguito)', file: 'clinical/pathways/shoulder-lateral.json', available: true },
      { id: 'shoulder-stiffness', label: 'Rigidez (Capsulitis Adhesiva vs Artrosis)', file: 'clinical/pathways/shoulder-stiffness.json', available: true },
      { id: 'shoulder-anterior-pain', label: 'Dolor anterior (Bíceps / Corredera / SLAP)', file: 'clinical/pathways/shoulder-anterior.json', available: true },
      { id: 'shoulder-superior-pain', label: 'Dolor superior (Acromioclavicular)', file: null, available: false },
      { id: 'shoulder-posterior-pain', label: 'Dolor posterior (Infraespinoso)', file: null, available: false },
      { id: 'shoulder-weakness', label: 'Debilidad / Pseudoparálisis', file: null, available: false },
      { id: 'shoulder-trauma', label: 'Traumatismo', file: null, available: false },
      { id: 'shoulder-unclear', label: 'No está claro', file: null, available: false }
    ]
  },
  lumbar: {
    label: 'Columna Lumbar / Torácica',
    icon: '⚡',
    presentations: [
      { id: 'lumbar-radicular-pain', label: 'Lumbar + irradiación a pierna (Radiculopatía L4/L5/S1)', file: 'clinical/pathways/lumbar-radicular.json', available: true },
      { id: 'lumbar-axial-pain', label: 'Dolor lumbar axial (Síndrome Facetario vs Discogénico)', file: 'clinical/pathways/lumbar-axial.json', available: true },
      { id: 'lumbar-claudication', label: 'Claudicación al caminar (Estenosis de Canal vs Vascular)', file: 'clinical/pathways/lumbar-claudication.json', available: true },
      { id: 'lumbar-gluteal', label: 'Lumbar + glúteo', file: null, available: false },
      { id: 'lumbar-nocturnal', label: 'Dolor nocturno / en reposo', file: null, available: false },
      { id: 'lumbar-trauma', label: 'Traumatismo', file: null, available: false },
      { id: 'lumbar-unclear', label: 'No está claro', file: null, available: false }
    ]
  },
  cervical: {
    label: 'Columna Cervical',
    icon: '🧠',
    presentations: [
      { id: 'cervical-radicular', label: 'Dolor cervical irradiado (Radiculopatía C6/C7)', file: 'clinical/pathways/cervical-radicular.json', available: true },
      { id: 'cervical-axial', label: 'Cervicalgia axial (Facetario vs Miofascial vs Cefalea)', file: 'clinical/pathways/cervical-axial.json', available: true }
    ]
  },
  rodilla: {
    label: 'Rodilla',
    icon: '🦵',
    presentations: [
      { id: 'knee-oa-anterior', label: 'Dolor anterior / Artrosis (SDFP vs Gonartrosis vs Menisco)', file: 'clinical/pathways/knee-oa-anterior.json', available: true },
      { id: 'knee-medial', label: 'Dolor medial (Gonartrosis Medial vs Menisco Interno vs Pata de Ganso)', file: 'clinical/pathways/knee-medial.json', available: true },
      { id: 'knee-lateral', label: 'Dolor lateral', file: null, available: false },
      { id: 'knee-posterior', label: 'Dolor posterior', file: null, available: false }
    ]
  },
  cadera: {
    label: 'Cadera',
    icon: '🦿',
    presentations: [
      { id: 'hip-lateral', label: 'Dolor lateral (Síndrome Trocantérico / GTPS / Glúteo medio)', file: 'clinical/pathways/hip-lateral.json', available: true },
      { id: 'hip-inguinal', label: 'Dolor inguinal (Coxartrosis vs Choque FAI vs Psoas)', file: 'clinical/pathways/hip-inguinal.json', available: true },
      { id: 'hip-gluteal', label: 'Dolor glúteo profundo', file: null, available: false }
    ]
  },
  sacroiliaca: {
    label: 'Pelvis / Sacroilíaca',
    icon: '🎯',
    presentations: [
      { id: 'si-posterior-pelvic', label: 'Dolor posterior pélvico (Articulación Sacroilíaca / Clúster de Laslett)', file: 'clinical/pathways/si-posterior-pelvic.json', available: true }
    ]
  },
  codo: {
    label: 'Codo',
    icon: '🦾',
    presentations: [
      { id: 'elbow-lateral', label: 'Dolor lateral (Epicondilalgia / Codo de Tenista vs Túnel Radial)', file: 'clinical/pathways/elbow-lateral.json', available: true },
      { id: 'elbow-medial', label: 'Dolor medial (Epitroclealgia / Codo de Golfista)', file: null, available: false }
    ]
  },
  muneca_mano: {
    label: 'Muñeca y Mano',
    icon: '🤲',
    presentations: [
      { id: 'wrist-cts', label: 'Túnel carpiano (Nervio Mediano / Durkan / Phalen)', file: 'clinical/pathways/wrist-cts.json', available: true },
      { id: 'wrist-radial', label: 'Dolor radial (Tenosinovitis de De Quervain / WHAT test)', file: 'clinical/pathways/wrist-radial.json', available: true },
      { id: 'wrist-ulnar', label: 'Dolor cubital (Fibrocartílago triangular)', file: null, available: false }
    ]
  },
  tobillo_pie: {
    label: 'Tobillo y Pie',
    icon: '🦶',
    presentations: [
      { id: 'ankle-plantar', label: 'Dolor plantar (Fascitis Plantar / Test de Windlass)', file: 'clinical/pathways/ankle-plantar.json', available: true },
      { id: 'ankle-medial', label: 'Dolor medial (Tendón Tibial Posterior / TTP vs Túnel del Tarso)', file: 'clinical/pathways/ankle-medial.json', available: true },
      { id: 'ankle-achilles', label: 'Tendón de Aquiles (Tendinopatía)', file: null, available: false },
      { id: 'ankle-lateral', label: 'Dolor lateral (Ligamentos peroneos)', file: null, available: false }
    ]
  },
  nociplastico: {
    label: 'Dolor Nociplástico / Generalizado',
    icon: '🌪️',
    presentations: [
      { id: 'nociplastic-pain', label: 'Dolor Nociplástico / Sensibilización Central (Fibromialgia)', file: 'clinical/pathways/nociplastic-pain.json', available: true }
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

