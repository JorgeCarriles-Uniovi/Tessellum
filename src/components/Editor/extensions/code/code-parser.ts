import { syntaxTree } from "@codemirror/language";
import { EditorState } from "@codemirror/state";

export interface CodeBlock {
    from: number;
    to: number;
    language: string;
}

/**
 * Scans the current document state for FencedCode blocks and extracts their metadata.
 */
export function parseCodeBlocks(state: EditorState): CodeBlock[] {
    const blocks: CodeBlock[] = [];
    const tree = syntaxTree(state);

    tree.iterate({
        enter: (node) => {
            if (node.name === "FencedCode") {
                const { from, to } = node;

                // Try to find CodeInfo to get the language name
                let language = "";
                let child = node.node.firstChild;
                while (child) {
                    if (child.name === "CodeInfo") {
                        language = state.doc.sliceString(child.from, child.to).trim().toLowerCase();
                        break;
                    }
                    child = child.nextSibling;
                }

                blocks.push({ from, to, language });
            }
        }
    });

    return blocks;
}
