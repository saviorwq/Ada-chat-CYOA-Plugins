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
            const travelRules = data.travelRules || {};
            const rules = data.rules || {};
            const narrator = data.narrator || CONFIG.DEFAULT_GAME.narrator;
            const axiomLines = Array.isArray(data.axioms)
                ? data.axioms.map(x => String(x || '').trim()).filter(Boolean).join('\n')
                : '';
            
            const models = CYOA.getChatModels();
            const narratorModel = String(narrator.model || '').trim();
            const narratorStyle = String(narrator.style || '').trim();
            const modelValues = new Set(models.map(m => String(m.value || '').trim()).filter(Boolean));
            const baseModelOptions = models.map(m => `<option value="${m.value}" ${m.value === narratorModel ? 'selected' : ''}>${m.label}</option>`).join('');
            const modelOptions = (!modelValues.has(narratorModel) && narratorModel)
                ? `${baseModelOptions}<option value="${escapeHtml(narratorModel)}" selected>${escapeHtml(narratorModel)}（当前值）</option>`
                : baseModelOptions;
            const styleValues = new Set((CONFIG.NARRATOR_STYLES || []).map(s => String(s)));
            const baseStyleOptions = (CONFIG.NARRATOR_STYLES || []).map(s => `<option value="${s}" ${s === narratorStyle ? 'selected' : ''}>${s}</option>`).join('');
            const styleOptions = (!styleValues.has(narratorStyle) && narratorStyle)
                ? `${baseStyleOptions}<option value="${escapeHtml(narratorStyle)}" selected>${escapeHtml(narratorStyle)}（当前值）</option>`
                : baseStyleOptions;

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
                            <div style="display:flex; gap:6px; align-items:center;">
                                <button type="button" class="cyoa-btn cyoa-btn-secondary cyoa-btn-sm" id="addWorldEntryBtn">+ 新增条目</button>
                                <button class="cyoa-btn cyoa-btn-primary cyoa-btn-sm save-section" data-section="world">💾 ${t('ui.btn.save')}</button>
                            </div>
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
                            <div style="display:flex; gap:6px; align-items:center;">
                                <button type="button" class="cyoa-btn cyoa-btn-secondary cyoa-btn-sm" id="addMechanicsEntryBtn">+ 新增条目</button>
                                <button class="cyoa-btn cyoa-btn-primary cyoa-btn-sm save-section" data-section="mechanics">💾 ${t('ui.btn.save')}</button>
                            </div>
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
                            <div class="cyoa-grid-2">
                                <div>
                                    <label>受限移动额外回合（默认）</label>
                                    <input type="number" id="editTravelLimitedExtraTurns" class="cyoa-input" min="0" value="${Number.isFinite(Number(travelRules.limitedStepExtraTurns)) ? Number(travelRules.limitedStepExtraTurns) : Number(CYOA.CONFIG?.LOCATION_DEFAULTS?.limitedStepExtraTurns ?? 2)}">
                                    <small style="color:var(--text-light);">当角色处于“限步/移动受限”状态时，每次旅行额外增加回合数（边可单独覆盖）。</small>
                                </div>
                                <div>
                                    <label>地点边回合格式</label>
                                    <div style="font-size:12px; color:var(--text-light); padding-top:6px;">地点ID:基础回合[:受限额外回合]，例：pool:8:3</div>
                                </div>
                            </div>
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
                            <div class="cyoa-grid-2">
                                <div>
                                    <label>模型供应商（可选）</label>
                                    <input type="text" id="narratorProvider" class="cyoa-input" value="${escapeHtml(String(narrator.provider || ''))}" placeholder="openai / anthropic / ollama / deepseek ...">
                                </div>
                                <div>
                                    <label>单次最大输出（max_tokens）</label>
                                    <input type="number" id="narratorMaxTokens" class="cyoa-input" min="64" max="4096" step="1" value="${Math.max(64, Math.min(4096, Number(narrator.maxTokens || 500)))}">
                                </div>
                            </div>
                            <div class="cyoa-grid-2">
                                <div>
                                    <label>回复模式</label>
                                    <select id="narratorResponseMode" class="cyoa-select">
                                        <option value="text" ${(String(narrator.responseMode || 'text').toLowerCase() === 'json') ? '' : 'selected'}>text（默认，稳定）</option>
                                        <option value="json" ${(String(narrator.responseMode || 'text').toLowerCase() === 'json') ? 'selected' : ''}>json（高级）</option>
                                    </select>
                                    <small style="font-size:12px;color:var(--text-light);">默认建议 text；仅在你明确使用结构化回包时切换 json。json 模式要求模型仅返回 JSON 对象，若不符合将自动回退 text（并提示）。</small>
                                </div>
                            </div>
                            <div class="cyoa-form-row">
                                <label>${t('ui.label.narratorSetting')}</label>
                                <div style="display:flex;gap:8px;align-items:flex-start;">
                                    <textarea id="narratorPrompt" class="cyoa-textarea" rows="3" style="flex:1;">${escapeHtml(narrator.prompt || '')}</textarea>
                                    <button type="button" class="cyoa-btn cyoa-btn-sm" style="flex-shrink:0;font-size:11px;white-space:nowrap;" onclick="CYOA.requestAIExpand && CYOA.requestAIExpand('narratorPrompt','narrator')" title="${t('ui.btn.aiExpand')}">✨ AI 扩展</button>
                                </div>
                            </div>
                            <div class="cyoa-form-row">
                                <label>系统约束模板（system_prompt_template）</label>
                                <div style="display:flex; justify-content:flex-end; margin:0 0 6px;">
                                    <button type="button" class="cyoa-btn cyoa-btn-secondary cyoa-btn-sm" id="narratorSystemPromptResetBtn">重置为默认模板</button>
                                </div>
                                <textarea id="narratorSystemPromptTemplate" class="cyoa-textarea" rows="10" style="font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;">${escapeHtml(
                                    narrator.systemPromptTemplate
                                    || CYOA.GamePrompts?.DEFAULT_SYSTEM_PROMPT_TEMPLATE
                                    || ''
                                )}</textarea>
                                <small style="font-size:12px;color:var(--text-light);">支持变量：{{roleType}} / {{characterName}} / {{character.background}} / {{character.personality}} / {{character.knowledge}} / {{#each axioms}}{{this}}{{/each}}</small>
                            </div>
                            <div class="cyoa-form-row">
                                <label>公理化压缩（Axiom Distillation）</label>
                                <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:center; margin-bottom:6px;">
                                    <label style="display:flex; align-items:center; gap:6px; font-size:13px;">
                                        <input id="narratorAxiomInjectEnabled" type="checkbox" ${narrator.axiomInjectEnabled !== false ? 'checked' : ''}>
                                        启用每轮公理注入
                                    </label>
                                    <label style="display:flex; align-items:center; gap:6px; font-size:13px;">
                                        最大注入条数
                                        <input id="narratorAxiomMaxCount" type="number" class="cyoa-input" min="1" max="20" step="1" value="${Math.max(1, Math.min(20, Number(narrator.axiomMaxCount || 10)))}" style="height:30px; width:72px;">
                                    </label>
                                </div>
                                <textarea id="narratorAxioms" class="cyoa-textarea" rows="6" placeholder="每行一条公理，例如：&#10;陆知薇永远不失态&#10;境界压制不可逆&#10;死亡不可逆（除非设定明确允许）">${escapeHtml(axiomLines)}</textarea>
                                <small style="font-size:12px;color:var(--text-light);">建议 10-20 条核心公理。将自动用于 {{#each axioms}} 变量，优先约束模型在世界边界内叙事。</small>
                            </div>
                            <div class="cyoa-form-row">
                                <label>天道头像（聊天缩略图）</label>
                                <input type="text" id="narratorAvatar" class="cyoa-input" value="${escapeHtml(narrator.avatar || '')}" placeholder="可填图片 URL，或使用下方上传">
                                <div style="display:flex; gap:8px; align-items:center; margin-top:6px; flex-wrap:wrap;">
                                    <input type="file" id="narratorAvatarFile" accept="image/*" class="cyoa-input" style="max-width:280px;" onchange="CYOA.handleImageFilePick && CYOA.handleImageFilePick('narratorAvatarFile','narratorAvatar','narratorAvatarPreview',2)">
                                    <img id="narratorAvatarPreview" src="${escapeHtml(narrator.avatar || '')}" alt="narrator avatar" style="width:36px; height:36px; border-radius:50%; object-fit:cover; border:1px solid var(--border); ${narrator.avatar ? '' : 'display:none;'}">
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
            const appendLineToTextarea = (textareaId, defaultLine) => {
                const ta = CYOA.$(textareaId);
                if (!ta) return;
                const current = String(ta.value || '').trim();
                const line = String(defaultLine || '').trim();
                if (!line) return;
                ta.value = current ? `${current}\n- ${line}` : `- ${line}`;
                ta.dispatchEvent(new Event('input', { bubbles: true }));
                ta.focus();
            };

            // 保存所有按钮
            CYOA.$('modalSaveBtn').onclick = () => this.save(modal);
            CYOA.$('modalCancelBtn').onclick = modal.close;
            const narratorSystemPromptResetBtn = CYOA.$('narratorSystemPromptResetBtn');
            if (narratorSystemPromptResetBtn) {
                narratorSystemPromptResetBtn.onclick = () => {
                    const ta = CYOA.$('narratorSystemPromptTemplate');
                    if (!ta) return;
                    ta.value = String(CYOA.GamePrompts?.DEFAULT_SYSTEM_PROMPT_TEMPLATE || '');
                    ta.dispatchEvent(new Event('input', { bubbles: true }));
                    ta.focus();
                };
            }

            const addWorldEntryBtn = CYOA.$('addWorldEntryBtn');
            if (addWorldEntryBtn) {
                addWorldEntryBtn.onclick = () => appendLineToTextarea('editWorldCustom', '补充一条世界规则/设定条目');
            }
            const addMechanicsEntryBtn = CYOA.$('addMechanicsEntryBtn');
            if (addMechanicsEntryBtn) {
                addMechanicsEntryBtn.onclick = () => appendLineToTextarea('editMechanicsCustom', '补充一条核心机制条目');
            }

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
                            newItem = { id: CYOA.generateId(), name: t('ui.default.newEquip'), equipType: t('ui.default.equipType'), narrativeRole: 'auto', slots: [], description: '', locked: false, durability: 0, maxDurability: 0, unlockItemId: '', statModifiers: '', skills: [] };
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
                        case 'locations':
                            newItem = { id: CYOA.generateId(), name: t('ui.default.newLocation') || '新地点', description: '', features: [], facilities: [], isSafeRoom: false };
                            break;
                        case 'equipmentSynergies':
                            newItem = { id: CYOA.generateId(), name: t('ui.default.newSynergy') || '新联动', condition: 'always', triggers: [], effect: '' };
                            break;
                        case 'discoveryRules':
                            newItem = { id: CYOA.generateId(), name: t('ui.default.newDiscoveryRule') || '新规则', discoverCondition: 'custom', conditionValue: '', result: '' };
                            break;
                        case 'outfitPresets':
                            newItem = { id: CYOA.generateId(), name: t('ui.default.newOutfitPreset') || '新服饰预设', chapter: '', items: [], specialRule: '' };
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
            ['attributes', 'items', 'equipment', 'professions', 'skills', 'quests', 'characters', 'scenes', 'chapters', 'locations', 'equipmentSynergies', 'discoveryRules', 'outfitPresets', 'storyCards'].forEach(type => {
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
                    {
                        const n = Number(CYOA.$('editTravelLimitedExtraTurns')?.value);
                        const next = Number.isFinite(n) ? Math.max(0, Math.round(n)) : Number(CONFIG?.LOCATION_DEFAULTS?.limitedStepExtraTurns ?? 2);
                        CYOA.editorTempData.travelRules = CYOA.editorTempData.travelRules || {};
                        CYOA.editorTempData.travelRules.limitedStepExtraTurns = next;
                    }
                    break;
                    
                case 'narrator':
                    {
                        const responseModeRaw = String(CYOA.$('narratorResponseMode')?.value || 'text').trim().toLowerCase();
                        const responseMode = responseModeRaw === 'json' ? 'json' : 'text';
                    const axiomInjectEnabled = !!CYOA.$('narratorAxiomInjectEnabled')?.checked;
                    const axiomMaxRaw = Number(CYOA.$('narratorAxiomMaxCount')?.value);
                    const axiomMaxCount = Number.isFinite(axiomMaxRaw) ? Math.max(1, Math.min(20, Math.round(axiomMaxRaw))) : 10;
                    const axiomList = String(CYOA.$('narratorAxioms')?.value || '')
                        .split(/\r?\n/)
                        .map(s => String(s || '').trim())
                        .filter(Boolean)
                        .slice(0, 50);
                    const existingNarrator = (CYOA.editorTempData.narrator && typeof CYOA.editorTempData.narrator === 'object')
                        ? CYOA.editorTempData.narrator
                        : {};
                    const defaultTemplate = String(CYOA.GamePrompts?.DEFAULT_SYSTEM_PROMPT_TEMPLATE || '').trim();
                    const inputTemplateRaw = String(CYOA.$('narratorSystemPromptTemplate')?.value || '').trim();
                    const normalizedSystemTemplate = (!inputTemplateRaw || (defaultTemplate && inputTemplateRaw === defaultTemplate))
                        ? ''
                        : inputTemplateRaw;
                    CYOA.editorTempData.narrator = {
                        ...existingNarrator,
                        enabled: true,
                        model: CYOA.$('narratorModel')?.value || '',
                        provider: String(CYOA.$('narratorProvider')?.value || '').trim().toLowerCase(),
                        style: CYOA.$('narratorStyle')?.value || '情感细腻',
                        prompt: CYOA.$('narratorPrompt')?.value.trim() || CONFIG.DEFAULT_GAME.narrator.prompt,
                        systemPromptTemplate: normalizedSystemTemplate,
                        axiomInjectEnabled,
                        axiomMaxCount,
                        maxTokens: Math.max(64, Math.min(4096, Number(CYOA.$('narratorMaxTokens')?.value || existingNarrator?.maxTokens || CONFIG.DEFAULT_GAME.narrator.maxTokens || 500))),
                        avatar: CYOA.$('narratorAvatar')?.value.trim() || '',
                        responseMode
                    };
                    CYOA.editorTempData.axioms = axiomList;
                    }
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
                    CYOA.renderGameListItems?.(listContainer);
                }
            } else {
                const reason = String(CYOA._lastSaveGameError || '').trim();
                alert(reason ? `${t('ui.msg.saveFailed')}\n${reason}` : t('ui.msg.saveFailed'));
            }
        }
    };
    CYOA.GameEditor = GameEditor;

    CYOA.handleImageFilePick = async function(fileInputId, targetInputId, previewImgId, maxSizeMB) {
        try {
            const fileInput = document.getElementById(fileInputId);
            const targetInput = document.getElementById(targetInputId);
            const preview = previewImgId ? document.getElementById(previewImgId) : null;
            const file = fileInput?.files?.[0];
            if (!file || !targetInput) return;
            const dataUrl = await CYOA.fileToDataUrl?.(file, maxSizeMB || 2);
            if (!dataUrl) return;
            targetInput.value = dataUrl;
            if (preview) {
                preview.src = dataUrl;
                preview.style.display = "";
            }
        } catch (e) {
            alert(`头像上传失败：${e?.message || e}`);
        }
    };

    // 设置面板与相关弹窗已拆分到 `cyoa-main-settings.js`

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

    // Sidebar shell extracted to `cyoa-main-sidebar.js`.

    // Sidebar panels part A extracted to `cyoa-main-sidebar-panels-a.js`.

    // Sidebar panels part B extracted to `cyoa-main-sidebar-panels-b.js`.

    // Sidebar panels part C extracted to `cyoa-main-sidebar-panels-c.js`.

    // Sidebar panels part D extracted to `cyoa-main-sidebar-panels-d.js`.

    // Sidebar inventory panel extracted to `cyoa-main-sidebar-inventory.js`.

    // Sidebar skills/quests panel extracted to `cyoa-main-sidebar-skills-quests.js`.

    // Sidebar chapters/saves panel extracted to `cyoa-main-sidebar-chapters-saves.js`.

    // ========== 插件注册 ==========
    const _t = typeof t === 'function' ? t : function(k) { return k; };

    const DEFAULT_PLUGIN_META = {
        id: 'cyoa_v221',
        name: 'CYOA 文字冒险游戏 v221',
        version: '2.2.2'
    };

    function getManifestUrl() {
        const currentScript = document.currentScript;
        if (currentScript && currentScript.src) {
            return new URL('manifest.json', currentScript.src).href;
        }
        const scripts = Array.from(document.querySelectorAll('script[src]'));
        const scriptEl = scripts.find(s => /cyoa-main\.js(\?|$)/i.test(s.src));
        if (scriptEl && scriptEl.src) {
            return new URL('manifest.json', scriptEl.src).href;
        }
        return '';
    }

    async function loadPluginMetaFromManifest() {
        const manifestUrl = getManifestUrl();
        if (!manifestUrl) return { ...DEFAULT_PLUGIN_META };
        try {
            const res = await fetch(manifestUrl, { cache: 'no-store' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const manifest = await res.json();
            const id = String(manifest?.id || '').trim() || DEFAULT_PLUGIN_META.id;
            const name = String(manifest?.name || '').trim() || DEFAULT_PLUGIN_META.name;
            const version = String(manifest?.version || '').trim() || DEFAULT_PLUGIN_META.version;
            return { id, name, version };
        } catch (err) {
            log(`[CYOA] failed to load manifest meta: ${err?.message || err}`);
            return { ...DEFAULT_PLUGIN_META };
        }
    }

    function registerPlugin(pluginMeta) {
        const meta = pluginMeta || DEFAULT_PLUGIN_META;
        if (typeof MainApp !== 'undefined' && MainApp.registerPlugin) {
            MainApp.registerPlugin({
                id: meta.id,
                name: meta.name,
                version: meta.version,
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
            setTimeout(() => registerPlugin(meta), 500);
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

    loadPluginMetaFromManifest().then(meta => {
        CYOA.pluginMeta = { ...meta };
        log(`[CYOA] register meta: ${meta.id}@${meta.version}`);
        registerPlugin(meta);
    });

    log('[CYOA] main module loaded');
})();