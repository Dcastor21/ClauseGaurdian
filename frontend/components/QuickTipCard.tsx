interface Props {
  title?: string
  body: string
}

export function QuickTipCard({ title = 'Quick Tip', body }: Props) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <p className="text-[10px] font-bold text-accent uppercase tracking-[0.06em] mb-1.5">{title}</p>
      <p className="text-xs text-gray-600 leading-relaxed">{body}</p>
    </div>
  )
}
