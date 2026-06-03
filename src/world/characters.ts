import type { CharacterDef, CharacterId } from '../types';

export const CHARACTERS: Record<CharacterId, CharacterDef> = {
  dad: {
    id: 'dad',
    name: 'Dad',
    emoji: '👨',
    height: 1.85,
    bodyColor: '#3a6db0',
    pantsColor: '#262834',
    hairColor: '#4a3320', // medium brown
    skinTone: '#e9c39c',
    shoeColor: '#1f1f1f',
  },
  penny: {
    id: 'penny',
    name: 'Penny',
    emoji: '👧',
    height: 1.38,
    bodyColor: '#e26aa1',
    pantsColor: '#5d3aa6',
    hairColor: '#b04e26', // signature auburn / red
    skinTone: '#f4d0ab',
    shoeColor: '#ffffff',
  },
  luke: {
    id: 'luke',
    name: 'Luke',
    emoji: '👦',
    height: 1.22,
    bodyColor: '#5cb85c',
    pantsColor: '#324e6c',
    hairColor: '#5a3a1f', // brown
    skinTone: '#f1cca4',
    shoeColor: '#d4d4d4',
  },
};

export const CHARACTER_ORDER: CharacterId[] = ['dad', 'penny', 'luke'];
