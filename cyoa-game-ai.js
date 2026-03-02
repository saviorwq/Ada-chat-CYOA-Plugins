/**
 * CYOA Game AI Module (Phase 1 scaffold)
 * AI 交互与解析模块（第一阶段骨架）
 */
(function() {
    const CYOA = window.CYOA;
    if (!CYOA || !CYOA.CONFIG) return;

    CYOA.GameAI = CYOA.GameAI || {};
    CYOA.GameAI.__moduleName = 'ai';
    CYOA.GameAI.__ready = true;
})();
/* AI module for CYOA game generation and narration helpers */
(function() {
    const CYOA = window.CYOA;
    if (!CYOA || !CYOA.CONFIG) return;

    const t = CYOA.t || ((k) => k);

    function withModelTuning(systemPrompt, modelValue) {
        const base = String(systemPrompt || "").trim();
        const tuning = String(CYOA.getModelTuningPrompt?.(modelValue) || "").trim();
        if (!tuning) return base;
        return `${base}\n\n[Model-specific tuning]\n${tuning}`;
    }

    function extractJsonFromText(text) {
        const raw = String(text || "").trim();
        if (!raw) throw new Error("AI empty response");
        const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
        const payload = fenced ? fenced[1] : raw;
        const start = payload.indexOf("{");
        const end = payload.lastIndexOf("}");
        const jsonStr = (start >= 0 && end > start) ? payload.slice(start, end + 1) : payload;
        return JSON.parse(jsonStr);
    }

    CYOA.sanitizeGameFromAI = function(raw) {
        const def = JSON.parse(JSON.stringify(CYOA.CONFIG.DEFAULT_GAME || {}));
        const out = { ...def, ...(raw || {}) };
        if (!out.id) out.id = "game_" + CYOA.generateId();
        if (!out.name) out.name = t("ui.status.unnamedGame") || "未命名游戏";
        if (!Array.isArray(out.characters)) out.characters = [];
        if (!Array.isArray(out.scenes)) out.scenes = [];
        if (!Array.isArray(out.chapters)) out.chapters = [];
        if (!Array.isArray(out.attributes)) out.attributes = [];
        if (!Array.isArray(out.items)) out.items = [];
        if (!Array.isArray(out.equipment)) out.equipment = [];
        if (!Array.isArray(out.locations)) out.locations = [];
        if (!Array.isArray(out.locationEdges)) out.locationEdges = [];
        if (!Array.isArray(out.quests)) out.quests = [];
        if (!Array.isArray(out.equipmentSynergies)) out.equipmentSynergies = [];
        if (!Array.isArray(out.discoveryRules)) out.discoveryRules = [];
        if (!Array.isArray(out.outfitPresets)) out.outfitPresets = [];
        if (!Array.isArray(out.storyCards)) out.storyCards = [];
        if (!Array.isArray(out.skills)) out.skills = [];
        if (!Array.isArray(out.professions)) out.professions = [];
        out.initialChapter = out.initialChapter ?? "";
        out.updatedAt = new Date().toISOString();
        if (!out.createdAt) out.createdAt = out.updatedAt;
        return out;
    };

    CYOA.generateGameWithAI = async function(userIdea, modelValue, useRulesMode, onProgress) {
        if (onProgress) onProgress(t("ui.msg.aiGenerating") || "AI 生成中...");

        const systemPrompt = useRulesMode
            ? "你是 CYOA 配置生成器。将规则书转换为 JSON，仅输出 JSON。"
            : "你是 CYOA 配置生成器。根据创意生成 JSON，仅输出 JSON。";
        const userPrompt = useRulesMode
            ? `请将以下规则书转换为 CYOA JSON：\n\n${userIdea}`
            : `请根据以下创意生成 CYOA JSON：\n\n${userIdea}`;

        const r = await fetch("ai_proxy.php", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: modelValue,
                task: "chat",
                client: "cyoa",
                bypassCostOptimizer: CYOA.CONFIG?.AI_BYPASS_COST_OPTIMIZER !== false,
                messages: [
                    { role: "system", content: withModelTuning(systemPrompt, modelValue) },
                    { role: "user", content: userPrompt }
                ],
                stream: false
            })
        });
        if (!r.ok) throw new Error(`AI request failed: HTTP ${r.status}`);
        const d = await r.json();
        const content = d?.choices?.[0]?.message?.content || "";
        const parsed = extractJsonFromText(content);
        return CYOA.sanitizeGameFromAI(parsed);
    };

    CYOA.requestAIExpand = async function(textareaId, hint) {
        const el = document.getElementById(textareaId);
        if (!el) return;
        const input = (el.value || "").trim();
        if (!input) {
            alert(t("ui.msg.aiExpandEmpty"));
            return;
        }
        const sysPrompt = hint === "narrator"
            ? "将以下叙述者提示扩展为更完整版本，只输出中文文本。"
            : "将以下世界设定扩展为更完整版本，只输出中文文本。";
        const model = window.gameModeModel || document.getElementById("model")?.value;
        try {
            const r = await fetch("ai_proxy.php", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    model,
                    task: "chat",
                    client: "cyoa",
                    bypassCostOptimizer: CYOA.CONFIG?.AI_BYPASS_COST_OPTIMIZER !== false,
                    messages: [
                        { role: "system", content: withModelTuning(sysPrompt, model) },
                        { role: "user", content: input }
                    ],
                    stream: false
                })
            });
            if (!r.ok) throw new Error("AI expand failed");
            const d = await r.json();
            const result = (d?.choices?.[0]?.message?.content || "").trim();
            if (result) el.value = result;
        } catch (e) {
            alert(`AI 扩展失败：${e?.message || e}`);
        }
    };

    CYOA.parseAndApplyItemChanges = function(aiText) {
        const save = CYOA.currentSave;
        const game = CYOA.currentGame;
        if (!save || !game || !aiText) return null;

        // 支持两种格式：
        // 1) ```cyoa_changes { ... }```
        // 2) ```json {"cyoa_changes":{...}}```
        const raw = String(aiText);
        let payload = null;

        const tagged = raw.match(/```cyoa_changes\s*([\s\S]*?)\s*```/i);
        if (tagged?.[1]) {
            try { payload = JSON.parse(tagged[1]); } catch (_) {}
        }
        if (!payload) {
            const jsonFence = raw.match(/```json\s*([\s\S]*?)\s*```/i);
            if (jsonFence?.[1]) {
                try {
                    const parsed = JSON.parse(jsonFence[1]);
                    payload = parsed?.cyoa_changes || null;
                } catch (_) {}
            }
        }
        const hasStructuredPayload = !!(payload && typeof payload === "object");
        if (!hasStructuredPayload) payload = {};

        if (!Array.isArray(save.inventory)) save.inventory = [];
        const out = {
            added: [],
            removed: [],
            moved: false,
            chapterChanged: false,
            attributesChanged: false,
            questsChanged: false,
            skillsChanged: false,
            presetApplied: false,
            durabilityChanged: false,
            textProtocolApplied: false,
            textProtocolHits: {
                gain: 0,
                consume: 0,
                durability: 0
            }
        };

        const asArray = (v) => Array.isArray(v) ? v : (v == null ? [] : [v]);
        const norm = (v) => String(v || "").trim().toLowerCase();
        const structuredAddedKeys = new Set();
        const structuredRemovedKeys = new Set();
        function addStructuredItemKeys(set, idOrName) {
            const rawKey = norm(idOrName);
            if (rawKey) set.add(rawKey);
            const byId = (game.items || []).find(x => x.id === idOrName) || (game.equipment || []).find(x => x.id === idOrName);
            const byName = (game.items || []).find(x => x.name === idOrName) || (game.equipment || []).find(x => x.name === idOrName);
            const def = byId || byName;
            if (def?.id) set.add(norm(def.id));
            if (def?.name) set.add(norm(def.name));
        }
        const normalizeItemChange = (it) => {
            if (typeof it === "string") return { id: it, quantity: 1 };
            return { id: it?.id || it?.name || "", quantity: Number(it?.quantity || 1) };
        };
        const addItems = asArray(payload.addItems).map(normalizeItemChange);
        addItems.forEach(it => {
            const id = String(it?.id || "").trim();
            if (!id) return;
            const qty = Math.max(1, Number(it?.quantity || 1));
            const defById = (game.items || []).find(x => x.id === id) || (game.equipment || []).find(x => x.id === id);
            const defByName = (game.items || []).find(x => x.name === id) || (game.equipment || []).find(x => x.name === id);
            const def = defById || defByName;
            const realId = def?.id || id;
            const inv = save.inventory.find(x => x.id === realId);
            if (inv) {
                inv.quantity = Number(inv.quantity || 1) + qty;
            } else {
                save.inventory.push({
                    id: realId,
                    name: def?.name || realId,
                    quantity: qty,
                    itemType: def?.itemType || (def ? "equipment" : "common"),
                    description: def?.description || ""
                });
            }
            out.added.push({ id: realId, quantity: qty });
            if (hasStructuredPayload) addStructuredItemKeys(structuredAddedKeys, realId);
        });

        const removeItems = asArray(payload.removeItems).map(normalizeItemChange);
        removeItems.forEach(it => {
            const id = String(it?.id || "").trim();
            if (!id) return;
            const qty = Math.max(1, Number(it?.quantity || 1));
            const idx = save.inventory.findIndex(x => x.id === id || x.name === id);
            if (idx < 0) return;
            const cur = Number(save.inventory[idx].quantity || 1);
            const next = cur - qty;
            if (next > 0) save.inventory[idx].quantity = next;
            else save.inventory.splice(idx, 1);
            out.removed.push({ id, quantity: Math.min(cur, qty) });
            if (hasStructuredPayload) addStructuredItemKeys(structuredRemovedKeys, id);
        });

        const nextLocationRaw = String(payload.setLocation || payload.location || "").trim();
        const nextLoc = (game.locations || []).find(l => l.id === nextLocationRaw || l.name === nextLocationRaw);
        if (nextLoc?.id) {
            save.currentLocation = nextLoc.id;
            out.moved = true;
        }

        const nextChapterRaw = String(payload.changeChapter || payload.chapter || "").trim();
        const nextChapter = (game.chapters || []).find(ch => ch.id === nextChapterRaw || ch.title === nextChapterRaw)?.id || "";
        if (nextChapter && typeof CYOA.changeChapter === "function") {
            CYOA.changeChapter(nextChapter);
            out.chapterChanged = true;
        }

        const setAttrs = payload.setAttributes || payload.attributes || null;
        if (setAttrs && typeof setAttrs === "object") {
            const attrs = save.attributes;
            Object.entries(setAttrs).forEach(([k, v]) => {
                const nv = Number(v);
                if (!Number.isFinite(nv)) return;
                if (Array.isArray(attrs)) {
                    const hit = attrs.find(a => a?.id === k || a?.name === k);
                    if (hit) {
                        const min = Number.isFinite(Number(hit.min)) ? Number(hit.min) : 0;
                        const max = Number.isFinite(Number(hit.max)) ? Number(hit.max) : 100;
                        hit.value = Math.max(min, Math.min(max, nv));
                    }
                } else if (attrs && typeof attrs === "object") {
                    attrs[k] = nv;
                }
            });
            out.attributesChanged = true;
        }

        const deltaAttrs = payload.deltaAttributes || null;
        if (deltaAttrs && typeof deltaAttrs === "object") {
            const attrs = save.attributes;
            Object.entries(deltaAttrs).forEach(([k, v]) => {
                const dv = Number(v);
                if (!Number.isFinite(dv)) return;
                if (Array.isArray(attrs)) {
                    const hit = attrs.find(a => a?.id === k || a?.name === k);
                    if (hit) {
                        const cur = Number(hit.value || 0);
                        const min = Number.isFinite(Number(hit.min)) ? Number(hit.min) : 0;
                        const max = Number.isFinite(Number(hit.max)) ? Number(hit.max) : 100;
                        hit.value = Math.max(min, Math.min(max, cur + dv));
                    }
                } else if (attrs && typeof attrs === "object") {
                    const cur = Number(attrs[k] || 0);
                    attrs[k] = cur + dv;
                }
            });
            out.attributesChanged = true;
        }

        const setPosture = String(payload.setPosture || "").trim();
        if (setPosture && typeof CYOA.setPosture === "function") CYOA.setPosture(setPosture);

        const travelTo = String(payload.travelTo || "").trim();
        if (travelTo && typeof CYOA.travelTo === "function") CYOA.travelTo(travelTo);
        const travelToRegion = String(payload.travelToRegion || payload.setRegion || "").trim();
        if (travelToRegion && typeof CYOA.travelToRegion === "function") {
            const ok = CYOA.travelToRegion(travelToRegion);
            if (ok) out.moved = true;
        }

        const learnSkills = asArray(payload.learnSkills || payload.learnSkill).map(String);
        if (learnSkills.length && typeof CYOA.learnSkill === "function") {
            learnSkills.forEach(sid => {
                if (sid) CYOA.learnSkill(sid, "ai");
            });
            out.skillsChanged = true;
        }
        const gainSkillProficiency = asArray(payload.gainSkillProficiency || payload.addSkillProficiency);
        if (gainSkillProficiency.length && typeof CYOA.gainSkillProficiency === "function") {
            gainSkillProficiency.forEach(entry => {
                if (typeof entry === "string") {
                    CYOA.gainSkillProficiency(entry, 10, "ai");
                } else if (entry && typeof entry === "object") {
                    CYOA.gainSkillProficiency(String(entry.skillId || entry.id || entry.name || ""), Number(entry.amount || entry.delta || 10), "ai");
                }
            });
            out.skillsChanged = true;
        }

        const applyOutfitPreset = String(payload.applyOutfitPreset || payload.useOutfitPreset || "").trim();
        if (applyOutfitPreset && typeof CYOA.applyOutfitPreset === "function") {
            const rep = CYOA.applyOutfitPreset(applyOutfitPreset);
            out.presetApplied = !!rep?.ok;
        }

        const setObserverAlert = Number(payload.setObserverAlert);
        if (Number.isFinite(setObserverAlert)) {
            save.observerAlert = Math.max(0, Math.min(100, setObserverAlert));
        }
        const deltaObserverAlert = Number(payload.deltaObserverAlert);
        if (Number.isFinite(deltaObserverAlert)) {
            save.observerAlert = Math.max(0, Math.min(100, Number(save.observerAlert || 0) + deltaObserverAlert));
        }

        const completeQuests = asArray(payload.completeQuests || payload.completeQuest).map(String);
        if (completeQuests.length && Array.isArray(save.quests)) {
            save.quests.forEach(q => {
                if (completeQuests.includes(String(q.id)) || completeQuests.includes(String(q.name || ""))) q.status = "completed";
            });
            out.questsChanged = true;
        }
        const activateQuests = asArray(payload.activateQuests || payload.activateQuest).map(String);
        if (activateQuests.length && Array.isArray(save.quests)) {
            save.quests.forEach(q => {
                if (activateQuests.includes(String(q.id)) || activateQuests.includes(String(q.name || ""))) q.status = "active";
            });
            out.questsChanged = true;
        }

        const forceNode = String(payload.jumpToNode || payload.setNode || "").trim();
        if (forceNode && typeof CYOA.jumpToNode === "function") CYOA.jumpToNode(forceNode);

        // 兼容旧文本协议：从叙事中解析“获得了 N 个 XXX”
        const gainPattern = /获得了\s*(\d+)\s*个?\s*([^，。\s]+)/g;
        let mg = null;
        while ((mg = gainPattern.exec(raw)) !== null) {
            const amount = Math.max(1, Number(mg[1] || 1));
            const itemName = String(mg[2] || "").trim();
            if (!itemName) continue;
            if (hasStructuredPayload && structuredAddedKeys.has(norm(itemName))) continue;
            const def = (game.items || []).find(i => i.name === itemName || i.id === itemName)
                || (game.equipment || []).find(i => i.name === itemName || i.id === itemName);
            if (!def) continue;
            const realId = def.id || itemName;
            if (hasStructuredPayload && (structuredAddedKeys.has(norm(realId)) || structuredAddedKeys.has(norm(def.name)))) continue;
            const maxQty = Number(CYOA.CONFIG?.ITEM_MAX_QUANTITY || 99);
            const existed = save.inventory.find(i => i.id === realId || i.name === def.name);
            if (existed) {
                existed.quantity = Math.min(maxQty, Number(existed.quantity || 1) + amount);
            } else {
                save.inventory.push({
                    id: realId,
                    name: def.name || realId,
                    quantity: Math.min(maxQty, amount),
                    itemType: def.itemType || (def.slots ? "equipment" : "common"),
                    description: def.description || ""
                });
            }
            if (!Array.isArray(save.acquiredItemIds)) save.acquiredItemIds = [];
            if (!save.acquiredItemIds.includes(realId)) save.acquiredItemIds.push(realId);
            CYOA.appendSystemMessage?.(`📦 获得物品：${def.name || realId}${amount > 1 ? ` ×${amount}` : ""}`);
            out.added.push({ id: realId, quantity: amount });
            out.textProtocolApplied = true;
            out.textProtocolHits.gain += 1;
        }

        // 兼容旧文本协议：从叙事中解析“消耗了 N 个 XXX”
        const consumePattern = /消耗了\s*(\d+)\s*个?\s*([^，。\s]+)/g;
        let mc = null;
        while ((mc = consumePattern.exec(raw)) !== null) {
            const amount = Math.max(1, Number(mc[1] || 1));
            const itemName = String(mc[2] || "").trim();
            if (!itemName) continue;
            if (hasStructuredPayload && structuredRemovedKeys.has(norm(itemName))) continue;
            const idx = save.inventory.findIndex(i => i.name === itemName || i.id === itemName);
            if (idx < 0) continue;
            const item = save.inventory[idx];
            if (hasStructuredPayload && (structuredRemovedKeys.has(norm(item.id)) || structuredRemovedKeys.has(norm(item.name)))) continue;
            const curQty = Number(item.quantity || 1);
            if (curQty > amount) {
                item.quantity = curQty - amount;
            } else if (typeof item.durability === "number" && item.durability > 0) {
                item.durability = item.durability - amount;
                if (item.durability <= 0) {
                    save.inventory.splice(idx, 1);
                    CYOA.appendSystemMessage?.(`❌ ${itemName} 已耗尽`);
                }
            } else {
                save.inventory.splice(idx, 1);
                CYOA.appendSystemMessage?.(`❌ ${itemName} 已耗尽`);
            }
            out.removed.push({ id: item.id || itemName, quantity: Math.min(curQty, amount) });
            out.textProtocolApplied = true;
            out.textProtocolHits.consume += 1;
        }

        // 兼容旧文本协议：从叙事中解析“X的耐久度下降了N”
        // 幂等保护：同一条消息里同一装备重复命中时，先合并再结算，避免重复损坏提示/重复属性撤销。
        const durabilityPattern = /([^，。\s]+)的耐久度[下降低了]了\s*(\d+)/g;
        const durabilityDeltaBySlot = new Map();
        let m = null;
        while ((m = durabilityPattern.exec(raw)) !== null) {
            const equipName = String(m[1] || "").trim();
            const amount = Math.max(0, Number(m[2] || 0));
            if (!equipName || amount <= 0) continue;

            for (const slot of Object.keys(save.equipment || {})) {
                const equip = save.equipment[slot];
                if (!equip?.id) continue;
                const def = (game.equipment || []).find(e => e.id === equip.id);
                const nameMatched = equip.name === equipName || def?.name === equipName || equip.id === equipName;
                if (!nameMatched) continue;
                const old = Number(durabilityDeltaBySlot.get(slot) || 0);
                durabilityDeltaBySlot.set(slot, old + amount);
                break;
            }
        }

        durabilityDeltaBySlot.forEach((amount, slot) => {
            const equip = save.equipment?.[slot];
            if (!equip?.id) return;
            const def = (game.equipment || []).find(e => e.id === equip.id);
            const equipName = equip.name || def?.name || equip.id;
            const isIndestructible = !!(equip.indestructible ?? def?.indestructible ?? false);
            if (isIndestructible) return;

            if (typeof equip.durability !== "number") {
                equip.durability = Number(def?.durability || 0);
            }
            equip.durability = Math.max(0, Number(equip.durability || 0) - amount);
            out.durabilityChanged = true;
            out.textProtocolApplied = true;
            out.textProtocolHits.durability += 1;
            if (equip.durability > 0) return;

            const brokenId = equip.id;
            Object.keys(save.equipment).forEach(k => {
                if (save.equipment[k]?.id === brokenId) delete save.equipment[k];
            });
            if (def?.statModifiers && typeof CYOA.parseStatModifiers === "function" && typeof CYOA.applyStatModifiers === "function") {
                const mods = CYOA.parseStatModifiers(def.statModifiers);
                CYOA.applyStatModifiers(mods, false);
            }
            CYOA.resolveCompoundPosture?.();
            CYOA.appendSystemMessage?.(`💔 ${equipName} 损坏了`);
            CYOA.addKeyEvent?.("degrade", `装备损坏：${equipName}`);
        });

        const hasAnyEffect = !!(
            out.moved ||
            out.chapterChanged ||
            out.attributesChanged ||
            out.questsChanged ||
            out.skillsChanged ||
            out.presetApplied ||
            out.durabilityChanged ||
            out.textProtocolApplied ||
            (out.added || []).length ||
            (out.removed || []).length
        );
        CYOA._lastItemChangeReport = hasAnyEffect ? {
            ts: Date.now(),
            hasStructuredPayload,
            ...out
        } : null;
        CYOA._pendingNodeChangeMeta = hasAnyEffect ? {
            ts: Date.now(),
            hasStructuredPayload,
            textProtocolApplied: !!out.textProtocolApplied,
            textProtocolHits: { ...(out.textProtocolHits || {}) },
            addedCount: (out.added || []).length,
            removedCount: (out.removed || []).length,
            durabilityChanged: !!out.durabilityChanged
        } : null;
        if (hasAnyEffect && typeof CYOA.addKeyEvent === "function") {
            const tp = out.textProtocolHits || {};
            const source = hasStructuredPayload ? "json" : "text";
            const nodeId = String(CYOA.currentSave?.currentNodeId || CYOA.currentNodeId || "root");
            const histLen = Array.isArray(CYOA.currentSave?.history) ? CYOA.currentSave.history.length : 0;
            const parts = [
                `node=${nodeId}`,
                `hist=${histLen}`,
                `source=${source}`,
                `text=${out.textProtocolApplied ? "on" : "off"}`,
                `gain=${tp.gain || 0}`,
                `consume=${tp.consume || 0}`,
                `durability=${tp.durability || 0}`,
                `added=${(out.added || []).length}`,
                `removed=${(out.removed || []).length}`
            ];
            const summary = `变更解析：${parts.join(", ")}`;
            const sig = summary;
            const nowTs = Date.now();
            const lastSig = String(CYOA._lastChangeParseSig || "");
            const lastTs = Number(CYOA._lastChangeParseTs || 0);
            if (sig !== lastSig || nowTs - lastTs > 1500) {
                CYOA.addKeyEvent("change_parse", summary);
                CYOA._lastChangeParseSig = sig;
                CYOA._lastChangeParseTs = nowTs;
            }
        }
        if (!hasStructuredPayload) {
            return hasAnyEffect ? out : null;
        }
        return out;
    };

    CYOA.grantQuestRewards = function(rewards) {
        const save = CYOA.currentSave;
        const game = CYOA.currentGame;
        if (!save || !game || !Array.isArray(rewards) || !rewards.length) return;
        rewards.forEach(rawReward => {
            const reward = String(rawReward || "").trim();
            if (!reward) return;

            if (reward.startsWith("物品:") || reward.startsWith("item:")) {
                const key = reward.split(":").slice(1).join(":").trim();
                if (key) {
                    CYOA.acquireItem?.(key, 1);
                    CYOA.appendSystemMessage?.(`📦 获得物品：${key}`);
                }
                return;
            }
            if (reward.startsWith("技能:") || reward.startsWith("skill:")) {
                const key = reward.split(":").slice(1).join(":").trim();
                if (!key) return;
                const def = (game.skills || []).find(s => s.id === key || s.name === key);
                if (def?.id) {
                    CYOA.learnSkill?.(def.id, "quest_reward");
                    CYOA.appendSystemMessage?.(`✨ 学会技能：${def.name || key}`);
                }
                return;
            }

            const attrPlus = reward.match(/^([^+\s:：]+)\s*\+\s*(\d+)$/);
            if (attrPlus && Array.isArray(save.attributes)) {
                const attrKey = attrPlus[1];
                const delta = Number(attrPlus[2] || 0);
                const hit = save.attributes.find(a => a?.id === attrKey || a?.name === attrKey);
                if (hit && Number.isFinite(delta)) {
                    const min = Number.isFinite(Number(hit.min)) ? Number(hit.min) : 0;
                    const max = Number.isFinite(Number(hit.max)) ? Number(hit.max) : 100;
                    hit.value = Math.max(min, Math.min(max, Number(hit.value || 0) + delta));
                    CYOA.appendSystemMessage?.(`📈 ${attrKey} +${delta}`);
                }
            }
        });
    };

    CYOA.checkQuestProgress = function(aiResponseText) {
        const save = CYOA.currentSave;
        if (!save || !Array.isArray(save.quests)) return false;
        const text = String(aiResponseText || "");
        if (!text.trim()) return false;

        let changed = false;
        save.quests.forEach(quest => {
            if (!quest || quest.status === "completed" || quest.status === "failed") return;

            if ((quest.status === "locked" || quest.status === "available") && quest.unlockCondition) {
                if (text.includes(String(quest.unlockCondition))) {
                    quest.status = "active";
                    changed = true;
                    CYOA.appendSystemMessage?.(`✨ 新任务开始：${quest.name || quest.id}`);
                }
            }

            if (quest.status !== "active") return;
            const objectives = Array.isArray(quest.objectives) ? quest.objectives : [];
            if (!objectives.length) return;
            if (!quest.progress || typeof quest.progress !== "object") quest.progress = {};

            let allDone = true;
            objectives.forEach((obj, idx) => {
                const key = String(idx);
                if (quest.progress[key] === undefined) quest.progress[key] = false;
                if (!quest.progress[key] && text.includes(String(obj))) {
                    quest.progress[key] = true;
                    changed = true;
                    CYOA.appendSystemMessage?.(`✅ 任务目标完成：${obj}`);
                }
                if (!quest.progress[key]) allDone = false;
            });

            if (allDone && quest.status === "active") {
                quest.status = "completed";
                changed = true;
                CYOA.grantQuestRewards?.(quest.rewards || []);
                CYOA.appendSystemMessage?.(`🎉 任务完成：${quest.name || quest.id}`);
            }
        });

        if (changed) {
            CYOA.persistSave?.();
            CYOA.renderQuestsPanel?.();
        }
        return changed;
    };

    // 兼容旧入口：统一走新链路解析/推进
    CYOA.processAIResponse = async function(fullResponse, userMessage, targetRole, filteredResponse) {
        const raw = String(fullResponse || "");
        const shown = String(filteredResponse || raw);
        const user = String(userMessage || "");
        const save = CYOA.currentSave;

        if (save) {
            if (!Array.isArray(save.history)) save.history = [];
            if (user) save.history.push({ role: "user", content: user });
            if (shown) save.history.push({ role: "assistant", content: shown });
            if (save.history.length > 200) save.history = save.history.slice(-200);
        }

        try { CYOA.parseAndApplyItemChanges?.(raw); } catch (_) {}
        try { CYOA.checkQuestProgress?.(raw); } catch (_) {}
        try { CYOA.progressSkillsFromInput?.(user); } catch (_) {}
        CYOA.updateAllSystems?.();
        CYOA.applyPassiveSystems?.();
        if (user || shown) CYOA.commitTurnNode?.(user, shown);
        CYOA.persistSave?.();
        CYOA.renderOptionsFromText?.(raw);
        CYOA.renderSidebar?.();

        return { ok: true, targetRole: targetRole || "", hasResponse: !!raw };
    };
})();
