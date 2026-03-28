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

        // 1. Collect all unique, non-empty lines in the current selection(s)
        for (const selection of editor.selections) {
            for (let i = selection.start.line; i <= selection.end.line; i++) {
                if (document.lineAt(i).text.trim() !== '') {
                    selectedLines.add(i);
                }
            }
        }

        // If no valid lines selected, do nothing
        if (selectedLines.size === 0) return;

        // 2. Determine the "Intent" based on the FIRST line in the selection
        const firstLine = Math.min(...Array.from(selectedLines));
        const currentlyHidden = isLineHidden(firstLine, document);

        // 3. Apply the intent to ALL selected lines instantly
        for (const lineNum of selectedLines) {
            if (currentlyHidden) {
                // Intent is to SHOW all
                manuallyFoldedLines.delete(lineNum);
                unfoldedLines.add(lineNum);
            } else {
                // Intent is to HIDE all
                unfoldedLines.delete(lineNum);
                manuallyFoldedLines.add(lineNum);
            }
        }
        
        updateDecorations();
    });

    // Event: Sticky Unfold logic (Mouse Click Only)
    vscode.window.onDidChangeTextEditorSelection(event => {
        if (event.kind !== vscode.TextEditorSelectionChangeKind.Mouse) return;
        
        let needsUpdate = false;
        const document = event.textEditor.document;

        for (const selection of event.selections) {
            const lineNum = selection.active.line;
            
            // If we click on a hidden line, show it
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

    context.subscriptions.push(toggleAll, toggleCode, toggleComments, toggleCurrent);
}

// Helper: Clears custom toggles when switching main modes
function resetStates() {
    unfoldedLines.clear();
    manuallyFoldedLines.clear();
}

// --- The Master Brain: Determines visibility dynamically ---
function isLineHidden(lineNum: number, document: vscode.TextDocument, isComment?: boolean): boolean {
    // 1. Highest Priority: Did the user manually toggle this specific line?
    if (unfoldedLines.has(lineNum)) return false;     // Forced Show
    if (manuallyFoldedLines.has(lineNum)) return true; // Forced Hide

    // 2. Default Mode Rules
    if (currentMode === 'normal') return false; // Show all by default
    if (currentMode === 'all') return true;     // Hide all by default

    // Determine line type if not passed
    if (isComment === undefined) {
        const text = document.lineAt(lineNum).text.trim();
        if (text === '') return false;
        isComment = text.startsWith('//') || text.startsWith('/*') || text.startsWith('*');
    }

    // 3. Specific Mode Rules
    if (currentMode === 'code' && !isComment) return true;    // Reading mode hides code
    if (currentMode === 'comments' && isComment) return true; // Coding mode hides comments
    
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

        // Consult the Master Brain
        if (isLineHidden(i, document, isComment)) {
            const range = new vscode.Range(
                new vscode.Position(i, line.firstNonWhitespaceCharacterIndex),
                new vscode.Position(i, line.text.length)
            );
            
            // Intelligently assign the right emoji based on the content
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