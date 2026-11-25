/**
 * Re-mounts on every page change, so each page fades in and rises a little.
 * motion-safe: people who ask their device for less motion get no animation.
 */
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return (
    <div className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-safe:duration-300 motion-safe:ease-out">
      {children}
    </div>
  );
}
