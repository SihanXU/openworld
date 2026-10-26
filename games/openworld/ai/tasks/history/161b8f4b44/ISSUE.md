# Crafting panel shows no icon for structures; structures are named "Wooden …" redundantly

## What is wrong

Two related problems:

1. **Missing icons in the crafting panel.** The panel looks up each recipe's result icon (and tooltip info) only among the item forms. Anything that is not an item form (a bed, a wall, a floor, stairs, a door) has no entry, so it shows no picture.

2. **Redundant structure names.** The built structures are named with their material baked in: "Wooden Wall" (木墙), "Wooden Floor" (木地板), "Wooden Stairs" (木楼梯), "Wooden Door" (木门). When a recipe or action adds the material to the name (planks make a "Wooden Wall"), the result reads "Wooden Wooden Wall". Labels derived from the structure's name, such as the action to open a door, inherit this.

## Expected behaviour

- In the crafting panel, a recipe whose result type is not an item form still gets an entry, using the recipe's own sprite and its own name (plus the recipe's tags and props). Item-form results behave as before, using the form's sprite and info. A recipe with a non-form result but no sprite or no name of its own gets no entry (as before).
- Structure types are named by their form only:
  - `structure/wall`: "Wall" / 墙
  - `structure/floor`: "Floor" / 地板
  - `structure/stairs`: "Stairs" / 楼梯
  - `structure/door`: "Door" / 门
  - The open-door type keeps its name "Open Door" / 开着的门.
- What the thing is made of supplies the rest of the name: planks yield a "Wooden Wall" (木墙), not a "Wooden Wooden Wall".
- The action to open a closed door is labelled "Open Door" (previously "Open Wooden Door").

## Requirements

- The crafting panel's item list includes entries for recipes whose result is not an item form, built from the recipe's sprite and name.
- Entries for item-form results and for materials are unchanged.
- The four structure types above have the new English and Chinese names; nothing else about them (sprites, occupancy, props, makeup, station, tags) changes.
- Any label derived from a structure's name reflects the new name (e.g. "Open Door").

## Interface

None
