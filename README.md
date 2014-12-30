medic-transport
===============

An SMS transport layer, for use with Medic Mobile's Linux-based operating
system and web applications.

See the [tests](tests) for example usage.

SMSSync setup
===============
 - Download from Play Store and launch
 - Add a sync URL
   - If running in emulator:
     Secret: 'secret'
     Keywords: ''
     URL: http://10.0.2.2:3000
 - In settings:
  - Enable 'SMS Delivery Report'
  - Enable 'Auto Sync'
  - Enable 'Task Checking'
  - Enable 'Message Results API'
  - Make sure 'Get Reply From Server' is disabled
- Run node tests/smssync.js to verify sending
- Run a script out of examples folder to get started (make sure to edit credentials accordingly)
- To test receiving using the emulator, from terminal:
  - telnet localhost 5554
  - sms send <number> <message>
