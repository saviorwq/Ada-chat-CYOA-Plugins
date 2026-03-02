/**
 * CYOA Game UI Module (Phase 1 scaffold)
 * 游戏模式 UI 模块（第一阶段骨架）
 */
(function() {
    const CYOA = window.CYOA;
    if (!CYOA || !CYOA.CONFIG) return;

    CYOA.GameUI = CYOA.GameUI || {};
    CYOA.GameUI.__moduleName = 'ui';
    CYOA.GameUI.__ready = true;
})();
/* UI module for in-game controls and messaging */
(function() {
    const CYOA = window.CYOA;
    if (!CYOA || !CYOA.CONFIG) return;

    const t = CYOA.t || ((k) => k);
    const escapeHtml = CYOA.escapeHtml || ((s) => String(s ?? ""));
    const isZhLocale = () => (CYOA._storyLocale || "zh") === "zh";

    function detectStoryLocale(game, save, userText) {
        const sceneId = save?.currentNodeId;
        const scene = (game?.scenes || []).find(s => s.id === sceneId);
        const chapter = (game?.chapters || []).find(ch => ch.id === save?.currentChapter);
        const sample = [
            game?.name,
            game?.synopsis,
            game?.worldSetting,
            game?.coreMechanics,
            game?.narrator?.prompt,
            scene?.title,
            scene?.description,
            chapter?.title,
            userText
        ].filter(Boolean).join("\n");

        const zhCount = (sample.match(/[\u4e00-\u9fff]/g) || []).length;
        const latinCount = (sample.match(/[A-Za-z]/g) || []).length;
        if (zhCount === 0 && latinCount === 0) return "zh";
        return zhCount >= latinCount ? "zh" : "en";
    }

    function getActiveStoryCards(game, save, userText, recentText) {
        const all = Array.isArray(game?.storyCards) ? game.storyCards : [];
        if (!all.length) return [];
        const maxActive = Number(CYOA.CONFIG?.STORY_CARD_MAX_ACTIVE || 3);
        const scope = `${String(userText || "")}\n${String(recentText || "")}`.toLowerCase();
        const curLoc = String(save?.currentLocation || "").toLowerCase();
        const weighted = all.map(card => {
            const words = Array.isArray(card?.triggerWords) ? card.triggerWords : [];
            let score = 0;
            words.forEach(w => {
                const kw = String(w || "").trim().toLowerCase();
                if (kw && scope.includes(kw)) score += 2;
            });
            if ((card?.type || "") === "location" && curLoc && scope.includes(curLoc)) score += 1;
            return { card, score };
        }).filter(x => x.score > 0 || (x.card?.type === "location" && x.card?.content));

        weighted.sort((a, b) => b.score - a.score);
        return weighted.slice(0, Math.max(1, maxActive)).map(x => x.card);
    }

    function formatStoryCardContext(cards) {
        if (!Array.isArray(cards) || !cards.length) return "";
        return cards.map((c, i) => {
            const title = c?.name || c?.id || `Card${i + 1}`;
            const body = String(c?.content || "").trim();
            return body ? `- ${title}: ${body}` : "";
        }).filter(Boolean).join("\n");
    }

    function pickCurrentScene(game, save) {
        const scenes = Array.isArray(game?.scenes) ? game.scenes : [];
        const nodeId = String(save?.currentNodeId || "").trim();
        if (!scenes.length) return null;
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

    function buildStrictFrame(game, save, loc, region) {
        const scene = pickCurrentScene(game, save);
        const shortText = (v, max = 120) => {
            const s = String(v || "").replace(/\s+/g, " ").trim();
            if (!s) return "";
            return s.length > max ? `${s.slice(0, Math.max(20, max - 1))}…` : s;
        };
        const listFrom = (v) => Array.isArray(v) ? v.map(x => String(x?.name || x?.title || x?.id || x || "").trim()).filter(Boolean) : [];
        const allItems = Array.isArray(game?.items) ? game.items : [];
        const allEquipment = Array.isArray(game?.equipment) ? game.equipment : [];
        const allSkills = Array.isArray(game?.skills) ? game.skills : [];
        const itemById = new Map(allItems.map(it => [String(it?.id || ""), it]));
        const equipById = new Map(allEquipment.map(eq => [String(eq?.id || ""), eq]));
        const skillById = new Map(allSkills.map(sk => [String(sk?.id || ""), sk]));
        const facilities = [
            ...listFrom(loc?.facilities),
            ...listFrom(loc?.pointsOfInterest),
            ...listFrom(scene?.facilities),
            ...listFrom(scene?.pointsOfInterest)
        ].filter((v, i, arr) => arr.indexOf(v) === i).slice(0, 12);

        const presentCharacters = [];
        const playerName = String(save?.playerCharacter || save?.playerCharacterId || "").trim();
        if (playerName) presentCharacters.push(playerName);
        const sceneChars = Array.isArray(scene?.characters) ? scene.characters : (Array.isArray(scene?.characterIds) ? scene.characterIds : []);
        sceneChars.forEach((c) => {
            const raw = String(c?.name || c?.title || c?.id || c || "").trim();
            if (!raw) return;
            const def = (game?.characters || []).find(ch => ch.id === raw || ch.name === raw);
            const name = String(def?.name || raw).trim();
            if (name && !presentCharacters.includes(name)) presentCharacters.push(name);
        });
        const allCharacters = Array.isArray(game?.characters) ? game.characters : [];
        const equipMap = new Map();
        Object.values(save?.equipment || {}).forEach((e) => {
            const id = String(e?.id || "").trim();
            if (!id || equipMap.has(id)) return;
            const def = (game?.equipment || []).find(x => x.id === id);
            equipMap.set(id, String(e?.name || def?.name || id));
        });
        const playerId = String(save?.playerCharacterId || "").trim();
        const playerNameForMatch = String(save?.playerCharacter || "").trim();
        const playerInventoryNames = (Array.isArray(save?.inventory) ? save.inventory : [])
            .map((it) => {
                const id = String(it?.id || "").trim();
                const def = itemById.get(id) || {};
                return String(it?.name || def?.name || id).trim();
            })
            .filter(Boolean)
            .slice(0, 8);
        const playerEquipNames = Array.from(equipMap.values()).filter(Boolean).slice(0, 8);
        const toNameList = (arr, cap = 8) => (Array.isArray(arr) ? arr : [])
            .map(x => String(x || "").trim())
            .filter(Boolean)
            .slice(0, cap);
        const resolveOwnedItemNames = (charDef) => {
            const cid = String(charDef?.id || "").trim();
            const cname = String(charDef?.name || "").trim();
            const byOwner = allItems
                .filter(it => {
                    const owner = String(it?.ownerId || "").trim();
                    if (!owner) return false;
                    return (cid && owner === cid) || (cname && owner === cname);
                })
                .map(it => String(it?.name || it?.id || "").trim());
            const bySelect = toNameList(charDef?.initialInventoryItemIds, 16)
                .map(id => String(itemById.get(id)?.name || id).trim());
            return Array.from(new Set(byOwner.concat(bySelect))).filter(Boolean).slice(0, 8);
        };
        const resolveOwnedEquipNames = (charDef) => {
            const cid = String(charDef?.id || "").trim();
            const cname = String(charDef?.name || "").trim();
            const byOwner = allEquipment
                .filter(eq => {
                    const owner = String(eq?.ownerId || "").trim();
                    if (!owner) return false;
                    return (cid && owner === cid) || (cname && owner === cname);
                })
                .map(eq => String(eq?.name || eq?.id || "").trim());
            const bySelect = toNameList(charDef?.initialEquipmentIds, 16)
                .map(id => String(equipById.get(id)?.name || id).trim());
            return Array.from(new Set(byOwner.concat(bySelect))).filter(Boolean).slice(0, 8);
        };
        const resolveSkillNames = (charDef) => toNameList(charDef?.skills, 16)
            .map(id => String(skillById.get(id)?.name || id).trim())
            .filter(Boolean)
            .slice(0, 8);
        const characterCanon = presentCharacters.map((name) => {
            const def = allCharacters.find(ch => ch?.name === name || ch?.id === name) || {};
            const profile = [
                def?.identity,
                def?.roleType,
                def?.personality,
                def?.goal,
                def?.description,
                def?.background
            ].map(x => shortText(x, 64)).filter(Boolean).slice(0, 3).join("；");
            return profile ? `${name}：${profile}` : name;
        }).slice(0, 12);
        const characterProfiles = presentCharacters.map((name) => {
            const def = allCharacters.find(ch => ch?.name === name || ch?.id === name) || {};
            const cid = String(def?.id || "").trim();
            const isPlayer = (playerId && cid === playerId) || (playerNameForMatch && name === playerNameForMatch);
            const personality = toNameList(def?.personality, 4).join("、") || shortText(def?.personality, 48) || "无";
            const backgroundText = shortText(def?.background || def?.description, 56) || "无";
            const goalText = shortText(def?.goal, 40) || "无";
            const skillNames = isPlayer
                ? (Array.isArray(save?.skills) ? save.skills : [])
                    .filter(s => s?.learned !== false)
                    .map(s => String(s?.name || s?.id || "").trim())
                    .filter(Boolean)
                    .slice(0, 8)
                : resolveSkillNames(def);
            const itemNames = isPlayer ? playerInventoryNames : resolveOwnedItemNames(def);
            const equipNames = isPlayer ? playerEquipNames : resolveOwnedEquipNames(def);
            return `${name}｜性格:${personality}｜背景:${backgroundText}｜目标:${goalText}｜道具:${itemNames.join("、") || "无"}｜装备:${equipNames.join("、") || "无"}｜技能:${skillNames.join("、") || "无"}`;
        }).slice(0, 12);

        const equippedItems = Array.from(equipMap.values()).slice(0, 12);
        const activeConstraints = Array.from(CYOA.getActiveConstraints?.() || new Set()).map((k) => CYOA.getConstraintLabel?.(k) || String(k));
        const skills = (Array.isArray(save?.skills) ? save.skills : [])
            .filter(s => s?.learned !== false)
            .slice(0, 10)
            .map(s => `${s.name || s.id}(Lv${s.level || 1})`);
        const quests = (Array.isArray(save?.quests) ? save.quests : [])
            .filter(q => q?.status === "active" || q?.status === "available")
            .slice(0, 8)
            .map(q => String(q?.title || q?.name || q?.id || "").trim())
            .filter(Boolean);
        const attributes = (Array.isArray(save?.attributes) ? save.attributes : [])
            .slice(0, 10)
            .map(a => `${a.name || a.id}:${a.value}`);
        const allowedMapEntities = [
            ...listFrom(game?.worldMap?.regions),
            ...listFrom(game?.chapters),
            ...listFrom(game?.locations)
        ].filter((v, i, arr) => arr.indexOf(v) === i).slice(0, 24);

        return {
            gameName: String(game?.name || "").trim(),
            storySynopsis: shortText(game?.synopsis, 180),
            worldSetting: shortText(game?.worldSetting, 180),
            background: shortText(game?.background || game?.settingBackground || game?.coreMechanics, 180),
            region: String(region?.name || "").trim(),
            chapter: String((game?.chapters || []).find(c => c.id === save?.currentChapter)?.title || save?.currentChapter || "").trim(),
            location: String(loc?.name || save?.currentLocation || "").trim(),
            allowedMapEntities,
            facilities,
            presentCharacters,
            characterCanon,
            characterProfiles,
            equippedItems,
            activeConstraints,
            skills,
            quests,
            attributes
        };
    }

    function getGameLogEl() {
        return document.getElementById("cyoaGameLog");
    }

    function setGameInputBusy(busy) {
        const btns = Array.from(document.querySelectorAll("#gameOptions button, #cyoaSendBtn"));
        btns.forEach(b => { b.disabled = !!busy; });
        const msg = document.getElementById("gameMsg");
        const speech = document.getElementById("gameSpeech");
        if (msg) msg.readOnly = !!busy;
        if (speech) speech.readOnly = !!busy || speech.dataset.cyoaSpeechBlocked === "1";
    }
    CYOA.setGameInputBusy = setGameInputBusy;

    function isSpeechBlockedByConstraint() {
        const constraints = CYOA.getActiveConstraints?.() || new Set();
        return constraints.has("mute") || constraints.has("forced_open_mouth");
    }

    function syncSpeechInputConstraintState() {
        const speech = document.getElementById("gameSpeech");
        if (!speech) return;
        const blocked = isSpeechBlockedByConstraint();
        speech.dataset.cyoaSpeechBlocked = blocked ? "1" : "0";
        speech.disabled = blocked;
        if (blocked) {
            speech.value = "";
            speech.readOnly = true;
            speech.placeholder = isZhLocale()
                ? "口部受限：不可说话/不可唇语表达；可读唇（受眼部状态影响）"
                : "Mouth constrained: no speaking/lip-speaking; lip-reading still allowed (depends on eye constraints)";
        } else {
            speech.readOnly = !!CYOA._sendingGameMsg;
            speech.placeholder = t("ui.ph.speech") || "输入你要说的话...";
        }
    }

    CYOA.resetGameInputState = function() {
        CYOA._sendingGameMsg = false;
        setGameInputBusy(false);
        const msg = document.getElementById("gameMsg");
        const speech = document.getElementById("gameSpeech");
        if (msg) msg.value = "";
        if (speech) speech.value = "";
    };

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async function streamAssistantBubble(content, seq) {
        const logEl = getGameLogEl();
        if (!logEl) return;
        const raw = String(content || "");
        const bubble = document.createElement("div");
        bubble.className = "cyoa-msg assistant";
        bubble.style.cssText = "margin:10px 0;padding:12px 14px;border:1px solid var(--border);border-radius:10px;background:var(--bg-light);white-space:pre-wrap;";
        logEl.appendChild(bubble);

        if (!raw) {
            bubble.textContent = "（无回复）";
            return;
        }

        const total = raw.length;
        const step = total > 1800 ? 36 : total > 900 ? 24 : total > 400 ? 16 : 10;
        for (let i = 0; i < total; i += step) {
            if (seq !== CYOA._gameMsgSeq || !CYOA.currentGame || !CYOA.currentSave) return;
            bubble.innerHTML = escapeHtml(raw.slice(0, i + step));
            logEl.scrollTop = logEl.scrollHeight;
            await sleep(16);
        }
        bubble.innerHTML = escapeHtml(raw);
        logEl.scrollTop = logEl.scrollHeight;
    }

    function sanitizeAITextForDisplay(rawText) {
        let text = String(rawText || "").trim();
        if (!text) return "";
        // 不向玩家展示结构化状态块；仅用于后台解析
        text = text
            .replace(/```cyoa_changes[\s\S]*?```/ig, "")
            .replace(/```json[\s\S]*?"cyoa_changes"[\s\S]*?```/ig, "")
            .replace(/```cyoa_changes[\s\S]*$/ig, "")
            .replace(/```json[\s\S]*?"cyoa_changes"[\s\S]*$/ig, "")
            .trim();
        // 屏蔽模型“审查/纠偏说明”与任意代码块泄漏
        text = text
            .replace(/```json[\s\S]*?```/ig, "")
            .replace(/```[\s\S]*?```/g, "")
            .replace(/###\s*Correction Response Ends[\s\S]*$/i, "")
            .replace(/###\s*视线追踪[\s\S]*$/i, "")
            .replace(/请回复【[^】]*】/g, "")
            .trim();
        // 最小净化：仅处理已知污染标记，避免改写正常叙事
        text = text
            .replace(/<\|LOC_\d+\|>/g, "")
            .replace(/<LOC_\d+>/g, "")
            .replace(/[>|<]{2,}/g, " ")
            .replace(/[ \t]{2,}/g, " ");
        // 去掉限制键名的英文括注，避免出现 "(no_hands)" 之类说明污染
        text = text
            .replace(/[（(]\s*(?:no_hands|limited_step|forced_open_mouth|mute|deaf|blind|vision_restricted|no_fingers|chastity|tethered|breath_restrict)\s*[)）]/ig, "")
            .replace(/\(\s*[a-z_]{2,32}\s*\)/g, "");
        // 某些分类/路由模型会返回 classes: 之类的非叙事残渣
        text = text
            .split(/\r?\n/)
            .filter(line => !/^\s*classes\s*:/i.test(String(line || "").trim()))
            .join("\n")
            .replace(/\n{3,}/g, "\n\n")
            .trim();
        // 中文模式下，额外过滤“高噪声英文结构行”
        if (isZhLocale()) {
            text = text
                .split(/\r?\n/)
                .filter(line => {
                    const s = String(line || "").trim();
                    if (!s) return true;
                    if (/(?:\bTRACE\b|\bSTART\b|\bSTOP\b|errorCode|reported|Performance\s*输入|女性,\s*Performance|\\begin\{aligned\}|v_ID\b)/i.test(s)) return false;
                    const latin = (s.match(/[A-Za-z]/g) || []).length;
                    const zh = (s.match(/[\u4e00-\u9fff]/g) || []).length;
                    const noisy = (s.match(/[\\{}_^$[\]]/g) || []).length;
                    if (latin >= 12 && latin > zh * 2 && noisy >= 2) return false;
                    return true;
                })
                .join("\n")
                .replace(/\n{3,}/g, "\n\n")
                .trim();
        }
        // 最终兜底：清理常见“英文说明/开场元叙述”行
        text = text
            .split(/\r?\n/)
            .filter(line => {
                const s = String(line || "").trim();
                if (!s) return true;
                // 过滤“模型自我解释/规则审查/纠偏过程”元文本
                if (/^(?:在你的回复中用了|我应该严格遵守|所以，?在\s*analyzing|Correction Response Ends|Your action|Reaction mode)\b/i.test(s)) return false;
                if (/^(?:\d+\.\s*不能擅自新增事实|\d+\.\s*状态锚点问题|\d+\.\s*叙事边界|\d+\.\s*技能和状态一致性|\d+\.\s*场景描写要符合现实|\d+\.\s*选项限制)/.test(s)) return false;
                if (/^(?:-+\s*日志部分不能再写|-\s*正文里得删掉)/.test(s)) return false;
                if (/^(?:okay|ok|note|tips?|instructions?|summary|explanation)\s*[:：]/i.test(s)) return false;
                if (/^(?:好的|请锁定|以下是|这里是|说明[:：]|注意事项)/.test(s) && /[A-Za-z]{4,}/.test(s)) return false;
                const latin = (s.match(/[A-Za-z]/g) || []).length;
                const zh = (s.match(/[\u4e00-\u9fff]/g) || []).length;
                // 英文比重远高于中文，且像说明句时过滤
                if (latin >= 24 && latin > zh * 2 && /[:：]|please|game|description|narration|word|characters?/i.test(s)) return false;
                return true;
            })
            .join("\n")
            .replace(/\n{3,}/g, "\n\n")
            .trim();
        return text;
    }

    function resolveCharacterByNameOrId(nameOrId) {
        const game = CYOA.currentGame || {};
        const chars = Array.isArray(game.characters) ? game.characters : [];
        const key = String(nameOrId || "").trim();
        if (!key) return null;
        return chars.find(ch => String(ch?.id || "").trim() === key || String(ch?.name || "").trim() === key) || null;
    }

    function getPlayerAvatarUrl() {
        const save = CYOA.currentSave || {};
        const def = resolveCharacterByNameOrId(save.playerCharacterId) || resolveCharacterByNameOrId(save.playerCharacter);
        return String(def?.avatar || "").trim();
    }

    function getNarratorAvatarUrl() {
        const game = CYOA.currentGame || {};
        const narratorAvatar = String(game?.narrator?.avatar || "").trim();
        if (narratorAvatar) return narratorAvatar;
        const chars = Array.isArray(game.characters) ? game.characters : [];
        const nar = chars.find(ch => String(ch?.roleType || "").trim() === "narrator");
        return String(nar?.avatar || "").trim();
    }

    function getNpcAvatarList(strictFrame) {
        const save = CYOA.currentSave || {};
        const playerName = String(save.playerCharacter || "").trim();
        const present = Array.isArray(strictFrame?.presentCharacters) ? strictFrame.presentCharacters : [];
        const out = [];
        present.forEach((name) => {
            const n = String(name || "").trim();
            if (!n || n === playerName) return;
            const def = resolveCharacterByNameOrId(n);
            const avatar = String(def?.avatar || "").trim();
            if (!avatar) return;
            out.push({ name: String(def?.name || n), avatar });
        });
        return out.slice(0, 4);
    }

    function renderBubbleAvatar(avatarUrl, fallbackEmoji, title) {
        const src = String(avatarUrl || "").trim();
        if (src) {
            return `<img src="${escapeHtml(src)}" alt="${escapeHtml(title || "avatar")}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;border:1px solid var(--border);flex-shrink:0;">`;
        }
        return `<div style="width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:var(--bg);border:1px solid var(--border);font-size:14px;flex-shrink:0;">${escapeHtml(fallbackEmoji || "🙂")}</div>`;
    }

    function appendBubble(role, content, options) {
        const logEl = getGameLogEl();
        if (!logEl) return;
        const isUser = role === "user";
        const bg = isUser ? "var(--accent-bg,rgba(80,140,255,.08))" : "var(--bg-light)";
        const style = `margin:10px 0;padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:${bg};`;
        const opt = options && typeof options === "object" ? options : {};
        const avatarUrl = String(opt.avatarUrl || (isUser ? getPlayerAvatarUrl() : getNarratorAvatarUrl()) || "").trim();
        const avatarHtml = renderBubbleAvatar(avatarUrl, isUser ? "🙂" : "☯", isUser ? "player" : "narrator");
        const textHtml = `<div class="cyoa-msg-text" style="white-space:pre-wrap; line-height:1.5;">${escapeHtml(content)}</div>`;
        const npcAvatars = Array.isArray(opt.npcAvatars) ? opt.npcAvatars : [];
        const npcStrip = !isUser && npcAvatars.length
            ? `<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:6px;">${npcAvatars.map(npc => `<img src="${escapeHtml(npc.avatar)}" title="${escapeHtml(npc.name || '')}" style="width:20px;height:20px;border-radius:50%;object-fit:cover;border:1px solid var(--border);">`).join('')}</div>`
            : "";
        logEl.innerHTML += `<div class="cyoa-msg ${role}" style="${style}"><div style="display:flex;gap:10px;align-items:flex-start;">${avatarHtml}<div style="flex:1;min-width:0;">${npcStrip}${textHtml}</div></div></div>`;
        logEl.scrollTop = logEl.scrollHeight;
    }
    CYOA.appendGameBubble = appendBubble;

    function createAssistantBubbleShell(options) {
        const logEl = getGameLogEl();
        if (!logEl) return null;
        const opt = options && typeof options === "object" ? options : {};
        const bubble = document.createElement("div");
        bubble.className = "cyoa-msg assistant";
        bubble.style.cssText = "margin:10px 0;padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:var(--bg-light);";
        const avatarUrl = String(opt.avatarUrl || getNarratorAvatarUrl() || "").trim();
        const avatarHtml = renderBubbleAvatar(avatarUrl, "☯", "narrator");
        const npcAvatars = Array.isArray(opt.npcAvatars) ? opt.npcAvatars : [];
        const npcStrip = npcAvatars.length
            ? `<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:6px;">${npcAvatars.map(npc => `<img src="${escapeHtml(npc.avatar)}" title="${escapeHtml(npc.name || '')}" style="width:20px;height:20px;border-radius:50%;object-fit:cover;border:1px solid var(--border);">`).join('')}</div>`
            : "";
        bubble.innerHTML = `<div style="display:flex;gap:10px;align-items:flex-start;">${avatarHtml}<div style="flex:1;min-width:0;">${npcStrip}<div class="cyoa-msg-text" style="white-space:pre-wrap; line-height:1.5;">…</div></div></div>`;
        logEl.appendChild(bubble);
        logEl.scrollTop = logEl.scrollHeight;
        return bubble;
    }

    function setAssistantBubbleText(bubble, content) {
        if (!bubble) return;
        const textEl = bubble.querySelector(".cyoa-msg-text");
        if (textEl) textEl.innerHTML = escapeHtml(String(content || ""));
        else bubble.innerHTML = escapeHtml(String(content || ""));
        const logEl = getGameLogEl();
        if (logEl) logEl.scrollTop = logEl.scrollHeight;
    }

    function stripOptionTypeTagsForDisplay(text) {
        const src = String(text || "");
        if (!src) return src;
        return src
            .split(/\r?\n/)
            .map((line) => String(line || "")
                .replace(/^[ \t]*[（(]\s*(行动|对话|action|dialog|dialogue|speech)\s*[）)]\s*/i, "")
                .replace(/^[ \t]*(行动|对话|action|dialog|dialogue|speech)\s*[:：]\s*/i, ""))
            .join("\n")
            .replace(/\n{3,}/g, "\n\n")
            .trim();
    }

    CYOA.renderGameIntro = function(gameName, introText) {
        const logEl = getGameLogEl();
        if (!logEl) return;
        logEl.innerHTML = `<div class="cyoa-msg assistant" style="margin:10px 0;padding:12px 14px;border:1px solid var(--border);border-radius:10px;background:var(--bg-light);">
            <div style="font-weight:700;margin-bottom:6px;">${escapeHtml(gameName || "CYOA")}</div>
            <div>${escapeHtml(introText || "冒险开始。")}</div>
        </div>`;
        logEl.scrollTop = logEl.scrollHeight;
    };

    CYOA.renderGameLogFromNode = function(nodeId) {
        const logEl = getGameLogEl();
        const save = CYOA.currentSave;
        if (!logEl || !save?.nodes || !nodeId) return;
        const nodes = save.nodes;
        if (!nodes[nodeId]) return;
        const formatNodeChangeMeta = function(meta) {
            if (!meta || typeof meta !== "object") return "";
            const source = meta.hasStructuredPayload ? "json" : "text";
            const added = Number(meta.addedCount || 0);
            const removed = Number(meta.removedCount || 0);
            const tp = meta.textProtocolHits || {};
            let line = `🔎 解析来源: ${source} | +${added} / -${removed}`;
            if (meta.textProtocolApplied) {
                line += ` | 文本协议 g${Number(tp.gain || 0)} c${Number(tp.consume || 0)} d${Number(tp.durability || 0)}`;
            }
            if (meta.durabilityChanged) line += ` | durability=on`;
            return line;
        };

        const path = [];
        const seen = new Set();
        let cur = nodes[nodeId];
        while (cur && !seen.has(cur.id)) {
            path.push(cur);
            seen.add(cur.id);
            cur = cur.parentId ? nodes[cur.parentId] : null;
        }
        path.reverse();

        let html = "";
        path.forEach(n => {
            const user = String(n.userMessage || "").trim();
            const ai = String(n.assistantMessage || "").trim();
            if (user) {
                const bg = "var(--accent-bg,rgba(80,140,255,.08))";
                html += `<div class="cyoa-msg user" style="margin:10px 0;padding:12px 14px;border:1px solid var(--border);border-radius:10px;background:${bg};white-space:pre-wrap;">${escapeHtml(user)}</div>`;
            }
            if (ai) {
                const aiDisplay = stripOptionTypeTagsForDisplay(ai);
                html += `<div class="cyoa-msg assistant" style="margin:10px 0;padding:12px 14px;border:1px solid var(--border);border-radius:10px;background:var(--bg-light);white-space:pre-wrap;">${escapeHtml(aiDisplay)}</div>`;
                const metaLine = formatNodeChangeMeta(n?.meta?.changeParse);
                if (metaLine) {
                    html += `<div class="cyoa-msg system" style="margin:-4px 0 10px 0;padding:6px 10px;border:1px dashed var(--border);border-radius:8px;background:var(--bg-light);font-size:12px;color:var(--text-light);">${escapeHtml(metaLine)}</div>`;
                }
            }
        });
        logEl.innerHTML = html || `<div class="cyoa-msg assistant" style="margin:10px 0;padding:12px 14px;border:1px solid var(--border);border-radius:10px;background:var(--bg-light);">${escapeHtml("该节点暂无可回放内容。")}</div>`;
        logEl.scrollTop = logEl.scrollHeight;
    };

    function getOptionType(s) {
        const raw = String(s || "").trim();
        if (/^[（(]\s*行动\s*[）)]/i.test(raw) || /^行动[:：]/i.test(raw)) return "action";
        if (/^[（(]\s*对话\s*[）)]/i.test(raw) || /^对话[:：]/i.test(raw)) return "dialog";
        if (/^[（(]\s*action\s*[）)]/i.test(raw) || /^action\s*[:：]/i.test(raw)) return "action";
        if (/^[（(]\s*(dialog|dialogue|speech)\s*[）)]/i.test(raw) || /^(dialog|dialogue|speech)\s*[:：]/i.test(raw)) return "dialog";
        return "unknown";
    }

    function normalizeOptionLabel(s) {
        return String(s || "")
            .replace(/^[(（]\s*(行动|对话)\s*[)）]\s*/i, "")
            .replace(/^[(（]\s*(action|dialog|dialogue|speech)\s*[)）]\s*/i, "")
            .replace(/^(行动|对话)\s*[:：]\s*/i, "")
            .replace(/^(action|dialog|dialogue|speech)\s*[:：]\s*/i, "")
            .replace(/^🔹\s*/, "")
            .replace(/^◆\s*/, "")
            .replace(/^\d+[.)、]\s*/, "")
            .trim();
    }

    function localizeOptionLabel(label, type, fallbackIdx) {
        let s = String(label || "").trim();
        if (!s) return "";

        // 中文模式下，清理“英文命令词 + 中文句子”的前缀，例如：holster 查看...
        if (isZhLocale()) {
            s = s
                .replace(/^[A-Za-z][A-Za-z0-9_\-]*(?:\s+[A-Za-z][A-Za-z0-9_\-]*){0,3}\s+/g, "")
                .replace(/^[A-Za-z][A-Za-z0-9_\-]*(?:\s*[/:：\-]\s*)/g, "")
                .trim();
        }

        const latinCount = (s.match(/[A-Za-z]/g) || []).length;
        const zhCount = (s.match(/[\u4e00-\u9fff]/g) || []).length;
        const tooEnglishInZhMode = isZhLocale() && latinCount > 0 && latinCount >= zhCount;

        if (!s || tooEnglishInZhMode) {
            const actionFallback = isZhLocale()
                ? ["观察周围环境", "尝试推进当前目标"]
                : ["Scan the surroundings", "Push the objective forward"];
            const dialogFallback = isZhLocale()
                ? ["询问关键线索", "试探对方反应"]
                : ["Ask for key clues", "Probe the counterpart's reaction"];
            return type === "action"
                ? (actionFallback[fallbackIdx] || (isZhLocale() ? "谨慎行动" : "Act carefully"))
                : (dialogFallback[fallbackIdx] || (isZhLocale() ? "继续对话" : "Continue the dialogue"));
        }
        return s;
    }

    function extractTypedOptions(aiText) {
        const text = String(aiText || "");
        if (!text) return [];

        // 去掉结构化变更块，避免把 JSON 行误判为选项
        const cleaned = text
            .replace(/```cyoa_changes[\s\S]*?```/ig, "")
            .replace(/```json[\s\S]*?```/ig, "")
            .trim();

        const out = [];

        // 1) 常规按行解析
        cleaned.split("\n").forEach(line => {
            const s = line.trim();
            if (!s) return;
            const type = getOptionType(s);
            if (type === "unknown") return;
            const label = normalizeOptionLabel(s);
            if (label) out.push({ type, label });
        });

        // 2) 若模型把多个选项挤在同一行，按分隔符二次拆分
        if (out.length <= 1) {
            const compact = cleaned.replace(/\r/g, "");
            const parts = compact
                .split(/(?=🔹|◆|•|[（(]\s*(?:行动|对话)\s*[）)])|(?:\s{2,}|[|｜]|；|;)/g)
                .map(s => s.trim())
                .filter(Boolean);
            const parsed = parts
                .map(p => ({ type: getOptionType(p), label: normalizeOptionLabel(p) }))
                .filter(p => p.type !== "unknown" && p.label && p.label.length >= 2);
            if (parsed.length > out.length) {
                out.length = 0;
                out.push(...parsed);
            }
        }

        // 3) 无标签兜底：若末尾恰好有 4 行候选项，按 2 行行动 + 2 行对话推断
        if (out.length === 0) {
            const lines = cleaned.split(/\r?\n/).map(s => String(s || "").trim()).filter(Boolean);
            if (lines.length >= 4) {
                const tail = lines.slice(-4).map(normalizeOptionLabel).filter(s => s.length >= 2);
                if (tail.length === 4) {
                    out.push(
                        { type: "action", label: tail[0] },
                        { type: "action", label: tail[1] },
                        { type: "dialog", label: tail[2] },
                        { type: "dialog", label: tail[3] }
                    );
                }
            }
        }

        // 去重，保持顺序
        const seen = new Set();
        return out.filter(item => {
            const key = `${item.type}:${item.label}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        }).slice(0, 10);
    }

    function buildSystemControlActionSeeds() {
        const save = CYOA.currentSave;
        if (!save) return [];
        const out = [];
        const push = (s) => {
            const v = String(s || "").trim();
            if (!v) return;
            if (!out.includes(v)) out.push(v);
        };

        const stims = Array.isArray(save.activeStimulators) ? save.activeStimulators.filter(s => s.mode !== "off") : [];
        if (stims.length) {
            push(isZhLocale() ? "降低刺激器强度，改为低档脉冲" : "Lower stimulator intensity to low pulse");
            push(isZhLocale() ? "关闭当前刺激器，先稳定呼吸和心率" : "Turn off current stimulators and stabilize breathing");
        } else if ((CYOA.getControllableAttachments?.() || []).some(c => c.type === "vibrator" || c.type === "shock")) {
            push(isZhLocale() ? "试探性开启最低强度刺激器" : "Enable the lowest stimulator intensity for probing");
        }

        const tube = save.breathingTube || {};
        if (tube.active && String(tube.flowLevel || "") !== "full") {
            push(isZhLocale() ? "将呼吸管调到更高流量" : "Increase breathing tube flow level");
        }

        const electro = save.electroLatex || {};
        if (electro.active && Array.isArray(electro.zones) && electro.zones.length) {
            push(isZhLocale() ? "缩减电击区域，优先关闭高敏区" : "Reduce electro zones, disable high-sensitivity areas first");
        }

        const inf = save.inflationLevels || {};
        const infActive = Object.entries(inf).some(([, lv]) => Number(lv || 0) > 0);
        if (infActive) {
            push(isZhLocale() ? "缓慢泄压一档，观察身体反应变化" : "Deflate by one level and observe body response");
        }

        const agreements = Array.isArray(save.agreements) ? save.agreements : [];
        const playerId = String(save.playerCharacterId || "");
        const hasControlContract = agreements.some((ag) => {
            if (!ag || ag.active === false) return false;
            const controlled = String(ag.controlledId || ag.subId || ag.partyBId || "");
            return controlled && controlled === playerId;
        });
        if (hasControlContract) {
            push(isZhLocale() ? "检查契约着装要求，调整为合规状态" : "Check contract outfit requirements and comply");
        }
        const controllableNpcIds = CYOA.getControllableNpcIdsByAgreement?.() || [];
        if (controllableNpcIds.length > 0) {
            push(isZhLocale() ? "检查并调整受控NPC的装备状态" : "Inspect and adjust controlled NPC equipment");
            push(isZhLocale() ? "从受控NPC收回关键道具" : "Take back key items from controlled NPC");
        }

        return out.slice(0, 6);
    }

    function pickFourOptions(aiText) {
        const parsed = extractTypedOptions(aiText);
        const actions = parsed.filter(x => x.type === "action");
        const dialogs = parsed.filter(x => x.type === "dialog");
        const unknowns = parsed.filter(x => x.type === "unknown");

        while (actions.length < 2 && unknowns.length) actions.push({ type: "action", label: unknowns.shift().label });
        while (dialogs.length < 2 && unknowns.length) dialogs.push({ type: "dialog", label: unknowns.shift().label });

        const systemSeeds = buildSystemControlActionSeeds();
        while (actions.length < 2 && systemSeeds.length) {
            actions.push({ type: "action", label: systemSeeds.shift() });
        }

        const fallbackActions = isZhLocale()
            ? ["观察周围环境", "尝试推进当前目标"]
            : ["Scan the surroundings", "Push the objective forward"];
        const fallbackDialogs = isZhLocale()
            ? ["询问关键线索", "试探对方反应"]
            : ["Ask for key clues", "Probe the counterpart's reaction"];
        while (actions.length < 2) actions.push({ type: "action", label: fallbackActions[actions.length] });
        while (dialogs.length < 2) dialogs.push({ type: "dialog", label: fallbackDialogs[dialogs.length] });
        const merged = [...actions.slice(0, 2), ...dialogs.slice(0, 2)];
        return merged.map((item, idx) => {
            const fallbackIdx = idx % 2;
            return {
                ...item,
                label: localizeOptionLabel(item.label, item.type, fallbackIdx)
            };
        });
    }

    function enforceFourOptionLines(aiText) {
        const src = String(aiText || "").trim();
        if (!src) return src;
        const options = pickFourOptions(src);
        const lines = src.split(/\r?\n/);
        const bodyLines = lines.filter((line) => {
            const s = String(line || "").trim();
            if (getOptionType(s) !== "unknown") return false;
            // 二次收口：剔除残留元说明与标题行
            if (!s) return false;
            if (/^(?:#+\s*|Your action:|Reaction mode:|Correction Response Ends)/i.test(s)) return false;
            if (/^(?:在你的回复中用了|我应该严格遵守|所以，?在\s*analyzing|请回复【)/i.test(s)) return false;
            if (/^\{\s*"error"\s*:/.test(s)) return false;
            return true;
        });
        const body = bodyLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
        const compactNarrativeBody = (rawBody) => {
            const srcBody = String(rawBody || "").trim();
            if (!srcBody) return "";
            let cleaned = srcBody
                .split(/\r?\n/)
                .map(s => String(s || "").trim())
                .filter(Boolean)
                .filter((s) => {
                    // 终极拦截：剔除模型自解释/规则复述/结构化噪声
                    if (/^(?:\d+\.\s*)?(?:不能擅自新增事实|状态锚点问题|叙事边界|技能和状态一致性|场景描写要符合现实|选项限制)/.test(s)) return false;
                    if (/^(?:在你的回复中用了|我应该严格遵守|所以，?在\s*analyzing|Correction Response Ends|Your action|Reaction mode)/i.test(s)) return false;
                    if (/^(?:json|yaml|xml|markdown|rules?|prompt|system correction)\b/i.test(s)) return false;
                    if (/^\{.*\}$/.test(s)) return false;
                    if (/```|^\[?error\]?[:：]/i.test(s)) return false;
                    return true;
                })
                .join(" ");
            cleaned = cleaned.replace(/\s{2,}/g, " ").trim();
            if (!cleaned) return "";

            // 中文模式：按句切分后强制压缩成最多 4 句、每句不超过 28 字
            if (isZhLocale()) {
                const chunks = cleaned
                    .split(/(?<=[。！？!?])/)
                    .map(s => s.trim())
                    .filter(Boolean);
                const picked = [];
                for (let i = 0; i < chunks.length && picked.length < 4; i += 1) {
                    let c = chunks[i].replace(/^[，。；：、\s]+/, "").trim();
                    if (!c) continue;
                    if (c.length > 28) c = `${c.slice(0, 27)}…`;
                    picked.push(c);
                }
                if (!picked.length) {
                    const fallback = cleaned.length > 28 ? `${cleaned.slice(0, 27)}…` : cleaned;
                    return fallback;
                }
                return picked.join("\n");
            }

            // 英文模式：最多 3 句，单句最多 18 词
            const chunks = cleaned.split(/(?<=[.!?])/).map(s => s.trim()).filter(Boolean);
            const picked = [];
            for (let i = 0; i < chunks.length && picked.length < 3; i += 1) {
                const words = chunks[i].split(/\s+/).filter(Boolean);
                const short = words.length > 18 ? `${words.slice(0, 18).join(" ")}...` : chunks[i];
                picked.push(short);
            }
            return picked.join("\n");
        };
        const compactBody = compactNarrativeBody(body);
        const optionLines = [
            `${options[0]?.label || (isZhLocale() ? "观察周围环境" : "Scan the surroundings")}`,
            `${options[1]?.label || (isZhLocale() ? "尝试推进当前目标" : "Push the objective forward")}`,
            `${options[2]?.label || (isZhLocale() ? "询问关键线索" : "Ask for key clues")}`,
            `${options[3]?.label || (isZhLocale() ? "试探对方反应" : "Probe the counterpart's reaction")}`
        ];
        const safeBody = compactBody || (isZhLocale() ? "你先稳住呼吸，快速扫视周围并锁定可验证线索。" : "You steady your breath and lock onto verifiable clues.");
        return `${safeBody}\n\n${optionLines.join("\n")}`.trim();
    }

    function normalizeActionByConstraints(actionText, constraints) {
        if (CYOA.GameRules && typeof CYOA.GameRules.normalizeActionByConstraints === "function") {
            return CYOA.GameRules.normalizeActionByConstraints(actionText, constraints, { isZh: isZhLocale() });
        }
        return String(actionText || "").trim();
    }

    function applyConstraintRulesToOptions(options) {
        if (CYOA.GameRules && typeof CYOA.GameRules.applyOptionConstraintRules === "function") {
            const constraints = CYOA.getActiveConstraints?.() || new Set();
            return CYOA.GameRules.applyOptionConstraintRules(options, constraints, { isZh: isZhLocale() });
        }
        return options;
    }

    function renderOptionsFromText(aiText) {
        const host = document.getElementById("gameOptions");
        if (!host) return;
        let options = applyConstraintRulesToOptions(pickFourOptions(aiText));
        if (!Array.isArray(options)) options = [];
        // 兜底：任何情况下都确保 4 个可选项，避免 UI 空白
        if (!options.length) {
            options = pickFourOptions("");
        }
        if (!options.length) {
            host.innerHTML = "";
            return;
        }
        const clipLabel = (txt, maxChars = 26) => {
            const s = String(txt || "").trim();
            if (!s) return s;
            return s.length > maxChars ? `${s.slice(0, Math.max(1, maxChars - 1))}…` : s;
        };
        CYOA._gameOptionCache = options.slice(0, 4);
        const actionHtml = options.slice(0, 2).map((item, idx) => {
            const n = idx + 1;
            const fullLabel = String(item.label || "");
            const showLabel = clipLabel(fullLabel, 26);
            return `<button type="button" class="cyoa-btn cyoa-btn-secondary" title="${escapeHtml(fullLabel)}" style="width:34ch;max-width:34ch;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:6px;text-align:left;" onclick="CYOA.selectGameOption(${idx})">[${n}] ${escapeHtml(showLabel)}</button>`;
        }).join("");
        const dialogHtml = options.slice(2, 4).map((item, idx) => {
            const n = idx + 3;
            const fullLabel = String(item.label || "");
            const showLabel = clipLabel(fullLabel, 26);
            return `<button type="button" class="cyoa-btn cyoa-btn-secondary" title="${escapeHtml(fullLabel)}" style="width:34ch;max-width:34ch;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:6px;text-align:left;" onclick="CYOA.selectGameOption(${idx + 2})">[${n}] ${escapeHtml(showLabel)}</button>`;
        }).join("");
        host.innerHTML = `
            <div style="display:grid;grid-template-columns:repeat(2,34ch);gap:8px;justify-content:start;overflow-x:auto;">
                <div>${actionHtml}</div>
                <div>${dialogHtml}</div>
            </div>
        `;
        syncSpeechInputConstraintState();
    }
    CYOA.renderOptionsFromText = renderOptionsFromText;

    // 兼容旧接口：从 AI 文本提取 options（[{type,text}]）
    const LEGACY_OPTION_PREFIX_RE = /^[🔹◆]\s*/;
    const LEGACY_OPTION_TYPE_RE = /^[🔹◆]\s*\((行动|对话)\)\s*/;
    CYOA.extractOptions = function(text) {
        const src = String(text || "");
        const out = [];
        src.split(/\r?\n/).forEach((line) => {
            const trimmed = String(line || "").trim();
            if (!LEGACY_OPTION_PREFIX_RE.test(trimmed)) return;
            const m = trimmed.match(LEGACY_OPTION_TYPE_RE);
            if (m) {
                out.push({
                    type: m[1] === "行动" ? "action" : "speech",
                    text: trimmed.replace(LEGACY_OPTION_TYPE_RE, "").trim()
                });
            } else {
                out.push({
                    type: "action",
                    text: trimmed.replace(LEGACY_OPTION_PREFIX_RE, "").trim()
                });
            }
        });
        if (out.length) return out;
        // 新协议兜底：使用统一选项抽取器
        return pickFourOptions(src).map((opt) => ({
            type: opt?.type === "action" ? "action" : "speech",
            text: String(opt?.label || "").trim()
        })).filter(x => x.text);
    };

    // 兼容旧接口：切换回合节点并回放日志
    CYOA.jumpToNode = function(nodeId) {
        if (CYOA.GameRuntime && typeof CYOA.GameRuntime.jumpToNode === "function") {
            return CYOA.GameRuntime.jumpToNode(nodeId);
        }
        const save = CYOA.currentSave;
        const id = String(nodeId || "");
        if (!save?.nodes?.[id]) return;
        CYOA.currentNodeId = id;
        save.currentNodeId = id;
        CYOA.persistSave?.();
        CYOA.renderGameLogFromNode?.(id);
        CYOA.refreshOptionsFromCurrentNode?.();
        CYOA.renderTreePanel?.();
    };

    CYOA.refreshOptionsFromCurrentNode = function() {
        const save = CYOA.currentSave;
        const nodeId = save?.currentNodeId;
        const node = nodeId ? save?.nodes?.[nodeId] : null;
        renderOptionsFromText(String(node?.assistantMessage || ""));
        renderInteractPanel();
    };

    // 兼容旧 API 名称
    CYOA.renderGameOptions = function() {
        CYOA.refreshOptionsFromCurrentNode?.();
    };

    CYOA.renderGameControls = function() {
        return `
            <div style="display:flex;flex-direction:column;width:100%;gap:8px;">
                <div id="cyoaGameLog" style="max-height:56vh; overflow:auto; border:1px solid var(--border); border-radius:10px; padding:8px; background:var(--card-bg, var(--bg));"></div>
                <div id="cyoaInteractPanel" style="border:1px solid var(--border); border-radius:10px; padding:8px; background:var(--bg-light);"></div>
                <div style="display:flex;gap:8px;align-items:stretch;width:100%;">
                    <div id="cyoaDirectionPad" style="min-width:148px; border:1px solid var(--border); border-radius:10px; padding:6px; background:var(--bg-light);">
                        <div style="font-size:11px; font-weight:600; margin-bottom:6px;">${isZhLocale() ? "方向控制" : "Direction Pad"}</div>
                        <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:4px;">
                            <button type="button" class="cyoa-btn cyoa-btn-secondary" data-cyoa-dir="nw" style="padding:2px 0; font-size:11px;">↖</button>
                            <button type="button" class="cyoa-btn cyoa-btn-secondary" data-cyoa-dir="n" style="padding:2px 0; font-size:11px;">↑</button>
                            <button type="button" class="cyoa-btn cyoa-btn-secondary" data-cyoa-dir="ne" style="padding:2px 0; font-size:11px;">↗</button>
                            <button type="button" class="cyoa-btn cyoa-btn-secondary" data-cyoa-dir="w" style="padding:2px 0; font-size:11px;">←</button>
                            <button type="button" class="cyoa-btn cyoa-btn-secondary" data-cyoa-dir="stay" style="padding:2px 0; font-size:11px;">•</button>
                            <button type="button" class="cyoa-btn cyoa-btn-secondary" data-cyoa-dir="e" style="padding:2px 0; font-size:11px;">→</button>
                            <button type="button" class="cyoa-btn cyoa-btn-secondary" data-cyoa-dir="sw" style="padding:2px 0; font-size:11px;">↙</button>
                            <button type="button" class="cyoa-btn cyoa-btn-secondary" data-cyoa-dir="s" style="padding:2px 0; font-size:11px;">↓</button>
                            <button type="button" class="cyoa-btn cyoa-btn-secondary" data-cyoa-dir="se" style="padding:2px 0; font-size:11px;">↘</button>
                        </div>
                        <div style="display:grid; grid-template-columns:repeat(2,1fr); gap:4px; margin-top:6px;">
                            <button type="button" class="cyoa-btn cyoa-btn-secondary" data-cyoa-dir="up" style="padding:2px 0; font-size:11px;">${isZhLocale() ? "上" : "Up"}</button>
                            <button type="button" class="cyoa-btn cyoa-btn-secondary" data-cyoa-dir="down" style="padding:2px 0; font-size:11px;">${isZhLocale() ? "下" : "Down"}</button>
                            <button type="button" class="cyoa-btn cyoa-btn-secondary" data-cyoa-dir="enter" style="padding:2px 0; font-size:11px;">${isZhLocale() ? "进入" : "Enter"}</button>
                            <button type="button" class="cyoa-btn cyoa-btn-secondary" data-cyoa-dir="exit" style="padding:2px 0; font-size:11px;">${isZhLocale() ? "离开" : "Exit"}</button>
                        </div>
                    </div>
                    <div style="display:flex;flex-direction:column;gap:8px;flex:1;min-width:0;">
                        <div style="display:flex;gap:8px;align-items:center;min-width:0;">
                            <textarea id="gameMsg" class="cyoa-input" placeholder="${t("ui.ph.action") || "输入行动..."}" rows="1" style="flex:1;min-height:36px;resize:vertical;"></textarea>
                            <textarea id="gameSpeech" class="cyoa-input" placeholder="${t("ui.ph.speech") || "输入对话..."}" rows="1" style="flex:1;min-height:36px;resize:vertical;"></textarea>
                            <button type="button" id="cyoaSendBtn" class="cyoa-btn cyoa-btn-primary" onclick="CYOA.sendGameMessage()">${t("ui.btn.send") || "发送"}</button>
                            <button type="button" class="cyoa-btn cyoa-btn-secondary" onclick="CYOA.exitGame()">${t("ui.btn.exitGame") || "退出游戏"}</button>
                        </div>
                        <div id="gameOptions" class="cyoa-options-panel"></div>
                    </div>
                </div>
            </div>
        `;
    };

    CYOA.quickMoveByDirection = function(dir) {
        const d = String(dir || "").trim().toLowerCase();
        if (!d) return;
        const actionMapZh = {
            n: "向北移动并观察前方",
            ne: "向东北移动并观察前方",
            e: "向东移动并观察前方",
            se: "向东南移动并观察前方",
            s: "向南移动并观察前方",
            sw: "向西南移动并观察前方",
            w: "向西移动并观察前方",
            nw: "向西北移动并观察前方",
            up: "向上移动并确认上层通路",
            down: "向下移动并确认下层通路",
            enter: "进入当前可进入区域并观察环境",
            exit: "离开当前区域并返回外部通道",
            stay: "原地调整姿态并重新观察环境"
        };
        const actionMapEn = {
            n: "Move north and scan ahead",
            ne: "Move northeast and scan ahead",
            e: "Move east and scan ahead",
            se: "Move southeast and scan ahead",
            s: "Move south and scan ahead",
            sw: "Move southwest and scan ahead",
            w: "Move west and scan ahead",
            nw: "Move northwest and scan ahead",
            up: "Move up and confirm upper-level path",
            down: "Move down and confirm lower-level path",
            enter: "Enter the accessible area and inspect the environment",
            exit: "Exit the current area and return to the outer path",
            stay: "Adjust posture in place and re-scan surroundings"
        };
        const msg = document.getElementById("gameMsg");
        if (!msg) return;
        msg.value = isZhLocale() ? (actionMapZh[d] || actionMapZh.stay) : (actionMapEn[d] || actionMapEn.stay);
        CYOA.sendGameMessage?.();
    };

    function buildInteractablesForPanel() {
        const game = CYOA.currentGame;
        const save = CYOA.currentSave;
        if (!game || !save) return { npcs: [], facilities: [] };
        const scene = pickCurrentScene(game, save);
        const constraints = CYOA.getActiveConstraints?.() || new Set();
        const playerName = String(save?.playerCharacter || save?.playerCharacterId || "").trim();
        const chars = Array.isArray(game.characters) ? game.characters : [];
        const sceneChars = Array.isArray(scene?.characters) ? scene.characters : (Array.isArray(scene?.characterIds) ? scene.characterIds : []);
        const npcs = sceneChars
            .map((v) => {
                const raw = String(v?.id || v?.name || v || "").trim();
                const def = chars.find(c => c.id === raw || c.name === raw) || {};
                const id = String(def.id || raw).trim();
                const name = String(def.name || raw).trim();
                if (!id || !name) return null;
                if (name === playerName || id === String(save?.playerCharacterId || "")) return null;
                const canSpeak = !(constraints.has("mute") || constraints.has("forced_open_mouth"));
                const canObserve = !constraints.has("blind");
                const blocked = !canSpeak && !canObserve;
                const reason = blocked
                    ? (isZhLocale() ? "口部与视觉均受限，暂不可稳定互动" : "Mouth and vision are both constrained")
                    : (!canSpeak
                        ? (isZhLocale() ? "不可说话，仅可观察/动作互动" : "No speech; observation/action only")
                        : (!canObserve ? (isZhLocale() ? "视野受限，建议近距互动" : "Vision constrained; interact at close range") : ""));
                return { id, name, blocked, reason };
            })
            .filter(Boolean)
            .filter((x, i, arr) => arr.findIndex(y => y.id === x.id || y.name === x.name) === i)
            .slice(0, 8);

        const toNames = (arr) => (Array.isArray(arr) ? arr : []).map(x => String(x?.name || x?.title || x?.id || x || "").trim()).filter(Boolean);
        const loc = (game.locations || []).find(l => l.id === save.currentLocation) || {};
        const facNames = Array.from(new Set([
            ...toNames(scene?.interactables),
            ...toNames(loc?.facilities),
            ...toNames(loc?.pointsOfInterest),
            ...toNames(scene?.facilities),
            ...toNames(scene?.pointsOfInterest)
        ])).slice(0, 10);
        const handBlocked = constraints.has("no_hands") || constraints.has("no_fingers");
        const facilities = facNames.map((name) => {
            const blocked = handBlocked;
            return {
                name,
                blocked,
                reason: blocked
                    ? (isZhLocale() ? "手/指受限，暂不可进行精细设施互动" : "Hand/finger constrained for fine facility interaction")
                    : ""
            };
        });
        return { npcs, facilities };
    }

    function renderInteractPanel() {
        const host = document.getElementById("cyoaInteractPanel");
        if (!host) return;
        const { npcs, facilities } = buildInteractablesForPanel();
        if (!npcs.length && !facilities.length) {
            host.style.display = "none";
            host.innerHTML = "";
            return;
        }
        host.style.display = "block";
        const npcRows = npcs.length
            ? npcs.map((n) => {
                const v = encodeURIComponent(n.name);
                return `<button type="button" class="cyoa-btn cyoa-btn-secondary" ${n.blocked ? "disabled" : ""} style="padding:2px 8px; font-size:11px;" onclick="CYOA.quickInteractNpc(decodeURIComponent('${v}'))">${escapeHtml(n.name)}${n.reason ? ` · ${escapeHtml(n.reason)}` : ""}</button>`;
            }).join("")
            : `<span style="font-size:11px;color:var(--text-light);">${isZhLocale() ? "暂无可互动NPC" : "No interactable NPCs"}</span>`;
        const facRows = facilities.length
            ? facilities.map((f) => {
                const v = encodeURIComponent(f.name);
                return `<button type="button" class="cyoa-btn cyoa-btn-secondary" ${f.blocked ? "disabled" : ""} style="padding:2px 8px; font-size:11px;" onclick="CYOA.quickInteractFacility(decodeURIComponent('${v}'))">${escapeHtml(f.name)}${f.reason ? ` · ${escapeHtml(f.reason)}` : ""}</button>`;
            }).join("")
            : `<span style="font-size:11px;color:var(--text-light);">${isZhLocale() ? "暂无可互动设施" : "No interactable facilities"}</span>`;
        host.innerHTML = `
            <div style="font-size:12px; font-weight:600; margin-bottom:6px;">${isZhLocale() ? "可互动目标" : "Interactables"}</div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; align-items:start;">
                <div>
                    <div style="font-size:11px; font-weight:600; margin-bottom:4px;">${isZhLocale() ? "在场NPC" : "NPCs present"}</div>
                    <div style="display:flex; flex-wrap:wrap; gap:6px;">${npcRows}</div>
                </div>
                <div>
                    <div style="font-size:11px; font-weight:600; margin-bottom:4px;">${isZhLocale() ? "可互动设施" : "Facilities"}</div>
                    <div style="display:flex; flex-wrap:wrap; gap:6px;">${facRows}</div>
                </div>
            </div>
        `;
    }
    CYOA.renderInteractPanel = renderInteractPanel;

    CYOA.quickInteractNpc = function(name) {
        const target = String(name || "").trim();
        if (!target) return;
        const speechBlocked = isSpeechBlockedByConstraint();
        if (speechBlocked) {
            const msg = document.getElementById("gameMsg");
            if (msg) msg.value = isZhLocale() ? `观察${target}的反应并尝试靠近互动` : `Observe ${target}'s reaction and approach carefully`;
        } else {
            const speech = document.getElementById("gameSpeech");
            if (speech) speech.value = isZhLocale() ? `向${target}询问当前情况` : `Ask ${target} about the current situation`;
        }
    };

    CYOA.quickInteractFacility = function(name) {
        const target = String(name || "").trim();
        if (!target) return;
        const msg = document.getElementById("gameMsg");
        if (!msg) return;
        msg.value = isZhLocale() ? `与${target}进行互动并检查可用线索` : `Interact with ${target} and inspect available clues`;
    };

    CYOA._bindInputKeyHandler = function() {
        const msg = document.getElementById("gameMsg");
        const speech = document.getElementById("gameSpeech");
        syncSpeechInputConstraintState();
        renderInteractPanel();
        document.querySelectorAll("#cyoaDirectionPad [data-cyoa-dir]").forEach((btn) => {
            if (!btn || btn.dataset.bound === "1") return;
            btn.dataset.bound = "1";
            btn.addEventListener("click", () => {
                if (CYOA._sendingGameMsg) return;
                const dir = String(btn.getAttribute("data-cyoa-dir") || "");
                CYOA.quickMoveByDirection?.(dir);
            });
        });
        [msg, speech].forEach(el => {
            if (!el || el.dataset.bound === "1") return;
            el.dataset.bound = "1";
            el.addEventListener("keydown", (e) => {
                if (e.key === "Enter" && !e.ctrlKey && !e.shiftKey) {
                    e.preventDefault();
                    CYOA.sendGameMessage?.();
                }
            });
        });

        // 兜底键盘支持：回车发送 + 数字键 1~4 直选项
        if (document.body.dataset.cyoaGlobalKeyBound !== "1") {
            document.body.dataset.cyoaGlobalKeyBound = "1";
            document.addEventListener("keydown", (e) => {
                if (!CYOA.currentGame || !CYOA.currentSave) return;
                const ae = document.activeElement;
                const inGameInput = ae && (ae.id === "gameMsg" || ae.id === "gameSpeech");
                if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey && inGameInput) {
                    e.preventDefault();
                    CYOA.sendGameMessage?.();
                    return;
                }
                if (!inGameInput && !e.ctrlKey && !e.altKey && !e.metaKey && /^[1-4]$/.test(e.key)) {
                    const idx = Number(e.key) - 1;
                    if (Array.isArray(CYOA._gameOptionCache) && CYOA._gameOptionCache[idx]) {
                        e.preventDefault();
                        CYOA.selectGameOption?.(idx);
                    }
                }
            }, true);
        }

        // 终极兜底：游戏模式时阻止宿主页面 form submit 导致跳转
        if (document.body.dataset.cyoaSubmitGuardBound !== "1") {
            document.body.dataset.cyoaSubmitGuardBound = "1";
            document.addEventListener("submit", (e) => {
                if (!CYOA.currentGame || !CYOA.currentSave) return;
                e.preventDefault();
                e.stopPropagation();
                const action = (document.getElementById("gameMsg")?.value || "").trim();
                const speech = (document.getElementById("gameSpeech")?.value || "").trim();
                if (action || speech) CYOA.sendGameMessage?.();
            }, true);
        }
    };

    CYOA.selectGameOption = function(idx) {
        if (CYOA._sendingGameMsg) return;
        const options = Array.isArray(CYOA._gameOptionCache) ? CYOA._gameOptionCache : [];
        const pick = options[idx];
        if (!pick) return;
        const isAction = pick.type === "action";
        const targetId = isAction ? "gameMsg" : "gameSpeech";
        const input = document.getElementById(targetId);
        if (!input) return;
        input.value = pick.label || "";
        CYOA.sendGameMessage?.();
    };

    CYOA.sendGameMessage = async function() {
        function isAIPipelineDebugEnabled() {
            if (CYOA.CONFIG?.DEBUG) return true;
            try {
                return localStorage.getItem("cyoa_debug_ai_pipeline") === "1";
            } catch (_) {
                return false;
            }
        }

        function debugAIPipelineLog(payload) {
            if (!isAIPipelineDebugEnabled()) return;
            try {
                console.info("[CYOA][AI PIPELINE]", payload);
            } catch (_) {}
        }

        function getChatModelPool() {
            const all = Array.isArray(window.allModels) ? window.allModels : [];
            const chatFromAll = all.filter(m => String(m?.type || "").toLowerCase() === "chat");
            const chatFromMain = (typeof MainApp !== "undefined" && typeof MainApp.getModels === "function")
                ? (MainApp.getModels("chat") || [])
                : [];
            return [...chatFromAll, ...chatFromMain]
                .map(m => String(m?.value || "").trim())
                .filter(Boolean)
                .filter((v, i, arr) => arr.indexOf(v) === i);
        }

        function resolveChatModelForGame() {
            const current = String(window.gameModeModel || document.getElementById("model")?.value || "").trim();
            const chatPool = getChatModelPool();
            if (!chatPool.length) return "";

            const currentIsChat = chatPool.includes(current);
            if (currentIsChat) return current;

            const providerId = current.includes("::") ? current.split("::")[0] : "";
            const sameProvider = chatPool.find(v => providerId && v.startsWith(providerId + "::"));
            const picked = sameProvider || chatPool[0];

            // 与界面同步，避免后续又被错误模型污染
            const modelEl = document.getElementById("model");
            if (modelEl && picked) modelEl.value = picked;
            return picked;
        }

        function pickBackupChatModel(currentModel) {
            const pool = getChatModelPool();
            return pool.find(m => m !== currentModel) || "";
        }

        function isLikelyCorruptedReply(text) {
            const s = String(text || "").trim();
            if (!s) return true;
            const lines = s.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
            const badLineCount = lines.filter(line =>
                /(?:\bTRACE\b|\bSTART\b|\bSTOP\b|errorCode|reported|Performance\s*输入|女性,\s*Performance|\\begin\{aligned\}|[A-Za-z]{2,}_[A-Za-z0-9_]{2,}|v_ID\b|https?:\/\/|www\.|\.mp3\b|\.wav\b|\.png\b|\.jpg\b|\.zip\b)/i.test(line)
            ).length;
            const latin = (s.match(/[A-Za-z]/g) || []).length;
            const zh = (s.match(/[\u4e00-\u9fff]/g) || []).length;
            const noisyPunctuation = (s.match(/[\\{}_^$|`~]/g) || []).length;
            const crossScriptNoise = (s.match(/[\u0370-\u03FF\u0400-\u04FF\u0600-\u06FF\u0E00-\u0E7F]/g) || []).length;
            const longLatinWords = (s.match(/\b[A-Za-z]{6,}\b/g) || []).length;
            const hasTypedOptions = /^[ \t]*[（(]\s*(行动|对话|Action|Dialogue)\s*[）)]/im.test(s);

            // 中文模式下：出现大量英文技术碎片/跨语种字符且没有选项结构，视为污染
            const zhModeMixedNoise = isZhLocale()
                && !hasTypedOptions
                && (
                    (latin > 70 && zh < 140)
                    || (longLatinWords >= 8 && zh < 180)
                    || (crossScriptNoise >= 4)
                );

            return badLineCount >= 2
                || (latin > zh * 2 && noisyPunctuation > 10)
                || zhModeMixedNoise;
        }

        function detectChapterDrift(text, game, save) {
            const s = String(text || "").trim();
            if (!s || !game || !save) return { drift: false, hit: "" };
            const curId = String(save.currentChapter || "").trim();
            const chapters = Array.isArray(game.chapters) ? game.chapters : [];
            const current = chapters.find(c => String(c?.id || "") === curId);
            const candidates = chapters
                .filter(c => String(c?.id || "") !== curId)
                .map(c => String(c?.title || c?.name || "").trim())
                .filter(Boolean)
                .filter(v => v.length >= 2);
            for (let i = 0; i < candidates.length; i += 1) {
                const title = candidates[i];
                if (s.includes(title)) return { drift: true, hit: title, currentTitle: String(current?.title || curId || "") };
            }
            return { drift: false, hit: "", currentTitle: String(current?.title || curId || "") };
        }

        function detectLocationDrift(text, game, save) {
            const s = String(text || "").trim();
            if (!s || !game || !save) return { drift: false, hit: "" };
            const curId = String(save.currentLocation || "").trim();
            const locations = Array.isArray(game.locations) ? game.locations : [];
            const current = locations.find(l => String(l?.id || "") === curId);
            const candidates = locations
                .filter(l => String(l?.id || "") !== curId)
                .map(l => String(l?.name || l?.id || "").trim())
                .filter(Boolean)
                .filter(v => v.length >= 2);
            for (let i = 0; i < candidates.length; i += 1) {
                const name = candidates[i];
                if (s.includes(name)) return { drift: true, hit: name, currentName: String(current?.name || curId || "") };
            }
            return { drift: false, hit: "", currentName: String(current?.name || curId || "") };
        }

        function detectCharacterDrift(text, game, strictFrame) {
            const s = String(text || "").trim();
            if (!s || !game) return { drift: false, hit: "" };
            const present = new Set((Array.isArray(strictFrame?.presentCharacters) ? strictFrame.presentCharacters : [])
                .map(v => String(v || "").trim())
                .filter(Boolean));
            const allNames = (Array.isArray(game?.characters) ? game.characters : [])
                .map(ch => String(ch?.name || ch?.id || "").trim())
                .filter(Boolean)
                .filter(v => v.length >= 2);
            const candidates = allNames.filter(v => !present.has(v));
            for (let i = 0; i < candidates.length; i += 1) {
                const name = candidates[i];
                if (s.includes(name)) {
                    return {
                        drift: true,
                        hit: name,
                        allowed: Array.from(present).slice(0, 8)
                    };
                }
            }
            return { drift: false, hit: "", allowed: Array.from(present).slice(0, 8) };
        }

        function detectCapabilityOverreach(text, activeConstraints, context) {
            const raw = String(text || "").trim();
            const s = raw.toLowerCase();
            if (!s) return { drift: false, reasons: [] };
            const constraints = activeConstraints instanceof Set ? activeConstraints : new Set(activeConstraints || []);
            const reasons = [];
            const actionText = String(context?.actionText || "").trim().toLowerCase();
            const lines = raw.split(/\r?\n/)
                .map(x => String(x || "").trim())
                .filter(Boolean)
                // 选项行经常包含“尝试动作”，不应当作已执行越权
                .filter(line => !/^[（(]\s*(行动|对话|action|dialogue)\s*[）)]/i.test(line));
            // 新选项样式（无前缀）时，去掉末尾四条选项文本，避免被误判为“已执行动作”
            const picked = pickFourOptions(raw);
            const optionSet = new Set(picked.map(x => String(x?.label || "").trim()).filter(Boolean));
            const filteredLines = lines.filter(line => !optionSet.has(String(line || "").trim()));
            const body = filteredLines.join("\n");
            const bodyLower = body.toLowerCase();
            const hasNonNegatedMatch = (re) => {
                try {
                    const source = new RegExp(re.source, re.flags.includes("g") ? re.flags : (re.flags + "g"));
                    let m;
                    while ((m = source.exec(bodyLower)) !== null) {
                        const hit = m[0] || "";
                        const idx = Number(m.index || 0);
                        const left = bodyLower.slice(Math.max(0, idx - 8), idx);
                        const right = bodyLower.slice(idx + hit.length, Math.min(bodyLower.length, idx + hit.length + 10));
                        // 否定、受阻、失败语境视为“合规描述”，不触发越权
                        if (/(不|没|未|无法|不能|难以|受限|被迫|blocked|cannot|can't|unable|failed|fail|prevented)\s*$/.test(left)) continue;
                        if (/^(不|没|未|无法|不能|失败|受阻|blocked|cannot|can't|unable|failed)/.test(right)) continue;
                        return true;
                    }
                } catch (_) {}
                return false;
            };
            const RE = {
                hand: /(抓|握|拿|捡|拣|拾|取|接住?|抛|扔|丢|投掷|开门|开锁|拧|擦拭|刮|刻|按下?|按键|pull|grab|grip|pick\s*up|take|catch|throw|toss|unlock|open|turn|twist|wipe|scratch|press)/i,
                fineFinger: /(手指|指尖|捏|拨|扣|系|解开|穿针|写|刻|button|buckle|pick\s*lock|type|pinch|thread|unfasten|lace|dial)/i,
                speech: /(说|开口|喊|高呼|清晰地说|回答道|低语|speak|say|shout|yell|whisper|reply)/i,
                vision: /(看见|看到|观察到|辨认|读唇|看清|look|see|watch|observe|spot|recognize|lipread)/i,
                fastMove: /(奔跑|冲刺|快步|大步|跳|跃|run|sprint|dash|jump|leap|long stride)/i
            };
            if (constraints.has("no_hands") && hasNonNegatedMatch(RE.hand)) reasons.push("no_hands");
            if (constraints.has("no_fingers") && hasNonNegatedMatch(RE.fineFinger)) reasons.push("no_fingers");
            if ((constraints.has("mute") || constraints.has("forced_open_mouth")) && hasNonNegatedMatch(RE.speech)) reasons.push("mute_or_forced_open_mouth");
            if ((constraints.has("blind") || constraints.has("vision_restricted")) && hasNonNegatedMatch(RE.vision)) reasons.push("blind_or_vision_restricted");
            if (constraints.has("limited_step") && hasNonNegatedMatch(RE.fastMove)) reasons.push("limited_step");
            // 轻度放宽：当玩家本回合是“移动/观察/倾听”等非手部操作时，
            // 单一 no_hands/no_fingers 命中不立刻纠偏，避免过度打断叙事。
            if (reasons.length === 1 && (reasons[0] === "no_hands" || reasons[0] === "no_fingers")) {
                const isMobilityOrObserveAction = /(移动|挪动|走|站|观察|查看|环顾|倾听|呼吸|move|step|walk|stand|observe|look|listen|breathe)/i.test(actionText);
                if (isMobilityOrObserveAction) return { drift: false, reasons: [] };
            }
            return { drift: reasons.length > 0, reasons: Array.from(new Set(reasons)) };
        }

        function buildSafeFallbackReply(save) {
            const loc = String(
                save?.playerState?.currentLocationName
                || save?.playerState?.locationName
                || save?.playerState?.location
                || save?.meta?.currentLocation
                || ""
            ).trim();
            if (isZhLocale()) {
                const lead = loc
                    ? `你短暂整理思绪，重新确认了当前位置（${loc}）并保持警惕。`
                    : "你短暂整理思绪，确认当前局势后继续谨慎推进。";
                return [
                    lead,
                    "环境中仍有可利用线索，你需要选择更稳妥的下一步。",
                    "",
                    "观察周围环境",
                    "尝试推进当前目标",
                    "询问关键线索",
                    "试探对方反应"
                ].join("\n");
            }
            return [
                "You take a breath, reassess the situation, and proceed carefully.",
                "",
                "Scan the surroundings",
                "Push the objective forward",
                "Ask for key clues",
                "Probe the counterpart's reaction"
            ].join("\n");
        }

        async function requestChatOnce(model, guardPrompt, prompt, userPayload, onPartialRaw) {
            const modelTuning = String(CYOA.getModelTuningPrompt?.(model) || "").trim();
            const tunedSystemPrompt = modelTuning
                ? `${guardPrompt}\n\n${prompt}\n\n[Model-specific tuning]\n${modelTuning}`
                : `${guardPrompt}\n\n${prompt}`;
            const r = await fetch("ai_proxy.php", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    client: "cyoa",
                    bypassCostOptimizer: !!CYOA.CONFIG?.AI_BYPASS_COST_OPTIMIZER,
                    model,
                    task: "chat",
                    messages: [
                        { role: "system", content: tunedSystemPrompt },
                        { role: "user", content: userPayload }
                    ],
                    stream: true
                })
            });
            if (!r.ok) throw new Error(`AI request failed: HTTP ${r.status}`);
            let aiRawText = "";
            let rawCollected = "";
            if (r.body && typeof r.body.getReader === "function") {
                const reader = r.body.getReader();
                const decoder = new TextDecoder("utf-8");
                let buffer = "";
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    const chunkText = decoder.decode(value, { stream: true });
                    rawCollected += chunkText;
                    buffer += chunkText;
                    const lines = buffer.split(/\r?\n/);
                    buffer = lines.pop() || "";
                    lines.forEach((line) => {
                        const trimmed = String(line || "").trim();
                        if (!trimmed.startsWith("data:")) return;
                        const data = trimmed.replace(/^data:\s*/, "");
                        if (!data || data === "[DONE]") return;
                        try {
                            const parsed = JSON.parse(data);
                            const deltaText = String(
                                parsed?.choices?.[0]?.delta?.content
                                || parsed?.choices?.[0]?.message?.content
                                || parsed?.choices?.[0]?.text
                                || parsed?.message?.content
                                || parsed?.content
                                || ""
                            );
                            if (!deltaText) return;
                            aiRawText += deltaText;
                            if (typeof onPartialRaw === "function") onPartialRaw(aiRawText);
                        } catch (_) {
                            // ignore non-JSON SSE fragments
                        }
                    });
                }
                rawCollected += decoder.decode();
                if (!aiRawText && rawCollected.trim()) {
                    try {
                        const d = JSON.parse(rawCollected);
                        aiRawText = String(
                            d?.choices?.[0]?.message?.content
                            || d?.choices?.[0]?.text
                            || d?.message?.content
                            || d?.content
                            || ""
                        );
                    } catch (_) {
                        aiRawText = rawCollected;
                    }
                }
            } else {
                const rawText = await r.text();
                rawCollected = rawText;
                try {
                    const d = JSON.parse(rawText);
                    aiRawText = String(
                        d?.choices?.[0]?.message?.content
                        || d?.choices?.[0]?.text
                        || d?.message?.content
                        || d?.content
                        || ""
                    );
                } catch (_) {
                    aiRawText = rawText;
                }
            }
            aiRawText = String(aiRawText || "").trim() || "（无回复）";
            const aiText = sanitizeAITextForDisplay(aiRawText) || "（无回复）";
            const meta = {
                httpStatus: Number(r.status || 0),
                bypassCost: String(r.headers.get("x-cyoa-bypass-cost") || "") === "1",
                costPipeline: String(r.headers.get("x-cyoa-cost-pipeline") || "") === "1",
                cacheHit: String(r.headers.get("x-cyoa-cache-hit") || "") === "1" || String(r.headers.get("x-cache-hit") || "").toLowerCase() === "true"
            };
            return { aiRawText, aiText, meta };
        }

        const game = CYOA.currentGame;
        const save = CYOA.currentSave;
        if (!game || !save) return;
        if (CYOA._sendingGameMsg) return;
        try { CYOA.repairCurrentSave?.(); } catch (_) {}

        const actionEl = document.getElementById("gameMsg");
        const speechEl = document.getElementById("gameSpeech");
        syncSpeechInputConstraintState();
        const actionRaw = (actionEl?.value || "").trim();
        const speechRaw = (speechEl?.value || "").trim();
        let speech = speechRaw;
        const activeConstraints = CYOA.getActiveConstraints?.() || new Set();
        const action = normalizeActionByConstraints(actionRaw, activeConstraints);
        if (speech) {
            if (activeConstraints.has("forced_open_mouth")) {
                speech = String(t("ui.constraint.gaggedSpeech") || "（嘴被口枷塞住，说话含糊不清）");
            } else if (activeConstraints.has("mute")) {
                speech = String(t("ui.constraint.mutedSpeech") || "（被禁言状态，无法说话）");
            } else if (activeConstraints.has("breath_restrict") && speech.length > 18) {
                speech = isZhLocale()
                    ? "（呼吸受限，只能以短促气声回应）"
                    : "(Breath restricted, only a short strained reply is possible)";
            }
        }
        if (!action && !speech) return;
        CYOA._sendingGameMsg = true;
        CYOA._gameMsgSeq = Number(CYOA._gameMsgSeq || 0) + 1;
        const seq = CYOA._gameMsgSeq;
        setGameInputBusy(true);
        if (actionEl) actionEl.value = "";
        if (speechEl) speechEl.value = "";

        // 语言按“剧本内容”自动判定，不跟随界面语言
        CYOA._storyLocale = detectStoryLocale(game, save, `${action}\n${speech}`);
        const userText = [action ? `${action}` : "", speech ? `${speech}` : ""].filter(Boolean).join("\n");
        CYOA.bumpObserverAlert?.("ai_input", userText);

        const loc = (game.locations || []).find(l => l.id === save.currentLocation);
        const curChapter = (game.chapters || []).find(c => c.id === save.currentChapter);
        const region = CYOA.getRegionByLocation?.(save.currentLocation);
        const strictFrame = buildStrictFrame(game, save, loc, region);
        appendBubble("user", userText, { avatarUrl: getPlayerAvatarUrl() });
        const assistantBubble = createAssistantBubbleShell({
            avatarUrl: getNarratorAvatarUrl(),
            npcAvatars: getNpcAvatarList(strictFrame)
        });
        const state = {
            player: save.playerCharacter || "玩家",
            location: loc?.name || save.currentLocation || "",
            region: region?.name || "",
            chapter: curChapter?.title || save.currentChapter || "",
            posture: save.posture || "standing"
        };
        const recent = (save.history || []).slice(-10).map(x => `[${x.role}] ${x.content}`).join("\n");
        const skillState = Array.isArray(save.skills)
            ? save.skills.slice(0, 8).map(s => `${s.name || s.id}(LV${s.level || 1}, ${s.proficiency || 0})`).join(", ")
            : "";
        const activeCards = getActiveStoryCards(game, save, userText, recent);
        const storyCardBlock = formatStoryCardContext(activeCards);
        const ragBlock = String(CYOA.generateRAG?.() || CYOA.getRAG?.() || "").trim();
        const charProfileBlock = Array.isArray(strictFrame?.characterProfiles) ? strictFrame.characterProfiles.join("\n") : "";
        const userPayload = isZhLocale()
            ? `【游戏】${game.name || "CYOA"}\n【故事简介】${game.synopsis || ""}\n【世界观】${game.worldSetting || ""}\n【背景】${game.background || game.settingBackground || game.coreMechanics || ""}\n【当前章节】${curChapter?.title || save.currentChapter || "未设置"}\n【当前地点】${loc?.name || save.currentLocation || "未设置"}\n【状态】${JSON.stringify(state)}\n【技能】${skillState || "无"}\n【人物档案约束】\n${charProfileBlock || "无"}\n【叙事一致性裁决】世界/环境/线索/结果叙述必须服从在场人物档案与能力边界，人物做不到的事情不得写成已发生。\n【硬边界事实框架】${JSON.stringify(strictFrame)}\n【RAG记忆库】\n${ragBlock || "无"}\n【Lore卡】\n${storyCardBlock || "无"}\n【最近】\n${recent}\n【输入】\n${userText}`
            : `[Game] ${game.name || "CYOA"}\n[StorySynopsis] ${game.synopsis || ""}\n[WorldSetting] ${game.worldSetting || ""}\n[Background] ${game.background || game.settingBackground || game.coreMechanics || ""}\n[CurrentChapter] ${curChapter?.title || save.currentChapter || "unset"}\n[CurrentLocation] ${loc?.name || save.currentLocation || "unset"}\n[State] ${JSON.stringify(state)}\n[Skills] ${skillState || "none"}\n[CharacterProfileConstraints]\n${charProfileBlock || "none"}\n[NarrativeConsistencyGate] World/environment/clue/outcome narration must obey present-character profiles and capability bounds; impossible actions must not be narrated as completed outcomes.\n[HardBoundaryFrame] ${JSON.stringify(strictFrame)}\n[RAG]\n${ragBlock || "none"}\n[LoreCards]\n${storyCardBlock || "none"}\n[Recent]\n${recent}\n[Input]\n${userText}`;
        const prompt = game.narrator?.prompt || (isZhLocale()
            ? "你是 CYOA 叙述者。回复剧情后必须给出4个选项：2个行动、2个对话。"
            : "You are the CYOA narrator. After each response, provide exactly 4 options: 2 actions and 2 dialogues.");
        const constraintDetails = CYOA.getActiveConstraintDetails?.() || { active: Array.from(activeConstraints || []), sources: {} };
        const guardPrompt = (CYOA.GamePrompts && typeof CYOA.GamePrompts.getGuardPrompt === "function")
            ? CYOA.GamePrompts.getGuardPrompt(isZhLocale(), activeConstraints, { game, save, actionText: action, constraintDetails, strictFrame })
            : (isZhLocale()
                ? "你是 CYOA 叙述者。必须严格遵守设定，并在每次回复末尾给出 2 行行动 + 2 行对话选项。"
                : "You are the CYOA narrator. Follow canon strictly and end each reply with 2 action + 2 dialogue options.");

        try {
            CYOA._pendingNodeChangeMeta = null;
            const model = resolveChatModelForGame();
            if (!model) throw new Error("未找到可用的聊天模型（chat）");
            if (model) window.gameModeModel = model;
            let { aiRawText, aiText, meta } = await requestChatOnce(model, guardPrompt, prompt, userPayload, (partialRaw) => {
                if (seq !== CYOA._gameMsgSeq || !CYOA.currentGame || !CYOA.currentSave) return;
                const partialText = sanitizeAITextForDisplay(partialRaw) || "…";
                setAssistantBubbleText(assistantBubble, partialText);
            });
            const driftInfo = detectChapterDrift(aiText, game, save);
            if (driftInfo.drift) {
                const clamp = isZhLocale()
                    ? `\n\n【系统纠偏】你的上一条回复提到了不属于当前章节的内容（命中：${driftInfo.hit}）。必须严格回到当前章节“${driftInfo.currentTitle || save.currentChapter || "当前章节"}”与当前地点继续叙事，不要新增跨章节信息；同时不得添加世界观/背景/人物设定中未出现的新事实。`
                    : `\n\n[System correction] Your previous reply referenced out-of-chapter content (hit: ${driftInfo.hit}). Continue strictly within current chapter "${driftInfo.currentTitle || save.currentChapter || "current chapter"}" and current location; do not introduce facts outside defined world/background/character canon.`;
                setAssistantBubbleText(assistantBubble, isZhLocale() ? "（检测到章节偏航，正在纠偏重试…）" : "(Chapter drift detected, retrying with correction...)");
                const retriedByChapter = await requestChatOnce(model, guardPrompt, prompt, userPayload + clamp, (partialRaw) => {
                    if (seq !== CYOA._gameMsgSeq || !CYOA.currentGame || !CYOA.currentSave) return;
                    const partialText = sanitizeAITextForDisplay(partialRaw) || "…";
                    setAssistantBubbleText(assistantBubble, partialText);
                });
                aiRawText = retriedByChapter.aiRawText;
                aiText = retriedByChapter.aiText;
                meta = retriedByChapter.meta;
                debugAIPipelineLog({
                    stage: "retry_chapter_drift",
                    hit: driftInfo.hit,
                    currentChapter: driftInfo.currentTitle || save.currentChapter || "",
                    responseMeta: meta
                });
            }
            const locationDrift = detectLocationDrift(aiText, game, save);
            if (locationDrift.drift) {
                const clampLoc = isZhLocale()
                    ? `\n\n【系统纠偏】你的上一条回复提到了不属于当前地点的内容（命中：${locationDrift.hit}）。必须严格回到当前地点“${locationDrift.currentName || save.currentLocation || "当前地点"}”内叙事，不得扩展到其他地点；并且不得添加未在当前设定清单中的地名、设施、组织与事件。`
                    : `\n\n[System correction] Your previous reply referenced another location (hit: ${locationDrift.hit}). Continue strictly within current location "${locationDrift.currentName || save.currentLocation || "current location"}"; do not add off-frame places, facilities, groups, or events.`;
                setAssistantBubbleText(assistantBubble, isZhLocale() ? "（检测到地点偏航，正在纠偏重试…）" : "(Location drift detected, retrying with correction...)");
                const retriedByLocation = await requestChatOnce(model, guardPrompt, prompt, userPayload + clampLoc, (partialRaw) => {
                    if (seq !== CYOA._gameMsgSeq || !CYOA.currentGame || !CYOA.currentSave) return;
                    const partialText = sanitizeAITextForDisplay(partialRaw) || "…";
                    setAssistantBubbleText(assistantBubble, partialText);
                });
                aiRawText = retriedByLocation.aiRawText;
                aiText = retriedByLocation.aiText;
                meta = retriedByLocation.meta;
                debugAIPipelineLog({
                    stage: "retry_location_drift",
                    hit: locationDrift.hit,
                    currentLocation: locationDrift.currentName || save.currentLocation || "",
                    responseMeta: meta
                });
            }
            const characterDrift = detectCharacterDrift(aiText, game, strictFrame);
            if (characterDrift.drift) {
                const allowList = (characterDrift.allowed || []).join(isZhLocale() ? "、" : ", ");
                const clampChar = isZhLocale()
                    ? `\n\n【系统纠偏】你的上一条回复提到了未在场人物（命中：${characterDrift.hit}）。你只能使用当前在场人物清单：${allowList || "无"}。不得引入未在场角色，也不得改写在场角色的人设、能力和背景事实。`
                    : `\n\n[System correction] Your previous reply referenced a character not present (hit: ${characterDrift.hit}). You can only use currently present characters: ${allowList || "none"}. Do not introduce off-scene characters or alter established profile/ability/background facts.`;
                setAssistantBubbleText(assistantBubble, isZhLocale() ? "（检测到人物越界，正在纠偏重试…）" : "(Character scope drift detected, retrying with correction...)");
                const retriedByCharacter = await requestChatOnce(model, guardPrompt, prompt, userPayload + clampChar, (partialRaw) => {
                    if (seq !== CYOA._gameMsgSeq || !CYOA.currentGame || !CYOA.currentSave) return;
                    const partialText = sanitizeAITextForDisplay(partialRaw) || "…";
                    setAssistantBubbleText(assistantBubble, partialText);
                });
                aiRawText = retriedByCharacter.aiRawText;
                aiText = retriedByCharacter.aiText;
                meta = retriedByCharacter.meta;
                debugAIPipelineLog({
                    stage: "retry_character_drift",
                    hit: characterDrift.hit,
                    allowed: characterDrift.allowed || [],
                    responseMeta: meta
                });
            }
            // 用户要求放开“能力越权自动纠偏”：这里只记录命中，不再触发重试。
            const capabilityDrift = detectCapabilityOverreach(aiText, activeConstraints, { actionText: action });
            if (capabilityDrift.drift) {
                debugAIPipelineLog({
                    stage: "capability_drift_detected_no_retry",
                    reasons: capabilityDrift.reasons || [],
                    responseMeta: meta
                });
            }
            let invalidReply = isLikelyCorruptedReply(aiText);
            debugAIPipelineLog({
                stage: "first_try",
                model,
                invalidReply,
                responseMeta: meta
            });
            if (invalidReply) {
                const backup = pickBackupChatModel(model);
                if (backup) {
                    window.gameModeModel = backup;
                    const modelEl = document.getElementById("model");
                    if (modelEl) modelEl.value = backup;
                    setAssistantBubbleText(assistantBubble, isZhLocale() ? "（检测到异常回复，正在切换模型重试…）" : "(Reply looked invalid, retrying with backup model...)");
                    const retried = await requestChatOnce(backup, guardPrompt, prompt, userPayload, (partialRaw) => {
                        if (seq !== CYOA._gameMsgSeq || !CYOA.currentGame || !CYOA.currentSave) return;
                        const partialText = sanitizeAITextForDisplay(partialRaw) || "…";
                        setAssistantBubbleText(assistantBubble, partialText);
                    });
                    aiRawText = retried.aiRawText;
                    aiText = retried.aiText;
                    meta = retried.meta;
                    debugAIPipelineLog({
                        stage: "retry_backup_model",
                        fromModel: model,
                        toModel: backup,
                        invalidReply: isLikelyCorruptedReply(aiText),
                        responseMeta: meta
                    });
                }
            }
            invalidReply = isLikelyCorruptedReply(aiText);
            const allowStateChangeApply = !invalidReply;
            if (invalidReply) {
                aiRawText = "";
                aiText = buildSafeFallbackReply(save);
                debugAIPipelineLog({
                    stage: "fallback_reply",
                    reason: "invalid_or_polluted_ai_reply",
                    responseMeta: meta
                });
            }
            if (seq !== CYOA._gameMsgSeq || !CYOA.currentGame || !CYOA.currentSave) return;
            const normalizedAiText = enforceFourOptionLines(aiText);
            const filteredAiText = CYOA.applySensoryFilters?.(normalizedAiText) || normalizedAiText;
            if (!Array.isArray(save.history)) save.history = [];
            save.history.push({ role: "user", content: userText });
            save.history.push({ role: "assistant", content: filteredAiText });
            if (save.history.length > 200) save.history = save.history.slice(-200);
            if (allowStateChangeApply && aiRawText) {
                try { CYOA.parseAndApplyItemChanges?.(aiRawText); } catch (_) {}
                try { CYOA.checkQuestProgress?.(aiRawText); } catch (_) {}
            }
            CYOA.progressSkillsFromInput?.(userText);
            // 每轮输入后推进系统状态，确保各面板数值可测试
            CYOA.updateAllSystems?.();
            CYOA.applyPassiveSystems?.();
            CYOA.commitTurnNode?.(userText, filteredAiText);
            CYOA.persistSave?.();
            const displayAiText = stripOptionTypeTagsForDisplay(filteredAiText);
            setAssistantBubbleText(assistantBubble, displayAiText);
            renderOptionsFromText(filteredAiText);
            renderInteractPanel();
        } catch (e) {
            setAssistantBubbleText(assistantBubble, `AI 请求失败：${e.message || String(e)}`);
        } finally {
            if (seq === CYOA._gameMsgSeq) {
                CYOA._sendingGameMsg = false;
                setGameInputBusy(false);
                syncSpeechInputConstraintState();
            }
        }

        CYOA.renderSidebar?.();
    };
    CYOA.GameUI = CYOA.GameUI || {};
    CYOA.GameUI.renderGameLogFromNode = CYOA.renderGameLogFromNode;
    CYOA.GameUI.refreshOptionsFromCurrentNode = CYOA.refreshOptionsFromCurrentNode;
    CYOA.GameUI.renderGameOptions = CYOA.renderGameOptions;
    CYOA.GameUI.renderGameControls = CYOA.renderGameControls;
    CYOA.GameUI.bindInputKeyHandler = CYOA._bindInputKeyHandler;
    CYOA.GameUI.selectGameOption = CYOA.selectGameOption;
    CYOA.GameUI.sendGameMessage = CYOA.sendGameMessage;
    CYOA.GameUI.sanitizeAITextForDisplay = sanitizeAITextForDisplay;
    CYOA.GameUI.extractOptions = CYOA.extractOptions;
    CYOA.GameUI.jumpToNode = CYOA.jumpToNode;
})();
