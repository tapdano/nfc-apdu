const pcsclite = require('pcsclite');
const pcsc = pcsclite();

function sendAPDUCommand(reader, protocol, command) {
  console.log('<< ' + command);
  const apdu = Buffer.from(command, 'hex');
  
  return new Promise((resolve, reject) => {
    reader.transmit(apdu, 255, protocol, (err, data) => {
      if (err) {
        console.error(`Error transmitting APDU(${reader.name}):`, err.message);
        reject(err);
      } else {
        console.log('>> ' + data.toString('hex'));
        resolve(data);
      }
    });
  });
}

pcsc.on('reader', (reader) => {
  if (reader.name !== 'Identiv uTrust 3700 F CL Reader 0') {
    return;
  }

  console.log(`Reader detected: ${reader.name}`);

  reader.on('error', (err) => {
    console.error(`Error(${reader.name}):`, err.message);
  });

  reader.on('status', async (status) => {
    console.log(`Status(${reader.name}):`, status);

    // Check for changes in the reader status
    const changes = reader.state ^ status.state;
    if (changes) {
      if ((changes & reader.SCARD_STATE_EMPTY) && (status.state & reader.SCARD_STATE_EMPTY)) {
        console.log('Card removed');
        reader.disconnect(reader.SCARD_LEAVE_CARD, (err) => {
          if (err) {
            console.error(`Error disconnecting(${reader.name}):`, err.message);
          } else {
            console.log('Disconnected');
          }
        });
      } else if ((changes & reader.SCARD_STATE_PRESENT) && (status.state & reader.SCARD_STATE_PRESENT)) {
        console.log('Card inserted');
        reader.connect({ share_mode: reader.SCARD_SHARE_SHARED }, async (err, protocol) => {
          if (err) {
            console.error(`Error connecting(${reader.name}):`, err.message);
          } else {
            console.log(`Protocol(${reader.name}):`, protocol);

            try {
              // Example APDU commands
              await sendAPDUCommand(reader, protocol, '00A404000854617044616E6F0100');
              //await sendAPDUCommand(reader, protocol, '00A00000');
              for (let i = 0; i < 100; i++) {
                await sendAPDUCommand(reader, protocol, '00A10000020101');
                await sendAPDUCommand(reader, protocol, '00A30000');
              }
            } catch (error) {
              console.error('Error sending APDU commands:', error.message);
            }
          }
        });
      }
    }
  });

  reader.on('end', () => {
    console.log(`Reader removed: ${reader.name}`);
  });
});

pcsc.on('error', (err) => {
  console.error('PCSC error:', err.message);
});