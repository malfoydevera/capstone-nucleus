export const NUCLEUS_LOGO_SRC = '/nucleus-logo.png';

/**
 * Official NUCLEUS mark from `public/nucleus-logo.png` (black-background artwork).
 */
const NucleusLogoMark = ({
  size = 44,
  className = '',
  rounded = 'rounded-2xl',
  ringClassName = 'ring-1 ring-white/20',
}) => {
  const dimension = Number(size) || 44;
  const imgSize = Math.round(dimension * 0.78);

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center bg-black shadow-sm ${ringClassName} ${rounded} ${className}`}
      style={{ width: dimension, height: dimension }}
    >
      <img
        src={NUCLEUS_LOGO_SRC}
        alt="NUCLEUS"
        width={imgSize}
        height={imgSize}
        className="object-contain"
        decoding="async"
      />
    </span>
  );
};

export default NucleusLogoMark;
