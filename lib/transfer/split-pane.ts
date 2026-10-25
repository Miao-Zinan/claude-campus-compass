/** Desktop chat/Details split. Ratios are the chat panel's share of the width left after the separator. */
export const SPLIT_DEFAULT_CHAT_RATIO = 0.7;
export const SPLIT_MIN_CHAT_PX = 440;
export const SPLIT_MIN_DETAILS_PX = 280;
export const SPLIT_SEPARATOR_PX = 20;
export const SPLIT_KEYBOARD_STEP = 0.02;

/** True when the workspace container can hold both minimum panel widths plus the separator. */
export function canSplit(containerWidth: number) {
  return containerWidth >= SPLIT_MIN_CHAT_PX + SPLIT_MIN_DETAILS_PX + SPLIT_SEPARATOR_PX;
}

export function chatRatioBounds(containerWidth: number) {
  const available = containerWidth - SPLIT_SEPARATOR_PX;
  if (!canSplit(containerWidth)) return { min: SPLIT_DEFAULT_CHAT_RATIO, max: SPLIT_DEFAULT_CHAT_RATIO };
  return { min: SPLIT_MIN_CHAT_PX / available, max: 1 - SPLIT_MIN_DETAILS_PX / available };
}

export function clampChatRatio(ratio: number, containerWidth: number) {
  const { min, max } = chatRatioBounds(containerWidth);
  if (!Number.isFinite(ratio)) return SPLIT_DEFAULT_CHAT_RATIO;
  return Math.min(max, Math.max(min, ratio));
}

/** Ratio for a pointer at clientX, with the separator centred under the pointer. */
export function chatRatioFromPointer(clientX: number, containerLeft: number, containerWidth: number) {
  const available = containerWidth - SPLIT_SEPARATOR_PX;
  return clampChatRatio((clientX - containerLeft - SPLIT_SEPARATOR_PX / 2) / available, containerWidth);
}

export function nudgeChatRatio(ratio: number, direction: -1 | 1, containerWidth: number) {
  return clampChatRatio(clampChatRatio(ratio, containerWidth) + direction * SPLIT_KEYBOARD_STEP, containerWidth);
}

/**
 * Grid columns driven by the --chat-ratio custom property. The CSS clamp keeps both minimum widths
 * while the window resizes, without re-rendering, and the remaining width always goes to Details.
 */
export const SPLIT_GRID_TEMPLATE =
  `clamp(${SPLIT_MIN_CHAT_PX}px, calc((100% - ${SPLIT_SEPARATOR_PX}px) * var(--chat-ratio)), calc(100% - ${SPLIT_SEPARATOR_PX + SPLIT_MIN_DETAILS_PX}px)) ` +
  `${SPLIT_SEPARATOR_PX}px minmax(0, 1fr)`;
