import { describe, it, expect } from 'vitest';
import { quickAbilities, keepSelection, cycleAbility, abilityDetail, Ability } from '../src/ui/abilities.ts';
import { defaultKeys, actionOf } from '../src/keymap.ts';
import type { WorkshopView } from '../src/protocol.ts';
import type { Frame } from '@openworld/engine';

function beltItem(id = 'e1'): { id: string; type: string } {
  return { id, type: 'item/clothing/belt/custom' };
}

const beltViews = [
  {
    id: 'pkg',
    revision: 3,
    typeId: 'item/clothing/belt/custom',
    adopted: true,
    uses: [
      {
        id: 'fire',
        capability: 'channel',
        targetId: 'creature',
        label: { en: 'Fire', zh: '御火' },
        status: 'tested',
        params: { element: 'fire', variantChance: 0.25, cost: 2, cooldown: 10 },
      },
      {
        id: 'water',
        capability: 'channel',
        targetId: 'creature',
        label: { en: 'Water', zh: '御水' },
        status: 'tested',
        params: { element: 'water' },
      },
      {
        id: 'mode',
        capability: 'empower',
        targetId: 'self',
        label: 'Mode',
        status: 'tested',
        params: { cost: 10, cooldown: 200 },
      },
    ],
  },
] as unknown as WorkshopView[];

describe('quickAbilities', () => {
  it('offers 3 abilities for a worn accessory absent from frame.entities', () => {
    const frame = {
      player: {
        worn: { arm: beltItem('e1') },
        held: undefined,
      },
      entities: [],
    } as unknown as Frame;

    const list = quickAbilities(frame, beltViews, true);
    expect(list).toHaveLength(3);

    expect(list.map((a) => a.id)).toEqual(['pkg', 'pkg', 'pkg']);
    expect(list.map((a) => a.use)).toEqual(['fire', 'water', 'mode']);
    expect(list.map((a) => a.item)).toEqual(['e1', 'e1', 'e1']);
    expect(list.map((a) => a.revision)).toEqual([3, 3, 3]);

    const fire = list[0];
    expect(fire.item).toBe('e1');
    expect(fire.label).toBe('御火');
    expect(fire.family).toBe('fire');
    expect(fire.detail).toContain('25%');
    expect(fire.detail).toContain('饱食2');
    expect(fire.detail).toContain('冷却1s');
    expect(fire.target).toBe('creature');
    expect(fire.use).toContain('fire');

    const water = list[1];
    expect(water.label).toBe('御水');
    expect(water.family).toBe('water');

    const mode = list[2];
    expect(mode.target).toBe('self');
    expect(mode.label).toBe('Mode');
  });

  it('does not depend on world sprites', () => {
    const frame = {
      player: {
        worn: { arm: beltItem('e1') },
        held: undefined,
      },
      entities: [],
    } as unknown as Frame;
    const list = quickAbilities(frame, beltViews, false);
    expect(list).toHaveLength(3);
    expect(list[0].label).toBe('Fire');
  });

  it('offers 0 for a barely held/carried bracer without a worn slot', () => {
    const bracerViews = [
      {
        id: 'bracer',
        revision: 1,
        typeId: 'item/clothing/bracer/custom',
        adopted: true,
        uses: [
          {
            id: 'spark',
            capability: 'channel',
            targetId: 'creature',
            label: { en: 'Spark', zh: '火花' },
            status: 'tested',
            params: {},
          },
        ],
      },
    ] as unknown as WorkshopView[];

    const frame = {
      player: {
        worn: {},
        held: {
          id: 'bracer',
          type: 'item/clothing/bracer/custom',
        },
      },
      entities: [],
    } as unknown as Frame;

    expect(quickAbilities(frame, bracerViews, true)).toHaveLength(0);
  });

  it('offers a native magic focus that matches view.typeId and is held', () => {
    const magicViews = [
      {
        id: 'pkg',
        revision: 3,
        typeId: 'item/weapon/magic/focus',
        adopted: true,
        uses: beltViews[0].uses,
      },
    ] as unknown as WorkshopView[];

    const frame = {
      player: {
        worn: { arm: beltItem('e1') },
        held: { id: 'focus', type: 'item/weapon/magic/focus' },
      },
      entities: [],
    } as unknown as Frame;

    const list = quickAbilities(frame, magicViews, true);
    expect(list).toHaveLength(3);
    expect(list.map((a) => a.id)).toEqual(['pkg', 'pkg', 'pkg']);
    expect(list.map((a) => a.use)).toEqual(['fire', 'water', 'mode']);
  });

  it('offers nothing for an unrelated held type', () => {
    const frame = {
      player: {
        worn: {},
        held: { id: 'stick', type: 'item/weapon/staff/custom' },
      },
      entities: [],
    } as unknown as Frame;

    expect(quickAbilities(frame, beltViews, true)).toHaveLength(0);
  });

  it('excludes undefined frame', () => {
    expect(quickAbilities(undefined, beltViews, true)).toEqual([]);
  });

  it('excludes unadopted packages', () => {
    const unadopted = [
      {
        id: 'pkg',
        revision: 3,
        typeId: 'item/clothing/belt/custom',
        adopted: false,
        uses: beltViews[0].uses,
      },
    ] as unknown as WorkshopView[];

    const frame = {
      player: {
        worn: { arm: beltItem('e1') },
        held: undefined,
      },
      entities: [],
    } as unknown as Frame;

    expect(quickAbilities(frame, unadopted, true)).toHaveLength(0);
  });

  it('excludes not-tested branches and unrelated capabilities', () => {
    const views = [
      {
        id: 'pkg',
        revision: 3,
        typeId: 'item/clothing/belt/custom',
        adopted: true,
        uses: [
          {
            id: 'draft',
            capability: 'channel',
            targetId: 'creature',
            label: 'Draft',
            status: 'draft',
            params: {},
          },
          {
            id: 'generic',
            capability: 'build',
            targetId: 'block',
            label: 'Build',
            status: 'tested',
            params: {},
          },
        ],
      },
    ] as unknown as WorkshopView[];

    const frame = {
      player: {
        worn: { arm: beltItem('e1') },
        held: undefined,
      },
      entities: [],
    } as unknown as Frame;

    expect(quickAbilities(frame, views, true)).toHaveLength(0);
  });
});

