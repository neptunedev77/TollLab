import type { SchematicPoint } from '../../domain/types.ts'
import { BASEMAP_CLIP, type LonLat } from './basemap.ts'

/*
 * Projeção do mapa: equiretangular simples (plate carrée com correção de latitude).
 *  - x = (lon − lonOrigem) · cos(latRef) · unidadesPorGrau
 *  - y = (latOrigem − lat) · unidadesPorGrau   (norte em cima; y cresce para sul)
 * 1 unidade do mapa = 250 m na direção norte–sul. À escala de Portugal continental a distorção
 * é pequena (≈ ±6% na direção leste–oeste nos extremos norte e sul), adequada a um mapa de
 * demonstração. Não serve para medições rigorosas.
 */

export const KM_PER_UNIT = 0.25
const KM_PER_DEGREE_LAT = 111.32
export const UNITS_PER_DEGREE = KM_PER_DEGREE_LAT / KM_PER_UNIT
export const REFERENCE_LAT = 40
const COS_REF = Math.cos((REFERENCE_LAT * Math.PI) / 180)

const ORIGIN_LON = BASEMAP_CLIP.minLon
const ORIGIN_LAT = BASEMAP_CLIP.maxLat

export function project([lon, lat]: LonLat): SchematicPoint {
  return {
    x: Math.round((lon - ORIGIN_LON) * COS_REF * UNITS_PER_DEGREE * 10) / 10,
    y: Math.round((ORIGIN_LAT - lat) * UNITS_PER_DEGREE * 10) / 10,
  }
}

/** Plano do mapa: o retângulo de recorte do mapa base, já projetado. */
export const MAP_PLANE = {
  width: Math.ceil((BASEMAP_CLIP.maxLon - BASEMAP_CLIP.minLon) * COS_REF * UNITS_PER_DEGREE),
  height: Math.ceil((BASEMAP_CLIP.maxLat - BASEMAP_CLIP.minLat) * UNITS_PER_DEGREE),
} as const

export const PROJECTION_DESCRIPTION = `Equiretangular, latitude de referência ${REFERENCE_LAT}°; 1 unidade = ${KM_PER_UNIT * 1000} m`
