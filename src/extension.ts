import * as vscode from 'vscode';

// 1. Define the distinct emojis for our modes
const commentDeco = vscode.window.createTextEditorDecorationType({
    textDecoration: 'none; display: none;',
    before: { contentText: '💬 ', margin: '0 2px', color: '#888888' }
});

const codeDeco = vscode.window.createTextEditorDecorationType({
    textDecoration: 'none; display: none;',
    before: { contentText: '💻 ', margin: '0 2px', color: '#4CAF50' }
});

// 2. State Managers (The Brains)
let currentMode: 'normal' | 'all' | 'code' | 'comments' = 'normal';
let unfoldedLines: Set<number> = new Set();       // Lines explicitly SHOWING
let manuallyFoldedLines: Set<number> = new Set(); // Lines explicitly HIDING
let statusBarItem: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext) {
    
    // --- Setup Status Bar ---
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    context.subscriptions.push(statusBarItem);
    updateStatusBar();

    // Command 1: Clean Slate Mode
    let toggleAll = vscode.commands.registerCommand('smartfold.toggleAll', () => {
        currentMode = currentMode === 'all' ? 'normal' : 'all';
        resetStates();
        updateDecorations();
        updateStatusBar();
    });

    // Command 2: Reading Mode (Show Comments, Hide Code)
    let toggleCode = vscode.commands.registerCommand('smartfold.toggleCode', () => {
        currentMode = currentMode === 'code' ? 'normal' : 'code';
        resetStates();
        updateDecorations();
        updateStatusBar();
    });

    // Command 3: Coding Mode (Show Code, Hide Comments)
    let toggleComments = vscode.commands.registerCommand('smartfold.toggleComments', () => {
        currentMode = currentMode === 'comments' ? 'normal' : 'comments';
        resetStates();
        updateDecorations();
        updateStatusBar();
    });

    // Command 4: Universal Intelligent Toggle (Pack/Unpack) - MULTI-LINE SUPPORT
    let toggleCurrent = vscode.commands.registerCommand('smartfold.toggleCurrent', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;
        
        const document = editor.document;
        const selectedLines = new Set<number>();

        for (const selection of editor.selections) {
            for (let i = selection.start.line; i <= selection.end.line; i++) {
                if (document.lineAt(i).text.trim() !== '') {
                    selectedLines.add(i);
                }
            }
        }

        if (selectedLines.size === 0) return;

        const firstLine = Math.min(...Array.from(selectedLines));
        const currentlyHidden = isLineHidden(firstLine, document);

        for (const lineNum of selectedLines) {
            if (currentlyHidden) {
                manuallyFoldedLines.delete(lineNum);
                unfoldedLines.add(lineNum);
            } else {
                unfoldedLines.delete(lineNum);
                manuallyFoldedLines.add(lineNum);
            }
        }
        updateDecorations();
    });

    // Command 5: SMART COPY (Only copy visible lines)
    let smartCopy = vscode.commands.registerCommand('smartfold.smartCopy', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            await vscode.commands.executeCommand('editor.action.clipboardCopyAction');
            return;
        }

        const document = editor.document;
        let textToCopy: string[] = [];

        for (const selection of editor.selections) {
            if (selection.isEmpty) {
                // If nothing is selected, VS Code normally copies the whole line
                const lineNum = selection.active.line;
                if (!isLineHidden(lineNum, document)) {
                    textToCopy.push(document.lineAt(lineNum).text);
                }
            } else {
                // If user selected a block of text
                let visibleLinesInSelection: string[] = [];
                for (let i = selection.start.line; i <= selection.end.line; i++) {
                    if (!isLineHidden(i, document)) {
                        let startChar = (i === selection.start.line) ? selection.start.character : 0;
                        let endChar = (i === selection.end.line) ? selection.end.character : document.lineAt(i).text.length;
                        visibleLinesInSelection.push(document.lineAt(i).text.substring(startChar, endChar));
                    }
                }
                if (visibleLinesInSelection.length > 0) {
                    textToCopy.push(visibleLinesInSelection.join('\n'));
                }
            }
        }

        if (textToCopy.length > 0) {
            const finalString = textToCopy.join('\n');
            await vscode.env.clipboard.writeText(finalString);
            vscode.window.setStatusBarMessage('$(check) Copied visible lines only!', 3000);
        }
    });

    // Event: Sticky Unfold logic (Mouse Click Only)
    vscode.window.onDidChangeTextEditorSelection(event => {
        if (event.kind !== vscode.TextEditorSelectionChangeKind.Mouse) return;
        
        let needsUpdate = false;
        const document = event.textEditor.document;

        for (const selection of event.selections) {
            const lineNum = selection.active.line;
            
            if (isLineHidden(lineNum, document)) {
                manuallyFoldedLines.delete(lineNum);
                unfoldedLines.add(lineNum);
                needsUpdate = true;
            }
        }
        if (needsUpdate) updateDecorations();
    }, null, context.subscriptions);

    // Events: Re-apply when typing or switching tabs
    vscode.workspace.onDidChangeTextDocument(() => updateDecorations(), null, context.subscriptions);
    vscode.window.onDidChangeActiveTextEditor(() => {
        updateDecorations();
        updateStatusBar();
    }, null, context.subscriptions);

    context.subscriptions.push(toggleAll, toggleCode, toggleComments, toggleCurrent, smartCopy);
}

