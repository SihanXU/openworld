"""Add draft jobs to queue.json: python -I addjobs.py outfits|kids|hats|beards|worn

kids: the children's outfits, drafted on the child's own frames drawn big (kid/src/child-<facing>.png, written from
bg/CHILD_*.txt here), since no draft of a bald child fits our child.
"""
import json, os, sys
SRC = {
    ('left', 'man'): 'drafts/l-man-33.png', ('left', 'woman'): 'drafts/l-woman-33.png',
    ('down', 'man'): 'drafts/front-man-e7.png', ('down', 'woman'): 'drafts/front-woman-e32.png',
    ('up', 'man'): 'drafts/back-man-e32.png', ('up', 'woman'): 'drafts/back-woman-e32.png',
}
KEEP = ('Change nothing else: the same pose, view, size and position, the same bald head, face and body, the same '
        'big-block pixel art style with a 1-pixel dark outline, plain white background.')
OUTFITS = {
    'workdress': (['woman'], 'a moss-green long work dress down to the ankles with long sleeves, a cream linen apron tied over it and a brown leather belt, simple brown shoes'),
    'shawl': (['woman'], 'a long plum-purple dress down to the ankles with long sleeves and an oatmeal wool shawl wrapped over the shoulders, simple brown shoes'),
    'oilcloth': (['man', 'woman'], 'a knee-length ochre-yellow oilcloth coat buttoned up, with long sleeves, over dark brown trousers and brown boots'),
    'robe': (['woman'], "a long forest-green herbalist's robe down to the ankles with long wide sleeves, a cream linen collar and a brown leather belt with small pouches, brown shoes"),
    'coat': (['man', 'woman'], "a long dark indigo scholar's coat down to the knees with long sleeves and brass buttons, a cream shirt collar, dark trousers and brown shoes"),
    'vestment': (['man', 'woman'], "a long ivory priest's vestment down to the ankles with long sleeves, a dark red stole hanging down the front from the neck, gold trim at the hems, brown shoes"),
    'tunic': (['man'], 'a moss-green tunic down to the thighs with long sleeves, belted at the waist with a brown leather belt, dark brown trousers and brown leather boots'),
    'workshirt': (['man'], 'a cream linen work shirt with the sleeves rolled up to the elbows, dark brown trousers held by braces, brown leather boots'),
    'apron': (['man'], "a long dark brown leather smith's apron over a sleeveless cream undershirt, bare muscular arms, dark brown trousers and boots"),
    'travel': (['man', 'woman'], 'a rust-red travelling coat down to the thighs with long sleeves, a cream shirt, brown leather satchel straps crossing the chest, dark trousers and brown boots'),
    'gambeson': (['man'], "a dark red guard's tabard over a padded oatmeal gambeson with long sleeves, a belt, grey iron gauntlets and dark trousers with iron-capped boots"),
    'plate': (['man'], 'steel plate armour on the arms and legs under a long ivory surcoat with gold trim belted at the waist'),
    'gi': (['man'], "an undyed cream martial-arts wrap jacket with wide short sleeves, a dark brown sash belt and loose dark brown trousers, barefoot sandals"),
    'cloak': (['man', 'woman'], 'a long charcoal-grey hooded cloak hanging from the shoulders down to the ankles with the hood down, over slate-grey clothes and brown boots'),
}
what = sys.argv[1]
jobs = json.load(open('queue.json')) if os.path.exists('queue.json') else []
have = {j['out'] for j in jobs}
new = []
if what == 'outfits':
    for o, (bodies, desc) in OUTFITS.items():
        for b in bodies:
            for f in ('left', 'down', 'up'):
                new.append({'out': f'drafts/outfit-{o}-{b}-{f}.png', 'src': SRC[(f, b)], 'seed': 32,
                            'prompt': f'Dress this character in {desc}, replacing the grey underclothes. {KEEP}'})
HATS = {
    'straw': ('man', 'a wide-brimmed ochre straw hat'),
    'kerchief': ('woman', 'a rust-red cloth headscarf covering the head and tied at the nape'),
    'hood': ('man', 'a charcoal-grey cloth hood pulled up over the head, its edge framing the face, falling onto the shoulders'),
    'helm': ('man', "a grey iron soldier's helmet with a rounded top and a short nose guard"),
    'cap': ('man', 'a soft umber flat cap with a short dark leather peak'),
    'circlet': ('woman', 'a thin gold circlet worn around the head across the forehead'),
    'thorns': ('man', 'a crown of brown thorny branches wound around the head'),
}
BEARDS = {
    'full': 'a full dark brown beard covering the jaw and chin, joined to a moustache',
    'moustache': 'a thick dark brown moustache, no beard',
    'stubble': 'short dark stubble on the jaw, chin and upper lip',
}
WORN = {
    'plate': ('a grey iron breastplate strapped over the chest and belly', 'iron breastplate'),
    'cloak': ('an oatmeal wool cloak hanging from the shoulders down to the ankles, clasped at the neck, hood down', 'cloak'),
    'pauldrons': ('grey iron pauldrons on both shoulders', 'pauldrons'),
}
if what == 'hats':
    for h, (b, desc) in HATS.items():
        for f in ('left', 'down', 'up'):
            new.append({'out': f'drafts/hat-{h}-{f}.png', 'src': SRC[(f, b)], 'seed': 32,
                        'prompt': f'Put {desc} on this bald character. {KEEP}'})
if what == 'beards':
    for h, desc in BEARDS.items():
        for f in ('left', 'down'):
            new.append({'out': f'drafts/beard-{h}-{f}.png', 'src': SRC[(f, 'man')], 'seed': 32,
                        'prompt': f'Give this man {desc}. {KEEP}'})
if what == 'worn':
    for w, (desc, _) in WORN.items():
        for b in ('man', 'woman'):
            for f in ('left', 'down', 'up'):
                new.append({'out': f'drafts/worn-{w}-{b}-{f}.png', 'src': SRC[(f, b)], 'seed': 32,
                            'prompt': f'Dress this character in {desc}, over the grey underclothes. {KEEP}'})
KIDS = {
    'smock': "a loose woad-blue child's smock down to the knees with short sleeves and a cream linen collar, simple brown shoes",
    'pinafore': 'a rose-pink pinafore dress down to the knees with shoulder straps over a cream short-sleeved blouse, simple brown shoes',
}
if what == 'kids':
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from PIL import Image
    from px import read, sprite
    S = 20
    os.makedirs('kid/src', exist_ok=True)
    for f in ('down', 'left', 'up'):
        sp = sprite(*read(f'bg/CHILD_{f.upper()}.txt')).resize((24 * S, 36 * S), Image.NEAREST)
        im = Image.new('RGB', (768, 768), (255, 255, 255))
        im.paste(sp, ((768 - 24 * S) // 2, (768 - 36 * S) // 2), sp)
        im.save(f'kid/src/child-{f}.png')
    for o, desc in KIDS.items():
        for f in ('left', 'down', 'up'):
            new.append({'out': f'drafts/outfit-{o}-child-{f}.png', 'src': f'kid/src/child-{f}.png', 'seed': 32,
                        'prompt': f'Dress this child in {desc}, replacing the grey underclothes. {KEEP}'})
jobs += [j for j in new if j['out'] not in have]
json.dump(jobs, open('queue.json', 'w'), indent=1)
print(len(jobs), 'jobs,', sum(1 for j in jobs if not os.path.exists(j['out'])), 'to make')
