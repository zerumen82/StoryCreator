const fs = require('fs');
const p = 'D:\\\\PROJECTS\\\\STORÇYCREATOR\\\\src\\\\components\\\\CharactersPanel.tsx';
const c = `import { useState } from 'react'
import { useCharacterStore } from '../store/characterStore'
import { useRelationshipStore } from '../store/relationshipStore'
import type { Character } from '../types'
import EntityModal from './EntityModal'

const emptyCharacter = {
  name: '',
  description: '',
  image: null,
  traits: [],
  backstory: '',
  role: 'supporting'
}
`;
fs.writeFileSync(p, c);
console.log('Part 1 done');