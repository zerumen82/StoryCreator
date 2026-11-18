import { loadTable, saveTable, generateId } from './database'
import type { Character, Location, Group, ImageAsset, ChatMessage } from '../types'

// Claves localStorage (con prefijo storycreator: aplicado en database.ts)
const K = {
  characters: 'characters',
  locations: 'locations',
  groups: 'groups',
  images: 'images',
  conversations: 'conversations',
  messages: 'messages',
  stories: 'stories',
  memories: 'memories',
  preferences: 'preferences',
  relationships: 'relationships',
} as const

function read<T>(key: string, fallback: T): T {
  return loadTable<T>(key, fallback)
}
function write(key: string, data: unknown): void {
  saveTable(key, data)
}

// ==================== CHARACTERS ====================

export interface CharacterRow {
  id: string; name: string; description: string; image: string | null;
  traits: string; backstory: string; role: string; created_at: number; updated_at: number
  age?: string; gender?: string; height?: string; weight?: string; build?: string;
  skinColor?: string; hairColor?: string; eyeColor?: string; marks?: string; occupation?: string
}

function toCharacter(row: CharacterRow): Character {
  return {
    id: row.id, name: row.name, description: row.description,
    traits: JSON.parse(row.traits || '[]'), image: row.image || null,
    backstory: row.backstory, role: row.role as Character['role'],
    age: row.age || '', gender: row.gender || '', height: row.height || '',
    weight: row.weight || '', build: row.build || '', skinColor: row.skinColor || '',
    hairColor: row.hairColor || '', eyeColor: row.eyeColor || '',
    marks: row.marks || '', occupation: row.occupation || '',
    createdAt: row.created_at, updatedAt: row.updated_at,
  }
}

export function getAllCharacters(): Character[] {
  const rows = read<CharacterRow[]>(K.characters, [])
  return [...rows].sort((a, b) => b.created_at - a.created_at).map(toCharacter)
}

export function getCharacter(id: string): Character | undefined {
  const row = read<CharacterRow[]>(K.characters, []).find(r => r.id === id)
  return row ? toCharacter(row) : undefined
}

export function createCharacter(data: Omit<Character, 'id' | 'createdAt' | 'updatedAt'>): Character {
  const now = Date.now()
  const row: CharacterRow = {
    id: generateId(), name: data.name, description: data.description,
    image: data.image, traits: JSON.stringify(data.traits),
    backstory: data.backstory, role: data.role, created_at: now, updated_at: now,
    age: data.age || '', gender: data.gender || '', height: data.height || '',
    weight: data.weight || '', build: data.build || '', skinColor: data.skinColor || '',
    hairColor: data.hairColor || '', eyeColor: data.eyeColor || '',
    marks: data.marks || '', occupation: data.occupation || '',
  }
  const rows = read<CharacterRow[]>(K.characters, [])
  rows.push(row)
  write(K.characters, rows)
  return toCharacter(row)
}

export function updateCharacter(id: string, data: Partial<Character>): void {
  const rows = read<CharacterRow[]>(K.characters, [])
  const row = rows.find(r => r.id === id)
  if (!row) return
  if (data.name !== undefined) row.name = data.name
  if (data.description !== undefined) row.description = data.description
  if (data.image !== undefined) row.image = data.image
  if (data.traits !== undefined) row.traits = JSON.stringify(data.traits)
  if (data.backstory !== undefined) row.backstory = data.backstory
  if (data.role !== undefined) row.role = data.role
  if (data.age !== undefined) row.age = data.age
  if (data.gender !== undefined) row.gender = data.gender
  if (data.height !== undefined) row.height = data.height
  if (data.weight !== undefined) row.weight = data.weight
  if (data.build !== undefined) row.build = data.build
  if (data.skinColor !== undefined) row.skinColor = data.skinColor
  if (data.hairColor !== undefined) row.hairColor = data.hairColor
  if (data.eyeColor !== undefined) row.eyeColor = data.eyeColor
  if (data.marks !== undefined) row.marks = data.marks
  if (data.occupation !== undefined) row.occupation = data.occupation
  row.updated_at = Date.now()
  write(K.characters, rows)
}

