/**
 * ComingSoonBox — the hatched inert affordance (ARCHITECTURE §2.2, FRONTEND_EXECUTION_CONTRACT F2).
 * A styled `Box` ONLY: the `repeating-linear-gradient` hatch + dashed `divider` border read as
 * structurally inert. It carries NO navigation and NO broker affordance — that visual inertness is the
 * `no-real-order-path` invariant (§1.3) made structural: the box itself never links anywhere.
 *
 * The hatch colors are `sx` literals (per the README, prototype-only extras fold into `sx`, NOT new
 * theme keys). `paper` (`#161b22`) alternates with the panel-raised `#14181f`.
 */
import { Box, type BoxProps } from '@mui/material';

export interface ComingSoonBoxProps extends Omit<BoxProps, 'children'> {
  children?: React.ReactNode;
}

export function ComingSoonBox({ children, sx, ...rest }: ComingSoonBoxProps) {
  return (
    <Box
      data-testid="coming-soon-box"
      sx={[
        {
          border: '1px dashed',
          borderColor: 'divider',
          borderRadius: 2,
          backgroundImage:
            'repeating-linear-gradient(135deg, #161b22 0 18px, #14181f 18px 36px)',
          p: 3,
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
      {...rest}
    >
      {children}
    </Box>
  );
}

export default ComingSoonBox;
