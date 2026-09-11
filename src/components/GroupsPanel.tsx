import { useState } from 'react'
import { useGroupStore } from '../store/groupStore'
import { useCharacterStore } from '../store/characterStore'
import type { Group } from '../types'
import EntityModal from './EntityModal'

const emptyGroup: Omit<Group, 'id' | 'createdAt' | 'updatedAt'> = {
  name: '',
  description: '',
  image: null,
  memberIds: [],
  purpose: '',
  theme: '',
}

export default function GroupsPanel() {
  const { groups, addGroup, updateGroup, deleteGroup } = useGroupStore()
  const { characters } = useCharacterStore()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyGroup)
  const [modalOpen, setModalOpen] = useState(false)

  const openCreate = () => {
    setEditingId(null)
    setForm(emptyGroup)
    setModalOpen(true)
  }

  const openEdit = (group: Group) => {
    setEditingId(group.id)
    setForm({
      name: group.name,
      description: group.description,
      image: group.image,
      memberIds: group.memberIds,
      purpose: group.purpose,
      theme: group.theme,
    })
    setModalOpen(true)
  }

  const handleSave = () => {
    if (!form.name.trim()) return
    if (editingId) {
      updateGroup(editingId, form)
    } else {
      addGroup(form)
    }
    setModalOpen(false)
  }

  const toggleMember = (charId: string) => {
    setForm({
      ...form,
      memberIds: form.memberIds.includes(charId)
        ? form.memberIds.filter((id) => id !== charId)
        : [...form.memberIds, charId],
    })
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Grupos</h2>
          <button onClick={openCreate} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium">
            + Nuevo grupo
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((group) => {
            const memberNames = group.memberIds
              .map((id) => characters.find((c) => c.id === id)?.name || 'Desconocido')
              .join(', ')
            return (
              <div key={group.id} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden space-y-3 group">
                {group.image && <img src={group.image} alt={group.name} className="w-full h-40 object-cover" />}
                <div className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-lg">{group.name || 'Sin nombre'}</h3>
                      {group.theme && <span className="text-xs text-indigo-400">{group.theme}</span>}
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEdit(group)} className="px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded text-xs">Editar</button>
                      <button onClick={() => deleteGroup(group.id)} className="px-2 py-1 bg-red-900/40 hover:bg-red-900/60 text-red-300 rounded text-xs">Borrar</button>
                    </div>
                  </div>
                  <p className="text-sm text-gray-400 line-clamp-2">{group.description}</p>
                  {group.purpose && <p className="text-xs text-gray-500">Propósito: {group.purpose}</p>}
                  {memberNames && <p className="text-xs text-gray-500">Miembros: {memberNames}</p>}
                </div>
              </div>
            )
          })}
        </div>

        {groups.length === 0 && (
          <div className="text-center py-20 text-gray-500">
            <p className="text-4xl mb-4">👥</p>
            <p>No hay grupos. Crea el primero para organizar personajes por temática.</p>
          </div>
        )}
      </div>

      <EntityModal
        title={editingId ? 'Editar grupo' : 'Nuevo grupo'}
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
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Temática</label>
              <input
                value={form.theme}
                onChange={(e) => setForm({ ...form, theme: e.target.value })}
                className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                placeholder="Ej: Fantasía oscura, Cyberpunk, etc."
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm text-gray-400 mb-1">Descripción</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-indigo-500 h-20 resize-none"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm text-gray-400 mb-1">Propósito</label>
              <input
                value={form.purpose}
                onChange={(e) => setForm({ ...form, purpose: e.target.value })}
                className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm text-gray-400 mb-2">Miembros</label>
              {characters.length === 0 ? (
                <p className="text-xs text-gray-500">Crea personajes primero para añadirlos a grupos.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {characters.map((char) => {
                    const selected = form.memberIds.includes(char.id)
                    return (
                      <button
                        key={char.id}
                        type="button"
                        onClick={() => toggleMember(char.id)}
                        className={`px-3 py-1.5 rounded-full text-xs transition-colors ${
                          selected ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                        }`}
                      >
                        {char.name || 'Sin nombre'}
                      </button>
                    )
                  })}
                </div>
              )}
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
              {form.image && <img src={form.image} alt="Preview" className="mt-2 w-24 h-24 object-cover rounded-lg border border-gray-700" />}
            </div>
          </div>
        </div>
      </EntityModal>
    </div>
  )
}
