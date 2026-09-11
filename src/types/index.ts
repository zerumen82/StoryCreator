export interface Character {
  id: string
  name: string
  description: string
  image: string | null
  traits: string[]
  backstory: string
  role: 'protagonist' | 'antagonist' | 'supporting' | 'minor'
  // Aspecto fisico segmentado
  age: string
  gender: string
  height: string
  weight: string
  build: string
  skinColor: string
  hairColor: string
  eyeColor: string
  marks: string
  occupation: string
  createdAt: number
  updatedAt: number
}

export interface Location {
  id: string
  name: string
  description: string
  image: string | null
  type: 'city' | 'wilderness' | 'building' | 'fantasy' | 'sci-fi' | 'other'
  atmosphere: string
  createdAt: number
  updatedAt: number
}

export interface Group {
  id: string
  name: string
  description: string
  image: string | null
  memberIds: string[]
  purpose: string
  theme: string
  createdAt: number
  updatedAt: number
}

export interface ImageAsset {
  id: string
  dataUrl: string
  caption: string
  prompt: string
  characterIds?: string[]
  locationIds?: string[]
  groupIds?: string[]
  tags?: string[]
  createdAt: number
  updatedAt: number
}

export type AIProvider = 'ollama' | 'openai' | 'custom'

export interface AIConfig {
  provider: AIProvider
  endpoint: string
  apiKey: string
  model: string
  visionModel: string
  sdEndpoint: string
  sdCheckpoint: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
}

// RELACIONES ENTRE PERSONAJES - Parentesco
export type FamilySubtype =
  | 'padre_hijo'
  | 'madre_hijo'
  | 'hijo_padre'
  | 'hijo_madre'
  | 'abuelo_nieto'
  | 'nieto_abuelo'
  | 'tio_sobrino'
  | 'sobrino_tio'
  | 'primo_primo'
  | 'esposo_esposa'
  | 'novios'
  | 'ex_conexion'
  | 'tutor_menor'
  | 'menor_tutor'

export type RelationshipType = 'parentesco' | 'afinidad'

export type AffinitySubtype =
  | 'amigo_primo'
  | 'amigo_cercano'
  | 'amor_rival'
  | 'rival_amor'
  | 'enemigo'
  | 'competidor'
  | 'aliado'
  | 'mentor_alumno'
  | 'alumno_mentor'
  | 'compania_profesional'
  | 'rival_competidor'
  | 'guerra_civil'
  | 'unidos_poder'
  | 'amigo_primo'
  | 'amigo_cercano'
  | 'amor_rival'
  | 'rival_amor'
  | 'enemigo'
  | 'competidor'
  | 'aliado'
  | 'mentor_alumno'
  | 'alumno_mentor'
  | 'compania_profesional'
  | 'rival_competidor'
  | 'guerra_civil'
  | 'unidos_poder'

export interface Relationship {
  id: string
  characterId1: string
  characterId2: string
  type: RelationshipType
  subtype: FamilySubtype | AffinitySubtype
  description: string
  strength: number
  createdAt: number
  updatedAt: number
}

export interface RelationshipFormData {
  characterId1: string
  characterId2: string
  type: RelationshipType
  subtype: FamilySubtype | AffinitySubtype
  description: string
  strength: number
}
