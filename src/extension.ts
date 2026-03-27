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
let unfoldedLines: Set<number> = new Set();
let statusBarItem: vscode.StatusBarItem; // <-- The "Caps Lock Light"

export function activate(context: vscode.ExtensionContext) {
    
    // --- Setup Status Bar ---
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    context.subscriptions.push(statusBarItem);
    updateStatusBar(); // Show initial state
    // ------------------------

    // Command 1: Clean Slate Mode
    let toggleAll = vscode.commands.registerCommand('smartfold.toggleAll', () => {
        currentMode = currentMode === 'all' ? 'normal' : 'all';
        unfoldedLines.clear();
        updateDecorations();
        updateStatusBar();
    });

    // Command 2: Reading Mode (Show Comments)
    let toggleCode = vscode.commands.registerCommand('smartfold.toggleCode', () => {
        currentMode = currentMode === 'code' ? 'normal' : 'code';
        unfoldedLines.clear();
        updateDecorations();
        updateStatusBar();
    });

    // Command 3: Coding Mode (Show Code)
    let toggleComments = vscode.commands.registerCommand('smartfold.toggleComments', () => {
        currentMode = currentMode === 'comments' ? 'normal' : 'comments';
        unfoldedLines.clear();
        updateDecorations();
        updateStatusBar();
    });

// Command 4: Toggle Current Single Line (Pack/Unpack) - Alt + S
    let toggleCurrent = vscode.commands.registerCommand('smartfold.toggleCurrent', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;
        
        const line = editor.selection.active.line;

        // If it's currently unfolded (open), close it by removing from the set
        if (unfoldedLines.has(line)) {
            unfoldedLines.delete(line);
        } else {
            // If it's closed, open it manually
            unfoldedLines.add(line);
        }
        updateDecorations();
    });

// Event: Sticky Unfold logic
    vscode.window.onDidChangeTextEditorSelection(event => {
        if (currentMode === 'normal') return;
        
        // 🚀 THE FIX: Ignore keyboard navigation. Only auto-unfold on Mouse Clicks!
        if (event.kind !== vscode.TextEditorSelectionChangeKind.Mouse) {
            return;
        }
        
        let needsUpdate = false;
        for (const selection of event.selections) {
            const line = selection.active.line;
            if (!unfoldedLines.has(line)) {
                unfoldedLines.add(line);
                needsUpdate = true;
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

// --- Status Bar Logic ---
function updateStatusBar() {
    if (currentMode === 'normal') {
        statusBarItem.hide(); // Hide the light when normal
    } else {
        if (currentMode === 'all') {
            statusBarItem.text = `$(eye-closed) Smart Fold: Clean Slate 📦`;
        } else if (currentMode === 'code') {
            statusBarItem.text = `$(eye-closed) Smart Fold: Reading Mode 💬`;
        } else if (currentMode === 'comments') {
            statusBarItem.text = `$(eye-closed) Smart Fold: Coding Mode 💻`;
        }
        statusBarItem.show(); // Turn on the light
    }
}

function updateDecorations() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    if (currentMode === 'normal') {
        editor.setDecorations(commentDeco, []);
        editor.setDecorations(codeDeco, []);
        return;
    }

    const commentRanges: vscode.Range[] = [];
    const codeRanges: vscode.Range[] = [];
    const document = editor.document;

    for (let i = 0; i < document.lineCount; i++) {
        if (unfoldedLines.has(i)) continue;

        const line = document.lineAt(i);
        const text = line.text.trim();

        if (text === '') continue;

        const isComment = text.startsWith('//') || text.startsWith('/*') || text.startsWith('*');

        const range = new vscode.Range(
            new vscode.Position(i, line.firstNonWhitespaceCharacterIndex),
            new vscode.Position(i, line.text.length)
        );

        if (isComment) {
            if (currentMode === 'all' || currentMode === 'comments') commentRanges.push(range);
        } else {
            if (currentMode === 'all' || currentMode === 'code') codeRanges.push(range);
        }
    }

    editor.setDecorations(commentDeco, commentRanges);
    editor.setDecorations(codeDeco, codeRanges);
}

export function deactivate() {
    unfoldedLines.clear();
    if (statusBarItem) statusBarItem.dispose();
}