export const DEFAULT_CHAT_TITLE = "New Chat";

export function isDefaultChatTitle(title: string): boolean {
  return title === DEFAULT_CHAT_TITLE;
}

export function getDisplaySessionTitle(
  title: string,
  defaultTitle: string,
): string {
  return isDefaultChatTitle(title) ? defaultTitle : title;
}

export function getEditableSessionTitle(
  title: string,
  defaultTitle: string,
): string {
  return getDisplaySessionTitle(title, defaultTitle);
}

export function isSessionTitleUnchanged(
  nextTitle: string,
  currentTitle: string,
  defaultTitle: string,
): boolean {
  return nextTitle === getEditableSessionTitle(currentTitle, defaultTitle);
}
