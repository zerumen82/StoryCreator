import { useState, useEffect } from 'react'
import { useRelationshipStore } from '../store/relationshipStore'
import { useCharacterStore } from '../store/characterStore'

const FAMILY_TYPES = [
  'padre_hijo','madre_hijo','hijo_padre','hijo_madre',
  'abuelo_nieto','nieto_abuelo','tio_sobrino','sobrino_tio',
  'primo_primo','esposo_esposa','novios','ex_conexion',
  'tutor_menor','menor_tutor'
]

const AFFINITY_TYPES = [
  'amigo_primo','amigo_cercano','amor_rival','rival_amor',
  'enemigo','competidor','aliado',
  'mentor_alumno','alumno_mentor',
  'compania_profesional','rival_competidor',
  'guerra_civil','unidos_poder'
]

interface Props {
  characterId: string
  open: boolean
  onClose: () => void
}

export default function RelationshipsModal({ characterId, open, onClose }: Props) {
  const { characters } = useCharacterStore()
  const { addRelationship, deleteRelationship, getCharacterRelationships } = useRelationshipStore()
  const [type, setType] = useState<'parentesco'|'afinidad'>('parentesco')
  const [subtype, setSubtype] = useState('')
  const [otherId, setOtherId] = useState('')
  const [strength, setStrength] = useState(5)
  const [description, setDescription] = useState('')
  const [notice, setNotice] = useState<string | null>(null)

  const character = characters.find(c => c.id === characterId)
  const relationships = characterId ? getCharacterRelationships(characterId) : []
  const availableChars = characters.filter(c => c.id !== characterId)

  useEffect(() => { if (open) { setSubtype(''); setNotice(null) } }, [open, type])

  // La contraparte: si la relacion se creo desde el otro lado, characterId2 puede ser yo
  const otherPartyId = (r: { characterId1: string; characterId2: string }) =>
    r.characterId1 === characterId ? r.characterId2 : r.characterId1

  const handleAdd = () => {
    if (!characterId || !otherId || !subtype) return
    const ok = addRelationship({ characterId1: characterId, characterId2: otherId, type: type, subtype: subtype as any, strength, description })
    if (!ok) {
      setNotice('Esa relación ya existe entre estos personajes.')
      return
    }
    setSubtype(''); setOtherId(''); setDescription(''); setStrength(5); setNotice(null)
  }
  const handleDelete = (relId: string) => {
    deleteRelationship(relId)
  }
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto shadow-2xl shadow-violet-900/20 p-6 space-y-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">
            Relaciones{character ? ` de ${character.name}` : ''}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => setType('parentesco')} className={`px-3 py-2 rounded-lg text-sm font-medium border ${type === 'parentesco' ? 'bg-violet-700 border-violet-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-300'}`}>Parentesco</button>
          <button onClick={() => setType('afinidad')} className={`px-3 py-2 rounded-lg text-sm font-medium border ${type === 'afinidad' ? 'bg-violet-700 border-violet-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-300'}`}>Afinidad</button>
        </div>
        <select value={subtype} onChange={e => setSubtype(e.target.value)} className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm">
          <option value="">Seleccionar...</option>
          {(type === 'parentesco' ? FAMILY_TYPES : AFFINITY_TYPES).map(t => <option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}
        </select>
        <select value={otherId} onChange={e => setOtherId(e.target.value)} className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm">
          <option value="">Seleccionar personaje...</option>
          {availableChars.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <div>
          <label className="text-sm text-gray-400">Fuerza: {strength}</label>
          <input type="range" min={0} max={10} step={1} value={strength} onChange={e => setStrength(Number(e.target.value))} className="w-full accent-violet-500" />
        </div>
        <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Ej: Es mi hermano..." className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm min-h-[60px]" />
        <button onClick={handleAdd} disabled={!subtype || !otherId} className="w-full py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 rounded-xl text-sm font-semibold">Añadir relación</button>
        {notice && <p className="text-xs text-amber-300">{notice}</p>}
        {availableChars.length === 0 && (
          <p className="text-xs text-gray-500">Crea otro personaje para poder relacionarlos entre sí.</p>
        )}
        <div className="border-t border-gray-800 pt-4">
          <h3 className="text-sm font-semibold mb-3">Relaciones actuales ({relationships.length})</h3>
          {relationships.length === 0 ? <p className="text-sm text-gray-500">No hay relaciones.</p> : (
            <div className="space-y-2">
              {relationships.map((r) => {
                const other = characters.find((c) => c.id === otherPartyId(r))
                return (
                  <div key={r.id} className="flex items-center justify-between gap-2 bg-gray-800/50 rounded-lg px-3 py-2">
                    <span className="text-sm">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[11px] mr-2 ${r.type === 'parentesco' ? 'bg-purple-900/50 text-purple-300' : 'bg-blue-900/50 text-blue-300'}`}>
                        {r.type}
                      </span>
                      {String(r.subtype).replace(/_/g, ' ')} · <strong>{other?.name || '?'}</strong>
                      <span className="text-gray-500 text-xs"> (fuerza {r.strength})</span>
                    </span>
                    <button onClick={() => handleDelete(r.id)} className="text-xs text-red-400 hover:text-red-300 shrink-0">Eliminar</button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
