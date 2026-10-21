import { ChevronDown } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'
import { cx } from '../../utils/cx.ts'
import { SCENE_COLORS } from '../scene3d/palette.ts'

export function MapLegend() {
  // Começa recolhida para não tapar a rede; abre com um clique.
  const [open, setOpen] = useState(false)
  const listId = useId()

  return (
    <div className="w-44 rounded-card bg-surface-raised/90 p-1.5 shadow-float ring-1 ring-border/70 backdrop-blur-md">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between rounded-xl px-2 py-1 text-[0.6875rem] font-extrabold tracking-wider text-subtle uppercase transition-colors hover:bg-surface-muted"
      >
        Legenda
        <ChevronDown
          aria-hidden="true"
          className={cx('size-3.5 transition-transform duration-200 ease-spring', !open && '-rotate-90')}
        />
      </button>
      {open && (
        <ul id={listId} className="flex flex-col gap-1 px-2 pt-1 pb-1.5 text-[0.6875rem] font-semibold text-muted">
          <Item swatch={<Line color={SCENE_COLORS.motorway} thick />}>Autoestrada</Item>
          <Item swatch={<Line color={SCENE_COLORS.alternative} />}>Via alternativa</Item>
          <Item swatch={<Dot ring={SCENE_COLORS.cityRing} />}>Cidade</Item>
          <Item swatch={<Dot ring={SCENE_COLORS.interchangeRing} small />}>Nó de ligação</Item>
          <Item swatch={<Gate color={SCENE_COLORS.tollActive} />}>Pórtico ativo</Item>
          <Item swatch={<Gate color={SCENE_COLORS.tollInactive} />}>Pórtico inativo</Item>
          <Item swatch={<Line color={SCENE_COLORS.selected} thick />}>Selecionado</Item>
          <li className="mt-1 border-t border-border pt-1.5 text-[0.625rem] leading-snug font-medium text-subtle">
            Contorno: Natural Earth · Localidades: Wikidata
          </li>
        </ul>
      )}
    </div>
  )
}

function Item({ swatch, children }: { swatch: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-center gap-2">
      <span aria-hidden="true" className="flex w-6 shrink-0 items-center justify-center">
        {swatch}
      </span>
      {children}
    </li>
  )
}

function Line({ color, thick }: { color: string; thick?: boolean }) {
  return (
    <span
      className={cx('w-6 rounded-full ring-2 ring-white', thick ? 'h-1.5' : 'h-1')}
      style={{ backgroundColor: color }}
    />
  )
}

function Dot({ ring, small }: { ring: string; small?: boolean }) {
  return (
    <span
      className={cx('rounded-full bg-white', small ? 'size-2.5 border-2' : 'size-3 border-[3px]')}
      style={{ borderColor: ring }}
    />
  )
}

function Gate({ color }: { color: string }) {
  return (
    <span className="relative h-3 w-3.5">
      <span className="absolute top-0 left-0 h-1 w-full rounded-sm" style={{ backgroundColor: color }} />
      <span className="absolute top-0 left-0 h-3 w-1 rounded-sm" style={{ backgroundColor: color }} />
      <span className="absolute top-0 right-0 h-3 w-1 rounded-sm" style={{ backgroundColor: color }} />
    </span>
  )
}
