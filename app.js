/**
 * TEST DE EXPLORACIÓN FÍSICA EN DOLOR
 * Application Engine & Reactive Controller
 * Author: Dr. Curro Mir
 */

// Application State
const state = {
  catalog: null,
  quizScore: 0,
  quizTotal: 0,
  answeredCases: {},
  tests: [],
  filtered: [],
  currentTab: 'tab-tests',
  currentFilter: 'all',
  searchQuery: '',
  sortBy: 'default',
  favorites: JSON.parse(localStorage.getItem('dolor_favs') || '[]'),
  completed: JSON.parse(localStorage.getItem('dolor_completed') || '[]'),
  currentVideoTest: null,
  theme: (localStorage.getItem('dolor_theme') === 'dark') ? 'dark' : 'light'
};

// Expose state globally for clinical reasoning engine & UI
window.state = state;

// DOM Elements
const DOM = {
  searchInput: document.getElementById('searchInput'),
  clearSearchBtn: document.getElementById('clearSearchBtn'),
  testsGrid: document.getElementById('testsGrid'),
  noResults: document.getElementById('noResults'),
  btnResetFilters: document.getElementById('btnResetFilters'),
  btnToggleAtlas: document.getElementById('btnToggleAtlas'),
  btnCloseAtlas: document.getElementById('btnCloseAtlas'),
  atlasSection: document.getElementById('atlasSection'),
  atlasRegionCards: document.getElementById('atlasRegionCards'),
  btnThemeToggle: document.getElementById('btnThemeToggle'),
  themeIcon: document.getElementById('themeIcon'),
  themeLabel: document.getElementById('themeLabel'),
  progressCount: document.getElementById('progressCount'),
  totalTestsCount: document.getElementById('totalTestsCount'),
  favTabBadge: document.getElementById('favTabBadge'),
  activeFilterHeading: document.getElementById('activeFilterHeading'),
  activeFilterCount: document.getElementById('activeFilterCount'),
  sortSelect: document.getElementById('sortSelect'),
  videotecaGrid: document.getElementById('videotecaGrid'),
  comparativeTableBody: document.getElementById('comparativeTableBody'),
  notionGuideContainer: document.getElementById('notionGuideContainer'),
  fichasContainer: document.getElementById('fichasContainer'),
  casesContainer: document.getElementById('casesContainer'),
  quizScoreDisplay: document.getElementById('quizScoreDisplay'),
  favGrid: document.getElementById('favGrid'),
  noFavsNotice: document.getElementById('noFavsNotice'),
  favCountHeading: document.getElementById('favCountHeading'),
  testModal: document.getElementById('testModal'),
  modalCloseBtn: document.getElementById('modalCloseBtn'),
  modalContent: document.getElementById('modalContent'),
  videoModal: document.getElementById('videoModal'),
  videoModalCloseBtn: document.getElementById('videoModalCloseBtn'),
  videoIframe: document.getElementById('videoIframe'),
  videoModalTitle: document.getElementById('videoModalTitle'),
  videoModalChannel: document.getElementById('videoModalChannel'),
  videoModalFooter: document.getElementById('videoModalFooter')
};

// Initialize Application
document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  await loadCatalog();
  setupEventListeners();
  setupKeyboardShortcuts();
  registerPWA();

  // Initialize Clinical Decision Support & Start on Dual Home
  if (window.ClinicalUI) {
    window.ClinicalUI.init();
    window.ClinicalUI.switchAppMode('home');
  }
});

// Load Database
async function loadCatalog() {
  if (window.EMBEDDED_BUNDLE && window.EMBEDDED_BUNDLE.tests_catalog) {
    state.catalog = window.EMBEDDED_BUNDLE.tests_catalog;
    state.tests = state.catalog.tests || [];
    state.filtered = [...state.tests];

    updateCounts();
    renderAtlasRegions();
    applyFilterAndSort();
    renderVideoteca('all');
    renderComparativeTable();
    renderNotionGuide();
    renderFichas();
    renderCases();
    renderFavorites();
    return;
  }

  try {
    const res = await fetch('data/tests_catalog.json?v=21.0');
    if (!res.ok) throw new Error('Error al cargar tests_catalog.json');
    state.catalog = await res.json();
    state.tests = state.catalog.tests || [];
    state.filtered = [...state.tests];

    updateCounts();
    renderAtlasRegions();
    applyFilterAndSort();
    renderVideoteca('all');
    renderComparativeTable();
    renderNotionGuide();
    renderFichas();
    renderCases();
    renderFavorites();
  } catch (err) {
    if (window.EMBEDDED_BUNDLE && window.EMBEDDED_BUNDLE.tests_catalog) {
      state.catalog = window.EMBEDDED_BUNDLE.tests_catalog;
      state.tests = state.catalog.tests || [];
      state.filtered = [...state.tests];

      updateCounts();
      renderAtlasRegions();
      applyFilterAndSort();
      renderVideoteca('all');
      renderComparativeTable();
      renderNotionGuide();
      renderFichas();
      renderCases();
      renderFavorites();
      return;
    }
    console.error('Error inicializando catálogo:', err);
    if (DOM.testsGrid) {
      DOM.testsGrid.innerHTML = `
        <div class="no-results glass-panel" style="grid-column: 1/-1;">
          <h3>⚠️ Error al cargar los datos clínicos</h3>
          <p>${err.message}</p>
        </div>
      `;
    }
  }
}

