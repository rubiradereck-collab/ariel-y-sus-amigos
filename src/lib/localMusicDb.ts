import { openDB, type DBSchema } from 'idb'

export interface LocalTrack {
  id: string
  fingerprint: string // `${name}|${size}|${lastModified}` para detectar duplicados
  title: string
  artist: string
  album?: string
  durationSec: number
  size: number
  mime: string
  addedAt: number
}

export interface LocalPlaylist {
  id: string
  name: string
  trackIds: string[]
  createdAt: number
  updatedAt: number
}

export interface MusicDB extends DBSchema {
  tracks: {
    key: string
    value: LocalTrack
    indexes: {
      'by-fp': string
      'by-artist': string
      'by-added': number
    }
  }
  blobs: {
    key: string
    value: Blob
  }
  playlists: {
    key: string
    value: LocalPlaylist
  }
}

export const openLibrary = (uid: string) => {
  return openDB<MusicDB>(`ariel-music:${uid}`, 1, {
    upgrade(db) {
      const t = db.createObjectStore('tracks', { keyPath: 'id' })
      t.createIndex('by-fp', 'fingerprint')
      t.createIndex('by-artist', 'artist')
      t.createIndex('by-added', 'addedAt')

      db.createObjectStore('blobs')
      db.createObjectStore('playlists', { keyPath: 'id' })
    },
  })
}
