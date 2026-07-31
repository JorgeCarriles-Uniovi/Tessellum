import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { VaultSwitcherPopover } from "./VaultSwitcherPopover";
import { useVaultStore } from "../../stores/vaultStore";

vi.mock("../../plugins/TessellumApp", () => ({
    useTessellumApp: () => ({
        ui: { getUIActions: () => [] },
    }),
}));

vi.mock("../../i18n/react.tsx", () => ({
    useAppTranslation: () => ({
        t: (key: string) => {
            switch (key) {
                case "vaultSwitcher.currentVault":
                    return "Current vault";
                case "vaultSwitcher.active":
                    return "Active";
                case "vaultSwitcher.openFolderAsVault":
                    return "Open folder as vault…";
                case "vaultSwitcher.recentVaults":
                    return "Recent vaults";
                case "vaultSwitcher.removeRecent":
                    return "Remove from recent vaults";
                default:
                    return key;
            }
        },
    }),
}));

describe("VaultSwitcherPopover", () => {
    beforeEach(() => {
        localStorage.clear();
        useVaultStore.setState({
            vaultPath: "/vaults/current",
            recentVaultPaths: ["/vaults/current", "/vaults/older"],
        });
    });

    it("lists recent vaults excluding the current one", () => {
        render(<VaultSwitcherPopover open onClose={vi.fn()} />);
        expect(screen.getByText("older")).toBeInTheDocument();
        // The current vault's own name ("current") must not be duplicated in the recents list —
        // it only appears once, in the Current Vault card.
        expect(screen.getAllByText("current")).toHaveLength(1);
    });

    it("switches to a recent vault when clicked", () => {
        const onClose = vi.fn();
        render(<VaultSwitcherPopover open onClose={onClose} />);
        fireEvent.click(screen.getByText("older"));
        expect(useVaultStore.getState().vaultPath).toBe("/vaults/older");
        expect(onClose).toHaveBeenCalled();
    });

    it("removes a recent vault without switching to it", () => {
        const onClose = vi.fn();
        render(<VaultSwitcherPopover open onClose={onClose} />);
        fireEvent.click(screen.getByLabelText("Remove from recent vaults"));
        expect(useVaultStore.getState().recentVaultPaths).toEqual(["/vaults/current"]);
        expect(useVaultStore.getState().vaultPath).toBe("/vaults/current");
        expect(onClose).not.toHaveBeenCalled();
    });

    it("hides the Recent Vaults section entirely when there are none", () => {
        useVaultStore.setState({ vaultPath: "/vaults/current", recentVaultPaths: ["/vaults/current"] });
        render(<VaultSwitcherPopover open onClose={vi.fn()} />);
        expect(screen.queryByText("Recent vaults")).not.toBeInTheDocument();
    });
});
