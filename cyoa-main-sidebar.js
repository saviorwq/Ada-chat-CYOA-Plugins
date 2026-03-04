/**
 * CYOA main sidebar shell module
 * Extracted from cyoa-main.js for incremental split.
 */
(function() {
    const CYOA = window.CYOA;
    if (!CYOA || !CYOA.CONFIG) return;
    const t = CYOA.t || ((k) => k);

    // ========== 渲染侧边栏 ==========
    CYOA.renderSidebar = function() {
        if (!CYOA.currentGame || !CYOA.currentSave) return;

        const oldSidebar = document.getElementById('cyoa-sidebar-container');
        if (oldSidebar) oldSidebar.remove();

        const sidebarContainer = document.createElement('div');
        sidebarContainer.id = 'cyoa-sidebar-container';
        sidebarContainer.style.width = '320px';
        sidebarContainer.style.background = 'var(--bg-light)';
        sidebarContainer.style.borderLeft = '1px solid var(--border)';
        sidebarContainer.style.height = '100%';
        sidebarContainer.style.overflow = 'hidden';
        sidebarContainer.style.flexShrink = '0';

        // 纵向可折叠列表：各分区为独立折叠块
        if (!CYOA._sidebarAccordion) CYOA._sidebarAccordion = { tree: true, attributes: false, status: true, inventory: false, map: false, llmdebug: false, skills: false, quests: false, chapters: false, saves: false };
        const acc = CYOA._sidebarAccordion;
        const sections = [
            { tab: 'tree', label: t('ui.panel.storyTree'), defaultOpen: acc.tree },
            { tab: 'attributes', label: t('ui.panel.attributes'), defaultOpen: acc.attributes },
            { tab: 'status', label: '🩺 状态', defaultOpen: acc.status },
            { tab: 'inventory', label: t('ui.panel.inventory'), defaultOpen: acc.inventory },
            { tab: 'map', label: '🗺️ 地图', defaultOpen: acc.map },
            { tab: 'llmdebug', label: '🧪 AI实时调试', defaultOpen: acc.llmdebug },
            { tab: 'skills', label: t('ui.panel.skills'), defaultOpen: acc.skills },
            { tab: 'quests', label: t('ui.panel.quests'), defaultOpen: acc.quests },
            { tab: 'chapters', label: t('ui.panel.chapters'), defaultOpen: acc.chapters },
            { tab: 'saves', label: t('ui.panel.saves'), defaultOpen: acc.saves }
        ];
        let accordionHtml = '<div class="cyoa-sidebar" style="display:flex; flex-direction:column; height:100%; overflow:hidden;"><div class="cyoa-sidebar-accordion" style="flex:1; overflow-y:auto; padding:8px;">';
        sections.forEach(s => {
            const open = acc[s.tab];
            const chevron = open ? '▼' : '▶';
            accordionHtml += `
                <div class="cyoa-accordion-section" data-tab="${s.tab}" style="margin-bottom:4px;">
                    <div class="cyoa-accordion-header" data-tab="${s.tab}" style="display:flex; align-items:center; justify-content:space-between; padding:10px 12px; background:var(--bg); border:1px solid var(--border); border-radius:var(--radius-md); cursor:pointer; font-size:13px; font-weight:600; user-select:none;">
                        <span>${s.label}</span>
                        <span class="cyoa-accordion-chevron" style="font-size:11px; color:var(--text-light);">${chevron}</span>
                    </div>
                    <div class="cyoa-accordion-body" id="cyoa${s.tab.charAt(0).toUpperCase() + s.tab.slice(1)}Panel" style="display:${open ? 'block' : 'none'}; padding:10px 12px; background:var(--bg-light); border:1px solid var(--border); border-top:none; border-radius:0 0 var(--radius-md) var(--radius-md); max-height:280px; overflow-y:auto;"></div>
                </div>`;
        });
        accordionHtml += '</div></div>';
        sidebarContainer.innerHTML = accordionHtml;

        const appElement = document.querySelector('.app');
        if (appElement) {
            appElement.style.display = 'flex';
            appElement.style.flexDirection = 'row';

            const mainElement = document.querySelector('.main');
            if (mainElement) {
                mainElement.style.flex = '1';
                mainElement.style.display = 'flex';
                mainElement.style.flexDirection = 'column';
                appElement.appendChild(sidebarContainer);
            } else {
                appElement.appendChild(sidebarContainer);
            }
        } else {
            document.body.appendChild(sidebarContainer);
        }

        CYOA.renderTreePanel?.();
        CYOA.renderAttributesPanel?.();
        CYOA.renderStatusPanel?.();
        CYOA.renderInventoryPanel?.();
        CYOA.renderMapPanel?.();
        CYOA.renderLlmDebugPanel?.();
        CYOA.renderSkillsPanel?.();
        CYOA.renderQuestsPanel?.();
        CYOA.renderChaptersPanel?.();
        CYOA.renderSavesPanel?.();

        sidebarContainer.querySelectorAll('.cyoa-accordion-header').forEach(header => {
            header.addEventListener('click', (e) => {
                const tab = e.currentTarget.dataset.tab;
                if ((tab === 'inventory') && CYOA.currentSave && CYOA.getActiveConstraints?.()?.has('no_hands')) {
                    alert(t('ui.msg.handsRestricted'));
                    return;
                }
                const section = header.closest('.cyoa-accordion-section');
                const body = section?.querySelector('.cyoa-accordion-body');
                const chevron = header?.querySelector('.cyoa-accordion-chevron');
                const isOpen = body?.style.display !== 'none';
                CYOA._sidebarAccordion[tab] = !isOpen;
                if (body) body.style.display = isOpen ? 'none' : 'block';
                if (chevron) chevron.textContent = isOpen ? '▶' : '▼';
            });
        });
    };
})();
