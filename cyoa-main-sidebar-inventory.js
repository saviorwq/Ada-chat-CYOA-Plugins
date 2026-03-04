/**
 * CYOA sidebar inventory panel module
 * Extracted from cyoa-main.js for incremental split.
 */
(function() {
    const CYOA = window.CYOA;
    if (!CYOA || !CYOA.CONFIG) return;

    const CONFIG = CYOA.CONFIG;
    const t = CYOA.t || ((k) => k);
    const escapeHtml = CYOA.escapeHtml || ((s) => String(s || ""));
    const getItemTypeLabel = CYOA.getItemTypeLabel || ((s) => String(s || ""));

    function progressBar(pct, color, h = 4) {
        const r = h / 2;
        return `<div style="height:${h}px;background:var(--border);border-radius:${r}px;overflow:hidden;"><div style="height:100%;width:${Math.min(100, pct)}%;background:${color};border-radius:${r}px;transition:width .3s;"></div></div>`;
    }

    // ========== 渲染背包面板 ==========
    CYOA.renderInventoryPanel = function() {
        const container = document.getElementById('cyoaInventoryPanel');
        if (!container || !CYOA.currentSave) return;

        let html = '<div class="cyoa-inventory" style="display: flex; flex-direction: column; gap: 20px;">';

        // 监控警示横幅
        if (CYOA.isChapterMonitored?.()) {
            const av = CYOA.getObserverAlert?.() || 0;
            const barColor = av >= 75 ? '#ef4444' : av >= 50 ? '#f59e0b' : '#3b82f6';
            html += `<div style="background:linear-gradient(90deg,#0f172a,#1e293b); color:#cbd5e1; padding:6px 10px; border-radius:var(--radius-sm); margin-bottom:10px; font-size:11px; display:flex; align-items:center; gap:6px; border:1px solid ${barColor};">`;
            html += `<span style="color:${barColor}; font-size:14px;">📹</span>`;
            html += `<span>${t('ui.status.monitoring')}</span>`;
            html += `<div style="flex:1; height:3px; background:#334155; border-radius:2px; overflow:hidden;"><div style="height:100%; width:${Math.min(100,av)}%; background:${barColor}; transition:width 0.5s;"></div></div>`;
            html += `<span style="color:${barColor}; font-weight:600;">${av}%</span>`;
            html += `</div>`;
        }

        // 姿势 / 牵引状态面板
        html += CYOA.wrapCollapsible?.('panel_tether', t('ui.sidebar.postureTether'), CYOA.buildTetherPosturePanel?.(), false) || '';

        // 兴奋度状态面板
        html += CYOA.wrapCollapsible?.('panel_arousal', t('ui.sidebar.arousal'), CYOA.buildArousalPanel?.(), false) || '';

        // 纪律 + 习惯度面板
        html += CYOA.wrapCollapsible?.('panel_discipline', t('ui.sidebar.discipline'), CYOA.buildDisciplinePanel?.(), false) || '';
        html += CYOA.wrapCollapsible?.('panel_habituation', t('ui.sidebar.habituation'), CYOA.buildHabituationPanel?.(), false) || '';

        // 综合状态面板（羞耻/氧气/痛感/温度/困境/训练/感官剥夺）
        html += CYOA.wrapCollapsible?.('panel_status', t('ui.sidebar.bodyStatus'), CYOA.buildComprehensiveStatusPanel?.(), false) || '';

        // 装备栏
        let equipContent = '';
        if (!CYOA.currentSave.equipment || typeof CYOA.currentSave.equipment !== 'object') {
            CYOA.currentSave.equipment = {};
        }
        // 运行时自修复：若“已穿戴”为空，按当前玩家的 startEquipped 规则回填一次
        // 兼容 ownerId 可能写成角色 id / 角色名 / 为空。
        const listGame = (Array.isArray(CYOA.games) ? CYOA.games : []).find(g => g && g.id === CYOA.currentGame?.id);
        const equipCatalog = (Array.isArray(CYOA.currentGame?.equipment) && CYOA.currentGame.equipment.length > 0)
            ? CYOA.currentGame.equipment
            : (Array.isArray(listGame?.equipment) ? listGame.equipment : []);
        if (Object.keys(CYOA.currentSave.equipment).length === 0 && Array.isArray(equipCatalog) && equipCatalog.length > 0) {
            const pId = String(CYOA.currentSave.playerCharacterId || '').trim();
            const pName = String(CYOA.currentSave.playerCharacter || '').trim();
            const fallbackEquips = equipCatalog.filter(eq => {
                if (!eq?.startEquipped) return false;
                const owner = String(eq.ownerId || '').trim();
                if (!owner) return true;
                return (pId && owner === pId) || (pName && owner === pName);
            });
            fallbackEquips.forEach(eq => {
                const slots = Array.isArray(eq.slots) ? eq.slots : [];
                const copy = JSON.parse(JSON.stringify(eq));
                slots.forEach(slot => {
                    CYOA.currentSave.equipment[slot] = copy;
                });
                if (copy.id) {
                    if (!Array.isArray(CYOA.currentSave.acquiredItemIds)) CYOA.currentSave.acquiredItemIds = [];
                    if (!CYOA.currentSave.acquiredItemIds.includes(copy.id)) CYOA.currentSave.acquiredItemIds.push(copy.id);
                }
            });
            if (fallbackEquips.length > 0) {
                try { CYOA.persistSave?.(); } catch (_) {}
            }
        }
        const equipped = CYOA.currentSave.equipment || {};
        if (Object.keys(equipped).length === 0) {
            equipContent += `<div class="cyoa-empty-state">${t('ui.empty.noEquipped')}</div>`;
        } else {
            const slotIconMap = {
                head: "🪖", eyes: "👁️", ears: "👂", mouth: "👄", nose: "👃", neck: "🧣",
                chest: "🫀", waist: "🩱", hips: "🩲", crotch: "🔒",
                shoulder: "🦴", upper_arm: "💪", elbow: "🦾", forearm: "🦾", wrist: "⌚", palm: "✋", fingers: "🤌",
                thigh: "🦵", knee: "🦿", calf: "🦵", ankle: "🦶", foot: "👣"
            };
            const grouped = new Map();
            Object.entries(equipped).forEach(([slot, item]) => {
                if (!item) return;
                const key = item.id ? `id:${item.id}` : `slot:${slot}`;
                const old = grouped.get(key);
                if (old) {
                    old.slots.add(slot);
                    return;
                }
                grouped.set(key, {
                    slot,
                    item,
                    slots: new Set([slot])
                });
            });
            equipContent += '<div style="display: grid; gap: 8px;">';
            Array.from(grouped.values()).forEach(({ slot, item, slots }) => {
                const equipDef = CYOA.currentGame?.equipment?.find(e => e.id === item.id);
                const coveredSlots = Array.isArray(item.slots) && item.slots.length
                    ? item.slots
                    : (Array.isArray(equipDef?.slots) && equipDef.slots.length ? equipDef.slots : Array.from(slots));
                const coveredIcons = coveredSlots.slice(0, 10).map((s) => {
                    const label = CONFIG.EQUIPMENT_SLOTS.find(x => x.value === s)?.label || s;
                    const icon = slotIconMap[s] || "•";
                    return `<span title="${escapeHtml(label)}" style="display:inline-flex; align-items:center; justify-content:center; width:16px; height:16px; font-size:12px; border:1px solid var(--border); border-radius:999px; background:var(--bg-light);">${icon}</span>`;
                }).join('');
                const isIndestructible = item.indestructible ?? equipDef?.indestructible ?? false;
                const maxDura = item.maxDurability ?? equipDef?.maxDurability ?? 0;
                const curDura = item.durability ?? equipDef?.durability ?? 0;
                const duraPct = maxDura > 0 ? Math.round((curDura / maxDura) * 100) : 0;
                const duraColor = duraPct > 50 ? '#22c55e' : duraPct > 25 ? '#f59e0b' : '#ef4444';
                const lockLv = typeof item.lockLevel === 'number' ? item.lockLevel : (typeof equipDef?.lockLevel === 'number' ? equipDef.lockLevel : (item.locked === true || equipDef?.locked === true ? 3 : 0));
                const lockDef = CONFIG.LOCK_LEVELS?.find(l => l.value === lockLv);

                equipContent += `
                    <div style="display: flex; align-items: flex-start; gap: 8px; background: var(--bg); padding: 8px 12px; border-radius: var(--radius-md); border: 1px solid var(--border);">
                        <span style="font-size: 18px; margin-top:2px;">${item.icon || '⚔️'}</span>
                        <div style="flex: 1; min-width:0;">
                            <div style="display:flex; align-items:center; gap:4px; flex-wrap:wrap;">
                                <span style="font-weight: 600;">${escapeHtml(item.name)}</span>
                                ${lockLv > 0 ? `<span style="font-size:11px; background:${lockLv >= 5 ? '#7c3aed' : lockLv >= 3 ? '#dc2626' : '#f59e0b'}; color:#fff; padding:1px 6px; border-radius:8px;" title="${escapeHtml(lockDef?.desc || '')}">${escapeHtml(lockDef?.label || 'Lv'+lockLv)}</span>` : ''}
                                ${isIndestructible ? `<span style="font-size:11px; background:#3b82f6; color:#fff; padding:1px 6px; border-radius:8px;">${t('ui.status.indestructible')}</span>` : ''}
                            </div>
                            <div style="display:flex; align-items:center; gap:4px; margin-top:3px;">${coveredIcons}</div>
                            ${!isIndestructible && maxDura > 0 ? `
                                <div style="margin-top:3px;">
                                    <div style="display:flex; justify-content:space-between; font-size:10px; color:var(--text-light); margin-bottom:1px;">
                                        <span>${t('ui.sidebar.dur')}</span><span>${curDura}/${maxDura} (${duraPct}%)</span>
                                    </div>
                                    ${progressBar(duraPct, duraColor)}
                                </div>
                            ` : ''}
                        </div>
                        <div style="display:flex; flex-direction:column; gap:3px; align-items:center;">
                            ${lockLv >= 1 && lockLv < 5 ? `<button class="cyoa-btn-icon" onclick="CYOA.handleStruggle('${escapeHtml(slot)}')" title="${t('ui.btn.struggle')}" style="font-size:16px;">✊</button>` : ''}
                            ${lockLv >= 2 && lockLv < 5 ? `<button class="cyoa-btn-icon" onclick="CYOA.unlockEquipment('${escapeHtml(slot)}')" title="解锁" style="font-size:16px;">🔑</button>` : ''}
                            <button class="cyoa-btn-icon" onclick="CYOA.unequipItem('${escapeHtml(slot)}')" title="${t('ui.btn.unequip')}">⬇️</button>
                        </div>
                    </div>
                `;
            });
            equipContent += '</div>';
        }
        const equipCount = (() => {
            const ids = new Set();
            Object.values(equipped).forEach((it) => {
                const k = String(it?.id || "");
                if (k) ids.add(k);
            });
            return ids.size || Object.keys(equipped).length;
        })();
        html += CYOA.wrapCollapsible?.('panel_equip', t('ui.sidebar.equippedN', {n: equipCount}), equipContent, false) || '';

        // 背包
        let bagContent = '';
        if (!CYOA.currentSave.inventory || CYOA.currentSave.inventory.length === 0) {
            bagContent += `<div class="cyoa-empty-state">${t('ui.empty.bagEmpty')}</div>`;
        } else {
            bagContent += '<div style="display: grid; gap: 8px;">';
            CYOA.currentSave.inventory.forEach((item, index) => {
                const itemTypeLabel = getItemTypeLabel(item.itemType);
                const pCharId = CYOA.currentSave.playerCharacterId || '';
                const isEquippable = CYOA.currentGame.equipment && CYOA.currentGame.equipment.some(e => e.id === item.id && (!e.ownerId || e.ownerId === pCharId || (CYOA.currentSave.acquiredItemIds || []).includes(e.id)));
                const isConsumable = item.itemType === 'consumable' || item.itemType === 'healing' || item.itemType === 'fuel';

                const qty = item.quantity || 1;
                const qtyBadge = qty > 1 ? `<span style="position:absolute; top:-4px; right:-4px; background:var(--primary); color:#fff; font-size:10px; font-weight:700; min-width:18px; height:18px; line-height:18px; text-align:center; border-radius:9px; padding:0 4px;">×${qty}</span>` : '';

                bagContent += `
                    <div style="display: flex; align-items: center; gap: 8px; background: var(--bg); padding: 8px 12px; border-radius: var(--radius-md); border: 1px solid var(--border);">
                        <span style="font-size: 18px; position:relative;">${item.icon || '📦'}${qtyBadge}</span>
                        <div style="flex: 1;">
                            <div style="font-weight: 600;">${escapeHtml(item.name)}${qty > 1 ? ' <span style="color:var(--text-light);font-weight:400;font-size:12px;">×' + qty + '</span>' : ''}</div>
                            <div style="font-size: 11px; color: var(--text-light);">${itemTypeLabel}</div>
                            ${item.durability ? `<div style="font-size: 11px; color: var(--text-light);">${t('ui.sidebar.durability')} ${item.durability}</div>` : ''}
                            ${item.description ? `<div style="font-size: 11px; color: var(--text-light);">${escapeHtml(item.description)}</div>` : ''}
                        </div>
                        <div style="display: flex; gap: 4px;">
                            ${isEquippable ? `<button class="cyoa-btn-icon" onclick="CYOA.equipItem(${index})" title="${t('ui.btn.equip')}">⬆️</button>` : ''}
                            ${isConsumable ? `<button class="cyoa-btn-icon" onclick="CYOA.useConsumable(${index})" title="${t('ui.btn.use')}">✨</button>` : ''}
                        </div>
                    </div>
                `;
            });
            bagContent += '</div>';
        }
        const bagCount = CYOA.currentSave.inventory?.length || 0;
        html += CYOA.wrapCollapsible?.('panel_bag', t('ui.sidebar.inventoryN', {n: bagCount}), bagContent, false) || '';

        // RAG + AI记忆面板
        html += CYOA.wrapCollapsible?.('panel_rag', '📚 AI知识库', CYOA.buildRAGPanel?.(), false) || '';

        html += '</div>';
        container.innerHTML = html;

        // RAG面板按钮绑定
        container.querySelector('#cyoa-rag-rebuild')?.addEventListener('click', () => {
            CYOA.generateRAG?.();
            CYOA.renderInventoryPanel?.();
        });
        container.querySelector('#cyoa-rag-view')?.addEventListener('click', () => {
            const rag = CYOA.getRAG?.() || '（空）';
            const win = window.open('', '_blank', 'width=700,height=600');
            if (win) {
                win.document.title = 'RAG 知识库预览';
                win.document.body.style.cssText = 'font-family:monospace;white-space:pre-wrap;padding:20px;background:#1a1a2e;color:#e0e0e0;';
                win.document.body.textContent = rag;
            }
        });
        // 背包刷新后同步状态面板
        CYOA.renderStatusPanel?.();
    };
})();
