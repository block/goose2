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
