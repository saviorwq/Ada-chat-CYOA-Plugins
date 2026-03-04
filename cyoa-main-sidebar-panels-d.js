/**
 * CYOA sidebar panels (part D)
 * Extracted from cyoa-main.js for incremental split.
 */
(function() {
    const CYOA = window.CYOA;
    if (!CYOA || !CYOA.CONFIG) return;

    const CONFIG = CYOA.CONFIG;
    const t = CYOA.t || ((k) => k);
    const escapeHtml = CYOA.escapeHtml || ((s) => String(s || ""));

    function progressBar(pct, color, h = 4) {
        const r = h / 2;
        return `<div style="height:${h}px;background:var(--border);border-radius:${r}px;overflow:hidden;"><div style="height:100%;width:${Math.min(100, pct)}%;background:${color};border-radius:${r}px;transition:width .3s;"></div></div>`;
    }

    // ========== 习惯度面板 ==========
    CYOA.buildHabituationPanel = function() {
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
    };

    // ========== 综合状态面板 ==========
    CYOA.buildComprehensiveStatusPanel = function() {
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
    };
})();
