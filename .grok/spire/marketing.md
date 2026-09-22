# Spire grok marketing adapter (Direct-v4)

Generation gen-344efe06b2d76427 at root 082ab6972c3798fb3471ad2190fa59ad53f6f506368b4ead2dcd0ff1dea36bc9, target version 4.2.0.

This adapter is a rendered bridge for the `marketing` work type on the `grok` host. It
carries no command emulation of its own — every invocation goes through the installed bridge:

    node .spire/bin/spire.mjs <cmd> --input <json-file> --out <dir>

Never invoke a generation directory or the development CLI directly from this adapter.
