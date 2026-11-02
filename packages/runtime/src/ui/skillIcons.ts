/// <reference types="vite/client" />

// Original, full-colour illustrated pixel art only. Every skill has a distinct PNG;
// no generic SVG glyphs are substituted, even when an image fails to load.

import { assetsBase } from '../game.ts'

export const SKILL_ART_KEYS = [
  'origin', 'sword', 'shield', 'hammer', 'sweep', 'heart', 'drumstick', 'hardy', 'renew',
  'magnet', 'axe', 'pack', 'flame', 'swift', 'farming', 'ranching', 'smithing',
  'assassin', 'dagger', 'critical', 'shadow', 'combo',
  'quick-hands', 'battle-tempo', 'evasive-step', 'pursuit', 'windrunner',
  'executioner', 'deadly-focus', 'defiance', 'last-stand', 'blade-mastery',
  'shadow-recovery', 'death-dance',
  'nimble', 'acrobat', 'dash', 'slipstream', 'tailwind', 'phantom-step', 'untouchable',
  'brute', 'precision', 'hemorrhage', 'lethal-edge', 'brutal', 'first-strike', 'momentum', 'berserker',
  'iron-will', 'thick-skin', 'fortress', 'frugal', 'hearty-meals', 'regeneration', 'adrenaline', 'phoenix',
  'warrior-arms', 'bulwark', 'unbreakable', 'retaliation', 'rampage', 'warlord',
  'ranger-archery', 'steady-aim', 'sniper', 'fleet-archer', 'quick-draw', 'hunters-mark',
  'mage-focus', 'elemental-attunement', 'spell-echo', 'mana-shield', 'arcane-recovery', 'archmage',
  'warrior', 'ranger', 'mage',
  // the active skills (tools/src/art/skill-actives.ts)
  'whirlwind', 'cleave', 'gale-step', 'mend',
  'shadow-strike', 'envenom', 'smoke-bomb', 'flurry',
  'shield-bash', 'charge', 'war-cry', 'earthsplitter',
  'multishot', 'leap-shot', 'piercing-arrow', 'arrow-rain',
  'fireball', 'frost-nova', 'chain-lightning', 'blink',
  // the professions, deeper (tools/src/art/skill-professions-a.ts, -b.ts)
  'throwing-knives', 'fan-of-knives', 'vanishing-strikes', 'shadow-mastery', 'potent-venom', 'lingering-smoke',
  'flurry-plus', 'fan-plus', 'venom-mastery', 'nightstalker', 'nimble-blade', 'master-assassin',
  'wide-slash', 'iron-guard', 'heaven-splitter', 'bash-plus', 'charge-plus', 'war-cry-plus',
  'quake-plus', 'slash-plus', 'shield-wall', 'bloodthirst', 'fortitude', 'undying-spirit',
  'concussive-shot', 'hawk-eye', 'arrow-storm', 'multishot-plus', 'leap-plus', 'pierce-plus',
  'rain-plus', 'concussive-plus', 'light-gear', 'deadly-shot', 'windwalker', 'marksman',
  'frost-bolt', 'thunderstorm', 'meteor', 'fireball-plus', 'nova-plus', 'chain-plus',
  'blink-plus', 'frost-bolt-plus', 'mana-surge', 'elementalist', 'arcane-barrier', 'elemental-master',
  // the advancements: paths, masteries, the first trees' four more (tools/src/art/skill-adv-*.ts, docs/advancement.md)
  'grave-toxin', 'miasma', 'raise-dead', 'corpse-burst', 'grave-pact', 'army-of-the-dead', 'shadow-poise', 'umbral-step',
  'blur', 'unseen', 'riposte', 'thousand-shadows', 'hunters-lore', 'binding-sigil', 'hunt-call', 'hex-edge',
  'hunters-vigil', 'demon-prison', 'drive-the-dead', 'toxic-burst', 'bone-ward', 'raise-dead-plus', 'rot', 'toxic-burst-plus',
  'hell-pact', 'hell-guard', 'pestilence', 'soul-harvest', 'plague-lord', 'gate-of-the-styx', 'dominion-of-hell', 'lethality', 'death-mark', 'ghost', 'assassinate',
  'shadow-lord', 'garrote', 'caltrops', 'light-step', 'cut-deep', 'shieldbearer', 'bastion', 'challenge',
  'retort', 'unyielding', 'aegis', 'blood-fury', 'blood-rage', 'reaving-spin', 'carnage', 'pain-eater', 'leap-of-ruin',
  'thorned-mail', 'kneel', 'briar-line', 'crowns-due', 'hold-the-line', 'crown-of-thorns', 'iron-body', 'unbreakable-will',
  'weapon-master', 'godslayer', 'living-legend', 'hamstring', 'sunder', 'battle-hardened', 'sword-mastery',
  'eagle-eye', 'deadeye', 'ricochet', 'weak-point', 'patience', 'heartseeker', 'lay-of-the-land', 'snare-trap',
  'spike-trap', 'ambusher', 'tripwire', 'killing-field', 'pack-bond', 'call-the-hound', 'sic', 'feral-instinct',
  'pack-hunter', 'the-pack', 'hawks-patience', 'wind-arrow', 'fletcher', 'thousand-arrows', 'eagles-grace',
  'volley', 'disengage', 'keen-arrows', 'fleet-foot', 'kindling', 'flame-wall', 'combustion', 'conflagration',
  'ember-heart', 'inferno', 'rime', 'ice-lance', 'glacial-prison', 'shatter', 'frost-armour', 'blizzard',
  'dawnlight', 'sunburst', 'sanctuary', 'lantern-soul', 'mercy-of-dawn', 'daybreak', 'arcane-mastery', 'time-warp',
  'mana-flow', 'convergence', 'ascendance', 'arcane-missiles', 'mana-ward', 'focus', 'spell-power', 'path-necromancer',
  'path-shadowdancer', 'path-demonhunter', 'path-sentinel', 'path-berserker', 'path-thornknight', 'path-sharpshooter',
  'path-trapper', 'path-beastmaster', 'path-pyromancer', 'path-cryomancer', 'path-dawnbringer', 'mastery-assassin',
  'mastery-warrior', 'mastery-ranger', 'mastery-mage', 'mastery-necromancer', 'mastery-shadowdancer', 'mastery-demonhunter',
  'advance', 'path', 'mastery',
  // the life branches (tools/src/art/skill-life-*.ts)
  'sharp-axe', 'carpenter', 'forester', 'timber-master', 'prospector', 'heavy-pick', 'stonecutter', 'gem-finder',
  'deep-vein', 'forager', 'herbalist', 'angler', 'bait-saver', 'lucky-catch', 'deep-fisher', 'master-angler',
  'farmer', 'green-fingers', 'wide-hoe', 'bountiful', 'seed-merchant', 'perennial-keeper', 'fruit-farmer', 'berry-farmer',
  'irrigation', 'sprinkler', 'composter', 'rich-soil', 'grain-farmer', 'root-farmer', 'gourd-farmer', 'herb-gardener',
  'seed-saver', 'market-gardener', 'golden-harvest', 'master-farmer', 'herdsman', 'milker', 'egg-collector', 'breeder',
  'butcher', 'beekeeper', 'cheesemaker', 'dairy-master', 'coop-keeper', 'hen-whisperer', 'quick-breeder', 'stockman',
  'feed-maker', 'tanner', 'leatherworker', 'plucker', 'apiarist', 'royal-jelly', 'rancher', 'master-rancher',
  'apprentice-smith', 'forge-builder', 'efficient-smelting', 'weaponsmith', 'armorsmith', 'fine-craft', 'steelworking', 'goldsmith',
  'jeweler', 'ore-merchant', 'tool-smith', 'keen-edge', 'heavy-arms', 'master-weaponsmith', 'plate-work', 'reinforced',
  'master-armorsmith', 'masterwork', 'legendary-smith', 'grandmaster-smith',
] as const

const known = new Set<string>(SKILL_ART_KEYS)
const artKey = (key: string | undefined): string => key && known.has(key) ? key : 'origin'

export const skillPng = (key: string): string => `${assetsBase()}lsw/skills/${artKey(key)}.png`

export const skillArt = (key: string | undefined): string => {
  const icon = artKey(key)
  return `<span class="sk-art"><img class="sk-png" data-icon="${icon}" src="${skillPng(icon)}" alt="" draggable="false"></span>`
}

/** A failed request gets our illustrated origin emblem, never a line-art version. */
export function bindSkillArt(host: ParentNode): void {
  host.querySelectorAll<HTMLImageElement>('img.sk-png').forEach((img) => {
    img.onerror = () => {
      if (img.dataset.icon !== 'origin' && img.dataset.fallback !== 'origin') {
        img.dataset.fallback = 'origin'
        img.src = skillPng('origin')
      } else img.hidden = true
    }
  })
}
