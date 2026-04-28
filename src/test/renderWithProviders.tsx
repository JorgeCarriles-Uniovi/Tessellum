import { render, type RenderOptions } from "@testing-library/react";
import type { PropsWithChildren, ReactElement } from "react";

function TestProviders({ children }: PropsWithChildren) {
    return <>{children}</>;
}

export function renderWithProviders(
    ui: ReactElement,
    options?: Omit<RenderOptions, "wrapper">,
) {
    return render(ui, {
        wrapper: TestProviders,
        ...options,
    });
}
