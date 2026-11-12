import { ROBOTS } from "@/lib/domain/robots";
import type { RobotId } from "@/lib/domain/types";

interface RobotAvatarProps {
  id: RobotId;
  /** Pixels, or any CSS length such as "5em". */
  size?: number | string;
  /** Shows a soft pulsing ring, e.g. while the robot is listening or working. */
  active?: boolean;
  speaking?: boolean;
  className?: string;
}

/** A flat portrait of a crew robot, matching the 3D models. */
export function RobotAvatar({ id, size = 40, active = false, speaking = false, className = "" }: RobotAvatarProps) {
  const { accent, name } = ROBOTS[id];
  return (
    <span
      className={`relative inline-grid shrink-0 place-items-center ${className}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={name}
    >
      {active && (
        <span
          aria-hidden
          className="absolute inset-0 animate-pulse-ring rounded-full"
          style={{ boxShadow: `0 0 0 2px ${accent}` }}
        />
      )}
      <svg viewBox="0 0 40 40" className="size-full" aria-hidden>
        <circle cx="20" cy="20" r="19.5" fill="#14141b" stroke={accent} strokeOpacity="0.35" />
        <line x1="20" y1="10.5" x2="20" y2="6.8" stroke="#8d96a1" strokeWidth="1.2" />
        <circle cx="20" cy="6.2" r="1.7" fill={accent} />
        <rect x="7.5" y="10.5" width="25" height="19" rx="9.5" fill="#e9eef0" />
        <rect x="10" y="13.4" width="20" height="12.4" rx="6.2" fill="#07080b" />
        <rect className="robot-eye" x="14.4" y="16" width="3" height="5.2" rx="1.5" fill={accent} />
        <rect className="robot-eye" x="22.6" y="16" width="3" height="5.2" rx="1.5" fill={accent} />
        {speaking ? (
          <g fill={accent}>
            {[16.6, 18.8, 21, 23.2].map((x, i) => (
              <rect key={x} x={x} y="22.4" width="1.2" height="2.2" rx="0.6">
                <animate
                  attributeName="height"
                  values="1;2.6;1.4;2.2;1"
                  dur={`${0.5 + i * 0.07}s`}
                  repeatCount="indefinite"
                />
              </rect>
            ))}
          </g>
        ) : (
          <path d="M17.6 23.2 Q20 24.9 22.4 23.2" fill="none" stroke={accent} strokeWidth="1.1" strokeLinecap="round" />
        )}
      </svg>
    </span>
  );
}
