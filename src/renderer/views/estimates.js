'use strict';

function fmtHms(str) {
  if (!str) return '-';
  return str;
}

function secsToHoursF(secs) {
  if (secs === null || secs === undefined) return null;
  return Math.round(secs / 360) / 10;
}

window.EstimatesView = {
  render(data) {
    const { weekly, daily, cumulative } = data.estimates || { weekly: [], daily: [], cumulative: null };
    const allEntries = [...(weekly || []), ...(daily || [])];

    if (allEntries.length === 0) {
      return `
        <div class="view-header"><div class="view-title">수명 예측</div></div>
        <div class="no-data">수명 예측 데이터가 없습니다.</div>
      `;
    }

    return `
      <div class="view-header">
        <div class="view-title">수명 예측</div>
        <div class="view-subtitle">배터리 소모 패턴 기반 예측 수명 (주별 / 일별)</div>
      </div>

      ${cumulative ? `
        <!-- OS 설치 이후 누적 -->
        <div class="card-grid card-grid-4" style="margin-bottom:20px;">
          <div class="card">
            <div class="card-label">누적 기준</div>
            <div style="font-size:13px; color:var(--text-primary); margin-top:6px;">${cumulative.label}</div>
          </div>
          <div class="card">
            <div class="card-label">Active (현재 용량)</div>
            <div class="card-value" style="font-size:18px; color:var(--color-primary);">${cumulative.fcActive || '-'}</div>
          </div>
          <div class="card">
            <div class="card-label">Standby (현재 용량)</div>
            <div class="card-value" style="font-size:18px; color:var(--color-secondary);">${cumulative.fcStandby || '-'}</div>
          </div>
          <div class="card">
            <div class="card-label">Active (설계 기준)</div>
            <div class="card-value" style="font-size:18px; color:var(--text-secondary);">${cumulative.dcActive || '-'}</div>
          </div>
        </div>
      ` : ''}

      <!-- 주별 예측 차트 -->
      ${weekly && weekly.length > 0 ? `
        <div class="chart-card">
          <div class="chart-card-title">주별 예측 Active 수명 추이</div>
          <div class="legend">
            <div class="legend-item">
              <div class="legend-dot" style="background:#11d8e8;"></div>
              현재 충전 용량 기준
            </div>
            <div class="legend-item">
              <div class="legend-dot" style="background:#4f8ef7;"></div>
              설계 용량 기준
            </div>
          </div>
          <div class="chart-wrapper" style="height:260px;">
            <canvas id="estimates-chart"></canvas>
          </div>
        </div>
      ` : ''}

      <!-- 주별 예측 테이블 -->
      ${weekly && weekly.length > 0 ? `
        <div class="data-table-wrapper" style="margin-bottom:16px;">
          <div class="data-table-header">
            <span class="data-table-title">주별 예측 수명</span>
            <span class="data-table-count">${weekly.length}개 기간</span>
          </div>
          <table class="data-table">
            <thead>
              <tr>
                <th>기간</th>
                <th class="right" style="color:#11d8e8;">Active (현재)</th>
                <th class="right" style="color:#11d8e880;">Standby (현재)</th>
                <th class="right" style="color:#4f8ef7;">Active (설계)</th>
                <th class="right" style="color:#4f8ef780;">Standby (설계)</th>
              </tr>
            </thead>
            <tbody>
              ${weekly.map(row => `
                <tr>
                  <td class="mono secondary">${row.period}</td>
                  <td class="right mono" style="color:#11d8e8;">${fmtHms(row.fcActiveStr)}</td>
                  <td class="right mono secondary">${fmtHms(row.fcStandbyStr)}</td>
                  <td class="right mono" style="color:#4f8ef7;">${fmtHms(row.dcActiveStr)}</td>
                  <td class="right mono secondary">${fmtHms(row.dcStandbyStr)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : ''}

      <!-- 일별 예측 테이블 -->
      ${daily && daily.length > 0 ? `
        <div class="data-table-wrapper">
          <div class="data-table-header">
            <span class="data-table-title">일별 예측 수명</span>
            <span class="data-table-count">${daily.length}일</span>
          </div>
          <table class="data-table">
            <thead>
              <tr>
                <th>날짜</th>
                <th class="right" style="color:#11d8e8;">Active (현재)</th>
                <th class="right" style="color:#11d8e880;">Standby (현재)</th>
                <th class="right" style="color:#4f8ef7;">Active (설계)</th>
                <th class="right" style="color:#4f8ef780;">Standby (설계)</th>
              </tr>
            </thead>
            <tbody>
              ${daily.map(row => `
                <tr>
                  <td class="mono secondary">${row.period}</td>
                  <td class="right mono" style="color:#11d8e8;">${fmtHms(row.fcActiveStr)}</td>
                  <td class="right mono secondary">${fmtHms(row.fcStandbyStr)}</td>
                  <td class="right mono" style="color:#4f8ef7;">${fmtHms(row.dcActiveStr)}</td>
                  <td class="right mono secondary">${fmtHms(row.dcStandbyStr)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : ''}
    `;
  },

  initCharts(data) {
    const { weekly } = data.estimates || {};
    const canvas = document.getElementById('estimates-chart');
    if (!canvas || !weekly || weekly.length === 0) return [];

    const validEntries = weekly.filter(e => e.fcActiveSeconds !== null || e.dcActiveSeconds !== null);
    if (validEntries.length === 0) return [];

    const labels = validEntries.map(r => {
      const parts = r.period.split(' - ');
      return parts[0] ? parts[0].slice(5) : r.period.slice(0, 10); // MM-DD
    });

    const fcActive = validEntries.map(r => secsToHoursF(r.fcActiveSeconds));
    const dcActive = validEntries.map(r => secsToHoursF(r.dcActiveSeconds));

    const chart = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: '현재 용량 기준 Active',
            data: fcActive,
            borderColor: '#11d8e8',
            backgroundColor: '#11d8e820',
            fill: true,
            tension: 0.3,
            pointRadius: 4,
            pointHoverRadius: 6,
            borderWidth: 2,
          },
          {
            label: '설계 용량 기준 Active',
            data: dcActive,
            borderColor: '#4f8ef7',
            backgroundColor: '#4f8ef720',
            fill: true,
            tension: 0.3,
            pointRadius: 4,
            pointHoverRadius: 6,
            borderWidth: 2,
            borderDash: [4, 3],
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items) => validEntries[items[0].dataIndex]?.period || '',
              label: (item) => ` ${item.dataset.label}: ${item.raw !== null ? item.raw + 'h' : '-'}`,
            },
            backgroundColor: '#1a1a2e',
            borderColor: '#2a2a40',
            borderWidth: 1,
          },
        },
        scales: {
          x: {
            ticks: {
              color: '#9090a8',
              font: { size: 10, family: 'Consolas' },
              maxRotation: 30,
            },
            grid: { color: '#2a2a40' },
          },
          y: {
            ticks: {
              color: '#9090a8',
              callback: (v) => v + 'h',
              font: { size: 11 },
            },
            grid: { color: '#2a2a40' },
          },
        },
      },
    });

    return [chart];
  },
};
