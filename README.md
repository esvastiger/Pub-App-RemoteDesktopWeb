# RemotePro v2.1 - Escritorio Remoto MVP

## 🚀 Descripción
RemotePro es una solución de escritorio remoto de alto rendimiento inspirada en AnyDesk, que utiliza tecnologías de bajo nivel para garantizar una latencia mínima y una alta fidelidad visual.

## 🛠️ Arquitectura del Sistema
El proyecto se divide en cuatro componentes principales:

1.  **Signaling Server (Node.js):** Orquestador de conexiones y gestión de salas para WebRTC.
2.  **Host Agent (C++):** Motor de captura de alto rendimiento usando **DXGI Desktop Duplication API** e inyección de eventos nativos de Windows (`SendInput`).
3.  **Host Bridge (Node.js):** Actúa como nexo entre el motor C++ y la red, gestionando el cifrado y los comandos.
4.  **Viewer Client (Angular):** Interfaz web moderna para la visualización y control remoto.

## 📡 Protocolos y Seguridad
*   **P2P:** Conexión directa vía WebRTC sobre UDP para ultra-baja latencia.
*   **NAT Traversal:** Implementación de servidores STUN/TURN (ICE).
*   **Cifrado:** Seguridad de extremo a extremo (E2EE) mediante **AES-256-GCM** y **Diffie-Hellman**.
*   **Video:** Captura directa de GPU -> Compresión JPEG optimizada -> Stream binario.

## 🚀 Guía de Inicio Rápido

### 1. Servidor de Señalización
```bash
cd signaling-server
node index.js
```

### 2. Motor C++ (Host Engine)
*   Abrir en **Visual Studio (2017+)**.
*   Configurar librerías: `d3d11.lib`, `dxgi.lib`, `gdiplus.lib`, `ole32.lib`, `user32.lib`.
*   Compilar en **Release x64**.
*   Renombrar a `engine.exe` y colocar en la carpeta `host-bridge`.

### 3. Puente del Host
```bash
cd host-bridge
node bridge.js
```

### 4. Cliente Angular
```bash
cd client-app
npm install
npm start
```
Abrir [http://localhost:4200](http://localhost:4200).

## 📊 Estado del Proyecto
- [x] Streaming de Video a 60 FPS (Optimizado con Delta-Detection).
- [x] Conexión P2P cifrada.
- [x] Control total de ratón y teclado.
- [x] Soporte Multi-Monitor.
- [x] Grabación de sesión nativa (.webm).
- [x] Ajuste automático de resolución y DPI Awareness.

---
*Nota Final-> Hay cosas que se deben mejorar pero para una primera aproximación es un buen avance*
*1- Se debe aumentar la resolución y el tamaño de la ventana que se captura *
*2- Aunque se controla ratón y teclado en las pruebas, solo llego a tener la visualizacion*
*3- No he podido llegar a testear el MultiMonitor debido a que solo dispongo de uno*
*4- En cada conexion al abrir, el codigo obtenido del Id Sesion para conectarse es diferente*
*5- La grabacion es correcta y se descarga una vez finalizada la conexion o detenida la grabación*

### 5. Capturas de la aplicación
<img width="799" height="198" alt="servidor" src="https://github.com/user-attachments/assets/59d81c54-afc5-4bc1-ab41-11a85c7d40e8" />
<img width="1912" height="1776" alt="RemotePro" src="https://github.com/user-attachments/assets/567a6fca-1ca1-48b8-ad8d-2dc6f398ac2c" />


