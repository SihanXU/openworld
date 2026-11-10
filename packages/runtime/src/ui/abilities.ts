import { Frame } from '@openworld/engine';
import type { Text } from '@openworld/engine';
import type { WorkshopView } from '../protocol.ts';

export interface Ability {
  id: string;
  revision: number;
  use: string;
  item: string;
  label: string;
  family: string;
  detail: string;
  target: string;
}

export const QUICK_CAPABILITIES = ['channel', 'empower'] as const;

interface ItemInfo {
  id: string;
  type: string;
}

function localize(text: Text, zh: boolean): string {
  if (typeof text === 'string') return text;
  return zh ? text.zh ?? text.en : text.en;
}

export function abilityFamily(capability: string | undefined, element: unknown): string {
  if (capability === 'channel') {
    return typeof element === 'string' ? element : String(element);
  }
  return 'empower';
}

export function abilityDetail(
  capability: string | undefined,
  params: Record<string, unknown> | undefined,
  zh: boolean,
): string {
  const cost = typeof params?.cost === 'number' ? params.cost : capability === 'channel' ? 2 : 10;
  const cooldown = typeof params?.cooldown === 'number' ? params.cooldown : capability === 'channel' ? 10 : 200;
  const variantChance = typeof params?.variantChance === 'number' ? params.variantChance : 0;
  const parts: string[] = [];
  parts.push(zh ? `饱食${cost}` : `fullness ${cost}`);
  parts.push(zh ? `冷却${(cooldown / 10).toFixed(1).replace(/\.0$/, '')}s` : `cooldown ${(cooldown / 10).toFixed(1).replace(/\.0$/, '')}s`);
  if (variantChance > 0) {
    parts.push(zh ? `变体${Math.round(variantChance * 100)}%` : `variant ${Math.round(variantChance * 100)}%`);
  }
  return parts.join(' · ');
}

export function quickAbilities(frame: Frame | undefined, views: WorkshopView[], zh: boolean): Ability[] {
  if (!frame) return [];
  const worn = Object.values(frame.player.worn ?? {}) as ItemInfo[];
  const held = frame.player.held as ItemInfo | undefined;
  const out: Ability[] = [];

  for (const view of views) {
    if (!view.adopted || !view.typeId) continue;

    let matchedItem: ItemInfo | undefined = worn.find((item) => item.type === view.typeId);
    if (!matchedItem && held?.type === view.typeId && /^item\/weapon\/magic(?:\/|$)/.test(view.typeId)) {
      matchedItem = held;
    }
    if (!matchedItem) continue;

    for (const use of view.uses) {
      if (use.capability !== 'channel' && use.capability !== 'empower') continue;
      if (use.status !== 'tested') continue;

      const familyStr = use.capability === 'channel'
        ? (typeof use.params?.element === 'string' ? use.params.element : '')
        : 'empower';
      let label = localize(use.label, zh);
      if (!label && use.capability === 'channel') {
        label = ({ fire: '御火', wind: '御气', water: '御水', earth: '御土' } as Record<string, string>)[familyStr] ?? (zh ? '御气' : 'Wind');
      }

      out.push({
        id: view.id,
        revision: view.revision,
        use: use.id,
        item: matchedItem.id,
        label,
        family: familyStr,
        detail: abilityDetail(use.capability, use.params as Record<string, unknown> | undefined, zh),
        target: use.capability === 'empower' ? (use.targetId ?? 'self') : (use.targetId ?? 'creature'),
      });
    }
  }

  return out;
}

export function keepSelection(list: Ability[], selected: Ability | undefined): Ability | undefined {
  if (!selected) return undefined;
  return list.find(
    (a) =>
      a.id === selected.id &&
      a.revision === selected.revision &&
      a.use === selected.use &&
      a.item === selected.item,
  );
}

export function cycleAbility(
  list: Ability[],
  selected: Ability | undefined,
  dir: 1 | -1 = 1,
): Ability | undefined {
  const filtered = list.filter((a) => a.target !== 'self' && a.family !== 'empower');
  if (filtered.length === 0) return undefined;

  const idx = selected
    ? filtered.findIndex(
        (a) =>
          a.id === selected.id &&
          a.revision === selected.revision &&
          a.use === selected.use &&
          a.item === selected.item,
      )
    : -1;

  if (idx < 0) {
    return dir === 1 ? filtered[0] : filtered[filtered.length - 1];
  }

  const next = (idx + dir + filtered.length) % filtered.length;
  return filtered[next];
}
