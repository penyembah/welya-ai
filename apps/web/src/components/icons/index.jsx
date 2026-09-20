import * as React from "react"

// Welya icon set: 24px grid, 1.75 stroke, rounded caps/joins, soft geometry.
// Exposes lucide-compatible names so the whole app (incl. shadcn ui) uses these.

function make(name, shapes) {
  const Icon = React.forwardRef(function Icon({ size = 24, strokeWidth = 1.75, className, children, ...props }, ref) {
    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className={className}
        {...props}
      >
        {shapes}
        {children}
      </svg>
    )
  })
  Icon.displayName = name
  return Icon
}

const P = (d, extra) => <path key={d} d={d} {...extra} />
const C = (cx, cy, r, extra) => <circle key={`${cx}-${cy}-${r}`} cx={cx} cy={cy} r={r} {...extra} />
const R = (x, y, w, h, rx = 3) => <rect key={`${x}-${y}-${w}-${h}`} x={x} y={y} width={w} height={h} rx={rx} />
const Dot = (cx, cy) => <circle key={`d${cx}-${cy}`} cx={cx} cy={cy} r="0.9" fill="currentColor" stroke="none" />

/* ---------- basic / navigation ---------- */
export const CheckIcon = make("CheckIcon", [P("M5 12.5l4.5 4.5L19 7")])
export const CheckCheckIcon = make("CheckCheckIcon", [P("M2.5 13l4 4L14 9.5"), P("M10.5 17l1.5 1.5L21.5 9.5")])
export const CheckCircle2Icon = make("CheckCircle2Icon", [C(12, 12, 9), P("M8.5 12.5l2.5 2.5 4.5-5.5")])
export const CircleCheckIcon = CheckCircle2Icon
export const XIcon = make("XIcon", [P("M6.5 6.5l11 11"), P("M17.5 6.5l-11 11")])
export const OctagonXIcon = make("OctagonXIcon", [P("M8 3h8l5 5v8l-5 5H8l-5-5V8l5-5Z"), P("M9.5 9.5l5 5M14.5 9.5l-5 5")])
export const PlusIcon = make("PlusIcon", [P("M12 5.5v13"), P("M5.5 12h13")])
export const ChevronDownIcon = make("ChevronDownIcon", [P("M6.5 9.5l5.5 5.5 5.5-5.5")])
export const ChevronUpIcon = make("ChevronUpIcon", [P("M6.5 14.5L12 9l5.5 5.5")])
export const ChevronLeftIcon = make("ChevronLeftIcon", [P("M14.5 6.5L9 12l5.5 5.5")])
export const ChevronRightIcon = make("ChevronRightIcon", [P("M9.5 6.5L15 12l-5.5 5.5")])
export const ChevronsUpDownIcon = make("ChevronsUpDownIcon", [P("M8 9l4-4 4 4"), P("M8 15l4 4 4-4")])
export const ArrowLeftIcon = make("ArrowLeftIcon", [P("M19 12H5.5"), P("M11 6.5L5.5 12l5.5 5.5")])
export const ArrowRightIcon = make("ArrowRightIcon", [P("M5 12h13.5"), P("M13 6.5l5.5 5.5-5.5 5.5")])
export const ArrowUpIcon = make("ArrowUpIcon", [P("M12 19V5.5"), P("M6.5 11L12 5.5 17.5 11")])
export const MoreHorizontalIcon = make("MoreHorizontalIcon", [C(5.5, 12, 1.3, { fill: "currentColor", stroke: "none" }), C(12, 12, 1.3, { fill: "currentColor", stroke: "none" }), C(18.5, 12, 1.3, { fill: "currentColor", stroke: "none" })])
export const SearchIcon = make("SearchIcon", [C(10.5, 10.5, 6.5), P("M20.5 20.5l-5-5")])
export const PanelLeftIcon = make("PanelLeftIcon", [R(3, 4.5, 18, 15), P("M9 4.5v15")])
export const UndoIcon = make("UndoIcon", [P("M3.5 8.5h5v-5"), P("M3.5 8.5A9 9 0 1 1 5.8 17.6")])
export const RefreshCwIcon = make("RefreshCwIcon", [P("M20 11a8 8 0 0 0-14.5-4L4 8.5"), P("M4 13a8 8 0 0 0 14.5 4l1.5-1.5"), P("M4 3.5V8.5h5"), P("M20 20.5v-5h-5")])
export const Loader2Icon = make("Loader2Icon", [P("M12 3a9 9 0 0 1 9 9")])
export const LogOutIcon = make("LogOutIcon", [P("M10 4H6.5A2.5 2.5 0 0 0 4 6.5v11A2.5 2.5 0 0 0 6.5 20H10"), P("M15.5 8l4 4-4 4"), P("M9 12h10.5")])
export const LinkIcon = make("LinkIcon", [P("M10 14.5a4.2 4.2 0 0 1 0-6l2.5-2.5a4.2 4.2 0 0 1 6 6l-1 1"), P("M14 9.5a4.2 4.2 0 0 1 0 6L11.5 18a4.2 4.2 0 0 1-6-6l1-1")])
export const CompassIcon = make("CompassIcon", [C(12, 12, 9), P("M15.5 8.5l-2 5-5 2 2-5 5-2Z")])

