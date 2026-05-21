type WindowHandle = {
    minimize: () => Promise<void>;
    maximize: () => Promise<void>;
    unmaximize: () => Promise<void>;
    isMaximized: () => Promise<boolean>;
    close: () => Promise<void>;
    startDragging: () => Promise<void>;
    setSize: () => Promise<void>;
    listen: (event: string, handler: () => void) => Promise<() => void>;
    outerSize: () => Promise<{ width: number; height: number }>;
};

const MIN_WIDTH = 720;
const MIN_HEIGHT = 500;
let currentSize = { width: 1280, height: 800 };

const currentWindow: WindowHandle = {
    minimize: async () => undefined,
    maximize: async () => undefined,
    unmaximize: async () => undefined,
    isMaximized: async () => false,
    close: async () => undefined,
    startDragging: async () => undefined,
    setSize: async () => {
        currentSize = { width: Math.max(currentSize.width, MIN_WIDTH), height: Math.max(currentSize.height, MIN_HEIGHT) };
    },
    listen: async (_event, _handler) => () => undefined,
    outerSize: async () => currentSize,
};

export class LogicalSize {
    width: number;
    height: number;

    constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
    }
}

export function getCurrentWindow(): WindowHandle {
    return currentWindow;
}