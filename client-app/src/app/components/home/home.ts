import { Component, OnInit, OnDestroy, HostListener, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { io, Socket } from 'socket.io-client';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="container">
      <header>
        <div class="logo">
          <span class="icon">🖥️</span>
          <h1>RemotePro v2.1</h1>
        </div>
        <div *ngIf="isSessionActive" class="toolbar">
          <div class="monitor-selector" *ngIf="monitorCount > 1">
            <select (change)="onSwitchMonitor($event)">
              <option *ngFor="let m of [].constructor(monitorCount); let i = index" [value]="i">Monitor {{i+1}}</option>
            </select>
          </div>
          <button (click)="isRecording ? stopRecording() : startRecording()" [class.recording]="isRecording" class="tool-btn">
            {{ isRecording ? '⏹ Detener Grabación' : '🔴 Grabar Sesión' }}
          </button>
          <span class="badge">● {{ isP2P ? 'UDP' : 'TCP' }}</span>
          <button (click)="onDisconnectSession()" class="disconnect-top-btn">Finalizar</button>
        </div>
      </header>

      <main class="dashboard" [class.session-active]="isSessionActive">
        <section *ngIf="!isSessionActive" class="card">
          <h2>Conectar a ID</h2>
          
          <div class="local-id-info" *ngIf="myId">
            <span class="status-dot connected"></span>
            Nuevo dispositivo conectado: <strong>{{myId}}</strong>
          </div>
          <div class="local-id-info" *ngIf="!myId && isConnected">
            <span class="status-dot connecting"></span>
            Obteniendo ID...
          </div>
          <div class="local-id-info" *ngIf="!isConnected">
            <span class="status-dot disconnected"></span>
            Conectando al servidor...
          </div>

          <div class="input-group">
            <input type="text" [(ngModel)]="targetId" placeholder="ID remota" class="id-input">
            <button (click)="onConnect()" class="connect-btn" [disabled]="!isConnected || !targetId">Conectar</button>
          </div>
        </section>

        <div *ngIf="isSessionActive" class="viewer-container">
          <canvas #screenCanvas 
            (mousemove)="onMouseMove($event)" 
            (mousedown)="onMouseDown($event)" 
            (mouseup)="onMouseUp($event)"
            (contextmenu)="$event.preventDefault()">
          </canvas>
        </div>
      </main>
    </div>
  `,
  styles: [`
    .container { font-family: 'Segoe UI', sans-serif; background: #1a1a1a; width: 100%; height: 100%; display: flex; flex-direction: column; color: white; overflow: hidden; }
    
    header { 
      background: #e31e24; 
      padding: 0 20px; 
      display: flex; 
      justify-content: space-between; 
      align-items: center; 
      height: 45px; 
      min-height: 45px;
      box-sizing: border-box; 
    }
    
    .logo { 
      display: flex; 
      align-items: center; 
      gap: 10px; 
      height: 100%; 
    }
    
    .logo .icon { 
      font-size: 1.3rem; 
      display: flex; 
      align-items: center; 
      height: 100%;
    }
    
    .logo h1 { 
      font-size: 1.1rem; 
      margin: 0; 
      font-weight: 600; 
      display: flex; 
      align-items: center; 
      height: 100%;
      color: white; 
    }

    .toolbar { display: flex; align-items: center; gap: 15px; height: 100%; }
    
    .tool-btn { 
      background: rgba(0,0,0,0.2); 
      border: 1px solid white; 
      color: white; 
      padding: 3px 8px; 
      border-radius: 4px; 
      cursor: pointer; 
      font-size: 0.85rem;
    }
    
    .tool-btn.recording { background: white; color: #e31e24; font-weight: bold; animation: pulse 1s infinite; }
    
    @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }
    
    .dashboard { 
      flex: 1; 
      display: flex; 
      flex-direction: column; 
      align-items: center; 
      justify-content: center; 
      width: 100%; 
      background: #222;
      overflow: hidden; 
    }

    .dashboard.session-active {
      background: #000;
    }

    .viewer-container { 
      width: 100%; 
      height: 100%; 
      display: flex; 
      justify-content: center; 
      align-items: center; 
      overflow: hidden;
    }
    
    canvas { 
      width: 100%; 
      height: 100%; 
      object-fit: contain; 
      cursor: crosshair; 
      display: block; 
      /* Cambiamos pixelated por optimización de contraste/legibilidad */
      image-rendering: auto;
      filter: contrast(1.05) brightness(1.02); /* Un ligero toque para resaltar el texto */
    }

    .card { background: white; padding: 30px; border-radius: 12px; color: #333; box-shadow: 0 10px 25px rgba(0,0,0,0.3); width: 100%; max-width: 450px; text-align: center; }
    .card h2 { margin-top: 0; color: #1a1a1a; margin-bottom: 25px; }
    .local-id-info { background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 25px; font-size: 0.95rem; color: #444; display: flex; align-items: center; justify-content: center; gap: 10px; border: 1px solid #eee; }
    .local-id-info strong { color: #e31e24; font-family: monospace; font-size: 1.1rem; }
    .status-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
    .status-dot.connected { background: #28a745; box-shadow: 0 0 5px #28a745; }
    .status-dot.connecting { background: #ffc107; animation: blink 1s infinite; }
    .status-dot.disconnected { background: #dc3545; }
    .input-group { display: flex; gap: 10px; }
    .id-input { flex: 1; padding: 12px 15px; border: 2px solid #ddd; border-radius: 6px; font-size: 1rem; }
    .connect-btn { padding: 12px 25px; background: #e31e24; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; }
    .badge { background: #28a745; padding: 2px 8px; border-radius: 10px; font-size: 0.7rem; }
  `]
})
export class HomeComponent implements OnInit, OnDestroy {
  @ViewChild('screenCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  targetId = ''; isConnected = false; isSessionActive = false; isP2P = false;
  hostWidth = 1920; hostHeight = 1080; monitorCount = 1; myId = '';
  private socket!: Socket; private peerConnection: RTCPeerConnection | null = null;
  private commandChannel: RTCDataChannel | null = null; private cryptoKey: CryptoKey | null = null;
  private keyPair!: CryptoKeyPair;

  // GRABACION
  isRecording = false;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];

  private keyMap: { [key: string]: number } = { 
    'enter': 0x0D, 'escape': 0x1B, ' ': 0x20, 'backspace': 0x08, 'tab': 0x09,
    'arrowleft': 0x25, 'arrowup': 0x26, 'arrowright': 0x27, 'arrowdown': 0x28,
    'delete': 0x2E, 'home': 0x24, 'end': 0x23, 'pageup': 0x21, 'pagedown': 0x22,
    'control': 0x11, 'shift': 0x10, 'alt': 0x12, 'meta': 0x5B
  };

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit() { this.initCrypto(); this.connectToSignalingServer(); }
  ngOnDestroy() { this.socket?.disconnect(); }
  async initCrypto() { this.keyPair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveKey"]); }

  private connectToSignalingServer() {
    this.socket = io('http://localhost:3000');
    this.socket.on('connect', () => { this.isConnected = true; this.myId = this.socket.id || ''; this.cdr.detectChanges(); });
    this.socket.on('disconnect', () => { this.isConnected = false; this.myId = ''; this.cdr.detectChanges(); });
    this.socket.on('host-meta', (m: any) => { this.hostWidth = m.width; this.hostHeight = m.height; this.monitorCount = m.monitorCount; this.updateCanvasSize(); });
    this.socket.on('screen-update', (b64: string) => { if (!this.isP2P) this.drawFrame(b64); });
    this.socket.on('key-exchange-offer', async (d: any) => {
      console.log("[Crypto] Recibida oferta de llave del Host. Derivando...");
      try {
        const pub = await crypto.subtle.importKey("raw", d.publicKey, { name: "ECDH", namedCurve: "P-256" }, true, []);
        this.cryptoKey = await crypto.subtle.deriveKey({ name: "ECDH", public: pub }, this.keyPair.privateKey, { name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
        
        const myPub = await crypto.subtle.exportKey("raw", this.keyPair.publicKey);
        this.socket.emit('key-exchange-answer', { publicKey: myPub, to: this.targetId });
        console.log("[Crypto] ¡Sistema de cifrado activado y listo!");
      } catch (e) {
        console.error("[Crypto] Error en intercambio:", e);
      }
    });
    this.socket.on('signal', async (d: any) => {
      if (d.signalData.sdp) {
        await this.peerConnection?.setRemoteDescription(new RTCSessionDescription(d.signalData.sdp));
        if (d.signalData.type === 'offer') {
          const ans = await this.peerConnection?.createAnswer();
          if (ans) { await this.peerConnection?.setLocalDescription(ans); this.socket.emit('signal', { to: this.targetId, signalData: { sdp: ans, type: 'answer' } }); }
        }
      } else if (d.signalData.candidate) await this.peerConnection?.addIceCandidate(new RTCIceCandidate(d.signalData.candidate));
    });
  }

  private updateCanvasSize() {
    if (this.canvasRef) {
      this.canvasRef.nativeElement.width = this.hostWidth;
      this.canvasRef.nativeElement.height = this.hostHeight;
    }
  }

  private drawFrame(data: any) {
    if (!this.canvasRef || !this.canvasRef.nativeElement) return;
    
    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      this.isSessionActive = true;
      
      // Sincronización estricta de resolución interna
      if (canvas.width !== img.width || canvas.height !== img.height) {
        canvas.width = img.width;
        canvas.height = img.height;
      }

      // Configuración para Máxima Legibilidad de Texto
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high'; // Usa algoritmos superiores del navegador
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    img.src = (data instanceof ArrayBuffer) ? URL.createObjectURL(new Blob([data], { type: 'image/jpeg' })) : 'data:image/jpeg;base64,' + data;
  }

  private setupWebRTC() {
    this.peerConnection = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    this.peerConnection.onicecandidate = (e) => e.candidate && this.socket.emit('signal', { to: this.targetId, signalData: { candidate: e.candidate, mid: e.candidate.sdpMid } });
    this.peerConnection.ondatachannel = (e) => {
      if (e.channel.label === 'video-stream') {
        e.channel.binaryType = 'arraybuffer';
        e.channel.onmessage = (msg) => { this.isP2P = true; this.drawFrame(msg.data); };
      } else if (e.channel.label === 'commands') this.commandChannel = e.channel;
    };
  }

  async onConnect() { 
    if (!this.targetId) return;
    this.isSessionActive = true;
    
    // CRÍTICO: Avisar al servidor para que el Host sepa que hemos entrado
    // Esto disparará el 'viewer-connected' en el Bridge y el intercambio de llaves.
    this.socket.emit('join-session', this.targetId);

    this.setupWebRTC(); 
    const offer = await this.peerConnection?.createOffer(); 
    if (offer) { 
      await this.peerConnection?.setLocalDescription(offer); 
      this.socket.emit('signal', { to: this.targetId, signalData: { sdp: offer, type: 'offer' } }); 
    } 
  }

  onSwitchMonitor(event: any) {
    const index = event.target.value;
    this.emitEncrypted({ type: 'SWITCH-MONITOR', index: parseInt(index) });
  }

  onDisconnectSession() {
    if (this.isRecording) this.stopRecording();
    this.commandChannel?.close();
    this.peerConnection?.close();
    this.peerConnection = null;
    this.commandChannel = null;
    this.isSessionActive = false;
    this.isP2P = false;
    this.socket.emit('session-ended', { to: this.targetId });
  }

  // --- GRABACIÓN ---
  startRecording() {
    this.recordedChunks = [];
    const stream = this.canvasRef.nativeElement.captureStream(30);
    this.mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm; codecs=vp9' });
    this.mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) this.recordedChunks.push(e.data); };
    this.mediaRecorder.onstop = () => {
      const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `Sesion_${this.targetId}.webm`; a.click();
    };
    this.mediaRecorder.start();
    this.isRecording = true;
  }

  stopRecording() { this.mediaRecorder?.stop(); this.isRecording = false; }

  async emitEncrypted(cmd: any) {
    if (!this.cryptoKey) return; // No enviar nada si no hay cifrado activo
    
    try {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, this.cryptoKey, new TextEncoder().encode(JSON.stringify(cmd)));
      
      const payload = { 
        iv: btoa(String.fromCharCode(...iv)), 
        data: btoa(String.fromCharCode(...new Uint8Array(ct))),
        to: this.targetId
      };

      if (this.commandChannel?.readyState === 'open') {
        this.commandChannel.send(JSON.stringify(payload));
      } else {
        this.socket.emit('remote-command', payload);
      }
    } catch (e) {
      console.error("[Crypto] Error al cifrar:", e);
    }
  }

  onMouseMove(e: MouseEvent) {
    if (!this.isSessionActive) return;
    const r = this.canvasRef.nativeElement.getBoundingClientRect();
    const x = Math.round(((e.clientX - r.left) / r.width) * this.hostWidth);
    const y = Math.round(((e.clientY - r.top) / r.height) * this.hostHeight);
    console.log(`[Mouse] Move: ${x}, ${y}`);
    this.emitEncrypted({ type: 'MOVE', x, y });
  }
  onMouseDown(e: MouseEvent) { 
    if (!this.isSessionActive) return;
    const btn = e.button === 0 ? 'LEFT' : (e.button === 2 ? 'RIGHT' : null);
    if (btn) {
      console.log(`[Mouse] Click Down: ${btn}`);
      this.emitEncrypted({ type: 'CLICK', button: btn, action: 'DOWN' }); 
    }
  }
  onMouseUp(e: MouseEvent) { 
    if (!this.isSessionActive) return;
    const btn = e.button === 0 ? 'LEFT' : (e.button === 2 ? 'RIGHT' : null);
    if (btn) {
      console.log(`[Mouse] Click Up: ${btn}`);
      this.emitEncrypted({ type: 'CLICK', button: btn, action: 'UP' }); 
    }
  }

  @HostListener('window:keydown', ['$event'])
  onKeyDown(e: KeyboardEvent) { 
    if (!this.isSessionActive) return;
    console.log(`[Key] Down: ${e.key}`);
    let vk = 0;
    const key = e.key.toLowerCase();
    if (this.keyMap[key]) vk = this.keyMap[key];
    else if (key.length === 1) vk = key.toUpperCase().charCodeAt(0);

    if (vk > 0) {
      e.preventDefault();
      this.emitEncrypted({ type: 'KEY', vk: vk, action: 'DOWN' });
    }
  }

  @HostListener('window:keyup', ['$event'])
  onKeyUp(e: KeyboardEvent) {
    if (!this.isSessionActive) return;
    let vk = 0;
    const key = e.key.toLowerCase();
    if (this.keyMap[key]) vk = this.keyMap[key];
    else if (key.length === 1) vk = key.toUpperCase().charCodeAt(0);
    if (vk > 0) {
      this.emitEncrypted({ type: 'KEY', vk: vk, action: 'UP' });
    }
  }
}
