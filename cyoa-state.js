/**
 * cyoa-state.js - 鐘舵€?鏁堟灉绯荤粺妯″潡锛堝叴濂嬪害銆佷範鎯害銆佷钩鑳躲€佹鎬佺瓑锛? * 渚濊禆锛歸indow.CYOA, CYOA.CONFIG, CYOA.persistSave, CYOA.getActiveConstraints 蹇呴』宸插瓨鍦紙cyoa-game.js 鍔犺浇鍚庯級
 */
(function() {
    'use strict';
    if (typeof window === 'undefined' || !window.CYOA || !window.CYOA.CONFIG) return;
    const CYOA = window.CYOA;
    const CONFIG = CYOA.CONFIG;
    const log = CYOA.log;
    const t = CYOA.t;

    // ========== 兴奋度系统 API ==========
    CYOA.modifyArousal = function(delta, source) {
        const save = CYOA.currentSave;
        if (!save) return;
        const cfg = CONFIG.AROUSAL_CONFIG || { min: 0, max: 100 };
        const oldVal = save.arousal || 0;
        save.arousal = Math.max(cfg.min, Math.min(cfg.max, oldVal + delta));
        log('兴奋度变化:', oldVal, '->', save.arousal, `(${delta >= 0 ? '+' : ''}${delta}, 来源: ${source || 'unknown'})`);
        CYOA.persistSave();
    };

    // 通用 tier 查找：从高到低遍历，返回第一个 val >= min 的项
    function findTier(val, configKey, fallback) {
        const tiers = CONFIG[configKey] || [];
        for (let i = tiers.length - 1; i >= 0; i--) {
            if (val >= tiers[i].min) return tiers[i];
        }
        return tiers[0] || fallback || { value: 'unknown', label: '?' };
    }

    CYOA.getArousalTier = function() {
        return findTier(CYOA.currentSave?.arousal || 0, 'AROUSAL_THRESHOLDS', { value: 'calm', label: '平静' });
    };

    CYOA.attemptRelease = function() {
        const save = CYOA.currentSave;
        if (!save) return { success: false, reason: 'no_save' };
        const constraints = CYOA.getActiveConstraints();
        if (constraints.has('chastity')) {
            return { success: false, reason: 'chastity', message: '贞操装置阻止了任何释放的可能——身体的渴望被无情地封锁。' };
        }
        if (constraints.has('no_hands')) {
            return { success: false, reason: 'no_hands', message: '双手被束缚，无法触碰自己。' };
        }
        const cfg = CONFIG.AROUSAL_CONFIG || {};
        const amount = cfg.releaseAmount || 50;
        const oldVal = save.arousal || 0;
        if (oldVal < 20) {
            return { success: false, reason: 'too_low', message: '身体处于平静状态，没有需要释放的。' };
        }
        save.arousal = Math.max(0, oldVal - amount);
        CYOA.persistSave();
        return { success: true, oldVal, newVal: save.arousal, message: '身体在释放后逐渐恢复平静……' };
    };

    CYOA.activateStimulator = function(equipSlot, attachmentId, mode, intensity) {
        const save = CYOA.currentSave;
        const game = CYOA.currentGame;
        if (!save || !game) return;
        if (!save.activeStimulators) save.activeStimulators = [];
        const existing = save.activeStimulators.find(s => s.slot === equipSlot && s.attachmentId === attachmentId);
        if (existing) {
            existing.mode = mode || existing.mode;
            existing.intensity = intensity || existing.intensity;
        } else {
            const equipId = save.equipment?.[equipSlot]?.id;
            const equipDef = equipId ? (game.equipment || []).find(e => e.id === equipId) : null;
            const att = (equipDef?.attachments || []).find(a => a.id === attachmentId);
            save.activeStimulators.push({
                slot: equipSlot,
                attachmentId,
                stimType: att?.type || 'vibrator',
                mode: mode || att?.stimMode || 'continuous',
                intensity: intensity || att?.stimIntensity || 'medium',
                equipName: equipDef?.name || equipSlot,
                attachmentName: att?.name || '刺激器'
            });
        }
        CYOA.persistSave();
        log('刺激器已激活:', equipSlot, attachmentId);
    };

    CYOA.deactivateStimulator = function(equipSlot, attachmentId) {
        const save = CYOA.currentSave;
        if (!save || !save.activeStimulators) return;
        save.activeStimulators = save.activeStimulators.filter(
            s => !(s.slot === equipSlot && s.attachmentId === attachmentId)
        );
        CYOA.persistSave();
        log('刺激器已停止:', equipSlot, attachmentId);
    };

    CYOA.calculateTurnArousal = function() {
        const save = CYOA.currentSave;
        if (!save) return 0;
        let totalDelta = 0;

        // 来自活跃刺激器
        (save.activeStimulators || []).forEach(stim => {
            if (stim.mode === 'off') return;
            const stimDef = (CONFIG.STIMULATOR_TYPES || []).find(t => t.value === stim.stimType);
            const modeDef = (CONFIG.STIMULATOR_MODES || []).find(m => m.value === stim.mode);
            const intDef = (CONFIG.STIMULATOR_INTENSITIES || []).find(i => i.value === stim.intensity);
            const base = stimDef?.arousalPerTurn || 5;
            const modeMult = modeDef?.multiplier || 1.0;
            const intMult = intDef?.multiplier || 1.0;
            let delta = base * modeMult * intMult;
            if (stim.mode === 'random' && Math.random() < 0.3) delta = 0;
            totalDelta += Math.round(delta);
        });

        // 来自装备被动摩擦（穿戴在私密部位的装备）
        const intimateSlots = CONFIG.INTIMATE_SLOTS || [];
        for (const slot of intimateSlots) {
            if (save.equipment?.[slot]) totalDelta += 1;
        }

        // 来自特定姿势
        const posture = save.posture || 'standing';
        if (posture === 'bent_over' || posture === 'prone' || posture === 'supine') totalDelta += 1;

        // 来自牵引拉扯
        if (save.tether?.active) totalDelta += 1;

        // 汗液敏感度加成：湿润皮肤放大所有触觉刺激
        if ((save.latexSweat || 0) > 15 && totalDelta > 0) {
            const swCfg = CONFIG.LATEX_SWEAT_CONFIG || {};
            const sweatTiers = CONFIG.LATEX_SWEAT_TIERS || [];
            const swVal = save.latexSweat || 0;
            let tierIdx = 0;
            for (let i = sweatTiers.length - 1; i >= 0; i--) {
                if (swVal >= sweatTiers[i].min) { tierIdx = i; break; }
            }
            if (tierIdx > 0) {
                const bonus = (swCfg.sensitivityBonusPerTier || 0.15) * tierIdx;
                totalDelta = Math.round(totalDelta * (1 + bonus));
            }
        }

        if (totalDelta > 0) {
            CYOA.modifyArousal(totalDelta, 'turn_calc');
        }
        return totalDelta;
    };

    // ========== 时长追踪系统 ==========
    CYOA.updateDurations = function() {
        const save = CYOA.currentSave;
        if (!save) return;
        // 姿势持续时长
        save.postureDuration = (save.postureDuration || 0) + 1;
        // 装备佩戴时长（按约束类型追踪）
        if (!save.wearDurations) save.wearDurations = {};
        const constraints = CYOA.getActiveConstraints();
        constraints.forEach(c => {
            save.wearDurations[c] = (save.wearDurations[c] || 0) + 1;
        });
        // 戒断效应自然衰减
        if (save.withdrawalEffects && save.withdrawalEffects.length > 0) {
            const decayRate = CONFIG.HABITUATION_CONFIG?.withdrawalDecayPerTurn || 5;
            save.withdrawalEffects = save.withdrawalEffects.filter(w => {
                w.turnsRemaining = (w.turnsRemaining || 0) - 1;
                return w.turnsRemaining > 0;
            });
        }
    };

    // ========== 习惯度系统 ==========
    CYOA.updateHabituation = function() {
        const save = CYOA.currentSave;
        if (!save) return;
        if (!save.habituation) save.habituation = {};
        const cfg = CONFIG.HABITUATION_CONFIG || {};
        const gain = cfg.gainPerTurn || 2;
        const maxLv = cfg.maxLevel || 100;
        const constraints = CYOA.getActiveConstraints();
        constraints.forEach(c => {
            const old = save.habituation[c] || 0;
            save.habituation[c] = Math.min(maxLv, old + gain);
        });
    };

    CYOA.getHabituationTier = function(constraintType) {
        return findTier(CYOA.currentSave?.habituation?.[constraintType] || 0, 'HABITUATION_TIERS', { value: 'none', label: '未适应' });
    };

    CYOA.getWithdrawalEffects = function(constraintType) {
        const save = CYOA.currentSave;
        if (!save) return null;
        const hab = save.habituation?.[constraintType] || 0;
        const cfg = CONFIG.HABITUATION_CONFIG || {};
        const threshold = cfg.withdrawalThreshold || 40;
        if (hab < threshold) return null;
        const severity = hab >= 86 ? 'severe' : hab >= 61 ? 'moderate' : 'mild';
        return {
            severity,
            arousalSpike: severity === 'severe' ? (cfg.withdrawalArousalSpike || 20) : severity === 'moderate' ? 10 : 5,
            attrPenalty: severity === 'severe' ? (cfg.withdrawalAttrPenalty || { alert: -15 }) : severity === 'moderate' ? { alert: -8 } : {},
            phantomTurns: severity === 'severe' ? (cfg.phantomDurationTurns || 10) : severity === 'moderate' ? 6 : 3,
            habLevel: hab
        };
    };

    CYOA.triggerWithdrawal = function(constraintType) {
        const save = CYOA.currentSave;
        if (!save) return;
        const effects = CYOA.getWithdrawalEffects(constraintType);
        if (!effects) return;
        // 兴奋度飙升
        CYOA.modifyArousal(effects.arousalSpike, 'withdrawal_' + constraintType);
        // 属性惩罚
        if (effects.attrPenalty) {
            for (const [attr, delta] of Object.entries(effects.attrPenalty)) {
                const attrObj = save.attributes?.find(a => a.name === attr);
                if (attrObj) {
                    attrObj.value = Math.max(attrObj.min || 0, Math.min(attrObj.max || 100, attrObj.value + delta));
                }
            }
        }
        // 添加幻触效应
        if (!save.withdrawalEffects) save.withdrawalEffects = [];
        save.withdrawalEffects.push({
            constraintType,
            severity: effects.severity,
            turnsRemaining: effects.phantomTurns,
            habLevel: effects.habLevel
        });
        log('戒断效应触发:', constraintType, effects);
        CYOA.persistSave();
    };

    // ========== 纪律系统 API ==========
    CYOA.recordViolation = function(ruleValue, npcId) {
        const save = CYOA.currentSave;
        if (!save) return;
        if (!save.violations) save.violations = [];
        save.violations.push({ rule: ruleValue, npcId, turn: save.violations.length, timestamp: Date.now() });
        const ruleDef = (CONFIG.DISCIPLINE_RULES || []).find(r => r.value === ruleValue);
        const sevDef = CONFIG.DISCIPLINE_SEVERITY?.[ruleDef?.severity || 'light'] || {};
        const obLoss = sevDef.obedienceLoss || 5;
        const obAttr = save.attributes?.find(a => a.name === 'obedience');
        if (obAttr) {
            obAttr.value = Math.max(obAttr.min || 0, obAttr.value - obLoss);
        }
        log('违规记录:', ruleValue, '顺从度 -' + obLoss);

        // 重度违规自动执行惩罚
        const npc = CYOA.currentGame?.characters?.find(c => c.id === npcId);
        const punishType = npc?.defaultPunishment || '';
        const punishDef = (CONFIG.PUNISHMENT_TYPES || []).find(p => p.value === punishType);
        if (ruleDef?.severity === 'severe' && punishDef?.auto) {
            CYOA.applyPunishment(punishType);
        }
        CYOA.persistSave();
    };

    CYOA.applyPunishment = function(punishmentValue) {
        const save = CYOA.currentSave;
        if (!save) return;
        const pDef = (CONFIG.PUNISHMENT_TYPES || []).find(p => p.value === punishmentValue);
        if (!pDef) return;
        switch (pDef.action) {
            case 'setPosture':
                if (pDef.params?.posture) CYOA.setPosture(pDef.params.posture);
                break;
            case 'increaseLock': {
                const slots = Object.keys(save.equipment || {});
                if (slots.length > 0) {
                    const slot = slots[Math.floor(Math.random() * slots.length)];
                    const item = save.equipment[slot];
                    if (item) {
                        const curLock = item.lockLevel || 0;
                        if (curLock < 5) item.lockLevel = curLock + 1;
                    }
                }
                break;
            }
            case 'shock': {
                const stims = save.activeStimulators || [];
                const shockDev = stims.find(s => s.stimType === 'shock');
                if (shockDev) {
                    CYOA.modifyArousal(5, 'punishment_shock');
                }
                break;
            }
            case 'shortenTether':
                if (save.tether?.active) {
                    const chains = CONFIG.TETHER_CHAIN_LENGTHS || [];
                    const curIdx = chains.findIndex(c => c.value === save.tether.chainLength);
                    if (curIdx > 0) save.tether.chainLength = chains[curIdx - 1].value;
                }
                break;
            case 'arousalSpike':
                CYOA.modifyArousal(pDef.params?.delta || 15, 'punishment');
                break;
        }
        log('惩罚已执行:', punishmentValue);
        CYOA.persistSave();
    };

    CYOA.applyReward = function(rewardValue) {
        const save = CYOA.currentSave;
        if (!save) return;
        const rDef = (CONFIG.REWARD_TYPES || []).find(r => r.value === rewardValue);
        if (!rDef) return;
        const fondAttr = save.attributes?.find(a => a.name === 'fondness');
        if (fondAttr) {
            fondAttr.value = Math.min(fondAttr.max || 100, fondAttr.value + (rDef.fondnessGain || 3));
        }
        switch (rDef.action) {
            case 'setPosture':
                if (rDef.params?.posture) CYOA.setPosture(rDef.params.posture);
                break;
            case 'tempUnlock': {
                const slots = Object.keys(save.equipment || {});
                const lockedSlot = slots.find(s => (save.equipment[s]?.lockLevel || 0) > 0 && (save.equipment[s]?.lockLevel || 0) < 5);
                if (lockedSlot) save.equipment[lockedSlot].lockLevel = 0;
                break;
            }
            case 'stimOff':
                save.activeStimulators = (save.activeStimulators || []).map(s => ({ ...s, mode: 'off' }));
                break;
            case 'lengthenTether':
                if (save.tether?.active) {
                    const chains = CONFIG.TETHER_CHAIN_LENGTHS || [];
                    const curIdx = chains.findIndex(c => c.value === save.tether.chainLength);
                    if (curIdx < chains.length - 1 && curIdx >= 0) save.tether.chainLength = chains[curIdx + 1].value;
                }
                break;
        }
        log('奖励已执行:', rewardValue);
        CYOA.persistSave();
    };

    // ========== 羞耻/暴露系统 ==========
    CYOA.modifyShame = function(delta, source) {
        const save = CYOA.currentSave;
        if (!save) return;
        const cfg = CONFIG.SHAME_CONFIG || {};
        const desensRate = cfg.desensitizeRate || 0.5;
        const desensThreshold = cfg.desensitizeThreshold || 60;
        let actualDelta = delta;
        if (delta > 0 && (save.shame || 0) >= desensThreshold) {
            const highHab = Object.values(save.habituation || {}).some(v => v >= 60);
            if (highHab) actualDelta = Math.round(delta * desensRate);
        }
        save.shame = Math.max(cfg.min || 0, Math.min(cfg.max || 100, (save.shame || 0) + actualDelta));
        log('羞耻度变化:', actualDelta, '来源:', source, '当前:', save.shame);
    };

    CYOA.getShameTier = function() {
        return findTier(CYOA.currentSave?.shame || 0, 'SHAME_THRESHOLDS', { value: 'composed', label: '镇定' });
    };

    // ========== 呼吸控制系统 ==========
    CYOA.modifyOxygen = function(delta) {
        const save = CYOA.currentSave;
        if (!save) return;
        const cfg = CONFIG.OXYGEN_CONFIG || {};
        save.oxygen = Math.max(cfg.min || 0, Math.min(cfg.max || 100, (save.oxygen ?? 100) + delta));
    };

    CYOA.getOxygenTier = function() {
        const val = CYOA.currentSave?.oxygen ?? 100;
        const tiers = CONFIG.OXYGEN_THRESHOLDS || [];
        for (let i = tiers.length - 1; i >= 0; i--) {
            if (val <= tiers[i].max && val >= tiers[i].min) return tiers[i];
        }
        return tiers[0] || { value: 'normal', label: '正常' };
    };

    CYOA.calculateBreath = function() {
        const save = CYOA.currentSave;
        if (!save) return;
        const cfg = CONFIG.OXYGEN_CONFIG || {};
        let totalDrain = 0;
        const breathDevs = save.breathDevices || [];
        if (breathDevs.length > 0) {
            breathDevs.forEach(d => {
                const def = (CONFIG.BREATH_DEVICE_TYPES || []).find(b => b.value === d.type);
                totalDrain += def?.drainRate || 5;
            });
        }
        // 从装备附件中检测呼吸限制
        const equipment = save.equipment || {};
        Object.values(equipment).forEach(item => {
            if (!item) return;
            const equipDef = CYOA.currentGame?.equipment?.find(e => e.id === item.id);
            const attachments = equipDef?.attachments || item.attachments || [];
            attachments.forEach(att => {
                if (att.type === 'breath_restrict') {
                    const bDef = (CONFIG.BREATH_DEVICE_TYPES || []).find(b => b.value === att.breathType);
                    totalDrain += bDef?.drainRate || 5;
                }
            });
        });
        if (totalDrain > 0) {
            CYOA.modifyOxygen(-totalDrain);
        } else {
            CYOA.modifyOxygen(cfg.normalRecovery || 15);
        }
        // 濒临昏厥时强制姿势
        if ((save.oxygen ?? 100) <= (cfg.dangerThreshold || 10)) {
            const oxyEff = CONFIG.OXYGEN_GAMEPLAY_EFFECTS?.blackout;
            if (oxyEff?.forcePosture) CYOA.setPosture(oxyEff.forcePosture);
        }
    };

    // ========== 打击/鞭打系统 ==========
    CYOA.applyImpact = function(toolValue, zoneValue, intensity) {
        const save = CYOA.currentSave;
        if (!save) return;
        const tool = (CONFIG.IMPACT_TOOLS || []).find(t => t.value === toolValue);
        const zone = (CONFIG.IMPACT_ZONES || []).find(z => z.value === zoneValue);
        if (!tool || !zone) return;
        const cfg = CONFIG.IMPACT_CONFIG || {};
        const mult = intensity || 1.0;
        const painDelta = Math.round(tool.painBase * zone.sensitivity * mult);
        const pleasureDelta = Math.round(tool.pleasureBase * zone.sensitivity * mult);
        save.pain = Math.min(cfg.maxPain || 100, (save.pain || 0) + painDelta);
        // 痛感转化为兴奋度
        if (save.pain >= (cfg.painToPleasureThreshold || 40)) {
            const arousalGain = Math.round(pleasureDelta * (cfg.painToPleasureConversion || 0.3));
            if (arousalGain > 0) CYOA.modifyArousal(arousalGain, 'impact_pleasure');
        }
        // 痕迹
        if (Math.random() < (tool.markChance || 0.3) * mult) {
            if (!save.marks) save.marks = [];
            const markDef = CONFIG.MARK_TYPES?.[tool.markType] || CONFIG.MARK_TYPES?.redness;
            save.marks.push({
                zone: zoneValue,
                type: tool.markType || 'redness',
                intensity: mult,
                turnsRemaining: markDef?.decayTurns || 10,
                tool: toolValue
            });
        }
        log('打击:', toolValue, '→', zoneValue, '痛感+' + painDelta);
        CYOA.persistSave();
    };

    CYOA.decayMarksAndPain = function() {
        const save = CYOA.currentSave;
        if (!save) return;
        const cfg = CONFIG.IMPACT_CONFIG || {};
        save.pain = Math.max(0, (save.pain || 0) - (cfg.painDecayPerTurn || 2));
        if (save.marks) {
            save.marks = save.marks.filter(m => {
                m.turnsRemaining = (m.turnsRemaining || 1) - 1;
                return m.turnsRemaining > 0;
            });
        }
    };

    // ========== 温度游戏系统 ==========
    CYOA.applyTemp = function(toolValue, zoneValue) {
        const save = CYOA.currentSave;
        if (!save) return;
        const tool = (CONFIG.TEMP_TOOLS || []).find(t => t.value === toolValue);
        const zone = (CONFIG.TEMP_ZONES || []).find(z => z.value === zoneValue);
        if (!tool || !zone) return;
        if (!save.bodyTemp) save.bodyTemp = {};
        if (!save.activeTempEffects) save.activeTempEffects = [];
        const delta = Math.round(tool.tempDelta * zone.sensitivity);
        save.activeTempEffects.push({
            zone: zoneValue,
            tool: toolValue,
            tempDelta: delta,
            turnsRemaining: tool.duration || 3
        });
        save.bodyTemp[zoneValue] = (save.bodyTemp[zoneValue] || 0) + delta;
        const cfg = CONFIG.TEMP_CONFIG || {};
        const absTemp = Math.abs(save.bodyTemp[zoneValue]);
        if (absTemp >= (cfg.extremeThreshold || 30)) {
            CYOA.modifyArousal(tool.tempDelta > 0 ? (cfg.arousalFromHot || 2) : (cfg.arousalFromCold || 1), 'temp_play');
        }
        log('温度:', toolValue, '→', zoneValue, '温差:', delta);
        CYOA.persistSave();
    };

    CYOA.decayTemp = function() {
        const save = CYOA.currentSave;
        if (!save) return;
        const cfg = CONFIG.TEMP_CONFIG || {};
        const decay = cfg.decayPerTurn || 5;
        if (save.activeTempEffects) {
            save.activeTempEffects = save.activeTempEffects.filter(e => {
                e.turnsRemaining = (e.turnsRemaining || 1) - 1;
                return e.turnsRemaining > 0;
            });
        }
        if (save.bodyTemp) {
            for (const zone of Object.keys(save.bodyTemp)) {
                if (save.bodyTemp[zone] > 0) save.bodyTemp[zone] = Math.max(0, save.bodyTemp[zone] - decay);
                else if (save.bodyTemp[zone] < 0) save.bodyTemp[zone] = Math.min(0, save.bodyTemp[zone] + decay);
                if (save.bodyTemp[zone] === 0) delete save.bodyTemp[zone];
            }
        }
    };

    // ========== 困境束缚系统 ==========
    CYOA.setPredicament = function(type, components) {
        const save = CYOA.currentSave;
        if (!save) return;
        save.predicament = {
            type,
            components: components || [],
            painAccum: 0,
            turnsActive: 0,
            startedAt: Date.now()
        };
        log('困境已设置:', type);
        CYOA.persistSave();
    };

    CYOA.clearPredicament = function() {
        const save = CYOA.currentSave;
        if (!save) return;
        save.predicament = null;
        CYOA.persistSave();
    };

    CYOA.updatePredicament = function() {
        const save = CYOA.currentSave;
        if (!save?.predicament) return;
        const cfg = CONFIG.PREDICAMENT_CONFIG || {};
        save.predicament.turnsActive++;
        save.predicament.painAccum = Math.min(cfg.maxPain || 100, save.predicament.painAccum + (cfg.painAccumPerTurn || 3));
    };

    // ========== 训练/调教系统 ==========
    CYOA.progressTraining = function(trainingType, success) {
        const save = CYOA.currentSave;
        if (!save) return;
        if (!save.trainings) save.trainings = {};
        if (!save.trainings[trainingType]) {
            save.trainings[trainingType] = { level: 1, progress: 0, sessions: 0 };
        }
        const t = save.trainings[trainingType];
        const cfg = CONFIG.TRAINING_CONFIG || {};
        const delta = success ? (cfg.progressPerSuccess || 20) : (cfg.progressPerFail || -10);
        t.progress = Math.max(0, t.progress + delta);
        t.sessions++;
        if (t.progress >= (cfg.levelUpThreshold || 100) && t.level < (cfg.maxLevel || 5)) {
            t.level++;
            t.progress = 0;
            log('训练升级:', trainingType, '→ Lv.' + t.level);
        }
        log('训练进度:', trainingType, success ? '+' : '-', '当前:', t.progress, 'Lv.' + t.level);
        CYOA.persistSave();
    };

    CYOA.getTrainingLevel = function(trainingType) {
        return CYOA.currentSave?.trainings?.[trainingType]?.level || 0;
    };

    // ========== 感官剥夺增强 ==========
    CYOA.getDeprivationLevel = function() {
        const constraints = CYOA.getActiveConstraints();
        let count = 0;
        if (constraints.has('blind') || constraints.has('vision_restricted')) count++;
        if (constraints.has('deaf')) count++;
        if (constraints.has('mute')) count++;
        const hasBreathRestrict = (CYOA.currentSave?.breathDevices?.length > 0) ||
            Object.values(CYOA.currentSave?.equipment || {}).some(item => {
                if (!item) return false;
                const eDef = CYOA.currentGame?.equipment?.find(e => e.id === item.id);
                return (eDef?.attachments || []).some(a => a.type === 'breath_restrict');
            });
        if (hasBreathRestrict) count++;
        const levels = CONFIG.DEPRIVATION_LEVELS || [];
        for (let i = levels.length - 1; i >= 0; i--) {
            if (count >= levels[i].minSenses) return levels[i];
        }
        return null;
    };

    CYOA.updateDeprivation = function() {
        const save = CYOA.currentSave;
        if (!save) return;
        const level = CYOA.getDeprivationLevel();
        if (level) {
            save.deprivationDuration = (save.deprivationDuration || 0) + 1;
        } else {
            if (save.deprivationDuration > 0) {
                const cfg = CONFIG.DEPRIVATION_CONFIG || {};
                save.sensoryOverload = Math.min(cfg.overloadRecoveryTurns || 5, save.deprivationDuration);
                if (save.sensoryOverload > 0) {
                    CYOA.modifyArousal(cfg.overloadArousalSpike || 15, 'sensory_overload');
                }
            }
            save.deprivationDuration = 0;
        }
        if (save.sensoryOverload > 0) save.sensoryOverload--;
    };

    // ========== 乳胶封闭系统 ==========
    CYOA.calculateLatex = function() {
        const save = CYOA.currentSave;
        if (!save) return;
        const equipment = save.equipment || {};
        const game = CYOA.currentGame;
        let totalCoverage = 0;
        let maxHeatRate = 0;
        let thinnest = null;
        let layerCount = 0;
        let hasSelfTightening = false;
        let hasLiquid = false;
        let dominantColor = null;
        let colorCounts = {};
        let openings = {};
        Object.values(equipment).forEach(item => {
            if (!item) return;
            const eDef = game?.equipment?.find(e => e.id === item.id);
            const attachments = eDef?.attachments || item.attachments || [];
            attachments.forEach(att => {
                if (att.type === 'latex_layer') {
                    layerCount++;
                    totalCoverage += att.latexCoverage || 20;
                    if (att.selfTightening) hasSelfTightening = true;
                    const thickDef = (CONFIG.LATEX_THICKNESS || []).find(t => t.value === (att.latexThickness || 'medium'));
                    if (thickDef) {
                        maxHeatRate = Math.max(maxHeatRate, thickDef.heatRate || 2);
                        if (!thinnest || thickDef.touchMult > thinnest.touchMult) thinnest = thickDef;
                        if (thickDef.isLiquid) hasLiquid = true;
                    }
                    if (att.latexColor) {
                        colorCounts[att.latexColor] = (colorCounts[att.latexColor] || 0) + (att.latexCoverage || 20);
                    }
                    if (att.latexOpenings) {
                        att.latexOpenings.forEach(o => {
                            if (!openings[o.type]) openings[o.type] = o.state || 'zipped';
                        });
                    }
                }
            });
        });
        const layerCfg = CONFIG.LATEX_LAYER_CONFIG || {};
        const maxLayers = layerCfg.maxLayers || 4;
        save.latexLayers = Math.min(maxLayers, layerCount);

        let openCoverageMod = 0;
        const openingTypes = CONFIG.LATEX_OPENING_TYPES || [];
        const openStates = CONFIG.LATEX_OPENING_STATES || {};
        Object.entries(openings).forEach(([type, state]) => {
            if (openStates[state]?.coverageActive) {
                const oDef = openingTypes.find(o => o.value === type);
                if (oDef) openCoverageMod += oDef.coverageMod || 0;
            }
        });
        save.latexCoverage = Math.min(100, Math.max(0, totalCoverage + openCoverageMod));
        save.latexOpenings = openings;

        let maxColorCoverage = 0;
        Object.entries(colorCounts).forEach(([color, cov]) => {
            if (cov > maxColorCoverage) { maxColorCoverage = cov; dominantColor = color; }
        });
        save.latexColor = dominantColor;

        if (totalCoverage > 0) {
            const cfg = CONFIG.LATEX_ENCLOSURE_CONFIG || {};
            const layerMult = layerCount > 1 ? Math.pow(layerCount, layerCfg.layerHeatExponent || 1.5) : 1;
            const heatGain = Math.round((cfg.heatAccumPerTurn || 2) * (maxHeatRate / 2) * (totalCoverage / 100) * layerMult);
            save.latexHeat = Math.min(cfg.maxHeat || 50, (save.latexHeat || 0) + heatGain);

            // 汗液累积
            const swCfg = CONFIG.LATEX_SWEAT_CONFIG || {};
            if ((save.latexHeat || 0) >= (cfg.sweatStartThreshold || 15)) {
                const heatExcess = (save.latexHeat || 0) - (cfg.sweatStartThreshold || 15);
                const sweatGain = Math.round((swCfg.accumRate || 4) * (1 + heatExcess / 20) * (totalCoverage / 100));
                save.latexSweat = Math.min(swCfg.maxSweat || 100, (save.latexSweat || 0) + sweatGain);
            } else {
                save.latexSweat = Math.max(0, (save.latexSweat || 0) - (swCfg.decayRate || 5));
            }

            // 密封状态：有呼吸管时由管控制氧气，否则默认消耗
            if (totalCoverage >= 91) {
                const tube = save.breathingTube;
                if (!tube?.active) {
                    CYOA.modifyOxygen(-(cfg.sealedOxygenDrain || 3));
                }
            }

            // 自紧机制
            const tCfg = CONFIG.LATEX_TIGHTENING_CONFIG || {};
            if (hasSelfTightening) {
                const heatLevel = Math.floor((save.latexHeat || 0) / 10);
                const tightenGain = (tCfg.tightenPerHeatLevel || 3) * heatLevel;
                if (tightenGain > 0) {
                    save.latexTightness = Math.min(tCfg.maxTightness || 100, (save.latexTightness || 0) + tightenGain);
                    CYOA.modifyArousal?.(tCfg.arousalPerTightnessGain || 1, 'latex_tightening');
                    if ((save.latexTightness || 0) > 60) {
                        CYOA.modifyOxygen?.(-(tCfg.breathDrainBonus || 1));
                    }
                }
            } else {
                save.latexTightness = Math.max(0, (save.latexTightness || 0) - (tCfg.cooldownRelaxRate || 2));
            }

            // 护理状态衰减
            const mCfg = CONFIG.LATEX_MAINTENANCE_CONFIG || {};
            save.latexCondition = Math.max(0, (save.latexCondition ?? 100) - (mCfg.decayPerTurn || 2));
        } else {
            save.latexHeat = Math.max(0, (save.latexHeat || 0) - 3);
            save.latexSweat = Math.max(0, (save.latexSweat || 0) - 8);
            save.latexTightness = Math.max(0, (save.latexTightness || 0) - 5);
            save.latexCondition = 100;
            save.latexLayers = 0;
            save.latexColor = null;
            save.latexOpenings = {};
        }
    };

    CYOA.getLatexHeatTier = function() {
        return findTier(CYOA.currentSave?.latexHeat || 0, 'LATEX_HEAT_TIERS', { value: 'cool', label: '凉爽' });
    };

    CYOA.getLatexCoverageTier = function() {
        return findTier(CYOA.currentSave?.latexCoverage || 0, 'LATEX_COVERAGE', null);
    };

    CYOA.getTightnessTier = function() {
        return findTier(CYOA.currentSave?.latexTightness || 0, 'TIGHTNESS_TIERS', { value: 'loose', label: '松弛' });
    };

    CYOA.getLatexSweatTier = function() {
        return findTier(CYOA.currentSave?.latexSweat || 0, 'LATEX_SWEAT_TIERS', { value: 'dry', label: '干燥' });
    };

    CYOA.getPanicTier = function() {
        return findTier(CYOA.currentSave?.panic || 0, 'PANIC_TIERS', { value: 'calm', label: '平静' });
    };

    CYOA.updatePanic = function() {
        const save = CYOA.currentSave;
        if (!save) return;
        const cfg = CONFIG.PANIC_CONFIG || {};
        const maxPanic = cfg.maxPanic || 100;
        let gain = 0;

        const coverage = save.latexCoverage || 0;
        const oxygen = save.oxygen ?? 100;
        const depDur = save.deprivationDuration || 0;
        const habituation = save.habituation?.['latex'] || 0;

        if (coverage >= 91) {
            gain += cfg.sealedGainPerTurn || 3;
            // 首次全封闭恐慌尖峰
            if (!save._hadFullEnclosure) {
                save._hadFullEnclosure = true;
                gain += cfg.firstEnclosureSpike || 25;
            }
        } else {
            save._hadFullEnclosure = false;
        }
        if (oxygen < 50) gain += cfg.lowOxygenGainPerTurn || 5;
        if (depDur > 3) gain += cfg.deprivationGainPerTurn || 2;

        if (habituation > 30) {
            gain = Math.round(gain * (1 - (cfg.habituationReduceFactor || 0.5) * Math.min(1, habituation / 100)));
        }

        if (gain > 0) {
            save.panic = Math.min(maxPanic, (save.panic || 0) + gain);
            if ((save.panic || 0) > 60) {
                CYOA.modifyOxygen?.(-(cfg.panicOxygenDrain || 2));
            }
        } else {
            let decay = cfg.decayPerTurn || 4;
            const tube = save.breathingTube;
            if (tube?.active && tube.flowLevel === 'full') decay += cfg.tubeFullDecayBonus || 3;
            save.panic = Math.max(0, (save.panic || 0) - decay);
        }
    };

    CYOA.getLatexAccessibility = function() {
        const save = CYOA.currentSave;
        if (!save) return {};
        const openings = save.latexOpenings || {};
        const openStates = CONFIG.LATEX_OPENING_STATES || {};
        const result = {};
        Object.entries(openings).forEach(([type, state]) => {
            const sDef = openStates[state];
            result[type] = {
                state,
                accessible: sDef?.accessible || false,
                needsKey: sDef?.needsKey || false
            };
        });
        return result;
    };

    CYOA.soothePanic = function(npcId) {
        const save = CYOA.currentSave;
        if (!save || (save.panic || 0) <= 0) return;
        const cfg = CONFIG.PANIC_CONFIG || {};
        const reduction = cfg.npcSootheDecay || 10;
        save.panic = Math.max(0, save.panic - reduction);
        log('NPC安抚恐慌:', npcId, '-' + reduction, '→', save.panic);
        CYOA.persistSave();
    };

    // ========== 充气系统 ==========
    CYOA.inflateDevice = function(deviceId, delta) {
        const save = CYOA.currentSave;
        if (!save) return;
        if (!save.inflationLevels) save.inflationLevels = {};
        const cfg = CONFIG.INFLATION_CONFIG || {};
        const maxLv = cfg.maxLevel || 5;
        const current = save.inflationLevels[deviceId] || 0;
        save.inflationLevels[deviceId] = Math.max(0, Math.min(maxLv, current + delta));
        log('充气:', deviceId, delta > 0 ? '+' : '', delta, '→ Lv.' + save.inflationLevels[deviceId]);
        CYOA.persistSave();
    };

    // ========== PetPlay / PonyPlay 系统 ==========
    CYOA.setPetplayRole = function(role) {
        const save = CYOA.currentSave;
        if (!save) return;
        const rDef = (CONFIG.PETPLAY_ROLES || []).find(r => r.value === role);
        if (!rDef) { log('无效宠物角色:', role); return; }
        save.petplayRole = role;
        save.petplayImmersion = save.petplayImmersion || 0;
        // 设置对应姿势
        const defaultPosture = role === 'pony' ? 'pony_stand' : 'all_fours';
        CYOA.setPosture(defaultPosture);
        log('PetPlay角色已设置:', role);
        CYOA.persistSave();
    };

    CYOA.clearPetplayRole = function() {
        const save = CYOA.currentSave;
        if (!save) return;
        save.petplayRole = null;
        save.petplayImmersion = 0;
        CYOA.setPosture('standing');
        CYOA.persistSave();
    };

    CYOA.updatePetplay = function() {
        const save = CYOA.currentSave;
        if (!save?.petplayRole) return;
        const cfg = CONFIG.PETPLAY_CONFIG || {};
        save.petplayImmersion = Math.min(cfg.maxImmersion || 100, (save.petplayImmersion || 0) + (cfg.immersionPerTurn || 3));
    };

    CYOA.getPetplayImmersionTier = function() {
        return findTier(CYOA.currentSave?.petplayImmersion || 0, 'PETPLAY_IMMERSION_TIERS', { value: 'resistant', label: '抗拒' });
    };

    // ========== 家具化系统 ==========
    CYOA.setFurnitureRole = function(role) {
        const save = CYOA.currentSave;
        if (!save) return;
        const fDef = (CONFIG.FURNITURE_ROLES || []).find(f => f.value === role);
        if (!fDef) return;
        save.furnitureRole = role;
        save.furnitureEndurance = 0;
        if (fDef.posture) CYOA.setPosture(fDef.posture);
        log('家具角色已设置:', role);
        CYOA.persistSave();
    };

    CYOA.clearFurnitureRole = function() {
        const save = CYOA.currentSave;
        if (!save) return;
        save.furnitureRole = null;
        save.furnitureEndurance = 0;
        CYOA.persistSave();
    };

    CYOA.updateFurniture = function() {
        const save = CYOA.currentSave;
        if (!save?.furnitureRole) return;
        const fDef = (CONFIG.FURNITURE_ROLES || []).find(f => f.value === save.furnitureRole);
        if (!fDef) return;
        const cfg = CONFIG.FURNITURE_CONFIG || {};
        save.furnitureEndurance = Math.min(cfg.maxEndurance || 100, (save.furnitureEndurance || 0) + (fDef.endurancePerTurn || 3));
        if (save.furnitureEndurance >= (cfg.shakeThreshold || 70)) {
            save.pain = Math.min((CONFIG.IMPACT_CONFIG?.maxPain || 100), (save.pain || 0) + 2);
        }
    };

    // ========== 身份侵蚀系统 (Identity Erosion) ==========
    CYOA.updateIdentityErosion = function() {
        const save = CYOA.currentSave;
        if (!save) return;
        if (typeof save.identityErosion !== 'number') save.identityErosion = 0;
        const cfg = CONFIG.IDENTITY_EROSION_CONFIG || {};
        if ((save.latexCoverage || 0) >= (cfg.coverageThreshold || 91)) {
            let gain = cfg.gainPerTurn || 2;
            const latexHab = save.habituation?.['latex'] || 0;
            if (latexHab > 50) gain += Math.floor(gain * (cfg.habituationBoost || 0.5));
            // 颜色对侵蚀的加成
            if (save.latexColor) {
                const colorDef = (CONFIG.LATEX_COLORS || []).find(c => c.value === save.latexColor);
                if (colorDef?.erosionMod) gain += colorDef.erosionMod;
            }
            save.identityErosion = Math.min(cfg.maxErosion || 100, save.identityErosion + gain);
        } else {
            save.identityErosion = Math.max(0, save.identityErosion - (cfg.decayPerTurn || 3));
        }
    };

    CYOA.getIdentityTier = function() {
        return findTier(CYOA.currentSave?.identityErosion || 0, 'IDENTITY_TIERS', { value: 'human', label: '人类' });
    };

    // ========== 护理仪式 (Maintenance Ritual) ==========
    CYOA.polishLatex = function(npcId) {
        const save = CYOA.currentSave;
        if (!save) return;
        const cfg = CONFIG.LATEX_MAINTENANCE_CONFIG || {};
        save.latexCondition = Math.min(cfg.maxCondition || 100, (save.latexCondition ?? 100) + (cfg.polishGain || 25));
        CYOA.modifyShame(cfg.shameFromPolishing || 8, 'latex_polishing');
        if (npcId) {
            const ov = save.characterOverrides?.[npcId];
            if (ov) {
                ov.obedience = Math.min(100, (ov.obedience || 0) + (cfg.obedienceFromPolishing || 5));
            }
        }
        log('乳胶护理完成, 状态:', save.latexCondition);
        CYOA.persistSave();
    };

    CYOA.getMaintenanceEffect = function() {
        const cond = CYOA.currentSave?.latexCondition ?? 100;
        const fx = CONFIG.MAINTENANCE_EFFECTS || {};
        if (cond >= 80) return fx.high || {};
        if (cond >= 50) return fx.medium || {};
        if (cond >= 25) return fx.low || {};
        return fx.poor || {};
    };

    // ========== 呼吸管控制 (Breathing Tube) ==========
    CYOA.setTubeFlow = function(level) {
        const save = CYOA.currentSave;
        if (!save) return;
        if (!save.breathingTube) save.breathingTube = { active: false, flowLevel: 'full', controlledBy: null };
        const levels = CONFIG.BREATHING_TUBE_CONFIG?.flowLevels || {};
        if (!levels[level]) { log('无效流量等级:', level); return; }
        save.breathingTube.active = true;
        save.breathingTube.flowLevel = level;
        log('呼吸管流量设置为:', level);
        CYOA.persistSave();
    };

    CYOA.setTubeController = function(npcId) {
        const save = CYOA.currentSave;
        if (!save) return;
        if (!save.breathingTube) save.breathingTube = { active: true, flowLevel: 'full', controlledBy: null };
        save.breathingTube.controlledBy = npcId;
        CYOA.persistSave();
    };

    // ========== 导电乳胶 (Electro-Conductive Latex) ==========
    CYOA.activateElectro = function(zone, intensity, pattern) {
        const save = CYOA.currentSave;
        if (!save) return;
        if (!save.electroLatex) save.electroLatex = { active: false, zones: [], controlledBy: null };
        save.electroLatex.active = true;
        const existing = save.electroLatex.zones.findIndex(z => z.zone === zone);
        const entry = { zone, intensity: intensity || 'tingle', pattern: pattern || 'constant' };
        if (existing >= 0) {
            save.electroLatex.zones[existing] = entry;
        } else {
            save.electroLatex.zones.push(entry);
        }
        log('导电区域激活:', zone, intensity, pattern);
        CYOA.persistSave();
    };

    CYOA.deactivateElectro = function(zone) {
        const save = CYOA.currentSave;
        if (!save?.electroLatex) return;
        save.electroLatex.zones = save.electroLatex.zones.filter(z => z.zone !== zone);
        if (save.electroLatex.zones.length === 0) save.electroLatex.active = false;
        CYOA.persistSave();
    };

    CYOA.setElectroController = function(npcId) {
        const save = CYOA.currentSave;
        if (!save) return;
        if (!save.electroLatex) save.electroLatex = { active: false, zones: [], controlledBy: null };
        save.electroLatex.controlledBy = npcId;
        CYOA.persistSave();
    };

    // ========== 装备联动姿势系统 (Compound Posture / Gait) ==========
    CYOA.getEquipPostureTags = function() {
        const tags = new Set();
        const save = CYOA.currentSave;
        const game = CYOA.currentGame;
        if (!save?.equipment) return tags;
        for (const slot in save.equipment) {
            const item = save.equipment[slot];
            if (!item) continue;
            const equipDef = game?.equipment?.find(e => e.id === item.id);
            const pt = item.postureTags || equipDef?.postureTags;
            if (Array.isArray(pt)) pt.forEach(t => tags.add(t));
        }
        return tags;
    };

    CYOA.getCurrentGait = function() {
        const tags = CYOA.getEquipPostureTags();
        const save = CYOA.currentSave;
        if (!save) return (CONFIG.GAIT_TYPES || [])[0];
        const weights = CONFIG.GAIT_TAG_WEIGHTS || {};
        let totalWeight = 0;
        tags.forEach(t => { totalWeight += (weights[t] || 0); });
        const gaits = CONFIG.GAIT_TYPES || [];
        if (totalWeight >= 6) return gaits.find(g => g.value === 'immobile') || gaits[gaits.length - 1];
        if (totalWeight >= 4.5) return gaits.find(g => g.value === 'helpless') || gaits[5];
        if (tags.has('forces_tiptoe') && (tags.has('forces_upright') || tags.has('restricts_bending'))) {
            return gaits.find(g => g.value === 'tottering') || gaits[4];
        }
        if (tags.has('restricts_stride') && tags.has('restricts_knee_bend')) {
            return gaits.find(g => g.value === 'hobbling') || gaits[3];
        }
        if (tags.has('restricts_stride') && (tags.has('forces_upright') || tags.has('restricts_bending'))) {
            return gaits.find(g => g.value === 'mincing') || gaits[2];
        }
        if (totalWeight >= 1.5) return gaits.find(g => g.value === 'careful') || gaits[1];
        return gaits[0] || { value: 'normal', label: '正常步态', speedMod: 1.0, fallChance: 0 };
    };

    CYOA.getBlockedPostures = function() {
        const tags = CYOA.getEquipPostureTags();
        const blockers = CONFIG.POSTURE_BLOCKERS || {};
        const blocked = new Set();
        tags.forEach(tag => {
            const list = blockers[tag];
            if (Array.isArray(list)) list.forEach(p => blocked.add(p));
        });
        return blocked;
    };

    CYOA.resolveCompoundPosture = function() {
        const save = CYOA.currentSave;
        if (!save) return null;

        const tags = CYOA.getEquipPostureTags();
        save.activePostureTags = Array.from(tags);
        const gait = CYOA.getCurrentGait();
        save.currentGait = gait.value;
        const blocked = CYOA.getBlockedPostures();
        save.blockedPostures = Array.from(blocked);

        if (blocked.has(save.posture)) {
            const allPostures = CONFIG.POSTURES || [];
            const available = allPostures.filter(p => !blocked.has(p.value));
            const preferred = ['standing', 'kneeling', 'sitting'];
            let newPosture = null;
            for (const pref of preferred) {
                if (available.some(p => p.value === pref)) { newPosture = pref; break; }
            }
            if (!newPosture && available.length > 0) newPosture = available[0].value;
            if (!newPosture) newPosture = 'standing';

            const oldLabel = (allPostures.find(p => p.value === save.posture))?.label || save.posture;
            save.posture = newPosture;
            const newLabel = (allPostures.find(p => p.value === newPosture))?.label || newPosture;
            log('姿势被迫转换:', oldLabel, '→', newLabel);
            CYOA.persistSave();
            return {
                forced: true,
                from: oldLabel,
                to: newLabel,
                narrative: CYOA.t(CONFIG.COMPOUND_POSTURE_NARRATIVES?.forced_transition || '')
            };
        }

        CYOA.persistSave();
        return null;
    };

    CYOA.checkFallRisk = function() {
        const gait = CYOA.getCurrentGait();
        if (gait.fallChance > 0 && Math.random() < gait.fallChance) {
            const save = CYOA.currentSave;
            if (!save) return null;
            save.pain = Math.min((CONFIG.IMPACT_CONFIG?.maxPain || 100), (save.pain || 0) + 10);
            return {
                fell: true,
                gait: gait.label,
                narrative: CYOA.t(CONFIG.COMPOUND_POSTURE_NARRATIVES?.fall_event || '')
            };
        }
        return null;
    };

    // ========== 口水/强制张口系统 (Drool) ==========
    CYOA.updateDrool = function() {
        const save = CYOA.currentSave;
        if (!save) return;
        const constraints = CYOA.getActiveConstraints();
        const cfg = CONFIG.DROOL_CONFIG || {};
        if (constraints.has('forced_open_mouth')) {
            const gagDef = CYOA.getActiveGagType?.();
            if (gagDef?.suppressDrool) {
                save.drool = Math.max(0, (save.drool || 0) - (cfg.naturalSwallow || 3));
            } else {
                save.drool = Math.min(cfg.maxDrool || 100, (save.drool || 0) + (cfg.accumPerTurn || 5));
                if ((save.drool || 0) >= (cfg.messThreshold || 30)) {
                    CYOA.modifyShame?.(cfg.shamePerDrool || 0.5, 'drooling');
                }
            }
        } else {
            save.drool = Math.max(0, (save.drool || 0) - (cfg.naturalSwallow || 3));
        }
    };

    // 通用装备设备查找：遍历当前穿戴装备，按字段名找到匹配的设备类型
    function findEquippedDevice(fieldName, configArrayKey) {
        const save = CYOA.currentSave;
        const game = CYOA.currentGame;
        if (!save?.equipment) return null;
        for (const slot in save.equipment) {
            const item = save.equipment[slot];
            if (!item) continue;
            const equipDef = game?.equipment?.find(e => e.id === item.id);
            const typeVal = item[fieldName] || equipDef?.[fieldName];
            if (typeVal) return (CONFIG[configArrayKey] || []).find(x => x.value === typeVal) || null;
        }
        return null;
    }

    CYOA.getActiveGagType = () => findEquippedDevice('gagType', 'GAG_TYPES');

    CYOA.getActiveEarDevice = function() {
        const earDef = findEquippedDevice('earDeviceType', 'EAR_DEVICE_TYPES');
        if (!earDef) return null;
        const modeDef = (CONFIG.EAR_DEVICE_MODES || {})[earDef.mode] || {};
        return { ...earDef, modeLabel: modeDef.label, modeDesc: modeDef.desc, deaf: modeDef.deaf, hearController: modeDef.hearController };
    };

    CYOA.getActiveFingerRestraint = function() {
        const fingerDef = findEquippedDevice('fingerRestraintType', 'FINGER_RESTRAINT_TYPES');
        if (!fingerDef) return null;
        const shapeDef = (CONFIG.FINGER_SHAPE_EFFECTS || {})[fingerDef.shape] || {};
        return { ...fingerDef, shapeLabel: shapeDef.label, shapeDesc: shapeDef.desc, canGrip: shapeDef.canGrip, canTouch: shapeDef.canTouch, canType: shapeDef.canType, canGesture: shapeDef.canGesture };
    };

    CYOA.getActiveHeadRestrictions = function() {
        const save = CYOA.currentSave;
        if (!save) return { canTurn: true, canNod: true };
        const tags = save.activePostureTags || [];
        return {
            canTurn: !tags.includes('restricts_head_turn') && !tags.includes('forces_head_position'),
            canNod:  !tags.includes('restricts_head_nod') && !tags.includes('forces_head_position')
        };
    };

    // ========== 每轮综合更新 ==========
    CYOA.updateAllSystems = function() {
        CYOA.calculateTurnArousal();
        CYOA.updateDurations();
        CYOA.updateHabituation();
        CYOA.calculateBreath();
        CYOA.decayMarksAndPain();
        CYOA.decayTemp();
        CYOA.updatePredicament();
        CYOA.updateDeprivation();
        CYOA.calculateLatex();
        CYOA.updatePetplay();
        CYOA.updateFurniture();
        CYOA.updateIdentityErosion();
        CYOA.updatePanic();
        // 呼吸管对氧气的影响
        const tube = CYOA.currentSave?.breathingTube;
        if (tube?.active) {
            const levels = CONFIG.BREATHING_TUBE_CONFIG?.flowLevels || {};
            const lv = levels[tube.flowLevel];
            if (lv && lv.oxygenRate) CYOA.modifyOxygen(lv.oxygenRate);
        }
        // 导电乳胶每轮兴奋度
        const electro = CYOA.currentSave?.electroLatex;
        if (electro?.active && electro.zones?.length > 0) {
            const eCfg = CONFIG.ELECTRO_LATEX_CONFIG || {};
            let totalArousal = 0;
            let totalPain = 0;
            electro.zones.forEach(z => {
                const zoneDef = (eCfg.zones || []).find(zd => zd.value === z.zone);
                const intDef = (eCfg.intensityLevels || []).find(i => i.value === z.intensity);
                const sens = zoneDef?.sensitivity || 1;
                totalArousal += (eCfg.baseArousalPerTurn || 3) * (intDef?.arousalMult || 0.5) * sens;
                totalPain += (intDef?.painMult || 0) * 5 * sens;
            });
            if (totalArousal > 0) CYOA.modifyArousal?.(Math.round(totalArousal), 'electro_latex');
            if (totalPain > 0) {
                CYOA.currentSave.pain = Math.min(
                    (CONFIG.IMPACT_CONFIG?.maxPain || 100),
                    (CYOA.currentSave.pain || 0) + Math.round(totalPain)
                );
            }
        }
        // 复合姿势 + 跌倒检测
        CYOA.resolveCompoundPosture();
        CYOA.checkFallRisk();
        // 口水系统
        CYOA.updateDrool();

        // 乳胶颜色 → 羞耻度加成
        const _save = CYOA.currentSave;
        if (_save?.latexColor && (_save.latexCoverage || 0) > 20) {
            const colorDef = (CONFIG.LATEX_COLORS || []).find(c => c.value === _save.latexColor);
            if (colorDef?.shameMod > 0) {
                CYOA.modifyShame?.(colorDef.shameMod * 0.3, 'latex_color');
            }
        }

        // 恐慌 → 属性惩罚
        if ((_save?.panic || 0) > 40) {
            const pCfg = CONFIG.PANIC_CONFIG || {};
            const pTier = CYOA.getPanicTier?.();
            if (pTier && (pTier.value === 'anxious' || pTier.value === 'panicked' || pTier.value === 'meltdown')) {
                const penalty = pCfg.panicAttrPenalty || {};
                const mult = pTier.value === 'meltdown' ? 2 : pTier.value === 'panicked' ? 1.5 : 1;
                Object.entries(penalty).forEach(([attr, val]) => {
                    if (_save.attributes?.[attr] != null) {
                        _save.attributes[attr] = Math.max(0, _save.attributes[attr] + Math.round(val * mult * 0.2));
                    }
                });
            }
        }

        // 羞耻自然衰减
        const shameCfg = CONFIG.SHAME_CONFIG || {};
        if (_save && (_save.shame || 0) > 0) {
            CYOA.modifyShame(-(shameCfg.decayPerTurn || 1), 'natural_decay');
        }

        // ========== 新系统每轮更新 ==========
        CYOA.updateEquipmentTimers();
        CYOA.updateTravel();
        CYOA.updateDependency();
        CYOA.checkDiscoveries();
    };
})();