/* ---------- status ---------- */
export const InfoIcon = make("InfoIcon", [C(12, 12, 9), P("M12 11v5.5"), Dot(12, 7.8)])
export const AlertCircleIcon = make("AlertCircleIcon", [C(12, 12, 9), P("M12 7.5v5.5"), Dot(12, 16.3)])
export const AlertTriangleIcon = make("AlertTriangleIcon", [P("M12 4l9 15.5H3L12 4Z"), P("M12 9.5v4"), Dot(12, 16.5)])
export const TriangleAlertIcon = AlertTriangleIcon
export const EyeOffIcon = make("EyeOffIcon", [P("M3 12c2-3.8 5-6 9-6 1.5 0 2.9.3 4.2.9"), P("M21 12c-2 3.8-5 6-9 6-1.5 0-2.9-.3-4.2-.9"), P("M4 4l16 16"), P("M9.5 9.6a3.3 3.3 0 0 0 4.9 4.8")])
export const StarIcon = make("StarIcon", [P("M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1.1 5.9L12 16.9l-5.3 2.8 1.1-5.9-4.3-4.1 5.9-.8L12 3.5Z")])
export const HeartIcon = make("HeartIcon", [P("M12 20s-7.5-4.5-7.5-10A4 4 0 0 1 12 7.5 4 4 0 0 1 19.5 10c0 5.5-7.5 10-7.5 10Z")])
export const SparklesIcon = make("SparklesIcon", [P("M12 4.5l1.8 5.2 5.2 1.8-5.2 1.8L12 18.5l-1.8-5.2L5 11.5l5.2-1.8L12 4.5Z"), P("M19 3v3M17.5 4.5h3"), P("M5 17v3M3.5 18.5h3")])
export const ShieldIcon = make("ShieldIcon", [P("M12 3l8 3v6c0 4.5-3.5 7.6-8 9-4.5-1.4-8-4.5-8-9V6l8-3Z")])

/* ---------- time ---------- */
export const ClockIcon = make("ClockIcon", [C(12, 12, 9), P("M12 7.5V12l3.5 2")])
export const TimerIcon = make("TimerIcon", [C(12, 13.5, 7.5), P("M12 9.5v4l2.8 1.6"), P("M9.5 2.5h5"), P("M12 2.5V6")])
export const CalendarIcon = make("CalendarIcon", [R(3.5, 5, 17, 15.5), P("M3.5 10h17"), P("M8 3v4M16 3v4")])
export const CalendarPlusIcon = make("CalendarPlusIcon", [R(3.5, 5, 17, 15.5), P("M3.5 10h17"), P("M8 3v4M16 3v4"), P("M12 12.5v5M9.5 15h5")])
export const CalendarClockIcon = make("CalendarClockIcon", [P("M20.5 10V7.5A2.5 2.5 0 0 0 18 5H6A2.5 2.5 0 0 0 3.5 7.5V18A2.5 2.5 0 0 0 6 20.5h4.5"), P("M3.5 10h17"), P("M8 3v4M16 3v4"), C(17, 17, 4), P("M17 15v2l1.5 1")])

