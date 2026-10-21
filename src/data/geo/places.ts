import type { NodeId } from '../../domain/types.ts'
import type { LonLat } from './basemap.ts'

/*
 * Localização dos nós da rede (longitude, latitude em graus, WGS84).
 *
 * Fonte: Wikidata, propriedade P625 (coordenadas) do item de cada município português
 * (instância de Q13217644), consultado a 22/10/2026 através de https://query.wikidata.org.
 * Os dados do Wikidata estão em CC0 1.0 (domínio público): sem atribuição obrigatória.
 *
 * As coordenadas de um município correspondem aproximadamente à sua sede, não a um nó rodoviário.
 */

export interface PlaceSource {
  readonly wikidata: string
  readonly coordinates: LonLat
  /** Nota quando a posição é uma aproximação do elemento representado. */
  readonly note?: string
}

export const PLACES: Readonly<Record<NodeId, PlaceSource>> = {
  valenca: { wikidata: 'Q492475', coordinates: [-8.63388, 42.02821] },
  'ponte-de-lima': { wikidata: 'Q490180', coordinates: [-8.583333333, 41.766666666] },
  braga: { wikidata: 'Q83247', coordinates: [-8.416666666, 41.533333333] },
  guimaraes: { wikidata: 'Q170903', coordinates: [-8.290833333, 41.445] },
  fafe: { wikidata: 'Q551080', coordinates: [-8.166666666, 41.45] },
  famalicao: { wikidata: 'Q551658', coordinates: [-8.516666666, 41.416666666] },
  'vila-do-conde': { wikidata: 'Q917313', coordinates: [-8.75, 41.35] },
  maia: {
    wikidata: 'Q990403',
    coordinates: [-8.616666666, 41.233333333],
    note: 'Usa as coordenadas do município da Maia como aproximação do nó rodoviário.',
  },
  porto: { wikidata: 'Q36433', coordinates: [-8.610833333, 41.15] },
  penafiel: { wikidata: 'Q984656', coordinates: [-8.283333333, 41.2] },
  amarante: { wikidata: 'Q454875', coordinates: [-8.078361111, 41.269027777] },
  'vila-real': { wikidata: 'Q503856', coordinates: [-7.746111111, 41.295277777] },
  braganca: { wikidata: 'Q768261', coordinates: [-6.75, 41.8] },
}
