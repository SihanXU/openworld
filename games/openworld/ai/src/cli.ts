// What the drivers' command lines share.

/** A command line's `--k <value>`: the value (undefined when `--k` comes last), or `d` when there is no `--k`. */
export const flags = (argv: string[]) => (k: string, d?: string): string | undefined => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d)

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