/* ---------- content / documents ---------- */
export const FileIcon = make("FileIcon", [P("M7 3h7l5 5v11.5A1.5 1.5 0 0 1 17.5 21h-11A1.5 1.5 0 0 1 5 19.5v-15A1.5 1.5 0 0 1 6.5 3H7Z"), P("M14 3v5h5")])
export const FileTextIcon = make("FileTextIcon", [P("M7 3h7l5 5v11.5A1.5 1.5 0 0 1 17.5 21h-11A1.5 1.5 0 0 1 5 19.5v-15A1.5 1.5 0 0 1 6.5 3H7Z"), P("M14 3v5h5"), P("M9 13h6M9 17h4")])
export const FilesIcon = make("FilesIcon", [P("M9 6.5h6l4 4V19a1.5 1.5 0 0 1-1.5 1.5H9A1.5 1.5 0 0 1 7.5 19V8A1.5 1.5 0 0 1 9 6.5Z"), P("M15 6.5v4h4"), P("M4.5 16.5v-11A2.5 2.5 0 0 1 7 3h6")])
export const StickyNoteIcon = make("StickyNoteIcon", [P("M4.5 4.5h15v9.5l-5.5 5.5h-9.5v-15Z"), P("M14 19.5v-5.5h5.5")])
export const ImageIcon = make("ImageIcon", [R(3.5, 4.5, 17, 15), C(9, 9.5, 1.6), P("M4 17.5l4.5-4.5 3 3 3-3 5.5 5.5")])
export const FolderIcon = make("FolderIcon", [P("M3.5 7.5A2 2 0 0 1 5.5 5.5h3.6l2 2.5h7.4a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2V7.5Z")])
export const FolderKanbanIcon = make("FolderKanbanIcon", [P("M3.5 7.5A2 2 0 0 1 5.5 5.5h3.6l2 2.5h7.4a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2V7.5Z"), P("M8.5 12v4M12 12v5.5M15.5 12v2.5")])
export const PaperclipIcon = make("PaperclipIcon", [P("M16 6.5l-7.5 7.5a2.5 2.5 0 0 0 3.5 3.5l8-8a4.5 4.5 0 0 0-6.4-6.4L6 10.7a6.5 6.5 0 0 0 9.2 9.2l5.3-5.3")])
export const BookmarkIcon = make("BookmarkIcon", [P("M7 4h10v16.5l-5-3.8-5 3.8V4Z")])
export const BookOpenIcon = make("BookOpenIcon", [P("M12 7c-2-1.7-4.6-2.3-8-2.3v13c3.4 0 6 .6 8 2.3 2-1.7 4.6-2.3 8-2.3v-13c-3.4 0-6 .6-8 2.3Z"), P("M12 7v13")])
export const UploadIcon = make("UploadIcon", [P("M12 16V5"), P("M7 10l5-5 5 5"), P("M4.5 20h15")])
export const UploadCloudIcon = make("UploadCloudIcon", [P("M8 17.5H7a4 4 0 0 1-.6-7.9A6 6 0 0 1 18 11a3.5 3.5 0 0 1-.5 6.5H16"), P("M12 21v-8"), P("M9 16l3-3 3 3")])

