/**
 * CYOA 插件主入口模块 v2.1
 * 包含：插件注册、面板渲染、侧边栏、UI组件
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
    const getItemTypeLabel = CYOA.getItemTypeLabel;
    const getSkillTypeLabel = CYOA.getSkillTypeLabel;
    const getQuestTypeLabel = CYOA.getQuestTypeLabel;
    const getRoleTypeLabel = CYOA.getRoleTypeLabel;
    const t = CYOA.t;

    function progressBar(pct, color, h = 4) {
        const r = h / 2;
        return `<div style="height:${h}px;background:var(--border);border-radius:${r}px;overflow:hidden;"><div style="height:100%;width:${Math.min(100, pct)}%;background:${color};border-radius:${r}px;transition:width .3s;"></div></div>`;
    }
    function statRow(label, value, color) {
        return `<div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:2px;"><span>${label}</span><span style="color:${color || 'inherit'};font-weight:600;">${value}</span></div>`;
    }

    // ========== 游戏编辑器模块（部分函数在editor中已定义，这里只包含编辑器入口） ==========
    const GameEditor = {
        // 打开编辑器（支持直接传入数据，用于 AI 生成）
        openWithData: function(gameData) {
            if (!gameData) return;
            this.open(null, gameData);
        },

        // 打开编辑器
        open: async function(gameId, preloadedData) {
            let gameData = preloadedData ?? null;
            if (!gameData && gameId && gameId !== 'new') {
                gameData = await CYOA.loadGameFromFile(gameId);
            }
            
            CYOA.editorTempData = gameData ? JSON.parse(JSON.stringify(gameData)) : JSON.parse(JSON.stringify(CONFIG.DEFAULT_GAME));
            CYOA.editorTempData.id = gameData ? gameData.id : 'game_' + CYOA.generateId();
            CYOA.editorTempData.updatedAt = CYOA.getCurrentTimestamp();

            const title = gameData ? (gameData.name ? t('ui.editor.title.edit', {name: gameData.name}) : t('ui.editor.title.new')) : t('ui.editor.title.new');
            const contentHtml = this.buildFormHTML(CYOA.editorTempData);
            const footerHtml = `
                <button class="cyoa-btn cyoa-btn-secondary" id="modalCancelBtn">${t('ui.btn.cancel')}</button>
                <button class="cyoa-btn cyoa-btn-primary" id="modalSaveBtn">${t('ui.btn.saveAll')}</button>
            `;

            const modal = CYOA.ModalSystem.open(title, contentHtml, footerHtml, {
                icon: '🎮',
                size: 'large',
                closeOnOverlay: false,
                onClose: () => {
                    CYOA.editorTempData = null;
                    CYOA.renderSettings(CYOA.$('pluginSettingsContent'));
                }
            });

            this.attachEvents(modal);
        },

        // 构建编辑器HTML
        buildFormHTML: function(data) {
            const ws = data.worldSetting || {};
            const cm = data.coreMechanics || {};
            const rules = data.rules || {};
            const narrator = data.narrator || CONFIG.DEFAULT_GAME.narrator;
            
            const models = CYOA.getChatModels();
            const modelOptions = models.map(m => `<option value="${m.value}" ${m.value === narrator.model ? 'selected' : ''}>${m.label}</option>`).join('');
            const styleOptions = CONFIG.NARRATOR_STYLES.map(s => `<option value="${s}" ${s === narrator.style ? 'selected' : ''}>${s}</option>`).join('');

            // 缩略表格
            const attributesSummary = CYOA.renderSummaryTable(data.attributes || [], 'attributes');
            const itemsSummary = CYOA.renderSummaryTable(data.items || [], 'items');
            const equipmentSummary = CYOA.renderSummaryTable(data.equipment || [], 'equipment');
            const locationsSummary = CYOA.renderSummaryTable(data.locations || [], 'locations');
            const synergiesSummary = CYOA.renderSummaryTable(data.equipmentSynergies || [], 'equipmentSynergies');
            const discoverySummary = CYOA.renderSummaryTable(data.discoveryRules || [], 'discoveryRules');
            const presetsSummary = CYOA.renderSummaryTable(data.outfitPresets || [], 'outfitPresets');
            const professionsSummary = CYOA.renderSummaryTable(data.professions || [], 'professions');
            const skillsSummary = CYOA.renderSummaryTable(data.skills || [], 'skills');
            const questsSummary = CYOA.renderSummaryTable(data.quests || [], 'quests');
            const charactersSummary = CYOA.renderSummaryTable(data.characters || [], 'characters');
            const scenesSummary = CYOA.renderSummaryTable(data.scenes || [], 'scenes');
            const storyCardsSummary = CYOA.renderSummaryTable(data.storyCards || [], 'storyCards');

            return `
                <div class="cyoa-editor-container">
                    <!-- 基本信息 -->
                    <div class="cyoa-editor-section">
                        <div class="cyoa-section-header">
                            <span>${t('ui.editor.gameBasic')}</span>
                            <button class="cyoa-btn cyoa-btn-primary cyoa-btn-sm save-section" data-section="basic">💾 ${t('ui.btn.save')}</button>
                        </div>
                        <div class="cyoa-section-body">
                            <div class="cyoa-grid-3">
                                <div><label>${t('ui.label.gameName')}</label><input type="text" id="editName" class="cyoa-input" value="${escapeHtml(data.name || '')}"></div>
                                <div><label>${t('ui.label.author')}</label><input type="text" id="editAuthor" class="cyoa-input" value="${escapeHtml(data.author || '')}"></div>
                                <div><label>${t('ui.label.version')}</label><input type="text" id="editVersion" class="cyoa-input" value="${escapeHtml(data.version || '1.0.0')}"></div>
                            </div>
                            <div><label>${t('ui.label.synopsis')}</label><textarea id="editSynopsis" class="cyoa-textarea" rows="2">${escapeHtml(data.synopsis || '')}</textarea></div>
                        </div>
                    </div>

                    <!-- 世界设定 -->
                    <div class="cyoa-editor-section">
                        <div class="cyoa-section-header">
                            <span>${t('ui.editor.worldSetting')}</span>
                            <button class="cyoa-btn cyoa-btn-primary cyoa-btn-sm save-section" data-section="world">💾 ${t('ui.btn.save')}</button>
                        </div>
                        <div class="cyoa-section-body">
                            <div class="cyoa-grid-2">
                                <input type="text" id="editWorldBackground" class="cyoa-input" value="${escapeHtml(ws.background || '')}" placeholder="${t('ui.ph.bgEra')}">
                                <input type="text" id="editWorldGeography" class="cyoa-input" value="${escapeHtml(ws.geography || '')}" placeholder="${t('ui.ph.geography')}">
                            </div>
                            <div class="cyoa-grid-2">
                                <input type="text" id="editWorldFactions" class="cyoa-input" value="${escapeHtml(ws.factions || '')}" placeholder="${t('ui.ph.factions')}">
                                <input type="text" id="editWorldSocial" class="cyoa-input" value="${escapeHtml(ws.socialStructure || '')}" placeholder="${t('ui.ph.society')}">
                            </div>
                            <textarea id="editWorldHistory" class="cyoa-textarea" rows="2" placeholder="${t('ui.ph.history')}">${escapeHtml(ws.history || '')}</textarea>
                            <div class="cyoa-form-row" style="display:flex;gap:8px;align-items:flex-start;">
                                <textarea id="editWorldCustom" class="cyoa-textarea" rows="2" placeholder="${t('ui.ph.customSetting')}" style="flex:1;">${escapeHtml(ws.custom || '')}</textarea>
                                <button type="button" class="cyoa-btn cyoa-btn-sm" style="flex-shrink:0;font-size:11px;white-space:nowrap;" onclick="CYOA.requestAIExpand && CYOA.requestAIExpand('editWorldCustom','world')" title="${t('ui.btn.aiExpand')}">✨ AI 扩展</button>
                            </div>
                            <div style="margin-top:12px; padding-top:12px; border-top:1px solid var(--border);">
                                <label style="display:block; margin-bottom:6px;">${t('ui.label.worldRuleTags')}</label>
                                <div id="editWorldRuleTags" class="cyoa-rule-tags" style="display:flex; flex-wrap:wrap; gap:6px;">
                                    ${(CONFIG.HEAVENLY_PATHS || []).map(p => `<label class="cyoa-tag-option"><input type="checkbox" value="${p.value}" ${(ws.ruleTags || []).includes(p.value) ? 'checked' : ''}> ${p.label}</label>`).join('')}
                                </div>
                                <div style="margin-top:10px;">
                                    <label style="display:block; margin-bottom:6px;">合同/契约用词环境</label>
                                    <select id="editWorldLexiconMode" class="cyoa-select">
                                        <option value="auto" ${(ws.lexiconMode || 'auto') === 'auto' ? 'selected' : ''}>自动判定（推荐）</option>
                                        <option value="modern" ${(ws.lexiconMode || 'auto') === 'modern' ? 'selected' : ''}>现代（合同）</option>
                                        <option value="ancient" ${(ws.lexiconMode || 'auto') === 'ancient' ? 'selected' : ''}>古代/奇幻（契约）</option>
                                    </select>
                                </div>
                                <label class="cyoa-checkbox-row" style="margin-top:8px; display:flex; align-items:center; gap:8px;"><input type="checkbox" id="editWorldIsFusion" ${ws.isFusionWorld ? 'checked' : ''}> ${t('ui.label.isFusionWorld')}</label>
                                <label class="cyoa-checkbox-row" style="margin-top:4px; display:flex; align-items:center; gap:8px;"><input type="checkbox" id="editHumanityBalance" ${data.humanityBalanceEnabled ? 'checked' : ''}> ${t('ui.label.humanityBalance')}</label>
                            </div>
                        </div>
                    </div>

                    <!-- 核心机制 -->
                    <div class="cyoa-editor-section">
                        <div class="cyoa-section-header">
                            <span>${t('ui.editor.coreMech')}</span>
                            <button class="cyoa-btn cyoa-btn-primary cyoa-btn-sm save-section" data-section="mechanics">💾 ${t('ui.btn.save')}</button>
                        </div>
                        <div class="cyoa-section-body">
                            <select id="editMechanicsType" class="cyoa-select">
                                <option value="turn-based" ${cm.type === 'turn-based' ? 'selected' : ''}>${t('ui.opt.turnBased')}</option>
                                <option value="real-time" ${cm.type === 'real-time' ? 'selected' : ''}>${t('ui.opt.realTime')}</option>
                                <option value="exploration" ${cm.type === 'exploration' ? 'selected' : ''}>${t('ui.opt.exploration')}</option>
                                <option value="puzzle" ${cm.type === 'puzzle' ? 'selected' : ''}>${t('ui.opt.puzzle')}</option>
                                <option value="custom" ${cm.type === 'custom' ? 'selected' : ''}>${t('ui.opt.customMech')}</option>
                            </select>
                            <textarea id="editMechanicsDesc" class="cyoa-textarea" rows="2" placeholder="${t('ui.ph.mechDesc')}">${escapeHtml(cm.description || '')}</textarea>
                            <textarea id="editMechanicsCustom" class="cyoa-textarea" rows="2" placeholder="${t('ui.ph.customMech')}">${escapeHtml(cm.custom || '')}</textarea>
                        </div>
                    </div>

                    <!-- 叙述者设定 -->
                    <div class="cyoa-editor-section">
                        <div class="cyoa-section-header">
                            <span>${t('ui.editor.narrator')}</span>
                            <button class="cyoa-btn cyoa-btn-primary cyoa-btn-sm save-section" data-section="narrator">💾 ${t('ui.btn.save')}</button>
                        </div>
                        <div class="cyoa-section-body">
                            <div class="cyoa-grid-2">
                                <div>
                                    <label>${t('ui.label.aiModel')}</label>
                                    <select id="narratorModel" class="cyoa-select"><option value="">${t('ui.label.selectModel')}</option>${modelOptions}</select>
                                </div>
                                <div>
                                    <label>${t('ui.label.narratorStyle')}</label>
                                    <select id="narratorStyle" class="cyoa-select"><option value="">${t('ui.label.selectStyle')}</option>${styleOptions}</select>
                                </div>
                            </div>
                            <div class="cyoa-form-row">
                                <label>${t('ui.label.narratorSetting')}</label>
                                <div style="display:flex;gap:8px;align-items:flex-start;">
                                    <textarea id="narratorPrompt" class="cyoa-textarea" rows="3" style="flex:1;">${escapeHtml(narrator.prompt || '')}</textarea>
                                    <button type="button" class="cyoa-btn cyoa-btn-sm" style="flex-shrink:0;font-size:11px;white-space:nowrap;" onclick="CYOA.requestAIExpand && CYOA.requestAIExpand('narratorPrompt','narrator')" title="${t('ui.btn.aiExpand')}">✨ AI 扩展</button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Story Cards（FictionLab 风格 lore 触发卡） -->
                    <div class="cyoa-editor-section">
                        <div class="cyoa-section-header">
                            <span>${t('ui.editor.storyCards')}</span>
                            <button class="cyoa-btn cyoa-btn-primary cyoa-btn-sm add-item" data-type="storyCards">+ ${t('ui.btn.addStoryCard')}</button>
                        </div>
                        <div class="cyoa-section-body">
                            <p class="cyoa-hint">${t('ui.hint.storyCards')}</p>
                            <div id="storyCardsList" class="cyoa-summary-container">${storyCardsSummary}</div>
                        </div>
                    </div>

                    <!-- 属性系统 -->
                    <div class="cyoa-editor-section">
                        <div class="cyoa-section-header">
                            <span>${t('ui.editor.attrSystem')}</span>
                            <button class="cyoa-btn cyoa-btn-primary cyoa-btn-sm add-item" data-type="attributes">${t('ui.btn.addAttr')}</button>
                        </div>
                        <div class="cyoa-section-body">
                            <div id="attributesList" class="cyoa-summary-container">${attributesSummary}</div>
                        </div>
                    </div>

                    <!-- 物品系统 -->
                    <div class="cyoa-editor-section">
                        <div class="cyoa-section-header">
                            <span>${t('ui.editor.itemSystem')}</span>
                            <button class="cyoa-btn cyoa-btn-primary cyoa-btn-sm add-item" data-type="items">${t('ui.btn.addItem')}</button>
                        </div>
                        <div class="cyoa-section-body">
                            <div id="itemsList" class="cyoa-summary-container">${itemsSummary}</div>
                        </div>
                    </div>

                    <!-- 装备系统 -->
                    <div class="cyoa-editor-section">
                        <div class="cyoa-section-header">
                            <span>${t('ui.editor.equipSystem')}</span>
                            <button class="cyoa-btn cyoa-btn-primary cyoa-btn-sm add-item" data-type="equipment">${t('ui.btn.addEquip')}</button>
                        </div>
                        <div class="cyoa-section-body">
                            <div id="equipmentList" class="cyoa-summary-container">${equipmentSummary}</div>
                        </div>
                    </div>

                    <!-- 大地图 / 小地图 / 地点 / 设施 -->
                    <div class="cyoa-editor-section">
                        <div class="cyoa-section-header">
                            <span>🗺️ ${t('ui.editor.worldMap')}</span>
                            <button class="cyoa-btn cyoa-btn-primary cyoa-btn-sm" onclick="CYOA.showWorldMapEditor()">${t('ui.btn.editMap')}</button>
                        </div>
                        <div class="cyoa-section-body">
                            <div id="worldMapSummary" style="font-size:13px; color:var(--text-light);">${(data.worldMap?.regions?.length || 0) > 0 ? t('ui.status.nRegions', {n: data.worldMap.regions.length}) : t('ui.empty.noWorldMap')}</div>
                            <div style="margin-top:10px;">
                                <span style="font-weight:600;">📍 ${t('ui.editor.locations')}</span>
                                <button class="cyoa-btn cyoa-btn-primary cyoa-btn-sm add-item" data-type="locations" style="margin-left:8px;">+ ${t('ui.btn.addLocation')}</button>
                            </div>
                            <div id="locationsList" class="cyoa-summary-container" style="margin-top:8px;">${locationsSummary}</div>
                        </div>
                    </div>

                    <!-- 装备联动 -->
                    <div class="cyoa-editor-section">
                        <div class="cyoa-section-header">
                            <span>🔗 装备联动</span>
                            <button class="cyoa-btn cyoa-btn-primary cyoa-btn-sm add-item" data-type="equipmentSynergies">+ 添加联动</button>
                        </div>
                        <div class="cyoa-section-body">
                            <div id="equipmentSynergiesList" class="cyoa-summary-container">${synergiesSummary}</div>
                        </div>
                    </div>

                    <!-- 知识迷雾 -->
                    <div class="cyoa-editor-section">
                        <div class="cyoa-section-header">
                            <span>🔮 知识迷雾 / 规则发现</span>
                            <button class="cyoa-btn cyoa-btn-primary cyoa-btn-sm add-item" data-type="discoveryRules">+ 添加规则</button>
                        </div>
                        <div class="cyoa-section-body">
                            <div id="discoveryRulesList" class="cyoa-summary-container">${discoverySummary}</div>
                        </div>
                    </div>

                    <!-- 服饰预设 -->
                    <div class="cyoa-editor-section">
                        <div class="cyoa-section-header">
                            <span>👗 服饰预设</span>
                            <button class="cyoa-btn cyoa-btn-primary cyoa-btn-sm add-item" data-type="outfitPresets">+ 添加预设</button>
                        </div>
                        <div class="cyoa-section-body">
                            <div id="outfitPresetsList" class="cyoa-summary-container">${presetsSummary}</div>
                        </div>
                    </div>

                    <!-- 职业系统 -->
                    <div class="cyoa-editor-section">
                        <div class="cyoa-section-header">
                            <span>${t('ui.editor.profSystem')}</span>
                            <button class="cyoa-btn cyoa-btn-primary cyoa-btn-sm add-item" data-type="professions">${t('ui.btn.addProf')}</button>
                        </div>
                        <div class="cyoa-section-body">
                            <div id="professionsList" class="cyoa-summary-container">${professionsSummary}</div>
                        </div>
                    </div>

                    <!-- 技能系统 -->
                    <div class="cyoa-editor-section">
                        <div class="cyoa-section-header">
                            <span>${t('ui.editor.skillSystem')}</span>
                            <button class="cyoa-btn cyoa-btn-primary cyoa-btn-sm add-item" data-type="skills">${t('ui.btn.addSkill')}</button>
                        </div>
                        <div class="cyoa-section-body">
                            <div id="skillsList" class="cyoa-summary-container">${skillsSummary}</div>
                        </div>
                    </div>

                    <!-- 任务系统（新增） -->
                    <div class="cyoa-editor-section">
                        <div class="cyoa-section-header">
                            <span>${t('ui.editor.questSystem')}</span>
                            <button class="cyoa-btn cyoa-btn-primary cyoa-btn-sm add-item" data-type="quests">${t('ui.btn.addQuest')}</button>
                        </div>
                        <div class="cyoa-section-body">
                            <div id="questsList" class="cyoa-summary-container">${questsSummary}</div>
                        </div>
                    </div>

                    <!-- 角色管理 -->
                    <div class="cyoa-editor-section">
                        <div class="cyoa-section-header">
                            <span>${t('ui.editor.charMgmt')}</span>
                            <button class="cyoa-btn cyoa-btn-primary cyoa-btn-sm add-item" data-type="characters">${t('ui.btn.addChar')}</button>
                        </div>
                        <div class="cyoa-section-body">
                            <div id="charactersList" class="cyoa-summary-container">${charactersSummary}</div>
                        </div>
                    </div>

                    <!-- 场景管理 -->
                    <div class="cyoa-editor-section">
                        <div class="cyoa-section-header">
                            <span>${t('ui.editor.sceneMgmt')}</span>
                            <button class="cyoa-btn cyoa-btn-primary cyoa-btn-sm add-item" data-type="scenes">${t('ui.btn.addScene')}</button>
                        </div>
                        <div class="cyoa-section-body">
                            <div class="cyoa-form-group">
                                <label>${t('ui.label.initScene')}</label>
                                <select id="editInitialScene" class="cyoa-select">
                                    <option value="">${t('ui.label.selectInitScene')}</option>
                                    ${(data.scenes || []).map(s => `<option value="${escapeHtml(s.name)}" ${s.name === data.initialScene ? 'selected' : ''}>${escapeHtml(s.name)}</option>`).join('')}
                                </select>
                            </div>
                            <div id="scenesList" class="cyoa-summary-container">${scenesSummary}</div>
                        </div>
                    </div>

                    <!-- 章节管理 -->
                    <div class="cyoa-editor-section">
                        <div class="cyoa-section-header">
                            <span>${t('ui.editor.chapterMgmt')}</span>
                            <button class="cyoa-btn cyoa-btn-primary cyoa-btn-sm add-item" data-type="chapters">${t('ui.btn.addChapter')}</button>
                        </div>
                        <div class="cyoa-section-body">
                            <div class="cyoa-form-group">
                                <label>${t('ui.label.initChapter')}</label>
                                <select id="editInitialChapter" class="cyoa-select">
                                    <option value="">${t('ui.label.selectInitChapter')}</option>
                                    ${(data.chapters || []).map(ch => `<option value="${escapeHtml(ch.id)}" ${ch.id === data.initialChapter ? 'selected' : ''}>${escapeHtml(ch.title || ch.id)}</option>`).join('')}
                                </select>
                            </div>
                            <div id="chaptersList" class="cyoa-summary-container">${CYOA.renderChaptersSummary ? CYOA.renderChaptersSummary(data.chapters || []) : ''}</div>
                        </div>
                    </div>

                    <!-- 判定规则 -->
                    <div class="cyoa-editor-section">
                        <div class="cyoa-section-header">
                            <span>${t('ui.editor.judgeRules')}</span>
                            <button class="cyoa-btn cyoa-btn-primary cyoa-btn-sm save-section" data-section="rules">💾 ${t('ui.btn.save')}</button>
                        </div>
                        <div class="cyoa-section-body">
                            <textarea id="editRulesJudgment" class="cyoa-textarea" rows="2" placeholder="${t('ui.ph.judgeMethod')}">${escapeHtml(rules.judgment || '')}</textarea>
                            <textarea id="editRulesSuccess" class="cyoa-textarea" rows="2" placeholder="${t('ui.ph.successFail')}">${escapeHtml(rules.successFailure || '')}</textarea>
                            <textarea id="editRulesCustom" class="cyoa-textarea" rows="2" placeholder="${t('ui.ph.customRules')}">${escapeHtml(rules.custom || '')}</textarea>
                        </div>
                    </div>

                    <!-- 编辑表单容器 -->
                    <div id="editFormContainer" style="display:none;"></div>
                </div>
            `;
        },

        // 绑定事件
        attachEvents: function(modal) {
            // 保存所有按钮
            CYOA.$('modalSaveBtn').onclick = () => this.save(modal);
            CYOA.$('modalCancelBtn').onclick = modal.close;

            // 分节保存
            document.querySelectorAll('.save-section').forEach(btn => {
                btn.addEventListener('click', () => {
                    const section = btn.dataset.section;
                    this.saveSection(section);
                });
            });

            // 添加项目按钮
            document.querySelectorAll('.add-item').forEach(btn => {
                btn.addEventListener('click', () => {
                    if (!CYOA.editorTempData) {
                        alert(t('ui.msg.editorDataError'));
                        return;
                    }
                    const type = btn.dataset.type;
                    if (!CYOA.editorTempData[type]) CYOA.editorTempData[type] = [];
                    
                    let newItem;
                    switch(type) {
                        case 'attributes':
                            newItem = { id: CYOA.generateId(), name: t('ui.default.newAttr'), value: 10, min: 0, max: 100, description: '' };
                            break;
                        case 'items':
                            newItem = { id: CYOA.generateId(), name: t('ui.default.newItem'), itemType: 'common', quantity: 1, description: '', locked: false, durability: 0, unlockItemId: '', statModifiers: '', skills: [], consumeItems: [] };
                            break;
                        case 'equipment':
                            newItem = { id: CYOA.generateId(), name: t('ui.default.newEquip'), equipType: t('ui.default.equipType'), slots: [], description: '', locked: false, durability: 0, maxDurability: 0, unlockItemId: '', statModifiers: '', skills: [] };
                            break;
                        case 'professions':
                            newItem = { id: CYOA.generateId(), name: t('ui.default.newProf'), icon: '🎭', description: '', skills: [], statModifiers: '', traits: '' };
                            break;
                        case 'skills':
                            newItem = { id: CYOA.generateId(), name: t('ui.default.newSkill'), skillType: 'combat', description: '', effect: '', unlockType: 'auto', level: 1, proficiency: 0, requiredAttributes: {}, consumeItems: [], learned: false };
                            break;
                        case 'quests':
                            newItem = { id: CYOA.generateId(), name: t('ui.default.newQuest'), questType: 'side', description: '', objectives: [], rewards: [], status: 'locked', unlockCondition: '', progress: {}, started: false, completed: false };
                            break;
                        case 'characters':
                            newItem = { id: CYOA.generateId(), name: t('ui.default.newChar'), model: '', roleType: 'playable', professions: [], personality: [], hobbies: [], background: '', prompt: '', goal: '', skills: [] };
                            break;
                        case 'scenes':
                            newItem = { id: CYOA.generateId(), name: t('ui.default.newScene'), location: '', decoration: '', description: '', interactables: [], quests: [] };
                            break;
                        case 'chapters':
                            newItem = { id: CYOA.generateId(), title: t('ui.default.newChapter'), order: (CYOA.editorTempData.chapters?.length || 0) + 1, description: '', scenes: [], unlocked: true, unlockCondition: '', transitionConditions: [] };
                            break;
                        case 'storyCards':
                            const maxCards = CONFIG.STORY_CARD_MAX_PER_GAME || 20;
                            if ((CYOA.editorTempData.storyCards || []).length >= maxCards) {
                                alert(t('ui.msg.storyCardLimit', { max: maxCards }));
                                return;
                            }
                            newItem = { id: CYOA.generateId(), name: t('ui.default.newStoryCard'), type: 'custom', triggerWords: [], content: '' };
                            break;
                    }
                    
                    CYOA.editorTempData[type].push(newItem);
                    CYOA.refreshList(type);
                });
            });

            // 初始化列表事件
            ['attributes', 'items', 'equipment', 'professions', 'skills', 'quests', 'characters', 'scenes', 'storyCards'].forEach(type => {
                const container = CYOA.$(type + 'List');
                if (container) CYOA.bindListEvents(container, type);
            });
        },

        // 保存分节
        saveSection: function(section, silent = false) {
            if (!CYOA.editorTempData) {
                console.error('[CYOA] editorTempData 为 null');
                return;
            }
            
            switch(section) {
                case 'basic':
                    CYOA.editorTempData.name = CYOA.$('editName')?.value.trim() || CYOA.editorTempData.name || t('ui.status.unnamedGame');
                    CYOA.editorTempData.author = CYOA.$('editAuthor')?.value.trim() || '';
                    CYOA.editorTempData.version = CYOA.$('editVersion')?.value.trim() || '1.0.0';
                    CYOA.editorTempData.synopsis = CYOA.$('editSynopsis')?.value.trim() || '';
                    break;
                    
                case 'world':
                    const ruleTagInputs = Array.from(CYOA.$$('#editWorldRuleTags input[type=checkbox]') || []).filter((el) => el.checked);
                    const lexiconModeRaw = CYOA.$('editWorldLexiconMode')?.value || 'auto';
                    const lexiconMode = ['auto', 'modern', 'ancient'].includes(lexiconModeRaw) ? lexiconModeRaw : 'auto';
                    CYOA.editorTempData.worldSetting = {
                        background: CYOA.$('editWorldBackground')?.value.trim() || '',
                        geography: CYOA.$('editWorldGeography')?.value.trim() || '',
                        factions: CYOA.$('editWorldFactions')?.value.trim() || '',
                        socialStructure: CYOA.$('editWorldSocial')?.value.trim() || '',
                        history: CYOA.$('editWorldHistory')?.value.trim() || '',
                        custom: CYOA.$('editWorldCustom')?.value.trim() || '',
                        ruleTags: ruleTagInputs.map(el => el.value) || [],
                        lexiconMode: lexiconMode,
                        isFusionWorld: !!CYOA.$('editWorldIsFusion')?.checked
                    };
                    CYOA.editorTempData.humanityBalanceEnabled = !!CYOA.$('editHumanityBalance')?.checked;
                    break;
                    
                case 'mechanics':
                    CYOA.editorTempData.coreMechanics = {
                        type: CYOA.$('editMechanicsType')?.value || 'turn-based',
                        description: CYOA.$('editMechanicsDesc')?.value.trim() || '',
                        custom: CYOA.$('editMechanicsCustom')?.value.trim() || ''
                    };
                    break;
                    
                case 'narrator':
                    CYOA.editorTempData.narrator = {
                        enabled: true,
                        model: CYOA.$('narratorModel')?.value || '',
                        style: CYOA.$('narratorStyle')?.value || '情感细腻',
                        prompt: CYOA.$('narratorPrompt')?.value.trim() || CONFIG.DEFAULT_GAME.narrator.prompt
                    };
                    break;
                    
                case 'rules':
                    CYOA.editorTempData.rules = {
                        judgment: CYOA.$('editRulesJudgment')?.value.trim() || '',
                        successFailure: CYOA.$('editRulesSuccess')?.value.trim() || '',
                        custom: CYOA.$('editRulesCustom')?.value.trim() || ''
                    };
                    CYOA.editorTempData.initialScene = CYOA.$('editInitialScene')?.value.trim() || '';
                    CYOA.editorTempData.initialChapter = CYOA.$('editInitialChapter')?.value.trim() || '';
                    break;
            }
            
            if (!silent) alert(t('ui.msg.sectionSaved', {section}));
            log(`${section} 已保存:`, CYOA.editorTempData);
        },

        // 保存所有
        save: async function(modal) {
            if (!CYOA.editorTempData) {
                alert(t('ui.msg.noEditData'));
                modal.close();
                return;
            }
            
            this.saveSection('basic', true);
            this.saveSection('world', true);
            this.saveSection('mechanics', true);
            this.saveSection('narrator', true);
            this.saveSection('rules', true);
            
            CYOA.editorTempData.updatedAt = CYOA.getCurrentTimestamp();
            
            const success = await CYOA.saveGameToFile(CYOA.editorTempData);
            
            if (success) {
                alert(t('ui.msg.savedToFile'));
                modal.close();
                
                await CYOA.loadGamesList();
                const listContainer = CYOA.$('cyoaGameList');
                if (listContainer) {
                    renderGameListItems(listContainer);
                }
            } else {
                alert(t('ui.msg.saveFailed'));
            }
        }
    };
    CYOA.GameEditor = GameEditor;

    // ========== 设置面板渲染 ==========
    CYOA.renderSettings = function(container) {
        if (!container) {
            setTimeout(() => {
                const retryContainer = CYOA.$('pluginSettingsContent');
                if (retryContainer) CYOA.renderSettings(retryContainer);
            }, 500);
            return;
        }
        
        container.innerHTML = `
            <div class="cyoa-container" style="padding:20px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px;">
                    <div>
                        <h2 style="margin:0;">${t('ui.panel.gameLib')}</h2>
                        <p style="margin:4px 0 0; color:var(--text-light);">${t('ui.panel.gameLibDesc')}</p>
                    </div>
                    <div style="display:flex; gap:12px; align-items:center;">
                        <button class="cyoa-btn cyoa-btn-primary" id="cyoaNewGameBtn">${t('ui.btn.newGame')}</button>
                        <button class="cyoa-btn cyoa-btn-secondary" id="cyoaAIGenerateBtn" title="${t('ui.btn.aiGenerateGame')}">✨ ${t('ui.btn.aiGenerateGame')}</button>
                        <button class="cyoa-btn cyoa-btn-secondary" id="cyoaImportGameBtn">${t('ui.btn.importGame')}</button>
                        <button class="cyoa-btn cyoa-btn-secondary" id="cyoaWordFilterBtn" title="${t('ui.panel.wordFilter')}">${t('ui.btn.wordFilter')}</button>
                        ${CYOA.langSwitchHtml()}
                    </div>
                </div>
                <div id="cyoaGameList" class="cyoa-game-list"></div>
            </div>
        `;
        
        CYOA.$('cyoaNewGameBtn').onclick = () => GameEditor.open('new');
        CYOA.$('cyoaAIGenerateBtn').onclick = () => openAIGenerateModal(container);
        CYOA.$('cyoaImportGameBtn').onclick = () => CYOA.importGame(container);
        CYOA.$('cyoaWordFilterBtn').onclick = () => openWordFilterEditor();
        
        CYOA.loadGamesList().then(() => {
            renderGameListItems(CYOA.$('cyoaGameList'));
        });
    };

    function renderGameListItems(listContainer) {
        if (!listContainer) return;
        listContainer.innerHTML = '';
        
        if (CYOA.games.length === 0) {
            listContainer.innerHTML = `<div class="cyoa-empty-state">${t('ui.empty.noGames')}</div>`;
            return;
        }
        
        const countOf = (v) => {
            if (Array.isArray(v)) return v.length;
            if (typeof v === 'number' && Number.isFinite(v)) return v;
            return 0;
        };

        CYOA.games.forEach(game => {
            const item = document.createElement('div');
            item.className = 'cyoa-game-card';
            
            item.innerHTML = `
                <div class="cyoa-card-header">
                    <h3 class="cyoa-card-title">${escapeHtml(game.name)}</h3>
                    <span class="cyoa-badge cyoa-badge-primary">${countOf(game.characters)} ${t('ui.type.characters')}</span>
                </div>
                <div class="cyoa-card-meta">✍️ ${escapeHtml(game.author || t('ui.status.unknownAuthor'))} • v${game.version || '1.0'}</div>
                <div class="cyoa-card-stats" style="grid-template-columns:repeat(4,1fr);">
                    <div class="cyoa-stat"><span class="cyoa-stat-value">${countOf(game.attributes)}</span><span class="cyoa-stat-label">${t('ui.type.attributes')}</span></div>
                    <div class="cyoa-stat"><span class="cyoa-stat-value">${countOf(game.items)}</span><span class="cyoa-stat-label">${t('ui.type.items')}</span></div>
                    <div class="cyoa-stat"><span class="cyoa-stat-value">${countOf(game.skills)}</span><span class="cyoa-stat-label">${t('ui.type.skills')}</span></div>
                    <div class="cyoa-stat"><span class="cyoa-stat-value">${countOf(game.quests)}</span><span class="cyoa-stat-label">${t('ui.type.quests')}</span></div>
                </div>
                <div class="cyoa-card-actions">
                    <button class="cyoa-btn cyoa-btn-primary play-game" data-id="${game.id}">${t('ui.btn.start')}</button>
                    <button class="cyoa-btn cyoa-btn-secondary edit-game" data-id="${game.id}">✏️ ${t('ui.btn.edit')}</button>
                    <button class="cyoa-btn cyoa-btn-secondary export-game" data-id="${game.id}" title="${t('ui.btn.export')}">📤</button>
                    <button class="cyoa-btn cyoa-btn-danger delete-game" data-id="${game.id}" title="${t('ui.btn.delete')}">🗑️</button>
                </div>
            `;
            
            item.querySelector('.play-game').addEventListener('click', () => {
                CYOA.startGame(game.id);
            });
            
            item.querySelector('.edit-game').addEventListener('click', () => GameEditor.open(game.id));
            
            item.querySelector('.export-game').addEventListener('click', () => CYOA.exportGame(game.id));
            
            item.querySelector('.delete-game').addEventListener('click', async () => {
                if (confirm(t('ui.msg.confirmDeleteGame', {name: game.name}))) {
                    const success = await CYOA.deleteGameFile(game.id);
                    if (success) {
                        CYOA.games = CYOA.games.filter(g => g.id !== game.id);
                        renderGameListItems(listContainer);
                    }
                }
            });
            
            listContainer.appendChild(item);
        });
    }
    CYOA.renderGameListItems = renderGameListItems;

    // ========== AI 智能创建游戏 ==========
    function openAIGenerateModal(container) {
        const models = CYOA.getChatModels?.() || [];
        const modelOptions = models.map(m => `<option value="${escapeHtml(m.value)}">${escapeHtml(m.label)}</option>`).join('');
        const defaultModel = (typeof MainApp !== 'undefined' && MainApp.getModels) ? (MainApp.getModels('chat')?.[0]?.value || '') : (models[0]?.value || '');

        const contentHtml = `
            <div class="cyoa-ai-generate-form" style="padding:16px;">
                <div class="cyoa-form-row" style="margin-bottom:12px;">
                    <label style="display:block;margin-bottom:6px;">${t('ui.label.aiGenerateMode')}</label>
                    <div style="display:flex;gap:16px;">
                        <label class="cyoa-radio"><input type="radio" name="aiGenMode" value="creative" checked> ${t('ui.opt.aiModeCreative')}</label>
                        <label class="cyoa-radio"><input type="radio" name="aiGenMode" value="rules"> ${t('ui.opt.aiModeRules')}</label>
                    </div>
                </div>
                <div class="cyoa-form-row" style="margin-bottom:12px;">
                    <label id="aiGenInputLabel">${t('ui.label.aiGenerateIdea')}</label>
                    <textarea id="aiGenerateIdea" class="cyoa-textarea" rows="3" placeholder="${t('ui.ph.aiGenerateIdea')}" style="width:100%;resize:vertical;"></textarea>
                    <p id="aiGenModeHint" style="margin:4px 0 0;font-size:11px;color:var(--text-light);">${t('ui.hint.aiGenerateGame')}</p>
                </div>
                <div class="cyoa-form-row" style="margin-bottom:12px;">
                    <label>${t('ui.label.aiModel')}</label>
                    <select id="aiGenerateModel" class="cyoa-select" style="width:100%;">
                        <option value="">${t('ui.label.selectModel')}</option>
                        ${modelOptions}
                    </select>
                </div>
                <div id="aiGenerateStatus" style="font-size:12px;color:var(--text-light);margin-top:8px;min-height:20px;"></div>
            </div>
        `;
        const footerHtml = `
            <button class="cyoa-btn cyoa-btn-secondary" id="aiGenerateCancel">${t('ui.btn.cancel')}</button>
            <button class="cyoa-btn cyoa-btn-primary" id="aiGenerateBtn" disabled>✨ ${t('ui.btn.aiGenerate')}</button>
        `;

        const modal = CYOA.ModalSystem.open(t('ui.aiGenerate.title'), contentHtml, footerHtml, {
            icon: '✨',
            size: 'medium',
            closeOnOverlay: true
        });

        const ideaEl = CYOA.$('aiGenerateIdea');
        const modelEl = CYOA.$('aiGenerateModel');
        const statusEl = CYOA.$('aiGenerateStatus');
        const genBtn = CYOA.$('aiGenerateBtn');

        if (modelEl && defaultModel) {
            modelEl.value = defaultModel;
        }
        ideaEl?.addEventListener('input', () => {
            if (genBtn) genBtn.disabled = !(ideaEl?.value?.trim());
        });

        const modeCreative = document.querySelector('input[name="aiGenMode"][value="creative"]');
        const modeRules = document.querySelector('input[name="aiGenMode"][value="rules"]');
        const inputLabel = document.getElementById('aiGenInputLabel');
        const modeHint = document.getElementById('aiGenModeHint');
        const updateModeUI = () => {
            const isRules = modeRules?.checked;
            if (ideaEl) ideaEl.rows = isRules ? 10 : 3;
            if (ideaEl) ideaEl.placeholder = isRules ? (t('ui.ph.aiGenerateRules') || '粘贴完整规则说明书…') : t('ui.ph.aiGenerateIdea');
            if (inputLabel) inputLabel.textContent = isRules ? (t('ui.label.aiGenerateRules') || '规则说明书') : t('ui.label.aiGenerateIdea');
            if (modeHint) modeHint.textContent = isRules ? (t('ui.hint.aiGenerateRules') || '') : t('ui.hint.aiGenerateGame');
        };
        modeCreative?.addEventListener('change', updateModeUI);
        modeRules?.addEventListener('change', updateModeUI);

        CYOA.$('aiGenerateCancel').onclick = () => modal.close();
        genBtn.onclick = async () => {
            const idea = ideaEl?.value?.trim();
            const modelVal = modelEl?.value;
            const useRulesMode = modeRules?.checked || false;
            if (!idea) {
                alert(t('ui.msg.aiExpandEmpty'));
                return;
            }
            if (!modelVal) {
                alert(t('ui.msg.noSelectModel'));
                return;
            }
            genBtn.disabled = true;
            statusEl.textContent = t('ui.msg.aiGenerating') || 'AI 生成中，请稍候…';
            try {
                const gameData = await CYOA.generateGameWithAI(idea, modelVal, useRulesMode, (msg) => {
                    if (statusEl) statusEl.textContent = msg;
                });
                if (gameData) {
                    modal.close();
                    GameEditor.openWithData(gameData);
                    if (container) CYOA.renderSettings(container);
                } else {
                    statusEl.textContent = t('ui.msg.aiGenerateFailed') || '生成失败，请重试。';
                    genBtn.disabled = false;
                }
            } catch (e) {
                console.error('[CYOA] AI 生成失败', e);
                statusEl.textContent = (e.message || t('ui.msg.aiGenerateFailed')) + '';
                genBtn.disabled = false;
            }
        };
    }

    // ========== 敏感词过滤编辑器 ==========
    function openWordFilterEditor() {
        const defaults = CONFIG.DEFAULT_WORD_FILTER || [];
        let userList = [];
        try {
            const stored = localStorage.getItem(CONFIG.STORAGE_KEYS.WORD_FILTER);
            if (stored) userList = JSON.parse(stored);
        } catch (e) { userList = []; }
        if (!Array.isArray(userList)) userList = [];

        const merged = new Map();
        defaults.forEach(item => merged.set(item.sensitive, { safe: item.safe, source: 'default' }));
        userList.forEach(item => {
            if (item.sensitive && item.safe) merged.set(item.sensitive, { safe: item.safe, source: 'user' });
        });

        let rows = '';
        merged.forEach((val, key) => {
            const isUser = val.source === 'user';
            const badge = isUser ? `<span style="font-size:10px; color:#3b82f6;">${t('ui.status.custom')}</span>` : `<span style="font-size:10px; color:#9ca3af;">${t('ui.status.default')}</span>`;
            rows += `
                <tr data-source="${val.source}">
                    <td style="padding:6px 8px;">${badge}</td>
                    <td style="padding:6px 8px;"><input type="text" class="cyoa-input wf-sensitive" value="${escapeHtml(key)}" style="width:100%; height:28px; font-size:12px;"></td>
                    <td style="padding:6px 8px;"><input type="text" class="cyoa-input wf-safe" value="${escapeHtml(val.safe)}" style="width:100%; height:28px; font-size:12px;"></td>
                    <td style="padding:6px 4px; text-align:center;"><button class="cyoa-btn-icon danger wf-del" type="button" style="font-size:13px;">🗑️</button></td>
                </tr>`;
        });

        const content = `
            <div style="margin-bottom:12px; color:var(--text-light); font-size:13px;">
                ${t('ui.hint.filterDesc1')}<br>
                ${t('ui.hint.filterDesc2')}
            </div>
            <div style="max-height:400px; overflow-y:auto; border:1px solid var(--border); border-radius:var(--radius-sm);">
                <table style="width:100%; border-collapse:collapse; font-size:13px;" id="wfTable">
                    <thead style="background:var(--bg); position:sticky; top:0;">
                        <tr>
                            <th style="padding:8px; text-align:left; width:60px;">${t('ui.label.source')}</th>
                            <th style="padding:8px; text-align:left;">${t('ui.label.sensitiveWord')}</th>
                            <th style="padding:8px; text-align:left;">${t('ui.label.replacement')}</th>
                            <th style="padding:8px; width:40px;"></th>
                        </tr>
                    </thead>
                    <tbody id="wfBody">${rows}</tbody>
                </table>
            </div>
            <div style="margin-top:10px; display:flex; gap:8px;">
                <button class="cyoa-btn cyoa-btn-secondary cyoa-btn-sm" id="wfAddRow">${t('ui.btn.addEntry')}</button>
                <button class="cyoa-btn cyoa-btn-secondary cyoa-btn-sm" id="wfResetDefaults">${t('ui.btn.resetDefault')}</button>
                <button class="cyoa-btn cyoa-btn-secondary cyoa-btn-sm" id="wfExport">${t('ui.btn.exportFilter')}</button>
                <button class="cyoa-btn cyoa-btn-secondary cyoa-btn-sm" id="wfImport">${t('ui.btn.importFilter')}</button>
            </div>
        `;

        const footer = `
            <button class="cyoa-btn cyoa-btn-secondary" id="wfCancel">${t('ui.btn.cancel')}</button>
            <button class="cyoa-btn cyoa-btn-primary" id="wfSave">💾 ${t('ui.btn.save')}</button>
        `;

        const ModalSystem = CYOA.ModalSystem || window.CYOA_ModalSystem;
        if (!ModalSystem) {
            alert(t('ui.msg.modalNotLoaded'));
            return;
        }
        const modal = ModalSystem.open(t('ui.panel.wordFilter'), content, footer, { size: 'lg' });

        function bindDeleteBtns() {
            document.querySelectorAll('#wfBody .wf-del').forEach(btn => {
                btn.onclick = () => btn.closest('tr').remove();
            });
        }
        bindDeleteBtns();

        const addRowBtn = document.getElementById('wfAddRow');
        if (addRowBtn) addRowBtn.onclick = () => {
            const tbody = document.getElementById('wfBody');
            if (!tbody) return;
            const tr = document.createElement('tr');
            tr.dataset.source = 'user';
            tr.innerHTML = `
                <td style="padding:6px 8px;"><span style="font-size:10px; color:#3b82f6;">${t('ui.status.custom')}</span></td>
                <td style="padding:6px 8px;"><input type="text" class="cyoa-input wf-sensitive" value="" style="width:100%; height:28px; font-size:12px;" placeholder="${t('ui.ph.sensitiveWord')}"></td>
                <td style="padding:6px 8px;"><input type="text" class="cyoa-input wf-safe" value="" style="width:100%; height:28px; font-size:12px;" placeholder="${t('ui.ph.replacement')}"></td>
                <td style="padding:6px 4px; text-align:center;"><button class="cyoa-btn-icon danger wf-del" type="button" style="font-size:13px;">🗑️</button></td>
            `;
            tbody.appendChild(tr);
            bindDeleteBtns();
            tr.querySelector('.wf-sensitive').focus();
        };

        const resetBtn = document.getElementById('wfResetDefaults');
        if (resetBtn) resetBtn.onclick = () => {
            if (confirm(t('ui.msg.confirmResetFilter'))) {
                localStorage.removeItem(CONFIG.STORAGE_KEYS.WORD_FILTER);
                ModalSystem.close();
                openWordFilterEditor();
            }
        };

        const exportBtn = document.getElementById('wfExport');
        if (exportBtn) exportBtn.onclick = () => {
            const list = collectTableRows();
            const blob = new Blob([JSON.stringify(list, null, 2)], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'cyoa_word_filter.json';
            a.click();
        };

        const importBtn = document.getElementById('wfImport');
        if (importBtn) importBtn.onclick = () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            input.onchange = (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => {
                    try {
                        const imported = JSON.parse(ev.target.result);
                        if (!Array.isArray(imported)) { alert(t('ui.msg.invalidFilter')); return; }
                        CYOA.saveWordFilter(imported);
                        CYOA.invalidateRAG?.();
                        alert(t('ui.msg.importSuccess', {count: imported.length}));
                        ModalSystem.close();
                        openWordFilterEditor();
                    } catch (ex) { alert(t('ui.msg.parseFailed', {error: ex.message})); }
                };
                reader.readAsText(file);
            };
            input.click();
        };

        function collectTableRows() {
            const list = [];
            document.querySelectorAll('#wfBody tr').forEach(tr => {
                const s = tr.querySelector('.wf-sensitive')?.value.trim();
                const r = tr.querySelector('.wf-safe')?.value.trim();
                if (s && r) list.push({ sensitive: s, safe: r });
            });
            return list;
        }

        const saveBtn = document.getElementById('wfSave');
        if (saveBtn) saveBtn.onclick = () => {
            const list = collectTableRows();
            CYOA.saveWordFilter(list);
            CYOA.invalidateRAG?.();
            alert(t('ui.msg.filterSaved', {count: list.length}));
            ModalSystem.close();
        };

        const cancelBtn = document.getElementById('wfCancel');
        if (cancelBtn) cancelBtn.onclick = () => ModalSystem.close();
    }

    // ========== 导出游戏 ==========
    CYOA.exportGame = function(gameId) {
        const game = CYOA.games.find(g => g.id === gameId);
        if (!game) return;
        
        CYOA.loadGameFromFile(gameId).then(fullGame => {
            const blob = new Blob([JSON.stringify(fullGame, null, 2)], {type: 'application/json'});
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `cyoa_${game.name}_${gameId}.json`;
            a.click();
        });
    };

    // ========== 导入游戏 ==========
    CYOA.importGame = function(container) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = function(e) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = async function(ev) {
                try {
                    const game = JSON.parse(ev.target.result);
                    if (!game.id || !game.name) { 
                        alert(t('ui.msg.invalidGameFile')); 
                        return; 
                    }
                    
                    const existing = CYOA.games.find(g => g.id === game.id);
                    if (existing) {
                        game.id = 'game_' + CYOA.generateId();
                    }
                    
                    const success = await CYOA.saveGameToFile(game);
                    if (success) {
                        alert(t('ui.msg.importGameSuccess'));
                        await CYOA.loadGamesList();
                        CYOA.renderSettings(container);
                    }
                } catch (ex) { 
                    alert(t('ui.msg.parseFailed', {error: ex.message})); 
                }
            };
            reader.readAsText(file);
        };
        input.click();
    };

    // ========== 渲染侧边栏 ==========
    CYOA.renderSidebar = function() {
        if (!CYOA.currentGame || !CYOA.currentSave) return;
        
        const oldSidebar = document.getElementById('cyoa-sidebar-container');
        if (oldSidebar) oldSidebar.remove();
        
        const sidebarContainer = document.createElement('div');
        sidebarContainer.id = 'cyoa-sidebar-container';
        sidebarContainer.style.width = '320px';
        sidebarContainer.style.background = 'var(--bg-light)';
        sidebarContainer.style.borderLeft = '1px solid var(--border)';
        sidebarContainer.style.height = '100%';
        sidebarContainer.style.overflow = 'hidden';
        sidebarContainer.style.flexShrink = '0';
        
        // 纵向可折叠列表：各分区为独立折叠块
        if (!CYOA._sidebarAccordion) CYOA._sidebarAccordion = { tree: true, attributes: false, inventory: false, skills: false, quests: false, chapters: false, saves: false };
        const acc = CYOA._sidebarAccordion;
        const sections = [
            { tab: 'tree', label: t('ui.panel.storyTree'), defaultOpen: acc.tree },
            { tab: 'attributes', label: t('ui.panel.attributes'), defaultOpen: acc.attributes },
            { tab: 'inventory', label: t('ui.panel.inventory'), defaultOpen: acc.inventory },
            { tab: 'skills', label: t('ui.panel.skills'), defaultOpen: acc.skills },
            { tab: 'quests', label: t('ui.panel.quests'), defaultOpen: acc.quests },
            { tab: 'chapters', label: t('ui.panel.chapters'), defaultOpen: acc.chapters },
            { tab: 'saves', label: t('ui.panel.saves'), defaultOpen: acc.saves }
        ];
        let accordionHtml = '<div class="cyoa-sidebar" style="display:flex; flex-direction:column; height:100%; overflow:hidden;"><div class="cyoa-sidebar-accordion" style="flex:1; overflow-y:auto; padding:8px;">';
        sections.forEach(s => {
            const open = acc[s.tab];
            const chevron = open ? '▼' : '▶';
            accordionHtml += `
                <div class="cyoa-accordion-section" data-tab="${s.tab}" style="margin-bottom:4px;">
                    <div class="cyoa-accordion-header" data-tab="${s.tab}" style="display:flex; align-items:center; justify-content:space-between; padding:10px 12px; background:var(--bg); border:1px solid var(--border); border-radius:var(--radius-md); cursor:pointer; font-size:13px; font-weight:600; user-select:none;">
                        <span>${s.label}</span>
                        <span class="cyoa-accordion-chevron" style="font-size:11px; color:var(--text-light);">${chevron}</span>
                    </div>
                    <div class="cyoa-accordion-body" id="cyoa${s.tab.charAt(0).toUpperCase() + s.tab.slice(1)}Panel" style="display:${open ? 'block' : 'none'}; padding:10px 12px; background:var(--bg-light); border:1px solid var(--border); border-top:none; border-radius:0 0 var(--radius-md) var(--radius-md); max-height:280px; overflow-y:auto;"></div>
                </div>`;
        });
        accordionHtml += '</div></div>';
        sidebarContainer.innerHTML = accordionHtml;
        
        const appElement = document.querySelector('.app');
        if (appElement) {
            appElement.style.display = 'flex';
            appElement.style.flexDirection = 'row';
            
            const mainElement = document.querySelector('.main');
            if (mainElement) {
                mainElement.style.flex = '1';
                mainElement.style.display = 'flex';
                mainElement.style.flexDirection = 'column';
                appElement.appendChild(sidebarContainer);
            } else {
                appElement.appendChild(sidebarContainer);
            }
        } else {
            document.body.appendChild(sidebarContainer);
        }
        
        CYOA.renderTreePanel();
        CYOA.renderAttributesPanel();
        CYOA.renderInventoryPanel();
        CYOA.renderSkillsPanel();
        CYOA.renderQuestsPanel();
        CYOA.renderChaptersPanel();
        CYOA.renderSavesPanel();
        
        sidebarContainer.querySelectorAll('.cyoa-accordion-header').forEach(header => {
            header.addEventListener('click', (e) => {
                const tab = e.currentTarget.dataset.tab;
                if ((tab === 'inventory') && CYOA.currentSave && CYOA.getActiveConstraints?.()?.has('no_hands')) {
                    alert(t('ui.msg.handsRestricted'));
                    return;
                }
                const section = header.closest('.cyoa-accordion-section');
                const body = section?.querySelector('.cyoa-accordion-body');
                const chevron = header?.querySelector('.cyoa-accordion-chevron');
                const isOpen = body?.style.display !== 'none';
                CYOA._sidebarAccordion[tab] = !isOpen;
                if (body) body.style.display = isOpen ? 'none' : 'block';
                if (chevron) chevron.textContent = isOpen ? '▶' : '▼';
            });
        });
    };

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
    };

    // ========== 可折叠面板封装 ==========
    if (!CYOA._panelStates) CYOA._panelStates = {};
    function wrapCollapsible(id, title, content, defaultOpen) {
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
    }

    // ========== 牵引/姿势状态面板构建 ==========
    function buildTetherPosturePanel() {
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
            const t = save.tether;
            const tetherDef = (CONFIG.TETHER_TYPES || []).find(x => x.value === t.type);
            const chainDef = (CONFIG.TETHER_CHAIN_LENGTHS || []).find(x => x.value === t.chainLength);
            html += '<div style="background:linear-gradient(135deg,#fef2f2,#fee2e2); border:1px solid #fca5a5; border-radius:var(--radius-sm); padding:8px; margin-top:4px;">';
            html += `<div style="font-size:12px; font-weight:600; color:#dc2626; margin-bottom:4px;">${tetherDef?.label || CYOA.t('ui.sidebar.tethered')}</div>`;
            if (t.targetName) html += `<div style="font-size:11px; color:#7f1d1d;">${CYOA.t('ui.sidebar.target')} ${escapeHtml(t.targetName)}</div>`;
            if (chainDef) html += `<div style="font-size:11px; color:#7f1d1d;">${CYOA.t('ui.sidebar.chainLen')} ${chainDef.label}</div>`;
            if (t.sourceSlot) {
                const slotLabel = CONFIG.EQUIPMENT_SLOTS?.find(s => s.value === t.sourceSlot)?.label || t.sourceSlot;
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
    }

    // ========== 兴奋度状态面板构建 ==========
    function buildArousalPanel() {
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
    }

    // ========== 纪律状态面板 ==========
    function buildDisciplinePanel() {
        const save = CYOA.currentSave;
        const game = CYOA.currentGame;
        if (!save || !game) return '';
        const npcChars = game.characters?.filter(c => c.roleType !== 'playable' && (c.disciplineRules?.length > 0 || c.customRules?.length > 0)) || [];
        if (npcChars.length === 0) return '';

        const obAttr = save.attributes?.find(a => a.name === 'obedience');
        const fnAttr = save.attributes?.find(a => a.name === 'fondness');
        const recentV = (save.violations || []).slice(-5);

        let html = '';

        if (obAttr) {
            const obPct = Math.round((obAttr.value / (obAttr.max || 100)) * 100);
            const obColor = obPct >= 70 ? '#22c55e' : obPct >= 40 ? '#f59e0b' : '#ef4444';
            html += `<div style="margin-bottom:4px; font-size:11px;">${t('ui.sidebar.obedience')}<span style="color:${obColor}; font-weight:600;">${obAttr.value}/${obAttr.max || 100}</span></div>`;
        }
        if (fnAttr) {
            const fnPct = Math.round((fnAttr.value / (fnAttr.max || 100)) * 100);
            const fnColor = fnPct >= 70 ? '#ec4899' : fnPct >= 40 ? '#f59e0b' : '#94a3b8';
            html += `<div style="margin-bottom:6px; font-size:11px;">${t('ui.sidebar.affection')}<span style="color:${fnColor}; font-weight:600;">${fnAttr.value}/${fnAttr.max || 100}</span></div>`;
        }

        npcChars.forEach(npc => {
            html += `<div style="font-size:11px; color:var(--text-light); margin-bottom:2px;">[${escapeHtml(npc.name)}]</div>`;
            html += '<div style="display:flex; flex-wrap:wrap; gap:3px; margin-bottom:4px;">';
            (npc.disciplineRules || []).forEach(rv => {
                const rd = (CONFIG.DISCIPLINE_RULES || []).find(r => r.value === rv);
                if (!rd) return;
                const sevDef = CONFIG.DISCIPLINE_SEVERITY?.[rd.severity] || {};
                html += `<span style="font-size:10px; padding:1px 5px; background:${sevDef.color || '#666'}22; color:${sevDef.color || '#666'}; border-radius:3px; border:1px solid ${sevDef.color || '#666'}44;" title="${escapeHtml(rd.description)}">${escapeHtml(rd.label)}</span>`;
            });
            (npc.customRules || []).forEach(cr => {
                html += `<span style="font-size:10px; padding:1px 5px; background:#6366f122; color:#6366f1; border-radius:3px; border:1px solid #6366f144;" title="${escapeHtml(cr)}">${t('ui.sidebar.customBadge')}</span>`;
            });
            html += '</div>';
        });

        if (recentV.length > 0) {
            html += '<div style="font-size:10px; color:#ef4444; margin-top:4px;">' + t('ui.sidebar.recentViolation') + recentV.map(v => {
                const rd = (CONFIG.DISCIPLINE_RULES || []).find(r => r.value === v.rule);
                return escapeHtml(rd?.label || v.rule);
            }).join(', ') + '</div>';
        }

        return html;
    }

    // ========== RAG 知识库面板 ==========
    function buildRAGPanel() {
        const save = CYOA.currentSave;
        if (!save) return '<div style="color:#888;padding:6px">未开始游戏</div>';
        const ragText = save._ragCache || '';
        const ragTime = save._ragVersion ? new Date(save._ragVersion).toLocaleTimeString() : '--';
        const ragLen = ragText.length;

        const memCfg = CYOA.CONFIG?.MEMORY_CONFIG || {};
        const history = save.conversationHistory || [];
        const turns = Math.floor(history.length / 2);
        const summary = save.storySummary || '';
        const chSummaries = save.chapterSummaries || [];
        const keyEvents = save.keyEvents || [];

        let html = '<div style="padding:6px;font-size:12px;line-height:1.6">';
        html += `<div style="margin-bottom:6px">📦 <b>RAG缓存</b>：${ragLen > 0 ? ragLen + '字' : '<span style="color:#f44">未生成</span>'}`;
        if (ragLen > 0) html += ` <span style="color:#888">(${ragTime})</span>`;
        html += '</div>';

        html += `<div style="margin-bottom:6px">💬 <b>对话轮次</b>：${turns} / ${memCfg.recentTurns || 6}</div>`;
        html += `<div style="margin-bottom:6px">📝 <b>故事摘要</b>：${summary ? summary.length + '字' : '<span style="color:#888">无</span>'}</div>`;
        html += `<div style="margin-bottom:6px">📖 <b>章节摘要</b>：${chSummaries.length}条</div>`;
        html += `<div style="margin-bottom:8px">⭐ <b>关键事件</b>：${keyEvents.length}条</div>`;

        html += '<div style="display:flex;gap:6px">';
        html += '<button id="cyoa-rag-rebuild" class="cyoa-btn" style="flex:1;padding:4px 8px;font-size:11px">🔄 重建RAG</button>';
        html += '<button id="cyoa-rag-view" class="cyoa-btn" style="flex:1;padding:4px 8px;font-size:11px">👁️ 查看RAG</button>';
        html += '</div>';
        html += '</div>';
        return html;
    }

    // ========== 习惯度面板 ==========
    function buildHabituationPanel() {
        const save = CYOA.currentSave;
        if (!save) return '';
        const habEntries = Object.entries(save.habituation || {}).filter(([, v]) => v > 5);
        const withdrawals = save.withdrawalEffects || [];
        if (habEntries.length === 0 && withdrawals.length === 0) return '';

        let html = '';

        habEntries.sort((a, b) => b[1] - a[1]);
        habEntries.forEach(([cType, val]) => {
            const tier = CYOA.getHabituationTier(cType);
            const label = CYOA.getConstraintLabel?.(cType) || cType;
            const pct = Math.round((val / (CONFIG.HABITUATION_CONFIG?.maxLevel || 100)) * 100);
            const tierColors = { none: '#94a3b8', adjusting: '#3b82f6', familiar: '#22c55e', dependent: '#f59e0b', addicted: '#ef4444' };
            const barColor = tierColors[tier.value] || '#94a3b8';
            html += '<div style="margin-bottom:4px;">';
            html += `<div style="display:flex; justify-content:space-between; font-size:10px; margin-bottom:2px;"><span>${escapeHtml(label)}</span><span style="color:${barColor}; font-weight:600;">${tier.label} (${val})</span></div>`;
            html += `${progressBar(pct, barColor)}`;
            html += '</div>';
        });

        if (withdrawals.length > 0) {
            html += '<div style="margin-top:6px; border-top:1px solid var(--border); padding-top:6px;">';
            html += `<div style="font-size:11px; color:#ef4444; font-weight:600; margin-bottom:4px;">${t('ui.sidebar.withdrawal')}</div>`;
            withdrawals.forEach(w => {
                const label = CYOA.getConstraintLabel?.(w.constraintType) || w.constraintType;
                const sevColor = w.severity === 'severe' ? '#ef4444' : w.severity === 'moderate' ? '#f59e0b' : '#94a3b8';
                html += `<div style="font-size:10px; margin-bottom:2px; color:${sevColor};">`;
                html += `${escapeHtml(label)}（${w.severity}）- ${t('ui.sidebar.turnsLeft', {n: w.turnsRemaining})}`;
                html += '</div>';
            });
            html += '</div>';
        }

        // 姿势不适指示
        const posture = save.posture || 'standing';
        const pDur = save.postureDuration || 0;
        const dEff = CONFIG.DURATION_EFFECTS?.postureDiscomfort?.[posture];
        if (dEff && pDur >= dEff.startTurn) {
            const disc = Math.min(dEff.maxDiscomfort, (pDur - dEff.startTurn) * dEff.perTurn);
            if (disc > 0) {
                const discPct = Math.round((disc / dEff.maxDiscomfort) * 100);
                const discColor = discPct >= 70 ? '#ef4444' : discPct >= 40 ? '#f59e0b' : '#94a3b8';
                html += '<div style="margin-top:6px; border-top:1px solid var(--border); padding-top:6px;">';
                html += `<div style="font-size:11px; margin-bottom:2px;">${t('ui.sidebar.postureDiscomfort')} <span style="color:${discColor}; font-weight:600;">${disc}/${dEff.maxDiscomfort}</span> <span style="font-size:10px; color:var(--text-light);">(${pDur}轮)</span></div>`;
                html += `${progressBar(discPct, discColor)}`;
                html += '</div>';
            }
        }

        return html;
    }

    // ========== 综合状态面板 ==========
    function buildComprehensiveStatusPanel() {
        const save = CYOA.currentSave;
        if (!save) return '';
        let sections = [];

        // 羞耻面板
        const shameVal = save.shame || 0;
        if (shameVal > 5) {
            const tier = CYOA.getShameTier();
            const pct = Math.round((shameVal / (CONFIG.SHAME_CONFIG?.max || 100)) * 100);
            sections.push(`<div style="margin-bottom:6px;"><div style="display:flex; justify-content:space-between; font-size:11px; margin-bottom:2px;"><span>${t('ui.sidebar.shame')}</span><span style="color:${tier.color}; font-weight:600;">${tier.label} (${shameVal})</span></div>${progressBar(pct, tier.color)}</div>`);
        }

        // 口塞/口水面板
        const droolVal = save.drool || 0;
        const gagDef = CYOA.getActiveGagType?.();
        if (gagDef || droolVal > 5) {
            const droolCfg = CONFIG.DROOL_CONFIG || {};
            const droolPct = Math.round((droolVal / (droolCfg.maxDrool || 100)) * 100);
            let droolColor = '#94a3b8';
            let droolLabel = t('ui.sidebar.droolNormal');
            if (droolVal >= (droolCfg.heavyThreshold || 70)) { droolColor = '#ef4444'; droolLabel = t('ui.sidebar.droolHeavy'); }
            else if (droolVal >= (droolCfg.messThreshold || 30)) { droolColor = '#f59e0b'; droolLabel = t('ui.sidebar.droolStarting'); }
            else if (droolVal > 5) { droolColor = '#84cc16'; droolLabel = t('ui.sidebar.droolTrace'); }
            let gagHtml = '<div style="margin-bottom:6px;">';
            if (gagDef) {
                let tagHtml = '';
                if (gagDef.forcedOpen) tagHtml += ` <span style="color:#ef4444; font-weight:600;">${t('ui.sidebar.forcedOpen')}</span>`;
                if (gagDef.suppressDrool) tagHtml += ` <span style="color:#06b6d4; font-weight:600;">${t('ui.sidebar.droolDivert')}</span>`;
                gagHtml += `<div style="font-size:11px; margin-bottom:2px;">${escapeHtml(gagDef.label)}${tagHtml}</div>`;
            }
            if (gagDef?.suppressDrool) {
                gagHtml += `<div style="font-size:10px; color:#06b6d4; margin-bottom:1px;">${t('ui.sidebar.droolDivertActive')}</div>`;
            } else if (droolVal > 5) {
                gagHtml += `<div style="display:flex; justify-content:space-between; font-size:10px; margin-bottom:1px;"><span>${t('ui.sidebar.drool')}</span><span style="color:${droolColor};">${droolLabel}</span></div>`;
                gagHtml += `${progressBar(droolPct, droolColor, 3)}`;
            }
            gagHtml += '</div>';
            sections.push(gagHtml);
        }

        // 耳部装置面板
        const earDev = CYOA.getActiveEarDevice?.();
        if (earDev) {
            let modeColor = '#94a3b8';
            let modeLabel = earDev.modeLabel || earDev.mode;
            if (earDev.deaf && !earDev.hearController) modeColor = '#ef4444';
            else if (earDev.deaf && earDev.hearController) modeColor = '#f59e0b';
            else modeColor = '#22c55e';
            let earHtml = '<div style="margin-bottom:6px;">';
            earHtml += `<div style="font-size:11px; margin-bottom:2px;">${escapeHtml(earDev.label)} <span style="color:${modeColor}; font-weight:600;">[${escapeHtml(modeLabel)}]</span></div>`;
            earHtml += `<div style="font-size:9px; color:var(--text-light);">${escapeHtml(earDev.modeDesc || '')}</div>`;
            earHtml += '</div>';
            sections.push(earHtml);
        }

        // 手指约束面板
        const fingerDef = CYOA.getActiveFingerRestraint?.();
        if (fingerDef) {
            let fingerHtml = '<div style="margin-bottom:6px;">';
            fingerHtml += `<div style="font-size:11px; margin-bottom:2px;">${escapeHtml(fingerDef.label)} <span style="color:#f59e0b; font-weight:600;">[${escapeHtml(fingerDef.shapeLabel || fingerDef.shape)}]</span></div>`;
            fingerHtml += `<div style="font-size:9px; color:var(--text-light);">${escapeHtml(fingerDef.desc || '')}</div>`;
            fingerHtml += '</div>';
            sections.push(fingerHtml);
        }

        // 头颈约束面板
        const headR = CYOA.getActiveHeadRestrictions?.() || { canTurn: true, canNod: true };
        if (!headR.canTurn || !headR.canNod) {
            let headHtml = '<div style="margin-bottom:6px; font-size:11px;">';
            headHtml += `<div style="margin-bottom:2px;">${t('ui.sidebar.headNeck')}</div>`;
            const restrictions = [];
            if (!headR.canTurn) restrictions.push(`<span style="color:#ef4444;">${t('ui.sidebar.noTurn')}</span>`);
            if (!headR.canNod) restrictions.push(`<span style="color:#ef4444;">${t('ui.sidebar.noNod')}</span>`);
            headHtml += `<div style="font-size:10px;">${restrictions.join(' · ')}</div>`;
            headHtml += '</div>';
            sections.push(headHtml);
        }

        // 氧气面板
        const oxyVal = save.oxygen ?? 100;
        if (oxyVal < 95) {
            const tier = CYOA.getOxygenTier();
            const pct = Math.round(oxyVal);
            sections.push(`<div style="margin-bottom:6px;"><div style="display:flex; justify-content:space-between; font-size:11px; margin-bottom:2px;"><span>${t('ui.sidebar.oxygen')}</span><span style="color:${tier.color}; font-weight:600;">${tier.label} (${oxyVal})</span></div>${progressBar(pct, tier.color)}</div>`);
        }

        // 痛感面板
        const painVal = save.pain || 0;
        if (painVal > 0) {
            const painPct = Math.round((painVal / (CONFIG.IMPACT_CONFIG?.maxPain || 100)) * 100);
            const painColor = painPct >= 70 ? '#ef4444' : painPct >= 40 ? '#f59e0b' : '#94a3b8';
            sections.push(`<div style="margin-bottom:6px;"><div style="display:flex; justify-content:space-between; font-size:11px; margin-bottom:2px;"><span>${t('ui.sidebar.pain')}</span><span style="color:${painColor}; font-weight:600;">${painVal}/100</span></div>${progressBar(painPct, painColor)}</div>`);
        }

        // 痕迹
        if (save.marks?.length > 0) {
            let markHtml = `<div style="margin-bottom:6px;"><div style="font-size:11px; margin-bottom:3px;">${t('ui.sidebar.bodyMarks')}</div>`;
            save.marks.forEach(m => {
                const mDef = CONFIG.MARK_TYPES?.[m.type];
                const zDef = (CONFIG.IMPACT_ZONES || []).find(z => z.value === m.zone);
                markHtml += `<div style="font-size:10px; color:var(--text-light); padding-left:8px;">• ${escapeHtml(zDef?.label || m.zone)}：${escapeHtml(mDef?.label || m.type)}（${m.turnsRemaining}轮）</div>`;
            });
            markHtml += '</div>';
            sections.push(markHtml);
        }

        // 温度
        const activeTemps = Object.entries(save.bodyTemp || {}).filter(([, v]) => v !== 0);
        if (activeTemps.length > 0) {
            let tempHtml = `<div style="margin-bottom:6px;"><div style="font-size:11px; margin-bottom:3px;">${t('ui.sidebar.tempDev')}</div>`;
            activeTemps.forEach(([zone, temp]) => {
                const zDef = (CONFIG.TEMP_ZONES || []).find(z => z.value === zone);
                const tColor = temp > 0 ? '#ef4444' : '#3b82f6';
                const tLabel = temp > 0 ? `+${temp}°` : `${temp}°`;
                tempHtml += `<div style="font-size:10px; padding-left:8px; color:${tColor};">• ${escapeHtml(zDef?.label || zone)}：${tLabel}</div>`;
            });
            tempHtml += '</div>';
            sections.push(tempHtml);
        }

        // 困境束缚
        if (save.predicament) {
            const pred = save.predicament;
            const pDef = (CONFIG.PREDICAMENT_TYPES || []).find(p => p.value === pred.type);
            const predPct = Math.round((pred.painAccum / (CONFIG.PREDICAMENT_CONFIG?.maxPain || 100)) * 100);
            const predColor = predPct >= 70 ? '#ef4444' : predPct >= 40 ? '#f59e0b' : '#94a3b8';
            sections.push(`<div style="margin-bottom:6px;"><div style="font-size:11px; margin-bottom:2px;">${t('ui.sidebar.predicament')}${escapeHtml(pDef?.label || pred.type)}</div><div style="font-size:10px; color:var(--text-light); margin-bottom:2px;">${escapeHtml(pDef?.desc || '')}</div><div style="display:flex; justify-content:space-between; font-size:10px; margin-bottom:2px;"><span>${t('ui.sidebar.cumPain')}</span><span style="color:${predColor};">${pred.painAccum}/100</span></div>${progressBar(predPct, predColor, 3)}<div style="font-size:10px; color:var(--text-light);">${t('ui.sidebar.duration', {n: pred.turnsActive})}</div></div>`);
        }

        // 训练进度
        const trainEntries = Object.entries(save.trainings || {}).filter(([, v]) => v.level > 0);
        if (trainEntries.length > 0) {
            let trainHtml = `<div style="margin-bottom:6px;"><div style="font-size:11px; margin-bottom:3px;">${t('ui.sidebar.training')}</div>`;
            trainEntries.forEach(([type, data]) => {
                const tDef = (CONFIG.TRAINING_TYPES || []).find(t => t.value === type);
                const lvLabel = CONFIG.TRAINING_LEVEL_LABELS?.[data.level] || data.level;
                const progPct = data.progress;
                trainHtml += `<div style="font-size:10px; display:flex; justify-content:space-between; padding-left:8px; margin-bottom:1px;"><span>${escapeHtml(tDef?.label || type)}</span><span>Lv.${data.level}(${lvLabel}) ${progPct}%</span></div>`;
            });
            trainHtml += '</div>';
            sections.push(trainHtml);
        }

        // 感官剥夺
        const depLevel = CYOA.getDeprivationLevel?.();
        if (depLevel) {
            const depDur = save.deprivationDuration || 0;
            sections.push(`<div style="margin-bottom:6px;"><div style="font-size:11px; color:#7c3aed; font-weight:600;">🕳️ ${escapeHtml(depLevel.label)}</div><div style="font-size:10px; color:var(--text-light);">${escapeHtml(depLevel.desc)} (${depDur}轮)</div></div>`);
        }
        if ((save.sensoryOverload || 0) > 0) {
            sections.push(`<div style="margin-bottom:6px; font-size:11px; color:#ef4444; font-weight:600;">${t('ui.sidebar.sensoryOverload')}（${save.sensoryOverload}轮）</div>`);
        }

        // 乳胶封闭（含层叠、紧度、护理、汗液、颜色、开口）
        if ((save.latexCoverage || 0) > 10) {
            const covTier = CYOA.getLatexCoverageTier?.();
            const heatTier = CYOA.getLatexHeatTier?.();
            const heatVal = save.latexHeat || 0;
            const heatPct = Math.round((heatVal / (CONFIG.LATEX_ENCLOSURE_CONFIG?.maxHeat || 50)) * 100);
            let lxHtml = '<div style="margin-bottom:6px;">';
            // 颜色标识
            let colorLabel = '';
            if (save.latexColor) {
                const colorDef = (CONFIG.LATEX_COLORS || []).find(c => c.value === save.latexColor);
                if (colorDef) colorLabel = ` <span style="color:${colorDef.colorHex}; font-weight:600;">${colorDef.label}</span>`;
            }
            lxHtml += `<div style="display:flex; justify-content:space-between; font-size:11px; margin-bottom:2px;"><span>${t('ui.sidebar.latex')} ${save.latexCoverage}%（${covTier?.label || ''}）${(save.latexLayers || 0) > 1 ? ' ×' + save.latexLayers + '层' : ''}${colorLabel}</span><span style="color:${heatTier?.color || '#94a3b8'}; font-weight:600;">${heatTier?.label || ''}</span></div>`;
            lxHtml += `${progressBar(heatPct, heatTier?.color || '#94a3b8')}`;
            // 汗液条
            if ((save.latexSweat || 0) > 10) {
                const swTier = CYOA.getLatexSweatTier?.() || {};
                const swPct = Math.round(((save.latexSweat || 0) / (CONFIG.LATEX_SWEAT_CONFIG?.maxSweat || 100)) * 100);
                lxHtml += `<div style="display:flex; justify-content:space-between; font-size:10px; margin-top:2px;"><span>${t('ui.sidebar.sweat')}</span><span style="color:${swTier.color || '#94a3b8'};">${swTier.label || ''} (${save.latexSweat})</span></div>`;
                lxHtml += `${progressBar(swPct, swTier.color || '#94a3b8', 3)}`;
            }
            // 自紧度
            if ((save.latexTightness || 0) > 10) {
                const tTier = CYOA.getTightnessTier?.() || {};
                const tPct = Math.round(((save.latexTightness || 0) / (CONFIG.LATEX_TIGHTENING_CONFIG?.maxTightness || 100)) * 100);
                lxHtml += `<div style="display:flex; justify-content:space-between; font-size:10px; margin-top:2px;"><span>${t('ui.sidebar.tightness')}</span><span style="color:${tTier.color || '#94a3b8'};">${tTier.label || ''} (${save.latexTightness})</span></div>`;
                lxHtml += `${progressBar(tPct, tTier.color || '#94a3b8', 3)}`;
            }
            // 护理状态
            const cond = save.latexCondition ?? 100;
            if (cond < 80) {
                const condPct = Math.round(cond);
                const condColor = cond < 25 ? '#ef4444' : cond < 50 ? '#f59e0b' : '#94a3b8';
                lxHtml += `<div style="display:flex; justify-content:space-between; font-size:10px; margin-top:2px;"><span>${t('ui.sidebar.maintenance')}</span><span style="color:${condColor};">${cond}/100</span></div>`;
                lxHtml += `${progressBar(condPct, condColor, 3)}`;
            }
            // 开口状态
            const openings = save.latexOpenings || {};
            const openEntries = Object.entries(openings);
            if (openEntries.length > 0) {
                const openLabels = openEntries.map(([type, state]) => {
                    const oDef = (CONFIG.LATEX_OPENING_TYPES || []).find(o => o.value === type);
                    const sDef = (CONFIG.LATEX_OPENING_STATES || {})[state];
                    const stateIcon = state === 'open' ? '🔓' : state === 'locked' ? '🔒' : '🔗';
                    return `${stateIcon}${oDef?.label?.replace(/^.+\s/, '') || type}`;
                });
                lxHtml += `<div style="font-size:10px; margin-top:2px; color:var(--text-light);">${t('ui.sidebar.zipper')} ${openLabels.join(' ')}</div>`;
            }
            lxHtml += '</div>';
            sections.push(lxHtml);
        }

        // 身份侵蚀
        if ((save.identityErosion || 0) > 10) {
            const idTier = CYOA.getIdentityTier?.() || {};
            const idPct = Math.round(((save.identityErosion || 0) / (CONFIG.IDENTITY_EROSION_CONFIG?.maxErosion || 100)) * 100);
            const idColors = { human: '#22c55e', slipping: '#84cc16', fading: '#eab308', doll: '#f97316', object: '#7c3aed' };
            const idColor = idColors[idTier.value] || '#94a3b8';
            let idHtml = '<div style="margin-bottom:6px;">';
            idHtml += `<div style="display:flex; justify-content:space-between; font-size:11px; margin-bottom:2px;"><span>${t('ui.sidebar.identity')}</span><span style="color:${idColor}; font-weight:600;">${idTier.label || ''} (${save.identityErosion})</span></div>`;
            idHtml += `${progressBar(idPct, idColor)}`;
            idHtml += `<div style="font-size:10px; color:var(--text-light);">${escapeHtml(idTier.desc || '')}</div>`;
            idHtml += '</div>';
            sections.push(idHtml);
        }

        // 恐慌
        if ((save.panic || 0) > 15) {
            const pTier = CYOA.getPanicTier?.() || {};
            const pPct = Math.round(((save.panic || 0) / (CONFIG.PANIC_CONFIG?.maxPanic || 100)) * 100);
            let pHtml = '<div style="margin-bottom:6px;">';
            pHtml += `<div style="display:flex; justify-content:space-between; font-size:11px; margin-bottom:2px;"><span>${t('ui.sidebar.panic')}</span><span style="color:${pTier.color || '#94a3b8'}; font-weight:600;">${pTier.label || ''} (${save.panic})</span></div>`;
            pHtml += `${progressBar(pPct, pTier.color || '#94a3b8')}`;
            pHtml += `<div style="font-size:10px; color:var(--text-light);">${escapeHtml(pTier.desc || '')}</div>`;
            pHtml += '</div>';
            sections.push(pHtml);
        }

        // 呼吸管
        const tube = save.breathingTube;
        if (tube?.active) {
            const levels = CONFIG.BREATHING_TUBE_CONFIG?.flowLevels || {};
            const lv = levels[tube.flowLevel] || {};
            const tubeColors = { full: '#22c55e', restricted: '#eab308', minimal: '#f97316', blocked: '#ef4444' };
            sections.push(`<div style="margin-bottom:6px;"><div style="font-size:11px;">${t('ui.sidebar.breathTube')}<span style="color:${tubeColors[tube.flowLevel] || '#94a3b8'}; font-weight:600;">${lv.label || tube.flowLevel}</span></div><div style="font-size:10px; color:var(--text-light);">${escapeHtml(lv.desc || '')}</div></div>`);
        }

        // 导电乳胶
        const electro = save.electroLatex;
        if (electro?.active && electro.zones?.length > 0) {
            const eCfg = CONFIG.ELECTRO_LATEX_CONFIG || {};
            let elHtml = `<div style="margin-bottom:6px;"><div style="font-size:11px; margin-bottom:3px;">${t('ui.sidebar.electroLatex')}</div>`;
            electro.zones.forEach(z => {
                const zoneDef = (eCfg.zones || []).find(zd => zd.value === z.zone);
                const intDef = (eCfg.intensityLevels || []).find(i => i.value === z.intensity);
                const intColors = { tingle: '#84cc16', pulse: '#eab308', strong: '#f97316', max: '#ef4444' };
                elHtml += `<div style="font-size:10px; padding-left:8px; display:flex; justify-content:space-between;"><span>${escapeHtml(zoneDef?.label || z.zone)}</span><span style="color:${intColors[z.intensity] || '#94a3b8'};">${escapeHtml(intDef?.label || z.intensity)}</span></div>`;
            });
            elHtml += '</div>';
            sections.push(elHtml);
        }

        // 充气装置
        const infEntries = Object.entries(save.inflationLevels || {}).filter(([, v]) => v > 0);
        if (infEntries.length > 0) {
            let infHtml = `<div style="margin-bottom:6px;"><div style="font-size:11px; margin-bottom:3px;">${t('ui.sidebar.inflation')}</div>`;
            infEntries.forEach(([devId, lv]) => {
                const dDef = (CONFIG.VACUUM_INFLATION_TYPES || []).find(d => d.value === devId);
                const pct = Math.round((lv / 5) * 100);
                infHtml += `<div style="font-size:10px; display:flex; justify-content:space-between; padding-left:8px;"><span>${escapeHtml(dDef?.label || devId)}</span><span>Lv.${lv}/5</span></div>`;
                infHtml += `<div style="height:3px; background:var(--border); border-radius:2px; overflow:hidden; margin:1px 0 2px 8px;"><div style="height:100%; width:${pct}%; background:#e879f9; border-radius:2px;"></div></div>`;
            });
            infHtml += '</div>';
            sections.push(infHtml);
        }

        // PetPlay / PonyPlay
        if (save.petplayRole) {
            const rDef = (CONFIG.PETPLAY_ROLES || []).find(r => r.value === save.petplayRole);
            const immTier = CYOA.getPetplayImmersionTier?.();
            const immPct = Math.round(((save.petplayImmersion || 0) / (CONFIG.PETPLAY_CONFIG?.maxImmersion || 100)) * 100);
            const immColors = { resistant: '#94a3b8', awkward: '#eab308', adapting: '#22c55e', immersed: '#3b82f6', deep: '#7c3aed' };
            const immColor = immColors[immTier?.value] || '#94a3b8';
            let petHtml = '<div style="margin-bottom:6px;">';
            petHtml += `<div style="display:flex; justify-content:space-between; font-size:11px; margin-bottom:2px;"><span>🐾 ${escapeHtml(rDef?.label || save.petplayRole)}</span><span style="color:${immColor}; font-weight:600;">${immTier?.label || ''} (${save.petplayImmersion || 0})</span></div>`;
            petHtml += `${progressBar(immPct, immColor)}`;
            petHtml += '</div>';
            sections.push(petHtml);
        }

        // 家具化
        if (save.furnitureRole) {
            const fDef = (CONFIG.FURNITURE_ROLES || []).find(f => f.value === save.furnitureRole);
            const cfg = CONFIG.FURNITURE_CONFIG || {};
            const endPct = Math.round(((save.furnitureEndurance || 0) / (cfg.maxEndurance || 100)) * 100);
            const endColor = endPct >= 70 ? '#ef4444' : endPct >= 40 ? '#f59e0b' : '#94a3b8';
            let furHtml = '<div style="margin-bottom:6px;">';
            furHtml += `<div style="display:flex; justify-content:space-between; font-size:11px; margin-bottom:2px;"><span>🪑 ${escapeHtml(fDef?.label || save.furnitureRole)}</span><span style="color:${endColor}; font-weight:600;">${t('ui.sidebar.stamina')} ${endPct}%</span></div>`;
            furHtml += `${progressBar(endPct, endColor)}`;
            if (endPct >= 70) furHtml += `<div style="font-size:10px; color:#ef4444;">${t('ui.sidebar.trembling')}</div>`;
            furHtml += '</div>';
            sections.push(furHtml);
        }

        // 步态 / 姿势限制
        const gait = CYOA.getCurrentGait?.();
        if (gait && gait.value !== 'normal') {
            const gaitColors = { careful: '#84cc16', mincing: '#eab308', hobbling: '#f97316', tottering: '#f97316', helpless: '#ef4444', immobile: '#7c3aed' };
            const gColor = gaitColors[gait.value] || '#94a3b8';
            let gaitHtml = '<div style="margin-bottom:6px;">';
            gaitHtml += `<div style="display:flex; justify-content:space-between; font-size:11px; margin-bottom:2px;"><span>${t('ui.sidebar.gait')}</span><span style="color:${gColor}; font-weight:600;">${gait.label}</span></div>`;
            gaitHtml += `<div style="font-size:10px; color:var(--text-light);">${escapeHtml(gait.desc)} 速度×${gait.speedMod}</div>`;
            if (gait.fallChance > 0) {
                gaitHtml += `<div style="font-size:10px; color:#ef4444;">${t('ui.sidebar.fallRisk')} ${Math.round(gait.fallChance * 100)}%/轮</div>`;
            }
            const blocked = save.blockedPostures || [];
            if (blocked.length > 0) {
                const allP = CONFIG.POSTURES || [];
                const blockedLabels = blocked.map(bv => allP.find(p => p.value === bv)?.label || bv);
                gaitHtml += `<div style="font-size:10px; color:var(--text-light); margin-top:2px;">🚫 ${blockedLabels.join('、')}</div>`;
            }
            const tags = save.activePostureTags || [];
            if (tags.length > 0) {
                const tagDefs = CONFIG.EQUIP_POSTURE_TAGS || [];
                const tagLabels = tags.map(tv => tagDefs.find(td => td.value === tv)?.label || tv);
                gaitHtml += `<div style="font-size:10px; color:var(--text-light); margin-top:2px; display:flex; flex-wrap:wrap; gap:3px;">`;
                tagLabels.forEach(tl => { gaitHtml += `<span style="background:var(--border); padding:1px 5px; border-radius:8px; font-size:9px;">${escapeHtml(tl)}</span>`; });
                gaitHtml += '</div>';
            }
            gaitHtml += '</div>';
            sections.push(gaitHtml);
        }

        if (sections.length === 0) return '';
        return sections.join('');
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
        html += wrapCollapsible('panel_tether', t('ui.sidebar.postureTether'), buildTetherPosturePanel(), false);

        // 兴奋度状态面板
        html += wrapCollapsible('panel_arousal', t('ui.sidebar.arousal'), buildArousalPanel(), false);

        // 纪律 + 习惯度面板
        html += wrapCollapsible('panel_discipline', t('ui.sidebar.discipline'), buildDisciplinePanel(), false);
        html += wrapCollapsible('panel_habituation', t('ui.sidebar.habituation'), buildHabituationPanel(), false);

        // 综合状态面板（羞耻/氧气/痛感/温度/困境/训练/感官剥夺）
        html += wrapCollapsible('panel_status', t('ui.sidebar.bodyStatus'), buildComprehensiveStatusPanel(), false);

        // 装备栏
        let equipContent = '';
        const equipped = CYOA.currentSave.equipment || {};
        if (Object.keys(equipped).length === 0) {
            equipContent += `<div class="cyoa-empty-state">${t('ui.empty.noEquipped')}</div>`;
        } else {
            equipContent += '<div style="display: grid; gap: 8px;">';
            Object.entries(equipped).forEach(([slot, item]) => {
                const slotLabel = CONFIG.EQUIPMENT_SLOTS.find(s => s.value === slot)?.label || slot;
                const equipDef = CYOA.currentGame?.equipment?.find(e => e.id === item.id);
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
                            <div style="font-size: 11px; color: var(--text-light);">${slotLabel}</div>
                            ${!isIndestructible && maxDura > 0 ? `
                                <div style="margin-top:3px;">
                                    <div style="display:flex; justify-content:space-between; font-size:10px; color:var(--text-light); margin-bottom:1px;">
                                        <span>${t('ui.sidebar.dur')}</span><span>${curDura}/${maxDura} (${duraPct}%)</span>
                                    </div>
                                    ${progressBar(duraPct, duraColor)}
                                </div>
                            ` : ''}
                            ${(() => {
                                const cList = item.constraints || equipDef?.constraints;
                                let extraInfo = '';
                                if (Array.isArray(cList) && cList.includes('limited_step')) {
                                    const cm = item._degradedStepLimitCm ?? item.stepLimitCm ?? equipDef?.stepLimitCm ?? (CONFIG.LIMITED_STEP_DEFAULTS?.stepLimitCm || 20);
                                    const pct = item._degradedSpeedModifierPct ?? item.speedModifierPct ?? equipDef?.speedModifierPct ?? (CONFIG.LIMITED_STEP_DEFAULTS?.speedModifierPct || -50);
                                    const pctStr = pct >= 0 ? '+' + pct + '%' : pct + '%';
                                    extraInfo += '<div style="font-size: 11px; color: #f59e0b;">' + t('ui.sidebar.stepLimit') + ' ' + cm + 'cm / 速度' + pctStr;
                                    if (item._degradedStepLimitCm !== undefined) extraInfo += ' <span style="color:#22c55e;">' + t('ui.status.degraded') + '</span>';
                                    extraInfo += '</div>';
                                }
                                const hasBlindConstraint = Array.isArray(cList) && cList.includes('blind');
                                const vAttachments = (item.attachments || equipDef?.attachments || []);
                                const vAtt = vAttachments.find(a => a.type === 'vision_modifier' && a.visionType);
                                if (hasBlindConstraint || vAtt) {
                                    const vLabel = vAtt ? (CYOA.getVisionTypeLabel?.(vAtt.visionType) || vAtt.visionType) : t('ui.sidebar.fullBlind');
                                    const colorHex = (vAtt && vAtt.visionType !== 'full_blind') ? '#f59e0b' : '#8b5cf6';
                                    extraInfo += '<div style="font-size: 11px; color: ' + colorHex + ';">' + t('ui.sidebar.vision') + ' ' + CYOA.escapeHtml(vLabel) + '</div>';
                                }
                                const atts = item.attachments || equipDef?.attachments || [];
                                if (atts.length) {
                                    const attNames = atts.map(a => {
                                        let name = CYOA.escapeHtml(a.name || t('ui.status.unnamed'));
                                        if (a.type === 'd_ring') {
                                            const posLabel = (CONFIG.D_RING_POSITIONS || []).find(p => p.value === a.dRingPosition)?.label || '';
                                            name = '🔗' + name + (posLabel ? '(' + posLabel + ')' : '');
                                        }
                                        return name;
                                    }).join(', ');
                                    extraInfo += '<div style="font-size: 11px; color: #6b7280;">' + t('ui.sidebar.attachments') + ' ' + attNames + '</div>';
                                }
                                return extraInfo;
                            })()}
                        </div>
                        <div style="display:flex; flex-direction:column; gap:3px; align-items:center;">
                            ${lockLv >= 1 && lockLv < 5 ? `<button class="cyoa-btn-icon" onclick="CYOA.handleStruggle('${escapeHtml(slot)}')" title="${t('ui.btn.struggle')}" style="font-size:16px;">✊</button>` : ''}
                            <button class="cyoa-btn-icon" onclick="CYOA.unequipItem('${escapeHtml(slot)}')" title="${t('ui.btn.unequip')}">⬇️</button>
                        </div>
                    </div>
                `;
            });
            equipContent += '</div>';
        }
        const equipCount = Object.keys(equipped).length;
        html += wrapCollapsible('panel_equip', t('ui.sidebar.equippedN', {n: equipCount}), equipContent, false);
        
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
        html += wrapCollapsible('panel_bag', t('ui.sidebar.inventoryN', {n: bagCount}), bagContent, false);

        // RAG + AI记忆面板
        html += wrapCollapsible('panel_rag', '📚 AI知识库', buildRAGPanel(), false);

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
    };

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

    // ========== 渲染章节面板 ==========
    function renderConditionLabel(cond, game) {
        switch (cond.type) {
            case 'quest_complete': {
                const q = (game.quests || []).find(q => q.id === cond.questId);
                return t('ui.cond.questComplete', {name: q?.name || cond.questId});
            }
            case 'has_item': {
                const it = (game.items || []).find(i => i.id === cond.itemId);
                return t('ui.cond.hasItem', {name: it?.name || cond.itemId, qty: cond.quantity || 1});
            }
            case 'attribute_check':
                return t('ui.cond.attrCheck', {attr: cond.attribute, op: cond.operator, val: cond.value});
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
                if (cur.order) html += `<div style="font-size: 12px; color: var(--text-light); margin-top:2px;">${t('ui.status.chapterN', {n: cur.order})}</div>`;
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
                if (chapter.order) html += `<span style="font-size:10px; color:var(--text-light);">${t('ui.status.chapterN', {n: chapter.order})}</span>`;
                html += badge;
                html += `</div>`;
                html += `<div style="font-size:10px; color:var(--text-light); margin-top:3px;">📄 ${t('ui.status.nScenes', {n: sceneCount})}</div>`;
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

    // ========== 插件注册 ==========
    const _t = typeof t === 'function' ? t : function(k) { return k; };

    function registerPlugin() {
        if (typeof MainApp !== 'undefined' && MainApp.registerPlugin) {
            MainApp.registerPlugin({
                id: 'cyoa_v2',
                name: 'CYOA 文字冒险游戏',
                version: '2.1.0',
                description: '创建并游玩你自己的 Choose Your Own Adventure 游戏',
                author: 'Ada Chat Team',
                settings: true,
                hooks: ['beforeSend'],
                beforeSend: () => {
                    if (CYOA.currentSave && CYOA.currentGame) {
                        const logEl = document.getElementById('log');
                        if (logEl) {
                            const lastChild = logEl.lastElementChild;
                            if (lastChild && lastChild.classList.contains('streaming') && !lastChild.textContent) {
                                lastChild.remove();
                            }
                        }
                        return false;
                    }
                    return true;
                },
                renderSettings: CYOA.renderSettings,
                onload: function() {
                    log('[CYOA] plugin loaded');
                    CYOA.loadGamesList();
                }
            });
            log('[CYOA] plugin registered');
        } else {
            setTimeout(registerPlugin, 500);
        }
    }

    CYOA._onLangChange = function() {
        const settingsEl = CYOA.$('pluginSettingsContent');
        if (settingsEl) CYOA.renderSettings(settingsEl);
        if (CYOA.currentSave && CYOA.currentGame) {
            const sidebar = document.getElementById('cyoaSidebarContainer');
            if (sidebar) CYOA.renderSidebar();
        }
    };

    registerPlugin();

    log('[CYOA] main module loaded');
})();