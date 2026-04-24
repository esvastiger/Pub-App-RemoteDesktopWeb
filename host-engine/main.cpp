#include <iostream>
#include <windows.h>
#include <d3d11.h>
#include <dxgi1_2.h>
#include <vector>
#include <string>
#include <thread>
#include <gdiplus.h>
#include <fcntl.h>
#include <io.h>
#include <objbase.h>

// Librerías necesarias para VS 2017
#pragma comment(lib, "d3d11.lib")
#pragma comment(lib, "dxgi.lib")
#pragma comment(lib, "gdiplus.lib")
#pragma comment(lib, "ole32.lib")
#pragma comment(lib, "user32.lib")

using namespace Gdiplus;

struct ScreenMeta { int width; int height; int monitorCount; };

// Globales de Control
int currentWidth = 1920; 
int currentHeight = 1080;
int activeMonitor = 0;
bool restartCapture = false;

// --- FUNCIONES DE INYECCIÓN ---
void SimulateMouseMove(int x, int y, int sw, int sh) {
    INPUT i = {0}; i.type = INPUT_MOUSE; i.mi.dwFlags = MOUSEEVENTF_MOVE | MOUSEEVENTF_ABSOLUTE;
    i.mi.dx = (long)(x * (65535.0 / (sw > 0 ? sw : 1))); 
    i.mi.dy = (long)(y * (65535.0 / (sh > 0 ? sh : 1)));
    SendInput(1, &i, sizeof(INPUT));
}
void SimulateMouseClick(bool l, bool d) {
    INPUT i = {0}; i.type = INPUT_MOUSE;
    i.mi.dwFlags = l ? (d ? MOUSEEVENTF_LEFTDOWN : MOUSEEVENTF_LEFTUP) : (d ? MOUSEEVENTF_RIGHTDOWN : MOUSEEVENTF_RIGHTUP);
    SendInput(1, &i, sizeof(INPUT));
}
void SimulateKeyboardKey(WORD vk, bool d) {
    INPUT i = {0}; i.type = INPUT_KEYBOARD; i.ki.wVk = vk; i.ki.dwFlags = d ? 0 : KEYEVENTF_KEYUP;
    SendInput(1, &i, sizeof(INPUT));
}

// --- ESCUCHA DE COMANDOS ---
void CommandListener() {
    char line[256];
    while (std::cin.getline(line, 256)) {
        std::string sLine(line);
        if (sLine.find("MOVE") == 0) {
            int x, y; if (sscanf_s(line, "MOVE %d %d", &x, &y) == 2) SimulateMouseMove(x, y, currentWidth, currentHeight);
        } else if (sLine.find("CLICK") == 0) {
            char t[16], a[16]; 
            // Usar un formato más seguro para strings en sscanf_s
            if (sscanf_s(line, "CLICK %15s %15s", t, (unsigned int)sizeof(t), a, (unsigned int)sizeof(a)) == 2) {
                SimulateMouseClick(std::string(t) == "LEFT", std::string(a) == "DOWN");
            }
        } else if (sLine.find("KEY") == 0) {
            int vk; char a[16]; 
            if (sscanf_s(line, "KEY %d %15s", &vk, a, (unsigned int)sizeof(a)) == 2) {
                SimulateKeyboardKey((WORD)vk, std::string(a) == "DOWN");
            }
        } else if (sLine.find("SWITCH") == 0) {
            int target; if (sscanf_s(line, "SWITCH %d", &target) == 1) { activeMonitor = target; restartCapture = true; }
        }
    }
}

