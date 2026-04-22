import type { ConditionRating } from '@/types/forecast'

const CONFIG: Record<ConditionRating, { label: string; className: string }> = {
  poor: {
    label: 'Poor',
    className: 'bg-slate-600 text-slate-200',
  },
  fair: {
    label: 'Fair',
    className: 'bg-yellow-500 text-yellow-950',
  },
  good: {
    label: 'Good',
    className: 'bg-emerald-500 text-emerald-950',
  },
  epic: {
    label: 'EPIC',
    className: 'bg-purple-500 text-white',
  },
}

interface Props {
  rating: ConditionRating
  size?: 'sm' | 'md' | 'lg'
}

export function ConditionBadge({ rating, size = 'md' }: Props) {
  const { label, className } = CONFIG[rating]
  const sizeClass =
    size === 'sm'
      ? 'px-2 py-0.5 text-xs'
      : size === 'lg'
        ? 'px-4 py-1.5 text-lg font-bold'
        : 'px-3 py-1 text-sm font-semibold'

  const epicStyle = rating === 'epic'
    ? { boxShadow: '0 0 0 3px rgba(124,58,237,0.2)' }
    : undefined

  return (
    <span className={`inline-block rounded-full ${sizeClass} ${className}`} style={epicStyle}>
      {label}
    </span>
  )
}
