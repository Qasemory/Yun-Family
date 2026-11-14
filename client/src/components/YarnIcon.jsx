// أيقونة «يون»: كبّة صوف بخيط يتدلّى
export default function YarnIcon({ size = 36, fg = "#FBF6EE", bg = "#A8683F" }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 100 100">
      {bg && <circle cx="50" cy="50" r="50" fill={bg} />}
      <circle cx="50" cy="48" r="30" fill="none" stroke={fg} strokeWidth="7" />
      <path d="M24 40 C 40 30, 60 30, 76 40" fill="none" stroke={fg} strokeWidth="5" strokeLinecap="round" />
      <path d="M22 56 C 40 48, 60 48, 78 56" fill="none" stroke={fg} strokeWidth="5" strokeLinecap="round" />
      <path d="M36 22 C 50 40, 50 56, 36 74" fill="none" stroke={fg} strokeWidth="5" strokeLinecap="round" />
      <path d="M76 62 C 86 72, 84 84, 72 88" fill="none" stroke={fg} strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}
