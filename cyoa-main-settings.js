/**
 * CYOA main settings module.
 * Extracted from cyoa-main.js to reduce monolith size.
 */
(function() {
    const CYOA = window.CYOA;
    if (!CYOA || !CYOA.CONFIG) return;

    const CONFIG = CYOA.CONFIG;
    const t = CYOA.t;
    const escapeHtml = CYOA.escapeHtml || ((s) => String(s ?? ""));

    async function ensureGameRuntimeReady() {
        if (typeof CYOA.startGame === "function") return true;
        const src = `plugins/cyoa/cyoa-game.js?v=${Date.now()}`;
        try {
            await new Promise((resolve, reject) => {
                const s = document.createElement("script");
                s.src = src;
                s.async = true;
                s.onload = resolve;
                s.onerror = () => reject(new Error(`load failed: ${src}`));
                document.head.appendChild(s);
            });
        } catch (e) {
            console.error("[CYOA] 运行模块补载失败", e);
        }
        return typeof CYOA.startGame === "function";
    }

    function renderGameListItems(listContainer) {
        if (!listContainer) return;
        listContainer.innerHTML = "";

        if (CYOA.games.length === 0) {
            listContainer.innerHTML = `<div class="cyoa-empty-state">${t("ui.empty.noGames")}</div>`;
            return;
        }

        const countOf = (v) => {
            if (Array.isArray(v)) return v.length;
            if (typeof v === "number" && Number.isFinite(v)) return v;
            return 0;
        };

        CYOA.games.forEach((game) => {
            const item = document.createElement("div");
            item.className = "cyoa-game-card";

            item.innerHTML = `
                <div class="cyoa-card-header">
                    <h3 class="cyoa-card-title">${escapeHtml(game.name)}</h3>
                    <span class="cyoa-badge cyoa-badge-primary">${countOf(game.characters)} ${t("ui.type.characters")}</span>
                </div>
                <div class="cyoa-card-meta">✍️ ${escapeHtml(game.author || t("ui.status.unknownAuthor"))} • v${game.version || "1.0"}</div>
                <div class="cyoa-card-stats" style="grid-template-columns:repeat(4,1fr);">
                    <div class="cyoa-stat"><span class="cyoa-stat-value">${countOf(game.attributes)}</span><span class="cyoa-stat-label">${t("ui.type.attributes")}</span></div>
                    <div class="cyoa-stat"><span class="cyoa-stat-value">${countOf(game.items)}</span><span class="cyoa-stat-label">${t("ui.type.items")}</span></div>
                    <div class="cyoa-stat"><span class="cyoa-stat-value">${countOf(game.skills)}</span><span class="cyoa-stat-label">${t("ui.type.skills")}</span></div>
                    <div class="cyoa-stat"><span class="cyoa-stat-value">${countOf(game.quests)}</span><span class="cyoa-stat-label">${t("ui.type.quests")}</span></div>
                </div>
                <div class="cyoa-card-actions">
                    <button class="cyoa-btn cyoa-btn-primary play-game" data-id="${game.id}">${t("ui.btn.start")}</button>
                    <button class="cyoa-btn cyoa-btn-secondary edit-game" data-id="${game.id}">✏️ ${t("ui.btn.edit")}</button>
                    <button class="cyoa-btn cyoa-btn-secondary export-game" data-id="${game.id}" title="${t("ui.btn.export")}">📤</button>
                    <button class="cyoa-btn cyoa-btn-danger delete-game" data-id="${game.id}" title="${t("ui.btn.delete")}">🗑️</button>
                </div>
            `;

            item.querySelector(".play-game").addEventListener("click", async () => {
                const ok = await ensureGameRuntimeReady();
                if (!ok || typeof CYOA.startGame !== "function") {
                    alert("CYOA 游戏运行模块未加载，请刷新页面后重试。");
                    return;
                }
                CYOA.startGame(game.id);
            });

            item.querySelector(".edit-game").addEventListener("click", () => CYOA.GameEditor?.open(game.id));
            item.querySelector(".export-game").addEventListener("click", () => CYOA.exportGame(game.id));
            item.querySelector(".delete-game").addEventListener("click", async () => {
                if (confirm(t("ui.msg.confirmDeleteGame", { name: game.name }))) {
                    const success = await CYOA.deleteGameFile(game.id);
                    if (success) {
                        CYOA.games = CYOA.games.filter((g) => g.id !== game.id);
                        renderGameListItems(listContainer);
                    }
                }
            });

            listContainer.appendChild(item);
        });
    }
    CYOA.renderGameListItems = renderGameListItems;

    function openAIGenerateModal(container) {
        const models = CYOA.getChatModels?.() || [];
        const modelOptions = models.map((m) => `<option value="${escapeHtml(m.value)}">${escapeHtml(m.label)}</option>`).join("");
        const defaultModel = (typeof MainApp !== "undefined" && MainApp.getModels) ? (MainApp.getModels("chat")?.[0]?.value || "") : (models[0]?.value || "");

        const contentHtml = `
            <div class="cyoa-ai-generate-form" style="padding:16px;">
                <div class="cyoa-form-row" style="margin-bottom:12px;">
                    <label style="display:block;margin-bottom:6px;">${t("ui.label.aiGenerateMode")}</label>
                    <div style="display:flex;gap:16px;">
                        <label class="cyoa-radio"><input type="radio" name="aiGenMode" value="creative" checked> ${t("ui.opt.aiModeCreative")}</label>
                        <label class="cyoa-radio"><input type="radio" name="aiGenMode" value="rules"> ${t("ui.opt.aiModeRules")}</label>
                    </div>
                </div>
                <div class="cyoa-form-row" style="margin-bottom:12px;">
                    <label id="aiGenInputLabel">${t("ui.label.aiGenerateIdea")}</label>
                    <textarea id="aiGenerateIdea" class="cyoa-textarea" rows="3" placeholder="${t("ui.ph.aiGenerateIdea")}" style="width:100%;resize:vertical;"></textarea>
                    <p id="aiGenModeHint" style="margin:4px 0 0;font-size:11px;color:var(--text-light);">${t("ui.hint.aiGenerateGame")}</p>
                </div>
                <div class="cyoa-form-row" style="margin-bottom:12px;">
                    <label>${t("ui.label.aiModel")}</label>
                    <select id="aiGenerateModel" class="cyoa-select" style="width:100%;">
                        <option value="">${t("ui.label.selectModel")}</option>
                        ${modelOptions}
                    </select>
                </div>
                <div id="aiGenerateStatus" style="font-size:12px;color:var(--text-light);margin-top:8px;min-height:20px;"></div>
            </div>
        `;
        const footerHtml = `
            <button class="cyoa-btn cyoa-btn-secondary" id="aiGenerateCancel">${t("ui.btn.cancel")}</button>
            <button class="cyoa-btn cyoa-btn-primary" id="aiGenerateBtn" disabled>✨ ${t("ui.btn.aiGenerate")}</button>
        `;

        const modal = CYOA.ModalSystem.open(t("ui.aiGenerate.title"), contentHtml, footerHtml, {
            icon: "✨",
            size: "medium",
            closeOnOverlay: true
        });

        const ideaEl = CYOA.$("aiGenerateIdea");
        const modelEl = CYOA.$("aiGenerateModel");
        const statusEl = CYOA.$("aiGenerateStatus");
        const genBtn = CYOA.$("aiGenerateBtn");

        if (modelEl && defaultModel) modelEl.value = defaultModel;
        ideaEl?.addEventListener("input", () => {
            if (genBtn) genBtn.disabled = !(ideaEl?.value?.trim());
        });

        const modeCreative = document.querySelector('input[name="aiGenMode"][value="creative"]');
        const modeRules = document.querySelector('input[name="aiGenMode"][value="rules"]');
        const inputLabel = document.getElementById("aiGenInputLabel");
        const modeHint = document.getElementById("aiGenModeHint");
        const updateModeUI = () => {
            const isRules = modeRules?.checked;
            if (ideaEl) ideaEl.rows = isRules ? 10 : 3;
            if (ideaEl) ideaEl.placeholder = isRules ? (t("ui.ph.aiGenerateRules") || "粘贴完整规则说明书…") : t("ui.ph.aiGenerateIdea");
            if (inputLabel) inputLabel.textContent = isRules ? (t("ui.label.aiGenerateRules") || "规则说明书") : t("ui.label.aiGenerateIdea");
            if (modeHint) modeHint.textContent = isRules ? (t("ui.hint.aiGenerateRules") || "") : t("ui.hint.aiGenerateGame");
        };
        modeCreative?.addEventListener("change", updateModeUI);
        modeRules?.addEventListener("change", updateModeUI);

        CYOA.$("aiGenerateCancel").onclick = () => modal.close();
        genBtn.onclick = async () => {
            const idea = ideaEl?.value?.trim();
            const modelVal = modelEl?.value;
            const useRulesMode = modeRules?.checked || false;
            if (!idea) return alert(t("ui.msg.aiExpandEmpty"));
            if (!modelVal) return alert(t("ui.msg.noSelectModel"));

            genBtn.disabled = true;
            statusEl.textContent = t("ui.msg.aiGenerating") || "AI 生成中，请稍候…";
            try {
                const gameData = await CYOA.generateGameWithAI(idea, modelVal, useRulesMode, (msg) => {
                    if (statusEl) statusEl.textContent = msg;
                });
                if (gameData) {
                    modal.close();
                    CYOA.GameEditor?.openWithData(gameData);
                    if (container) CYOA.renderSettings(container);
                } else {
                    statusEl.textContent = t("ui.msg.aiGenerateFailed") || "生成失败，请重试。";
                    genBtn.disabled = false;
                }
            } catch (e) {
                console.error("[CYOA] AI 生成失败", e);
                statusEl.textContent = (e.message || t("ui.msg.aiGenerateFailed")) + "";
                genBtn.disabled = false;
            }
        };
    }

    function openWordFilterEditor() {
        const defaults = CONFIG.DEFAULT_WORD_FILTER || [];
        let userList = [];
        try {
            const stored = localStorage.getItem(CONFIG.STORAGE_KEYS.WORD_FILTER);
            if (stored) userList = JSON.parse(stored);
        } catch (_) { userList = []; }
        if (!Array.isArray(userList)) userList = [];

        const merged = new Map();
        defaults.forEach(item => merged.set(item.sensitive, { safe: item.safe, source: "default" }));
        userList.forEach(item => {
            if (item.sensitive && item.safe) merged.set(item.sensitive, { safe: item.safe, source: "user" });
        });

        let rows = "";
        merged.forEach((val, key) => {
            const badge = val.source === "user"
                ? `<span style="font-size:10px; color:#3b82f6;">${t("ui.status.custom")}</span>`
                : `<span style="font-size:10px; color:#9ca3af;">${t("ui.status.default")}</span>`;
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
                ${t("ui.hint.filterDesc1")}<br>
                ${t("ui.hint.filterDesc2")}
            </div>
            <div style="max-height:400px; overflow-y:auto; border:1px solid var(--border); border-radius:var(--radius-sm);">
                <table style="width:100%; border-collapse:collapse; font-size:13px;" id="wfTable">
                    <thead style="background:var(--bg); position:sticky; top:0;">
                        <tr>
                            <th style="padding:8px; text-align:left; width:60px;">${t("ui.label.source")}</th>
                            <th style="padding:8px; text-align:left;">${t("ui.label.sensitiveWord")}</th>
                            <th style="padding:8px; text-align:left;">${t("ui.label.replacement")}</th>
                            <th style="padding:8px; width:40px;"></th>
                        </tr>
                    </thead>
                    <tbody id="wfBody">${rows}</tbody>
                </table>
            </div>
            <div style="margin-top:10px; display:flex; gap:8px;">
                <button class="cyoa-btn cyoa-btn-secondary cyoa-btn-sm" id="wfAddRow">${t("ui.btn.addEntry")}</button>
                <button class="cyoa-btn cyoa-btn-secondary cyoa-btn-sm" id="wfResetDefaults">${t("ui.btn.resetDefault")}</button>
                <button class="cyoa-btn cyoa-btn-secondary cyoa-btn-sm" id="wfExport">${t("ui.btn.exportFilter")}</button>
                <button class="cyoa-btn cyoa-btn-secondary cyoa-btn-sm" id="wfImport">${t("ui.btn.importFilter")}</button>
            </div>
        `;
        const footer = `
            <button class="cyoa-btn cyoa-btn-secondary" id="wfCancel">${t("ui.btn.cancel")}</button>
            <button class="cyoa-btn cyoa-btn-primary" id="wfSave">💾 ${t("ui.btn.save")}</button>
        `;

        const ModalSystem = CYOA.ModalSystem || window.CYOA_ModalSystem;
        if (!ModalSystem) return alert(t("ui.msg.modalNotLoaded"));
        const modal = ModalSystem.open(t("ui.panel.wordFilter"), content, footer, { size: "lg" });

        function bindDeleteBtns() {
            document.querySelectorAll("#wfBody .wf-del").forEach(btn => {
                btn.onclick = () => btn.closest("tr").remove();
            });
        }
        bindDeleteBtns();

        const addRowBtn = document.getElementById("wfAddRow");
        if (addRowBtn) addRowBtn.onclick = () => {
            const tbody = document.getElementById("wfBody");
            if (!tbody) return;
            const tr = document.createElement("tr");
            tr.dataset.source = "user";
            tr.innerHTML = `
                <td style="padding:6px 8px;"><span style="font-size:10px; color:#3b82f6;">${t("ui.status.custom")}</span></td>
                <td style="padding:6px 8px;"><input type="text" class="cyoa-input wf-sensitive" value="" style="width:100%; height:28px; font-size:12px;" placeholder="${t("ui.ph.sensitiveWord")}"></td>
                <td style="padding:6px 8px;"><input type="text" class="cyoa-input wf-safe" value="" style="width:100%; height:28px; font-size:12px;" placeholder="${t("ui.ph.replacement")}"></td>
                <td style="padding:6px 4px; text-align:center;"><button class="cyoa-btn-icon danger wf-del" type="button" style="font-size:13px;">🗑️</button></td>
            `;
            tbody.appendChild(tr);
            bindDeleteBtns();
            tr.querySelector(".wf-sensitive").focus();
        };

        const resetBtn = document.getElementById("wfResetDefaults");
        if (resetBtn) resetBtn.onclick = () => {
            if (confirm(t("ui.msg.confirmResetFilter"))) {
                localStorage.removeItem(CONFIG.STORAGE_KEYS.WORD_FILTER);
                ModalSystem.close();
                openWordFilterEditor();
            }
        };

        const exportBtn = document.getElementById("wfExport");
        if (exportBtn) exportBtn.onclick = () => {
            const list = collectTableRows();
            const blob = new Blob([JSON.stringify(list, null, 2)], { type: "application/json" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = "cyoa_word_filter.json";
            a.click();
        };

        const importBtn = document.getElementById("wfImport");
        if (importBtn) importBtn.onclick = () => {
            const input = document.createElement("input");
            input.type = "file";
            input.accept = ".json";
            input.onchange = (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => {
                    try {
                        const imported = JSON.parse(ev.target.result);
                        if (!Array.isArray(imported)) { alert(t("ui.msg.invalidFilter")); return; }
                        CYOA.saveWordFilter(imported);
                        CYOA.invalidateRAG?.();
                        alert(t("ui.msg.importSuccess", { count: imported.length }));
                        ModalSystem.close();
                        openWordFilterEditor();
                    } catch (ex) {
                        alert(t("ui.msg.parseFailed", { error: ex.message }));
                    }
                };
                reader.readAsText(file);
            };
            input.click();
        };

        function collectTableRows() {
            const list = [];
            document.querySelectorAll("#wfBody tr").forEach((tr) => {
                const s = tr.querySelector(".wf-sensitive")?.value.trim();
                const r = tr.querySelector(".wf-safe")?.value.trim();
                if (s && r) list.push({ sensitive: s, safe: r });
            });
            return list;
        }

        const saveBtn = document.getElementById("wfSave");
        if (saveBtn) saveBtn.onclick = () => {
            const list = collectTableRows();
            CYOA.saveWordFilter(list);
            CYOA.invalidateRAG?.();
            alert(t("ui.msg.filterSaved", { count: list.length }));
            ModalSystem.close();
        };

        const cancelBtn = document.getElementById("wfCancel");
        if (cancelBtn) cancelBtn.onclick = () => modal.close();
    }

    // ========== 设置面板渲染 ==========
    CYOA.renderSettings = function(container) {
        if (!container) {
            setTimeout(() => {
                const retryContainer = CYOA.$("pluginSettingsContent");
                if (retryContainer) CYOA.renderSettings(retryContainer);
            }, 500);
            return;
        }

        container.innerHTML = `
            <div class="cyoa-container" style="padding:20px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px;">
                    <div>
                        <h2 style="margin:0;">${t("ui.panel.gameLib")}</h2>
                        <p style="margin:4px 0 0; color:var(--text-light);">${t("ui.panel.gameLibDesc")}</p>
                    </div>
                    <div style="display:flex; gap:12px; align-items:center;">
                        <button class="cyoa-btn cyoa-btn-primary" id="cyoaNewGameBtn">${t("ui.btn.newGame")}</button>
                        <button class="cyoa-btn cyoa-btn-secondary" id="cyoaAIGenerateBtn" title="${t("ui.btn.aiGenerateGame")}">✨ ${t("ui.btn.aiGenerateGame")}</button>
                        <button class="cyoa-btn cyoa-btn-secondary" id="cyoaImportGameBtn">${t("ui.btn.importGame")}</button>
                        <button class="cyoa-btn cyoa-btn-secondary" id="cyoaWordFilterBtn" title="${t("ui.panel.wordFilter")}">${t("ui.btn.wordFilter")}</button>
                    </div>
                </div>
                <div style="margin:-8px 0 16px; padding:10px 12px; border:1px solid var(--border); border-radius:10px; background:var(--bg-light);">
                    <div style="display:grid; grid-template-columns:minmax(360px, 1.5fr) minmax(280px, 1fr); gap:10px;">
                        <div style="display:flex; flex-direction:column; gap:6px; border:1px solid var(--border); border-radius:10px; padding:10px; background:var(--bg);">
                            <label style="display:flex; align-items:center; gap:8px;">
                                <span>模型档位预设</span>
                            </label>
                            <select id="cyoaModelProfileSelect" class="cyoa-select" style="height:32px;">
                                <option value="small_7b_9b" ${CYOA.CONFIG?.AI_MODEL_PROFILE === "small_7b_9b" ? "selected" : ""}>免费小模型（7B-9B）</option>
                                <option value="medium_13b_34b" ${CYOA.CONFIG?.AI_MODEL_PROFILE === "medium_13b_34b" ? "selected" : ""}>中模型（13B-34B）</option>
                                <option value="large_70b_plus" ${CYOA.CONFIG?.AI_MODEL_PROFILE === "large_70b_plus" ? "selected" : ""}>大模型（70B+）</option>
                            </select>
                            <div style="display:flex; align-items:center; gap:8px;">
                                <span style="font-size:12px; color:var(--text-light); white-space:nowrap;">约束档位</span>
                                <select id="cyoaGuardProfileSelect" class="cyoa-select" style="height:30px; min-width:132px;">
                                    <option value="strict" ${String(CYOA.CONFIG?.AI_GUARD_PROFILE || "strict") === "strict" ? "selected" : ""}>严格</option>
                                    <option value="balanced" ${String(CYOA.CONFIG?.AI_GUARD_PROFILE || "strict") === "balanced" ? "selected" : ""}>平衡</option>
                                    <option value="free" ${String(CYOA.CONFIG?.AI_GUARD_PROFILE || "strict") === "free" ? "selected" : ""}>自由</option>
                                </select>
                            </div>
                            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                                <span style="font-size:12px; color:var(--text-light); white-space:nowrap;">约束方案预设</span>
                                <select id="cyoaConstraintPresetSelect" class="cyoa-select" style="height:30px; min-width:166px;">
                                    <option value="custom">自定义（当前）</option>
                                    <option value="beginner">新手（稳）</option>
                                    <option value="stable">进阶（推荐）</option>
                                    <option value="hardcore">硬核（最严）</option>
                                </select>
                                <button id="cyoaConstraintPresetApplyBtn" type="button" class="cyoa-btn cyoa-btn-secondary cyoa-btn-sm">应用</button>
                            </div>
                            <div style="display:flex; align-items:center; gap:8px;">
                                <span style="font-size:12px; color:var(--text-light); white-space:nowrap;">定义心跳（回合）</span>
                                <input id="cyoaHeartbeatTurnsInput" type="number" class="cyoa-input" min="1" max="30" step="1" value="${Math.max(1, Number(CYOA.CONFIG?.AI_DEFINITION_HEARTBEAT_TURNS || 6))}" style="height:30px; width:92px;">
                            </div>
                            <div style="display:flex; align-items:center; gap:8px;">
                                <span style="font-size:12px; color:var(--text-light); white-space:nowrap;">AI 对话温度（0-1）</span>
                                <input id="cyoaChatTemperatureInput" type="number" class="cyoa-input" min="0" max="1" step="0.01" value="${Math.max(0, Math.min(1, Number(CYOA.CONFIG?.AI_CHAT_TEMPERATURE ?? 0.15))).toFixed(2)}" style="height:30px; width:92px;">
                            </div>
                            <div style="display:flex; align-items:center; gap:8px;">
                                <span style="font-size:12px; color:var(--text-light); white-space:nowrap;">AI Top P（0-1）</span>
                                <input id="cyoaTopPInput" type="number" class="cyoa-input" min="0" max="1" step="0.01" value="${Math.max(0, Math.min(1, Number(CYOA.CONFIG?.AI_TOP_P ?? 0.9))).toFixed(2)}" style="height:30px; width:92px;">
                            </div>
                            <small id="cyoaModelProfileHint" style="font-size:12px; color:var(--text-light);">
                                可先选模型预设，再手动微调定义心跳；温度建议 0.10-0.20、Top P 建议 0.70-0.95，最终以玩家填写为准。
                            </small>
                        </div>
                        <div style="display:grid; grid-template-columns:1fr; gap:10px;">
                            <label style="display:flex; flex-direction:column; gap:6px; border:1px solid var(--border); border-radius:10px; padding:10px; background:var(--bg); cursor:pointer; user-select:none;">
                                <span style="display:flex; align-items:center; gap:8px;">
                                    <input id="cyoaBypassCostToggle" type="checkbox" ${CYOA.CONFIG?.AI_BYPASS_COST_OPTIMIZER !== false ? "checked" : ""}>
                                    <span>关闭省钱策略（直通模型）</span>
                                </span>
                                <small style="font-size:12px; color:var(--text-light);">减少乱码/污染回复。默认开启。</small>
                            </label>
                            <label style="display:flex; flex-direction:column; gap:6px; border:1px solid var(--border); border-radius:10px; padding:10px; background:var(--bg); cursor:pointer; user-select:none;">
                                <span style="display:flex; align-items:center; gap:8px;">
                                    <input id="cyoaLocalDriftCorrectionToggle" type="checkbox" ${CYOA.CONFIG?.LOCAL_DRIFT_CORRECTION_ENABLED !== false ? "checked" : ""}>
                                    <span>启用本地纠偏（章节/地点/人物/越框）</span>
                                </span>
                                <small style="font-size:12px; color:var(--text-light);">关闭后不再自动收敛为“当前章节/地点”。</small>
                            </label>
                            <div style="display:flex; flex-direction:column; gap:8px; border:1px solid var(--border); border-radius:10px; padding:10px; background:var(--bg);">
                                <label style="display:flex; align-items:center; gap:8px; cursor:pointer; user-select:none;">
                                    <input id="cyoaDynamicNpcEnabledToggle" type="checkbox" ${CYOA.CONFIG?.DYNAMIC_NPC_ENABLED !== false ? "checked" : ""}>
                                    <span>启用动态剧情 NPC</span>
                                </label>
                                <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                                    <label style="display:flex; flex-direction:column; gap:4px; font-size:12px;">
                                        <span style="color:var(--text-light);">每回合生成概率（0-1）</span>
                                        <input id="cyoaDynamicNpcSpawnChanceInput" type="number" class="cyoa-input" min="0" max="1" step="0.01" value="${Math.max(0, Math.min(1, Number(CYOA.CONFIG?.DYNAMIC_NPC_SPAWN_CHANCE ?? 0.28))).toFixed(2)}" style="height:30px;">
                                    </label>
                                    <label style="display:flex; flex-direction:column; gap:4px; font-size:12px;">
                                        <span style="color:var(--text-light);">生成冷却（回合）</span>
                                        <input id="cyoaDynamicNpcCooldownInput" type="number" class="cyoa-input" min="0" max="30" step="1" value="${Math.max(0, Math.min(30, Math.round(Number(CYOA.CONFIG?.DYNAMIC_NPC_SPAWN_COOLDOWN_TURNS ?? 2))))}" style="height:30px;">
                                    </label>
                                    <label style="display:flex; flex-direction:column; gap:4px; font-size:12px;">
                                        <span style="color:var(--text-light);">单地点上限</span>
                                        <input id="cyoaDynamicNpcMaxPerContextInput" type="number" class="cyoa-input" min="0" max="10" step="1" value="${Math.max(0, Math.min(10, Math.round(Number(CYOA.CONFIG?.DYNAMIC_NPC_MAX_PER_CONTEXT ?? 2))))}" style="height:30px;">
                                    </label>
                                    <label style="display:flex; flex-direction:column; gap:4px; font-size:12px;">
                                        <span style="color:var(--text-light);">全局上限</span>
                                        <input id="cyoaDynamicNpcMaxGlobalInput" type="number" class="cyoa-input" min="0" max="50" step="1" value="${Math.max(0, Math.min(50, Math.round(Number(CYOA.CONFIG?.DYNAMIC_NPC_MAX_GLOBAL ?? 12))))}" style="height:30px;">
                                    </label>
                                    <label style="display:flex; flex-direction:column; gap:4px; font-size:12px;">
                                        <span style="color:var(--text-light);">回收阈值（回合）</span>
                                        <input id="cyoaDynamicNpcStaleTurnsInput" type="number" class="cyoa-input" min="1" max="60" step="1" value="${Math.max(1, Math.min(60, Math.round(Number(CYOA.CONFIG?.DYNAMIC_NPC_STALE_TURNS ?? 10))))}" style="height:30px;">
                                    </label>
                                    <label style="display:flex; flex-direction:column; gap:4px; font-size:12px;">
                                        <span style="color:var(--text-light);">迁移概率（0-1）</span>
                                        <input id="cyoaDynamicNpcMigrationChanceInput" type="number" class="cyoa-input" min="0" max="1" step="0.01" value="${Math.max(0, Math.min(1, Number(CYOA.CONFIG?.DYNAMIC_NPC_MIGRATION_CHANCE ?? 0.18))).toFixed(2)}" style="height:30px;">
                                    </label>
                                </div>
                                <label style="display:flex; align-items:center; gap:8px; cursor:pointer; user-select:none; font-size:12px;">
                                    <input id="cyoaDynamicNpcSameRegionOnlyToggle" type="checkbox" ${CYOA.CONFIG?.DYNAMIC_NPC_SAME_REGION_ONLY !== false ? "checked" : ""}>
                                    <span>仅允许在同区域内迁移</span>
                                </label>
                                <label style="display:flex; align-items:center; gap:8px; cursor:pointer; user-select:none; font-size:12px;">
                                    <input id="cyoaDynamicNpcLifecycleNoticeToggle" type="checkbox" ${CYOA.CONFIG?.DYNAMIC_NPC_LIFECYCLE_NOTICE !== false ? "checked" : ""}>
                                    <span>显示动态NPC迁移/回收提示</span>
                                </label>
                                <label style="display:flex; align-items:center; gap:8px; cursor:pointer; user-select:none; font-size:12px;">
                                    <input id="cyoaDynamicNpcNoticeCompactToggle" type="checkbox" ${CYOA.CONFIG?.DYNAMIC_NPC_NOTICE_COMPACT !== false ? "checked" : ""}>
                                    <span>提示轻量模式（同回合合并为一条）</span>
                                </label>
                                <label style="display:flex; flex-direction:column; gap:4px; font-size:12px;">
                                    <span style="color:var(--text-light);">提示冷却（回合）</span>
                                    <input id="cyoaDynamicNpcNoticeCooldownInput" type="number" class="cyoa-input" min="0" max="20" step="1" value="${Math.max(0, Math.min(20, Math.round(Number(CYOA.CONFIG?.DYNAMIC_NPC_NOTICE_COOLDOWN_TURNS ?? 2))))}" style="height:30px;">
                                </label>
                                <label style="display:flex; flex-direction:column; gap:4px; font-size:12px;">
                                    <span style="color:var(--text-light);">提示等级</span>
                                    <select id="cyoaDynamicNpcNoticeLevelSelect" class="cyoa-select" style="height:30px;">
                                        <option value="minimal" ${String(CYOA.CONFIG?.DYNAMIC_NPC_NOTICE_LEVEL || "normal") === "minimal" ? "selected" : ""}>精简</option>
                                        <option value="normal" ${String(CYOA.CONFIG?.DYNAMIC_NPC_NOTICE_LEVEL || "normal") === "normal" ? "selected" : ""}>标准</option>
                                        <option value="verbose" ${String(CYOA.CONFIG?.DYNAMIC_NPC_NOTICE_LEVEL || "normal") === "verbose" ? "selected" : ""}>详细</option>
                                    </select>
                                </label>
                                <small style="font-size:12px; color:var(--text-light);">设为 0 可禁用该维度生成（例如单地点上限=0）。</small>
                            </div>
                            <label style="display:flex; flex-direction:column; gap:6px; border:1px solid var(--border); border-radius:10px; padding:10px; background:var(--bg); cursor:pointer; user-select:none;">
                                <span style="display:flex; align-items:center; gap:8px;">
                                    <input id="cyoaWordFilterEnabledToggle" type="checkbox" ${CYOA.CONFIG?.WORD_FILTER_ENABLED !== false ? "checked" : ""}>
                                    <span>启用屏蔽词过滤</span>
                                </span>
                                <small style="font-size:12px; color:var(--text-light);">发送前替换，回包后还原。</small>
                            </label>
                            <label style="display:flex; flex-direction:column; gap:6px; border:1px solid var(--border); border-radius:10px; padding:10px; background:var(--bg); cursor:pointer; user-select:none;">
                                <span style="display:flex; align-items:center; gap:8px;">
                                    <input id="cyoaAllowLocalFallbackToggle" type="checkbox" ${CYOA.CONFIG?.ALLOW_LOCAL_FALLBACK === true ? "checked" : ""}>
                                    <span>允许 localStorage 回退</span>
                                </span>
                                <small style="font-size:12px; color:var(--text-light);">默认关闭。建议仅在后端异常时临时开启。</small>
                            </label>
                        </div>
                    </div>
                </div>
                <div id="cyoaGameList" class="cyoa-game-list"></div>
            </div>
        `;

        CYOA.$("cyoaNewGameBtn").onclick = () => CYOA.GameEditor?.open("new");
        CYOA.$("cyoaAIGenerateBtn").onclick = () => openAIGenerateModal(container);
        CYOA.$("cyoaImportGameBtn").onclick = () => CYOA.importGame(container);
        CYOA.$("cyoaWordFilterBtn").onclick = () => openWordFilterEditor();

        const bypassToggle = CYOA.$("cyoaBypassCostToggle");
        if (bypassToggle) {
            bypassToggle.onchange = () => {
                const enabled = !!bypassToggle.checked;
                if (typeof CYOA.setAiBypassCostOptimizer === "function") CYOA.setAiBypassCostOptimizer(enabled);
                else CYOA.CONFIG.AI_BYPASS_COST_OPTIMIZER = enabled;
                CYOA.log?.("AI_BYPASS_COST_OPTIMIZER =", enabled);
            };
        }

        const localDriftCorrectionToggle = CYOA.$("cyoaLocalDriftCorrectionToggle");
        if (localDriftCorrectionToggle) {
            localDriftCorrectionToggle.onchange = () => {
                const enabled = !!localDriftCorrectionToggle.checked;
                CYOA.CONFIG.LOCAL_DRIFT_CORRECTION_ENABLED = enabled;
                try {
                    const current = CYOA.loadPluginSettings?.() || {};
                    current.LOCAL_DRIFT_CORRECTION_ENABLED = enabled;
                    CYOA.savePluginSettings?.(current);
                } catch (_) {}
                CYOA.log?.("LOCAL_DRIFT_CORRECTION_ENABLED =", enabled);
            };
        }

        const dynamicNpcEnabledToggle = CYOA.$("cyoaDynamicNpcEnabledToggle");
        const dynamicNpcSpawnChanceInput = CYOA.$("cyoaDynamicNpcSpawnChanceInput");
        const dynamicNpcCooldownInput = CYOA.$("cyoaDynamicNpcCooldownInput");
        const dynamicNpcMaxPerContextInput = CYOA.$("cyoaDynamicNpcMaxPerContextInput");
        const dynamicNpcMaxGlobalInput = CYOA.$("cyoaDynamicNpcMaxGlobalInput");
        const dynamicNpcStaleTurnsInput = CYOA.$("cyoaDynamicNpcStaleTurnsInput");
        const dynamicNpcMigrationChanceInput = CYOA.$("cyoaDynamicNpcMigrationChanceInput");
        const dynamicNpcSameRegionOnlyToggle = CYOA.$("cyoaDynamicNpcSameRegionOnlyToggle");
        const dynamicNpcLifecycleNoticeToggle = CYOA.$("cyoaDynamicNpcLifecycleNoticeToggle");
        const dynamicNpcNoticeCompactToggle = CYOA.$("cyoaDynamicNpcNoticeCompactToggle");
        const dynamicNpcNoticeCooldownInput = CYOA.$("cyoaDynamicNpcNoticeCooldownInput");
        const dynamicNpcNoticeLevelSelect = CYOA.$("cyoaDynamicNpcNoticeLevelSelect");
        const clampChance = (v) => {
            const n = Number(v);
            if (!Number.isFinite(n)) return 0.28;
            return Math.max(0, Math.min(1, Math.round(n * 100) / 100));
        };
        const clampInt = (v, min, max, fallback) => {
            const n = Number(v);
            if (!Number.isFinite(n)) return fallback;
            return Math.max(min, Math.min(max, Math.round(n)));
        };
        const syncDynamicNpcInputs = () => {
            if (dynamicNpcSpawnChanceInput) dynamicNpcSpawnChanceInput.value = clampChance(dynamicNpcSpawnChanceInput.value).toFixed(2);
            if (dynamicNpcCooldownInput) dynamicNpcCooldownInput.value = String(clampInt(dynamicNpcCooldownInput.value, 0, 30, 2));
            if (dynamicNpcMaxPerContextInput) dynamicNpcMaxPerContextInput.value = String(clampInt(dynamicNpcMaxPerContextInput.value, 0, 10, 2));
            if (dynamicNpcMaxGlobalInput) dynamicNpcMaxGlobalInput.value = String(clampInt(dynamicNpcMaxGlobalInput.value, 0, 50, 12));
            if (dynamicNpcStaleTurnsInput) dynamicNpcStaleTurnsInput.value = String(clampInt(dynamicNpcStaleTurnsInput.value, 1, 60, 10));
            if (dynamicNpcMigrationChanceInput) dynamicNpcMigrationChanceInput.value = clampChance(dynamicNpcMigrationChanceInput.value).toFixed(2);
            if (dynamicNpcNoticeCooldownInput) dynamicNpcNoticeCooldownInput.value = String(clampInt(dynamicNpcNoticeCooldownInput.value, 0, 20, 2));
        };
        const persistDynamicNpcSettings = () => {
            const enabled = !!dynamicNpcEnabledToggle?.checked;
            const spawnChance = clampChance(dynamicNpcSpawnChanceInput?.value);
            const cooldown = clampInt(dynamicNpcCooldownInput?.value, 0, 30, 2);
            const maxPerContext = clampInt(dynamicNpcMaxPerContextInput?.value, 0, 10, 2);
            const maxGlobal = clampInt(dynamicNpcMaxGlobalInput?.value, 0, 50, 12);
            const staleTurns = clampInt(dynamicNpcStaleTurnsInput?.value, 1, 60, 10);
            const migrationChance = clampChance(dynamicNpcMigrationChanceInput?.value);
            const sameRegionOnly = !!dynamicNpcSameRegionOnlyToggle?.checked;
            const lifecycleNotice = !!dynamicNpcLifecycleNoticeToggle?.checked;
            const noticeCompact = !!dynamicNpcNoticeCompactToggle?.checked;
            const noticeCooldown = clampInt(dynamicNpcNoticeCooldownInput?.value, 0, 20, 2);
            const noticeLevelRaw = String(dynamicNpcNoticeLevelSelect?.value || "normal").trim().toLowerCase();
            const noticeLevel = ["minimal", "normal", "verbose"].includes(noticeLevelRaw) ? noticeLevelRaw : "normal";
            CYOA.CONFIG.DYNAMIC_NPC_ENABLED = enabled;
            CYOA.CONFIG.DYNAMIC_NPC_SPAWN_CHANCE = spawnChance;
            CYOA.CONFIG.DYNAMIC_NPC_SPAWN_COOLDOWN_TURNS = cooldown;
            CYOA.CONFIG.DYNAMIC_NPC_MAX_PER_CONTEXT = maxPerContext;
            CYOA.CONFIG.DYNAMIC_NPC_MAX_GLOBAL = maxGlobal;
            CYOA.CONFIG.DYNAMIC_NPC_STALE_TURNS = staleTurns;
            CYOA.CONFIG.DYNAMIC_NPC_MIGRATION_CHANCE = migrationChance;
            CYOA.CONFIG.DYNAMIC_NPC_SAME_REGION_ONLY = sameRegionOnly;
            CYOA.CONFIG.DYNAMIC_NPC_LIFECYCLE_NOTICE = lifecycleNotice;
            CYOA.CONFIG.DYNAMIC_NPC_NOTICE_COMPACT = noticeCompact;
            CYOA.CONFIG.DYNAMIC_NPC_NOTICE_COOLDOWN_TURNS = noticeCooldown;
            CYOA.CONFIG.DYNAMIC_NPC_NOTICE_LEVEL = noticeLevel;
            try {
                const current = CYOA.loadPluginSettings?.() || {};
                current.DYNAMIC_NPC_ENABLED = enabled;
                current.DYNAMIC_NPC_SPAWN_CHANCE = spawnChance;
                current.DYNAMIC_NPC_SPAWN_COOLDOWN_TURNS = cooldown;
                current.DYNAMIC_NPC_MAX_PER_CONTEXT = maxPerContext;
                current.DYNAMIC_NPC_MAX_GLOBAL = maxGlobal;
                current.DYNAMIC_NPC_STALE_TURNS = staleTurns;
                current.DYNAMIC_NPC_MIGRATION_CHANCE = migrationChance;
                current.DYNAMIC_NPC_SAME_REGION_ONLY = sameRegionOnly;
                current.DYNAMIC_NPC_LIFECYCLE_NOTICE = lifecycleNotice;
                current.DYNAMIC_NPC_NOTICE_COMPACT = noticeCompact;
                current.DYNAMIC_NPC_NOTICE_COOLDOWN_TURNS = noticeCooldown;
                current.DYNAMIC_NPC_NOTICE_LEVEL = noticeLevel;
                CYOA.savePluginSettings?.(current);
            } catch (_) {}
            CYOA.log?.("DYNAMIC_NPC_SETTINGS =", { enabled, spawnChance, cooldown, maxPerContext, maxGlobal, staleTurns, migrationChance, sameRegionOnly, lifecycleNotice, noticeCompact, noticeCooldown, noticeLevel });
        };
        syncDynamicNpcInputs();
        if (dynamicNpcEnabledToggle) dynamicNpcEnabledToggle.onchange = persistDynamicNpcSettings;
        if (dynamicNpcSpawnChanceInput) dynamicNpcSpawnChanceInput.onchange = () => { syncDynamicNpcInputs(); persistDynamicNpcSettings(); };
        if (dynamicNpcCooldownInput) dynamicNpcCooldownInput.onchange = () => { syncDynamicNpcInputs(); persistDynamicNpcSettings(); };
        if (dynamicNpcMaxPerContextInput) dynamicNpcMaxPerContextInput.onchange = () => { syncDynamicNpcInputs(); persistDynamicNpcSettings(); };
        if (dynamicNpcMaxGlobalInput) dynamicNpcMaxGlobalInput.onchange = () => { syncDynamicNpcInputs(); persistDynamicNpcSettings(); };
        if (dynamicNpcStaleTurnsInput) dynamicNpcStaleTurnsInput.onchange = () => { syncDynamicNpcInputs(); persistDynamicNpcSettings(); };
        if (dynamicNpcMigrationChanceInput) dynamicNpcMigrationChanceInput.onchange = () => { syncDynamicNpcInputs(); persistDynamicNpcSettings(); };
        if (dynamicNpcSameRegionOnlyToggle) dynamicNpcSameRegionOnlyToggle.onchange = persistDynamicNpcSettings;
        if (dynamicNpcLifecycleNoticeToggle) dynamicNpcLifecycleNoticeToggle.onchange = persistDynamicNpcSettings;
        if (dynamicNpcNoticeCompactToggle) dynamicNpcNoticeCompactToggle.onchange = persistDynamicNpcSettings;
        if (dynamicNpcNoticeCooldownInput) dynamicNpcNoticeCooldownInput.onchange = () => { syncDynamicNpcInputs(); persistDynamicNpcSettings(); };
        if (dynamicNpcNoticeLevelSelect) dynamicNpcNoticeLevelSelect.onchange = persistDynamicNpcSettings;

        const wordFilterToggle = CYOA.$("cyoaWordFilterEnabledToggle");
        if (wordFilterToggle) {
            wordFilterToggle.onchange = () => {
                const enabled = !!wordFilterToggle.checked;
                CYOA.CONFIG.WORD_FILTER_ENABLED = enabled;
                try {
                    const current = CYOA.loadPluginSettings?.() || {};
                    current.WORD_FILTER_ENABLED = enabled;
                    CYOA.savePluginSettings?.(current);
                } catch (_) {}
                CYOA.log?.("WORD_FILTER_ENABLED =", enabled);
            };
        }

        const modelProfileSelect = CYOA.$("cyoaModelProfileSelect");
        const guardProfileSelect = CYOA.$("cyoaGuardProfileSelect");
        const heartbeatTurnsInput = CYOA.$("cyoaHeartbeatTurnsInput");
        const chatTemperatureInput = CYOA.$("cyoaChatTemperatureInput");
        const topPInput = CYOA.$("cyoaTopPInput");
        const constraintPresetSelect = CYOA.$("cyoaConstraintPresetSelect");
        const constraintPresetApplyBtn = CYOA.$("cyoaConstraintPresetApplyBtn");
        const modelProfileHint = CYOA.$("cyoaModelProfileHint");
        if (modelProfileSelect) {
            const profileToHeartbeat = { small_7b_9b: 6, medium_13b_34b: 8, large_70b_plus: 10 };
            const constraintPresets = {
                beginner: { guard: "strict", temp: 0.10, topP: 0.80 },
                stable: { guard: "balanced", temp: 0.15, topP: 0.85 },
                hardcore: { guard: "strict", temp: 0.08, topP: 0.75 }
            };
            const clampTurns = (v) => {
                const n = Number(v);
                if (!Number.isFinite(n)) return 6;
                return Math.max(1, Math.min(30, Math.round(n)));
            };
            const clampTemp = (v) => {
                const n = Number(v);
                if (!Number.isFinite(n)) return 0.15;
                return Math.max(0, Math.min(1, Math.round(n * 100) / 100));
            };
            const clampTopP = (v) => {
                const n = Number(v);
                if (!Number.isFinite(n)) return 0.9;
                return Math.max(0, Math.min(1, Math.round(n * 100) / 100));
            };
            const saveProfileAndTurns = (profile, turns, temperatureOverride, topPOverride) => {
                const chatTemp = clampTemp(temperatureOverride ?? chatTemperatureInput?.value ?? CYOA.CONFIG?.AI_CHAT_TEMPERATURE ?? 0.15);
                const topP = clampTopP(topPOverride ?? topPInput?.value ?? CYOA.CONFIG?.AI_TOP_P ?? 0.9);
                CYOA.CONFIG.AI_MODEL_PROFILE = profile;
                CYOA.CONFIG.AI_DEFINITION_HEARTBEAT_TURNS = clampTurns(turns);
                CYOA.CONFIG.AI_CHAT_TEMPERATURE = chatTemp;
                CYOA.CONFIG.AI_TOP_P = topP;
                try {
                    const current = CYOA.loadPluginSettings?.() || {};
                    current.AI_MODEL_PROFILE = CYOA.CONFIG.AI_MODEL_PROFILE;
                    current.AI_DEFINITION_HEARTBEAT_TURNS = CYOA.CONFIG.AI_DEFINITION_HEARTBEAT_TURNS;
                    current.AI_CHAT_TEMPERATURE = CYOA.CONFIG.AI_CHAT_TEMPERATURE;
                    current.AI_TOP_P = CYOA.CONFIG.AI_TOP_P;
                    current.AI_GUARD_PROFILE = String(CYOA.CONFIG?.AI_GUARD_PROFILE || "strict");
                    CYOA.savePluginSettings?.(current);
                } catch (_) {}
            };
            const profileHintText = (profile, turns) => {
                if (profile === "small_7b_9b") return `适合 7B-9B：建议每 ${turns} 回合发送轻量定义包；温度建议 0.10-0.20，Top P 建议 0.70-0.95。`;
                if (profile === "medium_13b_34b") return `适合 13B-34B：建议每 ${turns} 回合发送轻量定义包；温度建议 0.10-0.20，Top P 建议 0.70-0.95。`;
                return `适合 70B+：建议每 ${turns} 回合发送轻量定义包；温度建议 0.10-0.20，Top P 建议 0.70-0.95。`;
            };
            const detectConstraintPreset = () => {
                const curGuard = String(guardProfileSelect?.value || CYOA.CONFIG?.AI_GUARD_PROFILE || "strict").trim().toLowerCase();
                const curTemp = clampTemp(chatTemperatureInput?.value ?? CYOA.CONFIG?.AI_CHAT_TEMPERATURE ?? 0.15);
                const curTopP = clampTopP(topPInput?.value ?? CYOA.CONFIG?.AI_TOP_P ?? 0.9);
                const near = (a, b) => Math.abs(Number(a) - Number(b)) <= 0.01;
                for (const [k, v] of Object.entries(constraintPresets)) {
                    if (curGuard === v.guard && near(curTemp, v.temp) && near(curTopP, v.topP)) return k;
                }
                return "custom";
            };
            const syncHint = () => {
                const profile = String(modelProfileSelect.value || "small_7b_9b");
                const turns = clampTurns(heartbeatTurnsInput?.value || CYOA.CONFIG?.AI_DEFINITION_HEARTBEAT_TURNS || profileToHeartbeat[profile] || 6);
                if (heartbeatTurnsInput) heartbeatTurnsInput.value = String(turns);
                if (chatTemperatureInput) chatTemperatureInput.value = String(clampTemp(chatTemperatureInput.value || CYOA.CONFIG?.AI_CHAT_TEMPERATURE || 0.15).toFixed(2));
                if (topPInput) topPInput.value = String(clampTopP(topPInput.value || CYOA.CONFIG?.AI_TOP_P || 0.9).toFixed(2));
                if (constraintPresetSelect) constraintPresetSelect.value = detectConstraintPreset();
                if (modelProfileHint) modelProfileHint.textContent = profileHintText(profile, turns);
            };
            const applyConstraintPreset = (presetKey) => {
                const p = constraintPresets[presetKey];
                if (!p) return;
                if (guardProfileSelect) guardProfileSelect.value = p.guard;
                CYOA.CONFIG.AI_GUARD_PROFILE = p.guard;
                const profile = String(modelProfileSelect.value || "small_7b_9b");
                const turns = clampTurns(heartbeatTurnsInput?.value || CYOA.CONFIG?.AI_DEFINITION_HEARTBEAT_TURNS || profileToHeartbeat[profile] || 6);
                if (chatTemperatureInput) chatTemperatureInput.value = p.temp.toFixed(2);
                if (topPInput) topPInput.value = p.topP.toFixed(2);
                saveProfileAndTurns(profile, turns, p.temp, p.topP);
                syncHint();
                CYOA.log?.("AI_CONSTRAINT_PRESET =", presetKey, "AI_GUARD_PROFILE =", p.guard, "AI_CHAT_TEMPERATURE =", p.temp, "AI_TOP_P =", p.topP);
            };
            syncHint();
            modelProfileSelect.onchange = () => {
                const profile = String(modelProfileSelect.value || "small_7b_9b");
                const turns = Number(profileToHeartbeat[profile] || 6);
                if (heartbeatTurnsInput) heartbeatTurnsInput.value = String(turns);
                saveProfileAndTurns(profile, turns);
                syncHint();
                CYOA.log?.("AI_MODEL_PROFILE =", profile, "AI_DEFINITION_HEARTBEAT_TURNS =", turns, "AI_CHAT_TEMPERATURE =", CYOA.CONFIG?.AI_CHAT_TEMPERATURE, "AI_TOP_P =", CYOA.CONFIG?.AI_TOP_P);
            };
            if (heartbeatTurnsInput) {
                heartbeatTurnsInput.onchange = () => {
                    const profile = String(modelProfileSelect.value || "small_7b_9b");
                    const turns = clampTurns(heartbeatTurnsInput.value);
                    heartbeatTurnsInput.value = String(turns);
                    saveProfileAndTurns(profile, turns);
                    syncHint();
                    CYOA.log?.("AI_DEFINITION_HEARTBEAT_TURNS =", turns, "profile =", profile);
                };
            }
            if (chatTemperatureInput) {
                chatTemperatureInput.onchange = () => {
                    const profile = String(modelProfileSelect.value || "small_7b_9b");
                    const turns = clampTurns(heartbeatTurnsInput?.value || CYOA.CONFIG?.AI_DEFINITION_HEARTBEAT_TURNS || 6);
                    const temp = clampTemp(chatTemperatureInput.value);
                    chatTemperatureInput.value = temp.toFixed(2);
                    saveProfileAndTurns(profile, turns, temp);
                    syncHint();
                    CYOA.log?.("AI_CHAT_TEMPERATURE =", temp, "profile =", profile);
                };
            }
            if (topPInput) {
                topPInput.onchange = () => {
                    const profile = String(modelProfileSelect.value || "small_7b_9b");
                    const turns = clampTurns(heartbeatTurnsInput?.value || CYOA.CONFIG?.AI_DEFINITION_HEARTBEAT_TURNS || 6);
                    const topP = clampTopP(topPInput.value);
                    topPInput.value = topP.toFixed(2);
                    saveProfileAndTurns(profile, turns, undefined, topP);
                    syncHint();
                    CYOA.log?.("AI_TOP_P =", topP, "profile =", profile);
                };
            }
            if (constraintPresetApplyBtn) {
                constraintPresetApplyBtn.onclick = () => {
                    const key = String(constraintPresetSelect?.value || "custom");
                    if (key === "custom") return;
                    applyConstraintPreset(key);
                };
            }
        }

        if (guardProfileSelect) {
            guardProfileSelect.onchange = () => {
                const guardProfile = String(guardProfileSelect.value || "strict").trim().toLowerCase();
                const next = (guardProfile === "balanced" || guardProfile === "free") ? guardProfile : "strict";
                CYOA.CONFIG.AI_GUARD_PROFILE = next;
                try {
                    const current = CYOA.loadPluginSettings?.() || {};
                    current.AI_GUARD_PROFILE = next;
                    CYOA.savePluginSettings?.(current);
                } catch (_) {}
                CYOA.log?.("AI_GUARD_PROFILE =", next);
            };
        }

        const localFallbackToggle = CYOA.$("cyoaAllowLocalFallbackToggle");
        if (localFallbackToggle) {
            localFallbackToggle.onchange = () => {
                const enabled = !!localFallbackToggle.checked;
                CYOA.CONFIG.ALLOW_LOCAL_FALLBACK = enabled;
                try {
                    const current = CYOA.loadPluginSettings?.() || {};
                    current.ALLOW_LOCAL_FALLBACK = enabled;
                    CYOA.savePluginSettings?.(current);
                } catch (_) {}
                CYOA.log?.("ALLOW_LOCAL_FALLBACK =", enabled);
            };
        }

        CYOA.loadGamesList().then(() => {
            renderGameListItems(CYOA.$("cyoaGameList"));
        });
    };
})();
