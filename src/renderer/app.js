'use strict';

/* ===== 앱 상태 ===== */
const App = {
  data: null,
  currentView: 'dashboard',
  charts: [],
};

/* ===== DOM 요소 ===== */
const loadingOverlay = document.getElementById('loading-overlay');
const errorScreen = document.getElementById('error-screen');
const errorMessage = document.getElementById('error-message');
const viewContainer = document.getElementById('view-container');
const navItems = document.querySelectorAll('.nav-item');
const refreshBtn = document.getElementById('refresh-btn');
const loadFileBtn = document.getElementById('load-file-btn');
const retryBtn = document.getElementById('retry-btn');

/* ===== 뷰 매핑 ===== */
const views = {
  'dashboard': window.DashboardView,
  'battery-health': window.BatteryHealthView,
  'recent-activity': window.RecentActivityView,
  'battery-usage': window.BatteryUsageView,
  'usage-history': window.UsageHistoryView,
  'estimates': window.EstimatesView,
};

/* ===== UI 상태 관리 ===== */
function showLoading(text = '배터리 리포트 생성 중...') {
  loadingOverlay.querySelector('.loading-text').textContent = text;
  loadingOverlay.classList.remove('hidden');
  errorScreen.classList.add('hidden');
  viewContainer.classList.add('hidden');
}

function showError(msg) {
  loadingOverlay.classList.add('hidden');
  errorScreen.classList.remove('hidden');
  viewContainer.classList.add('hidden');
  errorMessage.textContent = msg;
}

function showView() {
  loadingOverlay.classList.add('hidden');
  errorScreen.classList.add('hidden');
  viewContainer.classList.remove('hidden');
}

/* ===== 기존 차트 정리 ===== */
function destroyCharts() {
  App.charts.forEach((chart) => {
    try { chart.destroy(); } catch (_) {}
  });
  App.charts = [];
}

/* ===== 뷰 렌더링 ===== */
function renderView(viewName) {
  destroyCharts();

  const ViewModule = views[viewName];
  if (!ViewModule || !App.data) return;

  viewContainer.innerHTML = ViewModule.render(App.data);

  // 차트 초기화 (비동기로 DOM이 준비된 후)
  requestAnimationFrame(() => {
    if (ViewModule.initCharts) {
      const newCharts = ViewModule.initCharts(App.data);
      if (newCharts) App.charts.push(...newCharts);
    }
    if (ViewModule.bindEvents) {
      ViewModule.bindEvents(App.data);
    }
  });
}

/* ===== 네비게이션 ===== */
function navigateTo(viewName) {
  if (App.currentView === viewName && App.data) return;
  App.currentView = viewName;

  navItems.forEach((item) => {
    item.classList.toggle('active', item.dataset.view === viewName);
  });

  if (App.data) {
    renderView(viewName);
  }
}

/* ===== 배터리 없음 경고 모달 ===== */
function showNoBatteryModal() {
  // 로딩/에러 화면 숨김
  loadingOverlay.classList.add('hidden');
  errorScreen.classList.add('hidden');

  const overlay = document.createElement('div');
  overlay.className = 'no-battery-overlay';
  overlay.innerHTML = `
    <div class="no-battery-modal">
      <div class="no-battery-icon">
        <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
          <path d="M28 4L52 48H4L28 4Z" fill="#ff922b20" stroke="#ff922b" stroke-width="2.5" stroke-linejoin="round"/>
          <line x1="28" y1="20" x2="28" y2="34" stroke="#ff922b" stroke-width="3" stroke-linecap="round"/>
          <circle cx="28" cy="41" r="2" fill="#ff922b"/>
        </svg>
      </div>
      <h2 class="no-battery-title">배터리 감지 실패</h2>
      <p class="no-battery-desc">이 PC에서 배터리가 감지되지 않았습니다.</p>
      <p class="no-battery-sub">
        Windows Battery Manager는 배터리가 장착된<br>
        노트북 전용 프로그램입니다.
      </p>
      <button class="no-battery-quit-btn" id="no-battery-quit">앱 종료</button>
    </div>
  `;
  document.body.appendChild(overlay);

  document.getElementById('no-battery-quit').addEventListener('click', () => {
    window.healthAPI.quitApp();
  });
}

/* ===== 리포트 로드 ===== */
async function loadReport(source) {
  showLoading(source === 'generate' ? '배터리 리포트 생성 중...' : '파일 불러오는 중...');

  try {
    let result;
    if (source === 'generate') {
      result = await window.healthAPI.generateReport();
    } else if (source === 'dialog') {
      result = await window.healthAPI.openReportDialog();
    }

    if (!result || !result.success) {
      if (result?.noBattery) {
        showNoBatteryModal();
        return;
      }
      const msg = result?.error || '알 수 없는 오류가 발생했습니다.';
      if (msg === 'cancelled') {
        // 취소 시 기존 상태 유지
        if (App.data) showView();
        else showError('리포트를 불러오지 못했습니다. 파일을 선택하거나 새로 고침을 눌러주세요.');
        return;
      }
      showError(msg);
      return;
    }

    App.data = result.data;
    showView();
    renderView(App.currentView);
  } catch (err) {
    showError(err.message || '리포트 생성 중 오류가 발생했습니다.');
  }
}

/* ===== 이벤트 바인딩 ===== */
navItems.forEach((item) => {
  item.addEventListener('click', () => navigateTo(item.dataset.view));
});

refreshBtn.addEventListener('click', () => loadReport('generate'));
loadFileBtn.addEventListener('click', () => loadReport('dialog'));
retryBtn.addEventListener('click', () => loadReport('generate'));

/* ===== 앱 시작 ===== */
loadReport('generate');
