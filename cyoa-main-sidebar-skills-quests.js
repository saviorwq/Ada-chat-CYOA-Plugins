/**
 * CYOA sidebar skills and quests module
 * Extracted from cyoa-main.js for incremental split.
 */
(function() {
    const CYOA = window.CYOA;
    if (!CYOA || !CYOA.CONFIG) return;

    const t = CYOA.t || ((k) => k);
    const escapeHtml = CYOA.escapeHtml || ((s) => String(s || ""));
    const getSkillTypeLabel = CYOA.getSkillTypeLabel || ((s) => String(s || ""));

    // ========== 渲染技能面板 ==========
    CYOA.renderSkillsPanel = function() {
        const container = document.getElementById('cyoaSkillsPanel');
        if (!container || !CYOA.currentSave) return;

        const maxLv = CYOA.CONFIG.SKILL_MAX_LEVEL || 9;
        const perLv = CYOA.CONFIG.SKILL_PROFICIENCY_PER_LEVEL || 100;
        const levelLabels = CYOA.CONFIG.SKILL_LEVEL_LABELS || {};

        let html = '<div class="cyoa-skills" style="display: flex; flex-direction: column; gap: 16px;">';

        if (!CYOA.currentSave.skills || CYOA.currentSave.skills.length === 0) {
            html += `<div class="cyoa-empty-state">${t('ui.empty.noSkills')}</div>`;
        } else {
            CYOA.currentSave.skills.forEach(skill => {
                const lv = skill.level || 1;
                const prof = typeof skill.proficiency === 'number' ? skill.proficiency : 0;
                const profPercent = perLv > 0 ? Math.min(100, (prof / perLv) * 100) : 0;
                const tag = levelLabels[lv] || '';
                const isMaxLevel = lv >= maxLv;
                const typeIcon = { magic: '✨', combat: '⚔️', passive: '🛡️', craft: '🔨', social: '💬', special: '🌟' }[skill.skillType] || '📘';

                html += `
                    <div class="cyoa-skill-item" style="background: var(--bg); border-radius: var(--radius-md); padding: 12px; border: 1px solid var(--border);">
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                            <span style="font-size: 20px;">${typeIcon}</span>
                            <span style="font-weight: 600; flex:1;">${escapeHtml(skill.name)}</span>
                            <span style="font-size: 13px; font-weight: 700; color: var(--primary); background: var(--cyoa-primary-light); padding: 2px 8px; border-radius: 10px;">LV${lv}${tag ? ' ' + tag : ''}</span>
                            <span class="cyoa-badge cyoa-badge-primary">${getSkillTypeLabel(skill.skillType)}</span>
                        </div>
                        <div style="margin-bottom: 6px;">
                            <div style="display: flex; justify-content: space-between; font-size: 11px; color: var(--text-light); margin-bottom: 2px;">
                                <span>${t('ui.sidebar.skillProficiency')}</span>
                                <span>${isMaxLevel ? 'MAX' : prof + ' / ' + perLv}</span>
                            </div>
                            <div style="height: 6px; background: var(--border); border-radius: 3px; overflow: hidden;">
                                <div style="height: 100%; width: ${isMaxLevel ? 100 : profPercent}%; background: ${isMaxLevel ? 'linear-gradient(90deg, #f59e0b, #ef4444)' : 'var(--primary)'}; border-radius: 3px; transition: width 0.3s;"></div>
                            </div>
                        </div>
                        ${skill.description ? `<div style="font-size: 13px; color: var(--text); margin-bottom: 4px;">${escapeHtml(skill.description)}</div>` : ''}
                        ${skill.effect ? `<div style="font-size: 12px; color: var(--primary); margin-bottom: 4px;">${t('ui.sidebar.skillEffect')} ${escapeHtml(skill.effect)} <span style="font-weight:600;">×${(typeof CYOA.getSkillEffectMultiplier === 'function' ? CYOA.getSkillEffectMultiplier(lv) : 1).toFixed(2)}</span></div>` : ''}
                        ${skill.consumeItems?.length ? (() => {
                            const costMult = typeof CYOA.getSkillCostMultiplier === 'function' ? CYOA.getSkillCostMultiplier(lv) : 1;
                            const items = skill.consumeItems.map(c => {
                                const scaled = typeof CYOA.getScaledConsumeCost === 'function' ? CYOA.getScaledConsumeCost(c.amount || 1, lv) : (c.amount || 1);
                                return (c.description || c.itemId) + ' ×' + scaled;
                            }).join(', ');
                            return '<div style="font-size: 12px; color: var(--text-light);">' + t('ui.sidebar.skillCost') + ' ' + items + ' <span style="color:#10b981;">(↓' + ((1 - costMult) * 100).toFixed(0) + '%)</span></div>';
                        })() : ''}
                    </div>
                `;
            });
        }

        html += '</div>';
        container.innerHTML = html;
    };

    // ========== 渲染任务面板 ==========
    CYOA.renderQuestsPanel = function() {
        const container = document.getElementById('cyoaQuestsPanel');
        if (!container || !CYOA.currentSave) return;

        let html = '<div class="cyoa-quests" style="display: flex; flex-direction: column; gap: 16px;">';

        if (!CYOA.currentSave.quests || CYOA.currentSave.quests.length === 0) {
            html += `<div class="cyoa-empty-state">${t('ui.empty.noQuests')}</div>`;
        } else {
            // 按状态分组
            const activeQuests = CYOA.currentSave.quests.filter(q => q.status === 'active');
            const availableQuests = CYOA.currentSave.quests.filter(q => q.status === 'available');
            const completedQuests = CYOA.currentSave.quests.filter(q => q.status === 'completed');

            if (activeQuests.length > 0) {
                html += `<h4 style="margin: 0 0 12px 0; font-size: 14px;">${t('ui.sidebar.questInProgress')}</h4>`;
                activeQuests.forEach(quest => {
                    html += renderQuestItem(quest);
                });
            }

            if (availableQuests.length > 0) {
                html += `<h4 style="margin: 16px 0 12px 0; font-size: 14px;">${t('ui.sidebar.questAvailable')}</h4>`;
                availableQuests.forEach(quest => {
                    html += renderQuestItem(quest);
                });
            }

            if (completedQuests.length > 0) {
                html += `<h4 style="margin: 16px 0 12px 0; font-size: 14px;">${t('ui.sidebar.questCompleted')}</h4>`;
                completedQuests.forEach(quest => {
                    html += renderQuestItem(quest, true);
                });
            }
        }

        html += '</div>';
        container.innerHTML = html;
    };

    function renderQuestItem(quest, isCompleted = false) {
        let progressHtml = '';
        if (quest.objectives && quest.objectives.length > 0) {
            progressHtml = '<div style="margin-top: 8px;">';
            quest.objectives.forEach((obj, idx) => {
                const completed = quest.progress && quest.progress[idx];
                progressHtml += `
                    <div style="display: flex; align-items: center; gap: 6px; font-size: 12px; margin-bottom: 4px;">
                        <span>${completed ? '✅' : '⭕'}</span>
                        <span style="color: ${completed ? 'var(--text-light)' : 'var(--text)'}; text-decoration: ${completed ? 'line-through' : 'none'};">${escapeHtml(obj)}</span>
                    </div>
                `;
            });
            progressHtml += '</div>';
        }

        return `
            <div class="cyoa-quest-item" style="background: var(--bg); border-radius: var(--radius-md); padding: 12px; border: 1px solid ${isCompleted ? 'var(--border)' : 'var(--primary)'}; opacity: ${isCompleted ? '0.7' : '1'};">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                    <span style="font-size: 18px;">${getQuestIcon(quest.questType)}</span>
                    <span style="font-weight: 600; flex:1;">${escapeHtml(quest.name)}</span>
                    <span class="cyoa-badge" style="background: ${getQuestStatusColor(quest.status)}; color: white;">${quest.status === 'active' ? t('ui.status.inProgress') : quest.status === 'available' ? t('ui.status.available') : t('ui.status.completed')}</span>
                </div>
                ${quest.description ? `<div style="font-size: 13px; color: var(--text); margin-bottom: 8px;">${escapeHtml(quest.description)}</div>` : ''}
                ${progressHtml}
                ${quest.rewards?.length ? `<div style="font-size: 12px; color: var(--primary); margin-top: 8px;">${t('ui.sidebar.questReward')} ${quest.rewards.map(r => escapeHtml(r)).join(', ')}</div>` : ''}
            </div>
        `;
    }

    function getQuestIcon(type) {
        const icons = {
            'main': '📌',
            'side': '📋',
            'daily': '🔄',
            'weekly': '📅',
            'random': '🎲',
            'repeatable': '♻️'
        };
        return icons[type] || '📋';
    }

    function getQuestStatusColor(status) {
        const colors = {
            'active': '#10b981',
            'available': '#3b82f6',
            'completed': '#6b7280',
            'locked': '#9ca3af',
            'failed': '#ef4444'
        };
        return colors[status] || '#6b7280';
    }
})();
