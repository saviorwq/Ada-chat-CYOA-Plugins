/**
 * CYOA Game Systems Module (Phase 1 scaffold)
 * 装备/技能/任务等系统模块（第一阶段骨架）
 */
(function() {
    const CYOA = window.CYOA;
    if (!CYOA || !CYOA.CONFIG) return;

    CYOA.GameSystems = CYOA.GameSystems || {};
    CYOA.GameSystems.__moduleName = 'systems';
    CYOA.GameSystems.__ready = true;
})();
/* Systems module for equipment/state helpers */
(function() {
    const CYOA = window.CYOA;
    if (!CYOA || !CYOA.CONFIG) return;

    function getEquippedEntries(save) {
        const eq = save?.equipment;
        if (!eq) return [];
        if (Array.isArray(eq)) return eq.filter(Boolean);
        if (typeof eq === "object") return Object.values(eq).filter(Boolean);
        return [];
    }

    function getEquipDefById(game, id) {
        return (game?.equipment || []).find(e => e.id === id) || null;
    }

    function getDurabilityPair(item, def) {
        const max = Number(item?.maxDurability ?? def?.maxDurability ?? def?.durability ?? item?.durability ?? 0);
        const cur = Number(item?.durability ?? def?.durability ?? 0);
        return { cur, max };
    }

    function getObserverThreshold(val) {
        const cfg = CYOA.CONFIG?.OBSERVER_ALERT_CONFIG || {};
        const list = Array.isArray(cfg.thresholds) ? cfg.thresholds : [];
        let hit = null;
        list.forEach(t => {
            if (val >= Number(t?.value || 0)) hit = t;
        });
        return hit;
    }

    function pickRandom(arr) {
        if (!Array.isArray(arr) || !arr.length) return "";
        return arr[Math.floor(Math.random() * arr.length)] || "";
    }

    function normalizeMaterialKey(raw) {
        const s = String(raw || "").trim().toLowerCase();
        if (!s) return "";
        const map = CYOA.CONFIG?.MATERIAL_ALIASES || {};
        return String(map[s] || s);
    }

    function isArmorLikeEquip(entry, def) {
        const role = String(entry?.narrativeRole || def?.narrativeRole || "").trim().toLowerCase();
        if (role === "armor") return true;
        if (role === "restraint") return false;
        const name = String(entry?.name || def?.name || "").toLowerCase();
        const equipType = String(entry?.equipType || def?.equipType || "").toLowerCase();
        const category = String(entry?.category || def?.category || "").toLowerCase();
        const armorKw = /(armor|armour|plate|mail|helmet|gauntlet|greaves|shield|盔甲|护甲|甲胄|板甲|锁子甲|头盔|护手|护胫|护盾|防弹|防护)/i;
        return armorKw.test(name) || armorKw.test(equipType) || armorKw.test(category);
    }

    function isRestraintLikeEquip(entry, def) {
        const role = String(entry?.narrativeRole || def?.narrativeRole || "").trim().toLowerCase();
        if (role === "restraint") return true;
        if (role === "armor") return false;
        const constraints = Array.isArray(entry?.constraints) ? entry.constraints : (Array.isArray(def?.constraints) ? def.constraints : []);
        if (constraints.length) return true;
        const atts = Array.isArray(entry?.attachments) ? entry.attachments : (Array.isArray(def?.attachments) ? def.attachments : []);
        if (atts.some((a) => ["gag", "oral_sheath", "finger_restraint", "constraint_modifier"].includes(String(a?.type || "")))) return true;
        const name = String(entry?.name || def?.name || "").toLowerCase();
        const equipType = String(entry?.equipType || def?.equipType || "").toLowerCase();
        const category = String(entry?.category || def?.category || "").toLowerCase();
        const restraintKw = /(bondage|restraint|gag|corset|hobble|armbinder|mummy|束缚|拘束|口塞|锁具|捆绑|拘束衣|单手套|束腰)/i;
        return restraintKw.test(name) || restraintKw.test(equipType) || restraintKw.test(category);
    }

    CYOA.getActiveConstraints = function() {
        const game = CYOA.currentGame;
        const save = CYOA.currentSave;
        const out = new Set();
        if (!game || !save) return out;

        const defMap = new Map((game.equipment || []).map(e => [e.id, e]));
        const equipped = getEquippedEntries(save);

        equipped.forEach(entry => {
            const eqId = entry?.id || entry?.equipId || entry?.itemId;
            if (!eqId) return;
            const def = defMap.get(eqId) || entry;

            (def?.constraints || []).forEach(c => {
                if (c) out.add(String(c));
            });

            (def?.attachments || []).forEach(att => {
                if (!att) return;
                // 常见附件映射为约束标签，兼容 state/main 的判断
                if (att.type === "ear_device" && (att.earDeviceType === "earplug" || att.earDeviceType === "controller_only")) out.add("deaf");
                if (att.type === "vision_modifier" && att.visionType) {
                    out.add(att.visionType === "full_blind" ? "blind" : "vision_restricted");
                }
                if (att.type === "gag" || att.type === "oral_sheath") out.add("mute");
                if (att.type === "breath_restrict") out.add("breath_restrict");
                if (att.type === "finger_restraint") out.add("no_fingers");
            });

            // 与旧主文件兼容：根据装备类型字段推导约束
            const gagType = entry?.gagType || def?.gagType;
            if (gagType) {
                const gagDef = (CYOA.CONFIG?.GAG_TYPES || []).find(g => g.value === gagType);
                if (gagDef) {
                    out.add("mute");
                    if (gagDef.forcedOpen) out.add("forced_open_mouth");
                }
            }
            const earType = entry?.earDeviceType || def?.earDeviceType;
            if (earType) {
                const earDef = (CYOA.CONFIG?.EAR_DEVICE_TYPES || []).find(e => e.value === earType);
                if (earDef) {
                    const modeDef = (CYOA.CONFIG?.EAR_DEVICE_MODES || {})[earDef.mode];
                    if (modeDef?.deaf) out.add("deaf");
                }
            }
            const fingerType = entry?.fingerRestraintType || def?.fingerRestraintType;
            if (fingerType) {
                const fingerDef = (CYOA.CONFIG?.FINGER_RESTRAINT_TYPES || []).find(f => f.value === fingerType);
                if (fingerDef) out.add("no_fingers");
            }
        });

        return out;
    };

    CYOA.getLimitedStepParams = function() {
        const save = CYOA.currentSave;
        const game = CYOA.currentGame;
        const defaults = CYOA.CONFIG?.LIMITED_STEP_DEFAULTS || { stepLimitCm: 20, speedModifierPct: -50 };
        if (!save?.equipment) return null;
        let minCm = Infinity;
        let totalSpeedPct = 0;
        let found = false;
        Object.keys(save.equipment).forEach(slot => {
            const item = save.equipment[slot];
            if (!item) return;
            const def = (game?.equipment || []).find(e => e.id === item.id);
            const cList = item.constraints || def?.constraints;
            if (!Array.isArray(cList) || !cList.includes("limited_step")) return;
            found = true;
            const cm = Number(item.stepLimitCm ?? def?.stepLimitCm ?? defaults.stepLimitCm);
            const pct = Number(item.speedModifierPct ?? def?.speedModifierPct ?? defaults.speedModifierPct);
            if (cm < minCm) minCm = cm;
            totalSpeedPct += pct;
        });
        if (!found) return null;
        return {
            stepLimitCm: minCm === Infinity ? Number(defaults.stepLimitCm || 20) : minCm,
            speedModifierPct: Math.max(-100, Math.min(100, totalSpeedPct))
        };
    };

    CYOA.getActiveVisionType = function() {
        const save = CYOA.currentSave;
        const game = CYOA.currentGame;
        if (!save?.equipment) return null;
        let hasVisionEffect = false;
        let bestVision = null;
        let bestSeverity = -1;
        const visionTypes = CYOA.CONFIG?.VISION_TYPES || [];

        Object.keys(save.equipment).forEach(slot => {
            const item = save.equipment[slot];
            if (!item) return;
            const def = (game?.equipment || []).find(e => e.id === item.id);
            const cList = item.constraints || def?.constraints;
            if (Array.isArray(cList) && cList.includes("blind")) hasVisionEffect = true;
            const attachments = item.attachments || def?.attachments || [];
            attachments.forEach(att => {
                if (att?.type !== "vision_modifier" || !att.visionType) return;
                hasVisionEffect = true;
                const vt = visionTypes.find(v => v.value === att.visionType);
                const sev = Number(vt?.severity ?? 0);
                if (sev > bestSeverity) {
                    bestSeverity = sev;
                    bestVision = att.visionType;
                }
            });
        });

        if (!hasVisionEffect) return null;
        return bestVision || "full_blind";
    };

    CYOA.hasDRing = function(slot) {
        const save = CYOA.currentSave;
        if (!save?.equipment || !slot) return false;
        const entry = save.equipment[slot];
        if (!entry) return false;
        const eqId = entry?.id || entry?.equipId || entry?.itemId || entry;
        if (!eqId) return false;
        const def = getEquipDefById(CYOA.currentGame, eqId) || entry;
        const atts = Array.isArray(entry?.attachments) ? entry.attachments : (Array.isArray(def?.attachments) ? def.attachments : []);
        return atts.some(a => a?.type === "d_ring");
    };

    CYOA.getActiveDRings = function() {
        const game = CYOA.currentGame;
        const save = CYOA.currentSave;
        if (!game || !save?.equipment || typeof save.equipment !== "object") return [];

        const out = [];
        Object.entries(save.equipment).forEach(([slot, entry]) => {
            if (!entry) return;
            const eqId = entry?.id || entry?.equipId || entry?.itemId || entry;
            if (!eqId) return;
            const def = getEquipDefById(game, eqId) || entry;
            const atts = Array.isArray(entry?.attachments) ? entry.attachments : (Array.isArray(def?.attachments) ? def.attachments : []);
            atts.forEach(att => {
                if (att?.type !== "d_ring") return;
                out.push({
                    slot,
                    equipId: def?.id || eqId,
                    equipName: def?.name || eqId,
                    dRingPosition: att?.dRingPosition || "front",
                    attachmentName: att?.name || "D-ring"
                });
            });
        });
        return out;
    };

    CYOA.getActiveSynergies = function() {
        const game = CYOA.currentGame;
        const save = CYOA.currentSave;
        if (!game || !save) return [];
        const equipped = new Set(
            getEquippedEntries(save)
                .map(e => e?.id || e?.equipId || e?.itemId)
                .filter(Boolean)
        );
        return (game.equipmentSynergies || []).filter(s => {
            const triggers = s?.triggers || [];
            if (!triggers.length) return false;
            return triggers.every(id => equipped.has(id));
        });
    };

    CYOA.updateEquipmentTimers = function() {
        const save = CYOA.currentSave;
        if (!save?.equipment || typeof save.equipment !== "object") return;
        Object.keys(save.equipment).forEach(slot => {
            const eq = save.equipment[slot];
            if (!eq) return;
            if (typeof eq.timer === "number" && eq.timer > 0) eq.timer -= 1;
        });
    };

    CYOA.getEquipmentEscalation = function(equipId) {
        const save = CYOA.currentSave;
        if (!save || !equipId) return null;
        const timers = save.equipmentTimers;
        if (!timers || typeof timers !== "object") return null;
        const hit = timers[equipId];
        if (!hit || typeof hit !== "object") return null;
        return {
            escalationLevel: Number(hit.escalationLevel || 0),
            turnsWorn: Number(hit.turnsWorn || 0),
            locked: !!hit.locked,
            lockLevel: Number(hit.lockLevel || 0)
        };
    };

    CYOA.updateDependency = function() {
        const save = CYOA.currentSave;
        if (!save) return;
        save.dependency = Number(save.dependency || 0);
        const constraints = CYOA.getActiveConstraints();
        if (constraints.has("mute") || constraints.has("vision_restricted") || constraints.has("deaf")) {
            save.dependency = Math.min(100, save.dependency + 1);
        } else if (save.dependency > 0) {
            save.dependency = Math.max(0, save.dependency - 1);
        }
    };

    CYOA.checkDiscoveries = function() {
        const game = CYOA.currentGame;
        const save = CYOA.currentSave;
        if (!game || !save) return;
        const rules = Array.isArray(game.discoveryRules) ? game.discoveryRules : [];
        if (!Array.isArray(save.discoveries)) save.discoveries = [];

        rules.forEach(rule => {
            if (!rule?.id || save.discoveries.includes(rule.id)) return;
            const conds = Array.isArray(rule.conditions) ? rule.conditions : [];
            const ok = !conds.length || conds.every(c => CYOA.evaluateCondition?.(c));
            if (ok) save.discoveries.push(rule.id);
        });
    };

    CYOA.isRuleDiscovered = function(ruleId) {
        const discovered = CYOA.currentSave?.discoveries;
        return Array.isArray(discovered) ? discovered.includes(ruleId) : false;
    };

    CYOA.getObserverAlert = function() {
        const v = Number(CYOA.currentSave?.observerAlert || 0);
        return Math.max(0, Math.min(100, v));
    };

    CYOA.getDependencyTier = function() {
        const val = Number(CYOA.currentSave?.dependency || 0);
        const thresholds = Array.isArray(CYOA.CONFIG?.DEPENDENCY_THRESHOLDS) ? CYOA.CONFIG.DEPENDENCY_THRESHOLDS : [];
        let tier = thresholds[0] || { level: 0, label: "无感", desc: "" };
        thresholds.forEach(t => {
            if (val >= Number(t?.level || 0)) tier = t;
        });
        return { ...tier, value: val };
    };

    CYOA.detectActionType = function(userMessage) {
        const text = String(userMessage || "");
        if (!text) return "idle";
        const keywords = CYOA.CONFIG?.ACTION_KEYWORDS || {
            struggle: ["挣扎", "反抗", "解开", "逃跑", "struggle", "escape", "unlock"],
            social: ["说", "问", "交谈", "对话", "talk", "ask", "say"],
            move: ["前往", "移动", "去", "travel", "move", "go"],
            observe: ["观察", "查看", "look", "inspect", "scan"]
        };
        let bestType = "idle";
        let bestScore = 0;
        Object.entries(keywords).forEach(([type, words]) => {
            const score = (Array.isArray(words) ? words : []).reduce((acc, w) => acc + (text.includes(String(w)) ? 1 : 0), 0);
            if (score > bestScore) {
                bestScore = score;
                bestType = type;
            }
        });
        return bestType;
    };

    CYOA.isChapterMonitored = function(chapterId) {
        const game = CYOA.currentGame;
        const save = CYOA.currentSave;
        if (!game || !save) return false;
        const cid = chapterId || save.currentChapter;
        const ch = (game.chapters || []).find(c => c.id === cid);
        if (!ch) return true; // 未配置时默认可见监控指标
        if (typeof ch.monitored === "boolean") return ch.monitored;
        if (typeof ch.observerEnabled === "boolean") return ch.observerEnabled;
        if (typeof ch.enableObserver === "boolean") return ch.enableObserver;
        return true;
    };

    CYOA.getObserverAlertLevel = function() {
        return getObserverThreshold(CYOA.getObserverAlert());
    };

    CYOA.bumpObserverAlert = function(source, text) {
        const save = CYOA.currentSave;
        if (!save) return 0;
        const cfg = CYOA.CONFIG?.OBSERVER_ALERT_CONFIG || {};
        let inc = 0;
        if (source === "struggle") inc += Number(cfg.struggleIncrement || 8);
        if (source === "ai_input") {
            const raw = String(text || "");
            const hit = /(挣扎|反抗|逃跑|破解|解开|钥匙|监控|摄像头|struggle|escape|unlock|camera|security)/i.test(raw);
            if (hit) inc += Number(cfg.aiKeywordIncrement || 4);
        }
        save.observerAlert = Math.max(0, Math.min(100, Number(save.observerAlert || 0) + inc));
        if (source === "struggle" && inc > 0) {
            const txt = pickRandom(CYOA.CONFIG?.CCTV_NARRATIVES?.struggle_watched);
            if (txt) CYOA.appendGameBubble?.("assistant", txt);
        }
        return save.observerAlert;
    };

    CYOA.updateObserverAlert = function() {
        const save = CYOA.currentSave;
        if (!save) return;
        const cfg = CYOA.CONFIG?.OBSERVER_ALERT_CONFIG || {};
        const decay = Number(cfg.decayPerTurn || 2);
        const cooldownMax = Number(cfg.interventionCooldownTurns || 5);
        if (typeof save.observerInterventionCooldown !== "number") save.observerInterventionCooldown = 0;
        if (save.observerInterventionCooldown > 0) save.observerInterventionCooldown -= 1;

        const threshold = Number(cfg.interventionThreshold || 100);
        const prevLevel = getObserverThreshold(Number(save.observerAlert || 0))?.level || "none";
        if (Number(save.observerAlert || 0) >= threshold && save.observerInterventionCooldown <= 0) {
            save.observerInterventionCooldown = cooldownMax;
            // 优先走已有惩罚系统，复用配置化行为
            if (typeof CYOA.applyPunishment === "function") {
                CYOA.applyPunishment("lock_increase");
            } else {
                const slots = Object.keys(save.equipment || {});
                const slot = slots.find(s => (save.equipment[s]?.lockLevel || 0) < 5);
                if (slot && save.equipment[slot]) {
                    save.equipment[slot].lockLevel = Number(save.equipment[slot].lockLevel || 0) + 1;
                }
            }
            if (typeof CYOA.modifyShame === "function") CYOA.modifyShame(4, "observer_intervention");
            if (typeof CYOA.modifyArousal === "function") CYOA.modifyArousal(3, "observer_intervention");
            CYOA.addKeyEvent?.("observer_intervention", "监控系统介入：警觉度达到阈值");
            const txt = pickRandom(CYOA.CONFIG?.CCTV_NARRATIVES?.intervention_imminent)
                || "远处传来急促的脚步声——监控系统已经触发介入。";
            CYOA.appendGameBubble?.("assistant", txt);
            // 介入后回落到高警戒而非清零，保持压迫感
            save.observerAlert = Math.max(65, Number(save.observerAlert || 0) - 20);
        }

        save.observerAlert = Math.max(0, Math.min(100, Number(save.observerAlert || 0) - decay));
        const levelNow = getObserverThreshold(Number(save.observerAlert || 0));
        if ((levelNow?.level === "high" || levelNow?.level === "critical") && levelNow?.level !== prevLevel) {
            const txt = pickRandom(CYOA.CONFIG?.CCTV_NARRATIVES?.alert_rising);
            if (txt) CYOA.appendGameBubble?.("assistant", txt);
            CYOA.addKeyEvent?.("observer_high", "监控关注升级");
        }
    };

    CYOA.applyDegradationRules = function() {
        const save = CYOA.currentSave;
        const game = CYOA.currentGame;
        if (!save?.equipment || !game) return;
        const rules = Array.isArray(CYOA.CONFIG?.DEGRADATION_RULES) ? CYOA.CONFIG.DEGRADATION_RULES : [];
        if (!rules.length) return;

        Object.entries(save.equipment).forEach(([slot, item]) => {
            if (!item?.id) return;
            const def = getEquipDefById(game, item.id);
            if (!def) return;
            const constraints = Array.isArray(item.constraints) ? item.constraints : (Array.isArray(def.constraints) ? def.constraints : []);
            const dura = getDurabilityPair(item, def);
            if (dura.max <= 0) return;
            const pct = Math.round((dura.cur / dura.max) * 100);
            if (!item._degradationApplied || typeof item._degradationApplied !== "object") item._degradationApplied = {};

            rules.forEach((rule, ridx) => {
                if (!constraints.includes(rule.constraint)) return;
                const ths = Array.isArray(rule.thresholds) ? rule.thresholds : [];
                ths.forEach((th, tidx) => {
                    const needPct = Number(th?.duraPct ?? -1);
                    if (needPct < 0 || pct > needPct) return;
                    const key = `${ridx}:${tidx}`;
                    if (item._degradationApplied[key]) return;

                    if (th.effect) {
                        const baseStep = Number(item.stepLimitCm ?? def.stepLimitCm ?? (CYOA.CONFIG?.LIMITED_STEP_DEFAULTS?.stepLimitCm || 20));
                        const basePct = Number(item.speedModifierPct ?? def.speedModifierPct ?? (CYOA.CONFIG?.LIMITED_STEP_DEFAULTS?.speedModifierPct || -50));
                        item._degradedStepLimitCm = baseStep + Number(th.effect.stepLimitCmBonus || 0);
                        item._degradedSpeedModifierPct = basePct + Number(th.effect.speedModifierPctBonus || 0);
                    }

                    if (th.visionShift) {
                        if (!Array.isArray(item.attachments)) item.attachments = Array.isArray(def.attachments) ? JSON.parse(JSON.stringify(def.attachments)) : [];
                        const vAtt = item.attachments.find(a => a?.type === "vision_modifier" && a.visionType);
                        if (vAtt && (!th.visionShift.from || vAtt.visionType === th.visionShift.from)) {
                            if (th.visionShift.to) vAtt.visionType = th.visionShift.to;
                            else {
                                const i = item.attachments.indexOf(vAtt);
                                if (i >= 0) item.attachments.splice(i, 1);
                            }
                        }
                    }

                    item._degradationApplied[key] = true;
                    CYOA.addKeyEvent?.("degrade", `装备劣化：${item.name || item.id} @ ${slot}`);
                });
            });
        });
    };

    function applyAttrDelta(save, attrName, delta) {
        const v = Number(delta || 0);
        if (!v) return;
        if (Array.isArray(save.attributes)) {
            const hit = save.attributes.find(a => a?.id === attrName || a?.name === attrName);
            if (hit && typeof hit.value === "number") {
                const max = typeof hit.max === "number" ? hit.max : Number.POSITIVE_INFINITY;
                const min = typeof hit.min === "number" ? hit.min : 0;
                hit.value = Math.max(min, Math.min(max, hit.value + v));
            }
            return;
        }
        if (save.attributes && typeof save.attributes === "object") {
            const cur = Number(save.attributes[attrName] || 0);
            save.attributes[attrName] = Math.max(0, cur + v);
        }
    }

    CYOA.applyMaterialBodyEffects = function() {
        const save = CYOA.currentSave;
        const game = CYOA.currentGame;
        if (!save?.equipment || !game) return;

        const effectMap = CYOA.CONFIG?.MATERIAL_BODY_EFFECTS || {};
        const byId = new Map((game.equipment || []).map(e => [e.id, e]));
        const visitedEquipIds = new Set();
        const acc = { arousal: 0, shame: 0, pain: 0, dependency: 0 };
        let dominantMat = "";
        let dominantScore = -1;

        Object.values(save.equipment).forEach(eq => {
            if (!eq?.id || visitedEquipIds.has(eq.id)) return;
            visitedEquipIds.add(eq.id);
            const def = byId.get(eq.id);
            const mat = normalizeMaterialKey(eq.material || def?.material || "");
            if (!mat) return;
            const armorLike = isArmorLikeEquip(eq, def);
            const restraintLike = isRestraintLikeEquip(eq, def);
            if (armorLike && !restraintLike) return;
            const fx = effectMap[mat];
            if (!fx) return;
            acc.arousal += Number(fx.arousalPerTurn || 0);
            acc.shame += Number(fx.shamePerTurn || 0);
            acc.pain += Number(fx.painPerTurn || 0);
            acc.dependency += Number(fx.dependencyPerTurn || 0);
            const score = Math.abs(Number(fx.arousalPerTurn || 0))
                + Math.abs(Number(fx.shamePerTurn || 0))
                + Math.abs(Number(fx.painPerTurn || 0))
                + Math.abs(Number(fx.dependencyPerTurn || 0));
            if (score > dominantScore) {
                dominantScore = score;
                dominantMat = mat;
            }
        });

        // 限幅，避免多件装备导致单回合波动过大
        acc.arousal = Math.max(-3, Math.min(3, acc.arousal));
        acc.shame = Math.max(-3, Math.min(3, acc.shame));
        acc.pain = Math.max(-3, Math.min(3, acc.pain));
        acc.dependency = Math.max(-3, Math.min(3, acc.dependency));

        if (acc.arousal && typeof CYOA.modifyArousal === "function") CYOA.modifyArousal(acc.arousal, "material_feedback");
        if (acc.shame && typeof CYOA.modifyShame === "function") CYOA.modifyShame(acc.shame, "material_feedback");
        if (acc.pain) {
            if (typeof save.pain !== "number") save.pain = 0;
            save.pain = Math.max(0, Math.min(100, save.pain + acc.pain));
        }
        if (acc.dependency) {
            if (typeof save.dependency !== "number") save.dependency = 0;
            save.dependency = Math.max(0, Math.min(100, save.dependency + acc.dependency));
        }
        applyAttrDelta(save, "pain", acc.pain);
        applyAttrDelta(save, "dependency", acc.dependency);
        applyAttrDelta(save, "arousal", acc.arousal);
        applyAttrDelta(save, "shame", acc.shame);

        if (dominantMat) {
            if (typeof save._materialEffectTurn !== "number") save._materialEffectTurn = 0;
            save._materialEffectTurn += 1;
            if (save._materialEffectTurn % 6 === 0) {
                const desc = effectMap[dominantMat]?.desc;
                if (desc) CYOA.addKeyEvent?.("material_effect", `材质反馈(${dominantMat})：${desc}`);
            }
        }
    };

    CYOA.applyPassiveSystems = function() {
        const save = CYOA.currentSave;
        if (!save) return;

        // 回合内被动系统推进：基础状态 + 联动效果 + 章节推进
        if (typeof save.postureDuration !== "number") save.postureDuration = 0;
        save.postureDuration += 1;

        const synergies = CYOA.getActiveSynergies?.() || [];
        if (!Array.isArray(save.activeSynergyIds)) save.activeSynergyIds = [];
        save.activeSynergyIds = synergies.map(s => s.id).filter(Boolean);

        synergies.forEach(s => {
            // 轻量支持：在数据里通过 tickEffects 声明每回合属性变化
            const effects = Array.isArray(s?.tickEffects) ? s.tickEffects : [];
            effects.forEach(eff => {
                if (!eff?.attribute) return;
                const delta = Number(eff.delta || 0);
                if (!delta) return;

                if (Array.isArray(save.attributes)) {
                    const it = save.attributes.find(a => a?.id === eff.attribute || a?.name === eff.attribute);
                    if (it && typeof it.value === "number") {
                        const max = typeof it.max === "number" ? it.max : Number.POSITIVE_INFINITY;
                        const min = typeof it.min === "number" ? it.min : 0;
                        it.value = Math.max(min, Math.min(max, it.value + delta));
                    }
                } else if (save.attributes && typeof save.attributes === "object") {
                    const cur = Number(save.attributes[eff.attribute] || 0);
                    save.attributes[eff.attribute] = Math.max(0, cur + delta);
                }
            });
        });

        CYOA.applyMaterialBodyEffects?.();
        CYOA.applyDegradationRules?.();
        CYOA.updateObserverAlert?.();
        CYOA.tryProgressChapter?.();
        CYOA.persistSave?.();
    };

    CYOA.applySensoryFilters = function(text) {
        if (!text || !CYOA.currentSave) return text;
        const constraints = CYOA.getActiveConstraints?.() || new Set();
        let out = String(text || "");

        // 视觉过滤：盲/视野受限
        const hasVisionConstraint = constraints.has("blind") || constraints.has("vision_restricted");
        if (hasVisionConstraint) {
            const visionType = CYOA.getActiveVisionType?.() || (constraints.has("blind") ? "full_blind" : "pinhole");
            const visualSentenceRe = /[^。！？\n]*(?:看见|眼前|颜色|光线|映入|视线|望见|目光|看到|望去|注视|凝视|瞥见)[^。！？\n]*[。！？\n]?/g;
            switch (visionType) {
                case "full_blind":
                    out = out.replace(visualSentenceRe, "");
                    break;
                case "fixed_gaze":
                    out = out
                        .replace(visualSentenceRe, (m) => m)
                        .replace(/[^。！？\n]*(?:余光|身后|侧面|背后|回头|转头|环顾|扭头|侧目)[^。！？\n]*[。！？\n]?/g, "");
                    break;
                case "pinhole":
                case "translucent":
                case "multiphole":
                default:
                    // 轻量过滤：保留句子，但弱化“看清”语义
                    out = out
                        .replace(/看清|看得清楚|一览无余/g, "勉强辨认")
                        .replace(/清晰地看到/g, "模糊地看到");
                    break;
            }
        }

        // 耳聋过滤：移除声音句；controller_only 模式保留“控制者声音”
        if (constraints.has("deaf")) {
            const earDev = CYOA.getActiveEarDevice?.();
            const soundSentenceRe = /[^。！？\n]*(?:听见|响声|听到|声音|声响|一声|喧哗|嘈杂|呼喊|叫声)[^。！？\n]*[。！？\n]?/g;
            if (earDev?.hearController) {
                out = out.replace(soundSentenceRe, (m) => {
                    if (/主人|控制者|耳机|传来|命令|指令/.test(m)) return m;
                    return "";
                });
            } else {
                out = out.replace(soundSentenceRe, "");
            }
        }

        return out.replace(/\n{3,}/g, "\n\n").trim();
    };

    CYOA.parseAndApplyItemChanges = function(aiResponse) {
        const save = CYOA.currentSave;
        const game = CYOA.currentGame;
        if (!save) return;
        if (!Array.isArray(save.inventory)) save.inventory = [];
        if (!save.equipment || typeof save.equipment !== "object") save.equipment = {};

        const responseText = String(aiResponse || "");
        if (!responseText.trim()) return;

        // 文本协议：消耗物品（示例：消耗了1个煤油）
        const consumePattern = /消耗了\s*(\d+)\s*个?\s*([^，。\s]+)/g;
        let m;
        while ((m = consumePattern.exec(responseText)) !== null) {
            const amount = Math.max(1, Number(m[1] || 1));
            const itemName = String(m[2] || "").trim();
            if (!itemName) continue;
            const idx = save.inventory.findIndex(i => i?.name === itemName || i?.id === itemName);
            if (idx < 0) continue;
            const item = save.inventory[idx];
            const qty = Number(item?.quantity || 1);
            if (qty > amount) {
                item.quantity = qty - amount;
            } else if (item?.durability !== undefined && Number(item.durability) > 0) {
                item.durability = Number(item.durability) - amount;
                if (item.durability <= 0) {
                    save.inventory.splice(idx, 1);
                    CYOA.appendSystemMessage?.(`❌ ${itemName} 已耗尽`);
                }
            } else {
                save.inventory.splice(idx, 1);
                CYOA.appendSystemMessage?.(`❌ ${itemName} 已耗尽`);
            }
        }

        // 文本协议：装备耐久下降（示例：口枷的耐久度降低了2）
        const durabilityPattern = /([^，。\s]+)的耐久度[下降低了]了\s*(\d+)/g;
        while ((m = durabilityPattern.exec(responseText)) !== null) {
            const equipName = String(m[1] || "").trim();
            const amount = Math.max(1, Number(m[2] || 1));
            if (!equipName) continue;
            for (const slot of Object.keys(save.equipment || {})) {
                const equip = save.equipment[slot];
                if (!equip || equip.name !== equipName) continue;
                const equipDef = (game?.equipment || []).find(e => e.id === equip.id);
                const isIndestructible = Boolean(equip.indestructible ?? equipDef?.indestructible ?? false);
                if (isIndestructible) break;
                if (equip.durability === undefined) break;
                equip.durability = Math.max(0, Number(equip.durability || 0) - amount);
                if (typeof CYOA.applyDegradation === "function") {
                    CYOA.applyDegradation(equip, equipDef);
                }
                if (equip.durability <= 0) {
                    delete save.equipment[slot];
                    if (equipDef?.statModifiers && typeof CYOA.parseStatModifiers === "function" && typeof CYOA.applyStatModifiers === "function") {
                        const mods = CYOA.parseStatModifiers(equipDef.statModifiers);
                        CYOA.applyStatModifiers(mods, false);
                    }
                    CYOA.appendSystemMessage?.(`💔 ${equipName} 损坏了`);
                }
                break;
            }
        }

        // 文本协议：获得物品（示例：获得了2个绷带）
        const gainPattern = /获得了\s*(\d+)\s*个?\s*([^，。\s]+)/g;
        while ((m = gainPattern.exec(responseText)) !== null) {
            const amount = Math.max(1, Number(m[1] || 1));
            const itemName = String(m[2] || "").trim();
            if (!itemName) continue;
            const itemDef = (game?.items || []).find(i => i?.name === itemName || i?.id === itemName);
            if (!itemDef) continue;
            const maxQty = Number(CYOA.CONFIG?.ITEM_MAX_QUANTITY || 99);
            const existing = save.inventory.find(i => i?.id === itemDef.id || i?.name === itemDef.name);
            if (existing) {
                existing.quantity = Math.min(maxQty, Number(existing.quantity || 1) + amount);
            } else {
                const cloned = JSON.parse(JSON.stringify(itemDef));
                cloned.quantity = Math.min(maxQty, amount);
                save.inventory.push(cloned);
            }
            if (!Array.isArray(save.acquiredItemIds)) save.acquiredItemIds = [];
            if (itemDef.id && !save.acquiredItemIds.includes(itemDef.id)) {
                save.acquiredItemIds.push(itemDef.id);
            }
        }
    };

    CYOA.acquireItem = function(nameOrId, amount) {
        const save = CYOA.currentSave;
        const game = CYOA.currentGame;
        if (!save || !game) return false;
        if (!Array.isArray(save.inventory)) save.inventory = [];

        const qty = Math.max(1, Number(amount || 1));
        const maxQty = Number(CYOA.CONFIG?.ITEM_MAX_QUANTITY || 99);
        const gameDef = (game.items || []).find(i => i?.id === nameOrId || i?.name === nameOrId);
        if (!gameDef) return false;

        const existing = save.inventory.find(i => i?.id === gameDef.id || i?.name === gameDef.name);
        if (existing) {
            existing.quantity = Math.min(maxQty, Number(existing.quantity || 1) + qty);
        } else {
            const cloned = JSON.parse(JSON.stringify(gameDef));
            cloned.quantity = Math.min(maxQty, qty);
            save.inventory.push(cloned);
        }

        if (!Array.isArray(save.acquiredItemIds)) save.acquiredItemIds = [];
        if (gameDef.id && !save.acquiredItemIds.includes(gameDef.id)) {
            save.acquiredItemIds.push(gameDef.id);
        }

        CYOA.persistSave?.();
        CYOA.renderInventoryPanel?.();
        return true;
    };

    CYOA.removeItem = function(nameOrId, amount) {
        const save = CYOA.currentSave;
        if (!save || !Array.isArray(save.inventory)) return false;
        const qty = Math.max(1, Number(amount || 1));
        const idx = save.inventory.findIndex(i => i?.id === nameOrId || i?.name === nameOrId);
        if (idx < 0) return false;

        const item = save.inventory[idx];
        const curQty = Number(item?.quantity || 1);
        if (curQty > qty) {
            item.quantity = curQty - qty;
        } else {
            save.inventory.splice(idx, 1);
        }

        CYOA.persistSave?.();
        CYOA.renderInventoryPanel?.();
        return true;
    };

    CYOA.appendSystemMessage = function(message) {
        const text = `📌 ${String(message || "")}`;
        const logEl = document.getElementById("log");
        if (logEl) {
            const systemDiv = document.createElement("div");
            systemDiv.className = "ai system-message";
            systemDiv.style.background = "rgba(16, 185, 129, 0.05)";
            systemDiv.style.borderLeft = "4px solid #10b981";
            systemDiv.textContent = text;
            logEl.appendChild(systemDiv);
            logEl.scrollTop = logEl.scrollHeight;
            return;
        }
        CYOA.appendGameBubble?.("assistant", text);
    };

    CYOA.GameSystems = CYOA.GameSystems || {};
    CYOA.GameSystems.getActiveConstraints = CYOA.getActiveConstraints;
    CYOA.GameSystems.getLimitedStepParams = CYOA.getLimitedStepParams;
    CYOA.GameSystems.getActiveVisionType = CYOA.getActiveVisionType;
    CYOA.GameSystems.getObserverAlert = CYOA.getObserverAlert;
    CYOA.GameSystems.getObserverAlertLevel = CYOA.getObserverAlertLevel;
    CYOA.GameSystems.isChapterMonitored = CYOA.isChapterMonitored;
    CYOA.GameSystems.applySensoryFilters = CYOA.applySensoryFilters;
    CYOA.GameSystems.parseAndApplyItemChanges = CYOA.parseAndApplyItemChanges;
    CYOA.GameSystems.acquireItem = CYOA.acquireItem;
    CYOA.GameSystems.removeItem = CYOA.removeItem;
    CYOA.GameSystems.appendSystemMessage = CYOA.appendSystemMessage;
})();
