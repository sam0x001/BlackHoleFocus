import { useStore } from '../store/useStore'

/** Draggable top strip so the window can be moved. Window controls sit on the right.
 *  The sidebar reveal button lives here (left) so it never overlaps page content. */
export default function TitleBar() {
  const { sidebarOpen, toggleSidebar } = useStore()
  return (
    <>
      <div
        className="titlebar-drag fixed top-0 left-0 right-0 h-10 z-[100] flex items-center"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <div className="flex-1 h-full" />
        {/* Leave space on the right for Windows min/max/close buttons */}
        <div className="w-[140px] h-full shrink-0" />
      </div>
      {/* Reveal button sits just below the drag strip so it never hugs the window edge */}
      {!sidebarOpen && (
        <button
          onClick={toggleSidebar}
          className="fixed top-10 left-3 z-[110] bh-menu-reveal glass-button text-xs px-3 py-1 no-drag flex items-center gap-2"
          title="Show menu"
          aria-label="Show menu"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <span className="inline-flex flex-col gap-[3px] -translate-y-px">
            <span className="block w-3 h-px bg-current" />
            <span className="block w-2 h-px bg-current" />
          </span>
          Menu
        </button>
      )}
    </>
  )
}
