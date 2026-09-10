/**
 * `PanelContainer` — the ONE exported way for a non-`Widget` panel to declare the SAME named
 * container-query context `Widget.tsx` declares on its body (SPEC §2.5). An unnamed `@container`
 * resolves against the NEAREST container ancestor, so a future nested rail would silently answer
 * a `FigureCell`'s query instead of the panel itself — `panelContainerSx` / `PanelContainer` are
 * the only sanctioned way to opt a surface into the `panel` container name.
 *
 * Unlike `arc.ts`/`ArcDivider.tsx`, this carries no importer-set pin, so it IS exported from the
 * barrel (`shared/ui/index.ts`) — a re-export here does not blind any scan.
 */
import Box, { type BoxProps } from '@mui/material/Box';
import type { SxProps, Theme } from '@mui/material/styles';

/** Spread into any `sx` array to declare the named `panel` container context. */
export const panelContainerSx: SxProps<Theme> = {
  containerType: 'inline-size',
  containerName: 'panel',
};

export interface PanelContainerProps extends Omit<BoxProps, 'sx'> {
  sx?: BoxProps['sx'];
}

export function PanelContainer({ children, sx, ...rest }: PanelContainerProps) {
  return (
    <Box sx={[panelContainerSx, ...(Array.isArray(sx) ? sx : [sx])]} {...rest}>
      {children}
    </Box>
  );
}

export default PanelContainer;
