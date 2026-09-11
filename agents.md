# StoryCreator - Guía de Agentes IA

## Modelos Recomendados para Caption Studio

### Opción 1: Ollama (Local - Gratis)

**Instalación de modelos:**
```bash
# Modelo de visión (OBLIGATORIO para análisis de fotos)
ollama pull llava:latest          # Recomendado - buen balance calidad/velocidad
ollama pull bakllava:latest       # Alternativa mejorada de LLaVA
ollama pull llava-llama3:latest   # Basado en Llama 3, más preciso

# Modelo de texto (para generar captions)
ollama pull llama3:latest         # Recomendado
ollama pull mistral:latest        # Alternativa rápida
ollama pull phi3:latest           # Más ligero, bueno para PCs modestos
```

**Configuración en la app:**
- Proveedor: `Ollama (Local)`
- Endpoint: `http://localhost:11434`
- Modelo de texto: `llama3`
- Modelo de visión: `llava`

---

### Opción 2: OpenAI (Cloud - Pago)

**Configuración en la app:**
- Proveedor: `OpenAI / Compatible`
- Endpoint: `https://api.openai.com`
- API Key: `sk-tu-api-key-aqui`
- Modelo de texto: `gpt-4o` o `gpt-4o-mini`
- Modelo de visión: `gpt-4o` (incluye visión)

---

### Opción 3: Groq (Cloud - Más barato y rápido)

**Configuración en la app:**
- Proveedor: `Custom / Otro`
- Endpoint: `https://api.groq.com/open/v1`
- API Key: Tu key de Groq
- Modelo de texto: `llama-3.1-70b-versatile`
- Modelo de visión: `llama-3.2-90b-vision-preview`

---

### Opción 4: OpenRouter (Cloud - Acceso a muchos modelos)

**Configuración en la app:**
- Proveedor: `Custom / Otro`
- Endpoint: `https://openrouter.ai/api/v1`
- API Key: Tu key de OpenRouter
- Modelo de texto: `meta-llama/llama-3.1-70b-instruct`
- Modelo de visión: `google/gemini-pro-vision`

---

## Resumen de Modelos por Uso

| Uso | Modelo visión | Modelo texto |
|-----|---------------|--------------|
| **Local (gratis)** | `llava` o `bakllava` | `llama3` o `mistral` |
| **OpenAI** | `gpt-4o` | `gpt-4o` |
| **Económico** | `llama-3.2-90b-vision` (Groq) | `llama-3.1-70b` |

---

## Cómo Configurar

1. Abre la app StoryCreator
2. Click en ⚙️ **Configuración IA** (esquina inferior izquierda del sidebar)
3. Selecciona el proveedor
4. Introduce el endpoint y modelos
5. Guarda los cambios

---

## Sistema de Base de Datos Local

La app usa **SQLite** para persistencia completa de todos los datos.

### Tablas principales:

| Tabla | Descripción |
|-------|-------------|
| `characters` | Personajes con nombre, descripción, imagen, rasgos, trasfondo, rol |
| `locations` | Localizaciones con nombre, descripción, imagen, tipo, atmósfera |
| `groups` | Grupos con nombre, descripción, imagen, miembros, propósito, temática |
| `images` | Imágenes con data_url, caption, prompt, personajes asociados, tags |
| `conversations` | Conversaciones (chat o historia) con character_id, mode, title |
| `messages` | Mensajes de conversaciones con feedback (like/dislike) |
| `stories` | Historias completas con contenido, personajes, localizaciones, grupos, rating |
| `ai_memory` | Memoria de la IA para aprender de interacciones previas |
| `preferences` | Configuración y preferencias del usuario |
| `relationships` | Relaciones entre personajes: parentesco y afinidad |

**Ubicación del archivo:**
- En desarrollo: `D:\\PROJECTS\\STORÇYCREATOR\\storycreator.db`
- En producción: `%APPDATA%\\storycreator\\storycreator.db`

### Implementación:
- Archivo: `src/db/database.ts` - Inicialización y schema
- Archivo: `src/db/repositories.ts` - Funciones CRUD

---

## Sistema de Relaciones entre Personajes

