'use strict';

/* ===== 헬퍼 함수 ===== */
function healthClass(score) {
  if (score === null) return '';
  if (score >= 80) return 'good';
  if (score >= 60) return 'warn';
  return 'danger';
}

function healthLabel(score) {
  if (score === null) return '알 수 없음';
  if (score >= 80) return '양호';
  if (score >= 60) return '주의';
  return '교체 권장';
}

function fmtMwh(mwh) {
  if (mwh === null || mwh === undefined) return '-';
  return mwh.toLocaleString() + ' mWh';
}

function fmtSeconds(secs) {
  if (!secs) return '-';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h === 0) return `${m}분`;
  if (m === 0) return `${h}시간`;
  return `${h}시간 ${m}분`;
}

/**
 * 오늘 날짜의 배터리/AC 사용 시간 계산
 * usageHistory의 마지막 항목(최근 날짜)을 사용
 */
function getTodayUsage(usageHistory) {
  if (!usageHistory || usageHistory.length === 0) return null;
  // 마지막 항목이 가장 최근 기간
  const last = usageHistory[usageHistory.length - 1];
  return last;
}

/**
 * 반원 게이지 SVG 생성
 */
function buildGaugeSvg(score) {
  const r = 60;
  const cx = 80;
  const cy = 75;
  const strokeWidth = 12;
  const circum = Math.PI * r; // 반원 둘레
  const pct = score === null ? 0 : Math.min(100, Math.max(0, score));
  const offset = circum * (1 - pct / 100);

  const color = score >= 80 ? '#51cf66' : score >= 60 ? '#ff922b' : '#fa5252';

  return `
    <svg class="gauge-svg" width="160" height="90" viewBox="0 0 160 90">
      <!-- 배경 반원 -->
      <path
        d="M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}"
        fill="none"
        stroke="#2a2a40"
        stroke-width="${strokeWidth}"
        stroke-linecap="round"
      />
      <!-- 채워진 반원 -->
      <path
        d="M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}"
        fill="none"
        stroke="${color}"
        stroke-width="${strokeWidth}"
        stroke-linecap="round"
        stroke-dasharray="${circum}"
        stroke-dashoffset="${offset}"
        style="transform-origin: ${cx}px ${cy}px; transform: scaleX(-1);"
      />
      <!-- 중앙 텍스트 -->
      <text x="${cx}" y="${cy - 6}" text-anchor="middle" font-size="22" font-weight="700" fill="${color}" font-family="'Segoe UI', sans-serif">
        ${score !== null ? score.toFixed(1) + '%' : '-'}
      </text>
      <text x="${cx}" y="${cy + 12}" text-anchor="middle" font-size="11" fill="#9090a8" font-family="'Segoe UI', sans-serif">
        배터리 헬스
      </text>
    </svg>
  `;
}

