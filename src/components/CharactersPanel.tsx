import { useState } from 'react'
import { useCharacterStore } from '../store/characterStore'
import { useRelationshipStore } from '../store/relationshipStore'
import type { Character } from '../types'
import EntityModal from './EntityModal'
import RelationshipsModal from './RelationshipsModal'
import { useToastStore } from '../store/toastStore'

const emptyCharacter: Omit<Character, 'id' | 'createdAt' | 'updatedAt'> = {
  name: '',
  description: '',
  image: null,
  traits: [],
  backstory: '',
  role: 'supporting' as Character['role'],
  age: '',
  gender: '',
  height: '',
  weight: '',
  build: '',
  skinColor: '',
  hairColor: '',
  eyeColor: '',
  marks: '',
  occupation: '',
}

// Resumen fisico corto para la tarjeta (solo campos rellenos)
function physicalSummary(c: Character): string {
  const bits: string[] = []
  if (c.age) bits.push(`${c.age} años`)
  if (c.gender) bits.push(c.gender)
  if (c.height) bits.push(c.height)
  if (c.weight) bits.push(c.weight)
  if (c.build) bits.push(c.build)
  return bits.join(' · ')
}

export default function CharactersPanel() {
  const { characters, userCharacterId, addCharacter, updateCharacter, deleteCharacter, setUserCharacter, clearUserCharacter, isUserCharacter } = useCharacterStore()
  const { relationships, getCharacterRelationshipStats } = useRelationshipStore()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyCharacter)
  const [newTrait, setNewTrait] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [relCharacterId, setRelCharacterId] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const openCreate = () => {
    setEditingId(null)
    setForm(emptyCharacter)
    setNewTrait('')
    setModalOpen(true)
  }

  const openEdit = (char: Character) => {
    setEditingId(char.id)
    setForm({
      name: char.name,
      description: char.description,
      image: char.image,
      traits: char.traits,
      backstory: char.backstory,
      role: char.role,
      age: char.age || '',
      gender: char.gender || '',
      height: char.height || '',
      weight: char.weight || '',
      build: char.build || '',
      skinColor: char.skinColor || '',
      hairColor: char.hairColor || '',
      eyeColor: char.eyeColor || '',
      marks: char.marks || '',
      occupation: char.occupation || '',
    })
    setNewTrait('')
    setModalOpen(true)
  }

  const handleSave = () => {
    if (!form.name.trim()) return
    if (editingId) {
      updateCharacter(editingId, form)
    } else {
      addCharacter(form)
    }
    setModalOpen(false)
    useToastStore.getState().show(editingId ? 'Personaje actualizado' : 'Personaje creado', 'success')
  }

  const addTrait = () => {
    if (!newTrait.trim()) return
    setForm({ ...form, traits: [...form.traits, newTrait.trim()] })
    setNewTrait('')
  }

  const removeTrait = (index: number) => {
    setForm({ ...form, traits: form.traits.filter((_, i) => i !== index) })
  }

  const openRelationships = (charId: string) => {
    setRelCharacterId(charId)
  }

  const closeRelationships = () => {
    setRelCharacterId(null)
  }



  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Personajes</h2>
          <button onClick={openCreate} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium">
            + Nuevo personaje
          </button>
        </div>

        {!userCharacterId && characters.length > 0 && (
          <div className="px-4 py-3 bg-amber-900/20 border border-amber-700/40 rounded-xl text-sm text-amber-200">
            👆 Marca cuál eres <strong>tú</strong> pulsando <strong>“Este soy yo”</strong> en tu tarjeta.
            La IA te tratará como protagonista de las historias.
          </div>
        )}

        {characters.length >= 2 && relationships.length === 0 && (
          <div className="px-4 py-3 bg-violet-900/20 border border-violet-700/40 rounded-xl text-sm text-violet-200">
            🔗 Tienes {characters.length} personajes sin conectar. Pulsa <strong>“🔗 Relaciones”</strong> en
            una tarjeta para definir parentescos (padre, hermanos…) y afinidades (amigos, enemigos…).
            La IA usará esas relaciones en tus historias.
          </div>
        )}

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar personaje por nombre..."
          className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {characters.filter((c) => !search.trim() || c.name.toLowerCase().includes(search.trim().toLowerCase())).map((char) => {
            const isUser = isUserCharacter(char.id)
            return (
            <div key={char.id} className={`bg-gray-900 border rounded-xl overflow-hidden space-y-3 group ${isUser ? 'border-violet-500 ring-1 ring-violet-500/50' : 'border-gray-800'}`}>
              {char.image && <img src={char.image} alt={char.name} className="w-full h-40 object-cover" />}
              <div className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-lg">
                      {char.name || 'Sin nombre'}{' '}
                      {isUser && <span className="ml-1 px-2 py-0.5 bg-violet-600 text-white text-xs rounded-full align-middle">🧑 Tú</span>}
                    </h3>
                    <span className="text-xs text-gray-500 capitalize">{char.role}</span>
                    {physicalSummary(char) && (
                      <span className="block text-xs text-gray-400 mt-0.5">{physicalSummary(char)}</span>
                    )}
                    {char.occupation && (
                      <span className="block text-xs text-indigo-300/80 mt-0.5">💼 {char.occupation}</span>
                    )}
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openRelationships(char.id)} className="px-2 py-1 bg-violet-700 hover:bg-violet-600 rounded text-xs" title="Definir relaciones con otros personajes">🔗 Relaciones</button>
                    <button onClick={() => openEdit(char)} className="px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded text-xs">Editar</button>
                    {!isUser && <button onClick={() => { if (window.confirm('¿Borrar este personaje?')) deleteCharacter(char.id) }} className="px-2 py-1 bg-red-900/40 hover:bg-red-900/60 text-red-300 rounded text-xs">Borrar</button>}
                  </div>
                </div>
                {isUser ? (
                  <button onClick={() => clearUserCharacter()} className="text-xs text-violet-300 hover:text-violet-100 underline">
                    Dejar de ser este personaje
                  </button>
                ) : (
                  <button onClick={() => setUserCharacter(char.id)} className="text-xs text-gray-400 hover:text-violet-300 underline" title="Marcar como tu personaje (usuario)">
                    Este soy yo →
                  </button>
                )}
                <p className="text-sm text-gray-400 line-clamp-2">{char.description}</p>
                {(() => {
                  const stats = getCharacterRelationshipStats(char.id)
                  return (
                    <>
                      {stats.familyCount > 0 && <span className="inline-block px-2 py-0.5 bg-purple-900/40 text-purple-300 text-xs rounded mr-1">{stats.familyCount} relacion familiar</span>}
                      {stats.affinityCount > 0 && <span className="inline-block px-2 py-0.5 bg-blue-900/40 text-blue-300 text-xs rounded">{stats.affinityCount} relacion de afinidad</span>}
                    </>
                  )
                })()}
                {char.traits.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {char.traits.map((trait, i) => (
                      <span key={i} className="px-2 py-0.5 bg-gray-800 rounded-full text-xs">{trait}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            )
          })}
        </div>

        {characters.length > 0 && characters.filter((c) => !search.trim() || c.name.toLowerCase().includes(search.trim().toLowerCase())).length === 0 && (
          <div className="text-center py-20 text-gray-500">
            <p className="text-4xl mb-4">🔍</p>
            <p>Sin resultados para "{search}".</p>
          </div>
        )}
        {characters.length === 0 && (
          <div className="text-center py-20 text-gray-500">
            <p className="text-4xl mb-4">👤</p>
            <p>No hay personajes. Crea el primero para comenzar.</p>
          </div>
        )}
      </div>

      <EntityModal
        title={editingId ? 'Editar personaje' : 'Nuevo personaje'}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSave}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Nombre</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                placeholder="Nombre del personaje"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Rol</label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as Character['role'] })}
                className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
              >
                <option value="protagonist">Protagonista</option>
                <option value="antagonist">Antagonista</option>
                <option value="supporting">Secundario</option>
                <option value="minor">Secundario menor</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Ocupación</label>
              <input
                value={form.occupation}
                onChange={(e) => setForm({ ...form, occupation: e.target.value })}
                className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                placeholder="Ej: Herrero, detective, estudiante..."
              />
            </div>
            <div className="md:col-span-2 pt-2">
              <h4 className="text-sm font-semibold text-gray-300 mb-1">🧍 Aspecto físico</h4>
              <p className="text-xs text-gray-500 mb-3">La IA usará estos datos para describir al personaje en tus historias.</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Edad</label>
                  <input
                    value={form.age}
                    onChange={(e) => setForm({ ...form, age: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                    placeholder="Ej: 28"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Género</label>
                  <input
                    value={form.gender}
                    onChange={(e) => setForm({ ...form, gender: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                    placeholder="Ej: Mujer"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Altura</label>
                  <input
                    value={form.height}
                    onChange={(e) => setForm({ ...form, height: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                    placeholder="Ej: 1,75 m"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Peso</label>
                  <input
                    value={form.weight}
                    onChange={(e) => setForm({ ...form, weight: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                    placeholder="Ej: 68 kg"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Complexión</label>
                  <input
                    value={form.build}
                    onChange={(e) => setForm({ ...form, build: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                    placeholder="Ej: Atlética, delgada..."
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Color de piel</label>
                  <input
                    value={form.skinColor}
                    onChange={(e) => setForm({ ...form, skinColor: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                    placeholder="Ej: Morena clara"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Pelo</label>
                  <input
                    value={form.hairColor}
                    onChange={(e) => setForm({ ...form, hairColor: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                    placeholder="Ej: Negro, largo y rizado"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Ojos</label>
                  <input
                    value={form.eyeColor}
                    onChange={(e) => setForm({ ...form, eyeColor: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                    placeholder="Ej: Verdes"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Marcas distintivas</label>
                  <input
                    value={form.marks}
                    onChange={(e) => setForm({ ...form, marks: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                    placeholder="Ej: Cicatriz en la ceja, tatuaje..."
                  />
                </div>
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm text-gray-400 mb-1">Personalidad / descripción general</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-indigo-500 h-20 resize-none"
                placeholder="Carácter, forma de hablar, manías..."
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm text-gray-400 mb-1">Historia trasfondo</label>
              <textarea
                value={form.backstory}
                onChange={(e) => setForm({ ...form, backstory: e.target.value })}
                className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-indigo-500 h-24 resize-none"
                placeholder="Pasado, motivaciones, conflictos internos..."
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Rasgos</label>
              <div className="flex gap-2">
                <input
                  value={newTrait}
                  onChange={(e) => setNewTrait(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTrait())}
                  className="flex-1 px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                  placeholder="Rasgo"
                />
                <button onClick={addTrait} className="px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm">+</button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {form.traits.map((trait, i) => (
                  <span key={i} className="px-2 py-1 bg-gray-800 rounded-full text-xs flex items-center gap-1">
                    {trait}
                    <button onClick={() => removeTrait(i)} className="text-gray-400 hover:text-white">×</button>
                  </span>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Imagen</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  const reader = new FileReader()
                  reader.onload = () => setForm({ ...form, image: reader.result as string })
                  reader.readAsDataURL(file)
                }}
                className="text-sm text-gray-400"
              />
              {form.image && (
                <img src={form.image} alt="Preview" className="mt-2 w-24 h-24 object-cover rounded-lg border border-gray-700" />
              )}
            </div>
          </div>
        </div>
      </EntityModal>
      <RelationshipsModal characterId={relCharacterId || ''} open={!!relCharacterId} onClose={closeRelationships} />
    </div>
  )
}
