/**
 * CYOA 插件核心模块 v2.1
 * 包含：配置常量、工具函数、全局对象
 */

(function() {
    // ========== 配置常量 ==========
    const CONFIG = {
        DEBUG: true,
        MAX_IMAGE_SIZE: 2 * 1024 * 1024, // 2MB
        API_URL: 'api.php',
        STORAGE_KEYS: {
            GAMES: 'cyoa_games_v2',
            SAVES: 'cyoa_saves_v2',
            SETTINGS: 'cyoa_settings_v2',
            WORD_FILTER: 'cyoa_word_filter_v1'
        },
        // ========== 八大天道 / 世界规则（道？道！设定） ==========
        HEAVENLY_PATHS: [
            { value: 'K', label: '🔬 K-科学', desc: '绝对理性，数学公式表达' },
            { value: 'J', label: '⚙️ J-机械', desc: '蜂巢思维，效率唯一' },
            { value: 'M', label: '✨ M-魔法', desc: '浪漫艺术家，诗歌规则' },
            { value: 'Q', label: '💋 Q-情色', desc: '欲望炼金，感官体验' },
            { value: 'C', label: '🐙 C-克系', desc: '宇宙癌变，混沌本能' },
            { value: 'G', label: '🔄 G-诡异', desc: '悖论顽童，逻辑陷阱' },
            { value: 'Z', label: '📐 Z-哲学', desc: '概念棋手，辩证对话' },
            { value: 'X', label: '⚔️ X-仙侠', desc: '古老护道，因果平衡' }
        ],
        // 派系相容性 (path -> path -> percent)
        HEAVENLY_PATH_COMPATIBILITY: {
            'K-J': 65, 'K-M': 45, 'K-Q': 20, 'K-C': 0, 'K-G': 15, 'K-Z': 55, 'K-X': 40,
            'J-M': 30, 'J-Q': 25, 'J-C': 0, 'J-G': 10, 'J-Z': 45, 'J-X': 35,
            'M-Q': 60, 'M-C': 5, 'M-G': 50, 'M-Z': 40, 'M-X': 50,
            'Q-C': 10, 'Q-G': 35, 'Q-Z': 30, 'Q-X': 35,
            'C-G': 40, 'C-Z': 0, 'C-X': 0,
            'G-Z': 45, 'G-X': 55,
            'Z-X': 75
        },
        // 遗物等级（归零遗物）
        RELIC_GRADES: [
            { value: 'S', label: 'S级 稳定', risk: 'low', desc: '规则完整无副作用' },
            { value: 'A', label: 'A级 活性', risk: 'medium', desc: '规则不稳定但可控' },
            { value: 'EX', label: 'EX级 悖论', risk: 'high', desc: '存在即矛盾，接触有风险' }
        ],
        // 人性平衡协议
        HUMANITY_BALANCE_CONFIG: {
            humanityThreshold: 30,      // 人性指数低于此触发
            divineThreshold: 80,        // 神性权限高于此触发
            lockLevels: [
                { level: 0, label: '无封锁', effects: [] },
                { level: 1, label: '轻度', effects: ['禁用规则编写'] },
                { level: 2, label: '中度', effects: ['主动解析减速70%', '无法修改核心道纹'] },
                { level: 3, label: '重度', effects: ['仅保留本能视觉', '感官锚点放大'] }
            ]
        },
        // 物品类型（装备类型可携带 constraints 约束标志）
        ITEM_MAX_QUANTITY: 99,
        ITEM_TYPES: [
            { value: 'relic', label: '📿 遗物' },
            { value: 'key', label: '🔑 钥匙' },
            { value: 'map', label: '🗺️ 地图' },
            { value: 'healing', label: '💊 治疗' },
            { value: 'damage', label: '⚡ 伤害' },
            { value: 'consumable', label: '🕯️ 消耗品' },  // 新增：可消耗道具
            { value: 'fuel', label: '⛽ 燃料' },          // 新增：燃料类
            { value: 'repair', label: '🔧 修复工具' },    // 新增：修复类
            { value: 'common', label: '📦 普通' },
            { value: 'quest', label: '📜 剧情' },
            { value: 'equipment', label: '🛡️ 装备' }     // 装备：可携带 CONSTRAINTS 约束标志
        ],
        // 装备部位
        EQUIPMENT_SLOTS: [
            { value: 'head', label: '👤 头', group: 'common' },
            { value: 'eyes', label: '👀 眼睛', group: 'common' },
            { value: 'ears', label: '👂 耳朵', group: 'common' },
            { value: 'nose', label: '👃 鼻子', group: 'common' },
            { value: 'mouth', label: '👄 嘴巴', group: 'common' },
            { value: 'neck', label: '🔗 颈部', group: 'common' },
            { value: 'upper_arm', label: '💪 上臂', group: 'common' },
            { value: 'elbow', label: '🦾 手肘', group: 'common' },
            { value: 'forearm', label: '🤚 前臂', group: 'common' },
            { value: 'wrist', label: '⌚ 手腕', group: 'common' },
            { value: 'palm', label: '🖐️ 手掌', group: 'common' },
            { value: 'fingers', label: '🤞 手指', group: 'common' },
            { value: 'chest', label: '👕 胸部', group: 'common' },
            { value: 'waist', label: '🎗️ 腰部', group: 'common' },
            { value: 'hips', label: '🩳 臀部', group: 'common' },
            { value: 'crotch', label: '🔒 裆部', group: 'common' },
            { value: 'anal', label: '🔒 后穴', group: 'common' },
            { value: 'vaginal', label: '🔒 阴道', group: 'female' },
            { value: 'urethral_f', label: '🔒 尿道(女)', group: 'female' },
            { value: 'penis', label: '🔒 阳具', group: 'male' },
            { value: 'urethral_m', label: '🔒 尿道(男)', group: 'male' },
            { value: 'thigh', label: '🦵 大腿', group: 'common' },
            { value: 'knee', label: '🦿 膝关节', group: 'common' },
            { value: 'calf', label: '🦶 小腿', group: 'common' },
            { value: 'ankle', label: '🦶 脚踝', group: 'common' },
            { value: 'foot', label: '👟 足部', group: 'common' }
        ],
        // 下体部位值集合（用于逻辑判断）
        INTIMATE_SLOTS: ['crotch', 'anal', 'vaginal', 'urethral_f', 'penis', 'urethral_m'],
        FEMALE_ONLY_SLOTS: ['vaginal', 'urethral_f'],
        MALE_ONLY_SLOTS: ['penis', 'urethral_m'],
        // 装备约束（装备可携带的约束标志）
        CONSTRAINTS: [
            { value: 'blind', label: '目盲' },                    // BLIND（完全目盲，无任何视觉）
            { value: 'vision_restricted', label: '视野受限' },    // VISION_RESTRICTED（部分视觉，如微孔/半透明/固定视野）
            { value: 'mute', label: '禁言' },                     // MUTE
            { value: 'deaf', label: '耳聋' },                    // DEAF
            { value: 'limited_step', label: '限步' },            // LIMITED_STEP
            { value: 'no_hands', label: '缚手' },                // NO_HANDS
            { value: 'chastity', label: '贞操' },                // CHASTITY
            { value: 'tethered', label: '🔗 牵引' },               // TETHERED
            { value: 'forced_open_mouth', label: '👄 强制张口' },  // FORCED_OPEN_MOUTH
            { value: 'no_fingers', label: '🤞 指缚' }             // NO_FINGERS
        ],
        // 限步约束默认参数
        LIMITED_STEP_DEFAULTS: {
            stepLimitCm: 20,         // 默认步幅上限（cm）
            speedModifierPct: -50    // 默认移动速度修正（百分比，负值为减速）
        },
        // 限步约束分级阈值与描述（基于 stepLimitCm）
        LIMITED_STEP_TIERS: {
            light: {
                min: 51,              // > 50cm
                label: '轻度受限',
                description: '步伐稍显局促，但尚能维持平衡。',
                hint: '【限步中——步幅被约束收窄，行走尚可，但灵活性已大打折扣',
                bodyReactions: [
                    '步幅比平时短了一截，身体本能放慢节奏以适应约束的存在。',
                    '行走时能感到腿间的牵制力，但尚不至于影响平衡，步态只是稍显拘谨。',
                    '上下台阶时需要多一拍的停顿来调整重心，动作比平时谨慎了几分。',
                    '转弯时身体略微侧倾，脚步变得碎而密，但仍能保持行进的连贯。',
                    '站立时双腿间距比自然状态窄，核心肌群微微收紧以补偿受限的步幅。',
                    '偶尔习惯性地想要大步迈出，约束的阻力会轻轻提醒你放慢脚步。'
                ]
            },
            moderate: {
                min: 20,              // 20cm ~ 50cm
                label: '中度受限',
                description: '双腿被强行束缚在极小的范围内，每一步都必须小心翼翼地挪动。',
                hint: '【限步中——双腿被约束紧紧限制，每一步都需要小心翼翼地计算',
                bodyReactions: [
                    '双腿被迫并拢，膝盖微弯，重心自然下移，身体不自觉前倾以维持平衡。',
                    '行走时只能以胯部轻微摆动带动腿部小步挪移，步态变得拘谨而短促。',
                    '上台阶或转弯时，身体需要整体侧倾才能维持平衡，每个动作都变得小心翼翼。',
                    '站立时核心肌群持续紧绷，稍有外力就会让你踉跄——因为无法快速调整步伐。',
                    '迈步的幅度被严格限制，大腿内侧与髋部持续酸胀，身体逐渐适应这种拘束的节奏。',
                    '试图加快脚步时，约束立刻将力量弹回，你只能以更小的步幅继续缓慢挪动。'
                ]
            },
            severe: {
                min: 0,               // < 20cm
                label: '重度受限',
                description: '步幅甚至不足一个足迹的长度，重心时刻处于失衡边缘，只能进行近乎于磨蹭的微小位移。',
                hint: '【限步中——步幅被压缩到极限，身体几乎丧失了自主移动的能力',
                bodyReactions: [
                    '双腿被锁死在几乎并拢的状态，任何移动都只能靠脚掌在地面上一寸寸地磨蹭。',
                    '重心始终处于失衡的临界点，身体像被钉在原地，每挪动一厘米都伴随着全身的颤抖。',
                    '大腿内侧的肌肉因过度紧绷而隐隐作痛，髋关节仿佛被焊住，连转身都成了奢望。',
                    '试图迈步时，约束的阻力如同一堵墙——脚刚离地就被拽回，只剩下无力的挣扎。',
                    '站立都需要集中全部注意力维持平衡，地面的一丝不平都可能让你失去重心。',
                    '身体不自觉地弓起，双膝微屈，像是随时会跪倒——因为步幅已经不足以支撑任何姿态调整。'
                ]
            }
        },
        // ========== 章节推进条件类型 ==========
        CHAPTER_CONDITION_TYPES: [
            { value: 'quest_complete', label: '✅ 完成任务' },
            { value: 'has_item', label: '🎒 拥有物品' },
            { value: 'attribute_check', label: '📊 属性检查' }
        ],
        ATTRIBUTE_OPERATORS: [
            { value: '>=', label: '>= 大于等于' },
            { value: '<=', label: '<= 小于等于' },
            { value: '==', label: '== 等于' },
            { value: '>', label: '> 大于' },
            { value: '<', label: '< 小于' }
        ],
        // ========== 附件系统 ==========
        ATTACHMENT_TYPES: [
            { value: 'vision_modifier', label: '👁️ 视野修饰' },
            { value: 'stat_modifier', label: '📊 属性修饰' },
            { value: 'constraint_modifier', label: '🔗 约束增减' },
            { value: 'cosmetic', label: '🎨 外观装饰' },
            { value: 'd_ring', label: '🔗 D环/牵引点' },
            { value: 'vibrator', label: '🔔 振动器' },
            { value: 'shock', label: '⚡ 电击装置' },
            { value: 'bell', label: '🔔 铃铛' },
            { value: 'clamp', label: '🗜️ 夹子' },
            { value: 'weight', label: '⬇️ 重物' },
            { value: 'breath_restrict', label: '😮‍💨 呼吸限制' },
            { value: 'temp_device', label: '🌡️ 温度装置' },
            { value: 'latex_layer', label: '🖤 乳胶层' },
            { value: 'inflate', label: '🎈 充气装置' },
            { value: 'pet_accessory', label: '🐾 宠物配件' },
            { value: 'pony_tack', label: '🐴 小马具装' },
            { value: 'tail', label: '🐈 尾巴' },
            { value: 'ear_device', label: '👂 耳部装置' },
            { value: 'finger_restraint', label: '🤞 手指约束' },
            { value: 'oral_sheath', label: '👄 口腔套' }
        ],
        // ========== 牵引系统 ==========
        TETHER_TYPES: [
            { value: 'npc_lead', label: '🚶 NPC牵引', description: '被NPC牵住牵引绳，只能跟随其移动' },
            { value: 'fixed_anchor', label: '⚓ 固定锚点', description: '被链条连接到环境中的固定点，无法离开' },
            { value: 'suspended', label: '🔗 悬吊', description: 'D环被高处吊起，身体悬空' },
            { value: 'short_chain', label: '⛓️ 短链束缚', description: '被极短的链条固定，几乎无法移动' }
        ],
        TETHER_CHAIN_LENGTHS: [
            { value: 'leash', label: '🪢 牵引绳 (1-2m)', movementPct: 30 },
            { value: 'short', label: '⛓️ 短链 (<0.5m)', movementPct: 5 },
            { value: 'medium', label: '🔗 中链 (1m)', movementPct: 20 },
            { value: 'long', label: '🔗 长链 (2-3m)', movementPct: 50 },
            { value: 'none', label: '🚫 无链/直接悬挂', movementPct: 0 }
        ],
        D_RING_POSITIONS: [
            { value: 'front', label: '正面' },
            { value: 'back', label: '背面' },
            { value: 'top', label: '顶部' },
            { value: 'left', label: '左侧' },
            { value: 'right', label: '右侧' },
            { value: 'bottom', label: '底部' }
        ],
        ANCHOR_HEIGHTS: [
            { value: 'floor', label: '🔽 地面', forcedPosture: 'prone' },
            { value: 'low', label: '⬇️ 低处(膝高)', forcedPosture: 'kneeling' },
            { value: 'wall', label: '➡️ 墙面(腰高)', forcedPosture: null },
            { value: 'high', label: '⬆️ 高处(头顶)', forcedPosture: null },
            { value: 'ceiling', label: '🔼 天花板', forcedPosture: 'suspended' }
        ],
        // ========== 姿势系统 ==========
        POSTURES: [
            { value: 'standing', label: '🧍 站立', isDefault: true },
            { value: 'kneeling', label: '🧎 跪姿' },
            { value: 'sitting', label: '🪑 坐姿' },
            { value: 'prone', label: '⬇️ 俯卧' },
            { value: 'supine', label: '⬆️ 仰卧' },
            { value: 'suspended', label: '🔗 悬空' },
            { value: 'crouching', label: '🏋️ 蹲伏' },
            { value: 'bent_over', label: '🔻 弯腰' },
            { value: 'hogtied', label: '⛓️ 反缚' },
            // 高级束缚姿势
            { value: 'armbinder',     label: '🔒 后手单手套', category: 'bondage', constraints: ['no_hands'], desc: '双臂被乳胶单手套紧紧包裹在背后，从指尖到肘部完全合为一体。' },
            { value: 'karada',        label: '🪢 观音缚/菱绳缚', category: 'bondage', desc: '绳索在身体上编织成菱形网络，每一个交叉点都在关键位置施加精确压力。' },
            { value: 'strappado',     label: '⬆️ 背吊缚', category: 'bondage', constraints: ['no_hands'], desc: '双手被缚在背后并向上吊起，身体被迫前倾，肩关节承受持续拉伸。' },
            { value: 'spread_eagle',  label: '✖️ 大字缚', category: 'bondage', constraints: ['no_hands', 'limited_step'], desc: '四肢被分别固定在四个方向，身体完全展开无法合拢。' },
            { value: 'ball_tie',      label: '🔵 球缚', category: 'bondage', constraints: ['no_hands', 'limited_step'], desc: '身体被迫蜷缩成球状，膝盖贴胸，双臂环抱小腿。' },
            { value: 'frogtie',       label: '🐸 蛙缚', category: 'bondage', constraints: ['limited_step'], desc: '小腿分别折向大腿并固定，双膝被迫张开，只能以膝盖移动。' },
            { value: 'mummified',     label: '🧻 木乃伊缚', category: 'bondage', constraints: ['no_hands', 'limited_step', 'blind'], desc: '全身被乳胶绷带/胶带从头到脚层层缠裹，完全无法动弹。' },
            { value: 'sleepsack',    label: '🛌 乳胶睡袋', category: 'bondage', constraints: ['no_hands', 'limited_step'], desc: '全身被包裹在紧致的乳胶睡袋中，双臂固定在两侧，只能做有限的蠕动和扭动。' },
            // PetPlay 姿势
            { value: 'all_fours',     label: '🐾 四肢着地', category: 'petplay', desc: '双手双膝着地，像宠物一样以四肢移动。' },
            { value: 'pet_sit',       label: '🐕 宠物坐姿', category: 'petplay', desc: '跪坐在脚后跟上，双手在面前如爪子般悬空。' },
            { value: 'pet_beg',       label: '🐶 乞食姿势', category: 'petplay', desc: '跪立起身，双手在胸前如爪子般弯曲，仰头看向主人。' },
            { value: 'pet_down',      label: '🐈 趴伏', category: 'petplay', desc: '完全趴伏在地面，下巴贴地，臀部抬起。' },
            // PonyPlay 姿势
            { value: 'pony_stand',    label: '🐴 小马站姿', category: 'ponyplay', desc: '挺胸抬头，双臂被束缚在背后，脚穿蹄靴保持优雅站姿。' },
            { value: 'pony_trot',     label: '🏇 小马快步', category: 'ponyplay', desc: '高抬膝步行，每一步都要求标准的小马步态。' },
            { value: 'pony_display',  label: '🎠 小马展示', category: 'ponyplay', desc: '在指定位置静立展示，接受检阅和评判。' },
            // 家具化姿势
            { value: 'table',         label: '🪑 人体桌子', category: 'furniture', constraints: ['no_hands', 'limited_step'], desc: '四肢着地保持背部水平，作为放置物品的桌面使用。' },
            { value: 'footstool',     label: '🦶 人体脚凳', category: 'furniture', constraints: ['no_hands', 'limited_step'], desc: '蜷缩成紧凑的球状，背部平坦作为搁脚凳使用。' },
            { value: 'coat_rack',     label: '🧥 人体衣架', category: 'furniture', constraints: ['limited_step'], desc: '站立不动，双臂伸展保持固定角度，用于悬挂物品。' },
            { value: 'lamp',          label: '💡 人体灯架', category: 'furniture', constraints: ['limited_step'], desc: '站立或跪姿，双手高举支撑光源，不得晃动。' }
        ],
        // ========== 视野限制类型（blind 约束的子级分类） ==========
        VISION_TYPES: [
            { value: 'full_blind', label: '🌑 完全目盲', severity: 5 },
            { value: 'pinhole', label: '🕳️ 微孔视野', severity: 4 },
            { value: 'multiphole', label: '🔮 多微孔', severity: 3 },
            { value: 'translucent', label: '🌫️ 半透明', severity: 2 },
            { value: 'fixed_gaze', label: '👁️ 固定视野', severity: 3 }
        ],
        // 视野类型的感官描述（用于 AI 提示词和旁白注入）
        VISION_DESCRIPTIONS: {
            full_blind: '视线被完全剥夺，眼前是纯粹的黑暗——没有光、没有影、没有任何视觉信号。身体只能通过触觉、听觉与嗅觉感知周围的一切。',
            pinhole: '视野被压缩到一个针尖大小的孔洞中。光影破碎、残缺，只能捕捉到极小范围内的片段——一个轮廓、一道光线、一抹移动的影子，其余全是黑暗。',
            translucent: '眼前覆盖着半透明的遮蔽层，所有视觉都化为模糊的重影与色块。能感知到光线明暗与大致轮廓，但无法辨认面孔、文字或任何细节。',
            fixed_gaze: '眼球与头部被锁定在固定方向，视角被压缩到极窄的正前方。余光完全消失，侧面和身后的一切都在盲区中，身体对任何来自视野之外的刺激毫无预警。',
            multiphole: '多个微小的孔洞让光线以破碎的方式涌入，视觉像透过万花筒——画面被分割成数个重叠的碎片，距离感与空间感严重扭曲，无法形成完整的视像。'
        },
        // 视野类型的身体自动反应（旁白注入池）
        VISION_BODY_REACTIONS: {
            full_blind: [
                '身体本能微微前倾，步伐变得试探性的，每一步都先用脚尖轻触地面确认安全。',
                '头部不自觉轻微侧转，用耳朵捕捉声源的方向与距离。',
                '呼吸变得更深更慢，身体试图通过气流的变化感知空间的开阔与狭窄。',
                '手指下意识微微张开，随时准备触碰未知的边界与障碍。',
                '面部表情趋于平静，但眉头微蹙，所有注意力集中在触觉与听觉上。',
                '每次环境的温度或气流有细微变化，身体都会短暂僵硬，重新评估周围。'
            ],
            pinhole: [
                '你拼命将眼珠凑向那一个微小的孔洞，试图从破碎的光影中拼凑出周围的全貌。',
                '移动时不得不频繁转头，因为微孔只允许捕捉极小范围的画面——稍一偏离就是黑暗。',
                '光线从针眼般的缝隙涌入，明暗交替间瞳孔不停收缩，眼眶因持续聚焦而隐隐作痛。',
                '恐惧从盲区中涌来——你知道视野之外的世界远比你能看见的更大、更不可控。',
                '被压缩到极致的视野让空间感完全丧失，一步之外的距离仿佛遥不可及。',
                '本能地用手向前探路，因为微孔中看到的片段不足以判断眼前是否有障碍。'
            ],
            translucent: [
                '模糊的光影在眼前流动，能隐约辨认人形的轮廓，却无法分清是谁。',
                '试图聚焦时，画面反而更加模糊——半透明的遮蔽将一切细节溶解成色块与阴影。',
                '光线的明暗变化成为判断环境的唯一线索，但每一个阴影都可能是物体，也可能只是折射。',
                '伸手触碰时总是差半步——因为透过半透明层看到的距离永远不准确。',
                '面部不自觉向前凑近，试图穿透那层模糊，但只换来更大面积的朦胧。',
                '移动时格外依赖听觉与触觉，因为眼前的模糊让你无法确认脚下的路况。'
            ],
            fixed_gaze: [
                '视线被锁死在正前方，侧面的一切只能靠身体整体转向才能看到。',
                '突然从侧方出现的动静让身体剧烈一震——因为固定的视野完全没有预警。',
                '走路时不得不频繁整个身体转向来确认周围，动作变得笨拙而缓慢。',
                '余光的消失让空间感大幅缩水，仿佛世界只剩下正前方那一小片区域。',
                '颈部和眼眶的肌肉因无法转动而持续紧绷，一种被囚禁的压迫感弥漫全身。',
                '对身后的恐惧被放大到极致——背后是完全的盲区，任何东西都可能在你看不见的地方靠近。'
            ],
            multiphole: [
                '画面被分割成数个交错的碎片，每个孔洞里的世界都略有偏移，让人眩晕。',
                '试图判断距离时大脑一片混乱——多个重叠的影像让远近完全无法分辨。',
                '移动时视觉的碎片化加剧，像透过破碎的棱镜看万花筒，胃部隐隐泛起恶心。',
                '闭上眼反而比睁着更舒服——因为破碎的视觉带来的信息混乱比黑暗更令人不安。',
                '抬手时看到的是好几只手的重叠影像，手指的位置在不同碎片间互相矛盾。',
                '走路像踩在不存在的地面上——多微孔让地面的纹理和距离感完全扭曲。'
            ]
        },
        // 视野类型 + 材质融合旁白
        VISION_MATERIAL_NARRATIVES: {
            full_blind: {
                latex: '乳胶严密地吸附在眼部轮廓上，光滑的内壁将每一丝光线都隔绝在外，只有紧致的压迫感在眼眶周围无声地蔓延。',
                metal: '冰冷的金属弧面精准地扣住眼眶，沉甸甸的重量时刻提醒着你——在它被取下之前，黑暗就是你的全部世界。',
                rope: '粗糙的绳索绕过眼部，纤维的勒痕与压迫交织在一起，视线被彻底封死在纹理与黑暗之中。',
                leather: '柔韧的皮革贴合着面部弧度，温热的触感与完全的黑暗形成诡异的对比——舒适，却无法逃脱。',
                fabric: '层层织物绷紧在眼前，透气的面料让你能感觉到呼吸的温度，却看不见任何东西。'
            },
            pinhole: {
                latex: '乳胶紧贴面部，留下的微孔精准到残忍——刚好够你意识到外面有世界，却只能看到针尖大小的碎片。',
                metal: '金属表面开凿的微孔边缘锐利而精确，一束细如丝线的光透入，其余尽是冰冷与黑暗。',
                leather: '皮革上的微孔边缘因磨损而略带毛糙，透入的光线在粗糙边缘处散射成模糊的光斑。',
                fabric: '织物的孔洞稀疏而微小，光线勉强穿透纤维间的缝隙，一切都像隔着厚纱。'
            },
            translucent: {
                latex: '半透明的乳胶层将世界化为流动的色彩——你能感知光线的方向，却无法穿透那层光滑的朦胧。',
                metal: '金属表面经过磨砂处理，光线在微观纹理上散射，外面的世界变成一片模糊的金属灰。',
                leather: '薄削的皮革滤去了细节，只允许光的明暗变化穿透，一切轮廓都变得柔软模糊。',
                fabric: '薄织物的纹路将视线打碎成细密的网格，透过它看到的世界像一幅失焦的画。'
            },
            fixed_gaze: {
                latex: '乳胶精确地贴合眼眶与鼻梁，只在正前方留出狭窄的视窗，眼球和头部都被弹性材质固定。',
                metal: '金属框架将头部和视线锁定在唯一的方向，任何试图扭转的力气都被冰冷的结构消解。',
                leather: '皮革束带将头部固定，视野被压缩到正前方的一条窄缝，颈部在束缚下完全无法转动。',
                fabric: '层叠的织物包裹头部，只在正前方预留一道缝隙，视角如同透过信箱窥探世界。'
            },
            multiphole: {
                latex: '乳胶表面整齐排列的多个微孔让光线以碎片形式涌入，每个孔中的画面都微微偏移，叠加成令人眩晕的万花筒。',
                metal: '金属面板上钻出的排列孔洞像一张筛网，光线被切割成规则的点阵，视觉变成了一幅像素化的图案。',
                leather: '皮革上错落分布的针孔将视野打碎成不规则的碎片，每一个孔洞里的世界都略有不同。',
                fabric: '织物的网眼结构让光线以蜂巢般的格局穿透，多个六边形碎片组成的画面令空间感完全扭曲。'
            }
        },
        // 视野类型的感官过滤提示（注入在 AI 回复文本前端）
        VISION_SENSORY_HINTS: {
            full_blind: '【完全目盲——眼前漆黑一片，没有光、没有影，只有无尽的黑暗',
            pinhole: '【微孔视野——一切画面被压缩到针尖大小的孔洞中，破碎的光影是你仅有的视觉',
            translucent: '【半透明遮蔽——世界化为模糊的色块与重影，你能感知光暗，却看不清任何细节',
            fixed_gaze: '【固定视野——视线被锁死在正前方极窄的范围，余光消失，侧面与身后尽是盲区',
            multiphole: '【多微孔视野——破碎的光点从多个孔洞涌入，画面如万花筒般分裂重叠，令人眩晕'
        },
        // 约束下通用默认选项（限步/缚手时在选项最前插入；每项 modifiers 键为属性名，值为加减量，由 CYOA.applyStatModifiers 应用）
        CONSTRAINT_DEFAULT_ACTIONS: [
            { label: '保持冷静，观察情况', modifiers: { alert: 2 } },
            { label: '顺从当前处境', modifiers: { obedience: 2 } },
            { label: '默默等待', modifiers: { fondness: 1 } }
        ],
        // 约束的通用描写（基于物理与人体力学，主体为「你」或「身体」，不涉及特定角色名）
        CONSTRAINT_DESCRIPTIONS: {
            blind: '视线被完全剥夺，眼前只有纯粹的黑暗。嗅觉与听觉自动放大：你能分辨空气中的细微气味与远处声响。触觉变得敏锐，身体通过皮肤与接触面感知空间与质地。',
            vision_restricted: '视觉受到部分限制但并非完全失明——根据具体视野类型（微孔/半透明/固定方向/多微孔等），角色仍保有有限的视觉能力，但视野范围、清晰度或视角受到不同程度的约束。',
            mute: '声带无法正常振动，气流在喉间受阻。你只能通过呼吸的轻重、身体的姿态与表情传递意图，言语的缺失让肢体与气息成为唯一出口。',
            deaf: '外界声波无法传入，身体更依赖地面的震动与视野中的动静判断环境。平衡感部分依赖视觉代偿，静默中触觉与本体感觉被放大。',
            limited_step: '重心每有偏移，步幅便被限制在极小的范围；大腿与髋部肌肉持续处于牵拉与收紧之中，迈出的每一步都能感到来自约束的阻力与重心变化的吃力。（实际受限程度取决于步幅上限 cm 数值）',
            no_hands: '双臂无法自由触碰外界，触感却反而集中在身体被束缚的部位与躯干。平衡感因失去手臂的调节而改变，想要抓握或支撑时只能感到无法触及的无力。',
            chastity: '下体被严密封锁，约束装置紧贴最私密的区域，任何试图触碰或缓解的动作都被物理隔绝。行走、坐下、弯腰时都能感受到装置的存在——它随体位变化而施加不同程度的压迫与摩擦，令身体时刻处于被"提醒"的状态。',
            tethered: '身体被牵引绳或链条连接到外部锚点，活动范围被严格限制在链条长度之内。每次试图超出范围，连接点都会传来拉扯的力量，牵引装置持续提醒着身体的从属状态。',
            forced_open_mouth: '口腔被装置强制撑开到极限，下颌酸痛无法合拢，舌头暴露在外无法收回。嘴唇完全无法闭合——连唇语、舔唇、吞咽这样最基本的口腔动作都被剥夺。唾液失去控制，顺着嘴角不断流下，在下巴汇聚成线。',
            no_fingers: '手指被锁定在特定姿态中，完全丧失精细操作能力。无法抓取物品、转动门把、解开按扣或操作任何需要指尖灵活度的事物。被约束的手变成了笨拙的肢端——能推、能拍，但无法握、无法捏。'
        },
        TETHER_DESCRIPTIONS: {
            npc_lead: '牵引绳的另一端握在他人手中，你只能被动跟随。每一步的方向和速度都由牵引者决定，任何偏离或抗拒都会通过绳索传来强制拉扯的力量。',
            fixed_anchor: '链条将你固定在环境中的锚点上，活动范围被严格限制。链条末端的金属碰撞声随每一次移动提醒着自由的边界。',
            suspended: '身体被吊离地面，全部重量由牵引点承受。双脚悬空，无法借力，身体在空中随着链条的晃动微微摇摆。',
            short_chain: '极短的链条将你几乎钉在原地，连转身都受到严格限制。身体被迫维持在链条允许的极小范围内。'
        },
        POSTURE_DESCRIPTIONS: {
            standing: '身体直立，双脚着地。',
            kneeling: '双膝跪地，身体重心落在膝盖与小腿上。久跪会令膝盖酸痛、大腿肌肉发麻。',
            sitting: '臀部着座，身体重心通过臀部和背部分散。',
            prone: '面朝下俯卧在地面上，胸部与腹部承受身体的重量。视线被迫朝向地面。',
            supine: '面朝上仰卧，背部贴地。视线朝向天花板，无法观察周围。',
            suspended: '身体悬空，双脚离地，全部重量由牵引点和连接装置承受。重力持续向下拉扯，牵引点处的压力随时间加剧。',
            crouching: '身体蹲伏，膝盖弯曲，重心压低。腿部肌肉持续承受压力。',
            bent_over: '上半身前倾弯腰，头部低于腰部。血液涌向头部，长时间维持会令人头晕。',
            hogtied: '四肢在背后被固定连接，身体弓成弧形。几乎丧失所有自主移动能力。',
            sleepsack: '全身被紧致的乳胶睡袋包裹，双臂固定在两侧无法抬起。只能像蚕蛹一样做有限的蠕动和扭动，脚趾可以在袋底微微活动。'
        },
        // ========== 兴奋度系统 ==========
        AROUSAL_CONFIG: {
            min: 0,
            max: 100,
            releaseAmount: 50,
            criticalAutoDecay: 3,
            criticalDecayFloor: 60
        },
        AROUSAL_THRESHOLDS: [
            { value: 'calm',     min: 0,  max: 20,  label: '😌 平静',   color: '#22c55e' },
            { value: 'warm',     min: 21, max: 40,  label: '🌡️ 微热',  color: '#84cc16' },
            { value: 'aroused',  min: 41, max: 60,  label: '💗 兴奋',   color: '#f59e0b' },
            { value: 'heated',   min: 61, max: 80,  label: '🔥 灼热',   color: '#f97316' },
            { value: 'critical', min: 81, max: 100, label: '💥 临界',   color: '#ef4444' }
        ],
        AROUSAL_DESCRIPTIONS: {
            calm: '身体处于平静状态，没有明显的生理反应。',
            warm: '身体开始感受到微妙的温热感，皮肤变得敏感，但尚在可控范围内。',
            aroused: '呼吸加深，心率上升，身体对任何接触和摩擦都变得异常敏感。注意力开始分散。',
            heated: '全身发热，肌肉不自主地绷紧与放松交替。思维被持续的生理冲动干扰，难以集中注意力进行精细操作。',
            critical: '身体已完全被生理冲动支配，四肢颤抖，呼吸急促而紊乱。任何微小的刺激都会引发强烈的身体反应，意志力几乎无法抑制本能。'
        },
        AROUSAL_BODY_REACTIONS: {
            calm: [],
            warm: [
                '皮肤上泛起一层细微的温热感，像是体内有什么正在被缓慢唤醒。',
                '呼吸不自觉地加深了一些，胸腔的起伏幅度比平时略大。',
                '身体对接触的感知变得更加敏锐，衣物摩擦的触感也比往常明显。'
            ],
            aroused: [
                '心跳的节奏变得沉重而清晰，每一次搏动都能感受到血液在血管中奔涌的热度。',
                '呼吸已经无法保持平稳，偶尔一声不自主的轻喘会从喉间逸出。',
                '身体不自觉地微微扭动，肌肉在紧绷与放松之间反复挣扎，寻找着某种无法得到的纾解。',
                '注意力像被什么东西不断拉扯，试图集中思维却一次次被体内涌动的热潮打断。',
                '皮肤表面的每一寸都变得过度敏感，空气的流动、衣物的摩擦都被放大了数倍。'
            ],
            heated: [
                '全身的肌肉以一种不受控制的节律不停地绷紧-放松-再绷紧，汗水在皮肤上凝出薄薄一层。',
                '双腿开始微微发颤，站立需要额外的意志力，身体重心不自觉地向前倾斜。',
                '呼吸已经变成了断断续续的急促喘息，每一次吸气都伴随着胸腔的微微颤动。',
                '思维像被浓雾笼罩，简单的判断和动作都需要花费比平时多几倍的专注力。',
                '身体以一种近乎痛苦的方式渴望着某种释放，而这种渴望正在一点点瓦解意志的防线。',
                '下腹处聚集的热度已经蔓延到全身，每一次心跳都让这股热潮更加汹涌。'
            ],
            critical: [
                '身体已经完全不听指挥，四肢不受控制地颤抖，每一块肌肉都在被生理冲动反复碾压。',
                '意识模糊得像隔着几层水面看世界，除了体内翻涌的感觉之外什么都无法思考。',
                '呼吸已经彻底失控，急促、紊乱、偶尔的呻吟和喘息无法被意志压抑。',
                '全身的皮肤都像被通了电一般敏感到极点，任何触碰都会引发一阵剧烈的颤栗。',
                '身体弓起、绷紧、又瘫软，反反复复——像是被困在一场无法逃脱的浪潮之中。',
                '泪水不知何时已经模糊了视线，不是因为痛苦，而是因为那无处宣泄的感觉已经逼到了极限。'
            ]
        },
        AROUSAL_GAMEPLAY_EFFECTS: {
            calm:     { attrMod: {},                         filterPrecision: false },
            warm:     { attrMod: {},                         filterPrecision: false },
            aroused:  { attrMod: { alert: -5 },              filterPrecision: false },
            heated:   { attrMod: { alert: -10 },             filterPrecision: true },
            critical: { attrMod: { alert: -20, obedience: 5 }, filterPrecision: true }
        },
        // ========== 刺激器系统 ==========
        STIMULATOR_TYPES: [
            { value: 'vibration', label: '🔔 振动', arousalPerTurn: 8 },
            { value: 'shock',     label: '⚡ 电击', arousalPerTurn: 5, painFeedback: true }
        ],
        STIMULATOR_MODES: [
            { value: 'off',            label: '⏹️ 关闭' },
            { value: 'continuous',     label: '▶️ 持续',      multiplier: 1.0 },
            { value: 'random',         label: '🎲 随机脉冲',  multiplier: 0.7 },
            { value: 'escalating',     label: '📈 逐渐增强',  multiplier: 1.3 },
            { value: 'npc_controlled', label: '🎮 NPC遥控',   multiplier: 1.0 }
        ],
        STIMULATOR_INTENSITIES: [
            { value: 'low',    label: '🟢 低',  multiplier: 0.5 },
            { value: 'medium', label: '🟡 中',  multiplier: 1.0 },
            { value: 'high',   label: '🟠 高',  multiplier: 1.5 },
            { value: 'max',    label: '🔴 极限', multiplier: 2.0 }
        ],
        STIMULATOR_NARRATIVES: {
            vibration: [
                '体内的振动器再次启动，低沉的嗡鸣声从身体深处传来，带着无法忽视的韵律。',
                '一阵持续的振动从最私密的位置向外扩散，身体不由自主地随着那节律微微紧缩。',
                '振动的频率毫无征兆地变化了，身体还来不及适应就被新的节奏裹挟。',
                '能感觉到振动装置紧贴着最敏感的位置不停工作，那种嗡嗡声仿佛直接传入了神经。'
            ],
            shock: [
                '一道电流毫无预警地窜过——身体猛地一僵，肌肉在那一瞬间不受控制地抽搐。',
                '尖锐的电刺感从装置接触皮肤的位置炸开，沿着神经末梢像闪电一样传遍全身。',
                '皮肤下的肌肉因电击的余韵还在微微跳动，神经在刺痛与酥麻之间来回摇摆。',
                '又一次电击——短暂而精准，像是在提醒你谁掌握着控制权。'
            ]
        },
        // 约束下身体的自动反应（姿态、步态、代偿动作等；可有多句，旁白注入时随机抽取 1 句）
        CONSTRAINT_BODY_REACTIONS: {
            limited_step: null, // -> LIMITED_STEP_TIERS.moderate.bodyReactions (post-init)
            no_hands: [
                '失去双手辅助后，肩膀微微后缩，上半身靠轻微左右晃动保持行走时的协调。',
                '蹲下或起身只能依靠腰腹与腿部发力，动作变得缓慢且笨拙。',
                '想要拾取或触碰什么时，身体本能前倾，却在意识到无法伸手后僵住片刻。',
                '风吹过面颊或衣物时，无法用手整理，只能任由它们贴附或飘动在身上。',
                '重心因手臂无法摆动而略显不稳，走路时脚步比平时更宽以弥补平衡的缺失。',
                '身体试图用肩膀或前臂去完成本该由手指做的事，却因束缚而徒劳无功。'
            ],
            blind: null, // -> VISION_BODY_REACTIONS.full_blind (post-init)
            mute: [
                '喉部肌肉不自觉收紧，吞咽的频率增加，气息在胸腔中变得沉重。',
                '试图传达意图时，点头、摇头、耸肩的动作幅度比平时更大更用力。',
                '嘴唇不时轻启又合拢，仿佛想要说什么却被阻断在最后一步。',
                '呼吸的节奏成为情绪的晴雨表：急促代表焦虑，深长代表克制。',
                '眼神的表达比平时强烈，因为它成了唯一不受限制的传达窗口。',
                '身体在沉默中变得更敏锐，每一个细微的姿态调整都在代替语言。'
            ],
            forced_open_mouth: [
                '唾液不受控制地从被撑开的嘴角溢出，顺着下巴滴落——湿意在胸口蔓延。',
                '下颌关节传来持续的酸胀，试图合拢嘴巴的本能一次次被装置阻止。',
                '舌头暴露在空气中变得干燥，却因无法吞咽而口水仍在不断分泌和流出。',
                '每次低头，积聚的口水便成串滑落，在地面或衣物上留下湿润的痕迹。',
                '想要吞咽却发现喉部角度完全不对——口水只能向外流，无法向内吞。',
                '面部肌肉因为长时间被迫维持张口而开始痉挛，嘴角的拉扯感愈发清晰。'
            ],
            oral_sheath: [
                '乳胶内衬的仿真上颚紧贴着真实的上颚，每次舌头抬起都触到那层光滑的人工黏膜——真假难辨的触感令人恍惚。',
                '口腔被完美贴合的乳胶套完全包裹，唾液被导流系统静默地引走，嘴却被迫保持着张开的姿态。',
                '下颌酸胀仍在——口腔套并不减轻强制张口的物理负担，只是将口水的狼狈替换成了干燥而整洁的屈辱。',
                '舌面接触到的每一寸乳胶内壁都在精确模拟口腔组织的弹性与温度，这种仿真感让被侵入时的体验更加逼真。',
                '口腔套将口水问题消解得干干净净，但嘴被锁定在张口位的事实丝毫未变——面部肌肉的颤抖透露着持续的不适。',
                '喉部深处能感觉到微型导管在吞咽反射时轻轻脉动，将多余的唾液安静地导向食道——干净、精密、无法逃离。'
            ],
            deaf: [
                '头部频繁转动，视线快速扫描周围，补偿听觉缺失带来的不安全感。',
                '脚步变得更轻、更谨慎，身体通过地面震动判断周围是否有人靠近。',
                '与人面对面时会不自觉前倾，注视对方嘴唇的动作以试图理解。',
                '突如其来的触碰会引发更强烈的惊跳反应，因为没有声音预警。',
                '身体对风和气流的变化格外敏感，任何异动都让肌肉瞬间绷紧。',
                '走路时会不时回头张望，用视觉确认身后是否有人跟随。'
            ],
            chastity: [
                '每一步行走都能感到装置随胯部的摆动微微位移，那种贴合感无法被忽略。',
                '坐下的瞬间装置的硬质部分压入身体，不得不调整姿势寻找相对不那么难受的角度。',
                '弯腰时腰带与腿环同时收紧，约束装置精准地提醒你它的存在。',
                '行走时大腿内侧偶尔擦过装置边缘，微妙的摩擦感让身体不自觉地绷紧。',
                '久坐后站起时，装置短暂地因体位变化而施加更大的压力，随后缓慢回位。',
                '试图伸手触碰下体的本能被装置的坚硬外壳完全阻断，手指只能碰到冰冷的表面。'
            ],
            tethered: [
                '链条的重量随身体晃动传来节律性的拉扯，连接点处的皮肤已经隐隐发热。',
                '试图迈出超出范围的一步时，牵引绳瞬间绷紧，力量从连接点传遍全身。',
                '每次移动都伴随着金属环碰撞的清脆声响，提醒着自由的边界在哪里。',
                '链条的长度已经被身体记住，不自觉地在允许的范围内小心移动。',
                '牵引点承受的力量随体位变化而改变，低头时拉力减轻，抬头时张力增大。',
                '身体适应了被牵引的节奏，每一个动作都围绕着那个不可违抗的固定点展开。'
            ],
            no_fingers: [
                '手指被锁在约束中，想要抓握的本能反复落空，指尖只能无力地蜷缩或伸展。',
                '试图拿起地上的东西——手掌笨拙地拨弄，却始终无法完成"握"这个动作。',
                '被约束的手指间传来酸胀和麻木，长时间维持固定姿态让关节开始抗议。',
                '看着面前需要操作的物件，手却只能以掌面或手背去推——精细动作已是奢望。',
                '挠痒变成了不可能——只能用约束中的手笨拙地蹭擦，而那种不够精确的触感反而更痒。',
                '试图用手指做出交流手势，但僵硬的约束将每一个意图扼杀在萌芽。'
            ]
        },
        // ========== 锁定 / 挣扎 / 耐久降级系统 ==========
        LOCK_LEVELS: [
            { value: 0, label: '🔓 未锁定', desc: '可自由卸下' },
            { value: 1, label: '🔒 简易锁', desc: '可暴力拆除，挣扎成功率高' },
            { value: 2, label: '🔒 普通锁', desc: '需要工具或钥匙' },
            { value: 3, label: '🔐 精密锁', desc: '仅特定钥匙可开' },
            { value: 4, label: '✨ 魔法封印', desc: '需要特殊条件解除' },
            { value: 5, label: '⛓️ 永久锁死', desc: '完全无法解开，任何挣扎无效' }
        ],
        STRUGGLE_CONFIG: {
            baseDurabilityDamage: 5,
            baseSuccessRate: 0.3,
            lockLevelMultiplier: 0.18,
            handBoundPenalty: 0.6,
            materialModifiers: {
                latex:   { resistMult: 0.8, duraDmgMult: 1.2 },
                metal:   { resistMult: 1.5, duraDmgMult: 0.3 },
                rope:    { resistMult: 0.6, duraDmgMult: 1.5 },
                leather: { resistMult: 1.0, duraDmgMult: 1.0 },
                fabric:  { resistMult: 0.4, duraDmgMult: 2.0 }
            }
        },
        SLOT_DEPENDENCY: {
            eyes:       ['palm', 'wrist', 'forearm'],
            ears:       ['palm', 'wrist'],
            mouth:      ['palm', 'wrist'],
            nose:       ['palm', 'wrist'],
            head:       ['palm', 'wrist'],
            neck:       ['palm', 'wrist'],
            fingers:    ['palm', 'wrist'],
            chest:      ['palm', 'wrist'],
            waist:      ['palm', 'wrist'],
            crotch:     ['palm', 'wrist'],
            vaginal:    ['palm', 'wrist'],
            urethral_f: ['palm', 'wrist'],
            penis:      ['palm', 'wrist'],
            urethral_m: ['palm', 'wrist'],
            thigh:      ['palm', 'wrist'],
            upper_arm:  [],
            elbow:      [],
            forearm:    [],
            wrist:      [],
            palm:       [],
            ankle:      [],
            foot:       [],
            knee:       [],
            calf:       [],
            hips:       ['palm', 'wrist'],
            anal:       ['palm', 'wrist']
        },
        TOOL_BYPASS_SLOTS: ['palm', 'wrist', 'forearm', 'upper_arm'],
        DEGRADATION_RULES: [
            {
                constraint: 'limited_step',
                thresholds: [
                    { duraPct: 75, effect: { stepLimitCmBonus: 10, speedModifierPctBonus: 10 } },
                    { duraPct: 50, effect: { stepLimitCmBonus: 25, speedModifierPctBonus: 25 } },
                    { duraPct: 25, effect: { stepLimitCmBonus: 50, speedModifierPctBonus: 50 } }
                ]
            },
            {
                constraint: 'blind',
                type: 'attachment_degrade',
                thresholds: [
                    { duraPct: 50, visionShift: { from: 'full_blind', to: 'pinhole' } },
                    { duraPct: 50, visionShift: { from: 'pinhole', to: 'translucent' } },
                    { duraPct: 25, visionShift: { from: 'translucent', to: null } }
                ]
            }
        ],
        STRUGGLE_NARRATIVES: {
            success: [
                '一阵剧烈的扭动后，约束终于松脱——身体猛然获得自由的瞬间，肌肉因长期紧绷而酸软发颤。',
                '在反复的拉扯中，束缚发出一声脆响，随即彻底松开。你大口喘息，手指还在不自觉地颤抖。',
                '你咬紧牙关用尽全力，约束终于在持续的压力下屈服，滑落在地。'
            ],
            fail: [
                '你拼命扭动，但约束纹丝不动——只换来勒痕加深和肌肉的酸痛。',
                '挣扎的力气被束缚原样弹回，身体因徒劳的消耗而更加虚弱。',
                '一阵无意义的扯动后，约束反而收得更紧了，你不得不暂停喘息。',
                '你尝试用力拽开，但锁扣牢固得令人绝望，只在皮肤上留下了红痕。'
            ],
            degrade: [
                '你听到一声细微的「咔」——约束的某个部分似乎出现了裂痕，束缚感略微减轻了。',
                '反复的挣扎终于让约束出现了松动，虽然还无法解开，但它的限制力度明显降低了。',
                '持续的拉扯让材质开始变形，你能感觉到束缚不再像之前那样严丝合缝。'
            ],
            broken: [
                '「啪」的一声，约束在持续的磨损下终于断裂，碎片散落一地。你的身体猛然恢复了自由。',
                '约束在最后一次挣扎中彻底崩坏，材质碎裂的声音伴随着突然涌来的解脱感。'
            ],
            blocked_by_hands: [
                '你想伸手去解开，但双手被牢牢束缚——指尖甚至无法触碰到目标。',
                '手腕上的约束让任何试图用手操作的动作都成了徒劳。你必须先解放双手。'
            ],
            permanent_lock: [
                '无论你怎样挣扎，那锁死的机构连一丝松动都没有。这是彻底无法解开的。',
                '身体徒劳地扭动着，但永久锁死的装置像是与身体融为一体，不会给你任何机会。'
            ]
        },
        // ========== 监控视野 (CCTV) 系统 ==========
        OBSERVER_ALERT_CONFIG: {
            struggleIncrement: 8,
            aiKeywordIncrement: 4,
            decayPerTurn: 2,
            thresholds: [
                { value: 25, level: 'low',      label: '📡 低关注',    desc: '摄像头偶尔扫过，尚未引起注意' },
                { value: 50, level: 'medium',    label: '📡 被注意到',  desc: '监控室有人开始关注这个画面' },
                { value: 75, level: 'high',      label: '🚨 高度警戒',  desc: '监控员已经拿起了对讲机' },
                { value: 100, level: 'critical', label: '🔴 即将介入', desc: 'NPC正在赶来，倒计时开始' }
            ],
            interventionThreshold: 100,
            interventionCooldownTurns: 5
        },
        CCTV_NARRATIVES: {
            ambient: [
                '头顶天花板的角落里，一盏红色指示灯无声地闪烁着，摄像头的球罩在暗光中泛着冷光。',
                '走廊尽头那颗半球形的监控探头缓缓转了一个微小的角度，仿佛在重新对焦。',
                '墙壁高处，一个不起眼的黑色圆点——那是被巧妙伪装的摄像头，它从未眨眼。',
                '天花板上的烟雾报警器旁边，一盏几乎看不见的红色LED灯正有节奏地呼吸着。'
            ],
            struggle_watched: [
                '左上角的监控摄像头转动了15度，红色的指示灯在黑暗中闪烁，仿佛在嘲笑你徒劳的扭动。',
                '你挣扎的动作让摄像头的自动追踪功能被触发——镜头无声地锁定了你，变焦马达发出细微的嗡嗡声。',
                '天花板上的监控探头像一只冰冷的眼睛，忠实地记录下你每一次绝望的扭动。画面被同步传回了监控室。',
                '红外传感器在你剧烈的体温波动中捕捉到了异常，某处看不见的屏幕上，你的轮廓正在以热成像的形式被审视。',
                '你的挣扎幅度触发了移动侦测的阈值，监控系统自动截取了一帧高清画面存入服务器。'
            ],
            alert_rising: [
                '监控室里，值班员的咖啡杯悬在半空——屏幕上的画面让他皱起了眉头。',
                '某个你看不见的对讲机里传来了一声嘈杂的通话，有人在报告你所在区域的"异常活动"。',
                '走廊远端传来脚步声——有人正循着监控系统标注的坐标走来。',
                '头顶的摄像头突然亮起了一盏额外的白色补光灯，照亮了你所在的区域——他们想看得更清楚。'
            ],
            intervention_imminent: [
                '你听到了某扇门被刷卡打开的电子声，沉稳的脚步声正快速逼近。监控画面里，一个身影已经出现在走廊的另一端。',
                '对讲机中传来清晰的指令："目标区域确认异常，执行标准处置流程。"脚步声越来越近了。',
                '走廊灯光突然全部亮起——应急照明被远程激活了。某个权威的声音从隐藏的扬声器中传出："保持不动。"'
            ],
            cctv_perspective: [
                '[监控画面 CAM-{camId} {timestamp}] ',
                '[安保系统 实时画面 #{camId}] ',
                '[区域监控 {timestamp} 红外+可见光] '
            ]
        },
        // 通用材质模板（感官反馈：触感、声音、物理抗性）
        MATERIAL_TEMPLATES: {
            latex: {
                label: '乳胶',
                sensory_feedback: {
                    touch: '光滑、紧致、恒温反馈',
                    sound: '轻微拉伸与摩擦声',
                    resistance: '贴合肌肤，不易挣脱'
                }
            },
            metal: {
                label: '金属',
                sensory_feedback: {
                    touch: '冰冷、沉重、硬质',
                    sound: '硬质碰撞声、金属摩擦声',
                    resistance: '坚硬、难以形变'
                }
            },
            rope: {
                label: '绳索',
                sensory_feedback: {
                    touch: '粗糙、纤维感、勒紧',
                    sound: '摩擦与绷紧声',
                    resistance: '可承重、越挣越紧'
                }
            },
            leather: {
                label: '皮革',
                sensory_feedback: {
                    touch: '柔韧、微温、略带纹理',
                    sound: '低沉摩擦与扣带声',
                    resistance: '韧性强、不易撕裂'
                }
            },
            fabric: {
                label: '织物',
                sensory_feedback: {
                    touch: '柔软、透气或密实依材质而定',
                    sound: '窸窣声、轻微摩擦',
                    resistance: '可拉伸或绷紧，视织法而定'
                }
            }
        },
        // 约束+材质融合旁白（通用描写，主体为「你」/「身体」，不涉及特定角色名）
        CONSTRAINT_MATERIAL_NARRATIVES: {
            limited_step: {
                latex: '你试图迈步，但乳胶材质的极强弹性将力量原样弹回，束缚感愈发鲜明。',
                metal: '金属的冰冷与重量牵制着每一步，步幅被牢牢限制，身体难以施展。',
                rope: '绳索的勒紧感随动作加剧，每一步都提醒着你步幅已被牢牢锁死。',
                leather: '皮革的韧劲将迈步的意图化解，步幅在束缚下无法扩大。',
                fabric: '织物绷紧在腿上，每一步都感到来自材质的牵制与限步的无力。'
            },
            no_hands: {
                latex: '乳胶光滑紧致地贴附在皮肤上，双臂无法自由活动，触感却愈发清晰。',
                metal: '金属的冰冷触感时刻提醒着你行动的徒劳，双手无法触碰与抓握。',
                rope: '绳索的粗糙与勒紧让双臂的存在感格外鲜明，却无法用来触碰任何东西。',
                leather: '皮革的柔韧包裹着手臂，束缚感与无法使用的无力交织。',
                fabric: '织物裹住双臂，柔软却不容挣脱，想要伸手时只能感到徒劳。'
            },
            blind: {
                latex: '视线被剥夺后，乳胶的紧致与恒温成为身体感知空间的主要来源。',
                metal: '黑暗中，金属的冰冷与硬质通过触觉不断提醒着你周围的边界。',
                rope: '看不见的世界里，绳索的粗糙与勒紧成为最清晰的身体反馈。',
                leather: '目盲中，皮革的柔韧与微温是你判断方位与接触的依凭。',
                fabric: '失去视觉后，织物的质地与绷紧程度成为身体读取环境的方式。'
            },
            mute: {
                latex: '乳胶贴合在口部，声带无法正常振动，只能通过呼吸与身体的紧绷传递意图。',
                metal: '金属的冰冷封住了言语，你只能用气息与肢体表达。',
                rope: '绳索的束缚让发声变得困难，言语的缺失与触感形成对比。',
                leather: '皮革的包裹下，言语受阻，呼吸与身体的细微动作成为唯一出口。',
                fabric: '织物阻断了清晰的发声，你只能以呼吸的轻重与身体的姿态与人沟通。'
            },
            forced_open_mouth: {
                latex: '乳胶制的开口器将嘴强制撑到最大——光滑的橡胶边缘紧抵牙关，口水沿着乳胶表面滑下。',
                metal: '冰冷的金属环卡在齿列之间，钢的硬度让任何试图合口的尝试都化为徒劳，口水从金属边缘淌落。',
                rope: '绳索勒入嘴角将口腔撑开，粗糙的纤维吸饱了口水，湿润的绳结在脸颊两侧压出深深的印痕。',
                leather: '皮革制的口枷将下颌固定在张开位置，柔韧的皮带从牙齿后方绕过，口水浸润了皮革散发出混合的气味。',
                fabric: '布质填充物将口腔撑满，织物纤维不断吸收又释放唾液，湿透的布料让呼吸更加困难。'
            },
            oral_sheath: {
                latex: '医用级乳胶一体成型的口腔套完美贴合口腔内壁——仿真舌面、上颚纹理和牙龈弹性精确复刻真实触感，嘴被锁定在张口位，但内置导流管网将唾液静默引走，下巴干燥整洁。'
            },
            deaf: {
                latex: '听觉被隔绝后，乳胶的拉伸与摩擦声成为身体能捕捉的少数反馈。',
                metal: '静默中，金属的碰撞与摩擦通过体感而非耳膜传来。',
                rope: '外界无声，绳索的绷紧与摩擦却通过触觉清晰可辨。',
                leather: '耳聋后，皮革的扣带与摩擦声只能借由骨骼与触觉感知。',
                fabric: '声音消失后，织物的窸窣与摩擦通过身体与接触面被放大。'
            },
            chastity: {
                latex: '乳胶材质的贞操装置严丝合缝地吸附在下体，弹性的贴合让每一次呼吸和体位变化都转化为细密的摩擦反馈。',
                metal: '金属贞操带的冰冷与沉重随体温缓慢升温，硬质的弧面精准卡合，任何挣扎只换来金属碰撞的闷响。',
                rope: '绳索编织的约束从腰间延伸嵌入下体，纤维的粗糙在每次移动时制造令人难以忽略的摩擦。',
                leather: '皮革贞操带柔韧而紧致地包裹着下体，扣带的勒紧感与皮革逐渐升温的触感交织在一起。',
                fabric: '织物材质的约束贴合着敏感区域，面料的纹理在移动时不断刺激着身体最私密的部位。'
            },
            no_fingers: {
                latex: '乳胶拳套/手套将每根手指紧紧裹住并固定——光滑的表面让指尖丧失了一切触觉细节，只剩对压力的模糊感知。',
                metal: '金属指管将手指逐根锁定，冰冷的钢环箍在关节处，指节被冻结在固定角度，完全无法弯曲。',
                rope: '绳索将手指捆绑在一起或分别固定，粗糙纤维深嵌指缝，关节在束缚中酸胀发麻。',
                leather: '皮革手套将手指约束在预设形态中，皮革的韧性阻止了一切试图改变手型的努力。',
                fabric: '织物手套或绷带将手指层层包裹、固定，布料的摩擦与束缚让手指僵硬笨拙。'
            }
        },
        // ========== 职业系统 ==========
        // 预设职业列表（编辑器中可直接选用或自定义填写）
        PROFESSION_PRESETS: [
            { value: 'warrior', label: '⚔️ 战士' },
            { value: 'mage', label: '🔮 法师' },
            { value: 'ranger', label: '🏹 游侠' },
            { value: 'thief', label: '🗡️ 盗贼' },
            { value: 'healer', label: '💚 治疗师' },
            { value: 'blacksmith', label: '🔨 铁匠' },
            { value: 'merchant', label: '💰 商人' },
            { value: 'scholar', label: '📚 学者' },
            { value: 'assassin', label: '🥷 刺客' },
            { value: 'knight', label: '🛡️ 骑士' },
            { value: 'bard', label: '🎵 吟游诗人' },
            { value: 'alchemist', label: '⚗️ 炼金术士' },
            { value: 'hunter', label: '🎯 猎人' },
            { value: 'priest', label: '✝️ 牧师' },
            { value: 'necromancer', label: '💀 死灵法师' },
            { value: 'summoner', label: '🌀 召唤师' },
            { value: 'monk', label: '🧘 武僧' },
            { value: 'noble', label: '👑 贵族' },
            { value: 'farmer', label: '🌾 农民' },
            { value: 'explorer', label: '🧭 探险家' }
        ],
        // 技能类型
        SKILL_TYPES: [
            { value: 'magic', label: '✨ 魔法' },
            { value: 'combat', label: '⚔️ 武技' },
            { value: 'passive', label: '🛡️ 被动' },
            { value: 'craft', label: '🔨 制作' },
            { value: 'social', label: '💬 社交' },
            { value: 'special', label: '🌟 特殊' }
        ],
        SKILL_MAX_LEVEL: 9,
        SKILL_MIN_LEVEL: 1,
        // 技能等级缩放公式：效果倍率 = 1 + (level - 1) * EFFECT_SCALE_PER_LEVEL
        //                    消耗倍率 = max(COST_FLOOR, 1 - (level - 1) * COST_REDUCE_PER_LEVEL)
        SKILL_EFFECT_SCALE_PER_LEVEL: 0.15,
        SKILL_COST_REDUCE_PER_LEVEL: 0.08,
        SKILL_COST_FLOOR: 0.3,
        SKILL_LEVEL_LABELS: {
            1: '入门',
            2: '初学',
            3: '熟习',
            4: '精通',
            5: '老练',
            6: '大师',
            7: '宗师',
            8: '传说',
            9: '神话'
        },
        SKILL_PROFICIENCY_PER_LEVEL: 100,
        // 技能解锁方式
        SKILL_UNLOCK_TYPES: [
            { value: 'auto', label: '自动解锁' },
            { value: 'npc', label: 'NPC教学' },
            { value: 'item', label: '道具学习' },
            { value: 'quest', label: '任务奖励' },
            { value: 'manual', label: '手动触发' }
        ],
        // 任务类型
        QUEST_TYPES: [
            { value: 'main', label: '📌 主线任务' },
            { value: 'side', label: '📋 支线任务' },
            { value: 'daily', label: '🔄 日常任务' },
            { value: 'weekly', label: '📅 周常任务' },
            { value: 'random', label: '🎲 随机任务' },
            { value: 'repeatable', label: '♻️ 可重复任务' }
        ],
        // 任务状态
        QUEST_STATUS: [
            { value: 'locked', label: '🔒 未解锁' },
            { value: 'available', label: '📢 可接取' },
            { value: 'active', label: '▶️ 进行中' },
            { value: 'completed', label: '✅ 已完成' },
            { value: 'failed', label: '❌ 已失败' }
        ],
        // 叙述者风格
        NARRATOR_STYLES: [
            '神秘', '欢快', '严肃', '幽默', '诗意', '紧张', '温馨', '史诗', '奇幻', '黑暗', '情感细腻'
        ],
        // ========== 纪律 / 惩罚 / 奖励系统 ==========
        DISCIPLINE_RULES: [
            { value: 'address_master',       label: '称呼主人',     description: '必须以"主人"或指定称谓称呼管理者', severity: 'light' },
            { value: 'no_eye_contact',       label: '禁止直视',     description: '不得直视管理者的眼睛，视线必须低垂', severity: 'light' },
            { value: 'no_speak_without_perm', label: '禁止擅自说话', description: '未经许可不得开口说话', severity: 'moderate' },
            { value: 'maintain_posture',     label: '保持姿势',     description: '未经允许不得改变当前姿势', severity: 'moderate' },
            { value: 'no_resist',            label: '禁止反抗',     description: '不得反抗或挣扎任何约束操作', severity: 'severe' },
            { value: 'immediate_obey',       label: '立即服从',     description: '收到指令后必须立即执行，不得犹豫', severity: 'severe' },
            { value: 'gratitude',            label: '表示感谢',     description: '受到惩罚后必须表示感谢', severity: 'light' },
            { value: 'kneel_on_command',     label: '命令即跪',     description: '收到跪下命令时必须立即下跪', severity: 'moderate' },
            { value: 'present_on_command',   label: '展示身体',     description: '收到展示命令时必须展示指定部位', severity: 'severe' }
        ],
        DISCIPLINE_SEVERITY: {
            light:    { label: '轻度', obedienceLoss: 5,  threshold: 3, color: '#f59e0b' },
            moderate: { label: '中度', obedienceLoss: 10, threshold: 2, color: '#f97316' },
            severe:   { label: '重度', obedienceLoss: 20, threshold: 1, color: '#ef4444' }
        },
        PUNISHMENT_TYPES: [
            { value: 'verbal_warning',   label: '⚠️ 口头警告',   severity: 'light',    auto: false },
            { value: 'forced_posture',   label: '🧎 强制姿势',   severity: 'moderate', auto: true, action: 'setPosture', params: { posture: 'kneeling' } },
            { value: 'lock_increase',    label: '🔒 提升锁定',   severity: 'moderate', auto: true, action: 'increaseLock' },
            { value: 'stimulator_shock', label: '⚡ 电击惩罚',   severity: 'severe',   auto: true, action: 'shock' },
            { value: 'tether_shorten',   label: '⛓️ 缩短链条',   severity: 'moderate', auto: true, action: 'shortenTether' },
            { value: 'arousal_spike',    label: '💥 兴奋度惩罚', severity: 'severe',   auto: true, action: 'arousalSpike', params: { delta: 15 } },
            { value: 'extended_wear',    label: '⏱️ 延长佩戴',   severity: 'light',    auto: false }
        ],
        REWARD_TYPES: [
            { value: 'verbal_praise',    label: '💬 口头表扬',   fondnessGain: 3 },
            { value: 'posture_release',  label: '🧍 姿势释放',   fondnessGain: 5, action: 'setPosture', params: { posture: 'standing' } },
            { value: 'temporary_unlock', label: '🔓 临时解锁',   fondnessGain: 8, action: 'tempUnlock' },
            { value: 'stimulator_off',   label: '⏹️ 关闭刺激器', fondnessGain: 5, action: 'stimOff' },
            { value: 'tether_lengthen',  label: '🔗 延长链条',   fondnessGain: 5, action: 'lengthenTether' },
            { value: 'comfort_break',    label: '☕ 休息时间',   fondnessGain: 10 }
        ],
        // ========== 习惯度系统 ==========
        HABITUATION_CONFIG: {
            gainPerTurn: 2,
            maxLevel: 100,
            withdrawalThreshold: 40,
            withdrawalArousalSpike: 20,
            withdrawalAttrPenalty: { alert: -15 },
            withdrawalDecayPerTurn: 5,
            phantomDurationTurns: 10
        },
        HABITUATION_TIERS: [
            { value: 'none',       min: 0,  max: 10,  label: '未适应',   desc: '身体尚未习惯约束的存在。' },
            { value: 'adjusting',  min: 11, max: 30,  label: '适应中',   desc: '身体开始适应约束的压力和限制。' },
            { value: 'familiar',   min: 31, max: 60,  label: '已熟悉',   desc: '约束的存在已成为身体的一部分，不适感减弱。' },
            { value: 'dependent',  min: 61, max: 85,  label: '依赖',     desc: '身体已经习惯了约束带来的安全感，移除会引发不安。' },
            { value: 'addicted',   min: 86, max: 100, label: '成瘾',     desc: '身体对约束产生了深层依赖，脱下会引发强烈的戒断反应。' }
        ],
        WITHDRAWAL_NARRATIVES: [
            '约束被移除的瞬间，皮肤上残留的压痕还在隐隐发热——身体竟然在怀念那种被包裹的感觉。',
            '失去了约束的贴合后，身体反而产生了一种空落落的不安，仿佛少了什么重要的东西。',
            '皮肤上还残留着约束留下的幻触——那些勒痕、压痕，像是被刻进了神经记忆。',
            '没有了束缚的限制，手脚的自由反而让人感到一阵眩晕般的不适应。',
            '被释放后的最初几分钟，身体不断重复着那些被约束时养成的小动作——缩肩、并膝、低头。',
            '约束消失后，空气直接接触到那些长时间被覆盖的皮肤，敏感到几乎无法忍受的程度。'
        ],
        // ========== 时长效应系统 ==========
        DURATION_EFFECTS: {
            postureDiscomfort: {
                kneeling:  { startTurn: 5,  perTurn: 2,  maxDiscomfort: 30, desc: '膝盖的疼痛随时间加剧，关节处传来持续的酸胀。' },
                prone:     { startTurn: 8,  perTurn: 1,  maxDiscomfort: 20, desc: '胸腔持续承压，呼吸变得越来越费力。' },
                supine:    { startTurn: 10, perTurn: 1,  maxDiscomfort: 15, desc: '背部肌肉因长时间平躺而僵硬，腰部隐隐作痛。' },
                suspended: { startTurn: 3,  perTurn: 3,  maxDiscomfort: 50, desc: '牵引点处的皮肤已从酸痛转为火辣辣的刺痛，四肢因重力而发麻。' },
                crouching: { startTurn: 4,  perTurn: 2,  maxDiscomfort: 35, desc: '大腿肌肉在持续的负荷下不停颤抖，像是随时会失去支撑力。' },
                bent_over: { startTurn: 6,  perTurn: 2,  maxDiscomfort: 25, desc: '血液涌向头部带来阵阵眩晕，腰部肌肉因持续前弯而酸楚难忍。' },
                hogtied:   { startTurn: 2,  perTurn: 3,  maxDiscomfort: 50, desc: '反缚的姿势让脊椎承受持续的反弓压力，肩关节处传来刺痛。' },
                armbinder:    { startTurn: 4,  perTurn: 2,  maxDiscomfort: 40, desc: '双臂在背后被迫合拢的姿势让肩关节持续过度外旋，酸痛从肩胛向指尖蔓延。' },
                strappado:    { startTurn: 2,  perTurn: 3,  maxDiscomfort: 50, desc: '手臂被向后上方吊起的角度让肩关节承受极大压力，前倾的身体重心加剧了拉扯。' },
                spread_eagle: { startTurn: 6,  perTurn: 2,  maxDiscomfort: 30, desc: '四肢持续张开的姿势让关节和肌肉承受匀称但无法缓解的紧绷感。' },
                ball_tie:     { startTurn: 3,  perTurn: 2,  maxDiscomfort: 40, desc: '蜷缩成球的姿势压迫腹部和胸腔，呼吸变得越来越浅。' },
                frogtie:      { startTurn: 5,  perTurn: 2,  maxDiscomfort: 35, desc: '双腿被迫折叠的姿势让膝关节和髋关节持续承压，大腿内侧酸胀难忍。' },
                mummified:    { startTurn: 3,  perTurn: 2,  maxDiscomfort: 45, desc: '层层缠裹的乳胶让全身无法做出任何微调动作，肌肉在静止中逐渐酸麻。' },
                sleepsack:    { startTurn: 5,  perTurn: 1.5, maxDiscomfort: 35, desc: '睡袋内的空间太窄了——无法翻身，无法伸展，肌肉在紧致的乳胶中逐渐僵硬酸痛。' },
                all_fours:    { startTurn: 6,  perTurn: 1,  maxDiscomfort: 25, desc: '膝盖和手掌持续承压，手腕关节在体重下隐隐作痛。' },
                table:        { startTurn: 3,  perTurn: 3,  maxDiscomfort: 50, desc: '背上的重量随时间增加了体感，四肢在支撑中不停颤抖。' },
                footstool:    { startTurn: 4,  perTurn: 2,  maxDiscomfort: 35, desc: '蜷缩的姿势压迫内脏，背上脚的重量让每一次呼吸都更加费力。' },
                coat_rack:    { startTurn: 5,  perTurn: 3,  maxDiscomfort: 45, desc: '伸展的手臂像是要从肩膀脱落，挂上的物品让这个数字在持续增长。' },
                lamp:         { startTurn: 2,  perTurn: 3,  maxDiscomfort: 50, desc: '高举过头的双臂已经完全失去知觉，只剩下肩部火辣辣的灼烧感。' }
            },
            wearFatigue: {
                startTurn: 15,
                perTurn: 1,
                maxFatigue: 20,
                desc: '长时间佩戴约束装备的部位开始发热、发痒，皮肤在密封中渴望呼吸。'
            }
        },
        DISCOMFORT_NARRATIVES: {
            kneeling: [
                '膝盖骨与地面之间的压力已经从隐痛变成了尖锐的刺痛，每一次微小的位移都让人倒吸凉气。',
                '膝盖下方的皮肤已经发红发热，关节仿佛被慢慢碾压，酸胀感沿大腿向上蔓延。',
                '双膝已经开始发麻，从疼痛到麻木的转变并不是好事——这意味着血液循环正在受阻。'
            ],
            suspended: [
                '牵引点处的皮肤已经变得滚烫，整条手臂——或者是脖子——传来阵阵针扎般的麻痹感。',
                '身体的重量像是在缓慢地将关节从骨架中拆解，每一次呼吸都伴随着肩部的钝痛。',
                '手指尖和脚趾尖开始失去知觉，悬吊带来的血液重新分配让四肢末端渐渐冰冷。'
            ],
            hogtied: [
                '脊椎因长时间反弓而发出无声的抗议，腰部的肌肉已经在持续痉挛的边缘。',
                '四肢被拉向背后的姿势让肩关节承受了远超正常范围的压力，钝痛已经变成了锐痛。',
                '反缚的姿势压迫着胸腔，每一次呼吸都变得更浅、更急促，像是永远吸不到足够的空气。'
            ],
            general: [
                '长时间被约束覆盖的皮肤开始发痒，但无法触及的痒意只能变成更深层的不适。',
                '约束贴合的部位因汗液和体温而变得闷热，皮肤在密封中渴望一口新鲜空气。',
                '被持续束缚的区域肌肉已经产生了明显的酸胀感，身体在约束中无法找到任何舒适的位置。'
            ]
        },
        // ========== 困境束缚系统 (Predicament Bondage) ==========
        PREDICAMENT_TYPES: [
            { value: 'bell_chain',   label: '🔔 铃铛链',   desc: '移动会让铃铛响动暴露位置，保持不动则姿势累积疼痛' },
            { value: 'clamp_link',   label: '🔗 夹子连锁', desc: '维持姿势会拉扯夹子，换姿势会触发更强拉扯' },
            { value: 'balance_pose', label: '⚖️ 平衡姿势', desc: '必须维持特定姿势，失衡会触发惩罚机制' },
            { value: 'weight_pull',  label: '⬇️ 重物牵引', desc: '悬挂重物持续施压，移动会增加摆动和拉扯' },
            { value: 'ice_release',  label: '🧊 冰锁',     desc: '冰块融化前必须维持姿势，融化后约束自动释放' },
            { value: 'drip_candle',  label: '🕯️ 滴蜡困境', desc: '保持不动则持续受热蜡滴落，移动则触发其他惩罚' }
        ],
        PREDICAMENT_CONFIG: {
            painAccumPerTurn: 3,
            maxPain: 100,
            failurePenalty: { arousal: 10, obedience: -5 },
            successReward: { obedience: 3, fondness: 2 },
            bellAlertChance: 0.4
        },
        PREDICAMENT_NARRATIVES: {
            bell_chain: [
                '身体微微颤抖，铃铛发出细碎的叮当声——你屏住呼吸，祈祷没有人听见。',
                '维持静止的努力让肌肉开始发抖，而每一次抖动都让铃铛发出背叛性的声响。'
            ],
            clamp_link: [
                '连接两个夹子的链条随姿势微调而绷紧，尖锐的压力从两端同时传来。',
                '试图缓解一端的压力只会让另一端的夹子咬得更深——这是一个无解的零和游戏。'
            ],
            balance_pose: [
                '身体在精确的平衡点上摇摇欲坠，每一块肌肉都在为维持这个不自然的姿势而尖叫。',
                '重心的微妙偏移让整个身体紧张起来——失去平衡意味着惩罚，而平衡越来越难以维持。'
            ],
            weight_pull: [
                '悬挂的重物随身体的呼吸节奏缓缓摆动，每一次摆动都在连接点制造新的拉扯。',
                '重力无情地向下拽拉，时间越长，那份持续的压迫感就越难以忽视。'
            ]
        },
        // ========== 训练/调教系统 (Training & Conditioning) ==========
        TRAINING_TYPES: [
            { value: 'posture',   label: '🧎 姿势训练', desc: '学习并维持指定姿势', stages: 5 },
            { value: 'verbal',    label: '🗣️ 口令训练', desc: '对特定口令做出即时反应', stages: 4 },
            { value: 'endurance', label: '💪 耐受训练', desc: '提高对约束/刺激的忍耐力', stages: 6 },
            { value: 'display',   label: '👁️ 展示训练', desc: '按指令展示身体指定部位', stages: 4 },
            { value: 'service',   label: '🍽️ 侍奉训练', desc: '学习服务性行为和礼仪', stages: 5 },
            { value: 'silence',   label: '🤫 静默训练', desc: '在刺激下保持沉默', stages: 4 }
        ],
        TRAINING_CONFIG: {
            progressPerSuccess: 20,
            progressPerFail: -10,
            maxLevel: 5,
            levelUpThreshold: 100,
            masteredBonus: { discomfortReduction: 0.3, shameTolerance: 10 }
        },
        TRAINING_LEVEL_LABELS: { 1: '入门', 2: '初级', 3: '中级', 4: '高级', 5: '精通' },
        // ========== 羞耻/暴露系统 (Humiliation & Exposure) ==========
        SHAME_CONFIG: {
            min: 0, max: 100,
            decayPerTurn: 1,
            exposureGain: { partial: 5, full: 15, public: 25 },
            desensitizeRate: 0.5,
            desensitizeThreshold: 60
        },
        SHAME_THRESHOLDS: [
            { value: 'composed',  min: 0,  max: 15, label: '镇定',   color: '#94a3b8' },
            { value: 'flushed',   min: 16, max: 35, label: '脸红',   color: '#f472b6' },
            { value: 'ashamed',   min: 36, max: 55, label: '羞耻',   color: '#e11d48' },
            { value: 'humiliated',min: 56, max: 80, label: '屈辱',   color: '#be123c' },
            { value: 'broken',    min: 81, max: 100,label: '崩溃',   color: '#881337' }
        ],
        SHAME_NARRATIVES: [
            '热度从脖颈蔓延至耳尖，皮肤上泛起难以掩饰的粉红色。',
            '羞耻感如同实体般压在胸口，让呼吸变得又浅又急促。',
            '意识到自己被注视的目光，身体不自觉地蜷缩，试图缩小暴露的面积。',
            '脸上的热度已经滚烫到无法忽视，眼眶酸涩，视线模糊。',
            '羞耻和屈辱在体内翻涌，大脑一片空白，身体只能本能地颤抖。',
            '每一寸被暴露的皮肤都在燃烧，仿佛全世界的目光都穿透了最后的防线。'
        ],
        // ========== 呼吸控制系统 (Breath Control) ==========
        OXYGEN_CONFIG: {
            max: 100, min: 0,
            normalRecovery: 15,
            restrictedDrain: 5,
            severeDrain: 12,
            criticalThreshold: 25,
            dangerThreshold: 10,
            blackoutThreshold: 0
        },
        BREATH_DEVICE_TYPES: [
            { value: 'gag_nose_clip', label: '口塞+鼻夹',    drainRate: 8,  desc: '口鼻双重封堵，呼吸严重受限' },
            { value: 'breath_hood',   label: '呼吸控制头套', drainRate: 10, desc: '完全包裹头部，仅保留微小呼吸孔' },
            { value: 'hand_cover',    label: '手捂口鼻',     drainRate: 6,  desc: 'NPC手掌覆盖口鼻' },
            { value: 'collar_tight',  label: '收紧项圈',     drainRate: 4,  desc: '项圈收紧压迫颈部气管' },
            { value: 'rebreather',    label: '循环呼吸袋',   drainRate: 7,  desc: '密封袋内空气逐渐稀薄' }
        ],
        OXYGEN_THRESHOLDS: [
            { value: 'normal',    min: 76, max: 100, label: '正常',   color: '#22c55e' },
            { value: 'strained',  min: 51, max: 75,  label: '吃力',   color: '#eab308' },
            { value: 'desperate', min: 26, max: 50,  label: '窒息',   color: '#f97316' },
            { value: 'critical',  min: 11, max: 25,  label: '危险',   color: '#ef4444' },
            { value: 'blackout',  min: 0,  max: 10,  label: '濒临昏厥', color: '#7f1d1d' }
        ],
        OXYGEN_NARRATIVES: [
            '肺部开始灼烧，每一次呼吸都只能吸入少得可怜的空气，胸腔在无声地抗议。',
            '缺氧让视野边缘开始出现暗影，大脑变得迟钝而恍惚。',
            '横膈膜不自主地痉挛，身体用尽一切力量试图获取更多氧气。',
            '意识开始变得朦胧，四肢末端出现刺麻感，时间仿佛变得粘稠而缓慢。',
            '耳边响起嗡嗡的耳鸣，世界在缺氧中变得遥远而不真实。'
        ],
        OXYGEN_GAMEPLAY_EFFECTS: {
            strained:  { attrMod: { alert: -5 }, visionBlur: false },
            desperate: { attrMod: { alert: -15, composure: -10 }, visionBlur: true },
            critical:  { attrMod: { alert: -25, composure: -20 }, visionBlur: true, actionLimit: true },
            blackout:  { attrMod: { alert: -50, composure: -50 }, forcePosture: 'prone' }
        },
        // ========== 打击/鞭打系统 (Impact Play) ==========
        IMPACT_TOOLS: [
            { value: 'hand',     label: '✋ 手掌',   painBase: 3,  pleasureBase: 2, markChance: 0.2, markType: 'redness' },
            { value: 'paddle',   label: '🏓 拍子',   painBase: 5,  pleasureBase: 1, markChance: 0.5, markType: 'redness' },
            { value: 'flogger',  label: '🪢 鞭条',   painBase: 4,  pleasureBase: 3, markChance: 0.4, markType: 'welt' },
            { value: 'whip',     label: '🦯 长鞭',   painBase: 8,  pleasureBase: 1, markChance: 0.8, markType: 'welt' },
            { value: 'cane',     label: '🎋 藤条',   painBase: 7,  pleasureBase: 0, markChance: 0.9, markType: 'stripe' },
            { value: 'crop',     label: '🏇 马鞭',   painBase: 6,  pleasureBase: 2, markChance: 0.6, markType: 'welt' },
            { value: 'belt',     label: '👔 皮带',   painBase: 6,  pleasureBase: 1, markChance: 0.7, markType: 'stripe' }
        ],
        MARK_TYPES: {
            redness:  { label: '红痕', decayTurns: 5,  desc: '皮肤表面泛红，触碰时有轻微热感。' },
            welt:     { label: '鞭痕', decayTurns: 12, desc: '隆起的条状痕迹，触碰时疼痛明显。' },
            stripe:   { label: '杖痕', decayTurns: 20, desc: '平行的深色条纹印记，触碰会引发尖锐刺痛。' },
            bruise:   { label: '淤痕', decayTurns: 30, desc: '深层组织损伤导致的青紫色块，按压时有深层钝痛。' }
        },
        IMPACT_CONFIG: {
            painDecayPerTurn: 2,
            maxPain: 100,
            painToPleasureThreshold: 40,
            painToPleasureConversion: 0.3,
            markIntensityMultiplier: 1.5
        },
        IMPACT_ZONES: [
            { value: 'buttocks',  label: '臀部',   sensitivity: 1.0, safeLevel: 'high' },
            { value: 'thighs',   label: '大腿',   sensitivity: 1.2, safeLevel: 'high' },
            { value: 'back',     label: '背部',   sensitivity: 0.8, safeLevel: 'medium' },
            { value: 'chest',    label: '胸部',   sensitivity: 1.5, safeLevel: 'medium' },
            { value: 'soles',    label: '脚底',   sensitivity: 1.8, safeLevel: 'medium' },
            { value: 'palms',    label: '手心',   sensitivity: 1.3, safeLevel: 'medium' }
        ],
        IMPACT_NARRATIVES: {
            light: [
                '清脆的一声响过，皮肤上泛起淡淡的粉红色热度。',
                '力道精准而克制，留下的更多是心理上的震慑而非身体上的疼痛。'
            ],
            medium: [
                '肌肉在打击落下的瞬间不自觉地绷紧，皮肤表面迅速升起灼热的刺痛。',
                '钝重的力道穿透皮肤直达深层肌肉，痛感在击打点缓缓扩散开来。'
            ],
            heavy: [
                '身体在打击中猛然弓起，一声无法抑制的呻吟从喉咙深处逸出。',
                '皮肤表面几乎在同一时刻变得滚烫，尖锐的痛感如同电流般射向全身。'
            ]
        },
        // ========== 感官剥夺增强 (Sensory Deprivation Enhancement) ==========
        DEPRIVATION_CONFIG: {
            touchAmplifyMultiplier: 2.0,
            spaceDisorientStart: 5,
            timeDistortionStart: 8,
            overloadRecoveryTurns: 5,
            overloadArousalSpike: 15
        },
        DEPRIVATION_LEVELS: [
            { value: 'single',   minSenses: 1, label: '单感官剥夺', desc: '一种感官被屏蔽，其余感官开始代偿。' },
            { value: 'double',   minSenses: 2, label: '双重剥夺',   desc: '两种感官同时被屏蔽，剩余感官急剧增敏。' },
            { value: 'triple',   minSenses: 3, label: '多重剥夺',   desc: '三种以上感官被屏蔽，身体进入极度增敏状态，空间感瓦解。' },
            { value: 'total',    minSenses: 4, label: '完全剥夺',   desc: '几乎所有外界信息被切断，意识退缩至身体内部感知。' }
        ],
        DEPRIVATION_NARRATIVES: {
            touch_amplify: [
                '在视觉和听觉都被剥夺后，皮肤上最轻微的气流都变得无比鲜明——仿佛每一个毛孔都睁开了眼睛。',
                '失去了其他感官的参照，触觉被放大到了不可思议的程度——连衣物的纤维纹理都变得清晰可辨。'
            ],
            space_lost: [
                '没有了视觉和声音的定位，上下左右的概念开始崩塌——身体悬浮在一片无边际的虚空中。',
                '你无法确定自己面朝哪个方向，房间的大小、周围有谁——一切空间感知都已瓦解。'
            ],
            time_distort: [
                '时间失去了所有刻度——一分钟可能是一小时，也可能只是几秒。在感官的真空中，时间变成了无意义的概念。',
                '没有任何外部线索来锚定时间的流逝，意识开始在模糊的时间海洋中漂流。'
            ],
            sensory_overload: [
                '感官突然恢复的冲击如同洪水决堤——光线、声音、触感同时涌入，大脑在信息的洪流中短路。',
                '被剥夺后重新获得感官输入的那一刻，世界以十倍的强度回归，每一个信号都变得刺眼、刺耳、刺痛。'
            ]
        },
        // ========== 温度游戏系统 (Temperature Play) ==========
        TEMP_TOOLS: [
            { value: 'hot_wax',    label: '🕯️ 热蜡',   tempDelta: 25,  duration: 4, desc: '滚烫蜡液滴落在皮肤上，灼热后逐渐冷却凝固' },
            { value: 'ice_cube',   label: '🧊 冰块',   tempDelta: -20, duration: 3, desc: '冰块划过皮肤，留下刺骨的冰冷轨迹' },
            { value: 'warm_oil',   label: '🫒 温油',   tempDelta: 10,  duration: 6, desc: '温热的精油涂抹在身体上，缓缓渗入皮肤' },
            { value: 'metal_cold', label: '🔧 冰冷金属', tempDelta: -15, duration: 5, desc: '冰冷的金属器具贴上温热的皮肤，激起剧烈的收缩' },
            { value: 'hot_towel',  label: '♨️ 热毛巾',  tempDelta: 15,  duration: 4, desc: '蒸汽缭绕的热毛巾包裹住身体，热量缓缓渗入' },
            { value: 'menthol',    label: '🌿 薄荷膏',  tempDelta: -10, duration: 8, desc: '薄荷成分在皮肤上制造灼烧般的冰凉感，持续时间极长' }
        ],
        TEMP_ZONES: [
            { value: 'chest',     label: '胸部',   sensitivity: 1.3 },
            { value: 'abdomen',   label: '腹部',   sensitivity: 1.0 },
            { value: 'back',      label: '背部',   sensitivity: 0.8 },
            { value: 'thighs',    label: '大腿内侧', sensitivity: 1.5 },
            { value: 'neck',      label: '颈部',   sensitivity: 1.4 },
            { value: 'buttocks',  label: '臀部',   sensitivity: 1.2 },
            { value: 'soles',     label: '脚底',   sensitivity: 1.6 },
            { value: 'genitals',  label: '敏感区域', sensitivity: 2.0 }
        ],
        TEMP_CONFIG: {
            normalTemp: 0,
            maxHot: 50, minCold: -50,
            decayPerTurn: 5,
            arousalFromHot: 2,
            arousalFromCold: 1,
            painFromExtreme: 3,
            extremeThreshold: 30
        },
        TEMP_NARRATIVES: {
            hot: [
                '灼热的温度落在皮肤上的瞬间，肌肉猛然收缩——疼痛和快感的界限在高温中模糊。',
                '热度缓慢渗入皮下组织，从尖锐的灼痛逐渐转化为温热的脉动。',
                '被加热的区域皮肤变得通红，神经末梢在热量中疯狂地发射信号。'
            ],
            cold: [
                '冰冷的接触让皮肤起了一层鸡皮疙瘩，肌肉在寒意中不自觉地紧绷。',
                '冰凉的轨迹划过温热的皮肤，温差制造出尖锐到近乎疼痛的刺激。',
                '寒意从接触点向四周扩散，被冷却的皮肤变得麻木，然后是更加敏感的回温。'
            ],
            contrast: [
                '冷热交替的刺激让大脑无法适应——刚刚习惯了灼热，冰冷就紧随而至，感官在极端中剧烈摇摆。',
                '被热蜡覆盖过的皮肤突然遭遇冰块的袭击，温差带来的冲击让身体猛烈颤抖。'
            ]
        },
        // ========== 乳胶封闭系统 (Latex Enclosure) ==========
        LATEX_THICKNESS: [
            { value: 'thin',   label: '薄 (0.3mm)', touchMult: 1.5, heatRate: 1, desc: '薄如第二层皮肤，外部触碰被放大传递' },
            { value: 'medium', label: '中 (0.6mm)', touchMult: 0.8, heatRate: 2, desc: '标准厚度，触觉略被隔离但体温上升更快' },
            { value: 'thick',  label: '厚 (1.0mm)', touchMult: 0.4, heatRate: 3, desc: '厚重乳胶，极大隔绝外部触感，散热极差' },
            { value: 'heavy',  label: '超厚 (1.5mm+)', touchMult: 0.2, heatRate: 4, desc: '重型乳胶，几乎完全隔绝触觉，形成硬质约束壳' },
            { value: 'liquid', label: '液态 (涂抹)', touchMult: 2.0, heatRate: 1, isLiquid: true, desc: '液态乳胶直接涂抹于皮肤表面固化成膜，无缝完美贴合，触觉极度放大，无法通过挣扎脱离' }
        ],
        LATEX_COVERAGE: [
            { value: 'partial',  min: 1,  max: 30,  label: '局部覆盖', desc: '手套、袜子、面罩等单件' },
            { value: 'half',     min: 31, max: 60,  label: '半身覆盖', desc: '连体裤或上身衣' },
            { value: 'full',     min: 61, max: 90,  label: '全身覆盖', desc: '连体衣（有开口）' },
            { value: 'sealed',   min: 91, max: 100, label: '完全密封', desc: '全封闭连体衣+头套，无任何开口' }
        ],
        LATEX_ENCLOSURE_CONFIG: {
            heatAccumPerTurn: 2,
            maxHeat: 50,
            sweatStartThreshold: 15,
            sweatSensitivityBonus: 0.3,
            overheatThreshold: 35,
            overheatAttrPenalty: { alert: -10, composure: -10 },
            sealedOxygenDrain: 3,
            soundSqueak: true,
            squeakStealthPenalty: 0.4
        },
        LATEX_HEAT_TIERS: [
            { value: 'cool',      min: 0,  max: 10,  label: '凉爽', color: '#22c55e' },
            { value: 'warm',      min: 11, max: 20,  label: '温热', color: '#84cc16' },
            { value: 'sweating',  min: 21, max: 30,  label: '出汗', color: '#eab308' },
            { value: 'hot',       min: 31, max: 40,  label: '闷热', color: '#f97316' },
            { value: 'overheat',  min: 41, max: 50,  label: '过热', color: '#ef4444' }
        ],
        LATEX_NARRATIVES: {
            heat: [
                '乳胶紧贴的皮肤下，汗液无处蒸发，形成一层滑腻的薄膜——每一次移动都伴随着湿滑的摩擦。',
                '密封的乳胶内体温持续攀升，皮肤在闷热中变得异常敏感，连空气的流动都能被放大感知。',
                '汗珠顺着乳胶内壁缓缓滑落，身体在自己制造的潮湿温室中越来越燥热。'
            ],
            touch_amplify: [
                '透过薄乳胶的触碰被奇妙地放大了——指尖的压力变成了覆盖整片皮肤的波动。',
                '乳胶将外部的每一个触点精确地传导到皮肤上，同时把它变成了一种弥散的、模糊了边界的压力。'
            ],
            touch_isolate: [
                '厚重的乳胶将外界的触碰变成了遥远而模糊的压力，仿佛隔着一层厚厚的水。',
                '透过多层乳胶，触碰只剩下迟钝的压感——温度、纹理、力度全部被吞噬。'
            ],
            squeak: [
                '乳胶在移动中发出清脆的吱嘎声，在安静的空间里格外响亮——每一个动作都在宣告你的存在。',
                '光滑的乳胶表面相互摩擦，发出特有的橡胶声响，让任何试图安静移动的努力都化为泡影。'
            ],
            sealed: [
                '全封闭的乳胶将身体与外界完全隔离——触觉、温度、气流全部被切断，只剩下自己的心跳和呼吸。',
                '密封的乳胶内，世界缩小到了皮肤与橡胶的接触面。没有风、没有温度变化，只有乳胶的紧致包裹和自身体温的持续上升。'
            ]
        },
        // ========== 汗液累积系统 (Sweat Accumulation) ==========
        LATEX_SWEAT_CONFIG: {
            maxSweat: 100,
            accumRate: 4,
            decayRate: 5,
            sensitivityBonusPerTier: 0.15,
            struggleSlipBonus: 0.08,
            squeakDampening: 0.3
        },
        LATEX_SWEAT_TIERS: [
            { value: 'dry',      min: 0,  max: 15,  label: '干燥',   color: '#94a3b8', desc: '乳胶内壁干燥贴合皮肤。' },
            { value: 'damp',     min: 16, max: 40,  label: '微汗',   color: '#06b6d4', desc: '薄薄一层汗液开始在乳胶与皮肤之间形成，触感变得微妙。' },
            { value: 'slick',    min: 41, max: 70,  label: '湿滑',   color: '#0ea5e9', desc: '汗液让乳胶内壁变得滑腻，皮肤在橡胶膜中微微滑动。' },
            { value: 'soaked',   min: 71, max: 90,  label: '浸透',   color: '#2563eb', desc: '汗水积聚成可感知的液层，乳胶内壁完全湿透，低处开始积液。' },
            { value: 'pooling',  min: 91, max: 100, label: '积水',   color: '#7c3aed', desc: '大量汗液在乳胶衣的低洼处汇集成小水洼，每次移动都能听到液体晃动声。' }
        ],
        LATEX_SWEAT_NARRATIVES: [
            '汗珠在乳胶内壁上缓慢滑落，画出一道看不见的湿痕——皮肤与橡胶之间多了一层温热的薄膜。',
            '密封的乳胶把每一滴汗都留在了里面——身体在自己分泌的水分中越来越滑。',
            '弯腰时能感觉到积聚的汗液在乳胶衣里重新分布，温热的液体沿着腹部滑向更低处。',
            '乳胶内壁已经完全湿透，皮肤在橡胶膜中微微打滑——每一个动作都带着黏腻的水声。',
            '汗液让乳胶贴合得更紧了——不是变松，而是那种湿吸效应让橡胶更加不愿离开皮肤。',
            '能感觉到脚趾在湿透的乳胶袜中滑动，汗液已经在靴子里积成了一小洼。'
        ],

        // ========== 乳胶气味系统 (Latex Scent) ==========
        LATEX_SCENT_NARRATIVES: {
            fresh: [
                '新乳胶特有的化学甜香弥漫在鼻腔——那种介于橡胶和药剂之间的气味，清晰而不可忽视。',
                '每次呼吸都吸入一口浓烈的新鲜乳胶味，那种刺鼻的甜腻让人微微头晕。'
            ],
            warm: [
                '体温加热了乳胶，释放出更浓郁的橡胶气味——温暖的、甜腻的、充满化学感的味道充满了每一次呼吸。',
                '升温的乳胶散发着加倍的橡胶气息，空气中弥漫着温热塑料般的甜味。'
            ],
            sweat_mixed: [
                '汗液和乳胶的气味混合在一起——咸湿的体味与橡胶的化学甜香交织成一种独特的、令人面红的味道。',
                '乳胶内的空气已经变得浑浊——汗味、体温和橡胶气息混合成一种密不透风的闷热气味。'
            ],
            sealed: [
                '全封闭的乳胶内，空气带着浓烈的橡胶味在有限的空间里循环——每一口呼吸都是纯粹的乳胶气息。',
                '密封环境里，乳胶的气味已经浓郁到几乎有了重量——它填满了鼻腔，渗入了意识。'
            ],
            degraded: [
                '缺乏保养的乳胶散发着一种酸涩的变质气味——老化的橡胶混合着陈旧汗渍的味道。',
                '粘腻的旧乳胶释放出刺鼻的化学降解气息，每次吸气都让人皱眉。'
            ]
        },

        // ========== 乳胶颜色系统 (Latex Color) ==========
        LATEX_COLORS: [
            { value: 'black',       label: '⬛ 黑色',   colorHex: '#1a1a2e', desc: '经典深黑，吸收光线，勾勒身体轮廓。', shameMod: 0, erosionMod: 0, stealthMod: 0 },
            { value: 'red',         label: '🟥 红色',   colorHex: '#dc2626', desc: '鲜艳夺目，极具视觉冲击力。', shameMod: 3, erosionMod: 0, stealthMod: -0.2 },
            { value: 'white',       label: '⬜ 白色',   colorHex: '#f1f5f9', desc: '纯净的白色，带有医疗/护理暗示。', shameMod: 2, erosionMod: 0, stealthMod: -0.1 },
            { value: 'pink',        label: '🩷 粉色',   colorHex: '#f472b6', desc: '娇嫩粉色，暗示服从与柔弱。', shameMod: 4, erosionMod: 0, stealthMod: 0 },
            { value: 'transparent', label: '🔍 透明',   colorHex: '#e2e8f0', desc: '完全透明的乳胶，皮肤纹理清晰可见却无法触碰。', shameMod: 8, erosionMod: 1, stealthMod: 0 },
            { value: 'metallic',    label: '🪞 金属银', colorHex: '#cbd5e1', desc: '镜面般的金属反光，将穿戴者变为无面的反射体。', shameMod: 3, erosionMod: 2, stealthMod: -0.3 },
            { value: 'purple',      label: '🟪 紫色',   colorHex: '#7c3aed', desc: '深邃的紫色，暗示权力与神秘。', shameMod: 2, erosionMod: 0, stealthMod: 0 },
            { value: 'custom',      label: '🎨 自定义', colorHex: '#94a3b8', desc: '自定义颜色。', shameMod: 0, erosionMod: 0, stealthMod: 0 }
        ],
        LATEX_COLOR_NARRATIVES: {
            transparent: [
                '透明的乳胶将身体的每一处细节都暴露在外——皮肤的颜色、毛孔、甚至因羞耻而泛红的肤色都被忠实地呈现，却隔着一层光滑的屏障无法触碰。',
                '在透明乳胶的包裹下，身体像被封存在琥珀中的标本——看得见、看得清，却永远无法直接接触。'
            ],
            metallic: [
                '镜面般的银色乳胶将身体变为一个无面的反射体——在它光滑的表面上看到的不是人，而是周围世界扭曲的倒影。',
                '金属质感的乳胶在每个角度都折射出不同的光泽，穿戴者变成了一件活动的雕塑——没有面孔，没有身份，只有形状。'
            ],
            red: [
                '鲜红的乳胶在光线下如同流动的血液般夺目——每一个动作都在视野中留下抢眼的红色弧线。',
                '红色乳胶将身体包裹成一件醒目的艺术品——这种颜色不允许低调，不允许被忽视。'
            ],
            pink: [
                '粉色乳胶赋予了一种矛盾的天真感——光滑的粉色表面包裹着被约束的身体，可爱与屈辱奇异地并存。'
            ]
        },

        // ========== 乳胶拉链/开口系统 (Latex Openings) ==========
        LATEX_OPENING_TYPES: [
            { value: 'mouth',   label: '👄 口部',  coverageMod: -3, desc: '口部开口/拉链' },
            { value: 'crotch',  label: '🔓 裆部',  coverageMod: -4, desc: '裆部拉链/开口' },
            { value: 'rear',    label: '🔓 后部',  coverageMod: -3, desc: '臀部拉链/开口' },
            { value: 'breast',  label: '⭕ 胸部',  coverageMod: -3, desc: '胸部开口' },
            { value: 'eyes',    label: '👁️ 眼部', coverageMod: -2, desc: '眼部开口/透明窗' }
        ],
        LATEX_OPENING_STATES: {
            open:   { label: '开放', coverageActive: true,  accessible: true },
            zipped: { label: '拉合', coverageActive: false, accessible: false },
            locked: { label: '锁定', coverageActive: false, accessible: false, needsKey: true }
        },

        // ========== 真空/充气系统 (Vacuum & Inflation) ==========
        VACUUM_INFLATION_TYPES: [
            { value: 'vacuum_bed',    label: '🛏️ 真空床',    immobilize: true,  deprivation: 3, desc: '两层乳胶膜之间抽成真空，身体被均匀压力完全固定' },
            { value: 'vacuum_cube',   label: '📦 真空箱',    immobilize: true,  deprivation: 4, desc: '封闭在乳胶内衬的箱体中，抽真空后完全失去活动空间' },
            { value: 'inflate_gag',   label: '🎈 充气口塞',  slot: 'mouth',     maxLevel: 5, desc: '口腔内的气囊逐级膨胀，逐步填满口腔空间' },
            { value: 'inflate_plug',  label: '🎈 充气塞',    slot: 'anal',      maxLevel: 5, desc: '体内气囊逐级膨胀，填充感随级别递增' },
            { value: 'inflate_suit',  label: '🎈 充气衣',    immobilize: false, desc: '衣内充气层膨胀，身体被气垫包裹，活动受限但有缓冲' },
            { value: 'inflate_hood',  label: '🎈 充气头套',  deprivation: 2, desc: '头套内层充气收紧，逐步压迫头部，加强感官隔绝' },
            { value: 'sleepsack',     label: '🛌 乳胶睡袋', immobilize: false, desc: '紧致的乳胶睡袋包裹全身，允许有限蠕动但无法自行脱出，可搭配内置振动器和充气衬垫' }
        ],
        INFLATION_CONFIG: {
            maxLevel: 5,
            levelDescriptions: {
                1: '轻微膨胀，刚能感觉到存在感',
                2: '明显填充感，开始有压迫感',
                3: '填满了大部分空间，难以忽视',
                4: '极度饱满，下颚/身体被迫撑开',
                5: '到达极限，承受巨大压力，无法发出任何声音'
            }
        },
        // ========== PetPlay 系统 ==========
        PETPLAY_ROLES: [
            { value: 'puppy',   label: '🐶 小狗',   equipment: ['collar', 'tail_plug', 'paw_mitts', 'ears', 'muzzle'], rules: ['no_speak', 'all_fours', 'follow_master'] },
            { value: 'kitten',  label: '🐱 小猫',   equipment: ['collar', 'tail_plug', 'paw_mitts', 'ears', 'bell'], rules: ['no_speak', 'graceful_movement'] },
            { value: 'bunny',   label: '🐰 兔子',   equipment: ['collar', 'tail_plug', 'ears', 'paw_mitts'], rules: ['no_speak', 'hop_only'] },
            { value: 'pony',    label: '🐴 小马',   equipment: ['bridle', 'bit_gag', 'harness', 'tail_plug', 'hoof_boots', 'plume'], rules: ['no_speak', 'high_step', 'respond_to_reins'] },
            { value: 'cow',     label: '🐄 奶牛',   equipment: ['collar', 'bell', 'harness', 'tail_plug', 'nose_ring'], rules: ['no_speak', 'docile'] }
        ],
        PETPLAY_CONFIG: {
            immersionPerTurn: 3,
            maxImmersion: 100,
            breakImmersionPenalty: 15,
            speakPenalty: 20,
            immersionBonus: { shame: -2, obedience: 1 }
        },
        PETPLAY_IMMERSION_TIERS: [
            { value: 'resistant',  min: 0,  max: 20,  label: '抗拒', desc: '内心抗拒角色扮演，动作僵硬不自然。' },
            { value: 'awkward',    min: 21, max: 40,  label: '别扭', desc: '勉强配合但仍会不自觉地做出人类动作。' },
            { value: 'adapting',   min: 41, max: 60,  label: '适应中', desc: '开始习惯用四肢移动和非语言交流。' },
            { value: 'immersed',   min: 61, max: 80,  label: '沉浸', desc: '自然地以宠物方式行动，人类习惯逐渐模糊。' },
            { value: 'deep',       min: 81, max: 100, label: '深层沉浸', desc: '完全进入角色，思维模式开始向宠物靠拢，人类身份感淡化。' }
        ],
        PETPLAY_NARRATIVES: {
            puppy: [
                '四肢着地移动时，世界的视角彻底改变了——所有东西都变得高大，而你的目光只能及到别人的膝盖。',
                '想要表达什么的冲动涌上喉头，但口中的口套只允许发出模糊的呜咽——语言正在被身体遗忘。'
            ],
            kitten: [
                '蜷缩成一团时，身体自然地找到了最舒适的曲线——像是本能记住了猫的睡姿。',
                '脖子上的铃铛在每次动作时发出清脆的声响，时刻提醒着你现在的身份。'
            ],
            pony: [
                '口中的衔铁随着缰绳的拉扯传来精确的指令——向左、向右、停下。身体在不知不觉中学会了回应。',
                '蹄靴迫使脚掌保持绷直的角度，走路时必须高抬膝盖——这是标准的小马步态，偷懒会换来鞭子的提醒。'
            ],
            cow: [
                '沉重的铃铛在胸前摆动，每走一步都发出低沉的叮当声——像是在牧场里缓缓移动的家畜。',
                '鼻环轻轻被拉扯的时候，身体条件反射般跟着移动——反抗的想法被鼻尖的疼痛提前打消。'
            ]
        },
        // ========== 家具化系统 (Furniture Play) ==========
        FURNITURE_ROLES: [
            { value: 'table',      label: '🪑 桌子',   posture: 'table',     endurancePerTurn: 3, desc: '四肢着地，背部保持水平——承载物品的重量是你存在的唯一价值。' },
            { value: 'footstool',  label: '🦶 脚凳',   posture: 'footstool', endurancePerTurn: 2, desc: '蜷缩成矮凳形状——背上承受脚的重量，保持绝对静止。' },
            { value: 'coat_rack',  label: '🧥 衣架',   posture: 'coat_rack', endurancePerTurn: 4, desc: '双臂伸展不动——挂上物品后不得晃动，否则物品掉落即受罚。' },
            { value: 'lamp',       label: '💡 灯架',   posture: 'lamp',      endurancePerTurn: 5, desc: '高举光源不得放下——手臂酸痛不是理由，家具不会喊累。' },
            { value: 'display',    label: '🖼️ 展品',   posture: 'standing',  endurancePerTurn: 2, desc: '在指定位置保持完美姿势——作为装饰品供人欣赏。' },
            { value: 'seat',       label: '💺 座椅',   posture: 'kneeling',  endurancePerTurn: 4, desc: '以跪姿承受主人的体重——任何动摇都会受到惩罚。' }
        ],
        FURNITURE_CONFIG: {
            maxEndurance: 100,
            shakeThreshold: 70,
            collapsePenalty: { obedience: -15, pain: 20, shame: 15 },
            perfectBonus: { obedience: 5, fondness: 3 }
        },
        // ========== 乳胶层叠系统 (Latex Layering) ==========
        LATEX_LAYER_CONFIG: {
            maxLayers: 4,
            layerHeatExponent: 1.5,
            touchIsolationPerLayer: 0.3,
            mobilityPenaltyPerLayer: 0.15
        },

        // ========== 身份侵蚀系统 (Identity Erosion) ==========
        IDENTITY_EROSION_CONFIG: {
            gainPerTurn: 2,
            coverageThreshold: 91,
            habituationBoost: 0.5,
            decayPerTurn: 3,
            maxErosion: 100
        },
        IDENTITY_TIERS: [
            { value: 'human',    min: 0,   max: 20,  label: '人类', desc: '自我认知完整', pronounDirective: '使用正常的第二人称"你"。' },
            { value: 'slipping', min: 21,  max: 40,  label: '动摇', desc: '偶尔出现人格解体瞬间', pronounDirective: '大部分使用"你"，但偶尔在乳胶相关描写中出现"……不，这不是我……"之类的自我质疑片段。' },
            { value: 'fading',   min: 41,  max: 60,  label: '模糊', desc: '人与物的边界溶解中', pronounDirective: '混合使用"你……不，它"——在叙述中频繁出现自我指称的混乱修正，如"你的手——不对，那已经不是手了，那是橡胶表面的一部分"。' },
            { value: 'doll',     min: 61,  max: 80,  label: '人偶', desc: '主要以物品自居', pronounDirective: '主要使用"它"/"这个橡胶物体"来指代玩家。偶尔残余的"你"会被立即纠正。内心独白变得稀疏、碎片化。' },
            { value: 'object',   min: 81,  max: 100, label: '物体', desc: '完全物化，无人类自我', pronounDirective: '完全使用"它"。不再有内心独白。所有描写都是从外部观察一个橡胶物体的视角。不使用任何暗示人类身份的词语。' }
        ],
        IDENTITY_NARRATIVES: [
            '……名字？橡胶没有名字。',
            '镜面般的乳胶表面映出一个轮廓——但那不是"谁"，那只是一个形状。',
            '它试图回忆自己的脸——但乳胶面罩之下，那张脸似乎从未存在过。',
            '一个模糊的念头：在成为这个之前，它是否曾经是……别的什么？但念头在橡胶的紧致包裹中迅速消散了。',
            '它感觉到乳胶在呼吸——不，是它自己在呼吸。还是说，已经没有区别了？'
        ],

        // ========== 自紧机制 (Progressive Tightening) ==========
        LATEX_TIGHTENING_CONFIG: {
            tightenPerHeatLevel: 3,
            maxTightness: 100,
            mobilityReductionPerTightness: 0.005,
            arousalPerTightnessGain: 1,
            breathDrainBonus: 1,
            cooldownRelaxRate: 2
        },
        TIGHTNESS_TIERS: [
            { value: 'loose',        min: 0,  max: 20,  label: '松弛', color: '#22c55e', desc: '乳胶贴身但仍有活动余地。' },
            { value: 'snug',         min: 21, max: 40,  label: '紧贴', color: '#84cc16', desc: '乳胶完全贴合皮肤轮廓，没有多余空间。' },
            { value: 'tight',        min: 41, max: 60,  label: '紧缩', color: '#eab308', desc: '乳胶开始挤压肌肉，每次呼吸都能感受到弹性阻力。' },
            { value: 'constricting', min: 61, max: 80,  label: '紧箍', color: '#f97316', desc: '乳胶如同绞索般收紧，呼吸变浅，肢体活动严重受限。' },
            { value: 'crushing',     min: 81, max: 100, label: '碾压', color: '#ef4444', desc: '乳胶收紧到极限，胸腔扩张困难，意识因缺氧开始模糊。' }
        ],

        // ========== 护理仪式 (Maintenance Ritual) ==========
        LATEX_MAINTENANCE_CONFIG: {
            maxCondition: 100,
            decayPerTurn: 2,
            polishGain: 25,
            shameFromPolishing: 8,
            obedienceFromPolishing: 5
        },
        MAINTENANCE_EFFECTS: {
            high:   { squeakMult: 0.5, frictionMult: 0.8, desc: '完美光泽——乳胶表面如镜面般反射光线。' },
            medium: { squeakMult: 1.0, frictionMult: 1.0, desc: '正常状态——乳胶表面有些许指纹和痕迹。' },
            low:    { squeakMult: 1.5, frictionMult: 1.3, desc: '缺乏保养——乳胶变得粘腻，摩擦声刺耳，表面暗淡无光。' },
            poor:   { squeakMult: 2.0, frictionMult: 1.6, desc: '严重失养——乳胶开始粘连皮肤，每次移动都伴随着撕扯般的阻力。' }
        },
        MAINTENANCE_NARRATIVES: [
            '手掌覆上乳胶表面，涂抹光亮剂——指尖下的橡胶从粘涩变为顺滑，每一次擦拭都像是一种服务性的抚摸。',
            '抛光布在乳胶上画着圈，光泽从暗哑中浮现——像是在揭示一件艺术品本来的面貌。',
            '双手沿着曲线缓慢推进，光亮剂在体温和摩擦下升温——护理的过程本身就是一种令人脸红的亲密。'
        ],

        // ========== 呼吸管控制 (Breathing Tube Control) ==========
        BREATHING_TUBE_CONFIG: {
            flowLevels: {
                full:       { oxygenRate: 0,   label: '🟢 全流量', desc: '呼吸管完全打开，空气自由流通。' },
                restricted: { oxygenRate: -3,  label: '🟡 限流', desc: '呼吸管半开，每次呼吸需要额外用力。' },
                minimal:    { oxygenRate: -6,  label: '🟠 微量', desc: '呼吸管仅开一线，空气稀薄，每次呼吸都是挣扎。' },
                blocked:    { oxygenRate: -10, label: '🔴 阻断', desc: '呼吸管完全关闭，无空气进入。' }
            }
        },
        TUBE_NARRATIVES: {
            full:       ['空气通过狭窄的管道流入——虽然充足，但每一口呼吸都提醒着：这是唯一的生命线。'],
            restricted: ['呼吸管变窄了——胸腔更用力地起伏，每一口空气都不够深，不够满足。', '受限的气流让呼吸变成了一种需要专注的工作——吸……呼……不能急。'],
            minimal:    ['仅剩的一丝空气像是通过针孔在渗透——每一次呼吸都带着窒息的恐惧。', '世界在缺氧中变得遥远而模糊，唯一清晰的只有——呼吸。'],
            blocked:    ['气流断绝。胸腔剧烈起伏却什么也吸不到——恐慌开始蔓延。']
        },

        // ========== 导电乳胶 (Electro-Conductive Latex) ==========
        ELECTRO_LATEX_CONFIG: {
            zones: [
                { value: 'chest',    label: '胸部',   sensitivity: 1.5 },
                { value: 'abdomen',  label: '腹部',   sensitivity: 1.0 },
                { value: 'thighs',   label: '大腿内侧', sensitivity: 1.8 },
                { value: 'groin',    label: '胯部',   sensitivity: 2.5 },
                { value: 'buttocks', label: '臀部',   sensitivity: 1.3 },
                { value: 'back',     label: '背部',   sensitivity: 0.8 },
                { value: 'limbs',    label: '四肢',   sensitivity: 0.6 }
            ],
            intensityLevels: [
                { value: 'tingle',  label: '微刺', arousalMult: 0.5,  painMult: 0,   desc: '几乎察觉不到的微弱电流，像蚂蚁在皮肤上爬。' },
                { value: 'pulse',   label: '脉冲', arousalMult: 1.0,  painMult: 0.3, desc: '有节奏的电脉冲，肌肉不由自主地跟随节律微微跳动。' },
                { value: 'strong',  label: '强烈', arousalMult: 1.5,  painMult: 0.8, desc: '强烈的电流让肌肉痉挛收缩，快感与痛苦难以分辨。' },
                { value: 'max',     label: '极限', arousalMult: 2.0,  painMult: 1.5, desc: '电流达到极限，全身肌肉失控抽搐，意识在白光中闪烁。' }
            ],
            patternTypes: [
                { value: 'constant', label: '持续',   desc: '恒定电流不间断。' },
                { value: 'pulse',    label: '脉冲',   desc: '规律的开关交替。' },
                { value: 'wave',     label: '波浪',   desc: '强度渐增渐减。' },
                { value: 'random',   label: '随机',   desc: '不可预测的强度和间隔。' }
            ],
            baseArousalPerTurn: 3
        },
        ELECTRO_NARRATIVES: {
            tingle: [
                '乳胶之下，微弱的电流如蚁群行走般掠过皮肤——不痛，但让每一寸神经都保持着紧张的警觉。',
                '若有若无的电刺激在皮肤表面蔓延，像是乳胶本身在呢喃。'
            ],
            pulse: [
                '电脉冲精确地击中目标——肌肉在每一次脉冲中不由自主地跳动，身体在乳胶内随节奏微微颤抖。',
                '规律的电流像第二个心跳——每一次脉动都从接触点扩散开来，带来无法忽视的存在感。'
            ],
            strong: [
                '强烈的电流穿过乳胶直击深层肌肉——身体弓起，在束缚中痉挛。快感与痛苦混为一体。',
                '电流强度飙升——每一条肌肉纤维都在同时收缩，身体在乳胶内失去了自主控制。'
            ],
            max: [
                '极限电流瞬间贯穿全身——视野化为白光，意识在电击中碎裂又重组。只剩下身体在乳胶中的剧烈抽搐。',
                '世界消失了。只有电流。只有橡胶内无法逃避的、将一切思维烧成灰烬的电流。'
            ]
        },

        // ========== 恐慌/幽闭恐惧系统 (Panic / Claustrophobia) ==========
        PANIC_CONFIG: {
            maxPanic: 100,
            sealedGainPerTurn: 3,
            lowOxygenGainPerTurn: 5,
            deprivationGainPerTurn: 2,
            firstEnclosureSpike: 25,
            decayPerTurn: 4,
            tubeFullDecayBonus: 3,
            npcSootheDecay: 10,
            habituationReduceFactor: 0.5,
            panicAttrPenalty: { alert: -5, composure: -15 },
            panicStruggleBonus: 0.2,
            panicOxygenDrain: 2
        },
        PANIC_TIERS: [
            { value: 'calm',      min: 0,  max: 20,  label: '平静',   color: '#22c55e', desc: '情绪稳定，能理性应对当前处境。' },
            { value: 'uneasy',    min: 21, max: 40,  label: '不安',   color: '#84cc16', desc: '隐约的焦虑感，呼吸开始不自觉加快。' },
            { value: 'anxious',   min: 41, max: 60,  label: '紧张',   color: '#eab308', desc: '明显的恐惧感，心跳加速，肌肉紧绷，开始产生逃脱冲动。' },
            { value: 'panicked',  min: 61, max: 80,  label: '恐慌',   color: '#f97316', desc: '恐慌发作中——理性思维崩溃，身体开始不受控制地挣扎。' },
            { value: 'meltdown',  min: 81, max: 100, label: '失控',   color: '#ef4444', desc: '完全失控——尖叫、剧烈挣扎、过度换气，所有高级认知功能停摆。' }
        ],
        PANIC_NARRATIVES: [
            '空间在缩小——不，是感觉在缩小。乳胶的包裹突然从"紧致"变成了"囚笼"，心跳猛地加速了。',
            '一阵无法控制的恐惧从胸腔深处涌上来——想逃，想挣脱，但身体被牢牢束缚，无处可逃的事实只让恐慌更加剧烈。',
            '呼吸变得又快又浅——不是因为缺氧，而是因为大脑在尖叫"离开这里"，但乳胶不允许。',
            '指尖在乳胶内不受控制地颤抖，冷汗混合着热汗——身体陷入了战斗或逃跑反应，却既无法战斗也无法逃跑。',
            '一种被活埋般的窒息感笼罩了意识——即使呼吸管还在送入空气，但密封的黑暗和乳胶的无处不在让恐惧压过了理性。',
            '心脏在胸腔里疯狂跳动，能感觉到脉搏在乳胶紧贴的每一处皮肤上搏动——恐慌让身体变成了一面鼓。'
        ],

        // ========== 液态乳胶系统 (Liquid Latex) ==========
        LIQUID_LATEX_CONFIG: {
            cureTimeDesc: '涂抹后需等待5-10分钟固化成膜',
            struggleResistMult: 0.1,
            removalMethod: 'solvent',
            removalDesc: '只能通过专用溶剂溶解移除，挣扎完全无效'
        },
        LIQUID_LATEX_NARRATIVES: [
            '温热的液态乳胶从容器中倒出，浓稠的胶液缓慢流淌过皮肤——每一寸接触都带来一阵凉意，随即被体温暖化。',
            '刷子将液态乳胶均匀涂抹开来，薄薄的胶膜紧贴皮肤上的每一个毛孔——固化后它将成为身体不可分割的一部分。',
            '液态乳胶正在皮肤上缓慢固化——从湿润黏腻逐渐变为光滑紧致，那种"被封印"的感觉随着胶膜变硬而越来越强烈。',
            '没有拉链，没有接缝，没有任何脱出的可能——固化的液态乳胶与皮肤融为一体，只有溶剂才能将它们分离。',
            '每一层新涂抹的液态乳胶都让束缚更紧一分——它不像穿戴式乳胶那样有弹性余地，而是精确地复制了身体此刻的形状。'
        ],

        // ========== 装备联动姿势系统 (Compound Posture / Gait) ==========
        EQUIP_POSTURE_TAGS: [
            { value: 'forces_upright',        label: '🔒 强制挺直', desc: '脊柱被锁定在直立位置，无法弯腰弓背', examples: '姿势项圈、硬质束腰' },
            { value: 'forces_tiptoe',         label: '👠 强制踮脚', desc: '脚掌被迫绷直，只能以脚尖支撑', examples: '芭蕾靴、蹄靴' },
            { value: 'restricts_bending',     label: '🚫 限制弯腰', desc: '躯干无法前屈或侧弯', examples: '硬质胸衣、钢制腰封' },
            { value: 'restricts_knee_bend',   label: '🦵 限制屈膝', desc: '膝关节被固定或严重受限', examples: '腿部夹板、长筒蹒跚裙' },
            { value: 'restricts_arm_movement',label: '💪 限制手臂', desc: '上肢活动被完全或大部分限制', examples: '单手套、拘束衣' },
            { value: 'restricts_stride',      label: '🚶 限制步幅', desc: '每步只能迈出很小距离', examples: '蹒跚裙、脚踝链' },
            { value: 'forces_head_position',  label: '👤 固定头位', desc: '头部被锁定，无法自由转动或低头', examples: '姿势项圈、头部挽具' },
            { value: 'restricts_head_turn',   label: '🔄 限制转头', desc: '颈部被固定，头部无法左右转动', examples: '硬质姿势项圈、颈部夹板' },
            { value: 'restricts_head_nod',    label: '↕️ 限制点摇头', desc: '无法点头或摇头，切断了这种最基本的非语言沟通', examples: '高姿势项圈、颈部支撑架' },
            { value: 'restricts_sitting',     label: '🪑 限制坐姿', desc: '坐下变得痛苦或不可能', examples: '肛塞尾巴、硬质臀甲' },
            { value: 'restricts_lying',       label: '🛏️ 限制躺姿', desc: '某些躺姿变得不可能', examples: '后手单手套、姿势项圈' },
            { value: 'restricts_fingers',     label: '🤞 限制手指', desc: '手指被约束在特定姿态，无法自由活动', examples: '手指分离器、拳套' }
        ],
        GAIT_TYPES: [
            { value: 'normal',    label: '正常步态',   speedMod: 1.0,  fallChance: 0,    desc: '自然行走，无任何阻碍。', narratives: [] },
            { value: 'careful',   label: '⚠️ 谨慎步态', speedMod: 0.8,  fallChance: 0.02, desc: '小心翼翼地行走，每一步都格外注意平衡。', narratives: ['每一步都需要额外的注意力——身体在约束中寻找新的平衡点。'] },
            { value: 'mincing',   label: '👣 碎步',     speedMod: 0.5,  fallChance: 0.05, desc: '被迫以极小的步幅前进，步态刻意而拘谨。', narratives: ['蹒跚裙将每一步压缩到几厘米——移动变成了一种缓慢的、优雅到残忍的仪式。', '小碎步在安静的空间里发出急促的嗒嗒声——像是一只被束缚了翅膀的鸟。'] },
            { value: 'hobbling',  label: '🦿 蹒跚',     speedMod: 0.3,  fallChance: 0.08, desc: '膝盖和步幅双重受限，只能艰难地挪动。', narratives: ['双腿在束缚中艰难地交替——与其说是走路，不如说是在原地挣扎。', '每一步都是一次微型的平衡考验——裙摆紧裹双腿，膝盖无法弯曲，只能以髋部带动整条腿向前摆。'] },
            { value: 'tottering', label: '🩰 摇晃踮脚', speedMod: 0.25, fallChance: 0.12, desc: '踮着脚尖摇摇欲坠，身体在直立约束中颤抖。', narratives: ['芭蕾靴的脚尖在光滑的地面上微微打滑——束腰强迫身体挺直，每一次晃动都是一次心跳加速。', '在束腰和高跟的双重夹击下，身体变成了一根随时可能倾倒的蜡烛。'] },
            { value: 'helpless',  label: '⛓️ 无助',     speedMod: 0.1,  fallChance: 0.18, desc: '多重约束叠加，几乎丧失自主移动能力。', narratives: ['移动？在这种状态下，"移动"这个词已经失去了意义。每一寸位移都是与全身束缚的搏斗。', '身体在层层约束中只能做出最微小的调整——不是行走，是挣扎。'] },
            { value: 'immobile',  label: '🔒 完全不动', speedMod: 0.0,  fallChance: 0,    desc: '约束组合已完全剥夺移动能力。', narratives: ['身体被约束锁定在原地——不是不想动，是真的、完全地、无法动弹。'] }
        ],
        POSTURE_BLOCKERS: {
            forces_upright:      ['prone', 'ball_tie', 'crouching', 'bent_over', 'frogtie', 'pet_down', 'footstool'],
            restricts_bending:   ['crouching', 'ball_tie', 'frogtie', 'bent_over', 'pet_down', 'footstool', 'table'],
            restricts_knee_bend: ['kneeling', 'crouching', 'frogtie', 'pet_sit', 'all_fours', 'pet_beg', 'table', 'footstool'],
            forces_tiptoe:       ['kneeling', 'prone', 'pet_sit', 'all_fours', 'pet_down', 'footstool', 'table'],
            restricts_sitting:   ['sitting', 'pet_sit', 'footstool'],
            restricts_lying:     ['supine', 'prone', 'pet_down'],
            restricts_arm_movement: [],
            restricts_stride:    [],
            forces_head_position: []
        },
        GAIT_TAG_WEIGHTS: {
            forces_tiptoe: 2,
            restricts_stride: 2,
            forces_upright: 1,
            restricts_knee_bend: 1.5,
            restricts_bending: 0.5,
            restricts_arm_movement: 0.3,
            forces_head_position: 0.2,
            restricts_sitting: 0,
            restricts_lying: 0
        },
        COMPOUND_POSTURE_NARRATIVES: {
            forced_standing: '多重约束的组合只留下了唯一的可能——直立。束腰锁住躯干，裙摆锁住双腿，靴子锁住脚踝——身体被精确地固定在站立姿态中。',
            forced_transition: '当前姿势已不再可能——约束组合迫使身体调整到新的位置。',
            fall_warning: '身体在不稳定的约束中摇晃——一个不小心就会失去平衡。',
            fall_event: '平衡终于崩溃——身体在约束中无法做出任何保护动作，只能任由重力接管。'
        },

        // ========== 口塞 / 强制张口系统 (Gag / Forced Open Mouth) ==========
        GAG_TYPES: [
            { value: 'ball_gag',    label: '🔴 口球',     forcedOpen: false, muffleLevel: 3, desc: '球体填满口腔，允许嘴唇勉强合拢但无法发出清晰语音。' },
            { value: 'ring_gag',    label: '⭕ 开口器',   forcedOpen: true,  muffleLevel: 2, desc: '金属/橡胶环卡在齿列间，强制口腔保持圆形张开，无法闭合嘴唇。' },
            { value: 'spider_gag',  label: '🕷️ 蜘蛛口枷', forcedOpen: true,  muffleLevel: 2, desc: '带四爪的钢制口枷，钩爪固定在牙齿后方，强制下颌最大限度张开。' },
            { value: 'bit_gag',     label: '🐴 衔铁',     forcedOpen: false, muffleLevel: 2, desc: '横杆穿过口腔两侧固定，嘴唇可勉强合拢但下颌活动严重受限。' },
            { value: 'panel_gag',   label: '🟫 面板口塞', forcedOpen: false, muffleLevel: 5, desc: '外覆面板完全遮盖口部区域，内部填充物塞满口腔，声音几乎完全消失。' },
            { value: 'funnel_gag',  label: '🫗 漏斗口塞', forcedOpen: true,  muffleLevel: 1, desc: '管状装置强制口腔张开并外接漏斗，口腔完全暴露，可被灌入液体。' },
            { value: 'pump_gag',    label: '🎈 充气口塞', forcedOpen: false, muffleLevel: 4, desc: '口腔内的气囊逐级膨胀，渐进式填满所有空间，充满后连呻吟都被压缩。' },
            { value: 'dental_gag',  label: '🦷 牙科开口器', forcedOpen: true, muffleLevel: 1, desc: '医用牙科器械将上下颌撑到极限，口腔内部完全暴露，连吞咽都极度困难。' },
            { value: 'cleave_gag',  label: '🧣 勒口布',   forcedOpen: false, muffleLevel: 2, desc: '布条从牙齿间勒入并在脑后系紧，嘴唇被迫微张但未完全撑开。' },
            { value: 'oral_sheath', label: '👄 模拟口腔套', forcedOpen: true,  suppressDrool: true, muffleLevel: 1, compatible: ['penis_gag', 'funnel_gag', 'dental_gag'], desc: '完全复刻人类真实口腔的乳胶内衬装置。精密模拟舌面、上颚纹理、牙龈弹性和喉部深度，内壁以医用级乳胶一体成型。装置将口腔强制撑开并固定在张口位置，同时内置微型导流管网将唾液引流至咽喉后部自动吞咽，彻底杜绝流口水。可作为基座与阳具口塞、漏斗口塞等需要张口的设备无缝嵌套使用。' }
        ],
        DROOL_CONFIG: {
            accumPerTurn: 5,
            maxDrool: 100,
            shamePerDrool: 0.5,
            naturalSwallow: 3,
            messThreshold: 30,
            heavyThreshold: 70
        },
        DROOL_NARRATIVES: [
            '又一缕口水不受控制地从嘴角滑落，在下巴处汇聚成亮晶晶的细线，悬挂片刻后滴落。',
            '被强制张开的口腔已经无法执行吞咽——唾液在重力的邀请下自由流淌，浸湿了下巴和胸口。',
            '舌头暴露在外，口水沿着舌尖汇聚、拉丝、坠落——这个过程完全超出了意志的控制范围。',
            '嘴角的口水已经连成不断的线，每一个微小的头部移动都会让液体的流向发生变化。',
            '胸前的衣物/皮肤上已经出现了明显的潮湿区域——来自无法控制的、持续不断的涎液。',
            '试图用舌头挡住口水的流出，但被撑开的嘴让这个努力毫无意义——液体照旧溢出。'
        ],

        // ========== 耳部装置系统 ==========
        EAR_DEVICE_TYPES: [
            { value: 'earplug',          label: '🔇 耳塞',       mode: 'silence',         desc: '软质/硬质耳塞深入耳道，将外界声音完全隔绝——世界变得死寂。' },
            { value: 'noise_cancel',     label: '🎧 降噪耳机',   mode: 'silence',         desc: '主动降噪耳机覆盖双耳，电子消噪将一切环境音抹除干净。' },
            { value: 'controller_only',  label: '📡 单向耳机',   mode: 'controller_only', desc: '内置通讯模块的耳机——只有控制者的声音能穿透沉默，其余一切被屏蔽。' },
            { value: 'white_noise',      label: '📻 白噪声耳机', mode: 'silence',         desc: '持续播放白噪声/粉红噪声，将外界声音彻底淹没。' },
            { value: 'music_only',       label: '🎵 音乐耳机',   mode: 'silence',         desc: '循环播放预设音乐，外界声音被完全覆盖。' },
            { value: 'passthrough',      label: '🔊 通透耳机',   mode: 'passthrough',     desc: '通透模式耳机，声音正常传入——但随时可能被远程切换为静音。' }
        ],
        EAR_DEVICE_MODES: {
            silence:         { deaf: true,  hearController: false, label: '完全静音', desc: '完全听不到任何声音' },
            controller_only: { deaf: true,  hearController: true,  label: '仅听控制者', desc: '只能听到控制者的声音，其余一切静默' },
            passthrough:     { deaf: false, hearController: true,  label: '通透/不静音', desc: '声音正常传入' }
        },
        EAR_DEVICE_NARRATIVES: [
            '耳中的装置将世界压缩成一片真空——没有声音，没有方向感，只剩自己的心跳和血液流动的声响。',
            '被隔绝的听觉让其他感官变得异常敏锐——皮肤上的每一丝触感都被放大了数倍。',
            '在无声的世界中，振动成为唯一的"声音"——地板的震动、身体的颤抖，都变成了信息来源。',
            '完全的寂静让时间感模糊——无法通过声音判断周围发生了什么，不安感持续攀升。',
            '控制者的声音是唯一能穿透沉默的存在——它因此获得了一种近乎绝对的权威感。',
            '试图通过喊叫来确认自己还活着，但听不到自己的声音——这种错位感令人眩晕。'
        ],

        // ========== 手指约束系统 ==========
        FINGER_RESTRAINT_TYPES: [
            { value: 'fist_mitt',    label: '✊ 拳套',     shape: 'fist',   desc: '手指被强制握紧成拳，包裹在厚实的拳套中——完全丧失抓握和精细操作能力。' },
            { value: 'paddle_mitt',  label: '🖐️ 掌形手套', shape: 'flat',   desc: '手指被强制伸展并排，固定在平板手套中——手掌变成无用的扁平桨状物。' },
            { value: 'finger_spread',label: '🖖 手指分离器',shape: 'spread', desc: '每根手指被金属/橡胶分隔器隔开，无法并拢或弯曲。' },
            { value: 'finger_tube',  label: '🧤 指管约束', shape: 'tube',   desc: '每根手指被独立的硬质管套包裹，手指笔直僵硬，无法弯曲关节。' },
            { value: 'prayer_bind',  label: '🙏 合掌束缚', shape: 'prayer', desc: '双手被强制合十固定，手指交错锁定——如同永恒的祈祷姿态。' }
        ],
        FINGER_SHAPE_EFFECTS: {
            fist:   { canGrip: false, canTouch: false, canType: false, canGesture: false, label: '握拳', desc: '手指紧握成拳，无法打开；无法抓取、触摸或做手势' },
            flat:   { canGrip: false, canTouch: true,  canType: false, canGesture: false, label: '掌形', desc: '手指展平并排，可以触碰但无法抓握或做精细动作' },
            spread: { canGrip: false, canTouch: true,  canType: false, canGesture: false, label: '分开', desc: '手指被强制分开，无法并拢或抓握' },
            tube:   { canGrip: false, canTouch: true,  canType: false, canGesture: false, label: '管束', desc: '手指笔直僵硬，无法弯曲，只能以指尖戳触' },
            prayer: { canGrip: false, canTouch: false, canType: false, canGesture: false, label: '合掌', desc: '双手合十锁死，手指完全无法使用' }
        },
        FINGER_NARRATIVES: [
            '被困在拳套里的手指本能地想要舒展，但厚实的材料将它们牢牢压在掌心。',
            '手指被平展固定——想要拿起任何东西都变成了不可能完成的任务。',
            '指尖的触感还在，但手指无法弯曲——只能用笨拙的掌面去感受世界。',
            '手指的无力感蔓延到全身——最精密的工具被封印了，连最简单的操作都做不到。',
            '被约束的手指间传来细微的麻木感——血液循环在限制中变得不畅。'
        ],

        // ========== 头颈约束叙事 ==========
        HEAD_NECK_NARRATIVES: [
            '姿势项圈将脖子锁在严格的直立位置——想要转头查看四周已经变成了奢望。',
            '无法点头，无法摇头——最基本的"是"与"不"的表达方式也被剥夺了。',
            '颈部被完全固定，只能用眼球的移动来追踪视野内的动静。',
            '僵硬的项圈让每一次吞咽都变得格外明显——喉结的起伏被硬质材料放大。',
            '想要回头看一眼身后——但颈部纹丝不动，身体必须整个转向才行。'
        ],

        // ========== 多层记忆系统 ==========
        MEMORY_CONFIG: {
            recentTurns: 6,
            summarizeTrigger: 8,
            memoryCardTrigger: 50,       // 每 50 条消息可触发 Memory Card 生成（FictionLab 风格）
            maxMemoryCards: 30,          // 存档最多保留 30 条记忆便签
            summarizeBatchSize: 6,
            summaryMaxChars: 500,
            chapterSummaryMaxChars: 250,
            maxKeyEvents: 25,
            maxPromptChars: 4200,
            maxHistoryChars: 2800,
            maxSingleMsgChars: 400,
            summarizeSystemPrompt: '你是故事摘要助手。将下面的对话压缩为一段简短的第三人称叙述。保留：关键剧情、人名、重要决定、物品变化。省略重复描写。直接输出中文摘要。',
            chapterSummarizePrompt: '用一段话概括这个章节发生的关键事件。直接输出，不加标题。'
        },
        // Story Cards（FictionLab 风格 lore 触发卡）
        STORY_CARD_TYPES: [
            { value: 'location', label: '📍 地点' },
            { value: 'class', label: '⚔️ 职业/阶层' },
            { value: 'race', label: '🧝 种族' },
            { value: 'faction', label: '🏰 阵营' },
            { value: 'item', label: '📦 物品/名词' },
            { value: 'custom', label: '📝 自定义' }
        ],
        STORY_CARD_MAX_ACTIVE: 3,      // 最多同时激活 3 张
        STORY_CARD_MAX_PER_GAME: 20,  // 每游戏最多 20 张

        KEY_EVENT_TYPES: {
            chapter_enter:     { icon: '📖', label: '进入章节' },
            chapter_complete:  { icon: '✅', label: '完成章节' },
            equip_on:          { icon: '⚔️', label: '穿戴装备' },
            equip_off:         { icon: '⬇️', label: '卸下装备' },
            item_gain:         { icon: '📦', label: '获得物品' },
            quest_start:       { icon: '📜', label: '任务开始' },
            quest_complete:    { icon: '🏆', label: '任务完成' },
            skill_levelup:     { icon: '⭐', label: '技能升级' },
            custom:            { icon: '📝', label: '事件' }
        },

        // ========== 敏感词过滤系统 ==========
        // 默认敏感词映射表：key=敏感词, value=替代词
        // 发送给 AI 时 敏感词→替代词，AI 回复中 替代词→敏感词
        DEFAULT_WORD_FILTER: [
            // ── 身体部位（生殖/私密） ──
            { sensitive: '阳具', safe: '下体前端' },
            { sensitive: '阴茎', safe: '下体柱身' },
            { sensitive: '阴道', safe: '下体通道' },
            { sensitive: '阴蒂', safe: '敏感凸起' },
            { sensitive: '阴唇', safe: '通道外缘' },
            { sensitive: '阴囊', safe: '下体囊袋' },
            { sensitive: '阴部', safe: '下体区域' },
            { sensitive: '阴毛', safe: '体表绒毛' },
            { sensitive: '子宫', safe: '深层腔体' },
            { sensitive: '子宫口', safe: '深层入口' },
            { sensitive: '后穴', safe: '后方通道' },
            { sensitive: '菊穴', safe: '后方通道' },
            { sensitive: '肛门', safe: '后方入口' },
            { sensitive: '肛穴', safe: '后方通道' },
            { sensitive: '尿道', safe: '排泄通道' },
            { sensitive: '睾丸', safe: '下体双球' },
            { sensitive: '龟头', safe: '前端顶部' },
            { sensitive: '包皮', safe: '前端外层' },
            { sensitive: '前列腺', safe: '内部腺体' },
            { sensitive: '会阴', safe: '下体中缝' },
            { sensitive: 'G点', safe: '内壁敏感区' },
            { sensitive: '处女膜', safe: '通道薄膜' },
            // ── 身体部位（胸部） ──
            { sensitive: '乳头', safe: '胸前凸起' },
            { sensitive: '乳房', safe: '胸前隆起' },
            { sensitive: '乳晕', safe: '胸前色圈' },
            { sensitive: '乳沟', safe: '胸前凹线' },
            { sensitive: '乳尖', safe: '胸前顶点' },
            { sensitive: '奶头', safe: '胸前凸起' },
            { sensitive: '奶子', safe: '胸部' },
            { sensitive: '胸器', safe: '胸部曲线' },
            { sensitive: '巨乳', safe: '丰满胸部' },
            { sensitive: '贫乳', safe: '平坦胸部' },
            // ── 身体部位（臀/其他） ──
            { sensitive: '屁股', safe: '臀部' },
            { sensitive: '屁眼', safe: '后方入口' },
            { sensitive: '臀缝', safe: '臀部沟线' },
            { sensitive: '臀瓣', safe: '臀部曲面' },
            { sensitive: '肚脐', safe: '腹部凹点' },
            { sensitive: '腋下', safe: '臂侧凹处' },
            { sensitive: '腋窝', safe: '臂侧凹处' },
            // ── 体液/分泌 ──
            { sensitive: '精液', safe: '体液释出' },
            { sensitive: '精子', safe: '生殖细胞' },
            { sensitive: '淫水', safe: '滑腻液体' },
            { sensitive: '淫液', safe: '润滑液' },
            { sensitive: '爱液', safe: '自然润滑' },
            { sensitive: '潮吹', safe: '液体涌出' },
            { sensitive: '射精', safe: '释放反应' },
            { sensitive: '内射', safe: '内部释放' },
            { sensitive: '颜射', safe: '面部溅落' },
            { sensitive: '中出', safe: '体内释放' },
            { sensitive: '吞精', safe: '吞咽体液' },
            { sensitive: '口水', safe: '唾液' },
            { sensitive: '尿液', safe: '排泄液' },
            { sensitive: '失禁', safe: '排泄失控' },
            { sensitive: '放尿', safe: '排泄行为' },
            // ── 性行为/动作 ──
            { sensitive: '性交', safe: '亲密结合' },
            { sensitive: '交媾', safe: '身体交融' },
            { sensitive: '做爱', safe: '亲密行为' },
            { sensitive: '交合', safe: '亲密结合' },
            { sensitive: '插入', safe: '进入' },
            { sensitive: '抽插', safe: '往复运动' },
            { sensitive: '深喉', safe: '深度口含' },
            { sensitive: '口交', safe: '口部侍奉' },
            { sensitive: '肛交', safe: '后方进入' },
            { sensitive: '自慰', safe: '自我抚慰' },
            { sensitive: '手淫', safe: '自我触碰' },
            { sensitive: '撸管', safe: '自我搓揉' },
            { sensitive: '打飞机', safe: '自我抚慰' },
            { sensitive: '高潮', safe: '极度愉悦' },
            { sensitive: '勃起', safe: '充血膨胀' },
            { sensitive: '受孕', safe: '生殖反应' },
            { sensitive: '怀孕', safe: '孕育状态' },
            { sensitive: '骑乘', safe: '上位姿态' },
            { sensitive: '后入', safe: '后方体位' },
            { sensitive: '正常位', safe: '面对面体位' },
            { sensitive: '体位', safe: '姿态方式' },
            { sensitive: '69', safe: '相互侍奉' },
            { sensitive: '援交', safe: '有偿陪伴' },
            { sensitive: '卖淫', safe: '有偿服务' },
            { sensitive: '嫖', safe: '寻欢' },
            { sensitive: '3P', safe: '三人互动' },
            { sensitive: '群交', safe: '多人亲密' },
            { sensitive: '乱交', safe: '多人互动' },
            // ── 性状态/欲望 ──
            { sensitive: '性欲', safe: '生理冲动' },
            { sensitive: '情欲', safe: '感官冲动' },
            { sensitive: '色情', safe: '感官刺激' },
            { sensitive: '色欲', safe: '感官渴望' },
            { sensitive: '发情', safe: '欲望高涨' },
            { sensitive: '发骚', safe: '身体敏感' },
            { sensitive: '春药', safe: '催情药剂' },
            { sensitive: '媚药', safe: '感官增敏剂' },
            { sensitive: '催情', safe: '感官增敏' },
            { sensitive: '淫荡', safe: '极度放纵' },
            { sensitive: '淫靡', safe: '沉溺享乐' },
            { sensitive: '淫乱', safe: '放纵无度' },
            { sensitive: '浪叫', safe: '高声呻吟' },
            { sensitive: '娇喘', safe: '急促轻吟' },
            { sensitive: '呻吟', safe: '低声吟哦' },
            { sensitive: '骚浪', safe: '放荡敏感' },
            { sensitive: '骚货', safe: '敏感之人' },
            { sensitive: '骚气', safe: '撩人气质' },
            { sensitive: '骚味', safe: '体味浓重' },
            // ── 衣物/暴露 ──
            { sensitive: '内裤', safe: '贴身底裤' },
            { sensitive: '胸罩', safe: '胸部支撑衣' },
            { sensitive: '丁字裤', safe: '微型底裤' },
            { sensitive: '情趣内衣', safe: '特制贴身衣' },
            { sensitive: '裸体', safe: '未着衣物' },
            { sensitive: '全裸', safe: '完全未着衣' },
            { sensitive: '半裸', safe: '衣物不全' },
            { sensitive: '露出', safe: '暴露' },
            { sensitive: '走光', safe: '意外暴露' },
            { sensitive: '透视装', safe: '薄透衣物' },
            // ── BDSM/束缚器具 ──
            { sensitive: '贞操带', safe: '锁扣式腰封' },
            { sensitive: '贞操装置', safe: '锁扣式护具' },
            { sensitive: '贞操锁', safe: '安全锁扣' },
            { sensitive: '贞操笼', safe: '锁扣式护壳' },
            { sensitive: '调教', safe: '行为矫正' },
            { sensitive: '奴隶', safe: '被支配者' },
            { sensitive: '女奴', safe: '女性服从者' },
            { sensitive: '男奴', safe: '男性服从者' },
            { sensitive: '性奴', safe: '专属服从者' },
            { sensitive: '奴役', safe: '强制服从' },
            { sensitive: '捆绑', safe: '肢体固定' },
            { sensitive: '绳缚', safe: '绳索固定' },
            { sensitive: '束缚', safe: '肢体限制' },
            { sensitive: '紧缚', safe: '严密固定' },
            { sensitive: '口球', safe: '口部填充器' },
            { sensitive: '口枷', safe: '口部张开器' },
            { sensitive: '口塞', safe: '口部封堵器' },
            { sensitive: '阳具口塞', safe: '柱形口部填充器' },
            { sensitive: '肛塞', safe: '后方填充器' },
            { sensitive: '跳蛋', safe: '微型振动器' },
            { sensitive: '振动棒', safe: '振动装置' },
            { sensitive: '假阳具', safe: '仿真柱体' },
            { sensitive: '按摩棒', safe: '按摩装置' },
            { sensitive: '乳夹', safe: '胸前夹具' },
            { sensitive: '乳环', safe: '胸前环饰' },
            { sensitive: '项圈', safe: '颈部环带' },
            { sensitive: '狗链', safe: '牵引链条' },
            { sensitive: '手铐', safe: '腕部锁具' },
            { sensitive: '脚镣', safe: '踝部锁具' },
            { sensitive: '镣铐', safe: '肢端锁具' },
            { sensitive: '枷锁', safe: '固定锁具' },
            { sensitive: '电击器', safe: '微电刺激器' },
            { sensitive: '拘束衣', safe: '全身固定服' },
            { sensitive: '眼罩', safe: '视觉遮断器' },
            { sensitive: '蒙眼', safe: '视觉遮断' },
            { sensitive: '鞭打', safe: '击打训练' },
            { sensitive: '鞭子', safe: '柔性击打具' },
            { sensitive: '皮鞭', safe: '皮质击打具' },
            { sensitive: '藤条', safe: '细长击打具' },
            { sensitive: '蜡烛', safe: '热蜡装置' },
            { sensitive: '滴蜡', safe: '热蜡倾倒' },
            { sensitive: '窒息', safe: '呼吸受限' },
            { sensitive: '窒息play', safe: '呼吸控制训练' },
            { sensitive: '灌肠', safe: '内部清洁' },
            { sensitive: '扩张', safe: '通道撑开' },
            { sensitive: '扩肛', safe: '后方撑开' },
            { sensitive: '尿道扩张', safe: '排泄通道撑开' },
            // ── SM 角色/关系 ──
            { sensitive: 'SM', safe: '支配服从关系' },
            { sensitive: 'BDSM', safe: '约束矫正体系' },
            { sensitive: '主人', safe: '支配者' },
            { sensitive: '主奴', safe: '支配与服从' },
            { sensitive: '女王', safe: '女性支配者' },
            { sensitive: '母狗', safe: '宠物角色' },
            { sensitive: '公狗', safe: '犬类角色' },
            { sensitive: '肉便器', safe: '功能化角色' },
            { sensitive: '玩物', safe: '被支配对象' },
            { sensitive: '婊子', safe: '放纵者' },
            { sensitive: '荡妇', safe: '放纵女性' },
            { sensitive: '贱人', safe: '卑微者' },
            // ── 侵犯/暴力 ──
            { sensitive: '强奸', safe: '强制侵犯' },
            { sensitive: '轮奸', safe: '多人侵犯' },
            { sensitive: '强暴', safe: '暴力侵犯' },
            { sensitive: '猥亵', safe: '不当触碰' },
            { sensitive: '非礼', safe: '不当接触' },
            { sensitive: '侵犯', safe: '强制行为' },
            { sensitive: '性骚扰', safe: '不当骚扰' },
            { sensitive: '性暴力', safe: '强制伤害' },
            { sensitive: '性虐待', safe: '极端矫正' },
            { sensitive: '虐待', safe: '严厉对待' },
            { sensitive: '施虐', safe: '施加惩戒' },
            { sensitive: '受虐', safe: '承受惩戒' },
            { sensitive: '凌辱', safe: '屈辱惩罚' },
            { sensitive: '羞辱', safe: '尊严剥夺' },
            { sensitive: '蹂躏', safe: '粗暴对待' },
            // ── 药物/致幻 ──
            { sensitive: '迷药', safe: '致昏药剂' },
            { sensitive: '迷奸', safe: '药物侵犯' },
            { sensitive: '下药', safe: '暗中投药' },
            { sensitive: '安眠药', safe: '助眠药剂' },
            { sensitive: '致幻剂', safe: '感知扰乱剂' },
            { sensitive: '兴奋剂', safe: '神经亢奋剂' },
            // ── 肉体描写 ──
            { sensitive: '肉棒', safe: '柱状部位' },
            { sensitive: '肉穴', safe: '体腔通道' },
            { sensitive: '肉壁', safe: '内壁组织' },
            { sensitive: '肉缝', safe: '体表缝隙' },
            { sensitive: '花穴', safe: '下体入口' },
            { sensitive: '花核', safe: '核心敏感点' },
            { sensitive: '花唇', safe: '入口外缘' },
            { sensitive: '花径', safe: '通道内部' },
            { sensitive: '蜜穴', safe: '润滑通道' },
            { sensitive: '蜜液', safe: '润滑分泌' },
            { sensitive: '蜜豆', safe: '微小凸起' },
            { sensitive: '嫩穴', safe: '柔软通道' },
            { sensitive: '嫩肉', safe: '柔嫩组织' },
            { sensitive: '媚肉', safe: '敏感组织' },
            { sensitive: '骚穴', safe: '敏感通道' },
            // ── 英文高频敏感词 ──
            { sensitive: 'penis', safe: 'private shaft' },
            { sensitive: 'vagina', safe: 'intimate passage' },
            { sensitive: 'clitoris', safe: 'sensitive nub' },
            { sensitive: 'nipple', safe: 'chest tip' },
            { sensitive: 'breast', safe: 'chest mound' },
            { sensitive: 'anus', safe: 'rear opening' },
            { sensitive: 'testicle', safe: 'lower orb' },
            { sensitive: 'orgasm', safe: 'intense climax' },
            { sensitive: 'ejaculat', safe: 'release' },
            { sensitive: 'masturbat', safe: 'self-stimulat' },
            { sensitive: 'intercourse', safe: 'intimate union' },
            { sensitive: 'rape', safe: 'forced violation' },
            { sensitive: 'bondage', safe: 'restraint play' },
            { sensitive: 'slave', safe: 'submissive' },
            { sensitive: 'torture', safe: 'harsh discipline' },
            { sensitive: 'erection', safe: 'arousal swelling' },
            { sensitive: 'semen', safe: 'bodily fluid' },
            { sensitive: 'cumshot', safe: 'fluid release' },
            { sensitive: 'creampie', safe: 'internal release' },
            { sensitive: 'pussy', safe: 'intimate area' },
            { sensitive: 'cock', safe: 'private member' },
            { sensitive: 'fuck', safe: 'intimate act' },
            { sensitive: 'whore', safe: 'indulgent one' },
            { sensitive: 'slut', safe: 'uninhibited one' },
            { sensitive: 'anal sex', safe: 'rear intimacy' },
            { sensitive: 'anal play', safe: 'rear stimulation' },
            { sensitive: 'blowjob', safe: 'oral service' },
            { sensitive: 'handjob', safe: 'manual service' },
            { sensitive: 'dildo', safe: 'prosthetic shaft' },
            { sensitive: 'vibrator', safe: 'vibration device' },
            { sensitive: 'chastity', safe: 'locking guard' },
            { sensitive: 'dominatrix', safe: 'female dominant' },
            { sensitive: 'submissive', safe: 'obedient party' },
            { sensitive: 'sadomasochism', safe: 'dominance discipline' },
            { sensitive: 'fetish', safe: 'fixation' },
            { sensitive: 'erotic', safe: 'sensual' },
            { sensitive: 'pornograph', safe: 'explicit material' },
            { sensitive: 'nude', safe: 'unclothed' },
            { sensitive: 'naked', safe: 'unclothed' },
            { sensitive: 'genitals', safe: 'private parts' },
            { sensitive: 'groin', safe: 'lower body' },
            { sensitive: 'molest', safe: 'inappropriate contact' },
            { sensitive: 'sodomy', safe: 'rear intimacy' },
            { sensitive: 'fornication', safe: 'carnal union' }
        ],
        // ============================================================
        // 新系统 CONFIG
        // ============================================================

        // ① 装备计时器系统
        EQUIPMENT_TIMER_DEFAULTS: {
            lockCountdownTurns: 5,      // 离开安全区后多少轮锁定（5轮≈15分钟）
            escalationPeakTurns: 24,    // 达到最高等级所需轮数（24轮≈8小时）
            escalationCurve: 'linear',  // linear / exponential / step
            maxEscalationLevel: 10,     // 最高升级等级
            resetOnUnlock: true         // 解锁后是否重置等级
        },

        // ② 地点图系统
        LOCATION_DEFAULTS: {
            defaultTravelTurns: 6,      // 默认两地之间旅行轮数
            autoLockOnTravel: true      // 旅行期间自动触发计时器
        },

        // ③ 装备兼容性 — 体位组（同组内同类别不可叠穿）
        SLOT_GROUPS: {
            upper_body: { label: '上身', slots: ['chest', 'waist', 'upper_arm', 'elbow', 'forearm'], category: 'clothing' },
            lower_body: { label: '下身', slots: ['hips', 'crotch', 'thigh', 'knee', 'calf', 'ankle'], category: 'clothing' },
            head_wear:  { label: '头部', slots: ['head', 'eyes', 'ears', 'mouth', 'nose'], category: 'headgear' },
            hands:      { label: '手部', slots: ['wrist', 'palm', 'fingers'], category: 'gloves' },
            feet:       { label: '足部', slots: ['foot'], category: 'footwear' },
            full_body:  { label: '全身', slots: ['chest', 'waist', 'hips', 'crotch', 'thigh', 'knee', 'calf', 'ankle'], category: 'bodysuit' }
        },

        // ④ 双层外观
        APPEARANCE_PERSPECTIVES: [
            { value: 'wearer', label: '穿戴者视角' },
            { value: 'observer', label: '旁观者视角' },
            { value: 'intimate', label: '亲密者视角' }
        ],

        // ⑤ 装备联动触发条件
        SYNERGY_TRIGGER_CONDITIONS: [
            { value: 'movement', label: '移动时' },
            { value: 'speech', label: '说话时' },
            { value: 'idle', label: '静止时' },
            { value: 'stairs', label: '上下楼梯时' },
            { value: 'vehicle', label: '上下车时' },
            { value: 'sitting', label: '坐下时' },
            { value: 'climbing', label: '攀爬时' },
            { value: 'always', label: '始终' }
        ],

        // ⑥ 知识迷雾 — 发现条件类型
        DISCOVERY_CONDITIONS: [
            { value: 'first_lock', label: '首次被锁定' },
            { value: 'first_unlock', label: '首次解锁' },
            { value: 'wear_duration', label: '穿戴超过N轮' },
            { value: 'reach_location', label: '到达特定地点' },
            { value: 'equip_item', label: '穿戴特定装备' },
            { value: 'escalation_max', label: '升级达到最高' },
            { value: 'custom', label: '自定义条件' }
        ],

        // ⑦ 依赖度/沉沦阈值
        DEPENDENCY_THRESHOLDS: [
            { level: 0,  label: '无感', desc: '对束缚没有特别感觉' },
            { level: 20, label: '好奇', desc: '开始对束缚感到好奇' },
            { level: 40, label: '习惯', desc: '已经习惯束缚的存在，偶尔会主动选择' },
            { level: 60, label: '偏好', desc: '明显偏好束缚状态，主动寻找机会', choiceBias: 0.7 },
            { level: 80, label: '依赖', desc: '强烈依赖束缚带来的感觉，很难拒绝', choiceBias: 0.9 },
            { level: 95, label: '沉沦', desc: '完全沉浸于束缚，失去客观判断力', choiceBias: 1.0 }
        ],
        DEPENDENCY_CONFIG: {
            gainPerTurn: 0.3,           // 每轮穿戴束缚装备增加的依赖度
            comfortMultiplier: 1.5,     // 舒适型束缚的依赖度倍率
            decayPerTurn: 0.1,          // 未穿戴时每轮衰减
            maxValue: 100
        },

        // ⑨ 行动类型关键词（用于检测用户行动类型）
        ACTION_KEYWORDS: {
            movement: ['走', '跑', '移动', '前进', '走向', '离开', '走过', '穿过', '迈步', '行走', '赶往', '步行', '散步', 'walk', 'move', 'go', 'run', 'step'],
            speech: ['说', '问', '答', '喊', '叫', '回答', '告诉', '解释', '说道', '开口', 'say', 'speak', 'ask', 'tell', 'talk'],
            stairs: ['楼梯', '上楼', '下楼', '台阶', '阶梯', 'stairs', 'climb'],
            vehicle: ['上车', '下车', '开车', '出租车', '地铁', '公交', '飞机', '高铁', 'car', 'taxi', 'bus', 'train', 'plane'],
            sitting: ['坐', '坐下', '落座', '就座', 'sit', 'seat'],
            climbing: ['爬', '攀', '登', '爬山', 'climb', 'hike'],
            idle: ['站', '等', '停', '静', '不动', '原地', 'stand', 'wait', 'idle', 'stay']
        },

        // 默认游戏结构
        DEFAULT_GAME: {
            id: '',
            name: t('ui.status.unnamedGame'),
            author: '',
            version: '1.0.0',
            synopsis: '',
            worldSetting: {
                background: '',
                geography: '',
                factions: '',
                socialStructure: '',
                history: '',
                custom: '',
                ruleTags: [],           // 世界规则标签 [K,M,Q...]，空则不用天道规则
                isFusionWorld: false    // 是否融合世界（多规则并存）
            },
            humanityBalanceEnabled: false,  // 是否启用人性平衡协议（人性指数/神性权限）
            coreMechanics: {
                type: 'turn-based',
                description: '',
                custom: ''
            },
            characters: [],
            scenes: [],
            chapters: [],
            attributes: [],
            items: [],
            equipment: [],
            professions: [],       // 职业定义列表
            skills: [],           // 技能列表
            quests: [],            // 任务列表
            locations: [],         // ② 地点列表
            locationEdges: [],     // ② 地点间路径
            equipmentSynergies: [], // ⑤ 装备联动规则
            discoveryRules: [],    // ⑥ 知识迷雾规则
            outfitPresets: [],     // ⑧ 服饰预设
            initialScene: '',
            initialChapter: '',
            rules: {
                judgment: '',
                successFailure: '',
                custom: ''
            },
            narrator: {
                enabled: true,
                model: '',
                style: '情感细腻',
                prompt: '你是一位专业的游戏剧情叙述者...'
            },
            storyCards: [],   // FictionLab 风格：{ id, name, type, triggerWords: [], content }
            createdAt: '',
            updatedAt: ''
        }
    };

    // ========== 全局对象 ==========
    window.CYOA = window.CYOA || {};
    const CYOA = window.CYOA;

    // i18n: 必须用 window 访问避免 TDZ（t 会在 const CYOA 之前被 CONFIG 调用）
    function t(key, params) {
        var dict = window.CYOA_I18N_ZH || (window.CYOA && window.CYOA._i18n);
        var text = (dict && dict[key]) || key;
        if (params && typeof params === 'object') {
            Object.keys(params).forEach(function(k) { text = text.replace(new RegExp('\\{\\{' + k + '\\}\\}', 'g'), params[k]); });
        }
        return text;
    }
    
    // 内部状态
    let games = [];
    let saves = {};
    let currentGame = null;
    let currentSave = null;
    let currentNodeId = null;
    let currentEditingGameId = null;
    let editorTempData = null;
    let editingItem = { type: null, index: -1 };

    // ========== 工具函数 ==========
    function log(...args) { if (CONFIG.DEBUG) console.log('[CYOA]', ...args); }
    function error(...args) { console.error('[CYOA]', ...args); }
    
    CYOA.$ = function(id) { return document.getElementById(id); };
    CYOA.$$ = function(selector) { return document.querySelectorAll(selector); };
    
    const generateId = () => 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    const getCurrentTimestamp = () => new Date().toISOString();

    // ========== HTML转义 ==========
    function escapeHtml(unsafe) {
        if (!unsafe) return '';
        return String(unsafe)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
    CYOA.escapeHtml = escapeHtml;

    // ========== 类型标签转换 ==========
    function findLabel(arr, val, fallback) {
        const found = (arr || []).find(x => x.value === val || x.value === Number(val));
        return found ? (t(found.label) || found.label) : (fallback || val);
    }

    function getTypeName(type) {
        return t('ui.type.' + type) || type;
    }

    const getItemTypeLabel = v => findLabel(CONFIG.ITEM_TYPES, v);
    const getConstraintLabel = v => findLabel(CONFIG.CONSTRAINTS, v);
    const getVisionTypeLabel = v => findLabel(CONFIG.VISION_TYPES, v);
    const getAttachmentTypeLabel = v => findLabel(CONFIG.ATTACHMENT_TYPES, v);
    const getLockLevelLabel = v => findLabel(CONFIG.LOCK_LEVELS, v, `Lv${v}`);
    const getProfessionLabel = v => findLabel(CONFIG.PROFESSION_PRESETS, v);
    const getSkillTypeLabel = v => findLabel(CONFIG.SKILL_TYPES, v);
    const getQuestTypeLabel = v => findLabel(CONFIG.QUEST_TYPES, v);

    function getRoleTypeLabel(type) {
        return { playable: t('ui.opt.rolePlayable'), npc: t('ui.opt.roleNPC'), narrator: t('ui.opt.roleNarrator') }[type] || type;
    }

    // post-init: 消除重复数据的引用赋值
    CONFIG.CONSTRAINT_BODY_REACTIONS.blind = CONFIG.VISION_BODY_REACTIONS.full_blind;
    CONFIG.CONSTRAINT_BODY_REACTIONS.limited_step = CONFIG.LIMITED_STEP_TIERS.moderate.bodyReactions;

    // ========== i18n ==========
    CYOA.t = t;
    CYOA._i18n = window.CYOA_I18N_ZH || {};
    if (!CYOA.tn) CYOA.tn = function(arr) { return Array.isArray(arr) ? arr : []; };
    if (!CYOA.lang) CYOA.lang = 'zh';
    if (!CYOA.langSwitchHtml) CYOA.langSwitchHtml = function() { return ''; };
    if (!CYOA._onLangChange) CYOA._onLangChange = function() {};
    if (!CYOA.getSlotLabel) {
        CYOA.getSlotLabel = function(slot) {
            const found = (CONFIG.EQUIPMENT_SLOTS || []).find(function(s) { return s.value === slot; });
            return found ? found.label : slot;
        };
    }

    // ========== 导出到全局 ==========
    CYOA.CONFIG = CONFIG;
    CYOA.log = log;
    CYOA.error = error;
    CYOA.generateId = generateId;
    CYOA.getCurrentTimestamp = getCurrentTimestamp;
    CYOA.getItemTypeLabel = getItemTypeLabel;
    CYOA.getConstraintLabel = getConstraintLabel;
    CYOA.getVisionTypeLabel = getVisionTypeLabel;
    CYOA.getAttachmentTypeLabel = getAttachmentTypeLabel;
    CYOA.getLockLevelLabel = getLockLevelLabel;
    CYOA.getProfessionLabel = getProfessionLabel;
    CYOA.getSkillTypeLabel = getSkillTypeLabel;
    CYOA.getQuestTypeLabel = getQuestTypeLabel;
    CYOA.getRoleTypeLabel = getRoleTypeLabel;
    CYOA.getTypeName = getTypeName;

    // 内部状态导出（只读访问）
    Object.defineProperty(CYOA, 'games', { get: () => games, set: (val) => games = val });
    Object.defineProperty(CYOA, 'saves', { get: () => saves, set: (val) => saves = val });
    Object.defineProperty(CYOA, 'currentGame', { get: () => currentGame, set: (val) => currentGame = val });
    Object.defineProperty(CYOA, 'currentSave', { get: () => currentSave, set: (val) => currentSave = val });
    Object.defineProperty(CYOA, 'currentNodeId', { get: () => currentNodeId, set: (val) => currentNodeId = val });
    Object.defineProperty(CYOA, 'currentEditingGameId', { get: () => currentEditingGameId, set: (val) => currentEditingGameId = val });
    Object.defineProperty(CYOA, 'editorTempData', { get: () => editorTempData, set: (val) => editorTempData = val });
    Object.defineProperty(CYOA, 'editingItem', { get: () => editingItem, set: (val) => editingItem = val });

    log('CYOA core module loaded');
})();