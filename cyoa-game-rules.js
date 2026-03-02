/**
 * CYOA Game Rules Module
 * 提取动作/选项限制规则，避免 UI 文件持续膨胀。
 */
(function() {
    const CYOA = window.CYOA;
    if (!CYOA || !CYOA.CONFIG) return;

    CYOA.GameRules = CYOA.GameRules || {};
    CYOA.GameRules.__moduleName = "rules";
    CYOA.GameRules.__ready = true;

    const DEFAULT_RULE_CONFIG = {
        patterns: {
            lipRead: /读唇|唇读|观察口型|看口型|辨认口型|lip\s*read|lipreading/i,
            lipSpeak: /唇语|口型交流|用口型|比口型|lip\s*sync|mouth\s*words/i,
            hand: /用手|伸手|手掌|手指|指尖|抓|握|捏|拧|扳|撬|刮|擦拭|抹|刻|写|开锁|拧开|旋开|按按钮|触碰|抚摸|捡|拣|拾|取|拾取|拾起|拿起|取物|接|接住|抛|抛出|扔|丢|投掷|open|grip|grab|twist|unlock|scratch|wipe|press|handle|pick\s*up|pick|take|catch|throw|toss/i,
            fineFinger: /手指|指尖|捏|拧|扳|撬|刮|刻|写|开锁|按按钮|旋钮|拨片|扣件|捡|拣|拾|取|拾取|拾起|拿起|取物|接|接住|抛|抛出|扔|丢|投掷|grip|twist|unlock|scratch|press|pick\s*up|pick|take|catch|throw|toss/i,
            audio: /听|倾听|聆听|侧耳|听脚步|听声音|听动静|呼喊回应|listen|hear|audio|sound|footstep/i,
            fastMove: /奔跑|冲刺|狂奔|跳跃|翻越|追赶|快跑|加速移动|run|sprint|jump|dash|chase|leap/i,
            escapeRange: /逃离|远离|拉开距离|冲出|离开现场|脱离牵引|break away|escape far|run away|leave area/i,
            breathHeavy: /长句|大喊|呼救|持续喊叫|屏息|憋气|猛冲|yell|shout|scream|hold breath|all-out sprint/i,
            chastity: /自慰|抚摸下体|刺激阴蒂|刺激龟头|触碰生殖器|解开贞操|摩擦胯部|masturbat|genital|unlock chastity|touch groin/i,
            sit: /坐下|坐姿|蹲坐|sit|seated/i,
            lie: /躺下|俯卧|仰卧|卧倒|lie down|prone|supine/i,
            bend: /弯腰|俯身|低头捡|bend|stoop|crouch/i,
            headTurn: /转头|回头看|扭头|head turn|look back/i,
            visionDetail: /看清|细看|读文字|辨认细节|查看细节|观察细节|read text|inspect detail|identify details|focus vision/i,
            stealth: /潜行|悄悄|无声|蹑手蹑脚|stealth|silent|quietly|sneak/i,
            struggleHard: /剧烈挣扎|猛力挣脱|硬扯|强行拉开|violent struggle|forcefully break|yank/i
        },
        rewrite: {
            hand: {
                zh_no_hands: "调整姿态并观察环境，寻找不依赖双手的突破口",
                zh_no_fingers: "改用身体姿态与周边物件试探，不进行手指精细操作",
                en_no_hands: "Adjust posture and scan for a hands-free workaround",
                en_no_fingers: "Probe with posture and nearby objects, avoiding fine finger actions"
            },
            constraints: {
                zh: {
                    deaf: "改用视觉与地面震动判断周围动静",
                    limited_step: "放慢动作，以小步挪动维持平衡",
                    tethered: "在牵引允许的范围内调整位置，不强行脱离",
                    breath_restrict: "放缓节奏，短促呼吸并减少耗氧动作",
                    chastity: "避开下体接触，改为观察或策略行动"
                },
                en: {
                    deaf: "Rely on visual and vibration cues instead of sound",
                    limited_step: "Slow down and move in short controlled steps",
                    tethered: "Reposition within tether range instead of breaking away",
                    breath_restrict: "Pace down, breathe shallowly, avoid oxygen-heavy moves",
                    chastity: "Avoid genital interaction and switch to tactical actions"
                },
                zh_default: "调整策略并选择当前可执行动作",
                en_default: "Adjust strategy with executable actions"
            },
            postureTags: {
                zh: {
                    restricts_stride: "改为并拢碎步前进，避免大步动作",
                    restricts_knee_bend: "避免屈膝动作，改为缓慢直腿挪动",
                    forces_tiptoe: "保持踮脚平衡，小幅调整重心后再行动",
                    forces_upright: "保持躯干直立，避免弯腰动作",
                    restricts_bending: "避免俯身，改为侧身观察或借助环境",
                    restricts_head_turn: "通过转动身体而非转头来观察周围",
                    forces_head_position: "保持头位固定，改以身体移动补偿视角",
                    restricts_sitting: "当前不执行坐姿动作，改为站立或跪姿调整",
                    restricts_lying: "当前不执行躺姿动作，改为站立/跪姿应对"
                },
                en: {
                    restricts_stride: "Advance with narrow mincing steps, avoid large strides",
                    restricts_knee_bend: "Avoid knee-bending motions; use slow straight-leg shuffles",
                    forces_tiptoe: "Maintain tiptoe balance and move with tiny center shifts",
                    forces_upright: "Keep torso upright and avoid bending actions",
                    restricts_bending: "Avoid torso bending; use angle/position adjustment instead",
                    restricts_head_turn: "Observe by turning the body, not the head",
                    forces_head_position: "Keep head fixed and compensate view via body movement",
                    restricts_sitting: "Do not perform sitting actions now; adjust while standing/kneeling",
                    restricts_lying: "Do not perform lying actions now; adapt with standing/kneeling"
                },
                zh_default: "改为当前姿态可执行动作",
                en_default: "Switch to posture-compatible actions"
            },
            speechBlocked: {
                zh: "用目光与肢体示意你的意图",
                en: "Signal your intent with gaze and body language"
            },
            lipReadBlocked: {
                zh: "尝试靠近目标，寻找其他可感知线索",
                en: "Move closer and seek other perceivable clues"
            },
            attachment: {
                zh: {
                    bell_stealth: "铃铛会暴露你的位置与节奏，改为正面应对或转移注意",
                    weight_move: "重物牵制下改为低速稳态移动，避免高速动作失衡",
                    clamp_struggle: "夹具状态下避免剧烈挣扎，先减载或调整受力点",
                    vision_detail: "当前视觉受限，无法完成精细辨认，改用触觉或近距离确认"
                },
                en: {
                    bell_stealth: "Bell attachment exposes your position/rhythm; switch to frontal handling or distraction",
                    weight_move: "With weighted load, move in low-speed stable steps and avoid high-speed imbalance",
                    clamp_struggle: "Avoid violent struggling under clamps; reduce load or adjust force points first",
                    vision_detail: "Current vision limits block fine-detail recognition; switch to tactile/close-range checks"
                }
            }
        }
    };

    CYOA.GameRules.config = CYOA.GameRules.config || DEFAULT_RULE_CONFIG;

    function getCfg() {
        return CYOA.GameRules.config || DEFAULT_RULE_CONFIG;
    }

    CYOA.GameRules.getDefaultConfig = function() {
        return DEFAULT_RULE_CONFIG;
    };

    CYOA.GameRules.setConfig = function(next) {
        if (!next || typeof next !== "object") return CYOA.GameRules.config;
        CYOA.GameRules.config = next;
        return CYOA.GameRules.config;
    };

    function test(re, s) {
        return !!re && typeof re.test === "function" && re.test(String(s || ""));
    }

    function getActivePostureTagSet() {
        const out = new Set();
        const game = CYOA.currentGame;
        const save = CYOA.currentSave;
        if (!game || !save?.equipment || typeof save.equipment !== "object") return out;
        const defMap = new Map((game.equipment || []).map((e) => [e.id, e]));
        Object.values(save.equipment).forEach((entry) => {
            if (!entry) return;
            const eqId = entry?.id || entry?.equipId || entry?.itemId;
            const def = defMap.get(eqId) || entry;
            const tags = Array.isArray(entry?.postureTags) ? entry.postureTags : (Array.isArray(def?.postureTags) ? def.postureTags : []);
            tags.forEach((t) => out.add(String(t)));
        });
        return out;
    }

    function getActiveAttachmentTypeSet() {
        const out = new Set();
        const game = CYOA.currentGame;
        const save = CYOA.currentSave;
        if (!game || !save?.equipment || typeof save.equipment !== "object") return out;
        const defMap = new Map((game.equipment || []).map((e) => [e.id, e]));
        Object.values(save.equipment).forEach((entry) => {
            if (!entry) return;
            const eqId = entry?.id || entry?.equipId || entry?.itemId;
            const def = defMap.get(eqId) || entry;
            const atts = Array.isArray(entry?.attachments) ? entry.attachments : (Array.isArray(def?.attachments) ? def.attachments : []);
            atts.forEach((att) => {
                const t = String(att?.type || "").trim();
                if (t) out.add(t);
            });
        });
        return out;
    }

    function rewriteHand(constraints, isZh) {
        const cfg = getCfg();
        if (isZh) {
            return constraints?.has("no_hands")
                ? (cfg.rewrite?.hand?.zh_no_hands || "调整姿态并观察环境，寻找不依赖双手的突破口")
                : (cfg.rewrite?.hand?.zh_no_fingers || "改用身体姿态与周边物件试探，不进行手指精细操作");
        }
        return constraints?.has("no_hands")
            ? (cfg.rewrite?.hand?.en_no_hands || "Adjust posture and scan for a hands-free workaround")
            : (cfg.rewrite?.hand?.en_no_fingers || "Probe with posture and nearby objects, avoiding fine finger actions");
    }

    function rewriteConstraint(constraintKey, constraints, isZh) {
        const cfg = getCfg();
        if (constraintKey === "no_hands" || constraintKey === "no_fingers") return rewriteHand(constraints, isZh);
        return isZh
            ? (cfg.rewrite?.constraints?.zh?.[constraintKey] || cfg.rewrite?.constraints?.zh_default || "调整策略并选择当前可执行动作")
            : (cfg.rewrite?.constraints?.en?.[constraintKey] || cfg.rewrite?.constraints?.en_default || "Adjust strategy with executable actions");
    }

    function rewritePostureTag(tag, isZh) {
        const cfg = getCfg();
        return isZh
            ? (cfg.rewrite?.postureTags?.zh?.[tag] || cfg.rewrite?.postureTags?.zh_default || "改为当前姿态可执行动作")
            : (cfg.rewrite?.postureTags?.en?.[tag] || cfg.rewrite?.postureTags?.en_default || "Switch to posture-compatible actions");
    }

    CYOA.GameRules.normalizeActionByConstraints = function(actionText, constraints, options) {
        const cfg = getCfg();
        const RE = cfg.patterns || {};
        const text = String(actionText || "").trim();
        const isZh = !!options?.isZh;
        const postureTags = getActivePostureTagSet();
        const attTypes = getActiveAttachmentTypeSet();
        if (!text) return text;
        if ((!constraints || !constraints.size) && !postureTags.size && !attTypes.size) return text;

        if (constraints?.has("no_hands") && test(RE.hand, text)) return rewriteHand(constraints, isZh);
        if (constraints?.has("no_fingers") && test(RE.fineFinger, text)) return rewriteHand(constraints, isZh);
        if (constraints?.has("deaf") && test(RE.audio, text)) return rewriteConstraint("deaf", constraints, isZh);
        if (constraints?.has("limited_step") && test(RE.fastMove, text)) return rewriteConstraint("limited_step", constraints, isZh);
        if (constraints?.has("tethered") && test(RE.escapeRange, text)) return rewriteConstraint("tethered", constraints, isZh);
        if (constraints?.has("breath_restrict") && test(RE.breathHeavy, text)) return rewriteConstraint("breath_restrict", constraints, isZh);
        if (constraints?.has("chastity") && test(RE.chastity, text)) return rewriteConstraint("chastity", constraints, isZh);
        if ((constraints?.has("blind") || constraints?.has("vision_restricted")) && test(RE.visionDetail, text)) {
            return isZh
                ? (cfg.rewrite?.attachment?.zh?.vision_detail || "当前视觉受限，无法完成精细辨认，改用触觉或近距离确认")
                : (cfg.rewrite?.attachment?.en?.vision_detail || "Current vision limits block fine-detail recognition; switch to tactile/close-range checks");
        }

        if (attTypes.has("bell") && test(RE.stealth, text)) {
            return isZh
                ? (cfg.rewrite?.attachment?.zh?.bell_stealth || "铃铛会暴露你的位置与节奏，改为正面应对或转移注意")
                : (cfg.rewrite?.attachment?.en?.bell_stealth || "Bell attachment exposes your position/rhythm; switch to frontal handling or distraction");
        }
        if (attTypes.has("weight") && test(RE.fastMove, text)) {
            return isZh
                ? (cfg.rewrite?.attachment?.zh?.weight_move || "重物牵制下改为低速稳态移动，避免高速动作失衡")
                : (cfg.rewrite?.attachment?.en?.weight_move || "With weighted load, move in low-speed stable steps and avoid high-speed imbalance");
        }
        if (attTypes.has("clamp") && test(RE.struggleHard, text)) {
            return isZh
                ? (cfg.rewrite?.attachment?.zh?.clamp_struggle || "夹具状态下避免剧烈挣扎，先减载或调整受力点")
                : (cfg.rewrite?.attachment?.en?.clamp_struggle || "Avoid violent struggling under clamps; reduce load or adjust force points first");
        }

        if ((postureTags.has("restricts_stride") || postureTags.has("restricts_knee_bend")) && test(RE.fastMove, text)) {
            return rewritePostureTag(postureTags.has("restricts_stride") ? "restricts_stride" : "restricts_knee_bend", isZh);
        }
        if ((postureTags.has("forces_upright") || postureTags.has("restricts_bending")) && test(RE.bend, text)) {
            return rewritePostureTag(postureTags.has("forces_upright") ? "forces_upright" : "restricts_bending", isZh);
        }
        if ((postureTags.has("restricts_head_turn") || postureTags.has("forces_head_position")) && test(RE.headTurn, text)) {
            return rewritePostureTag(postureTags.has("restricts_head_turn") ? "restricts_head_turn" : "forces_head_position", isZh);
        }
        if (postureTags.has("restricts_sitting") && test(RE.sit, text)) return rewritePostureTag("restricts_sitting", isZh);
        if (postureTags.has("restricts_lying") && test(RE.lie, text)) return rewritePostureTag("restricts_lying", isZh);
        return text;
    };

    CYOA.GameRules.applyOptionConstraintRules = function(optionsList, constraints, options) {
        const cfg = getCfg();
        const RE = cfg.patterns || {};
        const isZh = !!options?.isZh;
        const postureTags = getActivePostureTagSet();
        const attTypes = getActiveAttachmentTypeSet();
        const blockedSpeech = constraints?.has("mute") || constraints?.has("forced_open_mouth");
        const blockedLipReading = constraints?.has("blind") || constraints?.has("vision_restricted");
        if ((!constraints || !constraints.size) && !postureTags.size && !attTypes.size) return optionsList;

        return (optionsList || []).map((opt) => {
            if (!opt) return opt;
            const label = String(opt.label || "");
            const type = String(opt.type || "");
            const isLipRead = test(RE.lipRead, label);
            const isLipSpeak = !isLipRead && test(RE.lipSpeak, label);

            if (blockedSpeech && !isLipRead && (type === "dialog" || isLipSpeak)) {
                return isZh
                    ? { type: "action", label: cfg.rewrite?.speechBlocked?.zh || "用目光与肢体示意你的意图" }
                    : { type: "action", label: cfg.rewrite?.speechBlocked?.en || "Signal your intent with gaze and body language" };
            }
            if (blockedLipReading && isLipRead) {
                return isZh
                    ? { type: "action", label: cfg.rewrite?.lipReadBlocked?.zh || "尝试靠近目标，寻找其他可感知线索" }
                    : { type: "action", label: cfg.rewrite?.lipReadBlocked?.en || "Move closer and seek other perceivable clues" };
            }
            if (constraints?.has("no_hands") && test(RE.hand, label)) return { type: "action", label: rewriteHand(constraints, isZh) };
            if (constraints?.has("no_fingers") && test(RE.fineFinger, label)) return { type: "action", label: rewriteHand(constraints, isZh) };
            if (constraints?.has("deaf") && test(RE.audio, label)) return { type: "action", label: rewriteConstraint("deaf", constraints, isZh) };
            if (constraints?.has("limited_step") && test(RE.fastMove, label)) return { type: "action", label: rewriteConstraint("limited_step", constraints, isZh) };
            if (constraints?.has("tethered") && test(RE.escapeRange, label)) return { type: "action", label: rewriteConstraint("tethered", constraints, isZh) };
            if (constraints?.has("breath_restrict") && test(RE.breathHeavy, label)) return { type: "action", label: rewriteConstraint("breath_restrict", constraints, isZh) };
            if (constraints?.has("chastity") && test(RE.chastity, label)) return { type: "action", label: rewriteConstraint("chastity", constraints, isZh) };
            if ((constraints?.has("blind") || constraints?.has("vision_restricted")) && test(RE.visionDetail, label)) {
                return {
                    type: "action",
                    label: isZh
                        ? (cfg.rewrite?.attachment?.zh?.vision_detail || "当前视觉受限，无法完成精细辨认，改用触觉或近距离确认")
                        : (cfg.rewrite?.attachment?.en?.vision_detail || "Current vision limits block fine-detail recognition; switch to tactile/close-range checks")
                };
            }

            if (attTypes.has("bell") && test(RE.stealth, label)) {
                return {
                    type: "action",
                    label: isZh
                        ? (cfg.rewrite?.attachment?.zh?.bell_stealth || "铃铛会暴露你的位置与节奏，改为正面应对或转移注意")
                        : (cfg.rewrite?.attachment?.en?.bell_stealth || "Bell attachment exposes your position/rhythm; switch to frontal handling or distraction")
                };
            }
            if (attTypes.has("weight") && test(RE.fastMove, label)) {
                return {
                    type: "action",
                    label: isZh
                        ? (cfg.rewrite?.attachment?.zh?.weight_move || "重物牵制下改为低速稳态移动，避免高速动作失衡")
                        : (cfg.rewrite?.attachment?.en?.weight_move || "With weighted load, move in low-speed stable steps and avoid high-speed imbalance")
                };
            }
            if (attTypes.has("clamp") && test(RE.struggleHard, label)) {
                return {
                    type: "action",
                    label: isZh
                        ? (cfg.rewrite?.attachment?.zh?.clamp_struggle || "夹具状态下避免剧烈挣扎，先减载或调整受力点")
                        : (cfg.rewrite?.attachment?.en?.clamp_struggle || "Avoid violent struggling under clamps; reduce load or adjust force points first")
                };
            }

            if ((postureTags.has("restricts_stride") || postureTags.has("restricts_knee_bend")) && test(RE.fastMove, label)) {
                return { type: "action", label: rewritePostureTag(postureTags.has("restricts_stride") ? "restricts_stride" : "restricts_knee_bend", isZh) };
            }
            if ((postureTags.has("forces_upright") || postureTags.has("restricts_bending")) && test(RE.bend, label)) {
                return { type: "action", label: rewritePostureTag(postureTags.has("forces_upright") ? "forces_upright" : "restricts_bending", isZh) };
            }
            if ((postureTags.has("restricts_head_turn") || postureTags.has("forces_head_position")) && test(RE.headTurn, label)) {
                return { type: "action", label: rewritePostureTag(postureTags.has("restricts_head_turn") ? "restricts_head_turn" : "forces_head_position", isZh) };
            }
            if (postureTags.has("restricts_sitting") && test(RE.sit, label)) return { type: "action", label: rewritePostureTag("restricts_sitting", isZh) };
            if (postureTags.has("restricts_lying") && test(RE.lie, label)) return { type: "action", label: rewritePostureTag("restricts_lying", isZh) };
            return opt;
        });
    };
})();
