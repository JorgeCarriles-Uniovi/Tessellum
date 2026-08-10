import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test } from "vitest";
import { invokeMock } from "../../test/tauriMocks";
import { renderWithProviders } from "../../test/renderWithProviders";
import { SyncSettings } from "./SyncSettings";
import { useSyncStore } from "../../stores/syncStore";
import { useVaultStore } from "../../stores/vaultStore";

describe("SyncSettings", () => {
    beforeEach(() => {
        invokeMock.mockReset();
        invokeMock.mockResolvedValue(undefined);
        useSyncStore.setState({ config: {} });
        useVaultStore.setState({ vaultPath: "/test/vault" });
    });

    test("saving before the keychain password hydrates does not delete the stored credential", async () => {
        // Simulates hydrateSyncSecret() not having resolved yet: the store's
        // config.password is unset and the user has not touched the field.
        renderWithProviders(<SyncSettings />);

        fireEvent.click(screen.getByRole("button", { name: "Initialize Repo" }));

        await waitFor(() => {
            expect(invokeMock).toHaveBeenCalledWith("init_vault_repo", expect.anything());
        });

        // The password field was never edited, so the secret write must be
        // skipped entirely -- neither a delete nor a set. Calling
        // secret_delete here would be the bug: it destroys whatever password
        // is still sitting in the keychain while hydration is in flight.
        expect(invokeMock).not.toHaveBeenCalledWith("secret_delete", expect.anything());
        expect(invokeMock).not.toHaveBeenCalledWith("secret_set", expect.anything());
    });

    test("saving after the user edits the password field writes it through to the keychain", async () => {
        renderWithProviders(<SyncSettings />);

        fireEvent.change(screen.getByPlaceholderText("ghp_…"), { target: { value: "hunter2" } });
        fireEvent.click(screen.getByRole("button", { name: "Initialize Repo" }));

        await waitFor(() => {
            expect(invokeMock).toHaveBeenCalledWith("secret_set", { key: "sync.password", value: "hunter2" });
        });
    });

    test("clearing a previously-stored password and saving deletes the keychain entry", async () => {
        useSyncStore.setState({ config: { password: "old-secret" } });
        renderWithProviders(<SyncSettings />);

        const field = await screen.findByDisplayValue("old-secret");
        fireEvent.change(field, { target: { value: "" } });

        // The field must actually stay cleared across a re-render (this is
        // the bug: gating the seed effect on `!password` instead of on
        // `passwordDirty` would immediately write "old-secret" back in).
        expect(screen.getByPlaceholderText("ghp_…")).toHaveValue("");

        fireEvent.click(screen.getByRole("button", { name: "Initialize Repo" }));

        await waitFor(() => {
            expect(invokeMock).toHaveBeenCalledWith("secret_delete", { key: "sync.password" });
        });
        expect(invokeMock).not.toHaveBeenCalledWith("secret_set", expect.objectContaining({ key: "sync.password" }));
        // The field must remain cleared after the save completes too.
        expect(screen.getByPlaceholderText("ghp_…")).toHaveValue("");
    });

    test("surfaces an error and does not report success when the credential write fails", async () => {
        renderWithProviders(<SyncSettings />);

        fireEvent.change(screen.getByPlaceholderText("ghp_…"), { target: { value: "hunter2" } });
        invokeMock.mockImplementation((command?: string) => {
            if (command === "secret_set") {
                return Promise.reject(new Error("Credential store unavailable"));
            }
            return Promise.resolve(undefined);
        });

        fireEvent.click(screen.getByRole("button", { name: "Initialize Repo" }));

        await waitFor(() => {
            expect(screen.getByText(/couldn't save the git password/i)).toBeInTheDocument();
        });
        expect(screen.queryByText("Repository initialized.")).not.toBeInTheDocument();
    });
});