int main() {
    // Hacer que el proceso sea consciente de los DPI para obtener resoluciones reales
    SetProcessDPIAware();

    // Configuración de entrada/salida binaria
    _setmode(_fileno(stdout), _O_BINARY);
    
    // Inicializar GDI+ para JPEG
    GdiplusStartupInput gsi; ULONG_PTR gst; GdiplusStartup(&gst, &gsi, NULL);
    CLSID encoderClsid; 
    UINT num = 0, szEnc = 0; GetImageEncodersSize(&num, &szEnc);
    ImageCodecInfo* pici = (ImageCodecInfo*)(malloc(szEnc)); GetImageEncoders(num, szEnc, pici);
    for (UINT j = 0; j < num; ++j) if (wcscmp(pici[j].MimeType, L"image/jpeg") == 0) encoderClsid = pici[j].Clsid;
    free(pici);

    EncoderParameters ep; ep.Count = 1; 
    ep.Parameter[0].Guid = EncoderQuality; // Guid de calidad
    ep.Parameter[0].Type = EncoderParameterValueTypeLong; ep.Parameter[0].NumberOfValues = 1;
    ULONG q = 90; ep.Parameter[0].Value = &q;

    std::thread(CommandListener).detach();

    while (true) {
        restartCapture = false;
        ID3D11Device* dev = nullptr; ID3D11DeviceContext* ctx = nullptr; D3D_FEATURE_LEVEL fl;
        if (FAILED(D3D11CreateDevice(nullptr, D3D_DRIVER_TYPE_HARDWARE, nullptr, 0, nullptr, 0, D3D11_SDK_VERSION, &dev, &fl, &ctx))) break;
        
        IDXGIDevice* dxDev = nullptr; dev->QueryInterface(__uuidof(IDXGIDevice), (void**)&dxDev);
        IDXGIAdapter* dxAdp = nullptr; dxDev->GetParent(__uuidof(IDXGIAdapter), (void**)&dxAdp);
        
        UINT mCount = 0; IDXGIOutput* tempOut = nullptr;
        while (dxAdp->EnumOutputs(mCount, &tempOut) != DXGI_ERROR_NOT_FOUND) { tempOut->Release(); mCount++; }
        
        IDXGIOutput* dxOut = nullptr; 
        if (dxAdp->EnumOutputs(activeMonitor, &dxOut) == DXGI_ERROR_NOT_FOUND) dxAdp->EnumOutputs(0, &dxOut);

        DXGI_OUTPUT_DESC oDesc; dxOut->GetDesc(&oDesc);
        
        // Inicialmente usamos las coordenadas del escritorio
        currentWidth = oDesc.DesktopCoordinates.right - oDesc.DesktopCoordinates.left;
        currentHeight = oDesc.DesktopCoordinates.bottom - oDesc.DesktopCoordinates.top;

        IDXGIOutput1* dxOut1 = nullptr; dxOut->QueryInterface(__uuidof(IDXGIOutput1), (void**)&dxOut1);
        IDXGIOutputDuplication* deskDupl = nullptr;
        if (FAILED(dxOut1->DuplicateOutput(dev, &deskDupl))) { restartCapture = true; }

        bool metaSent = false;

        while (!restartCapture) {
            DXGI_OUTDUPL_FRAME_INFO fInfo; IDXGIResource* res = nullptr;
            if (SUCCEEDED(deskDupl->AcquireNextFrame(100, &fInfo, &res))) {
                if (fInfo.AccumulatedFrames > 0) {
                    ID3D11Texture2D* tex = nullptr; res->QueryInterface(__uuidof(ID3D11Texture2D), (void**)&tex);
                    D3D11_TEXTURE2D_DESC d; tex->GetDesc(&d);

                    if (!metaSent || currentWidth != d.Width || currentHeight != d.Height) {
                        currentWidth = d.Width;
                        currentHeight = d.Height;
                        ScreenMeta meta = { currentWidth, currentHeight, (int)mCount };
                        fwrite("META", 1, 4, stdout); fwrite(&meta, sizeof(ScreenMeta), 1, stdout); fflush(stdout);
                        metaSent = true;
                    }

                    d.Usage = D3D11_USAGE_STAGING; d.CPUAccessFlags = D3D11_CPU_ACCESS_READ; d.BindFlags = 0; d.MiscFlags = 0;
                    ID3D11Texture2D* stg = nullptr; dev->CreateTexture2D(&d, nullptr, &stg);
                    ctx->CopyResource(stg, tex);
                    D3D11_MAPPED_SUBRESOURCE map;
                    if (SUCCEEDED(ctx->Map(stg, 0, D3D11_MAP_READ, 0, &map))) {
                        Bitmap bmp(d.Width, d.Height, map.RowPitch, PixelFormat32bppARGB, (BYTE*)map.pData);
                        IStream* s = NULL; CreateStreamOnHGlobal(NULL, TRUE, &s);
                        bmp.Save(s, &encoderClsid, &ep);
                        
                        // OBTENER TAMAÑO REAL DEL STREAM (CRÍTICO PARA EVITAR DISTORSIÓN)
                        STATSTG stat;
                        s->Stat(&stat, STATFLAG_NONAME);
                        size_t realSize = (size_t)stat.cbSize.QuadPart;

                        HGLOBAL hg = NULL; GetHGlobalFromStream(s, &hg);
                        void* p = GlobalLock(hg);
                        fwrite("FRAME", 1, 5, stdout); 
                        fwrite(&realSize, sizeof(size_t), 1, stdout); 
                        fwrite(p, 1, realSize, stdout); 
                        fflush(stdout);
                        GlobalUnlock(hg); s->Release();
                    }
                    if (stg) stg->Release(); if (tex) tex->Release();
                }
                res->Release(); deskDupl->ReleaseFrame();
            }
            Sleep(10);
        }
        if (deskDupl) deskDupl->Release(); if (dxOut1) dxOut1->Release(); if (dxOut) dxOut->Release();
        if (dxAdp) dxAdp->Release(); if (dxDev) dxDev->Release(); if (ctx) ctx->Release(); if (dev) dev->Release();
    }
    GdiplusShutdown(gst);
    return 0;
}