// Update Global Counts
function updateCounts() {
  const total = state.tests.length;
  if (DOM.totalTestsCount) DOM.totalTestsCount.textContent = total;
  if (DOM.progressCount) DOM.progressCount.textContent = state.completed.length;
  if (DOM.favTabBadge) DOM.favTabBadge.textContent = state.favorites.length;
  if (DOM.favCountHeading) DOM.favCountHeading.textContent = `${state.favorites.length} pruebas guardadas`;

  const countAll = document.getElementById('countAll');
  if (countAll) countAll.textContent = total;

  const countVideo = document.getElementById('countVideo');
  if (countVideo) {
    const videoCount = state.tests.filter(t => t.videos && t.videos.length > 0).length;
    countVideo.textContent = videoCount;
  }

  // Regions count
  const regions = ['hombro', 'codo', 'muneca_mano', 'cervical', 'lumbar', 'sacroiliaca', 'cadera', 'rodilla', 'tobillo_pie'];
  regions.forEach(reg => {
    const el = document.querySelector(`[data-filter="${reg}"] span`);
    if (el) {
      const regCount = state.tests.filter(t => t.region === reg).length;
      el.textContent = regCount;
    }
  });
}

// Render Atlas Region Cards
function renderAtlasRegions() {
  if (!DOM.atlasRegionCards || !state.catalog || !state.catalog.metadata.regions) return;
  DOM.atlasRegionCards.innerHTML = state.catalog.metadata.regions.map(r => {
    const count = state.tests.filter(t => t.region === r.id).length;
    return `
      <button class="atlas-region-btn" data-region="${r.id}">
        <span class="region-btn-icon">${r.icon}</span>
        <div class="region-btn-info">
          <span class="region-btn-name">${r.name}</span>
          <span class="region-btn-count">${count} tests clínicos</span>
        </div>
      </button>
    `;
  }).join('');

  DOM.atlasRegionCards.querySelectorAll('.atlas-region-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const reg = btn.getAttribute('data-region');
      setFilter(reg);
      toggleAtlas(false);
      switchTab('tab-tests');
    });
  });
}

// Filter and Sort Engine
function applyFilterAndSort() {
  let list = [...state.tests];

  // Apply Region / Special Filter
  if (state.currentFilter !== 'all') {
    if (state.currentFilter === 'has_video') {
      list = list.filter(t => t.videos && t.videos.length > 0);
    } else {
      list = list.filter(t => t.region === state.currentFilter);
    }
  }

  // Apply Search Query
  if (state.searchQuery.trim()) {
    const q = state.searchQuery.toLowerCase().trim();
    list = list.filter(t => {
      const name = (t.name || '').toLowerCase();
      const eponym = (t.eponym || '').toLowerCase();
      const target = (t.target_structure || '').toLowerCase();
      const cat = (t.category_label || '').toLowerCase();
      const reg = (t.region_label || '').toLowerCase();
      const pearl = (t.exam_pearl || '').toLowerCase();
      const proc = (t.procedure || []).join(' ').toLowerCase();
      return name.includes(q) || eponym.includes(q) || target.includes(q) || cat.includes(q) || reg.includes(q) || pearl.includes(q) || proc.includes(q);
    });
  }

  // Apply Sorting
  if (state.sortBy === 'sens') {
    list.sort((a, b) => (b.sens_val || 0) - (a.sens_val || 0));
  } else if (state.sortBy === 'spec') {
    list.sort((a, b) => (b.spec_val || 0) - (a.spec_val || 0));
  } else if (state.sortBy === 'name') {
    list.sort((a, b) => a.name.localeCompare(b.name));
  }

  state.filtered = list;
  renderTestsGrid();
  updateHeaderMeta();
}

// Render Tests Grid
function renderTestsGrid() {
  if (!DOM.testsGrid) return;

  if (state.filtered.length === 0) {
    DOM.testsGrid.innerHTML = '';
    DOM.noResults.style.display = 'block';
    return;
  }

  DOM.noResults.style.display = 'none';
  DOM.testsGrid.innerHTML = state.filtered.map(test => {
    const isFav = state.favorites.includes(test.id);
    const hasVideo = test.videos && test.videos.length > 0;
    const firstVideo = hasVideo ? test.videos[0] : null;

    return `
      <article class="test-card glass-panel" data-id="${test.id}">
        <div>
          <div class="test-card-top">
            <div class="test-badges">
              <span class="region-tag">${test.region_label}</span>
              <span class="category-tag">${test.category_label}</span>
            </div>
            <button class="btn-fav ${isFav ? 'active' : ''}" data-fav-id="${test.id}" title="${isFav ? 'Quitar de favoritos' : 'Añadir a favoritos'}">
              ${isFav ? '★' : '☆'}
            </button>
          </div>

          <div class="test-card-title" style="margin-top: 0.65rem;">
            <h3>${test.name}</h3>
            ${test.eponym ? `<span class="test-eponym">${test.eponym}</span>` : ''}
          </div>

          <div class="test-target" style="margin-top: 0.5rem;">
            <span class="target-icon">🎯</span>
            <span><strong>Diana:</strong> ${test.target_structure}</span>
          </div>

          <div class="accuracy-meters" style="margin-top: 0.75rem;">
            <div class="meter-box">
              <div class="meter-labels">
                <span class="meter-name">Sensibilidad (Sn)</span>
                <span class="meter-val">${test.sensitivity}</span>
              </div>
              <div class="meter-bar-track">
                <div class="meter-bar-fill sens" style="width: ${test.sens_val || 50}%;"></div>
              </div>
            </div>

            <div class="meter-box">
              <div class="meter-labels">
                <span class="meter-name">Especificidad (Sp)</span>
                <span class="meter-val">${test.specificity}</span>
              </div>
              <div class="meter-bar-track">
                <div class="meter-bar-fill spec" style="width: ${test.spec_val || 50}%;"></div>
              </div>
            </div>
          </div>

          <p class="test-card-summary" style="margin-top: 0.65rem;">
            ${test.objective}
          </p>
        </div>

        <div class="test-card-footer">
          ${hasVideo ? `
            <button class="btn-card-video" data-video-test="${test.id}">
              <span>▶</span> <span>Vídeo HD (${firstVideo.channel.includes('Educom') ? 'Educom' : 'Physiotutors'})</span>
            </button>
          ` : `<span></span>`}

          <button class="btn-card-detail" data-detail-id="${test.id}">
            <span>Ver Ficha Completa</span> <span>→</span>
          </button>
        </div>
      </article>
    `;
  }).join('');

  attachCardEvents();
}