// Helper: Clears custom toggles when switching main modes
function resetStates() {
    unfoldedLines.clear();
    manuallyFoldedLines.clear();
}

// --- The Master Brain: Determines visibility dynamically ---
function isLineHidden(lineNum: number, document: vscode.TextDocument, isComment?: boolean): boolean {
    if (unfoldedLines.has(lineNum)) return false;     
    if (manuallyFoldedLines.has(lineNum)) return true; 

    if (currentMode === 'normal') return false; 
    if (currentMode === 'all') return true;     

    if (isComment === undefined) {
        const text = document.lineAt(lineNum).text.trim();
        if (text === '') return false;
        isComment = text.startsWith('//') || text.startsWith('/*') || text.startsWith('*');
    }

    if (currentMode === 'code' && !isComment) return true;    
    if (currentMode === 'comments' && isComment) return true; 
    
    return false;
}

// --- Status Bar Logic ---
function updateStatusBar() {
    if (currentMode === 'normal') {
        statusBarItem.hide();
    } else {
        if (currentMode === 'all') {
            statusBarItem.text = `$(eye-closed) Smart Fold: Clean Slate 📦`;
        } else if (currentMode === 'code') {
            statusBarItem.text = `$(eye-closed) Smart Fold: Reading Mode 💬`;
        } else if (currentMode === 'comments') {
            statusBarItem.text = `$(eye-closed) Smart Fold: Coding Mode 💻`;
        }
        statusBarItem.show();
    }
}

// --- The Engine: Applies visual emojis ---
function updateDecorations() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    const commentRanges: vscode.Range[] = [];
    const codeRanges: vscode.Range[] = [];
    const document = editor.document;

    for (let i = 0; i < document.lineCount; i++) {
        const line = document.lineAt(i);
        const text = line.text.trim();

        if (text === '') continue;

        const isComment = text.startsWith('//') || text.startsWith('/*') || text.startsWith('*');

        if (isLineHidden(i, document, isComment)) {
            const range = new vscode.Range(
                new vscode.Position(i, line.firstNonWhitespaceCharacterIndex),
                new vscode.Position(i, line.text.length)
            );
            
            if (isComment) {
                commentRanges.push(range);
            } else {
                codeRanges.push(range);
            }
        }
    }

    editor.setDecorations(commentDeco, commentRanges);
    editor.setDecorations(codeDeco, codeRanges);
}

export function deactivate() {
    resetStates();
    if (statusBarItem) statusBarItem.dispose();
}