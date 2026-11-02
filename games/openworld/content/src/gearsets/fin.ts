// The finale's sets (docs/sets.md §4): the Holy City, level 20, found before the descent and on the way down — after
// Astra the game stays in the Holiest, so they are for the Confluence and the last fight. The Porch Wardens (the wardens'
// own stock and the porch's chests), the Curia (the nave's vestry chests and the Primate's gloves), the Last Door (what
// those who came this far left at the Holiest's door) and the Second's (her things, kept in the nave's reliquaries and
// left in the Confluence).

import { F, P, type SetDef } from './kit.ts'

export const FIN_SETS: SetDef[] = [
  {
    id: 'wardens', en: 'Porch Wardens', zh: '门廊守卫', chapter: 'fin', level: 20, lean: 'warrior', look: 'ivory',
    palette: ['#cfc9b8', '#57524a', '#c9a248', '#fbf8ef'],
    pieces: [
      P('head', F.helmet, "Warden's Helm", '门廊守卫战盔',
        'A steel helm with a socket for a white plume and no plume in it. The wardens of the Most Holy Hall are told to look at whoever comes up the avenue, and at nothing behind them.',
        '一顶钢盔，留着插白羽的座，羽毛早没了。至圣大殿的门廊守卫受命只看走上大道来的人，不看他们身后。', 'npc:npc.warden_w', undefined, { shape: 'helm' }),
      P('shoulders', F.pauldrons, "Warden's Pauldrons", '门廊守卫肩甲',
        'Pauldrons enamelled white, the enamel laid on again every spring. Under it, on the left, a son\'s name is scratched beside his father\'s, and the father\'s beside his.',
        '上了白釉的肩甲，每年春天重上一遍釉。釉底下，左肩上刻着一个儿子的名字，挨着他父亲的，父亲的又挨着祖父的。', 'npc:npc.warden_e'),
      P('body', F.plate, "Warden's Hauberk", '门廊守卫锁甲',
        'Mail under a white surcoat, the five seals stitched round its hem. Each new warden takes it down from its peg and each old one hangs it back; there are more names in the lining than links in a sleeve.',
        '白罩袍下面的锁甲，袍摆上绣着一圈五印。每个新守卫从钉子上把它取下来，每个老守卫再把它挂回去；衬里上的名字比一只袖子上的铁环还多。', 'map:holyhall', undefined, { shape: 'mail' }),
      P('hands', F.gloves, "Warden's Gauntlets", '门廊守卫护手',
        'Gauntlets worn smooth inside the fingers, from the haft of a halberd held upright all day. A warden does not lower it for a pilgrim. A warden lowers it for the Primate.',
        '护手掌心那面的指节被磨得光光的，是一整天竖握戟杆磨出来的。守卫不会为朝圣者放低它。守卫只为首席司祭放低它。', 'npc:npc.warden_w', { atk: 1 }, { shape: 'gauntlet' }),
      P('waist', F.belt, "Warden's Belt", '门廊守卫腰带',
        'A white belt with a ring for the keys of the porch. There are no keys on it. The door of the Hall is never locked; the wardens say it does not need to be.',
        '一条白腰带，上面有挂门廊钥匙的环。环上没有钥匙。大殿的门从来不锁；守卫们说，用不着锁。', 'npc:npc.warden_e'),
      P('feet', F.boots, "Warden's Greaves", '门廊守卫胫甲',
        'Greaves scuffed only at the toes, from standing. A warden stands a day at a time on the porch. Nothing comes up the avenue that is not expected.',
        '只在脚尖处有磨痕的胫甲，是站出来的。守卫在门廊上一站就是一整天。凡是走上大道来的，没有一个是没人等着的。', 'map:holyhall', { moveHaste: 0.03 }, { shape: 'greave' }),
    ],
    bonuses: [
      { pieces: 2, props: { def: 3 } },
      { pieces: 4, props: { atk: 3, block: 0.05 } },
      { pieces: 6, vow: 'ward' },
    ],
  },
  {
    id: 'curia', en: 'The Curia', zh: '圣廷', chapter: 'fin', level: 20, lean: 'mage', look: 'plum',
    palette: ['#6a3f5e', '#3a2034', '#e2c070', '#c9a0c0'],
    pieces: [
      P('head', F.hood, 'Cowl of the Curia', '圣廷兜帽',
        'A cowl of plum silk lined with gold. The Curia sit in the choir in them and keep the doctrine, which is shorter than any of their sittings.',
        '一顶紫绸兜帽，衬里织着金线。圣廷的人戴着它坐在唱诗席里，守着教义。教义比他们任何一次议事都短。', 'map:holyhall.nave', { cdr: 0.03 }),
      P('shoulders', F.cloak, 'Cope of the Curia', '圣廷祭披',
        'A cope stiff with gold, the five seals worked down its back. It was made for the Great Rite and is worn at no other. The gold at its shoulders is still bright; no one has worn it long enough to dull it.',
        '一件绣满金线、硬挺挺的祭披，背后一路绣着五印。它是为五苦大礼做的，别的时候不穿。肩上的金线还是亮的；从没有人穿着它久到把金线磨暗。', 'map:holyhall.nave'),
      P('body', F.robe, 'Robe of the Curia', '圣廷法袍',
        'A robe of plum wool over a white shift. Each who is raised to the Curia is told one thing on the day they put it on, and keeps it. The robe buttons to the throat.',
        '紫毛呢法袍，里面衬着白内衫。每个被擢升进圣廷的人，穿上它那天都会被告知一件事，并且守住它。这件法袍的扣子一直扣到喉咙。', 'map:holyhall.nave', { cdr: 0.04 }),
      P('hands', F.gloves, 'Gloves of the Curia', '圣廷手套',
        'White kid gloves embroidered with the Primate\'s seal. Aurelian took them off this morning to light the candles with his own hands, and has not put them on again.',
        '白色小羊皮手套，绣着首席司祭的印。奥勒良今天早上把它摘了下来，好亲手点蜡烛，之后就没再戴上。', 'npc:npc.primate', { critChance: 0.03 }),
      P('waist', F.belt, 'Cincture of the Curia', '圣廷腰绳',
        'A cord of plum and gold knotted five times. The knots are tied by the one who wears it, and untied by the one who buries them.',
        '一条紫金两色的腰绳，打着五个结。结由佩戴的人亲手打上，由埋葬他的人解开。', 'map:holyhall.nave', undefined, { shape: 'cord' }),
      P('feet', F.boots, 'Shoes of the Curia', '圣廷软履',
        'Soft shoes for the marble of the Hall, embroidered with thorns. The Curia do not go down. The soles are hardly worn.',
        '在大殿大理石上穿的软履，绣着荆棘。圣廷的人从不下去。鞋底几乎没有磨损。', 'map:holyhall.nave'),
    ],
    bonuses: [
      { pieces: 2, props: { cdr: 0.06 } },
      { pieces: 4, props: { atk: 3 } },
      { pieces: 6, power: 'curia' },
    ],
  },
  {
    id: 'lastdoor', en: 'The Last Door', zh: '最后之门', chapter: 'fin', level: 20, lean: 'ranger', look: 'slate',
    palette: ['#5a6370', '#323944', '#b8602e', '#aab1bc'],
    pieces: [
      P('head', F.hood, 'Hood Left at the Door', '门前的兜帽',
        'A pilgrim\'s hood, its scallop torn away. It lay beside the one who wore it, before the door of the Holiest. They came this far, and sat down, and did not knock.',
        '一顶朝圣者的兜帽，上面的扇贝被扯掉了。它落在戴它的人身旁，就在至圣所门前。那人走到了这里，坐了下来，没有敲门。', 'map:confluence', { critDamage: 0.1 }),
      P('hands', F.gloves, 'Gloves Left at the Door', '门前的手套',
        'An archer\'s gloves, the drawing fingers worn through. Arrows lie scattered round them, every one loosed at the door, none through it.',
        '弓手的手套，拉弦的手指磨穿了。周围散落着箭，每一支都朝那扇门射过，没有一支穿过去。', 'map:confluence', { critChance: 0.04 }),
      P('waist', F.belt, 'Belt Left at the Door', '门前的腰带',
        'A belt hung with the tokens of the five wayside shrines, the fifth newer than the rest. Whoever wore it prayed at each on the long road here, and stopped before this one.',
        '一条挂着五座路边神龛信物的腰带，第五件比其他的都新。戴它的人在来这里的长路上，在每一座神龛前都祷告过，到了这一扇门前，停下了。', 'map:confluence'),
      P('feet', F.boots, 'Boots Left at the Door', '门前的靴子',
        'Boots with five lands in their seams: the March\'s red earth, the Vale\'s grey dust, the black mud of the Fens, the white chalk of the Heights, the thorn\'s burrs. Their wearer walked all of it to sit down here.',
        '鞋缝里嵌着五片土地：边境的红土、衡谷的灰尘、泽地的黑泥、高地的白垩，还有荆棘的刺果。穿它的人走完了这一切，就为了在这里坐下。', 'map:confluence', { moveHaste: 0.05 }),
    ],
    bonuses: [
      { pieces: 2, props: { critChance: 0.06 } },
      { pieces: 4, power: 'lastdoor' },
    ],
  },
  {
    id: 'second', en: "The Second's", zh: '第二位', chapter: 'fin', level: 20, lean: 'assassin', look: 'steelgrey',
    palette: ['#b8b2c8', '#5f5872', '#a28ac4', '#f4f0ff'],
    pieces: [
      P('head', F.circlet, 'Circlet of the Second', '第二位的头环',
        'A circlet of silver no wider than a finger, five little stars along it, one of them gone. The reliquary\'s card: WORN BY THE SECOND ON THE NIGHT SHE TOOK UP THE FIVE. It was found in the morning on the floor of the Holiest, a little way from where she had stood. It no longer fitted her.',
        '一圈不过一指宽的银头环，上面排着五颗小星，掉了一颗。圣物匣里的卡片写着：第二位承受五苦之夜所戴。第二天早上，有人在至圣所的地上找到了它，离她站过的地方不远。她已经戴不上了。', 'map:holyhall.nave', { dodge: 0.03 }),
      P('shoulders', F.cloak, 'Shawl of the Second', '第二位的披肩',
        'A shawl of grey wool, folded small and tied with a ribbon, as if for someone very little to carry. It has lain in the Confluence four hundred years, and the damp has not touched it.',
        '一条灰毛线披肩，叠得小小的，系着一根缎带，像是要给一个很小的人带着走。它在五渠汇放了四百年，潮气一点也没沾上它。', 'map:confluence', { dodge: 0.03 }),
      P('feet', F.boots, 'Slippers of the Second', '第二位的软鞋',
        'Two soft slippers set side by side in a box at the foot of the stair, the way one leaves shoes at a door. Whoever stepped out of them did not come back for them. They are a grown woman\'s size.',
        '两只软鞋，并排放在楼梯脚下的一只匣子里，像人进门前脱鞋那样摆着。从里面走出来的人，没有回来穿走。那是成年女人的尺码。', 'map:confluence', { moveHaste: 0.06 }),
      P('ear', F.earring, 'Earring of the Second', '第二位的耳坠',
        'A drop of clear stone on a silver hook, one of a pair. The Church keeps this one in a reliquary of the Hall; the other was never found. The card says she wore both when she went down, in the fourth year of the Five.',
        '银钩上挂着一滴透明的石头，原本是一对。教会把这一只收在大殿的圣物匣里，另一只再没找到。卡片上说，五苦四年她下去的时候，两只都戴着。', 'map:holyhall.nave', { critChance: 0.04 }),
    ],
    bonuses: [
      { pieces: 2, props: { dodge: 0.05 } },
      { pieces: 4, power: 'second' },
    ],
  },
]
