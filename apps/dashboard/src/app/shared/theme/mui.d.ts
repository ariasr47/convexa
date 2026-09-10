import '@mui/material/styles';

declare module '@mui/material/styles' {
  interface BreakpointOverrides {
    tablet: true;
    smallLaptop: true;
    laptop: true;
    desktop: true;
    wide: true;
  }
}
