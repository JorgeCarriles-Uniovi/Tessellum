import {
    Info, AlertTriangle, ShieldAlert, AlertCircle, BookOpen,
    ClipboardList, CheckCircle2, HelpCircle, XCircle, Skull, Bug,
    FlaskConical, Quote, Flame, FileText, Terminal
} from "lucide-react";

// ─── Callout Type Definition ──────────────────────────────────────────────────

export interface CalloutType {
    id: string;
    label: string;
    icon: typeof Info;           // Lucide icon component
    color: string;               // Accent color (hex)
    category: CalloutCategory;
}

export type CalloutCategory = "Informational" | "Warning" | "Status" | "Other";

// ─── Type Registry ────────────────────────────────────────────────────────────

export const CALLOUT_TYPES: CalloutType[] = [
    // Informational
    { id: "note", label: "Note", icon: FileText, color: "var(--callout-info)", category: "Informational" },
    { id: "info", label: "Info", icon: Info, color: "var(--callout-info)", category: "Informational" },
    { id: "tip", label: "Tip", icon: Flame, color: "var(--callout-tip)", category: "Informational" },
    { id: "abstract", label: "Abstract", icon: BookOpen, color: "var(--callout-tip)", category: "Informational" },

    // Warning
    { id: "warning", label: "Warning", icon: AlertTriangle, color: "var(--callout-warning)", category: "Warning" },
    { id: "caution", label: "Caution", icon: ShieldAlert, color: "var(--callout-warning)", category: "Warning" },
    { id: "important", label: "Important", icon: AlertCircle, color: "var(--callout-danger)", category: "Warning" },
    { id: "danger", label: "Danger", icon: Skull, color: "var(--callout-danger)", category: "Warning" },

    // Status
    { id: "success", label: "Success", icon: CheckCircle2, color: "var(--callout-success)", category: "Status" },
    { id: "failure", label: "Failure", icon: XCircle, color: "var(--callout-danger)", category: "Status" },
    { id: "todo", label: "Todo", icon: ClipboardList, color: "var(--callout-info)", category: "Status" },
    { id: "bug", label: "Bug", icon: Bug, color: "var(--callout-danger)", category: "Status" },
    { id: "question", label: "Question", icon: HelpCircle, color: "var(--callout-warning)", category: "Status" },

    // Other
    { id: "example", label: "Example", icon: FlaskConical, color: "var(--callout-example)", category: "Other" },
    { id: "quote", label: "Quote", icon: Quote, color: "var(--callout-quote)", category: "Other" },
    { id: "cite", label: "Cite", icon: Quote, color: "var(--callout-quote)", category: "Other" },
    { id: "terminal", label: "Terminal", icon: Terminal, color: "var(--callout-terminal)", category: "Other" },
];

// ─── Lookup Helpers ───────────────────────────────────────────────────────────

const typeMap = new Map(CALLOUT_TYPES.map(t => [t.id, t]));

/** Look up a callout type by ID (case-insensitive). Returns undefined for unknown types. */
export function getCalloutType(id: string): CalloutType | undefined {
    return typeMap.get(id.toLowerCase());
}

/** All unique categories in display order. */
export const CALLOUT_CATEGORIES: CalloutCategory[] = [
    "Informational", "Warning", "Status", "Other"
];

/** Group callout types by category. */
export function getCalloutsByCategory(): Record<CalloutCategory, CalloutType[]> {
    return {
        Informational: CALLOUT_TYPES.filter(t => t.category === "Informational"),
        Warning: CALLOUT_TYPES.filter(t => t.category === "Warning"),
        Status: CALLOUT_TYPES.filter(t => t.category === "Status"),
        Other: CALLOUT_TYPES.filter(t => t.category === "Other"),
    };
}