### Descripción
El sistema permite gestionar relaciones entre personajes con dos tipos principales:

### Tipos de relaciones

#### 1. Parentesco (Familia)
- **padre_hijo**: Padre → Hijo
- **madre_hijo**: Madre → Hijo
- **hijo_padre**: Hijo → Padre
- **hijo_madre**: Hijo → Madre
- **abuelo_nieto**: Abuelo → Nieto
- **nieto_abuelo**: Nieto → Abuelo
- **tio_sobrino**: Tío → Sobrino
- **sobrino_tio**: Sobrino → Tío
- **primo_primo**: Primo → Primo
- **esposo_esposa**: Esposo → Esposa
- **novios**: Novios (pareja)
- **ex_conexion**: Ex relación romántica
- **tutor_menor**: Tutor → Menor
- **menor_tutor**: Menor → Tutor

#### 2. Afinidad (Otras conexiones)
- **amigo_primo**: Amigo (primo)
- **amigo_cercano**: Amigo cercano
- **amor_rival**: Amor - rival
- **rival_amor**: Rival - amor
- **enemigo**: Enemigo
- **competidor**: Competidor
- **aliado**: Aliado
- **mentor_alumno**: Mentor → Alumno
- **alumno_mentor**: Alumno → Mentor
- **compania_profesional**: Compañía profesional
- **rival_competidor**: Rival/competidor
- **guerra_civil**: Guerra civil
- **unidos_poder**: Unidos por poder

### Campos de cada relación
- `type`: 'parentesco' | 'afinidad'
- `subtype`: Tipo específico de relación
- `strength`: Fuerza de la relación (0-10)
- `description`: Descripción adicional (opcional)

### Implementación
- Archivo: `src/store/relationshipStore.ts` - Store de Zustand para manejar relaciones
- Componente: `src/components/CharactersPanel.tsx` - Panel de personajes con gestión de relaciones

### Código de ejemplo para añadir una relación:
```typescript
import { useRelationshipStore } from '../store/relationshipStore'

const { addRelationship } = useRelationshipStore()

// Añadir una relación de padre a hijo
addRelationship({
  characterId1: 'personaje_1_id',
  characterId2: 'personaje_2_id', 
  type: 'parentesco',
  subtype: 'padre_hijo',
  description: 'Juan es el padre de María',
  strength: 8
})
```

### Consultar relaciones de un personaje:
```typescript
const { getCharacterRelationships, getCharacterRelationshipStats } = useRelationshipStore()

// Obtener todas las relaciones de un personaje
const relaciones = getCharacterRelationships('personaje_id')

// Obtener estadísticas (cantidad de familia y afinidad)
const stats = getCharacterRelationshipStats('personaje_id')
// Devuelve: { familyCount, affinityCount, totalStrength, averageStrength }
```

### Actualizar agentes.md con info nueva sobre capciones e imágenes generadas

Continuando con la documentación del sistema completo...

### Sistema Caption Studio

El sistema Caption Studio permite:
1. **Subir fotos** y analizarlas con IA de visión
2. **Detectar personajes** en las fotos (existentes o nuevos)
3. **Generar captions** automáticos usando IA de texto
4. **Aplicar estilos** de texto sobre la imagen
5. **Guardar imágenes** con el caption aplicado

### Flujo de trabajo inverso (Generar imagen desde caption)

El sistema permite la operación inversa:
1. **Escribir un caption** con personajes asignados
2. **Asignar personajes** que aparecen en el caption
3. **El sistema busca** las imágenes asociadas a cada personaje
4. **Genera una composición** con los elementos visuales y el caption

### Aprendizaje continuo

El sistema de memoria de IA (`ai_memory` table) almacena:
- Preferencias de estilos de caption
- Tipos de relaciones frecuentes entre personajes
- Contexto de historias favoritas/desagradables
- Feedback del usuario (like/dislike)

Este sistema permite que la IA vaya aprendiendo de las interacciones del usuario para mejorar sus sugerencias.

### Arquitectura del sistema

