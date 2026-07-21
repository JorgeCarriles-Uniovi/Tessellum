import type React from "react";
import { useEffect, useRef, useState } from "react";
import { useAppTranslation } from "../i18n/react.tsx";
import { Button, KeyHint, Modal, ModalFooter, ModalHeader, TextInput } from "./ui";

interface InputModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (value: string) => void;
    title?: string;
    placeholder?: string;
    defaultValue?: string;
    submitLabel?: string;
}

export function InputModal({
    isOpen,
    onClose,
    onSubmit,
    title,
    placeholder,
    defaultValue = "",
    submitLabel,
}: InputModalProps) {
    const { t } = useAppTranslation("core");
    const [value, setValue] = useState(defaultValue);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setValue(defaultValue);
            setTimeout(() => {
                inputRef.current?.focus();
                inputRef.current?.select();
            }, 50);
        }
    }, [isOpen, defaultValue]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (value.trim()) {
            onSubmit(value.trim());
            onClose();
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} maxWidth={420}>
            <form onSubmit={handleSubmit}>
                <ModalHeader title={title ?? t("inputModal.enterName")} />

                <div style={{ padding: "4px 24px 16px 24px" }}>
                    <TextInput
                        ref={inputRef}
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        placeholder={placeholder ?? t("inputModal.enterNamePlaceholder")}
                    />
                </div>

                <ModalFooter
                    hints={
                        <>
                            <KeyHint keys="Enter">{t("inputModal.confirm")}</KeyHint>
                            <KeyHint keys="Esc">{t("inputModal.cancelHint")}</KeyHint>
                        </>
                    }
                >
                    <Button variant="ghost" onClick={onClose}>
                        {t("inputModal.cancel")}
                    </Button>
                    <Button variant="primary" type="submit" disabled={!value.trim()}>
                        {submitLabel ?? t("inputModal.create")}
                    </Button>
                </ModalFooter>
            </form>
        </Modal>
    );
}
