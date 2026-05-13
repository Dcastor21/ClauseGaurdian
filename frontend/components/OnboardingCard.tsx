import { Upload, Sparkles, Bell, type LucideIcon } from 'lucide-react'

const STEPS: { num: number; icon: LucideIcon; title: string; body: string }[] = [
  {
    num: 1,
    icon: Upload,
    title: 'Upload your contract',
    body: 'Drag and drop a PDF or DOCX — up to 20 MB.',
  },
  {
    num: 2,
    icon: Sparkles,
    title: 'AI analyzes every clause',
    body: 'Risk is flagged, scored, and explained in plain English — no legal background needed.',
  },
  {
    num: 3,
    icon: Bell,
    title: 'Get alerted before deadlines',
    body: 'We track renewal dates and send reminders so nothing slips through.',
  },
]

export function OnboardingCard({ onUpload }: { onUpload: () => void }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 md:p-8">
      <h2 className="text-base font-semibold text-navy mb-1">Get started in 3 steps</h2>
      <p className="text-sm text-gray-500 mb-6">Upload your first contract and ClauseGuardian does the rest.</p>
      <div className="flex flex-col md:flex-row gap-6 mb-8">
        {STEPS.map(({ num, icon: Icon, title, body }) => (
          <div key={num} className="flex-1">
            <div className="flex items-center gap-2.5 mb-3">
              <span className="w-7 h-7 rounded-full bg-accent text-white text-xs font-bold flex items-center justify-center shrink-0">
                {num}
              </span>
              <Icon className="w-4 h-4 text-accent" />
            </div>
            <p className="text-sm font-semibold text-gray-900 mb-1">{title}</p>
            <p className="text-sm text-gray-500 leading-relaxed">{body}</p>
          </div>
        ))}
      </div>
      <button
        onClick={onUpload}
        className="inline-flex items-center gap-2 bg-accent text-white px-4 py-3 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-white"
      >
        <Upload className="w-4 h-4" aria-hidden="true" /> Upload Contract
      </button>
    </div>
  )
}