export function deleteCharacter(id: string): void {
  write(K.characters, read<CharacterRow[]>(K.characters, []).filter(r => r.id !== id))
}

// ==================== LOCATIONS ====================

export interface LocationRow {
  id: string; name: string; description: string; image: string | null;
  type: string; atmosphere: string; created_at: number; updated_at: number
}

function toLocation(row: LocationRow): Location {
  return {
    id: row.id, name: row.name, description: row.description, image: row.image || null,
    type: row.type as Location['type'], atmosphere: row.atmosphere,
    createdAt: row.created_at, updatedAt: row.updated_at,
  }
}

export function getAllLocations(): Location[] {
  const rows = read<LocationRow[]>(K.locations, [])
  return [...rows].sort((a, b) => b.created_at - a.created_at).map(toLocation)
}

export function getLocation(id: string): Location | undefined {
  const row = read<LocationRow[]>(K.locations, []).find(r => r.id === id)
  return row ? toLocation(row) : undefined
}

export function createLocation(data: Omit<Location, 'id' | 'createdAt' | 'updatedAt'>): Location {
  const now = Date.now()
  const row: LocationRow = {
    id: generateId(), name: data.name, description: data.description, image: data.image,
    type: data.type, atmosphere: data.atmosphere, created_at: now, updated_at: now,
  }
  const rows = read<LocationRow[]>(K.locations, [])
  rows.push(row)
  write(K.locations, rows)
  return toLocation(row)
}

export function updateLocation(id: string, data: Partial<Location>): void {
  const rows = read<LocationRow[]>(K.locations, [])
  const row = rows.find(r => r.id === id)
  if (!row) return
  if (data.name !== undefined) row.name = data.name
  if (data.description !== undefined) row.description = data.description
  if (data.image !== undefined) row.image = data.image
  if (data.type !== undefined) row.type = data.type
  if (data.atmosphere !== undefined) row.atmosphere = data.atmosphere
  row.updated_at = Date.now()
  write(K.locations, rows)
}

export function deleteLocation(id: string): void {
  write(K.locations, read<LocationRow[]>(K.locations, []).filter(r => r.id !== id))
}

// ==================== GROUPS ====================

export interface GroupRow {
  id: string; name: string; description: string; image: string | null;
  member_ids: string; purpose: string; theme: string; created_at: number; updated_at: number
}

function toGroup(row: GroupRow): Group {
  return {
    id: row.id, name: row.name, description: row.description,
    memberIds: JSON.parse(row.member_ids || '[]'), image: row.image || null,
    purpose: row.purpose, theme: row.theme,
    createdAt: row.created_at, updatedAt: row.updated_at,
  }
}

export function getAllGroups(): Group[] {
  const rows = read<GroupRow[]>(K.groups, [])
  return [...rows].sort((a, b) => b.created_at - a.created_at).map(toGroup)
}

export function getGroup(id: string): Group | undefined {
  const row = read<GroupRow[]>(K.groups, []).find(r => r.id === id)
  return row ? toGroup(row) : undefined
}

export function createGroup(data: Omit<Group, 'id' | 'createdAt' | 'updatedAt'>): Group {
  const now = Date.now()
  const row: GroupRow = {
    id: generateId(), name: data.name, description: data.description, image: data.image,
    member_ids: JSON.stringify(data.memberIds), purpose: data.purpose, theme: data.theme,
    created_at: now, updated_at: now,
  }
  const rows = read<GroupRow[]>(K.groups, [])
  rows.push(row)
  write(K.groups, rows)
  return toGroup(row)
}

export function updateGroup(id: string, data: Partial<Group>): void {
  const rows = read<GroupRow[]>(K.groups, [])
  const row = rows.find(r => r.id === id)
  if (!row) return
  if (data.name !== undefined) row.name = data.name
  if (data.description !== undefined) row.description = data.description
  if (data.image !== undefined) row.image = data.image
  if (data.memberIds !== undefined) row.member_ids = JSON.stringify(data.memberIds)
  if (data.purpose !== undefined) row.purpose = data.purpose
  if (data.theme !== undefined) row.theme = data.theme
  row.updated_at = Date.now()
  write(K.groups, rows)
}

