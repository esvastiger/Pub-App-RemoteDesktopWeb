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
*   **NAT Traversal:** Implementación de servidores STUN/TURN (ICE) para atravesar firewalls.
*   **Cifrado:** Seguridad de extremo a extremo (E2EE) mediante **AES-256-GCM** y **Diffie-Hellman**.
*   **Video:** Captura directa de GPU -> Compresión JPEG optimizada -> Stream binario.

## 🚀 Guía de Inicio Rápido y Depuración

## GUÍA DE DEPURACIÓN (Pasos para visualizar avances)
1. **Signaling Server:** Ejecutar `node index.js`. Verifica que los sockets conectan.
2. **C++ Engine:** Compilar como `engine.exe` (Release x64). Verifica que inicia la captura DXGI.
3. **Host Bridge:** Ejecutar `node bridge.js`. Es el nexo entre C++ y la red. Revisa los logs de "Host Meta".
4. **Angular Viewer:** Ejecutar `npm start`. Verifica que el badge cambie a "UDP P2P" al conectar.
5. **Logs de Consola (F12):** En el navegador, verás el handshake criptográfico y la resolución detectada.
--------------------------------------------------------------
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

### 5. Capturas de la aplicación
<img width="1003" height="290" alt="servidor" src="https://github.com/user-attachments/assets/7508c3c9-4001-4c64-81c9-c674f373a5a4" />
Visual
<img width="1912" height="880" alt="RemotePro" src="https://github.com/user-attachments/assets/5a49755c-4328-43b0-91ec-ddf4c8c1aef4" />
<img width="1916" height="952" alt="RemotePro2" src="https://github.com/user-attachments/assets/b6285717-6c7f-49df-b19c-c3ee85c463ca" />

## 📊 Estado del Proyecto
### Inicio Proyecto -> 20260411
```bash
- Motor C++ (Host Engine): Inicio del desarrollo del motor de captura en Windows usando DXGI y C++ (Consola para debugging).
- Captura Real de Frames: Implementación de la lógica de duplicación de escritorio (IDXGIOutputDuplication) para obtener frames directamente de la GPU.
- Control Remoto (Mouse Injection): Implementación de funciones en C++ usando SendInput para simular movimiento y clics de ratón de forma nativa.
- Video Pipeline (Host a Viewer): Captura DXGI -> Compresión JPEG (GDI+) -> Stream Binario (C++ stdout) -> Puente Node.js -> WebSocket -> Visor Angular (IMG Base64).
- Interactividad Completa: Captura de eventos de ratón y teclado en Angular con normalización de coordenadas y mapeo de Virtual Keys para Windows.
- Arquitectura de Puente (Bridge): Separación de la red (Node.js) y la ejecución crítica (C++), permitiendo comunicación fluida y segura.
```
### Actualizacion interna-> 20260423
```bash
- Resolución Dinámica: Se implementó la sincronización estricta del buffer interno del Canvas con el frame recibido, eliminando el pixelado por escalado del navegador.
- Nitidez Adaptativa: Uso de imageSmoothingQuality: high y filtros de contraste CSS para mejorar la legibilidad de textos pequeños.
- Seguridad End-to-End (E2EE):
    - Implementación de intercambio de llaves ECDH (Elliptic Curve Diffie-Hellman) sobre P-256.
    - Cifrado de comandos mediante AES-256-GCM con vectores de inicialización (IV) únicos por comando.
    - Validación de autenticidad mediante Auth Tags para prevenir la manipulación de eventos de control.
- Optimización del Host Bridge:
    - Añadido sistema de logs detallados para depuración de red y descifrado.
    - Implementación de redundancia de comandos (DataChannel + Socket.io fallback).
- Control de Inyección Robusto:
    - Mejora en el parsing de comandos en el motor C++ para evitar bloqueos por strings malformados.
    - Soporte extendido para eventos de teclado (KeyDown/KeyUp) y mapeo de Scan Codes.
```

----------------------------------------
----------------------------------------
### Actualizacion -> 20260424
INFORME DETALLADO DE SESIÓN TÉCNICA (RESOLUCIÓN Y CONTROL)

