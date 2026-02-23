/**
 * CYOA 插件游戏运行模块 v2.1
 * 包含：游戏启动、AI交互、状态管理、装备系统、技能系统、任务系统
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
    function persistSave() {
        if (!CYOA.saves) CYOA.saves = {};
        if (CYOA.currentSave && CYOA.currentSave.id) {
            CYOA.saves[CYOA.currentSave.id] = CYOA.currentSave;
        }
        if (CYOA.DataManager) {
            CYOA.DataManager.saves = CYOA.saves;
            CYOA.DataManager.saveSaves();
        }
    }
    const escapeHtml = CYOA.escapeHtml;
    const getItemTypeLabel = CYOA.getItemTypeLabel;
    const getSkillTypeLabel = CYOA.getSkillTypeLabel;
    const getQuestTypeLabel = CYOA.getQuestTypeLabel;
    const parseStatModifiers = CYOA.parseStatModifiers;
    const applyStatModifiers = CYOA.applyStatModifiers;
    const t = CYOA.t;

    // 添加标志位防止重复退出
    let isExiting = false;

    // ========== 敏感词过滤系统 ==========
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

    // ========== 游戏阶段状态 ==========
    CYOA._gamePhase = 'idle'; // 'idle' | 'welcome' | 'playing'
    CYOA._pendingGameData = null;

    // ========== 游戏启动（显示欢迎界面） ==========
    CYOA.startGame = async function(gameId, roleName) {
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
            
            // 向后兼容：迁移游戏定义中的 locked boolean -> lockLevel
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
            
            // 在 setGameMode 隐藏 UI 之前，主动保存模型/供应商信息
            // （MainApp.setGameMode 内部因 $ 函数 bug 无法正确读取）
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
            
            // 如果指定了角色名，跳过欢迎界面直接开始
            if (roleName) {
                CYOA.beginGame(roleName);
                return;
            }
            
            // 显示欢迎界面
            CYOA._renderWelcomeScreen(gameData);
            
        } catch (e) {
            error('启动游戏时发生错误:', e);
            alert(t('ui.msg.startFailed', {error: e.message}));
        }
    };

    // ========== 渲染欢迎界面 ==========
    CYOA._renderWelcomeScreen = function(gameData) {
        const logEl = document.getElementById('log');
        if (!logEl) return;
        
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
        
        // 获取初始穿戴装备列表
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

    // ========== 正式开始游戏（从欢迎界面进入） ==========
    CYOA.beginGame = function(roleName) {
        const gameData = CYOA._pendingGameData || CYOA.currentGame;
        if (!gameData) { alert(t('ui.msg.gameDataLost')); return; }
        
        // 从欢迎界面获取选中角色
        if (!roleName) {
            const selectedEl = document.querySelector('.cyoa-welcome-char.selected');
            roleName = selectedEl?.getAttribute('data-char-name') || '';
            if (!roleName) {
                const playable = (gameData.characters || []).find(c => c.roleType === 'playable' || c.role === 'playable');
                roleName = playable?.name || '';
            }
        }
        
        const playerChar = gameData.characters?.find(c => c.name === roleName);
        const playerCharId = playerChar?.id || '';
        
        // 按归属过滤物品：属于玩家角色的道具放入初始背包
        const allItems = gameData.items ? JSON.parse(JSON.stringify(gameData.items)) : [];
        const playerItems = allItems.filter(item => item.ownerId && item.ownerId === playerCharId);
        
        // 创建新存档
        const saveId = 'save_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8);
        CYOA.currentSave = {
            id: saveId,
            gameId: gameData.id,
            name: t('ui.game.newAdventure') + ' ' + new Date().toLocaleString(),
            createdAt: Date.now(),
            updatedAt: Date.now(),
            playerCharacter: roleName,
            playerCharacterId: playerCharId,
            currentChapter: gameData.initialChapter || null,
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
            settings: { maxHistoryMessages: 50, autoSummarize: true, summarizeThreshold: 40 }
        };
        
        // 确保约束系统所需的属性存在
        const requiredStats = new Set();
        if (CONFIG.CONSTRAINT_DEFAULT_ACTIONS) {
            CONFIG.CONSTRAINT_DEFAULT_ACTIONS.forEach(action => {
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
        
        // 初始化技能等级和熟练度
        if (CYOA.currentSave.skills) {
            const minLv = CONFIG.SKILL_MIN_LEVEL || 1;
            CYOA.currentSave.skills.forEach(s => {
                if (!s.level) s.level = minLv;
                if (typeof s.proficiency !== 'number') s.proficiency = 0;
            });
        }
        
        // 初始化任务状态
        if (CYOA.currentSave.quests) {
            CYOA.currentSave.quests.forEach(q => {
                q.status = q.status || 'locked';
                q.started = false;
                q.completed = false;
            });
        }
        
        // ===== 初始穿戴装备 =====
        if (gameData.equipment && playerCharId) {
            const startEquips = gameData.equipment.filter(e => e.startEquipped && e.ownerId === playerCharId);
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

        // 保存存档
        if (!CYOA.saves) CYOA.saves = {};
        CYOA.saves[saveId] = CYOA.currentSave;
        if (CYOA.DataManager) {
            CYOA.DataManager.saves = CYOA.saves;
            CYOA.DataManager.saveSaves();
        }
        
        // 切换到游戏阶段
        CYOA._gamePhase = 'playing';
        CYOA._pendingGameData = null;
        
        // 刷新控制栏
        const gameBar = document.getElementById('gameModeBar');
        if (gameBar) {
            gameBar.innerHTML = CYOA.renderGameControls();
        }
        
        // 创建初始节点
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
        
        if (CYOA.DataManager) { CYOA.DataManager.saveSaves(); }
        
        // 显示初始消息
        const logEl = document.getElementById('log');
        if (logEl) {
            logEl.innerHTML = '';
            const aiDiv = document.createElement('div');
            aiDiv.className = 'ai';
            aiDiv.textContent = initialMessage;
            logEl.appendChild(aiDiv);
        }
        
        CYOA.renderSidebar();
        
        // 绑定输入框键盘事件
        CYOA._bindInputKeyHandler();
    };

    // ========== 退出游戏 ==========
    CYOA.exitGame = function() {
        if (isExiting) {
            log('已经在退出过程中，忽略重复调用');
            return;
        }
        
        isExiting = true;
        log('退出游戏模式');
        
        // 1. 先通知主程序退出游戏模式，让它做自己的清理
        window.gameExitCallback = null;
        if (typeof MainApp !== 'undefined' && MainApp.setGameMode) {
            try {
                MainApp.setGameMode(false);
            } catch (e) {
                console.error('MainApp.setGameMode(false) 失败:', e);
            }
        }
        
        // 2. 后备清理：MainApp.setGameMode(false) 内部用 $(id) 即
        //    document.getElementById(id) 查找 '#gameModeBar'（带 # 前缀），
        //    getElementById 不支持 CSS 选择器写法，导致返回 null，
        //    gameModeBar 永远不会被移除。这里用正确的方式强制清除。
        try {
            const gameBar = document.getElementById('gameModeBar');
            if (gameBar && gameBar.parentNode) {
                gameBar.parentNode.removeChild(gameBar);
            }
            
            // 移除游戏侧边栏
            const sidebarContainer = document.getElementById('cyoa-sidebar-container');
            if (sidebarContainer && sidebarContainer.parentNode) {
                sidebarContainer.parentNode.removeChild(sidebarContainer);
            }
            
            // 移除任何可能的游戏特定元素
            const gameElements = document.querySelectorAll(
                '.cyoa-game-sidebar, .cyoa-game-controls, [id^="cyoa_"], ' +
                '#cyoa-game-sidebar, #cyoa-game-input-area'
            );
            gameElements.forEach(el => {
                if (el && el.parentNode) {
                    el.parentNode.removeChild(el);
                }
            });
            
            // 清理插件创建的任何覆盖层
            const overlays = document.querySelectorAll('.cyoa-modal-overlay, .cyoa-popup');
            overlays.forEach(overlay => {
                if (overlay && overlay.parentNode) {
                    overlay.parentNode.removeChild(overlay);
                }
            });
            
            // 恢复 Ada Chat 原始输入区域（setGameMode 可能因同样的 $ 问题未能恢复）
            const dropZone = document.getElementById('dropZone');
            if (dropZone) {
                dropZone.style.display = 'block';
            }
            
            const controlsBar = document.querySelector('.controls-bar');
            if (controlsBar) {
                controlsBar.style.display = 'flex';
            }
            
            document.querySelectorAll(
                '.input-row, .controls-row, .upload-btn, .send-btn, ' +
                '#category, #providerSelect, #model, #modeRow'
            ).forEach(el => {
                if (el) el.style.display = '';
            });
            
            // 恢复 body 类
            document.body.classList.remove('game-mode-active');
            document.body.classList.remove('cyoa-game-mode');
            
            // 恢复主区域布局
            const mainElement = document.querySelector('.main');
            if (mainElement) {
                mainElement.style.display = '';
                mainElement.style.flexDirection = '';
            }
            
        } catch (e) {
            console.error('清理游戏界面时出错:', e);
        }
        
        // 3. 清理游戏状态
        CYOA._gamePhase = 'idle';
        CYOA._pendingGameData = null;
        CYOA.currentGame = null;
        CYOA.currentSave = null;
        CYOA.currentNodeId = null;
        
        // 4. 清空游戏期间写入 #log 的所有消息
        const logEl = document.getElementById('log');
        if (logEl) {
            logEl.innerHTML = '';
        }

        // 5. 刷新主界面，恢复原本的对话记录
        if (typeof renderCurrentConversation === 'function') {
            try {
                renderCurrentConversation();
            } catch (e) {
                console.error('刷新主界面失败:', e);
            }
        }
        
        // 6. 清除保存的游戏模式模型信息
        window.gameModeModel = null;
        window.gameModeProvider = null;
        
        setTimeout(() => {
            isExiting = false;
            log('退出游戏模式完成');
        }, 500);
    };

    // ========== 章节流程控制 ==========
    CYOA.evaluateCondition = function(cond) {
        const save = CYOA.currentSave;
        if (!save || !cond) return false;
        switch (cond.type) {
            case 'quest_complete': {
                if (!cond.questId) return false;
                const quest = (save.quests || []).find(q => q.id === cond.questId);
                return quest && quest.status === 'completed';
            }
            case 'has_item': {
                if (!cond.itemId) return false;
                const item = (save.inventory || []).find(i => i.id === cond.itemId || i.itemId === cond.itemId);
                const qty = item ? (item.quantity || 1) : 0;
                return qty >= (cond.quantity || 1);
            }
            case 'attribute_check': {
                if (!cond.attribute) return false;
                const attrs = save.attributes || {};
                const val = typeof attrs === 'object' && !Array.isArray(attrs)
                    ? (attrs[cond.attribute] ?? 0)
                    : (Array.isArray(attrs) ? (attrs.find(a => (a.name || a.id) === cond.attribute)?.value ?? 0) : 0);
                const target = cond.value ?? 0;
                switch (cond.operator) {
                    case '>=': return val >= target;
                    case '<=': return val <= target;
                    case '==': return val === target;
                    case '>': return val > target;
                    case '<': return val < target;
                    default: return false;
                }
            }
            default:
                return false;
        }
    };

    CYOA.changeChapter = function(chapterId) {
        const save = CYOA.currentSave;
        const game = CYOA.currentGame;
        if (!save || !game) return;

        const oldChapterId = save.currentChapter;
        const newChapter = (game.chapters || []).find(ch => ch.id === chapterId);
        if (!newChapter) {
            log('changeChapter: 目标章节不存在', chapterId);
            return;
        }

        // 标记旧章节为已完成 + 生成纪要
        if (oldChapterId) {
            if (!save.completedChapters) save.completedChapters = [];
            if (!save.completedChapters.includes(oldChapterId)) {
                save.completedChapters.push(oldChapterId);
            }
            CYOA._generateChapterSummary(oldChapterId).catch(() => {});
        }

        save.currentChapter = chapterId;
        CYOA.addKeyEvent('chapter_enter', '进入：' + newChapter.title);
        newChapter.unlocked = true;

        // 在 #log 中显示章节切换通知
        const logEl = document.getElementById('log');
        if (logEl) {
            const banner = document.createElement('div');
            banner.style.cssText = 'text-align:center; padding:14px 20px; margin:12px 0; border-radius:10px; font-size:15px; font-weight:700; background:linear-gradient(135deg,#eff6ff,#dbeafe); color:#1d4ed8; border:2px solid #60a5fa;';
            banner.textContent = t('ui.chapter.advance', {order: newChapter.order || '?', title: newChapter.title});
            logEl.appendChild(banner);
            logEl.scrollTop = logEl.scrollHeight;
        }

        // 应用章节初始姿势/牵引预设
        if (newChapter.initialPosture) {
            save.posture = newChapter.initialPosture;
        }
        if (newChapter.initialTether && newChapter.initialTether.active) {
            save.tether = JSON.parse(JSON.stringify(newChapter.initialTether));
        }

        log('章节切换:', oldChapterId, '->', chapterId, newChapter.title);

        persistSave();
        CYOA.renderChaptersPanel?.();
    };

    CYOA.checkChapterTransition = function() {
        const save = CYOA.currentSave;
        const game = CYOA.currentGame;
        if (!save || !game || !save.currentChapter) return;

        const chapters = game.chapters || [];
        const currentChapter = chapters.find(ch => ch.id === save.currentChapter);
        if (!currentChapter) return;

        const conditions = currentChapter.transitionConditions;
        if (!Array.isArray(conditions) || conditions.length === 0) return;

        const allMet = conditions.every(c => CYOA.evaluateCondition(c));
        if (!allMet) return;

        // 找到按 order 排序的下一个章节
        const sorted = [...chapters].sort((a, b) => (a.order || 0) - (b.order || 0));
        const currentIdx = sorted.findIndex(ch => ch.id === currentChapter.id);
        if (currentIdx < 0 || currentIdx >= sorted.length - 1) return;

        const nextChapter = sorted[currentIdx + 1];
        if (nextChapter) {
            CYOA.changeChapter(nextChapter.id);
        }
    };

    // ========== 牵引 / 姿势管理 API ==========
    CYOA.setTether = function(tetherConfig) {
        const save = CYOA.currentSave;
        if (!save) return;
        save.tether = {
            active: true,
            type: tetherConfig.type || 'npc_lead',
            sourceSlot: tetherConfig.sourceSlot || null,
            targetType: tetherConfig.targetType || 'npc',
            targetId: tetherConfig.targetId || null,
            targetName: tetherConfig.targetName || '',
            chainLength: tetherConfig.chainLength || 'leash'
        };
        // 锚点高度强制姿势
        if (tetherConfig.type === 'fixed_anchor' || tetherConfig.type === 'suspended') {
            const anchorDef = (CONFIG.ANCHOR_HEIGHTS || []).find(h => h.value === tetherConfig.anchorHeight);
            if (anchorDef && anchorDef.forcedPosture) {
                save.posture = anchorDef.forcedPosture;
            }
        }
        if (tetherConfig.type === 'suspended') {
            save.posture = 'suspended';
        }
        persistSave();
        log('牵引已设置:', save.tether);
    };

    CYOA.clearTether = function() {
        const save = CYOA.currentSave;
        if (!save) return;
        save.tether = {
            active: false, type: null, sourceSlot: null,
            targetType: null, targetId: null, targetName: '', chainLength: 'leash'
        };
        if (save.posture === 'suspended') {
            save.posture = 'standing';
        }
        persistSave();
        log('牵引已解除');
    };

    CYOA.setPosture = function(posture) {
        const save = CYOA.currentSave;
        if (!save) return;
        const valid = (CONFIG.POSTURES || []).some(p => p.value === posture);
        if (!valid) { log('无效姿势:', posture); return; }
        if (save.posture !== posture) {
            save.postureDuration = 0;
        }
        save.posture = posture;
        persistSave();
        log('姿势已设置:', posture);
    };

    CYOA.hasDRing = function(slot) {
        const game = CYOA.currentGame;
        const save = CYOA.currentSave;
        if (!game || !save) return false;
        const equipId = save.equipment?.[slot];
        if (!equipId) return false;
        const equipDef = (game.equipment || []).find(e => e.id === equipId);
        if (!equipDef) return false;
        return (equipDef.attachments || []).some(a => a.type === 'd_ring');
    };

    CYOA.getActiveDRings = function() {
        const game = CYOA.currentGame;
        const save = CYOA.currentSave;
        if (!game || !save) return [];
        const results = [];
        for (const [slot, equipId] of Object.entries(save.equipment || {})) {
            if (!equipId) continue;
            const equipDef = (game.equipment || []).find(e => e.id === equipId);
            if (!equipDef) continue;
            (equipDef.attachments || []).forEach(att => {
                if (att.type === 'd_ring') {
                    results.push({
                        slot,
                        equipId,
                        equipName: equipDef.name || equipId,
                        dRingPosition: att.dRingPosition || 'front',
                        attachmentName: att.name || 'D环'
                    });
                }
            });
        }
        return results;
    };

    // ========== 兴奋度系统 API ==========
    CYOA.modifyArousal = function(delta, source) {
        const save = CYOA.currentSave;
        if (!save) return;
        const cfg = CONFIG.AROUSAL_CONFIG || { min: 0, max: 100 };
        const oldVal = save.arousal || 0;
        save.arousal = Math.max(cfg.min, Math.min(cfg.max, oldVal + delta));
        log('兴奋度变化:', oldVal, '->', save.arousal, `(${delta >= 0 ? '+' : ''}${delta}, 来源: ${source || 'unknown'})`);
        persistSave();
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
        const constraints = getActiveConstraints();
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
        persistSave();
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
        persistSave();
        log('刺激器已激活:', equipSlot, attachmentId);
    };

    CYOA.deactivateStimulator = function(equipSlot, attachmentId) {
        const save = CYOA.currentSave;
        if (!save || !save.activeStimulators) return;
        save.activeStimulators = save.activeStimulators.filter(
            s => !(s.slot === equipSlot && s.attachmentId === attachmentId)
        );
        persistSave();
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
        const constraints = getActiveConstraints();
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
        const constraints = getActiveConstraints();
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
        persistSave();
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
        persistSave();
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
        persistSave();
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
        persistSave();
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
        persistSave();
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
        persistSave();
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
        persistSave();
    };

    CYOA.clearPredicament = function() {
        const save = CYOA.currentSave;
        if (!save) return;
        save.predicament = null;
        persistSave();
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
        persistSave();
    };

    CYOA.getTrainingLevel = function(trainingType) {
        return CYOA.currentSave?.trainings?.[trainingType]?.level || 0;
    };

    // ========== 感官剥夺增强 ==========
    CYOA.getDeprivationLevel = function() {
        const constraints = getActiveConstraints();
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
        persistSave();
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
        persistSave();
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
        persistSave();
    };

    CYOA.clearPetplayRole = function() {
        const save = CYOA.currentSave;
        if (!save) return;
        save.petplayRole = null;
        save.petplayImmersion = 0;
        CYOA.setPosture('standing');
        persistSave();
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
        persistSave();
    };

    CYOA.clearFurnitureRole = function() {
        const save = CYOA.currentSave;
        if (!save) return;
        save.furnitureRole = null;
        save.furnitureEndurance = 0;
        persistSave();
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
        persistSave();
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
        persistSave();
    };

    CYOA.setTubeController = function(npcId) {
        const save = CYOA.currentSave;
        if (!save) return;
        if (!save.breathingTube) save.breathingTube = { active: true, flowLevel: 'full', controlledBy: null };
        save.breathingTube.controlledBy = npcId;
        persistSave();
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
        persistSave();
    };

    CYOA.deactivateElectro = function(zone) {
        const save = CYOA.currentSave;
        if (!save?.electroLatex) return;
        save.electroLatex.zones = save.electroLatex.zones.filter(z => z.zone !== zone);
        if (save.electroLatex.zones.length === 0) save.electroLatex.active = false;
        persistSave();
    };

    CYOA.setElectroController = function(npcId) {
        const save = CYOA.currentSave;
        if (!save) return;
        if (!save.electroLatex) save.electroLatex = { active: false, zones: [], controlledBy: null };
        save.electroLatex.controlledBy = npcId;
        persistSave();
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
            persistSave();
            return {
                forced: true,
                from: oldLabel,
                to: newLabel,
                narrative: CYOA.t(CONFIG.COMPOUND_POSTURE_NARRATIVES?.forced_transition || '')
            };
        }

        persistSave();
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
        const constraints = getActiveConstraints();
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
    };

    // ========== 渲染游戏控制界面 ==========
    CYOA.renderGameControls = function() {
        // 欢迎阶段：只显示退出按钮
        if (CYOA._gamePhase === 'welcome') {
            return `
                <div style="display:flex; justify-content:flex-end; width:100%; padding:4px 0;">
                    <button class="cyoa-btn cyoa-btn-secondary" onclick="CYOA.exitGame()" style="height:36px; padding:0 16px;">${t('ui.btn.back')}</button>
                </div>
            `;
        }

        if (!CYOA.currentGame || !CYOA.currentSave) return '<div>' + t('ui.msg.startGameFirst') + '</div>';
        
        const roles = CYOA.currentGame.characters ? CYOA.currentGame.characters.filter(c => c.roleType === 'playable').map(c => c.name) : [];
        const currentRole = CYOA.currentSave.playerCharacter || roles[0] || '';
        
        return `
            <div style="display:flex; flex-direction:column; width:100%;">
                <div style="display:flex; gap:8px; align-items:center; width:100%; margin-bottom:8px;">
                    <select id="gameRoleSelect" class="cyoa-select" style="min-width:90px; width:auto; height:36px;" onchange="CYOA.onRoleChange(this.value)">
                        ${roles.map(r => `<option value="${escapeHtml(r)}" ${r === currentRole ? 'selected' : ''}>${escapeHtml(r)}</option>`).join('')}
                    </select>
                    <div style="display:flex; gap:6px; flex:1; align-items:center;">
                        <div style="position:relative; flex:1;">
                            <span style="position:absolute; left:8px; top:50%; transform:translateY(-50%); font-size:14px; pointer-events:none;">🎬</span>
                            <textarea id="gameMsg" class="cyoa-input" placeholder="${t('ui.ph.action')}" autocomplete="off" rows="1" style="width:100%; height:36px; resize:none; padding:8px 12px 8px 30px; box-sizing:border-box;"></textarea>
                        </div>
                        <div style="position:relative; flex:1;">
                            <span style="position:absolute; left:8px; top:50%; transform:translateY(-50%); font-size:14px; pointer-events:none;">💬</span>
                            <textarea id="gameSpeech" class="cyoa-input" placeholder="${t('ui.ph.speech')}" autocomplete="off" rows="1" style="width:100%; height:36px; resize:none; padding:8px 12px 8px 30px; box-sizing:border-box;"></textarea>
                        </div>
                    </div>
                    <button class="cyoa-btn cyoa-btn-primary" onclick="CYOA.sendGameMessage()" style="height:36px; padding:0 16px;">${t('ui.btn.send')}</button>
                    <button class="cyoa-btn cyoa-btn-secondary" onclick="CYOA.exitGame()" style="height:36px; padding:0 16px;">${t('ui.btn.exitGame')}</button>
                </div>
                <div id="gameOptions" style="display:flex; flex-wrap:wrap; gap:8px; margin-top:4px;"></div>
            </div>
        `;
    };

    // ========== 绑定输入框键盘事件（Enter发送 / Ctrl+Enter换行） ==========
    function _attachTextareaEvents(textarea) {
        if (!textarea || textarea._cyoaKeyBound) return;
        textarea._cyoaKeyBound = true;
        textarea.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                if (!e.ctrlKey && !e.shiftKey && !e.metaKey) {
                    e.preventDefault();
                    CYOA.sendGameMessage();
                } else {
                    e.preventDefault();
                    const start = this.selectionStart;
                    const end = this.selectionEnd;
                    this.value = this.value.substring(0, start) + '\n' + this.value.substring(end);
                    this.selectionStart = this.selectionEnd = start + 1;
                    this.style.height = 'auto';
                    this.style.height = Math.min(this.scrollHeight, 120) + 'px';
                }
            }
        });
        textarea.addEventListener('input', function() {
            this.style.height = '36px';
            this.style.height = Math.min(this.scrollHeight, 120) + 'px';
        });
    }

    CYOA._bindInputKeyHandler = function() {
        requestAnimationFrame(() => {
            _attachTextareaEvents(document.getElementById('gameMsg'));
            _attachTextareaEvents(document.getElementById('gameSpeech'));
        });
    };

    // ========== 多层记忆系统 ==========

    function getConversationPath() {
        const save = CYOA.currentSave;
        if (!save || !save.nodes) return [];
        const path = [];
        let nId = save.currentNodeId;
        while (nId && save.nodes[nId]) {
            path.unshift(save.nodes[nId]);
            nId = save.nodes[nId].parentId;
        }
        return path;
    }

    function buildRecentHistory(maxTurns) {
        const path = getConversationPath();
        const dialogTurns = path.filter(n => n.userMessage && n.assistantMessage);
        const recent = dialogTurns.slice(-maxTurns);
        const msgs = [];
        for (const node of recent) {
            msgs.push({ role: 'user', content: node.userMessage });
            const txt = node.assistantMessage || node.rawAssistantMessage || '';
            if (txt) msgs.push({ role: 'assistant', content: txt });
        }
        return msgs;
    }

    function buildStoryRecap() {
        const save = CYOA.currentSave;
        if (!save) return '';
        const parts = [];
        const chs = save.chapterSummaries || {};
        const done = save.completedChapters || [];
        if (done.length > 0) {
            const game = CYOA.currentGame;
            const sorted = [...(game?.chapters || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
            const lines = [];
            for (const ch of sorted) {
                if (!done.includes(ch.id)) continue;
                lines.push(`【${ch.title}】${chs[ch.id] || '已完成'}`);
            }
            if (lines.length) parts.push(lines.join('\n'));
        }
        if (save.storySummary) parts.push('前情摘要：' + save.storySummary);
        const events = save.keyEvents || [];
        if (events.length > 0) {
            const recent = events.slice(-12).map(e => {
                const td = CONFIG.KEY_EVENT_TYPES?.[e.type] || { icon: '📝' };
                return td.icon + ' ' + e.desc;
            });
            parts.push('近期事件：' + recent.join('；'));
        }
        return parts.join('\n');
    }

    CYOA.addKeyEvent = function(type, desc) {
        const save = CYOA.currentSave;
        if (!save) return;
        if (!save.keyEvents) save.keyEvents = [];
        save.keyEvents.push({ type, desc, time: Date.now() });
        const max = CONFIG.MEMORY_CONFIG?.maxKeyEvents || 25;
        if (save.keyEvents.length > max) save.keyEvents = save.keyEvents.slice(-max);
    };

    async function requestAISummary(text, sysPrompt, maxChars) {
        let model = window.gameModeModel;
        if (!model) {
            const sel = document.getElementById('model');
            if (sel?.value && !sel.value.startsWith('请先')) model = sel.value;
        }
        if (!model && typeof MainApp !== 'undefined' && MainApp.getModels) {
            const m = MainApp.getModels('chat');
            if (m?.length) model = m[0].value;
        }
        if (!model) return null;
        try {
            const r = await fetch('ai_proxy.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model, task: 'chat', messages: [
                    { role: 'system', content: sysPrompt },
                    { role: 'user', content: text }
                ], stream: false })
            });
            if (!r.ok) return null;
            const d = await r.json();
            let res = d.choices?.[0]?.message?.content || '';
            return res.length > maxChars ? res.substring(0, maxChars) + '…' : res;
        } catch (e) { return null; }
    }

    function localCompressTurns(nodes) {
        return nodes.map(n => {
            let s = '';
            if (n.userMessage) s += '玩家：' + n.userMessage.substring(0, 40);
            if (n.assistantMessage) s += ' → ' + n.assistantMessage.substring(0, 60);
            return s;
        }).join('\n');
    }

    async function triggerRollingSummary() {
        const save = CYOA.currentSave;
        if (!save) return;
        const cfg = CONFIG.MEMORY_CONFIG || {};
        const path = getConversationPath();
        const dialogs = path.filter(n => n.userMessage && n.assistantMessage);
        const keep = cfg.recentTurns || 6;
        if (dialogs.length < (cfg.summarizeTrigger || 8)) return;
        const old = dialogs.slice(0, dialogs.length - keep);
        if (old.length === 0) return;
        const lastIdx = save._lastSummarizedTurn || 0;
        const newer = old.filter((_, i) => i >= lastIdx);
        if (newer.length < (cfg.summarizeBatchSize || 6) && save.storySummary) return;
        const toCompress = newer.length > 0 ? newer : old;
        const parts = [];
        if (save.storySummary) parts.push('【之前摘要】' + save.storySummary);
        parts.push('【新对话】');
        for (const n of toCompress) {
            if (n.userMessage) parts.push('[玩家] ' + n.userMessage);
            if (n.assistantMessage) parts.push('[剧情] ' + n.assistantMessage.substring(0, 300));
        }
        const maxC = cfg.summaryMaxChars || 500;
        const sp = cfg.summarizeSystemPrompt || '压缩以下对话为简短摘要。';
        const summary = await requestAISummary(parts.join('\n'), sp, maxC);
        if (summary) {
            save.storySummary = summary;
        } else {
            const local = localCompressTurns(toCompress);
            save.storySummary = save.storySummary
                ? (save.storySummary + '\n' + local).slice(-maxC)
                : local.slice(-maxC);
        }
        save._lastSummarizedTurn = old.length;
        persistSave();
    }

    CYOA._generateChapterSummary = async function(chapterId) {
        const save = CYOA.currentSave;
        const game = CYOA.currentGame;
        if (!save || !game) return;
        if (!save.chapterSummaries) save.chapterSummaries = {};
        if (save.chapterSummaries[chapterId]) return;
        const ch = (game.chapters || []).find(c => c.id === chapterId);
        if (!ch) return;
        const path = getConversationPath().filter(n => n.userMessage && n.assistantMessage).slice(-8);
        if (!path.length) { save.chapterSummaries[chapterId] = ch.description || '已完成'; return; }
        const parts = [`章节：${ch.title}`];
        for (const n of path) {
            if (n.userMessage) parts.push('[玩家] ' + n.userMessage);
            if (n.assistantMessage) parts.push('[剧情] ' + n.assistantMessage.substring(0, 150));
        }
        const cfg = CONFIG.MEMORY_CONFIG || {};
        const result = await requestAISummary(parts.join('\n'), cfg.chapterSummarizePrompt || '概括章节事件。', cfg.chapterSummaryMaxChars || 250);
        save.chapterSummaries[chapterId] = result || ch.description || localCompressTurns(path.slice(-3));
        CYOA.addKeyEvent('chapter_complete', '完成：' + ch.title);
        persistSave();
    };

    function applyTokenBudget(sysPrompt, histMsgs) {
        const cfg = CONFIG.MEMORY_CONFIG || {};
        const maxP = cfg.maxPromptChars || 4200;
        const maxH = cfg.maxHistoryChars || 2800;
        const maxSingle = cfg.maxSingleMsgChars || 400;
        let p = sysPrompt;
        if (p.length > maxP) {
            // 保留头部（RAG知识库+叙述者指令）和尾部（AI规则），裁剪中间动态状态
            const aiRulesMarker = t('prompt.section.aiRules');
            const aiIdx = p.lastIndexOf(aiRulesMarker);
            if (aiIdx > 0) {
                const tail = p.substring(aiIdx);
                let head = p.substring(0, aiIdx);
                const budget = maxP - tail.length - 30;
                if (head.length > budget && budget > 500) {
                    head = head.substring(0, budget) + '\n…[部分游戏状态已省略]…\n';
                }
                p = head + tail;
            } else {
                const head = Math.floor(maxP * 0.55);
                const tail = Math.floor(maxP * 0.4);
                p = p.substring(0, head) + '\n…[部分内容已省略]…\n' + p.substring(p.length - tail);
            }
        }
        const trimmed = [...histMsgs];
        let total = trimmed.reduce((s, m) => s + (m.content?.length || 0), 0);
        while (total > maxH && trimmed.length > 2) {
            total -= (trimmed.shift().content?.length || 0);
        }
        for (const m of trimmed) {
            if (m.role === 'assistant' && m.content && m.content.length > maxSingle) {
                m.content = m.content.substring(0, maxSingle) + '…';
            }
        }
        return { systemPrompt: p, historyMessages: trimmed };
    }

    // ========== 发送消息（调用真实AI模型） ==========
    let _isSending = false;
    CYOA.sendGameMessage = async function() {
        if (_isSending) return;
        const actionInput = document.getElementById('gameMsg');
        const speechInput = document.getElementById('gameSpeech');
        const roleSelect = document.getElementById('gameRoleSelect');
        if (!roleSelect) return;

        const actionText = actionInput ? actionInput.value.trim() : '';
        const speechText = speechInput ? speechInput.value.trim() : '';
        if (!actionText && !speechText) return;
        _isSending = true;

        const targetRole = roleSelect.value;

        // 组合用户消息：行动用 *动作*，说话用 "对话"
        let parts = [];
        if (actionText) parts.push(actionText);
        if (speechText) {
            let speech = speechText;
            // 约束检查：禁言约束仅影响说话部分
            if (CYOA.currentSave && targetRole === CYOA.currentSave.playerCharacter) {
                const equipment = CYOA.currentSave.equipment || {};
                const currentGame = CYOA.currentGame;
                const muteConstraints = getActiveConstraints();
                if (muteConstraints.has('forced_open_mouth')) {
                    speech = t('ui.constraint.gaggedSpeech');
                } else if (muteConstraints.has('mute')) {
                    speech = t('ui.constraint.mutedSpeech');
                }
            }
            parts.push(`说："${speech}"`);
        }
        let userMessage = parts.join('，');

        if (actionInput) { actionInput.value = ''; actionInput.style.height = '36px'; }
        if (speechInput) { speechInput.value = ''; speechInput.style.height = '36px'; }
        
        const logEl = document.getElementById('log');
        if (!logEl) {
            console.error('[CYOA] 找不到log元素');
            return;
        }
        
        // 显示用户消息
        const userDiv = document.createElement('div');
        userDiv.className = 'user';
        userDiv.textContent = `[${targetRole}] ${userMessage}`;
        logEl.appendChild(userDiv);
        
        // 创建AI消息容器
        const aiDiv = document.createElement('div');
        aiDiv.className = 'ai streaming';
        aiDiv.textContent = '';
        logEl.appendChild(aiDiv);
        logEl.scrollTop = logEl.scrollHeight;
        
        // 获取当前选中的模型（多级回退策略）
        let modelValue = null;
        // 1) DOM 直接读取（即使 display:none 也能取到 value）
        const modelSelect = document.getElementById('model');
        if (modelSelect && modelSelect.value && !modelSelect.value.startsWith('请先')) {
            modelValue = modelSelect.value;
        }
        // 2) setGameMode 进入时保存的副本
        if (!modelValue && window.gameModeModel) {
            modelValue = window.gameModeModel;
        }
        // 3) 通过 MainApp API 获取第一个可用 chat 模型
        if (!modelValue && typeof MainApp !== 'undefined' && MainApp.getModels) {
            const chatModels = MainApp.getModels('chat');
            if (Array.isArray(chatModels) && chatModels.length > 0) {
                modelValue = chatModels[0].value;
            }
        }
        
        if (!modelValue) {
            aiDiv.textContent = t('ui.msg.noSelectModel');
            aiDiv.classList.remove('streaming');
            return;
        }
        
        try {
            // ===== 构建游戏知识库 =====
            let systemPrompt = CYOA.buildGamePrompt(targetRole, userMessage);

            // ===== 注入故事回顾 =====
            const recap = buildStoryRecap();
            if (recap) {
                const anchor = '=== 【当前游戏状态】 ===';
                const idx = systemPrompt.indexOf(anchor);
                const recapBlock = '=== 【故事回顾】 ===\n' + recap + '\n\n';
                systemPrompt = idx > 0
                    ? systemPrompt.substring(0, idx) + recapBlock + systemPrompt.substring(idx)
                    : systemPrompt + '\n\n' + recapBlock;
            }

            // ===== 构建近期对话历史 =====
            const memCfg = CONFIG.MEMORY_CONFIG || {};
            const recentHistory = buildRecentHistory(memCfg.recentTurns || 6);
            const budgeted = applyTokenBudget(systemPrompt, recentHistory);

            // 敏感词过滤
            const maskedPrompt = maskSensitiveWords(budgeted.systemPrompt);
            const maskedUserMessage = maskSensitiveWords(userMessage);
            const maskedHistory = budgeted.historyMessages.map(m => ({
                role: m.role, content: maskSensitiveWords(m.content)
            }));

            // 构建请求体：system + 历史 + 当前消息
            const messages = [{ role: 'system', content: maskedPrompt }];
            messages.push(...maskedHistory);
            messages.push({ role: 'user', content: maskedUserMessage });

            const requestBody = {
                model: modelValue,
                task: 'chat',
                messages: messages,
                stream: true
            };
            
            log(`发送AI请求（RAG ${CYOA.getRAG().length}字 + 动态状态，${maskedHistory.length / 2}轮历史，prompt ${maskedPrompt.length}字）`);
            
            // 调用AI接口
            const response = await fetch('ai_proxy.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error ${response.status}`);
            }
            
            // 处理流式响应
            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let buffer = '';
            let fullResponse = '';
            
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (trimmed.startsWith('data: ')) {
                        const data = trimmed.substring(6);
                        if (data === '[DONE]') continue;
                        
                        try {
                            const parsed = JSON.parse(data);
                            const delta = parsed.choices?.[0]?.delta;
                            if (delta) {
                                let textChunk = delta.content || '';
                                if (textChunk) {
                                    fullResponse += textChunk;
                                    aiDiv.textContent = fullResponse;
                                    logEl.scrollTop = logEl.scrollHeight;
                                }
                            }
                        } catch (e) {
                            console.warn('解析流数据失败:', e);
                        }
                    }
                }
            }
            
            aiDiv.classList.remove('streaming');
            
            // 流式结束后检查游戏是否仍在运行（防止退出后崩溃）
            if (!CYOA.currentSave || !CYOA.currentGame) {
                _isSending = false;
                return;
            }
            
            // 敏感词回转：将 AI 回复中的安全替代词还原为原始敏感词
            fullResponse = unmaskSensitiveWords(fullResponse);
            aiDiv.textContent = fullResponse;

            // 视觉/听觉过滤：根据当前装备的 blind/deaf 约束过滤 AI 回复后再显示与保存
            const filteredResponse = applySensoryFilters(fullResponse);
            if (filteredResponse !== fullResponse) {
                aiDiv.textContent = filteredResponse;
            }
            
            // 处理AI响应：传入过滤后文本用于显示，原文用于选项提取和任务检测
            if (fullResponse) {
                await CYOA.processAIResponse(fullResponse, userMessage, targetRole, filteredResponse);
            }
            
        } catch (e) {
            console.error('AI请求失败:', e);
            aiDiv.textContent = `[错误] ${e.message}`;
            aiDiv.classList.remove('streaming');
        } finally {
            _isSending = false;
        }
    };

    // ========== 构建AI提示词 ==========

    // ========== RAG 静态知识库 ==========
    // 从游戏数据中提取不会每轮变化的"百科全书"式知识，缓存在 save 中
    CYOA.generateRAG = function() {
        const game = CYOA.currentGame;
        const save = CYOA.currentSave;
        if (!game || !save) return '';
        const sections = [];

        // 1) 游戏基础 + 叙述者核心指令
        let header = `【${game.name}】`;
        if (game.synopsis) header += `\n简介：${game.synopsis}`;
        if (game.narrator?.prompt) header += `\n\n=== 叙述者核心指令（最高优先级）===\n${game.narrator.prompt}`;
        if (game.narrator?.style) header += `\n叙述风格：${game.narrator.style}`;
        sections.push(header);

        // 2) 世界设定
        const ws = game.worldSetting;
        if (ws) {
            let world = '=== 世界设定 ===';
            if (ws.background) world += `\n时代背景：${ws.background}`;
            if (ws.geography) world += `\n地理：${ws.geography}`;
            if (ws.factions) world += `\n阵营：${ws.factions}`;
            if (ws.socialStructure) world += `\n社会：${ws.socialStructure}`;
            if (ws.history) world += `\n历史：${ws.history}`;
            if (ws.custom) world += `\n${ws.custom}`;
            sections.push(world);
        }

        // 3) 角色档案
        if (game.characters?.length) {
            let chars = '=== 角色档案 ===';
            game.characters.forEach(c => {
                chars += `\n\n【${c.name}】(${CYOA.getRoleTypeLabel(c.roleType)})`;
                if (c.gender) chars += ` ${({male:'♂',female:'♀'})[c.gender] || ''}`;
                if (c.personality?.length) chars += `\n性格：${c.personality.join('、')}`;
                if (c.goal) chars += `\n目标：${c.goal}`;
                if (c.background) chars += `\n背景：${c.background}`;
                if (c.prompt) chars += `\nAI指令：${c.prompt}`;
                if (c.professions?.length) {
                    const profNames = c.professions.map(pid => game.professions?.find(p => p.id === pid)?.name).filter(Boolean);
                    if (profNames.length) chars += `\n职业：${profNames.join('、')}`;
                }
                if (c.skills?.length) {
                    const skillNames = c.skills.map(sid => game.skills?.find(s => s.id === sid)?.name).filter(Boolean);
                    if (skillNames.length) chars += `\n技能：${skillNames.join('、')}`;
                }
                if (c.disciplineRules?.length || c.customRules?.length) {
                    const ruleTexts = [
                        ...(c.disciplineRules || []).map(rv => (CONFIG.DISCIPLINE_RULES || []).find(r => r.value === rv)?.label || rv),
                        ...(c.customRules || [])
                    ];
                    if (ruleTexts.length) chars += `\n纪律规则：${ruleTexts.join('、')}`;
                }
            });
            sections.push(chars);
        }

        // 4) 装备目录（精炼摘要）
        if (game.equipment?.length) {
            let equips = '=== 装备目录 ===';
            game.equipment.forEach(e => {
                equips += `\n- ${e.name}`;
                if (e.slots?.length) equips += ` [${e.slots.map(s => CONFIG.EQUIPMENT_SLOTS.find(sl => sl.value === s)?.label || s).join(',')}]`;
                if (e.constraints?.length) equips += ` [${e.constraints.map(c => CYOA.getConstraintLabel?.(c) || c).join(',')}]`;
                if (e.material) { const mt = CONFIG.MATERIAL_TEMPLATES?.[e.material]; if (mt) equips += ` ${mt.label}`; }
                if (e.locked) equips += ' 🔒';
                if (e.attachments?.length) equips += ` +${e.attachments.map(a => a.name).join(',')}`;
                if (e.description) equips += `：${e.description.length > 60 ? e.description.substring(0, 60) + '…' : e.description}`;
            });
            sections.push(equips);
        }

        // 5) 物品目录
        if (game.items?.length) {
            let items = '=== 物品目录 ===';
            game.items.forEach(i => {
                items += `\n- ${i.name}(${CYOA.getItemTypeLabel?.(i.itemType) || i.itemType})`;
                if (i.description) items += `：${i.description.length > 40 ? i.description.substring(0, 40) + '…' : i.description}`;
            });
            sections.push(items);
        }

        // 6) 章节总览
        if (game.chapters?.length) {
            const sorted = [...game.chapters].sort((a, b) => (a.order || 0) - (b.order || 0));
            let chs = `=== 章节总览（共${sorted.length}章，必须按序推进，禁跳章）===`;
            sorted.forEach(ch => {
                chs += `\n第${ch.order || '?'}章：${ch.title}`;
                if (ch.description) chs += ` — ${ch.description.length > 50 ? ch.description.substring(0, 50) + '…' : ch.description}`;
            });
            sections.push(chs);
        }

        // 7) 任务目录
        if (game.quests?.length) {
            let qs = '=== 任务目录 ===';
            game.quests.forEach(q => {
                qs += `\n- ${q.name}(${CYOA.getQuestTypeLabel?.(q.questType) || q.questType})`;
                if (q.description) qs += `：${q.description.length > 40 ? q.description.substring(0, 40) + '…' : q.description}`;
            });
            sections.push(qs);
        }

        // 8) 场景目录
        if (game.scenes?.length) {
            let sc = '=== 场景目录 ===';
            game.scenes.forEach(s => {
                sc += `\n- ${s.name}`;
                if (s.location) sc += `(${s.location})`;
                if (s.description) sc += `：${s.description.length > 40 ? s.description.substring(0, 40) + '…' : s.description}`;
            });
            sections.push(sc);
        }

        // 9) 约束与状态规则摘要（静态系统知识）
        const ruleLines = [];
        const cd = CONFIG.CONSTRAINT_DESCRIPTIONS || {};
        if (Object.keys(cd).length) {
            ruleLines.push('=== 约束规则 ===');
            Object.entries(cd).forEach(([k, v]) => {
                const label = CYOA.getConstraintLabel?.(k) || k;
                ruleLines.push(`${label}(${k})：${v.length > 80 ? v.substring(0, 80) + '…' : v}`);
            });
        }
        const pd = CONFIG.POSTURE_DESCRIPTIONS || {};
        if (Object.keys(pd).length) {
            ruleLines.push('\n=== 姿势规则 ===');
            Object.entries(pd).forEach(([k, v]) => {
                const label = (CONFIG.POSTURES || []).find(p => p.value === k)?.label || k;
                ruleLines.push(`${label}：${v}`);
            });
        }
        const td = CONFIG.TETHER_DESCRIPTIONS || {};
        if (Object.keys(td).length) {
            ruleLines.push('\n=== 牵引规则 ===');
            Object.entries(td).forEach(([k, v]) => {
                const label = (CONFIG.TETHER_TYPES || []).find(t => t.value === k)?.label || k;
                ruleLines.push(`${label}：${v.length > 80 ? v.substring(0, 80) + '…' : v}`);
            });
        }
        const vd = CONFIG.VISION_DESCRIPTIONS || {};
        if (Object.keys(vd).length) {
            ruleLines.push('\n=== 视野类型 ===');
            Object.entries(vd).forEach(([k, v]) => {
                const label = CYOA.getVisionTypeLabel?.(k) || k;
                ruleLines.push(`${label}(${k})：${v.length > 80 ? v.substring(0, 80) + '…' : v}`);
            });
        }
        if (ruleLines.length > 1) sections.push(ruleLines.join('\n'));

        // 预安全化：RAG 是 AI 的底层知识，用安全词描述世界观
        const ragText = maskSensitiveWords(sections.join('\n\n'));

        save._ragCache = ragText;
        save._ragVersion = Date.now();
        log(`RAG知识库已生成（${ragText.length}字，已预安全化）`);
        return ragText;
    };

    // 获取 RAG 缓存（不存在则自动生成）
    CYOA.getRAG = function() {
        const save = CYOA.currentSave;
        if (!save) return '';
        if (!save._ragCache) CYOA.generateRAG();
        return save._ragCache || '';
    };

    // 标记 RAG 需要重建（游戏数据变化时调用）
    CYOA.invalidateRAG = function() {
        if (CYOA.currentSave) CYOA.currentSave._ragCache = null;
    };

    CYOA.buildGamePrompt = function(targetRole, userMessage) {
        const currentGame = CYOA.currentGame;
        const currentSave = CYOA.currentSave;
        if (!currentGame || !currentSave) return t('ui.msg.gameStateError');

        // RAG 架构：静态知识库（缓存） + 动态状态快照（每轮生成） + AI规则
        let systemPrompt = t('prompt.opening') + '\n\n';
        systemPrompt += CYOA.getRAG() + '\n\n';
        
        // ===== 当前游戏状态（动态快照，每轮重新生成） =====
        systemPrompt += '=== 【当前游戏状态】 ===\n';
        
        // 当前角色
        const currentCharacter = currentGame.characters?.find(c => c.name === targetRole);
        systemPrompt += `${t('当前扮演角色：')}${targetRole}\n`;
        if (currentCharacter?.goal) systemPrompt += `${t('角色当前目标：')}${currentCharacter.goal}\n`;
        systemPrompt += '\n';
        
        // 当前属性
        if (currentSave.attributes?.length > 0) {
            systemPrompt += '--- 当前属性 ---\n';
            currentSave.attributes.forEach(attr => {
                systemPrompt += `${attr.name}: ${attr.value}/${attr.max}`;
                if (attr.description) systemPrompt += ` (${attr.description})`;
                systemPrompt += '\n';
            });
            systemPrompt += '\n';
        }
        
        // 已学技能
        if (currentSave.skills?.length > 0) {
            const lvLabels = CONFIG.SKILL_LEVEL_LABELS || {};
            const perLv = CONFIG.SKILL_PROFICIENCY_PER_LEVEL || 100;
            systemPrompt += '--- 已学技能 ---\n';
            currentSave.skills.forEach(skill => {
                const lv = skill.level || 1;
                const prof = typeof skill.proficiency === 'number' ? skill.proficiency : 0;
                const tag = lvLabels[lv] || '';
                const effectMult = CYOA.getSkillEffectMultiplier(lv);
                const costMult = CYOA.getSkillCostMultiplier(lv);
                systemPrompt += `- ${skill.name} (${getSkillTypeLabel(skill.skillType)}) LV${lv}${tag ? ' ' + tag : ''} [${t('熟练度: ')}${prof}/${perLv}]`;
                if (skill.effect) systemPrompt += ` [${t('效果: ')}${skill.effect} ×${effectMult.toFixed(2)}]`;
                if (skill.consumeItems?.length) {
                    const consumeDesc = skill.consumeItems.map(c => {
                        const scaledAmt = CYOA.getScaledConsumeCost(c.amount || 1, lv);
                        return `${c.description || c.itemId}×${scaledAmt}`;
                    }).join(', ');
                    systemPrompt += ` [消耗: ${consumeDesc} ×${costMult.toFixed(2)}]`;
                }
                systemPrompt += '\n';
            });
            systemPrompt += '\n';
        }
        
        // 当前装备（含锁定等级/耐久/降级状态）
        if (Object.keys(currentSave.equipment || {}).length > 0) {
            systemPrompt += '--- 当前装备 ---\n';
            Object.entries(currentSave.equipment).forEach(([slot, item]) => {
                const slotLabel = CONFIG.EQUIPMENT_SLOTS.find(s => s.value === slot)?.label || slot;
                systemPrompt += `${slotLabel}: ${item.name}`;
                const equipDef = currentGame.equipment?.find(e => e.id === item.id);
                if (equipDef?.material) {
                    const mt = CONFIG.MATERIAL_TEMPLATES?.[equipDef.material];
                    systemPrompt += ` [材质: ${mt?.label || equipDef.material}]`;
                }
                const dura = getEquipDurability(item, equipDef);
                if (dura.indestructible) {
                    systemPrompt += ' [不可破坏]';
                } else if (dura.max > 0) {
                    const duraPct = Math.round((dura.current / dura.max) * 100);
                    systemPrompt += ` [耐久: ${dura.current}/${dura.max} (${duraPct}%)]`;
                    if (duraPct <= 25) systemPrompt += ' ⚠️严重磨损';
                    else if (duraPct <= 50) systemPrompt += ' 有明显损伤';
                }
                const lockLv = getEquipLockLevel(item, equipDef);
                if (lockLv > 0) {
                    const lockDef = CONFIG.LOCK_LEVELS.find(l => l.value === lockLv);
                    systemPrompt += ` [锁定: Lv${lockLv} ${lockDef?.label || ''}]`;
                }
                if (item._degradedStepLimitCm !== undefined) {
                    systemPrompt += ` [约束已降级: 步幅放宽至${item._degradedStepLimitCm}cm]`;
                }
                if (item.statModifiers) systemPrompt += ` (${item.statModifiers})`;
                systemPrompt += '\n';
            });
            systemPrompt += '\n';
        }
        
        // 当前激活的约束（来自已穿戴装备）
        const activeConstraints = getActiveConstraints();
        if (activeConstraints.size > 0) {
            systemPrompt += '--- 当前身体约束状态 ---\n';
            systemPrompt += '⚠️ 角色目前受到以下物理约束，你的叙述必须严格体现这些限制：\n';
            activeConstraints.forEach(c => {
                const label = CYOA.getConstraintLabel?.(c) || c;
                let desc = CYOA.t(CONFIG.CONSTRAINT_DESCRIPTIONS?.[c] || '');
                let extra = '';
                if (c === 'limited_step') {
                    const lsP = getLimitedStepParams();
                    if (lsP) {
                        const tier = getLimitedStepTier(lsP.stepLimitCm);
                        const spdStr = lsP.speedModifierPct >= 0 ? `+${lsP.speedModifierPct}%` : `${lsP.speedModifierPct}%`;
                        extra = `  [${CYOA.t(tier?.label || '限步')} | ${CYOA.lang === 'en' ? 'max stride' : '步幅上限'}: ${lsP.stepLimitCm}cm | ${CYOA.lang === 'en' ? 'speed' : '移动速度'}: ${spdStr}]`;
                        if (tier?.description) desc = CYOA.t(tier.description);
                    }
                }
                if (c === 'blind' || c === 'vision_restricted') {
                    const vt = getActiveVisionType() || (c === 'blind' ? 'full_blind' : 'pinhole');
                    const vtLabel = CYOA.getVisionTypeLabel?.(vt) || vt;
                    extra = `  [${CYOA.lang === 'en' ? 'vision type' : '视野类型'}: ${vtLabel}]`;
                    if (CONFIG.VISION_DESCRIPTIONS?.[vt]) desc = CYOA.t(CONFIG.VISION_DESCRIPTIONS[vt]);
                }
                if (c === 'chastity') {
                    const pChar = currentGame.characters?.find(ch => ch.id === currentSave.playerCharacterId);
                    const g = pChar?.gender || 'unknown';
                    const gTag = g === 'female' ? '♀' : g === 'male' ? '♂' : '';
                    if (gTag) extra = `  [${gTag}]`;
                }
                systemPrompt += `- ${label}（${c}）：${desc}${extra}\n`;
            });
            if (activeConstraints.has('mute')) {
                const gagDef = CYOA.getActiveGagType?.();
                if (activeConstraints.has('forced_open_mouth')) {
                    const hasOralSheath = gagDef?.suppressDrool;
                    systemPrompt += `\n[重要] 角色口腔被${gagDef?.label || '口枷'}强制撑开——嘴唇完全无法闭合，不能做唇语（主动用嘴唇传达信息）、不能舔唇。但角色仍可观察他人嘴唇动作（读唇）来理解他人在说什么。`;
                    if (hasOralSheath) {
                        systemPrompt += `\n口腔内部被医用级乳胶口腔套完全覆盖，精密复刻了真实口腔的舌面、上颚纹理和牙龈弹性。内置导流管网将唾液自动引向咽喉吞咽，下巴和面部保持干燥整洁——不会流口水。`;
                        systemPrompt += `\n口腔套可作为基座与阳具口塞等设备嵌套，被侵入时仿真内壁提供逼真的口腔触感。`;
                        systemPrompt += '\n发出的声音仅限于喉音和含混的元音——"啊...呜...哈..."——嘴被锁定张开，说话完全不可能。';
                        systemPrompt += '\nAI叙述中应体现：口腔被精密装置占据的异物感、强制张口的下颌酸痛、以及口腔套仿真内壁带来的诡异真实触感。不应描写流口水。\n';
                    } else {
                        systemPrompt += `\n持续且不可控地流口水。口水从嘴角、下巴不断滴落，浸湿胸前。`;
                        const droolVal = currentSave.drool || 0;
                        const droolCfg = CONFIG.DROOL_CONFIG || {};
                        if (droolVal >= (droolCfg.heavyThreshold || 70)) {
                            systemPrompt += '\n口水已经大量流出，下巴、胸口、甚至腿部都被唾液浸湿——这种完全失控的生理反应带来持续的羞耻。';
                        } else if (droolVal >= (droolCfg.messThreshold || 30)) {
                            systemPrompt += '\n口水开始明显积聚并溢出，下巴和胸口已经出现潮湿痕迹。';
                        }
                        systemPrompt += '\n发出的声音仅限于喉音、呻吟和含混不清的元音——不是"唔嗯"而是"啊...呜...哈..."因为嘴是张开的。';
                        systemPrompt += '\nAI叙述中必须持续体现流口水的状态，以及因张口导致的说话完全不可能。\n';
                    }
                } else {
                    systemPrompt += '\n[重要] 角色被禁言，无法正常说话，只能发出模糊的声音（唔、嗯等）。AI在叙述时应体现角色无法言语的状态。\n';
                    if (gagDef) {
                        systemPrompt += `口塞类型：${gagDef.label}——${gagDef.desc}\n`;
                    }
                }
            }
            if (activeConstraints.has('blind')) {
                systemPrompt += '\n[重要] 角色完全目盲——视线被彻底剥夺，眼前是纯粹的黑暗，没有任何视觉信号。\n';
                systemPrompt += '叙述中不应出现任何视觉描写（看见、看到、望见等），应完全侧重听觉、触觉、嗅觉来感知世界。\n';
            }
            if (activeConstraints.has('vision_restricted')) {
                const vType = getActiveVisionType() || 'pinhole';
                const vtLabel = CYOA.getVisionTypeLabel?.(vType) || vType;
                const vtDesc = CYOA.t(CONFIG.VISION_DESCRIPTIONS?.[vType] || '');
                systemPrompt += `\n[重要] 角色视野受限（非目盲）——类型: ${vtLabel}。${vtDesc}\n`;
                systemPrompt += '注意：角色并非完全失明，仍保有有限的视觉能力，请根据以下具体类型调整叙述：\n';
                switch (vType) {
                    case 'pinhole':
                        systemPrompt += '视觉仅限极小范围内的破碎画面（一道光线、一个模糊轮廓），其余是黑暗。应使用"勉强瞥见""针尖大小的光""破碎的影子"等措辞，但角色确实能看到一些东西。\n';
                        break;
                    case 'translucent':
                        systemPrompt += '视觉为模糊的色块和重影，能感知光暗与大致轮廓，但无法辨认面孔、文字或细节。应使用"模糊""朦胧""隐约可见""色块"等措辞。\n';
                        break;
                    case 'fixed_gaze':
                        systemPrompt += '视觉仅限正前方极窄范围，正前方视觉清晰，但完全没有余光，侧面和身后是盲区。应强调"无法转头""余光消失""背后的恐惧"等。\n';
                        break;
                    case 'multiphole':
                        systemPrompt += '视觉为多个重叠的碎片画面，像透过万花筒，距离感和空间感严重扭曲。应使用"碎片""重叠""眩晕""万花筒"等措辞。\n';
                        break;
                    default:
                        systemPrompt += '角色有部分视觉能力，根据受限程度适当包含有限的视觉描写。\n';
                        break;
                }
            }
            if (activeConstraints.has('deaf')) {
                const earDev = CYOA.getActiveEarDevice?.();
                if (earDev?.hearController) {
                    systemPrompt += `\n[重要] 角色佩戴${earDev.label || '耳部装置'}——外界所有声音被隔绝，仅能听到控制者/主人通过通讯装置传来的声音。叙述中除控制者的指令外不应出现其他听觉描写。控制者的声音对角色具有绝对权威感——它是唯一能穿透寂静的存在。\n`;
                } else {
                    systemPrompt += `\n[重要] 角色${earDev ? '佩戴' + earDev.label + '——' : ''}耳聋，完全无法听到任何声音。叙述中不应出现听觉描写。\n`;
                }
            }
            if (activeConstraints.has('limited_step')) {
                const lsParams = getLimitedStepParams();
                if (lsParams) {
                    const spdText = lsParams.speedModifierPct >= 0 ? `+${lsParams.speedModifierPct}%` : `${lsParams.speedModifierPct}%`;
                    const tier = getLimitedStepTier(lsParams.stepLimitCm);
                    const tierLabel = tier ? `（${tier.label}）` : '';
                    const tierDesc = tier ? tier.description : '';
                    systemPrompt += `\n[重要] 角色步幅受限${tierLabel}，最大步幅仅 ${lsParams.stepLimitCm}cm，移动速度 ${spdText}。${tierDesc}`;
                    systemPrompt += `\n生成的选项不应包含跑、跳等剧烈运动。叙述中应根据步幅限制程度（${lsParams.stepLimitCm}cm）体现对应等级的身体受限感。\n`;
                } else {
                    systemPrompt += '\n[重要] 角色步幅受限，无法快速移动或大幅位移。生成的选项不应包含跑、跳等剧烈运动。\n';
                }
            }
            if (activeConstraints.has('no_hands')) {
                systemPrompt += '\n[重要] 角色双手被缚，无法抓取、操作物品。生成的选项不应包含需要手部操作的动作。\n';
            }
            if (activeConstraints.has('no_fingers')) {
                const fingerDef = CYOA.getActiveFingerRestraint?.();
                const deviceLabel = fingerDef?.label || '约束装置';
                const shapeLabel = fingerDef?.shapeLabel || '固定';
                systemPrompt += `\n[重要] 角色手指被${deviceLabel}约束在"${shapeLabel}"形态——完全丧失精细操作能力。`;
                systemPrompt += `${fingerDef?.desc || '无法抓取物品、按按钮、解开扣子或操作任何需要手指灵活度的事物。'}`;
                if (fingerDef?.canTouch) {
                    systemPrompt += '但手掌/指尖仍有一定触觉，可以以粗糙的方式推、拍、蹭。';
                } else {
                    systemPrompt += '触觉也被严重削弱，手变成了无感的肢端。';
                }
                systemPrompt += '生成的选项不应包含需要手指精细动作的行为（如解锁、打字、系绳、手语等）。\n';
            }
            if (activeConstraints.has('chastity')) {
                const pChar = currentGame.characters?.find(c => c.id === currentSave.playerCharacterId);
                const gender = pChar?.gender || 'unknown';
                let chDesc = '\n[重要] 角色下体被贞操装置封锁，无法触碰或暴露私密部位。';
                if (gender === 'female') {
                    chDesc += '该角色为女性，装置覆盖阴道、尿道与后穴三处。';
                } else if (gender === 'male') {
                    chDesc += '该角色为男性，装置封锁阳具并覆盖后穴。';
                }
                chDesc += '叙述中应体现装置的存在感——行走、坐下、体位变化时装置对下体施加的压迫与摩擦。任何试图自慰或脱除的动作都应被装置物理阻止。\n';
                systemPrompt += chDesc;
            }
            // 挣扎系统提示
            const hasLockedEquip = Object.values(currentSave.equipment || {}).some(item => {
                const ed = currentGame.equipment?.find(e => e.id === item?.id);
                return getEquipLockLevel(item, ed) > 0;
            });
            if (hasLockedEquip) {
                systemPrompt += '\n[挣扎系统] 角色身上有锁定的装备。当角色进行挣扎、扯动束缚等动作时，装备耐久度会降低。';
                systemPrompt += '耐久耗尽的装备会损坏脱落，低耐久装备的约束效果会降级（如步幅放宽、视野裂缝）。';
                systemPrompt += '现实逻辑：手被绑时只能挣扎手/脚部位，解开其他部位需要先解放双手或使用外物。';
                systemPrompt += '永久锁死(Lv5)的装备无论如何都无法解除。\n';
            }
            systemPrompt += '\n';
        }

        // 牵引状态段落
        if (currentSave.tether?.active) {
            const t = currentSave.tether;
            const tetherDef = (CONFIG.TETHER_TYPES || []).find(x => x.value === t.type);
            const chainDef = (CONFIG.TETHER_CHAIN_LENGTHS || []).find(x => x.value === t.chainLength);
            const tetherDesc = CYOA.t(CONFIG.TETHER_DESCRIPTIONS?.[t.type] || '');
            const slotLabel = t.sourceSlot ? CYOA.getSlotLabel?.(t.sourceSlot) || t.sourceSlot : '未知部位';
            systemPrompt += '--- 牵引状态 ---\n';
            systemPrompt += '⚠️ 玩家当前被牵引：\n';
            systemPrompt += `- 连接部位：${slotLabel}的D环\n`;
            systemPrompt += `- 牵引类型：${tetherDef?.label || t.type}`;
            if (t.targetName) systemPrompt += `（被[${t.targetName}]牵住）`;
            systemPrompt += '\n';
            if (chainDef) systemPrompt += `- 链长：${chainDef.label}，活动范围约${chainDef.movementPct}%\n`;
            if (tetherDesc) systemPrompt += tetherDesc + '\n';
            if (t.type === 'npc_lead') {
                systemPrompt += '[重要] 玩家无法自行选择目的地，只能被动跟随牵引者。任何试图挣脱或偏离方向的动作都会通过牵引绳传来强制拉扯。\n';
            } else if (t.type === 'fixed_anchor') {
                systemPrompt += '[重要] 玩家被固定在锚点上，无法离开当前区域。活动范围严格限制在链条长度内。\n';
            } else if (t.type === 'suspended') {
                systemPrompt += '[重要] 玩家被吊离地面，双脚悬空，无法行走或站立。所有地面移动类动作不可用。\n';
            } else if (t.type === 'short_chain') {
                systemPrompt += '[重要] 玩家被极短链条固定，几乎无法移动，连转身都受到严格限制。\n';
            }
            systemPrompt += '\n';
        }

        // 姿势状态段落
        if (currentSave.posture && currentSave.posture !== 'standing') {
            const postureDef = (CONFIG.POSTURES || []).find(p => p.value === currentSave.posture);
            const postureDesc = CYOA.t(CONFIG.POSTURE_DESCRIPTIONS?.[currentSave.posture] || '');
            systemPrompt += '--- 当前姿势 ---\n';
            systemPrompt += `玩家当前姿势：${postureDef?.label || currentSave.posture}\n`;
            if (postureDesc) systemPrompt += `${CYOA.lang === 'en' ? 'Effect' : '效果'}：${postureDesc}\n`;
            if (currentSave.posture === 'suspended') {
                systemPrompt += '[重要] 玩家双脚离地，无法行走或站立，所有地面移动类动作不可用。\n';
            } else if (currentSave.posture === 'prone' || currentSave.posture === 'supine') {
                systemPrompt += '[重要] 玩家躺在地面上，需要先起身才能行走。\n';
            } else if (currentSave.posture === 'hogtied') {
                systemPrompt += '[重要] 玩家四肢被反缚，几乎丧失所有自主移动能力。\n';
            }
            systemPrompt += '\n';
        }

        // 兴奋度状态段落
        const arousalVal = currentSave.arousal || 0;
        if (arousalVal > 0) {
            const arousalTier = CYOA.getArousalTier();
            const arousalDesc = CYOA.t(CONFIG.AROUSAL_DESCRIPTIONS?.[arousalTier.value] || '');
            systemPrompt += '--- 兴奋度状态 ---\n';
            systemPrompt += `当前兴奋度：${arousalVal}/100（${arousalTier.label}）\n`;
            if (arousalDesc) systemPrompt += `${arousalDesc}\n`;
            // 活跃刺激器
            const activeStims = currentSave.activeStimulators || [];
            if (activeStims.length > 0) {
                systemPrompt += '⚡ 活跃刺激装置：\n';
                activeStims.forEach(s => {
                    if (s.mode === 'off') return;
                    const modeDef = (CONFIG.STIMULATOR_MODES || []).find(m => m.value === s.mode);
                    const intDef = (CONFIG.STIMULATOR_INTENSITIES || []).find(i => i.value === s.intensity);
                    systemPrompt += `- ${s.attachmentName}（${s.stimType === 'shock' ? '电击' : '振动'}）模式：${modeDef?.label || s.mode}，强度：${intDef?.label || s.intensity}\n`;
                });
            }
            // 兴奋度对叙述的约束指令
            if (arousalTier.value === 'aroused' || arousalTier.value === 'heated' || arousalTier.value === 'critical') {
                systemPrompt += `[重要] 角色的兴奋度已达到「${arousalTier.label}」级别。叙述中必须体现角色的身体反应：`;
                if (arousalTier.value === 'aroused') {
                    systemPrompt += '呼吸加深、注意力分散、对接触过度敏感。角色尚能勉强保持理智，但动作已明显受到生理干扰。\n';
                } else if (arousalTier.value === 'heated') {
                    systemPrompt += '全身发热、肌肉颤抖、思维模糊。角色难以进行精细操作或保持冷静对话，身体反应已经难以掩饰。\n';
                } else {
                    systemPrompt += '身体完全被生理冲动支配、四肢不自主颤抖、呼吸紊乱、意识模糊。角色几乎无法正常思考或行动。\n';
                }
            }
            // 贞操锁+高兴奋度
            const hasChastity = activeConstraints.has('chastity');
            if (hasChastity && arousalVal >= 41) {
                systemPrompt += '[重要] 角色被贞操装置封锁，无法释放积累的兴奋度。身体的渴望被物理阻绝，只能在封锁中承受不断攀升的折磨。叙述中应强调这种「被困在高潮边缘却无法越过」的痛苦。\n';
            }
            systemPrompt += '\n';
        }
        
        // 纪律规则注入
        const npcChars = currentGame.characters?.filter(c => c.roleType !== 'playable' && (c.disciplineRules?.length > 0 || c.customRules?.length > 0)) || [];
        if (npcChars.length > 0) {
            systemPrompt += '--- 纪律规则 ---\n';
            systemPrompt += '⚠️ 以下NPC对玩家有纪律要求，违反会降低玩家的顺从度并触发惩罚：\n';
            npcChars.forEach(npc => {
                systemPrompt += `[${npc.name}] 的规则：\n`;
                (npc.disciplineRules || []).forEach(rv => {
                    const rd = (CONFIG.DISCIPLINE_RULES || []).find(r => r.value === rv);
                    if (rd) systemPrompt += `- ${rd.label}：${rd.description}\n`;
                });
                (npc.customRules || []).forEach(cr => {
                    systemPrompt += `- (自定义) ${cr}\n`;
                });
            });
            const obAttr = currentSave.attributes?.find(a => a.name === 'obedience');
            const fnAttr = currentSave.attributes?.find(a => a.name === 'fondness');
            if (obAttr) systemPrompt += `当前顺从度：${obAttr.value}/${obAttr.max || 100}\n`;
            if (fnAttr) systemPrompt += `当前好感度：${fnAttr.value}/${fnAttr.max || 100}\n`;
            const recentV = (currentSave.violations || []).slice(-3);
            if (recentV.length > 0) {
                systemPrompt += `近期违规(${recentV.length}次)：` + recentV.map(v => v.rule).join(', ') + '\n';
                systemPrompt += '轻度违规→NPC口头警告/叙事惩罚；重度违规→自动触发惩罚动作（收紧装备、强制姿势等）。\n';
            }
            systemPrompt += '\n';
        }

        // 习惯度 + 姿势不适描写
        const habEntries = Object.entries(currentSave.habituation || {}).filter(([, v]) => v > 10);
        if (habEntries.length > 0) {
            systemPrompt += '--- 约束习惯度 ---\n';
            habEntries.forEach(([c, v]) => {
                const tier = CYOA.getHabituationTier(c);
                const label = CYOA.getConstraintLabel?.(c) || c;
                systemPrompt += `- ${label}：习惯度 ${v}/100（${tier.label}）${tier.desc}\n`;
            });
            const highHab = habEntries.filter(([, v]) => v >= 61);
            if (highHab.length > 0) {
                systemPrompt += '[重要] 身体已对部分约束产生依赖。若约束被移除，角色会表现出不适、空虚、幻触等戒断反应。叙述中应体现身体对约束存在的习惯性期待。\n';
            }
            systemPrompt += '\n';
        }
        // 戒断效应
        if (currentSave.withdrawalEffects?.length > 0) {
            systemPrompt += '--- 戒断效应 ---\n';
            systemPrompt += '⚠️ 角色正在经历约束移除后的戒断反应：\n';
            currentSave.withdrawalEffects.forEach(w => {
                const label = CYOA.getConstraintLabel?.(w.constraintType) || w.constraintType;
                systemPrompt += `- ${label}戒断（${w.severity}），剩余${w.turnsRemaining}轮：皮肤上残留幻触，身体不自觉地寻找已消失的束缚感。\n`;
            });
            systemPrompt += '[重要] 叙述中应体现角色对被移除约束的身体记忆——幻触感、空虚感、不自觉的适应性动作。\n\n';
        }
        // 姿势不适
        const posture = currentSave.posture || 'standing';
        const pDur = currentSave.postureDuration || 0;
        const durEff = CONFIG.DURATION_EFFECTS?.postureDiscomfort?.[posture];
        if (durEff && pDur >= durEff.startTurn) {
            const discomfort = Math.min(durEff.maxDiscomfort, (pDur - durEff.startTurn) * durEff.perTurn);
            if (discomfort > 0) {
                systemPrompt += `--- 姿势不适 ---\n`;
                systemPrompt += `玩家已保持${(CONFIG.POSTURES || []).find(p => p.value === posture)?.label || posture}姿势 ${pDur} 轮。不适度：${discomfort}/${durEff.maxDiscomfort}\n`;
                systemPrompt += `${durEff.desc}\n`;
                systemPrompt += '[重要] 叙述中应体现姿势维持带来的累积身体不适和疲劳。\n\n';
            }
        }

        // 羞耻状态
        if ((currentSave.shame || 0) > 10) {
            const shameTier = CYOA.getShameTier();
            systemPrompt += `--- 羞耻状态 ---\n`;
            systemPrompt += `羞耻度：${currentSave.shame}/100（${shameTier.label}）\n`;
            if (shameTier.value === 'humiliated' || shameTier.value === 'broken') {
                systemPrompt += '[重要] 角色处于极度羞耻状态，叙述中应体现脸红、躲避目光、身体蜷缩、声音颤抖等反应。高羞耻度会影响社交行动和判断力。\n';
            }
            systemPrompt += '\n';
        }

        // 氧气/呼吸状态
        if ((currentSave.oxygen ?? 100) < 90) {
            const oxyTier = CYOA.getOxygenTier();
            systemPrompt += `--- 呼吸状态 ---\n`;
            systemPrompt += `氧气值：${currentSave.oxygen}/100（${oxyTier.label}）\n`;
            if (oxyTier.value === 'desperate' || oxyTier.value === 'critical') {
                systemPrompt += '[重要] 角色呼吸严重受限！叙述必须体现：呼吸急促、视野发黑、意识模糊、胸腔灼烧感。角色的所有行动都受到缺氧影响。\n';
            } else if (oxyTier.value === 'blackout') {
                systemPrompt += '[严重] 角色已濒临窒息昏厥！叙述应体现意识丧失边缘的状态，NPC应注意安全。\n';
            }
            systemPrompt += '\n';
        }

        // 痛感和痕迹
        if ((currentSave.pain || 0) > 5 || (currentSave.marks?.length > 0)) {
            systemPrompt += `--- 痛感与痕迹 ---\n`;
            if (currentSave.pain > 0) systemPrompt += `痛感等级：${currentSave.pain}/100\n`;
            if (currentSave.marks?.length > 0) {
                systemPrompt += '身体痕迹：\n';
                currentSave.marks.forEach(m => {
                    const mDef = CONFIG.MARK_TYPES?.[m.type];
                    const zDef = (CONFIG.IMPACT_ZONES || []).find(z => z.value === m.zone);
                    systemPrompt += `- ${zDef?.label || m.zone}：${mDef?.label || m.type}（剩余${m.turnsRemaining}轮）${mDef?.desc || ''}\n`;
                });
                systemPrompt += '[重要] 叙述中应提及身体上的可见痕迹，触碰这些区域会引发痛感反应。穿戴装备时痕迹处有额外刺痛。\n';
            }
            systemPrompt += '\n';
        }

        // 温度状态
        const activeTemps = Object.entries(currentSave.bodyTemp || {}).filter(([, v]) => v !== 0);
        if (activeTemps.length > 0) {
            systemPrompt += `--- 温度状态 ---\n`;
            activeTemps.forEach(([zone, temp]) => {
                const zDef = (CONFIG.TEMP_ZONES || []).find(z => z.value === zone);
                const state = temp > 0 ? `高温(+${temp})` : `低温(${temp})`;
                systemPrompt += `- ${zDef?.label || zone}：${state}\n`;
            });
            systemPrompt += '叙述中应体现温度对皮肤的持续影响——热区灼烫、冷区刺麻。冷热交替时反应更强烈。\n\n';
        }

        // 困境束缚
        if (currentSave.predicament) {
            const pred = currentSave.predicament;
            const pDef = (CONFIG.PREDICAMENT_TYPES || []).find(p => p.value === pred.type);
            systemPrompt += `--- 困境束缚 ---\n`;
            systemPrompt += `类型：${pDef?.label || pred.type}——${pDef?.desc || ''}\n`;
            systemPrompt += `已持续 ${pred.turnsActive} 轮，累积痛苦：${pred.painAccum}/100\n`;
            systemPrompt += '[重要] 困境束缚是两难选择：维持当前状态会累积痛苦，但改变也会触发另一种惩罚。叙述中应体现角色在两难中挣扎。\n\n';
        }

        // 训练状态
        const trainEntries = Object.entries(currentSave.trainings || {}).filter(([, v]) => v.level > 0);
        if (trainEntries.length > 0) {
            systemPrompt += `--- 训练进度 ---\n`;
            trainEntries.forEach(([type, data]) => {
                const tDef = (CONFIG.TRAINING_TYPES || []).find(t => t.value === type);
                const lvLabel = CONFIG.TRAINING_LEVEL_LABELS?.[data.level] || data.level;
                systemPrompt += `- ${tDef?.label || type}：Lv.${data.level}（${lvLabel}）进度 ${data.progress}%\n`;
            });
            systemPrompt += '高等级训练使角色更服从，对应技能更熟练。NPC可根据训练进度调整指令难度。\n\n';
        }

        // 感官剥夺增强
        const depLevel = CYOA.getDeprivationLevel();
        if (depLevel) {
            systemPrompt += `--- 感官剥夺 ---\n`;
            systemPrompt += `剥夺等级：${depLevel.label}——${depLevel.desc}\n`;
            const depDur = currentSave.deprivationDuration || 0;
            const depCfg = CONFIG.DEPRIVATION_CONFIG || {};
            if (depDur >= (depCfg.timeDistortionStart || 8)) {
                systemPrompt += '⚠ 时间扭曲：角色已失去时间感知，叙述中应体现时间模糊、无法判断经过了多久。\n';
            }
            if (depDur >= (depCfg.spaceDisorientStart || 5)) {
                systemPrompt += '⚠ 空间迷失：角色已失去空间定位感，不知自己面朝哪里、身处何处。\n';
            }
            systemPrompt += '[重要] 剩余感官急剧增敏——任何触碰都被放大数倍。叙述应体现感官补偿和增敏反应。\n\n';
        }
        if ((currentSave.sensoryOverload || 0) > 0) {
            systemPrompt += `--- 感官过载 ---\n`;
            systemPrompt += `感官恢复中，过载剩余 ${currentSave.sensoryOverload} 轮。所有感官输入都被极度放大，光线刺眼、声音震耳、触碰过电。\n\n`;
        }

        // 乳胶封闭状态（含层叠、自紧、护理、汗液、颜色、开口）
        if ((currentSave.latexCoverage || 0) > 10) {
            const covTier = CYOA.getLatexCoverageTier();
            const heatTier = CYOA.getLatexHeatTier();
            const sweatTier = CYOA.getLatexSweatTier();
            systemPrompt += `--- 乳胶封闭 ---\n`;
            systemPrompt += `覆盖率：${currentSave.latexCoverage}%（${covTier?.label || '局部'}）\n`;
            systemPrompt += `体温：${currentSave.latexHeat || 0}（${heatTier.label}）\n`;
            // 颜色
            if (currentSave.latexColor) {
                const colorDef = (CONFIG.LATEX_COLORS || []).find(c => c.value === currentSave.latexColor);
                if (colorDef) {
                    systemPrompt += `颜色：${colorDef.label}——${colorDef.desc}\n`;
                    if (currentSave.latexColor === 'transparent') {
                        systemPrompt += '⚠ 透明乳胶：身体的每一处细节都暴露在外——皮肤纹理、肤色变化清晰可见却无法触碰。叙述应体现这种暴露感带来的羞耻。\n';
                    } else if (currentSave.latexColor === 'metallic') {
                        systemPrompt += '⚠ 金属反光乳胶：穿戴者变为无面的反射体，镜面表面消解了人类身份。叙述应强调物化的视觉效果。\n';
                    }
                }
            }
            if ((currentSave.latexLayers || 0) > 1) {
                systemPrompt += `层数：${currentSave.latexLayers} 层——多层乳胶叠加，触觉进一步隔离，散热能力指数下降。\n`;
            }
            // 开口状态与可达性
            const openings = currentSave.latexOpenings || {};
            const openEntries = Object.entries(openings);
            if (openEntries.length > 0) {
                const openStates = CONFIG.LATEX_OPENING_STATES || {};
                const openingLabels = openEntries.map(([type, state]) => {
                    const oDef = (CONFIG.LATEX_OPENING_TYPES || []).find(o => o.value === type);
                    const sDef = openStates[state];
                    const accessNote = sDef?.accessible ? '(可接触)' : sDef?.needsKey ? '(锁定,需钥匙)' : '(已闭合)';
                    return `${oDef?.label || type}:${sDef?.label || state}${accessNote}`;
                });
                systemPrompt += `拉链/开口：${openingLabels.join('、')}\n`;
                const accessibleParts = openEntries.filter(([, s]) => openStates[s]?.accessible).map(([t]) => {
                    const oDef = (CONFIG.LATEX_OPENING_TYPES || []).find(o => o.value === t);
                    return oDef?.label?.replace(/^.+\s/, '') || t;
                });
                if (accessibleParts.length > 0) {
                    systemPrompt += `可接触部位：${accessibleParts.join('、')}——NPC可通过开放的拉链接触这些区域。\n`;
                }
                const lockedParts = openEntries.filter(([, s]) => openStates[s]?.needsKey);
                if (lockedParts.length > 0) {
                    systemPrompt += '部分拉链已锁定，需要钥匙或工具才能打开。\n';
                }
            }
            if (currentSave.latexCoverage >= 91) {
                systemPrompt += '⚠ 全身密封状态：完全与外界隔绝，呼吸受限，触觉被乳胶厚度改变。\n';
            }
            const cfg = CONFIG.LATEX_ENCLOSURE_CONFIG || {};
            // 汗液状态
            if ((currentSave.latexSweat || 0) > 15) {
                systemPrompt += `汗液：${currentSave.latexSweat}/100（${sweatTier.label}）——${sweatTier.desc}\n`;
            }
            if ((currentSave.latexHeat || 0) >= (cfg.sweatStartThreshold || 15)) {
                systemPrompt += '身体开始大量出汗，乳胶内壁变得湿滑，皮肤敏感度提升。\n';
            }
            if ((currentSave.latexHeat || 0) >= (cfg.overheatThreshold || 35)) {
                systemPrompt += '[重要] 过热状态！叙述应体现头晕、呼吸困难、意识模糊。乳胶内的闷热已达危险水平。\n';
            }
            // 气味提示
            if (currentSave.latexCoverage >= 60) {
                if ((currentSave.latexSweat || 0) > 40) {
                    systemPrompt += '乳胶内空气充满了橡胶味和汗液的混合气息——闷热、咸湿、浓郁的体味。\n';
                } else if ((currentSave.latexHeat || 0) >= 20) {
                    systemPrompt += '升温的乳胶散发出加倍浓郁的橡胶气味，充满了每一次呼吸。\n';
                }
            }
            // 自紧状态
            if ((currentSave.latexTightness || 0) > 10) {
                const tTier = CYOA.getTightnessTier();
                systemPrompt += `乳胶紧度：${currentSave.latexTightness}/100（${tTier.label}）——${tTier.desc}\n`;
                if (tTier.value === 'crushing') {
                    systemPrompt += '[重要] 乳胶正以危险的力度收紧！体温越高越紧，形成正反馈循环。叙述应体现呼吸困难和活动受限的恶性循环。\n';
                }
            }
            // 护理状态
            const mEffect = CYOA.getMaintenanceEffect();
            const cond = currentSave.latexCondition ?? 100;
            if (cond < 80) {
                systemPrompt += `乳胶状态：${cond}/100——${mEffect.desc || ''}\n`;
                if (cond < 25) {
                    systemPrompt += '乳胶严重失养：摩擦声极度刺耳，表面粘连皮肤，每次移动都伴随阻力和不适。NPC可能要求/命令玩家进行护理。\n';
                }
            }
            // 潜行修正
            if (currentSave.latexColor) {
                const colorDef = (CONFIG.LATEX_COLORS || []).find(c => c.value === currentSave.latexColor);
                if (colorDef?.stealthMod && colorDef.stealthMod < 0) {
                    systemPrompt += `⚠ 乳胶颜色（${colorDef.label}）极为醒目：在任何需要隐蔽的场景中，角色更容易被发现。\n`;
                }
            }
            systemPrompt += '叙述中应持续体现乳胶的触感、吱嘎声、光泽、气味、紧致包裹感和体温变化。\n\n';
        }

        // 身份侵蚀
        if ((currentSave.identityErosion || 0) > 10) {
            const idTier = CYOA.getIdentityTier();
            systemPrompt += `--- 身份侵蚀 ---\n`;
            systemPrompt += `侵蚀度：${currentSave.identityErosion}/100（${idTier.label}——${idTier.desc}）\n`;
            systemPrompt += `[严格指令] ${idTier.pronounDirective}\n\n`;
        }

        // 恐慌/幽闭恐惧
        if ((currentSave.panic || 0) > 20) {
            const panicTier = CYOA.getPanicTier();
            systemPrompt += `--- 恐慌 ---\n`;
            systemPrompt += `恐慌度：${currentSave.panic}/100（${panicTier.label}）——${panicTier.desc}\n`;
            if (panicTier.value === 'panicked' || panicTier.value === 'meltdown') {
                systemPrompt += '[重要] 角色正处于恐慌发作中！叙述应体现失控的呼吸、剧烈的挣扎冲动、理性思维崩溃。恐慌会加速氧气消耗。\n';
            }
            systemPrompt += '\n';
        }

        // 呼吸管控制
        const tube = currentSave.breathingTube;
        if (tube?.active) {
            const levels = CONFIG.BREATHING_TUBE_CONFIG?.flowLevels || {};
            const lv = levels[tube.flowLevel] || levels.full;
            systemPrompt += `--- 呼吸管 ---\n`;
            systemPrompt += `流量：${lv?.label || tube.flowLevel}——${lv?.desc || ''}\n`;
            if (tube.controlledBy) {
                const ctrlNpc = currentGame.characters?.find(c => c.id === tube.controlledBy);
                systemPrompt += `控制者：${ctrlNpc?.name || 'NPC'}——该NPC可随时调整呼吸管流量。\n`;
            }
            systemPrompt += '\n';
        }

        // 导电乳胶
        const electro = currentSave.electroLatex;
        if (electro?.active && electro.zones?.length > 0) {
            const eCfg = CONFIG.ELECTRO_LATEX_CONFIG || {};
            systemPrompt += `--- 导电乳胶 ---\n`;
            electro.zones.forEach(z => {
                const zoneDef = (eCfg.zones || []).find(zd => zd.value === z.zone);
                const intDef = (eCfg.intensityLevels || []).find(i => i.value === z.intensity);
                const patDef = (eCfg.patternTypes || []).find(p => p.value === z.pattern);
                systemPrompt += `- ${zoneDef?.label || z.zone}：${intDef?.label || z.intensity}（${patDef?.label || z.pattern}）——${intDef?.desc || ''}\n`;
            });
            if (electro.controlledBy) {
                const ctrlNpc = currentGame.characters?.find(c => c.id === electro.controlledBy);
                systemPrompt += `控制者：${ctrlNpc?.name || 'NPC'}——可随时调整电流区域、强度和模式。\n`;
            }
            systemPrompt += '\n';
        }

        // 充气装置状态
        const inflateEntries = Object.entries(currentSave.inflationLevels || {}).filter(([, v]) => v > 0);
        if (inflateEntries.length > 0) {
            systemPrompt += `--- 充气装置 ---\n`;
            const lvDescs = CONFIG.INFLATION_CONFIG?.levelDescriptions || {};
            inflateEntries.forEach(([devId, lv]) => {
                const dDef = (CONFIG.VACUUM_INFLATION_TYPES || []).find(d => d.value === devId);
                systemPrompt += `- ${dDef?.label || devId}：充气等级 ${lv}/5 — ${lvDescs[lv] || ''}\n`;
            });
            systemPrompt += '\n';
        }

        // PetPlay / PonyPlay 状态
        if (currentSave.petplayRole) {
            const rDef = (CONFIG.PETPLAY_ROLES || []).find(r => r.value === currentSave.petplayRole);
            const immTier = CYOA.getPetplayImmersionTier();
            systemPrompt += `--- 角色扮演 ---\n`;
            systemPrompt += `当前角色：${rDef?.label || currentSave.petplayRole}\n`;
            systemPrompt += `沉浸度：${currentSave.petplayImmersion || 0}/100（${immTier.label}）— ${immTier.desc}\n`;
            if (rDef?.rules?.length > 0) {
                systemPrompt += '角色规则：';
                const ruleLabels = { no_speak: '禁止说人类语言', all_fours: '必须四肢着地', follow_master: '必须跟随主人', graceful_movement: '动作必须优雅如猫', hop_only: '只能跳跃前进', high_step: '必须高抬腿步行', respond_to_reins: '必须回应缰绳指令', docile: '必须温顺配合' };
                systemPrompt += rDef.rules.map(r => ruleLabels[r] || r).join('；') + '\n';
            }
            systemPrompt += '[重要] 玩家正在进行宠物/小马角色扮演。AI回复中应：1)用对应动物的行为描写玩家的动作；2)NPC以对待该动物的方式对待玩家；3)沉浸度高时，玩家的思维也应显现角色化倾向。\n\n';
        }

        // 家具化状态
        if (currentSave.furnitureRole) {
            const fDef = (CONFIG.FURNITURE_ROLES || []).find(f => f.value === currentSave.furnitureRole);
            const cfg = CONFIG.FURNITURE_CONFIG || {};
            const endPct = Math.round((currentSave.furnitureEndurance / (cfg.maxEndurance || 100)) * 100);
            systemPrompt += `--- 家具化 ---\n`;
            systemPrompt += `当前角色：${fDef?.label || currentSave.furnitureRole}——${fDef?.desc || ''}\n`;
            systemPrompt += `耐力：${currentSave.furnitureEndurance}/${cfg.maxEndurance || 100}（${endPct}%）\n`;
            if (currentSave.furnitureEndurance >= (cfg.shakeThreshold || 70)) {
                systemPrompt += '⚠ 身体已开始颤抖！叙述应体现肌肉疲劳、难以维持姿势。家具不会说话也不会抱怨——但身体的颤抖出卖了一切。\n';
            }
            systemPrompt += '[重要] 玩家被当作家具使用。AI应以物品化的视角描写玩家——不是人在做动作，而是一件家具在承受使用。\n\n';
        }

        // 高级姿势额外约束注入
        const postureDef = (CONFIG.POSTURES || []).find(p => p.value === (currentSave.posture || 'standing'));
        if (postureDef?.category && postureDef.desc) {
            systemPrompt += `--- 束缚姿势 ---\n`;
            systemPrompt += `${postureDef.label}：${postureDef.desc}\n`;
            if (postureDef.constraints?.length > 0) {
                systemPrompt += '此姿势附加约束：' + postureDef.constraints.map(c => CYOA.getConstraintLabel?.(c) || c).join('、') + '\n';
            }
            systemPrompt += '\n';
        }

        // 装备联动姿势 / 步态
        const gait = CYOA.getCurrentGait?.();
        if (gait && gait.value !== 'normal') {
            const tags = currentSave.activePostureTags || [];
            const blocked = currentSave.blockedPostures || [];
            systemPrompt += `--- 步态与姿势限制 ---\n`;
            systemPrompt += `当前步态：${gait.label}（速度×${gait.speedMod}）——${gait.desc}\n`;
            if (gait.fallChance > 0) {
                systemPrompt += `⚠ 跌倒风险：${Math.round(gait.fallChance * 100)}% / 回合。叙述应体现行走的不稳定和随时可能失衡的紧张感。\n`;
            }
            if (blocked.length > 0) {
                const allP = CONFIG.POSTURES || [];
                const blockedLabels = blocked.map(bv => allP.find(p => p.value === bv)?.label || bv).join('、');
                systemPrompt += `不可用姿势：${blockedLabels}\n`;
            }
            if (tags.length > 0) {
                const tagDefs = CONFIG.EQUIP_POSTURE_TAGS || [];
                const tagLabels = tags.map(tv => tagDefs.find(td => td.value === tv)?.label || tv).join('、');
                systemPrompt += `活跃约束标签：${tagLabels}\n`;
            }
            systemPrompt += '[重要] 玩家的每一次移动都受到装备组合的严格限制。AI叙述中必须持续体现步态变化——不是"走过去"，而是根据步态类型具体描写（碎步/蹒跚/摇晃踮脚等）。\n\n';
        }

        // 头颈约束
        const headRestrict = CYOA.getActiveHeadRestrictions?.() || { canTurn: true, canNod: true };
        if (!headRestrict.canTurn || !headRestrict.canNod) {
            systemPrompt += '--- 头颈约束 ---\n';
            if (!headRestrict.canTurn && !headRestrict.canNod) {
                systemPrompt += '[重要] 角色颈部被完全固定——头部无法左右转动，也无法点头或摇头。视线只能通过眼球移动来调整，想要看向侧方或身后必须整个身体转向。点头和摇头这两种最基本的非语言回应也被剥夺。\n';
            } else if (!headRestrict.canTurn) {
                systemPrompt += '[重要] 角色颈部被固定，头部无法左右转动。视线只能通过眼球移动来调整，想要看向侧方必须转动整个身体。\n';
            } else {
                systemPrompt += '[重要] 角色无法点头或摇头——这两种最基本的非语言沟通方式被剥夺。试图表达"是"或"不"必须通过其他方式。\n';
            }
            systemPrompt += '\n';
        }

        // 手指约束提示
        const fingerInfo = CYOA.getActiveFingerRestraint?.();
        if (fingerInfo) {
            systemPrompt += '--- 手指约束 ---\n';
            systemPrompt += `装置：${fingerInfo.label} → 手指形态：${fingerInfo.shapeLabel || fingerInfo.shape}\n`;
            systemPrompt += `${fingerInfo.desc}\n`;
            systemPrompt += '\n';
        }

        // 耳部装置详情
        const earInfo = CYOA.getActiveEarDevice?.();
        if (earInfo) {
            systemPrompt += '--- 耳部装置 ---\n';
            systemPrompt += `装置：${earInfo.label}\n`;
            systemPrompt += `${earInfo.desc}\n`;
            if (earInfo.hearController) {
                systemPrompt += '角色只能听到控制者通过装置传来的声音——这使控制者的每一句话都具有无可抗拒的权威。环境中其他一切声音对角色来说都不存在。\n';
            }
            systemPrompt += '\n';
        }

        // 背包物品
        if (currentSave.inventory?.length > 0) {
            systemPrompt += '--- 背包物品 ---\n';
            currentSave.inventory.forEach(item => {
                const typeLabel = getItemTypeLabel(item.itemType);
                const qty = item.quantity || 1;
                systemPrompt += `- ${item.name} (${typeLabel})`;
                if (qty > 1) systemPrompt += ` ×${qty}`;
                if (item.durability) systemPrompt += ` [耐久: ${item.durability}]`;
                if (item.description) systemPrompt += `: ${item.description}`;
                if (item.statModifiers) systemPrompt += ` [效果: ${item.statModifiers}]`;
                systemPrompt += '\n';
            });
            systemPrompt += '\n';
        }
        
        // 当前任务
        if (currentSave.quests?.length > 0) {
            const activeQuests = currentSave.quests.filter(q => q.status === 'active' || q.status === 'available');
            if (activeQuests.length > 0) {
                systemPrompt += '--- 当前任务 ---\n';
                activeQuests.forEach(quest => {
                    systemPrompt += `- ${quest.name} [${quest.status === 'active' ? '进行中' : '可接取'}]`;
                    if (quest.objectives?.length) {
                        systemPrompt += `\n  目标: ${quest.objectives.join(' → ')}`;
                    }
                    systemPrompt += '\n';
                });
                systemPrompt += '\n';
            }
        }
        
        // 章节流程
        const chapters = currentGame.chapters || [];
        if (chapters.length > 0) {
            const sorted = [...chapters].sort((a, b) => (a.order || 0) - (b.order || 0));
            const completedSet = new Set(currentSave.completedChapters || []);
            const currentChapter = chapters.find(ch => ch.id === currentSave.currentChapter);

            systemPrompt += '=== 【章节流程】 ===\n';
            systemPrompt += `游戏共 ${sorted.length} 个章节，必须按顺序推进，不得跳过或提前涉及后续章节内容。\n`;
            sorted.forEach(ch => {
                const isCurrent = ch.id === currentSave.currentChapter;
                const isDone = completedSet.has(ch.id);
                let marker = '🔒';
                if (isDone) marker = '✅';
                else if (isCurrent) marker = '◀ 当前';
                else if (ch.unlocked !== false) marker = '📖';
                systemPrompt += `  第${ch.order || '?'}章：${ch.title} ${marker}\n`;
            });

            if (currentChapter) {
                systemPrompt += `\n--- 当前章节详情 ---\n`;
                systemPrompt += `章节：${currentChapter.title}（第${currentChapter.order || '?'}章）\n`;
                if (currentChapter.description) systemPrompt += `章节描述：${currentChapter.description}\n`;

                // 推进目标
                const conds = currentChapter.transitionConditions;
                if (Array.isArray(conds) && conds.length > 0) {
                    systemPrompt += '当前章节推进目标：';
                    const goals = conds.map(c => {
                        switch (c.type) {
                            case 'quest_complete': {
                                const q = (currentGame.quests || []).find(q => q.id === c.questId);
                                const met = CYOA.evaluateCondition(c);
                                return `完成任务"${q?.name || c.questId}"${met ? ' ✅' : ''}`;
                            }
                            case 'has_item': {
                                const it = (currentGame.items || []).find(i => i.id === c.itemId);
                                const met = CYOA.evaluateCondition(c);
                                return `拥有物品"${it?.name || c.itemId}"×${c.quantity || 1}${met ? ' ✅' : ''}`;
                            }
                            case 'attribute_check': {
                                const met = CYOA.evaluateCondition(c);
                                return `属性"${c.attribute}" ${c.operator} ${c.value}${met ? ' ✅' : ''}`;
                            }
                            default: return '';
                        }
                    }).filter(Boolean);
                    systemPrompt += goals.join('、') + '\n';
                    systemPrompt += '你的叙述应引导玩家朝这些目标推进，但不要直接告诉玩家"你需要完成XX任务"，而是通过剧情自然地引导。\n';
                }

                // 场景限制：只注入当前章节包含的场景
                const chapterSceneIds = currentChapter.scenes || [];
                const allScenes = currentGame.scenes || [];
                const chapterScenes = allScenes.filter(s => chapterSceneIds.includes(s.id));
                if (chapterScenes.length > 0) {
                    systemPrompt += '\n--- 当前章节可用场景 ---\n';
                    chapterScenes.forEach(scene => {
                        systemPrompt += `- ${scene.name}`;
                        if (scene.location) systemPrompt += ` [地点: ${scene.location}]`;
                        systemPrompt += '\n';
                        if (scene.description) systemPrompt += `  描述: ${scene.description}\n`;
                        if (scene.decoration) systemPrompt += `  环境: ${scene.decoration}\n`;
                        if (scene.interactables?.length) {
                            const intNames = scene.interactables.map(i => i.name).filter(Boolean).join('、');
                            if (intNames) systemPrompt += `  可交互: ${intNames}\n`;
                        }
                    });
                    systemPrompt += '[重要] 角色的活动范围仅限于以上场景，不得自行创造或前往其他场景。\n';
                }

                systemPrompt += '\n[严格约束] 你的叙述必须围绕当前章节的剧情范围展开，不得提前触发或暗示后续章节的内容。\n';

                // 监控系统
                if (currentChapter.monitored) {
                    const alertVal = getObserverAlert();
                    const alertLvl = getObserverAlertLevel();
                    systemPrompt += '\n📹 [监控区域] 当前场景处于监控覆盖之下。\n';
                    systemPrompt += '你应当在叙述中偶尔（约30%的段落）切换为"监控摄像头"的冷冰冰的第三人称视角来描述场景，';
                    systemPrompt += '使用安保术语和冷静的观测语调，如"目标对象在画面中央呈蜷缩姿态""红外显示体表温度异常升高"。\n';
                    if (alertLvl) {
                        systemPrompt += `当前观测者警觉度: ${alertVal}/100 (${alertLvl.label})\n`;
                        systemPrompt += `${alertLvl.desc}\n`;
                        if (alertVal >= 75) {
                            systemPrompt += '[重要] 警觉度极高，NPC（安保人员/管理者）即将介入。你应当在叙述中体现脚步声逼近、对讲机通话、灯光突然亮起等紧迫感。';
                            systemPrompt += '如果玩家继续挣扎，应当在下一轮直接引入NPC出场。\n';
                        } else if (alertVal >= 50) {
                            systemPrompt += '警觉度较高，叙述中应体现监控室对画面的关注增加——镜头追踪、补光灯开启等。\n';
                        }
                    }
                }
                systemPrompt += '\n';
            }
        }
        
        // AI响应要求
        systemPrompt += `${t('prompt.section.aiRules')}
${t('prompt.aiRulesIntro')}

${t('prompt.rule.1')}

${t('prompt.rule.2')}

${t('prompt.rule.3')}

${t('prompt.rule.4')}

${t('prompt.rule.5')}

${t('prompt.rule.6')}

${t('prompt.rule.7')}`;

        return systemPrompt;
    };

    // ========== 装备感官过滤（目盲/耳聋） ==========
    // 从当前已穿戴装备收集约束列表（含附件递归叠加）
    function getActiveConstraints() {
        const constraints = new Set();
        const save = CYOA.currentSave;
        const game = CYOA.currentGame;
        if (!save || !save.equipment) return constraints;
        // 单次遍历装备：收集主约束、附件约束、口塞/耳部/手指设备
        for (const slot in save.equipment) {
            const item = save.equipment[slot];
            if (!item) continue;
            const equipDef = game?.equipment?.find(e => e.id === item.id);
            const cList = item.constraints || equipDef?.constraints;
            if (Array.isArray(cList)) cList.forEach(x => constraints.add(x));
            const attachments = item.attachments || equipDef?.attachments || [];
            for (const att of attachments) {
                if (att.type === 'constraint_modifier' && Array.isArray(att.constraints)) att.constraints.forEach(x => constraints.add(x));
                if (att.type === 'vision_modifier' && att.visionType) constraints.add(att.visionType === 'full_blind' ? 'blind' : 'vision_restricted');
            }
            // 口塞
            const gagType = item.gagType || equipDef?.gagType;
            if (gagType) {
                const gagDef = (CONFIG.GAG_TYPES || []).find(g => g.value === gagType);
                if (gagDef) { constraints.add('mute'); if (gagDef.forcedOpen) constraints.add('forced_open_mouth'); }
            }
            // 耳部装置
            const earType = item.earDeviceType || equipDef?.earDeviceType;
            if (earType) {
                const earDef = (CONFIG.EAR_DEVICE_TYPES || []).find(e => e.value === earType);
                if (earDef) { const modeDef = (CONFIG.EAR_DEVICE_MODES || {})[earDef.mode]; if (modeDef?.deaf) constraints.add('deaf'); }
            }
            // 手指约束
            const fingerType = item.fingerRestraintType || equipDef?.fingerRestraintType;
            if (fingerType) {
                const fingerDef = (CONFIG.FINGER_RESTRAINT_TYPES || []).find(f => f.value === fingerType);
                if (fingerDef) {
                    constraints.add('no_fingers');
                }
            }
        }
        return constraints;
    }
    CYOA.getActiveConstraints = getActiveConstraints;

    // 获取当前生效的限步参数（取所有带 limited_step 装备中最严格的值）
    function getLimitedStepParams() {
        const save = CYOA.currentSave;
        const game = CYOA.currentGame;
        const defaults = CONFIG.LIMITED_STEP_DEFAULTS || { stepLimitCm: 20, speedModifierPct: -50 };
        if (!save || !save.equipment) return null;

        let minCm = Infinity;
        let totalSpeedPct = 0;
        let found = false;

        for (const slot in save.equipment) {
            const item = save.equipment[slot];
            if (!item) continue;
            const equipDef = game?.equipment?.find(e => e.id === item.id);
            const cList = item.constraints || equipDef?.constraints;
            if (!Array.isArray(cList) || !cList.includes('limited_step')) continue;

            found = true;
            const cm = item.stepLimitCm ?? equipDef?.stepLimitCm ?? defaults.stepLimitCm;
            const pct = item.speedModifierPct ?? equipDef?.speedModifierPct ?? defaults.speedModifierPct;
            if (cm < minCm) minCm = cm;
            totalSpeedPct += pct;
        }

        if (!found) return null;
        return {
            stepLimitCm: minCm === Infinity ? defaults.stepLimitCm : minCm,
            speedModifierPct: Math.max(-100, Math.min(100, totalSpeedPct))
        };
    }
    CYOA.getLimitedStepParams = getLimitedStepParams;

    // 获取当前生效的视野类型（综合扫描所有已装备物品的 blind 约束和 vision_modifier 附件）
    // 返回: null（视觉正常）| 视野类型字符串（如 'full_blind', 'pinhole' 等）
    function getActiveVisionType() {
        const save = CYOA.currentSave;
        const game = CYOA.currentGame;
        if (!save || !save.equipment) return null;

        let hasVisionEffect = false;
        let bestVision = null;
        let bestSeverity = -1;
        const visionTypes = CONFIG.VISION_TYPES || [];

        for (const slot in save.equipment) {
            const item = save.equipment[slot];
            if (!item) continue;
            const equipDef = game?.equipment?.find(e => e.id === item.id);
            const cList = item.constraints || equipDef?.constraints;

            // 情况1：主装备带 blind 约束 → 至少是 full_blind
            if (Array.isArray(cList) && cList.includes('blind')) {
                hasVisionEffect = true;
            }

            // 情况2：扫描所有附件中的 vision_modifier，取最高严重度
            const attachments = item.attachments || equipDef?.attachments || [];
            for (const att of attachments) {
                if (att.type === 'vision_modifier' && att.visionType) {
                    hasVisionEffect = true;
                    const vt = visionTypes.find(v => v.value === att.visionType);
                    const sev = vt?.severity ?? 0;
                    if (sev > bestSeverity) {
                        bestSeverity = sev;
                        bestVision = att.visionType;
                    }
                }
            }
        }

        if (!hasVisionEffect) return null;
        return bestVision || 'full_blind';
    }
    CYOA.getActiveVisionType = getActiveVisionType;

    // ========== 监控视野 (CCTV) 系统 ==========

    function isChapterMonitored() {
        const save = CYOA.currentSave;
        const game = CYOA.currentGame;
        if (!save || !game) return false;
        const chId = save.currentChapter;
        if (!chId) return false;
        const ch = game.chapters?.find(c => c.id === chId);
        return ch?.monitored === true;
    }
    CYOA.isChapterMonitored = isChapterMonitored;

    function getObserverAlert() {
        const save = CYOA.currentSave;
        if (!save) return 0;
        return save.observerAlert || 0;
    }
    CYOA.getObserverAlert = getObserverAlert;

    function setObserverAlert(value) {
        const save = CYOA.currentSave;
        if (!save) return;
        save.observerAlert = Math.max(0, Math.min(150, value));
    }

    function getObserverAlertLevel() {
        const alert = getObserverAlert();
        const thresholds = CONFIG.OBSERVER_ALERT_CONFIG?.thresholds || [];
        let best = null;
        for (const t of thresholds) {
            if (alert >= t.value) best = t;
        }
        return best;
    }
    CYOA.getObserverAlertLevel = getObserverAlertLevel;

    function generateCCTVPrefix() {
        const templates = CYOA.tn(CONFIG.CCTV_NARRATIVES?.cctv_perspective || [], 'cctv.cctvPerspective');
        if (!templates.length) return '';
        const tpl = templates[Math.floor(Math.random() * templates.length)];
        const camId = String(Math.floor(Math.random() * 20) + 1).padStart(2, '0');
        const now = new Date();
        const timestamp = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
        return tpl.replace('{camId}', camId).replace('{timestamp}', timestamp);
    }

    // 获取当前各约束对应的装备材质（用于融合旁白）；返回 Map<约束名, 材质key>
    function getConstraintsWithMaterials() {
        const out = new Map();
        const save = CYOA.currentSave;
        const game = CYOA.currentGame;
        if (!save || !save.equipment || !game?.equipment) return out;
        for (const slot in save.equipment) {
            const item = save.equipment[slot];
            if (!item) continue;
            const equipDef = game.equipment.find(e => e.id === item.id);
            const material = (item.material || equipDef?.material || '').trim() || null;
            const cList = item.constraints || equipDef?.constraints;
            if (!Array.isArray(cList)) continue;
            for (const c of cList) {
                if (!out.has(c) && material && CONFIG.MATERIAL_TEMPLATES && CONFIG.MATERIAL_TEMPLATES[material]) {
                    out.set(c, material);
                }
            }
        }
        return out;
    }

    // 根据 stepLimitCm 确定限步分级（light / moderate / severe）
    function getLimitedStepTier(stepLimitCm) {
        const tiers = CONFIG.LIMITED_STEP_TIERS;
        if (!tiers) return null;
        if (stepLimitCm > 50) return tiers.light;
        if (stepLimitCm >= 20) return tiers.moderate;
        return tiers.severe;
    }
    CYOA.getLimitedStepTier = getLimitedStepTier;

    // ========== 挣扎系统核心 ==========

    function isSlotOccupied(slot) {
        const save = CYOA.currentSave;
        if (!save || !save.equipment) return false;
        return !!save.equipment[slot];
    }

    function areHandsBound() {
        return isSlotOccupied('palm') || isSlotOccupied('wrist');
    }

    function getEquipLockLevel(item, equipDef) {
        if (typeof item.lockLevel === 'number') return item.lockLevel;
        if (typeof equipDef?.lockLevel === 'number') return equipDef.lockLevel;
        if (item.locked === true || equipDef?.locked === true) return 3;
        if (item.locked === false || equipDef?.locked === false) return 0;
        return 0;
    }

    function getEquipDurability(item, equipDef) {
        const indestructible = item.indestructible ?? equipDef?.indestructible ?? false;
        if (indestructible) return { current: Infinity, max: Infinity, indestructible: true };
        const max = item.maxDurability ?? equipDef?.maxDurability ?? 100;
        const cur = item.durability ?? equipDef?.durability ?? max;
        return { current: cur, max, indestructible: false };
    }

    function checkSlotDependency(targetSlot) {
        const deps = CONFIG.SLOT_DEPENDENCY[targetSlot];
        if (!deps || deps.length === 0) return { canStruggle: true, blocked: [] };
        const blocked = deps.filter(depSlot => isSlotOccupied(depSlot));
        return { canStruggle: blocked.length === 0, blocked };
    }

    function applyDegradation(item, equipDef) {
        const dura = getEquipDurability(item, equipDef);
        if (dura.indestructible || dura.max <= 0) return [];
        const duraPct = (dura.current / dura.max) * 100;
        const effects = [];

        for (const rule of (CONFIG.DEGRADATION_RULES || [])) {
            const cList = item.constraints || equipDef?.constraints || [];
            if (!cList.includes(rule.constraint)) continue;

            for (const threshold of rule.thresholds) {
                if (duraPct > threshold.duraPct) continue;

                if (rule.constraint === 'limited_step' && threshold.effect) {
                    const baseCm = item.stepLimitCm ?? equipDef?.stepLimitCm ?? 20;
                    const basePct = item.speedModifierPct ?? equipDef?.speedModifierPct ?? -50;
                    item._degradedStepLimitCm = baseCm + (threshold.effect.stepLimitCmBonus || 0);
                    item._degradedSpeedModifierPct = Math.min(100, basePct + (threshold.effect.speedModifierPctBonus || 0));
                    effects.push({ type: 'limited_step_weaken', duraPct: threshold.duraPct, bonus: threshold.effect });
                }

                if (rule.type === 'attachment_degrade' && threshold.visionShift) {
                    const attachments = item.attachments || [];
                    for (const att of attachments) {
                        if (att.type === 'vision_modifier' && att.visionType === threshold.visionShift.from) {
                            att.visionType = threshold.visionShift.to;
                            effects.push({ type: 'vision_shift', from: threshold.visionShift.from, to: threshold.visionShift.to });
                        }
                    }
                }
                break;
            }
        }
        return effects;
    }

    function attemptStruggle(slot) {
        const save = CYOA.currentSave;
        const game = CYOA.currentGame;
        if (!save || !save.equipment || !game) return null;

        const item = save.equipment[slot];
        if (!item) return { success: false, narrative: '该部位没有装备任何束缚。' };

        const equipDef = game.equipment?.find(e => e.id === item.id);
        const lockLevel = getEquipLockLevel(item, equipDef);
        const dura = getEquipDurability(item, equipDef);
        const material = item.material || equipDef?.material || 'leather';
        const cfg = CONFIG.STRUGGLE_CONFIG;
        const narr = CONFIG.STRUGGLE_NARRATIVES;
        const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

        if (lockLevel >= 5) {
            return { success: false, duraDmg: 0, degraded: false, broken: false, narrative: pick(CYOA.tn(narr.permanent_lock, 'struggle.permanentLock')) };
        }

        const depCheck = checkSlotDependency(slot);
        const isSelfSlot = (CONFIG.TOOL_BYPASS_SLOTS || []).includes(slot);

        if (!depCheck.canStruggle && !isSelfSlot) {
            return { success: false, duraDmg: 0, degraded: false, broken: false, narrative: pick(CYOA.tn(narr.blocked_by_hands, 'struggle.blockedByHands')), blockedBy: depCheck.blocked };
        }

        let successRate = cfg.baseSuccessRate;
        successRate *= (1 - lockLevel * cfg.lockLevelMultiplier);
        const matMod = cfg.materialModifiers[material] || { resistMult: 1, duraDmgMult: 1 };
        successRate /= matMod.resistMult;

        // 液态乳胶额外抗性
        if (material === 'latex') {
            const eqItem = save.equipment?.[slot];
            const eDef = CYOA.currentGame?.equipment?.find(e => e.id === eqItem?.id);
            const atts = eDef?.attachments || eqItem?.attachments || [];
            const hasLiquid = atts.some(a => a.type === 'latex_layer' && (CONFIG.LATEX_THICKNESS || []).find(t => t.value === a.latexThickness)?.isLiquid);
            if (hasLiquid) {
                const llCfg = CONFIG.LIQUID_LATEX_CONFIG || {};
                successRate *= llCfg.struggleResistMult || 0.1;
            }
            // 汗液滑脱加成
            const sweatTier = CYOA.getLatexSweatTier?.();
            if (sweatTier && sweatTier.value !== 'dry') {
                const swCfg = CONFIG.LATEX_SWEAT_CONFIG || {};
                const tierIdx = (CONFIG.LATEX_SWEAT_TIERS || []).findIndex(t => t.value === sweatTier.value);
                successRate *= (1 + (swCfg.struggleSlipBonus || 0.08) * tierIdx);
            }
        }

        if (isSelfSlot && areHandsBound()) {
            successRate *= (1 - cfg.handBoundPenalty);
        }

        // 恐慌状态下挣扎加成（肾上腺素爆发）
        if ((save.panic || 0) > 40) {
            const pCfg = CONFIG.PANIC_CONFIG || {};
            successRate *= (1 + (pCfg.panicStruggleBonus || 0.2));
        }

        successRate = Math.max(0, Math.min(1, successRate));

        let duraDmg = 0;
        if (!dura.indestructible) {
            duraDmg = Math.round(cfg.baseDurabilityDamage * matMod.duraDmgMult);
            item.durability = Math.max(0, (item.durability ?? dura.current) - duraDmg);
        }

        const roll = Math.random();
        const success = roll < successRate;

        let degraded = false;
        let broken = false;
        let degradeEffects = [];
        let narrative = '';

        if (!dura.indestructible && item.durability <= 0) {
            broken = true;
            delete save.equipment[slot];
            narrative = pick(CYOA.tn(narr.broken, 'struggle.broken'));
        } else if (success && lockLevel === 0) {
            delete save.equipment[slot];
            narrative = pick(CYOA.tn(narr.success, 'struggle.success'));
        } else if (success && lockLevel <= 1) {
            delete save.equipment[slot];
            narrative = pick(CYOA.tn(narr.success, 'struggle.success'));
        } else if (success) {
            narrative = pick(CYOA.tn(narr.fail, 'struggle.fail')) + '\n' + CYOA.t('narr.struggle.lockTooHigh');
        } else {
            degradeEffects = applyDegradation(item, equipDef);
            if (degradeEffects.length > 0) {
                degraded = true;
                narrative = pick(CYOA.tn(narr.degrade, 'struggle.degrade'));
            } else {
                narrative = pick(CYOA.tn(narr.fail, 'struggle.fail'));
            }
        }

        // 监控区域：挣扎会累加观测者警觉度
        let cctvAlert = false;
        let interventionTriggered = false;
        if (isChapterMonitored()) {
            const alertCfg = CONFIG.OBSERVER_ALERT_CONFIG;
            const increment = alertCfg?.struggleIncrement || 8;
            const oldVal = getObserverAlert();
            setObserverAlert(oldVal + increment);
            const newVal = getObserverAlert();
            cctvAlert = true;

            const cctvNarr0 = CYOA.tn(CONFIG.CCTV_NARRATIVES?.struggle_watched, 'cctv.struggleWatched');
            if (cctvNarr0?.length) {
                narrative += '\n' + cctvNarr0[Math.floor(Math.random() * cctvNarr0.length)];
            }

            if (newVal >= (alertCfg?.interventionThreshold || 100) && oldVal < (alertCfg?.interventionThreshold || 100)) {
                interventionTriggered = true;
                const imminent = CYOA.tn(CONFIG.CCTV_NARRATIVES?.intervention_imminent, 'cctv.interventionImminent');
                if (imminent?.length) {
                    narrative += '\n\n⚠️ ' + imminent[Math.floor(Math.random() * imminent.length)];
                }
            }
        }

        return {
            success: broken || (success && lockLevel <= 1),
            duraDmg,
            degraded,
            broken,
            degradeEffects,
            narrative,
            slot,
            itemName: item.name || equipDef?.name || '装备',
            remainingDurability: dura.indestructible ? '♾️' : (item.durability ?? 0),
            maxDurability: dura.indestructible ? '♾️' : dura.max,
            cctvAlert,
            interventionTriggered,
            observerAlert: isChapterMonitored() ? getObserverAlert() : 0
        };
    }
    CYOA.attemptStruggle = attemptStruggle;

    CYOA.handleStruggle = function(slot) {
        const save = CYOA.currentSave;
        if (!save || !save.equipment?.[slot]) return;
        const itemRef = save.equipment[slot];
        const eqDef = CYOA.currentGame?.equipment?.find(e => e.id === itemRef.id);

        const result = attemptStruggle(slot);
        if (!result) return;

        if (result.success && !result.broken) {
            if (eqDef?.statModifiers) {
                const mods = parseStatModifiers(eqDef.statModifiers);
                applyStatModifiers(mods, false);
            }
            const already = save.inventory.some(i => i.id === itemRef.id);
            if (!already) save.inventory.push(itemRef);
        } else if (result.broken && eqDef?.statModifiers) {
            const mods = parseStatModifiers(eqDef.statModifiers);
            applyStatModifiers(mods, false);
        }

        const logEl = document.getElementById('log');
        if (logEl) {
            const sysDiv = document.createElement('div');
            sysDiv.className = 'cyoa-struggle-msg';
            sysDiv.style.cssText = 'text-align:center; padding:10px 14px; margin:6px 0; border-radius:8px; font-size:13px; line-height:1.6; ' +
                (result.success ? 'background:linear-gradient(135deg,#dcfce7,#bbf7d0); color:#16a34a; font-weight:600; border:1px solid #86efac;' :
                 result.broken ? 'background:linear-gradient(135deg,#fef3c7,#fde68a); color:#d97706; font-weight:600; border:1px solid #fcd34d;' :
                 result.degraded ? 'background:linear-gradient(135deg,#fef3c7,#fde68a); color:#d97706; border:1px solid #fcd34d;' :
                 'background:linear-gradient(135deg,#fee2e2,#fecaca); color:#dc2626; border:1px solid #fca5a5;');
            let msg = `[${result.itemName} - ${CONFIG.EQUIPMENT_SLOTS.find(s => s.value === slot)?.label || slot}] ` + result.narrative;
            if (result.duraDmg > 0) msg += `\n${t('ui.struggle.durDown', {n: result.duraDmg})} → ${result.remainingDurability}/${result.maxDurability}`;
            if (result.degradeEffects?.length) {
                result.degradeEffects.forEach(e => {
                    if (e.type === 'limited_step_weaken') msg += `\n⚡ ${t('ui.struggle.constraintDegrade')} +${e.bonus.stepLimitCmBonus}cm`;
                    if (e.type === 'vision_shift') msg += `\n⚡ ${t('ui.struggle.visionChange')}${CYOA.getVisionTypeLabel?.(e.from) || e.from} → ${e.to ? (CYOA.getVisionTypeLabel?.(e.to) || e.to) : '解除'}`;
                });
            }
            if (result.cctvAlert) {
                msg += `\n📹 ${t('ui.struggle.observerAlert')} ${result.observerAlert}/100`;
            }
            sysDiv.textContent = msg;
            logEl.appendChild(sysDiv);
            sysDiv.scrollIntoView({ behavior: 'smooth' });
        }

        persistSave();
        CYOA.renderInventoryPanel();
        CYOA.renderAttributesPanel?.();
        CYOA.renderGameOptions?.();
    };

    // 根据目盲/耳聋约束过滤 AI 回复文本（视觉与听觉过滤），并在概率下注入约束描写
    // NOTE: 内部 `t` 变量遮蔽了模块级的 i18n `t` 函数，此函数内所有 i18n 调用均使用 CYOA.t()
    function applySensoryFilters(text) {
        if (!text || !CYOA.currentSave) return text;
        const constraints = getActiveConstraints();
        const constraintToMaterial = getConstraintsWithMaterials();
        let t = text;

        // 从 MATERIAL_TEMPLATES 获取指定约束对应装备的材质模板
        function getMaterialFor(constraintName) {
            const key = constraintToMaterial.get(constraintName);
            if (!key || !CONFIG.MATERIAL_TEMPLATES?.[key]) return null;
            const tpl = CONFIG.MATERIAL_TEMPLATES[key];
            return { key, label: tpl.label || key, sf: tpl.sensory_feedback || {} };
        }

        // 视觉过滤：blind（完全目盲）或 vision_restricted（视野受限）均触发
        const hasVisionConstraint = constraints.has('blind') || constraints.has('vision_restricted');
        if (hasVisionConstraint) {
            const visionType = getActiveVisionType() || (constraints.has('blind') ? 'full_blind' : 'pinhole');
            const mt = getMaterialFor(constraints.has('blind') ? 'blind' : 'vision_restricted');
            const visualRe = /[^。！？\n]*(?:看见|眼前|颜色|光线|映入|视线|望见|目光|看到|望去|注视|凝视|瞥见)[^。！？\n]*[。！？\n]?/g;

            // 视觉动词——用于句内逐词替换（动态模糊）
            const visualVerbRe = /(看见|看到|望见|瞥见|注视|凝视|望去|观察|打量|环顾|发现|辨认|目睹|审视)/g;
            const pinholeLeads = CYOA.tn([
                '艰难地透过狭缝，',
                '在破碎的视野中尝试捕捉——',
                '将眼球凑向微孔，勉强',
                '从针尖大小的孔洞中，',
                '在黑暗的缝隙中隐约',
                '拼命聚焦于那一点光——'
            ], 'filter.pinhole.leads');
            const pinholeTails = CYOA.tn([
                '——但画面转瞬即逝，被黑暗重新吞没。',
                '——随即一切又缩回那个微小的光点中。',
                '——碎片般的画面让人无法确定是否真的看清了。',
                '——视野立刻被孔洞的边缘裁断。'
            ], 'filter.pinhole.tails');
            const translucentLeads = CYOA.tn([
                '透过朦胧的遮蔽，隐约感知到',
                '在模糊的色块间，似乎',
                '雾般的视野中，你勉强辨别出',
                '半透明的遮蔽将一切化为重影——',
                '模糊的光影流动间，依稀'
            ], 'filter.translucent.leads');
            const translucentTails = CYOA.tn([
                '——但细节已完全溶解在朦胧之中。',
                '——轮廓在色块与光斑中摇摆不定，无法确认。',
                '——一切都像隔着水面般模糊失真。',
                '——你无法分辨那究竟是什么。'
            ], 'filter.translucent.tails');
            const pick = arr => arr[Math.floor(Math.random() * arr.length)];

            switch (visionType) {
                case 'full_blind':
                    t = t.replace(visualRe, '');
                    break;
                case 'pinhole':
                    // 70% 的视觉动词被改写，30% 完全吞掉（模拟只能偶尔捕捉到碎片）
                    t = t.replace(visualRe, (match) => {
                        const core = match.replace(/[。！？\n]+$/, '').trim();
                        if (!core) return '';
                        return core.replace(visualVerbRe, (verb) => {
                            if (Math.random() < 0.7) {
                                return pick(pinholeLeads) + verb;
                            }
                            return verb;
                        }) + pick(pinholeTails);
                    });
                    break;
                case 'translucent':
                    // 70% 的视觉动词被模糊前置，30% 保留原文但补模糊尾缀
                    t = t.replace(visualRe, (match) => {
                        const core = match.replace(/[。！？\n]+$/, '').trim();
                        if (!core) return '';
                        return core.replace(visualVerbRe, (verb) => {
                            if (Math.random() < 0.7) {
                                return pick(translucentLeads) + verb;
                            }
                            return verb;
                        }) + pick(translucentTails);
                    });
                    break;
                case 'fixed_gaze':
                    t = t.replace(/[^。！？\n]*(?:余光|身后|侧面|背后|回头|转头|环顾|扭头|侧目)[^。！？\n]*[。！？\n]?/g, '');
                    break;
                case 'multiphole':
                    t = t.replace(visualRe, (match) => {
                        const core = match.replace(/[。！？\n]+$/, '').trim();
                        if (!core) return '';
                        return CYOA.t('narr.filter.multiphole', {core});
                    });
                    break;
            }
        }

        // 耳聋：去掉含声音描写的句子（controller_only模式保留控制者的话语）
        if (constraints.has('deaf')) {
            const earDev = CYOA.getActiveEarDevice?.();
            if (earDev?.hearController) {
                t = t.replace(/[^。！？\n]*(?:听见|响声|听到|声音|声响|一声|喧哗|嘈杂|呼喊|叫声)[^。！？\n]*[。！？\n]?/g, match => {
                    if (/主人|控制者|耳机|传来|命令|指令/.test(match)) return match;
                    return '';
                });
            } else {
                t = t.replace(/[^。！？\n]*(?:听见|响声|听到|声音|声响|一声|喧哗|嘈杂|呼喊|叫声)[^。！？\n]*[。！？\n]?/g, '');
            }
        }

        // 禁言：由 buildGamePrompt 系统提示处理，此处不再注入可见文本

        // 限步：由 buildGamePrompt 系统提示处理，此处不再注入可见文本

        // 贞操：由 buildGamePrompt 系统提示处理，此处不再注入可见文本

        t = t.replace(/\n{3,}/g, '\n\n').trim();

        // injectNarrative：按概率注入约束描写，从三个池子（材质融合旁白、感官描写、身体自动反应）中随机抽取
        const descs = CONFIG.CONSTRAINT_DESCRIPTIONS;
        const materialNarratives = CONFIG.CONSTRAINT_MATERIAL_NARRATIVES;
        const bodyReactions = CONFIG.CONSTRAINT_BODY_REACTIONS;
        if ((descs || materialNarratives || bodyReactions) && Math.random() < 0.5) {
            const sentences = [];
            constraints.forEach(c => {
                const candidates = [];
                const material = constraintToMaterial.get(c);

                const _tnKey = { full_blind: 'vision.fullBlind', pinhole: 'vision.pinhole', translucent: 'vision.translucent', fixed_gaze: 'vision.fixedGaze', multiphole: 'vision.multiphole' };
                const _cKey = { limited_step: 'constraint.limitedStep', no_hands: 'constraint.noHands', blind: 'constraint.blind', mute: 'constraint.mute', forced_open_mouth: 'constraint.forcedOpenMouth', oral_sheath: 'constraint.oralSheath', deaf: 'constraint.deaf', chastity: 'constraint.chastity', tethered: 'constraint.tethered', no_fingers: 'constraint.noFingers' };
                const _splitDesc = (str) => {
                    const splitRe = /[.。！？；!?;]/;
                    const end = CYOA.lang === 'en' ? '.' : '。';
                    str.split(splitRe).map(p => p.trim()).filter(Boolean)
                        .forEach(p => candidates.push(p + (p.match(/[.。！？!?]$/) ? '' : end)));
                };
                if (c === 'blind' || c === 'vision_restricted') {
                    const vt = getActiveVisionType() || (c === 'blind' ? 'full_blind' : 'pinhole');
                    if (material && CONFIG.VISION_MATERIAL_NARRATIVES?.[vt]?.[material]) {
                        candidates.push(CYOA.t(CONFIG.VISION_MATERIAL_NARRATIVES[vt][material]));
                    } else if (material && materialNarratives?.['blind']?.[material]) {
                        candidates.push(CYOA.t(materialNarratives['blind'][material]));
                    }
                    const vtDesc = CONFIG.VISION_DESCRIPTIONS?.[vt];
                    if (vtDesc) _splitDesc(CYOA.t(vtDesc));
                    const vtReactions = CYOA.tn(CONFIG.VISION_BODY_REACTIONS?.[vt], _tnKey[vt] || 'vision.fullBlind');
                    if (Array.isArray(vtReactions)) {
                        vtReactions.forEach(r => candidates.push(r));
                    } else {
                        const blindFb = CYOA.tn(bodyReactions?.['blind'], 'constraint.blind');
                        if (Array.isArray(blindFb)) blindFb.forEach(r => candidates.push(r));
                    }
                } else {
                    if (material && materialNarratives?.[c]?.[material]) {
                        candidates.push(CYOA.t(materialNarratives[c][material]));
                    }
                    if (descs && typeof descs[c] === 'string') _splitDesc(CYOA.t(descs[c]));
                    if (c === 'limited_step') {
                        const lsP = getLimitedStepParams();
                        const cm = lsP?.stepLimitCm ?? (CONFIG.LIMITED_STEP_DEFAULTS?.stepLimitCm || 20);
                        const tier = getLimitedStepTier(cm);
                        const lsKey = tier?.min > 50 ? 'limitedStep.light.bodyReactions' : tier?.min >= 20 ? 'limitedStep.moderate.bodyReactions' : 'limitedStep.severe.bodyReactions';
                        if (tier && Array.isArray(tier.bodyReactions)) {
                            CYOA.tn(tier.bodyReactions, lsKey).forEach(r => candidates.push(r));
                        } else {
                            const fb = CYOA.tn(bodyReactions?.[c], _cKey[c] || c);
                            if (Array.isArray(fb)) fb.forEach(r => candidates.push(r));
                        }
                    } else {
                        const fb = CYOA.tn(bodyReactions?.[c], _cKey[c] || c);
                        if (Array.isArray(fb)) fb.forEach(r => candidates.push(r));
                    }
                }
                if (candidates.length) {
                    sentences.push(candidates[Math.floor(Math.random() * candidates.length)]);
                }
            });
            if (sentences.length) {
                t = t + '\n\n（' + sentences.join(' ') + '）';
            }
        }

        // 监控视角旁白注入
        if (isChapterMonitored()) {
            const alertVal = getObserverAlert();
            const alertCfg = CONFIG.OBSERVER_ALERT_CONFIG;
            const pick = (arr) => arr?.length ? arr[Math.floor(Math.random() * arr.length)] : '';

            if (Math.random() < 0.35) {
                let cctvLine = '';
                if (alertVal >= (alertCfg?.interventionThreshold || 100)) {
                    cctvLine = pick(CYOA.tn(CONFIG.CCTV_NARRATIVES?.intervention_imminent, 'cctv.interventionImminent'));
                } else if (alertVal >= 50) {
                    cctvLine = pick(CYOA.tn(CONFIG.CCTV_NARRATIVES?.alert_rising, 'cctv.alertRising'));
                } else {
                    cctvLine = pick(CYOA.tn(CONFIG.CCTV_NARRATIVES?.ambient, 'cctv.ambient'));
                }
                if (cctvLine) {
                    t = t + '\n\n' + cctvLine;
                }
            }

            if (Math.random() < 0.2) {
                const prefix = generateCCTVPrefix();
                if (prefix) {
                    const paragraphs = t.split('\n\n');
                    const insertIdx = Math.min(1, paragraphs.length - 1);
                    paragraphs.splice(insertIdx, 0, prefix + CYOA.t('narr.filter.cctv.figure'));
                    t = paragraphs.join('\n\n');
                }
            }

            // 每轮自然衰减
            if (alertVal > 0) {
                setObserverAlert(alertVal - (alertCfg?.decayPerTurn || 2));
            }
        }

        // 牵引/姿势感官叙事注入（~30% 概率）
        const save = CYOA.currentSave;
        if (save && Math.random() < 0.3) {
            const tetherNarrs = [];
            if (save.tether?.active) {
                const tetherReactions = CYOA.tn(CONFIG.CONSTRAINT_BODY_REACTIONS?.tethered, 'constraint.tethered');
                if (Array.isArray(tetherReactions) && tetherReactions.length > 0) {
                    tetherNarrs.push(tetherReactions[Math.floor(Math.random() * tetherReactions.length)]);
                }
            }
            if (save.posture && save.posture !== 'standing') {
                const postureDesc = CYOA.t(CONFIG.POSTURE_DESCRIPTIONS?.[save.posture] || '');
                if (postureDesc) {
                    tetherNarrs.push(postureDesc);
                }
            }
            if (tetherNarrs.length > 0) {
                const hint = '\n\n*' + tetherNarrs.join(' ') + '*';
                t += hint;
            }
        }

        // 兴奋度叙事注入（概率随兴奋度等级提升）
        const arousalSave = CYOA.currentSave;
        if (arousalSave) {
            const aVal = arousalSave.arousal || 0;
            const aTier = CYOA.getArousalTier();
            const injectChance = { calm: 0, warm: 0.15, aroused: 0.3, heated: 0.5, critical: 0.7 };
            if (Math.random() < (injectChance[aTier.value] || 0)) {
                const _arousalKey = { warm: 'arousal.warm', aroused: 'arousal.aroused', heated: 'arousal.heated', critical: 'arousal.critical' };
                const reactions = CYOA.tn(CONFIG.AROUSAL_BODY_REACTIONS?.[aTier.value], _arousalKey[aTier.value] || aTier.value);
                if (Array.isArray(reactions) && reactions.length > 0) {
                    const picked = reactions[Math.floor(Math.random() * reactions.length)];
                    t += '\n\n*' + picked + '*';
                }
            }
            // 刺激器叙事注入（活跃刺激器 ~40% 概率）
            const stims = arousalSave.activeStimulators || [];
            const activeStim = stims.find(s => s.mode !== 'off');
            if (activeStim && Math.random() < 0.4) {
                const stimNarrs = CYOA.tn(CONFIG.STIMULATOR_NARRATIVES?.[activeStim.stimType], 'stimulator.' + activeStim.stimType);
                if (Array.isArray(stimNarrs) && stimNarrs.length > 0) {
                    t += '\n\n*' + stimNarrs[Math.floor(Math.random() * stimNarrs.length)] + '*';
                }
            }
        }

        // 戒断幻触叙事注入
        const wdSave = CYOA.currentSave;
        if (wdSave?.withdrawalEffects?.length > 0 && Math.random() < 0.45) {
            const narrs = CYOA.tn(CONFIG.WITHDRAWAL_NARRATIVES || [], 'withdrawal');
            if (narrs.length > 0) {
                t += '\n\n*' + narrs[Math.floor(Math.random() * narrs.length)] + '*';
            }
        }

        // 姿势不适叙事注入
        if (wdSave) {
            const pos = wdSave.posture || 'standing';
            const pDur = wdSave.postureDuration || 0;
            const dEff = CONFIG.DURATION_EFFECTS?.postureDiscomfort?.[pos];
            if (dEff && pDur >= dEff.startTurn && Math.random() < 0.35) {
                const posNarrs = CYOA.tn(CONFIG.DISCOMFORT_NARRATIVES?.[pos], 'discomfort.' + pos) || CYOA.tn(CONFIG.DISCOMFORT_NARRATIVES?.general, 'discomfort.general') || [];
                if (posNarrs.length > 0) {
                    t += '\n\n*' + posNarrs[Math.floor(Math.random() * posNarrs.length)] + '*';
                }
            }
            // 长时间佩戴疲劳叙事
            const wearFat = CONFIG.DURATION_EFFECTS?.wearFatigue;
            if (wearFat) {
                const maxWear = Math.max(0, ...Object.values(wdSave.wearDurations || {}));
                if (maxWear >= wearFat.startTurn && Math.random() < 0.2) {
                    const genNarrs = CYOA.tn(CONFIG.DISCOMFORT_NARRATIVES?.general, 'discomfort.general') || [];
                    if (genNarrs.length > 0) {
                        t += '\n\n*' + genNarrs[Math.floor(Math.random() * genNarrs.length)] + '*';
                    }
                }
            }
        }

        const pick = arr => arr.length > 0 ? arr[Math.floor(Math.random() * arr.length)] : '';

        // 羞耻叙事注入
        const shameSave = CYOA.currentSave;
        if (shameSave && (shameSave.shame || 0) > 20 && Math.random() < 0.3) {
            const narrs = CYOA.tn(CONFIG.SHAME_NARRATIVES || [], 'shame');
            if (narrs.length > 0) t += '\n\n*' + pick(narrs) + '*';
        }

        // 呼吸困难叙事注入
        if (shameSave && (shameSave.oxygen ?? 100) < 70 && Math.random() < 0.35) {
            const narrs = CYOA.tn(CONFIG.OXYGEN_NARRATIVES || [], 'oxygen');
            if (narrs.length > 0) t += '\n\n*' + pick(narrs) + '*';
        }

        // 打击痕迹叙事注入
        if (shameSave?.marks?.length > 0 && Math.random() < 0.25) {
            const narrs = CYOA.tn(CONFIG.IMPACT_NARRATIVES?.medium, 'impact.medium') || CYOA.tn(CONFIG.IMPACT_NARRATIVES?.light, 'impact.light') || [];
            if (narrs.length > 0) t += '\n\n*' + pick(narrs) + '*';
        }

        // 温度叙事注入
        const temps = Object.entries(shameSave?.bodyTemp || {}).filter(([, v]) => v !== 0);
        if (temps.length > 0 && Math.random() < 0.3) {
            const hasHot = temps.some(([, v]) => v > 0);
            const hasCold = temps.some(([, v]) => v < 0);
            const key = (hasHot && hasCold) ? 'contrast' : hasHot ? 'hot' : 'cold';
            const narrs = CYOA.tn(CONFIG.TEMP_NARRATIVES?.[key], 'temp.' + key) || [];
            if (narrs.length > 0) t += '\n\n*' + pick(narrs) + '*';
        }

        // 困境叙事注入
        if (shameSave?.predicament && Math.random() < 0.4) {
            const pType = shameSave.predicament.type;
            const narrs = CYOA.tn(CONFIG.PREDICAMENT_NARRATIVES?.[pType], 'predicament.' + pType) || [];
            if (narrs.length > 0) t += '\n\n*' + pick(narrs) + '*';
        }

        // 感官剥夺增强叙事
        const depLvl = CYOA.getDeprivationLevel?.();
        if (depLvl && Math.random() < 0.35) {
            const depDur = shameSave?.deprivationDuration || 0;
            const depCfg = CONFIG.DEPRIVATION_CONFIG || {};
            let depKey = 'touch_amplify';
            if (depDur >= (depCfg.timeDistortionStart || 8)) depKey = 'time_distort';
            else if (depDur >= (depCfg.spaceDisorientStart || 5)) depKey = 'space_lost';
            const narrs = CYOA.tn(CONFIG.DEPRIVATION_NARRATIVES?.[depKey], 'deprivation.' + depKey) || [];
            if (narrs.length > 0) t += '\n\n*' + pick(narrs) + '*';
        }
        // 感官过载叙事
        if ((shameSave?.sensoryOverload || 0) > 0 && Math.random() < 0.5) {
            const narrs = CYOA.tn(CONFIG.DEPRIVATION_NARRATIVES?.sensory_overload, 'deprivation.sensoryOverload') || [];
            if (narrs.length > 0) t += '\n\n*' + pick(narrs) + '*';
        }

        // 乳胶叙事注入
        if ((shameSave?.latexCoverage || 0) > 20 && Math.random() < 0.3) {
            const latexHeat = shameSave.latexHeat || 0;
            const cfg = CONFIG.LATEX_ENCLOSURE_CONFIG || {};
            let narKey = 'squeak';
            if (shameSave.latexCoverage >= 91) narKey = 'sealed';
            else if (latexHeat >= (cfg.sweatStartThreshold || 15)) narKey = 'heat';
            // 汗液抑制吱嘎声：湿润乳胶不吱嘎，改为触感叙事
            if (narKey === 'squeak' && (shameSave.latexSweat || 0) > 30) {
                const swCfg = CONFIG.LATEX_SWEAT_CONFIG || {};
                if (Math.random() < (swCfg.squeakDampening || 0.3)) {
                    narKey = (shameSave.latexHeat || 0) >= 15 ? 'heat' : 'touch_amplify';
                }
            }
            const narrs = CYOA.tn(CONFIG.LATEX_NARRATIVES?.[narKey], 'latex.' + narKey) || [];
            if (narrs.length > 0) t += '\n\n*' + pick(narrs) + '*';
        }

        // 汗液叙事注入
        if ((shameSave?.latexSweat || 0) > 30 && Math.random() < 0.25) {
            const narrs = CYOA.tn(CONFIG.LATEX_SWEAT_NARRATIVES || [], 'latexSweat');
            if (narrs.length > 0) t += '\n\n*' + pick(narrs) + '*';
        }

        // 乳胶气味叙事注入
        if ((shameSave?.latexCoverage || 0) > 30 && Math.random() < 0.2) {
            const scents = CONFIG.LATEX_SCENT_NARRATIVES || {};
            const constraints = CYOA.getActiveConstraints?.() || new Set();
            const isBlind = constraints.has('blind');
            const scentProb = isBlind ? 0.5 : 0.25;
            if (Math.random() < scentProb) {
                let scentKey = 'fresh';
                if ((shameSave.latexSweat || 0) > 40) scentKey = 'sweat_mixed';
                else if (shameSave.latexCoverage >= 91) scentKey = 'sealed';
                else if ((shameSave.latexHeat || 0) >= 20) scentKey = 'warm';
                if ((shameSave.latexCondition ?? 100) < 30) scentKey = 'degraded';
                const snarrs = CYOA.tn(scents[scentKey], 'latexScent.' + scentKey) || CYOA.tn(scents.fresh, 'latexScent.fresh') || [];
                if (snarrs.length > 0) t += '\n\n*' + pick(snarrs) + '*';
            }
        }

        // 乳胶颜色叙事注入
        if (shameSave?.latexColor && Math.random() < 0.15) {
            const colorNarrs = CYOA.tn(CONFIG.LATEX_COLOR_NARRATIVES?.[shameSave.latexColor], 'latexColor.' + shameSave.latexColor) || [];
            if (colorNarrs.length > 0) t += '\n\n*' + pick(colorNarrs) + '*';
        }

        // 恐慌叙事注入
        if ((shameSave?.panic || 0) > 30 && Math.random() < 0.3) {
            const narrs = CYOA.tn(CONFIG.PANIC_NARRATIVES || [], 'panic');
            if (narrs.length > 0) t += '\n\n*' + pick(narrs) + '*';
        }

        // 液态乳胶叙事注入
        if (shameSave?.latexCoverage > 0) {
            const equipment = shameSave.equipment || {};
            const game = CYOA.currentGame;
            let hasLiquid = false;
            Object.values(equipment).forEach(item => {
                if (!item) return;
                const eDef = game?.equipment?.find(e => e.id === item.id);
                (eDef?.attachments || item.attachments || []).forEach(att => {
                    if (att.type === 'latex_layer') {
                        const thickDef = (CONFIG.LATEX_THICKNESS || []).find(td => td.value === att.latexThickness);
                        if (thickDef?.isLiquid) hasLiquid = true;
                    }
                });
            });
            if (hasLiquid && Math.random() < 0.2) {
                const narrs = CYOA.tn(CONFIG.LIQUID_LATEX_NARRATIVES || [], 'liquidLatex');
                if (narrs.length > 0) t += '\n\n*' + pick(narrs) + '*';
            }
        }

        // PetPlay叙事注入
        if (shameSave?.petplayRole && Math.random() < 0.3) {
            const narrs = CYOA.tn(CONFIG.PETPLAY_NARRATIVES?.[shameSave.petplayRole], 'petplay.' + shameSave.petplayRole) || [];
            if (narrs.length > 0) t += '\n\n*' + pick(narrs) + '*';
        }

        // 身份侵蚀叙事注入
        if ((shameSave?.identityErosion || 0) > 30 && Math.random() < 0.3) {
            const narrs = CYOA.tn(CONFIG.IDENTITY_NARRATIVES || [], 'identity');
            if (narrs.length > 0) t += '\n\n*' + pick(narrs) + '*';
        }

        // 自紧乳胶叙事注入
        if ((shameSave?.latexTightness || 0) > 30 && Math.random() < 0.3) {
            const tTier = CYOA.getTightnessTier?.();
            if (tTier) {
                const desc = tTier.desc || '';
                t += '\n\n*' + desc + '*';
            }
        }

        // 导电乳胶叙事注入
        const electroSave = shameSave?.electroLatex;
        if (electroSave?.active && electroSave.zones?.length > 0 && Math.random() < 0.35) {
            const activeZone = electroSave.zones[Math.floor(Math.random() * electroSave.zones.length)];
            const narrs = CYOA.tn(CONFIG.ELECTRO_NARRATIVES?.[activeZone.intensity], 'electro.' + activeZone.intensity) || CYOA.tn(CONFIG.ELECTRO_NARRATIVES?.tingle, 'electro.tingle') || [];
            if (narrs.length > 0) t += '\n\n*' + pick(narrs) + '*';
        }

        // 呼吸管叙事注入
        const tubeSave = shameSave?.breathingTube;
        if (tubeSave?.active && tubeSave.flowLevel !== 'full' && Math.random() < 0.3) {
            const narrs = CYOA.tn(CONFIG.TUBE_NARRATIVES?.[tubeSave.flowLevel], 'tube.' + tubeSave.flowLevel) || [];
            if (narrs.length > 0) t += '\n\n*' + pick(narrs) + '*';
        }

        // 护理状态叙事注入
        if ((shameSave?.latexCondition ?? 100) < 50 && (shameSave?.latexCoverage || 0) > 20 && Math.random() < 0.25) {
            const narrs = CYOA.tn(CONFIG.MAINTENANCE_NARRATIVES || [], 'maintenance');
            const effect = CYOA.getMaintenanceEffect?.();
            if (effect?.desc) t += '\n\n*' + effect.desc + '*';
            else if (narrs.length > 0) t += '\n\n*' + pick(narrs) + '*';
        }

        // 步态叙事注入
        const gaitNow = CYOA.getCurrentGait?.();
        if (gaitNow && gaitNow.value !== 'normal' && gaitNow.narratives?.length > 0 && Math.random() < 0.25) {
            const gaitNarrs = CYOA.tn(gaitNow.narratives, 'gait.' + gaitNow.value);
            t += '\n\n*' + pick(gaitNarrs) + '*';
        }

        // 口水/强制张口叙事注入
        const activeGagDef = CYOA.getActiveGagType?.();
        if (activeGagDef?.suppressDrool && Math.random() < 0.3) {
            const oralNarrs = CYOA.tn(CONFIG.CONSTRAINT_SENSORY_NARRATIVES?.oral_sheath, 'constraintSensory.oralSheath') || [];
            if (oralNarrs.length > 0) t += '\n\n*' + pick(oralNarrs) + '*';
        } else if ((shameSave?.drool || 0) > 20 && Math.random() < 0.35) {
            const narrs = CYOA.tn(CONFIG.DROOL_NARRATIVES || [], 'drool');
            if (narrs.length > 0) t += '\n\n*' + pick(narrs) + '*';
        }

        // 头颈约束叙事注入
        const headR = CYOA.getActiveHeadRestrictions?.() || { canTurn: true, canNod: true };
        if ((!headR.canTurn || !headR.canNod) && Math.random() < 0.2) {
            const narrs = CYOA.tn(CONFIG.HEAD_NECK_NARRATIVES || [], 'headNeck');
            if (narrs.length > 0) t += '\n\n*' + pick(narrs) + '*';
        }

        // 手指约束叙事注入
        if (constraints.has('no_fingers') && Math.random() < 0.2) {
            const narrs = CYOA.tn(CONFIG.FINGER_NARRATIVES || [], 'finger');
            if (narrs.length > 0) t += '\n\n*' + pick(narrs) + '*';
        }

        // 耳部装置叙事注入
        if (constraints.has('deaf') && Math.random() < 0.2) {
            const narrs = CYOA.tn(CONFIG.EAR_DEVICE_NARRATIVES || [], 'earDevice');
            if (narrs.length > 0) t += '\n\n*' + pick(narrs) + '*';
        }

        return t;
    }

    // ========== 处理AI响应 ==========
    CYOA.processAIResponse = async function(fullResponse, userMessage, targetRole, filteredResponse) {
        const currentSave = CYOA.currentSave;
        if (!currentSave) return;
        const currentNodeId = CYOA.currentNodeId;
        
        // 保存新的剧情节点（原文用于选项提取和任务检测，过滤后文本用于界面显示）
        const newNodeId = 'node_' + Date.now();
        currentSave.nodes[newNodeId] = {
            id: newNodeId,
            parentId: currentNodeId,
            userMessage: userMessage,
            assistantMessage: filteredResponse || fullResponse,
            rawAssistantMessage: fullResponse,
            options: CYOA.extractOptions(fullResponse),
            summary: userMessage.substring(0, 30) + '...',
            createdAt: Date.now(),
            childrenIds: []
        };
        
        // 更新父节点的childrenIds
        if (currentNodeId && currentSave.nodes[currentNodeId]) {
            if (!currentSave.nodes[currentNodeId].childrenIds) {
                currentSave.nodes[currentNodeId].childrenIds = [];
            }
            currentSave.nodes[currentNodeId].childrenIds.push(newNodeId);
        }
        
        CYOA.currentNodeId = newNodeId;
        currentSave.currentNodeId = newNodeId;
        
        // 检查任务完成情况
        await CYOA.checkQuestProgress(fullResponse);
        
        // AI 挣扎关键词自动检测
        const strugglePattern = /(?:挣扎|挣脱|扯动|试图解开|拼命拽|使劲扭动|奋力挣|拼命挣|剧烈扭|猛力拉扯)\s*(?:了?)?\s*(?:手|脚|腿|头|眼|腰|身|胯|脖|颈|嘴|腕|脚踝|大腿|手腕|手掌)?/g;
        const slotKeywords = {
            '手': 'palm', '手掌': 'palm', '手腕': 'wrist', '腕': 'wrist',
            '脚': 'ankle', '脚踝': 'ankle', '腿': 'thigh', '大腿': 'thigh',
            '头': 'head', '眼': 'eyes', '嘴': 'mouth',
            '腰': 'waist', '身': 'chest', '胯': 'crotch',
            '脖': 'neck', '颈': 'neck'
        };
        let struggleMatch;
        const processedSlots = new Set();
        while ((struggleMatch = strugglePattern.exec(fullResponse)) !== null) {
            const bodyPart = struggleMatch[0].replace(/.*(?:挣扎|挣脱|扯动|试图解开|拼命拽|使劲扭动|奋力挣|拼命挣|剧烈扭|猛力拉扯)\s*了?\s*/, '').trim();
            let targetSlot = slotKeywords[bodyPart] || null;
            if (!targetSlot) {
                const equippedSlots = Object.keys(currentSave.equipment || {}).filter(s => currentSave.equipment[s]);
                if (equippedSlots.length) targetSlot = equippedSlots[0];
            }
            if (targetSlot && !processedSlots.has(targetSlot) && currentSave.equipment?.[targetSlot]) {
                processedSlots.add(targetSlot);
                const sItem = currentSave.equipment[targetSlot];
                const sEquipDef = CYOA.currentGame?.equipment?.find(e => e.id === sItem?.id);
                const result = attemptStruggle(targetSlot);
                if (result) {
                    if (result.success && !result.broken) {
                        if (sEquipDef?.statModifiers) {
                            const mods = parseStatModifiers(sEquipDef.statModifiers);
                            applyStatModifiers(mods, false);
                        }
                        const already = currentSave.inventory.some(i => i.id === sItem.id);
                        if (!already) currentSave.inventory.push(sItem);
                    } else if (result.broken && sEquipDef?.statModifiers) {
                        const mods = parseStatModifiers(sEquipDef.statModifiers);
                        applyStatModifiers(mods, false);
                    }
                    const logEl = document.getElementById('log');
                    if (logEl) {
                        const sysDiv = document.createElement('div');
                        sysDiv.className = 'cyoa-struggle-msg';
                        sysDiv.style.cssText = 'text-align:center; padding:8px 12px; margin:6px 0; border-radius:8px; font-size:13px; ' +
                            (result.success ? 'background:linear-gradient(135deg,#dcfce7,#bbf7d0); color:#16a34a; font-weight:600;' :
                             result.degraded ? 'background:linear-gradient(135deg,#fef3c7,#fde68a); color:#d97706;' :
                             'background:linear-gradient(135deg,#fee2e2,#fecaca); color:#dc2626;');
                        let msg = result.narrative;
                        if (result.duraDmg > 0) msg += ` [${t('ui.struggle.durDown', {n: result.duraDmg})} → ${result.remainingDurability}/${result.maxDurability}]`;
                        sysDiv.textContent = msg;
                        logEl.appendChild(sysDiv);
                    }
                }
            }
        }

        // 监控介入检查：警觉度达到阈值时注入系统消息
        if (isChapterMonitored()) {
            const alertVal = getObserverAlert();
            const alertCfg = CONFIG.OBSERVER_ALERT_CONFIG;
            const interventionThreshold = alertCfg?.interventionThreshold || 100;
            if (alertVal >= interventionThreshold) {
                const logEl = document.getElementById('log');
                if (logEl) {
                    const intDiv = document.createElement('div');
                    intDiv.className = 'cyoa-cctv-intervention';
                    intDiv.style.cssText = 'text-align:center; padding:12px 16px; margin:8px 0; border-radius:8px; font-size:13px; font-weight:600; background:linear-gradient(135deg,#fef2f2,#fee2e2); color:#b91c1c; border:2px solid #f87171; animation: pulse 1.5s infinite;';
                    intDiv.textContent = t('ui.chapter.securityAlert');
                    logEl.appendChild(intDiv);
                }
            }
        }

        // 检查物品消耗（从AI响应中解析）
        CYOA.parseAndApplyItemChanges(fullResponse);
        
        // 技能熟练度：当 AI 回复中提到某个已学技能的名字时，自动增加少量熟练度
        if (currentSave.skills?.length) {
            currentSave.skills.forEach(skill => {
                if (fullResponse.includes(skill.name)) {
                    const gain = Math.floor(Math.random() * 6) + 5;
                    const result = CYOA.addSkillProficiency(skill.id, gain);
                    if (result) {
                        const logEl = document.getElementById('log');
                        if (logEl) {
                            const lvUpDiv = document.createElement('div');
                            lvUpDiv.style.cssText = 'text-align:center; padding:8px; margin:6px 0; background:linear-gradient(135deg,#fff8e1,#fff3c4); border-radius:8px; font-size:13px; color:#f59e0b; font-weight:600;';
                            lvUpDiv.textContent = t('ui.msg.skillLevelUp', {name: skill.name, level: result.newLevel + (result.label ? ' ' + result.label : '')});
                            logEl.appendChild(lvUpDiv);
                        }
                    }
                }
            });
        }
        
        // 保存存档
        if (CYOA.DataManager) {
            CYOA.DataManager.saveSaves();
        }
        
        // 更新面板
        CYOA.renderTreePanel();
        CYOA.renderInventoryPanel();
        CYOA.renderAttributesPanel();
        CYOA.renderQuestsPanel();
        CYOA.renderSkillsPanel?.();
        CYOA.renderGameOptions();

        // 每轮综合系统更新（兴奋度/时长/习惯度/呼吸/痕迹/温度/困境/感官剥夺/羞耻）
        CYOA.updateAllSystems();

        // 检查章节推进条件
        CYOA.checkChapterTransition();

        // 滚动摘要：对话积累到一定量后自动压缩历史
        triggerRollingSummary();
    };

    // ========== 渲染游戏选项按钮（含限步/缚手/禁言约束过滤与通用默认选项） ==========
    CYOA.renderGameOptions = function() {
        const container = document.getElementById('gameOptions');
        if (!container || !CYOA.currentSave) return;
        const node = CYOA.currentSave.nodes[CYOA.currentNodeId];
        let options = (node && node.options) ? node.options : [];

        // 兼容旧存档：若选项是纯字符串数组，转换为 { type, text } 对象
        options = options.map(opt => {
            if (typeof opt === 'string') return { type: 'action', text: opt.replace(/^🔹\s*/, '').trim() };
            return opt;
        });

        const constraints = getActiveConstraints();
        const limitedStepRe = /(逃跑|奔跑|快跑|跑走|跑开|跑出|跑去|跑向|跑过|冲出|冲向|冲去|冲刺|飞奔|跳过|跳下|跳上|跳出|跳开|跳跃|翻过|翻越|攀爬|攀上|离开|走出|走开|走去|走掉|逃离|逃走|远离|撤退|大步|迈步)/;
        const noHandsRe = /(拿起|拿取|拿出|拿来|拿走|取出|取下|取来|捡起|拾起|抓住|抓取|抓起|握住|握紧|使用道具|使用物品|使用钥匙|脱下|脱掉|解开|解除|穿上|穿戴|装备上|卸下|投掷|丢出|扔掉|推开|拉开|打开门|打开箱|开锁)/;
        const tetheredRe = /(离开|逃跑|逃离|逃走|前往|走向|移动到|换一个地方|走出|走开|走去|走掉|远离|撤退|跑出|跑去|跑向|冲出|冲向|冲去|溜走|出发|转移|去往|赶往)/;
        const suspendedRe = /(走|跑|站|坐|跪|蹲|踢|踩|跳|迈步|行走|奔跑|跑步|散步|起身)/;
        const groundPostureRe = /(跑|跳|冲|奔|冲刺|飞奔|跳跃|跳过|跳上)/;

        const currentPosture = CYOA.currentSave?.posture || 'standing';
        const arousalTier = CYOA.getArousalTier?.() || { value: 'calm' };
        const arousalEffects = CONFIG.AROUSAL_GAMEPLAY_EFFECTS?.[arousalTier.value] || {};
        const precisionRe = /(开锁|撬锁|解锁|精密|仔细|小心翼翼|谨慎|细致|制作|修理|拆解|组装|缝合|书写|绘制|瞄准|射击)/;

        const beforeCount = options.length;
        const filtered = options.filter(opt => {
            if (opt.type === 'action') {
                if (constraints.has('limited_step') && limitedStepRe.test(opt.text)) return false;
                if (constraints.has('no_hands') && noHandsRe.test(opt.text)) return false;
                if (constraints.has('tethered') && tetheredRe.test(opt.text)) return false;
                if (currentPosture === 'suspended' && suspendedRe.test(opt.text)) return false;
                if ((currentPosture === 'kneeling' || currentPosture === 'prone' || currentPosture === 'supine' || currentPosture === 'hogtied') && groundPostureRe.test(opt.text)) return false;
                if (arousalEffects.filterPrecision && precisionRe.test(opt.text)) return false;
                // 氧气过低：禁止体力行动
                if ((CYOA.currentSave?.oxygen ?? 100) <= 25 && /跑|冲|跳|攀|爬|推|拉|搬|举/g.test(opt.text)) return false;
                // 羞耻崩溃：禁止社交行动
                const shameTier = CYOA.getShameTier?.()?.value;
                if ((shameTier === 'humiliated' || shameTier === 'broken') && /交谈|说服|对话|谈判|请求|恳求|命令/g.test(opt.text)) return false;
            }
            if (opt.type === 'speech' && constraints.has('mute')) return false;
            if (constraints.has('forced_open_mouth') && /唇语|用嘴说|吹口哨|吹哨|舔|吸吮|咬|吻|亲|啃|咀嚼|吃东西|喝水|饮|吞咽/.test(opt.text)) return false;
            if (constraints.has('no_fingers') && /抓|握|捏|拿|拧|解|扣|按钮|打字|写字|手语|手指|指尖|拨|开锁|钥匙|操作/.test(opt.text)) return false;
            return true;
        });

        // 限步/缚手/禁言时，在选项最前插入通用默认反应选项
        const defaultActions = CONFIG.CONSTRAINT_DEFAULT_ACTIONS;
        const inConstraint = constraints.has('limited_step') || constraints.has('no_hands') || constraints.has('mute') || constraints.has('tethered');
        const hasDefaultActions = defaultActions && Array.isArray(defaultActions) && defaultActions.length > 0;
        const displayList = (inConstraint && hasDefaultActions)
            ? defaultActions.map(a => ({ _default: true, type: 'action', label: a.label, modifiers: a.modifiers }))
                .concat(filtered.map(opt => ({ _default: false, ...opt })))
            : filtered.map(opt => ({ _default: false, ...opt }));

        // 约束提示
        const anyFilteredByStep = constraints.has('limited_step') && options.some(opt => opt.type === 'action' && limitedStepRe.test(opt.text));
        const anyFilteredByHands = constraints.has('no_hands') && options.some(opt => opt.type === 'action' && noHandsRe.test(opt.text));
        const anyFilteredByFingers = constraints.has('no_fingers') && options.some(opt => /抓|握|捏|拿|拧|解|扣|按钮|打字|写字|手语|手指|指尖|拨|开锁|钥匙|操作/.test(opt.text));
        const anyFilteredByMute = constraints.has('mute') && options.some(opt => opt.type === 'speech');
        const anyFilteredByTether = constraints.has('tethered') && options.some(opt => opt.type === 'action' && tetheredRe.test(opt.text));
        const anyFilteredByPosture = currentPosture !== 'standing' && options.some(opt => {
            if (opt.type !== 'action') return false;
            if (currentPosture === 'suspended' && suspendedRe.test(opt.text)) return true;
            if (['kneeling', 'prone', 'supine', 'hogtied'].includes(currentPosture) && groundPostureRe.test(opt.text)) return true;
            return false;
        });
        let constraintHints = [];
        if (filtered.length < beforeCount) {
            if (anyFilteredByStep) {
                const lsP = getLimitedStepParams();
                if (lsP) {
                    const spdSign = (lsP.speedModifierPct >= 0 ? '+' : '') + lsP.speedModifierPct;
                    constraintHints.push(t('ui.constraint.stepLimit', {cm: lsP.stepLimitCm, speed: spdSign}));
                } else {
                    constraintHints.push(t('ui.constraint.stepGeneric'));
                }
            }
            if (anyFilteredByHands) constraintHints.push(t('ui.constraint.handsAction'));
            if (anyFilteredByFingers) {
                const fDef = CYOA.getActiveFingerRestraint?.();
                constraintHints.push(t('ui.constraint.fingerRestrict', {label: fDef?.label || '约束'}));
            }
            if (anyFilteredByMute) {
                if (constraints.has('forced_open_mouth')) {
                    const muteGag = CYOA.getActiveGagType?.();
                    if (muteGag?.suppressDrool) {
                        constraintHints.push(t('ui.constraint.forcedMouth'));
                    } else {
                        constraintHints.push(t('ui.constraint.drooling'));
                    }
                } else {
                    constraintHints.push(t('ui.constraint.gagged'));
                }
            }
            if (anyFilteredByTether) {
                const tetherInfo = CYOA.currentSave?.tether;
                const tetherDef = (CONFIG.TETHER_TYPES || []).find(x => x.value === tetherInfo?.type);
                constraintHints.push(t('ui.constraint.tethered'));
            }
            if (anyFilteredByPosture) {
                const postureDef = (CONFIG.POSTURES || []).find(p => p.value === currentPosture);
                constraintHints.push(t('ui.constraint.postureLimited', {posture: postureDef?.label || currentPosture}));
            }
            if (arousalEffects.filterPrecision && options.some(opt => opt.type === 'action' && precisionRe.test(opt.text))) {
                constraintHints.push(t('ui.constraint.trembling', {reason: arousalTier.label}));
            }
            if (constraintHints.length === 0) constraintHints.push(t('ui.constraint.physicalLimit'));
        }

        container.innerHTML = '';
        if (constraintHints.length) {
            const hintEl = document.createElement('div');
            hintEl.className = 'cyoa-options-constraint-hint';
            hintEl.style.cssText = 'font-size:11px;color:var(--text-light,#666);margin-bottom:6px;font-style:italic;';
            hintEl.textContent = constraintHints.join(' ');
            container.appendChild(hintEl);
        }
        displayList.forEach(item => {
            const btn = document.createElement('button');
            btn.type = 'button';
            const isSpeech = item.type === 'speech';
            btn.className = 'cyoa-btn cyoa-btn-secondary';
            if (isSpeech) {
                btn.style.cssText += 'border-left:3px solid var(--primary,#4CAF50);';
            }

            if (item._default) {
                btn.textContent = '🎬 ' + item.label;
                btn.onclick = function() {
                    if (item.modifiers && typeof CYOA.applyStatModifiers === 'function') {
                        CYOA.applyStatModifiers(item.modifiers, true);
                    }
                    const msgInput = document.getElementById('gameMsg');
                    if (msgInput) msgInput.value = item.label;
                    CYOA.sendGameMessage();
                };
            } else {
                const text = item.text || '';
                btn.textContent = (isSpeech ? '💬 ' : '🎬 ') + text;
                btn.onclick = function() {
                    if (isSpeech) {
                        const speechInput = document.getElementById('gameSpeech');
                        if (speechInput) speechInput.value = text;
                    } else {
                        const actionInput = document.getElementById('gameMsg');
                        if (actionInput) actionInput.value = text;
                    }
                    CYOA.sendGameMessage();
                };
            }
            container.appendChild(btn);
        });
    };

    // ========== 技能熟练度与等级 ==========
    CYOA.addSkillProficiency = function(skillId, amount) {
        if (!CYOA.currentSave?.skills) return null;
        const skill = CYOA.currentSave.skills.find(s => s.id === skillId);
        if (!skill) return null;

        const maxLv = CONFIG.SKILL_MAX_LEVEL || 9;
        const minLv = CONFIG.SKILL_MIN_LEVEL || 1;
        const perLv = CONFIG.SKILL_PROFICIENCY_PER_LEVEL || 100;
        const levelLabels = CONFIG.SKILL_LEVEL_LABELS || {};

        if (!skill.level) skill.level = minLv;
        if (typeof skill.proficiency !== 'number') skill.proficiency = 0;

        skill.proficiency += amount;

        let leveledUp = false;
        while (skill.proficiency >= perLv && skill.level < maxLv) {
            skill.proficiency -= perLv;
            skill.level++;
            leveledUp = true;
        }
        if (skill.level >= maxLv) {
            skill.proficiency = Math.min(skill.proficiency, perLv);
        }

        persistSave();
        CYOA.renderSkillsPanel?.();

        if (leveledUp) {
            const tag = levelLabels[skill.level] || '';
            return { skill, newLevel: skill.level, label: tag };
        }
        return null;
    };

    CYOA.addSkillProficiencyByName = function(skillName, amount) {
        if (!CYOA.currentSave?.skills) return null;
        const skill = CYOA.currentSave.skills.find(s => s.name === skillName);
        if (!skill) return null;
        return CYOA.addSkillProficiency(skill.id, amount);
    };

    CYOA.getSkillLevel = function(skillId) {
        const skill = CYOA.currentSave?.skills?.find(s => s.id === skillId);
        if (!skill) return 0;
        return skill.level || CONFIG.SKILL_MIN_LEVEL || 1;
    };

    CYOA.getSkillLevelLabel = function(level) {
        const labels = CONFIG.SKILL_LEVEL_LABELS || {};
        return labels[level] || '';
    };

    // 等级缩放：效果倍率（越高越强）
    CYOA.getSkillEffectMultiplier = function(level) {
        const lv = level || 1;
        const scale = CONFIG.SKILL_EFFECT_SCALE_PER_LEVEL || 0.15;
        return 1 + (lv - 1) * scale;
    };

    // 等级缩放：消耗倍率（越高消耗越少）
    CYOA.getSkillCostMultiplier = function(level) {
        const lv = level || 1;
        const reduce = CONFIG.SKILL_COST_REDUCE_PER_LEVEL || 0.08;
        const floor = CONFIG.SKILL_COST_FLOOR || 0.3;
        return Math.max(floor, 1 - (lv - 1) * reduce);
    };

    // 按等级缩放后的实际消耗数量
    CYOA.getScaledConsumeCost = function(baseAmount, level) {
        return Math.max(1, Math.ceil(baseAmount * CYOA.getSkillCostMultiplier(level)));
    };

    // 按等级缩放后的效果描述字符串
    CYOA.getScaledEffectText = function(baseEffect, level) {
        if (!baseEffect) return '';
        const mult = CYOA.getSkillEffectMultiplier(level);
        if (mult === 1) return baseEffect;
        return baseEffect + ` (×${mult.toFixed(2)})`;
    };

    // ========== 检查任务进度 ==========
    CYOA.checkQuestProgress = async function(aiResponse) {
        const currentSave = CYOA.currentSave;
        if (!currentSave.quests) return;
        
        let questUpdated = false;
        
        // 遍历所有任务
        currentSave.quests.forEach(quest => {
            if (quest.status === 'completed' || quest.status === 'failed') return;
            
            // 检查任务是否应该开始
            if (quest.status === 'locked' || quest.status === 'available') {
                // 简单关键词触发（实际应该用更复杂的规则）
                if (quest.unlockCondition && aiResponse.includes(quest.unlockCondition)) {
                    quest.status = 'active';
                    quest.started = true;
                    questUpdated = true;
                    
                    // 添加系统消息
                    CYOA.appendSystemMessage(`✨ 新任务开始：${quest.name}`);
                }
            }
            
            // 检查任务完成条件
            if (quest.status === 'active' && quest.objectives) {
                let allCompleted = true;
                
                quest.objectives.forEach((objective, idx) => {
                    // 初始化进度
                    if (!quest.progress) quest.progress = {};
                    if (quest.progress[idx] === undefined) quest.progress[idx] = false;
                    
                    // 检查是否完成（简单关键词匹配）
                    if (!quest.progress[idx] && aiResponse.includes(objective)) {
                        quest.progress[idx] = true;
                        questUpdated = true;
                        CYOA.appendSystemMessage(`✅ 任务目标完成：${objective}`);
                    }
                    
                    if (!quest.progress[idx]) allCompleted = false;
                });
                
                if (allCompleted && quest.status === 'active') {
                    quest.status = 'completed';
                    quest.completed = true;
                    questUpdated = true;
                    
                    // 发放奖励
                    if (quest.rewards && quest.rewards.length > 0) {
                        CYOA.grantQuestRewards(quest.rewards);
                    }
                    
                    CYOA.appendSystemMessage(`🎉 任务完成：${quest.name}`);
                }
            }
        });
        
        if (questUpdated) {
            if (CYOA.DataManager) {
                CYOA.DataManager.saveSaves();
            }
            CYOA.renderQuestsPanel();
        }
    };

    // ========== 发放任务奖励 ==========
    CYOA.grantQuestRewards = function(rewards) {
        const currentSave = CYOA.currentSave;
        const currentGame = CYOA.currentGame;
        
        rewards.forEach(reward => {
            // 解析奖励格式：物品名称 或 技能名称 或 属性+5
            if (reward.startsWith('物品:')) {
                const itemName = reward.substring(3).trim();
                const itemDef = currentGame.items?.find(i => i.name === itemName);
                if (itemDef) {
                    const newItem = JSON.parse(JSON.stringify(itemDef));
                    newItem.id = CYOA.generateId();
                    currentSave.inventory.push(newItem);
                    CYOA.appendSystemMessage(`📦 获得物品：${itemName}`);
                }
            } else if (reward.startsWith('技能:')) {
                const skillName = reward.substring(3).trim();
                const skillDef = currentGame.skills?.find(s => s.name === skillName);
                if (skillDef && !currentSave.skills.some(s => s.id === skillDef.id)) {
                    currentSave.skills.push(JSON.parse(JSON.stringify(skillDef)));
                    CYOA.appendSystemMessage(`✨ 学会技能：${skillName}`);
                }
            } else if (reward.includes('+')) {
                // 属性提升
                const match = reward.match(/([^+]+)\+(\d+)/);
                if (match) {
                    const attrName = match[1].trim();
                    const value = parseInt(match[2]);
                    const attr = currentSave.attributes?.find(a => a.name === attrName);
                    if (attr) {
                        attr.value = Math.min(attr.max, attr.value + value);
                        CYOA.appendSystemMessage(`📈 ${attrName} +${value}`);
                    }
                }
            }
        });
    };

    // ========== 解析并应用物品变化 ==========
    CYOA.parseAndApplyItemChanges = function(aiResponse) {
        const currentSave = CYOA.currentSave;
        if (!currentSave.inventory) return;
        
        // 检查物品消耗（从AI响应中提取，例如 "消耗了1个煤油"）
        const consumePattern = /消耗了\s*(\d+)\s*个?\s*([^，。\s]+)/g;
        let match;
        while ((match = consumePattern.exec(aiResponse)) !== null) {
            const amount = parseInt(match[1]);
            const itemName = match[2];
            
            const itemIndex = currentSave.inventory.findIndex(i => i.name === itemName);
            if (itemIndex >= 0) {
                const item = currentSave.inventory[itemIndex];
                const qty = item.quantity || 1;
                if (qty > amount) {
                    item.quantity = qty - amount;
                } else if (item.durability !== undefined && item.durability > 0) {
                    item.durability -= amount;
                    if (item.durability <= 0) {
                        currentSave.inventory.splice(itemIndex, 1);
                        CYOA.appendSystemMessage(`❌ ${itemName} 已耗尽`);
                    }
                } else {
                    currentSave.inventory.splice(itemIndex, 1);
                    CYOA.appendSystemMessage(`❌ ${itemName} 已耗尽`);
                }
            }
        }
        
        // 检查装备耐久消耗（跳过不可破坏装备，触发降级逻辑）
        const durabilityPattern = /([^，。\s]+)的耐久度[下降低了]了\s*(\d+)/g;
        while ((match = durabilityPattern.exec(aiResponse)) !== null) {
            const equipName = match[1];
            const amount = parseInt(match[2]);
            
            for (const slot in currentSave.equipment) {
                const equip = currentSave.equipment[slot];
                if (!equip || equip.name !== equipName) continue;
                const equipDef = CYOA.currentGame?.equipment?.find(e => e.id === equip.id);
                const isIndestructible = equip.indestructible ?? equipDef?.indestructible ?? false;
                if (isIndestructible) break;
                if (equip.durability === undefined) break;

                equip.durability = Math.max(0, equip.durability - amount);
                applyDegradation(equip, equipDef);
                if (equip.durability <= 0) {
                    delete currentSave.equipment[slot];
                    if (equipDef?.statModifiers) {
                        const mods = parseStatModifiers(equipDef.statModifiers);
                        applyStatModifiers(mods, false);
                    }
                    CYOA.appendSystemMessage(`💔 ${equipName} 损坏了`);
                }
                break;
            }
        }
        
        // 检查获得物品
        const gainPattern = /获得了\s*(\d+)\s*个?\s*([^，。\s]+)/g;
        while ((match = gainPattern.exec(aiResponse)) !== null) {
            const amount = parseInt(match[1]);
            const itemName = match[2];
            
            const itemDef = CYOA.currentGame.items?.find(i => i.name === itemName);
            if (itemDef) {
                const maxQty = CONFIG.ITEM_MAX_QUANTITY || 99;
                const existingItem = currentSave.inventory.find(i => i.name === itemName);
                if (existingItem) {
                    existingItem.quantity = Math.min(maxQty, (existingItem.quantity || 1) + amount);
                } else {
                    const newItem = JSON.parse(JSON.stringify(itemDef));
                    newItem.quantity = Math.min(maxQty, amount);
                    currentSave.inventory.push(newItem);
                }
                // 标记为已获取
                if (!currentSave.acquiredItemIds) currentSave.acquiredItemIds = [];
                if (!currentSave.acquiredItemIds.includes(itemDef.id)) {
                    currentSave.acquiredItemIds.push(itemDef.id);
                }
            }
        }
    };

    // 显式获取物品（按名称或 ID，从游戏定义中查找并放入背包）
    CYOA.acquireItem = function(nameOrId, amount) {
        if (!CYOA.currentSave || !CYOA.currentGame) return false;
        const qty = amount || 1;
        const maxQty = CONFIG.ITEM_MAX_QUANTITY || 99;
        const gameDef = CYOA.currentGame.items?.find(i => i.id === nameOrId || i.name === nameOrId);
        if (!gameDef) return false;

        const existing = CYOA.currentSave.inventory.find(i => i.id === gameDef.id || i.name === gameDef.name);
        if (existing) {
            existing.quantity = Math.min(maxQty, (existing.quantity || 1) + qty);
        } else {
            const newItem = JSON.parse(JSON.stringify(gameDef));
            newItem.quantity = Math.min(maxQty, qty);
            CYOA.currentSave.inventory.push(newItem);
        }

        if (!CYOA.currentSave.acquiredItemIds) CYOA.currentSave.acquiredItemIds = [];
        if (!CYOA.currentSave.acquiredItemIds.includes(gameDef.id)) {
            CYOA.currentSave.acquiredItemIds.push(gameDef.id);
        }

        persistSave();
        CYOA.renderInventoryPanel?.();
        return true;
    };

    // 移除物品
    CYOA.removeItem = function(nameOrId, amount) {
        if (!CYOA.currentSave) return false;
        const qty = amount || 1;
        const idx = CYOA.currentSave.inventory.findIndex(i => i.id === nameOrId || i.name === nameOrId);
        if (idx < 0) return false;

        const item = CYOA.currentSave.inventory[idx];
        const curQty = item.quantity || 1;
        if (curQty > qty) {
            item.quantity = curQty - qty;
        } else {
            CYOA.currentSave.inventory.splice(idx, 1);
        }

        persistSave();
        CYOA.renderInventoryPanel?.();
        return true;
    };

    // ========== 添加系统消息 ==========
    CYOA.appendSystemMessage = function(message) {
        const logEl = document.getElementById('log');
        if (!logEl) return;
        
        const systemDiv = document.createElement('div');
        systemDiv.className = 'ai system-message';
        systemDiv.style.background = 'rgba(16, 185, 129, 0.05)';
        systemDiv.style.borderLeft = '4px solid #10b981';
        systemDiv.textContent = `📌 ${message}`;
        logEl.appendChild(systemDiv);
        logEl.scrollTop = logEl.scrollHeight;
    };

    // ========== 从AI回复中提取选项 ==========
    CYOA.extractOptions = function(text) {
        const options = [];
        const lines = text.split('\n');
        const typeRe = /^🔹\s*\((行动|对话)\)\s*/;
        lines.forEach(line => {
            const trimmed = line.trim();
            if (!trimmed.startsWith('🔹')) return;
            const m = trimmed.match(typeRe);
            if (m) {
                options.push({
                    type: m[1] === '行动' ? 'action' : 'speech',
                    text: trimmed.replace(typeRe, '').trim()
                });
            } else {
                // 兼容旧格式：无前缀默认为行动
                options.push({
                    type: 'action',
                    text: trimmed.replace(/^🔹\s*/, '').trim()
                });
            }
        });
        return options;
    };

    // ========== 跳转到指定节点 ==========
    CYOA.jumpToNode = function(nodeId) {
        if (!CYOA.currentSave || !CYOA.currentSave.nodes[nodeId]) return;
        
        log('跳转到节点', nodeId);
        CYOA.currentNodeId = nodeId;
        CYOA.currentSave.currentNodeId = nodeId;
        
        if (CYOA.DataManager) {
            CYOA.DataManager.saveSaves();
        }
        
        const logEl = document.getElementById('log');
        if (!logEl) return;
        
        logEl.innerHTML = '';
        
        // 重建路径
        const path = [];
        let nId = nodeId;
        while (nId && CYOA.currentSave.nodes[nId]) {
            path.unshift(nId);
            nId = CYOA.currentSave.nodes[nId].parentId;
        }
        
        path.forEach(id => {
            const node = CYOA.currentSave.nodes[id];
            if (node.userMessage) {
                const userDiv = document.createElement('div');
                userDiv.className = 'user';
                userDiv.style.cssText = 'margin:10px 0; text-align:right;';
                const span = document.createElement('span');
                span.style.cssText = 'background:var(--cyoa-primary-light); padding:10px 14px; border-radius:12px 12px 0 12px; display:inline-block;';
                span.textContent = node.userMessage;
                userDiv.appendChild(span);
                logEl.appendChild(userDiv);
            }
            const aiDiv = document.createElement('div');
            aiDiv.className = 'ai';
            aiDiv.style.margin = "10px 0";
            aiDiv.textContent = node.assistantMessage;
            logEl.appendChild(aiDiv);
        });
        
        logEl.scrollTop = logEl.scrollHeight;
        CYOA.renderTreePanel();
        CYOA.renderGameOptions();
    };

    // ========== 角色切换 ==========
    CYOA.onRoleChange = function(role) {
        if (CYOA.currentSave) {
            CYOA.currentSave.playerCharacter = role;
        }
    };

    // ========== 装备系统 ==========
    CYOA.equipItem = function(itemIndex) {
        if (!CYOA.currentSave) return;
        if (getActiveConstraints().has('no_hands')) {
            alert(t('ui.msg.handsRestricted'));
            return;
        }
        const item = CYOA.currentSave.inventory[itemIndex];
        if (!item) return;
        
        // 检查是否是装备
        const equipDef = CYOA.currentGame?.equipment?.find(e => e.id === item.id);
        if (!equipDef) {
            alert(t('ui.msg.cannotEquip'));
            return;
        }
        
        // 检查锁定状态
        if (equipDef.locked) {
            if (equipDef.unlockItemId) {
                const hasKey = CYOA.currentSave.inventory.some(i => i.id === equipDef.unlockItemId);
                if (!hasKey) {
                    const keyItem = CYOA.currentGame.items?.find(i => i.id === equipDef.unlockItemId);
                    alert(t('ui.msg.needKey', {name: keyItem ? keyItem.name : equipDef.unlockItemId}));
                    return;
                }
            }
        }
        
        // 装备到所有部位
        (equipDef.slots || []).forEach(slot => {
            if (CYOA.currentSave.equipment[slot]) {
                const oldItem = CYOA.currentSave.equipment[slot];
                if (oldItem.id !== item.id) {
                    CYOA.currentSave.inventory.push(oldItem);
                }
            }
            CYOA.currentSave.equipment[slot] = item;
        });
        
        const itemIndexInInventory = CYOA.currentSave.inventory.findIndex(i => i.id === item.id);
        if (itemIndexInInventory !== -1) {
            CYOA.currentSave.inventory.splice(itemIndexInInventory, 1);
        }
        
        if (equipDef.statModifiers) {
            const modifiers = parseStatModifiers(equipDef.statModifiers);
            applyStatModifiers(modifiers, true);
        }
        
        if (CYOA.DataManager) {
            CYOA.DataManager.saveSaves();
        }
        CYOA.resolveCompoundPosture();
        CYOA.renderInventoryPanel();
    };

    CYOA.unequipItem = function(slot) {
        if (!CYOA.currentSave || !CYOA.currentSave.equipment[slot]) return;
        const item = CYOA.currentSave.equipment[slot];
        const equipDef = CYOA.currentGame?.equipment?.find(e => e.id === item.id);
        const lockLevel = getEquipLockLevel(item, equipDef);

        if (lockLevel >= 5) {
            alert(t('ui.msg.permLocked'));
            return;
        }

        if (lockLevel >= 2) {
            const unlockId = item.unlockItemId || equipDef?.unlockItemId;
            if (unlockId) {
                const hasKey = CYOA.currentSave.inventory.some(i => i.id === unlockId);
                if (!hasKey) {
                    alert(t('ui.msg.lockLevelHigh', {level: lockLevel}));
                    return;
                }
            } else {
                alert(t('ui.msg.lockLevelHigh', {level: lockLevel}));
                return;
            }
        }

        if (lockLevel === 1) {
            const result = attemptStruggle(slot);
            if (result && !result.success && !result.broken) {
                alert(t('ui.msg.bruteForceFail') + result.narrative);
                persistSave();
                CYOA.renderInventoryPanel();
                return;
            }
            if (result && (result.success || result.broken)) {
                if (equipDef && equipDef.statModifiers) {
                    const modifiers = parseStatModifiers(equipDef.statModifiers);
                    applyStatModifiers(modifiers, false);
                }
                if (!result.broken) {
                    const isAlreadyInInventory = CYOA.currentSave.inventory.some(i => i.id === item.id);
                    if (!isAlreadyInInventory) CYOA.currentSave.inventory.push(item);
                }
                persistSave();
                CYOA.renderInventoryPanel();
                CYOA.renderAttributesPanel?.();
                return;
            }
        }

        const depCheck = checkSlotDependency(slot);
        if (!depCheck.canStruggle && !(CONFIG.TOOL_BYPASS_SLOTS || []).includes(slot)) {
            alert(t('ui.msg.handsBlockEquip'));
            return;
        }

        const slotsToUnequip = [];
        Object.entries(CYOA.currentSave.equipment).forEach(([s, it]) => {
            if (it && it.id === item.id) slotsToUnequip.push(s);
        });

        if (equipDef && equipDef.statModifiers) {
            const modifiers = parseStatModifiers(equipDef.statModifiers);
            applyStatModifiers(modifiers, false);
        }

        // 卸装前：收集该装备携带的约束类型（用于戒断检测）
        const removedConstraints = new Set();
        const cList = item.constraints || equipDef?.constraints;
        if (Array.isArray(cList)) cList.forEach(c => removedConstraints.add(c));

        slotsToUnequip.forEach(s => { delete CYOA.currentSave.equipment[s]; });

        const isAlreadyInInventory = CYOA.currentSave.inventory.some(i => i.id === item.id);
        if (!isAlreadyInInventory) {
            CYOA.currentSave.inventory.push(item);
        }

        // 触发戒断效应
        removedConstraints.forEach(c => {
            CYOA.triggerWithdrawal(c);
        });

        CYOA.resolveCompoundPosture();
        persistSave();
        CYOA.renderInventoryPanel();
    };

    CYOA.useConsumable = function(itemIndex) {
        if (!CYOA.currentSave) return;
        if (getActiveConstraints().has('no_hands')) {
            alert(t('ui.msg.handsRestricted'));
            return;
        }
        const item = CYOA.currentSave.inventory[itemIndex];
        if (!item) return;
        
        if (item.itemType !== 'consumable' && item.itemType !== 'fuel' && item.itemType !== 'healing') {
            alert(t('ui.msg.cannotUse'));
            return;
        }
        
        if (item.statModifiers) {
            const modifiers = parseStatModifiers(item.statModifiers);
            applyStatModifiers(modifiers, true);
        }
        
        // 优先扣减 quantity（叠放数量），其次扣 durability（耐久），最后直接移除
        const maxQty = CONFIG.ITEM_MAX_QUANTITY || 99;
        if (typeof item.quantity === 'number' && item.quantity > 1) {
            item.quantity = Math.min(maxQty, item.quantity - 1);
        } else if (item.durability !== undefined && item.durability > 1) {
            item.durability -= 1;
        } else {
            CYOA.currentSave.inventory.splice(itemIndex, 1);
        }
        
        CYOA.appendSystemMessage(t('ui.msg.usedItem', {name: item.name, effect: item.statModifiers || '无'}));
        
        if (CYOA.DataManager) {
            CYOA.DataManager.saveSaves();
        }
        CYOA.renderInventoryPanel();
    };

    // ========== 存档管理 ==========
    CYOA.renameSave = function() {
        const newName = CYOA.$('saveNameInput')?.value.trim();
        if (newName && CYOA.currentSave) { 
            CYOA.currentSave.name = newName; 
            if (CYOA.DataManager) {
                CYOA.DataManager.saveSaves();
            }
            alert(t('ui.msg.renamed')); 
        }
    };

    CYOA.saveCurrentSave = function() { 
        if (CYOA.currentSave) { 
            CYOA.currentSave.updatedAt = Date.now(); 
            if (CYOA.DataManager) {
                CYOA.DataManager.saveSaves();
            }
            alert(t('ui.msg.saved')); 
        } 
    };

    CYOA.saveAsNewSave = function() {
        if (!CYOA.currentSave) return;
        const newId = 'save_' + Date.now();
        const newSave = JSON.parse(JSON.stringify(CYOA.currentSave));
        newSave.id = newId;
        newSave.name = CYOA.currentSave.name + ' ' + t('ui.game.copy');
        newSave.createdAt = Date.now();
        newSave.updatedAt = Date.now();
        CYOA.saves[newId] = newSave;
        CYOA.currentSave = newSave;
        if (CYOA.DataManager) {
            CYOA.DataManager.saves = CYOA.saves;
            CYOA.DataManager.saveSaves();
        }
        alert(t('ui.msg.savedAsNew'));
        CYOA.renderSavesPanel();
    };

    CYOA.exportSave = function() {
        if (!CYOA.currentSave) return;
        const blob = new Blob([JSON.stringify(CYOA.currentSave, null, 2)], {type: 'application/json'});
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `cyoa_save_${CYOA.currentSave.id}.json`;
        a.click();
    };

    CYOA.importSave = function() {
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
                    CYOA.saves[save.id] = save;
                    if (CYOA.DataManager) {
                        CYOA.DataManager.saves = CYOA.saves;
                        CYOA.DataManager.saveSaves();
                    }
                    alert(t('ui.msg.importSaveSuccess'));
                } catch (ex) { 
                    alert(t('ui.msg.saveImportFailed')); 
                }
            };
            reader.readAsText(file);
        };
        input.click();
    };

    CYOA.loadSave = function(saveId) {
        if (!CYOA.saves || !CYOA.saves[saveId]) return;
        
        const save = CYOA.saves[saveId];
        if (save.gameId !== CYOA.currentGame?.id) {
            alert(t('ui.msg.saveMismatch'));
            return;
        }
        
        CYOA.currentSave = save;
        CYOA.currentNodeId = save.currentNodeId;
        
        // 旧存档兼容：补充 playerCharacterId 和 acquiredItemIds
        if (!save.playerCharacterId && save.playerCharacter && CYOA.currentGame) {
            const pc = CYOA.currentGame.characters?.find(c => c.name === save.playerCharacter);
            save.playerCharacterId = pc?.id || '';
        }
        if (!save.acquiredItemIds) {
            save.acquiredItemIds = (save.inventory || []).map(i => i.id);
        }

        // 向后兼容：locked boolean -> lockLevel number
        if (save.equipment) {
            Object.values(save.equipment).forEach(item => {
                if (item && typeof item.locked === 'boolean') {
                    item.lockLevel = item.locked ? 3 : 0;
                    delete item.locked;
                }
                if (item && item.indestructible === undefined) {
                    item.indestructible = false;
                }
            });
        }
        // 游戏定义中的装备也做迁移
        if (CYOA.currentGame?.equipment) {
            CYOA.currentGame.equipment.forEach(eq => {
                if (typeof eq.locked === 'boolean') {
                    eq.lockLevel = eq.locked ? 3 : 0;
                    delete eq.locked;
                }
            });
        }
        
        // 刷新显示
        CYOA.renderSidebar();
        
        // 刷新聊天记录
        const logEl = document.getElementById('log');
        if (logEl) {
            logEl.innerHTML = '';
            const node = save.nodes[save.currentNodeId];
            if (node) {
                const path = [];
                let nId = save.currentNodeId;
                while (nId && save.nodes[nId]) {
                    path.unshift(nId);
                    nId = save.nodes[nId].parentId;
                }
                
                path.forEach(id => {
                    const n = save.nodes[id];
                    if (n.userMessage) {
                        const userDiv = document.createElement('div');
                        userDiv.className = 'user';
                        userDiv.textContent = n.userMessage;
                        logEl.appendChild(userDiv);
                    }
                    const aiDiv = document.createElement('div');
                    aiDiv.className = 'ai';
                    aiDiv.textContent = n.assistantMessage;
                    logEl.appendChild(aiDiv);
                });
            }
        }
        
        CYOA._gamePhase = 'playing';
        CYOA._bindInputKeyHandler();
        alert(t('ui.msg.saveLoaded'));
    };

    CYOA.deleteSave = function(saveId) {
        if (!CYOA.saves || !CYOA.saves[saveId]) return;
        
        if (!confirm(t('ui.msg.confirmDeleteSave'))) return;
        
        delete CYOA.saves[saveId];
        
        if (CYOA.DataManager) {
            CYOA.DataManager.saves = CYOA.saves;
            CYOA.DataManager.saveSaves();
        }
        
        if (saveId === CYOA.currentSave?.id) {
            const remaining = Object.values(CYOA.saves).find(s => s.gameId === CYOA.currentGame?.id);
            if (remaining) {
                CYOA.loadSave(remaining.id);
            } else {
                if (CYOA.currentGame) {
                    CYOA.startGame(CYOA.currentGame.id, CYOA.currentSave?.playerCharacter);
                }
            }
        } else {
            CYOA.renderSavesPanel();
        }
    };

    log('CYOA 游戏模块加载完成');
})();