export function deleteGroup(id: string): void {
  write(K.groups, read<GroupRow[]>(K.groups, []).filter(r => r.id !== id))
}

// ==================== IMAGES ====================

export interface ImageRow {
  id: string; data_url: string; caption: string; prompt: string;
  character_ids: string; location_ids: string; group_ids: string; tags: string; created_at: number
}

function toImage(row: ImageRow): ImageAsset {
  return {
    id: row.id, dataUrl: row.data_url, caption: row.caption, prompt: row.prompt,
    characterIds: JSON.parse(row.character_ids || '[]'),
    locationIds: JSON.parse(row.location_ids || '[]'),
    groupIds: JSON.parse(row.group_ids || '[]'),
    tags: JSON.parse(row.tags || '[]'),
    createdAt: row.created_at, updatedAt: row.created_at,
  }
}

export function getAllImages(): ImageAsset[] {
  const rows = read<ImageRow[]>(K.images, [])
  return [...rows].sort((a, b) => b.created_at - a.created_at).map(toImage)
}

export function createImage(data: Omit<ImageAsset, 'id' | 'createdAt' | 'updatedAt'> & { characterIds?: string[]; locationIds?: string[]; groupIds?: string[]; tags?: string[] }): ImageAsset {
  const now = Date.now()
  const row: ImageRow = {
    id: generateId(), data_url: data.dataUrl, caption: data.caption || '', prompt: data.prompt || '',
    character_ids: JSON.stringify(data.characterIds || []),
    location_ids: JSON.stringify(data.locationIds || []),
    group_ids: JSON.stringify(data.groupIds || []),
    tags: JSON.stringify(data.tags || []),
    created_at: now,
  }
  const rows = read<ImageRow[]>(K.images, [])
  rows.push(row)
  write(K.images, rows)
  return toImage(row)
}

export function deleteImage(id: string): void {
  write(K.images, read<ImageRow[]>(K.images, []).filter(r => r.id !== id))
}

export interface ImageUpdate {
  dataUrl?: string
  caption?: string
  prompt?: string
  characterIds?: string[]
  locationIds?: string[]
  groupIds?: string[]
  tags?: string[]
}

export function updateImage(id: string, data: ImageUpdate): void {
  const rows = read<ImageRow[]>(K.images, [])
  const row = rows.find(r => r.id === id)
  if (!row) return
  if (data.dataUrl !== undefined) row.data_url = data.dataUrl
  if (data.caption !== undefined) row.caption = data.caption
  if (data.prompt !== undefined) row.prompt = data.prompt
  if (data.characterIds !== undefined) row.character_ids = JSON.stringify(data.characterIds)
  if (data.locationIds !== undefined) row.location_ids = JSON.stringify(data.locationIds)
  if (data.groupIds !== undefined) row.group_ids = JSON.stringify(data.groupIds)
  if (data.tags !== undefined) row.tags = JSON.stringify(data.tags)
  write(K.images, rows)
}

// ==================== CONVERSATIONS ====================

export interface ConversationRow {
  id: string; character_id: string | null; title: string; mode: string;
  created_at: number; updated_at: number
}

export interface Conversation {
  id: string
  characterId: string | null
  title: string
  mode: 'chat' | 'story'
  createdAt: number
  updatedAt: number
}

export function getAllConversations(): Conversation[] {
  const rows = read<ConversationRow[]>(K.conversations, [])
  return [...rows].sort((a, b) => b.updated_at - a.updated_at).map(row => ({
    id: row.id, characterId: row.character_id, title: row.title,
    mode: row.mode as 'chat' | 'story', createdAt: row.created_at, updatedAt: row.updated_at,
  }))
}

