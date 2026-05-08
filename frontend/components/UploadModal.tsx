'use client'

import { useState, useRef, useEffect, DragEvent, ChangeEvent } from 'react'
import { Upload, X, CheckCircle, Loader2 } from 'lucide-react'
import { clsx } from 'clsx'
import { uploadContract, getContract } from '../lib/api'

type Step = 'idle' | 'uploading' | 'analyzing' | 'complete'

interface Props {
  getToken: () => Promise<string | null>
  onComplete: () => void
  onClose: () => void
}

const ALLOWED_TYPES = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
const MAX_BYTES = 10 * 1024 * 1024

export function UploadModal({ getToken, onComplete, onClose }: Props) {
  const [step, setStep] = useState<Step>('idle')
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }

  // Clear the poll interval if the modal is closed mid-upload (e.g. user presses Escape).
  // Without this the interval fires forever after the component unmounts.
  useEffect(() => () => stopPolling(), [])

  async function handleFile(file: File) {
    setError(null)
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Only PDF and DOCX files are accepted.')
      return
    }
    if (file.size > MAX_BYTES) {
      setError('File must be under 10 MB.')
      return
    }

    setStep('uploading')
    const token = await getToken()
    if (!token) { setStep('idle'); setError('Not authenticated.'); return }
    let contract
    try {
      contract = await uploadContract(token, file)
    } catch (e: unknown) {
      setStep('idle')
      setError(e instanceof Error ? e.message : 'Upload failed.')
      return
    }

    setStep('analyzing')

    const contractId = contract.id
    pollRef.current = setInterval(async () => {
      const t = await getToken()
      if (!t) return
      try {
        const updated = await getContract(t, contractId)
        if (updated.status === 'complete' || updated.status === 'failed') {
          stopPolling()
          setStep('complete')
          setTimeout(() => {
            onComplete()
            onClose()
          }, 1500)
        }
      } catch {
        // keep polling on transient error
      }
    }, 3000)
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  function onChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  const STEPS: { key: Step; label: string }[] = [
    { key: 'uploading', label: 'Uploading' },
    { key: 'analyzing', label: 'Analyzing' },
    { key: 'complete', label: 'Complete' },
  ]

  const stepIndex = STEPS.findIndex((s) => s.key === step)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
          disabled={step === 'uploading' || step === 'analyzing'}
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-lg font-semibold text-gray-900 mb-4">Upload Contract</h2>

        {step === 'idle' && (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            className={clsx(
              'border-2 border-dashed rounded-lg p-10 flex flex-col items-center gap-3 cursor-pointer transition-colors',
              dragging ? 'border-accent bg-blue-50' : 'border-gray-300 hover:border-accent',
            )}
          >
            <Upload className="w-8 h-8 text-gray-400" />
            <p className="text-sm text-gray-600 text-center">
              Drag & drop a PDF or DOCX, or{' '}
              <span className="text-accent font-medium">browse</span>
            </p>
            <p className="text-xs text-gray-400">Max 10 MB</p>
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.docx"
              className="hidden"
              onChange={onChange}
            />
          </div>
        )}

        {step !== 'idle' && (
          <div className="py-6">
            {/* Step indicators */}
            <div className="flex items-center justify-between mb-8">
              {STEPS.map((s, i) => {
                const done = i < stepIndex || step === 'complete'
                const active = i === stepIndex && step !== 'complete'
                return (
                  <div key={s.key} className="flex flex-col items-center flex-1">
                    <div
                      className={clsx(
                        'w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors',
                        done && 'bg-green-500 border-green-500',
                        active && 'border-accent bg-white',
                        !done && !active && 'border-gray-200 bg-white',
                      )}
                    >
                      {done ? (
                        <CheckCircle className="w-4 h-4 text-white" />
                      ) : active ? (
                        <Loader2 className="w-4 h-4 text-accent animate-spin" />
                      ) : (
                        <span className="text-xs text-gray-400">{i + 1}</span>
                      )}
                    </div>
                    <span
                      className={clsx(
                        'text-xs mt-1',
                        active ? 'text-accent font-medium' : done ? 'text-green-600' : 'text-gray-400',
                      )}
                    >
                      {s.label}
                    </span>
                  </div>
                )
              })}
            </div>

            <p className="text-center text-sm text-gray-500">
              {step === 'uploading' && 'Uploading your document...'}
              {step === 'analyzing' && 'Extracting and analyzing clauses. This may take a minute.'}
              {step === 'complete' && (
                <span className="text-green-600 font-medium">Analysis complete!</span>
              )}
            </p>
          </div>
        )}

        {error && (
          <p className="mt-3 text-sm text-red-600 text-center">{error}</p>
        )}
      </div>
    </div>
  )
}
