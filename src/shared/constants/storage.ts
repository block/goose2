/**
 * Storage path constants.
 *
 * All persistent data lives under ~/.goose/ to stay consistent with the
 * goose CLI and goose2.0 desktop app.
 */

/** Root directory for all Goose data. */
export const GOOSE_DIR = ".goose";

/** Subdirectory for saved recipes / skills. */
export const RECIPES_DIR = `${GOOSE_DIR}/recipes`;

/** Subdirectory for agent configurations. */
export const AGENTS_DIR = `${GOOSE_DIR}/agents`;

/** Subdirectory for session history. */
export const SESSIONS_DIR = `${GOOSE_DIR}/sessions`;

/** Subdirectory for extension state. */
export const EXTENSIONS_DIR = `${GOOSE_DIR}/extensions`;

/**
 * Cross-agent standard directory for skills and agents.
 * See https://agentskills.io
 */
export const AGENTS_STANDARD_DIR = ".agents";

/** Subdirectory for skills (under ~/.agents/). */
export const SKILLS_DIR = `${AGENTS_STANDARD_DIR}/skills`;
