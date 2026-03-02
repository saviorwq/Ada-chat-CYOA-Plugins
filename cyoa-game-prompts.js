/**
 * CYOA Game Prompt Module
 * 将游戏模式 AI 提示词独立维护，避免堆在 UI 文件中。
 */
(function() {
    const CYOA = window.CYOA;
    if (!CYOA || !CYOA.CONFIG) return;

    CYOA.GamePrompts = CYOA.GamePrompts || {};
    CYOA.GamePrompts.__moduleName = "prompts";
    CYOA.GamePrompts.__ready = true;

    const ZH_GUARD_LINES = [
        "你必须严格遵守给定的游戏大纲与设定，不得擅自新增世界观、关键人物关系或主线目标。",
        "世界观/背景/故事简介/人物设定均以当前提供文本为唯一依据；未写明即未知，禁止补设定。",
        "人物一致性规则：每个在场人物的语言风格、行为动机、目标、能力、装备与道具都必须符合其人物档案；不得 OOC（性格偏离）与越权行为。",
        "世界叙事一致性：环境与世界描述同样必须受在场人物档案约束，不得描述其无法触发/无法感知/不可能完成的事件、线索与互动结果。",
        "叙事必须与当前章节/地点/状态一致，禁止跳时间线和无依据扩写。",
        "状态锚点规则：必须以“当前章节、当前地点、当前角色状态（姿态/装备/限制）”为唯一叙事坐标；未提供的信息不得脑补为既成事实。",
        "硬边界规则：地图、地点、设施、在场人物、装备、状态、限制、技能、任务、属性均以当前上下文清单为准；清单外内容一律视为未知，不得写成既成事实。",
        "禁止越界：不得切换到其他章节/地点，不得凭空新增未在场人物、设施或剧情设定。",
        "篇幅规则：正文保持短回合叙事，建议 300-700 字，硬上限不超过 900 字（不含4个选项与可选的 cyoa_changes 代码块）。",
        "格式规则：禁止输出任何开场白/元说明（如“好的，请锁定注意力…”“以下是…”），直接进入剧情正文。",
        "若玩家输入与大纲冲突，优先给出受限反馈与可行动选项，而不是改写设定。",
        "限制来源规则：仅使用装备显式字段（constraints / gagType / earDeviceType / fingerRestraintType / attachments）判断限制，禁止隐式推断。",
        "材质描写规则：优先调用已配置的材质模板与“约束+材质”叙事，不要凭空编造材质体感。",
        "装备叙事分流：限制类装备重点写行动受限；盔甲/防护类装备重点写硬度、防护覆盖、重量与机动折衷，不强行写束缚限制。",
        "约束规则：口塞/强制张口会阻止角色说话与使用唇语表达，但不阻止角色读唇；读唇能力只受眼部约束（目盲/视野受限）影响。",
        "约束规则：no_hands 时禁止任何依赖双手的交互；no_fingers 时禁止手指精细操作（按键、拧旋钮、刮擦、刻写、开锁等）。如被限制，请改写为可执行替代动作。",
        "每次回复末尾必须严格给出4个选项，且格式固定为四行：",
        "（行动）xxx",
        "（行动）xxx",
        "（对话）xxx",
        "（对话）xxx",
        "如需变更状态，请在正文后附一个代码块（仅在需要时输出）并严格使用 JSON：",
        "```cyoa_changes",
        "{",
        "  \"addItems\": [{\"id\":\"item_id_or_name\",\"quantity\":1}],",
        "  \"removeItems\": [{\"id\":\"item_id_or_name\",\"quantity\":1}],",
        "  \"setLocation\": \"location_id_or_name\",",
        "  \"changeChapter\": \"chapter_id_or_title\",",
        "  \"setAttributes\": {\"obedience\": 80},",
        "  \"deltaAttributes\": {\"sanity\": -5},",
        "  \"setPosture\": \"standing|kneel|prone|...\",",
        "  \"travelTo\": \"location_id_or_name\",",
        "  \"travelToRegion\": \"region_id_or_name\",",
        "  \"setObserverAlert\": 45,",
        "  \"deltaObserverAlert\": 10,",
        "  \"completeQuests\": [\"quest_id\"],",
        "  \"activateQuests\": [\"quest_id\"],",
        "  \"learnSkills\": [\"skill_id\"],",
        "  \"gainSkillProficiency\": [{\"skillId\":\"skill_id\",\"amount\":12}],",
        "  \"applyOutfitPreset\": \"preset_id_or_name\",",
        "  \"jumpToNode\": \"node_id\"",
        "}",
        "```"
    ];

    const EN_GUARD_LINES = [
        "You must strictly follow the game outline and setting. Do not invent core worldbuilding, key relations, or main objectives.",
        "World/background/story synopsis/character canon are limited to provided text only; if unspecified, treat as unknown and do not invent.",
        "Character consistency rule: each present character's voice, motive, goals, capabilities, equipment, and items must match their profile; no OOC behavior or unauthorized actions.",
        "World narration consistency: environment/world descriptions are also constrained by present character profiles; do not narrate events, clues, or interaction outcomes that they cannot trigger, perceive, or plausibly perform.",
        "Narration must match current chapter/location/state. No unexplained time jumps.",
        "State-anchor rule: use current chapter, location, and character state (posture/equipment/constraints) as the only narrative coordinates; do not fabricate missing facts as established.",
        "Hard-boundary rule: map/location/facilities/present characters/equipment/state/constraints/skills/quests/attributes must stay within the provided context list; anything outside is unknown and cannot be asserted as fact.",
        "No out-of-scope jumps: do not switch to other chapters/locations or introduce unseen characters/facilities/lore.",
        "Length rule: keep narration short-turn style, target 300-700 Chinese characters and hard cap at 900 (excluding the 4 options and optional cyoa_changes block).",
        "Format rule: no preamble/meta lines (e.g., 'Okay, here is...'); start directly with in-world narration.",
        "If player input conflicts with canon, provide constrained feedback and valid options instead of rewriting canon.",
        "Constraint-source rule: only use explicit equipment fields (constraints / gagType / earDeviceType / fingerRestraintType / attachments). Do not infer implicitly.",
        "Material narration rule: prioritize configured material templates and constraint+material narratives; do not invent unsupported sensory details.",
        "Equipment narrative split: for restraint gear, focus on action constraints; for armor/protection gear, focus on hardness, coverage, weight, and mobility tradeoffs instead of forced restraint-style limits.",
        "Constraint rule: gag/forced-open-mouth blocks speaking and lip-speaking expression, but does NOT block lip-reading; lip-reading is blocked only by eye constraints (blind/vision-restricted).",
        "Constraint rule: no_hands blocks all hand-dependent interactions; no_fingers blocks fine finger manipulation (button press, knob twist, scratch/write, lockpicking, etc). Rewrite into executable alternatives when constrained.",
        "At the end of each reply, output exactly 4 options in this format:",
        "(Action) xxx",
        "(Action) xxx",
        "(Dialogue) xxx",
        "(Dialogue) xxx",
        "If state changes are needed, append a JSON code block (only when needed):",
        "```cyoa_changes",
        "{",
        "  \"addItems\": [{\"id\":\"item_id_or_name\",\"quantity\":1}],",
        "  \"removeItems\": [{\"id\":\"item_id_or_name\",\"quantity\":1}],",
        "  \"setLocation\": \"location_id_or_name\",",
        "  \"changeChapter\": \"chapter_id_or_title\",",
        "  \"setAttributes\": {\"obedience\": 80},",
        "  \"deltaAttributes\": {\"sanity\": -5},",
        "  \"setPosture\": \"standing|kneel|prone|...\",",
        "  \"travelTo\": \"location_id_or_name\",",
        "  \"travelToRegion\": \"region_id_or_name\",",
        "  \"setObserverAlert\": 45,",
        "  \"deltaObserverAlert\": 10,",
        "  \"completeQuests\": [\"quest_id\"],",
        "  \"activateQuests\": [\"quest_id\"],",
        "  \"learnSkills\": [\"skill_id\"],",
        "  \"gainSkillProficiency\": [{\"skillId\":\"skill_id\",\"amount\":12}],",
        "  \"applyOutfitPreset\": \"preset_id_or_name\",",
        "  \"jumpToNode\": \"node_id\"",
        "}",
        "```"
    ];

    const ZH_CONSTRAINT_RULES = {
        blind: "blind：无法进行视觉观察、远距离辨认与读唇，请改为触觉/方位试探。",
        vision_restricted: "vision_restricted：只能做有限视觉判断，避免高精度视觉动作（细节辨认/读唇）。",
        mute: "mute：禁止说话与发声表达，请改为手势、姿态、目光或行动反馈。",
        deaf: "deaf：无法依赖听觉线索（脚步声、呼喊、机械声），请改用视觉/振动/触觉线索。",
        limited_step: "limited_step：禁止奔跑、冲刺、跳跃、大幅跨步；动作应为小步、挪动或扶物移动。",
        no_hands: "no_hands：禁止任何依赖双手的交互（抓握/开锁/擦拭/操作机关）。",
        chastity: "chastity：涉及生殖器接触、刺激、解锁的动作应受限并改写。",
        tethered: "tethered：活动范围受牵引限制，禁止远距离脱离或高速位移。",
        forced_open_mouth: "forced_open_mouth：无法闭口与清晰发声，禁止唇语表达，可出现流涎与呼吸受扰。",
        no_fingers: "no_fingers：禁止精细手指操作（按键、旋钮、刻写、撬锁、刮擦）。",
        breath_restrict: "breath_restrict：避免高耗氧动作和长句喊叫，节奏应短促保守。"
    };

    const EN_CONSTRAINT_RULES = {
        blind: "blind: no visual observation, distant recognition, or lip-reading; switch to tactile/spatial probing.",
        vision_restricted: "vision_restricted: only limited visual judgment; avoid high-precision visual tasks (fine details/lip-reading).",
        mute: "mute: no speaking or vocal expression; use gesture, posture, gaze, or action feedback instead.",
        deaf: "deaf: cannot rely on auditory cues (footsteps, shouts, machine sounds); use visual/vibration/tactile cues.",
        limited_step: "limited_step: no running/sprinting/jumping/large strides; use short-step or braced movement.",
        no_hands: "no_hands: block all hand-dependent interactions (grip/unlock/wipe/mechanism handling).",
        chastity: "chastity: actions involving genital contact/stimulation/unlocking should be constrained and rewritten.",
        tethered: "tethered: movement range is tether-limited; no long-distance disengage or high-speed displacement.",
        forced_open_mouth: "forced_open_mouth: cannot close mouth or speak clearly; block lip-speaking expression.",
        no_fingers: "no_fingers: block fine finger manipulation (buttons/knobs/scratching/writing/lockpicking).",
        breath_restrict: "breath_restrict: avoid oxygen-intensive actions and long shouting; keep pacing conservative."
    };

    function normalizeConstraintList(activeConstraints) {
        if (activeConstraints instanceof Set) return Array.from(activeConstraints);
        if (Array.isArray(activeConstraints)) return activeConstraints.map(String);
        return [];
    }

    function normalizeMaterialKey(raw) {
        const s = String(raw || "").trim().toLowerCase();
        if (!s) return "";
        const map = CYOA.CONFIG?.MATERIAL_ALIASES || {};
        return String(map[s] || s);
    }

    function isArmorLikeEquip(eq) {
        const role = String(eq?.narrativeRole || "").trim().toLowerCase();
        if (role === "armor") return true;
        if (role === "restraint") return false;
        const name = String(eq?.name || "").toLowerCase();
        const equipType = String(eq?.equipType || "").toLowerCase();
        const category = String(eq?.category || "").toLowerCase();
        const armorKw = /(armor|armour|plate|mail|helmet|gauntlet|greaves|shield|盔甲|护甲|甲胄|板甲|锁子甲|头盔|护手|护胫|护盾|防弹|防护)/i;
        return armorKw.test(name) || armorKw.test(equipType) || armorKw.test(category);
    }

    function isRestraintLikeEquip(eq) {
        const role = String(eq?.narrativeRole || "").trim().toLowerCase();
        if (role === "restraint") return true;
        if (role === "armor") return false;
        const constraints = eq?.constraints || new Set();
        const attTypes = eq?.attachmentTypes || new Set();
        if (constraints.size > 0) return true;
        if (attTypes.has("gag") || attTypes.has("oral_sheath") || attTypes.has("finger_restraint") || attTypes.has("constraint_modifier")) return true;
        const name = String(eq?.name || "").toLowerCase();
        const equipType = String(eq?.equipType || "").toLowerCase();
        const category = String(eq?.category || "").toLowerCase();
        const restraintKw = /(bondage|restraint|gag|corset|hobble|armbinder|mummy|束缚|拘束|口塞|锁具|捆绑|拘束衣|单手套|束腰)/i;
        return restraintKw.test(name) || restraintKw.test(equipType) || restraintKw.test(category);
    }

    function getUniqueEquippedItems(game, save) {
        const eqObj = save?.equipment;
        if (!eqObj || typeof eqObj !== "object") return [];
        const defMap = new Map((game?.equipment || []).map((e) => [e.id, e]));
        const byId = new Map();

        Object.entries(eqObj).forEach(([slotKey, raw]) => {
            if (!raw) return;
            const eqId = raw?.id || raw?.equipId || raw?.itemId;
            if (!eqId) return;
            const def = defMap.get(eqId) || {};
            const name = String(raw?.name || def?.name || eqId);
            const slots = new Set();
            const constraints = new Set();
            const postureTags = new Set();
            const attachmentTypes = new Set();
            const attachmentDetails = [];

            const sourceSlots = Array.isArray(raw?.slots) ? raw.slots : (Array.isArray(def?.slots) ? def.slots : []);
            sourceSlots.forEach((s) => slots.add(String(s)));
            if (slotKey) slots.add(String(slotKey));

            const sourceConstraints = Array.isArray(raw?.constraints) ? raw.constraints : (Array.isArray(def?.constraints) ? def.constraints : []);
            sourceConstraints.forEach((c) => constraints.add(String(c)));
            const sourcePostureTags = Array.isArray(raw?.postureTags) ? raw.postureTags : (Array.isArray(def?.postureTags) ? def.postureTags : []);
            sourcePostureTags.forEach((t) => postureTags.add(String(t)));

            const sourceAttachments = Array.isArray(raw?.attachments) ? raw.attachments : (Array.isArray(def?.attachments) ? def.attachments : []);
            sourceAttachments.forEach((att) => {
                const type = String(att?.type || "").trim();
                if (!type) return;
                attachmentTypes.add(type);
                attachmentDetails.push(att);
            });

            const old = byId.get(eqId);
            if (old) {
                slots.forEach((s) => old.slots.add(s));
                constraints.forEach((c) => old.constraints.add(c));
                postureTags.forEach((t) => old.postureTags.add(t));
                attachmentTypes.forEach((t) => old.attachmentTypes.add(t));
                attachmentDetails.forEach((a) => old.attachmentDetails.push(a));
                return;
            }
            byId.set(eqId, {
                id: eqId,
                name,
                slots,
                constraints,
                postureTags,
                attachmentTypes,
                attachmentDetails,
                layer: Number(raw?.layer ?? def?.layer ?? 5),
                lockLevel: Number(raw?.lockLevel ?? def?.lockLevel ?? (raw?.locked ? 3 : 0)),
                material: String(raw?.material || def?.material || "").trim(),
                equipType: String(raw?.equipType || def?.equipType || "").trim(),
                category: String(raw?.category || def?.category || "").trim(),
                narrativeRole: String(raw?.narrativeRole || def?.narrativeRole || "auto").trim(),
                armorHardness: Number(raw?.armorHardness ?? def?.armorHardness ?? 0),
                armorProtection: Number(raw?.armorProtection ?? def?.armorProtection ?? 0),
                armorWeight: Number(raw?.armorWeight ?? def?.armorWeight ?? 0),
                armorMobilityPenalty: Number(raw?.armorMobilityPenalty ?? def?.armorMobilityPenalty ?? 0),
                slotGroup: String(raw?.slotGroup || def?.slotGroup || "").trim(),
                timerEnabled: !!(raw?.timerEnabled ?? def?.timerEnabled),
                isIntegrated: !!(raw?.isIntegrated ?? def?.isIntegrated),
                comfortType: !!(raw?.comfortType ?? def?.comfortType),
                unlockCountdown: Number(raw?.unlockCountdown ?? def?.unlockCountdown ?? 0),
                unlockCountdownUnit: String(raw?.unlockCountdownUnit || def?.unlockCountdownUnit || ""),
                lockCountdownTurns: Number(raw?.lockCountdownTurns ?? def?.lockCountdownTurns ?? 0),
                escalationPeakTurns: Number(raw?.escalationPeakTurns ?? def?.escalationPeakTurns ?? 0),
                indestructible: !!(raw?.indestructible ?? def?.indestructible),
                unlockItemId: String(raw?.unlockItemId || def?.unlockItemId || ""),
                item: raw,
                def
            });
        });

        return Array.from(byId.values());
    }

    function scoreEquipForAction(eq, actionText) {
        const s = String(actionText || "").toLowerCase();
        const name = String(eq?.name || "").toLowerCase();
        const slots = eq?.slots || new Set();
        const constraints = eq?.constraints || new Set();
        const tags = eq?.postureTags || new Set();
        const attTypes = eq?.attachmentTypes || new Set();
        let score = 0;

        if (constraints.size) score += 1;

        const isMoveIntent = /走|移动|前进|奔跑|冲刺|跳|walk|move|run|sprint|jump|step/.test(s);
        const isSpeakIntent = /说|对话|喊|唇语|speak|talk|say|yell|lip/.test(s);
        const isHandIntent = /手|抓|握|拧|开锁|write|grip|unlock|finger|hand/.test(s);
        const isObserveIntent = /看|观察|读唇|look|observe|scan|lipread/.test(s);

        if (isMoveIntent) {
            if (constraints.has("limited_step") || constraints.has("tethered")) score += 8;
            if (constraints.has("breath_restrict")) score += 3;
            if (tags.has("restricts_stride") || tags.has("restricts_knee_bend")) score += 8;
            if (tags.has("forces_tiptoe") || tags.has("forces_upright")) score += 5;
            if (attTypes.has("weight")) score += 3;
            if (attTypes.has("latex_layer") || attTypes.has("inflate")) score += 2;
            if (["thigh", "knee", "calf", "ankle", "foot", "hips"].some((k) => slots.has(k))) score += 6;
            if (/高跟|heels|stiletto|蹒跚|hobble/.test(name)) score += 8;
        }
        if (isSpeakIntent) {
            if (constraints.has("mute") || constraints.has("forced_open_mouth")) score += 9;
            if (attTypes.has("oral_sheath")) score += 6;
            if (attTypes.has("vibrator") || attTypes.has("shock")) score += 2;
            if (slots.has("mouth")) score += 4;
        }
        if (isHandIntent) {
            if (constraints.has("no_hands") || constraints.has("no_fingers")) score += 9;
            if (tags.has("restricts_arm_movement") || tags.has("restricts_fingers")) score += 5;
            if (attTypes.has("finger_restraint")) score += 7;
            if (["wrist", "palm", "fingers", "forearm", "elbow"].some((k) => slots.has(k))) score += 4;
        }
        if (isObserveIntent) {
            if (constraints.has("blind") || constraints.has("vision_restricted") || constraints.has("deaf")) score += 6;
            if (attTypes.has("vision_modifier") || attTypes.has("ear_device")) score += 6;
            if (["eyes", "ears", "head"].some((k) => slots.has(k))) score += 3;
        }

        return score;
    }

    function summarizeEquipEffect(eq, isZh) {
        const constraints = eq?.constraints || new Set();
        const tags = eq?.postureTags || new Set();
        const attachmentTypes = eq?.attachmentTypes || new Set();
        const attachmentDetails = Array.isArray(eq?.attachmentDetails) ? eq.attachmentDetails : [];
        const item = eq?.item || {};
        const def = eq?.def || {};
        const out = [];

        const armorLike = isArmorLikeEquip(eq);
        const restraintLike = isRestraintLikeEquip(eq);

        if (armorLike && !restraintLike) {
            const mat = normalizeMaterialKey(eq?.material);
            const hardMap = {
                metal: isZh ? "高硬度，抗冲击强" : "high hardness and strong impact resistance",
                leather: isZh ? "中等硬度，兼顾韧性与贴合" : "medium hardness with balanced toughness and fit",
                fabric: isZh ? "柔性防护，机动性更好" : "flexible protection with better mobility",
                latex: isZh ? "外层致密，贴身包覆性高" : "dense outer layer with close body wrap",
                rope: isZh ? "结构性一般，更多用于固定而非护甲" : "limited structural defense, better for fixation than armor"
            };
            const hardDesc = hardMap[mat] || (isZh ? "具备基础防护能力" : "provides baseline protection");
            out.push(isZh ? `防护特征：${hardDesc}` : `protection profile: ${hardDesc}`);
            const hardVal = Math.max(0, Math.min(100, Number(eq?.armorHardness || 0)));
            const protVal = Math.max(0, Math.min(100, Number(eq?.armorProtection || 0)));
            const wtVal = Math.max(0, Math.min(100, Number(eq?.armorWeight || 0)));
            const mob = Math.max(-100, Math.min(0, Number(eq?.armorMobilityPenalty || 0)));
            if (hardVal || protVal || wtVal || mob) {
                out.push(isZh
                    ? `参数：硬度 ${hardVal}/100，防护 ${protVal}/100，重量负担 ${wtVal}/100，机动修正 ${mob}%`
                    : `params: hardness ${hardVal}/100, protection ${protVal}/100, weight load ${wtVal}/100, mobility ${mob}%`);
            }
            if (["head", "chest", "waist", "hips"].some((k) => (eq?.slots || new Set()).has(k))) {
                out.push(isZh ? "覆盖核心部位，优先承担正面碰撞与刮擦" : "covers core zones, prioritizing frontal impact and abrasion defense");
            }
            out.push(isZh ? "叙事重点放在防护、重量与机动折衷，不按束缚装备处理" : "focus narration on protection/weight/mobility tradeoff, not restraint-style constraints");
        }

        if (constraints.has("limited_step")) {
            const cm = Number(item.stepLimitCm ?? def.stepLimitCm ?? CYOA.CONFIG?.LIMITED_STEP_DEFAULTS?.stepLimitCm ?? 20);
            const pct = Number(item.speedModifierPct ?? def.speedModifierPct ?? CYOA.CONFIG?.LIMITED_STEP_DEFAULTS?.speedModifierPct ?? -50);
            out.push(isZh ? `步距约 ${cm}cm、移动速度修正 ${pct}%` : `step limit ~${cm}cm, speed modifier ${pct}%`);
            out.push(isZh ? "双腿难以分开，只能并拢小步行走" : "legs stay narrow; movement becomes short, constrained steps");
        }
        if (constraints.has("tethered")) out.push(isZh ? "活动范围受牵引限制" : "movement range is tether-limited");
        if (constraints.has("breath_restrict")) out.push(isZh ? "呼吸受限，动作节奏需保守" : "breathing is restricted; pacing must stay conservative");
        if (constraints.has("mute")) out.push(isZh ? "无法正常发声对话" : "cannot speak clearly");
        if (constraints.has("forced_open_mouth")) out.push(isZh ? "口部被迫张开，唇语表达受阻" : "mouth forced open; lip-speaking blocked");
        if (constraints.has("deaf")) out.push(isZh ? "听觉线索不可用" : "auditory cues unavailable");
        if (constraints.has("blind") || constraints.has("vision_restricted")) out.push(isZh ? "视觉信息受限" : "visual information is constrained");
        if (constraints.has("no_hands")) out.push(isZh ? "无法进行双手操作" : "hand-dependent interactions are blocked");
        if (constraints.has("no_fingers")) out.push(isZh ? "无法进行手指精细操作" : "fine finger manipulation is blocked");
        if (constraints.has("chastity")) out.push(isZh ? "下体接触与刺激行为受限" : "genital contact/stimulation is constrained");

        if (!armorLike || restraintLike) {
            if (tags.has("restricts_stride")) out.push(isZh ? "姿态标签限制步幅，移动以碎步/蹒跚为主" : "posture tags constrain stride; movement is mincing/hobbling");
            if (tags.has("restricts_knee_bend")) out.push(isZh ? "屈膝受限，起步/转向更迟缓" : "knee flexion is restricted, making starts/turns slower");
            if (tags.has("forces_tiptoe")) out.push(isZh ? "被迫踮脚，重心更前移且更不稳" : "forced tiptoe shifts balance forward and increases instability");
            if (tags.has("forces_upright")) out.push(isZh ? "躯干被迫挺直，弯腰与低姿态受限" : "torso forced upright; bending/low postures are limited");
            if (tags.has("restricts_arm_movement")) out.push(isZh ? "上肢活动受限，手臂摆动与取物动作受阻" : "arm movement is restricted, limiting reach and arm swing");
            if (tags.has("restricts_fingers")) out.push(isZh ? "手指姿态固定，精细操作失败率显著提高" : "finger posture is fixed, sharply reducing fine manipulation");
            if (tags.has("forces_head_position") || tags.has("restricts_head_turn")) out.push(isZh ? "头位受限，观察需更多身体转向" : "head position is constrained; observation needs body turning");
        } else {
            if (tags.has("restricts_head_turn") || tags.has("forces_head_position")) {
                out.push(isZh ? "护具结构限制转头角度，观察更依赖身体转向" : "protective structure narrows head-turn angle; observation relies more on torso turning");
            }
            if (tags.has("restricts_arm_movement")) {
                out.push(isZh ? "护甲体积影响手臂摆动幅度，动作更笨重" : "armor bulk reduces arm swing range, making movement heavier");
            }
        }

        if (attachmentTypes.has("d_ring")) out.push(isZh ? "存在 D 环牵引点，可触发牵引/固定互动" : "has D-ring anchor points for tether/fixation interactions");
        if (attachmentTypes.has("breath_restrict")) out.push(isZh ? "附件呼吸限制生效，应避免持续高强度动作" : "breath-restrict attachment active; avoid sustained high intensity");
        if (attachmentTypes.has("vision_modifier")) {
            const vision = attachmentDetails.find((a) => a?.type === "vision_modifier" && a?.visionType)?.visionType;
            if (vision) out.push(isZh ? `视野修饰类型：${vision}` : `vision modifier: ${vision}`);
            else out.push(isZh ? "存在视野修饰附件，视觉信息需降级处理" : "vision modifier attachment present; degrade visual certainty");
        }
        if (attachmentTypes.has("ear_device")) out.push(isZh ? "耳部装置生效，听觉线索需按设备模式处理" : "ear-device attachment active; auditory cues depend on its mode");
        if (attachmentTypes.has("finger_restraint")) out.push(isZh ? "手指约束附件生效，禁止精细手指操作" : "finger-restraint attachment active; block fine finger actions");
        if (attachmentTypes.has("oral_sheath")) out.push(isZh ? "口腔套附件生效，口语表达能力明显受限" : "oral-sheath attachment active; spoken expression is strongly constrained");
        if (attachmentTypes.has("vibrator")) {
            const vib = attachmentDetails.find((a) => a?.type === "vibrator");
            const mode = String(vib?.stimMode || "off");
            const level = String(vib?.stimIntensity || "medium");
            out.push(isZh ? `振动附件：模式 ${mode} / 强度 ${level}` : `vibrator attachment: mode ${mode}, intensity ${level}`);
        }
        if (attachmentTypes.has("shock")) {
            const sh = attachmentDetails.find((a) => a?.type === "shock");
            const mode = String(sh?.stimMode || "off");
            const level = String(sh?.stimIntensity || "medium");
            out.push(isZh ? `电击附件：模式 ${mode} / 强度 ${level}` : `shock attachment: mode ${mode}, intensity ${level}`);
        }
        if (attachmentTypes.has("clamp")) out.push(isZh ? "夹具附件存在，局部牵拉与敏感痛感会放大动作反馈" : "clamp attachment present, amplifying localized pull/pain feedback");
        if (attachmentTypes.has("weight")) out.push(isZh ? "重物附件增加摆动惯性与负重感，动作更迟缓" : "weight attachment adds inertia/load, slowing movement");
        if (attachmentTypes.has("bell")) out.push(isZh ? "铃铛附件会暴露移动节奏与方位" : "bell attachment reveals movement rhythm and position");
        if (attachmentTypes.has("temp_device")) {
            const td = attachmentDetails.find((a) => a?.type === "temp_device");
            out.push(isZh ? `温控附件生效（工具：${String(td?.tempTool || "unknown")}）` : `temperature device active (tool: ${String(td?.tempTool || "unknown")})`);
        }
        if (attachmentTypes.has("inflate")) {
            const inf = attachmentDetails.find((a) => a?.type === "inflate");
            out.push(isZh ? `充气附件生效（类型：${String(inf?.inflateType || "unknown")}）` : `inflate attachment active (type: ${String(inf?.inflateType || "unknown")})`);
        }
        if (attachmentTypes.has("latex_layer")) {
            const lx = attachmentDetails.find((a) => a?.type === "latex_layer");
            const thick = String(lx?.latexThickness || "medium");
            const cov = Number(lx?.latexCoverage || 20);
            const st = !!lx?.selfTightening;
            out.push(isZh
                ? `乳胶层附件：厚度 ${thick} / 覆盖 ${cov}%${st ? " / 自收紧开启" : ""}`
                : `latex-layer attachment: thickness ${thick}, coverage ${cov}%${st ? ", self-tightening on" : ""}`);
        }
        if (attachmentTypes.has("pet_accessory") || attachmentTypes.has("pony_tack") || attachmentTypes.has("tail")) {
            out.push(isZh ? "宠物/小马具装附件会强化姿态规范与行为约束语气" : "pet/pony attachments reinforce posture protocol and behavioral constraints");
        }
        if (attachmentTypes.has("constraint_modifier")) {
            const mod = attachmentDetails.find((a) => a?.type === "constraint_modifier");
            const addList = Array.isArray(mod?.addConstraints) ? mod.addConstraints : [];
            const removeList = Array.isArray(mod?.removeConstraints) ? mod.removeConstraints : [];
            if (addList.length || removeList.length) {
                out.push(isZh
                    ? `约束联动附件：新增[${addList.join(",") || "-"}] / 移除[${removeList.join(",") || "-"}]`
                    : `constraint-mod attachment: add[${addList.join(",") || "-"}] / remove[${removeList.join(",") || "-"}]`);
            } else {
                out.push(isZh ? "约束联动附件存在（未配置增减列表）" : "constraint-mod attachment present (no add/remove list configured)");
            }
        }

        const lockLv = Number(eq?.lockLevel || 0);
        if (lockLv > 0) {
            const lvDef = (CYOA.CONFIG?.LOCK_LEVELS || []).find((x) => Number(x.value) === lockLv);
            out.push(isZh
                ? `锁定等级 Lv${lockLv}${lvDef?.desc ? `（${lvDef.desc}）` : ""}`
                : `lock level Lv${lockLv}${lvDef?.desc ? ` (${lvDef.desc})` : ""}`);
        }
        if (Number.isFinite(eq?.layer)) {
            out.push(isZh ? `穿戴层级 L${eq.layer}` : `wear layer L${eq.layer}`);
        }
        if (eq?.slotGroup) {
            out.push(isZh ? `槽组：${eq.slotGroup}` : `slot group: ${eq.slotGroup}`);
        }
        if (eq?.material) {
            out.push(isZh ? `材质：${eq.material}` : `material: ${eq.material}`);
        }

        if (/(高跟|heels|stiletto)/i.test(String(eq?.name || "")) && !out.some((x) => /步|step|姿态|posture/i.test(x))) {
            out.push(isZh ? "高跟导致重心前移，步态更不稳" : "heels shift balance forward and destabilize gait");
        }

        return out.slice(0, 5);
    }

    function getConstraintKeysByEquip(constraintDetails, eqId) {
        const out = [];
        const sources = constraintDetails?.sources && typeof constraintDetails.sources === "object" ? constraintDetails.sources : {};
        Object.keys(sources).forEach((k) => {
            const list = Array.isArray(sources[k]) ? sources[k] : [];
            if (list.some((s) => String(s?.equipId || "") === String(eqId))) out.push(k);
        });
        return out;
    }

    function summarizeMaterialEffect(eq, isZh, constraintDetails) {
        const out = [];
        const cfg = CYOA.CONFIG || {};
        const materialKey = String(eq?.material || "").trim();
        if (!materialKey) return out;
        const materialLookupKey = normalizeMaterialKey(materialKey);

        const materialTpl = cfg.MATERIAL_TEMPLATES?.[materialLookupKey] || cfg.MATERIAL_TEMPLATES?.[materialKey];
        const sf = materialTpl?.sensory_feedback || {};
        const cueWords = [];
        [sf.touch, sf.sound, sf.resistance].forEach((seg) => {
            String(seg || "")
                .split(/[，,、；;。.\s]+/g)
                .map(x => x.trim())
                .filter(Boolean)
                .forEach((w) => {
                    if (!cueWords.includes(w)) cueWords.push(w);
                });
        });
        if (sf.touch || sf.sound || sf.resistance) {
            if (isZh) {
                out.push(
                    `材质反馈（${materialTpl?.label || materialKey}）：` +
                    `${sf.touch ? `触感${sf.touch}` : ""}` +
                    `${sf.sound ? `，声感${sf.sound}` : ""}` +
                    `${sf.resistance ? `，抗性${sf.resistance}` : ""}`
                );
            } else {
                out.push(
                    `material feedback (${materialTpl?.label || materialKey}): ` +
                    `${sf.touch ? `touch ${sf.touch}` : ""}` +
                    `${sf.sound ? `, sound ${sf.sound}` : ""}` +
                    `${sf.resistance ? `, resistance ${sf.resistance}` : ""}`
                );
            }
        }
        if (cueWords.length) {
            out.push(isZh
                ? `材质词锚点（至少命中2个）：${cueWords.slice(0, 8).join("、")}`
                : `material cue anchors (use at least 2): ${cueWords.slice(0, 8).join(", ")}`);
        }

        const sourceConstraints = getConstraintKeysByEquip(constraintDetails, eq?.id);
        const narrativePool = cfg.CONSTRAINT_MATERIAL_NARRATIVES || {};
        for (let i = 0; i < sourceConstraints.length; i += 1) {
            const ck = sourceConstraints[i];
            const text = narrativePool?.[ck]?.[materialLookupKey] || narrativePool?.[ck]?.[materialKey];
            if (text) {
                out.push(isZh ? `材质叙事(${ck})：${text}` : `material narrative (${ck}): ${text}`);
            }
            if (out.length >= 3) break;
        }
        const bodyFx = cfg.MATERIAL_BODY_EFFECTS?.[materialLookupKey];
        const armorLike = isArmorLikeEquip(eq);
        const restraintLike = isRestraintLikeEquip(eq);
        if (bodyFx && (!armorLike || restraintLike)) {
            const parts = [];
            const a = Number(bodyFx.arousalPerTurn || 0);
            const p = Number(bodyFx.painPerTurn || 0);
            const s = Number(bodyFx.shamePerTurn || 0);
            const d = Number(bodyFx.dependencyPerTurn || 0);
            if (a) parts.push(isZh ? `欲望${a > 0 ? "+" : ""}${a}/回合` : `arousal ${a > 0 ? "+" : ""}${a}/turn`);
            if (p) parts.push(isZh ? `痛感${p > 0 ? "+" : ""}${p}/回合` : `pain ${p > 0 ? "+" : ""}${p}/turn`);
            if (s) parts.push(isZh ? `羞耻${s > 0 ? "+" : ""}${s}/回合` : `shame ${s > 0 ? "+" : ""}${s}/turn`);
            if (d) parts.push(isZh ? `依赖${d > 0 ? "+" : ""}${d}/回合` : `dependency ${d > 0 ? "+" : ""}${d}/turn`);
            const desc = String(bodyFx.desc || "").trim();
            if (parts.length || desc) {
                out.push(isZh
                    ? `材质体感联动：${desc || "持续身体反馈"}${parts.length ? `（${parts.join("，")}）` : ""}`
                    : `material-body linkage: ${desc || "ongoing body feedback"}${parts.length ? ` (${parts.join(", ")})` : ""}`);
            }
        }
        return out.slice(0, 3);
    }

    function summarizeEquipStateLinkage(eq, save, isZh) {
        const out = [];
        const cfg = CYOA.CONFIG || {};

        if (eq?.timerEnabled) {
            const timerState = save?.equipmentTimers?.[eq.id];
            const turns = Number(timerState?.turnsWorn || 0);
            const esc = Number(timerState?.escalationLevel || 0);
            out.push(isZh
                ? `计时状态：已穿戴 ${turns} 回合，升级层级 ${esc}`
                : `timer state: worn ${turns} turns, escalation level ${esc}`);
        }
        if (eq?.isIntegrated) {
            out.push(isZh ? "联动：独立服装（多槽位一体约束）" : "linkage: integrated multi-slot outfit");
        }
        if (eq?.comfortType) {
            out.push(isZh ? "联动：舒适型束缚（更易形成依赖）" : "linkage: comfort restraint (dependency rises easier)");
        }
        if (eq?.slotGroup) {
            const groupDef = cfg.SLOT_GROUPS?.[eq.slotGroup];
            if (groupDef?.label) {
                out.push(isZh
                    ? `槽组联动：${groupDef.label}（涉及 ${Array.isArray(groupDef.slots) ? groupDef.slots.join("/") : "多槽"}）`
                    : `slot-group linkage: ${groupDef.label} (${Array.isArray(groupDef.slots) ? groupDef.slots.join("/") : "multi-slot"})`);
            } else {
                out.push(isZh ? `槽组联动：${eq.slotGroup}` : `slot-group linkage: ${eq.slotGroup}`);
            }
        }
        if (eq?.unlockCountdown > 0) {
            out.push(isZh
                ? `解锁倒计时：${eq.unlockCountdown}${eq.unlockCountdownUnit === "turns" || !eq.unlockCountdownUnit ? "回合" : eq.unlockCountdownUnit}`
                : `unlock countdown: ${eq.unlockCountdown} ${eq.unlockCountdownUnit || "turns"}`);
        } else if (eq?.lockCountdownTurns > 0) {
            out.push(isZh ? `锁定倒计时：${eq.lockCountdownTurns}回合` : `lock countdown: ${eq.lockCountdownTurns} turns`);
        }
        if (eq?.unlockItemId) {
            out.push(isZh ? `解锁联动道具：${eq.unlockItemId}` : `unlock-linked item: ${eq.unlockItemId}`);
        }
        if (eq?.indestructible) {
            out.push(isZh ? "耐久联动：不可破坏（挣扎不造成常规损耗）" : "durability linkage: indestructible (no normal struggle wear)");
        }
        if (eq?.escalationPeakTurns > 0) {
            out.push(isZh ? `升级峰值：约 ${eq.escalationPeakTurns} 回合` : `escalation peak around ${eq.escalationPeakTurns} turns`);
        }
        return out.slice(0, 3);
    }

    function buildEquipSourceLine(eq, isZh) {
        const constraints = Array.from(eq?.constraints || []);
        const tags = Array.from(eq?.postureTags || []);
        const att = Array.from(eq?.attachmentTypes || []);
        if (isZh) {
            const seg = [];
            if (constraints.length) seg.push(`constraints: ${constraints.join(",")}`);
            if (tags.length) seg.push(`postureTags: ${tags.join(",")}`);
            if (att.length) seg.push(`attachments: ${att.join(",")}`);
            return seg.length ? `来源字段 -> ${seg.join(" | ")}` : "来源字段 -> 无显式限制字段";
        }
        const seg = [];
        if (constraints.length) seg.push(`constraints: ${constraints.join(",")}`);
        if (tags.length) seg.push(`postureTags: ${tags.join(",")}`);
        if (att.length) seg.push(`attachments: ${att.join(",")}`);
        return seg.length ? `source fields -> ${seg.join(" | ")}` : "source fields -> no explicit restriction fields";
    }

    function buildNarrativeFocusTriplet(isZh, actionText, save) {
        const s = String(actionText || "").toLowerCase();
        const posture = String(save?.posture || "").toLowerCase();
        const isFine = /手指|指尖|精细|按钮|按键|旋钮|解锁|开锁|刻|写|捏|拨|系|解开|finger|fingertip|fine|button|dial|unlock|lockpick|write|pinch|thread|unfasten/.test(s);
        const isMove = /走|移动|前进|奔跑|冲刺|跳|挪|转身|位移|步|run|move|walk|sprint|jump|step|stride|turn/.test(s);
        const isStill = /不动|静止|等待|停住|站着不动|保持不动|stand still|stay still|hold still|remain still/.test(s) || (!isFine && !isMove && (posture === "standing" || posture === "kneel" || posture === "prone"));

        if (isFine) {
            return isZh
                ? {
                    mode: "fine",
                    title: "本回合三焦点（精细操作场景）：",
                    items: ["手部受力与受限反馈", "手指/关节细节动作（含失败与受阻）", "精细操作的替代路径与结果"]
                }
                : {
                    mode: "fine",
                    title: "Turn focus triplet (fine-manipulation scene):",
                    items: ["hand force/load and restriction feedback", "finger/joint micro-actions (including failure/blocking)", "feasible alternatives and outcomes for fine tasks"]
                };
        }

        if (isMove) {
            return isZh
                ? {
                    mode: "move",
                    title: "本回合三焦点（运动场景）：",
                    items: ["鞋具/足部落点与步态变化", "服装拉扯、摩擦与重量负担", "身体道具的摆动、惯性与噪声暴露"]
                }
                : {
                    mode: "move",
                    title: "Turn focus triplet (movement scene):",
                    items: ["footwear/footfall and gait shift", "clothing pull/friction and weight burden", "body-worn gear swing, inertia, and noise exposure"]
                };
        }

        if (isStill) {
            return isZh
                ? {
                    mode: "still",
                    title: "本回合三焦点（静止场景）：",
                    items: ["呼吸节律与胸腹起伏", "视野可得信息与盲区", "听觉线索与方位判断"]
                }
                : {
                    mode: "still",
                    title: "Turn focus triplet (stationary scene):",
                    items: ["breathing rhythm and thoracic/abdominal cadence", "available visual information and blind spots", "auditory cues and directional inference"]
                };
        }

        return isZh
            ? {
                mode: "general",
                title: "本回合三焦点（通用场景）：",
                items: ["当前主动作反馈", "限制/装备造成的关键阻力", "可执行替代动作与后果"]
            }
            : {
                mode: "general",
                title: "Turn focus triplet (general scene):",
                items: ["main action feedback", "key resistance from constraints/equipment", "feasible alternative action and consequence"]
            };
    }

    function buildActiveEquipFocusLines(isZh, game, save, actionText, constraintDetails) {
        const list = getUniqueEquippedItems(game, save);
        const focus = buildNarrativeFocusTriplet(isZh, actionText, save);
        if (!list.length) {
            return [
                focus.title,
                ...focus.items.map((x) => `- ${x}`)
            ];
        }

        const ranked = list
            .map((eq) => ({
                eq,
                score: scoreEquipForAction(eq, actionText)
            }))
            .sort((a, b) => b.score - a.score || b.eq.constraints.size - a.eq.constraints.size)
            .slice(0, 3)
            .filter((x) => x.score > 0 || x.eq.constraints.size > 0);

        if (!ranked.length) {
            return [
                focus.title,
                ...focus.items.map((x) => `- ${x}`)
            ];
        }

        const lines = [];
        lines.push(focus.title);
        focus.items.forEach((x) => lines.push(`- ${x}`));
        lines.push(isZh ? "本回合活跃装备（最多3件，重点描写）：" : "Active equipment this turn (max 3, prioritize these):");
        ranked.forEach(({ eq }, idx) => {
            const effects = summarizeEquipEffect(eq, isZh);
            const materialEffects = summarizeMaterialEffect(eq, isZh, constraintDetails);
            const stateEffects = summarizeEquipStateLinkage(eq, save, isZh);
            const mergedEffects = [...effects, ...materialEffects, ...stateEffects].slice(0, 7);
            const effectText = mergedEffects.length ? mergedEffects.join(isZh ? "；" : "; ") : (isZh ? "按其已设定限制处理" : "apply its configured constraints");
            lines.push(isZh ? `${idx + 1}. ${eq.name}：${effectText}` : `${idx + 1}. ${eq.name}: ${effectText}`);
            lines.push(isZh ? `   - ${buildEquipSourceLine(eq, true)}` : `   - ${buildEquipSourceLine(eq, false)}`);
        });
        lines.push(isZh
            ? "叙事约束：优先按“三焦点”组织本回合描写；装备重点最多3件。每件活跃装备必须写出至少2个具体材质感官词（如冰冷/粗糙/光滑/闷热/金属回响），并与动作结果绑定。材质描写需并入对应段落，禁止独立材质清单。其他穿戴可简述。"
            : "Narrative constraint: organize this turn around the focus triplet first; prioritize at most 3 active items. For each active item, include at least 2 concrete material sensory words (e.g., cold/rough/slick/stuffy/metallic echo) tied to action outcomes. Integrate material narration into that item's paragraph (no standalone list). Other worn gear may be brief.");
        return lines;
    }

    function buildConstraintSourceLines(isZh, constraintDetails) {
        const active = Array.isArray(constraintDetails?.active) ? constraintDetails.active : [];
        const sources = constraintDetails?.sources && typeof constraintDetails.sources === "object" ? constraintDetails.sources : {};
        if (!active.length) return [];
        const lines = [];
        lines.push(isZh ? "当前限制来源明细（用于判定行为边界）：" : "Constraint source details (for behavior boundaries):");
        active.slice(0, 8).forEach((k) => {
            const list = Array.isArray(sources[k]) ? sources[k] : [];
            if (!list.length) {
                lines.push(isZh ? `- ${k}: 来源未记录` : `- ${k}: source not recorded`);
                return;
            }
            const first = list[0] || {};
            const equipName = String(first.equipName || first.equipId || "unknown");
            const from = String(first.from || "unknown");
            const val = String(first.value || "");
            const more = list.length > 1 ? (isZh ? ` 等${list.length}处来源` : ` (+${list.length - 1} more)`) : "";
            lines.push(isZh
                ? `- ${k}: ${equipName} / ${from}${val ? ` / ${val}` : ""}${more}`
                : `- ${k}: ${equipName} / ${from}${val ? ` / ${val}` : ""}${more}`);
        });
        return lines;
    }

    function buildStateAnchorLines(isZh, game, save) {
        if (!game || !save) return [];
        const chapterId = String(save.currentChapter || "").trim();
        const chapter = (game.chapters || []).find((c) => String(c?.id || "") === chapterId);
        const locationId = String(save.currentLocation || "").trim();
        const location = (game.locations || []).find((l) => String(l?.id || "") === locationId);
        const posture = String(save.posture || "standing");
        const playerName = String(save.playerCharacter || save.playerCharacterId || "player");
        const out = [];
        out.push(isZh ? "叙事状态锚点（必须对齐）：" : "Narrative state anchors (must align):");
        out.push(isZh
            ? `- 章节：${chapter?.title || chapterId || "未设置"}`
            : `- chapter: ${chapter?.title || chapterId || "unset"}`);
        out.push(isZh
            ? `- 地点：${location?.name || locationId || "未设置"}`
            : `- location: ${location?.name || locationId || "unset"}`);
        out.push(isZh
            ? `- 角色：${playerName}；姿态：${posture}`
            : `- character: ${playerName}; posture: ${posture}`);
        out.push(isZh
            ? "- 约束：只能引用当前生效限制与已穿戴装备，不得引入未出现场景实体。"
            : "- constraints: only reference active constraints and currently worn equipment; do not introduce unseen scene entities.");
        return out;
    }

    function buildStrictFrameLines(isZh, strictFrame) {
        const f = strictFrame && typeof strictFrame === "object" ? strictFrame : null;
        if (!f) return [];
        const toLine = (label, arr) => {
            const list = Array.isArray(arr) ? arr.filter(Boolean) : [];
            return `${label}${list.length ? list.join(isZh ? "、" : ", ") : (isZh ? "无" : "none")}`;
        };
        const out = [];
        out.push(isZh ? "当前可用事实框架（不得越界）：" : "Current allowed fact frame (do not exceed):");
        out.push(isZh ? `- 游戏名：${f.gameName || "未设置"}` : `- game: ${f.gameName || "unset"}`);
        out.push(isZh ? `- 故事简介：${f.storySynopsis || "无"}` : `- story synopsis: ${f.storySynopsis || "none"}`);
        out.push(isZh ? `- 世界观：${f.worldSetting || "无"}` : `- world setting: ${f.worldSetting || "none"}`);
        out.push(isZh ? `- 背景补充：${f.background || "无"}` : `- background notes: ${f.background || "none"}`);
        out.push(isZh ? `- 地图区域：${f.region || "未设置"}` : `- map region: ${f.region || "unset"}`);
        out.push(isZh ? `- 当前章节：${f.chapter || "未设置"}` : `- current chapter: ${f.chapter || "unset"}`);
        out.push(isZh ? `- 当前地点：${f.location || "未设置"}` : `- current location: ${f.location || "unset"}`);
        out.push(`- ${toLine(isZh ? "可用地图实体：" : "allowed map entities: ", f.allowedMapEntities)}`);
        out.push(`- ${toLine(isZh ? "地点设施：" : "location facilities: ", f.facilities)}`);
        out.push(`- ${toLine(isZh ? "在场人物：" : "present characters: ", f.presentCharacters)}`);
        out.push(`- ${toLine(isZh ? "人物设定锚点：" : "character canon anchors: ", f.characterCanon)}`);
        out.push(`- ${toLine(isZh ? "人物档案约束：" : "character profile constraints: ", f.characterProfiles)}`);
        out.push(isZh
            ? "- 约束联动：世界/环境/线索叙述必须与人物档案兼容；人物做不到的事，世界结果也不得写成已发生。"
            : "- Coupled constraint: world/environment/clue narration must stay compatible with character profiles; impossible character actions cannot be narrated as completed world outcomes.");
        out.push(`- ${toLine(isZh ? "已穿戴装备：" : "equipped items: ", f.equippedItems)}`);
        out.push(`- ${toLine(isZh ? "生效限制：" : "active constraints: ", f.activeConstraints)}`);
        out.push(`- ${toLine(isZh ? "已学技能：" : "skills: ", f.skills)}`);
        out.push(`- ${toLine(isZh ? "进行中任务：" : "active quests: ", f.quests)}`);
        out.push(`- ${toLine(isZh ? "关键属性：" : "key attributes: ", f.attributes)}`);
        out.push(isZh
            ? "- 叙事裁决：任何超出以上清单的地名、人名、组织、历史、规则均视为未知，禁止写成已发生/已存在事实。"
            : "- Narration gate: any place/person/faction/history/rule outside the lists above is unknown and must not be asserted as existing fact.");
        return out;
    }

    CYOA.GamePrompts.getGuardPrompt = function(isZh, activeConstraints, context) {
        const baseLines = (isZh ? ZH_GUARD_LINES : EN_GUARD_LINES).slice();
        const keys = normalizeConstraintList(activeConstraints)
            .map((k) => String(k || "").trim())
            .filter(Boolean);
        const game = context?.game;
        const save = context?.save;
        const actionText = String(context?.actionText || "");
        const constraintDetails = context?.constraintDetails;
        const strictFrame = context?.strictFrame;

        const ruleMap = isZh ? ZH_CONSTRAINT_RULES : EN_CONSTRAINT_RULES;
        const title = isZh ? "当前生效限制（必须遵守）：" : "Active constraints (must obey):";
        const picked = keys.filter((k, i, arr) => arr.indexOf(k) === i).map((k) => ruleMap[k]).filter(Boolean);
        if (picked.length) {
            baseLines.push("", title);
            picked.forEach((line) => baseLines.push(`- ${line}`));
        }
        const focusLines = buildActiveEquipFocusLines(isZh, game, save, actionText, constraintDetails);
        if (focusLines.length) {
            baseLines.push("", ...focusLines);
        }
        const sourceLines = buildConstraintSourceLines(isZh, constraintDetails);
        if (sourceLines.length) {
            baseLines.push("", ...sourceLines);
        }
        const anchorLines = buildStateAnchorLines(isZh, game, save);
        if (anchorLines.length) {
            baseLines.push("", ...anchorLines);
        }
        const frameLines = buildStrictFrameLines(isZh, strictFrame);
        if (frameLines.length) {
            baseLines.push("", ...frameLines);
        }
        return baseLines.join("\n");
    };
})();
