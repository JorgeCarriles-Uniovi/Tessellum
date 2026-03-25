import React, { useState, useEffect } from "react";
import { createRoot, Root } from "react-dom/client";
import { WidgetType, EditorView } from "@codemirror/view";
import { FrontmatterBlock, stringifyFrontmatter } from "./frontmatter-parser";
import { useTagAutocomplete } from "../../hooks/useTagAutocomplete";
import { usePropertyAutocomplete } from "../../hooks/usePropertyAutocomplete";
import { cn } from "../../../../lib/utils";
import { Tags, AlignLeft, X, Plus } from "lucide-react";
import { stringToColor } from "../../../../utils/graphUtils";

// The interactive React component
const FrontmatterUI: React.FC<{ view: EditorView, initialBlock: FrontmatterBlock, readOnly: boolean }> = ({ view, initialBlock, readOnly }) => {
    // We use state to track active properties so user typing doesn't instantly jump the cursor
    // The source of truth syncs on blur/enter.
    const [properties, setProperties] = useState(initialBlock.properties);

    // Sync from CodeMirror if document changed externally (e.g. undo/redo)
    useEffect(() => {
        setProperties(initialBlock.properties);
    }, [initialBlock.yaml]);

    const commitToEditor = (newProps: Record<string, any>) => {
        if (readOnly) return;
        const yamlString = stringifyFrontmatter(newProps);

        // Let's re-parse to make sure we replace the correct bounds.
        // Wait, initialBlock holds the exact bounds. CodeMirror handles shifting it.
        // Actually, we must use the CURRENT block location. We can't trust initialBlock bounds if the doc changed size above it!
        // Luckily, frontmatter is always at doc start (from: 0).
        // Let's just dispatch!

        view.dispatch({
            changes: { from: initialBlock.from, to: initialBlock.to, insert: yamlString }
        });
    };

    const updateProperty = (key: string, newValue: any) => {
        if (readOnly) return;
        const newProps = { ...properties, [key]: newValue };
        setProperties(newProps);
        commitToEditor(newProps);
    };

    const updatePropertyKey = (oldKey: string, newKey: string) => {
        if (readOnly) return;
        const trimmedNewKey = newKey.trim();
        if (oldKey === trimmedNewKey || !trimmedNewKey || trimmedNewKey in properties) {
            // Revert state change visually by retaining old properties, or ignore if duplicate
            return;
        }
        const newProps: Record<string, any> = {};
        for (const [k, v] of Object.entries(properties)) {
            if (k === oldKey) {
                newProps[trimmedNewKey] = v;
            } else {
                newProps[k] = v;
            }
        }
        setProperties(newProps);
        commitToEditor(newProps);
    };

    const addProperty = () => {
        if (readOnly) return;
        let i = 1;
        let baseKey = "new_property";
        let key = baseKey;
        while (key in properties) {
            key = `${baseKey}_${i}`;
            i++;
        }
        const newProps = { ...properties, [key]: "" };
        setProperties(newProps);
        commitToEditor(newProps);
    };

    const deleteProperty = (key: string) => {
        if (readOnly) return;
        const newProps = { ...properties };
        delete newProps[key];
        setProperties(newProps);
        commitToEditor(newProps);
    };

    return (
        <div className="cm-frontmatter-widget" contentEditable={false} data-readonly={readOnly}>
            <div className="cm-frontmatter-header">Properties</div>
            <div className="cm-frontmatter-props">
                {Object.entries(properties).map(([key, value]) => (
                    <PropertyRow
                        key={key}
                        propKey={key}
                        propValue={value}
                        existingKeys={Object.keys(properties)}
                        onUpdate={(v) => updateProperty(key, v)}
                        onUpdateKey={(newKey) => updatePropertyKey(key, newKey)}
                        onDelete={() => deleteProperty(key)}
                        readOnly={readOnly}
                    />
                ))}

                {!readOnly && (
                    <div
                        className="cm-frontmatter-add-row cursor-pointer"
                        onClick={addProperty}
                    >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add property</span>
                    </div>
                )}
            </div>
        </div>
    );
};

