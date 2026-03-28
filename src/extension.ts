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

// 2. State Managers (The Brain)
let currentMode: 'normal' | 'all' | 'code' | 'comments' = 'normal';
let unfoldedLines: Set<number> = new Set(); // For Map Modes (what to show)
let manuallyFoldedLines: Set<number> = new Set(); // NEW: For Normal Mode (what to hide)
let statusBarItem: vscode.StatusBarItem; 

export function activate(context: vscode.ExtensionContext) {
    
    // --- Setup Status Bar ---
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    context.subscriptions.push(statusBarItem);
    updateStatusBar();
    // ------------------------

    // Command 1: Clean Slate Mode
    let toggleAll = vscode.commands.registerCommand('smartfold.toggleAll', () => {
        currentMode = currentMode === 'all' ? 'normal' : 'all';
        resetStates();
        updateDecorations();
        updateStatusBar();
    });

    // Command 2: Reading Mode (Show Comments)
    let toggleCode = vscode.commands.registerCommand('smartfold.toggleCode', () => {
        currentMode = currentMode === 'code' ? 'normal' : 'code';
        resetStates();
        updateDecorations();
        updateStatusBar();
    });

    // Command 3: Coding Mode (Show Code)
    let toggleComments = vscode.commands.registerCommand('smartfold.toggleComments', () => {
        currentMode = currentMode === 'comments' ? 'normal' : 'comments';
        resetStates();
        updateDecorations();
        updateStatusBar();
    });

    // Command 4: Toggle Current Single Line (Pack/Unpack) - Alt + S
    let toggleCurrent = vscode.commands.registerCommand('smartfold.toggleCurrent', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;
        
        const line = editor.selection.active.line;

        if (currentMode === 'normal') {
            // Normal Mode Logic: We manually FOLD lines
            if (manuallyFoldedLines.has(line)) {
                manuallyFoldedLines.delete(line); // Unfold if already folded
            } else {
                manuallyFoldedLines.add(line); // Fold it
            }
        } else {
            // Map Modes Logic: We manually UNFOLD lines
            if (unfoldedLines.has(line)) {
                unfoldedLines.delete(line);
            } else {
                unfoldedLines.add(line);
            }
        }
        updateDecorations();
    });

    // Event: Sticky Unfold logic (Mouse Click Only)
    vscode.window.onDidChangeTextEditorSelection(event => {
        if (event.kind !== vscode.TextEditorSelectionChangeKind.Mouse) return;
        
        let needsUpdate = false;
        for (const selection of event.selections) {
            const line = selection.active.line;

            if (currentMode === 'normal') {
                // If clicked on a manually folded line in normal mode, unfold it
                if (manuallyFoldedLines.has(line)) {
                    manuallyFoldedLines.delete(line);
                    needsUpdate = true;
                }
            } else {
                // If clicked on a folded line in map modes, unfold it
                if (!unfoldedLines.has(line)) {
                    unfoldedLines.add(line);
                    needsUpdate = true;
                }
            }
        }
        if (needsUpdate) updateDecorations();
    }, null, context.subscriptions);

    // Event: Re-apply when typing or switching tabs
    vscode.workspace.onDidChangeTextDocument(() => updateDecorations(), null, context.subscriptions);
    vscode.window.onDidChangeActiveTextEditor(() => {
        updateDecorations();
        updateStatusBar();
    }, null, context.subscriptions);

    context.subscriptions.push(toggleAll, toggleCode, toggleComments, toggleCurrent);
}

// Helper to clean up states when switching modes
function resetStates() {
    unfoldedLines.clear();
    manuallyFoldedLines.clear();
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

// --- The Engine ---
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

        // Intelligence: Is it a comment or code?
        const isComment = text.startsWith('//') || text.startsWith('/*') || text.startsWith('*');

        const range = new vscode.Range(
            new vscode.Position(i, line.firstNonWhitespaceCharacterIndex),
            new vscode.Position(i, line.text.length)
        );

        if (currentMode === 'normal') {
            // NORMAL MODE: Only decorate lines the user explicitly folded
            if (manuallyFoldedLines.has(i)) {
                if (isComment) {
                    commentRanges.push(range);
                } else {
                    codeRanges.push(range);
                }
            }
        } else {
            // MAP MODES: Hide everything UNLESS user explicitly unfolded it
            if (unfoldedLines.has(i)) continue;

            if (isComment) {
                if (currentMode === 'all' || currentMode === 'comments') commentRanges.push(range);
            } else {
                if (currentMode === 'all' || currentMode === 'code') codeRanges.push(range);
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