describe('keepSelection', () => {
  const list: Ability[] = [
    {
      id: 'fire',
      revision: 3,
      use: 'pkg:fire',
      item: 'e1',
      label: 'Fire',
      family: 'fire',
      detail: '',
      target: 'creature',
    },
    {
      id: 'water',
      revision: 3,
      use: 'pkg:water',
      item: 'e1',
      label: 'Water',
      family: 'water',
      detail: '',
      target: 'creature',
    },
  ];

  it('stays undefined when selection is undefined', () => {
    expect(keepSelection(list, undefined)).toBeUndefined();
  });

  it('matches by id/revision/use/item and returns a fresh object', () => {
    const selected: Ability = {
      id: 'fire',
      revision: 3,
      use: 'pkg:fire',
      item: 'e1',
      label: 'Fire',
      family: 'fire',
      detail: '',
      target: 'creature',
    };
    const result = keepSelection(list, selected);
    expect(result).toBeDefined();
    expect(result).not.toBe(selected);
    expect(result).toEqual(list[0]);
    expect(result).toBe(list[0]);
  });

  it('clears when revision changes', () => {
    const selected: Ability = {
      id: 'fire',
      revision: 4,
      use: 'pkg:fire',
      item: 'e1',
      label: 'Fire',
      family: 'fire',
      detail: '',
      target: 'creature',
    };
    expect(keepSelection(list, selected)).toBeUndefined();
  });

  it('clears when removed', () => {
    const selected: Ability = {
      id: 'gone',
      revision: 3,
      use: 'pkg:gone',
      item: 'e1',
      label: 'Gone',
      family: 'gone',
      detail: '',
      target: 'creature',
    };
    expect(keepSelection(list, selected)).toBeUndefined();
  });
});