// Sub-component for each row
const PropertyRow = ({ propKey, propValue, existingKeys, onUpdate, onUpdateKey, onDelete, readOnly }: {
    propKey: string,
    propValue: any,
    existingKeys: string[],
    onUpdate: (val: any) => void,
    onUpdateKey: (newKey: string) => void,
    onDelete: () => void,
    readOnly: boolean
}) => {
    const isTag = propKey === 'tags' || propKey === 'tag';

    return (
        <div className="cm-frontmatter-prop-row group relative">
            <div className="cm-frontmatter-prop-key focus-within:opacity-100 transition-opacity relative">
                {isTag ? <Tags className="w-3.5 h-3.5" /> : <AlignLeft className="w-3.5 h-3.5" />}
                <PropertyKeyInput
                    value={propKey}
                    existingKeys={existingKeys}
                    onChange={onUpdateKey}
                    className="flex-1 bg-transparent border-none outline-none overflow-hidden text-ellipsis whitespace-nowrap"
                    readOnly={readOnly}
                />
            </div>

            <div className="cm-frontmatter-prop-value">
                {Array.isArray(propValue) || isTag ? (
                    <TagsInput
                        values={Array.isArray(propValue) ? propValue : (propValue ? String(propValue).split(",").map(s => s.trim()) : [])}
                        onChange={onUpdate}
                        readOnly={readOnly}
                    />
                ) : (
                    <StringInput value={String(propValue)} onChange={onUpdate} readOnly={readOnly} />
                )}
            </div>

            {!readOnly && (
                <button
                    onClick={onDelete}
                    className="absolute right-2 opacity-0 group-hover:opacity-100 p-1 hover:bg-muted/50 rounded transition-opacity text-muted-foreground hover:text-foreground"
                >
                    <X className="w-3.5 h-3.5" />
                </button>
            )}
        </div>
    );
};

