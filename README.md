# gather

Decoy contact collector. A fullscreen story, a "Continue with sound" button, and a contact picker behind it.

## Run

    cp .env.example .env
    npm i
    npm start

Then on the phone:

    adb reverse tcp:3000 tcp:3000

Open http://localhost:3000 on the device. Results at /inbox?key=<INBOX_KEY>.

The picker needs a secure context, so localhost or HTTPS. Plain LAN IP will fall back to the vcf sheet.