describe('cycleAbility', () => {
  const list: Ability[] = [
    {
      id: 'fire',
      revision: 3,
      use: 'pkg:fire',
      item: 'e1',
      label: 'Fire',
      family: 'fire',
      detail: '',
      target: 'creature',
    },
    {
      id: 'mode',
      revision: 3,
      use: 'pkg:mode',
      item: 'e1',
      label: 'Mode',
      family: 'empower',
      detail: '',
      target: 'self',
    },
    {
      id: 'water',
      revision: 3,
      use: 'pkg:water',
      item: 'e1',
      label: 'Water',
      family: 'water',
      detail: '',
      target: 'creature',
    },
    {
      id: 'boost',
      revision: 3,
      use: 'pkg:boost',
      item: 'e1',
      label: 'Boost',
      family: 'empower',
      detail: '',
      target: 'self',
    },
  ];

  it('cycles fire -> water -> fire', () => {
    expect(cycleAbility(list, list[0], 1)?.id).toBe('water');
    expect(cycleAbility(list, list[2], 1)?.id).toBe('fire');
  });

  it('cycles back water -> fire -> water', () => {
    expect(cycleAbility(list, list[2], -1)?.id).toBe('fire');
    expect(cycleAbility(list, list[0], -1)?.id).toBe('water');
  });

  it('skips self (mode) in both directions', () => {
    expect(cycleAbility(list, list[0], 1)?.id).toBe('water');
    expect(cycleAbility(list, list[2], -1)?.id).toBe('fire');
  });

  it('starts at first when unselected', () => {
    expect(cycleAbility(list, undefined, 1)?.id).toBe('fire');
  });

  it('starts at last when unselected and going backward', () => {
    expect(cycleAbility(list, undefined, -1)?.id).toBe('water');
  });

  it('returns undefined for empty list', () => {
    expect(cycleAbility([], undefined, 1)).toBeUndefined();
  });

  it('returns undefined for mode-only list', () => {
    const modeOnly = [list[1], list[3]];
    expect(cycleAbility(modeOnly, undefined, 1)).toBeUndefined();
    expect(cycleAbility(modeOnly, list[1], 1)).toBeUndefined();
  });
});

describe('abilityDetail', () => {
  it('displays paid cost as fullness, cooldown ticks/10 sec, variant chance percentage', () => {
    const params = {
      element: 'fire',
      variantChance: 0.25,
      cost: 2,
      cooldown: 10,
    };
    const detail = abilityDetail('channel', params, false);
    expect(detail).toContain('fullness');
    expect(detail).toContain('2');
    expect(detail).toContain('cooldown');
    expect(detail).toContain('1');
    expect(detail).toContain('25%');
    expect(detail).not.toContain('.25%');

    const zhDetail = abilityDetail('channel', params, true);
    expect(zhDetail).toContain('饱食');
    expect(zhDetail).toContain('2');
    expect(zhDetail).toContain('冷却');
    expect(zhDetail).toContain('1');
    expect(zhDetail).toContain('25%');
  });

  it('uses defaults: 2 cost / 10 cooldown for channel', () => {
    const detail = abilityDetail('channel', {}, false);
    expect(detail).toContain('fullness');
    expect(detail).toContain('2');
    expect(detail).toContain('cooldown');
    expect(detail).toContain('1');
  });

  it('uses defaults: 10 cost / 200 cooldown for empower', () => {
    const detail = abilityDetail('empower', {}, false);
    expect(detail).toContain('fullness');
    expect(detail).toContain('10');
    expect(detail).toContain('cooldown');
    expect(detail).toContain('20');
  });
});

describe('keymap', () => {
  it('maps default keys', () => {
    expect(actionOf(defaultKeys(), 'KeyZ', false)).toBe('ability');
    expect(actionOf(defaultKeys(), 'Digit1', false)).toBe('slot1');
    expect(actionOf(defaultKeys(), 'Digit1', true)).toBe('cast1');
    expect(actionOf(defaultKeys(), 'KeyQ', false)).toBe('dash');
  });
});
