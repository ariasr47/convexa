/**
 * ComingSoonBox — the hatched inert affordance (ARCHITECTURE §2.2, FRONTEND_EXECUTION_CONTRACT F2).
 * A styled `Box` ONLY: the `repeating-linear-gradient` hatch + dashed `divider` border read as
 * structurally inert. It carries NO navigation and NO broker affordance — that visual inertness is the
 * `no-real-order-path` invariant (§1.3) made structural: the box itself never links anywhere.
 *
 * The hatch colors are single-sourced from the tokens: `background.paper` (theme) alternates with
 * `extras.hatchAlt` (per the README, prototype-only extras fold into `sx`, NOT new theme keys).
 */
import { Box, type BoxProps } from '@mui/material';
import { extras } from '../tokens';

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
          backgroundImage: (theme) =>
            `repeating-linear-gradient(135deg, ${theme.palette.background.paper} 0 18px, ${extras.hatchAlt} 18px 36px)`,
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
