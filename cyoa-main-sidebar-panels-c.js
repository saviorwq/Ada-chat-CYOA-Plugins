/**
 * CYOA sidebar panels (part C)
 * Extracted from cyoa-main.js for incremental split.
 */
(function() {
    const CYOA = window.CYOA;
    if (!CYOA || !CYOA.CONFIG) return;

    const CONFIG = CYOA.CONFIG;
    const t = CYOA.t || ((k) => k);
    const escapeHtml = CYOA.escapeHtml || ((s) => String(s || ""));

    // ========== 纪律状态面板 ==========
    CYOA.buildDisciplinePanel = function() {
        const save = CYOA.currentSave;
        const game = CYOA.currentGame;
        if (!save || !game) return '';
        const npcChars = game.characters?.filter(c => c.roleType !== 'playable' && (c.disciplineRules?.length > 0 || c.customRules?.length > 0)) || [];
        if (npcChars.length === 0) return '';

        const obAttr = save.attributes?.find(a => a.name === 'obedience');
        const fnAttr = save.attributes?.find(a => a.name === 'fondness');
        const recentV = (save.violations || []).slice(-5);

        let html = '';

        if (obAttr) {
            const obPct = Math.round((obAttr.value / (obAttr.max || 100)) * 100);
            const obColor = obPct >= 70 ? '#22c55e' : obPct >= 40 ? '#f59e0b' : '#ef4444';
            html += `<div style="margin-bottom:4px; font-size:11px;">${t('ui.sidebar.obedience')}<span style="color:${obColor}; font-weight:600;">${obAttr.value}/${obAttr.max || 100}</span></div>`;
        }
        if (fnAttr) {
            const fnPct = Math.round((fnAttr.value / (fnAttr.max || 100)) * 100);
            const fnColor = fnPct >= 70 ? '#ec4899' : fnPct >= 40 ? '#f59e0b' : '#94a3b8';
            html += `<div style="margin-bottom:6px; font-size:11px;">${t('ui.sidebar.affection')}<span style="color:${fnColor}; font-weight:600;">${fnAttr.value}/${fnAttr.max || 100}</span></div>`;
        }

        npcChars.forEach(npc => {
            html += `<div style="font-size:11px; color:var(--text-light); margin-bottom:2px;">[${escapeHtml(npc.name)}]</div>`;
            html += '<div style="display:flex; flex-wrap:wrap; gap:3px; margin-bottom:4px;">';
            (npc.disciplineRules || []).forEach(rv => {
                const rd = (CONFIG.DISCIPLINE_RULES || []).find(r => r.value === rv);
                if (!rd) return;
                const sevDef = CONFIG.DISCIPLINE_SEVERITY?.[rd.severity] || {};
                html += `<span style="font-size:10px; padding:1px 5px; background:${sevDef.color || '#666'}22; color:${sevDef.color || '#666'}; border-radius:3px; border:1px solid ${sevDef.color || '#666'}44;" title="${escapeHtml(rd.description)}">${escapeHtml(rd.label)}</span>`;
            });
            (npc.customRules || []).forEach(cr => {
                html += `<span style="font-size:10px; padding:1px 5px; background:#6366f122; color:#6366f1; border-radius:3px; border:1px solid #6366f144;" title="${escapeHtml(cr)}">${t('ui.sidebar.customBadge')}</span>`;
            });
            html += '</div>';
        });

        if (recentV.length > 0) {
            html += '<div style="font-size:10px; color:#ef4444; margin-top:4px;">' + t('ui.sidebar.recentViolation') + recentV.map(v => {
                const rd = (CONFIG.DISCIPLINE_RULES || []).find(r => r.value === v.rule);
                return escapeHtml(rd?.label || v.rule);
            }).join(', ') + '</div>';
        }

        return html;
    };

    // ========== RAG 知识库面板 ==========
    CYOA.buildRAGPanel = function() {
        const save = CYOA.currentSave;
        if (!save) return '<div style="color:#888;padding:6px">未开始游戏</div>';
        const ragText = save._ragCache || '';
        const ragTime = save._ragVersion ? new Date(save._ragVersion).toLocaleTimeString() : '--';
        const ragLen = ragText.length;

        const memCfg = CYOA.CONFIG?.MEMORY_CONFIG || {};
        const history = save.conversationHistory || [];
        const turns = Math.floor(history.length / 2);
        const summary = save.storySummary || '';
        const chSummaries = save.chapterSummaries || [];
        const keyEvents = save.keyEvents || [];

        let html = '<div style="padding:6px;font-size:12px;line-height:1.6">';
        html += `<div style="margin-bottom:6px">📦 <b>RAG缓存</b>：${ragLen > 0 ? ragLen + '字' : '<span style="color:#f44">未生成</span>'}`;
        if (ragLen > 0) html += ` <span style="color:#888">(${ragTime})</span>`;
        html += '</div>';

        html += `<div style="margin-bottom:6px">💬 <b>对话轮次</b>：${turns} / ${memCfg.recentTurns || 6}</div>`;
        html += `<div style="margin-bottom:6px">📝 <b>故事摘要</b>：${summary ? summary.length + '字' : '<span style="color:#888">无</span>'}</div>`;
        html += `<div style="margin-bottom:6px">📖 <b>章节摘要</b>：${chSummaries.length}条</div>`;
        html += `<div style="margin-bottom:8px">⭐ <b>关键事件</b>：${keyEvents.length}条</div>`;

        html += '<div style="display:flex;gap:6px">';
        html += '<button id="cyoa-rag-rebuild" class="cyoa-btn" style="flex:1;padding:4px 8px;font-size:11px">🔄 重建RAG</button>';
        html += '<button id="cyoa-rag-view" class="cyoa-btn" style="flex:1;padding:4px 8px;font-size:11px">👁️ 查看RAG</button>';
        html += '</div>';
        html += '</div>';
        return html;
    };

    CYOA.buildMapQuickTravelPanel = function() {
        const save = CYOA.currentSave;
        const game = CYOA.currentGame;
        if (!save || !game) return '<div style="color:#888;padding:6px">未开始游戏</div>';
        const allLocs = Array.isArray(game.locations) ? game.locations : [];
        if (!allLocs.length) return '<div style="font-size:12px; color:var(--text-light);">未配置地点</div>';
        const getLocKey = (loc) => String(loc?.id || loc?.name || '').trim();
        const regions = Array.isArray(game?.worldMap?.regions) ? game.worldMap.regions : [];
        const regionMap = new Map(regions.map(r => [String(r?.id || '').trim(), r]));
        const resolveRegionIdForLocation = (loc) => {
            const explicit = String(loc?.regionId || '').trim();
            if (explicit) return explicit;
            const locId = String(loc?.id || '').trim();
            const locName = String(loc?.name || '').trim();
            if (!locId && !locName) return '';
            const matched = regions.find((r) => {
                const ids = Array.isArray(r?.locationIds) ? r.locationIds : [];
                return ids.some((v) => {
                    const key = String(v || '').trim();
                    return !!key && (key === locId || key === locName);
                });
            });
            return String(matched?.id || '').trim();
        };
        const readGeoAlias = (obj, keys) => {
            for (const k of keys) {
                const v = String(obj?.[k] || '').trim();
                if (v) return v;
            }
            return '';
        };
        const truncateUtf8Bytes = (value, maxBytes = 6) => {
            const s = String(value || '').trim();
            if (!s) return '';
            let out = '';
            let used = 0;
            for (const ch of s) {
                const bytes = new TextEncoder().encode(ch).length;
                if (used + bytes > maxBytes) break;
                out += ch;
                used += bytes;
            }
            return out || s.slice(0, 1);
        };
        const formatLocationHierarchyLabel = (loc) => {
            const regionId = resolveRegionIdForLocation(loc);
            const region = regionMap.get(regionId);
            const smallMap = readGeoAlias(loc, ['smallMap', 'subMap', 'miniMap']) || String(region?.name || regionId || '未设').trim() || '未设';
            const bigMap = readGeoAlias(loc, ['bigMap', 'mainMap']) || String(game?.worldMap?.name || '未设').trim() || '未设';
            const smallWorld = readGeoAlias(loc, ['smallWorld', 'subWorld', 'microWorld'])
                || readGeoAlias(region, ['smallWorld', 'subWorld', 'microWorld'])
                || readGeoAlias(game?.worldSetting, ['smallWorld', 'subWorld', 'microWorld'])
                || '未设';
            const bigWorld = readGeoAlias(loc, ['bigWorld', 'mainWorld', 'worldName'])
                || readGeoAlias(game?.worldSetting, ['bigWorld', 'mainWorld', 'worldName', 'title', 'name'])
                || String(game?.name || '').trim()
                || '未设';
            const baseName = String(loc?.name || loc?.id || '未命名地点').trim();
            return `${baseName}(${truncateUtf8Bytes(smallMap)},${truncateUtf8Bytes(bigMap)},${truncateUtf8Bytes(smallWorld)},${truncateUtf8Bytes(bigWorld)})`;
        };
        const knownIdsRaw = (typeof CYOA.getKnownLocationIds === 'function')
            ? CYOA.getKnownLocationIds(save)
            : [String(save.currentLocation || '').trim()];
        const knownSet = new Set((knownIdsRaw || []).map(v => String(v || '').trim()).filter(Boolean));
        const allLocKeys = allLocs.map(getLocKey).filter(Boolean);
        let fallbackAllLocations = false;
        if (!knownSet.size) {
            fallbackAllLocations = true;
            allLocKeys.forEach(k => knownSet.add(k));
        }
        const currentRaw = String(save.currentLocation || '').trim();
        const currentLoc = allLocs.find(loc => {
            const key = getLocKey(loc);
            return key === currentRaw || String(loc?.id || '').trim() === currentRaw || String(loc?.name || '').trim() === currentRaw;
        });
        const from = String(currentLoc?.id || currentLoc?.name || currentRaw).trim();
        const constraints = CYOA.getActiveConstraints?.() || new Set();
        const isLimited = constraints.has('limited_step');
        const edgeList = Array.isArray(game.locationEdges) ? game.locationEdges : [];
        const gameLimitedExtra = Number(game?.travelRules?.limitedStepExtraTurns);
        const defaultLimitedExtra = Number(CYOA.CONFIG?.LOCATION_DEFAULTS?.limitedStepExtraTurns ?? 2);
        const rows = allLocs
            .filter(loc => {
                const id = String(loc?.id || '').trim();
                const name = String(loc?.name || '').trim();
                const key = getLocKey(loc);
                return knownSet.has(id) || knownSet.has(name) || knownSet.has(key);
            })
            .map((loc) => {
                const id = getLocKey(loc);
                const name = String(loc?.name || id).trim();
                const displayName = formatLocationHierarchyLabel(loc);
                const isCurrent = id === from;
                const regionId = resolveRegionIdForLocation(loc);
                const edge = edgeList.find(e =>
                    (
                        (String(e?.from || '') === from || String(e?.from || '') === currentRaw) &&
                        (String(e?.to || '') === id || String(e?.to || '') === String(loc?.id || '').trim() || String(e?.to || '') === String(loc?.name || '').trim())
                    ) ||
                    (
                        (String(e?.to || '') === from || String(e?.to || '') === currentRaw) &&
                        (String(e?.from || '') === id || String(e?.from || '') === String(loc?.id || '').trim() || String(e?.from || '') === String(loc?.name || '').trim())
                    )
                );
                const reachable = !isCurrent && (!edgeList.length || !!edge);
                const base = Number(edge?.travelTurns ?? CYOA.CONFIG?.LOCATION_DEFAULTS?.defaultTravelTurns ?? 6);
                const baseTurns = Number.isFinite(base) && base > 0 ? Math.round(base) : 6;
                const edgeLimitedExtra = Number(edge?.limitedStepExtraTurns);
                const limitedExtra = Number.isFinite(edgeLimitedExtra)
                    ? edgeLimitedExtra
                    : (Number.isFinite(gameLimitedExtra) ? gameLimitedExtra : defaultLimitedExtra);
                const eta = baseTurns + (isLimited ? Math.max(0, Math.round(limitedExtra)) : 0);
                return { id, name, displayName, regionId, isCurrent, reachable, eta };
            })
            .sort((a, b) => (a.isCurrent === b.isCurrent ? a.name.localeCompare(b.name, 'zh-Hans-CN') : (a.isCurrent ? -1 : 1)));
        const traveling = !!save.travelingTo;
        const grouped = [];
        const used = new Set();
        const currentRegionId = String((rows.find(x => x.isCurrent)?.regionId) || '').trim();
        const sortRegionItems = (arr) => arr.slice().sort((a, b) => {
            if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1;
            if (a.reachable !== b.reachable) return a.reachable ? -1 : 1;
            if (a.eta !== b.eta) return a.eta - b.eta;
            return a.name.localeCompare(b.name, 'zh-Hans-CN');
        });
        regions.forEach((r) => {
            const rid = String(r?.id || '').trim();
            const rname = String(r?.name || rid || '未命名区域').trim();
            const items = sortRegionItems(rows.filter(x => String(x.regionId || '') === rid));
            if (!items.length) return;
            used.add(rid);
            grouped.push({ id: rid, name: rname, items });
        });
        const ungrouped = sortRegionItems(rows.filter(x => !String(x.regionId || '').trim() || !used.has(String(x.regionId || '').trim())));
        if (ungrouped.length) grouped.push({ id: '__ungrouped__', name: '未分区地点', items: ungrouped });
        grouped.sort((a, b) => {
            const aCur = a.id !== '__ungrouped__' && a.id === currentRegionId;
            const bCur = b.id !== '__ungrouped__' && b.id === currentRegionId;
            if (aCur !== bCur) return aCur ? -1 : 1;
            if (a.id === '__ungrouped__' && b.id !== '__ungrouped__') return 1;
            if (b.id === '__ungrouped__' && a.id !== '__ungrouped__') return -1;
            return a.name.localeCompare(b.name, 'zh-Hans-CN');
        });
        const renderItemBtn = (r) => `
            <button type="button"
                class="cyoa-btn cyoa-btn-secondary"
                data-cyoa-map-go="${escapeHtml(r.id)}"
                ${r.isCurrent || !r.reachable || traveling ? 'disabled' : ''}
                style="display:flex; justify-content:space-between; align-items:center; padding:5px 8px; font-size:11px; text-align:left;">
                <span>${r.isCurrent ? '📍 ' : '🧭 '}${escapeHtml(r.displayName || r.name)}</span>
                <span style="color:var(--text-light);">${r.isCurrent ? '当前位置' : (r.reachable ? `~${r.eta}回合` : '不可直达')}</span>
            </button>
        `;
        return `
            <div style="font-size:11px; color:var(--text-light); margin-bottom:8px;">
                ${fallbackAllLocations
                    ? '未检测到已知地点记录，已自动展示全部地点。'
                    : '仅显示已知（去过）地点；快速到达会消耗同等回合。'}
            </div>
            <div style="display:flex; flex-direction:column; gap:6px;">
                ${grouped.map(g => `
                    <div style="border:1px solid var(--border); border-radius:8px; overflow:hidden;">
                        <div style="padding:5px 8px; font-size:11px; font-weight:600; background:var(--bg);">
                            ${escapeHtml(g.name)}
                            ${g.id !== '__ungrouped__' && g.id === currentRegionId ? '<span style="margin-left:6px; font-size:10px; color:var(--primary);">（当前区域）</span>' : ''}
                        </div>
                        <div style="display:flex; flex-direction:column; gap:4px; padding:6px; background:var(--bg-light);">
                            ${g.items.map(renderItemBtn).join('')}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    };

    CYOA.renderMapPanel = function() {
        const container = document.getElementById('cyoaMapPanel');
        if (!container || !CYOA.currentSave) return;
        container.innerHTML = CYOA.buildMapQuickTravelPanel();
        container.querySelectorAll('[data-cyoa-map-go]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const to = String(btn.getAttribute('data-cyoa-map-go') || '').trim();
                if (!to) return;
                CYOA.travelTo?.(to);
                CYOA.renderSidebar?.();
            });
        });
    };
})();