/* ===== View 모듈 ===== */
window.DashboardView = {
  render(data) {
    const battery = data.batteries[0] || {};
    const score = data.healthScore;
    const hClass = healthClass(score);
    const hLabel = healthLabel(score);

    const sysInfo = data.systemInfo;
    const productName = sysInfo['SYSTEM_PRODUCT_NAME'] || sysInfo['COMPUTER_NAME'] || '-';
    const osBuild = sysInfo['OS_BUILD'] || '-';
    const reportTime = data.reportTime || '-';

    const todayUsage = getTodayUsage(data.usageHistory);
    const batteryActiveSec = todayUsage ? todayUsage.batteryActiveSeconds : null;
    const acActiveSec = todayUsage ? todayUsage.acActiveSeconds : null;
    const todayPeriod = todayUsage ? todayUsage.period : '';

    const designCap = battery.designCapacity || 0;
    const fullCap = battery.fullChargeCapacity || 0;
    const wearMwh = designCap - fullCap;

    // 최근 배터리 잔량 (recentUsage 마지막 항목)
    const lastEntry = data.recentUsage && data.recentUsage.length > 0
      ? data.recentUsage[data.recentUsage.length - 1]
      : null;
    const lastPercent = lastEntry ? lastEntry.capacityPercent : null;
    const lastSource = lastEntry ? lastEntry.source : null;

    return `
      <div class="view-header">
        <div class="view-title">대시보드</div>
        <div class="view-subtitle">${productName} · 리포트: ${reportTime}</div>
      </div>

      <!-- 상단 주요 지표 카드 -->
      <div class="card-grid card-grid-3" style="grid-template-columns: 220px 1fr 1fr;">
        <!-- 배터리 헬스 게이지 -->
        <div class="card gauge-card">
          <div class="gauge-container">
            ${buildGaugeSvg(score)}
            <div>
              <span class="status-badge ${hClass}">
                <span class="status-dot"></span>
                ${hLabel}
              </span>
            </div>
          </div>
        </div>

        <!-- 사이클 수 + 현재 잔량 -->
        <div style="display:flex; flex-direction:column; gap:16px;">
          <div class="card">
            <div class="card-label">사이클 수</div>
            <div class="card-value">${battery.cycleCount || '-'}</div>
            <div class="card-sub">충전 사이클 (낮을수록 좋음)</div>
          </div>
          <div class="card">
            <div class="card-label">현재 잔량</div>
            <div class="card-value" style="font-size:22px;">
              ${lastPercent !== null ? lastPercent + ' %' : '-'}
            </div>
            <div class="card-sub">
              ${lastSource
                ? `<span class="source-badge ${lastSource.toLowerCase() === 'ac' ? 'ac' : 'battery'}">${lastSource}</span>`
                : ''}
              ${lastEntry ? `기준: ${lastEntry.dateTime}` : ''}
            </div>
          </div>
        </div>

        <!-- 용량 상세 -->
        <div class="card">
          <div class="card-label">배터리 용량</div>
          <div style="margin-top: 8px;">
            <div class="capacity-row">
              <span class="capacity-label">설계 용량</span>
              <span class="capacity-value">${fmtMwh(designCap)}</span>
              <div class="capacity-bar-wrap">
                <div class="capacity-bar-fill" style="width:100%; background: var(--border-color);"></div>
              </div>
            </div>
            <div class="capacity-row">
              <span class="capacity-label">현재 용량</span>
              <span class="capacity-value">${fmtMwh(fullCap)}</span>
              <div class="capacity-bar-wrap">
                <div class="capacity-bar-fill" style="width:${score !== null ? score : 0}%; background:${score >= 80 ? 'var(--color-ac)' : score >= 60 ? 'var(--color-warn)' : 'var(--color-danger)'};"></div>
              </div>
            </div>
            <div class="capacity-row">
              <span class="capacity-label">손실량</span>
              <span class="capacity-value" style="color: var(--color-battery);">${fmtMwh(wearMwh > 0 ? wearMwh : 0)}</span>
              <div class="capacity-bar-wrap">
                <div class="capacity-bar-fill" style="width:${score !== null ? (100 - score) : 0}%; background: var(--color-battery);"></div>
              </div>
            </div>
          </div>
          <div class="divider"></div>
          <div style="display:flex; justify-content:space-between; font-size:12px;">
            <span style="color: var(--text-secondary);">배터리명: <span style="color:var(--text-primary);">${battery.name || '-'}</span></span>
            <span style="color: var(--text-secondary);">${battery.chemistry || '-'}</span>
          </div>
        </div>
      </div>

      <!-- 오늘 사용 현황 -->
      <div class="card-grid card-grid-4">
        <div class="card">
          <div class="card-label">배터리 사용 (오늘)</div>
          <div class="card-value" style="font-size:22px; color: var(--color-battery);">
            ${fmtSeconds(batteryActiveSec)}
          </div>
          <div class="card-sub">${todayPeriod || '최근 기간'}</div>
        </div>
        <div class="card">
          <div class="card-label">AC 사용 (오늘)</div>
          <div class="card-value" style="font-size:22px; color: var(--color-ac);">
            ${fmtSeconds(acActiveSec)}
          </div>
          <div class="card-sub">${todayPeriod || '최근 기간'}</div>
        </div>
        <div class="card">
          <div class="card-label">제조사</div>
          <div class="card-value" style="font-size:18px;">${battery.manufacturer || '-'}</div>
          <div class="card-sub">화학성분: ${battery.chemistry || '-'}</div>
        </div>
        <div class="card">
          <div class="card-label">헬스 기준</div>
          <div style="margin-top:8px; font-size:12px; color:var(--text-secondary); line-height:1.8;">
            <div><span style="color:var(--color-ac);">■</span> 80% 이상 — 양호</div>
            <div><span style="color:var(--color-warn);">■</span> 60~80% — 주의</div>
            <div><span style="color:var(--color-danger);">■</span> 60% 미만 — 교체 권장</div>
          </div>
        </div>
      </div>

      <!-- 시스템 정보 -->
      <div class="data-table-wrapper">
        <div class="data-table-header">
          <span class="data-table-title">시스템 정보</span>
        </div>
        <div class="info-grid" style="padding:16px; gap:10px;">
          ${Object.entries(sysInfo).map(([key, val]) => `
            <div class="info-item">
              <div class="info-label">${key.replace(/_/g, ' ')}</div>
              <div class="info-value">${val}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  },

  initCharts() { return []; },
};