const TagsInput = ({ values, onChange, readOnly }: { values: string[], onChange: (v: string[]) => void, readOnly: boolean }) => {
    const [input, setInput] = useState("");
    const { filterTags } = useTagAutocomplete();
    const suggestions = filterTags(input).filter(t => !values.includes(t));
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);

    // reset selected index when suggestions change
    useEffect(() => {
        setSelectedIndex(0);
    }, [suggestions.length]);

    const addTag = (tag: string) => {
        if (readOnly) return;
        if (!tag.trim()) return;
        const cleanTag = tag.trim();
        if (!values.includes(cleanTag)) {
            onChange([...values, cleanTag]);
        }
        setInput("");
        setShowSuggestions(false);
    };

    const removeTag = (tagToRemove: string) => {
        if (readOnly) return;
        onChange(values.filter(v => v !== tagToRemove));
    };

    return (
        <div className="flex flex-wrap gap-1.5 items-center w-full relative">
            {values.map(tag => {
                const { h } = stringToColor(tag);
                return (
                    <span key={tag} className="inline-flex gap-1.5 items-center px-3 py-1 rounded-full text-[13px] font-medium text-foreground group/pill" style={{
                        backgroundColor: `hsla(${h}, 70%, 60%, 0.15)`,
                        color: `hsl(${h}, 70%, 50%)`,
                        border: `1px solid hsla(${h}, 70%, 60%, 0.3)`,
                        paddingLeft: '0.5rem',
                        paddingRight: '0.5rem'
                    }}>
                        {tag}
                        <X
                            className="w-3 h-3 opacity-50 hover:opacity-100 transition-opacity cursor-pointer"
                            onClick={() => removeTag(tag)}
                        />
                    </span>
                );
            })}
            {!readOnly && (
                <input
                    type="text"
                    value={input}
                    onChange={e => {
                        setInput(e.target.value);
                        setShowSuggestions(true);
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                    onKeyDown={e => {
                        if (!showSuggestions || suggestions.length === 0) {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                addTag(input);
                            } else if (e.key === 'Backspace' && input === "" && values.length > 0) {
                                removeTag(values[values.length - 1]);
                            }
                            return;
                        }
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            addTag(suggestions[selectedIndex] || input);
                        } else if (e.key === 'ArrowDown') {
                            e.preventDefault();
                            setSelectedIndex((prev) => (prev + 1) % Math.min(suggestions.length, 10));
                        } else if (e.key === 'ArrowUp') {
                            e.preventDefault();
                            setSelectedIndex((prev) => (prev - 1 < 0 ? Math.min(suggestions.length, 10) - 1 : prev - 1));
                        } else if (e.key === 'Escape') {
                            e.preventDefault();
                            setShowSuggestions(false);
                        } else if (e.key === 'Backspace' && input === "" && values.length > 0) {
                            removeTag(values[values.length - 1]);
                        }
                    }}
                    className="flex-1 bg-transparent border-none outline-none text-[13px] min-w-[80px]"
                    placeholder={values.length === 0 ? "Empty" : "..."}
                />
            )}
            {showSuggestions && suggestions.length > 0 && (
                <div
                    className={cn(
                        "absolute top-full left-0 mt-2 z-50 w-64 flex flex-col overflow-hidden rounded-xl border",
                        "animate-in fade-in zoom-in-95 duration-150 ease-out"
                    )}
                    style={{
                        backgroundColor: "var(--color-panel-bg)",
                        borderColor: "var(--color-panel-border)",
                        boxShadow: "var(--shadow-xl)",
                    }}
                >
                    <div className="overflow-y-auto px-2 py-2 max-h-48 custom-scrollbar">
                        {suggestions.slice(0, 10).map((s, idx) => {
                            const isSelected = idx === selectedIndex;
                            return (
                                <div
                                    key={s}
                                    className={cn(
                                        "flex items-center gap-2 rounded-[4px] px-3 py-2 text-[13px] transition-colors duration-75 cursor-pointer text-left mb-0.5",
                                        isSelected ? "bg-[color:var(--color-panel-active)]" : ""
                                    )}
                                    style={{ color: isSelected ? "var(--color-text-primary)" : "var(--color-text-secondary)" }}
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        addTag(s);
                                    }}
                                    onMouseMove={() => setSelectedIndex(idx)}
                                >
                                    <span className="font-medium truncate">{s}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

const PropertyKeyInput = ({ value, onChange, className, existingKeys, readOnly }: { value: string, onChange: (v: string) => void, className?: string, existingKeys: string[], readOnly: boolean }) => {
    const [val, setVal] = useState(value);
    const { filterProperties } = usePropertyAutocomplete();
    const filterTerm = val === value ? "" : val;
    const suggestions = filterProperties(filterTerm).filter(s => s === value || !existingKeys.includes(s));
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);

    useEffect(() => {
        setSelectedIndex(0);
    }, [suggestions.length]);

    useEffect(() => {
        setVal(value);
    }, [value]);

    const submit = (newValue: string) => {
        if (readOnly) return;
        const trimmed = newValue.trim();
        if (trimmed === "" || (existingKeys.includes(trimmed) && trimmed !== value)) {
            setVal(value);
        } else {
            setVal(trimmed);
            if (trimmed !== value) {
                onChange(trimmed);
            }
        }
        setShowSuggestions(false);
    };

    return (
        <>
            <input
                type="text"
                value={val}
                autoComplete="off"
                onChange={e => {
                    if (readOnly) return;
                    setVal(e.target.value);
                    setShowSuggestions(true);
                }}
                onFocus={() => {
                    if (!readOnly) setShowSuggestions(true);
                }}
                onBlur={() => setTimeout(() => {
                    setShowSuggestions(false);
                    if (val !== value) submit(val);
                }, 150)}
                onKeyDown={e => {
                    if (readOnly) return;
                    if (!showSuggestions || suggestions.length === 0) {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            e.currentTarget.blur();
                        }
                        return;
                    }
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        submit(suggestions[selectedIndex] || val);
                    } else if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        setSelectedIndex((prev) => (prev + 1) % Math.min(suggestions.length, 10));
                    } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        setSelectedIndex((prev) => (prev - 1 < 0 ? Math.min(suggestions.length, 10) - 1 : prev - 1));
                    } else if (e.key === 'Escape') {
                        e.preventDefault();
                        setShowSuggestions(false);
                    }
                }}
                className={className || "flex-1 bg-transparent border-none outline-none text-[13px] w-full"}
                placeholder="Property"
                readOnly={readOnly}
                tabIndex={readOnly ? -1 : 0}
            />
            {showSuggestions && suggestions.length > 0 && (
                <div
                    className={cn(
                        "absolute top-full left-0 mt-2 z-50 w-64 flex flex-col overflow-hidden rounded-xl border",
                        "animate-in fade-in zoom-in-95 duration-150 ease-out"
                    )}
                    style={{
                        backgroundColor: "var(--color-panel-bg)",
                        borderColor: "var(--color-panel-border)",
                        boxShadow: "var(--shadow-xl)",
                    }}
                >
                    <div className="overflow-y-auto px-2 py-2 max-h-48 custom-scrollbar">
                        {suggestions.slice(0, 10).map((s, idx) => {
                            const isSelected = idx === selectedIndex;
                            return (
                                <div
                                    key={s}
                                    className={cn(
                                        "flex items-center gap-2 rounded-[4px] px-3 py-2 text-[13px] transition-colors duration-75 cursor-pointer text-left mb-0.5",
                                        isSelected ? "bg-[color:var(--color-panel-active)]" : ""
                                    )}
                                    style={{ color: isSelected ? "var(--color-text-primary)" : "var(--color-text-secondary)" }}
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        submit(s);
                                    }}
                                    onMouseMove={() => setSelectedIndex(idx)}
                                >
                                    <span className="font-medium truncate">{s}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </>
    );
};

const StringInput = ({ value, onChange, className, readOnly }: { value: string, onChange: (v: string) => void, className?: string, readOnly: boolean }) => {
    const [val, setVal] = useState(value);

    useEffect(() => {
        setVal(value);
    }, [value]);

    return (
        <input
            type="text"
            value={val}
            onChange={e => {
                if (readOnly) return;
                setVal(e.target.value);
            }}
            onBlur={() => {
                if (readOnly) return;
                if (val !== value) {
                    onChange(val);
                }
            }}
            onKeyDown={e => {
                if (readOnly) return;
                if (e.key === 'Enter') {
                    e.currentTarget.blur();
                }
            }}
            className={className || "flex-1 bg-transparent border-none outline-none text-[13px] w-full"}
            placeholder="Empty"
            readOnly={readOnly}
            tabIndex={readOnly ? -1 : 0}
        />
    );
};

// CodeMirror Widget Bridge
export class FrontmatterWidget extends WidgetType {
    root: Root | null = null;
    dom: HTMLElement | null = null;

    constructor(public block: FrontmatterBlock, private readOnly: boolean) {
        super();
    }

    eq(other: FrontmatterWidget) {
        return this.block.yaml === other.block.yaml
            && this.block.from === other.block.from
            && this.block.to === other.block.to
            && this.readOnly === other.readOnly;
    }

    toDOM(view: EditorView): HTMLElement {
        this.dom = document.createElement("div");
        this.root = createRoot(this.dom);
        this.root.render(<FrontmatterUI view={view} initialBlock={this.block} readOnly={this.readOnly} />);
        return this.dom;
    }

    updateDOM(dom: HTMLElement, view: EditorView): boolean {
        // Optimize React re-renders without unmounting the whole Tree when user edits inside the widget
        if (this.root && dom === this.dom) {
            this.root.render(<FrontmatterUI view={view} initialBlock={this.block} readOnly={this.readOnly} />);
            return true;
        }
        return false;
    }

    destroy(_dom: HTMLElement) {
        if (this.root) {
            // Need to wait for React to be done potentially updating before unmount
            setTimeout(() => this.root?.unmount(), 0);
        }
    }
}
