import type { CharacterDef, CharacterId } from '../types';

export const CHARACTERS: Record<CharacterId, CharacterDef> = {
  dad: {
    id: 'dad',
    name: 'Dad',
    emoji: '👨',
    height: 1.85,
    bodyColor: '#3a6db0',
    pantsColor: '#262834',
    hairColor: '#3a2818',
    skinTone: '#e8c39d',
    shoeColor: '#1f1f1f',
  },
  penny: {
    id: 'penny',
    name: 'Penny',
    emoji: '👧',
    height: 1.38,
    bodyColor: '#e26aa1',
    pantsColor: '#5d3aa6',
    hairColor: '#6b3a1a',
    skinTone: '#f0c8a3',
    shoeColor: '#ffffff',
  },
  luke: {
    id: 'luke',
    name: 'Luke',
    emoji: '👦',
    height: 1.22,
    bodyColor: '#5cb85c',
    pantsColor: '#324e6c',
    hairColor: '#5a2f15',
    skinTone: '#eec8a3',
    shoeColor: '#d4d4d4',
  },
};

export const CHARACTER_ORDER: CharacterId[] = ['dad', 'penny', 'luke'];
