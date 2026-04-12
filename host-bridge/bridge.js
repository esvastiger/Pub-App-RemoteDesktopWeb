const { spawn } = require('child_process');
const io = require('socket.io-client');
const crypto = require('crypto');
const datachannel = require('node-datachannel');

const socket = io('http://localhost:3000');
const engine = spawn('./engine.exe');

const ecdh = crypto.createECDH('prime256v1'); ecdh.generateKeys();
let sharedSecret = null;
let peer = null; let dc = null;

function setupWebRTC(viewerId) {
    peer = new datachannel.PeerConnection("Host", { iceServers: ["stun:stun.l.google.com:19302"] });
    peer.onLocalDescription((sdp, type) => socket.emit('signal', { to: viewerId, signalData: { sdp, type } }));
    peer.onLocalCandidate((candidate, mid) => socket.emit('signal', { to: viewerId, signalData: { candidate, mid } }));
    dc = peer.createDataChannel("video-stream");
    const cmdDc = peer.createDataChannel("commands");
    cmdDc.onMessage((msg) => handleEncryptedCommand(msg));
}

socket.on('signal', (data) => {
    if (data.signalData.sdp) peer.setRemoteDescription(data.signalData.sdp, data.signalData.type);
    else if (data.signalData.candidate) peer.addRemoteCandidate(data.signalData.candidate, data.signalData.mid);
});

function handleEncryptedCommand(encrypted) {
    if (!sharedSecret) return;
    try {
        const cmdObj = JSON.parse(encrypted);
        const iv = Buffer.from(cmdObj.iv, 'base64');
        const ciphertext = Buffer.from(cmdObj.data, 'base64');
        const authTag = ciphertext.slice(ciphertext.length - 16);
        const data = ciphertext.slice(0, ciphertext.length - 16);
        const decipher = crypto.createDecipheriv('aes-256-gcm', sharedSecret.slice(0, 32), iv);
        decipher.setAuthTag(authTag);
        let decrypted = decipher.update(data, 'binary', 'utf8') + decipher.final('utf8');
        const cmd = JSON.parse(decrypted);
        if (cmd.type === 'MOVE') engine.stdin.write(`MOVE ${cmd.x} ${cmd.y}\n`);
        else if (cmd.type === 'CLICK') engine.stdin.write(`CLICK ${cmd.button} ${cmd.action}\n`);
        else if (cmd.type === 'KEY') engine.stdin.write(`KEY ${cmd.vk} ${cmd.action}\n`);
        else if (cmd.type === 'SWITCH-MONITOR') engine.stdin.write(`SWITCH ${cmd.index}\n`);
    } catch (err) {}
}

let buffer = Buffer.alloc(0);
engine.stdout.on('data', (data) => {
    buffer = Buffer.concat([buffer, data]);
    
    while (buffer.length > 0) {
        const metaIndex = buffer.indexOf('META');
        const frameIndex = buffer.indexOf('FRAME');

        // Determinar cuál etiqueta aparece primero
        if (metaIndex !== -1 && (frameIndex === -1 || metaIndex < frameIndex)) {
            if (buffer.length < metaIndex + 16) break; // Esperar a que llegue el resto del META
            const width = buffer.readInt32LE(metaIndex + 4);
            const height = buffer.readInt32LE(metaIndex + 8);
            const monitorCount = buffer.readInt32LE(metaIndex + 12);
            socket.emit('host-meta', { width, height, monitorCount });
            buffer = buffer.slice(metaIndex + 16);
        } else if (frameIndex !== -1) {
            if (buffer.length < frameIndex + 13) break; // Esperar al tamaño del frame
            const size = buffer.readBigUInt64LE(frameIndex + 5);
            const frameStart = frameIndex + 13;
            const frameEnd = frameStart + Number(size);
            if (buffer.length < frameEnd) break; // Esperar a que llegue todo el frame
            const frameData = buffer.slice(frameStart, frameEnd);
            if (dc && dc.isOpen()) dc.sendMessage(frameData);
            else socket.emit('screen-data', { image: frameData.toString('base64') }); 
            buffer = buffer.slice(frameEnd);
        } else {
            // No se encontró ninguna etiqueta, si el buffer es muy grande, algo va mal
            if (buffer.length > 1000000) buffer = Buffer.alloc(0);
            break;
        }
    }
});

socket.on('viewer-connected', (id) => { setupWebRTC(id); socket.emit('key-exchange-offer', { publicKey: ecdh.getPublicKey() }); });
socket.on('key-exchange-answer', (data) => sharedSecret = ecdh.computeSecret(Buffer.from(data.publicKey)));
socket.on('connect', () => socket.emit('register-host', 'HOST-001'));
