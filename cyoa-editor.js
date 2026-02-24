/**
 * CYOA 插件编辑器模块 v2.1
 * 包含：编辑器界面、表单渲染、编辑功能、模态框系统
 */

(function() {
    const CYOA = window.CYOA;
    if (!CYOA || !CYOA.CONFIG) {
        console.error('[CYOA] 核心模块未加载');
        return;
    }

    const CONFIG = CYOA.CONFIG;
    const log = CYOA.log;
    const error = CYOA.error;
    const escapeHtml = CYOA.escapeHtml;
    const getTypeName = CYOA.getTypeName;
    const getItemTypeLabel = CYOA.getItemTypeLabel;
    const getSkillTypeLabel = CYOA.getSkillTypeLabel;
    const getQuestTypeLabel = CYOA.getQuestTypeLabel;
    const getRoleTypeLabel = CYOA.getRoleTypeLabel;
    const getChatModels = CYOA.getChatModels;
    const getItemsForSelect = CYOA.getItemsForSelect;
    const getSkillsForSelect = CYOA.getSkillsForSelect;
    const t = CYOA.t;

    // ========== 模态框系统 ==========
    const ModalSystem = {
        currentModal: null,

        open: function(title, contentHtml, footerHtml, options = {}) {
            this.close();

            const overlay = document.createElement('div');
            overlay.className = 'cyoa-modal-overlay';
            
            const modal = document.createElement('div');
            modal.className = 'cyoa-modal';
            if (options.size) modal.classList.add('cyoa-modal-' + options.size);
            
            modal.innerHTML = `
                <div class="cyoa-modal-header">
                    <h3 class="cyoa-modal-title"><span class="modal-icon">${options.icon || '📝'}</span> ${escapeHtml(title)}</h3>
                    <button class="cyoa-modal-close" id="cyoaModalCloseBtn">&times;</button>
                </div>
                <div class="cyoa-modal-body">${contentHtml}</div>
                <div class="cyoa-modal-footer">${footerHtml}</div>
            `;

            overlay.appendChild(modal);
            document.body.appendChild(overlay);
            requestAnimationFrame(() => overlay.classList.add('active'));

            const escHandler = (e) => { if (e.key === 'Escape') closeHandler(); };
            const closeHandler = () => {
                document.removeEventListener('keydown', escHandler);
                ModalSystem.currentModal = null;
                overlay.classList.remove('active');
                setTimeout(() => { overlay.remove(); if (options.onClose) options.onClose(); }, 200);
            };

            modal.querySelector('.cyoa-modal-close').onclick = closeHandler;
            overlay.onclick = (e) => { if (e.target === overlay && options.closeOnOverlay) closeHandler(); };
            modal.onclick = (e) => e.stopPropagation();
            document.addEventListener('keydown', escHandler);

            this.currentModal = { close: closeHandler, overlay, modal, options };
            return this.currentModal;
        },

        close: function() {
            if (this.currentModal) {
                this.currentModal.close();
                this.currentModal = null;
            }
        }
    };
    CYOA.ModalSystem = ModalSystem;

    // ========== 渲染缩略表格 ==========
    function renderSummaryTable(items, type) {
        if (!items || items.length === 0) {
            return `<div class="cyoa-empty-state">${t('ui.empty.noType', {type: getTypeName(type)})}</div>`;
        }
        
        let html = '<div class="cyoa-summary-grid">';
        
        items.forEach((item, index) => {
            html += `<div class="cyoa-summary-item" data-type="${type}" data-index="${index}">`;
            html += `<div class="cyoa-item-preview">`;
            
            switch(type) {
                case 'attributes':
                    html += `<span class="item-icon">📊</span>`;
                    html += `<span class="item-name">${escapeHtml(item.name || t('ui.status.unnamed'))}</span>`;
                    html += `<span class="item-value">${item.value || 0}/${item.max || 100}</span>`;
                    if (item.description) html += `<span class="item-desc">${escapeHtml(item.description.substring(0, 20))}</span>`;
                    break;
                    
                case 'items':
                    html += `<span class="item-icon">${item.itemType === 'relic' ? '📿' : item.itemType === 'key' ? '🔑' : '📦'}</span>`;
                    html += `<span class="item-name">${escapeHtml(item.name || t('ui.status.unnamed'))}</span>`;
                    html += `<span class="item-type">${getItemTypeLabel(item.itemType)}</span>`;
                    if (item.itemType === 'relic' && item.relicGrade) html += `<span class="item-badge">${item.relicGrade}</span>`;
                    if (item.durability) html += `<span class="item-value">🔨${item.durability}</span>`;
                    if (item.locked) html += `<span class="item-locked">🔒</span>`;
                    break;
                    
                case 'equipment':
                    html += `<span class="item-icon">⚔️</span>`;
                    html += `<span class="item-name">${escapeHtml(item.name || t('ui.status.unnamed'))}</span>`;
                    html += `<span class="item-type">${escapeHtml(item.equipType || t('ui.type.equipment'))}</span>`;
                    html += `<span class="item-slots">${item.slots?.length || 0} ${t('ui.summary.slot')}</span>`;
                    if (item.indestructible) {
                        html += `<span class="item-value" title="${t('ui.label.indestructible')}">♾️</span>`;
                    } else if (item.durability !== undefined) {
                        html += `<span class="item-value">🔨${item.durability}/${item.maxDurability || item.durability}</span>`;
                    }
                    if (Array.isArray(item.constraints) && item.constraints.includes('limited_step') && item.stepLimitCm) {
                        const pctStr = (item.speedModifierPct ?? 0) >= 0 ? '+' + (item.speedModifierPct ?? 0) + '%' : (item.speedModifierPct ?? 0) + '%';
                        html += `<span class="item-desc" title="${t('ui.label.limitStepParams')}">🚶${item.stepLimitCm}cm/${pctStr}</span>`;
                    }
                    if (item.attachments?.length) html += `<span class="item-count" title="${t('ui.label.attachmentSystem')}">🔩${item.attachments.length}</span>`;
                    if (item.startEquipped) html += `<span class="item-count" title="${t('ui.label.initialWear')}" style="color:#e0a000;">🎒</span>`;
                    {
                        const lv = typeof item.lockLevel === 'number' ? item.lockLevel : (item.locked ? 3 : 0);
                        if (lv > 0) html += `<span class="item-locked" title="${CYOA.getLockLevelLabel(lv)}">${lv >= 5 ? '⛓️' : lv >= 3 ? '🔐' : '🔒'}</span>`;
                    }
                    break;
                    
                case 'professions':
                    html += `<span class="item-icon">${escapeHtml(item.icon || '🎭')}</span>`;
                    html += `<span class="item-name">${escapeHtml(item.name || t('ui.status.unnamed'))}</span>`;
                    if (item.skills?.length) html += `<span class="item-count">✨${item.skills.length} ${t('ui.summary.skills')}</span>`;
                    if (item.statModifiers && typeof item.statModifiers === 'string') html += `<span class="item-desc">${escapeHtml(item.statModifiers.substring(0, 20))}</span>`;
                    else if (Array.isArray(item.statModifiers) && item.statModifiers.length) html += `<span class="item-desc">📊${item.statModifiers.length}${t('ui.summary.modifiers')}</span>`;
                    if (item.traits) html += `<span class="item-desc" title="${escapeHtml(item.traits)}">📋${t('ui.label.traits')}</span>`;
                    break;
                    
                case 'skills':
                    html += `<span class="item-icon">${item.skillType === 'magic' ? '✨' : '⚔️'}</span>`;
                    html += `<span class="item-name">${escapeHtml(item.name || t('ui.status.unnamed'))}</span>`;
                    html += `<span class="item-type">${getSkillTypeLabel(item.skillType)}</span>`;
                    if (item.learned) html += `<span class="item-badge">✅${t('ui.summary.learned')}</span>`;
                    if (item.requiredAttributes) html += `<span class="item-desc">${t('ui.label.attrRequire')}</span>`;
                    break;
                    
                case 'quests':
                    html += `<span class="item-icon">${item.questType === 'main' ? '📌' : '📋'}</span>`;
                    html += `<span class="item-name">${escapeHtml(item.name || t('ui.status.unnamed'))}</span>`;
                    html += `<span class="item-type">${getQuestTypeLabel(item.questType)}</span>`;
                    html += `<span class="item-count">🎯 ${item.objectives?.length || 0} ${t('ui.summary.objectives')}</span>`;
                    if (item.status) html += `<span class="item-badge">${item.status}</span>`;
                    break;
                    
                case 'characters':
                    html += `<span class="item-icon">${item.roleType === 'narrator' ? '📖' : '👤'}</span>`;
                    html += `<span class="item-name">${escapeHtml(item.name || t('ui.status.unnamed'))}</span>`;
                    html += `<span class="item-type">${getRoleTypeLabel(item.roleType)}</span>`;
                    if (item.professions?.length) {
                        const profNames = item.professions.map(pid => {
                            const pDef = CYOA.editorTempData?.professions?.find(p => p.id === pid);
                            return pDef ? pDef.name : pid;
                        }).join('/');
                        html += `<span class="item-desc" title="${t('ui.type.professions')}">🎭${escapeHtml(profNames)}</span>`;
                    }
                    if (item.skills?.length) html += `<span class="item-count">✨${item.skills.length}</span>`;
                    break;
                    
                case 'scenes':
                    html += `<span class="item-icon">📍</span>`;
                    html += `<span class="item-name">${escapeHtml(item.name || t('ui.status.unnamed'))}</span>`;
                    if (item.location) html += `<span class="item-desc">${escapeHtml(item.location.substring(0, 15))}</span>`;
                    html += `<span class="item-count">🔄 ${item.interactables?.length || 0}</span>`;
                    if (item.quests?.length) html += `<span class="item-count">📋${item.quests.length}</span>`;
                    break;
                    
                case 'chapters':
                    html += `<span class="item-icon">${item.unlocked !== false ? '📖' : '🔒'}</span>`;
                    html += `<span class="item-name">${escapeHtml(item.title || t('ui.status.unnamed'))}</span>`;
                    html += `<span class="item-type">${t('ui.status.chapterN', {n: item.order || index + 1})}</span>`;
                    html += `<span class="item-count">📄 ${t('ui.status.nScenes', {n: item.scenes?.length || 0})}</span>`;
                    break;

                case 'storyCards':
                    const cardTypeDef = (CONFIG.STORY_CARD_TYPES || []).find(tp => tp.value === item.type);
                    html += `<span class="item-icon">${cardTypeDef?.label?.charAt(0) || '📝'}</span>`;
                    html += `<span class="item-name">${escapeHtml(item.name || t('ui.status.unnamed'))}</span>`;
                    const triggers = Array.isArray(item.triggerWords) ? item.triggerWords : (item.triggerWords || '').split(/[,，\s]+/).filter(Boolean);
                    html += `<span class="item-desc">${escapeHtml((triggers.slice(0, 3).join(', ') + (triggers.length > 3 ? '...' : '')) || t('ui.storyCard.triggers')}</span>`;
                    break;
            }
            
            html += `</div>`;
            html += `<div class="cyoa-item-actions">`;
            html += `<button class="cyoa-btn-icon edit-item" title="${t('ui.btn.edit')}">✏️</button>`;
            html += `<button class="cyoa-btn-icon danger delete-item" title="${t('ui.btn.delete')}">🗑️</button>`;
            html += `</div></div>`;
        });
        
        html += '</div>';
        return html;
    }

    // ========== 刷新列表显示 ==========
    function refreshList(type) {
        const container = CYOA.$(type + 'List');
        if (!container || !CYOA.editorTempData) return;
        
        const items = CYOA.editorTempData[type] || [];
        container.innerHTML = renderSummaryTable(items, type);
        
        // 重新绑定事件
        bindListEvents(container, type);
    }

    // ========== 绑定列表事件 ==========
    function bindListEvents(container, type) {
        if (!container) return;
        
        // 编辑按钮
        container.querySelectorAll('.edit-item').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (!CYOA.editorTempData) {
                    alert(t('ui.msg.editorDataError'));
                    return;
                }
                const item = e.target.closest('.cyoa-summary-item');
                if (item) {
                    const index = parseInt(item.dataset.index);
                    showEditForm(type, index);
                }
            });
        });
        
        // 删除按钮
        container.querySelectorAll('.delete-item').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (!CYOA.editorTempData || !CYOA.editorTempData[type]) {
                    alert(t('ui.msg.editorDataError'));
                    return;
                }
                if (!confirm(t('ui.msg.confirmDeleteItem'))) return;
                
                const item = e.target.closest('.cyoa-summary-item');
                if (item) {
                    const index = parseInt(item.dataset.index);
                    CYOA.editorTempData[type].splice(index, 1);
                    refreshList(type);
                }
            });
        });
    }

    // ========== 显示编辑表单 ==========
    function showEditForm(type, index) {
        if (!CYOA.editorTempData || !CYOA.editorTempData[type]) {
            alert(t('ui.msg.editorDataError'));
            return;
        }
        const arr = CYOA.editorTempData[type];
        if (index < 0 || index >= arr.length) {
            alert(t('ui.msg.itemDeleted'));
            return;
        }
        CYOA.editingItem = { type, index };
        
        const formContainer = CYOA.$('editFormContainer');
        if (!formContainer) return;
        
        const item = arr[index];
        let html = '';
        
        switch(type) {
            case 'attributes':
                html = renderAttributeForm(item, index);
                break;
            case 'items':
                html = renderItemForm(item, index);
                break;
            case 'equipment':
                html = renderEquipmentForm(item, index);
                break;
            case 'professions':
                html = renderProfessionForm(item, index);
                break;
            case 'skills':
                html = renderSkillForm(item, index);
                break;
            case 'quests':
                html = renderQuestForm(item, index);
                break;
            case 'characters':
                html = renderCharacterForm(item, index);
                break;
            case 'scenes':
                html = renderSceneForm(item, index);
                break;
            case 'chapters':
                html = renderChapterForm(item, index);
                break;
            case 'locations':
                html = renderLocationForm(item, index);
                break;
            case 'equipmentSynergies':
                html = renderSynergyForm(item, index);
                break;
            case 'discoveryRules':
                html = renderDiscoveryForm(item, index);
                break;
            case 'outfitPresets':
                html = renderPresetForm(item, index);
                break;
            case 'storyCards':
                html = renderStoryCardForm(item, index);
                break;
        }
        
        formContainer.innerHTML = html;
        formContainer.style.display = 'block';
        
        // 绑定表单事件
        bindFormEvents(type, index);
    }

    // ========== 渲染各种表单 ==========
    function renderAttributeForm(attr, index) {
        return `
            <div class="cyoa-edit-form">
                <h4>${attr.id ? t('ui.editor.editItem', {type: t('ui.type.attributes')}) : t('ui.editor.newItem', {type: t('ui.type.attributes')})}</h4>
                <div class="cyoa-form-row">
                    <label>${t('ui.label.attrName')}</label>
                    <input type="text" id="editAttrName" class="cyoa-input" value="${escapeHtml(attr.name || '')}">
                </div>
                <div class="cyoa-form-row cyoa-grid-3">
                    <div><label>${t('ui.label.currentVal')}</label><input type="number" id="editAttrValue" class="cyoa-input" value="${attr.value || 0}"></div>
                    <div><label>${t('ui.label.minVal')}</label><input type="number" id="editAttrMin" class="cyoa-input" value="${attr.min || 0}"></div>
                    <div><label>${t('ui.label.maxVal')}</label><input type="number" id="editAttrMax" class="cyoa-input" value="${attr.max || 100}"></div>
                </div>
                <div class="cyoa-form-row">
                    <label>${t('ui.label.description')}</label>
                    <input type="text" id="editAttrDesc" class="cyoa-input" value="${escapeHtml(attr.description || '')}">
                </div>
                <div class="cyoa-form-actions">
                    <button class="cyoa-btn cyoa-btn-secondary" onclick="CYOA.cancelEdit()">${t('ui.btn.cancel')}</button>
                    <button class="cyoa-btn cyoa-btn-primary" onclick="CYOA.saveAttribute(${index})">${t('ui.btn.saveAttr')}</button>
                </div>
            </div>
        `;
    }

    function renderItemForm(item, index) {
        const typeOptions = CONFIG.ITEM_TYPES.map(t => 
            `<option value="${t.value}" ${t.value === item.itemType ? 'selected' : ''}>${t.label}</option>`
        ).join('');
        
        const items = getItemsForSelect(item.id);
        const unlockOptions = items.map(i => 
            `<option value="${i.value}" ${i.value === item.unlockItemId ? 'selected' : ''}>${i.label}</option>`
        ).join('');
        
        // 技能选项
        const skills = getSkillsForSelect();
        const skillOptions = skills.map(s => 
            `<option value="${s.value}">${s.label}</option>`
        ).join('');
        
        // 已选技能
        const selectedSkills = item.skills || [];
        
        // 消耗物品选项
        const consumeOptions = items.map(i => 
            `<option value="${i.value}">${i.label}</option>`
        ).join('');
        
        // 角色选项
        const characters = CYOA.editorTempData?.characters || [];
        const ownerOptions = characters.map(char => 
            `<option value="${char.id}" ${char.id === item.ownerId ? 'selected' : ''}>${char.name}</option>`
        ).join('');
        
        return `
            <div class="cyoa-edit-form">
                <h4>${item.id ? t('ui.editor.editItem', {type: t('ui.type.items')}) : t('ui.editor.newItem', {type: t('ui.type.items')})}</h4>
                <div class="cyoa-form-row">
                    <label>${t('ui.label.itemName')}</label>
                    <input type="text" id="editItemName" class="cyoa-input" value="${escapeHtml(item.name || '')}">
                </div>
                <div class="cyoa-form-row">
                    <label>${t('ui.label.itemType')}</label>
                    <select id="editItemType" class="cyoa-select" onchange="var r=document.getElementById('relicFields');if(r)r.style.display=this.value==='relic'?'block':'none'">${typeOptions}</select>
                </div>
                <div class="cyoa-form-row cyoa-grid-2">
                    <div>
                        <label>${t('ui.label.quantity')}（${CONFIG.ITEM_MAX_QUANTITY || 99} max）</label>
                        <input type="number" id="editItemQuantity" class="cyoa-input" value="${item.quantity || 1}" min="1" max="${CONFIG.ITEM_MAX_QUANTITY || 99}">
                    </div>
                    <div>
                        <label>${t('ui.label.durability')}</label>
                        <input type="number" id="editItemDurability" class="cyoa-input" value="${item.durability || 0}" min="0">
                    </div>
                </div>
                <div class="cyoa-form-row">
                    <label>${t('ui.label.ownerChar')}</label>
                    <select id="editItemOwner" class="cyoa-select">
                        <option value="">${t('ui.opt.noOwner')}</option>
                        ${ownerOptions}
                    </select>
                </div>
                <div class="cyoa-form-row cyoa-checkbox-row">
                    <label><input type="checkbox" id="editItemLocked" ${item.locked ? 'checked' : ''}> ${t('ui.label.locked')}</label>
                </div>
                <div class="cyoa-form-row">
                    <label>${t('ui.label.unlockItem')}</label>
                    <select id="editItemUnlock" class="cyoa-select"><option value="">${t('ui.opt.none')}</option>${unlockOptions}</select>
                </div>
                <div class="cyoa-form-row">
                    <label>${t('ui.label.attachedSkills')}</label>
                    <select id="editItemSkills" class="cyoa-select" multiple size="3">
                        ${skillOptions}
                    </select>
                    <small>${t('ui.hint.ctrlSelect')}</small>
                </div>
                <div class="cyoa-form-row">
                    <label>${t('ui.label.consumeItems')}</label>
                    <div id="consumeItemsList">
                        ${renderConsumeItems(item.consumeItems || [])}
                    </div>
                    <button class="cyoa-btn cyoa-btn-secondary cyoa-btn-sm add-consume-item" type="button">${t('ui.btn.addConsume')}</button>
                </div>
                <div class="cyoa-form-row">
                    <label>${t('ui.label.statEffect')}</label>
                    <input type="text" id="editItemStats" class="cyoa-input" value="${escapeHtml(item.statModifiers || '')}" placeholder="${t('ui.ph.statEffect')}">
                </div>
                <div class="cyoa-form-row">
                    <label>${t('ui.label.description')}</label>
                    <input type="text" id="editItemDesc" class="cyoa-input" value="${escapeHtml(item.description || '')}">
                </div>
                <div id="relicFields" class="cyoa-form-row" style="display:${item.itemType === 'relic' ? 'block' : 'none'};">
                    <label>${t('ui.label.relicGrade')}</label>
                    <select id="editItemRelicGrade" class="cyoa-select">
                        ${(CONFIG.RELIC_GRADES || []).map(g => `<option value="${g.value}" ${g.value === (item.relicGrade || 'S') ? 'selected' : ''}>${g.label}</option>`).join('')}
                    </select>
                    <label style="margin-top:6px;">${t('ui.label.sideEffects')}</label>
                    <input type="text" id="editItemSideEffects" class="cyoa-input" value="${escapeHtml(item.sideEffects || '')}" placeholder="${t('ui.ph.sideEffects')}">
                    <label style="margin-top:6px;">${t('ui.label.unlockCondition')}</label>
                    <input type="text" id="editItemUnlockCond" class="cyoa-input" value="${escapeHtml(item.unlockCondition || '')}" placeholder="${t('ui.ph.unlockCondition')}">
                </div>
                <div class="cyoa-form-actions">
                    <button class="cyoa-btn cyoa-btn-secondary" onclick="CYOA.cancelEdit()">${t('ui.btn.cancel')}</button>
                    <button class="cyoa-btn cyoa-btn-primary" onclick="CYOA.saveItem(${index})">${t('ui.btn.saveItem')}</button>
                </div>
            </div>
        `;
    }

    function renderConsumeItems(consumeItems) {
        if (!consumeItems || consumeItems.length === 0) {
            return '<div class="cyoa-empty-row">' + t('ui.empty.noConsume') + '</div>';
        }
        
        const items = getItemsForSelect();
        let html = '';
        consumeItems.forEach((consume, i) => {
            html += `
                <div class="cyoa-consume-row" data-index="${i}">
                    <select class="cyoa-select consume-item-select" style="width:150px;">
                        <option value="">${t('ui.opt.selectItem')}</option>
                        ${items.map(item => `<option value="${item.value}" ${item.value === consume.itemId ? 'selected' : ''}>${item.label}</option>`).join('')}
                    </select>
                    <input type="number" class="cyoa-input consume-item-amount" value="${consume.amount || 1}" min="1" style="width:80px;" placeholder="${t('ui.ph.quantity')}">
                    <input type="number" class="cyoa-input consume-item-duration" value="${consume.duration || 0}" min="0" style="width:80px;" placeholder="${t('ui.ph.duration')}">
                    <button class="cyoa-btn-icon danger remove-consume-item">🗑️</button>
                </div>
            `;
        });
        return html;
    }

    function renderEquipmentForm(equip, index) {
        const items = getItemsForSelect(equip.id);
        const unlockOptions = items.map(i => 
            `<option value="${i.value}" ${i.value === equip.unlockItemId ? 'selected' : ''}>${i.label}</option>`
        ).join('');
        
        const selectedSlots = equip.slots || [];
        const commonSlots = CONFIG.EQUIPMENT_SLOTS.filter(s => s.group === 'common' || !s.group);
        const femaleSlots = CONFIG.EQUIPMENT_SLOTS.filter(s => s.group === 'female');
        const maleSlots = CONFIG.EQUIPMENT_SLOTS.filter(s => s.group === 'male');
        const buildSlotCbs = (slots) => slots.map(slot => {
            const checked = selectedSlots.includes(slot.value) ? 'checked' : '';
            return `<label class="cyoa-slot-checkbox"><input type="checkbox" class="slot-checkbox" value="${slot.value}" ${checked}> ${slot.label}</label>`;
        }).join('');
        const slotOptions = buildSlotCbs(commonSlots)
            + (femaleSlots.length ? `<div style="width:100%; border-top:1px dashed var(--border); margin:4px 0; padding-top:4px;"><small style="color:#ec4899;">${t('ui.summary.femaleSlots')}</small></div>` + buildSlotCbs(femaleSlots) : '')
            + (maleSlots.length ? `<div style="width:100%; border-top:1px dashed var(--border); margin:4px 0; padding-top:4px;"><small style="color:#3b82f6;">${t('ui.summary.maleSlots')}</small></div>` + buildSlotCbs(maleSlots) : '');
        
        // 技能选项
        const skills = getSkillsForSelect();
        const skillOptions = skills.map(s => 
            `<option value="${s.value}">${s.label}</option>`
        ).join('');
        
        // 角色选项
        const characters = CYOA.editorTempData?.characters || [];
        const ownerOptions = characters.map(char => 
            `<option value="${char.id}" ${char.id === equip.ownerId ? 'selected' : ''}>${char.name}</option>`
        ).join('');
        
        return `
            <div class="cyoa-edit-form">
                <h4>${equip.id ? t('ui.editor.editItem', {type: t('ui.type.equipment')}) : t('ui.editor.newItem', {type: t('ui.type.equipment')})}</h4>
                <div class="cyoa-form-row">
                    <label>${t('ui.label.equipName')}</label>
                    <input type="text" id="editEquipName" class="cyoa-input" value="${escapeHtml(equip.name || '')}">
                </div>
                <div class="cyoa-form-row">
                    <label>${t('ui.label.equipType')}</label>
                    <input type="text" id="editEquipType" class="cyoa-input" value="${escapeHtml(equip.equipType || t('ui.default.equipType'))}">
                </div>
                <div class="cyoa-form-row cyoa-checkbox-row" style="margin-bottom:4px;">
                    <label><input type="checkbox" id="editEquipIndestructible" ${equip.indestructible ? 'checked' : ''}> ${t('ui.status.indestructible')} <small style="color:var(--text-light);">${t('ui.hint.indestructible')}</small></label>
                </div>
                <div class="cyoa-form-row cyoa-checkbox-row" style="margin-bottom:4px;">
                    <label><input type="checkbox" id="editEquipStartEquipped" ${equip.startEquipped ? 'checked' : ''}> 🎒 ${t('ui.label.initialWear')} <small style="color:var(--text-light);">${t('ui.hint.initialWear')}</small></label>
                </div>
                <div class="cyoa-form-row cyoa-grid-2" id="equipDurabilityRow" style="${equip.indestructible ? 'opacity:0.4; pointer-events:none;' : ''}">
                    <div>
                        <label>${t('ui.label.currentDur')}</label>
                        <input type="number" id="editEquipDurability" class="cyoa-input" value="${equip.durability || 0}" min="0">
                    </div>
                    <div>
                        <label>${t('ui.label.maxDur')}</label>
                        <input type="number" id="editEquipMaxDurability" class="cyoa-input" value="${equip.maxDurability || 0}" min="0">
                    </div>
                </div>
                <div class="cyoa-form-row">
                    <label>${t('ui.label.ownerChar')}</label>
                    <select id="editEquipOwner" class="cyoa-select">
                        <option value="">${t('ui.opt.noOwner')}</option>
                        ${ownerOptions}
                    </select>
                </div>
                <div class="cyoa-form-row">
                    <label>${t('ui.label.selectSlot')}</label>
                    <div class="cyoa-slot-selector">${slotOptions}</div>
                </div>
                <div class="cyoa-form-row">
                    <label>${t('ui.label.material')}</label>
                    <select id="editEquipMaterial" class="cyoa-select">
                        <option value="">${t('ui.opt.noMaterial')}</option>
                        ${(CONFIG.MATERIAL_TEMPLATES && typeof CONFIG.MATERIAL_TEMPLATES === 'object') ? Object.entries(CONFIG.MATERIAL_TEMPLATES).map(([key, t]) => {
                            const label = (t && t.label) ? t.label : key;
                            const selected = (equip.material === key) ? 'selected' : '';
                            return `<option value="${escapeHtml(key)}" ${selected}>${escapeHtml(label)}</option>`;
                        }).join('') : ''}
                    </select>
                </div>
                <div class="cyoa-form-row">
                    <label>${t('ui.label.constraintEffect')}</label>
                    <div class="cyoa-constraint-selector">
                        ${(CONFIG.CONSTRAINTS || []).map(c => {
                            const checked = Array.isArray(equip.constraints) && equip.constraints.includes(c.value) ? 'checked' : '';
                            return `<label class="cyoa-constraint-checkbox"><input type="checkbox" class="constraint-checkbox" value="${escapeHtml(c.value)}" ${checked}> ${t(c.label)}</label>`;
                        }).join('')}
                    </div>
                    <small>${t('ui.hint.constraintCheckbox')}</small>
                </div>
                <div class="cyoa-form-row cyoa-limited-step-params" id="limitedStepParams" style="display:${Array.isArray(equip.constraints) && equip.constraints.includes('limited_step') ? 'block' : 'none'}; background:var(--bg); padding:12px; border-radius:var(--radius-sm); border:1px dashed var(--border);">
                    <label style="font-weight:600; margin-bottom:8px; display:block;">${t('ui.label.limitStepParams')}</label>
                    <div class="cyoa-grid-2">
                        <div>
                            <label>${t('ui.label.stepLimit')}</label>
                            <input type="number" id="editEquipStepLimitCm" class="cyoa-input" value="${equip.stepLimitCm ?? (CONFIG.LIMITED_STEP_DEFAULTS?.stepLimitCm || 20)}" min="1" max="200" step="1">
                            <small>${t('ui.hint.stepLimitCm')}</small>
                        </div>
                        <div>
                            <label>${t('ui.label.speedMod')}</label>
                            <input type="number" id="editEquipSpeedModifierPct" class="cyoa-input" value="${equip.speedModifierPct ?? (CONFIG.LIMITED_STEP_DEFAULTS?.speedModifierPct || -50)}" min="-100" max="100" step="5">
                            <small>${t('ui.hint.speedModPct')}</small>
                        </div>
                    </div>
                </div>
                <div class="cyoa-form-row" id="gagTypeParams" style="display:${Array.isArray(equip.slots) && equip.slots.includes('mouth') ? 'block' : 'none'}; background:var(--bg); padding:12px; border-radius:var(--radius-sm); border:1px dashed var(--border);">
                    <label style="font-weight:600; margin-bottom:8px; display:block;">${t('ui.label.gagType')}</label>
                    <select id="editEquipGagType" class="cyoa-select" style="margin-bottom:6px;">
                        <option value="">${t('ui.opt.noGag')}</option>
                        ${(CONFIG.GAG_TYPES || []).map(g => {
                            const sel = (equip.gagType === g.value) ? 'selected' : '';
                            return '<option value="' + g.value + '" ' + sel + '>' + t(g.label) + (g.forcedOpen ? ' ' + t('ui.sidebar.forcedOpen') : '') + '</option>';
                        }).join('')}
                    </select>
                    <small style="display:block; color:var(--text-light);">${t('ui.hint.forcedOpenMouth')}</small>
                </div>
                <div class="cyoa-form-row" id="earDeviceParams" style="display:${Array.isArray(equip.slots) && equip.slots.includes('ears') ? 'block' : 'none'}; background:var(--bg); padding:12px; border-radius:var(--radius-sm); border:1px dashed var(--border);">
                    <label style="font-weight:600; margin-bottom:8px; display:block;">${t('ui.label.earDevice')}</label>
                    <select id="editEquipEarDevice" class="cyoa-select" style="margin-bottom:6px;">
                        <option value="">${t('ui.opt.noEar')}</option>
                        ${(CONFIG.EAR_DEVICE_TYPES || []).map(e => {
                            const sel = (equip.earDeviceType === e.value) ? 'selected' : '';
                            const modeDef = (CONFIG.EAR_DEVICE_MODES || {})[e.mode] || {};
                            return '<option value="' + e.value + '" ' + sel + '>' + e.label + ' [' + (modeDef.label || e.mode) + ']</option>';
                        }).join('')}
                    </select>
                    <small style="display:block; color:var(--text-light);">${t('ui.hint.earDevice')}</small>
                </div>
                <div class="cyoa-form-row" id="fingerRestraintParams" style="display:${Array.isArray(equip.slots) && equip.slots.includes('fingers') ? 'block' : 'none'}; background:var(--bg); padding:12px; border-radius:var(--radius-sm); border:1px dashed var(--border);">
                    <label style="font-weight:600; margin-bottom:8px; display:block;">${t('ui.label.fingerRestraint')}</label>
                    <select id="editEquipFingerRestraint" class="cyoa-select" style="margin-bottom:6px;">
                        <option value="">${t('ui.opt.noFinger')}</option>
                        ${(CONFIG.FINGER_RESTRAINT_TYPES || []).map(f => {
                            const sel = (equip.fingerRestraintType === f.value) ? 'selected' : '';
                            return '<option value="' + f.value + '" ' + sel + '>' + f.label + ' [' + ((CONFIG.FINGER_SHAPE_EFFECTS || {})[f.shape] || {}).label + ']</option>';
                        }).join('')}
                    </select>
                    <small style="display:block; color:var(--text-light);">${t('ui.hint.fingerRestraint')}</small>
                </div>
                <div class="cyoa-form-row">
                    <label>${t('ui.label.lockLevel')}</label>
                    <select id="editEquipLockLevel" class="cyoa-select">
                        ${CONFIG.LOCK_LEVELS.map(l => {
                            const curLock = typeof equip.lockLevel === 'number' ? equip.lockLevel : (equip.locked ? 3 : 0);
                            return `<option value="${l.value}" ${curLock === l.value ? 'selected' : ''}>${l.label} — ${escapeHtml(l.desc)}</option>`;
                        }).join('')}
                    </select>
                    <small id="lockLevelHint" style="display:block; margin-top:4px; color:var(--text-light);"></small>
                </div>
                <div class="cyoa-form-row" id="equipUnlockItemRow" style="${(typeof equip.lockLevel === 'number' ? equip.lockLevel : (equip.locked ? 3 : 0)) >= 2 ? '' : 'display:none;'}">
                    <label>${t('ui.label.unlockItem')}</label>
                    <select id="editEquipUnlock" class="cyoa-select"><option value="">${t('ui.opt.none')}</option>${unlockOptions}</select>
                </div>
                <div class="cyoa-form-row">
                    <label>${t('ui.label.attachedSkills')}</label>
                    <select id="editEquipSkills" class="cyoa-select" multiple size="3">
                        ${skillOptions}
                    </select>
                    <small>${t('ui.hint.ctrlSelect')}</small>
                </div>
                <div class="cyoa-form-row">
                    <label>${t('ui.label.statEffect')}</label>
                    <input type="text" id="editEquipStats" class="cyoa-input" value="${escapeHtml(equip.statModifiers || '')}" placeholder="${t('ui.ph.statEffect')}">
                </div>
                <div class="cyoa-form-row">
                    <label>${t('ui.label.postureTags')}</label>
                    <small style="display:block; margin-bottom:4px; color:var(--text-light);">${t('ui.hint.postureTags')}</small>
                    <select id="editEquipPostureTags" class="cyoa-select" multiple style="height:90px; font-size:12px;">
                        ${(CONFIG.EQUIP_POSTURE_TAGS || []).map(tag => {
                            const checked = (equip.postureTags || []).includes(tag.value) ? 'selected' : '';
                            return '<option value="' + tag.value + '" ' + checked + '>' + tag.label + ' — ' + escapeHtml(tag.desc) + '</option>';
                        }).join('')}
                    </select>
                </div>
                <div class="cyoa-form-row" style="background:#f0fdf4; padding:12px; border-radius:var(--radius-sm); border:1px solid #86efac;">
                    <label style="font-weight:600; margin-bottom:8px; display:block;">⏱ 计时器/双层外观/兼容性</label>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                        <label><input type="checkbox" id="editEquipTimerEnabled" ${equip.timerEnabled ? 'checked' : ''}> 启用计时器</label>
                        <label><input type="checkbox" id="editEquipIsIntegrated" ${equip.isIntegrated ? 'checked' : ''}> 独立服装（占多槽组）</label>
                        <label><input type="checkbox" id="editEquipComfort" ${equip.comfortType ? 'checked' : ''}> 舒适型束缚（加速依赖度）</label>
                    </div>
                    <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; margin-top:8px;">
                        <div>
                            <label style="font-size:12px;">锁定倒计时(轮)</label>
                            <input type="number" id="editEquipLockCountdown" class="cyoa-input" value="${equip.lockCountdownTurns || 5}" min="1">
                        </div>
                        <div>
                            <label style="font-size:12px;">升级峰值(轮)</label>
                            <input type="number" id="editEquipEscPeak" class="cyoa-input" value="${equip.escalationPeakTurns || 24}" min="1">
                        </div>
                        <div>
                            <label style="font-size:12px;">槽组</label>
                            <select id="editEquipSlotGroup" class="cyoa-input">
                                <option value="">无</option>
                                ${Object.entries(CONFIG.SLOT_GROUPS || {}).map(([k, v]) => `<option value="${k}" ${equip.slotGroup === k ? 'selected' : ''}>${v.label}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                    <div style="margin-top:8px;">
                        <label style="font-size:12px;">外观名称（旁人看到的）</label>
                        <input type="text" id="editEquipAppearanceName" class="cyoa-input" value="${escapeHtml(equip.appearanceName || '')}" placeholder="留空则使用装备名称">
                    </div>
                    <div style="margin-top:4px;">
                        <label style="font-size:12px;">外观描述（旁人看到的）</label>
                        <input type="text" id="editEquipAppearanceDesc" class="cyoa-input" value="${escapeHtml(equip.appearanceDesc || '')}" placeholder="留空则使用装备描述">
                    </div>
                </div>
                <div class="cyoa-form-row" style="background:var(--bg); padding:12px; border-radius:var(--radius-sm); border:1px solid var(--border);">
                    <label style="font-weight:600; margin-bottom:8px; display:block;">${t('ui.label.attachmentSystem')}</label>
                    <small style="display:block; margin-bottom:8px; color:var(--text-light);">${t('ui.hint.attachments')}</small>
                    <div id="equipAttachmentsList">
                        ${renderAttachmentRows(equip.attachments || [])}
                    </div>
                    <button class="cyoa-btn cyoa-btn-secondary cyoa-btn-sm add-attachment" type="button" style="margin-top:8px;">${t('ui.btn.addAttach')}</button>
                </div>
                <div class="cyoa-form-row">
                    <label>${t('ui.label.description')}</label>
                    <input type="text" id="editEquipDesc" class="cyoa-input" value="${escapeHtml(equip.description || '')}">
                </div>
                <div class="cyoa-form-actions">
                    <button class="cyoa-btn cyoa-btn-secondary" onclick="CYOA.cancelEdit()">${t('ui.btn.cancel')}</button>
                    <button class="cyoa-btn cyoa-btn-primary" onclick="CYOA.saveEquipment(${index})">${t('ui.btn.saveEquip')}</button>
                </div>
            </div>
        `;
    }

    // ========== 职业表单 ==========
    function renderProfessionForm(prof, index) {
        const skills = getSkillsForSelect();
        const skillOptions = skills.map(s => 
            `<option value="${s.value}" ${prof.skills?.includes(s.value) ? 'selected' : ''}>${s.label}</option>`
        ).join('');

        const presetOptions = (CONFIG.PROFESSION_PRESETS || []).map(p =>
            `<option value="${escapeHtml(p.label.replace(/^[^\s]+\s/, ''))}">${p.label}</option>`
        ).join('');

        const attributes = CYOA.editorTempData?.attributes || [];
        const attrModRows = (prof.attrModifiers || []).map((am, i) =>
            `<div class="cyoa-attr-mod-row" style="display:flex; gap:6px; align-items:center; margin-bottom:4px;">
                <select class="cyoa-select attr-mod-name" style="width:120px; height:30px; font-size:12px;">
                    <option value="">${t('ui.opt.selectAttr')}</option>
                    ${attributes.map(a => `<option value="${escapeHtml(a.name)}" ${a.name === am.attr ? 'selected' : ''}>${escapeHtml(a.name)}</option>`).join('')}
                </select>
                <input type="number" class="cyoa-input attr-mod-value" value="${am.value || 0}" style="width:70px; height:30px; font-size:12px;" step="1">
                <button class="cyoa-btn-icon danger remove-attr-mod" type="button" style="font-size:14px;">🗑️</button>
            </div>`
        ).join('');

        return `
            <div class="cyoa-edit-form">
                <h4>${prof.id ? t('ui.editor.editItem', {type: t('ui.type.professions')}) : t('ui.editor.newItem', {type: t('ui.type.professions')})}</h4>
                <div class="cyoa-form-row">
                    <label>${t('ui.label.profName')}</label>
                    <div style="display:flex; gap:8px;">
                        <input type="text" id="editProfName" class="cyoa-input" value="${escapeHtml(prof.name || '')}" style="flex:1;">
                        <select id="editProfPreset" class="cyoa-select" style="width:140px;" title="${t('ui.hint.profPreset')}">
                            <option value="">${t('ui.opt.presetSelect')}</option>
                            ${presetOptions}
                        </select>
                    </div>
                    <small>${t('ui.hint.profPreset')}</small>
                </div>
                <div class="cyoa-form-row">
                    <label>${t('ui.label.icon')}</label>
                    <input type="text" id="editProfIcon" class="cyoa-input" value="${escapeHtml(prof.icon || '🎭')}" style="width:80px;">
                </div>
                <div class="cyoa-form-row">
                    <label>${t('ui.label.traits')}</label>
                    <textarea id="editProfTraits" class="cyoa-textarea" rows="2" placeholder="${t('ui.ph.profTraits')}">${escapeHtml(prof.traits || '')}</textarea>
                    <small>${t('ui.hint.profTraitExample')}</small>
                </div>
                <div class="cyoa-form-row">
                    <label>${t('ui.label.relatedSkills')}</label>
                    <select id="editProfSkills" class="cyoa-select" multiple size="4">
                        ${skillOptions}
                    </select>
                    <small>${t('ui.hint.ctrlSelectProfSkills')}</small>
                </div>
                <div class="cyoa-form-row">
                    <label>${t('ui.label.attrModifiers')}</label>
                    <div id="profAttrModList">
                        ${attrModRows || '<div class="cyoa-empty-row" style="font-size:12px; color:var(--text-light);">' + t('ui.empty.noModifiers') + '</div>'}
                    </div>
                    <button class="cyoa-btn cyoa-btn-secondary cyoa-btn-sm add-attr-mod" type="button" style="margin-top:6px;">${t('ui.btn.addModifier')}</button>
                    <small>${t('ui.hint.attrModDesc')}</small>
                </div>
                <div class="cyoa-form-row">
                    <label>${t('ui.label.attrEffectText')}</label>
                    <input type="text" id="editProfStats" class="cyoa-input" value="${escapeHtml(prof.statModifiers || '')}" placeholder="${t('ui.ph.statEffect')}">
                    <small>${t('ui.hint.statModText')}</small>
                </div>
                <div class="cyoa-form-row">
                    <label>${t('ui.label.description')}</label>
                    <textarea id="editProfDesc" class="cyoa-textarea" rows="2">${escapeHtml(prof.description || '')}</textarea>
                </div>
                <div class="cyoa-form-actions">
                    <button class="cyoa-btn cyoa-btn-secondary" onclick="CYOA.cancelEdit()">${t('ui.btn.cancel')}</button>
                    <button class="cyoa-btn cyoa-btn-primary" onclick="CYOA.saveProfession(${index})">${t('ui.btn.saveProf')}</button>
                </div>
            </div>
        `;
    }

    function renderSkillForm(skill, index) {
        const typeOptions = CONFIG.SKILL_TYPES.map(t => 
            `<option value="${t.value}" ${t.value === skill.skillType ? 'selected' : ''}>${t.label}</option>`
        ).join('');
        
        const unlockOptions = CONFIG.SKILL_UNLOCK_TYPES.map(t => 
            `<option value="${t.value}" ${t.value === skill.unlockType ? 'selected' : ''}>${t.label}</option>`
        ).join('');
        
        const minLv = CONFIG.SKILL_MIN_LEVEL || 1;
        const maxLv = CONFIG.SKILL_MAX_LEVEL || 9;
        const curLevel = skill.level || minLv;
        const levelLabels = CONFIG.SKILL_LEVEL_LABELS || {};
        const levelOptions = [];
        for (let lv = minLv; lv <= maxLv; lv++) {
            const tag = levelLabels[lv] ? ` (${levelLabels[lv]})` : '';
            levelOptions.push(`<option value="${lv}" ${lv === curLevel ? 'selected' : ''}>LV${lv}${tag}</option>`);
        }
        const perLevel = CONFIG.SKILL_PROFICIENCY_PER_LEVEL || 100;
        const curProf = typeof skill.proficiency === 'number' ? skill.proficiency : 0;
        
        // 属性要求输入
        const attributes = CYOA.editorTempData?.attributes || [];
        const attrInputs = attributes.map(attr => 
            `<div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
                <span style="width:80px;">${escapeHtml(attr.name)}</span>
                <input type="number" class="cyoa-input skill-attr-require" data-attr="${attr.name}" value="${skill.requiredAttributes?.[attr.name] || 0}" min="0" style="width:80px;">
            </div>`
        ).join('');
        
        // 消耗物品
        const items = getItemsForSelect();
        const consumeOptions = items.map(i => 
            `<option value="${i.value}">${i.label}</option>`
        ).join('');
        
        return `
            <div class="cyoa-edit-form">
                <h4>${skill.id ? t('ui.editor.editItem', {type: t('ui.type.skills')}) : t('ui.editor.newItem', {type: t('ui.type.skills')})}</h4>
                <div class="cyoa-form-row">
                    <label>${t('ui.label.skillName')}</label>
                    <input type="text" id="editSkillName" class="cyoa-input" value="${escapeHtml(skill.name || '')}">
                </div>
                <div class="cyoa-form-row cyoa-grid-2">
                    <div>
                        <label>${t('ui.label.skillType')}</label>
                        <select id="editSkillType" class="cyoa-select">${typeOptions}</select>
                    </div>
                    <div>
                        <label>${t('ui.label.unlockMethod')}</label>
                        <select id="editSkillUnlock" class="cyoa-select">${unlockOptions}</select>
                    </div>
                </div>
                <div class="cyoa-form-row cyoa-grid-2">
                    <div>
                        <label>${t('ui.label.skillLevel')}（LV${minLv}~LV${maxLv}）</label>
                        <select id="editSkillLevel" class="cyoa-select">${levelOptions.join('')}</select>
                    </div>
                    <div>
                        <label>${t('ui.label.proficiency')}（0~${perLevel}）</label>
                        <input type="number" id="editSkillProficiency" class="cyoa-input" value="${curProf}" min="0" max="${perLevel}">
                    </div>
                </div>
                <div class="cyoa-form-row">
                    <label>${t('ui.label.skillEffect')}</label>
                    <textarea id="editSkillEffect" class="cyoa-textarea" rows="2">${escapeHtml(skill.effect || '')}</textarea>
                </div>
                <div class="cyoa-form-row">
                    <label>${t('ui.label.attrRequire')}</label>
                    <div class="cyoa-attr-requires" style="background:var(--bg); padding:10px; border-radius:var(--radius-sm);">
                        ${attrInputs || '<div class="cyoa-empty-row">' + t('ui.empty.noAttrsForReq') + '</div>'}
                    </div>
                </div>
                <div class="cyoa-form-row">
                    <label>${t('ui.label.consumeItem')}</label>
                    <div id="skillConsumeItems">
                        ${renderSkillConsumeItems(skill.consumeItems || [])}
                    </div>
                    <button class="cyoa-btn cyoa-btn-secondary cyoa-btn-sm add-skill-consume" type="button">${t('ui.btn.addConsume')}</button>
                </div>
                <div class="cyoa-form-row">
                    <label>${t('ui.label.skillDesc')}</label>
                    <textarea id="editSkillDesc" class="cyoa-textarea" rows="2">${escapeHtml(skill.description || '')}</textarea>
                </div>
                <div class="cyoa-form-actions">
                    <button class="cyoa-btn cyoa-btn-secondary" onclick="CYOA.cancelEdit()">${t('ui.btn.cancel')}</button>
                    <button class="cyoa-btn cyoa-btn-primary" onclick="CYOA.saveSkill(${index})">${t('ui.btn.saveSkill')}</button>
                </div>
            </div>
        `;
    }

    function renderSkillConsumeItems(consumeItems) {
        if (!consumeItems || consumeItems.length === 0) {
            return '<div class="cyoa-empty-row">' + t('ui.empty.noConsume') + '</div>';
        }
        
        const items = getItemsForSelect();
        let html = '';
        consumeItems.forEach((consume, i) => {
            html += `
                <div class="cyoa-consume-row" data-index="${i}">
                    <select class="cyoa-select consume-item-select" style="width:150px;">
                        <option value="">${t('ui.opt.selectItem')}</option>
                        ${items.map(item => `<option value="${item.value}" ${item.value === consume.itemId ? 'selected' : ''}>${item.label}</option>`).join('')}
                    </select>
                    <input type="number" class="cyoa-input consume-item-amount" value="${consume.amount || 1}" min="1" style="width:80px;" placeholder="${t('ui.ph.quantity')}">
                    <input type="text" class="cyoa-input consume-item-desc" value="${consume.description || ''}" style="flex:1;" placeholder="${t('ui.ph.desc')}">
                    <button class="cyoa-btn-icon danger remove-consume-item">🗑️</button>
                </div>
            `;
        });
        return html;
    }

    function renderQuestForm(quest, index) {
        const typeOptions = CONFIG.QUEST_TYPES.map(t => 
            `<option value="${t.value}" ${t.value === quest.questType ? 'selected' : ''}>${t.label}</option>`
        ).join('');
        
        const statusOptions = CONFIG.QUEST_STATUS.map(s => 
            `<option value="${s.value}" ${s.value === quest.status ? 'selected' : ''}>${s.label}</option>`
        ).join('');
        
        // 奖励物品
        const items = getItemsForSelect();
        const itemOptions = items.map(i => i.label).join('\n');
        
        // 目标列表
        const objectivesHtml = (quest.objectives || []).map((obj, i) => `
            <div class="cyoa-quest-objective" data-index="${i}">
                <input type="text" class="cyoa-input" value="${escapeHtml(obj)}" placeholder="${t('ui.ph.objectiveDesc')}" style="flex:1;">
                <button class="cyoa-btn-icon danger remove-objective">🗑️</button>
            </div>
        `).join('');
        
        // 奖励列表
        const rewardsHtml = (quest.rewards || []).map((reward, i) => `
            <div class="cyoa-quest-reward" data-index="${i}">
                <input type="text" class="cyoa-input" value="${escapeHtml(reward)}" placeholder="${t('ui.ph.rewardContent')}" style="flex:1;">
                <button class="cyoa-btn-icon danger remove-reward">🗑️</button>
            </div>
        `).join('');
        
        return `
            <div class="cyoa-edit-form">
                <h4>${quest.id ? t('ui.editor.editItem', {type: t('ui.type.quests')}) : t('ui.editor.newItem', {type: t('ui.type.quests')})}</h4>
                <div class="cyoa-form-row">
                    <label>${t('ui.label.questName')}</label>
                    <input type="text" id="editQuestName" class="cyoa-input" value="${escapeHtml(quest.name || '')}">
                </div>
                <div class="cyoa-form-row cyoa-grid-2">
                    <div>
                        <label>${t('ui.label.questType')}</label>
                        <select id="editQuestType" class="cyoa-select">${typeOptions}</select>
                    </div>
                    <div>
                        <label>${t('ui.label.questStatus')}</label>
                        <select id="editQuestStatus" class="cyoa-select">${statusOptions}</select>
                    </div>
                </div>
                <div class="cyoa-form-row">
                    <label>${t('ui.label.questDesc')}</label>
                    <textarea id="editQuestDesc" class="cyoa-textarea" rows="2">${escapeHtml(quest.description || '')}</textarea>
                </div>
                <div class="cyoa-form-row">
                    <label>${t('ui.label.questObjective')}</label>
                    <div id="questObjectivesList">
                        ${objectivesHtml || '<div class="cyoa-empty-row">' + t('ui.empty.noObjectives') + '</div>'}
                    </div>
                    <button class="cyoa-btn cyoa-btn-secondary cyoa-btn-sm add-quest-objective" type="button">${t('ui.btn.addObjective')}</button>
                </div>
                <div class="cyoa-form-row">
                    <label>${t('ui.label.questReward')}</label>
                    <div id="questRewardsList">
                        ${rewardsHtml || '<div class="cyoa-empty-row">' + t('ui.empty.noRewards') + '</div>'}
                    </div>
                    <button class="cyoa-btn cyoa-btn-secondary cyoa-btn-sm add-quest-reward" type="button">${t('ui.btn.addReward')}</button>
                </div>
                <div class="cyoa-form-row">
                    <label>${t('ui.label.unlockCond')}</label>
                    <textarea id="editQuestUnlock" class="cyoa-textarea" rows="2">${escapeHtml(quest.unlockCondition || '')}</textarea>
                </div>
                <div class="cyoa-form-actions">
                    <button class="cyoa-btn cyoa-btn-secondary" onclick="CYOA.cancelEdit()">${t('ui.btn.cancel')}</button>
                    <button class="cyoa-btn cyoa-btn-primary" onclick="CYOA.saveQuest(${index})">${t('ui.btn.saveQuest')}</button>
                </div>
            </div>
        `;
    }

    function renderCharacterForm(character, index) {
        const models = getChatModels();
        const modelOptions = models.map(m => 
            `<option value="${m.value}" ${m.value === character.model ? 'selected' : ''}>${m.label}</option>`
        ).join('');
        
        const personalityStr = character.personality ? character.personality.join(', ') : '';
        const hobbiesStr = character.hobbies ? character.hobbies.join(', ') : '';
        
        // 技能选项
        const skills = getSkillsForSelect();
        const skillOptions = skills.map(s => 
            `<option value="${s.value}" ${character.skills?.includes(s.value) ? 'selected' : ''}>${s.label}</option>`
        ).join('');
        
        return `
            <div class="cyoa-edit-form">
                <h4>${character.id ? t('ui.editor.editItem', {type: t('ui.type.characters')}) : t('ui.editor.newItem', {type: t('ui.type.characters')})}</h4>
                <div class="cyoa-form-row">
                    <label>${t('ui.label.charName')}</label>
                    <input type="text" id="editCharName" class="cyoa-input" value="${escapeHtml(character.name || '')}">
                </div>
                <div class="cyoa-form-row cyoa-grid-2">
                    <div>
                        <label>${t('ui.label.aiModel')}</label>
                        <select id="editCharModel" class="cyoa-select"><option value="">${t('ui.label.selectModel')}</option>${modelOptions}</select>
                    </div>
                    <div>
                        <label>${t('ui.label.gender')}</label>
                        <select id="editCharGender" class="cyoa-select">
                            <option value="unknown" ${character.gender === 'unknown' ? 'selected' : ''}>${t('ui.opt.genderUnknown')}</option>
                            <option value="male" ${character.gender === 'male' ? 'selected' : ''}>${t('ui.opt.genderMale')}</option>
                            <option value="female" ${character.gender === 'female' ? 'selected' : ''}>${t('ui.opt.genderFemale')}</option>
                            <option value="other" ${character.gender === 'other' ? 'selected' : ''}>${t('ui.opt.genderOther')}</option>
                        </select>
                    </div>
                </div>
                <div class="cyoa-form-row">
                    <label>${t('ui.label.charType')}</label>
                    <select id="editCharType" class="cyoa-select">
                        <option value="playable" ${character.roleType === 'playable' ? 'selected' : ''}>${t('ui.opt.rolePlayable')}</option>
                        <option value="npc" ${character.roleType === 'npc' ? 'selected' : ''}>${t('ui.opt.roleNPC')}</option>
                        <option value="narrator" ${character.roleType === 'narrator' ? 'selected' : ''}>${t('ui.opt.roleNarrator')}</option>
                    </select>
                </div>
                <div class="cyoa-form-row">
                    <label>${t('ui.label.profMulti')}</label>
                    <div style="display:flex; gap:8px; flex-wrap:wrap;">
                        <select id="editCharProfessions" class="cyoa-select" multiple size="3" style="flex:1; min-width:180px;">
                            ${(CYOA.editorTempData?.professions || []).map(p => {
                                const sel = character.professions?.includes(p.id) ? 'selected' : '';
                                return `<option value="${escapeHtml(p.id)}" ${sel}>${escapeHtml(p.icon || '🎭')} ${escapeHtml(p.name)}</option>`;
                            }).join('')}
                        </select>
                        <div style="flex:1; min-width:180px;">
                            <input type="text" id="editCharCustomProf" class="cyoa-input" value="${escapeHtml((character.customProfessions || []).join(', '))}" placeholder="${t('ui.ph.customProf')}" style="height:30px; font-size:12px;">
                            <small>${t('ui.hint.profFromBoth')}</small>
                        </div>
                    </div>
                </div>
                <div class="cyoa-form-row">
                    <label>${t('ui.label.ownedSkills')}</label>
                    <select id="editCharSkills" class="cyoa-select" multiple size="4">
                        ${skillOptions}
                    </select>
                    <small>${t('ui.hint.ctrlSelect')}</small>
                </div>
                <div class="cyoa-form-row">
                    <label>${t('ui.label.personality')}</label>
                    <input type="text" id="editCharPersonality" class="cyoa-input" value="${escapeHtml(personalityStr)}">
                </div>
                <div class="cyoa-form-row">
                    <label>${t('ui.label.hobbies')}</label>
                    <input type="text" id="editCharHobbies" class="cyoa-input" value="${escapeHtml(hobbiesStr)}">
                </div>
                <div class="cyoa-form-row">
                    <label>${t('ui.label.background')}</label>
                    <textarea id="editCharBackground" class="cyoa-textarea" rows="2">${escapeHtml(character.background || '')}</textarea>
                </div>
                <div class="cyoa-form-row">
                    <label>${t('ui.label.charGoal')}</label>
                    <textarea id="editCharGoal" class="cyoa-textarea" rows="2">${escapeHtml(character.goal || '')}</textarea>
                </div>
                <div class="cyoa-form-row">
                    <label>${t('ui.label.charSetting')}</label>
                    <textarea id="editCharPrompt" class="cyoa-textarea" rows="3">${escapeHtml(character.prompt || '')}</textarea>
                </div>
                <div class="cyoa-form-row" style="background:var(--bg); padding:12px; border-radius:var(--radius-sm); border:1px solid var(--border);">
                    <label style="font-weight:600; margin-bottom:8px; display:block;">${t('ui.label.disciplineRules')}</label>
                    <small style="display:block; margin-bottom:8px; color:var(--text-light);">${t('ui.hint.disciplineCheck')}</small>
                    <div id="disciplineRulesCheckboxes" style="display:grid; grid-template-columns:1fr 1fr; gap:4px; margin-bottom:8px;">
                        ${(CONFIG.DISCIPLINE_RULES || []).map(r => {
                            const checked = (character.disciplineRules || []).includes(r.value) ? 'checked' : '';
                            const sevDef = CONFIG.DISCIPLINE_SEVERITY?.[r.severity] || {};
                            return `<label style="font-size:11px; display:flex; align-items:center; gap:4px;" title="${escapeHtml(r.description)}"><input type="checkbox" class="disc-rule-cb" value="${r.value}" ${checked}><span style="color:${sevDef.color || '#666'};">${escapeHtml(r.label)}</span></label>`;
                        }).join('')}
                    </div>
                    <label style="font-size:12px; margin-bottom:4px; display:block;">${t('ui.label.customRules')}</label>
                    <textarea id="editCharCustomRules" class="cyoa-textarea" rows="2" placeholder="${t('ui.ph.ruleExample')}">${escapeHtml((character.customRules || []).join('\n'))}</textarea>
                    <div style="margin-top:8px;">
                        <label style="font-size:12px; margin-bottom:4px; display:block;">${t('ui.label.defaultPunish')}</label>
                        <select id="editCharPunishment" class="cyoa-select" style="width:200px;">
                            ${(CONFIG.PUNISHMENT_TYPES || []).map(p => `<option value="${p.value}" ${(character.defaultPunishment || '') === p.value ? 'selected' : ''}>${p.label}</option>`).join('')}
                        </select>
                    </div>
                    <div style="margin-top:6px;">
                        <label style="font-size:12px; margin-bottom:4px; display:block;">${t('ui.label.defaultReward')}</label>
                        <select id="editCharReward" class="cyoa-select" style="width:200px;">
                            ${(CONFIG.REWARD_TYPES || []).map(r => `<option value="${r.value}" ${(character.defaultReward || '') === r.value ? 'selected' : ''}>${r.label}</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div class="cyoa-form-row" style="background:var(--bg); padding:12px; border-radius:var(--radius-sm); border:1px solid var(--border);">
                    <label style="font-weight:600; margin-bottom:8px; display:block;">${t('ui.label.trainingCourses')}</label>
                    <small style="display:block; margin-bottom:8px; color:var(--text-light);">${t('ui.hint.trainingCheck')}</small>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:4px;">
                        ${(CONFIG.TRAINING_TYPES || []).map(t => {
                            const checked = (character.trainingCurriculum || []).includes(t.value) ? 'checked' : '';
                            return `<label style="font-size:11px; display:flex; align-items:center; gap:4px;" title="${escapeHtml(t.desc)}"><input type="checkbox" class="training-type-cb" value="${t.value}" ${checked}><span>${escapeHtml(t.label)}</span></label>`;
                        }).join('')}
                    </div>
                </div>
                <div class="cyoa-form-actions">
                    <button class="cyoa-btn cyoa-btn-secondary" onclick="CYOA.cancelEdit()">${t('ui.btn.cancel')}</button>
                    <button class="cyoa-btn cyoa-btn-primary" onclick="CYOA.saveCharacter(${index})">${t('ui.btn.saveChar')}</button>
                </div>
            </div>
        `;
    }

    function buildInteractableRowHTML(item) {
        const anchorHeightOpts = (CONFIG.ANCHOR_HEIGHTS || []).map(h =>
            `<option value="${h.value}" ${h.value === (item.anchorHeight || '') ? 'selected' : ''}>${h.label}</option>`
        ).join('');
        const showAnchor = item.function === 'tether_anchor' ? '' : 'display:none;';
        return `
            <div class="cyoa-interactable-row" style="display:flex; flex-wrap:wrap; gap:6px; align-items:center; margin-bottom:4px;">
                <input type="text" class="cyoa-input interactable-name" value="${escapeHtml(item.name || '')}" placeholder="${t('ui.ph.name')}" style="width:100px;">
                <select class="cyoa-select interactable-func" style="width:120px; height:30px; font-size:12px;">
                    <option value="" ${!item.function || item.function === '' ? 'selected' : ''}>${t('ui.opt.customFunc')}</option>
                    <option value="tether_anchor" ${item.function === 'tether_anchor' ? 'selected' : ''}>${t('ui.opt.tetherAnchor')}</option>
                </select>
                <input type="text" class="cyoa-input interactable-func-text" value="${escapeHtml(item.function && item.function !== 'tether_anchor' ? item.function : '')}" placeholder="${t('ui.ph.funcDesc')}" style="width:100px; ${item.function === 'tether_anchor' ? 'display:none;' : ''}">
                <div class="interactable-anchor-fields" style="${showAnchor}">
                    <select class="cyoa-select interactable-anchor-height" style="width:110px; height:30px; font-size:12px;">
                        ${anchorHeightOpts}
                    </select>
                </div>
                <input type="text" class="cyoa-input interactable-effect" value="${escapeHtml(item.effect || '')}" placeholder="${t('ui.ph.effect')}" style="width:120px;">
                <input type="text" class="cyoa-input interactable-attr" value="${escapeHtml(item.attributeEffect || '')}" placeholder="${t('ui.label.statEffect')}" style="width:100px;">
                <button class="cyoa-btn-icon danger remove-interactable">🗑️</button>
            </div>`;
    }

    function bindInteractableRowEvents(row) {
        const funcSelect = row.querySelector('.interactable-func');
        const funcText = row.querySelector('.interactable-func-text');
        const anchorFields = row.querySelector('.interactable-anchor-fields');
        if (funcSelect) {
            funcSelect.addEventListener('change', () => {
                const isTether = funcSelect.value === 'tether_anchor';
                if (funcText) funcText.style.display = isTether ? 'none' : '';
                if (anchorFields) anchorFields.style.display = isTether ? '' : 'none';
            });
        }
        const removeBtn = row.querySelector('.remove-interactable');
        if (removeBtn) removeBtn.addEventListener('click', () => row.remove());
    }

    function renderSceneForm(scene, index) {
        const interactablesHtml = (scene.interactables || []).map((item, i) =>
            buildInteractableRowHTML(item)
        ).join('');
        
        // 任务选项
        const quests = CYOA.editorTempData?.quests || [];
        const questOptions = quests.map(q => 
            `<option value="${q.id}" ${scene.quests?.includes(q.id) ? 'selected' : ''}>${escapeHtml(q.name)}</option>`
        ).join('');
        
        return `
            <div class="cyoa-edit-form">
                <h4>${scene.id ? t('ui.editor.editItem', {type: t('ui.type.scenes')}) : t('ui.editor.newItem', {type: t('ui.type.scenes')})}</h4>
                <div class="cyoa-form-row">
                    <label>${t('ui.label.sceneName')}</label>
                    <input type="text" id="editSceneName" class="cyoa-input" value="${escapeHtml(scene.name || '')}">
                </div>
                <div class="cyoa-form-row">
                    <label>${t('ui.label.location')}</label>
                    <input type="text" id="editSceneLocation" class="cyoa-input" value="${escapeHtml(scene.location || '')}">
                </div>
                <div class="cyoa-form-row">
                    <label>${t('ui.label.layout')}</label>
                    <textarea id="editSceneDecoration" class="cyoa-textarea" rows="2">${escapeHtml(scene.decoration || '')}</textarea>
                </div>
                <div class="cyoa-form-row">
                    <label>${t('ui.label.description')}</label>
                    <textarea id="editSceneDescription" class="cyoa-textarea" rows="2">${escapeHtml(scene.description || '')}</textarea>
                </div>
                <div class="cyoa-form-row">
                    <label>${t('ui.label.relatedQuests')}</label>
                    <select id="editSceneQuests" class="cyoa-select" multiple size="3">
                        ${questOptions}
                    </select>
                    <small>${t('ui.hint.ctrlSelect')}</small>
                </div>
                <div class="cyoa-form-row">
                    <label>${t('ui.label.interactables')}</label>
                    <div id="interactablesList" class="cyoa-interactables-list">${interactablesHtml || '<div class="cyoa-empty-row">' + t('ui.empty.noFacilities') + '</div>'}</div>
                    <button class="cyoa-btn cyoa-btn-secondary cyoa-btn-sm add-interactable" style="margin-top:8px;">${t('ui.btn.addFacility')}</button>
                </div>
                <div class="cyoa-form-actions">
                    <button class="cyoa-btn cyoa-btn-secondary" onclick="CYOA.cancelEdit()">${t('ui.btn.cancel')}</button>
                    <button class="cyoa-btn cyoa-btn-primary" onclick="CYOA.saveScene(${index})">${t('ui.btn.saveScene')}</button>
                </div>
            </div>
        `;
    }

    function renderChapterForm(chapter, index) {
        const scenes = CYOA.editorTempData?.scenes || [];
        const sceneOptions = scenes.map(scene => 
            `<option value="${scene.id}" ${chapter.scenes?.includes(scene.id) ? 'selected' : ''}>${escapeHtml(scene.name)}</option>`
        ).join('');
        
        return `
            <div class="cyoa-edit-form">
                <h4>${chapter.id ? t('ui.editor.editItem', {type: t('ui.type.chapters')}) : t('ui.editor.newItem', {type: t('ui.type.chapters')})}</h4>
                <div class="cyoa-form-row">
                    <label>${t('ui.label.chapterTitle')}</label>
                    <input type="text" id="editChapterTitle" class="cyoa-input" value="${escapeHtml(chapter.title || '')}">
                </div>
                <div class="cyoa-form-row cyoa-grid-2">
                    <div>
                        <label>${t('ui.label.chapterOrder')}</label>
                        <input type="number" id="editChapterOrder" class="cyoa-input" value="${chapter.order || index + 1}">
                    </div>
                    <div>
                        <label>${t('ui.label.status')}</label>
                        <select id="editChapterUnlocked" class="cyoa-select">
                            <option value="true" ${chapter.unlocked !== false ? 'selected' : ''}>${t('ui.status.unlocked')}</option>
                            <option value="false" ${chapter.unlocked === false ? 'selected' : ''}>${t('ui.status.locked')}</option>
                        </select>
                    </div>
                </div>
                <div class="cyoa-form-row">
                    <label>${t('ui.label.chapterDesc')}</label>
                    <textarea id="editChapterDesc" class="cyoa-textarea" rows="2">${escapeHtml(chapter.description || '')}</textarea>
                </div>
                <div class="cyoa-form-row">
                    <label>${t('ui.label.includeScenes')}</label>
                    <select id="editChapterScenes" class="cyoa-select" multiple size="5">
                        ${sceneOptions}
                    </select>
                    <small>${t('ui.hint.ctrlSelectScenes')}</small>
                </div>
                <div class="cyoa-form-row">
                    <label>${t('ui.label.unlockCond')}</label>
                    <textarea id="editChapterCondition" class="cyoa-textarea" rows="2">${escapeHtml(chapter.unlockCondition || '')}</textarea>
                </div>
                <div class="cyoa-form-row cyoa-checkbox-row" style="background:var(--bg); padding:10px 12px; border-radius:var(--radius-sm); border:1px solid var(--border);">
                    <label><input type="checkbox" id="editChapterMonitored" ${chapter.monitored ? 'checked' : ''}> ${t('ui.label.monitorZone')} <small style="color:var(--text-light);">${t('ui.hint.monitorZone')}</small></label>
                </div>
                <div class="cyoa-form-row" style="background:var(--bg); padding:12px; border-radius:var(--radius-sm); border:1px solid var(--border);">
                    <label style="font-weight:600; margin-bottom:8px; display:block;">${t('ui.label.chapterConditions')}</label>
                    <small style="display:block; margin-bottom:8px; color:var(--text-light);">${t('ui.hint.conditionsLogic')}</small>
                    <div id="chapterConditionsList">
                        ${renderChapterConditions(chapter.transitionConditions || [])}
                    </div>
                    <button type="button" class="cyoa-btn cyoa-btn-secondary cyoa-btn-sm" style="margin-top:8px;" onclick="CYOA._addChapterCondition()">${t('ui.btn.addCondition')}</button>
                </div>
                <div class="cyoa-form-row" style="background:var(--bg); padding:12px; border-radius:var(--radius-sm); border:1px solid var(--border);">
                    <label style="font-weight:600; margin-bottom:8px; display:block;">${t('ui.label.initPreset')}</label>
                    <small style="display:block; margin-bottom:8px; color:var(--text-light);">${t('ui.hint.initPreset')}</small>
                    <div class="cyoa-form-row cyoa-grid-2" style="margin-bottom:8px;">
                        <div>
                            <label>${t('ui.label.initPosture')}</label>
                            <select id="editChapterPosture" class="cyoa-select">
                                ${(CONFIG.POSTURES || []).map(p => `<option value="${p.value}" ${(chapter.initialPosture || 'standing') === p.value ? 'selected' : ''}>${p.label}</option>`).join('')}
                            </select>
                        </div>
                        <div>
                            <label><input type="checkbox" id="editChapterTetherEnabled" ${chapter.initialTether?.active ? 'checked' : ''}> ${t('ui.label.enableTether')}</label>
                        </div>
                    </div>
                    <div id="chapterTetherFields" style="${chapter.initialTether?.active ? '' : 'display:none;'}">
                        <div class="cyoa-form-row cyoa-grid-2" style="margin-bottom:6px;">
                            <div>
                                <label>${t('ui.label.tetherType')}</label>
                                <select id="editChapterTetherType" class="cyoa-select">
                                    ${(CONFIG.TETHER_TYPES || []).map(t => `<option value="${t.value}" ${(chapter.initialTether?.type || '') === t.value ? 'selected' : ''}>${t.label}</option>`).join('')}
                                </select>
                            </div>
                            <div>
                                <label>${t('ui.label.chainLength')}</label>
                                <select id="editChapterTetherChain" class="cyoa-select">
                                    ${(CONFIG.TETHER_CHAIN_LENGTHS || []).map(c => `<option value="${c.value}" ${(chapter.initialTether?.chainLength || 'leash') === c.value ? 'selected' : ''}>${c.label}</option>`).join('')}
                                </select>
                            </div>
                        </div>
                        <div class="cyoa-form-row cyoa-grid-2" style="margin-bottom:6px;">
                            <div>
                                <label>${t('ui.label.targetType')}</label>
                                <select id="editChapterTetherTargetType" class="cyoa-select">
                                    <option value="npc" ${(chapter.initialTether?.targetType || '') === 'npc' ? 'selected' : ''}>${t('ui.opt.targetNPC')}</option>
                                    <option value="scene_anchor" ${(chapter.initialTether?.targetType || '') === 'scene_anchor' ? 'selected' : ''}>${t('ui.opt.targetAnchor')}</option>
                                    <option value="overhead" ${(chapter.initialTether?.targetType || '') === 'overhead' ? 'selected' : ''}>${t('ui.opt.targetCeiling')}</option>
                                </select>
                            </div>
                            <div>
                                <label>${t('ui.label.targetId')}</label>
                                <input type="text" id="editChapterTetherTarget" class="cyoa-input" value="${escapeHtml(chapter.initialTether?.targetId || '')}" placeholder="NPC ID / Anchor ID">
                            </div>
                        </div>
                        <div class="cyoa-form-row">
                            <label>${t('ui.label.targetDisplay')}</label>
                            <input type="text" id="editChapterTetherTargetName" class="cyoa-input" value="${escapeHtml(chapter.initialTether?.targetName || '')}" placeholder="e.g. Manager, Wall D-Ring">
                        </div>
                    </div>
                </div>
                <div class="cyoa-form-actions">
                    <button class="cyoa-btn cyoa-btn-secondary" onclick="CYOA.cancelEdit()">${t('ui.btn.cancel')}</button>
                    <button class="cyoa-btn cyoa-btn-primary" onclick="CYOA.saveChapter(${index})">${t('ui.btn.saveChapter')}</button>
                </div>
            </div>
        `;
    }

    // ========== 章节推进条件渲染 ==========
    function renderChapterConditions(conditions) {
        if (!conditions || conditions.length === 0) {
            return '<div class="cyoa-empty-row" style="font-size:12px; color:var(--text-light);">' + t('ui.empty.noConditions') + '</div>';
        }
        return conditions.map((cond, i) => buildChapterConditionRow(cond, i)).join('');
    }

    function buildChapterConditionRow(cond, idx) {
        const typeOptions = (CONFIG.CHAPTER_CONDITION_TYPES || []).map(t =>
            `<option value="${t.value}" ${t.value === cond.type ? 'selected' : ''}>${t.label}</option>`
        ).join('');

        const quests = CYOA.editorTempData?.quests || [];
        const questOptions = quests.map(q =>
            `<option value="${q.id}" ${q.id === cond.questId ? 'selected' : ''}>${escapeHtml(q.name || q.id)}</option>`
        ).join('');

        const items = CYOA.editorTempData?.items || [];
        const itemOptions = items.map(it =>
            `<option value="${it.id}" ${it.id === cond.itemId ? 'selected' : ''}>${escapeHtml(it.name || it.id)}</option>`
        ).join('');

        const attrs = CYOA.editorTempData?.attributes || [];
        const attrOptions = attrs.map(a =>
            `<option value="${a.name || a.id}" ${(a.name || a.id) === cond.attribute ? 'selected' : ''}>${escapeHtml(a.name || a.id)}</option>`
        ).join('');

        const opOptions = (CONFIG.ATTRIBUTE_OPERATORS || []).map(op =>
            `<option value="${op.value}" ${op.value === cond.operator ? 'selected' : ''}>${op.label}</option>`
        ).join('');

        const showQuest = cond.type === 'quest_complete' ? '' : 'display:none;';
        const showItem = cond.type === 'has_item' ? '' : 'display:none;';
        const showAttr = cond.type === 'attribute_check' ? '' : 'display:none;';

        return `
            <div class="cyoa-condition-row" data-idx="${idx}" style="display:flex; gap:6px; align-items:center; margin-bottom:6px; flex-wrap:wrap;">
                <select class="cyoa-select cond-type" style="width:130px; height:32px; font-size:12px;" onchange="CYOA._onCondTypeChange(this, ${idx})">
                    ${typeOptions}
                </select>
                <div class="cond-quest" style="${showQuest}">
                    <select class="cyoa-select cond-quest-id" style="width:160px; height:32px; font-size:12px;">
                        <option value="">${t('ui.opt.selectQuest')}</option>
                        ${questOptions}
                    </select>
                </div>
                <div class="cond-item" style="${showItem} display:flex; gap:4px; align-items:center;">
                    <select class="cyoa-select cond-item-id" style="width:130px; height:32px; font-size:12px;">
                        <option value="">${t('ui.opt.selectItemDot')}</option>
                        ${itemOptions}
                    </select>
                    <span style="font-size:11px;">×</span>
                    <input type="number" class="cyoa-input cond-item-qty" style="width:50px; height:32px; font-size:12px;" value="${cond.quantity || 1}" min="1">
                </div>
                <div class="cond-attr" style="${showAttr} display:flex; gap:4px; align-items:center;">
                    <select class="cyoa-select cond-attr-name" style="width:100px; height:32px; font-size:12px;">
                        <option value="">${t('ui.opt.selectAttrDot')}</option>
                        ${attrOptions}
                    </select>
                    <select class="cyoa-select cond-attr-op" style="width:80px; height:32px; font-size:12px;">
                        ${opOptions}
                    </select>
                    <input type="number" class="cyoa-input cond-attr-val" style="width:60px; height:32px; font-size:12px;" value="${cond.value ?? 0}">
                </div>
                <button type="button" class="cyoa-btn cyoa-btn-secondary cyoa-btn-sm" style="height:28px; padding:0 8px; font-size:12px; color:#ef4444;" onclick="CYOA._removeChapterCondition(${idx})">✕</button>
            </div>
        `;
    }

    CYOA._onCondTypeChange = function(selectEl, idx) {
        const row = selectEl.closest('.cyoa-condition-row');
        if (!row) return;
        const type = selectEl.value;
        const questDiv = row.querySelector('.cond-quest');
        const itemDiv = row.querySelector('.cond-item');
        const attrDiv = row.querySelector('.cond-attr');
        if (questDiv) questDiv.style.display = type === 'quest_complete' ? '' : 'none';
        if (itemDiv) itemDiv.style.display = type === 'has_item' ? 'flex' : 'none';
        if (attrDiv) attrDiv.style.display = type === 'attribute_check' ? 'flex' : 'none';
    };

    CYOA._addChapterCondition = function() {
        const container = document.getElementById('chapterConditionsList');
        if (!container) return;
        const emptyRow = container.querySelector('.cyoa-empty-row');
        if (emptyRow) emptyRow.remove();
        const idx = container.querySelectorAll('.cyoa-condition-row').length;
        const cond = { type: 'quest_complete', questId: '', itemId: '', quantity: 1, attribute: '', operator: '>=', value: 0 };
        const temp = document.createElement('div');
        temp.innerHTML = buildChapterConditionRow(cond, idx);
        container.appendChild(temp.firstElementChild);
    };

    CYOA._removeChapterCondition = function(idx) {
        const container = document.getElementById('chapterConditionsList');
        if (!container) return;
        const rows = container.querySelectorAll('.cyoa-condition-row');
        if (rows[idx]) rows[idx].remove();
        // Re-index remaining rows
        container.querySelectorAll('.cyoa-condition-row').forEach((row, i) => {
            row.dataset.idx = i;
            const removeBtn = row.querySelector('button[onclick*="_removeChapterCondition"]');
            if (removeBtn) removeBtn.setAttribute('onclick', `CYOA._removeChapterCondition(${i})`);
            const typeSelect = row.querySelector('.cond-type');
            if (typeSelect) typeSelect.setAttribute('onchange', `CYOA._onCondTypeChange(this, ${i})`);
        });
        if (container.querySelectorAll('.cyoa-condition-row').length === 0) {
            container.innerHTML = '<div class="cyoa-empty-row" style="font-size:12px; color:var(--text-light);">' + t('ui.empty.noConditions') + '</div>';
        }
    };

    // 从 DOM 读取当前编辑中的推进条件
    CYOA._collectChapterConditions = function() {
        const container = document.getElementById('chapterConditionsList');
        if (!container) return [];
        const conditions = [];
        container.querySelectorAll('.cyoa-condition-row').forEach(row => {
            const type = row.querySelector('.cond-type')?.value;
            if (!type) return;
            const cond = { type };
            switch (type) {
                case 'quest_complete':
                    cond.questId = row.querySelector('.cond-quest-id')?.value || '';
                    break;
                case 'has_item':
                    cond.itemId = row.querySelector('.cond-item-id')?.value || '';
                    cond.quantity = parseInt(row.querySelector('.cond-item-qty')?.value) || 1;
                    break;
                case 'attribute_check':
                    cond.attribute = row.querySelector('.cond-attr-name')?.value || '';
                    cond.operator = row.querySelector('.cond-attr-op')?.value || '>=';
                    cond.value = parseFloat(row.querySelector('.cond-attr-val')?.value) || 0;
                    break;
            }
            conditions.push(cond);
        });
        return conditions;
    };

    // ========== 附件行渲染 ==========
    function renderAttachmentRows(attachments) {
        if (!attachments || attachments.length === 0) {
            return '<div class="cyoa-empty-row" style="font-size:12px; color:var(--text-light);">' + t('ui.empty.noAttachments') + '</div>';
        }
        return attachments.map((att, i) => buildAttachmentRowHTML(att, i)).join('');
    }

    function buildAttachmentRowHTML(att, idx) {
        const typeOptions = (CONFIG.ATTACHMENT_TYPES || []).map(t =>
            `<option value="${t.value}" ${t.value === att.type ? 'selected' : ''}>${t.label}</option>`
        ).join('');
        const visionOptions = (CONFIG.VISION_TYPES || []).map(v =>
            `<option value="${v.value}" ${v.value === att.visionType ? 'selected' : ''}>${v.label}</option>`
        ).join('');
        const dRingOptions = (CONFIG.D_RING_POSITIONS || []).map(p =>
            `<option value="${p.value}" ${p.value === att.dRingPosition ? 'selected' : ''}>${p.label}</option>`
        ).join('');
        const stimModeOptions = (CONFIG.STIMULATOR_MODES || []).map(m =>
            `<option value="${m.value}" ${m.value === (att.stimMode || 'off') ? 'selected' : ''}>${m.label}</option>`
        ).join('');
        const stimIntensityOptions = (CONFIG.STIMULATOR_INTENSITIES || []).map(i =>
            `<option value="${i.value}" ${i.value === (att.stimIntensity || 'medium') ? 'selected' : ''}>${i.label}</option>`
        ).join('');
        const showVision = att.type === 'vision_modifier' ? '' : 'display:none;';
        const showStats = att.type === 'stat_modifier' ? '' : 'display:none;';
        const showDRing = att.type === 'd_ring' ? '' : 'display:none;';
        const showStim = (att.type === 'vibrator' || att.type === 'shock') ? '' : 'display:none;';
        const showBreath = att.type === 'breath_restrict' ? '' : 'display:none;';
        const showTemp = att.type === 'temp_device' ? '' : 'display:none;';
        const showLatex = att.type === 'latex_layer' ? '' : 'display:none;';
        const showInflate = att.type === 'inflate' ? '' : 'display:none;';

        const breathOptions = (CONFIG.BREATH_DEVICE_TYPES || []).map(b =>
            `<option value="${b.value}" ${b.value === (att.breathType || '') ? 'selected' : ''}>${b.label}</option>`
        ).join('');
        const tempToolOptions = (CONFIG.TEMP_TOOLS || []).map(t =>
            `<option value="${t.value}" ${t.value === (att.tempTool || '') ? 'selected' : ''}>${t.label}</option>`
        ).join('');
        const latexThickOptions = (CONFIG.LATEX_THICKNESS || []).map(l =>
            `<option value="${l.value}" ${l.value === (att.latexThickness || 'medium') ? 'selected' : ''}>${l.label}</option>`
        ).join('');
        const latexColorOptions = [{ value: '', label: t('ui.opt.selectColor') }].concat(CONFIG.LATEX_COLORS || []).map(c =>
            `<option value="${c.value}" ${c.value === (att.latexColor || '') ? 'selected' : ''}>${c.label}</option>`
        ).join('');
        const latexOpeningOptions = (CONFIG.LATEX_OPENING_TYPES || []).map(o => {
            const checked = (att.latexOpenings || []).some(lo => lo.type === o.value);
            return `<label style="font-size:10px; display:inline-flex; align-items:center; gap:1px;"><input type="checkbox" class="attachment-latex-opening" value="${o.value}" ${checked ? 'checked' : ''}>${o.label.replace(/^.+\s/, '')}</label>`;
        }).join(' ');
        const inflateTypeOptions = (CONFIG.VACUUM_INFLATION_TYPES || []).map(v =>
            `<option value="${v.value}" ${v.value === (att.inflateType || '') ? 'selected' : ''}>${v.label}</option>`
        ).join('');

        return `
            <div class="cyoa-attachment-row" data-index="${idx}" style="display:flex; flex-wrap:wrap; gap:6px; align-items:center; padding:8px; margin-bottom:6px; background:var(--bg-light,#fafafa); border:1px solid var(--border); border-radius:var(--radius-sm);">
                <input type="text" class="cyoa-input attachment-name" value="${escapeHtml(att.name || '')}" placeholder="${t('ui.ph.attachName')}" style="width:120px; height:30px; font-size:12px;">
                <select class="cyoa-select attachment-type" style="width:110px; height:30px; font-size:12px;">
                    ${typeOptions}
                </select>
                <div class="attachment-vision-fields" style="${showVision}">
                    <select class="cyoa-select attachment-vision-type" style="width:120px; height:30px; font-size:12px;">
                        ${visionOptions}
                    </select>
                </div>
                <div class="attachment-stats-fields" style="${showStats}">
                    <input type="text" class="cyoa-input attachment-stats" value="${escapeHtml(att.statModifiers || '')}" placeholder="${t('ui.ph.statEffect')}" style="width:100px; height:30px; font-size:12px;">
                </div>
                <div class="attachment-dring-fields" style="${showDRing}">
                    <select class="cyoa-select attachment-dring-pos" style="width:100px; height:30px; font-size:12px;">
                        ${dRingOptions}
                    </select>
                </div>
                <div class="attachment-stim-fields" style="${showStim} display:flex; gap:4px; align-items:center;">
                    <select class="cyoa-select attachment-stim-mode" style="width:100px; height:30px; font-size:12px;" title="Default Mode">
                        ${stimModeOptions}
                    </select>
                    <select class="cyoa-select attachment-stim-intensity" style="width:80px; height:30px; font-size:12px;" title="Default Intensity">
                        ${stimIntensityOptions}
                    </select>
                </div>
                <div class="attachment-breath-fields" style="${showBreath}">
                    <select class="cyoa-select attachment-breath-type" style="width:130px; height:30px; font-size:12px;">
                        ${breathOptions}
                    </select>
                </div>
                <div class="attachment-temp-fields" style="${showTemp}">
                    <select class="cyoa-select attachment-temp-tool" style="width:120px; height:30px; font-size:12px;">
                        ${tempToolOptions}
                    </select>
                </div>
                <div class="attachment-latex-fields" style="${showLatex} display:flex; flex-wrap:wrap; gap:4px; align-items:center;">
                    <select class="cyoa-select attachment-latex-thick" style="width:110px; height:30px; font-size:12px;" title="${t('ui.sidebar.tightness')}">
                        ${latexThickOptions}
                    </select>
                    <input type="number" class="cyoa-input attachment-latex-coverage" value="${att.latexCoverage || 20}" placeholder="%" min="1" max="100" style="width:60px; height:30px; font-size:12px;" title="Coverage %">
                    <select class="cyoa-select attachment-latex-color" style="width:90px; height:30px; font-size:12px;" title="${t('ui.opt.selectColor')}">
                        ${latexColorOptions}
                    </select>
                    <label style="font-size:11px; display:flex; align-items:center; gap:2px;"><input type="checkbox" class="attachment-self-tightening" ${att.selfTightening ? 'checked' : ''}> ${t('ui.summary.selfTightening')}</label>
                    <div class="attachment-latex-openings" style="display:flex; gap:4px; align-items:center; flex-wrap:wrap;" title="Zipper/Opening">
                        ${latexOpeningOptions}
                    </div>
                </div>
                <div class="attachment-inflate-fields" style="${showInflate}">
                    <select class="cyoa-select attachment-inflate-type" style="width:130px; height:30px; font-size:12px;">
                        ${inflateTypeOptions}
                    </select>
                </div>
                <input type="text" class="cyoa-input attachment-desc" value="${escapeHtml(att.description || '')}" placeholder="${t('ui.ph.desc')}" style="flex:1; min-width:100px; height:30px; font-size:12px;">
                <button class="cyoa-btn-icon danger remove-attachment" type="button" style="font-size:14px;">🗑️</button>
            </div>
        `;
    }

    function createEmptyAttachmentRow() {
        const container = CYOA.$('equipAttachmentsList');
        if (!container) return;
        const emptyRow = container.querySelector('.cyoa-empty-row');
        if (emptyRow) emptyRow.remove();
        const idx = container.querySelectorAll('.cyoa-attachment-row').length;
        const att = { name: '', type: 'vision_modifier', visionType: 'full_blind', statModifiers: '', description: '' };
        const rowHtml = buildAttachmentRowHTML(att, idx);
        const temp = document.createElement('div');
        temp.innerHTML = rowHtml;
        const row = temp.firstElementChild;
        container.appendChild(row);
        bindAttachmentRowEvents(row);
    }

    function bindAttachmentRowEvents(row) {
        const typeSelect = row.querySelector('.attachment-type');
        const visionFields = row.querySelector('.attachment-vision-fields');
        const statsFields = row.querySelector('.attachment-stats-fields');
        const dRingFields = row.querySelector('.attachment-dring-fields');
        const stimFields = row.querySelector('.attachment-stim-fields');
        const breathFields = row.querySelector('.attachment-breath-fields');
        const tempFields = row.querySelector('.attachment-temp-fields');
        const latexFields = row.querySelector('.attachment-latex-fields');
        const inflateFields = row.querySelector('.attachment-inflate-fields');
        if (typeSelect) {
            typeSelect.addEventListener('change', () => {
                const v = typeSelect.value;
                if (visionFields) visionFields.style.display = v === 'vision_modifier' ? '' : 'none';
                if (statsFields) statsFields.style.display = v === 'stat_modifier' ? '' : 'none';
                if (dRingFields) dRingFields.style.display = v === 'd_ring' ? '' : 'none';
                if (stimFields) stimFields.style.display = (v === 'vibrator' || v === 'shock') ? '' : 'none';
                if (breathFields) breathFields.style.display = v === 'breath_restrict' ? '' : 'none';
                if (tempFields) tempFields.style.display = v === 'temp_device' ? '' : 'none';
                if (latexFields) latexFields.style.display = v === 'latex_layer' ? '' : 'none';
                if (inflateFields) inflateFields.style.display = v === 'inflate' ? '' : 'none';
            });
        }
        const removeBtn = row.querySelector('.remove-attachment');
        if (removeBtn) removeBtn.addEventListener('click', () => row.remove());
    }

    // ========== 绑定表单事件 ==========
    function bindFormEvents(type, index) {
        // 限步约束 checkbox 联动：显示/隐藏限步参数面板
        const limitedStepCb = document.querySelector('.constraint-checkbox[value="limited_step"]');
        const limitedStepParams = CYOA.$('limitedStepParams');
        if (limitedStepCb && limitedStepParams) {
            limitedStepCb.addEventListener('change', () => {
                limitedStepParams.style.display = limitedStepCb.checked ? 'block' : 'none';
            });
        }

        // mouth插槽联动：显示/隐藏口塞类型面板
        const mouthSlotCb = document.querySelector('.slot-checkbox[value="mouth"]');
        const gagTypeParams = CYOA.$('gagTypeParams');
        if (mouthSlotCb && gagTypeParams) {
            mouthSlotCb.addEventListener('change', () => {
                gagTypeParams.style.display = mouthSlotCb.checked ? 'block' : 'none';
            });
        }

        // ears插槽联动：显示/隐藏耳部装置面板
        const earsSlotCb = document.querySelector('.slot-checkbox[value="ears"]');
        const earDeviceParams = CYOA.$('earDeviceParams');
        if (earsSlotCb && earDeviceParams) {
            earsSlotCb.addEventListener('change', () => {
                earDeviceParams.style.display = earsSlotCb.checked ? 'block' : 'none';
            });
        }

        // fingers插槽联动：显示/隐藏手指约束面板
        const fingersSlotCb = document.querySelector('.slot-checkbox[value="fingers"]');
        const fingerRestraintParams = CYOA.$('fingerRestraintParams');
        if (fingersSlotCb && fingerRestraintParams) {
            fingersSlotCb.addEventListener('change', () => {
                fingerRestraintParams.style.display = fingersSlotCb.checked ? 'block' : 'none';
            });
        }

        // 不可破坏复选框联动
        const indestructibleCb = CYOA.$('editEquipIndestructible');
        const duraRow = CYOA.$('equipDurabilityRow');
        if (indestructibleCb && duraRow) {
            indestructibleCb.addEventListener('change', () => {
                duraRow.style.opacity = indestructibleCb.checked ? '0.4' : '1';
                duraRow.style.pointerEvents = indestructibleCb.checked ? 'none' : 'auto';
            });
        }

        // 锁定等级联动
        const lockLevelSel = CYOA.$('editEquipLockLevel');
        const unlockItemRow = CYOA.$('equipUnlockItemRow');
        const lockHint = CYOA.$('lockLevelHint');
        if (lockLevelSel) {
            const updateLockUI = () => {
                const lv = parseInt(lockLevelSel.value) || 0;
                if (unlockItemRow) unlockItemRow.style.display = lv >= 2 ? '' : 'none';
                if (lockHint) {
                    if (lv === 5) lockHint.textContent = t('ui.hint.permLock');
                    else if (lv === 0) lockHint.textContent = '';
                    else lockHint.textContent = '';
                }
            };
            lockLevelSel.addEventListener('change', updateLockUI);
            updateLockUI();
        }

        // 职业表单：预设填入 + 属性修正添加/删除
        const profPreset = CYOA.$('editProfPreset');
        const profNameInput = CYOA.$('editProfName');
        if (profPreset && profNameInput) {
            profPreset.addEventListener('change', () => {
                if (profPreset.value) {
                    profNameInput.value = profPreset.value;
                    profPreset.selectedIndex = 0;
                }
            });
        }
        const addAttrModBtn = document.querySelector('.add-attr-mod');
        if (addAttrModBtn) {
            addAttrModBtn.addEventListener('click', () => {
                const list = CYOA.$('profAttrModList');
                if (!list) return;
                const emptyRow = list.querySelector('.cyoa-empty-row');
                if (emptyRow) emptyRow.remove();
                const attributes = CYOA.editorTempData?.attributes || [];
                const row = document.createElement('div');
                row.className = 'cyoa-attr-mod-row';
                row.style.cssText = 'display:flex; gap:6px; align-items:center; margin-bottom:4px;';
                row.innerHTML = `
                    <select class="cyoa-select attr-mod-name" style="width:120px; height:30px; font-size:12px;">
                        <option value="">${t('ui.opt.selectAttr')}</option>
                        ${attributes.map(a => `<option value="${escapeHtml(a.name)}">${escapeHtml(a.name)}</option>`).join('')}
                    </select>
                    <input type="number" class="cyoa-input attr-mod-value" value="0" style="width:70px; height:30px; font-size:12px;" step="1">
                    <button class="cyoa-btn-icon danger remove-attr-mod" type="button" style="font-size:14px;">🗑️</button>
                `;
                list.appendChild(row);
                row.querySelector('.remove-attr-mod').addEventListener('click', () => row.remove());
            });
        }
        document.querySelectorAll('.remove-attr-mod').forEach(btn => {
            btn.addEventListener('click', (e) => e.target.closest('.cyoa-attr-mod-row').remove());
        });

        // 附件系统：添加按钮 + 已有行的事件绑定
        const addAttachmentBtn = document.querySelector('.add-attachment');
        if (addAttachmentBtn) {
            addAttachmentBtn.addEventListener('click', () => createEmptyAttachmentRow());
        }
        document.querySelectorAll('.cyoa-attachment-row').forEach(row => bindAttachmentRowEvents(row));

        // 添加可交互设施
        const addInteractable = document.querySelector('.add-interactable');
        if (addInteractable) {
            addInteractable.addEventListener('click', () => {
                const list = CYOA.$('interactablesList');
                if (list) {
                    const emptyRow = list.querySelector('.cyoa-empty-row');
                    if (emptyRow) emptyRow.remove();
                    const rowHtml = buildInteractableRowHTML({ name: '', function: '', effect: '', attributeEffect: '' });
                    const temp = document.createElement('div');
                    temp.innerHTML = rowHtml;
                    const newRow = temp.firstElementChild;
                    list.appendChild(newRow);
                    bindInteractableRowEvents(newRow);
                }
            });
        }
        document.querySelectorAll('.cyoa-interactable-row').forEach(row => bindInteractableRowEvents(row));
        
        // (remove-interactable 事件已在 bindInteractableRowEvents 中统一绑定)
        
        // 添加物品消耗项
        const addConsume = document.querySelector('.add-consume-item');
        if (addConsume) {
            addConsume.addEventListener('click', () => {
                const list = CYOA.$('consumeItemsList');
                if (list) {
                    const items = getItemsForSelect();
                    const newRow = document.createElement('div');
                    newRow.className = 'cyoa-consume-row';
                    newRow.innerHTML = `
                        <select class="cyoa-select consume-item-select" style="width:150px;">
                            <option value="">${t('ui.opt.selectItem')}</option>
                            ${items.map(item => `<option value="${item.value}">${item.label}</option>`).join('')}
                        </select>
                        <input type="number" class="cyoa-input consume-item-amount" value="1" min="1" style="width:80px;" placeholder="${t('ui.ph.quantity')}">
                        <input type="number" class="cyoa-input consume-item-duration" value="0" min="0" style="width:80px;" placeholder="${t('ui.ph.duration')}">
                        <button class="cyoa-btn-icon danger remove-consume-item">🗑️</button>
                    `;
                    list.appendChild(newRow);
                    
                    newRow.querySelector('.remove-consume-item').addEventListener('click', () => newRow.remove());
                }
            });
        }
        
        // 移除消耗项
        document.querySelectorAll('.remove-consume-item').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.target.closest('.cyoa-consume-row').remove();
            });
        });
        
        // 添加技能消耗
        const addSkillConsume = document.querySelector('.add-skill-consume');
        if (addSkillConsume) {
            addSkillConsume.addEventListener('click', () => {
                const list = CYOA.$('skillConsumeItems');
                if (list) {
                    const items = getItemsForSelect();
                    const newRow = document.createElement('div');
                    newRow.className = 'cyoa-consume-row';
                    newRow.innerHTML = `
                        <select class="cyoa-select consume-item-select" style="width:150px;">
                            <option value="">${t('ui.opt.selectItem')}</option>
                            ${items.map(item => `<option value="${item.value}">${item.label}</option>`).join('')}
                        </select>
                        <input type="number" class="cyoa-input consume-item-amount" value="1" min="1" style="width:80px;" placeholder="${t('ui.ph.quantity')}">
                        <input type="text" class="cyoa-input consume-item-desc" value="" style="flex:1;" placeholder="${t('ui.ph.desc')}">
                        <button class="cyoa-btn-icon danger remove-consume-item">🗑️</button>
                    `;
                    list.appendChild(newRow);
                    
                    newRow.querySelector('.remove-consume-item').addEventListener('click', () => newRow.remove());
                }
            });
        }
        
        // 添加任务目标
        const addObjective = document.querySelector('.add-quest-objective');
        if (addObjective) {
            addObjective.addEventListener('click', () => {
                const list = CYOA.$('questObjectivesList');
                if (list) {
                    const newRow = document.createElement('div');
                    newRow.className = 'cyoa-quest-objective';
                    newRow.innerHTML = `
                        <input type="text" class="cyoa-input" placeholder="${t('ui.ph.objectiveDesc')}" style="flex:1;">
                        <button class="cyoa-btn-icon danger remove-objective">🗑️</button>
                    `;
                    list.appendChild(newRow);
                    
                    newRow.querySelector('.remove-objective').addEventListener('click', () => newRow.remove());
                }
            });
        }
        
        // 添加任务奖励
        const addReward = document.querySelector('.add-quest-reward');
        if (addReward) {
            addReward.addEventListener('click', () => {
                const list = CYOA.$('questRewardsList');
                if (list) {
                    const newRow = document.createElement('div');
                    newRow.className = 'cyoa-quest-reward';
                    newRow.innerHTML = `
                        <input type="text" class="cyoa-input" placeholder="${t('ui.ph.rewardContent')}" style="flex:1;">
                        <button class="cyoa-btn-icon danger remove-reward">🗑️</button>
                    `;
                    list.appendChild(newRow);
                    
                    newRow.querySelector('.remove-reward').addEventListener('click', () => newRow.remove());
                }
            });
        }
        
        // 移除任务目标
        document.querySelectorAll('.remove-objective, .remove-reward').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.target.closest('.cyoa-quest-objective, .cyoa-quest-reward').remove();
            });
        });

        // 章节初始牵引开关联动
        const tetherCb = CYOA.$('editChapterTetherEnabled');
        const tetherFields = CYOA.$('chapterTetherFields');
        if (tetherCb && tetherFields) {
            tetherCb.addEventListener('change', () => {
                tetherFields.style.display = tetherCb.checked ? '' : 'none';
            });
        }
    }

    // ========== 保存各项数据 ==========
    CYOA.saveAttribute = function(index) {
        if (!CYOA.editorTempData) { alert(t('ui.msg.dataNotLoaded')); return; }
        const name = CYOA.$('editAttrName')?.value.trim();
        if (!name) { alert(t('ui.msg.nameRequired', {type: t('ui.type.attributes')})); return; }
        
        const item = CYOA.editorTempData.attributes[index] || { id: CYOA.generateId() };
        item.name = name;
        item.value = parseInt(CYOA.$('editAttrValue')?.value) || 0;
        item.min = parseInt(CYOA.$('editAttrMin')?.value) || 0;
        item.max = parseInt(CYOA.$('editAttrMax')?.value) || 100;
        item.description = CYOA.$('editAttrDesc')?.value.trim() || '';
        
        if (!CYOA.editorTempData.attributes[index]) {
            CYOA.editorTempData.attributes.push(item);
        } else {
            CYOA.editorTempData.attributes[index] = item;
        }
        
        CYOA.cancelEdit();
        refreshList('attributes');
        alert(t('ui.msg.attrSaved'));
    };

    CYOA.saveItem = function(index) {
        if (!CYOA.editorTempData) { alert(t('ui.msg.dataNotLoaded')); return; }
        const name = CYOA.$('editItemName')?.value.trim();
        if (!name) { alert(t('ui.msg.nameRequired', {type: t('ui.type.items')})); return; }
        
        const item = CYOA.editorTempData.items[index] || { id: CYOA.generateId() };
        item.name = name;
        item.itemType = CYOA.$('editItemType')?.value || 'common';
        item.quantity = Math.max(1, Math.min(CONFIG.ITEM_MAX_QUANTITY || 99, parseInt(CYOA.$('editItemQuantity')?.value) || 1));
        item.durability = parseInt(CYOA.$('editItemDurability')?.value) || 0;
        item.ownerId = CYOA.$('editItemOwner')?.value || '';
        item.locked = CYOA.$('editItemLocked')?.checked || false;
        item.unlockItemId = CYOA.$('editItemUnlock')?.value || '';
        
        // 获取选中技能
        const skillSelect = CYOA.$('editItemSkills');
        if (skillSelect) {
            item.skills = Array.from(skillSelect.selectedOptions).map(opt => opt.value);
        }
        
        // 获取消耗物品
        const consumeRows = document.querySelectorAll('#consumeItemsList .cyoa-consume-row');
        item.consumeItems = [];
        consumeRows.forEach(row => {
            const select = row.querySelector('.consume-item-select');
            const amount = row.querySelector('.consume-item-amount');
            const duration = row.querySelector('.consume-item-duration');
            if (select && select.value) {
                item.consumeItems.push({
                    itemId: select.value,
                    amount: parseInt(amount?.value) || 1,
                    duration: parseInt(duration?.value) || 0
                });
            }
        });
        
        item.statModifiers = CYOA.$('editItemStats')?.value.trim() || '';
        item.description = CYOA.$('editItemDesc')?.value.trim() || '';
        if (item.itemType === 'relic') {
            item.relicGrade = CYOA.$('editItemRelicGrade')?.value || 'S';
            item.sideEffects = CYOA.$('editItemSideEffects')?.value.trim() || '';
            item.unlockCondition = CYOA.$('editItemUnlockCond')?.value.trim() || '';
        } else {
            delete item.relicGrade;
            delete item.sideEffects;
            delete item.unlockCondition;
        }
        if (!CYOA.editorTempData.items[index]) {
            CYOA.editorTempData.items.push(item);
        } else {
            CYOA.editorTempData.items[index] = item;
        }
        
        CYOA.cancelEdit();
        refreshList('items');
        alert(t('ui.msg.itemSaved'));
    };

    CYOA.saveEquipment = function(index) {
        if (!CYOA.editorTempData) { alert(t('ui.msg.dataNotLoaded')); return; }
        const name = CYOA.$('editEquipName')?.value.trim();
        if (!name) { alert(t('ui.msg.nameRequired', {type: t('ui.type.equipment')})); return; }
        
        const slots = [];
        document.querySelectorAll('.slot-checkbox:checked').forEach(cb => slots.push(cb.value));
        const constraints = [];
        document.querySelectorAll('.constraint-checkbox:checked').forEach(cb => constraints.push(cb.value));
        
        const item = CYOA.editorTempData.equipment[index] || { id: CYOA.generateId() };
        item.name = name;
        item.equipType = CYOA.$('editEquipType')?.value.trim() || t('ui.default.equipType');
        item.durability = parseInt(CYOA.$('editEquipDurability')?.value) || 0;
        item.maxDurability = parseInt(CYOA.$('editEquipMaxDurability')?.value) || 0;
        item.ownerId = CYOA.$('editEquipOwner')?.value || '';
        item.slots = slots;
        item.material = (CYOA.$('editEquipMaterial')?.value || '').trim() || undefined;
        item.constraints = constraints;
        // 限步约束参数
        if (constraints.includes('limited_step')) {
            item.stepLimitCm = parseInt(CYOA.$('editEquipStepLimitCm')?.value) || (CONFIG.LIMITED_STEP_DEFAULTS?.stepLimitCm || 20);
            item.speedModifierPct = parseInt(CYOA.$('editEquipSpeedModifierPct')?.value) ?? (CONFIG.LIMITED_STEP_DEFAULTS?.speedModifierPct || -50);
        } else {
            delete item.stepLimitCm;
            delete item.speedModifierPct;
        }
        // 姿势标签
        const ptSelect = CYOA.$('editEquipPostureTags');
        if (ptSelect) {
            item.postureTags = Array.from(ptSelect.selectedOptions).map(opt => opt.value);
        } else {
            item.postureTags = [];
        }
        // 口塞类型
        if (slots.includes('mouth')) {
            item.gagType = CYOA.$('editEquipGagType')?.value || '';
        } else {
            delete item.gagType;
        }
        // 耳部装置类型
        if (slots.includes('ears')) {
            item.earDeviceType = CYOA.$('editEquipEarDevice')?.value || '';
        } else {
            delete item.earDeviceType;
        }
        // 手指约束类型
        if (slots.includes('fingers')) {
            item.fingerRestraintType = CYOA.$('editEquipFingerRestraint')?.value || '';
        } else {
            delete item.fingerRestraintType;
        }
        item.indestructible = CYOA.$('editEquipIndestructible')?.checked || false;
        item.startEquipped = CYOA.$('editEquipStartEquipped')?.checked || false;
        item.lockLevel = parseInt(CYOA.$('editEquipLockLevel')?.value) || 0;
        // 新系统字段
        item.timerEnabled = CYOA.$('editEquipTimerEnabled')?.checked || false;
        item.isIntegrated = CYOA.$('editEquipIsIntegrated')?.checked || false;
        item.comfortType = CYOA.$('editEquipComfort')?.checked || false;
        item.lockCountdownTurns = parseInt(CYOA.$('editEquipLockCountdown')?.value) || 5;
        item.escalationPeakTurns = parseInt(CYOA.$('editEquipEscPeak')?.value) || 24;
        item.slotGroup = CYOA.$('editEquipSlotGroup')?.value || '';
        item.appearanceName = CYOA.$('editEquipAppearanceName')?.value.trim() || '';
        item.appearanceDesc = CYOA.$('editEquipAppearanceDesc')?.value.trim() || '';
        delete item.locked;
        item.unlockItemId = CYOA.$('editEquipUnlock')?.value || '';
        
        // 获取选中技能
        const skillSelect = CYOA.$('editEquipSkills');
        if (skillSelect) {
            item.skills = Array.from(skillSelect.selectedOptions).map(opt => opt.value);
        }
        
        item.statModifiers = CYOA.$('editEquipStats')?.value.trim() || '';
        
        // 收集附件数据
        item.attachments = [];
        const attachmentRows = document.querySelectorAll('#equipAttachmentsList .cyoa-attachment-row');
        attachmentRows.forEach(row => {
            const name = row.querySelector('.attachment-name')?.value.trim();
            const type = row.querySelector('.attachment-type')?.value || 'cosmetic';
            const visionType = row.querySelector('.attachment-vision-type')?.value || '';
            const stats = row.querySelector('.attachment-stats')?.value.trim() || '';
            const desc = row.querySelector('.attachment-desc')?.value.trim() || '';
            if (name) {
                const att = { id: CYOA.generateId(), name, type, description: desc };
                if (type === 'vision_modifier' && visionType) att.visionType = visionType;
                if (type === 'stat_modifier' && stats) att.statModifiers = stats;
                if (type === 'd_ring') {
                    att.dRingPosition = row.querySelector('.attachment-dring-pos')?.value || 'front';
                }
                if (type === 'vibrator' || type === 'shock') {
                    att.stimMode = row.querySelector('.attachment-stim-mode')?.value || 'off';
                    att.stimIntensity = row.querySelector('.attachment-stim-intensity')?.value || 'medium';
                }
                if (type === 'breath_restrict') {
                    att.breathType = row.querySelector('.attachment-breath-type')?.value || '';
                }
                if (type === 'temp_device') {
                    att.tempTool = row.querySelector('.attachment-temp-tool')?.value || '';
                }
                if (type === 'latex_layer') {
                    att.latexThickness = row.querySelector('.attachment-latex-thick')?.value || 'medium';
                    att.latexCoverage = parseInt(row.querySelector('.attachment-latex-coverage')?.value) || 20;
                    att.selfTightening = row.querySelector('.attachment-self-tightening')?.checked || false;
                    att.latexColor = row.querySelector('.attachment-latex-color')?.value || '';
                    const openCheckboxes = row.querySelectorAll('.attachment-latex-opening:checked');
                    if (openCheckboxes.length > 0) {
                        att.latexOpenings = Array.from(openCheckboxes).map(cb => ({ type: cb.value, state: 'zipped' }));
                    }
                }
                if (type === 'inflate') {
                    att.inflateType = row.querySelector('.attachment-inflate-type')?.value || '';
                }
                item.attachments.push(att);
            }
        });
        
        item.description = CYOA.$('editEquipDesc')?.value.trim() || '';
        
        if (!CYOA.editorTempData.equipment[index]) {
            CYOA.editorTempData.equipment.push(item);
        } else {
            CYOA.editorTempData.equipment[index] = item;
        }
        
        CYOA.cancelEdit();
        refreshList('equipment');
        alert(t('ui.msg.equipSaved'));
    };

    CYOA.saveSkill = function(index) {
        if (!CYOA.editorTempData) { alert(t('ui.msg.dataNotLoaded')); return; }
        const name = CYOA.$('editSkillName')?.value.trim();
        if (!name) { alert(t('ui.msg.nameRequired', {type: t('ui.type.skills')})); return; }
        
        const item = CYOA.editorTempData.skills[index] || { id: CYOA.generateId() };
        item.name = name;
        item.skillType = CYOA.$('editSkillType')?.value || 'combat';
        item.unlockType = CYOA.$('editSkillUnlock')?.value || 'auto';
        item.level = Math.max(CONFIG.SKILL_MIN_LEVEL || 1, Math.min(CONFIG.SKILL_MAX_LEVEL || 9, parseInt(CYOA.$('editSkillLevel')?.value) || 1));
        item.proficiency = Math.max(0, Math.min(CONFIG.SKILL_PROFICIENCY_PER_LEVEL || 100, parseInt(CYOA.$('editSkillProficiency')?.value) || 0));
        item.effect = CYOA.$('editSkillEffect')?.value.trim() || '';
        item.description = CYOA.$('editSkillDesc')?.value.trim() || '';
        
        // 属性要求
        item.requiredAttributes = {};
        document.querySelectorAll('.skill-attr-require').forEach(input => {
            const val = parseInt(input.value);
            if (val > 0) {
                item.requiredAttributes[input.dataset.attr] = val;
            }
        });
        
        // 消耗物品
        const consumeRows = document.querySelectorAll('#skillConsumeItems .cyoa-consume-row');
        item.consumeItems = [];
        consumeRows.forEach(row => {
            const select = row.querySelector('.consume-item-select');
            const amount = row.querySelector('.consume-item-amount');
            const desc = row.querySelector('.consume-item-desc');
            if (select && select.value) {
                item.consumeItems.push({
                    itemId: select.value,
                    amount: parseInt(amount?.value) || 1,
                    description: desc?.value || ''
                });
            }
        });
        
        if (!CYOA.editorTempData.skills[index]) {
            CYOA.editorTempData.skills.push(item);
        } else {
            CYOA.editorTempData.skills[index] = item;
        }
        
        CYOA.cancelEdit();
        refreshList('skills');
        alert(t('ui.msg.skillSaved'));
    };

    CYOA.saveQuest = function(index) {
        if (!CYOA.editorTempData) { alert(t('ui.msg.dataNotLoaded')); return; }
        const name = CYOA.$('editQuestName')?.value.trim();
        if (!name) { alert(t('ui.msg.nameRequired', {type: t('ui.type.quests')})); return; }
        
        const item = CYOA.editorTempData.quests[index] || { id: CYOA.generateId() };
        item.name = name;
        item.questType = CYOA.$('editQuestType')?.value || 'side';
        item.status = CYOA.$('editQuestStatus')?.value || 'locked';
        item.description = CYOA.$('editQuestDesc')?.value.trim() || '';
        item.unlockCondition = CYOA.$('editQuestUnlock')?.value.trim() || '';
        
        // 获取目标
        item.objectives = [];
        document.querySelectorAll('#questObjectivesList .cyoa-quest-objective input').forEach(input => {
            if (input.value.trim()) {
                item.objectives.push(input.value.trim());
            }
        });
        
        // 获取奖励
        item.rewards = [];
        document.querySelectorAll('#questRewardsList .cyoa-quest-reward input').forEach(input => {
            if (input.value.trim()) {
                item.rewards.push(input.value.trim());
            }
        });
        
        if (!CYOA.editorTempData.quests[index]) {
            CYOA.editorTempData.quests.push(item);
        } else {
            CYOA.editorTempData.quests[index] = item;
        }
        
        CYOA.cancelEdit();
        refreshList('quests');
        alert(t('ui.msg.questSaved'));
    };

    CYOA.saveProfession = function(index) {
        if (!CYOA.editorTempData) { alert(t('ui.msg.dataNotLoaded')); return; }
        const name = CYOA.$('editProfName')?.value.trim();
        if (!name) { alert(t('ui.msg.nameRequired', {type: t('ui.type.professions')})); return; }
        
        if (!CYOA.editorTempData.professions) CYOA.editorTempData.professions = [];
        const item = CYOA.editorTempData.professions[index] || { id: CYOA.generateId() };
        item.name = name;
        item.icon = CYOA.$('editProfIcon')?.value.trim() || '🎭';
        item.traits = CYOA.$('editProfTraits')?.value.trim() || '';
        item.statModifiers = CYOA.$('editProfStats')?.value.trim() || '';
        item.description = CYOA.$('editProfDesc')?.value.trim() || '';
        
        const skillSelect = CYOA.$('editProfSkills');
        item.skills = skillSelect ? Array.from(skillSelect.selectedOptions).map(opt => opt.value) : [];

        item.attrModifiers = [];
        document.querySelectorAll('#profAttrModList .cyoa-attr-mod-row').forEach(row => {
            const attrName = row.querySelector('.attr-mod-name')?.value;
            const attrVal = parseInt(row.querySelector('.attr-mod-value')?.value) || 0;
            if (attrName && attrVal !== 0) item.attrModifiers.push({ attr: attrName, value: attrVal });
        });

        if (!CYOA.editorTempData.professions[index]) {
            CYOA.editorTempData.professions.push(item);
        } else {
            CYOA.editorTempData.professions[index] = item;
        }
        
        CYOA.cancelEdit();
        refreshList('professions');
        alert(t('ui.msg.profSaved'));
    };

    CYOA.saveCharacter = function(index) {
        if (!CYOA.editorTempData) { alert(t('ui.msg.dataNotLoaded')); return; }
        const name = CYOA.$('editCharName')?.value.trim();
        if (!name) { alert(t('ui.msg.nameRequired', {type: t('ui.type.characters')})); return; }
        
        const personality = (CYOA.$('editCharPersonality')?.value || '').split(',').map(s => s.trim()).filter(s => s);
        const hobbies = (CYOA.$('editCharHobbies')?.value || '').split(',').map(s => s.trim()).filter(s => s);
        
        const item = CYOA.editorTempData.characters[index] || { id: CYOA.generateId() };
        item.name = name;
        item.model = CYOA.$('editCharModel')?.value || '';
        item.gender = CYOA.$('editCharGender')?.value || 'unknown';
        item.roleType = CYOA.$('editCharType')?.value || 'playable';
        item.personality = personality;
        item.hobbies = hobbies;
        item.background = CYOA.$('editCharBackground')?.value.trim() || '';
        item.goal = CYOA.$('editCharGoal')?.value.trim() || '';
        item.prompt = CYOA.$('editCharPrompt')?.value.trim() || '';
        
        // 获取职业
        const profSelect = CYOA.$('editCharProfessions');
        item.professions = profSelect ? Array.from(profSelect.selectedOptions).map(opt => opt.value) : [];
        const customProfStr = CYOA.$('editCharCustomProf')?.value || '';
        item.customProfessions = customProfStr.split(/[,，]/).map(s => s.trim()).filter(Boolean);

        // 获取技能
        const skillSelect = CYOA.$('editCharSkills');
        if (skillSelect) {
            item.skills = Array.from(skillSelect.selectedOptions).map(opt => opt.value);
        }

        // 纪律规则
        item.disciplineRules = [];
        document.querySelectorAll('.disc-rule-cb:checked').forEach(cb => {
            item.disciplineRules.push(cb.value);
        });
        const customRulesText = CYOA.$('editCharCustomRules')?.value || '';
        item.customRules = customRulesText.split('\n').map(s => s.trim()).filter(Boolean);
        item.defaultPunishment = CYOA.$('editCharPunishment')?.value || '';
        item.defaultReward = CYOA.$('editCharReward')?.value || '';
        item.trainingCurriculum = [];
        document.querySelectorAll('.training-type-cb:checked').forEach(cb => {
            item.trainingCurriculum.push(cb.value);
        });
        
        if (!CYOA.editorTempData.characters[index]) {
            CYOA.editorTempData.characters.push(item);
        } else {
            CYOA.editorTempData.characters[index] = item;
        }
        
        CYOA.cancelEdit();
        refreshList('characters');
        alert(t('ui.msg.charSaved'));
    };

    CYOA.saveScene = function(index) {
        if (!CYOA.editorTempData) { alert(t('ui.msg.dataNotLoaded')); return; }
        const name = CYOA.$('editSceneName')?.value.trim();
        if (!name) { alert(t('ui.msg.nameRequired', {type: t('ui.type.scenes')})); return; }
        
        const interactables = [];
        document.querySelectorAll('.cyoa-interactable-row').forEach(row => {
            const nameVal = row.querySelector('.interactable-name')?.value.trim() || '';
            const funcSelect = row.querySelector('.interactable-func');
            const funcText = row.querySelector('.interactable-func-text');
            let funcVal = '';
            if (funcSelect && funcSelect.value === 'tether_anchor') {
                funcVal = 'tether_anchor';
            } else if (funcText) {
                funcVal = funcText.value.trim();
            }
            const effectVal = row.querySelector('.interactable-effect')?.value.trim() || '';
            const attrVal = row.querySelector('.interactable-attr')?.value.trim() || '';
            const obj = { name: nameVal, function: funcVal, effect: effectVal, attributeEffect: attrVal };
            if (funcVal === 'tether_anchor') {
                obj.anchorHeight = row.querySelector('.interactable-anchor-height')?.value || 'wall';
                obj.anchorId = obj.anchorId || CYOA.generateId();
            }
            interactables.push(obj);
        });
        
        const item = CYOA.editorTempData.scenes[index] || { id: CYOA.generateId() };
        item.name = name;
        item.location = CYOA.$('editSceneLocation')?.value.trim() || '';
        item.decoration = CYOA.$('editSceneDecoration')?.value.trim() || '';
        item.description = CYOA.$('editSceneDescription')?.value.trim() || '';
        item.interactables = interactables;
        
        // 获取关联任务
        const questSelect = CYOA.$('editSceneQuests');
        if (questSelect) {
            item.quests = Array.from(questSelect.selectedOptions).map(opt => opt.value);
        }
        
        if (!CYOA.editorTempData.scenes[index]) {
            CYOA.editorTempData.scenes.push(item);
        } else {
            CYOA.editorTempData.scenes[index] = item;
        }
        
        CYOA.cancelEdit();
        refreshList('scenes');
        alert(t('ui.msg.sceneSaved'));
    };

    CYOA.saveChapter = function(index) {
        if (!CYOA.editorTempData) { alert(t('ui.msg.dataNotLoaded')); return; }
        const title = CYOA.$('editChapterTitle')?.value.trim();
        if (!title) { alert(t('ui.msg.nameRequired', {type: t('ui.type.chapters')})); return; }
        
        const chapter = CYOA.editorTempData.chapters[index] || { id: CYOA.generateId() };
        chapter.title = title;
        chapter.order = parseInt(CYOA.$('editChapterOrder')?.value) || index + 1;
        chapter.unlocked = CYOA.$('editChapterUnlocked')?.value === 'true';
        chapter.description = CYOA.$('editChapterDesc')?.value.trim() || '';
        
        const sceneSelect = CYOA.$('editChapterScenes');
        if (sceneSelect) {
            chapter.scenes = Array.from(sceneSelect.selectedOptions).map(opt => opt.value);
        }
        
        chapter.unlockCondition = CYOA.$('editChapterCondition')?.value.trim() || '';
        chapter.monitored = CYOA.$('editChapterMonitored')?.checked || false;
        chapter.transitionConditions = CYOA._collectChapterConditions?.() || [];

        chapter.initialPosture = CYOA.$('editChapterPosture')?.value || 'standing';
        const tetherEnabled = CYOA.$('editChapterTetherEnabled')?.checked;
        if (tetherEnabled) {
            chapter.initialTether = {
                active: true,
                type: CYOA.$('editChapterTetherType')?.value || 'npc_lead',
                targetType: CYOA.$('editChapterTetherTargetType')?.value || 'npc',
                targetId: CYOA.$('editChapterTetherTarget')?.value.trim() || '',
                targetName: CYOA.$('editChapterTetherTargetName')?.value.trim() || '',
                chainLength: CYOA.$('editChapterTetherChain')?.value || 'leash'
            };
        } else {
            chapter.initialTether = null;
        }
        
        if (!CYOA.editorTempData.chapters[index]) {
            CYOA.editorTempData.chapters.push(chapter);
        } else {
            CYOA.editorTempData.chapters[index] = chapter;
        }
        
        CYOA.cancelEdit();
        refreshChaptersList();
        alert(t('ui.msg.chapterSaved'));
    };

    CYOA.cancelEdit = function() {
        const formContainer = CYOA.$('editFormContainer');
        if (formContainer) {
            formContainer.style.display = 'none';
            formContainer.innerHTML = '';
        }
        CYOA.editingItem = { type: null, index: -1 };
    };

    // ========== 刷新章节列表 ==========
    function refreshChaptersList() {
        const container = CYOA.$('chaptersList');
        if (!container || !CYOA.editorTempData) return;
        container.innerHTML = renderChaptersSummary(CYOA.editorTempData.chapters || []);
        bindChaptersListEvents(container);
    }

    // ========== 渲染章节缩略表格 ==========
    function renderChaptersSummary(chapters) {
        if (!chapters || chapters.length === 0) {
            return `<div class="cyoa-empty-state">${t('ui.empty.noType', {type: t('ui.type.chapters')})}</div>`;
        }
        
        let html = '<div class="cyoa-summary-grid">';
        
        chapters.forEach((chapter, index) => {
            const isUnlocked = chapter.unlocked !== false;
            const sceneCount = chapter.scenes?.length || 0;
            
            html += `<div class="cyoa-summary-item" data-type="chapters" data-index="${index}">`;
            html += `<div class="cyoa-item-preview">`;
            html += `<span class="item-icon">${isUnlocked ? '📖' : '🔒'}</span>`;
            html += `<span class="item-name">${escapeHtml(chapter.title || t('ui.status.unnamed'))}</span>`;
            html += `<span class="item-type">${t('ui.status.chapterN', {n: chapter.order || index + 1})}</span>`;
            html += `<span class="item-count">📄 ${t('ui.status.nScenes', {n: sceneCount})}</span>`;
            if (chapter.monitored) html += `<span class="item-locked" title="${t('ui.label.monitorZone')}" style="color:#ef4444;">📹</span>`;
            if (chapter.description) {
                html += `<span class="item-desc">${escapeHtml(chapter.description.substring(0, 20))}</span>`;
            }
            html += `</div>`;
            html += `<div class="cyoa-item-actions">`;
            html += `<button class="cyoa-btn-icon edit-item" title="${t('ui.btn.edit')}">✏️</button>`;
            html += `<button class="cyoa-btn-icon danger delete-item" title="${t('ui.btn.delete')}">🗑️</button>`;
            html += `</div></div>`;
        });
        
        html += '</div>';
        return html;
    }

    // ========== 绑定章节列表事件 ==========
    function bindChaptersListEvents(container) {
        if (!container) return;
        
        container.querySelectorAll('.edit-item').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (!CYOA.editorTempData) {
                    alert(t('ui.msg.editorDataError'));
                    return;
                }
                const item = e.target.closest('.cyoa-summary-item');
                if (item) {
                    const index = parseInt(item.dataset.index);
                    showEditForm('chapters', index);
                }
            });
        });
        
        container.querySelectorAll('.delete-item').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (!CYOA.editorTempData) {
                    alert(t('ui.msg.editorDataError'));
                    return;
                }
                if (!confirm(t('ui.msg.confirmDeleteChapter'))) return;
                
                const item = e.target.closest('.cyoa-summary-item');
                if (item) {
                    const index = parseInt(item.dataset.index);
                    CYOA.editorTempData.chapters.splice(index, 1);
                    refreshChaptersList();
                }
            });
        });
    }

    // ========== ② 地点编辑表单 ==========
    function renderLocationForm(loc, index) {
        return `<div class="cyoa-edit-form">
            <h3>📍 编辑地点</h3>
            <div class="cyoa-form-row">
                <label>地点名称</label>
                <input type="text" id="editLocName" class="cyoa-input" value="${escapeHtml(loc.name || '')}">
            </div>
            <div class="cyoa-form-row">
                <label>描述</label>
                <textarea id="editLocDesc" class="cyoa-textarea" rows="2">${escapeHtml(loc.description || '')}</textarea>
            </div>
            <div class="cyoa-form-row">
                <label><input type="checkbox" id="editLocSafeRoom" ${loc.isSafeRoom ? 'checked' : ''}> 安全区（密室/解锁区）</label>
            </div>
            <div class="cyoa-form-row">
                <label>特性标签（逗号分隔）</label>
                <input type="text" id="editLocFeatures" class="cyoa-input" value="${escapeHtml((loc.features || []).join(', '))}">
            </div>
            <div class="cyoa-form-row" style="background:#eff6ff; padding:10px; border-radius:8px;">
                <label style="font-weight:600;">到其他地点的旅行轮数</label>
                <small>格式：地点ID:轮数，逗号分隔。例如 company:6,pool:8</small>
                <input type="text" id="editLocEdges" class="cyoa-input" value="${escapeHtml(loc._edgesStr || '')}">
            </div>
            <div class="cyoa-form-actions">
                <button class="cyoa-btn cyoa-btn-secondary" onclick="CYOA.cancelEdit()">取消</button>
                <button class="cyoa-btn cyoa-btn-primary" onclick="CYOA.saveLocation(${index})">保存地点</button>
            </div>
        </div>`;
    }

    CYOA.saveLocation = function(index) {
        if (!CYOA.editorTempData) return;
        const item = CYOA.editorTempData.locations[index] || { id: CYOA.generateId() };
        item.name = CYOA.$('editLocName')?.value.trim() || '';
        item.description = CYOA.$('editLocDesc')?.value.trim() || '';
        item.isSafeRoom = CYOA.$('editLocSafeRoom')?.checked || false;
        item.features = (CYOA.$('editLocFeatures')?.value || '').split(',').map(s => s.trim()).filter(Boolean);
        const edgesStr = CYOA.$('editLocEdges')?.value.trim() || '';
        if (edgesStr) {
            const game = CYOA.editorTempData;
            game.locationEdges = (game.locationEdges || []).filter(e => e.from !== item.id && e.to !== item.id);
            edgesStr.split(',').forEach(part => {
                const [toId, turns] = part.trim().split(':');
                if (toId && turns) game.locationEdges.push({ from: item.id, to: toId.trim(), travelTurns: parseInt(turns) || 6 });
            });
        }
        if (index >= CYOA.editorTempData.locations.length) CYOA.editorTempData.locations.push(item);
        else CYOA.editorTempData.locations[index] = item;
        CYOA.cancelEdit(); refreshList('locations');
    };

    // ========== ⑤ 装备联动编辑表单 ==========
    function renderSynergyForm(syn, index) {
        const equipOptions = (CYOA.editorTempData?.equipment || []).map(e =>
            `<option value="${e.id}" ${(syn.triggers || []).includes(e.id) ? 'selected' : ''}>${escapeHtml(e.name)}</option>`
        ).join('');
        const condOptions = (CONFIG.SYNERGY_TRIGGER_CONDITIONS || []).map(c =>
            `<option value="${c.value}" ${syn.condition === c.value ? 'selected' : ''}>${c.label}</option>`
        ).join('');
        return `<div class="cyoa-edit-form">
            <h3>🔗 编辑装备联动</h3>
            <div class="cyoa-form-row">
                <label>触发装备（需同时穿戴）</label>
                <select id="editSynTriggers" class="cyoa-input" multiple size="5">${equipOptions}</select>
            </div>
            <div class="cyoa-form-row">
                <label>触发条件</label>
                <select id="editSynCondition" class="cyoa-input">${condOptions}</select>
            </div>
            <div class="cyoa-form-row">
                <label>效果标识</label>
                <input type="text" id="editSynEffect" class="cyoa-input" value="${escapeHtml(syn.effect || '')}">
            </div>
            <div class="cyoa-form-row">
                <label>AI叙述描述</label>
                <textarea id="editSynDesc" class="cyoa-textarea" rows="2">${escapeHtml(syn.description || '')}</textarea>
            </div>
            <div class="cyoa-form-actions">
                <button class="cyoa-btn cyoa-btn-secondary" onclick="CYOA.cancelEdit()">取消</button>
                <button class="cyoa-btn cyoa-btn-primary" onclick="CYOA.saveSynergy(${index})">保存联动</button>
            </div>
        </div>`;
    }

    CYOA.saveSynergy = function(index) {
        if (!CYOA.editorTempData) return;
        const item = CYOA.editorTempData.equipmentSynergies[index] || { id: CYOA.generateId() };
        item.name = CYOA.$('editSynEffect')?.value.trim() || '联动';
        item.triggers = Array.from(CYOA.$('editSynTriggers')?.selectedOptions || []).map(o => o.value);
        item.condition = CYOA.$('editSynCondition')?.value || 'always';
        item.effect = CYOA.$('editSynEffect')?.value.trim() || '';
        item.description = CYOA.$('editSynDesc')?.value.trim() || '';
        if (index >= CYOA.editorTempData.equipmentSynergies.length) CYOA.editorTempData.equipmentSynergies.push(item);
        else CYOA.editorTempData.equipmentSynergies[index] = item;
        CYOA.cancelEdit(); refreshList('equipmentSynergies');
    };

    // ========== ⑥ 知识迷雾编辑表单 ==========
    function renderDiscoveryForm(rule, index) {
        const condOptions = (CONFIG.DISCOVERY_CONDITIONS || []).map(c =>
            `<option value="${c.value}" ${rule.discoverCondition === c.value ? 'selected' : ''}>${c.label}</option>`
        ).join('');
        return `<div class="cyoa-edit-form">
            <h3>🔮 编辑发现规则</h3>
            <div class="cyoa-form-row">
                <label>规则名称</label>
                <input type="text" id="editDiscName" class="cyoa-input" value="${escapeHtml(rule.name || '')}">
            </div>
            <div class="cyoa-form-row">
                <label>规则描述（发现后显示给玩家）</label>
                <textarea id="editDiscDesc" class="cyoa-textarea" rows="2">${escapeHtml(rule.description || '')}</textarea>
            </div>
            <div class="cyoa-form-row">
                <label>发现条件</label>
                <select id="editDiscCondition" class="cyoa-input">${condOptions}</select>
            </div>
            <div class="cyoa-form-row">
                <label>条件值（如穿戴N轮的N，或地点/装备ID）</label>
                <input type="text" id="editDiscCondValue" class="cyoa-input" value="${escapeHtml(rule.conditionValue || '')}">
            </div>
            <div class="cyoa-form-actions">
                <button class="cyoa-btn cyoa-btn-secondary" onclick="CYOA.cancelEdit()">取消</button>
                <button class="cyoa-btn cyoa-btn-primary" onclick="CYOA.saveDiscovery(${index})">保存规则</button>
            </div>
        </div>`;
    }

    CYOA.saveDiscovery = function(index) {
        if (!CYOA.editorTempData) return;
        const item = CYOA.editorTempData.discoveryRules[index] || { id: CYOA.generateId() };
        item.name = CYOA.$('editDiscName')?.value.trim() || '';
        item.description = CYOA.$('editDiscDesc')?.value.trim() || '';
        item.discoverCondition = CYOA.$('editDiscCondition')?.value || 'custom';
        item.conditionValue = CYOA.$('editDiscCondValue')?.value.trim() || '';
        if (index >= CYOA.editorTempData.discoveryRules.length) CYOA.editorTempData.discoveryRules.push(item);
        else CYOA.editorTempData.discoveryRules[index] = item;
        CYOA.cancelEdit(); refreshList('discoveryRules');
    };

    // ========== ⑧ 服饰预设编辑表单 ==========
    function renderPresetForm(preset, index) {
        const equipOptions = (CYOA.editorTempData?.equipment || []).map(e =>
            `<option value="${e.id}" ${(preset.items || []).includes(e.id) ? 'selected' : ''}>${escapeHtml(e.name)}</option>`
        ).join('');
        const chapterOptions = (CYOA.editorTempData?.chapters || []).map(c =>
            `<option value="${c.id}" ${preset.chapter === c.id ? 'selected' : ''}>${escapeHtml(c.title || c.name || c.id)}</option>`
        ).join('');
        return `<div class="cyoa-edit-form">
            <h3>👗 编辑服饰预设</h3>
            <div class="cyoa-form-row">
                <label>预设名称</label>
                <input type="text" id="editPresetName" class="cyoa-input" value="${escapeHtml(preset.name || '')}">
            </div>
            <div class="cyoa-form-row">
                <label>包含装备</label>
                <select id="editPresetItems" class="cyoa-input" multiple size="6">${equipOptions}</select>
            </div>
            <div class="cyoa-form-row">
                <label>关联章节（可选）</label>
                <select id="editPresetChapter" class="cyoa-input"><option value="">无</option>${chapterOptions}</select>
            </div>
            <div class="cyoa-form-row">
                <label>特殊规则（可选）</label>
                <input type="text" id="editPresetRule" class="cyoa-input" value="${escapeHtml(preset.specialRule || '')}" placeholder="如：万圣节可外穿">
            </div>
            <div class="cyoa-form-actions">
                <button class="cyoa-btn cyoa-btn-secondary" onclick="CYOA.cancelEdit()">取消</button>
                <button class="cyoa-btn cyoa-btn-primary" onclick="CYOA.savePreset(${index})">保存预设</button>
            </div>
        </div>`;
    }

    CYOA.savePreset = function(index) {
        if (!CYOA.editorTempData) return;
        const item = CYOA.editorTempData.outfitPresets[index] || { id: CYOA.generateId() };
        item.name = CYOA.$('editPresetName')?.value.trim() || '';
        item.items = Array.from(CYOA.$('editPresetItems')?.selectedOptions || []).map(o => o.value);
        item.chapter = CYOA.$('editPresetChapter')?.value || '';
        item.specialRule = CYOA.$('editPresetRule')?.value.trim() || '';
        if (index >= CYOA.editorTempData.outfitPresets.length) CYOA.editorTempData.outfitPresets.push(item);
        else CYOA.editorTempData.outfitPresets[index] = item;
        CYOA.cancelEdit(); refreshList('outfitPresets');
    };

    // ========== Story Cards（FictionLab 风格 lore 触发卡） ==========
    function renderStoryCardForm(card, index) {
        const types = CONFIG.STORY_CARD_TYPES || [];
        const typeOptions = types.map(tp =>
            `<option value="${tp.value}" ${tp.value === (card.type || 'custom') ? 'selected' : ''}>${tp.label}</option>`
        ).join('');
        const triggersStr = Array.isArray(card.triggerWords) ? (card.triggerWords || []).join(', ') : (card.triggerWords || '');
        return `<div class="cyoa-edit-form">
            <h3>📝 ${t('ui.storyCard.editTitle')}</h3>
            <div class="cyoa-form-row">
                <label>${t('ui.storyCard.name')}</label>
                <input type="text" id="editStoryCardName" class="cyoa-input" value="${escapeHtml(card.name || '')}" placeholder="${t('ui.storyCard.namePh')}">
            </div>
            <div class="cyoa-form-row">
                <label>${t('ui.storyCard.type')}</label>
                <select id="editStoryCardType" class="cyoa-select">${typeOptions}</select>
            </div>
            <div class="cyoa-form-row">
                <label>${t('ui.storyCard.triggerWords')}</label>
                <input type="text" id="editStoryCardTriggers" class="cyoa-input" value="${escapeHtml(triggersStr)}" placeholder="${t('ui.storyCard.triggerPh')}">
            </div>
            <div class="cyoa-form-row">
                <label>${t('ui.storyCard.content')}</label>
                <textarea id="editStoryCardContent" class="cyoa-textarea" rows="6" placeholder="${t('ui.storyCard.contentPh')}">${escapeHtml(card.content || '')}</textarea>
            </div>
            <div class="cyoa-form-actions">
                <button class="cyoa-btn cyoa-btn-secondary" onclick="CYOA.cancelEdit()">${t('ui.btn.cancel')}</button>
                <button class="cyoa-btn cyoa-btn-primary" onclick="CYOA.saveStoryCard(${index})">${t('ui.btn.save')}</button>
            </div>
        </div>`;
    }

    CYOA.saveStoryCard = function(index) {
        if (!CYOA.editorTempData) return;
        if (!CYOA.editorTempData.storyCards) CYOA.editorTempData.storyCards = [];
        const item = CYOA.editorTempData.storyCards[index] || { id: CYOA.generateId() };
        item.name = CYOA.$('editStoryCardName')?.value.trim() || t('ui.default.newStoryCard');
        item.type = CYOA.$('editStoryCardType')?.value || 'custom';
        const triggerStr = CYOA.$('editStoryCardTriggers')?.value.trim() || '';
        item.triggerWords = triggerStr.split(/[,，\s]+/).filter(Boolean);
        item.content = CYOA.$('editStoryCardContent')?.value.trim() || '';
        if (index >= CYOA.editorTempData.storyCards.length) CYOA.editorTempData.storyCards.push(item);
        else CYOA.editorTempData.storyCards[index] = item;
        CYOA.cancelEdit();
        refreshList('storyCards');
    };

    // ========== 导出到全局 ==========
    CYOA.renderSummaryTable = renderSummaryTable;
    CYOA.refreshList = refreshList;
    CYOA.bindListEvents = bindListEvents;
    CYOA.showEditForm = showEditForm;
    CYOA.refreshChaptersList = refreshChaptersList;
    CYOA.renderChaptersSummary = renderChaptersSummary;

    log('CYOA 编辑器模块加载完成');
})();