// Attach Card Button Events
function attachCardEvents() {
  // Favorites toggle
  document.querySelectorAll('.btn-fav').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-fav-id');
      toggleFavorite(id);
    });
  });

  // Video button
  document.querySelectorAll('.btn-card-video').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-video-test');
      const test = state.tests.find(t => t.id === id);
      if (test && test.videos && test.videos.length > 0) {
        openVideoModal(test, 0);
      }
    });
  });

  // Full detail button
  document.querySelectorAll('.btn-card-detail').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-detail-id');
      const test = state.tests.find(t => t.id === id);
      if (test) openTestDetailModal(test);
    });
  });

  // Card click defaults to opening detail
  document.querySelectorAll('.test-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.getAttribute('data-id');
      const test = state.tests.find(t => t.id === id);
      if (test) openTestDetailModal(test);
    });
  });
}

// Open Full Test Clinical Detail Modal
function openTestDetailModal(test) {
  if (!DOM.modalContent) return;

  // Mark as completed in study progress
  if (!state.completed.includes(test.id)) {
    state.completed.push(test.id);
    localStorage.setItem('dolor_completed', JSON.stringify(state.completed));
    updateCounts();
  }

  const isFav = state.favorites.includes(test.id);
  const hasVideos = test.videos && test.videos.length > 0;

  DOM.modalContent.innerHTML = `
    <div class="modal-detail-header">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem;">
        <div>
          <div class="test-badges" style="margin-bottom: 0.5rem;">
            <span class="region-tag">${test.region_label}</span>
            <span class="category-tag">${test.category_label}</span>
          </div>
          <h2>${test.name}</h2>
          ${test.eponym ? `<div class="test-eponym" style="font-size: 0.9rem;">${test.eponym}</div>` : ''}
        </div>
        <button class="btn-fav ${isFav ? 'active' : ''}" data-fav-id="${test.id}" style="font-size: 1.6rem;">
          ${isFav ? '★' : '☆'}
        </button>
      </div>
    </div>

    <!-- Target & Objective -->
    <div class="modal-section">
      <div class="modal-section-title"><span>🎯</span> <span>Estructura Diana y Objetivo</span></div>
      <p class="modal-text"><strong>Estructura:</strong> ${test.target_structure}</p>
      <p class="modal-text"><strong>Objetivo:</strong> ${test.objective}</p>
    </div>

    <!-- Accuracy Metrics Bar -->
    <div class="modal-section">
      <div class="modal-section-title"><span>📊</span> <span>Valores Diagnósticos de Evidencia</span></div>
      <div class="accuracy-meters" style="margin-top: 0.35rem;">
        <div class="meter-box">
          <div class="meter-labels">
            <span class="meter-name">Sensibilidad (Sn)</span>
            <span class="meter-val">${test.sensitivity}</span>
          </div>
          <div class="meter-bar-track">
            <div class="meter-bar-fill sens" style="width: ${test.sens_val || 50}%;"></div>
          </div>
        </div>
        <div class="meter-box">
          <div class="meter-labels">
            <span class="meter-name">Especificidad (Sp)</span>
            <span class="meter-val">${test.specificity}</span>
          </div>
          <div class="meter-bar-track">
            <div class="meter-bar-fill spec" style="width: ${test.spec_val || 50}%;"></div>
          </div>
        </div>
      </div>
      <div style="display: flex; gap: 1rem; margin-top: 0.5rem; font-size: 0.8rem; color: var(--text-secondary);">
        <span>Likelihood Ratio (+): <strong style="color: var(--accent-emerald);">${test.lr_plus || 'N/D'}</strong></span>
        <span>Likelihood Ratio (-): <strong style="color: var(--accent-rose);">${test.lr_minus || 'N/D'}</strong></span>
      </div>
    </div>

    <!-- Patient & Examiner Position -->
    <div class="modal-section">
      <div class="modal-section-title"><span>🧍</span> <span>Posicionamiento</span></div>
      <p class="modal-text"><strong>Posición del Paciente:</strong> ${test.patient_position}</p>
      <p class="modal-text"><strong>Posición del Examinador:</strong> ${test.examiner_position}</p>
    </div>

    <!-- Procedure Steps -->
    <div class="modal-section">
      <div class="modal-section-title"><span>⚙️</span> <span>Procedimiento Paso a Paso</span></div>
      <ul class="procedure-steps">
        ${test.procedure.map(step => `<li>${step}</li>`).join('')}
      </ul>
    </div>

    <!-- Positive Sign & Interpretation -->
    <div class="modal-section">
      <div class="modal-section-title"><span>✅</span> <span>Criterio de Positividad e Interpretación</span></div>
      <p class="modal-text"><strong>Signo Positivo:</strong> ${test.positive_sign}</p>
      <p class="modal-text"><strong>Interpretación Clínica:</strong> ${test.clinical_interpretation}</p>
    </div>

    <!-- Exam Pearl Alert Box -->
    <div class="exam-pearl-alert">
      <strong>💡 ¡Recuerda para el examen y la consulta!</strong>
      ${test.exam_pearl}
    </div>

    <!-- Clinical Tip & Common Errors -->
    <div class="modal-section">
      <div class="modal-section-title"><span>⚠️</span> <span>Perla Clínica & Errores a Evitar</span></div>
      <p class="modal-text"><strong>Consejo Práctico:</strong> ${test.clinical_tip}</p>
      <p class="modal-text"><strong>Error Común:</strong> ${test.common_errors}</p>
    </div>

    <!-- Cluster and Differentials -->
    <div class="modal-section">
      <div class="modal-section-title"><span>🩺</span> <span>Diagnóstico Diferencial & Clúster</span></div>
      <p class="modal-text"><strong>Clúster Recomendado:</strong> ${test.cluster || 'Evaluación aislada o complementaria'}</p>
      <div style="display: flex; flex-wrap: wrap; gap: 0.35rem; margin-top: 0.35rem;">
        ${(test.differential_dx || []).map(d => `<span class="category-tag" style="background: rgba(59,130,246,0.1); color: var(--accent-blue);">${d}</span>`).join('')}
      </div>
    </div>

    <!-- Video Player Action in Modal -->
    ${hasVideos ? `
      <div class="modal-section" style="padding-top: 0.75rem; border-top: 1px solid var(--border-color);">
        <div class="modal-section-title"><span>🎬</span> <span>Vídeos Didácticos Disponibles</span></div>
        <div style="display: flex; flex-wrap: wrap; gap: 0.75rem; margin-top: 0.5rem;">
          ${test.videos.map((vid, idx) => `
            <button class="btn-card-video" style="padding: 0.6rem 1.1rem; font-size: 0.85rem;" onclick="openVideoModalFromDetail('${test.id}', ${idx})">
              <span>▶</span> <span>Ver vídeo de ${vid.channel}</span>
            </button>
          `).join('')}
        </div>
      </div>
    ` : ''}
  `;

  // Attach favorite event in modal
  const favBtn = DOM.modalContent.querySelector('.btn-fav');
  if (favBtn) {
    favBtn.addEventListener('click', () => {
      toggleFavorite(test.id);
      const nowFav = state.favorites.includes(test.id);
      favBtn.classList.toggle('active', nowFav);
      favBtn.textContent = nowFav ? '★' : '☆';
    });
  }

  DOM.testModal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

// Video Modal Controls (Verified Direct Embeds without errors)
function openVideoModal(test, videoIndex = 0) {
  if (!test.videos || !test.videos[videoIndex]) return;
  state.currentVideoTest = test;
  const vid = test.videos[videoIndex];

  DOM.videoModalTitle.textContent = test.name;
  DOM.videoModalChannel.textContent = vid.channel;
  
  // Set direct verified YouTube embed URL
  DOM.videoIframe.src = `https://www.youtube.com/embed/${vid.video_id.replace('educom-', '')}?autoplay=1&rel=0`;

  // Channel switcher and direct YouTube search link
  DOM.videoModalFooter.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; flex-wrap: wrap; gap: 0.65rem;">
      <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
        <span style="font-size: 0.8rem; color: var(--text-secondary); font-weight: 700;">Canal:</span>
        ${test.videos.map((v, i) => `
          <button class="channel-btn ${i === videoIndex ? 'active' : ''}" onclick="switchModalVideo(${i})">
            ${v.channel.includes('Educom') ? '🔴 Educom™' : '🔵 Physiotutors'}
          </button>
        `).join('')}
      </div>
      <a href="${vid.youtube_url}" target="_blank" rel="noopener" class="btn-card-video" style="text-decoration: none; padding: 0.4rem 0.85rem; font-size: 0.78rem; font-weight: 700;">
        <span>Ver en YouTube oficial</span> <span>↗</span>
      </a>
    </div>
  `;

  DOM.videoModal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

window.openVideoModalFromDetail = function(testId, videoIdx) {
  const test = state.tests.find(t => t.id === testId);
  if (test) openVideoModal(test, videoIdx);
};

window.switchModalVideo = function(videoIdx) {
  if (state.currentVideoTest) {
    openVideoModal(state.currentVideoTest, videoIdx);
  }
};

function closeAllModals() {
  if (DOM.testModal) DOM.testModal.style.display = 'none';
  if (DOM.videoModal) {
    DOM.videoModal.style.display = 'none';
    if (DOM.videoIframe) DOM.videoIframe.src = '';
  }
  document.body.style.overflow = '';
}

// Render Videoteca Tab (Sorted by Region & Test Name)
function renderVideoteca(channelFilter = 'all') {
  if (!DOM.videotecaGrid) return;

  let videoCards = [];
  // Sort tests by region and name
  const sortedTests = [...state.tests].sort((a, b) => a.name.localeCompare(b.name, 'es'));

  sortedTests.forEach(test => {
    if (test.videos && test.videos.length > 0) {
      test.videos.forEach((vid, vIdx) => {
        if (channelFilter === 'all' || vid.channel_id === channelFilter) {
          videoCards.push({
            test: test,
            video: vid,
            videoIndex: vIdx
          });
        }
      });
    }
  });

  if (videoCards.length === 0) {
    DOM.videotecaGrid.innerHTML = `
      <div class="no-results glass-panel" style="grid-column: 1/-1;">
        <h3>No hay vídeos para este filtro</h3>
      </div>
    `;
    return;
  }

  DOM.videotecaGrid.innerHTML = videoCards.map(item => {
    const cleanVidId = item.video.video_id ? item.video.video_id.replace('educom-', '').replace('physio-', '') : '';
    const thumbUrl = cleanVidId 
      ? `https://img.youtube.com/vi/${cleanVidId}/hqdefault.jpg`
      : 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=600&auto=format&fit=crop&q=60';

    return `
      <div class="video-item-card glass-panel" onclick="openVideoModalFromDetail('${item.test.id}', ${item.videoIndex})">
        <div class="video-thumbnail-box">
          <img src="${thumbUrl}" alt="${item.video.title}" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=600&auto=format&fit=crop&q=60';">
          <div class="play-overlay-btn">▶</div>
        </div>
        <div class="video-item-body">
          <div>
            <span class="video-item-channel ${item.video.channel_id}">${item.video.channel}</span>
            <h4 class="video-item-title">${item.video.title}</h4>
          </div>
          <div class="video-item-test-name">
            <span>🩺 ${item.test.name}</span> · <span style="color: var(--accent-blue);">${item.test.region_label}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Render Comparative Table
function renderComparativeTable() {
  if (!DOM.comparativeTableBody) return;
  DOM.comparativeTableBody.innerHTML = state.tests.map(test => `
    <tr>
      <td><strong>${test.name}</strong></td>
      <td><span class="region-tag">${test.region_label}</span></td>
      <td style="color: var(--text-secondary);">${test.target_structure}</td>
      <td><span class="table-badge-sens">${test.sensitivity}</span></td>
      <td><span class="table-badge-spec">${test.specificity}</span></td>
      <td><strong style="color: var(--accent-emerald);">${test.lr_plus || '-'}</strong></td>
      <td>
        <button class="btn-card-detail" style="padding: 0.25rem 0.6rem; font-size: 0.72rem;" onclick="openTestById('${test.id}')">
          Ficha
        </button>
      </td>
    </tr>
  `).join('');
}

window.openTestById = function(id) {
  const test = state.tests.find(t => t.id === id);
  if (test) openTestDetailModal(test);
};

// Render Official Notion 'TEST DE EXPLORACION POR AREAS' Document
let currentNotionOfficialFilter = 'all';

function renderNotionGuide() {
  if (!DOM.notionGuideContainer || !state.catalog) return;

  const officialAreas = state.catalog.notion_official_areas || [];
  if (officialAreas.length === 0) return;

  let displayAreas = officialAreas;
  if (currentNotionOfficialFilter !== 'all') {
    displayAreas = officialAreas.filter(a => a.id === currentNotionOfficialFilter);
  }

  DOM.notionGuideContainer.innerHTML = displayAreas.map(area => `
    <article class="notion-chapter-block" id="${area.id}">
      <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1.25rem; border-bottom: 2px solid var(--border-color); padding-bottom: 0.75rem;">
        <span style="font-size: 2.2rem;">${area.icon}</span>
        <h1 class="notion-h1" style="margin: 0; border: none; font-size: 1.85rem;">${area.title}</h1>
      </div>
      ${area.html_content}
    </article>
  `).join('');

  attachNotionTocEvents();
}

function attachNotionTocEvents() {
  document.querySelectorAll('.notion-toc-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.notion-toc-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const target = btn.getAttribute('data-target');
      currentNotionOfficialFilter = target;
      renderNotionGuide();
      window.scrollTo({ top: DOM.notionGuideContainer.offsetTop - 80, behavior: 'smooth' });
    });
  });
}


// Render Fichas de Consulta de Dolor (Official Notion Format)
let currentFichaFilter = 'all';

function renderFichas() {
  if (!DOM.fichasContainer || !state.catalog) return;

  const fichasList = state.catalog.fichas_notion_official || state.catalog.fichas_consulta || [];
  if (fichasList.length === 0) return;

  let displayFichas = fichasList;
  if (currentFichaFilter !== 'all') {
    displayFichas = fichasList.filter(f => f.category === currentFichaFilter);
  }

  DOM.fichasContainer.innerHTML = displayFichas.map(f => `
    <article class="ficha-notion-card glass-panel" id="${f.id}">
      <div class="ficha-notion-header">
        <div style="display: flex; align-items: center; justify-content: space-between; width: 100%; flex-wrap: wrap; gap: 0.75rem;">
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <span style="font-size: 2rem;">${f.icon}</span>
            <div>
              <h2 class="ficha-notion-title">${f.title}</h2>
              <div style="display: flex; align-items: center; gap: 0.5rem; margin-top: 0.25rem;">
                <span class="region-tag">${f.region}</span>
                <span style="font-size: 0.72rem; font-weight: 700; background: rgba(99, 102, 241, 0.15); color: #818cf8; padding: 0.15rem 0.5rem; border-radius: 4px; border: 1px solid rgba(99, 102, 241, 0.3);">
                  Notion Oficial v2.6
                </span>
              </div>
            </div>
          </div>
          <button class="coach-copy-btn" onclick="window.copyFichaText('${f.id}')" style="align-self: flex-start;">
            <span>📋</span> <span>Copiar Ficha</span>
          </button>
        </div>
      </div>

      <div class="ficha-notion-body">
        ${f.html_content || ''}
      </div>
    </article>
  `).join('');

  attachFichasFilterEvents();
}

window.copyFichaText = function(fichaId) {
  if (!state.catalog) return;
  const fichasList = state.catalog.fichas_notion_official || state.catalog.fichas_consulta || [];
  const ficha = fichasList.find(f => f.id === fichaId);
  if (!ficha) return;

  const textToCopy = ficha.full_text || ficha.title;
  navigator.clipboard.writeText(textToCopy).then(() => {
    alert(`✅ Ficha "${ficha.title}" copiada al portapapeles con éxito.`);
  }).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = textToCopy;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    alert(`✅ Ficha "${ficha.title}" copiada al portapapeles.`);
  });
};

window.openFicha = function(fichaId) {
  if (typeof window.switchTab === 'function') {
    window.switchTab('tab-fichas');
  }

  currentFichaFilter = 'all';
  document.querySelectorAll('.fichas-filter-chip').forEach(c => {
    c.classList.toggle('active', c.getAttribute('data-ficha-filter') === 'all');
  });
  renderFichas();

  setTimeout(() => {
    const el = document.getElementById(fichaId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      el.classList.add('highlight-pulse');
      setTimeout(() => el.classList.remove('highlight-pulse'), 2500);
    }
  }, 120);
};

function attachFichasFilterEvents() {
  document.querySelectorAll('.fichas-filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.fichas-filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentFichaFilter = chip.getAttribute('data-ficha-filter');
      renderFichas();
      window.scrollTo({ top: DOM.fichasContainer.offsetTop - 80, behavior: 'smooth' });
    });
  });
}


// Interactive Case Answering Logic
window.answerCaseQuestion = function(caseId, selectedIdx) {
  if (!state.catalog || !state.catalog.clinical_cases) return;
  if (state.answeredCases && state.answeredCases[caseId] !== undefined) return; // already answered

  const caseObj = state.catalog.clinical_cases.find(c => c.id === caseId);
  if (!caseObj) return;

  const correctIdx = caseObj.correct_index;
  const isCorrect = (selectedIdx === correctIdx);

  if (!state.answeredCases) state.answeredCases = {};
  state.answeredCases[caseId] = { selected: selectedIdx, isCorrect: isCorrect };

  state.quizTotal = (state.quizTotal || 0) + 1;
  if (isCorrect) {
    state.quizScore = (state.quizScore || 0) + 1;
  }

  // Update Score Badge
  if (DOM.quizScoreDisplay) {
    DOM.quizScoreDisplay.textContent = `${state.quizScore}/${state.quizTotal}`;
  }

  // Update Buttons in DOM
  const caseCard = document.getElementById(`case-${caseId}`);
  if (caseCard) {
    const btns = caseCard.querySelectorAll('.case-option-btn');
    btns.forEach((btn, idx) => {
      btn.disabled = true;
      btn.style.cursor = 'default';
      if (idx === correctIdx) {
        btn.classList.add('correct');
        btn.innerHTML = `✅ ${btn.textContent.trim()}`;
      } else if (idx === selectedIdx && !isCorrect) {
        btn.classList.add('incorrect');
        btn.innerHTML = `❌ ${btn.textContent.trim()}`;
      }
    });

    // Reveal Feedback Box
    const feedbackBox = document.getElementById(`feedback-${caseId}`);
    if (feedbackBox) {
      feedbackBox.style.display = 'block';
      feedbackBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }
};


// Render Clinical Cases / Quiz (Notion ALICIA-ABCDE & Expert Manual)
let currentCaseFilter = 'all';

function renderCases() {
  if (!DOM.casesContainer || !state.catalog || !state.catalog.clinical_cases) return;

  let casesList = [...state.catalog.clinical_cases];
  if (currentCaseFilter !== 'all') {
    if (currentCaseFilter === 'notion' || currentCaseFilter === 'manual_pdf') {
      casesList = casesList.filter(c => c.source === currentCaseFilter);
    } else {
      casesList = casesList.filter(c => c.category === currentCaseFilter);
    }
  }

  DOM.casesContainer.innerHTML = casesList.map((c, cIdx) => {
    const answered = state.answeredCases && state.answeredCases[c.id];
    const isAnswered = !!answered;
    const selectedIdx = isAnswered ? answered.selected : null;
    const isCorrect = isAnswered ? answered.isCorrect : false;

    return `
      <div class="case-card glass-panel" id="case-${c.id}">
        <div class="case-header">
          <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
            <span class="case-source-badge ${c.source}">
              ${c.source === 'notion' ? '🧠 Notion ALICIA-ABCDE' : '📚 Manual Pensamiento Experto'}
            </span>
            <span class="category-tag">${c.category.toUpperCase()}</span>
          </div>
          <h3 class="case-title" style="margin-top: 0.35rem;">${c.title}</h3>
        </div>

        <div class="case-patient-box">
          <strong>📋 Presentación del Paciente:</strong>
          <p style="margin-top: 0.25rem;">${c.patient}</p>
        </div>

        <div class="case-findings-list">
          ${c.findings.map(f => `
            <div class="finding-pill">
              <strong>${f.test}:</strong> ${f.result}
            </div>
          `).join('')}
        </div>

        <div class="case-question-title">❓ ${c.question}</div>

        <div class="case-options" data-case-id="${c.id}" data-correct="${c.correct_index}">
          ${c.options.map((opt, oIdx) => {
            let extraClass = '';
            let label = opt;
            let disabledAttr = '';
            if (isAnswered) {
              disabledAttr = 'disabled style="cursor: default;"';
              if (oIdx === c.correct_index) {
                extraClass = 'correct';
                label = `✅ ${opt}`;
              } else if (oIdx === selectedIdx && !isCorrect) {
                extraClass = 'incorrect';
                label = `❌ ${opt}`;
              }
            }
            return `
              <button class="case-option-btn ${extraClass}" data-opt-idx="${oIdx}" ${disabledAttr} onclick="window.answerCaseQuestion('${c.id}', ${oIdx})">
                ${label}
              </button>
            `;
          }).join('')}
        </div>

        <div class="case-feedback" id="feedback-${c.id}" style="${isAnswered ? 'display: block;' : 'display: none;'}">
          <strong>💡 Razonamiento Diagnóstico:</strong>
          <p style="margin-top: 0.25rem;">${c.explanation}</p>

          ${c.expert_thinking ? `
            <div class="expert-breakdown-box">
              <div class="expert-box-title">
                <span>🧠</span> <span>Estructura Mental del Experto en Consulta</span>
              </div>

              <div class="expert-grid-2">
                <div class="expert-subcard">
                  <h5 style="color: var(--accent-blue);">📋 Fenotipo ALICIA</h5>
                  <p>${c.expert_thinking.alicia}</p>
                </div>
                <div class="expert-subcard">
                  <h5 style="color: #7c3aed;">🎯 Modelo ABCDE</h5>
                  <p>${c.expert_thinking.abcde}</p>
                </div>
              </div>

              <div class="expert-grid-2">
                <div class="expert-subcard expert-what-todo">
                  <h5 style="color: var(--accent-emerald);">✅ Plan de Acción: Qué Hacer</h5>
                  <p>${c.expert_thinking.what_to_do}</p>
                </div>
                <div class="expert-subcard expert-what-not">
                  <h5 style="color: var(--accent-rose);">⚠️ Errores y Trampas: Qué NO Hacer</h5>
                  <p>${c.expert_thinking.what_not_to_do}</p>
                </div>
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');

  attachCaseFilterEvents();
}

function attachCaseFilterEvents() {
  document.querySelectorAll('.case-filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.case-filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentCaseFilter = chip.getAttribute('data-case-filter');
      renderCases();
    });
  });
}

// Render Favorites Tab
function renderFavorites() {
  if (!DOM.favGrid) return;
  const favTests = state.tests.filter(t => state.favorites.includes(t.id));

  if (favTests.length === 0) {
    DOM.favGrid.innerHTML = '';
    DOM.noFavsNotice.style.display = 'block';
    return;
  }

  DOM.noFavsNotice.style.display = 'none';
  DOM.favGrid.innerHTML = favTests.map(test => {
    const hasVideo = test.videos && test.videos.length > 0;
    return `
      <article class="test-card glass-panel" data-id="${test.id}">
        <div>
          <div class="test-card-top">
            <div class="test-badges">
              <span class="region-tag">${test.region_label}</span>
              <span class="category-tag">${test.category_label}</span>
            </div>
            <button class="btn-fav active" data-fav-id="${test.id}">★</button>
          </div>
          <div class="test-card-title" style="margin-top: 0.65rem;">
            <h3>${test.name}</h3>
            ${test.eponym ? `<span class="test-eponym">${test.eponym}</span>` : ''}
          </div>
          <div class="test-target" style="margin-top: 0.5rem;">
            <span class="target-icon">🎯</span>
            <span>${test.target_structure}</span>
          </div>
          <div class="accuracy-meters" style="margin-top: 0.75rem;">
            <div class="meter-box">
              <div class="meter-labels"><span>Sn</span><span>${test.sensitivity}</span></div>
              <div class="meter-bar-track"><div class="meter-bar-fill sens" style="width: ${test.sens_val || 50}%;"></div></div>
            </div>
            <div class="meter-box">
              <div class="meter-labels"><span>Sp</span><span>${test.specificity}</span></div>
              <div class="meter-bar-track"><div class="meter-bar-fill spec" style="width: ${test.spec_val || 50}%;"></div></div>
            </div>
          </div>
        </div>
        <div class="test-card-footer">
          ${hasVideo ? `
            <button class="btn-card-video" data-video-test="${test.id}">
              <span>▶</span> <span>Vídeo HD</span>
            </button>
          ` : `<span></span>`}
          <button class="btn-card-detail" data-detail-id="${test.id}">
            <span>Ver Ficha</span> <span>→</span>
          </button>
        </div>
      </article>
    `;
  }).join('');

  attachCardEvents();
}

// Favorite Toggle Helper
function toggleFavorite(id) {
  const idx = state.favorites.indexOf(id);
  if (idx >= 0) {
    state.favorites.splice(idx, 1);
  } else {
    state.favorites.push(id);
  }
  localStorage.setItem('dolor_favs', JSON.stringify(state.favorites));
  updateCounts();
  applyFilterAndSort();
  renderFavorites();
}

// Event Listeners Setup
function setupEventListeners() {
  // Search input
  if (DOM.searchInput) {
    DOM.searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      if (DOM.clearSearchBtn) {
        DOM.clearSearchBtn.style.display = state.searchQuery ? 'block' : 'none';
      }
      applyFilterAndSort();
    });
  }

  if (DOM.clearSearchBtn) {
    DOM.clearSearchBtn.addEventListener('click', () => {
      DOM.searchInput.value = '';
      state.searchQuery = '';
      DOM.clearSearchBtn.style.display = 'none';
      applyFilterAndSort();
      DOM.searchInput.focus();
    });
  }

  // Reset filter button
  if (DOM.btnResetFilters) {
    DOM.btnResetFilters.addEventListener('click', () => {
      setFilter('all');
      DOM.searchInput.value = '';
      state.searchQuery = '';
      applyFilterAndSort();
    });
  }

  // Toggle Atlas button
  if (DOM.btnToggleAtlas) {
    DOM.btnToggleAtlas.addEventListener('click', () => toggleAtlas());
  }

  if (DOM.btnCloseAtlas) {
    DOM.btnCloseAtlas.addEventListener('click', () => toggleAtlas(false));
  }

  // SVG Hotspots
  document.querySelectorAll('.joint-hotspot').forEach(hotspot => {
    hotspot.addEventListener('click', () => {
      const reg = hotspot.getAttribute('data-region');
      setFilter(reg);
      toggleAtlas(false);
      switchTab('tab-tests');
    });
  });

  // Filter chips
  document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const filter = chip.getAttribute('data-filter');
      setFilter(filter);
    });
  });

  // Sort dropdown
  if (DOM.sortSelect) {
    DOM.sortSelect.addEventListener('change', (e) => {
      state.sortBy = e.target.value;
      applyFilterAndSort();
    });
  }

  // Desktop Navigation tabs
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const tabId = tab.getAttribute('data-tab');
      switchTab(tabId);
    });
  });

  // Mobile Bottom bar items
  document.querySelectorAll('.mobile-nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const tabId = item.getAttribute('data-tab');
      switchTab(tabId);
    });
  });

  // Videoteca channel switcher
  document.querySelectorAll('.channel-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.channel-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const ch = btn.getAttribute('data-channel');
      renderVideoteca(ch);
    });
  });

  // Modals close triggers
  if (DOM.modalCloseBtn) DOM.modalCloseBtn.addEventListener('click', closeAllModals);
  if (DOM.videoModalCloseBtn) DOM.videoModalCloseBtn.addEventListener('click', closeAllModals);

  // Close modals on overlay backdrop click
  window.addEventListener('click', (e) => {
    if (e.target === DOM.testModal || e.target === DOM.videoModal) {
      closeAllModals();
    }
  });

  // Theme Toggle
  if (DOM.btnThemeToggle) {
    DOM.btnThemeToggle.addEventListener('click', toggleTheme);
  }
}

// Toggle Atlas View
function toggleAtlas(forceState) {
  if (!DOM.atlasSection) return;
  const isVisible = forceState !== undefined ? forceState : !DOM.atlasSection.classList.contains('visible');
  DOM.atlasSection.classList.toggle('visible', isVisible);
}

// Switch Filter Helper
function setFilter(filter) {
  state.currentFilter = filter;
  document.querySelectorAll('.filter-chip').forEach(c => {
    c.classList.toggle('active', c.getAttribute('data-filter') === filter);
  });
  applyFilterAndSort();
}

// Switch Navigation Tab
window.switchTab = function(tabId) {
  state.currentTab = tabId;

  // Ensure home and clinical containers are hidden and library containers are shown
  const homeEl = document.getElementById('home-screen');
  const clinicalEl = document.getElementById('clinical-reasoning-container');
  const mainHeader = document.querySelector('.main-header');
  const navTabs = document.querySelector('.nav-tabs-wrapper');
  const filtersSection = document.querySelector('.filters-section');
  const mainContent = document.querySelector('.main-content');

  if (homeEl) homeEl.style.display = 'none';
  if (clinicalEl) clinicalEl.style.display = 'none';
  if (mainHeader) mainHeader.style.display = 'block';
  if (navTabs) navTabs.style.display = 'block';
  if (filtersSection) filtersSection.style.display = 'block';
  if (mainContent) mainContent.style.display = 'block';

  // Desktop tabs sync
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.classList.toggle('active', tab.getAttribute('data-tab') === tabId);
  });

  // Mobile bar sync
  document.querySelectorAll('.mobile-nav-item').forEach(item => {
    item.classList.toggle('active', item.getAttribute('data-tab') === tabId);
  });

  // Tab panes sync
  document.querySelectorAll('.tab-pane').forEach(pane => {
    pane.classList.toggle('active', pane.id === tabId);
  });

  if (tabId === 'tab-vademecum' && window.Vademecum) {
    window.Vademecum.setMode('express');
  }

  if (tabId === 'tab-ultrasound' && window.Ultrasound) {
    window.Ultrasound.setMode('quick');
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
};

// Update Heading Metadata
function updateHeaderMeta() {
  if (!DOM.activeFilterHeading || !DOM.activeFilterCount) return;

  let title = 'Todos los Tests de Exploración';
  if (state.currentFilter !== 'all') {
    const regObj = state.catalog && state.catalog.metadata.regions.find(r => r.id === state.currentFilter);
    if (regObj) title = `Tests de ${regObj.name}`;
    else if (state.currentFilter === 'has_video') title = 'Tests con Vídeo Didáctico HD';
  }

  if (state.searchQuery) {
    title = `Búsqueda: "${state.searchQuery}"`;
  }

  DOM.activeFilterHeading.textContent = title;
  DOM.activeFilterCount.textContent = `Mostrando ${state.filtered.length} prueba${state.filtered.length === 1 ? '' : 's'}`;
}

// Theme Engine (Light Default / Dark Optional)
function initTheme() {
  const saved = localStorage.getItem('dolor_theme');
  state.theme = (saved === 'dark') ? 'dark' : 'light';
  document.body.className = state.theme === 'dark' ? 'dark-theme' : 'light-theme';
  
  // Update meta theme-color for iOS status bar
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    metaTheme.setAttribute('content', state.theme === 'dark' ? '#0a0f1d' : '#f8fafc');
  }

  updateThemeButton();
}

function toggleTheme() {
  state.theme = state.theme === 'light' ? 'dark' : 'light';
  localStorage.setItem('dolor_theme', state.theme);
  initTheme();
}

window.toggleAppTheme = function() {
  toggleTheme();
};

function updateThemeButton() {
  const navIcon = document.getElementById('navThemeIcon');
  const navLabel = document.getElementById('navThemeLabel');
  const homeIcon = document.getElementById('homeThemeIcon');
  const homeLabel = document.getElementById('homeThemeLabel');

  if (state.theme === 'light') {
    if (DOM.themeIcon) DOM.themeIcon.textContent = '🌙';
    if (DOM.themeLabel) DOM.themeLabel.textContent = 'Oscuro';
    if (navIcon) navIcon.textContent = '🌙';
    if (navLabel) navLabel.textContent = 'Modo Oscuro';
    if (homeIcon) homeIcon.textContent = '🌙';
    if (homeLabel) homeLabel.textContent = 'Modo Oscuro';
  } else {
    if (DOM.themeIcon) DOM.themeIcon.textContent = '☀️';
    if (DOM.themeLabel) DOM.themeLabel.textContent = 'Claro';
    if (navIcon) navIcon.textContent = '☀️';
    if (navLabel) navLabel.textContent = 'Modo Claro';
    if (homeIcon) homeIcon.textContent = '☀️';
    if (homeLabel) homeLabel.textContent = 'Modo Claro';
  }
}

// Keyboard Shortcuts
function setupKeyboardShortcuts() {
  window.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement !== DOM.searchInput) {
      e.preventDefault();
      DOM.searchInput.focus();
    }
    if (e.key === 'Escape') {
      closeAllModals();
      toggleAtlas(false);
    }
  });
}

// PWA Service Worker
function registerPWA() {
  if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(err => {
        console.log('SW registration note:', err);
      });
    });
  }
}
