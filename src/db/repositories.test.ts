import { describe, it, expect, beforeEach } from 'vitest'
import * as db from './repositories'

describe('repositories (characters)', () => {
  beforeEach(() => localStorage.clear())

  it('creates and retrieves a character', () => {
    const c = db.createCharacter({ name: 'Ana', description: 'desc', image: null, traits: ['valiente'], backstory: 'bg', role: 'protagonist', age: '', gender: '', height: '', weight: '', build: '', skinColor: '', hairColor: '', eyeColor: '', marks: '', occupation: '' })
    expect(c.name).toBe('Ana')
    expect(db.getCharacter(c.id)?.name).toBe('Ana')
    expect(db.getAllCharacters().length).toBe(1)
  })

  it('updates and deletes', () => {
    const c = db.createCharacter({ name: 'Bob', description: '', image: null, traits: [], backstory: '', role: 'minor', age: '', gender: '', height: '', weight: '', build: '', skinColor: '', hairColor: '', eyeColor: '', marks: '', occupation: '' })
    db.updateCharacter(c.id, { name: 'Robert' })
    expect(db.getCharacter(c.id)?.name).toBe('Robert')
    db.deleteCharacter(c.id)
    expect(db.getCharacter(c.id)).toBeUndefined()
  })
})

describe('repositories (relationships)', () => {
  beforeEach(() => localStorage.clear())
  it('adds and lists relationships', () => {
    const r = db.addRelationship({ characterId1: 'a', characterId2: 'b', type: 'parentesco', subtype: 'padre_hijo', strength: 7 })
    expect(r.characterId1).toBe('a')
    expect(db.getAllRelationships().length).toBe(1)
  })
})
