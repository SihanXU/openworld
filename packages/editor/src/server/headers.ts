// What the editor's page and its service share (no node in it: the page imports it too).

/** The header every change carries (a custom header: a page of another origin cannot send it without our leave). */
export const HEADER = 'x-openworld-editor'
