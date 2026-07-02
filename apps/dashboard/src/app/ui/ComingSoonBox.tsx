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
import type { Theme } from '@mui/material/styles';
import { extrasFor } from '../tokens';

/**
 * The SINGLE hatch background (mode-aware). Shared by every "coming soon" surface — ComingSoonBox,
 * the Scanner stub hero, the positions Live tab — so the stripes can never drift or dark-lock again.
 */
export const hatchBackgroundImage = (theme: Theme) =>
  `repeating-linear-gradient(135deg, ${theme.palette.background.paper} 0 18px, ${extrasFor(theme).hatchAlt} 18px 36px)`;

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
          backgroundImage: hatchBackgroundImage,
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