export function createConversation(characterId: string | null, mode: 'chat' | 'story'): string {
  const now = Date.now()
  const row: ConversationRow = {
    id: generateId(), character_id: characterId,
    title: mode === 'chat' ? 'Chat con personaje' : 'Nueva historia',
    mode, created_at: now, updated_at: now,
  }
  const rows = read<ConversationRow[]>(K.conversations, [])
  rows.push(row)
  write(K.conversations, rows)
  return row.id
}

export function touchConversation(id: string): void {
  const rows = read<ConversationRow[]>(K.conversations, [])
  const row = rows.find(r => r.id === id)
  if (!row) return
  row.updated_at = Date.now()
  write(K.conversations, rows)
}

export function deleteConversation(id: string): void {
  write(K.conversations, read<ConversationRow[]>(K.conversations, []).filter(r => r.id !== id))
  // borrado en cascada de mensajes
  write(K.messages, read<MessageRow[]>(K.messages, []).filter(m => m.conversation_id !== id))
}

// ==================== MESSAGES ====================

export interface MessageRow {
  id: string; conversation_id: string; role: string; content: string;
  timestamp: number; feedback: number
}

export function getMessagesByConversation(conversationId: string): ChatMessage[] {
  return read<MessageRow[]>(K.messages, [])
    .filter(r => r.conversation_id === conversationId)
    .sort((a, b) => a.timestamp - b.timestamp)
    .map(row => ({ id: row.id, role: row.role as ChatMessage['role'], content: row.content, timestamp: row.timestamp, feedback: row.feedback }))
}

export function addMessage(conversationId: string, role: string, content: string): string {
  const now = Date.now()
  const row: MessageRow = { id: generateId(), conversation_id: conversationId, role, content, timestamp: now, feedback: 0 }
  const rows = read<MessageRow[]>(K.messages, [])
  rows.push(row)
  write(K.messages, rows)
  touchConversation(conversationId)
  return row.id
}

export function setMessageFeedback(messageId: string, feedback: number): void {
  const rows = read<MessageRow[]>(K.messages, [])
  const row = rows.find(r => r.id === messageId)
  if (!row) return
  row.feedback = feedback
  write(K.messages, rows)
}

export function updateMessageContent(messageId: string, content: string): void {
  const rows = read<MessageRow[]>(K.messages, [])
  const row = rows.find(r => r.id === messageId)
  if (!row) return
  row.content = content
  write(K.messages, rows)
}

// ==================== STORIES ====================

export interface StoryRow {
  id: string; title: string; content: string; character_ids: string;
  location_ids: string; group_ids: string; status: string; rating: number;
  created_at: number; updated_at: number
}

export function getAllStories(): StoryRow[] {
  const rows = read<StoryRow[]>(K.stories, [])
  return [...rows].sort((a, b) => b.updated_at - a.updated_at)
}

export function getStory(id: string): StoryRow | undefined {
  return read<StoryRow[]>(K.stories, []).find(r => r.id === id)
}

export function createStory(title: string): string {
  const now = Date.now()
  const row: StoryRow = {
    id: generateId(), title, content: '', character_ids: '[]',
    location_ids: '[]', group_ids: '[]', status: 'draft', rating: 0,
    created_at: now, updated_at: now,
  }
  const rows = read<StoryRow[]>(K.stories, [])
  rows.push(row)
  write(K.stories, rows)
  return row.id
}

export function updateStory(id: string, data: Partial<StoryRow>): void {
  const rows = read<StoryRow[]>(K.stories, [])
  const row = rows.find(r => r.id === id)
  if (!row) return
  if (data.title !== undefined) row.title = data.title
  if (data.content !== undefined) row.content = data.content
  if (data.character_ids !== undefined) row.character_ids = data.character_ids
  if (data.location_ids !== undefined) row.location_ids = data.location_ids
  if (data.group_ids !== undefined) row.group_ids = data.group_ids
  if (data.status !== undefined) row.status = data.status
  if (data.rating !== undefined) row.rating = data.rating
  row.updated_at = Date.now()
  write(K.stories, rows)
}

