import ts from 'typescript';
import fs from 'fs';
import path from 'path';

const srcDir = './src';

function getFilesRecursively(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    for (const file of list) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat && stat.isDirectory()) {
            results = results.concat(getFilesRecursively(filePath));
        } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
            if (!file.endsWith('.test.ts') && !file.endsWith('.test.tsx') && !file.endsWith('.d.ts')) {
                results.push(filePath);
            }
        }
    }
    return results;
}

function getJSDoc(node, sourceFile) {
    const jsDocComments = ts.getJSDocCommentsAndTags(node);
    if (jsDocComments.length > 0) {
        return jsDocComments[0].comment || '';
    }
    // Fallback: check leading comments
    const fullText = sourceFile.text;
    const ranges = ts.getLeadingCommentRanges(fullText, node.pos);
    if (ranges && ranges.length > 0) {
        const comments = ranges.map(r => fullText.substring(r.pos, r.end)).join('\n');
        return comments.replace(/\/\*\*|\*\/|\*/g, '').trim();
    }
    return '';
}

function parseClass(node, sourceFile, relativePath) {
    const className = node.name ? node.name.text : 'Anonymous';
    const jsDoc = getJSDoc(node, sourceFile);

    let inheritsFrom = 'None';
    if (node.heritageClauses) {
        for (const clause of node.heritageClauses) {
            if (clause.token === ts.SyntaxKind.ExtendsKeyword) {
                inheritsFrom = clause.types.map(t => t.getText(sourceFile)).join(', ');
            }
        }
    }

    const modifiers = node.modifiers ? node.modifiers.map(m => m.getText(sourceFile)) : [];
    const isAbstract = modifiers.includes('abstract');

    const attributes = [];
    const methods = [];

    for (const member of node.members) {
        const memberModifiers = member.modifiers ? member.modifiers.map(m => m.getText(sourceFile)) : [];
        const access = memberModifiers.includes('private') ? 'Private' : memberModifiers.includes('protected') ? 'Protected' : 'Public';
        const isStatic = memberModifiers.includes('static') ? 'Static' : 'None';
        const isReadonly = memberModifiers.includes('readonly') ? 'Final' : 'None';

        if (ts.isPropertyDeclaration(member)) {
            const name = member.name.getText(sourceFile);
            const type = member.type ? member.type.getText(sourceFile) : 'any';
            attributes.push({
                access,
                mode: isStatic !== 'None' ? 'Static' : isReadonly !== 'None' ? 'Final' : 'None',
                type,
                name,
                description: getJSDoc(member, sourceFile)
            });
        } else if (ts.isMethodDeclaration(member) || ts.isConstructorDeclaration(member)) {
            const name = ts.isConstructorDeclaration(member) ? 'constructor' : member.name.getText(sourceFile);
            const returnType = member.type ? member.type.getText(sourceFile) : (ts.isConstructorDeclaration(member) ? 'void' : 'any');
            const parameters = member.parameters.map(p => {
                const pName = p.name.getText(sourceFile);
                const pType = p.type ? p.type.getText(sourceFile) : 'any';
                return `${pName}: ${pType}`;
            }).join(', ');

            const isAbstractMethod = memberModifiers.includes('abstract') ? 'Abstract' : 'None';

            methods.push({
                access,
                mode: isStatic !== 'None' ? 'Static' : isAbstractMethod !== 'None' ? 'Abstract' : 'None',
                returnType,
                name,
                parameters,
                description: getJSDoc(member, sourceFile)
            });
        }
    }

    return {
        name: className,
        inheritsFrom,
        isAbstract,
        description: jsDoc,
        filePath: relativePath,
        attributes,
        methods
    };
}

const files = getFilesRecursively(srcDir);
const classes = [];

for (const file of files) {
    const code = fs.readFileSync(file, 'utf8');
    const sourceFile = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true);
    const relativePath = path.relative('.', file).replace(/\\/g, '/');

    function visit(node) {
        if (ts.isClassDeclaration(node)) {
            classes.push(parseClass(node, sourceFile, relativePath));
        }
        ts.forEachChild(node, visit);
    }

    visit(sourceFile);
}

fs.writeFileSync(
    './extracted_classes.json',
    JSON.stringify(classes, null, 2)
);
console.log(`Extracted ${classes.length} classes to extracted_classes.json`);
