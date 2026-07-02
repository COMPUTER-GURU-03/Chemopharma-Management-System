export default function Pill({ tone = "gray", children, style }) {
  return <span className={`pill pill-${tone}`} style={style}>{children}</span>;
}
