/**
 * CYOA 插件数据管理模块 v2.1
 * 包含：API调用（自动探测后端）、localStorage回退、数据操作、图片压缩
 */

(function() {
    const CYOA = window.CYOA;
    if (!CYOA || !CYOA.CONFIG) {
        console.error('[CYOA] 核心模块未加载');
        return;
    }

    const CONFIG = CYOA.CONFIG;
    const log = CYOA.log;
    const error = CYOA.error;

    // ========== 后端可用性探测 ==========
    let _storageMode = null; // null=未检测, 'api'=服务端, 'local'=localStorage
    let _apiBase = '';       // 探测成功后的 API 基础 URL（含 ? 或 &）

    function apiUrl(action, extraParams) {
        return `${_apiBase}action=${action}${extraParams ? '&' + extraParams : ''}&_=${Date.now()}`;
    }

    async function probeUrl(url) {
        try {
            const resp = await fetch(url);
            if (!resp.ok) return false;
            const text = await resp.text();
            if (!text || text.trim() === '') return false;
            const data = JSON.parse(text);
            return data && data.success !== undefined;
        } catch (_) { return false; }
    }

    async function detectStorageMode() {
        if (_storageMode !== null) return _storageMode;

        const candidates = [
            `api.php?plugin=cyoa&`,                       // 新版插件路由
            `${CONFIG.API_URL}?plugin=cyoa&`,             // 用户自定义 URL + 插件路由
            `${CONFIG.API_URL}?`,                         // 旧版直连（api.php 硬编码路由）
            `cyoa_api.php?`                               // 独立 CYOA API 文件
        ];
        const tried = new Set();

        for (const base of candidates) {
            if (tried.has(base)) continue;
            tried.add(base);
            const testUrl = `${base}action=list_games&_=${Date.now()}`;
            if (await probeUrl(testUrl)) {
                _apiBase = base;
                _storageMode = 'api';
                log(`后端可用，使用服务端存储 (${base.replace(/[?&]$/, '')})`);
                return _storageMode;
            }
        }

        _storageMode = 'local';
        log('后端不可用，回退到 localStorage 存储');
        DataManager.loadGames();
        return _storageMode;
    }

    // ========== API 调用函数（带自动回退） ==========
    async function loadGamesList() {
        await detectStorageMode();

        if (_storageMode === 'local') {
            DataManager.loadGames();
            CYOA.games = DataManager.games.map(g => ({
                id: g.id,
                name: g.name || '未命名',
                author: g.author || '',
                updatedAt: g.updatedAt || '',
                characters: Array.isArray(g.characters) ? g.characters.length : 0,
                scenes: Array.isArray(g.scenes) ? g.scenes.length : 0
            }));
            log(`[localStorage] 加载 ${CYOA.games.length} 个游戏`);
            return CYOA.games;
        }

        try {
            const response = await fetch(apiUrl('list_games'));
            const text = await response.text();

            if (!text || text.trim() === '') {
                console.warn('[CYOA] API返回空响应');
                CYOA.games = [];
                return CYOA.games;
            }

            try {
                const data = JSON.parse(text);
                if (data && data.success) {
                    CYOA.games = data.games || [];
                    log(`成功加载 ${CYOA.games.length} 个游戏`);
                } else {
                    console.error('[CYOA] API返回错误:', data);
                    CYOA.games = [];
                }
            } catch (e) {
                console.error('[CYOA] JSON解析失败:', text.substring(0, 200));
                CYOA.games = [];
            }
        } catch (e) {
            error('加载游戏列表失败，回退到 localStorage', e);
            _storageMode = 'local';
            return await loadGamesList();
        }
        return CYOA.games;
    }

    async function loadGameFromFile(gameId) {
        await detectStorageMode();

        if (_storageMode === 'local') {
            DataManager.loadGames();
            const game = DataManager.getGameById(gameId);
            if (game) {
                log(`[localStorage] 加载游戏: ${gameId}`);
            } else {
                error(`[localStorage] 未找到游戏: ${gameId}`);
            }
            return game || null;
        }

        try {
            const response = await fetch(apiUrl('load_game', `id=${encodeURIComponent(gameId)}`));
            const text = await response.text();

            if (!text || text.trim() === '') {
                error('游戏文件为空');
                return null;
            }

            try {
                const gameData = JSON.parse(text);
                return gameData;
            } catch (e) {
                error('解析游戏数据失败', e);
                console.error('原始响应:', text.substring(0, 200));
                return null;
            }
        } catch (e) {
            error('加载游戏失败，回退到 localStorage', e);
            _storageMode = 'local';
            return await loadGameFromFile(gameId);
        }
    }

    async function saveGameToFile(gameData) {
        await detectStorageMode();

        if (_storageMode === 'local') {
            try {
                DataManager.loadGames();
                DataManager.saveGame(gameData);
                log(`[localStorage] 游戏保存成功: ${gameData.id}`);
                return true;
            } catch (e) {
                error('[localStorage] 保存游戏失败', e);
                return false;
            }
        }

        try {
            const response = await fetch(apiUrl('save_game'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(gameData)
            });

            const text = await response.text();

            if (!text || text.trim() === '') {
                error('API返回空响应');
                return false;
            }

            try {
                const result = JSON.parse(text);
                if (result.success) {
                    log('游戏保存成功:', gameData.id);
                    return true;
                } else {
                    error('保存失败:', result.error);
                    return false;
                }
            } catch (e) {
                error('解析响应失败', e);
                console.error('原始响应:', text.substring(0, 200));
                return false;
            }
        } catch (e) {
            error('保存游戏失败，回退到 localStorage', e);
            _storageMode = 'local';
            return await saveGameToFile(gameData);
        }
    }

    async function deleteGameFile(gameId) {
        await detectStorageMode();

        if (_storageMode === 'local') {
            try {
                DataManager.loadGames();
                DataManager.deleteGame(gameId);
                log(`[localStorage] 游戏删除成功: ${gameId}`);
                return true;
            } catch (e) {
                error('[localStorage] 删除游戏失败', e);
                return false;
            }
        }

        try {
            const response = await fetch(apiUrl('delete_game'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: gameId })
            });
            if (!response.ok) {
                error(`删除请求失败: HTTP ${response.status}`);
                return false;
            }
            const text = await response.text();
            if (!text || text.trim() === '') {
                error('API 返回空响应');
                return false;
            }

            try {
                const result = JSON.parse(text);
                return result.success === true;
            } catch (e) {
                error('解析响应失败', e);
                return false;
            }
        } catch (e) {
            error('删除游戏失败，回退到 localStorage', e);
            _storageMode = 'local';
            return await deleteGameFile(gameId);
        }
    }

    // ========== 本地数据管理 ==========
    const DataManager = {
        games: [],
        saves: {},

        loadGames: function() {
            try {
                const stored = localStorage.getItem(CONFIG.STORAGE_KEYS.GAMES);
                if (stored) {
                    this.games = JSON.parse(stored);
                } else {
                    this.games = [];
                    this.saveGames();
                }
                return this.games;
            } catch (e) {
                console.error('[CYOA] 加载游戏列表失败', e);
                this.games = [];
                return this.games;
            }
        },

        saveGames: function() {
            try {
                localStorage.setItem(CONFIG.STORAGE_KEYS.GAMES, JSON.stringify(this.games));
            } catch (e) {
                console.error('[CYOA] 保存游戏列表失败', e);
            }
        },

        loadSaves: function() {
            try {
                const stored = localStorage.getItem(CONFIG.STORAGE_KEYS.SAVES);
                this.saves = stored ? JSON.parse(stored) : {};
            } catch (e) {
                console.error('[CYOA] 加载存档失败', e);
                this.saves = {};
            }
        },

        saveSaves: function() {
            try {
                const clean = {};
                for (const [k, s] of Object.entries(this.saves || {})) {
                    if (!s || !s._ragCache) { clean[k] = s; continue; }
                    const { _ragCache, _ragVersion, ...rest } = s;
                    clean[k] = rest;
                }
                localStorage.setItem(CONFIG.STORAGE_KEYS.SAVES, JSON.stringify(clean));
            } catch (e) {
                console.error('[CYOA] 保存存档失败', e);
            }
        },

        getGameById: function(id) {
            return this.games.find(g => g.id === id);
        },

        saveGame: function(game) {
            const index = this.games.findIndex(g => g.id === game.id);
            game.updatedAt = new Date().toISOString();

            if (index >= 0) {
                this.games[index] = game;
            } else {
                game.createdAt = new Date().toISOString();
                this.games.push(game);
            }
            this.saveGames();
            CYOA.invalidateRAG?.();
        },

        deleteGame: function(id) {
            this.games = this.games.filter(g => g.id !== id);
            this.saveGames();
        }
    };

    // ========== 图片压缩 ==========
    function compressImage(file, maxSizeMB = 2) {
        return new Promise((resolve, reject) => {
            if (!file.type.startsWith('image/')) {
                reject(new Error('不是图片文件'));
                return;
            }

            const reader = new FileReader();
            reader.onload = function(e) {
                const img = new Image();
                img.src = e.target.result;
                img.onload = function() {
                    const maxSizeBytes = maxSizeMB * 1024 * 1024;
                    let quality = 0.9;
                    let canvas = document.createElement('canvas');
                    let ctx = canvas.getContext('2d');
                    if (!ctx) { reject(new Error('无法创建 Canvas 2D 上下文')); return; }
                    
                    let width = img.width;
                    let height = img.height;
                    const maxDimension = 1920;
                    
                    if (width > maxDimension || height > maxDimension) {
                        if (width > height) {
                            height = Math.round(height * (maxDimension / width));
                            width = maxDimension;
                        } else {
                            width = Math.round(width * (maxDimension / height));
                            height = maxDimension;
                        }
                    }
                    
                    canvas.width = width;
                    canvas.height = height;
                    ctx.drawImage(img, 0, 0, width, height);
                    
                    let compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
                    while (compressedDataUrl.length > maxSizeBytes * 1.37 && quality > 0.1) {
                        quality -= 0.1;
                        compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
                    }
                    
                    resolve(compressedDataUrl);
                };
                img.onerror = reject;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    // ========== 获取模型列表 ==========
    function getChatModels() {
        try {
            if (typeof MainApp !== 'undefined' && MainApp.getModels) {
                const models = MainApp.getModels('chat');
                if (Array.isArray(models) && models.length > 0) {
                    return models;
                }
            }
        } catch (e) {
            error('获取模型列表失败', e);
        }
        return [];
    }

    // ========== 获取物品列表（用于下拉框） ==========
    function getItemsForSelect(excludeId = null) {
        if (!CYOA.editorTempData || !CYOA.editorTempData.items) return [];
        return CYOA.editorTempData.items
            .filter(item => item.id !== excludeId)
            .map(item => ({
                value: item.id,
                label: `${item.name} (${CYOA.getItemTypeLabel(item.itemType)})`
            }));
    }

    // ========== 获取技能列表 ==========
    function getSkillsForSelect(excludeId = null) {
        if (!CYOA.editorTempData || !CYOA.editorTempData.skills) return [];
        return CYOA.editorTempData.skills
            .filter(skill => skill.id !== excludeId)
            .map(skill => ({
                value: skill.id,
                label: `${skill.name} (${CYOA.getSkillTypeLabel(skill.skillType)})`
            }));
    }

    // ========== 解析属性修饰符 ==========
    function parseStatModifiers(modStr) {
        if (!modStr) return {};
        if (typeof modStr !== 'string') return {};
        const modifiers = {};
        const parts = modStr.split(',').map(p => p.trim());
        parts.forEach(p => {
            const match = p.match(/([^+-]+)([+-])(\d+)/);
            if (match) {
                const [, attr, op, val] = match;
                modifiers[attr.trim()] = op === '+' ? parseInt(val) : -parseInt(val);
            }
        });
        return modifiers;
    }

    // ========== 应用属性修饰符 ==========
    function applyStatModifiers(modifiers, add, targetSave = null) {
        const save = targetSave || CYOA.currentSave;
        if (!save || !save.attributes) return;
        
        save.attributes.forEach(attr => {
            if (Object.prototype.hasOwnProperty.call(modifiers, attr.name)) {
                const change = add ? modifiers[attr.name] : -modifiers[attr.name];
                const minVal = typeof attr.min === 'number' ? attr.min : -Infinity;
                const maxVal = typeof attr.max === 'number' ? attr.max : Infinity;
                attr.value = Math.max(minVal, Math.min(maxVal, attr.value + change));
            }
        });
    }

    // ========== 规则说明书解析 ==========
    function parseRuleBook(text) {
        const result = {
            attributes: [],
            items: [],
            equipment: [],
            skills: [],      // 新增
            quests: [],       // 新增
            characters: [],
            scenes: [],
            rules: {}
        };
        
        try {
            const lines = text.split('\n');
            let currentSection = null;
            
            for (let line of lines) {
                line = line.trim();
                if (!line || line.startsWith('//')) continue;
                
                if (line.includes('属性系统') || line.match(/^#+\s*属性/i)) {
                    currentSection = 'attributes';
                    continue;
                } else if (line.includes('物品系统') || line.match(/^#+\s*物品/i)) {
                    currentSection = 'items';
                    continue;
                } else if (line.includes('装备系统') || line.match(/^#+\s*装备/i)) {
                    currentSection = 'equipment';
                    continue;
                } else if (line.includes('技能系统') || line.match(/^#+\s*技能/i)) {  // 新增
                    currentSection = 'skills';
                    continue;
                } else if (line.includes('任务系统') || line.match(/^#+\s*任务/i)) {  // 新增
                    currentSection = 'quests';
                    continue;
                } else if (line.includes('角色设定') || line.match(/^#+\s*角色/i)) {
                    currentSection = 'characters';
                    continue;
                } else if (line.includes('场景设定') || line.match(/^#+\s*场景/i)) {
                    currentSection = 'scenes';
                    continue;
                } else if (line.includes('判定规则') || line.match(/^#+\s*规则/i)) {
                    currentSection = 'rules';
                    continue;
                }
                
                if (!currentSection) continue;
                
                switch (currentSection) {
                    case 'attributes':
                        const attrMatch = line.match(/([^,]+),(\d+),(\d+),(\d+),(.+)/);
                        if (attrMatch) {
                            result.attributes.push({
                                id: CYOA.generateId(),
                                name: attrMatch[1].trim(),
                                value: parseInt(attrMatch[2]),
                                min: parseInt(attrMatch[3]),
                                max: parseInt(attrMatch[4]),
                                description: attrMatch[5].trim()
                            });
                        }
                        break;
                        
                    case 'items':
                        const itemMatch = line.match(/([^,]+),([^,]+),(.+),(\w+),(\d*),([^,]*),(.*)/);
                        if (itemMatch) {
                            result.items.push({
                                id: CYOA.generateId(),
                                name: itemMatch[1].trim(),
                                itemType: itemMatch[2].trim(),
                                description: itemMatch[3].trim(),
                                locked: itemMatch[4].trim().toLowerCase() === 'true',
                                durability: parseInt(itemMatch[5]) || 0,  // 耐久度
                                unlockItemId: itemMatch[6].trim(),
                                statModifiers: itemMatch[7].trim(),
                                icon: '',
                                skills: [],      // 新增：附带的技能
                                consumeItems: [] // 新增：消耗的其他物品
                            });
                        }
                        break;
                        
                    case 'equipment':
                        const equipMatch = line.match(/([^,]+),([^,]+),([^,]+),(.+),(\w+),(\d+),(\d*),([^,]*),(.*)/);
                        if (equipMatch) {
                            result.equipment.push({
                                id: CYOA.generateId(),
                                name: equipMatch[1].trim(),
                                equipType: equipMatch[2].trim(),
                                slots: equipMatch[3].trim().split('|'),
                                description: equipMatch[4].trim(),
                                locked: equipMatch[5].trim().toLowerCase() === 'true',
                                durability: parseInt(equipMatch[6]) || 0,  // 当前耐久
                                maxDurability: parseInt(equipMatch[7]) || 0, // 最大耐久
                                unlockItemId: equipMatch[8].trim(),
                                statModifiers: equipMatch[9].trim(),
                                icon: '',
                                skills: []       // 新增：附带的技能
                            });
                        }
                        break;
                        
                    case 'skills':  // 新增技能解析
                        const skillMatch = line.match(/([^,]+),([^,]+),([^,]+),(.+),(\w+),(\d*),([^,]*),(.*)/);
                        if (skillMatch) {
                            result.skills.push({
                                id: CYOA.generateId(),
                                name: skillMatch[1].trim(),
                                skillType: skillMatch[2].trim(),
                                description: skillMatch[3].trim(),
                                effect: skillMatch[4].trim(),
                                unlockType: skillMatch[5].trim(),
                                requiredAttributes: skillMatch[6].trim(), // 属性要求
                                consumeItems: skillMatch[7].trim(),       // 消耗物品
                                learned: false,
                                icon: ''
                            });
                        }
                        break;
                        
                    case 'quests':  // 新增任务解析
                        const questMatch = line.match(/([^,]+),([^,]+),([^,]+),(.+),(\w+),([^,]*),(.*)/);
                        if (questMatch) {
                            result.quests.push({
                                id: CYOA.generateId(),
                                name: questMatch[1].trim(),
                                questType: questMatch[2].trim(),
                                description: questMatch[3].trim(),
                                objectives: questMatch[4].trim().split('|'),
                                status: questMatch[5].trim(),
                                rewards: questMatch[6].trim().split('|'),
                                unlockCondition: questMatch[7].trim(),
                                progress: {},
                                started: false,
                                completed: false
                            });
                        }
                        break;
                        
                    case 'characters':
                        const charMatch = line.match(/([^,]+),([^,]+),(.*?),(.*?),(.*?),(.+)/);
                        if (charMatch) {
                            result.characters.push({
                                id: CYOA.generateId(),
                                name: charMatch[1].trim(),
                                roleType: charMatch[2].trim(),
                                model: charMatch[3].trim() || '',
                                personality: charMatch[4].trim().split('|').filter(p => p.trim()),
                                hobbies: charMatch[5].trim().split('|').filter(h => h.trim()),
                                background: charMatch[6].trim(),
                                avatar: '',
                                skills: []  // 新增：角色拥有的技能
                            });
                        }
                        break;
                        
                    case 'scenes':
                        const sceneMatch = line.match(/([^,]+),([^,]+),(.*?),(.+)/);
                        if (sceneMatch) {
                            let interactables = [];
                            try {
                                interactables = JSON.parse(sceneMatch[4].trim());
                            } catch {
                                interactables = sceneMatch[4].trim().split('|').map(i => ({
                                    name: i,
                                    function: '',
                                    effect: '',
                                    attributeEffect: ''
                                }));
                            }
                            
                            result.scenes.push({
                                id: CYOA.generateId(),
                                name: sceneMatch[1].trim(),
                                location: sceneMatch[2].trim(),
                                decoration: sceneMatch[3].trim(),
                                interactables: interactables,
                                background: '',
                                quests: []  // 新增：场景关联的任务
                            });
                        }
                        break;
                        
                    case 'rules':
                        if (line.startsWith('判定：')) {
                            result.rules.judgment = line.substring(3).trim();
                        } else if (line.startsWith('成功/失败：')) {
                            result.rules.successFailure = line.substring(6).trim();
                        } else if (line.startsWith('自定义：')) {
                            result.rules.custom = line.substring(4).trim();
                        }
                        break;
                }
            }
        } catch (e) {
            error('解析规则说明书失败', e);
        }
        
        return result;
    }

    // ========== 导出到全局 ==========
    CYOA.loadGamesList = loadGamesList;
    CYOA.loadGameFromFile = loadGameFromFile;
    CYOA.saveGameToFile = saveGameToFile;
    CYOA.deleteGameFile = deleteGameFile;
    CYOA.detectStorageMode = detectStorageMode;
    CYOA.getStorageMode = function() { return _storageMode; };
    CYOA.DataManager = DataManager;
    CYOA.compressImage = compressImage;
    CYOA.getChatModels = getChatModels;
    CYOA.getItemsForSelect = getItemsForSelect;
    CYOA.getSkillsForSelect = getSkillsForSelect;
    CYOA.parseStatModifiers = parseStatModifiers;
    CYOA.applyStatModifiers = applyStatModifiers;
    CYOA.parseRuleBook = parseRuleBook;

    log('CYOA 数据模块加载完成');
})();