/* ---------- lists ---------- */
export const LayoutListIcon = make("LayoutListIcon", [R(3.5, 4, 5, 5, 1.5), R(3.5, 15, 5, 5, 1.5), P("M12 6.5h8.5M12 17.5h8.5")])
export const ListChecksIcon = make("ListChecksIcon", [P("M3.5 6.5l1.5 1.5 3-3"), P("M3.5 15.5l1.5 1.5 3-3"), P("M12 7h8.5M12 16h8.5")])
export const ListPlusIcon = make("ListPlusIcon", [P("M4 6h12M4 12h12M4 18h7.5"), P("M18 14v6M15 17h6")])
export const LineChartIcon = make("LineChartIcon", [P("M4 4.5v15h16"), P("M7.5 15l4-4.5 3.5 3 5-6")])

/* ---------- communication ---------- */
export const InboxIcon = make("InboxIcon", [P("M5.5 4.5h13l2.5 9V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4.5l2.5-9Z"), P("M3 13.5h5l1.5 2.5h5l1.5-2.5h5")])
export const MailIcon = make("MailIcon", [R(3, 5.5, 18, 13), P("M3.5 7.5l8.5 6 8.5-6")])
export const MessageSquareIcon = make("MessageSquareIcon", [P("M5 4.5h14A1.5 1.5 0 0 1 20.5 6v9A1.5 1.5 0 0 1 19 16.5h-8.5L5.5 20.5v-4H5A1.5 1.5 0 0 1 3.5 15V6A1.5 1.5 0 0 1 5 4.5Z")])
export const MessageSquarePlusIcon = make("MessageSquarePlusIcon", [P("M5 4.5h14A1.5 1.5 0 0 1 20.5 6v9A1.5 1.5 0 0 1 19 16.5h-8.5L5.5 20.5v-4H5A1.5 1.5 0 0 1 3.5 15V6A1.5 1.5 0 0 1 5 4.5Z"), P("M12 7.5v6M9 10.5h6")])
export const BellIcon = make("BellIcon", [P("M6.5 16V11a5.5 5.5 0 0 1 11 0v5l1.5 2.5h-14L6.5 16Z"), P("M10 20.5a2 2 0 0 0 4 0")])
export const BellOffIcon = make("BellOffIcon", [P("M8.5 6.3A5.5 5.5 0 0 1 17.5 11v5l1.5 2.5H10"), P("M6.5 11v5L5 18.5h2.5"), P("M10 20.5a2 2 0 0 0 4 0"), P("M4 4l16 16")])
export const BellPlusIcon = make("BellPlusIcon", [P("M6.5 16V11a5.5 5.5 0 0 1 8-4.9"), P("M17.5 12.5V16l1.5 2.5h-14L6.5 16"), P("M10 20.5a2 2 0 0 0 4 0"), P("M18.5 3v5M16 5.5h5")])

/* ---------- people / places ---------- */
export const UserIcon = make("UserIcon", [C(12, 8, 4), P("M4.5 20.5a7.5 7.5 0 0 1 15 0")])
export const UsersIcon = make("UsersIcon", [C(9, 8, 3.5), P("M2.5 20a6.5 6.5 0 0 1 13 0"), P("M15.5 4.7a3.5 3.5 0 0 1 0 6.6"), P("M17.5 14.2a6.5 6.5 0 0 1 4 5.8")])
export const MapPinIcon = make("MapPinIcon", [P("M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11Z"), C(12, 10, 2.3)])
export const HomeIcon = make("HomeIcon", [P("M4 10.5l8-6.5 8 6.5v8.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19v-8.5Z"), P("M9.5 20.5v-6h5v6")])
export const SchoolIcon = make("SchoolIcon", [P("M4 20.5V10l8-6 8 6v10.5"), P("M9.5 20.5v-5h5v5"), P("M10 11h4"), P("M3 20.5h18")])
export const GraduationCapIcon = make("GraduationCapIcon", [P("M2.5 9.5L12 5l9.5 4.5L12 14 2.5 9.5Z"), P("M6.5 11.5v4.5c2 2.2 9 2.2 11 0v-4.5"), P("M21.5 9.5v5")])
export const BriefcaseIcon = make("BriefcaseIcon", [R(3, 7.5, 18, 12.5), P("M9 7.5V6a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 6v1.5"), P("M3 13h18")])

