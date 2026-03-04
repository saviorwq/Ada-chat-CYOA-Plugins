/**
 * CYOA core settings module.
 * Extracted from cyoa-core.js to reduce monolith size.
 */
(function() {
    const CYOA = window.CYOA;
    const CONFIG = CYOA?.CONFIG;
    if (!CYOA || !CONFIG) return;

    const PROFILE_VALUES = ['small_7b_9b', 'medium_13b_34b', 'large_70b_plus'];
    const GUARD_PROFILE_VALUES = ['strict', 'balanced', 'free'];

    function normalizeChatTemperature(v, fallback) {
        const raw = Number(v);
        const base = Number.isFinite(raw) ? raw : Number(fallback);
        if (!Number.isFinite(base)) return 0.15;
        return Math.max(0, Math.min(1, Math.round(base * 100) / 100));
    }

    function normalizeTopP(v, fallback) {
        const raw = Number(v);
        const base = Number.isFinite(raw) ? raw : Number(fallback);
        if (!Number.isFinite(base)) return 0.9;
        return Math.max(0, Math.min(1, Math.round(base * 100) / 100));
    }

    function getDefaultPluginSettings() {
        return {
            AI_BYPASS_COST_OPTIMIZER: true, // 默认关闭省钱策略
            WORD_FILTER_ENABLED: true,
            AI_CHAT_TEMPERATURE: 0.15, // 默认收敛温度，减少自由发挥
            AI_TOP_P: 0.9, // nucleus sampling，建议与温度协同收敛
            AI_GUARD_PROFILE: 'strict', // 约束档位：strict / balanced / free
            AI_MODEL_PROFILE: 'small_7b_9b',
            AI_DEFINITION_HEARTBEAT_TURNS: 6,
            ALLOW_LOCAL_FALLBACK: false, // 默认禁用 localStorage 回退
            LLM_TUNINGS: []
        };
    }

    function normalizeLLMTunings(list) {
        const src = Array.isArray(list) ? list : [];
        const fallbackId = CYOA.generateId || (() => `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
        return src
            .slice(0, 10)
            .map((it) => {
                const row = it && typeof it === 'object' ? it : {};
                const model = String(row.model || '').trim();
                const targetId = String(row.targetId || '').trim() || '__narrator__';
                const instruction = String(row.instruction || '').trim();
                const label = String(row.label || '').trim();
                return {
                    id: String(row.id || ('llm_tune_' + fallbackId())).trim(),
                    enabled: row.enabled !== false,
                    model,
                    targetId,
                    label,
                    instruction
                };
            })
            .filter((it) => !!it.model && !!it.targetId && !!it.instruction);
    }

    function loadPluginSettings() {
        try {
            const raw = localStorage.getItem(CONFIG.STORAGE_KEYS.SETTINGS);
            const parsed = raw ? JSON.parse(raw) : {};
            const def = getDefaultPluginSettings();
            const modelProfileRaw = String(parsed.AI_MODEL_PROFILE || def.AI_MODEL_PROFILE).trim();
            const modelProfile = PROFILE_VALUES.includes(modelProfileRaw)
                ? modelProfileRaw
                : def.AI_MODEL_PROFILE;
            const guardProfileRaw = String(parsed.AI_GUARD_PROFILE || def.AI_GUARD_PROFILE).trim().toLowerCase();
            const guardProfile = GUARD_PROFILE_VALUES.includes(guardProfileRaw)
                ? guardProfileRaw
                : def.AI_GUARD_PROFILE;
            const heartbeatRaw = Number(parsed.AI_DEFINITION_HEARTBEAT_TURNS);
            const heartbeatTurns = Number.isFinite(heartbeatRaw) && heartbeatRaw >= 1 && heartbeatRaw <= 30
                ? Math.round(heartbeatRaw)
                : Number(def.AI_DEFINITION_HEARTBEAT_TURNS || 6);
            const chatTemperature = normalizeChatTemperature(parsed.AI_CHAT_TEMPERATURE, def.AI_CHAT_TEMPERATURE);
            const topP = normalizeTopP(parsed.AI_TOP_P, def.AI_TOP_P);
            return {
                AI_BYPASS_COST_OPTIMIZER: parsed.AI_BYPASS_COST_OPTIMIZER !== undefined
                    ? !!parsed.AI_BYPASS_COST_OPTIMIZER
                    : def.AI_BYPASS_COST_OPTIMIZER,
                WORD_FILTER_ENABLED: parsed.WORD_FILTER_ENABLED !== undefined
                    ? !!parsed.WORD_FILTER_ENABLED
                    : def.WORD_FILTER_ENABLED,
                AI_CHAT_TEMPERATURE: chatTemperature,
                AI_TOP_P: topP,
                AI_GUARD_PROFILE: guardProfile,
                AI_MODEL_PROFILE: modelProfile,
                AI_DEFINITION_HEARTBEAT_TURNS: heartbeatTurns,
                ALLOW_LOCAL_FALLBACK: parsed.ALLOW_LOCAL_FALLBACK !== undefined
                    ? !!parsed.ALLOW_LOCAL_FALLBACK
                    : def.ALLOW_LOCAL_FALLBACK,
                LLM_TUNINGS: normalizeLLMTunings(parsed.LLM_TUNINGS || def.LLM_TUNINGS)
            };
        } catch (_) {
            return getDefaultPluginSettings();
        }
    }

    function savePluginSettings(settings) {
        const def = getDefaultPluginSettings();
        const modelProfileRaw = String(settings?.AI_MODEL_PROFILE || def.AI_MODEL_PROFILE).trim();
        const modelProfile = PROFILE_VALUES.includes(modelProfileRaw)
            ? modelProfileRaw
            : def.AI_MODEL_PROFILE;
        const guardProfileRaw = String(settings?.AI_GUARD_PROFILE || def.AI_GUARD_PROFILE).trim().toLowerCase();
        const guardProfile = GUARD_PROFILE_VALUES.includes(guardProfileRaw)
            ? guardProfileRaw
            : def.AI_GUARD_PROFILE;
        const heartbeatRaw = Number(settings?.AI_DEFINITION_HEARTBEAT_TURNS);
        const heartbeatTurns = Number.isFinite(heartbeatRaw) && heartbeatRaw >= 1 && heartbeatRaw <= 30
            ? Math.round(heartbeatRaw)
            : Number(def.AI_DEFINITION_HEARTBEAT_TURNS || 6);
        const chatTemperature = normalizeChatTemperature(settings?.AI_CHAT_TEMPERATURE, def.AI_CHAT_TEMPERATURE);
        const topP = normalizeTopP(settings?.AI_TOP_P, def.AI_TOP_P);
        const normalized = {
            AI_BYPASS_COST_OPTIMIZER: settings?.AI_BYPASS_COST_OPTIMIZER !== undefined
                ? !!settings.AI_BYPASS_COST_OPTIMIZER
                : def.AI_BYPASS_COST_OPTIMIZER,
            WORD_FILTER_ENABLED: settings?.WORD_FILTER_ENABLED !== undefined
                ? !!settings.WORD_FILTER_ENABLED
                : def.WORD_FILTER_ENABLED,
            AI_CHAT_TEMPERATURE: chatTemperature,
            AI_TOP_P: topP,
            AI_GUARD_PROFILE: guardProfile,
            AI_MODEL_PROFILE: modelProfile,
            AI_DEFINITION_HEARTBEAT_TURNS: heartbeatTurns,
            ALLOW_LOCAL_FALLBACK: settings?.ALLOW_LOCAL_FALLBACK !== undefined
                ? !!settings.ALLOW_LOCAL_FALLBACK
                : def.ALLOW_LOCAL_FALLBACK,
            LLM_TUNINGS: normalizeLLMTunings(settings?.LLM_TUNINGS || def.LLM_TUNINGS)
        };
        // 清理历史遗留字段：旧版 AI 自动纠偏重试已下线
        if (Object.prototype.hasOwnProperty.call(normalized, 'AI_DRIFT_CORRECTION_ENABLED')) {
            delete normalized.AI_DRIFT_CORRECTION_ENABLED;
        }
        localStorage.setItem(CONFIG.STORAGE_KEYS.SETTINGS, JSON.stringify(normalized));
        return normalized;
    }

    function matchLlmTuningTarget(row, context) {
        const targetId = String(row?.targetId || '__narrator__').trim() || '__narrator__';
        if (targetId === '__narrator__') return true;

        const game = context?.game || CYOA.currentGame || {};
        const strictFrame = context?.strictFrame || {};
        const presentSet = new Set(
            (Array.isArray(strictFrame?.presentCharacters) ? strictFrame.presentCharacters : [])
                .map(v => String(v || '').trim().toLowerCase())
                .filter(Boolean)
        );
        if (!presentSet.size) return false;

        const chars = Array.isArray(game?.characters) ? game.characters : [];
        const targetDef = chars.find(c => {
            const cid = String(c?.id || '').trim();
            const cname = String(c?.name || '').trim();
            return cid === targetId || cname === targetId;
        });
        const aliases = [
            targetId,
            String(targetDef?.id || '').trim(),
            String(targetDef?.name || '').trim()
        ]
            .map(v => v.toLowerCase())
            .filter(Boolean);
        return aliases.some(v => presentSet.has(v));
    }

    function getModelTunings(modelValue, context) {
        const model = String(modelValue || '').trim();
        if (!model) return [];
        const settings = loadPluginSettings();
        const rows = normalizeLLMTunings(settings?.LLM_TUNINGS || []);
        return rows.filter((r) => r.enabled !== false && r.model === model && matchLlmTuningTarget(r, context));
    }

    function getModelTuningPrompt(modelValue, context) {
        const rows = getModelTunings(modelValue, context);
        if (!rows.length) return '';
        return rows
            .map((r, idx) => {
                const title = r.label ? `[${r.label}]` : `[Rule ${idx + 1}]`;
                return `${title}\n${r.instruction}`;
            })
            .join('\n\n');
    }

    function setAiBypassCostOptimizer(enabled) {
        const val = !!enabled;
        CONFIG.AI_BYPASS_COST_OPTIMIZER = val;
        const current = loadPluginSettings();
        current.AI_BYPASS_COST_OPTIMIZER = val;
        savePluginSettings(current);
        return val;
    }

    // post-init: 读取插件设置并应用
    const pluginSettings = loadPluginSettings();
    CONFIG.AI_BYPASS_COST_OPTIMIZER = pluginSettings.AI_BYPASS_COST_OPTIMIZER !== false;
    CONFIG.WORD_FILTER_ENABLED = pluginSettings.WORD_FILTER_ENABLED !== false;
    CONFIG.AI_CHAT_TEMPERATURE = normalizeChatTemperature(pluginSettings.AI_CHAT_TEMPERATURE, 0.15);
    CONFIG.AI_TOP_P = normalizeTopP(pluginSettings.AI_TOP_P, 0.9);
    CONFIG.AI_GUARD_PROFILE = GUARD_PROFILE_VALUES.includes(String(pluginSettings.AI_GUARD_PROFILE || '').toLowerCase())
        ? String(pluginSettings.AI_GUARD_PROFILE || '').toLowerCase()
        : 'strict';
    CONFIG.AI_MODEL_PROFILE = String(pluginSettings.AI_MODEL_PROFILE || 'small_7b_9b');
    CONFIG.AI_DEFINITION_HEARTBEAT_TURNS = Math.max(1, Number(pluginSettings.AI_DEFINITION_HEARTBEAT_TURNS || 6));
    CONFIG.ALLOW_LOCAL_FALLBACK = pluginSettings.ALLOW_LOCAL_FALLBACK === true;
    CONFIG.LLM_TUNINGS = normalizeLLMTunings(pluginSettings.LLM_TUNINGS || []);
    CONFIG.CONSTRAINT_MODIFIER_REMOVE_SCOPE = 'by_equip';

    CYOA.getDefaultPluginSettings = getDefaultPluginSettings;
    CYOA.loadPluginSettings = loadPluginSettings;
    CYOA.savePluginSettings = savePluginSettings;
    CYOA.setAiBypassCostOptimizer = setAiBypassCostOptimizer;
    CYOA.getModelTunings = getModelTunings;
    CYOA.getModelTuningPrompt = getModelTuningPrompt;
    CYOA.normalizeLLMTunings = normalizeLLMTunings;
})();
