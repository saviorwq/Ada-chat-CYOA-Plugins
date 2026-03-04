/**
 * CYOA main llm debug module
 * Extracted from cyoa-main.js to reduce file size.
 */
(function() {
    const CYOA = window.CYOA;
    if (!CYOA || !CYOA.CONFIG) return;

    const t = CYOA.t || ((k) => k);
    const escapeHtml = CYOA.escapeHtml || ((s) => String(s || ""));

    function getEnabledChatModelsForDebug() {
        return (CYOA.getChatModels?.() || [])
            .filter(m => String(m?.value || "").trim())
            .map(m => ({ value: String(m.value), label: String(m.label || m.value) }));
    }

    function ensureLlmDebugDraft() {
        if (!Array.isArray(CYOA._llmDebugDraft)) {
            const settings = CYOA.loadPluginSettings?.() || {};
            const rows = Array.isArray(settings.LLM_TUNINGS) ? settings.LLM_TUNINGS : [];
            CYOA._llmDebugDraft = rows.slice(0, 10).map(r => ({ ...r }));
        }
        return CYOA._llmDebugDraft;
    }

    function getCurrentGameModelForDebug() {
        const fallback = (getEnabledChatModelsForDebug()[0] || {}).value || "";
        return String(window.gameModeModel || document.getElementById("model")?.value || fallback).trim();
    }

    function getNpcNamesForDebug() {
        const game = CYOA.currentGame || {};
        const save = CYOA.currentSave || {};
        const chars = Array.isArray(game.characters) ? game.characters : [];
        const playerId = String(save.playerCharacterId || "").trim();
        const playerName = String(save.playerCharacter || "").trim();
        return chars
            .filter((c) => {
                const roleType = String(c?.roleType || "").trim().toLowerCase();
                const role = String(c?.role || "").trim().toLowerCase();
                const cid = String(c?.id || "").trim();
                const cname = String(c?.name || "").trim();
                if ((playerId && cid === playerId) || (playerName && cname === playerName)) return false;
                if (roleType === "playable" || role === "playable") return false;
                return !!(cid || cname);
            })
            .map((c) => String(c?.name || c?.id || "").trim())
            .filter(Boolean)
            .slice(0, 16);
    }

    function getLlmDebugTargetOptions() {
        const game = CYOA.currentGame || {};
        const save = CYOA.currentSave || {};
        const chars = Array.isArray(game.characters) ? game.characters : [];
        const playerId = String(save.playerCharacterId || "").trim();
        const playerName = String(save.playerCharacter || "").trim();
        const options = [{ value: "__narrator__", label: "天道（叙事者）" }];
        chars.forEach((c) => {
            const roleType = String(c?.roleType || "").trim().toLowerCase();
            const role = String(c?.role || "").trim().toLowerCase();
            const cid = String(c?.id || "").trim();
            const cname = String(c?.name || cid).trim();
            if (!cid && !cname) return;
            if ((playerId && cid === playerId) || (playerName && cname === playerName)) return;
            if (roleType === "playable" || role === "playable") return;
            const value = cid || cname;
            const label = cid ? `${cname} (${cid})` : cname;
            if (!options.find(it => it.value === value)) options.push({ value, label });
        });
        return options;
    }

    function buildLlmDebugPanel() {
        const draft = ensureLlmDebugDraft();
        CYOA._llmDebugDraft = draft.slice(0, 10);
        const npcNames = getNpcNamesForDebug();
        const targetOptions = getLlmDebugTargetOptions();
        const npcText = npcNames.length
            ? npcNames.map(n => `<span style="display:inline-flex;align-items:center;padding:2px 6px;border:1px solid var(--border);border-radius:999px;font-size:11px;background:var(--bg);">${escapeHtml(n)}</span>`).join(" ")
            : `<span style="font-size:11px;color:var(--text-light);">暂无可识别 NPC（仍可配置天道叙事规则）</span>`;
        const rowsHtml = draft.length
            ? draft.map((row, idx) => {
                const rid = String(row?.id || `llm_tune_${idx}`);
                const targetId = String(row?.targetId || "__narrator__").trim() || "__narrator__";
                const targetSelectOptions = targetOptions.map(opt => (
                    `<option value="${escapeHtml(opt.value)}" ${opt.value === targetId ? "selected" : ""}>${escapeHtml(opt.label)}</option>`
                )).join("");
                return `
                    <div data-llm-row="${escapeHtml(rid)}" style="border:1px solid var(--border); border-radius:8px; padding:8px; margin-top:8px;">
                        <div style="display:flex; gap:8px; align-items:center; margin-bottom:6px; flex-wrap:wrap;">
                            <label style="display:flex; gap:6px; align-items:center; font-size:12px;">
                                <input type="checkbox" data-llm-field="enabled" ${row.enabled !== false ? "checked" : ""}>
                                启用
                            </label>
                            <select class="cyoa-select" data-llm-field="targetId" style="min-width:220px; height:28px;">
                                ${targetSelectOptions}
                            </select>
                            <input class="cyoa-input" data-llm-field="label" value="${escapeHtml(String(row.label || ""))}" placeholder="规则名（可选）" style="min-width:140px; height:28px;">
                            <button class="cyoa-btn cyoa-btn-danger" data-llm-del="${escapeHtml(rid)}" style="padding:2px 8px; font-size:11px;">删除</button>
                        </div>
                        <textarea class="cyoa-textarea" data-llm-field="instruction" rows="2" placeholder="例如：禁止开头寒暄；优先短句；不得输出英文注释等">${escapeHtml(String(row.instruction || ""))}</textarea>
                    </div>
                `;
            }).join("")
            : `<div style="font-size:12px; color:var(--text-light); margin-top:8px;">暂无规则。可新增并作用于 NPC/天道叙事。</div>`;

        return `
            <div style="font-size:12px; color:var(--text-light); margin-bottom:8px;">规则仅面向游戏中的 NPC/天道叙事，不再按模型列表配置（保存后下一条消息生效）。</div>
            <div style="display:flex; flex-direction:column; gap:6px; margin-bottom:8px;">
                <div style="display:flex; flex-wrap:wrap; gap:6px; align-items:center;">
                    <span style="font-size:11px; color:var(--text-light);">NPC：</span>
                    ${npcText}
                </div>
            </div>
            <div id="cyoaLlmDebugList">${rowsHtml}</div>
            <div style="display:flex; gap:8px; margin-top:10px; flex-wrap:nowrap; overflow-x:auto; padding-bottom:2px;">
                <button class="cyoa-btn cyoa-btn-secondary" id="cyoaLlmDebugAddBtn" style="white-space:nowrap; flex:0 0 auto;">+ 新增规则</button>
                <button class="cyoa-btn cyoa-btn-secondary" id="cyoaLlmDebugClearCurrentBtn" style="white-space:nowrap; flex:0 0 auto;">清空全部规则</button>
                <button class="cyoa-btn cyoa-btn-secondary" id="cyoaLlmDebugExportBtn" style="white-space:nowrap; flex:0 0 auto;">导出规则</button>
                <button class="cyoa-btn cyoa-btn-secondary" id="cyoaLlmDebugImportBtn" style="white-space:nowrap; flex:0 0 auto;">导入规则</button>
                <button class="cyoa-btn cyoa-btn-primary" id="cyoaLlmDebugSaveBtn" style="white-space:nowrap; flex:0 0 auto;">保存微调</button>
            </div>
            <input id="cyoaLlmDebugImportInput" type="file" accept=".json,application/json" style="display:none;">
        `;
    }

    function bindLlmDebugPanelEvents(container) {
        if (!container) return;
        const draft = ensureLlmDebugDraft();
        const syncDraftFromDom = () => {
            const activeModel = getCurrentGameModelForDebug();
            container.querySelectorAll("#cyoaLlmDebugList [data-llm-row]").forEach((rowEl) => {
                const rid = String(rowEl.getAttribute("data-llm-row") || "");
                const rowRef = draft.find(x => String(x?.id || "") === rid);
                if (!rowRef) return;
                const enabledEl = rowEl.querySelector('[data-llm-field="enabled"]');
                const targetEl = rowEl.querySelector('[data-llm-field="targetId"]');
                const labelEl = rowEl.querySelector('[data-llm-field="label"]');
                const insEl = rowEl.querySelector('[data-llm-field="instruction"]');
                rowRef.enabled = !!enabledEl?.checked;
                rowRef.model = activeModel;
                rowRef.targetId = String(targetEl?.value || "__narrator__").trim() || "__narrator__";
                rowRef.label = String(labelEl?.value || "").trim();
                rowRef.instruction = String(insEl?.value || "").trim();
            });
        };

        container.querySelectorAll("#cyoaLlmDebugList [data-llm-del]").forEach((btn) => {
            btn.addEventListener("click", () => {
                syncDraftFromDom();
                const rid = String(btn.getAttribute("data-llm-del") || "");
                CYOA._llmDebugDraft = draft.filter(x => String(x?.id || "") !== rid);
                CYOA.renderLlmDebugPanel?.();
            });
        });
        container.querySelector("#cyoaLlmDebugAddBtn")?.addEventListener("click", () => {
            syncDraftFromDom();
            if (draft.length >= 10) return alert("最多只能配置 10 条 LLM 微调规则。");
            draft.push({
                id: `llm_tune_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                enabled: true,
                model: getCurrentGameModelForDebug(),
                targetId: "__narrator__",
                label: "",
                instruction: ""
            });
            CYOA._llmDebugDraft = draft;
            CYOA.renderLlmDebugPanel?.();
        });
        container.querySelector("#cyoaLlmDebugClearCurrentBtn")?.addEventListener("click", () => {
            syncDraftFromDom();
            const removed = draft.length;
            CYOA._llmDebugDraft = [];
            CYOA.appendSystemMessage?.(`🧪 已清空全部 ${removed} 条草稿规则`);
            CYOA.renderLlmDebugPanel?.();
        });
        container.querySelector("#cyoaLlmDebugExportBtn")?.addEventListener("click", () => {
            syncDraftFromDom();
            const rows = draft.slice(0, 10).map((it) => ({
                id: String(it?.id || "").trim() || `llm_tune_${Date.now()}`,
                enabled: it?.enabled !== false,
                model: String(it?.model || "").trim(),
                targetId: String(it?.targetId || "__narrator__").trim() || "__narrator__",
                label: String(it?.label || "").trim(),
                instruction: String(it?.instruction || "").trim()
            })).filter((it) => it.model && it.targetId && it.instruction);
            try {
                const payload = { version: 1, exportedAt: new Date().toISOString(), LLM_TUNINGS: rows };
                const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `cyoa_llm_tunings_${Date.now()}.json`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(url);
            } catch (_) {
                alert("导出失败，请稍后重试。");
            }
        });
        const importInput = container.querySelector("#cyoaLlmDebugImportInput");
        container.querySelector("#cyoaLlmDebugImportBtn")?.addEventListener("click", () => importInput?.click());
        if (importInput) {
            importInput.onchange = () => {
                const file = importInput.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => {
                    try {
                        syncDraftFromDom();
                        const parsed = JSON.parse(String(reader.result || ""));
                        const incoming = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.LLM_TUNINGS) ? parsed.LLM_TUNINGS : []);
                        const normalized = typeof CYOA.normalizeLLMTunings === "function" ? CYOA.normalizeLLMTunings(incoming) : incoming;
                        const merged = draft.concat(normalized || []);
                        const dedup = [];
                        const seen = new Set();
                        merged.forEach((it) => {
                            const id = String(it?.id || "").trim();
                            const model = String(it?.model || "").trim();
                            const targetId = String(it?.targetId || "__narrator__").trim() || "__narrator__";
                            const inst = String(it?.instruction || "").trim();
                            const key = id || `${model}::${targetId}::${inst}`;
                            if (!model || !targetId || !inst || seen.has(key)) return;
                            seen.add(key);
                            dedup.push({
                                id: id || `llm_tune_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                                enabled: it?.enabled !== false,
                                model,
                                targetId,
                                label: String(it?.label || "").trim(),
                                instruction: inst
                            });
                        });
                        CYOA._llmDebugDraft = dedup.slice(0, 10);
                        CYOA.appendSystemMessage?.(`🧪 已导入 ${CYOA._llmDebugDraft.length} 条微调规则（草稿）`);
                        CYOA.renderLlmDebugPanel?.();
                    } catch (_) {
                        alert("导入失败：JSON 格式不正确。");
                    } finally {
                        importInput.value = "";
                    }
                };
                reader.readAsText(file);
            };
        }
        container.querySelector("#cyoaLlmDebugSaveBtn")?.addEventListener("click", () => {
            syncDraftFromDom();
            const activeModel = getCurrentGameModelForDebug();
            const cleaned = draft.slice(0, 10).map((it) => ({
                id: String(it?.id || "").trim() || `llm_tune_${Date.now()}`,
                enabled: it?.enabled !== false,
                model: String(it?.model || activeModel).trim(),
                targetId: String(it?.targetId || "__narrator__").trim() || "__narrator__",
                label: String(it?.label || "").trim(),
                instruction: String(it?.instruction || "").trim()
            })).filter((it) => it.model && it.targetId && it.instruction);
            const current = CYOA.loadPluginSettings?.() || {};
            current.LLM_TUNINGS = cleaned;
            const saved = CYOA.savePluginSettings?.(current) || current;
            CYOA.CONFIG.LLM_TUNINGS = Array.isArray(saved.LLM_TUNINGS) ? saved.LLM_TUNINGS : cleaned;
            CYOA._llmDebugDraft = CYOA.CONFIG.LLM_TUNINGS.slice(0, 10);
            CYOA.log?.("LLM_TUNINGS saved:", CYOA._llmDebugDraft.length);
            CYOA.appendSystemMessage?.(`🧪 已保存 ${CYOA._llmDebugDraft.length} 条模型微调规则`);
            CYOA.renderLlmDebugPanel?.();
        });
    }

    CYOA.renderLlmDebugPanel = function() {
        const container = document.getElementById("cyoaLlmdebugPanel");
        if (!container || !CYOA.currentSave) return;
        container.innerHTML = buildLlmDebugPanel();
        bindLlmDebugPanelEvents(container);
    };
})();
