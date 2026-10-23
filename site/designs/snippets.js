// The code behind the pictures, shared by the designs: the base rules as games/openworld/content holds them (shortened),
// with a few summaries of the systems' data.
const SNIPPETS = {
    scene: `<span class="code-cap">Firstlight Village · day 1 · 11:00</span><span class="k">map</span>     meadow        <span class="c">// 60 × 40, region frostfang</span>
<span class="k">person</span>  sister_ilse   <span class="f">schedule</span> → square
<span class="k">person</span>  marta         <span class="f">work</span> → cookfire
<span class="k">fixture</span> fire_pit      <span class="b">lit</span>
<span class="k">crop</span>    tomato        <span class="b">stage 3/4</span> · watered
<span class="k">thing</span>   bucket        <span class="b">liquid:water</span>
<span class="c">// every thing is typed and tagged:</span>
<span class="c">// rules address classes, never one bucket</span>`,

    coat: `<span class="code-cap">rule · core/coat</span><span class="k">on</span> impulse/coat
<span class="k">IF</span> substance = <span class="b">oil</span> ∧ ¬ <span class="f">tag</span>(host, water)
   <span class="k">DO</span> <span class="f">add</span>(oiled) <span class="f">vfx</span>(splash)
<span class="k">ELSE</span> <span class="h">HOLE</span>   <span class="c">// no one wrote this</span>`,

    learned: `<span class="code-cap">rule · use/oil  (host: liquid:oil)</span><span class="k">label</span> "Pour oil on {target}"
<span class="k">IF</span> actor = target ∨ <span class="f">is</span>(target, water)
   <span class="k">inherit</span>
<span class="k">DO</span> <span class="f">emit</span>(coat → target, substance <span class="b">oil</span>)
   <span class="f">transform</span>(into empty flask)
   <span class="f">log</span>("Slick oil coats {target}.")`,

    fire: `<span class="code-cap">rule · core/element (fire)</span><span class="k">IF</span> oiled ∧ ¬wet ∧ ¬frozen
   <span class="k">DO</span> <span class="f">remove</span>(oiled) <span class="f">add</span>(burning)
      <span class="f">emit</span>(element fire, radius 1)
<span class="k">IF</span> wet     <span class="k">DO</span> <span class="f">remove</span>(wet) <span class="f">vfx</span>(steam)
<span class="k">IF</span> frozen  <span class="k">DO</span> <span class="f">remove</span>(frozen) <span class="f">add</span>(wet)
<span class="k">IF</span> lightable ∧ ¬lit  <span class="k">DO</span> <span class="f">add</span>(lit)`,

    quality: `<span class="code-cap">options · the AI</span>             off  low  medium  high
<span class="f">things</span>        ·    ·     <span class="h">●</span>      ·
<span class="f">people</span>        ·    ·     <span class="h">●</span>      ·
<span class="f">the world</span>     ·    ·     <span class="h">●</span>      ·
<span class="f">new kinds</span>     ·    <span class="h">●</span>    ·      ·
<span class="c">// the same wait at every level:</span>
<span class="c">// a level is how much the AI does in it</span>`,

    person: `<span class="code-cap">a person</span><span class="k">home</span>      meadow.church
<span class="k">schedule</span>  dawn → chapel · noon → square
<span class="k">memory</span>    deeds seen · who saw them
<span class="k">regard</span>    rises and falls; gossip carries it
<span class="k">look</span>      body · a part per slot · colours
<span class="c">// one look: the map sprite, the portrait</span>
<span class="c">// and the words the modder reads</span>`,

    boss: `<span class="code-cap">kit · alberic, the White Knight</span><span class="k">skill</span> thorns  "Thorns Bend the Knee"
      ring · radius 4 · windup 20 · recovery 14
<span class="k">skill</span> toll    "None Cross Unkneeling"
      line · radius 12 · windup 14
<span class="k">phase</span> 1  arrow → volley → thorns → arrow → toll
<span class="k">rule</span>  boss/alberic: thorns <span class="f">cut</span> + <span class="f">kneel</span>
<span class="c">// every wind-up is drawn on the ground first</span>`,

    continent: `<span class="code-cap">the continent</span><span class="k">maps</span>        1,024   <span class="c">// 965 of them backdrop</span>
<span class="k">people</span>      1,654
<span class="k">creatures</span>     304
<span class="k">item kinds</span>  2,029
<span class="k">regions</span>         6   <span class="c">// round the Holy City</span>
<span class="c">// maps far behind are frozen and</span>
<span class="c">// catch up when you come back</span>`,
}
document.querySelectorAll('[data-code]').forEach((el) => { el.innerHTML = SNIPPETS[el.dataset.code] ?? '' })
