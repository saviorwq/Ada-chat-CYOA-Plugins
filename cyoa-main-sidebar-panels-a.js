/**
 * CYOA sidebar panels (part A)
 * Extracted from cyoa-main.js for incremental split.
 */
(function() {
    const CYOA = window.CYOA;
    if (!CYOA || !CYOA.CONFIG) return;

    const t = CYOA.t || ((k) => k);
    const CONFIG = CYOA.CONFIG;
    const escapeHtml = CYOA.escapeHtml || ((s) => String(s || ""));

    // ========== 渲染剧情树面板 ==========
    CYOA.renderTreePanel = function() {
        const container = document.getElementById('cyoaTreePanel');
        if (!container || !CYOA.currentSave || !CYOA.currentSave.nodes) return;

        let html = '<div class="cyoa-tree">';

        const nodes = CYOA.currentSave.nodes;
        const rootNodes = Object.values(nodes).filter(node => !node.parentId);

        function renderNode(node, depth = 0) {
            const isCurrent = node.id === CYOA.currentNodeId;
            const hasChildren = node.childrenIds && node.childrenIds.length > 0;

            let nodeHtml = `<div class="cyoa-tree-node" style="margin-left: ${depth * 20}px; ${isCurrent ? 'background: rgba(16, 185, 129, 0.1); border-left: 3px solid var(--primary);' : ''}">`;
            nodeHtml += `<div class="cyoa-node-header" onclick="CYOA.jumpToNode('${escapeHtml(node.id)}')" style="display: flex; align-items: center; padding: 8px; cursor: pointer;">`;
            nodeHtml += `<span class="cyoa-node-indicator">${hasChildren ? '📂' : '📄'}</span>`;
            nodeHtml += `<span class="cyoa-node-title" style="flex: 1; margin-left: 8px;">${escapeHtml(node.summary || t('ui.status.unnamedNode'))}</span>`;
            nodeHtml += `<span class="cyoa-node-time" style="font-size: 11px; color: var(--text-light);">${new Date(node.createdAt).toLocaleTimeString()}</span>`;
            nodeHtml += `</div>`;

            if (node.assistantMessage) {
                nodeHtml += `<div class="cyoa-node-preview" style="font-size: 12px; color: var(--text-light); padding: 4px 8px 8px 32px; max-height: 60px; overflow: hidden; text-overflow: ellipsis;">`;
                nodeHtml += escapeHtml(node.assistantMessage.substring(0, 100)) + (node.assistantMessage.length > 100 ? '...' : '');
                nodeHtml += `</div>`;
            }

            nodeHtml += `</div>`;

            if (hasChildren) {
                node.childrenIds.forEach(childId => {
                    const childNode = nodes[childId];
                    if (childNode) {
                        nodeHtml += renderNode(childNode, depth + 1);
                    }
                });
            }

            return nodeHtml;
        }

        if (rootNodes.length === 0) {
            html += `<div class="cyoa-empty-state">${t('ui.empty.noNodes')}</div>`;
        } else {
            rootNodes.forEach(node => {
                html += renderNode(node);
            });
        }

        html += '</div>';
        container.innerHTML = html;
    };

    // ========== 渲染属性面板 ==========
    CYOA.renderAttributesPanel = function() {
        const container = document.getElementById('cyoaAttributesPanel');
        if (!container || !CYOA.currentSave) return;

        let html = '';

        // 角色职业信息
        const pCharId = CYOA.currentSave.playerCharacterId || '';
        const pChar = pCharId ? CYOA.currentGame?.characters?.find(c => c.id === pCharId) : null;
        const profLabels = [];
        if (pChar?.professions?.length && CYOA.currentGame?.professions?.length) {
            pChar.professions.forEach(pid => {
                const pDef = CYOA.currentGame.professions.find(p => p.id === pid);
                if (pDef) profLabels.push(`${pDef.icon || '🎭'} ${escapeHtml(pDef.name)}`);
            });
        }
        if (pChar?.customProfessions?.length) {
            pChar.customProfessions.forEach(cp => profLabels.push(`🎭 ${escapeHtml(cp)}`));
        }
        if (profLabels.length) {
            html += `<div style="background:var(--bg); border-radius:var(--radius-md); padding:10px 12px; border:1px solid var(--border); margin-bottom:12px;">`;
            html += `<div style="font-weight:600; font-size:13px; margin-bottom:4px;">${t('ui.sidebar.profLabel')}</div>`;
            html += `<div style="display:flex; gap:6px; flex-wrap:wrap;">`;
            profLabels.forEach(l => {
                html += `<span style="background:var(--primary-light,#ede9fe); color:var(--primary); padding:2px 8px; border-radius:12px; font-size:12px;">${l}</span>`;
            });
            html += `</div></div>`;
        }

        // 监控警戒度指示器
        if (CYOA.isChapterMonitored?.()) {
            const alertVal = CYOA.getObserverAlert?.() || 0;
            const alertLevel = CYOA.getObserverAlertLevel?.();
            const alertPct = Math.min(100, alertVal);
            const alertColor = alertVal >= 100 ? '#dc2626' : alertVal >= 75 ? '#f59e0b' : alertVal >= 50 ? '#eab308' : alertVal >= 25 ? '#3b82f6' : '#6b7280';
            const pulseAnim = alertVal >= 75 ? 'animation:pulse 1.5s infinite;' : '';
            html += `<div style="background:linear-gradient(135deg,#1a1a2e,#16213e); border-radius:var(--radius-md); padding:12px; border:1px solid ${alertColor}; margin-bottom:12px; ${pulseAnim}">`;
            html += `<div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;">`;
            html += `<span style="font-weight:600; font-size:13px; color:#e2e8f0;">${t('ui.panel.monitoring')}</span>`;
            html += `<span style="font-size:12px; font-weight:700; color:${alertColor};">${alertLevel ? alertLevel.label : '📡 未触发'} ${alertVal}/100</span>`;
            html += `</div>`;
            html += `<div style="height:6px; background:#334155; border-radius:3px; overflow:hidden; margin-bottom:4px;">`;
            html += `<div style="height:100%; width:${alertPct}%; background:${alertColor}; border-radius:3px; transition:width 0.5s ease;"></div>`;
            html += `</div>`;
            if (alertLevel) {
                html += `<div style="font-size:11px; color:#94a3b8;">${escapeHtml(alertLevel.desc)}</div>`;
            }
            html += `</div>`;
        }

        // 人性平衡（当游戏启用时）
        if (CYOA.currentGame?.humanityBalanceEnabled) {
            const hi = CYOA.currentSave.humanityIndex ?? 70;
            const dp = CYOA.currentSave.divinePermission ?? 20;
            const lockLv = CYOA.currentSave.humanityBalanceLock ?? 0;
            const hiColor = hi >= 60 ? '#22c55e' : hi >= 30 ? '#f59e0b' : '#ef4444';
            const dpColor = dp <= 40 ? '#22c55e' : dp <= 80 ? '#f59e0b' : '#ef4444';
            html += `<div style="background:linear-gradient(135deg,#1e293b,#0f172a); border-radius:var(--radius-md); padding:12px; border:1px solid var(--border); margin-bottom:12px;">`;
            html += `<div style="font-weight:600; font-size:13px; margin-bottom:8px;">${t('ui.sidebar.humanityBalance')}</div>`;
            html += `<div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:4px;"><span>${t('ui.sidebar.humanityIndex')}</span><span style="color:${hiColor}; font-weight:600;">${hi}%</span></div>`;
            html += `<div style="height:4px; background:#334155; border-radius:2px; overflow:hidden; margin-bottom:8px;"><div style="height:100%; width:${hi}%; background:${hiColor}; border-radius:2px;"></div></div>`;
            html += `<div style="display:flex; justify-content:space-between; font-size:12px;"><span>${t('ui.sidebar.divinePermission')}</span><span style="color:${dpColor}; font-weight:600;">${dp}%</span></div>`;
            html += `<div style="height:4px; background:#334155; border-radius:2px; overflow:hidden;">`;
            html += `<div style="height:100%; width:${dp}%; background:${dpColor}; border-radius:2px;"></div></div>`;
            if (lockLv > 0) {
                const lockDef = (CONFIG.HUMANITY_BALANCE_CONFIG?.lockLevels || [])[lockLv];
                html += `<div style="font-size:11px; color:#f59e0b; margin-top:8px;">${t('ui.sidebar.humanityLock')}：${lockDef?.label || lockLv}</div>`;
            }
            html += `</div>`;
        }

        if (!CYOA.currentSave.attributes || CYOA.currentSave.attributes.length === 0) {
            html = `<div class="cyoa-empty-state">${t('ui.empty.noAttrs')}</div>`;
        } else {
            if (!CYOA._attrExpand) CYOA._attrExpand = {};
            (CYOA.currentSave.attributes || []).forEach((attr, idx) => {
                const range = attr.max - attr.min;
                const percent = range > 0 ? ((attr.value - attr.min) / range) * 100 : 0;
                const expandId = 'attr_' + (attr.id || 'i' + idx);
                const expanded = CYOA._attrExpand[expandId] !== false;
                const chevron = expanded ? '▼' : '▶';
                html += `
                    <div class="cyoa-attr-card" data-attr-id="${escapeHtml(expandId)}" style="margin-bottom:8px; border:1px solid var(--border); border-radius:var(--radius-md); overflow:hidden;">
                        <div class="cyoa-attr-header" role="button" tabindex="0" style="display:flex; align-items:center; justify-content:space-between; padding:8px 10px; background:var(--bg); cursor:pointer; user-select:none; font-size:13px;">
                            <span style="font-weight:600;">${escapeHtml(attr.name)}</span>
                            <span style="display:flex; align-items:center; gap:6px;">
                                <span style="color:var(--primary); font-weight:600;">${attr.value}</span>
                                <span class="cyoa-attr-chevron" style="font-size:10px; color:var(--text-light);">${chevron}</span>
                            </span>
                        </div>
                        <div class="cyoa-attr-body" style="display:${expanded ? 'block' : 'none'}; padding:10px 12px; background:var(--bg-light); border-top:1px solid var(--border);">
                            <div style="height: 8px; background: var(--border); border-radius: 4px; overflow: hidden; margin-bottom: 4px;">
                                <div style="height: 100%; width: ${percent}%; background: var(--primary); border-radius: 4px;"></div>
                            </div>
                            <div style="display: flex; justify-content: space-between; font-size: 11px; color: var(--text-light);">
                                <span>${attr.min}</span>
                                <span>${attr.max}</span>
                            </div>
                            ${attr.description ? `<div style="font-size: 12px; color: var(--text-light); margin-top: 8px; padding-top: 8px; border-top: 1px dashed var(--border);">${escapeHtml(attr.description)}</div>` : ''}
                        </div>
                    </div>
                `;
            });
        }

        container.innerHTML = html;
        container.querySelectorAll('.cyoa-attr-header').forEach(h => {
            h.addEventListener('click', function() {
                const card = this.closest('.cyoa-attr-card');
                if (!card) return;
                const id = card.dataset.attrId;
                const body = card.querySelector('.cyoa-attr-body');
                const ch = card.querySelector('.cyoa-attr-chevron');
                CYOA._attrExpand[id] = body?.style.display === 'none';
                if (body) body.style.display = CYOA._attrExpand[id] ? 'block' : 'none';
                if (ch) ch.textContent = CYOA._attrExpand[id] ? '▼' : '▶';
            });
        });
        // 属性刷新后同步状态面板
        CYOA.renderStatusPanel?.();
    };

    // ========== 渲染状态面板（侧栏专用） ==========
    CYOA.renderStatusPanel = function() {
        const container = document.getElementById('cyoaStatusPanel');
        const save = CYOA.currentSave;
        if (!container || !save) return;
        const constraints = CYOA.getActiveConstraints?.() || new Set();
        const cList = Array.from(constraints || []);

        // 身体状态
        const bodyRows = [];
        const pain = Number(save.pain || 0);
        if (pain > 0) bodyRows.push(`疼痛：${pain}/100`);
        const oxy = Number(save.oxygen ?? 100);
        if (oxy < 100) bodyRows.push(`氧气：${oxy}/100`);
        if (Array.isArray(save.marks) && save.marks.length > 0) bodyRows.push(`伤痕：${save.marks.length} 处`);
        if (save.predicament?.type) bodyRows.push(`困境束缚：${save.predicament.type}`);
        if (Array.isArray(save.blockedPostures) && save.blockedPostures.length) {
            const pDefs = CONFIG.POSTURES || [];
            const labels = save.blockedPostures.map(v => pDefs.find(p => p.value === v)?.label || v);
            bodyRows.push(`受限姿势：${labels.join('、')}`);
        }
        if (save.currentGait && String(save.currentGait) !== 'normal') bodyRows.push(`步态：${save.currentGait}`);
        if (Array.isArray(save.injuries) && save.injuries.length) bodyRows.push(`受伤部位：${save.injuries.map(i => i.part || i.type || i).join('、')}`);
        if (Array.isArray(save.disabilities) && save.disabilities.length) bodyRows.push(`残疾状态：${save.disabilities.map(d => d.name || d.type || d).join('、')}`);
        if (save.disabilities && !Array.isArray(save.disabilities) && typeof save.disabilities === 'object') {
            const active = Object.keys(save.disabilities).filter(k => !!save.disabilities[k]);
            if (active.length) bodyRows.push(`残疾状态：${active.join('、')}`);
        }

        // 限制状态
        const cRows = cList.map(c => CYOA.getConstraintLabel?.(c) || c);
        const posture = save.posture || 'standing';
        if (posture) {
            const pDef = (CONFIG.POSTURES || []).find(p => p.value === posture);
            cRows.unshift(`当前姿势：${pDef?.label || posture}`);
        }
        if (save.tether?.active) cRows.push('牵引：生效中');

        const renderList = (arr, emptyText) => {
            if (!arr.length) return `<div style="font-size:11px; color:var(--text-light);">${escapeHtml(emptyText)}</div>`;
            return `<div style="display:flex; flex-direction:column; gap:4px;">${arr.map(x => `<div style="font-size:11px;">• ${escapeHtml(String(x))}</div>`).join('')}</div>`;
        };

        let html = '';
        html += `<div style="margin-bottom:10px; border:1px solid var(--border); border-radius:var(--radius-md); overflow:hidden;">`;
        html += `<div style="padding:8px 10px; background:var(--bg); font-size:12px; font-weight:600;">身体状态</div>`;
        html += `<div style="padding:8px 10px; background:var(--bg-light);">${renderList(bodyRows, '暂无明显伤病/残疾状态')}</div>`;
        html += `</div>`;

        html += `<div style="border:1px solid var(--border); border-radius:var(--radius-md); overflow:hidden;">`;
        html += `<div style="padding:8px 10px; background:var(--bg); font-size:12px; font-weight:600;">限制状态</div>`;
        html += `<div style="padding:8px 10px; background:var(--bg-light);">${renderList(cRows, '当前无额外限制')}</div>`;
        html += `</div>`;

        container.innerHTML = html;
    };
})();
