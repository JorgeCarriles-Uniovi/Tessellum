interface TaskListCheckboxProps {
    checked: boolean;
    disabled?: boolean;
    onToggle: () => void;
}

export function TaskListCheckbox({
                                     checked,
                                     disabled = false,
                                     onToggle,
                                 }: TaskListCheckboxProps) {
    const handleMouseDown = (event: React.MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
        event.stopPropagation();

        if (!disabled) {
            onToggle();
        }
    };

    return (
        <span className="cm-task-list-checkbox-wrapper" contentEditable={false}>
            <button
                aria-label={checked ? "Mark task as incomplete" : "Mark task as complete"}
                aria-pressed={checked}
                className="cm-task-list-checkbox-input"
                data-checked={checked ? "true" : "false"}
                disabled={disabled}
                onMouseDown={handleMouseDown}
                type="button"
            >
                <span className="cm-task-list-checkbox-box" aria-hidden="true">
                    <svg
                        className="cm-task-list-checkbox-icon"
                        viewBox="0 0 16 16"
                        fill="none"
                    >
                        <path
                            d="M3.5 8.5L6.5 11.5L12.5 5.5"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    </svg>
                </span>
            </button>
        </span>
    );
}
