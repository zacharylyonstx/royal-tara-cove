import { create } from 'zustand';
import type { CharacterId } from '../types';

export interface ChatMsg {
  /** Globally unique-ish: `${senderPeerId}-${localCounter}`. */
  id: string;
  characterId: CharacterId;
  text: string;
  sentAt: number;
}

const MAX_MESSAGES = 30;
const BUBBLE_DURATION_MS = 6000;

interface ChatStore {
  inputOpen: boolean;
  messages: ChatMsg[];
  openInput: () => void;
  closeInput: () => void;
  appendMessage: (m: ChatMsg) => void;
  /** Newest message for `characterId` younger than 6s, or null. */
  recentBubbleFor: (characterId: CharacterId, now: number) => ChatMsg | null;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  inputOpen: false,
  messages: [],
  openInput: () => set({ inputOpen: true }),
  closeInput: () => set({ inputOpen: false }),
  appendMessage: (m) =>
    set((s) => ({
      messages: [...s.messages, m].slice(-MAX_MESSAGES),
    })),
  recentBubbleFor: (characterId, now) => {
    const msgs = get().messages;
    for (let i = msgs.length - 1; i >= 0; i--) {
      const m = msgs[i];
      if (m.characterId !== characterId) continue;
      if (now - m.sentAt > BUBBLE_DURATION_MS) return null;
      return m;
    }
    return null;
  },
}));

export const CHAT_BUBBLE_DURATION_MS = BUBBLE_DURATION_MS;

if (typeof window !== 'undefined' && import.meta.env.DEV) {
  (window as unknown as { __chat?: unknown }).__chat = useChatStore;
}
