// The two sets that cross the whole main line (docs/sets.md §4): the Pilgrims Before, a piece on a pilgrim's bones in
// each chapter, each of another century and each at its chapter's level; and the Five Seals, each Seal-bearer's own
// piece, which it surely drops when it falls (the loot module's trophy: ontology.ts names it on the boss's kind).

import { F, P, type SetDef } from './kit.ts'

export const ACROSS_SETS: SetDef[] = [
  {
    id: 'pilgrims', en: 'The Pilgrims Before', zh: '先行朝圣者', chapter: 'all', level: 11, lean: 'any', look: 'undyed',
    palette: ['#b5a585', '#5a4a32', '#c0993c', '#ece6d6'],
    pieces: [
      P('head', F.hat, "Pilgrim's Wide Hat", '朝圣者的宽檐帽',
        'A wide hat of felted wool, a scallop pinned to the brim. Inside the crown, in ink gone brown: AELIS OF VARROW. It lay in the grass a little way from the oldest stone on the Kneeling Field, as if it had been knocked off.',
        '一顶毛毡宽檐帽，帽檐上别着一枚扇贝。帽顶里面用褪成褐色的墨水写着：瓦罗的艾莉丝。它落在跪行原上最古老那块石头旁边不远的草里，像是被人打掉的。', 'map:kneelfield', undefined, { level: 4, shape: 'wide' }),
      P('feet', F.boots, "Pilgrim's Road-boots", '朝圣者的远行靴',
        'Boots resoled so often that the uppers are a hundred years older than the soles. Burned into the heel: BROTHER TEOBALD, THE 289TH YEAR OF THE CROWN. He came this far east.',
        '鞋底换过太多次，鞋面比鞋底老了一百年。鞋跟上烙着：特奥巴尔德修士，持冠第二百八十九年。他往东走到了这里。', 'map:pass', undefined, { level: 6 }),
      P('waist', F.belt, "Pilgrim's Rope Belt", '朝圣者的绳带',
        'A rope belt knotted five times, once for each Suffering. It was found on the salt beside no one. Stitched to it, a tag of leather: BROTHER HALVARD, THE 301ST YEAR. FOUND LIGHT.',
        '一条打了五个结的绳带，一苦一个结。在盐滩上找到的，旁边没有人。上面缝着一块皮签：哈尔瓦德修士，三〇一年。称轻。', 'map:saltpans', undefined, { level: 12, shape: 'rope' }),
      P('hands', F.gloves, "Pilgrim's Gloves", '朝圣者的手套',
        'Gloves worn through at the fingertips, from counting prayer knots. They were found in the water of the Drowned Graves on hands that were still counting. THE 339TH YEAR, and a name the fen has eaten.',
        '指尖磨穿了的手套，是数祈祷结数出来的。在溺亡者墓地的水里找到，戴着它的那双手还在数。三三九年，名字被泥沼吃掉了。', 'map:drowned', undefined, { level: 15 }),
      P('shoulders', F.cloak, "Pilgrim's Mantle", '朝圣者的披肩',
        'A grey mantle, not a white one. Whoever wore it climbed the White Stair in their own clothes, and was buried by the way in them, against the brothers\' custom. THE 361ST YEAR.',
        '一件灰色的披肩，不是白的。穿它的人穿着自己的衣服爬上白阶，也穿着它被葬在了路边，没有照修士们的规矩。三六一年。', 'map:whitestair', undefined, { level: 17 }),
      P('body', F.robe, "Pilgrim's Habit", '朝圣者的僧袍',
        'A habit folded and laid at the door of the Holiest, a scallop on top of it. Sewn into the collar, a name and THE 371ST YEAR. The name has been cut out.',
        '一件叠好的僧袍，放在至圣所门前，上面压着一枚扇贝。领子里缝着一个名字和三七一年。名字被剪掉了。', 'map:confluence', undefined, { level: 20, shape: 'habit' }),
    ],
    bonuses: [
      { pieces: 2, props: { moveHaste: 0.05 } },
      { pieces: 4, props: { dodge: 0.05, xpRate: 0.1 } },
      { pieces: 6, vow: 'pilgrim' },
    ],
  },
  {
    id: 'fiveseals', en: 'The Five Seals', zh: '五印', chapter: 'all', level: 10, lean: 'any',
    palette: ['#393940', '#1a1a20', '#a23a3a', '#c8cbd6'],
    pieces: [
      P('ring', F.ring, 'Signet of the First Seal', '第一印印戒',
        'A signet of white gold, cut with the first seal: a crown of thorns. The White Knight wore it under his gauntlet for three hundred years, against the skin.',
        '一枚白金印戒，刻着第一印：一顶荆棘冠。白骑士把它戴在护手底下，贴着皮肤，戴了三百年。', 'boss:alberic', { critChance: 0.02 }, { level: 5 }),
      P('waist', F.belt, 'Cord of the Second Seal', '第二印绳带',
        'A red cord knotted round an iron seal: the Scourging Post. Matthias wore it under the chain. The cord has been dyed again and again, never with dye.',
        '一条红绳，结着一枚铁印：鞭刑柱。马提亚把它系在铁链底下。这条绳子染了一遍又一遍，用的从来不是染料。', 'boss:matthias', { attackHaste: 0.04 }, { level: 9, shape: 'cord' }),
      P('neck', F.amulet, 'Weight of the Third Seal', '第三印秤砣',
        'A little black weight on a chain, struck with the third seal: the scales. It is as heavy as a stone ten times its size. Ele wore it at the throat.',
        '一块链子上的黑色小秤砣，打着第三印：天秤。它有大它十倍的石头那么重。厄勒把它挂在喉咙下面。', 'boss:ele', { cdr: 0.04 }, { level: 12, shape: 'weight' }),
      P('feet', F.boots, 'Spur of the Fourth Seal', '第四印马刺',
        'Pale riding boots with a single spur, its rowel a seal: the nails. Nacht\'s horse bore no mark of it. It was not for the horse.',
        '一双苍白的马靴，只有一只上装着马刺，马刺的轮子是一枚印：钉子。纳赫特的马身上没有一处被它划过。它不是用来踢马的。', 'boss:nacht', { moveHaste: 0.05 }, { level: 15, shape: 'spur' }),
      P('ear', F.earring, 'Murmur of the Fifth Seal', '第五印低语',
        'An earring of white bone carved with the fifth seal: the lance. Held to the ear, it murmurs a question in hundreds of voices. It is always the same question.',
        '一枚白骨耳坠，刻着第五印：长枪。贴近耳朵，能听见几百个声音低声问同一个问题。问来问去，总是那一个。', 'boss:witnesses', { critDamage: 0.1 }, { level: 18, shape: 'bone' }),
    ],
    bonuses: [
      { pieces: 2, props: { atk: 2 } },
      { pieces: 3, props: { def: 3 } },
      { pieces: 4, props: { critChance: 0.08 } },
      { pieces: 5, power: 'nightkept' },
    ],
  },
]
