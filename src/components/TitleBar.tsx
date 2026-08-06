/** Draggable top strip so the window can be moved. Window controls sit on the right. */
export default function TitleBar() {
  return (
    <div
      className="titlebar-drag fixed top-0 left-0 right-0 h-10 z-[100] flex items-center"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* Leave space on the right for Windows min/max/close buttons */}
      <div className="flex-1 h-full" />
      <div className="w-[140px] h-full shrink-0" />
    </div>
  )
}
