export interface ToggleProps {
    checked: boolean;
    onChange: (value: boolean) => void;
    disabled?: boolean;
    /** Accessible name for the switch. */
    label?: string;
}

export function Toggle({ checked, onChange, disabled, label }: ToggleProps) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={label}
            disabled={disabled}
            className="ui-toggle"
            onClick={() => onChange(!checked)}
        >
            <span className="ui-toggle__thumb" />
        </button>
    );
}
