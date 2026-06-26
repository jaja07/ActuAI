// components/ui/VisuallyHidden.jsx — content for screen readers only.
// Renders text that is invisible on screen but announced by assistive tech.
// Used to give icon-only controls and live regions an accessible name.

export default function VisuallyHidden({ children, as: Tag = "span" }) {
  return (
    <Tag
      style={{
        position: "absolute",
        width: 1,
        height: 1,
        padding: 0,
        margin: -1,
        overflow: "hidden",
        clip: "rect(0 0 0 0)",
        whiteSpace: "nowrap",
        border: 0,
      }}
    >
      {children}
    </Tag>
  );
}
