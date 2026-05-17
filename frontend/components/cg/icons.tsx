// components/cg/icons.tsx — small inline SVG icons. Stroke-based, 1.5px.
import * as React from 'react'

export interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number
  strokeWidth?: number
}

const ico =
  (path: React.ReactNode, viewBox = '0 0 24 24') =>
  ({ size = 16, className = '', strokeWidth = 1.5, ...rest }: IconProps) => (
    <svg
      viewBox={viewBox}
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...rest}
    >
      {path}
    </svg>
  )

export const Icon = {
  // Brand
  Leaf: ico(
    <g>
      <path d="M11 20A7 7 0 014 13c0-6 7-9 16-9 0 9-3 16-9 16z" />
      <path d="M4 21c2-4 4-6 8-8" />
    </g>,
  ),
  Shield: ico(<path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5l8-3z" />),

  // Nav / actions
  Inbox: ico(
    <g>
      <path d="M3 12h5l2 3h4l2-3h5" />
      <path d="M3 12l3-8h12l3 8v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6z" />
    </g>,
  ),
  Archive: ico(
    <g>
      <rect x="3" y="4" width="18" height="4" rx="1" />
      <path d="M5 8v11a2 2 0 002 2h10a2 2 0 002-2V8" />
      <path d="M10 12h4" />
    </g>,
  ),
  Settings: ico(
    <g>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1A1.7 1.7 0 008 19.4a1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H2a2 2 0 110-4h.1a1.7 1.7 0 001.5-1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3h0a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8v0a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" />
    </g>,
  ),

  // Status / risk
  AlertTriangle: ico(
    <g>
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
      <path d="M10.3 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.7 3.86a2 2 0 00-3.4 0z" />
    </g>,
  ),
  AlertCircle: ico(
    <g>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4" />
      <path d="M12 16h.01" />
    </g>,
  ),
  Clock: ico(
    <g>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </g>,
  ),
  Check: ico(<path d="M5 12l4 4L19 7" />),
  CheckCircle: ico(
    <g>
      <circle cx="12" cy="12" r="10" />
      <path d="M8 12l3 3 5-6" />
    </g>,
  ),
  Sparkle: ico(
    <g>
      <path d="M12 3v6" />
      <path d="M12 15v6" />
      <path d="M3 12h6" />
      <path d="M15 12h6" />
    </g>,
  ),

  // UI
  Search: ico(
    <g>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </g>,
  ),
  Upload: ico(
    <g>
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <path d="M17 8l-5-5-5 5" />
      <path d="M12 3v12" />
    </g>,
  ),
  Plus: ico(
    <g>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </g>,
  ),
  X: ico(
    <g>
      <path d="M18 6L6 18" />
      <path d="M6 6l12 12" />
    </g>,
  ),
  ChevronDown: ico(<path d="M6 9l6 6 6-6" />),
  ChevronUp: ico(<path d="M18 15l-6-6-6 6" />),
  ChevronRight: ico(<path d="M9 6l6 6-6 6" />),
  ChevronLeft: ico(<path d="M15 6l-6 6 6 6" />),
  ArrowLeft: ico(
    <g>
      <path d="M19 12H5" />
      <path d="M12 19l-7-7 7-7" />
    </g>,
  ),
  ArrowRight: ico(
    <g>
      <path d="M5 12h14" />
      <path d="M12 5l7 7-7 7" />
    </g>,
  ),
  MoreHorizontal: ico(
    <g>
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
      <circle cx="5" cy="12" r="1" />
    </g>,
  ),

  // Content
  File: ico(
    <g>
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <path d="M14 2v6h6" />
    </g>,
  ),
  FileText: ico(
    <g>
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M8 13h8" />
      <path d="M8 17h6" />
    </g>,
  ),
  Calendar: ico(
    <g>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4" />
      <path d="M8 2v4" />
      <path d="M3 10h18" />
    </g>,
  ),
  Hash: ico(
    <g>
      <path d="M4 9h16" />
      <path d="M4 15h16" />
      <path d="M10 3L8 21" />
      <path d="M16 3l-2 18" />
    </g>,
  ),
  Quote: ico(
    <g>
      <path d="M3 21c3 0 7-1 7-8V5a2 2 0 00-2-2H4a2 2 0 00-2 2v6a2 2 0 002 2h3" />
      <path d="M14 21c3 0 7-1 7-8V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v6a2 2 0 002 2h3" />
    </g>,
  ),
  Lightbulb: ico(
    <g>
      <path d="M9 18h6" />
      <path d="M10 22h4" />
      <path d="M12 2a7 7 0 00-4 12.7c.6.4 1 1 1 1.7V18h6v-1.6c0-.7.4-1.3 1-1.7A7 7 0 0012 2z" />
    </g>,
  ),

  // Triage actions
  ThumbsUp: ico(
    <g>
      <path d="M7 10v12" />
      <path d="M15 5.88L14 10h5.83a2 2 0 011.92 2.56l-2.33 8A2 2 0 0117.5 22H7" />
    </g>,
  ),
  ThumbsDown: ico(
    <g>
      <path d="M17 14V2" />
      <path d="M9 18.12L10 14H4.17a2 2 0 01-1.92-2.56l2.33-8A2 2 0 016.5 2H17" />
    </g>,
  ),
  Pen: ico(
    <g>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 113 3L7 19l-4 1 1-4 12.5-12.5z" />
    </g>,
  ),
  Send: ico(
    <g>
      <path d="M22 2L11 13" />
      <path d="M22 2l-7 20-4-9-9-4 20-7z" />
    </g>,
  ),

  // Misc
  Trash: ico(
    <g>
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" />
      <path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
    </g>,
  ),
  Grid: ico(
    <g>
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </g>,
  ),
  List: ico(
    <g>
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </g>,
  ),
  Filter: ico(<path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />),
  Bell: ico(
    <g>
      <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 01-3.4 0" />
    </g>,
  ),
} as const

export type IconName = keyof typeof Icon