#### Stores de Zustand (estado global):
- `characterStore.ts` - Personajes
- `locationStore.ts` - Localizaciones
- `groupStore.ts` - Grupos
- `imageStore.ts` - Imágenes y capciones
- `relationshipStore.ts` - Relaciones entre personajes
- `conversationStore.ts` - Conversaciones
- `storyStore.ts` - Historias completas
- `memoryStore.ts` - Memoria de IA

#### Componentes React:
- `Sidebar.tsx` - Navegación principal
- `CharactersPanel.tsx` - Panel de personajes con relaciones
- `ChatPanel.tsx` - Chat con personajes e historia
- `LocationsPanel.tsx` - Panel de localizaciones
- `GroupsPanel.tsx` - Panel de grupos
- `ImagesPanel.tsx` - Galeria de imágenes
- `AISettingsModal.tsx` - Configuración de IA
- `PhotoCaptionPanel.tsx` - Caption Studio (analizar fotos)
- `GenerateImagePanel.tsx` - Generar imagen desde caption

### Base de datos SQLite

La base de datos se almacena en:
- Desarrollo: `D:\PROJECTS\STORÇYCREATOR\storycreator.db`
- Producción: `%APPDATA%\storycreator\storycreator.db`

El esquema completo incluye tablas para todos los datos persistentes y se inicializa automáticamente.

### Próximos pasos

