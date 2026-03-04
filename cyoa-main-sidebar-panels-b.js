/**
 * CYOA sidebar panels (part B)
 * Extracted from cyoa-main.js for incremental split.
 */
(function() {
    const CYOA = window.CYOA;
    if (!CYOA || !CYOA.CONFIG) return;

    const CONFIG = CYOA.CONFIG;
    const t = CYOA.t || ((k) => k);
    const escapeHtml = CYOA.escapeHtml || ((s) => String(s || ""));

    // ========== 可折叠面板封装 ==========
    if (!CYOA._panelStates) CYOA._panelStates = {};
    CYOA.wrapCollapsible = function(id, title, content, defaultOpen) {
        if (!content || content.trim() === '') return '';
        const isOpen = id in CYOA._panelStates ? CYOA._panelStates[id] : (defaultOpen || false);
        const arrow = isOpen ? '▾' : '▸';
        const display = isOpen ? 'block' : 'none';
        const toggleJS = `CYOA._panelStates['${id}']=${isOpen ? 'false' : 'true'};CYOA.renderInventoryPanel();`;
        return `<div style="margin-bottom:4px;">` +
            `<div onclick="${toggleJS}" ` +
            `style="padding:6px 10px; cursor:pointer; display:flex; align-items:center; justify-content:space-between; user-select:none; font-size:12px; font-weight:600; color:var(--text); background:var(--bg); border:1px solid var(--border); border-radius:var(--radius-sm);">` +
            `<span>${title}</span><span style="font-size:10px; color:var(--text-light);">${arrow}</span></div>` +
            `<div style="display:${display};">${content}</div></div>`;
    };

    // ========== 牵引/姿势状态面板构建 ==========
    CYOA.buildTetherPosturePanel = function() {
        const save = CYOA.currentSave;
        if (!save) return '';
        let html = '';

        // 姿势
        const posture = save.posture || 'standing';
        const postureDef = (CONFIG.POSTURES || []).find(p => p.value === posture);
        const isTetherForced = save.tether?.active && (save.tether.type === 'suspended' || (() => {
            if (save.tether.type !== 'fixed_anchor') return false;
            const ah = (CONFIG.ANCHOR_HEIGHTS || []).find(h => h.forcedPosture === posture);
            return !!ah;
        })());
        html += '<div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">';
        html += `<span style="font-size:11px; color:var(--text-light);">${t('ui.sidebar.posture')}</span>`;
        html += `<span style="font-weight:600;">${postureDef?.label || posture}</span>`;
        if (isTetherForced) {
            html += `<span style="font-size:10px; background:#ef4444; color:#fff; padding:1px 5px; border-radius:8px;">${t('ui.sidebar.tetherForced')}</span>`;
        }
        html += '</div>';

        // 姿势切换（非牵引强制时）
        if (!isTetherForced) {
            html += '<div style="display:flex; flex-wrap:wrap; gap:3px; margin-bottom:8px;">';
            (CONFIG.POSTURES || []).forEach(p => {
                const isActive = p.value === posture;
                html += `<button class="cyoa-btn-icon" onclick="CYOA.setPosture('${p.value}')" style="font-size:10px; padding:2px 6px; border-radius:4px; ${isActive ? 'background:var(--primary); color:#fff;' : ''}" title="${escapeHtml(p.label)}">${p.label.charAt(0)}${p.label.charAt(1)}</button>`;
            });
            html += '</div>';
        }

        // 牵引
        if (save.tether?.active) {
            const tether = save.tether;
            const tetherDef = (CONFIG.TETHER_TYPES || []).find(x => x.value === tether.type);
            const chainDef = (CONFIG.TETHER_CHAIN_LENGTHS || []).find(x => x.value === tether.chainLength);
            html += '<div style="background:linear-gradient(135deg,#fef2f2,#fee2e2); border:1px solid #fca5a5; border-radius:var(--radius-sm); padding:8px; margin-top:4px;">';
            html += `<div style="font-size:12px; font-weight:600; color:#dc2626; margin-bottom:4px;">${tetherDef?.label || CYOA.t('ui.sidebar.tethered')}</div>`;
            if (tether.targetName) html += `<div style="font-size:11px; color:#7f1d1d;">${CYOA.t('ui.sidebar.target')} ${escapeHtml(tether.targetName)}</div>`;
            if (chainDef) html += `<div style="font-size:11px; color:#7f1d1d;">${CYOA.t('ui.sidebar.chainLen')} ${chainDef.label}</div>`;
            if (tether.sourceSlot) {
                const slotLabel = CONFIG.EQUIPMENT_SLOTS?.find(s => s.value === tether.sourceSlot)?.label || tether.sourceSlot;
                html += `<div style="font-size:11px; color:#7f1d1d;">${CYOA.t('ui.sidebar.connection')} ${escapeHtml(slotLabel)}</div>`;
            }
            html += '</div>';
        } else {
            html += `<div style="font-size:11px; color:var(--text-light); margin-top:4px;">${t('ui.status.freeState')}</div>`;
        }

        // D环列表
        const dRings = CYOA.getActiveDRings?.() || [];
        if (dRings.length > 0) {
            html += '<div style="margin-top:8px; font-size:11px; color:var(--text-light);">';
            html += `<span style="font-weight:600;">${t('ui.sidebar.dRingEquipped')}</span> `;
            html += dRings.map(d => {
                const posLabel = (CONFIG.D_RING_POSITIONS || []).find(p => p.value === d.dRingPosition)?.label || '';
                return escapeHtml(d.equipName) + (posLabel ? '(' + posLabel + ')' : '');
            }).join(', ');
            html += '</div>';
        }

        return html;
    };

    // ========== 兴奋度状态面板构建 ==========
    CYOA.buildArousalPanel = function() {
        const save = CYOA.currentSave;
        if (!save) return '';
        const val = save.arousal || 0;
        const tier = CYOA.getArousalTier?.() || { value: 'calm', label: '😌 平静', color: '#22c55e' };
        const pct = Math.min(100, val);

        let html = '';

        // 进度条
        html += '<div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">';
        html += `<div style="flex:1; height:8px; background:var(--border); border-radius:4px; overflow:hidden;">`;
        html += `<div style="height:100%; width:${pct}%; background:${tier.color}; border-radius:4px; transition:width 0.5s;"></div>`;
        html += '</div>';
        html += `<span style="font-size:12px; font-weight:600; color:${tier.color}; min-width:45px; text-align:right;">${val}/100</span>`;
        html += '</div>';

        // 阶段标签
        html += `<div style="display:flex; align-items:center; gap:6px; margin-bottom:6px;">`;
        html += `<span style="font-size:11px; color:var(--text-light);">${t('ui.sidebar.phase')}</span>`;
        html += `<span style="font-size:12px; font-weight:600; color:${tier.color};">${tier.label}</span>`;
        html += '</div>';

        // 活跃刺激器
        const stims = save.activeStimulators || [];
        const activeStims = stims.filter(s => s.mode !== 'off');
        if (activeStims.length > 0) {
            html += '<div style="margin-top:6px; padding:6px 8px; background:linear-gradient(135deg,#fef3c7,#fde68a); border:1px solid #f59e0b; border-radius:var(--radius-sm);">';
            html += `<div style="font-size:11px; font-weight:600; color:#92400e; margin-bottom:3px;">${t('ui.sidebar.activeStim')}</div>`;
            activeStims.forEach(s => {
                const modeDef = (CONFIG.STIMULATOR_MODES || []).find(m => m.value === s.mode);
                const intDef = (CONFIG.STIMULATOR_INTENSITIES || []).find(i => i.value === s.intensity);
                const icon = s.stimType === 'shock' ? '⚡' : '🔔';
                html += `<div style="font-size:10px; color:#78350f;">${icon} ${escapeHtml(s.attachmentName)} — ${modeDef?.label || s.mode} / ${intDef?.label || s.intensity}</div>`;
            });
            html += '</div>';
        }

        // 贞操锁警告
        const constraints = CYOA.getActiveConstraints?.() || new Set();
        if (constraints.has('chastity') && val >= 41) {
            html += `<div style="margin-top:6px; font-size:10px; color:#dc2626; font-style:italic;">${t('ui.sidebar.chastityBlock')}</div>`;
        }

        return html;
    };
})();
