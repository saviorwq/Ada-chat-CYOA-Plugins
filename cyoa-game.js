/**
 * CYOA game compatibility layer.
 * Keeps legacy global APIs stable while delegating implementations
 * to split modules: GameRuntime / GameUI / GameSystems.
 */
(function() {
    const CYOA = window.CYOA;
    if (!CYOA) return;

    const log = CYOA.log || function() {};

    function bindIfFunction(target, name, fn) {
        if (target && typeof fn === "function") {
            target[name] = fn;
                return true;
        }
                return false;
        }

    function bindRuntimeAPIs() {
        const rt = CYOA.GameRuntime;
        if (!rt) return;

        bindIfFunction(CYOA, "startGame", rt.startGame);
        bindIfFunction(CYOA, "exitGame", rt.exitGame);
        bindIfFunction(CYOA, "beginGame", rt.beginGame);
        bindIfFunction(CYOA, "_renderWelcomeScreen", rt.renderWelcomeScreen);
        bindIfFunction(CYOA, "_selectWelcomeChar", rt.selectWelcomeChar);
        bindIfFunction(CYOA, "_loadSaveFromWelcome", rt.loadSaveFromWelcome);
        bindIfFunction(CYOA, "_importSaveFromWelcome", rt.importSaveFromWelcome);

        bindIfFunction(CYOA, "onRoleChange", rt.onRoleChange);
        bindIfFunction(CYOA, "saveCurrentSave", rt.saveCurrentSave);
        bindIfFunction(CYOA, "saveAsNewSave", rt.saveAsNewSave);
        bindIfFunction(CYOA, "exportSave", rt.exportSave);
        bindIfFunction(CYOA, "importSave", rt.importSave);
        bindIfFunction(CYOA, "loadSave", rt.loadSave);
        bindIfFunction(CYOA, "deleteSave", rt.deleteSave);
        bindIfFunction(CYOA, "jumpToNode", rt.jumpToNode);
    }

    function bindUIAPIs() {
        const ui = CYOA.GameUI;
        if (!ui) return;

        bindIfFunction(CYOA, "sendGameMessage", ui.sendGameMessage);
        bindIfFunction(CYOA, "renderGameControls", ui.renderGameControls);
        bindIfFunction(CYOA, "_bindInputKeyHandler", ui.bindInputKeyHandler);
        bindIfFunction(CYOA, "renderGameOptions", ui.renderGameOptions);
        bindIfFunction(CYOA, "refreshOptionsFromCurrentNode", ui.refreshOptionsFromCurrentNode);
        bindIfFunction(CYOA, "renderGameLogFromNode", ui.renderGameLogFromNode);
        bindIfFunction(CYOA, "selectGameOption", ui.selectGameOption);
        bindIfFunction(CYOA, "extractOptions", ui.extractOptions);
        // Runtime jump is preferred; UI jump already falls back to runtime.
        if (typeof CYOA.jumpToNode !== "function") {
            bindIfFunction(CYOA, "jumpToNode", ui.jumpToNode);
        }
    }

    function bindSystemAPIs() {
        const sys = CYOA.GameSystems;
        if (!sys) return;

        bindIfFunction(CYOA, "getActiveConstraints", sys.getActiveConstraints);
        bindIfFunction(CYOA, "getLimitedStepParams", sys.getLimitedStepParams);
        bindIfFunction(CYOA, "getActiveVisionType", sys.getActiveVisionType);
        bindIfFunction(CYOA, "getObserverAlert", sys.getObserverAlert);
        bindIfFunction(CYOA, "getObserverAlertLevel", sys.getObserverAlertLevel);
        bindIfFunction(CYOA, "isChapterMonitored", sys.isChapterMonitored);
        bindIfFunction(CYOA, "applySensoryFilters", sys.applySensoryFilters);

        bindIfFunction(CYOA, "parseAndApplyItemChanges", sys.parseAndApplyItemChanges);
        bindIfFunction(CYOA, "acquireItem", sys.acquireItem);
        bindIfFunction(CYOA, "removeItem", sys.removeItem);
        bindIfFunction(CYOA, "appendSystemMessage", sys.appendSystemMessage);
        bindIfFunction(CYOA, "applyPassiveSystems", sys.applyPassiveSystems);
    }

    bindRuntimeAPIs();
    bindUIAPIs();
    bindSystemAPIs();

    CYOA.GameCompat = CYOA.GameCompat || {};
    CYOA.GameCompat.__moduleName = "compat";
    CYOA.GameCompat.__ready = true;

    log("CYOA 游戏兼容层加载完成");
})();
