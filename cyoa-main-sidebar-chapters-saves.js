/**
 * CYOA sidebar chapters and saves module
 * Extracted from cyoa-main.js for incremental split.
 */
(function() {
    const CYOA = window.CYOA;
    if (!CYOA || !CYOA.CONFIG) return;

    const t = CYOA.t || ((k) => k);
    const escapeHtml = CYOA.escapeHtml || ((s) => String(s || ""));

    // ========== 渲染章节面板 ==========
    function renderConditionLabel(cond, game) {
        switch (cond.type) {
            case 'quest_complete': {
                const q = (game.quests || []).find(q => q.id === cond.questId);
                return t('ui.cond.questComplete', { name: q?.name || cond.questId });
            }
            case 'has_item': {
                const it = (game.items || []).find(i => i.id === cond.itemId);
                return t('ui.cond.hasItem', { name: it?.name || cond.itemId, qty: cond.quantity || 1 });
            }
            case 'attribute_check':
                return t('ui.cond.attrCheck', { attr: cond.attribute, op: cond.operator, val: cond.value });
            default:
                return cond.type;
        }
    }

    CYOA.renderChaptersPanel = function() {
        const container = document.getElementById('cyoaChaptersPanel');
        if (!container || !CYOA.currentGame || !CYOA.currentSave) return;
        const game = CYOA.currentGame;
        const save = CYOA.currentSave;
        const completedSet = new Set(save.completedChapters || []);

        let html = '<div class="cyoa-chapters" style="display: flex; flex-direction: column; gap: 12px;">';

        // 当前章节详情卡
        if (save.currentChapter) {
            const cur = game.chapters?.find(ch => ch.id === save.currentChapter);
            if (cur) {
                html += `<div style="background: var(--bg); padding: 14px; border-radius: var(--radius-md); border: 2px solid var(--primary);">`;
                html += `<h4 style="margin: 0 0 6px 0; color: var(--primary);">${t('ui.panel.currentChapter')}</h4>`;
                html += `<div style="font-weight: 600; font-size: 17px;">${escapeHtml(cur.title)}</div>`;
                if (cur.order) html += `<div style="font-size: 12px; color: var(--text-light); margin-top:2px;">${t('ui.status.chapterN', { n: cur.order })}</div>`;
                if (cur.description) html += `<div style="font-size: 13px; color: var(--text); margin-top: 8px; padding-top: 8px; border-top: 1px dashed var(--border);">${escapeHtml(cur.description)}</div>`;

                // 推进条件状态
                const conds = cur.transitionConditions;
                if (Array.isArray(conds) && conds.length > 0) {
                    html += `<div style="margin-top:10px; padding-top:8px; border-top:1px dashed var(--border);">`;
                    html += `<div style="font-size:12px; font-weight:600; margin-bottom:6px;">${t('ui.panel.advanceGoal')}</div>`;
                    conds.forEach(c => {
                        const met = CYOA.evaluateCondition?.(c) || false;
                        const icon = met ? '✅' : '⬜';
                        const color = met ? '#22c55e' : 'var(--text-light)';
                        html += `<div style="font-size:12px; color:${color}; margin-bottom:3px;">${icon} ${escapeHtml(renderConditionLabel(c, game))}</div>`;
                    });
                    html += `</div>`;
                }
                html += `</div>`;
            }
        }

        // 章节列表
        if (game.chapters && game.chapters.length > 0) {
            html += `<div style="margin-top:4px;"><h4 style="margin: 0 0 10px 0; font-size: 13px;">${t('ui.panel.chapterFlow')}</h4>`;
            const sorted = [...game.chapters].sort((a, b) => (a.order || 0) - (b.order || 0));

            sorted.forEach(chapter => {
                const isCurrent = chapter.id === save.currentChapter;
                const isDone = completedSet.has(chapter.id);
                const isUnlocked = CYOA.isChapterUnlocked ? CYOA.isChapterUnlocked(chapter, save) : (chapter.unlocked !== false || isDone || isCurrent);
                const sceneCount = chapter.scenes?.length || 0;

                let icon = '🔒';
                let badge = '';
                if (isDone) { icon = '✅'; badge = `<span style="font-size:10px; background:#22c55e; color:white; padding:1px 5px; border-radius:10px;">${t('ui.status.completed')}</span>`; }
                else if (isCurrent) { icon = '📖'; badge = `<span style="font-size:10px; background:var(--primary); color:white; padding:1px 5px; border-radius:10px;">${t('ui.status.current')}</span>`; }

                const borderColor = isCurrent ? 'var(--primary)' : isDone ? '#22c55e' : 'var(--border)';

                html += `<div style="display:flex; align-items:center; gap:8px; background:var(--bg); padding:10px 12px; border-radius:var(--radius-md); border:1px solid ${borderColor}; margin-bottom:6px; ${isUnlocked ? '' : 'opacity:0.5;'}">`;
                html += `<span style="font-size:18px;">${icon}</span>`;
                html += `<div style="flex:1;">`;
                html += `<div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">`;
                html += `<span style="font-weight:600; font-size:13px;">${escapeHtml(chapter.title)}</span>`;
                if (chapter.order) html += `<span style="font-size:10px; color:var(--text-light);">${t('ui.status.chapterN', { n: chapter.order })}</span>`;
                html += badge;
                html += `</div>`;
                html += `<div style="font-size:10px; color:var(--text-light); margin-top:3px;">📄 ${t('ui.status.nScenes', { n: sceneCount })}</div>`;
                html += `</div>`;
                // 手动切换按钮（非当前、非已完成章节）
                if (!isCurrent && isUnlocked) {
                    html += `<button class="cyoa-btn cyoa-btn-secondary" style="font-size:10px; padding:2px 8px; height:24px;" onclick="CYOA.changeChapter('${escapeHtml(chapter.id)}')">${t('ui.btn.switch')}</button>`;
                }
                html += `</div>`;
            });

            html += '</div>';
        } else {
            html += `<div class="cyoa-empty-state" style="font-size:13px;">${t('ui.empty.noChapters')}</div>`;
        }

        html += '</div>';
        container.innerHTML = html;
    };

    // ========== 渲染存档面板 ==========
    CYOA.renderSavesPanel = function() {
        const container = document.getElementById('cyoaSavesPanel');
        if (!container || !CYOA.currentSave) return;

        const savesList = Object.values(CYOA.saves || {}).filter(s => s.gameId === CYOA.currentGame?.id);

        let html = '<div class="cyoa-saves-panel" style="display: flex; flex-direction: column; gap: 16px;">';

        html += `
            <div class="cyoa-current-save" style="background: var(--bg); padding: 16px; border-radius: var(--radius-md); border: 1px solid var(--border);">
                <h4 style="margin: 0 0 12px 0; font-size: 14px;">${t('ui.panel.currentSave')}</h4>
                <div style="margin-bottom: 12px;">
                    <div style="font-weight: 600;">${escapeHtml(CYOA.currentSave.name)}</div>
                    <div style="font-size: 11px; color: var(--text-light);">${t('ui.sidebar.created')} ${new Date(CYOA.currentSave.createdAt).toLocaleString()}</div>
                    <div style="font-size: 11px; color: var(--text-light);">${t('ui.sidebar.updated')} ${new Date(CYOA.currentSave.updatedAt).toLocaleString()}</div>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                    <button class="cyoa-btn cyoa-btn-secondary cyoa-btn-sm" onclick="CYOA.saveCurrentSave()">💾 ${t('ui.btn.save')}</button>
                    <button class="cyoa-btn cyoa-btn-secondary cyoa-btn-sm" onclick="CYOA.saveAsNewSave()">${t('ui.btn.saveAs')}</button>
                    <button class="cyoa-btn cyoa-btn-secondary cyoa-btn-sm" onclick="CYOA.exportSave()">📤 ${t('ui.btn.export')}</button>
                    <button class="cyoa-btn cyoa-btn-secondary cyoa-btn-sm" onclick="CYOA.importSave()">📥 ${t('ui.btn.import')}</button>
                </div>
            </div>
        `;

        if (savesList.length > 1) {
            html += `<div class="cyoa-saves-list"><h4 style="margin: 0 0 12px 0; font-size: 14px;">${t('ui.panel.otherSaves')}</h4>`;
            savesList.forEach(save => {
                if (save.id !== CYOA.currentSave.id) {
                    html += `
                        <div class="cyoa-save-item" style="display: flex; align-items: center; gap: 8px; background: var(--bg); padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--border); margin-bottom: 8px;">
                            <span style="font-size: 18px;">📁</span>
                            <div style="flex: 1;">
                                <div style="font-weight: 600;">${escapeHtml(save.name)}</div>
                                <div style="font-size: 10px; color: var(--text-light);">${new Date(save.updatedAt).toLocaleString()}</div>
                            </div>
                            <button class="cyoa-btn-icon" onclick="CYOA.loadSave('${escapeHtml(save.id)}')" title="${t('ui.btn.load')}">▶️</button>
                            <button class="cyoa-btn-icon danger" onclick="CYOA.deleteSave('${escapeHtml(save.id)}')" title="${t('ui.btn.delete')}">🗑️</button>
                        </div>
                    `;
                }
            });
            html += '</div>';
        }

        html += '</div>';
        container.innerHTML = html;
    };
})();
