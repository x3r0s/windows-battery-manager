'use strict';

function fmtMwh(v) {
  if (v === null || v === undefined) return '-';
  return v.toLocaleString() + ' mWh';
}

function healthClass(score) {
  if (score === null) return 'primary';
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

window.BatteryHealthView = {
  render(data) {
    const batteries = data.batteries;
    const score = data.healthScore;
    const hClass = healthClass(score);
    const hLabel = healthLabel(score);

    if (!batteries || batteries.length === 0) {
      return `
        <div class="view-header">
          <div class="view-title">배터리 헬스</div>
        </div>
        <div class="no-data">배터리 정보를 찾을 수 없습니다. (데스크탑 PC인 경우 배터리가 없습니다.)</div>
      `;
    }

    const battery = batteries[0];
    const designCap = battery.designCapacity || 0;
    const fullCap = battery.fullChargeCapacity || 0;
    const wearMwh = Math.max(0, designCap - fullCap);
    const wearPct = designCap > 0 ? ((wearMwh / designCap) * 100).toFixed(1) : 0;

    const batterySections = batteries.map((bat, idx) => {
      const bScore = bat.designCapacity && bat.fullChargeCapacity
        ? Math.round((bat.fullChargeCapacity / bat.designCapacity) * 1000) / 10
        : null;

      return `
        <div class="card" style="margin-bottom:16px;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px;">
            <div>
              <div style="font-size:16px; font-weight:600; color:var(--text-primary);">${bat.name || '배터리 ' + (idx + 1)}</div>
              <div style="font-size:12px; color:var(--text-secondary); margin-top:2px;">${bat.manufacturer || ''} · ${bat.chemistry || ''}</div>
            </div>
            <span class="status-badge ${healthClass(bScore)}">
              <span class="status-dot"></span>
              ${healthLabel(bScore)}
            </span>
          </div>

          <!-- 스펙 그리드 -->
          <div class="info-grid" style="grid-template-columns: repeat(3, 1fr); gap:10px; margin-bottom:16px;">
            <div class="info-item">
              <div class="info-label">시리얼 번호</div>
              <div class="info-value" style="font-family:Consolas,monospace; font-size:12px;">${bat.serialNumber || '-'}</div>
            </div>
            <div class="info-item">
              <div class="info-label">화학 성분</div>
              <div class="info-value">${bat.chemistry || '-'}</div>
            </div>
            <div class="info-item">
              <div class="info-label">충전 사이클</div>
              <div class="info-value" style="font-size:18px; font-weight:700; color:var(--color-primary);">${bat.cycleCount || '-'}<span style="font-size:12px; font-weight:400; color:var(--text-secondary);"> 회</span></div>
            </div>
          </div>

          <!-- 용량 비교 바 -->
          <div style="margin-bottom:16px;">
            <div style="font-size:12px; font-weight:600; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.06em; margin-bottom:12px;">용량 비교</div>

            <div class="capacity-row">
              <span class="capacity-label">설계 용량</span>
              <span class="capacity-value">${fmtMwh(bat.designCapacity)}</span>
              <div class="capacity-bar-wrap">
                <div class="capacity-bar-fill" style="width:100%; background:var(--color-primary);"></div>
              </div>
            </div>

            <div class="capacity-row">
              <span class="capacity-label">현재 용량</span>
              <span class="capacity-value">${fmtMwh(bat.fullChargeCapacity)}</span>
              <div class="capacity-bar-wrap">
                <div class="capacity-bar-fill ${healthClass(bScore)}" style="width:${bScore !== null ? bScore : 0}%;"></div>
              </div>
            </div>

            <div class="capacity-row">
              <span class="capacity-label">손실량</span>
              <span class="capacity-value" style="color:var(--color-battery);">${fmtMwh(wearMwh)}</span>
              <div class="capacity-bar-wrap">
                <div class="capacity-bar-fill danger" style="width:${wearPct}%;"></div>
              </div>
            </div>
          </div>

          <!-- 헬스 스코어 -->
          <div style="display:flex; align-items:center; justify-content:space-between; padding:14px 16px; background:var(--bg-base); border-radius:var(--radius-sm);">
            <div>
              <div style="font-size:11px; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.06em; margin-bottom:4px;">배터리 헬스 점수</div>
              <div style="font-size:32px; font-weight:700; color:var(--${hClass === 'good' ? 'color-ac' : hClass === 'warn' ? 'color-warn' : hClass === 'danger' ? 'color-danger' : 'color-primary'});">
                ${bScore !== null ? bScore.toFixed(1) + '%' : '-'}
              </div>
            </div>
            <div style="text-align:right;">
              <div style="font-size:13px; color:var(--text-secondary);">손실률</div>
              <div style="font-size:20px; font-weight:600; color:var(--color-battery);">${wearPct}%</div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="view-header">
        <div class="view-title">배터리 헬스</div>
        <div class="view-subtitle">배터리 하드웨어 상세 정보 및 건강 지표</div>
      </div>

      ${batterySections}

      <!-- 헬스 기준 안내 -->
      <div class="card">
        <div class="card-label">헬스 점수 기준</div>
        <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:12px; margin-top:12px;">
          <div style="padding:14px; background:var(--bg-base); border-radius:var(--radius-sm); border-left: 3px solid var(--color-ac);">
            <div style="font-size:18px; font-weight:700; color:var(--color-ac); margin-bottom:4px;">80% 이상</div>
            <div style="font-size:12px; color:var(--text-secondary);">양호 — 정상 사용 가능</div>
          </div>
          <div style="padding:14px; background:var(--bg-base); border-radius:var(--radius-sm); border-left: 3px solid var(--color-warn);">
            <div style="font-size:18px; font-weight:700; color:var(--color-warn); margin-bottom:4px;">60~80%</div>
            <div style="font-size:12px; color:var(--text-secondary);">주의 — 사용시간 감소 시작</div>
          </div>
          <div style="padding:14px; background:var(--bg-base); border-radius:var(--radius-sm); border-left: 3px solid var(--color-danger);">
            <div style="font-size:18px; font-weight:700; color:var(--color-danger); margin-bottom:4px;">60% 미만</div>
            <div style="font-size:12px; color:var(--text-secondary);">교체 권장 — 배터리 교체 필요</div>
          </div>
        </div>
      </div>
    `;
  },

  initCharts() { return []; },
};
