/**
 * cyoa-wordfilter.js - 敏感词过滤模块
 * 依赖：window.CYOA, CYOA.CONFIG 必须已存在（cyoa-core.js 加载后）
 */
(function() {
    'use strict';
    if (typeof window === 'undefined' || !window.CYOA || !window.CYOA.CONFIG) return;

    const CYOA = window.CYOA;
    const CONFIG = CYOA.CONFIG;

    // 加载用户自定义词表（合并默认词表）
    function loadWordFilter() {
        const defaults = CONFIG.DEFAULT_WORD_FILTER || [];
        let userList = [];
        try {
            const stored = localStorage.getItem(CONFIG.STORAGE_KEYS.WORD_FILTER);
            if (stored) userList = JSON.parse(stored);
        } catch (e) {
            console.warn('[CYOA] 加载用户词表失败', e);
        }
        if (!Array.isArray(userList)) userList = [];
        const merged = new Map();
        defaults.forEach(item => merged.set(item.sensitive, item.safe));
        userList.forEach(item => {
            if (item.sensitive && item.safe) merged.set(item.sensitive, item.safe);
        });
        return merged;
    }

    function saveWordFilter(list) {
        try {
            localStorage.setItem(CONFIG.STORAGE_KEYS.WORD_FILTER, JSON.stringify(list));
        } catch (e) {
            console.error('[CYOA] 保存用户词表失败', e);
        }
    }

    // 缓存已排序的词表，避免每次调用都重新排序
    let _filterCacheSorted = null;   // [sensitive, safe][] 按 sensitive 长度降序
    let _filterCacheReverse = null;  // [safe, sensitive][] 按 safe 长度降序
    let _filterCacheVer = 0;

    function getSortedFilter() {
        const ver = localStorage.getItem(CONFIG.STORAGE_KEYS.WORD_FILTER);
        const verHash = ver ? ver.length : -1;
        if (_filterCacheSorted && _filterCacheVer === verHash) {
            return { forward: _filterCacheSorted, reverse: _filterCacheReverse };
        }
        const map = loadWordFilter();
        const entries = [...map.entries()].filter(([s, r]) => s && r);
        _filterCacheSorted = entries.sort((a, b) => b[0].length - a[0].length);
        _filterCacheReverse = [...entries].sort((a, b) => b[1].length - a[1].length);
        _filterCacheVer = verHash;
        return { forward: _filterCacheSorted, reverse: _filterCacheReverse };
    }

    // 敏感词→安全词（发送给 AI 前 & RAG 预安全化）
    function maskSensitiveWords(text) {
        if (!text) return text;
        const { forward } = getSortedFilter();
        let result = text;
        forward.forEach(([sensitive, safe]) => {
            result = result.split(sensitive).join(safe);
        });
        return result;
    }

    // 安全词→敏感词（AI 回复后，还原给用户阅读）
    // 纯文本反向替换：安全词本身足够独特（如"下体柱身""锁扣式腰封"），误伤概率极低
    function unmaskSensitiveWords(text) {
        if (!text) return text;
        const { reverse } = getSortedFilter();
        let result = text;
        reverse.forEach(([sensitive, safe]) => {
            result = result.split(safe).join(sensitive);
        });
        return result;
    }

    CYOA.loadWordFilter = loadWordFilter;
    CYOA.saveWordFilter = saveWordFilter;
    CYOA.maskSensitiveWords = maskSensitiveWords;
    CYOA.unmaskSensitiveWords = unmaskSensitiveWords;
})();