export function deleteStory(id: string): void {
  write(K.stories, read<StoryRow[]>(K.stories, []).filter(r => r.id !== id))
}

// ==================== AI MEMORY ====================

export interface MemoryRow {
  id: string; type: string; content: string; relevance: number; created_at: number
}

export function addMemory(type: string, content: string, relevance: number = 1.0): string {
  const row: MemoryRow = { id: generateId(), type, content, relevance, created_at: Date.now() }
  const rows = read<MemoryRow[]>(K.memories, [])
  rows.push(row)
  write(K.memories, rows)
  return row.id
}

export function getMemoriesByType(type: string, limit: number = 50): MemoryRow[] {
  return read<MemoryRow[]>(K.memories, [])
    .filter(r => r.type === type)
    .sort((a, b) => b.relevance - a.relevance || b.created_at - a.created_at)
    .slice(0, limit)
}

export function getAllMemories(): MemoryRow[] {
  const rows = read<MemoryRow[]>(K.memories, [])
  return [...rows].sort((a, b) => b.created_at - a.created_at)
}

export function deleteMemory(id: string): void {
  write(K.memories, read<MemoryRow[]>(K.memories, []).filter(r => r.id !== id))
}

// ==================== PREFERENCES ====================

export function getPreference(key: string, defaultValue: string = ''): string {
  const prefs = read<Record<string, string>>(K.preferences, {})
  return prefs[key] ?? defaultValue
}

export function setPreference(key: string, value: string): void {
  const prefs = read<Record<string, string>>(K.preferences, {})
  prefs[key] = value
  write(K.preferences, prefs)
}

// ==================== RELATIONSHIPS ====================

export interface RelationshipRow {
  id: string; character_id_1: string; character_id_2: string;
  type: string; subtype: string; description: string; strength: number;
  created_at: number; updated_at: number
}

export interface Relationship {
  id: string; characterId1: string; characterId2: string;
  type: string; subtype: string; description: string; strength: number;
  createdAt: number; updatedAt: number
}

function toRelationship(row: RelationshipRow): Relationship {
  return {
    id: row.id, characterId1: row.character_id_1, characterId2: row.character_id_2,
    type: row.type, subtype: row.subtype, description: row.description || '',
    strength: row.strength, createdAt: row.created_at, updatedAt: row.updated_at,
  }
}

export function getAllRelationships(): Relationship[] {
  const rows = read<RelationshipRow[]>(K.relationships, [])
  return [...rows].sort((a, b) => b.updated_at - a.updated_at).map(toRelationship)
}

export function addRelationship(data: { characterId1: string; characterId2: string; type: string; subtype: string; description?: string; strength?: number }): Relationship {
  const now = Date.now()
  const row: RelationshipRow = {
    id: generateId(), character_id_1: data.characterId1, character_id_2: data.characterId2,
    type: data.type, subtype: data.subtype, description: data.description || '',
    strength: data.strength ?? 5, created_at: now, updated_at: now,
  }
  const rows = read<RelationshipRow[]>(K.relationships, [])
  rows.push(row)
  write(K.relationships, rows)
  return toRelationship(row)
}

export function updateRelationship(id: string, data: Partial<{ characterId1: string; characterId2: string; type: string; subtype: string; description: string; strength: number }>): void {
  const rows = read<RelationshipRow[]>(K.relationships, [])
  const row = rows.find(r => r.id === id)
  if (!row) return
  if (data.characterId1 !== undefined) row.character_id_1 = data.characterId1
  if (data.characterId2 !== undefined) row.character_id_2 = data.characterId2
  if (data.type !== undefined) row.type = data.type
  if (data.subtype !== undefined) row.subtype = data.subtype
  if (data.description !== undefined) row.description = data.description
  if (data.strength !== undefined) row.strength = data.strength
  row.updated_at = Date.now()
  write(K.relationships, rows)
}

export function deleteRelationship(id: string): void {
  write(K.relationships, read<RelationshipRow[]>(K.relationships, []).filter(r => r.id !== id))
}
