/**
 * SignInPrompt — the in-context sign-in affordance shown when a gated action is triggered while
 * logged out (UX_BLUEPRINT §2.6/§2.7). A visible inline alert (never silent), with a `Sign in` button
 * that opens the dialog and returns the user to the action on success (AC-C1/D6c).
 *
 * The copy is supplied by the caller (it differs per action: track positions / save a view / accept a
 * rec / ask AI / "couldn't reach sign-in" when degraded), so this component is purely presentational.
 */
import { Alert, Button, Collapse } from '@mui/material';
import { AUTH_COPY } from './copy';

interface Props {
  text: string | null;
  onSignIn: () => void;
  /** When the text is the degraded "couldn't reach sign-in" copy, render as a warning, no button. */
  testid?: string;
}

export function SignInPrompt({ text, onSignIn, testid = 'signin-prompt' }: Props) {
  const isDegraded = text === AUTH_COPY.gate.unavailable;
  return (
    <Collapse in={!!text} unmountOnExit>
      <Alert
        severity={isDegraded ? 'warning' : 'info'}
        data-testid={testid}
        action={
          isDegraded ? undefined : (
            <Button color="inherit" size="small" onClick={onSignIn} data-testid={`${testid}-button`}>
              {AUTH_COPY.account.signIn}
            </Button>
          )
        }
      >
        {text}
      </Alert>
    </Collapse>
  );
}
