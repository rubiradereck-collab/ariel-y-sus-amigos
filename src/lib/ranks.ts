export const RANKS = [
  { min: 1,  name: 'Novato del servidor' },
  { min: 3,  name: 'Pana' },
  { min: 5,  name: 'Veterano' },
  { min: 8,  name: 'Leyenda' },
  { min: 12, name: 'Casi Joel' },
] as const

export const rankFor = (level: number) => {
  const found = [...RANKS].reverse().find(r => level >= r.min)
  return found ? found.name : 'Novato'
}
