/**
 * CYOA Game Runtime Module (Phase 1 scaffold)
 * 运行时主流程模块（第一阶段骨架）
 */
(function() {
    const CYOA = window.CYOA;
    if (!CYOA || !CYOA.CONFIG) return;

    CYOA.GameRuntime = CYOA.GameRuntime || {};
    CYOA.GameRuntime.__moduleName = 'runtime';
    CYOA.GameRuntime.__ready = true;
})();

/**
 * Runtime override (step 1): keep legacy behavior for start/exit.
 * 运行时覆盖（第1步）：先迁移 start/exit，行为保持与旧版一致。
 */
(function() {
    const CYOA = window.CYOA;
    if (!CYOA || !CYOA.CONFIG) return;

    const log = CYOA.log || console.log;
    const error = CYOA.error || console.error;
    const t = CYOA.t || ((k) => k);
    let isExiting = false;
    let _localTemplateLibrary = null;
    let _localTemplateLoadPromise = null;

    CYOA.GameRuntime = CYOA.GameRuntime || {};

    function getTemplateLibraryUrls() {
        const out = [];
        const push = (u) => {
            const s = String(u || "").trim();
            if (!s || out.includes(s)) return;
            out.push(s);
        };
        const fileName = "cyoa-local-templates.json";
        const cur = document.currentScript;
        if (cur?.src) {
            try { push(new URL(fileName, cur.src).href); } catch (_) {}
        }
        const scripts = Array.from(document.querySelectorAll('script[src]'));
        scripts.forEach((s) => {
            const src = String(s?.src || "");
            if (!/cyoa-(?:main|game-runtime)\.js(\?|$)/i.test(src)) return;
            try { push(new URL(fileName, src).href); } catch (_) {}
        });
        const pid = String(CYOA.pluginMeta?.id || CYOA.CONFIG?.PLUGIN_ID || "").trim();
        if (pid) push(`plugins/${pid}/${fileName}`);
        // Stable fallback by folder name; avoid root-path 404 noise.
        push(`plugins/cyoa/${fileName}`);
        return out;
    }

    CYOA.loadLocalTemplateLibrary = async function(force) {
        if (!force && _localTemplateLibrary) return _localTemplateLibrary;
        if (!force && _localTemplateLoadPromise) return _localTemplateLoadPromise;
        const urls = getTemplateLibraryUrls();
        _localTemplateLoadPromise = (async () => {
            for (const url of urls) {
                try {
                    const resp = await fetch(url, { cache: "no-store" });
                    if (!resp.ok) continue;
                    const data = await resp.json();
                    if (!data || typeof data !== "object") continue;
                    _localTemplateLibrary = data;
                    CYOA._localTemplateLibraryUrl = url;
                    CYOA.invalidateRAG?.();
                    return _localTemplateLibrary;
                } catch (_) {}
            }
            return null;
        })();
        const result = await _localTemplateLoadPromise;
        _localTemplateLoadPromise = null;
        return result;
    };

    CYOA.getLocalTemplateLibrary = function() {
        return _localTemplateLibrary;
    };

    CYOA.GameRuntime.startGame = async function(gameId, roleName) {
        log('开始游戏', gameId, roleName);

        try {
            const gameData = await CYOA.loadGameFromFile(gameId);

            if (!gameData) {
                error('游戏不存在', gameId);
                alert(t('ui.msg.gameNotExist'));
                return;
            }

            if (CYOA.currentGame) {
                CYOA.exitGame();
            }

            if (gameData.equipment) {
                gameData.equipment.forEach(eq => {
                    if (typeof eq.locked === 'boolean') {
                        eq.lockLevel = eq.locked ? 3 : 0;
                        delete eq.locked;
                    }
                });
            }

            CYOA.currentGame = gameData;
            CYOA._pendingGameData = gameData;
            CYOA._gamePhase = 'welcome';
            CYOA.invalidateRAG?.();

            if (typeof MainApp === 'undefined') {
                error('MainApp 未定义，无法进入游戏模式');
                alert(t('ui.msg.sysError'));
                return;
            }

            const modelEl = document.getElementById('model');
            const providerEl = document.getElementById('providerSelect');
            if (modelEl && modelEl.value) window.gameModeModel = modelEl.value;
            if (providerEl && providerEl.value) window.gameModeProvider = providerEl.value;

            MainApp.setGameMode(true, {
                gameName: gameData.name,
                onExit: () => CYOA.exitGame(),
                controlsRenderer: () => CYOA.renderGameControls()
            });

            document.body.classList.add('game-mode-active');
            document.body.classList.remove('cyoa-game-mode');

            // 恢复欢迎页：展示角色初始状态/装备，并允许直接读档或导入。
            CYOA._renderWelcomeScreen(gameData);
        } catch (e) {
            error('启动游戏时发生错误:', e);
            alert(t('ui.msg.startFailed', { error: e.message }));
        }
    };

    CYOA.GameRuntime.exitGame = function() {
        if (isExiting) {
            log('已经在退出过程中，忽略重复调用');
            return;
        }

        isExiting = true;
        log('退出游戏模式');

        window.gameExitCallback = null;
        if (typeof MainApp !== 'undefined' && MainApp.setGameMode) {
            try {
                MainApp.setGameMode(false);
            } catch (e) {
                console.error('MainApp.setGameMode(false) 失败:', e);
            }
        }

        try {
            const gameBar = document.getElementById('gameModeBar');
            if (gameBar && gameBar.parentNode) gameBar.parentNode.removeChild(gameBar);

            const sidebarContainer = document.getElementById('cyoa-sidebar-container');
            if (sidebarContainer && sidebarContainer.parentNode) sidebarContainer.parentNode.removeChild(sidebarContainer);

            const gameElements = document.querySelectorAll(
                '.cyoa-game-sidebar, .cyoa-game-controls, [id^="cyoa_"], ' +
                '#cyoa-game-sidebar, #cyoa-game-input-area'
            );
            gameElements.forEach(el => {
                if (el && el.parentNode) el.parentNode.removeChild(el);
            });

            const overlays = document.querySelectorAll('.cyoa-modal-overlay, .cyoa-popup');
            overlays.forEach(overlay => {
                if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
            });

            const dropZone = document.getElementById('dropZone');
            if (dropZone) dropZone.style.display = 'block';

            const controlsBar = document.querySelector('.controls-bar');
            if (controlsBar) controlsBar.style.display = 'flex';

            document.querySelectorAll(
                '.input-row, .controls-row, .upload-btn, .send-btn, ' +
                '#category, #providerSelect, #model, #modeRow'
            ).forEach(el => {
                if (el) el.style.display = '';
            });

            document.body.classList.remove('game-mode-active');
            document.body.classList.remove('cyoa-game-mode');

            const mainElement = document.querySelector('.main');
            if (mainElement) {
                mainElement.style.display = '';
                mainElement.style.flexDirection = '';
            }
        } catch (e) {
            console.error('清理游戏界面时出错:', e);
        }

        CYOA._gamePhase = 'idle';
        CYOA._pendingGameData = null;
        CYOA.currentGame = null;
        CYOA.currentSave = null;
        CYOA.currentNodeId = null;

        const logEl = document.getElementById('log');
        if (logEl) logEl.innerHTML = '';

        if (typeof renderCurrentConversation === 'function') {
            try {
                renderCurrentConversation();
            } catch (e) {
                console.error('刷新主界面失败:', e);
            }
        }

        window.gameModeModel = null;
        window.gameModeProvider = null;

        setTimeout(() => {
            isExiting = false;
            log('退出游戏模式完成');
        }, 500);
    };
})();
/* Runtime module for CYOA game flow */
(function() {
    const CYOA = window.CYOA;
    if (!CYOA || !CYOA.CONFIG) return;

    const t = CYOA.t || ((k) => k);
    const escapeHtml = CYOA.escapeHtml || ((s) => String(s ?? ""));

    function persistSave() {
        if (!CYOA.currentSave?.id) return;
        if (!CYOA.saves) CYOA.saves = {};
        syncCurrentNodeSnapshot(CYOA.currentSave);
        CYOA.currentSave.updatedAt = new Date().toISOString();
        CYOA.saves[CYOA.currentSave.id] = CYOA.currentSave;
        if (CYOA.DataManager) {
            CYOA.DataManager.saves = CYOA.saves;
            CYOA.DataManager.saveSaves?.();
        }
    }
    CYOA.persistSave = persistSave;

    function getCurrentSceneBySave(game, save) {
        const scenes = Array.isArray(game?.scenes) ? game.scenes : [];
        const nodeId = String(save?.currentNodeId || "").trim();
        if (nodeId) {
            const byId = scenes.find(s => String(s?.id || "") === nodeId);
            if (byId) return byId;
        }
        const chapterId = String(save?.currentChapter || "").trim();
        const locId = String(save?.currentLocation || "").trim();
        return scenes.find(s => String(s?.chapterId || "") === chapterId && String(s?.location || "") === locId)
            || scenes.find(s => String(s?.location || "") === locId)
            || null;
    }

    function getUniqueEquippedItemsForRAG(save, game) {
        const byId = new Map();
        Object.values(save?.equipment || {}).forEach((it) => {
            const id = String(it?.id || "").trim();
            if (!id || byId.has(id)) return;
            const def = (game?.equipment || []).find(e => e.id === id);
            byId.set(id, {
                id,
                name: String(it?.name || def?.name || id),
                lockLevel: Number(it?.lockLevel ?? def?.lockLevel ?? 0),
                slots: Array.isArray(it?.slots) ? it.slots : (Array.isArray(def?.slots) ? def.slots : []),
                material: String(it?.material || def?.material || "").trim()
            });
        });
        return Array.from(byId.values());
    }

    function computeRAGKey(save, game) {
        const equip = getUniqueEquippedItemsForRAG(save, game).map(e => `${e.id}:${e.lockLevel}:${(e.slots || []).join("|")}:${e.material}`).sort();
        const quests = (Array.isArray(save?.quests) ? save.quests : [])
            .filter(q => q?.status === "active" || q?.status === "available")
            .map(q => `${q.id || q.name}:${q.status}`).sort();
        const skills = (Array.isArray(save?.skills) ? save.skills : [])
            .filter(s => s?.learned !== false)
            .map(s => `${s.id || s.name}:${s.level || 1}`).sort();
        const attrs = (Array.isArray(save?.attributes) ? save.attributes : [])
            .slice(0, 20)
            .map(a => `${a.id || a.name}:${a.value}`).sort();
        const constraintDetails = CYOA.getActiveConstraintDetails?.() || {};
        const sourceSig = Object.keys(constraintDetails?.sources || {})
            .sort()
            .map((k) => {
                const equips = Array.from(new Set((constraintDetails.sources[k] || []).map(s => String(s?.equipId || s?.equipName || "").trim()).filter(Boolean))).sort();
                return `${k}:${equips.join("|")}`;
            })
            .join(";");
        const rulebookVersion = Number(constraintDetails?.schemaVersion || 1);
        return JSON.stringify({
            gameId: game?.id || "",
            chapter: save?.currentChapter || "",
            location: save?.currentLocation || "",
            posture: save?.posture || "",
            player: save?.playerCharacterId || save?.playerCharacter || "",
            constraints: Array.from(CYOA.getActiveConstraints?.() || new Set()).sort(),
            equip, quests, skills, attrs, sourceSig, rulebookVersion
        });
    }

    function buildRulebookRag(save, game) {
        const details = CYOA.getActiveConstraintDetails?.() || {};
        const impacts = Array.isArray(details?.impactLines) ? details.impactLines.slice(0, 24) : [];
        const constraints = Array.isArray(details?.active) ? details.active : [];
        const posture = String(save?.posture || "").trim() || "standing";
        const postureDuration = Number(save?.postureDuration || 0);
        const equipped = getUniqueEquippedItemsForRAG(save, game).slice(0, 16);
        const lines = [
            "[规则说明书/Rulebook]",
            `- posture: ${posture}${postureDuration > 0 ? ` (${postureDuration} turns)` : ""}`,
            `- active_constraints: ${constraints.join(", ") || "none"}`,
            `- equipped_items: ${equipped.map(e => e.name || e.id).join(", ") || "none"}`
        ];
        if (impacts.length) {
            lines.push("- constraint_equipment_impacts:");
            impacts.forEach((line) => lines.push(`  ${line}`));
        }
        const styleGuide = Array.isArray(CYOA.getLocalTemplateLibrary?.()?.ragReference?.styleGuide)
            ? CYOA.getLocalTemplateLibrary().ragReference.styleGuide.slice(0, 8)
            : [];
        if (styleGuide.length) {
            lines.push("- narrative_rulebook:");
            styleGuide.forEach((line) => lines.push(`  - ${String(line || "").trim()}`));
        }
        lines.push("- hard_boundaries:");
        lines.push("  - Do not ignore physical constraints.");
        lines.push("  - Do not jump outside current chapter/location frame.");
        lines.push("  - Unknown facts must be queried before assertion.");
        return lines.join("\n");
    }

    function buildRAGText(save, game) {
        const chapter = (game?.chapters || []).find(c => c.id === save?.currentChapter);
        const location = (game?.locations || []).find(l => l.id === save?.currentLocation);
        const scene = getCurrentSceneBySave(game, save);
        const region = CYOA.getRegionByLocation?.(save?.currentLocation);
        const edges = Array.isArray(game?.locationEdges) ? game.locationEdges : [];
        const neighbors = edges
            .filter(e => e?.from === save?.currentLocation || e?.to === save?.currentLocation)
            .map(e => e?.from === save?.currentLocation ? e?.to : e?.from)
            .filter(Boolean);
        const neighborNames = neighbors
            .map(id => (game?.locations || []).find(l => l.id === id)?.name || id)
            .filter((v, i, arr) => arr.indexOf(v) === i)
            .slice(0, 10);

        const present = [];
        const playerName = String(save?.playerCharacter || save?.playerCharacterId || "玩家");
        if (playerName) present.push(playerName);
        const sceneChars = Array.isArray(scene?.characters) ? scene.characters : (Array.isArray(scene?.characterIds) ? scene.characterIds : []);
        sceneChars.forEach((x) => {
            const raw = String(x?.id || x?.name || x || "").trim();
            if (!raw) return;
            const def = (game?.characters || []).find(c => c.id === raw || c.name === raw);
            const name = String(def?.name || raw);
            if (name && !present.includes(name)) present.push(name);
        });

        const equips = getUniqueEquippedItemsForRAG(save, game);
        const constraints = Array.from(CYOA.getActiveConstraints?.() || new Set())
            .map(k => CYOA.getConstraintLabel?.(k) || String(k));
        const skills = (Array.isArray(save?.skills) ? save.skills : [])
            .filter(s => s?.learned !== false)
            .slice(0, 20)
            .map(s => `${s.name || s.id}(Lv${s.level || 1})`);
        const quests = (Array.isArray(save?.quests) ? save.quests : [])
            .filter(q => q?.status === "active" || q?.status === "available")
            .slice(0, 20)
            .map(q => `${q.title || q.name || q.id}(${q.status})`);
        const attrs = (Array.isArray(save?.attributes) ? save.attributes : [])
            .slice(0, 20)
            .map(a => `${a.name || a.id}:${a.value}`);

        const lines = [];
        lines.push(`[游戏] ${game?.name || "CYOA"}`);
        lines.push(`[世界] ${String(game?.synopsis || "").trim() || "无"}`);
        lines.push(`[地图区域] ${region?.name || "无"}`);
        lines.push(`[当前章节] ${chapter?.title || save?.currentChapter || "无"}`);
        lines.push(`[当前地点] ${location?.name || save?.currentLocation || "无"}`);
        lines.push(`[邻接地点] ${neighborNames.join("、") || "无"}`);
        lines.push(`[当前场景] ${scene?.title || scene?.name || scene?.id || "无"}`);
        lines.push(`[在场人物] ${present.join("、") || "无"}`);
        lines.push(`[地点设施] ${Array.isArray(location?.facilities) ? location.facilities.join("、") : "无"}`);
        lines.push(`[已穿戴装备] ${equips.map(e => `${e.name}${e.lockLevel > 0 ? `(Lv${e.lockLevel})` : ""}`).join("、") || "无"}`);
        lines.push(`[生效限制] ${constraints.join("、") || "无"}`);
        lines.push(`[技能] ${skills.join("、") || "无"}`);
        lines.push(`[任务] ${quests.join("、") || "无"}`);
        lines.push(`[属性] ${attrs.join("、") || "无"}`);
        const tpl = CYOA.getLocalTemplateLibrary?.();
        const styleGuide = Array.isArray(tpl?.ragReference?.styleGuide) ? tpl.ragReference.styleGuide : [];
        const examples = Array.isArray(tpl?.ragReference?.exampleReplies) ? tpl.ragReference.exampleReplies : [];
        if (styleGuide.length) {
            lines.push(`[本地模板规则] ${styleGuide.slice(0, 6).join("；")}`);
        }
        if (examples.length) {
            lines.push(`[本地模板示例] ${examples.slice(0, 2).join(" / ")}`);
        }
        if (CYOA.CONFIG?.RAG_RULEBOOK_ENABLED !== false) {
            const rulebook = buildRulebookRag(save, game);
            if (rulebook) lines.push(rulebook);
        }
        return lines.join("\n");
    }

    CYOA.generateRAG = function(force) {
        const save = CYOA.currentSave;
        const game = CYOA.currentGame;
        if (!save || !game) return "";
        const key = computeRAGKey(save, game);
        if (!force && save._ragCache && save._ragKey === key) return save._ragCache;
        let ragText = buildRAGText(save, game);
        if (typeof CYOA.maskSensitiveWords === "function") {
            ragText = CYOA.maskSensitiveWords(ragText);
        }
        save._ragKey = key;
        save._ragCache = ragText;
        save._ragVersion = Date.now();
        return ragText;
    };

    CYOA.getRAG = function() {
        const save = CYOA.currentSave;
        if (!save) return "";
        return String(save._ragCache || CYOA.generateRAG?.() || "");
    };

    CYOA.queryRagByKeys = function(keys, context) {
        const list = Array.isArray(keys) ? keys.map(k => String(k || "").trim().toLowerCase()).filter(Boolean) : [];
        const game = context?.game || CYOA.currentGame;
        const save = context?.save || CYOA.currentSave;
        if (!game || !save) return "";
        const out = [];
        const has = (k) => list.includes(k);
        if (has("rag_rules") || has("rules") || has("rulebook")) {
            out.push(buildRulebookRag(save, game));
        }
        if (has("equipment_impacts")) {
            const impacts = Array.isArray(context?.constraintDetails?.impactLines)
                ? context.constraintDetails.impactLines
                : (CYOA.getActiveConstraintDetails?.()?.impactLines || []);
            out.push([
                "[equipment_impacts]",
                ...(impacts.length ? impacts.slice(0, 24) : ["none"])
            ].join("\n"));
        }
        if (has("interactables")) {
            const ragText = String(CYOA.getRAG?.() || "").trim();
            const hitLines = ragText
                .split(/\r?\n/)
                .filter((line) => /\[(在场人物|地点设施|当前地点|当前场景|邻接地点)\]/.test(line))
                .slice(0, 10);
            if (hitLines.length) out.push(["[interactables]", ...hitLines].join("\n"));
        }
        if (!out.length) {
            const rag = String(CYOA.getRAG?.() || "").trim();
            return rag ? rag.split(/\r?\n/).slice(0, 16).join("\n") : "";
        }
        return out.join("\n\n");
    };

    CYOA.invalidateRAG = function() {
        const save = CYOA.currentSave;
        if (!save) return;
        delete save._ragKey;
        delete save._ragCache;
        delete save._ragVersion;
    };

    function getSaveTimestampMs(save) {
        const v = save?.updatedAt || save?.createdAt;
        if (typeof v === "number" && Number.isFinite(v)) return v;
        const ts = Date.parse(String(v || ""));
        return Number.isFinite(ts) ? ts : 0;
    }

    function enforceSaveLimitForGame(gameId, keepId) {
        const gid = String(gameId || "").trim();
        if (!gid) return;
        const max = Math.max(1, Number(CYOA.CONFIG?.MAX_SAVES_PER_GAME || 20));
        if (!CYOA.saves || typeof CYOA.saves !== "object") return;
        const list = Object.values(CYOA.saves).filter((s) => s && String(s.gameId || "") === gid);
        if (list.length <= max) return;
        const keep = String(keepId || "");
        const sorted = list.slice().sort((a, b) => getSaveTimestampMs(a) - getSaveTimestampMs(b));
        const removable = sorted.filter((s) => String(s.id || "") !== keep);
        const overflow = Math.max(0, list.length - max);
        removable.slice(0, overflow).forEach((s) => {
            if (s?.id && CYOA.saves[s.id]) delete CYOA.saves[s.id];
        });
        if (CYOA.DataManager) CYOA.DataManager.saves = CYOA.saves;
    }

    function resolveInitialLocationForChapter(game, chapterId) {
        const chapterKey = String(chapterId || "").trim();
        const chapters = Array.isArray(game?.chapters) ? game.chapters : [];
        const scenes = Array.isArray(game?.scenes) ? game.scenes : [];
        if (chapterKey) {
            const chapter = chapters.find((ch) => String(ch?.id || "") === chapterKey);
            const entry = pickChapterEntryNode(game, chapter);
            if (entry?.location) return String(entry.location);
            const chapterScene = scenes.find((s) => String(s?.chapterId || "") === chapterKey && String(s?.location || "").trim());
            if (chapterScene?.location) return String(chapterScene.location);
        }
        const firstScene = getInitialScene(game);
        if (firstScene?.location) return String(firstScene.location);
        return String(game?.locations?.[0]?.id || "");
    }

    function normalizeSaveShape(save, game) {
        const s = save || {};
        if (!s.id) s.id = "save_" + CYOA.generateId();
        if (!s.gameId) s.gameId = game?.id || "";
        if (!s.name) s.name = `${game?.name || "CYOA"} - 存档`;
        if (!s.createdAt) s.createdAt = new Date().toISOString();
        if (!s.updatedAt) s.updatedAt = s.createdAt;
        if (!Array.isArray(s.history)) s.history = [];
        if (!Array.isArray(s.completedChapters)) s.completedChapters = [];
        if (!Array.isArray(s.inventory)) s.inventory = [];
        if (!s.equipment || typeof s.equipment !== "object") s.equipment = {};
        // 兼容旧存档：equipment 可能是 slot -> equipId 字符串
        if (s.equipment && typeof s.equipment === "object") {
            Object.keys(s.equipment).forEach(slot => {
                const v = s.equipment[slot];
                if (typeof v === "string") {
                    const def = (game?.equipment || []).find(e => e.id === v);
                    s.equipment[slot] = {
                        id: v,
                        name: def?.name || v,
                        layer: Number(def?.layer ?? 5),
                        unlockItemId: def?.unlockItemId || "",
                        lockLevel: Number(def?.lockLevel || 0),
                        attachments: Array.isArray(def?.attachments) ? JSON.parse(JSON.stringify(def.attachments)) : []
                    };
                }
            });
        }
        if (!Array.isArray(s.quests)) s.quests = Array.isArray(game?.quests) ? JSON.parse(JSON.stringify(game.quests)) : [];
        if (!Array.isArray(s.keyEvents)) s.keyEvents = [];
        if (!Array.isArray(s.discoveries) && Array.isArray(s.discoveredRules)) {
            s.discoveries = [...s.discoveredRules];
        }
        if (!Array.isArray(s.discoveries)) s.discoveries = [];
        if (!Array.isArray(s.skills)) {
            const playable = (game?.characters || []).find(c => c.id === s.playerCharacterId) || null;
            s.skills = buildInitialSkillsForSave(game, playable);
        }
        if (!s.nodes || typeof s.nodes !== "object") s.nodes = {};
        if (typeof s.observerAlert !== "number") s.observerAlert = Number(s.observerAlert || 0);
        if (typeof s.observerInterventionCooldown !== "number") s.observerInterventionCooldown = Number(s.observerInterventionCooldown || 0);
        if (!s.currentNodeId) s.currentNodeId = "root";
        if (!s.currentChapter) {
            const firstChapter = [...(game?.chapters || [])].sort((a, b) => Number(a?.order || 0) - Number(b?.order || 0))[0];
            s.currentChapter = game?.initialChapter || firstChapter?.id || "";
        }
        const validLocationIds = new Set((game?.locations || []).map((l) => String(l?.id || "").trim()).filter(Boolean));
        const nodeLocation = String(s?.nodes?.[s.currentNodeId]?.location || "").trim();
        const hasCurrentLocation = validLocationIds.has(String(s.currentLocation || "").trim());
        if (!hasCurrentLocation) {
            if (nodeLocation && validLocationIds.has(nodeLocation)) {
                s.currentLocation = nodeLocation;
            } else {
                s.currentLocation = resolveInitialLocationForChapter(game, s.currentChapter);
            }
        }
        if (!Array.isArray(s.visitedLocationIds)) s.visitedLocationIds = [];
        if (s.currentLocation && !s.visitedLocationIds.includes(s.currentLocation)) {
            s.visitedLocationIds = [s.currentLocation].concat(s.visitedLocationIds);
        }
        if (Array.isArray(s.attributes)) {
            // no-op
        } else if (s.attributes && typeof s.attributes === "object") {
            // 兼容旧对象结构为数组
            s.attributes = Object.entries(s.attributes).map(([k, v]) => ({ id: k, name: k, value: Number(v || 0), min: 0, max: 100 }));
        } else {
            s.attributes = Array.isArray(game?.attributes) ? JSON.parse(JSON.stringify(game.attributes)) : [];
        }
        return s;
    }

    function ensureStoryNodes(save, game) {
        if (!save || typeof save !== "object") return;
        if (!save.nodes || typeof save.nodes !== "object") save.nodes = {};
        const rootId = "root";
        if (!save.nodes[rootId]) {
            const intro = (game?.scenes || []).find(s => s.id === save.currentNodeId)?.description
                || game?.synopsis
                || "冒险开始。";
            save.nodes[rootId] = {
                id: rootId,
                parentId: null,
                childrenIds: [],
                summary: game?.name || "开场",
                userMessage: "",
                assistantMessage: String(intro),
                location: save.currentLocation || "",
                chapter: save.currentChapter || "",
                stateSnapshot: captureNodeSnapshot(save),
                createdAt: new Date().toISOString()
            };
        }
        if (!save.currentNodeId || !save.nodes[save.currentNodeId]) save.currentNodeId = rootId;
    }

    function normalizeStoryNodeShape(save) {
        if (!save?.nodes || typeof save.nodes !== "object") return;
        const nodes = save.nodes;
        Object.keys(nodes).forEach(id => {
            const n = nodes[id];
            if (!n || typeof n !== "object") {
                delete nodes[id];
                return;
            }
            if (!n.id) n.id = id;
            if (!Array.isArray(n.childrenIds)) n.childrenIds = [];
            n.childrenIds = Array.from(new Set(n.childrenIds.filter(cid => typeof cid === "string" && !!nodes[cid])));
            if (typeof n.summary !== "string") n.summary = String(n.summary || "节点");
            if (typeof n.userMessage !== "string") n.userMessage = String(n.userMessage || "");
            if (typeof n.assistantMessage !== "string") n.assistantMessage = String(n.assistantMessage || "");
            if (!n.createdAt) n.createdAt = new Date().toISOString();
        });

        // 若节点 parent 不存在，提升为根节点
        Object.values(nodes).forEach(n => {
            if (n.parentId && !nodes[n.parentId]) n.parentId = null;
        });

        // 双向修正：确保 parent 的 childrenIds 包含该子节点
        Object.values(nodes).forEach(n => {
            if (!n.parentId) return;
            const p = nodes[n.parentId];
            if (!p) return;
            if (!Array.isArray(p.childrenIds)) p.childrenIds = [];
            if (!p.childrenIds.includes(n.id)) p.childrenIds.push(n.id);
        });
    }

    const NODE_SNAPSHOT_FIELDS = [
        "currentLocation",
        "currentChapter",
        "travelingTo",
        "travelTurnsRemaining",
        "posture",
        "postureDuration",
        "inventory",
        "skills",
        "equipment",
        "attributes",
        "quests",
        "completedChapters",
        "discoveries",
        "observerAlert",
        "observerInterventionCooldown",
        "dependency",
        "tether"
    ];

    function deepClone(obj) {
        try {
            return JSON.parse(JSON.stringify(obj));
        } catch (_) {
            return null;
        }
    }

    function captureNodeSnapshot(save) {
        const out = {};
        NODE_SNAPSHOT_FIELDS.forEach(k => {
            out[k] = deepClone(save?.[k]);
        });
        return out;
    }

    function applyNodeSnapshot(save, snapshot) {
        if (!save || !snapshot || typeof snapshot !== "object") return;
        NODE_SNAPSHOT_FIELDS.forEach(k => {
            if (snapshot[k] !== undefined) save[k] = deepClone(snapshot[k]);
        });
    }

    function getNodePath(nodes, nodeId) {
        const path = [];
        const seen = new Set();
        let cur = nodes?.[nodeId];
        while (cur && !seen.has(cur.id)) {
            path.push(cur);
            seen.add(cur.id);
            cur = cur.parentId ? nodes[cur.parentId] : null;
        }
        return path.reverse();
    }

    function rebuildHistoryFromNodePath(save, nodeId) {
        if (!save?.nodes) return;
        const path = getNodePath(save.nodes, nodeId);
        const history = [];
        path.forEach(n => {
            const u = String(n.userMessage || "").trim();
            const a = String(n.assistantMessage || "").trim();
            if (u) history.push({ role: "user", content: u });
            if (a) history.push({ role: "assistant", content: a });
        });
        save.history = history.slice(-200);
    }

    function syncCurrentNodeSnapshot(save) {
        if (!save?.nodes || !save.currentNodeId) return;
        const node = save.nodes[save.currentNodeId];
        if (!node || typeof node !== "object") return;
        node.location = save.currentLocation || node.location || "";
        node.chapter = save.currentChapter || node.chapter || "";
        node.stateSnapshot = captureNodeSnapshot(save);
    }

    function normalizeGameShape(game) {
        if (!game) return null;
        const g = game || {};
        if (!g.id) g.id = "game_" + CYOA.generateId();
        if (!g.name) g.name = "CYOA";
        if (!Array.isArray(g.characters)) g.characters = [];
        if (!Array.isArray(g.scenes)) g.scenes = [];
        if (!Array.isArray(g.chapters)) g.chapters = [];
        if (!Array.isArray(g.locations)) g.locations = [];
        if (!Array.isArray(g.locationEdges)) g.locationEdges = [];
        if (!Array.isArray(g.attributes)) g.attributes = [];
        if (!Array.isArray(g.items)) g.items = [];
        if (!Array.isArray(g.equipment)) g.equipment = [];
        if (!Array.isArray(g.quests)) g.quests = [];
        if (!Array.isArray(g.equipmentSynergies)) g.equipmentSynergies = [];
        if (!Array.isArray(g.discoveryRules)) g.discoveryRules = [];
        return g;
    }

    CYOA.repairCurrentSave = function() {
        const save = CYOA.currentSave;
        const game = CYOA.currentGame;
        if (!save || !game) return { ok: false, reason: "missing_context" };
        normalizeSaveShape(save, game);
        ensureStoryNodes(save, game);
        normalizeStoryNodeShape(save);

        // currentNode 兜底
        if (!save.nodes[save.currentNodeId]) save.currentNodeId = "root";
        CYOA.currentNodeId = save.currentNodeId;

        // 同步 location/chapter 兜底
        if (save.currentNodeId && save.nodes[save.currentNodeId]) {
            const n = save.nodes[save.currentNodeId];
            if (n.location && (game.locations || []).some(l => l.id === n.location)) save.currentLocation = n.location;
            if (n.chapter && (game.chapters || []).some(ch => ch.id === n.chapter)) save.currentChapter = n.chapter;
        }

        return { ok: true, nodeCount: Object.keys(save.nodes || {}).length };
    };

    function getDefaultPlayable(game) {
        const chars = game?.characters || [];
        return chars.find(c => c.roleType === "playable") || chars[0] || { id: "player", name: "玩家" };
    }

    function getInitialLearnedSkillIds(game, playable) {
        const out = new Set();
        (playable?.skills || []).forEach(id => out.add(String(id)));
        const profIds = Array.isArray(playable?.professions) ? playable.professions : [];
        profIds.forEach(pid => {
            const prof = (game?.professions || []).find(x => x.id === pid);
            (prof?.skills || []).forEach(id => out.add(String(id)));
        });
        (game?.skills || []).forEach(s => {
            if ((s?.unlockType || "auto") === "auto") out.add(String(s.id));
        });
        return out;
    }

    function buildInitialSkillsForSave(game, playable) {
        const learnedIds = getInitialLearnedSkillIds(game, playable);
        const minLv = Number(CYOA.CONFIG?.SKILL_MIN_LEVEL || 1);
        return (game?.skills || [])
            .filter(s => learnedIds.has(String(s.id)))
            .map(s => ({
                id: s.id,
                name: s.name || s.id,
                skillType: s.skillType || "combat",
                unlockType: s.unlockType || "auto",
                description: s.description || "",
                effect: s.effect || "",
                requiredAttributes: s.requiredAttributes || {},
                consumeItems: Array.isArray(s.consumeItems) ? JSON.parse(JSON.stringify(s.consumeItems)) : [],
                level: Math.max(minLv, Number(s.level || minLv)),
                proficiency: Math.max(0, Number(s.proficiency || 0)),
                learned: true
            }));
    }

    function getInitialScene(game) {
        const scenes = game?.scenes || [];
        return scenes.find(s => s.id === game.initialScene || s.name === game.initialScene) || scenes[0] || null;
    }

    function getSortedChapters(game) {
        return [...(game?.chapters || [])].sort((a, b) => Number(a?.order || 0) - Number(b?.order || 0));
    }

    function pickChapterEntryNode(game, chapter) {
        if (!chapter) return null;
        const sceneList = Array.isArray(game?.scenes) ? game.scenes : [];
        if (Array.isArray(chapter.scenes) && chapter.scenes.length) {
            const firstRef = chapter.scenes[0];
            const sceneId = typeof firstRef === "string" ? firstRef : firstRef?.id;
            if (sceneId) {
                const found = sceneList.find(s => s.id === sceneId || s.name === sceneId);
                if (found) return found;
            }
        }
        return sceneList.find(s => s.chapterId === chapter.id) || null;
    }

    function ensureGameMode(gameName) {
        if (typeof MainApp === "undefined" || typeof MainApp.setGameMode !== "function") return false;
        MainApp.setGameMode(true, {
            gameName: gameName || "CYOA",
            onExit: () => CYOA.exitGame?.(),
            controlsRenderer: () => CYOA.renderGameControls?.() || ""
        });
        return true;
    }

    CYOA.startGame = async function(gameId, roleName) {
        const loaded = await CYOA.loadGameFromFile(gameId);
        const game = normalizeGameShape(loaded);
        if (!game) {
            alert(t("ui.msg.gameNotExist") || "游戏不存在");
            return;
        }

        if (CYOA.DataManager?.loadSaves) CYOA.DataManager.loadSaves();
        if (CYOA.DataManager?.saves) CYOA.saves = CYOA.DataManager.saves;
        if (!CYOA.saves) CYOA.saves = {};

        CYOA.currentGame = game;
        CYOA._gamePhase = "playing";
        // 进入游戏时优先采用剧本叙述者模型，避免受主界面分类筛选影响
        const narratorModel = String(game?.narrator?.model || "").trim();
        const modelEl = document.getElementById("model");
        const uiModel = String(modelEl?.value || "").trim();
        const preferredModel = narratorModel || uiModel || String(window.gameModeModel || "").trim();
        if (preferredModel) {
            window.gameModeModel = preferredModel;
            const provider = preferredModel.includes("::") ? String(preferredModel.split("::")[0] || "").trim() : "";
            if (provider) window.gameModeProvider = provider;
            if (modelEl) {
                const hasOption = Array.from(modelEl.options || []).some(opt => String(opt?.value || "").trim() === preferredModel);
                if (hasOption) modelEl.value = preferredModel;
            }
        }

        const playable = roleName
            ? (game.characters || []).find(c => c.name === roleName || c.id === roleName) || getDefaultPlayable(game)
            : getDefaultPlayable(game);
        const firstScene = getInitialScene(game);
        const sortedChapters = getSortedChapters(game);
        const initialChapter = game.initialChapter || sortedChapters[0]?.id || "";
        const chapterEntryScene = pickChapterEntryNode(game, sortedChapters.find(ch => ch.id === initialChapter)) || firstScene;
        const firstLoc = resolveInitialLocationForChapter(game, initialChapter);

        CYOA.currentSave = {
            id: "save_" + CYOA.generateId(),
            name: `${game.name || "CYOA"} - ${playable.name || "玩家"}`,
            gameId: game.id,
            createdAt: new Date().toISOString(),
            playerCharacterId: playable.id || "",
            playerCharacter: playable.name || "玩家",
            currentChapter: initialChapter,
            currentNodeId: chapterEntryScene?.id || firstScene?.id || "root",
            currentLocation: firstLoc,
            visitedLocationIds: firstLoc ? [firstLoc] : [],
            travelingTo: null,
            travelTurnsRemaining: 0,
            posture: "standing",
            postureDuration: 0,
            keyEvents: [],
            history: [],
            chapterSummaries: {},
            completedChapters: [],
            nodes: {},
            observerAlert: 0,
            observerInterventionCooldown: 0,
            attributes: Array.isArray(game.attributes) ? JSON.parse(JSON.stringify(game.attributes)) : [],
            inventory: [],
            equipment: {},
            skills: buildInitialSkillsForSave(game, playable),
            quests: Array.isArray(game.quests) ? JSON.parse(JSON.stringify(game.quests)) : [],
            updatedAt: new Date().toISOString()
        };
        ensureStoryNodes(CYOA.currentSave, game);
        ensureKnownLocations(CYOA.currentSave);
        CYOA.currentNodeId = CYOA.currentSave.currentNodeId;
        enforceSaveLimitForGame(game.id, CYOA.currentSave.id);
        persistSave();

        if (!ensureGameMode(game.name)) {
            alert("MainApp 运行环境不可用。");
            return;
        }

        const logEl = document.getElementById("log");
        if (logEl && typeof CYOA._preGameLogHTML !== "string") {
            // 保留主聊天区快照，退出时恢复
            CYOA._preGameLogHTML = logEl.innerHTML;
        }
        const intro = chapterEntryScene?.description || firstScene?.description || game.synopsis || "冒险开始。";
        CYOA.renderGameIntro?.(game.name || "CYOA", intro);
        CYOA.applyAgreementEnforcement?.({ silent: true, source: "start" });

        CYOA.renderSidebar?.();
        CYOA._bindInputKeyHandler?.();
        // 进入游戏即自动触发一次开场叙述：场景 + 状态 + 可互动对象
        setTimeout(() => {
            try { CYOA.kickoffOpeningNarration?.(); } catch (_) {}
        }, 80);
    };

    CYOA.beginGame = function(roleName) {
        const gameData = CYOA._pendingGameData || CYOA.currentGame;
        if (!gameData) {
            alert(t('ui.msg.gameDataLost'));
            return;
        }

        // 从欢迎界面获取选中角色
        if (!roleName) {
            const selectedEl = document.querySelector('.cyoa-welcome-char.selected');
            roleName = selectedEl?.getAttribute('data-char-name') || '';
            if (!roleName) {
                const playable = (gameData.characters || []).find(c => c.roleType === 'playable' || c.role === 'playable');
                roleName = playable?.name || '';
            }
        }

        let playerChar = gameData.characters?.find(c => c.name === roleName);
        if (!playerChar) {
            playerChar = (gameData.characters || []).find(c => c.roleType === "playable" || c.role === "playable")
                || (gameData.characters || [])[0]
                || null;
            if (playerChar?.name) roleName = playerChar.name;
        }
        const playerCharId = String(playerChar?.id || playerChar?.name || "");
        const listGame = (Array.isArray(CYOA.games) ? CYOA.games : []).find(g => g && g.id === gameData.id);
        const effectiveItems = (Array.isArray(gameData.items) && gameData.items.length > 0)
            ? gameData.items
            : (Array.isArray(listGame?.items) ? listGame.items : []);
        const effectiveEquipment = (Array.isArray(gameData.equipment) && gameData.equipment.length > 0)
            ? gameData.equipment
            : (Array.isArray(listGame?.equipment) ? listGame.equipment : []);
        if ((!Array.isArray(gameData.items) || gameData.items.length === 0) && effectiveItems.length > 0) {
            gameData.items = JSON.parse(JSON.stringify(effectiveItems));
        }
        if ((!Array.isArray(gameData.equipment) || gameData.equipment.length === 0) && effectiveEquipment.length > 0) {
            gameData.equipment = JSON.parse(JSON.stringify(effectiveEquipment));
        }

        const allItems = effectiveItems ? JSON.parse(JSON.stringify(effectiveItems)) : [];
        const allEquipment = effectiveEquipment ? JSON.parse(JSON.stringify(effectiveEquipment)) : [];
        const charIdSet = new Set((gameData.characters || []).map(c => String(c?.id || "").trim()).filter(Boolean));
        const charNameSet = new Set((gameData.characters || []).map(c => String(c?.name || "").trim()).filter(Boolean));
        const itemById = new Map(allItems.map(it => [it.id, it]));
        const equipById = new Map(allEquipment.map(eq => [eq.id, eq]));
        const clone = (obj) => JSON.parse(JSON.stringify(obj));
        const uniqById = (arr) => {
            const seen = new Set();
            return (arr || []).filter(it => {
                if (!it?.id || seen.has(it.id)) return false;
                seen.add(it.id);
                return true;
            });
        };
        const buildInitialInventory = (char) => {
            if (!char) return [];
            const charId = String(char.id || "").trim();
            const charName = String(char.name || "").trim();
            const byOwner = allItems.filter(it => {
                const owner = String(it?.ownerId || "").trim();
                if (!owner) return false;
                return (charId && owner === charId) || (charName && owner === charName);
            }).map(clone);
            const bySelect = (char.initialInventoryItemIds || [])
                .map(id => itemById.get(id))
                .filter(Boolean)
                .map(clone);
            return uniqById(byOwner.concat(bySelect));
        };
        const buildInitialEquipmentList = (char, isPlayer = false) => {
            if (!char) return [];
            const charId = String(char.id || "").trim();
            const charName = String(char.name || "").trim();
            // 兼容旧数据：
            // - ownerId 可能存角色 name（早期版本）
            // - 玩家初始穿戴时，允许 ownerId 为空但 startEquipped=true
            const byFlag = allEquipment.filter(eq => {
                if (!eq?.startEquipped) return false;
                const owner = String(eq.ownerId || "").trim();
                if (!owner) return !!isPlayer;
                if ((charId && owner === charId) || (charName && owner === charName)) return true;
                // 兼容旧数据：ownerId 漂移（角色 id/name 已变化），玩家开局时兜底接管
                if (isPlayer) {
                    const ownerExists = charIdSet.has(owner) || charNameSet.has(owner);
                    if (!ownerExists) return true;
                }
                return false;
            }).map(clone);
            const bySelect = (char.initialEquipmentIds || [])
                .map(idOrName => equipById.get(idOrName) || allEquipment.find(eq => eq.name === idOrName))
                .filter(Boolean)
                .map(clone);
            return uniqById(byFlag.concat(bySelect));
        };

        const playerItems = buildInitialInventory(playerChar);
        const saveId = 'save_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8);
        const initialChapterId = gameData.initialChapter || null;
        const initialLocationId = resolveInitialLocationForChapter(gameData, initialChapterId || "");
        CYOA.currentSave = {
            id: saveId,
            gameId: gameData.id,
            name: t('ui.game.newAdventure') + ' ' + new Date().toLocaleString(),
            createdAt: Date.now(),
            updatedAt: Date.now(),
            playerCharacter: roleName,
            playerCharacterId: playerCharId,
            currentChapter: initialChapterId,
            completedChapters: [],
            currentNodeId: null,
            nodes: {},
            characterOverrides: {},
            narratorOverride: null,
            narratorStyle: '',
            attributes: gameData.attributes ? JSON.parse(JSON.stringify(gameData.attributes)) : [],
            inventory: playerItems,
            acquiredItemIds: playerItems.map(i => i.id),
            equipment: {},
            npcInventories: {},
            npcEquipment: {},
            agreements: gameData.contracts ? clone(gameData.contracts) : [],
            skills: gameData.skills ? JSON.parse(JSON.stringify(gameData.skills)) : [],
            quests: gameData.quests ? JSON.parse(JSON.stringify(gameData.quests)) : [],
            questProgress: {},
            observerAlert: 0,
            posture: 'standing',
            tether: {
                active: false,
                type: null,
                sourceSlot: null,
                targetType: null,
                targetId: null,
                targetName: '',
                chainLength: 'leash'
            },
            arousal: 0,
            activeStimulators: [],
            habituation: {},
            wearDurations: {},
            postureDuration: 0,
            violations: [],
            withdrawalEffects: [],
            shame: 0,
            oxygen: 100,
            breathDevices: [],
            pain: 0,
            marks: [],
            bodyTemp: {},
            activeTempEffects: [],
            predicament: null,
            trainings: {},
            deprivationDuration: 0,
            sensoryOverload: 0,
            latexHeat: 0,
            latexSweat: 0,
            latexCoverage: 0,
            latexColor: null,
            latexOpenings: {},
            panic: 0,
            inflationLevels: {},
            petplayRole: null,
            petplayImmersion: 0,
            furnitureRole: null,
            furnitureEndurance: 0,
            latexLayers: 0,
            identityErosion: 0,
            latexTightness: 0,
            latexCondition: 100,
            breathingTube: { active: false, flowLevel: 'full', controlledBy: null },
            electroLatex: { active: false, zones: [], controlledBy: null },
            currentGait: 'normal',
            blockedPostures: [],
            activePostureTags: [],
            drool: 0,
            equipmentTimers: {},
            currentLocation: initialLocationId || null,
            visitedLocationIds: initialLocationId ? [initialLocationId] : [],
            travelingTo: null,
            travelTurnsRemaining: 0,
            safeRoomLocation: null,
            discoveredRules: [],
            dependency: 0,
            activePreset: null,
            lastActionType: 'idle',
            settings: { maxHistoryMessages: 50, autoSummarize: true, summarizeThreshold: 40 },
            humanityIndex: 70,
            divinePermission: 20,
            humanityBalanceLock: 0
        };

        const requiredStats = new Set();
        if (CYOA.CONFIG?.CONSTRAINT_DEFAULT_ACTIONS) {
            CYOA.CONFIG.CONSTRAINT_DEFAULT_ACTIONS.forEach(action => {
                if (action.modifiers) {
                    Object.keys(action.modifiers).forEach(k => requiredStats.add(k));
                }
            });
        }
        const existingAttrNames = new Set(CYOA.currentSave.attributes.map(a => a.name));
        requiredStats.forEach(statName => {
            if (!existingAttrNames.has(statName)) {
                CYOA.currentSave.attributes.push({
                    id: CYOA.generateId(),
                    name: statName, value: 0, min: 0, max: 100, description: ''
                });
            }
        });

        if (CYOA.currentSave.skills) {
            const minLv = CYOA.CONFIG?.SKILL_MIN_LEVEL || 1;
            CYOA.currentSave.skills.forEach(s => {
                if (!s.level) s.level = minLv;
                if (typeof s.proficiency !== 'number') s.proficiency = 0;
            });
        }

        if (CYOA.currentSave.quests) {
            CYOA.currentSave.quests.forEach(q => {
                q.status = q.status || 'locked';
                q.started = false;
                q.completed = false;
            });
        }

        if (gameData.equipment && playerCharId) {
            const startEquips = buildInitialEquipmentList(playerChar, true);
            startEquips.forEach(eqDef => {
                const equipCopy = JSON.parse(JSON.stringify(eqDef));
                const slots = equipCopy.slots || [];
                slots.forEach(slot => {
                    CYOA.currentSave.equipment[slot] = equipCopy;
                });
                if (!CYOA.currentSave.acquiredItemIds.includes(equipCopy.id)) {
                    CYOA.currentSave.acquiredItemIds.push(equipCopy.id);
                }
                if (typeof parseStatModifiers === 'function' && equipCopy.statModifiers) {
                    const mods = parseStatModifiers(equipCopy.statModifiers);
                    if (typeof applyStatModifiers === 'function') {
                        applyStatModifiers(mods, true, CYOA.currentSave);
                    }
                }
            });
        }

        (gameData.characters || []).forEach(char => {
            if (!char?.id || char.id === playerCharId) return;
            const isNpc = char.roleType === 'npc' || char.role === 'npc';
            if (!isNpc) return;
            CYOA.currentSave.npcInventories[char.id] = buildInitialInventory(char);
            const npcEquips = buildInitialEquipmentList(char, false);
            const slotMap = {};
            npcEquips.forEach(eqDef => {
                const equipCopy = clone(eqDef);
                (equipCopy.slots || []).forEach(slot => {
                    slotMap[slot] = equipCopy;
                });
                if (!CYOA.currentSave.acquiredItemIds.includes(equipCopy.id)) {
                    CYOA.currentSave.acquiredItemIds.push(equipCopy.id);
                }
            });
            CYOA.currentSave.npcEquipment[char.id] = slotMap;
        });
        ensureKnownLocations(CYOA.currentSave);

        if (!CYOA.saves) CYOA.saves = {};
        CYOA.saves[saveId] = CYOA.currentSave;
        enforceSaveLimitForGame(gameData.id, saveId);
        CYOA.applyAgreementEnforcement?.({ silent: true, source: "begin" });
        if (CYOA.DataManager) {
            CYOA.DataManager.saves = CYOA.saves;
            CYOA.DataManager.saveSaves();
        }

        CYOA._gamePhase = 'playing';
        CYOA._pendingGameData = null;

        const gameBar = document.getElementById('gameModeBar');
        if (gameBar) {
            gameBar.innerHTML = CYOA.renderGameControls();
        }

        const nodeId = 'node_' + Date.now();
        const initialMessage = t('ui.game.welcome', {name: gameData.name}) + '\n\n' + (gameData.synopsis || t('ui.game.started'));
        CYOA.currentSave.nodes[nodeId] = {
            id: nodeId, parentId: null,
            userMessage: '', assistantMessage: initialMessage,
            options: [], summary: t('ui.game.opening'),
            createdAt: Date.now(), childrenIds: []
        };
        CYOA.currentSave.currentNodeId = nodeId;
        CYOA.currentNodeId = nodeId;

        if (CYOA.DataManager) CYOA.DataManager.saveSaves();

        const logEl = document.getElementById('log');
        if (logEl) {
            logEl.innerHTML = '';
            const aiDiv = document.createElement('div');
            aiDiv.className = 'ai';
            aiDiv.textContent = initialMessage;
            logEl.appendChild(aiDiv);
        }

        CYOA.renderSidebar();
        CYOA._bindInputKeyHandler();
        // 欢迎页开始后自动触发一次开场叙述，不等待玩家先输入
        setTimeout(() => {
            try { CYOA.kickoffOpeningNarration?.(); } catch (_) {}
        }, 80);
    };

    // ========== 渲染欢迎界面 ==========
    CYOA._renderWelcomeScreen = function(gameData) {
        const logEl = document.getElementById('log');
        if (!logEl) return;

        if (CYOA.DataManager?.loadSaves) CYOA.DataManager.loadSaves();
        if (CYOA.DataManager?.saves) CYOA.saves = CYOA.DataManager.saves;
        const gameSaves = Object.values(CYOA.saves || {}).filter(s => s && s.gameId === gameData.id);

        const playableChars = (gameData.characters || []).filter(c => c.roleType === 'playable' || c.role === 'playable');
        const defaultChar = playableChars[0];

        const charOptionsHtml = playableChars.map((c, i) => {
            const isSelected = i === 0 ? 'selected' : '';
            const genderIcon = c.gender === 'female' ? '♀' : c.gender === 'male' ? '♂' : '?';
            const profText = (c.customProfessions || []).concat(
                (c.professions || []).map(pid => {
                    const pDef = (gameData.professions || []).find(p => p.id === pid);
                    return pDef ? pDef.name : '';
                }).filter(Boolean)
            ).join(' / ') || '无';
            return `
                <label class="cyoa-welcome-char ${isSelected}" data-char-name="${escapeHtml(c.name)}" onclick="CYOA._selectWelcomeChar(this)">
                    <div style="font-size:20px; font-weight:700;">${genderIcon} ${escapeHtml(c.name)}</div>
                    <div style="font-size:12px; opacity:.7; margin-top:4px;">${t('ui.type.professions')}：${escapeHtml(profText)}</div>
                    <div style="font-size:12px; opacity:.6; margin-top:4px; line-height:1.4; max-height:60px; overflow:hidden;">${escapeHtml((c.description || '').substring(0, 80))}${(c.description || '').length > 80 ? '...' : ''}</div>
                </label>`;
        }).join('');

        const synopsis = escapeHtml(gameData.synopsis || '').replace(/\n/g, '<br>');
        const charCount = (gameData.characters || []).length;
        const chapterCount = (gameData.chapters || []).length;
        const sceneCount = (gameData.scenes || []).length;
        const equipCount = (gameData.equipment || []).length;

        const defaultCharId = defaultChar?.id || '';
        const initialEquips = (gameData.equipment || []).filter(e => e.startEquipped && e.ownerId === defaultCharId);
        let initialEquipHtml = '';
        if (initialEquips.length > 0) {
            initialEquipHtml = `
                <div style="margin-top:16px; padding:12px 16px; background:rgba(255,165,0,.08); border:1px solid rgba(255,165,0,.2); border-radius:8px;">
                    <div style="font-size:13px; font-weight:600; color:#e0a000; margin-bottom:8px;">${t('ui.game.initEquip')}</div>
                    ${initialEquips.map(e => {
                        const lockIcon = (e.lockLevel || 0) >= 2 ? ' 🔒' : '';
                        return `<div style="font-size:12px; opacity:.8; padding:2px 0;">• ${escapeHtml(e.name)}${lockIcon}</div>`;
                    }).join('')}
                </div>`;
        }

        logEl.innerHTML = `
            <div class="cyoa-welcome-screen" style="display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:70vh; padding:40px 20px; animation:cyoaFadeIn .6s ease;">
                <div style="text-align:center; max-width:680px; width:100%;">
                    <div style="font-size:14px; letter-spacing:6px; text-transform:uppercase; opacity:.4; margin-bottom:12px;">CYOA Interactive</div>
                    <h1 style="font-size:32px; font-weight:800; margin:0 0 8px; background:linear-gradient(135deg,var(--accent),#e06090); -webkit-background-clip:text; -webkit-text-fill-color:transparent;">${escapeHtml(gameData.name)}</h1>
                    <div style="font-size:13px; opacity:.5; margin-bottom:24px;">✍️ ${escapeHtml(gameData.author || t('ui.status.unknown'))} · v${escapeHtml(gameData.version || '1.0')}</div>

                    <div style="display:flex; justify-content:center; gap:24px; margin-bottom:24px; flex-wrap:wrap;">
                        <div style="text-align:center;"><div style="font-size:22px; font-weight:700;">${charCount}</div><div style="font-size:11px; opacity:.5;">${t('ui.type.characters')}</div></div>
                        <div style="text-align:center;"><div style="font-size:22px; font-weight:700;">${chapterCount}</div><div style="font-size:11px; opacity:.5;">${t('ui.type.chapters')}</div></div>
                        <div style="text-align:center;"><div style="font-size:22px; font-weight:700;">${sceneCount}</div><div style="font-size:11px; opacity:.5;">${t('ui.type.scenes')}</div></div>
                        <div style="text-align:center;"><div style="font-size:22px; font-weight:700;">${equipCount}</div><div style="font-size:11px; opacity:.5;">${t('ui.type.equipment')}</div></div>
                    </div>

                    <div style="text-align:left; padding:16px 20px; background:var(--bg-light); border-radius:12px; border:1px solid var(--border); margin-bottom:24px; max-height:180px; overflow-y:auto; font-size:13px; line-height:1.7; opacity:.8;">
                        ${synopsis || '<span style="opacity:.5">' + t('ui.empty.noSynopsis') + '</span>'}
                    </div>

                    ${playableChars.length > 1 ? `
                        <div style="margin-bottom:20px;">
                            <div style="font-size:14px; font-weight:600; margin-bottom:10px;">${t('ui.game.selectRole')}</div>
                            <div style="display:flex; gap:12px; justify-content:center; flex-wrap:wrap;">
                                ${charOptionsHtml}
                            </div>
                        </div>
                    ` : playableChars.length === 1 ? `
                        <div style="margin-bottom:20px;">
                            <div style="font-size:14px; font-weight:600; margin-bottom:10px;">${t('ui.game.youPlay')}</div>
                            <div style="display:flex; justify-content:center;">${charOptionsHtml}</div>
                        </div>
                    ` : ''}

                    ${initialEquipHtml}

                    <div style="margin-top:20px; padding:16px 20px; background:var(--bg); border-radius:10px; border:1px solid var(--border); width:100%; max-width:400px;">
                        <div style="font-size:13px; font-weight:600; margin-bottom:10px; color:var(--text-light);">${t('ui.game.loadOrImport')}</div>
                        <div style="display:flex; flex-direction:column; gap:10px;">
                            ${gameSaves.length > 0 ? `
                                <div style="display:flex; gap:8px; align-items:center;">
                                    <select id="cyoaWelcomeSaveSelect" class="cyoa-select" style="flex:1; padding:8px 12px; font-size:13px;">
                                        ${gameSaves.map(s => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.name || s.id)} — ${new Date(s.updatedAt || 0).toLocaleString()}</option>`).join('')}
                                    </select>
                                    <button class="cyoa-btn cyoa-btn-primary" onclick="CYOA._loadSaveFromWelcome()" style="padding:8px 16px; white-space:nowrap;">📂 ${t('ui.btn.load')}</button>
                                </div>
                            ` : `
                                <div style="font-size:12px; color:var(--text-light);">${t('ui.game.noSavesYet')}</div>
                            `}
                            <button class="cyoa-btn cyoa-btn-secondary" onclick="CYOA._importSaveFromWelcome()" style="padding:8px 16px;">📥 ${t('ui.btn.import')}</button>
                        </div>
                    </div>

                    <button class="cyoa-btn cyoa-btn-primary" onclick="CYOA.beginGame()" style="margin-top:28px; padding:14px 48px; font-size:16px; font-weight:700; border-radius:12px; letter-spacing:2px; box-shadow:0 4px 20px rgba(var(--accent-rgb,100,100,255),.3);">
                        ${t('ui.btn.startAdventure')}
                    </button>
                </div>
            </div>
            <style>
                @keyframes cyoaFadeIn { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
                .cyoa-welcome-char { display:block; cursor:pointer; padding:12px 16px; border:2px solid var(--border); border-radius:10px; text-align:left; min-width:200px; max-width:280px; transition:all .2s; background:var(--bg); }
                .cyoa-welcome-char:hover { border-color:var(--accent); background:rgba(var(--accent-rgb,100,100,255),.05); }
                .cyoa-welcome-char.selected { border-color:var(--accent); background:rgba(var(--accent-rgb,100,100,255),.1); box-shadow:0 0 0 3px rgba(var(--accent-rgb,100,100,255),.15); }
            </style>
        `;
    };

    CYOA._selectWelcomeChar = function(el) {
        document.querySelectorAll('.cyoa-welcome-char').forEach(c => c.classList.remove('selected'));
        el.classList.add('selected');
    };

    CYOA._loadSaveFromWelcome = function() {
        const sel = document.getElementById('cyoaWelcomeSaveSelect');
        const saveId = sel?.value;
        if (!saveId || !CYOA.saves?.[saveId]) return;
        if (CYOA.saves[saveId].gameId !== CYOA.currentGame?.id) {
            alert(t('ui.msg.saveMismatch'));
            return;
        }
        CYOA.loadSave(saveId);
    };

    CYOA._importSaveFromWelcome = function() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = function(e) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = function(ev) {
                try {
                    const save = JSON.parse(ev.target.result);
                    if (!save.id || !save.gameId || !save.nodes) {
                        alert(t('ui.msg.invalidSaveFile'));
                        return;
                    }
                    const game = CYOA.DataManager?.getGameById(save.gameId);
                    if (!game) {
                        alert(t('ui.msg.saveGameNotExist'));
                        return;
                    }
                    CYOA.saves = CYOA.saves || {};
                    CYOA.saves[save.id] = save;
                    if (CYOA.DataManager) {
                        CYOA.DataManager.saves = CYOA.saves;
                        CYOA.DataManager.saveSaves();
                    }
                    if (save.gameId === CYOA.currentGame?.id) {
                        CYOA.loadSave(save.id);
                    } else {
                        CYOA.currentGame = game;
                        CYOA.loadSave(save.id);
                    }
                } catch (ex) {
                    alert(t('ui.msg.saveImportFailed'));
                }
            };
            reader.readAsText(file);
        };
        input.click();
    };

    CYOA.exitGame = function() {
        CYOA._gameMsgSeq = Number(CYOA._gameMsgSeq || 0) + 1;
        CYOA._sendingGameMsg = false;
        const logEl = document.getElementById("log");
        if (logEl) {
            if (typeof CYOA._preGameLogHTML === "string") {
                // 恢复进入游戏前的 Ada Chat 聊天记录
                logEl.innerHTML = CYOA._preGameLogHTML;
            } else {
                // 兜底：至少移除游戏消息，避免残留
                logEl.querySelectorAll(".cyoa-msg").forEach(el => el.remove());
            }
        }
        const gameLog = document.getElementById("cyoaGameLog");
        if (gameLog) gameLog.innerHTML = "";
        CYOA._preGameLogHTML = null;

        if (typeof MainApp !== "undefined" && typeof MainApp.setGameMode === "function") {
            MainApp.setGameMode(false);
        }

        // 强制清理 CYOA 侧栏与游戏模式残留节点（防止 UI 未被主程序完全回收）
        try {
            const sidebarContainer = document.getElementById('cyoa-sidebar-container');
            if (sidebarContainer && sidebarContainer.parentNode) {
                sidebarContainer.parentNode.removeChild(sidebarContainer);
            }
            const gameBar = document.getElementById('gameModeBar');
            if (gameBar && gameBar.parentNode) {
                gameBar.parentNode.removeChild(gameBar);
            }
            document.querySelectorAll(
                '.cyoa-game-sidebar, .cyoa-game-controls, #cyoa-game-sidebar, #cyoa-game-input-area, [id^="cyoa_"]'
            ).forEach(el => {
                if (el && el.parentNode) el.parentNode.removeChild(el);
            });
            document.body.classList.remove('game-mode-active');
            document.body.classList.remove('cyoa-game-mode');
        } catch (_) {}

        CYOA.currentGame = null;
        CYOA.currentSave = null;
        CYOA.currentNodeId = null;
        CYOA._gamePhase = "idle";
        CYOA.renderSidebar?.();
    };

    CYOA.addKeyEvent = function(type, desc) {
        if (!CYOA.currentSave) return;
        if (!Array.isArray(CYOA.currentSave.keyEvents)) CYOA.currentSave.keyEvents = [];
        CYOA.currentSave.keyEvents.push({
            id: CYOA.generateId(),
            type: type || "event",
            desc: desc || "",
            ts: Date.now()
        });
        if (CYOA.currentSave.keyEvents.length > 100) {
            CYOA.currentSave.keyEvents = CYOA.currentSave.keyEvents.slice(-100);
        }
        persistSave();
    };

    CYOA.setTether = function(tetherConfig) {
        if (!CYOA.currentSave) return;
        CYOA.currentSave.tether = { ...(CYOA.currentSave.tether || {}), ...(tetherConfig || {}), active: true };
        persistSave();
    };

    CYOA.clearTether = function() {
        if (!CYOA.currentSave) return;
        CYOA.currentSave.tether = { active: false };
        persistSave();
    };

    CYOA.setPosture = function(posture) {
        if (!CYOA.currentSave) return;
        CYOA.currentSave.posture = posture || "standing";
        CYOA.currentSave.postureDuration = 0;
        persistSave();
    };

    CYOA.evaluateCondition = function(cond) {
        const save = CYOA.currentSave;
        if (!save || !cond) return false;
        switch (cond.type) {
            case "quest_complete": {
                const q = (save.quests || []).find(x => x.id === cond.questId);
                return q?.status === "completed";
            }
            case "has_item": {
                const it = (save.inventory || []).find(x => x.id === cond.itemId || x.itemId === cond.itemId);
                return (it?.quantity || 0) >= (cond.quantity || 1);
            }
            case "attribute_check": {
                let v = 0;
                if (Array.isArray(save.attributes)) {
                    const found = save.attributes.find(a => a?.name === cond.attribute || a?.id === cond.attribute);
                    v = Number(found?.value ?? 0);
                } else {
                    v = Number(save.attributes?.[cond.attribute] ?? 0);
                }
                const tval = Number(cond.value ?? 0);
                const op = cond.operator || ">=";
                if (op === ">=") return v >= tval;
                if (op === "<=") return v <= tval;
                if (op === ">") return v > tval;
                if (op === "<") return v < tval;
                if (op === "==") return v === tval;
                return false;
            }
            default:
                return false;
        }
    };

    CYOA.changeChapter = function(chapterId) {
        const save = CYOA.currentSave;
        const game = CYOA.currentGame;
        if (!save || !game || !chapterId) return;
        const oldChapterId = save.currentChapter || "";
        const next = (game.chapters || []).find(ch => ch.id === chapterId);
        if (!next) return;
        if (!CYOA.isChapterUnlocked(next, save)) {
            alert("该章节尚未解锁");
            return;
        }
        save.currentChapter = chapterId;
        next.unlocked = true;
        const entry = pickChapterEntryNode(game, next);
        if (entry?.id) {
            save.currentNodeId = entry.id;
            CYOA.currentNodeId = entry.id;
            if (entry.location) save.currentLocation = entry.location;
        }
        if (oldChapterId && oldChapterId !== chapterId) {
            CYOA._generateChapterSummary?.(oldChapterId).catch(() => {});
        }
        CYOA.addKeyEvent("chapter_enter", "进入：" + (next.title || chapterId));
        persistSave();
        CYOA.renderSidebar?.();
    };

    function getChapterCompletionConditions(chapter) {
        if (!chapter) return [];
        if (Array.isArray(chapter.completionConditions)) return chapter.completionConditions;
        if (Array.isArray(chapter.completeConditions)) return chapter.completeConditions;
        if (Array.isArray(chapter.objectives) && chapter.objectives.length) {
            // 将 objectives 兼容为 has_item/quest_complete/attribute_check 三类
            return chapter.objectives.map(obj => {
                if (typeof obj === "string") return { type: "quest_complete", questId: obj };
                if (obj?.type) return obj;
                if (obj?.questId) return { type: "quest_complete", questId: obj.questId };
                if (obj?.itemId) return { type: "has_item", itemId: obj.itemId, quantity: Number(obj.quantity || 1) };
                if (obj?.attribute) return {
                    type: "attribute_check",
                    attribute: obj.attribute,
                    operator: obj.operator || ">=",
                    value: Number(obj.value || 0)
                };
                return { type: "quest_complete", questId: "" };
            }).filter(c => c.questId || c.itemId || c.attribute);
        }
        return [];
    }

    CYOA.tryProgressChapter = function() {
        const save = CYOA.currentSave;
        const game = CYOA.currentGame;
        if (!save || !game || !save.currentChapter) return false;
        const current = (game.chapters || []).find(ch => ch.id === save.currentChapter);
        if (!current) return false;

        const conds = getChapterCompletionConditions(current);
        const completed = new Set(save.completedChapters || []);
        if (completed.has(current.id)) return false;
        if (conds.length && !conds.every(c => CYOA.evaluateCondition?.(c))) return false;

        completed.add(current.id);
        save.completedChapters = Array.from(completed);
        current.unlocked = true;

        const sorted = getSortedChapters(game);
        const idx = sorted.findIndex(ch => ch.id === current.id);
        const next = idx >= 0 ? sorted[idx + 1] : null;
        if (next) next.unlocked = true;

        CYOA.addKeyEvent?.("chapter_complete", `章节完成：${current.title || current.id}`);
        return true;
    };

    CYOA.checkChapterTransition = function() {
        const save = CYOA.currentSave;
        const game = CYOA.currentGame;
        if (!save || !game || !save.currentChapter) return false;
        const current = (game.chapters || []).find(ch => ch.id === save.currentChapter);
        if (!current) return false;

        const transitions = Array.isArray(current.transitionConditions) ? current.transitionConditions : [];
        if (transitions.length > 0) {
            const allMet = transitions.every(c => CYOA.evaluateCondition?.(c));
            if (!allMet) return false;
            const sorted = getSortedChapters(game);
            const idx = sorted.findIndex(ch => ch.id === current.id);
            const next = idx >= 0 ? sorted[idx + 1] : null;
            if (next?.id) {
                CYOA.changeChapter(next.id);
                return true;
            }
            return false;
        }

        return !!CYOA.tryProgressChapter?.();
    };

    CYOA._generateChapterSummary = async function(chapterId) {
        const save = CYOA.currentSave;
        const game = CYOA.currentGame;
        if (!save || !game || !chapterId) return "";
        if (!save.chapterSummaries || typeof save.chapterSummaries !== "object") save.chapterSummaries = {};
        if (save.chapterSummaries[chapterId]) return save.chapterSummaries[chapterId];

        const chapter = (game.chapters || []).find(ch => ch.id === chapterId);
        const title = chapter?.title || chapterId;
        const history = Array.isArray(save.history) ? save.history : [];
        const recent = history.slice(-8).map(h => String(h?.content || "").trim()).filter(Boolean);
        const body = recent.join(" ").replace(/\s+/g, " ").slice(0, 260);
        const summary = body ? `${title}：${body}` : `${title}：已完成。`;
        save.chapterSummaries[chapterId] = summary;
        persistSave();
        return summary;
    };

    CYOA.isChapterUnlocked = function(chapter, saveArg) {
        const save = saveArg || CYOA.currentSave;
        const game = CYOA.currentGame;
        if (!chapter) return false;
        if (!save || !game) return chapter.unlocked !== false;

        const chapterId = chapter.id;
        const completed = new Set(save.completedChapters || []);
        if (chapter.unlocked === true || completed.has(chapterId) || save.currentChapter === chapterId) return true;

        const prereq = chapter.prerequisiteChapterId || chapter.previousChapterId || chapter.requiredChapterId || "";
        if (prereq) return completed.has(prereq);

        const conditions = Array.isArray(chapter.unlockConditions)
            ? chapter.unlockConditions
            : (Array.isArray(chapter.conditions) ? chapter.conditions : []);
        if (conditions.length) {
            return conditions.every(c => CYOA.evaluateCondition?.(c));
        }

        const sorted = getSortedChapters(game);
        const idx = sorted.findIndex(ch => ch.id === chapterId);
        if (idx > 0) {
            const prev = sorted[idx - 1];
            return completed.has(prev?.id);
        }
        return chapter.unlocked !== false;
    };

    function ensureKnownLocations(saveArg) {
        const save = saveArg || CYOA.currentSave;
        if (!save || typeof save !== "object") return [];
        const known = Array.isArray(save.visitedLocationIds) ? save.visitedLocationIds.slice() : [];
        const push = (id) => {
            const v = String(id || "").trim();
            if (!v) return;
            if (!known.includes(v)) known.push(v);
        };
        push(save.currentLocation);
        Object.values(save.nodes || {}).forEach((n) => push(n?.location));
        save.visitedLocationIds = known;
        return known;
    }

    CYOA.markLocationVisited = function(locationId, saveArg) {
        const save = saveArg || CYOA.currentSave;
        if (!save) return;
        const id = String(locationId || "").trim();
        if (!id) return;
        const known = ensureKnownLocations(save);
        if (!known.includes(id)) {
            known.push(id);
            save.visitedLocationIds = known;
            persistSave();
        }
    };

    CYOA.getKnownLocationIds = function(saveArg) {
        const save = saveArg || CYOA.currentSave;
        return ensureKnownLocations(save).slice();
    };

    CYOA.updateTravel = function() {
        const save = CYOA.currentSave;
        if (!save || !save.travelingTo) return;
        save.travelTurnsRemaining = Math.max(0, (save.travelTurnsRemaining || 0) - 1);
        if (save.travelTurnsRemaining <= 0) {
            save.currentLocation = save.travelingTo;
            CYOA.markLocationVisited?.(save.currentLocation, save);
            const name = CYOA.getLocationInfo?.(save.travelingTo)?.name || save.travelingTo;
            CYOA.addKeyEvent?.("travel_arrive", `到达：${name}`);
            save.travelingTo = null;
            CYOA.tryProgressChapter?.();
        }
        persistSave();
    };

    CYOA.travelTo = function(locationId) {
        const save = CYOA.currentSave;
        const game = CYOA.currentGame;
        if (!save || !game || !locationId) return;
        if (save.travelingTo) {
            alert("你正在移动中，暂时无法发起新的移动。");
            return;
        }
        if (locationId === save.currentLocation) return;
        const edges = game.locationEdges || [];
        const from = save.currentLocation;
        const edge = edges.find(e =>
            (e.from === from && e.to === locationId) ||
            (e.to === from && e.from === locationId)
        );
        if (Array.isArray(edges) && edges.length > 0 && !edge) {
            alert("当前地点无法直达目标地点。");
            return;
        }
        const rawBaseTurns = Number(edge?.travelTurns ?? CYOA.CONFIG?.LOCATION_DEFAULTS?.defaultTravelTurns ?? 6);
        const baseTurns = Number.isFinite(rawBaseTurns) && rawBaseTurns > 0 ? rawBaseTurns : 6;
        const constraints = CYOA.getActiveConstraints?.() || new Set();
        const isMoveLimited = constraints.has("limited_step");
        const edgeLimitedExtra = Number(edge?.limitedStepExtraTurns);
        const gameLimitedExtra = Number(game?.travelRules?.limitedStepExtraTurns);
        const defaultLimitedExtra = Number(CYOA.CONFIG?.LOCATION_DEFAULTS?.limitedStepExtraTurns ?? 2);
        const limitedExtra = Number.isFinite(edgeLimitedExtra)
            ? edgeLimitedExtra
            : (Number.isFinite(gameLimitedExtra) ? gameLimitedExtra : defaultLimitedExtra);
        const turns = Math.max(1, Math.round(baseTurns + (isMoveLimited ? Math.max(0, limitedExtra) : 0)));
        save.travelingTo = locationId;
        save.travelTurnsRemaining = turns;
        const targetName = CYOA.getLocationInfo?.(locationId)?.name || locationId;
        const note = isMoveLimited && limitedExtra > 0 ? `，受限移动 +${Math.max(0, limitedExtra)} 回合` : "";
        CYOA.addKeyEvent?.("travel_start", `开始前往：${targetName}（${turns} 回合${note}）`);
        persistSave();
    };

    CYOA.isInSafeRoom = function() {
        const save = CYOA.currentSave;
        if (!save) return false;
        const loc = CYOA.getLocationInfo?.(save.currentLocation);
        return !!loc?.isSafeRoom;
    };

    CYOA.getLocationInfo = function(locationId) {
        const game = CYOA.currentGame;
        if (!game) return null;
        return (game.locations || []).find(l => l.id === locationId) || null;
    };

    CYOA.getRegionByLocation = function(locationId) {
        const game = CYOA.currentGame;
        if (!game || !locationId) return null;
        const wm = game.worldMap || {};
        const regions = Array.isArray(wm.regions) ? wm.regions : [];
        return regions.find(r => Array.isArray(r.locationIds) && r.locationIds.includes(locationId)) || null;
    };

    CYOA.travelToRegion = function(regionId) {
        const game = CYOA.currentGame;
        const save = CYOA.currentSave;
        if (!game || !save || !regionId) return false;
        const wm = game.worldMap || {};
        const regions = Array.isArray(wm.regions) ? wm.regions : [];
        const region = regions.find(r => r.id === regionId || r.name === regionId);
        if (!region || !Array.isArray(region.locationIds) || !region.locationIds.length) return false;
        const target = region.locationIds.find(id => id !== save.currentLocation) || region.locationIds[0];
        if (!target) return false;
        CYOA.travelTo(target);
        return true;
    };

    CYOA.checkEquipCompatibility = function(equipDefOrId, saveArg) {
        const save = saveArg || CYOA.currentSave;
        const game = CYOA.currentGame;
        if (!save || !game) return [{ code: "no_context", message: "缺少存档或游戏上下文" }];

        const equipDef = typeof equipDefOrId === "string"
            ? (game.equipment || []).find(e => e.id === equipDefOrId)
            : equipDefOrId;
        if (!equipDef) return [{ code: "not_found", message: "装备定义不存在" }];

        const issues = [];
        const slots = Array.isArray(equipDef.slots) ? equipDef.slots : [];
        const equipped = (save.equipment && typeof save.equipment === "object") ? save.equipment : {};
        const constraints = CYOA.getActiveConstraints?.() || new Set();
        const newLayer = getEquipLayerValue(equipDef, equipDef);

        const ownerId = equipDef.ownerId || "";
        if (ownerId && ownerId !== save.playerCharacterId && !(save.acquiredItemIds || []).includes(equipDef.id)) {
            issues.push({ code: "owner_restricted", message: "该装备不属于当前角色" });
        }

        // 槽位冲突：层级/锁定均会阻断替换
        slots.forEach(slot => {
            const old = equipped[slot];
            if (!old?.id) return;
            const oldDef = (game.equipment || []).find(e => e.id === old.id);
            const oldLayer = getEquipLayerValue(old, oldDef);
            const lockLv = Number(CYOA.getEquipLockLevel?.(old, oldDef) || 0);
            if (oldLayer === 0) {
                issues.push({ code: "layer_immutable", slot, message: `槽位 ${slot} 为 LV0 皮肤层，不可替换` });
                return;
            }
            if (lockLv >= 2) {
                issues.push({ code: "slot_locked", slot, message: `槽位 ${slot} 处于锁定状态（LV${lockLv}）` });
                return;
            }
            if (newLayer < oldLayer) {
                issues.push({ code: "blocked_by_outer_layer", slot, message: `槽位 ${slot} 有更外层装备，需先卸下外层` });
            }
        });

        // 装备互斥冲突：conflictsWithEquipment / conflicts 字段兼容
        const conflictIds = new Set([
            ...(Array.isArray(equipDef.conflictsWithEquipment) ? equipDef.conflictsWithEquipment : []),
            ...(Array.isArray(equipDef.conflicts) ? equipDef.conflicts : [])
        ]);
        Object.values(equipped).forEach(item => {
            if (item?.id && conflictIds.has(item.id)) {
                issues.push({ code: "conflict_equipment", equipId: item.id, message: `与已装备 ${item.id} 冲突` });
            }
        });

        // 约束冲突：与当前激活约束互斥
        const activeConstraints = CYOA.getActiveConstraints?.() || new Set();
        const conflictConstraints = Array.isArray(equipDef.conflictsWithConstraints) ? equipDef.conflictsWithConstraints : [];
        conflictConstraints.forEach(c => {
            if (constraints.has(c)) issues.push({ code: "conflict_constraint", constraint: c, message: `与当前约束 ${c} 冲突` });
        });

        // 槽位依赖：no_hands 时，一些槽位默认无法直接操作（除非在绕过白名单）
        const slotDependency = CYOA.CONFIG?.SLOT_DEPENDENCY || {};
        const bypassSlots = new Set(Array.isArray(CYOA.CONFIG?.TOOL_BYPASS_SLOTS) ? CYOA.CONFIG.TOOL_BYPASS_SLOTS : []);
        if (constraints.has("no_hands")) {
            slots.forEach(slot => {
                if (bypassSlots.has(slot)) return;
                const deps = Array.isArray(slotDependency[slot]) ? slotDependency[slot] : [];
                if (deps.length) {
                    issues.push({
                        code: "hands_blocked",
                        slot,
                        message: `双手受限，无法直接操作槽位 ${slot}`
                    });
                }
            });
        }

        return issues;
    };

    CYOA.getEquipLockLevel = function(item, equipDef) {
        return Number(item?.lockLevel ?? equipDef?.lockLevel ?? 0);
    };

    function getEquipLayerValue(item, equipDef) {
        const raw = item?.layer ?? equipDef?.layer;
        const n = Number(raw);
        return Number.isFinite(n) ? Math.max(0, Math.min(7, n)) : 5;
    }

    function getAgreementActorAndTarget() {
        const save = CYOA.currentSave || {};
        return {
            actorId: save.playerCharacterId || "",
            targetId: save.playerCharacterId || ""
        };
    }

    function getAgreementParties(agreement) {
        const controllerId = agreement?.controllerId || agreement?.ownerId || agreement?.masterId || agreement?.partyAId || "";
        const controlledId = agreement?.controlledId || agreement?.subId || agreement?.partyBId || "";
        return { controllerId, controlledId };
    }

    function isMasterSlaveAgreement(agreement) {
        const t = String(agreement?.type || "").trim().toLowerCase();
        if (!t) return false;
        if (t === "slave" || t === "master_sub" || t === "masterslave" || t === "master-slave") return true;
        return t.includes("主奴");
    }

    function getAgreementPermissionFlags(agreement) {
        const perms = agreement?.permissions || {};
        const defaults = isMasterSlaveAgreement(agreement)
            ? { controllerCanManageEquipment: true, selfCanManageEquipment: false }
            : { controllerCanManageEquipment: true, selfCanManageEquipment: true };
        return {
            controllerCanManageEquipment: perms.controllerCanManageEquipment ?? defaults.controllerCanManageEquipment,
            selfCanManageEquipment: perms.selfCanManageEquipment ?? defaults.selfCanManageEquipment
        };
    }

    function canOperateEquipmentByAgreement(actionType) {
        const save = CYOA.currentSave || {};
        const { actorId, targetId } = getAgreementActorAndTarget();
        if (!actorId || !targetId) return true;
        const agreements = Array.isArray(save.agreements) ? save.agreements : [];
        for (const ag of agreements) {
            if (!ag || ag.active === false) continue;
            if (!isMasterSlaveAgreement(ag)) continue;
            const { controllerId, controlledId } = getAgreementParties(ag);
            if (!controlledId || controlledId !== targetId) continue;
            const flags = getAgreementPermissionFlags(ag);
            if (actorId === controlledId && !flags.selfCanManageEquipment) {
                alert(`当前合同/契约限制你直接${actionType === "equip" ? "穿戴" : "卸下"}装备。`);
                return false;
            }
            if (actorId === controllerId && !flags.controllerCanManageEquipment) {
                alert("当前合同/契约未授予控制方装备管理权限。");
                return false;
            }
        }
        return true;
    }

    function getActiveAgreementsForPlayer(saveArg) {
        const save = saveArg || CYOA.currentSave || {};
        const playerId = String(save?.playerCharacterId || "").trim();
        const playerName = String(save?.playerCharacter || "").trim();
        if (!playerId) return [];
        const agreements = Array.isArray(save?.agreements) ? save.agreements : [];
        return agreements.filter((ag) => {
            if (!ag || ag.active === false) return false;
            const parties = getAgreementParties(ag);
            const controlled = String(parties.controlledId || "").trim();
            if (!controlled) return false;
            return controlled === playerId || (!!playerName && controlled === playerName);
        });
    }

    function getAgreementForcedEquipIds(agreement, game) {
        const ids = new Set();
        const pull = (arrLike) => {
            if (!Array.isArray(arrLike)) return;
            arrLike.forEach((x) => {
                const v = String(x || "").trim();
                if (v) ids.add(v);
            });
        };
        pull(agreement?.forcedEquipmentIds);
        pull(agreement?.requiredEquipmentIds);
        pull(agreement?.enforcedEquipmentIds);
        pull(agreement?.mandatedEquipmentIds);
        pull(agreement?.equipmentIds);

        const presetId = String(
            agreement?.outfitPresetId
            || agreement?.enforcedOutfitPresetId
            || agreement?.requiredOutfitPresetId
            || ""
        ).trim();
        if (presetId && game) {
            const preset = (game.outfitPresets || []).find(p => p.id === presetId || p.name === presetId);
            if (preset && Array.isArray(preset.items)) {
                preset.items.forEach((it) => {
                    const v = String(it || "").trim();
                    if (v) ids.add(v);
                });
            }
        }
        return Array.from(ids);
    }

    function getAgreementEnforceLockLevel(agreement) {
        const raw = agreement?.enforceLockLevel ?? agreement?.lockLevelOnEnforce ?? agreement?.lockLevel;
        const n = Number(raw);
        if (Number.isFinite(n)) return Math.max(0, Math.min(5, n));
        if (isMasterSlaveAgreement(agreement)) return 2;
        return 0;
    }

    CYOA.forceEquipById = function(equipId, options) {
        const save = CYOA.currentSave;
        const game = CYOA.currentGame;
        if (!save || !game || !equipId) return false;
        if (!save.equipment || typeof save.equipment !== "object") save.equipment = {};
        if (!Array.isArray(save.inventory)) save.inventory = [];
        const opt = options && typeof options === "object" ? options : {};
        const lockLevel = Math.max(0, Math.min(5, Number(opt.lockLevel || 0)));
        const def = (game.equipment || []).find(e => e.id === equipId);
        if (!def) return false;
        const slots = Array.isArray(def.slots) ? def.slots : [];
        if (!slots.length) return false;

        // 先移除目标槽位中可替换装备（LV0 不动）
        slots.forEach((slot) => {
            const old = save.equipment?.[slot];
            if (!old?.id) return;
            const oldDef = (game.equipment || []).find(e => e.id === old.id);
            const oldLayer = getEquipLayerValue(old, oldDef);
            if (oldLayer === 0) return;
            if (!save.inventory.some(i => i.id === old.id)) {
                save.inventory.push({ id: old.id, name: old.name || old.id, quantity: 1, itemType: "equipment" });
            }
            delete save.equipment[slot];
        });

        slots.forEach((slot) => {
            save.equipment[slot] = {
                id: def.id,
                name: def.name || def.id,
                layer: getEquipLayerValue(def, def),
                narrativeRole: String(def.narrativeRole || "auto"),
                armorHardness: Number(def.armorHardness || 0),
                armorProtection: Number(def.armorProtection || 0),
                armorWeight: Number(def.armorWeight || 0),
                armorMobilityPenalty: Number(def.armorMobilityPenalty || 0),
                unlockItemId: def.unlockItemId || "",
                lockLevel: lockLevel || Number(def.lockLevel || 0),
                attachments: Array.isArray(def.attachments) ? JSON.parse(JSON.stringify(def.attachments)) : []
            };
        });

        const invIdx = findInventoryIndexById(save.inventory, def.id);
        if (invIdx >= 0) {
            const q = Number(save.inventory[invIdx]?.quantity || 1);
            if (q > 1) save.inventory[invIdx].quantity = q - 1;
            else save.inventory.splice(invIdx, 1);
        }
        CYOA.resolveCompoundPosture?.();
        persistSave();
        return true;
    };

    CYOA.applyAgreementEnforcement = function(options) {
        const save = CYOA.currentSave;
        const game = CYOA.currentGame;
        if (!save || !game) return { ok: false, changed: false };
        const opt = options && typeof options === "object" ? options : {};
        const silent = !!opt.silent;
        const agList = getActiveAgreementsForPlayer(save);
        if (!agList.length) return { ok: true, changed: false };
        let changed = false;

        agList.forEach((ag) => {
            if (!isMasterSlaveAgreement(ag)) return;
            const flags = getAgreementPermissionFlags(ag);
            if (!flags.controllerCanManageEquipment) return;
            const forceIds = getAgreementForcedEquipIds(ag, game);
            if (!forceIds.length) return;
            const stripOthers = ag?.stripOthers !== false && ag?.removeOtherEquipment !== false;
            const enforceLockLevel = getAgreementEnforceLockLevel(ag);

            if (stripOthers && save.equipment && typeof save.equipment === "object") {
                Object.keys(save.equipment).forEach((slot) => {
                    const eq = save.equipment[slot];
                    if (!eq?.id) return;
                    if (forceIds.includes(eq.id)) return;
                    const def = (game.equipment || []).find(e => e.id === eq.id);
                    const layer = getEquipLayerValue(eq, def);
                    if (layer === 0) return;
                    if (!Array.isArray(save.inventory)) save.inventory = [];
                    if (!save.inventory.some(i => i.id === eq.id)) {
                        save.inventory.push({ id: eq.id, name: eq.name || eq.id, quantity: 1, itemType: "equipment" });
                    }
                    delete save.equipment[slot];
                    changed = true;
                });
            }

            forceIds.forEach((eid) => {
                const already = Object.values(save.equipment || {}).some(x => x?.id === eid);
                if (already) {
                    if (enforceLockLevel > 0) {
                        Object.keys(save.equipment || {}).forEach((slot) => {
                            const eq = save.equipment[slot];
                            if (eq?.id === eid && Number(eq.lockLevel || 0) < enforceLockLevel) {
                                eq.lockLevel = enforceLockLevel;
                                changed = true;
                            }
                        });
                    }
                    return;
                }
                const ok = CYOA.forceEquipById?.(eid, { lockLevel: enforceLockLevel });
                if (ok) changed = true;
            });
        });

        if (changed) {
            if (!silent) CYOA.appendSystemMessage?.("📜 合同/契约生效：控制方已执行强制着装规则。");
            CYOA.addKeyEvent?.("agreement_enforce", "合同/契约触发强制脱装/穿装。");
            persistSave();
            CYOA.renderInventoryPanel?.();
            CYOA.renderAttributesPanel?.();
            CYOA.renderStatusPanel?.();
        }
        return { ok: true, changed };
    };

    function getPlayerControllerAgreements(saveArg) {
        const save = saveArg || CYOA.currentSave || {};
        const playerId = String(save?.playerCharacterId || "").trim();
        const playerName = String(save?.playerCharacter || "").trim();
        const agreements = Array.isArray(save?.agreements) ? save.agreements : [];
        return agreements.filter((ag) => {
            if (!ag || ag.active === false) return false;
            if (!isMasterSlaveAgreement(ag)) return false;
            const parties = getAgreementParties(ag);
            const controller = String(parties.controllerId || "").trim();
            if (!controller) return false;
            return controller === playerId || (!!playerName && controller === playerName);
        });
    }

    CYOA.getControllableNpcIdsByAgreement = function() {
        const save = CYOA.currentSave;
        const out = new Set();
        getPlayerControllerAgreements(save).forEach((ag) => {
            const parties = getAgreementParties(ag);
            const controlled = String(parties.controlledId || "").trim();
            if (controlled) out.add(controlled);
        });
        return Array.from(out);
    };

    function resolveNpcStorageKey(npcIdOrName) {
        const raw = String(npcIdOrName || "").trim();
        if (!raw) return "";
        const chars = Array.isArray(CYOA.currentGame?.characters) ? CYOA.currentGame.characters : [];
        const byId = chars.find(ch => String(ch?.id || "").trim() === raw);
        if (byId?.id) return String(byId.id);
        const byName = chars.find(ch => String(ch?.name || "").trim() === raw);
        if (byName?.id) return String(byName.id);
        return raw;
    }

    CYOA.canManageNpcEquipmentByAgreement = function(npcId) {
        const targetRaw = String(npcId || "").trim();
        const target = resolveNpcStorageKey(targetRaw);
        if (!target) return false;
        const allowSet = new Set(CYOA.getControllableNpcIdsByAgreement?.() || []);
        if (allowSet.has(target) || allowSet.has(targetRaw)) return true;
        const chars = Array.isArray(CYOA.currentGame?.characters) ? CYOA.currentGame.characters : [];
        const ch = chars.find(c => String(c?.id || "").trim() === target || String(c?.name || "").trim() === targetRaw);
        const cname = String(ch?.name || "").trim();
        return !!(cname && allowSet.has(cname));
    };

    CYOA.forceEquipNpcById = function(npcId, equipId, options) {
        const save = CYOA.currentSave;
        const game = CYOA.currentGame;
        if (!save || !game || !npcId || !equipId) return false;
        if (!CYOA.canManageNpcEquipmentByAgreement?.(npcId)) return false;
        const npcKey = resolveNpcStorageKey(npcId);
        if (!npcKey) return false;
        if (!save.npcEquipment || typeof save.npcEquipment !== "object") save.npcEquipment = {};
        if (!save.npcEquipment[npcKey] || typeof save.npcEquipment[npcKey] !== "object") save.npcEquipment[npcKey] = {};
        if (!save.npcInventories || typeof save.npcInventories !== "object") save.npcInventories = {};
        if (!Array.isArray(save.npcInventories[npcKey])) save.npcInventories[npcKey] = [];
        const opt = options && typeof options === "object" ? options : {};
        const lockLevel = Math.max(0, Math.min(5, Number(opt.lockLevel || 0)));
        const def = (game.equipment || []).find(e => e.id === equipId);
        if (!def) return false;
        const slots = Array.isArray(def.slots) ? def.slots : [];
        if (!slots.length) return false;

        slots.forEach((slot) => {
            const old = save.npcEquipment[npcKey][slot];
            if (!old?.id) return;
            if (!save.npcInventories[npcKey].some(i => i.id === old.id)) {
                save.npcInventories[npcKey].push({ id: old.id, name: old.name || old.id, quantity: 1, itemType: "equipment" });
            }
            delete save.npcEquipment[npcKey][slot];
        });
        const item = {
            id: def.id,
            name: def.name || def.id,
            layer: getEquipLayerValue(def, def),
            unlockItemId: def.unlockItemId || "",
            lockLevel: lockLevel || Number(def.lockLevel || 0),
            attachments: Array.isArray(def.attachments) ? JSON.parse(JSON.stringify(def.attachments)) : []
        };
        slots.forEach((slot) => {
            save.npcEquipment[npcKey][slot] = JSON.parse(JSON.stringify(item));
        });
        const inv = save.npcInventories[npcKey];
        const idx = findInventoryIndexById(inv, def.id);
        if (idx >= 0) {
            const q = Number(inv[idx]?.quantity || 1);
            if (q > 1) inv[idx].quantity = q - 1;
            else inv.splice(idx, 1);
        }
        persistSave();
        return true;
    };

    CYOA.transferItemToNpc = function(npcId, itemId, amount) {
        const save = CYOA.currentSave;
        if (!save || !npcId || !itemId) return false;
        if (!CYOA.canManageNpcEquipmentByAgreement?.(npcId)) return false;
        const npcKey = resolveNpcStorageKey(npcId);
        if (!npcKey) return false;
        if (!Array.isArray(save.inventory)) return false;
        if (!save.npcInventories || typeof save.npcInventories !== "object") save.npcInventories = {};
        if (!Array.isArray(save.npcInventories[npcKey])) save.npcInventories[npcKey] = [];
        const qty = Math.max(1, Number(amount || 1));
        const pIdx = findInventoryIndexById(save.inventory, itemId);
        if (pIdx < 0) return false;
        const pItem = save.inventory[pIdx];
        const canGive = Math.min(qty, Number(pItem?.quantity || 1));
        if (canGive <= 0) return false;
        const nIdx = findInventoryIndexById(save.npcInventories[npcKey], itemId);
        if (nIdx >= 0) save.npcInventories[npcKey][nIdx].quantity = Number(save.npcInventories[npcKey][nIdx].quantity || 1) + canGive;
        else save.npcInventories[npcKey].push({ id: pItem.id, name: pItem.name || pItem.id, quantity: canGive, itemType: pItem.itemType || "common" });
        consumeInventoryItemById(save.inventory, itemId, canGive);
        persistSave();
        CYOA.renderInventoryPanel?.();
        return true;
    };

    CYOA.takeItemFromNpc = function(npcId, itemId, amount) {
        const save = CYOA.currentSave;
        if (!save || !npcId || !itemId) return false;
        if (!CYOA.canManageNpcEquipmentByAgreement?.(npcId)) return false;
        const npcKey = resolveNpcStorageKey(npcId);
        if (!npcKey) return false;
        if (!save.npcInventories || !Array.isArray(save.npcInventories[npcKey])) return false;
        if (!Array.isArray(save.inventory)) save.inventory = [];
        const qty = Math.max(1, Number(amount || 1));
        const nInv = save.npcInventories[npcKey];
        const nIdx = findInventoryIndexById(nInv, itemId);
        if (nIdx < 0) return false;
        const nItem = nInv[nIdx];
        const take = Math.min(qty, Number(nItem?.quantity || 1));
        if (take <= 0) return false;
        const pIdx = findInventoryIndexById(save.inventory, itemId);
        if (pIdx >= 0) save.inventory[pIdx].quantity = Number(save.inventory[pIdx].quantity || 1) + take;
        else save.inventory.push({ id: nItem.id, name: nItem.name || nItem.id, quantity: take, itemType: nItem.itemType || "common" });
        consumeInventoryItemById(nInv, itemId, take);
        persistSave();
        CYOA.renderInventoryPanel?.();
        return true;
    };

    CYOA.unequipNpcSlot = function(npcId, slot) {
        const save = CYOA.currentSave;
        if (!save || !npcId || !slot) return false;
        if (!CYOA.canManageNpcEquipmentByAgreement?.(npcId)) return false;
        const npcKey = resolveNpcStorageKey(npcId);
        if (!npcKey) return false;
        const eqMap = save.npcEquipment?.[npcKey];
        if (!eqMap || typeof eqMap !== "object") return false;
        const eq = eqMap[slot];
        if (!eq?.id) return false;
        if (Number(eq.lockLevel || 0) >= 2) return false;
        if (!save.npcInventories || typeof save.npcInventories !== "object") save.npcInventories = {};
        if (!Array.isArray(save.npcInventories[npcKey])) save.npcInventories[npcKey] = [];
        if (!save.npcInventories[npcKey].some(i => i.id === eq.id)) {
            save.npcInventories[npcKey].push({ id: eq.id, name: eq.name || eq.id, quantity: 1, itemType: "equipment" });
        }
        delete eqMap[slot];
        persistSave();
        return true;
    };

    function checkSlotDependency(targetSlot) {
        const save = CYOA.currentSave;
        const deps = CYOA.CONFIG?.SLOT_DEPENDENCY?.[targetSlot];
        if (!save?.equipment || !Array.isArray(deps) || deps.length === 0) {
            return { canStruggle: true, blocked: [] };
        }
        const blocked = deps.filter(depSlot => {
            const eq = save.equipment?.[depSlot];
            return !!(eq && (eq.id || typeof eq === "string"));
        });
        return { canStruggle: blocked.length === 0, blocked };
    }

    CYOA.jumpToNode = function(nodeId) {
        if (!CYOA.currentSave || !nodeId) return;
        // 切换分支时使在途请求失效，防止旧回包覆盖回放状态
        CYOA._gameMsgSeq = Number(CYOA._gameMsgSeq || 0) + 1;
        CYOA._sendingGameMsg = false;
        CYOA.repairCurrentSave?.();
        ensureStoryNodes(CYOA.currentSave, CYOA.currentGame);
        const node = CYOA.currentSave.nodes?.[nodeId];
        if (!node) return;
        CYOA.currentSave.currentNodeId = nodeId;
        applyNodeSnapshot(CYOA.currentSave, node.stateSnapshot);
        if (node.location) CYOA.currentSave.currentLocation = node.location;
        if (node.chapter) CYOA.currentSave.currentChapter = node.chapter;
        const scene = (CYOA.currentGame?.scenes || []).find(s => s.id === nodeId);
        if (scene?.location && !node.location) CYOA.currentSave.currentLocation = scene.location;
        if (scene?.chapterId && !node.chapter) CYOA.currentSave.currentChapter = scene.chapterId;
        rebuildHistoryFromNodePath(CYOA.currentSave, nodeId);
        CYOA.currentSave.activeSynergyIds = (CYOA.getActiveSynergies?.() || []).map(s => s.id).filter(Boolean);
        CYOA.currentNodeId = nodeId;
        persistSave();
        CYOA.renderGameLogFromNode?.(nodeId);
        CYOA.refreshOptionsFromCurrentNode?.();
        CYOA.resetGameInputState?.();
        CYOA.renderTreePanel?.();
        CYOA.renderSidebar?.();
    };

    CYOA.commitTurnNode = function(userText, aiText) {
        const save = CYOA.currentSave;
        const game = CYOA.currentGame;
        if (!save || !game) return null;
        ensureStoryNodes(save, game);

        const parentId = save.currentNodeId || "root";
        const nodeId = "node_" + CYOA.generateId();
        const summary = String(userText || "").split("\n")[0]?.slice(0, 60) || "继续";
        save.nodes[nodeId] = {
            id: nodeId,
            parentId,
            childrenIds: [],
            summary,
            userMessage: String(userText || ""),
            assistantMessage: String(aiText || ""),
            location: save.currentLocation || "",
            chapter: save.currentChapter || "",
            stateSnapshot: captureNodeSnapshot(save),
            createdAt: new Date().toISOString()
        };
        if (CYOA._pendingNodeChangeMeta) {
            if (!save.nodes[nodeId].meta || typeof save.nodes[nodeId].meta !== "object") save.nodes[nodeId].meta = {};
            save.nodes[nodeId].meta.changeParse = JSON.parse(JSON.stringify(CYOA._pendingNodeChangeMeta));
            CYOA._pendingNodeChangeMeta = null;
        }
        if (save.nodes[parentId]) {
            if (!Array.isArray(save.nodes[parentId].childrenIds)) save.nodes[parentId].childrenIds = [];
            save.nodes[parentId].childrenIds.push(nodeId);
        }
        save.currentNodeId = nodeId;
        CYOA.currentNodeId = nodeId;
        persistSave();
        CYOA.renderTreePanel?.();
        return nodeId;
    };

    CYOA.onRoleChange = function(role) {
        if (!CYOA.currentSave) return;
        CYOA.currentSave.playerCharacter = role || CYOA.currentSave.playerCharacter;
        persistSave();
    };

    CYOA.getSkillEffectMultiplier = function(level) {
        const minLv = Number(CYOA.CONFIG?.SKILL_MIN_LEVEL || 1);
        const lv = Math.max(minLv, Number(level || minLv));
        const scale = Number(CYOA.CONFIG?.SKILL_EFFECT_SCALE_PER_LEVEL || 0.15);
        return 1 + Math.max(0, lv - 1) * scale;
    };

    CYOA.getSkillCostMultiplier = function(level) {
        const minLv = Number(CYOA.CONFIG?.SKILL_MIN_LEVEL || 1);
        const lv = Math.max(minLv, Number(level || minLv));
        const reduce = Number(CYOA.CONFIG?.SKILL_COST_REDUCE_PER_LEVEL || 0.08);
        const floor = Number(CYOA.CONFIG?.SKILL_COST_FLOOR || 0.3);
        return Math.max(floor, 1 - Math.max(0, lv - 1) * reduce);
    };

    CYOA.getScaledConsumeCost = function(baseAmount, level) {
        const base = Math.max(0, Number(baseAmount || 0));
        const mult = CYOA.getSkillCostMultiplier(level);
        return Math.max(1, Math.round(base * mult));
    };

    CYOA.learnSkill = function(skillId, source) {
        const save = CYOA.currentSave;
        const game = CYOA.currentGame;
        if (!save || !game || !skillId) return false;
        if (!Array.isArray(save.skills)) save.skills = [];
        if (save.skills.some(s => s.id === skillId)) return false;

        const def = (game.skills || []).find(s => s.id === skillId);
        if (!def) return false;

        const minLv = Number(CYOA.CONFIG?.SKILL_MIN_LEVEL || 1);
        save.skills.push({
            id: def.id,
            name: def.name || def.id,
            skillType: def.skillType || "combat",
            unlockType: def.unlockType || "manual",
            description: def.description || "",
            effect: def.effect || "",
            requiredAttributes: def.requiredAttributes || {},
            consumeItems: Array.isArray(def.consumeItems) ? JSON.parse(JSON.stringify(def.consumeItems)) : [],
            level: Math.max(minLv, Number(def.level || minLv)),
            proficiency: 0,
            learned: true
        });
        CYOA.addKeyEvent?.("skill_learn", `习得技能：${def.name || def.id}${source ? `（${source}）` : ""}`);
        persistSave();
        return true;
    };

    CYOA.gainSkillProficiency = function(skillId, amount, reason) {
        const save = CYOA.currentSave;
        if (!save || !Array.isArray(save.skills) || !skillId) return false;
        const skill = save.skills.find(s => s.id === skillId || s.name === skillId);
        if (!skill) return false;

        const add = Math.max(0, Number(amount || 0));
        if (!add) return false;
        const perLv = Number(CYOA.CONFIG?.SKILL_PROFICIENCY_PER_LEVEL || 100);
        const maxLv = Number(CYOA.CONFIG?.SKILL_MAX_LEVEL || 9);
        const minLv = Number(CYOA.CONFIG?.SKILL_MIN_LEVEL || 1);

        skill.level = Math.max(minLv, Number(skill.level || minLv));
        skill.proficiency = Math.max(0, Number(skill.proficiency || 0) + add);

        let leveled = false;
        while (skill.level < maxLv && skill.proficiency >= perLv) {
            skill.proficiency -= perLv;
            skill.level += 1;
            leveled = true;
        }
        if (skill.level >= maxLv) skill.proficiency = Math.min(skill.proficiency, perLv);
        if (leveled) CYOA.addKeyEvent?.("skill_levelup", `技能升级：${skill.name} -> LV${skill.level}`);
        if (reason) CYOA.addKeyEvent?.("skill_progress", `熟练度提升：${skill.name} +${add}`);
        persistSave();
        return true;
    };

    CYOA.progressSkillsFromInput = function(text) {
        const save = CYOA.currentSave;
        if (!save || !Array.isArray(save.skills)) return;
        const raw = String(text || "").trim();
        if (!raw) return;
        save.skills.forEach(skill => {
            const name = String(skill.name || "");
            const id = String(skill.id || "");
            if ((name && raw.includes(name)) || (id && raw.includes(id))) {
                CYOA.gainSkillProficiency(skill.id, 8, "input");
            }
        });
    };

    // ===== 兼容旧 API（对外别名）=====
    CYOA.addSkillProficiency = function(skillId, amount) {
        return CYOA.gainSkillProficiency?.(skillId, amount, "legacy_api") || false;
    };

    CYOA.addSkillProficiencyByName = function(skillName, amount) {
        const save = CYOA.currentSave;
        if (!save || !Array.isArray(save.skills) || !skillName) return false;
        const skill = save.skills.find(s => s.name === skillName || s.id === skillName);
        if (!skill) return false;
        return CYOA.gainSkillProficiency?.(skill.id, amount, "legacy_api") || false;
    };

    CYOA.getSkillLevel = function(skillId) {
        const save = CYOA.currentSave;
        const minLv = Number(CYOA.CONFIG?.SKILL_MIN_LEVEL || 1);
        if (!save || !Array.isArray(save.skills) || !skillId) return 0;
        const skill = save.skills.find(s => s.id === skillId || s.name === skillId);
        return skill ? Math.max(minLv, Number(skill.level || minLv)) : 0;
    };

    CYOA.getSkillLevelLabel = function(level) {
        const labels = CYOA.CONFIG?.SKILL_LEVEL_LABELS || {};
        return labels[level] || "";
    };

    CYOA.getScaledEffectText = function(baseEffect, level) {
        const text = String(baseEffect || "");
        if (!text) return "";
        const mult = CYOA.getSkillEffectMultiplier?.(level) || 1;
        if (mult === 1) return text;
        return `${text} (×${mult.toFixed(2)})`;
    };

    function findInventoryIndexById(inv, itemId) {
        if (!Array.isArray(inv) || !itemId) return -1;
        return inv.findIndex(i => i?.id === itemId);
    }

    function consumeInventoryItemById(inv, itemId, amount) {
        const need = Math.max(1, Number(amount || 1));
        const idx = findInventoryIndexById(inv, itemId);
        if (idx < 0) return false;
        const it = inv[idx];
        const qty = Number(it?.quantity || 1);
        if (qty > need) {
            it.quantity = qty - need;
        } else {
            inv.splice(idx, 1);
        }
        return true;
    }

    function shouldConsumeUnlockItem(unlockItemId, game, inventory) {
        if (!unlockItemId) return false;
        const fromGame = (game?.items || []).find(i => i?.id === unlockItemId);
        const itemType = String(fromGame?.itemType || "").toLowerCase();
        if (itemType === "consumable" || itemType === "healing" || itemType === "fuel") return true;
        const fromBag = Array.isArray(inventory) ? inventory.find(i => i?.id === unlockItemId) : null;
        const bagType = String(fromBag?.itemType || "").toLowerCase();
        return bagType === "consumable" || bagType === "healing" || bagType === "fuel";
    }

    CYOA.unlockEquipment = function(slot, options) {
        const save = CYOA.currentSave;
        const game = CYOA.currentGame;
        const opt = options && typeof options === "object" ? options : {};
        const silent = !!opt.silent;
        if (!save?.equipment || !slot) return false;
        if ((CYOA.getActiveConstraints?.() || new Set()).has("no_hands")) {
            if (!silent) alert("当前双手受限，无法直接解锁装备。");
            return false;
        }
        if (!canOperateEquipmentByAgreement("unequip")) return false;
        const eq = save.equipment[slot];
        if (!eq?.id) return false;

        const lockLv = Number(eq.lockLevel || 0);
        if (lockLv <= 0) return true;
        if (lockLv >= 5) {
            if (!silent) alert("该装备为高等级锁定，无法直接解锁。");
            return false;
        }
        if (lockLv === 1) {
            const before = Number(eq.lockLevel || 0);
            CYOA.handleStruggle?.(slot);
            const afterEq = save.equipment?.[slot];
            if (!afterEq?.id) return true;
            const after = Number(afterEq.lockLevel || 0);
            if (after >= before) {
                if (!silent) alert("挣扎未成功，当前无法完成解锁。");
                return false;
            }
            if (!silent) CYOA.appendSystemMessage?.("✅ 轻度束缚已松动，可尝试卸下。");
            persistSave();
            CYOA.renderInventoryPanel?.();
            CYOA.renderAttributesPanel?.();
            return true;
        }

        const def = (game?.equipment || []).find(e => e.id === eq.id);
        const unlockId = eq.unlockItemId || def?.unlockItemId || "";
        if (!unlockId) {
            if (!silent) alert("该装备未配置解锁道具，无法完成解锁。");
            return false;
        }
        if (!Array.isArray(save.inventory)) save.inventory = [];
        const keyIdx = findInventoryIndexById(save.inventory, unlockId);
        if (keyIdx < 0) {
            if (!silent) {
                const keyDef = (game?.items || []).find(i => i.id === unlockId);
                alert(`缺少解锁道具：${keyDef?.name || unlockId}`);
            }
            return false;
        }

        const consumeOnUnlock = shouldConsumeUnlockItem(unlockId, game, save.inventory);
        if (consumeOnUnlock) {
            consumeInventoryItemById(save.inventory, unlockId, 1);
        }
        eq.lockLevel = 0;
        CYOA.addKeyEvent?.("unlock", `解锁：${eq.name || eq.id}${consumeOnUnlock ? "（消耗道具）" : ""}`);
        if (!silent) CYOA.appendSystemMessage?.(`🔓 ${eq.name || eq.id} 已解锁`);
        persistSave();
        CYOA.renderInventoryPanel?.();
        CYOA.renderAttributesPanel?.();
        return true;
    };

    CYOA.equipItem = function(index) {
        const save = CYOA.currentSave;
        const game = CYOA.currentGame;
        if (!save || !game || !Array.isArray(save.inventory)) return false;
        if ((CYOA.getActiveConstraints?.() || new Set()).has("no_hands")) {
            alert("当前双手受限，无法直接穿戴装备。");
            return false;
        }
        if (!canOperateEquipmentByAgreement("equip")) return false;
        const item = save.inventory[index];
        if (!item) return false;
        const def = (game.equipment || []).find(e => e.id === item.id);
        if (!def) return false;
        // 穿戴阶段不再强制钥匙；钥匙只在“解锁/卸下锁定装备”时使用
        const compat = CYOA.checkEquipCompatibility(def, save);
        if (compat.length) {
            const c = compat[0] || {};
            if (c.code === "layer_immutable") {
                alert("LV0 皮肤层装备不可移除，无法被替换。");
            } else if (c.code === "slot_locked") {
                alert("当前部位存在锁定装备，请先解锁后再替换。");
            } else if (c.code === "blocked_by_outer_layer") {
                alert("存在更外层装备，需先卸下外层再穿戴内层。");
            } else if (c.code === "hands_blocked") {
                alert("当前姿态/束缚导致该部位不可直接操作。");
            } else {
                alert((c.message || "装备条件不满足") + (compat.length > 1 ? `（另有 ${compat.length - 1} 项冲突）` : ""));
            }
            return false;
        }

        const slots = Array.isArray(def.slots) ? def.slots : [];
        if (!save.equipment || typeof save.equipment !== "object") save.equipment = {};

        // 若目标槽已有装备，先退回背包（去重）
        slots.forEach(slot => {
            const old = save.equipment[slot];
            if (old?.id && !save.inventory.some(i => i.id === old.id)) {
                save.inventory.push({ id: old.id, name: old.name || old.id, quantity: 1, itemType: "equipment" });
            }
            save.equipment[slot] = {
                id: def.id,
                name: def.name || def.id,
                layer: getEquipLayerValue(item, def),
                narrativeRole: String(def.narrativeRole || "auto"),
                armorHardness: Number(def.armorHardness || 0),
                armorProtection: Number(def.armorProtection || 0),
                armorWeight: Number(def.armorWeight || 0),
                armorMobilityPenalty: Number(def.armorMobilityPenalty || 0),
                unlockItemId: def.unlockItemId || "",
                lockLevel: Number(def.lockLevel || 0),
                attachments: Array.isArray(def.attachments) ? JSON.parse(JSON.stringify(def.attachments)) : []
            };
        });

        // 从背包移除该件
        save.inventory.splice(index, 1);
        if (def.statModifiers && typeof CYOA.parseStatModifiers === "function" && typeof CYOA.applyStatModifiers === "function") {
            const mods = CYOA.parseStatModifiers(def.statModifiers);
            CYOA.applyStatModifiers(mods, true);
        }
        CYOA.resolveCompoundPosture?.();
        CYOA.addKeyEvent?.("equip", `穿戴：${def.name || def.id}`);
        CYOA.tryProgressChapter?.();
        persistSave();
        CYOA.renderInventoryPanel?.();
        CYOA.renderAttributesPanel?.();
        return true;
    };

    // 兼容旧内部 API 名称
    CYOA._equipItemImpl = function(itemIndex) {
        return CYOA.equipItem?.(itemIndex);
    };
    CYOA._equipItemSafe = function(itemIndex) {
        try {
            return CYOA.equipItem?.(itemIndex);
        } catch (_) {
            return false;
        }
    };

    CYOA.unequipItem = function(slot) {
        const save = CYOA.currentSave;
        const game = CYOA.currentGame;
        if (!save?.equipment || !slot) return false;
        if ((CYOA.getActiveConstraints?.() || new Set()).has("no_hands")) {
            alert("当前双手受限，无法直接卸下装备。");
            return false;
        }
        if (!canOperateEquipmentByAgreement("unequip")) return false;
        const eq = save.equipment[slot];
        if (!eq?.id) return false;
        const def = (game?.equipment || []).find(e => e.id === eq.id);
        const layer = getEquipLayerValue(eq, def);
        if (layer === 0) {
            alert("LV0 皮肤层装备不可移除。");
            return false;
        }
        const lockLv = Number(eq.lockLevel || 0);
        if (lockLv >= 5) {
            alert("该装备为高等级锁定，无法直接卸下。");
            return false;
        }
        if (lockLv >= 2) {
            const ok = CYOA.unlockEquipment?.(slot, { silent: true, autoFromUnequip: true });
            if (!ok) {
                alert(`该装备锁定等级较高（LV${lockLv}），需要先解锁。`);
                return false;
            }
        }
        if (lockLv === 1) {
            const before = Number(eq.lockLevel || 0);
            CYOA.handleStruggle?.(slot);
            const afterEq = save.equipment?.[slot];
            if (afterEq?.id) {
                const after = Number(afterEq.lockLevel || 0);
                if (after >= before) {
                    alert("挣扎未成功，当前无法卸下该装备。");
                    return false;
                }
            } else {
                // 挣扎中已断裂/移除，本次卸下流程视为完成
                CYOA.renderAttributesPanel?.();
                return true;
            }
        }
        const depCheck = checkSlotDependency(slot);
        const bypassSlots = Array.isArray(CYOA.CONFIG?.TOOL_BYPASS_SLOTS) ? CYOA.CONFIG.TOOL_BYPASS_SLOTS : [];
        if (!depCheck.canStruggle && !bypassSlots.includes(slot)) {
            alert("当前姿态/束缚导致该部位不可直接操作。");
            return false;
        }
        if (!Array.isArray(save.inventory)) save.inventory = [];
        if (!save.inventory.some(i => i.id === eq.id)) {
            save.inventory.push({ id: eq.id, name: eq.name || eq.id, quantity: 1, itemType: "equipment" });
        }
        const removedConstraints = new Set(Array.isArray(eq.constraints) ? eq.constraints : (Array.isArray(def?.constraints) ? def.constraints : []));
        if (def?.statModifiers && typeof CYOA.parseStatModifiers === "function" && typeof CYOA.applyStatModifiers === "function") {
            const mods = CYOA.parseStatModifiers(def.statModifiers);
            CYOA.applyStatModifiers(mods, false);
        }
        // 清理占用同 id 的槽位
        Object.keys(save.equipment).forEach(k => {
            if (save.equipment[k]?.id === eq.id) delete save.equipment[k];
        });
        removedConstraints.forEach(c => CYOA.triggerWithdrawal?.(c));
        CYOA.resolveCompoundPosture?.();
        CYOA.addKeyEvent?.("unequip", `卸下：${eq.name || eq.id}`);
        persistSave();
        CYOA.renderInventoryPanel?.();
        CYOA.renderAttributesPanel?.();
        return true;
    };

    CYOA._unequipItemImpl = function(slot) {
        return CYOA.unequipItem?.(slot);
    };

    CYOA.useConsumable = function(index) {
        const save = CYOA.currentSave;
        if (!save || !Array.isArray(save.inventory)) return false;
        if ((CYOA.getActiveConstraints?.() || new Set()).has("no_hands")) {
            alert("当前双手受限，无法直接使用消耗品。");
            return false;
        }
        const item = save.inventory[index];
        if (!item) return false;
        const qty = Number(item.quantity || 1);
        if (qty <= 0) return false;
        const allowed = new Set(["consumable", "fuel", "healing"]);
        if (item.itemType && !allowed.has(String(item.itemType))) {
            alert("该物品不可直接使用。");
            return false;
        }

        // 简易效果：healing/fuel/consumable 统一按 statModifiers 解析；没有则仅消耗
        if (item.statModifiers && typeof CYOA.applyStatModifiers === "function") {
            const mods = typeof CYOA.parseStatModifiers === "function" ? CYOA.parseStatModifiers(item.statModifiers) : {};
            CYOA.applyStatModifiers(mods, true);
        }
        if (item.itemType === "healing" && Array.isArray(save.attributes)) {
            save.attributes.forEach(a => {
                if (typeof a.value === "number" && typeof a.max === "number") a.value = Math.min(a.max, a.value + 5);
            });
        }

        let exhausted = false;
        if (typeof item.quantity === "number" && item.quantity > 1) {
            item.quantity = qty - 1;
        } else if (typeof item.durability === "number" && item.durability > 1) {
            item.durability -= 1;
        } else {
            save.inventory.splice(index, 1);
            exhausted = true;
        }
        CYOA.appendSystemMessage?.(`已使用：${item.name || item.id}（效果：${item.statModifiers || "无"}）`);
        if (exhausted) {
            CYOA.appendSystemMessage?.(`❌ ${item.name || item.id} 已耗尽`);
        }
        CYOA.addKeyEvent?.("consume", `使用：${item.name || item.id}`);
        CYOA.tryProgressChapter?.();
        persistSave();
        CYOA.renderInventoryPanel?.();
        CYOA.renderAttributesPanel?.();
        return true;
    };

    CYOA.acquireItem = function(nameOrId, amount) {
        const save = CYOA.currentSave;
        const game = CYOA.currentGame;
        if (!save || !game || !nameOrId) return false;
        if (!Array.isArray(save.inventory)) save.inventory = [];
        const qty = Math.max(1, Number(amount || 1));
        const maxQty = Number(CYOA.CONFIG?.ITEM_MAX_QUANTITY || 99);
        const def = (game.items || []).find(i => i.id === nameOrId || i.name === nameOrId)
            || (game.equipment || []).find(i => i.id === nameOrId || i.name === nameOrId);
        if (!def) return false;

        const itemId = def.id || String(nameOrId);
        const existed = save.inventory.find(i => i.id === itemId || i.name === def.name);
        if (existed) {
            existed.quantity = Math.min(maxQty, Number(existed.quantity || 1) + qty);
        } else {
            save.inventory.push({
                id: itemId,
                name: def.name || itemId,
                quantity: Math.min(maxQty, qty),
                itemType: def.itemType || (def.slots ? "equipment" : "common"),
                description: def.description || ""
            });
        }
        if (!Array.isArray(save.acquiredItemIds)) save.acquiredItemIds = [];
        if (!save.acquiredItemIds.includes(itemId)) save.acquiredItemIds.push(itemId);
        CYOA.appendSystemMessage?.(`📦 获得物品：${def.name || itemId}${qty > 1 ? ` ×${qty}` : ""}`);
        persistSave();
        CYOA.renderInventoryPanel?.();
        return true;
    };

    CYOA.removeItem = function(nameOrId, amount) {
        const save = CYOA.currentSave;
        if (!save || !Array.isArray(save.inventory) || !nameOrId) return false;
        const qty = Math.max(1, Number(amount || 1));
        const idx = save.inventory.findIndex(i => i.id === nameOrId || i.name === nameOrId);
        if (idx < 0) return false;
        const cur = Number(save.inventory[idx].quantity || 1);
        const itemName = save.inventory[idx].name || save.inventory[idx].id || String(nameOrId);
        if (cur > qty) {
            save.inventory[idx].quantity = cur - qty;
        } else {
            save.inventory.splice(idx, 1);
            CYOA.appendSystemMessage?.(`❌ ${itemName} 已耗尽`);
        }
        persistSave();
        CYOA.renderInventoryPanel?.();
        return true;
    };

    CYOA.appendSystemMessage = function(message) {
        const text = String(message || "").trim();
        if (!text) return;
        CYOA.appendGameBubble?.("assistant", `📌 ${text}`);
    };

    CYOA.extractOptions = function(text) {
        const lines = String(text || "").split("\n").map(s => s.trim()).filter(Boolean);
        const out = [];
        lines.forEach(line => {
            if (!/^[🔹◆\-\*（(]/.test(line)) return;
            const m = line.match(/(?:^\(?(?:行动|Action)\)?[:：\s]*)|(?:^\(?(?:对话|Dialogue)\)?[:：\s]*)/i);
            const cleaned = line.replace(/^[🔹◆\-\*]\s*/, "").replace(/^\((行动|对话|Action|Dialogue)\)\s*/i, "").trim();
            if (!cleaned) return;
            const isSpeech = /对话|Dialogue/i.test(m?.[0] || line);
            out.push({ type: isSpeech ? "speech" : "action", text: cleaned });
        });
        return out.slice(0, 8);
    };

    CYOA.renameSave = function(newNameArg) {
        const save = CYOA.currentSave;
        if (!save) return false;
        const fromInput = document.getElementById("saveNameInput")?.value;
        const nextName = String(newNameArg || fromInput || "").trim();
        if (!nextName) return false;
        save.name = nextName;
        persistSave();
        CYOA.renderSavesPanel?.();
        return true;
    };

    CYOA.applyOutfitPreset = function(presetIdOrName) {
        const save = CYOA.currentSave;
        const game = CYOA.currentGame;
        if (!save || !game || !presetIdOrName) return { ok: false, reason: "missing_context" };
        const presets = Array.isArray(game.outfitPresets) ? game.outfitPresets : [];
        const preset = presets.find(p => p.id === presetIdOrName || p.name === presetIdOrName);
        if (!preset) return { ok: false, reason: "preset_not_found" };
        if (preset.chapter && save.currentChapter && preset.chapter !== save.currentChapter) {
            return { ok: false, reason: "chapter_mismatch" };
        }

        if (!save.equipment || typeof save.equipment !== "object") save.equipment = {};
        if (!Array.isArray(save.inventory)) save.inventory = [];
        const equippedIds = new Set();
        const skipped = [];
        const itemIds = Array.isArray(preset.items) ? preset.items : [];

        itemIds.forEach(eid => {
            const def = (game.equipment || []).find(e => e.id === eid);
            if (!def) {
                skipped.push({ id: eid, reason: "definition_missing" });
                return;
            }
            const compat = CYOA.checkEquipCompatibility?.(def, save) || [];
            if (compat.length) {
                skipped.push({ id: eid, reason: compat[0]?.code || "compat_failed" });
                return;
            }
            const slots = Array.isArray(def.slots) ? def.slots : [];
            slots.forEach(slot => {
                const old = save.equipment[slot];
                if (old?.id && !save.inventory.some(i => i.id === old.id)) {
                    save.inventory.push({ id: old.id, name: old.name || old.id, quantity: 1, itemType: "equipment" });
                }
                save.equipment[slot] = {
                    id: def.id,
                    name: def.name || def.id,
                    lockLevel: Number(def.lockLevel || 0),
                    attachments: Array.isArray(def.attachments) ? JSON.parse(JSON.stringify(def.attachments)) : []
                };
            });
            equippedIds.add(def.id);
        });

        if (equippedIds.size) {
            CYOA.addKeyEvent?.("equip_preset", `应用预设：${preset.name || preset.id}`);
            CYOA.tryProgressChapter?.();
            persistSave();
            CYOA.renderInventoryPanel?.();
        }
        return { ok: equippedIds.size > 0, presetId: preset.id, equipped: Array.from(equippedIds), skipped };
    };

    function pickNarrative(key) {
        const pool = CYOA.CONFIG?.STRUGGLE_NARRATIVES?.[key];
        if (!Array.isArray(pool) || !pool.length) return "";
        return pool[Math.floor(Math.random() * pool.length)] || "";
    }

    function getNumericAttribute(save, keys) {
        if (!save) return 0;
        const wanted = Array.isArray(keys) ? keys : [keys];
        if (Array.isArray(save.attributes)) {
            for (const k of wanted) {
                const hit = save.attributes.find(a => a?.id === k || a?.name === k);
                if (hit && Number.isFinite(Number(hit.value))) return Number(hit.value);
            }
        } else if (save.attributes && typeof save.attributes === "object") {
            for (const k of wanted) {
                if (Number.isFinite(Number(save.attributes[k]))) return Number(save.attributes[k]);
            }
        }
        return 0;
    }

    // 兼容旧 API：返回轻量挣扎结果对象
    CYOA.attemptStruggle = function(slot) {
        const save = CYOA.currentSave;
        const before = save?.equipment?.[slot];
        if (!before?.id) return { success: false, broken: false, narrative: "该部位没有装备。" };
        const beforeLock = Number(before.lockLevel || 0);
        CYOA.handleStruggle?.(slot);
        const after = save?.equipment?.[slot];
        if (!after?.id) return { success: true, broken: true, narrative: "装备已在挣扎中移除或断裂。" };
        const afterLock = Number(after.lockLevel || 0);
        return {
            success: afterLock < beforeLock,
            broken: false,
            narrative: afterLock < beforeLock ? "挣扎成功，锁定降低。" : "挣扎失败，锁定未变化。",
            lockLevelBefore: beforeLock,
            lockLevelAfter: afterLock
        };
    };

    CYOA.handleStruggle = function(slot) {
        const save = CYOA.currentSave;
        const game = CYOA.currentGame;
        if (!save?.equipment || !slot) return;
        const eq = save.equipment[slot];
        if (!eq?.id) return;
        const def = (game?.equipment || []).find(e => e.id === eq.id) || eq;
        const cur = Number(CYOA.getEquipLockLevel?.(eq, def) || 0);
        if (cur <= 0) return;

        if (cur >= 5) {
            const msg = pickNarrative("permanent_lock") || "该装备已永久锁死，无法挣扎解除。";
            CYOA.addKeyEvent?.("struggle", `挣扎失败：${eq.name || eq.id}（永久锁死）`);
            CYOA.appendGameBubble?.("assistant", msg);
            persistSave();
            return;
        }

        const cfg = CYOA.CONFIG?.STRUGGLE_CONFIG || {};
        const baseRate = Number(cfg.baseSuccessRate ?? 0.3);
        const lockPenalty = Number(cfg.lockLevelMultiplier ?? 0.18) * cur;
        const activeConstraints = CYOA.getActiveConstraints?.() || new Set();
        const bypassSlots = Array.isArray(CYOA.CONFIG?.TOOL_BYPASS_SLOTS) ? CYOA.CONFIG.TOOL_BYPASS_SLOTS : [];
        const depCheck = checkSlotDependency(slot);
        if (!depCheck.canStruggle && !bypassSlots.includes(slot)) {
            const msg = pickNarrative("blocked_by_hands") || "当前结构限制导致该部位无法直接挣扎。";
            CYOA.addKeyEvent?.("struggle", `挣扎受阻：${eq.name || eq.id}（部位依赖限制）`);
            CYOA.appendGameBubble?.("assistant", msg);
            persistSave();
            return;
        }
        if (activeConstraints.has("no_hands") && !bypassSlots.includes(slot)) {
            const msg = pickNarrative("blocked_by_hands") || "双手受限，无法对该部位进行有效挣扎。";
            CYOA.addKeyEvent?.("struggle", `挣扎受阻：${eq.name || eq.id}（双手受限）`);
            CYOA.appendGameBubble?.("assistant", msg);
            CYOA.bumpObserverAlert?.("struggle");
            persistSave();
            return;
        }
        const handPenalty = activeConstraints.has("no_hands")
            ? 0.45
            : (activeConstraints.has("no_fingers") ? Number(cfg.handBoundPenalty ?? 0.6) * 0.5 : 0);
        const str = getNumericAttribute(save, ["strength", "力量", "体能", "str"]);
        const dex = getNumericAttribute(save, ["agility", "灵巧", "dexterity", "dex"]);
        const statBonus = Math.min(0.25, Math.max(-0.1, (str + dex - 100) / 400));
        const mat = String(def?.material || "leather").toLowerCase();
        const matMod = cfg.materialModifiers?.[mat] || cfg.materialModifiers?.leather || { resistMult: 1, duraDmgMult: 1 };
        const resistPenalty = (Number(matMod.resistMult || 1) - 1) * 0.2;

        let successRate = baseRate + statBonus - lockPenalty - handPenalty - resistPenalty;
        if (mat === "latex") {
            const atts = Array.isArray(eq.attachments) ? eq.attachments : (Array.isArray(def?.attachments) ? def.attachments : []);
            const hasLiquid = atts.some(a => {
                if (a?.type !== "latex_layer") return false;
                const thick = String(a?.latexThickness || "");
                const tDef = (CYOA.CONFIG?.LATEX_THICKNESS || []).find(t => t.value === thick);
                return !!tDef?.isLiquid;
            });
            if (hasLiquid) {
                const llCfg = CYOA.CONFIG?.LIQUID_LATEX_CONFIG || {};
                const resistMult = Number(llCfg.struggleResistMult || 0.1);
                successRate *= Math.max(0.01, resistMult);
            }
            const sweatTier = CYOA.getLatexSweatTier?.();
            if (sweatTier?.value && sweatTier.value !== "dry") {
                const swCfg = CYOA.CONFIG?.LATEX_SWEAT_CONFIG || {};
                const tiers = Array.isArray(CYOA.CONFIG?.LATEX_SWEAT_TIERS) ? CYOA.CONFIG.LATEX_SWEAT_TIERS : [];
                const idx = Math.max(0, tiers.findIndex(t => t.value === sweatTier.value));
                successRate *= 1 + Number(swCfg.struggleSlipBonus || 0.08) * idx;
            }
        }
        if (Number(save.panic || 0) > 40) {
            const pCfg = CYOA.CONFIG?.PANIC_CONFIG || {};
            successRate *= 1 + Number(pCfg.panicStruggleBonus || 0.2);
        }
        successRate = Math.max(0.02, Math.min(0.9, successRate));
        const success = Math.random() < successRate;

        const baseDmg = Number(cfg.baseDurabilityDamage ?? 5);
        const dmg = Math.max(1, Math.round(baseDmg * Number(matMod.duraDmgMult || 1) * (1 + cur * 0.1)));
        const currentDura = Number(eq.durability ?? def?.durability ?? 0);
        if (currentDura > 0) eq.durability = Math.max(0, currentDura - dmg);

        let removedBySuccess = false;
        let brokenByDurability = false;
        if (currentDura > 0 && Number(eq.durability || 0) <= 0) {
            brokenByDurability = true;
            Object.keys(save.equipment).forEach(k => {
                if (save.equipment[k]?.id === eq.id) delete save.equipment[k];
            });
            if (def?.statModifiers && typeof CYOA.parseStatModifiers === "function" && typeof CYOA.applyStatModifiers === "function") {
                const mods = CYOA.parseStatModifiers(def.statModifiers);
                CYOA.applyStatModifiers(mods, false);
            }
            CYOA.resolveCompoundPosture?.();
            CYOA.addKeyEvent?.("struggle", `约束破坏：${eq.name || eq.id}`);
            CYOA.appendSystemMessage?.(`💔 ${eq.name || eq.id} 损坏了`);
            CYOA.appendGameBubble?.("assistant", pickNarrative("broken") || `${eq.name || eq.id} 在挣扎中断裂。`);
        } else if (success && cur <= 1) {
            removedBySuccess = true;
            Object.keys(save.equipment).forEach(k => {
                if (save.equipment[k]?.id === eq.id) delete save.equipment[k];
            });
            if (!Array.isArray(save.inventory)) save.inventory = [];
            if (!save.inventory.some(i => i.id === eq.id)) {
                save.inventory.push({ id: eq.id, name: eq.name || eq.id, quantity: 1, itemType: "equipment" });
            }
            if (def?.statModifiers && typeof CYOA.parseStatModifiers === "function" && typeof CYOA.applyStatModifiers === "function") {
                const mods = CYOA.parseStatModifiers(def.statModifiers);
                CYOA.applyStatModifiers(mods, false);
            }
            CYOA.resolveCompoundPosture?.();
            CYOA.addKeyEvent?.("struggle", `挣扎成功脱离：${eq.name || eq.id}`);
            CYOA.appendGameBubble?.("assistant", pickNarrative("success") || `你成功挣脱了 ${eq.name || eq.id}。`);
        } else if (success) {
            eq.lockLevel = Math.max(0, cur - 1);
            CYOA.addKeyEvent?.("struggle", `挣扎成功：${eq.name || eq.id} 锁定降为 ${eq.lockLevel}`);
            CYOA.appendGameBubble?.("assistant", pickNarrative("success") || `你成功让 ${eq.name || eq.id} 的锁定降低了。`);
        } else {
            CYOA.addKeyEvent?.("struggle", `挣扎失败：${eq.name || eq.id}`);
            CYOA.appendGameBubble?.("assistant", pickNarrative("fail") || "你的挣扎暂时没有效果。");
        }
        CYOA.bumpObserverAlert?.("struggle");

        // 耐久损耗触发阶段反馈
        if (!removedBySuccess && !brokenByDurability && Number(eq.durability || 0) > 0 && Number(eq.durability || 0) <= Math.max(5, Math.floor((def?.durability || 20) * 0.25))) {
            CYOA.appendGameBubble?.("assistant", pickNarrative("degrade") || "约束出现了明显磨损。");
        }

        CYOA.tryProgressChapter?.();
        persistSave();
        CYOA.renderInventoryPanel?.();
        CYOA.renderAttributesPanel?.();
    };

    CYOA.saveCurrentSave = function() {
        if (!CYOA.currentSave) return;
        CYOA.currentSave.updatedAt = new Date().toISOString();
        if (!CYOA.currentSave.createdAt) CYOA.currentSave.createdAt = CYOA.currentSave.updatedAt;
        persistSave();
        CYOA.renderSavesPanel?.();
    };

    CYOA.saveAsNewSave = function() {
        if (!CYOA.currentSave) return;
        const clone = JSON.parse(JSON.stringify(CYOA.currentSave));
        clone.id = "save_" + CYOA.generateId();
        clone.createdAt = new Date().toISOString();
        clone.updatedAt = clone.createdAt;
        clone.name = (clone.name || "存档") + " (副本)";
        if (!CYOA.saves) CYOA.saves = {};
        CYOA.saves[clone.id] = clone;
        CYOA.currentSave = clone;
        enforceSaveLimitForGame(clone.gameId, clone.id);
        persistSave();
        CYOA.renderSavesPanel?.();
    };

    CYOA.exportSave = function() {
        if (!CYOA.currentSave) return;
        const blob = new Blob([JSON.stringify(CYOA.currentSave, null, 2)], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `cyoa_save_${CYOA.currentSave.id}.json`;
        a.click();
    };

    CYOA.importSave = function() {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".json";
        input.onchange = function(e) {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function(ev) {
                try {
                    const parsed = JSON.parse(ev.target.result);
                    const save = normalizeSaveShape(parsed, CYOA.currentGame);
                    if (!save || !save.gameId) throw new Error("invalid save");
                    if (!save.id || CYOA.saves?.[save.id]) save.id = "save_" + CYOA.generateId();
                    if (!CYOA.saves) CYOA.saves = {};
                    CYOA.saves[save.id] = save;
                    CYOA.currentSave = save;
                    enforceSaveLimitForGame(save.gameId, save.id);
                    persistSave();
                    CYOA.renderSavesPanel?.();
                } catch (_) {
                    alert("存档导入失败");
                }
            };
            reader.readAsText(file);
        };
        input.click();
    };

    CYOA.loadSave = function(saveId) {
        if (!CYOA.saves?.[saveId]) return;
        const save = normalizeSaveShape(CYOA.saves[saveId], CYOA.currentGame);
        if (save.gameId !== CYOA.currentGame?.id) {
            alert(t("ui.msg.saveMismatch") || "存档与当前游戏不匹配");
            return;
        }
        CYOA._gameMsgSeq = Number(CYOA._gameMsgSeq || 0) + 1;
        CYOA._sendingGameMsg = false;
        ensureStoryNodes(save, CYOA.currentGame);
        ensureKnownLocations(save);
        CYOA.saves[save.id] = save;
        CYOA.currentSave = save;
        CYOA.repairCurrentSave?.();
        CYOA.applyAgreementEnforcement?.({ silent: true, source: "load" });
        CYOA.currentNodeId = save.currentNodeId || null;
        CYOA.currentSave.activeSynergyIds = (CYOA.getActiveSynergies?.() || []).map(s => s.id).filter(Boolean);
        CYOA.renderGameLogFromNode?.(CYOA.currentSave.currentNodeId || "root");
        CYOA.refreshOptionsFromCurrentNode?.();
        CYOA.resetGameInputState?.();
        CYOA.renderTreePanel?.();
        CYOA.renderSidebar?.();
        CYOA._bindInputKeyHandler?.();
    };

    CYOA.deleteSave = function(saveId) {
        if (!CYOA.saves?.[saveId]) return;
        if (!confirm(t("ui.msg.confirmDeleteSave") || "确认删除存档？")) return;
        delete CYOA.saves[saveId];
        if (CYOA.DataManager) {
            CYOA.DataManager.saves = CYOA.saves;
            CYOA.DataManager.saveSaves?.();
        }
        CYOA.renderSavesPanel?.();
    };

    CYOA.runRuntimeSelfCheck = function() {
        const game = CYOA.currentGame;
        const save = CYOA.currentSave;
        const report = {
            ok: true,
            checks: []
        };
        function add(name, pass, detail) {
            report.checks.push({ name, pass, detail: detail || "" });
            if (!pass) report.ok = false;
        }

        add("game_loaded", !!game, game ? game.id || game.name : "missing");
        add("save_loaded", !!save, save ? save.id : "missing");
        if (!game || !save) return report;

        add("node_tree_present", !!save.nodes && typeof save.nodes === "object", `nodes=${Object.keys(save.nodes || {}).length}`);
        add("current_node_exists", !!save.currentNodeId && !!save.nodes?.[save.currentNodeId], save.currentNodeId || "none");
        add("history_array", Array.isArray(save.history), `len=${Array.isArray(save.history) ? save.history.length : -1}`);
        add("inventory_array", Array.isArray(save.inventory), `len=${Array.isArray(save.inventory) ? save.inventory.length : -1}`);
        add("skills_array", Array.isArray(save.skills), `len=${Array.isArray(save.skills) ? save.skills.length : -1}`);
        add("equipment_object", !!save.equipment && typeof save.equipment === "object" && !Array.isArray(save.equipment), `slots=${Object.keys(save.equipment || {}).length}`);
        add("observer_metrics", Number.isFinite(Number(save.observerAlert)) && Number.isFinite(Number(save.observerInterventionCooldown)), `${save.observerAlert}/${save.observerInterventionCooldown}`);
        add("chapter_linked", !save.currentChapter || (game.chapters || []).some(ch => ch.id === save.currentChapter), save.currentChapter || "none");
        add("location_linked", !save.currentLocation || (game.locations || []).some(l => l.id === save.currentLocation), save.currentLocation || "none");
        add("story_cards_array", Array.isArray(game.storyCards), `len=${Array.isArray(game.storyCards) ? game.storyCards.length : -1}`);
        add("outfit_presets_array", Array.isArray(game.outfitPresets), `len=${Array.isArray(game.outfitPresets) ? game.outfitPresets.length : -1}`);
        add("world_map_shape", !game.worldMap || Array.isArray(game.worldMap?.regions), game.worldMap ? `regions=${Array.isArray(game.worldMap?.regions) ? game.worldMap.regions.length : -1}` : "none");
        const nodeList = Object.values(save.nodes || {});
        const latestNode = nodeList.reduce((best, n) => {
            const bt = best?.createdAt ? Date.parse(best.createdAt) : -1;
            const nt = n?.createdAt ? Date.parse(n.createdAt) : -1;
            return nt > bt ? n : best;
        }, null);
        const latestMeta = latestNode?.meta?.changeParse || null;
        let metaShapeOk = true;
        let metaShapeDetail = "none";
        if (!nodeList.length) {
            metaShapeDetail = "no_nodes";
        } else if (!latestMeta) {
            metaShapeDetail = `node=${latestNode?.id || "unknown"}, no_meta`;
        } else {
            const bad = [];
            if (typeof latestMeta !== "object") bad.push("meta_not_object");
            if (!Number.isFinite(Number(latestMeta.ts || 0))) bad.push("ts_invalid");
            if (typeof latestMeta.hasStructuredPayload !== "boolean") bad.push("hasStructuredPayload_invalid");
            metaShapeOk = bad.length === 0;
            metaShapeDetail = metaShapeOk
                ? `node=${latestNode?.id || "unknown"}, source=${latestMeta.hasStructuredPayload ? "json" : "text"}`
                : `node=${latestNode?.id || "unknown"}, bad=${bad.join("|")}`;
        }
        add("node_change_meta_shape", metaShapeOk, metaShapeDetail);
        const lastChange = CYOA._lastItemChangeReport || null;
        const synced = !lastChange || !!latestMeta;
        const syncDetail = !lastChange
            ? "no_last_change"
            : (latestMeta
                ? `node=${latestNode?.id || "unknown"}, last_change_ts=${Number(lastChange.ts || 0)}`
                : (nodeList.length ? `node=${latestNode?.id || "unknown"}, missing_meta` : "no_nodes"));
        add("last_change_meta_synced", synced, syncDetail);

        return report;
    };

    CYOA.runAcceptanceChecklist = function() {
        const report = {
            timestamp: new Date().toISOString(),
            ok: true,
            items: []
        };
        function add(name, pass, detail) {
            report.items.push({ name, pass: !!pass, detail: detail || "" });
            if (!pass) report.ok = false;
        }

        const requiredApis = [
            "startGame", "exitGame", "sendGameMessage",
            "equipItem", "unequipItem", "useConsumable", "handleStruggle",
            "changeChapter", "isChapterUnlocked", "tryProgressChapter",
            "getActiveConstraints", "getActiveSynergies",
            "getObserverAlert", "getObserverAlertLevel", "isChapterMonitored",
            "applyDegradationRules", "updateObserverAlert",
            "commitTurnNode", "jumpToNode", "renderGameLogFromNode",
            "refreshOptionsFromCurrentNode", "repairCurrentSave",
            "runRuntimeSelfCheck",
            // 兼容层/扩展入口
            "checkQuestProgress", "grantQuestRewards",
            "learnSkill", "gainSkillProficiency", "applyOutfitPreset", "travelToRegion",
            "getActiveDRings", "hasDRing",
            "renderGameOptions", "processAIResponse", "checkChapterTransition"
        ];
        const missing = requiredApis.filter(fn => typeof CYOA[fn] !== "function");
        add("required_apis", missing.length === 0, missing.length ? `missing: ${missing.join(", ")}` : `count=${requiredApis.length}`);

        const self = CYOA.runRuntimeSelfCheck?.();
        add("runtime_self_check_callable", !!self && typeof self === "object", self ? `ok=${!!self.ok}` : "no report");
        if (self?.checks) {
            const failed = self.checks.filter(c => !c.pass);
            add("runtime_self_check_items", failed.length === 0, failed.length ? failed.map(f => f.name).join(", ") : `checks=${self.checks.length}`);
        }

        if (CYOA.currentSave && CYOA.currentGame) {
            const beforeNode = CYOA.currentSave.currentNodeId;
            const repair = CYOA.repairCurrentSave?.();
            add("repair_current_save", repair?.ok === true, repair ? `nodes=${repair.nodeCount || 0}` : "no report");
            add("node_preserved_after_repair", CYOA.currentSave.currentNodeId === beforeNode || !!CYOA.currentSave.nodes?.[CYOA.currentSave.currentNodeId], CYOA.currentSave.currentNodeId || "none");

            const observerVal = Number(CYOA.getObserverAlert?.() || 0);
            add("observer_metric_range", observerVal >= 0 && observerVal <= 100, String(observerVal));

            const canRenderTree = typeof CYOA.renderTreePanel === "function";
            add("tree_panel_hook", canRenderTree, canRenderTree ? "ok" : "missing renderTreePanel");
            const nodeList = Object.values(CYOA.currentSave.nodes || {});
            const latestNode = nodeList.reduce((best, n) => {
                const bt = best?.createdAt ? Date.parse(best.createdAt) : -1;
                const nt = n?.createdAt ? Date.parse(n.createdAt) : -1;
                return nt > bt ? n : best;
            }, null);
            const latestMeta = latestNode?.meta?.changeParse || null;
            const needMeta = !!CYOA._lastItemChangeReport;
            const metaPresent = !needMeta || !!latestMeta;
            let metaDetail = "no_last_change";
            if (needMeta) {
                if (!nodeList.length) metaDetail = "need_meta_but_no_nodes";
                else if (!latestMeta) metaDetail = `node=${latestNode?.id || "unknown"}, missing_meta`;
                else {
                    const bad = [];
                    if (!Number.isFinite(Number(latestMeta.ts || 0))) bad.push("ts_invalid");
                    if (typeof latestMeta.hasStructuredPayload !== "boolean") bad.push("hasStructuredPayload_invalid");
                    metaDetail = bad.length
                        ? `node=${latestNode?.id || "unknown"}, malformed=${bad.join("|")}`
                        : `node=${latestNode?.id || "unknown"}, source=${latestMeta.hasStructuredPayload ? "json" : "text"}`;
                }
            }
            add("node_meta_change_parse_present", metaPresent, metaDetail);
        } else {
            add("game_session_loaded", false, "start a game first");
        }

        report.summary = {
            total: report.items.length,
            passed: report.items.filter(i => i.pass).length,
            failed: report.items.filter(i => !i.pass).length
        };
        return report;
    };

    CYOA.printAcceptanceChecklist = function() {
        const r = CYOA.runAcceptanceChecklist?.();
        if (!r) return null;
        try {
            console.groupCollapsed(`[CYOA] Acceptance checklist: ${r.summary?.passed || 0}/${r.summary?.total || 0}`);
            console.table(r.items || []);
            console.log("summary:", r.summary, "ok:", r.ok, "timestamp:", r.timestamp);
            console.groupEnd();
        } catch (_) {}
        return r;
    };

    // 暴露 runtime 入口，供兼容层委托调用
    CYOA.GameRuntime = CYOA.GameRuntime || {};
    // 若前面已有更稳定实现（如欢迎页链路版），不要被后续重复块覆盖
    if (typeof CYOA.GameRuntime.startGame !== 'function') {
        CYOA.GameRuntime.startGame = CYOA.startGame;
    }
    CYOA.GameRuntime.renderWelcomeScreen = CYOA._renderWelcomeScreen;
    CYOA.GameRuntime.selectWelcomeChar = CYOA._selectWelcomeChar;
    CYOA.GameRuntime.loadSaveFromWelcome = CYOA._loadSaveFromWelcome;
    CYOA.GameRuntime.importSaveFromWelcome = CYOA._importSaveFromWelcome;
    CYOA.GameRuntime.beginGame = CYOA.beginGame;
    CYOA.GameRuntime.jumpToNode = CYOA.jumpToNode;
    CYOA.GameRuntime.onRoleChange = CYOA.onRoleChange;
    CYOA.GameRuntime.saveCurrentSave = CYOA.saveCurrentSave;
    CYOA.GameRuntime.saveAsNewSave = CYOA.saveAsNewSave;
    CYOA.GameRuntime.exportSave = CYOA.exportSave;
    CYOA.GameRuntime.importSave = CYOA.importSave;
    CYOA.GameRuntime.loadSave = CYOA.loadSave;
    CYOA.GameRuntime.deleteSave = CYOA.deleteSave;
    if (typeof CYOA.GameRuntime.exitGame !== 'function') {
        CYOA.GameRuntime.exitGame = CYOA.exitGame;
    }
    CYOA.loadLocalTemplateLibrary?.();
    CYOA.GameRuntime.__ready = true;
})();
