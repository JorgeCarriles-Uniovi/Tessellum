import fs from 'fs';
import path from 'path';

const rustDir = './src-tauri/src';

function getRustFiles(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    for (const file of list) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat && stat.isDirectory()) {
            results = results.concat(getRustFiles(filePath));
        } else if (file.endsWith('.rs')) {
            results.push(filePath);
        }
    }
    return results;
}

// Find matching brace boundary
function getBlockBodyWithBraceCounting(code, startIdx) {
    let braceCount = 1;
    let endIdx = startIdx;
    while (braceCount > 0 && endIdx < code.length) {
        const char = code[endIdx];
        if (char === '{') {
            braceCount++;
        } else if (char === '}') {
            braceCount--;
        }
        endIdx++;
    }
    return {
        body: code.substring(startIdx, endIdx - 1),
        endIndex: endIdx
    };
}

function stripTestsAndMocks(code) {
    let cleaned = code;
    // Replace #[cfg(test)] mod tests { ... } or mod tests { ... }
    const testRegex = /(?:#\[cfg\(test\)\]\s*)?mod\s+tests\s*\{/g;
    let match;
    while ((match = testRegex.exec(cleaned)) !== null) {
        const startIdx = match.index + match[0].length;
        const { endIndex } = getBlockBodyWithBraceCounting(cleaned, startIdx);
        cleaned = cleaned.substring(0, match.index) + cleaned.substring(endIndex);
        testRegex.lastIndex = 0; // restart search on modified string
    }
    return cleaned;
}

function parseRustFile(filePath, originalCode) {
    const relativePath = path.relative('.', filePath).replace(/\\/g, '/');
    
    // 1. Strip tests
    let code = stripTestsAndMocks(originalCode);

    const structs = [];
    const impls = [];

    // 2. Parse and remove structs to avoid getting confused by braces
    let codeWithoutStructs = code;
    const structRegex = /(?:pub\s+)?struct\s+(\w+)/g;
    let match;
    while ((match = structRegex.exec(code)) !== null) {
        const structName = match[1];
        const nextCharIdx = match.index + match[0].length;
        
        const remaining = code.substring(nextCharIdx);
        const bracketIdx = remaining.indexOf('{');
        const semicolonIdx = remaining.indexOf(';');
        
        let body = '';
        let fullMatchLength = match[0].length;
        let endIndex = nextCharIdx;

        if (bracketIdx !== -1 && (semicolonIdx === -1 || bracketIdx < semicolonIdx)) {
            const startIdx = nextCharIdx + bracketIdx + 1;
            const res = getBlockBodyWithBraceCounting(code, startIdx);
            body = res.body;
            endIndex = res.endIndex;
        } else if (semicolonIdx !== -1) {
            endIndex = nextCharIdx + semicolonIdx + 1;
        }

        // Get comments preceding the struct
        const beforeCode = code.substring(0, match.index);
        const commentLines = beforeCode.trim().split('\n');
        const comments = [];
        for (let i = commentLines.length - 1; i >= 0; i--) {
            const line = commentLines[i].trim();
            if (line.startsWith('///')) {
                comments.unshift(line.replace('///', '').trim());
            } else if (line.startsWith('//')) {
                comments.unshift(line.replace('//', '').trim());
            } else {
                break;
            }
        }
        const description = comments.join(' ');

        // Extract attributes/fields from body
        const attributes = [];
        const fieldRegex = /(?:\/\/\/([^\n]*)\n|\/\/([^\n]*)\n)*\s*(pub\s+)?(\w+)\s*:\s*([^,\n}]+)/g;
        let fieldMatch;
        while ((fieldMatch = fieldRegex.exec(body)) !== null) {
            const isPub = !!fieldMatch[3];
            const name = fieldMatch[4];
            const type = fieldMatch[5].trim();
            attributes.push({
                access: isPub ? 'Public' : 'Private',
                mode: 'None',
                type,
                name,
                description: ''
            });
        }

        structs.push({
            name: structName,
            inheritsFrom: 'None',
            isAbstract: false,
            description,
            filePath: relativePath,
            attributes,
            methods: []
        });

        // Strip struct block from remainder code
        codeWithoutStructs = codeWithoutStructs.replace(code.substring(match.index, endIndex), '');
    }

    // 3. Parse and remove impl blocks using brace counting from codeWithoutStructs
    let codeWithoutStructsOrImpls = codeWithoutStructs;
    const implRegex = /impl\s+(?:<\w+>\s+)?(\w+)\s*\{/g;
    let implMatch;
    while ((implMatch = implRegex.exec(codeWithoutStructs)) !== null) {
        const structName = implMatch[1];
        const startIdx = implMatch.index + implMatch[0].length;
        const { body: implBody, endIndex } = getBlockBodyWithBraceCounting(codeWithoutStructs, startIdx);

        // Find or create struct
        let targetStruct = structs.find(s => s.name === structName);
        if (!targetStruct) {
            // Impl for non-struct (like trait or other things), create dummy struct
            targetStruct = {
                name: structName,
                inheritsFrom: 'None',
                isAbstract: false,
                description: `Implementation definitions for ${structName}.`,
                filePath: relativePath,
                attributes: [],
                methods: []
            };
            structs.push(targetStruct);
        }

        // Parse functions inside impl block
        const fnRegex = /(pub\s+)?(async\s+)?fn\s+(\w+)\s*\(([\s\S]*?)\)(?:\s*->\s*([^{]+))?/g;
        let fnMatch;
        while ((fnMatch = fnRegex.exec(implBody)) !== null) {
            const isPub = !!fnMatch[1];
            const isAsync = !!fnMatch[2];
            const name = fnMatch[3];
            const rawParams = fnMatch[4].replace(/\n/g, ' ').trim();
            const returnType = fnMatch[5] ? fnMatch[5].trim() : '()';

            // Get comments preceding the function inside impl
            const fnSearchIdx = fnMatch.index;
            const beforeFnCode = implBody.substring(0, fnSearchIdx).trim();
            const fnCommentLines = beforeFnCode.split('\n');
            const fnComments = [];
            for (let i = fnCommentLines.length - 1; i >= 0; i--) {
                const line = fnCommentLines[i].trim();
                if (line.startsWith('///')) {
                    fnComments.unshift(line.replace('///', '').trim());
                } else if (line.startsWith('//')) {
                    fnComments.unshift(line.replace('//', '').trim());
                } else {
                    break;
                }
            }
            const fnDescription = fnComments.join(' ');

            const isStatic = !(rawParams.includes('&self') || rawParams.includes('&mut self') || rawParams.includes('self'));
            const cleanParams = rawParams
                .split(',')
                .map(p => p.trim())
                .filter(p => p !== '&self' && p !== '&mut self' && p !== 'self' && p.length > 0)
                .join(', ');

            targetStruct.methods.push({
                access: isPub ? 'Public' : 'Private',
                mode: isStatic ? (isAsync ? 'Static, Async' : 'Static') : (isAsync ? 'Async' : 'None'),
                returnType,
                name,
                parameters: cleanParams,
                description: fnDescription
            });
        }

        codeWithoutStructsOrImpls = codeWithoutStructsOrImpls.replace(codeWithoutStructs.substring(implMatch.index, endIndex), '');
    }

    // 4. Parse all remaining free-standing functions in codeWithoutStructsOrImpls
    const freeStandingFns = [];
    const freeFnRegex = /(pub\s+)?(async\s+)?fn\s+(\w+)\s*\(([\s\S]*?)\)(?:\s*->\s*([^{]+))?/g;
    let freeFnMatch;
    while ((freeFnMatch = freeFnRegex.exec(codeWithoutStructsOrImpls)) !== null) {
        const isPub = !!freeFnMatch[1];
        const isAsync = !!freeFnMatch[2];
        const name = freeFnMatch[3];
        const rawParams = freeFnMatch[4].replace(/\n/g, ' ').trim();
        const returnType = freeFnMatch[5] ? freeFnMatch[5].trim() : '()';

        // Get comments preceding the function in codeWithoutStructsOrImpls
        const fnSearchIdx = freeFnMatch.index;
        const beforeFnCode = codeWithoutStructsOrImpls.substring(0, fnSearchIdx).trim();
        const fnCommentLines = beforeFnCode.split('\n');
        const fnComments = [];
        for (let i = fnCommentLines.length - 1; i >= 0; i--) {
            const line = fnCommentLines[i].trim();
            if (line.startsWith('///')) {
                fnComments.unshift(line.replace('///', '').trim());
            } else if (line.startsWith('//')) {
                fnComments.unshift(line.replace('//', '').trim());
            } else {
                break;
            }
        }
        const fnDescription = fnComments.join(' ');

        const cleanParams = rawParams
            .split(',')
            .map(p => p.trim())
            .filter(p => p.length > 0)
            .join(', ');

        freeStandingFns.push({
            access: isPub ? 'Public' : 'Private',
            mode: isAsync ? 'Static, Async' : 'Static',
            returnType,
            name,
            parameters: cleanParams,
            description: fnDescription
        });
    }

    // Group free-standing functions into a "Virtual Class" named after the file module
    if (freeStandingFns.length > 0) {
        let moduleName = path.basename(filePath, '.rs');
        
        // Capitalize and format virtual class name
        let formattedName = moduleName.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('') + 'Module';
        if (filePath.includes('/commands/')) {
            formattedName = moduleName.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('') + 'Commands';
        } else if (filePath.includes('/utils/')) {
            formattedName = moduleName.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('') + 'Utils';
        }

        structs.push({
            name: formattedName,
            inheritsFrom: 'None',
            isAbstract: false,
            description: `Procedural module class encapsulating free-standing functions inside \`${relativePath}\`.`,
            filePath: relativePath,
            attributes: [],
            methods: freeStandingFns,
            isModuleClass: true
        });
    }

    return structs;
}

const files = getRustFiles(rustDir);
const allStructs = [];

for (const file of files) {
    if (file.includes('test_support.rs')) continue;
    const code = fs.readFileSync(file, 'utf8');
    const fileStructs = parseRustFile(file, code);
    allStructs.push(...fileStructs);
}

fs.writeFileSync(
    './extracted_rust.json',
    JSON.stringify(allStructs, null, 2)
);
console.log(`Extracted ${allStructs.length} structures and modules from Rust files to extracted_rust.json`);
