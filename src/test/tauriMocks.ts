import { vi } from "vitest";

const tauriState = vi.hoisted(() => {
    const invokeMock = vi.fn(async () => undefined);
    const convertFileSrcMock = vi.fn((path: string) => `asset://${path}`);
    const listenMock = vi.fn(async () => vi.fn(async () => undefined));
    const existsMock = vi.fn(async () => false);
    const readDirMock = vi.fn(async () => []);
    const readTextFileMock = vi.fn(async () => "");
    const readFileMock = vi.fn(async () => new Uint8Array());
    const mkdirMock = vi.fn(async () => undefined);
    const watchMock = vi.fn(async () => vi.fn(async () => undefined));
    const openDialogMock = vi.fn(async () => null);

    const currentWindow = {
        minimize: vi.fn(async () => undefined),
        maximize: vi.fn(async () => undefined),
        unmaximize: vi.fn(async () => undefined),
        isMaximized: vi.fn(async () => false),
        close: vi.fn(async () => undefined),
        startDragging: vi.fn(async () => undefined),
        setSize: vi.fn(async () => undefined),
    };
    const getCurrentWindowMock = vi.fn(() => currentWindow);

    class LogicalSize {
        width: number;
        height: number;

        constructor(width: number, height: number) {
            this.width = width;
            this.height = height;
        }
    }

    return {
        invokeMock,
        convertFileSrcMock,
        listenMock,
        existsMock,
        readDirMock,
        readTextFileMock,
        readFileMock,
        mkdirMock,
        watchMock,
        openDialogMock,
        currentWindow,
        getCurrentWindowMock,
        LogicalSize,
    };
});

export const invokeMock = tauriState.invokeMock;
export const convertFileSrcMock = tauriState.convertFileSrcMock;
export const listenMock = tauriState.listenMock;
export const existsMock = tauriState.existsMock;
export const readDirMock = tauriState.readDirMock;
export const readTextFileMock = tauriState.readTextFileMock;
export const readFileMock = tauriState.readFileMock;
export const mkdirMock = tauriState.mkdirMock;
export const watchMock = tauriState.watchMock;
export const openDialogMock = tauriState.openDialogMock;
export const getCurrentWindowMock = tauriState.getCurrentWindowMock;
export const mockedCurrentWindow = tauriState.currentWindow;

vi.mock("@tauri-apps/api/core", () => ({
    invoke: tauriState.invokeMock,
    convertFileSrc: tauriState.convertFileSrcMock,
}));

vi.mock("@tauri-apps/api/event", () => ({
    listen: tauriState.listenMock,
}));

vi.mock("@tauri-apps/plugin-fs", () => ({
    exists: tauriState.existsMock,
    readDir: tauriState.readDirMock,
    readTextFile: tauriState.readTextFileMock,
    readFile: tauriState.readFileMock,
    mkdir: tauriState.mkdirMock,
    watch: tauriState.watchMock,
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
    open: tauriState.openDialogMock,
}));

vi.mock("@tauri-apps/api/window", () => ({
    getCurrentWindow: tauriState.getCurrentWindowMock,
    LogicalSize: tauriState.LogicalSize,
}));

export function resetTauriMocks(): void {
    invokeMock.mockReset();
    invokeMock.mockResolvedValue(undefined);

    convertFileSrcMock.mockReset();
    convertFileSrcMock.mockImplementation((path: string) => `asset://${path}`);

    listenMock.mockReset();
    listenMock.mockResolvedValue(vi.fn(async () => undefined));

    existsMock.mockReset();
    existsMock.mockResolvedValue(false);

    readDirMock.mockReset();
    readDirMock.mockResolvedValue([]);

    readTextFileMock.mockReset();
    readTextFileMock.mockResolvedValue("");

    readFileMock.mockReset();
    readFileMock.mockResolvedValue(new Uint8Array());

    mkdirMock.mockReset();
    mkdirMock.mockResolvedValue(undefined);

    watchMock.mockReset();
    watchMock.mockResolvedValue(vi.fn(async () => undefined));

    openDialogMock.mockReset();
    openDialogMock.mockResolvedValue(null);

    mockedCurrentWindow.minimize.mockReset();
    mockedCurrentWindow.maximize.mockReset();
    mockedCurrentWindow.unmaximize.mockReset();
    mockedCurrentWindow.isMaximized.mockReset();
    mockedCurrentWindow.isMaximized.mockResolvedValue(false);
    mockedCurrentWindow.close.mockReset();
    mockedCurrentWindow.startDragging.mockReset();
    mockedCurrentWindow.setSize.mockReset();

    getCurrentWindowMock.mockReset();
    getCurrentWindowMock.mockImplementation(() => mockedCurrentWindow);
}
