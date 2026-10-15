/**
 * Browser notifications for fired alerts (Final More overlays, the notify board and its states):
 *
 * - Off, never asked: "Turn on browser notifications" opens Convexa's own ask first (what a
 *   notification looks like, that nothing is sent anywhere, that the browser asks next). Only
 *   Continue opens the browser's prompt.
 * - On (permission granted and the flag on): a "Browser notifications on" tag and "Turn off", which
 *   stops them from Convexa without a browser prompt.
 * - Blocked: says where to change it; no button that can't work.
 * - Not in this browser: says so; nothing to press.
 *
 * The control reads on only while `Notification.permission` is "granted" (criterion 50).
 */
import { DataStateTag } from '@/shared/dataState/DataStateTag';
import { extrasFor } from '@/shared/theme/tokens';
import NotificationsNoneOutlinedIcon from '@mui/icons-material/NotificationsNoneOutlined';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import { useTheme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useRef, useState, type ReactElement } from 'react';
import type { NotifyPermission } from './useAlerts';

export const NOTIFY_COPY = {
  askTitle: 'Show alerts as browser notifications?',
  askBody:
    'Fired alerts always list on the Alerts page. With notifications on, your browser also shows one when an alert fires while a Convexa tab is open. Convexa sends nothing anywhere: alerts are checked in this browser.',
  askNext:
    'Next, your browser asks for permission. You can change it later in the browser’s site settings.',
  turnOn: 'Turn on browser notifications',
  on: 'Browser notifications on',
  turnOff: 'Turn off',
  blockedTitle: 'Browser notifications are blocked for this site',
  blocked:
    'Alerts still show here, but nothing pops from the browser. To allow them, use the site settings next to the address bar, then come back.',
  unavailable: 'Browser notifications aren’t available in this browser. Alerts still show here.',
};

export function BrowserNotifyControl({
  on,
  permission,
  onEnable,
  onTurnOff,
  refuse = (el) => el,
}: {
  on: boolean;
  permission: NotifyPermission;
  onEnable: () => Promise<boolean>;
  onTurnOff: () => void;
  /** Wraps a write control when the alerts store is faulted (AlertsRefused). */
  refuse?: (el: ReactElement) => ReactElement;
}) {
  const [asking, setAsking] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  const phone = useMediaQuery(useTheme().breakpoints.down('sm'));

  const turnOn = () => {
    // Already granted (turned off from Convexa earlier): no prompt, nothing to explain again.
    if (permission === 'granted') void onEnable();
    else setAsking(true);
  };

  const rowSx = {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    p: '10px 12px',
    borderRadius: '8px',
    bgcolor: (t: Parameters<typeof extrasFor>[0]) => extrasFor(t).well,
    border: '1px solid',
    borderColor: 'divider',
    flexWrap: 'wrap',
  } as const;

  if (permission === 'denied') {
    return (
      <Box sx={{ ...rowSx, display: 'grid', gap: 0.75 }} data-testid="alerts-notify-explain">
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
          <Typography component="h3" sx={{ m: 0, fontSize: 14, fontWeight: 600 }}>
            {NOTIFY_COPY.blockedTitle}
          </Typography>
          <DataStateTag state="notSetUp" label="Blocked here" />
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: 13 }}>
          {NOTIFY_COPY.blocked}
        </Typography>
      </Box>
    );
  }
  if (permission === 'unavailable') {
    return (
      <Box sx={rowSx}>
        <NotificationsNoneOutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ fontSize: 13 }}
          data-testid="alerts-notify-explain"
        >
          {NOTIFY_COPY.unavailable}
        </Typography>
      </Box>
    );
  }

  return (
    <>
      <Box sx={rowSx}>
        <NotificationsNoneOutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
        <Typography variant="caption" color="text.secondary" sx={{ flex: '1 1 160px' }}>
          Fired alerts are listed here. Browser notifications, once allowed, also pop while a desk
          is open.
        </Typography>
        {on ? (
          <Box
            sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}
            data-testid="alerts-notify-on"
          >
            <DataStateTag state="local" label={NOTIFY_COPY.on} />
            {refuse(
              <Button
                size="small"
                variant="text"
                onClick={onTurnOff}
                data-testid="alerts-notify-off"
                sx={{ minHeight: 44 }}
              >
                {NOTIFY_COPY.turnOff}
              </Button>,
            )}
          </Box>
        ) : (
          refuse(
            <Button
              ref={opener}
              size="small"
              variant="outlined"
              onClick={turnOn}
              data-testid="alerts-notify"
              sx={{ minHeight: 44 }}
            >
              {NOTIFY_COPY.turnOn}
            </Button>,
          )
        )}
      </Box>
      <Dialog
        open={asking}
        onClose={() => setAsking(false)}
        maxWidth="xs"
        fullWidth
        fullScreen={false}
        aria-labelledby="notify-ask-title"
        slotProps={{
          paper: {
            sx: phone
              ? {
                  m: 0,
                  width: '100%',
                  maxWidth: '100%',
                  alignSelf: 'flex-end',
                  borderRadius: '16px 16px 0 0',
                }
              : { borderRadius: '16px' },
          },
        }}
      >
        <DialogTitle id="notify-ask-title" sx={{ fontSize: '1.05rem', fontWeight: 700 }}>
          {NOTIFY_COPY.askTitle}
        </DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 1.5 }}>
          <Typography sx={{ fontSize: 14, lineHeight: 1.55 }}>{NOTIFY_COPY.askBody}</Typography>
          <Box
            aria-label="Example notification"
            role="img"
            sx={(t) => ({
              display: 'flex',
              gap: 1.25,
              alignItems: 'flex-start',
              p: '12px 14px',
              borderRadius: '10px',
              bgcolor: extrasFor(t).panelRaised,
              border: '1px solid',
              borderColor: 'divider',
              maxWidth: 380,
            })}
          >
            <NotificationsNoneOutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
            <Box sx={{ display: 'grid', gap: 0.25 }}>
              <Typography sx={{ fontSize: 13, fontWeight: 600 }}>Convexa · SPY</Typography>
              <Typography sx={{ fontSize: 12.5, color: 'text.secondary' }}>
                Touched the gamma flip
              </Typography>
            </Box>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: 13 }}>
            {NOTIFY_COPY.askNext}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, flexWrap: 'wrap', gap: 1 }}>
          <Button
            onClick={() => setAsking(false)}
            sx={{ minHeight: 44, flex: { xs: '1 1 100%', sm: '0 0 auto' } }}
          >
            Not now
          </Button>
          <Button
            variant="contained"
            data-testid="alerts-notify-continue"
            onClick={() => {
              setAsking(false);
              void onEnable();
            }}
            sx={{
              minHeight: 44,
              flex: { xs: '1 1 100%', sm: '0 0 auto' },
              ml: { xs: '0 !important', sm: 1 },
            }}
          >
            Continue
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