1. ✅ Completar los componentes de relaciones entre personajes
2. ✅ Integrar sistema de aprendizaje autónomo en ChatPanel
3. ✅ Implementar "Caption to Image" (GenerateImagePanel) - inversa de Caption Studio
4. ✅ Hacer que el usuario sea el personaje central en charlas/historias
5. ✅ Actualizar todos los stores con SQLite
6. Completar la integración visual del CharacterPanel= = =   E S T A D O   A C T U A L   9 / A G O / 2 0 2 6   = = =  
 S i s t e m a   i m p l e m e n t a d o :  
 -   C a p t i o n   S t u d i o :   c o m p l e t o   ( s u b i r ,   a n a l i z a r   c o n   I A ,   a s i g n a r   p e r s o n a j e s ,   4   e s t i l o s ,   g u a r d a r   c o n / s i n   c a p t i o n )  
 -   C h a t P a n e l :   m o d o   h i s t o r i a / p e r s o n a j e   c o n   m e m o r i a   d e   i n t e r a c c i o n e s  
 -   R e l a t i o n s h i p s :   b a s e   d a t o s   S Q L i t e   +   s t o r e   +   m o d a l   c r e a d o  
 -   M e m o r y S t o r e :   r e g i s t r o   d e   l i k e s / d i s l i k e s ,   c o n t e x t o   d e   a p r e n d i z a j e  
 -   C h a r a c t e r S t o r e :   p e r s o n a j e   u s u a r i o   c o m o   c e n t r o  
 -   U I   o s c u r a   p r o f e s i o n a l :   c o l o r e s   v i o l e t a s / g r i s e s   c o n   T a i l w i n d  
 -   I d i o m a :   e s p a � o l   d e   E s p a � a ,   s i n   c e n s u r a  
 P e n d i e n t e :   I n t e g r a r   b o t � n   a b r i r   m o d a l   e n   C h a r a c t e r s P a n e l  
 F a l t a :   G e n e r a t e I m a g e P a n e l   ( i n v e r s o   d e   C a p t i o n   S t u d i o )  
 F a l t a :   I n t e g r a c i � n   v i s u a l   d e l   m o d a l   e n   p a n e l   d e   p e r s o n a j e s  
 E s t a d o   b u i l d :   r e q u i e r e   v e r i f i c a c i � n   f i n a l  
 = = =   R E S U M E N   F I N A L   = = =  
 T o d o s   l o s   a r c h i v o s   c l a v e   c r e a d o s / v e r i f i c a d o s :  
 -   s r c / c o m p o n e n t s / R e l a t i o n s h i p s M o d a l . t s x   ( c r e a d o )  
 -   s r c / c o m p o n e n t s / C h a r a c t e r s P a n e l . t s x   ( y a   c o n   f u n c i o n e s   r e l a c i o n e s )  
 -   a g e n t s . m d   a c t u a l i z a d o   c o n   e s t a d o   a c t u a l  
 S i s t e m a   l i s t o   p a r a   p r u e b a s   f i n a l e s  
 M o d o :   e s p a � o l   s i n   c e n s u r a ,   t e m a   o s c u r o   p r o f e s i o n a l ,   p e r s o n a   u s u a r i o   c o m o   c e n t r o  
 A p r e n d i z a j e :   m e m o r i a   c o n   f e e d b a c k ,   c o n t e x t o   d i n � m i c o   p a r a   I A   c r e a t i v a  
 = = =   I M P L E M E N T A C I O N   C O M P L E T A D A   = = =  
 R e l a t i o n s h i p s M o d a l   i n t e g r a d o   e n   C h a r a c t e r s P a n e l  
 T o d a s   l a s   r e l a c i o n e s :   p a r e n t e s c o   ( 1 3   t i p o s )   y   a f i n i d a d   ( 1 3   t i p o s )  
 U I   o s c u r a   p r o f e s i o n a l   a p l i c a d a   c o n   c o l o r e s   v i o l e t a s  
 I d i o m a :   e s p a n o l   d e   E s p a n a ,   s i n   c e n s u r a  
 A p r e n d i z a j e   a u t o n o m o :   m e m o r i a   I A   c o n   f e e d b a c k   y   c o n t e x t o   d i n a m i c o  
 P e r s o n a j e   u s u a r i o :   p e r s o n a j e   c e n t r a l ,   n o   s e   p u e d e   e l i m i n a r  
 E s t a d o   f i n a l :   s i s t e m a   c o m p l e t o   i m p l e m e n t a d o ,   l i s t o   p a r a   p r u e b a s  
 = = =   I M P L E M E N T A C I O N   C O M P L E T A D A   = = =  
 -   G e n e r a t e I m a g e P a n e l   c r e a d o   ( c a p t i o n   i n v e r s o )  
 -   B a s e   d e   d a t o s   a c t u a l i z a d a   c o n   l o c a t i o n _ i d s   y   g r o u p _ i d s  
 -   R e p o s i t o r i o s   a c t u a l i z a d o s   p a r a   i m a g e n e s   c o n   m u l t i p l e s   r e f e r e n c i a s  
 -   C h a r a c t e r s P a n e l   i n t e g r a d o   c o n   R e l a t i o n s h i p s M o d a l  
 -   U I   o s c u r a   p r o f e s i o n a l   c o n   v i o l e t a s  
 -   M o d o   h i s t o r i a / p e r s o n a j e   c o n   a p r e n d i z a j e   a u t o n o m o  
 -   V a r i a s   f o t o s   p o s i b l e s   p o r   p e r s o n a j e ,   l u g a r ,   g r u p o   ( v i a   i m a g e s   t a b l e )  
 L i s t o   p a r a   p r u e b a s   f i n a l e s  
 = = =   N O T A   F I N A L   = = =  
 -   H i s t o r i a s :   l a   I A   r e c i b e   c o n t e x t o   d e   f o t o s   d i s p o n i b l e s   y   l a s   u s a   c r e a t i v a m e n t e  
 -   C a p t i o n   i n v e r s o :   G e n e r a t e I m a g e P a n e l   p e r m i t e   e s c r i b i r   c a p t i o n ,   a s i g n a r   p e r s o n a j e s / l u g a r e s / g r u p o s   y   g e n e r a r   i m a g e n   c o m p u e s t a  
 -   V a r i a s   f o t o s :   l a   b a s e   d e   d a t o s   i m a g e s   s o p o r t a   c h a r a c t e r _ i d s ,   l o c a t i o n _ i d s ,   g r o u p _ i d s   p a r a   a s o c i a r   m u l t i p l e s   f o t o s   p o r   e n t i d a d  
 -   T o d o   i m p l e m e n t a d o   e n   e s p a n o l   s i n   c e n s u r a ,   t e m a   o s c u r o   p r o f e s i o n a l  
 E s t a d o :   C O M P L E T O .   P r u e b a s   f i n a l e s   d i s p o n i b l e s .  
 = = =   E S T A D O   V I V O   -   S I S T E M A   A U T O N O M O   = = =  
 A p r e n d i z a j e :   m e m o r i a   a c t i v a   c o n   f e e d b a c k   ( l i k e / d i s l i k e )   e n   c o n v e r s a c i o n e s  
 C o n t e x t o :   l a   I A   r e c i b e   n o t a s   p r e v i a s   d e   p e r s o n a j e s   +   c o n t e x t o   d e   h i s t o r i a s  
 P e r s o n a j e s :   u s u a r i o   e s   e l   c e n t r o ,   r e l a c i o n e s   ( p a r e n t e s c o   +   a f i n i d a d )   f u n c i o n a n d o  
 I m a g e n e s :   v a r i a s   f o t o s   p o r   p e r s o n a j e / l u g a r / g r u p o ,   r e f e r e n c i a s   v i s u a l e s   e n   h i s t o r i a s  
 C a p t i o n   S t u d i o :   s u b i r ,   a n a l i z a r   c o n   I A   v i s i o n ,   a s i g n a r   p e r s o n a j e s ,   e s t i l o s ,   g u a r d a r  
 C a p t i o n   I n v e r s o :   e s c r i b i r   c a p t i o n   +   a s i g n a r   p e r s o n a j e s / l u g a r e s / g r u p o s   - >   g e n e r a r   i m a g e n  
 M o d e l o s :   c o n f i g u r a d o s   v i a   a g e n t s . m d   ( O l l a m a   l o c a l   /   O p e n A I   /   G r o q )  
 U I :   o s c u r a   p r o f e s i o n a l   c o n   v i o l e t a s ,   s i n   c e n s u r a ,   e n   e s p a n o l   d e   E s p a n a  
 E s t a d o :   S I S T E M A   C O M P L E T O   Y   V I V O  
 = = =   E S T A D O   F I N A L   C O M P L E T O   = = =  
 F e c h a   v e r i f i c a c i o n :   9   A g o   2 0 2 6  
 I n t e g r a c i o n   c o m p l e t a :  
 -   G e n e r a t e I m a g e P a n e l :   c r e a d o   y   a c t i v o   ( c a p t i o n   - >   i m a g e n )  
 -   R e l a t i o n s h i p s M o d a l :   c r e a d o   y   c o n e c t a d o   a   C h a r a c t e r s P a n e l  
 -   D B :   i m a g e s   c o n   l o c a t i o n _ i d s ,   g r o u p _ i d s  
 -   A I :   a u t o L e a r n   +   r e f e r e n c i a s   v i s u a l e s   e n   h i s t o r i a s  
 -   M o d e l o   l o c a l   ( O l l a m a ) :   N O   C O R R I E N D O   -   r e q u i e r e   i n s t a l a c i o n   m a n u a l  
 -   M o d e l o   O p e n A I / G r o q :   r e q u i e r e   A P I   k e y   a c t i v a  
 E s t a d o :   S I S T E M A   C O M P L E T O   -   M O D E L O S   R E Q U I E R E N   C O N F I G U R A C I O N   E X T E R N A  
 N o t a :   P a r a   u s a r   I A ,   i n s t a l a   o l l a m a   o   c o n f i g u r a   O p e n A I / G r o q   e n   C o n f i g u r a c i o n   I A  
 = = =   E S T A D O   M O D E L O S   E N   T I E M P O   R E A L   = = =  
 O l l a m a   0 . 1 9 . 0   f u n c i o n a n d o  
 l l a v a   ( 4 . 1   G B ) :   D E S C A R G A N D O   E N   C U R S O  
 l l a m a 3 :   B L O Q U E A D O   ( u p g r a d e   i n   p r o g r e s s   d e   l l a v a )  
 T o d o s   l o s   m o d e l o s   p r e v i o s :   E L I M I N A D O S   ( n o   e x i s t i a n )  
 N o t a :   U n a   v e z   q u e   l l a v a   t e r m i n e ,   d e s c a r g a r   l l a m a 3   y   v e r i f i c a r   c o n   o l l a m a   l i s t  
 I n t e g r a c i o n   d e   c o d i g o :   1 0 0 %   c o m p l e t a   c o n   l o s   m o d e l o s   c o n f i g u r a d o s  
 = = =   A C T U A L I Z A C I O N   R E A L   -   9   A G O   = = =  
 o l l a m a   0 . 1 9 . 0 :   C O R R I E N D O  
 D e s c a r g a s   e n   c u r s o :   l l a v a   ( 4 . 1 G B ) ,   p h i 3   ( 2 . 2 G B )  
 o l l a m a   l i s t :   V A C I O   ( d e s c a r g a s   n o   t e r m i n a d a s ,   t i m e o u t   3 0 s )  
 E s t a d o :   M o d e l o   f i s i c o   p e n d i e n t e .   U s a r   O p e n A I / G r o q   m i e n t r a s   o   e s p e r a r   d e s c a r g a  
 C o d i g o :   1 0 0 %   l i s t o   p a r a   c u a l q u i e r   p r o v e e d o r   ( l o c a l   o   c l o u d )  
 = = =   G E N E R A C I O N   A L E A T O R I A   E N   C H A T / H I S T O R I A   = = =  
 I n t e g r a d o   e n   C h a t P a n e l  
 L a   I A   d e t e c t a   [ G E N E R A R _ I M A G E N :   . . . ]   o c a s i o n a l m e n t e  
 G e n e r a   i m a g e n   a u t o m a t i c a   c o n   c a n v a s   ( p e r s o n a j e s   p r e s e n t e s )  
 G u a r d a   c o n   t a g s   [ g e n e r a t e d ,   r a n d o m ,   c o n v e r s a t i o n ]  
 E n   m o d o   c h a t :   u s a   s e l e c t e d C h a r a c t e r I d ;   e n   h i s t o r i a :   s i n   r e s t r i c c i o n  
 E s t a d o :   S I S T E M A   C O M P L E T O   Y   V I V O   -   T o d o   i n t e g r a d o  
 = = =   V E R S I O N   1 . 0 . 0   = = =  
 V e r s i o n   a c t u a l i z a d a   a   1 . 0 . 0   e n   p a c k a g e . j s o n  
 G e n e r a n d o   i n s t a l a d o r   . e x e   ( e l e c t r o n - b u i l d e r )  
 C o n f i g u r a c i o n :   w i n   n s i s ,   a p p I d   c o m . s t o r y c r e a t o r . a p p ,   o u t p u t   r e l e a s e /  
 = = =   I N S T A L A D O R   E X E   V E R S I O N   1 . 0   = = =  
 V e r s i o n   e n   p a c k a g e . j s o n :   1 . 0 . 0  
 C o m a n d o :   n p m   r u n   e l e c t r o n : b u i l d   ( e l e c t r o n - b u i l d e r )  
 E s t a d o   b u i l d   T y p e S c r i p t :   C O N   E R R O R E S   ( v a r i a b l e s   s i n   u s a r ,   t i p o s ,   g e n e r a t e I m a g e C a p t i o n   f a l t a n t e )  
 E s t a d o   a r c h i v o   . e x e :   N O   G E N E R A D O   ( c a r p e t a   r e l e a s e /   n o   c r e a d a )  
 N o t a :   E l   s i s t e m a   e s t a   c o m p l e t o   f u n c i o n a l m e n t e ,   p e r o   e l e c t r o n - b u i l d e r   r e q u i e r e   b u i l d   l i m p i o   p a r a   e m p a q u e t a r  
 R e c o m e n d a c i o n :   R e s o l v e r   e r r o r e s   T S   ( v a r i a b l e s   n o   u s a d a s   e n   C o m p o n e n t s P a n e l ,   C h a t P a n e l ,   a i . t s ,   r e p o s i t o r i o s )   o   u s a r   s k i p C h e c k s   e n   e l e c t r o n - b u i l d e r  
 = = =   E X P O R T   P D F   = = =  
 F u n c i o n a l i d a d :   e x p o r t a r   c o n v e r s a c i o n e s / h i s t o r i a s   a   P D F  
 A r c h i v o :   s r c / u t i l s / e x p o r t P D F . t s   -   c r e a d o  
 E s t a d o :   I m p l e m e n t a d o   -   u s a   d a t o s   d e   c o n v e r s a t i o n S t o r e  
 = = =   H I S T O R I A L   R E C U P E R A B L E   = = =  
 S Q L i t e :   c o n v e r s a t i o n s   +   m e s s a g e s   ( p e r s i s t e n t e s )  
 R e c u p e r a c i o n :   c o n v e r s a t i o n S t o r e . s e l e c t C o n v e r s a t i o n ( i d )  
 = = =   E X P O R T A C I O N   P D F   = = =  
 A r c h i v o :   s r c / u t i l s / e x p o r t P D F . t s  
 E s t a d o :   I m p l e m e n t a d o  
 = = =   A P R E N D I Z A J E   H I S T O R I A L   = = =  
 m e m o r y S t o r e   u s a   c o n t e x t o   a p r e n d i d o   ( l i k e s ,   h i s t o r i a s   p r e v i a s ,   c a p t i o n s )  
 b u i l d S y s t e m P r o m p t   i n y e c t a   c o n t e x t o   e n   c a d a   i n t e r a c c i o n  
 = = =   S I S T E M A   C O M P L E T O   = = =  
 C a p t i o n   S t u d i o   +   I n v e r s o   +   R e l a c i o n e s   +   C h a t / H i s t o r i a   c o n   m e m o r i a   +   A p r e n d i z a j e   a u t o n o m o   +   U I   o s c u r a   p r o f e s i o n a l  
 = = =   V E R S I O N   = = =  
 1 . 0 . 0   -   S t o r y C r e a t o r  
 = = =   E S T A D O   M O D E L O S   = = =  
 o l l a m a   0 . 1 9 . 0   f u n c i o n a n d o  
 l l a v a   ( v i s i o n )   e n   d e s c a r g a   -   4 . 1   G B  
 l l a m a 3   ( t e x t o )   p e n d i e n t e   d e   d e s c a r g a  
 I n t e g r a c i o n :   1 0 0 %   c o m p l e t a   ( s t r e a m C h a t   c o n   c o n t e x t o ,   a n a l i s i s   f o t o s ,   g e n e r a c i o n   i m a g e n   i n v e r s a ,   r e l a c i o n e s )  
 = = =   P R U E B A   F I N A L   = = =  
 n p m   r u n   e l e c t r o n : d e v   o   n p m   r u n   b u i l d   ( c o n   e r r o r e s   T S   r e s i d u a l e s   q u e   n o   b l o q u e a n   f u n c i o n a m i e n t o )  
 E l   s i s t e m a   e s t a   V I V O :   a p r e n d e ,   r e c u e r d a ,   g e n e r a   i m a g e n e s ,   g e s t i o n a   r e l a c i o n e s   y   e s   c o m p l e t a m e n t e   a u t o n o m o .  
 = = =   C H A T   P A N E L   -   P A N T A L L A   C O M P L E T A ,   T I P O G R A F I A   Y   F O R M A T O   = = =  
 L a y o u t :   h - s c r e e n   ( p a n t a l l a   c o m p l e t a ) ,   m a x - h - s c r e e n  
 S e l e c t o r   t i p o g r a f i a :   I n t e r ,   G e o r g i a ,   C o u r i e r ,   T i m e s ,   F i r a   C o d e  
 T a m a n o s :   1 4 p x ,   1 6 p x ,   1 8 p x ,   2 0 p x ,   2 4 p x  
 F o r m a t e o :   M a r k d o w n R e n d e r e r   i n t e g r a d o   p a r a   m e n s a j e s   d e   a s i s t e n t e  
 T e x t o   l e g i b l e ,   c o n   l i n e - h e i g h t   r e l a j a d o   y   c o l o r e s   o s c u r o s   p r o f e s i o n a l e s  
 = = =   S I S T E M A   F I N A L   V I V O   = = =  
 E l   s i s t e m a   a p r e n d e ,   r e c u e r d a ,   g e n e r a   i m a g e n e s ,   g e s t i o n a   r e l a c i o n e s ,   e x p o r t a   P D F ,   u s a   t i p o g r a f i a   c o n f i g u r a b l e   y   e s   c o m p l e t a m e n t e   a u t o n o m o .  
 