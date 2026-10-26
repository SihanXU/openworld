import type { Frame, JournalQuest } from '@openworld/engine'
import { QuestLog } from '@openworld/runtime/src/ui/questlog.ts'
import { element, windowManager, type UiWindow } from '@openworld/runtime/src/ui/components/index.ts'

const L = (en: string, zh: string) => ({ en, zh })

/** Fixtures exercise the real journal's layout and interactions without starting the simulation. */
function quests(): JournalQuest[] {
  return [
    {
      id: 'descent', quest: 'descent', kind: 'main', state: 'active', tracked: true,
      title: L('Down from the Mountain', '下山'),
      summary: L('You woke on the mountain with a fairy at your side. Go down: past the old shrine stone at the Mountain Foot, down the cliff stair to the Ford, and west to the village there.', '你在山上醒来，身边多了一个精灵。下山吧：经过山脚的古老路碑，顺着悬崖台阶下到渡口，再往西去那里的村子。'),
      objectives: [
        { id: 'stone', text: L('The shrine stone at the Mountain Foot', '山脚的路碑'), state: 'open', where: L('Mountain Foot', '山脚') },
        { id: 'try', text: L('Try something the world has never seen', '做一件世界从没见过的事'), state: 'open' },
      ],
      log: [{ stage: 10, tick: 1, text: L('Lumi says the way down is south, to the foot of the mountain.', '露米说下山的路在南边，通往山脚。') }],
    },
    {
      id: 'letters', quest: 'letters', kind: 'side', state: 'active', tracked: false,
      title: L('A bundle of letters for the keeper of the old northern watchtower', '送往北方旧瞭望塔的一捆来信'),
      giver: L('Rowan, elder of Firstlight Village', '初原村长老罗万'),
      summary: L('The river has carried a traveller’s letters far from the road. Gather the pages along the bank, ask the ferryman which path is still safe, and take the bundle to the keeper before you continue north.', '旅人的来信被河水带离了道路。沿着河岸找回散落的信页，向摆渡人打听还能通行的小路，再把来信送给守塔人，然后继续向北走。'),
      objectives: [
        { id: 'pages', text: L('Collect the scattered letters beneath the broken bridge and beside the reeds on the far bank', '在断桥下和对岸芦苇旁找回散落的来信'), state: 'open', have: 3, need: 8, where: L('The far bank of the northern river', '北方河流的对岸') },
        { id: 'ferryman', text: L('Ask the ferryman about the path to the watchtower', '向摆渡人打听通往瞭望塔的小路'), state: 'open', optional: true, where: L('Mountain Foot', '山脚') },
        { id: 'rowan', text: L('Speak to Rowan at Firstlight Village', '在初原村与罗万交谈'), state: 'done' },
      ],
      log: [
        L('Rowan found an empty satchel by the river. The letters inside may still be caught among the reeds.', '罗万在河边找到一个空挎包。里面的来信也许还挂在芦苇丛中。'),
        L('The old bridge has fallen. There is a shallow crossing farther upstream, beyond the fallen willow.', '旧桥已经坍塌。沿河往上游走，倒下的柳树后有一处浅滩。'),
        L('Three letters are safe in my pack. The remaining pages drifted toward the northern bank.', '行囊里已经收好了 3 封信，其余信页漂向了北岸。'),
        L('A familiar seal marks one of the envelopes. The keeper may know why the road has been so quiet.', '有个信封上盖着熟悉的印记。守塔人也许知道路上为何如此冷清。'),
      ].map((text, i) => ({ stage: (i + 1) * 10, tick: i + 1, text })),
    },
    {
      id: 'camp', quest: 'camp', kind: 'guide', state: 'done', tracked: false,
      title: L('A place beside the fire', '篝火旁的一席之地'),
      summary: L('The first campfire is burning. There is a warm place to return to after the journey.', '第一处篝火已经点燃。旅途结束后，有了一个温暖的落脚处。'),
      objectives: [{ id: 'fire', text: L('Build a campfire by the shelter', '在避风处建起篝火'), state: 'done', have: 1, need: 1 }],
      log: [{ stage: 100, tick: 1, text: L('The fire is lit, and Lumi has settled beside it.', '篝火点起来了，露米在火边坐了下来。') }],
    },
    {
      id: 'herbs', quest: 'herbs', kind: 'favor', state: 'failed', tracked: false,
      title: L('Herbs before the rain', '雨落之前的草药'),
      summary: L('The storm arrived before the herbs could be delivered. The herbalist will have to wait for clearer weather.', '草药还没送到，暴雨就来了。草药师只能等天气好转后再出发。'),
      objectives: [{ id: 'deliver', text: L('Deliver the herbs before the storm', '在暴雨来临前送达草药'), state: 'failed', have: 2, need: 5 }],
      log: [{ stage: 100, tick: 1, text: L('The river rose and covered the path to the cottage.', '河水涨起来，淹没了通往小屋的路。') }],
    },
  ]
}

export function createQuestSample(onClose: () => void, onTrack: (tracked: boolean) => void): UiWindow {
  const root = element('div', 'ui-overlay overlay hidden')
  document.body.append(root)
  // QuestLog only reads Frame.quests. Keep this fixture independent of world/rendering setup.
  const frame = { quests: { journal: quests(), tracked: 'descent', marks: {}, targets: [], board: [] } } as unknown as Frame
  class SampleJournal extends QuestLog {
    override render(next: Frame): void {
      super.render(next)
      const surface = root.querySelector<HTMLElement>('.ql-sheet')!
      surface.id = 'sample-window'
      surface.dataset.sample = 'quests'
      if (!surface.querySelector('.ui-window-foot')) surface.append(element('footer', 'ui-window-foot'))
    }
  }
  const journal = new SampleJournal(root, onClose, {
    track(id) {
      frame.quests.tracked = id
      frame.quests.journal.forEach((quest) => { quest.tracked = quest.id === id })
      journal.render(frame)
      onTrack(!!id)
    },
    board() {},
  })
  journal.render(frame)
  root.addEventListener('mousedown', (event) => { if (event.target === root) onClose() })
  return {
    root,
    get surface() { return root.querySelector<HTMLElement>('.ql-sheet')! },
    get body() { return root.querySelector<HTMLElement>('.ui-window-body')! },
    get footer() { return root.querySelector<HTMLElement>('.ui-window-foot')! },
    show() { windowManager().closeMain(this.surface); journal.show(frame); windowManager().sync() },
    hide() { root.classList.add('hidden'); windowManager().sync() },
    destroy() { root.remove(); windowManager().sync() },
  }
}