### 1. DIAGNÓSTICO DE PROBLEMAS CRÍTICOS
Durante esta sesión se abordaron dos bloqueos principales detectados en el MVP v2.1:
*   **Problema A (Visual):** Nitidez extremadamente baja y pixelado al ajustar el visor a pantalla completa. Los textos pequeños resultaban ilegibles.
*   **Problema B (Control):** Fallo total en la inyección de eventos (ratón y teclado) desde el visor web al equipo host.
*   **Problema C (Seguridad):** El protocolo de intercambio de llaves (Handshake) fallaba de forma intermitente, bloqueando el envío de comandos cifrados.

### 2. SOLUCIONES IMPLEMENTADAS EN RESOLUCIÓN Y ESCALADO
*   **Sincronización de Búfer Interno:** Se detectó que el Canvas de HTML5 inicializaba un búfer por defecto (300x150). Se implementó una lógica en `home.ts` que redimensiona dinámicamente el `canvas.width` y `canvas.height` para que coincidan bit a bit con el frame JPEG recibido (ej. 1920x1080).
*   **Filtros de Nitidez Adaptativa:** Se aplicó la propiedad `imageSmoothingQuality: 'high'` y se desactivó el suavizado agresivo de CSS. Se añadieron filtros de contraste y brillo (`filter: contrast(1.05)`) para mejorar la legibilidad de fuentes en fondos oscuros.
*   **DPI Awareness:** Se preparó el motor C++ para capturar píxeles físicos reales, evitando que el escalado de Windows (ej. 150%) borre la imagen.

### 3. SOLUCIONES EN CONTROL REMOTO Y COMUNICACIÓN
*   **Fallback de Comandos:** Se corrigió el `bridge.js` para que no dependa únicamente de WebRTC P2P. Ahora los comandos pueden viajar vía Socket.io de forma redundante, garantizando control inmediato tras la conexión.
*   **Robusticidad del Motor C++:** Se actualizó `main.cpp` con un sistema de parsing (`sscanf_s`) más tolerante a errores, permitiendo procesar cadenas de comandos complejas sin bloquear el hilo de escucha.
*   **Inyección de Teclado Extendida:** Se implementó el soporte para `KeyUp` y el mapeo automático de teclas alfanuméricas, permitiendo el uso de combinaciones como `Ctrl+Alt+Del` o comandos de sistema.

### 4. REESTRUCTURACIÓN DEL CIFRADO E2EE (SEGURIDAD)
*   **Handshake Garantizado:** Se identificó que el intercambio de llaves fallaba porque el Viewer no iniciaba la sesión correctamente. Se añadió el evento `join-session` en Angular para disparar la negociación de llaves.
*   **AES-256-GCM:** Se implementó el estándar GCM (Galois/Counter Mode), que no solo cifra el comando sino que añade un Tag de autenticación para asegurar que nadie en el servidor de señalización pueda inyectar comandos falsos.

### 5. SISTEMA DE DEPURACIÓN (LOGS)
Se habilitó una red de trazabilidad completa para futuras correcciones:
*   **Navegador:** Logs con prefijos `[Mouse]`, `[Key]` y `[Crypto]`.
*   **Servidor:** Logs de reenvío `[Server]`.
*   **Bridge:** Logs de ejecución `[Bridge] Acción: ...`.
----------------------------------------
## 🚀 NOTA TÉCNICA FINAL
El proyecto dispone de una base sólida de seguridad y un visor adaptable. Para máxima nitidez se recomienda para producción mantener el escalado del host al 100% para evitar cualquier interpolación residual de Windows o recompilar el motor con la última configuración de DPI Awareness Per Monitor v2 incluida en el código fuente.

Seguiremos avanzando en el proyecto y trayendo mejoras.
## 🙌 Apoya el Proyecto
Si este contenido te ha sido de utilidad o te ha ayudado a aprender algo nuevo, ¡me encantaría contar con tu apoyo!
```bash
Dejar una ⭐ (Star): Ayuda a que el proyecto tenga más visibilidad y llegue a otras personas.
Abrir un Issue: ¿Tienes alguna duda, pregunta o sugerencia? No dudes en abrir un Issue en el repositorio.
```
¡Gracias por pasar por aquí! :)

