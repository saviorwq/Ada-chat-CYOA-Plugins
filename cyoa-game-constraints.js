/**
 * CYOA Constraint Resolver Module
 * 约束来源明细：仅基于装备显式字段解析限制，并提供调试接口。
 */
(function() {
    const CYOA = window.CYOA;
    if (!CYOA || !CYOA.CONFIG) return;

    CYOA.GameConstraints = CYOA.GameConstraints || {};
    CYOA.GameConstraints.__moduleName = "constraints";
    CYOA.GameConstraints.__ready = true;

    function normalizeRemoveScope(v) {
        const s = String(v || "").trim().toLowerCase();
        return s === "global" ? "global" : "by_equip";
    }

    function getRemoveScope() {
        // 固定同装备来源移除，避免全局移除带来的误伤
        return "by_equip";
    }

    function getEquippedEntries(save) {
        const eq = save?.equipment;
        if (!eq) return [];
        if (Array.isArray(eq)) return eq.filter(Boolean);
        if (typeof eq === "object") return Object.values(eq).filter(Boolean);
        return [];
    }

    function preferredArray(entryVal, defVal) {
        if (Array.isArray(entryVal)) return entryVal;
        if (Array.isArray(defVal)) return defVal;
        return [];
    }

    function addConstraint(activeSet, sourceMap, key, source) {
        const k = String(key || "").trim();
        if (!k) return;
        activeSet.add(k);
        if (!Array.isArray(sourceMap[k])) sourceMap[k] = [];
        sourceMap[k].push(source);
    }

    function resolveConstraintBundle() {
        const game = CYOA.currentGame;
        const save = CYOA.currentSave;
        const active = new Set();
        const sources = {};
        const removed = {};
        if (!game || !save) return { active, sources };

        const defMap = new Map((game.equipment || []).map((e) => [e.id, e]));
        const equipped = getEquippedEntries(save);

        equipped.forEach((entry) => {
            const eqId = entry?.id || entry?.equipId || entry?.itemId;
            if (!eqId) return;
            const def = defMap.get(eqId) || entry;
            const equipName = String(entry?.name || def?.name || eqId);

            // 1) constraints 显式字段
            preferredArray(entry?.constraints, def?.constraints).forEach((c) => {
                const key = String(c || "").trim();
                if (!key) return;
                addConstraint(active, sources, key, {
                    equipId: eqId,
                    equipName,
                    from: "constraints",
                    value: key
                });
            });

            // 2) attachments 显式字段映射
            preferredArray(entry?.attachments, def?.attachments).forEach((att) => {
                const type = String(att?.type || "").trim();
                if (!type) return;
                if (type === "ear_device") {
                    const mode = String(att?.earDeviceType || "").trim();
                    if (mode === "earplug" || mode === "controller_only") {
                        addConstraint(active, sources, "deaf", {
                            equipId: eqId,
                            equipName,
                            from: "attachments.ear_device",
                            value: mode
                        });
                    }
                }
                if (type === "vision_modifier") {
                    const visionType = String(att?.visionType || "").trim();
                    if (visionType) {
                        addConstraint(active, sources, visionType === "full_blind" ? "blind" : "vision_restricted", {
                            equipId: eqId,
                            equipName,
                            from: "attachments.vision_modifier",
                            value: visionType
                        });
                    }
                }
                if (type === "gag" || type === "oral_sheath") {
                    addConstraint(active, sources, "mute", {
                        equipId: eqId,
                        equipName,
                        from: `attachments.${type}`,
                        value: type
                    });
                    if (type === "oral_sheath") {
                        addConstraint(active, sources, "forced_open_mouth", {
                            equipId: eqId,
                            equipName,
                            from: "attachments.oral_sheath",
                            value: "forced_open_mouth"
                        });
                    }
                }
                if (type === "breath_restrict") {
                    addConstraint(active, sources, "breath_restrict", {
                        equipId: eqId,
                        equipName,
                        from: "attachments.breath_restrict",
                        value: "breath_restrict"
                    });
                }
                if (type === "finger_restraint") {
                    addConstraint(active, sources, "no_fingers", {
                        equipId: eqId,
                        equipName,
                        from: "attachments.finger_restraint",
                        value: "finger_restraint"
                    });
                }
                if (type === "constraint_modifier") {
                    const addList = Array.isArray(att?.addConstraints) ? att.addConstraints : [];
                    addList.forEach((c) => {
                        const key = String(c || "").trim();
                        if (!key) return;
                        addConstraint(active, sources, key, {
                            equipId: eqId,
                            equipName,
                            from: "attachments.constraint_modifier.addConstraints",
                            value: key
                        });
                    });
                    const removeList = Array.isArray(att?.removeConstraints) ? att.removeConstraints : [];
                    removeList.forEach((c) => {
                        const key = String(c || "").trim();
                        if (!key) return;
                        if (!Array.isArray(removed[key])) removed[key] = [];
                        removed[key].push({
                            equipId: eqId,
                            equipName,
                            from: "attachments.constraint_modifier.removeConstraints",
                            value: key
                        });
                    });
                }
            });

            // 3) 类型字段显式映射
            const gagType = String(entry?.gagType || def?.gagType || "").trim();
            if (gagType) {
                const gagDef = (CYOA.CONFIG?.GAG_TYPES || []).find((g) => g.value === gagType);
                if (gagDef) {
                    addConstraint(active, sources, "mute", {
                        equipId: eqId,
                        equipName,
                        from: "gagType",
                        value: gagType
                    });
                    if (gagDef.forcedOpen) {
                        addConstraint(active, sources, "forced_open_mouth", {
                            equipId: eqId,
                            equipName,
                            from: "gagType.forcedOpen",
                            value: gagType
                        });
                    }
                }
            }

            const earType = String(entry?.earDeviceType || def?.earDeviceType || "").trim();
            if (earType) {
                const earDef = (CYOA.CONFIG?.EAR_DEVICE_TYPES || []).find((e) => e.value === earType);
                const modeDef = earDef ? (CYOA.CONFIG?.EAR_DEVICE_MODES || {})[earDef.mode] : null;
                if (modeDef?.deaf) {
                    addConstraint(active, sources, "deaf", {
                        equipId: eqId,
                        equipName,
                        from: "earDeviceType",
                        value: earType
                    });
                }
            }

            const fingerType = String(entry?.fingerRestraintType || def?.fingerRestraintType || "").trim();
            if (fingerType) {
                const fingerDef = (CYOA.CONFIG?.FINGER_RESTRAINT_TYPES || []).find((f) => f.value === fingerType);
                if (fingerDef) {
                    addConstraint(active, sources, "no_fingers", {
                        equipId: eqId,
                        equipName,
                        from: "fingerRestraintType",
                        value: fingerType
                    });
                }
            }
        });

        const removeScope = getRemoveScope();
        Object.keys(removed).forEach((key) => {
            const removeList = Array.isArray(removed[key]) ? removed[key] : [];
            if (!removeList.length) return;
            if (!active.has(key)) return;

            if (removeScope === "global") {
                active.delete(key);
                delete sources[key];
                return;
            }

            // by_equip: 仅移除“同装备来源”的该约束，其他装备来源保留
            const removerEquipIds = new Set(removeList.map(x => String(x?.equipId || "")).filter(Boolean));
            const srcList = Array.isArray(sources[key]) ? sources[key] : [];
            const remain = srcList.filter(src => !removerEquipIds.has(String(src?.equipId || "")));
            if (remain.length) {
                sources[key] = remain;
            } else {
                active.delete(key);
                delete sources[key];
            }
        });

        return { active, sources, removed, removeScope };
    }

    CYOA.getActiveConstraints = function() {
        return resolveConstraintBundle().active;
    };

    CYOA.getActiveConstraintDetails = function() {
        const { active, sources, removed, removeScope } = resolveConstraintBundle();
        return {
            active: Array.from(active),
            sources,
            removed,
            removeScope
        };
    };

    CYOA.getActiveConstraintSources = function() {
        return resolveConstraintBundle().sources;
    };

    CYOA.debugConstraintSources = function() {
        const details = CYOA.getActiveConstraintDetails();
        try { console.table(details.active.map((k) => ({ constraint: k, sourceCount: (details.sources[k] || []).length }))); } catch (_) {}
        try { console.log("[CYOA] constraint sources", details.sources); } catch (_) {}
        try { console.log("[CYOA] constraint removed", details.removed || {}); } catch (_) {}
        try { console.log("[CYOA] constraint remove scope", details.removeScope || "by_equip"); } catch (_) {}
        return details;
    };

    CYOA.setConstraintModifierRemoveScope = function(scope) {
        // 保留兼容 API；运行时固定 by_equip
        return "by_equip";
    };

    CYOA.GameSystems = CYOA.GameSystems || {};
    CYOA.GameSystems.getActiveConstraints = CYOA.getActiveConstraints;
    CYOA.GameSystems.getActiveConstraintDetails = CYOA.getActiveConstraintDetails;
    CYOA.GameSystems.getActiveConstraintSources = CYOA.getActiveConstraintSources;
})();