/* ---------- system / settings ---------- */
export const SettingsIcon = make("SettingsIcon", [P("M4 7h9M17.5 7H20"), P("M4 17h3.5M11.5 17H20"), C(15, 7, 2.2), C(9.5, 17, 2.2)])
export const PlugIcon = make("PlugIcon", [P("M12 21.5v-4.5"), P("M9 8V3.5M15 8V3.5"), P("M6.5 8h11v3a5.5 5.5 0 0 1-11 0V8Z")])
export const MonitorIcon = make("MonitorIcon", [R(3, 4.5, 18, 12), P("M9 20.5h6"), P("M12 16.5v4")])
export const PaletteIcon = make("PaletteIcon", [P("M12 3a9 9 0 1 0 0 18c1.2 0 2-.8 2-2 0-.6-.3-1-.6-1.4-.3-.4-.4-.8-.4-1.1 0-1 .8-1.5 1.8-1.5H17a4 4 0 0 0 4-4 8.8 8.8 0 0 0-9-8Z"), Dot(8, 12), Dot(9.5, 8), Dot(14, 7.5), Dot(17, 10.5)])
export const MoonIcon = make("MoonIcon", [P("M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z")])
export const SunIcon = make("SunIcon", [C(12, 12, 4), P("M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4")])
export const PencilIcon = make("PencilIcon", [P("M4 20l4.5-1L19 8.5a2.1 2.1 0 0 0-3-3L5.5 15.5 4 20Z"), P("M14.5 7l3 3")])
export const PencilLineIcon = make("PencilLineIcon", [P("M4 17l3.5-.8L17 6.7a1.8 1.8 0 0 0-2.5-2.5L5 13.7 4 17Z"), P("M13 5l3 3"), P("M4 21h16")])
export const Trash2Icon = make("Trash2Icon", [P("M4 6.5h16"), P("M9 6.5V4.5h6v2"), P("M6 6.5l1 13h10l1-13"), P("M10 10.5v6M14 10.5v6")])

/* ---------- auth ---------- */
export const MinusIcon = make("MinusIcon", [P("M5.5 12h13")])
export const EyeIcon = make("EyeIcon", [P("M3 12c2-3.8 5-6 9-6s7 2.2 9 6c-2 3.8-5 6-9 6s-7-2.2-9-6Z"), C(12, 12, 3)])
export const LockIcon = make("LockIcon", [R(4.5, 10.5, 15, 10), P("M8 10.5V7.5a4 4 0 0 1 8 0v3"), Dot(12, 15.5)])
export const KeyRoundIcon = make("KeyRoundIcon", [C(8.5, 15.5, 4.5), P("M11.7 12.3L20 4"), P("M17 7l2.5 2.5M15 9l2 2")])
export const MailCheckIcon = make("MailCheckIcon", [P("M21 11V7.5A2 2 0 0 0 19 5.5H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h8"), P("M3.5 7.5l8.5 6 8.5-6"), P("M15.5 18l2 2 4-4.5")])
export const ShieldCheckIcon = make("ShieldCheckIcon", [P("M12 3l8 3v6c0 4.5-3.5 7.6-8 9-4.5-1.4-8-4.5-8-9V6l8-3Z"), P("M8.5 12l2.5 2.5 4.5-5")])
export const CircleUserIcon = make("CircleUserIcon", [C(12, 12, 9), C(12, 10, 3), P("M6.5 18.5a6 6 0 0 1 11 0")])
export const RocketIcon = make("RocketIcon", [P("M12 15.5L8.5 12c1-4.5 3.5-7.5 7.5-8.5.5 4-.5 7.5-4 12Z"), P("M8.5 12l-3 1.5 1.5 1.5"), P("M12 15.5l1.5 3-1.5 1.5"), C(13.5, 10.5, 1.2)])
