// The people of the demo, one record per file in people/: the Ford's two (docs/game-design.md §5)
// and Emberfall's three (docs/main-quest.md).

import type { PersonDef } from './person.ts'
import { hesper } from './people/hesper.ts'
import { tobin } from './people/tobin.ts'
import { garrick } from './people/garrick.ts'
import { mara } from './people/mara.ts'
import { wren } from './people/wren.ts'
import { bram } from './people/bram.ts'
import { rowan } from './people/rowan.ts'
import { marta } from './people/marta.ts'
import { mia } from './people/mia.ts'
import { holt } from './people/holt.ts'
import { gus } from './people/gus.ts'
import { lina } from './people/lina.ts'
import { oskar } from './people/oskar.ts'
import { ilse } from './people/ilse.ts'
import { joss } from './people/joss.ts'
import { pell } from './people/pell.ts'
import { brin } from './people/brin.ts'
import { alberic } from './people/alberic.ts'
import { haldor } from './people/haldor.ts'
import { greta } from './people/greta.ts'
import { anselm } from './people/anselm.ts'
import { tam } from './people/tam.ts'
import { nessa } from './people/nessa.ts'
import { fennick } from './people/fennick.ts'
import { edda } from './people/edda.ts'
import { severin } from './people/severin.ts'
import { courier } from './people/courier.ts'
import { cass } from './people/cass.ts'
import { vigo } from './people/vigo.ts'
import { caius } from './people/caius.ts'
import { ezra } from './people/ezra.ts'
import { maud } from './people/maud.ts'
import { wynn } from './people/wynn.ts'
import { orrin } from './people/orrin.ts'
import { hilde } from './people/hilde.ts'
import { odette } from './people/odette.ts'
import { odran } from './people/odran.ts'
import { brannoc } from './people/brannoc.ts'
import { vera } from './people/vera.ts'
import { wil } from './people/wil.ts'
import { lucan } from './people/lucan.ts'
import { ivo } from './people/ivo.ts'
import { kell } from './people/kell.ts'
import { dunn } from './people/dunn.ts'
import { roderick } from './people/roderick.ts'
import { osric } from './people/osric.ts'
import { haskel } from './people/haskel.ts'
import { berthe } from './people/berthe.ts'
import { elsie } from './people/elsie.ts'
import { corwin } from './people/corwin.ts'
import { edith } from './people/edith.ts'
import { ottilie } from './people/ottilie.ts'
import { godwin } from './people/godwin.ts'
import { klaas } from './people/klaas.ts'
import { hedda } from './people/hedda.ts'
import { piet } from './people/piet.ts'
import { liese } from './people/liese.ts'
import { sanne } from './people/sanne.ts'
import { jory } from './people/jory.ts'
import { barnaby } from './people/barnaby.ts'
import { benedek } from './people/benedek.ts'
import { agathe } from './people/agathe.ts'
import { tomas } from './people/tomas.ts'
import { ysolde } from './people/ysolde.ts'
import { primate } from './people/primate.ts'
import { wardenE, wardenW } from './people/wardens.ts'

// Chapter 1's (docs/chapter-1.md): the village's six, and the two the scenes bring on; the forest's flanks' two (§15);
// Chapter 2's (docs/chapter-2.md §7): Odran in Emberfall, the Left Company's camp, the Red Order, the Right's two the scenes bring on;
// Chapter 3's (docs/chapter-3.md §7): Fairweight's Weighmaster, poorhouse, Lightened, Guild and miller;
// Chapter 4's (docs/chapter-4.md §7): Nailgate's ferryman, its living and its kept dead, its sexton;
// Chapter 5's (docs/chapter-5.md §7): Whiteveil's abbot, robe-sewer and novice, the hermit of the stair;
// the finale's (docs/finale.md §5): the Primate and the Hall's wardens
export const PEOPLE: PersonDef[] = [hesper, tobin, mara, garrick, wren, bram, rowan, marta, mia, holt, gus, lina, oskar, ilse, joss, pell, nessa, fennick, edda, brin, tam, alberic, severin, courier, cass, vigo, haldor, greta, anselm, caius, ezra, maud, wynn, orrin, hilde, odette, odran, brannoc, vera, wil, lucan, ivo, kell, dunn, roderick, osric, haskel, berthe, elsie, corwin, edith, ottilie, godwin, klaas, hedda, piet, liese, sanne, jory, barnaby, benedek, agathe, tomas, ysolde, primate, wardenW, wardenE]

/**
 * Who keeps house together (docs/npc-sandbox.md §2.1): what one of them owns, all of them do; a theft from one
 * is a theft from all; their doorstep is theirs. The rest keep no house (the shelter's sleepers, the wanderers).
 */
export const HOUSEHOLDS: Record<string, string[]> = {
  cook: ['npc.marta', 'npc.mia', 'npc.pell', 'npc.lina'],
  watch: ['npc.holt', 'npc.fennick', 'npc.oskar'],
  elder: ['npc.rowan'],
  wood: ['npc.gus', 'npc.cass'],
  edda: ['npc.edda'],
  joss: ['npc.joss'],
  chapel: ['npc.ilse'],
  cart: ['npc.tobin'],
  ferry: ['npc.hesper'],
  smithy: ['npc.garrick'],
  hall: ['npc.mara'],
  herbs: ['npc.wren'],
  mill: ['npc.tam'],
  pilgrims: ['npc.maud', 'npc.wynn'],
  charcoal: ['npc.orrin'],
  bend: ['npc.hilde'],
  odran: ['npc.odran'],
  leftcompany: ['npc.brannoc', 'npc.kell', 'npc.dunn', 'npc.wil'],
  surgery: ['npc.vera'],
  order: ['npc.lucan', 'npc.ivo'],
  weighhouse: ['npc.haskel'],
  poorhouse: ['npc.berthe', 'npc.elsie'],
  guild: ['npc.ottilie'],
  miller: ['npc.godwin'],
  ferryman: ['npc.klaas'],
  hedda: ['npc.hedda'],
  piet: ['npc.piet', 'npc.liese'],
  sanne: ['npc.sanne', 'npc.jory'],
  sexton: ['npc.barnaby'],
  whiteveil: ['npc.benedek'],
  abbeycells: ['npc.agathe', 'npc.tomas'],
  hermit: ['npc.ysolde'],
}
/** The household one keeps, if any. */
export const householdOf = (id: string): string | undefined => Object.entries(HOUSEHOLDS).find(([, ids]) => ids.includes(id))?.[0]
